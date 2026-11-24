"use client";

import { useState } from "react";
import { Clipboard, Download } from "lucide-react";
import type { DataScope } from "@/features/data/model";
import { agentGuideScopes, createAgentGuide } from "./guide";

export function AgentPack({ profileRef, planAssistant }: { profileRef?: string; planAssistant?: () => void }) {
  const [scope, setScope] = useState<DataScope>("nutrition");
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
    <div className="section-head"><h2>其他数据的 AI 写入说明</h2></div>
    <p className="muted">训练计划的提示词、导入和 Agent 草稿已统一在「添加计划」。这里保留饮食、身体和模板的数据工具说明，按你选定的类别生成。</p>
    {planAssistant && <button className="button outline" type="button" onClick={planAssistant}>打开添加计划</button>}
    {profileRef ? <>
      <p className="muted">把所选类别的说明交给已授权的工具客户端；能操作浏览器的 AI 也可使用你已登录并授权使用的站点。账号编号只用于核对，不会授予访问权限。</p>
      <div className="feature-stack">
        <p className="muted">个人账号标识</p>
        <code className="break-all text-sm">{profileRef}</code>
      </div>
      <div className="segmented data-scopes" aria-label="数据 AI 说明范围">{agentGuideScopes.filter(([item]) => item !== "all" && item !== "training").map(([item, label]) =>
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
