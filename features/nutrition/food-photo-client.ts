import { foodPhotoDraftSchema, mealPhotoDraftSchema, photoNeedsSchema, proteinPhotoProductSchema,
  type FoodPhotoDraft, type MealPhotoDraft, type ProteinPhotoProduct } from "./food-photo-model";
import { maxPhotoBase64Length, type FoodPhotoRequest } from "./food-photo-request";
import type { CoachQuota } from "@/features/ai-coach/model";

const photoEndpoint = "/api/food-photo";
const unreadablePhoto = "照片无法读取，请重新拍摄或选择一张 JPG 或 PNG。";
export const photoRetryMessage = "暂时无法识别照片，请稍后重试。";

type PhotoSource = File | HTMLImageElement;
type EncodedPhoto = FoodPhotoRequest["image"];
type PhotoNeeds = { kind: "needs"; needs: string[] };
type PhotoDraft<T> = { kind: "draft"; draft: T };

export function validatePhotoFile(file: File) {
  if (!file.size || file.size > 24 * 1024 * 1024 || (file.type && !file.type.startsWith("image/"))) {
    throw new Error("请选择 24 MB 以内的图片。");
  }
}

function encodePhoto(photo: HTMLImageElement): EncodedPhoto {
  const { naturalWidth: width, naturalHeight: height } = photo;
  if (!width || !height) throw new Error(unreadablePhoto);
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("此浏览器无法处理图片，可以手动记录。");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  // Re-encode pixels to remove the source file name, EXIF and GPS tags.
  const prefix = "data:image/jpeg;base64,";
  let data = canvas.toDataURL("image/jpeg", 0.88);
  if (data.length - prefix.length > maxPhotoBase64Length) data = canvas.toDataURL("image/jpeg", 0.68);
  const base64 = data.startsWith(prefix) ? data.slice(prefix.length) : "";
  if (!base64 || base64.length > maxPhotoBase64Length) throw new Error("照片太大，请重拍并让食物或营养表填满画面。");
  return { mediaType: "image/jpeg", base64 };
}

async function encodeSource(source: PhotoSource, signal: AbortSignal) {
  signal.throwIfAborted();
  if ("naturalWidth" in source) return encodePhoto(source);
  validatePhotoFile(source);
  const url = URL.createObjectURL(source);
  const picture = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        picture.onload = null;
        picture.onerror = null;
        signal.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve();
      };
      const abort = () => {
        finish(signal.reason);
        picture.removeAttribute("src");
      };
      picture.onload = () => finish();
      picture.onerror = () => finish(new Error(unreadablePhoto));
      signal.addEventListener("abort", abort, { once: true });
      picture.src = url;
    });
    signal.throwIfAborted();
    return encodePhoto(picture);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fetchFoodPhotoConfiguration(owner: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch(photoEndpoint, { cache: "no-store", signal });
  const result = await response.json().catch(() => null) as { enabled?: boolean; owner?: string; error?: string } | null;
  signal.throwIfAborted();
  if (!response.ok) throw new Error(result?.error || photoRetryMessage);
  if (result?.owner !== owner) throw new Error("登录账号已切换，请刷新后再识别。");
  return Boolean(owner && result.enabled === true);
}

async function postPhoto(source: PhotoSource, notes: string, owner: string, mode: FoodPhotoRequest["mode"], cancel: AbortSignal,
  inCoach = false, onQuota?: (quota: CoachQuota) => void) {
  if (!owner) throw new Error("请先登录训练搭子。");
  const signal = AbortSignal.any([cancel, AbortSignal.timeout(45_000)]);
  const image = await encodeSource(source, signal);
  signal.throwIfAborted();
  const response = await fetch(photoEndpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ expectedOwner: owner, mode, image, notes: mode === "protein" ? undefined : notes.trim(),
      inCoach: inCoach ? true : undefined }),
  });
  const result = await response.json().catch(() => null) as {
    draft?: unknown; product?: unknown; needs?: string[]; error?: string; quota?: CoachQuota;
  } | null;
  signal.throwIfAborted();
  if (result?.quota) onQuota?.(result.quota);
  if (!response.ok) throw new Error(result?.error || photoRetryMessage);
  return result;
}

export async function recognizeMealPhoto(source: PhotoSource, notes: string, owner: string, signal: AbortSignal,
  inCoach = false, onQuota?: (quota: CoachQuota) => void): Promise<PhotoNeeds | PhotoDraft<MealPhotoDraft & { grams: number }>> {
  const result = await postPhoto(source, notes, owner, "meal", signal, inCoach, onQuota);
  const details = photoNeedsSchema.safeParse(result);
  if (details.success) return { kind: "needs", needs: details.data.needs };
  const parsed = mealPhotoDraftSchema.safeParse(result?.draft);
  if (!parsed.success || parsed.data.grams === undefined) throw new Error("缺少可用的份量或营养估算，请补充份量后重试。");
  return { kind: "draft", draft: { ...parsed.data, grams: parsed.data.grams } };
}

export async function recognizeLabelPhoto(source: PhotoSource, notes: string, owner: string, signal: AbortSignal): Promise<PhotoNeeds | PhotoDraft<FoodPhotoDraft>> {
  const result = await postPhoto(source, notes, owner, "label", signal);
  const details = photoNeedsSchema.safeParse(result);
  if (details.success) return { kind: "needs", needs: details.data.needs };
  const parsed = foodPhotoDraftSchema.safeParse(result?.draft);
  if (!parsed.success) throw new Error("无法从图片读取完整的营养表，请对准包装标签重拍。");
  return { kind: "draft", draft: parsed.data };
}

export async function recognizeProteinPhoto(source: PhotoSource, owner: string, signal: AbortSignal,
  inCoach = false, onQuota?: (quota: CoachQuota) => void): Promise<PhotoNeeds | { kind: "product"; product: ProteinPhotoProduct }> {
  const result = await postPhoto(source, "", owner, "protein", signal, inCoach, onQuota);
  const details = photoNeedsSchema.safeParse(result);
  if (details.success) return { kind: "needs", needs: details.data.needs };
  const parsed = proteinPhotoProductSchema.safeParse(result?.product);
  if (!parsed.success) throw new Error("无法读取蛋白粉包装，请重拍或补充产品信息。");
  return { kind: "product", product: parsed.data };
}
