"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useLibrary } from "@/features/library/use-library";
import type { LibraryRow } from "@/features/library/model";
import { errorText } from "@/shared/client";
import { offsetDate } from "@/shared/dates";
import { saveMealRecords } from "./nutrition-records";

async function copiedRecordId(source: string, destination: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nutrition-copy:${source}:${destination}`)));
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function CopySelection({ enabled, from, to, onReload }: { enabled: boolean; from: string; to: string; onReload: () => void }) {
  const source = useLibrary(enabled, from);
  const [omitted, setOmitted] = useState(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; warning?: boolean }>();
  const records = source.rows.filter((row): row is Extract<LibraryRow, { kind: "nutrition" }> =>
    row.kind === "nutrition" && row.date === from && (row.entry.type === "meal" || row.entry.type === "water"));
  const selected = records.filter((row) => !omitted.has(row.id));

  async function copy() {
    if (busy) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const records = await Promise.all(selected.map(async ({ id, entry }) => ({
        kind: "nutrition" as const, id: await copiedRecordId(id, to), date: to, entry,
      })));
      const { added, skipped } = await saveMealRecords(records);
      setFeedback({ message: `已复制 ${added} 条${skipped ? `，跳过 ${skipped} 条已复制的记录` : ""}。` });
    } catch (reason) {
      setFeedback({ warning: true, message: errorText(reason, "复制未完成，可以重试。") });
    } finally {
      onReload();
      setBusy(false);
    }
  }

  return <>
    {source.loading && <p className="muted" role="status">正在读取饮食记录…</p>}
    {source.error && <button type="button" className="button outline" onClick={() => void source.load()}>重试读取</button>}
    {!source.loading && !source.error && !records.length && <p className="muted">这一天没有饮食和饮水记录。</p>}
    {!!records.length && <div className="settings-rows">{records.map(({ id, entry }) => <label className="settings-control" key={id}>
      <strong>{entry.type === "meal" ? `${entry.meal} · ${entry.name}` : entry.type === "water" ? `饮水 · ${entry.ml} ml` : ""}</strong>
      <input type="checkbox" checked={!omitted.has(id)} disabled={busy} onChange={(event) => {
        const included = event.target.checked;
        setOmitted((previous) => { const next = new Set(previous); if (included) next.delete(id); else next.add(id); return next; });
      }} />
    </label>)}</div>}
    <button type="button" className="button primary" disabled={!enabled || busy || Boolean(source.error) || !selected.length} onClick={() => void copy()}>
      <Copy size={17} aria-hidden="true" />{busy ? "复制中…" : `复制到 ${to}`}
    </button>
    {feedback && <p className={feedback.warning ? "inline-error" : "muted"} role={feedback.warning ? "alert" : "status"}>{feedback.message}</p>}
  </>;
}

export function NutritionCopy({ enabled, date, today, onReload }: { enabled: boolean; date: string; today: string; onReload: () => void }) {
  const [from, setFrom] = useState(() => date > today ? today : offsetDate(date, -1));
  return <div className="feature-stack">
    <div className="form-fields"><label>来源日期<input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} /></label></div>
    {from === date && <p className="muted">请选择其他日期。</p>}
    {enabled && from && from !== date && from <= today && <CopySelection key={from} enabled={enabled} from={from} to={date} onReload={onReload} />}
    {!enabled && <p className="muted">登录后可以复制饮食记录。</p>}
  </div>;
}
