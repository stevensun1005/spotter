import type { Move } from "@/features/plans/model";
import type { LoadSuggestion as SuggestedLoad } from "./load-progression";

const suggestionLabels = {
  history: "沿用上次",
  current: "沿用刚才",
  increase: "试加重",
  backoff: "回退至",
  trial: "首次试重",
};

type TrialLoad = { reason: "trial"; weight?: number; rightWeight?: number; detail?: string; retry?: boolean };

export function LoadSuggestion(props: (SuggestedLoad | TrialLoad) & {
  unit: Move["unit"];
  onApply?: () => void;
}) {
  const { reason, weight, unit, rightWeight, onApply } = props;
  const load = weight === undefined ? null : rightWeight === undefined
    ? `${weight} ${unit}` : `左 ${weight} · 右 ${rightWeight} ${unit}`;
  const trial = props.reason === "trial";
  const label = trial && props.retry ? "重新试重" : suggestionLabels[reason];

  return <div className="workout-load-suggestion" data-reason={reason}>
    <div className="workout-load-copy">
      <span>{label}{trial && load && " · 估算"}{load && <> <strong>{load}</strong></>}</span>
      {trial && props.detail && <small>{props.detail}</small>}
    </div>
    {load && onApply && <button type="button" className="text-button" onClick={onApply}>采用</button>}
  </div>;
}
