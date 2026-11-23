import { z } from "zod";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function api(handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Spotter request failed", error);
      return json({ error: "服务器暂时无法保存或读取训练数据。" }, 500);
    }
  };
}

export function publicOrigin(request: Request) {
  return new URL(request.url).origin;
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>, limit = 512_000) {
  if (request.headers.get("origin") !== publicOrigin(request) ||
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(403, "请求来源或格式无效。");
  }
  return readJsonBody(request, schema, limit);
}

export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new HttpError(413, "内容太长，请分批提交。");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  if (reader) {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new HttpError(413, "内容太长，请分批提交。");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  }
  let decoded: unknown;
  try { decoded = JSON.parse(text); }
  catch { throw new HttpError(400, "请求格式无效。"); }
  const value = schema.safeParse(decoded);
  if (!value.success) throw new HttpError(400, "请检查输入格式和长度。");
  return value.data;
}
