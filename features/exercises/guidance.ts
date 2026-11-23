import trainingGuides from "./training-guides.json" with { type: "json" };
import { guides } from "./catalog";
import { parsePlanMove } from "./move-name";
import type { CatalogEntry } from "./open-gym";

export type ExerciseGuide = { description: string; steps: string[]; muscles: Record<string, number> };
type ReferenceGuide = ExerciseGuide & { equipment?: string; source?: string; sourceLabel?: string; demoCatalogueId?: string };

function nameKey(name: string) {
  return parsePlanMove(name).name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

const researched = new Map(Object.entries(trainingGuides).map(([name, guide]) => [nameKey(name), guide as ReferenceGuide]));
export const researchedGuide = (name: string) => researched.get(nameKey(name));

const baseMuscles = {
  "胸肌": "chest", "肩部": "front-delts", "肱二头肌": "biceps", "肱三头肌": "triceps",
  "背部": "upper-back", "核心": "abs", "臀部": "gluteal", "股四头肌": "quadriceps", "腘绳肌": "hamstring", "小腿": "calves",
} as const;

export function exerciseMuscles(name: string, catalogue?: CatalogEntry, personal?: ExerciseGuide): Record<string, number> {
  if (personal && Object.keys(personal.muscles).length) return personal.muscles;
  const reference = researchedGuide(name);
  if (reference) return reference.muscles;
  if (catalogue && Object.keys(catalogue.muscles).length) return catalogue.muscles;
  if (catalogue?.target === "shins") return { tibialis: 100 };
  const original = guides[parsePlanMove(name).name];
  return Object.fromEntries<number>([
    ...(original?.secondary ?? []).map((key) => [baseMuscles[key], 40] as const),
    ...(original?.primary ?? []).map((key) => [baseMuscles[key], 100] as const),
  ]);
}
