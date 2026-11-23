"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Clipboard, Dumbbell, Lock, UserRoundPlus, Users, Utensils } from "lucide-react";
import { errorText } from "@/shared/client";
import { offsetDate, shortDate } from "@/shared/dates";
import { avatar, Dialog, displayNumber } from "@/shared/ui";
import type { Friend, FriendDay, FriendList, FriendMutation, SharedMeal, SharedWorkout } from "./model";

const endpoint = "/api/friends";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "好友数据暂时无法读取。";
    throw new Error(message);
  }
  return data as T;
}

function useFriendDay(id: string | undefined, date: string, revision: number) {
  const [state, setState] = useState<{ id: string; date: string; revision: number; data?: FriendDay; error?: string }>();
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    const url = endpoint + "?" + new URLSearchParams({ friend: id, date });
    void request<FriendDay>(url, { signal: abort.signal }).then(
      (data) => { if (!abort.signal.aborted) setState({ id, date, revision, data }); },
      (reason) => { if (!abort.signal.aborted) setState({ id, date, revision, error: errorText(reason) }); },
    );
    return () => abort.abort();
  }, [id, date, revision]);
  return state?.id === id && state?.date === date && state?.revision === revision ? state : undefined;
}

function setText(set: SharedWorkout["exercises"][number]["sets"][number], unit: string) {
  const weightText = (weight: number, reps: number) => (weight > 0 ? displayNumber(weight) + " " + unit + " × " : "") + reps + " 次";
  if (set.seconds > 0) {
    return (set.weight > 0 ? displayNumber(set.weight) + " " + unit + " · " : "") + displayNumber(set.seconds) + " 秒";
  }
  return set.right
    ? "左 " + weightText(set.weight, set.reps) + "／右 " + weightText(set.right.weight, set.right.reps)
    : weightText(set.weight, set.reps);
}

function WorkoutDetails({ workout, first }: { workout: SharedWorkout; first: boolean }) {
  const duration = [workout.category, workout.minutes ? displayNumber(workout.minutes) + " 分钟" : "",
    workout.sets ? workout.sets + " 组" : ""].filter(Boolean).join(" · ");
  if (!workout.exercises.length) return <div className="friend-workout simple"><strong>{workout.title}</strong><small>{duration}</small></div>;
  return <details className="friend-workout" open={first}>
    <summary><span><strong>{workout.title}</strong><small>{duration}</small></span><ChevronDown size={17} aria-hidden="true" /></summary>
    <ol className="friend-moves">{workout.exercises.map((move, index) => <li key={index}>
      <strong>{move.name}</strong>
      <ul className="friend-sets">{move.sets.map((set, setIndex) => <li key={setIndex}>
        <span>{set.kind === "warmup" ? "热身" : set.kind === "drop" ? "递减" : "第 " + (setIndex + 1) + " 组"}</span>
        <span>{setText(set, move.unit)}</span>
      </li>)}</ul>
    </li>)}</ol>
  </details>;
}

function Meals({ meals }: { meals: SharedMeal[] }) {
  return <div className="friend-meal-list">{(["早餐", "午餐", "晚餐", "加餐"] as const).map((meal) => {
    const entries = meals.filter((entry) => entry.meal === meal);
    if (!entries.length) return null;
    return <div className="friend-meal" key={meal}>
      <h3>{meal}</h3>
      <ul>{entries.map((entry) => <li key={entry.id}>
        <strong>{entry.name}{entry.grams !== undefined && <span> · {displayNumber(entry.grams)} g</span>}</strong>
        <small>{displayNumber(entry.calories)} 千卡 · 蛋白质 {displayNumber(entry.protein)} g · 碳水 {displayNumber(entry.carbs)} g · 脂肪 {displayNumber(entry.fat)} g</small>
      </li>)}</ul>
    </div>;
  })}</div>;
}

function FriendDailyRecords({ data }: { data: FriendDay }) {
  return <>
    <section className="card padded feature-stack">
      <div className="friend-record-heading"><span className="tile mint"><Dumbbell size={19} aria-hidden="true" /></span><h2>训练</h2>
        <span className={"state-tag" + (data.workoutCheckin ? " checked" : "")}>{data.workoutCheckin ? "已打卡" : "未打卡"}</span>
      </div>
      {data.training === null
        ? <p className="friend-private"><Lock size={15} aria-hidden="true" /> 对方目前只分享训练打卡状态。</p>
        : data.training.map((workout, index) => <WorkoutDetails workout={workout} first={index === 0} key={workout.id} />)}
    </section>
    <section className="card padded feature-stack">
      <div className="friend-record-heading"><span className="tile sand"><Utensils size={19} aria-hidden="true" /></span><h2>饮食</h2>
        {data.dietCheckin !== null && <span className={"state-tag" + (data.dietCheckin ? " checked" : "")}>{data.dietCheckin ? "已记录" : "未记录"}</span>}
      </div>
      {data.dietCheckin === null
        ? <p className="friend-private"><Lock size={15} aria-hidden="true" /> 饮食记录仅对方可见。</p>
        : data.nutrition === null
          ? <p className="friend-private"><Lock size={15} aria-hidden="true" /> 对方目前只分享饮食记录状态。</p>
          : data.nutrition.length > 0 && <Meals meals={data.nutrition} />}
    </section>
  </>;
}

function SharingSwitch({ title, description, checked, disabled, change }: {
  title: string; description: string; checked: boolean; disabled: boolean; change: (checked: boolean) => void;
}) {
  return <label className="friend-share-option">
    <span><strong>{title}</strong><small>{description}</small></span>
    <input type="checkbox" role="switch" aria-label={title} checked={checked} disabled={disabled}
      onChange={(event) => change(event.target.checked)} />
  </label>;
}

function SharingSettings({ friend, busy, save }: {
  friend: Friend; busy: boolean; save: (sharing: Friend["sharing"]) => void;
}) {
  const [sharing, setSharing] = useState(friend.sharing);
  const changed = sharing.training !== friend.sharing.training || sharing.nutrition !== friend.sharing.nutrition ||
    sharing.nutritionDetails !== friend.sharing.nutritionDetails;

  return <section className="card padded feature-stack friend-sharing">
    <div className="friend-record-heading"><span className="tile lilac"><Lock size={18} aria-hidden="true" /></span><h2>我分享给{friend.name}</h2></div>
    <div className="friend-share-option friend-share-locked">
      <span><strong>训练打卡状态</strong><small>当天有没有完成训练</small></span>
      <span className="state-tag checked"><Lock size={12} aria-hidden="true" /> 始终分享</span>
    </div>
    {friend.buddy ? <>
      <div className="friend-share-option friend-share-locked">
        <span><strong>训练详情</strong><small>已完成的动作、组数、重量和次数</small></span>
        <span className="state-tag checked"><Lock size={12} aria-hidden="true" /> 始终分享</span>
      </div>
      <SharingSwitch title="饮食记录与详情" description="是否记录饮食，以及餐次、食物、克数和营养" checked={sharing.nutrition} disabled={busy}
        change={(checked) => setSharing({ ...sharing, nutrition: checked, nutritionDetails: checked })} />
    </> : <>
      <SharingSwitch title="训练详情" description="已完成的动作、组数、重量和次数" checked={sharing.training} disabled={busy}
        change={(checked) => setSharing({ ...sharing, training: checked })} />
      <SharingSwitch title="饮食记录状态" description="当天有没有记录餐食" checked={sharing.nutrition} disabled={busy}
        change={(checked) => setSharing({ ...sharing, nutrition: checked, nutritionDetails: checked && sharing.nutritionDetails })} />
      <SharingSwitch title="饮食详情" description={sharing.nutrition ? "餐次、食物、克数和营养" : "先开启饮食记录状态"}
        checked={sharing.nutritionDetails} disabled={busy || !sharing.nutrition}
        change={(checked) => setSharing({ ...sharing, nutritionDetails: checked })} />
    </>}
    <p className="muted">开启后，对方可查看这类历史和今后的记录。你可以随时调整开关。</p>
    <button className="button primary" type="button" disabled={busy || !changed} onClick={() => save(sharing)}>保存分享范围</button>
  </section>;
}

export function FriendsView({ enabled, today, initialFriendId, initialDate }: {
  enabled: boolean; today: string; initialFriendId?: string; initialDate?: string;
}) {
  const [friends, setFriends] = useState<FriendList>();
  const [listError, setListError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [active, setActive] = useState(initialFriendId);
  const [date, setDate] = useState(initialDate ?? today);
  const [dayRevision, setDayRevision] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const friend = friends?.friends.find((item) => item.id === active);
  const invite = friends?.invite;
  const day = useFriendDay(enabled ? friend?.id : undefined, date, dayRevision);

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    void request<FriendList>(endpoint, { signal: abort.signal }).then(
      (data) => { if (!abort.signal.aborted) { setFriends(data); setListError(""); } },
      (reason) => { if (!abort.signal.aborted) setListError(errorText(reason)); },
    );
    return () => abort.abort();
  }, [enabled, loadAttempt]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setLoadAttempt((value) => value + 1);
      setDayRevision((value) => value + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [enabled]);

  function openFriend(item: Friend) {
    setActive(item.id);
    setDate(today);
    setError("");
    setStatus("");
    window.scrollTo({ top: 0 });
  }

  function back() {
    setActive(undefined);
    setError("");
    setStatus("");
    window.scrollTo({ top: 0 });
  }

  async function mutate(body: FriendMutation, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const data = await request<FriendList>(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
      setFriends(data);
      if (body.action === "join") {
        setJoinCode("");
        setInviteOpen(false);
      }
      if (body.action === "remove") {
        setRemoveOpen(false);
        back();
      }
      setStatus(message);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setError("");
      setStatus("好友邀请码已复制。");
    } catch {
      setError("无法自动复制，可以长按邀请码复制。");
    }
  }

  if (!enabled) return <section className="card padded feature-stack">
    <h2>登录后查看好友</h2>
    <p className="muted">你可以邀请搭子、家人和朋友，并为每个人设置分享范围。</p>
    <a className="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">登录</a>
  </section>;

  const feedback = <>{error && <p className="inline-error" role="alert">{error}</p>}
    {status && <p className="friend-status" role="status">{status}</p>}</>;

  return <div className="friends-page feature-stack">
    {friend ? <>
      <div className="friend-detail-heading">
        <button className="text-button friend-back" type="button" onClick={back}><ArrowLeft size={17} aria-hidden="true" /> 返回好友</button>
        <div className="friend-profile"><span className="avatar lilac" aria-hidden="true">{avatar(friend.name)}</span>
          <h2>{friend.name}</h2>{friend.buddy && <span className="state-tag checked">训练搭子</span>}</div>
      </div>
      <section className="card padded feature-stack">
        <div className="section-head"><h2>{date === today ? "今天" : shortDate(date)}的记录</h2></div>
        <div className="friend-date">
          <button className="icon-button" type="button" disabled={date <= "1900-01-01"} aria-label="前一天" onClick={() => setDate(offsetDate(date, -1))}><ChevronLeft size={19} /></button>
          <input type="date" value={date} min="1900-01-01" max={today} aria-label="好友记录日期"
            onChange={(event) => { if (event.target.value && event.target.value <= today && event.target.value >= "1900-01-01") setDate(event.target.value); }} />
          <button className="icon-button" type="button" disabled={date >= today} aria-label="后一天" onClick={() => setDate(offsetDate(date, 1))}><ChevronRight size={19} /></button>
        </div>
        {!day && <p className="muted" role="status">正在读取当天记录…</p>}
        {day?.error && <div className="friend-status"><p className="inline-error" role="alert">{day.error}</p>
          <button className="text-button" type="button" onClick={() => setDayRevision((value) => value + 1)}>重新读取</button></div>}
      </section>
      {day?.data && <FriendDailyRecords data={day.data} />}
      <SharingSettings key={[friend.id, friend.buddy, friend.sharing.training, friend.sharing.nutrition, friend.sharing.nutritionDetails].join(":")}
        friend={friend} busy={busy}
        save={(sharing) => void mutate({ action: "share", id: friend.id, sharing }, "分享范围已保存。")} />
      {!removeOpen && feedback}
      {!friend.buddy && <button className="text-button friend-remove" type="button" disabled={busy}
        onClick={() => { setRemoveOpen(true); setError(""); setStatus(""); }}>移除好友</button>}
      {removeOpen && <Dialog title="移除好友" onClose={() => { if (!busy) setRemoveOpen(false); }}>
        <div className="dialog-body feature-stack"><p>移除后，你和{friend.name}在好友页的分享会停止。</p>{feedback}</div>
        <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={() => setRemoveOpen(false)}>取消</button>
          <button className="button subtle" type="button" disabled={busy} onClick={() => void mutate({ action: "remove", id: friend.id }, "好友已移除。")}>确认移除</button></div>
      </Dialog>}
    </> : <>
      <section className="card padded friend-intro">
        <div className="friend-intro-copy"><span className="tile mint" aria-hidden="true"><Users size={22} /></span>
          <div><h2>我的好友</h2><p className="muted">添加家人和朋友，互相看训练打卡，按人设置详情分享。</p></div></div>
        <button className="button primary" type="button" disabled={!friends || busy}
          onClick={() => { setInviteOpen(true); setError(""); setStatus(""); }}><UserRoundPlus size={18} aria-hidden="true" /> 添加好友</button>
      </section>
      {!inviteOpen && feedback}
      {!friends && !listError && <p className="muted" role="status">正在读取好友…</p>}
      {listError && <section className="card padded feature-stack"><p className="inline-error" role="alert">{listError}</p>
        <button className="button outline" type="button" onClick={() => { setListError(""); setLoadAttempt((value) => value + 1); }}>重试</button></section>}
      {friends && !friends.friends.length && <section className="card padded"><p className="empty-copy">添加好友后，就能在这里点开对方分享的每日记录。</p></section>}
      {active && friends && !listError && <p className="empty-copy">这位好友目前不可查看。</p>}
      {Boolean(friends?.friends.length) && <section className="card padded friend-list" aria-label="好友名单">
        {friends?.friends.map((item) => <button key={item.id} className="list-line friend-row" type="button" onClick={() => openFriend(item)}>
          <span className={"avatar " + (item.buddy ? "lilac" : "lime")} aria-hidden="true">{avatar(item.name)}</span>
          <span><strong>{item.name}{item.buddy && <span className="state-tag checked">训练搭子</span>}</strong>
            <small>{["训练打卡", item.shared.training && "训练详情", item.shared.nutritionDetails ? "饮食详情" : item.shared.nutrition && "饮食状态"].filter(Boolean).join(" · ")}</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>)}
      </section>}
    </>}
    {inviteOpen && <Dialog title="添加好友" onClose={() => { if (!busy) { setInviteOpen(false); setError(""); setStatus(""); } }}>
      <div className="dialog-body feature-stack">
        <section className="friend-invite-consent">
          <h3>添加后默认互相分享</h3>
          <p>双方的每日训练打卡、训练详情和饮食记录状态，包括历史记录。具体吃了什么和营养数据可以单独开启。</p>
        </section>
        <section className="feature-stack">
          <h3>我的邀请码</h3>
          <p className="muted">把邀请码给已获网站访问权限的好友。对方登录训练搭子后输入邀请码，即可添加。</p>
          {invite && Date.parse(invite.expiresAt) > Date.now() ? <>
            <label className="field-title" htmlFor="friend-invite-code">好友邀请码</label>
            <input className="friend-invite-code" id="friend-invite-code" readOnly value={invite.code} onFocus={(event) => event.target.select()} />
            <p className="muted">有效至 {new Date(invite.expiresAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}，使用一次后失效。</p>
            <div className="friend-dialog-actions"><button className="button primary" type="button" disabled={busy}
              onClick={() => void copyCode(invite.code)}><Clipboard size={17} aria-hidden="true" /> 复制邀请码</button>
              <button className="button outline" type="button" disabled={busy}
                onClick={() => void mutate({ action: "revoke" }, "邀请码已停用。")}>停用邀请码</button></div>
          </> : <button className="button primary" type="button" disabled={busy}
            onClick={() => void mutate({ action: "invite" }, "邀请码已生成，24 小时内有效。")}>生成邀请码</button>}
        </section>
        <form className="form-fields friend-join" onSubmit={(event) => {
          event.preventDefault();
          void mutate({ action: "join", code: joinCode.trim().toLowerCase() }, "好友已添加。");
        }}>
          <label>对方的邀请码<input required type="text" autoCapitalize="none" autoComplete="off" spellCheck={false}
            maxLength={40} placeholder="输入或粘贴好友邀请码" value={joinCode} disabled={busy} onChange={(event) => setJoinCode(event.target.value)} /></label>
          <button className="button outline" disabled={busy || !/^[a-f0-9]{32}$/i.test(joinCode.trim())}>添加为好友</button>
        </form>
        {feedback}
      </div>
    </Dialog>}
  </div>;
}
