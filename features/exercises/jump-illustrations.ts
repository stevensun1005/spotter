import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Load = "dumbbell" | "barbell" | "hip-bar" | "trap" | "kettlebell" | "medicine" | "plate" | "band"
  | "loop" | "straps" | "prisoner" | "hands-hips";
type Level = "stand" | "dip" | "deep" | "rise" | "tuck" | "kneel";
type PoseOptions = {
  x?: number;
  y?: number;
  level?: Level;
  view?: "front" | "profile";
  spread?: number;
  lift?: "left" | "right";
  arms?: "up" | "back" | "hips" | "head" | "down" | "wide" | "cross" | "punch" | "grip" | "press" | "tap" | "back-rack" | "hang-bar";
  split?: number;
  turn?: number;
  toe?: boolean;
};

const floor = 158;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function knee([hx, hy]: Point, [ax, ay]: Point, crouch = 1): Point {
  const dist = Math.max(1, Math.hypot(ax - hx, ay - hy));
  const bend = Math.sqrt(Math.max(0, 29 ** 2 - dist ** 2 / 4)) * crouch;
  return [(hx + ax) / 2 + (ay - hy) / dist * bend, (hy + ay) / 2 - (ax - hx) / dist * bend];
}

function armsFor(arms: PoseOptions["arms"], [x, y]: Point, [hx, hy]: Point, front: boolean, turn: number): [Limb, Limb] {
  switch (arms) {
    case "back": return [[[x - 12, y + 15], [x - 28, y + 23]], [[x - 18, y + 11], [x - 32, y + 17]]];
    case "up": return [[[x + 9, y - 14], [x + 5, Math.max(9, y - 35)]], [[x - 9, y - 16], [x - 6, Math.max(8, y - 36)]]];
    case "hips": return [[[x + 14, y + 15], [hx + 5, hy - 5]], [[x - 13, y + 13], [hx - 7, hy - 5]]];
    case "head": return [[[x + 17, y - 2], [x + 7, y - 12]], [[x - 15, y - 3], [x - 7, y - 13]]];
    case "back-rack": return [[[x + 17, y + 7], [x + 9, y - 1]], [[x - 17, y + 8], [x - 11, y - 1]]];
    case "hang-bar": return [[[x + 10, y + 15], [hx + 12, hy + 2]], [[x - 5, y + 14], [hx - 4, hy + 1]]];
    case "wide": return [[[x + 20, y + 1], [x + 37, y + 3]], [[x - 18, y - 3], [x - 36, y + 2]]];
    case "cross": return [[[x + 14, y + 9], [x - 9, y + 14]], [[x - 12, y + 10], [x + 11, y + 14]]];
    case "punch": return [[[x + 12, y - 17], [x + 23, y - 39]], [[x - 6, y + 11], [x + 5, y + 1]]];
    case "grip": return [[[x + 18, y + 12], [x + 11, y + 2]], [[x - 13, y + 11], [x + 3, y + 1]]];
    case "press": return [[[x + 16, y + 13], [x + 38, y + 3]], [[x + 9, y + 13], [x + 31, y + 2]]];
    case "tap": return [[[x + 12, y + 20], [x + 27, y + 29]], [[x - 2, y + 18], [x + 13, y + 28]]];
    default: return front ? [[[x + 14, y + 16], [x + 18, y + 33]], [[x - 14, y + 16], [x - 18, y + 33]]]
      : [[[x + turn * 6 + 4, y + 17], [x + turn * 10 + 6, y + 34]],
        [[x - turn * 5 - 6, y + 16], [x - turn * 9 - 6, y + 33]]];
  }
}

function pose({ x = 148, y = floor, level = "stand", view = "profile", spread = 0, lift, arms = "down", split = 0,
  turn = 0, toe = false }: PoseOptions = {}): Point[] {
  const front = view === "front";
  const hipHeight = level === "deep" ? 34 : level === "dip" ? 46 : level === "tuck" ? 37 : level === "kneel" ? 44 : 60;
  const forward = !front && (level === "deep" || level === "dip" || level === "tuck");
  const hip: Point = [x - (forward ? 8 : 0), y - hipHeight];
  const shoulder: Point = [x + (forward ? 4 : 0), hip[1] - 29];
  const height = y - (toe ? 12 : 5);
  const near: Point = [x + (front ? 10 + spread * 12 : 9 + split * 24), height];
  const far: Point = [x - (front ? 10 + spread * 12 : 9 + split * 24), height + (front ? 0 : -3)];
  if (level === "kneel") {
    const nearToe: Point = [x - 28, y], farToe: Point = [x - 33, y - 2];
    const [nearArm, farArm] = armsFor(arms, shoulder, hip, front, turn);
    return [[shoulder[0] + 3, shoulder[1] - 13], shoulder, hip, ...nearArm,
      ...farArm, [x + 5, y - 4], [x - 20, y - 6],
      [x - 4, y - 4], [x - 25, y - 7], nearToe, farToe];
  }
  const nearToe: Point = [near[0] + (front ? 3 + turn * 8 : 9), y];
  const farToe: Point = [far[0] + (front ? -3 + turn * 8 : 8), y - (front ? 0 : 3)];
  const bend = level === "rise" || level === "stand" ? 0.21 : 1;
  const nearKnee = knee([hip[0] + (front ? 5 : 0), hip[1]], near, bend);
  const farKnee = knee([hip[0] - (front ? 5 : 0), hip[1]], far, front ? -bend : bend);
  const raised = (side: "left" | "right") => lift === side || level === "tuck";
  if (raised("left")) {
    near[0] += front ? 2 : 14;
    near[1] -= level === "tuck" ? 8 : 19;
    nearKnee[0] += front ? 3 : 19;
    nearKnee[1] -= level === "tuck" ? 13 : 18;
    nearToe[0] = near[0] + 8;
    nearToe[1] = near[1] + 6;
  }
  if (raised("right")) {
    far[0] += front ? -2 : 16;
    far[1] -= level === "tuck" ? 8 : 19;
    farKnee[0] += front ? -3 : 17;
    farKnee[1] -= level === "tuck" ? 13 : 18;
    farToe[0] = far[0] + 7;
    farToe[1] = far[1] + 6;
  }
  const hands = armsFor(arms, shoulder, hip, front, turn);
  return [[shoulder[0] + (front ? 0 : 4), shoulder[1] - 14], shoulder, hip,
    ...hands[0], ...hands[1], nearKnee, near, farKnee, far, nearToe, farToe];
}

function motion(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 500): Illustration {
  return { frames, props, dynamic: [...feet, ...attachments], ms, reference: true };
}

const loadObjects: Partial<Record<Load, Attachments>> = {
  dumbbell: [["dumbbell", 4, 0, 4], ["dumbbell", 6, 0, 4]],
  barbell: [["bar", 4, 6], ["barbell-end", 4, 5, 0], ["barbell-end", 6, -5, 0]],
  "hip-bar": [["bar", 4, 6], ["barbell-end", 4, 5, 0], ["barbell-end", 6, -3, 0]],
  trap: [["trap-bar", 4, -4, 4]],
  kettlebell: [["kettlebell", 4, -5, 6]],
  medicine: [["ball", 4, -4, 0]],
  plate: [["plate", 4, -5, 0]],
  band: [["band", 4, 11], ["band", 6, 12]],
  loop: [["knee-band", 7, 9]],
  straps: [["line", 4, 223, 46], ["line", 6, 214, 47], ["ring", 4, 0, 0], ["ring", 6, 0, 0]],
};

function loadArmStyle(load?: Load): PoseOptions["arms"] {
  if (load === "barbell") return "back-rack";
  if (load === "hip-bar") return "hang-bar";
  if (load === "prisoner") return "head";
  if (load === "kettlebell" || load === "medicine" || load === "plate" || load === "band") return "grip";
  if (load === "straps") return "press";
  if (load === "hands-hips") return "hips";
  return load ? "down" : undefined;
}

type SquatJump = "normal" | "tuck" | "double" | "rocket" | "pogo" | "basketball" | "switch-width"
  | "one-foot" | "single" | "pistol" | "lunge-after" | "rdl-shrug" | "shrug" | "lunge-series" | "cross-tuck" | "bench";
function squatJump(kind: SquatJump, load?: Load) {
  const props: Props = load === "straps" ? [[221, 43, 221, 158], [212, 43, 232, 43], [210, 158, 233, 158]]
      : kind === "bench" ? [[99, 120, 143, 120], [103, 120, 103, 158], [139, 120, 139, 158]] : [];
  const front = kind === "switch-width" || kind === "cross-tuck" || kind === "one-foot" || load === "loop";
  const loadedArms = loadArmStyle(load);
  const poseAt = (options: PoseOptions = {}) => pose({ ...options, view: front ? "front" : "profile", arms: loadedArms ?? options.arms });
  const flightY = kind === "pogo" ? 143 : kind === "tuck" || kind === "cross-tuck" ? 111 : 130;
  const start = poseAt({ level: "stand" });
  const loadDown = kind === "pogo" ? poseAt({ level: "stand", arms: "down", toe: true })
    : poseAt({ level: kind === "shrug" || kind === "one-foot" ? "dip" : "deep", arms: "back" });
  const airborne = poseAt({ y: flightY, level: kind === "tuck" || kind === "cross-tuck" ? "tuck" : "rise",
    arms: kind === "basketball" ? "punch" : kind === "pogo" ? "down" : "up", toe: true });
  const land = poseAt({ level: kind === "pogo" ? "stand" : "dip", toe: kind === "pogo" });
  if (kind === "shrug" || kind === "rdl-shrug") {
    airborne[1][1] -= 5;
    airborne[3][1] -= 2;
    airborne[5][1] -= 2;
  }
  let frames = [loadDown, airborne, land];
  if (kind === "bench") {
    const seated = poseAt({ x: 145, level: "deep", arms: "back" });
    seated[2] = [141, 114];
    frames = [seated, airborne, land, seated];
  } else if (kind === "switch-width") {
    frames = [poseAt({ level: "deep", spread: 1, arms: "back" }), poseAt({ y: 130, spread: 0.3, arms: "up" }),
      poseAt({ level: "deep", spread: 0, arms: "back" }), poseAt({ y: 130, spread: 0.6, arms: "up" })];
  } else if (kind === "cross-tuck") {
    const crossing = (which: -1 | 1) => {
      const frame = poseAt({ y: 117, level: "tuck", arms: "up" });
      frame[8][0] -= 19 * which;
      frame[10][0] += 19 * which;
      frame[11][0] -= 19 * which;
      frame[12][0] += 19 * which;
      return frame;
    };
    frames = [loadDown, crossing(1), land, crossing(-1)];
  } else if (kind === "one-foot") {
    frames = [loadDown, airborne, poseAt({ level: "dip", lift: "left" }), start, loadDown, airborne, poseAt({ level: "dip", lift: "right" }), start];
  } else if (kind === "pistol" || kind === "single") {
    const make = (y: number, level: Level, endArms: PoseOptions["arms"] = "press") => {
      const air = poseAt({ y, level, lift: "left", arms: endArms });
      if (kind === "pistol") {
        air[7] = [air[2][0] + 22, air[2][1] + 3];
        air[8] = [air[2][0] + 50, air[2][1] + 4];
        air[11] = [air[2][0] + 58, air[2][1] + 6];
      }
      return air;
    };
    frames = [make(floor, kind === "pistol" ? "deep" : "dip", "back"), make(127, "rise", "up"), make(floor, "dip")];
  } else if (kind === "double") {
    frames = [loadDown, airborne, land, airborne, land];
  } else if (kind === "lunge-after" || kind === "lunge-series") {
    const frontLeg = poseAt({ level: "deep", split: 1, arms: "down" });
    const rearLeg = poseAt({ level: "deep", split: -1, arms: "down" });
    frames = kind === "lunge-after" ? [loadDown, airborne, land, frontLeg, start, loadDown, airborne, land, rearLeg, start]
      : [loadDown, start, frontLeg, start, rearLeg, start, airborne, land];
  } else if (kind === "rdl-shrug") {
    const hinged = poseAt({ level: "dip" });
    hinged[0] = [174, 94]; hinged[1] = [160, 98]; hinged[2] = [127, 103];
    hinged[3] = [160, 116]; hinged[4] = [163, 135];
    hinged[5] = [153, 117]; hinged[6] = [154, 133];
    frames = [hinged, airborne, land];
  }
  return motion(frames, props, load ? loadObjects[load] : [], kind === "pogo" ? 280 : 480);
}

function splitJump(load?: Load, single = false, withJack = false) {
  const grip = loadArmStyle(load);
  const split = (swap: -1 | 1, flight = false) => pose({ y: flight ? 137 : floor,
    level: flight ? "rise" : "deep", split: swap, toe: flight, arms: grip ?? (flight ? "up" : "back") });
  const air = pose({ y: 127, level: "rise", split: 0, arms: grip ?? "up", toe: true });
  const frames = withJack ? [pose({ view: "front" }), split(-1), air, split(1),
    pose({ view: "front", y: 132, arms: "up", spread: 0.5 }), pose({ view: "front", level: "dip", arms: "up", spread: 1 }),
    pose({ view: "front", y: 134, arms: "wide" }), pose({ view: "front" })]
    : single ? [split(1), pose({ y: 128, level: "rise", split: 0.4, lift: "right", arms: "up", toe: true }),
      pose({ level: "dip", split: 0.4, lift: "right", arms: "press" }), split(1)]
      : [split(-1), air, split(1), air];
  return motion(frames, [], load ? loadObjects[load] : [], 520);
}

type BoxJump = "box" | "fit" | "step" | "stair" | "bench-side" | "twist" | "over" | "single" | "single-to-both" | "both-to-single" | "arm-drive"
  | "kneel" | "split" | "burpee" | "drop" | "depth" | "depth-broad" | "depth-hurdle" | "pistol";

function boxJump(kind: BoxJump, load?: "dumbbell") {
  const drop = kind === "drop" || kind === "depth" || kind === "depth-broad" || kind === "depth-hurdle";
  const side = kind === "bench-side" || kind === "twist";
  const low = kind === "stair" || kind === "step" || kind === "fit" || drop;
  const top = low ? 134 : 125;
  const left = drop ? 82 : kind === "pistol" ? 168 : 164;
  const right = kind === "stair" ? 222 : left + (kind === "bench-side" ? 50 : 55);
  const props: Props = [[left, top, right, top], [left, top, left, 157], [right, top, right, 157], [left, 157, right, 157]];
  if (kind === "stair") props.push([203, top, 203, 112], [203, 112, 218, 112], [218, 112, 218, 92], [218, 92, 234, 92]);
  if (kind === "bench-side") props.splice(1, 3, [left + 6, top, left + 6, floor], [right - 5, top, right - 5, floor]);
  if (kind === "depth-hurdle") props.push([187, 120, 212, 120], [187, 120, 187, 158], [212, 120, 212, 158]);
  const boxX = (left + right) / 2;
  const single = kind === "single" || kind === "pistol";
  const preX = drop ? boxX : kind === "pistol" ? 164 : 130;
  const postX = drop ? 155 : boxX;
  const poseAt = (options: PoseOptions = {}) => pose({ ...options, view: side ? "front" : "profile",
    arms: load ? "down" : options.arms });
  const lift = single || kind === "single-to-both" ? "right" : undefined;
  const landLift = single ? "right" : undefined;
  const topPose = (level: Level, turn = 0) => poseAt({ x: postX, y: top, level, lift: landLift, turn, arms: "down" });
  const takeoff = poseAt({ x: preX, y: drop ? top : floor, level: "dip", lift, split: kind === "split" ? 0.7 : 0, arms: "back" });
  const launch = (x: number, y: number) => {
    const frame = poseAt({ x, y, level: "tuck", lift, arms: "up", turn: kind === "twist" ? 1 : 0 });
    if (kind === "arm-drive") {
      const [sx, sy] = frame[1];
      frame[3] = [sx + 16, sy - 6]; frame[4] = [sx + 34, sy - 22];
      frame[5] = [sx + 12, sy - 5]; frame[6] = [sx + 28, sy - 21];
    }
    return frame;
  };
  const stepDown = poseAt({ x: drop ? 136 : 151, y: top + 14, level: "dip", arms: "wide" });
  if (drop) {
    stepDown[8][1] = top + 7;
    stepDown[11][1] = top + 13;
  } else {
    stepDown[7] = [150, 136]; stepDown[8] = [142, floor - 6]; stepDown[11] = [151, floor];
    stepDown[9] = [155, top - 22]; stepDown[10] = [177, top - 6]; stepDown[12] = [184, top];
  }
  const land = poseAt({ x: drop ? 153 : 143, level: "dip" });
  let frames = [takeoff, launch(159, top - 9), topPose("dip", kind === "twist" ? 1 : 0),
    topPose("stand", kind === "twist" ? 1 : 0), stepDown, land];
  if (kind === "both-to-single") {
    const oneFootLanding = (which: "left" | "right", level: Level) =>
      poseAt({ x: postX, y: top, level, lift: which, arms: "wide" });
    const rise = launch(162, top - 11);
    frames = [takeoff, rise, oneFootLanding("right", "dip"), oneFootLanding("right", "stand"), topPose("stand"), stepDown,
      takeoff, rise, oneFootLanding("left", "dip"), oneFootLanding("left", "stand"), topPose("stand"), stepDown];
  } else if (kind === "over") {
    const turnBack = (frame: Point[], x: number) => frame.map(([px, py]): Point => [2 * x - px, py]);
    frames = [takeoff, launch(156, top - 8), topPose("dip"), topPose("stand"),
      poseAt({ x: 227, y: top + 10, level: "dip", arms: "wide" }), poseAt({ x: 242, level: "dip" }),
      turnBack(poseAt({ x: 229, y: top - 9, level: "tuck", arms: "up" }), 229), turnBack(topPose("dip"), postX), stepDown, land];
  } else if (kind === "kneel") {
    frames = [poseAt({ x: preX - 6, level: "kneel", arms: "back" }), poseAt({ x: preX - 5, y: 135, level: "tuck", arms: "press" }), ...frames];
  } else if (kind === "burpee") {
    const push = [[102, 139], [115, 147], [148, 150], [118, 155], [127, 156], [113, 153], [124, 156],
      [161, 153], [180, 151], [157, 152], [177, 149], [187, 157], [184, 155]] as Point[];
    const plank = [[100, 121], [114, 126], [148, 137], [119, 143], [120, 154], [112, 142], [112, 153],
      [166, 146], [188, 150], [163, 144], [184, 149], [192, 158], [189, 156]] as Point[];
    const mirror = (frame: Point[]) => frame.map(([x, y]): Point => [254 - x, y]);
    const ground = poseAt({ x: 121, level: "deep", arms: "tap" });
    frames = [ground, mirror(plank), mirror(push), mirror(plank), ground, ...frames];
  } else if (kind === "pistol") {
    const floorPistol = (y: number, deep: boolean) => {
      const frame = poseAt({ x: 160, y, level: deep ? "deep" : "rise", lift: "left", arms: "press" });
      if (deep) {
        frame[2] = [172, top - 8]; frame[1] = [150, top - 33]; frame[0] = [141, top - 44];
      }
      frame[3] = [frame[1][0] - 14, frame[1][1] + 11]; frame[4] = [frame[1][0] - 32, frame[1][1] + 7];
      frame[5] = [frame[1][0] - 18, frame[1][1] + 7]; frame[6] = [frame[1][0] - 30, frame[1][1] + 3];
      frame[7] = [frame[2][0] - 27, frame[2][1] + 3]; frame[8] = [frame[2][0] - 49, frame[2][1] + 7];
      frame[11] = [frame[2][0] - 57, frame[2][1] + 8];
      if (deep) {
        frame[9] = [147, floor - 29]; frame[10] = [150, floor - 6]; frame[12] = [140, floor];
      }
      return frame;
    };
    frames = [floorPistol(floor, true), floorPistol(127, false), floorPistol(floor, false), floorPistol(floor, true)];
  } else if (drop) {
    const start = poseAt({ x: preX + 3, y: top, level: "stand" });
    const stepping = poseAt({ x: preX + 26, y: top + 7, level: "dip", lift: "right", arms: "press" });
    frames = [start, stepping, land];
    if (kind === "depth") frames.push(launch(153, 124), land);
    if (kind === "depth-broad") frames.push(launch(182, 126), poseAt({ x: 224, level: "dip" }));
    if (kind === "depth-hurdle") frames.push(launch(196, 108), poseAt({ x: 231, level: "dip" }));
    frames.push(stepDown, start);
  }
  return motion(frames, props, load ? loadObjects[load] : [], 520);
}

type HopKind = "forward" | "forward-back" | "broad" | "broad-up" | "lateral" | "lateral-bench" | "hurdle"
  | "high-hurdle-sprint" | "up-side" | "square" | "four-way" | "zigzag" | "sidestep" | "skater"
  | "single-lateral" | "single-pogo" | "single-stride" | "single-board" | "single" | "frog" | "trampoline";

function travelHop(kind: HopKind, load?: "medicine" | "band") {
  const front = ["lateral", "lateral-bench", "hurdle", "up-side", "square", "four-way", "zigzag",
    "skater", "single-lateral"].includes(kind);
  const single = ["four-way", "single-lateral", "single-pogo", "single-stride", "single-board", "single", "skater"].includes(kind);
  const stick = kind === "single-pogo" || kind === "trampoline";
  const right = (swap = false) => single ? swap ? "left" as const : "right" as const : undefined;
  const props: Props = [];
  const attachment: Attachments = [];
  if (kind === "lateral-bench") props.push([144, 133, 179, 133], [144, 133, 144, floor], [179, 133, 179, floor]);
  if (kind === "hurdle" || kind === "high-hurdle-sprint") props.push([144, kind === "hurdle" ? 129 : 108, 169, kind === "hurdle" ? 129 : 108],
    [144, kind === "hurdle" ? 129 : 108, 144, floor], [168, kind === "hurdle" ? 129 : 108, 168, floor]);
  if (kind === "single-board") props.push([155, 130, 155, floor], [148, floor, 175, floor], [153, 130, 158, 130]);
  if (kind === "broad" || kind === "broad-up") props.push([119, floor, 117, 151]);
  if (kind === "trampoline") props.push([103, 147, 192, 147], [100, 149, 194, 149], [113, 148, 109, floor], [182, 148, 186, floor],
    [101, 150, 108, 152], [185, 152, 193, 150]);
  if (load === "band") {
    props.push([81, 74, 81, floor], [69, floor, 93, floor]);
    attachment.push(["band", 2, 81, 101]);
  }
  if (load === "medicine") attachment.push(["ball", 4, -2, -3]);
  if (kind === "square") props.push([113, 156, 188, 156], [188, 156, 174, 146], [174, 146, 101, 146], [101, 146, 113, 156]);
  const y = kind === "trampoline" ? 144 : floor;
  const p = (x: number, rise = 0, swapped = false, spread = 0, lane = 0) => {
    const poseFrame = pose({ x, y: y - lane - rise,
      level: kind === "frog" ? (rise ? "rise" : "deep") : stick ? "stand"
        : rise ? kind === "high-hurdle-sprint" ? "tuck" : "rise" : "dip",
      arms: load === "medicine" ? "grip" : kind === "frog" ? rise ? "up" : "tap"
        : stick ? "down" : rise ? front ? "wide" : kind === "broad" || kind === "broad-up" || kind === "single-stride" ? "press" : "up" : "back",
      lift: right(swapped), view: front ? "front" : "profile", spread, toe: !!rise || stick });
    if (kind === "frog" && !rise) {
      poseFrame[0] = [x + 19, y - 59]; poseFrame[1] = [x + 13, y - 48];
      poseFrame[3] = [x + 18, y - 27]; poseFrame[4] = [x + 16, y - 2];
      poseFrame[5] = [x + 10, y - 27]; poseFrame[6] = [x + 9, y - 3];
    }
    return poseFrame;
  };
  let frames: Point[][];
  if (kind === "four-way") {
    const center = p(150);
    frames = [center, p(152, 18, false, 0, 4), p(152, 0, false, 0, 12), p(152, 18, false, 0, 4), center,
      p(169, 20), p(191), p(169, 20), center, p(150, 20, false, 0, -2), p(150, 0, false, 0, -5), p(150, 20), center,
      p(131, 20), p(109), p(131, 20)];
  } else if (kind === "square") {
    const corners: [number, number][] = [[113, 1], [184, 1], [172, 12], [106, 12]];
    frames = [...corners, corners[0], ...corners.slice(1).reverse(), corners[0]]
      .flatMap(([x, row], index, list) => {
        const next = list[index + 1];
        return next ? [p(x, 0, false, 0, row), p((x + next[0]) / 2, 15, false, 0, (row + next[1]) / 2)]
          : [p(x, 0, false, 0, row)];
      });
  } else if (kind === "high-hurdle-sprint") {
    const sprint = (x: number, stride: number, y = 154) => pose({ x, y, split: stride, level: "dip", arms: "press" });
    frames = [p(108), pose({ x: 153, y: 97, level: "tuck", arms: "up" }), p(201),
      sprint(213, 1, 148), sprint(228, -1), sprint(247, 1, 144),
      pose({ x: 254, y: 149, view: "front", spread: 0.6, level: "dip", arms: "wide", turn: 1 }),
      pose({ x: 246, y: 142, view: "front", spread: 0.9, arms: "wide", turn: 1 }), p(108)];
  } else if (kind === "hurdle" || kind === "lateral-bench" || kind === "single-board") {
    const apex = kind === "lateral-bench" ? 34 : 37;
    frames = [p(114), p(155, apex), p(199), p(155, apex)];
  } else if (kind === "broad" || kind === "broad-up" || kind === "single-stride") {
    frames = [p(106), p(162, 30), p(214, 0, kind === "single-stride")];
    if (kind === "broad-up") frames.push(p(214, 30), p(214));
    frames.push(p(174, 0, true), p(136, 0, false));
  } else if (kind === "up-side") {
    frames = [p(150), p(150, 25), p(150), p(181, 18), p(203), p(180, 18), p(150),
      p(150, 25), p(150), p(126, 18), p(104), p(124, 18)];
  } else if (kind === "zigzag") {
    frames = [p(117), p(150, 17, false, 0, 5), p(179, 0, false, 0, 9), p(155, 18, false, 0, 12),
      p(129, 0, false, 0, 16), p(153, 17, false, 0, 17), p(183, 0, false, 0, 21)];
  } else if (kind === "sidestep") {
    frames = [p(132), p(132, 23), p(132), pose({ x: 153, split: 0.6, level: "dip" }), p(175),
      p(175, 23), p(175), pose({ x: 154, split: -0.6, level: "dip" })];
  } else if (kind === "skater" || kind === "lateral" || kind === "single-lateral") {
    const swap = kind === "skater";
    frames = [p(119), p(148, 20, swap), p(178, 0, swap), p(148, 20)];
  } else if (kind === "forward" || kind === "forward-back" || kind === "frog") {
    frames = [p(119, 0, false, 0.5), p(151, 22), p(182, 0, false, 0.5), p(151, 20)];
  } else {
    const rise = stick ? 12 : 19;
    frames = [p(148), p(148, rise), p(148)];
  }
  return motion(frames, props, attachment, stick ? 260 : 460);
}

type Rhythm = "cross-jack" | "knee-jack" | "band-jack" | "twist" | "back-cross" | "high-hop" | "tap"
  | "kick" | "run-hop" | "run-jack" | "run-squat" | "rope-jack" | "rope-split" | "rope-squat";

function rhythmJump(kind: Rhythm) {
  const battle = kind === "rope-jack" || kind === "rope-split" || kind === "rope-squat";
  const frame = (options: PoseOptions) => pose({ ...options, view: kind === "rope-split" || kind === "rope-squat" ? "profile" : "front" });
  const rest = frame({ level: "dip" });
  const open = frame({ y: 135, spread: 1, arms: "up" });
  const landOpen = frame({ level: "dip", spread: 1, arms: "up" });
  const lead = (left: boolean, lifted: boolean) => frame({ lift: left ? "left" : "right", level: lifted ? "stand" : "dip",
    y: lifted ? 135 : floor, arms: kind === "tap" ? "tap" : left ? "punch" : "press", toe: lifted });
  const cross = (direction: number) => {
    const crossing = frame({ level: "dip", arms: "cross", turn: direction });
    crossing[8][0] -= direction * 18; crossing[10][0] += direction * 18;
    crossing[11][0] -= direction * 18; crossing[12][0] += direction * 18;
    return crossing;
  };
  let frames: Point[][];
  if (kind === "cross-jack" || kind === "band-jack" || kind === "rope-jack") {
    frames = [rest, open, landOpen, frame({ y: 137, arms: "wide", spread: 0.4 }),
      kind === "cross-jack" ? cross(1) : rest];
  } else if (kind === "knee-jack") {
    frames = [rest, open, landOpen, lead(true, true), rest, open, landOpen, lead(false, true)];
  } else if (kind === "twist") {
    frames = [rest, frame({ y: 132, arms: "wide", turn: 1 }), frame({ level: "dip", turn: 1 }), frame({ y: 132, arms: "wide", turn: -1 }),
      frame({ level: "dip", turn: -1 })];
  } else if (kind === "back-cross") {
    const back = frame({ level: "dip", turn: -1, arms: "wide" });
    back[9] = [134, 130]; back[10] = [112, 147]; back[12] = [103, 152];
    frames = [rest, frame({ y: 140, arms: "wide" }), cross(1), frame({ y: 136, arms: "wide" }),
      back, rest, frame({ y: 140, arms: "wide" }), cross(-1)];
  } else if (kind === "kick") {
    const kick = (direction: -1 | 1) => {
      const shape = frame({ y: 126, arms: "wide" });
      const joint = direction === 1 ? 8 : 10;
      shape[joint] = [148 + direction * 49, 116];
      shape[joint - 1] = [148 + direction * 28, 99];
      shape[direction === 1 ? 11 : 12] = [shape[joint][0] + direction * 9, 119];
      return shape;
    };
    frames = [rest, kick(1), rest, kick(-1)];
  } else if (kind === "rope-squat") {
    const waves = (y: number, level: Level, nearUp: boolean) => {
      const shape = frame({ y, level, toe: y < floor });
      const [sx, sy] = shape[1];
      shape[3] = [sx + 18, sy + (nearUp ? 4 : 15)]; shape[4] = [sx + 37, sy + (nearUp ? -12 : 28)];
      shape[5] = [sx + 14, sy + (nearUp ? 15 : 4)]; shape[6] = [sx + 31, sy + (nearUp ? 27 : -13)];
      return shape;
    };
    frames = [waves(floor, "deep", true), waves(floor, "deep", false), waves(129, "rise", true),
      waves(floor, "dip", false), waves(floor, "deep", true), waves(floor, "deep", false),
      waves(129, "rise", false), waves(floor, "dip", true)];
  } else if (kind === "rope-split") {
    frames = [frame({ level: "deep", split: 1, arms: "press" }), frame({ y: 130, arms: "tap" }),
      frame({ level: "deep", split: -1, arms: "press" }), frame({ y: 130, arms: "tap" })];
  } else if (kind === "run-hop" || kind === "run-jack" || kind === "run-squat") {
    const finish = kind === "run-jack" ? [open, landOpen, rest] : kind === "run-squat"
      ? [frame({ level: "deep", arms: "back" }), frame({ y: 124, arms: "up" }), rest] : [lead(true, true), rest];
    frames = [lead(true, false), lead(false, false), lead(true, false), lead(false, false), ...finish];
  } else {
    frames = [rest, lead(true, true), lead(true, false), rest, lead(false, true), lead(false, false)];
  }
  if (!battle) return motion(frames, [], kind === "band-jack" ? [["knee-band", 7, 9]] : [], 440);
  const rope: Attachments = [];
  const traces = frames.map((pose, index) => {
    const combined = [...pose];
    for (const [hand, end] of [[4, [246, 147]], [6, [240, 152]]] as const) {
      let preceding: number = hand;
      for (let i = 1; i <= 6; i++) {
        const fraction = i / 6;
        const wave = Math.sin((i / 2 - index) * 1.8 + hand) * 12 * Math.sin(Math.PI * fraction);
        const next = combined.length;
        combined.push([(1 - fraction) * pose[hand][0] + fraction * end[0],
          (1 - fraction) * pose[hand][1] + fraction * end[1] + wave]);
        if (!index) rope.push(["line", preceding, next]);
        preceding = next;
      }
    }
    return combined;
  });
  return motion(traces, [[246, 144, 246, 158], [237, 158, 253, 158]], rope, 390);
}

function jumpRope(kind: "regular" | "double" | "high" | "knees" | "lateral" | "skip") {
  const turns = kind === "double" ? 2 : 1;
  const ms = kind === "double" ? 160 : 185;
  const sequence = [0, 1, 2, 3, 4, 5, 6, 7];
  const attachments: Attachments = [];
  const keyframes = sequence.map((step) => {
    const a = (2 * Math.PI * step / sequence.length) * turns;
    const high = kind === "high" || kind === "double";
    const x = kind === "lateral" ? 148 + 24 * Math.cos(step * Math.PI / 4) : 148;
    const up = high ? [0, 10, 21, 25, 27, 24, 19, 10][step] : [0, 6, 15, 18, 16, 12, 7, 0][step];
    const lift = kind === "knees" || kind === "skip" ? step < 4 ? "left" : "right" : undefined;
    const actor = pose({ x, y: floor - up, view: "front", level: step === 0 ? "dip" : "stand", lift, toe: !!up });
    const hip = actor[2];
    actor[3] = [x + 11, hip[1] - 15]; actor[4] = [x + 24, hip[1] + 3];
    actor[5] = [x - 11, hip[1] - 15]; actor[6] = [x - 24, hip[1] + 3];
    if (kind === "skip" && lift) {
      const ankle = lift === "left" ? 8 : 10, tip = lift === "left" ? 11 : 12;
      actor[ankle][1] += 8; actor[tip][1] += 8;
    }
    let previous = 4;
    for (let k = 1; k <= 7; k++) {
      const t = k / 8, curve = Math.sin(Math.PI * t);
      const point: Point = [actor[4][0] + (actor[6][0] - actor[4][0]) * t + Math.sin(a) * 15 * curve,
        hip[1] + 3 - Math.cos(a) * 69 * curve];
      const id = actor.length;
      actor.push(point);
      if (!step) attachments.push(["line", previous, id]);
      previous = id;
    }
    if (!step) attachments.push(["line", previous, 6]);
    return actor;
  });
  return motion(keyframes, [], attachments, ms);
}

function countermovementJump(withArmSwing: boolean) {
  const shape = (y: number, level: Level, arms: PoseOptions["arms"]) =>
    pose({ y, level, arms: withArmSwing ? arms : "hips", toe: y < floor });
  return motion([shape(floor, "stand", "down"), shape(floor, "dip", "back"), shape(125, "rise", "up"),
    shape(137, "rise", "press"), shape(floor, "dip", "down")], [], [], 410);
}

function jumpingBandRow(deepLunge: boolean) {
  const shape = (split: number, phase: "reach" | "row" | "flight") => {
    const flying = phase === "flight";
    const frame = pose({ split, y: flying ? 132 : floor, level: flying ? "rise" : deepLunge ? "deep" : "dip", toe: flying });
    const [x, y] = frame[1];
    frame[3] = phase === "row" ? [x - 22, y + 18] : [x + 22, y + 15];
    frame[4] = phase === "row" ? [x - 1, y + 20] : [x + 46, y + 26];
    return frame;
  };
  return motion([shape(1, "reach"), shape(0, "flight"), shape(-1, "row"), shape(-1, "reach"),
    shape(0, "flight"), shape(1, "row")],
    [[252,101,252,158], [242,158,263,158], [249,143,255,143]],
    [["band",4,252,143], ["ring",4,0,0]], 530);
}

function kneelingBarbellJump() {
  const base = (options: PoseOptions = {}) => pose({ ...options, arms: "back-rack" });
  const tallKneel = base({ level: "kneel" });
  const tuckedKneel = base({ level: "kneel" });
  for (const joint of [0,1,2,3,4,5,6]) {
    tuckedKneel[joint] = [tuckedKneel[joint][0] - 11, tuckedKneel[joint][1] + 12];
  }
  const catchSquat = base({ level: "deep" });
  const resetOneKnee = catchSquat.map((point): Point => [...point]);
  resetOneKnee[7] = [164,154]; resetOneKnee[8] = [163,150]; resetOneKnee[11] = [150,155];
  return motion([tallKneel, tuckedKneel, base({ y: 124, level: "tuck" }), catchSquat, base(), resetOneKnee, tallKneel],
    [], loadObjects.barbell, 610);
}

const highPlankJump: Point[] = [[229,96],[211,108],[147,129],[210,133],[209,154],[197,132],[193,153],
  [113,139],[76,151],[104,139],[65,149],[83,158],[72,156]];
function plankJumpMode(squat: boolean) {
  const change = (joints: Partial<Record<number, Point>>) => highPlankJump.map((point,index) => joints[index] ?? point);
  if (!squat) {
    const nearKnee = change({7:[177,126],8:[145,147],11:[153,157]});
    const farKnee = change({9:[166,123],10:[137,144],12:[146,155]});
    const switching = change({7:[151,123],8:[116,135],11:[125,139],9:[151,123],10:[109,138],12:[113,142]});
    return motion([nearKnee, switching, farKnee, switching], [], [], 310);
  }
  const airborne = change({2:[157,121],7:[162,133],8:[147,142],11:[157,149],9:[146,127],10:[124,137],12:[132,141]});
  const squatHandsDown = change({0:[209,106],1:[194,116],2:[166,123],3:[201,136],5:[195,135],
    7:[206,128],8:[219,151],11:[230,158],9:[178,129],10:[178,150],12:[185,156]});
  return motion([highPlankJump, airborne, squatHandsDown, squatHandsDown, airborne], [], [], 465);
}

function skaterHop() {
  const landing = (side: -1 | 1) => {
    const x = 153 + side * 37;
    const shape = pose({ x, view: "front", level: "dip", arms: "cross" });
    const [hipX, hipY] = shape[2];
    shape[1] = [shape[1][0]+side*7, shape[1][1]+3];
    shape[0] = [shape[0][0]+side*7, shape[0][1]+3];
    if (side === 1) {
      shape[7] = [hipX+7,hipY+21]; shape[8] = [hipX+7,151]; shape[11] = [hipX+15,158];
      shape[9] = [hipX+1,hipY+24]; shape[10] = [hipX-32,144]; shape[12] = [hipX-38,152];
      shape[3] = [hipX+17,hipY-8]; shape[4] = [hipX-8,hipY+4];
      shape[5] = [hipX-14,hipY-14]; shape[6] = [hipX-32,hipY-8];
    } else {
      shape[9] = [hipX-7,hipY+21]; shape[10] = [hipX-7,151]; shape[12] = [hipX-15,158];
      shape[7] = [hipX-1,hipY+24]; shape[8] = [hipX+32,144]; shape[11] = [hipX+38,152];
      shape[5] = [hipX-17,hipY-8]; shape[6] = [hipX+8,hipY+4];
      shape[3] = [hipX+14,hipY-14]; shape[4] = [hipX+32,hipY-8];
    }
    return shape;
  };
  const flight = (direction: -1 | 1) => pose({ x:153, y:137, view:"front", level:"dip",
    lift:direction === 1 ? "left" : "right", arms:"wide",toe:true });
  return motion([landing(-1), flight(1), landing(1), flight(-1)], [], [], 440);
}

function lateralLungeHop() {
  const sitTo = (side: -1 | 1) => {
    const shape = pose({x:149+side*25,view:"front",level:"dip",arms:"press"});
    shape[7] = side === 1 ? [187,129] : [170,132];
    shape[9] = side === -1 ? [111,129] : [126,132];
    shape[8] = [192,152]; shape[11] = [201,158];
    shape[10] = [106,152]; shape[12] = [97,158];
    return shape;
  };
  const hop = pose({x:149,y:136,view:"front",spread:1.1,arms:"wide",toe:true});
  return motion([sitTo(-1),hop,sitTo(1),hop], [], [], 500);
}

function wallSitJump() {
  const sit: Point[] = [[123,70],[117,86],[117,122],[130,102],[144,118],[126,105],[137,118],
    [165,123],[165,152],[158,122],[156,151],[176,158],[166,156]];
  return motion([sit,pose({x:137,y:128,arms:"up",toe:true}),pose({x:140,level:"dip",arms:"press"}),sit],
    [[110,27,110,158],[96,158,110,158],[99,138,110,133],[99,151,110,146]],[],520);
}

function plyoJack() {
  return motion([
    pose({view:"front",spread:-0.55}),
    pose({view:"front",spread:0.3,y:131,arms:"wide",toe:true}),
    pose({view:"front",spread:1.35,level:"dip",arms:"wide"}),
    pose({view:"front",spread:0.3,y:131,arms:"down",toe:true}),
  ],[],[],390);
}

export const jumpIllustrations: Record<string, Illustration> = {
  "3095": (() => {
    const demo = travelHop("skater");
    const [left, out, right, back] = demo.frames;
    return { ...demo, frames: [left, left, out, right, right, back], ms: 580 };
  })(),
  "4208": boxJump("both-to-single"),
  "10738": boxJump("arm-drive"),
  "3782": jumpingBandRow(true),
  "3794": jumpingBandRow(true),
  "3781": jumpingBandRow(false),
  "3793": jumpingBandRow(false),
  "3370": rhythmJump("rope-squat"),
  "9514": countermovementJump(false),
  "9513": countermovementJump(true),
  "1420": kneelingBarbellJump(),
  "4976": plankJumpMode(false),
  "10326": plankJumpMode(true),
  "3108": plyoJack(),
  "4675": lateralLungeHop(),
  "0647": wallSitJump(),
  "5745": squatJump("normal"),
  "3109": skaterHop(),
  "4209": boxJump("single-to-both"),
  "10987": boxJump("box", "dumbbell"),
  "10988": boxJump("kneel", "dumbbell"),
  "9606": boxJump("depth"),
  "10160": boxJump("drop"),
  "8704": boxJump("burpee"),
  "4844": boxJump("depth"),
  "4843": boxJump("depth-broad"),
  "4198": boxJump("depth-hurdle"),
  "3650": boxJump("box"),
  "3887": boxJump("over"),
  "4965": boxJump("box"),
  "3892": boxJump("fit"),
  "4168": boxJump("pistol"),
  "11781": boxJump("step"),
  "10743": boxJump("kneel"),
  "0567": boxJump("twist"),
  "2561": boxJump("bench-side"),
  "5166": boxJump("single"),
  "3440": boxJump("split"),
  "3720": boxJump("stair"),
  "1539": splitJump("barbell"),
  "2797": squatJump("lunge-after", "barbell"),
  "4709": squatJump("basketball"),
  "3704": squatJump("double"),
  "1552": squatJump("normal", "dumbbell"),
  "4822": squatJump("rdl-shrug", "dumbbell"),
  "1554": splitJump("dumbbell"),
  "4564": squatJump("lunge-series", "dumbbell"),
  "10053": squatJump("bench"),
  "0510": splitJump(undefined, false, true),
  "4964": squatJump("shrug", "hip-bar"),
  "1166": splitJump(),
  "4771": splitJump("hands-hips"),
  "4169": squatJump("pistol"),
  "5148": splitJump(undefined, true),
  "3187": squatJump("normal", "kettlebell"),
  "1570": squatJump("tuck"),
  "3877": squatJump("normal", "medicine"),
  "9070": squatJump("pogo"),
  "4118": squatJump("normal", "prisoner"),
  "9408": squatJump("pogo"),
  "3878": squatJump("normal", "band"),
  "7205": squatJump("normal", "loop"),
  "1584": squatJump("rocket"),
  "1117": squatJump("normal", "straps"),
  "6222": squatJump("normal", "straps"),
  "4904": squatJump("pogo"),
  "4166": squatJump("normal", "trap"),
  "3700": squatJump("tuck"),
  "3706": squatJump("tuck"),
  "10925": squatJump("one-foot"),
  "3876": squatJump("normal", "plate"),
  "5865": squatJump("switch-width"),
  "11283": squatJump("cross-tuck"),
  "4254": squatJump("single"),
  "9066": travelHop("four-way"),
  "10818": travelHop("four-way"),
  "4242": travelHop("broad-up"),
  "10890": travelHop("trampoline"),
  "7543": travelHop("forward-back"),
  "1698": travelHop("forward"),
  "3088": travelHop("frog"),
  "5990": travelHop("high-hurdle-sprint"),
  "6958": travelHop("hurdle"),
  "11782": travelHop("lateral"),
  "10758": travelHop("skater", "medicine"),
  "3862": travelHop("broad", "band"),
  "5153": travelHop("skater"),
  "7341": travelHop("skater"),
  "8916": travelHop("lateral"),
  "10732": travelHop("lateral-bench"),
  "4245": travelHop("single-board"),
  "5482": travelHop("single"),
  "7455": travelHop("single-lateral"),
  "11647": travelHop("single-pogo"),
  "1592": travelHop("single-stride"),
  "0782": travelHop("square"),
  "1600": travelHop("broad"),
  "3198": travelHop("zigzag"),
  "4706": travelHop("sidestep"),
  "10187": travelHop("up-side"),
  "4918": rhythmJump("high-hop"),
  "3376": rhythmJump("rope-jack"),
  "3378": rhythmJump("rope-split"),
  "7194": rhythmJump("back-cross"),
  "5105": rhythmJump("cross-jack"),
  "9679": rhythmJump("tap"),
  "5966": rhythmJump("twist"),
  "7555": rhythmJump("knee-jack"),
  "4898": rhythmJump("kick"),
  "2465": rhythmJump("band-jack"),
  "3269": rhythmJump("run-hop"),
  "3270": rhythmJump("run-jack"),
  "3272": rhythmJump("run-squat"),
  "5124": rhythmJump("twist"),
  "5038": jumpRope("double"),
  "3885": jumpRope("double"),
  "3678": jumpRope("high"),
  "3677": jumpRope("knees"),
  "4829": jumpRope("regular"),
  "3675": jumpRope("lateral"),
  "3676": jumpRope("skip"),
};
