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

const { catalogueSections } = await import("../features/exercises/catalog-sections.ts");

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

test("every catalogue row appears once across equipment sections", () => {
  const { rows } = JSON.parse(readFileSync(new URL("../public/open-gym/index.json", import.meta.url)));
  const all = catalogueSections(rows).flatMap((section) => section.rows);
  assert.equal(all.length, rows.length);
  assert.deepEqual(new Set(all.map(({ id }) => id)), new Set(rows.map(({ id }) => id)));
  assert.deepEqual(catalogueSections([]), []);
});
