import { appleDeviceOwner, appleSyncInput, appleSyncReport, attachAppleHeart, disconnectApple, pendingAppleWorkouts, reportAppleSync } from "@/features/heart/apple/server";
import { api, json, readJson } from "@/server/http";
import { z } from "zod";

export const GET = api((request) => json(pendingAppleWorkouts(appleDeviceOwner(request), request)));
const syncInput = z.union([appleSyncInput, appleSyncReport]);

export const POST = api(async (request) => {
  appleDeviceOwner(request);
  const data = syncInput.parse(await readJson(request, syncInput, 48_000));
  const owner = appleDeviceOwner(request);
  return "action" in data ? json(reportAppleSync(owner, data)) : json({ saved: attachAppleHeart(owner, data) });
});

export const DELETE = api(async (request) => {
  appleDeviceOwner(request);
  await readJson(request, z.object({}), 256);
  disconnectApple(appleDeviceOwner(request));
  return json({ connected: false });
});
