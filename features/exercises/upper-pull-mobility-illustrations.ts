import type { Illustration, Point } from "./motion-data";
import { leverSeat } from "./rowing-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Body = { torso: [Point, Point, Point]; legs: [Point, Point, Point, Point]; props?: Props };
const standing: Body = { torso: [[153, 44], [153, 61], [151, 104]],
  legs: [[173, 130], [179, 156], [133, 130], [127, 156]] };
const prone: Body = { torso: [[178, 62], [160, 74], [121, 113]],
  legs: [[137, 133], [146, 156], [111, 136], [112, 156]],
  props: [[119, 121, 171, 68], [124, 115, 124, 157], [107, 157, 149, 157]] };
const hinge: Body = { torso: [[189, 61], [173, 72], [127, 103]],
  legs: [[143, 129], [149, 156], [120, 132], [116, 156]] };
const seat: Props = [[103, 120, 162, 120], [111, 120, 111, 156], [156, 120, 156, 156]];
const seated: Body = { torso: [[123, 54], [125, 70], [125, 113]],
  legs: [[157, 121], [171, 155], [146, 122], [156, 155]], props: seat };
const profileSeated: Body = { ...seated, legs: [[157, 131], [184, 151], [151, 137], [175, 155]] };
const free: Pair = [[137, 88], [133, 113]];
const dumbbells: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const hanging: Arms = [[171, 104], [178, 135], [153, 107], [161, 136]];
const pulled: Arms = [[135, 87], [149, 110], [125, 89], [139, 114]];
const tower = (x: number, y: number): Props => [[x, 28, x, 157], [x - 11, 157, x + 13, 157],
  [x - 4, y, x + 5, y], [x + 8, 51, x + 8, 154], [x + 8, 119, x + 18, 119], [x + 8, 127, x + 18, 127]];
const plus = ([x, y]: Point, [a, b]: Point): Point => [x + a, y + b];
const mid = ([x, y]: Point, [a, b]: Point): Point => [(x + a) / 2, (y + b) / 2];
const point = (body: Body, arms: Arms): Point[] => [...body.torso, ...arms, ...body.legs];
const create = (body: Body, frames: Point[][], dynamic: Gear = [], props: Props = [], ms = 990): Illustration =>
  ({ frames, props: [...(body.props ?? []), ...props], dynamic, ms, reference: true });
function cycles(body: Body, down: Arms, up: Arms, dynamic: Gear = [], props: Props = []): Illustration {
  const high = point(body, up);
  return create(body, [point(body, down), high, high], dynamic, props);
}

function rotationAtHand(frame: Point[], grip: "palm-down" | "neutral" | "palm-up"): Point[] {
  const near = frame[4], far = frame[6];
  const tip: Point = grip === "neutral" ? [4, 8] : [8, grip === "palm-up" ? -5 : 5];
  const thumb: Point = grip === "neutral" ? [0, -8] : [6, grip === "palm-up" ? 7 : -7];
  const opposite: Point = [-tip[0], -tip[1]];
  return [...frame, plus(near, tip), plus(near, opposite), plus(far, tip), plus(far, opposite),
    plus(near, thumb), plus(far, thumb)];
}
const rotationDumbbells: Gear = [["bar", 11, 12], ["pad", 11, 0, 0], ["pad", 12, 0, 0],
  ["bar", 13, 14], ["pad", 13, 0, 0], ["pad", 14, 0, 0], ["hand", 4, 11, 15], ["hand", 6, 13, 16]];
function forearmRotate(standingStill: boolean): Illustration {
  const body = standingStill ? standing : hinge;
  const neutralBent: Arms = [[170, 92], [200, 94], [147, 93], [176, 95]];
  if (standingStill) {
    const frame = point(body, neutralBent);
    const grips = ["neutral", "palm-up", "neutral", "palm-down"] as const;
    return create(body, grips.map((grip) => rotationAtHand(frame, grip)), rotationDumbbells);
  }
  const start = rotationAtHand(point(body, hanging), "palm-down");
  const end = rotationAtHand(point(body, pulled), "neutral");
  return create(body, [start, end, end], rotationDumbbells);
}

function twistedRow(cable: boolean): Illustration {
  const setup = cable ? profileSeated : hinge;
  const load: Gear = cable ? [["cable", 4, 229, 138], ["pad", 4, 0, 0], ["hand", 4, 11, 12]]
    : [["kettlebell", 4, 0, 9], ["kettlebell", 6, 0, 9]];
  const torso = (toward: boolean): Body => {
    const [head, neck, hip] = setup.torso;
    const dx = toward ? 6 : -5;
    return { ...setup, torso: [plus(head, [dx, -2]), plus(neck, [dx, -1]), hip] };
  };
  if (cable) {
    const low: Arms = [[152, 85], [180, 96], [121, 97], [124, 114]];
    const high: Arms = [[112, 93], [141, 102], [121, 97], [124, 114]];
    return create(setup, [[...point(torso(true), low), [186, 101], [185, 91]],
      [...point(torso(false), high), [147, 103], [141, 95]]],
    load, [...tower(229, 138), [176, 149, 195, 149], [182, 143, 191, 153]]);
  }
  const depth = point(setup, hanging);
  return create(setup, [depth, point(torso(true), [pulled[0], pulled[1], hanging[2], hanging[3]]),
    depth, point(torso(false), [hanging[0], hanging[1], pulled[2], pulled[3]])], load);
}

function pulseRow(withTowel: boolean): Illustration {
  const low: Arms = [[168, 106], [165, 135], [148, 107], [143, 134]];
  const high: Arms = [[134, 83], [158, 100], [120, 85], [138, 102]];
  const down = point(hinge, low), top = point(hinge, high);
  const pulse = point(hinge, [[141, 86], [158, 106], [126, 89], [140, 109]]);
  return create(hinge, withTowel ? [down, top, top] : [down, top, pulse, top, pulse, top],
    withTowel ? [["digit", 4, 6, 6], ["line", 4, 6]] : [], [], 850);
}

function supportedRow(style: "door" | "sheet" | "slider" | "slide" | "straps" | "floor"): Illustration {
  const isFloor = style === "floor";
  const onFeet = style === "door" || style === "sheet";
  const noBar = style === "straps" || style === "sheet";
  const [x, y] = onFeet ? [196, 75] : isFloor ? [210, 120] : [130, 71];
  const grip: Pair = style === "door" ? [[209, 77], [180, 74]] : [[x + 9, y + 2], [x - 7, y - 1]];
  const at = (top: boolean): Point[] => {
    const shoulders: Point = onFeet ? top ? [166, 73] : [143, 78]
      : isFloor ? top ? [190, 139] : [148, 144] : top ? [133, 85] : [123, 114];
    const head: Point = plus(shoulders, onFeet ? [0, -16] : isFloor ? [16, -1] : [-16, -8]);
    const hips: Point = onFeet ? top ? [168, 113] : [157, 113]
      : isFloor ? top ? [142, 150] : [103, 151] : top ? [169, 115] : [170, 131];
    const legs: Body["legs"] = onFeet ? [[167, 132], [179, 155], [157, 134], [163, 155]]
      : isFloor ? [[98, top ? 128 : 114], [71, 156], [89, top ? 132 : 120], [64, 156]]
        : [[197, top ? 140 : 146], [top && !noBar ? 217 : 236, 155],
          [190, top ? 141 : 148], [top && !noBar ? 210 : 226, 157]];
    const hands: Pair = style === "straps" ? top ? [[145, 79], [132, 78]] : [[164, 65], [126, 64]] : grip;
    const elbowA: Point = top ? onFeet ? [177, 97] : isFloor ? [197, 156] : [119, 103] : mid(shoulders, hands[0]);
    const elbowB: Point = top ? onFeet ? [160, 93] : isFloor ? [186, 154] : [107, 104] : mid(shoulders, hands[1]);
    return point({ torso: [head, shoulders, hips], legs }, [elbowA, hands[0], elbowB, hands[1]]);
  };
  const structure: Props = onFeet ? [[180, 37, 180, 156], [209, 37, 209, 156], [180, 37, 209, 37], [173, 156, 216, 156]]
    : isFloor ? [[224, 75, 224, 155], [215, 155, 238, 155], [217, 119, 231, 119]]
      : style === "straps" ? [[92, 25, 187, 25], [177, 25, 177, 155], [102, 25, 102, 155]]
        : [[89, 70, 186, 70], [96, 70, 96, 155], [180, 70, 180, 155]];
  const loading: Gear = style === "sheet" ? [["digit", 4, 6, 6], ["line", 4, 209, 75], ["line", 6, 209, 75]] :
    style === "floor" ? [["line", 4, 222, 120], ["line", 6, 222, 120]] :
      style === "straps" ? [["line", 4, 168, 25], ["line", 6, 116, 25], ["pad", 4, 0, 0], ["pad", 6, 0, 0]] :
        style === "slider" ? [["slider", 8, 0, 4], ["slider", 10, 0, 2]] : [];
  return create(standing, [at(false), at(true), at(true)], loading, structure);
}

function pendulum(): Illustration {
  const support: Props = [[187, 114, 225, 114], [193, 114, 193, 156], [217, 114, 217, 156]];
  const points: Point[] = [[166, 125], [193, 121], [165, 126], [144, 120], [167, 126], [158, 125],
    [150, 119], [165, 115], [177, 118], [166, 126]];
  return create(hinge, points.map((wrist, i) => {
    const [head, neck, hip] = hinge.torso;
    const body: Body = { ...hinge, torso: [plus(head, [i % 2 * 3, 0]), plus(neck, [i % 2 * 2, 0]), hip] };
    const activeElbow = mid(neck, wrist);
    return point(body, [activeElbow, wrist, [182, 97], [199, 113]]);
  }), [], support, 810);
}

function supineSweep(): Illustration {
  const body: Body = { torso: [[92, 86], [114, 86], [171, 86]],
    legs: [[195, 79], [221, 80], [195, 94], [221, 94]], props: [[45, 23, 245, 23], [245, 23, 245, 148],
      [245, 148, 45, 148], [45, 148, 45, 23]] };
  const joint = (x: number, y: number): Arms => [[114 - x * .45, 86 + y * .52], [114 - x, 86 + y],
    [114 - x * .45, 86 - y * .52], [114 - x, 86 - y]];
  const frames = [joint(0, 48), joint(32, 42), joint(54, 17), joint(54, 17), joint(32, 42)];
  return { ...create(body, frames.map((arms) => point(body, arms))), topView: true };
}

function shoulderPlane(kind: "abduct" | "adduct" | "horizontal-back" | "horizontal-out" | "horizontal-cross" | "horizontal-front" | "band"): Illustration {
  const open: Point = [204, 62], forward: Point = [179, 66], cross: Point = [132, 67];
  const down: Point = [172, 110];
  const behind: Point = [193, 55];
  const band = kind === "band";
  const armAt = (wrist: Point): Point[] => point(standing, [mid(standing.torso[1], wrist), wrist, ...free]);
  const points: Point[] = kind === "abduct" ? [down, [185, 83], open] : kind === "adduct" ? [open, [185, 83], down] :
    kind === "horizontal-back" ? [forward, open, behind, open] : kind === "horizontal-out" ? [forward, [191, 65], open] :
      kind === "horizontal-cross" ? [open, forward, cross, forward] : kind === "horizontal-front" ? [open, [197, 65], forward] :
        [[194, 31], [203, 71], down, down];
  return create(standing, points.map(armAt), band ? [["band", 4, 168, 18], ["pad", 4, 0, 0]] : [],
    band ? [[165, 18, 205, 18], [204, 18, 204, 157], [196, 157, 218, 157]] : []);
}

function exerciseArcs(kind: "fast" | "fling" | "alternate" | "both" | "throw" | "complex"): Illustration {
  const armDown: Arms = [[166, 88], [170, 109], [140, 88], [135, 109]];
  const wide: Arms = [[179, 62], [202, 62], [126, 62], [103, 62]];
  const front: Arms = [[177, 66], [198, 69], [166, 66], [182, 68]];
  const overA: Arms = [[176, 82], [172, 61], [130, 82], [133, 61]];
  const overB: Arms = [[173, 38], [173, 12], [133, 38], [132, 12]];
  const reach: Arms = [[167, 57], [136, 67], [143, 61], [168, 70]];
  const make = (arms: Arms) => point(standing, arms);
  if (kind === "complex") {
    const path = [armDown, wide, armDown, wide, armDown, front, armDown, front, armDown, overA, overB, overA, overB, overA];
    return create(standing, path.map(make), dumbbells, [], 750);
  }
  if (kind === "fast" || kind === "fling") return create(standing, (kind === "fast"
    ? [reach, wide, reach, wide] : [front, wide, reach, wide]).map(make), [], [], kind === "fast" ? 540 : 900);
  const circle = (angle: number, width: number, elevation: number, which = 1): Point =>
    [153 + which * (width + Math.cos(angle) * 14), 62 + Math.sin(angle) * elevation];
  const armPoint = (wrist: Point, sign: number): Pair => [mid([153 + sign * 9, 62], wrist), wrist];
  if (kind === "both") {
    const angles = [0, .5, 1, 1.5, 2, 1.5, 1, .5].map((n) => n * Math.PI);
    return create(standing, angles.map((angle) => make([...armPoint(circle(angle, 38, 24), 1),
      ...armPoint(circle(angle, 38, 24, -1), -1)])), [], [], 720);
  }
  const sweep = (side: number, mirrorOrder: boolean): Point[][] => {
    const path: Point[] = kind === "throw" ? [[172, 110], [201, 77], [181, 31], [134, 37], [172, 110]] :
      [[170, 109], [198, 84], [184, 40], [155, 11], [128, 51], [151, 98], [170, 109]];
    const phases = mirrorOrder ? path.toReversed() : path;
    return phases.map(([x, y]) => {
      const end: Point = [153 + (x - 153) * side, y];
      const body: Body = kind === "throw" ? { ...standing, torso: [plus(standing.torso[0], [side * 5, 0]),
        plus(standing.torso[1], [side * 4, 0]), standing.torso[2]] } : standing;
      return point(body, side === 1 ? [...armPoint(end, 1), armDown[2], armDown[3]]
        : [armDown[0], armDown[1], ...armPoint(end, -1)]);
    });
  };
  return create(standing, [...sweep(1, false), ...sweep(-1, false), ...(kind === "alternate" ? [...sweep(1, true), ...sweep(-1, true)] : [])],
    [], [], kind === "throw" ? 740 : 610);
}

function chairTaps(): Illustration {
  const chair = { ...seated, props: [...seat, [105, 67, 105, 119]] as Props };
  const neutral: Arms = [[140, 95], [145, 112], [109, 94], [111, 111]];
  const a: Arms = [[153, 91], [115, 72], neutral[2], neutral[3]];
  const b: Arms = [neutral[0], neutral[1], [117, 91], [136, 72]];
  const origin = point(chair, neutral);
  return create(chair, [origin, point(chair, a), origin, point(chair, b)]);
}

function postureCheck(): Illustration {
  const raw = (left: number, right: number) => {
    const resting: Arms = [[168, 87 + left], [170, 113 + left], [137, 87 + right], [134, 112 + right]];
    return [...point(standing, resting), [164, 63 + left], [143, 63 + right]] as Point[];
  };
  const neutral = raw(0, 0), roll = raw(-6, 4), release = raw(3, -3);
  const stages = [neutral, roll, release, neutral, neutral];
  const reflected = (p: Point[]): Point[] => p.slice(0, 11).map(([x, y]) => [222 - (x - 153) * .41, 49 + y * .51]);
  return { ...create(standing, stages, [["line", 11, 12]],
    [[188, 45, 256, 45], [256, 45, 256, 148], [256, 148, 188, 148], [188, 148, 188, 45]], 1100),
  shoulders: [11, 12], partnerFrames: stages.map(reflected) };
}

function cableLatPushdown(): Illustration {
  const low: Arms = [[198, 70], [226, 70], [189, 73], [217, 72]];
  const finish: Arms = [[161, 95], [145, 121], [148, 96], [133, 123]];
  const gear: Gear = [["cable", 11, 245, 22], ["line", 4, 11], ["line", 6, 11], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
  const at = (arms: Arms) => [...point(hinge, arms), plus(mid(arms[1], arms[3]), [10, -7])];
  return create(hinge, [at(low), at(finish), at(finish)], gear, tower(245, 22));
}

function thumbIsometric(): Illustration {
  const hidden: Point[] = Array.from({ length: 11 }, () => [-45, -45] as Point);
  const move = (open: boolean): Point[] => [...hidden, [150, 136], [151, 108], [150, 92],
    [147, 66], [147, 43], [157, 68], [162, 46], [138, 69], [135, 48],
    [130, 76], [123, 62], [164, 103], open ? [186, 87] : [174, 80], open ? [198, 75] : [177, 64],
    [156, 84]];
  const high = move(true);
  return { ...create(standing, [move(false), high, high, high, high], [
    ["digit", 11, 12, 16], ["digit", 12, 13, 26], ["digit", 13, 14, 8], ["digit", 14, 15, 5],
    ["digit", 13, 16, 8], ["digit", 16, 17, 5], ["digit", 13, 18, 8], ["digit", 18, 19, 5],
    ["digit", 13, 20, 7], ["digit", 20, 21, 5], ["digit", 12, 22, 9], ["digit", 22, 23, 7],
    ["digit", 23, 24, 5], ["band", 23, 25], ["band", 25, 24],
  ], [[86, 117, 224, 117], [86, 117, 86, 151], [224, 117, 224, 151]], 1250), topView: true };
}

function rowBackCheck(): Illustration {
  const shiftBody = (initial: Point[], x: number) => initial.map((p) => plus(p, [x, 0]));
  const good = [point(hinge, hanging), point(hinge, pulled)].map((p) => shiftBody(p, 62));
  const faulty: Body = { ...hinge, torso: [[195, 78], [180, 84], [128, 111]] };
  const base = [point(faulty, hanging), point(faulty, pulled)].map((p) => shiftBody(p, -70));
  const markers: Point[] = [[74, 25], [87, 34], [87, 25], [74, 34], [213, 29], [219, 34], [231, 22]];
  return { ...create(standing, base.map((p, i) => [...p, [91, 90], [108, 84], good[i][4], good[i][6], ...markers]),
    [["bar", 4, 6], ["barbell-end", 4, 7, 0], ["barbell-end", 6, -7, 0],
      ["bar", 13, 14], ["barbell-end", 13, 7, 0], ["barbell-end", 14, -7, 0],
      ["digit", 15, 16, 3], ["digit", 17, 18, 3], ["digit", 19, 20, 3], ["digit", 20, 21, 3]]),
  partnerFrames: good, spine: [12, 11] };
}

const plateHighRow = leverSeat("high");
export const upperPullMobilityIllustrations: Readonly<Record<string, Illustration>> = {
  "2343": rowBackCheck(),
  "3828": pulseRow(true),
  "6438": pendulum(),
  "3506": supportedRow("door"),
  "9875": twistedRow(true),
  "2325": forearmRotate(false),
  "5606": cycles(prone, [[170, 101], [176, 129], [153, 103], [159, 129]],
    [[186, 68], [209, 70], [140, 66], [113, 68]], dumbbells),
  "10196": exerciseArcs("complex"),
  "4769": supportedRow("slide"),
  "4974": supportedRow("slider"),
  "4911": supportedRow("straps"),
  "5867": twistedRow(false),
  "2662": plateHighRow,
  "2663": plateHighRow,
  "3495": supportedRow("floor"),
  "3413": supineSweep(),
  "3822": pulseRow(false),
  "3746": supportedRow("sheet"),
  "6437": shoulderPlane("band"),
  "8652": chairTaps(),
  "2775": shoulderPlane("abduct"),
  "2776": shoulderPlane("adduct"),
  "6792": postureCheck(),
  "2781": shoulderPlane("horizontal-back"),
  "2782": shoulderPlane("horizontal-cross"),
  "2783": shoulderPlane("horizontal-out"),
  "2784": shoulderPlane("horizontal-front"),
  "1229": cableLatPushdown(),
  "6267": forearmRotate(true),
  "3588": exerciseArcs("fast"),
  "9996": thumbIsometric(),
  "3259": exerciseArcs("alternate"),
  "3258": exerciseArcs("both"),
  "3260": exerciseArcs("fling"),
  "4942": exerciseArcs("throw"),
};
