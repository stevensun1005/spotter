import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

const floor = 158;
const chair: Props = [
  [101, 107, 154, 107], [102, 64, 102, 108], [105, 108, 105, floor], [148, 108, 148, floor],
];
const bench: Props = [[85, 111, 181, 111], [88, 111, 88, floor], [168, 111, 168, floor]];
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function frame(head: Point, shoulder: Point, hip: Point, arms: [Limb, Limb], legs: [Limb, Limb], toes: [Point, Point]): Point[] {
  return [head, shoulder, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function demo(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 900): Illustration {
  return { frames, props, dynamic: [...feet, ...attachments], reference: true, ms };
}

function polar([x, y]: Point, length: number, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  return [x + length * Math.cos(radians), y + length * Math.sin(radians)];
}

function equalLegJoints([hx, hy]: Point, [ax, ay]: Point, length: number): Point {
  const span = Math.max(1, Math.hypot(ax - hx, ay - hy));
  const bend = Math.sqrt(Math.max(0, length * length - span * span / 4));
  return [(hx + ax) / 2 + (ay - hy) * bend / span, (hy + ay) / 2 - (ax - hx) * bend / span];
}

function toesInExtension() {
  const knee: Point = [171, 107];
  const farKnee: Point = [141, 100];
  const rear: Props = [
    [116, 107, 187, 107], [116, 64, 116, 109], [187, 64, 187, 109], [116, 64, 187, 64],
    [121, 107, 121, floor], [183, 107, 183, floor], [109, floor, 194, floor], [196, 105, 176, 105],
  ];
  const make = (up: boolean) => {
    const near: Point = up ? [199, 119] : [171, 149];
    const far: Point = up ? [169, 111] : [142, 141];
    const padNear: Point = up ? [200, 124] : [178, 143];
    const padFar: Point = up ? [164, 115] : [141, 135];
    return [...frame([151, 50], [151, 64], [152, 97], [[[177, 82], [184, 101]], [[126, 81], [117, 101]]],
      [[knee, near], [farKnee, far]], [[near[0] - 7, near[1] + 9], [far[0] + 12, far[1] + 3]]),
      padFar, padNear];
  };
  return demo([make(false), make(true)], rear, [["bar", 13, 14], ["line", 14, 194, 105]]);
}

function seatedExtension(kind: "chair" | "edge" | "bench" | "band" | "hold" | "cuff" | "alternate") {
  const band = kind === "band" || kind === "hold";
  const props: Props = kind === "bench" || kind === "band"
    ? [[101, 107, 154, 107], [105, 107, 105, floor], [148, 107, 148, floor]]
    : [...chair];
  if (band) props.push([76, 104, 76, floor], [66, floor, 88, floor]);
  const knee: Point = [156, 105];
  const farKnee: Point = [148, 109];
  const sideGrip: [Limb, Limb] = [[[119, 90], [124, 105]], [[108, 89], [107, 104]]];
  const arms: [Limb, Limb] = kind === "chair" || kind === "alternate" || kind === "bench"
    ? [[[117, 88], [142, 101]], [[109, 88], [131, 102]]]
    : sideGrip;
  const make = (nearUp: boolean, farUp: boolean) => {
    const foot = polar(knee, 41, nearUp ? 4 : 84);
    const other = polar(farKnee, 42, farUp ? 3 : 88);
    const toes: [Point, Point] = [
      [foot[0] + 13, foot[1] + (nearUp ? -2 : 7)], [other[0] + 12, other[1] + (farUp ? -4 : 6)],
    ];
    return frame([112, 51], [112, 65], [118, 100], arms, [[knee, foot], [farKnee, other]], toes);
  };
  const down = make(false, false);
  const up = make(true, false);
  const full = kind === "alternate" ? [down, up, down, make(false, true)]
    : kind === "hold" ? [down, up, up, up, up] : [down, up];
  const attachments: Attachments = band ? [["band", 8, 76, 138]] : kind === "cuff" ? [["pad", 8, -3, -4]] : [];
  return demo(full, props, attachments);
}

function standingBandExtension() {
  const make = (extended: boolean) => {
    const knee: Point = extended ? [142, 108] : [156, 108];
    const ankle = polar(knee, 37, extended ? 88 : 119);
    return frame([140, 43], [143, 57], [143, 93], [[[163, 76], [187, 70]], [[136, 76], [136, 94]]],
      [[knee, ankle], [[133, 122], [132, 153]]], [[ankle[0] + 12, ankle[1] + 5], [143, floor]]);
  };
  return demo([make(false), make(true)],
    [[93, 82, 93, floor], [83, floor, 105, floor], [187, 46, 187, floor], [178, floor, 196, floor]],
    [["band", 8, 93, 135]]);
}

function proneCurl(kind: "floor" | "alternate" | "dumbbell") {
  const onBench = kind === "dumbbell";
  const height = onBench ? 105 : 150;
  const knee: Point = [176, height + 1];
  const farKnee: Point = [172, height + 4];
  const curl = (degrees: number, otherDegrees: number) => {
    const foot = polar(knee, 36, degrees);
    const other = polar(farKnee, 36, otherDegrees);
    const nearToe = polar(foot, 10, degrees + 74);
    const farToe = polar(other, 10, otherDegrees + 70);
    const arms: [Limb, Limb] = onBench
      ? [[[104, height + 14], [92, height + 4]], [[99, height + 15], [85, height + 4]]]
      : [[[105, height + 2], [103, height - 5]], [[111, height + 2], [101, height - 3]]];
    return frame([100, height - 12], [111, height - 2], [143, height],
      arms, [[knee, foot], [farKnee, other]], [nearToe, farToe]);
  };
  const base = curl(-3, -6);
  if (kind === "alternate") return demo([base, curl(-108, -6), base, curl(-3, -112)]);
  if (kind === "dumbbell") return demo([base, curl(-104, -106)], bench, [["dumbbell", 8, -2, 0]]);
  return demo([base, curl(-107, -110)]);
}

function nordic(kind: "contact" | "self" | "pads" | "band") {
  const props: Props = kind === "pads"
    ? [[100, 134, 115, 134], [97, 134, 97, floor], [94, 148, 115, 148], [114, 134, 114, 147]]
    : [[98, 146, 113, 146], [97, 147, 97, floor], [106, 151, 121, 151]];
  if (kind === "band") props.push([91, 38, 91, 158], [80, 158, 102, 158]);
  if (kind === "contact") props.push([201, 145, 234, 145], [201, 145, 201, floor], [234, 145, 234, floor]);
  const make = (tilt: number) => {
    const knee: Point = [144, 154];
    const hip = polar(knee, 32, tilt);
    const shoulder = polar(hip, 34, tilt);
    const head = polar(shoulder, 15, tilt);
    const handsDown = tilt > -47 && (kind === "contact" || kind === "self");
    const handY = kind === "contact" ? 141 : 154;
    const arms: [Limb, Limb] = handsDown
      ? [[[shoulder[0] + 8, shoulder[1] + 20], [shoulder[0] + 20, handY]],
        [[shoulder[0] - 2, shoulder[1] + 18], [shoulder[0] + 11, handY - 2]]]
      : [[[shoulder[0] + 11, shoulder[1] + 17], [shoulder[0] + 2, shoulder[1] + 9]],
        [[shoulder[0] + 3, shoulder[1] + 16], [shoulder[0] - 5, shoulder[1] + 6]]];
    return frame(head, shoulder, hip, arms, [[knee, [108, 151]], [[141, 150], [106, 148]]], [[99, 157], [96, 155]]);
  };
  return demo([make(-92), make(-57), make(kind === "contact" || kind === "self" ? -22 : -30), make(-57)], props,
    kind === "band" ? [["band", 4, 91, 42], ["band", 6, 91, 42]] : []);
}

function anchoredCurl() {
  const make = (curled: boolean) => {
    const hip: Point = [111, 148];
    const nearKnee: Point = curled ? [131, 117] : [148, 142];
    const foot: Point = curled ? [149, 151] : [184, 150];
    return frame([100, 88], [105, 103], hip, [[[100, 125], [99, 150]], [[91, 125], [87, 150]]],
      [[nearKnee, foot], [[145, 151], [181, 153]]], [[foot[0] + 6, 153], [191, 156]]);
  };
  return demo([make(false), make(true)], [[222, 110, 222, floor], [213, floor, 234, floor]],
    [["band", 8, 222, 151]]);
}

function kneelingCurl() {
  const make = (curled: boolean) => {
    const knee: Point = [151, 146];
    const ankle = polar(knee, 28, curled ? -76 : -8);
    return frame([89, 107], [105, 108], [142, 108],
      [[[104, 129], [106, 153]], [[98, 126], [96, 151]]],
      [[knee, ankle], [[139, 153], [173, 153]]], [polar(ankle, 10, curled ? -148 : 45), [182, 156]]);
  };
  return demo([make(false), make(true)]);
}

function hackCalf(single: boolean) {
  const props: Props = [
    [112, 151, 184, 47], [118, 152, 190, 48], [181, 62, 181, floor],
    [101, floor, 225, floor], [173, 150, 223, 139], [221, 140, 221, floor],
  ];
  const make = (up: boolean): Point[] => {
    const rise = up ? 11 : 0;
    const hip: Point = [158 + rise * 0.6, 88 - rise];
    const shoulder: Point = [177 + rise * 0.6, 54 - rise];
    const ankle: Point = up ? [192, 130] : [186, 143];
    const other: Point = single ? [165 + rise * 0.6, 120 - rise] : [ankle[0] - 9, ankle[1] + 3];
    const padTop: Point = [shoulder[0] - 10, shoulder[1] - 5];
    const padBottom: Point = [hip[0] - 7, hip[1] + 9];
    return [...frame([185 + rise * 0.6, 41 - rise], shoulder, hip,
      [[[192 + rise * 0.6, 73 - rise], [181 + rise * 0.6, 55 - rise]],
        [[178 + rise * 0.6, 72 - rise], [169 + rise * 0.6, 55 - rise]]],
      [[[176 + rise * 0.2, 118 - rise * 0.6], ankle], [[165 + rise * 0.5, 117 - rise * 0.6], other]],
      [[199, 143], single ? [other[0] - 7, other[1] + 9] : [190, 145]]), padTop, padBottom];
  };
  return demo([make(false), make(true)], props, [["bar", 13, 14], ["pad", 13, 0, 0], ["barbell-end", 14, -5, 0]]);
}

function seatedCalf(single: boolean) {
  const props: Props = [
    [100, 72, 113, 108], [111, 108, 147, 108], [118, 108, 118, floor],
    [219, 105, 219, floor], [165, floor, 239, floor], [170, 140, 230, 140],
  ];
  const make = (pressed: boolean): Point[] => {
    const toe: Point = pressed ? [214, 130] : [209, 129];
    const foot: Point = pressed ? [201, 123] : [198, 140];
    const other: Point = single ? [149, 152] : [foot[0] - 7, foot[1] + 2];
    const knee: Point = pressed ? [160, 109] : [160, 115];
    return [...frame([95, 59], [103, 74], [120, 103],
      [[[106, 94], [124, 106]], [[98, 92], [113, 104]]],
      [[knee, foot], [single ? [145, 119] : [knee[0] - 7, knee[1] + 3], other]],
      [toe, single ? [162, floor] : [toe[0] - 7, toe[1] + 1]]),
      [toe[0] + 9, toe[1] - 19], [toe[0] + 4, toe[1] + 9]];
  };
  return demo([make(false), make(true)], props, [["bar", 13, 14], ["line", 14, 221, 146], ["barbell-end", 14, 9, 2]]);
}

function reformer(kind: "flat" | "heel" | "toe" | "calf") {
  const props: Props = [
    [74, 126, 239, 126], [74, 134, 239, 134], [77, 134, 77, floor], [235, 134, 235, floor],
    [214, 125, 222, 95], [230, 125, 211, 95], [210, 95, 227, 95],
  ];
  const make = (pressed: boolean): Point[] => {
    const calf = kind === "calf";
    const shift = calf ? (pressed ? -18 : -11) : pressed ? -18 : 0;
    const left = 122 + shift;
    const toe: Point = kind === "heel" ? [217, 81] : [214, 94];
    const ankle: Point = kind === "heel" ? [210, 92] : kind === "flat" ? [202, 94] : [204, calf && !pressed ? 104 : 85];
    const hip: Point = [left + 24, 109];
    const knee: Point = calf ? [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2] : equalLegJoints(hip, ankle, 39);
    return [...frame([left - 22, 103], [left - 7, 109], hip,
      [[[left + 9, 113], [left + 30, 117]], [[left + 6, 106], [left + 29, 112]]],
      [[knee, ankle], [[knee[0] - 5, knee[1] + 3], [ankle[0] - 4, ankle[1] + 4]]],
      [toe, [toe[0] - 4, toe[1] + 3]]),
      [left - 32, 115], [left + 33, 115], [left - 13, 116]];
  };
  return demo([make(false), make(true)], props, [["bar", 13, 14], ["pad", 15, 0, -6]]);
}

function ankleIsolation(banded: boolean) {
  const make = (pressed: boolean) => {
    const ankle: Point = [188, 146];
    const hands: [Limb, Limb] = banded ? [[[127, 126], [149, 121]], [[119, 129], [141, 117]]]
      : [[[112, 123], [115, 148]], [[103, 125], [105, 146]]];
    return frame([111, 89], [114, 104], [124, 148], hands,
      [[[157, 145], ankle], [[149, 151], [179, 152]]],
      [pressed ? [200, 144] : [191, 134], [189, 155]]);
  };
  return demo([make(false), make(true)], [], banded ? [["band", 11, 4], ["band", 11, 6]] : []);
}

function fixedCalfStretch(kind: "wall" | "step" | "lever") {
  const step = kind !== "wall";
  const lever = kind === "lever";
  const props: Props = step
    ? [[181, 140, 227, 140], [181, 140, 181, floor], [227, 140, 227, floor], [229, 42, 229, floor], [202, 74, 229, 74]]
    : [[188, 46, 188, floor], [188, floor, 210, floor]];
  const make = (deep: boolean): Point[] => {
    const lean = deep ? 7 : 0;
    const shoulder: Point = [151 + lean, 68 + (step && deep ? 4 : 0)];
    const hip: Point = [147 + lean, 107];
    const ball: Point = step ? [184, 136] : [183, 143];
    const ankle: Point = step ? [168, deep ? 150 : 141] : [172, 153];
    const farAnkle: Point = step ? [119, 138] : [139, 153];
    return [...frame([shoulder[0] + 3, shoulder[1] - 16], shoulder, hip,
      [[[177, 80], [step ? 208 : 187, 75]], [[170, 78], [step ? 201 : 185, 81]]],
      [[step ? [161, 127 + (deep ? 3 : 0)] : [161, 132], ankle], [[146, 125], farAnkle]],
      [ball, [farAnkle[0] + 11, farAnkle[1] + 5]]), [shoulder[0] - 8, shoulder[1] - 6]];
  };
  const start = make(false), hold = make(true);
  return demo([start, hold, hold, hold], props,
    lever ? [["line", 13, 228, 71], ["pad", 13, 0, 0], ["barbell-end", 13, -10, 22]] : []);
}

function calfToePull(kind: "hand" | "towel" | "band" | "supine") {
  const lying = kind === "supine";
  const strap = kind === "towel" || kind === "band";
  const make = (flexed: boolean) => {
    const hip: Point = lying ? [140, 148] : [124, 149];
    const knee: Point = lying ? [151, 99] : [159, 148];
    const ankle: Point = lying ? [161, 59] : [196, 149];
    const tip: Point = lying ? [flexed ? 149 : 167, 55] : [flexed ? 194 : 203, flexed ? 134 : 137];
    const far: Limb = lying ? [[165, 121], [191, 153]] : [[136, 126], [173, 153]];
    const upper: [Limb, Limb] = lying
      ? [[[126, 121], [145, 109]], [[128, 118], [147, 104]]]
      : kind === "hand"
        ? [[[165, 118], [tip[0] - 4, tip[1]]], [[163, 121], [tip[0] - 8, tip[1] + 2]]]
        : [[[126, 129], [150, 119]], [[118, 127], [144, 116]]];
    return frame(lying ? [89, 144] : kind === "hand" ? [131, 89] : [109, 88], lying ? [104, 147] : kind === "hand" ? [134, 104] : [113, 103],
      hip, upper, [[knee, ankle], far], [tip, [far[1][0] + 11, far[1][1] + 2]]);
  };
  const start = make(false), end = make(true);
  return demo([start, end, end, end], [], strap
    ? [[kind === "towel" ? "bar" : "band", 4, 11], [kind === "towel" ? "bar" : "band", 6, 11]] : []);
}

function kneeToBox() {
  const props: Props = [[190, 114, 226, 114], [190, 114, 190, floor], [226, 114, 226, floor]];
  const make = (stretched: boolean) => {
    const hip: Point = stretched ? [161, 106] : [143, 101];
    const shoulder: Point = stretched ? [162, 75] : [145, 68];
    return frame([shoulder[0] + 1, shoulder[1] - 15], shoulder, hip,
      [[[174, 95], [stretched ? 187 : 173, stretched ? 117 : 100]], [[168, 95], [172, 116]]],
      [[stretched ? [186, 119] : [167, 119], [160, 153]], [[131, 128], [104, 151]]],
      [[176, floor], [116, floor]]);
  };
  const stretch = make(true);
  return demo([make(false), stretch, stretch, stretch], props);
}

function walkingCalf(loaded: boolean) {
  const pose = (near: Point, far: Point, nearUp: boolean, farUp: boolean, bump: number) => {
    const hip: Point = [147, 84 + bump];
    const ankle = (tip: Point, lifted: boolean): Point => [tip[0] - (lifted ? 8 : 9), tip[1] - (lifted ? 8 : 10)];
    const nearAnkle = ankle(near, nearUp);
    const farAnkle = ankle(far, farUp);
    const arm: [Limb, Limb] = loaded
      ? [[[149, 71 + bump], [150, 91 + bump]], [[140, 70 + bump], [139, 90 + bump]]]
      : nearUp ? [[[139, 71 + bump], [133, 87 + bump]], [[148, 71 + bump], [155, 82 + bump]]]
        : [[[153, 71 + bump], [163, 82 + bump]], [[140, 71 + bump], [131, 85 + bump]]];
    return frame([149, 39 + bump], [147, 53 + bump], hip, arm,
      [[equalLegJoints(hip, nearAnkle, 34), nearAnkle], [equalLegJoints(hip, farAnkle, 34), farAnkle]], [near, far]);
  };
  return demo([pose([170, floor], [132, floor - 1], false, false, 0), pose([155, floor], [151, 136], false, true, -2),
    pose([130, floor - 1], [173, floor], false, false, 0), pose([148, 136], [155, floor], true, false, -2)],
  [], loaded ? [["dumbbell", 4, 0, 5], ["dumbbell", 6, 0, 5]] : [], 710);
}

function ankleJump(kind: "vertical" | "forward" | "side" | "single" | "box") {
  const single = kind === "single" || kind === "box";
  const hasBox = kind === "box";
  const pose = (x: number, up: boolean, land = false) => {
    const front = kind === "side";
    const rise = up ? 17 : land ? -4 : 0;
    const hip: Point = [x, 89 - rise];
    const shoulder: Point = [x + (front ? 0 : 3), 56 - rise];
    const nearToe: Point = [x + (front ? 10 : 14), floor - (up ? 12 : 0)];
    const otherToe: Point = single ? [x - 20, 137 - rise] : [x - (front ? 9 : 2), floor - (up ? 12 : 0)];
    const ankle: Point = [nearToe[0] - (front ? -2 : 9), nearToe[1] - (land ? 6 : 12)];
    const other: Point = [otherToe[0] - (front ? 2 : 8), otherToe[1] - 9];
    const arms: [Limb, Limb] = hasBox
      ? [[[x + 24, 79 - rise], [210, 101]], [[x - 1, 76 - rise], [x - 8, 101 - rise]]]
      : [[[x + (front ? 18 : 9), 79 - rise], [x + (front ? 26 : 5), 102 - rise]],
        [[x - (front ? 18 : 6), 80 - rise], [x - (front ? 24 : 12), 100 - rise]]];
    return frame([shoulder[0] + (front ? 0 : 3), 41 - rise], shoulder, hip, arms,
      [[equalLegJoints(hip, ankle, 33), ankle], [single ? [x - 6, 113 - rise] : equalLegJoints(hip, other, 33), other]],
      [nearToe, otherToe]);
  };
  const first = kind === "forward" || kind === "side" ? 127 : 150;
  const end = kind === "forward" || kind === "side" ? 171 : first;
  const middle = (first + end) / 2;
  const frames = kind === "side"
    ? [pose(first, false, true), pose(middle, true), pose(end, false, true), pose(middle, true)]
    : kind === "forward"
      ? [pose(first, false, true), pose(middle, true), pose(end, false, true), pose(end, false), pose(middle, true)]
      : [pose(first, false, true), pose(first, true), pose(first, false)];
  return demo(frames, hasBox ? [[193, 105, 229, 105], [193, 105, 193, floor], [229, 105, 229, floor]] : [], [], 570);
}

function rotatingCalf(single: boolean) {
  const make = (heel: number, swivel: number) => {
    const shoulder: Point = [143 + swivel * 0.25, 61 - heel * 0.42];
    const hip: Point = [144 + swivel * 0.3, 99 - heel * 0.55];
    const nearToe: Point = single ? [160, heel < 0 ? 145 : floor] : [156, floor];
    const farToe: Point = single ? [131, 133] : [149, floor];
    const near: Point = [nearToe[0] - 12 + swivel, 152 - Math.max(0, heel)];
    const far: Point = single ? [121, 129] : [farToe[0] - 13 + swivel, 152 - Math.max(0, heel)];
    return frame([shoulder[0] + 4, shoulder[1] - 16], shoulder, hip,
      [[[169, 74], [197, 72]], [[164, 76], [191, 78]]],
      [[[145 + swivel * 0.45, 125 - heel * 0.65], near], [single ? [137, 121] : [137 + swivel * 0.4, 127 - heel * 0.65], far]],
      [nearToe, farToe]);
  };
  const poses = single ? [make(-1, -4), make(0, 0), make(13, 4), make(0, 0)]
    : [make(0, 0), make(12, -3), make(14, 3), make(10, 6), make(13, 1), make(12, -3), make(0, 0),
      make(12, -3), make(13, 1), make(10, 6), make(14, 3), make(12, -3)];
  return demo(poses, [[199, 39, 199, floor], [192, floor, 211, floor]], [], 670);
}

function squatCalf(kind: "split" | "kettlebell") {
  const split = kind === "split";
  const make = (lowered: boolean, raised: boolean) => {
    const hip: Point = lowered ? [143, 115] : [142, raised ? 82 : 90];
    const shoulder: Point = [lowered ? 150 : 147, hip[1] - 34];
    const nearToe: Point = split ? [179, floor] : [160, floor];
    const farToe: Point = split ? [119, floor] : [147, floor];
    const foot: Point = [nearToe[0] - 11, raised && !split ? 142 : 151];
    const other: Point = [farToe[0] - 10, raised ? 139 : split ? 145 : 153];
    const arms: [Limb, Limb] = split
      ? [[[shoulder[0] + 15, shoulder[1] + 22], [hip[0] + 7, hip[1] - 5]],
        [[shoulder[0] - 8, shoulder[1] + 20], [hip[0] - 6, hip[1] - 5]]]
      : [[[shoulder[0] + 16, shoulder[1] + 17], [shoulder[0] + 18, shoulder[1] + 2]],
        [[shoulder[0] + 11, shoulder[1] + 18], [shoulder[0] + 11, shoulder[1] + 2]]];
    const nearKnee = equalLegJoints(hip, foot, 34);
    const farKnee: Point = split && lowered ? [135, 144] : equalLegJoints(hip, other, 34);
    return frame([shoulder[0] + 4, shoulder[1] - 15], shoulder, hip, arms,
      [[nearKnee, foot], [farKnee, other]], [nearToe, farToe]);
  };
  return demo([make(false, false), make(true, false), make(false, false), make(false, true)],
    [], split ? [] : [["kettlebell", 4, 0, 8]]);
}

function hamstringPunch() {
  const make = (side: "left" | "right" | "neutral") => {
    const near = side === "left", far = side === "right";
    return frame([147, 40], [147, 55], [147, 94],
      [near ? [[166, 61], [187, 61]] : [[154, 72], [150, 56]], far ? [[157, 59], [180, 57]] : [[143, 69], [143, 54]]],
      [[[152, 123], near ? [131, 104] : [150, 152]], [[143, 122], far ? [120, 104] : [143, 152]]],
      [near ? [130, 116] : [161, floor], far ? [121, 115] : [152, floor]]);
  };
  const start = make("neutral");
  return demo([start, make("left"), start, make("right")], [], [], 680);
}

function bridge(kind: "basic" | "single" | "kick" | "slider" | "suspension" | "ball-hold") {
  const sling = kind === "suspension";
  const slider = kind === "slider";
  const ball = kind === "ball-hold";
  const make = (action: boolean, otherAction = false) => {
    const height = ball ? 146 : sling || slider || kind === "kick" || action ? 121 : 146;
    const hip: Point = [130, height];
    const foot: Point = sling ? (action ? [174, 124] : [198, 120])
      : slider ? (action ? [173, 152] : [206, 152])
      : ball ? (action ? [165, 114] : [190, 114])
      : kind === "kick" && action ? [196, 106] : [188, 153];
    const other: Point = sling ? (otherAction ? [168, 123] : [191, 119])
      : slider || kind === "single" || (kind === "kick" && otherAction) ? [187, 105]
      : ball ? [foot[0] - 7, foot[1] + 1] : [179, 151];
    const knee: Point = sling && action || slider && action || ball && action
      ? [151, 109] : kind === "kick" && action ? [165, 110] : [158, height - 8];
    const farKnee: Point = sling && otherAction || ball && action
      ? [145, 105] : slider || kind === "single" || kind === "kick" && otherAction
      ? [153, 104] : [152, height - 11];
    return frame(ball ? [98, 92] : [82, 145], ball ? [102, 107] : [97, 148], hip,
      ball ? [[[96, 127], [88, 153]], [[90, 126], [81, 151]]]
        : [[[112, 151], [126, 151]], [[89, 153], [107, 154]]],
      [[knee, foot], [farKnee, other]], [[foot[0] + 11, foot[1] - 1], [other[0] + 11, other[1] - 1]]);
  };
  const attachments: Attachments = sling ? [["line", 8, 202, 41], ["line", 10, 194, 41], ["ring", 8, 0, 3], ["ring", 10, 0, 3]]
    : slider ? [["slider", 8, 0, 4]] : ball ? [["stability-ball", 8, 2, 21]] : [];
  const poses = sling || kind === "kick" ? [make(false), make(true), make(false), make(false, true)]
    : ball ? [make(false), make(true), make(true), make(true)] : [make(false), make(true)];
  return demo(poses, sling ? [[191, 41, 206, 41]] : [], attachments);
}

const basicBridge = bridge("basic");

export const legMachineIllustrations: Record<string, Illustration> = {
  "2773": seatedExtension("bench"),
  "7327": toesInExtension(),
  "8744": seatedExtension("alternate"),
  "10537": seatedExtension("chair"),
  "10538": seatedExtension("edge"),
  "10539": seatedExtension("cuff"),
  "10746": seatedExtension("band"),
  "10921": seatedExtension("hold"),
  "10536": standingBandExtension(),
  "4292": proneCurl("dumbbell"),
  "6108": proneCurl("floor"),
  "7129": proneCurl("alternate"),
  "6748": kneelingCurl(),
  "3508": anchoredCurl(),
  "3415": nordic("contact"),
  "3507": nordic("self"),
  "4204": nordic("band"),
  "4988": nordic("pads"),
  "1383": hackCalf(false),
  "1384": hackCalf(true),
  "7176": seatedCalf(false),
  "7177": seatedCalf(true),
  "1447": fixedCalfStretch("lever"),
  "1924": fixedCalfStretch("wall"),
  "1925": fixedCalfStretch("step"),
  "10654": reformer("toe"),
  "10655": reformer("flat"),
  "10656": reformer("heel"),
  "10657": reformer("calf"),
  "2762": ankleIsolation(false),
  "3126": ankleIsolation(true),
  "10563": kneeToBox(),
  "4929": calfToePull("supine"),
  "5480": calfToePull("band"),
  "4928": calfToePull("towel"),
  "0693": calfToePull("towel"),
  "2102": calfToePull("hand"),
  "5700": walkingCalf(false),
  "5698": walkingCalf(true),
  "10751": ankleJump("vertical"),
  "10754": ankleJump("single"),
  "10755": ankleJump("box"),
  "10756": ankleJump("forward"),
  "10757": ankleJump("side"),
  "4895": rotatingCalf(false),
  "10547": rotatingCalf(true),
  "5880": squatCalf("kettlebell"),
  "8755": squatCalf("split"),
  "4437": hamstringPunch(),
  "8358": basicBridge,
  "10904": basicBridge,
  "10905": bridge("kick"),
  "9359": bridge("single"),
  "3514": bridge("slider"),
  "1076": bridge("suspension"),
  "10139": bridge("ball-hold"),
};
