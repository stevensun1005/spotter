import { Unzip, UnzipInflate } from "fflate";
import { appleParser, readCsv, readTcx } from "./file-formats";
import type { HeartData, TimeWindow } from "./model";

const mb = 1024 * 1024;
const empty = new Uint8Array();
type Reader = { limit: number; feed: (chunk: Uint8Array, final?: boolean) => void; finish: () => HeartData | null | Promise<HeartData | null> };

function readerFor(name: string, window: TimeWindow): Reader {
  const ext = name.toLowerCase().split(".").at(-1);
  if (ext === "xml") return { limit: 512 * mb, ...appleParser(window) };
  if (ext !== "fit" && ext !== "tcx" && ext !== "csv") throw new Error("请选择 Apple 健康 ZIP/XML、FIT、TCX 或 CSV。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  return {
    limit: 16 * mb,
    feed(chunk) {
      length += chunk.length;
      chunks.push(chunk);
    },
    async finish() {
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      if (ext === "fit") return (await import("./fit")).readFit(bytes.buffer, window);
      const text = new TextDecoder().decode(bytes);
      return ext === "csv" ? readCsv(text, window) : readTcx(text, window);
    },
  };
}

function bounded(reader: Reader) {
  let received = 0;
  return {
    ...reader,
    feed(chunk: Uint8Array, final?: boolean) {
      received += chunk.length;
      if (received > reader.limit) throw new Error("文件过大，请选取单次活动或较小的心率导出。");
      reader.feed(chunk, final);
    },
  };
}

export async function importHeartFile(file: File, window: TimeWindow) {
  let selected: Reader | undefined;
  let fileComplete = false;
  const zipped = /\.zip$/i.test(file.name);
  let unzip: Unzip | undefined;

  if (zipped) {
    if (file.size > 128 * mb) throw new Error("ZIP 超过 128 MB，请在手机上解压后选择 export.xml 或单次活动文件。");
    unzip = new Unzip((entry) => {
      const name = entry.name.split(/[\\/]/).at(-1) ?? "";
      if (!/^(?:export\.xml|workouts\.csv|.+\.(?:fit|tcx))$/i.test(name)) return;
      if (selected) throw new Error("ZIP 含有多份活动，请先解压并选择要导入的文件。");
      const reader = bounded(readerFor(name, window));
      if (entry.originalSize && entry.originalSize > reader.limit) throw new Error("ZIP 内的活动文件过大。");
      selected = reader;
      entry.ondata = (error, chunk, final) => {
        if (error) throw error;
        reader.feed(chunk, final);
        fileComplete = final;
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
  } else {
    selected = bounded(readerFor(file.name, window));
    if (file.size > selected.limit) throw new Error("文件过大，请选取单次活动或较小的心率导出。");
  }

  const reader = file.stream().getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (unzip) {
        // Keep each inflater call bounded on mobile, including for untrusted ZIPs.
        for (let i = 0; i < chunk.value.length; i += 16_384) unzip.push(chunk.value.subarray(i, i + 16_384));
      } else selected!.feed(chunk.value);
    }
    if (unzip) unzip.push(empty, true);
    else { selected!.feed(empty, true); fileComplete = true; }
    if (!selected || !fileComplete) throw new Error("文件不完整或 ZIP 中没有可导入的活动。");
    const result = await selected.finish();
    if (!result) throw new Error("找不到与这次训练时间吻合的心率。请检查导出活动和训练时间。");
    return result;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
