import type { Plan } from "@/features/plans/model";
import type { Session } from "@/features/training/model";

export type Person = { id: string; name: string };
export type Checkin = { date: string; count: number };
export type Pair = { invite: string | null; partner: Person | null; partnerCheckins?: Checkin[]; partnerTrainingShared?: boolean };
type EntryBase = { id: string; owner: string; updated: string };
export type PlanEntry = EntryBase & { kind: "plan"; data: Plan };
export type TrainingEntry = EntryBase & { kind: "draft" | "log"; data: Session };
export type CheerEntry = EntryBase & { kind: "cheer"; data: { date: string } };
export type Entry = PlanEntry | TrainingEntry | CheerEntry;
export type State = { me: Person; room: Pair | null; entries: Entry[] };

export function isTraining(entry: Entry): entry is TrainingEntry {
  return entry.kind === "draft" || entry.kind === "log";
}
