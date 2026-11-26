"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus } from "lucide-react";
import { Dialog, VideoLink } from "@/shared/ui";
import { Anatomy } from "@/features/exercises/anatomy";
import { muscleNames } from "@/features/exercises/labels";
import { useCatalogue, type ExerciseChoice } from "@/features/exercises/open-gym";
import type { ExerciseProfile } from "@/features/library/model";
import { PlanSequence } from "@/features/training/plan-sequence";
import type { Plan } from "./model";
import { templateMuscleSets } from "./template-muscles";

export function TemplatePreview({ plan, profiles, close, edit, schedule, onExercise }: {
  plan: Plan; profiles?: ExerciseProfile[]; close: () => void; edit: () => void; schedule: () => void;
  onExercise: (choice: ExerciseChoice) => void;
}) {
  const [layer, setLayer] = useState<"primary" | "secondary">("primary");
  const { data, error } = useCatalogue();
  const muscles = templateMuscleSets(plan, data, profiles);
  const amounts = Object.entries(muscles[layer]).sort((a, b) => b[1] - a[1]);
  return createPortal(<Dialog title={plan.title} onClose={close} className="template-preview-dialog">
    <div className="dialog-body feature-stack">
      <p className="muted">{plan.category} · {plan.exercises.length} 个动作{plan.minutes > 0 ? " · " + plan.minutes + " 分钟" : ""}</p>
      {!!plan.exercises.length && <details className="card padded template-muscle-preview" open>
        <summary>肌肉预览</summary>
        <div className="feature-stack">
          <p className="muted">按模板中的计划组数显示训练部位，热身和放松组不计入。</p>
          <div className="segmented" role="group" aria-label="肌肉参与方式">
            <button type="button" aria-pressed={layer === "primary"} onClick={() => setLayer("primary")}>主练部位</button>
            <button type="button" aria-pressed={layer === "secondary"} onClick={() => setLayer("secondary")}>辅助部位</button>
          </div>
          {amounts.length > 0 ? <><Anatomy weights={muscles[layer]} showIntensity />
            <ul className="template-muscle-counts">{amounts.map(([muscle, sets]) =>
              <li key={muscle}>{muscleNames[muscle] ?? muscle} {sets} 组</li>)}</ul></> :
            <p className="muted">{!data && !error ? "正在读取动作库…" : layer === "primary" ? "暂无可统计的主练部位。" : "暂无可统计的辅助部位。"}</p>}
          {(data || error) && muscles.unlabelled > 0 && <p className="muted">{muscles.unlabelled} 个动作缺少肌肉标注。</p>}
        </div>
      </details>}
      {plan.video && <VideoLink url={plan.video} />}
      {!!plan.exercises.length && <PlanSequence plan={plan} onExercise={onExercise} />}
    </div>
    <div className="dialog-footer">
      <button type="button" className="button outline" onClick={edit}>编辑模板</button>
      <button type="button" className="button primary" onClick={schedule}><CalendarPlus size={17} /> 安排训练</button>
    </div>
  </Dialog>, document.body);
}
