"use client";

import { useId, useState } from "react";
import { CupSoda } from "lucide-react";
import { errorText } from "@/shared/client";
import { displayNumber } from "@/shared/ui";
import { proteinServingNutrition, type ProteinProduct } from "./protein";

const noProducts: readonly ProteinProduct[] = [];

function ProductText({ product }: { product: ProteinProduct }) {
  const nutrition = proteinServingNutrition(product);
  return <span className="protein-product-text">
    <strong>{product.name}</strong>
    <small><span>1 勺 · {product.scoopGrams} g</span><span>{product.mixer?.name ?? "水"} {product.cupMl} mL</span></small>
    {nutrition && <small>
      <span>{displayNumber(nutrition.calories)} 千卡</span>
      <span>蛋白质 {displayNumber(nutrition.protein)} g</span>
      <span>碳水 {displayNumber(nutrition.carbs)} g</span>
      <span>脂肪 {displayNumber(nutrition.fat)} g</span>
    </small>}
  </span>;
}

export function ProteinProductSummary({ product }: { product: ProteinProduct }) {
  return <div className="protein-product-summary">
    <span className="protein-product-icon"><CupSoda size={17} aria-hidden="true" /></span>
    <ProductText product={product} />
  </div>;
}

export function ProteinCheck({ checked, save, label = "已喝蛋白粉", disabled = false, product, products = noProducts }: {
  checked: boolean; save: (checked: boolean, product?: ProteinProduct) => void | Promise<void>;
  label?: string; disabled?: boolean; product?: ProteinProduct; products?: readonly ProteinProduct[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [choiceId, setChoiceId] = useState("");
  const radioName = useId();
  const selected = products.length === 1 ? products[0] : products.find(({ id }) => id === choiceId);
  const showChoices = products.length > 1 || (checked && products.length === 1 && selected?.id !== product?.id);
  const displayedProduct = checked ? product : selected;
  const needsChoice = !checked && showChoices && !selected;

  async function change(value: boolean, next?: ProteinProduct) {
    setPending(true);
    setError("");
    try { await save(value, value ? next : undefined); }
    catch (reason) { setError(errorText(reason)); }
    finally { setPending(false); }
  }

  return <div className="protein-check" aria-busy={pending}>
    <label className="toggle-label"><input type="checkbox" checked={checked}
      disabled={disabled || pending || needsChoice} onChange={(event) => void change(event.target.checked, selected)} /> {label}</label>
    {displayedProduct && (!showChoices || !products.some(({ id }) => id === displayedProduct.id)) &&
      <ProteinProductSummary product={displayedProduct} />}
    {showChoices && <fieldset className="protein-product-choices" disabled={disabled || pending}>
      <legend>喝的是哪款？</legend>
      {products.map((choice) => {
        const snapshot = checked && product?.id === choice.id ? product : undefined;
        return <label className="protein-product-option" key={choice.id}>
          <input type="radio" name={radioName} checked={checked ? Boolean(snapshot) : choice.id === selected?.id}
            onChange={() => {
              setChoiceId(choice.id);
              setError("");
              if (checked) void change(true, choice);
            }} />
          <ProductText product={snapshot ?? choice} />
        </label>;
      })}
    </fieldset>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
