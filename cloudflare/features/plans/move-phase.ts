import { parsePlanMove } from "@/features/exercises/move-name";
import { isWarmupMove } from "@/features/training/sequence";
import type { Move } from "./model";

export type MovePhase = "warmup" | "work";
export const phaseOf = (move: Move): MovePhase => isWarmupMove(move) ? "warmup" : "work";

export function setMovePhase(move: Move, phase: MovePhase): Move {
  if (phaseOf(move) === phase) return move;
  const parsed = parsePlanMove(move.name);
  const block = phase === "warmup" || move.block?.split("-")[0] === "W" ? undefined : move.block;
  return { ...move, name: parsed.name, cue: move.cue ?? parsed.cue, block,
    sourceSlot: phase === "warmup" ? "W-warmup" : undefined };
}

export function addPlanMove(moves: Move[], move: Move, phase: MovePhase): Move[] {
  const next = setMovePhase(move, phase);
  const firstWorking = phase === "warmup" ? moves.findIndex((item) => phaseOf(item) === "work") : -1;
  return firstWorking < 0 ? [...moves, next] : [...moves.slice(0, firstWorking), next, ...moves.slice(firstWorking)];
}
