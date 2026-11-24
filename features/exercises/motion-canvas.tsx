"use client";

import { useEffect, useRef } from "react";
import type { Illustration, Point } from "./motion-data";

// Index order is head, neck, hip, then each arm and each leg from near to far.
const far = [[1, 5, 6], [2, 9, 10]];
const near = [[1, 3, 4], [2, 7, 8]];

function draw(context: CanvasRenderingContext2D, motion: Illustration, elapsed: number) {
  const segment = elapsed / (motion.ms ?? (motion.duration ? motion.duration / motion.frames.length : 1450));
  const start = Math.floor(segment) % motion.frames.length;
  const end = (start + 1) % motion.frames.length;
  const mix = (1 - Math.cos((segment % 1) * Math.PI)) / 2;
  const points = motion.frames[start].map(([x, y], i): Point => {
    const [tx, ty] = motion.frames[end][i];
    return [x + (tx - x) * mix, y + (ty - y) * mix];
  });
  function stroke(color: string, width: number, path: Point[]) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(...path[0]);
    path.slice(1).forEach((point) => context.lineTo(...point));
    context.stroke();
  }
  function circle(color: string, radius: number, [x, y]: Point) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.clearRect(0, 0, 320, 180);
  context.lineCap = "round";
  context.lineJoin = "round";
  stroke("#557063", 1, [[25, 160], [295, 160]]);
  for (const [x1, y1, x2, y2] of motion.props ?? []) stroke("#94aa9c", 3, [[x1, y1], [x2, y2]]);
  const front = "#f2eee5";
  const back = "#9eafa4";
  far.forEach((leg) => stroke(back, 7, leg.map((id) => points[id])));
  stroke(front, 15, [points[1], points[2]]);
  stroke(front, 5, [points[0], points[1]]);
  circle(front, 9, points[0]);
  near.forEach((leg) => {
    stroke(front, 7, leg.map((id) => points[id]));
    circle("#d1e4c1", 4, points[leg[1]]);
  });
  for (const [kind, index, x, y] of motion.dynamic ?? []) {
    const joint = points[index];
    if (!joint) continue;
    if (kind === "knee-band") {
      const aboveKnee = ([px, py]: Point): Point => [px + (points[2][0] - px) * 0.18, py + (points[2][1] - py) * 0.18];
      stroke("#e2c678", 4, [aboveKnee(joint), aboveKnee(points[x])]);
      continue;
    }
    if (kind === "cable" || kind === "band" || kind === "line" || kind === "bar") {
      const anchor = y === undefined ? points[x] : [x, y] as Point;
      if (anchor) stroke("#e2c678", kind === "bar" ? 4 : 2, [anchor, joint]);
      continue;
    }
    const point: Point = [joint[0] + x, joint[1] + (y ?? 0)];
    if (kind === "slider") stroke("#e2c678", 4, [[point[0] - 6, point[1]], [point[0] + 6, point[1]]]);
    if (kind === "ball") circle("#e2c678", 8, point);
    if (kind === "weight" || kind === "dumbbell") {
      stroke("#e2c678", 3, [[point[0] - 7, point[1]], [point[0] + 7, point[1]]]);
      circle("#e2c678", 3, [point[0] - 7, point[1]]);
      circle("#e2c678", 3, [point[0] + 7, point[1]]);
    }
    if (kind === "plate" || kind === "kettlebell") circle("#e2c678", 6, point);
  }
}

export function MotionCanvas({ motion, name, playing }: { motion: Illustration; name: string; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    let frame = 0;
    let previous: number | undefined;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    draw(context, motion, elapsed.current);
    if (!playing) return;
    function step(now: number) {
      if (document.visibilityState === "visible" && previous !== undefined) {
        elapsed.current += Math.min(60, now - previous);
        draw(context!, motion, elapsed.current);
      }
      previous = now;
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [motion, playing]);
  return <canvas ref={canvas} width={640} height={360} role="img" aria-label={name + "动作示意"} />;
}
