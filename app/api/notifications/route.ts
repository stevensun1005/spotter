import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readCookie, sessionCookieName, sessionTokenHash } from "@/features/auth/server";
import { pushAvailable } from "@/features/notifications/apns";
import {
  createBuddyReminder, dispatchNotifications, markNotificationsRead, notificationAudience, notificationInbox, notificationsAllowedFor,
  registerNotificationDevice, removeNotificationDevice, saveNotificationPreferences,
} from "@/features/notifications/server";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";
const expectedOwner = z.string().min(1).max(300);
const installationId = z.string().uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("device"), expectedOwner, installationId,
    token: z.string().regex(/^(?:[a-f0-9]{2}){16,256}$/i).transform((value) => value.toLowerCase()),
    environment: z.enum(["production", "development"]) }).strict(),
  z.object({ action: z.literal("remove-device"), expectedOwner, installationId }).strict(),
  z.object({ action: z.literal("preferences"), expectedOwner, buddyReminders: z.boolean(), friendWorkouts: z.boolean() }).strict(),
  z.object({ action: z.literal("nudge"), expectedOwner, buddyId: z.string().min(1).max(120) }).strict(),
  z.object({ action: z.literal("read"), expectedOwner, id: z.string().uuid().optional() }).strict(),
]);

async function account() {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "请先登录后查看通知。");
  if (!env.DB) throw new HttpError(503, "通知服务暂时不可用。");
  const audience = notificationAudience(env);
  if (!notificationsAllowedFor(audience, user.userId, user.email)) throw new HttpError(403, "通知暂未向当前账号开放。");
  return { db: env.DB, owner: user.userId, audience };
}

export const GET = api(async () => {
  const { db, owner } = await account();
  return json({ ...await notificationInbox(db, owner), pushAvailable: pushAvailable(env) });
});

export const POST = api(async (request) => {
  const { db, owner, audience } = await account();
  const body = await readJson(request, input, 2048);
  if (body.expectedOwner !== owner) throw new HttpError(403, "账号已切换，请重新打开通知。");
  switch (body.action) {
    case "device":
    case "remove-device": {
      const session = await sessionTokenHash(readCookie(request, sessionCookieName));
      if (!session) throw new HttpError(401, "登录已失效，请重新登录后开启通知。");
      if (body.action === "device") await registerNotificationDevice(db, owner, session, body);
      else await removeNotificationDevice(db, owner, session, body.installationId);
      break;
    }
    case "preferences":
      await saveNotificationPreferences(db, owner, body);
      break;
    case "nudge": {
      const notification = await createBuddyReminder(db, owner, body.buddyId, audience);
      await dispatchNotifications(db, env, [notification]);
      return json({ ok: true, id: notification.id });
    }
    case "read":
      await markNotificationsRead(db, owner, body.id);
      break;
  }
  return json({ ok: true });
});
