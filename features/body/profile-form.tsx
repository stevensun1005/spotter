"use client";

import { useState, type FormEvent } from "react";
import { bodyProfileValues, type BodyProfile } from "./profile";

export const bodyNumber = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export function BodyProfileForm({ profile, weightKg, weightDate, today, revision, enabled, save }: {
  profile?: BodyProfile;
  weightKg?: number;
  weightDate?: string;
  today: string;
  revision?: string;
  enabled: boolean;
  save: (values: BodyProfile) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const bmi = weightKg && profile?.heightCm ? weightKg / (profile.heightCm / 100) ** 2 : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const height = form.get("height");
    const enteredAge = form.get("age");
    const age = enteredAge ? Number(enteredAge) : undefined;
    const values = bodyProfileValues.safeParse({
      heightCm: height ? Number(height) : undefined,
      age,
      sex: form.get("sex") || undefined,
      ageAsOf: age === undefined ? undefined : age === profile?.age ? profile.ageAsOf ?? today : today,
    });
    if (!values.success) { setStatus("请检查身高、年龄和性别。"); return; }
    setBusy(true); setStatus("");
    try {
      await save(values.data);
      setStatus("身体档案已保存到云端。");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "身体档案保存失败，请重试。");
    } finally { setBusy(false); }
  }

  return <section className="card padded feature-stack">
    <div className="section-head"><h2>身体档案</h2></div>
    {weightKg !== undefined && <div className="list-line">
      <div><strong>{bodyNumber.format(weightKg)} kg</strong><small>最新体重 · {weightDate}</small></div>
      {bmi !== undefined && <div><strong>{bodyNumber.format(bmi)}</strong><small>BMI</small></div>}
    </div>}
    <form className="form-fields" key={revision} onSubmit={submit}>
      <div className="field-grid">
        <label>身高（cm）<input name="height" type="number" inputMode="decimal" min="50" max="280" step="0.1" defaultValue={profile?.heightCm} disabled={!enabled || busy} /></label>
        <label>年龄（岁）<input name="age" type="number" inputMode="numeric" min="1" max="130" step="1" defaultValue={profile?.age} disabled={!enabled || busy} /></label>
      </div>
      {profile?.ageAsOf && <small className="muted">年龄记录于 {profile.ageAsOf}</small>}
      <label>性别（用于营养估算）<select name="sex" defaultValue={profile?.sex ?? ""} disabled={!enabled || busy}>
        <option value="">未填写</option><option value="male">男</option><option value="female">女</option>
      </select></label>
      <div className="exercise-toolbar"><button className="button primary" disabled={!enabled || busy}>保存身体档案</button></div>
    </form>
    {status && <p role="status">{status}</p>}
  </section>;
}
