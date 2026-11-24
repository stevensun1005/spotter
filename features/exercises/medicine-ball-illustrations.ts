import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Body = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Pose = { body: Body; legs: Legs };
const wall: Props = [[273, 24, 273, 159], [279, 24, 279, 159], [273, 159, 290, 159]];
const feet: Equipment = [["foot-tip", 8, 11], ["foot-tip", 10, 12], ["ball", 13, 0, 0]];

const split: Pose = {
  body: [[125, 48], [124, 68], [119, 107]],
  legs: [[140, 128], [145, 153], [104, 130], [92, 154]],
};
const standing: Pose = {
  body: [[124, 47], [123, 66], [118, 106]],
  legs: [[127, 131], [133, 154], [112, 131], [104, 154]],
};
const kneeDown: Pose = {
  body: [[124, 68], [123, 85], [115, 123]],
  legs: [[148, 124], [147, 155], [105, 153], [73, 155]],
};
const rotatedSplit: Pose = { ...split, body: [[109, 48], [113, 67], [119, 107]] };
const squat: Pose = {
  body: [[107, 71], [112, 90], [97, 128]],
  legs: [[131, 125], [133, 154], [117, 128], [104, 154]],
};
const highSquatRelease: Pose = {
  ...standing, body: [[124, 40], [123, 58], [119, 96]],
  legs: [[127, 123], [133, 148], [112, 124], [104, 148]],
};
const hinge: Pose = {
  ...squat, body: [[143, 82], [131, 93], [92, 111]],
};
const lying: Pose = {
  body: [[78, 143], [97, 149], [151, 151]],
  legs: [[174, 123], [193, 154], [163, 124], [181, 155]],
};
const sitting: Pose = {
  ...lying, body: [[132, 86], [125, 104], [146, 148]],
};
const stepRear: Pose = {
  body: [[115, 53], [115, 72], [106, 110]],
  legs: [[135, 130], [147, 154], [91, 132], [72, 154]],
};

function poseFrame(setup: Pose, reach: Point, ball: Point = reach, bent = false): Point[] {
  const [x, y] = setup.body[1];
  const elbow = (hand: Point, offset: number): Point => [
    Math.round((x + hand[0]) / 2) - (bent ? 14 : 0) + offset,
    Math.round((y + hand[1]) / 2) + (bent ? 18 : 5),
  ];
  const near: Point = [reach[0] - 4, reach[1] + 2];
  const far: Point = [reach[0] + 6, reach[1] + 3];
  const toes = ([x, y]: Point): Point => [x + (setup.body === kneeDown.body && x < 105 ? -11 : 13), Math.min(y + 4, 158)];
  return [...setup.body, elbow(near, 7), near, elbow(far, -5), far, ...setup.legs,
    toes(setup.legs[1]), toes(setup.legs[3]), ball];
}

const clip = (frames: Point[][], props: Props = [], ms = 540): Illustration =>
  ({ frames, props, dynamic: feet, reference: true, ms });

function wallPass(mode: "chest" | "kneel" | "horizontal" | "rotational" | "step-behind" | "wall-ball" | "squat-pass" | "situp" | "pullover") {
  const base = mode === "kneel" ? kneeDown : mode === "situp" || mode === "pullover" ? sitting
    : mode === "step-behind" ? stepRear : mode === "horizontal" || mode === "rotational" ? rotatedSplit
    : mode === "wall-ball" || mode === "squat-pass" ? standing : split;
  const high = mode === "wall-ball";
  const seated = base === sitting;
  const rotational = base === stepRear || base === rotatedSplit;
  const loadedAt: Point = seated ? [149, 103] : rotational ? [98, mode === "horizontal" ? 73 : 108] : [151, base.body[1][1] + 13];
  const out: Point = high ? [162, 40] : seated ? [179, 91] : [191, base.body[1][1] + 8];
  const wallHit: Point = [264, high ? 30 : mode === "squat-pass" ? 59 : out[1]];
  const pre = mode === "situp" ? poseFrame(lying, [132, 124], [132, 124], true)
    : mode === "pullover" ? poseFrame(lying, [47, 111]) :
    high || mode === "squat-pass" ? poseFrame(squat, [143, 99], [143, 99], true)
    : poseFrame(base, loadedAt, loadedAt, true);
  const prime = mode === "pullover" ? lying : high ? highSquatRelease : rotational ? split : base;
  const release = mode === "pullover" ? [138, 98] as Point : out;
  const hold = poseFrame(prime, release, release);
  const travels: Point = [Math.round((release[0] + wallHit[0]) / 2), wallHit[1] - (high ? 6 : 2)];
  const receiving = mode === "pullover" ? [136, 111] as Point : [release[0] - 13, release[1] + 5] as Point;
  const take = poseFrame(prime, receiving, receiving, true);
  return clip([pre, hold, poseFrame(prime, release, travels), poseFrame(prime, release, wallHit),
    poseFrame(prime, receiving, travels, true), take], high ? [...wall, [261, 27, 273, 27]] : wall);
}

const lyingCatch = clip([
  poseFrame(lying, [116, 125], [116, 125], true),
  poseFrame(lying, [112, 98]),
  poseFrame(lying, [112, 95], [112, 64]),
  poseFrame(lying, [112, 95], [112, 47]),
  poseFrame(lying, [112, 98], [112, 82]),
  poseFrame(lying, [112, 115], [112, 115], true),
]);

const situpSlam = clip([
  poseFrame(lying, [52, 115]),
  poseFrame(sitting, [121, 63]),
  poseFrame(sitting, [177, 126]),
  poseFrame(sitting, [176, 137], [214, 152]),
  poseFrame(sitting, [192, 134], [199, 131], true),
  poseFrame(sitting, [184, 124], [184, 124], true),
]);

const overheadCircleSlam = clip([
  poseFrame(standing, [127, 19]),
  poseFrame(split, [159, 37]),
  poseFrame(hinge, [172, 126]),
  poseFrame(hinge, [173, 132], [184, 151]),
  poseFrame(hinge, [172, 128], [176, 131], true),
  poseFrame(standing, [148, 94], [148, 94], true),
]);

const aroundHead = clip([[151, 80], [157, 48], [131, 22], [99, 44], [117, 78]].map(([x, y]) =>
  poseFrame(standing, [x, y], [x, y], y > 60)), [], 670);

const splitTwist = clip([[150, 83], [173, 98], [150, 83], [92, 86]].map(([x, y]) =>
  poseFrame(split, [x, y], [x, y], true)), [], 780);

const russianTwist = clip([[149, 103], [174, 151], [149, 103], [107, 151]].map(([x, y]) =>
  poseFrame({ ...sitting, body: [[121, 91], [124, 106], [148, 149]] }, [x, y], [x, y], true)), [], 750);

const highLunge = clip([
  poseFrame(standing, [150, 79], [150, 79], true),
  poseFrame(kneeDown, [150, 101], [150, 101], true),
  poseFrame(standing, [123, 20]),
  poseFrame(standing, [150, 79], [150, 79], true),
  poseFrame({ ...kneeDown, legs: [kneeDown.legs[2], kneeDown.legs[3], kneeDown.legs[0], kneeDown.legs[1]] },
    [150, 101], [150, 101], true),
], [], 700);

export const medicineBallIllustrations: Record<string, Illustration> = {
  "4375": aroundHead,
  "5144": wallPass("chest"),
  "4099": wallPass("kneel"),
  "10197": wallPass("horizontal"),
  "10598": lyingCatch,
  "10118": overheadCircleSlam,
  "10595": wallPass("pullover"),
  "1699": wallPass("rotational"),
  "0625": wallPass("situp"),
  "10558": situpSlam,
  "10552": splitTwist,
  "4383": wallPass("step-behind"),
  "5161": wallPass("squat-pass"),
  "1247": russianTwist,
  "1692": highLunge,
  "2458": wallPass("wall-ball"),
};
