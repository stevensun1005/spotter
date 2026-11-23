import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { database, transaction } from "@/server/db";
import { HttpError } from "@/server/http";
import { saveEntry } from "@/server/entries";
import { asDate, dateSchema, offsetDate } from "@/shared/dates";
import type { Pair, Person } from "@/shared/state";

export const inviteFormat = /^[a-f0-9]{32}$/;
export const partnerMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("cheer"), date: dateSchema }),
]);
type Member = { invite: string; creator: string; partnerId: string | null; partnerName: string | null };

export function getPair(owner: string): Pair | null {
  const row = database().prepare(
    "SELECT r.invite, r.owner AS creator, p.user AS partnerId, p.name AS partnerName " +
    "FROM members m JOIN rooms r ON r.id = m.room " +
    "LEFT JOIN members p ON p.room = m.room AND p.user <> m.user WHERE m.user = ?"
  ).get(owner) as Member | undefined;
  return row ? {
    invite: row.creator === owner && !row.partnerId ? row.invite : null,
    partner: row.partnerId ? { id: row.partnerId, name: row.partnerName || "搭子" } : null,
  } : null;
}

export function createPair(person: Person) {
  const db = database();
  transaction(db, () => {
    if (getPair(person.id)) return;
    const room = randomUUID();
    db.prepare("INSERT INTO rooms (id, invite, owner) VALUES (?, ?, ?)")
      .run(room, randomBytes(16).toString("hex"), person.id);
    db.prepare("INSERT INTO members (user, room, name) VALUES (?, ?, ?)").run(person.id, room, person.name);
  });
}

// Registration calls this inside the same transaction as the new account.
export function joinPair(person: Person, invite: string) {
  const result = database().prepare(
    "INSERT INTO members (user, room, name) " +
    "SELECT ?, r.id, ? FROM rooms r JOIN accounts a ON a.id = r.owner " +
    "WHERE r.invite = ? AND (SELECT COUNT(*) FROM members m WHERE m.room = r.id) = 1"
  ).run(person.id, person.name, invite);
  if (!result.changes) throw new HttpError(403, "注册邀请码无效或已使用。");
}

export function cheer(person: Person, date: string) {
  if (!getPair(person.id)?.partner) throw new HttpError(409, "配对后可以给搭子加油。");
  const utcDate = asDate(Date.now(), "UTC");
  if (date < offsetDate(utcDate, -1) || date > offsetDate(utcDate, 1)) {
    throw new HttpError(400, "请确认设备日期和时区。");
  }
  saveEntry(person.id, "cheer-" + date, "cheer", { date });
}
