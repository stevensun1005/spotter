import type { Plan } from "./model";

export function planDisplayTitle(plan: Plan) {
  return plan.week !== undefined && plan.day !== undefined
    ? plan.title.replace(/^W\d{2} D\d\s*·\s*/, "")
    : plan.title;
}

export function planWeekDay(plan: Plan) {
  const week = plan.week === undefined ? "" : "第 " + plan.week + " 周";
  const day = plan.day === undefined ? "" : "第 " + plan.day + " 练";
  return [week, day].filter(Boolean).join(" · ");
}
