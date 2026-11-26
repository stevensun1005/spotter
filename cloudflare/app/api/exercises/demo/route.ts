import { env } from "cloudflare:workers";
import { gifData, readPersonalDemo } from "@/features/exercises/personal-demo";
import { requireAccount } from "@/server/account";
import { api, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const { id } = await requireAccount();
  if (!env.DB) throw new HttpError(503, "云端数据库暂不可用。");
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name || name.length > 100) throw new HttpError(400, "请提供对应动作的名称。");
  const row = await readPersonalDemo(env.DB, id, name);
  if (!row) throw new HttpError(404, "这个动作还没有个人演示动图。");
  return new Response(gifData(row.gif), { headers: {
    "Content-Type": "image/gif",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
});
