"use client";

import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { mealTypes, type MealEntry } from "@/features/library/model";
import { useNutritionDictation } from "./use-nutrition-dictation";

export function NutritionVoice({ close, openSearch, initialMeal }: {
  close: () => void; openSearch: (meal: MealEntry["meal"], query: string) => void; initialMeal: MealEntry["meal"];
}) {
  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState("");
  const { listening, error, toggle } = useNutritionDictation(setQuery);

  return <Dialog title="语音记饮食" className="food-dialog" onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) openSearch(meal, query.trim()); }}>
      <div className="dialog-body form-fields">
        <label>餐次<select value={meal} onChange={(event) => setMeal(event.target.value as MealEntry["meal"])}>
          {mealTypes.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <button className="button outline" type="button" onClick={toggle}>{listening ? <Square size={17} /> : <Mic size={17} />}
          {listening ? "结束听写" : "开始听写"}</button>
        <p className="muted">听写由浏览器的语音服务处理。可以说「燕麦 60 克」。</p>
        <label>识别文字<input type="text" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} required /></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer"><button className="button primary" disabled={!query.trim()}>搜索并核对</button></div>
    </form>
  </Dialog>;
}
