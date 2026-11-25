"use client";

import { useEffect } from "react";
import type { AccountGymProfiles, AccountWorkoutPreferences } from "./account-workout-model";
import { readWorkoutPreferences, saveWorkoutPreferences, storedWorkoutPreferences } from "./workout-prefs";

const endpoint = "/api/workout-preferences";
const ownerKey = "spotter:account-workout-owner";
const gymKey = "spotter:equipment";
export const accountGymChanged = "spotter:account-gym-changed";

type Local = { cached: AccountWorkoutPreferences; seed?: AccountWorkoutPreferences; pending: AccountWorkoutPreferences };
type Answer = { owner: string; preferences: AccountWorkoutPreferences };
const defaultGym: AccountGymProfiles = { active: "goodlife", profiles: [{ id: "goodlife", name: "GoodLife", gear: [] }] };
let active: { owner: string; local: Local; syncing: boolean } | undefined;

function store<T>(key: string, value?: T): T | undefined {
  try {
    if (value !== undefined) { localStorage.setItem(key, JSON.stringify(value)); return value; }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : undefined;
  } catch { return undefined; }
}

const cacheKey = (owner: string) => "spotter:account-workout:" + encodeURIComponent(owner);
const visible = (local: Local) => ({ ...local.seed, ...local.cached, ...local.pending });

function apply(value: AccountWorkoutPreferences) {
  const old = readWorkoutPreferences();
  const defaultUnit = value.defaultUnit ?? "kg";
  const defaultRest = value.defaultRest ?? 30;
  const gyms = value.gyms ?? defaultGym;
  if (old.defaultUnit !== defaultUnit || old.defaultRest !== defaultRest) saveWorkoutPreferences({ defaultUnit, defaultRest });
  if (JSON.stringify(gyms) !== JSON.stringify(store(gymKey))) {
    store(gymKey, gyms);
    window.dispatchEvent(new Event(accountGymChanged));
  }
}

async function request(owner: string, preferences?: AccountWorkoutPreferences, initialize = false): Promise<Answer> {
  const response = await fetch(endpoint, preferences ? {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedOwner: owner, preferences, initialize }),
  } : { cache: "no-store" });
  if (!response.ok) throw new Error("Training preferences unavailable");
  const answer: Answer = await response.json();
  if (answer.owner !== owner) throw new Error("Account changed");
  return answer;
}

async function sync(session = active) {
  if (!session || session.syncing || active !== session) return;
  session.syncing = true;
  const { owner, local } = session;
  const accept = (answer: Answer) => {
    local.cached = answer.preferences;
    store(cacheKey(owner), local);
    if (active === session) apply(visible(local));
  };
  try {
    if (local.seed && Object.keys(local.seed).length) {
      const answer = await request(owner, local.seed, true);
      delete local.seed;
      accept(answer);
    } else if (!Object.keys(local.pending).length) accept(await request(owner));
    while (active === session && Object.keys(local.pending).length) {
      const sent = { ...local.pending };
      const answer = await request(owner, sent);
      for (const key of Object.keys(sent) as (keyof AccountWorkoutPreferences)[]) {
        if (sent[key] === local.pending[key]) delete local.pending[key];
      }
      accept(answer);
    }
  } catch {
    // The account-local pending changes will be retried when the page is focused or back online.
  } finally { session.syncing = false; }
}

function open(owner: string) {
  if (active?.owner === owner) return active;
  const oldOwner = store<string>(ownerKey);
  const legacy: AccountWorkoutPreferences = !oldOwner || oldOwner === owner ? {
    ...storedWorkoutPreferences(),
    gyms: store<AccountGymProfiles>(gymKey),
  } : {};
  const seed = Object.fromEntries(Object.entries(legacy).filter(([, value]) => value !== undefined));
  const local = store<Local>(cacheKey(owner)) ?? { cached: {}, seed, pending: {} };
  store(ownerKey, owner);
  active = { owner, local, syncing: false };
  apply(visible(local));
  return active;
}

export function queueAccountWorkoutPreferences(owner: string, change: AccountWorkoutPreferences) {
  if (!owner) return;
  const session = open(owner);
  session.local.pending = { ...session.local.pending, ...change };
  apply(visible(session.local));
  store(cacheKey(owner), session.local);
  void sync(session);
}

export function useAccountWorkoutPreferences(owner: string | undefined) {
  useEffect(() => {
    if (!owner) { active = undefined; return; }
    const session = open(owner);
    const requestSync = () => { void sync(session); };
    requestSync();
    window.addEventListener("focus", requestSync);
    window.addEventListener("online", requestSync);
    return () => {
      window.removeEventListener("focus", requestSync);
      window.removeEventListener("online", requestSync);
      if (active === session) active = undefined;
    };
  }, [owner]);
}
