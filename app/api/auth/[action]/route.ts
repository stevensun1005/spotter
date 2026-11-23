import { z } from "zod";
import { api, HttpError, json, publicOrigin, readJson } from "@/server/http";
import { endAuthSession, login, loginInput, register, registrationInput, startAuthSession } from "@/features/auth/server";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return api(async (request) => {
    const { action } = await context.params;
    const secure = publicOrigin(request).startsWith("https:");
    if (action === "register") {
      const data = await readJson(request, registrationInput, 4096);
      await startAuthSession(await register(data), secure);
    } else if (action === "login") {
      const data = await readJson(request, loginInput, 4096);
      await startAuthSession(await login(data), secure);
    } else if (action === "logout") {
      await readJson(request, z.object({}), 256);
      await endAuthSession(secure);
    } else {
      throw new HttpError(404, "操作不存在。");
    }
    return json({ ok: true });
  })(request);
}
