import type { AnatomyVariant } from "@/features/body/profile";
import { catalogAsset } from "./open-gym";

type AnatomyView = { viewBox: string; regions: Record<string, string[]> };
export type AnatomyGeometry = Record<`${AnatomyVariant}-${"front" | "back"}`, AnatomyView>;

let geometry: Promise<AnatomyGeometry> | undefined;

export function loadAnatomyGeometry() {
  return geometry ??= catalogAsset<AnatomyGeometry>("anatomy.json").catch((error) => {
    geometry = undefined;
    throw error;
  });
}
