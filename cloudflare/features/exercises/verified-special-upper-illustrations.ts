import type { Illustration, Point } from "./motion-data";

type Torso = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const pose = (torso: Torso, arms: Arms, legs: Legs, ...points: Point[]): Point[] =>
  [...torso, ...arms, ...legs, ...points];
const clip = (frames: Point[][], props: Props, dynamic: Gear, ms = 750): Illustration =>
  ({ frames, props, dynamic, ms, reference: true, shoulders: [11, 12] });
const interpolate = ([ax, ay]: Point, [bx, by]: Point, t: number): Point =>
  [ax + t * (bx - ax), ay + t * (by - ay)];

function heldDumbbellHipAbduction(): Illustration {
  const torso: Torso = [[102, 143], [119, 149], [168, 149]];
  const grip: Arms = [[123, 121], [126, 92], [132, 121], [138, 91]];
  const at = (knee: Point, toes: Point): Point[] =>
    pose(torso, grip, [knee, toes, [169, 109], [163, 71]], [120, 147], [128, 143], [132, 90]);
  const close = at([174, 111], [176, 72]);
  const mid = at([193, 118], [210, 85]);
  const open = at([198, 130], [226, 107]);
  return clip([close, mid, open, open, mid], [], [["dumbbell", 13, 0, 0]], 850);
}

const upright: Torso = [[156, 50], [156, 67], [157, 111]];
const feet: Legs = [[170, 132], [173, 156], [145, 132], [140, 155]];
const footGear: Gear = [["foot", 8, 182, 158], ["foot", 10, 133, 157]];

function straightArmDumbbellSweep(): Illustration {
  const at = (arms: Arms) => pose(upright, arms, feet, [168, 69], [144, 68]);
  const wide = at([[194, 68], [222, 68], [118, 68], [92, 68]]);
  const angled = at([[191, 55], [213, 42], [122, 54], [100, 40]]);
  const overhead = at([[173, 44], [167, 18], [139, 44], [144, 18]]);
  return clip([wide, angled, overhead, overhead, angled], [],
    [...footGear, ["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]], 730);
}

function hangingKettlebellPronation(): Illustration {
  const frame = (wrist: Point, rotating: number): Point[] => {
    const [x, y] = wrist;
    const fingers: Point = [x + 5, y - 3 + 3 * rotating];
    const thumb: Point = [x + 1 + 4 * rotating, y - 5 + 9 * rotating];
    return pose(upright, [[160, 100], wrist, [143, 95], [143, 119]], feet,
      [159, 72], [148, 67], [x + 4, y + 2], [x + 4, y + 23], fingers, thumb);
  };
  const low = frame([166, 113], 0), mid = frame([181, 101], 0.5), high = frame([168, 78], 1);
  return clip([low, mid, high, high, mid], [], [
    ...footGear, ["band", 13, 14], ["kettlebell", 14, 0, 7], ["hand", 4, 15, 16],
  ], 820);
}

function legResistanceCurl(): Illustration {
  const torso: Torso = [[143, 61], [147, 77], [155, 115]];
  const bench: Props = [[117, 118, 188, 118], [129, 118, 129, 157], [179, 118, 179, 157]];
  const frame = (amount: number): Point[] => {
    const knee = interpolate([180, 117], [178, 87], amount);
    const ankle = interpolate([186, 153], [184, 122], amount);
    const wrist: Point = [knee[0] - 7, knee[1] + 6];
    return pose(torso, [[143, 106], wrist, [173, 97], [192, 125]],
      [[118, 121], [114, 154], knee, ankle], [141, 80], [157, 75], [wrist[0] + 7, wrist[1] - 2],
      [wrist[0] + 3, wrist[1] - 5], [ankle[0] + 8, ankle[1] + 3]);
  };
  return clip([0, 0.5, 1, 1, 0.82, 0.66, 0.49, 0.32, 0.16].map(frame), bench, [
    ["foot", 8, 106, 157], ["foot-tip", 10, 15], ["hand", 4, 13, 14],
  ], 670);
}

export const verifiedSpecialUpperIllustrations: Record<string, Illustration> = {
  "8084": legResistanceCurl(),
  "10331": hangingKettlebellPronation(),
  "10949": straightArmDumbbellSweep(),
  "11077": heldDumbbellHipAbduction(),
};
