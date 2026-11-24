"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/shared/ui";
import { allowAnthropicSharing, allowsAnthropicSharing } from "./sharing-consent-store";

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
    <Dialog title="允许把照片发给 Anthropic？" onClose={() => decide(false)}>
      <div className="dialog-body feature-stack">
        <p>拍照识别会把你选中的餐食或包装照片及填写的备注发送给 Anthropic 的 Claude。</p>
        <p className="muted">此账号在当前设备上主动使用拍照识别时会沿用该许可。</p>
      </div>
      <div className="dialog-footer">
        <button className="button outline" type="button" onClick={() => decide(false)}>暂不发送</button>
        <button className="button primary" type="button" onClick={() => decide(true)}>允许发送并继续</button>
      </div>
    </Dialog>, document.body,
  ) : null;

  return { withConsent, prompt };
}
