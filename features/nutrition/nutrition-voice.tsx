"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { mealTypes, type MealEntry } from "@/features/library/model";

interface Recognition {
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function NutritionVoice({ close, openSearch, initialMeal }: {
  close: () => void; openSearch: (meal: MealEntry["meal"], query: string) => void; initialMeal: MealEntry["meal"];
}) {
  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Recognition | undefined>(undefined);
  useEffect(() => () => {
    const recognition = current.current;
    if (!recognition) return;
    recognition.onresult = recognition.onerror = recognition.onend = null;
    recognition.abort();
  }, []);

  function dictate() {
    if (listening) { current.current?.stop(); return; }
    const browser = window as SpeechWindow;
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Speech) { setError("可用手机键盘的听写功能，或直接填写下面的食物名称。"); return; }
    try {
      const recognition = new Speech();
      recognition.lang = "zh-CN";
      recognition.onresult = (event) => setQuery((event.results[0]?.[0]?.transcript ?? "").trim().replace(/[。！？!?]$/u, ""));
      recognition.onerror = (event) => setError(event.error === "not-allowed" ? "麦克风权限未开启，可用键盘听写或手动输入。" : "未能听清，请重试或直接输入。");
      recognition.onend = () => { current.current = undefined; setListening(false); };
      recognition.start();
      current.current = recognition;
      setError("");
      setListening(true);
    } catch { setError("此浏览器无法启动听写，可直接输入食物名称。"); }
  }

  return <Dialog title="语音记饮食" className="food-dialog" onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) openSearch(meal, query.trim()); }}>
      <div className="dialog-body form-fields">
        <label>餐次<select value={meal} onChange={(event) => setMeal(event.target.value as MealEntry["meal"])}>
          {mealTypes.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <button className="button outline" type="button" onClick={dictate}>{listening ? <Square size={17} /> : <Mic size={17} />}
          {listening ? "结束听写" : "开始听写"}</button>
        <p className="muted">听写由浏览器的语音服务处理。可以说「燕麦 60 克」。</p>
        <label>识别文字<input type="text" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} required /></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="dialog-footer"><button className="button primary" disabled={!query.trim()}>搜索并核对</button></div>
    </form>
  </Dialog>;
}
