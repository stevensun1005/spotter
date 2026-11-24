"use client";

import { Activity, Coffee, Dumbbell, Ruler, Zap } from "lucide-react";
import { Dialog } from "@/shared/ui";
import type { FreeWorkoutKind } from "./model";

const modes = [
  { id: "strength", label: "力量训练", icon: Dumbbell },
  { id: "cardio", label: "有氧训练", icon: Activity },
  { id: "hiit", label: "HIIT 训练", icon: Zap },
] as const;

export function TrainingLaunch({ start, rest, body, close }: {
  start: (kind: FreeWorkoutKind) => void; rest?: () => void; body: () => void; close: () => void;
}) {
  return <Dialog title="开始训练" className="workout-launch-dialog" onClose={close}>
    <div className="workout-launch-actions">
      {modes.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={"launch-action " + id} onClick={() => start(id)}>
        <span className="launch-icon"><Icon aria-hidden="true" /></span><span>{label}</span>
      </button>)}
      <button type="button" className="launch-action rest" onClick={rest} disabled={!rest}>
        <span className="launch-icon"><Coffee aria-hidden="true" /></span><span>安排休息</span>
      </button>
      <button type="button" className="launch-action body-data" onClick={body}>
        <span className="launch-icon"><Ruler aria-hidden="true" /></span><span>身体数据</span>
      </button>
    </div>
  </Dialog>;
}
