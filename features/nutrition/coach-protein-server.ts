import { env } from "cloudflare:workers";
import { libraryItem, type MealEntry } from "@/features/library/model";
import { nextRevision } from "@/features/plans/schedule";
import { maxProteinProducts, proteinPreference, proteinWarehouse } from "@/features/training/protein";
import { proteinMeal } from "@/features/training/protein-nutrition";
import { HttpError } from "@/server/http";
import { estimatedCoachMeal } from "./coach-meal-save";
import type { CoachProteinReceipt, CoachProteinRequest } from "./coach-protein-save";

const warehouseId = "protein-warehouse";
const preferenceId = "protein-preference";
const nameKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const mealName = (name: string) => nameKey(name.replace(/\s*[（(]估算[）)]$/u, ""));
const changed = () => new HttpError(409, "仓库或饮食记录已在另一处变更，请刷新后核对。");
type Stored = { id: string; kind: string; payload: string; updated: string };
type Proposed = { id: string; kind: string; day: string | null; payload: string; previous: Stored | null };

function preparedMeal({ product }: CoachProteinRequest, { id, date, meal, draft, servings }: CoachProteinRequest["records"][number]) {
  let entry: MealEntry | undefined;
  try {
    if (draft) entry = estimatedCoachMeal(meal, draft);
  } catch {
    throw new HttpError(400, "请核对这杯的份量和营养数值。");
  }
  if (!entry) {
    const recipe = proteinMeal(product, date, id)?.entry;
    if (!recipe || recipe.type !== "meal") throw new HttpError(400, "记录这杯前，请提供包装营养或确认一份估算。");
    const total = (amount: number) => Math.round(amount * (servings ?? 1) * 100) / 100;
    entry = { type: "meal", meal, name: recipe.name, grams: total(recipe.grams ?? 0),
      calories: total(recipe.calories), protein: total(recipe.protein), carbs: total(recipe.carbs), fat: total(recipe.fat) };
  }
  const parsed = libraryItem.safeParse({ kind: "nutrition", id, date, entry });
  if (!parsed.success) throw new HttpError(400, "请核对这杯的份量和营养数值。");
  return JSON.stringify(parsed.data);
}

function matchingMeal(left: string, right: string) {
  const proposed = libraryItem.safeParse(JSON.parse(left));
  const saved = libraryItem.safeParse(JSON.parse(right));
  if (!proposed.success || proposed.data.kind !== "nutrition" || proposed.data.entry.type !== "meal" ||
      !saved.success || saved.data.kind !== "nutrition" || saved.data.entry.type !== "meal") return false;
  const a = proposed.data.entry;
  const b = saved.data.entry;
  return mealName(a.name) === mealName(b.name) &&
    a.grams === b.grams && a.calories === b.calories && a.protein === b.protein && a.carbs === b.carbs && a.fat === b.fat;
}

export async function commitCoachProtein(owner: string, request: CoachProteinRequest): Promise<CoachProteinReceipt> {
  if (request.expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请重新打开对话再保存。");
  const db = env.DB;
  if (!db) throw new HttpError(503, "云端数据库暂不可用。");
  const { addToWarehouse, product, records, reuseMatchingMeal } = request;
  const { results } = await db.prepare(
    "SELECT id,kind,payload,updated FROM personal_library WHERE owner=? AND " +
    "((? AND kind = id AND kind IN ('protein-warehouse','protein-preference')) OR " +
    "(kind='nutrition' AND (day=? OR id IN (SELECT value FROM json_each(?)))))",
  ).bind(owner, Number(addToWarehouse), reuseMatchingMeal ? records[0].date : null,
    JSON.stringify(records.map(({ id }) => id))).all<Stored>();

  const proposed: Proposed[] = records.map((record) => {
    const payload = preparedMeal(request, record);
    const previous = results.find((row) => row.kind === "nutrition" && row.id === record.id) ?? null;
    if (previous && previous.payload !== payload) throw changed();
    return { id: record.id, kind: "nutrition", day: record.date, payload, previous };
  });
  const existingCount = proposed.filter(({ previous }) => previous).length;
  if (existingCount && existingCount !== proposed.length) throw changed();
  if (reuseMatchingMeal && !existingCount && results.some(({ kind, payload }) => kind === "nutrition" && matchingMeal(proposed[0].payload, payload))) {
    return { warehouse: null, recorded: 0, alreadyRecorded: true };
  }

  let warehouse: CoachProteinReceipt["warehouse"] = null;
  let defaultProductId: string | undefined;
  if (addToWarehouse) {
    const previous = results.find((row) => row.kind === "protein-warehouse") ?? null;
    const products = previous ? proteinWarehouse.parse(JSON.parse(previous.payload)).products : [];
    const existing = products.find((item) => item.id === product.id || nameKey(item.name) === nameKey(product.name));
    warehouse = existing ? "existing" : "added";
    if (!existing && existingCount) throw changed();
    if (!existing && products.length >= maxProteinProducts) throw new HttpError(409, `仓库最多可保存 ${maxProteinProducts} 款蛋白粉。`);
    const canComplete = product.powder && (!existing?.powder || existing.powderEstimated && !product.powderEstimated);
    const selected = existing && (!canComplete || existingCount)
      ? existing : { ...product, id: existing?.id ?? product.id };
    const updatedProducts = existing ? products.map((item) => item.id === existing.id ? selected : item) : [...products, selected];
    const payload = selected === existing && previous ? previous.payload : JSON.stringify({ kind: warehouseId, products: updatedProducts });
    proposed.push({ id: warehouseId, kind: warehouseId, day: null, payload, previous });
    if (selected.powder) {
      const priorRow = results.find((row) => row.kind === preferenceId) ?? null;
      const prior = priorRow ? proteinPreference.parse(JSON.parse(priorRow.payload)) : undefined;
      if (existingCount || prior?.enabled && prior.defaultProductId === selected.id) {
        if (prior?.enabled && prior.defaultProductId === selected.id) defaultProductId = selected.id;
      } else {
        defaultProductId = selected.id;
        proposed.push({ id: preferenceId, kind: preferenceId, day: null, previous: priorRow,
          payload: JSON.stringify({ kind: preferenceId, enabled: true, defaultProductId }) });
      }
    }
  }

  const changes = proposed.map(({ previous, ...item }) => ({
    ...item, oldPayload: previous?.payload ?? null, oldUpdated: previous?.updated ?? null,
  }));
  const pending = changes.filter((item) => item.payload !== item.oldPayload).length;
  if (pending) {
    const updated = nextRevision(new Date().toISOString(), changes.map(({ oldUpdated }) => oldUpdated));
    // Verify every affected row before a single statement writes the whole action.
    const saved = await db.prepare(
      "WITH proposed AS MATERIALIZED (SELECT " +
      "json_extract(value,'$.id') AS id, json_extract(value,'$.kind') AS kind, json_extract(value,'$.day') AS day, " +
      "json_extract(value,'$.payload') AS payload, json_extract(value,'$.oldPayload') AS old_payload, " +
      "json_extract(value,'$.oldUpdated') AS old_updated FROM json_each(?)), " +
      "gate AS MATERIALIZED (SELECT NOT EXISTS (SELECT 1 FROM proposed p LEFT JOIN personal_library l " +
      "ON l.owner=? AND l.kind=p.kind AND l.id=p.id WHERE l.payload IS NOT p.old_payload OR l.updated IS NOT p.old_updated) AS ready) " +
      "INSERT INTO personal_library(owner,kind,id,day,payload,updated) " +
      "SELECT ?,p.kind,p.id,p.day,p.payload,? FROM proposed p CROSS JOIN gate " +
      "WHERE gate.ready AND p.payload IS NOT p.old_payload " +
      "ON CONFLICT(owner,kind,id) DO UPDATE SET day=excluded.day,payload=excluded.payload,updated=excluded.updated " +
      "WHERE excluded.kind IN ('protein-warehouse','protein-preference')",
    ).bind(JSON.stringify(changes), owner, owner, updated).run();
    if (saved.meta.changes !== pending) throw changed();
  }
  return { warehouse, recorded: records.length, ...(defaultProductId ? { defaultProductId } : {}) };
}
