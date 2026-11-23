import type { Session, SetLine } from "@/app/workout";

export type NumberField = "weight" | "reps" | "seconds" | "rightWeight" | "rightReps" | "rpe";
export type SetTarget = { move: number; row: number; field: NumberField };
const limits: Record<NumberField, number> = { weight: 2000, rightWeight: 2000, reps: 999, rightReps: 999, seconds: 18000, rpe: 10 };

export function fieldValue(line: SetLine, field: NumberField) {
  if (field === "rightWeight") return line.right?.weight;
  if (field === "rightReps") return line.right?.reps;
  return line[field];
}

export function decimalField(field: NumberField) {
  return field === "weight" || field === "rightWeight" || field === "rpe";
}

export function changeSet(session: Session, move: number, row: number, edit: (line: SetLine) => SetLine): Session {
  return { ...session, rows: session.rows.map((group, i) => i === move ? group.map((line, j) => j === row ? edit(line) : line) : group) };
}

function setNumber(line: SetLine, field: NumberField, value: number | undefined): SetLine {
  if (field === "rpe") return { ...line, rpe: value };
  const number = value ?? 0;
  if (field === "rightWeight" || field === "rightReps") {
    const side = line.right ?? { weight: line.weight, reps: line.reps };
    return { ...line, right: { ...side, [field === "rightWeight" ? "weight" : "reps"]: number } };
  }
  return { ...line, [field]: number };
}

export function validNumberText(field: NumberField, text: string) {
  return (decimalField(field) ? /^\d{0,5}(?:\.\d{0,2})?$/.test(text) : /^\d{0,5}$/.test(text)) &&
    (text === "." || Number(text) <= limits[field]);
}

export function changeNumber(session: Session, target: SetTarget, text: string) {
  if (!validNumberText(target.field, text) || text === ".") return session;
  const number = Number(text);
  if (target.field === "rpe" && text && (number < 1 || !Number.isInteger(number * 2))) return session;
  return changeSet(session, target.move, target.row, (line) => setNumber(line, target.field, text ? number : undefined));
}

export function copySetNumber(session: Session, target: SetTarget, direction: -1 | 1) {
  const value = fieldValue(session.rows[target.move][target.row], target.field);
  return { ...session, rows: session.rows.map((group, i) => i !== target.move ? group : group.map((line, j) =>
    (j - target.row) * direction > 0 ? setNumber(line, target.field, value) : line)) };
}

export function flipWeightUnit(session: Session, move: number) {
  const exercise = session.plan.exercises[move];
  const unit = exercise.unit === "kg" ? "lb" : "kg";
  const convert = (weight: number) => Math.round((unit === "kg" ? weight * 0.45359237 : weight / 0.45359237) * 100) / 100;
  const group = session.rows[move];
  if (convert(exercise.weight) > limits.weight || group.some((line) => convert(Math.max(line.weight, line.right?.weight ?? 0)) > limits.weight)) return session;
  return {
    ...session,
    plan: { ...session.plan, exercises: session.plan.exercises.map((item, i) => i === move ? { ...item, unit, weight: convert(item.weight) } : item) },
    rows: session.rows.map((rows, i) => i !== move ? rows : rows.map((line) => ({
      ...line, weight: convert(line.weight),
      right: line.right && { ...line.right, weight: convert(line.right.weight) },
    }))),
  } satisfies Session;
}

export function appendSet(session: Session, move: number, row: number) {
  const group = session.rows[move];
  if (group.length >= 30) return session;
  const { weight, reps, seconds, right } = group[row];
  const added = { weight, reps, seconds, right, done: false };
  return {
    ...session,
    plan: { ...session.plan, exercises: session.plan.exercises.map((item, i) => i === move ? { ...item, sets: group.length + 1 } : item) },
    rows: session.rows.map((rows, i) => i === move ? [...rows, added] : rows),
  };
}
