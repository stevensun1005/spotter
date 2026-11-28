import { z } from "zod";
import { nutrition, uuid } from "@/features/library/model";
import { planRevisionSchema } from "@/features/plans/schedule";
import { HttpError } from "@/server/http";

type NutritionItem = z.infer<typeof nutrition>;
type ReceiptRow = { id: string; updated: string };
type SavedMeal = ReceiptRow & { payload: string };

const meal = nutrition.refine((item) => item.entry.type === "meal" && !item.sourceWorkoutId);
const receipt = z.object({ id: uuid, updated: planRevisionSchema });
const batchId = { batchId: uuid, expectedOwner: z.string().min(1).max(120) };
export const mealBatchMutation = z.discriminatedUnion("action", [
  z.object({ ...batchId, action: z.literal("save"), rows: z.array(meal).min(1) }),
  z.object({ ...batchId, action: z.literal("undo"), rows: z.array(receipt).min(1) }),
]).refine(({ rows }) => new Set(rows.map(({ id }) => id)).size === rows.length)
  .refine((mutation) => mutation.action !== "save" || mutation.rows.every((row) => row.date === mutation.rows[0]?.date &&
    row.entry.type === "meal" && mutation.rows[0]?.entry.type === "meal" && row.entry.meal === mutation.rows[0].entry.meal));

const conflict = () => new HttpError(409, "部分饮食记录已在其他地方更改，请在饮食日记中查看。");

export async function saveMealBatch(db: D1Database, owner: string, batchId: string, rows: NutritionItem[]) {
  const updated = new Date().toISOString();
  const input = JSON.stringify(rows);
  const insert = db.prepare(
    "WITH incoming AS (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.date') AS day, value FROM json_each(?)) " +
    "INSERT INTO personal_library(owner,kind,id,day,payload,updated) " +
    "SELECT ?, 'nutrition', id, day, json_set(value,'$._mealBatchId',?,'$._mealBatchRevision',?), ? FROM incoming " +
    "WHERE NOT EXISTS (SELECT 1 FROM personal_library AS saved JOIN incoming ON incoming.id=saved.id " +
    "WHERE saved.owner=? AND saved.kind='nutrition') " +
    "ON CONFLICT(owner,kind,id) DO NOTHING"
  ).bind(input, owner, batchId, updated, updated, owner);
  const read = db.prepare(
    "SELECT saved.id, saved.updated, saved.payload FROM personal_library AS saved " +
    "JOIN json_each(?) AS incoming ON json_extract(incoming.value,'$.id')=saved.id " +
    "WHERE saved.owner=? AND saved.kind='nutrition'"
  ).bind(input, owner);
  const [, selected] = await db.batch<SavedMeal>([insert, read]);
  const stored = new Map(selected.results.map((row) => [row.id, row]));
  // A lost response can be retried only while the same complete batch remains unedited.
  return rows.map((row): ReceiptRow => {
    const result = stored.get(row.id);
    if (!result) throw conflict();
    const { _mealBatchId, _mealBatchRevision, ...payload } = JSON.parse(result.payload);
    if (_mealBatchId !== batchId || _mealBatchRevision !== result.updated || JSON.stringify(payload) !== JSON.stringify(row)) {
      throw conflict();
    }
    return { id: result.id, updated: result.updated };
  });
}

export async function undoMealBatch(db: D1Database, owner: string, batchId: string, rows: ReceiptRow[]) {
  const input = JSON.stringify(rows);
  const remove = db.prepare(
    "WITH incoming AS (SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.updated') AS updated FROM json_each(?)) " +
    "DELETE FROM personal_library WHERE owner=? AND kind='nutrition' AND id IN (SELECT id FROM incoming) " +
    "AND NOT EXISTS (SELECT 1 FROM personal_library AS saved JOIN incoming ON incoming.id=saved.id " +
    "WHERE saved.owner=? AND saved.kind='nutrition' AND (saved.updated<>incoming.updated " +
    "OR json_extract(saved.payload,'$._mealBatchId') IS NOT ? " +
    "OR json_extract(saved.payload,'$.entry.type') IS NOT 'meal' " +
    "OR json_extract(saved.payload,'$.sourceWorkoutId') IS NOT NULL))"
  ).bind(input, owner, owner, batchId);
  const read = db.prepare(
    "SELECT saved.id FROM personal_library AS saved JOIN json_each(?) AS incoming ON json_extract(incoming.value,'$.id')=saved.id " +
    "WHERE saved.owner=? AND saved.kind='nutrition' LIMIT 1"
  ).bind(input, owner);
  const [, remaining] = await db.batch([remove, read]);
  if (remaining.results.length) throw conflict();
}
