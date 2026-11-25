import { env } from "cloudflare:workers";
import type { MealEntry } from "@/features/library/model";
import { proteinWarehouse } from "@/features/training/protein";
import { HttpError } from "@/server/http";
import type { SavedProteinReceipt, SavedProteinRequest } from "./coach-protein-save";
import { interpretSavedProtein, isSavedProteinCommand, selectSavedProtein } from "./saved-protein-command";

type StoredMeal = { id: string; payload: string; updated: string };
type MealPayload = { id: string; date: string; entry: MealEntry; proteinProductId?: string; sourceWorkoutId?: string };
type Reply = Extract<SavedProteinReceipt, { status: "complete" }>;
const round = (value: number) => Math.round(value * 100) / 100;
const idForDay = (id: string, index: number) => id.slice(0, -2) +
  (Number.parseInt(id.slice(-2), 16) ^ index).toString(16).padStart(2, "0");
const candidateMeal = "owner=? AND kind='nutrition' AND day=? AND json_extract(payload,'$.entry.type')='meal' AND " +
  "(json_extract(payload,'$.proteinProductId')=? OR json_extract(payload,'$.entry.name') IN (?,?)) AND " +
  "ABS(COALESCE(json_extract(payload,'$.entry.grams'),?) - ?) < 0.02";

export async function recordSavedProtein(owner: string, request: SavedProteinRequest): Promise<SavedProteinReceipt> {
  if (owner !== request.expectedOwner) throw new HttpError(403, "登录账号已切换，请重新打开对话。");
  if (!isSavedProteinCommand(request.text) && !request.productId) throw new HttpError(400, "请说明你喝了哪一款蛋白粉。");
  const db = env.DB;
  if (!db) throw new HttpError(503, "云端数据库暂不可用。");
  const warehouse = await db.prepare(
    "SELECT payload FROM personal_library WHERE owner=? AND kind='protein-warehouse' AND id='protein-warehouse'",
  ).bind(owner).first<{ payload: string }>();
  const products = warehouse ? proteinWarehouse.parse(JSON.parse(warehouse.payload)).products : [];
  if (!products.length) return { status: "clarify", message: "蛋白粉仓库还没有配方。请先拍包装营养表或填写一款配方。" };
  const product = selectSavedProtein(products, request.text, request.productId);
  if (!product) return { status: "choose", products: products.map(({ id, name }) => ({ id, name })) };
  const powder = product.powder;
  if (!powder) return { status: "clarify", message: "「" + product.name + "」还缺包装营养表。拍背标或在仓库补齐后即可记餐。" };
  const recipe = interpretSavedProtein(request.text, request.localDate, product);
  if (typeof recipe === "string") return { status: "clarify", message: recipe };
  const recipeLabel = product.name.slice(0, 96) + "（估算）";
  const records: Reply["records"] = [];
  for (const [index, { day, cups }] of recipe.servings.entries()) {
    const id = idForDay(request.recordId, index);
    const grams = round((recipe.powderGrams + recipe.liquidMl) * cups);
    const measure = (key: keyof typeof powder) =>
      round((powder[key] * recipe.powderGrams + (recipe.mixer?.per100ml[key] ?? 0) * recipe.liquidMl) * cups / 100);
    const entry: MealEntry = { type: "meal", meal: "加餐", name: recipe.estimated ? recipeLabel : product.name,
      grams, calories: measure("calories"), protein: measure("protein"), carbs: measure("carbs"), fat: measure("fat") };
    const payload = JSON.stringify({ kind: "nutrition", id, date: day, entry, proteinProductId: product.id });
    const duplicateArgs = [owner, day, product.id, product.name, recipeLabel, grams, grams] as const;
    const updated = new Date().toISOString();
    if (!warehouse) throw new HttpError(409, "蛋白粉仓库已更新，请重新核对。");
    await db.prepare(
      "INSERT INTO personal_library(owner,kind,id,day,payload,updated)" +
      " SELECT ?,'nutrition',?,?,?,? WHERE (? OR NOT EXISTS (SELECT 1 FROM personal_library WHERE " + candidateMeal + "))" +
      " AND EXISTS (SELECT 1 FROM personal_library WHERE owner=? AND kind='protein-warehouse' AND id='protein-warehouse' AND payload=?)" +
      " ON CONFLICT(owner,kind,id) DO NOTHING",
    ).bind(owner, id, day, payload, updated, Number(Boolean(request.anotherCup)), ...duplicateArgs, owner, warehouse.payload).run();
    const ownWrite = await db.prepare(
      "SELECT id,payload,updated FROM personal_library WHERE owner=? AND kind='nutrition' AND id=?",
    ).bind(owner, id).first<StoredMeal>();
    const matching = ownWrite ?? await db.prepare(
      "SELECT id,payload,updated FROM personal_library WHERE " + candidateMeal + " ORDER BY updated DESC LIMIT 1",
    ).bind(...duplicateArgs).first<StoredMeal>();
    if (!matching) throw new HttpError(409, "饮食记录刚在另一台设备改动，请重试。");
    const saved = JSON.parse(matching.payload) as MealPayload;
    if (ownWrite && (saved.date !== day || saved.proteinProductId !== product.id)) {
      throw new HttpError(409, "这条记录已变更，请在饮食日记核对。");
    }
    records.push({ id: matching.id, date: saved.date, entry: saved.entry, updated: matching.updated,
      alreadyRecorded: !ownWrite, ...(saved.sourceWorkoutId ? { linkedWorkout: saved.sourceWorkoutId } : {}) });
  }
  return { status: "complete", productId: product.id, powderGrams: recipe.powderGrams, liquidMl: recipe.liquidMl,
    liquidName: recipe.mixer?.name ?? "水", records };
}
