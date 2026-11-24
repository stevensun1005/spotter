import type { Illustration, Point } from "./motion-data";

type Torso = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const pose = (torso: Torso, arms: Arms, legs: Legs, ...points: Point[]): Point[] =>
  [...torso, ...arms, ...legs, ...points];
const loop = (frames: Point[][], props: Props, dynamic: Gear, ms = 940): Illustration =>
  ({ frames, props, dynamic, ms, reference: true, shoulders: [11, 12] });
const weights = (neutral: boolean, single: boolean = false): Gear => {
  const gear = neutral ? "hammer-weight" : "dumbbell";
  return single ? [[gear, 4, 0, 0]] : [[gear, 4, 0, 0], [gear, 6, 0, 0]];
};
const ball: Gear = [["stability-ball", 13, 0, 0], ["foot", 8, 212, 158], ["foot", 10, 195, 155]];
const ballTorso: Torso = [[97, 91], [110, 106], [161, 134]];
const ballLegs: Legs = [[195, 130], [204, 155], [181, 128], [189, 153]];
const ballPose = (arms: Arms): Point[] => pose(ballTorso, arms, ballLegs, [108, 111], [116, 101], [128, 142]);

function inclineBallPress(neutral: boolean, single: boolean): Illustration {
  const otherDown: [Point, Point] = single ? [[132, 120], [143, 128]] : [[126, 117], [122, 89]];
  const down = ballPose([[122, 128], [115, 100], ...otherDown]);
  const up = ballPose([[111, 84], [109, 55], ...(single ? otherDown : [[124, 79], [126, 51]] as [Point, Point])]);
  return loop([down, up], [], [...ball, ...weights(neutral, single)]);
}

function inclineBallFly(): Illustration {
  const high = ballPose([[113, 84], [108, 54], [134, 121], [145, 127]]);
  const mid = ballPose([[133, 99], [151, 78], [134, 121], [145, 127]]);
  const wide = ballPose([[136, 113], [161, 109], [134, 121], [145, 127]]);
  return loop([high, mid, wide, mid], [], [...ball, ...weights(false, true)], 800);
}

const upright: Torso = [[152, 51], [153, 68], [153, 112]];
const standing: Legs = [[169, 133], [175, 155], [143, 133], [138, 154]];
const seated: Legs = [[181, 119], [186, 155], [170, 118], [173, 152]];
const standFeet: Gear = [["foot", 8, 183, 157], ["foot", 10, 130, 156]];
const seatFeet: Gear = [["foot", 8, 194, 157], ["foot", 10, 180, 154]];
const uprightBench: Props = [[142, 63, 142, 120], [146, 64, 146, 119], [132, 119, 190, 119],
  [140, 119, 140, 156], [183, 119, 183, 156]];

function shoulderPress(neutral: boolean, alternates: boolean, seatedSupport: boolean): Illustration {
  const at = (arms: Arms): Point[] =>
    pose(upright, arms, seatedSupport ? seated : standing, [161, 70], [144, 69]);
  const nearRest: [Point, Point] = neutral ? [[175, 86], [172, 62]] : [[184, 75], [183, 53]];
  const farRest: [Point, Point] = neutral ? [[142, 84], [146, 60]] : [[120, 74], [120, 51]];
  const nearHigh: [Point, Point] = [[169, 43], [169, 17]];
  const farHigh: [Point, Point] = [[145, 42], [145, 16]];
  const base = at([...nearRest, ...farRest]);
  const phases = alternates ? [base, at([...nearHigh, ...farRest]), base, at([...nearRest, ...farHigh])] :
    [base, at([...nearHigh, ...farHigh])];
  return loop(phases, seatedSupport ? uprightBench : [], [...weights(neutral), ...(seatedSupport ? seatFeet : standFeet)]);
}

function scottPress(): Illustration {
  const at = (arms: Arms): Point[] => pose(upright, arms, standing, [161, 69], [145, 68]);
  const low = at([[179, 84], [187, 61], [133, 83], [127, 58]]);
  const high = at([[174, 59], [168, 34], [137, 57], [143, 32]]);
  return loop([low, high, high, low], [], [...weights(false), ...standFeet], 830);
}

function gittlesonShrug(): Illustration {
  const bench: Props = [[113, 119, 182, 119], [120, 119, 120, 157], [174, 119, 174, 157]];
  const at = (lift: number): Point[] =>
    pose([[153 - lift / 2, 51 + lift / 3], [153, 68], [153, 112]],
      [[165, 94 - lift], [169, 119 - lift], [136, 92], [131, 118]], seated,
      [162, 69 - lift], [144, 68]);
  return loop([at(0), at(11), at(11), at(0)], bench, [...weights(false, true), ...seatFeet], 720);
}

function flatElbowPress(): Illustration {
  const torso: Torso = [[89, 108], [109, 110], [164, 111]];
  const legs: Legs = [[196, 115], [200, 155], [182, 112], [186, 152]];
  const pad: Props = [[75, 119, 199, 119], [83, 119, 83, 154], [187, 119, 187, 154]];
  const at = (arms: Arms): Point[] => pose(torso, arms, legs, [114, 110], [120, 101]);
  const down = at([[131, 105], [143, 88], [137, 98], [146, 80]]);
  const halfway = at([[123, 97], [131, 73], [129, 91], [138, 66]]);
  const up = at([[117, 86], [123, 58], [125, 77], [132, 49]]);
  return loop([down, halfway, up, halfway], pad,
    [...weights(true), ["foot", 8, 210, 157], ["foot", 10, 195, 155]]);
}

function inclineHyghtFly(): Illustration {
  const bench: Props = [[87, 69, 154, 120], [154, 120, 185, 120], [124, 103, 124, 154], [177, 119, 177, 155]];
  const torso: Torso = [[91, 54], [108, 68], [153, 107]];
  const legs: Legs = [[186, 123], [195, 155], [178, 120], [178, 153]];
  const at = (arms: Arms) => pose(torso, arms, legs, [106, 75], [112, 62]);
  const start = at([[130, 103], [153, 117], [136, 81], [161, 93]]);
  const wide = at([[124, 106], [142, 117], [128, 40], [149, 36]]);
  const up = at([[116, 53], [125, 30], [123, 43], [133, 21]]);
  return loop([start, wide, up, wide], bench,
    [...weights(false), ["foot", 8, 204, 157], ["foot", 10, 187, 155]], 875);
}

export const reviewedDumbbellVariantIllustrations: Record<string, Illustration> = {
  "0286": shoulderPress(true, true, false),
  "0338": flatElbowPress(),
  "0388": shoulderPress(true, true, true),
  "0427": shoulderPress(true, false, false),
  "1280": inclineBallFly(),
  "1282": inclineBallPress(false, true),
  "1283": inclineBallPress(false, false),
  "1618": inclineBallPress(true, false),
  "1620": inclineBallPress(true, true),
  "2397": scottPress(),
  "3234": inclineHyghtFly(),
  "3546": shoulderPress(false, true, true),
  "4053": gittlesonShrug(),
};
