import { z } from "zod";
import { dateSchema } from "@/shared/dates";
import type { AnatomyVariant } from "@/features/body/profile";
import type { MealEntry } from "@/features/library/model";
import type { Move, Plan } from "@/features/plans/model";
import type { SetLine } from "@/features/training/model";

const friendId = z.string().trim().min(1).max(120);
export const friendDateQuery = z.object({ friend: friendId, date: dateSchema });
export const friendFeedCheerInput = friendDateQuery.extend({
  action: z.literal("feed-cheer"),
  active: z.boolean(),
  expectedOwner: z.string().min(1).max(250),
}).strict();
const shareOptions = z.object({
  training: z.boolean(),
  nutrition: z.boolean(),
  nutritionDetails: z.boolean().optional(),
});
export const friendMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite") }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("join"), code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/) }),
  z.object({ action: z.literal("share"), id: friendId, sharing: shareOptions }),
  z.object({ action: z.literal("remove"), id: friendId }),
]);

export type Sharing = Required<z.infer<typeof shareOptions>>;
export type FriendMutation = z.infer<typeof friendMutation>;
export type Friend = { id: string; name: string; buddy: boolean; sharing: Sharing; shared: Sharing; checkedIn?: boolean };
export type FriendList = { friends: Friend[]; invite: { code: string; expiresAt: string } | null };
export type SharedMeal = Omit<MealEntry, "type" | "foodId"> & { id: string };
export type SharedWorkout = {
  id: string;
  title: string;
  category: Plan["category"];
  minutes: number;
  sets: number;
  finishedVideo: boolean;
  exercises: {
    name: string;
    catalogueId?: Move["catalogueId"];
    sourceName?: Move["sourceName"];
    warmup?: true;
    unit: Move["unit"];
    sets: Pick<SetLine, "weight" | "reps" | "seconds" | "right" | "kind">[];
  }[];
};
export type FriendDay = {
  friend: Friend;
  date: string;
  restricted?: true;
  anatomyVariant?: AnatomyVariant;
  workoutCheckin: boolean;
  dietCheckin: boolean | null;
  training: SharedWorkout[] | null;
  nutrition: SharedMeal[] | null;
};

export type SharedWorkoutSummary = Pick<SharedWorkout, "id" | "title" | "category" | "minutes" | "sets"> & {
  exercises: number;
};
export type FriendFeed = {
  days: {
    date: string;
    items: {
      friend: Pick<Friend, "id" | "name" | "buddy">;
      own: boolean;
      workouts: SharedWorkoutSummary[] | null;
      cheer: { count: number; given: boolean; available: boolean };
    }[];
  }[];
};
