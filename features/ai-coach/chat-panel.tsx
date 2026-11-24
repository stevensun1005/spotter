"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, CalendarDays, Camera, ChartNoAxesColumn, Dumbbell, MessageSquarePlus,
  Scale, SlidersHorizontal } from "lucide-react";
import { asDate, offsetDate } from "@/shared/dates";
import { errorText } from "@/shared/client";
import type { PlannedWorkout } from "@/features/plans/model";
import type { MealEntry } from "@/features/library/model";
import { ChatTrainingDraft } from "./chat-draft";
import { asksForTrainingPlan } from "./chat-intent";
import { asksToReviseDraft, draftWindowFor, type DraftWindow } from "./plan-conversation";
import { weightDialogue, type PendingWeight } from "./weight-dialogue";
import { coachModel, maxCoachConversationLength, maxCoachMessageLength, maxCoachMessages,
  type CoachConfig, type CoachRequest, type CoachResponse } from "./model";

type WeightRecord = { id: string; date: string; kg: number };
export type CoachActions = {
  logMeal?: (meal?: MealEntry["meal"]) => void;
  trainingStats?: (message: string, date: string) => string | undefined;
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
  action?: "workout";
  weight?: WeightRecord;
  window?: DraftWindow;
  items?: (PlannedWorkout & { todayId: string })[];
  saved?: boolean;
  addedToday?: ReadonlySet<number>;
  superseded?: boolean;
  saveError?: string;
  error?: string;
};
type Availability = CoachConfig | { error: string };

const endpoint = "/api/ai-coach";
const planRequest = "帮我制定训练计划";
const openingSuggestions = ["记体重", "看本周训练统计", planRequest, "拍照记饮食"];
const shortcutCards = [
  { key: "logMeal", title: "拍照记饮食", prompt: "拍照记饮食", icon: Camera, tone: "apricot" },
  { key: "trainingStats", title: "训练统计", prompt: "看本周训练统计", icon: ChartNoAxesColumn, tone: "blue" },
  { key: "saveWeight", title: "记体重", prompt: "记体重", icon: Scale, tone: "violet" },
  { key: "startWorkout", title: "开始训练", prompt: "开始训练", icon: Dumbbell, tone: "moss" },
] as const;

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

function CoachWelcome({ compact, actions, send }: { compact?: boolean; actions?: CoachActions; send: (question: string) => void }) {
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
      <button className="coach-home-task coach-home-task-plan" type="button" onClick={() => send(planRequest)}>
        <span className="coach-task-icon"><CalendarDays size={21} aria-hidden="true" /></span>
        <strong>生成计划</strong>
      </button>
      {shortcutCards.map(({ key, title, prompt, icon: Icon, tone }) => {
        return actions?.[key] && <button className="coach-home-task" type="button" key={key} onClick={() => send(prompt)}>
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
  const request = useRef<AbortController>(null);
  const writing = useRef(false);
  const processedMeal = useRef<string | undefined>(undefined);
  const failedWeight = useRef<WeightRecord | undefined>(undefined);
  const composer = useRef<HTMLTextAreaElement>(null);
  const photoPosition = useRef<HTMLLIElement>(null);
  const transcriptEnd = useRef<HTMLLIElement>(null);
  const nextTurn = useRef(0);

  const latestModelTurn = turns.findLast((turn) => turn.kind !== "local" && turn.response);
  const latestDraft = turns.findLast((turn) => turn.items && turn.window && !turn.superseded);
  const available = !!owner && availability && "enabled" in availability && availability.enabled;
  const chatDate = includePlans ? contextDate ?? selectedDate : selectedDate;
  const lastTurn = turns.at(-1);
  const showSuggestions = Boolean(compact && !waiting && !lastTurn && !mealPhoto && !optionsOpen);

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
        if (!controller.signal.aborted) setAvailability(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability({ error: "暂时无法检查 AI 教练状态。" });
      });
    return () => controller.abort();
  }, [active, owner, check]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!active) return;
    if (mealPhotoId && photoPosition.current) photoPosition.current.scrollIntoView({ block: "start" });
    else if (lastTurn) transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [active, compact, lastTurn, mealPhotoId]);

  useEffect(() => {
    if (!mealResult || processedMeal.current === mealResult.id) return;
    processedMeal.current = mealResult.id;
    setTurns((previous) => [...previous, { id: mealResult.id, kind: "local", question: "", localReply: mealResult.message }]);
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
    setError("");
    setRevisionTarget(undefined);
    setWeightPrompt(undefined);
    failedWeight.current = undefined;
    onDismissMeal?.();
    setOptionsOpen(false);
    setIncludePlans(false);
  }

  async function askCoach(payload: CoachRequest, receive: (result: CoachResponse) => void, showError: (message: string) => void) {
    if (!available || request.current) return;
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
    submitQuestion(input);
  }

  async function recordWeight(turnId: string, record: WeightRecord) {
    if (!actions?.saveWeight || writing.current || request.current) return;
    writing.current = true;
    setWaiting(true);
    updateTurn(turnId, { error: undefined, localReply: "正在保存体重…" });
    try {
      await actions.saveWeight(record);
      failedWeight.current = undefined;
      setWeightPrompt(undefined);
      updateTurn(turnId, { localReply: `已记录 ${record.date} 的体重 ${record.kg} kg。` });
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
      addTurn("local", "", { localReply: todayIndex === undefined
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
    if (!question || request.current || writing.current) return;
    setError("");
    const clearInput = () => { if (!fromSuggestion) setInput(""); };
    const localDate = asDate();
    const weight = weightDialogue(question, weightPrompt ?? false);
    if (weight.kind !== "pass") {
      clearInput();
      if (!owner || !actions?.saveWeight) {
        addTurn("local", question, { localReply: "请先登录训练搭子，再记体重。" });
      } else if (weight.kind === "ask" || weight.kind === "cancel") {
        if (weight.kind === "ask") setWeightPrompt(weight);
        else { setWeightPrompt(undefined); failedWeight.current = undefined; }
        addTurn("local", question, { localReply: weight.message });
      } else {
        const date = weight.date ?? offsetDate(localDate, weight.dayOffset ?? 0);
        if (date > localDate) {
          setWeightPrompt({ dateRequired: true });
          addTurn("local", question, { localReply: "体重记录需要实际测量的日期。请告诉我今天或之前的日期和体重。" });
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
      addTurn("local", question, { localReply: stats });
      return;
    }

    const meal = question.match(/^(?:(?:我想|我要|帮我|给我|拍照)\s*)*(?:拍照记饮食|记饮食|记录饮食|记(?:录)?(早餐|午餐|晚餐|加餐)|拍照识别餐食)[。！!？? ]*$/u);
    if (meal) {
      clearInput();
      if (!actions?.logMeal) addTurn("local", question, { localReply: "登录并启用饮食功能后，可以在这里拍照记餐。" });
      else if (!mealPhoto) {
        addTurn("local", question, { localReply: "拍一张餐食照片或从相册选图。我会填出份量和营养，你核对后再保存。" });
        actions.logMeal(meal[1] as MealEntry["meal"] | undefined);
      }
      return;
    }
    if (/^(?:我想|我要|帮我|现在|今天)*\s*(?:开始训练|开始练|开练)[。！!？? ]*$/u.test(question)) {
      clearInput();
      addTurn("local", question, { localReply: "准备好后，可以选一堂今天的训练或开始自由训练。", action: "workout" });
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
    const id = addTurn(priorDraft ? "revision" : draftWindow ? "plan" : "chat", question);
    if (draftWindow) onExpand?.();
    clearInput();
    void askCoach({
      expectedOwner: owner, messages: recentMessages(turns, question), model: coachModel,
      ...(draftWindow ? { ...draftWindow, intent: "draft" as const, priorDraft, includePlans: !priorDraft && includePlans, contextRange }
        : { intent: "chat" as const, date, includePlans: !fromSuggestion && includePlans, contextRange }),
    }, (response) => {
      const items = response.draft?.plans.map((data) => ({ id: crypto.randomUUID(), todayId: crypto.randomUUID(), data }));
      updateTurn(id, { response, window: draftWindow, items });
      if (items) {
        if (target && !target.saved && !target.addedToday?.size) updateTurn(target.id, { superseded: true, saveError: undefined });
        setRevisionTarget(undefined);
      }
    }, (message) => {
      updateTurn(id, { error: message });
      setInput((draft) => draft || question);
    });
  }

  return <section className="coach-surface" aria-label="AI 教练对话">
    <div className="coach-conversation">
      {!turns.length && !mealPhoto ? <CoachWelcome compact={compact} actions={actions} send={(question) => submitQuestion(question, true)} /> : <>
        <div className="coach-thread-controls"><button className="button outline small" type="button" onClick={clearConversation} disabled={waiting}>
          <MessageSquarePlus size={17} aria-hidden="true" />新对话
        </button></div>
        <ol className="coach-thread" aria-label="对话记录">
          {turns.map((turn) => {
            const { id, kind, question, response, localReply } = turn;
            const draft = response?.draft?.plans;
            return <li className="coach-turn" key={id}>
              {question && <div className="coach-own-message"><span className="sr-only">你</span><p>{question}</p></div>}
              {(response || localReply) && <div className={draft ? "coach-reply coach-reply-draft" : "coach-reply"} aria-live="polite">
                <div className="coach-reply-byline"><span>Spotter 教练</span></div>
                <p>{localReply ?? response?.reply}</p>
                {turn.action === "workout" && actions?.startWorkout && <button className="button outline small coach-reply-action" type="button"
                  onClick={actions.startWorkout}>选择训练</button>}
                {draft && actions?.saveDraft && <ChatTrainingDraft draft={draft} today={today} saved={Boolean(turn.saved)} busy={waiting}
                  addedToday={turn.addedToday} error={turn.saveError} superseded={turn.superseded}
                  onSave={() => void saveDraft(turn)} onAddToday={(index) => void saveDraft(turn, index)}
                  onRevise={() => { setRevisionTarget(id); composer.current?.focus(); }} />}
              </div>}
              {turn.error && <div className="coach-turn-status inline-error" role="alert">{turn.error}
                {turn.weight && failedWeight.current?.id === turn.weight.id && <button className="button outline small coach-reply-action"
                  type="button" disabled={waiting} onClick={() => { if (turn.weight) void recordWeight(id, turn.weight); }}>重试保存</button>}
              </div>}
              {kind !== "local" && !response && !turn.error && <p className="coach-turn-status" role="status">教练正在回复…</p>}
            </li>;
          })}
          {mealPhoto && <li className="coach-photo-tool" ref={photoPosition}>
            {mealPhoto}
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
        {available && !revisionTarget && <button className="coach-quick-button" type="button" disabled={waiting} aria-expanded={optionsOpen}
          aria-controls="coach-context" onClick={() => setOptionsOpen(!optionsOpen)}>
          <SlidersHorizontal size={15} aria-hidden="true" />{includePlans ? "已附上训练安排" : "对话选项"}
        </button>}
      </div>
      {optionsOpen && available && !revisionTarget && <div className="coach-context-options form-fields" id="coach-context">
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
      <form className="coach-composer-field" onSubmit={send} aria-busy={waiting}>
        <label className="sr-only" htmlFor="coach-chat-input">给 AI 教练发消息</label>
        <textarea id="coach-chat-input" rows={1} ref={composer} maxLength={maxCoachMessageLength} value={input} disabled={waiting}
          aria-describedby="coach-composer-notice" placeholder={weightPrompt ? "例如 80.5 kg" : revisionTarget ? "想怎么调整这份草稿？" : "问问 Spotter 教练…"}
          onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} />
        <button className="coach-send" type="submit" aria-label="发送消息" disabled={waiting || !input.trim()}><ArrowUp size={20} aria-hidden="true" /></button>
      </form>
      {error && <p className="inline-error coach-composer-notice" role="alert">{error}</p>}
      <div className="coach-composer-note">
        <p id="coach-composer-notice" className="coach-composer-notice" role="status">
          {available ? "记体重和查统计在训练搭子内处理。训练问答会发送相关对话给 Anthropic。" : status}
        </p>
        {canRetry && <button className="text-button" type="button" onClick={() => { setAvailability(undefined); setCheck((value) => value + 1); }}>重试</button>}
      </div>
    </div>
  </section>;
}
