"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, Check, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { Dialog } from "@/shared/ui";
import type { ProgramPreview } from "@/features/programs/model";
import { CoachActualContent, CoachProgramContent } from "./coaching-content";
import { coachingError, coachingRequest } from "./coaching-client";
import type { CoachingAcceptPreview, CoachingAcceptResult, CoachingAssignment, CoachingAssignmentDetail, CoachingSession } from "./model";

export const coachingStatus: Record<CoachingAssignment["status"], string> = { pending: "待学员接收", accepted: "已接收", declined: "已婉拒", cancelled: "已撤回" };
const sessionStatus: Record<CoachingSession["status"], string> = { pending: "未开始", inProgress: "进行中", completed: "已完成", removed: "已移除" };
const previewStatus: Record<ProgramPreview["items"][number]["status"], string> = { new: "将新增", update: "可更新", unchanged: "无需变更", custom: "保留自定义", protected: "保护已有训练", blocked: "本次跳过", deleted: "保留删除状态" };

function AssignmentCalendarPreview({ value }: { value: ProgramPreview }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? value.items : value.items.slice(0, 12);
  return <section className="coach-calendar-preview feature-stack">
    <h3>接收前核对你的日历</h3>
    <div className="coach-preview-counts"><div><strong>{value.counts.new}</strong><span>新增</span></div><div><strong>{value.counts.update}</strong><span>更新</span></div><div><strong>{value.counts.custom + value.counts.protected}</strong><span>保留原内容</span></div><div><strong>{value.counts.blocked + value.counts.deleted + value.counts.unchanged}</strong><span>无需写入／跳过</span></div></div>
    <ul className="coach-preview-list">{rows.map((item) => <li key={item.id}><div><strong>{item.date} · {item.title}</strong><small>{item.reason}</small></div><span className="coach-state">{previewStatus[item.status]}</span></li>)}</ul>
    {!expanded && value.items.length > rows.length && <button type="button" className="button subtle small coach-self-start" onClick={() => setExpanded(true)}>查看全部 {value.items.length} 节训练</button>}
    <p className="coach-notice">只写入可安排的计划。已开始、已完成、独立编辑及已删除的训练受保护；预览后若相关安排变化，需要重新核对。</p>
  </section>;
}

export function CoachingAssignmentDialog({ value, close, changed, saved }: { value: CoachingAssignment; close: () => void; changed: () => void; saved: () => void }) {
  const [detail, setDetail] = useState<CoachingAssignmentDetail>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<CoachingAcceptPreview>();
  const [decision, setDecision] = useState<"decline" | "cancel">();
  const [feedback, setFeedback] = useState("");
  const [feedbackDirty, setFeedbackDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [discard, setDiscard] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await coachingRequest<CoachingAssignmentDetail>(undefined, "?assignment=" + encodeURIComponent(value.id), signal);
      if (signal?.aborted) return;
      setDetail(result); setError("");
      if (!dirtyRef.current) setFeedback(result.feedback?.note ?? "");
    } catch (reason) { if (!signal?.aborted) { setDetail(undefined); setPreview(undefined); setError(coachingError(reason)); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [value.id]);

  useEffect(() => { const abort = new AbortController(); void load(abort.signal); return () => abort.abort(); }, [load]);
  useEffect(() => {
    if (!feedbackDirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [feedbackDirty]);

  async function act(task: () => Promise<void>) {
    setBusy(true); setError(""); setNotice(""); setDiscard(false);
    try { await task(); }
    catch (reason) { setError(coachingError(reason)); }
    finally { setBusy(false); }
  }
  function leave() { if (!busy) { if (feedbackDirty) setDiscard(true); else close(); } }
  const assignment = detail?.assignment ?? value;
  const student = assignment.viewerRole === "student";
  const active = Boolean(detail?.relationshipActive);
  const writable = preview ? preview.preview.counts.new + preview.preview.counts.update : 0;

  return <Dialog title={assignment.title} onClose={leave} className="coach-assignment-dialog">
    <div className="dialog-body feature-stack">
      <div className="coach-assignment-heading"><span className="coach-role">{student ? "来自教练 " + assignment.coachName : "发给学员 " + assignment.studentName}</span><span className="coach-state" data-state={assignment.status}>{coachingStatus[assignment.status]}</span></div>
      {assignment.note && <div className="coach-message"><strong>教练说明</strong><p>{assignment.note}</p></div>}
      {loading && <p className="muted" role="status">正在读取训练与完成情况…</p>}
      {detail && <>
        {!active && <p className="coach-notice">这段教练关系已结束。已接收的训练与历史保留，后续下发、完成记录和反馈不再分享。</p>}
        {assignment.status === "accepted" && detail.result && <p className="coach-notice">接收结果：新增 {detail.result.added} 节，更新 {detail.result.updated} 节，保留或跳过 {detail.result.skipped} 节。受保护或休息日的训练不会强行写入日历。</p>}
        <details className="coach-full-program" open={assignment.status === "pending"}><summary>训练内容与日期<span>{assignment.weeks} 周 · {assignment.sessionCount} 节</span></summary><CoachProgramContent program={detail.program} /></details>
        {assignment.status === "accepted" && <section className="feature-stack">
          <div className="coach-section-heading"><h3>本次下发训练的进度</h3><button type="button" className="button subtle small" disabled={busy || loading} onClick={() => void load()}><RefreshCw size={15} />刷新</button></div>
          {active ? <>
            <p className="coach-privacy"><ShieldCheck size={17} />{detail.detailsShared ? "只显示这份训练中获准分享的完成状态和实际组记录。" : "目前只分享这份训练的完成状态；实际组记录未开放。"}</p>
            <ul className="coach-session-progress">{detail.sessions.map((session) => <li key={session.id}><div className="coach-progress-heading"><div><strong>{session.title}</strong><small>{session.date}</small></div><span className="coach-state" data-state={session.status}>{sessionStatus[session.status]}</span></div>{detail.detailsShared && session.actual && <details><summary>已分享的实际组记录</summary><CoachActualContent value={session.actual} /></details>}</li>)}</ul>
          </> : <p className="muted">当前不能读取新的训练进度。</p>}
        </section>}
        {preview && assignment.status === "pending" && <AssignmentCalendarPreview key={preview.preview.token} value={preview.preview} />}
        {student && active && assignment.status === "accepted" ? <form className="feature-stack coach-feedback" onSubmit={(event) => { event.preventDefault(); void act(async () => {
          await coachingRequest({ action: "feedback", assignmentId: assignment.id, note: feedback });
          dirtyRef.current = false; setFeedbackDirty(false); await load(); changed(); setNotice("反馈已发给这位教练。");
        }); }}><label>发给教练的训练反馈<textarea rows={4} maxLength={1500} disabled={busy} value={feedback} onChange={(event) => { setFeedback(event.target.value); dirtyRef.current = true; setFeedbackDirty(true); setDiscard(false); }} placeholder="本次训练的感受、遇到的问题，或希望教练调整的内容。" /></label><p className="muted">只有你主动提交的这段反馈会发给教练，个人训练备注不会自动分享。</p><button className="button outline small coach-self-start" disabled={busy || !feedbackDirty}><MessageSquareText size={16} />{busy ? "正在提交…" : "提交给教练"}</button></form>
          : !student && active && assignment.status === "accepted" && <section className="coach-message"><h3>学员主动提交的反馈</h3><p>{detail.feedback?.note || "学员尚未提交反馈。"}</p>{detail.feedback && <small className="muted">最近更新 {new Date(detail.feedback.updatedAt).toLocaleString("zh-CN")}</small>}</section>}
        {decision && <section className="coach-notice feature-stack" role="alert"><p>{decision === "decline" ? "婉拒后，这份下发内容不会加入你的日历。" : "撤回后，学员不能再接收这份尚未确认的计划。"}</p><div className="coach-toolbar"><button className="button outline small" type="button" disabled={busy} onClick={() => void act(async () => { await coachingRequest({ action: decision, assignmentId: assignment.id }); setDecision(undefined); setPreview(undefined); await load(); changed(); setNotice(decision === "decline" ? "已婉拒这份计划。" : "已撤回这份计划。"); })}>确认{decision === "decline" ? "婉拒" : "撤回"}</button><button className="button subtle small" type="button" disabled={busy} onClick={() => setDecision(undefined)}>继续查看</button></div></section>}
      </>}
      {error && <div className="feature-stack"><p className="inline-error" role="alert">{error}</p>{!detail && <button type="button" className="button outline small coach-self-start" disabled={busy || loading} onClick={() => void load()}>重新读取</button>}</div>}
      {notice && <p className="coach-notice" role="status">{notice}</p>}
      {discard && <section className="coach-notice feature-stack" role="alert"><p>反馈还未提交，关闭会放弃本次修改。</p><div className="coach-toolbar"><button type="button" className="button outline small" onClick={close}>放弃修改并关闭</button><button type="button" className="button subtle small" onClick={() => setDiscard(false)}>继续填写</button></div></section>}
    </div>
    <div className="dialog-footer coach-assignment-actions">
      <button type="button" className="button outline" disabled={busy} onClick={leave}>关闭</button>
      {detail && active && assignment.status === "pending" && (student ? <>
        <button type="button" className="button subtle" disabled={busy || loading} onClick={() => setDecision("decline")}>婉拒计划</button>
        {preview ? <><button type="button" className="button outline" disabled={busy} onClick={() => void act(async () => { setPreview(await coachingRequest<CoachingAcceptPreview>({ action: "preview", assignmentId: assignment.id })); })}><RefreshCw size={16} />重新核对</button><button type="button" className="button primary" disabled={busy} onClick={() => void act(async () => {
          const result = await coachingRequest<CoachingAcceptResult>({ action: "accept", assignmentId: assignment.id, revision: preview.preview.revision, previewToken: preview.preview.token, confirmed: true });
          setPreview(undefined); await load(); changed(); saved(); setNotice("已接收：新增 " + result.result.added + " 节，更新 " + result.result.updated + " 节，保留或跳过 " + result.result.skipped + " 节。可在原训练日历中开始训练。");
        })}><CalendarCheck size={17} />{busy ? "正在接收…" : writable ? "确认接收并写入 " + writable + " 节" : "确认接收并保留周期"}</button></>
          : <button type="button" className="button primary" disabled={busy || loading} onClick={() => void act(async () => { setDecision(undefined); setPreview(await coachingRequest<CoachingAcceptPreview>({ action: "preview", assignmentId: assignment.id })); })}><Check size={17} />{busy ? "正在核对…" : "预览日历并接收"}</button>}
      </> : <button type="button" className="button subtle" disabled={busy || loading} onClick={() => setDecision("cancel")}>撤回待接收计划</button>)}
    </div>
  </Dialog>;
}
