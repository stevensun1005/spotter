import { env } from "cloudflare:workers";
import { requireAccount } from "@/server/account";
import { appointmentMutation, changeWorkoutAppointment, workoutAppointments } from "@/features/friends/appointments";
import { friendCurrentDay, receivedCheers } from "@/features/friends/server";
import { api, HttpError, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { id: owner } = await requireAccount();
  const db = env.DB;
  if (!db) throw new HttpError(503, "云端数据库暂不可用。");
  const [cheers, appointments] = await Promise.all([
    receivedCheers(db, owner, friendCurrentDay(request)),
    workoutAppointments(db, owner),
  ]);
  return json({ cheers, appointments });
});

export const POST = api(async (request) => {
  const { id: owner } = await requireAccount();
  const db = env.DB;
  if (!db) throw new HttpError(503, "云端数据库暂不可用。");
  const body = await readJson(request, appointmentMutation, 2048);
  await changeWorkoutAppointment(db, owner, body);
  return json({ appointments: await workoutAppointments(db, owner) });
});
