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
  partArea("back", ["lats", "upper back", "thoracic", "spine", "traps"]),
  partArea("upper legs", ["quads", "hamstrings", "adductors", "abductors", "hip flexors", "glutes"], "腿部"),
  partArea("shoulders", ["front delts", "side delts", "rear delts", "rotator cuff"]),
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
  { id: "custom", title: "自定义", children: [{ id: "custom:unclassified", title: "待分类" }] },
];

export const exerciseAreaOptions = catalogueAreas
  .filter(({ id }) => id && id !== "custom" && !id.startsWith("muscle:"))
  .flatMap(({ id, title, children }) => [{ id, title }, ...(children ?? []).map((child) => ({
    id: child.id, title: title + " · " + child.title,
  }))]);

export function matchesCatalogueArea(row: Pick<CatalogEntry, "part" | "target"> & Partial<Pick<CatalogEntry, "en">>, id: string) {
  if (!id) return true;
  if (id === "custom" || id === "custom:unclassified") return false;
  if (id.startsWith("muscle:")) return row.target === id.slice("muscle:".length);
  const [part, target] = id.split(":");
  if (row.part !== part) return false;
  if (!target || row.target === target) return true;
  if (id === "back:thoracic") return /\bthoracic\b/i.test(row.en ?? "");
  if (id === "shoulders:rotator cuff") return /\b((external|internal) rotation|rotator cuff)\b/i.test(row.en ?? "");
  return false;
}
