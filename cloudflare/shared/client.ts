export class ClientError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function send(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new ClientError(response.status, data?.error || "服务器暂时无法保存，请重试。");
  }
  return response;
}

export function errorText(reason: unknown, fallback = "操作未完成，请检查网络后重试。") {
  return reason instanceof Error && reason.name === "Error" ? reason.message : fallback;
}
