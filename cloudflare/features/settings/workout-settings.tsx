"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Volume2 } from "lucide-react";
import { useRestSignals } from "@/features/training/use-rest-reminder";
import { SettingsRows } from "./settings-hub";
import { saveWorkoutPreferences, useWorkoutPreferences, type WorkoutPreferences } from "./workout-prefs";
import { queueAccountWorkoutPreferences } from "./account-workout-client";

export type WorkoutSettingsPage = "workout" | "advanced" | "alerts";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <SettingsRows title={title}>{children}</SettingsRows>;
}

type BooleanPreference = {
  [Key in keyof WorkoutPreferences]: WorkoutPreferences[Key] extends boolean ? Key : never
}[keyof WorkoutPreferences];

function Toggle({ label, setting, prefs, note }: {
  label: string; setting: BooleanPreference; prefs: WorkoutPreferences; note?: string;
}) {
  return <label className="settings-control" id={"setting-" + setting}><span><strong>{label}</strong>{note && <small className="muted">{note}</small>}</span>
    <input className="settings-switch" type="checkbox" role="switch" checked={prefs[setting]} onChange={(event) => saveWorkoutPreferences({ [setting]: event.target.checked })} />
  </label>;
}

function Count({ label, value, change, min = 0, max = 600, blank, step = 1 }: {
  label: string; value: number | null; change: (value: number | null) => void;
  min?: number; max?: number; blank?: string; step?: number;
}) {
  const [entry, setEntry] = useState(() => value === null ? "" : String(value));
  useEffect(() => setEntry(value === null ? "" : String(value)), [value]);
  function commit() {
    const input = entry.trim();
    const number = Number(input);
    const next = input && Number.isFinite(number) ? Math.min(max, Math.max(min, step === 1 ? Math.round(number) : number)) : blank ? null : value;
    setEntry(next === null ? "" : String(next));
    if (next !== value) change(next);
  }
  return <label className="settings-control"><strong>{label}</strong><input type="number" inputMode={step === 1 ? "numeric" : "decimal"}
    min={min} max={max} step={step} placeholder={blank} value={entry} className="workout-preference-number"
    onChange={(event) => setEntry(event.target.value)} onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} /></label>;
}

function Select<T extends string | number>({ label, options, value, change }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; change: (value: T) => void;
}) {
  return <label className="settings-control"><strong>{label}</strong><select value={value} onChange={(event) => {
    const choice = options.find(([option]) => String(option) === event.target.value);
    if (choice) change(choice[0]);
  }}>{options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}</select></label>;
}

export function WeightEntrySettings({ owner = "" }: { owner?: string }) {
  const prefs = useWorkoutPreferences();
  return <Group title="重量记录"><Select label="新动作重量单位" options={[["kg", "公斤（kg）"], ["lb", "磅（lb）"]]} value={prefs.defaultUnit}
    change={(defaultUnit) => {
      saveWorkoutPreferences({ defaultUnit });
      queueAccountWorkoutPreferences(owner, { defaultUnit });
    }} />
    <Select label="重量调整步长" options={([0.25, 0.5, 1, 2.5, 5, 10] as const).map((amount) => [amount, String(amount)] as const)} value={prefs.weightStep}
      change={(weightStep) => saveWorkoutPreferences({ weightStep })} /></Group>;
}

export function WorkoutSettings({ page, navigate, children, owner = "" }: {
  page: WorkoutSettingsPage; navigate?: (page: WorkoutSettingsPage) => void; children?: ReactNode; owner?: string;
}) {
  const prefs = useWorkoutPreferences();
  const signals = useRestSignals(prefs);
  const [message, setMessage] = useState("");
  const [capabilities, setCapabilities] = useState({ vibrate: true, voice: true, wake: true });
  useEffect(() => setCapabilities({ vibrate: typeof navigator.vibrate === "function", voice: "speechSynthesis" in window, wake: "wakeLock" in navigator }), []);
  const local = <p className="settings-footnote">这些选项保存在当前浏览器。</p>;
  if (page === "alerts") {
    return <div className="feature-stack">
      <Group title="休息结束">
        <Select label="提示音" options={[["off", "关闭"], ["chime", "清脆"], ["low", "低音"], ["short", "短音"]]} value={prefs.alertSound}
          change={(alertSound) => saveWorkoutPreferences({ alertSound })} />
        <Toggle label="震动提醒" setting="alertVibrate" prefs={prefs} note={capabilities.vibrate ? undefined : "当前浏览器没有震动功能。"} />
        <Toggle label="画面提示" setting="alertFlash" prefs={prefs} note="休息结束时显示一次明显的高亮。" />
        <Toggle label="语音提醒" setting="alertVoice" prefs={prefs} note={capabilities.voice ? undefined : "当前浏览器没有语音合成功能。"} />
      </Group>
      <Group title="语音">
        <Toggle label="还剩十秒时播报" setting="alertVoiceCountdown" prefs={prefs} />
        <Count label="语速" min={0.5} max={2} step={0.1} value={prefs.voiceRate} change={(voiceRate) => saveWorkoutPreferences({ voiceRate: voiceRate ?? 1 })} />
        <Count label="音高" min={0.5} max={2} step={0.1} value={prefs.voicePitch} change={(voicePitch) => saveWorkoutPreferences({ voicePitch: voicePitch ?? 1 })} />
      </Group>
      <button className="button outline" type="button" onClick={async () => {
        await signals.prepareSound();
        signals.notify();
        if (prefs.alertVoiceCountdown && !prefs.alertVoice) signals.say("休息还剩十秒");
        setMessage("提醒测试完成。");
      }}><Volume2 size={17} /> 试播提醒</button>
      {signals.flash && <div className="workout-signal-flash" aria-hidden="true" />}
      {message && <p role="status" className="muted">{message}</p>}
      <p className="settings-footnote">前台训练页面支持这些提醒。浏览器权限、系统静音和设备功能会影响声音或震动。</p>
      {local}{children}
    </div>;
  }
  if (page === "advanced") {
    return <div className="feature-stack">
      <Group title="训练界面信息">
        <Toggle label="显示下一组" setting="showNext" prefs={prefs} />
        <Toggle label="显示训练强度" setting="showEffort" prefs={prefs} note="显示动作目标和组内的主观强度。" />
        {prefs.showEffort && <Select label="强度记法" options={[["rpe", "RPE · 主观强度"], ["rir", "RIR · 剩余次数"]]} value={prefs.effortScale}
          change={(effortScale) => saveWorkoutPreferences({ effortScale })} />}
        <Toggle label="显示动作节奏" setting="showTempo" prefs={prefs} />
      </Group>
      {local}{children}
    </div>;
  }
  return <div className="feature-stack">
    <Group title="休息设置">
      <Count label="默认组间休息（秒）" value={prefs.defaultRest} change={(value) => {
        const defaultRest = value ?? 30;
        saveWorkoutPreferences({ defaultRest });
        queueAccountWorkoutPreferences(owner, { defaultRest });
      }} />
      <Count label="热身组休息（秒）" blank="跟随默认" value={prefs.warmupRest} change={(warmupRest) => saveWorkoutPreferences({ warmupRest })} />
      <Count label="换动作休息（秒）" blank="跟随默认" value={prefs.transitionRest} change={(transitionRest) => saveWorkoutPreferences({ transitionRest })} />
    </Group>
    <p className="settings-footnote">训练计划和本次训练指定的休息时间优先。</p>
    <Group title="记录训练">
      <Count label="新动作的默认组数" min={1} max={30} value={prefs.newSets} change={(newSets) => saveWorkoutPreferences({ newSets: newSets ?? 3 })} />
      <Count label="新动作的默认次数" min={1} max={999} value={prefs.newReps} change={(newReps) => saveWorkoutPreferences({ newReps: newReps ?? 10 })} />
    </Group>
    <Group title="训练中">
      <Select label="训练布局" options={[["cards", "卡片"], ["list", "列表"], ["focus", "专注"]]} value={prefs.layout}
        change={(layout) => saveWorkoutPreferences({ layout })} />
      <Select label="训练页面动作演示" options={[["hidden", "隐藏"], ["small", "小图"], ["full", "大图"]]} value={prefs.animations}
        change={(animations) => saveWorkoutPreferences({ animations })} />
      <Toggle label="自动跳转到下一组" setting="autoAdvance" prefs={prefs} />
      <Toggle label="完成后折叠动作" setting="collapseCompleted" prefs={prefs} />
      <Toggle label="训练时保持屏幕常亮" setting="keepAwake" prefs={prefs}
        note={capabilities.wake ? "仅在训练计时中且页面可见时生效。" : "当前浏览器没有屏幕常亮功能。"} />
    </Group>
    {navigate && <Group title="更多"><button className="settings-control" onClick={() => navigate("advanced")} type="button"><strong>训练细调</strong><ChevronRight size={18} /></button></Group>}
    {local}{children}
  </div>;
}
