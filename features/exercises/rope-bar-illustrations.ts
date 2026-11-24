import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Body = { torso: [Point, Point, Point]; legs: [Point, Point, Point, Point] };
type Wave = "kneeling-up" | "half" | "high" | "inside" | "low" | "outside" | "slam" | "seat" | "across" | "kneel";
const ropeMount: Props = [[235, 153, 270, 153], [242, 144, 265, 144], [247, 144, 247, 156], [259, 144, 259, 156]];
const withoutEquipment: Gear = [];
const stance: Body = { torso: [[148, 50], [146, 65], [144, 110]], legs: [[162, 128], [169, 156], [123, 129], [116, 156]] };
const lowStance: Body = { torso: [[150, 65], [146, 81], [132, 124]], legs: [[171, 133], [169, 156], [107, 135], [115, 156]] };
const calfHigh: Body = { torso: [[148, 47], [146, 62], [146, 106]], legs: [[160, 130], [164, 151], [132, 130], [122, 151]] };
const half: Body = { torso: [[155, 60], [154, 76], [150, 119]], legs: [[177, 123], [178, 156], [137, 153], [109, 157]] };
const onKnees: Body = { torso: [[147, 69], [147, 85], [143, 124]], legs: [[155, 153], [126, 155], [145, 154], [114, 157]] };
const floorSit: Body = { torso: [[126, 79], [129, 95], [139, 150]], legs: [[172, 140], [186, 156], [162, 146], [173, 157]] };
const middle = ([x, y]: Point, [a, b]: Point): Point => [(x + a) / 2, (y + b) / 2];
const shift = ([x, y]: Point, [a, b]: Point): Point => [x + a, y + b];
const at = (body: Body, near: Point, far: Point, elbowA: Point, elbowB: Point): Point[] =>
  [...body.torso, elbowA, near, elbowB, far, ...body.legs];

function attachWaves(points: Point[], phase: number, amp: number, sync: boolean): Point[] {
  const result = [...points];
  const near: Point = points[4], far: Point = points[6];
  const addRope = (wrist: Point, fixed: Point, offset: number) => {
    for (let node = 1; node <= 7; node++) {
      const progress = node / 7;
      const envelope = Math.sin(progress * Math.PI);
      result.push([wrist[0] + (fixed[0] - wrist[0]) * progress,
        wrist[1] + (fixed[1] - wrist[1]) * progress + Math.sin(progress * 15 - phase + offset) * envelope * amp]);
    }
  };
  addRope(near, [260, 153], 0);
  addRope(far, [240, 151], sync ? 0 : Math.PI);
  return result;
}

const ropeLinks: Gear = [["line", 4, 11], ["line", 6, 18], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
for (const index of [11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23]) ropeLinks.push(["line", index, index + 1]);

function alternatingWaves(body: Body, phase: number, amplitude: number): Point[] {
  const [x, y] = body.torso[1];
  const rise = phase === 0 ? 1 : -1;
  const near: Point = [x + 37, y + 26 + amplitude * rise], far: Point = [x + 21, y + 26 - amplitude * rise];
  return at(body, near, far, [x + 16, y + 30 + amplitude * rise / 3], [x + 5, y + 30 - amplitude * rise / 3]);
}

function waves(kind: Wave): Illustration {
  let keys: Point[][];
  let amp = 12;
  const sync = kind === "high" || kind === "slam" || kind === "across";
  if (kind === "kneeling-up") {
    keys = [
      alternatingWaves(onKnees, 0, 12), alternatingWaves(onKnees, 1, 12),
      alternatingWaves(half, 0, 12), alternatingWaves(stance, 1, 12), alternatingWaves(stance, 0, 12),
      alternatingWaves(stance, 1, 12), alternatingWaves(half, 0, 12), alternatingWaves(onKnees, 1, 12),
    ];
  } else if (kind === "high" || kind === "slam") {
    const high = kind === "slam" ? calfHigh : stance;
    const down = kind === "slam" ? lowStance : stance;
    const ready = alternatingWaves(stance, 0, 0);
    const overhead = at(high, [167, 19], [136, 20], [164, 38], [140, 39]);
    const slamming = at(down, [181, 116], [156, 117], [165, 102], [145, 103]);
    keys = [ready, overhead, slamming, ready];
    amp = kind === "slam" ? 17 : 20;
  } else if (kind === "inside" || kind === "outside") {
    const direction = kind === "inside" ? 1 : -1;
    keys = Array.from({ length: 8 }, (_, step) => {
      const angle = step * Math.PI / 4 * direction;
      const side = Math.sin(angle) * 15, height = Math.cos(angle) * 22;
      const near: Point = [176 - side, 99 - height], far: Point = [115 + side, 99 - height];
      const chest = stance.torso[1];
      return at(stance, near, far, middle(chest, near), middle(chest, far));
    });
  } else if (kind === "across") {
    keys = [-1, 0, 1, 0].map((side) => {
      const body: Body = { ...stance, torso: [shift(stance.torso[0], [side * 5, 0]), shift(stance.torso[1], [side * 4, 0]), stance.torso[2]] };
      const near: Point = [157 + side * 41, 100], far: Point = [144 + side * 42, 102];
      return at(body, near, far, middle(body.torso[1], near), middle(body.torso[1], far));
    });
  } else {
    const body = kind === "half" ? half : kind === "kneel" ? onKnees : kind === "seat" ? floorSit : lowStance;
    const size = kind === "low" ? 7 : 15;
    keys = [0, 1, 0, 1].map((phase) => alternatingWaves(body, phase, size));
    if (kind === "low") amp = 7;
  }
  const dynamic = kind === "slam" ? [...ropeLinks, ["foot", 8, 174, 158], ["foot", 10, 131, 158]] as Gear : ropeLinks;
  return {
    frames: keys.map((frame, index) => attachWaves(frame, index * Math.PI / 2, amp, sync)),
    props: ropeMount, dynamic, ms: kind === "slam" ? 720 : 460, reference: true,
  };
}

function monkeyBar(): Illustration {
  const tunnel: Props = [[66, 27, 251, 27], [76, 43, 261, 43], [66, 27, 66, 157],
    [261, 43, 261, 157], [73, 155, 73, 41], [253, 27, 253, 155]];
  const rungs: Pair[] = Array.from({ length: 7 }, (_, index) => [[77 + index * 26, 27], [87 + index * 26, 43]]);
  for (const [a, b] of rungs) tunnel.push([...a, ...b]);
  const climb = (a: number, b: number, swing: number, release = false): Point[] => {
    const near = rungs[a][1], far = rungs[b][0];
    const x = (near[0] + far[0]) / 2;
    const neck: Point = [x - 3, release ? 97 : 81];
    const hip: Point = [x + swing / 2, release ? 131 : 120];
    const body: Body = {
      torso: [[x - 2, neck[1] - 17], neck, hip],
      legs: [[x + swing, 139], [x + swing + 3, release ? 157 : 151],
        [x + swing - 8, 141], [x + swing - 10, release ? 157 : 150]],
    };
    const nearHand = release ? shift(neck, [23, 20]) : near;
    const farHand = release ? shift(neck, [-18, 18]) : far;
    return at(body, nearHand, farHand, middle(neck, nearHand), middle(neck, farHand));
  };
  return { frames: [climb(0, 0, -4), climb(1, 0, 4), climb(1, 2, -4), climb(3, 2, 5),
    climb(3, 4, -4), climb(5, 4, 5), climb(5, 6, -4), climb(6, 6, 3), climb(6, 6, -1, true)],
    props: tunnel, dynamic: withoutEquipment, ms: 810, cutOnLoop: true, reference: true };
}

function ropeClimb(kind: "l-sit" | "two"): Illustration {
  const two = kind === "two";
  const climb = (rise: number, nearHigh: boolean) => {
    const neck: Point = [153, 81 - rise];
    const hip: Point = [152, 119 - rise];
    const legs: Body["legs"] = two ? [[160, 138 - rise], [157, 154 - rise], [144, 139 - rise], [143, 155 - rise]] :
      [[176, hip[1]], [206, hip[1]], [172, hip[1] + 5], [199, hip[1] + 5]];
    const near: Point = [two ? 175 : 127, neck[1] - (nearHigh ? 45 : 26)];
    const far: Point = [two ? 128 : 127, neck[1] - (nearHigh ? 26 : 45)];
    const elbowA: Point = nearHigh ? middle(neck, near) : [two ? 178 : 139, neck[1] + 1];
    const elbowB: Point = nearHigh ? [135, neck[1] + 3] : middle(neck, far);
    return at({ torso: [[155, neck[1] - 15], neck, hip], legs }, near, far, elbowA, elbowB);
  };
  const props: Props = [[102, 9, 200, 9], [127, 9, 127, 157]];
  if (two) props.push([175, 9, 175, 157]);
  const frames = [climb(0, true), climb(8, false), climb(16, true), climb(23, false),
    climb(16, true), climb(8, false)];
  return { frames, props, dynamic: [["pad", 4, 0, 0], ["pad", 6, 0, 0]], ms: 1010, reference: true };
}

export const ropeBarIllustrations: Readonly<Record<string, Illustration>> = {
  "4216": monkeyBar(),
  "10731": ropeClimb("l-sit"),
  "10439": ropeClimb("two"),
  "4131": waves("kneeling-up"),
  "4052": waves("half"),
  "3379": waves("high"),
  "3373": waves("inside"),
  "3380": waves("low"),
  "3374": waves("outside"),
  "3384": waves("slam"),
  "4112": waves("seat"),
  "3371": waves("across"),
  "2929": waves("kneel"),
};
