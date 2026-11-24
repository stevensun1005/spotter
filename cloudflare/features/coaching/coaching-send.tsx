"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, RefreshCw, Send } from "lucide-react";
import { dateSchema, offsetDate } from "@/shared/dates";
import { Dialog } from "@/shared/ui";
import { CoachProgramContent } from "./coaching-content";
import { coachingError, coachingRequest } from "./coaching-client";
import type { CoachingAssignment, CoachingLink, CoachingSource, CoachingSourceDetail } from "./model";

const sourceKey = (source: CoachingSource) => source.kind + ":" + source.id;
const sourceLabel = (source: CoachingSource) => (source.kind === "program" ? "周期" : source.kind === "template" ? "模板" : "单次计划") + " · " + source.title;

export function CoachingSendDialog({ link, sources, today, close, sent }: {
  link: CoachingLink; sources: CoachingSource[]; today: string; close: () => void; sent: (assignment: CoachingAssignment) => void;
}) {
  const [selected, setSelected] = useState(() => sources[0] ? sourceKey(sources[0]) : "");
  const [startDate, setStartDate] = useState(today);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<CoachingSourceDetail>();
  const [loading, setLoading] = useState(Boolean(sources.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const retry = useRef({ key: "", requestId: "" });
  const source = sources.find((item) => sourceKey(item) === selected);

  useEffect(() => {
    if (!source) { setDetail(undefined); setLoading(false); return; }
    const abort = new AbortController();
    setLoading(true); setError(""); setDetail(undefined); setReview(false);
    void coachingRequest<CoachingSourceDetail>(undefined, "?" + new URLSearchParams({ sourceKind: source.kind, sourceId: source.id }), abort.signal)
      .then((value) => { if (!abort.signal.aborted) setDetail(value); })
      .catch((reason) => { if (!abort.signal.aborted) setError(coachingError(reason)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [source?.kind, source?.id, refresh]);

  const displayProgram = useMemo(() => {
    if (!detail || !dateSchema.safeParse(startDate).success) return undefined;
    return { ...detail.program, startDate, sessions: detail.program.sessions.map((session) => ({ ...session,
      plan: { ...session.plan, date: offsetDate(startDate, (session.week - 1) * 7 + session.day - 1) },
    })) };
  }, [detail, startDate]);

  function changed() { setDirty(true); setReview(false); setDiscard(false); }
  function leave() { if (!busy) { if (dirty) setDiscard(true); else close(); } }

  async function send() {
    if (!detail || !displayProgram) return;
    setBusy(true); setError("");
    const content = { linkId: link.id, source: { kind: detail.source.kind, id: detail.source.id, expectedHash: detail.source.expectedHash }, startDate, note: note.trim() };
    const key = JSON.stringify(content);
    if (retry.current.key !== key) retry.current = { key, requestId: crypto.randomUUID() };
    try {
      const result = await coachingRequest<{ assignment: CoachingAssignment }>({ action: "send", ...content, requestId: retry.current.requestId });
      sent(result.assignment); close();
    } catch (reason) { setError(coachingError(reason)); }
    finally { setBusy(false); }
  }

  return <Dialog title={review ? "核对要下发的训练" : "给学员发送训练"} onClose={leave} className="coach-send-dialog">
    <form onSubmit={(event) => { event.preventDefault(); if (!review) { setReview(true); setDiscard(false); } else void send(); }}>
      <fieldset className="dialog-body feature-stack coach-fieldset" disabled={busy}>
        <div className="coach-recipient"><span className="coach-role">学员</span><strong>{link.studentName}</strong></div>
        {!review ? <>
          <p>从自己已保存的训练计划、模板或周期中选一份，核对日期和内容后发送。</p>
          {!sources.length ? <p className="coach-notice">还没有可发送的内容。请先到「训练」保存计划或模板，或到「训练周期」保存周期草稿，再回这里选择。</p> : <>
            <label>训练来源<select value={selected} required onChange={(event) => { setSelected(event.target.value); changed(); }}>{sources.map((item) => <option value={sourceKey(item)} key={sourceKey(item)}>{sourceLabel(item)}</option>)}</select></label>
            <label>建议开始日期<input type="date" value={startDate} required onChange={(event) => { setStartDate(event.target.value); changed(); }} /></label>
            <label>给学员的说明（可选）<textarea rows={3} maxLength={1500} value={note} onChange={(event) => { setNote(event.target.value); changed(); }} placeholder="本次目标、注意事项，或希望学员反馈的内容。" /></label>
          </>}
        </> : <>
          <p className="coach-notice">这份内容将以独立副本发送。{link.studentName}预览并确认后，才会进入自己的训练日历。</p>
          {note.trim() && <div className="coach-message"><strong>给学员的说明</strong><p>{note.trim()}</p></div>}
        </>}
        {loading && <p className="muted" role="status">正在读取这份训练的最新内容…</p>}
        {displayProgram && <section className="coach-source-preview feature-stack"><h3>{detail?.source.title}</h3><CoachProgramContent program={displayProgram} /></section>}
        {!loading && sources.length > 0 && <button type="button" className="button subtle small coach-self-start" onClick={() => { setRefresh((value) => value + 1); setReview(false); }}><RefreshCw size={15} />重新读取来源并核对</button>}
        <p className="muted">以后修改你的原模板或周期，不会自动改动已经发送的副本。学员原有训练和历史按现有规则保留。</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {discard && <div className="coach-notice feature-stack" role="alert"><p>这份下发安排还未发送，关闭会放弃当前选择和说明。</p><div className="coach-toolbar"><button type="button" className="button outline small" onClick={close}>放弃并关闭</button><button type="button" className="button subtle small" onClick={() => setDiscard(false)}>继续核对</button></div></div>}
      </fieldset>
      <div className="dialog-footer"><button type="button" className="button outline" disabled={busy} onClick={() => { if (review) setReview(false); else leave(); }}>{review ? <><ChevronLeft size={16} />返回调整</> : "取消"}</button><button className="button primary" disabled={busy || loading || !displayProgram}>{review ? <Send size={17} /> : <Check size={17} />}{busy ? "正在发送…" : review ? "确认发送给学员" : "核对下发内容"}</button></div>
    </form>
  </Dialog>;
}
