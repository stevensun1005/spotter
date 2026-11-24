import { moveBlank, type Move, type Plan } from "@/features/plans/model";
import { nextSet, restFor, trainingBlocks } from "@/features/training/sequence";
import { catalogueTrainingPattern, catalogFamilies } from "./catalog-families";
import { exerciseMuscles, researchedGuide } from "./guidance";
import { label, muscleNames } from "./labels";
import { parsePlanMove } from "./move-name";
import { fromCatalogue, searchable, type Catalog, type CatalogEntry, type ExerciseChoice } from "./open-gym";

export type ReplacementContext = { plan: Plan; index: number; defaultRestOverride?: number };
export type ReplacementOptions = {
  sameStationOnly: boolean;
  available: string[];
  avoidKneeling: boolean;
  avoidJumping: boolean;
};

export const commonReplacementGear = [
  ["body weight", "自重"], ["dumbbell", "哑铃"], ["barbell", "杠铃"], ["rack", "深蹲架"],
  ["bench", "训练凳"], ["incline bench", "上斜凳"], ["decline bench", "下斜凳"], ["cable", "绳索"],
  ["band", "弹力带"], ["kettlebell", "壶铃"], ["high bar", "单杠"],
  ["smith machine", "史密斯机"], ["leverage machine", "固定力量器械"], ["sled machine", "雪橇／滑轨"],
] as const;

export const cableReplacementGear = [
  ["rope attachment", "绳把"], ["straight bar attachment", "绳索直杆"], ["v-bar attachment", "V 形把手"],
  ["curl bar attachment", "绳索曲杆"], ["single handle", "单手把手"], ["ankle cuff", "踝带"], ["arm blaster", "手臂支撑板"],
] as const;

export const barbellReplacementGear = [
  ["safety pins", "安全销"], ["lifting chain", "负重链条"], ["press board", "卧推木板"], ["weight plate", "杠铃片"], ["suspended weight", "悬挂负重"],
] as const;

const stationTokens: [RegExp, string][] = [
  [/龙门架|绳索|滑轮|cable/i, "cable"], [/哑铃|dumbbell/i, "dumbbell"], [/普通杠铃|杠铃|barbell/i, "barbell"],
  [/深蹲架|rack/i, "rack"], [/壶铃|kettlebell/i, "kettlebell"], [/训练凳|卧推凳|可调凳|长椅|bench/i, "bench"],
  [/上斜凳|可调凳|incline bench/i, "incline bench"], [/下斜凳|decline bench/i, "decline bench"],
  [/弹力带|阻力带|band/i, "band"], [/单杠|引体架|pull.?up bar/i, "high bar"],
  [/史密斯|smith/i, "smith machine"], [/腿举机|leg press/i, "leverage machine"],
  [/绳把|绳索把手|rope attachment/i, "rope attachment"], [/直杆|straight bar/i, "straight bar attachment"],
  [/v\s*形(?:把手|杆)|v.bar/i, "v-bar attachment"], [/曲杆|curl bar/i, "curl bar attachment"],
  [/单手把手|single handle/i, "single handle"], [/踝带|ankle cuff/i, "ankle cuff"], [/手臂支撑板|arm blaster/i, "arm blaster"],
  [/安全销|safety pins?/i, "safety pins"], [/负重链条|lifting chains?/i, "lifting chain"], [/卧推木板|press board/i, "press board"],
  [/杠铃片|weight plates?/i, "weight plate"], [/悬挂负重|suspended weights?/i, "suspended weight"],
];

const gearToken = (key: string) => key === "resistance band" ? "band" : key === "pull-up bar" ? "high bar" : key;
const cableAttachmentPatterns: [RegExp, string][] = [
  [/\brope\b/, "rope attachment"], [/\bv bar\b/, "v-bar attachment"], [/\b(?:sz|ez|curl) bar\b/, "curl bar attachment"],
  [/\bstraight bar\b/, "straight bar attachment"], [/\b(?:ankle cuff|ankle strap)\b/, "ankle cuff"],
  [/\b(?:d handle|single handle)\b/, "single handle"], [/\barm blaster\b/, "arm blaster"],
];
// These catalogue titles omit the attachment identified by their reviewed steps.
const reviewedCableHandles: Record<string, string> = {
  "0176": "rope attachment", "1859": "straight bar attachment", "0201": "straight bar attachment",
  "0207": "straight bar attachment", "1723": "single handle",
};

export function replacementEquipment(row: CatalogEntry) {
  const equipment = new Set([gearToken(row.equipment), ...(row.needs ?? []).map(gearToken)].filter((key) => key && key !== "body weight"));
  const name = searchable(row.en);
  if (/\b(incline|inclined)\b/.test(name) && /\bbench\b/.test(name)) {
    equipment.delete("bench");
    equipment.add("incline bench");
  } else if (/\b(decline|declined)\b/.test(name) && /\bbench\b/.test(name)) {
    equipment.delete("bench");
    equipment.add("decline bench");
  } else if (/\bbench\b/.test(name)) {
    equipment.add("bench");
  }
  if (/\bpreacher\b/.test(name)) equipment.add("preacher bench");
  if (row.equipment === "barbell" && /\bsquats?\b/.test(name)) equipment.add("rack");
  if (/\b(?:band|bands|banded)\b/.test(name)) equipment.add("band");
  if (/\b(?:chain|chains|chained)\b/.test(name)) equipment.add("lifting chain");
  if (/\b(?:\d+ board|board press)\b/.test(name)) equipment.add("press board");
  if (/\breverse band\b/.test(name)) equipment.add("rack");
  if (/\b(?:pin bench press|pin close grip bench press|safety pins?)\b/.test(name)) {
    equipment.add("rack");
    equipment.add("safety pins");
  }
  if (/\b(?:weighted plate|weight plates?)\b/.test(name)) equipment.add("weight plate");
  if (/\bhanging band technique\b/.test(name)) equipment.add("suspended weight");
  if (/\b(?:suspended|hanging) kettlebells?\b/.test(name)) equipment.add("kettlebell");
  if (row.equipment === "cable") {
    for (const [pattern, key] of cableAttachmentPatterns) if (pattern.test(name)) equipment.add(key);
    if (reviewedCableHandles[row.id]) equipment.add(reviewedCableHandles[row.id]);
  }
  if (catalogueTrainingPattern(row)?.id === "pull-up") equipment.add("high bar");
  return [...equipment];
}

export function replacementGearLabel(key: string) {
  const extra: Record<string, string> = { "preacher bench": "牧师凳", "neutral grip hammer bar": "中立握曲杆",
    "plate-loaded machine": "挂片式器械", "step platform": "踏板", "plyometric box": "跳箱", box: "跳箱", chair: "稳固椅子" };
  return [...commonReplacementGear, ...cableReplacementGear, ...barbellReplacementGear].find(([value]) => value === key)?.[1] ?? extra[key] ?? label(key);
}

export function replacementReference(data: Catalog | undefined, move: Move | undefined) {
  if (!move) return;
  const reference = researchedGuide(move.sourceName ?? move.name);
  return fromCatalogue(data, move) ?? (reference?.demoCatalogueId ? fromCatalogue(data, { name: move.name, catalogueId: reference.demoCatalogueId }) : undefined);
}

export function sameReplacementStation(previous: CatalogEntry | undefined, next: CatalogEntry, station?: string) {
  const portable = new Set([...(previous ? replacementEquipment(previous) : []),
    ...stationTokens.filter(([pattern]) => pattern.test(station ?? "")).map(([, gear]) => gear)]);
  if (portable.has("incline bench") || portable.has("decline bench")) portable.add("bench");
  if (next.machine && next.machine !== "none" && (next.machine === "other" || next.machine !== previous?.machine)) return false;
  return Boolean(previous || portable.size) && replacementEquipment(next).every((key) => portable.has(key));
}

function originalPrimary(row: CatalogEntry) {
  return Object.keys(row.muscles).filter((muscle) => row.muscles[muscle] >= 75);
}

const techniqueOnly = /\b(?:form checks?|technique checks?|pov|(?:side|back|front|rear|left|right) view)\b/;
const advancedBench = /\b(?:guillotine|bench press catch)\b/;
const specialistMovement = /\b(?:reverse grip bench press|feet flat bench press|knees at 90 degrees|pin bench press|partial|overload|suspended|hanging band|board press|\d+ board)\b/;
const unchangedBenchNames = new Set(["barbell bench press", "barbell weighted bench press"]);
const benchModifiers = [ /\b(?:pause|paused)\b/, /\bwide\b/, /\breverse grip\b/, /\b(?:close|narrow) grip\b/ ];
const unilateral = /\b(?:one arm|single arm|one leg|single leg|unilateral)\b/;

export function recommendReplacements(data: Catalog, prior: Move, options: ReplacementOptions, names: readonly string[] = []) {
  const previous = replacementReference(data, prior);
  if (!previous) return [];
  const pattern = catalogueTrainingPattern(previous);
  if (!pattern) return [];
  const original = Object.entries(exerciseMuscles(prior.sourceName ?? prior.name, previous))
    .filter(([, weight]) => weight >= 75).map(([muscle]) => muscle);
  if (!original.length) return [];
  const used = new Set(names.map((name) => searchable(parsePlanMove(name).name)));
  const families = catalogFamilies(data.rows);
  const available = new Set(options.available.map(gearToken));
  const standardBench = unchangedBenchNames.has(searchable(previous.en));
  if (available.has("incline bench") || available.has("decline bench")) available.add("bench");
  const results = data.rows.flatMap((row) => {
    const name = searchable(row.name);
    if (row.id === previous.id || used.has(name) || catalogueTrainingPattern(row)?.id !== pattern.id) return [];
    const english = searchable(row.en);
    if (techniqueOnly.test(english) || /动作检查/.test(name) || (standardBench && unchangedBenchNames.has(english))) return [];
    // GoodLife at this location has no wall for ball throws. Exclude throwing and slamming drills from suggestions.
    if ((row.equipment === "medicine ball" && /\b(?:slam\w*|throw\w*|toss\w*|shot put|chest pass)\b/.test(english)) ||
      (options.avoidKneeling && /\bkneel\w*\b/.test(english)) || (options.avoidJumping && /\b(?:jump\w*|hop\w*|bound\w*)\b/.test(english))) return [];
    const gear = replacementEquipment(row);
    if (available.size && !gear.every((key) => available.has(key))) return [];
    const muscles = originalPrimary(row).filter((muscle) => original.includes(muscle));
    if (!muscles.length) return [];
    const sameStation = sameReplacementStation(previous, row, prior.station);
    if (options.sameStationOnly && !sameStation) return [];
    const family = families.get(row.id);
    const advanced = advancedBench.test(english);
    const specialist = advanced || specialistMovement.test(english);
    const modifiers = pattern.id.includes("bench-press:") ? benchModifiers.map((modifier) => Number(modifier.test(english))).join("") : "";
    const key = family ? [family.id, [...gear].sort().join(","), modifiers, Number(unilateral.test(english))].join(":") : name;
    const score = 16 * Number(sameStation) + 8 * Number(row.equipment === previous.equipment) +
      4 * Number(row.target === previous.target) + 2 * muscles.length + Number(family?.primary.id === row.id) -
      (advanced ? 28 : specialist ? 12 : 0);
    return [{ row, key, score, sameStation, specialist, gear, pattern: pattern.title,
      muscles: muscles.map((muscle) => muscleNames[muscle] ?? muscle) }];
  }).sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id, "en", { numeric: true }));
  const seen = new Set<string>();
  return results.filter(({ key }) => seen.has(key) ? false : (seen.add(key), true)).slice(0, 5);
}

export function defaultCatalogMove(choice: ExerciseChoice, item?: CatalogEntry, prior?: Move): Move {
  const timed = item ? Boolean(item.hold || item.type === "isometric" || item.type === "cardio") : Boolean(prior?.seconds);
  const reps = timed ? 0 : item?.distance ? 1 : prior?.reps || 10;
  return {
    ...moveBlank(), ...(prior ? { sets: prior.sets, restSeconds: prior.restSeconds, unit: prior.unit,
      block: prior.block, station: prior.station, sourceSlot: prior.sourceSlot,
      repsMax: !timed && !item?.distance && prior.repsMax && prior.repsMax >= reps ? prior.repsMax : undefined } : {}),
    ...choice, reps, seconds: timed ? prior?.seconds || 30 : 0,
  };
}

export function replacementPlan(context: ReplacementContext, move: Move) {
  const { plan, index, defaultRestOverride } = context;
  if (!Number.isInteger(move.sets) || move.sets < 1 || move.sets > 30) return;
  const exercises = plan.exercises.map((item, at) => at === index ? move : item);
  const updated = { ...plan, exercises, defaultRestSeconds: defaultRestOverride ?? plan.defaultRestSeconds };
  const blocks = trainingBlocks(exercises);
  const block = blocks.find((entry) => entry.moves.includes(index));
  if (!block) return;
  const rows = exercises.map((item) => Array.from({ length: item.sets }, () => ({ done: false })));
  const from = { move: index, row: 0 };
  for (const earlier of blocks) {
    if (earlier === block) {
      for (const completed of earlier.moves.slice(0, earlier.moves.indexOf(index) + 1)) rows[completed][0].done = true;
      break;
    }
    for (const completed of earlier.moves) rows[completed].forEach((line) => { line.done = true; });
  }
  const next = nextSet(updated, rows, from);
  return { plan: updated, block, rest: next && restFor(updated, from, next) };
}
