import type { Illustration, Point } from "./motion-data";
import { hingeIllustrations } from "./hinge-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Body = [Point, Point, Point];

function add([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function pose(body: Body, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb,
  nearToe = add(nearLeg[1], 7, 1), farToe = add(farLeg[1], 7, 1)): Point[] {
  return [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg, nearToe, farToe];
}

function loop(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 750): Illustration {
  const dynamic: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...attachments];
  return { frames, props, dynamic, ms, reference: true };
}

const benchDeck = (from: number, to: number, deck: number): Props => [
  [from, deck, to, deck], [from + 5, deck, from + 5, 157], [to - 5, deck, to - 5, 157],
];
const tower = (x: number): Props => [[x, 29, x, 156], [x + 11, 32, x + 11, 156], [x - 8, 157, x + 20, 157],
  [x, 29, x + 11, 33], [x, 146, x + 8, 146], [x + 3, 110, x + 10, 110]];
const anchorPost = (x: number, height: number): Props => [[x, height, x, 157], [x - 8, 157, x + 12, 157]];
const hanger = (x: number): Props => [[x, 24, x, 157], [x - 20, 24, x + 6, 24], [x - 7, 157, x + 14, 157]];

type BridgeOptions = {
  base?: "mat" | "shoulders" | "feet" | "suspension" | "machine";
  action?: "full" | "heels" | "narrow" | "straight" | "wide-pulse" | "abduct" | "walk" | "walk-side"
    | "march" | "single" | "single-left" | "single-hold-left" | "single-flex" | "single-rotate"
    | "alternating-straight" | "alternating-bent" | "single-jump" | "slides" | "side" | "yoga" | "stagger";
  band?: boolean;
};

function bentKnee(hip: Point, foot: Point): Point {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const length = Math.max(1, Math.hypot(dx, dy));
  const along = Math.min(38, length / 2);
  const offset = Math.sqrt(Math.max(0, 38 * 38 - along * along));
  return [hip[0] + (dx * along + dy * offset) / length, hip[1] + (dy * along - dx * offset) / length];
}

function bridge({ base = "mat", action = "full", band = false }: BridgeOptions = {}) {
  const bench = base === "shoulders" || base === "machine";
  const feetRaised = base === "feet";
  const suspension = base === "suspension";
  const narrow = action === "narrow";
  const stage: Props = bench ? benchDeck(56, 110, 117) : feetRaised ? benchDeck(198, 252, 126) : suspension ? hanger(261) : [];
  const attachments: Attachments = [];
  if (band) attachments.push(["knee-band", 7, 9]);
  if (action === "slides") attachments.push(["slider", 8, 0, 2], ["slider", 10, 0, 2]);
  if (suspension) attachments.push(["cable", 8, 241, 25], ["cable", 10, 246, 25], ["ring", 8, 0, 1], ["ring", 10, 0, 1]);
  if (base === "machine") {
    stage.push([119, 154, 262, 154], [255, 42, 255, 157], [245, 42, 255, 42], [248, 146, 258, 146], [204, 157, 236, 157]);
    attachments.push(["bar", 2, 254, 112], ["pad", 2, 0, -6], ["barbell-end", 2, 76, -5]);
  }
  const shoulder: Point = bench ? [102, 107] : [100, 146];
  const head = add(shoulder, -17, -4);
  function frame(height: number, front = "", back = "", move = "") {
    const hips: Point = [156 + (move === "slide" ? -5 : 0), action === "straight" ? 147 - 7 * height
      : bench ? 144 - 35 * height : 146 - (feetRaised || suspension ? 32 : 24) * height];
    const footHeight = feetRaised ? 123 : suspension ? 115 : 154;
    let frontFoot: Point = [action === "straight" ? 233 : 212, footHeight];
    let backFoot: Point = [action === "straight" ? 222 : narrow ? 209 : action === "wide-pulse" ? 192
      : action === "stagger" ? 226 : 202, footHeight - 2];
    if (move === "shift" || move === "left") {
      const side = move === "left" ? -1 : 1;
      frontFoot = add(frontFoot, 14 * side, 0);
      backFoot = add(backFoot, 11 * side, 0);
    }
    if (move === "slide") { frontFoot = add(frontFoot, 30, 0); backFoot = add(backFoot, 27, 0); }
    if (move === "air") frontFoot = add(frontFoot, -5, -14);
    if (front === "step") frontFoot = add(frontFoot, 12, -9);
    if (back === "step") backFoot = add(backFoot, 12, -9);
    if (front === "out") frontFoot = add(frontFoot, 17, -5);
    if (back === "out") backFoot = add(backFoot, -15, -5);
    const nearStart = hips, farStart = add(hips, -4, 1);
    let frontKnee = action === "straight" ? add(hips, 36, 3) : bentKnee(nearStart, frontFoot);
    let backKnee = action === "straight" ? add(hips, 29, 4) : bentKnee(farStart, backFoot);
    if (move === "abduct") {
      frontKnee = add(frontKnee, 11, 6);
      backKnee = add(backKnee, -14, 6);
    }
    if (front === "line") { frontKnee = add(hips, 38, -13); frontFoot = add(hips, 71, -24); }
    if (back === "line") { backKnee = add(hips, 34, -15); backFoot = add(hips, 67, -27); }
    if (front === "vertical") { frontKnee = add(hips, 15, -34); frontFoot = add(hips, 23, -64); }
    if (back === "vertical") { backKnee = add(hips, 12, -34); backFoot = add(hips, 16, -65); }
    if (front === "lift" || front === "rotate" || front === "tuck") {
      frontKnee = add(hips, front === "rotate" ? 36 : front === "tuck" ? 10 : 21, front === "rotate" ? -25 : -34);
      frontFoot = add(frontKnee, -2, 29);
    }
    if (back === "lift" || back === "rotate" || back === "tuck") {
      backKnee = add(hips, back === "rotate" ? 32 : back === "tuck" ? 7 : 17, back === "rotate" ? -25 : -34);
      backFoot = add(backKnee, -3, 27);
    }
    const first: Limb = action === "yoga" ? [[130, 152], [151, 154]] : bench ? [[93, 116], [76, 118]] : [[123, 151], [145, 153]];
    const second: Limb = action === "yoga" ? [[125, 151], [152, 154]] : bench ? [[82, 109], [62, 112]] : [[118, 151], [138, 152]];
    const heels = action === "heels" || action === "straight" || action === "slides";
    const frontToe = add(frontFoot, 7, heels ? -8 : (front === "vertical" ? -6 : 0));
    const backToe = add(backFoot, 7, heels ? -8 : (back === "vertical" ? -6 : 0));
    return pose([head, shoulder, hips], first, second, [frontKnee, frontFoot], [backKnee, backFoot], frontToe, backToe);
  }
  const low = frame(0), high = frame(1);
  let frames = [low, high];
  if (action === "abduct") frames = [low, high, frame(1, "", "", "abduct"), high];
  if (action === "wide-pulse") frames = [low, high, frame(.72), high, frame(.72), high];
  if (action === "slides") frames = [low, high, frame(.9, "", "", "slide"), high];
  if (action === "walk") frames = [high, frame(1, "step"), frame(1, "", "", "shift"), frame(1, "", "step"), high];
  if (action === "walk-side") frames = [high, frame(1, "out"), frame(1, "out", "out"), frame(1, "", "out"), high];
  if (action === "side") frames = [high, frame(1, "", "", "shift"), high, frame(1, "", "", "left")];
  if (action === "march") frames = [high, frame(1, "tuck"), high, frame(1, "", "tuck"), high];
  if (action === "single") frames = [frame(0, "", "line"), frame(1, "", "line")];
  if (action === "single-left" || action === "single-hold-left") {
    const locked = frame(1, "line");
    frames = action === "single-hold-left" ? [frame(0, "line"), locked, locked, locked, locked] : [frame(0, "line"), locked];
  }
  if (action === "single-flex") frames = [frame(0, "", "tuck"), frame(1, "", "tuck")];
  if (action === "single-rotate") frames = [frame(0, "", "lift"), frame(1, "", "lift"), frame(1, "", "rotate"), frame(1, "", "lift")];
  if (action === "alternating-straight") frames = [low, high, frame(1, "vertical"), high, frame(1, "", "vertical"), high];
  if (action === "alternating-bent") frames = [frame(0, "", "lift"), frame(1, "", "lift"), high, frame(1, "lift"), frame(0, "lift"), low];
  if (action === "single-jump") frames = [frame(0, "", "lift"), frame(1.2, "", "lift", "air"), frame(.86, "", "lift")];
  return loop(frames, stage, attachments, action === "single-jump" ? 480 : 780);
}

type SideBridge = { support?: "elbow" | "knee" | "bench" | "straps" | "staggered"; style?: "hold" | "star" | "swing" | "rotate"; dumbbell?: boolean };
function sideBridge({ support = "elbow", style = "hold", dumbbell = false }: SideBridge = {}) {
  const bent = support === "knee", straps = support === "straps", bench = support === "bench";
  const fixtures = bench ? benchDeck(211, 262, 118) : straps ? hanger(265) : [];
  const dynamic: Attachments = [];
  if (dumbbell) dynamic.push(["dumbbell", 4, 0, -2]);
  if (straps) dynamic.push(["cable", 8, 243, 25], ["cable", 10, 248, 25], ["ring", 8, 0, 1], ["ring", 10, 0, 1]);
  function make(lift: boolean, stage = "") {
    const shoulder: Point = [101, stage === "rotate" ? 117 : 109];
    const hips: Point = [155, lift ? bench ? 113 : straps ? 119 : 127 : 146];
    const first: Limb = dumbbell ? [[133, 104], add(hips, -1, -6)] : [[130, 104], add(hips, 2, -9)];
    if (stage === "star" || stage === "reach") { first[0] = [99, 83]; first[1] = [91, 58]; }
    if (stage === "swing") { first[0] = [120, 93]; first[1] = [169, 95]; }
    if (stage === "rotate") { first[0] = [125, 134]; first[1] = [144, 146]; }
    const farLeg: Limb = bent ? [[191, 153], [164, 152]] : straps ? [[195, 126], [233, 128]] : [[192, 144], [236, 154]];
    let nearLeg: Limb = bent ? [[186, 148], [162, 149]]
      : bench ? [[194, 114], [229, 116]] : straps ? [[193, 121], [231, 123]]
        : support === "staggered" ? [[191, 136], [223, 155]] : [[191, 141], [232, 150]];
    if (stage === "star") nearLeg = [[184, 108], [219, 78]];
    if (stage === "swing") nearLeg = [[177, 102], [197, 86]];
    return pose([add(shoulder, -17, -3), shoulder, hips], first, [[102, 151], [137, 153]], nearLeg, farLeg);
  }

  const ground = make(false), high = make(true);
  if (style === "star") return loop([ground, high, make(true, "star"), make(true, "star"), high], fixtures, dynamic, 880);
  if (style === "swing") return loop([high, make(true, "star"), make(true, "swing"), high], fixtures, dynamic);
  if (style === "rotate") return loop([high, make(true, "reach"), make(true, "rotate"), high], fixtures, dynamic);
  return loop([ground, high, high, high, high], fixtures, dynamic, 1000);
}

function tabletop(style: "lift" | "jack" | "rotate") {
  function make(mode: "low" | "top" | "air" | "wide" | "rotate") {
    const low = mode === "low";
    const shoulder: Point = [110, low ? 111 : 105];
    const hips: Point = [160, low ? 149 : 106];
    const frontKnee: Point = [mode === "wide" ? 218 : 206, 108];
    const backKnee: Point = [mode === "wide" ? 174 : 191, 109];
    const frontFoot: Point = [mode === "wide" ? 226 : 209, mode === "air" ? 146 : 155];
    const backFoot: Point = [mode === "wide" ? 177 : 196, mode === "air" ? 145 : 154];
    const first: Limb = mode === "rotate" ? [[128, 86], [133, 54]] : [[105, 128], [102, 154]];
    return pose([add(shoulder, -12, -15), shoulder, hips], first, [[94, 128], [91, 154]],
      [frontKnee, frontFoot], [backKnee, backFoot]);
  }
  const top = make("top");
  return loop(style === "lift" ? [make("low"), top] : style === "jack" ? [top, make("air"), make("wide"), make("air"), top]
    : [top, make("rotate"), top], [], [], style === "jack" ? 490 : 860);
}

type StandingLeg = {
  action: "abduct" | "extend";
  load?: "none" | "band" | "anchored-band" | "cable" | "lever" | "bosu" | "strap";
  bent?: boolean;
  tilted?: boolean;
  toe?: "in" | "out";
};

function standingLeg({ action, load = "none", bent = false, tilted = false, toe }: StandingLeg) {
  const sideways = action === "abduct";
  const bosu = load === "bosu", suspended = load === "strap", lever = load === "lever";
  const pulleyX = sideways ? 69 : 245;
  const supportX = sideways ? 107 : 226;
  const balance = !bosu && !bent;
  const floor = bosu ? 138 : 155;
  const props = load === "cable" ? tower(pulleyX) : load === "anchored-band" || lever ? anchorPost(pulleyX, lever ? 60 : 108)
    : suspended ? hanger(106) : [];
  if (balance && !lever) props.push(...anchorPost(supportX, 77));
  if (lever) props.push([supportX, 83, pulleyX, 83]);
  if (bosu) props.push([125, 156, 171, 156], [125, 156, 129, 147], [129, 147, 137, 141], [137, 141, 148, 138],
    [148, 138, 158, 137], [158, 137, 165, 145], [165, 145, 171, 156]);
  const dyn: Attachments = [];
  if (load === "cable") dyn.push(["cable", 8, pulleyX, 146], ["pad", 8, 0, -4]);
  if (load === "anchored-band") dyn.push(["band", 8, pulleyX, 146]);
  if (load === "band" || bosu) {
    if (bent) dyn.push(["knee-band", 7, 9]);
    else dyn.push(["band", 8, 10]);
  }
  if (suspended) dyn.push(["cable", 8, 100, 25], ["ring", 8, 1, 2]);
  if (lever) dyn.push(["bar", 7, pulleyX, 109], ["pad", 7, sideways ? 9 : -8, 11], ["barbell-end", 7, sideways ? 20 : 30, 4]);

  function make(high: boolean) {
    const hip: Point = [154, floor - 64];
    const shoulder: Point = tilted ? [182, floor - 97] : [157, floor - 104];
    const head = add(shoulder, tilted ? 12 : 2, -16);
    const planted: Limb = [[146, floor - 32], [144, floor]];
    let active: Limb;
    if (sideways) active = high ? bent ? [[183, floor - 56], [164, floor - 31]]
      : suspended ? [[182, floor - 57], [201, 95]] : [[186, floor - 43], [219, floor - 22]]
      : bent ? [[164, floor - 30], [149, floor - 7]] : [[161, floor - 32], [163, floor - (suspended ? 14 : 2)]];
    else active = high ? [[129, floor - 38], [102, floor - (tilted ? 23 : 18)]]
      : [[155, floor - 30], [158, floor - 3]];
    const first: Limb = balance ? [[sideways ? 128 : 194, floor - 87], [supportX, floor - 72]] : [[177, floor - 80], [165, floor - 70]];
    const second: Limb = sideways ? [[177, floor - 83], [163, floor - 69]]
      : [[178, floor - 86], [supportX - 7, floor - 72]];
    const foot = add(active[1], sideways && toe === "in" ? -12 : toe === "out" ? 12 : 8, sideways && toe ? -1 : 2);
    return pose([head, shoulder, hip], first, second, active, planted, foot);
  }
  return loop([make(false), make(true)], props, dyn);
}

type Kick = {
  load?: "none" | "band-post" | "band-hand" | "cable" | "smith";
  action?: "bent" | "straight" | "cross" | "abduct";
  base?: "mat" | "bench-knee" | "bench-hands";
  left?: boolean;
};

function kickback({ load = "none", action = "straight", base = "mat", left = false }: Kick = {}) {
  const benchKnees = base === "bench-knee", benchHands = base === "bench-hands";
  const props: Props = benchKnees ? benchDeck(98, 220, 127) : benchHands ? benchDeck(197, 253, 114) : [];
  const moving = left ? 10 : 8;
  const nearbyCable = action === "abduct" ? 72 : 248;
  const height = benchKnees ? 31 : 0;
  if (load === "cable") props.push(...tower(nearbyCable));
  if (load === "band-post") props.push(...anchorPost(239, 103));
  if (load === "smith") props.push([64, 27, 64, 157], [116, 27, 116, 157], [64, 27, 116, 27],
    [58, 157, 126, 157], [69, 30, 69, 153], [111, 30, 111, 153]);
  const dyn: Attachments = [];
  if (load === "cable") dyn.push(["cable", moving, nearbyCable, 146], ["pad", moving, 0, -4]);
  if (load === "band-post") dyn.push(["band", moving, 239, 146]);
  if (load === "band-hand") dyn.push(["band", moving, 4]);
  if (load === "smith") dyn.push(["bar", 13, 14], ["barbell-end", 13, -14, 0]);
  function make(phase: "low" | "peak" | "cross") {
    const ground = phase === "low";
    const hip: Point = [130, (benchHands ? 92 : 116) - height];
    const shoulder: Point = [175, (benchHands ? 84 : 115) - height];
    const planted: Limb = benchHands ? [[142, 122], [146, 154]] : [[137, 152 - height], [102, 154 - height]];
    const bent = action === "bent" || action === "cross" || action === "abduct";
    let active: Limb;
    if (ground && bent) active = [[126, 148 - height], [96, (load === "smith" ? 127 : 152) - height]];
    else if (ground) active = [[103, 134 - height], [75, 153 - height]];
    else if (phase === "cross") active = [[115, 132 - height], [99, 105 - height]];
    else if (action === "abduct") active = [[115, 117 - height], [84, 127 - height]];
    else if (bent) active = [[98, 116 - height], [93, 84 - height]];
    else active = [[94, hip[1] + 4], [60, hip[1] + 3]];
    const frontArm: Limb = benchHands ? [[196, 100], [224, 111]] : [[176, 133 - height], [180, 154 - height]];
    const rearArm: Limb = benchHands ? [[191, 103], [218, 111]] : [[171, 132 - height], [171, 154 - height]];
    const legs: [Limb, Limb] = left ? [planted, active] : [active, planted];
    const figure = pose([add(shoulder, 14, -10), shoulder, hip], frontArm, rearArm, ...legs,
      add(legs[0][1], !left && !ground && bent ? 7 : -6, !left && !ground && bent ? -2 : 1),
      add(legs[1][1], left && !ground && bent ? 7 : -6, left && !ground && bent ? -2 : 1));
    if (load === "smith") figure.push(add(active[1], 1, -4), [111, active[1][1] - 4]);
    return figure;
  }
  const low = make("low");
  const high = make("peak");
  return loop(action === "cross" ? [low, high, low, make("cross"), low] : [low, high], props, dyn);
}

function lyingLeg(action: "single" | "alternate" | "clam" | "side-cable") {
  const side = action === "clam" || action === "side-cable";
  const cable = action === "side-cable";
  const attachments: Attachments = cable ? [["cable", 8, 254, 146], ["pad", 8, 0, -4]]
    : action === "clam" ? [["knee-band", 7, 9]] : [];
  const props = cable ? tower(254) : [];
  function make(move: "none" | "near" | "far") {
    const body: Body = [[87, 142], [106, 144], [153, 144]];
    const first: Limb = side ? [[122, 151], [134, 156]] : [[101, 152], [84, 151]];
    const second: Limb = [[104, 154], [86, 154]];
    const near: Limb = action === "clam" ? [[187, move === "near" ? 122 : 139], [211, 153]]
      : [[193, move === "near" ? cable ? 133 : 139 : 149], [228, move === "near" ? cable ? 121 : 131 : 153]];
    const far: Limb = action === "clam" ? [[186, 145], [209, 154]]
      : [[190, move === "far" ? 140 : 151], [221, move === "far" ? 135 : 154]];
    return pose(body, first, second, near, far);
  }
  const neutral = make("none");
  return loop(action === "alternate" ? [neutral, make("near"), neutral, make("far")] : [neutral, make("near")], props, attachments);
}

function kneelingThrust(smith: boolean) {
  const rack: Props = smith ? [[114, 28, 114, 158], [186, 28, 186, 158], [114, 28, 186, 28], [106, 157, 194, 157],
    [117, 32, 117, 151], [182, 32, 182, 151], [114, 139, 124, 139], [176, 139, 186, 139]] : [];
  const weight: Attachments = smith ? [["bar", 13, 14], ["barbell-end", 13, -3, 0], ["pad", 13, 9, 0]] : [];
  function make(push: boolean) {
    const hips: Point = push ? [150, 118] : [smith ? 139 : 129, 137];
    const shoulder: Point = push ? [153, 76] : [149, 98];
    const first: Limb = [add(shoulder, 12, 19), add(hips, 11, 1)];
    const second: Limb = [add(shoulder, -9, 17), add(hips, -8, 0)];
    const frame = pose([add(shoulder, 4, -16), shoulder, hips], first, second,
      [[152, 153], [115, 155]], [[147, 153], [110, 155]], [107, 156], [102, 156]);
    if (smith) frame.push(add(hips, 0, -3), [183, hips[1] - 3]);
    return frame;
  }
  return loop([make(false), make(true)], rack, weight);
}

function standingThrust(machine: boolean) {
  const props: Props = machine ? [[107, 149, 206, 149], [107, 149, 107, 158], [206, 149, 206, 158],
    [236, 56, 236, 158], [218, 158, 251, 158], [219, 112, 237, 112], [201, 75, 235, 75]] : tower(64);
  const dyn: Attachments = machine ? [["bar", 2, 234, 124], ["pad", 2, 5, -2], ["barbell-end", 2, 53, 9]]
    : [["cable", 2, 66, 146], ["pad", 2, 0, -1]];
  const floor = machine ? 146 : 155;
  const make = (push: boolean) => {
    const hips: Point = [push ? 153 : 124, floor - (push ? 65 : 60)];
    const shoulder: Point = [push ? 155 : 157, floor - (push ? 105 : 85)];
    const first: Limb = machine ? [[181, 86], [206, 75]] : [add(shoulder, 12, 18), add(hips, 19, 4)];
    const second: Limb = machine ? [[175, 84], [198, 76]] : [add(shoulder, 4, 22), add(hips, 11, 6)];
    const foot: Point = [158, floor], farFoot: Point = [150, floor - 2];
    const legs: [Limb, Limb] = [[[push ? 156 : 148, floor - 33], foot], [[push ? 149 : 141, floor - 33], farFoot]];
    return pose([add(shoulder, 3, -16), shoulder, hips], first, second, ...legs);
  };
  return loop([make(false), make(true)], props, dyn);
}

function machineIsometric() {
  const base: Props = [[90, 157, 217, 157], [96, 157, 96, 107], [214, 157, 214, 107], [109, 157, 109, 101],
    [200, 157, 200, 101], [111, 154, 198, 154]];
  const dyn: Attachments = [["bar", 7, 216, 149], ["bar", 9, 95, 149], ["pad", 7, 8, 0], ["pad", 9, -8, 0]];
  const make = (hold: boolean) => {
    const head: Point = [153, hold ? 65 : 47], shoulder: Point = [152, hold ? 81 : 63], hips: Point = [149, hold ? 122 : 105];
    return pose([head, shoulder, hips], [[174, 104], [196, 104]], [[129, 103], [112, 102]],
      [[hold ? 183 : 174, 132], [176, 152]], [[hold ? 118 : 130, 132], [125, 151]], [184, 153], [117, 152]);
  };
  const hold = make(true);
  return loop([make(false), hold, hold, hold, hold], base, dyn, 990);
}

function hipOpeningStretch() {
  const make = (bend: boolean) => {
    const hip: Point = [136, 146];
    const shoulder: Point = bend ? [168, 124] : [141, 106];
    return pose([add(shoulder, bend ? 14 : 4, bend ? -3 : -17), shoulder, hip],
      [[163, bend ? 141 : 126], [196, 155]], [[151, 137], [170, 155]],
      [[192, 149], [167, 153]], [[101, 144], [86, 153]], [159, 154], [80, 154]);
  };
  const stretch = make(true);
  return loop([make(false), stretch, stretch, stretch], [], [], 890);
}

const basicBridge = bridge();
const stiffBridge = bridge({ action: "single" });
const straightKick = kickback();
const supportedExtension = standingLeg({ action: "extend" });
const bandStanding = standingLeg({ action: "extend", load: "anchored-band" });
const cableKickback = standingLeg({ action: "extend", load: "cable" });
const sideHold = sideBridge();

export const hipBridgeIllustrations: Record<string, Illustration> = {
  "4031": standingLeg({ action: "abduct", load: "anchored-band" }),
  "3034": kickback({ action: "bent" }),
  "5810": kickback({ action: "bent" }),
  "0556": kickback({ action: "bent" }),
  "4881": bridge({ action: "abduct" }),
  "2756": standingLeg({ action: "abduct", load: "cable", toe: "in" }),
  "2755": standingLeg({ action: "abduct", load: "cable", toe: "out" }),
  "6739": kickback({ action: "abduct", load: "cable" }),
  "9863": lyingLeg("side-cable"),
  "2744": standingThrust(false),
  "6570": bridge({ action: "walk" }),
  "6435": bridge({ action: "heels" }),
  "2767": standingLeg({ action: "abduct" }),
  "1903": hipOpeningStretch(),
  "4669": kneelingThrust(false),
  "4772": straightKick,
  "6209": kickback({ left: true }),
  "7384": bridge({ base: "machine" }),
  "10113": machineIsometric(),
  "1034": standingLeg({ action: "abduct", load: "lever" }),
  "11054": bridge({ base: "machine", action: "stagger" }),
  "9848": standingThrust(true),
  "1049": kickback({ base: "bench-hands" }),
  "2149": kickback({ action: "bent", load: "band-post" }),
  "7198": bridge({ action: "abduct", band: true }),
  "10870": bridge({ action: "walk-side", band: true }),
  "7208": kickback({ load: "band-hand" }),
  "11059": kickback({ load: "band-post", base: "bench-knee" }),
  "7281": standingLeg({ action: "extend", load: "band" }),
  "7199": lyingLeg("clam"),
  "2161": bandStanding,
  "3903": standingLeg({ action: "extend", load: "anchored-band", tilted: true }),
  "10820": standingLeg({ action: "abduct", load: "band", bent: true }),
  "8085": standingLeg({ action: "abduct", load: "band" }),
  "0703": sideBridge({ style: "star" }),
  "5167": bridge({ action: "single-rotate" }),
  "4793": bridge({ base: "shoulders", action: "single-jump" }),
  "4794": bridge({ action: "single-jump" }),
  "6001": bridge({ action: "single-hold-left" }),
  "3874": kneelingThrust(true),
  "3114": straightKick,
  "1077": standingLeg({ action: "abduct", load: "strap" }),
  "9314": hingeIllustrations["5813"],
  "0901": bandStanding, "4034": bandStanding, "11570": bandStanding,
  "10651": standingLeg({ action: "abduct", load: "bosu" }),
  "6316": kickback({ action: "cross" }),
  "4511": bridge({ action: "yoga" }),
  "0145": basicBridge,
  "4421": kickback({ action: "bent", load: "cable" }),
  "0880": cableKickback, "11259": cableKickback,
  "3337": sideBridge({ dumbbell: true }),
  "4457": sideBridge({ support: "knee", dumbbell: true }),
  "10549": bridge({ base: "feet", action: "single" }),
  "4762": { ...hingeIllustrations["4764"], frames: hingeIllustrations["4764"].frames.slice(0, 2) },
  "2769": supportedExtension,
  "2112": basicBridge,
  "0486": basicBridge, "0485": basicBridge,
  "0568": sideBridge({ support: "bench" }),
  "1031": standingLeg({ action: "extend", load: "lever" }),
  "9324": supportedExtension,
  "0614": lyingLeg("alternate"),
  "1776": lyingLeg("single"),
  "0632": bridge({ base: "feet", action: "narrow" }),
  "7999": hingeIllustrations["3875"],
  "2166": bridge({ action: "march", band: true }),
  "2863": bridge({ action: "alternating-straight" }),
  "0706": sideHold,
  "3584": sideBridge({ style: "swing" }),
  "5047": sideBridge({ support: "knee" }),
  "4458": sideHold,
  "0722": bridge({ action: "side" }),
  "0726": stiffBridge,
  "3583": bridge({ action: "single-flex" }),
  "3435": stiffBridge,
  "5774": bridge({ base: "shoulders", action: "alternating-bent" }),
  "3498": bridge({ action: "slides" }),
  "6038": kickback({ action: "bent", load: "smith" }),
  "4894": sideBridge({ support: "staggered" }),
  "2737": supportedExtension,
  "4255": bridge({ action: "straight" }),
  "1078": bridge({ base: "suspension" }),
  "1098": sideBridge({ support: "straps" }),
  "4800": tabletop("lift"),
  "10057": tabletop("jack"),
  "4801": tabletop("rotate"),
  "0820": sideBridge({ style: "rotate" }),
  "5805": bridge({ action: "wide-pulse" }),
};
