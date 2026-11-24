import { alternating, curl, dumbbells, standing } from "./arm-illustrations";
import type { CurlPhase, CurlPose } from "./arm-illustrations";
import type { Illustration, Point } from "./motion-data";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
const pose = (body: Torso, arms: Arms, legs: Legs, ...extra: Point[]): Point[] => [...body, ...arms, ...legs, ...extra];
const clip = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 1000): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });
const ezBar: Gear = [["ez-bar", 4, 6], ["plate", 4, 9, 0], ["plate", 6, -9, 0]];

function overheadCableCurl(seated: boolean): Illustration {
  const center = 160;
  const shoulderY = seated ? 80 : 61;
  const down: Torso = [[center, shoulderY - 19], [center, shoulderY], [center, seated ? 116 : 106]];
  const legs: Legs = seated ? [[181, 123], [188, 157], [144, 125], [145, 157]] :
    [[175, 133], [178, 157], [145, 133], [142, 157]];
  const bench: Props = seated ? [[137, 124, 188, 124], [142, 124, 142, 156], [184, 124, 184, 156]] : [];
  const pulleyY = seated ? 72 : 52;
  const tower: Props = [[58, 28, 58, 156], [66, 28, 66, 156], [252, 28, 252, 156], [260, 28, 260, 156],
    [55, pulleyY, 69, pulleyY], [250, pulleyY, 263, pulleyY], [53, 156, 72, 156], [247, 156, 268, 156]];
  const elA: Point = [201, shoulderY], elB: Point = [119, shoulderY];
  const sample = (near: Point, far: Point) => pose(down, [elA, near, elB, far], legs,
    [near[0] + 4, near[1] - 4], [far[0] - 4, far[1] - 4],
    [172, shoulderY], [148, shoulderY]);
  return { ...clip([
    sample([227, shoulderY], [93, shoulderY]),
    sample([218, shoulderY - 16], [102, shoulderY - 16]),
    sample([183, shoulderY - 17], [137, shoulderY - 17]),
    sample([218, shoulderY - 16], [102, shoulderY - 16]),
  ], [...tower, ...bench], [["cable", 4, 252, pulleyY], ["cable", 6, 66, pulleyY],
    ["palm-up", 4, 11], ["palm-up", 6, 12], ["pad", 4, 0, 0], ["pad", 6, 0, 0]]),
  shoulders: [13, 14] };
}

function balanceCurl(): Illustration {
  const setup: CurlPose = { trunk: [[127, 55], [127, 73], [128, 114]],
    legs: [[155, 116], [181, 119], [151, 125], [161, 156]], elbows: [[136, 98], [119, 97]] };
  const phases: CurlPhase[] = alternating;
  const motion = curl(setup, { phases, gear: [...dumbbells, ["stability-ball", 2, 0, 27]] });
  return { ...motion, ms: 850 };
}

const incline: CurlPose = {
  trunk: [[169, 63], [153, 77], [117, 108]],
  legs: [[110, 131], [99, 155], [103, 132], [87, 156]],
  elbows: [[155, 106], [143, 107]],
  support: [[104, 121, 160, 78], [111, 116, 111, 156], [144, 96, 144, 156],
    [99, 156, 156, 156]],
};

function spiderCurl(one: boolean): Illustration {
  const phases: CurlPhase[] = [[84, 84], [14, 14], [-62, -62], [-62, -62], [14, 14]];
  const motion = curl(incline, { one, phases, grip: "palm-down", gear: one ? [dumbbells[0]] : dumbbells });
  if (!one) return motion;
  return { ...motion, frames: motion.frames.map((frame): Point[] =>
    frame.map((point, i) => i === 5 ? [137, 94] : i === 6 ? [128, 102] : point)) };
}

function legResistanceCurl(): Illustration {
  const trunk: Torso = [[151, 62], [145, 77], [149, 111]];
  const support: [Point, Point] = [[179, 126], [189, 156]];
  const elbow: Point = [164, 119];
  const at = (knee: Point, ankle: Point): Point[] => {
    const grasp: Point = [ankle[0] - 4, ankle[1] - 3];
    return pose(trunk, [elbow, grasp, [154, 101], [177, 122]], [...support, knee, ankle],
      ankle, [151, 78], [139, 76]);
  };
  const down = at([136, 125], [163, 149]);
  const high = at([135, 109], [172, 98]);
  return { ...clip([down, at([132, 119], [186, 123]), high, high, at([132, 119], [186, 123])],
    [[120, 119, 170, 119], [125, 119, 125, 157], [164, 119, 164, 157]],
  [["digit", 4, 11, 5], ["foot", 8, 197, 156]]), shoulders: [12, 13] };
}

function twentyOneCurls(useEzBar: boolean): Illustration {
  const low: CurlPhase = [84, 84], mid: CurlPhase = [6, 6], high: CurlPhase = [-64, -64];
  const section = (a: CurlPhase, b: CurlPhase) => Array.from({ length: 7 }, () => [a, b]).flat();
  const phases = [...section(low, mid), ...section(mid, high), ...section(low, high)];
  const demo = curl(standing, { phases, grip: "palm-up", gear: useEzBar ? ezBar : dumbbells });
  return { ...demo, ms: 820 };
}

function floorSkullcrusher(): Illustration {
  const body: Torso = [[91, 144], [112, 151], [164, 151]];
  const legs: Legs = [[191, 121], [203, 156], [179, 122], [188, 156]];
  const at = (near: Point, far: Point) => pose(body, [[119, 124], near, [109, 123], far], legs, [117, 150], [107, 149]);
  return { ...clip([
    at([120, 99], [112, 99]),
    at([102, 109], [94, 110]),
    at([94, 126], [84, 125]),
    at([102, 109], [94, 110]),
  ], [], dumbbells), shoulders: [11, 12] };
}

function californiaSkullcrusher(): Illustration {
  const body: Torso = [[103, 111], [119, 118], [168, 120]];
  const legs: Legs = [[195, 124], [203, 155], [184, 127], [189, 156]];
  const b: Props = [[93, 129, 199, 129], [102, 129, 102, 156], [191, 129, 191, 156]];
  const at = (elbow: Point, wrist: Point) => pose(body, [elbow, wrist, [elbow[0] - 13, elbow[1] - 2],
    [wrist[0] - 15, wrist[1] - 1]], legs, [124, 118], [110, 116]);
  const extended = at([128, 91], [133, 64]);
  const forehead = at([128, 91], [100, 93]);
  const behind = at([106, 106], [80, 98]);
  const long = at([103, 111], [71, 106]);
  return { ...clip([extended, forehead, behind, long, behind, forehead], b, ezBar, 890), shoulders: [11, 12] };
}

export const reviewedCurlsAndSkullcrushers: Record<string, Illustration> = {
  "1636": overheadCableCurl(false),
  "1643": overheadCableCurl(true),
  "1649": balanceCurl(),
  "1667": spiderCurl(true),
  "1675": spiderCurl(false),
  "1770": legResistanceCurl(),
  "4130": californiaSkullcrusher(),
  "4151": floorSkullcrusher(),
  "5450": twentyOneCurls(true),
  "5469": twentyOneCurls(false),
};
