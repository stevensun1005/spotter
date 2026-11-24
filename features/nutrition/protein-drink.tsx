"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/shared/ui";
import { errorText } from "@/shared/client";
import { ProteinProductSummary } from "@/features/training/protein-check";
import { proteinMeal } from "@/features/training/protein-nutrition";
import type { ProteinProduct } from "@/features/training/protein";

type ProteinMeal = NonNullable<ReturnType<typeof proteinMeal>>;

export function ProteinDrink({ products, date, close, warehouse, save }: {
  products: readonly ProteinProduct[]; date: string; close: () => void;
  warehouse?: () => void; save: (record: ProteinMeal) => Promise<void>;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const recordable = products.filter(({ powder }) => powder);
  const selected = recordable.length === 1 ? recordable[0] : recordable.find(({ id }) => id === selectedId);
  const record = selected ? proteinMeal(selected, date, id) : undefined;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !record) return;
    setPending(true);
    setError("");
    try { await save(record); close(); }
    catch (reason) { setError(errorText(reason, "这杯蛋白粉还没保存，请重试。")); }
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
              <input type="radio" name="protein-drink" checked={product.id === selectedId} onChange={() => setSelectedId(product.id)} />
              <ProteinProductSummary product={product} />
            </label>)}
          </fieldset>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer">
        {!recordable.length && warehouse
          ? <button type="button" className="button primary" onClick={warehouse}>打开蛋白粉仓库</button>
          : <button type="submit" className="button primary" disabled={!record || pending}>{pending ? "保存中…" : "记录一杯"}</button>}
      </div>
    </form>
  </Dialog>;
}
