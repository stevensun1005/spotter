import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", root).href, context);
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { recommendInitialLoad } = await import("../features/training/initial-load.ts");
const { buildLoadHistory } = await import("../features/training/load-progression.ts");
const catalogue = JSON.parse(readFileSync(new URL("public/open-gym/index.json", root), "utf8"));
const move = (catalogueId, extra = {}) => ({ name: catalogue.rows.find(({ id }) => id === catalogueId)?.name ?? "自定义", catalogueId,
  sets: 3, weight: 0, unit: "lb", reps: 10, seconds: 0, ...extra });
const line = (weight = 0, reps = 10, done = false, extra = {}) => ({ weight, reps, seconds: 0, done, ...extra });
const log = (exercise, row, date = "2026-11-01", owner = "me") => ({ owner, kind: "log", updated: date,
  data: { date, started: Date.parse(date), plan: { category: "力量训练", exercises: [exercise] }, rows: [[row]] } });
const suggest = (exercise, entries = [], rows = [line(), line()], step = 2.5, catalog = catalogue) =>
  recommendInitialLoad(exercise, rows, buildLoadHistory(entries, "me"), catalog, step);

test("a close free-weight variant discounts the latest successful comparable set and preserves the logging basis", () => {
  const source = move("0285", { cue: "每手" });
  const target = move("1196", { cue: "每手" });
  const entries = [log(source, line(40, 10, true)), log(source, line(100, 1, true), "2026-11-02"),
    log(source, line(90, 10, true), "2026-11-03", "partner")];
  assert.deepEqual(suggest(target, entries), { kind: "related", row: 0, equipment: "dumbbell", weight: 30,
    basis: "per-hand", source: source.name });

  const harder = log({ ...source, reps: 8 }, line(40, 8, true, { rpe: 9, right: { weight: 37, reps: 8 } }));
  assert.deepEqual(suggest({ ...target, unit: "kg", repsMax: 15 }, [harder], [line()], 0.5),
    { kind: "related", row: 0, equipment: "dumbbell", weight: 9.5, basis: "per-hand", source: source.name });
});

test("a loaded variant with no trustworthy comparison starts with its own equipment", () => {
  const ambiguousPrior = log(move("0285"), line(40, 10, true));
  assert.deepEqual(suggest(move("1196"), [ambiguousPrior]), { kind: "minimum", row: 0, equipment: "dumbbell",
    weight: 5, rightWeight: 5, basis: "per-hand" });
  const otherAngle = log(move("0285", { cue: "每手" }), line(40, 10, true));
  assert.deepEqual(suggest(move("0315", { unit: "kg", cue: "每手" }), [otherAngle]),
    { kind: "minimum", row: 0, equipment: "dumbbell", weight: 2, basis: "per-hand" });
  assert.deepEqual(suggest(move("0599"), [log(move("0586"), line(110, 10, true))]),
    { kind: "minimum", row: 0, equipment: "leverage machine" });
  assert.deepEqual(suggest(move("0025")), { kind: "minimum", row: 0, equipment: "barbell" });
});

test("prior work, prescribed loads, assisted and self-loaded exercises skip first-use suggestions", () => {
  const target = move("1196", { cue: "每手" });
  assert.equal(suggest(target, [log(target, line(90, 1, true))]), undefined);
  const relatedAlias = { ...catalogue, variants: { ...catalogue.variants, 9999: target.catalogueId } };
  assert.equal(suggest(target, [log(move("9999"), line(90, 1, true))], [line()], 2.5, relatedAlias), undefined);
  for (const exercise of [{ ...target, weight: 7 }, { ...target, fixedLoad: true }, { ...target, seconds: 40 }, move("0009"),
    move("0282"), move("9999"), move("1196", { block: "W" })]) assert.equal(suggest(exercise), undefined, exercise.name);
  assert.equal(suggest(target, [], [line(10)]), undefined);
});

test("a failed first attempt points to the next untouched working set", () => {
  const target = move("1196", { cue: "每手" });
  const warmup = line(2, 20, true, { kind: "warmup" });
  assert.equal(suggest(target, [], [warmup, line()])?.row, 1);
  assert.deepEqual(suggest(target, [], [warmup, line(10, 2, true), line()]), { kind: "retry", row: 2, equipment: "dumbbell" });
  assert.equal(suggest(target, [], [line(10, 2, true), line(5)]), undefined);
  assert.equal(suggest(target, [], [line(10, 10, true), line()]), undefined);
});
