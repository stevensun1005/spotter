import { curl, dumbbells, preacher, standing } from "./arm-illustrations";
import type { CurlPhase, CurlPose } from "./arm-illustrations";
import type { Illustration, Point } from "./motion-data";
import { reviewedCorrectionIllustrations } from "./reviewed-corrections-illustrations";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
const pose = (body: Torso, arms: Arms, legs: Legs, ...extra: Point[]): Point[] => [...body, ...arms, ...legs, ...extra];
const clip = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 900): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });
const add = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const bench: Props = [[101, 117, 164, 117], [108, 117, 108, 157], [157, 117, 157, 157]];
const benchCurl: CurlPose = { trunk: [[130, 45], [131, 63], [131, 110]],
  legs: [[158, 117], [162, 156], [145, 121], [149, 156]], elbows: [[142, 92], [122, 95]], support: bench };

function rotatingCurl(reverse: boolean): Illustration {
  const drill: CurlPhase[] = [[84, 84], [13, 13], [-66, -66], [-66, -66],
    ...(reverse ? [[-66, -66]] as CurlPhase[] : []), [13, 13], [84, 84]];
  const base = curl(reverse ? standing : benchCurl, { phases: drill });
  const frames = base.frames.map((points, frame) => {
    const palms = reverse ? (frame === 3 ? 1 : -1) : (frame < 3 ? 1 : -1);
    const hand = (wrist: Point, tip: Point, side: number) => add(wrist,
      -(tip[1] - wrist[1]) * side * 1.45, (tip[0] - wrist[0]) * side * 1.45);
    const weight = (wrist: Point, side: number) => [add(wrist, -7, -side * 5), add(wrist, 7, side * 5)];
    return [...points, hand(points[4], points[11], palms), hand(points[6], points[12], -palms),
      ...weight(points[4], palms), ...weight(points[6], -palms)];
  });
  return { ...base, frames, ms: 810, dynamic: [["hand", 4, 11, 15], ["hand", 6, 12, 16],
    ["bar", 17, 18], ["pad", 17, 0, 0], ["pad", 18, 0, 0],
    ["bar", 19, 20], ["pad", 19, 0, 0], ["pad", 20, 0, 0]] };
}

function floorWidePress(): Illustration {
  const body: Torso = [[157, 72], [157, 90], [158, 149]];
  const legs: Legs = [[189, 147], [226, 151], [173, 150], [204, 155]];
  const at = (arms: Arms) => pose(body, arms, legs, [170, 90], [144, 90]);
  return { ...clip([
    at([[189, 109], [191, 87], [125, 108], [124, 87]]),
    at([[189, 75], [192, 49], [124, 74], [123, 49]]),
    at([[190, 60], [197, 33], [123, 59], [116, 33]]),
  ], [], [["bar", 4, 6], ["barbell-end", 4, 14, 0], ["barbell-end", 6, -14, 0]]),
  shoulders: [11, 12] };
}

function elbowMotion(extension: boolean): Illustration {
  const body: Torso = extension ? [[129, 48], [129, 67], [131, 111]] : [[142, 43], [141, 62], [140, 105]];
  const legs: Legs = extension ? [[159, 120], [164, 157], [149, 122], [146, 157]] :
    [[153, 131], [157, 157], [130, 130], [125, 157]];
  const fixed: Point = extension ? [143, 94] : [153, 92];
  const [x, y] = fixed;
  const ready = (wrist: Point, fingertip: Point) => pose(body,
    [fixed, wrist, extension ? [120, 94] : [129, 87], extension ? [150, 116] : [128, 113]],
    legs, fingertip);
  const bent = ready([x + 17, y - 20], [x + 19, y - 25]);
  const midst = ready([x + 27, y], [x + 33, y]);
  const straight = ready([x + 2, y + 27], [x + 3, y + 32]);
  return clip(extension ? [bent, midst, straight, straight, midst] : [straight, midst, bent, bent, midst],
    extension ? bench : [], [["palm-up", 4, 11]]);
}

function elbowFlexorStretch(): Illustration {
  const body: Torso = [[128, 49], [129, 66], [128, 108]];
  const legs: Legs = [[143, 132], [152, 156], [119, 132], [115, 156]];
  const forearm = (q: number) => pose(body,
    [[156, 76], [183, 88], [143, 106], [191, 89 + q / 2]], legs,
    [194, 87 + q], [188, 85], [188, 90 + q], [186, 87 + q / 2], [135, 66], [123, 67]);
  const neutral = forearm(-1), stretched = forearm(10);
  return { ...clip([neutral, stretched, stretched, stretched, stretched, stretched, stretched, neutral], [],
    [["hand", 4, 11, 12], ["hand", 6, 13, 14]], 1300), shoulders: [15, 16] };
}

function elbowLever(): Illustration {
  const hands: [Point, Point] = [[150, 154], [137, 153]];
  const arms: Arms = [[147, 128], hands[0], [131, 129], hands[1]];
  const set = (body: Torso, legs: Legs) => pose(body, arms, legs, [158, 155], [145, 154]);
  const lean: Torso = [[186, 105], [170, 121], [124, 131]];
  const balance: Torso = [[187, 120], [171, 126], [122, 126]];
  const nearUp: [Point, Point] = [[96, 126], [72, 127]], farUp: [Point, Point] = [[93, 130], [68, 132]];
  const low = set(lean, [[102, 140], [78, 156], [93, 142], [71, 157]]);
  const rise = set(lean, [...nearUp, [93, 142], [71, 157]]);
  const hold = set(balance, [...nearUp, ...farUp]);
  return clip([low, rise, hold, hold, hold, hold, rise, low], [],
    [["digit", 4, 11, 4], ["digit", 6, 12, 4]], 1250);
}

function hangboardHold(sharp: boolean): Illustration {
  const nearHand: Point = [179, 32], farHand: Point = [141, 32];
  const at = (y: number, e: Point) => pose([[160, y - 18], [160, y], [160, y + 34]],
    [e, nearHand, [320 - e[0], e[1]], farHand],
    [[173, Math.min(y + 46, 140)], [167, Math.min(y + 54, 151)],
      [149, Math.min(y + 47, 143)], [153, Math.min(y + 55, 152)]],
    [169, y], [151, y], [179, 27], [141, 27]);
  const relaxed = at(106, [175, 67]);
  const pulled = sharp ? at(85, [201, 59]) : at(99, [187, 65]);
  return { ...clip([
    relaxed, pulled, pulled, pulled, pulled, pulled, relaxed,
  ], [[102, 16, 218, 16], [102, 16, 102, 28], [218, 16, 218, 28], [102, 28, 218, 28],
    [132, 24, 150, 24], [170, 24, 188, 24]],
  [["digit", 4, 13, 4], ["digit", 6, 14, 4]], 850), shoulders: [11, 12] };
}

function threeMonthPullover(): Illustration {
  const body: Torso = [[91, 144], [110, 151], [156, 152]];
  const legs: Legs = [[159, 114], [195, 115], [153, 120], [184, 121]];
  const at = (arms: Arms) => pose(body, arms, legs,
    [(arms[1][0] + arms[3][0]) / 2, (arms[1][1] + arms[3][1]) / 2]);
  return clip([
    at([[118, 123], [126, 98], [109, 124], [119, 99]]),
    at([[97, 129], [78, 115], [92, 131], [73, 119]]),
    at([[87, 142], [63, 139], [82, 147], [58, 145]]),
    at([[97, 129], [78, 115], [92, 131], [73, 119]]),
  ], [], [["kettlebell", 11, 0, 10]]);
}

function midBackSqueeze(): Illustration {
  const body: Torso = [[159, 47], [160, 66], [160, 108]];
  const legs: Legs = [[174, 131], [177, 156], [145, 131], [144, 156]];
  const at = (arms: Arms) => pose(body, arms, legs, [170, 70], [149, 69]);
  const opened = at([[197, 86], [176, 57], [123, 84], [145, 57]]);
  return { ...clip([at([[181, 71], [170, 52], [140, 70], [149, 52]]), opened, opened], [], [], 1050),
    shoulders: [11, 12] };
}

function bandRenegadeRow(): Illustration {
  const body: Torso = [[181, 97], [165, 107], [124, 124]];
  const legs: Legs = [[102, 139], [77, 154], [96, 135], [71, 149]];
  const leftBase: [Point, Point] = [[168, 130], [172, 155]], rightBase: [Point, Point] = [[150, 128], [146, 150]];
  const leftReach: [Point, Point] = [[182, 124], [199, 141]], rightReach: [Point, Point] = [[171, 120], [191, 135]];
  const at = (arms: Arms, active: Point) => pose(body, arms, legs, active, [171, 107], [158, 108]);
  const left = at([...leftReach, ...rightBase], leftReach[1]);
  const right = at([...leftBase, ...rightReach], rightReach[1]);
  const pass = at([[175, 128], [183, 154], [170, 129], [178, 151]], [181, 152]);
  return { ...clip([
    left, at([[137, 107], [153, 123], ...rightBase], [153, 123]), left, pass,
    right, at([...leftBase, [128, 105], [143, 121]], [143, 121]), right, pass,
  ], [[233, 84, 233, 155], [225, 155, 245, 155], [229, 148, 239, 148]],
  [["band", 11, 233, 148], ["pad", 11, 0, 0]], 880), shoulders: [12, 13] };
}

function stonePowerPress(): Illustration {
  const at = (body: Torso, legs: Legs, stone: Point, high = false) => pose(body, high ?
    [[176, 51], add(stone, 9, 6), [147, 49], add(stone, -9, 6)] :
    [[181, 102], add(stone, 11, 6), [147, 105], add(stone, -11, 6)], legs, stone);
  const tall: Torso = [[159, 43], [160, 60], [160, 108]];
  const stand: Legs = [[174, 133], [176, 155], [146, 133], [146, 155]];
  const dip: Legs = [[182, 135], [176, 155], [153, 137], [146, 155]];
  return clip([
    at(tall, stand, [166, 85]),
    at([[158, 52], [159, 69], [158, 118]], dip, [166, 94]),
    at(tall, stand, [166, 22], true),
    at(tall, stand, [166, 22], true),
    at(tall, stand, [166, 85]),
  ], [], [["stone", 11, 0, 0]]);
}

function weightedStraightDip(): Illustration {
  const props: Props = [[128, 87, 192, 81], [128, 87, 128, 156], [192, 81, 192, 156],
    [115, 156, 135, 156], [180, 156, 199, 156]];
  const form = (body: Torso, legs: Legs, elbowA: Point, elbowB: Point): Point[] =>
    pose(body, [elbowA, [170, 82], elbowB, [147, 84]], legs, add(body[2], 4, 32));
  return clip([form([[160, 17], [160, 35], [161, 88]], [[177, 111], [172, 125], [165, 111], [160, 124]],
    [169, 57], [149, 57]), form([[178, 36], [169, 57], [158, 101]], [[180, 116], [173, 134], [166, 119], [160, 133]],
    [148, 64], [134, 67])], props, [["pad", 2, 0, 0], ["line", 2, 11], ["plate", 11, 0, 0]]);
}

const threeBenches = reviewedCorrectionIllustrations["1753"];
const weightedThreeBenchDip: Illustration = { ...threeBenches, dynamic: [...threeBenches.dynamic!,
  ["plate", 2, 17, -5], ["pad", 2, 17, -5]] };

export const upperArmSpecialtyIllustrations: Record<string, Illustration> = {
  "1814": elbowFlexorStretch(),
  "1754": weightedThreeBenchDip,
  "2763": elbowMotion(true),
  "2764": elbowMotion(false),
  "3313": weightedStraightDip(),
  "3735": threeMonthPullover(),
  "3835": hangboardHold(true),
  "3836": hangboardHold(false),
  "4110": rotatingCurl(false),
  "7056": rotatingCurl(true),
  "8224": bandRenegadeRow(),
  "8585": midBackSqueeze(),
  "8613": curl(preacher, { phases: [[41, 41], [25, 25, 3], [-59, -59], [-14, -14]], gear: dumbbells }),
  "10049": floorWidePress(),
  "10665": elbowLever(),
  "11716": stonePowerPress(),
};
