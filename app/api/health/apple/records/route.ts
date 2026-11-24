import { appleDeviceOwner } from "@/features/heart/apple/server";
import { healthBatchSchema } from "@/features/health/model";
import { saveHealthBatch } from "@/features/health/server";
import { api, json, readJson } from "@/server/http";

export const POST = api(async (request) => {
  appleDeviceOwner(request);
  const batch = healthBatchSchema.parse(await readJson(request, healthBatchSchema, 1_500_000));
  return json(saveHealthBatch(appleDeviceOwner(request), batch));
});
