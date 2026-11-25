"use client";

import { useEffect, useState } from "react";
import { maxNicknameLength, normalizeUsername, parseHandleQuery, updateNicknameInput } from "@/features/auth/profile";
import { ClientError, errorText, send } from "@/shared/client";

type UsernameProfile = {
  name?: string;
  username: string;
  tag: string;
  handle: string;
};

const endpoint = "/api/auth/profile";
type ProfileField = "nickname" | "username";

async function readProfile(signal: AbortSignal) {
  const response = await fetch(endpoint, { cache: "no-store", signal });
  const data = await response.json().catch(() => null) as { profile?: UsernameProfile; error?: string } | null;
  if (!response.ok || !data?.profile) throw new ClientError(response.status, data?.error || "暂时无法读取账号资料。");
  return data.profile;
}

export function UsernameSettings({ owner, name, onNicknameSaved }: { owner: string; name: string; onNicknameSaved: (name: string) => void }) {
  const [profile, setProfile] = useState<UsernameProfile>();
  const [nickname, setNickname] = useState<string>();
  const [username, setUsername] = useState("");
  const [tag, setTag] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<ProfileField>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const isSaving = saving !== undefined;
  const currentNickname = profile?.name ?? name;
  const nicknameInput = nickname ?? currentNickname;
  const nicknameUpdate = updateNicknameInput.safeParse({ name: nicknameInput, expectedOwner: owner });
  const nicknameChanged = nicknameUpdate.success && nicknameUpdate.data.name !== currentNickname;
  const normalized = normalizeUsername(username);
  const normalizedTag = normalizeUsername(tag);
  const valid = /^[0-9]{4}$/.test(normalizedTag) && parseHandleQuery(normalized + "#" + normalizedTag) !== null;
  const changed = profile && (normalized !== profile.username || normalizedTag !== profile.tag);

  useEffect(() => {
    const abort = new AbortController();
    void readProfile(abort.signal).then(
      (profile) => { if (!abort.signal.aborted) { setProfile(profile); setUsername(profile.username); setTag(profile.tag); } },
      (reason) => { if (!abort.signal.aborted) setError(errorText(reason)); },
    );
    return () => abort.abort();
  }, [attempt, owner]);

  async function save(field: ProfileField) {
    if (isSaving || (field === "nickname" ? !nicknameChanged : !valid || !changed)) return;
    setSaving(field);
    setError("");
    setStatus("");
    try {
      const response = field === "nickname"
        ? await send(endpoint, nicknameUpdate.data, "PATCH")
        : await send(endpoint, { username: normalized, tag: normalizedTag, expectedOwner: owner });
      const { profile } = await response.json() as { profile: UsernameProfile };
      setProfile(profile);
      if (profile.name && profile.name !== name) onNicknameSaved(profile.name);
      if (field === "nickname") {
        setNickname(undefined);
        setStatus("昵称已更新。");
      } else {
        setUsername(profile.username);
        setTag(profile.tag);
        setStatus("用户名已更新。");
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setSaving(undefined); }
  }

  async function copy() {
    if (!profile) return;
    try { await navigator.clipboard.writeText(profile.handle); setStatus("用户名已复制。"); }
    catch { setError("可以选中完整用户名后复制。"); }
  }

  return <section className="card padded feature-stack">
    <h2>个人资料</h2>
    {profile ? <>
      <form className="form-fields" onSubmit={(event) => { event.preventDefault(); void save("nickname"); }}>
        <label>昵称<input value={nicknameInput} maxLength={256} autoComplete="nickname"
          onChange={(event) => { setNickname(event.target.value); setStatus(""); setError(""); }} disabled={isSaving}
          aria-invalid={nickname !== undefined && !nicknameUpdate.success} aria-describedby="spotter-nickname-rules" /></label>
        <p id="spotter-nickname-rules" className="muted">好友、搭子和搜索结果会显示你的昵称。填写 1–{maxNicknameLength} 个字符，避开邮箱地址和系统占位名称。</p>
        <div className="exercise-toolbar"><button className="button primary" type="submit"
          disabled={isSaving || !nicknameChanged}>{saving === "nickname" ? "正在保存…" : "保存昵称"}</button></div>
      </form>
      <div className="exercise-toolbar">
        <strong>{profile.handle}</strong>
        <button className="button outline small" type="button" onClick={() => void copy()}>复制</button>
      </div>
      <form className="form-fields" onSubmit={(event) => { event.preventDefault(); void save("username"); }}>
        <label>修改用户名<input value={username} maxLength={24} autoCapitalize="none" autoComplete="off" spellCheck={false}
          onChange={(event) => { setUsername(event.target.value); setStatus(""); setError(""); }} disabled={isSaving}
          aria-describedby="spotter-username-rules" /></label>
        <label>数字标签<input value={tag} inputMode="numeric" maxLength={4} autoComplete="off" placeholder="0000"
          onChange={(event) => { setTag(event.target.value); setStatus(""); setError(""); }} disabled={isSaving}
          aria-describedby="spotter-username-rules" /></label>
        <p id="spotter-username-rules" className="muted">其他人可用用户名和数字标签搜索你。用户名须为 3–24 个英文字母、数字、点或下划线，两端须为字母或数字。标签为四位数字，完整组合需唯一。</p>
        <div className="exercise-toolbar"><button className="button primary" type="submit"
          disabled={isSaving || !valid || !changed}>{saving === "username" ? "正在保存…" : "保存用户名"}</button></div>
      </form>
    </> : error ? <button className="button outline" type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>重新读取</button>
      : <p className="muted" role="status">正在读取账号资料…</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
  </section>;
}
