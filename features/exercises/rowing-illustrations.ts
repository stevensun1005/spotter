import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Grip = "palm-up" | "palm-down" | "thumb-up";
type Sides = "both" | "one" | "alternate";
type Setup = {
  body: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
  props?: Props;
  freeArm?: Pair;
};
type Path = [Arms, Arms];

const standing: Setup = {
  body: [[130, 37], [132, 56], [138, 103]],
  legs: [[150, 130], [156, 157], [130, 129], [126, 157]],
};
const split: Setup = { ...standing, legs: [[165, 126], [179, 157], [125, 130], [106, 156]] };
const slightHinge: Setup = { ...standing, body: [[144, 40], [139, 56], [134, 102]] };
const hinge: Setup = {
  body: [[166, 63], [155, 74], [115, 101]],
  legs: [[133, 126], [133, 156], [110, 128], [106, 156]],
  freeArm: [[140, 98], [130, 122]],
};
const splitHinge: Setup = { ...hinge, legs: [[141, 127], [147, 156], [106, 131], [98, 156]] };
const kneeling: Setup = {
  body: [[147, 63], [139, 77], [123, 119]],
  legs: [[149, 153], [113, 156], [136, 154], [104, 156]],
  freeArm: [[129, 103], [128, 125]],
};

const seatBench: Props = [[96, 119, 155, 119], [108, 119, 108, 157], [147, 119, 147, 157]];
const seated: Setup = {
  body: [[123, 52], [125, 70], [126, 111]],
  legs: [[158, 115], [166, 155], [149, 116], [148, 156]],
  freeArm: [[123, 96], [153, 111]],
  props: seatBench,
};
const onFootplates: Setup = {
  ...seated,
  legs: [[159, 117], [201, 141], [147, 119], [187, 142]],
  props: [...seatBench, [189, 148, 207, 134], [181, 147, 197, 133], [199, 144, 199, 157], [197, 157, 235, 157]],
};
const braced: Setup = {
  ...seated,
  body: [[133, 53], [132, 70], [124, 111]],
  props: [...seatBench, [142, 74, 137, 100], [137, 100, 137, 156], [134, 156, 154, 156]],
};
const inclinePad: Props = [[103, 115, 155, 72], [124, 98, 124, 156], [149, 78, 149, 156], [105, 156, 166, 156]];
const proneIncline: Setup = {
  body: [[162, 51], [148, 65], [111, 101]],
  legs: [[112, 128], [98, 156], [102, 128], [92, 156]],
  props: inclinePad,
};
const paddedHead: Setup = {
  ...proneIncline,
  body: [[159, 61], [142, 65], [100, 83]],
  props: [[92, 94, 169, 66], [108, 89, 108, 156], [149, 73, 149, 156], [96, 156, 165, 156]],
};
const supportedFlat: Setup = {
  body: [[170, 60], [154, 69], [109, 72]],
  legs: [[83, 73], [59, 76], [85, 78], [61, 80]],
  props: [[67, 81, 160, 81], [78, 81, 78, 156], [129, 81, 129, 156], [72, 156, 146, 156]],
};
const supportedArmAndKnee: Setup = {
  ...hinge, body: [[175, 72], [157, 78], [114, 85]],
  legs: [[119, 110], [112, 156], [120, 116], [92, 115]],
  freeArm: [[173, 95], [179, 116]],
  props: [[85, 120, 186, 120], [92, 120, 92, 156], [180, 120, 180, 156]],
};
const oneArmRack: Setup = {
  ...splitHinge, freeArm: [[176, 86], [192, 102]],
  props: [[195, 39, 195, 157], [190, 106, 211, 106], [190, 157, 209, 157]],
};
const supine: Setup = {
  body: [[87, 147], [103, 151], [156, 151]],
  legs: [[182, 142], [211, 156], [176, 143], [204, 156]],
};

function shift([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function assemble(setup: Setup, arms: Arms): Point[] {
  const [e, w, f, v] = arms;
  const tip = (elbow: Point, wrist: Point) => {
    const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1];
    const length = Math.max(1, Math.hypot(dx, dy));
    return shift(wrist, dx * 4 / length, dy * 4 / length);
  };
  const midpoint: Point = [(w[0] + v[0]) / 2, (w[1] + v[1]) / 2];
  return [...setup.body, ...arms, ...setup.legs, tip(e, w), tip(f, v),
    midpoint, shift(midpoint, 8, 0), shift(midpoint, 4, 3)];
}

function clip(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 1050): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function row(setup: Setup, [start, finish]: Path, load: Attachments = [], side: Sides = "both",
  grip: Grip = "thumb-up", pause = false): Illustration {
  const idle = setup.freeArm ?? [[setup.body[1][0] - 8, setup.body[1][1] + 20], [setup.body[2][0] + 5, setup.body[2][1]]];
  const at = ([e, w, f, v]: Arms) => assemble(setup, [e, w, ...(side === "one" ? idle : [f, v] as Pair)]);
  const base = at(start), top = at(finish);
  const handles: Attachments = [[grip, 4, 11]];
  if (side !== "one") handles.push([grip, 6, 12]);
  if (side === "alternate") return clip(
    [base, at([finish[0], finish[1], start[2], start[3]]), base, at([start[0], start[1], finish[2], finish[3]])],
    setup.props, [...handles, ...load],
  );
  return clip(pause ? [base, base, top] : [base, top], setup.props, [...handles, ...load]);
}

const bentRow: Path = [
  [[158, 103], [161, 132], [149, 104], [146, 132]],
  [[127, 78], [145, 102], [116, 82], [134, 104]],
];
const flaredBentRow: Path = [
  [[170, 103], [176, 131], [142, 103], [136, 130]],
  [[131, 73], [152, 91], [110, 83], [133, 93]],
];
const declineTorsoRow: Path = [
  [[155, 94], [157, 123], [143, 94], [142, 122]],
  [[119, 67], [138, 89], [109, 74], [127, 94]],
];
const sealRow: Path = [
  [[157, 100], [155, 130], [147, 99], [143, 129]],
  [[127, 67], [150, 87], [116, 74], [134, 90]],
];
const closeSealRow: Path = [
  [[155, 100], [152, 130], [148, 100], [145, 129]],
  [[122, 73], [143, 88], [116, 75], [136, 90]],
];
const wideSealRow: Path = [
  [[169, 101], [177, 130], [138, 97], [131, 125]],
  [[131, 59], [162, 80], [112, 72], [135, 82]],
];
const seatRow: Path = [
  [[153, 86], [179, 103], [147, 84], [171, 101]],
  [[110, 111], [138, 97], [104, 106], [130, 96]],
];
const shoulderHeightRow: Path = [
  [[158, 64], [185, 76], [149, 68], [180, 76]],
  [[105, 84], [130, 79], [98, 81], [123, 76]],
];
const highRow: Path = [
  [[160, 52], [185, 38], [151, 53], [175, 37]],
  [[109, 81], [139, 77], [102, 74], [127, 74]],
];
const standingFlared: Path = [
  [[167, 62], [196, 61], [155, 63], [184, 62]],
  [[124, 62], [154, 63], [111, 74], [139, 71]],
];
const pulleyLowStanding: Path = [
  [[162, 83], [185, 104], [151, 82], [176, 101]],
  [[114, 106], [142, 99], [105, 100], [133, 94]],
];
const kneelingPull: Path = [
  [[164, 100], [184, 120], [151, 99], [174, 115]],
  [[106, 111], [135, 116], [100, 106], [123, 110]],
];
const lyingUpright: Path = [
  [[131, 146], [158, 147], [126, 141], [153, 142]],
  [[110, 116], [106, 141], [95, 112], [96, 137]],
];
const upRow: Path = [
  [[151, 83], [153, 113], [131, 82], [132, 113]],
  [[156, 56], [149, 74], [108, 58], [130, 75]],
];

const dumbbells: Attachments = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const dumbbell: Attachments = [["dumbbell", 4, 0, 0]];
const kettlebells: Attachments = [["kettlebell", 4, 0, 10], ["kettlebell", 6, 0, 10]];
const barbell: Attachments = [["bar", 4, 6], ["barbell-end", 4, 12, 0], ["barbell-end", 6, -12, 0]];
const ezBar: Attachments = [["ez-bar", 4, 6], ["plate", 4, 9, 0], ["plate", 6, -9, 0]];

function cable(setup: Setup, path: Path, y: number, style: "single" | "handles" | "rope" | "v" | "bar" | "ez" | "parallel" = "handles",
  turning = false, recoil = false): Illustration {
  const x = 246;
  const props: Props = [...(setup.props ?? []), [x, 22, x, 157], [x - 11, 157, x + 12, 157], [x - 4, y, x + 4, y]];
  const rigs: Record<typeof style, Attachments> = {
    single: [["cable", 4, x, y], ["pad", 4, 0, 0]],
    handles: [["cable", 4, x, y], ["cable", 6, x, y], ["pad", 4, 0, 0], ["pad", 6, 0, 0]],
    rope: [["cable", 14, x, y], ["line", 4, 14], ["line", 6, 14], ["pad", 4, 3, 2], ["pad", 6, 1, 1]],
    v: [["cable", 15, x, y], ["line", 4, 15], ["line", 6, 15], ["pad", 4, 0, 0]],
    bar: [["cable", 13, x, y], ["bar", 4, 6]],
    ez: [["cable", 13, x, y], ["ez-bar", 4, 6]],
    parallel: [["cable", 13, x, y], ["bar", 4, 6], ["pad", 4, 0, -4], ["pad", 6, 0, -4]],
  };
  const demo = row({ ...setup, props }, path, rigs[style], style === "single" ? "one" : "both",
    style === "bar" || style === "ez" ? "palm-down" : "thumb-up");
  if (turning) {
    const [start, finish] = demo.frames;
    const turned = finish.map((point, index) => index === 0 || index === 1 ? shift(point, -9, -2)
      : index === 5 || index === 6 ? shift(point, 13, -1) : point);
    return { ...demo, frames: [start, turned] };
  }
  if (recoil) return { ...demo, frames: [demo.frames[0], demo.frames[1], demo.frames[1]] };
  return demo;
}

function cableOneRope(): Illustration {
  const demo = cable(onFootplates, seatRow, 132, "single");
  return {
    ...demo,
    dynamic: [["thumb-up", 4, 11], ["cable", 14, 246, 132], ["line", 4, 14], ["pad", 4, 3, 0]],
    frames: demo.frames.map((frame) => frame.map((point, index) => index === 14 ? shift(frame[4], 15, 0) : point)),
  };
}

function scapular(setup: Setup, source: "dumbbell" | "high" | "low"): Illustration {
  if (source === "dumbbell") {
    const [start] = bentRow;
    const retracted = start.map((point) => shift(point, -2, -7)) as Arms;
    return row(setup, [start, retracted], dumbbells);
  }
  const [start] = source === "high" ? highRow : pulleyLowStanding;
  const squeezed = start.map((point) => shift(point, -8, source === "high" ? 2 : -2)) as Arms;
  return cable(setup, [start, squeezed], source === "high" ? 31 : 131, "single", false, true);
}

export function leverSeat(level: "low" | "middle" | "high", options: { side?: Sides; grip?: Grip; narrow?: boolean; stack?: boolean } = {}): Illustration {
  const { side = "both", grip = "thumb-up", narrow = false, stack = false } = options;
  const height = level === "high" ? 21 : level === "low" ? 62 : 146;
  const pinX = level === "high" ? 146 : level === "low" ? 176 : 189;
  const pins: Pair = [[pinX, height], [pinX - (narrow ? 9 : 20), height]];
  const radius = level === "high" ? 60 : level === "low" ? 48 : 66;
  const startAngle = level === "high" ? 33 : level === "low" ? 74 : -86;
  const endAngle = level === "high" ? 101 : level === "low" ? 137 : -132;
  const hand = ([x, y]: Point, angle: number): Point => [
    x + Math.cos(angle * Math.PI / 180) * radius, y + Math.sin(angle * Math.PI / 180) * radius,
  ];
  const at = (angle: number, retracted: boolean): Arms => [
    retracted ? [109, 99] : [166, level === "high" ? 61 : level === "low" ? 89 : 79], hand(pins[0], angle),
    retracted ? [99, 101] : [153, level === "high" ? 62 : level === "low" ? 91 : 78], hand(pins[1], angle),
  ];
  const props: Props = [...(braced.props ?? []), [218, 24, 218, 156], [189, 156, 229, 156],
    [pins[1][0], height, 218, height]];
  if (stack) props.push([225, 31, 225, 155], [240, 31, 240, 155], [225, 31, 240, 31],
    [225, 123, 240, 123], [225, 129, 240, 129], [225, 135, 240, 135], [225, 141, 240, 141]);
  const gear: Attachments = [["line", 4, ...pins[0]], ["pad", 4, 0, 0]];
  if (side !== "one") gear.push(["line", 6, ...pins[1]], ["pad", 6, 0, 0]);
  const demo = row({ ...braced, props }, [at(startAngle, false), at(endAngle, true)], gear, side, grip);
  if (!stack) {
    const plate = (w: Point, p: Point): Point => [(w[0] + p[0] * 2) / 3, (w[1] + p[1] * 2) / 3];
    return {
      ...demo, dynamic: [...(demo.dynamic ?? []), ["barbell-end", 16, 0, 0], ...(side !== "one" ? [["plate", 17, 0, 0]] as Attachments : [])],
      frames: demo.frames.map((frame) => [...frame, plate(frame[4], pins[0]), plate(frame[6], pins[1])]),
    };
  }
  return demo;
}

function tBar(setup: Setup, { grip = "thumb-up", wide = false, single = false, band = false }:
  { grip?: Grip; wide?: boolean; single?: boolean; band?: boolean } = {}): Illustration {
  const pivot: Point = [58, 153];
  const radius = band ? 115 : 110;
  const path: Path = wide ? flaredBentRow : declineTorsoRow;
  const at = (arms: Arms, angle: number): Arms => {
    const x = pivot[0] + Math.cos(angle) * radius, y = pivot[1] + Math.sin(angle) * radius;
    const gripGap = wide ? 16 : 6;
    return [arms[0], [x + gripGap, y - 2], arms[2], [x - gripGap, y + 2]];
  };
  const props: Props = [...(setup.props ?? []), [45, 156, 79, 156], [54, 153, 64, 153]];
  const gear: Attachments = [["line", single ? 4 : 13, ...pivot], ["barbell-end", single ? 4 : 13, -10, 1]];
  if (!single) gear.push(["bar", 4, 6]);
  if (band) gear.push(["band", 13, 138, 155]);
  return row({ ...setup, props }, [at(path[0], -.23), at(path[1], -.64)], gear, single ? "one" : "both", grip);
}

function landmine(setup: Setup): Illustration {
  const pivot: Point = [53, 151];
  const props: Props = [...(setup.props ?? []), [38, 156, 72, 156], [49, 152, 60, 152]];
  const route: Path = [
    [[155, 104], [158, 132], bentRow[0][2], bentRow[0][3]],
    [[113, 83], [143, 94], bentRow[1][2], bentRow[1][3]],
  ];
  return row({ ...setup, props }, route, [["line", 4, ...pivot], ["barbell-end", 4, -9, 2]], "one");
}

function smith(setup: Setup, single: boolean, narrow: boolean): Illustration {
  const rails: Props = [...(setup.props ?? []), [80, 27, 80, 157], [224, 27, 224, 157],
    [80, 27, 224, 27], [84, 157, 65, 157], [225, 157, 240, 157], [89, 40, 89, 147], [216, 40, 216, 147]];
  const path: Path = [
    [bentRow[0][0], [159, 129], bentRow[0][2], [narrow ? 147 : 137, 129]],
    [bentRow[1][0], [159, 94], bentRow[1][2], [narrow ? 147 : 137, 94]],
  ];
  const demo = row({ ...setup, props: rails }, path, [["bar", 16, 17], ["barbell-end", 16, 0, 0], ["barbell-end", 17, 0, 0]], single ? "one" : "both", "palm-down");
  return { ...demo, frames: demo.frames.map((frame) => [...frame, [89, frame[4][1]], [216, frame[4][1]]]) };
}

function inverted(width: "close" | "shoulder" | "wide", grip: Grip, support: "rack" | "high-rack" | "table" | "chairs" | "parallel" = "rack",
  feet: "floor" | "bent" | "chair" = "floor"): Illustration {
  const y = support === "high-rack" ? 48 : support === "table" ? 82 : support === "chairs" ? 73 : 60;
  const edge = support === "table" || support === "chairs" ? 196 : 236;
  const bar: Props = [[73, y, edge + 4, y], [77, y, 77, 157], [edge, y, edge, 157],
    [65, 157, 96, 157], [edge - 14, 157, edge + 9, 157]];
  if (support === "chairs") bar.push([66, 107, 97, 107], [180, 107, 208, 107], [68, 107, 68, 157], [207, 107, 207, 157]);
  if (support === "parallel") bar.push([65, y + 7, 241, y + 7], [70, y + 7, 70, 156], [229, y + 7, 229, 157]);
  const shoe = feet === "chair" ? 115 : 156;
  if (feet === "chair") bar.push([204, 118, 248, 118], [208, 118, 208, 157], [241, 118, 241, 157], [244, 91, 244, 117]);
  const bent = feet === "bent";
  const elevated = feet === "chair";
  const from: Setup = {
    body: [[118, y + 48], [132, y + 57], [169, bent ? 124 : elevated ? 123 : (y + 57 + shoe) / 2]],
    legs: [[191, bent ? 123 : (y + 57 + 2 * shoe) / 3], [218, shoe],
      [183, bent ? 123 : (y + 59 + 2 * shoe) / 3], [210, shoe]],
  };
  const up: Setup = { body: [[109, y + 1], [129, y + 10], [167, bent ? y + 31 : (y + 10 + shoe) / 2]],
    legs: [[191, bent ? y + 39 : (y + 10 + 2 * shoe) / 3], [218, shoe],
      [182, bent ? y + 40 : (y + 12 + 2 * shoe) / 3], [210, shoe]] };
  const first: Point = [width === "wide" ? 163 : 149, y + 1];
  const second: Point = [width === "close" ? 138 : width === "wide" ? 105 : 119, y + (support === "parallel" ? 6 : 1)];
  return clip([
    assemble(from, [[(first[0] + 132) / 2, y + 29], first, [(second[0] + 132) / 2, y + 28], second]),
    assemble(up, [[width === "wide" ? 162 : 173, y + 15], first, [width === "wide" ? 122 : 151, y + 14], second]),
  ], bar, [[grip, 4, 11], [grip, 6, 12]], 1180);
}

function rdlAndRow(): Illustration {
  const deeper: Setup = {
    ...hinge,
    body: [[166, 75], [150, 83], [107, 101]],
    legs: [[117, 128], [132, 156], [107, 130], [111, 156]],
  };
  const stand = assemble(standing, upRow[0]);
  const extend = assemble(deeper, bentRow[0]);
  return clip([stand, extend, assemble(deeper, bentRow[1]), extend], [], dumbbells, 900);
}

function renegade(style: "normal" | "ball" | "underhand"): Illustration {
  const ball = style === "ball";
  const setup: Setup = {
    body: [[183, ball ? 91 : 110], [168, ball ? 99 : 118], [123, ball ? 113 : 126]],
    legs: ball ? [[95, 120], [70, 120], [89, 118], [62, 123]] : [[101, 137], [71, 156], [95, 139], [79, 155]],
  };
  const extended: Arms = [[168, 137], [167, 153], [153, 138], [152, 153]];
  const close: Arms = [[142, 101], [157, ball ? 123 : 130], [133, 108], [145, ball ? 125 : 135]];
  const dynamic: Attachments = ball ? [...dumbbells, ["stability-ball", 8, 0, 22]] : dumbbells;
  return row(setup, [extended, close], dynamic, "alternate", style === "underhand" ? "palm-up" : "thumb-up");
}

function anchoredBand(setup: Setup, arms: Path, y: number, side: Sides = "both", turn = false): Illustration {
  const props: Props = [[238, 36, 238, 158], [223, 158, 250, 158], [235, y, 241, y]];
  const straps: Attachments = [["band", 4, 238, y]];
  if (side !== "one") straps.push(["band", 6, 238, y]);
  const demo = row({ ...setup, props }, arms, straps, side);
  if (!turn) return demo;
  return { ...demo, frames: demo.frames.map((frame, ix) => ix % 2 ? frame.map((point, idx) => (idx < 2 ? shift(point, ix === 1 ? -8 : 7, -1) : point)) : frame) };
}

function bentOverGorilla(load: "kettlebell" | "bottle"): Illustration {
  const setup: Setup = {
    ...hinge, body: [[172, 81], [155, 90], [109, 109]],
    legs: [[148, 129], [175, 157], [107, 134], [93, 157]],
  };
  const start: Arms = [[163, 119], [163, 144], [148, 119], [149, 144]];
  const finish: Arms = [[119, 91], [145, 112], [111, 95], [133, 114]];
  const equipment = (load === "kettlebell" ? kettlebells : [["bottle-upright", 4, 0, 7], ["bottle-upright", 6, 0, 7]]) as Attachments;
  return row(setup, [start, finish], equipment, "alternate");
}

function superman(towel: boolean): Illustration {
  const setup: Setup = {
    body: [[157, 125], [143, 139], [102, 153]],
    legs: [[79, 152], [50, 156], [75, 155], [45, 155]],
  };
  const start: Arms = [[173, 139], [200, 138], [164, 137], [191, 135]];
  const finish: Arms = [[113, 134], [141, 131], [110, 142], [133, 140]];
  return row(setup, [start, finish], towel ? [["line", 4, 6]] : []);
}

function suspensionWide(kind: "straps" | "ring" | "sheet", single = false): Illustration {
  const from: Setup = {
    body: [[112, 79], [121, 91], [147, 119]],
    legs: [[165, 139], [181, 156], [159, 144], [174, 156]],
  };
  const approach: Setup = {...from, body: [[148, 59], [152, 74], [165, 114]],
    legs: [[175, 137], [181, 156], [169, 138], [174, 156]],
  };
  const start: Arms = [[146, 79], [176, 64], [140, 84], [166, 63]];
  const finish: Arms = [[137, 57], [168, 68], [127, 73], [156, 67]];
  const inactive: Pair = [[144, 106], [154, 117]];
  const rest: Pair = [[158, 94], [171, 110]];
  const pose = (setup: Setup, arms: Arms, passive: Pair) => assemble(setup, single ? [arms[0], arms[1], ...passive] : arms);
  const straps: Attachments = [["line", 4, 221, 34], [kind === "ring" ? "ring" : "pad", 4, 0, 0]];
  if (!single) straps.push(["line", 6, 212, 35], ["pad", 6, 0, 0]);
  if (kind === "sheet") straps.push(["line", 4, 220, 29], ["line", 4, 218, 32],
    ["line", 6, 217, 36], ["line", 6, 219, 38]);
  const top = kind === "sheet" ? [[206, 19, 236, 19], [235, 20, 235, 157], [220, 34, 236, 34]] as Props
    : [[217, 21, 243, 21], [242, 21, 242, 157], [212, 34, 242, 21]] as Props;
  return clip([pose(from, start, inactive), pose(approach, finish, rest)], top, straps, 1130);
}

function seatedTowel(): Illustration {
  const setup: Setup = {
    body: [[113, 76], [116, 92], [119, 146]],
    legs: [[154, 146], [192, 152], [151, 150], [184, 154]],
  };
  return row(setup, [
    [[146, 103], [175, 121], [140, 109], [165, 120]],
    [[94, 123], [129, 130], [88, 127], [119, 129]],
  ], [["line", 4, 8], ["line", 6, 10]]);
}

function sideStepRearDelt(): Illustration {
  const base: Setup = { ...standing, body: [[131, 47], [132, 63], [132, 109]],
    legs: [[149, 128], [155, 156], [116, 130], [111, 157]] };
  const start = assemble(base, standingFlared[0]);
  const shifted = (x: number) => assemble({
    body: base.body.map((p) => shift(p, x, 5)) as Setup["body"],
    legs: [[149 + Math.max(x, 0), 129], [155 + Math.max(x, 0), 157],
      [116 + Math.min(x, 0), 131], [111 + Math.min(x, 0), 157]],
  }, standingFlared[1].map((p) => shift(p, x, 5)) as Arms);
  return clip([start, shifted(27), start, shifted(-27)], [], [], 950);
}

const regularSeat = leverSeat("middle");
const lowSeat = leverSeat("low");
const landmineStanding = landmine(hinge);
const sideStanding = cable(standing, highRow, 33, "single");
const uprightCable = cable(supine, lyingUpright, 142, "bar");
const chestT = tBar(proneIncline);
const styledRack = row(oneArmRack, bentRow, dumbbell, "one");
const proneRow = row(supportedFlat, sealRow, dumbbells);
const bentBand: Attachments = [["band", 4, 8], ["band", 6, 10]];
const uprightBand = row(standing, upRow, bentBand);
const bottles: Attachments = [["bottle", 4, 0, 0], ["bottle", 6, 0, 0]];
const fullInclineLever: Setup = {
  ...proneIncline,
  body: [[166, 61], [153, 72], [113, 95]],
  props: [[78, 118, 160, 79], [90, 113, 90, 155], [147, 85, 147, 155], [82, 155, 167, 155]],
};

export const rowingIllustrations: Readonly<Record<string, Illustration>> = {
  "1046": cable(standing, highRow, 36),
  "0163": cable(onFootplates, seatRow, 139, "bar"),
  "7597": cable(braced, highRow, 34),
  "5518": cable(kneeling, kneelingPull, 135, "single"),
  "4391": cable(onFootplates, seatRow, 139, "rope"),
  "6032": cable(onFootplates, seatRow, 139, "v"),
  "4225": uprightCable,
  "9492": cable(supine, lyingUpright, 142, "ez"),
  "1205": cable(onFootplates, seatRow, 136, "single", true),
  "3914": cable(slightHinge, standingFlared, 64, "rope"),
  "6035": cable(onFootplates, shoulderHeightRow, 132, "parallel"),
  "6510": sideStanding,
  "7587": cable(braced, highRow, 34, "single"),
  "6511": scapular(standing, "high"),
  "10437": cableOneRope(),
  "6512": scapular(slightHinge, "low"),
  "11263": cable(split, shoulderHeightRow, 68, "single", true),
  "7564": cable(split, pulleyLowStanding, 134, "single"),
  "1210": cable(split, highRow, 36, "single", true),
  "1212": cable(standing, shoulderHeightRow, 73, "single", true),

  "6136": scapular(hinge, "dumbbell"),
  "4741": row(paddedHead, declineTorsoRow, dumbbells),
  "4744": row({ ...proneIncline, body: [[158, 63], [145, 66], [111, 101]],
    props: [[103, 115, 170, 65], [123, 100, 123, 156], [150, 80, 150, 156], [104, 156, 167, 156]] }, declineTorsoRow, dumbbells),
  "10329": {
    ...row(supportedArmAndKnee, bentRow, dumbbell, "one"),
    frames: [
      assemble(supportedArmAndKnee, [bentRow[0][0], bentRow[0][1], ...supportedArmAndKnee.freeArm!]),
      assemble({ ...supportedArmAndKnee, body: [[170, 67], [155, 74], [114, 85]] }, [bentRow[1][0], bentRow[1][1], ...supportedArmAndKnee.freeArm!]),
    ],
  },
  "5697": proneRow,
  "4425": row(supportedFlat, closeSealRow, dumbbells),
  "4426": row(supportedFlat, wideSealRow, dumbbells),
  "1236": styledRack,
  "2326": row(hinge, bentRow, dumbbells, "both", "palm-down"),
  "4749": rdlAndRow(),
  "2980": renegade("normal"),
  "8223": renegade("ball"),
  "8222": renegade("underhand"),
  "2511": row(proneIncline, declineTorsoRow, dumbbells, "both", "palm-up"),

  "3096": leverSeat("middle", { side: "alternate", narrow: true }),
  "6514": chestT,
  "6513": tBar(proneIncline, { grip: "palm-down" }),
  "10866": tBar(splitHinge, { single: true }),
  "6515": tBar(proneIncline, { single: true }),
  "6517": tBar(proneIncline, { single: true, wide: true }),
  "6516": tBar(proneIncline, { wide: true }),
  "4899": tBar(proneIncline, { wide: true, grip: "palm-down" }),
  "10867": tBar(fullInclineLever),
  "10646": tBar(fullInclineLever, { grip: "palm-down" }),
  "4214": lowSeat,
  "4062": tBar(supportedFlat, { band: true }),
  "1194": tBar(supportedFlat),
  "3102": leverSeat("middle", { narrow: true }),
  "4215": leverSeat("low", { side: "one" }),
  "1235": leverSeat("middle", { side: "one", stack: true }),
  "5447": leverSeat("middle", { grip: "palm-down" }),
  "4378": leverSeat("high", { grip: "palm-up" }),
  "1237": regularSeat,
  "2664": regularSeat,
  "11880": tBar({ ...proneIncline, props: [...inclinePad, [78, 155, 118, 155]] }),

  "3992": row(hinge, flaredBentRow, barbell, "both", "palm-down"),
  "4126": row({ ...hinge, props: [[92, 55, 92, 156], [208, 55, 208, 156], [94, 133, 150, 133], [152, 133, 208, 133]] },
    bentRow, barbell, "both", "palm-down", true),
  "4424": inverted("close", "palm-down"),
  "4423": inverted("close", "palm-up"),
  "3654": inverted("shoulder", "palm-down"),
  "8798": row(supportedFlat, wideSealRow, barbell, "both", "palm-down"),
  "5632": row(standing, upRow, barbell, "both", "palm-down"),
  "4039": landmine(supportedArmAndKnee),
  "4038": landmineStanding,
  "5034": landmineStanding,
  "11762": smith(proneIncline, false, false),
  "2671": smith(hinge, false, true),
  "3945": smith(hinge, true, false),
  "4536": row(hinge, flaredBentRow, kettlebells),
  "7230": bentOverGorilla("kettlebell"),
  "4408": row(standing, upRow, [["kettlebell", 13, 0, 11]]),
  "7114": row(standing, upRow, ezBar, "both", "palm-down"),
  "4148": anchoredBand(standing, highRow, 42),
  "4146": anchoredBand(standing, shoulderHeightRow, 70, "one", true),
  "3325": anchoredBand(split, pulleyLowStanding, 131, "alternate", true),
  "0892": row(hinge, bentRow, bentBand),
  "4698": row(hinge, bentRow, bentBand),
  "0934": uprightBand,
  "1500": uprightBand,
  "4695": row(standing, upRow, [["band", 4, 8]], "one"),
  "6071": row(standing, upRow, bottles),
  "6072": row(slightHinge, upRow, bottles),
  "7276": bentOverGorilla("bottle"),

  "4917": inverted("shoulder", "palm-down", "high-rack"),
  "3381": inverted("shoulder", "palm-down", "table"),
  "3382": inverted("shoulder", "palm-down", "table", "bent"),
  "3388": inverted("shoulder", "palm-down", "chairs"),
  "3485": inverted("shoulder", "palm-down", "chairs", "bent"),
  "3538": inverted("shoulder", "palm-up", "chairs"),
  "4770": inverted("wide", "palm-down"),
  "3536": inverted("shoulder", "palm-down", "chairs", "chair"),
  "3537": inverted("shoulder", "palm-up", "chairs", "chair"),
  "7554": inverted("shoulder", "thumb-up", "parallel", "bent"),
  "3749": suspensionWide("sheet"),
  "6259": suspensionWide("ring", true),
  "9503": suspensionWide("straps"),
  "1133": suspensionWide("straps", true),
  "3848": seatedTowel(),
  "4939": superman(false),
  "3559": superman(true),
  "6011": sideStepRearDelt(),
};
