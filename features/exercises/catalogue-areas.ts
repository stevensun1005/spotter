import { label } from "./labels";
import type { CatalogEntry } from "./open-gym";

type Area = { id: string; title: string };
type CatalogueArea = Area & { children?: readonly Area[] };

function partArea(id: string, targets: string[] = [], title = label(id)): CatalogueArea {
  const area = { id, title };
  if (!targets.length) return area;
  return { ...area, children: targets.map((target) => ({ id: id + ":" + target, title: label(target) })) };
}

const targetArea = (target: string): CatalogueArea => ({ id: "muscle:" + target, title: label(target) });

export const catalogueAreas: readonly CatalogueArea[] = [
  { id: "", title: "全部" },
  partArea("chest", ["pectorals", "serratus anterior"]),
  partArea("back", ["lats", "upper back", "spine", "traps"]),
  partArea("upper legs", ["quads", "hamstrings", "adductors", "abductors", "hip flexors", "glutes"], "腿部"),
  partArea("shoulders", ["front delts", "side delts", "rear delts"]),
  targetArea("serratus anterior"),
  targetArea("traps"),
  partArea("upper arms", ["biceps", "triceps"]),
  partArea("lower legs", ["calves", "shins"]),
  partArea("feet", [], "脚部"),
  partArea("lower arms"),
  partArea("neck"),
  targetArea("glutes"),
  partArea("waist", ["abs", "obliques", "spine"]),
  partArea("full body"),
  partArea("cardio"),
  { id: "custom", title: "自定义" },
];

export function matchesCatalogueArea(row: Pick<CatalogEntry, "part" | "target">, id: string) {
  if (!id) return true;
  if (id === "custom") return false;
  if (id.startsWith("muscle:")) return row.target === id.slice("muscle:".length);
  const [part, target] = id.split(":");
  return row.part === part && (!target || row.target === target);
}
