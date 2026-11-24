import { z } from "zod";

const personId = z.string().trim().min(1).max(120);
export const socialPreferencesSchema = z.object({
  closed: z.boolean(),
  discoverable: z.boolean(),
  recentOnly: z.boolean(),
});

export type SocialPreferences = z.infer<typeof socialPreferencesSchema>;
export const defaultSocialPreferences: SocialPreferences = { closed: false, discoverable: false, recentOnly: false };

export const socialMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("social-preferences"), preferences: socialPreferencesSchema }),
  z.object({ action: z.literal("request"), id: personId }),
  z.object({ action: z.literal("respond"), id: z.string().uuid(), decision: z.enum(["accept", "decline", "cancel"]) }),
]);

export type SocialMutation = z.infer<typeof socialMutationSchema>;
export type SocialPerson = { id: string; name: string };
export type FriendRequest = { id: string; personId: string; name: string; createdAt: string };
export type SocialState = { preferences: SocialPreferences; incoming: FriendRequest[]; outgoing: FriendRequest[] };
