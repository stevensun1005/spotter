"use client";

export type PlanAssistantMode = "coach" | "ai";

export function CoachModeTabs({ mode, onChange }: { mode: PlanAssistantMode; onChange: (mode: PlanAssistantMode) => void }) {
  return <div className="ai-assistant-tabs" role="group" aria-label="选择 AI">
    <button type="button" aria-pressed={mode === "coach"} onClick={() => onChange("coach")}>站内 AI</button>
    <button type="button" aria-pressed={mode === "ai"} onClick={() => onChange("ai")}>用自己的 AI</button>
  </div>;
}
