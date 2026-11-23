import { parsePlanMove } from "@/features/exercises/move-name";
import type { Move } from "@/features/plans/model";
import type { SetLine } from "./model";

export const toKg = (weight: number, unit: Move["unit"]) => unit === "lb" ? weight * 0.45359237 : weight;

type Load = Pick<Move, "name" | "cue">;

export function isPerSideLoad(move: Load) {
  const { name, cue: legacyCue } = parsePlanMove(move.name);
  const cue = move.cue ?? legacyCue ?? "";
  if (/总重|合计|总次数|(?:只做|仅做?)[左右]/.test(name + " " + cue)) return false;
  return /每手|单手|每侧(?:重量|配重|负重)/.test(cue) || /单臂|单手|\b(?:single|one)[ -]arm\b/i.test(name);
}

export function setVolumeKg(line: SetLine, move: Load & Pick<Move, "unit">) {
  const load = line.weight * line.reps;
  const total = line.right
    ? load + line.right.weight * line.right.reps
    : load * (load > 0 && isPerSideLoad(move) ? 2 : 1);
  return toKg(total, move.unit);
}
