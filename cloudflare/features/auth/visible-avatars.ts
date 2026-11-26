import { z } from "zod";
import { sharedCheckinCondition } from "@/features/friends/server";

export const avatarLookupIds = z.array(z.string().min(1).max(250)
  .refine((id) => id === id.trim() && !/[\u0000-\u001f\u007f]/u.test(id)))
  .min(1).max(32).transform((ids) => [...new Set(ids)]);

export async function readVisibleAvatars(db: D1Database, owner: string, ids: string[]) {
  const { results } = await db.prepare(
    "SELECT account.id, avatar.image FROM json_each(?) AS requested " +
    "JOIN spotter_access_accounts AS account ON account.id = requested.value " +
    "CROSS JOIN (SELECT ? AS id) AS viewer " +
    "LEFT JOIN spotter_account_avatars AS avatar ON avatar.owner = account.id " +
    "WHERE account.id = viewer.id OR " + sharedCheckinCondition("viewer.id", "account.id") + " OR " +
    "EXISTS (SELECT 1 FROM coaching_links AS relationship WHERE relationship.ended_at IS NULL AND " +
    "((relationship.coach_id = viewer.id AND relationship.student_id = account.id) OR " +
    "(relationship.student_id = viewer.id AND relationship.coach_id = account.id)))"
  ).bind(JSON.stringify(ids), owner).all<{ id: string; image: string | null }>();
  return { avatars: Object.fromEntries(results.map(({ id, image }) => [id, image])) };
}
