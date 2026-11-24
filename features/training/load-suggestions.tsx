import type { Move } from "@/features/plans/model";
import type { LoadSuggestion as SuggestedLoad } from "./load-progression";

const suggestionLabels = {
  history: "沿用上次",
  current: "沿用刚才",
  increase: "试加重",
  backoff: "回退至",
};

export function LoadSuggestion({ reason, weight, unit, rightWeight, onApply }: SuggestedLoad & {
  unit: Move["unit"];
  onApply?: () => void;
}) {
  const load = rightWeight === undefined ? `${weight} ${unit}` : `左 ${weight} · 右 ${rightWeight} ${unit}`;

  return <div className="workout-load-suggestion" data-reason={reason}>
    <span>{suggestionLabels[reason]} <strong>{load}</strong></span>
    {onApply && <button type="button" className="text-button" onClick={onApply}>采用</button>}
  </div>;
}
