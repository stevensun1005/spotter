"use client";

import { useState, type FormEvent } from "react";
import { Camera, Droplet, Package, Pencil, Plus, Scale } from "lucide-react";
import type { PersonalFood } from "@/features/library/model";
import { FoodPhoto } from "@/features/nutrition/food-photo";
import { maxProteinProducts, proteinProductSchema, proteinServingNutrition, type ProteinNutrition, type ProteinProduct } from "@/features/training/protein";
import { errorText } from "@/shared/client";
import { displayNumber } from "@/shared/ui";
import styles from "./protein-warehouse.module.css";

const nutrients = [
  { id: "calories", name: "热量", unit: "千卡", max: 1000 },
  { id: "protein", name: "蛋白质", unit: "g", max: 100 },
  { id: "carbs", name: "碳水", unit: "g", max: 100 },
  { id: "fat", name: "脂肪", unit: "g", max: 100 },
] as const;
type NutritionFields = Record<keyof ProteinNutrition, string>;
const blankNutrition: NutritionFields = { calories: "", protein: "", carbs: "", fat: "" };
const commonMixers = ["全脂牛奶", "低脂牛奶", "脱脂牛奶", "无糖豆奶", "燕麦奶", "杏仁奶", "椰子水"];
type ProteinEditor = {
  id: string; editing: boolean;
  name: string; scoopGrams: string; cupMl: string;
  powder?: NutritionFields;
  mixer?: { name: string; per100ml: NutritionFields };
};

function nutritionFields(nutrition: ProteinNutrition): NutritionFields {
  const { calories, protein, carbs, fat } = nutrition;
  return { calories: String(calories), protein: String(protein), carbs: String(carbs), fat: String(fat) };
}

function toNutrition(fields: NutritionFields): ProteinNutrition {
  const { calories, protein, carbs, fat } = fields;
  const amount = (value: string) => value === "" ? Number.NaN : Number(value);
  return { calories: amount(calories), protein: amount(protein), carbs: amount(carbs), fat: amount(fat) };
}

function NutritionInputs({ values, change, disabled }: {
  values: NutritionFields;
  change: (fields: NutritionFields) => void;
  disabled: boolean;
}) {
  return <div className={styles.amounts}>
    {nutrients.map(({ id, name, unit, max }) => <label key={id}>{name}（{unit}）
      <input required type="number" inputMode="decimal" step="any" min={0} max={max} disabled={disabled}
        value={values[id]} onChange={(event) => change({ ...values, [id]: event.target.value })} />
    </label>)}
  </div>;
}

export function ProteinWarehouse({ products, owner, personalFoods = [], disabled = false, save, onUseAgent }: {
  products: readonly ProteinProduct[];
  owner: string;
  personalFoods?: readonly PersonalFood[];
  disabled?: boolean;
  save: (products: ProteinProduct[]) => Promise<void>;
  onUseAgent?: () => void;
}) {
  const [editor, setEditor] = useState<ProteinEditor>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photo, setPhoto] = useState(false);
  const [reviewPhoto, setReviewPhoto] = useState(false);
  const locked = disabled || !owner || pending;
  const atLimit = products.length >= maxProteinProducts;
  const mixer = editor?.mixer;

  function open(product?: ProteinProduct, usePhoto = false) {
    setEditor(product ? {
      id: product.id, editing: true, name: product.name, scoopGrams: String(product.scoopGrams), cupMl: String(product.cupMl),
      powder: product.powder && nutritionFields(product.powder),
      mixer: product.mixer && { name: product.mixer.name, per100ml: nutritionFields(product.mixer.per100ml) },
    } : {
      id: crypto.randomUUID(), editing: false, name: "", scoopGrams: "", cupMl: "",
    });
    setError("");
    setNotice("");
    setConfirmRemove(false);
    setPhoto(usePhoto);
    setReviewPhoto(false);
  }

  function close() {
    setEditor(undefined);
    setError("");
    setConfirmRemove(false);
    setPhoto(false);
    setReviewPhoto(false);
  }

  async function persist(next: ProteinProduct[], success: string) {
    setPending(true);
    setError("");
    try {
      await save(next);
      close();
      setNotice(success);
    } catch (reason) {
      setError(errorText(reason, "仓库未保存，请稍后重试。"));
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || locked || confirmRemove || photo) return;
    const candidate = proteinProductSchema.safeParse({
      id: editor.id, name: editor.name, scoopGrams: Number(editor.scoopGrams), cupMl: Number(editor.cupMl),
      powder: editor.powder && toNutrition(editor.powder),
      mixer: editor.mixer && { name: editor.mixer.name, per100ml: toNutrition(editor.mixer.per100ml) },
    });
    if (!candidate.success) {
      setError("请核对产品名称、粉量、杯量及已选择填写的营养数据。");
    } else if (editor.editing && !products.some(({ id }) => id === editor.id)) {
      setError("这款蛋白粉已从仓库移除。你可以关闭编辑后重新添加。");
    } else if (!editor.editing && atLimit) {
      setError(`最多可保存 ${maxProteinProducts} 款蛋白粉。`);
    } else {
      const next = editor.editing ? products.map((product) => product.id === editor.id ? candidate.data : product)
        : [...products, candidate.data];
      void persist(next, editor.editing ? "已更新蛋白粉。" : "已添加蛋白粉。");
    }
  }

  return <div className={styles.warehouse} aria-busy={pending}>
    <div className={styles.toolbar}>
      <p className="muted">保存常喝的款式，训练结束时就能带入一勺的粉量、杯量和冲泡液体。</p>
      <div className={styles.addButtons}>
        <button className="button primary small" type="button" disabled={locked || Boolean(editor) || atLimit} onClick={() => open(undefined, true)}>
          <Camera size={17} aria-hidden="true" />拍照添加
        </button>
        <button className="button outline small" type="button" disabled={locked || Boolean(editor) || atLimit} onClick={() => open()}>
          <Plus size={17} aria-hidden="true" />手动添加
        </button>
      </div>
    </div>
    {!owner && <p className={styles.notice}>登录后可保存蛋白粉和冲泡设置。</p>}
    {atLimit && <p className={styles.notice}>仓库已保存 {maxProteinProducts} 款，可移除旧款后添加新款。</p>}

    {editor && <form className={`card form-fields ${styles.editor}`} key={editor.id} onSubmit={submit}>
      <h2>{photo ? "识别蛋白粉包装" : editor.editing ? "编辑蛋白粉" : "添加蛋白粉"}</h2>
      {photo ? <>
        <FoodPhoto owner={owner} destination="protein" onManual={() => setPhoto(false)} onApply={(draft) => {
          setEditor({ ...editor, name: draft.name, powder: nutritionFields(draft.per100g) });
          setReviewPhoto(true);
          setPhoto(false);
        }} />
        {onUseAgent && <p className={styles.notice}>也可以请自己的 AI 读取标签并存到我的食物库，再回仓库从食物库带入。</p>}
        <div className={styles.actions}>
          {onUseAgent && <button type="button" className="button outline small" onClick={onUseAgent}>用自己的 AI</button>}
          <button type="button" className="button outline small" onClick={close}>{editor.editing ? "取消编辑" : "取消添加"}</button>
        </div>
      </> : !confirmRemove ? <>
        {reviewPhoto && editor.powder && <p className={styles.notice} role="status">已填入包装名称和每 100 g 营养。请核对标签，再填写一勺的粉量和杯量。</p>}
        <label>产品名称<input autoFocus required maxLength={100} value={editor.name} disabled={locked}
          onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
        <div className={styles.amounts}>
          <label>一勺粉量
            <span className={styles.field}><input type="number" inputMode="decimal" step="any" min={0.1} max={250} required aria-label="一勺粉量（克）" value={editor.scoopGrams}
              disabled={locked} onChange={(event) => setEditor({ ...editor, scoopGrams: event.target.value })} /><span aria-hidden="true">g</span></span>
          </label>
          <label>一杯容量
            <span className={styles.field}><input type="number" inputMode="decimal" step="any" min={1} max={2000} required aria-label="一杯容量（毫升）" value={editor.cupMl}
              disabled={locked} onChange={(event) => setEditor({ ...editor, cupMl: event.target.value })} /><span aria-hidden="true">mL</span></span>
          </label>
        </div>
        <fieldset className={styles.group}>
          <legend>蛋白粉营养</legend>
          <label className="toggle-label"><input type="checkbox" checked={Boolean(editor.powder)} disabled={locked}
            onChange={(event) => setEditor({ ...editor, powder: event.target.checked ? blankNutrition : undefined })} />填写每 100 g 营养</label>
          {!editor.powder && <p className={styles.notice}>填写后可以按粉量和冲泡液体计算整杯营养。</p>}
          {editor.powder && <NutritionInputs values={editor.powder} disabled={locked} change={(powder) => setEditor({ ...editor, powder })} />}
          <button className="button outline small" type="button" disabled={locked}
            onClick={() => setPhoto(true)}><Camera size={16} aria-hidden="true" />{reviewPhoto ? "重新识别包装" : "识别包装营养表"}</button>
          {(personalFoods.length > 0 || onUseAgent) && <details className={styles.foodImport}>
            <summary>从我的食物库带入</summary>
            {onUseAgent && <p className={styles.notice}>请自己的 AI 把包装名称和每 100 g 营养存入我的食物库，再到这里选择。</p>}
            {personalFoods.length > 0 && <label>选择已保存的食物
              <select disabled={locked} value="" onChange={(event) => {
                const food = personalFoods.find(({ id }) => id === event.target.value);
                if (!food) return;
                setError("");
                setReviewPhoto(false);
                setEditor({ ...editor, name: food.name, powder: nutritionFields(food.per100g) });
              }}>
                <option value="" disabled>从我的食物库选择</option>
                {personalFoods.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>}
            {onUseAgent && <button className="button outline small" type="button" disabled={locked} onClick={onUseAgent}>用自己的 AI</button>}
          </details>}
        </fieldset>
        <fieldset className={styles.group}>
          <legend>默认冲泡液体</legend>
          <label className="sr-only" htmlFor="protein-warehouse-mixer">默认冲泡液体</label>
          <select id="protein-warehouse-mixer" value={mixer ? "custom" : "water"} disabled={locked}
            onChange={(event) => setEditor({ ...editor, mixer: event.target.value === "custom" ? { name: "", per100ml: blankNutrition } : undefined })}>
            <option value="water">清水</option>
            <option value="custom">牛奶、植物奶或其他饮品</option>
          </select>
          {mixer && <>
            <label>液体名称<input required maxLength={60} value={mixer.name} list="protein-common-mixers" placeholder="例如 全脂牛奶" disabled={locked}
              onChange={(event) => setEditor({ ...editor, mixer: { ...mixer, name: event.target.value } })} /></label>
            <datalist id="protein-common-mixers">{commonMixers.map((name) => <option key={name} value={name} />)}</datalist>
            <p className={styles.notice}>填写标签上每 100 mL 的营养数值。</p>
            <NutritionInputs values={mixer.per100ml} disabled={locked}
              change={(per100ml) => setEditor({ ...editor, mixer: { ...mixer, per100ml } })} />
          </>}
        </fieldset>
        <div className={styles.actions}>
          {editor.editing && <button type="button" className={styles.remove} disabled={locked}
            onClick={() => { setError(""); setConfirmRemove(true); }}>移除</button>}
          <button type="button" className="button outline small" disabled={pending} onClick={close}>取消</button>
          <button type="submit" className="button primary small" disabled={locked}>{pending ? "保存中…" : "保存"}</button>
        </div>
      </> : <>
        <p>从仓库移除「{editor.name}」？之前的训练记录会保留。</p>
        <div className={styles.actions}>
          <button type="button" className="button outline small" disabled={pending}
            onClick={() => { setError(""); setConfirmRemove(false); }}>返回编辑</button>
          <button type="button" className={`button outline small ${styles.danger}`} disabled={locked}
            onClick={() => void persist(products.filter(({ id }) => id !== editor.id), "已从仓库移除。")}>{pending ? "移除中…" : "确认移除"}</button>
        </div>
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </form>}

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {products.length ? <ul className={styles.products} aria-label="已保存的蛋白粉">{products.map((product) => {
      const serving = proteinServingNutrition(product);
      return <li className={`card ${styles.product}`} key={product.id}>
        <span className={styles.icon}><Package size={21} aria-hidden="true" /></span>
        <div>
          <strong>{product.name}</strong>
          <dl className={styles.metrics}>
            <div><dt><Scale size={13} aria-hidden="true" />一勺</dt><dd>{product.scoopGrams} g</dd></div>
            <div><dt><Droplet size={13} aria-hidden="true" />一杯</dt><dd>{product.cupMl} mL {product.mixer?.name ?? "清水"}</dd></div>
          </dl>
        </div>
        <button type="button" className={`icon-button ${styles.edit}`} aria-label={`编辑${product.name}`}
          disabled={locked || Boolean(editor)} onClick={() => open(product)}><Pencil size={17} aria-hidden="true" /></button>
        {serving && <div className={styles.serving}>
          <p>每杯营养</p>
          <dl aria-label="每杯营养">{nutrients.map(({ id, name, unit }) =>
            <div key={id}><dt>{name}</dt><dd>{displayNumber(serving[id])} <span>{unit}</span></dd></div>
          )}</dl>
        </div>}
      </li>;
    })}</ul> : !editor && !disabled && <p className={`card ${styles.empty}`}>仓库里还没有蛋白粉。</p>}
  </div>;
}
