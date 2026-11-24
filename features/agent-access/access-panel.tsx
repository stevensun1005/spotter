"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clipboard, FilePenLine, KeyRound, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { PlanFields } from "@/features/plans/plan-fields";
import { cleanPlan, type Plan } from "@/features/plans/model";
import { agentPlanningGuide } from "@/features/import/ai-instructions";
import { DraftDayPreview, DraftProgress } from "@/features/import/draft-preview";

type Scope = "read:context" | "plans:draft" | "plans:write";
type Connection = { id: string; name: string; scopes: Scope[]; createdAt: string; expiresAt: string; lastUsedAt: string | null; revokedAt: string | null };
type Draft = { id: string; title: string; plans: Plan[]; createdAt: string; expiresAt: string; status: "draft" | "committed"; revision: string; result: { added: number; skipped: number } | null };
type Preview = Draft & { preview: { id: string; title: string; date: string; status: "new" | "existing" | "blocked"; conflict?: string }[]; willAdd: number; blocked: number };
const scopes: readonly [Scope, string][] = [["read:context", "读取动作、模板和编排偏好"], ["plans:draft", "提交计划草稿"], ["plans:write", "按授权排入训练日历"]];
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(path, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const value = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(value.error || "暂时无法读取或保存，请重试。");
  return value as T;
}

export function AgentAccessPanel({ enabled, profileRef, saved, active: pageActive = true }: { enabled: boolean; profileRef?: string; saved: () => void; active?: boolean }) {
  const account = useRef({ enabled, profileRef });
  account.current = { enabled, profileRef };
  const isCurrent = () => account.current.enabled === enabled && account.current.profileRef === profileRef;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualGuide, setManualGuide] = useState("");
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
      if (!isCurrent()) return;
      if (!Array.isArray(keys.connections) || !Array.isArray(staged.drafts) || typeof keys.profileRef !== "string") throw new Error("返回结果无效，请确认登录后重试。");
      if (profileRef && keys.profileRef !== profileRef) throw new Error("当前账号已变化，请刷新网页后再连接。");
      if (isCurrent() && !signal?.aborted) { setConnections(keys.connections); setDrafts(staged.drafts); setError(""); }
    } catch (reason) { if (isCurrent() && !signal?.aborted) setError(reason instanceof Error ? reason.message : "连接读取失败。"); }
    finally { if (isCurrent() && !signal?.aborted) setLoading(false); }
  }, [enabled, profileRef]);
  useEffect(() => {
    setConnections([]); setDrafts([]); setSecret(""); setReveal(false); setPreview(undefined); setPlans([]);
    setCreate(false); setSettingsOpen(false); setManualGuide(""); setMessage(""); setError("");
    setChanged(false); setDiscard(false); setBusy(false); setActive(0); setRevoke(undefined); setDialogError("");
  }, [enabled, profileRef]);
  useEffect(() => {
    if (!enabled || !pageActive) return;
    const abort = new AbortController(); void load(abort.signal); return () => abort.abort();
  }, [load, pageActive, enabled]);
  useEffect(() => {
    if (!changed) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [changed]);
  useEffect(() => {
    const wake = () => { if (pageActive && document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [load, pageActive]);

  async function copy(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setMessage(success); }
    catch { setError("无法自动复制，请长按对应文本复制。"); }
  }
  async function createConnection() {
    setBusy(true); setDialogError("");
    try {
      const value = await request<{ connection: Connection; token: string }>("/api/agent/connections", { action: "create", name, scopes: selectedScopes, expiresInDays: days });
      if (!isCurrent()) return;
      setSecret(value.token); setReveal(false); setCreate(false); setName(""); await load();
    } catch (reason) { if (isCurrent()) setDialogError(reason instanceof Error ? reason.message : "未能创建连接。"); }
    finally { if (isCurrent()) setBusy(false); }
  }
  async function revokeConnection(id: string) {
    setBusy(true); setError("");
    try { await request("/api/agent/connections", { action: "revoke", id }); if (!isCurrent()) return; setRevoke(undefined); setMessage("连接已撤销，旧令牌不能再读取或写入。"); await load(); }
    catch (reason) { if (isCurrent()) setError(reason instanceof Error ? reason.message : "未能断开连接。"); }
    finally { if (isCurrent()) setBusy(false); }
  }
  async function inspect(draft: Draft) {
    setBusy(true); setError(""); setDialogError("");
    try {
      const next = await request<Preview>("/api/agent/drafts?id=" + encodeURIComponent(draft.id));
      if (!isCurrent()) return;
      setPreview(next); setPlans(next.plans); setActive(0); setChanged(false); setDiscard(false);
    } catch (reason) { if (isCurrent()) setError(reason instanceof Error ? reason.message : "草稿读取失败。"); }
    finally { if (isCurrent()) setBusy(false); }
  }
  async function revise() {
    if (!preview || !profileRef) return;
    setBusy(true); setDialogError("");
    try {
      const checked = plans.map(cleanPlan);
      if (checked.some((plan) => !plan.success)) throw new Error("请检查每堂训练的名称、日期、动作与数值。");
      const next = await request<Preview>("/api/agent/drafts", { action: "revise", profileRef, draftId: preview.id, revision: preview.revision, plans: checked.flatMap((plan) => plan.success ? [plan.data] : []) });
      if (!isCurrent()) return;
      setPreview(next); setPlans(next.plans); setChanged(false); setDiscard(false); await load();
    } catch (reason) { if (isCurrent()) setDialogError(reason instanceof Error ? reason.message : "草稿尚未保存。"); }
    finally { if (isCurrent()) setBusy(false); }
  }
  async function commit() {
    if (!preview || !profileRef || changed) return;
    setBusy(true); setDialogError("");
    try {
      const value = await request<{ added: number; skipped: number }>("/api/agent/commit", { profileRef, draftId: preview.id, revision: preview.revision, confirmed: true });
      if (!isCurrent()) return;
      setPreview(undefined); setChanged(false); setMessage("已排入 " + value.added + " 堂，跳过 " + value.skipped + " 堂已有计划。"); saved(); await load();
    } catch (reason) { if (isCurrent()) setDialogError(reason instanceof Error ? reason.message : "计划尚未排入日历。"); }
    finally { if (isCurrent()) setBusy(false); }
  }

  async function copyInstructions() {
    if (!profileRef) return;
    const text = agentPlanningGuide(window.location.origin, profileRef);
    try { await navigator.clipboard.writeText(text); setManualGuide(""); setMessage("Agent 接入说明已复制。"); }
    catch { setManualGuide(text); setMessage("可以从下方选中并复制接入说明。"); }
  }

  return <div className="feature-stack agent-access">
    <details className="card padded agent-settings" open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
      <summary><KeyRound size={19} /><span>Agent 连接设置<small>需要自动提交草稿时，再配置 MCP 或个人连接</small></span></summary>
      <div className="feature-stack agent-settings-body">
        <p className="agent-privacy"><ShieldCheck size={18} /> 每个个人连接只属于你的账号，默认读取编排资料与提交草稿，心率、身体和好友记录不在其中。</p>
        <p className="muted">支持本站授权的 MCP 客户端可继续使用站点连接；支持自定义 HTTP 工具的 Agent 可创建个人令牌。普通聊天生成 JSON 时，无需配置这里。</p>
        {enabled && profileRef ? <div className="exercise-toolbar"><button type="button" className="button outline" onClick={() => void copyInstructions()}><Clipboard size={17} />复制 Agent 接入说明</button></div> : <p className="muted">登录后可以管理个人连接。</p>}
        <details className="agent-help"><summary>MCP 与个人 API 的接入条件</summary><p>客户端需要支持自定义工具与相应授权。私密 Sites 的平台登录可能先于应用接口拦截请求，个人令牌不能绕过站点访问权限。</p><p>模型在你自己的 AI 中运行，不需要将模型 API key 交给 Spotter。</p></details>
        {manualGuide && <label>Agent 接入说明<textarea readOnly rows={8} value={manualGuide} onFocus={(event) => event.target.select()} /></label>}
        {enabled && <section className="feature-stack">
          <div className="section-head"><h2>个人连接</h2><button className="button primary small" type="button" disabled={busy} onClick={() => { setCreate(true); setName(""); setDays(30); setSelectedScopes(["read:context", "plans:draft"]); setDialogError(""); }}><Plus size={17} />新建连接</button></div>
          {loading && !connections.length ? <p className="muted" role="status">正在读取连接…</p> : !connections.length ? <p className="muted">还没有个人 API 连接。已授权的站点 MCP 连接可继续使用。</p> : <ul className="agent-connection-list">{connections.map((item) => {
            const expired = new Date(item.expiresAt).getTime() <= Date.now();
            const inactive = Boolean(item.revokedAt) || expired;
            return <li key={item.id}><div className="agent-connection-heading"><strong>{item.name}</strong><span className="state-tag">{item.revokedAt ? "已撤销" : expired ? "已过期" : "可用"}</span></div>
              <p className="muted">{item.scopes.map((scope) => scopes.find(([key]) => key === scope)?.[1] ?? scope).join(" · ")}</p>
              <p className="muted">有效至 {dateTime(item.expiresAt)}{item.lastUsedAt ? " · 最近使用 " + dateTime(item.lastUsedAt) : " · 尚未使用"}</p>
              {!inactive && (revoke === item.id ? <div className="exercise-toolbar"><button type="button" className="button outline small" disabled={busy} onClick={() => void revokeConnection(item.id)}>确认断开</button><button className="button subtle small" type="button" onClick={() => setRevoke(undefined)}>取消</button></div> : <button type="button" className="button subtle small" disabled={busy} onClick={() => setRevoke(item.id)}><Unplug size={16} />断开连接</button>)}
            </li>;
          })}</ul>}
        </section>}
      </div>
    </details>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {message && <p className="agent-feedback" role="status"><Check size={17} />{message}</p>}
    <section className="card padded feature-stack">
      <div className="section-head"><h2><FilePenLine size={20} />Agent 送来的计划草稿</h2><div className="exercise-toolbar"><span className="count-label">{drafts.filter((draft) => draft.status === "draft").length} 份待确认</span>{enabled && <button type="button" className="button subtle small" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} />刷新草稿</button>}</div></div>
      <p className="muted">已连接的 Agent 提交后会显示在这里，编辑、校验并确认后进入日历。普通聊天 AI 返回的 JSON，请用上方「粘贴 AI 结果」。</p>
      {!enabled ? <p className="muted">登录后可以接收并确认 Agent 草稿。</p> : loading && !drafts.length ? <p className="muted" role="status">正在读取草稿…</p> : !drafts.length ? <p className="empty-copy">暂无 Agent 草稿。可以先使用上方提示词起草，也可展开连接设置。</p> : <ul className="agent-connection-list">{drafts.map((draft) => <li key={draft.id}><div className="agent-connection-heading"><strong>{draft.title}</strong><span className="state-tag">{draft.status === "committed" ? "已排入日历" : "待确认"}</span></div><p className="muted">{draft.plans.length} 堂训练 · {dateTime(draft.createdAt)}</p><button className="button outline small" type="button" disabled={busy} onClick={() => void inspect(draft)}>{draft.status === "committed" ? "查看结果" : "查看与编辑"}</button></li>)}</ul>}
    </section>
    {create && <Dialog title="新建 Agent 连接" onClose={() => { if (!busy) setCreate(false); }}><form onSubmit={(event) => { event.preventDefault(); void createConnection(); }}>
      <fieldset disabled={busy} className="dialog-body form-fields agent-fieldset"><label>连接名称<input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：我的 Claude" /></label><label>有效期<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 天</option><option value={30}>30 天</option><option value={90}>90 天</option></select></label><strong>允许这个连接做什么</strong>{scopes.map(([scope, label]) => <label className="toggle-label" key={scope}><input type="checkbox" checked={selectedScopes.includes(scope)} onChange={(event) => setSelectedScopes((current) => event.target.checked ? [...current, scope] : current.filter((value) => value !== scope))} />{label}</label>)}<p className="muted">只授予需要的范围。未开启排入日历时，Agent 只能按所选权限读取资料、提交草稿，由你在网页确认。</p>{dialogError && <p className="inline-error" role="alert">{dialogError}</p>}</fieldset><div className="dialog-footer"><button className="button primary" disabled={busy || !selectedScopes.length}>{busy ? "正在创建…" : "创建连接"}</button></div>
    </form></Dialog>}
    {secret && <Dialog title="保存本次连接令牌" onClose={() => { setSecret(""); setReveal(false); }}><div className="dialog-body form-fields"><p>令牌只在这里展示一次。复制给你信任的 Agent 后关闭，之后可在连接列表撤销。</p><label>连接令牌<input type={reveal ? "text" : "password"} value={secret} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.target.select()} /></label><div className="exercise-toolbar"><button className="button outline" type="button" onClick={() => void copy(secret, "连接令牌已复制。请只用于你信任的 Agent。")}>复制令牌</button><button className="button subtle" type="button" onClick={() => setReveal((value) => !value)}>{reveal ? "隐藏" : "显示"}</button></div></div></Dialog>}
    {preview && <Dialog title={preview.title} onClose={() => { if (!busy) { if (changed) setDiscard(true); else setPreview(undefined); } }} className="agent-draft-dialog"><div className="dialog-body feature-stack">
      <DraftProgress steps={["已接收草稿", "逐日核对", "排入日历"]} current={preview.status === "committed" ? 3 : 1} />
      <DraftDayPreview plans={plans} select={preview.status === "committed" ? undefined : setActive} />
      <div className="import-tabs" role="group" aria-label="草稿中的训练">{plans.map((plan, index) => <button key={index} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{index + 1} · {plan.title}</button>)}</div>
      <p className="muted">Agent 草稿默认私人。排入日历后，可在原计划入口按现有规则选择分享。</p>
      {plans[active] && <fieldset className="agent-fieldset" disabled={busy || preview.status === "committed"}><PlanFields allowSharing={false} key={active} value={plans[active]} change={(plan) => { setPlans((current) => current.map((item, index) => index === active ? plan : item)); setChanged(true); setDiscard(false); }} /></fieldset>}
      <div className="agent-preview"><h3>日历预览</h3>{changed ? <p className="muted">内容已修改，先校验草稿再确认排入日历。</p> : <><p>新增 {preview.willAdd} 堂 · 需处理 {preview.blocked} 堂</p><ul>{preview.preview.map((item) => <li key={item.id}><strong>{item.date} · {item.title}</strong><span>{item.status === "new" ? "将新增" : item.status === "existing" ? "已存在，跳过" : item.conflict || "需要调整日期或内容"}</span></li>)}</ul></>}</div>
      {dialogError && <p className="inline-error" role="alert">{dialogError}</p>}
      {discard && <div className="agent-preview" role="alert"><p>当前修改尚未保存。关闭会放弃本次修改，已保存草稿仍会保留。</p><div className="exercise-toolbar"><button type="button" className="button outline small" onClick={() => { setPreview(undefined); setDiscard(false); setChanged(false); }}>放弃修改并关闭</button><button type="button" className="button subtle small" onClick={() => setDiscard(false)}>继续编辑</button></div></div>}
    </div>{preview.status !== "committed" && <div className="dialog-footer"><button className="button outline" type="button" disabled={busy || !changed} onClick={() => void revise()}>校验并保存草稿</button><button className="button primary" type="button" disabled={busy || changed || preview.blocked > 0 || !preview.willAdd} onClick={() => void commit()}>{busy ? "正在保存…" : "确认排入日历"}</button></div>}</Dialog>}
  </div>;
}
