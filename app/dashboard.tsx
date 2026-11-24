"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BarChart3, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3,
  Bookmark, CalendarClock, Copy, Dumbbell, GraduationCap, House, LogIn, Play, Plus, Settings, Sparkles, Trash2, Utensils, Users,
} from "lucide-react";
import {
  asDate, examples, offsetDate, planBlank, sessionTotals, startFreeSession, startSession,
  type Entry, type Plan, type Session, type State,
} from "./workout";
import {
  cleanPlan, Dialog, draftsOrLogs, History, LogDetail, PlanFields, shortDate, Stats, VideoLink, weekdayIndex, weekdays,
  type Log,
} from "./panels";
import { useTrainingNavigation } from "@/features/training/navigation";
import { TrainingNotice } from "@/features/training/training-notice";
import { Workout } from "@/features/training/workout";
import { buildLoadHistory } from "@/features/training/load-progression";
import { seedSessionLoads } from "@/features/training/workout-loads";
import { TrainingLaunch } from "@/features/training/training-launch";
import type { FreeWorkoutKind } from "@/features/training/model";
import { ProteinCheck } from "@/features/training/protein-check";
import type { ProteinProduct } from "@/features/training/protein";
import { PairToday } from "@/features/pair/pair-today";
import { DisconnectPair } from "@/features/pair/disconnect-pair";
import { WeekCheckins } from "@/features/pair/week-checkins";
import { PlanAssistant } from "@/features/import/plan-assistant";
import type { PlanAssistantMode } from "@/features/ai-coach/mode-tabs";
import { readActivitySummary } from "@/features/ai-coach/activity-summary";
import { CoachSheet, type CoachSheetSize } from "@/features/ai-coach/coach-sheet";
import { ImportView } from "@/features/import/import-view";
import type { WhoopStatus } from "@/features/heart/whoop";
import { ExerciseDetail } from "@/features/exercises/exercise-view";
import { AnatomySubject } from "@/features/exercises/anatomy";
import { OpenGymCatalogue } from "@/features/exercises/open-gym-catalogue";
import { defaultCatalogMove } from "@/features/exercises/exercise-picker";
import type { CatalogEntry, ExerciseChoice } from "@/features/exercises/open-gym";
import { NutritionView, mealForNow } from "@/features/nutrition/nutrition-view";
import { CoachMealPhoto, type CoachMealRequest } from "@/features/nutrition/meal-editor";
import { HomeNutrition } from "@/features/nutrition/home-nutrition";
import { useNutritionPreferences } from "@/features/nutrition/nutrition-preferences";
import type { NutritionShortcut } from "@/features/nutrition/nutrition-summary";
import { FriendsView } from "@/features/friends/friends-view";
import { planCompletions } from "@/features/plans/completion";
import { PlanSections } from "@/features/plans/plan-sections";
import { planDisplayTitle, planWeekDay } from "@/features/plans/scheduled-title";
import { withoutTemplateLink } from "@/features/plans/template-link";

import { useLibrary } from "@/features/library/use-library";
import { PlanActions } from "@/features/plans/plan-actions";
import { MovePlan, ScheduleSettings } from "@/features/plans/schedule-view";
import { blocked, openSchedule, type MovePreview, type Schedule } from "@/features/plans/schedule";
import { pauseClock, resumeClock } from "@/features/training/clock";
import { finalizeCheckin, mergePendingCheckins, type CheckinReceipt, type CheckinUpload, type QueuedCheckin } from "@/features/training/checkin-outbox";
import { useCheckinOutbox } from "@/features/training/use-checkin-outbox";
import { refreshDraftPlan } from "@/features/training/refresh-plan";
import { parsePlanMove } from "@/features/exercises/move-name";
import { PlanSequence } from "@/features/training/plan-sequence";
import { BodyView } from "@/features/body/body-view";
import { DataView } from "@/features/data/data-view";
import { ProgramView } from "@/features/programs/program-view";
import { CoachingView } from "@/features/coaching/coaching-view";
import { AgentPack } from "@/features/agent/agent-pack";
import { useDisplayPreferences } from "@/features/settings/display-preferences";
import { SettingsHub, SettingsLink, SettingsRows, type SettingsPage } from "@/features/settings/settings-hub";
import { SettingsContent } from "@/features/settings/settings-content";
import { ProteinWarehouse } from "@/features/settings/protein-warehouse";
import { useWorkoutReminder } from "@/features/settings/reminders";

type View = "today" | "plans" | "programs" | "assistant" | "coaching" | "stats" | "friends" | "nutrition" | "body" | "data" | "settings";
type KeyedPlan = { id: string; data: Plan; revision?: string };
type Overlay = { kind: "pair" | "launch" | "friend-sharing" } |
  { kind: "schedule"; restDay?: string; settings: Schedule; revision: string | null } |
  { kind: "move"; item: PlanEntry } |
  { kind: "delete"; itemId: string; label: string; type: "plan" | "draft"; revision?: string } |
  { kind: "editor"; plan: KeyedPlan } | { kind: "template"; item: KeyedPlan; editing?: boolean } |
  { kind: "session"; id: string; data: Session } | { kind: "log"; log: Log; whoop?: WhoopStatus };
type PlanEntry = Extract<Entry, { kind: "plan" }>;
const primaryTabs = [
  { id: "today", label: "今日", icon: House },
  { id: "plans", label: "训练", icon: Dumbbell },
  { id: "stats", label: "统计", icon: BarChart3 },
  { id: "friends", label: "好友", icon: Users },
] as const;
const pageTitles: Partial<Record<View, string>> = {
  programs: "训练周期", friends: "好友",
  coaching: "教练与学员", body: "身体数据", data: "数据导出与导入", settings: "设置",
};
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

async function uploadCheckin(body: CheckinUpload): Promise<CheckinReceipt> {
  const response = await post({ action: "log", ...body });
  return response.json();
}

const message = (reason: unknown, fallback: string) =>
  reason instanceof Error && reason.name === "Error" ? reason.message : fallback;

export default function Dashboard({ viewer, initialDate, initialWorkoutId, heartReturn, profileRef }: {
  viewer: State["me"] | null; initialDate: string; initialWorkoutId?: string; heartReturn?: { id: string; result: WhoopStatus }; profileRef?: string;
}) {
  const [today, setToday] = useState(initialDate);
  const [selected, setSelected] = useState(initialDate);
  const [view, setView] = useState<View>(heartReturn ? "stats" : "today");
  const [settingsPage, setSettingsPage] = useState<SettingsPage>();
  const { display, changeDisplay } = useDisplayPreferences();
  const { preferences: nutritionPreferences, update: updateNutrition } = useNutritionPreferences(viewer?.id ?? "guest", !display.nutrition);
  const orderedNutritionShortcuts: NutritionShortcut[] = [...nutritionPreferences.mealOrder, "饮水", "体重"];
  const homeNutritionShortcuts = orderedNutritionShortcuts.filter((shortcut) => nutritionPreferences.homeShortcuts.includes(shortcut));
  const [nutritionShortcut, setNutritionShortcut] = useState<NutritionShortcut>();
  const [nutritionStartDate, setNutritionStartDate] = useState<string>();
  const nutritionToggle = useRef<HTMLButtonElement>(null);
  const focusNutritionToggle = useRef(false);
  const [assistantMode, setAssistantMode] = useState<PlanAssistantMode>("coach");
  const [coachSheet, setCoachSheet] = useState<CoachSheetSize>();
  const [assistantMeal, setAssistantMeal] = useState<CoachMealRequest & { fromCoach: boolean }>();
  const [assistantMealResult, setAssistantMealResult] = useState<{ id: string; owner: string; message: string }>();
  const assistantOrigin = useRef<{ view: View; setting?: SettingsPage }>({ view: "plans" });
  const [statsTab, setStatsTab] = useState<"overview" | "history">(heartReturn ? "history" : "overview");
  const [friendFocus, setFriendFocus] = useState<{ id: string; date: string }>();
  const [exerciseSelection, setExerciseSelection] = useState<{ choice: ExerciseChoice; owner?: string }>();
  const exercise = exerciseSelection?.choice;
  const setExercise = (choice?: ExerciseChoice) => setExerciseSelection(choice ? { choice } : undefined);
  const [planPick, setPlanPick] = useState<{ choice: ExerciseChoice; row?: CatalogEntry }>();
  const [targetPlan, setTargetPlan] = useState("");
  const [planTab, setPlanTab] = useState<"个人模板">();
  const [planStatus, setPlanStatus] = useState<"pending" | "completed">("pending");
  const [confirmRemoveTemplate, setConfirmRemoveTemplate] = useState(false);
  const library = useLibrary(Boolean(viewer));
  const proteinFoods = useLibrary(Boolean(viewer && view === "settings" && settingsPage === "proteinWarehouse"), today);
  const reloadLibrary = library.load;
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

  useEffect(() => {
    if (!focusNutritionToggle.current) return;
    nutritionToggle.current?.focus({ preventScroll: true });
    focusNutritionToggle.current = false;
  }, [nutritionPreferences.collapsed]);

  useEffect(() => {
    const openFriendInvite = () => {
      if (/^#friend-invite=[a-f0-9]{32}$/i.test(window.location.hash)) setView("friends");
    };
    openFriendInvite();
    window.addEventListener("hashchange", openFriendInvite);
    return () => window.removeEventListener("hashchange", openFriendInvite);
  }, []);

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
      if (generation !== refreshId.current) return;
      if (next.me.id !== viewer.id) {
        setCloud("登录账号已切换");
        return;
      }
      setState(next);
      setCloud("云端已连接");
    } catch {
      if (generation === refreshId.current) setCloud("云端连接异常");
    }
  }, [viewer]);

  const receiveCheckin = useCallback((record: QueuedCheckin) => {
    if (record.owner !== viewer?.id) return;
    ++refreshId.current;
    setState((value) => ({ ...value, entries: [record,
      ...value.entries.filter((entry) => entry.owner !== record.owner || entry.id !== record.id)] }));
    setOverlay((value) => value?.kind === "log" && value.log.owner === record.owner && value.log.id === record.id
      ? { ...value, log: record } : value);
    setToast("打卡已同步到云端");
    void refresh();
  }, [viewer?.id, refresh]);
  const { pending: pendingCheckins, enqueue: enqueueCheckin, has: hasQueuedCheckin } =
    useCheckinOutbox(viewer?.id, uploadCheckin, receiveCheckin, refresh);

  const flushDraft = useCallback((id: string, data: Session) => {
    if (!viewer) { setSync("本机草稿"); return; }
    queue.current = queue.current.then(async () => {
      if (!navigator.onLine || hasQueuedCheckin(id) || deletedDrafts.current.has(id) || pendingRef.current[id] !== data) return;
      setSync("正在保存");
      try {
        await post({ action: "draft", id, data, expectedOwner: viewer.id });
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
  }, [viewer, setPending, refresh, hasQueuedCheckin]);

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
    const wake = () => { void refresh(); void reloadLibrary(); retry(); setToday(asDate()); };
    const regainVisibility = () => { if (document.visibilityState === "visible") wake(); };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", regainVisibility);
    return () => {
      clearInterval(timer);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", regainVisibility);
    };
  }, [draftKey, flushDraft, refresh, reloadLibrary, setPending]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const { me, room } = state;
  const entries = useMemo(() => mergePendingCheckins(state.entries, pendingCheckins, me.id), [state.entries, pendingCheckins, me.id]);
  const pendingLog = overlay?.kind === "log" && pendingCheckins.some((item) => item.owner === overlay.log.owner && item.id === overlay.log.id);
  useEffect(() => {
    if (!returnToLog || cloud !== "云端已连接") return;
    const log = entries.find((entry): entry is Log => entry.kind === "log" && entry.owner === me.id && entry.id === returnToLog.id);
    if (log) setOverlay({ kind: "log", log, whoop: returnToLog.result });
    setReturnToLog(undefined);
    window.history.replaceState(window.history.state, "", "/");
  }, [returnToLog, entries, cloud, me.id]);

  const partner = room?.partner;
  const partnerWithDetails = room?.partnerTrainingShared === false ? null : partner;
  const demo = !viewer;
  const logs = useMemo(() => entries.filter(draftsOrLogs).filter((entry) => entry.kind === "log"), [entries]);
  const ownNutritionLogs = useMemo(() => logs.filter((log) => log.owner === viewer?.id), [logs, viewer?.id]);
  const loadDate = overlay?.kind === "session" ? overlay.data.date : today;
  const loadHistory = useMemo(() => buildLoadHistory(logs.filter((log) => log.data.date <= loadDate), me.id), [logs, loadDate, me.id]);
  const plans = entries.filter((entry): entry is PlanEntry => entry.kind === "plan");
  const completions = planCompletions(logs);
  const completionFor = (item: PlanEntry) => completions.get(item.owner)?.get(item.id);
  const pendingPlans = plans.filter((item) => !completionFor(item));
  const completedPlans = plans.filter(completionFor);
  const visiblePlans = planStatus === "completed"
    ? completedPlans.sort((a, b) => (completionFor(b)?.data.date ?? b.data.date).localeCompare(completionFor(a)?.data.date ?? a.data.date))
    : [...pendingPlans].sort((a, b) => a.data.date.localeCompare(b.data.date));
  const myDrafts = entries.filter(draftsOrLogs).filter((entry) => entry.kind === "draft" && entry.owner === me.id);
  const drafts = [...Object.entries(pendingDrafts), ...myDrafts.filter((item) => !pendingDrafts[item.id]).map((item) => [item.id, item.data] as const)]
    .filter(([id]) => !logs.some((log) => log.owner === me.id && log.id === id));
  const routeDraft = drafts.find(([id]) => id === trainingNav.id);
  const completedWorkout = logs.find((log) => log.owner === me.id && log.id === trainingNav.id);
  const profiles = library.rows.filter((item) => item.kind === "exercise").map(({ item }) => item);
  const templates = library.rows.filter((item) => item.kind === "template");
  const trackProtein = Boolean(viewer && library.rows.find((item) => item.kind === "protein-preference")?.enabled);
  const proteinWarehouse = viewer ? library.rows.find((item) => item.kind === "protein-warehouse") : undefined;
  const proteinProducts = proteinWarehouse?.products ?? [];
  const scheduleRow = library.rows.find((item) => item.kind === "schedule");
  const schedule = scheduleRow?.values ?? openSchedule;
  const exerciseNames = [
    ...plans.filter((plan) => plan.owner === me.id).flatMap((plan) => plan.data.exercises.map((item) => item.name)),
    ...logs.filter((log) => log.owner === me.id).flatMap((log) => log.data.plan.exercises.map((item) => item.name)),
  ].map((name) => parsePlanMove(name).name);
  const todaysPlans = pendingPlans.filter((item) => item.data.date === selected)
    .sort((a, b) => Number(b.owner === me.id) - Number(a.owner === me.id));
  const selectedPlanCompletions = completedPlans.filter((item) => item.data.date === selected);
  const latestPartner = logs.filter((log) => log.owner === partner?.id && log.data.date <= today).sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
  const partnerLastDay = room?.partnerCheckins?.reduce((last, day) => day.count > 0 && day.date <= today && day.date > last ? day.date : last, "") || latestPartner?.data.date;
  const myToday = logs.filter((log) => log.owner === me.id && log.data.date === today);
  const partnerToday = logs.filter((log) => log.owner === partner?.id && log.data.date === today);
  const buddyStatus = demo ? "signed-out" : cloud === "正在连接" ? "loading" : cloud === "云端已连接" ? "ready" : "offline";
  const current = todaysPlans[0];
  const canManageToday = current?.owner === me.id;
  const sentCheer = entries.some((entry) => entry.kind === "cheer" && entry.owner === me.id && entry.data.date === today);
  const receivedCheer = entries.some((entry) => entry.kind === "cheer" && entry.owner === partner?.id && asDate(Date.parse(entry.updated)) === today);
  const sundayFirst = display.firstWeekday === "sunday";
  const weekStart = offsetDate(selected, -((weekdayIndex(selected) + Number(sundayFirst)) % 7));
  const weekDays = sundayFirst ? [weekdays[6], ...weekdays.slice(0, 6)] : weekdays;
  const weekEnd = offsetDate(weekStart, 6);
  const weeklyCheckins = logs.filter((item) => item.owner === me.id && item.data.date >= weekStart && item.data.date <= weekEnd).length;
  useWorkoutReminder({ owner: viewer?.id ?? "", today,
    scheduled: !trainingNav.id && !overlay && pendingPlans.some((item) => item.owner === me.id && item.data.date === today), notify: setToast });
  const latestOwnWorkout = logs.find((item) => item.owner === me.id && item.data.date <= today);

  const go = (next: View) => {
    setCoachSheet(undefined);
    setAssistantMeal(undefined);
    setView(next === "data" ? "settings" : next);
    if (next === "settings" || next === "data") setSettingsPage(next === "data" ? "data" : undefined);
    setPlanTab(undefined);
    if (next === "plans" && view !== "plans") setPlanStatus("pending");
    setWarning("");
    setFriendFocus(undefined);
    if (next === "stats" && view !== "stats") setStatsTab("overview");
    window.scrollTo({ top: 0 });
  };
  function openSetting(page?: SettingsPage) {
    setSettingsPage(page);
    window.scrollTo({ top: 0 });
  }
  function openNutrition(shortcut?: NutritionShortcut) {
    setNutritionShortcut(shortcut);
    setNutritionStartDate(undefined);
    go("nutrition");
  }
  function toggleNutrition(collapsed: boolean) {
    focusNutritionToggle.current = true;
    updateNutrition({ collapsed });
  }
  function openPlanAssistant(mode: PlanAssistantMode) {
    if (view !== "assistant") assistantOrigin.current = { view, setting: settingsPage };
    setAssistantMode(mode);
    go("assistant");
  }
  function changeAssistantMode(mode: PlanAssistantMode) {
    if (mode === assistantMode) return;
    setAssistantMode(mode);
    window.scrollTo({ top: 0 });
  }
  function openMealPhoto(date = asDate(), meal = mealForNow()) {
    if (!viewer) return;
    setNutritionStartDate(date);
    setNutritionShortcut(undefined);
    const fromCoach = view === "assistant" || Boolean(coachSheet);
    if (fromCoach) {
      setAssistantMode("coach");
      if (coachSheet) setCoachSheet("full");
    } else openPlanAssistant("coach");
    setAssistantMeal({ date, meal, owner: viewer.id, id: crypto.randomUUID(), fromCoach });
  }
  function leavePlanAssistant() {
    const { view: previous, setting } = assistantOrigin.current;
    go(previous);
    if (previous === "settings") setSettingsPage(setting);
  }
  function showBuddy(date = partnerLastDay || today) {
    if (!partner) return;
    go("friends");
    setFriendFocus({ id: partner.id, date });
  }
  const open = (next: Overlay) => { setWarning(""); setOverlay(next); };
  const openScheduleSettings = (restDay?: string) =>
    open({ kind: "schedule", restDay, settings: schedule, revision: scheduleRow?.updated ?? null });
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
    setPlanStatus("pending");
    open({ kind: "editor", plan: { id: crypto.randomUUID(), data } });
  }

  async function importPlans(items: KeyedPlan[], revise: boolean) {
    if (!revise) { await savePlans(items, true); return; }
    if (!viewer) throw new Error("请先登录训练搭子。");
    const owned = plans.filter((plan) => plan.owner === me.id);
    const next = items.map(({ data }) => {
      const existing = owned.filter((plan) => plan.data.title === data.title.trim());
      if (existing.length !== 1) throw new Error("找不到唯一的现有计划「" + data.title + "」。更新未保存。");
      const [plan] = existing;
      return { id: plan.id, revision: plan.updated, data: { ...data, date: plan.data.date, shared: plan.data.shared } };
    });
    if (new Set(next.map((item) => item.id)).size !== next.length) throw new Error("同一计划在这批文件里出现了多次。");
    const response = await post({ action: "plans", items: next, reviseExisting: true, expectedOwner: viewer.id });
    const { revised } = await response.json() as { revised: number };
    await refresh(); setToast("已更新 " + revised + " 个现有计划");
  }

  function openTemplate(plan = planBlank(selected), id = crypto.randomUUID(), revision?: string) {
    setConfirmRemoveTemplate(false);
    open({ kind: "template", item: { id, revision, data: { ...withoutTemplateLink(plan), title: planDisplayTitle(plan), shared: false } },
      editing: Boolean(revision) });
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
    const next = plan ? { ...plan.data, templateId: undefined, exercises: [...plan.data.exercises, move] }
      : { ...planBlank(selected), title: move.name, exercises: [move] };
    setPlanPick(undefined);
    go("plans");
    if (plan) open({ kind: "editor", plan: { id: plan.id, data: next, revision: plan.updated } });
    else newPlan(next);
  }

  async function savePlans(items: KeyedPlan[], skipExisting = false, announce = true) {
    const clean = items.map((item) => ({ ...item, checked: cleanPlan(item.data) }));
    const broken = clean.findIndex((item) => !item.checked.success);
    if (broken >= 0) throw new Error("请检查第 " + (broken + 1) + " 个计划的名称、日期、动作和视频链接。");
    const ready = clean.flatMap((item) => item.checked.success ? [{ id: item.id, data: item.checked.data, revision: item.revision }] : []);
    if (viewer) {
      const reply = await post({ action: "plans", items: ready, skipExisting, expectedOwner: viewer.id });
      await refresh();
      if (skipExisting) {
        const { added, skipped } = await reply.json() as { added: number; skipped: number };
        if (announce) setToast("已导入 " + added + " 个计划" + (skipped ? "，跳过 " + skipped + " 个重复计划" : ""));
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

  function begin(item?: PlanEntry, kind?: FreeWorkoutKind) {
    const completion = item && completionFor(item);
    if (completion) {
      open({ kind: "log", log: completion });
      return;
    }
    const existing = item && drafts.find(([, data]) => data.planId === item.id && data.date === today);
    const id = existing?.[0] ?? crypto.randomUUID();
    const data = item
      ? existing
        ? resumeClock(refreshDraftPlan(existing[1], item.data))
        : seedSessionLoads(startSession({ ...item.data, title: planDisplayTitle(item.data) }, item.id, today), loadHistory)
      : startFreeSession(today, kind);
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

  async function deleteRecord(id: string, kind: "plan" | "draft", revision?: string) {
    await act(async () => {
      if (kind === "draft") {
        deletedDrafts.current.add(id);
        await queue.current;
      }
      try {
        if (viewer) await post({ action: "delete", id, kind, revision });
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
      const receipt = finalizeCheckin(pendingRef.current[id] ?? data);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      let record: QueuedCheckin = { id, owner: me.id, kind: "log", ...receipt };
      let queued = false;
      if (viewer) {
        try {
          record = enqueueCheckin(id, receipt);
          queued = true;
        } catch (reason) {
          if (!navigator.onLine) throw reason;
          const saved = await uploadCheckin({ expectedOwner: viewer.id, id, data: receipt.data });
          record = { ...record, ...saved };
        }
      }
      const next = { ...pendingRef.current };
      delete next[id];
      setPending(next);
      if (!queued) {
        setState((value) => ({ ...value, entries: [record,
          ...value.entries.filter((entry) => entry.owner !== me.id || entry.id !== id)] }));
        if (viewer) void refresh();
      }
      setToast(demo ? "演示打卡完成" : queued
        ? navigator.onLine ? "打卡已在本机保存，正在同步" : "离线打卡已保存，联网后自动同步"
        : "打卡已同步到云端");
      setOverlay({ kind: "log", log: record });
      trainingNav.leave();
    });
  }

  async function saveProteinProducts(products: ProteinProduct[]) {
    if (!viewer) throw new Error("登录后可以保存蛋白粉。");
    try {
      await library.save({ kind: "protein-warehouse", products }, proteinWarehouse?.updated ?? null, viewer.id);
    } catch (reason) {
      await library.load();
      throw reason;
    }
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

  function planActions(item: PlanEntry) {
    const editable = { id: item.id, data: item.data, revision: item.updated };
    return viewer ? <PlanActions title={item.data.title} edit={() => open({ kind: "editor", plan: editable })}
      move={() => open({ kind: "move", item })} saveTemplate={() => openTemplate(item.data)}
      remove={() => open({ kind: "delete", itemId: item.id, label: item.data.title, type: "plan", revision: item.updated })} /> :
      <button className="button subtle small" onClick={() => open({ kind: "editor", plan: editable })}>编辑</button>;
  }

  function renderPlan(item: PlanEntry, i: number) {
    const own = item.owner === me.id;
    const completion = completionFor(item);
    const weekDay = planWeekDay(item.data);
    const fromTemplate = own && templates.some((row) => row.id === item.data.templateId);
    return <div className="plan-line" key={item.owner + ":" + item.id}>
      <span className={"tile " + (i % 2 ? "lilac" : "mint")}>{completion ? <Check size={20} /> : item.data.video ? <Play size={20} /> : <Dumbbell size={20} />}</span>
      <div><strong>{planDisplayTitle(item.data)}</strong><small>{[shortDate(item.data.date), weekDay, item.data.category,
        item.data.minutes > 0 && item.data.minutes + " 分钟", fromTemplate && "模板", item.data.shared && "共享",
        completion && (completion.data.date === item.data.date ? "已完成" : shortDate(completion.data.date) + "打卡")].filter(Boolean).join(" · ")}</small></div>
      <div className="plan-actions">{own && planActions(item)}
        <button type="button" className="button outline small" onClick={() => begin(item)}>{completion ? "查看记录" : "开始"}</button>
      </div>
    </div>;
  }

  const exerciseOwner = !exerciseSelection?.owner || exerciseSelection.owner === me.id ? me
    : exerciseSelection.owner === partnerWithDetails?.id ? partnerWithDetails : undefined;
  const exerciseDialog = exercise && exerciseOwner && <ExerciseDetail key={exerciseOwner.id + ":" + (exercise.catalogueId ?? exercise.name)}
    choice={exercise} close={() => setExercise(undefined)} maxFormula={display.maxFormula} sex={exerciseOwner.anatomyVariant ?? null}
    select={(choice) => setExerciseSelection({ choice, owner: exerciseOwner.id })} profiles={profiles} names={exerciseNames} logs={logs} owner={exerciseOwner.id}
    save={(item) => library.save({ kind: "exercise", item })} addToPlan={trainingNav.id ? undefined : planExercise} />;

  if (trainingNav.id) {
    if (overlay?.kind === "session" && overlay.id === trainingNav.id && !completedWorkout) {
      return <AnatomySubject.Provider value={me.anatomyVariant}><Workout key={overlay.id} onExercise={setExercise} data={overlay.data} trackProtein={trackProtein}
        proteinProducts={proteinProducts} close={() => { close(); trainingNav.leave(); }}
        loadHistory={loadHistory}
        update={(data) => { setOverlay({ ...overlay, data }); upsertLocalDraft(overlay.id, data); }}
        finish={() => void finishSession(overlay.id, overlay.data)} error={warning} pending={busy} sync={sync} />{exerciseDialog}</AnatomySubject.Provider>;
    }
    return <TrainingNotice loading={!draftsReady || cloud === "正在连接" || Boolean(routeDraft)}
      finished={Boolean(completedWorkout)} onBack={trainingNav.leave}
      onDetails={() => {
        if (completedWorkout) open({ kind: "log", log: completedWorkout });
        trainingNav.leave();
      }} />;
  }

  const assistantPage = view === "assistant";
  const heading = pageTitles[view];
  const coachMeal = (assistantPage || coachSheet) && assistantMeal?.owner === viewer?.id ? assistantMeal : undefined;
  const activeTab = view === "programs" ? "plans"
    : view === "coaching" ? "friends" : view === "body" ? "stats" : view;
  const calendarOpen = view === "stats" && statsTab === "history";
  return <AnatomySubject.Provider value={me.anatomyVariant}><div className={calendarOpen ? "app app-history" : "app"}>
    <div className="stage">
      <main className={view === "today" ? "content content-today" : view === "nutrition" ? "content content-nutrition" : assistantPage ? "content content-coach" : "content"}>
        {view === "today" && <>
          <header className="home-toolbar">
            <div className="home-toolbar-start">
              {nutritionPreferences.collapsed && <button type="button" className="icon-button home-nutrition-restore" ref={nutritionToggle}
                aria-controls="today-nutrition" aria-expanded="false" aria-label="展开饮食记录" title="展开饮食记录" onClick={() => toggleNutrition(false)}>
                <Utensils size={19} aria-hidden="true" />
              </button>}
              <button className="button primary" type="button" onClick={() => open({ kind: "launch" })}>
                <Play size={17} fill="currentColor" aria-hidden="true" /> 训练
              </button>
            </div>
            <button className="icon-button home-settings" type="button" onClick={() => go("settings")} aria-label="设置" title="设置">
              <Settings size={21} aria-hidden="true" />
            </button>
          </header>
          {demo && <p className="muted home-demo">正在查看示例数据。登录后可同步你们的记录。</p>}
          <div id="today-nutrition" hidden={nutritionPreferences.collapsed}>
            {!nutritionPreferences.collapsed && <HomeNutrition key={viewer?.id ?? "guest"} owner={viewer?.id ?? ""} today={today}
              shortcuts={homeNutritionShortcuts} cacheEnabled={nutritionPreferences.cacheEnabled} logs={ownNutritionLogs} open={openNutrition}
              dismiss={() => toggleNutrition(true)} dismissRef={nutritionToggle} />}
          </div>
        </>}
        {heading && view !== "settings" && <div className={view === "friends" ? "page-heading friends-heading" : "page-heading"}>
          <h1>{heading}</h1>
          {view === "friends" && <button className="button outline small" type="button" onClick={() => go("coaching")}>
            <GraduationCap size={16} aria-hidden="true" /> 教练与学员
          </button>}
        </div>}

        {view === "today" && <div className="today-grid">
          {display.social && <div className="home-pair">
            <PairToday me={me} partner={partner} partnerHidden={room?.partnerTrainingShared === false}
              myToday={myToday} partnerToday={partnerToday} latestPartner={latestPartner} today={today} partnerLastDay={partnerLastDay}
              signedIn={!demo} loading={buddyStatus === "loading"} unavailable={buddyStatus === "offline"} busy={busy}
              sentCheer={sentCheer} receivedCheer={receivedCheer} onShowLog={(log) => open({ kind: "log", log })}
              onConnect={() => open({ kind: "pair" })}
              onPartnerHistory={showBuddy}
              onCheer={() => {
                if (!viewer || !partner || !room?.connectionId) return;
                const target = { partner: partner.id, connection: room.connectionId };
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
                void act(async () => { await post({ action: "cheer", ...target, timeZone }); setToday(asDate()); await refresh(); setToast("已给搭子加油"); });
              }} />
          </div>}
          <div className="main-column">
            <section className="card week-card" aria-label="本周训练日期">
              <div className="section-head"><h2>训练日程</h2><div className="steppers"><button className="icon-button" onClick={() => setSelected(offsetDate(selected, -7))} aria-label="上一周"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => setSelected(offsetDate(selected, 7))} aria-label="下一周"><ChevronRight size={18} /></button></div></div>
              <div className="week-days">
                {weekDays.map((day, i) => {
                  const date = offsetDate(weekStart, i);
                  return <button key={day} aria-pressed={selected === date} aria-label={date + (blocked(schedule, date) ? "，休息" : "")} onClick={() => setSelected(date)}><span>周{day}</span><strong>{Number(date.slice(8))}</strong><span className="week-dot">{blocked(schedule, date) ? <small>休</small> : (plans.some((item) => item.data.date === date) || logs.some((log) => log.data.date === date)) && <i />}</span></button>;
                })}
              </div>
              {display.weeklyGoal > 0 && <div className="weekly-goal">
                <label htmlFor="weekly-workout-goal">本周打卡 {weeklyCheckins} / {display.weeklyGoal} 次</label>
                <progress id="weekly-workout-goal" max={display.weeklyGoal} value={Math.min(weeklyCheckins, display.weeklyGoal)} />
              </div>}
            </section>

            {blocked(schedule, selected) && <p className="muted">这天设为不安排训练。已有计划可移动到其他日期。</p>}
            <div className="section-head section-break"><h2>{selected === today ? "今日训练" : shortDate(selected) + "的训练"}</h2><button className="text-button" onClick={() => go("plans")}>全部计划 <ChevronRight size={15} /></button></div>
            {selected === today && drafts.length > 0 && <section className="card plan-list">{drafts.map(([id, data]) => <div className="plan-line" key={id}><span className="tile mint"><Clock3 size={19} /></span><div><strong>{data.plan.title}</strong><small>{sessionTotals(data).sets} 组完成 · {pendingDrafts[id] && !demo ? "待同步" : "训练草稿"}</small></div><div className="plan-actions"><button className="button outline small" onClick={() => resumeDraft(id, data)}>继续</button>
              <button className="icon-button" aria-label={"删除草稿 " + data.plan.title} onClick={() => open({ kind: "delete", itemId: id, label: data.plan.title, type: "draft" })}><Trash2 size={16} /></button></div></div>)}</section>}
            {current ? <>
              <section className={"card today-workout-card" + (current.data.durationNote ? " has-estimate" : "")}>
                <div className="hero">
                  <div className="hero-content">
                    <span className="hero-tag"><span />{!canManageToday ? "搭子共享 · " + current.data.category : current.data.category}</span>
                    <h2>{planDisplayTitle(current.data)}</h2>
                    <div className="hero-meta">{planWeekDay(current.data) && <span><CalendarDays size={16} /> {planWeekDay(current.data)}</span>}{current.data.minutes > 0 && <span><Clock3 size={16} /> {current.data.minutes} 分钟</span>}{current.data.exercises.length > 0 && <span><Dumbbell size={16} /> {current.data.exercises.length} 个动作</span>}{current.data.video && <span><Play size={16} /> 跟练视频</span>}</div>
                    <button className="button hero-button" onClick={() => begin(current)}><Play size={17} fill="currentColor" /> 开始计划训练</button>
                  </div>
                </div>
                {canManageToday && <div className="hero-menu" key={current.id}>{planActions(current)}</div>}
                {current.data.durationNote && <p className="hero-duration-note">{current.data.durationNote}</p>}
              </section>
              {(todaysPlans.length > 1) && <section className="card plan-list">{todaysPlans.slice(1).map(renderPlan)}</section>}
              {current.data.exercises.length > 0 && <details className="card movement-card" key={current.id + ":" + selected}>
                <summary className="movement-toggle">
                  <h2><span>动作清单</span><span className="movement-meta"><span className="count-label">{current.data.exercises.length} 个动作</span><ChevronDown size={18} aria-hidden="true" /></span></h2>
                </summary>
                <div className="movement-content"><PlanSequence plan={current.data}
                  onExercise={(choice) => setExerciseSelection({ choice, owner: current.owner })} /></div>
              </details>}
              {current.data.video && <section className="card padded"><VideoLink url={current.data.video} /></section>}
            </> : buddyStatus === "loading" || selectedPlanCompletions.length > 0 ? null : <section className="card empty-state"><span className="tile mint"><Dumbbell /></span><h3>{myToday.length && selected === today ? "今天已完成打卡" : "这天还没有安排"}</h3>{selected !== today && <button className="button outline small" onClick={() => go("plans")}>去安排训练</button>}</section>}
            {selectedPlanCompletions.length > 0 && <section className="card plan-list" aria-label="已完成训练">{selectedPlanCompletions.map(renderPlan)}</section>}
          </div>

          <aside className="right-column">
            {display.weeklyCheckins && <WeekCheckins today={today} me={me} partner={display.social ? partnerWithDetails : undefined}
              partnerCheckins={display.social ? room?.partnerCheckins : undefined} partnerCheckinsFrom={room?.partnerCheckinsFrom}
              logs={logs} status={buddyStatus} showStats={() => go("stats")} />}
            {display.planShortcuts && <button className="import-callout" onClick={() => openPlanAssistant("coach")}><span className="tile lilac"><Sparkles size={20} /></span><span><strong>添加计划</strong><small>用 AI 起草训练计划</small></span><ChevronRight size={18} /></button>}
            {warning && !overlay && <p className="inline-error" role="alert">{warning}</p>}
          </aside>
        </div>}

        {view === "plans" && <PlanSections key={planTab ?? "plans"} date={selected} templates={templates} initial={planTab}
          exerciseLibrary={<OpenGymCatalogue names={exerciseNames} profiles={profiles} choose={setExercise} quick={planExercise} />}
          schedule={newPlan} newTemplate={() => openTemplate()} edit={(row) => openTemplate(row.plan, row.id, row.updated)}
          openFriends={display.social ? () => go("friends") : undefined}
          exerciseProfiles={profiles}><section className="card padded plans-list-card">
          <div className="section-head plans-list-heading">
            <h2>全部计划</h2>
            <div className="plans-list-actions">
              <button className="button outline small" type="button" onClick={() => go("programs")}><CalendarClock size={17} /> 训练周期</button>
              <button className="button subtle small" type="button" onClick={() => openPlanAssistant("coach")}><Sparkles size={17} /> 添加计划</button>
              <button className="button primary small" type="button" onClick={() => newPlan()}><Plus size={17} /> 新建计划</button>
            </div>
          </div>
          <div className="segmented plans-status-tabs" role="group" aria-label="计划状态">
            <button type="button" aria-pressed={planStatus === "pending"} onClick={() => setPlanStatus("pending")}>待训练</button>
            <button type="button" aria-pressed={planStatus === "completed"} onClick={() => setPlanStatus("completed")}>已完成</button>
          </div>
          {visiblePlans.length ? visiblePlans.map(renderPlan) : <div className="empty-state"><span className="tile mint"><ClipboardList size={22} /></span>
            <h3>{planStatus === "completed" ? "还没有已完成的计划" : plans.length ? "没有待训练的计划" : "还没有训练计划"}</h3></div>}
        </section></PlanSections>}
        {view === "plans" && library.error && <button className="button outline small" onClick={() => void library.load()}>{library.error}</button>}
        {view === "nutrition" && <NutritionView key={viewer?.id ?? "guest"} enabled={Boolean(viewer)} owner={viewer?.id} today={today}
          records={ownNutritionLogs} initialDate={nutritionStartDate} initialShortcut={nutritionShortcut} onMealPhoto={openMealPhoto}
          proteinProducts={proteinProducts} onProteinWarehouse={() => { go("settings"); openSetting("proteinWarehouse"); }}
          onBack={() => go("today")} onBody={() => go("body")}
          onDevices={() => { go("settings"); openSetting("watches"); }} />}
        {view === "body" && <BodyView enabled={Boolean(viewer)} today={today} onProfileSaved={(sex) => {
          setState((current) => ({ ...current, me: { ...current.me, anatomyVariant: sex } }));
          void refresh();
        }} />}
        <div hidden={view !== "programs"}><ProgramView active={view === "programs"} enabled={Boolean(viewer)} today={today} templates={templates.map((item) => ({ id: item.id, plan: item.plan }))} saved={() => { void refresh(); void library.load(); }} /></div>
        <div hidden={view !== "coaching"}><CoachingView active={view === "coaching"} enabled={Boolean(viewer)} today={today}
          templates={templates.map(({ id, plan }) => ({ id, plan }))}
          plans={pendingPlans.filter((item) => item.owner === me.id).map(({ id, data }) => ({ id, plan: data }))}
          saved={() => { void refresh(); void library.load(); }} /></div>
        {view === "settings" && <SettingsHub page={settingsPage} open={openSetting} close={() => go("today")} name={me.name} cloud={cloud} account={Boolean(viewer)}>
          <SettingsContent page={settingsPage} open={openSetting} owner={viewer?.id ?? ""} cloud={cloud} sex={me.anatomyVariant}
            sync={() => { void refresh(); void library.load(); }} pair={() => open({ kind: "pair" })}
            sharing={viewer ? () => open({ kind: "friend-sharing" }) : undefined}
            coaching={() => go("coaching")} body={() => go("body")} schedule={() => openScheduleSettings()}
            programs={() => go("programs")} plans={() => go("plans")}
            planImport={<ImportView today={today} save={importPlans} canRevise={Boolean(viewer)}
              onPrograms={() => go("programs")} onData={() => openSetting("data")}
              saved={() => { void refresh(); go("plans"); }} />}
            latestWorkout={viewer && latestOwnWorkout ? () => open({ kind: "log", log: latestOwnWorkout }) : undefined}
            display={display} changeDisplay={changeDisplay}
            protein={<section className="card padded feature-stack"><ProteinCheck label="显示蛋白粉打卡" checked={trackProtein}
              disabled={!viewer || library.loading || Boolean(library.error)} save={(enabled) => library.save({ kind: "protein-preference", enabled }, undefined, viewer?.id)} />
              <p className="muted">开启后可在结束训练时记录蛋白粉。</p></section>}
            proteinWarehouse={<ProteinWarehouse owner={viewer?.id ?? ""} products={proteinProducts}
              disabled={!viewer || library.loading || Boolean(library.error)} save={saveProteinProducts}
              personalFoods={viewer ? proteinFoods.rows.filter((item) => item.kind === "food") : []}
              onUseAgent={() => openPlanAssistant("ai")} />}
            data={<DataView enabled={Boolean(viewer)} saved={() => { void refresh(); void library.load(); }} importPlans={() => openSetting("planImport")} />}
            agent={<div className="feature-stack"><SettingsRows>
              <SettingsLink label="打开站内 AI 教练" detail="问答定制或自由对话" icon={Sparkles} onClick={() => openPlanAssistant("coach")} />
              <SettingsLink label="用自己的 AI" detail="提示词、Agent 连接和草稿" onClick={() => openPlanAssistant("ai")} />
            </SettingsRows>
              <AgentPack profileRef={profileRef} /></div>} />
        </SettingsHub>}

        {view === "stats" && <div className={calendarOpen ? "feature-stack history-layout" : "feature-stack"}>
          <div className="segmented stats-page-tabs" role="group" aria-label="统计页面">
            <button type="button" aria-pressed={statsTab === "overview"} onClick={() => setStatsTab("overview")}>训练统计</button>
            <button type="button" aria-pressed={statsTab === "history"} onClick={() => setStatsTab("history")}>打卡历史</button>
          </div>
          {calendarOpen ? <History today={today} self={me.id} partner={partnerWithDetails?.name} logs={logs}
            orderByDay={new Map(library.rows.flatMap((item) => item.kind === "history-order" ? [[item.id, item.entries] as const] : []))}
            saveOrder={viewer ? (date, entries) => library.save({ kind: "history-order", id: date, entries }) : undefined}
            show={(log) => open({ kind: "log", log })} /> :
            <Stats today={today} self={me.id} partner={partnerWithDetails ?? null} logs={logs} maxFormula={display.maxFormula}
              onExercise={(choice, owner) => setExerciseSelection({ choice, owner })}
              pinned={library.rows.find((item) => item.kind === "stats-pins")?.ids}
              savePins={viewer ? (ids) => library.save({ kind: "stats-pins", ids }) : undefined} />}
        </div>}
        {view === "friends" && <FriendsView key={friendFocus?.id ?? "friends"} enabled={Boolean(viewer)}
          today={today} initialFriendId={friendFocus?.id} initialDate={friendFocus?.date} onChanged={() => void refresh()} />}

        <CoachSheet size={coachSheet} inlineOpen={assistantPage} mode={assistantMode} onModeChange={changeAssistantMode}
          onResize={setCoachSheet} onClose={() => setCoachSheet(undefined)}>
          <PlanAssistant key={viewer?.id ?? "guest"} today={today} selectedDate={selected} owner={viewer?.id} profileRef={profileRef}
            active={assistantPage || Boolean(coachSheet)} mode={assistantMode} onModeChange={changeAssistantMode}
            inSheet={Boolean(coachSheet)}
            compact={coachSheet === "half"} onExpandCoach={coachSheet === "half" ? () => setCoachSheet("full") : undefined}
            backLabel={coachMeal ? coachMeal.fromCoach ? "返回 AI 教练" : "返回饮食记录" : "返回"}
            onBack={coachMeal?.fromCoach ? () => { setAssistantMode("coach"); go("assistant"); } : leavePlanAssistant}
            mealPhoto={coachMeal && <CoachMealPhoto key={coachMeal.id} request={coachMeal} onSaved={(entry) => {
              if (!coachMeal.fromCoach) { go("nutrition"); return; }
              setAssistantMeal(undefined);
              setAssistantMealResult({ id: coachMeal.id, owner: coachMeal.owner, message: `已记入${entry.meal}「${entry.name}」。` });
            }} />}
            mealPhotoId={coachMeal?.id} mealResult={assistantMealResult?.owner === viewer?.id ? assistantMealResult : undefined}
            onDismissMeal={coachMeal ? () => { if (coachMeal.fromCoach) setAssistantMeal(undefined); else leavePlanAssistant(); } : undefined}
            onPrograms={() => go("programs")} onData={() => go("data")}
            coachActions={{
              logMeal: viewer && display.nutrition ? (meal) => openMealPhoto(undefined, meal) : undefined,
              trainingStats: (question, date) => {
                const summary = readActivitySummary(question, date, logs, viewer?.id ?? "");
                if (!summary) return undefined;
                if (!viewer) return "请先登录训练搭子，再查看你的训练统计。";
                if (cloud === "正在连接") return "训练记录还在同步，稍后再问我一次。";
                if (cloud === "云端连接异常") return "暂时读不到完整的云端训练记录，连接恢复后再问我一次。";
                return summary;
              },
              saveWeight: viewer ? ({ id, date, kg }) => library.save({ kind: "nutrition", id, date, entry: { type: "weight", kg } }, undefined, viewer.id) : undefined,
              saveDraft: viewer ? (items) => savePlans(items, true, false) : undefined,
              startWorkout: () => { setCoachSheet(undefined); open({ kind: "launch" }); },
            }}
            saved={() => { void refresh(); void library.load(); go("plans"); }} />
        </CoachSheet>
      </main>
    </div>
    {view !== "nutrition" && <nav aria-label="主导航" className="primary-nav">
      <div className="primary-nav-tabs">{primaryTabs
        .filter(({ id }) => id !== "friends" || display.social)
        .map(({ id, icon: Icon, label }) =>
          <button className={activeTab === id ? "active" : ""} aria-current={id === view ? "page" : id === activeTab ? "location" : undefined}
            key={id} type="button" onClick={() => go(id)}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>)}
      </div>
      <button className={assistantPage || coachSheet ? "primary-nav-coach active" : "primary-nav-coach"} aria-current={assistantPage ? "page" : undefined}
        type="button" aria-label="AI 教练" title="AI 教练" aria-haspopup="dialog" aria-expanded={Boolean(coachSheet)}
        onClick={() => { if (!assistantPage) setAssistantMode("coach"); setCoachSheet("half"); }}>
        <span className="primary-nav-coach-icon"><Sparkles size={21} aria-hidden="true" /></span>
      </button>
    </nav>}
    {overlay?.kind === "editor" && <Dialog title={plans.some((plan) => plan.id === overlay.plan.id && plan.owner === me.id) ? "编辑计划" : "新建计划"} onClose={close}>
      <form onSubmit={(e) => { e.preventDefault(); const item = overlay.plan; void act(async () => { await savePlans([item]); setSelected(item.data.date); setOverlay(null); }); }}>
        <div className="dialog-body"><PlanFields value={overlay.plan.data} templates={templates} change={(data) => setOverlay({ kind: "editor", plan: { ...overlay.plan, data } })} />{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
        <div className="dialog-footer"><button type="button" className="button outline" onClick={close} disabled={busy}>取消</button><button className="button primary" disabled={busy}><Check size={18} /> 保存计划</button></div>
      </form>
    </Dialog>}
    {overlay?.kind === "launch" && <TrainingLaunch close={close} start={(kind) => begin(undefined, kind)}
      rest={viewer && !library.loading && !library.error ? () => openScheduleSettings(today) : undefined}
      body={() => { close(); go("body"); }} />}
    {overlay?.kind === "friend-sharing" && <Dialog title="好友分享设置" className="friend-settings-dialog" onClose={close}>
      <div className="dialog-body"><FriendsView enabled={Boolean(viewer)} today={today} sharingOnly onChanged={() => void refresh()} /></div>
    </Dialog>}
    {overlay?.kind === "schedule" && <ScheduleSettings
      settings={overlay.settings} restDay={overlay.restDay} close={close} save={async (values) => {
      await library.save({ kind: "schedule", values }, overlay.revision); setToast("计划设置已保存");
    }} />}
    {overlay?.kind === "move" && <MovePlan item={overlay.item} settings={schedule} today={today} close={close} inspect={async (choice) => {
      const response = await post({ action: "previewMove", id: overlay.item.id, from: overlay.item.data.date, revision: overlay.item.updated, ...choice });
      return response.json() as Promise<MovePreview>;
    }} save={async (choice, token) => {
      const response = await post({ action: "move", id: overlay.item.id, from: overlay.item.data.date, revision: overlay.item.updated, ...choice, token });
      const { moved, date } = await response.json() as { moved: number; date: string };
      await refresh(); setSelected(date); setToast(moved > 1 ? "已顺延 " + moved + " 个计划" : "训练已移动");
    }} />}
    {overlay?.kind === "delete" && <Dialog title={overlay.type === "plan" ? "删除训练计划" : "删除训练草稿"} onClose={close}>
      <div className="dialog-body feature-stack"><p>确定删除「{overlay.label}」？{overlay.type === "plan" ? "已打卡的历史仍可查看。" : "这次尚未打卡的组记录会一同删除。"}</p>{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
      <div className="dialog-footer"><button className="button outline" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy} onClick={() => void deleteRecord(overlay.itemId, overlay.type, overlay.revision)}>确认删除</button></div>
    </Dialog>}
    {overlay?.kind === "template" && <Dialog title={overlay.editing ? "编辑模板" : "保存训练模板"} onClose={close}>
      <form onSubmit={(event) => { event.preventDefault(); const { id, data } = overlay.item; void act(async () => {
        const parsed = cleanPlan(data);
        if (!parsed.success) throw new Error("请检查模板名称、日期、动作或视频。");
        await library.save({ kind: "template", id, plan: { ...withoutTemplateLink(parsed.data), shared: false } }, overlay.item.revision);
        await refresh();
        setOverlay(null); go("plans"); setPlanTab("个人模板"); setToast("模板已保存");
      }); }}>
        <div className="dialog-body"><PlanFields template value={overlay.item.data} change={(data) => setOverlay({ ...overlay, item: { ...overlay.item, data } })} />{warning && <p className="inline-error" role="alert">{warning}</p>}</div>
        <div className="dialog-footer">{overlay.editing && <button type="button" className="button outline" disabled={busy} onClick={() => {
          if (!confirmRemoveTemplate) { setConfirmRemoveTemplate(true); return; }
          void act(async () => { await library.remove("template", overlay.item.id, overlay.item.revision); await refresh(); setOverlay(null); setToast("模板已删除"); });
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
        {plans.some((item) => item.owner === me.id && item.id === targetPlan && item.data.templateId) &&
          <p className="muted">保存这次的动作改动后，这一节会成为独立计划。</p>}
        {warning && <p className="inline-error" role="alert">{warning}</p>}
        <button className="button primary"><Plus size={17} /> 加入并编辑</button>
      </form>
    </Dialog>}
    {overlay?.kind === "log" && (overlay.log.owner === me.id || (overlay.log.owner === partnerWithDetails?.id &&
      logs.some(({ owner, id }) => owner === partnerWithDetails.id && id === overlay.log.id))) && <LogDetail log={overlay.log} close={close} own={Boolean(viewer && overlay.log.owner === me.id)} whoop={overlay.whoop} today={today} trackProtein={trackProtein}
      proteinProducts={proteinProducts}
      sex={(overlay.log.owner === me.id ? me.anatomyVariant : partnerWithDetails?.anatomyVariant) ?? null}
      share={viewer && overlay.log.owner === me.id ? { name: me.name, owner: me.id, logs } : undefined}
      pendingSync={pendingLog}
      onEdit={viewer && overlay.log.owner === me.id && !pendingLog ? (data) => saveLogEdit(overlay.log, data) : undefined}
      onTemplate={viewer && overlay.log.owner === me.id && !pendingLog ? () => openTemplate(overlay.log.data.plan) : undefined} />}
    {overlay?.kind === "pair" && <Dialog title="搭子空间" onClose={close}>
      <div className="dialog-body form-fields">
        {viewer && !partner && <p className="muted">配对期间双方会互相看到历史和今后的训练打卡及详情。饮食记录默认共享，可在「设置 → 账号 → 好友分享设置」里调整。</p>}
        {demo ? <><p className="muted">用 ChatGPT 账号登录后，你可以创建搭子空间，也可以输入对方的邀请码。</p><a className="button primary" target="_top" href="/signin-with-chatgpt?return_to=%2F"><LogIn size={18} /> 登录</a></> :
          partner ? <div className="partner-row"><span className="avatar lilac">{avatar(partner.name)}</span><div><strong>{partner.name}</strong><small>可以查看彼此的打卡和训练详情。</small></div><span className="state-tag checked">已连接</span></div> :
          room?.invite ? <><p className="muted">把邀请码发给搭子。对方需要先有网站访问权限，再登录并输入邀请码。</p><input aria-label="搭子邀请码" value={room.invite} readOnly onFocus={(e) => e.target.select()} /><button className="button primary" onClick={() => void copy(room.invite!, "已复制邀请码")}><Copy size={17} /> 复制邀请码</button></> :
          <><button className="button primary" disabled={busy} onClick={() => void act(async () => { await post({ action: "create" }); await refresh(); })}><Users size={18} /> 创建搭子空间</button>
            <form className="form-fields join-form" onSubmit={(e) => { e.preventDefault(); void act(async () => { await post({ action: "join", invite: invite.trim().toLowerCase() }); await refresh(); setInvite(""); setToast("搭子已连接"); }); }}><label>已有邀请码<input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="粘贴搭子的邀请码" autoCapitalize="none" spellCheck={false} /></label><button className="button outline" disabled={busy || !/^[a-fA-F0-9]{32}$/.test(invite.trim())}>加入搭子空间</button></form></>}
        {partner && !demo && <button className="button outline" type="button" onClick={() => { close(); showBuddy(); }}>查看搭子记录</button>}
        {partner && !demo && room?.connectionId && <DisconnectPair key={room.connectionId} name={partner.name} busy={busy}
          onDisconnect={() => void act(async () => {
            await post({ action: "disconnect", partner: partner.id, connection: room.connectionId });
            refreshId.current++;
            setState((current) => ({ ...current, room: null, entries: current.entries.filter((entry) => entry.owner === me.id && entry.kind !== "cheer") }));
            close();
            setToast("已解除配对");
            await refresh();
          })} />}
        {warning && <p className="inline-error" role="alert">{warning}</p>}
      </div>
    </Dialog>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
  </div></AnatomySubject.Provider>;
}
