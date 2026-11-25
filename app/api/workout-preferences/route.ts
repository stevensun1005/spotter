import { env } from "cloudflare:workers";
import { z } from "zod";
import { accountWorkoutPreferences } from "@/features/settings/account-workout-model";
import { requireAccount } from "@/server/account";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const kind = "workout-preferences";
const update = z.object({
  expectedOwner: z.string().min(1).max(300),
  preferences: accountWorkoutPreferences.refine((value) => Object.keys(value).length > 0),
  initialize: z.boolean().optional(),
}).strict();

export const GET = api(async () => {
  const { id } = await requireAccount();
  if (!env.DB) throw new HttpError(503, "训练偏好暂时无法同步。");
  const row = await env.DB.prepare("SELECT payload FROM personal_library WHERE owner=? AND kind=? AND id=?")
    .bind(id, kind, kind).first<{ payload: string }>();
  const preferences = row ? accountWorkoutPreferences.parse(JSON.parse(row.payload).values) : {};
  return json({ owner: id, preferences });
});

export const POST = api(async (request) => {
  const { id } = await requireAccount();
  if (!env.DB) throw new HttpError(503, "训练偏好暂时无法同步。");
  const input = await readJson(request, update, 24_000);
  if (input.expectedOwner !== id) throw new HttpError(403, "登录账号已切换，请重新打开设置。");
  const payload = JSON.stringify({ kind, values: input.preferences });
  const existing = "json_extract(personal_library.payload,'$.values')";
  const incoming = "json_extract(excluded.payload,'$.values')";
  const merge = input.initialize ? `json_patch(${incoming},${existing})` : `json_patch(${existing},${incoming})`;
  const saved = await env.DB.prepare(
    "INSERT INTO personal_library(owner,kind,id,day,payload,updated) VALUES(?,?,?,NULL,?,?) " +
    `ON CONFLICT(owner,kind,id) DO UPDATE SET payload=json_set(excluded.payload,'$.values',${merge}), ` +
    "updated=excluded.updated RETURNING payload"
  ).bind(id, kind, kind, payload, new Date().toISOString()).first<{ payload: string }>();
  if (!saved) throw new HttpError(503, "训练偏好暂时无法同步。");
  return json({ owner: id, preferences: accountWorkoutPreferences.parse(JSON.parse(saved.payload).values) });
});
