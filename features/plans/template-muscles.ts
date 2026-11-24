import { isWarmupMove } from "@/features/training/sequence";
import { exerciseMuscles, researchedGuide } from "@/features/exercises/guidance";
import { fromCatalogue, searchable, type Catalog } from "@/features/exercises/open-gym";
import { parsePlanMove } from "@/features/exercises/move-name";
import type { ExerciseProfile } from "@/features/library/model";
import type { Plan } from "./model";

const nameKey = (name: string) => searchable(parsePlanMove(name).name);

export function templateMuscleSets(plan: Plan, catalogue?: Catalog, profiles: ExerciseProfile[] = []) {
  const byName = new Map(profiles.map((profile) => [nameKey(profile.name), profile.guide]));
  const primary: Record<string, number> = {};
  const secondary: Record<string, number> = {};
  let unlabelled = 0;
  for (const move of plan.exercises) {
    if (isWarmupMove(move) || /^E(?:-|$)/.test(move.block ?? "")) continue;
    const reference = move.sourceName && researchedGuide(move.sourceName) ? move.sourceName : move.name;
    const muscles = exerciseMuscles(reference, fromCatalogue(catalogue, move), byName.get(nameKey(move.name)));
    const targets = Object.entries(muscles).filter(([muscle, weight]) => weight > 0 && muscle !== "cardiovascular system");
    if (!targets.length && !muscles["cardiovascular system"]) unlabelled++;
    for (const [muscle, weight] of targets) {
      const layer = weight >= 75 ? primary : secondary;
      layer[muscle] = (layer[muscle] ?? 0) + move.sets;
    }
  }
  return { primary, secondary, unlabelled };
}
