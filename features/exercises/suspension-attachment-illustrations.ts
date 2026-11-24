import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Grip = "palm-up" | "palm-down" | "thumb-up";
type Pair = [Point, Point];

const phases = [0, 0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25];
const mix = (from: Point, to: Point, fraction: number): Point =>
  [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction];

function lineBody(heel: Point, angle: number): Point[] {
  const along = (distance: number, offset: number = 0): Point => [
    heel[0] - distance * Math.cos(angle) + Math.sin(angle) * offset,
    heel[1] - distance * Math.sin(angle) + Math.cos(angle) * offset,
  ];
  const neck = along(114);
  const feet: Pair = [heel, [heel[0] - 12, heel[1] - 1]];
  return [along(131), neck, along(64), along(31, 3), feet[0],
    along(31, -6), feet[1], along(113, 7), along(113, -5)];
}

function handleOnStrap(anchor: Point, length: number, x: number): Point {
  return [x, anchor[1] + Math.sqrt(length ** 2 - (x - anchor[0]) ** 2)];
}

function hull(anchors: Pair, single: boolean, style: "pad" | "ring", grip: Grip,
  frames: Point[][], ms: number = 440): Illustration {
  const props: Props = [[anchors[1][0] - 10, anchors[1][1], anchors[0][0] + 18, anchors[0][1]],
    [anchors[0][0] + 18, anchors[0][1], anchors[0][0] + 18, 157]];
  const attachments: Gear = [[style, 4, 0, 0], ["line", 13, ...anchors[0]], [grip, 4, 15]];
  if (!single) attachments.push([style, 6, 0, 0], ["line", 14, ...anchors[1]], [grip, 6, 16]);
  return { frames, props, dynamic: attachments, ms, shoulders: [11, 12], reference: true };
}

function compose(body: Point[], elbows: Pair, wrists: Pair, anchors: Pair, grip: Grip): Point[] {
  const [head, neck, hip, knee, heel, otherKnee, otherHeel, shoulder, otherShoulder] = body;
  const stem = (anchor: Point, wrist: Point): Point => {
    const distance = Math.hypot(anchor[0] - wrist[0], anchor[1] - wrist[1]);
    return mix(wrist, anchor, 5 / distance);
  };
  const tip = ([x, y]: Point, side: number): Point =>
    grip === "thumb-up" ? [x, y - 8] : [x + side * 5, y - 4];
  return [
    head, neck, hip, elbows[0], wrists[0], elbows[1], wrists[1], knee, heel, otherKnee, otherHeel,
    shoulder, otherShoulder, stem(anchors[0], wrists[0]), stem(anchors[1], wrists[1]),
    tip(wrists[0], 1), tip(wrists[1], -1),
  ];
}

function suspensionCurl(grip: Grip, single: boolean, style: "pad" | "ring" = "pad"): Illustration {
  const anchor: Pair = [[204, 13], [184, 13]];
  const frame = (phase: number): Point[] => {
    const body = lineBody([222, 155], 0.58 + phase * 0.39);
    const shoulder = body[7], otherShoulder = body[8];
    const wrists: Pair = [
      handleOnStrap(anchor[0], 69, 174 - phase * 25),
      single ? mix(body[2], body[4], 0.10) : handleOnStrap(anchor[1], 67, 156 - phase * 25),
    ];
    const highElbow = (point: Point, wrist: Point, side: number): Point =>
      mix(mix(point, wrist, 0.52), [point[0] + 21, point[1] - 21 - side * 2], Math.min(1, phase * 2));
    const elbows: Pair = [highElbow(shoulder, wrists[0], 0),
      single ? mix(otherShoulder, wrists[1], 0.55) : highElbow(otherShoulder, wrists[1], 1)];
    return compose(body, elbows, wrists, anchor, grip);
  };
  return hull(anchor, single, style, grip, phases.map(frame));
}

function suspensionRow(wide: boolean, floor: boolean): Illustration {
  const grip = wide ? "palm-down" : "palm-up";
  const anchors: Pair = [[206, 16], [wide ? 157 : 188, 16]];
  const frame = (phase: number): Point[] => {
    const body = lineBody([225, 156], (floor ? 0.12 : 0.44) + 0.31 * phase);
    const reachX = floor ? 140 : 164;
    const handSpacing = wide ? (floor ? 21 : 34) : 15;
    const wrists: Pair = [
      handleOnStrap(anchors[0], floor ? 114 : 82, reachX + phase * (wide ? 5 : -4)),
      handleOnStrap(anchors[1], floor ? 108 : 77, reachX - handSpacing + phase * (wide ? -4 : -8)),
    ];
    const elbow = (shoulder: Point, wrist: Point, side: number): Point => {
      const straight = mix(shoulder, wrist, 0.53);
      const drawn: Point = [shoulder[0] - (wide ? 20 : 13) + side * 7,
        shoulder[1] + (wide ? 10 : 24) + side * 4];
      return mix(straight, drawn, phase);
    };
    return compose(body, [elbow(body[7], wrists[0], 0), elbow(body[8], wrists[1], -1)], wrists, anchors, grip);
  };
  return hull(anchors, false, "pad", grip, phases.map(frame));
}

function suspensionFly(style: "pad" | "ring"): Illustration {
  const anchors: Pair = [[180, 14], [143, 14]];
  const frame = (phase: number): Point[] => {
    const neck: Point = [149 + phase * 8, 99 - phase * 36];
    const heel: Point = [186, 155], otherHeel: Point = [157, 154];
    const hip = mix(neck, [171, 156], 0.55);
    const body: Point[] = [[neck[0] - 5, neck[1] - 15], neck, hip, mix(hip, heel, 0.60), heel,
      mix(hip, otherHeel, 0.60), otherHeel, [neck[0] + 12, neck[1]], [neck[0] - 12, neck[1] - 3]];
    const wrists: Pair = [
      handleOnStrap(anchors[0], 74, 164 + phase * 55),
      handleOnStrap(anchors[1], 73, 145 - phase * 49),
    ];
    const near = mix(body[7], wrists[0], 0.51), far = mix(body[8], wrists[1], 0.51);
    const elbows: Pair = [[near[0], near[1] + 3], [far[0], far[1] + 2]];
    return compose(body, elbows, wrists, anchors, "thumb-up");
  };
  return hull(anchors, false, style, "thumb-up", phases.map(frame));
}

export const suspensionAttachmentIllustrations: Record<string, Illustration> = {
  "1090": suspensionFly("pad"),
  "1123": suspensionCurl("palm-up", true),
  "4450": suspensionRow(true, false),
  "4451": suspensionRow(true, true),
  "4923": suspensionFly("ring"),
  "5006": suspensionRow(false, false),
  "5007": suspensionCurl("thumb-up", false),
  "6232": suspensionCurl("palm-up", false),
  "6237": suspensionCurl("palm-up", true, "ring"),
};
