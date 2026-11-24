import { hasCompletedWorkout, type Session } from "@/features/training/model";
import { HttpError } from "@/server/http";
import { syncWorkoutProteinMeal } from "@/features/training/protein-nutrition";

export async function updateLog(db: D1Database, owner: string, id: string, revision: string, next: Session, now: string) {
  const existing = await db.prepare("SELECT payload, updated FROM entries WHERE owner = ? AND id = ? AND kind = 'log'")
    .bind(owner, id).first<{ payload: string; updated: string }>();
  if (!existing || existing.updated !== revision) throw new HttpError(409, "记录已在别处更新，请关闭后重新打开。");
  const prior = JSON.parse(existing.payload) as Session;
  if (Boolean(next.cardio) !== Boolean(prior.cardio)) throw new HttpError(400, "无法更改训练记录类型。");
  if (next.rows.length !== prior.plan.exercises.length) throw new HttpError(400, "请从训练详情编辑相应动作的组数。");
  const exercises = prior.plan.exercises.map((item, i) => {
    const name = next.plan.exercises[i].name;
    const move = { ...item, sets: next.rows[i].length };
    return name === item.name ? move : { ...move, name, catalogueId: undefined, sourceName: undefined, cue: undefined };
  });
  const proteinShake = next.proteinShake ?? prior.proteinShake;
  const proteinProduct = proteinShake ? next.proteinProduct ?? prior.proteinProduct : undefined;
  const data: Session = { ...prior, date: next.date, minutes: next.minutes, note: next.note, rows: next.rows,
    ...(next.cardio && { cardio: next.cardio }),
    proteinShake, plan: { ...prior.plan, title: next.plan.title, exercises } };
  if (proteinProduct) data.proteinProduct = proteinProduct;
  else delete data.proteinProduct;
  if (!hasCompletedWorkout(data)) throw new HttpError(400, data.cardio ? "请记录有氧训练时长。" : "请至少保留一组完成记录。");
  const write = db.prepare("UPDATE entries SET payload = ?, updated = ? WHERE owner = ? AND id = ? AND kind = 'log' AND updated = ?")
    .bind(JSON.stringify(data), now, owner, id, revision);
  const servingChanged = JSON.stringify(prior.proteinProduct) !== JSON.stringify(proteinProduct) ||
    Boolean(proteinProduct && prior.date !== data.date);
  const saved = servingChanged ? (await db.batch([write, syncWorkoutProteinMeal(db, owner, id, data, now)]))[0]
    : await write.run();
  if (!saved.meta.changes) throw new HttpError(409, "记录已在别处更新，请关闭后重新打开。");
  return { data, updated: now };
}
