import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Load = "none" | "barbell" | "trap" | "dumbbells" | "dumbbell-one" | "dumbbell-far"
  | "dumbbell-center" | "kettlebell" | "kettlebell-side" | "kettlebell-far" | "kettlebells"
  | "bottles" | "sandbag" | "band" | "band-row" | "landmine" | "cable" | "cable-behind"
  | "band-behind" | "strap-behind" | "strap" | "bar-shoulder" | "safety-bar" | "plate-chest"
  | "bottle-chest" | "dumbbell-chest" | "kettlebell-chest" | "medicine-ball" | "bag"
  | "band-shoulder" | "hands-head" | "pvc-shoulder" | "pvc-spine" | "zercher" | "lever"
  | "belt" | "belt-straight" | "belt-v" | "hack" | "ball-support" | "dumbbell-swing" | "plate";
type Fixture = "none" | "platform" | "bench" | "blocks" | "foot-box" | "foot-bench" | "hip-post"
  | "wall" | "smith" | "pins" | "assist" | "lever" | "belt" | "hack";
type Stance = "normal" | "wide" | "single" | "staggered" | "straddle";
type Action = "lift" | "rdl" | "stiff" | "hinge" | "seated" | "kneeling";
type Sequence = "pause" | "two-thirds" | "clean-step" | "row" | "over-row" | "adduction"
  | "touch" | "reach" | "hold" | "knee-up" | "high-pull" | "squat" | "cross" | "rotation" | "lunge-press";
type Hinge = {
  load?: Load;
  fixture?: Fixture;
  stance?: Stance;
  action?: Action;
  sequence?: Sequence;
  grip?: "wide" | "narrow" | "rear" | "plates" | "sides" | "hook";
  tension?: "below" | "above" | "chains";
  pinStart?: boolean;
};

const ground = 157;
const staticProps: Partial<Record<Fixture, Props>> = {
  platform: [[105, 149, 175, 149], [105, 149, 105, 159], [175, 149, 175, 159]],
  bench: [[103, 138, 156, 138], [109, 138, 109, 158], [150, 138, 150, 158]],
  "foot-box": [[76, 129, 111, 129], [76, 129, 76, 158], [111, 129, 111, 158]],
  "foot-bench": [[55, 120, 106, 120], [62, 120, 62, 158], [98, 120, 98, 158]],
  "hip-post": [[103, 96, 119, 96], [103, 103, 119, 103], [105, 103, 105, 158], [95, 158, 116, 158]],
  wall: [[219, 34, 219, 158]],
  smith: [[105, 24, 105, 157], [190, 24, 190, 157], [105, 24, 190, 24], [100, 158, 200, 158], [110, 30, 110, 149], [185, 30, 185, 149]],
  pins: [[102, 24, 102, 158], [202, 24, 202, 158], [102, 24, 202, 24], [93, 158, 211, 158], [102, 87, 133, 87], [168, 87, 202, 87]],
  assist: [[72, 21, 219, 21], [72, 21, 72, 158], [219, 21, 219, 158], [63, 158, 81, 158], [210, 158, 229, 158]],
  lever: [[113, 155, 265, 155], [249, 153, 249, 82], [240, 83, 262, 83], [249, 136, 257, 136]],
  belt: [[103, 151, 185, 151], [103, 155, 185, 155], [92, 158, 263, 158], [247, 157, 247, 120], [247, 120, 258, 120]],
  hack: [[206, 30, 254, 151], [213, 26, 261, 148], [234, 157, 270, 157], [138, 151, 188, 151], [183, 157, 207, 157]],
};
const frontTower: Props = [[246, 26, 246, 158], [257, 30, 257, 158], [240, 158, 264, 158], [246, 146, 254, 146], [246, 28, 257, 31], [250, 101, 257, 101]];
const backTower: Props = [[65, 31, 65, 158], [52, 35, 52, 158], [44, 158, 78, 158], [64, 146, 56, 146], [52, 35, 65, 31], [52, 104, 58, 104]];
const smallBench: Props = [[87, 119, 155, 119], [96, 119, 96, 157], [149, 119, 149, 157]];
const bar: Attachments = [["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]];
const lowAnchor: Point = [247, 147];
const rearAnchor: Point = [64, 147];

function shifted([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function sideKnee(hip: Point, ankle: Point, upper = 34, lower = 36): Point {
  const dx = ankle[0] - hip[0];
  const dy = ankle[1] - hip[1];
  const length = Math.max(1, Math.hypot(dx, dy));
  const along = Math.min(upper, (length * length + upper * upper - lower * lower) / (2 * length));
  const offset = Math.sqrt(Math.max(0, upper * upper - along * along));
  return [hip[0] + (dx * along + dy * offset) / length, hip[1] + (dy * along - dx * offset) / length];
}

function torso(hip: Point, angle: number): [Point, Point, Point] {
  const theta = angle * Math.PI / 180;
  const n = Math.sin(theta);
  const up = -Math.cos(theta);
  return [shifted(hip, 57 * n, 57 * up), shifted(hip, 41 * n, 41 * up), hip];
}

function pose(body: [Point, Point, Point], nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb): Point[] {
  return [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg];
}

function motion(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 910): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function handOnChest(shoulder: Point, reverse = false): Limb {
  return [shifted(shoulder, reverse ? -5 : 17, 19), shifted(shoulder, reverse ? 11 : 13, 9)];
}

function hangingArm(shoulder: Point, wrist: Point, far = false): Limb {
  const elbow: Point = [(shoulder[0] + wrist[0]) / 2 - (far ? 5 : 3), (shoulder[1] + wrist[1]) / 2];
  return [elbow, wrist];
}

function kneelingHinge() {
  const near: Limb = [[154, 156], [119, 157]];
  const far: Limb = [[145, 156], [110, 157]];
  const make = (bend: boolean) => {
    const body = torso(bend ? [119, 134] : [151, 118], bend ? 41 : 1);
    const first: Point = bend ? [141, 148] : [162, 137];
    const second = shifted(first, -6, 0);
    return pose(body, hangingArm(body[1], first), hangingArm(shifted(body[1], -5, 1), second, true), near, far);
  };
  return motion([make(false), make(true)], backTower, [["cable", 4, ...rearAnchor], ["cable", 6, ...rearAnchor]]);
}

function hinge({ load = "none", fixture = "none", stance = "normal", action = "rdl", sequence, grip, tension, pinStart }: Hinge = {}) {
  if (action === "kneeling") return kneelingHinge();
  const groundY = fixture === "platform" ? 147 : fixture === "bench" ? 136 : fixture === "belt" || fixture === "hack" ? 149 : ground;
  const props: Props = [...(staticProps[fixture] ?? [])];
  const dynamic: Attachments = [];
  const wide = stance === "wide";
  const single = stance === "single";
  const staggered = stance === "staggered" || fixture === "foot-box" || fixture === "foot-bench";
  const rearLoad = load === "cable-behind" || load === "band-behind" || load === "strap-behind";
  const frontAnchor = load === "strap" ? [236, 26] as Point : lowAnchor;
  const behindAnchor = load === "strap-behind" ? [64, 34] as Point : rearAnchor;
  const shouldersLoaded = load === "bar-shoulder" || load === "safety-bar" || load === "band-shoulder" || load === "pvc-shoulder" || load === "bag" || load === "hack";
  const nearFoot: Point = [wide ? 169 : 150, groundY];
  const farFoot: Point = [fixture === "foot-box" ? 101 : fixture === "foot-bench" ? 98 : stance === "straddle" ? 114 : staggered ? 125 : wide ? 117 : 140,
    fixture === "foot-box" ? 127 : fixture === "foot-bench" ? 118 : staggered ? groundY - 4 : groundY - 2];

  if (action === "seated") props.push(...smallBench);
  if (pinStart && fixture === "smith") props.push([105, 87, 133, 87], [169, 87, 190, 87]);
  if (fixture === "blocks") props.push([114, 135, 173, 135], [114, 135, 114, 158], [173, 135, 173, 158]);
  if (load === "cable") props.push(...frontTower);
  if (load === "band-row") props.push([247, 107, 247, 158], [236, 158, 258, 158]);
  if (load === "cable-behind") props.push(...backTower);
  if (load === "band-behind") props.push([64, 107, 64, 158], [52, 158, 76, 158]);
  if (load === "strap-behind") props.push([64, 34, 64, 157], [53, 157, 77, 157]);
  if (load === "strap") props.push([frontAnchor[0], 22, frontAnchor[0], 110], [frontAnchor[0] - 17, 22, frontAnchor[0] + 12, 22]);
  if (load === "landmine") props.push([244, 153, 266, 153], [252, 153, 252, 158], [242, 158, 268, 158]);
  if (load === "ball-support") {
    props.push([222, 30, 222, 158]);
    dynamic.push(["ball", 6, 9, 0]);
  }

  const dumbbells: Attachments = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
  const kettle: Attachments = [["kettlebell", 4, 0, 7]];
  if (load === "barbell" || load === "bar-shoulder") dynamic.push(...bar);
  if (load === "trap") dynamic.push(["trap-bar", 4, -10, 0]);
  if (load === "dumbbells") dynamic.push(...dumbbells);
  if (load === "dumbbell-one" || load === "dumbbell-chest") dynamic.push(dumbbells[0]);
  if (load === "dumbbell-far") dynamic.push(dumbbells[1]);
  if (load === "dumbbell-center" || load === "dumbbell-swing") dynamic.push(["hammer-weight", 4, -3, 1]);
  if (load === "plate") dynamic.push(["plate", 4, -5, 3]);
  if (load === "kettlebell" || load === "kettlebell-side" || load === "kettlebell-chest") dynamic.push(...kettle);
  if (load === "kettlebell-far") dynamic.push(["kettlebell", 6, 0, 7]);
  if (load === "kettlebells") dynamic.push(...kettle, ["kettlebell", 6, 0, 7]);
  if (load === "bottles") dynamic.push(["bottle-upright", 4, 0, -4], ["bottle-upright", 6, 0, -4]);
  if (load === "sandbag" || load === "bag") dynamic.push(["sandbag", 4, -4, 1]);
  if (load === "band" || load === "band-shoulder") dynamic.push(["band", 4, ...nearFoot], ["band", 6, ...farFoot]);
  if (load === "band-row") dynamic.push(["band", 4, ...frontAnchor]);
  if (load === "landmine") dynamic.push(["bar", 4, 253, 153], ["barbell-end", 4, 11, 2]);
  if (load === "cable" || rearLoad || load === "strap") {
    const anchor = rearLoad ? behindAnchor : frontAnchor;
    const kind = load.startsWith("band") ? "band" : "cable";
    dynamic.push([kind, 4, ...anchor], [kind, 6, ...anchor]);
    if (load === "cable") dynamic.push(["bar", 4, 6]);
  }
  if (load === "medicine-ball") dynamic.push(["ball", 4, -3, 4]);
  if (load === "plate-chest") dynamic.push(["plate", 4, -3, 3]);
  if (load === "bottle-chest") dynamic.push(["bottle", 4, 0, 0]);
  if (load === "pvc-shoulder" || load === "pvc-spine") dynamic.push(["line", 4, 6]);
  if (load === "safety-bar") dynamic.push(["bar", 11, 12], ["barbell-end", 11, 0, 5], ["barbell-end", 12, 0, 5], ["bar", 4, 11], ["bar", 6, 12]);
  if (load === "zercher") dynamic.push(["bar", 3, 5], ["barbell-end", 3, 0, 0], ["barbell-end", 5, 0, 0]);
  if (load === "lever") dynamic.push(["bar", 4, 6], ["bar", 4, 248, 134], ["barbell-end", 4, 41, 1]);
  if (load.startsWith("belt")) {
    dynamic.push(["pad", 2, 0, 2], ["cable", 2, 148, 151], ["bar", 2, 247, 120], ["barbell-end", 2, 42, 10]);
    if (load === "belt-straight") dynamic.push(["bar", 4, 6]);
    if (load === "belt-v") dynamic.push(["line", 4, 11], ["line", 6, 11]);
  }
  if (load === "hack") dynamic.push(["pad", 1, 6, -4], ["bar", 1, 11], ["pad", 11, 0, 0], ["barbell-end", 11, 0, 0]);
  if (tension === "below") dynamic.push(["band", 4, ...nearFoot], ["band", 6, ...farFoot]);
  if (tension === "above") dynamic.push(["band", 4, 198, 22], ["band", 6, 94, 22]);
  if (tension === "chains") dynamic.push(["chain", 4, 9, 159], ["chain", 6, -9, 159]);
  if (grip === "hook") dynamic.push(["thumb-up", 4, 12], ["thumb-up", 6, 13]);
  dynamic.push(["foot-tip", 8, 14], ["foot-tip", 10, 15], ["face", 0, 16]);

  const bottomAngle = action === "lift" ? wide ? 43 : 53 : action === "stiff" ? 83 : action === "seated" ? 47 : single ? 82 : 70;
  const topY = action === "seated" ? 110 : groundY - 68;

  function make(depth: number, stage = "") {
    const lifting = action === "lift";
    const squat = stage === "squat" || stage === "lunge-press";
    const kneeUp = stage === "knee-up";
    const hipX = action === "seated" ? 135 : fixture === "hip-post" ? 128 - 2 * depth
      : 143 - (squat ? 13 : lifting ? (wide ? 10 : 27) : action === "stiff" ? 12 : single ? 12 : 20) * depth;
    const hipY = topY + (squat ? 33 : lifting ? 26 : action === "stiff" ? 2 : 5) * depth;
    const body = torso([hipX, hipY], squat ? 12 : bottomAngle * depth);
    const [, shoulder, hip] = body;
    const [sx, sy] = shoulder;
    const activeShift = stage === "cross" || stage === "rotation" ? -17 : 0;
    const elevatedFar = fixture === "foot-box" || fixture === "foot-bench";
    const movingFar: Point = single ? kneeUp ? [173, 124] : [136 - 63 * depth, groundY - 11 - 53 * depth]
      : stage === "clean-step" ? [171, groundY] : stage === "lunge-press" ? [91, groundY - 2] : farFoot;
    const nearKnee: Point = wide ? [hipX + (nearFoot[0] - hipX) * 0.58 + depth * 13, hipY + (groundY - hipY) * 0.53]
      : action === "seated" ? [163, 118] : sideKnee(hip, nearFoot);
    const farKnee: Point = single ? kneeUp ? [176, 94] : [movingFar[0] + (hipX - movingFar[0]) * 0.54, movingFar[1] + (hipY - movingFar[1]) * 0.51]
      : wide ? [hipX + (farFoot[0] - hipX) * 0.58 - depth * 13, hipY + (groundY - hipY) * 0.53]
        : action === "seated" ? [153, 117] : sideKnee(shifted(hip, -5, 1), movingFar, elevatedFar ? 33 : 34);

    const center = grip === "narrow" || rearLoad || load === "dumbbell-center" || load === "kettlebell"
      || load === "landmine" || load === "belt-v" || load === "sandbag";
    const side = grip === "sides" || load === "kettlebell-side" || load === "kettlebells" || load === "trap";
    const barHeight = fixture === "blocks" ? 125 : 149;
    const bottomY = lifting ? barHeight - (load === "kettlebell" || load === "kettlebell-side" || load === "kettlebells" || load === "sandbag" ? 8 : 0)
      : action === "stiff" ? Math.min(151, groundY + (fixture === "bench" ? 9 : 0)) : 139 - (fixture === "platform" ? 6 : 0);
    const wristY = 112 - (ground - groundY) + (bottomY - 112 + ground - groundY) * depth;
    const guided = fixture === "smith" && !shouldersLoaded;
    let frontX = guided ? 158 : rearLoad || load === "dumbbell-swing" ? 157 - 40 * depth
      : grip === "rear" ? 126 - 9 * depth : fixture === "bench" ? 154 + 13 * depth : 151 + 7 * depth;
    if (load === "landmine") frontX = 253 - Math.sqrt(113 ** 2 - (wristY - 153) ** 2);
    frontX += activeShift;
    const secondX = center ? frontX - 8 : grip === "plates" ? 104 : grip === "wide" ? 117 : side ? frontX - 23 : frontX - 12;
    let first: Point = [grip === "plates" ? 183 : grip === "wide" ? 171 : frontX, wristY];
    let second: Point = [secondX, wristY - (side ? 3 : 0)];
    if (stance === "straddle") second = [125 - 14 * depth, wristY - 3];
    if (load === "dumbbell-far" || load === "kettlebell-far") first = shifted(shoulder, -12, 31);
    if (load === "dumbbell-one" || load === "kettlebell-side") second = shifted(shoulder, -11, 36);
    if (load === "ball-support") second = [203, 75 + depth * 10];
    if (load === "strap") {
      first = [sx + 43, sy + 10];
      second = [sx + 37, sy + 9];
    }
    if (fixture === "wall") second = [216, 87];
    if (stage === "toe") {
      first = [nearFoot[0] + 9, groundY - 8];
      second = [nearFoot[0] - 3, groundY - 10];
    }
    if (stage === "reach") {
      first = shifted(shoulder, 46, -4);
      second = shifted(shoulder, 40, -2);
    }
    let frontArm = hangingArm(shoulder, first);
    let rearArm = hangingArm(shifted(shoulder, -5, 0), second, true);

    if (shouldersLoaded) {
      const across = fixture === "smith" ? 151 : sx - 13;
      frontArm = [[sx + 16, sy + 17], [across + 26, sy - 3]];
      rearArm = [[sx - 23, sy + 14], [across - 20, sy - 3]];
      if (load === "bag") {
        frontArm[1] = [sx + 5, sy - 5];
        rearArm[1] = [sx - 12, sy - 7];
      }
      if (load === "safety-bar") {
        frontArm[1] = [sx + 18, sy + 16];
        rearArm[1] = [sx + 4, sy + 16];
      }
    }
    if (load.endsWith("-chest") || load === "medicine-ball") {
      frontArm = handOnChest(shoulder);
      rearArm = handOnChest(shoulder, true);
      if (load === "medicine-ball") {
        frontArm[1] = shifted(shoulder, 15, 13 + 9 * depth);
        rearArm[1] = shifted(shoulder, 10, 12 + 9 * depth);
      }
    }
    if (load === "hands-head") {
      frontArm = [shifted(shoulder, 16, -5), shifted(body[0], 3, 5)];
      rearArm = [shifted(shoulder, -13, -9), shifted(body[0], -8, 4)];
    }
    if (load === "pvc-spine") {
      const spineX = shoulder[0] - hip[0];
      const spineY = shoulder[1] - hip[1];
      frontArm = [shifted(shoulder, 18, 15), shifted(hip, 1.47 * spineX - 5, 1.47 * spineY - 4)];
      rearArm = [shifted(hip, -24, -11), shifted(hip, -0.18 * spineX - 5, -0.18 * spineY - 4)];
    }
    if (load === "zercher") {
      frontArm = [shifted(shoulder, 19, 25), shifted(shoulder, 29, 7)];
      rearArm = [shifted(shoulder, 4, 24), shifted(shoulder, 10, 7)];
    }
    if (stage === "row" || stage === "over-row") {
      frontArm = [shifted(shoulder, -13, 10), shifted(shoulder, 4, 20)];
      if (stage === "over-row") rearArm = [shifted(shoulder, -23, 11), shifted(shoulder, -2, 19)];
    }
    if (stage === "adduction") {
      frontArm[0] = shifted(shoulder, 10, 19);
      rearArm[0] = shifted(shoulder, -15, 19);
      frontArm[1] = shifted(shoulder, 20, 35);
      rearArm[1] = shifted(shoulder, -18, 35);
    }
    if (stage === "high-pull" || stage === "clean" || stage === "clean-step") {
      const clean = stage !== "high-pull";
      frontArm = [shifted(shoulder, 21, clean ? 10 : -5), shifted(shoulder, 6, clean ? 1 : 7)];
      rearArm = [shifted(shoulder, -13, clean ? 8 : -5), shifted(shoulder, -2, clean ? 1 : 7)];
    }
    if (stage === "squat" && load === "kettlebell") {
      frontArm = handOnChest(shoulder);
      rearArm = handOnChest(shoulder, true);
    }
    if (stage === "lunge-press") {
      frontArm = [shifted(shoulder, 13, -21), shifted(shoulder, 8, -37)];
      rearArm = [shifted(shoulder, -9, -22), shifted(shoulder, -4, -37)];
    }
    const figure = pose(body, frontArm, rearArm, [nearKnee, nearFoot], [farKnee, movingFar]);
    figure.push(load === "safety-bar" ? shifted(shoulder, 17, 0) : load === "hack" ? [217, 58 + 19 * depth] : shifted(frontArm[1], -4, 4),
      load === "safety-bar" ? shifted(shoulder, -15, 0) : shifted(frontArm[1], 5, -3), shifted(rearArm[1], -4, -3),
      shifted(nearFoot, 9, 1), shifted(movingFar, single && !kneeUp ? 2 : 9, single && !kneeUp ? 7 : 1),
      shifted(body[0], 4.5, 1 + 5 * depth));
    return figure;
  }

  const bottom = sequence === "touch" ? make(1, "toe") : sequence === "reach" ? make(1, "reach")
    : sequence === "cross" ? make(1, "cross") : sequence === "rotation" ? make(1, "rotation") : make(1);
  const top = make(0);
  let frames = action === "lift" || pinStart ? [bottom, top] : [top, bottom];
  if (sequence === "pause") frames = [bottom, make(0.85), make(0.85), top, make(0.85)];
  if (sequence === "two-thirds") frames = [bottom, make(0.34)];
  if (sequence === "hold") frames = [top, bottom, bottom, bottom, bottom];
  if (sequence === "clean-step") frames = [top, bottom, top, make(0, "clean"), make(0.05, "clean-step"), make(0, "clean")];
  if (sequence === "row") frames = [top, bottom, top, make(0, "row"), top];
  if (sequence === "over-row") frames = [top, bottom, make(1, load === "band-row" ? "row" : "over-row"), bottom, top];
  if (sequence === "adduction") frames = [bottom, top, make(0, "adduction"), top];
  if (sequence === "knee-up") frames = [top, bottom, top, make(0, "knee-up"), top];
  if (sequence === "high-pull") frames = [bottom, top, make(0, "high-pull"), top];
  if (sequence === "squat") frames = [top, bottom, top, make(1, "squat"), top];
  if (sequence === "lunge-press") frames = [top, bottom, top, make(1, "lunge-press"), top];
  return motion(frames, props, dynamic, sequence === "hold" ? 1180 : 900);
}

type Extension = {
  bench?: "angled" | "ghd" | "ball" | "flat" | "incline" | "floor";
  weight?: "dumbbell" | "plate" | "ball" | "band" | "zercher" | "towel";
  legs?: "pair" | "single" | "frog" | "split";
  reverse?: boolean;
  style?: "twist" | "adduction" | "reach" | "arms-only" | "press" | "hands-head" | "hold" | "lower-only" | "smith" | "suspension" | "bench-support";
};

const flatDeck: Props = [[74, 108, 166, 108], [88, 108, 88, 158], [159, 108, 159, 158], [72, 157, 104, 157], [148, 157, 170, 157]];
const inclineDeck: Props = [[75, 79, 166, 112], [88, 84, 88, 157], [155, 108, 155, 157], [68, 157, 168, 157]];
const angledDeck: Props = [[114, 157, 146, 104], [138, 100, 157, 95], [149, 100, 173, 157], [90, 157, 187, 157],
  [102, 157, 107, 142], [97, 142, 117, 142], [91, 154, 106, 158]];
const ghdDeck: Props = [[109, 106, 150, 106], [117, 112, 150, 112], [129, 111, 129, 157], [94, 157, 169, 157],
  [85, 109, 85, 157], [85, 108, 113, 108], [87, 103, 105, 103]];

function extension({ bench = "angled", weight, legs = "pair", reverse = false, style }: Extension = {}) {
  const floor = bench === "floor";
  const stabilityBall = bench === "ball";
  const ghd = bench === "ghd";
  const incline = bench === "incline";
  const fixture: Props = bench === "angled" ? [...angledDeck] : bench === "flat" ? [...flatDeck]
    : incline ? [...inclineDeck] : ghd ? [...ghdDeck] : [];
  const dynamic: Attachments = [];
  const hip: Point = floor ? [159, 148] : stabilityBall ? [155, 120] : [151, 97];
  const hipAnchor: Point = floor ? [155, 147] : stabilityBall ? [150, 118] : [164, incline ? 102 : 98];
  if (stabilityBall) dynamic.push(["stability-ball", 2, 0, 20]);
  if (style === "bench-support") fixture.push([72, 132, 112, 132], [79, 132, 79, 157], [105, 132, 105, 157]);
  if (stabilityBall && !reverse) fixture.push([53, 27, 53, 158]);
  if (style === "smith") {
    fixture.push([202, 38, 202, 157], [232, 38, 232, 157], [202, 38, 232, 38], [201, 157, 241, 157]);
    dynamic.push(["bar", 8, 10], ["barbell-end", 8, 0, -3], ["barbell-end", 10, 0, -3]);
  }
  if (style === "suspension") {
    fixture.push([237, 23, 237, 154], [216, 23, 253, 23], [220, 157, 252, 157]);
    dynamic.push(["cable", 8, 232, 28], ["cable", 10, 239, 28], ["ring", 8, 0, 1], ["ring", 10, 0, 1]);
  }
  if (weight === "dumbbell") dynamic.push(["dumbbell", reverse ? 8 : 4, reverse ? 3 : 0, 0]);
  if (weight === "plate") dynamic.push(["plate", 4, 2, 4]);
  if (weight === "zercher") dynamic.push(["bar", 3, 5], ["barbell-end", 3, 0, 0], ["barbell-end", 5, 0, 0]);
  if (weight === "ball") dynamic.push(["ball", 8, 3, 0]);
  if (weight === "towel") dynamic.push(["line", 4, 6]);
  if (weight === "band") {
    if (!reverse && !floor) dynamic.push(["band", 1, 107, 150], ["band", 1, 101, 150]);
    if (floor && !reverse) dynamic.push(["band", 1, 4], ["band", 1, 6]);
    if (reverse && legs === "split") dynamic.push(["band", 8, 10]);
    if (reverse && legs !== "split") dynamic.push(["band", 8, 165, 158], ["band", 10, 173, 158]);
  }

  function backbench(depth: number, stage?: "twist" | "adduction") {
    const body = torso(hip, (ghd ? 90 : stabilityBall ? 72 : 45) + (ghd || stabilityBall ? 47 : 63) * depth);
    const [, shoulder] = body;
    const near: Limb = ghd ? [[115, 98], [86, 100]] : stabilityBall ? [[113, 139], [60, 151]] : [[126, 124], [103, 146]];
    const far: Limb = legs === "single" ? ghd ? [[119, 91], [85, 84]] : [[123, 115], [93, 128]]
      : [shifted(near[0], -5, 2), shifted(near[1], -6, 1)];
    let first = handOnChest(shoulder);
    let second = handOnChest(shoulder, true);
    if (weight === "zercher") {
      first = [shifted(shoulder, 14, 22), shifted(shoulder, 25, 10)];
      second = [shifted(shoulder, -1, 22), shifted(shoulder, 8, 11)];
    }
    if (style === "adduction") {
      first = stage === "adduction" ? [shifted(shoulder, 8, 20), shifted(shoulder, 1, 41)] : [shifted(shoulder, 16, 22), shifted(shoulder, 25, 36)];
      second = stage === "adduction" ? [shifted(shoulder, -24, 14), shifted(shoulder, -32, 29)] : [shifted(shoulder, -14, 18), shifted(shoulder, -20, 36)];
    }
    if (stage === "twist") {
      body[0] = shifted(body[0], 5, 2);
      first = handOnChest(shifted(shoulder, 6, -6));
      second = handOnChest(shifted(shoulder, -10, 9), true);
    }
    return pose(body, first, second, near, far);
  }

  function prone(top: boolean, press = false, spread = false) {
    const anchor = reverse ? hipAnchor : hip;
    const shoulder: Point = floor ? [117, top && !reverse ? 132 : 147] : stabilityBall ? [114, 119] : [109, incline ? 81 : 96];
    const head = shifted(shoulder, -15, 0);
    const body: [Point, Point, Point] = [head, shoulder, anchor];
    const armLower = style === "bench-support" ? 129 : floor ? 153 : stabilityBall ? 151 : 109;
    let first: Limb = [shifted(shoulder, -4, 12), [96, armLower]];
    let second: Limb = [shifted(shoulder, 3, 17), [101, armLower - 1]];
    if (style === "hands-head") {
      first = [shifted(shoulder, 0, 11), shifted(head, -6, 5)];
      second = [shifted(shoulder, 6, 6), shifted(head, 0, 2)];
    }
    if (style === "reach" || style === "arms-only" || style === "hold" || press || weight === "towel") {
      first = [shifted(shoulder, -22, 3), shifted(shoulder, -44, 4)];
      second = [shifted(shoulder, -19, 9), shifted(shoulder, -42, 10)];
    }
    if (style === "press" && !press) {
      first = [shifted(shoulder, 1, 15), shifted(shoulder, -17, 12)];
      second = [shifted(shoulder, 3, 18), shifted(shoulder, -12, 16)];
    }
    if (style === "suspension") {
      const shoulderY = top ? 123 : 145;
      body[1] = [119, shoulderY];
      body[0] = [103, shoulderY + 2];
      first = handOnChest(body[1]);
      second = handOnChest(body[1], true);
    }

    let near: Limb;
    let far: Limb;
    if (floor) {
      const lift = top && style !== "lower-only" && style !== "hands-head" && style !== "press" && style !== "arms-only";
      near = [[194, lift ? 141 : 152], [229, lift ? 128 : 155]];
      far = [[189, lift ? 144 : 153], [220, lift ? 133 : 155]];
    } else if (style === "suspension") {
      near = [[199, 125], [234, 123]];
      far = [[196, 128], [230, 126]];
    } else {
      const level = stabilityBall ? 122 : 97;
      const knee: Point = top ? [196, level + (incline ? 16 : 0)] : [185, level + 25];
      const ankle: Point = top ? [232, level + (incline ? 27 : 0)] : [208, Math.min(154, level + 58)];
      near = [knee, ankle];
      far = [shifted(knee, -5, 4), shifted(ankle, -10, 4)];
      if (style === "smith") {
        near = [knee, [220, level + (top ? 0 : 50)]];
        far = [shifted(knee, -5, 4), [210, level + (top ? 2 : 52)]];
      }
    }
    if (reverse && legs === "single") far = floor ? [[188, 152], [220, 155]] : [[181, 122], [201, 152]];
    if (legs === "frog") {
      near = [[197, top ? 96 : 138], [210, top ? 111 : 154]];
      far = [[184, top ? 109 : 133], [210, top ? 115 : 155]];
    }
    if (spread) {
      near = [[194, 133], [225, 111]];
      far = [[186, 148], [214, 151]];
    }
    return pose(body, first, second, near, far);
  }

  if (reverse || floor || style === "suspension") {
    const low = prone(false);
    const high = prone(true);
    if (style === "hold") return motion([low, high, high, high, high], fixture, dynamic, 1100);
    if (style === "press") return motion([low, high, prone(true, true), high], fixture, dynamic, 760);
    if (legs === "split") return motion([low, high, prone(true, false, true), high], fixture, dynamic, 780);
    return motion([low, high], fixture, dynamic);
  }

  const top = backbench(0);
  const bottom = backbench(1);
  if (style === "twist") return motion([top, bottom, top, backbench(0, "twist")], fixture, dynamic, 760);
  if (style === "adduction") return motion([bottom, top, backbench(0, "adduction"), top], fixture, dynamic, 810);
  return motion([top, bottom], fixture, dynamic);
}

function seatedLeverExtension() {
  const hip: Point = [145, 112];
  const legs: [Limb, Limb] = [[[179, 115], [178, 151]], [[171, 116], [169, 151]]];
  const make = (angle: number) => {
    const body = torso(hip, angle);
    const shoulder = body[1];
    return pose(body, handOnChest(shoulder), handOnChest(shoulder, true), ...legs);
  };
  const props: Props = [[120, 122, 162, 122], [133, 122, 133, 156], [119, 155, 187, 155], [111, 39, 111, 157], [100, 157, 118, 157]];
  return motion([make(35), make(0)], props, [["bar", 1, 111, 126], ["pad", 1, -7, 4]]);
}

function backViewDeadlift() {
  const make = (up: boolean) => {
    const hip: Point = [150, up ? 89 : 111];
    const y = up ? 48 : 86;
    const head: Point = [150, y - (up ? 17 : 11)];
    const shoulder: Point = [150, y];
    const barHeight = up ? 109 : 149;
    const first: Limb = [[171, (y + barHeight) / 2], [176, barHeight]];
    const second: Limb = [[129, (y + barHeight) / 2], [124, barHeight]];
    const near: Limb = [[up ? 162 : 172, up ? 123 : 137], [162, 156]];
    const far: Limb = [[up ? 138 : 128, up ? 123 : 137], [138, 156]];
    return pose([head, shoulder, hip], first, second, near, far);
  };
  return motion([make(false), make(true)], [], [...bar, ["foot", 8, 168, 157], ["foot", 10, 132, 157]]);
}

function kettlebellPass() {
  const base = hinge({ stance: "single", action: "stiff" });
  const [top, bottom] = base.frames;
  const carry = (frame: Point[], side: "near" | "far" | "both"): Point[] => {
    const result = [...frame];
    if (side === "near") result[6] = shifted(frame[1], -12, 35);
    if (side === "far") result[4] = shifted(frame[1], 14, 28);
    if (side === "both") {
      result[4] = [151, 143];
      result[6] = [147, 143];
    }
    result[11] = side === "near" ? result[4] : side === "far" ? result[6] : [149, 143];
    return result;
  };
  const pass = carry(bottom, "both");
  return motion([carry(top, "near"), carry(bottom, "near"), pass, carry(bottom, "far"), carry(top, "far"),
    carry(bottom, "far"), pass, carry(bottom, "near")], [], [...base.dynamic!, ["kettlebell", 11, 0, 7]], 630);
}

function leverKickback() {
  const props: Props = [[118, 145, 169, 145], [118, 145, 118, 158], [166, 145, 166, 158], [107, 158, 226, 158],
    [204, 155, 204, 60], [189, 62, 206, 62], [188, 66, 203, 66]];
  const body: [Point, Point, Point] = [[177, 64], [170, 81], [135, 109]];
  const first: Limb = [[163, 97], [192, 64]];
  const second: Limb = [[154, 97], [188, 67]];
  const near: Limb = [[144, 141], [109, 142]];
  const make = (kick: boolean) => pose(body, first, second, near,
    kick ? [[101, 102], [69, 92]] : [[125, 134], [101, 141]]);
  return motion([make(false), make(true)], props, [["bar", 10, 203, 115], ["pad", 10, 8, -1], ["barbell-end", 10, 21, 2]]);
}

function leverCurlAndRaise() {
  const deck: Props = [[70, 106, 161, 106], [83, 106, 83, 158], [148, 106, 148, 158],
    [67, 158, 246, 158], [217, 39, 217, 157], [230, 39, 230, 157], [214, 39, 233, 39]];
  const make = (stage: "low" | "curl" | "raise") => {
    const body: [Point, Point, Point] = [[79, 94], [98, 93], [157, 97]];
    const near: Limb = stage === "curl" ? [[191, 115], [176, 83]]
      : stage === "raise" ? [[193, 96], [227, 96]] : [[186, 118], [213, 143]];
    const far: Limb = [shifted(near[0], -6, 2), shifted(near[1], -8, 3)];
    return pose(body, [[90, 113], [75, 110]], [[100, 114], [86, 111]], near, far);
  };
  const low = make("low");
  return motion([low, make("curl"), low, make("raise"), low], deck,
    [["bar", 8, 220, 119], ["pad", 8, -5, -4], ["pad", 10, -5, -4]], 780);
}

const angled = extension();
const ghdTwist = extension({ bench: "ghd", style: "twist" });
const chestDumbbellExtension = extension({ weight: "dumbbell" });
const chestPlateExtension = extension({ weight: "plate" });
const floorSuperman = extension({ bench: "floor", style: "reach" });
const bottleRdl = hinge({ load: "bottles" });
const bandStandingRow = hinge({ load: "band-row", sequence: "row" });
const bandSingleRdlRow = hinge({ load: "band-row", stance: "single", action: "stiff", sequence: "over-row" });
const kettlebellLift = hinge({ load: "kettlebell", action: "lift" });
const dumbbellStiff = hinge({ load: "dumbbells", action: "stiff" });
const kettlebellMorning = hinge({ load: "kettlebell-chest", action: "hinge" });
const landmineRdl = hinge({ load: "landmine" });
const sumoChains = hinge({ load: "barbell", action: "lift", stance: "wide", grip: "narrow", tension: "chains" });

export const hingeIllustrations: Record<string, Illustration> = {
  "5813": angled, "1465": angled,
  "1170": extension({ legs: "single" }),
  "1171": extension({ style: "twist" }),
  "8895": extension({ style: "adduction" }),
  "0891": hinge({ load: "band-shoulder", action: "hinge" }),
  "4618": hinge({ load: "band" }),
  "3771": bandStandingRow, "3787": bandStandingRow,
  "1513": hinge({ load: "band-shoulder", action: "hinge" }),
  "0902": hinge({ load: "band-shoulder", action: "hinge" }),
  "4701": extension({ bench: "floor", weight: "band", legs: "single", reverse: true }),
  "0919": hinge({ load: "band", stance: "single", action: "stiff" }),
  "3773": bandSingleRdlRow, "3789": bandSingleRdlRow,
  "11093": hinge({ load: "barbell", action: "lift", sequence: "two-thirds" }),
  "4841": hinge({ load: "barbell", action: "lift", tension: "above", fixture: "assist" }),
  "4173": hinge({ load: "barbell", tension: "below" }),
  "4203": hinge({ load: "barbell", stance: "wide", action: "lift", grip: "narrow", tension: "below" }),
  "5663": hinge({ load: "barbell", action: "lift", grip: "rear" }),
  "0966": backViewDeadlift(),
  "1515": hinge({ load: "barbell", action: "lift" }),
  "3328": hinge({ load: "barbell", action: "stiff", sequence: "clean-step" }),
  "4199": hinge({ load: "barbell", action: "lift", tension: "chains" }),
  "6034": hinge({ load: "barbell", action: "lift", fixture: "blocks" }),
  "5702": hinge({ load: "barbell", action: "lift", fixture: "platform" }),
  "9696": hinge({ load: "barbell", action: "lift", stance: "wide", grip: "narrow" }),
  "7237": hinge({ load: "barbell", action: "lift", grip: "hook" }),
  "5706": hinge({ load: "barbell", stance: "straddle", action: "lift" }),
  "5577": hinge({ load: "barbell", stance: "wide", grip: "narrow", action: "lift", sequence: "pause" }),
  "4851": hinge({ load: "bar-shoulder", action: "hinge", fixture: "pins", pinStart: true }),
  "4116": hinge({ load: "barbell", stance: "wide", action: "lift", grip: "plates" }),
  "1532": hinge({ load: "barbell", fixture: "platform" }),
  "4850": hinge({ load: "bar-shoulder", stance: "single", action: "hinge" }),
  "1535": hinge({ load: "barbell", action: "lift", grip: "wide" }),
  "11789": hinge({ load: "barbell", stance: "staggered", action: "stiff" }),
  "1542": hinge({ load: "barbell", action: "stiff", fixture: "bench" }),
  "4107": hinge({ load: "barbell", stance: "wide", grip: "narrow", action: "lift", fixture: "blocks" }),
  "4864": hinge({ load: "barbell", stance: "wide", grip: "narrow", action: "lift", fixture: "platform" }),
  "3731": hinge({ load: "barbell", stance: "wide", grip: "narrow" }),
  "5912": sumoChains, "5910": sumoChains,
  "1544": hinge({ load: "barbell", stance: "wide", grip: "narrow", action: "stiff" }),
  "8991": extension({ weight: "zercher" }),
  "5670": hinge({ load: "zercher", action: "lift" }),
  "8896": hinge({ sequence: "adduction" }),
  "5672": hinge({ load: "hands-head", stance: "staggered", action: "hinge" }),
  "5555": hinge({ load: "hands-head", action: "hinge" }),
  "3928": hinge({ stance: "single" }),
  "10862": hinge({ load: "ball-support", stance: "single" }),
  "10915": hinge({ stance: "single", sequence: "hold" }),
  "10916": hinge({ stance: "single", sequence: "touch" }),
  "5988": bottleRdl, "6041": bottleRdl,
  "6042": hinge({ load: "bottles", stance: "single" }),
  "6049": hinge({ load: "bottles", action: "stiff" }),
  "3352": hinge({ action: "kneeling" }),
  "6552": hinge({ load: "cable" }),
  "2836": hinge({ load: "cable", action: "stiff", fixture: "platform" }),
  "2324": hinge({ load: "cable-behind", action: "stiff", stance: "wide" }),
  "10199": hinge({ load: "dumbbells", sequence: "cross" }),
  "5232": hinge({ load: "dumbbells", sequence: "over-row" }),
  "6424": hinge({ load: "dumbbell-chest", action: "hinge" }),
  "5313": hinge({ load: "dumbbell-chest", action: "hinge", sequence: "squat" }),
  "11058": hinge({ load: "dumbbells", fixture: "hip-post" }),
  "7328": chestDumbbellExtension, "10977": chestDumbbellExtension,
  "7648": hinge({ load: "dumbbell-one", stance: "single", action: "stiff" }),
  "6145": extension({ bench: "flat", weight: "dumbbell", reverse: true }),
  "9484": hinge({ load: "dumbbells", sequence: "squat" }),
  "2806": hinge({ load: "dumbbells", stance: "staggered", fixture: "foot-box" }),
  "2750": hinge({ load: "dumbbell-one", stance: "single", fixture: "wall" }),
  "10865": hinge({ load: "dumbbells", stance: "staggered", fixture: "foot-bench" }),
  "3338": hinge({ load: "dumbbell-far", stance: "single", action: "stiff" }),
  "9515": hinge({ load: "dumbbell-chest", action: "seated" }),
  "4757": hinge({ load: "dumbbells", stance: "staggered" }),
  "1556": hinge({ load: "dumbbells", action: "stiff", fixture: "bench" }),
  "3340": dumbbellStiff, "3894": dumbbellStiff, "4293": dumbbellStiff,
  "8192": hinge({ load: "dumbbell-center", stance: "wide", action: "lift" }),
  "2807": hinge({ load: "dumbbell-swing", stance: "wide" }),
  "2394": floorSuperman, "2844": floorSuperman,
  "3870": extension({ bench: "flat", legs: "frog", reverse: true }),
  "4764": ghdTwist,
  "4765": extension({ bench: "ghd", legs: "single" }),
  "4547": hinge({ load: "hands-head", action: "hinge", sequence: "squat" }),
  "1860": angled,
  "3180": extension({ bench: "incline", reverse: true }),
  "3322": kettlebellLift, "9609": kettlebellLift,
  "4817": kettlebellMorning, "6425": kettlebellMorning,
  "3734": hinge({ load: "kettlebell", stance: "staggered" }),
  "1569": hinge({ load: "kettlebell-side", stance: "single" }),
  "9485": hinge({ load: "kettlebell", sequence: "squat" }),
  "5886": hinge({ load: "kettlebell", sequence: "rotation" }),
  "4523": hinge({ load: "kettlebell-far", stance: "single" }),
  "10561": kettlebellPass(),
  "8892": hinge({ load: "kettlebell", stance: "staggered" }),
  "11287": hinge({ load: "kettlebell", grip: "rear" }),
  "3733": hinge({ load: "kettlebell", action: "stiff" }),
  "4133": hinge({ load: "kettlebell-side", action: "lift", grip: "sides" }),
  "4046": hinge({ load: "kettlebell", stance: "wide", action: "lift" }),
  "4132": hinge({ load: "kettlebell", stance: "wide", action: "lift", sequence: "high-pull" }),
  "4403": hinge({ load: "kettlebells", stance: "wide", action: "lift" }),
  "7883": hinge({ load: "landmine", action: "lift" }),
  "5307": hinge({ load: "landmine", stance: "single", action: "stiff" }),
  "4113": landmineRdl, "4247": landmineRdl,
  "6553": hinge({ load: "landmine", stance: "single" }),
  "2266": seatedLeverExtension(),
  "2748": leverKickback(),
  "11567": leverCurlAndRaise(),
  "9866": hinge({ load: "belt-straight", fixture: "belt", action: "lift" }),
  "9865": hinge({ load: "belt-v", fixture: "belt", action: "lift" }),
  "9494": hinge({ load: "belt", fixture: "belt" }),
  "9876": hinge({ load: "belt-straight", fixture: "belt" }),
  "9877": hinge({ load: "belt-v", fixture: "belt" }),
  "11529": hinge({ load: "belt", fixture: "belt", stance: "single" }),
  "11055": hinge({ load: "belt-v", fixture: "belt", stance: "wide", action: "lift" }),
  "6733": hinge({ load: "hack", fixture: "hack", action: "hinge" }),
  "8712": hinge({ load: "lever", fixture: "lever" }),
  "5327": hinge({ load: "lever", fixture: "lever", grip: "narrow" }),
  "4924": extension({ bench: "floor", style: "arms-only" }),
  "3228": extension({ bench: "floor", style: "hands-head" }),
  "3229": extension({ bench: "floor", style: "press" }),
  "3827": floorSuperman,
  "3829": extension({ bench: "floor", weight: "towel" }),
  "6019": extension({ bench: "floor", style: "hold" }),
  "1693": hinge({ load: "medicine-ball", stance: "single" }),
  "1234": chestPlateExtension,
  "4604": hinge({ load: "pvc-shoulder", action: "hinge" }),
  "4605": hinge({ load: "pvc-spine", action: "hinge" }),
  "3875": extension({ weight: "band" }),
  "2423": extension({ bench: "floor", weight: "band", style: "lower-only" }),
  "7211": extension({ bench: "floor", weight: "band", reverse: true, legs: "split" }),
  "5837": hinge({ load: "band-behind", stance: "wide" }),
  "2163": extension({ bench: "flat", weight: "band", reverse: true }),
  "4777": extension({ bench: "floor", reverse: true }),
  "5803": extension({ bench: "flat", reverse: true }),
  "9009": extension({ bench: "ball", reverse: true }),
  "3178": extension({ bench: "ball", reverse: true, style: "bench-support" }),
  "5911": hinge({ load: "safety-bar", action: "hinge" }),
  "2920": hinge({ stance: "single", sequence: "reach" }),
  "3585": hinge({ stance: "single", sequence: "knee-up" }),
  "1519": hinge({ load: "bar-shoulder", fixture: "smith", action: "hinge", pinStart: true }),
  "0886": hinge({ load: "barbell", fixture: "smith", stance: "single" }),
  "2745": extension({ bench: "flat", reverse: true, style: "smith" }),
  "8800": hinge({ load: "barbell", fixture: "smith", stance: "staggered" }),
  "1597": hinge({ load: "barbell", fixture: "smith", action: "stiff" }),
  "7374": hinge({ load: "barbell", fixture: "smith", stance: "wide", grip: "narrow", action: "lift" }),
  "1199": hinge({ load: "barbell", stance: "wide", grip: "narrow", action: "lift", sequence: "high-pull" }),
  "2729": hinge({ load: "barbell", action: "lift" }),
  "1157": hinge({ load: "strap" }),
  "1155": hinge({ load: "strap", stance: "single" }),
  "1079": extension({ bench: "floor", style: "suspension" }),
  "1087": hinge({ load: "strap-behind" }),
  "4842": hinge({ load: "trap", action: "lift", tension: "below" }),
  "4105": hinge({ load: "trap", action: "lift", fixture: "platform" }),
  "8891": hinge({ load: "bag", action: "hinge" }),
  "10861": extension({ bench: "ghd", weight: "ball", reverse: true }),
  "5035": chestPlateExtension, "11317": chestPlateExtension,
  "0835": extension({ bench: "ball", weight: "plate" }),
  "10189": hinge({ load: "plate", sequence: "lunge-press" }),
  "10383": hinge({ load: "sandbag", action: "lift" }),
  "10730": hinge({ load: "sandbag" }),
};
