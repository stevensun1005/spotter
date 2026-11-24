"use client";

import { useState } from "react";
import { CalendarClock, Clipboard, ClipboardList, FileInput, Sparkles } from "lucide-react";
import { AgentAccessPanel } from "@/features/agent-access/access-panel";
import type { PlannedWorkout } from "@/features/plans/model";
import { ImportView } from "./import-view";
import { planAiPrompt, type PlanAiIntent } from "./ai-instructions";

type Mode = "import" | "ai";
export function PlanAssistant({ today, save, saved, notify, enabled, profileRef, active, mode, onModeChange, onPrograms, onData }: {
  today: string; save: (plans: PlannedWorkout[], revise: boolean) => Promise<void>; saved: () => void;
  notify: (text: string) => void; enabled: boolean; profileRef?: string; active: boolean;
  mode: Mode; onModeChange: (mode: Mode) => void; onPrograms: () => void; onData: () => void;
}) {
  const [intent, setIntent] = useState<PlanAiIntent>("create");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const prompt = planAiPrompt(today, intent);
  function pasteResult() { onModeChange("import"); setFocusRequest((value) => value + 1); }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setPromptMessage("已复制计划提示词。把它发给你自己的 AI，生成 JSON 后回到这里预览。"); }
    catch { setShowPrompt(true); setPromptMessage("可以在下方选中并复制提示词。"); }
  }

  return <div className="plan-assistant feature-stack">
    <div className="plan-assistant-tabs" role="group" aria-label="添加计划方式">
      <button type="button" aria-pressed={mode === "import"} onClick={() => onModeChange("import")}><ClipboardList size={19} /><span>粘贴已有内容<small>训练文本、视频或计划 JSON</small></span></button>
      <button type="button" aria-pressed={mode === "ai"} onClick={() => onModeChange("ai")}><Sparkles size={19} /><span>用自己的 AI<small>复制提示词或接收 Agent 草稿</small></span></button>
    </div>
    <div hidden={mode !== "import"}>
      <ImportView today={today} save={save} saved={saved} notify={notify} canRevise={enabled} focusRequest={focusRequest}
        helpAI={() => { setIntent("organize"); onModeChange("ai"); }} onPrograms={onPrograms} onData={onData} />
    </div>
    <div hidden={mode !== "ai"} className="plan-ai-stack">
      <section className="card padded feature-stack plan-prompt-card">
        <div className="section-head"><h2><Sparkles size={20} />让你的 AI 起草或整理计划</h2></div>
        <p>把提示词和目标或训练资料发给你常用的 AI，生成计划 JSON 后粘贴回来。</p>
        <div className="segmented plan-prompt-intent" role="group" aria-label="AI 处理目标">
          <button type="button" aria-pressed={intent === "create"} onClick={() => { setIntent("create"); setPromptMessage(""); }}>起草新计划</button>
          <button type="button" aria-pressed={intent === "organize"} onClick={() => { setIntent("organize"); setPromptMessage(""); }}>整理已有计划</button>
        </div>
        <p className="muted">{intent === "create" ? "告诉 AI 训练目标、每周次数、可用器械和限制；已知的重量与动作要求照原意保留。" : "把已有训练笔记、计划或视频链接一起交给 AI，保留动作、组次、单位、休息和日期。"}</p>
        <div className="exercise-toolbar"><button className="button primary" type="button" onClick={() => void copyPrompt()}><Clipboard size={17} />复制计划提示词</button><button className="button outline" type="button" aria-expanded={showPrompt} onClick={() => setShowPrompt((value) => !value)}>{showPrompt ? "收起提示词" : "查看提示词"}</button><button className="button outline" type="button" onClick={pasteResult}><FileInput size={17} />粘贴 AI 结果</button></div>
        {promptMessage && <p className="plan-assistant-feedback" role="status">{promptMessage}</p>}
        {showPrompt && <label>计划提示词<textarea className="prompt-text" readOnly rows={9} value={prompt} onFocus={(event) => event.target.select()} /></label>}
        <p className="muted">生成内容会先预览和编辑，确认后才保存。已连接的 Agent 也可以把草稿直接送到下方。</p>
      </section>
      <AgentAccessPanel enabled={enabled} profileRef={profileRef} saved={saved} active={active && mode === "ai"} />
    </div>
    <aside className="plan-assistant-related card padded"><span className="tile mint"><CalendarClock size={20} /></span><div><strong>已有完整训练周期？</strong><p className="muted">完整周期保留周次和阶段，在训练周期中导入。个人数据备份仍从数据页面恢复。</p></div><div className="exercise-toolbar"><button type="button" className="button outline small" onClick={onPrograms}>训练周期</button><button type="button" className="button subtle small" onClick={onData}>数据备份</button></div></aside>
  </div>;
}
