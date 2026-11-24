import type { Move } from "./model";

export function prescriptionText(move: Move) {
  return [
    move.loadPercent && "1RM 的 " + move.loadPercent.percent + "%（手填参考 " + move.loadPercent.reference + " " + move.loadPercent.unit + "）",
    move.targetRpe !== undefined && "目标 RPE " + move.targetRpe,
  ].filter(Boolean).join(" · ");
}
