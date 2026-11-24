import { z } from "zod";
import { dateSchema, offsetDate } from "@/shared/dates";
import { planSchema } from "@/features/plans/model";

const uuid = z.string().uuid();
export const phaseColors = ["mint", "lime", "lilac", "amber"] as const;
export const programPhaseSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(80),
  fromWeek: z.number().int().min(1).max(52),
  toWeek: z.number().int().min(1).max(52),
  color: z.enum(phaseColors),
}).strict();
export const programSessionSchema = z.object({
  id: uuid, week: z.number().int().min(1).max(52), day: z.number().int().min(1).max(7),
  phaseId: uuid.optional(), plan: planSchema,
}).strict();
export const programSchema = z.object({
  id: uuid, title: z.string().trim().min(1).max(100), startDate: dateSchema,
  weeks: z.number().int().min(1).max(52),
  phases: z.array(programPhaseSchema).max(52),
  sessions: z.array(programSessionSchema).min(1).max(364),
}).strict().superRefine((program, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (new Set(program.phases.map(({ id }) => id)).size !== program.phases.length ||
      new Set(program.sessions.map(({ id }) => id)).size !== program.sessions.length ||
      new Set(program.sessions.map(({ week, day }) => week + ":" + day)).size !== program.sessions.length) issue("周期中的阶段、训练编号或周内位置不能重复。");
  const occupied = new Set<number>();
  for (const phase of program.phases) {
    if (phase.fromWeek > phase.toWeek || phase.toWeek > program.weeks) issue("阶段周范围无效。");
    for (let week = phase.fromWeek; week <= phase.toWeek; week++) {
      if (occupied.has(week)) issue("阶段不能重叠。");
      occupied.add(week);
    }
  }
  for (const session of program.sessions) {
    if (session.week > program.weeks || session.plan.shared || session.plan.templateId ||
        session.plan.date !== offsetDate(program.startDate, (session.week - 1) * 7 + session.day - 1)) issue("训练日期、周次或私人快照无效。");
    if ((session.plan.programId && session.plan.programId !== program.id) ||
        (session.plan.programSessionId && session.plan.programSessionId !== session.id) ||
        (session.plan.phaseId && session.plan.phaseId !== session.phaseId)) issue("训练的周期关联不一致。");
    if (session.phaseId) {
      const phase = program.phases.find(({ id }) => id === session.phaseId);
      if (!phase || session.week < phase.fromWeek || session.week > phase.toWeek) issue("训练不属于所选阶段。");
    }
  }
  if (JSON.stringify(program).length > 1_200_000) issue("周期内容过多，请缩短周期或分开保存。");
});
export type Program = z.infer<typeof programSchema>;
export type ProgramSession = z.infer<typeof programSessionSchema>;
export type ProgramPhase = z.infer<typeof programPhaseSchema>;
export type ProgramRecord = Program & { revision: string; updatedAt: string; scheduledAt: string | null };

export const coachingRulesSchema = z.object({
  principles: z.string().trim().max(4000),
  progression: z.string().trim().max(2000),
  equipment: z.string().trim().max(1000),
  avoid: z.array(z.string().trim().min(1).max(100)).max(50),
}).strict();
export type CoachingRules = z.infer<typeof coachingRulesSchema>;
export const emptyCoachingRules: CoachingRules = { principles: "", progression: "", equipment: "", avoid: [] };
export type CoachingRulesRecord = { rules: CoachingRules; revision: string | null };

export const programStatuses = ["new", "update", "unchanged", "custom", "protected", "blocked", "deleted"] as const;
export type ProgramStatus = typeof programStatuses[number];
export type ProgramPreviewItem = {
  id: string; title: string; date: string; week: number; day: number;
  status: ProgramStatus; reason: string;
};
export type ProgramPreview = {
  programId: string; revision: string; token: string;
  items: ProgramPreviewItem[]; counts: Record<ProgramStatus, number>;
};
export type ProgramCommitResult = { added: number; updated: number; skipped: number; from: string; to: string; replayed?: boolean };

export const programMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), program: programSchema, revision: uuid.nullable() }).strict(),
  z.object({ action: z.literal("preview"), id: uuid, revision: uuid }).strict(),
  z.object({ action: z.literal("commit"), id: uuid, revision: uuid, previewToken: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("rules"), rules: coachingRulesSchema, revision: uuid.nullable() }).strict(),
  z.object({ action: z.literal("remove"), id: uuid, revision: uuid }).strict(),
]);
