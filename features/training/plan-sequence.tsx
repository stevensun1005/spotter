import { parsePlanMove } from "@/features/exercises/move-name";
import { fromCatalogue, useCatalogue, type ExerciseChoice } from "@/features/exercises/open-gym";
import { exerciseTempo, tempoNotationHint } from "@/features/exercises/tempo";
import type { Plan } from "@/features/plans/model";
import { blockTitle, defaultRest, trainingBlocks } from "./sequence";

export function PlanSequence({ plan, onExercise }: { plan: Plan; onExercise?: (choice: ExerciseChoice) => void }) {
  const { data } = useCatalogue();
  return <div className="plan-sequence">
    <p className="muted sequence-rest">同轮换动作休息 {defaultRest(plan)} 秒 · 换站至少 {Math.max(60, defaultRest(plan))} 秒</p>
    {trainingBlocks(plan.exercises).map((block) => (
      <section className="sequence-block" key={block.moves[0]}>
        <div className="sequence-heading">
          <h3>{blockTitle(block)}</h3>
          <span>{[block.station, block.moves.length > 1 ? "循环 " + block.rounds + " 轮" : "逐组完成"].filter(Boolean).join(" · ")}</span>
        </div>
        <ol className="sequence-moves">{block.moves.map((index, slot) => {
          const move = plan.exercises[index];
          const { name, cue } = parsePlanMove(move.name);
          const choice = { ...move, name, cue: move.cue ?? cue };
          const tempo = exerciseTempo(choice, fromCatalogue(data, choice), plan.category);
          return <li key={index}>
            <span className="sequence-slot">{block.slots[slot]}</span>
            <div>{onExercise ? <button type="button" className="sequence-exercise" onClick={() => onExercise({ ...choice, trainingCategory: plan.category })}>{name}</button> :
              <strong className="sequence-exercise">{name}</strong>}
              <small>{move.sets} 组 × {move.seconds ? move.seconds + " 秒" : move.reps + (move.repsMax && move.repsMax > move.reps ? "–" + move.repsMax : "") + " 次"}
                {move.restSeconds !== undefined && " · " + (block.moves.length > 1 ? "轮间" : "组间") + " " + move.restSeconds + " 秒"}</small>
              <small title={tempo.numeric ? tempoNotationHint : undefined}>{tempo.label} {tempo.text}</small>
              {choice.cue && <small>{choice.cue}</small>}
            </div>
          </li>;
        })}</ol>
      </section>
    ))}
  </div>;
}
