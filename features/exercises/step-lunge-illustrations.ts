
import type { Illustration, Point } from "./motion-data";
import { squatLungeVariantsIllustrations } from "./squat-lunge-variants-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Fittings = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Legs = [Limb, Limb];
type Arms = "hips" | "overhead" | "sprint" | "stretch" | "twist";
type Shape = "stand" | "back" | "front" | "side" | "cross" | "lift-back" | "knee" | "kick";

const floor = 155;
const move = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const midpoint = ([x, y]: Point, [a, b]: Point): Point => [(x + a) / 2, (y + b) / 2];

function figure(shoulder: Point, hip: Point, arms: Legs, legs: Legs,
  toes: [Point, Point] = [move(legs[0][1], 9, 1), move(legs[1][1], 8, 1)]): Point[] {
  return [move(shoulder, 4, -14), shoulder, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function view(frames: Point[][], props: Props = [], fittings: Fittings = [], ms = 780): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...fittings], ms, reference: true };
}

const liftFrame = (near: boolean, [x, y]: Point, amount: number): Point =>
  [x + 8 * amount * (near ? 1 : -1), y - Math.sin(amount * Math.PI) * 11];

function swapLegs(frame: Point[]) {
  const [a, b, c, d, e, f] = frame.slice(7, 13);
  return [...frame.slice(0, 7), c, d, a, b, f, e, ...frame.slice(13)];
}

function swapStance(frame: Point[]): Point[] {
  const reversed = swapLegs(frame);
  [reversed[3], reversed[4], reversed[5], reversed[6]] = [reversed[5], reversed[6], reversed[3], reversed[4]];
  return reversed;
}

function syncArms(shoulder: Point, hip: Point, arms: Arms, motion: number): Legs {
  if (arms === "hips") return [[move(shoulder, 17, 21), move(hip, 4, -4)],
    [move(shoulder, -12, 22), move(hip, -5, -3)]];
  if (arms === "sprint") return [[move(shoulder, 13 - motion * 15, 16), move(shoulder, 30 - motion * 29, 1 + motion * 35)],
    [move(shoulder, -10 + motion * 21, 15), move(shoulder, -14 + motion * 42, 32 - motion * 29)]];
  if (arms === "overhead" || arms === "twist") return [
    [move(shoulder, 11 + (arms === "twist" ? 8 : 0), -20), move(shoulder, arms === "twist" ? 21 : 13, -41)],
    [move(shoulder, -9 + (arms === "twist" ? 10 : 0), -20), move(shoulder, arms === "twist" ? 10 : -13, -40)],
  ];
  return [[move(shoulder, 10, 21), move(shoulder, 13, 40)], [move(shoulder, -8, 22), move(shoulder, -11, 41)]];
}

function grounded(shape: Shape, arms: Arms = "hips", phase = 1, partial = 0): Point[] {
  const stepping = shape === "front" || shape === "side" || shape === "back" || shape === "cross";
  const front = shape === "front", lateral = shape === "side", crossover = shape === "cross";
  const fixedAnkle: Point = [154, floor], movingHome: Point = [142, floor];
  const fixedNear: Point = front ? [fixedAnkle[0], floor - (phase >= 1 ? 6 : 0)] : fixedAnkle;
  const target: Point = front ? [199, floor] : lateral ? [203, floor] : crossover ? [188, 149] : [101, 149];
  const active: Point = stepping ? [movingHome[0] + (target[0] - movingHome[0]) * phase,
    movingHome[1] + (target[1] - movingHome[1]) * phase - Math.sin(phase * Math.PI) * 11]
    : shape === "lift-back" ? [108, 107]
      : shape === "knee" ? [169, 119]
        : shape === "kick" ? [218, 98] : movingHome;
  const ready: Point = [148, 90];
  const hip: Point = stepping ? [ready[0] + phase * (front ? 23 : lateral ? 35 : crossover ? 4 : -4), ready[1] + phase * (34 - partial)]
    : [154, shape === "lift-back" ? 91 : 90];
  const shoulder: Point = move(hip, shape === "lift-back" ? 12 : arms === "twist" ? 10 : 4, -39);
  const tight = phase > .9 && stepping;
  const bentFront: Point = [target[0] - 3, 117 + (partial ? -2 : 0)];
  const stabilizer: Point = front ? [158, 121 + (tight ? 24 - partial : 0)]
    : lateral ? midpoint(hip, fixedNear) : tight ? [155, 124 - partial] : midpoint(hip, fixedNear);
  const movingKnee: Point = shape === "lift-back" ? [129, 101] : shape === "knee" ? [181, 87] : shape === "kick" ? [185, 98]
    : tight ? front || lateral ? bentFront : [crossover ? 165 : 125, 150 - partial] : midpoint(hip, active);
  const nearToe: Point = front ? [fixedNear[0] + 11, floor + 1] : move(fixedNear, 9, 1);
  const rearToe: Point = tight && !front && !lateral ? [active[0] + (crossover ? -10 : 11), floor + 1]
    : move(active, shape === "lift-back" ? -7 : 9, 1);
  const pair = syncArms(shoulder, hip, arms, stepping ? phase : 0);
  return figure(shoulder, hip, pair, [[stabilizer, fixedNear], [movingKnee, active]], [nearToe, rearToe]);
}

function rearCombo(kind: "sprinter" | "static-kick" | "reverse-kick" | "stretch-twist" | "reverse-knee-front" | "sprint-high" | "sprint-low") {
  const posture = kind.startsWith("sprint") ? "sprint" : kind === "stretch-twist" ? "overhead" : "hips";
  const ready = grounded("stand", kind === "stretch-twist" ? "stretch" : posture);
  const stepping = grounded("back", posture, .47);
  const bottom = grounded("back", posture, 1, kind === "sprint-high" ? 13 : 0);
  if (kind === "sprinter") return view([ready, stepping, bottom, stepping, ready, ...[stepping, bottom, stepping].map(swapStance)], [], [], 660);
  if (kind === "sprint-high" || kind === "sprint-low") {
    const split = grounded("back", posture, 1, 31);
    return view(kind === "sprint-low" ? [split, bottom, bottom, bottom] : [split, bottom, bottom], [], [], 980);
  }
  if (kind === "static-kick" || kind === "reverse-kick") {
    const launch = grounded("kick"), pass = grounded("knee");
    return view(kind === "static-kick" ? [bottom, pass, launch, pass, stepping, bottom]
      : [ready, stepping, bottom, stepping, pass, launch, pass, stepping], [], [], 730);
  }
  if (kind === "reverse-knee-front") {
    const front = grounded("front"), frontStep = grounded("front", "hips", .52), knee = grounded("knee");
    return view([ready, stepping, bottom, stepping, knee, frontStep, front, frontStep], [], [], 690);
  }
  const twisted = grounded("back", "twist");
  return view([ready, stepping, bottom, twisted, bottom, stepping, ready, ...[stepping, bottom, twisted, bottom, stepping].map(swapLegs)], [], [], 690);
}

function forwardCombo(kind: "pulse" | "directions" | "rear-lift" | "rear-knee") {
  const high = kind === "pulse" ? "overhead" : "hips";
  const ready = grounded("stand", high);
  const mid = grounded("front", high, .5);
  const low = grounded("front", high);
  if (kind === "pulse") {
    const up = grounded("front", high, 1, 7);
    return view([ready, mid, low, up, low, up, low, mid], [], [], 680);
  }
  if (kind === "directions") {
    return view([ready, mid, low, mid, ready, grounded("side", "hips", .5), grounded("side"),
      grounded("side", "hips", .5), ready, grounded("back", "hips", .5), grounded("back"), grounded("back", "hips", .5)], [], [], 630);
  }

  function overFront(lift: "lift-back" | "knee"): Point[] {
    const pose = grounded(lift);
    const support: Point = low[10];
    const bodyShift = support[0] - pose[8][0];
    const translated = pose.map(([x, y]): Point => [x + bodyShift, y]);
    translated[11] = low[12];
    return swapLegs(translated);
  }

  const finish = overFront(kind === "rear-lift" ? "lift-back" : "knee");
  return view([ready, mid, low, finish, finish, low, mid], [], [], 790);
}

type Walking = "ordinary" | "low" | "knees" | "barbell" | "sandbag" | "kettlebell";
function walking(kind: Walking) {
  const highKnee = kind === "knees", lower = kind === "low";
  const attachments: Fittings = kind === "barbell" ? [["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]]
    : kind === "sandbag" ? [["sandbag", 13, 0, 0]]
      : kind === "kettlebell" ? [["kettlebell", 4, 1, 7], ["kettlebell", 6, 1, 7]] : [];

  function at(position: number, lead: boolean, phase: "swing" | "drop" | "rise") {
    const drop = phase === "drop";
    const swing = phase === "swing";
    const activeX = position + (drop ? 52 : swing ? 28 : 12);
    const fixed: Point = [position, floor - (drop ? 6 : 0)];
    const coming: Point = [activeX, drop ? floor : swing && highKnee ? 118 : 141];
    const hip: Point = [position + (drop ? 28 : swing ? 12 : 3), drop ? lower ? 126 : 119 : 88 + (lower ? 7 : 0)];
    const shoulder: Point = move(hip, 4, -39);
    const activeKnee: Point = drop ? [coming[0] - 4, 122] : swing && highKnee ? [activeX + 5, 80] : midpoint(hip, coming);
    const rearKnee: Point = drop ? [position + 13, lower ? 150 : 145] : midpoint(hip, fixed);
    const hands = kind === "barbell" ? [[move(shoulder, 25, 8), move(shoulder, 14, 1)],
      [move(shoulder, 29, 8), move(shoulder, -4, 2)]] as Legs
      : kind === "sandbag" || kind === "kettlebell" ? [
        [move(shoulder, 19, 23), move(shoulder, 15, 5)], [move(shoulder, -3, 22), move(shoulder, 4, 8)],
      ] as Legs : syncArms(shoulder, hip, lower ? "hips" : "sprint", lead ? .25 : .75);
    const pose = figure(shoulder, hip, hands, [[rearKnee, fixed], [activeKnee, coming]],
      [[fixed[0] + 10, floor + 1], move(coming, 10, 1)]);
    const frame = [...pose, move(shoulder, kind === "barbell" ? -26 : 11, kind === "barbell" ? 1 : 12), move(shoulder, 43, 1)];
    return lead ? frame : swapLegs(frame);
  }
  const walk = [at(101, true, "rise"), at(101, true, "swing"), at(101, true, "drop"), at(153, false, "rise"),
    at(153, false, "swing"), at(153, false, "drop"), at(205, true, "rise")];
  const returned = walk.map((frame) => frame.map(([x, y]): Point => [310 - x, y]));
  return view([...walk, ...returned], [], attachments, lower ? 740 : 650);
}

const anchor: Point = [244, 28];
const frontAnchor: Point = [155, 19];
const uprightRig: Props = [[anchor[0], anchor[1], anchor[0], 158], [227, anchor[1], 253, anchor[1]], [232, 158, 254, 158]];
const straps: Fittings = [["line", 4, ...anchor], ["line", 6, ...anchor], ["ring", 4, 0, 0], ["ring", 6, 0, 0]];

function adjustGrip(frame: Point[], height: number, close = false) {
  const output = [...frame];
  for (const hand of [4, 6]) {
    const proximity = hand === 4 ? 1 : -1;
    const shoulder = output[1];
    const y = height + (hand === 6 ? 5 : 0);
    const length = hand === 4 ? 88 : 93;
    const x = anchor[0] - Math.sqrt(length ** 2 - (y - anchor[1]) ** 2);
    output[hand] = [x, y];
    const elbow = midpoint(shoulder, output[hand]);
    output[hand - 1] = move(elbow, close ? -23 : 3, close ? 16 : 4 + proximity);
  }
  return output;
}

function hangingSplit(footCradle: boolean) {
  const rearAnchor: Point = [82, 26];
  const fixedFront: Point = [172, floor];
  const fixedRear: Point = footCradle ? [95, 119] : [105, 149];
  const props: Props = footCradle ? [[80, rearAnchor[1], 80, 155], [66, rearAnchor[1], 102, rearAnchor[1]], [67, 157, 97, 157]] : uprightRig;
  const attachments: Fittings = footCradle ? [["line", 10, ...rearAnchor], ["line", 12, ...rearAnchor], ["ring", 10, 0, 2]] : straps;

  function at(depth: number) {
    const hip: Point = [145, 86 + 36 * depth];
    const shoulder: Point = move(hip, 5, -38);
    const near: Limb = [[157 + 15 * depth, 119 + 4 * depth], fixedFront];
    const far: Limb = [[118 + 13 * depth, 118 + 32 * depth], fixedRear];
    const toe: Point = footCradle ? [107, 123] : [116, floor + 1];
    const pose = figure(shoulder, hip, syncArms(shoulder, hip, "hips", 0), [near, far], [move(fixedFront, 10, 1), toe]);
    return footCradle ? pose : adjustGrip(pose, 70 + 14 * depth);
  }

  return view([at(0), at(.4), at(1), at(1), at(.4)], props, attachments, 850);
}

function suspenderLunge(kind: "back" | "cross" | "side" | "side-cross") {
  const lateral = kind.startsWith("side");
  const deep = kind === "side-cross" ? "cross" : kind;

  function at(progress: number): Point[] {
    const pose = progress === 0 ? grounded("stand") : grounded(deep, "hips", progress);
    if (kind === "side-cross" && progress) {
      const shift = progress * 12;
      for (const i of [0, 1, 2]) pose[i] = move(pose[i], shift, 0);
    }
    if (kind === "side") pose[11] = move(pose[8], -8, 1);
    if (!lateral) return adjustGrip(pose, 69 + 12 * progress);
    const [sx, sy] = pose[1];
    pose[3] = [sx + 19, sy + 15];
    pose[4] = [sx + 12, sy + 10];
    pose[5] = [sx - 19, sy + 18];
    pose[6] = [sx - 12, sy + 12];
    return pose;
  }

  const phases = [at(0), at(.48), at(1), at(1), at(.48)];
  const alternating = lateral ? phases.map((pose) => pose.map(([x, y]): Point => [310 - x, y])) : phases.map(swapLegs);
  const sideRig: Props = [[126, 19, 184, 19], [126, 14, 126, 32], [184, 14, 184, 32]];
  const sideHandles: Fittings = [["line", 4, ...frontAnchor], ["line", 6, ...frontAnchor], ["ring", 4, 0, 0], ["ring", 6, 0, 0]];
  return view([...phases, ...alternating], lateral ? sideRig : uprightRig, lateral ? sideHandles : straps, 730);
}

type Squat = "regular" | "overhead" | "sumo" | "pistol" | "power-row";
function suspenderSquat(kind: Squat) {
  const overhead = kind === "overhead", wide = kind === "sumo", single = kind === "pistol";
  const propulsion = kind === "power-row";
  const nearFoot: Point = [wide ? 188 : 157, floor];
  const other: Point = [wide ? 103 : 143, floor];

  function at(depth: number, pull = false): Point[] {
    const hip: Point = [147 - depth * (wide ? 0 : 19), 89 + depth * (single ? 39 : 33)];
    const shoulder: Point = move(hip, pull ? -7 : depth * 7, -38);
    const movingAnkle: Point = single ? [hip[0] + 67, hip[1] + 22] : other;
    const nearKnee: Point = [nearFoot[0] + 4 + depth * 8, (nearFoot[1] + hip[1]) / 2 - depth * 10];
    const farKnee: Point = single ? midpoint(hip, movingAnkle)
      : [other[0] + (wide ? -10 * depth : 4 + 9 * depth), (floor + hip[1]) / 2 - depth * 11];
    const pose = figure(shoulder, hip, syncArms(shoulder, hip, overhead ? "overhead" : "hips", 0),
      [[nearKnee, nearFoot], [farKnee, movingAnkle]], [move(nearFoot, 9, 1), move(movingAnkle, wide ? -8 : 8, 1)]);
    return overhead ? pose : adjustGrip(pose, pull ? 59 : 76 + depth * 8, pull);
  }

  const handles: Fittings = overhead ? [["line", 4, 206, 12], ["line", 6, 206, 12], ["ring", 4, 0, 0], ["ring", 6, 0, 0]] : straps;
  const prop: Props = overhead ? [[174, 12, 223, 12], [174, 12, 174, 18], [223, 12, 223, 18]] : uprightRig;
  return view(propulsion ? [at(1), at(.46), at(0, true), at(0, true), at(.42), at(1)]
    : [at(0), at(.4), at(1), at(1), at(.45)], prop, handles, 900);
}

function declineBarbell(): Illustration {
  const decline = squatLungeVariantsIllustrations["1551"];
  const frames = decline.frames.map((pose): Point[] => {
    const copy = pose.slice(0, 13);
    const [x, y] = copy[1];
    const shoulder: Point = [x, y];
    copy[3] = move(shoulder, 17, 14);
    copy[4] = move(shoulder, 13, -3);
    copy[5] = move(shoulder, -23, 13);
    copy[6] = move(shoulder, -17, -4);
    return [...copy, move(shoulder, -39, -4), move(shoulder, 29, -4)];
  });
  return view(frames, decline.props, [["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]], 950);
}

const lateralSuspension = suspenderLunge("side");
export const stepLungeIllustrations: Record<string, Illustration> = {
  "1159": lateralSuspension,
  "1119": suspenderLunge("cross"),
  "1129": suspenderLunge("back"),
  "1131": suspenderLunge("side-cross"),
  "1132": lateralSuspension,
  "1100": hangingSplit(true),
  "1099": hangingSplit(false),
  "1143": suspenderSquat("regular"),
  "1141": suspenderSquat("overhead"),
  "1101": suspenderSquat("pistol"),
  "5004": suspenderSquat("sumo"),
  "7279": suspenderSquat("power-row"),
  "3480": rearCombo("sprinter"),
  "3702": forwardCombo("pulse"),
  "3961": forwardCombo("directions"),
  "3952": forwardCombo("rear-knee"),
  "3581": forwardCombo("rear-lift"),
  "0676": rearCombo("reverse-kick"),
  "11088": rearCombo("stretch-twist"),
  "7412": rearCombo("reverse-knee-front"),
  "3482": rearCombo("sprint-high"),
  "3481": rearCombo("sprint-low"),
  "3966": rearCombo("static-kick"),
  "3655": walking("knees"),
  "1460": walking("ordinary"),
  "9700": walking("low"),
  "1518": declineBarbell(),
  "4409": walking("barbell"),
  "8701": walking("sandbag"),
  "4441": walking("kettlebell"),
};