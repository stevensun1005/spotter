"use client";

import { useEffect, useState } from "react";
import { Watch } from "lucide-react";
import { errorText } from "@/shared/client";
import type { HealthSyncResult } from "@/features/health/model";

type PairCode = { code: string; expires: number };
const dataNames: Record<string, string> = {
  heartRate: "心率", bodyMass: "体重", workouts: "系统运动", steps: "步数",
  activeEnergy: "活跃能量", exerciseTime: "运动时长",
};
const dateTime = (at: number) => new Intl.DateTimeFormat("zh-CN", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(at);

export function AppleHealthConnection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [code, setCode] = useState<PairCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSyncResult | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const response = await fetch("/api/health/apple", { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const data: { connected: boolean; lastSync?: HealthSyncResult | null } = await response.json();
        if (!abort.signal.aborted && request === sequence) { setConnected(data.connected); setLastSync(data.lastSync ?? null); }
      } catch {
        if (!abort.signal.aborted && request === sequence) setStatus("无法读取 iPhone 连接状态，请稍后重试。");
      }
    };
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { abort.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [revision]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => { setCode(null); setStatus("配对码已过期，请生成新码。"); }, Math.max(0, code.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [code]);

  async function change(action: "pair" | "disconnect") {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/health/apple", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }), signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作未完成。");
      if (action === "pair") setCode(data as PairCode);
      else { setCode(null); setConnected(false); setConfirm(false); setRevision((value) => value + 1); setStatus("已断开 iPhone，旧设备凭据已失效。已保存的个人数据仍保留。"); }
    } catch (reason) { setStatus(errorText(reason)); }
    finally { setBusy(false); }
  }

  let historyStatus = connected === null ? "正在读取连接状态…" : "尚未连接 iPhone。";
  if (connected) {
    historyStatus = "iPhone 已配对，可读取健康中已收到的历史心率。";
    if (lastSync?.selected.includes("heartRate")) {
      const receivedHeart = lastSync.received ? lastSync.received.includes("heartRate") : !lastSync.empty;
      historyStatus = receivedHeart ? "最近一次已读取所选范围的历史心率。" : "最近一次未读到匹配的心率，需核对权限与范围。";
    }
  }

  return <section className="heart-panel" aria-label="Apple 健康原生同步">
    <h3><Watch size={18} /> Apple 健康 · 原生同步</h3>
    <p className="muted">在 iPhone 配套应用输入本站 HTTPS 网址和配对码。每类数据单独授权并选择同步范围；只同步到当前账号。手表或其他 App 写入 Apple 健康后才可读取。</p>
    <div className="health-status-list">
      <p><strong>Apple Watch 历史：</strong>{historyStatus}</p>
      <p><strong>Apple Watch 实时心率：</strong>尚未接入。</p>
      <p><strong>前台同步：</strong>打开或返回配套应用时执行；可在应用里手动补同步。</p>
    </div>
    <div className="heart-actions">
      <button type="button" className="button outline small" disabled={busy} onClick={() => void change("pair")}>{connected ? "为另一台 iPhone 生成配对码" : "生成 iPhone 配对码"}</button>
      <button type="button" className="button subtle small" disabled={busy} onClick={() => { setStatus(""); setRevision((value) => value + 1); }}>刷新同步状态</button>
      {connected && (confirm ?
        <><button type="button" className="button outline small" disabled={busy} onClick={() => void change("disconnect")}>确认断开</button>
          <button type="button" className="button subtle small" onClick={() => setConfirm(false)}>取消</button></> :
        <button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirm(true)}>断开 iPhone</button>)}
    </div>
    {connected && <p className="muted">已连接 iPhone。新设备成功配对后会替换现有设备。</p>}
    {lastSync ? <div className="health-status-list" role="status">
      <p><strong>最近同步：</strong>{dateTime(lastSync.at)}</p>
      <p>{lastSync.result === "empty" ? "未读到样本" : "同步已完成"} · 保存 {lastSync.saved} · 已有或跳过 {lastSync.skipped}</p>
      <p className="muted">范围：{dateTime(lastSync.from)} – {dateTime(lastSync.to)}；{lastSync.selected.map((name) => dataNames[name] ?? name).join("、") || "未选择数据"}。</p>
      {lastSync.received && <p className="muted">本次读到：{lastSync.received.map((name) => dataNames[name] ?? name).join("、") || "无"}。</p>}
      {Boolean(lastSync.emptyTypes?.length) && <p className="muted">本次未读到：{lastSync.emptyTypes?.map((name) => dataNames[name] ?? name).join("、")}。</p>}
      {(lastSync.empty || Boolean(lastSync.emptyTypes?.length)) && <p className="muted">读不到样本时，请检查「健康」中的读取权限、数据是否已从手表同步，以及所选时间范围，再手动补同步。</p>}
    </div> : <p className="muted">尚无同步结果。配对完成后，在 iPhone 应用中授权并同步。</p>}
    {code && <div className="form-fields">
      <label>五分钟内有效的配对码<input value={code.code} readOnly onFocus={(event) => event.target.select()} /></label>
      <button type="button" className="button outline small" onClick={async () => {
        if (code.expires <= Date.now()) { setStatus("配对码已过期，请生成新码。"); return; }
        try { await navigator.clipboard.writeText(code.code); setStatus("配对码已复制。"); }
        catch { setStatus("请长按配对码手动复制。"); }
      }}>复制配对码</button>
    </div>}
    {status && <p className="muted" role="status">{status}</p>}
  </section>;
}
