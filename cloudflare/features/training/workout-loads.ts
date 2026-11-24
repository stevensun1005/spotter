import type { Move, Plan } from "@/features/plans/model";
import type { Catalog } from "@/features/exercises/open-gym";
import { applyLoadSuggestion, recommendLoads, type LoadHistory } from "./load-progression";
import { recommendInitialLoad, type InitialLoadSuggestion } from "./initial-load";
import type { Session, SetLine } from "./model";

export function adaptsWorkoutLoads(plan: Plan) {
  return plan.category === "力量训练" && !/减量|减载|deload/i.test(plan.title);
}

export function seedMoveLoads(move: Move, rows: SetLine[], history: LoadHistory) {
  const suggestions = recommendLoads(move, rows, history);
  return rows.map((row, index) => {
    const suggestion = suggestions[index];
    return suggestion?.reason === "history" ? applyLoadSuggestion(row, suggestion) : row;
  });
}

export function seedSessionLoads(session: Session, history: LoadHistory): Session {
  if (!adaptsWorkoutLoads(session.plan)) return session;
  return {
    ...session,
    rows: session.rows.map((rows, index) => seedMoveLoads(session.plan.exercises[index], rows, history)),
  };
}

export function workoutLoadAdvice(move: Move, rows: SetLine[], history: LoadHistory, catalogue: Catalog | undefined, weightStep: number) {
  const suggestions = recommendLoads(move, rows, history, weightStep);
  const trial = suggestions.some(Boolean) ? undefined : recommendInitialLoad(move, rows, history, catalogue, weightStep);
  return { suggestions, trial };
}

export function initialLoadDetail(trial: InitialLoadSuggestion) {
  if (trial.kind === "retry") return "上一组没到目标次数，先换更轻的重量再试。";
  const basis = trial.basis === "per-hand" && trial.rightWeight === undefined ? "每手重量。" : "";
  if (trial.source) return basis + "参考你练过的「" + trial.source + "」，先试一组，留几次余力。";
  if (trial.weight !== undefined) return basis + "先用轻哑铃试一组，可按现场重量调整。";
  if (["barbell", "ez barbell", "olympic barbell"].includes(trial.equipment)) return "先用能控制的轻训练杆或空杆，按实际杆重记录。";
  return "先用器械的最低可用重量试一组，按实际重量记录。";
}
