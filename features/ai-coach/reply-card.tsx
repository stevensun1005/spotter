import { CalendarDays, Camera, ChartNoAxesColumn, Check, CircleAlert, Dumbbell, MessageCircle, Scale, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivitySummary } from "./activity-summary";

const replies = {
  chat: { title: "Spotter 教练", icon: Sparkles, tint: "moss" },
  question: { title: "教练提问", icon: MessageCircle, tint: "moss" },
  plan: { title: "训练计划", icon: CalendarDays, tint: "moss" },
  stats: { title: "训练统计", icon: ChartNoAxesColumn, tint: "blue" },
  weight: { title: "体重记录", icon: Scale, tint: "violet" },
  meal: { title: "拍照记饮食", icon: Camera, tint: "apricot" },
  workout: { title: "开始训练", icon: Dumbbell, tint: "moss" },
  saved: { title: "已保存", icon: Check, tint: "moss" },
  error: { title: "暂未完成", icon: CircleAlert, tint: "error" },
  loading: { title: "Spotter 教练", icon: Sparkles, tint: "moss" },
} as const;
export type CoachReplyKind = keyof typeof replies;

function TrainingSummary({ activity }: { activity: ActivitySummary }) {
  const { from, to, english, totals } = activity;
  if (totals.sessions === 0) return <p className="coach-reply-copy">{activity.reply}</p>;

  const format = new Intl.NumberFormat(english ? "en-CA" : "zh-CN", { maximumFractionDigits: 1 });
  const metrics = [
    { label: english ? "Workouts" : "完成训练", value: totals.sessions, unit: english ? undefined : "次" },
    { label: english ? "Training days" : "训练天数", value: totals.days, unit: english ? undefined : "天" },
    { label: english ? "Duration" : "训练时长", value: totals.minutes, unit: english ? "min" : "分钟" },
    { label: english ? "Completed sets" : "完成组数", value: totals.sets, unit: english ? undefined : "组" },
    { label: english ? "Total volume" : "训练容量", value: totals.volume, unit: "kg" },
  ];
  return <div className="coach-reply-stats">
    <p className="coach-reply-date">
      <time dateTime={from}>{from}</time>{to !== from && <> <span aria-hidden="true">–</span><span className="sr-only">{english ? "to" : "至"}</span> <time dateTime={to}>{to}</time></>}
    </p>
    <dl className="coach-reply-metrics">
      {metrics.map(({ label, value, unit }) => <div key={label}>
        <dt>{label}</dt>
        <dd>{format.format(value)}{unit && <> <small>{unit}</small></>}</dd>
      </div>)}
    </dl>
  </div>;
}

export function CoachReplyCard({ kind = "chat", reply, activity, weight, children }: {
  kind?: CoachReplyKind; reply?: string; activity?: ActivitySummary;
  weight?: { kg: number; date: string }; children?: ReactNode;
}) {
  const { title, icon: Icon, tint } = replies[kind];
  const loading = kind === "loading";
  const error = kind === "error";
  return <div className="coach-reply" data-tint={tint} data-kind={kind} role={error ? "alert" : undefined}
    aria-live={error ? undefined : "polite"}>
    <div className="coach-reply-byline">
      <span className="coach-reply-icon"><Icon size={16} aria-hidden="true" /></span>
      <strong>{title}</strong>
    </div>
    {activity ? <TrainingSummary activity={activity} />
      : weight ? <div className="coach-reply-weight">
        <p className="coach-reply-date">已记录 · <time dateTime={weight.date}>{weight.date}</time></p>
        <strong>{weight.kg} <small>kg</small></strong>
      </div>
        : reply && <p className="coach-reply-copy">
          {reply}{loading && <span className="coach-reply-dots" aria-hidden="true"><i /><i /><i /></span>}
        </p>}
    {children}
  </div>;
}
