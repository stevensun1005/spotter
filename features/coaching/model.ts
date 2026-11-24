import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import type { Program, ProgramCommitResult, ProgramPreview } from "@/features/programs/model";
import type { Move } from "@/features/plans/model";
import type { SetLine } from "@/features/training/model";

const uuid = z.string().uuid();
const code = z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/);
const assignmentId = { assignmentId: uuid };
export const coachingMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite") }).strict(),
  z.object({ action: z.literal("revokeInvite") }).strict(),
  z.object({ action: z.literal("inspectInvite"), code }).strict(),
  z.object({ action: z.literal("join"), code, confirmed: z.literal(true), shareDetails: z.boolean() }).strict(),
  z.object({ action: z.literal("sharing"), linkId: uuid, shareDetails: z.boolean() }).strict(),
  z.object({ action: z.literal("disconnect"), linkId: uuid }).strict(),
  z.object({ action: z.literal("send"), linkId: uuid, requestId: uuid,
    source: z.object({ kind: z.enum(["plan", "template", "program"]), id: uuid, expectedHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    startDate: dateSchema, note: z.string().trim().max(1500).default("") }).strict(),
  z.object({ action: z.literal("preview"), ...assignmentId }).strict(),
  z.object({ action: z.literal("accept"), ...assignmentId, revision: uuid,
    previewToken: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("decline"), ...assignmentId }).strict(),
  z.object({ action: z.literal("cancel"), ...assignmentId }).strict(),
  z.object({ action: z.literal("feedback"), ...assignmentId, note: z.string().trim().max(1500) }).strict(),
]);
export type CoachingMutation = z.infer<typeof coachingMutation>;
export type CoachingActor = { id: string; name: string };
export type CoachingRole = "coach" | "student";
export type CoachingLink = {
  id: string; coachId: string; coachName: string; studentId: string; studentName: string;
  shareDetails: boolean; createdAt: string; endedAt: string | null;
};
export type CoachingProgress = { total: number; completed: number; inProgress: number };
export type CoachingAssignment = {
  id: string; linkId: string; viewerRole: CoachingRole; title: string; note: string;
  coachName: string; studentName: string; kind: "plan" | "program"; startDate: string;
  weeks: number; sessionCount: number; status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string; acceptedAt: string | null; programId: string; progress: CoachingProgress | null;
};
export type CoachingSource = {
  id: string; kind: "plan" | "template" | "program"; title: string; startDate: string; weeks: number; sessionCount: number; expectedHash?: string;
};
export type CoachingSourceDetail = { source: CoachingSource & { expectedHash: string }; program: Program };
export type CoachingHome = { viewerId: string; links: CoachingLink[]; assignments: CoachingAssignment[]; sources: CoachingSource[] };
export type CoachingActual = {
  minutes: number; exercises: { name: string; unit: Move["unit"]; sets: Pick<SetLine, "weight" | "reps" | "seconds" | "right" | "kind" | "rpe">[] }[];
};
export type CoachingSession = {
  id: string; title: string; date: string; status: "pending" | "inProgress" | "completed" | "removed";
  actual: CoachingActual | null;
};
export type CoachingAssignmentDetail = {
  assignment: CoachingAssignment; program: Program; sessions: CoachingSession[];
  feedback: { note: string; updatedAt: string } | null; detailsShared: boolean; relationshipActive: boolean; result: ProgramCommitResult | null;
};
export type CoachingAcceptPreview = { assignment: CoachingAssignment; preview: ProgramPreview };
export type CoachingAcceptResult = { assignment: CoachingAssignment; result: ProgramCommitResult };
