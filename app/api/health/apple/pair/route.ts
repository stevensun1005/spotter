import { applePairInput, claimAppleCode } from "@/features/heart/apple/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  const { code } = await readJson(request, applePairInput, 1024);
  return json({ token: claimAppleCode(code) });
});
