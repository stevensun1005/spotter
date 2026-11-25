"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, CalendarDays, Camera, ChartNoAxesColumn, Dumbbell, MessageSquarePlus,
  Scale, SlidersHorizontal } from "lucide-react";
import { asDate, offsetDate } from "@/shared/dates";
import { errorText, send as sendMutation } from "@/shared/client";
import type { PlannedWorkout } from "@/features/plans/model";
import type { MealEntry } from "@/features/library/model";
import type { CoachMealSubmission } from "@/features/nutrition/coach-meal-save";
import { saveExistingProtein, type CoachProteinReceipt, type CoachProteinSubmission,
  type SavedProteinReceipt, type SavedProteinRequest } from "@/features/nutrition/coach-protein-save";
import { isSavedProteinCommand } from "@/features/nutrition/saved-protein-command";
import { maxPhotoNoteLength } from "@/features/nutrition/food-photo-request";
import { recognizeMealPhoto, recognizeProteinPhoto, validatePhotoFile } from "@/features/nutrition/food-photo-client";
import { CoachPhotoQuota } from "@/features/nutrition/food-photo";
import type { ProteinPhotoProduct } from "@/features/nutrition/food-photo-model";
import type { ProteinProduct } from "@/features/training/protein";
import type { ActivitySummary } from "./activity-summary";
import { ChatTrainingDraft } from "./chat-draft";
import { CoachReplyCard, type CoachReplyKind } from "./reply-card";
import { asksForTrainingPlan } from "./chat-intent";
import { asksToReviseDraft, draftWindowFor, type DraftWindow } from "./plan-conversation";
import { weightDialogue, type PendingWeight } from "./weight-dialogue";
import { useAnthropicSharing } from "./sharing-consent";
import { CoachPhotoAttachment, CoachPhotoPickers } from "./coach-photo-attachment";
import { asksProteinWarehouseStatus, confirmsSameProteinProduct, parseProteinPhotoIntent } from "./protein-photo-intent";
import { addMilkToPowderEstimate, combineProteinLabels, estimatedPowderPer100g, multiplyProteinDrink, prepareProteinPhoto, type ProteinRecipe } from "./protein-photo-workflow";
import { coachModel, maxCoachConversationLength, maxCoachMessageLength, maxCoachMessages,
  type CoachConfig, type CoachQuota, type CoachRequest, type CoachResponse } from "./model";

type WeightRecord = { id: string; date: string; kg: number };
export type CoachActions = {
  logMeal?: (meal?: MealEntry["meal"]) => void;
  photoMeal?: {
    currentMeal: () => MealEntry["meal"];
    save: (submission: CoachMealSubmission) => Promise<MealEntry>;
    saveProtein: (submission: CoachProteinSubmission) => Promise<CoachProteinReceipt>;
    proteinProducts: readonly ProteinProduct[];
    defaultProteinProductId?: string;
    proteinWarehouseStatus: "ready" | "loading" | "error";
    view: (date: string) => void;
    viewWarehouse: () => void;
    refreshed?: () => void;
  };
  trainingStats?: (message: string, date: string) => ActivitySummary | string | undefined;
  saveWeight?: (record: WeightRecord) => Promise<void>;
  saveDraft?: (plans: PlannedWorkout[]) => Promise<void>;
  startWorkout?: () => void;
};

type Turn = {
  id: string;
  kind: "chat" | "plan" | "revision" | "local";
  question: string;
  response?: CoachResponse;
  localReply?: string;
  replyKind?: CoachReplyKind;
  activity?: ActivitySummary;
  action?: "workout";
  weight?: WeightRecord;
  unsavedMeal?: CoachMealSubmission;
  savedMealDate?: string;
  proteinFollowup?: "scoop" | "nutrition";
  openWarehouse?: boolean;
  drink?: Extract<SavedProteinReceipt, { status: "complete" }>["records"][number];
  window?: DraftWindow;
  items?: (PlannedWorkout & { todayId: string })[];
  saved?: boolean;
  addedToday?: ReadonlySet<number>;
  superseded?: boolean;
  saveError?: string;
  error?: string;
};
type Availability = CoachConfig | { error: string };
type BeginCoachRequest = () => { receive: (result: CoachResponse) => void; showError: (message: string) => void };
type PhotoAttachment = { id: string; file: File; date: string; meal: MealEntry["meal"]; mealChosen?: boolean; notes: string };
type ProteinFlow = ProteinRecipe & { date: string; reference?: File; candidate?: ProteinPhotoProduct; retry?: CoachProteinSubmission };

const endpoint = "/api/ai-coach";
const quotaNumber = new Intl.NumberFormat();
const planRequest = "帮我制定训练计划";
const openingSuggestions = ["记体重", "看本周训练统计", planRequest, "拍照记饮食"];
const shortcutCards = [
  { key: "logMeal", title: "拍照记饮食", prompt: "拍照记饮食", icon: Camera, tone: "apricot" },
  { key: "trainingStats", title: "训练统计", prompt: "看本周训练统计", icon: ChartNoAxesColumn, tone: "blue" },
  { key: "saveWeight", title: "记体重", prompt: "记体重", icon: Scale, tone: "violet" },
  { key: "startWorkout", title: "开始训练", prompt: "开始训练", icon: Dumbbell, tone: "moss" },
] as const;

function coachLimitMessage(quota: CoachQuota | undefined) {
  if (quota?.monthlyRemaining === 0) return `本月 AI 教练的 ${quotaNumber.format(quota.monthlyLimit)} 条消息额度已用完，下月 1 日（UTC）重置。`;
  if (quota?.dailyRemaining === 0) return `今天 AI 教练的 ${quotaNumber.format(quota.dailyLimit)} 条消息额度已用完，次日（UTC）重置。`;
  return undefined;
}

function recentMessages(turns: Turn[], question: string): CoachRequest["messages"] {
  const messages: CoachRequest["messages"] = [{ role: "user", content: question }];
  let size = question.length;
  for (let index = turns.length - 1; index >= 0 && messages.length + 2 <= maxCoachMessages; index--) {
    const { kind, question: previous, response } = turns[index];
    if (kind === "local" || !response) continue;
    const { reply } = response;
    if (reply.length > maxCoachMessageLength || size + previous.length + reply.length > maxCoachConversationLength) break;
    messages.unshift({ role: "user", content: previous }, { role: "assistant", content: reply });
    size += previous.length + reply.length;
  }
  return messages;
}

function CoachWelcome({ compact, actions, blocked, send }: {
  compact?: boolean; actions?: CoachActions; blocked: boolean; send: (question: string) => void;
}) {
  if (compact) return <div className="coach-welcome-compact">
    <h2>今天想怎么练？</h2><p>在这里记体重、查训练统计，或者一起排训练。</p>
  </div>;
  return <div className="coach-home">
    <div className="coach-home-intro">
      <div>
        <h2>今天想怎么练？</h2>
        <p>问一个训练问题，或一起制定计划。</p>
      </div>
      <span className="coach-home-art" aria-hidden="true" />
    </div>
    <div className="coach-home-shortcuts" aria-label="教练常用入口">
      <button className="coach-home-task coach-home-task-plan" type="button" disabled={blocked} onClick={() => send(planRequest)}>
        <span className="coach-task-icon"><CalendarDays size={21} aria-hidden="true" /></span>
        <strong>生成计划</strong>
      </button>
      {shortcutCards.map(({ key, title, prompt, icon: Icon, tone }) => {
        return actions?.[key] && <button className="coach-home-task" type="button" key={key} disabled={blocked} onClick={() => send(prompt)}>
          <span className="coach-task-icon" data-tone={tone}><Icon size={21} aria-hidden="true" /></span>
          <strong>{title}</strong>
        </button>;
      })}
    </div>
  </div>;
}

export function AiCoachPanel({ active, compact, onExpand, owner, today, selectedDate, actions, mealPhoto, mealPhotoId, mealResult, onDismissMeal }: {
  active: boolean; compact?: boolean; onExpand?: () => void; owner?: string; today: string; selectedDate: string;
  actions?: CoachActions; mealPhoto?: ReactNode; mealPhotoId?: string;
  mealResult?: { id: string; message: string }; onDismissMeal?: () => void;
}) {
  const [availability, setAvailability] = useState<Availability>();
  const [quota, setQuota] = useState<{ owner: string; value: CoachQuota }>();
  const [check, setCheck] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [includePlans, setIncludePlans] = useState(false);
  const [contextRange, setContextRange] = useState<"day" | "week">("week");
  const [contextDate, setContextDate] = useState<string>();
  const [revisionTarget, setRevisionTarget] = useState<string>();
  const [weightPrompt, setWeightPrompt] = useState<PendingWeight>();
  const [photo, setPhoto] = useState<PhotoAttachment>();
  const [protein, setProtein] = useState<ProteinFlow>();
  const [savedDrink, setSavedDrink] = useState<{
    request: SavedProteinRequest;
    options?: { id: string; name: string }[];
    duplicate?: boolean;
  }>();
  const lastProtein = useRef<{ flow: ProteinFlow; saved: ProteinProduct; receipt: CoachProteinReceipt }>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const requestedMeal = useRef<MealEntry["meal"] | undefined>(undefined);
  const request = useRef<AbortController>(null);
  const writing = useRef(false);
  const processedMeal = useRef<string | undefined>(undefined);
  const failedWeight = useRef<WeightRecord | undefined>(undefined);
  const composer = useRef<HTMLTextAreaElement>(null);
  const photoPosition = useRef<HTMLLIElement>(null);
  const transcriptEnd = useRef<HTMLLIElement>(null);
  const nextTurn = useRef(0);
  const { withConsent, prompt: sharingPrompt } = useAnthropicSharing(active ? owner : undefined);

  const latestModelTurn = turns.findLast((turn) => turn.kind !== "local" && turn.response);
  const latestDraft = turns.findLast((turn) => turn.items && turn.window && !turn.superseded);
  const available = !!owner && availability && "enabled" in availability && availability.enabled;
  const currentQuota = quota && quota.owner === owner ? quota.value : undefined;
  const limitMessage = coachLimitMessage(currentQuota);
  const quotaResetsAt = limitMessage && (currentQuota?.monthlyRemaining === 0 ? currentQuota.monthlyResetsAt : currentQuota?.dailyResetsAt);
  const chatDate = includePlans ? contextDate ?? selectedDate : selectedDate;
  const lastTurn = turns.at(-1);
  const showSuggestions = Boolean(compact && !waiting && !limitMessage && !lastTurn && !mealPhoto && !photo && !protein && !optionsOpen);

  useEffect(() => {
    if (!active || !owner) return;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) })
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) setAvailability({ error: "登录已过期。请重新登录训练搭子。" });
          return;
        }
        if (!response.ok) throw new Error();
        const result = await response.json() as Availability;
        if (!("enabled" in result) || typeof result.enabled !== "boolean" || !Array.isArray(result.models)) throw new Error();
        if (!controller.signal.aborted) {
          setAvailability(result);
          setQuota(result.quota ? { owner, value: result.quota } : undefined);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability({ error: "暂时无法检查 AI 教练状态。" });
      });
    return () => controller.abort();
  }, [active, owner, check]);

  useEffect(() => {
    if (!active || !quotaResetsAt) return;
    const delay = Date.parse(quotaResetsAt) - Date.now() + 1_000;
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setCheck((value) => value + 1), Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [active, quotaResetsAt, check]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!active) return;
    if (mealPhotoId && photoPosition.current) photoPosition.current.scrollIntoView({ block: "start" });
    else if (lastTurn) transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [active, compact, lastTurn, mealPhotoId]);

  useEffect(() => {
    if (!mealResult || processedMeal.current === mealResult.id) return;
    processedMeal.current = mealResult.id;
    setTurns((previous) => [...previous, { id: mealResult.id, kind: "local", question: "", localReply: mealResult.message, replyKind: "saved" }]);
  }, [mealResult]);

  function updateTurn(id: string, patch: Partial<Turn>) {
    setTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, ...patch } : turn));
  }

  function addTurn(kind: Turn["kind"], question: string, patch: Partial<Turn> = {}) {
    const id = String(++nextTurn.current);
    setTurns((previous) => [...previous, { id, kind, question, ...patch }]);
    return id;
  }

  function clearConversation() {
    if (request.current || writing.current) return;
    setTurns([]);
    setInput("");
    setPhoto(undefined);
    setProtein(undefined);
    setSavedDrink(undefined);
    lastProtein.current = null;
    requestedMeal.current = undefined;
    setError("");
    setRevisionTarget(undefined);
    setWeightPrompt(undefined);
    failedWeight.current = undefined;
    onDismissMeal?.();
    setOptionsOpen(false);
    setIncludePlans(false);
  }

  function askCoach(payload: CoachRequest, start: BeginCoachRequest) {
    if (!available || request.current || limitMessage) return;
    withConsent(() => { void sendToCoach(payload, start); });
  }

  function updateQuota(value: CoachQuota) {
    if (owner) setQuota({ owner, value });
  }

  async function sendToCoach(payload: CoachRequest, start: BeginCoachRequest) {
    if (request.current || writing.current || limitMessage) return;
    const { receive, showError } = start();
    const controller = new AbortController();
    request.current = controller;
    setWaiting(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as (CoachResponse & { error?: string }) | null;
      if (result?.quota && !controller.signal.aborted) updateQuota(result.quota);
      if (!response.ok) throw new Error(result?.error || "AI 教练暂时无法回复。请稍后重试。");
      if (typeof result?.reply !== "string" || !result.reply || result.model !== coachModel) throw new Error("未收到完整回复。请重试。");
      if (!controller.signal.aborted) receive(result);
    } catch (reason) {
      if (!controller.signal.aborted) showError(reason instanceof Error && reason.name === "Error"
        ? reason.message : "连接未完成。请检查网络后重试。");
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setWaiting(false);
      }
    }
  }

  const status = !owner ? "登录后可以在对话里查看统计和添加记录。" : !availability ? "正在检查 AI 教练状态…"
    : "error" in availability ? availability.error : "站内模型暂未启用。登录账号仍可通过对话记体重、查训练统计。";
  const canRetry = !!owner && availability && "error" in availability;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limitMessage) return;
    const question = input.trim();
    if (asksProteinWarehouseStatus(question)) {
      answerWarehouseStatus(question);
      return;
    }
    if (protein) {
      replyToProtein(question);
      return;
    }
    if (photo && replyToProtein(question)) return;
    if (!photo && addLastProteinToWarehouse(question)) return;
    if (!photo && owner && actions?.photoMeal) {
      const held = savedDrink?.request.expectedOwner === owner ? savedDrink : undefined;
      if (held && /^(?:取消|取消本次|不用记了|先不记了|算了)[。！!]?$/.test(question)) {
        setSavedDrink(undefined); setInput(""); setError("");
        addTurn("local", question, { replyKind: "meal", localReply: "已取消这次蛋白粉记录。" });
        return;
      }
      if (held?.options?.length) {
        const selected = held.options.find(({ name }) => name.normalize("NFKC").trim().toLowerCase() === question.normalize("NFKC").toLowerCase());
        if (selected) void recordSavedDrink({ ...held.request, productId: selected.id });
        else setError("请选择喝的是哪一款蛋白粉。");
        return;
      }
      if (isSavedProteinCommand(question) || held && !held.duplicate) {
        const next: SavedProteinRequest = held && !held.duplicate
          ? { ...held.request, text: question === "重试" ? held.request.text : held.request.text + "，" + question }
          : { action: "record-saved", expectedOwner: owner, recordId: crypto.randomUUID(), localDate: today, text: question,
              ...(/又喝|再喝|再记|另一杯|第二杯/u.test(question) ? { anotherCup: true as const } : {}) };
        void recordSavedDrink(next);
        return;
      }
    }
    if (photo) {
      const notes = [photo.notes, question].filter(Boolean).join("\n");
      if (!owner || !available || !actions?.photoMeal || waiting) return;
      if (notes.length > maxPhotoNoteLength) {
        setError(`照片的份量说明最多 ${maxPhotoNoteLength} 字。请缩短补充说明，或移除照片后重新发送。`);
        return;
      }
      withConsent(() => { void recordPhoto(photo, question, notes, owner); });
      return;
    }
    submitQuestion(input);
  }

  async function recordSavedDrink(payload: SavedProteinRequest) {
    if (request.current || writing.current || limitMessage) return;
    writing.current = true;
    setWaiting(true); setInput(""); setError(""); setSavedDrink({ request: payload });
    try {
      const result = await saveExistingProtein(payload);
      if (result.status === "choose") {
        setSavedDrink({ request: payload, options: result.products });
        addTurn("local", payload.text, { replyKind: "meal", localReply: "喝的是哪一款蛋白粉？" });
      } else if (result.status === "clarify") {
        addTurn("local", payload.text, { replyKind: "meal", localReply: result.message, openWarehouse: true });
      } else {
        const duplicate = result.records.some(({ alreadyRecorded }) => alreadyRecorded);
        setSavedDrink(duplicate ? { request: { ...payload, productId: result.productId }, duplicate: true } : undefined);
        for (const [index, record] of result.records.entries()) {
          const label = record.alreadyRecorded
            ? record.date + " 的" + (record.linkedWorkout ? "训练打卡" : "饮食记录") + "已有「" + record.entry.name + "」。"
            : "已记入 " + record.date + " 加餐「" + record.entry.name + "」。\n每杯 " +
              result.powderGrams + " g 粉 · " + result.liquidMl + " mL " + result.liquidName +
              " · 本次共 " + record.entry.calories + " 千卡";
          const id = String(++nextTurn.current);
          setTurns((previous) => {
            if (previous.some((turn) => turn.drink?.id === record.id)) return previous;
            return [...previous, { id, kind: "local",
              question: index === 0 ? payload.text : "", replyKind: record.alreadyRecorded ? "meal" : "saved", localReply: label,
              savedMealDate: record.date, drink: record.alreadyRecorded ? undefined : record }];
          });
        }
        actions?.photoMeal?.refreshed?.();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "这次蛋白粉记录暂未完成，请重试。");
    } finally {
      writing.current = false;
      setWaiting(false);
    }
  }

  async function undoSavedDrink(turn: Turn) {
    if (!owner || !turn.drink || request.current || writing.current) return;
    writing.current = true;
    setWaiting(true);
    try {
      await sendMutation("/api/library", { action: "remove", expectedOwner: owner, kind: "nutrition",
        id: turn.drink.id, revision: turn.drink.updated });
      updateTurn(turn.id, { drink: undefined, savedMealDate: undefined, replyKind: "meal",
        localReply: "已撤销 " + turn.drink.date + " 的「" + turn.drink.entry.name + "」。" });
      actions?.photoMeal?.refreshed?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法撤销。");
    } finally {
      writing.current = false;
      setWaiting(false);
    }
  }

  function answerWarehouseStatus(question: string) {
    if (waiting) return;
    const config = actions?.photoMeal;
    const recent = lastProtein.current;
    const product = recent && config?.proteinProducts.find(({ id, name }) => id === recent.saved.id || name === recent.saved.name);
    const confirmed = config?.proteinWarehouseStatus === "ready" ? product : recent?.receipt.warehouse;
    const names = config?.proteinProducts.slice(0, 4).map(({ name }) => `「${name}」`).join("、");
    const preferred = config?.proteinProducts.find(({ id }) => id === config.defaultProteinProductId)?.name
      ?? (config?.proteinWarehouseStatus !== "ready" && recent?.receipt.defaultProductId ? recent.saved.name : undefined);
    const summary = confirmed && recent ? `「${product?.name ?? recent.saved.name}」已在蛋白粉仓库。`
      : recent && config?.proteinWarehouseStatus === "ready" ? `最近这杯「${recent.saved.name}」还没进仓库。你可以说「只加入仓库并设为训练后默认」。`
      : names ? `仓库里有 ${names}。`
      : config?.proteinWarehouseStatus === "ready" ? "你的蛋白粉仓库现在是空的。"
      : "目前还没读到仓库。等同步后，你可以再问一次。";
    setInput("");
    addTurn("local", question, { replyKind: "meal", localReply: summary + (preferred ? `训练后默认用「${preferred}」。` : ""),
      openWarehouse: Boolean(config) });
  }

  function addLastProteinToWarehouse(question: string) {
    const recent = lastProtein.current;
    if (!recent || !owner || waiting || !actions?.photoMeal) return false;
    const intent = parseProteinPhotoIntent(question, recent.flow.date, {
      ...recent.flow.intent, warehouse: false, logRequested: false, servings: [],
    });
    if (!intent?.warehouse || intent.logRequested) return false;
    const product = recent.saved;
    void recordProtein({ ...recent.flow, intent, retry: { owner, product, addToWarehouse: true, records: [] } }, question, owner);
    return true;
  }

  function replyToProtein(question: string) {
    const date = protein?.date ?? photo?.date;
    if (!date || !owner || !actions?.photoMeal || request.current || writing.current) return false;
    if (protein && /^(?:取消|取消本次|不用记了|先不记了|算了)[。！!]?$/.test(question)) {
      setProtein(undefined);
      setPhoto(undefined);
      setInput("");
      addTurn("local", question, { replyKind: "meal", localReply: "已取消这次蛋白粉记录。" });
      return true;
    }
    const intent = parseProteinPhotoIntent(question, date, protein?.intent);
    const needsProteinFlow = intent && (intent.warehouse || intent.logRequested &&
      (!intent.servings.length || intent.servings.some((item) => item.date !== date)));
    if (!protein && !needsProteinFlow) return false;
    if (!intent || !protein && !photo) return false;
    const flow: ProteinFlow = protein ? { ...protein, intent } : {
      id: crypto.randomUUID(), date, meal: photo?.mealChosen ? photo.meal : "加餐", intent,
    };
    if (flow.candidate && confirmsSameProteinProduct(question)) {
      flow.product = combineProteinLabels(flow.product, flow.candidate, true);
      flow.candidate = undefined;
    }
    if (photo?.mealChosen && !flow.retry) flow.meal = photo.meal;
    if (photo || intent.nutritionEstimated && flow.reference && !flow.retry) {
      if (limitMessage) { setError(limitMessage); return true; }
      if (!available) { setError(status); return true; }
      withConsent(() => { void recordProtein(flow, question, owner, photo); });
    } else {
      void recordProtein(flow, question, owner);
    }
    return true;
  }

  async function recordProtein(initial: ProteinFlow, question: string, expectedOwner: string, attachment?: PhotoAttachment) {
    const photoMeal = actions?.photoMeal;
    if (!photoMeal || request.current || writing.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWaiting(true);
    setInput("");
    setError("");
    let flow = initial;
    let photoLimit = limitMessage;
    const updatePhotoQuota = (value: CoachQuota) => {
      updateQuota(value);
      photoLimit = coachLimitMessage(value);
    };
    setProtein(flow);
    const turnId = addTurn("local", attachment && question ? "照片 · " + question : question,
      { replyKind: "loading", localReply: attachment ? "正在读蛋白粉包装…" : "正在核对这次记录…" });
    try {
      if (attachment && !flow.retry) {
        if (photoLimit) throw new Error(photoLimit);
        const result = await recognizeProteinPhoto(attachment.file, expectedOwner, controller.signal, true, updatePhotoQuota);
        if (controller.signal.aborted) return;
        setPhoto(undefined);
        if (result.kind === "product") {
          let product: ProteinPhotoProduct;
          try {
            product = combineProteinLabels(flow.product, result.product);
          } catch (reason) {
            setProtein({ ...flow, candidate: result.product });
            updateTurn(turnId, { replyKind: "meal", localReply: errorText(reason) });
            return;
          }
          flow = { ...flow, reference: flow.reference ?? attachment.file, product, candidate: undefined };
          setProtein(flow);
        } else {
          updateTurn(turnId, { replyKind: "meal", localReply: result.needs.join("\n") });
          return;
        }
      }
      if (!flow.retry) {
        if (flow.candidate) {
          updateTurn(turnId, { replyKind: "meal", localReply: "背标我已保留。如果确实是同一款，点「确认是同一款」继续。" });
          return;
        }
        const prepared = prepareProteinPhoto(flow, photoMeal.proteinProducts);
        let warehouseProduct = prepared.warehouseProduct;
        let draft = "draft" in prepared ? prepared.draft : undefined;
        if (prepared.question) {
          const estimate = "estimate" in prepared ? prepared.estimate : undefined;
          if (!estimate || !flow.intent.nutritionEstimated || !flow.reference) {
            const { scoopsPerCup, milkMl, milkFatPercent, servings } = flow.intent;
            const known = [
              scoopsPerCup && milkMl ? `每杯 ${scoopsPerCup} 勺，加 ${milkMl} mL${milkFatPercent === undefined ? "" : " " + milkFatPercent + "%"} 牛奶` : "",
              ...servings.map(({ date, cups }) => date + (cups ? ` ${cups} 杯` : "")),
            ].filter(Boolean).join(" · ");
            updateTurn(turnId, { replyKind: "meal", localReply: (known ? `已记住 ${known}。\n` : "") + prepared.question,
              proteinFollowup: estimate && flow.reference ? "nutrition" : prepared.question.startsWith("内置") ? "scoop" : undefined });
            return;
          }
          if (photoLimit) throw new Error(photoLimit);
          const notes = `只按该类型蛋白粉的通用参考值估算 ${estimate.powderGrams} 克的总营养。这部分只有蛋白粉，牛奶另外算。使用通用估算，不要当成品牌营养表。`;
          const result = await recognizeMealPhoto(flow.reference, notes, expectedOwner, controller.signal, true, updateQuota);
          if (controller.signal.aborted) return;
          draft = result.kind === "draft" ? addMilkToPowderEstimate(result.draft, estimate) : undefined;
          const powder = result.kind === "draft" ? estimatedPowderPer100g(result.draft, estimate.powderGrams) : undefined;
          if (!draft || !powder || !warehouseProduct) {
            updateTurn(turnId, { replyKind: "meal", localReply: "现在还算不出这杯的营养。请补拍背面的营养表。" });
            return;
          }
          warehouseProduct = { ...warehouseProduct, powder, powderEstimated: true };
        }
        if (!warehouseProduct || !prepared.servings || prepared.servings.length && !draft) {
          throw new Error("还缺少这杯的份量或营养，暂未记入。");
        }
        const submission: CoachProteinSubmission = {
          owner: expectedOwner, product: warehouseProduct, addToWarehouse: flow.intent.warehouse,
          records: prepared.servings.map(({ date, cups }) =>
            ({ id: crypto.randomUUID(), date, meal: flow.meal, draft: draft && multiplyProteinDrink(draft, cups) })),
        };
        flow = { ...flow, retry: submission };
        setProtein(flow);
      }
      const submission = flow.retry;
      if (!submission) return;
      const receipt = await photoMeal.saveProtein(submission);
      if (controller.signal.aborted) return;
      lastProtein.current = { flow: { ...flow, reference: undefined, candidate: undefined, retry: undefined }, saved: submission.product, receipt };
      const confirmed = submission.records.map(({ date }) => date).join("、");
      const warehouse = receipt.warehouse === "added" ? `已把「${submission.product.name}」加到蛋白粉仓库。`
        : receipt.warehouse === "existing" ? `「${submission.product.name}」已在蛋白粉仓库。` : "";
      const diary = receipt.recorded ? `已记入 ${confirmed} 的${submission.records[0].meal}。` : "";
      const workout = receipt.defaultProductId ? "训练结束勾选「已喝蛋白粉」，会按仓库配方记入饮食。" : "";
      updateTurn(turnId, { replyKind: "saved", localReply: [warehouse, diary, workout].filter(Boolean).join("\n"),
        savedMealDate: submission.records.at(-1)?.date, openWarehouse: Boolean(receipt.warehouse) });
      setProtein(undefined);
      setPhoto(undefined);
    } catch (reason) {
      if (!controller.signal.aborted) updateTurn(turnId, {
        localReply: undefined, error: errorText(reason, "这次蛋白粉记录暂未完成，请重试。"),
      });
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setWaiting(false);
      }
    }
  }

  function attachPhoto(file: File) {
    const photoMeal = actions?.photoMeal;
    if (!photoMeal || waiting || limitMessage) return;
    const choice = requestedMeal.current;
    const meal = choice ?? protein?.meal ?? photoMeal.currentMeal();
    requestedMeal.current = undefined;
    try {
      validatePhotoFile(file);
      setPhoto((previous) => previous ? { ...previous, file }
        : { id: crypto.randomUUID(), file, date: asDate(), meal, mealChosen: choice !== undefined, notes: "" });
      setError("");
      setOptionsOpen(false);
      onExpand?.();
    } catch (reason) {
      setError(errorText(reason, "无法打开这张照片，请换一张。"));
    }
  }

  async function savePhotoMeal(turnId: string, submission: CoachMealSubmission) {
    if (!actions?.photoMeal || writing.current || request.current) return;
    writing.current = true;
    setWaiting(true);
    updateTurn(turnId, { error: undefined, unsavedMeal: undefined, replyKind: "loading", localReply: "正在添加到饮食记录…" });
    try {
      const entry = await actions.photoMeal.save(submission);
      updateTurn(turnId, { replyKind: "saved", savedMealDate: submission.date,
        localReply: `已添加到${entry.meal}「${entry.name}」 · ${entry.calories} 千卡 · 蛋白质 ${entry.protein} 克` });
    } catch (reason) {
      updateTurn(turnId, { localReply: undefined, unsavedMeal: submission, error: errorText(reason, "识别已完成，暂时没能添加。") });
    } finally {
      writing.current = false;
      setWaiting(false);
    }
  }

  async function recordPhoto(attachment: PhotoAttachment, question: string, notes: string, expectedOwner: string) {
    if (request.current || writing.current) return;
    const controller = new AbortController();
    request.current = controller;
    setInput("");
    setError("");
    setWaiting(true);
    const turnId = addTurn("local", question ? "照片 · " + question : "照片记饮食",
      { replyKind: "loading", localReply: "正在识别照片和份量…" });
    try {
      const result = await recognizeMealPhoto(attachment.file, notes, expectedOwner, controller.signal, true, updateQuota);
      if (controller.signal.aborted) return;
      if (result.kind === "needs") {
        setPhoto({ ...attachment, notes });
        updateTurn(turnId, { replyKind: "meal", localReply: result.needs.join("\n") });
        return;
      }
      setPhoto(undefined);
      request.current = null;
      await savePhotoMeal(turnId, {
        owner: expectedOwner, id: attachment.id, date: attachment.date, meal: attachment.meal, draft: result.draft,
      });
    } catch (reason) {
      if (!controller.signal.aborted) {
        setInput(question);
        updateTurn(turnId, { localReply: undefined, error: errorText(reason, "照片未能识别，请检查网络后重试。") });
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setWaiting(false);
      }
    }
  }

  async function recordWeight(turnId: string, record: WeightRecord) {
    if (!actions?.saveWeight || writing.current || request.current) return;
    writing.current = true;
    setWaiting(true);
    updateTurn(turnId, { error: undefined, replyKind: "loading", localReply: "正在保存体重…" });
    try {
      await actions.saveWeight(record);
      failedWeight.current = undefined;
      setWeightPrompt(undefined);
      updateTurn(turnId, { replyKind: "saved", localReply: `已记录 ${record.date} 的体重 ${record.kg} kg。` });
    } catch (reason) {
      failedWeight.current = record;
      updateTurn(turnId, { localReply: undefined, error: errorText(reason, "体重还没保存，请重试。") });
    } finally {
      writing.current = false;
      setWaiting(false);
    }
  }

  async function saveDraft(turn: Turn, todayIndex?: number) {
    if (!actions?.saveDraft || !turn.items || writing.current || request.current) return;
    const date = asDate();
    const chosen = todayIndex === undefined ? turn.items : [turn.items[todayIndex]];
    const items = chosen.map(({ id, todayId, data }) => todayIndex !== undefined && data.date !== date
      ? { id: todayId, data: { ...data, date, shared: false } }
      : { id, data: { ...data, shared: false } });
    writing.current = true;
    setWaiting(true);
    updateTurn(turn.id, { saveError: undefined });
    try {
      await actions.saveDraft(items);
      const savedToday = new Set(turn.addedToday);
      if (todayIndex === undefined) turn.items.forEach(({ data }, index) => { if (data.date === date) savedToday.add(index); });
      else savedToday.add(todayIndex);
      updateTurn(turn.id, { saved: turn.saved || todayIndex === undefined ||
        turn.items.length === 1 && turn.items[0].data.date === date, addedToday: savedToday });
      addTurn("local", "", { replyKind: "saved", localReply: todayIndex === undefined
        ? items.length === 1 ? `「${items[0].data.title}」已在 ${items[0].data.date} 的训练日程。` : `这 ${items.length} 节训练已在日程里。`
        : `「${items[0].data.title}」已加入今天的训练。` });
    } catch (reason) {
      updateTurn(turn.id, { saveError: errorText(reason, "计划还没保存，请重试。") });
    } finally {
      writing.current = false;
      setWaiting(false);
    }
  }

  function submitQuestion(value: string, fromSuggestion = false) {
    const question = value.trim();
    if (!question || request.current || writing.current || limitMessage) return;
    setError("");
    const clearInput = () => { if (!fromSuggestion) setInput(""); };
    const localDate = asDate();
    const weight = weightDialogue(question, weightPrompt ?? false);
    if (weight.kind !== "pass") {
      clearInput();
      if (!owner || !actions?.saveWeight) {
        addTurn("local", question, { replyKind: "weight", localReply: "请先登录训练搭子，再记体重。" });
      } else if (weight.kind === "ask" || weight.kind === "cancel") {
        if (weight.kind === "ask") setWeightPrompt(weight);
        else { setWeightPrompt(undefined); failedWeight.current = undefined; }
        addTurn("local", question, { replyKind: "weight", localReply: weight.message });
      } else {
        const date = weight.date ?? offsetDate(localDate, weight.dayOffset ?? 0);
        if (date > localDate) {
          setWeightPrompt({ dateRequired: true });
          addTurn("local", question, { replyKind: "weight", localReply: "体重记录需要实际测量的日期。请告诉我今天或之前的日期和体重。" });
          return;
        }
        const previous = failedWeight.current;
        const record = previous?.date === date && previous.kg === weight.kg ? previous : { id: crypto.randomUUID(), date, kg: weight.kg };
        const id = addTurn("local", question, { weight: record });
        void recordWeight(id, record);
      }
      return;
    }
    if (weight.clearPending) setWeightPrompt(undefined);

    const stats = actions?.trainingStats?.(question, localDate);
    if (stats) {
      clearInput();
      addTurn("local", question, typeof stats === "string" ? { replyKind: "stats", localReply: stats }
        : { replyKind: "stats", localReply: stats.reply, activity: stats });
      return;
    }

    const meal = question.match(/^(?:(?:我想|我要|帮我|给我|拍照)\s*)*(?:拍照记饮食|记饮食|记录饮食|记(?:录)?(早餐|午餐|晚餐|加餐)|拍照识别餐食)[。！!？? ]*$/u);
    if (meal) {
      clearInput();
      if (actions?.photoMeal && available) {
        if (photo) composer.current?.focus();
        else {
          addTurn("local", question, { replyKind: "meal", localReply: "点输入栏旁的拍照或相册。写下份量后发送，识别完成就会记入饮食。" });
          requestedMeal.current = meal[1] as MealEntry["meal"] | undefined;
          cameraInput.current?.click();
        }
      } else if (!actions?.logMeal) addTurn("local", question, { replyKind: "meal", localReply: "登录并启用饮食功能后，可以在这里拍照记餐。" });
      else if (!mealPhoto) {
        addTurn("local", question, { replyKind: "meal", localReply: "拍一张餐食照片或从相册选图。我会填出份量和营养，你核对后再保存。" });
        actions.logMeal(meal[1] as MealEntry["meal"] | undefined);
      }
      return;
    }
    if (/^(?:我想|我要|帮我|现在|今天)*\s*(?:开始训练|开始练|开练)[。！!？? ]*$/u.test(question)) {
      clearInput();
      addTurn("local", question, { replyKind: "workout", localReply: "准备好后，可以选一堂今天的训练或开始自由训练。", action: "workout" });
      return;
    }

    const pending = latestModelTurn && !latestModelTurn.items ? latestModelTurn.window : undefined;
    if (latestModelTurn && pending && /^(?:取消|先不排了|不排了|算了|cancel)[。！! ]*$/iu.test(question)) {
      clearInput();
      updateTurn(latestModelTurn.id, { window: undefined });
      setRevisionTarget(undefined);
      addTurn("local", question, { localReply: "已结束这次计划讨论。" });
      return;
    }
    if (!owner || !available) {
      setError(status);
      return;
    }
    const freshPlan = asksForTrainingPlan(question);
    const target = revisionTarget ? turns.find((turn) => turn.id === revisionTarget)
      : !freshPlan && (asksToReviseDraft(question) || pending && latestModelTurn?.kind === "revision") ? latestDraft : undefined;
    const priorDraft = target?.response?.draft;
    const draftWindow = freshPlan || pending || priorDraft
      ? draftWindowFor(question, localDate, target?.window ?? pending, priorDraft?.plans) : undefined;
    const date = draftWindow?.date ?? (fromSuggestion ? selectedDate : chatDate);
    if (!date) { setError("请选择要附上的训练日期。"); return; }
    askCoach({
      expectedOwner: owner, messages: recentMessages(turns, question), model: coachModel,
      ...(draftWindow ? { ...draftWindow, intent: "draft" as const, priorDraft, includePlans: !priorDraft && includePlans, contextRange }
        : { intent: "chat" as const, date, includePlans: !fromSuggestion && includePlans, contextRange }),
    }, () => {
      const id = addTurn(priorDraft ? "revision" : draftWindow ? "plan" : "chat", question);
      if (draftWindow) onExpand?.();
      clearInput();
      return {
        receive(response) {
          const items = response.draft?.plans.map((data) => ({ id: crypto.randomUUID(), todayId: crypto.randomUUID(), data }));
          updateTurn(id, { response, window: draftWindow, items });
          if (items) {
            if (target && !target.saved && !target.addedToday?.size) updateTurn(target.id, { superseded: true, saveError: undefined });
            setRevisionTarget(undefined);
          }
        },
        showError(message) {
          updateTurn(id, { error: message });
          setInput((draft) => draft || question);
        },
      };
    });
  }

  return <section className="coach-surface" aria-label="AI 教练对话">
    <div className="coach-conversation">
      {!turns.length && !mealPhoto ? <CoachWelcome compact={compact} actions={actions} blocked={Boolean(limitMessage)} send={(question) => submitQuestion(question, true)} /> : <>
        <div className="coach-thread-controls"><button className="button outline small" type="button" onClick={clearConversation} disabled={waiting}>
          <MessageSquarePlus size={17} aria-hidden="true" />新对话
        </button></div>
      <ol className="coach-thread" aria-label="对话记录">
          {turns.map((turn) => {
            const { id, kind, question, response, localReply, savedMealDate } = turn;
            const draft = response?.draft?.plans;
            const replyKind = turn.replyKind ?? (draft ? "plan" : kind === "plan" || kind === "revision" ? "question" : "chat");
            return <li className="coach-turn" key={id}>
              {question && <div className="coach-own-message"><span className="sr-only">你</span><p>{question}</p></div>}
              {(response || localReply) && <CoachReplyCard kind={replyKind} reply={localReply ?? response?.reply}
                activity={turn.activity} weight={replyKind === "saved" ? turn.weight : undefined}>
                {turn.action === "workout" && actions?.startWorkout && <button className="button outline small coach-reply-action" type="button"
                  onClick={actions.startWorkout}><Dumbbell size={16} aria-hidden="true" />选择训练</button>}
                {savedMealDate && actions?.photoMeal && <button className="button outline small coach-reply-action" type="button"
                  onClick={() => actions.photoMeal?.view(savedMealDate)}>查看饮食记录</button>}
                {turn.drink && <button className="button outline small coach-reply-action" type="button"
                  disabled={waiting} onClick={() => void undoSavedDrink(turn)}>撤销记录</button>}
                {turn.openWarehouse && actions?.photoMeal && <button className="button outline small coach-reply-action" type="button"
                  onClick={actions.photoMeal.viewWarehouse}>打开蛋白粉仓库</button>}
                {protein?.candidate && id === lastTurn?.id && <button className="button primary small coach-reply-action"
                  type="button" disabled={waiting} onClick={() => replyToProtein("确认是同一款")}>确认是同一款</button>}
                {protein && id === lastTurn?.id && turn.proteinFollowup && <button className="button outline small coach-reply-action"
                  type="button" disabled={waiting} onClick={() => replyToProtein(turn.proteinFollowup === "scoop" ? "按 30 克估" : "先按估算记")}>
                  {turn.proteinFollowup === "scoop" ? "按 30 g 估" : "采用估算营养"}
                </button>}
                {protein && id === lastTurn?.id && turn.proteinFollowup && <button className="button outline small coach-reply-action"
                  type="button" disabled={waiting || !available || Boolean(limitMessage)} onClick={() => cameraInput.current?.click()}>拍营养表</button>}
                {draft && actions?.saveDraft && <ChatTrainingDraft draft={draft} today={today} saved={Boolean(turn.saved)} busy={waiting}
                  addedToday={turn.addedToday} error={turn.saveError} superseded={turn.superseded}
                  onSave={() => void saveDraft(turn)} onAddToday={(index) => void saveDraft(turn, index)}
                  onRevise={() => { setRevisionTarget(id); composer.current?.focus(); }} />}
              </CoachReplyCard>}
              {turn.error && <CoachReplyCard kind="error" reply={turn.error}>
                {turn.weight && failedWeight.current?.id === turn.weight.id && <button className="button outline small coach-reply-action"
                  type="button" disabled={waiting} onClick={() => { if (turn.weight) void recordWeight(id, turn.weight); }}>重试保存</button>}
                {turn.unsavedMeal && <button className="button primary small coach-reply-action" type="button" disabled={waiting}
                  onClick={() => { if (turn.unsavedMeal) void savePhotoMeal(id, turn.unsavedMeal); }}>添加到{turn.unsavedMeal.meal}</button>}
                {protein?.retry && id === lastTurn?.id && <button className="button primary small coach-reply-action"
                  type="button" disabled={waiting} onClick={() => replyToProtein("重试保存")}>重试保存</button>}
              </CoachReplyCard>}
              {kind !== "local" && !response && !turn.error && <CoachReplyCard kind="loading" reply="教练正在回复" />}
            </li>;
          })}
          {mealPhoto && <li className="coach-photo-tool" ref={photoPosition}>
            <CoachPhotoQuota.Provider value={{ limitMessage, updateQuota }}>{mealPhoto}</CoachPhotoQuota.Provider>
            {onDismissMeal && <button className="text-button" type="button" onClick={onDismissMeal}>取消这次记餐</button>}
          </li>}
          <li ref={transcriptEnd} className="coach-thread-anchor" aria-hidden="true" />
        </ol>
      </>}
    </div>
    <div className="coach-composer">
      {showSuggestions && <div className="coach-suggestions" role="group" aria-label="推荐对话">
        {openingSuggestions.filter((question) => question !== "拍照记饮食" || actions?.logMeal)
          .map((question) => <button key={question} type="button" onClick={() => submitQuestion(question, true)}>{question}</button>)}
      </div>}
      <div className="coach-quick-actions">
        {actions?.photoMeal && <CoachPhotoPickers cameraInput={cameraInput} disabled={waiting || !available || Boolean(limitMessage)}
          onPick={() => { requestedMeal.current = undefined; }} onFile={attachPhoto} />}
        {available && !photo && !protein && !revisionTarget && <button className="coach-quick-button" type="button" disabled={waiting} aria-expanded={optionsOpen}
          aria-controls="coach-context" onClick={() => setOptionsOpen(!optionsOpen)}>
          <SlidersHorizontal size={15} aria-hidden="true" />{includePlans ? "已附上训练安排" : "对话选项"}
        </button>}
      </div>
      {optionsOpen && available && !photo && !protein && !revisionTarget && <div className="coach-context-options form-fields" id="coach-context">
        <label className="toggle-label"><input type="checkbox" checked={includePlans} disabled={waiting}
          onChange={(event) => setIncludePlans(event.target.checked)} />附上个人训练安排</label>
        {includePlans && <div className="coach-context-fields">
          <label>计划日期<input type="date" required value={chatDate} disabled={waiting} onChange={(event) => setContextDate(event.target.value)} /></label>
          <label>安排范围<select value={contextRange} disabled={waiting}
            onChange={(event) => setContextRange(event.target.value === "day" ? "day" : "week")}>
            <option value="day">所选日期</option><option value="week">所在周</option>
          </select></label>
        </div>}
      </div>}
      {revisionTarget && <div className="coach-revision-note">
        <span>正在调整选中的训练草稿</span><button type="button" className="text-button" disabled={waiting} onClick={() => setRevisionTarget(undefined)}>取消</button>
      </div>}
      {protein && <div className="coach-revision-note">
        <span>正在补充蛋白粉记录</span><button type="button" className="text-button" disabled={waiting}
          onClick={() => replyToProtein("取消本次")}>取消本次</button>
      </div>}
      {photo && <CoachPhotoAttachment file={photo.file} meal={photo.meal} active={active} disabled={waiting}
        onMeal={(meal) => setPhoto({ ...photo, meal, mealChosen: true })} onRemove={() => { setPhoto(undefined); setError(""); }}
        onDictate={(text) => setInput((current) => [current.trim(), text].filter(Boolean).join(" ").slice(0, maxPhotoNoteLength))}
        onFocus={() => composer.current?.focus()} />}
      {savedDrink && savedDrink.request.expectedOwner === owner && !photo && <div className="coach-revision-note">
        {savedDrink.options?.map((option) => <button className="button outline small" type="button" key={option.id}
          disabled={waiting || Boolean(limitMessage)} onClick={() => void recordSavedDrink({ ...savedDrink.request, productId: option.id })}>{option.name}</button>)}
        {savedDrink.duplicate ? <button className="button outline small" type="button" disabled={waiting || Boolean(limitMessage)}
          onClick={() => void recordSavedDrink({ ...savedDrink.request, anotherCup: true })}>刚喝了另一杯，继续记</button>
          : <button className="text-button" type="button" onClick={() => setSavedDrink(undefined)} disabled={waiting}>取消这次记录</button>}
      </div>}
      <form className="coach-composer-field" onSubmit={send} aria-busy={waiting}>
        <label className="sr-only" htmlFor="coach-chat-input">给 AI 教练发消息</label>
        <textarea id="coach-chat-input" rows={1} ref={composer} maxLength={photo ? maxPhotoNoteLength : maxCoachMessageLength} value={input} disabled={waiting}
          aria-describedby={!available || canRetry || limitMessage ? "coach-composer-notice" : undefined} placeholder={protein ? "继续补充这杯的资料…" : photo ? photo.notes ? "补充份量或食物…" : "例如 200 mL 牛奶、1 勺蛋白粉"
            : weightPrompt ? "例如 80.5 kg" : revisionTarget ? "想怎么调整这份草稿？" : "问问 Spotter 教练…"}
          onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} />
        {photo ? <button className="coach-send coach-send-meal" type="submit" disabled={waiting || !available || Boolean(limitMessage)}>识别并记餐</button>
          : <button className="coach-send" type="submit" aria-label="发送消息" disabled={waiting || !input.trim() || Boolean(limitMessage)}><ArrowUp size={20} aria-hidden="true" /></button>}
      </form>
      {error && <p className="inline-error coach-composer-notice" role="alert">{error}</p>}
      {(!available || canRetry || limitMessage) && <div className="coach-composer-note">
        <div id="coach-composer-notice">
          {!available && <p className="coach-composer-notice" role="status">{status}</p>}
          {limitMessage && <p className="coach-composer-notice" role="status">{limitMessage}</p>}
        </div>
        {limitMessage && !canRetry && <button className="text-button" type="button" onClick={() => setCheck((value) => value + 1)}>刷新额度</button>}
        {canRetry && <button className="text-button" type="button" onClick={() => { setAvailability(undefined); setCheck((value) => value + 1); }}>重试</button>}
      </div>}
    </div>
    {sharingPrompt}
  </section>;
}
