"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Copy, ImageUp } from "lucide-react";
import { foodPhotoPrompt, parseFoodPhotoResult, type FoodPhotoDraft } from "./food-photo-model";

export function FoodPhoto({ onApply, onBack }: {
  onApply: (draft: FoodPhotoDraft) => void;
  onBack: () => void;
}) {
  const [photo, setPhoto] = useState<{ file: File; url: string }>();
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  function pickPhoto(file?: File) {
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    setPreviewVisible(true);
    setShareNote("");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(foodPhotoPrompt);
      setCopied(true);
    } catch {
      setPromptVisible(true);
    }
  }

  async function sharePhoto() {
    if (!photo || sharing) return;
    setSharing(true);
    setShareNote("");
    try {
      await navigator.share({ files: [photo.file], text: foodPhotoPrompt });
    } catch (reason) {
      if (!(reason instanceof DOMException) || reason.name !== "AbortError") {
        setShareNote("请打开你常用的 AI，从相册上传这张照片。");
      }
    } finally {
      setSharing(false);
    }
  }

  function apply() {
    const parsed = parseFoodPhotoResult(result);
    if ("draft" in parsed) onApply(parsed.draft);
    else setError(parsed.error);
  }

  const canShare = photo && typeof navigator !== "undefined" &&
    typeof navigator.share === "function" && navigator.canShare?.({ files: [photo.file] });

  return <div className="form-fields">
    <button className="text-button food-back" type="button" onClick={onBack}><ArrowLeft size={17} /> 返回食物库</button>
    <p className="muted">拍清楚食品名和营养表。复制提示词，把照片发给你常用的 AI，再将它返回的 JSON 粘贴到下方。</p>
    <label>拍摄或选取包装照片<input type="file" accept="image/*" capture="environment" onChange={(event) => pickPhoto(event.target.files?.[0])} /></label>
    {photo && previewVisible && <img src={photo.url} alt="所选食品包装照片" onError={() => setPreviewVisible(false)}
      style={{ maxHeight: 180, width: "100%", objectFit: "contain", borderRadius: 10 }} />}
    <div className="food-alternatives">
      <button className="button outline" type="button" onClick={() => void copyPrompt()}><Copy size={16} /> {copied ? "已复制提示词" : "复制提示词"}</button>
      {canShare && <button className="button outline" type="button" disabled={sharing} onClick={() => void sharePhoto()}><ImageUp size={16} /> 打开系统分享</button>}
      {photo && !canShare && <a className="text-button" href={photo.url} download={photo.file.name || "食品包装照片"}>下载照片</a>}
    </div>
    {copied && <p className="muted" role="status">已复制。发照片时把提示词一起粘贴给 AI。</p>}
    {shareNote && <p className="muted" role="status">{shareNote}</p>}
    <details open={promptVisible} onToggle={(event) => setPromptVisible(event.currentTarget.open)}>
      <summary>查看提示词</summary>
      <label>营养标签识别提示词<textarea value={foodPhotoPrompt} rows={5} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
    </details>
    <label>粘贴 AI 返回的 JSON<textarea rows={4} maxLength={3600} value={result} onChange={(event) => { setResult(event.target.value); setError(""); }} /></label>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="button primary" type="button" disabled={!result.trim()} onClick={apply}>检查并填入</button>
  </div>;
}
