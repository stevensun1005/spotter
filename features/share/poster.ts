import { muscleNames, regionMuscle } from "@/features/exercises/labels";
import { displayNumber } from "@/shared/ui";
import type { ShareHeart, ShareSummary } from "./model";

export type AnatomyGeometry = Record<string, { viewBox: string; regions: Record<string, string[]> }>;

export const shareThemes = {
  travel: { label: "湖畔", paper: "#f3f6f2", tile: "#ffffff", ink: "#13262f", quiet: "#526369", line: "#dbe6df", accent: "#287b90", light: "#a7ced2", neutral: "#dce6e1" },
  lilac: { label: "雾紫", paper: "#f2edf8", tile: "#fffefd", ink: "#27243f", quiet: "#605971", line: "#ded6e8", accent: "#65578d", light: "#c4b8df", neutral: "#e6deec" },
  forest: { label: "松林", paper: "#e8f1e8", tile: "#fafff8", ink: "#182f28", quiet: "#496455", line: "#cfded0", accent: "#32774f", light: "#b3d8ad", neutral: "#e0e9dc" },
} as const;

export type ShareTheme = keyof typeof shareThemes;
const width = 540;
const edge = 28;
const inner = width - edge * 2;
const font = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

function lines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines = Infinity) {
  const parts: string[] = [];
  let line = "";
  for (const char of value.trim()) {
    if (line && ctx.measureText(line + char).width > maxWidth) {
      parts.push(line);
      line = char.trimStart();
    } else line += char;
  }
  if (line) parts.push(line);
  if (parts.length > maxLines) {
    parts.length = maxLines;
    let last = parts[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    parts[maxLines - 1] = last + "…";
  }
  return parts;
}

export function renderShareCard(canvas: HTMLCanvasElement, {
  summary, theme, showDetails, heart, geometry, name,
}: {
  summary: ShareSummary; theme: ShareTheme; showDetails: boolean; heart: ShareHeart[];
  geometry?: AnatomyGeometry; name: string;
}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器暂时无法生成图片。");
  const c = shareThemes[theme];
  const setFont = (size: number, weight = 500) => { ctx.font = weight + " " + size + "px " + font; };
  const text = (value: string, x: number, y: number, size: number, color: string, weight = 500) => {
    setFont(size, weight); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const label = (value: string, x: number, y: number, size: number, max: number, color: string, weight = 500) => {
    setFont(size, weight); text(lines(ctx, value, max, 1)[0] ?? "", x, y, size, color, weight);
  };
  const rule = (x1: number, y1: number, x2: number, y2: number, color = c.line as string, size = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const panel = (y: number, height: number) => {
    ctx.beginPath(); ctx.roundRect(edge, y, inner, height, 19);
    ctx.fillStyle = c.tile; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.stroke();
  };

  setFont(31, 780);
  const title = lines(ctx, summary.title, inner, 3);
  const header = 52 + title.length * 41 + (name ? 51 : 30);
  const hasMuscle = Object.keys(summary.muscles).length > 0;
  const muscleHeight = geometry ? 321 : hasMuscle ? 115 : 82;
  const displayMuscle = (regions: Record<string, number>) =>
    Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([slug]) => muscleNames[slug] ?? slug).join("、");

  const setsByWorkout = showDetails ? summary.workouts.map(({ title, moves }) => ({
    title, moves: moves.map(({ name, sets }) => {
      setFont(18, 700);
      const heading = lines(ctx, name, inner - 44, 3);
      setFont(15);
      const detail = sets.flatMap((set, i) => lines(ctx, (i + 1) + "  " + set, inner - 49));
      return { heading, detail, height: heading.length * 24 + detail.length * 22 + 22 };
    }),
  })).filter(({ moves }) => moves.length) : [];
  const detailHeight = setsByWorkout.map(({ moves }) => 55 + moves.reduce((height, item) => height + item.height, 0));
  const heartHeight = heart.map(({ points }) => points.length ? 196 : 103);
  const logicalHeight = header + 115 + 15 + muscleHeight + 15 +
    heartHeight.reduce((height, item) => height + item + 15, 0) +
    detailHeight.reduce((height, item) => height + item + 15, 0) + 32;
  const density = Math.min(2, 8192 / logicalHeight, Math.sqrt(14_000_000 / (logicalHeight * width)));
  canvas.width = Math.floor(width * density);
  canvas.height = Math.floor(logicalHeight * density);
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, width, logicalHeight);

  text("训练搭子", edge, 31, 15, c.accent, 760);
  ctx.textAlign = "right";
  const date = new Date(summary.date + "T12:00:00Z");
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" }).format(date);
  text(summary.date + "  " + weekday, width - edge, 31, 15, c.quiet, 620);
  ctx.textAlign = "left";
  rule(edge, 45, width - edge, 45);
  for (const [index, line] of title.entries()) text(line, edge, 85 + index * 41, 31, c.ink, 780);
  if (name) label(name, edge, header - 22, 16, inner, c.quiet, 620);

  let y = header;
  panel(y, 115);
  const stats = [[String(summary.minutes), "训练时长 · 分钟"], [String(summary.sets), "完成组数"], [displayNumber(summary.volume), "训练容量 · kg"]];
  stats.forEach(([amount, name], i) => {
    const x = edge + 20 + i * inner / 3;
    if (i) rule(x - 12, y + 23, x - 12, y + 91);
    label(amount, x, y + 54, 29, inner / 3 - 29, c.ink, 760);
    label(name, x, y + 84, 14, inner / 3 - 28, c.quiet);
  });
  y += 130;
  panel(y, muscleHeight);
  text("训练部位", edge + 20, y + 33, 20, c.ink, 730);
  if (geometry) {
    ["front", "back"].forEach((side, index) => {
      const shape = geometry["male-" + side];
      if (!shape) return;
      const [x, minY, w, h] = shape.viewBox.trim().split(/\s+/).map(Number);
      const scale = Math.min(157 / w, 212 / h);
      if (!Number.isFinite(scale) || scale <= 0) return;
      const left = edge + 37 + 219 * index;
      ctx.save(); ctx.translate(left + (177 - w * scale) / 2 - x * scale, y + 45 - minY * scale);
      ctx.scale(scale, scale); ctx.lineWidth = 1.4 / scale; ctx.strokeStyle = c.tile;
      const layers = ["head", "hair", "feet", "hands", "knees", "ankles", "neck", "gluteal", "quadriceps", "chest", "abs", "trapezius", "upper-back", "deltoids"];
      const rank = (key: string) => layers.includes(key) ? layers.indexOf(key) : layers.length;
      for (const [region, paths] of Object.entries(shape.regions).sort(([a], [b]) => rank(a) - rank(b))) {
        const score = summary.muscles[region] ?? summary.muscles[regionMuscle(region)] ?? 0;
        ctx.fillStyle = score >= 75 ? c.accent : score ? c.light : c.neutral;
        for (const path of paths) { const p = new Path2D(path); ctx.fill(p); ctx.stroke(p); }
      }
      ctx.restore();
      ctx.textAlign = "center"; text(index === 0 ? "正面" : "背面", left + 88.5, y + 274, 13, c.quiet, 630); ctx.textAlign = "left";
    });
  }
  const legendY = y + (geometry ? 295 : 61);
  if (hasMuscle) {
    label("主要  " + (displayMuscle(summary.primary) || "—"), edge + 20, legendY, 13, inner - 40, c.accent, 680);
    label("辅助  " + (displayMuscle(summary.secondary) || "—"), edge + 20, legendY + 16, 13, inner - 40, c.quiet);
  } else {
    label("暂无可汇总的肌群", edge + 20, legendY, 14, inner - 40, c.quiet);
  }
  y += muscleHeight + 15;

  heart.forEach(({ title, minimum, maximum, average, points, duration }, i) => {
    const height = heartHeight[i];
    panel(y, height);
    const heading = heart.length > 1 ? "心率 · " + title : "心率";
    label(heading, edge + 20, y + 34, 18, inner - 42, c.ink, 720);
    const peak = maximum ?? (points.length ? Math.max(...points.map((p) => p.bpm)) : undefined);
    const values = [average !== undefined && "平均 " + average, minimum !== undefined && peak !== undefined && (minimum + "–" + peak),
      minimum === undefined && peak !== undefined && "最高 " + peak].filter(Boolean).join("  ·  ");
    text(values ? values + " BPM" : "已保存采样", edge + 20, y + 62, 15, c.accent, 650);
    if (points.length) {
      const plotLeft = edge + 50, plotRight = width - edge - 20, top = y + 82, bottom = y + 166;
      const low = Math.max(0, Math.min(minimum ?? 300, average ?? 300) - 4);
      const high = Math.max(peak ?? 0, average ?? 0, low + 8) + 4;
      const py = (bpm: number) => bottom - (bottom - top) * (bpm - low) / (high - low);
      for (const tick of [high, Math.round((high + low) / 2), low]) {
        text(String(tick), edge + 18, py(tick) + 4, 11, c.quiet);
        rule(plotLeft, py(tick), plotRight, py(tick));
      }
      if (average !== undefined) {
        ctx.setLineDash([4, 4]); rule(plotLeft, py(average), plotRight, py(average), c.light, 2); ctx.setLineDash([]);
      }
      ctx.beginPath(); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.fillStyle = c.accent;
      points.forEach((point, index) => {
        const x = plotLeft + (plotRight - plotLeft) * point.time / Math.max(1, duration);
        if (points.length === 1) ctx.arc(x, py(point.bpm), 3, 0, Math.PI * 2);
        else if (index === 0) ctx.moveTo(x, py(point.bpm));
        else ctx.lineTo(x, py(point.bpm));
      });
      if (points.length === 1) ctx.fill(); else ctx.stroke();
      text("0:00", plotLeft, bottom + 19, 11, c.quiet);
      const seconds = Math.floor(duration / 1000), end = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      ctx.textAlign = "right"; text(end, plotRight, bottom + 19, 11, c.quiet); ctx.textAlign = "left";
    }
    y += height + 15;
  });

  setsByWorkout.forEach(({ title, moves }, index) => {
    const height = detailHeight[index];
    panel(y, height);
    label(setsByWorkout.length > 1 ? title : "训练明细", edge + 20, y + 33, 20, inner - 40, c.ink, 730);
    let row = y + 65;
    moves.forEach(({ heading, detail, height }, i) => {
      if (i) rule(edge + 19, row - 21, width - edge - 19, row - 21);
      heading.forEach((line, n) => text(line, edge + 20, row + n * 24, 18, c.ink, 700));
      detail.forEach((line, n) => text(line, edge + 24, row + heading.length * 24 + n * 22, 15, c.quiet));
      row += height;
    });
    y += height + 15;
  });
}
