import type { Illustration, Point } from "./motion-data";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Grip = "palm-up" | "thumb-up" | "palm-down";

const pose = (body: Torso, arms: Arms, legs: Legs, ...extra: Point[]): Point[] => [...body, ...arms, ...legs, ...extra];
const clip = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 920): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });

function towelCurl(grip: Grip, singleLeg = false): Illustration {
  const trunk: Torso = [[82, 142], [100, 151], [143, 152]];
  const elbow: Point = [126, 145], farElbow: Point = [116, 148];
  const at = (wrist: Point, knee: Point, foot: Point) => {
    const other: Point = [wrist[0] - 9, wrist[1] + 4];
    const farFoot: Point = singleLeg ? [210, 154] : [foot[0] - 10, foot[1] + 7];
    const toeA: Point = [foot[0] + 3, foot[1] - 10];
    const toeB: Point = singleLeg ? toeA : [farFoot[0] + 3, farFoot[1] - 10];
    const fingers = (e: Point, w: Point, far: boolean): [Point, Point] => {
      const dx = w[0] - e[0], dy = w[1] - e[1], length = Math.hypot(dx, dy);
      const across = grip === "thumb-up" ? -7 : grip === "palm-up" ? 5 : -4;
      const polarity = far ? -1 : 1;
      const tip: Point = [w[0] + dx * 7 / length, w[1] + dy * 7 / length];
      const thumb: Point = [w[0] + (dx * 3 - dy * across * polarity) / length,
        w[1] + (dy * 3 + dx * across * polarity) / length];
      return [tip, thumb];
    };
    return pose(trunk, [elbow, wrist, farElbow, other],
      [knee, foot, singleLeg ? [183, 143] : [knee[0] - 10, knee[1] + 7], farFoot],
      toeA, toeB, ...fingers(elbow, wrist, false), ...fingers(farElbow, other, true));
  };
  const low = at([153, 139], [178, 117], [213, 118]);
  const middle = at([144, 124], [168, 107], [207, 114]);
  const high = at([125, 113], [157, 103], [188, 110]);
  return clip([low, middle, high, middle], [], [["hand", 4, 13, 14], ["hand", 6, 15, 16],
    ["line", 13, 11], ["line", 15, 12], ["foot-tip", 8, 11],
    ...(singleLeg ? [] : [["foot-tip", 10, 12], ["bar", 11, 12]] as Gear)]);
}

function shoulderTap(decline: boolean): Illustration {
  const upper: Torso = decline ? [[193, 86], [175, 101], [126, 102]] : [[198, 46], [181, 62], [142, 102]];
  const feet: Legs = decline ? [[103, 91], [71, 92], [98, 95], [67, 97]] :
    [[118, 129], [91, 151], [103, 126], [69, 151]];
  const hands: Arms = decline ? [[183, 125], [189, 152], [164, 124], [155, 151]] :
    [[186, 83], [190, 111], [169, 84], [166, 111]];
  const nearShoulder: Point = [upper[1][0] + 7, upper[1][1] + 1];
  const farShoulder: Point = [upper[1][0] - 8, upper[1][1] - 3];
  const at = (arms: Arms) => pose(upper, arms, feet, nearShoulder, farShoulder);
  const steady = at(hands);
  const tapNear = at([[nearShoulder[0] + 12, nearShoulder[1] + 21], farShoulder, hands[2], hands[3]]);
  const tapFar = at([hands[0], hands[1], [farShoulder[0] - 12, farShoulder[1] + 21], nearShoulder]);
  const bench: Props = decline ? [[51, 102, 95, 102], [55, 102, 55, 156], [89, 102, 89, 156]] :
    [[153, 114, 215, 114], [158, 114, 158, 156], [210, 114, 210, 156]];
  return { ...clip([steady, tapNear, steady, tapFar], bench,
    decline ? [["foot", 8, 64, 101], ["foot", 10, 60, 101]] : []), shoulders: [11, 12] };
}

const upright: Torso = [[158, 44], [158, 62], [158, 108]];
const standing: Legs = [[171, 132], [178, 155], [147, 133], [141, 155]];

function behindBackStretch(): Illustration {
  const arms = (pull: number): Point[] =>
    pose(upright, [[174, 96], [154 + pull, 107], [140, 95], [153 + pull, 107]],
      standing, [169, 63], [148, 64]);
  const neutral = arms(0), end = arms(-12);
  return { ...clip([neutral, end, end, end, end, end, end, end, end, end, end, neutral],
    [], [], 2250), shoulders: [11, 12] };
}

function armCrossover(): Illustration {
  const at = (a: Arms) => pose(upright, a, standing, [169, 62], [146, 62]);
  const open = at([[191, 62], [216, 62], [122, 62], [95, 62]]);
  const near = at([[163, 74], [135, 66], [151, 81], [171, 80]]);
  const far = at([[168, 81], [144, 79], [148, 70], [180, 65]]);
  return { ...clip([open, near, open, far], [], [], 740), shoulders: [11, 12] };
}

function bentArmDumbbellHold(): Illustration {
  const body: Torso = [[130, 44], [133, 64], [131, 108]];
  const legs: Legs = [[140, 131], [145, 156], [127, 131], [123, 155]];
  const elbow = (arm: Arms) => pose(body, arm, legs);
  const down = elbow([[143, 92], [142, 120], [126, 90], [125, 118]]);
  const rightAngle = elbow([[143, 92], [171, 92], [126, 90], [154, 90]]);
  return clip([...Array<Point[]>(11).fill(rightAngle), down, down], [],
    [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]], 2200);
}

function proneSlide(): Illustration {
  const body: Torso = [[159, 32], [160, 48], [160, 91]];
  const legs: Legs = [[167, 117], [169, 142], [152, 117], [150, 140]];
  const at = (a: Arms) => pose(body, a, legs, [168, 48], [150, 48]);
  const start = at([[184, 33], [202, 13], [133, 33], [113, 15]]);
  const slideRight = at([[193, 49], [219, 49], [133, 33], [113, 15]]);
  const slideLeft = at([[184, 33], [202, 13], [125, 48], [98, 48]]);
  const mat: Props = [[118, 25, 200, 25], [200, 25, 200, 152], [200, 152, 118, 152], [118, 152, 118, 25]];
  return { ...clip([start, slideRight, slideRight, start, slideLeft, slideLeft], mat), topView: true,
    shoulders: [11, 12] };
}

function singleArmCircles(): Illustration {
  const circle = (near: boolean, radius: number, direction: number) => {
    const shoulder: Point = near ? [168, 63] : [146, 63];
    const side = near ? 1 : -1;
    return Array.from({ length: 8 }, (_, step) => {
      const angle = step * Math.PI / 4 * direction;
      const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
      const active: [Point, Point] = [[shoulder[0] + (23 + dx / 2) * side, shoulder[1] + dy / 2],
        [shoulder[0] + (46 + dx) * side, shoulder[1] + dy]];
      const arms: Arms = near ? [...active, [138, 90], [136, 111]] : [[175, 89], [176, 111], ...active];
      return pose(upright, arms, standing, [168, 63], [146, 63]);
    });
  };
  const neutral = pose(upright, [[175, 89], [176, 111], [138, 90], [136, 111]], standing, [168, 63], [146, 63]);
  return { ...clip([...circle(true, 7, 1), ...circle(true, 13, 1), ...circle(true, 13, -1), neutral,
    ...circle(false, 7, 1), ...circle(false, 13, 1), ...circle(false, 13, -1), neutral], [], [], 285),
  shoulders: [11, 12] };
}

export const towelAndShoulderIllustrations: Record<string, Illustration> = {
  "1977": behindBackStretch(),
  "3257": singleArmCircles(),
  "3348": shoulderTap(false),
  "3752": towelCurl("palm-up"),
  "3823": shoulderTap(true),
  "3830": towelCurl("thumb-up"),
  "3831": towelCurl("palm-down", true),
  "4910": bentArmDumbbellHold(),
  "5172": armCrossover(),
  "10742": proneSlide(),
};
