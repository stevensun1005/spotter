"use client";

import { useState } from "react";

export function DisconnectPair({ name, busy, onDisconnect }: { name: string; busy: boolean; onDisconnect: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button className="text-button friend-remove" type="button" disabled={busy}
    onClick={() => setConfirm(true)}>解除配对</button>;
  return <section className="card padded feature-stack" aria-label="确认解除配对">
    <strong>解除和{name}的搭子关系？</strong>
    <p className="muted">解除后，搭子身份带来的训练和饮食访问会结束。如果你们也互加了好友，原有的好友分享设置仍然适用。</p>
    <div className="friend-dialog-actions">
      <button className="button outline" type="button" disabled={busy} onClick={() => setConfirm(false)}>取消</button>
      <button className="button subtle friend-remove" type="button" disabled={busy} onClick={onDisconnect}>
        {busy ? "正在解除…" : "确认解除配对"}
      </button>
    </div>
  </section>;
}
