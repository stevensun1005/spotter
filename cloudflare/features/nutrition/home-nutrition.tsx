"use client";

import type { Ref } from "react";
import { X } from "lucide-react";
import { useLibrary } from "@/features/library/use-library";
import type { TrainingEntry } from "@/shared/state";
import { useNutritionCache } from "./nutrition-cache";
import { targetForDate } from "./nutrition-planning";
import { NutritionShortcuts, NutritionSummary, nutritionTotals, type NutritionShortcut } from "./nutrition-summary";

export function HomeNutrition({ owner, today, shortcuts, cacheEnabled, logs, open, dismiss, dismissRef }: {
  owner: string;
  today: string;
  shortcuts: readonly NutritionShortcut[];
  cacheEnabled: boolean;
  logs: readonly TrainingEntry[];
  open: (shortcut?: NutritionShortcut) => void;
  dismiss: () => void;
  dismissRef: Ref<HTMLButtonElement>;
}) {
  const library = useLibrary(Boolean(owner), today);
  const { rows, cached } = useNutritionCache(owner, today, cacheEnabled, library);

  return <section className="home-nutrition" aria-labelledby="home-nutrition-heading">
    <div className="home-nutrition-heading">
      <h2 id="home-nutrition-heading">饮食记录</h2>
      <button type="button" className="icon-button home-nutrition-dismiss" ref={dismissRef}
        aria-controls="today-nutrition" aria-expanded="true" aria-label="收起饮食记录" title="收起饮食记录" onClick={dismiss}>
        <X size={17} aria-hidden="true" />
      </button>
    </div>
    <div className="card home-nutrition-panel">
      <NutritionSummary totals={nutritionTotals(rows, today)} targets={targetForDate(rows, today, logs)} onOpen={() => open()} />
      {shortcuts.length > 0 && <NutritionShortcuts onSelect={open} actions={shortcuts} disabled={!owner} />}
      {library.loading && <p className="muted" role="status">正在读取今日饮食…</p>}
      {cached && <p className="muted" role="status">显示今日本机缓存</p>}
      {library.error && <button className="text-button" type="button" onClick={() => void library.load()}>重新读取今日饮食</button>}
    </div>
  </section>;
}
