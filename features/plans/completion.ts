import type { TrainingEntry } from "@/shared/state";

export function planCompletions(entries: readonly TrainingEntry[]) {
  const completions = new Map<string, Map<string, TrainingEntry>>();
  for (const entry of entries) {
    const { planId, ended, started } = entry.data;
    if (entry.kind !== "log" || !planId) continue;

    let own = completions.get(entry.owner);
    if (!own) {
      own = new Map();
      completions.set(entry.owner, own);
    }
    const previous = own.get(planId);
    if (!previous || (ended ?? started) > (previous.data.ended ?? previous.data.started)) {
      own.set(planId, entry);
    }
  }
  return completions;
}
