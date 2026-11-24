import { z } from "zod";
import { dateSchema, offsetDate } from "@/shared/dates";

const uuid = z.string().uuid();
export const learnerPeriod = z.object({ learner: uuid, from: dateSchema, to: dateSchema })
  .refine(({ from, to }) => to >= from && to <= offsetDate(from, 30));
export type LearnerPeriod = z.infer<typeof learnerPeriod>;

const lessonFields = { action: z.literal("lesson"), requestId: uuid, linkId: uuid, note: z.string().trim().max(240) };
export const lessonMutation = z.discriminatedUnion("change", [
  z.object({ ...lessonFields, change: z.literal("credit"), quantity: z.number().int().min(1).max(1000) }).strict(),
  z.object({ ...lessonFields, change: z.literal("debit"), quantity: z.number().int().min(1).max(1000) }).strict(),
  z.object({ ...lessonFields, change: z.literal("reverse"), lessonId: uuid }).strict(),
]);
export type LessonMutation = z.infer<typeof lessonMutation>;
export type LessonEntry = { id: string; delta: number; note: string; reverses: string | null; createdAt: string; reversed: boolean };
export type LearnerOverview = {
  from: string; to: string; shareDetails: boolean;
  summary: { sessions: number; days: number; minutes: number | null; sets: number | null; volumeKg: number | null };
  balance: number; lessons: LessonEntry[];
};
