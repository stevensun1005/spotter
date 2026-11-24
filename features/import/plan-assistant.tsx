"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, ChevronLeft, Clipboard, Sparkles } from "lucide-react";
import { AgentAccessPanel } from "@/features/agent-access/access-panel";
import { AiCoachPanel, type CoachActions } from "@/features/ai-coach/chat-panel";
import { CoachModeTabs, type PlanAssistantMode } from "@/features/ai-coach/mode-tabs";
import { planAiPrompt, type PlanAiIntent } from "./ai-instructions";

export function PlanAssistant({ today, selectedDate, saved, owner, profileRef, active, mode, onModeChange, onBack, backLabel,
  mealPhoto, mealPhotoId, mealResult, onDismissMeal, onPrograms, onData, coachActions, inSheet, compact, onExpandCoach }: {
  today: string; selectedDate: string; saved: () => void;
  owner?: string; profileRef?: string; active: boolean;
  mode: PlanAssistantMode; onModeChange: (mode: PlanAssistantMode) => void; onPrograms: () => void; onData: () => void;
  onBack: () => void; backLabel: string; mealPhoto?: ReactNode; mealPhotoId?: string;
  mealResult?: { id: string; message: string }; onDismissMeal?: () => void;
  coachActions?: CoachActions; inSheet?: boolean; compact?: boolean; onExpandCoach?: () => void;
}) {
  const [intent, setIntent] = useState<PlanAiIntent>("create");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState("");
  const prompt = planAiPrompt(today, intent);
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setPromptMessage("已复制计划提示词。生成 JSON 后，到设置里的「粘贴已有内容」预览。"); }
    catch { setShowPrompt(true); setPromptMessage("可以在下方选中并复制提示词。"); }
  }

  return <div className="plan-assistant feature-stack">
    {!inSheet && <header className="ai-assistant-header">
      <h1 className="sr-only">AI 教练</h1>
      <button className="icon-button ai-assistant-back" type="button" onClick={onBack} aria-label={backLabel}><ChevronLeft size={20} aria-hidden="true" /></button>
      <CoachModeTabs mode={mode} onChange={onModeChange} />
    </header>}
    <div hidden={mode !== "coach"}>
      <AiCoachPanel active={active && mode === "coach"} owner={owner} today={today} selectedDate={selectedDate}
        compact={compact} onExpand={onExpandCoach} actions={coachActions} mealPhoto={mealPhoto}
        mealPhotoId={mealPhotoId} mealResult={mealResult} onDismissMeal={onDismissMeal} />
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
