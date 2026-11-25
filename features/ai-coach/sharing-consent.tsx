"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/shared/ui";
import { allowAnthropicSharing, allowsAnthropicSharing, revokeExternalAISharing } from "./sharing-consent-store";

export function AISharingSettings({ owner }: { owner: string }) {
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try { setAllowed(allowsAnthropicSharing(window.localStorage, owner)); }
    catch { setAllowed(false); }
  }, [owner]);
  if (!owner) return null;
  return <section className="card padded feature-stack">
    <h2>AI 数据授权</h2>
    <div className="exercise-toolbar">
      <span role="status">{allowed ? "本设备已授权" : "本设备尚未授权"}</span>
      {allowed && <button className="button outline" type="button" onClick={() => {
        try { revokeExternalAISharing(window.localStorage, owner); setAllowed(false); setError(""); }
        catch { setError("暂时无法撤销授权，请重试。"); }
      }}>撤销授权</button>}
    </div>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}

export function useAnthropicSharing(owner?: string) {
  const pending = useRef<{ owner: string; send: () => void }>(null);
  const [promptOwner, setPromptOwner] = useState<string>();
  useLayoutEffect(() => () => {
    pending.current = null;
    setPromptOwner(undefined);
  }, [owner]);

  function withConsent(send: () => void) {
    if (!owner || pending.current?.owner === owner) return;
    let allowed = false;
    try { allowed = allowsAnthropicSharing(window.localStorage, owner); }
    catch { /* A browser without storage asks again on the next send. */ }
    if (allowed) {
      send();
      return;
    }
    pending.current = { owner, send };
    setPromptOwner(owner);
  }

  function decide(allow: boolean) {
    const request = pending.current;
    pending.current = null;
    setPromptOwner(undefined);
    if (!allow || !owner || request?.owner !== owner) return;
    try { allowAnthropicSharing(window.localStorage, owner); }
    catch { /* Consent still applies to this send. */ }
    request.send();
  }

  const prompt = promptOwner && promptOwner === owner ? createPortal(
    <Dialog title="允许 AI 教练处理内容？" onClose={() => decide(false)}>
      <div className="dialog-body feature-stack">
        <p>你发送的对话、选中的照片和训练资料会交由外部 AI 服务处理。此账号会沿用本设备上的授权，可在设置中撤销。</p>
        <p><a href="/privacy#external-ai" target="_blank" rel="noreferrer">查看隐私说明</a></p>
      </div>
      <div className="dialog-footer">
        <button className="button outline" type="button" onClick={() => decide(false)}>暂不发送</button>
        <button className="button primary" type="button" onClick={() => decide(true)}>允许发送并继续</button>
      </div>
    </Dialog>, document.body,
  ) : null;

  return { withConsent, prompt };
}
