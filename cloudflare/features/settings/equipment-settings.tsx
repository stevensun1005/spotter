"use client";

import { useEffect, useState, type FormEvent } from "react";
import { barbellReplacementGear, cableReplacementGear, commonReplacementGear } from "@/features/exercises/replacements";
import { SettingsRows } from "./settings-hub";
import { accountGymChanged, queueAccountWorkoutPreferences } from "./account-workout-client";

const equipmentKey = "spotter:equipment";
const gear = [...commonReplacementGear, ...cableReplacementGear, ...barbellReplacementGear];
type Profile = { id: string; name: string; gear: string[] };
type GymState = { active: string; profiles: Profile[] };
const example: Profile = { id: "goodlife", name: "GoodLife", gear: [] };
const initial: GymState = { active: example.id, profiles: [example] };

function readProfiles(): GymState {
  try {
    const value = JSON.parse(localStorage.getItem(equipmentKey) ?? "null") as GymState | null;
    if (!value || !Array.isArray(value.profiles)) return initial;
    const profiles = value.profiles.filter((profile) => typeof profile?.id === "string" &&
      typeof profile.name === "string" && Array.isArray(profile.gear)).slice(0, 12)
      .map((profile) => ({ ...profile, gear: profile.gear.filter((key) => gear.some(([known]) => known === key)) }));
    if (!profiles.length) return initial;
    return { profiles, active: profiles.find(({ id }) => id === value.active)?.id ?? profiles[0].id };
  } catch { return initial; }
}

export function readGymEquipment() {
  const state = readProfiles();
  return state.profiles.find(({ id }) => id === state.active)?.gear ?? [];
}

export function EquipmentSettings({ owner = "" }: { owner?: string }) {
  const [state, setState] = useState(initial);
  const [name, setName] = useState("");
  useEffect(() => {
    const refresh = () => setState(readProfiles());
    refresh();
    window.addEventListener(accountGymChanged, refresh);
    return () => window.removeEventListener(accountGymChanged, refresh);
  }, []);
  const active = state.profiles.find(({ id }) => id === state.active) ?? state.profiles[0];
  function save(next: GymState) {
    setState(next);
    try { localStorage.setItem(equipmentKey, JSON.stringify(next)); } catch { /* Current screen remains usable. */ }
    queueAccountWorkoutPreferences(owner, next.profiles.length ? { gyms: next } : {});
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value || state.profiles.length >= 12 || state.profiles.some((profile) => profile.name === value)) return;
    const next = { id: crypto.randomUUID(), name: value, gear: [] };
    save({ active: next.id, profiles: [...state.profiles, next] });
    setName("");
  }
  function toggle(key: string) {
    const selected = active.gear.includes(key) ? active.gear.filter((item) => item !== key) : [...active.gear, key];
    save({ ...state, profiles: state.profiles.map((profile) => profile.id === active.id ? { ...profile, gear: selected } : profile) });
  }
  return <>
    <SettingsRows title="健身房">
      <label className="settings-control"><strong>当前器械配置</strong><select value={active.id} onChange={(event) => save({ ...state, active: event.target.value })}>
        {state.profiles.map(({ id, name: label }) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <form className="settings-control settings-inline-form" onSubmit={add}>
        <label><strong>添加健身房</strong><input aria-label="健身房名称" value={name} maxLength={40} placeholder="名称" onChange={(event) => setName(event.target.value)} /></label>
        <button className="button outline small" disabled={!name.trim() || state.profiles.length >= 12 || state.profiles.some((profile) => profile.name === name.trim())}>添加</button>
      </form>
    </SettingsRows>
    <SettingsRows title="可用器械">
      <div className="settings-gear">{gear.map(([key, label]) => <label key={key}><input type="checkbox" checked={active.gear.includes(key)}
        onChange={() => toggle(key)} />{label}</label>)}</div>
    </SettingsRows>
    <p className="settings-footnote">器械配置随账号同步。替换动作时优先使用当前配置。</p>
  </>;
}
