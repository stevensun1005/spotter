import { asDate } from "@/shared/dates";
import type { Entry, TrainingEntry } from "@/shared/state";
import { pauseClock, workoutElapsed } from "./clock";
import { checkinProblem, sessionSchema, type Session } from "./model";
import { cardioMinutes, cardioSeconds } from "./cardio";

export { checkinProblem } from "./model";

type CheckinStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export type QueuedCheckin = TrainingEntry & { kind: "log" };
export type CheckinReceipt = Pick<QueuedCheckin, "data" | "updated">;
export type CheckinUpload = { expectedOwner: string; id: string; data: Session };

const keyPrefix = "spotter-checkin:";
const accountPrefix = (owner: string) => keyPrefix + encodeURIComponent(owner) + ":";
const storageKey = (owner: string, id: string) => accountPrefix(owner) + id;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export function hasWorkoutCheckinKey(owner: string, key: string | null) {
  return key === null || key.startsWith(accountPrefix(owner));
}

export function finalizeCheckin(data: Session, now = Date.now()): CheckinReceipt {
  const ended = Math.max(data.started, Math.min(now, data.started + 86_400_000));
  const elapsed = workoutElapsed(data, now);
  const cardio = data.cardio && { ...data.cardio, durationSeconds: cardioSeconds(data.cardio, elapsed) };
  const minutes = cardio ? cardioMinutes(cardio.durationSeconds)
    : data.minutes || Math.min(720, Math.max(1, Math.round(elapsed / 60_000)));
  if (cardio && !cardio.durationSeconds) throw new Error("请记录有氧训练时长。");
  const result = sessionSchema.safeParse({ ...pauseClock(data, now), date: asDate(now), ended, minutes, ...(cardio && { cardio }) });
  if (!result.success) throw new Error("训练数据无效，请检查后重试。");
  const problem = checkinProblem(result.data);
  if (problem) throw new Error(problem);
  return { data: result.data, updated: new Date(now).toISOString() };
}

function readQueued(storage: CheckinStorage, owner: string, id: string): QueuedCheckin | undefined {
  if (!uuid.test(id)) return;
  const raw = storage.getItem(storageKey(owner, id));
  if (!raw) return;
  try {
    const item = JSON.parse(raw);
    if (item?.owner !== owner || item?.id !== id || item?.kind !== "log" || typeof item?.updated !== "string") return;
    const checked = sessionSchema.safeParse(item.data);
    if (checked.success && !checkinProblem(checked.data)) return { owner, id, kind: "log", updated: item.updated, data: checked.data };
  } catch { /* A corrupted local record must not be uploaded. */ }
}

export function isCheckinQueued(storage: CheckinStorage, owner: string, id: string) {
  return Boolean(readQueued(storage, owner, id));
}

export function readCheckins(storage: CheckinStorage, owner: string) {
  const prefix = accountPrefix(owner);
  const checkins: QueuedCheckin[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const item = readQueued(storage, owner, key.slice(prefix.length));
    if (item) checkins.push(item);
  }
  return checkins;
}

export function queueCheckin(storage: CheckinStorage, owner: string, id: string, receipt: CheckinReceipt) {
  const existing = readQueued(storage, owner, id);
  if (existing) return existing;
  if (!uuid.test(id)) throw new Error("这条训练的编号无效。");
  const item: QueuedCheckin = { ...receipt, owner, id, kind: "log" };
  storage.setItem(storageKey(owner, id), JSON.stringify(item));
  return item;
}

export async function replayCheckin(
  storage: CheckinStorage, owner: string, id: string, send: (body: CheckinUpload) => Promise<CheckinReceipt>,
): Promise<QueuedCheckin | undefined> {
  const item = readQueued(storage, owner, id);
  if (!item) return;
  const receipt = await send({ expectedOwner: owner, id, data: item.data });
  const record: QueuedCheckin = {
    owner, id, kind: "log", data: sessionSchema.parse(receipt.data), updated: receipt.updated,
  };
  storage.removeItem(storageKey(owner, id));
  return record;
}

export function mergePendingCheckins(entries: Entry[], pending: QueuedCheckin[], owner: string) {
  const logged = new Set(entries.filter((entry) => entry.owner === owner && entry.kind === "log").map((entry) => entry.id));
  const ownPending = pending.filter((entry) => entry.owner === owner && !logged.has(entry.id));
  if (!ownPending.length) return entries;
  const pendingIds = new Set(ownPending.map((entry) => entry.id));
  return [...ownPending, ...entries.filter((entry) => entry.owner !== owner || entry.kind !== "draft" || !pendingIds.has(entry.id))];
}

export function checkinOwnerMatches(authenticatedOwner: string, expectedOwner: string | undefined) {
  return expectedOwner === undefined || expectedOwner === authenticatedOwner;
}
