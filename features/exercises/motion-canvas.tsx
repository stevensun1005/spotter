"use client";

import { useEffect, useRef } from "react";
import type { Illustration, Point } from "./motion-data";
import { paintMotionFrame } from "./motion-drawing";

function draw(context: CanvasRenderingContext2D, motion: Illustration, elapsed: number) {
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.clearRect(0, 0, 320, 180);
  context.lineCap = "round";
  context.lineJoin = "round";
  paintMotionFrame(motion, elapsed, (color, width, points: Point[]) => {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.stroke();
  }, (color, radius, [x, y]) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  });
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
