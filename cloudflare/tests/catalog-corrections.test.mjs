import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { canonicalCatalogueId, canonicalMoveName, parsePlanMove } from "../features/exercises/move-name.ts";

const asset = (path) => new URL("../public/open-gym/" + path, import.meta.url);
const read = (path) => JSON.parse(readFileSync(asset(path), "utf8"));
const { rows, variants } = read("index.json");
const catalogue = new Map(rows.map((row) => [row.id, row]));

test("bad alternating barbell entries redirect only as legacy aliases", () => {
  assert.deepEqual(parsePlanMove("B2 杠铃二头交替弯举（每手）· 慢放"), {
    name: "哑铃交替二头弯举", cue: "每手 · 慢放", sourceSlot: "B2",
  });
  assert.equal(canonicalMoveName("Barbell Alternate Biceps Curl"), "哑铃交替二头弯举");
  assert.equal(canonicalMoveName("杠铃弯举"), "杠铃弯举");
  assert.equal(canonicalMoveName("杠铃坐姿交替抬腿"), "杠铃坐姿交替抬腿");

  for (const [from, to, equipment] of [["0023", "0285", "dumbbell"], ["3991", "3721", "barbell"]]) {
    assert.equal(canonicalCatalogueId(from), to);
    assert.equal(variants[from], to);
    assert.ok(!catalogue.has(from));
    assert.ok(!read("details/" + Math.floor(+from / 100) + ".json")[from]);
    assert.equal(catalogue.get(to).equipment, equipment);
  }

  const curl = read("details/2.json")["0285"];
  assert.match(curl.steps.join(" "), /双手各握一个哑铃/);
  assert.match(curl.steps.join(" "), /交替手臂/);
  assert.ok(catalogue.get("0285").animation);
  assert.ok(existsSync(asset("flow/0285.json")));
  assert.ok(!existsSync(asset("flow/0023.json")));
});
