import { dateSchema, shortDate } from "@/shared/dates";
import type { Plan } from "@/features/plans/model";
import { blockTitle, defaultRest, isWarmupMove, restFor, trainingBlocks } from "@/features/training/sequence";

export function DraftProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  return <ol className="plan-draft-progress" aria-label="计划进度">
    {steps.map((step, index) => <li key={step} aria-current={index === current ? "step" : undefined} data-complete={index < current || undefined}>
      {step}
    </li>)}
  </ol>;
}

function PlannedSession({ plan, edit }: { plan: Plan; edit?: () => void }) {
  const blocks = trainingBlocks(plan.exercises);
  return <details className="plan-draft-session">
    <summary>{plan.title || "未命名训练"} <small>{plan.category}{plan.minutes > 0 ? " · " + plan.minutes + " 分钟" : ""}</small></summary>
    <div className="feature-stack">
      <p className="muted">默认休息 {defaultRest(plan)} 秒</p>
      {blocks.map((block, index) => {
        const next = blocks[index + 1];
        const last = [...block.moves].reverse().find((i) => plan.exercises[i].sets === block.rounds)!;
        const transition = next && restFor(plan, { move: last, row: block.rounds - 1 }, { move: next.moves[0], row: 0 });
        const [first, second] = block.moves;
        const firstNextRound = block.moves.find((i) => plan.exercises[i].sets > 1);
        const betweenMoves = second !== undefined && restFor(plan, { move: first, row: 0 }, { move: second, row: 0 });
        const betweenRounds = firstNextRound !== undefined && restFor(plan, { move: block.moves.at(-1)!, row: 0 }, { move: firstNextRound, row: 1 });
        const title = block.moves.every((i) => isWarmupMove(plan.exercises[i])) ? "热身" : blockTitle(block);
        return <div key={index}>
          <strong>{[title, block.station, block.moves.length > 1 && block.rounds + " 轮"].filter(Boolean).join(" · ")}</strong>
          <ul>{block.moves.map((i, n) => {
            const move = plan.exercises[i];
            const repetitions = move.seconds ? move.seconds + " 秒" : move.reps + (move.repsMax ? "–" + move.repsMax : "") + " 次";
            return <li key={i}>{block.label && block.slots[n] + " · "}{move.name || "待填写动作"} · {move.sets} 组 × {repetitions}</li>;
          })}</ul>
          {[betweenMoves, betweenRounds, transition && { ...transition, kind: "到下一组动作 · " + transition.kind }]
            .map((rest, i) => rest && <div className="muted" key={i}><small>{rest.kind} {rest.seconds} 秒</small></div>)}
        </div>;
      })}
      {plan.video && <p className="muted">含跟练视频</p>}
      {edit && <button className="button outline small" type="button" onClick={edit}>编辑这节</button>}
    </div>
  </details>;
}

export function DraftDayPreview({ plans, select }: { plans: readonly Plan[]; select?: (index: number) => void }) {
  const days = new Map<string, { plan: Plan; index: number }[]>();
  plans.forEach((plan, index) => {
    const day = days.get(plan.date) ?? [];
    day.push({ plan, index });
    days.set(plan.date, day);
  });
  return <section className="feature-stack" aria-label="逐日预览">
    <h3>逐日预览</h3>
    {[...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <div key={date} className="plan-draft-day">
      <strong>{dateSchema.safeParse(date).success ? shortDate(date) : "待安排日期"}</strong>
      {items.map(({ plan, index }) => <PlannedSession key={index} plan={plan} edit={select && (() => select(index))} />)}
    </div>)}
  </section>;
}
