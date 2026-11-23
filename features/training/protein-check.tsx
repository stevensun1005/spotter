"use client";

import { useState } from "react";
import { errorText } from "@/shared/client";

export function ProteinCheck({ checked, save, label = "已喝蛋白粉", disabled = false }: {
  checked: boolean; save: (checked: boolean) => void | Promise<void>; label?: string; disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function change(value: boolean) {
    setPending(true);
    setError("");
    try { await save(value); }
    catch (reason) { setError(errorText(reason)); }
    finally { setPending(false); }
  }

  return <div className="protein-check" aria-busy={pending}>
    <label className="toggle-label"><input type="checkbox" checked={checked}
      disabled={disabled || pending} onChange={(event) => void change(event.target.checked)} /> {label}</label>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
