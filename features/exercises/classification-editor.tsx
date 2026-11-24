import type { FormEvent } from "react";
import type { ExerciseProfile } from "@/features/library/model";
import { exerciseAreaOptions } from "./catalogue-areas";
import { label, types } from "./labels";
import type { CustomCatalogueEntry } from "./custom-catalogue";

export function ClassificationEditor({ current, stored, equipment, busy, save }: {
  current: CustomCatalogueEntry;
  stored: ExerciseProfile["classification"];
  equipment: string[];
  busy: boolean;
  save: (value: NonNullable<ExerciseProfile["classification"]>) => void;
}) {
  const areaTitle = exerciseAreaOptions.find(({ id }) => id === current.area)?.title;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    save({ area: String(fields.get("area") ?? ""), equipment: String(fields.get("equipment") ?? ""), type: String(fields.get("type") ?? "") });
  };
  return <details className="card padded custom-guide">
    <summary>{current.area ? "编辑分类" : "补充分类"}</summary>
    <form className="form-fields" onSubmit={submit}>
      <label>训练部位<select name="area" defaultValue={stored?.area ?? ""}>
        <option value="">自动分类</option>
        {exerciseAreaOptions.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
      </select></label>
      <label>器械<select name="equipment" defaultValue={stored?.equipment ?? ""}>
        <option value="">按已有资料</option>
        {equipment.map((key) => <option key={key} value={key}>{label(key)}</option>)}
      </select></label>
      <label>动作类型<select name="type" defaultValue={stored?.type ?? ""}>
        <option value="">按已有资料</option>
        {types.map((key) => <option key={key} value={key}>{label(key)}</option>)}
      </select></label>
      {areaTitle && <p className="muted">当前部位 {areaTitle}</p>}
      <button type="submit" className="button primary" disabled={busy}>保存分类</button>
    </form>
  </details>;
}
