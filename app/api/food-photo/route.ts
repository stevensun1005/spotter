import { getChatGPTUser } from "@/app/chatgpt-auth";
import { aiCoachConfig, coachAiRequester } from "@/features/ai-coach/server";
import type { CoachQuota } from "@/features/ai-coach/model";
import { CoachQuotaError } from "@/features/ai-coach/quota";
import { recognizeFoodPhoto } from "@/features/nutrition/food-photo-inference";
import { foodPhotoRequestSchema, maxFoodPhotoRequestLength } from "@/features/nutrition/food-photo-request";
import { HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

function photoApi(handler: (owner: string, request: Request) => Promise<Response> | Response) {
  return async (request: Request) => {
    try {
      const user = await getChatGPTUser();
      if (!user) throw new HttpError(401, "请先登录训练搭子。");
      return await handler(user.userId, request);
    } catch (error) {
      if (error instanceof CoachQuotaError) return json({ error: error.message, code: error.code, quota: error.quota }, error.status);
      return error instanceof HttpError ? json({ error: error.message }, error.status)
        : json({ error: "照片识别暂时无法完成，请重试。" }, 500);
    }
  };
}

export const GET = photoApi(async (owner) => json({ enabled: (await aiCoachConfig()).enabled, owner }));

export const POST = photoApi(async (owner, request) => {
  const input = await readJson(request, foodPhotoRequestSchema, maxFoodPhotoRequestLength);
  if (input.expectedOwner !== owner) throw new HttpError(403, "登录账号已切换，请重新打开拍照识别。");
  let quota: CoachQuota | undefined;
  const receiveQuota = input.inCoach ? (value: CoachQuota) => { quota = value; } : undefined;
  const result = await recognizeFoodPhoto(coachAiRequester(owner, receiveQuota), input, request.signal);
  return json({ ...result, quota });
});
