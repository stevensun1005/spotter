import type { Plan } from "./model";

export function withoutTemplateLink({ templateId: _templateId, week: _week, day: _day, programId: _programId, programSessionId: _programSessionId, phaseId: _phaseId, ...plan }: Plan): Plan {
  return plan;
}

export function resolvePlanTemplate(plan: Plan, template?: Plan): Plan {
  if (!plan.templateId || !template) return plan;
  const { title, date, shared, templateId, week, day, programId, programSessionId, phaseId } = plan;
  return { ...withoutTemplateLink(template), title, date, shared, templateId, week, day,
    ...(programId ? { programId } : {}), ...(programSessionId ? { programSessionId } : {}), ...(phaseId ? { phaseId } : {}) };
}
