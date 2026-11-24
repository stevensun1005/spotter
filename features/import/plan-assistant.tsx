"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarClock, ChevronLeft, Clipboard, Sparkles } from "lucide-react";
import { AgentAccessPanel } from "@/features/agent-access/access-panel";
import { AiCoachPanel, type CoachShortcuts } from "@/features/ai-coach/chat-panel";
import type { Plan, PlannedWorkout } from "@/features/plans/model";
import { PlanImportReview } from "./import-view";
import { planAiPrompt, type PlanAiIntent } from "./ai-instructions";

export type PlanAssistantMode = "coach" | "ai";

export function PlanAssistant({ today, selectedDate, save, saved, owner, profileRef, active, mode, onModeChange, onBack, backLabel,
  mealPhoto, onPrograms, onData, coachShortcuts }: {
  today: string; selectedDate: string; save: (plans: PlannedWorkout[], revise: boolean) => Promise<void>; saved: () => void;
  owner?: string; profileRef?: string; active: boolean;
  mode: PlanAssistantMode; onModeChange: (mode: PlanAssistantMode) => void; onPrograms: () => void; onData: () => void;
  onBack: () => void; backLabel: string; mealPhoto?: ReactNode;
  coachShortcuts?: CoachShortcuts;
}) {
  const [intent, setIntent] = useState<PlanAiIntent>("create");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState("");
  const [review, setReview] = useState<{ source: Plan[]; plans: PlannedWorkout[] }>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState(() => new Set<Plan[]>());
  const [savingDraft, setSavingDraft] = useState(false);
  const reviewTarget = useRef<HTMLDivElement>(null);
  const hasMealPhoto = Boolean(mealPhoto);
  useEffect(() => {
    if (!active || mode !== "coach" || hasMealPhoto || !reviewOpen) return;
    reviewTarget.current?.scrollIntoView({ block: "start" });
    reviewTarget.current?.focus({ preventScroll: true });
  }, [active, mode, hasMealPhoto, reviewOpen]);
  const prompt = planAiPrompt(today, intent);
  function reviewDraft(plans: Plan[]) {
    setReview({ source: plans, plans: plans.map((data) => ({ id: crypto.randomUUID(), data: { ...data, shared: false } })) });
    setReviewOpen(true);
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setPromptMessage("已复制计划提示词。生成 JSON 后，到设置里的「粘贴已有内容」预览。"); }
    catch { setShowPrompt(true); setPromptMessage("可以在下方选中并复制提示词。"); }
  }

  return <div className="plan-assistant feature-stack">
    <header className="ai-assistant-header">
      <h1 className="sr-only">AI 教练</h1>
      <button className="icon-button ai-assistant-back" type="button" onClick={onBack} aria-label={backLabel}><ChevronLeft size={20} aria-hidden="true" /></button>
      <div className="ai-assistant-tabs" role="group" aria-label="选择 AI">
        <button type="button" aria-pressed={mode === "coach"} onClick={() => onModeChange("coach")}>站内 AI</button>
        <button type="button" aria-pressed={mode === "ai"} onClick={() => onModeChange("ai")}>用自己的 AI</button>
      </div>
    </header>
    {mealPhoto && <div hidden={mode !== "coach"}>{mealPhoto}</div>}
    <div hidden={mode !== "coach" || hasMealPhoto}>
      <div hidden={reviewOpen}><AiCoachPanel active={active && mode === "coach" && !hasMealPhoto && !reviewOpen} owner={owner} selectedDate={selectedDate}
        onReview={reviewDraft} shortcuts={coachShortcuts} savedDrafts={savedDrafts} resumeReview={review ? () => setReviewOpen(true) : undefined} /></div>
      {review && <div className="coach-review" hidden={!reviewOpen} tabIndex={-1} ref={reviewTarget}>
        <div className="feature-stack">
          <div className="exercise-toolbar">
            <button type="button" className="button outline small" disabled={savingDraft} onClick={() => setReviewOpen(false)}>返回 AI 教练</button>
            <button type="button" className="button subtle small" disabled={savingDraft} onClick={() => { setReview(undefined); setReviewOpen(false); }}>取消核对</button>
          </div>
          <PlanImportReview plans={review.plans} save={save} busyChanged={setSavingDraft} aiDraft saved={() => {
            setSavedDrafts((previous) => new Set(previous).add(review.source)); setReview(undefined); setReviewOpen(false); saved();
          }} />
        </div>
      </div>}
    </div>
    <div hidden={mode !== "ai"} className="plan-ai-stack">
      <section className="card padded feature-stack plan-prompt-card">
        <div className="section-head"><h2><Sparkles size={20} />让你的 AI 起草或整理计划</h2></div>
        <p>把提示词和训练资料发给你常用的 AI。拿到计划 JSON 后，到设置的「计划与日程」中粘贴并预览。</p>
        <div className="segmented plan-prompt-intent" role="group" aria-label="AI 处理目标">
          <button type="button" aria-pressed={intent === "create"} onClick={() => { setIntent("create"); setPromptMessage(""); }}>起草新计划</button>
          <button type="button" aria-pressed={intent === "organize"} onClick={() => { setIntent("organize"); setPromptMessage(""); }}>整理已有计划</button>
        </div>
        <p className="muted">{intent === "create" ? "告诉 AI 训练目标、每周次数、可用器械和限制；已知的重量与动作要求照原意保留。" : "把已有训练笔记、计划或视频链接一起交给 AI，保留动作、组次、单位、休息和日期。"}</p>
        <div className="exercise-toolbar"><button className="button primary" type="button" onClick={() => void copyPrompt()}><Clipboard size={17} />复制计划提示词</button><button className="button outline" type="button" aria-expanded={showPrompt} onClick={() => setShowPrompt((value) => !value)}>{showPrompt ? "收起提示词" : "查看提示词"}</button></div>
        {promptMessage && <p className="plan-assistant-feedback" role="status">{promptMessage}</p>}
        {showPrompt && <label>计划提示词<textarea className="prompt-text" readOnly rows={9} value={prompt} onFocus={(event) => event.target.select()} /></label>}
        <p className="muted">生成内容会先预览和编辑，确认后才保存。已连接的 Agent 也可以把草稿直接送到下方。</p>
      </section>
      <AgentAccessPanel enabled={Boolean(owner)} profileRef={profileRef} saved={saved} active={active && mode === "ai"} />
    </div>
    {mode !== "coach" && <aside className="plan-assistant-related card padded"><span className="tile mint"><CalendarClock size={20} /></span><div><strong>已有完整训练周期？</strong><p className="muted">完整周期保留周次和阶段，在训练周期中导入。个人数据备份仍从数据页面恢复。</p></div><div className="exercise-toolbar"><button type="button" className="button outline small" onClick={onPrograms}>训练周期</button><button type="button" className="button subtle small" onClick={onData}>数据备份</button></div></aside>}
  </div>;
}
