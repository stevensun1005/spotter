import type { Plan } from "./model";

export function withoutTemplateLink({ templateId: _templateId, week: _week, day: _day, ...plan }: Plan): Plan {
  return plan;
}

export function resolvePlanTemplate(plan: Plan, template?: Plan): Plan {
  if (!plan.templateId || !template) return plan;
  const { title, date, shared, templateId, week, day } = plan;
  return { ...template, title, date, shared, templateId, week, day };
}
