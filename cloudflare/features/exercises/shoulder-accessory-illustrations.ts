import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Setup = { body: [Point, Point, Point]; legs: [Point, Point, Point, Point]; props?: Props };
const twoWeights: Attachments = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const oneWeight: Attachments = [["dumbbell", 4, 0, 0]];

const standing: Setup = { body: [[153, 44], [153, 61], [153, 105]],
  legs: [[173, 129], [178, 156], [134, 129], [129, 156]] };
const hinge: Setup = { body: [[181, 53], [165, 66], [126, 105]],
  legs: [[139, 129], [148, 156], [122, 131], [119, 156]] };
const partialSquat: Setup = { body: [[147, 58], [144, 73], [133, 113]],
  legs: [[165, 128], [172, 156], [120, 132], [116, 156]] };
const supportSeat: Props = [[116, 121, 178, 121], [120, 121, 120, 155], [172, 121, 172, 155]];
const sitting: Setup = { body: [[133, 54], [133, 70], [131, 113]],
  legs: [[178, 115], [183, 155], [164, 119], [167, 155]], props: supportSeat };
const lowCableSeat: Setup = {
  body: [[119, 83], [118, 101], [119, 142]],
  legs: [[154, 137], [178, 152], [150, 142], [172, 157]],
  props: [[104, 148, 145, 148], [110, 148, 110, 157], [141, 148, 141, 157]],
};
const proneIncline: Setup = { body: [[171, 49], [158, 63], [117, 108]],
  legs: [[134, 131], [137, 156], [107, 132], [104, 156]],
  props: [[117, 117, 167, 63], [123, 110, 123, 156], [102, 156, 146, 156]] };
const benchProxy: Props = [[80, 119, 220, 119], [90, 119, 90, 156], [211, 119, 211, 156]];
const lyingSide: Setup = { body: [[95, 97], [120, 103], [171, 109]],
  legs: [[198, 118], [215, 115], [193, 111], [211, 117]], props: benchProxy };
const sideFloor: Setup = { body: [[89, 131], [111, 136], [162, 150]],
  legs: [[195, 146], [221, 155], [192, 150], [214, 157]] };
const sideKnot: Setup = { body: [[115, 34], [115, 52], [98, 100]],
  legs: [[95, 128], [90, 156], [87, 128], [82, 156]] };
const mat: Props = [[44, 25, 261, 25], [261, 25, 261, 148], [261, 148, 44, 148], [44, 148, 44, 25]];
const proneFromAbove: Setup = { body: [[76, 85], [96, 85], [164, 85]],
  legs: [[194, 78], [226, 78], [193, 92], [226, 92]], props: mat };
const benchFromAbove: Setup = {
  ...proneFromAbove, body: [[80, 85], [103, 85], [168, 85]],
  props: [[64, 69, 211, 69], [211, 69, 211, 100], [211, 100, 64, 100], [64, 100, 64, 69]],
};

const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const middle = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const symmetric = ([x, y]: Point, [u, v]: Point): Arms => [[x, y], [u, v], [-x, y], [-u, v]];
const idle: Pair = [[-12, 23], [-13, 45]];
const armsDown = symmetric([14, 22], [16, 44]);
const lateral = symmetric([26, 3], [50, 2]);
const frontal: Arms = [[30, 8], [52, 6], [21, 12], [43, 10]];
const sweepBack: Arms = [[-28, 15], [-53, 19], [-27, 11], [-49, 15]];
const sweepSide: Arms = [[17, 20], [39, 26], [-11, -20], [-22, -38]];
const sweepFront: Arms = [[16, -14], [30, -38], [11, -10], [20, -32]];
const supportFloor: Pair = [[-19, 14], [-34, 13]];
const towelLoose = symmetric([25, 20], [46, 34]);

function frame(setup: Setup, arms: Arms, turn = 0, pitch = 0): Point[] {
  const [head, neck, hip] = setup.body;
  const center = add(neck, [turn, pitch]);
  return [add(head, [turn, pitch]), center, hip, ...arms.map((point) => add(center, point)), ...setup.legs];
}

function wristTip(elbow: Point, wrist: Point): Point {
  const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1];
  const scale = 5 / Math.max(1, Math.hypot(dx, dy));
  return add(wrist, [dx * scale, dy * scale]);
}

function tips(points: Point[]): Point[] {
  return [...points, wristTip(points[3], points[4]), wristTip(points[5], points[6])];
}

function clip(setup: Setup, frames: Point[][], dynamic: Attachments = [], props: Props = [], ms = 980, topView = false): Illustration {
  return { frames, dynamic, props: [...(setup.props ?? []), ...props], ms, topView, reference: true };
}

function raise(setup: Setup, start: Arms, end: Arms, dynamic: Attachments = [], props: Props = [], topView = false): Illustration {
  const upper = tips(frame(setup, end));
  return clip(setup, [tips(frame(setup, start)), upper, upper], dynamic, props, 980, topView);
}

const stack = (x: number, y: number): Props => [
  [x, 29, x, 157], [x - 10, 157, x + 14, 157], [x - 5, y, x + 5, y], [x - 12, 62, x - 12, 145],
  [x - 21, 62, x - 21, 145], [x - 21, 127, x - 12, 127], [x - 21, 135, x - 12, 135],
];
const pulley: Props = [[51, 32, 51, 154], [55, 32, 55, 154], [44, 154, 64, 154], [48, 141, 60, 141]];
const cableGrip: Attachments = [["cable", 4, 59, 141], ["pad", 4, 0, 0]];

function lyingCable(mode: "both" | "bench" | "floor"): Illustration {
  const start: Arms = [[29, -18], [63, -37], [29, 18], [63, 37]];
  const open: Arms = [[7, 36], [2, 68], [7, -36], [2, -68]];
  const setup = mode === "floor" ? { ...benchFromAbove, props: mat } : benchFromAbove;
  const low: Arms = mode === "both" ? start : [start[0], start[1], [29, -10], [58, -10]];
  const high: Arms = mode === "both" ? open : [open[0], open[1], [29, -10], [58, -10]];
  const move = (arms: Arms): Point[] => {
    const points = frame(setup, arms);
    return [...points, add(points[1], [0, 10]), add(points[1], [0, -10])];
  };
  const towers: Props = [[176, 18, 214, 18], [192, 13, 192, 26], [181, 14, 181, 24]];
  const links: Attachments = [["cable", 4, 192, 20], ["pad", 4, 0, 0]];
  if (mode === "both") {
    links.push(["cable", 6, 192, 151], ["pad", 6, 0, 0]);
    towers.push([176, 151, 214, 151], [192, 145, 192, 158], [181, 145, 181, 156]);
  }
  return { ...clip(setup, [move(low), move(high), move(high)], links, towers, 980, true), shoulders: [11, 12] };
}

function sideCable(higher: boolean): Illustration {
  const start: Arms = [[29, 8], [57, 18], ...supportFloor];
  const high: Arms = [[7, -28], [9, higher ? -57 : -52], ...supportFloor];
  return raise(sideFloor, start, high, cableGrip, pulley);
}

function bandFrontSuspension(): Illustration {
  const incline: Setup = { body: [[124, 49], [134, 66], [155, 103]],
    legs: [[174, 128], [198, 155], [168, 128], [192, 155]] };
  const tall: Setup = { ...incline, body: [[148, 42], [157, 58], [172, 102]] };
  return clip(incline, [
    frame(incline, [[25, 16], [49, 24], [17, 21], [41, 25]]),
    frame(tall, [[12, -24], [27, -44], [5, -22], [17, -44]]),
  ], [["line", 4, 244, 24], ["line", 6, 230, 24], ["pad", 4, 0, 0], ["pad", 6, 0, 0]],
  [[222, 24, 252, 24], [251, 24, 251, 156], [241, 156, 263, 156]]);
}

function scapularSetup(points: Point[], near: Point, far: Point): Point[] {
  return [...points, near, far];
}

function shrug(variant: "power" | "unilateral" | "cable" | "lever"): Illustration {
  const horizontal = variant === "cable";
  const setup = horizontal ? lowCableSeat : variant === "lever" ? sitting : standing;
  const wholeBody = variant === "power";
  const single = variant === "unilateral";
  const start: Arms = horizontal ? [[26, 8], [52, 11], [19, 11], [45, 13]] : symmetric([16, 26], [19, 49]);
  const make = (body: Setup, nearShift: Point, farShift: Point) => {
    const joints = frame(body, start);
    const [neckX, neckY] = joints[1];
    const near: Point = add([neckX + 13, neckY + 5], nearShift);
    const far: Point = add([neckX + (horizontal ? 7 : -13), neckY + 5], farShift);
    joints[3] = add(joints[3], nearShift);
    joints[4] = add(joints[4], nearShift);
    joints[5] = add(joints[5], farShift);
    joints[6] = add(joints[6], farShift);
    joints[3] = middle(near, joints[4]);
    joints[5] = middle(far, joints[6]);
    return scapularSetup(joints, near, far);
  };
  const neutral: Point = [0, 0];
  const lift: Point = horizontal ? [-6, -5] : [0, -10];
  const cool = make(setup, neutral, neutral);
  const up = make(setup, lift, single ? neutral : lift);
  const dip: Setup = { body: [[151, 54], [151, 71], [146, 115]], legs: [[176, 129], [178, 156], [131, 129], [129, 156]] };
  const baseFrames = wholeBody ? [cool, make(dip, neutral, neutral), up, cool] : [cool, up, up];
  const props: Props = variant === "lever" ? [[92, 112, 92, 156], [82, 156, 108, 156], [93, 111, 112, 111],
    [209, 111, 209, 155], [194, 155, 225, 155], [192, 111, 209, 111]] :
    horizontal ? [...stack(224, 115), [173, 151, 181, 139], [177, 150, 185, 138]] : [];
  const attachments: Attachments = wholeBody ? [["bar", 4, 6], ["barbell-end", 4, 11, 0], ["barbell-end", 6, -11, 0]]
    : single ? oneWeight : horizontal ? [["cable", 4, 220, 115], ["cable", 6, 220, 115], ["pad", 4, 0, 0], ["pad", 6, 0, 0]]
    : [["line", 4, 192, 111], ["line", 6, 112, 111], ["plate", 4, 7, -7], ["plate", 6, -7, -7]];
  return { ...clip(setup, baseFrames, attachments, props, wholeBody ? 820 : 980), shoulders: [11, 12] };
}

function invertedShrug(parallel: boolean): Illustration {
  const at = (rise: number) => {
    const body: Setup = {
      body: [[149, 144 - rise], [151, 122 - rise], [152, 75 - rise]],
      legs: [[159, 52 - rise], [162, 24 - rise], [146, 53 - rise], [145, 26 - rise]],
    };
    const shoulders: Pair = [[163, 116 - rise], [140, 117 - rise]];
    const hands: Pair = [[184, 74], [118, parallel ? 66 : 74]];
    const arms: Arms = [middle(shoulders[0], hands[0]), hands[0], middle(shoulders[1], hands[1]), hands[1]];
    return scapularSetup([ ...body.body, ...arms, ...body.legs ], ...shoulders);
  };
  const props: Props = parallel
    ? [[102, 66, 195, 66], [102, 66, 102, 156], [195, 66, 195, 156], [122, 74, 220, 74], [122, 74, 122, 157], [220, 74, 220, 157]]
    : [[91, 74, 211, 74], [95, 74, 95, 157], [208, 74, 208, 157]];
  return { ...clip(standing, [at(0), at(6), at(6)], [], props), shoulders: [11, 12] };
}

function cornerShrugSetup(style: "floor" | "bench"): Setup {
  return style === "bench" ? { ...proneFromAbove, props: benchFromAbove.props } : proneFromAbove;
}

function proneShape(style: "t" | "w", thumbs = false, dumbbell = false): Illustration {
  const from: Arms = style === "t" ? [[10, 27], [12, 54], [10, -27], [12, -54]] :
    [[10, 29], [-11, 37], [10, -29], [-11, -37]];
  const to: Arms = style === "t" ? [[0, 32], [0, 64], [0, -32], [0, -64]] :
    [[7, 34], [-20, 39], [7, -34], [-20, -39]];
  const equipment: Attachments = dumbbell ? twoWeights : thumbs ? [["thumb-up", 4, 11], ["thumb-up", 6, 12]] : [];
  const support = cornerShrugSetup(dumbbell ? "bench" : "floor");
  const low = tips(frame(support, from));
  const high = tips(frame(support, to, style === "w" && !dumbbell ? 4 : 0));
  return clip(support, [low, high, high], equipment, [], 1050, true);
}

type ScapularShape = "A" | "T" | "W" | "Y";
const scapularAngles: Record<ScapularShape, Arms> = {
  A: [[22, 21], [44, 39], [22, -21], [44, -39]],
  T: [[2, 31], [1, 61], [2, -31], [1, -61]],
  W: [[11, 26], [-13, 37], [11, -26], [-13, -37]],
  Y: [[-19, 20], [-41, 44], [-19, -20], [-41, -44]],
};

function proneScapular(shapes: ScapularShape[]): Illustration {
  const thumbs: Attachments = shapes[0] !== "A" ? [["thumb-up", 4, 11], ["thumb-up", 6, 12]] : [];
  const pose = (shape: ScapularShape, raised = false) => {
    const [e, w, o, h] = scapularAngles[shape];
    const projection = raised ? 1 : .86;
    const form = frame(proneFromAbove, [[e[0] * projection, e[1] * projection], [w[0] * projection, w[1] * projection],
      [o[0] * projection, o[1] * projection], [h[0] * projection, h[1] * projection]], raised && shape === "A" ? -4 : 0);
    return tips(form);
  };
  const start = pose(shapes[0]);
  const lifted = shapes.map(shape => pose(shape, true));
  const path = lifted.length === 1 ? [start, lifted[0], lifted[0]] : [start, ...lifted, ...lifted.slice(0,-1).reverse(), start];
  return clip(proneFromAbove, path, thumbs, [], 980, true);
}

function benchScapular(loaded: boolean): Illustration {
  const support: Setup = { body: [[213, 97], [196, 100], [148, 104]], legs: [[115, 108], [88, 113], [112, 105], [85, 109]],
    props: [[82, 115, 206, 115], [89, 115, 89, 155], [198, 115, 198, 155], [77, 156, 102, 156]] };
  const at = (near: boolean, far: boolean) => tips(frame(support, [near ? [23,-8] : [3,23], near ? [46,-15] : [5,45],
    far ? [22,-11] : [-5,20], far ? [43,-21] : [-6,42]]));
  const props: Attachments = [...(loaded ? twoWeights : []), ["thumb-up", 4, 11], ["thumb-up", 6, 12]];
  return clip(support, loaded ? [at(false,false),at(true,true),at(true,true)]
    : [at(false,false),at(true,false),at(true,false),at(false,false),at(false,true),at(false,true)], props, [], 890);
}

function standingCan(thumbsUp: boolean): Illustration {
  const dynamic: Attachments = [...twoWeights, ["digit", 4, 11, 2.5], ["digit", 6, 12, 2.5]];
  const thumb = (raw: Point[]): Point[] => [...raw,
    [raw[4][0] + 3, raw[4][1] + (thumbsUp ? -7 : 7)], [raw[6][0] - 3, raw[6][1] + (thumbsUp ? -7 : 7)]];
  const low = thumb(frame(standing, armsDown));
  const middle = thumb(frame(standing, [[24,19],[43,33],[-22,16],[-39,26]]));
  const high = thumb(frame(standing, [[31,4],[55,0],[-26,4],[-47,0]]));
  return clip(standing, [low,middle,high,high,middle], dynamic, [], 820);
}

function thoracicPress(): Illustration {
  const low = frame(standing, [[15,19], [10,6], [-15,19], [7,6]]);
  const tall = frame(standing, [[9,-20], [1,-42], [-8,-21], [-2,-42]], -4, -2);
  return clip(standing, [low, tall, tall], [], [], 960);
}

function floorSlide(): Illustration {
  const support: Setup = { ...proneFromAbove, body: [[78,86], [96,86], [155,86]],
    legs: [[175,68],[187,73],[174,107],[187,103]] };
  const low: Arms = [[7,32],[-17,34],[7,-32],[-17,-34]];
  const opened: Arms = [[-20,18],[-50,24],[-20,-18],[-50,-24]];
  return raise(support, low, opened, [], [], true);
}

function lowRopeHighPull(): Illustration {
  const low = frame(standing, [[12,30],[13,55],[-8,30],[-7,54]]);
  const rising = frame(standing, [[27,25],[20,34],[-26,22],[-12,34]]);
  const high = frame(standing, [[40,-3],[24,9],[-37,-4],[-19,8]]);
  const path = [low, rising, high, high, rising].map((p): Point[] => {
    const grip = middle(p[4], p[6]);
    return [...p, [grip[0] + 10, grip[1] + 15]];
  });
  return clip(standing, path, [["cable", 11, 242, 150], ["line", 4, 11], ["line", 6, 11],
    ["ring", 4, 0, 0], ["ring", 6, 0, 0]], stack(242, 150), 800);
}

function isometricTowel(): Illustration {
  const frames = [frame(standing, towelLoose), frame(standing, lateral), frame(standing, lateral)];
  const withCloth = frames.map((points, index): Point[] => {
    const [a, b] = [points[4], points[6]];
    const center = middle(a, b);
    const sag = index === 0 ? 10 : 2;
    return [...points, [a[0] * .65 + b[0] * .35, center[1] + sag * .72],
      [center[0], center[1] + sag], [b[0] * .65 + a[0] * .35, center[1] + sag * .72]];
  });
  return clip(standing, withCloth, [["line", 4, 11], ["line", 11, 12], ["line", 12, 13], ["line", 13, 6]]);
}

function fourRaise(): Illustration {
  const low = frame(standing, armsDown);
  const side = frame(standing, lateral);
  return clip(standing, [low, side, low, frame(standing, frontal), low,
    frame(hinge, armsDown), frame(hinge, sweepSide), frame(hinge, armsDown), low, side], twoWeights, [], 790);
}

function sweepingRaise(weight: boolean): Illustration {
  const mid = frame(hinge, sweepSide);
  const back = frame(hinge, sweepBack);
  const front = frame(hinge, sweepFront);
  const low = weight ? back : frame(hinge, armsDown);
  return clip(hinge, [low, back, mid, front, front, mid, back], weight ? twoWeights : []);
}

function frontTwist(kind: "dumbbell" | "ez" | "plate"): Illustration {
  const handsLow: Arms = [[16, 25], [16, 47], [0, 25], [4, 47]];
  const handsHigh: Arms = [[23, 10], [46, 7], [17, 12], [41, 12]];
  const plateTop: Arms = [[18, -24], [24, -47], [12, -25], [17, -47]];
  const lows = kind === "ez" ? symmetric([14, 26], [15, 47]) : handsLow;
  const wides = kind === "ez" ? [[21, 10], [45, 6], [10, 10], [18, 13]] as Arms : handsHigh;
  const withGrip = (raw: Point[]): Point[] => [...raw, middle(raw[4], raw[6])];
  const low = withGrip(frame(standing, lows));
  const high = withGrip(frame(standing, wides));
  const frames = kind === "dumbbell" ? [low, high, withGrip(frame(standing, wides, 15)), high, low, high,
    withGrip(frame(standing, [[-16, 14], [-38, 10], [-19, 12], [-45, 10]], -13)), high] :
    kind === "plate" ? [low, high, withGrip(frame(standing, plateTop)), withGrip(frame(standing, plateTop)), high] : [low, high, high];
  const equipment: Attachments = kind === "ez" ? [["ez-bar", 4, 6], ["plate", 4, 7, 0], ["plate", 6, -7, 0]]
    : [[kind, 11, 0, 0]];
  return clip(standing, frames, equipment);
}

function palmFlip(): Illustration {
  const at = (arms: Arms, tilt: number): Point[] => {
    const points = frame(standing, arms);
    return [...points, add(points[4], [6, tilt]), add(points[4], [-6, -tilt]),
      add(points[6], [6, -tilt]), add(points[6], [-6, tilt])];
  };
  return clip(standing, [at(armsDown, 0), at(lateral, -5), at(lateral, 5), at(lateral, -5)],
    [["bar", 11, 12], ["pad", 11, 0, 0], ["pad", 12, 0, 0], ["bar", 13, 14], ["pad", 13, 0, 0], ["pad", 14, 0, 0]]);
}

function chestThread(): Illustration {
  const support: Setup = { body: [[174, 104], [158, 113], [109, 130]],
    legs: [[82, 142], [55, 153], [77, 145], [49, 157]] };
  const brace: Pair = [[160, 154], [184, 154]];
  const high: Arms = [[155, 83], [152, 52], ...brace];
  const thread: Arms = [[149, 134], [128, 153], ...brace];
  const from = (arms: Arms, rotated: boolean) => {
    const trunk = rotated ? [[180, 111], [160, 121], ...support.body.slice(2)] : support.body;
    return [...trunk, ...arms, ...support.legs] as Point[];
  };
  return clip(support, [from(high, false), from(thread, true), from(high, false)]);
}

function battleRope(): Illustration {
  const low = frame(partialSquat, symmetric([13, 24], [16, 44]));
  const high = frame(partialSquat, symmetric([26, 7], [51, 4]));
  const wave = (points: Point[], phase: number) => {
    const result = [...points];
    for (const [wrist, anchor] of [[points[4], [251, 152]], [points[6], [230, 150]]] as [Point, Point][]) {
      for (let step = 1; step <= 5; step++) {
        const t = step / 5;
        const y = wrist[1] + (anchor[1] - wrist[1]) * t + Math.sin(t * 14 - phase) * Math.sin(t * Math.PI) * 12;
        result.push([wrist[0] + (anchor[0] - wrist[0]) * t, y]);
      }
    }
    return result;
  };
  const ropes: Attachments = [["line", 4, 11], ["line", 6, 16]];
  for (const index of [11, 12, 13, 14, 16, 17, 18, 19]) ropes.push(["line", index, index + 1]);
  return clip(partialSquat, [wave(low, 0), wave(high, 1.5), wave(low, 3.1), wave(high, 4.7)], ropes,
    [[225, 153, 260, 153], [234, 144, 252, 144]], 430);
}

const bentArmRaise = raise(standing, symmetric([13, 24], [23, 16]), symmetric([33, 0], [41, 14]), twoWeights);
const singleOverBench = lyingCable("bench");
const reverseFloor: Setup = { body: [[170, 144], [152, 147], [107, 151]], legs: [[82, 152], [53, 156], [77, 155], [49, 157]] };
const gripUnder: Attachments = [["palm-up", 4, 11], ["palm-up", 6, 12]];
const inclineProneRaise = raise(proneIncline, [[7, 22], [13, 48], [1, 26], [6, 45]],
  [[20, 16], [40, 15], [-19, 20], [-32, 18]], [["bar", 4, 6], ["barbell-end", 4, 7, 0], ["barbell-end", 6, -7, 0]]);
const backhandLow = tips(frame(reverseFloor, [[-22, 4], [-47, 6], [-20, 6], [-45, 8]]));
const backhandHigh = tips(frame(reverseFloor, [[-23, -9], [-45, -17], [-21, -8], [-43, -15]], 0, -3));

export const shoulderAccessoryIllustrations: Readonly<Record<string, Illustration>> = {
  "5800": proneScapular(["Y"]),
  "5040": proneScapular(["A"]),
  "5041": proneScapular(["T"]),
  "5042": proneScapular(["W"]),
  "5043": proneScapular(["W", "T"]),
  "5044": proneScapular(["W", "Y"]),
  "8546": proneScapular(["Y", "T", "W"]),
  "2940": benchScapular(false),
  "5820": benchScapular(true),
  "5818": standingCan(true),
  "5819": standingCan(false),
  "8343": thoracicPress(),
  "7538": floorSlide(),
  "6648": lowRopeHighPull(),
  "4663": clip(reverseFloor, [backhandLow, backhandHigh, backhandHigh], gripUnder),
  "3722": inclineProneRaise,
  "5662": shrug("power"),
  "2828": battleRope(),
  "11798": sweepingRaise(false),
  "3912": raise(hinge, [[-17, 20], [-28, 44], ...idle], [[18, 6], [42, 12], ...idle], cableGrip, stack(59, 141)),
  "3880": raise(sideKnot, [[9, 24], [-8, 46], [-25, 14], [-56, 16]],
    [[30, 4], [56, 4], [-25, 14], [-56, 16]], cableGrip, stack(59, 141)),
  "9872": lyingCable("both"),
  "9873": singleOverBench,
  "4013": singleOverBench,
  "9874": lyingCable("floor"),
  "4111": shrug("cable"),
  "2924": sideCable(false),
  "9491": sideCable(true),
  "4211": fourRaise(),
  "5635": bentArmRaise,
  "11799": sweepingRaise(true),
  "7252": raise(proneIncline, [[3, 26], [5, 50], [-7, 23], [-22, 38]],
    [[28, 7], [51, 11], [-7, 23], [-22, 38]], oneWeight),
  "10330": raise(lyingSide, [[17, 12], [14, 43], ...supportFloor],
    [[8, -31], [10, -58], ...supportFloor], oneWeight),
  "7747": proneShape("w", false, true),
  "10901": shrug("unilateral"),
  "5092": raise(standing, [armsDown[0], armsDown[1], ...idle], [frontal[0], frontal[1], ...idle], [...oneWeight, gripUnder[0]]),
  "10040": clip(standing, [frame(standing, armsDown), frame(standing, [[5, 13], [-18, 2], ...idle]),
    frame(standing, armsDown), frame(standing, [armsDown[0], armsDown[1], [-6, 13], [18, 2]])], twoWeights),
  "10183": frontTwist("dumbbell"),
  "5458": raise(standing, [[2, 25], [-15, 43], ...idle], [[-13, -8], [-34, -18], ...idle], oneWeight),
  "11014": raise(standing, armsDown, frontal, [...twoWeights, ...gripUnder]),
  "3986": frontTwist("ez"),
  "3225": proneShape("t", true),
  "7217": proneShape("t"),
  "11648": proneShape("w"),
  "4049": invertedShrug(false),
  "4043": invertedShrug(true),
  "3741": isometricTowel(),
  "1221": shrug("lever"),
  "3825": palmFlip(),
  "5133": raise(sitting, [[-12, 22], [-23, 41], [-15, 22], [-26, 41]],
    [[-18, 15], [-37, 30], [-20, 16], [-40, 30]]),
  "7854": chestThread(),
  "3404": raise(standing, frontal, lateral),
  "3405": raise(standing, symmetric([9, 23], [11, 9]), symmetric([29, 12], [49, -8])),
  "1075": bandFrontSuspension(),
  "10114": frontTwist("plate"),
};
