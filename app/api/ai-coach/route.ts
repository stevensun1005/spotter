import { getChatGPTUser } from "@/app/chatgpt-auth";
import { aiCoachConfig, coachReply } from "@/features/ai-coach/server";
import { coachRequestSchema } from "@/features/ai-coach/model";
import { HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

function coachApi(handler: (account: { id: string; email: string }, request: Request) => Promise<Response> | Response) {
  return async (request: Request) => {
    try {
      const user = await getChatGPTUser();
      if (!user) throw new HttpError(401, "请先登录训练搭子。");
      return await handler({ id: user.userId, email: user.email }, request);
    } catch (error) {
      // Raw exceptions can contain private request text or provider details.
      return error instanceof HttpError ? json({ error: error.message }, error.status)
        : json({ error: "AI 教练暂时无法处理请求，请稍后重试。" }, 500);
    }
  };
}

export const GET = coachApi(({ email }) => json(aiCoachConfig(email)));

export const POST = coachApi(async (account, request) => {
  const input = await readJson(request, coachRequestSchema, 128_000);
  return json(await coachReply(account, input));
});
