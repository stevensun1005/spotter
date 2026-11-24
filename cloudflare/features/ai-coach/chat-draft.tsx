import { CalendarPlus, Check, ChevronDown, ClipboardList, MessageSquare } from "lucide-react";
import type { Move, Plan } from "@/features/plans/model";
import { prescriptionText } from "@/features/plans/prescription";
import { VideoLink } from "@/shared/ui";
import styles from "./chat-draft.module.css";

type Props = {
  draft: readonly Plan[];
  today: string;
  saved: boolean;
  busy: boolean;
  superseded?: boolean;
  onSave: () => void;
  onRevise: () => void;
  onAddToday?: (index: number) => void;
  addedToday?: ReadonlySet<number>;
  error?: string;
};

function Exercise({ move }: { move: Move }) {
  const reps = move.repsMax && move.repsMax > move.reps ? `${move.reps}–${move.repsMax} 次` : `${move.reps} 次`;
  const amount = move.seconds > 0 ? `${move.seconds} 秒` : move.reps > 0 ? reps : undefined;
  const load = move.weight > 0 ? `${move.weight} ${move.unit}` : undefined;
  const metadata = [
    move.tempo && `节奏 ${move.tempo}`,
    move.restSeconds !== undefined && `休息 ${move.restSeconds} 秒`,
    prescriptionText(move),
    move.station,
  ].filter(Boolean).join(" · ");
  const label = move.sourceSlot?.endsWith("-warmup") ? "热身" : move.sourceSlot ?? move.block;

  return <li className={styles.exercise}>
    <div className={styles.exerciseMain}>
      <strong>{label && <span className={styles.slot}>{label}</span>}{move.name}</strong>
      <span className={styles.dose}>{[`${move.sets} 组${amount ? ` × ${amount}` : ""}`, load].filter(Boolean).join(" · ")}</span>
    </div>
    {metadata && <small>{metadata}</small>}
    {move.cue && <small>{move.cue}</small>}
  </li>;
}

export function ChatTrainingDraft({ draft, today, saved, busy, superseded, onSave, onRevise, onAddToday, addedToday, error }: Props) {
  const single = draft.length === 1;
  const scheduledToday = single && draft[0].date === today && Boolean(onAddToday);

  function addToday(index: number) {
    if (!onAddToday || superseded) return null;
    if (addedToday?.has(index) || saved && draft[index].date === today) {
      return <span className={styles.confirmed} role="status"><Check size={16} aria-hidden="true" />已加到今天</span>;
    }
    return <button className={scheduledToday ? "button primary small" : "button outline small"}
      type="button" disabled={busy} onClick={() => onAddToday(index)}
      aria-label={single ? undefined : `把${draft[index].title}加到今天`}>
      <CalendarPlus size={16} aria-hidden="true" />{single ? "添加到今日训练" : "添加这节到今日训练"}
    </button>;
  }

  if (!draft.length) return null;

  return <section className={styles.card} aria-label="训练草稿" aria-busy={busy}>
    <div className={styles.header}>
      <span className={styles.icon}><ClipboardList size={17} aria-hidden="true" /></span>
      <strong>训练草稿</strong>
      <small className={styles.status} role="status">{draft.length} 节训练{saved ? " · 已保存到训练日历" : superseded ? " · 已有新版" : ""}</small>
    </div>
    <div className={styles.sessions}>
      {draft.map((plan, index) => <details key={index} className={styles.session} open={single || undefined}>
        <summary>
          <span className={styles.heading}>
            <strong>{plan.title}</strong>
            <small>
              <time dateTime={plan.date}>{plan.date === today ? `今天 · ${plan.date}` : plan.date}</time>
              {` · ${plan.category}`}{plan.minutes > 0 ? ` · 预计 ${plan.minutes} 分钟` : ""}
            </small>
          </span>
          <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
        </summary>
        <div className={styles.content}>
          {plan.durationNote && <small>{plan.durationNote}</small>}
          {plan.defaultRestSeconds !== undefined && <small>默认休息 {plan.defaultRestSeconds} 秒</small>}
          {plan.exercises.length > 0 && <ul className={styles.exercises} aria-label="动作清单">
            {plan.exercises.map((move, moveIndex) => <Exercise key={moveIndex} move={move} />)}
          </ul>}
          {plan.video && <div><VideoLink url={plan.video} /></div>}
          {!single && onAddToday && <div>{addToday(index)}</div>}
        </div>
      </details>)}
    </div>
    {error && <small className="inline-error" role="alert">{error}</small>}
    {!superseded && <div className={styles.actions}>
      {!saved && !scheduledToday && <button className="button primary small" type="button" disabled={busy} onClick={onSave}>
        {single ? "保存训练" : "保存整份计划"}
      </button>}
      {single && addToday(0)}
      <button className="button outline small" type="button" disabled={busy} onClick={onRevise}>
        <MessageSquare size={15} aria-hidden="true" />继续调整
      </button>
    </div>}
  </section>;
}
