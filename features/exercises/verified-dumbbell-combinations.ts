import type { Illustration, Point } from "./motion-data";

type Torso = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const body = (torso: Torso, arms: Arms, legs: Legs, ...points: Point[]): Point[] => [...torso, ...arms, ...legs, ...points];
const motion = (frames: Point[][], props: Props, dynamic: Gear, ms = 970): Illustration =>
  ({ frames, props, dynamic, ms, shoulders: [11, 12], reference: true });
const weights: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];

function bosuBalancedCurl(): Illustration {
  const dome: Props = [[122, 154, 127, 147], [127, 147, 139, 139], [139, 139, 150, 137], [150, 137, 161, 137],
    [161, 137, 175, 143], [175, 143, 184, 154], [121, 155, 186, 155]];
  const torso: Torso = [[131, 62], [139, 78], [155, 131]];
  const legs: Legs = [[180, 108], [198, 131], [173, 112], [185, 133]];
  const at = (near: Point, far: Point) => body(torso, [[157, 110], near, [136, 109], far], legs,
    [146, 83], [136, 78], [203, 125], [190, 127]);
  const low = at([160, 139], [140, 138]);
  const raised = at([167, 81], [146, 80]);
  return motion([low, raised], dome, [...weights, ["foot-tip", 8, 13], ["foot-tip", 10, 14]], 1430);
}

function inclineFly(): Illustration {
  const torso: Torso = [[92, 50], [108, 67], [156, 104]];
  const legs: Legs = [[194, 117], [200, 154], [181, 114], [182, 152]];
  const bench: Props = [[81, 65, 153, 117], [153, 117, 182, 117], [90, 71, 90, 154], [172, 116, 172, 156]];
  const at = (arms: Arms) => body(torso, arms, legs, [104, 76], [113, 62]);
  const wide = at([[128, 96], [153, 110], [100, 47], [82, 29]]);
  const middle = at([[123, 80], [140, 68], [106, 40], [103, 18]]);
  const together = at([[115, 55], [124, 31], [124, 40], [133, 16]]);
  return motion([wide, middle, together, middle], bench,
    [...weights, ["foot", 8, 209, 156], ["foot", 10, 191, 155]], 880);
}

const upright: Torso = [[158, 46], [158, 64], [158, 109]];
const uprightLegs: Legs = [[172, 131], [177, 155], [143, 131], [138, 155]];
const uprightFeet: Gear = [["foot", 8, 185, 157], ["foot", 10, 129, 157]];

function ironCrossSquat(): Illustration {
  const down = body([[152, 76], [154, 92], [157, 134]], [[181, 99], [203, 99], [169, 89], [192, 88]],
    [[182, 128], uprightLegs[1], [130, 128], uprightLegs[3]], [163, 98], [144, 89]);
  const mid = body([[155, 60], [156, 77], [157, 121]], [[185, 86], [206, 87], [143, 77], [139, 72]],
    [[179, 126], uprightLegs[1], [135, 126], uprightLegs[3]], [167, 83], [144, 74]);
  const cross = body(upright, [[198, 68], [223, 67], [118, 65], [93, 64]], uprightLegs, [171, 69], [145, 65]);
  return motion([down, mid, cross, mid], [], [...weights, ...uprightFeet], 860);
}

function supportedKickback(ball: boolean): Illustration {
  const torso: Torso = ball ? [[184, 103], [168, 115], [113, 111]] : [[185, 72], [167, 86], [120, 97]];
  const legs: Legs = ball ? [[123, 148], [92, 154], [112, 147], [85, 153]] :
    [[106, 127], [78, 128], [132, 123], [140, 154]];
  const bench: Props = ball ? [] : [[72, 132, 198, 132], [82, 132, 82, 156], [186, 132, 186, 156]];
  const nearElbow: Point = ball ? [139, 120] : [139, 94];
  const farElbow: Point = ball ? [143, 110] : [176, 107];
  const at = (wrist: Point, otherWrist: Point) => body(torso, [nearElbow, wrist, farElbow, otherWrist],
    legs, [166, torso[1][1] + 6], [173, torso[1][1] - 4], [149, 141]);
  const start = at([143, nearElbow[1] + 26], ball ? [150, 136] : [181, 130]);
  const extended = at([112, nearElbow[1] + 2], ball ? [117, 110] : [181, 130]);
  const attachments: Gear = ball ? [["stability-ball", 13, 0, 0], ...weights] :
    [["dumbbell", 4, 0, 0], ["foot", 10, 149, 158]];
  return motion([start, extended, extended, start], bench, attachments, 765);
}

function freeHandHeadSideBend(): Illustration {
  const at = (torso: Torso, arms: Arms, shoulders: [Point, Point]) => body(torso, arms, uprightLegs, ...shoulders);
  const straight = at(upright, [[178, 94], [177, 120], [128, 53], [150, 43]], [[170, 69], [146, 67]]);
  const bent = at([[182, 57], [176, 73], [158, 110]],
    [[191, 101], [191, 128], [155, 55], [173, 50]], [[186, 78], [164, 71]]);
  return motion([straight, bent, bent, straight], [], [...uprightFeet, ["dumbbell", 4, 0, 0]], 870);
}

function standingConcentrationCurl(): Illustration {
  const torso: Torso = [[204, 84], [189, 100], [133, 103]];
  const legs: Legs = [[151, 123], [150, 154], [120, 128], [112, 154]];
  const at = (wrist: Point) => body(torso, [[180, 124], wrist, [158, 109], [150, 124]], legs,
    [186, 105], [191, 95], [wrist[0] - 5, wrist[1] - 1]);
  const bottom = at([176, 149]), middle = at([158, 125]), top = at([170, 101]);
  return motion([bottom, middle, top, middle], [], [["dumbbell", 4, 0, 0], ["palm-up", 4, 13],
    ["foot", 8, 159, 156], ["foot", 10, 122, 157]], 930);
}

function waiterCurl(): Illustration {
  const at = (elbow: number, x: number, y: number): Point[] =>
    body(upright, [[177, elbow], [x + 9, y - 1], [143, elbow], [x - 9, y - 1]],
      uprightLegs, [169, 68], [145, 65], [x - 10, y], [x + 10, y], [x - 10, y + 15], [x + 10, y + 15],
      [x, y], [x, y + 15]);
  return motion([at(92, 160, 122), at(92, 165, 103), at(92, 161, 64), at(92, 165, 103)], [],
    [...uprightFeet, ["bar", 17, 18], ["bar", 13, 14], ["bar", 15, 16]], 890);
}

export const verifiedDumbbellCombinations: Record<string, Illustration> = {
  "0316": inclineFly(),
  "0332": ironCrossSquat(),
  "0333": supportedKickback(false),
  "0407": freeHandHeadSideBend(),
  "0421": standingConcentrationCurl(),
  "1656": bosuBalancedCurl(),
  "1734": supportedKickback(true),
  "5201": waiterCurl(),
};
