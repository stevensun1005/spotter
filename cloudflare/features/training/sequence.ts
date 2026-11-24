import { parsePlanMove } from "@/features/exercises/move-name";
import type { Plan, Move } from "@/features/plans/model";

export type SetPosition = { move: number; row: number };
export type TrainingBlock = {
  label?: string;
  station?: string;
  moves: number[];
  slots: string[];
  rounds: number;
};

export const defaultRest = (plan: Plan) => plan.defaultRestSeconds ?? 30;

export function isWarmupMove(move: Pick<Move, "name" | "block" | "sourceSlot">) {
  const slot = move.sourceSlot ?? parsePlanMove(move.name).sourceSlot ?? "";
  return move.block?.split("-")[0] === "W" || /^(?:W\d*|[A-Z]-warmup)$/.test(slot);
}

// Contiguous group IDs define circuits. An ungrouped move is always its own block.
export function trainingBlocks(exercises: Move[]): TrainingBlock[] {
  const blocks: TrainingBlock[] = [];
  const counters = new Map<string, number>();
  exercises.forEach((move, index) => {
    const label = move.block;
    const phase = label?.split("-")[0];
    const last = blocks.at(-1);
    const continuing = label && last?.label === label && last.station === move.station;
    const block: TrainingBlock = continuing ? last : { label, station: move.station, moves: [], slots: [], rounds: 0 };
    if (!continuing) blocks.push(block);
    const number = phase ? (counters.get(phase) ?? 0) + 1 : 0;
    if (phase) counters.set(phase, number);
    block.slots.push(phase ? phase + number : String(index + 1));
    block.moves.push(index);
    block.rounds = Math.max(block.rounds, move.sets);
  });
  return blocks;
}

function positions(block: TrainingBlock, moves: Move[]): SetPosition[] {
  return Array.from({ length: block.rounds }, (_, row) =>
    block.moves.filter((move) => row < moves[move].sets).map((move) => ({ move, row }))).flat();
}

export function nextSet(plan: Plan, rows: { done: boolean }[][], completed?: SetPosition) {
  const blocks = trainingBlocks(plan.exercises);
  const pending = (position: SetPosition) => !rows[position.move][position.row].done;
  for (const block of blocks) {
    const order = positions(block, plan.exercises);
    if (completed && block.moves.includes(completed.move)) {
      return order.find(pending) ??
        blocks.slice(blocks.indexOf(block) + 1).flatMap((item) => positions(item, plan.exercises)).find(pending) ??
        blocks.slice(0, blocks.indexOf(block)).flatMap((item) => positions(item, plan.exercises)).find(pending);
    }
    if (!completed) {
      const next = order.find(pending);
      if (next) return next;
    }
  }
}

export function restFor(plan: Plan, from: SetPosition, to: SetPosition): { seconds: number; kind: "换动作" | "轮间休息" | "组间休息" | "换站" } {
  const blocks = trainingBlocks(plan.exercises);
  const block = blocks.find((item) => item.moves.includes(from.move))!;
  const next = blocks.find((item) => item.moves.includes(to.move))!;
  const fallback = defaultRest(plan);
  if (block === next && from.row === to.row && from.move !== to.move) return { seconds: fallback, kind: "换动作" };
  if (block !== next && block.station && next.station && block.station !== next.station) {
    return { seconds: Math.max(60, fallback, plan.exercises[from.move].restSeconds ?? 0), kind: "换站" };
  }
  const seconds = block === next
    ? Math.max(...block.moves.map((move) => plan.exercises[move].restSeconds ?? fallback))
    : (plan.exercises[from.move].restSeconds ?? fallback);
  return { seconds, kind: block === next && block.moves.length > 1 ? "轮间休息" : "组间休息" };
}

export function blockTitle(block: TrainingBlock) {
  if (!block.label) return "独立动作";
  const [phase, station] = block.label.split("-");
  const name = phase === "W" ? "热身" : phase === "E" ? "放松" : phase + " 组";
  return name + (station ? " · 第 " + station + " 站" : "");
}
