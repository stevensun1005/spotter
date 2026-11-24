"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, CalendarDays, Camera, ChartNoAxesColumn, ClipboardList, Dumbbell, MessageSquarePlus,
  Scale, SlidersHorizontal } from "lucide-react";
import type { Plan } from "@/features/plans/model";
import { asksForTrainingPlan } from "./chat-intent";
import { guidedMessage } from "./guided";
import { GuidedCoachPanel, type GuidedCoachSelection } from "./guided-panel";
import { coachModel, maxCoachConversationLength, maxCoachMessageLength, maxCoachMessages,
  type CoachConfig, type CoachRequest, type CoachResponse } from "./model";

export type CoachShortcuts = {
  logMeal?: () => void;
  trainingStats?: () => void;
  logWeight?: () => void;
  startWorkout?: () => void;
};

type DateWindow = { date: string; draftDays: number };
type Turn = {
  id: string;
  kind: "chat" | "guide" | "revision";
  question: string;
  response?: CoachResponse;
  window?: DateWindow;
  cancelled?: boolean;
  error?: string;
};
type Availability = CoachConfig | { error: string };

const endpoint = "/api/ai-coach";
const planRequest = "帮我制定训练计划";
const openingSuggestions = ["今天怎么热身？", "想轻松动一动"];
const replySuggestions = ["能给个简单例子吗？", "能给个更轻松的版本吗？"];
const shortcutCards = [
  { key: "logMeal", title: "拍照记饮食", detail: "拍照或选图，核对营养后保存", icon: Camera, tone: "apricot" },
  { key: "trainingStats", title: "训练统计", detail: "查看记录与训练趋势", icon: ChartNoAxesColumn, tone: "blue" },
  { key: "logWeight", title: "记体重", detail: "记录今天的体重", icon: Scale, tone: "violet" },
  { key: "startWorkout", title: "开始训练", detail: "选一堂计划或自由训练", icon: Dumbbell, tone: "moss" },
] as const;

function recentMessages(turns: Turn[], question: string): CoachRequest["messages"] {
  const messages: CoachRequest["messages"] = [{ role: "user", content: question }];
  let size = question.length;
  for (let index = turns.length - 1; index >= 0 && messages.length + 2 <= maxCoachMessages; index--) {
    const { kind, question: previous, response } = turns[index];
    if (kind === "guide" || !response) continue;
    const { reply } = response;
    if (reply.length > maxCoachMessageLength || size + previous.length + reply.length > maxCoachConversationLength) break;
    messages.unshift({ role: "user", content: previous }, { role: "assistant", content: reply });
    size += previous.length + reply.length;
  }
  return messages;
}

function DraftPreview({ draft, saved, onReview }: { draft: Plan[]; saved: boolean; onReview: () => void }) {
  return <div className="coach-draft-preview">
    <span className="coach-draft-preview-icon"><ClipboardList size={19} aria-hidden="true" /></span>
    <div><strong>训练草稿</strong><p>{saved ? "已保存到训练日历" : `${draft.length} 个计划，待你核对`}</p></div>
    {!saved && <button className="button small outline" type="button" onClick={onReview}>核对与编辑</button>}
  </div>;
}

function CoachWelcome({ compact, shortcuts, startPlan }: { compact?: boolean; shortcuts?: CoachShortcuts; startPlan: () => void }) {
  if (compact) return <div className="coach-welcome-compact">
    <h2>今天想怎么练？</h2><p>聊聊热身、训练动作，或一起安排今天的运动。</p>
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
      <button className="coach-home-task coach-home-task-plan" type="button" onClick={startPlan}>
        <span className="coach-task-icon"><CalendarDays size={21} aria-hidden="true" /></span>
        <strong>生成计划</strong>
        <small>回答几步，定制训练草稿</small>
      </button>
      {shortcutCards.map(({ key, title, detail, icon: Icon, tone }) => {
        const action = shortcuts?.[key];
        return action && <button className="coach-home-task" type="button" key={key} onClick={action}>
          <span className="coach-task-icon" data-tone={tone}><Icon size={21} aria-hidden="true" /></span>
          <strong>{title}</strong>
          <small>{detail}</small>
        </button>;
      })}
    </div>
  </div>;
}

export function AiCoachPanel({ active, compact, onExpand, owner, selectedDate, onReview, savedDrafts, resumeReview, shortcuts }: {
  active: boolean; compact?: boolean; onExpand?: () => void; owner?: string; selectedDate: string; onReview: (plans: Plan[]) => void;
  savedDrafts: ReadonlySet<Plan[]>; resumeReview?: () => void; shortcuts?: CoachShortcuts;
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
  const [revising, setRevising] = useState(false);
  const request = useRef<AbortController>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const planQuestion = useRef<HTMLDivElement>(null);
  const transcriptEnd = useRef<HTMLLIElement>(null);
  const nextTurn = useRef(0);

  const currentGuide = turns.find((turn) => turn.kind === "guide" && !turn.cancelled && !turn.response?.draft);
  const latestDraft = [...turns].reverse().find((turn) => turn.response?.draft && turn.window);
  const available = !!owner && availability && "enabled" in availability && availability.enabled;
  const chatDate = includePlans ? contextDate ?? selectedDate : selectedDate;
  const lastTurn = turns.at(-1);
  const showSuggestions = !waiting && !currentGuide && !revising && !optionsOpen && !includePlans;
  const showSuggestedQuestions = showSuggestions && available && (!lastTurn || lastTurn.kind === "chat" && lastTurn.response);
  const suggestedQuestions = lastTurn ? replySuggestions : openingSuggestions;
  const suggestPlan = compact && showSuggestions && !lastTurn;

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
    if (!active || !turns.length) return;
    if (currentGuide && lastTurn?.id === currentGuide.id && !currentGuide.response) {
      planQuestion.current?.scrollIntoView({ block: "nearest" });
    } else {
      transcriptEnd.current?.scrollIntoView({ block: "end" });
    }
  }, [active, compact, currentGuide, lastTurn, turns.length]);

  function updateTurn(id: string, patch: Partial<Turn>) {
    setTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, ...patch } : turn));
  }

  function addTurn(kind: Turn["kind"], question: string) {
    const id = String(++nextTurn.current);
    setTurns((previous) => [...previous, { id, kind, question }]);
    return id;
  }

  function focusGuide() {
    const target = planQuestion.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }

  function startPlan(question = planRequest) {
    if (request.current) return;
    setError("");
    onExpand?.();
    if (currentGuide) {
      focusGuide();
      return;
    }
    addTurn("guide", question);
    setRevising(false);
    setOptionsOpen(false);
  }

  function clearConversation() {
    if (request.current) return;
    setTurns([]);
    setInput("");
    setError("");
    setRevising(false);
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

  const status = !owner ? "登录后可使用 AI 对话。你可以先填写定制问答。" : !availability ? "正在检查 AI 教练状态…"
    : "error" in availability ? availability.error : "AI 对话尚未启用。你可以先填写定制问答。";
  const canRetry = !!owner && availability && "error" in availability;

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input);
  }

  function submitQuestion(value: string, fromSuggestion = false) {
    const question = value.trim();
    if (!question || request.current) return;
    if (!revising && asksForTrainingPlan(question)) {
      if (!fromSuggestion && !currentGuide) setInput("");
      startPlan(question);
      return;
    }
    if (!owner || !available) {
      setError(status);
      return;
    }
    const target = revising ? latestDraft : undefined;
    const priorDraft = target?.response?.draft;
    const draftWindow = target?.window;
    const date = fromSuggestion ? selectedDate : chatDate;
    if (!date && !draftWindow) {
      setError("请选择要附上的训练日期。");
      return;
    }
    const id = addTurn(priorDraft ? "revision" : "chat", question);
    if (!fromSuggestion) setInput("");
    void askCoach({
      expectedOwner: owner, messages: recentMessages(turns, question), model: coachModel,
      ...(priorDraft && draftWindow ? { ...draftWindow, intent: "draft" as const, priorDraft, includePlans: false }
        : { intent: "chat" as const, date, includePlans: !fromSuggestion && includePlans, contextRange }),
    }, (response) => {
      updateTurn(id, { response, window: draftWindow });
      setRevising(false);
    }, (message) => {
      updateTurn(id, { error: message });
      setInput((draft) => draft || question);
    });
  }

  function generate(id: string, selection: GuidedCoachSelection) {
    if (!owner || !available || request.current || currentGuide?.id !== id) return;
    updateTurn(id, { error: undefined });
    void askCoach({
      ...selection, expectedOwner: owner, messages: [{ role: "user", content: guidedMessage }],
      intent: "draft", model: coachModel, includePlans: false,
    }, (response) => updateTurn(id, { response, window: { date: selection.date, draftDays: selection.draftDays } }),
    (message) => updateTurn(id, { error: message }));
  }

  return <section className="coach-surface" aria-label="AI 教练对话">
    <div className="coach-conversation">
      {resumeReview && <div className="coach-resume"><ClipboardList size={17} aria-hidden="true" />
        <span>有一份草稿正在核对</span><button className="button outline small" type="button" onClick={resumeReview}>继续核对</button>
      </div>}
      {!turns.length ? <CoachWelcome compact={compact} shortcuts={shortcuts} startPlan={() => startPlan()} /> : <>
        <div className="coach-thread-controls"><button className="button outline small" type="button" onClick={clearConversation} disabled={waiting}>
          <MessageSquarePlus size={17} aria-hidden="true" />新对话
        </button></div>
        <ol className="coach-thread" aria-label="对话记录">
          {turns.map((turn) => {
            const { id, kind, question, response, cancelled } = turn;
            const draft = response?.draft?.plans;
            return <li className={kind === "guide" ? "coach-turn coach-turn-guide" : "coach-turn"} key={id}>
              <div className="coach-own-message"><span className="sr-only">你</span><p>{question}</p></div>
              {kind === "guide" && !response?.draft && !cancelled && <div ref={planQuestion} className="coach-guide-question" tabIndex={-1}>
                <div className="coach-guide-toolbar"><span>训练计划问答</span>
                  <button className="text-button" type="button" disabled={waiting} onClick={() => updateTurn(id, { cancelled: true })}>结束问答</button>
                </div>
                <GuidedCoachPanel presentation="conversation" selectedDate={selectedDate} busy={waiting} enabled={!!available}
                  status={available ? undefined : status} error={turn.error} onGenerate={(selection) => generate(id, selection)} />
              </div>}
              {cancelled && <p className="coach-turn-status">已结束本次问答</p>}
              {response && <div className="coach-reply" aria-live="polite">
                <div className="coach-reply-byline"><span>Spotter 教练</span><small>Haiku 5.5</small></div>
                <p>{response.reply}</p>
                {draft && <DraftPreview draft={draft} saved={savedDrafts.has(draft)} onReview={() => onReview(draft)} />}
              </div>}
              {kind !== "guide" && turn.error && <p className="inline-error coach-turn-status" role="alert">{turn.error}</p>}
              {kind !== "guide" && !response && !turn.error && <p className="coach-turn-status" role="status">教练正在回复…</p>}
            </li>;
          })}
          <li ref={transcriptEnd} className="coach-thread-anchor" aria-hidden="true" />
        </ol>
      </>}
    </div>
    <div className="coach-composer">
      {(suggestPlan || showSuggestedQuestions) && <div className="coach-suggestions" role="group" aria-label="推荐对话">
        {showSuggestedQuestions && suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => submitQuestion(question, true)}>{question}</button>)}
        {suggestPlan && <button type="button" onClick={() => submitQuestion(planRequest, true)}>制定训练计划</button>}
      </div>}
      <div className="coach-quick-actions">
        {turns.length > 0 && <button className="coach-quick-button" type="button" disabled={waiting} onClick={() => startPlan()}>
          <CalendarDays size={15} aria-hidden="true" />{currentGuide ? "继续答题" : "生成计划"}
        </button>}
        {latestDraft && !revising && available && <button className="coach-quick-button" type="button" disabled={waiting}
          onClick={() => { setRevising(true); composer.current?.focus(); }}>
          <ClipboardList size={15} aria-hidden="true" />调整最近草稿
        </button>}
        {available && !revising && <button className="coach-quick-button" type="button" disabled={waiting} aria-expanded={optionsOpen}
          aria-controls="coach-context" onClick={() => setOptionsOpen(!optionsOpen)}>
          <SlidersHorizontal size={15} aria-hidden="true" />{includePlans ? "已附上训练安排" : "对话选项"}
        </button>}
      </div>
      {optionsOpen && available && !revising && <div className="coach-context-options form-fields" id="coach-context">
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
      {revising && <div className="coach-revision-note">
        <span>发送时附上最近草稿</span><button type="button" className="text-button" disabled={waiting} onClick={() => setRevising(false)}>取消</button>
      </div>}
      <form className="coach-composer-field" onSubmit={send} aria-busy={waiting}>
        <label className="sr-only" htmlFor="coach-chat-input">给 AI 教练发消息</label>
        <textarea id="coach-chat-input" rows={1} ref={composer} maxLength={maxCoachMessageLength} value={input} disabled={waiting}
          aria-describedby="coach-composer-notice" placeholder={revising ? "想怎么调整这份草稿？" : "问问 Spotter 教练…"}
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
          {available ? "发送对话会向 Anthropic 提供近期消息与选定内容。" : status}
        </p>
        {canRetry && <button className="text-button" type="button" onClick={() => { setAvailability(undefined); setCheck((value) => value + 1); }}>重试</button>}
      </div>
    </div>
  </section>;
}
