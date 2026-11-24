import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Body = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Pose = { body: Body; legs: Legs; toes: [Point, Point]; handAngle: number; arm: "hold" | "press" | "hang" };

const base: Point = [252, 154];
const fixedAnchor: Props = [[237, 157, 271, 157], [244, 157, 252, 154], [252, 154, 263, 157]];
const load: Equipment = [["bar", 13, 14], ["plate", 13, 3, 2], ["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const forearmReach = (a: Point, b: Point, t: number, bend = 0): Point => [
  Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t + bend),
];
const anglePoint = (angle: number, radius: number): Point => [
  Math.round(base[0] - radius * Math.cos(angle * Math.PI / 180)),
  Math.round(base[1] - radius * Math.sin(angle * Math.PI / 180)),
];

function poseFrame(pose: Pose, one = false): Point[] {
  const [, shoulder, hip] = pose.body;
  const grip = anglePoint(pose.handAngle, 139);
  const otherHand: Point = [grip[0] - 5, grip[1] + 3];
  const nearElbow = pose.arm === "hold" ? [shoulder[0] + 1, shoulder[1] + 27] as Point
    : forearmReach(shoulder, grip, 0.52, pose.arm === "hang" ? 3 : 4);
  const farElbow = forearmReach(shoulder, otherHand, 0.48, pose.arm === "hold" ? 21 : 5);
  return [...pose.body, nearElbow, grip,
    one ? [shoulder[0] - 13, shoulder[1] + 24] : farElbow,
    one ? [hip[0] - 12, hip[1] - 4] : otherHand,
    ...pose.legs, ...pose.toes, grip, base];
}

function anchored(poses: Pose[], { single = false, band = false, ms = 790 }:
  { single?: boolean; band?: boolean; ms?: number } = {}): Illustration {
  return {
    frames: poses.map((pose) => poseFrame(pose, single)),
    props: band ? [...fixedAnchor, [132, 156, 149, 156]] : fixedAnchor,
    dynamic: band ? [...load, ["band", 13, 142, 156]] : load,
    ms, reference: true,
  };
}

const normal: Pose = {
  body: [[116, 46], [121, 65], [117, 103]],
  legs: [[130, 129], [140, 154], [110, 130], [103, 154]],
  toes: [[153, 158], [115, 158]], handAngle: 39, arm: "hold",
};
const split: Pose = {
  ...normal,
  legs: [[135, 133], [152, 154], [100, 132], [85, 154]], toes: [[165, 158], [98, 157]],
};
const squat: Pose = {
  body: [[96, 74], [106, 91], [91, 130]],
  legs: [[132, 124], [140, 154], [113, 125], [103, 154]],
  toes: normal.toes, handAngle: 24, arm: "hold",
};
const kneeling: Pose = {
  body: [[115, 62], [123, 80], [116, 122]],
  legs: [[134, 152], [104, 153], [113, 151], [85, 153]],
  toes: [[91, 158], [73, 158]], handAngle: 33, arm: "hold",
};
const halfKneeling: Pose = {
  ...kneeling,
  legs: [[149, 122], [149, 153], [110, 152], [80, 155]], toes: [[162, 157], [69, 157]],
};
const rearLunge: Pose = {
  body: [[101, 65], [111, 81], [106, 121]],
  legs: [[144, 121], [148, 154], [90, 153], [62, 146]],
  toes: [[163, 158], [56, 156]], handAngle: 28, arm: "hold",
};
const rearLungeFar: Pose = {
  ...rearLunge,
  legs: [rearLunge.legs[2], rearLunge.legs[3], rearLunge.legs[0], rearLunge.legs[1]],
  toes: [rearLunge.toes[1], rearLunge.toes[0]],
};
const rearSwap = anchored([normal, rearLunge, normal, rearLungeFar]);

const pressFrom = (pose: Pose, handAngle: number): Pose => ({ ...pose, handAngle, arm: "press" });
const pressTop = pressFrom(normal, 56);
const splitTop = pressFrom(split, 56);
const dip: Pose = { ...normal, body: [[116, 58], [121, 76], [117, 114]],
  legs: [[144, 133], [140, 154], [119, 134], [103, 154]], handAngle: 34 };

const squatJumpTop: Pose = {
  ...normal, body: [[120, 32], [125, 48], [121, 88]],
  legs: [[137, 116], [142, 140], [111, 116], [102, 140]],
  toes: [[154, 144], [113, 144]], handAngle: 45,
};
const highKneeLeft: Pose = {
  ...normal, legs: [[159, 103], [149, 128], normal.legs[2], normal.legs[3]],
  toes: [[162, 132], normal.toes[1]],
};
const highKneeRight: Pose = {
  ...normal, legs: [normal.legs[0], normal.legs[1], [148, 105], [139, 131]],
  toes: [normal.toes[0], [151, 135]],
};

const frontSquat = anchored([normal, squat]);
const bandPress = anchored([split, splitTop], { single: true, band: true });
const kneeRockBack: Pose = {
  ...kneeling, body: [[104, 77], [113, 94], [101, 140]],
  legs: [[134, 152], [104, 153], [113, 151], [85, 153]],
  handAngle: 27,
};

function frontal(mode: "rotation" | "cossack" | "sumo"): Illustration {
  const fixed: Point = [161, 151];
  const frame = (direction: number): Point[] => {
    const midpoint = mode === "cossack" ? 161 + 28 * direction : 161;
    const hipY = mode === "rotation" ? 116 : direction ? 121 : 106;
    const shoulderY = hipY - 40;
    const grip: Point = mode !== "rotation" ? [midpoint, shoulderY + 15] : [161 + 43 * direction, direction ? 86 : 69];
    const knees: Legs = mode === "rotation" ? [[176, 152], [149, 153], [146, 152], [121, 153]]
      : mode === "sumo" ? [[direction ? 202 : 190, direction ? 130 : 132], [211, 154],
          [direction ? 119 : 130, direction ? 130 : 132], [110, 154]]
      : [[182 + 14 * Math.max(0, direction), direction < 0 ? 135 : 130], [211, 154],
         [138 + 14 * Math.min(0, direction), direction > 0 ? 135 : 130], [110, 154]];
    return [[midpoint, shoulderY - 19], [midpoint, shoulderY], [midpoint, hipY],
      [midpoint + 21, shoulderY + 16], [grip[0] + 4, grip[1]], [midpoint - 21, shoulderY + 17], [grip[0] - 4, grip[1] + 2],
      ...knees, mode === "rotation" ? [138, 157] : [224, mode === "cossack" && direction < 0 ? 144 : 157],
      mode === "rotation" ? [109, 157] : [97, mode === "cossack" && direction > 0 ? 144 : 157], grip, fixed];
  };
  return { frames: mode === "sumo" ? [frame(0), frame(1)] : [frame(0), frame(-1), frame(0), frame(1)],
    props: [[146, 156, 176, 156], [154, 154, 164, 151]], dynamic: load, reference: true, ms: 840 };
}

const rdlTop: Pose = { ...normal, handAngle: 19, arm: "hang",
  legs: [[124, 127], [110, 154], [108, 129], [88, 143]], toes: [[123, 158], [83, 151]] };
const rdlDown: Pose = {
  body: [[151, 82], [139, 90], [94, 95]],
  legs: [[107, 124], [110, 154], [61, 93], [34, 85]],
  toes: [[123, 158], [26, 91]], handAngle: 10, arm: "hang",
};

function thorLift(): Illustration {
  const body = [halfKneeling.body[0], halfKneeling.body[1], halfKneeling.body[2]] as const;
  const fixture: Point = [222, 155];
  const angle = (a: number) => [fixture[0] - 123 * Math.cos(a), fixture[1] - 123 * Math.sin(a)] as Point;
  const at = (a: number): Point[] => {
    const grip = angle(a), other: Point = [grip[0] + 4, grip[1] + 2];
    return [...body, forearmReach(body[1], grip, .55, 5), grip,
      forearmReach(body[1], other, .47, 11), other, ...halfKneeling.legs, ...halfKneeling.toes, grip, fixture];
  };
  return { frames: [at(.27), at(.62), at(1.13), at(1.13), at(.62)], props: [[206, 157, 239, 157], [216, 157, 222, 155]],
    dynamic: load, ms: 820, reference: true };
}

function lateralRaise(): Illustration {
  const fixture: Point = [62, 153];
  const body: Body = [[158, 45], [158, 63], [157, 105]];
  const at = (angle: number): Point[] => {
    const grip: Point = [fixture[0] + 105 * Math.cos(angle), fixture[1] - 105 * Math.sin(angle)];
    const elbow = forearmReach([151, 63], grip, .47, 5);
    return [...body, elbow, grip, [174, 89], [169, 110], [169, 131], [174, 154],
      [143, 130], [137, 154], [184, 157], [125, 157], grip, fixture];
  };
  const top = at(1.12);
  return { frames: [at(.33), at(.72), top, top, at(.72)], props: [[49, 157, 76, 157], [53, 157, 62, 153]],
    dynamic: load, ms: 810, reference: true };
}

export const landmineIllustrations: Record<string, Illustration> = {
  "10195": thorLift(),
  "3237": lateralRaise(),
  "10056": bandPress,
  "4202": bandPress,
  "10052": frontal("cossack"),
  "4246": frontSquat,
  "4090": frontal("sumo"),
  "9695": anchored([halfKneeling, pressFrom(halfKneeling, 49)], { single: true }),
  "11092": frontal("rotation"),
  "3921": anchored([kneeling, pressFrom(kneeling, 48)]),
  "5282": anchored([kneeRockBack, kneeling, pressFrom(kneeling, 48), kneeling]),
  "7627": anchored([splitTop, rearLunge, splitTop], { single: true }),
  "5074": anchored([split, splitTop]),
  "3919": rearSwap,
  "4040": rearSwap,
  "5094": anchored([split, splitTop], { single: true }),
  "10190": anchored([normal, dip, pressTop, normal], { single: true, ms: 620 }),
  "3918": anchored([rdlTop, rdlDown]),
  "2976": anchored([normal, squat, normal, pressTop, normal]),
  "10675": anchored([normal, squat, squatJumpTop, squat, normal], { ms: 510 }),
  "3529": anchored([normal, squat, highKneeLeft, normal, squat, highKneeRight]),
};
