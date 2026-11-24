"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { Sparkles, X } from "lucide-react";

export type CoachSheetSize = "half" | "full";

const dragThreshold = 44;
const tapSlop = 8;

function isBackdrop(event: PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

export function CoachSheet({ size, inlineOpen, onResize, onClose, children }: {
  size?: CoachSheetSize;
  inlineOpen: boolean;
  onResize: (size: CoachSheetSize) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressHandleClick = useRef(false);
  const backdropPointer = useRef<number | null>(null);
  const backdropClick = useRef(false);
  const modal = size !== undefined;

  useLayoutEffect(() => {
    const dialog = sheet.current;
    if (!dialog) return;
    const alreadyModal = dialog.matches(":modal");
    if (modal && !alreadyModal) {
      if (dialog.open) dialog.close();
      dialog.showModal();
    } else if (!modal) {
      if (alreadyModal) dialog.close();
      dialog.open = inlineOpen;
      drag.current = null;
      suppressHandleClick.current = false;
      backdropPointer.current = null;
      backdropClick.current = false;
      dialog.style.removeProperty("--coach-sheet-drag-offset");
      delete dialog.dataset.dragging;
    }
  }, [modal, inlineOpen]);

  useEffect(() => {
    const dialog = sheet.current;
    const viewport = window.visualViewport;
    if (!modal || !dialog || !viewport) return;
    function syncViewport() {
      if (!dialog || !viewport) return;
      dialog.style.setProperty("--coach-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--coach-viewport-bottom", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    }
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      dialog.style.removeProperty("--coach-viewport-height");
      dialog.style.removeProperty("--coach-viewport-bottom");
    };
  }, [modal]);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressHandleClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    const dialog = sheet.current;
    if (!start || start.id !== event.pointerId || !dialog) return;
    const delta = event.clientY - start.y;
    if (Math.abs(delta) < tapSlop && dialog.dataset.dragging === undefined) return;
    dialog.dataset.dragging = "";
    dialog.style.setProperty("--coach-sheet-drag-offset", `${size === "full" ? Math.max(0, delta) : delta}px`);
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    const dialog = sheet.current;
    if (dialog) {
      dialog.style.removeProperty("--coach-sheet-drag-offset");
      delete dialog.dataset.dragging;
    }
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const delta = event.clientY - start.y;
    suppressHandleClick.current = Math.abs(delta) >= tapSlop || Math.abs(event.clientX - start.x) >= tapSlop;
    cancelDrag(event);
    if (delta <= -dragThreshold && size === "half") onResize("full");
    if (delta >= dragThreshold) {
      if (size === "full") onResize("half");
      else onClose();
    }
  }

  const resizeLabel = size === "full" ? "收起 AI 教练" : "展开 AI 教练";
  return <dialog ref={sheet} className="coach-sheet" data-size={size}
    aria-label={modal ? "AI 教练" : undefined} role={modal ? undefined : "presentation"}
    onCancel={(event) => { if (modal) { event.preventDefault(); onClose(); } }}
    onPointerDown={(event) => {
      if (!event.isPrimary) return;
      backdropClick.current = false;
      backdropPointer.current = modal && event.button === 0 && isBackdrop(event) ? event.pointerId : null;
    }}
    onPointerUp={(event) => {
      if (!event.isPrimary) return;
      backdropClick.current = event.pointerId === backdropPointer.current && isBackdrop(event);
      backdropPointer.current = null;
    }}
    onPointerCancel={(event) => { if (event.pointerId === backdropPointer.current) backdropPointer.current = null; }}
    onClick={(event) => {
      if (modal && backdropClick.current && event.target === event.currentTarget) onClose();
      backdropClick.current = false;
    }}>
    {modal && <header className="coach-sheet-header">
      <h1 className="coach-sheet-title"><Sparkles size={19} aria-hidden="true" />AI 教练</h1>
      <button className="coach-sheet-handle" type="button" aria-label={resizeLabel} aria-expanded={size === "full"} title={resizeLabel}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
        onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
        onClick={(event) => {
          if (suppressHandleClick.current && event.detail > 0) {
            suppressHandleClick.current = false;
            return;
          }
          onResize(size === "full" ? "half" : "full");
        }}><span aria-hidden="true" /></button>
      <button className="coach-sheet-close" type="button" aria-label="关闭 AI 教练" title="关闭 AI 教练" onClick={onClose}>
        <X size={19} aria-hidden="true" />
      </button>
    </header>}
    <div className="coach-sheet-body">{children}</div>
  </dialog>;
}
