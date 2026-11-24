import type { Illustration, Point } from "./motion-data";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const pose = (body: Torso, arms: Arms, legs: Legs, ...fixtures: Point[]): Point[] => [...body, ...arms, ...legs, ...fixtures];
const clip = (frames: Point[][], props: Props, dynamic: Gear, shoulders?: Illustration["shoulders"]): Illustration =>
  ({ frames, props, dynamic, shoulders, ms: 850, reference: true });

const bench: Props = [[86, 128, 192, 128], [98, 128, 98, 157], [178, 128, 178, 157]];
const barbell: Gear = [["bar", 4, 6], ["barbell-end", 4, 11, 0], ["barbell-end", 6, -11, 0]];

function pulloverToPress(): Illustration {
  const body: Torso = [[95, 111], [114, 118], [161, 120]];
  const legs: Legs = [[188, 121], [199, 156], [176, 123], [187, 156]];
  const arms = (elbow: Point, hand: Point): Point[] => {
    const [ex, ey] = elbow, [wx, wy] = hand;
    return pose(body, [elbow, hand, [ex - 17, ey + 2], [wx - 20, wy - 1]], legs,
      [118, 118], [104, 116]);
  };
  return clip([
    arms([128, 94], [136, 68]),
    arms([114, 89], [100, 68]),
    arms([93, 102], [73, 114]),
    arms([111, 92], [102, 76]),
    arms([140, 132], [142, 106]),
  ], bench, barbell, [11, 12]);
}

function standingDeclineFly(): Illustration {
  const body: Torso = [[160, 41], [160, 60], [157, 106]];
  const legs: Legs = [[172, 129], [181, 156], [143, 128], [138, 156]];
  const props: Props = [[68, 25, 68, 156], [78, 25, 78, 156], [242, 25, 242, 156], [252, 25, 252, 156],
    [68, 25, 85, 25], [235, 25, 252, 25], [64, 156, 84, 156], [236, 156, 256, 156]];
  const form = (arms: Arms) => pose(body, arms, legs, [170, 63], [149, 63]);
  return clip([
    form([[196, 65], [219, 73], [124, 65], [101, 73]]),
    form([[193, 78], [195, 97], [127, 78], [126, 96]]),
    form([[179, 83], [164, 107], [141, 83], [155, 107]]),
  ], props, [["cable", 4, 242, 35], ["cable", 6, 78, 35], ["pad", 4, 0, 0], ["pad", 6, 0, 0]], [11, 12]);
}

function camberedBenchRow(): Illustration {
  const body: Torso = [[192, 66], [175, 77], [123, 77]];
  const legs: Legs = [[102, 115], [80, 155], [91, 113], [65, 155]];
  const form = (elbowA: Point, handA: Point, elbowB: Point, handB: Point) => {
    const [a, y] = handA, [b, z] = handB;
    return pose(body, [elbowA, handA, elbowB, handB], legs,
      [180, 79], [165, 76], [a - 5, y + 11], [b + 5, z + 11],
      [a + 14, y], [b - 14, z]);
  };
  const props: Props = [[112, 87, 173, 87], [118, 87, 118, 156], [162, 87, 162, 135], [162, 135, 151, 146]];
  const camberedBar: Gear = [["bar", 15, 4], ["bar", 4, 13], ["bar", 13, 14], ["bar", 14, 6],
    ["bar", 6, 16], ["barbell-end", 15, 0, 0], ["barbell-end", 16, 0, 0]];
  return clip([form([181, 105], [183, 132], [162, 104], [158, 129]),
    form([154, 66], [183, 90], [142, 69], [158, 87])], props, camberedBar, [11, 12]);
}

const floorLegs: Legs = [[153, 149], [184, 151], [145, 151], [172, 154]];
const cableTower = (x: number, pulley: number): Props => [[x, 43, x, 156], [x + 9, 43, x + 9, 156],
  [x, 43, x + 9, 43], [x - 7, 156, x + 15, 156], [x - 4, pulley, x + 4, pulley],
  [x + 1, 113, x + 8, 113], [x + 1, 121, x + 8, 121], [x + 1, 129, x + 8, 129]];

function shoulderRotationOnFloor(): Illustration {
  const body: Torso = [[118, 73], [121, 91], [121, 152]];
  const elbow: Point = [142, 116];
  const at = (hand: Point) => pose(body, [elbow, hand, [105, 125], [91, 154]], floorLegs,
    [131, 93], [112, 94]);
  return clip([at([166, 115]), at([153, 109]), at([121, 112])], cableTower(220, 115),
    [["cable", 4, 220, 115], ["pad", 4, 0, 0]], [11, 12]);
}

function floorBandRow(): Illustration {
  const body: Torso = [[114, 73], [117, 91], [124, 152]];
  const legs: Legs = [[160, 149], [194, 151], [151, 151], [183, 154]];
  const form = (arms: Arms) => pose(body, arms, legs, [124, 91], [110, 93], [198, 144], [187, 147]);
  return clip([
    form([[148, 104], [175, 117], [139, 107], [162, 121]]),
    form([[105, 116], [134, 107], [91, 118], [120, 105]]),
  ], [], [["band", 4, 13], ["band", 6, 14], ["pad", 4, 0, 0], ["pad", 6, 0, 0],
    ["foot-tip", 8, 13], ["foot-tip", 10, 14]], [11, 12]);
}

function wallBarRow(close: boolean): Illustration {
  const feet: [Point, Point] = [[193, 156], [185, 156]];
  const startLegs: Legs = [[174, 136], feet[0], [168, 137], feet[1]];
  const finishLegs: Legs = [[195, 136], feet[0], [185, 137], feet[1]];
  const ladder: Props = [[204, 37, 204, 156], [221, 33, 221, 156],
    [204, 39, 221, 35], [204, 58, 221, 54], [204, 77, 221, 73],
    [204, 96, 221, 92], [204, 115, 221, 111], [204, 134, 221, 130]];
  const handle: Point = close ? [209, 76] : [218, 74];
  return clip([
    pose([[136, 66], [147, 81], [160, 116]], [[178, 80], handle, [139, 101], [147, 121]], startLegs),
    pose([[188, 64], [194, 79], [191, 115]], [close ? [185, 103] : [183, 97], handle, [179, 101], [172, 119]], finishLegs),
  ], ladder, [["pad", 4, 0, 0]]);
}

function smithRearDeltRow(): Illustration {
  const body: Torso = [[178, 59], [163, 71], [120, 100]];
  const legs: Legs = [[138, 125], [146, 156], [119, 126], [118, 156]];
  const tracks: Props = [[127, 30, 127, 156], [205, 24, 205, 156], [127, 30, 205, 24],
    [116, 156, 139, 156], [195, 156, 218, 156], [126, 58, 130, 58], [203, 54, 207, 54],
    [126, 82, 130, 82], [203, 78, 207, 78], [126, 106, 130, 106], [203, 102, 207, 102],
    [126, 130, 130, 130], [203, 126, 207, 126]];
  const form = (near: Point, far: Point, y: number) => pose(body, [near, [186, y], far, [150, y + 3]], legs,
    [171, 73], [154, 70], [205, y - 2], [127, y + 5]);
  return clip([form([180, 100], [149, 101], 127), form([157, 56], [123, 71], 83)], tracks,
    [["bar", 13, 14], ["barbell-end", 13, 4, 0], ["barbell-end", 14, -4, 0]], [11, 12]);
}

function alternatingKettlebellRow(plank: boolean): Illustration {
  const body: Torso = plank ? [[187, 97], [170, 106], [128, 119]] : [[177, 65], [162, 77], [119, 107]];
  const legs: Legs = plank ? [[106, 136], [83, 151], [100, 138], [75, 153]] :
    [[135, 129], [138, 156], [116, 129], [110, 156]];
  const at = (arms: Arms) => {
    const [x, y] = body[1];
    return pose(body, arms, legs, [x + 7, y], [x - 8, y + 1]);
  };
  const down: Arms = plank ? [[174, 127], [178, 144], [155, 123], [150, 142]] :
    [[169, 104], [172, 131], [154, 104], [153, 129]];
  const row: Arms = plank ? [[137, 96], [148, 119], [124, 91], [137, 111]] :
    [[141, 72], [150, 94], [124, 72], [136, 89]];
  return clip([at(down), at([row[0], row[1], down[2], down[3]]), at(down),
    at([down[0], down[1], row[2], row[3]])], [], [["kettlebell", 4, 0, 10], ["kettlebell", 6, 0, 10]], [11, 12]);
}

function alternatingCableRow(): Illustration {
  const body: Torso = [[115, 53], [117, 70], [121, 110]];
  const legs: Legs = [[151, 123], [163, 155], [141, 125], [150, 156]];
  const props: Props = [[102, 119, 161, 119], [106, 119, 106, 155], [143, 119, 143, 155], ...cableTower(229, 94)];
  const reach: Point = [176, 96], otherReach: Point = [175, 95];
  const near = (elbow: Point, hand: Point) => pose(body, [elbow, hand, [112, 96], [142, 120]], legs, hand, [123, 70], [110, 71]);
  const far = (elbow: Point, hand: Point) => pose(body, [[129, 98], [152, 119], elbow, hand], legs, hand, [123, 70], [110, 71]);
  const handoff = pose(body, [[145, 85], reach, [140, 84], otherReach], legs, reach, [123, 70], [110, 71]);
  const nearOut = near([151, 84], reach), farOut = far([142, 83], otherReach);
  return clip([nearOut, near([106, 91], [131, 91]), nearOut, handoff,
    farOut, far([93, 92], [119, 91]), farOut, handoff], props,
  [["cable", 11, 229, 94], ["pad", 11, 0, 0]], [12, 13]);
}

export const reviewedUpperLegacyIllustrations: Record<string, Illustration> = {
  "0022": pulloverToPress(),
  "0158": standingDeclineFly(),
  "0214": alternatingCableRow(),
  "0216": shoulderRotationOnFloor(),
  "0248": camberedBenchRow(),
  "0521": alternatingKettlebellRow(true),
  "0522": alternatingKettlebellRow(false),
  "0762": smithRearDeltRow(),
  "3144": floorBandRow(),
  "3156": wallBarRow(true),
  "3162": wallBarRow(false),
};
