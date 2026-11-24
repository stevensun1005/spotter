import type { CoachingMutation } from "./model";

export function coachingError(reason: unknown) {
  if (reason instanceof DOMException && reason.name === "TimeoutError") return "等待时间较长，请检查网络后重试；已提交的内容不会因重试重复添加。";
  return reason instanceof Error ? reason.message : "教练空间暂时无法读取或保存，请稍后重试。";
}

export async function coachingRequest<T>(body?: CoachingMutation, query = "", signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch("/api/coaching" + query, {
    cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "暂时无法完成操作，请确认登录状态并重试。";
    throw new Error(message);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("返回结果无效，请确认登录后重试。");
  return value as T;
}
