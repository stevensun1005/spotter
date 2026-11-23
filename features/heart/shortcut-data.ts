import { sampleCollection, type TimeWindow } from "./model";

export function shortcutHeart(csv: string, window: TimeWindow) {
  if (csv.length > 180000) throw new Error("快捷指令返回的采样过多。请缩小查询时段。");
  const samples = sampleCollection(window);
  for (const line of csv.split(/\r?\n/)) {
    const [time, rate] = line.trim().split(",");
    if (!time || !rate || !/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(time)) continue;
    samples.add(Date.parse(time), Number(rate));
  }
  const result = samples.collect("apple");
  if (!result) throw new Error("没有找到这次训练时段的心率。请检查健康读取权限和手表是否已同步。");
  return result;
}

