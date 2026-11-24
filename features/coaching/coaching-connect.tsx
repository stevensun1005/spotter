"use client";

import { useState } from "react";
import { Check, Clipboard, KeyRound, ShieldCheck, UserRoundPlus } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { coachingError, coachingRequest } from "./coaching-client";

export function CoachingConnectDialog({ mode: initialMode, close, joined }: { mode: "invite" | "join"; close: () => void; joined: () => void }) {
  const [mode, setMode] = useState(initialMode);
  const [invite, setInvite] = useState<{ code: string; expiresAt: string }>();
  const [revealed, setRevealed] = useState(false);
  const [code, setCode] = useState("");
  const [inspected, setInspected] = useState<{ coachName: string; expiresAt: string }>();
  const [consent, setConsent] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const normalizedCode = code.trim().toLowerCase();

  async function act(task: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); }
    catch (reason) { setError(coachingError(reason)); }
    finally { setBusy(false); }
  }

  return <Dialog title={mode === "invite" ? "邀请我的学员" : "连接我的教练"} onClose={() => { if (!busy) close(); }} className="coach-connect-dialog">
    <div className="dialog-body feature-stack">
      <div className="coach-tabs" role="group" aria-label="连接方式">
        <button type="button" aria-pressed={mode === "invite"} disabled={busy} onClick={() => { setMode("invite"); setError(""); setNotice(""); }}>我是教练，邀请学员</button>
        <button type="button" aria-pressed={mode === "join"} disabled={busy} onClick={() => { setMode("join"); setError(""); setNotice(""); }}>我是学员，连接教练</button>
      </div>
      <p className="coach-privacy"><ShieldCheck size={18} /> 教练关系独立于好友和搭子，只围绕教练下发的训练分享完成情况与反馈。</p>
      {mode === "invite" ? <section className="feature-stack">
        <h3><UserRoundPlus size={19} /> 邀请一位学员</h3>
        <p>生成一次性邀请码，交给学员。学员登录训练搭子后，先核对你的身份与分享范围，再确认连接。</p>
        <p className="muted">对方仍需要当前私密 Sites 的访问权限。此处建立应用内关系，不会自动开通网站访问。</p>
        {invite ? <div className="coach-invite-box feature-stack">
          <label>学员邀请码<input type={revealed ? "text" : "password"} readOnly value={invite.code} autoComplete="off" spellCheck={false} onFocus={(event) => event.target.select()} /></label>
          <p className="muted">有效至 {new Date(invite.expiresAt).toLocaleString("zh-CN")}，使用一次后失效。关闭窗口后不再显示原码；重新生成会停用之前的码。</p>
          <div className="coach-toolbar">
            <button type="button" className="button primary small" disabled={busy} onClick={() => void act(async () => { await navigator.clipboard.writeText(invite.code); setNotice("邀请码已复制，请只发给要连接的学员。"); })}><Clipboard size={16} />复制邀请码</button>
            <button type="button" className="button outline small" disabled={busy} onClick={() => setRevealed((value) => !value)}>{revealed ? "隐藏" : "显示"}</button>
            <button type="button" className="button subtle small" disabled={busy} onClick={() => void act(async () => { await coachingRequest({ action: "revokeInvite" }); setInvite(undefined); setRevealed(false); setNotice("邀请码已停用。"); })}>停用邀请码</button>
          </div>
        </div> : <div className="coach-toolbar"><button type="button" className="button primary" disabled={busy} onClick={() => void act(async () => { const result = await coachingRequest<{ invite: { code: string; expiresAt: string } }>({ action: "invite" }); setInvite(result.invite); setRevealed(false); })}><KeyRound size={17} />{busy ? "正在生成…" : "生成一次性邀请码"}</button>
          <button type="button" className="button subtle small" disabled={busy} onClick={() => void act(async () => { await coachingRequest({ action: "revokeInvite" }); setNotice("之前生成的邀请码已停用。"); })}>停用之前的邀请码</button></div>}
      </section> : <form className="feature-stack" onSubmit={(event) => { event.preventDefault(); void act(async () => {
        if (!inspected) { const result = await coachingRequest<{ coachName: string; expiresAt: string }>({ action: "inspectInvite", code: normalizedCode }); setInspected(result); setConsent(false); setDetails(false); return; }
        if (!consent) return;
        await coachingRequest({ action: "join", code: normalizedCode, confirmed: true, shareDetails: details });
        joined(); close();
      }); }}>
        <label>教练的邀请码<input required autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} disabled={busy || Boolean(inspected)} value={code} placeholder="粘贴教练提供的邀请码" onChange={(event) => { setCode(event.target.value); setInspected(undefined); }} /></label>
        {inspected && <section className="coach-consent feature-stack">
          <h3>确认连接 {inspected.coachName}</h3>
          <p>连接后，这位教练可以向你发送训练计划；每份计划仍由你预览、确认后进入日历。</p>
          <label className="coach-option"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /><span><strong>我同意分享这位教练下发训练的完成状态</strong><small>只针对这些训练；你主动提交的反馈也会分享给教练。心率、身体、饮食和无关训练不开放。</small></span></label>
          <label className="coach-option"><input type="checkbox" checked={details} disabled={busy} onChange={(event) => setDetails(event.target.checked)} /><span><strong>另行分享这些训练的实际组记录（可选）</strong><small>包括这段教练关系下已经完成训练的历史重量、次数、时长和 RPE；之后可随时关闭。</small></span></label>
          <p className="muted">邀请码有效至 {new Date(inspected.expiresAt).toLocaleString("zh-CN")}。</p>
        </section>}
        <div className="coach-toolbar"><button className="button primary" disabled={busy || !/^[a-f0-9]{64}$/.test(normalizedCode) || Boolean(inspected && !consent)}><Check size={17} />{busy ? "正在处理…" : inspected ? "确认连接这位教练" : "核对教练与分享范围"}</button>{inspected && <button type="button" className="button outline" disabled={busy} onClick={() => { setInspected(undefined); setConsent(false); setDetails(false); }}>更换邀请码</button>}</div>
      </form>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="coach-notice" role="status">{notice}</p>}
    </div>
    <div className="dialog-footer"><button type="button" className="button outline" disabled={busy} onClick={close}>关闭</button></div>
  </Dialog>;
}
