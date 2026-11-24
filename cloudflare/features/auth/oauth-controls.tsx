"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { isSpotterApp, oauthNoticeText, supportsNativeOAuth, type OAuthNotice } from "./oauth-ui";
import styles from "./oauth-controls.module.css";

const providerState = z.object({ enabled: z.boolean(), linked: z.boolean() });
const OAuthStatus = z.object({ providers: z.object({ apple: providerState, google: providerState }), signedIn: z.boolean() });
const providers = ["apple", "google"] as const;
const names = { apple: "Apple", google: "Google" };
const providerOrigins = { apple: "https://appleid.apple.com", google: "https://accounts.google.com" };
type Provider = typeof providers[number];

export function OAuthControls(props: { mode: "login"; notice?: OAuthNotice } | { mode: "link"; owner: string; notice?: OAuthNotice }) {
  const { mode, notice } = props;
  const owner = props.mode === "link" ? props.owner : undefined;
  const [status, setStatus] = useState<z.infer<typeof OAuthStatus>>();
  const [agent, setAgent] = useState("");
  const [pending, setPending] = useState<Provider>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setAgent(window.navigator.userAgent);
    const controller = new AbortController();
    void fetch("/api/auth/oauth", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const next = OAuthStatus.parse(await response.json());
        if (!controller.signal.aborted) setStatus(next);
      }).catch(() => {
        if (!controller.signal.aborted) setError("暂时无法读取登录方式。");
      });
    return () => controller.abort();
  }, [owner, retry]);

  async function start(provider: Provider) {
    if (pending) return;
    setPending(provider);
    setError("");
    try {
      const response = await fetch("/api/auth/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, mode, ...(owner ? { expectedOwner: owner } : {}) }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("当前登录状态已变更。请刷新后重试。");
      }
      if (!response.ok) throw new Error(`暂时无法启动 ${names[provider]} 登录，请稍后重试。`);
      const next = z.object({ authorizationUrl: z.string().url() }).parse(await response.json());
      if (new URL(next.authorizationUrl).origin !== providerOrigins[provider]) throw new Error();
      window.location.assign(next.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error && reason.name === "Error" && reason.message
        ? reason.message : "暂时无法连接登录服务，请重试。");
      setPending(undefined);
    }
  }

  const native = supportsNativeOAuth(agent);
  const oldApp = isSpotterApp(agent) && !native;
  return <div className={styles.controls} aria-label={mode === "login" ? "登录方式" : "绑定登录方式"}>
    {providers.map((provider) => {
      const choice = status?.providers[provider];
      const linked = mode === "link" && choice?.linked;
      const ready = Boolean(choice?.enabled && !linked && (mode === "login" || status?.signedIn) && agent && !oldApp && !pending);
      const label = mode === "login" ? `使用 ${names[provider]} 登录` : linked ? `${names[provider]} 已绑定` : `绑定 ${names[provider]}`;
      const content = <><strong>{pending === provider ? "正在连接…" : label}</strong>
        {choice && !linked && !choice.enabled && <small>待配置</small>}</>;
      const query = new URLSearchParams({ mode, ...(owner ? { expectedOwner: owner } : {}) });
      return native && ready
        ? <a key={provider} className={`button outline ${styles.option}`} href={`/api/auth/oauth/${provider}/native?${query}`}>{content}</a>
        : <button key={provider} className={`button outline ${styles.option}`} type="button" disabled={!ready}
          onClick={() => void start(provider)}>{content}</button>;
    })}
    {oldApp && <p className="muted">更新 App 后即可使用 Apple 或 Google 登录。</p>}
    {notice && (notice !== "linked" || status?.providers.apple.linked || status?.providers.google.linked) &&
      <p role={notice === "linked" ? "status" : "alert"} className={notice === "linked" ? "muted" : "inline-error"}>
      {oauthNoticeText(notice)}</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {!status && error && <button type="button" className="text-button" onClick={() => { setError(""); setRetry(retry + 1); }}>重新读取</button>}
  </div>;
}
