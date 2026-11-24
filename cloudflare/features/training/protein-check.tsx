"use client";

import { useId, useState } from "react";
import { CupSoda } from "lucide-react";
import { errorText } from "@/shared/client";
import { displayNumber } from "@/shared/ui";
import { defaultWorkoutProteinProduct, proteinServingNutrition, type ProteinProduct } from "./protein";

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
    {(product.powderEstimated || product.scoopEstimated) && <small>份量或营养含估算</small>}
  </span>;
}

export function ProteinProductSummary({ product }: { product: ProteinProduct }) {
  return <div className="protein-product-summary">
    <span className="protein-product-icon"><CupSoda size={17} aria-hidden="true" /></span>
    <ProductText product={product} />
  </div>;
}

export function ProteinCheck({ checked, save, label = "已喝蛋白粉", disabled = false, product, products, defaultProteinProductId }: {
  checked: boolean; save: (checked: boolean, product?: ProteinProduct) => void | Promise<void>;
  label?: string; disabled?: boolean; product?: ProteinProduct; products?: readonly ProteinProduct[];
  defaultProteinProductId?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [choiceId, setChoiceId] = useState("");
  const radioName = useId();
  const recipes = products ?? noProducts;
  const selected = recipes.find(({ id, powder }) => id === choiceId && powder) ??
    defaultWorkoutProteinProduct(recipes, defaultProteinProductId);
  const showChoices = recipes.length > 1 || (checked && recipes.length === 1 && recipes[0].id !== product?.id);
  const displayedProduct = checked ? product : selected;
  const needsChoice = !checked && recipes.length > 0 && !selected;

  async function change(value: boolean, next?: ProteinProduct) {
    setPending(true);
    setError("");
    try { await save(value, value ? next : undefined); }
    catch (reason) { setError(errorText(reason)); }
    finally { setPending(false); }
  }

  const choices = showChoices && <fieldset className="protein-product-choices" disabled={disabled || pending}>
    <legend>喝的是哪款？</legend>
    {recipes.map((choice) => {
      const snapshot = checked && product?.id === choice.id ? product : undefined;
      return <label className="protein-product-option" key={choice.id}>
        <input type="radio" name={radioName} checked={checked ? Boolean(snapshot) : choice.id === selected?.id}
          disabled={!choice.powder && !snapshot} onChange={() => {
            setChoiceId(choice.id);
            setError("");
            if (checked) void change(true, choice);
          }} />
        <ProductText product={snapshot ?? choice} />
        {!choice.powder && !snapshot && <small className="muted">需在仓库补充营养</small>}
      </label>;
    })}
  </fieldset>;

  return <div className="protein-check" aria-busy={pending}>
    <label className="toggle-label"><input type="checkbox" checked={checked}
      disabled={disabled || pending || needsChoice} onChange={(event) => void change(event.target.checked, selected)} /> {label}</label>
    {displayedProduct && <ProteinProductSummary product={displayedProduct} />}
    {products && !recipes.some(({ powder }) => powder) &&
      <p className="muted">在蛋白粉仓库保存带营养数据的配方后，勾选会自动记入饮食。</p>}
    {choices && (displayedProduct ? <details><summary>更换配方</summary>{choices}</details> : choices)}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
