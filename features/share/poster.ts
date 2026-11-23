import { muscleNames, regionMuscle } from "@/features/exercises/labels";
import { displayNumber } from "@/shared/ui";
import type { ShareHeart, ShareSummary } from "./model";

export type AnatomyGeometry = Record<string, { viewBox: string; regions: Record<string, string[]> }>;

export const shareThemes = {
  travel: { label: "手绘方格", paper: "#fbf7ec", tile: "#fffdf5", ink: "#2a2a2e", quiet: "#62626b", line: "#d9d3c2", accent: "#1e7947", light: "#bddbab", neutral: "#c3d5d8", highlight: "#fff0a0" },
  lilac: { label: "雾紫", paper: "#f2edf8", tile: "#fffefd", ink: "#27243f", quiet: "#605971", line: "#ded6e8", accent: "#65578d", light: "#c4b8df", neutral: "#e6deec", highlight: "#e6dcf4" },
  forest: { label: "松林", paper: "#e8f1e8", tile: "#fafff8", ink: "#182f28", quiet: "#496455", line: "#cfded0", accent: "#32774f", light: "#b3d8ad", neutral: "#e0e9dc", highlight: "#d4e7c9" },
} as const;

export type ShareTheme = keyof typeof shareThemes;
const width = 540;
const edge = 22;
const inner = width - edge * 2;
const font = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

// Match the Costa Rica 1/6–1/11 poster with device fonts and no font service dependency.
const handwriting = '"Patrick Hand", "Ma Shan Zheng", "HanziPen SC", "Hannotate SC", "Kaiti SC", "STKaiti", KaiTi, "Comic Sans MS", system-ui, cursive';
const markerColors = ["#2a70cf", "#b35408", "#1e7947", "#bd3827", "#167883", "#7747ad"];

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
  const sketch = theme === "travel";
  const titleFont = sketch ? handwriting : font;
  const setFont = (size: number, weight = 500, family = font) => { ctx.font = weight + " " + size + "px " + family; };
  const text = (value: string, x: number, y: number, size: number, color: string, weight = 500, family = font) => {
    setFont(size, weight, family); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const label = (value: string, x: number, y: number, size: number, max: number, color: string, weight = 500) => {
    setFont(size, weight); text(lines(ctx, value, max, 1)[0] ?? "", x, y, size, color, weight);
  };
  const rule = (x1: number, y1: number, x2: number, y2: number, color = c.line as string, size = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const panel = (y: number, height: number) => {
    if (sketch) {
      ctx.beginPath(); ctx.roundRect(edge + 4, y + 5, inner, height, [18, 10, 16, 11]);
      ctx.fillStyle = c.ink; ctx.fill();
    }
    ctx.beginPath(); ctx.roundRect(edge, y, inner, height, [18, 10, 16, 11]);
    ctx.fillStyle = c.tile; ctx.fill();
    ctx.strokeStyle = sketch ? c.ink : c.line;
    ctx.lineWidth = sketch ? 2.1 : 1; ctx.stroke();
  };

  setFont(36, 800, titleFont);
  const title = lines(ctx, summary.title, inner, 3);
  const header = 73 + title.length * 43;
  const hasMuscle = Object.keys(summary.muscles).length > 0;
  const muscleHeight = geometry ? 377 : 208;
  const displayMuscle = (regions: Record<string, number>) =>
    Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([slug]) => muscleNames[slug] ?? slug).join("、");

  const setsByWorkout = showDetails ? summary.workouts.map(({ title, moves }) => ({
    title, moves: moves.map(({ name, sets }) => {
      setFont(20, 700);
      const heading = lines(ctx, name, inner - (sketch ? 74 : 44), 3);
      setFont(17);
      const detail: string[] = [];
      let line = "";
      sets.forEach((set, i) => {
        const next = (i + 1) + "  " + set;
        if (line && ctx.measureText(line + "    ·    " + next).width <= inner - 48) line += "    ·    " + next;
        else {
          if (line) detail.push(line);
          line = "";
          const parts = lines(ctx, next, inner - 48);
          line = parts.pop() ?? "";
          detail.push(...parts);
        }
      });
      if (line) detail.push(line);
      return { heading, detail, height: heading.length * 26 + detail.length * 24 + 21 };
    }),
  })).filter(({ moves }) => moves.length) : [];
  const detailHeight = setsByWorkout.map(({ moves }) => 55 + moves.reduce((height, item) => height + item.height, 0));
  const heartHeight = heart.map(({ points }) => points.length ? 196 : 103);
  const logicalHeight = header + muscleHeight + 20 +
    heartHeight.reduce((height, item) => height + item + 15, 0) +
    detailHeight.reduce((height, item) => height + item + 15, 0) + 32;
  const density = Math.min(2, 8192 / logicalHeight, Math.sqrt(14_000_000 / (logicalHeight * width)));
  canvas.width = Math.floor(width * density);
  canvas.height = Math.floor(logicalHeight * density);
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, width, logicalHeight);

  if (sketch) {
    for (let x = 0; x < width; x += 20) rule(x, 0, x, logicalHeight, x % 100 ? "#466eaa17" : "#466eaa2e");
    for (let y = 0; y < logicalHeight; y += 20) rule(0, y, width, y, y % 100 ? "#466eaa17" : "#466eaa2e");
  }

  const date = new Date(summary.date + "T12:00:00Z");
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "UTC" }).format(date);
  const dateText = summary.date + "  " + weekday;
  ctx.save();
  ctx.translate(edge, 22);
  if (sketch) ctx.rotate(-0.021);
  setFont(16, 730, titleFont);
  ctx.beginPath(); ctx.roundRect(0, 0, ctx.measureText(dateText).width + 22, 29, [9, 4, 8, 5]);
  ctx.fillStyle = c.highlight; ctx.fill();
  if (sketch) { ctx.strokeStyle = c.ink; ctx.lineWidth = 1.65; ctx.stroke(); }
  text(dateText, 11, 20, 16, c.ink, 730, titleFont);
  ctx.restore();
  ctx.textAlign = "right";
  text("训练搭子", width - edge, 42, 14, c.quiet, 660);
  ctx.textAlign = "left";
  for (const [index, line] of title.entries()) {
    const baseline = 91 + index * 43;
    setFont(36, 800, titleFont);
    if (sketch && index === title.length - 1) {
      const highlightWidth = ctx.measureText(line).width;
      ctx.fillStyle = c.highlight;
      ctx.fillRect(edge + highlightWidth * .18, baseline - 9, highlightWidth * .82, 14);
    }
    text(line, edge, baseline, 36, c.ink, 800, titleFont);
  }

  let y = header;
  panel(y, muscleHeight);
  const avatarX = edge + 37;
  ctx.beginPath(); ctx.arc(avatarX, y + 35, 17, 0, 2 * Math.PI);
  ctx.fillStyle = c.light; ctx.fill();
  ctx.textAlign = "center";
  text(Array.from(name.trim())[0]?.toLocaleUpperCase() || "练", avatarX, y + 41, 16, c.ink, 760);
  ctx.textAlign = "left";
  label(name || "训练记录", edge + 63, y + 41, 19, inner - 83, c.ink, 740);
  rule(edge + 19, y + 62, width - edge - 19, y + 62);

  const stats = [[String(summary.minutes), "分钟 · 时长"], [String(summary.sets), "组 · 已完成"], [displayNumber(summary.volume), "kg · 容量"]];
  stats.forEach(([amount, name], i) => {
    const x = geometry ? width - edge - 148 : edge + 23 + i * inner / 3;
    const top = geometry ? y + 112 + i * 71 : y + 117;
    if (geometry && sketch) {
      ctx.beginPath(); ctx.roundRect(x - 10, top - 29, 135, 60, [8, 5, 9, 5]);
      ctx.fillStyle = i === 2 ? "#e1edf8" : c.paper; ctx.fill();
      ctx.strokeStyle = c.ink; ctx.lineWidth = 1.35; ctx.stroke();
    } else if (geometry && i) rule(x, top - 32, width - edge - 21, top - 32);
    label(amount, x, top, 31, geometry && sketch ? 114 : 129, i === 2 && sketch ? "#205fac" : c.ink, 790);
    label(name, x, top + 22, 14, 120, c.quiet, 630);
  });

  if (geometry) {
    if (sketch) {
      ctx.beginPath(); ctx.roundRect(edge + 18, y + 74, inner - 184, 229, [11, 7, 11, 8]);
      ctx.fillStyle = "#e3f1f2"; ctx.fill();
      ctx.strokeStyle = "#8eaeb3"; ctx.lineWidth = 1; ctx.stroke();
    } else rule(width - edge - 163, y + 82, width - edge - 163, y + 298);
    ["front", "back"].forEach((side, index) => {
      const shape = geometry["male-" + side];
      if (!shape) return;
      const [x, minY, w, h] = shape.viewBox.trim().split(/\s+/).map(Number);
      const scale = Math.min(136 / w, 197 / h);
      if (!Number.isFinite(scale) || scale <= 0) return;
      const center = edge + 92 + 144 * index;
      ctx.save(); ctx.translate(center - w * scale / 2 - x * scale, y + 78 - minY * scale);
      ctx.scale(scale, scale); ctx.lineWidth = 1.4 / scale; ctx.strokeStyle = c.tile;
      const layers = ["head", "hair", "feet", "hands", "knees", "ankles", "neck", "gluteal", "quadriceps", "chest", "abs", "trapezius", "upper-back", "deltoids"];
      const rank = (key: string) => layers.includes(key) ? layers.indexOf(key) : layers.length;
      for (const [region, paths] of Object.entries(shape.regions).sort(([a], [b]) => rank(a) - rank(b))) {
        const score = summary.muscles[region] ?? summary.muscles[regionMuscle(region)] ?? 0;
        ctx.fillStyle = score >= 75 ? c.accent : score ? c.light : c.neutral;
        for (const path of paths) { const p = new Path2D(path); ctx.fill(p); ctx.stroke(p); }
      }
      ctx.restore();
      ctx.textAlign = "center"; text(index === 0 ? "正面" : "背面", center, y + 296, 14, c.quiet, 680); ctx.textAlign = "left";
    });
    rule(edge + 19, y + 310, width - edge - 19, y + 310);
  }
  const legendY = y + (geometry ? 337 : 171);
  if (hasMuscle) {
    ctx.fillStyle = c.accent; ctx.fillRect(edge + 20, legendY - 10, 10, 10);
    ctx.fillStyle = c.light; ctx.fillRect(edge + 20, legendY + 8, 10, 10);
    label("主要  " + (displayMuscle(summary.primary) || "—"), edge + 37, legendY, 14, inner - 57, c.ink, 660);
    label("辅助  " + (displayMuscle(summary.secondary) || "—"), edge + 37, legendY + 18, 14, inner - 57, c.quiet);
  } else {
    text("暂无可汇总的肌群", edge + 20, legendY, 14, c.quiet);
  }
  y += muscleHeight + 20;

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
      if (sketch) {
        const x = edge + 30;
        ctx.beginPath(); ctx.arc(x, row - 6, 11, 0, 2 * Math.PI);
        ctx.fillStyle = markerColors[i % markerColors.length]; ctx.fill();
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.textAlign = "center"; text(String(i + 1), x, row - 2, 12, "#ffffff", 770); ctx.textAlign = "left";
      }
      heading.forEach((line, n) => text(line, edge + (sketch ? 49 : 20), row + n * 26, 20, c.ink, 700));
      detail.forEach((line, n) => text(line, edge + 22, row + heading.length * 26 + n * 24, 17, c.quiet));
      row += height;
    });
    y += height + 15;
  });
}
