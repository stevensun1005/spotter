import { z } from "zod";
import { HttpError } from "@/server/http";

const appointmentID = z.string().uuid();
const accountID = z.string().min(1).max(250);
const note = z.string().trim().max(180);

export const appointmentMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), expectedOwner: accountID, partner: accountID,
    id: appointmentID, startsAt: z.number().int().positive(), note }),
  z.object({ action: z.enum(["accept", "decline", "cancel"]), expectedOwner: accountID, id: appointmentID }),
]);

export type AppointmentMutation = z.infer<typeof appointmentMutation>;
export type WorkoutAppointment = {
  id: string;
  sender: string;
  recipient: string;
  startsAt: number;
  note: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
};

const day = 86_400_000;
const currentPair = "EXISTS (SELECT 1 FROM members a INNER JOIN members b ON a.room = b.room " +
  "WHERE a.user = s.sender AND b.user = s.recipient AND a.room = s.room)";

export async function workoutAppointments(db: D1Database, owner: string, now = Date.now()) {
  const { results } = await db.prepare(
    "SELECT s.id, s.sender, s.recipient, s.starts_at AS startsAt, s.note, s.status FROM buddy_workout_appointments s " +
    "WHERE (s.sender = ? OR s.recipient = ?) AND s.starts_at >= ? AND " + currentPair +
    " ORDER BY (s.starts_at < ?) ASC, (s.status NOT IN ('pending','accepted')) ASC, s.starts_at ASC, s.id ASC LIMIT 40",
  ).bind(owner, owner, now - 7 * day, now).all<WorkoutAppointment>();
  return results;
}

export async function changeWorkoutAppointment(db: D1Database, owner: string, request: AppointmentMutation, now = Date.now()) {
  if (owner !== request.expectedOwner) throw new HttpError(403, "登录账号已切换，请重新打开搭子。");
  if (request.action === "propose") {
    if (request.partner === owner || request.startsAt <= now || request.startsAt > now + 365 * day) {
      throw new HttpError(400, "请选择未来一年内的训练时间。");
    }
    const inserted = await db.prepare(
      "INSERT INTO buddy_workout_appointments(id, room, sender, recipient, starts_at, note, status) " +
      "SELECT ?, a.room, a.user, b.user, ?, ?, 'pending' FROM members a " +
      "JOIN members b ON a.room = b.room WHERE a.user = ? AND b.user = ? " +
      "ON CONFLICT(id) DO NOTHING RETURNING id",
    ).bind(request.id, request.startsAt, request.note, owner, request.partner).first();
    if (!inserted) {
      const existing = await db.prepare(
        "SELECT 1 FROM buddy_workout_appointments s WHERE s.id = ? AND s.sender = ? AND s.recipient = ? " +
        "AND s.starts_at = ? AND s.note = ? AND " + currentPair,
      ).bind(request.id, owner, request.partner, request.startsAt, request.note).first();
      if (!existing) throw new HttpError(409, "训练邀约未建立。请确认搭子关系并重新发起。");
    }
    return;
  }

  const next = request.action === "accept" ? "accepted" : request.action === "decline" ? "declined" : "cancelled";
  const authorized = request.action === "cancel"
    ? "(s.sender = ? AND s.status = 'pending' OR (s.sender = ? OR s.recipient = ?) AND s.status = 'accepted')"
    : "s.recipient = ? AND s.status = 'pending'";
  const owners = request.action === "cancel" ? [owner, owner, owner] : [owner];
  const changed = await db.prepare(
    "UPDATE buddy_workout_appointments AS s SET status = ? WHERE s.id = ? AND s.starts_at > ? AND " +
    authorized + " AND " + currentPair + " RETURNING id",
  ).bind(next, request.id, now, ...owners).first();
  if (changed) return;
  const retryAuthorized = request.action === "cancel" ? "(s.sender = ? OR s.recipient = ?)" : "s.recipient = ?";
  const retryOwners = request.action === "cancel" ? [owner, owner] : [owner];
  const existing = await db.prepare(
    "SELECT 1 FROM buddy_workout_appointments s WHERE s.id = ? AND s.status = ? AND " + retryAuthorized + " AND " + currentPair,
  ).bind(request.id, next, ...retryOwners).first();
  if (!existing) throw new HttpError(409, "训练邀约已更新，请刷新后重试。");
}
