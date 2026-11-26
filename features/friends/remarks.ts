import { z } from "zod";
import { HttpError } from "@/server/http";

const accountId = z.string().min(1).max(250);
export const socialRemarkInput = z.object({
  id: accountId,
  expectedOwner: accountId.optional(),
  remark: z.string().trim().refine((value) => [...value].length <= 40 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)),
}).strict();

// SQL expressions come from local statement aliases. This relationship check is independent of sharing permissions.
function relationship(owner: string, contact: string) {
  return `${owner} <> ${contact} AND (EXISTS (SELECT 1 FROM friend_links f
    WHERE f.first_id = MIN(${owner}, ${contact}) AND f.second_id = MAX(${owner}, ${contact}) AND f.linked = 1)
    OR EXISTS (SELECT 1 FROM members m JOIN members p ON p.room = m.room WHERE m.user = ${owner} AND p.user = ${contact}))`;
}

const eligibleContact = `FROM spotter_access_accounts a CROSS JOIN spotter_access_accounts p
  WHERE a.id = ? AND p.id = ? AND ${relationship("a.id", "p.id")}`;
const missingContact = () => new HttpError(404, "找不到这位好友或搭子。");

export async function readSocialRemarks(db: D1Database, owner: string) {
  const { results } = await db.prepare(`SELECT r.contact, r.remark FROM social_remarks r
    WHERE r.owner = ? AND ${relationship("r.owner", "r.contact")}`).bind(owner).all<{ contact: string; remark: string }>();
  return { remarks: Object.fromEntries(results.map(({ contact, remark }) => [contact, remark])) };
}

export async function saveSocialRemark(db: D1Database, owner: string, id: string, remark: string) {
  if (remark) {
    const saved = await db.prepare(`INSERT INTO social_remarks (owner, contact, remark) SELECT a.id, p.id, ? ${eligibleContact}
      ON CONFLICT(owner, contact) DO UPDATE SET remark = excluded.remark RETURNING remark`)
      .bind(remark, owner, id).first<{ remark: string }>();
    if (!saved) throw missingContact();
    return { id, remark: saved.remark };
  }

  // A clear succeeds for an active contact even if it has already been cleared.
  const [active] = await db.batch([
    db.prepare(`SELECT 1 ${eligibleContact}`).bind(owner, id),
    db.prepare(`DELETE FROM social_remarks AS r WHERE r.owner = ? AND r.contact = ? AND ${relationship("r.owner", "r.contact")}`)
      .bind(owner, id),
  ]);
  if (!active.results.length) throw missingContact();
  return { id, remark: null };
}
