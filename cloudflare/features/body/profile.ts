import { z } from "zod";
import { dateSchema, offsetDate } from "@/shared/dates";
import type { LibraryRow } from "@/features/library/model";
import { dayNumber } from "@/features/nutrition/energy-calibration";

export const bodyProfileValues = z.object({
  heightCm: z.number().finite().min(50).max(280).optional(),
  age: z.number().int().min(1).max(130).optional(),
  sex: z.enum(["male", "female"]).optional(),
  ageAsOf: dateSchema.optional(),
}).strict().refine(({ age, ageAsOf }) => ageAsOf === undefined || age !== undefined);

export type BodyProfile = z.infer<typeof bodyProfileValues>;
export type AnatomyVariant = NonNullable<BodyProfile["sex"]>;
export const bodyProfileItem = z.object({ kind: z.literal("body-profile"), values: bodyProfileValues });

export function anatomyVariant(value: unknown): AnatomyVariant | undefined {
  return value === "male" || value === "female" ? value : undefined;
}

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

/** A body-fat reading older than this is not used for estimates. */
export const bodyFatMaxAgeDays = 90;

/** The newest body-fat percentage recorded up to `through`, if it is recent enough to estimate with. */
export function readBodyFat(rows: readonly LibraryRow[], through: string) {
  let latest: { date: string; updated: string; percent: number } | undefined;
  for (const row of rows) {
    if (row.kind !== "nutrition" || row.entry.type !== "measurement" || row.entry.metric !== "fat" || row.date > through) continue;
    if (!latest || row.date > latest.date || (row.date === latest.date && row.updated > latest.updated)) {
      latest = { date: row.date, updated: row.updated, percent: row.entry.value };
    }
  }
  return latest && latest.date >= offsetDate(through, -bodyFatMaxAgeDays) ? { percent: latest.percent, date: latest.date } : undefined;
}

/** Age on a given day: the saved age plus the whole years passed since it was recorded. */
export function ageOn(profile: BodyProfile | undefined, day: string) {
  if (profile?.age === undefined) return undefined;
  // Only two calendar days can be compared. With anything else the saved age stays as it is.
  if (!profile.ageAsOf || !Number.isInteger(dayNumber(profile.ageAsOf)) || !Number.isInteger(dayNumber(day)) || profile.ageAsOf >= day) return profile.age;
  const years = Number(day.slice(0, 4)) - Number(profile.ageAsOf.slice(0, 4)) - (day.slice(5) < profile.ageAsOf.slice(5) ? 1 : 0);
  return profile.age + years;
}
