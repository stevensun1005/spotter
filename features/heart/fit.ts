import { Decoder, Stream } from "@garmin/fitsdk";
import { matchingSummary, sampleCollection, sourceSummary, type TimeWindow } from "./model";

function timestamp(value: unknown) {
  return value instanceof Date ? value.getTime() : NaN;
}

export function readFit(bytes: ArrayBuffer, window: TimeWindow) {
  const decoder = new Decoder(Stream.fromArrayBuffer(bytes));
  if (!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error("FIT 文件不完整或格式无效。");
  const { messages, errors } = decoder.read();
  if (errors.length) throw new Error("这个 FIT 文件无法完整读取，请重新导出。");
  const samples = sampleCollection(window);
  for (const record of messages.recordMesgs ?? []) {
    if (typeof record.heartRate === "number") samples.add(timestamp(record.timestamp), record.heartRate);
  }
  return samples.collect("fit") ?? matchingSummary(window, (messages.sessionMesgs ?? []).map((record) =>
    sourceSummary("fit", timestamp(record.startTime), timestamp(record.timestamp), record.avgHeartRate, record.maxHeartRate)));
}
