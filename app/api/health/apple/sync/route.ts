import { appleDeviceOwner, appleSyncInput, attachAppleHeart, disconnectApple, pendingAppleWorkouts } from "@/features/heart/apple/server";
import { api, json, readJson } from "@/server/http";
import { z } from "zod";

export const GET = api((request) => json({ workouts: pendingAppleWorkouts(appleDeviceOwner(request)) }));

export const POST = api(async (request) => {
  appleDeviceOwner(request);
  const data = await readJson(request, appleSyncInput, 48_000);
  return json({ saved: attachAppleHeart(appleDeviceOwner(request), data) });
});

export const DELETE = api(async (request) => {
  appleDeviceOwner(request);
  await readJson(request, z.object({}), 256);
  disconnectApple(appleDeviceOwner(request));
  return json({ connected: false });
});
