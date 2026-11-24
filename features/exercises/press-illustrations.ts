import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Setup = {
  body: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
  props?: Props;
};
type Side = "both" | "one" | "alternate" | "alternate-high";
type Grip = "standard" | "neutral" | "reverse" | "turn";
type Load = "dumbbell" | "barbell" | "cable" | "band";

const standing: Setup = {
  body: [[160, 46], [160, 63], [160, 103]],
  legs: [[176, 129], [180, 156], [145, 129], [142, 156]],
};
const split: Setup = {
  body: [[158, 46], [157, 63], [151, 105]],
  legs: [[178, 126], [193, 156], [133, 129], [116, 155]],
};
const kneel: Setup = {
  body: [[161, 61], [160, 77], [157, 118]],
  legs: [[173, 152], [144, 156], [151, 152], [126, 155]],
};
const halfKneel: Setup = {
  body: [[156, 56], [156, 73], [152, 111]],
  legs: [[187, 116], [195, 156], [144, 151], [109, 155]],
};
const seated: Setup = {
  body: [[148, 53], [149, 69], [152, 112]],
  legs: [[183, 113], [185, 155], [171, 116], [174, 154]],
  props: [[138, 62, 141, 119], [137, 119, 185, 119], [145, 119, 145, 156], [177, 119, 177, 156]],
};
const floorSit: Setup = {
  body: [[133, 83], [132, 99], [132, 149]],
  legs: [[169, 150], [202, 156], [166, 155], [192, 158]],
};
const lying: Setup = {
  body: [[91, 108], [111, 115], [163, 117]],
  legs: [[195, 122], [203, 156], [184, 126], [190, 156]],
  props: [[84, 124, 193, 124], [96, 124, 96, 156], [180, 124, 180, 156]],
};
const larsen: Setup = {
  ...lying,
  legs: [[196, 116], [227, 117], [193, 120], [222, 122]],
};
const floor: Setup = {
  body: [[89, 145], [105, 150], [160, 152]],
  legs: [[185, 123], [195, 156], [176, 126], [183, 156]],
};
const decline: Setup = {
  body: [[92, 124], [111, 119], [162, 102]],
  legs: [[192, 85], [205, 118], [184, 89], [196, 121]],
  props: [[84, 134, 181, 102], [94, 131, 94, 156], [172, 105, 172, 156], [186, 91, 208, 91], [194, 91, 194, 156]],
};
const lowIncline: Setup = {
  body: [[99, 78], [116, 92], [161, 118]],
  legs: [[194, 123], [203, 156], [184, 126], [190, 156]],
  props: [[96, 90, 158, 125], [158, 125, 195, 125], [140, 115, 140, 156], [183, 125, 183, 156]],
};
const highIncline: Setup = {
  body: [[119, 50], [126, 66], [149, 110]],
  legs: seated.legs,
  props: [[112, 59, 141, 117], [141, 117, 183, 117], [144, 117, 144, 156], [177, 117, 177, 156]],
};
const prone: Setup = {
  body: [[177, 51], [161, 65], [125, 109]],
  legs: [[149, 129], [154, 156], [116, 135], [112, 155]],
  props: [[126, 117, 172, 66], [132, 112, 132, 156], [114, 156, 149, 156]],
};

const offset = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const mirror = ([x, y]: Point): Point => [-x, y];
const symmetric = (elbow: Point, hand: Point): Arms => [elbow, hand, mirror(elbow), mirror(hand)];
const idle: Pair = [[-13, 23], [-14, 44]];
const lower = symmetric([25, 19], [24, 2]);
const raised = symmetric([15, -20], [18, -42]);
const arnoldLow = symmetric([11, 21], [13, 7]);
const benchLow = symmetric([24, 8], [24, -11]);
const benchHigh = symmetric([16, -23], [20, -44]);
const squeezeLow = symmetric([15, 12], [3, -9]);
const squeezeHigh = symmetric([8, -21], [3, -43]);
const floorLow = symmetric([29, 5], [29, -15]);
const chest = (arms: Arms): Arms => [
  offset(arms[0], [18, 0]), offset(arms[1], [18, 0]), offset(arms[2], [18, 0]), offset(arms[3], [18, 0]),
];

function pose(setup: Setup, arms: Arms, turn = 0): Point[] {
  const [head, neck, hip] = setup.body;
  const center = offset(neck, [turn, 0]);
  const points = [offset(head, [turn * 1.3, 0]), center, hip,
    ...arms.map((point) => offset(center, point)), ...setup.legs];
  return [...points, midpoint(points[4], points[6]), offset(points[4], [13, 0]), offset(points[6], [-13, 0])];
}

function clip(setup: Setup, frames: Point[][], dynamic: Attachments, props: Props = [], ms = 990): Illustration {
  return { frames, dynamic, props: [...(setup.props ?? []), ...props], ms, reference: true };
}

function straightVector(grip: Grip, high: boolean): Point {
  if (grip === "neutral") return [2, 7];
  if (grip === "reverse") return [6, -3];
  if (grip === "turn" && !high) return [3, 6];
  return [7, 0];
}

function handDetail(points: Point[], grip: Grip, nearHigh: boolean, farHigh: boolean): Point[] {
  const near = straightVector(grip, nearHigh), far = straightVector(grip, farHigh);
  return [...points, offset(points[4], near), offset(points[4], [-near[0], -near[1]]),
    offset(points[6], far), offset(points[6], [-far[0], -far[1]])];
}

function loadFor(load: Load, side: Side, grip: Grip): Attachments {
  if (load === "barbell") return [["bar", 12, 13], ["barbell-end", 12, 0, 0], ["barbell-end", 13, 0, 0]];
  if (load === "dumbbell") {
    if (grip === "standard") return side === "one" ? [["dumbbell", 4, 0, 0]]
      : [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
    if (grip === "neutral") return side === "one" ? [["hammer-weight", 4, 0, 0]]
      : [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]];
    const detail: Attachments = [["bar", 14, 15], ["pad", 14, 0, 0], ["pad", 15, 0, 0], ["palm-up", 4, 14]];
    if (side !== "one") detail.push(["bar", 16, 17], ["pad", 16, 0, 0], ["pad", 17, 0, 0], ["palm-up", 6, 16]);
    return detail;
  }
  return [];
}

const rack: Props = [[81, 20, 81, 156], [239, 20, 239, 156], [81, 20, 239, 20], [74, 156, 99, 156], [220, 156, 248, 156]];
const cableColumn = (x: number, y: number): Props => [[x, 27, x, 156], [x - 7, 156, x + 19, 156],
  [x, y, x + 9, y], [x - 9, 53, x - 9, 135], [x - 18, 53, x - 18, 135],
  [x - 18, 126, x - 9, 126], [x - 18, 116, x - 9, 116]];
const bandAnchor = (x: number, y: number): Props => [[x, 54, x, 156], [x - 10, 156, x + 10, 156], [x - 4, y, x + 4, y]];

function press(setup: Setup, load: Load, start: Arms, end: Arms,
  { side = "both", grip = "standard", free = idle, props = [], extra = [], turn = 0, beginHigh = false, softPause = false }:
  { side?: Side; grip?: Grip; free?: Pair; props?: Props; extra?: Attachments; turn?: number;
    beginHigh?: boolean; softPause?: boolean } = {}): Illustration {
  const frame = (arms: Arms, nearHigh = false, farHigh = nearHigh, rotate = 0) =>
    handDetail(pose(setup, side === "one" ? [arms[0], arms[1], ...free] : arms, rotate), grip, nearHigh, farHigh);
  const low = frame(start);
  const high = frame(end, true, true, turn);
  const near = () => frame([end[0], end[1], start[2], start[3]], true, false, turn);
  const far = () => frame([start[0], start[1], end[2], end[3]], false, true, -turn);
  const nearDown = () => frame([start[0], start[1], end[2], end[3]], false, true);
  const farDown = () => frame([end[0], end[1], start[2], start[3]], true, false);
  const frames = side === "alternate" ? [low, near(), low, far()] :
    side === "alternate-high" ? [high, nearDown(), high, farDown()] :
    beginHigh ? [high, low, ...(softPause ? [low] : []), high] : [low, ...(softPause ? [low] : []), high, high];
  return clip(setup, frames, [...loadFor(load, side, grip), ...extra], props);
}

const pressForward: Arms = [[2, 26], [23, 18], [-9, 26], [18, 18]];
const pressAway: Arms = [[28, 10], [56, 8], [26, 13], [53, 11]];
const pressIncline: Arms = [[25, -7], [47, -25], [21, -5], [43, -22]];
const narrowAcross: Arms = [[25, 11], [51, 9], [24, 11], [49, 10]];
const closeHandle: Attachments = [["bar", 4, 6]];
const lineChest: Attachments = [["cable", 11, 90, 76], ["pad", 11, 0, 0], ...closeHandle];

function closeCable(mode: "standing" | "sitting" | "lying"): Illustration {
  if (mode === "lying") {
    const start: Arms = [[16, 7], [19, -12], [10, 7], [13, -12]];
    const end: Arms = [[12, -22], [21, -44], [9, -23], [16, -44]];
    return press(lying, "cable", start, end, { props: cableColumn(60, 79),
      extra: [["cable", 11, 69, 79], ...closeHandle] });
  }
  return press(mode === "sitting" ? seated : split, "cable", pressForward, narrowAcross,
    { props: cableColumn(81, 76), extra: lineChest });
}

const bandLinks: Attachments = [["band", 4, 82, 143], ["band", 6, 82, 143]];
const narrowLow = symmetric([16, 10], [13, -10]);
const narrowHigh = symmetric([11, -23], [13, -44]);
const floorIdle: Pair = [[12, 4], [36, 5]];
const floorStraight: Arms = [[14, -21], [27, -39], [-13, -21], [-25, -39]];
const floorStraightHigh = symmetric([7, -24], [12, -49]);
const smithGuide: Props = [[91, 20, 91, 155], [197, 20, 197, 155], [91, 20, 197, 20], [81, 155, 205, 155],
  [85, 104, 98, 104], [191, 104, 204, 104], [85, 88, 98, 88], [191, 88, 204, 88]];

function hangingPress(setup: Setup, start: Arms, end: Arms, attachment: "plate" | "kettlebell" | "chain"): Illustration {
  const base = press(setup, "barbell", start, end);
  if (attachment === "chain") return {
    ...base, dynamic: [...(base.dynamic ?? []), ["chain", 12, 0, 157], ["chain", 13, 0, 157]],
  };
  const slope = (index: number) => (index === 1 ? 3 : index === 2 ? -3 : 0);
  const frames = base.frames.map((frame, index) => [
    ...frame, offset(frame[12], [slope(index), 22]), offset(frame[13], [-slope(index), 22]),
  ]);
  return {
    ...base, frames,
    dynamic: [...(base.dynamic ?? []), ["band", 12, 18], ["band", 13, 19],
      [attachment, 18, 0, attachment === "kettlebell" ? 8 : 0],
      [attachment, 19, 0, attachment === "kettlebell" ? 8 : 0]],
  };
}

function curlToArnold(): Illustration {
  const curlBottom = symmetric([14, 24], [17, 45]);
  const upperChest = pose(standing, arnoldLow);
  const shoulders = pose(standing, lower);
  const positions = [pose(standing, curlBottom), upperChest, shoulders, pose(standing, raised), shoulders, upperChest];
  const frames = positions.map((frame, index) => handDetail(frame, "turn", index === 0 || index === 3, index === 0 || index === 3));
  return clip(standing, frames,
    [["cable", 4, 244, 141], ["cable", 6, 76, 141], ["pad", 4, 0, 0], ["pad", 6, 0, 0],
      ["palm-up", 4, 14], ["palm-up", 6, 16]],
    [...cableColumn(67, 141), ...cableColumn(244, 141)]);
}

function smithGuidePress(demo: Illustration, extra: Attachments = []): Illustration {
  const frames = demo.frames.map((frame): Point[] => [...frame, [91, frame[4][1]], [197, frame[4][1]]]);
  return { ...demo, frames, props: [...(demo.props ?? []), ...smithGuide],
    dynamic: [["bar", 18, 19], ["barbell-end", 18, 0, 0], ["barbell-end", 19, 0, 0], ...extra] };
}

function smithShoulder(): Illustration {
  const start: Arms = [[18, 11], [16, -6], ...idle];
  const top: Arms = [[16, -20], [16, -46], ...idle];
  return smithGuidePress(press(seated, "cable", start, top, { side: "one", grip: "neutral" }),
    [["pad", 4, 0, 0], ["thumb-up", 4, 14]]);
}

const zPress = press(floorSit, "dumbbell", lower, raised);
const floorOne = press(floor, "dumbbell", chest(floorLow), chest(benchHigh), { side: "one", free: floorIdle, softPause: true });
const inclineClose = press(lowIncline, "dumbbell", chest(squeezeLow), chest(squeezeHigh), { grip: "neutral" });

function reachingFloorPress(): Illustration {
  const base = press(floor, "dumbbell", chest(floorLow), [[20, -27], [32, -52], ...floorIdle],
    { side: "one", free: floorIdle, softPause: true });
  const reach = [...base.frames[2]];
  reach[1] = offset(reach[1], [4, -3]);
  return { ...base, frames: [...base.frames.slice(0, 3), reach, base.frames[3]] };
}

export const pressIllustrations: Readonly<Record<string, Illustration>> = {
  "3324": press(split, "band", pressForward, pressIncline,
    { side: "alternate", turn: 7, extra: bandLinks, props: bandAnchor(82, 143) }),
  "4076": press(split, "band", [[-19, 27], [-10, 20], ...idle], [[25, 10], [49, 5], ...idle],
    { side: "one", extra: [["band", 4, 86, 82]], props: bandAnchor(86, 82) }),
  "4684": press(kneel, "band", pressForward, pressIncline, { extra: bandLinks, props: bandAnchor(82, 143) }),
  "4196": press(halfKneel, "cable", [[12, 19], [8, 7], [-12, 18], [4, 7]], [[10, 17], [20, 26], [-2, 17], [17, 26]],
    { props: cableColumn(81, 82), extra: [["cable", 11, 90, 82], ["pad", 11, 0, 0]] }),
  "3362": closeCable("lying"),
  "3364": closeCable("sitting"),
  "11272": curlToArnold(),
  "3363": closeCable("standing"),
  "11764": press(split, "cable", pressForward, pressAway, {
    side: "one", grip: "reverse", extra: [["cable", 4, 91, 77], ["pad", 4, 0, 0], ["palm-up", 4, 14]],
    props: cableColumn(82, 77),
  }),
  "1209": press(split, "cable", [[13, 22], [23, 4], ...idle], [[13, -18], [14, -43], ...idle], {
    side: "one", turn: 8, props: cableColumn(79, 138), extra: [["cable", 4, 88, 138], ["pad", 4, 0, 0]],
  }),
  "1211": press(standing, "cable", [[8, 22], [21, 11], ...idle], [[24, 7], [51, 8], ...idle], {
    side: "one", turn: 9, props: cableColumn(81, 74), extra: [["cable", 4, 90, 74], ["pad", 4, 0, 0]],
  }),
  "3185": hangingPress(lying, chest(benchLow), chest(benchHigh), "plate"),
  "4201": hangingPress(lying, chest(benchLow), chest(benchHigh), "chain"),
  "4414": hangingPress(lying, chest(benchLow), chest(benchHigh), "kettlebell"),
  "6271": press(larsen, "barbell", chest(narrowLow), chest(narrowHigh)),
  "10115": press(decline, "barbell", chest(narrowLow), chest(narrowHigh), { beginHigh: true }),
  "9694": press(halfKneel, "barbell", lower, raised),
  "6270": press(larsen, "barbell", chest(benchLow), chest(benchHigh)),
  "3186": hangingPress(standing, lower, raised, "plate"),
  "3917": press(floor, "barbell", chest(floorLow), chest(benchHigh), {
    grip: "reverse", softPause: true, extra: [["palm-up", 4, 14], ["palm-up", 6, 16]],
  }),
  "5668": press(standing, "barbell", lower, raised, {
    props: [...rack, [81, 74, 133, 74], [190, 74, 239, 74]], softPause: true,
  }),
  "5328": press(standing, "barbell", lower, raised),
  "4866": press(floorSit, "barbell", lower, raised),
  "4067": press(seated, "dumbbell", arnoldLow, raised, { side: "alternate", grip: "turn" }),
  "6891": press(floorSit, "dumbbell", lower, raised, { side: "alternate" }),
  "2982": press(floor, "dumbbell", chest(floorLow), chest(benchHigh), { side: "alternate-high" }),
  "3075": press(lying, "dumbbell", chest(squeezeLow), chest(squeezeHigh), { grip: "neutral" }),
  "4125": press(prone, "dumbbell", [[25, 9], [23, -9], [14, 12], [11, -7]],
    [[21, -20], [42, -37], [12, -20], [28, -34]]),
  "4577": press(halfKneel, "dumbbell", lower, raised),
  "4015": inclineClose,
  "1214": press(lowIncline, "dumbbell", chest(narrowLow), chest(narrowHigh), { grip: "reverse" }),
  "5261": press(highIncline, "dumbbell", lower, raised),
  "5067": inclineClose,
  "6218": press(lowIncline, "dumbbell", chest(benchLow), chest(benchHigh), { grip: "turn" }),
  "4745": press(kneel, "dumbbell", arnoldLow, raised, { grip: "turn" }),
  "6272": press(larsen, "dumbbell", chest(benchLow), chest(benchHigh), { beginHigh: true }),
  "10042": press(floor, "dumbbell", chest([[15, 5], [3, -14], [-15, 5], [-3, -14]]), chest(squeezeHigh),
    { grip: "neutral", softPause: true }),
  "3319": press(floor, "dumbbell", chest(floorLow), chest(benchHigh), { grip: "neutral", softPause: true }),
  "11800": reachingFloorPress(),
  "9213": press(floor, "dumbbell", floorStraight, floorStraightHigh),
  "4835": press(lying, "dumbbell", chest(benchLow), chest(benchHigh), { grip: "turn" }),
  "4120": press(seated, "dumbbell", arnoldLow, raised, { side: "one", grip: "turn" }),
  "6142": press(seated, "dumbbell", arnoldLow, raised, { grip: "turn", beginHigh: true }),
  "4065": press(standing, "dumbbell", arnoldLow, raised, { side: "alternate", grip: "turn" }),
  "4108": press(standing, "dumbbell", arnoldLow, raised, { grip: "turn" }),
  "4833": press(standing, "dumbbell", arnoldLow, raised, { side: "one", grip: "turn" }),
  "5093": floorOne,
  "10043": press(floorSit, "dumbbell", lower, raised, { side: "one" }),
  "5667": zPress,
  "6890": zPress,
  "2919": smithGuidePress(press(lying, "barbell", chest(narrowLow), chest(narrowHigh), { beginHigh: true })),
  "10863": smithShoulder(),
};
