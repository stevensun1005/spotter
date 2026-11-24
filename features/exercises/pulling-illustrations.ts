import type { Illustration, Point } from "./motion-data";

type Pair = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Grip = "close" | "shoulder" | "wide";
type Assist = "none" | "belt" | "band-foot" | "band-knee" | "cage";

const gap = { close: 10, shoulder: 23, wide: 42 };

function gripDetails(points: Point[]): Point[] {
  const [right, left] = [points[4], points[6]];
  return [...points, [right[0] + 4, right[1] - 4], [left[0] - 4, left[1] - 4]];
}

const underhand: Attachments = [["palm-up", 4, 11], ["palm-up", 6, 12]];

function elbow(shoulder: Point, wrist: Point, side: number, length: number): Point {
  const dx = wrist[0] - shoulder[0], dy = wrist[1] - shoulder[1];
  const distance = Math.max(1, Math.hypot(dx, dy));
  const outward = Math.sqrt(Math.max(0, length * length - (distance / 2) ** 2));
  return [shoulder[0] + dx / 2 - dy / distance * outward * side, shoulder[1] + dy / 2 + dx / distance * outward * side];
}

function make(body: [Point, Point, Point], hands: Pair, legs: [Pair, Pair], arm = 31, inactive?: Pair, extended = false): Point[] {
  const midpoint = (wrist: Point): Point => [(body[1][0] + wrist[0]) / 2, (body[1][1] + wrist[1]) / 2];
  const joint = (wrist: Point, side: number): Point => extended ? midpoint(wrist) : elbow(body[1], wrist, side, arm);
  return [...body, joint(hands[0], 1), hands[0],
    ...(inactive ?? [joint(hands[1], -1), hands[1]]), ...legs[0], ...legs[1]];
}

function fromFrames(frames: Point[][], props: Props, dynamic: Attachments = []): Illustration {
  return { frames, props, dynamic, ms: 1000, reference: true };
}

function hanging(grip: Grip, assist: Assist = "none", finish: "full" | "hold" | "half" = "full", reverse: boolean | "mixed" = false) {
  const rig: Props = assist === "cage"
    ? [[100, 33, 110, 33], [210, 33, 220, 33], [91, 19, 91, 160], [229, 19, 229, 160], [91, 91, 122, 91], [198, 91, 229, 91], [91, 19, 229, 19]]
    : [[85, 33, 235, 33], [85, 33, 85, 159], [235, 33, 235, 159]];
  const reach = assist === "cage" && grip === "wide" ? 50 : gap[grip];
  const hands: Pair = [[160 + reach, 33], [160 - reach, 33]];
  const at = (y: number) => {
    const hip: Point = [160, y + 34];
    const rightAnkle = Math.min(y + 69, 151);
    const leftAnkle = Math.min(y + 69, 152);
    const legs: [Pair, Pair] = [[
      [173, Math.min(y + 55, rightAnkle - 3)], [176, rightAnkle],
    ], [
      [149, Math.min(y + 55, leftAnkle - 8)], [144, leftAnkle],
    ]];
    if (assist === "band-knee") {
      legs[0] = [[173, Math.min(y + 49, 142)], [155, Math.min(y + 54, 149)]];
    }
    const points = gripDetails(make([[160, y - 21], [160, y], hip], hands, legs, 31, undefined, y >= 78));
    return [...points, [hip[0], hip[1] + 23] as Point];
  };
  const lower = at(finish === "half" ? 65 : grip === "wide" ? 78 : 85);
  const upper = at(45);
  const load: Attachments = reverse === "mixed" ? [underhand[0], ["palm-down", 6, 12]] : reverse ? [...underhand] : [];
  if (assist === "belt") load.push(["line", 2, 13], ["plate", 13, 0, 2]);
  if (assist === "band-foot") load.push(["band", 8, 150, 33]);
  if (assist === "band-knee") load.push(["band", 7, 150, 33]);
  const pause = finish === "hold" ? (assist === "cage" || assist === "band-foot" ? 2 : 6) : 1;
  return fromFrames([lower, ...Array<Point[]>(pause).fill(upper)], rig, load);
}

function boxPull(single: boolean): Illustration {
  const rig: Props = [[98, 32, 225, 32], [98, 32, 98, 158], [225, 32, 225, 158],
    [160, 142, 206, 142], [160, 142, 160, 158], [206, 142, 206, 158]];
  const at = (high: boolean): Point[] => {
    const y = high ? 45 : 86;
    return [[160, y - 20], [151, y], [146, y + 33],
      [high ? 139 : 155, high ? 68 : 60], [163, 32], [high ? 127 : 145, high ? 64 : 60], [142, 32],
      high ? [165, 108] : [181, 113], [176, 138],
      single ? [137, y + 53] : high ? [154, 109] : [174, 114],
      single ? [130, Math.min(y + 79, 154)] : [167, 138]];
  };
  return fromFrames([at(false), at(true), at(true)], rig);
}

function ringPull(grip: Grip, floorAssist: boolean, rope: boolean) {
  const height = floorAssist ? 52 : 31;
  const near: Point = [160 + gap[grip], height], far: Point = [160 - gap[grip], height];
  const attachment: Attachments = [
    ["line", 4, near[0], 10], ["line", 6, far[0], 10],
    ...(rope ? [["line", 4, near[0] + 1, height + 8], ["line", 6, far[0] + 1, height + 8]] as Attachments
      : [["ring", 4, 0, 1], ["ring", 6, 0, 1]] as Attachments),
  ];
  const at = (y: number) => {
    const hip: Point = [160, y + 27];
    const feetY = floorAssist ? 156 : Math.min(y + 63, 155);
    const kneesY = (hip[1] + feetY) / 2;
    const legs: [Pair, Pair] = floorAssist
      ? [[[190 - (97 - y) / 2, kneesY], [176, feetY]], [[133 + (97 - y) / 2, kneesY], [145, feetY]]]
      : [[[rope ? 166 : 171, kneesY], [rope ? 165 : 174, feetY]], [[rope ? 153 : 149, kneesY], [rope ? 154 : 146, feetY]]];
    return make([[160, y - 18], [160, y], hip], [near, far], legs, 31, undefined, y > 75);
  };
  return fromFrames([at(floorAssist ? 102 : 83), at(floorAssist ? 62 : 42)], [[98, 10, 222, 10]], attachment);
}

function seatedPull(grip: Grip, elevated = false, reverse = false, lowBar = false) {
  const barY = lowBar ? 72 : 60;
  const rig: Props = [[67, barY, 248, barY], [67, barY, 67, 156], [248, barY, 248, 156]];
  if (elevated) rig.push([221, 142, 246, 142], [224, 142, 224, 158], [243, 142, 243, 158]);
  const hands: Pair = [[166 + gap[grip] / 2, barY], [166 - gap[grip] / 2, barY]];
  const at = (y: number) => {
    const hips: Point = [135, y + 31];
    const edge = elevated ? 139 : 155;
    const center: Point = [(hips[0] + 228) / 2, (hips[1] + edge) / 2];
    return gripDetails(make([[161, y - 20], [155, y], hips], hands,
      [[center, [228, edge]], [[center[0] - 6, center[1] + 2], [219, edge + 1]]], 30, undefined, y === 122));
  };
  return fromFrames([at(122), at(barY + 13)], rig, reverse ? underhand : []);
}

function cablePulldown(position: "kneeling" | "seat" | "floor", grip: Grip, single: boolean, handle: "bar" | "underhand" | "parallel" = "bar") {
  const prop: Props = [[232, 16, 232, 159], [219, 159, 246, 159], [181, 18, 231, 18]];
  const y = position === "seat" ? 65 : position === "kneeling" ? 75 : 105;
  const hip: Point = [150, position === "floor" ? 152 : y + 42];
  const knees: [Pair, Pair] = position === "kneeling" ? [[[176, 153], [132, 156]], [[165, 153], [122, 156]]]
    : position === "floor" ? [[[182, 143], [207, 156]], [[171, 146], [194, 157]]]
    : [[[184, 113], [180, 157]], [[174, 115], [167, 157]]];
  if (position === "seat") {
    prop.push([127, 113, 159, 113], [136, 113, 136, 159], [171, 108, 188, 108]);
  }
  const reach = gap[grip];
  const upperHeight = position === "floor" ? 45 : 23;
  const upper: Pair = [[155 + reach, upperHeight], [155 - reach, upperHeight]];
  const lower: Pair = [[158 + reach, y + 15], [150 - reach, y + 15]];
  const idle: Pair = [[134, y + 21], [143, y + 39]];
  const body: [Point, Point, Point] = [[149, y - 17], [153, y], hip];
  const cables: Attachments = [["cable", single ? 4 : 13, 180, 18]];
  if (!single) {
    if (handle === "parallel") cables.push(["line", 4, 11], ["line", 6, 12], ["bar", 11, 12],
      ["thumb-up", 4, 11], ["thumb-up", 6, 12]);
    else cables.push(["bar", 4, 6]);
    if (handle === "underhand") cables.push(...underhand);
  }
  const at = (hands: Pair) => {
    const points = gripDetails(make(body, hands, knees, 34, single ? idle : undefined, hands === upper));
    return [...points, [(hands[0][0] + hands[1][0]) / 2, hands[0][1] - (handle === "parallel" ? 4 : 0)] as Point];
  };
  return fromFrames([at(upper), at(lower)], prop, cables);
}

const narrowSeatChin = seatedPull("close", false, true);
const seatChin = seatedPull("shoulder", false, true);
const weightedChin = hanging("shoulder", "belt", "full", true);
const kneeCableOneArm = cablePulldown("kneeling", "shoulder", true);

function invertedNarrow(): Illustration {
  const fixture: Props = [[71, 68, 185, 68], [80, 29, 80, 159], [179, 29, 179, 159], [66, 159, 96, 159], [164, 159, 196, 159]];
  const hold: Pair = [[132, 69], [111, 69]];
  const phase = (top: boolean) => gripDetails([
    top ? [113, 78] : [107, 114], top ? [131, 86] : [124, 120], top ? [173, 114] : [170, 132],
    top ? [150, 66] : [126, 93], hold[0], top ? [137, 66] : [115, 93], hold[1],
    top ? [203, 135] : [205, 145], [236, 155], top ? [197, 135] : [197, 143], [229, 154],
  ]);
  return fromFrames([phase(false), phase(true)], fixture, underhand);
}

function kneelingMachineChin(): Illustration {
  const fixture: Props = [[99, 21, 226, 21], [99, 21, 99, 158], [226, 21, 226, 158], [207, 158, 239, 158],
    [86, 158, 115, 158], [211, 63, 211, 155], [241, 63, 241, 155], [211, 63, 241, 63], [211, 155, 241, 155],
    [211, 136, 241, 136], [211, 143, 241, 143], [211, 150, 241, 150], [136, 21, 136, 32], [172, 21, 172, 32]];
  const hands: Pair = [[172, 31], [136, 31]];
  const at = (neckY: number) => {
    const kneeY = neckY + 68;
    const body: [Point, Point, Point] = [[152, neckY - 22], [154, neckY], [151, neckY + 35]];
    const feet: [Pair, Pair] = [[[160, kneeY], [129, kneeY + 1]], [[149, kneeY], [120, kneeY - 1]]];
    return [...gripDetails(make(body, hands, feet, 31, undefined, neckY > 60)), [137, kneeY + 5] as Point, [177, kneeY + 5] as Point];
  };
  return fromFrames([at(77), at(42), at(42)], fixture, [...underhand, ["bar", 13, 14], ["line", 14, 224, 98]]);
}

function inverseMachineCurl(): Illustration {
  const fixture: Props = [[186, 32, 186, 157], [222, 32, 222, 158], [186, 32, 222, 32],
    [188, 107, 221, 107], [188, 117, 221, 117], [188, 128, 221, 128], [188, 138, 221, 138],
    [148, 135, 191, 135], [183, 135, 185, 156], [185, 156, 216, 156],
    [180, 124, 191, 124], [186, 124, 186, 135], [62, 150, 89, 150], [62, 150, 62, 158], [89, 150, 89, 158]];
  const upright: Point[] = [[152, 56], [151, 74], [153, 106], [143, 99], [128, 96], [136, 102], [123, 99],
    [156, 129], [183, 128], [148, 130], [176, 130]];
  const lower: Point[] = [[79, 101], [94, 107], [129, 120], [87, 126], [72, 148], [84, 127], [67, 148],
    [156, 129], [183, 128], [148, 130], [176, 130]];
  return fromFrames([upright, lower, lower], fixture);
}

export const pullingIllustrations: Readonly<Record<string, Illustration>> = {
  "0139": invertedNarrow(),
  "0572": kneelingMachineChin(),
  "0627": hanging("shoulder", "none", "full", "mixed"),
  "2400": inverseMachineCurl(),
  "0841": hanging("shoulder", "belt"),
  "11714": ringPull("shoulder", false, true),
  "1204": cablePulldown("seat", "shoulder", true),
  "1866": hanging("wide", "cage", "hold"),
  "2997": hanging("shoulder", "band-foot"),
  "3358": cablePulldown("floor", "close", false, "parallel"),
  "4102": weightedChin,
  "4181": weightedChin,
  "4206": hanging("shoulder", "band-knee", "full", true),
  "4718": hanging("shoulder", "band-foot", "hold", true),
  "4773": narrowSeatChin,
  "4780": seatedPull("shoulder", false, true, true),
  "4781": seatChin,
  "4783": seatedPull("shoulder", true),
  "4784": seatedPull("wide", false, false, true),
  "4785": seatedPull("shoulder"),
  "4806": seatedPull("wide"),
  "4913": hanging("close", "none", "half"),
  "4920": ringPull("shoulder", true, false),
  "4948": kneeCableOneArm,
  "4983": hanging("shoulder", "none", "hold"),
  "5474": hanging("close", "none", "full", true),
  "5479": hanging("close"),
  "5522": ringPull("shoulder", false, false),
  "5581": kneeCableOneArm,
  "7228": ringPull("wide", false, false),
  "7583": cablePulldown("seat", "close", false, "parallel"),
  "8189": hanging("wide", "none", "full", true),
  "9320": hanging("close", "none", "hold", true),
  "9511": boxPull(false),
  "9512": boxPull(true),
  "10503": cablePulldown("seat", "close", false, "underhand"),
};
