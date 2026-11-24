import { getChatGPTUser } from "@/app/chatgpt-auth";
import { aiCoachConfig, withCoachAi } from "@/features/ai-coach/server";
import { recognizeFoodPhoto } from "@/features/nutrition/food-photo-inference";
import { foodPhotoRequestSchema, maxPhotoBase64Length } from "@/features/nutrition/food-photo-request";
import { HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

function photoApi(handler: (account: { id: string; email: string }, request: Request) => Promise<Response> | Response) {
  return async (request: Request) => {
    try {
      const user = await getChatGPTUser();
      if (!user) throw new HttpError(401, "请先登录训练搭子。");
      return await handler({ id: user.userId, email: user.email }, request);
    } catch (error) {
      return error instanceof HttpError ? json({ error: error.message }, error.status)
        : json({ error: "照片识别暂时无法完成，请重试。" }, 500);
    }
  };
}

export const GET = photoApi((account) => json({ enabled: aiCoachConfig(account.email).enabled, owner: account.id }));

export const POST = photoApi(async (account, request) => {
  const input = await readJson(request, foodPhotoRequestSchema, maxPhotoBase64Length + 5000);
  if (input.expectedOwner !== account.id) throw new HttpError(403, "登录账号已切换，请重新打开拍照识别。");
  return json(await withCoachAi(account, (key) => recognizeFoodPhoto(key, input, request.signal)));
});
