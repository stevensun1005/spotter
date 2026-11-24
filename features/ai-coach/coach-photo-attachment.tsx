"use client";

import { useEffect, useRef, type ChangeEvent, type RefObject } from "react";
import { Camera, ImagePlus, Mic, Square, X } from "lucide-react";
import { mealTypes, type MealEntry } from "@/features/library/model";
import { useNutritionDictation } from "@/features/nutrition/use-nutrition-dictation";

export function CoachPhotoPickers({ cameraInput, disabled, onPick, onFile }: {
  cameraInput: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onPick: () => void;
  onFile: (file: File) => void;
}) {
  const galleryInput = useRef<HTMLInputElement>(null);
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onFile(file);
  }
  return <>
    <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={choose} disabled={disabled} hidden />
    <input ref={galleryInput} type="file" accept="image/*" onChange={choose} disabled={disabled} hidden />
    <button className="coach-quick-button" type="button" disabled={disabled}
      onClick={() => { onPick(); cameraInput.current?.click(); }}><Camera size={16} aria-hidden="true" />拍照</button>
    <button className="coach-quick-button" type="button" disabled={disabled}
      onClick={() => { onPick(); galleryInput.current?.click(); }}><ImagePlus size={16} aria-hidden="true" />相册</button>
  </>;
}

export function CoachPhotoAttachment({ file, meal, active, disabled, onMeal, onRemove, onDictate, onFocus }: {
  file: File;
  meal: MealEntry["meal"];
  active: boolean;
  disabled: boolean;
  onMeal: (meal: MealEntry["meal"]) => void;
  onRemove: () => void;
  onDictate: (text: string) => void;
  onFocus: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const { listening, error, toggle } = useNutritionDictation(onDictate, active && !disabled);
  useEffect(() => {
    const preview = image.current;
    if (!preview) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <div className="coach-photo-attachment">
    {/* The selected local file stays in the browser until the user sends it. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={image} alt="所选照片预览" width={52} height={52} />
    <div className="coach-photo-actions">
      <label>记入
        <select value={meal} disabled={disabled} onChange={(event) => onMeal(event.target.value as MealEntry["meal"])}>
          {mealTypes.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <button className="coach-quick-button" type="button" disabled={disabled} aria-pressed={listening}
        onClick={() => { if (!listening) onFocus(); toggle(); }}>
        {listening ? <Square size={14} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
        {listening ? "结束听写" : "说份量"}
      </button>
    </div>
    <button className="icon-button coach-photo-remove" type="button" disabled={disabled} onClick={onRemove} aria-label="移除照片">
      <X size={16} aria-hidden="true" />
    </button>
    {error && <p className="coach-composer-notice" role="status">{error}</p>}
  </div>;
}
