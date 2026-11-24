import type { Illustration, Point } from "./motion-data";

type Frame = Point[];
type Arms = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Side = "both" | "one" | "alternate" | "alternate-high";
type Weight = "body" | "dumbbell" | "hammer-weight" | "kettlebell" | "bottoms-up" | "barbell" | "ez-bar"
  | "bottle-upright" | "plate" | "two-plates" | "sandbag" | "trap-bar" | "stick";
type Setup = { body: [Point, Point, Point]; legs: [Point, Point, Point, Point]; props?: Props };

const seat: Props = [[128, 113, 178, 113], [131, 113, 131, 158], [172, 113, 172, 158]];
const backrest: Props = [[131, 65, 131, 113], ...seat];
const chairBack: Props = [[130, 76, 130, 113], [127, 76, 134, 76], ...seat];
const cableTower = (x: number, y: number): Props => [[x, 32, x, 157], [x - 12, 157, x + 12, 157], [x - 4, y, x + 4, y]];

const stance: Setup = { body: [[160, 41], [160, 58], [160, 101]], legs: [[176, 127], [184, 155], [145, 128], [137, 155]] };
const stagger: Setup = { body: [[168, 45], [165, 62], [157, 103]], legs: [[184, 123], [194, 155], [139, 126], [121, 155]] };
const sideStand: Setup = { body: [[145, 42], [141, 59], [139, 102]], legs: [[144, 128], [148, 155], [128, 129], [129, 155]] };
const splitKneeling: Setup = { body: [[167, 56], [164, 72], [158, 112]], legs: [[196, 121], [196, 155], [139, 154], [112, 155]] };
const tallKneeling: Setup = { body: [[164, 63], [160, 79], [154, 116]], legs: [[159, 154], [132, 155], [148, 154], [120, 155]] };
const sitting: Setup = { body: [[159, 53], [158, 70], [157, 107]], legs: [[182, 120], [185, 155], [138, 120], [135, 155]], props: seat };
const sittingBall: Setup = { ...sitting, props: undefined };
const sittingSide: Setup = { body: [[153, 55], [147, 71], [142, 109]], legs: [[178, 116], [182, 155], [167, 119], [168, 155]], props: seat };
const seatedBack: Setup = { ...sittingSide, props: backrest };
const chairSide: Setup = { ...sittingSide, props: chairBack };
const chairFront: Setup = { ...sitting, props: chairBack };
const bentStanding: Setup = { body: [[182, 57], [166, 69], [126, 97]], legs: [[141, 124], [145, 155], [122, 127], [117, 155]] };
const bentSeated: Setup = { body: [[184, 66], [169, 78], [138, 107]], legs: [[178, 112], [181, 155], [163, 117], [163, 155]], props: seat };
const inclineProne: Setup = {
  body: [[174, 45], [159, 58], [115, 103]], legs: [[125, 135], [130, 155], [110, 131], [109, 155]],
  props: [[117, 110, 165, 62], [118, 110, 118, 155], [103, 155, 146, 155]],
};
const inclineBack: Setup = {
  body: [[119, 45], [130, 59], [164, 104]], legs: [[188, 112], [188, 155], [178, 116], [176, 155]],
  props: [[111, 53, 160, 110], [160, 110, 190, 110], [147, 98, 147, 154], [134, 154, 184, 154]],
};
const flat: Setup = {
  body: [[101, 105], [116, 112], [170, 117]], legs: [[204, 124], [208, 155], [193, 127], [195, 155]],
  props: [[88, 124, 198, 124], [101, 124, 101, 155], [184, 124, 184, 155]],
};
const stackedOnBench: Setup = {
  body: [[100, 100], [119, 109], [161, 114]], legs: [[179, 111], [200, 117], [182, 121], [202, 122]],
  props: [[88, 128, 208, 128], [101, 128, 101, 155], [184, 128, 184, 155]],
};
const proneFlat: Setup = {
  body: [[178, 87], [164, 99], [115, 104]], legs: [[91, 106], [69, 108], [90, 114], [67, 114]],
  props: [[68, 112, 171, 112], [88, 112, 88, 155], [154, 112, 154, 155]],
};
const floor: Setup = { body: [[104, 145], [118, 147], [171, 151]], legs: [[192, 115], [207, 155], [183, 119], [191, 155]] };
const decline: Setup = {
  body: [[92, 115], [108, 113], [160, 96]], legs: [[187, 80], [209, 108], [176, 84], [194, 112]],
  props: [[83, 129, 177, 98], [95, 126, 95, 155], [161, 103, 161, 155], [190, 84, 208, 84], [195, 84, 195, 155]],
};
const lowSquat: Setup = {
  body: [[163, 78], [159, 93], [148, 129]], legs: [[180, 124], [185, 155], [121, 128], [120, 155]],
};
const loweredSide: Setup = {
  body: [[188, 62], [181, 78], [174, 114]], legs: [[200, 126], [205, 155], [136, 131], [108, 155]],
};
const lowLunge: Setup = { body: [[163, 69], [160, 85], [154, 124]], legs: [[188, 125], [188, 155], [127, 149], [105, 155]] };

function joints(setup: Setup, arms: Arms): Frame {
  const [x, y] = setup.body[1];
  return [...setup.body, ...arms.map(([dx, dy]): Point => [x + dx, y + dy]), ...setup.legs];
}

function cycle(setup: Setup, frames: Frame[], dynamic: Attachments, additionalProps: Props = [], ms = 980): Illustration {
  return { frames, dynamic, props: [...(setup.props ?? []), ...additionalProps], ms, reference: true };
}

function pair(kind: string, side: Side, y = 0): Attachments {
  return side === "one" ? [[kind, 4, 0, y]] : [[kind, 4, 0, y], [kind, 6, 0, y]];
}

function weights(kind: Weight, side: Side): Attachments {
  switch (kind) {
    case "body": return [];
    case "barbell": return [["bar", 4, 6], ["barbell-end", 4, 9, 0], ["barbell-end", 6, -9, 0]];
    case "ez-bar": return [["ez-bar", 4, 6], ["plate", 4, 8, 0], ["plate", 6, -8, 0]];
    case "stick": return [["bar", 4, 6]];
    case "trap-bar": return [["trap-bar", 4, -16, 0]];
    case "bottoms-up": return pair("kettlebell", side, -10);
    case "kettlebell": return pair("kettlebell", side, 10);
    case "plate": return [["plate", 4, -7, 0]];
    case "two-plates": return pair("plate", side);
    case "sandbag": return [["sandbag", 4, -9, -3]];
    default: return pair(kind, side, -2);
  }
}

const idle: [Point, Point] = [[-12, 26], [-13, 50]];
function reps(setup: Setup, low: Arms, high: Arms, side: Side): Frame[] {
  const base = joints(setup, side === "one" ? [low[0], low[1], ...idle] : low);
  if (side === "one") return [base, joints(setup, [high[0], high[1], ...idle])];
  const top = joints(setup, high);
  if (side === "alternate") return [base, joints(setup, [high[0], high[1], low[2], low[3]]), base, joints(setup, [low[0], low[1], high[2], high[3]])];
  if (side === "alternate-high") return [top, joints(setup, [low[0], low[1], high[2], high[3]]), top, joints(setup, [high[0], high[1], low[2], low[3]])];
  return [base, top];
}

const shoulderLow: Arms = [[29, 17], [26, -2], [-29, 17], [-26, -2]];
const shoulderHigh: Arms = [[25, -20], [24, -45], [-25, -20], [-24, -45]];
const closePressLow: Arms = [[17, 20], [15, 5], [-17, 20], [-15, 5]];
const closePressHigh: Arms = [[16, -19], [15, -44], [-16, -19], [-15, -44]];
const behindLow: Arms = [[40, 15], [38, -13], [-40, 15], [-38, -13]];
const behindHigh: Arms = [[38, -20], [38, -45], [-38, -20], [-38, -45]];

function shoulderPress(setup: Setup, kind: Weight, side: Side = "both", grip: "normal" | "close" | "behind" = "normal", addon: Attachments = [], props: Props = []): Illustration {
  const low = grip === "close" ? closePressLow : grip === "behind" ? behindLow : shoulderLow;
  const high = grip === "close" ? closePressHigh : grip === "behind" ? behindHigh : shoulderHigh;
  return cycle(setup, reps(setup, low, high, side), [...weights(kind, side), ...addon], props);
}

function bandAtFeet(side: Side = "both"): Attachments {
  return side === "one" ? [["band", 4, 8]] : [["band", 4, 8], ["band", 6, 10]];
}

const stack: Props = [[225, 42, 225, 154], [245, 42, 245, 154], [225, 42, 245, 42], [225, 154, 245, 154], [225, 116, 245, 116], [225, 126, 245, 126], [225, 136, 245, 136]];
const machinePivot: Props = [[95, 49, 95, 153], [87, 153, 110, 153], [95, 49, 105, 49], [232, 49, 232, 153], [218, 153, 242, 153], [222, 49, 232, 49]];
const pressLinks: Attachments = [["line", 4, 222, 49], ["line", 6, 105, 49]];
const pressPlate: Attachments = [["plate", 4, 9, -4], ["plate", 6, -9, -4]];

function compoundPress(kind: Weight, lower: Setup): Illustration {
  return cycle(stance, [
    joints(stance, shoulderLow), joints(lower, shoulderLow), joints(stance, shoulderHigh), joints(stance, shoulderLow),
  ], weights(kind, "both"));
}

const frontLow: Arms = [[10, 25], [16, 46], [2, 26], [7, 47]];
const frontHigh: Arms = [[31, 3], [53, -1], [24, 5], [45, 2]];
const frontEye: Arms = [[28, -7], [47, -17], [21, -5], [41, -16]];
const frontOverhead: Arms = [[16, -20], [24, -43], [10, -20], [15, -43]];
const lateralLow: Arms = [[15, 23], [17, 44], [-15, 23], [-17, 44]];
const lateralHigh: Arms = [[32, 3], [53, -1], [-32, 3], [-53, -1]];
const rearLow: Arms = [[15, 26], [19, 48], [-10, 24], [-15, 46]];
const rearHigh: Arms = [[31, 2], [50, 0], [-29, 1], [-49, 0]];

function raise(setup: Setup, kind: Weight, plane: "front" | "lateral" | "rear", side: Side = "both", range: "shoulder" | "eye" | "overhead" | "middle" | "bent" = "shoulder", addon: Attachments = [], props: Props = []): Illustration {
  const low: Arms = range === "middle" ? [[19, 22], [27, 35], [-19, 22], [-27, 35]]
    : plane === "front" ? frontLow : plane === "lateral" ? lateralLow : rearLow;
  const high: Arms = range === "middle" ? [[27, 12], [43, 20], [-27, 12], [-43, 20]]
    : range === "bent" ? [[33, 3], [33, 22], [-33, 3], [-33, 22]]
    : plane === "lateral" ? lateralHigh : plane === "rear" ? rearHigh
    : range === "eye" ? frontEye : range === "overhead" ? frontOverhead : frontHigh;
  return cycle(setup, reps(setup, low, high, side), [...weights(kind, side), ...addon], props);
}

function frontRaiseShared(kind: "plate" | "dumbbell" | "kettlebell", overhead = false, holdSeconds = 0): Illustration {
  const down: Arms = [[13, 24], [17, 46], [5, 24], [11, 47]];
  const up: Arms = overhead ?
    [[16, -19], [23, -43], [9, -19], [17, -43]] : [[29, 4], [51, 0], [23, 3], [45, 0]];
  const at = (arms: Arms): Frame => {
    const frame = joints(sideStand, arms);
    return [...frame, [(frame[4][0] + frame[6][0]) / 2, (frame[4][1] + frame[6][1]) / 2]];
  };
  const top = at(up);
  const frames = holdSeconds ? [at(down), ...Array<Frame>(holdSeconds + 2).fill(top)] : [at(down), top];
  return cycle(sideStand, frames, [[kind, 11, 0, kind === "kettlebell" ? 10 : 0]]);
}

function withGrip(demo: Illustration, grip: "palm-up" | "thumb-up", one = false): Illustration {
  const hands: Attachments = [[grip, 4, 11]];
  if (!one) hands.push([grip, 6, 12]);
  const end = ([ex, ey]: Point, [wx, wy]: Point): Point => {
    const length = Math.hypot(wx - ex, wy - ey) || 1;
    return [wx + (wx - ex) * 4 / length, wy + (wy - ey) * 4 / length];
  };
  return { ...demo, dynamic: [...(demo.dynamic ?? []), ...hands],
    frames: demo.frames.map((frame) => [...frame, end(frame[3], frame[4]), end(frame[5], frame[6])]) };
}

function twoWayRaise(setup: Setup, frontFirst: boolean): Illustration {
  const low = joints(setup, lateralLow);
  const front = joints(setup, frontHigh);
  const side = joints(setup, lateralHigh);
  return cycle(setup, [low, frontFirst ? front : side, low, frontFirst ? side : front], weights("dumbbell", "both"));
}

function floorRaise(setup: Setup, kind: Weight, side: Side, overhead: boolean, addon: Attachments = [], props: Props = []): Illustration {
  const low: Arms = [[23, -4], [42, 0], [20, -6], [39, -3]];
  const high: Arms = overhead ? [[-12, -16], [-30, -24], [-15, -15], [-33, -20]]
    : [[8, -22], [9, -45], [2, -21], [2, -44]];
  const resting: [Point, Point] = [[21, 0], [42, 2]];
  const frames = side === "one"
    ? [joints(setup, [low[0], low[1], ...resting]), joints(setup, [high[0], high[1], ...resting])]
    : reps(setup, low, high, side);
  return cycle(setup, frames, [...weights(kind, side), ...addon], props);
}

function reverseFly(setup: Setup, gear: Weight, side: Side, anchors: [Point, Point] | undefined): Illustration {
  const connections: Attachments = anchors
    ? (side === "one" ? [["cable", 4, ...anchors[0]]] : [["cable", 4, ...anchors[0]], ["cable", 6, ...anchors[1]]])
    : [];
  const towers = anchors ? [...cableTower(...anchors[0]), ...(side === "one" ? [] : cableTower(...anchors[1]))] : [];
  return raise(setup, gear, "rear", side, "shoulder", connections, towers);
}

function crossCableRear(setup: Setup, anchors: [Point, Point], standingStart = false): Illustration {
  const crossed: Arms = standingStart ?
    [[16, 1], [-23, 2], [-12, 0], [24, 3]] :
    [[10, 26], [-13, 46], [-10, 27], [12, 45]];
  return cycle(setup, reps(setup, crossed, rearHigh, "both"),
    [["cable", 4, ...anchors[0]], ["cable", 6, ...anchors[1]]], [...cableTower(...anchors[0]), ...cableTower(...anchors[1])]);
}

const chestLow: Arms = [[21, 13], [22, -7], [-20, 12], [-19, -7]];
const chestHigh: Arms = [[10, -24], [10, -46], [-9, -24], [-9, -46]];
const closeChestLow: Arms = [[14, 12], [14, -7], [-12, 12], [-12, -7]];
const closeChestHigh: Arms = [[12, -24], [12, -46], [-12, -23], [-12, -46]];
const floorChestLow: Arms = [[25, 8], [25, -13], [-22, 9], [-22, -12]];
const floorChestHigh: Arms = [[13, -23], [14, -45], [-13, -23], [-14, -45]];

function benchPress(setup: Setup, kind: Weight, side: Side = "both", mode: "normal" | "close" | "floor" | "pause" = "normal", addon: Attachments = [], props: Props = []): Illustration {
  const low = mode === "close" ? closeChestLow : mode === "floor" ? floorChestLow : chestLow;
  const high = mode === "close" ? closeChestHigh : mode === "floor" ? floorChestHigh : chestHigh;
  const resting: [Point, Point] = [[16, 2], [39, 0]];
  const frames = side === "one"
    ? [joints(setup, [low[0], low[1], ...resting]), joints(setup, [high[0], high[1], ...resting])]
    : reps(setup, low, high, side);
  if (mode === "pause" || mode === "floor") frames.push(frames[0]);
  return cycle(setup, frames, [...weights(kind, side), ...addon], props);
}

const boardProps = (count: number): Props => Array.from({ length: count }, (_, index): Props[number] => [128, 109 - index * 4, 149, 109 - index * 4]);
function boardPress(count: number): Illustration {
  const low: Arms = [[25, 8], [25, -4 - 4 * count], [-24, 8], [-24, -4 - 4 * count]];
  return cycle(flat, reps(flat, low, chestHigh, "both"), weights("barbell", "both"), boardProps(count));
}

const bridge: Setup = { ...floor, body: [[104, 143], [118, 145], [170, 122]], legs: [[196, 117], [207, 155], [184, 120], [191, 155]] };
const bracedBall: Setup = { ...flat, props: undefined, body: [[100, 105], [114, 115], [168, 121]], legs: [[209, 118], [210, 155], [196, 120], [197, 155]] };
const lyingBall: Attachments = [["stability-ball", 1, 0, 25]];
const underBackBand: Attachments = [["band", 4, 1], ["band", 6, 1]];
const floorBand = benchPress(floor, "body", "both", "floor", underBackBand);
const bandFromRackFoot: Attachments = [["band", 4, 76, 152], ["band", 6, 152, 152]];
const bandFromRackTop: Attachments = [["band", 4, 76, 39], ["band", 6, 152, 39]];

type Push = "horizontal" | "incline" | "decline";
type Pull = "press" | "fly";
function chestFromSeatOrStanding(setup: Setup, movement: Pull, angle: Push, side: Side, equipment: "cable" | "band" | "stack" | "lever" | "body", addons: Attachments = [], attachmentHeight?: number): Illustration {
  const startY = angle === "incline" ? 28 : 10;
  const low: Arms = movement === "fly" ? [[31, startY - 2], [51, startY], [-28, startY - 2], [-48, startY]]
    : [[-3, 22], [18, 14], [-12, 21], [10, 13]];
  const delta = angle === "incline" ? -18 : angle === "decline" ? 21 : 0;
  const high: Arms = movement === "fly"
    ? [[30, 5 + delta / 2], [45, 9 + delta], [17, 9 + delta / 2], [40, 12 + delta]]
    : [[27, 14 + delta / 2], [52, 14 + delta], [21, 16 + delta / 2], [46, 16 + delta]];
  const anchorY = attachmentHeight ?? (angle === "incline" ? 146 : angle === "decline" ? 54 : 78);
  const towerX = movement === "fly" ? 79 : 81;
  const props: Props = equipment === "stack" ? [...stack, ...machinePivot]
    : equipment === "lever" ? machinePivot : equipment === "cable" || equipment === "band" ? cableTower(towerX, anchorY) : [];
  const secondTower = movement === "fly" ? 234 : 99;
  if (equipment === "cable" && side !== "one") props.push(...cableTower(secondTower, anchorY));
  const links: Attachments = equipment === "body" ? [] : equipment === "stack" || equipment === "lever"
    ? (side === "one" ? [["line", 4, 222, 49]] : pressLinks)
    : side === "one" ? [[equipment, 4, towerX, anchorY]]
    : [[equipment, 4, towerX, anchorY], [equipment, 6, equipment === "cable" ? secondTower : towerX, anchorY]];
  return cycle(setup, reps(setup, low, high, side), [...links, ...addons], props);
}

const forwardChest = (setup: Setup, angle: Push, side: Side, gear: "cable" | "band" | "stack" | "lever" | "body", addon: Attachments = [], anchorY?: number) =>
  chestFromSeatOrStanding(setup, "press", angle, side, gear, addon, anchorY);
const spreadChest = (setup: Setup, angle: Push, side: Side, gear: "cable" | "band" | "stack" | "lever" | "body") =>
  chestFromSeatOrStanding(setup, "fly", angle, side, gear);
const strapCage: Props = [[75, 28, 233, 28], [80, 28, 80, 157]];
const straps: Attachments = [["line", 4, 101, 28], ["line", 6, 128, 28], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
const strapPressStart: Setup = { body: [[171, 58], [157, 72], [133, 108]], legs: [[119, 133], [105, 155], [111, 131], [98, 155]] };
const strapPressBottom: Setup = { body: [[187, 75], [174, 88], [142, 115]], legs: [[119, 134], [105, 155], [113, 134], [98, 155]] };
function suspensionPress(side: Side, narrow = false, liftedLeg = false): Illustration {
  const start: Arms = narrow ? [[26, 7], [46, 10], [22, 8], [43, 11]] : [[23, 10], [43, 17], [9, 10], [29, 16]];
  const low: Arms = narrow ? [[1, 16], [30, 2], [-1, 12], [26, 3]] : [[9, 18], [26, 4], [-5, 13], [14, 5]];
  const grounded: [Point, Point] = [[110, 130], [98, 155]];
  const raised: [Point, Point] = [[110, 121], [90, 132]];
  const setup = (body: Setup): Setup => ({ ...body, legs: side === "one"
    ? [[128, 134], [121, 155], [103, 133], [81, 155]] : [body.legs[0], body.legs[1], ...(liftedLeg ? raised : grounded)] });
  return cycle(strapPressStart, [
    joints(setup(strapPressStart), side === "one" ? [start[0], start[1], ...idle] : start),
    joints(setup(strapPressBottom), side === "one" ? [low[0], low[1], ...idle] : low),
  ], side === "one" ? straps.filter(([, joint]) => joint === 4) : straps, strapCage);
}

const highShelf: Props = [[87, 24, 87, 155], [237, 24, 237, 155], [87, 24, 237, 24], [78, 155, 99, 155], [228, 155, 245, 155]];
const pinHeight: Props = [[85, 105, 113, 105], [139, 105, 156, 105]];
function guidedSmith(setup: Setup, start: Arms, end: Arms, left: number, right: number): Illustration {
  const rails: Props = [[left, 12, left, 155], [right, 12, right, 155], [left, 12, right, 12],
    [left - 10, 155, left + 10, 155], [right - 10, 155, right + 10, 155]];
  const frames = reps(setup, start, end, "both").map((frame): Frame => {
    const y = (frame[4][1] + frame[6][1]) / 2;
    return [...frame, [right, y], [left, y]];
  });
  return cycle(setup, frames, [["bar", 11, 12], ["barbell-end", 11, 0, 0], ["barbell-end", 12, 0, 0]], rails);
}

function kneelingLandmine(): Illustration {
  const anchor: Point = [247, 151];
  const grip = (angle: number): Point => [anchor[0] - 110 * Math.cos(angle) - 160, anchor[1] - 110 * Math.sin(angle) - 79];
  return cycle(tallKneeling, reps(tallKneeling, [[10, 25], grip(.65), ...idle], [[23, -13], grip(1.15), ...idle], "one"),
    [["bar", 4, ...anchor], ["barbell-end", 4, 8, 4]], [[229, 152, 258, 152], [241, 149, 253, 149]]);
}

function inclineVPress(): Illustration {
  const handle: Attachments = [["cable", 11, 74, 148], ["line", 4, 11], ["line", 6, 11]];
  const frames = reps(inclineBack, closePressLow, closePressHigh, "both").map((frame): Frame => [
    ...frame, [(frame[4][0] + frame[6][0]) / 2 - 4, (frame[4][1] + frame[6][1]) / 2 + 7],
  ]);
  return cycle(inclineBack, frames, handle, cableTower(74, 148));
}

function svendBench(): Illustration {
  const low: Arms = [[18, 11], [5, -7], [-13, 11], [0, -7]];
  const high: Arms = [[7, -23], [4, -46], [-5, -23], [-1, -46]];
  const frames = reps(flat, low, high, "both").map((frame): Frame => [
    ...frame, [(frame[4][0] + frame[6][0]) / 2, (frame[4][1] + frame[6][1]) / 2],
  ]);
  return cycle(flat, frames, [["plate", 11, 0, 0]]);
}

const cableRaiseLow: Attachments = [["cable", 4, 80, 147]];
const cableNeutral = raise(sideStand, "body", "front", "one", "shoulder", cableRaiseLow, cableTower(80, 147));
const bandRear = raise(bentStanding, "body", "rear", "both", "shoulder", bandAtFeet());
const proneFront = raise(inclineProne, "dumbbell", "front");
const proneRear = raise(inclineProne, "dumbbell", "rear");
const flatPress = benchPress(flat, "barbell");
const lowChestBand = forwardChest(stagger, "incline", "both", "band");
const horizontalChestBand = forwardChest(stagger, "horizontal", "both", "band");
const bandOverhead = shoulderPress(stance, "body", "both", "normal", bandAtFeet());
const singleBandOverhead = shoulderPress(stance, "body", "one", "normal", bandAtFeet("one"));
const bandBehindOverhead = shoulderPress(stance, "body", "both", "behind", bandAtFeet());
const cableAngle: [Point, Point] = [[77, 140], [239, 140]];
const latCable = raise(stance, "body", "lateral", "one", "shoulder", cableRaiseLow, cableTower(80, 147));
const benchFly = cycle(flat, reps(flat, [[33, 5], [52, 8], [-33, 5], [-52, 8]], chestHigh, "both"), weights("dumbbell", "both"));
const seatedCableFly = spreadChest(seatedBack, "horizontal", "both", "cable");

const firstBackKick: Setup = { ...sideStand, legs: [[120, 122], [97, 130], sideStand.legs[2], sideStand.legs[3]] };
const secondBackKick: Setup = { ...sideStand, legs: [sideStand.legs[0], sideStand.legs[1], [116, 121], [94, 131]] };
const machineArmLinks: Attachments = [["line", 3, 222, 49], ["line", 5, 105, 49], ["pad", 3, 0, 0], ["pad", 5, 0, 0]];
const rearMachineSeat: Setup = {
  ...bentSeated, props: [...seat, [170, 72, 170, 103], [170, 103, 185, 103], ...machinePivot],
};
const jmLower: Arms = [[3, -25], [8, -10], [-8, -25], [-8, -10]];
const jmUpper: Arms = [[5, -24], [8, -46], [-7, -24], [-8, -46]];
const handstandOnBenches: Setup = {
  body: [[158, 99], [158, 85], [149, 48]], legs: [[144, 28], [139, 9], [152, 28], [146, 9]],
  props: [[137, 12, 137, 150], [81, 146, 128, 146], [188, 146, 235, 146], [89, 146, 89, 155], [225, 146, 225, 155]],
};
const handstandDepth: Setup = { ...handstandOnBenches, body: [[158, 147], [157, 130], [147, 84]], legs: [[143, 57], [138, 36], [152, 57], [145, 36]] };

const supineSitup = (kind: Weight): Illustration => {
  const floorSetup: Setup = { body: [[107, 146], [121, 148], [169, 153]], legs: [[188, 115], [208, 155], [176, 115], [192, 155]] };
  const top: Setup = { ...floorSetup, body: [[150, 88], [154, 101], [169, 146]] };
  const smallRack: Arms = [[12, 18], [13, -5], [-14, 17], [-12, -5]];
  return cycle(floorSetup, [
    joints(floorSetup, smallRack), joints(top, closePressLow), joints(top, closePressHigh), joints(top, closePressLow),
  ], weights(kind, "both"));
};

// Each catalogue key uses the setup and movement written for that exercise.
export const upperBodyIllustrations: Readonly<Record<string, Illustration>> = {
  "0793": raise(stance, "body", "lateral", "both", "shoulder", bandAtFeet()),
  "0834": raise(sideStand, "dumbbell", "front"),
  "0893": bandRear,
  "0923": lowChestBand,
  "1029": forwardChest(seatedBack, "horizontal", "both", "lever"),
  "1030": chestFromSeatOrStanding(seatedBack, "fly", "horizontal", "both", "stack", [["pad", 3, 0, 0], ["pad", 5, 0, 0]]),
  "1041": benchPress(flat, "body", "both", "normal", [...pressLinks, ...pressPlate], machinePivot),
  "1045": shoulderPress(seatedBack, "barbell", "both", "normal", [], highShelf),
  "1048": cycle(stackedOnBench, [
    joints(stackedOnBench, [[27, 6], [45, 15], [-10, 11], [-17, -2]]),
    joints(stackedOnBench, [[17, -20], [25, -41], [-10, 11], [-17, -2]]),
  ], weights("dumbbell", "one")),
  "1073": suspensionPress("both"),
  "1111": suspensionPress("both", true),
  "1124": suspensionPress("one"),
  "1126": suspensionPress("both", false, true),
  "1165": shoulderPress(stance, "barbell"),
  "1176": proneFront,
  "1195": forwardChest(seatedBack, "incline", "both", "stack", [["pad", 4, 2, 0], ["pad", 6, 2, 0]]),
  "1224": guidedSmith(stance, shoulderLow, shoulderHigh, 102, 218),
  "1226": shoulderPress(stance, "ez-bar"),
  "1230": raise(sideStand, "hammer-weight", "front", "alternate"),
  "1231": shoulderPress(seatedBack, "dumbbell", "one"),
  "1454": shoulderPress(seatedBack, "body", "both", "normal", pressLinks, machinePivot),
  "1455": forwardChest(seatedBack, "horizontal", "both", "lever"),
  "1497": benchPress(flat, "barbell", "both", "normal", bandFromRackTop, highShelf),
  "1499": bandBehindOverhead,
  "1540": compoundPress("barbell", lowSquat),
  "1862": shoulderPress(seatedBack, "body", "both", "normal", [...pressLinks, ["cable", 4, 227, 104]], [...stack, ...machinePivot]),
  "1876": raise(sitting, "body", "lateral", "both", "bent", [...machineArmLinks, ...pressPlate], machinePivot),
  "2234": raise(stance, "dumbbell", "lateral"),
  "2277": forwardChest(seatedBack, "horizontal", "both", "lever"),
  "2278": forwardChest(seatedBack, "decline", "both", "lever"),
  "2336": flatPress,
  "2337": benchFly,
  "2415": cycle(sideStand, reps(sideStand, lateralLow, lateralHigh, "one").map((frame) => {
    frame[0] = [156, 44];
    frame[1] = [151, 61];
    frame[5] = [118, 76];
    frame[6] = [92, 67];
    return frame;
  }), weights("dumbbell", "one"), [[92, 45, 92, 155], [83, 155, 106, 155]]),
  "2500": proneRear,
  "2659": forwardChest(seatedBack, "incline", "both", "lever", pressPlate),
  "2689": cableNeutral,
  "2690": raise(stance, "dumbbell", "lateral", "one"),
  "2932": shoulderPress(tallKneeling, "kettlebell", "one"),
  "2934": shoulderPress(splitKneeling, "kettlebell", "one"),
  "2962": shoulderPress(seatedBack, "body", "both", "close", [...pressLinks, ["pad", 4, 0, 0], ["pad", 6, 0, 0]], [...machinePivot, ...stack]),
  "2974": forwardChest(seatedBack, "horizontal", "one", "lever", [["plate", 4, 9, -4]]),
  "2996": singleBandOverhead,
  "3310": flatPress,
  "3321": cycle(stance, reps(stance, [[11, 11], [28, 12], [-11, 11], [13, 13]], lateralHigh, "both"), [["band", 4, 6]]),
  "3343": raise(sitting, "body", "lateral", "both", "bent", machineArmLinks, [...machinePivot, ...stack]),
  "3359": forwardChest(stagger, "horizontal", "both", "cable"),
  "3668": benchPress(floor, "dumbbell", "both", "floor"),
  "3685": proneRear,
  "3689": raise(sittingSide, "dumbbell", "front", "one"),
  "3690": shoulderPress(sittingBall, "dumbbell", "both", "normal", [["stability-ball", 2, 0, 25]]),
  "3694": raise(inclineProne, "dumbbell", "rear", "alternate"),
  "3695": benchPress(flat, "dumbbell", "alternate-high"),
  "3696": raise(bentStanding, "dumbbell", "rear", "alternate"),
  "3724": benchPress(floor, "barbell", "both", "floor"),
  "3726": raise(sittingSide, "barbell", "front"),
  "3729": benchPress(bracedBall, "barbell", "both", "normal", lyingBall),
  "3736": shoulderPress(stance, "bottoms-up", "one"),
  "3737": shoulderPress(sitting, "kettlebell", "one"),
  "3738": benchPress(flat, "kettlebell", "one"),
  "3739": benchPress(flat, "bottoms-up", "one"),
  "3740": raise(stance, "kettlebell", "lateral", "one"),
  "3780": horizontalChestBand,
  "3868": spreadChest(inclineProne, "horizontal", "both", "cable"),
  "3869": seatedCableFly,
  "3879": raise({ ...stance, body: [[168, 43], [165, 59], [155, 103]] }, "hammer-weight", "lateral"),
  "3913": raise(sideStand, "dumbbell", "front", "one"),
  "3916": cycle(handstandOnBenches, [
    joints(handstandOnBenches, [[-13, 29], [-41, 61], [14, 29], [43, 61]]),
    joints(handstandDepth, [[-40, 20], [-40, 16], [39, 20], [44, 16]]),
  ], []),
  "3943": reverseFly({ ...bentSeated, props: [...seat, [170, 74, 170, 104], [170, 104, 186, 104]] }, "body", "both", [[83, 79], [233, 79]]),
  "3971": bandRear,
  "3972": shoulderPress(stance, "dumbbell", "alternate"),
  "3980": proneFront,
  "3989": raise(inclineBack, "ez-bar", "front", "both", "eye"),
  "3990": shoulderPress(sitting, "ez-bar", "both", "close"),
  "4010": shoulderPress(tallKneeling, "body", "both", "normal", [["cable", 4, 234, 148], ["cable", 6, 234, 148]], cableTower(234, 148)),
  "4012": crossCableRear(inclineProne, cableAngle),
  "4014": raise(sideStand, "body", "front", "one", "eye", cableRaiseLow, cableTower(80, 147)),
  "4055": raise(sittingBall, "dumbbell", "lateral", "both", "shoulder", [["stability-ball", 2, 0, 25]]),
  "4066": raise(bentSeated, "dumbbell", "rear", "alternate"),
  "4068": boardPress(3),
  "4069": boardPress(2),
  "4070": boardPress(1),
  "4071": raise(inclineProne, "dumbbell", "front", "one"),
  "4073": spreadChest(stagger, "incline", "both", "band"),
  "4074": lowChestBand,
  "4075": spreadChest(stagger, "horizontal", "both", "band"),
  "4077": forwardChest(stagger, "incline", "alternate", "band"),
  "4078": spreadChest(stagger, "incline", "alternate", "band"),
  "4079": forwardChest(stagger, "horizontal", "alternate", "band"),
  "4114": bandRear,
  "4172": raise(bentStanding, "body", "rear"),
  "4174": withGrip(shoulderPress(seatedBack, "body", "both", "normal", [...pressLinks, ...pressPlate], machinePivot), "palm-up"),
  "4184": benchPress(flat, "dumbbell", "both", "normal", underBackBand),
  "4191": raise(stance, "dumbbell", "lateral", "both", "middle"),
  "4213": forwardChest(seatedBack, "horizontal", "both", "lever", [["band", 4, 109, 110], ["band", 6, 99, 110]]),
  "4227": floorRaise(floor, "body", "both", false, [["cable", 4, 66, 146], ["cable", 6, 66, 146]], cableTower(66, 146)),
  "4236": proneFront,
  "4238": twoWayRaise(sittingSide, false),
  "4341": raise(sideStand, "dumbbell", "front", "alternate"),
  "4346": shoulderPress(stance, "body"),
  "4371": forwardChest(seatedBack, "incline", "one", "lever", [["plate", 4, 9, -4]]),
  "4411": raise(sittingSide, "barbell", "front", "both", "eye"),
  "4499": compoundPress("body", { ...lowSquat, body: [[163, 84], [159, 99], [148, 136]] }),
  "4544": forwardChest(inclineBack, "incline", "both", "band"),
  "4574": cycle(stance, [joints(stance, lateralLow), joints(stance, shoulderLow), joints(stance, shoulderHigh), joints(stance, shoulderLow)], weights("dumbbell", "both")),
  "4613": shoulderPress({ ...sideStand, body: [[143, 42], [144, 60], [142, 104]] }, "body", "both", "normal", [], [[134, 28, 134, 156]]),
  "4621": supineSitup("dumbbell"),
  "4682": bandRear,
  "4686": bandBehindOverhead,
  "4703": compoundPress("body", lowSquat),
  "4731": benchPress(bridge, "dumbbell"),
  "4753": cycle(stance, [joints(stance, shoulderLow), joints(loweredSide, shoulderLow), joints(stance, shoulderHigh), joints(stance, shoulderLow),
    joints({ ...loweredSide, body: [[128, 62], [135, 78], [142, 114]], legs: [[180, 131], [207, 155], [115, 127], [110, 155]] }, shoulderLow), joints(stance, shoulderHigh)], weights("dumbbell", "both")),
  "4832": raise(proneFlat, "dumbbell", "rear"),
  "4834": benchPress(bracedBall, "dumbbell", "alternate", "normal", lyingBall),
  "4845": benchPress(floor, "kettlebell", "both", "floor"),
  "4846": benchPress(floor, "bottoms-up", "one", "floor"),
  "4847": frontRaiseShared("plate", true),
  "4852": raise(stance, "dumbbell", "lateral", "alternate"),
  "4856": benchPress(flat, "barbell", "both", "close", [], [...highShelf, ...pinHeight]),
  "4967": raise(stance, "dumbbell", "lateral"),
  "5097": benchPress(decline, "dumbbell", "alternate-high"),
  "5204": singleBandOverhead,
  "5205": bandOverhead,
  "5303": proneRear,
  "5309": supineSitup("ez-bar"),
  "5332": svendBench(),
  "5527": raise(rearMachineSeat, "body", "rear", "both", "shoulder", [...pressLinks, ["pad", 4, 0, 0], ["pad", 6, 0, 0]]),
  "5576": forwardChest(seatedBack, "incline", "one", "lever", [["plate", 4, 9, -4]]),
  "5608": horizontalChestBand,
  "5631": raise(stance, "dumbbell", "lateral", "both", "bent"),
  "5636": kneelingLandmine(),
  "5660": benchPress(flat, "barbell", "both", "pause", [], [...highShelf, ...pinHeight]),
  "5814": forwardChest(stagger, "incline", "both", "cable"),
  "5859": frontRaiseShared("kettlebell"),
  "5943": withGrip(cableNeutral, "thumb-up", true),
  "5944": raise(sideStand, "hammer-weight", "front", "one"),
  "6057": benchPress(floor, "bottle-upright", "both", "floor"),
  "6061": raise(bentStanding, "bottle-upright", "rear"),
  "6076": shoulderPress(stance, "bottle-upright"),
  "6097": cycle(sideStand, [joints(sideStand, shoulderLow), joints(firstBackKick, shoulderHigh),
    joints(sideStand, shoulderLow), joints(secondBackKick, shoulderHigh)], []),
  "6143": raise(sittingSide, "dumbbell", "front", "one"),
  "6355": forwardChest(seatedBack, "horizontal", "both", "lever"),
  "6485": raise(stance, "two-plates", "lateral"),
  "6486": bandRear,
  "6833": raise(sitting, "kettlebell", "lateral"),
  "7287": shoulderPress(stance, "trap-bar"),
  "7449": twoWayRaise(stance, true),
  "7588": frontRaiseShared("plate", false, 22),
  "7620": benchPress(flat, "barbell", "both", "normal", bandFromRackFoot, highShelf),
  "7621": benchPress(flat, "barbell", "both", "pause", [], [...highShelf, ...pinHeight]),
  "7994": benchPress(bridge, "dumbbell"),
  "8362": raise(stance, "body", "lateral", "one", "shoulder", bandAtFeet("one")),
  "8364": bandOverhead,
  "8502": shoulderPress({ ...splitKneeling, legs: [splitKneeling.legs[2], splitKneeling.legs[3], splitKneeling.legs[0], splitKneeling.legs[1]] }, "dumbbell", "one"),
  "8616": cycle(chairFront, reps(chairFront, [[33, 3], [34, -14], [-33, 3], [-34, -14]], [[12, 9], [13, -9], [-7, 10], [-8, -9]], "both"), []),
  "8618": cycle(chairSide, reps(chairSide, [[4, 21], [19, 12], [-10, 22], [16, 12]],
    [[28, 12], [52, 11], [24, 14], [49, 11]], "both"), []),
  "8620": forwardChest(chairSide, "decline", "both", "body"),
  "8622": forwardChest(chairSide, "incline", "both", "body"),
  "8633": shoulderPress(chairFront, "body"),
  "8662": inclineVPress(),
  "8847": raise(stance, "body", "lateral", "both", "bent", machineArmLinks, machinePivot),
  "8878": crossCableRear(bentStanding, cableAngle),
  "8901": latCable,
  "9187": raise(sideStand, "stick", "front"),
  "9385": guidedSmith(flat, jmLower, jmUpper, 68, 161),
  "9705": floorRaise(floor, "body", "one", false, [["cable", 4, 242, 149]], cableTower(242, 149)),
  "9868": reverseFly(bentStanding, "body", "one", cableAngle),
  "9932": benchPress(flat, "barbell", "both", "normal", bandFromRackFoot, highShelf),
  "9933": raise(sitting, "dumbbell", "lateral", "alternate"),
  "10116": guidedSmith(inclineBack, closeChestLow, closeChestHigh, 81, 184),
  "10388": shoulderPress(stance, "sandbag", "both", "close"),
  "10559": frontRaiseShared("dumbbell", true),
  "10560": benchPress(flat, "barbell", "both", "pause", [], highShelf),
  "10588": floorRaise(flat, "barbell", "both", false),
  "10589": floorRaise(floor, "stick", "both", true),
  "10669": forwardChest(seatedBack, "incline", "both", "stack"),
  "10670": forwardChest(seatedBack, "incline", "one", "stack"),
  "10671": forwardChest(seatedBack, "horizontal", "both", "stack"),
  "10672": forwardChest(seatedBack, "horizontal", "one", "stack"),
  "11016": shoulderPress(splitKneeling, "dumbbell", "one"),
  "11017": shoulderPress(tallKneeling, "dumbbell", "one"),
  "11254": crossCableRear(stance, [[83, 60], [234, 60]], true),
  "11260": shoulderPress(tallKneeling, "body", "both", "normal", [["cable", 4, 228, 148], ["cable", 6, 86, 148]], [...cableTower(86, 148), ...cableTower(228, 148)]),
  "11274": forwardChest(stagger, "decline", "alternate", "cable"),
  "11277": raise({ ...sideStand, legs: [[160, 128], [165, 155], [120, 131], [117, 155]] }, "body", "front", "one", "shoulder", cableRaiseLow, cableTower(80, 147)),
  "11285": floorBand,
};
