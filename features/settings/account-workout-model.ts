import { z } from "zod";
import { barbellReplacementGear, cableReplacementGear, commonReplacementGear } from "@/features/exercises/replacements";

const gear = new Set<string>([...commonReplacementGear, ...cableReplacementGear, ...barbellReplacementGear].map(([id]) => id));
const gymProfile = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{1,48}$/),
  name: z.string().trim().min(1).max(40),
  gear: z.array(z.string().refine((id) => gear.has(id))).max(gear.size)
    .refine((ids) => new Set(ids).size === ids.length),
});

export const gymProfiles = z.object({
  active: z.string(),
  profiles: z.array(gymProfile).min(1).max(12),
}).refine(({ active, profiles }) => profiles.some(({ id }) => id === active) &&
  new Set(profiles.map(({ id }) => id)).size === profiles.length);

export const accountWorkoutPreferences = z.object({
  gyms: gymProfiles.optional(),
  defaultUnit: z.enum(["kg", "lb"]).optional(),
  defaultRest: z.number().int().min(0).max(600).optional(),
}).strict();

export type AccountWorkoutPreferences = z.infer<typeof accountWorkoutPreferences>;
export type AccountGymProfiles = z.infer<typeof gymProfiles>;
