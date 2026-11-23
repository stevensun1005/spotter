"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CirclePlay, ExternalLink, X } from "lucide-react";

export const displayNumber = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);

export const avatar = (name: string) => Array.from(name.trim())[0]?.toUpperCase() || "我";

export function Dialog({ title, onClose, children, className = "" }: {
  title: string; onClose: () => void; children: ReactNode; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);
  return <dialog ref={dialog} className={`dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button></div>
    {children}
  </dialog>;
}

export function VideoLink({ url }: { url: string }) {
  return <a className="button outline" href={url} target="_blank" rel="noopener noreferrer"><CirclePlay size={18} /> 打开跟练视频 <ExternalLink size={14} /></a>;
}
