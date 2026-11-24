import { BarChart3, Check } from "lucide-react";
import { offsetDate, shortDate, weekdayIndex, weekdays } from "@/shared/dates";
import type { Checkin, Person, TrainingEntry } from "@/shared/state";

export function WeekCheckins({ today, me, partner, partnerCheckins, logs, status, showStats }: {
  today: string; me: Person; partner?: Person | null; logs: readonly TrainingEntry[];
  partnerCheckins?: readonly Checkin[];
  status: "ready" | "loading" | "offline" | "signed-out"; showStats: () => void;
}) {
  const dates = Array.from({ length: 7 }, (_, index) => offsetDate(today, index - 6));
  const people = partner ? [me, partner] : [me];

  return <section className="card padded week-checkins">
    <div className="section-head">
      <h2>近 7 天打卡</h2>
      <button className="icon-button" type="button" aria-label="打开训练统计" onClick={showStats}><BarChart3 size={18} /></button>
    </div>
    {status === "ready" ? <div className="week-checkin-grid" role="group" aria-label="最近七天两人的打卡">
      <div className="week-checkin-row week-checkin-days" aria-hidden="true"><span />
        {dates.map((date) => <span key={date}>{weekdays[weekdayIndex(date)]}</span>)}
      </div>
      {people.map((person) => {
        const own = person.id === me.id;
        const label = own ? "我" : person.name;
        const days = new Set(!own && partnerCheckins
          ? partnerCheckins.filter(({ date, count }) => count > 0 && dates.includes(date)).map(({ date }) => date)
          : logs.filter((log) => log.owner === person.id && dates.includes(log.data.date)).map((log) => log.data.date));
        return <div key={person.id} className={"week-checkin-row" + (own ? "" : " week-checkin-partner")}>
          <span className="week-checkin-person" title={label}><strong>{label}</strong><small>{days.size} 天</small></span>
          {dates.map((date) => {
            const done = days.has(date);
            return <span key={date} role="img" aria-label={label + " · " + shortDate(date) + (done ? " 已打卡" : " 未打卡")}
              className={"week-checkin-dot" + (done ? " done" : "") + (date === today ? " current-day" : "")}>{done ? <Check size={13} /> : <i />}</span>;
          })}
        </div>;
      })}
    </div> : <p className="muted week-checkin-message">{status === "loading" ? "正在同步打卡…" : status === "offline" ? "打卡记录暂时无法读取。" : "登录后可查看打卡进度。"}</p>}
  </section>;
}
