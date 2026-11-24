import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Support = "floor" | "ab-mat" | "bench" | "decline" | "steep" | "incline" | "chair"
  | "legs-bench" | "legs-ball" | "wall" | "bosu" | "stability-ball" | "ghd" | "roman-chair"
  | "straps" | "lever-lying" | "lever-decline";
type Grasp = "temples" | "chest" | "reach" | "ears" | "up" | "press" | "hand-knee" | "hips" | "sweep" | "up-reach" | "toes";
type Load = "dumbbell" | "bell" | "medicine" | "plate" | "bottle" | "ez" | "band";
type Legs = "bent" | "straight" | "up" | "up-bent" | "raise" | "single" | "frog" | "tuck" | "scissors" | "cross-scissors" | "extend";

const standardFoot: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function motion(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 790): Illustration {
  return { frames, props, dynamic: [...standardFoot, ...attachments], reference: true, ms };
}

function frame(head: Point, shoulder: Point, hips: Point, arms: [Limb, Limb], legs: [Limb, Limb], toes: [Point, Point]) {
  return [head, shoulder, hips, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

const equipment: Partial<Record<Support, Props>> = {
  "ab-mat": [[116, 155, 130, 148], [130, 148, 144, 148], [144, 148, 151, 155], [116, 155, 151, 155]],
  bench: [[76, 121, 221, 121], [88, 121, 88, 157], [211, 121, 211, 157], [82, 158, 95, 158], [203, 158, 217, 158]],
  decline: [[76, 144, 207, 103], [87, 142, 87, 157], [192, 108, 192, 158], [193, 105, 208, 98], [204, 98, 222, 98]],
  steep: [[83, 148, 198, 88], [91, 145, 91, 159], [195, 89, 195, 157], [190, 89, 203, 83], [202, 80, 218, 80]],
  incline: [[79, 103, 207, 139], [85, 104, 85, 159], [202, 140, 202, 159], [196, 138, 210, 144], [206, 144, 226, 143]],
  chair: [[177, 119, 223, 119], [177, 120, 177, 158], [218, 120, 218, 158], [223, 119, 223, 81]],
  "legs-bench": [[176, 118, 226, 118], [179, 119, 179, 158], [217, 119, 217, 158]],
  wall: [[213, 58, 213, 159], [213, 158, 238, 158]],
  bosu: [[131, 157, 174, 157], [132, 156, 137, 143], [137, 143, 146, 137], [146, 137, 158, 137], [158, 137, 167, 143], [167, 143, 173, 156]],
  ghd: [[128, 122, 164, 122], [136, 124, 136, 158], [154, 124, 154, 158], [225, 112, 225, 157], [141, 149, 225, 149],
    [223, 113, 230, 113], [216, 104, 231, 104], [136, 158, 225, 158], [221, 99, 221, 116]],
  "roman-chair": [[134, 119, 164, 119], [141, 120, 141, 158], [209, 121, 209, 157], [141, 156, 209, 156],
    [197, 121, 220, 121], [210, 120, 210, 130]],
  straps: [[184, 36, 209, 36]],
  "lever-lying": [[94, 127, 188, 127], [104, 128, 104, 158], [170, 129, 170, 153], [107, 154, 218, 154],
    [215, 61, 215, 158], [218, 62, 218, 157], [204, 66, 228, 66], [214, 127, 176, 127]],
  "lever-decline": [[76, 145, 197, 107], [86, 144, 86, 158], [184, 111, 184, 158], [184, 107, 204, 97],
    [199, 97, 216, 97], [224, 100, 224, 158], [86, 158, 237, 158]],
};

function supportedHip(support: Support): Point {
  switch (support) {
    case "bench": return [147, 113];
    case "decline": case "lever-decline": return [153, 109];
    case "steep": return [156, 102];
    case "incline": return [154, 118];
    case "bosu": return [152, 132];
    case "stability-ball": return [152, 116];
    case "ab-mat": return [150, 142];
    case "ghd": case "roman-chair": return [149, 111];
    case "lever-lying": return [147, 118];
    default: return [143, 148];
  }
}

function pointsForLegs(support: Support, legs: Legs, [hipX, hipY]: Point, up: number, side: number): [Limb, Limb, [Point, Point]] {
  if (support === "ghd" || support === "roman-chair") {
    const ghd = support === "ghd";
    const ankle: Point = ghd ? [219, 108] : [207, 126];
    const near: Limb = [[184, ghd ? 106 : 113], ankle];
    const far: Limb = [[178, ghd ? 102 : 109], [ankle[0] - 4, ankle[1] - 3]];
    return [near, far, [[ankle[0] + 8, ankle[1] - 7], [ankle[0] + 4, ankle[1] - 10]]];
  }
  if (["decline", "steep", "incline", "lever-decline"].includes(support)) {
    const level = support === "incline" ? 132 : support === "steep" ? 86 : 102;
    return [[[185, level - 22], [205, level + 3]], [[181, level - 25], [201, level + 1]], [[214, level - 4], [210, level - 6]]];
  }
  if (["legs-bench", "chair", "legs-ball", "wall", "straps"].includes(support)) {
    const level = support === "legs-ball" ? 118 : support === "wall" ? 98 : support === "straps" ? 117 : 113;
    const ankle: Point = [support === "wall" ? 205 : 201, level];
    const other: Point = [ankle[0] - 7, ankle[1] - 2];
    const knee: Point = [154, level - 2];
    return [[knee, ankle], [[knee[0] - 4, knee[1] - 4], other],
      [[support === "wall" ? 210 : 213, level - (support === "wall" ? 11 : 1)], [other[0] + 10, other[1] - 4]]];
  }
  const level = support === "bench" ? 117 : 154;
  const foot: Point = [207, level];
  const farFoot: Point = [199, level - 2];
  const bent: Limb = [[178, hipY - 28], foot];
  const farBent: Limb = [[170, hipY - 30], farFoot];
  let near = bent;
  let far = farBent;
  if (legs === "straight") {
    near = [[183, hipY + 1], foot];
    far = [[177, hipY - 2], farFoot];
  } else if (legs === "up" || legs === "raise") {
    const howFar = legs === "up" ? 1 : up;
    near = [[hipX + 33 - 27 * howFar, hipY - 7 - 28 * howFar], [hipX + 67 - 53 * howFar, hipY - 9 - 56 * howFar]];
    far = [[near[0][0] - 5, near[0][1] - 4], [near[1][0] - 5, near[1][1] - 4]];
  } else if (legs === "up-bent") {
    near = [[hipX + 12, hipY - 35], [hipX + 49, hipY - 35]];
    far = [[hipX + 6, hipY - 41], [hipX + 45, hipY - 42]];
  } else if (legs === "frog") {
    near = [[182 - up * 8, hipY + 3 - up * 15], [206 - up * 6, level - up * 23]];
    far = [[176 - up * 8, hipY - 24 - up * 14], [203 - up * 6, level - 3 - up * 23]];
  } else if (legs === "tuck" || legs === "extend") {
    const tuck = legs === "extend" ? 1 - up : up;
    near = [[182 - 32 * tuck, hipY - 8 - 34 * tuck], [213 - 13 * tuck, hipY - 8 - 13 * tuck]];
    far = [[near[0][0] - 5, near[0][1] - 4], [near[1][0] - 6, near[1][1] - 4]];
  } else if (legs === "single") {
    near = side < 0 ? bent : [[188 - 18 * up, hipY - 8 - 20 * up], [217 - 13 * up, hipY - 8 - 27 * up]];
    far = side < 0 ? [[183 - 18 * up, hipY - 10 - 20 * up], [211 - 13 * up, hipY - 9 - 27 * up]] : farBent;
  } else if (legs === "scissors" || legs === "cross-scissors") {
    const span = legs === "scissors" ? 19 : 7;
    const cross = legs === "cross-scissors" ? side * 8 : 0;
    near = [[181 + cross / 2, hipY - 17 - side * span / 2], [214 + cross, hipY - 20 - side * span]];
    far = [[176 - cross / 2, hipY - 19 + side * span / 2], [209 - cross, hipY - 22 + side * span]];
  }
  return [near, far, [[near[1][0] + 12, Math.min(158, near[1][1] + 1)], [far[1][0] + 11, Math.min(157, far[1][1] + 1)]]];
}

function handPositions(grasp: Grasp, head: Point, shoulder: Point, up: number, side: number, nearKnee: Point, farKnee: Point): [Limb, Limb] {
  const [sx, sy] = shoulder;
  const [hx, hy] = head;
  const elbows: [Limb, Limb] = [[[sx + 13 + side * 11, sy - 17 + up * 10], [hx + 4, hy - 1]],
    [[sx + 8 - side * 11, sy - 20 + up * 9], [hx - 3, hy - 2]]];
  switch (grasp) {
    case "chest": return [[[sx + 22, sy + 4], [sx + 12, sy - 7]], [[sx + 18, sy + 6], [sx + 8, sy - 9]]];
    case "reach": return [[[sx + 23, sy - 4 + up * 10], [sx + 51 + side * 7, sy - 7 + up * 17]],
      [[sx + 20, sy - 9 + up * 10], [sx + 47 + side * 5, sy - 12 + up * 17]]];
    case "ears": return [[[hx - 11 + up * 10, hy - 7 - up * 9], [hx - 30 + up * 23, hy - 14 - up * 14]],
      [[hx - 13 + up * 10, hy - 10 - up * 9], [hx - 33 + up * 23, hy - 17 - up * 14]]];
    case "up": return [[[sx + side * 8 + 3, sy - 20], [sx + side * 14 + 7, sy - 43]],
      [[sx + side * 8 - 3, sy - 22], [sx + side * 14 + 2, sy - 45]]];
    case "toes": return [[[sx + 9 + up * 8, sy - 16], [sx + 15 + up * 18, sy - 37 + up * 8]],
      [[sx + 6 + up * 7, sy - 18], [sx + 11 + up * 17, sy - 40 + up * 8]]];
    case "hand-knee": {
      if (!up) return elbows;
      const knee = side > 0 ? nearKnee : farKnee;
      const reach: Limb = [[(sx + knee[0]) / 2, (sy + knee[1]) / 2 - 4], [knee[0] - 4, knee[1] - 3]];
      return side > 0 ? [elbows[0], reach] : [reach, elbows[1]];
    }
    case "hips": return [[[sx + 18, sy + 2], [sx + 32, sy + 7]], [[sx + 14, sy + 5], [sx + 26, sy + 10]]];
    default: return elbows;
  }
}

const weightProps: Partial<Record<Load, Attachments>> = {
  dumbbell: [["dumbbell", 4, 1, -1]], bell: [["kettlebell", 4, 1, -1]], medicine: [["ball", 4, 1, -2]],
  plate: [["plate", 4, 0, -2]], bottle: [["bottle", 4, 1, -2]], ez: [["ez-bar", 4, 6]],
  band: [["band", 4, 63, 137], ["band", 6, 63, 137]],
};

type CurlOptions = {
  support?: Support;
  hands?: Grasp;
  legs?: Legs;
  load?: Load;
  full?: boolean;
  twist?: boolean;
  hold?: boolean;
  range?: "deep" | "standard";
  sequence?: "press" | "top-twist" | "frog-half" | "single-overhead";
};

function supineCurl({
  support = "floor", hands = "temples", legs = "bent", load, full = false, twist = false, hold = false, range,
  sequence,
}: CurlOptions = {}) {
  const hip = supportedHip(support);
  const props: Props = [...(equipment[support] ?? [])];
  if (load === "band") props.push([62, 105, 62, 158], [55, 158, 70, 158]);
  const build = (up: number, side = 0, phase: "normal" | "press" = "normal"): Point[] => {
    const benchSlope = support === "decline" || support === "lever-decline" ? 11 : support === "steep" ? 19 : support === "incline" ? -11
      : support === "ghd" ? range === "deep" ? 17 : 3 : range === "deep" ? 5 : 0;
    const lifted = up * (full ? 29 : 20);
    const [hipX, hipY] = hip;
    const xOffset = (full ? hands === "toes" ? 29 : 36 : 13) * up;
    const shoulder: Point = [hipX - 35 + xOffset + side * 5, hipY - 4 + benchSlope * (1 - up) - lifted];
    const head: Point = [shoulder[0] - 15 + up * (full ? 15 : 7), shoulder[1] - 2 - up * 9];
    const [near, far, toes] = pointsForLegs(support, legs, hip, up, side);
    const mode = phase === "press" ? "up" : hands === "press" ? "chest" : hands === "sweep" ? up ? "reach" : "ears"
      : hands === "up-reach" ? up ? "reach" : "up" : hands;
    const arms = handPositions(mode, head, shoulder, up, side, near[0], far[0]);
    if (sequence === "single-overhead") arms[1] = [[shoulder[0] + 12, shoulder[1] + 15], [shoulder[0] + 24, shoulder[1] + 26]];
    const figure = frame(head, shoulder, hip, arms, [near, far], toes);
    return [...figure, [143, 121], [186, 135], [224, 111], [arms[0][1][0] + 8, arms[0][1][1]],
      [arms[1][1][0] - 8, arms[1][1][1]]];
  };
  const start = build(0), peak = build(1);
  let frames = [start, peak];
  if (twist || legs === "single") frames = [start, build(1, 1), start, build(1, -1)];
  if (legs === "scissors" || legs === "cross-scissors") frames = [peak, build(1, 1), peak, build(1, -1)];
  if (sequence === "top-twist") frames = [start, peak, build(1, 1), peak, build(1, -1), peak];
  if (sequence === "press") frames = [start, build(1, twist ? 1 : 0), peak, build(1, 0, "press"), peak];
  if (sequence === "frog-half") frames = [peak, build(0.5), build(0.5), start, peak];
  if (hold) frames = [start, peak, peak, peak];
  const attachments: Attachments = load ? [...(weightProps[load] ?? [])] : [];
  if (load === "ez") attachments.push(["barbell-end", 16, 4, 0], ["barbell-end", 17, -4, 0]);
  if (support === "stability-ball") attachments.push(["stability-ball", 13, 0, 20]);
  if (support === "legs-ball") attachments.push(["stability-ball", 14, 0, 2]);
  if (support === "straps") attachments.push(["line", 8, 204, 36], ["line", 10, 192, 36], ["ring", 8, 0, 2], ["ring", 10, 0, 2]);
  if (support === "lever-lying") attachments.push(["line", 4, 215, 94], ["pad", 4, 1, -1]);
  if (support === "lever-decline") attachments.push(["line", 4, 224, 103], ["barbell-end", 15, 4, -11]);
  return motion(frames, props, attachments);
}

function kneelingCrunch(kind: "cable" | "band" | "side" | "band-side" | "standing-band") {
  const standing = kind === "standing-band";
  const side = kind === "side" || kind === "band-side";
  const props: Props = [[211, 31, 211, 156], [194, 157, 232, 157]];
  const cable = kind === "cable" || kind === "side";
  if (cable) props.push([219, 31, 219, 152], [205, 35, 219, 35], [212, 133, 219, 133]);
  const make = (inward: boolean) => {
    const hip: Point = standing ? [153, 92] : [155, 112];
    const shoulder: Point = inward ? side ? [135, 91] : [178, standing ? 79 : 110] : [155, standing ? 51 : 73];
    const head: Point = inward ? [shoulder[0] + (side ? -11 : 13), shoulder[1] - 1] : [159, shoulder[1] - 14];
    const hands: [Limb, Limb] = side
      ? [[[shoulder[0] + 16, shoulder[1] + 19], [head[0] + 8, head[1] + 2]], [[shoulder[0] - 12, shoulder[1] + 17], [145, 111]]]
      : [[[shoulder[0] + 14, shoulder[1] + 17], [head[0] + 2, head[1] - 4]], [[shoulder[0] + 8, shoulder[1] + 12], [head[0] - 3, head[1] - 5]]];
    const legs: [Limb, Limb] = side ? [[[168, 151], [156, 153]], [[147, 150], [135, 152]]] : standing
      ? [[[150, 124], [147, 152]], [[158, 121], [157, 150]]]
      : [[[171, 150], [131, 153]], [[167, 147], [129, 149]]];
    return frame(head, shoulder, hip, hands, legs, side ? [[150, 156], [129, 156]]
      : standing ? [[160, 156], [169, 155]] : [[122, 157], [121, 154]]);
  };
  const attachment = cable ? "cable" : "band";
  return motion([make(false), make(true)], props, side ? [[attachment, 4, 208, 35]] : [[attachment, 4, 208, 35], [attachment, 6, 208, 35]]);
}

function reverseCurl(kind: "floor" | "bench-circle" | "band" | "kick" | "dead-bug" | "straps") {
  const onBench = kind === "bench-circle";
  const base = onBench ? 113 : 147;
  const make = (up: number, turn = 0, long = false): Point[] => {
    const shoulder: Point = [103, base];
    const hip: Point = [146 - up * 9, base - up * 16];
    const head: Point = [86, base - 1];
    let arms: [Limb, Limb] = [[[125, base + 3], [151, base + 4]], [[117, base + 3], [141, base + 3]]];
    if (onBench) arms = [[[89, base - 14], [78, base + 1]], [[84, base - 15], [75, base - 2]]];
    if (kind === "band") arms = [[[83, base - 10], [68, base - 4]], [[84, base - 15], [66, base - 8]]];
    if (kind === "dead-bug" && long) arms[turn < 0 ? 0 : 1] = [[85, base - 8], [64, base - 12]];
    if (kind === "dead-bug" && !long) arms = [[[109, base - 20], [113, base - 36]], [[104, base - 21], [105, base - 38]]];
    const knee: Point = [153 - up * (18 - turn * 5), base - 35 - up * (12 + turn * 5)];
    const ankle: Point = [189 - up * (20 - turn * 3), base - 36 - up * (7 + turn * 4)];
    let near: Limb = [knee, ankle];
    let far: Limb = [[knee[0] - 6, knee[1] - 5], [ankle[0] - 6, ankle[1] - 4]];
    if (kind === "kick" && long) {
      near = [[145, base - 48], [146, base - 82]];
      far = [[140, base - 51], [140, base - 85]];
    }
    if (kind === "dead-bug" && long) {
      if (turn > 0) near = [[183, base - 7], [210, base - 9]];
      else far = [[179, base - 10], [206, base - 12]];
    }
    if (kind === "straps") {
      near = [knee, [185 - up * 11, base - 36 - up * 5]];
      far = [[knee[0] - 5, knee[1] - 4], [179 - up * 11, base - 39 - up * 5]];
    }
    return frame(head, shoulder, hip, arms, [near, far],
      [[near[1][0] + (long && kind === "kick" ? 3 : 10), near[1][1] - 2], [far[1][0] + 8, far[1][1] - 3]]);
  };
  const start = make(0), top = make(1);
  let frames = [start, top];
  if (onBench) frames = [start, make(0.65, -1), top, make(0.65, 1), start, make(0.65, 1), top, make(0.65, -1)];
  if (kind === "kick") frames = [start, top, make(1, 0, true), top];
  if (kind === "dead-bug") frames = [start, top, start, make(0, 1, true), start, top, start, make(0, -1, true)];
  return motion(frames, onBench ? equipment.bench : kind === "band" ? [[58, 108, 58, 158], [48, 158, 70, 158]]
    : kind === "straps" ? equipment.straps : [], kind === "band" ? [["band", 4, 58, 140], ["band", 6, 58, 140]]
      : kind === "straps" ? [["line", 8, 203, 36], ["line", 10, 190, 36], ["ring", 8, 0, 3], ["ring", 10, 0, 3]] : []);
}

function sideCurl(kind: "knees-down" | "side" | "braced" | "chest" | "long" | "weighted") {
  const kneesFixed = kind === "knees-down" || kind === "long" || kind === "weighted";
  const make = (up: boolean) => {
    const shoulder: Point = up ? [120, 126] : [109, 147];
    const head: Point = [shoulder[0] - 13, shoulder[1] - (up ? 10 : 3)];
    const hip: Point = [147, 148];
    const elbow: Limb = [[shoulder[0] + (up ? 16 : 9), shoulder[1] - 12], [head[0] + 5, head[1] - 3]];
    const hands: [Limb, Limb] = kind === "chest" ? handPositions("chest", head, shoulder, Number(up), 0, [0, 0], [0, 0])
      : kind === "braced" ? [elbow, [[117, 153], [134, 154]]]
      : kind === "long" ? [elbow, [[95, 149], [73, 148]]]
      : kind === "weighted" ? [[[shoulder[0] + 21, shoulder[1] + 4], [shoulder[0] + 10, shoulder[1] - 5]], elbow]
      : [elbow, [[shoulder[0] + 4, shoulder[1] + 1], [head[0] - 1, head[1] + 2]]];
    const lift = !kneesFixed && up ? 12 : 0;
    return frame(head, shoulder, hip, hands, [[[177 - lift, 135 - lift], [200 - lift, 153 - lift]], [[174 - lift, 133 - lift], [196 - lift, 151 - lift]]],
      [[210 - lift, 153 - lift], [206 - lift, 151 - lift]]);
  };
  return motion([make(false), make(true)], [], kind === "weighted" ? [["plate", 4, 0, -3]] : []);
}

function standingCross(sideways: boolean) {
  const make = (side: number) => {
    const shoulder: Point = [147 + side * (sideways ? 12 : 5), 57 + Math.abs(side) * 9];
    const head: Point = [shoulder[0] + side * 4, shoulder[1] - 15];
    const crossing = sideways ? side : -side;
    const arms: [Limb, Limb] = [
      [[shoulder[0] + (crossing > 0 ? 12 : 23), shoulder[1] + (crossing > 0 ? 22 : -6)], [head[0] + 8, head[1] + 3]],
      [[shoulder[0] - (crossing < 0 ? 12 : 23), shoulder[1] + (crossing < 0 ? 22 : -7)], [head[0] - 7, head[1] + 2]],
    ];
    const near: Limb = side > 0 ? [[sideways ? 181 : 155, 98], [165, 126]] : [[161, 122], [161, 152]];
    const far: Limb = side < 0 ? [[sideways ? 114 : 140, 98], [132, 127]] : [[134, 122], [134, 152]];
    return frame(head, shoulder, [147, 94], arms, [near, far],
      [[near[1][0] + 9, near[1][1] + 5], [far[1][0] - 9, far[1][1] + 5]]);
  };
  const base = make(0);
  return motion([base, make(1), base, make(-1)]);
}

function seatedTuck(kind: "weighted" | "dumbbell" | "dumbbell-twist" | "alternate" | "side-sweep" | "figure-eight" | "bosu") {
  const brace = kind === "side-sweep" || kind === "figure-eight";
  const onBosu = kind === "bosu";
  const hip: Point = onBosu ? [151, 132] : [147, 148];
  const make = (inward: boolean, side = 0, step = 0) => {
    const shoulder: Point = [hip[0] - (inward ? 20 : 34) + side * 4, hip[1] - (inward ? 28 : 21)];
    const head: Point = [shoulder[0] - (inward ? 4 : 8), shoulder[1] - 14];
    const arms: [Limb, Limb] = brace ? [[[102, 142], [96, 152]], [[94, 141], [88, 150]]]
      : handPositions(kind === "alternate" ? "temples" : onBosu ? "reach" : "chest", head, shoulder, Number(inward), side, [0, 0], [0, 0]);
    const ankle: Point = [hip[0] + (inward ? 48 : 76) + side * 6, hip[1] - (inward ? 16 : 8) + step];
    const legs: [Limb, Limb] = [
      [[hip[0] + (inward ? 18 : 39) - side * 4, hip[1] - (inward ? 38 : 6) + step / 3], ankle],
      [[hip[0] + (inward && kind !== "alternate" ? 13 : 32) + side * 3, hip[1] - (inward && kind !== "alternate" ? 41 : 9) + step / 3], [ankle[0] + (inward && kind === "alternate" ? 21 : -5), ankle[1] - 5]],
    ];
    if (kind === "alternate" && side < 0) legs.reverse();
    return frame(head, shoulder, hip, arms, legs,
      [[legs[0][1][0] + 10, legs[0][1][1] + 1], [legs[1][1][0] + 10, legs[1][1][1] + 1]]);
  };
  const start = make(false);
  const frames = kind === "figure-eight" ? [start, make(false, 1, -10), make(false, 2, -18), make(false, 2, 0), start,
    make(false, -1, -10), make(false, -2, -18), make(false, -2, 0)]
    : kind === "dumbbell-twist" || kind === "alternate" || kind === "side-sweep" ? [start, make(true, 1), start, make(true, -1)] : [start, make(true)];
  return motion(frames, onBosu ? equipment.bosu : [], brace || kind === "alternate" ? []
    : kind === "weighted" || onBosu ? [["plate", 4, 0, -2]] : [["dumbbell", 4, 0, -2]]);
}

export const coreIllustrations: Record<string, Illustration> = {
  "6555": supineCurl({ support: "ab-mat", hands: "chest", full: true }),
  "5266": supineCurl({ legs: "up-bent", twist: true }),
  "0021": supineCurl({ support: "stability-ball", hands: "chest", full: true }),
  "1498": supineCurl({ support: "decline", hands: "chest", load: "band", full: true }),
  "6053": supineCurl({ legs: "frog", hands: "chest", load: "bottle" }),
  "6052": supineCurl({ hands: "ears", load: "bottle" }),
  "0263": supineCurl({ twist: true }),
  "3951": supineCurl({ full: true, twist: true }),
  "5334": supineCurl({ full: true, twist: true }),
  "4727": supineCurl({ hands: "chest" }),
  "3821": supineCurl({ hands: "reach" }),
  "0268": supineCurl({ legs: "up" }),
  "0269": supineCurl({ support: "legs-ball", hands: "chest" }),
  "3838": supineCurl({ support: "bench" }),
  "1242": supineCurl({ support: "bosu" }),
  "0273": supineCurl({ legs: "up", hands: "toes" }),
  "7414": supineCurl({ support: "wall" }),
  "4332": supineCurl({ hold: true }),
  "4331": supineCurl({ legs: "single" }),
  "4095": supineCurl({ legs: "raise" }),
  "0281": supineCurl({ support: "decline", hands: "reach", full: true }),
  "4972": supineCurl({ support: "decline", hands: "chest", full: true, sequence: "top-twist" }),
  "5515": supineCurl({ support: "decline", hands: "chest", full: true }),
  "2523": supineCurl({ support: "decline", full: true, twist: true }),
  "4624": supineCurl({ hands: "chest", load: "dumbbell" }),
  "4734": supineCurl({ support: "decline", hands: "ears", full: true, load: "dumbbell" }),
  "4735": supineCurl({ support: "decline", hands: "chest", full: true, load: "dumbbell" }),
  "4748": supineCurl({ hands: "ears", full: true, load: "dumbbell" }),
  "6809": supineCurl({ support: "legs-bench", hands: "up", full: true, load: "dumbbell" }),
  "4625": supineCurl({ hands: "press", load: "dumbbell", full: true, sequence: "press", twist: true }),
  "4756": supineCurl({ hands: "chest", full: true, load: "dumbbell" }),
  "4248": supineCurl({ hands: "up", load: "dumbbell" }),
  "6144": supineCurl({ hands: "up", load: "dumbbell" }),
  "4251": supineCurl({ hands: "up", full: true, sequence: "top-twist", load: "dumbbell" }),
  "10873": supineCurl({ hands: "ears", load: "dumbbell" }),
  "3484": supineCurl({ full: true, twist: true }),
  "2469": supineCurl({ support: "stability-ball", legs: "frog" }),
  "1864": supineCurl({ support: "steep", hands: "chest", full: true }),
  "5308": supineCurl({ hands: "up", full: true, sequence: "top-twist", load: "ez" }),
  "3279": supineCurl({ support: "legs-bench" }),
  "3280": supineCurl({ support: "legs-bench", twist: true }),
  "3889": supineCurl({ legs: "frog", hands: "reach", full: true }),
  "10639": supineCurl({ support: "ghd", hands: "chest", full: true, range: "deep" }),
  "4763": supineCurl({ support: "ghd", hands: "chest", full: true, sequence: "top-twist" }),
  "11282": supineCurl({ support: "ghd", hands: "ears", full: true }),
  "6554": supineCurl({ support: "ghd", hands: "chest", full: true }),
  "0470": supineCurl({ hands: "hand-knee", legs: "single", twist: true }),
  "1190": supineCurl({ support: "incline", full: true, twist: true }),
  "4535": supineCurl({ hands: "up", full: true, sequence: "single-overhead", load: "bell" }),
  "1187": supineCurl({ hands: "chest", full: true, load: "bell" }),
  "5072": supineCurl({ hands: "press", full: true, sequence: "press", load: "bell" }),
  "4990": supineCurl({ legs: "single", twist: true }),
  "1858": supineCurl({ support: "lever-decline", hands: "chest", full: true }),
  "2276": supineCurl({ support: "lever-lying", hands: "temples" }),
  "2314": supineCurl({ support: "lever-lying", hands: "temples" }),
  "4009": supineCurl({ hands: "ears" }),
  "4906": supineCurl({ support: "decline", hands: "ears", full: true }),
  "9024": supineCurl({ legs: "scissors" }),
  "6005": supineCurl({ legs: "straight" }),
  "6752": supineCurl({ hands: "hips" }),
  "0621": supineCurl({ legs: "cross-scissors" }),
  "5274": supineCurl({ legs: "tuck" }),
  "3422": supineCurl({ hands: "chest", load: "medicine" }),
  "9010": supineCurl({ support: "stability-ball", hands: "chest", load: "medicine" }),
  "4253": supineCurl({ hands: "reach", load: "medicine" }),
  "5228": supineCurl({ support: "bosu", range: "deep" }),
  "3330": supineCurl({ legs: "up-bent", twist: true }),
  "3331": supineCurl({ legs: "up", twist: true }),
  "4992": supineCurl({ legs: "single", twist: true }),
  "7417": supineCurl({ support: "legs-bench", hands: "ears", full: true }),
  "3329": supineCurl({ support: "roman-chair", hands: "chest", full: true }),
  "3942": supineCurl({ support: "chair", hands: "chest", full: true }),
  "7255": supineCurl({ legs: "frog", full: true, sequence: "frog-half" }),
  "0718": supineCurl({ full: true, twist: true }),
  "5237": supineCurl({ support: "decline", hands: "up", full: true, load: "dumbbell" }),
  "3389": supineCurl({ support: "chair", hands: "chest", full: true }),
  "4008": supineCurl({ legs: "straight", hands: "chest", full: true }),
  "1137": supineCurl({ support: "straps", hands: "chest", full: true }),
  "5514": supineCurl({ legs: "up-bent", twist: true }),
  "0821": supineCurl({ full: true, twist: true }),
  "0823": supineCurl({ hands: "up-reach", twist: true }),
  "3621": supineCurl({ hands: "up-reach", twist: true }),
  "6016": supineCurl({ twist: true }),
  "5963": supineCurl({ legs: "up", hands: "toes", full: true }),
  "0831": supineCurl({ hands: "chest", load: "plate" }),
  "4252": supineCurl({ hands: "chest", load: "plate" }),
  "3670": supineCurl({ support: "decline", hands: "chest", load: "plate", full: true }),
  "10879": supineCurl({ hands: "sweep", load: "dumbbell" }),
  "3282": supineCurl({ support: "legs-bench", hands: "chest", load: "plate" }),
  "3283": supineCurl({ support: "legs-bench", hands: "chest", load: "plate", twist: true }),
  "0836": supineCurl({ legs: "extend", hands: "chest", load: "plate" }),
  "0840": supineCurl({ support: "stability-ball", hands: "ears", load: "plate" }),
  "10871": supineCurl({ hands: "ears", load: "plate" }),
  "10877": supineCurl({ hands: "ears", load: "plate" }),
  "3332": supineCurl({ support: "stability-ball", hands: "chest", load: "plate", range: "deep" }),
  "4101": supineCurl({ legs: "up", hands: "toes", load: "plate" }),
  "1188": supineCurl({ support: "bench", hands: "chest", load: "plate", twist: true }),
  "4720": kneelingCrunch("band"),
  "5206": kneelingCrunch("band"),
  "5203": kneelingCrunch("standing-band"),
  "1020": kneelingCrunch("band-side"),
  "5741": kneelingCrunch("cable"),
  "11270": kneelingCrunch("cable"),
  "6693": kneelingCrunch("side"),
  "0482": reverseCurl("floor"),
  "0487": reverseCurl("floor"),
  "4333": reverseCurl("bench-circle"),
  "4330": reverseCurl("kick"),
  "4097": reverseCurl("dead-bug"),
  "6419": reverseCurl("band"),
  "1147": reverseCurl("straps"),
  "0708": sideCurl("knees-down"),
  "0707": sideCurl("side"),
  "4812": sideCurl("braced"),
  "4787": sideCurl("chest"),
  "0719": sideCurl("long"),
  "4158": sideCurl("weighted"),
  "5846": standingCross(false),
  "4366": standingCross(true),
  "4623": seatedTuck("weighted"),
  "4626": seatedTuck("dumbbell"),
  "4628": seatedTuck("dumbbell-twist"),
  "3944": seatedTuck("alternate"),
  "3978": seatedTuck("side-sweep"),
  "4022": seatedTuck("figure-eight"),
  "1189": seatedTuck("bosu"),
};
