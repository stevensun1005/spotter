import { getChatGPTUser } from "@/app/chatgpt-auth";
import { HttpError } from "./http";

export async function requireAccount() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请登录后访问你的个人记录。");
  return { id: user.userId, name: user.displayName || user.fullName || "训练好友" };
}
