import type { Illustration, Point } from "./motion-data";
import { alternating, ballSeat, cableCurl, curl, dumbbells, hammerWeights, preacher, stabilitySeat, standing } from "./arm-illustrations";
import type { CurlPhase, CurlPose } from "./arm-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Arms = [Point, Point, Point, Point];
type Grip = "up" | "down" | "neutral";
type Support = "thigh" | "bench" | "standing";
const seat: Props = [[101, 118, 153, 118], [106, 118, 106, 157], [148, 118, 148, 157]];
const pad: Props = [[135, 110, 186, 110], [140, 110, 140, 155], [181, 110, 181, 155]];
const tower = (x: number, y: number): Props => [[x, 29, x, 156], [x - 9, 156, x + 11, 156], [x - 4, y, x + 4, y]];
const standingBase: Point[] = [[153, 44], [153, 60], [154, 104], [0, 0], [0, 0], [0, 0], [0, 0],
  [177, 127], [182, 156], [136, 129], [129, 156]];
const seatedBase: Point[] = [[136, 47], [135, 66], [133, 111], [0, 0], [0, 0], [0, 0], [0, 0],
  [165, 116], [168, 156], [151, 119], [153, 156]];
const thighBase: Point[] = [[135, 62], [126, 78], [122, 111], [148, 107], [179, 112], [136, 108], [163, 113],
  [165, 115], [168, 156], [152, 117], [152, 156]];
const benchBase: Point[] = [[133, 51], [124, 69], [114, 111], [139, 106], [185, 107], [127, 107], [171, 108],
  [147, 121], [150, 155], [132, 124], [139, 155]];
const standingBench: Point[] = [[157, 52], [145, 65], [129, 107], [150, 106], [185, 107], [139, 106], [170, 108],
  [137, 130], [139, 155], [125, 131], [123, 155]];
const sittingBack: Props = [...seat, [121, 60, 118, 118]];

const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const midpoint = ([ax, ay]: Point, [bx, by]: Point): Point => [(ax + bx) / 2, (ay + by) / 2];
const frameWithArms = (body: Point[], arms: Arms): Point[] => [...body.slice(0, 3), ...arms, ...body.slice(7)];
const demo = (frames: Point[][], dynamic: Gear, props: Props = [], ms = 1020): Illustration =>
  ({ frames, dynamic, props, ms, reference: true });

function wristCurl(support: Support, grip: Grip, load: "bar" | "dumbbell" | "cable" | "band", one = false): Illustration {
  const base = support === "thigh" ? thighBase : support === "standing" ? standingBench : benchBase;
  const resting = one ? frameWithArms(base, [base[3], base[4], [111, 87], [112, 112]]) : base;
  const between = (stage: number): Point[] => {
    const fingers: Point = [12, stage];
    const thumb: Point = [6, grip === "up" ? 6 : grip === "down" ? -6 : -10];
    const near = add(resting[4], fingers), far = add(resting[6], fingers);
    return [...resting, near, add(resting[4], thumb), far, add(resting[6], thumb), midpoint(near, far)];
  };
  const start = between(10), finish = between(-9);
  const props: Props = support === "thigh" ? seat : support === "standing" ? pad : [...seat, ...pad];
  const dynamic: Gear = [["hand", 4, 11, 12]];
  if (!one) dynamic.push(["hand", 6, 13, 14]);
  if (load === "cable" || load === "bar") dynamic.push(["bar", 11, 13]);
  if (load === "cable") dynamic.push(["cable", 15, 232, 143]);
  if (load === "bar") dynamic.push(["barbell-end", 11, 14, 0], ["barbell-end", 13, -14, 0]);
  if (load === "band") dynamic.push(["band", 11, 8], ["band", 13, 10]);
  if (load === "dumbbell") {
    const weight = grip === "neutral" ? "hammer-weight" : "dumbbell";
    dynamic.push([weight, 11, 0, 0]);
    if (!one) dynamic.push([weight, 13, 0, 0]);
  }
  return demo([start, finish, finish], dynamic, load === "cable" ? [...props, ...tower(232, 143)] : props);
}

const preacherStand: CurlPose = { ...preacher, legs: standing.legs,
  trunk: [[143, 50], [135, 68], [133, 109]],
  support: [[144, 86, 160, 107], [156, 106, 156, 157], [141, 157, 173, 157]],
};
const concentrationBall: CurlPose = { ...stabilitySeat, trunk: [[150, 61], [143, 76], [123, 105]],
  elbows: [[151, 112], [131, 100]],
};
const ballCurl = curl(concentrationBall, {
  one: true, phases: [[77, 77], [12, 12], [-60, -60]], gear: [dumbbells[0], ...ballSeat],
});
ballCurl.frames = ballCurl.frames.map((points): Point[] => points.map((point, index) =>
  index === 5 ? [131, 92] : index === 6 ? [145, 110] : point));

function zottman(pose: CurlPose, one = false): Illustration {
  const poses: CurlPhase[] = [[84, 84], [12, 12], [-64, -64], [-64, -64], [12, 12], [84, 84]];
  const base = curl(pose, { phases: poses, one });
  const frames = base.frames.map((points, i): Point[] => {
    const palms = i < 3 ? 1 : -1;
    const thumb = (wrist: number, index: number, side: number) => {
      const tip = points[index], seed = points[wrist];
      return add(seed, [-(tip[1] - seed[1]) * side * 1.55, (tip[0] - seed[0]) * side * 1.55]);
    };
    const ends = ([x, y]: Point, side: number): Point[] => [[x - 7, y - side * 5], [x + 7, y + side * 5]];
    return [...points, thumb(4, 11, palms), thumb(6, 12, -palms), ...ends(points[4], palms), ...ends(points[6], -palms)];
  });
  const dynamic: Gear = [["hand", 4, 11, 15], ["bar", 17, 18], ["pad", 17, 0, 0], ["pad", 18, 0, 0]];
  if (!one) dynamic.push(["hand", 6, 12, 16], ["bar", 19, 20], ["pad", 19, 0, 0], ["pad", 20, 0, 0]);
  return { ...base, frames, dynamic, ms: 1000 };
}

function armBlasterCurl(): Illustration {
  const base = curl(standing, { phases: alternating, gear: dumbbells });
  const frames = base.frames.map((points): Point[] => [...points, [128, 84], [164, 84], [145, 55]]);
  return { ...base, frames, dynamic: [...(base.dynamic ?? []),
    ["line", 15, 17], ["line", 16, 17], ["bar", 15, 16], ["pad", 15, 0, 0], ["pad", 16, 0, 0]] };
}

function altShoulders(mode: "front" | "lateral" | "overhead"): Illustration {
  const down: Arms = mode === "overhead" ? [[182, 78], [181, 56], [123, 78], [124, 56]]
    : [[150, 91], [151, 111], [117, 91], [116, 111]];
  const raised: Arms = mode === "overhead" ? [[176, 42], [173, 15], [128, 42], [132, 15]] :
    mode === "front" ? [[160, 70], [187, 68], [158, 73], [181, 71]] :
      [[182, 61], [204, 61], [128, 62], [103, 62]];
  const body = mode === "front" ? seatedBase : standingBase;
  const bottom = frameWithArms(body, down);
  const near = frameWithArms(body, [raised[0], raised[1], down[2], down[3]]);
  const far = frameWithArms(body, [down[0], down[1], raised[2], raised[3]]);
  return demo([bottom, near, bottom, far], dumbbells, mode === "front" ? seat : []);
}

function narrowShoulders(gear: "band" | "cable" | "dumbbell"): Illustration {
  const inSeat = gear !== "cable";
  const body = inSeat ? seatedBase : standingBase;
  const [x, y] = body[1];
  const armsFrom = (...offsets: Arms): Arms => [
    add([x, y], offsets[0]), add([x, y], offsets[1]), add([x, y], offsets[2]), add([x, y], offsets[3]),
  ];
  const start = frameWithArms(body, armsFrom([24, 23], [23, 3], [-24, 23], [-23, 3]));
  const high = frameWithArms(body, armsFrom([19, -20], [19, -44], [-19, -20], [-19, -44]));
  const props: Props = inSeat ? sittingBack : [...tower(213, 146), ...tower(89, 146)];
  const dynamic: Gear = gear === "band" ? [["band", 4, 8], ["band", 6, 10], ["pad", 4, 0, 0], ["pad", 6, 0, 0]]
    : gear === "cable" ? [["cable", 4, 213, 146], ["cable", 6, 89, 146], ["pad", 4, 0, 0], ["pad", 6, 0, 0]]
      : hammerWeights;
  return demo([start, high, high], dynamic, props);
}

export const legacyArmCorrectionIllustrations: Readonly<Record<string, Illustration>> = {
  "1016": wristCurl("thigh", "up", "band"),
  "1411": wristCurl("bench", "down", "bar"),
  "1412": wristCurl("bench", "up", "bar"),
  "0079": wristCurl("thigh", "down", "bar"),
  "0126": wristCurl("thigh", "up", "bar"),
  "0125": wristCurl("bench", "up", "bar"),
  "0206": cableCurl(standing, 231, 145, "bar", { grip: "palm-down" }),
  "0209": cableCurl(preacher, 231, 146, "bar", { grip: "palm-down", phases: [[41, 41], [-10, -10], [-62, -62], [-10, -10]] }),
  "0247": wristCurl("standing", "up", "cable"),
  "0285": curl(standing, { phases: alternating, gear: dumbbells }),
  "2403": armBlasterCurl(),
  "0353": ballCurl,
  "0397": wristCurl("thigh", "neutral", "dumbbell"),
  "0402": curl(preacher, { phases: [[41, 41], [-10, -10], [-62, -62], [-10, -10]], gear: dumbbells }),
  "0429": curl(standing, { grip: "palm-down", gear: dumbbells }),
  "0439": zottman(standing),
  "2293": zottman(preacherStand),
  "2294": zottman(preacher),
  "1672": zottman(preacher, true),
  "1676": curl(stabilitySeat, { grip: "thumb-up", phases: alternating, gear: [...hammerWeights, ...ballSeat] }),
  "0387": altShoulders("front"),
  "0414": altShoulders("overhead"),
  "0415": altShoulders("lateral"),
  "3122": narrowShoulders("band"),
  "0219": narrowShoulders("cable"),
  "0404": narrowShoulders("dumbbell"),
  "0366": wristCurl("bench", "neutral", "dumbbell", true),
};
