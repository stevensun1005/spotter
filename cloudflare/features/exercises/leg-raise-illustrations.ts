import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

const floor = 158;
const toes: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function ray([x, y]: Point, length: number, angle: number): Point {
  const a = angle * Math.PI / 180;
  return [x + length * Math.cos(a), y + length * Math.sin(a)];
}

function lowerBody([x, y]: Point, thigh: number, shin: number, short = false): Limb {
  const knee = ray([x, y], short ? 26 : 34, thigh);
  return [knee, ray(knee, short ? 28 : 33, shin)];
}

function body(head: Point, chest: Point, hips: Point, arms: [Limb, Limb], legs: [Limb, Limb], footAngle: [number, number]): Point[] {
  return [head, chest, hips, ...arms[0], ...arms[1], ...legs[0], ...legs[1],
    ray(legs[0][1], 11, footAngle[0]), ray(legs[1][1], 10, footAngle[1])];
}

function motion(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 830): Illustration {
  return { frames, props, dynamic: [...toes, ...attachments], ms, reference: true };
}

type FloorKind = "straight" | "bent" | "soft-knee" | "alternating" | "fixed-leg" | "single-floor" | "flutter" | "scissors" | "toe-tap" | "cross"
  | "alternating-hips" | "twisted" | "twisted-bent" | "wiper" | "pelvic-lift" | "hold";
type FloorSupport = "floor" | "incline" | "decline" | "bosu" | "lever";
type FloorArms = "sides" | "under-hips" | "under-head" | "wide";
type FloorLoad = "split-band" | "medicine" | "dumbbell";
type FloorOptions = { variation?: FloorKind; support?: FloorSupport; hands?: FloorArms; headUp?: boolean; load?: FloorLoad };

function floorRaise({ variation = "straight", support = "floor", hands = "sides", headUp = false, load }: FloorOptions = {}) {
  const onMachine = support === "lever";
  const bench = support === "incline" || support === "decline";
  const bosu = support === "bosu";
  const props: Props = [];
  if (support === "incline") props.push([82, 106, 188, 142], [90, 110, 90, floor], [176, 138, 176, floor], [75, 106, 91, 106]);
  if (support === "decline") props.push([76, 146, 200, 103], [87, 143, 87, floor], [186, 109, 186, floor], [74, 137, 88, 137]);
  if (bosu) props.push([127, 157, 170, 157], [128, 156, 134, 143], [134, 143, 144, 137], [144, 137, 154, 137],
    [154, 137, 165, 144], [165, 144, 169, 156]);
  if (onMachine) props.push([75, 126, 151, 126], [84, 127, 84, floor], [141, 127, 141, floor],
    [126, 158, 238, 158], [220, 89, 220, floor], [208, 89, 230, 89], [211, 105, 229, 105]);
  const hipRest: Point = onMachine ? [146, 117] : support === "incline" ? [142, 118] : support === "decline" ? [147, 116]
    : bosu ? [151, 132] : [144, 148];
  const shoulderRest: Point = onMachine ? [108, 120] : support === "incline" ? [104, 105] : support === "decline" ? [109, 128]
    : bosu ? [113, 137] : headUp ? [111, 138] : [105, 148];
  const toPose = (angles: [number, number], knee: [number, number] = [0, 0], elevation = 0, phase = 0): Point[] => {
    const hip: Point = [hipRest[0] - elevation * 0.54 + phase * (elevation ? 5 : 0), hipRest[1] - elevation];
    const arms: [Limb, Limb] = bench ? [[[91, shoulderRest[1] - 15], [80, support === "incline" ? 106 : 135]],
      [[86, shoulderRest[1] - 15], [77, support === "incline" ? 104 : 133]]]
      : bosu ? [[[133, 142], [141, 151]], [[129, 143], [133, 150]]]
      : onMachine ? [[[96, 115], [78, 122]], [[92, 114], [76, 118]]]
      : hands === "under-hips" ? [[[123, 152], [140, 154]], [[117, 152], [134, 153]]]
      : hands === "under-head" ? [[[97, 137], [85, 144]], [[95, 135], [81, 143]]]
      : hands === "wide" ? [[[98, 127], [91, 109]], [[113, 152], [121, 157]]]
      : [[[125, 151], [142, 154]], [[118, 153], [135, 155]]];
    const near = lowerBody(hip, angles[0], angles[0] + knee[0]);
    const far = lowerBody([hip[0] - 5, hip[1] - 2], angles[1], angles[1] + knee[1]);
    if (phase && (variation === "cross" || variation === "wiper")) {
      near[1][0] += phase * 6;
      far[1][0] -= phase * 6;
    }
    return body([shoulderRest[0] - 16, shoulderRest[1] - (headUp ? 7 : 1)], shoulderRest, hip, arms,
      [near, far], [angles[0] < -54 ? 6 : -7, angles[1] < -54 ? 4 : -8]);
  };
  const low = toPose([-6, -7]);
  const high = toPose([-83, -88]);
  let frames = [low, high];
  let ms = 830;
  if (variation === "bent") {
    frames = [toPose([-11, -13], [19, 18]), toPose([-87, -92], [84, 85])];
  } else if (variation === "soft-knee") {
    frames = [toPose([-12, -13], [15, 14]), toPose([-87, -91], [15, 14])];
  } else if (variation === "alternating") {
    frames = [low, toPose([-85, -7]), toPose([-10, -81])];
  } else if (variation === "fixed-leg") {
    frames = [toPose([-3, -37], [0, 61]), toPose([-34, -37], [0, 61])];
  } else if (variation === "single-floor") {
    frames = [toPose([-3, 2]), toPose([-55, 2])];
  } else if (variation === "flutter" || variation === "scissors") {
    const rise = variation === "flutter" ? -25 : headUp ? -48 : -34;
    frames = [toPose([rise, -6]), toPose([-12, -13]), toPose([-6, rise]), toPose([-12, -13])];
    ms = variation === "scissors" ? 440 : 360;
  } else if (variation === "cross") {
    frames = [toPose([-25, -5]), toPose([-14, -17], [1, 0], 0, 1), toPose([-7, -26]), toPose([-14, -18], [1, 0], 0, -1)];
    ms = 570;
  } else if (variation === "toe-tap") {
    const tap = (side: "near" | "far") => {
      const pose = toPose([-83, -88]);
      const joints = side === "near" ? [7, 8, 11] : [9, 10, 12];
      for (const joint of joints) pose[joint][1] -= 6;
      return pose;
    };
    frames = [high, tap("near"), high, tap("far")];
  } else if (variation === "wiper") {
    frames = [high, toPose([-20, -26], [0, 2], 0, 1), high, toPose([-151, -156], [2, 0], 0, -1)];
  } else if (variation === "alternating-hips") {
    frames = [toPose([-83, -8]), toPose([-45, -43]), toPose([-6, -88]), toPose([-43, -45])];
  } else if (variation === "twisted" || variation === "twisted-bent") {
    const bent = variation === "twisted-bent";
    frames = [low, toPose([-65, -68], bent ? [61, 60] : [0, 0], 9, 1), low,
      toPose([-110, -115], bent ? [81, 80] : [0, 0], 9, -1)];
  } else if (variation === "pelvic-lift") {
    frames = [low, high, toPose([-87, -92], [0, 0], 10), high];
  } else if (variation === "hold") {
    frames = [high, low, low, low, low];
  }
  if (support === "decline") frames = [toPose([-8, -11], [10, 10]), toPose([-116, -123], [81, 81], 10)];
  const attachments: Attachments = load === "split-band" ? [["band", 8, 10]]
    : load === "medicine" ? [["ball", 8, -4, -1]] : load === "dumbbell" ? [["dumbbell", 8, -4, -2]] : [];
  if (onMachine) attachments.push(["bar", 8, 220, 105], ["pad", 8, -4, -7], ["barbell-end", 8, 5, 7]);
  return motion(frames, props, attachments, ms);
}

type HangingSupport = "pull-up" | "stall" | "captain" | "dip";
type HangingAction = "raise" | "knee" | "alternate" | "flutter" | "to-bar";

function hangingRaise(support: HangingSupport, action: HangingAction, load?: "cable" | "weight", singleArm = false) {
  const captain = support === "captain";
  const dip = support === "dip";
  const suspended = !captain && !dip;
  const props: Props = suspended
    ? [[87, 21, 199, 21], [94, 21, 94, floor], [198, 21, 198, floor], [87, 158, 103, 158], [190, 158, 207, 158]]
    : captain ? [[119, 53, 119, 105], [107, 56, 107, floor], [110, 83, 164, 83], [155, 78, 155, 86],
      [126, 80, 169, 80], [164, 82, 164, floor], [105, 158, 175, 158], [123, 53, 123, 78]]
      : [[111, 88, 171, 88], [113, 96, 175, 96], [119, 96, 119, floor], [163, 96, 163, floor], [171, 87, 171, floor], [107, 158, 177, 158]];
  if (support === "stall") {
    for (const level of [36, 55, 74, 93, 112, 131, 150]) props.push([119, level, 153, level]);
    props.push([119, 20, 119, 155], [153, 20, 153, 155]);
  }
  if (load === "cable") props.push([76, 110, 76, floor], [80, 149, 101, 149], [68, floor, 87, floor]);
  const figure = (angle: number, other = angle, bendAngle = 0, farBend = bendAngle, top = false): Point[] => {
    const shaft = action === "to-bar" && top;
    const shoulder: Point = shaft ? [108, 47] : [141, suspended ? 50 : 52];
    const head: Point = shaft ? [108, 35] : [145, shoulder[1] - 14];
    const hip: Point = shaft ? [128, 79] : [144 - (top ? 4 : 0), 87 - (top ? 2 : 0)];
    const hands: [Limb, Limb] = suspended
      ? [[[shoulder[0] + 12, 34], [151, 21]],
        singleArm ? [[shoulder[0] - 14, 66], [shoulder[0] - 25, 70]] : [[shoulder[0] - 7, 33], [133, 21]]]
      : captain ? [[[138, 78], [158, 79]], [[130, 76], [150, 76]]]
        : [[[143, 71], [147, 86]], [[137, 69], [138, 92]]];
    const near = lowerBody(hip, angle, angle + bendAngle);
    const far = lowerBody([hip[0] - 6, hip[1] - 2], other, other + farBend);
    return body(head, shoulder, hip, hands, [near, far],
      [shaft ? -80 : angle > 60 ? 12 : -8, shaft ? -75 : other > 60 ? 14 : -9]);
  };
  const rest = figure(85, 90);
  const frames = action === "alternate"
    ? [rest, figure(-12, 90, 86, 0, true), rest, figure(85, -14, 0, 86, true)]
    : action === "flutter" ? [figure(66, 82), figure(82, 66)]
      : action === "to-bar" ? [rest, figure(1, -4, 0, 0, true), figure(-58, -56, 0, 0, true), figure(-15, -16, 0, 0, true)]
        : action === "knee" ? [rest, figure(-11, -14, 84, 84, true)] : [rest, figure(-10, -13, 0, 0, true)];
  return motion(frames, props, load === "cable" ? [["cable", 8, 77, 149], ["cable", 10, 77, 149]]
    : load === "weight" ? [["pad", 8, -3, -4], ["pad", 10, -3, -4]] : [], action === "flutter" ? 395 : 840);
}

function dragonFlag() {
  const props: Props = [[73, 116, 229, 116], [80, 116, 80, floor], [219, 116, 219, floor]];
  const shoulder: Point = [103, 107];
  const arms: [Limb, Limb] = [[[91, 91], [78, 111]], [[87, 89], [74, 109]]];
  const make = (angle: number) => {
    const hip = ray(shoulder, 38, angle);
    const left = lowerBody(hip, angle, angle);
    const right = lowerBody([hip[0] - 5, hip[1] - 3], angle - 1, angle - 1);
    return body([87, 108], shoulder, hip, arms, [left, right], [angle, angle]);
  };
  return motion([make(-16), make(-40), make(-64), make(-40)], props);
}

function forearmSupportedTuck(): Illustration {
  const base = hangingRaise("captain", "knee");
  const props: Props = [[134, 46, 134, 91], [125, 49, 125, 153], [126, 83, 164, 83],
    [155, 78, 155, 86], [127, 80, 167, 80], [168, 82, 168, 154], [115, 154, 181, 154]];
  return { ...base, props, frames: base.frames.map(frame => frame.map(([x, y], joint) => [x, joint >= 7 ? y - 6 : y])) };
}

function supportedScissors() {
  const upper: Point = [105, 148];
  const hips: Point = [134, 111];
  const arms: [Limb, Limb] = [[[112, 151], [130, 119]], [[108, 150], [124, 118]]];
  const make = (a: number, b: number) => body([89, 147], upper, hips, arms,
    [lowerBody(hips, a, a), lowerBody([128, 108], b, b)], [a, b]);
  return motion([make(-85, -42), make(-61, -64), make(-42, -86), make(-61, -64)], [], [], 600);
}

function sideLift(kind: "plain" | "cable" | "band" | "diagonal" | "scissors") {
  const slant = kind === "cable";
  const hip: Point = slant ? [145, 117] : [145, 148];
  const shoulder: Point = slant ? [107, 107] : [108, 147];
  const head: Point = [shoulder[0] - 15, shoulder[1] - 6];
  const arms: [Limb, Limb] = [[[shoulder[0] - 4, shoulder[1] + 9], [shoulder[0] - 18, shoulder[1] + 5]],
    [[shoulder[0] + 12, shoulder[1] + 6], [shoulder[0] + 20, shoulder[1] + 8]]];
  const props: Props = slant ? [[74, 108, 219, 151], [85, 112, 85, 158], [205, 146, 205, 158],
    [237, 100, 237, 158], [231, 145, 242, 145], [225, 158, 249, 158]] : [];
  const make = (opened: boolean) => {
    const angle = opened ? kind === "diagonal" ? -48 : -34 : slant ? 15 : -5;
    const farAngle = opened && kind === "scissors" ? -18 : slant ? 16 : 3;
    const left = lowerBody(hip, angle, angle);
    const right = lowerBody([hip[0] - 4, hip[1] - 3], farAngle, farAngle);
    return body(head, shoulder, hip, arms, [left, right], [angle + 20, farAngle + 12]);
  };
  return motion([make(false), make(true)], props, kind === "band" ? [["band", 8, 10]]
    : slant ? [["cable", 8, 233, 145], ["pad", 8, 0, 0]] : []);
}

type SittingKind = "flutter" | "in-out" | "leg-lift" | "weighted" | "overhead-hold" | "overhead-press" | "l-sit" | "band-knee" | "chair-extend";
function sittingLift(kind: SittingKind) {
  const chair = kind === "band-knee" || kind === "chair-extend";
  const bars = kind === "l-sit";
  const loaded = kind === "overhead-hold" || kind === "overhead-press";
  const hip: Point = chair ? [126, 104] : bars ? [145, 121] : [130, 146];
  const baseShoulder: Point = chair ? [117, 64] : bars ? [142, 80] : [107, 115];
  const props: Props = chair ? [[99, 111, 162, 111], [104, 112, 104, floor], [155, 112, 155, floor]]
    : bars ? [[122, 116, 160, 116], [132, 122, 168, 122], [125, 125, 125, floor], [160, 126, 160, floor],
      [145, 117, 145, 155], [113, 158, 172, 158]] : [];
  if (kind === "band-knee") props.push([205, 119, 205, floor], [193, 158, 217, 158]);
  const make = (nearAngle: number, farAngle: number, tucked = false, holdOverhead = true) => {
    const shoulder: Point = tucked && !chair ? [baseShoulder[0] + 7, baseShoulder[1] - 5] : baseShoulder;
    const head: Point = [shoulder[0] - 7, shoulder[1] - 14];
    const arms: [Limb, Limb] = loaded
      ? holdOverhead ? [[[shoulder[0] + 4, shoulder[1] - 19], [shoulder[0] + 7, shoulder[1] - 42]],
        [[shoulder[0] - 9, shoulder[1] - 16], [shoulder[0] - 11, shoulder[1] - 38]]]
        : [[[shoulder[0] + 14, shoulder[1] + 11], [shoulder[0] + 14, shoulder[1] - 8]], [[shoulder[0] - 4, shoulder[1] + 12], [shoulder[0] - 7, shoulder[1] - 7]]]
      : bars ? [[[141, 100], [143, 117]], [[135, 101], [134, 123]]]
        : chair ? [[[111, 85], [119, 108]], [[104, 83], [106, 107]]]
          : [[[94, 133], [91, 153]], [[88, 133], [83, 151]]];
    const restingFar = chair ? [[147, 119], [146, 153]] as Limb : lowerBody([hip[0] - 6, hip[1] - 3], farAngle, tucked ? farAngle + 65 : farAngle);
    const near = lowerBody(hip, nearAngle, kind === "band-knee" ? (tucked ? 45 : 84) : tucked ? nearAngle + 67 : nearAngle);
    return body(head, shoulder, hip, arms, [near, restingFar], [nearAngle < -45 ? 14 : 5, 3]);
  };
  const inOut = kind === "in-out" || kind === "overhead-press";
  const restAngle = kind === "band-knee" ? 29 : kind === "chair-extend" ? 10 : -3;
  const rest = make(restAngle, -6);
  let frames = kind === "flutter" || kind === "overhead-hold" ? [make(-24, -5), make(-6, -24)]
    : inOut ? [rest, make(-56, -58, true), rest]
      : kind === "band-knee" ? [rest, make(-52, -8, true)] : [rest, make(kind === "chair-extend" ? -9 : -29, -31)];
  if (kind === "overhead-press") frames = [make(-3, -6, false, false), rest, make(-59, -61, true), rest];
  return motion(frames, props, loaded ? [["dumbbell", 4, 0, -4], ["dumbbell", 6, 0, -4]]
    : kind === "weighted" ? [["pad", 8, 0, -4], ["pad", 10, 0, -4]]
      : kind === "band-knee" ? [["band", 8, 204, 151]] : [], kind === "flutter" ? 380 : 830);
}

type StandingKind = "front-band" | "ankle-loop" | "front-back" | "side" | "side-band" | "lever-side" | "lever-front" | "march";

function standingLift(kind: StandingKind) {
  const sideways = kind === "side" || kind === "side-band" || kind === "lever-side";
  const hip: Point = [147, 88];
  const shoulder: Point = [145, 54];
  const [supported, machine] = [kind !== "side" && kind !== "march", kind === "lever-side" || kind === "lever-front"];
  const props: Props = supported ? [[194, 43, 194, floor], [183, 70, 195, 70], [184, 158, 207, 158]] : [];
  if (kind === "front-band") props.push([93, 118, 93, 158], [83, 158, 105, 158]);
  if (machine) props.push([200, 42, 200, 158], [199, 95, 220, 95], [218, 95, 218, 158], [185, 158, 223, 158]);
  const make = (angle: number, otherSide = false) => {
    const hands: [Limb, Limb] = supported ? [[[164, 68], [192, 69]], [[155, 73], [186, 71]]]
      : kind === "march" ? [[[150, 73], [148, 96]], [[140, 74], [141, 95]]]
        : [[[164, 72], [153, 91]], [[126, 74], [136, 90]]];
    const supportLeg: Limb = [[137, 122], [134, 152]];
    const bent = kind === "march" || kind === "lever-front";
    const working = lowerBody(hip, angle, bent && angle < 60 ? angle + 66 : angle);
    if (sideways && angle < 60) working[1][0] += 6;
    return body([148, 39], shoulder, hip, hands, otherSide ? [supportLeg, working] : [working, supportLeg], [6, 9]);
  };
  const rest = make(84);
  const poses = kind === "front-back" ? [rest, make(17), rest, make(132)]
    : kind === "march" ? [rest, make(-11), make(84, true), make(-13, true)] : [rest, make(sideways ? 27 : 4)];
  const attachments: Attachments = kind === "front-band" ? [["band", 8, 93, 149]]
    : kind === "ankle-loop" || kind === "side-band" ? [["band", 8, 10]]
      : machine ? [[kind === "lever-front" ? "bar" : "line", 7, 199, 95], ["pad", 7, 0, -6], ["barbell-end", 7, 12, 8]] : [];
  return motion(poses, props, attachments);
}

function quadrupedLift(band: boolean) {
  const hip: Point = [145, 105];
  const shoulder: Point = [106, 105];
  const hands: [Limb, Limb] = [[[109, 128], [108, 152]], [[100, 125], [95, 150]]];
  const make = (up: boolean) => {
    const near: Limb = up ? [[179, 100], [213, 94]] : [[153, 143], [180, 147]];
    return body([91, 101], shoulder, hip, hands, [near, [[139, 152], [171, 152]]], [9, 8]);
  };
  return motion([make(false), make(true)], [], band ? [["knee-band", 7, 9]] : [["pad", 8, 0, -4]]);
}

export const legRaiseIllustrations: Record<string, Illustration> = {
  "4826": floorRaise({ variation: "alternating" }),
  "4001": floorRaise({ variation: "alternating", headUp: true }),
  "3590": floorRaise({ variation: "alternating" }),
  "1186": floorRaise({ variation: "alternating", support: "bosu" }),
  "5106": floorRaise({ variation: "toe-tap" }),
  "0912": floorRaise({ variation: "alternating", load: "split-band" }),
  "4020": floorRaise({ variation: "cross" }),
  "6548": floorRaise({ variation: "bent", support: "decline" }),
  "2891": floorRaise({ variation: "flutter", hands: "under-hips", headUp: true }),
  "1179": floorRaise({ variation: "flutter", hands: "under-hips" }),
  "1244": floorRaise({ variation: "flutter", hands: "under-hips" }),
  "4768": floorRaise({ variation: "flutter", support: "incline" }),
  "2850": floorRaise({ variation: "bent" }),
  "4058": dragonFlag(),
  "1852": floorRaise({ variation: "pelvic-lift" }),
  "1855": floorRaise({ variation: "pelvic-lift", headUp: true }),
  "1854": floorRaise({ variation: "soft-knee", hands: "under-hips" }),
  "1856": floorRaise({ variation: "bent", support: "lever" }),
  "9321": floorRaise({ variation: "flutter", hands: "under-hips" }),
  "3263": floorRaise(),
  "0619": floorRaise({ variation: "single-floor" }),
  "8194": floorRaise({ variation: "bent" }),
  "4419": floorRaise({ variation: "soft-knee" }),
  "1245": floorRaise({ variation: "hold" }),
  "3268": floorRaise({ variation: "wiper", hands: "wide" }),
  "0622": floorRaise({ variation: "scissors", hands: "under-hips" }),
  "6214": floorRaise({ variation: "cross" }),
  "0623": floorRaise({ variation: "alternating-hips" }),
  "1180": floorRaise({ variation: "alternating-hips", hands: "under-hips" }),
  "10913": floorRaise({ variation: "fixed-leg" }),
  "1181": floorRaise({ hands: "under-hips" }),
  "9971": floorRaise({ variation: "fixed-leg" }),
  "5031": floorRaise({ load: "medicine" }),
  "4779": floorRaise({ variation: "flutter", hands: "under-head" }),
  "4980": floorRaise({ variation: "scissors", hands: "under-head" }),
  "2862": supportedScissors(),
  "3586": floorRaise({ variation: "scissors", hands: "under-hips", headUp: true }),
  "2892": floorRaise({ variation: "cross" }),
  "2802": floorRaise({ variation: "twisted", hands: "under-hips" }),
  "2801": floorRaise({ variation: "twisted-bent" }),
  "6705": floorRaise({ variation: "wiper", hands: "wide" }),
  "8873": floorRaise({ variation: "bent", load: "dumbbell" }),
  "2887": hangingRaise("pull-up", "raise", "cable"),
  "5107": hangingRaise("captain", "raise"),
  "6033": forearmSupportedTuck(),
  "10735": hangingRaise("pull-up", "alternate"),
  "4766": hangingRaise("pull-up", "flutter"),
  "11878": hangingRaise("stall", "raise"),
  "0826": hangingRaise("dip", "raise"),
  "5477": hangingRaise("dip", "raise"),
  "3623": hangingRaise("dip", "raise"),
  "2127": hangingRaise("captain", "knee", "weight"),
  "3891": hangingRaise("pull-up", "to-bar"),
  "11091": hangingRaise("pull-up", "to-bar", undefined, true),
  "9927": sideLift("cable"),
  "0617": sideLift("plain"),
  "2852": sideLift("plain"),
  "2157": sideLift("band"),
  "6751": sideLift("diagonal"),
  "4882": sideLift("scissors"),
  "6802": sittingLift("overhead-hold"),
  "6801": sittingLift("overhead-press"),
  "10951": sittingLift("l-sit"),
  "10753": sittingLift("band-knee"),
  "3962": sittingLift("flutter"),
  "3509": sittingLift("in-out"),
  "8946": sittingLift("chair-extend"),
  "9487": sittingLift("leg-lift"),
  "5023": sittingLift("weighted"),
  "1021": standingLift("ankle-loop"),
  "0927": standingLift("front-band"),
  "1563": standingLift("front-back"),
  "4287": standingLift("march"),
  "5349": standingLift("lever-side"),
  "1036": standingLift("lever-front"),
  "11569": standingLift("side-band"),
  "3929": standingLift("side"),
  "2419": quadrupedLift(true),
  "3587": quadrupedLift(false),
};
