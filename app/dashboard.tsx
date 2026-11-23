"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  BarChart3, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, Cloud,
  Bookmark, CalendarClock, Copy, Dumbbell, Flame, House, Link2, LogIn, Menu, Play, Plus, Settings2, Sparkles, Trash2, Utensils, Users,
} from "lucide-react";
import {
  asDate, examples, offsetDate, planBlank, sessionTotals, startSession,
  type Entry, type Plan, type Session, type State,
} from "./workout";
import {
  cleanPlan, Dialog, draftsOrLogs, History, LogDetail, PlanFields, shortDate, Stats, VideoLink, weekdayIndex, weekdays,
  type Log,
} from "./panels";
import { useTrainingNavigation } from "@/features/training/navigation";
import { TrainingNotice } from "@/features/training/training-notice";
import { Workout } from "@/features/training/workout";
import { ProteinCheck } from "@/features/training/protein-check";
import { ImportView } from "@/features/import/import-view";
import type { WhoopStatus } from "@/features/heart/whoop";
import { ExerciseDetail } from "@/features/exercises/exercise-view";
import { OpenGymCatalogue } from "@/features/exercises/open-gym-catalogue";
import { defaultCatalogMove } from "@/features/exercises/exercise-picker";
import type { CatalogEntry, ExerciseChoice } from "@/features/exercises/open-gym";
import { NutritionView } from "@/features/nutrition/nutrition-view";
import { PlanSections } from "@/features/plans/plan-sections";

import { useLibrary } from "@/features/library/use-library";
import { PlanActions } from "@/features/plans/plan-actions";
import { MovePlan, ScheduleSettings } from "@/features/plans/schedule-view";
import { blocked, openSchedule } from "@/features/plans/schedule";
import { pauseClock, resumeClock, workoutElapsed } from "@/features/training/clock";
import { refreshDraftPlan } from "@/features/training/refresh-plan";
import { parsePlanMove } from "@/features/exercises/move-name";
import { PlanSequence } from "@/features/training/plan-sequence";
import { BodyView } from "@/features/body/body-view";
import { DataView } from "@/features/data/data-view";
import { HardDriveDownload, Ruler } from "lucide-react";

type View = "today" | "plans" | "history" | "stats" | "import" | "exercises" | "nutrition" | "body" | "data" | "more";
type KeyedPlan = { id: string; data: Plan };
type Overlay = { kind: "pair" | "schedule" } | { kind: "move"; item: KeyedPlan } | { kind: "delete"; itemId: string; label: string; type: "plan" | "draft" } | { kind: "editor"; plan: KeyedPlan } | { kind: "template"; item: KeyedPlan; editing?: boolean } | { kind: "session"; id: string; data: Session } | { kind: "log"; log: Log; whoop?: WhoopStatus };
type PlanEntry = Extract<Entry, { kind: "plan" }>;
const navigation = [
  { id: "today", title: "今日训练", mobile: "今日", icon: House },
  { id: "plans", title: "训练计划", mobile: "计划", icon: ClipboardList },
  { id: "exercises", title: "动作库", mobile: "动作", icon: Dumbbell },
  { id: "history", title: "打卡历史", mobile: "打卡", icon: CalendarDays },
  { id: "nutrition", title: "饮食记录", mobile: "", icon: Utensils },
  { id: "stats", title: "训练统计", mobile: "统计", icon: BarChart3 },
  { id: "body", title: "身体数据", mobile: "", icon: Ruler },
  { id: "data", title: "数据导出与导入", mobile: "", icon: HardDriveDownload },
  { id: "import", title: "导入计划", mobile: "", icon: Sparkles },
  { id: "more", title: "更多功能", mobile: "更多", icon: Menu },
] as const;
const demoUser = { id: "demo", name: "我" };
const demoPartner = { id: "demo-partner", name: "搭子" };

function demoState(today: string): State {
  const entries: Entry[] = [[-6, "全身拉伸", 22], [-4, "下肢力量训练", 43], [-2, "核心稳定训练", 28], [0, "轻有氧跟练", 24]].map(([days, title, minutes], i) => {
    const date = offsetDate(today, days as number);
    const plan = { ...examples(date), title: String(title), minutes: Number(minutes) };
    const data: Session = {
      plan, planId: "sample-" + i, date, started: new Date(date + "T16:00:00Z").getTime(),
      minutes: Number(minutes), note: "", finishedVideo: false,
      rows: plan.exercises.map((move) => Array.from({ length: move.sets }, () => ({ weight: move.weight, reps: move.reps, seconds: 0, done: true }))),
    };
    return { id: "sample-log-" + i, owner: i === 3 ? demoPartner.id : demoUser.id, kind: "log", data, updated: date };
  });
  return { me: demoUser, room: { invite: null, partner: demoPartner }, entries };
}

function avatar(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() || "我";
}

async function post(body: unknown) {
  const response = await fetch("/api/workout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw Object.assign(new Error(data?.error || "云端保存失败，请重试。"), { status: response.status });
  }
  return response;
}

const message = (reason: unknown, fallback: string) =>
  reason instanceof Error && reason.name === "Error" ? reason.message : fallback;

export default function Dashboard({ viewer, initialDate, initialWorkoutId, heartReturn }: {
  viewer: State["me"] | null; initialDate: string; initialWorkoutId?: string; heartReturn?: { id: string; result: WhoopStatus };
}) {
  const [today, setToday] = useState(initialDate);
  const [selected, setSelected] = useState(initialDate);
  const [view, setView] = useState<View>(heartReturn ? "history" : "today");
  const [exercise, setExercise] = useState<ExerciseChoice>();
  const [planPick, setPlanPick] = useState<{ choice: ExerciseChoice; row?: CatalogEntry }>();
  const [targetPlan, setTargetPlan] = useState("");
  const [planTab, setPlanTab] = useState<"个人模板">();
  const [confirmRemoveTemplate, setConfirmRemoveTemplate] = useState(false);
  const library = useLibrary(Boolean(viewer));
  const [returnToLog, setReturnToLog] = useState(heartReturn);
  const [state, setState] = useState<State>(() => viewer ? { me: viewer, entries: [], room: null } : demoState(initialDate));
  const [cloud, setCloud] = useState(viewer ? "正在连接" : "本机演示");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const trainingNav = useTrainingNavigation(initialWorkoutId ?? null);
  const [draftsReady, setDraftsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState("");
  const [toast, setToast] = useState("");
  const [invite, setInvite] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, Session>>({});
  const pendingRef = useRef<Record<string, Session>>({});
  const deletedDrafts = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const refreshId = useRef(0);
  const draftKey = "spotter-drafts:" + (viewer?.id ?? "demo");
  const [sync, setSync] = useState("正在保存");

  const setPending = useCallback((next: Record<string, Session>) => {
    pendingRef.current = next;
    setPendingDrafts(next);
    try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* Browser storage may be disabled. */ }
  }, [draftKey]);

  const refresh = useCallback(async () => {
    if (!viewer) return;
    const generation = ++refreshId.current;
    try {
      const response = await fetch("/api/workout", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const next: State = await response.json();
      if (generation === refreshId.current) { setState(next); setCloud("云端已连接"); }
    } catch {
      if (generation === refreshId.current) setCloud("云端连接异常");
    }
  }, [viewer]);

  const flushDraft = useCallback((id: string, data: Session) => {
    if (!viewer) { setSync("本机草稿"); return; }
    queue.current = queue.current.then(async () => {
      if (deletedDrafts.current.has(id) || pendingRef.current[id] !== data) return;
      setSync("正在保存");
      try {
        await post({ action: "draft", id, data });
        if (pendingRef.current[id] === data) {
          const next = { ...pendingRef.current };
          delete next[id];
          setPending(next);
          setSync("云端已保存");
        }
        setState((current) => {
          if (current.entries.some((entry) => entry.id === id && entry.owner === viewer.id && entry.kind === "log")) return current;
          const entry: Entry = { id, data, owner: viewer.id, kind: "draft", updated: new Date().toISOString() };
          return { ...current, entries: [entry, ...current.entries.filter((row) => row.id !== id || row.owner !== viewer.id)] };
        });
      } catch (reason) {
        if ((reason as { status?: number })?.status === 409) {
          const next = { ...pendingRef.current };
          delete next[id];
          setPending(next);
          setSync("已在其他设备打卡");
          void refresh();
        } else setSync("草稿待同步");
      }
    });
  }, [viewer, setPending, refresh]);

  useEffect(() => {
    let drafts: Record<string, Session> = {};
    try { drafts = JSON.parse(localStorage.getItem(draftKey) || "{}"); } catch { /* A malformed cache can be ignored. */ }
    setPending(drafts);
    setDraftsReady(true);
    const retry = () => {
      for (const [id, data] of Object.entries(pendingRef.current)) flushDraft(id, data);
    };
    retry();
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") { void refresh(); retry(); setToday(asDate()); }
    }, 15000);
    const wake = () => { void refresh(); retry(); setToday(asDate()); };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(timer);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [draftKey, flushDraft, refresh, setPending]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const { me, room, entries } = state;
  useEffect(() => {
    if (!returnToLog || cloud !== "云端已连接") return;
    const log = entries.find((entry): entry is Log => entry.kind === "log" && entry.owner === me.id && entry.id === returnToLog.id);
    if (log) setOverlay({ kind: "log", log, whoop: returnToLog.result });
    setReturnToLog(undefined);
    window.history.replaceState(window.history.state, "", "/");
  }, [returnToLog, entries, cloud, me.id]);

  const partner = room?.partner;
  const demo = !viewer;
  const logs = entries.filter(draftsOrLogs).filter((entry) => entry.kind === "log");
  const plans = entries.filter((entry): entry is PlanEntry => entry.kind === "plan");
  const myDrafts = entries.filter(draftsOrLogs).filter((entry) => entry.kind === "draft" && entry.owner === me.id);
  const drafts = [...Object.entries(pendingDrafts), ...myDrafts.filter((item) => !pendingDrafts[item.id]).map((item) => [item.id, item.data] as const)]
    .filter(([id]) => !logs.some((log) => log.owner === me.id && log.id === id));
  const routeDraft = drafts.find(([id]) => id === trainingNav.id);
  const completedWorkout = logs.find((log) => log.owner === me.id && log.id === trainingNav.id);
  const profiles = library.rows.filter((item) => item.kind === "exercise").map(({ item }) => item);
  const templates = library.rows.filter((item) => item.kind === "template");
  const trackProtein = Boolean(viewer && library.rows.find((item) => item.kind === "protein-preference")?.enabled);
  const schedule = library.rows.find((item) => item.kind === "schedule")?.values ?? openSchedule;
  const exerciseNames = [
    ...plans.filter((plan) => plan.owner === me.id).flatMap((plan) => plan.data.exercises.map((item) => item.name)),
    ...logs.filter((log) => log.owner === me.id).flatMap((log) => log.data.plan.exercises.map((item) => item.name)),
  ].map((name) => parsePlanMove(name).name);
  const todaysPlans = plans.filter((item) => item.data.date === selected);
  const sample: KeyedPlan = { id: "example", data: examples(today) };
  const current = todaysPlans[0] ?? (selected === today && !drafts.some(([, data]) => data.date === today) && !logs.some((log) => log.owner === me.id && log.data.date === today) ? sample : null);
  const latestPartner = logs.filter((log) => log.owner === partner?.id).sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
  const myToday = logs.filter((log) => log.owner === me.id && log.data.date === today);
  const partnerToday = logs.filter((log) => log.owner === partner?.id && log.data.date === today);
  const recent = logs.filter((log) => log.owner === me.id && log.data.date >= offsetDate(today, -6) && log.data.date <= today);
  const sentCheer = entries.some((entry) => entry.kind === "cheer" && entry.owner === me.id && entry.data.date === today);
  const receivedCheer = entries.some((entry) => entry.kind === "cheer" && entry.owner === partner?.id && entry.data.date === today);
  const weekStart = offsetDate(selected, -weekdayIndex(selected));

  const go = (next: View) => { setView(next); setPlanTab(undefined); setWarning(""); window.scrollTo({ top: 0 }); };
  const open = (next: Overlay) => { setWarning(""); setOverlay(next); };
  const parkWorkout = useCallback((id: string, data: Session) => {
    const latest = pendingRef.current[id] ?? data;
    const paused = pauseClock(latest);
    if (paused !== latest) {
      setPending({ ...pendingRef.current, [id]: paused });
      setOverlay((value) => value?.kind === "session" && value.id === id ? { ...value, data: paused } : value);
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (pendingRef.current[id]) void flushDraft(id, pendingRef.current[id]);
  }, [setPending, flushDraft]);

  useEffect(() => {
    if (overlay?.kind !== "session" || busy) return;
    const { id, data } = overlay;
    const park = () => parkWorkout(id, data);
    const onVisibility = () => { if (document.visibilityState === "hidden") park(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", park);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", park);
    };
  }, [overlay, busy, parkWorkout]);

  const close = useCallback(() => {
    if (busy) return;
    if (overlay?.kind === "session") parkWorkout(overlay.id, overlay.data);
    setOverlay(null); setWarning("");
  }, [busy, overlay, parkWorkout]);

  const activeSessionId = overlay?.kind === "session" ? overlay.id : null;

  useEffect(() => {
    if (trainingNav.id && routeDraft && activeSessionId !== trainingNav.id) {
      const [id, draft] = routeDraft;
      const data = refreshDraftPlan(draft, plans.find((plan) => plan.id === draft.planId)?.data);
      setWarning("");
      setSync(demo ? "本机草稿" : pendingDrafts[id] ? "草稿待同步" : "云端已保存");
      setOverlay({ kind: "session", id, data });
    } else if (!trainingNav.id && activeSessionId) {
      close();
    }
  }, [trainingNav.id, routeDraft, activeSessionId, close, demo, pendingDrafts, plans]);

  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setWarning("");
    try { await action(); } catch (reason) { setWarning(message(reason, "操作未保存，请检查网络后重试。")); }
    finally { setBusy(false); }
  }

  function newPlan(data = planBlank(selected)) {
    open({ kind: "editor", plan: { id: crypto.randomUUID(), data } });
  }

  async function importPlans(items: KeyedPlan[], revise: boolean) {
    if (!revise) { await savePlans(items, true); return; }
    const owned = plans.filter((plan) => plan.owner === me.id);
    const next = items.map(({ data }) => {
      const existing = owned.filter((plan) => plan.data.title === data.title.trim());
      if (existing.length !== 1) throw new Error("找不到唯一的现有计划「" + data.title + "」。更新未保存。");
      const [plan] = existing;
      return { id: plan.id, data: { ...data, date: plan.data.date, shared: plan.data.shared } };
    });
    if (new Set(next.map((item) => item.id)).size !== next.length) throw new Error("同一计划在这批文件里出现了多次。");
    const response = await post({ action: "plans", items: next, reviseExisting: true });
    const { revised } = await response.json() as { revised: number };
    await refresh(); setToast("已更新 " + revised + " 个现有计划");
  }

  function openTemplate(plan = planBlank(selected), id = crypto.randomUUID(), editing = false) {
    setConfirmRemoveTemplate(false);
    open({ kind: "template", item: { id, data: { ...plan, shared: false } }, editing });
  }

  function planExercise(choice: ExerciseChoice, row?: CatalogEntry) {
    setExercise(undefined); setWarning(""); setTargetPlan("");
    setPlanPick({ choice, row });
  }

  function applyPlanExercise() {
    if (!planPick) return;
    const move = defaultCatalogMove(planPick.choice, planPick.row);
    const plan = plans.find((item) => item.owner === me.id && item.id === targetPlan && item.data.exercises.length < 30);
    if (targetPlan && !plan) { setWarning("这个计划已更新，请重新选一个。"); return; }
    const next = plan ? { ...plan.data, exercises: [...plan.data.exercises, move] } : { ...planBlank(selected), title: move.name, exercises: [move] };
    setPlanPick(undefined);
    go("plans");
    if (plan) open({ kind: "editor", plan: { id: plan.id, data: next } });
    else newPlan(next);
  }

  async function savePlans(items: KeyedPlan[], skipExisting = false) {
    const clean = items.map((item) => ({ ...item, checked: cleanPlan(item.data) }));
    const broken = clean.findIndex((item) => !item.checked.success);
    if (broken >= 0) throw new Error("请检查第 " + (broken + 1) + " 个计划的名称、日期、动作和视频链接。");
    const ready = clean.flatMap((item) => item.checked.success ? [{ id: item.id, data: item.checked.data }] : []);
    if (viewer) {
      const reply = await post({ action: "plans", items: ready, skipExisting });
      await refresh();
      if (skipExisting) {
        const { added, skipped } = await reply.json() as { added: number; skipped: number };
        setToast("已导入 " + added + " 个计划" + (skipped ? "，跳过 " + skipped + " 个重复计划" : ""));
        return;
      }
    } else {
      setState((value) => ({ ...value, entries: [
        ...ready.map((item): Entry => ({ ...item, owner: me.id, kind: "plan", updated: new Date().toISOString() })),
        ...value.entries.filter((entry) => entry.owner !== me.id || !ready.some((item) => item.id === entry.id)),
      ] }));
    }
    setToast(demo ? "已添加到演示计划" : "计划已保存到云端");
  }

  function upsertLocalDraft(id: string, data: Session) {
    setPending({ ...pendingRef.current, [id]: data });
    setSync(demo ? "本机草稿" : "草稿待同步");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushDraft(id, data), 420);
  }

  function begin(item: KeyedPlan) {
    const existing = drafts.find(([, data]) => data.planId === item.id && data.date === today);
    const id = existing?.[0] ?? crypto.randomUUID();
    const data = existing ? resumeClock(refreshDraftPlan(existing[1], item.data)) : startSession(item.data, item.id, today);
    if (!existing || data !== existing[1]) upsertLocalDraft(id, data);
    else setSync(demo ? "本机草稿" : pendingDrafts[id] ? "草稿待同步" : "云端已保存");
    open({ kind: "session", id, data });
    trainingNav.enter(id);
  }

  function resumeDraft(id: string, data: Session) {
    const latest = plans.find((plan) => plan.id === data.planId && plan.owner === me.id);
    const next = resumeClock(refreshDraftPlan(data, latest?.data));
    if (next !== data) upsertLocalDraft(id, next);
    else setSync(demo ? "本机草稿" : pendingDrafts[id] ? "草稿待同步" : "云端已保存");
    open({ kind: "session", id, data: next });
    trainingNav.enter(id);
  }

  async function deleteRecord(id: string, kind: "plan" | "draft") {
    await act(async () => {
      if (kind === "draft") {
        deletedDrafts.current.add(id);
        await queue.current;
      }
      try {
        if (viewer) await post({ action: "delete", id, kind });
        if (kind === "draft") {
          const next = { ...pendingRef.current };
          delete next[id]; setPending(next);
        }
        setState((prev) => ({ ...prev, entries: prev.entries.filter((item) => item.id !== id || item.owner !== me.id) }));
        if (viewer) void refresh();
        setOverlay(null); setToast(kind === "draft" ? "草稿已删除" : "计划已删除");
      } catch (reason) {
        deletedDrafts.current.delete(id);
        throw reason;
      }
    });
  }

  async function finishSession(id: string, data: Session) {
    await act(async () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await queue.current;
      const now = Date.now();
      const ended = Math.max(data.started, Math.min(now, data.started + 86_400_000));
      const finalized = { ...pauseClock(data, now), date: asDate(now), ended, minutes: data.minutes || Math.min(720, Math.max(1, Math.round(workoutElapsed(data, now) / 60000))) };
      const saved = viewer
        ? await (await post({ action: "log", id, data: finalized })).json() as Pick<Log, "data" | "updated">
        : { data: finalized, updated: new Date().toISOString() };
      const next = { ...pendingRef.current };
      delete next[id]; setPending(next);
      const record: Entry = { id, owner: me.id, kind: "log", ...saved };
      setState((value) => ({ ...value, entries: [record, ...value.entries.filter((entry) => entry.owner !== me.id || entry.id !== id)] }));
      if (viewer) void refresh();
      setToast(demo ? "演示打卡完成" : "打卡完成，已上传云端");
      setOverlay({ kind: "log", log: record });
      trainingNav.leave();
    });
  }

  async function saveLogEdit(log: Log, data: Session) {
    const response = await post({ action: "editLog", id: log.id, revision: log.updated, data });
    const changes = await response.json() as Pick<Log, "data" | "updated">;
    const next = { ...log, ...changes };
    setState((value) => ({ ...value, entries: value.entries.map((item) => item.id === log.id && item.owner === me.id ? next : item) }));
    setOverlay((value) => value?.kind === "log" && value.log.id === log.id && value.log.owner === me.id ? { ...value, log: next } : value);
    setToast("训练记录已更新");
    void refresh();
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setToast(label); }
    catch { setToast("请长按文本手动复制。"); }
  }

  function planActions(item: KeyedPlan) {
    return viewer ? <PlanActions title={item.data.title} edit={() => open({ kind: "editor", plan: item })}
      move={() => open({ kind: "move", item })} saveTemplate={() => openTemplate(item.data)}
      remove={() => open({ kind: "delete", itemId: item.id, label: item.data.title, type: "plan" })} /> :
      <button className="button subtle small" onClick={() => open({ kind: "editor", plan: item })}>编辑</button>;
  }

  function renderPlan(item: KeyedPlan, i: number) {
    const own = plans.some((plan) => plan.id === item.id && plan.owner === me.id);
    return <div className="plan-line" key={item.id}>
      <span className={"tile " + (i % 2 ? "lilac" : "mint")}>{item.data.video ? <Play size={20} /> : <Dumbbell size={20} />}</span>
      <div><strong>{item.data.title}</strong><small>{shortDate(item.data.date)} · {item.data.category}{item.data.minutes ? " · " + item.data.minutes + " 分钟" : ""}{item.data.shared ? " · 共享" : ""}</small></div>
      <div className="plan-actions">{own && planActions(item)}<button className="button outline small" onClick={() => begin(item)}>开始</button></div>
    </div>;
  }

  const exerciseDialog = exercise && <ExerciseDetail key={exercise.catalogueId ?? exercise.name} choice={exercise} close={() => setExercise(undefined)}
    select={setExercise} profiles={profiles} names={exerciseNames} logs={logs} owner={me.id}
    save={(item) => library.save({ kind: "exercise", item })} addToPlan={trainingNav.id ? undefined : planExercise} />;

  if (trainingNav.id) {
    if (overlay?.kind === "session" && overlay.id === trainingNav.id && !completedWorkout) {
      return <><Workout key={overlay.id} onExercise={setExercise} data={overlay.data} trackProtein={trackProtein} close={() => { close(); trainingNav.leave(); }}
        update={(data) => { setOverlay({ ...overlay, data }); upsertLocalDraft(overlay.id, data); }}
        finish={() => void finishSession(overlay.id, overlay.data)} error={warning} pending={busy} sync={sync} />{exerciseDialog}</>;
    }
    return <TrainingNotice loading={!draftsReady || cloud === "正在连接" || Boolean(routeDraft)}
      finished={Boolean(completedWorkout)} onBack={trainingNav.leave}
      onDetails={() => {
        if (completedWorkout) open({ kind: "log", log: completedWorkout });
        trainingNav.leave();
      }} />;
  }

  const heading = view === "today" ? "今天练什么？" : navigation.find((item) => item.id === view)?.title;
  return <div className="app">
    <aside className="sidebar">
      <button className="brand" onClick={() => go("today")}><span className="brand-mark"><Dumbbell size={23} strokeWidth={2.5} /></span><span>训练搭子<small>SPOTTER CLUB</small></span></button>
      <nav aria-label="主导航" className="desktop-nav">
        {navigation.filter((item) => item.id !== "more").map(({ id, icon: Icon, title }) => <button className={id === view ? "active" : ""} aria-current={id === view ? "page" : undefined} key={id} onClick={() => go(id)}><Icon size={19} /><span>{title}</span>{id === view && <i />}</button>)}
      </nav>
      <button className="sidebar-pair" onClick={() => open({ kind: "pair" })}><span className="tile lilac"><Users size={19} /></span><span><strong>搭子空间</strong><small>{partner ? "查看搭子" : "邀请训练搭子"}</small></span><ChevronRight size={16} /></button>
      <div className="sidebar-footer"><span className="avatar lime">{avatar(me.name)}</span><div><strong>{me.name}</strong><small>{demo ? "演示账号" : "个人账号"}</small></div></div>
    </aside>
    <div className="stage">
      <header className="topbar">
        <div className="crumb"><span className="mini-mark"><Dumbbell size={18} /></span><span>训练搭子</span><span className="crumb-slash">/</span><strong>{navigation.find((item) => item.id === view)?.title}</strong></div>
        <div className="top-actions"><span className="cloud-status"><Cloud size={17} />{cloud}</span><button className="top-profile" onClick={() => open({ kind: "pair" })} aria-label="账号与搭子空间"><span className="avatar lime">{avatar(me.name)}</span><ChevronDown size={15} /></button></div>
      </header>
      <main className="content">
        <div className="page-heading">
          <div>{view === "today" && <p className="date-line"><CalendarDays size={16} /> {shortDate(today)} · 星期{weekdays[weekdayIndex(today)]}</p>}<h1>{heading}</h1>
            {view === "today" && <p>{demo ? "正在查看示例数据。登录后可同步你们的记录。" : "安排今天的训练，看看搭子练得怎么样。"}</p>}
            {view === "import" && <p>把聊天里的训练安排或视频链接变成可打卡的计划。</p>}
          </div>
          {view === "plans" && viewer && <button className="button outline page-action" disabled={library.loading || Boolean(library.error)} onClick={() => open({ kind: "schedule" })}><Settings2 size={18} /> 个人计划设置</button>}
          {(view === "today" || view === "plans") && <button className="button primary page-action" onClick={() => newPlan()}><Plus size={19} /> 新建计划</button>}
        </div>

        {view === "today" && <div className="today-grid">
          <div className="main-column">
            <section className="card week-card" aria-label="本周训练日期">
              <div className="section-head"><h2>训练日程</h2><div className="steppers"><button className="icon-button" onClick={() => setSelected(offsetDate(selected, -7))} aria-label="上一周"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => setSelected(offsetDate(selected, 7))} aria-label="下一周"><ChevronRight size={18} /></button></div></div>
              <div className="week-days">
                {weekdays.map((day, i) => {
                  const date = offsetDate(weekStart, i);
                  return <button key={day} aria-pressed={selected === date} aria-label={date + (blocked(schedule, date) ? "，休息" : "")} onClick={() => setSelected(date)}><span>周{day}</span><strong>{Number(date.slice(8))}</strong><span className="week-dot">{blocked(schedule, date) ? <small>休</small> : (plans.some((item) => item.data.date === date) || logs.some((log) => log.data.date === date)) && <i />}</span></button>;
                })}
              </div>
            </section>

            {blocked(schedule, selected) && <p className="muted">这天设为不安排训练。已有计划可移动到其他日期。</p>}
            <div className="section-head section-break"><h2>{selected === today ? "今日训练" : shortDate(selected) + "的训练"}</h2><button className="text-button" onClick={() => go("plans")}>全部计划 <ChevronRight size={15} /></button></div>
            {selected === today && drafts.length > 0 && <section className="card plan-list">{drafts.map(([id, data]) => <div className="plan-line" key={id}><span className="tile mint"><Clock3 size={19} /></span><div><strong>{data.plan.title}</strong><small>{sessionTotals(data).sets} 组完成 · {pendingDrafts[id] && !demo ? "待同步" : "训练草稿"}</small></div><div className="plan-actions"><button className="button outline small" onClick={() => resumeDraft(id, data)}>继续</button>
              <button className="icon-button" aria-label={"删除草稿 " + data.plan.title} onClick={() => open({ kind: "delete", itemId: id, label: data.plan.title, type: "draft" })}><Trash2 size={16} /></button></div></div>)}</section>}
            {trackProtein && selected === today && myToday.length > 0 && <section className="card padded">
              <h3>今日打卡</h3>
              {myToday.map((log) => <div className="protein-record" key={log.id}>
                <button className="text-button" type="button" onClick={() => open({ kind: "log", log })}>{log.data.plan.title}</button>
                <ProteinCheck checked={log.data.proteinShake === true}
                  save={(proteinShake) => saveLogEdit(log, { ...log.data, proteinShake })} />
              </div>)}
            </section>}
            {current ? <>
              <section className="hero">
                <div className="hero-content">
                  <span className="hero-tag"><span />{current.id === "example" ? "示例计划" : current.data.category}</span>
                  <h2>{current.data.title}</h2>
                  <div className="hero-meta">{current.data.minutes > 0 && <span><Clock3 size={16} /> {current.data.minutes} 分钟</span>}{current.data.exercises.length > 0 && <span><Dumbbell size={16} /> {current.data.exercises.length} 个动作</span>}{current.data.video && <span><Play size={16} /> 跟练视频</span>}</div>
                  <button className="button hero-button" onClick={() => begin(current)}><Play size={17} fill="currentColor" /> {current.id === "example" ? "试练示例" : "开始训练"}</button>
                </div>
              </section>
              {(current.data.durationNote || (current.id !== sample.id && plans.some((item) => item.id === current.id && item.owner === me.id))) &&
                <div className="card padded today-plan-actions"><p className="muted">{current.data.durationNote || "需要调整日期？"}</p>
                  {current.id !== sample.id && plans.some((item) => item.id === current.id && item.owner === me.id) && planActions(current)}</div>}
              {(todaysPlans.length > 1) && <section className="card plan-list">{todaysPlans.slice(1).map(renderPlan)}</section>}
              {current.data.exercises.length > 0 && <section className="card padded movement-card">
                <div className="section-head"><h2>动作清单</h2><span className="count-label">{current.data.exercises.length} 个动作</span></div>
                <PlanSequence plan={current.data} onExercise={setExercise} />
              </section>}
              {current.data.video && <section className="card padded"><VideoLink url={current.data.video} /></section>}
            </> : <section className="card empty-state"><span className="tile mint"><Dumbbell /></span><h3>{myToday.length && selected === today ? "今天已完成打卡" : "这天还没有安排"}</h3><button className="button outline small" onClick={() => newPlan()}>添加训练</button></section>}
          </div>

          <aside className="right-column">
            <section className="card padded partner-card">
              <div className="section-head"><h2>搭子动态</h2><span className="tile lilac"><Users size={18} /></span></div>
              <div className="partner-row"><span className="avatar lime">{avatar(me.name)}</span><div><strong>我</strong><small>{myToday.length ? myToday[0].data.plan.title : "今天还未打卡"}</small></div><span className={"state-tag " + (myToday.length ? "checked" : "")}>{myToday.length ? "已完成" : "待打卡"}</span></div>
              <div className="partner-row"><span className="avatar lilac">{partner ? avatar(partner.name) : <Users size={18} />}</span><div><strong>{partner?.name || "训练搭子"}</strong><small>{partnerToday.length ? partnerToday[0].data.plan.title : partner ? "今天还未打卡" : "等待配对"}</small></div><span className={"state-tag " + (partnerToday.length ? "checked" : "")}>{partnerToday.length ? "已完成" : partner ? "待打卡" : "未连接"}</span></div>
              {receivedCheer && <p className="cheer-note"><Flame size={16} /> 搭子今天给你加油了</p>}
              {latestPartner && partner && <button className="text-button partner-link" onClick={() => open({ kind: "log", log: latestPartner })}>最近一次打卡 <ChevronRight size={15} /></button>}
              <button className="button outline full" disabled={busy || sentCheer} onClick={() => partner && viewer ? void act(async () => { await post({ action: "cheer" }); await refresh(); setToast("已给搭子加油"); }) : open({ kind: "pair" })}>
                {partner && viewer ? <Flame size={16} /> : <Link2 size={16} />}{sentCheer ? "今天已加油" : partner && viewer ? "给搭子加油" : "连接训练搭子"}
              </button>
            </section>
            <section className="card padded activity-card">
              <div className="section-head"><h2>近 7 天</h2><button className="icon-button stat-link" aria-label="打开训练统计" onClick={() => go("stats")}><BarChart3 size={19} /></button></div>
              <div className="quick-stats"><div><strong>{recent.length}<small> 次</small></strong><span>训练打卡</span></div><div><strong>{recent.reduce((sum, entry) => sum + entry.data.minutes, 0)}<small> 分钟</small></strong><span>训练时长</span></div></div>
              <div className="mini-week">{Array.from({ length: 7 }, (_, i) => {
                const date = offsetDate(today, i - 6);
                const active = recent.some((log) => log.data.date === date);
                return <div key={date}><span className={active ? "on" : ""}>{active ? <Check size={13} /> : <i />}</span><small>{weekdays[weekdayIndex(date)]}</small></div>;
              })}</div>
            </section>
            <button className="import-callout" onClick={() => go("nutrition")}><span className="tile mint"><Utensils size={20} /></span><span><strong>饮食记录</strong><small>三餐、饮水和体重</small></span><ChevronRight size={18} /></button>
            <button className="import-callout" onClick={() => go("import")}><span className="tile lilac"><Sparkles size={20} /></span><span><strong>从聊天导入</strong><small>GPT、Claude 或跟练视频</small></span><ChevronRight size={18} /></button>
            {warning && !overlay && <p className="inline-error" role="alert">{warning}</p>}
          </aside>
        </div>}

        {view === "plans" && <PlanSections key={planTab ?? "plans"} date={selected} templates={templates} initial={planTab}
          schedule={newPlan} newTemplate={() => openTemplate()} edit={(row) => openTemplate(row.plan, row.id, true)}><section className="card padded">
          <div className="section-head"><h2>全部计划</h2><button className="button subtle small" onClick={() => go("import")}><Sparkles size={17} /> 导入计划</button></div>
          {plans.length ? [...plans].sort((a, b) => a.data.date.localeCompare(b.data.date)).map(renderPlan) : <div className="empty-state"><span className="tile mint"><ClipboardList size={22} /></span><h3>还没有训练计划</h3><button className="button outline small" onClick={() => newPlan(examples(today))}>使用示例计划</button></div>}
        </section></PlanSections>}
        {(view === "plans" || view === "exercises") && library.error && <button className="button outline small" onClick={() => void library.load()}>{library.error}</button>}
        {view === "exercises" && <OpenGymCatalogue names={exerciseNames} profiles={profiles} choose={setExercise} quick={planExercise} />}
        {view === "nutrition" && <NutritionView enabled={Boolean(viewer)} today={today} />}
        {view === "body" && <BodyView enabled={Boolean(viewer)} today={today} />}
        {view === "data" && <DataView enabled={Boolean(viewer)} saved={() => { void refresh(); void library.load(); }} importPlans={() => go("import")} />}
        {view === "more" && <section className="card padded feature-stack">
          {navigation.filter((item) => !item.mobile).map(({ id, icon: Icon, title }) =>
            <button key={id} className="list-line" type="button" onClick={() => go(id)}><span className="tile mint"><Icon size={18} /></span><strong>{title}</strong><ChevronRight size={16} /></button>)}
          <button className="list-line" type="button" onClick={() => open({ kind: "pair" })}><span className="tile mint"><Users size={18} /></span><strong>账号与搭子空间</strong><ChevronRight size={16} /></button>
        </section>}

        {view === "history" && <History today={today} self={me.id} partner={partner?.name} logs={logs} show={(log) => open({ kind: "log", log })} />}
        {view === "stats" && <Stats today={today} self={me.id} partner={partner ?? null} logs={logs} onExercise={setExercise}
          pinned={library.rows.find((item) => item.kind === "stats-pins")?.ids}
          savePins={viewer ? (ids) => library.save({ kind: "stats-pins", ids }) : undefined} />}

        <div hidden={view !== "import"}><ImportView today={today} save={importPlans} canRevise={Boolean(viewer)} saved={() => go("plans")} notify={setToast} /></div>
      </main>
    </div>
    <nav aria-label="底部导航" className="mobile-nav">{navigation.filter((item) => item.mobile).map(({ id, icon: Icon, mobile }) => <button key={id} className={view === id ? "active" : ""} aria-current={id === view ? "page" : undefined} onClick={() => go(id)}><Icon size={21} /><span>{mobile}</span></button>)}</nav>
    {overlay?.kind === "editor" && <Dialog title={plans.some((plan) => plan.id === overlay.plan.id && plan.owner === me.id) ? "编辑计划" : "新建计划"} onClose={close}>
      <form onSubmit={(e) => { e.preventDefault(); const item = overlay.plan; void act(async () => { await savePlans([item]); setSelected(item.data.date); setOverlay(null); }); }}>
        <div className="dialog-body"><PlanFields value={overlay.plan.data} change={(data) => setOverlay({ kind: "editor", plan: { ...overlay.plan, data } })} />{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
        <div className="dialog-footer"><button type="button" className="button outline" onClick={close} disabled={busy}>取消</button><button className="button primary" disabled={busy}><Check size={18} /> 保存计划</button></div>
      </form>
    </Dialog>}
    {overlay?.kind === "schedule" && <ScheduleSettings settings={schedule} close={close} save={async (values) => {
      await library.save({ kind: "schedule", values }); setToast("计划设置已保存");
    }} />}
    {overlay?.kind === "move" && <MovePlan item={overlay.item} settings={schedule} close={close} save={async (date, shift) => {
      const response = await post({ action: "move", id: overlay.item.id, from: overlay.item.data.date, date, shift });
      const { moved } = await response.json() as { moved: number };
      await refresh(); setSelected(date); setToast(moved > 1 ? "已顺延 " + moved + " 个计划" : "训练已移动");
    }} />}
    {overlay?.kind === "delete" && <Dialog title={overlay.type === "plan" ? "删除训练计划" : "删除训练草稿"} onClose={close}>
      <div className="dialog-body feature-stack"><p>确定删除「{overlay.label}」？{overlay.type === "plan" ? "已打卡的历史仍可查看。" : "这次尚未打卡的组记录会一同删除。"}</p>{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
      <div className="dialog-footer"><button className="button outline" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy} onClick={() => void deleteRecord(overlay.itemId, overlay.type)}>确认删除</button></div>
    </Dialog>}
    {overlay?.kind === "template" && <Dialog title={overlay.editing ? "编辑模板" : "保存训练模板"} onClose={close}>
      <form onSubmit={(event) => { event.preventDefault(); const { id, data } = overlay.item; void act(async () => {
        const parsed = cleanPlan(data);
        if (!parsed.success) throw new Error("请检查模板名称、日期、动作或视频。");
        await library.save({ kind: "template", id, plan: { ...parsed.data, shared: false } });
        setOverlay(null); go("plans"); setPlanTab("个人模板"); setToast("模板已保存");
      }); }}>
        <div className="dialog-body"><PlanFields template value={overlay.item.data} change={(data) => setOverlay({ ...overlay, item: { ...overlay.item, data } })} />{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
        <div className="dialog-footer">{overlay.editing && <button type="button" className="button outline" disabled={busy} onClick={() => {
          if (!confirmRemoveTemplate) { setConfirmRemoveTemplate(true); return; }
          void act(async () => { await library.remove("template", overlay.item.id); setOverlay(null); setToast("模板已删除"); });
        }}>{confirmRemoveTemplate ? "确认删除" : "删除模板"}</button>}
          <button className="button primary" disabled={busy}><Check size={18} /> 保存模板</button></div>
      </form>
    </Dialog>}
    {exerciseDialog}
    {planPick && <Dialog title="加入训练计划" onClose={() => setPlanPick(undefined)}>
      <form className="dialog-body form-fields" onSubmit={(event) => { event.preventDefault(); applyPlanExercise(); }}>
        <p>{planPick.choice.name}</p>
        <label>选择训练计划<select value={targetPlan} onChange={(event) => setTargetPlan(event.target.value)}>
          <option value="">新建训练计划</option>
          {plans.filter((item) => item.owner === me.id && item.data.exercises.length < 30)
            .sort((a, b) => a.data.date.localeCompare(b.data.date))
            .map((item) => <option value={item.id} key={item.id}>{item.data.date} · {item.data.title}</option>)}
        </select></label>
        {warning && <p className="inline-error" role="alert">{warning}</p>}
        <button className="button primary"><Plus size={17} /> 加入并编辑</button>
      </form>
    </Dialog>}
    {overlay?.kind === "log" && <LogDetail log={overlay.log} close={close} own={Boolean(viewer && overlay.log.owner === me.id)} whoop={overlay.whoop} today={today} trackProtein={trackProtein}
      share={viewer && overlay.log.owner === me.id ? { name: me.name, owner: me.id, logs } : undefined}
      onEdit={viewer && overlay.log.owner === me.id ? (data) => saveLogEdit(overlay.log, data) : undefined}
      onTemplate={viewer && overlay.log.owner === me.id ? () => openTemplate(overlay.log.data.plan) : undefined} />}
    {overlay?.kind === "pair" && <Dialog title="搭子空间" onClose={close}>
      <div className="dialog-body form-fields">
        {demo ? <><p className="muted">用 ChatGPT 账号登录后，你可以创建搭子空间，也可以输入对方的邀请码。配对后会互相看到打卡和共享计划。</p><a className="button primary" target="_top" href="/signin-with-chatgpt?return_to=%2F"><LogIn size={18} /> 登录</a></> :
          partner ? <div className="partner-row"><span className="avatar lilac">{avatar(partner.name)}</span><div><strong>{partner.name}</strong><small>配对成功，可以查看对方的打卡和共享计划。</small></div><span className="state-tag checked">已连接</span></div> :
          room?.invite ? <><p className="muted">把邀请码发给搭子。对方需要先有网站访问权限，再登录并输入邀请码。</p><input aria-label="搭子邀请码" value={room.invite} readOnly onFocus={(e) => e.target.select()} /><button className="button primary" onClick={() => void copy(room.invite!, "已复制邀请码")}><Copy size={17} /> 复制邀请码</button></> :
          <><p className="muted">配对后，你们可以互相查看训练记录、共享计划和加油。</p><button className="button primary" disabled={busy} onClick={() => void act(async () => { await post({ action: "create" }); await refresh(); })}><Users size={18} /> 创建搭子空间</button>
            <form className="form-fields join-form" onSubmit={(e) => { e.preventDefault(); void act(async () => { await post({ action: "join", invite: invite.trim().toLowerCase() }); await refresh(); setInvite(""); setToast("搭子已连接"); }); }}><label>已有邀请码<input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="粘贴搭子的邀请码" autoCapitalize="none" spellCheck={false} /></label><button className="button outline" disabled={busy || !/^[a-fA-F0-9]{32}$/.test(invite.trim())}>加入搭子空间</button></form></>}
        {warning && <p className="inline-error" role="alert">{warning}</p>}
        {viewer && <ProteinCheck label="显示蛋白粉打卡" checked={trackProtein}
          disabled={library.loading} save={(enabled) => library.save({ kind: "protein-preference", enabled })} />}
        {viewer && <a className="text-button sign-out" href="/signout-with-chatgpt?return_to=%2F" target="_top">退出 {me.name} 的账号</a>}
      </div>
    </Dialog>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
  </div>;
}
