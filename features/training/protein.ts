import { z } from "zod";
import type { Session } from "./model";

export const proteinPreference = z.object({
  kind: z.literal("protein-preference"),
  enabled: z.boolean(),
});

export function withoutProteinShake(data: Session): Session {
  if (data.proteinShake === undefined) return data;
  const shared = { ...data };
  delete shared.proteinShake;
  return shared;
}
