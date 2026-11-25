"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarPlus, ChevronRight, Heart } from "lucide-react";
import { errorText } from "@/shared/client";
import { Dialog } from "@/shared/ui";
import type { WorkoutAppointment } from "./appointments";
import type { Friend } from "./model";

const endpoint = "/api/friends/engagement";
const status = { pending: "待确认", accepted: "已约好", declined: "已婉拒", cancelled: "已取消" };
const dateTime = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });

type Engagement = {
  cheers: { date: string; names: string[]; workouts: { id: string; title: string }[] }[];
  appointments: WorkoutAppointment[];
};

async function request<T>(options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, { cache: "no-store", ...options });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error : "暂时无法读取，请重试。";
    throw new Error(message);
  }
  return result as T;
}

export function EngagementButton({ kind, owner, buddy, openOwnLog }: {
  kind: "cheers" | "appointments"; owner: string; buddy?: Friend; openOwnLog?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = kind === "cheers" ? "收到的加油" : "约下次训练";
  const Icon = kind === "cheers" ? Heart : CalendarPlus;

  return <>
    <section className="card padded friend-new">
      <button className="list-line friend-row" type="button" onClick={() => setOpen(true)}>
        <span className="tile mint"><Icon size={19} aria-hidden="true" /></span>
        <span><strong>{title}</strong></span><ChevronRight size={18} aria-hidden="true" />
      </button>
    </section>
    {open && <EngagementDialog kind={kind} title={title} owner={owner} buddy={buddy} onClose={() => setOpen(false)}
      openOwnLog={openOwnLog && ((id) => { setOpen(false); openOwnLog(id); })} />}
  </>;
}

function EngagementDialog({ kind, title, owner, buddy, onClose, openOwnLog }: {
  kind: "cheers" | "appointments"; title: string; owner: string; buddy?: Friend;
  onClose: () => void; openOwnLog?: (id: string) => void;
}) {
  const [data, setData] = useState<Engagement>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState("");
  const [note, setNote] = useState("");
  const draftID = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    void request<Engagement>({ signal: controller.signal }).then(
      (next) => { if (!controller.signal.aborted) setData(next); },
      (reason) => { if (!controller.signal.aborted) setError(errorText(reason)); },
    );
    return () => controller.abort();
  }, [owner, attempt]);

  async function mutate(body: object, message: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<Pick<Engagement, "appointments">>({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedOwner: owner }),
      });
      setData((current) => ({ cheers: current?.cheers ?? [], appointments: result.appointments }));
      setNotice(message);
      return true;
    } catch (reason) {
      setError(errorText(reason));
      return false;
    } finally { setBusy(false); }
  }

  async function propose(event: FormEvent) {
    event.preventDefault();
    const startsAt = Date.parse(scheduled);
    if (!buddy || !Number.isFinite(startsAt) || startsAt <= Date.now()) {
      setError("请选择未来的训练时间。");
      return;
    }
    draftID.current ||= crypto.randomUUID();
    if (await mutate({ action: "propose", id: draftID.current, partner: buddy.id, startsAt, note }, "训练邀约已发出。")) {
      setScheduled("");
      setNote("");
      draftID.current = "";
    }
  }

  function appointmentRow(item: WorkoutAppointment) {
    const incoming = item.recipient === owner;
    const future = item.startsAt > Date.now();
    return <article className="card padded feature-stack" key={item.id}>
      <div className="section-head">
        <h3>{incoming ? "搭子的邀约" : "我发起的邀约"}</h3>
        <span className={`state-tag ${item.status === "accepted" ? "checked" : ""}`}>{!future && item.status === "pending" ? "已过期" : status[item.status]}</span>
      </div>
      <strong>{dateTime.format(item.startsAt)}</strong>
      {item.note && <p className="muted">{item.note}</p>}
      {future && incoming && item.status === "pending" && <div className="friend-dialog-actions">
        <button className="button primary small" type="button" disabled={busy}
          onClick={() => void mutate({ action: "accept", id: item.id }, "已接受邀约。")}>接受</button>
        <button className="button outline small" type="button" disabled={busy}
          onClick={() => void mutate({ action: "decline", id: item.id }, "已婉拒邀约。")}>婉拒</button>
      </div>}
      {future && (item.status === "accepted" || (!incoming && item.status === "pending")) &&
        <button className="button outline small" type="button" disabled={busy}
          onClick={() => void mutate({ action: "cancel", id: item.id }, "已取消邀约。")}>取消邀约</button>}
    </article>;
  }

  return <Dialog title={title} onClose={() => { if (!busy) onClose(); }}>
    <div className="dialog-body feature-stack">
      {kind === "appointments" && buddy && <form className="card padded feature-stack" onSubmit={(event) => void propose(event)}>
        <h3>邀请 {buddy.name} 一起训练</h3>
        <label>训练时间<input type="datetime-local" required value={scheduled} disabled={busy}
          onChange={(event) => { setScheduled(event.target.value); draftID.current = ""; }} /></label>
        <label>地点或备注（选填）<input maxLength={180} value={note} disabled={busy}
          onChange={(event) => { setNote(event.target.value); draftID.current = ""; }} /></label>
        <button className="button primary" type="submit" disabled={busy || !data || !scheduled}>发出训练邀约</button>
      </form>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {!data && (error
        ? <button className="button outline" type="button" onClick={() => { setError(""); setAttempt(attempt + 1); }}>重新读取</button>
        : <p className="muted" role="status">正在读取…</p>)}
      {data && kind === "appointments" && (data.appointments.length ? data.appointments.map(appointmentRow) : <p className="empty-copy">还没有近期训练邀约。</p>)}
      {data && kind === "cheers" && <>
        <p className="muted">近 14 天</p>
        {data.cheers.length ? data.cheers.map((day) => <article className="card padded feature-stack" key={day.date}>
          <small className="muted">{day.date}</small><strong>{day.names.join("、")} 给你加油了</strong>
          {day.workouts.map((workout) => openOwnLog
            ? <button className="button outline small" key={workout.id} type="button" onClick={() => openOwnLog(workout.id)}>
                {workout.title}<ChevronRight size={14} aria-hidden="true" />
              </button>
            : <span key={workout.id}>{workout.title}</span>)}
        </article>) : <p className="empty-copy">这段时间还没有收到加油。</p>}
      </>}
    </div>
  </Dialog>;
}
