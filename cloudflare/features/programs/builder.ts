import { z } from "zod";
import { offsetDate } from "@/shared/dates";
import { planSchema, type Plan } from "@/features/plans/model";
import { programSchema, type Program, type ProgramPhase } from "./model";

export type ProgramProgression = { weightPerWeek: number; repsPerWeek: number; deloadWeeks: number[]; deloadPercent: number };
export type BuildProgramInput = {
  id?: string; title: string; startDate: string; weeks: number; phases?: ProgramPhase[];
  days: { day: number; plan: Plan }[]; progression?: Partial<ProgramProgression>;
};
const progressionSchema = z.object({
  weightPerWeek: z.number().finite().min(-200).max(200).default(0),
  repsPerWeek: z.number().int().min(-100).max(100).default(0),
  deloadWeeks: z.array(z.number().int().min(1).max(52)).max(52).default([]),
  deloadPercent: z.number().finite().min(0).max(100).default(100),
});

function snapshot(plan: Plan, programId: string, sessionId: string, phaseId: string | undefined, date: string, week: number, day: number): Plan {
  const { templateId: _template, ...source } = plan;
  return planSchema.parse({ ...source, date, week, day, shared: false, programId, programSessionId: sessionId, phaseId });
}

export function buildProgram(input: BuildProgramInput): Program {
  const id = input.id ?? crypto.randomUUID();
  const progression = progressionSchema.parse(input.progression ?? {});
  if (!Number.isInteger(input.weeks) || input.weeks < 1 || input.weeks > 52 || !input.days.length || input.days.length > 7 ||
      input.days.some(({ day }) => !Number.isInteger(day) || day < 1 || day > 7) || new Set(input.days.map(({ day }) => day)).size !== input.days.length) {
    throw new Error("请选择 1–52 周和互不重复的周内训练日。");
  }
  const phases = input.phases ?? [];
  const sessions = Array.from({ length: input.weeks }, (_, index) => index + 1).flatMap((week) => {
    const phaseId = phases.find((phase) => week >= phase.fromWeek && week <= phase.toWeek)?.id;
    return [...input.days].sort((a, b) => a.day - b.day).map(({ day, plan: rawPlan }) => {
      const plan = planSchema.parse(rawPlan);
      const sessionId = crypto.randomUUID();
      const date = offsetDate(input.startDate, (week - 1) * 7 + day - 1);
      const factor = progression.deloadWeeks.includes(week) ? progression.deloadPercent / 100 : 1;
      const changed: Plan = { ...plan, exercises: plan.exercises.map((move) => ({
        ...move,
        // Zero is the existing unknown-load value. No progression may invent a load for it.
        weight: move.weight === 0 ? 0 : Math.max(0, Math.round((move.weight + progression.weightPerWeek * (week - 1)) * factor * 100) / 100),
        reps: move.seconds > 0 ? move.reps : Math.max(0, move.reps + progression.repsPerWeek * (week - 1)),
        ...(move.repsMax === undefined || move.seconds > 0 ? {} : { repsMax: Math.max(1, move.repsMax + progression.repsPerWeek * (week - 1)) }),
        ...((progression.weightPerWeek !== 0 && week > 1) || factor !== 1 ? { loadPercent: undefined } : {}),
        ...(move.weight > 0 && (progression.weightPerWeek !== 0 || factor !== 1) ? { fixedLoad: true as const } : {}),
      })) };
      return { id: sessionId, week, day, phaseId, plan: snapshot(changed, id, sessionId, phaseId, date, week, day) };
    });
  });
  return programSchema.parse({ id, title: input.title, startDate: input.startDate, weeks: input.weeks, phases, sessions });
}

export function copyProgramWeek(program: Program, fromWeek: number, toWeeks: number[]): Program {
  const valid = programSchema.parse(program);
  const targets = [...new Set(toWeeks)].filter((week) => week !== fromWeek);
  if (!Number.isInteger(fromWeek) || fromWeek < 1 || fromWeek > valid.weeks || targets.some((week) => !Number.isInteger(week) || week < 1 || week > valid.weeks)) {
    throw new Error("复制周范围无效。");
  }
  const source = valid.sessions.filter(({ week }) => week === fromWeek);
  if (!source.length) throw new Error("这一周没有可复制的训练。");
  const sessions = valid.sessions.filter(({ week }) => !targets.includes(week));
  for (const week of targets) for (const entry of source) {
    const old = valid.sessions.find((item) => item.week === week && item.day === entry.day);
    const id = old?.id ?? crypto.randomUUID();
    const phaseId = valid.phases.find((phase) => week >= phase.fromWeek && week <= phase.toWeek)?.id;
    sessions.push({ id, week, day: entry.day, phaseId,
      plan: snapshot(entry.plan, valid.id, id, phaseId, offsetDate(valid.startDate, (week - 1) * 7 + entry.day - 1), week, entry.day) });
  }
  return programSchema.parse({ ...valid, sessions: sessions.sort((a, b) => a.week - b.week || a.day - b.day) });
}
