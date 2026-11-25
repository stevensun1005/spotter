"use client";

import { useEffect, useState } from "react";
import { ClientError, errorText, send } from "@/shared/client";

type UsernameProfile = {
  username: string;
  tag: string;
  handle: string;
};

const endpoint = "/api/auth/profile";

async function readProfile(signal: AbortSignal) {
  const response = await fetch(endpoint, { cache: "no-store", signal });
  const data = await response.json().catch(() => null) as { profile?: UsernameProfile; error?: string } | null;
  if (!response.ok || !data?.profile) throw new ClientError(response.status, data?.error || "暂时无法读取用户名。");
  return data.profile;
}

export function UsernameSettings({ owner }: { owner: string }) {
  const [profile, setProfile] = useState<UsernameProfile>();
  const [username, setUsername] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const normalized = username.trim().toLowerCase();
  const valid = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(normalized);

  useEffect(() => {
    const abort = new AbortController();
    void readProfile(abort.signal).then(
      (profile) => { if (!abort.signal.aborted) { setProfile(profile); setUsername(profile.username); } },
      (reason) => { if (!abort.signal.aborted) setError(errorText(reason)); },
    );
    return () => abort.abort();
  }, [attempt, owner]);

  async function save() {
    if (!profile || !valid || normalized === profile.username || saving) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await send(endpoint, { username: normalized, expectedOwner: owner });
      const { profile } = await response.json() as { profile: UsernameProfile };
      setProfile(profile);
      setUsername(profile.username);
      setStatus("用户名已更新。");
    } catch (reason) { setError(errorText(reason)); }
    finally { setSaving(false); }
  }

  async function copy() {
    if (!profile) return;
    try { await navigator.clipboard.writeText(profile.handle); setStatus("用户名已复制。"); }
    catch { setError("可以选中完整用户名后复制。"); }
  }

  return <section className="card padded feature-stack">
    <h2>用户名</h2>
    {profile ? <>
      <div className="exercise-toolbar">
        <strong>{profile.handle}</strong>
        <button className="button outline small" type="button" onClick={() => void copy()}>复制</button>
      </div>
      <form className="form-fields" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label>修改用户名<input value={username} maxLength={24} autoCapitalize="none" autoComplete="off" spellCheck={false}
          onChange={(event) => { setUsername(event.target.value); setStatus(""); setError(""); }} disabled={saving}
          aria-describedby="spotter-username-rules" /></label>
        <p id="spotter-username-rules" className="muted">使用 3–24 个英文字母、数字、点或下划线，两端须为字母或数字。编号 #{profile.tag} 会保留。</p>
        <div className="exercise-toolbar"><button className="button primary" type="submit"
          disabled={saving || !valid || normalized === profile.username}>{saving ? "正在保存…" : "保存用户名"}</button></div>
      </form>
    </> : error ? <button className="button outline" type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>重新读取</button>
      : <p className="muted" role="status">正在读取用户名…</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
  </section>;
}
