import type { Illustration, Point } from "./motion-data";

// Index order is head, neck, hip, then each arm and each leg from near to far.
const far = [[1, 5, 6], [2, 9, 10]];
const near = [[1, 3, 4], [2, 7, 8]];

export function paintMotionFrame(motion: Illustration, elapsed: number,
  stroke: (color: string, width: number, path: Point[]) => void,
  circle: (color: string, radius: number, center: Point) => void) {
  const segment = elapsed / (motion.ms ?? (motion.duration ? motion.duration / motion.frames.length : 1450));
  const start = Math.floor(segment) % motion.frames.length;
  const end = motion.cutOnLoop && start === motion.frames.length - 1 ? start : (start + 1) % motion.frames.length;
  const mix = (1 - Math.cos((segment % 1) * Math.PI)) / 2;
  const inBetween = (from: Point[], to: Point[]) => from.map(([x, y], i): Point => {
    const [tx, ty] = to[i];
    return [x + (tx - x) * mix, y + (ty - y) * mix];
  });
  const points = inBetween(motion.frames[start], motion.frames[end]);
  if (motion.formCheckFrom !== undefined) {
    const wrong = start >= motion.formCheckFrom;
    const color = wrong ? "#f49a8d" : "#a2dda6";
    stroke(color, 2.8, wrong ? [[268,21],[277,30]] : [[266,26],[270,30],[278,20]]);
    if (wrong) stroke(color, 2.8, [[268,30],[277,21]]);
  }
  if (!motion.topView) stroke("#557063", 1, [[25, 160], [295, 160]]);
  for (const [x1, y1, x2, y2] of motion.props ?? []) stroke("#94aa9c", 3, [[x1, y1], [x2, y2]]);
  for (const [kind, index, x, y] of motion.dynamic ?? []) {
    if (kind !== "stability-ball") continue;
    const [px, py] = points[index];
    const center: Point = [px + x, py + (y ?? 0)];
    circle("#94aa9c", 18, center);
    stroke("#557063", 1, [[center[0] - 14, center[1] - 5], [center[0], center[1] - 8], [center[0] + 14, center[1] - 5]]);
  }
  const front = "#f2eee5";
  const back = "#9eafa4";
  function drawBody(joints: Point[], light: string, shade: string, spine: number[] = [], shoulders?: [number, number]) {
    far.forEach((limb) => stroke(shade, 7, limb.map((id) => joints[id === 1 && shoulders ? shoulders[1] : id])));
    stroke(light, 15, [joints[1], ...spine.map((id) => joints[id]), joints[2]]);
    stroke(light, 5, [joints[0], joints[1]]);
    circle(light, 9, joints[0]);
    near.forEach((limb) => {
      stroke(light, 7, limb.map((id) => joints[id === 1 && shoulders ? shoulders[0] : id]));
      circle("#d1e4c1", 4, joints[limb[1]]);
    });
  }
  if (motion.partnerFrames?.length === motion.frames.length) {
    drawBody(inBetween(motion.partnerFrames[start], motion.partnerFrames[end]), "#9eb6d0", "#647f95", motion.partnerSpine);
  }
  drawBody(points, front, back, motion.spine, motion.shoulders);
  for (const [kind, index, x, y] of motion.dynamic ?? []) {
    const joint = points[index];
    if (!joint) continue;
    if (kind === "palm-up" || kind === "palm-down" || kind === "thumb-up") {
      const fingertip = points[x];
      if (!fingertip) continue;
      const [jx, jy] = joint;
      const [fx, fy] = fingertip;
      stroke(front, 5, [joint, fingertip]);
      const polarity = kind === "palm-down" ? -1 : 1;
      const middle: Point = [(jx + fx) / 2, (jy + fy) / 2];
      const dx = fx - jx, dy = fy - jy;
      const length = Math.max(1, Math.hypot(dx, dy));
      circle("#e2c678", kind === "thumb-up" ? 2.5 : 2, [middle[0] - dy * polarity * 2.3 / length, middle[1] + dx * polarity * 2.3 / length]);
      continue;
    }
    if (kind === "hand") {
      const tip = points[x], thumb = y === undefined ? undefined : points[y];
      if (tip && thumb) {
        const palm: Point = [joint[0] + (tip[0] - joint[0]) * 0.54, joint[1] + (tip[1] - joint[1]) * 0.54];
        stroke(front, 6, [joint, palm, tip]);
        stroke(front, 3, [palm, thumb]);
        circle("#e2c678", 2, thumb);
      }
      continue;
    }
    if (kind === "digit") {
      if (points[x]) stroke(front, y ?? 3, [joint, points[x]]);
      continue;
    }
    if (kind === "face") {
      if (points[x]) circle("#324b3d", 1.8, points[x]);
      continue;
    }
    if (kind === "hoop") {
      const rim: Point[] = [];
      for (let step = 0; step <= 24; step++) {
        const angle = Math.PI * step / 12;
        rim.push([joint[0] + Math.cos(angle) * 48, joint[1] + Math.sin(angle) * 8]);
      }
      stroke("#e2c678", 2, rim);
      continue;
    }
    if (kind === "ez-bar") {
      const anchor = points[x];
      if (anchor) {
        const [ax, ay] = anchor;
        const [jx, jy] = joint;
        stroke("#e2c678", 3, [[ax, ay], [0.75 * ax + 0.25 * jx, ay - 3], [(ax + jx) / 2, (ay + jy) / 2 + 3], [0.25 * ax + 0.75 * jx, jy - 3], [jx, jy]]);
      }
      continue;
    }
    if (kind === "foot-tip") {
      if (points[x]) stroke(front, 5, [joint, points[x]]);
      continue;
    }
    if (kind === "foot" && y !== undefined) {
      stroke(front, 5, [joint, [x, y]]);
      continue;
    }
    if (kind === "knee-band") {
      const aboveKnee = ([px, py]: Point): Point => [px + (points[2][0] - px) * 0.18, py + (points[2][1] - py) * 0.18];
      stroke("#e2c678", 4, [aboveKnee(joint), aboveKnee(points[x])]);
      continue;
    }
    if (kind === "chain" && y !== undefined) {
      const start = joint[1] + 8;
      const at = joint[0] + x;
      for (let link = start; link < y; link += 5) {
        const lean = Math.round((link - start) / 5) % 2 ? 1.5 : -1.5;
        stroke("#d2c6a8", 1.6, [[at + lean, link], [at - lean, Math.min(link + 5, y)]]);
      }
      stroke("#d2c6a8", 1.6, [[at - 6, y], [at - 3, y - 2], [at, y], [at + 3, y - 2], [at + 7, y]]);
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
    if (kind === "plate") circle("#e2c678", 6, point);
    if (kind === "disc") {
      circle("#e2c678", 12, point);
      circle("#557063", 3, point);
    }
    const [px, py] = point;
    if (kind === "handled-bell") {
      const bell = points[x];
      if (bell) {
        const shoulder: Point = [bell[0] + (joint[1] - bell[1]) * 0.4, bell[1] - (joint[0] - bell[0]) * 0.4];
        stroke("#e2c678", 2, [joint, shoulder, bell]);
        circle("#e2c678", 6, bell);
      }
      continue;
    }
    if (kind === "circus-dumbbell") {
      const [px, py] = joint;
      stroke("#e2c678", 4, [[px - 12, py], [px + 12, py]]);
      circle("#e2c678", 7, [px - 12, py]);
      circle("#e2c678", 7, [px + 12, py]);
      continue;
    }
    if (kind === "kettlebell") {
      const direction = (y ?? 0) < 0 ? -1 : 1;
      const edge = py - 4 * direction;
      const handle = py - 10 * direction;
      circle("#e2c678", 6, point);
      stroke("#e2c678", 2, [[px - 3, edge], [px - 4, handle], [px + 4, handle], [px + 3, edge]]);
    }
    if (kind === "hammer-weight") {
      stroke("#e2c678", 3, [[px, py - 7], [px, py + 7]]);
      circle("#e2c678", 3, [px, py - 7]);
      circle("#e2c678", 3, [px, py + 7]);
    }
    if (kind === "bottle-upright") stroke("#e2c678", 4, [[px + 1, py - 7], [px - 2, py + 6]]);
    if (kind === "pad") stroke("#e2c678", 6, [[px - 5, py], [px + 5, py]]);
    if (kind === "head-strap") stroke("#e2c678", 3, [[px - 7, py], [px + 7, py]]);
    if (kind === "backpack" && points[x]) {
      stroke("#e2c678", 13, [[joint[0] - 6, joint[1] - 3], [points[x][0] - 6, points[x][1] + 2]]);
      stroke("#557063", 2, [[joint[0] - 12, joint[1] + 4], [joint[0] - 3, joint[1] + 7]]);
    }
    if (kind === "stone") circle("#b8c8bd", 13, point);
    if (kind === "shield-load") {
      stroke("#e2c678", 7, [[px - 8, py - 6], [px + 8, py - 6], [px + 4, py + 9], [px - 4, py + 9], [px - 8, py - 6]]);
      stroke("#b9a56b", 5, [[px - 4, py], [px + 4, py]]);
    }
    if (kind === "training-log") {
      stroke("#cfa978", 15, [[px - 25, py], [px + 25, py]]);
      stroke("#225042", 3, [[px - 16, py], [px - 8, py]]);
      stroke("#225042", 3, [[px + 8, py], [px + 16, py]]);
    }
    if (kind === "iron-block") stroke("#b8c8bd", 12, [[px - 10, py], [px + 10, py]]);
    if (kind === "crucifix-load") {
      stroke("#e2c678", 7, [[px - 5, py], [px + 5, py]]);
      stroke("#b5a471", 4, [[px, py + 2], [px, py + 10]]);
    }
    if (kind === "axle") {
      stroke("#e2c678", 5, [[px - 30, py], [px + 30, py]]);
      circle("#b8c8bd", 9, [px - 25, py]);
      circle("#b8c8bd", 9, [px + 25, py]);
    }
    if (kind === "throw-weight") {
      circle("#e2c678", 6, [px, py + 3]);
      stroke("#e2c678", 2, [[px - 4, py], [px - 4, py - 5], [px + 4, py - 5], [px + 4, py]]);
    }
    if (kind === "keg") {
      stroke("#b8c8bd", 12, [[px - 6, py - 5], [px + 6, py - 5], [px + 5, py + 5], [px - 5, py + 5], [px - 6, py - 5]]);
      stroke("#6b8174", 2, [[px - 8, py - 5], [px + 8, py - 5]]);
      stroke("#6b8174", 2, [[px - 8, py + 5], [px + 8, py + 5]]);
    }
    if (kind === "hinged-post" && points[x]) {
      stroke("#b5a471", 10, [points[x], joint]);
      circle("#b8c8bd", 6, points[x]);
    }
    if (kind === "tire-outline" && points[x]) {
      const far = points[x];
      const center: Point = [(joint[0] + far[0]) / 2, (joint[1] + far[1]) / 2];
      const [dx, dy] = [joint[0] - center[0], joint[1] - center[1]];
      const radius = Math.max(1, Math.hypot(dx, dy));
      const rim = Array.from({ length: 17 }, (_, i): Point => {
        const angle = i * Math.PI / 8;
        return [center[0] + Math.cos(angle) * dx - Math.sin(angle) * dy * 6 / radius,
          center[1] + Math.cos(angle) * dy + Math.sin(angle) * dx * 6 / radius];
      });
      stroke("#9bb1a6", 6, rim);
    }
    if (kind === "sandbag") stroke("#e2c678", 13, [[px - 12, py + 2], [px, py - 1], [px + 13, py + 2]]);
    if (kind === "bottle") stroke("#e2c678", 4, [[px - 7, py + 2], [px + 6, py - 1]]);
    if (kind === "barbell-end") {
      circle("#e2c678", 10, point);
      circle("#243c35", 2.5, point);
    }
    if (kind === "trap-bar") {
      stroke("#e2c678", 3, [[px - 27, py], [px - 12, py - 7], [px + 15, py - 7], [px + 29, py],
        [px + 15, py + 6], [px - 12, py + 6], [px - 27, py]]);
      circle("#e2c678", 5, [px - 25, py]);
      circle("#e2c678", 5, [px + 28, py]);
    }
    if (kind === "massage-ball") circle("#e2c678", 6, point);
    if (kind === "foam-roller") {
      stroke("#ccbf92", 20, [[px, py], [px + 9, py - 3]]);
      circle("#e2c678", 10, point);
      circle("#324b3d", 3.3, point);
    }
    if (kind === "foam-lengthwise") {
      stroke("#e2c678", 17, [[px - 27, py], [px + 27, py]]);
      stroke("#ccbf92", 2, [[px - 22, py + 4], [px + 23, py + 4]]);
    }
    if (kind === "wheel") {
      circle("#e2c678", 8, point);
      circle("#243c35", 2.5, point);
    }
    if (kind === "ring") {
      circle("#e2c678", 5, point);
      circle("#243c35", 3, point);
    }
  }
}
