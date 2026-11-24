"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { periodRange } from "@/features/stats/model";
import { Dialog, displayNumber } from "@/shared/ui";
import { coachingError, coachingRequest } from "./coaching-client";
import type { CoachingLink } from "./model";
import { lessonMutation, type LearnerOverview } from "./progress-model";

type Lesson = LearnerOverview["lessons"][number];
type LedgerEditor = { change: "credit" | "debit"; quantity: string } | { change: "reverse"; lesson: Lesson };
const lessonKind = (lesson: Lesson) => lesson.reverses ? "冲销" : lesson.delta > 0 ? "购课登记" : "上课扣减";
const lessonDelta = (amount: number) => (amount > 0 ? "+" : "") + amount + " 节";

export function LearnerOverviewDialog({ link, today, close }: { link: CoachingLink; today: string; close: () => void }) {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [steps, setSteps] = useState(0);
  const [overview, setOverview] = useState<LearnerOverview>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<LedgerEditor>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const activeLoad = useRef<AbortController>(undefined);
  const saving = useRef(false);
  const retry = useRef<{ key: string; id: string }>(undefined);
  const { from, to } = periodRange(period, today, steps, 0, { from: today, to: today });

  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const request = new AbortController();
    activeLoad.current = request;
    setLoading(true);
    setLoadError("");
    try {
      const query = new URLSearchParams({ learner: link.id, from, to });
      const result = await coachingRequest<LearnerOverview>(undefined, "?" + query.toString(), request.signal);
      if (result.from !== from || result.to !== to || !result.summary || typeof result.balance !== "number" || !Array.isArray(result.lessons)) {
        throw new Error("学员概览返回的内容无效。");
      }
      if (!request.signal.aborted) setOverview(result);
    } catch (reason) {
      if (!request.signal.aborted) { setOverview(undefined); setLoadError(coachingError(reason)); }
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [link.id, from, to]);

  useEffect(() => {
    void load();
    const wake = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", wake);
    return () => {
      activeLoad.current?.abort();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);

  function begin(next: LedgerEditor) {
    setEditor(next);
    setNote("");
    setSaveError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving.current || !overview || loading) return;
    const common = { action: "lesson" as const, linkId: link.id, note: note.trim() };
    const body = editor.change === "reverse"
      ? { ...common, change: editor.change, lessonId: editor.lesson.id }
      : { ...common, change: editor.change, quantity: Number(editor.quantity) };
    const key = JSON.stringify(body);
    const requestId = retry.current?.key === key ? retry.current.id : crypto.randomUUID();
    const parsed = lessonMutation.safeParse({ ...body, requestId });
    if (!parsed.success) { setSaveError("请核对课时和备注后重试。"); return; }
    retry.current = { key, id: requestId };
    saving.current = true;
    setBusy(true);
    setSaveError("");
    try {
      await coachingRequest<{ ok: true }>(parsed.data);
      retry.current = undefined;
      setEditor(undefined);
      setNotice(editor.change === "reverse" ? "已冲销该条课时记录。" : "课时已登记。");
    } catch (reason) { setSaveError(coachingError(reason)); }
    finally {
      await load();
      saving.current = false;
      setBusy(false);
    }
  }

  const summary = overview?.from === from && overview.to === to ? overview.summary : undefined;
  const disabled = busy || loading;
  return <Dialog title={link.studentName + " · 学员概览"} className="coach-assignment-dialog" onClose={() => { if (!busy) close(); }}>
    <div className="dialog-body feature-stack">
      <section className="feature-stack" aria-label="学员训练汇总">
        <div className="coach-section-heading">
          <h3>训练汇总</h3>
          <div className="coach-tabs" role="group" aria-label="汇总周期">
            <button type="button" disabled={busy} aria-pressed={period === "week"} onClick={() => { setPeriod("week"); setSteps(0); }}>按周</button>
            <button type="button" disabled={busy} aria-pressed={period === "month"} onClick={() => { setPeriod("month"); setSteps(0); }}>按月</button>
          </div>
        </div>
        <div className="coach-learner-period">
          <button className="icon-button" type="button" aria-label={period === "week" ? "上一周" : "上个月"} disabled={busy}
            onClick={() => setSteps((current) => current - 1)}><ChevronLeft size={18} /></button>
          <strong>{from} 至 {to}</strong>
          <button className="icon-button" type="button" aria-label={period === "week" ? "下一周" : "下个月"} disabled={busy || steps >= 0}
            onClick={() => setSteps((current) => current + 1)}><ChevronRight size={18} /></button>
        </div>
        {summary && <div className="totals coach-learner-totals">
          <div><strong>{summary.sessions}</strong><span>已完成（次）</span></div>
          <div><strong>{summary.days}</strong><span>训练天数</span></div>
          {summary.minutes !== null && <div><strong>{summary.minutes}</strong><span>实际时长（分）</span></div>}
          {summary.sets !== null && <div><strong>{summary.sets}</strong><span>完成组数</span></div>}
          {summary.volumeKg !== null && <div><strong>{displayNumber(summary.volumeKg)}</strong><span>训练容量（kg）</span></div>}
        </div>}
        <p className="muted">仅汇总你下发并已完成的训练。{overview?.shareDetails
          ? "按实际打卡日期统计。"
          : "按计划日期统计。实际时长、组数和容量需学员授权。"}</p>
      </section>
      {loading && <p className="muted" role="status">正在读取学员概览…</p>}
      {loadError && <div className="feature-stack"><p className="inline-error" role="alert">{loadError}</p>
        <button type="button" className="button outline small coach-self-start" disabled={disabled} onClick={() => void load()}><RefreshCw size={16} />重新读取</button>
      </div>}
      {overview && <section className="feature-stack" aria-label="课时台账">
        <div className="coach-section-heading"><h3>课时台账</h3><strong>剩余 {overview.balance} 节</strong></div>
        <div className="coach-toolbar">
          <button type="button" className="button outline small" disabled={disabled} onClick={() => begin({ change: "credit", quantity: "1" })}>登记购课</button>
          <button type="button" className="button outline small" disabled={disabled || overview.balance <= 0} onClick={() => begin({ change: "debit", quantity: "1" })}>登记扣课</button>
        </div>
        {editor && <form className="form-fields coach-source-preview" onSubmit={submit}>
          {editor.change === "reverse"
            ? <p><strong>冲销{lessonKind(editor.lesson)}</strong><br />将另记一条 {lessonDelta(-editor.lesson.delta)} 的冲销记录。</p>
            : <label>{editor.change === "credit" ? "购课节数" : "扣减节数"}<input type="number" inputMode="numeric" required min={1} max={1000}
                value={editor.quantity} disabled={disabled} onChange={(event) => setEditor({ ...editor, quantity: event.target.value })} /></label>}
          <label>备注<textarea maxLength={240} rows={2} placeholder="选填" disabled={disabled} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="coach-toolbar">
            <button type="button" className="button subtle small" disabled={busy} onClick={() => { setEditor(undefined); setSaveError(""); }}>取消</button>
            <button type="submit" className="button primary small" disabled={disabled}>{busy ? "正在保存…" : editor.change === "reverse" ? "确认冲销" : "保存登记"}</button>
          </div>
        </form>}
        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
        {notice && <p className="coach-notice" role="status">{notice}</p>}
        {overview.lessons.length ? <ul className="coach-session-progress coach-lesson-list">{overview.lessons.map((lesson) => <li key={lesson.id}>
          <div className="coach-progress-heading"><div><strong>{lessonKind(lesson)} · {lessonDelta(lesson.delta)}</strong>
            <small>{new Date(lesson.createdAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</small>
          </div>
            {!lesson.reverses && (lesson.reversed ? <span className="coach-state">已冲销</span>
              : <button type="button" className="button subtle small" disabled={disabled}
                aria-label={"冲销" + lessonKind(lesson) + " " + lessonDelta(lesson.delta)} onClick={() => begin({ change: "reverse", lesson })}>冲销</button>)}
          </div>
          {lesson.note && <p>{lesson.note}</p>}
        </li>)}</ul> : <p className="muted">还没有课时明细。</p>}
        {overview.lessons.length >= 80 && <p className="muted">显示最近 80 条课时明细。</p>}
      </section>}
    </div>
    <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={close}>关闭</button></div>
  </Dialog>;
}
