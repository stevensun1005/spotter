import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Load = "reach" | "chest" | "overhead" | "prisoner" | "hands-hips" | "front-bar" | "back-bar"
  | "low-bar" | "zercher-bar" | "frankenstein" | "db-sides" | "db-one" | "db-opposite" | "db-goblet"
  | "db-overhead" | "kb-goblet" | "kb-low" | "kb-side" | "kb-rack" | "kb-back" | "cable-one"
  | "cable-pair" | "cable-overhead" | "cable-zercher" | "bottles" | "bottle-low" | "plate-press"
  | "plate-chest" | "sandbag" | "trap" | "pvc" | "support" | "db-support" | "kb-support";
type Stance = "standard" | "wide" | "narrow";

const ground = 157;
const tower: Props = [[255, 32, 255, 158], [244, 158, 266, 158], [249, 147, 255, 147], [248, 43, 255, 43]];
const rack: Props = [[103, 25, 103, 158], [186, 25, 186, 158], [96, 158, 115, 158], [178, 158, 198, 158], [103, 25, 186, 25]];
const smith: Props = [[107, 26, 107, 158], [180, 26, 180, 158], [112, 33, 112, 151], [175, 33, 175, 151],
  [107, 26, 180, 26], [98, 158, 190, 158]];
const support: Props = [[225, 51, 225, 158], [215, 158, 236, 158]];
const wall: Props = [[102, 31, 102, 158]];

function platform(from: number, to: number, height: number): Props {
  return [[from, height, to, height], [from, height, from, 158], [to, height, to, 158]];
}

function lift(x: number, level: number, direction = -1): Props {
  return [[x - 8, level, x + 5, level], [x - 8, level, x - 8, 158],
    [x + 5, level, x + 5 + direction * 12, 158]];
}

function motion(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 660): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function joint(start: Point, end: Point, direction: number, upper = 34, lower = 35): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const distance = Math.max(0.01, Math.hypot(dx, dy));
  const along = Math.min(upper, (upper * upper - lower * lower + distance * distance) / (2 * distance));
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along)) * direction;
  return [start[0] + (dx * along + dy * bend) / distance, start[1] + (dy * along - dx * bend) / distance];
}

function arms(load: Load, [x, y]: Point, down: boolean): [Limb, Limb] {
  const handsDown: [Limb, Limb] = [[[x + 13, y + 19], [x + 17, y + 40]], [[x - 12, y + 19], [x - 11, y + 40]]];
  const chest: [Limb, Limb] = [[[x + 15, y + 19], [x + 17, y + 7]], [[x - 5, y + 18], [x + 10, y + 7]]];
  const forward: [Limb, Limb] = [[[x + 27, y + 7], [x + 48, y + 12]], [[x + 19, y + 7], [x + 40, y + 12]]];
  switch (load) {
    case "reach": return down ? forward : handsDown;
    case "chest":
    case "db-goblet":
    case "kb-goblet":
    case "cable-pair":
    case "plate-chest":
    case "sandbag": return chest;
    case "cable-zercher":
    case "zercher-bar": return [[[x + 12, y + 21], [x + 8, y + 11]], [[x - 7, y + 19], [x + 5, y + 12]]];
    case "plate-press": return down ? forward : chest;
    case "overhead":
    case "cable-overhead":
    case "db-overhead": return [[[x + 13, y - 16], [x + 14, y - 37]], [[x - 11, y - 16], [x - 12, y - 37]]];
    case "pvc": return [[[x + 19, y - 16], [x + 31, y - 37]], [[x - 19, y - 16], [x - 31, y - 37]]];
    case "prisoner": return [[[x + 18, y - 4], [x - 1, y - 16]], [[x - 21, y - 2], [x - 9, y - 17]]];
    case "hands-hips": return [[[x + 15, y + 18], [x + 4, y + 33]], [[x - 17, y + 18], [x - 7, y + 34]]];
    case "front-bar":
    case "bottles": return [[[x + 23, y + 6], [x + 13, y - 2]], [[x + 6, y + 6], [x - 14, y - 3]]];
    case "low-bar": return [[[x - 11, y + 7], [x - 19, y + 8]], [[x - 20, y + 7], [x - 33, y + 8]]];
    case "back-bar":
    case "kb-back": return [[[x + 10, y + 14], [x + 8, y - 3]], [[x - 21, y + 13], [x - 18, y - 3]]];
    case "frankenstein": return forward;
    case "kb-low":
    case "bottle-low": return [[[x + 14, y + 19], [x + 12, y + 41]], [[x - 1, y + 19], [x + 6, y + 41]]];
    case "kb-rack": return [[[x + 15, y + 16], [x + 10, y + 1]], handsDown[1]];
    case "support": return [[[x + 39, y + 9], [225, 82]], handsDown[1]];
    case "db-support": return [handsDown[0], [[x + 28, y + 11], [225, 82]]];
    case "kb-support": return [chest[0], [[x + 28, y + 11], [225, 82]]];
    default: return handsDown;
  }
}

const bar: Attachments = [["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]];
const loads: Partial<Record<Load, Attachments>> = {
  "front-bar": bar,
  "back-bar": bar,
  "low-bar": bar,
  "zercher-bar": [["bar", 3, 5], ["barbell-end", 3, 3, 0], ["barbell-end", 5, -3, 0]],
  frankenstein: [["barbell-end", 1, 14, 2], ["barbell-end", 1, -14, 2]],
  "db-sides": [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]],
  "db-one": [["dumbbell", 4, 0, 0]],
  "db-opposite": [["dumbbell", 6, 0, 0]],
  "db-goblet": [["hammer-weight", 4, 0, 4]],
  "db-overhead": [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]],
  "kb-goblet": [["kettlebell", 4, -3, 6]],
  "kb-low": [["kettlebell", 4, -3, 8]],
  "kb-side": [["kettlebell", 4, 0, 8]],
  "kb-rack": [["kettlebell", 4, 2, -6]],
  "kb-back": [["kettlebell", 1, -8, 4]],
  "cable-one": [["cable", 4, 251, 147]],
  "cable-pair": [["cable", 4, 251, 147], ["line", 4, 6]],
  "cable-overhead": [["cable", 4, 251, 147], ["line", 4, 6]],
  "cable-zercher": [["cable", 3, 52, 147], ["line", 3, 5]],
  bottles: [["bottle-upright", 4, 0, 0], ["bottle-upright", 6, 0, 0]],
  "bottle-low": [["bottle-upright", 4, -3, 4]],
  "plate-press": [["plate", 4, -1, 0]],
  "plate-chest": [["plate", 4, -1, 0]],
  sandbag: [["sandbag", 4, -6, 1]],
  trap: [["trap-bar", 4, -12, 0]],
  pvc: [["line", 4, 6]],
  "db-support": [["dumbbell", 4, 0, 0]],
  "kb-support": [["kettlebell", 4, -2, 8]],
};

function pose(shoulder: Point, hip: Point, nearLeg: Limb, farLeg: Limb, hands: [Limb, Limb]): Point[] {
  return [[shoulder[0] + 4, shoulder[1] - 14], shoulder, hip, ...hands[0], ...hands[1], ...nearLeg, ...farLeg];
}

type Squat = {
  load?: Load;
  stance?: Stance;
  depth?: "quarter" | "deep";
  support?: "bench" | "box" | "chair" | "heel" | "rack" | "smith" | "smith-bench" | "smith-chair" | "pins" | "wall" | "ball-wall" | "post";
  cadence?: "pulse" | "hold" | "pause" | "dip" | "press" | "calf";
  tension?: "band";
};

function squat({ load = "reach", stance = "standard", depth, support: fixture, cadence, tension }: Squat = {}) {
  const wide = stance === "wide";
  const guided = fixture === "smith" || fixture === "smith-bench" || fixture === "smith-chair";
  const atWall = fixture === "wall" || fixture === "ball-wall";
  const frontView = wide || stance === "narrow";
  const feet: [Point, Point] = stance === "wide" ? [[190, ground], [100, ground]]
    : stance === "narrow" ? [[153, ground], [137, ground]] : [[163, ground], [145, ground]];
  if (fixture === "heel") feet.forEach((foot) => { foot[1] -= 5; });
  const high = fixture === "heel" ? 83 : atWall ? fixture === "wall" ? 100 : 96 : 88;
  const low = depth === "quarter" ? 99 : depth === "deep" ? 127
    : fixture === "box" ? 122 : fixture === "bench" || fixture === "smith-bench" ? 119
      : fixture === "chair" || fixture === "smith-chair" ? 118 : 121;

  const make = (y: number, lifted = false) => {
    const bend = (y - high) / Math.max(1, low - high);
    const hip: Point = [atWall ? fixture === "ball-wall" ? 131 : 110 : frontView ? 145 : guided ? 143 : 145 - bend * 17, y];
    const shoulder: Point = [guided ? 143 : atWall ? hip[0] : hip[0] + (fixture === "heel" ? 4 : load === "low-bar" ? 26 : 12) * bend, y - 38];
    const raiseHeels = lifted && cadence === "calf";
    const a: Point = raiseHeels ? [feet[0][0] + 2, feet[0][1] - 8] : feet[0];
    const b: Point = raiseHeels ? [feet[1][0] + 2, feet[1][1] - 8] : feet[1];
    const side = ([x]: Point) => x > hip[0] ? 1 : -1;
    const fore = frontView
      ? [a[0] + side(a) * (3 + 8 * bend), (y * 0.62 + a[1] * 0.38)] as Point
      : joint(hip, a, 1);
    const far = frontView
      ? [b[0] + side(b) * (3 + 8 * bend), (y * 0.62 + b[1] * 0.38)] as Point
      : joint([hip[0] - 7, y + 2], b, 1);
    const figure = pose(shoulder, hip, [fore, a], [far, b], arms(cadence === "press" ? lifted ? "overhead" : "chest" : load, shoulder, bend > 0.15));
    if (cadence === "calf" || fixture === "heel" || frontView) {
      const toeY = cadence === "calf" || fixture === "heel" ? ground : a[1];
      figure.push([feet[0][0] + 9, toeY], [feet[1][0] + (frontView ? -9 : 9), toeY]);
    }
    return figure;
  };
  const props: Props = [];
  if (fixture === "bench" || fixture === "smith-bench" || fixture === "chair" || fixture === "smith-chair") {
    const chair = fixture.endsWith("chair");
    props.push(...platform(76, frontView || guided ? 158 : 131, low + 5));
    if (chair) props.push([76, low + 5, 76, 80]);
  }
  if (fixture === "box") {
    const right = frontView ? 160 : 130;
    props.push(...platform(84, right, low + 5), [84, 158, right, 158]);
  }
  if (fixture === "heel") props.push(...feet.flatMap((foot) => lift(foot[0], foot[1] + 3, 1)));
  if (fixture === "rack" || fixture === "pins" || tension === "band") props.push(...rack);
  if (fixture === "pins") {
    const bottom = make(low);
    const height = Math.max(bottom[4][1], bottom[6][1]) + 3;
    props.push([103, height, 126, height], [143, height, 186, height]);
  }
  if (guided) props.push(...smith);
  if (atWall) props.push(...wall);
  if (fixture === "post") props.push(...support);
  if (load.startsWith("cable-")) {
    props.push(...(load === "cable-zercher" ? [[50, 32, 50, 158], [42, 158, 59, 158]] as Props : tower));
  }

  const dynamic: Attachments = [...(loads[load] ?? [])];
  if (cadence === "calf" || fixture === "heel" || frontView) dynamic.push(["foot-tip", 8, 11], ["foot-tip", 10, 12]);
  if (fixture === "ball-wall") dynamic.push(["stability-ball", 2, -13, -7]);
  if (tension === "band") dynamic.push(["band", 4, 183, 155], ["band", 6, 105, 155]);
  const top = make(high);
  const bottom = make(low);
  const frames = cadence === "hold" ? [top, bottom, bottom, bottom, bottom]
    : cadence === "pause" ? [bottom, bottom, top]
      : cadence === "pulse" ? [top, bottom, make(low - 6), bottom, make(low - 6), bottom]
        : cadence === "dip" ? [top, bottom, top, top]
          : cadence === "press" ? [top, bottom, top, make(high - 1, true), top]
            : cadence === "calf" ? [top, bottom, top, make(high - 7, true), top]
              : [top, bottom];
  return motion(frames, props, dynamic, cadence === "hold" ? 950 : cadence === "dip" ? 355 : 720);
}

type Split = {
  load?: Load;
  rear?: "bench" | "chair";
  front?: "heel" | "step";
  assisted?: boolean;
  guided?: boolean;
  hinge?: boolean;
  hold?: boolean;
};

function splitSquat({ load = "hands-hips", rear, front, assisted, guided, hinge, hold }: Split = {}) {
  const frontFoot: Point = [183, front ? 147 : ground];
  const rearFoot: Point = [94, rear ? 120 : ground];
  const props: Props = [
    ...(rear ? platform(57, 105, rearFoot[1] + 3) : []),
    ...(front === "heel" ? lift(frontFoot[0], 150, 1) : front ? platform(163, 203, 150) : []),
    ...(assisted ? support : []),
    ...(guided ? smith : []),
  ];
  if (rear === "chair") props.push([57, 123, 57, 82]);
  const make = (deep: boolean) => {
    const hip: Point = [guided ? 145 : deep ? 145 : 140, deep ? 124 : 94];
    const shoulder: Point = [hip[0] + (hinge && deep ? 23 : 3), hip[1] - 37];
    return pose(shoulder, hip, [[deep ? 181 : 167, deep ? (front ? 118 : 122) : 120], frontFoot],
      [[deep ? 119 : 110, deep ? 151 : 124], rearFoot], arms(load, shoulder, deep));
  };
  const lower = make(true);
  return motion(hold ? [make(false), lower, lower, lower] : [make(false), lower], props, loads[load], 800);
}

function singleSquat({ fixture, quarter, skate }: { fixture?: "post" | "box" | "bench" | "step" | "wall"; quarter?: boolean; skate?: boolean } = {}) {
  const elevated = fixture === "step";
  const x = fixture === "wall" ? 111 : 141;
  const foot: Point = [171, elevated ? 121 : ground];
  const props: Props = fixture === "wall" ? wall : fixture === "post" ? support
    : fixture === "box" ? platform(64, 130, 136) : fixture === "bench" ? platform(64, 130, 125)
      : elevated ? platform(120, 184, 124) : [];
  const make = (deep: boolean) => {
    const y = deep ? elevated ? 95 : quarter ? 101 : fixture === "box" ? 131 : 119 : elevated ? 53 : 87;
    const hip: Point = [fixture === "wall" ? x : deep ? x - 15 : x, y];
    const shoulder: Point = [fixture === "wall" ? x : hip[0] + (deep ? 19 : 4), y - 36];
    const free: Limb = skate ? (deep ? [[97, 152], [80, 137]] : [[124, 118], [108, 102]])
      : elevated ? [[194, deep ? 126 : 98], [198, deep ? 153 : 131]]
        : [[hip[0] + (deep ? 35 : 21), y + (deep ? 6 : 25)], [hip[0] + (deep ? 66 : 44), deep ? y + 11 : y + 44]];
    return pose(shoulder, hip, [joint(hip, foot, 1), foot], free, arms(fixture === "post" ? "support" : "reach", shoulder, true));
  };
  return motion([make(false), make(true)], props, [], 790);
}

function sideSquat() {
  const feet: [Point, Point] = [[197, ground], [99, ground]];
  const make = (direction: -1 | 0 | 1) => {
    const lower = direction !== 0;
    const hip: Point = [147 + 28 * direction, lower ? 119 : 87];
    const shoulder: Point = [147 + 32 * direction, lower ? 82 : 50];
    return pose(shoulder, hip, [[direction > 0 ? 204 : direction < 0 ? 159 : 178, direction < 0 ? 138 : 122], feet[0]],
      [[direction < 0 ? 92 : direction > 0 ? 137 : 119, direction > 0 ? 138 : 122], feet[1]], arms("reach", shoulder, true));
  };
  return motion([make(0), make(1), make(0), make(-1)], [], [], 790);
}

type Step = {
  load?: Load;
  surface?: "bench" | "low" | "high" | "chair";
  lateral?: boolean;
  finish?: "knee-drive" | "cross" | "toe-tap" | "jump" | "twist" | "hover";
  forwardLean?: boolean;
  guided?: boolean;
};

function stepUp({ load = "reach", surface = "low", lateral, finish = "hover", forwardLean, guided }: Step = {}) {
  const topY = surface === "high" ? 104 : surface === "chair" ? 116 : surface === "bench" ? 121 : 130;
  const left = lateral ? 152 : 157;
  const right = 223;
  const lead: Point = [179, topY - 3];
  const bottomFoot: Point = [lateral ? 108 : 129, ground];
  const props: Props = [...platform(left, right, topY)];
  if (surface === "chair") props.push([right, topY, right, topY - 39]);
  if (surface === "bench") props.push([left + 3, topY + 4, right - 3, topY + 4]);
  if (guided) props.push(...smith.map(([x1, y1, x2, y2]): Props[number] => [x1 + 32, y1, x2 + 32, y2]));
  if (load.startsWith("cable-")) props.push(...tower);
  const startHip: Point = [guided ? 177 : lateral ? 130 : 145, 101];
  const tallBox = surface === "high" || surface === "chair";
  const topHip: Point = [177, lead[1] - (tallBox ? 56 : 68)];
  const torsoHeight = tallBox ? 22 : surface === "bench" ? 23 : 32;
  const withLead = (hip: Point, trailing: Point, final: boolean, airborne = false) => {
    const kneeUp = final && (finish === "knee-drive" || finish === "cross" || finish === "twist");
    const leading: Point = airborne ? [lead[0], lead[1] - 14] : lead;
    const shoulder: Point = [hip[0] + (forwardLean && !final ? 19 : lateral || guided ? 0 : 3),
      hip[1] - torsoHeight + (airborne ? 8 : 0)];
    const knee: Point = kneeUp ? [finish === "cross" ? hip[0] - 24 : hip[0] + 28, hip[1] + 1]
      : lateral ? [Math.min(hip[0], trailing[0]) + 9, (hip[1] + trailing[1]) / 2] : joint(hip, trailing, 1);
    const hands = arms(load, shoulder, !final);
    if (finish === "twist") {
      hands[0] = final ? [[hip[0] + 17, hip[1] - 4], [hip[0] + 13, hip[1] - 21]]
        : arms("prisoner", shoulder, false)[0];
      hands[1] = arms("prisoner", shoulder, false)[1];
    }
    const leadKnee: Point = lateral ? [176 + (final ? 0 : 5), (hip[1] + leading[1]) / 2]
      : tallBox ? joint(hip, leading, 1, 28, 29) : joint(hip, leading, 1);
    return pose(shoulder, hip, [leadKnee, leading], [knee, trailing], hands);
  };
  const moved: Point = finish === "toe-tap" || finish === "jump" ? [lateral ? 161 : 196, topY - 3]
    : finish === "knee-drive" || finish === "twist" ? [195, topHip[1] + 25]
      : finish === "cross" ? [160, topHip[1] + 24] : [lateral ? 147 : 149, topY + 8];
  const high = withLead(topHip, moved, true);
  const low = withLead(startHip, bottomFoot, false);
  const halfway = withLead([guided ? 177 : (startHip[0] + topHip[0]) / 2, (startHip[1] + topHip[1]) / 2],
    [lateral ? 119 : 143, (ground + moved[1]) / 2], false);
  const topFrames = finish === "jump" ? [withLead([topHip[0], topHip[1] - 10], [moved[0], moved[1] - 20], true, true), high] : [high];
  return motion([low, halfway, ...topFrames, halfway], props, loads[load], finish === "jump" ? 450 : 620);
}

function stairStep() {
  const steps: Props = [[145, ground, 145, 137], [145, 137, 188, 137], [188, 137, 188, 115], [188, 115, 232, 115], [232, 115, 232, ground]];
  const phase = (hip: Point, first: Point, other: Point) => {
    const shoulder: Point = [hip[0] + 3, hip[1] - 31];
    return pose(shoulder, hip, [joint(hip, first, 1), first], [joint(hip, other, 1), other], arms("reach", shoulder, false));
  };
  return motion([
    phase([118, 91], [157, 134], [113, ground]),
    phase([151, 70], [159, 134], [205, 112]),
    phase([202, 56], [190, 112], [210, 112]),
    phase([157, 69], [158, 134], [208, 112]),
  ], steps, [], 640);
}

function stepDown() {
  const props = platform(90, 153, 127);
  const planted: Point = [145, 124];
  const make = (low: boolean) => {
    const hip: Point = [low ? 132 : 146, low ? 88 : 60];
    const shoulder: Point = [hip[0] + (low ? 12 : 4), hip[1] - 36];
    const free: Point = [174, low ? ground : 124];
    return pose(shoulder, hip, [joint(hip, planted, 1), planted], [joint(hip, free, 1), free], arms("reach", shoulder, true));
  };
  return motion([make(false), make(true), make(true)], props, [], 720);
}

type Press = "horizontal" | "angled-lever" | "sled" | "vertical" | "outdoor";

function legPress(mode: Press, stance: Stance = "standard", single = false, high = false) {
  const seatHip: Point = mode === "vertical" ? [147, 143] : mode === "sled" || mode === "angled-lever" ? [133, 124] : [116, 112];
  const shoulder: Point = mode === "vertical" ? [108, 142] : mode === "sled" || mode === "angled-lever" ? [101, 97] : [105, 73];
  const center: Point = mode === "vertical" ? [154, 92] : mode === "sled" || mode === "angled-lever" ? [178, 96] : [173, 109];
  const travel: Point = mode === "vertical" ? [0, -17] : mode === "sled" || mode === "angled-lever" ? [13, -12] : [14, 0];
  const supportLeg: Limb = [[seatHip[0] + 22, seatHip[1] + 6], [seatHip[0] + 26, Math.min(154, seatHip[1] + 25)]];
  const grips: [Limb, Limb] = [
    [[shoulder[0] + 13, shoulder[1] + 22], [seatHip[0] + 3, seatHip[1] + 6]],
    [[shoulder[0] + 6, shoulder[1] + 23], [seatHip[0] - 7, seatHip[1] + 5]],
  ];
  const props: Props = [
    [shoulder[0] - 7, shoulder[1] + 7, seatHip[0] - 5, seatHip[1] + 6],
    [seatHip[0] - 11, seatHip[1] + 6, seatHip[0] + 15, seatHip[1] + 6],
    [seatHip[0], seatHip[1] + 6, seatHip[0], 158],
  ];
  if (mode === "vertical") props.push([125, 53, 125, 155], [183, 53, 183, 155], [125, 53, 183, 53]);
  else if (mode === "sled") props.push([151, 148, 242, 57], [155, 153, 246, 62], [237, 63, 237, 158], [150, 158, 249, 158]);
  else if (mode === "angled-lever") props.push([230, 63, 230, 158], [171, 158, 244, 158]);
  else if (mode === "outdoor") props.push([147, 158, 230, 158], [187, 158, 224, 75], [224, 75, 238, 75]);
  else props.push([152, 129, 224, 129], [155, 136, 227, 136], [219, 136, 219, 158], [152, 158, 232, 158]);

  const span = stance === "wide" ? 12 : stance === "narrow" ? 2 : 7;
  const make = (extended: boolean) => {
    const stop: Point = [center[0] + (extended ? travel[0] : 0), center[1] + (extended ? travel[1] : 0)];
    const footPosition = (offset: number): Point => {
      const angled = mode === "sled" || mode === "angled-lever";
      return [stop[0] - 2 + (angled ? (offset / 19) * 9 : 0), stop[1] + offset];
    };
    const foot: Point = mode === "vertical" ? [stop[0] + span, stop[1] + 4]
      : footPosition(high ? -11 : single ? 0 : span / 2);
    const other: Point = mode === "vertical" ? [stop[0] - span, stop[1] + 4]
      : footPosition(high ? -17 : -span / 2);
    const deckTop: Point = mode === "vertical" ? [stop[0] - 21, stop[1]] : [stop[0] - (mode === "horizontal" || mode === "outdoor" ? 0 : 9), stop[1] - 19];
    const deckBottom: Point = mode === "vertical" ? [stop[0] + 21, stop[1]] : [stop[0] + (mode === "horizontal" || mode === "outdoor" ? 0 : 9), stop[1] + 19];
    const loadingPin: Point = mode === "vertical" ? [stop[0], stop[1] - 8] : [stop[0] + 13, stop[1] + 5];
    const figure = pose(shoulder, seatHip, [joint(seatHip, foot, 1), foot],
      single ? supportLeg : [joint([seatHip[0] - 7, seatHip[1]], other, 1), other], grips);
    if (mode === "vertical") figure[0] = [92, 141];
    else if (mode === "sled" || mode === "angled-lever") figure[0] = [91, 86];
    return [...figure, deckTop, deckBottom, loadingPin];
  };
  const dynamic: Attachments = [["line", 11, 12]];
  if (mode === "sled" || mode === "vertical") dynamic.push(["barbell-end", 13, 0, 0]);
  if (mode === "angled-lever") dynamic.push(["line", 13, 229, 66], ["barbell-end", 13, 0, 0]);
  if (mode === "outdoor") dynamic.push(["line", 12, 226, 76]);
  return motion([make(false), make(true)], props, dynamic, 820);
}

function hackSquat(reverse = false, single = false, wide = false, deep = false, vertical = false) {
  const rails: Props = vertical
    ? [[121, 45, 121, 152], [128, 45, 128, 152], [109, 158, 217, 158], [144, 151, 196, 151]]
    : [[110, 147, 188, 51], [104, 148, 181, 52], [177, 63, 177, 158], [96, 158, 214, 158], [139, 155, 201, 147]];
  const foot: Point = wide ? [192, 148] : [178, 150];
  const other: Point = wide ? [146, 152] : [166, 152];
  const make = (bottom: boolean) => {
    const height = bottom ? deep ? 124 : 115 : 82;
    const shoulderX = vertical ? 143 : bottom ? 156 : 178;
    const hip: Point = [reverse ? shoulderX + (bottom ? vertical ? 31 : 27 : 8) : vertical ? 143 : shoulderX - 19, height];
    const shoulder: Point = [shoulderX, hip[1] - 33];
    const hands: [Limb, Limb] = reverse
      ? [[[shoulder[0] - 8, shoulder[1] + 18], [shoulder[0] - 17, shoulder[1] + 2]], [[shoulder[0] - 17, shoulder[1] + 15], [shoulder[0] - 24, shoulder[1] + 2]]]
      : [[[shoulder[0] + 11, shoulder[1] + 16], [shoulder[0] + 6, shoulder[1] + 2]], [[shoulder[0], shoulder[1] + 14], [shoulder[0] - 4, shoulder[1] + 2]]];
    const padTop: Point = [shoulder[0] - (reverse ? 9 : 13), shoulder[1] - 9];
    const padBottom: Point = [reverse ? shoulder[0] - 18 : hip[0] - 12, reverse ? shoulder[1] + 28 : hip[1] + 12];
    const bend = reverse ? -1 : wide ? 0.65 : 1;
    const head = pose(shoulder, hip, [joint(hip, foot, bend), foot],
      single ? [[hip[0] + 7, hip[1] + 21], [hip[0] + 5, Math.min(142, hip[1] + 40)]] : [joint(hip, other, bend), other], hands);
    if (reverse) head[0] = [shoulder[0] - 5, shoulder[1] - 14];
    const face: Point = [head[0][0] + (reverse ? -5 : 5), head[0][1]];
    return [...head, padTop, padBottom, face];
  };
  return motion([make(false), make(true)], rails, [["line", 11, 12], ["pad", 11, 0, 0], ["barbell-end", 12, -6, 0], ["face", 0, 13]], 830);
}

function floorPress(alternating: boolean) {
  const hip: Point = [126, 147];
  const shoulder: Point = [91, 147];
  const grasp: [Limb, Limb] = [[[102, 128], [127, 126]], [[103, 139], [128, 135]]];
  const flexed: Limb = [[133, 111], [154, 111]];
  const farFlexed: Limb = [[124, 107], [147, 106]];
  const extension: Limb = [[160, 126], [188, 112]];
  const farExtension: Limb = [[154, 116], [182, 105]];
  const make = (near: Limb, far: Limb) => {
    const frame = pose(shoulder, hip, near, far, grasp);
    frame[0] = [77, 146];
    return frame;
  };
  const base = make(flexed, farFlexed);
  return motion(alternating ? [base, make(extension, farFlexed), base, make(flexed, farExtension)] : [base, make(extension, farExtension)],
    [], [["band", 8, 4], ["band", 10, 6]], 670);
}

function ballCurl() {
  const shoulder: Point = [96, 147];
  const hip: Point = [142, 138];
  const arms: [Limb, Limb] = [[[114, 151], [136, 153]], [[102, 155], [121, 156]]];
  const frames = [
    pose(shoulder, hip, [[176, 131], [212, 123]], [[169, 132], [205, 123]], arms),
    pose(shoulder, hip, [[155, 104], [183, 123]], [[148, 105], [176, 123]], arms),
  ];
  for (const frame of frames) frame[0] = [82, 146];
  return motion(frames, [], [["stability-ball", 8, 0, 18]], 780);
}

const airSquat = squat();
const elevatedHeelSquat = squat({ depth: "deep", support: "heel" });
const lowPulleySquat = squat({ load: "cable-pair" });
const handsOverhead = squat({ load: "overhead" });
const airSumo = squat({ load: "chest", stance: "wide" });
const chestKettlebellSquat = squat({ load: "kb-goblet", depth: "deep" });
const basicStep = stepUp();
const distantDumbbellStep = stepUp({ load: "db-sides", surface: "bench" });
const narrowSledPress = legPress("sled", "narrow");

export const lowerBodyIllustrations: Readonly<Record<string, Illustration>> = {
  "3948": airSquat,
  "4714": squat({ depth: "deep" }),
  "5659": squat({ load: "back-bar", depth: "deep", support: "pins", cadence: "pause" }),
  "4061": squat({ load: "back-bar", support: "bench", tension: "band" }),
  "3530": squat({ load: "back-bar", support: "rack", tension: "band" }),
  "9516": squat({ load: "back-bar", depth: "deep", support: "heel", cadence: "pause" }),
  "4178": squat({ load: "back-bar", depth: "deep", support: "heel" }),
  "3727": squat({ load: "front-bar", support: "bench" }),
  "3871": squat({ load: "front-bar", tension: "band" }),
  "3311": squat({ load: "front-bar", depth: "deep", support: "rack" }),
  "0878": squat({ load: "back-bar", depth: "deep", support: "rack" }),
  "1525": squat({ load: "front-bar", depth: "quarter", cadence: "dip" }),
  "1868": squat({ load: "low-bar", support: "rack" }),
  "5633": squat({ load: "back-bar", stance: "narrow" }),
  "1527": squat({ load: "back-bar", depth: "deep" }),
  "4848": squat({ load: "front-bar", support: "pins", cadence: "pause" }),
  "5701": squat({ load: "back-bar", support: "pins", cadence: "pause" }),
  "1514": squat({ load: "back-bar", depth: "quarter" }),
  "1063": squat({ load: "back-bar", stance: "wide" }),
  "3309": squat({ load: "front-bar", depth: "deep" }),
  "1446": squat({ load: "zercher-bar", cadence: "hold" }),
  "2560": squat({ support: "bench", cadence: "pause" }),
  "6541": squat({ support: "bench" }),
  "10168": squat({ stance: "wide", support: "box" }),
  "9691": squat({ load: "chest", depth: "deep", support: "heel" }),
  "4561": elevatedHeelSquat,
  "7577": elevatedHeelSquat,
  "4499": squat({ depth: "deep", cadence: "press" }),
  "4703": squat({ depth: "deep", cadence: "press" }),
  "5630": squat({ stance: "narrow" }),
  "4294": squat({ load: "overhead", depth: "deep" }),
  "9702": squat({ load: "chest", depth: "deep", cadence: "pulse" }),
  "3535": squat({ cadence: "pulse" }),
  "10914": squat({ depth: "quarter" }),
  "6344": squat({ cadence: "hold" }),
  "6600": squat({ load: "support", support: "post" }),
  "4797": squat({ load: "support", support: "post" }),
  "1546": squat({ load: "hands-hips", support: "wall" }),
  "6044": squat({ load: "bottles" }),
  "6045": squat({ load: "bottle-low", stance: "wide" }),
  "3349": lowPulleySquat,
  "3354": squat({ load: "cable-pair", depth: "deep" }),
  "6544": lowPulleySquat,
  "11252": squat({ load: "cable-overhead" }),
  "9878": squat({ load: "cable-zercher" }),
  "9690": squat({ load: "db-goblet", depth: "deep", support: "heel" }),
  "7547": squat({ load: "db-goblet", stance: "wide" }),
  "7469": squat({ load: "db-goblet", cadence: "calf" }),
  "5634": squat({ load: "db-sides", stance: "narrow" }),
  "3709": squat({ load: "db-overhead", depth: "deep" }),
  "0412": squat({ load: "db-sides", support: "ball-wall" }),
  "0435": squat({ load: "db-goblet", stance: "wide", support: "ball-wall" }),
  "1558": squat({ load: "db-sides", support: "wall" }),
  "1562": squat({ load: "hands-hips", support: "ball-wall" }),
  "5496": squat({ load: "kb-goblet", depth: "deep", support: "heel" }),
  "4963": squat({ load: "kb-goblet", support: "box", cadence: "pause" }),
  "4123": squat({ load: "kb-rack" }),
  "10673": chestKettlebellSquat,
  "10674": squat({ load: "kb-back" }),
  "4089": squat({ load: "kb-low", stance: "wide" }),
  "5073": squat({ load: "kb-low", stance: "wide" }),
  "1580": squat({ load: "prisoner" }),
  "4606": squat({ load: "pvc", depth: "deep", stance: "wide" }),
  "4789": sideSquat(),
  "4788": sideSquat(),
  "11303": squat({ load: "back-bar", support: "smith-bench" }),
  "1594": squat({ load: "frankenstein", support: "smith" }),
  "1595": squat({ load: "front-bar", support: "smith" }),
  "1596": squat({ load: "back-bar", support: "smith-bench" }),
  "6796": squat({ load: "back-bar", stance: "wide", support: "smith-chair" }),
  "1598": squat({ load: "zercher-bar", support: "smith" }),
  "0783": handsOverhead,
  "1064": airSumo,
  "4936": airSumo,
  "4805": squat({ stance: "wide" }),
  "9323": squat({ support: "bench", stance: "wide" }),
  "4128": squat({ load: "plate-press" }),
  "0852": squat({ load: "plate-chest" }),
  "10384": squat({ load: "sandbag" }),
  "5304": squat({ load: "trap" }),

  "4442": splitSquat({ load: "support", rear: "bench", assisted: true }),
  "4397": splitSquat({ load: "front-bar" }),
  "6329": splitSquat({ load: "back-bar" }),
  "3030": splitSquat({ load: "back-bar" }),
  "7552": splitSquat({ load: "zercher-bar", rear: "bench" }),
  "7551": splitSquat({ load: "chest", rear: "bench", front: "heel" }),
  "6327": splitSquat(),
  "10906": splitSquat({ hold: true }),
  "3743": splitSquat({ rear: "chair" }),
  "4443": splitSquat({ load: "db-support", rear: "bench", assisted: true }),
  "7550": splitSquat({ load: "db-sides", rear: "bench", front: "step" }),
  "7598": splitSquat({ load: "db-opposite", rear: "bench", hinge: true }),
  "7590": splitSquat({ load: "db-sides", rear: "bench", hinge: true }),
  "7549": splitSquat({ load: "db-goblet", rear: "bench" }),
  "3691": splitSquat({ load: "db-goblet" }),
  "2956": splitSquat({ load: "db-goblet", front: "step" }),
  "5028": splitSquat({ load: "db-goblet" }),
  "4048": splitSquat({ load: "db-one" }),
  "6328": splitSquat({ load: "db-sides" }),
  "9315": splitSquat({ rear: "bench" }),
  "4444": splitSquat({ load: "kb-support", rear: "bench", assisted: true }),
  "4059": splitSquat({ load: "kb-goblet" }),
  "9042": splitSquat({ load: "back-bar", rear: "bench", guided: true }),
  "9041": splitSquat({ load: "back-bar", front: "step", guided: true }),
  "11568": splitSquat({ load: "back-bar", rear: "bench", front: "step", guided: true }),
  "0781": splitSquat(),
  "2752": splitSquat(),

  "4072": singleSquat({ fixture: "wall" }),
  "7560": singleSquat(),
  "7561": singleSquat({ fixture: "post" }),
  "4892": singleSquat({ fixture: "step" }),
  "2984": singleSquat({ fixture: "box" }),
  "3367": singleSquat({ skate: true }),
  "2375": singleSquat({ fixture: "post" }),
  "1762": singleSquat({ fixture: "post" }),
  "1578": singleSquat({ quarter: true }),
  "4790": singleSquat({ fixture: "bench" }),
  "3493": singleSquat({ fixture: "box" }),

  "6797": stepUp({ load: "back-bar", lateral: true, surface: "bench" }),
  "3728": stepUp({ load: "front-bar", surface: "bench" }),
  "4401": stepUp({ load: "back-bar", finish: "knee-drive" }),
  "5277": stepUp({ surface: "bench", forwardLean: true }),
  "4579": stepUp({ finish: "toe-tap" }),
  "5315": stepUp({ load: "cable-pair", forwardLean: true }),
  "7586": stepUp({ load: "cable-one", forwardLean: true }),
  "10119": stepUp({ load: "cable-pair", lateral: true, finish: "toe-tap" }),
  "10048": stepUp({ load: "cable-pair", finish: "toe-tap" }),
  "10120": stepUp({ load: "cable-one" }),
  "5314": stepUp({ load: "db-sides", surface: "bench", forwardLean: true }),
  "2468": stepUp({ load: "db-sides", surface: "bench", lateral: true, finish: "toe-tap" }),
  "2925": distantDumbbellStep,
  "4821": distantDumbbellStep,
  "4986": distantDumbbellStep,
  "4565": stepUp({ load: "db-sides", surface: "bench", finish: "knee-drive" }),
  "10864": stepUp({ surface: "high", finish: "toe-tap" }),
  "0479": stepUp({ surface: "bench", finish: "knee-drive" }),
  "3765": stepUp({ finish: "jump" }),
  "4134": stepUp({ load: "kb-side" }),
  "4400": stepUp({ load: "kb-goblet" }),
  "4440": stepUp({ load: "kb-side", surface: "bench" }),
  "5154": stepUp({ lateral: true }),
  "5155": stepUp({ lateral: true, finish: "knee-drive" }),
  "2562": stepUp({ lateral: true, finish: "jump" }),
  "0733": stepUp({ finish: "toe-tap" }),
  "4795": stepUp({ surface: "bench", forwardLean: true }),
  "3711": basicStep,
  "0884": stepUp({ load: "back-bar", surface: "bench", lateral: true, guided: true }),
  "11879": stepUp({ load: "back-bar", surface: "bench", guided: true }),
  "0801": basicStep,
  "11450": stairStep(),
  "0799": stepUp({ finish: "cross" }),
  "9490": stepUp({ finish: "toe-tap" }),
  "3444": stepUp({ surface: "chair", finish: "toe-tap" }),
  "0800": stepUp({ finish: "twist" }),
  "4256": stepDown(),
  "1602": stepUp({ surface: "bench", lateral: true, finish: "toe-tap" }),

  "8375": legPress("angled-lever"),
  "9387": legPress("angled-lever", "standard", true),
  "2951": legPress("horizontal"),
  "3768": legPress("horizontal"),
  "2267": legPress("horizontal"),
  "3385": legPress("horizontal"),
  "7107": legPress("horizontal", "standard", true),
  "6354": legPress("outdoor"),
  "2224": legPress("sled"),
  "3616": narrowSledPress,
  "3617": legPress("sled", "wide"),
  "1575": narrowSledPress,
  "6734": legPress("sled", "standard", true),
  "7593": legPress("sled", "wide", false, true),
  "4327": legPress("vertical"),
  "6523": hackSquat(),
  "1992": hackSquat(false, false, false, true),
  "1579": hackSquat(false, true),
  "1583": hackSquat(true),
  "4100": hackSquat(false, false, true),
  "5784": hackSquat(true, false, false, false, true),
  "0569": ballCurl(),
  "8142": floorPress(false),
  "4681": floorPress(true),
};
