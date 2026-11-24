// Optional macOS contract check. npm test remains independent of Xcode.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".ts")) return next(url, context);
    return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});

const directory = await mkdtemp(join(tmpdir(), "spotter-native-contract-"));
let db;
try {
  const binary = join(directory, "native-smoke");
  execFileSync("swiftc", ["ios/SpotterHealth/HeartPayload.swift", "ios/SpotterHealth/BridgeClient.swift", "ios/Tests/NativeSmoke.swift", "-o", binary], {
    cwd: fileURLToPath(root), stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync(binary, [], { stdio: ["ignore", "pipe", "pipe"] });
  const fixture = JSON.parse(execFileSync(binary, ["--contract-fixture"], { encoding: "utf8" }));
  process.env.SPOTTER_DB_PATH = join(directory, "synthetic.sqlite");
  process.env.SPOTTER_ORIGIN = "https://contract.invalid";
  const { database } = await import("../server/db.ts");
  const apple = await import("../features/heart/apple/server.ts");
  const health = await import("../features/health/server.ts");
  const { readHeart } = await import("../features/heart/server.ts");
  const pairRoute = await import("../app/api/health/apple/pair/route.ts");
  const syncRoute = await import("../app/api/health/apple/sync/route.ts");
  const recordsRoute = await import("../app/api/health/apple/records/route.ts");
  db = database();
  const owner = randomUUID();
  const other = randomUUID();
  for (const id of [owner, other]) db.prepare("INSERT INTO accounts (id, username, name, password_hash) VALUES (?, ?, ?, ?)").run(id, id, "synthetic", "unused");
  const { id, from, to } = fixture.workout;
  const session = { started: from, ended: to, minutes: 30 };
  db.prepare("INSERT INTO entries (owner, id, kind, payload, updated) VALUES (?, ?, 'log', ?, ?)").run(owner, id, JSON.stringify(session), new Date().toISOString());
  const request = (route, token, body, method = "POST") => new Request(process.env.SPOTTER_ORIGIN + "/api/health/apple/" + route, {
    method, headers: { Origin: process.env.SPOTTER_ORIGIN, "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
  const claim = await pairRoute.POST(request("pair", null, { code: apple.issueAppleCode(owner).code }));
  assert.equal(claim.status, 200);
  const { token } = await claim.json();
  for (let iteration = 0; iteration < 2; iteration++) {
    const heart = await syncRoute.POST(request("sync", token, { id, data: fixture.heart }));
    assert.equal(heart.status, 200, "Swift heart payload must satisfy the production route");
    assert.equal((await heart.json()).saved, iteration === 0);
    const records = await recordsRoute.POST(request("records", token, fixture.records));
    assert.equal(records.status, 200, "Swift records must satisfy the production route");
    const result = await records.json();
    assert.equal(iteration === 0 ? result.saved > 0 : result.saved === 0, true);
  }
  assert.equal(readHeart(owner, id).minimum, fixture.heart.minimum);
  assert.equal(readHeart(owner, id).maximum, fixture.heart.maximum);
  const overview = health.healthOverview(owner);
  assert.equal(overview.bodyMass[0].kg, fixture.records.bodyMass[0].value);
  assert.equal(overview.workouts[0].matchedWorkoutId, id);
  assert.equal(overview.activity[0].steps, fixture.records.activity[0].steps);
  assert.deepEqual(health.healthOverview(other), { bodyMass: [], activity: [], workouts: [] });
  if (fixture.report) {
    const report = await syncRoute.POST(request("sync", token, fixture.report));
    assert.equal(report.status, 200, "Swift final report must satisfy the production route");
    assert.deepEqual(health.lastHealthSync(owner).received, fixture.report.received);
  }
  const otherToken = apple.claimAppleCode(apple.issueAppleCode(other).code);
  assert.equal((await syncRoute.POST(request("sync", otherToken, { id, data: fixture.heart }))).status, 404);
  assert.equal((await syncRoute.DELETE(request("sync", token, {}, "DELETE"))).status, 200);
  assert.equal((await recordsRoute.POST(request("records", token, fixture.records))).status, 401);
  console.log("PASS Swift → production API contract: pairing, heart/records encoding, repeats, workout matching, privacy, disconnect. Synthetic data only; no HTTPS transport or HealthKit authorization exercised.");
} finally {
  db?.close();
  delete globalThis.spotterDb;
  await rm(directory, { recursive: true, force: true });
}
