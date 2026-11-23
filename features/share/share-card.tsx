"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { catalogAsset, useCatalogue } from "@/features/exercises/open-gym";
import type { HeartData } from "@/features/heart/model";
import type { TrainingEntry } from "@/shared/state";
import { shareEntries, shareHeart, shareSummary } from "./model";
import { renderShareCard, shareThemes, type AnatomyGeometry, type ShareTheme } from "./poster";

let geometryRequest: Promise<AnatomyGeometry> | undefined;
const geometryAsset = () => geometryRequest ??= catalogAsset<AnatomyGeometry>("anatomy.json").catch((reason) => {
  geometryRequest = undefined;
  throw reason;
});

export function ShareCard({ log, logs, name, owner, close }: {
  log: TrainingEntry; logs: TrainingEntry[]; name: string; owner: string; close: () => void;
}) {
  const [details, setDetails] = useState(true);
  const [merge, setMerge] = useState(false);
  const [withHeart, setWithHeart] = useState(false);
  const [theme, setTheme] = useState<ShareTheme>("travel");
  const [geometry, setGeometry] = useState<AnatomyGeometry | null>();
  const [heartLoad, setHeartLoad] = useState<{ key: string; values: Record<string, HeartData | null>; trouble: boolean }>();
  const [prepared, setPrepared] = useState<{ options: object; file: File }>();
  const [message, setMessage] = useState("");
  const [drawError, setDrawError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { data, error: catalogueError } = useCatalogue();
  const scope = useMemo(() => ({ log, logs, owner, merge }), [log, logs, owner, merge]);
  const canMerge = shareEntries({ ...scope, merge: true }).length > 1;
  const summary = useMemo(() => shareSummary({ ...scope, catalogue: data?.rows }), [scope, data?.rows]);
  const heartIds = summary?.workouts.map(({ id }) => id).join(",") ?? "";
  const activeHeart = withHeart && heartLoad?.key === heartIds ? heartLoad : undefined;
  const pendingHeart = withHeart && Boolean(heartIds) && !activeHeart;
  const options = useMemo(() => summary ? {
    summary, theme, showDetails: details, name, geometry: geometry ?? undefined,
    heart: activeHeart ? shareHeart(scope, activeHeart.values) : [],
  } : null, [summary, theme, details, scope, name, geometry, activeHeart]);

  useEffect(() => {
    let alive = true;
    geometryAsset().then((value) => { if (alive) setGeometry(value); }, () => { if (alive) setGeometry(null); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!withHeart || !heartIds) return;
    const controller = new AbortController();
    const ids = heartIds.split(",");
    let trouble = false;
    void Promise.all(ids.map(async (id): Promise<[string, HeartData | null]> => {
      try {
        const response = await fetch("/api/health?id=" + encodeURIComponent(id), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const { data } = await response.json() as { data: HeartData | null };
        return [id, data];
      } catch { trouble = true; return [id, null]; }
    })).then((values) => {
      if (!controller.signal.aborted) setHeartLoad({ key: heartIds, values: Object.fromEntries(values), trouble });
    });
    return () => controller.abort();
  }, [withHeart, heartIds]);

  const loading = geometry === undefined || !data && !catalogueError || pendingHeart;
  useEffect(() => {
    const graphic = canvas.current;
    if (!graphic || !options || loading) return;
    let alive = true;
    setDrawError(false);
    try {
      renderShareCard(graphic, options);
      graphic.toBlob((blob) => {
        if (!alive) return;
        if (!blob) { setDrawError(true); return; }
        const file = new File([blob], "训练搭子-" + options.summary.date + ".png", { type: "image/png" });
        setPrepared({ options, file });
      }, "image/png");
    } catch { setDrawError(true); }
    return () => { alive = false; };
  }, [options, loading]);

  const file = !loading && !drawError && prepared && prepared.options === options ? prepared.file : undefined;
  function download() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url; link.download = file.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function share() {
    if (!file) return;
    setMessage("");
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        download(); setMessage("已下载图片，可从文件或相册分享。");
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setMessage("当前环境无法开启系统分享，可以下载图片。");
    }
  }

  if (!summary) return null;
  return <Dialog title="分享训练" className="share-dialog" onClose={close}>
    <div className="share-preview">
      <div className="share-settings">
        <label className="share-style">样式<select value={theme} onChange={(event) => { setTheme(event.target.value as ShareTheme); setMessage(""); }}>
          {Object.entries(shareThemes).map(([value, t]) => <option value={value} key={value}>{t.label}</option>)}
        </select></label>
        <button className="button subtle" type="button" onClick={() => { setDetails(!details); setMessage(""); }}>{details ? "隐藏训练明细" : "显示训练明细"}</button>
        {canMerge && <button className="button subtle" type="button" aria-pressed={merge} onClick={() => { setMerge(!merge); setMessage(""); }}>{merge ? "只分享本次" : "合并当天"}</button>}
        <label className="toggle-label"><input type="checkbox" checked={withHeart} onChange={(event) => {
          setWithHeart(event.target.checked); setHeartLoad(undefined); setMessage("");
        }} /> 附带心率</label>
      </div>
      {loading && <p className="muted" role="status">正在生成分享卡…</p>}
      {drawError && <p className="inline-error" role="alert">生成图片失败，请重新打开分享。</p>}
      {activeHeart && (!options?.heart.length || activeHeart.trouble) && <p className="muted" role="status">
        {activeHeart.trouble ? "有记录的心率暂时无法读取，图片只包含已读取的数据。" : "选中的训练暂无已保存心率。"}
      </p>}
      <canvas ref={canvas} hidden={loading || drawError} role="img"
        aria-label={summary.title + "，" + summary.minutes + " 分钟，" + summary.sets + " 组，训练容量 " + displayNumber(summary.volume) + " kg"} />
    </div>
    <div className="share-footer">
      {message && <p className="muted" role="status">{message}</p>}
      <div className="share-output">
        <button className="button subtle" type="button" disabled={!file} onClick={download}><Download size={18} /> 保存图片</button>
        <button className="button primary" type="button" disabled={!file} onClick={() => void share()}><Share2 size={18} /> 分享图片</button>
      </div>
    </div>
  </Dialog>;
}
