"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/shared/ui";
import { ProteinProductSummary } from "@/features/training/protein-check";
import type { ProteinProduct } from "@/features/training/protein";
import { saveExistingProtein } from "./coach-protein-save";

export function ProteinDrink({ products, date, owner, close, warehouse, saved }: {
  products: readonly ProteinProduct[]; date: string; owner: string; close: () => void;
  warehouse?: () => void; saved: () => void;
}) {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const recordable = products.filter(({ powder }) => powder);
  const selected = recordable.length === 1 ? recordable[0] : recordable.find(({ id }) => id === selectedId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !selected || !owner) return;
    setPending(true);
    setError("");
    try {
      const reply = await saveExistingProtein({ action: "record-saved", expectedOwner: owner, recordId: id,
        localDate: date, text: "我喝了蛋白粉", productId: selected.id, ...(duplicate ? { anotherCup: true as const } : {}) });
      if (reply.status !== "complete") {
        setError(reply.status === "clarify" ? reply.message : "仓库已更新，请重新选择一款。");
      } else if (reply.records[0]?.alreadyRecorded) {
        setDuplicate(true);
      } else {
        saved();
        close();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "这杯蛋白粉还没保存，请重试。"); }
    finally { setPending(false); }
  }
  return <Dialog title="记录一杯蛋白粉" onClose={() => { if (!pending) close(); }}>
    <form onSubmit={submit}>
      <div className="dialog-body feature-stack">
        <p className="muted">{date} · 加餐</p>
        {recordable.length === 0 ? <p>请先在蛋白粉仓库添加产品和包装营养。</p>
          : recordable.length === 1 ? <ProteinProductSummary product={recordable[0]} />
          : <fieldset className="protein-product-choices" disabled={pending}>
            <legend>喝的是哪款？</legend>
            {recordable.map((product) => <label key={product.id} className="protein-product-option">
              <input type="radio" name="protein-drink" checked={product.id === selectedId} onChange={() => {
                setSelectedId(product.id); setId(crypto.randomUUID()); setDuplicate(false); setError("");
              }} />
              <ProteinProductSummary product={product} />
            </label>)}
          </fieldset>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {duplicate && <p className="muted" role="status">饮食记录或训练打卡里已有这杯。</p>}
      </div>
      <div className="dialog-footer">
        {!recordable.length && warehouse
          ? <button type="button" className="button primary" onClick={warehouse}>打开蛋白粉仓库</button>
          : <button type="submit" className="button primary" disabled={!selected || pending}>{pending ? "保存中…" :
            duplicate ? "确实喝了另一杯，继续记" : "记录一杯"}</button>}
      </div>
    </form>
  </Dialog>;
}
