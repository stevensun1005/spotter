"use client";

import { Bookmark, CalendarArrowUp, Ellipsis, Pencil, Trash2 } from "lucide-react";

export function PlanActions({ title, edit, move, saveTemplate, remove }: {
  title: string; edit?: () => void; move: () => void; saveTemplate: () => void; remove: () => void;
}) {
  return <details className="plan-options">
    <summary className="button outline small" aria-label={"训练操作 " + title}><Ellipsis size={19} /></summary>
    <div className="plan-options-menu">
      {edit && <button type="button" onClick={edit}><Pencil size={16} /> 编辑计划</button>}
      <button type="button" onClick={move}><CalendarArrowUp size={16} /> 移动或顺延</button>
      <button type="button" onClick={saveTemplate}><Bookmark size={16} /> 另存为模板</button>
      <button type="button" onClick={remove}><Trash2 size={16} /> 删除计划</button>
    </div>
  </details>;
}
