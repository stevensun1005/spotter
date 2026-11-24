"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImageUp, WandSparkles } from "lucide-react";
import { errorText } from "@/shared/client";
import { foodPhotoDraftSchema, mealPhotoDraftSchema, photoNeedsSchema, type FoodPhotoDraft, type MealPhotoDraft } from "./food-photo-model";
import { maxPhotoBase64Length, maxPhotoNoteLength } from "./food-photo-request";

const photoEndpoint = "/api/food-photo";
const unavailable = "这个账号暂未启用站内 AI 识别，可以直接手动记录。";
const retryMessage = "暂时无法识别照片，请稍后重试。";

function encodePhoto(photo: HTMLImageElement) {
  const { naturalWidth: width, naturalHeight: height } = photo;
  if (!width || !height) throw new Error("照片无法读取，请重新拍摄或选择一张 JPG 或 PNG。");
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("此浏览器无法处理图片，可以手动记录。");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  // Encoding the pixels makes a new JPEG without the source file name, EXIF or GPS tags.
  let data = canvas.toDataURL("image/jpeg", 0.88);
  if (data.length > maxPhotoBase64Length) data = canvas.toDataURL("image/jpeg", 0.68);
  const prefix = "data:image/jpeg;base64,";
  const base64 = data.startsWith(prefix) ? data.slice(prefix.length) : "";
  if (!base64 || base64.length > maxPhotoBase64Length) throw new Error("照片太大，请重拍并让食物或营养表填满画面。");
  return { mediaType: "image/jpeg" as const, base64 };
}

export function FoodPhoto({ owner, onApply, onBack, onManual, onMeal }: {
  owner: string;
  onApply: (draft: FoodPhotoDraft) => void;
  onBack?: () => void;
  onManual: () => void;
  onMeal?: (draft: MealPhotoDraft) => void;
}) {
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

  useEffect(() => {
    const controller = new AbortController();
    void fetch(photoEndpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const result = await response.json() as { enabled?: boolean; owner?: string; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || retryMessage);
      if (result.owner && result.owner !== owner) {
        setConfiguration({ enabled: false, error: "登录账号已切换，请刷新后再识别。" });
      } else {
        setConfiguration({ enabled: Boolean(owner && result.enabled) });
      }
    }).catch((reason) => {
      if (!controller.signal.aborted) setConfiguration({ enabled: false, error: errorText(reason, retryMessage) });
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
    if (!file.size || file.size > 24 * 1024 * 1024 || (file.type && !file.type.startsWith("image/"))) {
      setPhoto(undefined);
      setError("请选择 24 MB 以内的图片。");
      return;
    }
    setPhoto(URL.createObjectURL(file));
  }

  async function recognize() {
    if (!configuration?.enabled || !preview.current || !ready || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setNeeds([]);
    try {
      const response = await fetch(photoEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ expectedOwner: owner, mode: onMeal ? "meal" : "label", image: encodePhoto(preview.current), notes: notes.trim() }),
      });
      const result = await response.json().catch(() => null) as { draft?: unknown; needs?: string[]; error?: string } | null;
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result?.error || retryMessage);
      const details = photoNeedsSchema.safeParse(result);
      if (details.success) {
        setNeeds(details.data.needs);
        return;
      }
      if (onMeal) {
        const parsed = mealPhotoDraftSchema.safeParse(result?.draft);
        if (!parsed.success || parsed.data.grams === undefined) throw new Error("缺少可用的份量或营养估算，请补充份量后重试。");
        onMeal(parsed.data);
      } else {
        const parsed = foodPhotoDraftSchema.safeParse(result?.draft);
        if (!parsed.success) throw new Error("无法从图片读取完整的营养表，请对准包装标签重拍。");
        onApply(parsed.data);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorText(reason, retryMessage));
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

  return <div className="form-fields">
    {onBack && <button className="text-button food-back" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> 返回食物库</button>}
    <p className="muted">{onMeal ? "拍下整份餐食。站内 AI 会估算食物、份量和营养，核对后即可保存。" : "拍清楚包装品名和营养表。站内 AI 会读取每 100 克的营养，核对后可存入食物库。"}</p>
    {!configuration && <p role="status" className="muted">正在检查站内 AI…</p>}
    {configuration?.enabled ? <>
      <div className="food-photo-pickers">
        <label className="button outline"><Camera size={17} aria-hidden="true" /> 拍照
          <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={busy}
            onChange={(event) => { pickPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
        <label className="button outline"><ImageUp size={17} aria-hidden="true" /> 从相册选择
          <input className="sr-only" type="file" accept="image/*" disabled={busy}
            onChange={(event) => { pickPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
      </div>
      {photo && <img key={photo} className="food-photo-preview" ref={preview} src={photo} alt={onMeal ? "待识别的餐食照片" : "待识别的包装照片"}
        onLoad={() => setReady(true)} onError={() => { setReady(false); setError("这张照片无法读取，可以重拍或选择另一张。"); }} />}
      {(onMeal || needs.length > 0) && <label>{onMeal ? "补充份量（选填）" : "补充包装信息（选填）"}
        <textarea rows={2} maxLength={maxPhotoNoteLength} disabled={busy} value={notes}
          placeholder={onMeal ? "如米饭约 150 克，吃了照片里的半份" : "如每份 30 克"}
          onChange={(event) => setNotes(event.currentTarget.value)} />
      </label>}
      {needs.length > 0 && <p className="muted" role="status">还需补充或重拍 {needs.join("、")}。</p>}
      {busy && <p className="sr-only" role="status">正在识别照片。</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <p className="muted">点击识别后，AI 教练使用的 Claude 服务只会收到这张照片和你填写的备注。</p>
      <div className="food-alternatives">
        <button className="button primary" type="button" disabled={!ready || busy} onClick={() => void recognize()}>
          <WandSparkles size={17} aria-hidden="true" /> {busy ? "正在识别…" : needs.length ? "重新识别" : "识别照片"}
        </button>
        {busy ? <button className="text-button" type="button" onClick={cancelRecognition}>取消识别</button>
          : <button className="text-button" type="button" onClick={onManual}>手动填写</button>}
      </div>
    </> : configuration && <>
      <p className="muted" role="status">{configuration.error ?? unavailable}</p>
      <div className="food-alternatives">
        {configuration.error && <button className="button outline" type="button" onClick={() => { setConfiguration(undefined); setRetry(retry + 1); }}>重试</button>}
        <button className="text-button" type="button" onClick={onManual}>手动填写</button>
      </div>
    </>}
  </div>;
}
