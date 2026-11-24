import illustrations from "./workout-motions.json" with { type: "json" };
import { parsePlanMove } from "./move-name";
import { catalogueIllustrations } from "./catalogue-illustrations";
import type { CatalogEntry } from "./open-gym";
import poseSources from "./workout-guide-motions.json" with { type: "json" };
import flowSources from "./flow-motion-equivalents.json" with { type: "json" };

export type Point = [number, number];
export type Illustration = {
  frames: Point[][];
  props?: [number, number, number, number][];
  dynamic?: [string, number, number, number?][];
  reference?: boolean;
  ms?: number;
  duration?: number;
};

export const slowFrameMs = (ms: number) => Math.round(ms * 2);

const key = (name: string) => parsePlanMove(name).name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const byName = new Map(Object.entries(illustrations).map(([name, item]) => [key(name), item as Illustration]));
export function motionFor(...names: (string | undefined)[]) {
  for (const name of names) {
    const motion = name && byName.get(key(name));
    if (motion) return motion;
  }
}

const namedFlow: Record<string, string> = {
  "上斜俯卧哑铃展臂": "0326",
  "站姿哑铃推肩": "0426",
  "后脚抬高分腿蹲": "0410",
  "站姿绳索左右转体": "0243",
  "俯卧 T 字举臂": "3542",
};
const namedId = new Map(Object.entries(namedFlow).map(([name, id]) => [key(name), id]));

const linkedMotion: Record<string, string> = {
  "0176": "跪姿过头绳索臂屈伸", "8299": "半跪绳索划船", "11253": "跪姿绳索高位下拉",
  "3863": "后脚抬高分腿跳", "2906": "后退拉雪橇", "4029": "站姿弹力带单腿内收",
  "2473": "靠凳单腿臀桥", "7743": "半跪绳索面拉", "3525": "半跪单臂地雷杆推举",
  "5066": "哑铃深蹲接推肩", "0564": "侧向跳上低箱", "5473": "中立握引体向上",
};

const poseMotions: Record<string, string> = poseSources;
const flowMotions: Record<string, string> = flowSources;

export function catalogueMotion(item: Pick<CatalogEntry, "id" | "name" | "animation">) {
  const { id, name, animation } = item;
  const linkedName = id === "1671" ? name : id === "11253" ? undefined : linkedMotion[id];
  const illustration = catalogueIllustrations[id] ?? motionFor(linkedName);
  // Despite the atlas name, 1015's frames show the horizontal press from a lateral anchor.
  const flow = illustration ? undefined : id === "0979" ? "1015" : animation ? id : flowMotions[id];
  return { id: flow, illustration, poseSlug: illustration ? undefined : poseMotions[id] };
}

export function exerciseMotion(name: string, base: string, original?: string, id?: string, animated = false) {
  const illustration = motionFor(original, name, base, id ? linkedMotion[id] : undefined);
  const borrowing = namedId.get(key(original ?? name)) ?? namedId.get(key(base));
  if (borrowing) return { id: borrowing, illustration };
  // The original atlas renders these two movements with a different arm action.
  if (id === "0979") return { id: "1015", illustration };
  if (illustration && (id === "1671" || id === "0176")) return { id: undefined, illustration };
  return { id: animated ? id : undefined, illustration };
}
