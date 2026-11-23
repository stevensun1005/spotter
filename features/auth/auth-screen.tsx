"use client";

import { useState, type FormEvent } from "react";
import { Dumbbell, LogIn, UserPlus } from "lucide-react";
import { errorText, send } from "@/shared/client";

export function AuthScreen() {
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await send(register ? "/api/auth/register" : "/api/auth/login", values);
      window.location.reload();
    } catch (reason) {
      setError(errorText(reason, "登录服务暂时不可用，请重试。"));
      setPending(false);
    }
  }
  return <main className="auth-page">
    <section className="auth-hero" aria-hidden="true"><Dumbbell size={26} /><strong>训练搭子</strong></section>
    <section className="auth-content">
      <div className="card padded auth-card">
        <div className="auth-mark"><span className="brand-mark"><Dumbbell size={22} /></span><strong>训练搭子</strong></div>
        <h1>{register ? "开通账号" : "登录训练搭子"}</h1>
        {register && <p className="muted">首次开通用部署开通码。搭子加入用收到的搭子邀请码。</p>}
        <form className="form-fields" onSubmit={(event) => void submit(event)}>
          {register && <label>昵称<input name="name" maxLength={32} autoComplete="nickname" required /></label>}
          <label>用户名<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,31}" minLength={3} maxLength={32} required /></label>
          <label>密码<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} placeholder={register ? "至少 12 个字符" : undefined} required /></label>
          {register && <label>开通码或搭子邀请码<input name="invite" autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={32} maxLength={32} pattern="[a-fA-F0-9]{32}" required /></label>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button primary full" disabled={pending}>{register ? <UserPlus size={18} /> : <LogIn size={18} />}{pending ? "正在提交" : register ? "开通并登录" : "登录"}</button>
        </form>
        <button className="text-button" disabled={pending} onClick={() => { setRegister(!register); setError(""); }}>{register ? "已有账号，返回登录" : "使用开通码或邀请码注册"}</button>
      </div>
    </section>
  </main>;
}
