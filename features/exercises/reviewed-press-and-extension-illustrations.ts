import type { Illustration, Point } from "./motion-data";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
const pose = (body: Torso, arms: Arms, legs: Legs, ...extra: Point[]): Point[] => [...body, ...arms, ...legs, ...extra];
const clip = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 940): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });
const shift = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const twoDumbbells: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const tower = (x: number, y: number): Props => [[x, 27, x, 156], [x + 11, 27, x + 11, 156],
  [x, 27, x + 11, 27], [x - 4, y, x + 5, y], [x - 8, 156, x + 17, 156],
  [x, 117, x + 11, 117], [x, 125, x + 11, 125], [x, 133, x + 11, 133]];

function onBallTricepsExtension(): Illustration {
  const body: Torso = [[96, 108], [115, 118], [166, 117]];
  const legs: Legs = [[194, 122], [201, 156], [182, 126], [186, 155]];
  const elbow: Point = [124, 86], farElbow: Point = [110, 84];
  const hold = (nearWrist: Point, farWrist: Point) =>
    pose(body, [elbow, nearWrist, farElbow, farWrist], legs, [121, 117], [108, 115]);
  return { ...clip([
    hold([125, 59], [111, 58]),
    hold([102, 70], [92, 68]),
    hold([97, 88], [83, 86]),
    hold([102, 70], [92, 68]),
  ], [], [...twoDumbbells, ["stability-ball", 1, 3, 23]]), shoulders: [11, 12] };
}

function lyingRopeExtension(): Illustration {
  const body: Torso = [[101, 111], [119, 119], [166, 119]];
  const legs: Legs = [[195, 124], [202, 156], [182, 127], [187, 156]];
  const bench: Props = [[89, 128, 205, 128], [99, 128, 99, 157], [193, 128, 193, 157]];
  const elbow: Point = [122, 93], farElbow: Point = [111, 92];
  const at = (nearWrist: Point, farWrist: Point) =>
    pose(body, [elbow, nearWrist, farElbow, farWrist], legs,
      [(nearWrist[0] + farWrist[0]) / 2 - 12, (nearWrist[1] + farWrist[1]) / 2 + 6], [123, 118], [112, 117]);
  return { ...clip([
    at([125, 67], [111, 66]),
    at([105, 73], [93, 73]),
    at([97, 91], [85, 91]),
    at([105, 73], [93, 73]),
  ], [...bench, ...tower(58, 145)], [
    ["cable", 11, 61, 145], ["line", 4, 11], ["line", 6, 11], ["pad", 4, 0, 0], ["pad", 6, 0, 0],
  ]), shoulders: [12, 13] };
}

function reverseOverheadCable(): Illustration {
  const body: Torso = [[162, 55], [157, 73], [150, 115]];
  const legs: Legs = [[165, 134], [172, 156], [139, 134], [131, 155]];
  const elbow: Point = [167, 54];
  const at = (wrist: Point, tip: Point) => pose(body, [elbow, wrist, [146, 98], [144, 122]],
    legs, tip, [162, 71], [149, 74]);
  const bend = at([141, 65], [134, 67]), top = at([170, 26], [169, 20]);
  return { ...clip([bend, at([145, 39], [139, 36]), top, top], tower(79, 39),
    [["cable", 4, 84, 39], ["pad", 4, 0, 0], ["palm-up", 4, 11]]), shoulders: [12, 13] };
}

function bandTwistPress(): Illustration {
  const legs: Legs = [[176, 132], [179, 156], [141, 131], [138, 156]];
  const stance = (turn: number, arms: Arms) => pose([[159 + turn, 44], [159 + turn / 2, 63], [160, 108]], arms, legs,
    [170 + turn, 64 + turn / 4], [148 + turn, 64 - turn / 4], [159 + turn * 1.55, 45]);
  const shoulders: Arms = [[180, 83], [182, 60], [137, 83], [136, 60]];
  const base = stance(0, shoulders);
  const sweep = (turn: number, peak: boolean): Point[] => {
    const up = peak ? 24 : 14;
    return stance(turn, [[178 + turn, 73 - up], [183 + turn, 51 - up],
      [139 + turn, 74 - up], [134 + turn, 52 - up]]);
  };
  return { ...clip([base, sweep(5, false), sweep(10, true), base, sweep(-5, false), sweep(-10, true), base],
    [], [["band", 4, 8], ["band", 6, 10], ["pad", 4, 0, 0], ["pad", 6, 0, 0], ["face", 0, 13]]),
  shoulders: [11, 12] };
}

const rotatingDumbbells: Gear = [["hand", 4, 13, 14], ["hand", 6, 15, 16],
  ["bar", 17, 18], ["pad", 17, 0, 0], ["pad", 18, 0, 0],
  ["bar", 19, 20], ["pad", 19, 0, 0], ["pad", 20, 0, 0]];

function arnoldPress(otherAngle: boolean): Illustration {
  const body: Torso = otherAngle ? [[153, 55], [155, 74], [158, 115]] : [[160, 48], [160, 68], [161, 112]];
  const legs: Legs = otherAngle ? [[174, 120], [185, 155], [143, 122], [144, 155]] :
    [[181, 116], [183, 155], [143, 118], [141, 156]];
  const bench: Props = otherAngle ? [[136, 122, 181, 122], [137, 122, 145, 64], [141, 122, 141, 157], [178, 122, 178, 157]] :
    [[139, 119, 189, 119], [149, 119, 149, 67], [144, 119, 144, 157], [183, 119, 183, 157]];
  const [x, y] = body[1];
  const at = (elbow: number, elbowY: number, wrist: number, wristY: number, turn: number) => {
    const near: Point = [x + wrist, y + wristY], far: Point = [x - wrist, y + wristY];
    const wide = turn === 0 ? 4 : 8;
    const depth = otherAngle ? 3 : 0;
    return pose(body, [[x + elbow, y + elbowY], near, [x - elbow + depth, y + elbowY + depth], far], legs,
      [x + 11, y], [x - 10, y], shift(near, 0, -6), shift(near, -turn * 6, -2),
      shift(far, 0, -6), shift(far, turn * 6, -2),
      shift(near, -wide, turn * 4), shift(near, wide, -turn * 4),
      shift(far, -wide, -turn * 4), shift(far, wide, turn * 4));
  };
  const inward = at(11, 27, 12, -2, -1), rotate = at(27, 15, 25, -10, 0);
  const out = at(37, 4, 34, -23, 1), top = at(26, -28, 29, -57, 1);
  return { ...clip([inward, rotate, out, top, out, rotate], bench, rotatingDumbbells, 790),
    shoulders: [11, 12] };
}

function cubanPress(otherAngle: boolean): Illustration {
  const body: Torso = otherAngle ? [[151, 43], [154, 61], [152, 108]] : [[161, 46], [161, 64], [161, 110]];
  const legs: Legs = otherAngle ? [[167, 132], [175, 156], [138, 133], [130, 155]] :
    [[175, 134], [180, 156], [148, 135], [143, 156]];
  const [x, y] = body[1];
  const s = (elbowX: number, elbowY: number, wristX: number, wristY: number) => pose(body,
    [[x + elbowX, y + elbowY], [x + wristX, y + wristY], [x - elbowX, y + elbowY + (otherAngle ? 3 : 0)],
      [x - wristX, y + wristY + (otherAngle ? 3 : 0)]], legs, [x + 12, y], [x - 12, y]);
  const weightsAtHips = s(15, 30, 15, 55);
  const elbowsOutWeightsDown = s(40, 1, 37, 27);
  const shouldersRotatedWeightsUp = s(40, 1, 39, -26);
  const overhead = s(31, -29, 33, -55);
  return { ...clip([weightsAtHips, elbowsOutWeightsDown, shouldersRotatedWeightsUp, overhead,
    shouldersRotatedWeightsUp, elbowsOutWeightsDown], [], twoDumbbells, 860), shoulders: [11, 12] };
}

export const reviewedPressAndExtensionIllustrations: Record<string, Illustration> = {
  "0186": lyingRopeExtension(),
  "0287": arnoldPress(true),
  "0299": cubanPress(false),
  "1012": bandTwistPress(),
  "1727": reverseOverheadCable(),
  "1746": onBallTricepsExtension(),
  "2136": cubanPress(true),
  "2137": arnoldPress(false),
};
