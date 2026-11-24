"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronDown, Dumbbell, Keyboard, Minimize2, MoreHorizontal, NotebookPen, Pause, PencilLine, Play, Plus } from "lucide-react";
import { Dialog, displayNumber, VideoLink } from "@/shared/ui";
import { freeWorkoutTitle, sessionTotals, type Session } from "./model";
import { appendSet, changeNumber, changeSet, copySetNumber, decimalField, fieldValue, flipWeightUnit, validNumberText, type NumberField, type SetTarget } from "./set-editor";
import { fieldLabels, SetRow } from "./set-row";
import { WorkoutKeypad } from "./workout-keypad";
import { ProteinCheck } from "./protein-check";
import { ExercisePicker } from "@/features/exercises/exercise-picker";
import type { Move } from "@/features/plans/model";
import { prescriptionText } from "@/features/plans/prescription";
import { pauseClock, resumeClock, workoutElapsed } from "./clock";
import { parsePlanMove } from "@/features/exercises/move-name";
import { fromCatalogue, useCatalogue, type ExerciseChoice } from "@/features/exercises/open-gym";
import { exerciseDemo } from "@/features/exercises/catalogue-demo";
import { ExerciseAnimation } from "@/features/exercises/exercise-animation";
import { exerciseTempo, tempoNotationHint } from "@/features/exercises/tempo";
import { blockTitle, isWarmupMove, nextSet, restFor, trainingBlocks, type SetPosition } from "./sequence";
import { CardioFields } from "./cardio-fields";
import { cardioSeconds } from "./cardio";
import { useRestReminder } from "./use-rest-reminder";
import { useWorkoutWakeLock } from "./use-wake-lock";
import { saveWorkoutPreferences, useWorkoutPreferences } from "@/features/settings/workout-prefs";
import { applyLoadSuggestion, recommendLoads, type LoadHistory } from "./load-progression";
import { LoadSuggestion } from "./load-suggestions";
import { adaptsWorkoutLoads, seedMoveLoads } from "./workout-loads";

const showTime = (seconds: number) => [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, "0")).join(":");

type Edit = SetTarget & { text: string; pristine: boolean };

export function Workout({ data, update, finish, close, pending, error, sync, onExercise, trackProtein, loadHistory }: {
  data: Session; update: (next: Session) => void; finish: () => void; close: () => void;
  pending: boolean; error: string; sync: string; onExercise?: (choice: ExerciseChoice) => void; trackProtein?: boolean;
  loadHistory: LoadHistory;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [edit, setEdit] = useState<Edit | null>(null);
  const [padNotice, setPadNotice] = useState("");
  const [openedMove, setOpenedMove] = useState(() => nextSet(data.plan, data.rows)?.move ?? 0);
  const [listOpen, setListOpen] = useState<Record<number, boolean>>({});
  const [focusSet, setFocusSet] = useState<SetPosition>();
  const movedFocus = useRef<SetPosition>(undefined);
  const [panel, setPanel] = useState<"settings" | "note">();
  const [confirmFinish, setConfirmFinish] = useState(false);
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

  useEffect(() => {
    if (!focusSet || movedFocus.current === focusSet) return;
    movedFocus.current = focusSet;
    const target = document.getElementById("workout-set-" + focusSet.move + "-" + focusSet.row);
    target?.querySelector<HTMLButtonElement>(".check-button")?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [focusSet]);

  const plan = data.plan;
  const prefs = useWorkoutPreferences();
  const adaptLoads = adaptsWorkoutLoads(plan);
  const loadSuggestions = useMemo(() => adaptLoads ? data.rows.map((rows, index) =>
    recommendLoads(plan.exercises[index], rows, loadHistory, prefs.weightStep)) : [],
  [adaptLoads, data.rows, loadHistory, plan.exercises, prefs.weightStep]);
  const effortLabel = prefs.effortScale.toUpperCase();
  const blocks = trainingBlocks(plan.exercises);
  const { data: catalogue } = useCatalogue();
  const pendingSet = nextSet(plan, data.rows);
  const activeBlock = pendingSet && blocks.find((block) => block.moves.includes(pendingSet.move));
  const activeSlot = activeBlock && pendingSet && activeBlock.slots[activeBlock.moves.indexOf(pendingSet.move)];
  const elapsed = workoutElapsed(data, now);
  const running = data.clock?.runningSince != null;
  const timer = showTime(Math.floor(elapsed / 1000));
  const rest = data.rest ? Math.max(0, Math.ceil((data.rest.until - elapsed) / 1000)) : 0;
  const reminder = useRestReminder(data.rest?.until, elapsed, running, prefs);
  useWorkoutWakeLock(prefs.keepAwake && running);
  const restComplete = data.rest !== undefined && rest === 0;
  const restSeconds = data.defaultRestOverride ?? plan.defaultRestSeconds ?? prefs.defaultRest;
  const focusMove = openedMove >= 0 ? openedMove : pendingSet?.move ?? 0;
  const { sets: done, volume } = sessionTotals(data);
  const total = data.rows.flat().length;
  const showFinish = trackProtein && confirmFinish;
  const progressTotal = total + Number(Boolean(plan.video));
  const cardio = data.cardio;
  const allowFinish = cardio ? cardioSeconds(cardio, elapsed) > 0 : done > 0 || data.finishedVideo;
  const defaultTitle = cardio ? "爬坡走" : plan.category === "有氧训练" ? "有氧训练" : freeWorkoutTitle;

  function activate(target: SetTarget, session = data) {
    const value = fieldValue(session.rows[target.move][target.row], target.field);
    const display = value !== undefined && target.field === "rpe" && prefs.effortScale === "rir" ? 10 - value : value;
    setEdit({ ...target, text: display === undefined ? "" : String(display), pristine: true });
    setPadNotice("");
    setOpenedMove(target.move);
    if (prefs.layout === "list") setListOpen((previous) => ({ ...previous, [target.move]: true }));
  }

  function openKeypad() {
    const { move, row } = pendingSet ?? { move: 0, row: 0 };
    activate({ move, row, field: data.plan.exercises[move].seconds > 0 ? "seconds" : "weight" });
  }

  function digit(key: string) {
    if (!edit) return;
    const base = edit.pristine ? "" : edit.text;
    const raw = key === "Backspace" ? (edit.pristine ? edit.text : base).slice(0, -1) : base + key;
    const text = raw.replace(/^0+(?=\d)/, "");
    if (!validNumberText(edit.field, text) || (edit.field === "rpe" && prefs.effortScale === "rir" && Number(text) > 9)) return;
    setEdit({ ...edit, text, pristine: false });
    const next = changeNumber(data, edit, text, prefs.effortScale);
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
    const entry = Number(edit.text);
    const invalid = field === "rpe" && Boolean(edit.text) &&
      (!Number.isInteger(entry * 2) || (prefs.effortScale === "rir" ? entry > 9 : entry < 1));
    function stepWeight(direction: -1 | 1) {
      const amount = Math.min(2_000, Math.max(0, (fieldValue(line, field) ?? 0) + direction * prefs.weightStep));
      const text = String(Math.round(amount * 100) / 100);
      setEdit({ move, row, field, text, pristine: false });
      update(changeNumber(data, { move, row, field }, text));
    }
    return <>
      {padNotice && <p className="keypad-notice" role="status">{padNotice}</p>}
      <WorkoutKeypad label={"第 " + (row + 1) + " 组 · " + (field === "rpe" ? effortLabel : fieldLabels[field]) + (field.endsWith("eight") ? " (" + item.unit + ")" : "")}
        value={edit.text} decimal={decimalField(field)} invalid={invalid} press={digit} close={closePad}
        weightStep={field.endsWith("eight") ? { amount: prefs.weightStep, adjust: stepWeight } : undefined}
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
          { text: effortLabel, name: "编辑本组 " + effortLabel, active: field === "rpe", hidden: !prefs.showEffort, press: () => activate({ move, row, field: "rpe" }) },
        ]} />
    </>;
  }

  function toggleSet(move: number, row: number) {
    const marked = !data.rows[move][row].done;
    const next = changeSet(data, move, row, (line) => ({ ...line, done: marked }));
    if (!marked) { update({ ...next, rest: undefined }); return; }
    setEdit(null);
    const from = { move, row };
    const target = nextSet(plan, next.rows, from);
    const completed = next.rows[move].every((line) => line.done);
    if (completed && prefs.collapseCompleted) {
      setListOpen((previous) => ({ ...previous, [move]: false }));
      if (openedMove === move) setOpenedMove(-1);
    }
    if (!target) { update({ ...next, rest: undefined }); return; }
    const restPlan = { ...plan, defaultRestSeconds: restSeconds };
    let pause = restFor(restPlan, from, target);
    if (data.defaultRestOverride === undefined && plan.defaultRestSeconds === undefined && plan.exercises[move].restSeconds === undefined && pause.kind !== "换站") {
      const isWarmup = next.rows[move][row].kind === "warmup" || isWarmupMove(plan.exercises[move]);
      if (isWarmup && prefs.warmupRest !== null) {
        pause = { ...pause, seconds: prefs.warmupRest };
      } else if (move !== target.move && prefs.transitionRest !== null) {
        pause = { kind: "换动作", seconds: prefs.transitionRest };
      }
    }
    const markedAt = Date.now();
    if (pause.seconds) void reminder.prepareSound();
    setNow(markedAt);
    if (prefs.autoAdvance) {
      setOpenedMove(target.move);
      if (prefs.layout === "list") setListOpen((previous) => ({ ...previous, [target.move]: true }));
      setFocusSet(target);
    }
    update({ ...next, rest: pause.seconds ? { until: workoutElapsed(next, markedAt) + pause.seconds * 1000, kind: pause.kind } : undefined });
  }

  function useExercise(move: Move) {
    if (picker === undefined) return;
    const index = picker < 0 ? data.plan.exercises.length : picker;
    const rows = Array.from({ length: move.sets }, () => ({ reps: move.reps, weight: move.weight, seconds: move.seconds, done: false }));
    if (index >= 30 || data.rows[index]?.some((line) => line.done)) { setPicker(undefined); return; }
    const exercises = [...data.plan.exercises];
    const next = [...data.rows];
    exercises[index] = { ...move, name: parsePlanMove(move.name).name };
    next[index] = adaptLoads ? seedMoveLoads(exercises[index], rows, loadHistory) : rows;
    setEdit(null); setOpenedMove(index); setPicker(undefined);
    if (prefs.layout === "list") setListOpen((previous) => ({ ...previous, [index]: true }));
    update({ ...data, plan: { ...data.plan, exercises }, rows: next });
  }

  return <main className="training-page" aria-label="正在训练">
    <div className="training-shell workout-shell" data-workout-layout={prefs.layout}>
      <header className="workout-header">
        <h1 className="sr-only">正在训练</h1>
        <div className="workout-header-row">
          <div className="workout-clock">
            <span className="workout-timer" role="timer" aria-label="训练用时">{timer}</span>
            <button type="button" className="workout-clock-toggle" aria-label={running ? "暂停计时" : "继续计时"} disabled={pending}
              onClick={() => {
                const stamp = Date.now();
                setNow(stamp);
                if (!running && rest > 0) void reminder.prepareSound();
                update(running ? pauseClock(data, stamp) : resumeClock(data, stamp));
              }}>
              {running ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
            </button>
          </div>
          <button type="button" className="button primary workout-finish" aria-label={pending ? "正在保存" : "完成打卡"}
            disabled={pending || Boolean(edit) || !allowFinish}
            onClick={() => { if (trackProtein) setConfirmFinish(true); else finish(); }}>{pending ? "正在保存" : "完成"}</button>
        </div>
        <div className="workout-header-row">
          {data.planId === "" ? <label className="workout-title-field">
            <PencilLine size={18} aria-hidden="true" />
            <input aria-label="训练标题" placeholder="输入训练标题" defaultValue={plan.title === freeWorkoutTitle ? "" : plan.title}
              maxLength={100} disabled={pending}
              onChange={(event) => update({ ...data, plan: { ...plan, title: event.target.value.trim() || defaultTitle } })} />
          </label> : <div className="workout-title"><p className="muted">{plan.category}</p><h2>{plan.title}</h2></div>}
          {!cardio && <div className="workout-summary">
            <strong>{done}/{total} 组</strong><small>{displayNumber(volume)} kg 容量</small>
          </div>}
        </div>
        <p className="workout-sync">{sync}</p>
        {data.rest && <div className="rest-counter workout-rest-counter" aria-label="休息计时">
          <span aria-hidden={restComplete || undefined}>{rest ? data.rest.kind + " " + showTime(rest) : "休息结束"}</span>
          <button className="button subtle small" type="button" disabled={pending}
            onClick={() => update({ ...data, rest: undefined })}>{rest ? "跳过" : "关闭"}</button>
        </div>}
        <span className="sr-only" role="status">{restComplete ? "休息结束" : ""}</span>
      </header>
    <div className="dialog-body workout-body">
      {plan.durationNote && <p className="muted">{plan.durationNote}</p>}
      {progressTotal > 0 && <progress value={done + Number(data.finishedVideo)} max={progressTotal} aria-label="训练进度" />}
      <fieldset disabled={pending} className="session-fields">
        {cardio && <CardioFields value={cardio} change={(next) => update({ ...data, cardio: next })}
          liveSeconds={cardioSeconds({ ...cardio, durationSeconds: undefined }, elapsed)} />}
        {data.plan.video && <div className="video-panel"><VideoLink url={data.plan.video} /><label className="toggle-label"><input type="checkbox" checked={data.finishedVideo} onChange={(e) => update({ ...data, finishedVideo: e.target.checked })} /> 已完成跟练</label></div>}
        {pendingSet && prefs.showNext && <div className="workout-next" role="status">
          <span>下一组</span><strong>{activeSlot} · {parsePlanMove(plan.exercises[pendingSet.move].name).name}</strong>
          <span>第 {pendingSet.row + 1} {activeBlock && activeBlock.moves.length > 1 ? "轮" : "组"}</span>
        </div>}
        {prefs.layout === "focus" && plan.exercises.length > 1 && <label className="workout-focus-choice">切换动作<select value={focusMove} onChange={(event) => setOpenedMove(Number(event.target.value))}>
          {plan.exercises.map((move, index) => <option key={index} value={index}>{move.name}</option>)}
        </select></label>}
        {blocks.map((block) => prefs.layout === "focus" && !block.moves.includes(focusMove) ? null : <section className="workout-block" key={block.moves[0]}>
          {(block.label || block.station) && <div className="sequence-heading">
            <h3>{blockTitle(block)}</h3><span>{[block.station, block.moves.length > 1 && "循环 " + block.rounds + " 轮"].filter(Boolean).join(" · ")}</span>
          </div>}
          {block.moves.map((i, slot) => {
            if (prefs.layout === "focus" && i !== focusMove) return null;
            const item = plan.exercises[i];
            const { name, cue } = parsePlanMove(item.name);
            const move = { ...item, name, cue: item.cue ?? cue };
            const match = fromCatalogue(catalogue, move);
            const tempo = exerciseTempo(move, match, plan.category);
            const prescription = prescriptionText({ ...move, targetRpe: prefs.showEffort ? move.targetRpe : undefined });
            const finished = data.rows[i].every((line) => line.done);
            const openMove = prefs.layout === "list" ? listOpen[i] ?? !(prefs.collapseCompleted && finished) : openedMove === i;
            const demo = openMove && (prefs.layout !== "list" || openedMove === i) && prefs.animations !== "hidden"
              ? exerciseDemo(move.name, move.sourceName ?? move.name, match, !match)
              : undefined;
            return <details className="set-card" key={i} open={openMove}>
          <summary onClick={(event) => {
            event.preventDefault();
            if (prefs.layout === "list") setListOpen((previous) => ({ ...previous, [i]: !openMove }));
            setOpenedMove(openMove ? -1 : i);
          }}>
            <span className="sequence-slot">{block.label ? block.slots[slot] : <Dumbbell size={17} />}</span>
            <strong>{move.name}</strong><span className="set-summary"><span className="muted">{data.rows[i].filter((line) => line.done).length}/{move.sets} 组</span><ChevronDown size={16} /></span>
          </summary>
          {demo && <div className="workout-exercise-demo" data-size={prefs.animations}><ExerciseAnimation key={demo.id ?? move.name} name={move.name} {...demo} /></div>}
          {move.cue && <p className="muted set-prescription">{move.cue}</p>}
          {prescription && <p className="muted set-prescription">{prescription}{prefs.showEffort && " · 实际 " + effortLabel + " 在组记录中填写"}</p>}
          {prefs.showTempo && <p className="muted set-prescription" title={tempo.numeric ? tempoNotationHint : undefined}>{tempo.label} {tempo.text}</p>}
          {(move.repsMax || move.restSeconds) && <p className="muted set-prescription">{move.seconds ? move.seconds + " 秒／组" : move.reps + (move.repsMax && move.repsMax > move.reps ? "–" + move.repsMax : "") + " 次／组"}
            {move.restSeconds !== undefined ? " · " + (block.moves.length > 1 ? "轮间" : "组间") + "休息 " + move.restSeconds + " 秒" : ""}</p>}
          <div className="workout-exercise-actions" role="group" aria-label="动作操作">
            {onExercise && <button type="button" className="button subtle" onClick={() => onExercise({ ...move, trainingCategory: plan.category })}><BookOpen size={16} /> 查看动作详情</button>}
            <button type="button" className="button subtle" disabled={data.rows[i].some((line) => line.done)} onClick={() => setPicker(i)}>替换动作</button>
          </div>
          {data.rows[i].map((line, j) => {
            const suggestion = loadSuggestions[i]?.[j];
            const canApply = suggestion && (line.weight !== suggestion.weight || (line.right
              ? line.right.weight !== (suggestion.rightWeight ?? suggestion.weight) : suggestion.rightWeight !== undefined));
            const showSuggestion = !line.done && suggestion && suggestion.reason !== "history" && (canApply || suggestion.reason === "backoff");
            return <div id={"workout-set-" + i + "-" + j} key={j} className={pendingSet?.move === i && pendingSet.row === j ? "workout-next-set" : undefined}>
              <SetRow move={move} line={line} index={j}
                selected={edit?.move === i && edit.row === j ? edit.field : undefined}
                edit={(field) => activate({ move: i, row: j, field })} showEffort={prefs.showEffort} effortScale={prefs.effortScale}
                toggle={() => toggleSet(i, j)} />
              {showSuggestion && <LoadSuggestion {...suggestion} unit={move.unit} onApply={canApply ? () => {
                const next = changeSet(data, i, j, (value) => applyLoadSuggestion(value, suggestion));
                update(next);
                if (edit?.move === i && edit.row === j) activate(edit, next);
              } : undefined} />}
            </div>;
          })}
            </details>;
          })}
        </section>)}
      </fieldset>
      {error && !showFinish && <p className="inline-error" role="alert">{error}</p>}
    </div>
    {edit ? renderPad() : <div className={"workout-actions" + (cardio ? " workout-cardio-actions" : "")} role="group" aria-label="训练操作">
      <button type="button" disabled={pending} onClick={close}><Minimize2 size={22} /> 最小化</button>
      {!cardio && <>
        <button type="button" disabled={pending} onClick={() => setPanel("settings")}><MoreHorizontal size={22} /> 更多</button>
        <button type="button" className="workout-add-action" aria-label="添加动作" disabled={pending || plan.exercises.length >= 30}
          onClick={() => setPicker(-1)}><span><Plus size={23} /></span>加动作</button>
      </>}
      <button type="button" disabled={pending} onClick={() => setPanel("note")}><NotebookPen size={22} /> 写心得</button>
      {!cardio && <button type="button" disabled={pending || !total} onClick={openKeypad}><Keyboard size={22} /> 数字键盘</button>}
    </div>}
    </div>
    {panel === "settings" && <Dialog title="训练设置" onClose={() => setPanel(undefined)}>
      <form onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const restOverride = Number(fields.get("rest"));
        const minutes = Number(fields.get("minutes"));
        const alertSound = fields.get("alertSound") === "on" ? (prefs.alertSound === "off" ? "chime" : prefs.alertSound) : "off";
        void reminder.prepareSound(alertSound);
        saveWorkoutPreferences({ alertSound, alertVibrate: fields.get("alertVibrate") === "on" });
        update({ ...data, defaultRestOverride: restOverride === restSeconds ? data.defaultRestOverride : restOverride, minutes });
        setPanel(undefined);
      }}>
        <div className="dialog-body form-fields">
          <label>本次默认休息（秒）<input type="number" name="rest" min={0} max={600} defaultValue={restSeconds} required /></label>
          <label className="toggle-label"><input type="checkbox" name="alertSound" defaultChecked={prefs.alertSound !== "off"} />休息结束时播放提示音</label>
          <label className="toggle-label"><input type="checkbox" name="alertVibrate" defaultChecked={prefs.alertVibrate} />前台休息结束时震动</label>
          <label>实际时长（分钟）<input type="number" name="minutes" min={0} max={720} defaultValue={data.minutes || ""} placeholder="留空时使用计时" /></label>
        </div>
        <div className="dialog-footer"><button type="submit" className="button primary">保存设置</button></div>
      </form>
    </Dialog>}
    {panel === "note" && <Dialog title="训练心得" onClose={() => setPanel(undefined)}>
      <div className="dialog-body">
        <textarea aria-label="训练心得" value={data.note} maxLength={1500} placeholder="今天练得怎么样？" rows={4}
          onChange={(event) => update({ ...data, note: event.target.value })} />
      </div>
      <div className="dialog-footer"><button type="button" className="button primary" onClick={() => setPanel(undefined)}>完成</button></div>
    </Dialog>}
    {showFinish && <Dialog title="完成训练" onClose={() => { if (!pending) setConfirmFinish(false); }}>
      <div className="dialog-body">
        <ProteinCheck checked={data.proteinShake === true} disabled={pending} save={(proteinShake) => update({ ...data, proteinShake })} />
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        <button className="button outline" type="button" disabled={pending} onClick={() => setConfirmFinish(false)}>返回训练</button>
        <button className="button primary" type="button" disabled={pending} onClick={finish}><Check size={18} /> {pending ? "正在保存" : "保存打卡"}</button>
      </div>
    </Dialog>}
    {picker !== undefined && <ExercisePicker allowBlank={false} prior={data.plan.exercises[picker]} names={data.plan.exercises.map((move) => move.name)} useLoadHistory={adaptLoads}
      newMoveDefaults={picker < 0 ? { sets: prefs.newSets, reps: prefs.newReps, unit: prefs.defaultUnit } : undefined}
      replacementContext={{ plan: data.plan, index: picker, defaultRestOverride: restSeconds }}
      close={() => setPicker(undefined)} onUse={useExercise} />}
    {reminder.flash && <div className="workout-signal-flash" aria-hidden="true" />}
  </main>;
}
