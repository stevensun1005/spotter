"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ClipboardList, GraduationCap, Inbox, RefreshCw, Send, ShieldCheck, Unplug, UserRoundPlus, UsersRound } from "lucide-react";
import { avatar, Dialog } from "@/shared/ui";
import type { Plan } from "@/features/plans/model";
import { CoachingConnectDialog } from "./coaching-connect";
import { CoachingSendDialog } from "./coaching-send";
import { CoachingAssignmentDialog, coachingStatus } from "./coaching-assignment";
import { coachingError, coachingRequest } from "./coaching-client";
import type { CoachingAssignment, CoachingHome, CoachingLink } from "./model";

type Props = {
  enabled: boolean; active?: boolean; today: string; saved: () => void;
  templates?: readonly { id: string; plan: Plan }[]; plans?: readonly { id: string; plan: Plan }[];
};

export function CoachingView({ enabled, active = true, today, saved }: Props) {
  const [home, setHome] = useState<CoachingHome>();
  const [role, setRole] = useState<"coach" | "student">("coach");
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connect, setConnect] = useState<"invite" | "join">();
  const [sendTo, setSendTo] = useState<CoachingLink>();
  const [selected, setSelected] = useState<CoachingAssignment>();
  const [disconnect, setDisconnect] = useState<CoachingLink>();
  const [disconnectError, setDisconnectError] = useState("");
  const previouslyActive = useRef(active);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await coachingRequest<CoachingHome>(undefined, "", signal);
      if (signal?.aborted) return;
      if (!Array.isArray(result.links) || !Array.isArray(result.assignments) || !Array.isArray(result.sources) || typeof result.viewerId !== "string") throw new Error("无法读取教练空间，请确认登录后重试。");
      setHome(result); setError("");
    } catch (reason) { if (!signal?.aborted) setError(coachingError(reason)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [enabled]);

  useEffect(() => {
    const abort = new AbortController();
    if (enabled) void load(abort.signal);
    else { setHome(undefined); setConnect(undefined); setSendTo(undefined); setSelected(undefined); setDisconnect(undefined); setError(""); setNotice(""); }
    return () => abort.abort();
  }, [enabled, load]);
  useEffect(() => {
    const entered = active && !previouslyActive.current;
    previouslyActive.current = active;
    if (entered && enabled) void load();
  }, [active, enabled, load]);
  useEffect(() => {
    const wake = () => { if (active && document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [active, load]);

  async function changeSharing(link: CoachingLink, shareDetails: boolean) {
    setBusy(true); setError(""); setNotice("");
    try {
      await coachingRequest({ action: "sharing", linkId: link.id, shareDetails });
      await load();
      setNotice(shareDetails ? "已允许这位教练查看其下发训练的实际组记录。" : "已关闭实际组记录分享，仍分享这些训练的完成状态。");
    } catch (reason) { setError(coachingError(reason)); }
    finally { setBusy(false); }
  }

  async function endRelationship() {
    if (!disconnect) return;
    setBusy(true); setDisconnectError("");
    try {
      await coachingRequest({ action: "disconnect", linkId: disconnect.id });
      setDisconnect(undefined); await load(); setNotice("教练关系已断开。后续下发和读取已停止，学员已有计划与历史保留。");
    } catch (reason) { setDisconnectError(coachingError(reason)); }
    finally { setBusy(false); }
  }

  if (!enabled) return <section className="card coach-empty"><span className="tile mint"><GraduationCap size={27} /></span><h2>教练与学员</h2><p>登录后可邀请学员、连接教练，按授权下发训练并跟进完成情况。</p></section>;

  const learners = home?.links.filter((link) => !link.endedAt && link.coachId === home.viewerId) ?? [];
  const coaches = home?.links.filter((link) => !link.endedAt && link.studentId === home.viewerId) ?? [];
  const links = role === "coach" ? learners : coaches;
  const assignments = home?.assignments.filter((item) => item.viewerRole === role) ?? [];
  const pending = home?.assignments.filter((item) => item.viewerRole === "student" && item.status === "pending").length ?? 0;

  return <div className="coaching-workspace">
    <section className="card coach-intro">
      <div className="coach-intro-copy"><span className="tile mint"><GraduationCap size={26} /></span><div><h2>把训练安排，交到学员手里</h2><p>邀请连接、下发计划、学员确认，再跟进这份训练的完成情况。一个账号可以同时有学员和教练。</p></div></div>
      <div className="coach-toolbar"><button className="button primary" type="button" disabled={busy} onClick={() => setConnect("invite")}><UserRoundPlus size={17} />邀请学员</button><button className="button outline" type="button" disabled={busy} onClick={() => setConnect("join")}><GraduationCap size={17} />连接教练</button></div>
      <p className="coach-privacy"><ShieldCheck size={17} /> 关系单独确认，不会自动添加好友或搭子。教练只查看自己下发训练的授权反馈。</p>
    </section>
    <div className="coach-role-heading"><div className="coach-tabs" role="group" aria-label="教练空间视角"><button type="button" aria-pressed={role === "coach"} onClick={() => setRole("coach")}><UsersRound size={17} />我的学员 <span>{learners.length}</span></button><button type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}><GraduationCap size={17} />我的教练{pending > 0 ? <span className="coach-unread">{pending} 份待接收</span> : <span>{coaches.length}</span>}</button></div><button className="button subtle small" type="button" disabled={busy || loading} onClick={() => void load()}><RefreshCw size={16} />刷新</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p className="coach-notice" role="status"><Check size={17} />{notice}</p>}
    {loading && !home && <p className="muted" role="status">正在读取教练空间…</p>}
    <section className="feature-stack" aria-label={role === "coach" ? "学员名单" : "教练名单"}>
      <div className="coach-section-heading"><h3>{role === "coach" ? "我的学员" : "我的教练"}</h3><span className="muted">{links.length} 位已连接</span></div>
      {!links.length && !loading && !error && <div className="card coach-empty"><span className="tile lilac">{role === "coach" ? <UsersRound size={25} /> : <GraduationCap size={25} />}</span><h3>{role === "coach" ? "从第一位学员开始" : "连接正在带你训练的人"}</h3><p>{role === "coach" ? "给学员一个邀请码，对方确认关系后，你就能发送已有计划或完整周期。" : "输入教练给你的邀请码，先核对身份和分享范围，再确认连接。"}</p><button type="button" className="button outline" onClick={() => setConnect(role === "coach" ? "invite" : "join")}>{role === "coach" ? "邀请学员" : "输入教练邀请码"}</button></div>}
      <div className="coach-person-list">{links.map((link) => {
        const name = role === "coach" ? link.studentName : link.coachName;
        const related = assignments.filter((item) => item.linkId === link.id);
        const completed = related.reduce((total, item) => total + (item.progress?.completed ?? 0), 0);
        return <article className="card coach-person-card" key={link.id}>
          <div className="coach-person-heading"><span className={"avatar " + (role === "coach" ? "mint" : "lilac")} aria-hidden="true">{avatar(name)}</span><div><h4>{name}</h4><p>{role === "coach" ? "我的学员" : "我的教练"} · 已连接</p></div></div>
          {role === "coach" ? <><div className="coach-meta"><span>{related.length} 份下发</span><span>{completed} 节已完成</span><span>{link.shareDetails ? "获准查看实际组记录" : "仅分享完成状态"}</span></div><button className="button primary small coach-self-start" type="button" disabled={busy} onClick={() => setSendTo(link)}><Send size={16} />发送训练</button></>
            : <label className="coach-option"><input type="checkbox" checked={link.shareDetails} disabled={busy} onChange={(event) => void changeSharing(link, event.target.checked)} /><span><strong>分享这位教练下发训练的实际组记录</strong><small>可选，包含这段关系下已完成训练的历史组记录。完成状态与主动反馈继续分享；无关训练、私人备注、心率、身体和饮食不会通过教练关系开放。</small></span></label>}
          <button className="text-button coach-disconnect" type="button" disabled={busy} onClick={() => { setDisconnect(link); setDisconnectError(""); }}><Unplug size={15} />断开教练关系</button>
        </article>;
      })}</div>
    </section>
    <section className="feature-stack" aria-label={role === "coach" ? "下发训练记录" : "收到的训练计划"}>
      <div className="coach-section-heading"><h3>{role === "coach" ? <><ClipboardList size={19} />下发记录</> : <><Inbox size={19} />收到的计划</>}</h3><span className="muted">{assignments.length} 份</span></div>
      {!assignments.length && !loading && <div className="card coach-empty coach-empty-small"><CalendarDays size={23} /><p>{role === "coach" ? "发送训练后，可在这里查看学员的接收与完成情况。" : "教练发来的训练会出现在这里。预览并确认后才会加入你的日历。"}</p></div>}
      <div className="coach-assignment-list">{assignments.map((item) => <article className="card coach-assignment-card" key={item.id}>
        <div className="coach-card-heading"><div><h4>{item.title}</h4><p>{role === "coach" ? "发给 " + item.studentName : "来自 " + item.coachName}</p></div><span className="coach-state" data-state={item.status}>{coachingStatus[item.status]}</span></div>
        <div className="coach-meta"><span>{item.startDate} 开始</span><span>{item.weeks} 周 · {item.sessionCount} 节</span><span>{item.kind === "program" ? "训练周期" : "单次训练"}</span></div>
        {item.progress && <div className="coach-progress-summary"><progress max={Math.max(1, item.progress.total)} value={item.progress.completed} aria-label={item.title + "完成进度"} /><span>{item.progress.completed}/{item.progress.total} 节完成{item.progress.inProgress > 0 ? " · " + item.progress.inProgress + " 节进行中" : ""}</span></div>}
        <button type="button" className={"button small coach-self-start " + (item.status === "pending" && role === "student" ? "primary" : "outline")} disabled={busy} onClick={() => setSelected(item)}>{item.status === "pending" && role === "student" ? "查看并确认接收" : "查看训练与反馈"}</button>
      </article>)}</div>
    </section>
    {connect && <CoachingConnectDialog mode={connect} close={() => setConnect(undefined)} joined={() => { setRole("student"); setNotice("已连接教练。你可逐份预览并接收对方下发的训练。"); void load(); }} />}
    {sendTo && home && <CoachingSendDialog link={sendTo} sources={home.sources} today={today} close={() => setSendTo(undefined)} sent={(assignment) => { setNotice("已发送给 " + assignment.studentName + "，等待学员确认接收。"); setSelected(assignment); void load(); }} />}
    {selected && <CoachingAssignmentDialog key={selected.id} value={selected} close={() => setSelected(undefined)} changed={() => void load()} saved={saved} />}
    {disconnect && <Dialog title="断开教练关系" onClose={() => { if (!busy) setDisconnect(undefined); }}><div className="dialog-body feature-stack"><p>确认断开与 {disconnect.coachId === home?.viewerId ? disconnect.studentName : disconnect.coachName} 的教练关系？</p><p>断开后停止新的计划下发，也停止教练读取完成记录和反馈。已经接收的计划与训练历史仍保留在学员账号。</p>{disconnectError && <p className="inline-error" role="alert">{disconnectError}</p>}</div><div className="dialog-footer"><button type="button" className="button outline" disabled={busy} onClick={() => setDisconnect(undefined)}>继续保持连接</button><button type="button" className="button primary" disabled={busy} onClick={() => void endRelationship()}>{busy ? "正在断开…" : "确认断开"}</button></div></Dialog>}
  </div>;
}
