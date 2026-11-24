"use client";

import { useRef, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { z } from "zod";
import { Dialog } from "@/shared/ui";
import { deleteAccountEndpoint } from "./paths";

const resultSchema = z.object({ deleted: z.literal(true), appleRevocation: z.enum(["revoked", "manual", "not-required"]) });

export function DeleteAccount({ owner, onDeleted }: { owner: string; onDeleted: (needsAppleRevocation: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  function close() {
    if (!pending.current) setOpen(false);
  }

  async function remove() {
    if (!open || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    let needsAppleRevocation;
    try {
      const response = await fetch(deleteAccountEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedOwner: owner, confirm: true }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("登录状态已变更，请刷新页面后核对当前账号。");
      }
      if (!response.ok) throw new Error("暂时无法删除账号，请稍后重试。");
      const result = resultSchema.safeParse(await response.json());
      if (!result.success) throw new Error();
      needsAppleRevocation = result.data.appleRevocation === "manual";
    } catch (reason) {
      setError(reason instanceof Error && reason.name === "Error" && reason.message
        ? reason.message : "未收到删除确认，请刷新页面查看当前登录状态。");
      pending.current = false;
      setBusy(false);
      return;
    }
    onDeleted(needsAppleRevocation);
  }

  return <>
    <button type="button" className="settings-row settings-delete-account" onClick={() => { setError(""); setOpen(true); }}>
      <span className="settings-icon" data-tone="red"><Trash2 size={18} aria-hidden="true" /></span>
      <span><strong>删除账号</strong><small>永久删除训练搭子账号及个人数据</small></span>
      <ChevronRight className="settings-arrow" size={17} aria-hidden="true" />
    </button>
    {open && <Dialog title="永久删除账号？" onClose={close} className="account-deletion-dialog">
      <div className="dialog-body feature-stack">
        <p>你在 App 和 Cloudflare 网页上共用的训练搭子账号会被永久删除。训练计划、打卡、饮食、身体和已同步的健康数据会一并删除。</p>
        <p>所有设备都会退出登录，绑定的登录方式和共享关系会解除。此操作无法撤销。</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {busy && <p className="muted" role="status">正在删除账号…</p>}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button outline" disabled={busy} onClick={close}>取消</button>
        <button type="button" className="button account-delete-confirm" disabled={busy} onClick={() => void remove()}>永久删除账号</button>
      </div>
    </Dialog>}
  </>;
}
