"use client";

import { Check, ChevronRight, Flame, Link2, UserRound, Users } from "lucide-react";
import { shortDate } from "@/shared/dates";
import type { Person, TrainingEntry } from "@/shared/state";
import { avatar } from "@/shared/ui";

type PairTodayProps = {
  me: Person;
  partner?: Person | null;
  partnerHidden?: boolean;
  myToday: readonly TrainingEntry[];
  partnerToday: readonly TrainingEntry[];
  latestPartner?: TrainingEntry;
  today: string;
  partnerLastDay?: string;
  signedIn: boolean;
  loading?: boolean;
  unavailable?: boolean;
  busy: boolean;
  sentCheer: boolean;
  receivedCheer: boolean;
  onShowLog: (log: TrainingEntry) => void;
  onCheer: () => void;
  onConnect: () => void;
  onPartnerHistory?: (date?: string) => void;
};

function Member({ name, person, mine, status, log, open, checked = Boolean(log) }: {
  name: string;
  person?: Person;
  mine?: boolean;
  status: string;
  log?: TrainingEntry;
  checked?: boolean;
  open: (log: TrainingEntry) => void;
}) {
  const className = "pair-today-member" + (mine ? " pair-today-self" : "");
  const content = <>
    <span className="pair-today-person">
      <span className={"avatar " + (mine ? "lime" : "lilac")} aria-hidden="true">
        {person ? avatar(person.name) : <UserRound size={17} />}
      </span>
      <strong>{name}</strong>
    </span>
    <span className={"state-tag" + (checked ? " checked" : "")}>
      {checked && <Check size={13} aria-hidden="true" />}
      {status}
    </span>
    {log && <span className="pair-today-session">
      <span>{log.data.plan.title}</span>
      <ChevronRight size={15} aria-hidden="true" />
    </span>}
  </>;

  if (!log) return <div className={className}>{content}</div>;
  return <button type="button" className={className}
    aria-label={"查看" + (mine ? "我" : name) + "的今日打卡：" + log.data.plan.title}
    onClick={() => open(log)}>{content}</button>;
}

export function PairToday({
  me, partner, partnerHidden = false, myToday, partnerToday, latestPartner, today, partnerLastDay, signedIn, loading, unavailable,
  busy, sentCheer, receivedCheer, onShowLog, onCheer, onConnect, onPartnerHistory,
}: PairTodayProps) {
  const buddy = signedIn ? partner ?? undefined : undefined;
  const mine = signedIn ? myToday.find((log) => log.owner === me.id && log.kind === "log") : undefined;
  const theirs = buddy && !partnerHidden ? partnerToday.find((log) => log.owner === buddy.id && log.kind === "log") : undefined;
  const buddyChecked = Boolean(buddy && !partnerHidden && (theirs || partnerLastDay === today));
  const recentDay = buddy && !partnerHidden && !buddyChecked ? partnerLastDay : undefined;
  const pending = loading ? "同步中" : unavailable ? "待同步" : "未打卡";
  const myStatus = mine ? "已打卡" : signedIn ? pending : "登录后查看";
  const buddyStatus = buddy && partnerHidden ? "打卡未公开" : buddyChecked ? "已打卡" : buddy || loading || unavailable ? pending : "未连接";
  const checked = Number(Boolean(mine)) + Number(buddyChecked);

  return <section className="card pair-today" aria-labelledby="pair-today-title">
    <div className="pair-today-heading">
      <span className="tile mint" aria-hidden="true"><Users size={20} /></span>
      <h2 id="pair-today-title">今日搭子打卡</h2>
      {buddy && !partnerHidden && !loading && !unavailable && <span className="pair-today-progress">{checked} / 2 已打卡</span>}
    </div>
    <div className="pair-today-members">
      <Member name="我" person={signedIn ? me : undefined} mine status={myStatus} log={mine} open={onShowLog} />
      <Member name={buddy?.name || "训练搭子"} person={buddy} status={buddyStatus} log={theirs} checked={buddyChecked}
        open={(log) => onPartnerHistory ? onPartnerHistory(log.data.date) : onShowLog(log)} />
    </div>
    {recentDay && onPartnerHistory && <button type="button" className="pair-today-recent" onClick={() => onPartnerHistory(recentDay)}>
      <span><small>搭子最近打卡 · {shortDate(recentDay)}</small><strong>{latestPartner?.data.date === recentDay ? latestPartner.data.plan.title : "已打卡"}</strong></span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>}
    {buddy && receivedCheer && <p className="pair-today-cheer" role="status"><Flame size={16} aria-hidden="true" /> 搭子今天给你加油了</p>}
    {!loading && <div className="pair-today-actions">
      {buddy && !partnerHidden && onPartnerHistory && <button type="button" className="button outline" onClick={() => onPartnerHistory()}>
        看搭子打卡 <ChevronRight size={16} aria-hidden="true" />
      </button>}
      {buddy
        ? <button type="button" className="button primary" disabled={busy || sentCheer || unavailable} onClick={onCheer}>
            {sentCheer ? <Check size={17} aria-hidden="true" /> : <Flame size={17} aria-hidden="true" />}
            {sentCheer ? "今天已加油" : "给搭子加油"}
          </button>
        : !unavailable && <button type="button" className="button primary" disabled={busy} onClick={onConnect}>
            <Link2 size={17} aria-hidden="true" />{signedIn ? "连接训练搭子" : "登录并连接搭子"}
          </button>}
    </div>}
  </section>;
}
