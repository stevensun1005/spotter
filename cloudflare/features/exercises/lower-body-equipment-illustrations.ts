import type { Illustration, Point } from "./motion-data";
import { lowerBodyIllustrations } from "./lower-body-illustrations";
import { hipBridgeIllustrations } from "./hip-bridge-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

const floor = 157;

function at([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function byAngle([x, y]: Point, degrees: number, length: number): Point {
  const theta = degrees * Math.PI / 180;
  return [x + Math.sin(theta) * length, y - Math.cos(theta) * length];
}

function figure(shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb,
  toes: [Point, Point] = [at(nearLeg[1], 8, 0), at(farLeg[1], 7, 0)]): Point[] {
  return [at(shoulder, 4, -14), shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, ...toes];
}

function demo(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 820): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...attachments], ms, reference: true };
}

const bench = (x: number, right: number, level: number): Props =>
  [[x, level, right, level], [x + 6, level, x + 6, 158], [right - 6, level, right - 6, 158]];
const pulley = (x: number): Props => [
  [x, 29, x, 157], [x + 10, 31, x + 10, 156], [x - 7, 157, x + 18, 157], [x, 145, x + 7, 145], [x, 29, x + 10, 31],
];

type Upright = "lever" | "chair" | "pendulum" | "deep" | "single" | "abduct" | "belt" | "belt-split" | "smith" | "smith-deep" | "side-band";
function uprightSquat(kind: Upright) {
  const belted = kind === "belt" || kind === "belt-split";
  const smith = kind === "smith" || kind === "smith-deep";
  const split = kind === "belt-split" || kind === "side-band";
  const pendulum = kind === "pendulum";
  const wide = kind === "abduct";
  const single = kind === "single";
  const lever = !belted && !smith && kind !== "side-band";
  const pivot: Point = [pendulum ? 231 : 241, pendulum ? 21 : 58];
  const platform = !smith && kind !== "side-band";
  const props: Props = platform ? [[122, 152, 206, 152], [122, 152, 122, 158], [206, 152, 206, 158], [97, 158, 268, 158]] : [];
  if (kind === "chair") props.push(...bench(84, 133, 133), [88, 133, 88, 96]);
  if (belted) props.push([241, 118, 241, 158], [230, 121, 254, 121], [140, 151, 185, 151]);
  if (kind === "belt-split") props.push(...bench(75, 113, 123));
  if (smith) props.push([93, 29, 93, 158], [191, 29, 191, 158], [102, 34, 102, 151], [182, 34, 182, 151],
    [93, 29, 191, 29], [86, 158, 200, 158]);
  if (lever) props.push([pivot[0], pivot[1], pivot[0], 158], [pivot[0] - 13, pivot[1], pivot[0] + 13, pivot[1]]);
  if (kind === "side-band") props.push([78, 65, 78, 158], [67, 158, 93, 158]);

  const dynamic: Attachments = [];
  if (belted) dynamic.push(["pad", 2, 3, 2], ["cable", 2, 157, 151], ["bar", 13, 241, 123], ["barbell-end", 13, 2, 0]);
  if (smith) dynamic.push(["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0],
    ["band", 4, 181, 154], ["band", 6, 103, 154]);
  if (lever) dynamic.push(["bar", 13, ...pivot], ["pad", 13, -1, 3], ["barbell-end", 14, 0, 0], ["line", 1, 15]);
  if (kind === "side-band") dynamic.push(["band", 7, 78, 118]);

  function make(depth: number, abducting = false): Point[] {
    const floorY = platform ? 149 : 156;
    const high = split ? 94 : 86;
    const displacement = kind === "deep" || kind === "smith-deep" || single ? 42 : 36;
    const hip: Point = [split ? 145 + 2 * depth : smith || wide ? 145 : 143 - depth * (pendulum ? 21 : 15), high + displacement * depth];
    const shoulder: Point = [smith ? 145 : hip[0] + (pendulum ? 18 : 8) * depth, hip[1] - 38];
    const foot: Point = [wide ? 179 : split ? 179 : 160, floorY];
    const other: Point = kind === "belt-split" ? [108, 121] : [split ? 96 : wide ? 116 : 143, kind === "side-band" ? floor - 1 : floorY - 1];
    const reach: Limb = [[shoulder[0] + 16, shoulder[1] + 13], [shoulder[0] + 28, shoulder[1] + 7]];
    const reachFar: Limb = [[shoulder[0] - 8, shoulder[1] + 15], [shoulder[0] + 17, shoulder[1] + 7]];
    const onBar: Limb = [[shoulder[0] + 17, shoulder[1] + 13], at(shoulder, 14, -3)];
    const onFarBar: Limb = [[shoulder[0] - 23, shoulder[1] + 11], at(shoulder, -12, -3)];
    const nearKnee: Point = wide ? [172 + (abducting ? 12 : 1), floorY - (floorY - hip[1]) * .5] : [split ? 175 : 155 + 21 * depth, 115 + depth * 7];
    const farKnee: Point = split ? [117, 119 + depth * 32] : wide ? [125 - (abducting ? 12 : 1), floorY - (floorY - hip[1]) * .5]
      : [137 + 21 * depth, 115 + depth * 8];
    const farLeg: Limb = single ? [[hip[0] + 28, hip[1] + 7], [hip[0] + 60, hip[1] + 16]] : [farKnee, other];
    const toes: [Point, Point] = [at(foot, 8, 0), single ? at(farLeg[1], 7, -2) : at(other, wide ? -8 : split ? -7 : 7, 0)];
    const frame = figure(shoulder, hip, smith ? onBar : reach, smith ? onFarBar : reachFar, [nearKnee, foot], farLeg, toes);
    const shoulderPad = at(shoulder, -8, -5);
    const plate = at(shoulderPad, pendulum ? 44 : 32, pendulum ? -19 : -10);
    return [...frame, belted ? [158 + depth * 15, 148 - depth * 15] : shoulderPad, plate, at(hip, -8, 0)];
  }

  const bottom = make(1), top = make(0);
  return demo(wide ? [top, bottom, make(.3, true), top] : [top, bottom], props, dynamic, 760);
}

function seatedLever(wide = false, single = false) {
  const props: Props = [[76, 158, 263, 158], [225, 74, 225, 157], [227, 83, 246, 83], [225, 89, 241, 89],
    [218, 155, 242, 155], [213, 95, 215, 130], [231, 82, 244, 158]];
  const farFoot: Point = [211, wide ? 122 : 115];
  const nearFoot: Point = [211, wide ? 99 : 109];
  function make(press: boolean): Point[] {
    const hip: Point = [press ? 144 : 169, press ? 108 : 117];
    const shoulder: Point = at(hip, -13, -39);
    const nearKnee: Point = press ? [178, nearFoot[1] - 10] : [182, nearFoot[1] - 25];
    const farKnee: Point = press ? [175, farFoot[1] - 9] : [181, farFoot[1] - 25];
    const far: Limb = single ? [[hip[0] + 10, hip[1] + 15], [hip[0] + 21, Math.min(154, hip[1] + 34)]] : [farKnee, farFoot];
    const arm: Limb = [at(shoulder, 19, 12), at(shoulder, 9, -1)];
    const otherArm: Limb = [at(shoulder, 8, 16), at(shoulder, -2, 3)];
    const frame = figure(shoulder, hip, arm, otherArm, [nearKnee, nearFoot], far,
      [at(nearFoot, 1, -10), single ? at(far[1], 6, 1) : at(farFoot, 1, -10)]);
    return [...frame, at(shoulder, -8, -8), at(hip, -7, 7), at(hip, 21, 7), at(hip, -16, 5)];
  }
  return demo([make(false), make(true)], props,
    [["bar", 13, 14], ["pad", 13, 7, 0], ["bar", 14, 15], ["bar", 16, 225, 90], ["barbell-end", 16, 0, 0]]);
}

function benchCalf() {
  const fixture: Props = [...bench(81, 132, 126), [88, 88, 111, 125], [222, 70, 222, 156],
    [219, 72, 249, 72], [209, 104, 213, 127], [130, 157, 249, 157]];
  const shoulder: Point = [93, 83], hip: Point = [120, 119];
  const nearToe: Point = [211, 107], farToe: Point = [208, 112];
  const grips: [Limb, Limb] = [[[103, 105], [124, 121]], [[99, 104], [114, 122]]];
  const make = (dropped: boolean) => figure(shoulder, hip, ...grips,
    [[159, 119], dropped ? [204, 116] : [197, 101]],
    [[154, 123], dropped ? [201, 121] : [194, 106]], [nearToe, farToe]);
  return demo([make(true), make(false), make(false)], fixture, [["bar", 11, 221, 91], ["barbell-end", 11, 11, -4]], 780);
}

function leverHack(single = false): Illustration {
  const base = lowerBodyIllustrations[single ? "1579" : "6523"];
  const frame: Props = [[214, 54, 214, 158], [204, 54, 227, 54], [96, 158, 247, 158], [139, 155, 201, 147]];
  const attachments: Attachments = [["bar", 11, 214, 54], ["barbell-end", 11, 23, 1], ["line", 11, 12], ["pad", 11, 0, 0], ["face", 0, 13]];
  return { ...base, props: frame, dynamic: attachments };
}

function proneKneeFlexion() {
  const fixture: Props = [[82, 110, 158, 110], [91, 114, 91, 158], [143, 114, 143, 158],
    [72, 158, 213, 158], [160, 111, 160, 158], [157, 108, 165, 108], [65, 120, 80, 120], [74, 120, 91, 144]];
  const grips: [Limb, Limb] = [[[88, 116], [68, 119]], [[96, 112], [77, 120]]];
  function make(flexed: boolean): Point[] {
    const knee: Point = [161, 109], farKnee: Point = [159, 109];
    const foot: Point = flexed ? [144, 77] : [196, 119];
    const farFoot: Point = at(foot, -4, 4);
    const frame = figure([91, 100], [127, 102], ...grips, [knee, foot], [farKnee, farFoot],
      [at(foot, -6, 7), at(farFoot, -7, 6)]);
    frame[0] = [77, 98];
    return [...frame, at(foot, -1, -7), at(farFoot, -1, -7)];
  }
  return demo([make(false), make(true), make(true)], fixture,
    [["bar", 13, 160, 108], ["pad", 13, -1, 0], ["pad", 14, -1, 0], ["barbell-end", 13, 13, -4]], 850);
}

function negativePress() {
  const base = lowerBodyIllustrations["2224"];
  const [low, high] = base.frames;
  const blend = (amount: number, near: boolean) => {
    const frame = high.map(([x, y], index): Point => [x + (low[index][0] - x) * amount, y + (low[index][1] - y) * amount]);
    const index = near ? 9 : 7;
    frame[index] = [frame[2][0] + 22, frame[2][1] + 5];
    frame[index + 1] = [frame[2][0] + 26, Math.min(154, frame[2][1] + 29)];
    return frame;
  };
  return { ...base, frames: [low, high, blend(0, true), blend(.33, true), blend(.67, true), blend(1, true),
    low, high, blend(0, false), blend(.33, false), blend(.67, false), blend(1, false)], ms: 820 };
}

function gluteHam(kind: "floor-band" | "ghd" | "band-chest" | "band-hands" | "arms-forward") {
  const grounded = kind === "floor-band";
  const assisted = grounded || kind.startsWith("band");
  const rack: Props = grounded ? [[91, 148, 126, 148], [95, 148, 95, 158], [121, 148, 121, 158]]
    : [[100, 107, 150, 107], [110, 112, 152, 112], [136, 112, 136, 158], [81, 158, 168, 158], [84, 78, 84, 152],
      [84, 92, 105, 92], [84, 108, 104, 108]];
  if (assisted) rack.push([250, 37, 250, 158], [238, 37, 259, 37], [236, 158, 262, 158]);
  const anchor: Point = grounded ? [158, 154] : [144, 102];
  const ankles: [Point, Point] = grounded ? [[113, 154], [109, 155]] : [[92, 99], [96, 103]];
  const armsForward = kind === "arms-forward";
  const attachments: Attachments = assisted ? [["band", kind === "band-hands" ? 4 : 1, 249, 38]] : [];
  function make(degrees: number) {
    const hip = byAngle(anchor, degrees, 30);
    const shoulder = byAngle(anchor, degrees, 69);
    const arms: [Limb, Limb] = armsForward ? [[at(shoulder, 19, 8), at(shoulder, 37, 6)], [at(shoulder, 13, 6), at(shoulder, 32, 7)]]
      : [[at(shoulder, 11, 18), at(shoulder, 17, 7)], [at(shoulder, -3, 15), at(shoulder, 13, 8)]];
    const firstToe = at(ankles[0], -8, grounded ? 0 : 3);
    const secondToe = at(ankles[1], -7, grounded ? 0 : 2);
    const frame = figure(shoulder, hip, ...arms, [anchor, ankles[0]], [at(anchor, -7, 1), ankles[1]], [firstToe, secondToe]);
    frame[0] = byAngle(anchor, degrees, 84);
    return frame;
  }
  const low = make(grounded ? 74 : 98), high = make(grounded ? 6 : 14);
  return demo([low, make(53), high, make(54)], rack, attachments, 800);
}

function reformer(kind: "split" | "squat" | "side" | "frog") {
  const rail: Props = [[61, 151, 269, 151], [61, 145, 269, 145], [71, 151, 71, 158], [257, 151, 257, 158],
    [217, 126, 261, 126], [228, 126, 228, 146], [260, 126, 260, 151], [265, 92, 265, 151]];
  const frog = kind === "frog";
  const spring: Attachments = [["bar", 13, 14], ["line", 13, 73, 149], ["pad", 13, 9, 1], ["pad", 14, -9, 1]];
  if (frog) spring.push(["cable", 8, 264, 97], ["cable", 10, 267, 101], ["ring", 8, 0, 2], ["ring", 10, 0, 2]);

  function frogFrame(phase: "frog" | "long" | "out" | "down"): Point[] {
    const flow: Record<typeof phase, [Limb, Limb]> = {
      frog: [[[182, 100], [189, 93]], [[153, 102], [184, 95]]],
      long: [[[189, 105], [221, 87]], [[182, 105], [214, 88]]],
      out: [[[199, 95], [233, 69]], [[181, 112], [215, 118]]],
      down: [[[194, 113], [230, 114]], [[189, 110], [224, 111]]],
    };
    const shift = phase === "frog" ? 0 : phase === "long" ? -6 : -11;
    const shoulder: Point = [107 + shift, 116], hip: Point = [153 + shift, 117];
    const [near, far] = flow[phase];
    const frame = figure(shoulder, hip, [[128 + shift, 121], [150 + shift, 124]], [[122 + shift, 122], [144 + shift, 124]],
      near, far, [at(near[1], 6, -4), at(far[1], 6, -4)]);
    frame[0] = [90 + shift, 114];
    return [...frame, [83 + shift, 126], [172 + shift, 126]];
  }

  function stand(move: boolean): Point[] {
    const shift = move ? kind === "side" ? -48 : kind === "split" ? -28 : -9 : 0;
    const nearFoot: Point = [229, 123], farFoot: Point = [171 + shift, 123];
    const hip: Point = [kind === "side" ? 199 + shift / 2 : move ? 194 + shift / 3 : 198, move && kind !== "side" ? 91 : 60];
    const shoulder: Point = at(hip, kind === "side" ? 0 : 4, -34);
    const arms: [Limb, Limb] = kind === "side"
      ? [[at(shoulder, 22, 5), at(shoulder, 40, 9)], [at(shoulder, -22, 5), at(shoulder, -39, 9)]]
      : [[at(shoulder, 12, 17), at(shoulder, 25, 12)], [at(shoulder, -13, 18), at(shoulder, 11, 12)]];
    const nearKnee: Point = [move && kind !== "side" ? 225 : (hip[0] + nearFoot[0]) / 2, (hip[1] + 123) / 2 + (move && kind !== "side" ? -4 : 0)];
    const squat = kind === "squat" && move;
    const farKnee: Point = [kind === "split" && move ? 166 : (hip[0] + farFoot[0]) / 2 + (squat ? 16 : 0),
      (hip[1] + 123) / 2 + (kind === "split" && move ? 10 : squat ? -5 : 0)];
    const frame = figure(shoulder, hip, ...arms, [nearKnee, nearFoot], [farKnee, farFoot],
      [at(nearFoot, 9, 0), at(farFoot, kind === "side" ? -8 : 8, 0)]);
    return [...frame, [111 + shift, 126], [199 + shift, 126]];
  }

  return demo(frog ? [frogFrame("frog"), frogFrame("long"), frogFrame("out"), frogFrame("down"), frogFrame("long")]
    : [stand(false), stand(true), stand(true)], rail, spring, 750);
}

function tibialis(seated = false) {
  const wall: Props = seated ? [] : [[114, 24, 114, 158]];
  const make = (up: boolean) => {
    const shoulder: Point = seated ? [114, 105] : [123, 52];
    const hip: Point = seated ? [134, 149] : [122, 96];
    const feet: [Point, Point] = seated ? [[206, 154], [196, 155]] : [[166, 155], [153, 156]];
    const arms: [Limb, Limb] = seated ? [[[92, 130], [78, 154]], [[105, 132], [88, 155]]]
      : [[[137, 75], [143, 104]], [[125, 73], [135, 101]]];
    const nearKnee: Point = seated ? [170, 151] : [145, 124];
    const farKnee: Point = seated ? [163, 152] : [137, 125];
    const end: [Point, Point] = [at(feet[0], up ? 9 : 15, up ? -13 : -1), at(feet[1], up ? 9 : 14, up ? -12 : -1)];
    return figure(shoulder, hip, ...arms, [nearKnee, feet[0]], [farKnee, feet[1]], end);
  };
  return demo([make(false), make(true), make(true)], wall);
}

function adduction(kind: "balance" | "lever" | "ball" | "ball-hold" | "side-plank") {
  const mat = kind.startsWith("ball");
  const sideplank = kind === "side-plank";
  const props: Props = kind === "lever" ? [[236, 64, 236, 157], [228, 67, 252, 67], [224, 110, 245, 110], [221, 158, 257, 158]]
    : mat || sideplank ? [] : [[87, 68, 87, 158], [76, 158, 103, 158]];
  const tool: Attachments = kind === "lever" ? [["bar", 7, 236, 112], ["pad", 7, -8, 7], ["barbell-end", 7, 41, 1]]
    : mat ? [["stability-ball", 13, 0, 0]] : [];

  function make(close: boolean): Point[] {
    if (mat) {
      const far: Limb = [[179 - (close ? 3 : 11), 114 + (close ? 5 : 0)], [201, floor - 3]];
      const near: Limb = [[180 + (close ? 2 : 11), 135 - (close ? 3 : 0)], [214, floor - 2]];
      const frame = figure([101, 145], [154, 148], [[122, 152], [154, 153]], [[114, 150], [143, 153]], near, far);
      frame[0] = [86, 143];
      return [...frame, [176, 130]];
    }
    if (sideplank) {
      const bottom: Limb = close ? [[194, 137], [177, 145]] : [[192, 151], [179, 155]];
      const above: Limb = [[198, 140], [234, 155]];
      return figure([100, 109], [155, 128], [[128, 111], [160, 122]], [[107, 151], [142, 154]], bottom, above);
    }
    const hip: Point = [150, 88], shoulder: Point = [149, 47];
    const first: Limb = kind === "lever" ? [[183, 64], [229, 68]] : [[123, 65], [90, 77]];
    const second: Limb = [[166, 69], [156, 91]];
    const moving: Limb = close ? [[136, 121], [118, 149]] : [[176, 117], [200, 138]];
    return figure(shoulder, hip, first, second, moving, [[154, 123], [150, floor - 2]]);
  }

  return demo(kind === "ball-hold" ? [make(false), ...Array<Point[]>(7).fill(make(true))]
    : [make(false), make(true)], props, tool, 850);
}

function cableDiagonal(kind: "kneeling" | "front" | "side") {
  const kneeling = kind === "kneeling", side = kind === "side";
  const machine = side ? 82 : 244;
  function make(high: boolean) {
    const hip: Point = kneeling ? [132, 116] : [151, 87];
    const shoulder: Point = kneeling ? [175, 114] : [155, 46];
    const first: Limb = kneeling ? [[177, 132], [181, 154]] : side ? [[130, 74], [94, 81]] : [[192, 62], [238, 68]];
    const farArm: Limb = kneeling ? [[169, 136], [173, 154]] : [[168, 69], [162, 92]];
    const moving: Limb = kneeling ? high ? [[101, 121], [70, 98]] : [[123, 148], [95, 152]]
      : side ? high ? [[176, 113], [209, 131]] : [[154, 120], [158, 153]]
        : high ? [[126, 117], [93, 133]] : [[155, 122], [154, 153]];
    const support: Limb = kneeling ? [[135, 152], [105, 154]] : [[147, 122], [147, 156]];
    return figure(shoulder, hip, first, farArm, moving, support,
      [at(moving[1], kneeling ? -7 : 8, high ? -3 : 0), at(support[1], kneeling ? -8 : 8, 0)]);
  }
  return demo([make(false), make(true)], pulley(machine), [["cable", 8, machine, 145], ["pad", 8, 0, -3]]);
}

function hipMotion(kind: "seated-turn" | "kneeling" | "hip-open" | "standing-rear" | "crouched-calf" | "crossed-stretch") {
  const benchPad: Props = kind === "kneeling" ? [[102, 156, 178, 156]]
    : kind === "standing-rear" ? [[225, 71, 225, 156], [212, 156, 237, 156]] : [];
  function make(move: number) {
    if (kind === "seated-turn") {
      return figure([141, 105], [149, 148], [[129, 132], [117, 154]], [[136, 131], [127, 155]],
        [[178 + move * 14, 118 + Math.abs(move) * 15], [192, 153]], [[130 + move * 16, 118 + Math.abs(move) * 15], [109, 152]]);
    }
    if (kind === "kneeling") {
      const hip: Point = [150 + move * 10, 113], shoulder: Point = [148 + move * 7, 75];
      return figure(shoulder, hip, [[165, 95], at(hip, 3, -5)], [[139, 96], at(hip, -7, -2)],
        [[155, 151], [118, 154]], [[149, 152], [111, 154]], [[110, 155], [104, 155]]);
    }
    if (kind === "hip-open") {
      return figure([149, 50], [146, 90], [[169, 70], [161, 92]], [[129, 73], [139, 95]],
        [[166 + move * 23, 91 + move * 8], [167 + move * 10, 122]], [[144, 125], [144, 155]]);
    }
    if (kind === "standing-rear") {
      const work: Limb = [[147 - move * 15, 126 - move * 2], [126 - move * 23, 146 - move * 34]];
      return figure([151, 50], [149, 90], [[183, 63], [225, 80]], [[142, 73], [147, 99]], work, [[151, 123], [152, 155]],
        [at(work[1], -5, 8), [160, 155]]);
    }
    if (kind === "crouched-calf") {
      const foot: Point = [142 - move * 14, 155];
      return figure([175, 111], [147, 130], [[192, 133], [203, 154]], [[187, 135], [195, 154]],
        [[185, 127], [186, 155]], [[142, 135], foot]);
    }
    return figure([145 - move * 20, 51], [148 + move * 6, 93], [[160 - move * 12, 77], [156, 104]], [[126, 77], [139, 105]],
      [[139, 125], [158, 155]], [[155, 124], [145, 155]], [[167, 155], [137, 155]]);
  }
  return demo(kind === "seated-turn" ? [make(0), make(1), make(0), make(-1)] : [make(0), make(1), make(1)], benchPad, [], 850);
}

const wallTibialis = tibialis();

export const lowerBodyEquipmentIllustrations: Record<string, Illustration> = {
  "9994": adduction("ball-hold"),
  "10014": adduction("ball"),
  "4985": gluteHam("floor-band"),
  "4849": gluteHam("band-chest"),
  "4905": gluteHam("band-hands"),
  "8536": wallTibialis,
  "6742": cableDiagonal("kneeling"),
  "5120": hipBridgeIllustrations["0880"],
  "5470": cableDiagonal("side"),
  "8083": cableDiagonal("front"),
  "1930": hipMotion("crouched-calf"),
  "4555": hipMotion("seated-turn"),
  "4456": gluteHam("ghd"),
  "4890": gluteHam("arms-forward"),
  "2768": adduction("balance"),
  "2115": hipMotion("kneeling"),
  "2746": uprightSquat("abduct"),
  "10328": uprightSquat("belt-split"),
  "2950": uprightSquat("belt"),
  "1220": benchCalf(),
  "1038": uprightSquat("chair"),
  "1039": uprightSquat("deep"),
  "5516": leverHack(),
  "9676": proneKneeFlexion(),
  "4951": uprightSquat("pendulum"),
  "1040": uprightSquat("single"),
  "1573": seatedLever(false, true),
  "1572": seatedLever(true, true),
  "1232": seatedLever(),
  "1574": seatedLever(true),
  "1035": adduction("lever"),
  "1875": uprightSquat("lever"),
  "9929": leverHack(true),
  "10847": reformer("frog"),
  "10852": reformer("split"),
  "10851": reformer("squat"),
  "10850": reformer("side"),
  "4109": uprightSquat("side-band"),
  "3856": uprightSquat("smith"),
  "4916": hipBridgeIllustrations["3114"],
  "3460": adduction("side-plank"),
  "9272": tibialis(true),
  "10198": negativePress(),
  "4179": uprightSquat("smith-deep"),
  "6750": hipMotion("hip-open"),
  "10859": wallTibialis,
  "1941": hipMotion("crossed-stretch"),
  "0792": hipMotion("standing-rear"),
  "9803": wallTibialis,
};
