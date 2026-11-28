import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !specifier.endsWith(".ts")) {
    return next(new URL(specifier + ".ts", context.parentURL).href, context);
  }
  return next(specifier, context);
} });

const { catalogueSections, collapseCatalogueRows } = await import("../features/exercises/catalog-sections.ts");
const { filterRows } = await import("../features/exercises/catalog-search.ts");
const { label } = await import("../features/exercises/labels.ts");

test("equipment sections group related apparatus and keep a pinned action in one place", () => {
  const rows = [
    { id: "self", equipment: "body weight", name: "俯卧撑" },
    { id: "olympic", equipment: "olympic barbell", name: "奥杆提拉" },
    { id: "pin", equipment: "barbell", name: "杠铃深蹲" },
    { id: "bell", equipment: "dumbbell", name: "哑铃深蹲" },
    { id: "bar", equipment: "barbell", name: "杠铃弯举" },
    { id: "unclassified", equipment: "unknown", name: "其他" },
  ];
  const result = catalogueSections(rows, ["个人动作", "个人置顶"], new Set(["杠铃深蹲", "个人置顶"]));
  assert.deepEqual(result.map(({ id }) => id), ["pinned", "barbell", "dumbbell", "body-weight", "other", "custom"]);
  assert.deepEqual(result[0].rows, [rows[2]]);
  assert.deepEqual(result[0].customNames, ["个人置顶"]);
  assert.deepEqual(result[1].rows, [rows[1], rows[4]]);
  assert.deepEqual(result.at(-1).customNames, ["个人动作"]);
});

test("every built-in exercise has a named equipment section and translated classifications", () => {
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url)));
  const sections = catalogueSections(rows);
  assert.ok(sections.every((section) => section.id !== "other"));
  const all = sections.flatMap((section) => section.rows);
  assert.equal(all.length, rows.length);
  assert.deepEqual(new Set(all.map(({ id }) => id)), new Set(rows.map(({ id }) => id)));
  assert.deepEqual(catalogueSections([]), []);
  const equipmentSection = new Map(sections.flatMap(({ id, rows }) => rows.map((row) => [row.equipment, id])));
  assert.equal(equipmentSection.get("high bar"), "suspension");
  assert.equal(equipmentSection.get("assisted"), "assisted");
  assert.equal(equipmentSection.get("medicine ball"), "training-balls");
  assert.equal(equipmentSection.get("massage ball"), "recovery");
  for (const key of ["part", "equipment", "target", "type"]) {
    const values = new Set(rows.map((row) => row[key]));
    assert.deepEqual([...values].filter((value) => label(value) === value), []);
  }
});

test("a family browses once and exact-name search opens the matching variant", () => {
  const standing = { id: "001", name: "绳索直杠三头下压", en: "cable bar pushdown", equipment: "cable", type: "strength", target: "triceps", part: "upper arms" };
  const kneeling = { ...standing, id: "002", name: "绳索跪姿三头下压 v. 2", en: "cable kneeling pushdown v. 2" };
  const family = { id: "cable-triceps", title: "绳索三头下压", aliases: ["绳索下压"], primary: standing, variants: [standing, kneeling] };
  const families = new Map([[standing.id, family], [kneeling.id, family]]);
  const rows = [kneeling, standing];
  const favorites = new Set();
  const options = { part: "", type: "", equipment: "", terms: [], any: false, gear: [], families };
  const common = filterRows(rows, { ...options, query: "绳索下压" });
  assert.deepEqual(collapseCatalogueRows(common.rows, families, common.score, favorites), [standing]);
  const exact = filterRows(rows, { ...options, query: "绳索跪姿三头下压 v2" });
  assert.deepEqual(collapseCatalogueRows(exact.rows, families, exact.score, favorites), [kneeling]);
  assert.deepEqual(collapseCatalogueRows([kneeling], families, common.score, favorites), [kneeling]);
});

test("my equipment keeps unspecified exercises and yields to an explicit choice", () => {
  const rows = [
    { id: "custom", equipment: "", needs: [] },
    { id: "body", equipment: "body weight", needs: [] },
    { id: "dumbbell", equipment: "dumbbell", needs: [] },
    { id: "cable", equipment: "cable", needs: ["rope"] },
  ];
  const filters = { query: "", part: "", type: "", equipment: "", terms: [], any: false, gear: ["dumbbell"] };
  assert.deepEqual(filterRows(rows, filters).rows, rows.slice(0, 3));
  assert.deepEqual(filterRows(rows, { ...filters, equipment: "rope" }).rows, [rows[3]]);
});
