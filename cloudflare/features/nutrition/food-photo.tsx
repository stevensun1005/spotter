"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImageUp, WandSparkles } from "lucide-react";
import { useAnthropicSharing } from "@/features/ai-coach/sharing-consent";
import { errorText } from "@/shared/client";
import { fetchFoodPhotoConfiguration, photoRetryMessage, recognizeLabelPhoto, recognizeMealPhoto, recognizeProteinPhoto,
  validatePhotoFile } from "./food-photo-client";
import type { FoodPhotoDraft, MealPhotoDraft, ProteinPhotoProduct } from "./food-photo-model";
import { maxPhotoNoteLength } from "./food-photo-request";

const unavailable = "这个账号暂未启用站内 AI 识别，可以直接手动记录。";

type FoodPhotoProps = {
  owner: string;
  onBack?: () => void;
  onManual?: () => void;
} & ({
  onApply: (draft: FoodPhotoDraft) => void;
  onMeal?: (draft: MealPhotoDraft) => void;
  onProtein?: never;
} | {
  onApply?: never;
  onMeal?: never;
  onProtein: (product: ProteinPhotoProduct) => void;
});

export function FoodPhoto(props: FoodPhotoProps) {
  return <FoodPhotoForm key={props.owner} {...props} />;
}

function FoodPhotoForm({ owner, onApply, onBack, onManual, onMeal, onProtein }: FoodPhotoProps) {
  const [photo, setPhoto] = useState<string>();
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [configuration, setConfiguration] = useState<{ enabled: boolean; error?: string }>();
  const [retry, setRetry] = useState(0);
  const preview = useRef<HTMLImageElement>(null);
  const active = useRef<AbortController | undefined>(undefined);
  const { withConsent, prompt: sharingPrompt } = useAnthropicSharing(owner);

  useEffect(() => {
    const controller = new AbortController();
    void fetchFoodPhotoConfiguration(owner, controller.signal).then((enabled) => {
      if (!controller.signal.aborted) setConfiguration({ enabled });
    }).catch((reason) => {
      if (!controller.signal.aborted) setConfiguration({ enabled: false, error: errorText(reason, photoRetryMessage) });
    });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [owner, retry]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  function pickPhoto(file?: File) {
    if (!file || busy) return;
    setNeeds([]);
    setError("");
    setReady(false);
    try {
      validatePhotoFile(file);
      setPhoto(URL.createObjectURL(file));
    } catch (reason) {
      setPhoto(undefined);
      setError(errorText(reason, "照片无法读取，请重新选择。"));
    }
  }

  function recognize() {
    const picture = preview.current;
    if (!configuration?.enabled || !picture || !ready || active.current) return;
    withConsent(() => { if (preview.current === picture) void sendPhoto(picture); });
  }

  async function sendPhoto(picture: HTMLImageElement) {
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setNeeds([]);
    try {
      if (onMeal) {
        const result = await recognizeMealPhoto(picture, notes, owner, controller.signal);
        if (result.kind === "needs") setNeeds(result.needs);
        else onMeal(result.draft);
      } else if (onProtein) {
        const result = await recognizeProteinPhoto(picture, owner, controller.signal);
        if (result.kind === "needs") setNeeds(result.needs);
        else onProtein(result.product);
      } else {
        const result = await recognizeLabelPhoto(picture, notes, owner, controller.signal);
        if (result.kind === "needs") setNeeds(result.needs);
        else onApply(result.draft);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorText(reason, photoRetryMessage));
    } finally {
      if (active.current === controller) {
        active.current = undefined;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  }

  function cancelRecognition() {
    active.current?.abort();
    active.current = undefined;
    setBusy(false);
  }

  const pickers = <div className="food-photo-pickers">
    <label className="button outline"><Camera size={17} aria-hidden="true" /> {needs.length ? "重新拍照" : "拍照"}
      <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={busy}
        onChange={(event) => { pickPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    </label>
    <label className="button outline"><ImageUp size={17} aria-hidden="true" /> {needs.length ? "换一张照片" : "从相册选择"}
      <input className="sr-only" type="file" accept="image/*" disabled={busy}
        onChange={(event) => { pickPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    </label>
  </div>;

  return <div className="form-fields">
    {onBack && <button className="text-button food-back" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> 返回食物库</button>}
    <p className="muted">{onMeal ? "拍下整份餐食。站内 AI 会估算食物、份量和营养，核对后即可保存。"
      : onProtein ? "可先拍包装正面读取品名，也可拍背面的营养表和每勺重量。"
      : "拍清楚包装品名和营养表。站内 AI 会读取每 100 克的营养，核对后可存入食物库。"}</p>
    {!configuration && <p role="status" className="muted">正在检查站内 AI…</p>}
    {configuration?.enabled ? <>
      {!needs.length && pickers}
      {photo && <img key={photo} className="food-photo-preview" ref={preview} src={photo} alt={onMeal ? "待识别的餐食照片" : "待识别的包装照片"}
        onLoad={() => setReady(true)} onError={() => { setReady(false); setError("这张照片无法读取，可以重拍或选择另一张。"); }} />}
      {!onProtein && (onMeal || needs.length > 0) && <label>{onMeal ? "补充份量（选填）" : "补充包装信息（选填）"}
        <textarea rows={2} maxLength={maxPhotoNoteLength} disabled={busy} value={notes}
          placeholder={onMeal ? "如米饭约 150 克，吃了照片里的半份" : "如每份 30 克"}
          onChange={(event) => setNotes(event.currentTarget.value)} />
      </label>}
      {needs.length > 0 && <>
        <div className="muted" role="status">
          <strong>{onProtein ? "请换一张更清楚的包装照片，或直接填写" : "还需补充信息或重拍"}</strong>
          <ul>{needs.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
        {pickers}
      </>}
      {busy && <p className="sr-only" role="status">正在识别照片。</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <p className="muted">{onProtein ? "点击识别后，Claude 只会收到这张包装照片。"
        : "点击识别后，AI 教练使用的 Claude 服务只会收到这张照片和你填写的备注。"}</p>
      <div className="food-alternatives">
        <button className="button primary" type="button" disabled={!ready || busy} onClick={recognize}>
          <WandSparkles size={17} aria-hidden="true" /> {busy ? "正在识别…" : needs.length ? "重新识别" : "识别照片"}
        </button>
        {busy ? <button className="text-button" type="button" onClick={cancelRecognition}>取消识别</button>
          : onManual && <button className="text-button" type="button" onClick={onManual}>手动填写</button>}
      </div>
    </> : configuration && <>
      <p className="muted" role="status">{configuration.error ?? unavailable}</p>
      <div className="food-alternatives">
        {configuration.error && <button className="button outline" type="button" onClick={() => { setConfiguration(undefined); setRetry(retry + 1); }}>重试</button>}
        {onManual && <button className="text-button" type="button" onClick={onManual}>手动填写</button>}
      </div>
    </>}
    {sharingPrompt}
  </div>;
}
