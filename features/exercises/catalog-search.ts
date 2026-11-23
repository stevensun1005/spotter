import type { CatalogEntry } from "./open-gym";
import { label, termMuscles, types } from "./labels";

export function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function equipmentOptions(rows: CatalogEntry[]) {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.equipment) counts.set(row.equipment, (counts.get(row.equipment) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}

export function filterRows(rows: CatalogEntry[], {
  query, part, type, equipment, terms, any, gear,
}: {
  query: string; part: string; type: string; equipment: string; terms: string[]; any: boolean; gear: string[];
}) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  const groups = terms.map(termMuscles);
  const score = new Map<string, number>();
  const scoped = rows.filter((row) => {
    if (part && row.part !== part) return false;
    if (gear.length && row.equipment !== "body weight" && !gear.includes(row.equipment)) return false;
    if (groups.length) {
      const contains = (terms: string[]) => terms.some((key) => row.muscles[key] > 0);
      if (!(any ? groups.some(contains) : groups.every(contains))) return false;
    }
    if (!words.length) return true;
    const name = normalizeSearch(row.name);
    const english = normalizeSearch(row.en);
    const category = normalizeSearch(label(row.part) + " " + label(row.equipment) + " " + label(row.target));
    const text = name + " " + english + " " + category;
    if (!words.every((word) => text.includes(word))) return false;
    const phrase = words.join(" ");
    score.set(row.id, name === phrase || english === phrase ? 3 : name.startsWith(phrase) || english.startsWith(phrase) ? 2 : 1);
    return true;
  });
  const found = new Set(scoped.map((row) => row.type));
  const typeOptions = types.filter((value) => found.has(value));
  const activeType = typeOptions.includes(type) ? type : "";
  const typed = activeType ? scoped.filter((row) => row.type === activeType) : scoped;
  const equipmentList = equipmentOptions(typed);
  const activeEquipment = equipmentList.includes(equipment) ? equipment : "";
  const final = activeEquipment ? typed.filter((row) => row.equipment === activeEquipment) : typed;
  return { rows: final, typeOptions, activeType, equipmentList, activeEquipment, score };
}
