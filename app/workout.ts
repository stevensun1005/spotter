import { asDate as dateInZone } from "@/shared/dates";

export { offsetDate } from "@/shared/dates";
export { type Entry, type State } from "@/shared/state";
export { examples, planBlank, planSchema, type Plan } from "@/features/plans/model";
export { sessionSchema, sessionTotals, startSession, type Session } from "@/features/training/model";

export function asDate(value: number | Date = Date.now()) {
  return dateInZone(value, "America/Toronto");
}
