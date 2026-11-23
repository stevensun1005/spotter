"use client";

import { useState } from "react";
import { Clipboard, Download } from "lucide-react";
import type { DataScope } from "@/features/data/model";
import { agentGuideScopes, createAgentGuide } from "./guide";

export function AgentPack({ profileRef }: { profileRef?: string }) {
  const [scope, setScope] = useState<DataScope>("all");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");

  function currentGuide() {
    return profileRef ? createAgentGuide({ profileRef, scope, origin: window.location.origin.replace(/\/$/, "") }) : "";
  }

  async function copyGuide() {
    const markdown = currentGuide();
    if (!markdown) return;
    setManual("");
    try {
      await navigator.clipboard.writeText(markdown);
      setMessage("已复制写入说明，可以发给你的 AI。");
    } catch {
      setManual(markdown);
      setMessage("可以长按下方说明并复制。");
    }
  }

  function downloadGuide() {
    const markdown = currentGuide();
    if (!markdown) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "spotter-agent-" + scope + ".md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("已生成 Markdown 文件。");
  }

  return <section className="card padded feature-stack">
    <div className="section-head"><h2>我的 AI 写入说明</h2></div>
    {profileRef ? <>
      <p className="muted">把说明发给你的 AI。已连接训练搭子插件的 ChatGPT 或 Codex 可以按你的授权写入。能操作浏览器的 AI 也可使用你已登录的网站。</p>
      <div className="feature-stack">
        <p className="muted">个人账号标识</p>
        <code className="break-all text-sm">{profileRef}</code>
      </div>
      <div className="segmented data-scopes" aria-label="AI 说明范围">{agentGuideScopes.map(([item, label]) =>
        <button key={item} type="button" aria-pressed={item === scope} onClick={() => {
          setScope(item); setMessage(""); setManual("");
        }}>{label}</button>)}</div>
      <div className="exercise-toolbar">
        <button className="button primary" type="button" onClick={downloadGuide}><Download size={17} aria-hidden="true" /> 下载 Markdown</button>
        <button className="button outline" type="button" onClick={() => void copyGuide()}><Clipboard size={17} aria-hidden="true" /> 复制说明</button>
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      {manual && <textarea aria-label="AI 写入说明" readOnly rows={8} value={manual} onFocus={(event) => event.target.select()} />}
    </> : <p className="muted">登录后可生成你的专属写入说明。</p>}
  </section>;
}
