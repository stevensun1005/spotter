"use client";

import { useEffect, useState } from "react";
import { BookOpen, Pause, Play, ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, Clock3, Dumbbell, Keyboard, Plus } from "lucide-react";
import { VideoLink } from "@/shared/ui";
import { sessionTotals, type Session } from "./model";
import { appendSet, changeNumber, changeSet, copySetNumber, decimalField, fieldValue, flipWeightUnit, validNumberText, type NumberField, type SetTarget } from "./set-editor";
import { fieldLabels, SetRow } from "./set-row";
import { WorkoutKeypad } from "./workout-keypad";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import type { Move } from "@/features/plans/model";
import { pauseClock, resumeClock, workoutElapsed } from "./clock";

const showTime = (seconds: number) => [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");

type Edit = SetTarget & { text: string; pristine: boolean };

export function Workout({ data, update, finish, close, pending, error, sync, onExercise }: {
  data: Session; update: (next: Session) => void; finish: () => void; close: () => void;
  pending: boolean; error: string; sync: string; onExercise?: (move: Move) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [edit, setEdit] = useState<Edit | null>(null);
  const [padNotice, setPadNotice] = useState("");
  const [openedMove, setOpenedMove] = useState(0);
  const [restEnd, setRestEnd] = useState<number>();
  const [picker, setPicker] = useState<number>();
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const editedMove = edit?.move;
  const editedRow = edit?.row;
  useEffect(() => {
    if (editedMove !== undefined && editedRow !== undefined) {
      document.getElementById("workout-set-" + editedMove + "-" + editedRow)?.scrollIntoView({ block: "nearest" });
    }
  }, [editedMove, editedRow]);

  const elapsed = workoutElapsed(data, now);
  const running = data.clock?.runningSince != null;
  const timer = showTime(Math.floor(elapsed / 1000));
  const rest = restEnd === undefined ? 0 : Math.max(0, Math.ceil((restEnd - elapsed) / 1000));
  const done = sessionTotals(data).sets;
  const total = data.rows.flat().length;

  function activate(target: SetTarget, session = data) {
    const value = fieldValue(session.rows[target.move][target.row], target.field);
    setEdit({ ...target, text: value === undefined ? "" : String(value), pristine: true });
    setPadNotice("");
    setOpenedMove(target.move);
  }

  function openKeypad() {
    const nextMove = data.rows.findIndex((group) => group.some((line) => !line.done));
    const move = nextMove < 0 ? 0 : nextMove;
    const row = Math.max(0, data.rows[move].findIndex((line) => !line.done));
    activate({ move, row, field: data.plan.exercises[move].seconds > 0 ? "seconds" : "weight" });
  }

  function digit(key: string) {
    if (!edit) return;
    const base = edit.pristine ? "" : edit.text;
    const raw = key === "Backspace" ? (edit.pristine ? edit.text : base).slice(0, -1) : base + key;
    const text = raw.replace(/^0+(?=\d)/, "");
    if (!validNumberText(edit.field, text)) return;
    setEdit({ ...edit, text, pristine: false });
    const next = changeNumber(data, edit, text);
    if (next !== data) update(next);
  }

  function closePad() {
    if (edit) document.getElementById("workout-set-" + edit.move + "-" + edit.row)
      ?.querySelector<HTMLButtonElement>("[aria-expanded=true]")?.focus({ preventScroll: true });
    setEdit(null);
    setPadNotice("");
  }

  function renderPad() {
    if (!edit) return null;
    const { move, row, field } = edit;
    const item = data.plan.exercises[move];
    const group = data.rows[move];
    const line = group[row];
    const setKind = (kind: "warmup" | "drop") => update(changeSet(data, move, row, (value) => ({ ...value, kind: value.kind === kind ? undefined : kind })));
    const invalid = field === "rpe" && Boolean(edit.text) && (Number(edit.text) < 1 || !Number.isInteger(Number(edit.text) * 2));
    return <>
      {padNotice && <p className="keypad-notice" role="status">{padNotice}</p>}
      <WorkoutKeypad label={"第 " + (row + 1) + " 组 · " + fieldLabels[field] + (field.endsWith("eight") ? " (" + item.unit + ")" : "")}
        value={edit.text} decimal={decimalField(field)} invalid={invalid} press={digit} close={closePad}
        left={[
          { text: item.unit === "kg" ? "用 lb" : "用 kg", name: "换算此动作重量为 " + (item.unit === "kg" ? "lb" : "kg"), press: () => {
            const next = flipWeightUnit(data, move);
            if (next === data) { setPadNotice("换算后超过单组可记录的最大重量。"); return; }
            update(next); activate(edit, next);
          } },
          { text: "热身组", name: "标记热身组", active: line.kind === "warmup", press: () => setKind("warmup") },
          { text: "递减组", name: "标记递减组", active: line.kind === "drop", press: () => setKind("drop") },
          { text: line.right ? "仅留左侧" : "记录左右", name: line.right ? "仅保留左侧数据" : "此组分别记录左右侧", disabled: item.seconds > 0, active: Boolean(line.right), press: () => {
            const next = changeSet(data, move, row, (value) => ({
              ...value, right: value.right ? undefined : { weight: value.weight, reps: value.reps },
            }));
            update(next);
            activate({ move, row, field: field.startsWith("right") ? "weight" : field }, next);
          } },
        ]}
        right={[
          { text: <><Plus size={15} /> 加一组</>, name: "添加一组", disabled: group.length >= 30, press: () => {
            const next = appendSet(data, move, row);
            update(next); activate({ move, row: group.length, field }, next);
          } },
          { text: <><ArrowUp size={15} /> 向上填</>, name: "将这个值填到上方各组", disabled: !row || invalid || (field === "rpe" && line.rpe === undefined), press: () => update(copySetNumber(data, edit, -1)) },
          { text: <><ArrowDown size={15} /> 向下填</>, name: "将这个值填到下方各组", disabled: row === group.length - 1 || invalid || (field === "rpe" && line.rpe === undefined), press: () => update(copySetNumber(data, edit, 1)) },
          { text: "RPE", name: "编辑本组 RPE", active: field === "rpe", press: () => activate({ move, row, field: "rpe" }) },
        ]} />
    </>;
  }

  function useExercise(move: Move) {
    if (picker === undefined) return;
    const index = picker < 0 ? data.plan.exercises.length : picker;
    const rows = Array.from({ length: move.sets }, () => ({ reps: move.reps, weight: move.weight, seconds: move.seconds, done: false }));
    if (index >= 30 || data.rows[index]?.some((line) => line.done)) { setPicker(undefined); return; }
    const exercises = [...data.plan.exercises];
    const next = [...data.rows];
    exercises[index] = move; next[index] = rows;
    setEdit(null); setOpenedMove(index); setPicker(undefined);
    update({ ...data, plan: { ...data.plan, exercises }, rows: next });
  }

  return <main className="training-page" aria-label="正在训练">
    <div className="training-shell">
      <header className="training-header">
        <button className="button subtle" disabled={pending} onClick={close}><ChevronLeft size={18} /> 返回</button>
        <h1>正在训练</h1>
        <div className="workout-timer" aria-label="训练用时"><Clock3 size={17} />{timer}</div>
      </header>
    <div className="workout-clock-line">
      <button type="button" className="button outline small" disabled={pending} onClick={() => update(running ? pauseClock(data) : resumeClock(data))}>
        {running ? <Pause size={15} /> : <Play size={15} />} {running ? "暂停计时" : "继续计时"}
      </button>
      {restEnd !== undefined && <div className="rest-counter" aria-label="组间休息"><span>{rest ? "休息 " + showTime(rest) : "休息结束"}</span>
        <button className="button subtle small" type="button" onClick={() => setRestEnd(undefined)}>关闭</button></div>}
    </div>
    <div className="dialog-body workout-body">
      <div className="workout-top"><div><p className="muted">{data.plan.category}</p><h2>{data.plan.title}</h2></div></div>
      {data.plan.durationNote && <p className="muted">{data.plan.durationNote}</p>}
      <div className="workout-progress"><span>{done} / {total} 组完成</span><span>{sync}</span></div>
      <progress value={done + Number(data.finishedVideo)} max={total + Number(Boolean(data.plan.video))} />
      <fieldset disabled={pending} className="session-fields">
        {data.plan.video && <div className="video-panel"><VideoLink url={data.plan.video} /><label className="toggle-label"><input type="checkbox" checked={data.finishedVideo} onChange={(e) => update({ ...data, finishedVideo: e.target.checked })} /> 已完成跟练</label></div>}
        {data.plan.exercises.map((move, i) => <details className="set-card" key={i} open={openedMove === i}>
          <summary onClick={(event) => { event.preventDefault(); setOpenedMove(openedMove === i ? -1 : i); }}><span className="tile mint"><Dumbbell size={17} /></span><strong>{move.name}</strong><span className="set-summary"><span className="muted">{data.rows[i].filter((line) => line.done).length}/{move.sets} 组</span><ChevronDown size={16} /></span></summary>
          {(move.repsMax || move.restSeconds) && <p className="muted set-prescription">{move.seconds ? move.seconds + " 秒／组" : move.reps + (move.repsMax && move.repsMax > move.reps ? "–" + move.repsMax : "") + " 次／组"}
            {move.restSeconds ? " · 组间休息 " + move.restSeconds + " 秒" : ""}</p>}
          {onExercise && <button type="button" className="button subtle small exercise-workout-link" onClick={() => onExercise(move)}><BookOpen size={16} /> 查看动作详情</button>}
          <button type="button" className="button subtle small exercise-workout-link" disabled={data.rows[i].some((line) => line.done)} onClick={() => setPicker(i)}>替换动作</button>
          {data.rows[i].map((line, j) => <div id={"workout-set-" + i + "-" + j} key={j}><SetRow move={move} line={line} index={j}
            selected={edit?.move === i && edit.row === j ? edit.field : undefined}
            edit={(field) => activate({ move: i, row: j, field })}
            toggle={() => {
              if (!line.done && running && move.restSeconds && data.rows[i].some((set, index) => index !== j && !set.done)) {
                setRestEnd(workoutElapsed(data) + move.restSeconds * 1000);
              }
              update(changeSet(data, i, j, (value) => ({ ...value, done: !value.done })));
            }} /></div>)}
        </details>)}
        <button type="button" className="button outline workout-add-exercise" disabled={data.plan.exercises.length >= 30} onClick={() => setPicker(-1)}><Plus size={17} /> 添加动作</button>
        <div className="form-fields">
          <label>训练心得<textarea value={data.note} maxLength={1500} onFocus={() => setEdit(null)} onChange={(e) => update({ ...data, note: e.target.value })} placeholder="今天练得怎么样？" rows={3} /></label>
          <label>实际时长（分钟）<input type="number" min={0} max={720} value={data.minutes || ""} onFocus={() => setEdit(null)} placeholder="留空时使用计时" onChange={(e) => update({ ...data, minutes: Math.max(0, Math.min(720, Math.trunc(Number(e.target.value)))) })} /></label>
        </div>
      </fieldset>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
    {edit ? renderPad() : <div className="training-footer">
      {total > 0 && <button className="button outline" onClick={openKeypad} disabled={pending}><Keyboard size={18} /> 数字键盘</button>}
      <button className="button primary" disabled={pending || (!done && !data.finishedVideo)} onClick={finish}><Check size={18} /> {pending ? "正在保存" : "完成打卡"}</button>
    </div>}
    </div>
    {picker !== undefined && <ExercisePicker allowBlank={false} prior={data.plan.exercises[picker]} names={data.plan.exercises.map((move) => move.name)} close={() => setPicker(undefined)} onUse={useExercise} />}
  </main>;
}
