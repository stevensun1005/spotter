import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const file = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(file)) return next(file.href, context);
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

test("native App device identity follows the paired token and cannot select another account", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "spotter-device-identity-"));
  process.env.SPOTTER_DB_PATH = join(directory, "synthetic.sqlite");
  const { database } = await import("../server/db.ts");
  const { issueAppleCode, claimAppleCode, disconnectApple } = await import("../features/heart/apple/server.ts");
  const { GET } = await import("../app/api/health/apple/device/route.ts");
  const db = database();
  t.after(async () => { db.close(); delete globalThis.spotterDb; await rm(directory, { recursive: true, force: true }); });
  const owners = [randomUUID(), randomUUID()];
  for (const id of owners) db.prepare("INSERT INTO accounts (id, username, name, password_hash) VALUES (?, ?, ?, ?)").run(id, id, "synthetic", "unused");
  const tokens = owners.map((owner) => claimAppleCode(issueAppleCode(owner).code));
  const request = (token, query = "") => new Request("https://synthetic.invalid/api/health/apple/device" + query, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  assert.equal((await GET(request(null))).status, 401);
  assert.equal((await GET(request("0".repeat(64)))).status, 401);
  for (let i = 0; i < owners.length; i++) {
    const response = await GET(request(tokens[i], "?owner=" + owners[1 - i]));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { owner: owners[i] });
  }
  const replacement = claimAppleCode(issueAppleCode(owners[0]).code);
  assert.equal((await GET(request(tokens[0]))).status, 401);
  assert.deepEqual(await (await GET(request(replacement))).json(), { owner: owners[0] });
  disconnectApple(owners[0]);
  assert.equal((await GET(request(replacement))).status, 401);
  assert.deepEqual(await (await GET(request(tokens[1]))).json(), { owner: owners[1] });
});
