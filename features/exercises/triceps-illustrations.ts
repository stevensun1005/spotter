import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Base = { torso: [Point, Point, Point]; legs: [Pair, Pair]; props?: Props; foot?: Equipment };

const standing: Base = {
  torso: [[151, 62], [154, 82], [152, 117]],
  legs: [[[158, 136], [162, 154]], [[144, 137], [140, 154]]],
  foot: [["foot", 8, 178, 158], ["foot", 10, 153, 158]],
};
const seated: Base = {
  torso: [[151, 63], [154, 83], [152, 122]],
  legs: [[[182, 124], [186, 154]], [[171, 128], [172, 154]]],
  props: [[122, 129, 166, 129], [129, 130, 129, 158], [161, 130, 161, 158]],
  foot: [["foot", 8, 201, 158], ["foot", 10, 183, 158]],
};
const backed: Base = { ...seated, props: [...seated.props!, [140, 81, 140, 129], [128, 89, 128, 129]] };
const chair: Base = { ...backed, props: [...backed.props!, [128, 75, 141, 75], [126, 75, 126, 129]] };
const ball: Base = { ...seated, props: undefined, foot: [...seated.foot!, ["stability-ball", 2, -6, 18]] };
const flat: Base = {
  torso: [[76, 108], [95, 112], [153, 116]],
  legs: [[[184, 125], [187, 154]], [[176, 124], [172, 154]]],
  props: [[58, 126, 173, 126], [68, 126, 68, 156], [168, 126, 168, 156]],
  foot: [["foot", 8, 201, 158], ["foot", 10, 184, 158]],
};
const incline: Base = {
  torso: [[91, 71], [106, 85], [152, 121]],
  legs: seated.legs,
  props: [[75, 77, 153, 129], [153, 129, 177, 129], [91, 89, 91, 158], [169, 129, 169, 158]],
  foot: seated.foot,
};

function sequence(base: Base, frames: [Pair, Pair][], equipment: Equipment = [], props: Props = []): Illustration {
  return {
    frames: frames.map(([near, far]) => [...base.torso, ...near, ...far, ...base.legs[0], ...base.legs[1]]),
    props: [...(base.props ?? []), ...props],
    dynamic: [...(base.foot ?? []), ...equipment],
    ms: 900,
    reference: true,
  };
}

const tower = (x: number, pulley: number): Props => [
  [x - 6, 19, x - 6, 157], [x + 6, 19, x + 6, 157], [x - 6, 19, x + 6, 19],
  [x - 13, 157, x + 13, 157], [x - 7, pulley, x + 7, pulley],
];
const anchor = (x: number, y: number): Props => [[x, y - 14, x, y + 9], [x - 5, y, x + 5, y]];

type OverheadLoad = "db" | "shared-db" | "kettlebell" | "bottle" | "underfoot-band" | "behind-back-band" | "none";
function overhead(base: Base, load: OverheadLoad, sides: "both" | "right" | "left" | "alternating" = "both") {
  const nearElbow: Point = [164, 40];
  const farElbow: Point = [147, 40];
  const nearAngled: Pair = [nearElbow, [138, 54]];
  const nearStraight: Pair = [nearElbow, [170, 12]];
  const farAngled: Pair = [farElbow, [121, 51]];
  const farStraight: Pair = [farElbow, [143, 12]];
  const nearLoose: Pair = [[166, 111], [168, 133]];
  const farLoose: Pair = [[138, 111], [138, 133]];
  const equipment: Equipment = [];
  const hands = sides === "left" ? [6] : sides === "right" ? [4] : [4, 6];
  const frames: [Pair, Pair][] = [
    [sides === "left" ? nearLoose : nearAngled, sides === "right" ? farLoose : farAngled],
    [sides === "left" ? nearLoose : nearStraight, sides === "right" ? farLoose : farStraight],
  ];
  if (sides === "alternating") frames.splice(0, frames.length,
    [nearStraight, farStraight], [nearAngled, farStraight], [nearStraight, farStraight], [nearStraight, farAngled]);
  if (load === "db") for (const hand of hands) equipment.push(["dumbbell", hand, 0, -3]);
  if (load === "shared-db" || load === "bottle" || load === "kettlebell") {
    const bent: Pair = [[147, 40], [131, 54]];
    const straight: Pair = [[147, 40], [163, 12]];
    frames[0][1] = bent;
    frames[1][1] = straight;
    equipment.push([load === "bottle" ? "bottle-upright" : load === "kettlebell" ? "kettlebell" : "dumbbell", 4, -3, -2]);
  }
  if (load === "underfoot-band") {
    const foot = base.legs[0][1];
    for (const hand of hands) equipment.push(["band", hand, foot[0] + 7, 158]);
  }
  if (load === "behind-back-band") {
    frames[0][1] = frames[1][1] = [[127, 111], [131, 94]];
    equipment.push(["band", 4, 6]);
  }
  return sequence(base, frames, equipment);
}

const lyingOnFloor: Base = {
  torso: [[76, 143], [92, 150], [152, 151]],
  legs: [[[172, 122], [191, 154]], [[163, 123], [179, 154]]],
  foot: [["foot", 8, 206, 158], ["foot", 10, 195, 158]],
};
const headOffEdge: Base = { ...flat, torso: [[57, 124], [83, 117], [151, 116]], props: [[74, 126, 175, 126], [83, 126, 83, 158], [166, 126, 166, 158]] };

function skullCrusher(base: Base, load: "db" | "bar" | "kettlebell" | "band" | "cable") {
  const [hx, hy] = base.torso[0];
  const [sx, sy] = base.torso[1];
  const elbows: Pair = [[sx + 11, sy - 31], [sx + 23, sy - 30]];
  const lowered: [Pair, Pair] = [[elbows[0], [hx + 1, hy - 16]], [elbows[1], [hx + 13, hy - 15]]];
  const raised: [Pair, Pair] = [[elbows[0], [sx + 12, sy - 60]], [elbows[1], [sx + 24, sy - 59]]];
  const equipment: Equipment = load === "db" ? [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]] : [["bar", 4, 6]];
  if (load === "bar") equipment.push(["plate", 4, -6, 0], ["plate", 6, 6, 0]);
  if (load === "kettlebell") equipment.splice(0, 1, ["kettlebell", 4, 6, 0]);
  if (load === "band" || load === "cable") {
    equipment.push([load, 4, 43, 151], [load, 6, 43, 151]);
    if (load === "band") equipment.shift();
  }
  return sequence(base, [raised, lowered], equipment, load === "band" ? anchor(43, 151) : load === "cable" ? tower(43, 151) : []);
}

const bandFloorPressdown: Base = {
  ...lyingOnFloor,
  torso: [[77, 143], [95, 150], [163, 151]],
  legs: [[[196, 147], [225, 153]], [[190, 151], [218, 155]]],
  foot: [["foot", 8, 234, 158], ["foot", 10, 227, 158]],
};
const floorReverseGrip = sequence(bandFloorPressdown, [
  [[[104, 121], [78, 108]], [[120, 122], [94, 110]]],
  [[[104, 121], [131, 137]], [[120, 122], [146, 138]]],
], [["band", 4, 50, 144], ["band", 6, 50, 144], ["palm-up", 4, 11], ["palm-up", 6, 12]], anchor(50, 144));
floorReverseGrip.frames[0].push([74, 105], [90, 107]);
floorReverseGrip.frames[1].push([136, 138], [150, 139]);

function pressdown(mode: "band" | "kneeling-half" | "cross" | "cross-single" | "seated-floor") {
  const kneeling: Base = {
    torso: [[149, 72], [150, 89], [147, 128]],
    legs: [[[154, 154], [118, 155]], [[140, 154], [104, 155]]],
    foot: [["foot", 8, 110, 158], ["foot", 10, 96, 158]],
  };
  const sitting: Base = {
    torso: [[132, 89], [134, 106], [134, 150]],
    legs: [[[173, 139], [205, 154]], [[169, 145], [193, 154]]],
    foot: [["foot", 8, 219, 158], ["foot", 10, 207, 158]],
  };
  if (mode === "cross" || mode === "cross-single") {
    const double = mode === "cross";
    const start: [Pair, Pair] = [[[168, 111], [144, 91]], double ? [[141, 111], [165, 92]] : [[137, 113], [135, 135]]];
    const end: [Pair, Pair] = [[[168, 111], double ? [178, 138] : [144, 132]], double ? [[141, 111], [132, 139]] : start[1]];
    return sequence(standing, [start, end], double
      ? [["cable", 4, 238, 25], ["cable", 6, 72, 25]]
      : [["cable", 4, 230, 25]], double ? [...tower(72, 25), ...tower(238, 25)] : tower(230, 25));
  }
  if (mode === "seated-floor") return sequence(sitting, [
    [[[152, 129], [169, 109]], [[141, 129], [158, 109]]],
    [[[152, 129], [168, 149]], [[141, 129], [152, 151]]],
  ], [["cable", 4, 234, 143], ["cable", 6, 234, 143], ["bar", 4, 6]], tower(234, 143));
  if (mode === "kneeling-half") return sequence(kneeling, [
    [[[159, 114], [175, 132]], [[149, 112], [165, 131]]],
    [[[159, 114], [160, 140]], [[149, 112], [150, 138]]],
  ], [["cable", 4, 225, 25], ["cable", 6, 225, 25], ["bar", 4, 6]], tower(225, 25));
  return sequence(standing, [
    [[[160, 109], [185, 97]], [[147, 108], [174, 97]]],
    [[[160, 109], [162, 138]], [[147, 108], [151, 137]]],
  ], [["band", 4, 228, 32], ["band", 6, 228, 32]], anchor(228, 32));
}

const horizontalCable = sequence({
  ...standing, torso: [[155, 50], [151, 71], [143, 115]],
  legs: [[[173, 133], [181, 154]], [[134, 135], [112, 154]]],
  foot: [["foot", 8, 196, 158], ["foot", 10, 125, 158]],
}, [
  [[[180, 73], [162, 57]], [[139, 98], [137, 125]]],
  [[[180, 73], [207, 73]], [[139, 98], [137, 125]]],
], [["cable", 4, 67, 68]], tower(67, 68));

function kickback(load: "cable" | "band" | "db" | "bottle", position: "hinge" | "bench" | "incline", bilateral: boolean) {
  const setup: Base = position === "incline" ? {
    torso: [[106, 60], [120, 75], [168, 106]],
    legs: [[[177, 133], [194, 154]], [[166, 134], [180, 154]]],
    props: [[100, 72, 164, 122], [164, 122, 183, 122], [123, 89, 123, 156], [177, 123, 177, 156]],
    foot: [["foot", 8, 181, 158], ["foot", 10, 167, 158]],
  } : position === "bench" ? {
    torso: [[101, 66], [113, 80], [163, 91]],
    legs: [[[181, 121], [199, 155]], [[162, 120], [197, 121]]],
    props: [[79, 125, 210, 125], [87, 126, 87, 158], [203, 126, 203, 158]],
    foot: [["foot", 8, 215, 158]],
  } : {
    torso: [[114, 69], [129, 85], [177, 107]],
    legs: [[[173, 129], [182, 154]], [[165, 130], [152, 154]]],
    foot: [["foot", 8, 168, 158], ["foot", 10, 139, 158]],
  };
  const [x, y] = setup.torso[1];
  const elbow: Point = [x + 29, y + 5];
  const farElbow: Point = [x + 33, y - 1];
  const opposite: Pair = position === "bench" ? [[x - 10, 102], [x - 12, 123]] : [[x - 4, y + 22], [x - 6, y + 48]];
  const start: [Pair, Pair] = [[elbow, [elbow[0], elbow[1] + 27]], bilateral ? [farElbow, [farElbow[0] + 3, farElbow[1] + 27]] : opposite];
  const end: [Pair, Pair] = [[elbow, [elbow[0] + 27, elbow[1] + 5]], bilateral ? [farElbow, [farElbow[0] + 27, farElbow[1] + 2]] : opposite];
  const equipment: Equipment = [];
  for (const hand of bilateral ? [4, 6] : [4]) {
    if (load === "band") equipment.push(["band", hand, 164, 158]);
    else if (load === "cable") equipment.push(["cable", hand, 56, 145]);
    else equipment.push([load === "bottle" ? "bottle-upright" : "dumbbell", hand, 0, 0]);
  }
  return sequence(setup, [start, end], equipment, load === "cable" ? tower(56, 145) : []);
}

const bodyweightBar = {
  frames: [
    [[135, 92], [123, 96], [172, 121], [135, 119], [104, 118], [124, 122], [95, 123], [198, 131], [227, 154], [189, 135], [211, 155]],
    [[151, 72], [139, 83], [184, 119], [121, 102], [104, 118], [113, 105], [95, 123], [199, 129], [227, 154], [190, 135], [211, 155]],
  ],
  dynamic: [["foot", 8, 239, 158], ["foot", 10, 222, 158]],
  ms: 950,
  reference: true,
  props: [[94, 124, 106, 118], [96, 124, 96, 158], [105, 120, 105, 152], [83, 158, 113, 158]],
} satisfies Illustration;

const floorDip = {
  frames: [
    [[141, 64], [143, 82], [156, 124], [136, 118], [124, 155], [124, 120], [111, 155], [195, 122], [213, 154], [181, 126], [197, 154]],
    [[139, 83], [143, 100], [158, 142], [117, 123], [124, 155], [107, 124], [111, 155], [194, 126], [213, 154], [180, 128], [197, 154]],
  ],
  dynamic: [["foot", 8, 229, 158], ["foot", 10, 209, 158]],
  ms: 950,
  reference: true,
} satisfies Illustration;

const standingBandOverhead = overhead(standing, "underfoot-band");
const standingBandPressdown = pressdown("band");
const inclineKickback = kickback("db", "incline", true);

export const tricepsIllustrations: Record<string, Illustration> = {
  // Each group shares only the equipment, support and arm action described by its rows.
  "0903": kickback("band", "hinge", true),
  "4143": kickback("band", "hinge", false),
  "1068": kickback("cable", "hinge", false),
  "7879": inclineKickback,
  "4961": inclineKickback,
  "7880": kickback("db", "bench", false),
  "6065": kickback("bottle", "hinge", false),
  "6066": kickback("bottle", "hinge", true),

  "3939": standingBandOverhead,
  "4139": standingBandOverhead,
  "4694": standingBandOverhead,
  "4140": overhead(standing, "underfoot-band", "right"),
  "4141": overhead(standing, "underfoot-band", "right"),
  "4359": overhead(standing, "behind-back-band", "right"),
  "4343": overhead(standing, "db", "right"),
  "4054": overhead(ball, "db", "right"),
  "6148": overhead(seated, "db", "alternating"),
  "6158": overhead(seated, "db", "right"),
  "6159": overhead(seated, "db", "left"),
  "7892": overhead(backed, "shared-db"),
  "6221": overhead(standing, "shared-db"),
  "6067": overhead(standing, "bottle"),
  "5860": overhead(standing, "kettlebell"),
  "8654": overhead(chair, "none"),

  "1502": standingBandPressdown,
  "4680": standingBandPressdown,
  "4688": standingBandPressdown,
  "3920": pressdown("seated-floor"),
  "4893": pressdown("kneeling-half"),
  "11051": pressdown("cross"),
  "3719": pressdown("cross-single"),
  "8614": horizontalCable,
  "4142": floorReverseGrip,

  "4344": skullCrusher(incline, "bar"),
  "4351": skullCrusher(incline, "cable"),
  "1504": skullCrusher(lyingOnFloor, "band"),
  "2738": skullCrusher(lyingOnFloor, "db"),
  "1191": skullCrusher(headOffEdge, "db"),
  "5861": skullCrusher(flat, "kettlebell"),
  "4667": bodyweightBar,
  "5110": floorDip,
  "5130": floorDip,
};
