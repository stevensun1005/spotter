import { z } from "zod";

const personId = z.string().trim().min(1).max(120);
const expectedOwner = z.string().min(1).max(250).optional();
export const peopleSearchMode = z.enum(["friend", "buddy"]);
export const socialPreferencesSchema = z.object({
  closed: z.boolean(),
  discoverable: z.boolean(),
  recentOnly: z.boolean(),
});

export type SocialPreferences = z.infer<typeof socialPreferencesSchema>;
export const defaultSocialPreferences: SocialPreferences = { closed: false, discoverable: false, recentOnly: false };

export const socialMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("social-preferences"), preferences: socialPreferencesSchema, expectedOwner }),
  z.object({ action: z.literal("request"), id: personId, kind: peopleSearchMode.optional(), shareNutrition: z.boolean().optional(), expectedOwner }),
  z.object({ action: z.literal("respond"), id: z.string().uuid(), decision: z.enum(["accept", "decline", "cancel"]), shareNutrition: z.boolean().optional(), expectedOwner }),
]);

export type SocialMutation = z.infer<typeof socialMutationSchema>;
export type PeopleSearchMode = z.infer<typeof peopleSearchMode>;
export type SocialPerson = { id: string; name: string; handle?: string };
export type FriendRequest = { id: string; personId: string; name: string; createdAt: string; kind?: "buddy"; handle?: string };
export type SocialState = { preferences: SocialPreferences; incoming: FriendRequest[]; outgoing: FriendRequest[]; betaSocialDefaults?: true };
