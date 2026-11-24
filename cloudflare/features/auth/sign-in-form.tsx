"use client";

import { useState, type FormEvent } from "react";
import { signInEndpoint } from "./paths";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(signInEndpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), accessCode: form.get("accessCode") }) });
      if (response.ok) { window.location.assign(returnTo); return; }
      setError(response.status === 401 ? "邮箱或访问码不正确。" :
        response.status === 400 ? "请填写有效的邮箱和完整访问码。" : "登录暂时不可用，请稍后再试。");
    } catch {
      setError("连接失败，请检查网络后重试。");
    }
    setSaving(false);
  }

  return <form className="form-fields" method="post" action={signInEndpoint} onSubmit={(event) => void submit(event)}>
    <label>邮箱<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
    <label>访问码<input name="accessCode" type="password" autoComplete="current-password" maxLength={128} required /></label>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button type="submit" className="button primary" disabled={saving}>{saving ? "正在登录…" : "登录"}</button>
  </form>;
}
