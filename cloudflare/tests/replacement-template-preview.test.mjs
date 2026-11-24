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

const { defaultCatalogMove, recommendReplacements, replacementEquipment, replacementPlan, sameReplacementStation } =
  await import("../features/exercises/replacements.ts");
const { catalogueTrainingPattern } = await import("../features/exercises/catalog-families.ts");
const { templateMuscleSets } = await import("../features/plans/template-muscles.ts");
const data = JSON.parse(readFileSync(new URL("public/open-gym/index.json", root), "utf8"));
const byId = new Map(data.rows.map((row) => [row.id, row]));
const equipment = ["dumbbell", "bench", "barbell", "rack", "cable"];
const options = { sameStationOnly: true, available: equipment, avoidKneeling: false, avoidJumping: false };
const move = (name, extra = {}) => ({ name, sets: 3, reps: 8, weight: 12, seconds: 0, unit: "kg", ...extra });
const plan = (exercises) => ({ title: "测试模板", date: "2026-11-24", category: "力量训练", minutes: 40, shared: false,
  video: "", defaultRestSeconds: 30, exercises });

test("GoodLife replacement suggestions require a matching pattern and primary muscle with available station equipment", () => {
  const prior = move("杠铃卧推", { catalogueId: "0025", station: "杠铃 · 平板卧推凳" });
  const original = byId.get(prior.catalogueId);
  const suggestions = recommendReplacements(data, prior, options);
  assert.ok(suggestions.length > 0, "the real catalogue has substitutions");
  assert.ok(suggestions.every(({ row, gear, sameStation, muscles }) => row.id !== original.id && sameStation &&
    muscles.length && gear.every((item) => equipment.includes(item)) &&
    catalogueTrainingPattern(row).id === catalogueTrainingPattern(original).id));
  assert.ok(suggestions.every(({ row }) => !/incline|decline|floor/.test(row.en)));
  const disabled = recommendReplacements(data, prior, { ...options, available: ["body weight"] });
  assert.deepEqual(disabled, []);
  const triceps = recommendReplacements(data, move("跪姿绳索三头下压", { catalogueId: "0176", station: "绳索区" }),
    { ...options, avoidKneeling: true });
  assert.ok(triceps.length > 0);
  assert.ok(triceps.every(({ row, muscles }) => row.target === "triceps" && !/\bkneel/.test(row.en) && muscles.includes("肱三头肌")));
  assert.deepEqual(recommendReplacements(data, move("自定义未知动作"), options), []);
});

test("the real flat barbell bench list prioritizes common variants and omits form checks and unconfirmed attachments", () => {
  const prior = move("杠铃卧推", { catalogueId: "0025", station: "杠铃区" });
  const standard = byId.get(prior.catalogueId);
  const reverseBand = byId.get("1497");
  const suggestions = recommendReplacements(data, prior, { ...options, available: [] });
  assert.deepEqual(new Set(suggestions.slice(0, 2).map(({ row }) => row.id)), new Set(["0122", "5013"]));
  const allStations = recommendReplacements(data, prior, { ...options, sameStationOnly: false });
  assert.ok(allStations.every(({ row, gear }) => !/form check|pov/.test(row.en) && row.id !== "3310" && !gear.includes("band")));
  assert.deepEqual(replacementEquipment(reverseBand), ["barbell", "bench", "band", "rack"]);
  assert.ok(replacementEquipment(byId.get("4414")).includes("kettlebell"));
  assert.ok(replacementEquipment(byId.get("4201")).includes("lifting chain"));
  assert.ok(replacementEquipment(byId.get("7621")).includes("safety pins"));
  assert.equal(sameReplacementStation(standard, reverseBand, "杠铃区"), false);
  assert.equal(sameReplacementStation(standard, reverseBand, "杠铃区 · 深蹲架 · 弹力带"), true);
});

test("cable fixtures distinguish reviewed rope and straight-bar options on the same machine", () => {
  const rope = byId.get("0176");
  const straight = byId.get("0201");
  assert.deepEqual(replacementEquipment(rope), ["cable", "rope attachment"]);
  assert.deepEqual(replacementEquipment(straight), ["cable", "straight bar attachment"]);
  assert.equal(sameReplacementStation(rope, straight, "绳索区"), false);
  assert.equal(sameReplacementStation(rope, straight, "绳索区 · 直杆"), true);
  assert.deepEqual(replacementEquipment(byId.get("2406")), ["cable", "curl bar attachment", "arm blaster"]);
});

test("a fixed machine is not interchangeable with a different machine from the same equipment class", () => {
  const machine = data.rows.find((row) => row.machine === "leg-press" && row.equipment === "leverage machine");
  const other = data.rows.find((row) => row.machine === "leg-curl" && row.equipment === "leverage machine");
  assert.deepEqual(replacementEquipment(machine), replacementEquipment(other));
  assert.equal(sameReplacementStation(machine, other, "固定力量器械区"), false);
  assert.equal(sameReplacementStation(machine, machine), true);
});

test("replacements keep circuit metadata and assigned rest, and the preview follows circuit order", () => {
  const original = move("杠铃卧推", { catalogueId: "0025", block: "A", station: "杠铃区", sourceSlot: "A1", sourceName: "旧动作", restSeconds: 45, repsMax: 10, targetRpe: 8 });
  const peer = move("杠铃划船", { block: "A", station: "杠铃区", sourceSlot: "A2", restSeconds: 35 });
  const originalPlan = plan([original, peer]);
  const rep = defaultCatalogMove({ name: "新动作", catalogueId: "0027" }, byId.get("0027"), original);
  assert.deepEqual([rep.block, rep.station, rep.sourceSlot, rep.sets, rep.reps, rep.repsMax, rep.restSeconds, rep.weight],
    ["A", "杠铃区", "A1", 3, 8, 10, 45, 0]);
  assert.equal(rep.sourceName, undefined);
  assert.equal(rep.targetRpe, undefined);
  const preview = replacementPlan({ plan: originalPlan, index: 0, defaultRestOverride: 12 }, rep);
  assert.deepEqual(preview.block.slots, ["A1", "A2"]);
  assert.deepEqual(preview.rest, { kind: "换动作", seconds: 12 });
  const actualPeer = replacementPlan({ plan: originalPlan, index: 1, defaultRestOverride: 12 }, peer);
  assert.deepEqual(actualPeer.rest, { kind: "轮间休息", seconds: 45 });
  assert.equal(replacementPlan({ plan: originalPlan, index: 0 }, { ...rep, sets: 0 }), undefined);
  assert.equal(originalPlan.exercises[0].name, "杠铃卧推");
});

test("template muscle totals use planned sets, personal labels and canonical lookups, excluding warmups and cooldowns", () => {
  const moves = [move("杠铃卧推", { catalogueId: "0025" }), move("杠铃卧推", { catalogueId: "0025", block: "W" }),
    move("另名动作", { catalogueId: "0025", block: "E" }), move("个人动作", { sets: 2 }), move("未标注"), move("快走")];
  const profiles = [{ name: "个人动作", pinned: false, note: "", videos: [],
    guide: { description: "", steps: [], muscles: { biceps: 100, triceps: 40 } } },
    { name: "快走", pinned: false, note: "", videos: [],
      guide: { description: "", steps: [], muscles: { "cardiovascular system": 100 } } }];
  const result = templateMuscleSets(plan(moves), data, profiles);
  assert.equal(result.primary.chest, 3);
  assert.equal(result.primary.biceps, 2);
  assert.equal(result.secondary.triceps, 5);
  assert.equal(result.unlabelled, 1);
  assert.equal(result.primary["cardiovascular system"], undefined);
});
