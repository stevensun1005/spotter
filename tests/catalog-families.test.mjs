import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const path = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(path)) return nextResolve(path.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { catalogFamilies, tricepsVariantGroup, variantDetails } = await import("../features/exercises/catalog-families.ts");
const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url)));
const byId = new Map(rows.map((row) => [row.id, row]));
const families = catalogFamilies(rows);
const { filterRows } = await import("../features/exercises/catalog-search.ts");

test("cable movements with similar names stay in their correct joint-action families", () => {
  const expected = {
    "cable-triceps": ["0200", "0201", "4893", "0194", "0176", "1859", "0860", "1068"],
    "glute-kickback": ["5120", "7589"],
    "lat-pulldown": ["0198", "4948", "11253"],
    "straight-arm-pulldown": ["0238", "0199"],
  };
  for (const [id, variants] of Object.entries(expected)) {
    const family = families.get(variants[0]);
    assert.equal(family.id, id);
    for (const variant of variants) assert.equal(families.get(variant), family);
  }
  assert.match(variantDetails(byId.get("0176"), families.get("0176")).label, /面向器械/);
  assert.match(variantDetails(byId.get("1859"), families.get("1859")).label, /背向器械/);
  assert.match(variantDetails(byId.get("4893"), families.get("4893")).tip, /半程/);
  const triceps = families.get("0200");
  assert.equal(triceps.primary.id, "0200");
  assert.deepEqual(["0200", "0176", "1068"].map((id) => tricepsVariantGroup(byId.get(id))), ["下压", "过头臂屈伸", "俯身后踢"]);
  const search = (query) => filterRows(rows, { query, part: "", type: "", equipment: "", terms: [], any: false, gear: [], families }).rows;
  for (const query of ["绳索下压", "绳索高位下拉", "跪姿绳索高位下拉"]) {
    const results = search(query);
    assert.ok(results.length);
    assert.ok(results.every((row) => families.get(row.id) === triceps));
  }
  assert.deepEqual(search("绳索后踢v3").map((row) => row.id), ["1068"]);
  assert.ok(search("背阔肌下拉").every((row) => families.get(row.id)?.id === "lat-pulldown"));
  assert.equal(families.has("5066"), false);
});

test("bench press families preserve equipment and bench angle", () => {
  const flat = families.get("0025");
  const incline = families.get("0047");
  const decline = families.get("0033");
  assert.equal(flat.title, "杠铃卧推");
  assert.equal(incline.title, "上斜杠铃卧推");
  assert.equal(decline.title, "杠铃下斜卧推");
  assert.equal(flat, families.get("5013"));
  assert.equal(flat, families.get("0122"));
  assert.equal(incline, families.get("5011"));
  assert.equal(decline, families.get("5010"));
  assert.notEqual(flat, incline);
  assert.notEqual(flat, decline);
  assert.notEqual(flat, families.get("0289"));
  assert.notEqual(incline, families.get("0314"));
  assert.notEqual(flat, families.get("3724"));
  assert.notEqual(families.get("0043"), families.get("0042"));

  const search = (query) => filterRows(rows, { query, part: "", type: "", equipment: "", terms: [], any: false, gear: [], families }).rows;
  assert.ok(search("杠铃平板卧推").includes(flat.primary));
  assert.ok(!search("杠铃平板卧推").includes(incline.primary));
  assert.ok(search("杠铃上斜卧推").includes(incline.primary));
  assert.ok(!search("杠铃上斜卧推").includes(byId.get("0314")));
  for (const id of ["0047", "0314"]) assert.ok(search("上斜卧推").includes(byId.get(id)));
});

test("family entries preserve the exact existing catalogue objects and stable representatives", () => {
  assert.equal(families.get("0025").primary.id, "0025");
  assert.equal(families.get("1241"), families.get("3141"));
  assert.equal(families.get("1241").title, "鸟狗式");
  assert.equal(catalogFamilies(rows), families);

  for (const family of new Set(families.values())) {
    assert.ok(family.variants.length >= 2 && family.variants.includes(family.primary));
    for (const member of family.variants) {
      assert.equal(member.equipment, family.primary.equipment);
      assert.equal(member.machine, family.primary.machine);
      assert.deepEqual((member.needs ?? []).slice().sort(), (family.primary.needs ?? []).slice().sort());
      assert.equal(member, byId.get(member.id));
      assert.equal(families.get(member.id), family);
      const details = variantDetails(member, family);
      assert.ok(details.tip && details.label);
    }
  }
});
