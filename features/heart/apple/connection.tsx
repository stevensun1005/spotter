"use client";

import { useEffect, useState } from "react";
import { Watch } from "lucide-react";
import { errorText } from "@/shared/client";

type PairCode = { code: string; expires: number };

export function AppleHealthConnection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [code, setCode] = useState<PairCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/health/apple", { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error();
        const data: { connected: boolean } = await response.json();
        if (!abort.signal.aborted) setConnected(data.connected);
      } catch {
        if (!abort.signal.aborted) setStatus("无法读取 iPhone 连接状态，请稍后重试。");
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { abort.abort(); window.removeEventListener("focus", refresh); };
  }, []);

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
      else { setCode(null); setConnected(false); setConfirm(false); setStatus("已断开 iPhone。"); }
    } catch (reason) { setStatus(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <section className="heart-panel" aria-label="Apple 健康直连">
    <h3><Watch size={18} /> Apple 健康直连</h3>
    <p className="muted">在 iPhone 配套应用输入本站 HTTPS 网址和配对码。授权后，打开配套应用即可同步已打卡训练的心率。</p>
    <div className="heart-actions">
      <button type="button" className="button outline small" disabled={busy} onClick={() => void change("pair")}>{connected ? "为另一台 iPhone 生成配对码" : "生成 iPhone 配对码"}</button>
      {connected && (confirm ?
        <><button type="button" className="button outline small" disabled={busy} onClick={() => void change("disconnect")}>确认断开</button>
          <button type="button" className="button subtle small" onClick={() => setConfirm(false)}>取消</button></> :
        <button type="button" className="button subtle small" disabled={busy} onClick={() => setConfirm(true)}>断开 iPhone</button>)}
    </div>
    {connected && <p className="muted">已连接 iPhone。新设备成功配对后会替换现有设备。</p>}
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
