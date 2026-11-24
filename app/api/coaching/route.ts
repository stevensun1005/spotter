import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { HttpError, json, readJson } from "@/server/http";
import { coachingMutation } from "@/features/coaching/model";
import { changeCoaching, coachingDetail, coachingHome, coachingSource } from "@/features/coaching/server";

export const dynamic = "force-dynamic";
async function account() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请登录后使用教练与学员功能。");
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  return { db: env.DB, actor: { id: user.userId, name: user.fullName?.trim().slice(0, 80) || "训练用户" } };
}
function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof z.ZodError) return json({ error: "请检查教练计划、日期和确认字段。" }, 400);
      // Do not log invitations, user records, request bodies or database values.
      return json({ error: "教练功能暂时未完成，请稍后重试。" }, 500);
    }
  };
}
export const GET = api(async (request) => {
  const { db, actor } = await account();
  const query = new URL(request.url).searchParams;
  if (query.has("assignment")) return json(await coachingDetail(db, actor.id, z.string().uuid().parse(query.get("assignment"))));
  if (query.has("sourceKind") || query.has("sourceId")) {
    const source = z.object({ kind: z.enum(["plan", "template", "program"]), id: z.string().uuid() }).parse({ kind: query.get("sourceKind"), id: query.get("sourceId") });
    return json(await coachingSource(db, actor.id, source.kind, source.id));
  }
  return json(await coachingHome(db, actor));
});
export const POST = api(async (request) => {
  const { db, actor } = await account();
  const input = await readJson(request, coachingMutation, 12_000);
  return json(await changeCoaching(db, actor, coachingMutation.parse(input)));
});
