import type { ExerciseProfile } from "@/features/library/model";
import { normalizeSearch } from "./catalog-search";
import { catalogueCover, exerciseDemo } from "./catalogue-demo";
import { exerciseAreaOptions, matchesCatalogueArea } from "./catalogue-areas";
import { guideClassifications } from "./custom-catalogue-classifications";
import { exerciseMuscles, researchedGuide } from "./guidance";
import { regionMuscle } from "./labels";
import { canonicalMoveName } from "./move-name";
import { fromCatalogue, type Catalog, type CatalogEntry } from "./open-gym";

export const customNameKey = (name: string) => normalizeSearch(canonicalMoveName(name));
const guideKey = (name: string) => customNameKey(name).replace(/\s+/g, "");
const classifications = new Map(Object.entries(guideClassifications).map(([name, info]) => [guideKey(name), info]));
const muscleAreas: Record<string, string> = {
  chest: "chest:pectorals", serratus: "chest:serratus anterior",
  lats: "back:lats", "upper-back": "back:upper back", "lower-back": "back:spine", trapezius: "back:traps",
  "front-delts": "shoulders:front delts", "side-delts": "shoulders:side delts", "rear-delts": "shoulders:rear delts",
  "rotator-cuff": "shoulders:rotator cuff",
  biceps: "upper arms:biceps", triceps: "upper arms:triceps", forearm: "lower arms",
  abs: "waist:abs", obliques: "waist:obliques",
  gluteal: "upper legs:glutes", quadriceps: "upper legs:quads", hamstring: "upper legs:hamstrings",
  adductors: "upper legs:adductors", "hip-flexors": "upper legs:hip flexors",
  calves: "lower legs:calves", tibialis: "lower legs:shins", "cardiovascular system": "cardio",
};

function primaryArea(weights: Record<string, number>) {
  const areas = [...new Set(Object.entries(weights).filter(([, weight]) => weight >= 75)
    .map(([muscle]) => muscleAreas[muscle] ?? muscleAreas[regionMuscle(muscle)]).filter(Boolean))];
  if (areas.length === 1) return areas[0];
  const parts = [...new Set(areas.map((area) => area.split(":")[0]))];
  return parts.length === 1 ? parts[0] : "";
}

export function customCatalogueEntry(name: string, profile: ExerciseProfile | undefined, data: Catalog | undefined) {
  const guide = researchedGuide(name);
  const row = guide?.demoCatalogueId
    ? fromCatalogue(data, { name, catalogueId: guide.demoCatalogueId })
    : fromCatalogue(data, { name });
  const muscles = exerciseMuscles(name, row, profile?.guide);
  const known = classifications.get(guideKey(name));
  const exactArea = row && exerciseAreaOptions.find(({ id }) => id === row.part + ":" + row.target)?.id;
  const rowArea = exactArea ?? row?.part;
  const area = profile?.classification?.area || known?.area || primaryArea(muscles) || rowArea || "";
  const equipment = profile?.classification?.equipment || (known ? known.equipment : row?.equipment) || "";
  const type = profile?.classification?.type || known?.type || row?.type || "";
  const [part, target = ""] = area.split(":");
  return { personal: true as const, id: "custom:" + customNameKey(name), name, en: "", area, part, target,
    muscles, equipment, type, demo: exerciseDemo(name, name, row, true) };
}

export type CustomCatalogueEntry = ReturnType<typeof customCatalogueEntry>;
export const customCover = (item: CustomCatalogueEntry) => catalogueCover(item.demo);

export function matchesCustomArea(item: CustomCatalogueEntry, area: string) {
  if (area === "custom") return true;
  if (area === "custom:unclassified") return !item.area;
  return matchesCatalogueArea(item, area);
}

export const isPersonalExercise = (row: CatalogEntry | CustomCatalogueEntry): row is CustomCatalogueEntry => "personal" in row;
