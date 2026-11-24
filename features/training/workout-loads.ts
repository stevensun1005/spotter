import type { Move, Plan } from "@/features/plans/model";
import { applyLoadSuggestion, recommendLoads, type LoadHistory } from "./load-progression";
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
