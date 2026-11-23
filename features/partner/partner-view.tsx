"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Copy, Flame, Link2, Users } from "lucide-react";
import { avatar, Dialog } from "@/shared/ui";
import { errorText, send } from "@/shared/client";
import { isTraining, type State, type TrainingEntry } from "@/shared/state";

export function PartnerActivity({ state, today, manage, showLog, refresh }: {
  state: State; today: string; manage: () => void; showLog: (log: TrainingEntry) => void;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { me, room, entries } = state;
  const partner = room?.partner;
  const logs = entries.filter(isTraining).filter((entry) => entry.kind === "log");
  const latestPartner = logs.filter((log) => log.owner === partner?.id).sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
  const meToday = logs.find((log) => log.owner === me.id && log.data.date === today);
  const partnerToday = logs.find((log) => log.owner === partner?.id && log.data.date === today);
  const sent = entries.some((entry) => entry.kind === "cheer" && entry.owner === me.id && entry.data.date === today);
  const received = entries.some((entry) => entry.kind === "cheer" && entry.owner === partner?.id && entry.data.date === today);
  async function sendCheer() {
    setBusy(true);
    setError("");
    try { await send("/api/partner", { action: "cheer", date: today }); await refresh(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  return <section className="card padded partner-card">
    <div className="section-head"><h2>搭子动态</h2><span className="tile lilac"><Users size={18} /></span></div>
    <div className="partner-row"><span className="avatar lime">{avatar(me.name)}</span><div><strong>我</strong><small>{meToday?.data.plan.title || "今天还未打卡"}</small></div><span className={"state-tag " + (meToday ? "checked" : "")}>{meToday ? "已完成" : "待打卡"}</span></div>
    <div className="partner-row"><span className="avatar lilac">{partner ? avatar(partner.name) : <Users size={18} />}</span><div><strong>{partner?.name || "训练搭子"}</strong><small>{partnerToday?.data.plan.title || (partner ? "今天还未打卡" : "等待配对")}</small></div><span className={"state-tag " + (partnerToday ? "checked" : "")}>{partnerToday ? "已完成" : partner ? "待打卡" : "未连接"}</span></div>
    {received && <p className="cheer-note"><Flame size={16} /> 搭子今天给你加油了</p>}
    {latestPartner && <button className="text-button partner-link" onClick={() => showLog(latestPartner)}>最近一次打卡 <ChevronRight size={15} /></button>}
    <button className="button outline full" disabled={busy || sent} onClick={partner ? () => void sendCheer() : manage}>{partner ? <Flame size={16} /> : <Link2 size={16} />}{sent ? "今天已加油" : partner ? "给搭子加油" : "连接训练搭子"}</button>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}

export function PartnerSpace({ me, room, close, refresh, notify, children }: {
  me: State["me"]; room: State["room"]; close: () => void; refresh: () => Promise<void>; notify: (text: string) => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = async (task: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await task(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  return <Dialog title="搭子空间" onClose={() => { if (!busy) close(); }}>
    <div className="dialog-body form-fields">
      {room?.partner ? <div className="partner-row"><span className="avatar lilac">{avatar(room.partner.name)}</span><div><strong>{room.partner.name}</strong><small>配对成功，可以互看打卡和共享计划。</small></div><span className="state-tag checked">已连接</span></div> :
        room?.invite ? <><p className="muted">把网址和邀请码发给搭子。让对方在登录页选「使用开通码或邀请码注册」，注册后就会自动配对。</p><input aria-label="搭子邀请码" value={room.invite} readOnly onFocus={(e) => e.target.select()} /><button className="button primary" onClick={async () => {
          try { await navigator.clipboard.writeText(room.invite!); notify("已复制邀请码"); }
          catch { setError("请长按邀请码手动复制。"); }
        }}><Copy size={17} /> 复制邀请码</button></> :
        <><p className="muted">配对后可以互看训练记录、共享计划和加油。</p><button className="button primary" disabled={busy} onClick={() => void update(async () => {
          await send("/api/partner", { action: "create" });
          await refresh();
        })}><Users size={18} /> 创建搭子空间</button></>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {children}
      <button className="text-button sign-out" disabled={busy} onClick={() => void update(async () => {
        await send("/api/auth/logout", {});
        window.location.reload();
      })}>退出 {me.name} 的账号</button>
    </div>
  </Dialog>;
}
