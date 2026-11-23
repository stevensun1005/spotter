import { regionMuscle } from "@/features/exercises/labels";

export type AnatomyGeometry = Record<string, { viewBox: string; regions: Record<string, string[]> }>;

type Callout = readonly [region: string, name: string, x: number, y: number];
type Palette = { neutral: string; ink: string; quiet: string; tile: string };

const primaryMuscle = "#494b7d";
const secondaryMuscle = "#8d93b7";

const sides = {
  front: {
    caption: "正面",
    left: [
      ["upper-chest", "上胸", 307, 341],
      ["lower-chest", "中下胸", 307, 402],
      ["serratus", "前锯肌", 275, 431],
      ["biceps", "二头", 202, 450],
      ["upper-abs", "腹部", 335, 508],
      ["outer-quad", "股四", 260, 868],
    ],
    right: [
      ["front-deltoid", "前束", 481, 339],
      ["deltoids", "中束", 492, 350],
      ["forearm", "前臂", 574, 591],
      ["adductors", "内收肌", 422, 778],
      ["tibialis", "胫前肌", 450, 1087],
    ],
  },
  back: {
    caption: "背面",
    left: [
      ["rear-deltoid", "后束", 948, 354],
      ["triceps", "三头", 940, 481],
      ["lower-back", "下背", 1049, 563],
      ["hamstring", "腿后侧", 998, 878],
      ["calves", "小腿", 987, 1061],
    ],
    right: [
      ["trapezius", "斜方肌", 1125, 319],
      ["upper-back", "上背", 1183, 390],
      ["lats", "背阔肌", 1152, 493],
      ["gluteal", "臀肌", 1138, 707],
    ],
  },
} as const satisfies Record<"front" | "back", { caption: string; left: readonly Callout[]; right: readonly Callout[] }>;

const layerOrder = ["head", "hair", "feet", "hands", "knees", "ankles", "neck", "gluteal", "quadriceps", "chest", "abs", "trapezius", "upper-back", "deltoids"];
const layer = (key: string) => layerOrder.includes(key) ? layerOrder.indexOf(key) : layerOrder.length;

export function drawShareAnatomy(
  ctx: CanvasRenderingContext2D,
  geometry: AnatomyGeometry,
  muscles: Readonly<Record<string, number>>,
  box: { x: number; y: number; width: number; height: number },
  palette: Palette,
  font: string,
) {
  const half = box.width / 2;
  const score = (region: string) => muscles[region] ?? muscles[regionMuscle(region)] ?? 0;

  for (const [index, side] of (["front", "back"] as const).entries()) {
    const shape = geometry["male-" + side];
    if (!shape) continue;
    const [minX, minY, w, h] = shape.viewBox.trim().split(/\s+/).map(Number);
    const scale = Math.min((half - 46) / w, (box.height - 35) / h);
    if (!Number.isFinite(scale) || scale <= 0) continue;

    const left = box.x + index * half;
    const center = left + half / 2;
    const imageX = center - w * scale / 2;
    const imageY = box.y + 8;
    const imageBottom = imageY + h * scale;
    const offsetX = imageX - minX * scale;
    const offsetY = imageY - minY * scale;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = palette.tile;
    for (const [region, paths] of Object.entries(shape.regions).sort(([a], [b]) => layer(a) - layer(b))) {
      const emphasis = score(region);
      ctx.fillStyle = emphasis >= 75 ? primaryMuscle : emphasis ? secondaryMuscle : palette.neutral;
      for (const path of paths) {
        const outline = new Path2D(path);
        ctx.fill(outline);
        ctx.stroke(outline);
      }
    }
    ctx.restore();

    ctx.save();
    for (const lane of ["left", "right"] as const) {
      const onLeft = lane === "left";
      const textX = left + (onLeft ? 7 : half - 7);
      const minGap = 15;
      const entries = sides[side][lane];
      let lastY = imageY + 4;
      ctx.textAlign = lane;
      for (const [position, [region, name, x, y]] of entries.entries()) {
        const tipX = offsetX + x * scale;
        const tipY = offsetY + y * scale;
        const latestY = imageBottom - 4 - (entries.length - position - 1) * minGap;
        const lineY = Math.min(latestY, Math.max(tipY, lastY + minGap));
        lastY = lineY;

        const emphasis = score(region);
        const ink = emphasis >= 75 ? primaryMuscle : emphasis ? palette.ink : palette.quiet;
        ctx.font = (emphasis >= 75 ? 740 : 560) + " 10.5px " + font;
        const displacement = ctx.measureText(name).width + 2;
        const lineStart = textX + (onLeft ? displacement : -displacement);
        const elbow = lineStart + (onLeft ? 4 : -4);
        ctx.strokeStyle = ink;
        ctx.lineWidth = emphasis ? 0.9 : 0.68;
        ctx.globalAlpha = emphasis ? 0.59 : 0.36;
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(elbow, lineY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.globalAlpha = emphasis ? 1 : 0.87;
        ctx.fillText(name, textX, lineY + 3.4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = "650 11px " + font;
    ctx.fillStyle = palette.quiet;
    ctx.textAlign = "center";
    ctx.fillText(sides[side].caption, center, box.y + box.height - 9);
    ctx.restore();
  }
}
