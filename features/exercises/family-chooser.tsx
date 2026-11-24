"use client";

import { useState, type FormEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { tricepsVariantGroup, variantDetails, type ExerciseFamily } from "./catalog-families";
import type { CatalogEntry } from "./open-gym";
import { label as translate } from "./labels";

export function FamilyVariantOptions({ variants, family }: { variants: readonly CatalogEntry[]; family: ExerciseFamily }) {
  const groups = new Map<string, CatalogEntry[]>();
  for (const row of variants) {
    const key = family.id === "cable-triceps" ? tricepsVariantGroup(row) : translate(row.equipment);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  function option(row: CatalogEntry) {
    return <option key={row.id} value={row.id}>{variantDetails(row, family).label}</option>;
  }
  return groups.size > 1
    ? [...groups].map(([name, rows]) => <optgroup key={name} label={name}>{rows.map(option)}</optgroup>)
    : variants.map(option);
}

export function FamilyChooser({ family, initial, variants, onClose, onChoose, inline = false }: {
  family: ExerciseFamily;
  initial: CatalogEntry;
  variants: readonly CatalogEntry[];
  onClose: () => void;
  onChoose: (row: CatalogEntry) => void;
  inline?: boolean;
}) {
  const [id, setId] = useState(initial.id);
  const selected = variants.find((row) => row.id === id) ?? variants[0];

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (selected) onChoose(selected);
  }

  const form = <form onSubmit={confirm}>
    <div className="dialog-body form-fields family-chooser-fields">
      {family.note && <p className="muted">{family.note}</p>}
      <label>动作变式
        <select autoFocus={inline} value={selected?.id ?? ""} onChange={(event) => setId(event.target.value)} disabled={!selected}>
          {!selected && <option value="">暂无符合筛选的变式</option>}
          <FamilyVariantOptions variants={variants} family={family} />
        </select>
      </label>
      {selected && <div className="family-chooser-preview" aria-live="polite" aria-atomic="true">
        <strong>{selected.name}</strong>
        <p>{variantDetails(selected, family).tip}</p>
      </div>}
    </div>
    <div className="dialog-footer">
      <button type="submit" className="button primary" disabled={!selected}>使用这个变式</button>
    </div>
  </form>;

  if (inline) return <section className="card family-chooser-inline" aria-label={family.title}>
    <div className="family-chooser-heading">
      <button type="button" className="button subtle small" onClick={onClose}><ChevronLeft size={16} /> 返回动作库</button>
      <h3>{family.title}</h3>
    </div>
    {form}
  </section>;

  return <Dialog title={family.title} className="family-chooser-dialog" onClose={onClose}>{form}</Dialog>;
}
