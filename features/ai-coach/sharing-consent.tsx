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
    <Dialog title="允许 AI 使用 Anthropic？" onClose={() => decide(false)}>
      <div className="dialog-body feature-stack">
        <p>Spotter 使用 Anthropic 的 Claude 回答训练问题、生成计划和识别图片。</p>
        <p>训练问答会发送相关对话及你选择附上的训练安排或草稿。问答定制会发送选定的答案和候选动作。拍照识别会发送你选中的餐食或包装照片及填写的备注。</p>
        <p className="muted">允许后，此账号在当前设备上主动使用这些 AI 功能时会沿用该许可。记体重和查训练统计在 Spotter 内处理。</p>
      </div>
      <div className="dialog-footer">
        <button className="button outline" type="button" onClick={() => decide(false)}>暂不发送</button>
        <button className="button primary" type="button" onClick={() => decide(true)}>允许发送并继续</button>
      </div>
    </Dialog>, document.body,
  ) : null;

  return { withConsent, prompt };
}
