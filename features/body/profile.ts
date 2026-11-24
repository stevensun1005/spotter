import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import type { LibraryRow } from "@/features/library/model";

export const bodyProfileValues = z.object({
  heightCm: z.number().finite().min(50).max(280).optional(),
  age: z.number().int().min(1).max(130).optional(),
  sex: z.enum(["male", "female"]).optional(),
  ageAsOf: dateSchema.optional(),
}).strict().refine(({ age, ageAsOf }) => ageAsOf === undefined || age !== undefined);

export type BodyProfile = z.infer<typeof bodyProfileValues>;
export const bodyProfileItem = z.object({ kind: z.literal("body-profile"), values: bodyProfileValues });

type WeightRow = { date: string; updated: string; kg: number };

export function readBodyInputs(rows: readonly LibraryRow[], through?: string) {
  const profile = rows.find((row) => row.kind === "body-profile")?.values;
  let latest: WeightRow | undefined;
  for (const row of rows) {
    if (row.kind !== "nutrition" || row.entry.type !== "weight" || (through !== undefined && row.date > through)) continue;
    if (!latest || row.date > latest.date || (row.date === latest.date && row.updated > latest.updated)) {
      latest = { date: row.date, updated: row.updated, kg: row.entry.kg };
    }
  }
  return { profile, weightKg: latest?.kg, weightDate: latest?.date };
}
