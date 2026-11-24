import { normalizeSearch } from "./catalog-search";
import type { CatalogEntry } from "./open-gym";
import type { ExerciseFamily } from "./catalog-families";

const sectionDefinitions = [
  ["pinned", "置顶", "置", []],
  ["barbell", "杠铃", "杠", ["barbell", "olympic barbell", "ez barbell", "trap bar", "landmine"]],
  ["dumbbell", "哑铃", "哑", ["dumbbell"]],
  ["kettlebell", "壶铃", "壶", ["kettlebell"]],
  ["cable", "绳索", "绳", ["cable"]],
  ["leverage", "杠杆器械", "杠机", ["leverage machine"]],
  ["smith", "史密斯机", "史", ["smith machine"]],
  ["machine", "其他固定器械", "器", [
    "sled machine", "stationary bike", "treadmill", "elliptical machine", "stepmill machine",
    "upper body ergometer", "skierg machine",
  ]],
  ["band", "弹力带", "带", ["band", "resistance band"]],
  ["body-weight", "自重", "自", ["body weight"]],
  ["assisted", "辅助训练", "辅", ["assisted"]],
  ["suspension", "单杠与悬挂带", "悬", ["high bar", "suspension trainer"]],
  ["loaded", "负重配件", "重", ["weighted", "weight plate", "sandbag"]],
  ["training-balls", "训练球与平衡器材", "球", ["stability ball", "medicine ball", "bosu ball"]],
  ["training-rope", "训练绳", "绳具", ["rope"]],
  ["recovery", "按摩放松器材", "松", ["roller", "massage ball"]],
  ["accessories", "小型训练器材", "辅具", ["wheel roller", "stick", "macebell", "hammer"]],
  ["strongman", "大力士器材", "大力", [
    "atlas stone", "axle bar", "conan wheel", "cross hold weights", "hercules columns", "hinged post",
    "iron block", "log bar", "mas stick", "throw weight", "throwing keg", "timber frame", "tire",
    "viking press frame", "weighted shield", "wheelbarrow",
  ]],
  ["other", "其他器材", "其他", []],
  ["custom", "自定义动作", "自订", []],
] as const;

type SectionId = typeof sectionDefinitions[number][0];
const equipmentSections = new Map<string, SectionId>(
  sectionDefinitions.flatMap(([id, , , equipment]) => equipment.map((key) => [key, id] as const)),
);

export type CatalogueSection = {
  id: SectionId;
  title: string;
  jumpLabel: string;
  rows: CatalogEntry[];
  customNames: string[];
};

export function collapseCatalogueRows(rows: readonly CatalogEntry[], families: ReadonlyMap<string, ExerciseFamily>,
  scores: ReadonlyMap<string, number>, favorites: ReadonlySet<string>, demonstrated?: ReadonlySet<string>): CatalogEntry[] {
  const visible = new Set(rows.map((row) => row.id));
  const seen = new Set<string>();
  const collapsed: CatalogEntry[] = [];
  for (const row of rows) {
    const family = families.get(row.id);
    if (!family) {
      collapsed.push(row);
      continue;
    }
    if (seen.has(family.id)) continue;
    seen.add(family.id);
    const keepMatch = scores.get(row.id) === 4 || favorites.has(normalizeSearch(row.name));
    const hasBetterDemo = demonstrated?.has(row.id) && !demonstrated.has(family.primary.id);
    collapsed.push(!keepMatch && !hasBetterDemo && visible.has(family.primary.id) ? family.primary : row);
  }
  return collapsed;
}

export function catalogueSections(rows: readonly CatalogEntry[], customNames: readonly string[] = [],
  favorites: ReadonlySet<string> = new Set()): CatalogueSection[] {
  const sections = new Map<SectionId, CatalogueSection>(sectionDefinitions.map(([id, title, jumpLabel]) =>
    [id, { id, title, jumpLabel, rows: [], customNames: [] }]));
  const isPinned = (name: string) => favorites.size > 0 && favorites.has(normalizeSearch(name));
  for (const row of rows) {
    const id = isPinned(row.name) ? "pinned" : equipmentSections.get(row.equipment) ?? "other";
    sections.get(id)!.rows.push(row);
  }
  for (const name of customNames) {
    sections.get(isPinned(name) ? "pinned" : "custom")!.customNames.push(name);
  }
  return [...sections.values()].filter((section) => section.rows.length || section.customNames.length);
}
