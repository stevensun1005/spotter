import { normalizeSearch } from "./catalog-search";
import type { CatalogEntry } from "./open-gym";

const sectionDefinitions = [
  ["pinned", "置顶", "置", []],
  ["barbell", "杠铃", "杠", ["barbell", "olympic barbell", "ez barbell", "trap bar", "landmine"]],
  ["dumbbell", "哑铃", "哑", ["dumbbell"]],
  ["kettlebell", "壶铃", "壶", ["kettlebell"]],
  ["cable", "绳索", "绳", ["cable"]],
  ["leverage", "杠杆器械", "杠机", ["leverage machine"]],
  ["smith", "史密斯机", "史", ["smith machine"]],
  ["machine", "其他固定器械", "器", [
    "assisted", "sled machine", "stationary bike", "elliptical machine", "stepmill machine",
    "upper body ergometer", "skierg machine",
  ]],
  ["band", "弹力带", "带", ["band", "resistance band"]],
  ["body-weight", "自重", "自", ["body weight"]],
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
