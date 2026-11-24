import type { Illustration, Point } from "./motion-data";
import { hingeIllustrations } from "./hinge-illustrations";
import { hipBridgeIllustrations } from "./hip-bridge-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Body = [Point, Point, Point];

const ground = 156;

function at([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function figure(body: Body, near: Limb, far: Limb, legs: [Limb, Limb], toes: [Point, Point] = [at(legs[0][1], 7, 0), at(legs[1][1], 7, 0)]): Point[] {
  return [...body, ...near, ...far, ...legs[0], ...legs[1], ...toes];
}

function demo(frames: Point[][], props: Props = [], gear: Attachments = [], ms = 860): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...gear], ms, reference: true };
}

function hold(first: Point[], stretch: Point[], props: Props = [], gear: Attachments = []): Illustration {
  return demo([first, stretch, stretch, stretch, stretch], props, gear, 830);
}

function benchDeck(x1: number, x2: number, y: number, highBack = false): Props {
  const props: Props = [[x1, y, x2, y], [x1 + 4, y, x1 + 4, 157], [x2 - 4, y, x2 - 4, 157]];
  if (highBack) props.push([x1, y, x1, y - 40]);
  return props;
}

type Supine = "single" | "single-rotate" | "both" | "arms-overhead" | "hamstring" | "towel" | "figure-four" | "wall";
function supine(kind: Supine) {
  const ham = kind === "hamstring" || kind === "towel" || kind === "wall";
  const figureFour = kind === "figure-four";
  const wall = kind === "wall";
  const props: Props = wall ? [[186, 20, 186, 144], [184, 20, 191, 20]] : [];
  const gear: Attachments = kind === "towel" ? [["bar", 4, 11], ["bar", 6, 11]] : [];
  const shoulder: Point = [wall ? 111 : 100, 145], hip: Point = [wall ? 174 : 151, 148];

  function make(stretch: boolean) {
    const head = at(shoulder, -17, -3);
    let near: Limb = [at(hip, 31, 3), at(hip, 66, 6)];
    let far: Limb = [at(hip, 30, 6), at(hip, 67, 7)];
    let first: Limb = [at(shoulder, 20, 7), at(shoulder, 42, 8)];
    let second: Limb = [at(shoulder, 17, 9), at(shoulder, 35, 9)];
    if (ham) {
      near = wall ? [[181, 111], [181, stretch ? 70 : 77]] : stretch ? [[141, 109], [130, 72]] : [[168, 111], [181, 77]];
      if (!wall) {
        first = [[121, 128], kind === "towel" ? [142, 123] : at(near[0], -1, 4)];
        second = [[117, 132], kind === "towel" ? [132, 123] : at(near[0], 4, 7)];
      }
    } else if (figureFour) {
      far = stretch ? [[167, 113], [201, 119]] : [[189, 114], [211, 154]];
      near = stretch ? [[149, 101], [170, 114]] : [[171, 104], [189, 114]];
      first = [[126, 136], at(far[0], -4, 6)];
      second = [[122, 129], at(far[0], -6, 2)];
    } else if (kind === "single-rotate" || kind === "single" || kind === "arms-overhead" || kind === "both") {
      near = stretch ? kind === "single-rotate" ? [[124, 108], [155, 111]] : [[121, 115], [154, 116]]
        : [[172, 116], [198, 143]];
      if (kind === "both") far = stretch ? [[125, 120], [160, 122]] : [[173, 122], [202, 144]];
      if (kind === "single-rotate") far = [[186, 117], [207, 153]];
      first = [[115, 126], at(near[0], 5, 3)];
      second = [[114, 137], kind === "both" ? at(far[0], 7, 2) : at(near[0], 7, 7)];
      if (kind === "arms-overhead") {
        first = [[76, 148], [53, 150]];
        second = [[72, 148], [50, 149]];
      }
    }
    const toes: [Point, Point] = [ham ? at(near[1], wall ? 0 : -8, -6) : at(near[1], 7, -1), at(far[1], 6, -1)];
    return figure([head, shoulder, hip], first, second, [near, far], toes);
  }
  return hold(make(false), make(true), props, gear);
}

function supineTwist(direction: "near" | "far", legs: "one" | "both" | "figure-four") {
  // Seen from above to show each knee crossing the midline while the shoulders stay down.
  const body: Body = [[77, 103], [97, 104], [148, 104]];
  const sign = direction === "near" ? 1 : -1;
  function make(stretch: boolean) {
    const outer = stretch ? sign * 27 : 0;
    let near: Limb = [[177, 94 + outer], [205, 100 + outer]];
    let far: Limb = [[175, 112 + outer], [205, 115 + outer]];
    let first: Limb = [[106, 79], [114, 53]], second: Limb = [[103, 127], [109, 152]];
    if (legs === "one") far = [[182, 111], [216, 110]];
    if (legs === "figure-four") {
      near = [[170, 85 + outer], [186, 108 + outer]];
      far = [[186, 108 + outer], [211, 111 + outer]];
      if (sign > 0) second = [[128, 123], near[0]];
      else first = [[122, 84], near[0]];
    }
    return figure(body, first, second, [near, far], [at(near[1], 6, -4), at(far[1], 6, 2)]);
  }
  return hold(make(false), make(true));
}

function sideQuad() {
  const body: Body = [[87, 138], [107, 139], [157, 144]];
  const freeArm: Limb = [[102, 152], [77, 151]];
  const planted: Limb = [[197, 147], [231, 152]];
  const start: Limb = [[193, 143], [224, 144]];
  const stretched: Limb = [[192, 143], [169, 117]];
  const make = (leg: Limb, back: boolean) => figure(body,
    back ? [[135, 127], leg[1]] : [[134, 145], [157, 149]], freeArm, [leg, planted]);
  return hold(make(start, false), make(stretched, true));
}

type Standing = "fold" | "cross" | "lead" | "toe-down" | "high" | "raised" | "hip-raised" | "box-quad" | "tuck" | "tuck-cross" | "lean" | "figure-four";
function standing(kind: Standing) {
  const high = kind === "high";
  const raised = kind === "raised" || high || kind === "hip-raised";
  const leaning = kind === "lean";
  const tuck = kind === "tuck" || kind === "tuck-cross";
  const rearBox = kind === "box-quad";
  const crossed = kind === "cross";
  const ankleFour = kind === "figure-four";
  const deck = high ? 103 : 128;
  const props: Props = raised ? benchDeck(195, 257, deck) : rearBox ? benchDeck(83, 121, 122) : ankleFour ? [[219, 76, 219, 157], [212, 157, 227, 157]] : [];
  function make(stretch: boolean, straight = false) {
    const facingHinge = !tuck && !rearBox;
    const hip: Point = [ankleFour && stretch ? 122 : stretch && facingHinge ? 130 : 144, ankleFour && stretch ? 111 : rearBox && stretch ? 94 : 89];
    const normalShoulder = at(hip, 2, -41);
    const deep = kind === "fold" || crossed;
    const shoulder = stretch && facingHinge ? at(hip, deep ? 33 : raised ? 36 : 31, deep ? 11 : raised ? -17 : -27) : normalShoulder;
    const head = at(shoulder, stretch && facingHinge ? 10 : 4, stretch && deep ? 9 : -14);
    let near: Limb = [[151, 122], [151, ground]];
    let far: Limb = crossed ? [[144, 122], [158, ground - 1]] : [[138, 122], [140, ground - 1]];
    let first: Limb = stretch ? [at(shoulder, 3, 22), at(shoulder, -1, 47)] : [at(shoulder, 9, 21), at(shoulder, 10, 41)];
    let second: Limb = stretch ? [at(shoulder, -6, 20), at(shoulder, -9, 43)] : [at(shoulder, -8, 20), at(shoulder, -9, 41)];
    let toes: [Point, Point];
    if (raised || kind === "lead" || kind === "toe-down" || leaning) {
      const foot: Point = raised ? [213, deck - 2] : [207, ground];
      near = [[raised ? 178 : 174, raised ? (high ? straight ? 94 : 91 : kind === "hip-raised" ? 99 : 105) : 120], foot];
      if (stretch) {
        first = [[178, raised ? 99 : 112], kind === "toe-down" ? [199, 146] : [187, raised ? deck - 13 : 134]];
        second = [[169, raised ? 101 : 115], [175, raised ? deck - 16 : 131]];
      }
    }
    if (rearBox) far = [[129, 124], [104, 117]];
    if (tuck && stretch) {
      near = [kind === "tuck" ? [178, 75] : [165, 75], [168, 108]];
      first = [[158, 87], [174, 79]];
      second = [[150, 90], kind === "tuck-cross" ? [168, 105] : [172, 83]];
    }
    if (ankleFour) {
      near = [[145, stretch ? 110 : 107], [159, stretch ? 116 : 114]];
      far = [[158, 118], [159, ground]];
      first = [[194, 80], [220, 104]];
      second = [[187, 86], [217, 104]];
    }
    toes = [at(near[1], 8, raised || kind === "lead" ? -9 : kind === "toe-down" ? 2 : 0), at(far[1], rearBox ? -5 : 7, rearBox ? 3 : 0)];
    return figure([head, shoulder, hip], first, second, [near, far], toes);
  }
  return high ? demo([make(false), make(true), make(true, true), make(true, true), make(true, true)], props) : hold(make(false), make(true), props);
}

type Seated = "pigeon" | "90" | "behind" | "bent" | "straddle" | "hamstring" | "band"
  | "chair-hamstring" | "chair-cross" | "chair-cross-press" | "tuck" | "foot-chest" | "outer" | "twist"
  | "twist-elbow" | "both-twist" | "roller";

function seated(kind: Seated) {
  const chair = kind.startsWith("chair");
  const roller = kind === "roller";
  const figureFour = kind === "chair-cross" || kind === "chair-cross-press" || roller;
  const twist = kind === "twist" || kind === "twist-elbow" || kind === "both-twist";
  const floor = chair ? 111 : roller ? 136 : 148;
  const props = chair ? benchDeck(97, 156, 118, true) : [];
  const gear: Attachments = kind === "band" ? [["band", 4, 11], ["band", 6, 11]]
    : roller ? [["wheel", 2, 0, 15]] : [];

  function make(stretch: boolean) {
    const hip: Point = [roller && stretch ? 151 : 140, floor];
    const shoulder = stretch && !twist && kind !== "foot-chest" && kind !== "tuck" ? at(hip, roller ? 5 : 33, roller ? -40 : -20)
      : at(hip, twist && stretch ? -6 : 0, -42);
    const head = at(shoulder, stretch && !twist && kind !== "tuck" ? 12 : 4, stretch && !twist && kind !== "tuck" ? -9 : -16);
    let near: Limb = [[172, floor + 2], [209, ground]];
    let far: Limb = [[158, floor + 1], [134, ground - 2]];
    let first: Limb = stretch ? [[177, floor - 4], [201, ground - 2]] : [[156, floor - 15], [172, floor - 5]];
    let second: Limb = stretch ? [[173, floor - 5], [192, ground - 5]] : [[134, floor - 16], [126, floor - 5]];

    if (kind === "90" || kind === "behind") {
      near = [[177, 148], [167, 155]];
      far = kind === "behind" ? [[118, 143], [98, 150]] : [[110, 144], [95, 154]];
      first = stretch ? [[183, 143], [195, 155]] : [[160, 132], [169, 155]];
      second = stretch ? [[174, 146], [181, 155]] : [[135, 135], [130, 155]];
    }
    if (kind === "pigeon") {
      near = [[177, 141], [146, 139]];
      far = [[159, 152], [185, 149]];
      first = stretch ? [[179, 141], [193, 154]] : [[156, 134], [170, 144]];
      second = stretch ? [[177, 139], [183, 153]] : [[134, 136], [143, 147]];
    }
    if (kind === "bent") {
      near = [[176, 139], [205, 155]];
      far = [[164, 152], [134, 153]];
    }
    if (kind === "straddle") {
      near = [[176, 148], [215, 154]];
      far = [[111, 148], [75, 154]];
      first = stretch ? [[175, 146], [206, 151]] : [[152, 139], [173, 151]];
      second = stretch ? [[163, 146], [191, 154]] : [[130, 136], [110, 151]];
    }
    if (kind === "chair-hamstring") {
      near = [[177, 131], [208, 155]];
      far = [[167, 114], [166, 154]];
      first = stretch ? [[185, 122], [203, 148]] : [[155, 105], [171, 113]];
      second = stretch ? [[179, 127], [193, 145]] : [[150, 108], [163, 110]];
    }
    if (kind === "band") {
      first = stretch ? [[173, 134], [193, 138]] : [[160, 125], [168, 129]];
      second = stretch ? [[162, 138], [188, 140]] : [[156, 130], [166, 135]];
    }
    if (figureFour) {
      far = [[179, floor + 3], [184, 155]];
      near = [[157, floor - 10 + (stretch ? 9 : 0)], [179, floor + 3]];
      first = roller ? [[127, 137], [116, 154]] : kind === "chair-cross-press" ? [[162, floor - 14], near[0]] : [[169, floor - 6], near[1]];
      second = roller ? [[138, 141], [130, 155]] : [[164, floor - 8], far[0]];
    }
    if (kind === "tuck" || kind === "foot-chest") {
      near = stretch ? kind === "tuck" ? [[156, 105], [177, 134]] : [[170, 118], [146, 109]]
        : [[172, 125], [195, 148]];
      far = [[174, 150], [211, 156]];
      first = [[159, 121], stretch && kind === "foot-chest" ? near[1] : at(near[0], 5, 3)];
      second = [[157, 128], stretch && kind === "foot-chest" ? at(near[0], -2, 4) : at(near[0], 2, 6)];
    }
    if (kind === "outer") {
      near = [[171, 141 + (stretch ? 5 : 0)], [141, 151]];
      first = [[173, 135], [174, 146]];
      far = [[165, 154], [208, 156]];
    }
    if (kind === "twist" || kind === "twist-elbow") {
      near = [[159, 116], [171, 153]];
      far = [[178, 151], [214, 156]];
      first = stretch ? [[164, 121], [156, 111]] : [[155, 130], [171, 135]];
      second = kind === "twist-elbow" ? [[122, 121], [117, 154]] : [[128, 131], [117, 154]];
    }
    if (kind === "both-twist") {
      near = stretch ? [[174, 138], [197, 154]] : [[171, 117], [190, 155]];
      far = stretch ? [[163, 136], [187, 153]] : [[157, 120], [180, 154]];
      first = [[128, 132], [116, 155]];
      second = [[125, 139], [107, 155]];
    }
    const orientedHead = twist && stretch ? at(head, -13, 1) : head;
    const propsToes: [Point, Point] = [at(near[1], 7, figureFour ? -2 : -7), at(far[1], kind === "straddle" || kind === "90" || kind === "behind" ? -7 : 8, -2)];
    return figure([orientedHead, shoulder, hip], first, second, [near, far], propsToes);
  }
  return roller ? demo([make(false), make(true), make(false)], props, gear) : hold(make(false), make(true), props, gear);
}

type Lunge = "normal" | "couch" | "sartorius" | "hamstring" | "flow" | "world" | "overhead-stick" | "twist-stick" | "twist" | "weighted";
function lunge(kind: Lunge) {
  const handAtFloor = kind === "world" || kind === "flow" || kind === "hamstring";
  const couch = kind === "couch";
  const props: Props = couch ? [[96, 43, 96, 157]] : [];
  const stick = kind === "overhead-stick" || kind === "twist-stick";
  const gear: Attachments = stick ? [["bar", 4, 6]] : kind === "weighted" ? [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]] : [];

  function make(stage: "knee" | "stretch" | "reach" | "long" | "start", otherSide = false) {
    const upright = stage === "start";
    const long = stage === "long" || kind === "hamstring" || (kind === "world" && stage === "reach");
    const reachFloor = handAtFloor && !(kind === "hamstring" && stage === "knee");
    const stretched = stage !== "knee" && !upright;
    const knees = couch ? [108, 151] as Point : [129, 152] as Point;
    const hips: Point = upright ? [148, 89] : long ? [138, 117] : [couch ? stretched ? 132 : 118 : stretched ? 158 : 147, stretched ? 119 : 112];
    const torso: Point = at(hips, reachFloor ? long ? 31 : 37 : kind === "sartorius" && stretched ? -12 : 1,
      reachFloor ? long ? -25 : -18 : -42);
    const head = at(torso, handAtFloor ? 13 : 2, kind === "world" && stage === "reach" ? -14 : handAtFloor ? -7 : -15);
    const frontFoot: Point = [upright ? 157 : 219, ground];
    const near: Limb = [upright ? [151, 122] : [long ? 177 : 211, long ? 136 : 121], frontFoot];
    const farFoot: Point = upright ? [139, ground - 1] : couch ? [99, 105] : [92, 155];
    const far: Limb = [upright ? [140, 122] : knees, farFoot];
    let first: Limb = [at(torso, 11, 20), at(hips, 15, 10)];
    let second: Limb = [at(torso, -9, 19), at(hips, -12, 10)];
    if (reachFloor) {
      first = [[191, 127], [208, 153]];
      second = [[181, 127], [195, 153]];
    }
    if (kind === "world" && stage === "reach") first = [[198, 80], [207, 55]];
    if (kind === "overhead-stick") {
      first = [at(torso, 12, -16), at(torso, 20, -32)];
      second = [at(torso, -13, -17), at(torso, -18, -32)];
    }
    if (kind === "twist-stick" || kind === "twist") {
      first = [at(torso, 14, 17), at(torso, stretched ? 31 : 19, 9)];
      second = [at(torso, -14, 17), at(torso, stretched ? 5 : -10, 7)];
    }
    if (kind === "weighted") {
      first = [at(torso, 4, 21), at(torso, 9, 39)];
      second = [at(torso, -7, 22), at(torso, -6, 39)];
    }
    const headTurning = (kind === "twist-stick" || kind === "twist") && stretched ? at(head, 11, 2) : head;
    const toes: [Point, Point] = [at(frontFoot, 8, long && kind !== "world" ? -9 : 0), at(farFoot, couch ? -3 : -7, couch ? -9 : 0)];
    return otherSide ? figure([headTurning, torso, hips], second, first, [far, near], [toes[1], toes[0]])
      : figure([headTurning, torso, hips], first, second, [near, far], toes);
  }

  const starting = make("knee"), peak = make("stretch");
  if (kind === "flow") return demo([starting, peak, make("long"), make("long"), peak], props, gear);
  if (kind === "world") {
    return demo([starting, make("long"), make("reach"), make("reach"), starting,
      make("knee", true), make("long", true), make("reach", true), make("reach", true), make("knee", true)], props, gear);
  }
  if (kind === "weighted") return demo([make("start"), peak, make("start"), make("stretch", true)], props, gear);
  if (kind === "twist") return demo([make("start"), starting, peak, peak, starting], props, gear);
  return hold(starting, peak, props, gear);
}

function leanBack(oneLeg = false) {
  function make(stretch: boolean) {
    const hip: Point = [135, stretch ? 126 : 139];
    const shoulder: Point = stretch ? [105, 93] : [137, 99];
    const near: Limb = oneLeg ? [[178, 149], [211, 155]] : [[159, 153], [120, 155]];
    return figure([at(shoulder, stretch ? -9 : 1, -14), shoulder, hip],
      stretch ? [[88, 123], [74, 154]] : [[124, 123], [111, 154]],
      stretch ? [[93, 120], [88, 154]] : [[128, 126], [117, 154]],
      [near, [[150, 153], [112, 155]]], [at(near[1], oneLeg ? 7 : -7, 0), [106, 154]]);
  }
  return hold(make(false), make(true));
}

function ballQuad() {
  const hip: Point = [140, 115];
  const shoulder: Point = [143, 72];
  const head: Point = [148, 56];
  const planted: Limb = [[182, 128], [180, 154]];
  function make(stretch: boolean) {
    const foot: Point = stretch ? [151, 122] : [165, 154];
    return figure([head, shoulder, hip], [[143, 101], stretch ? foot : [157, 123]],
      [[127, 94], [113, 114]], [[[162, 137], foot], planted], [at(foot, stretch ? -5 : 7, 1), [188, 154]]);
  }
  return hold(make(false), make(true), [], [["stability-ball", 2, -7, 24]]);
}

function deepSquat(kind: "hold" | "shift" | "complex" | "twist" | "kettlebell") {
  const gear: Attachments = kind === "kettlebell" ? [["kettlebell", 4, -3, 6]] : [];
  function make(deep: boolean, lateral = 0, forward = false, reach = false) {
    const hip: Point = [150 + lateral, deep ? 130 : 87];
    const shoulder = at(hip, forward ? 13 : 2, deep ? -37 : -40);
    const head = at(shoulder, reach ? 8 : 2, -16);
    const first: Limb = reach ? [[171, 67], [176, 44]] : [[deep ? 180 : 175, deep ? 122 : 71], [153, deep ? 103 : 60]];
    const second: Limb = reach ? [[132, 120], [120, 150]] : [[deep ? 120 : 126, deep ? 121 : 72], [148, deep ? 103 : 61]];
    const near: Limb = [[deep ? 185 : 173, deep ? 127 : 120], [178, 155]];
    const far: Limb = [[deep ? 115 : 126, deep ? 127 : 120], [122, 154]];
    return figure([head, shoulder, hip], first, second, [near, far], [[187, 155], [113, 154]]);
  }
  const top = make(false), bottom = make(true);
  if (kind === "shift") return demo([top, bottom, make(true, -7), make(true, 7), bottom]);
  if (kind === "complex") return demo([top, bottom, make(true, -7), make(true, 7), make(true, 0, true), bottom]);
  if (kind === "twist") return demo([top, bottom, make(true, 0, false, true), make(true, 0, false, true), bottom]);
  return hold(top, bottom, [], gear);
}

function hipCircle() {
  return demo([[0, 0], [-12, -3], [0, -6], [12, -3], [0, 0]].map(([x,y]) => {
    const hip: Point = [151 + x, 89 + y], shoulder: Point = [151, 48];
    return figure([at(shoulder, 2, -17), shoulder, hip], [[173, 68], at(hip, 9, -1)], [[129, 68], at(hip, -9, -1)],
      [[[168, 122], [172, 156]], [[132, 122], [130, 154]]], [[180, 156], [122, 154]]);
  }));
}

function ceilingLook() {
  const make = (stretch: boolean) => {
    const hips: Point = [stretch ? 155 : 147, 91], shoulder: Point = [stretch ? 140 : 147, 49];
    const head = stretch ? [133, 35] as Point : [150, 33] as Point;
    const first: Limb = [at(shoulder, stretch ? -4 : 8, -17), at(shoulder, stretch ? -11 : 10, -32)];
    const second: Limb = [at(shoulder, -11, -17), at(shoulder, stretch ? -19 : -11, -30)];
    return figure([head, shoulder, hips], first, second, [[[153, 122], [152, 155]], [[139, 123], [140, 155]]]);
  };
  return hold(make(false), make(true));
}

function wheelPose() {
  const make = (arch: boolean) => {
    const body: Body = arch ? [[87, 107], [110, 86], [161, 83]] : [[83, 143], [102, 145], [153, 147]];
    const arms: [Limb, Limb] = arch ? [[[102, 119], [89, 154]], [[105, 118], [96, 153]]] : [[[101, 119], [89, 154]], [[106, 122], [96, 153]]];
    return figure(body, ...arms, [[[191, arch ? 116 : 118], [208, 154]], [[185, arch ? 115 : 119], [200, 154]]]);
  };
  return hold(make(false), make(true));
}

function toySoldier() {
  const make = (side?: "near" | "far") => {
    const hip: Point = [142, 89], shoulder: Point = [144, 47];
    const high: Limb = [[177, 82], [210, 75]], resting: Limb = [[146, 121], [146, 156]];
    const legs: [Limb, Limb] = [side === "near" ? high : resting, side === "far" ? [at(high[0], -5, 2), at(high[1], -5, 0)]
      : [at(resting[0], -6, 1), at(resting[1], -6, -2)]];
    return figure([at(shoulder, 5, -16), shoulder, hip], [[175, 57], [209, 59]], [[171, 61], [204, 62]], legs,
      [at(legs[0][1], 8, side === "near" ? -9 : 0), at(legs[1][1], 8, side === "far" ? -8 : 0)]);
  };
  return demo([make(), make("near"), make(), make("far")], [], [], 690);
}

const kneeChest = supine("single");
const floorFigureFour = supine("figure-four");
const floorHamstrings = supine("hamstring");
const seatedNinety = seated("90");
const frontHip = lunge("normal");
const squatShift = deepSquat("shift");
const hingedDumbbell = hingeIllustrations["3340"];
const [bridgeLow, bridgeTop] = hipBridgeIllustrations["6001"].frames;

export const posteriorStretchIllustrations: Record<string, Illustration> = {
  "10565": seatedNinety,
  "6560": seatedNinety,
  "3565": wheelPose(),
  "4280": ceilingLook(),
  "4557": lunge("couch"),
  "8162": lunge("flow"),
  "1956": leanBack(),
  "5890": seated("pigeon"),
  "1445": { ...hingedDumbbell, frames: [hingedDumbbell.frames[0], ...Array(4).fill(hingedDumbbell.frames[1])] },
  "1561": ballQuad(),
  "3396": demo([kneeChest.frames[0], ...kneeChest.frames.slice(1), kneeChest.frames[0], kneeChest.frames[0]]),
  "3468": standing("lead"),
  "3500": squatShift,
  "10592": lunge("hamstring"),
  "1406": floorHamstrings,
  "1931": deepSquat("hold"),
  "4286": hipCircle(),
  "4673": frontHip,
  "1944": floorFigureFour,
  "2993": deepSquat("kettlebell"),
  "0559": kneeChest,
  "6770": lunge("sartorius"),
  "5695": standing("lean"),
  "4930": frontHip,
  "1936": supineTwist("near", "figure-four"),
  "1935": floorFigureFour,
  "0615": supineTwist("near", "one"),
  "1056": floorFigureFour,
  "1810": kneeChest,
  "3475": supine("both"),
  "3477": supineTwist("near", "both"),
  "3472": kneeChest,
  "3474": supine("arms-overhead"),
  "3476": supineTwist("near", "both"),
  "3478": supineTwist("far", "both"),
  "7622": supine("wall"),
  "4299": sideQuad(),
  "1954": standing("box-quad"),
  "1911": standing("raised"),
  "1939": supine("single-rotate"),
  "2099": floorFigureFour,
  "1921": floorHamstrings,
  "1922": supine("towel"),
  "10744": seated("band"),
  "5389": seated("roller"),
  "3567": floorFigureFour,
  "1937": seated("tuck"),
  "8433": seated("chair-hamstring"),
  "4554": seated("chair-cross"),
  "1918": seated("chair-cross-press"),
  "1919": seated("behind"),
  "1938": seated("bent"),
  "1914": seated("straddle"),
  "1915": seated("hamstring"),
  "1934": seated("twist-elbow"),
  "1933": seated("twist"),
  "1955": leanBack(true),
  "6000": { ...hipBridgeIllustrations["6001"], frames: [bridgeLow, bridgeTop] },
  "1940": seated("foot-chest"),
  "1951": seated("outer"),
  "1948": seated("both-twist"),
  "2988": squatShift,
  "2989": deepSquat("complex"),
  "6139": deepSquat("twist"),
  "3630": standing("fold"),
  "1912": standing("high"),
  "1811": standing("tuck"),
  "1879": standing("hip-raised"),
  "1946": standing("tuck-cross"),
  "1917": standing("cross"),
  "1916": standing("fold"),
  "1895": standing("figure-four"),
  "1908": standing("toe-down"),
  "5402": lunge("overhead-stick"),
  "5408": lunge("twist-stick"),
  "5978": toySoldier(),
  "3956": lunge("twist"),
  "3642": lunge("weighted"),
  "1604": lunge("world"),
};
