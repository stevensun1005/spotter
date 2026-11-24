"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardList, Send, Sparkles } from "lucide-react";
import type { Plan } from "@/features/plans/model";
import { maxCoachConversationLength, maxCoachMessageLength, maxCoachMessages,
  type CoachConfig, type CoachModel, type CoachRequest, type CoachResponse } from "./model";

type Exchange = { question: string; reply: string; model: CoachModel };
type Availability = CoachConfig | { error: string };
const endpoint = "/api/ai-coach";
const modelNames = { haiku: "Haiku 5.5", sonnet: "Sonnet 5.5" };

function recentMessages(exchanges: Exchange[], question: string): CoachRequest["messages"] {
  const messages: CoachRequest["messages"] = [{ role: "user", content: question }];
  let size = question.length;
  for (const { question: previous, reply } of exchanges.slice(-Math.floor(maxCoachMessages / 2)).reverse()) {
    if (reply.length > maxCoachMessageLength || size + previous.length + reply.length > maxCoachConversationLength) break;
    messages.unshift({ role: "user", content: previous }, { role: "assistant", content: reply });
    size += previous.length + reply.length;
  }
  return messages;
}

export function AiCoachPanel({ active, owner, selectedDate, onReview, savedDraft, resumeReview }: {
  active: boolean; owner?: string; selectedDate: string; onReview: (plans: Plan[]) => void;
  savedDraft?: Plan[]; resumeReview?: () => void;
}) {
  const [availability, setAvailability] = useState<Availability>();
  const [check, setCheck] = useState(0);
  const [intent, setIntent] = useState<CoachRequest["intent"]>("chat");
  const [draftModel, setDraftModel] = useState<CoachModel>("haiku");
  const [draftDays, setDraftDays] = useState(7);
  const [chosenDate, setChosenDate] = useState<string>();
  const [includePlans, setIncludePlans] = useState(false);
  const [contextRange, setContextRange] = useState<"day" | "week">("week");
  const [reviseDraft, setReviseDraft] = useState(false);
  const [draft, setDraft] = useState<Plan[]>();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const request = useRef<AbortController>(null);
  const transcript = useRef<HTMLOListElement>(null);
  const date = intent === "draft" || includePlans ? chosenDate ?? selectedDate : selectedDate;

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
    if (active && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [active, exchanges]);

  const available = Boolean(owner) && availability && "enabled" in availability && availability.enabled;
  const sonnet = available && availability.models.includes("sonnet");
  const model = intent === "draft" && sonnet ? draftModel : "haiku";

  function clearConversation() {
    setExchanges([]);
    setDraft(undefined);
    setReviseDraft(false);
    setInput("");
    setError("");
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!owner || !available || !question || !date || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWaiting(true);
    setError("");
    try {
      const payload: CoachRequest = {
        expectedOwner: owner, messages: recentMessages(exchanges, question), intent, model, date,
        includePlans, contextRange,
        ...(intent === "draft" ? { draftDays } : {}),
        ...(intent === "draft" && reviseDraft && draft ? { priorDraft: { plans: draft } } : {}),
      };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as (CoachResponse & { error?: string }) | null;
      if (!response.ok) throw new Error(result?.error || "AI 教练暂时无法回复。请稍后重试。");
      if (typeof result?.reply !== "string" || !result.reply || (result.model !== "haiku" && result.model !== "sonnet")) throw new Error("未收到完整回复。请重试。");
      if (controller.signal.aborted) return;
      setExchanges((previous) => [...previous, { question, reply: result.reply, model: result.model }]);
      if (Array.isArray(result.draft?.plans) && result.draft.plans.length) {
        setDraft(result.draft.plans);
        setReviseDraft(false);
      }
      setInput("");
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.name === "Error"
        ? reason.message : "连接未完成。请检查网络后重试。");
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setWaiting(false);
      }
    }
  }

  const status = !owner ? "登录后可使用站内 AI 教练。" : !availability ? "正在检查 AI 教练状态…"
    : "error" in availability ? availability.error : "当前账号尚未启用站内 AI 教练。你仍可使用外部 AI 或粘贴计划。";

  return <section className="card padded feature-stack coach-chat" aria-label="训练对话">
    <div className="section-head"><h2><Sparkles size={20} aria-hidden="true" />训练对话</h2>
      {available && (exchanges.length > 0 || input.trim()) && <button className="button subtle small" type="button" disabled={waiting} onClick={clearConversation}>清空对话</button>}
    </div>
    {!available ? <div className="coach-chat-status"><p className="muted" role="status">{status}</p>
      {owner && availability && "error" in availability && <button type="button" className="button outline small" onClick={() => { setAvailability(undefined); setCheck((value) => value + 1); }}>重试</button>}
    </div> : <>
      {exchanges.length > 0 && <ol className="coach-transcript" ref={transcript} aria-label="对话记录" aria-live="polite" tabIndex={0}>
        {exchanges.map(({ question, reply, model: used }, index) => <li key={index}>
          <div className="coach-message coach-message-own"><strong>你</strong><p>{question}</p></div>
          <div className="coach-message"><strong>AI 教练 <span>{modelNames[used]}</span></strong><p>{reply}</p></div>
        </li>)}
      </ol>}
      {(draft || resumeReview) && <div className="coach-draft">
        <div><strong>训练草稿</strong><p className="muted">{resumeReview ? "有一份草稿正在核对。" : draft === savedDraft ? "已处理这份草稿。" : `${draft?.length} 个计划，等待核对后保存。`}</p></div>
        {resumeReview || draft && draft !== savedDraft ? <button className="button primary small" type="button" onClick={() => {
          if (resumeReview) resumeReview();
          else if (draft) onReview(draft);
        }}><ClipboardList size={17} aria-hidden="true" />{resumeReview ? "继续核对" : "核对与编辑"}</button> : null}
      </div>}
      <form className="form-fields coach-form" onSubmit={send} aria-busy={waiting}>
        <div className="segmented coach-intent" role="group" aria-label="对话任务">
          <button type="button" aria-pressed={intent === "chat"} disabled={waiting} onClick={() => setIntent("chat")}>聊训练</button>
          <button type="button" aria-pressed={intent === "draft"} disabled={waiting} onClick={() => setIntent("draft")}>起草计划</button>
        </div>
        {intent === "draft" && <div className="coach-options">
          <label>起始日期<input type="date" required value={date} disabled={waiting} onChange={(event) => setChosenDate(event.target.value)} /></label>
          <label>草稿覆盖范围<select value={draftDays} disabled={waiting} onChange={(event) => setDraftDays(Number(event.target.value))}>
            {[1, 7, 14, 21, 28].map((days) => <option value={days} key={days}>{days} 天</option>)}
          </select></label>
          {sonnet && <label>模型<select value={draftModel} disabled={waiting} onChange={(event) => setDraftModel(event.target.value === "sonnet" ? "sonnet" : "haiku")}>
            <option value="haiku">Haiku 5.5</option><option value="sonnet">Sonnet 5.5</option>
          </select></label>}
        </div>}
        <label className="toggle-label"><input type="checkbox" checked={includePlans} disabled={waiting} onChange={(event) => setIncludePlans(event.target.checked)} />附上个人训练安排</label>
        {includePlans && <div className="coach-options">
          {intent === "chat" && <label>计划日期<input type="date" required value={date} disabled={waiting} onChange={(event) => setChosenDate(event.target.value)} /></label>}
          <label>安排范围<select value={contextRange} disabled={waiting} onChange={(event) => setContextRange(event.target.value === "day" ? "day" : "week")}>
            <option value="day">所选日期</option><option value="week">所在周（周一至周日）</option>
          </select></label>
        </div>}
        {intent === "draft" && draft && <label className="toggle-label"><input type="checkbox" checked={reviseDraft} disabled={waiting} onChange={(event) => setReviseDraft(event.target.checked)} />附上上一份草稿，基于它调整</label>}
        <label>{intent === "draft" ? "你想安排什么训练？" : "你想问什么？"}
          <textarea rows={3} maxLength={maxCoachMessageLength} value={input} disabled={waiting} aria-describedby="coach-privacy" onChange={(event) => setInput(event.target.value)}
            placeholder={intent === "draft" ? "例如：每周训练 3 次，优先练背，可用哑铃和拉力器。" : "例如：卧推组间休息多久比较合适？"} />
        </label>
        <p className="muted coach-privacy" id="coach-privacy">Anthropic 会收到你发送的文字、近期对话和你勾选附上的内容。对话记录保留在当前页面。</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {waiting && <p className="muted" role="status">AI 教练正在回复…</p>}
        <button className="button primary" disabled={waiting || !input.trim() || !date}><Send size={17} aria-hidden="true" />{intent === "draft" ? "请求草稿" : "发送"}</button>
      </form>
    </>}
  </section>;
}
