import { parsePlanMove } from "@/features/exercises/move-name";
import { researchedGuide } from "@/features/exercises/guidance";
import type { Move } from "@/features/plans/model";
import type { Session } from "@/features/training/model";
import { isWarmupMove } from "@/features/training/sequence";
import { isPerSideLoad } from "@/features/training/volume";

export function completedMoves(data: Session) {
  return data.plan.exercises.flatMap((move, i) => {
    const sets = (data.rows[i] ?? []).filter((line) => line.done).map(({ weight, reps, seconds, right, kind }) => ({
      weight, reps, seconds, kind, right: right && { weight: right.weight, reps: right.reps },
    }));
    return sets.length ? [{ move, name: parsePlanMove(move.name).name, sets }] : [];
  });
}

export function publicMoveInfo(move: Move) {
  const source = move.sourceName && parsePlanMove(move.sourceName).name;
  return {
    catalogueId: move.catalogueId,
    sourceName: source && researchedGuide(source) ? source : undefined,
    warmup: isWarmupMove(move) ? true as const : undefined,
  };
}

export function publicPartnerSession(data: Session, sharedPlanId = ""): Session {
  const moves = completedMoves(data);
  return {
    date: data.date, minutes: data.minutes, finishedVideo: data.finishedVideo,
    started: Math.max(1, Date.parse(data.date + "T00:00:00Z")), planId: sharedPlanId, note: "",
    plan: {
      title: data.plan.title, category: data.plan.category, date: data.date, minutes: data.minutes, shared: false, video: "",
      exercises: moves.map(({ move, name, sets }) => {
        const { warmup, ...info } = publicMoveInfo(move);
        return {
          name, ...info, unit: move.unit,
          sets: sets.length, weight: sets[0].weight, reps: sets[0].reps, seconds: sets[0].seconds,
          cue: isPerSideLoad(move) ? "每侧重量" : "总重",
          block: warmup ? "W" : undefined,
        };
      }),
    },
    rows: moves.map(({ sets }) => sets.map((set) => ({ ...set, done: true }))),
  };
}
