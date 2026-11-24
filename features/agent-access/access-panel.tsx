"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, FilePenLine, KeyRound, Link, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { PlanFields } from "@/features/plans/plan-fields";
import { cleanPlan, type Plan } from "@/features/plans/model";

type Scope = "read:context" | "plans:draft" | "plans:write";
type Connection = { id: string; name: string; scopes: Scope[]; createdAt: string; expiresAt: string; lastUsedAt: string | null; revokedAt: string | null };
type Draft = { id: string; title: string; plans: Plan[]; createdAt: string; expiresAt: string; status: "draft" | "committed"; revision: string; result: { added: number; skipped: number } | null };
type Preview = Draft & { preview: { id: string; title: string; date: string; status: "new" | "existing" | "blocked"; conflict?: string }[]; willAdd: number; blocked: number };
const scopes: readonly [Scope, string][] = [["read:context", "读取动作、模板和编排偏好"], ["plans:draft", "提交计划草稿"], ["plans:write", "按授权排入训练日历"]];
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const value = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(value.error || "暂时无法读取或保存，请重试。");
  return value as T;
}

function guide(origin: string, profileRef: string) {
  return [
    "# Spotter · 我的 Agent 计划接口", "", "站点：" + origin, "账号说明编号：" + profileRef,
    "", "使用用户自己的 AI Agent。Spotter 不调用模型，也不需要模型 API key。",
    "## 连接", "支持本站授权连接的 MCP 客户端使用 " + origin + "/mcp。先核对 get_spotter_agent_profile 返回的账号说明编号。",
    "支持自定义 HTTPS 工具的客户端可使用个人连接令牌：Authorization: Bearer <用户提供的连接令牌>。令牌只发往这个站点，不能当作模型 API key。",
    "私密 Sites 的平台登录可能先于应用拦截请求。若返回登录页或跳转，请使用受支持的站点 MCP 授权；不要把站点绕过令牌交给 Agent。",
    "## 流程", "1. GET /api/agent/profile 核对账号和权限；GET /api/agent/schema 获取当前结构；GET /api/agent/context 获取已授权的动作、模板和偏好（携带 profileRef）。按返回的分页读取，不请求健康或好友数据。",
    "2. 按用户目标在自己的模型中起草。保留动作 ID、组别、器械站、休息、节奏及单位；未知重量用 0。",
    "3. POST /api/agent/drafts，JSON 为 {profileRef,requestId,plans,title?}。requestId 是新 UUID，重试必须复用；每批最多 20 堂。更长周期使用训练周期接口，不能截断。",
    "4. 草稿会出现在网页「AI 连接」中，可以编辑和校验。草稿尚未排入日历。",
    "5. 只有用户明确授权本批写入且令牌有 plans:write 时，POST /api/agent/commit：{profileRef,draftId,revision,confirmed:true}。revision 使用最新草稿返回值。否则由用户在网页确认。",
    "6. 报告实际 added/skipped 和日期；失败时不要说已保存。不得修改已完成训练、正在进行的训练或其他账号的数据。",
    "", "支持 MCP 的 Agent 也可通过本站提供的编排上下文、草稿和确认工具完成同一流程。是否可接入取决于客户端的自定义工具与认证能力，不依赖某一家模型。",
  ].join("\n") + "\n";
}

export function AgentAccessPanel({ enabled, profileRef, saved }: { enabled: boolean; profileRef?: string; saved: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>(["read:context", "plans:draft"]);
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  const [revoke, setRevoke] = useState<string>();
  const [preview, setPreview] = useState<Preview>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState(0);
  const [changed, setChanged] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [keys, staged] = await Promise.all([
        request<{ connections: Connection[]; profileRef: string }>("/api/agent/connections", undefined, signal),
        request<{ drafts: Draft[] }>("/api/agent/drafts", undefined, signal),
      ]);
      if (profileRef && keys.profileRef !== profileRef) throw new Error("当前账号已变化，请刷新网页后再连接。");
      if (!signal?.aborted) { setConnections(keys.connections); setDrafts(staged.drafts); setError(""); }
    } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "连接读取失败。"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [enabled, profileRef]);
  useEffect(() => { const abort = new AbortController(); void load(abort.signal); return () => abort.abort(); }, [load]);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [load]);

  async function copy(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setMessage(success); }
    catch { setError("无法自动复制，请长按对应文本复制。"); }
  }
  async function createConnection() {
    setBusy(true); setDialogError("");
    try {
      const value = await request<{ connection: Connection; token: string }>("/api/agent/connections", { action: "create", name, scopes: selectedScopes, expiresInDays: days });
      setSecret(value.token); setReveal(false); setCreate(false); setName(""); await load();
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "未能创建连接。"); }
    finally { setBusy(false); }
  }
  async function revokeConnection(id: string) {
    setBusy(true); setError("");
    try { await request("/api/agent/connections", { action: "revoke", id }); setRevoke(undefined); setMessage("连接已撤销，旧令牌不能再读取或写入。"); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "未能断开连接。"); }
    finally { setBusy(false); }
  }
  async function inspect(draft: Draft) {
    setBusy(true); setError(""); setDialogError("");
    try {
      const next = await request<Preview>("/api/agent/drafts?id=" + encodeURIComponent(draft.id));
      setPreview(next); setPlans(next.plans); setActive(0); setChanged(false); setDiscard(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "草稿读取失败。"); }
    finally { setBusy(false); }
  }
  async function revise() {
    if (!preview || !profileRef) return;
    setBusy(true); setDialogError("");
    try {
      const checked = plans.map(cleanPlan);
      if (checked.some((plan) => !plan.success)) throw new Error("请检查每堂训练的名称、日期、动作与数值。");
      const next = await request<Preview>("/api/agent/drafts", { action: "revise", profileRef, draftId: preview.id, revision: preview.revision, plans: checked.flatMap((plan) => plan.success ? [plan.data] : []) });
      setPreview(next); setPlans(next.plans); setChanged(false); setDiscard(false); await load();
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "草稿尚未保存。"); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!preview || !profileRef || changed) return;
    setBusy(true); setDialogError("");
    try {
      const value = await request<{ added: number; skipped: number }>("/api/agent/commit", { profileRef, draftId: preview.id, revision: preview.revision, confirmed: true });
      setPreview(undefined); setMessage("已排入 " + value.added + " 堂，跳过 " + value.skipped + " 堂已有计划。"); saved(); await load();
    } catch (reason) { setDialogError(reason instanceof Error ? reason.message : "计划尚未排入日历。"); }
    finally { setBusy(false); }
  }

  return <div className="feature-stack agent-access">
    <section className="card padded feature-stack">
      <div className="section-head"><h2><Link size={20} /> 连接你自己的 AI Agent</h2></div>
      <p className="muted">用你正在使用的 GPT、Claude、Grok、Muse 或其他 Agent 起草训练。支持 MCP 或自定义 HTTPS 工具的客户端可接入；Spotter 不代替它调用模型。</p>
      <div className="agent-flow" aria-label="Agent 计划流程"><span>读取编排资料</span><span>Agent 起草</span><span>网页校验与编辑</span><span>按授权排入日历</span></div>
      <p className="agent-privacy"><ShieldCheck size={18} /> 每个连接只属于你的账号，默认不开放心率、身体或好友记录。</p>
      {enabled && profileRef ? <div className="exercise-toolbar">
        <button type="button" className="button outline" onClick={() => void copy(guide(window.location.origin, profileRef), "接入说明已复制，可交给你的 Agent。")}><Clipboard size={17} /> 复制 Agent 接入说明</button>
        <button type="button" className="button subtle" onClick={() => void load()} disabled={loading}><RefreshCw size={17} /> 刷新</button>
      </div> : <p className="muted">登录后可以创建个人连接和接收草稿。</p>}
      <details className="agent-help"><summary>MCP 与 API 怎么选</summary><p>支持训练搭子授权连接的 MCP 客户端，优先使用站点 MCP；需要配置 HTTP 工具的 Agent，可使用下方个人令牌。私密 Sites 仍要求平台访问授权，个人令牌不能绕过站点登录。</p><p>不需要把你的模型 API key 交给 Spotter。接入说明中的令牌占位符应由你在自己的 Agent 中配置。</p></details>
    </section>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {message && <p className="agent-feedback" role="status"><Check size={17} />{message}</p>}
    {enabled && <>
      <section className="card padded feature-stack">
        <div className="section-head"><h2><KeyRound size={20} /> 个人连接</h2><button className="button primary small" type="button" disabled={busy} onClick={() => { setCreate(true); setName(""); setDays(30); setSelectedScopes(["read:context", "plans:draft"]); setDialogError(""); }}><Plus size={17} /> 新建连接</button></div>
        {loading && !connections.length ? <p className="muted" role="status">正在读取连接…</p> : !connections.length ? <p className="muted">还没有个人 API 连接。已授权的站点 MCP 连接可继续使用。</p> : <ul className="agent-connection-list">{connections.map((item) => {
          const expired = new Date(item.expiresAt).getTime() <= Date.now();
          const inactive = Boolean(item.revokedAt) || expired;
          return <li key={item.id}><div className="agent-connection-heading"><strong>{item.name}</strong><span className="state-tag">{item.revokedAt ? "已撤销" : expired ? "已过期" : "可用"}</span></div>
            <p className="muted">{item.scopes.map((scope) => scopes.find(([key]) => key === scope)?.[1] ?? scope).join(" · ")}</p>
            <p className="muted">有效至 {dateTime(item.expiresAt)}{item.lastUsedAt ? " · 最近使用 " + dateTime(item.lastUsedAt) : " · 尚未使用"}</p>
            {!inactive && (revoke === item.id ? <div className="exercise-toolbar"><button type="button" className="button outline small" disabled={busy} onClick={() => void revokeConnection(item.id)}>确认断开</button><button className="button subtle small" type="button" onClick={() => setRevoke(undefined)}>取消</button></div> : <button type="button" className="button subtle small" disabled={busy} onClick={() => setRevoke(item.id)}><Unplug size={16} /> 断开连接</button>)}
          </li>;
        })}</ul>}
      </section>
      <section className="card padded feature-stack">
        <div className="section-head"><h2><FilePenLine size={20} /> Agent 计划草稿</h2><span className="count-label">{drafts.filter((draft) => draft.status === "draft").length} 份待处理</span></div>
        <p className="muted">草稿可先编辑和校验。确认前不出现在训练日历；已完成和进行中的训练保持原记录。</p>
        {!drafts.length ? <p className="empty-copy">Agent 提交草稿后会显示在这里。</p> : <ul className="agent-connection-list">{drafts.map((draft) => <li key={draft.id}><div className="agent-connection-heading"><strong>{draft.title}</strong><span className="state-tag">{draft.status === "committed" ? "已排入日历" : "待确认"}</span></div><p className="muted">{draft.plans.length} 堂训练 · {dateTime(draft.createdAt)}</p><button className="button outline small" type="button" disabled={busy} onClick={() => void inspect(draft)}>查看与编辑</button></li>)}</ul>}
      </section>
    </>}
    {create && <Dialog title="新建 Agent 连接" onClose={() => { if (!busy) setCreate(false); }}><form onSubmit={(event) => { event.preventDefault(); void createConnection(); }}>
      <fieldset disabled={busy} className="dialog-body form-fields agent-fieldset"><label>连接名称<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：我的 Claude" /></label><label>有效期<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 天</option><option value={30}>30 天</option><option value={90}>90 天</option></select></label><strong>允许这个连接做什么</strong>{scopes.map(([scope, label]) => <label className="toggle-label" key={scope}><input type="checkbox" checked={selectedScopes.includes(scope)} onChange={(event) => setSelectedScopes((current) => event.target.checked ? [...current, scope] : current.filter((value) => value !== scope))} />{label}</label>)}<p className="muted">只授予需要的范围。未开启排入日历时，Agent 只能按所选权限读取资料、提交草稿，由你在网页确认。</p>{dialogError && <p className="inline-error" role="alert">{dialogError}</p>}</fieldset><div className="dialog-footer"><button className="button primary" disabled={busy || !selectedScopes.length}>{busy ? "正在创建…" : "创建连接"}</button></div>
    </form></Dialog>}
    {secret && <Dialog title="保存本次连接令牌" onClose={() => { setSecret(""); setReveal(false); }}><div className="dialog-body form-fields"><p>令牌只在这里展示一次。复制给你信任的 Agent 后关闭，之后可在连接列表撤销。</p><label>连接令牌<input type={reveal ? "text" : "password"} value={secret} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.target.select()} /></label><div className="exercise-toolbar"><button className="button outline" type="button" onClick={() => void copy(secret, "连接令牌已复制。请只用于你信任的 Agent。")}>复制令牌</button><button className="button subtle" type="button" onClick={() => setReveal((value) => !value)}>{reveal ? "隐藏" : "显示"}</button></div></div></Dialog>}
    {preview && <Dialog title={preview.title} onClose={() => { if (!busy) { if (changed) setDiscard(true); else setPreview(undefined); } }} className="agent-draft-dialog"><div className="dialog-body feature-stack">
      <div className="import-tabs" role="group" aria-label="草稿中的训练">{plans.map((plan, index) => <button key={index} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{index + 1} · {plan.title}</button>)}</div>
      <p className="muted">Agent 草稿默认私人。排入日历后，可在原计划入口按现有规则选择分享。</p>
      {plans[active] && <fieldset className="agent-fieldset" disabled={busy || preview.status === "committed"}><PlanFields allowSharing={false} key={active} value={plans[active]} change={(plan) => { setPlans((current) => current.map((item, index) => index === active ? plan : item)); setChanged(true); setDiscard(false); }} /></fieldset>}
      <div className="agent-preview"><h3>日历预览</h3>{changed ? <p className="muted">内容已修改，先校验草稿再确认排入日历。</p> : <><p>新增 {preview.willAdd} 堂 · 需处理 {preview.blocked} 堂</p><ul>{preview.preview.map((item) => <li key={item.id}><strong>{item.date} · {item.title}</strong><span>{item.status === "new" ? "将新增" : item.status === "existing" ? "已存在，跳过" : item.conflict || "需要调整日期或内容"}</span></li>)}</ul></>}</div>
      {dialogError && <p className="inline-error" role="alert">{dialogError}</p>}
      {discard && <div className="agent-preview" role="alert"><p>当前修改尚未保存。关闭会放弃本次修改，已保存草稿仍会保留。</p><div className="exercise-toolbar"><button type="button" className="button outline small" onClick={() => { setPreview(undefined); setDiscard(false); }}>放弃修改并关闭</button><button type="button" className="button subtle small" onClick={() => setDiscard(false)}>继续编辑</button></div></div>}
    </div>{preview.status !== "committed" && <div className="dialog-footer"><button className="button outline" type="button" disabled={busy || !changed} onClick={() => void revise()}>校验并保存草稿</button><button className="button primary" type="button" disabled={busy || changed || preview.blocked > 0 || !preview.willAdd} onClick={() => void commit()}>{busy ? "正在保存…" : "确认排入日历"}</button></div>}</Dialog>}
  </div>;
}
