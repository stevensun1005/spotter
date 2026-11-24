import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Check = "path" | "hips" | "elbows" | "width" | "shoulders" | "dip";
const faultOffset = 22;
const goodOffset = 168;
const icons: Point[] = [[74, 24], [88, 34], [88, 24], [74, 34], [216, 29], [221, 34], [233, 21]];
const checkIcons: Gear = [["digit", 15, 16, 3], ["digit", 17, 18, 3], ["digit", 19, 20, 3], ["digit", 20, 21, 3]];
const xShift = (points: Point[], x: number): Point[] => points.map(([px, py]) => [px + x, py]);
const facingDeck: Props = [[39, 47, 83, 47], [83, 47, 83, 141], [83, 141, 39, 141], [39, 141, 39, 47]];
const bench: Props = [[10, 129, 102, 129], [18, 129, 18, 155], [93, 129, 93, 155]];

function sideBench(kind: "path" | "hips" | "shoulders", faulty: boolean, loaded: boolean): Point[] {
  const shiftedShoulder = kind === "shoulders" && faulty && loaded;
  const head: Point = shiftedShoulder ? [24, 101] : [22, 110];
  const neck: Point = shiftedShoulder ? [40, 106] : [38, 117];
  const hip: Point = kind === "hips" && faulty && loaded ? [81, 98] : [79, 121];
  const upperX = kind === "path" && faulty ? 37 : 51;
  const wristA: Point = loaded ? [upperX + (shiftedShoulder ? 1 : 0), shiftedShoulder ? 94 : 104] : [39, 69];
  const wristB: Point = [wristA[0] - 10, wristA[1]];
  const elbowA: Point = loaded ? [upperX + 5, wristA[1] + 21] : [42, 92];
  const elbowB: Point = loaded ? [upperX - 8, wristB[1] + 20] : [32, 93];
  return [head, neck, hip, elbowA, wristA, elbowB, wristB, [103, 121], [114, 155], [94, 125], [100, 155]];
}

function facingBench(kind: "elbows" | "width", faulty: boolean, loaded: boolean): Point[] {
  const halfGrip = kind === "width" && faulty ? 40 : 23;
  const halfElbow = kind === "elbows" && faulty && loaded ? 45 : 25;
  const level = loaded ? 82 : 68;
  const elbowY = loaded ? kind === "elbows" && faulty ? 77 : 92 : 74;
  const elbows: Point[] = [[61 + halfElbow, elbowY], [61 - halfElbow, elbowY]];
  const wrists: Point[] = [[61 + halfGrip, level], [61 - halfGrip, level]];
  return [[61, 54], [61, 72], [61, 111], elbows[0], wrists[0], elbows[1], wrists[1],
    [81, 130], [87, 152], [43, 130], [37, 152]];
}

function benchDip(faulty: boolean, loaded: boolean): Point[] {
  const head: Point = [66 + (faulty && loaded ? 14 : 0), loaded ? 89 : 60];
  const neck: Point = [head[0] - 1, head[1] + 15];
  const hip: Point = [70 + (faulty && loaded ? 19 : 0), loaded ? 137 : 121];
  const elbowA: Point = loaded ? faulty ? [65, 118] : [38, 113] : [61, 99];
  const elbowB: Point = [elbowA[0] - 8, elbowA[1] + 2];
  return [head, neck, hip, elbowA, [52, 126], elbowB, [42, 127],
    [94, loaded ? 137 : 130], [116, 156], [83, loaded ? 138 : 132], [108, 155]];
}

function formCheck(kind: Check): Illustration {
  const topView = kind === "elbows" || kind === "width";
  const frame = (faulty: boolean, loaded: boolean) => kind === "dip" ? benchDip(faulty, loaded)
    : topView ? facingBench(kind, faulty, loaded) : sideBench(kind, faulty, loaded);
  const points = (right: Point[], wrong: Point[]): Point[] => {
    if (kind === "dip") return [...right, [0, 0], [0, 0], [0, 0], [0, 0], ...icons];
    const barEnd = (body: Point[]): Point[] => topView
      ? [[body[1][0] + 48, body[4][1]], [body[1][0] - 48, body[6][1]]]
      : [[body[4][0] + 7, body[4][1]], [body[6][0] - 7, body[6][1]]];
    return [...right, ...barEnd(right), ...barEnd(wrong), ...icons];
  };
  const stages = [true, false, true];
  const correct = stages.map((loaded) => xShift(frame(false, loaded), goodOffset));
  const faulty = stages.map((loaded) => xShift(frame(true, loaded), faultOffset));
  const equipment: Gear = kind === "dip" ? [] :
    [["bar", 11, 12], ["bar", 13, 14], ["plate", 11, 0, 0], ["plate", 12, 0, 0], ["plate", 13, 0, 0], ["plate", 14, 0, 0]];
  const support: Props = topView ? facingDeck : kind === "dip"
    ? [[13, 128, 55, 128], [18, 128, 18, 157], [51, 128, 51, 157]] : bench;
  const props: Props = [faultOffset, goodOffset].flatMap((dx) =>
    support.map(([x1, y1, x2, y2]): Props[number] => [x1 + dx, y1, x2 + dx, y2]));
  return { frames: correct.map((body, index) => points(body, faulty[index])),
    partnerFrames: faulty, dynamic: [...equipment, ...checkIcons], props, topView, ms: 1150, reference: true };
}

export const upperFormCheckIllustrations: Readonly<Record<string, Illustration>> = {
  "2341": formCheck("path"),
  "2338": formCheck("hips"),
  "2342": formCheck("elbows"),
  "2339": formCheck("width"),
  "2340": formCheck("shoulders"),
  "2346": formCheck("dip"),
};
