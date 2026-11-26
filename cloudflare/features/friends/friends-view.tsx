"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Clipboard, Dumbbell, Heart, Link, Lock, Pencil, Search, UserRoundPlus, Utensils } from "lucide-react";
import { Anatomy } from "@/features/exercises/anatomy";
import { exerciseMuscles } from "@/features/exercises/guidance";
import { muscleNames, regionMuscle } from "@/features/exercises/labels";
import { fromCatalogue, useCatalogue } from "@/features/exercises/open-gym";
import { signInPath } from "@/features/auth/paths";
import { errorText } from "@/shared/client";
import { offsetDate, shortDate } from "@/shared/dates";
import { avatar, Dialog, displayNumber } from "@/shared/ui";
import type { Friend, FriendDay, FriendFeed as Feed, FriendList, FriendMutation, SharedMeal, SharedWorkout, SharedWorkoutSummary } from "./model";
import type { FriendRequest, SocialMutation, SocialPerson, SocialPreferences, SocialState } from "./social-model";
import { EngagementButton } from "./engagement-panel";
import { remarkLengthLimit, type ContactRemarks } from "./remarks-client";

const endpoint = "/api/friends";
const handleSocialEndpoint = endpoint + "?section=social&includeBuddy=1";

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

function FriendTrainingMuscles({ workouts, sex }: { workouts: SharedWorkout[]; sex?: FriendDay["anatomyVariant"] }) {
  const { data: catalogue } = useCatalogue();
  const weights = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const workout of workouts) {
      for (const move of workout.exercises) {
        if (move.warmup) continue;
        const sets = move.sets.filter((set) => set.kind !== "warmup" && (set.reps > 0 || set.seconds > 0 || (set.right?.reps ?? 0) > 0)).length;
        if (!sets) continue;
        const muscles = exerciseMuscles(move.sourceName ?? move.name, fromCatalogue(catalogue, move));
        for (const [region, activation] of Object.entries(muscles)) {
          if (activation > 0 && region !== "cardiovascular system" && (muscleNames[region] || muscleNames[regionMuscle(region)])) {
            counts[region] = (counts[region] ?? 0) + sets;
          }
        }
      }
    }
    return counts;
  }, [catalogue, workouts]);
  if (!Object.keys(weights).length) return null;
  return <details className="friend-workout friend-muscles">
    <summary><strong>肌群分布</strong><ChevronDown size={17} aria-hidden="true" /></summary>
    <Anatomy weights={weights} showIntensity sex={sex ?? null} />
  </details>;
}

function FriendDailyRecords({ data }: { data: FriendDay }) {
  return <>
    <section className="card padded feature-stack">
      <div className="friend-record-heading"><span className="tile mint"><Dumbbell size={19} aria-hidden="true" /></span><h2>训练</h2>
        <span className={"state-tag" + (data.workoutCheckin ? " checked" : "")}>{data.workoutCheckin ? "已打卡" : "未打卡"}</span>
      </div>
      {data.training === null
        ? <p className="friend-private"><Lock size={15} aria-hidden="true" /> 对方目前只分享训练打卡状态。</p>
        : <>
          {data.training.map((workout, index) => <WorkoutDetails workout={workout} first={index === 0} key={workout.id} />)}
          {data.training.length > 0 && <FriendTrainingMuscles key={data.friend.id + "/" + data.date} workouts={data.training} sex={data.anatomyVariant} />}
        </>}
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
      <span className="state-tag checked"><Lock size={12} aria-hidden="true" /> {friend.buddy ? "搭子可见" : "随朋友圈分享"}</span>
    </div>
    {friend.buddy ? <>
      <div className="friend-share-option friend-share-locked">
        <span><strong>训练详情</strong><small>已完成的动作、组数、重量和次数</small></span>
        <span className="state-tag checked"><Lock size={12} aria-hidden="true" /> 搭子可见</span>
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
    {!friend.buddy && <p className="muted">朋友圈开启时，普通好友可按以上范围查看你的记录。</p>}
    <button className="button primary" type="button" disabled={busy || !changed} onClick={() => save(sharing)}>保存分享范围</button>
  </section>;
}

type FriendsTab = "contacts" | "feed" | "privacy";
const tabOptions = [["contacts", "联系人"], ["feed", "朋友圈"], ["privacy", "权限设置"]] as const;
const initials = [
  ["阿", "A"], ["八", "B"], ["擦", "C"], ["搭", "D"], ["蛾", "E"], ["发", "F"], ["嘎", "G"], ["哈", "H"], ["击", "J"],
  ["喀", "K"], ["垃", "L"], ["妈", "M"], ["拿", "N"], ["哦", "O"], ["啪", "P"], ["七", "Q"], ["然", "R"], ["撒", "S"],
  ["他", "T"], ["挖", "W"], ["昔", "X"], ["压", "Y"], ["匝", "Z"],
] as const;
const nameOrder = new Intl.Collator("zh-CN-u-co-pinyin", { sensitivity: "base" });

function initial(name: string) {
  const first = Array.from(name.trim())[0] ?? "";
  const latin = first.normalize("NFD")[0]?.toUpperCase() ?? "";
  if (/^[A-Z]$/.test(latin)) return latin;
  if (/^\p{Script=Han}$/u.test(first)) {
    for (let index = initials.length - 1; index >= 0; index--) {
      if (nameOrder.compare(first, initials[index][0]) >= 0) return initials[index][1];
    }
    return "A";
  }
  return "#";
}

function useFriendResource<T>(url: string | undefined, revision: number) {
  const [state, setState] = useState<{ url: string; revision?: number; data?: T; error?: string }>();
  const requestId = useRef(0);
  useEffect(() => {
    if (!url) return;
    const id = ++requestId.current;
    const abort = new AbortController();
    void request<T>(url, { signal: abort.signal }).then(
      (data) => { if (!abort.signal.aborted && id === requestId.current) setState({ url, revision, data }); },
      (reason) => { if (!abort.signal.aborted && id === requestId.current) setState({ url, revision, error: errorText(reason) }); },
    );
    return () => abort.abort();
  }, [url, revision]);
  const result = state?.url === url && (state?.revision === undefined || state.revision === revision) ? state : undefined;
  return {
    data: result?.data,
    error: result?.error,
    replace(data: T) {
      if (!url) return;
      requestId.current++;
      setState({ url, data });
    },
  };
}

function FriendRow({ person, remark, sharingOnly, open }: { person: Friend; remark?: string; sharingOnly?: boolean; open: () => void }) {
  return <button className="list-line friend-row" type="button" onClick={open}>
    <span className={"avatar " + (person.buddy ? "lilac" : "lime")} aria-hidden="true">{avatar(person.name)}</span>
    <span><strong>{remark ?? person.name}{person.buddy && <span className="state-tag checked">训练搭子</span>}
      {!sharingOnly && person.checkedIn !== undefined && <span className={"state-tag" + (person.checkedIn ? " checked" : "")}>
        {person.checkedIn ? "今日已打卡" : "今日未打卡"}
      </span>}</strong>
      {!sharingOnly && <small>{[remark && "昵称 " + person.name, "训练打卡", person.shared.training && "训练详情", person.shared.nutritionDetails ? "饮食详情" : person.shared.nutrition && "饮食状态"].filter(Boolean).join(" · ")}</small>}</span>
    <ChevronRight size={18} aria-hidden="true" />
  </button>;
}

function ContactList({ people, remarks, sharingOnly = false, open }: {
  people: Friend[]; remarks?: ContactRemarks["values"]; sharingOnly?: boolean; open: (person: Friend) => void;
}) {
  const name = (person: Friend) => remarks?.[person.id] ?? person.name;
  const buddies = people.filter((person) => person.buddy);
  const friends = people.filter((person) => !person.buddy).sort((a, b) => nameOrder.compare(name(a), name(b)));
  const groups = new Map<string, Friend[]>();
  for (const person of friends) {
    const letter = initial(name(person));
    const group = groups.get(letter);
    if (group) group.push(person);
    else groups.set(letter, [person]);
  }
  const letters = Array.from(groups.keys()).sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b));
  const row = (person: Friend) => <FriendRow key={person.id} person={person} remark={remarks?.[person.id]} sharingOnly={sharingOnly} open={() => open(person)} />;
  return <>
    {buddies.length > 0 && <section className="card padded friend-list friend-buddy-list" aria-label="训练搭子">
      <h3>训练搭子</h3>
      {buddies.map(row)}
    </section>}
    {sharingOnly ? friends.length > 0 && <section className="card padded friend-list" aria-label="普通好友">
      <h3>普通好友</h3>
      {friends.map(row)}
    </section> : <section className="card friend-contacts" aria-label="普通好友">
      <h3 className="friend-contacts-title">普通好友 <span className="state-tag">{friends.length} 位</span></h3>
      {letters.length > 0 && <nav className="friend-letters" aria-label="按首字母定位">
        {letters.map((letter) => <button key={letter} type="button" aria-label={"跳转到 " + letter}
          onClick={() => document.getElementById("friend-letter-" + letter)?.scrollIntoView({ block: "start" })}>{letter}</button>)}
      </nav>}
      {letters.map((letter) => <section key={letter} className="friend-letter-group" id={"friend-letter-" + letter} aria-label={letter}>
        <h4>{letter}</h4>
        <div>{groups.get(letter)?.map(row)}</div>
      </section>)}
    </section>}
  </>;
}

function feedSummary(workout: SharedWorkoutSummary) {
  return <><strong>{workout.title}</strong>
    <small>{[workout.category, workout.minutes > 0 ? displayNumber(workout.minutes) + " 分钟" : "",
      workout.exercises > 0 ? workout.exercises + " 个动作" : "", workout.sets > 0 ? workout.sets + " 组" : ""].filter(Boolean).join(" · ")}</small></>;
}

function FriendFeed({ days, today, remarks, open, openOwnLog, setCheer, busy }: {
  days: Feed["days"]; today: string; remarks?: ContactRemarks["values"]; open: (person: { id: string }, date: string) => void;
  openOwnLog?: (id: string) => void; setCheer: (id: string, date: string, active: boolean) => void; busy: boolean;
}) {
  const activeDays = days.filter(({ items }) => items.length);
  return <div className="feature-stack friend-feed" aria-label="训练打卡动态">
    {activeDays.length === 0 && <p className="card padded empty-copy">最近三天暂无训练打卡。</p>}
    {activeDays.map(({ date, items }) => <section className="feature-stack" key={date}>
      <div className="section-head"><h2>{date === today ? "今天 · " : ""}{shortDate(date)}</h2></div>
      {items.map(({ friend, workouts, own, cheer }) => {
        const identity = <><span className={"avatar " + (friend.buddy ? "lilac" : "lime")} aria-hidden="true">{avatar(friend.name)}</span>
          <span className="friend-feed-copy"><strong>{(own ? undefined : remarks?.[friend.id]) ?? friend.name}{(own || friend.buddy) && <span className="state-tag checked">{own ? "我" : "训练搭子"}</span>}</strong></span></>;
        return <article key={friend.id} className="card padded feature-stack friend-feed-card">
          {own ? <div className="friend-feed-entry">{identity}</div> :
            <button type="button" className="friend-feed-entry" onClick={() => open(friend, date)}>{identity}<ChevronRight size={18} aria-hidden="true" /></button>}
          {workouts?.length ? workouts.map((workout) => own && openOwnLog
            ? <button key={workout.id} type="button" onClick={() => openOwnLog(workout.id)} className="friend-feed-summary friend-feed-own-log">{feedSummary(workout)}</button>
            : <div key={workout.id} className="friend-feed-summary">{feedSummary(workout)}</div>)
            : <p className="friend-private"><Lock size={15} aria-hidden="true" /> 训练详情未共享</p>}
          {cheer?.available ? <button type="button" className="friend-feed-cheer" aria-pressed={cheer.given} disabled={busy}
            onClick={() => setCheer(friend.id, date, !cheer.given)}><Heart size={16} fill={cheer.given ? "currentColor" : "none"} aria-hidden="true" />
            {cheer.given ? "已加油" : "加油"}{cheer.count > 0 && ` · ${cheer.count}`}</button> :
            own && cheer?.count > 0 && <p className="friend-feed-received"><Heart size={16} aria-hidden="true" /> {cheer.count} 人加油</p>}
        </article>;
      })}
    </section>)}
  </div>;
}

const privacyOptions = [
  { key: "closed", label: "关闭朋友圈", description: "向普通好友隐藏训练和饮食记录。搭子的训练共享和独立饮食开关照常生效。" },
  { key: "discoverable", label: "允许通过用户名搜索到我", description: "知道你用户名的人可以在添加好友或搭子时找到你。" },
  { key: "recentOnly", label: "仅显示最近 3 天", description: "你与搭子、好友互相查看最近 3 天的活动。" },
] as const;

function SocialPrivacy({ preferences, busy, save }: {
  preferences: SocialPreferences; busy: boolean; save: (preferences: SocialPreferences) => void;
}) {
  return <section className="card padded feature-stack friend-privacy">
    <div className="friend-record-heading"><span className="tile lilac"><Lock size={18} aria-hidden="true" /></span><h2>朋友圈权限</h2></div>
    {privacyOptions.map(({ key, label, description }) => <SharingSwitch title={label} description={description} checked={preferences[key]} disabled={busy}
      key={key} change={(checked) => save({ ...preferences, [key]: checked })} />)}
  </section>;
}

function FriendFinder({ incoming, outgoing, busy, send, openRequests, mode = "friend" }: {
  incoming: FriendRequest[]; outgoing: FriendRequest[]; busy: boolean; send: (person: SocialPerson) => void; openRequests: () => void;
  mode?: "friend" | "buddy";
}) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [attempt, setAttempt] = useState(0);
  const query = submitted ? endpoint + "?" + new URLSearchParams({ search: submitted, mode }) : undefined;
  const results = useFriendResource<{ results: SocialPerson[] }>(query, attempt);
  return <>
    <form className="form-fields friend-search-form" onSubmit={(event) => {
      event.preventDefault();
      if (!input.trim()) return;
      setSubmitted(input.trim());
      setAttempt((value) => value + 1);
    }}>
      <label>{mode === "buddy" ? "搭子用户名" : "好友用户名"}<input type="search" value={input} maxLength={29}
        placeholder="用户名或 username#tag" autoCapitalize="none" autoComplete="off" spellCheck={false}
        onChange={(event) => setInput(event.target.value)} /></label>
      <button className="button primary" type="submit" disabled={!input.trim()}><Search size={17} aria-hidden="true" /> 搜索</button>
    </form>
    {query && !results.data && !results.error && <p className="muted" role="status">正在查找…</p>}
    {results.error && <p className="inline-error" role="alert">{results.error}</p>}
    {results.data?.results.length === 0 && <p className="empty-copy">暂无匹配用户。可以核对用户名、确认对方的搜索权限，或改用邀请码。</p>}
    {!!results.data?.results.length && <ul className="friend-people-list">
      {results.data.results.map((person) => {
        const pending = outgoing.some((item) => item.personId === person.id && (item.kind ?? "friend") === mode);
        const received = incoming.some((item) => item.personId === person.id && (item.kind ?? "friend") === mode);
        return <li className="friend-person-line" key={person.id}>
          <span className="avatar lime" aria-hidden="true">{avatar(person.name)}</span>
          <span><strong>{person.name}</strong>{person.handle && <small className="muted"> {person.handle}</small>}</span>
          <button className="button outline small" type="button" disabled={busy || pending}
            onClick={() => received ? openRequests() : send(person)}>{received ? "处理申请" : pending ? "已申请" : "发送申请"}</button>
        </li>;
      })}
    </ul>}
  </>;
}

function FriendRequests({ state, busy, respond }: {
  state: SocialState; busy: boolean; respond: (id: string, decision: "accept" | "decline" | "cancel") => void;
}) {
  return <>
    {!state.incoming.length && !state.outgoing.length && <p className="empty-copy">暂无待处理的申请。</p>}
    {state.incoming.length > 0 && <section className="feature-stack">
      <h3>收到的申请</h3>
      <p className="muted">接受后，双方可按各自的权限查看共享记录。</p>
      <ul className="friend-people-list">{state.incoming.map((item) => <li className="friend-person-line with-actions" key={item.id}>
        <span className="avatar lime" aria-hidden="true">{avatar(item.name)}</span><span><strong>{item.name}</strong>{item.kind === "buddy" && <small className="muted"> 搭子申请</small>}</span>
        <div className="friend-dialog-actions"><button className="button outline small" type="button" disabled={busy} onClick={() => respond(item.id, "decline")}>拒绝</button>
          <button className="button primary small" type="button" disabled={busy} onClick={() => respond(item.id, "accept")}>接受</button></div>
      </li>)}</ul>
    </section>}
    {state.outgoing.length > 0 && <section className="feature-stack">
      <h3>发出的申请</h3>
      <ul className="friend-people-list">{state.outgoing.map((item) => <li className="friend-person-line" key={item.id}>
        <span className="avatar lime" aria-hidden="true">{avatar(item.name)}</span><span><strong>{item.name}</strong>{item.kind === "buddy" && <small className="muted"> 搭子申请</small>}</span>
        <button className="button outline small" type="button" disabled={busy} onClick={() => respond(item.id, "cancel")}>撤回申请</button>
      </li>)}</ul>
    </section>}
  </>;
}

export function BuddyFinder({ owner, onConnected }: { owner: string; onConnected: () => void }) {
  const url = handleSocialEndpoint;
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const social = useFriendResource<SocialState>(url, refresh);
  const pending = social.data && {
    ...social.data,
    incoming: social.data.incoming.filter((item) => item.kind === "buddy"),
    outgoing: social.data.outgoing.filter((item) => item.kind === "buddy"),
  };

  async function update(body: SocialMutation, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      social.replace(await request<SocialState>(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedOwner: owner }), signal: AbortSignal.timeout(12000),
      }));
      setNotice(message);
      if (body.action === "respond" && body.decision === "accept") onConnected();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <section className="feature-stack">
    <FriendFinder mode="buddy" incoming={pending?.incoming ?? []} outgoing={pending?.outgoing ?? []} busy={busy}
      openRequests={() => document.getElementById("spotter-buddy-requests")?.scrollIntoView({ block: "nearest" })}
      send={(person) => void update({ action: "request", kind: "buddy", id: person.id }, "搭子申请已发送。")} />
    {pending && (pending.incoming.length > 0 || pending.outgoing.length > 0) && <div id="spotter-buddy-requests" className="feature-stack">
      <FriendRequests state={pending} busy={busy} respond={(id, decision) => void update({ action: "respond", id, decision },
        decision === "accept" ? "搭子已连接。" : decision === "decline" ? "已拒绝申请。" : "申请已撤回。")} />
    </div>}
    {social.error && <button className="button outline" type="button" onClick={() => setRefresh((value) => value + 1)}>重新读取搭子申请</button>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}

function RemarkEditor({ nickname, remark, save, close, onSaved }: {
  nickname: string; remark?: string; save: (next: string) => Promise<void>; close: () => void; onSaved: (next: string) => void;
}) {
  const [draft, setDraft] = useState(remark ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clean = draft.trim();
  const length = Array.from(clean).length;
  const valid = length <= remarkLengthLimit && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(clean);

  async function submit(next: string) {
    setBusy(true);
    setError("");
    try {
      await save(next);
      onSaved(next);
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "备注暂时无法保存。");
    } finally { setBusy(false); }
  }

  return <Dialog title={remark ? "编辑备注" : "添加备注"} onClose={() => { if (!busy) close(); }}>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy && valid && clean !== (remark ?? "")) void submit(clean); }}>
      <div className="dialog-body form-fields">
        <label>备注名称<input value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={nickname} autoComplete="off" autoFocus disabled={busy} aria-describedby="friend-remark-hint" /></label>
        <p className="muted" id="friend-remark-hint">仅自己可见 · {length} / {remarkLengthLimit}</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        {remark && <button className="button outline" type="button" disabled={busy} onClick={() => void submit("")}>移除备注</button>}
        <button className="button primary" disabled={busy || !valid || clean === (remark ?? "")}>保存</button>
      </div>
    </form>
  </Dialog>;
}

export function FriendsView({ enabled, owner, today, initialFriendId, initialDate, sharingOnly = false, onChanged, openOwnLog, remarks }: {
  enabled: boolean; owner?: string; today: string; initialFriendId?: string; initialDate?: string; sharingOnly?: boolean; onChanged?: () => void;
  remarks?: ContactRemarks;
  openOwnLog?: (id: string) => void;
}) {
  const sharingView = useRef<HTMLDivElement>(null);
  const listUrl = sharingOnly ? endpoint : endpoint + "?" + new URLSearchParams({ today });
  const [friends, setFriends] = useState<FriendList>();
  const [listError, setListError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [active, setActive] = useState(initialFriendId);
  const [date, setDate] = useState(initialDate ?? today);
  const [dayRevision, setDayRevision] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<"search" | "code">("search");
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [tab, setTab] = useState<FriendsTab>("contacts");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const friend = friends?.friends.find((item) => item.id === active);
  const remark = friend && remarks?.values[friend.id];
  const invite = friends?.invite;
  const day = useFriendDay(enabled && !sharingOnly ? friend?.id : undefined, date, dayRevision);
  const socialUrl = enabled ? handleSocialEndpoint : undefined;
  const feedUrl = enabled && !sharingOnly && tab === "feed" && !friend ? endpoint + "?feed=2" : undefined;
  const social = useFriendResource<SocialState>(socialUrl, loadAttempt);
  const feed = useFriendResource<Feed>(feedUrl, loadAttempt);

  useEffect(() => {
    if (sharingOnly) return;
    const inviteLink = /^#friend-invite=([a-f0-9]{32})$/i.exec(window.location.hash);
    if (inviteLink) {
      setJoinCode(inviteLink[1].toLowerCase());
      setInviteOpen(true);
      setInviteTab("code");
    }
  }, [sharingOnly]);

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    void request<FriendList>(listUrl, { signal: abort.signal }).then(
      (data) => { if (!abort.signal.aborted) { setFriends(data); setListError(""); } },
      (reason) => { if (!abort.signal.aborted) setListError(errorText(reason)); },
    );
    return () => abort.abort();
  }, [enabled, listUrl, loadAttempt]);

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

  function scrollToTop() {
    if (sharingOnly) sharingView.current?.closest("dialog")?.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }

  function openFriend(item: { id: string }, selectedDate = today) {
    setActive(item.id);
    setDate(selectedDate);
    setError("");
    setStatus("");
    scrollToTop();
  }

  function back() {
    setActive(undefined);
    setRemarkOpen(false);
    setError("");
    setStatus("");
    scrollToTop();
  }

  function openAdd() {
    setInviteTab("search");
    setInviteOpen(true);
    setError("");
    setStatus("");
  }

  function openRequests() {
    setInviteOpen(false);
    setRequestsOpen(true);
    setError("");
    setStatus("");
  }

  async function setFeedCheer(friend: string, date: string, active: boolean) {
    if (!feedUrl || busy || !owner) return;
    setBusy(true);
    setError("");
    try {
      feed.replace(await request<Feed>(feedUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ action: "feed-cheer", friend, date, active, expectedOwner: owner }),
      }));
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function mutate(body: FriendMutation, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const data = await request<FriendList>(listUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
      setFriends(data);
      if (body.action === "join") {
        setJoinCode("");
        setInviteOpen(false);
        if (/^#friend-invite=[a-f0-9]{32}$/i.test(window.location.hash)) {
          window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
        }
      }
      if (body.action === "remove") {
        setRemoveOpen(false);
        back();
      }
      if (body.action === "join" || body.action === "remove" || body.action === "share") onChanged?.();
      setStatus(message);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function mutateSocial(body: SocialMutation, message: string) {
    if (busy || !socialUrl) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const data = await request<SocialState>(socialUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, expectedOwner: owner }),
        signal: AbortSignal.timeout(12000),
      });
      social.replace(data);
      if (body.action === "respond" && body.decision === "accept") setLoadAttempt((value) => value + 1);
      if (body.action === "social-preferences" || body.action === "respond" && body.decision === "accept") onChanged?.();
      setStatus(message);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite(code: string, link: boolean) {
    const url = new URL("/", window.location.origin);
    url.pathname = "/invite/" + code;
    url.search = "";
    url.hash = "";
    try {
      await navigator.clipboard.writeText(link ? url.href : code);
      setError("");
      setStatus(link ? "邀请链接已复制。" : "好友邀请码已复制。");
    } catch {
      setError("无法自动复制，可以长按邀请码复制。");
    }
  }

  if (!enabled) return <section className="card padded feature-stack">
    <h2>登录后查看好友</h2>
    <p className="muted">你可以邀请搭子、家人和朋友，并为每个人设置分享范围。</p>
    <a className="button primary" href={signInPath(joinCode ? "/#friend-invite=" + joinCode : "/")}>登录</a>
  </section>;

  const buddy = friends?.friends.find((contact) => contact.buddy);
  const feedback = <>{error && <p className="inline-error" role="alert">{error}</p>}
    {status && <p className="friend-status" role="status">{status}</p>}</>;

  const friendList = <>
    {!friends && !listError && <p className="muted" role="status">正在读取好友…</p>}
    {listError && <section className="card padded feature-stack"><p className="inline-error" role="alert">{listError}</p>
      <button className="button outline" type="button" onClick={() => { setListError(""); setLoadAttempt((value) => value + 1); }}>重试</button></section>}
    {friends && !friends.friends.length && <p className="empty-copy">
      {sharingOnly ? "添加好友或连接搭子后，可以在这里设置分享范围。" : "添加好友后，可从联系人查看对方分享的每日记录。"}
    </p>}
    {active && friends && !listError && <p className="empty-copy">这位好友目前不可查看。</p>}
    {!!friends?.friends.length && <ContactList people={friends.friends} remarks={remarks?.values} sharingOnly={sharingOnly} open={openFriend} />}
  </>;

  const socialError = social.error && <div className="feature-stack"><p className="inline-error" role="alert">{social.error}</p>
    <button className="button outline" type="button" onClick={() => setLoadAttempt((value) => value + 1)}>重新读取</button></div>;
  const privacy = social.data ? <SocialPrivacy preferences={social.data.preferences} busy={busy}
    save={(preferences) => void mutateSocial({ action: "social-preferences", preferences }, "朋友圈权限已保存。")} /> :
    socialError || <p className="muted" role="status">正在读取朋友圈权限…</p>;

  if (sharingOnly) return <div className="feature-stack" ref={sharingView}>
    {friend ? <>
      <button className="text-button friend-back" type="button" onClick={back} disabled={busy}><ArrowLeft size={17} aria-hidden="true" /> 返回好友名单</button>
      <SharingSettings key={[friend.id, friend.buddy, friend.sharing.training, friend.sharing.nutrition, friend.sharing.nutritionDetails].join(":")}
        friend={friend} busy={busy}
        save={(sharing) => void mutate({ action: "share", id: friend.id, sharing }, "分享范围已保存。")} />
      {feedback}
    </> : <>{privacy}{feedback}{friendList}</>}
  </div>;

  return <div className="friends-page feature-stack">
    {friend ? <>
      <div className="friend-detail-heading">
        <button className="text-button friend-back" type="button" onClick={back}><ArrowLeft size={17} aria-hidden="true" /> 返回好友</button>
        <div className="friend-profile"><span className="avatar lilac" aria-hidden="true">{avatar(friend.name)}</span>
          <div className="friend-profile-name"><h2>{remark ?? friend.name}</h2>
            {remark && <small>昵称 {friend.name}</small>}</div>
          {friend.buddy && <span className="state-tag checked">训练搭子</span>}
          {remarks && (remarks.error
            ? <button className="button outline small friend-remark-button" type="button" onClick={remarks.retry}>重试读取备注</button>
            : <button className="button outline small friend-remark-button" type="button" disabled={!remarks.ready}
              onClick={() => setRemarkOpen(true)}><Pencil size={15} aria-hidden="true" /> {remark ? "编辑备注" : "添加备注"}</button>)}</div>
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
      {day?.data?.restricted
        ? <section className="card padded"><p className="friend-private"><Lock size={15} aria-hidden="true" /> 这一天的记录未开放查看。</p></section>
        : day?.data && <FriendDailyRecords data={day.data} />}
      {remarkOpen && remarks && <RemarkEditor key={friend.id} nickname={friend.name} remark={remark}
        save={(next) => remarks.save(friend.id, next)}
        close={() => setRemarkOpen(false)} onSaved={(next) => setStatus(next ? "备注已保存。" : "备注已移除。")} />}
      {!removeOpen && feedback}
      {!friend.buddy && <button className="text-button friend-remove" type="button" disabled={busy}
        onClick={() => { setRemoveOpen(true); setError(""); setStatus(""); }}>移除好友</button>}
      {removeOpen && <Dialog title="移除好友" onClose={() => { if (!busy) setRemoveOpen(false); }}>
        <div className="dialog-body feature-stack"><p>移除后，你和{friend.name}在好友页的分享会停止。</p>{feedback}</div>
        <div className="dialog-footer"><button className="button outline" type="button" disabled={busy} onClick={() => setRemoveOpen(false)}>取消</button>
          <button className="button subtle" type="button" disabled={busy} onClick={() => void mutate({ action: "remove", id: friend.id }, "好友已移除。")}>确认移除</button></div>
      </Dialog>}
    </> : <>
      <div className="segmented friends-tabs" role="group" aria-label="好友页面">
        {tabOptions.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key}
          onClick={() => { setTab(key); setError(""); setStatus(""); }}>{label}</button>)}
      </div>
      {!inviteOpen && !requestsOpen && feedback}
      {tab === "contacts" && <>
        <div className="section-head friend-contacts-toolbar">
          <h2>联系人{friends && <span className="state-tag">{friends.friends.length} 位</span>}</h2>
          <button className="button primary" type="button" disabled={busy} onClick={openAdd}><UserRoundPlus size={17} aria-hidden="true" /> 添加好友</button>
        </div>
        <section className="card padded friend-new">
          <button className="list-line friend-row" type="button" onClick={openRequests}>
            <span className="tile mint"><UserRoundPlus size={19} aria-hidden="true" /></span><span><strong>新的朋友
              {!!social.data?.incoming.length && <span className="state-tag checked">{social.data.incoming.length} 条申请</span>}
            </strong></span><ChevronRight size={18} aria-hidden="true" />
          </button>
        </section>
        {friendList}
        {owner && buddy && <EngagementButton kind="appointments" owner={owner} buddy={buddy} />}
      </>}
      {tab === "feed" && <>{owner && <EngagementButton kind="cheers" owner={owner} openOwnLog={openOwnLog} />}
        {feed.data ? <FriendFeed days={feed.data.days} today={today} remarks={remarks?.values} open={openFriend}
        openOwnLog={openOwnLog} setCheer={(friend, date, active) => void setFeedCheer(friend, date, active)} busy={busy} /> :
        feed.error ? <section className="card padded feature-stack"><p className="inline-error" role="alert">{feed.error}</p>
          <button className="button outline" type="button" onClick={() => setLoadAttempt((value) => value + 1)}>重新读取</button></section> :
          <p className="muted" role="status">正在读取朋友圈…</p>}</>}
      {tab === "privacy" && privacy}
    </>}
    {requestsOpen && <Dialog title="新的朋友" onClose={() => { if (!busy) setRequestsOpen(false); }}>
      <div className="dialog-body feature-stack">
        {social.data ? <FriendRequests state={social.data} busy={busy} respond={(id, decision) =>
          void mutateSocial({ action: "respond", id, decision }, decision === "accept" ? "申请已接受。" : decision === "decline" ? "已拒绝申请。" : "申请已撤回。")} /> :
          socialError || <p className="muted" role="status">正在读取好友申请…</p>}
        {feedback}
      </div>
    </Dialog>}
    {inviteOpen && <Dialog title="添加好友" onClose={() => { if (!busy) { setInviteOpen(false); setError(""); setStatus(""); } }}>
      <div className="dialog-body feature-stack">
        <section className="friend-invite-consent">
          <h3>添加后默认互相分享</h3>
          <p>好友默认互相分享训练打卡、训练详情和饮食记录状态，具体范围遵循双方的分享设置。</p>
        </section>
        <div className="segmented friend-dialog-tabs" role="group" aria-label="添加好友方式">
          <button type="button" aria-pressed={inviteTab === "search"} onClick={() => setInviteTab("search")}>搜索用户名</button>
          <button type="button" aria-pressed={inviteTab === "code"} onClick={() => setInviteTab("code")}>邀请链接</button>
        </div>
        {inviteTab === "search" ? <FriendFinder incoming={social.data?.incoming ?? []} outgoing={social.data?.outgoing ?? []} busy={busy}
          openRequests={openRequests} send={(person) => void mutateSocial({ action: "request", id: person.id }, "好友申请已发送。")} /> : <>
        <section className="feature-stack">
          <h3>我的邀请码</h3>
          <p className="muted">把邀请链接或邀请码给已获网站访问权限的好友。对方登录后可接受邀请。</p>
          {invite && Date.parse(invite.expiresAt) > Date.now() ? <>
            <label className="field-title" htmlFor="friend-invite-code">好友邀请码</label>
            <input className="friend-invite-code" id="friend-invite-code" readOnly value={invite.code} onFocus={(event) => event.target.select()} />
            <p className="muted">有效至 {new Date(invite.expiresAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}，使用一次后失效。</p>
            <div className="friend-dialog-actions"><button className="button primary" type="button" disabled={busy}
              onClick={() => void copyInvite(invite.code, true)}><Link size={17} aria-hidden="true" /> 复制邀请链接</button>
              <button className="button outline" type="button" disabled={busy}
                onClick={() => void copyInvite(invite.code, false)}><Clipboard size={17} aria-hidden="true" /> 复制邀请码</button>
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
        </form></>}
        {feedback}
      </div>
    </Dialog>}
  </div>;
}
