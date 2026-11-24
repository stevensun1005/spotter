import type { Illustration, Point } from "./motion-data";

type Torso = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const pose = (torso: Torso, arms: Arms, legs: Legs, ...points: Point[]): Point[] =>
  [...torso, ...arms, ...legs, ...points];
const loop = (frames: Point[][], props: Props, dynamic: Gear, ms = 850): Illustration =>
  ({ frames, props, dynamic, ms, reference: true, shoulders: [11, 12] });
const pair: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const neutralPair: Gear = [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]];

const incline: Props = [[89, 65, 151, 108], [151, 108, 184, 111], [105, 77, 105, 156], [174, 110, 174, 156]];
const inclineTorso: Torso = [[99, 52], [115, 66], [160, 100]];
const inclineLegs: Legs = [[193, 111], [200, 153], [179, 110], [181, 152]];
const inclineShoulders: [Point, Point] = [[112, 73], [118, 59]];
const inclinePose = (arms: Arms) => pose(inclineTorso, arms, inclineLegs, ...inclineShoulders);

function inclineFrontRaise(): Illustration {
  const down = inclinePose([[139, 92], [164, 114], [140, 82], [166, 102]]);
  const mid = inclinePose([[143, 81], [173, 89], [148, 66], [174, 74]]);
  const top = inclinePose([[142, 69], [173, 65], [146, 57], [176, 52]]);
  return loop([down, mid, top, mid], incline, pair, 760);
}

function inclineSerratus(): Illustration {
  const straight: Arms = [[120, 47], [128, 20], [124, 42], [131, 15]];
  const at = (delta: number) => {
    const [near, far] = inclineShoulders;
    const arms = straight.map(([x, y]): Point => [x + delta / 3, y - delta]) as Arms;
    return pose(inclineTorso, arms, inclineLegs, [near[0] + delta / 3, near[1] - delta],
      [far[0] + delta / 3, far[1] - delta]);
  };
  return loop([at(0), at(8), at(8), at(0)], incline, pair, 720);
}

const bench: Props = [[76, 120, 198, 120], [94, 120, 94, 156], [180, 120, 180, 156]];
const flatTorso: Torso = [[90, 107], [107, 110], [166, 113]];
const flatLegs: Legs = [[194, 115], [204, 154], [182, 114], [190, 153]];
const benchPose = (arms: Arms, ...points: Point[]): Point[] =>
  pose(flatTorso, arms, flatLegs, [113, 114], [119, 104], ...points);
const feet: Gear = [["foot", 8, 215, 156], ["foot", 10, 199, 155]];

function closeGripPress(topFirst: boolean): Illustration {
  const down = benchPose([[137, 126], [126, 101], [147, 116], [137, 94]]);
  const mid = benchPose([[126, 105], [124, 81], [136, 98], [136, 75]]);
  const top = benchPose([[121, 86], [124, 59], [132, 79], [136, 53]]);
  return loop(topFirst ? [top, mid, down, mid] : [down, mid, top, mid], bench, [...neutralPair, ...feet]);
}

function oneArmReverseGripPress(): Illustration {
  const at = (elbow: Point, wrist: Point): Point[] =>
    benchPose([elbow, wrist, [145, 113], [166, 119]], [wrist[0] - 6, wrist[1] + 1]);
  return loop([
    at([131, 126], [119, 104]), at([120, 104], [118, 78]), at([116, 87], [116, 60]), at([120, 104], [118, 78]),
  ], bench, [["palm-up", 4, 13], ["dumbbell", 4, 0, -2], ...feet]);
}

function tatePress(): Illustration {
  const start = benchPose([[112, 86], [111, 59], [122, 77], [122, 50]]);
  const elbowsOut = benchPose([[141, 107], [124, 88], [112, 92], [129, 77]]);
  const weightsTogether = benchPose([[143, 111], [128, 99], [108, 89], [129, 91]]);
  return loop([start, elbowsOut, weightsTogether, elbowsOut], bench, [...pair, ...feet], 920);
}

function elbowExtensionOnBall(): Illustration {
  const body: Torso = [[101, 103], [121, 106], [179, 115]];
  const legs: Legs = [[203, 118], [210, 154], [193, 114], [194, 152]];
  const elbow: Point = [126, 78], farElbow: Point = [162, 114], farWrist: Point = [183, 119];
  const at = (wrist: Point) => pose(body, [elbow, wrist, farElbow, farWrist], legs, [126, 108], [128, 101], [127, 134]);
  const start = at([103, 85]), middle = at([105, 63]), top = at([126, 51]);
  return loop([start, middle, top, middle], [],
    [["stability-ball", 13, 0, 0], ["dumbbell", 4, 0, 0], ...feet], 820);
}

function oneArmBallPress(neutral: boolean): Illustration {
  const torso: Torso = [[102, 96], [118, 108], [175, 117]];
  const legs: Legs = [[199, 117], [211, 154], [191, 111], [190, 151]];
  const at = (elbow: Point, wrist: Point) =>
    pose(torso, [elbow, wrist, [148, 112], [170, 118]], legs, [117, 112], [125, 104], [123, 135]);
  const down = at([141, 125], [131, 99]), mid = at([135, 107], [131, 82]), top = at([127, 85], [128, 57]);
  return loop([down, mid, top, mid], [], [
    ["stability-ball", 13, 0, 0], [neutral ? "hammer-weight" : "dumbbell", 4, 0, 0], ...feet,
  ]);
}

function benchRearDeltRow(): Illustration {
  const body: Torso = [[187, 73], [169, 86], [118, 100]];
  const legs: Legs = [[108, 128], [80, 125], [134, 126], [141, 155]];
  const benchPad: Props = [[66, 131, 194, 131], [75, 131, 75, 156], [185, 131, 185, 156]];
  const at = (elbow: Point, wrist: Point) =>
    pose(body, [elbow, wrist, [177, 108], [182, 128]], legs, [166, 92], [171, 83]);
  const reach = at([157, 117], [153, 144]);
  const mid = at([146, 112], [158, 127]);
  const pull = at([135, 98], [159, 112]);
  return loop([reach, mid, pull, mid], benchPad, [["dumbbell", 4, 0, 0], ["foot", 10, 150, 157]]);
}

const upright: Torso = [[155, 51], [156, 69], [156, 113]];
const standing: Legs = [[169, 135], [171, 155], [144, 133], [139, 153]];
const standingPose = (arms: Arms): Point[] => pose(upright, arms, standing, [169, 72], [144, 70]);
const standingFeet: Gear = [["foot", 8, 180, 157], ["foot", 10, 132, 155]];

function benchSupportedOneArmPress(): Illustration {
  const benchBack: Props = [[203, 98, 203, 137], [208, 98, 208, 138], [203, 137, 235, 139],
    [210, 139, 210, 155], [232, 139, 232, 155]];
  const at = (elbow: Point, wrist: Point) =>
    standingPose([elbow, wrist, [172, 84], [204, 101]]);
  return loop([at([171, 79], [175, 56]), at([172, 54], [174, 34]), at([172, 46], [174, 18])],
    benchBack, [["hammer-weight", 4, 0, 0], ...standingFeet], 910);
}

function wPress(): Illustration {
  const start = standingPose([[184, 91], [195, 69], [129, 91], [117, 68]]);
  const middle = standingPose([[184, 69], [193, 46], [128, 69], [119, 46]]);
  const top = standingPose([[184, 50], [173, 27], [128, 49], [140, 27]]);
  return loop([start, middle, top, middle], [], [...pair, ...standingFeet], 810);
}

export const reviewedDumbbellPressIllustrations: Record<string, Illustration> = {
  "0296": closeGripPress(true),
  "0325": inclineFrontRaise(),
  "0328": inclineSerratus(),
  "0377": benchRearDeltRow(),
  "0424": benchSupportedOneArmPress(),
  "0436": tatePress(),
  "0438": wPress(),
  "1290": oneArmBallPress(false),
  "1621": oneArmBallPress(true),
  "1622": oneArmReverseGripPress(),
  "1731": closeGripPress(false),
  "1736": elbowExtensionOnBall(),
};
