import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../tools/plan-exercise-demo-rollout.mjs", import.meta.url));

test("demo inventory keeps exact personal exercise matches and confines unresolved names to the private report", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "spotter-demo-inventory-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "plan.json");
  const output = join(directory, "report.json");
  const customName = "Synthetic private custom demo";
  const move = (name, catalogueId) => ({ name, catalogueId });
  await writeFile(input, JSON.stringify({
    training: [
      { kind: "plan", data: { exercises: [
        move("绳索下拉", "0198"), move("哑铃前蹲"), move("lever chest press"), move("分腿蹲（私有变体）"),
        move("A1 跪姿绳索三头下压"), move("A2 跪姿绳索三头下压（反握）"),
        move(customName), move(customName), move("绳索下拉", "0781"), move("分腿蹲", "999999"),
      ] } },
      { kind: "log", data: { plan: { exercises: [move("other private details")] } } },
    ],
    programs: [{ sessions: [{ plan: { exercises: [move("分腿蹲", "0781")] } }] }],
  }));
  const run = () => spawnSync(process.execPath, [script, "--output", output, "--personal", input], { encoding: "utf8" });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout + result.stderr, "");
  const report = JSON.parse(await readFile(output, "utf8"));
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.equal(report.personal.status, "inventory-supplied");
  assert.equal(report.personal.references, 11);
  assert.equal(report.personal.uniqueCatalogueIds, 4);
  assert.equal(report.personal.unresolved.find(({ name }) => name === "A2 跪姿绳索三头下压（反握）").reason, "unmatched-name");
  assert.equal(report.personal.unresolved.find(({ name }) => name === customName).references, 2);
  assert.equal(report.personal.unresolved.find(({ name }) => name === "分腿蹲（私有变体）").reason, "unmatched-name");
  assert.equal(report.personal.unresolved.find(({ name }) => name === "lever chest press").reason, "ambiguous-name");
  assert.equal(report.personal.unresolved.find(({ catalogueId }) => catalogueId === "0781").reason, "conflicting-id");
  assert.equal(report.personal.unresolved.find(({ catalogueId }) => catalogueId === "999999").reason, "unknown-id");
  assert.deepEqual(report.queue.slice(0, 4).map(({ catalogueId, stage }) => [catalogueId, stage]),
    [["0198", "personal"], ["2966", "personal"], ["0176", "personal"], ["0781", "personal"]]);
  assert.equal(report.queue[4].stage, "official");
  assert.equal(report.queue.at(-1).stage, "catalogue");
  assert.equal(new Set(report.queue.map(({ catalogueId }) => catalogueId)).size, report.catalogue.uniqueCatalogueIds);
  const retry = run();
  assert.equal(retry.status, 1);
  assert.ok(!(retry.stdout + retry.stderr).includes(customName));
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), report);
});
