import type { CatalogEntry } from "./open-gym";
import { preferredFamilyForQuery, type ExerciseFamily } from "./catalog-families";
import { label, termMuscles, types } from "./labels";

export function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s*\bv\s*(\d+)\b/g, " v$1").trim();
}

export function equipmentOptions(rows: CatalogEntry[]) {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.equipment) counts.set(row.equipment, (counts.get(row.equipment) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}

export function filterRows(rows: CatalogEntry[], {
  query, part, type, equipment, terms, any, gear, families,
}: {
  query: string; part: string; type: string; equipment: string; terms: string[]; any: boolean; gear: string[];
  families?: ReadonlyMap<string, ExerciseFamily>;
}) {
  const phrase = normalizeSearch(query);
  const words = phrase.split(" ").filter(Boolean);
  const benchQuery = phrase.match(/^([^ ]*?)(平板|上斜|下斜)([^ ]*)卧推$/);
  const benchEquipment = benchQuery ? benchQuery[1] + benchQuery[3] : "";
  const preferredFamily = families && preferredFamilyForQuery(phrase);
  const modifiers = phrase.match(/杠铃|哑铃|壶铃|绳索|弹力带|自重|史密斯|器械|上斜|下斜|平板|跪姿|坐姿|站姿|单臂|单腿|负重|助力|后踢/g) ?? [];
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
    const family = families?.get(row.id);
    if (preferredFamily && family?.id !== preferredFamily) return false;
    const commonNames = family ? [family.title, ...(family.aliases ?? [])].map(normalizeSearch) : [];
    const ownText = [name, english, category].join(" ");
    const relatedText = [ownText, ...commonNames].join(" ");
    const familyMatch = modifiers.every((term) => ownText.includes(term)) && words.every((word) => relatedText.includes(word));
    const benchMatch = benchQuery && (!benchEquipment || benchEquipment === label(row.equipment)) &&
      /\bbench press\b/.test(english) && !/\b(?:floor|bridge|side lying|stability ball|exercise ball|form check|catch)\b/.test(english) &&
      benchQuery[2] === (/\bincline(?:d)?\b/.test(english) ? "上斜" : /\bdecline(?:d)?\b/.test(english) ? "下斜" : "平板");
    if (!words.every((word) => ownText.includes(word)) && !familyMatch && !benchMatch) return false;
    score.set(row.id, name === phrase || english === phrase ? 4 : benchMatch || (familyMatch && commonNames.includes(phrase)) ? 3 :
      name.startsWith(phrase) || english.startsWith(phrase) ? 2 : 1);
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
