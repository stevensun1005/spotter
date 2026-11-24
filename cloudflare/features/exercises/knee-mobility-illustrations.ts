import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Space = [along: number, across: number, up: number];
type Step = "kneel" | "near" | "far" | "stand-near" | "stand-far" | "stand";

function figure(head: Point, shoulder: Point, hip: Point, arms: [Limb, Limb], legs: [Limb, Limb], toes: [Point, Point]): Point[] {
  return [head, shoulder, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function make(frames: Point[][], props: Props = [], extra: Attachments = [], ms = 830): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...extra], ms, reference: true };
}

function bench(x: number, width: number, height: number): Props {
  return [[x, height, x + width, height], [x + 5, height, x + 5, 158], [x + width - 5, height, x + width - 5, 158]];
}

function chair(x: number, y = 113): Props {
  return [...bench(x, 51, y), [x + 3, y, x + 3, y - 46], [x + 3, y - 20, x + 17, y - 20]];
}

function kneeHipSequence(kind: "rear" | "straight-rear" | "rear-side" | "circle" | "bent-side" | "arc" | "pulse" | "side-kick" | "straight-side" | "band-arc" | "bench-arc", band?: "held" | "thigh") {
  const elevated = kind === "bench-arc";
  const level = elevated ? 24 : 0;
  const lateral = kind !== "rear" && kind !== "straight-rear" && kind !== "pulse";
  const view = ([along, across, up]: Space): Point => lateral
    ? [146 + .59 * along + .98 * across, 148 - up + .33 * across - .25 * along - level]
    : [147 + .88 * along + .67 * across, 154 - up + .20 * across - .035 * along - level];
  const rest: [Space, Space, Space] = [[34, 11, 0], [67, 10, 3], [77, 10, 1]];
  const rear: [Space, Space, Space] = [[67, 12, 42], [69, 12, 75], [78, 12, 73]];
  const straight: [Space, Space, Space] = [[70, 11, 41], [102, 11, 48], [110, 11, 42]];
  const kneeSide: [Space, Space, Space] = [[34, 46, 39], [65, 46, 40], [75, 47, 38]];
  const longSide: [Space, Space, Space] = [[33, 44, 39], [33, 77, 41], [37, 85, 38]];
  const lowLongSide: [Space, Space, Space] = [[34, 41, 23], [36, 69, 5], [42, 77, 5]];
  const diagonal: [Space, Space, Space] = [[55, 36, 46], [75, 61, 47], [80, 68, 43]];
  const bentDiagonal: [Space, Space, Space] = [[56, 37, 45], [81, 29, 53], [89, 29, 48]];
  const circleTop: [Space, Space, Space] = [[47, 44, 49], [74, 44, 52], [84, 43, 49]];
  const circleBottom: [Space, Space, Space] = [[46, 35, 23], [79, 34, 27], [88, 33, 22]];
  const pulseDown: [Space, Space, Space] = [[65, 12, 35], [68, 12, 65], [77, 12, 64]];
  const sequences: Record<typeof kind, [Space, Space, Space][]> = {
    rear: [rest, rear, rear],
    "straight-rear": [rest, straight, straight],
    "rear-side": [rest, rear, bentDiagonal, longSide, kneeSide, rest],
    circle: [rest, kneeSide, circleTop, bentDiagonal, circleBottom, kneeSide, circleBottom, bentDiagonal, circleTop, kneeSide, rest],
    "bent-side": [rest, kneeSide, kneeSide],
    arc: [straight, diagonal, longSide, diagonal],
    pulse: [rest, pulseDown, rear, pulseDown, rear, pulseDown],
    "side-kick": [rest, kneeSide, longSide, kneeSide],
    "straight-side": [lowLongSide, longSide, longSide],
    "band-arc": [kneeSide, bentDiagonal, rear, bentDiagonal],
    "bench-arc": [straight, diagonal, longSide, diagonal],
  };
  const rig: Props = elevated ? [
    [105, 128, 159, 105], [159, 105, 196, 117], [196, 117, 142, 140], [142, 140, 105, 128],
    [113, 132, 113, 155], [146, 138, 146, 158], [190, 120, 190, 151],
  ] : [];
  const load: Attachments = band === "held" ? [["band", 11, 4], ["band", 11, 6]]
    : band === "thigh" ? [["knee-band", 7, 9]] : [];
  const frames = sequences[kind].map(([workingKnee, workingAnkle, workingToe]) => [
    [-45, 0, 52], [-29, 0, 47], [28, 0, 43],
    [-29, 13, 26], [-29, 13, 0], [-26, -14, 25], [-25, -14, 0],
    workingKnee, workingAnkle, [32, -13, -3], [65, -14, 0], workingToe, [74, -14, -1],
  ].map(point => view(point as Space)));
  const motion = make(frames, rig, load, kind === "pulse" ? 610 : 800);
  return lateral ? { ...motion, topView: !elevated } : motion;
}

function kneelingTransition(kind: "alternate" | "hold" | "stand") {
  const sequence: Record<typeof kind, Step[]> = {
    alternate: ["kneel", "near", "near", "kneel", "far", "far"],
    hold: ["near", "near", "stand-near", "stand-near", "near"],
    stand: ["kneel", "near", "stand-near", "stand", "stand-near", "near", "kneel", "far", "stand-far", "stand", "stand-far", "far"],
  };
  const makeFrame = (position: Step): Point[] => {
    const tall = position.startsWith("stand");
    const half = position === "near" || position === "far";
    const knee: Point = [143 + (half ? 9 : 0), tall ? 120 : 153];
    const hip: Point = [144 + (half ? 8 : tall ? 22 : 0), tall ? 92 : 119];
    const shoulders: Point = [hip[0] + 1, hip[1] - 38];
    const lead: Limb = half ? [[177, 121], [172, 155]] : [[181, 124], [176, 155]];
    const trailing: Limb = tall ? position === "stand" ? [[160, 123], [161, 155]] : [[154, 123], [139, 155]]
      : [knee, [110, 154]];
    const other: Limb = tall ? position === "stand" ? [[169, 123], [172, 155]] : [[165, 123], [165, 155]]
      : [[138, 151], [106, 152]];
    const near = position === "near" || position === "stand-near" ? lead : trailing;
    const far = position === "far" || position === "stand-far" ? lead : other;
    const armBias = kind === "hold" ? 26 : 13;
    return figure([shoulders[0] + 2, shoulders[1] - 17], shoulders, hip,
      [[[shoulders[0] + 15, shoulders[1] + 15], [shoulders[0] + armBias + 13, shoulders[1] + 14]],
        [[shoulders[0] + 8, shoulders[1] + 16], [shoulders[0] + armBias + 5, shoulders[1] + 16]]],
      [near, far], [[near[1][0] + (tall || near === lead ? 10 : -8), near[1][1] + 2],
        [far[1][0] + (tall || far === lead ? 9 : -7), far[1][1] + 2]]);
  };
  return make(sequence[kind].map(makeFrame), [], [], 920);
}

function kneeMobility(kind: "standing" | "chair-kneeling" | "floor-slide") {
  const seat = kind === "floor-slide";
  const kneeling = kind === "chair-kneeling";
  const rig: Props = seat ? chair(96, 116) : kneeling ? [...chair(210, 118), [203, 72, 211, 72], [105, 158, 156, 158]]
    : [[205, 82, 205, 157], [196, 83, 221, 83]];
  const makeFrame = (amount: number): Point[] => {
    if (seat) return figure([118, 55], [118, 73], [122, 110],
      [[[132, 95], [154, 111]], [[125, 95], [146, 110]]],
      [[[166 - 6 * amount, 115], [166 - 26 * amount, 155]], [[159, 115], [158, 155]]],
      [[176 - 26 * amount, 157], [166, 157]]);
    if (kneeling) {
      const hip: Point = [142 - 20 * amount, 116 + 13 * amount];
      const shoulders: Point = [hip[0] + 2, hip[1] - 42];
      return figure([shoulders[0] + 4, shoulders[1] - 15], shoulders, hip,
        [[[168 - 8 * amount, 87], [209, 73]], [[159 - 4 * amount, 90], [206, 75]]],
        [[[177 - 5 * amount, 121 + 12 * amount], [181, 156]], [[137, 153], [106, 154]]],
        [[190, 158], [97, 156]]);
    }
    return figure([145, 40], [147, 59], [147, 103],
      [[[171, 82], [204, 83]], [[152, 84], [159, 106]]],
      [[[147, 128], [147 - 31 * amount, 155 - 42 * amount]], [[154, 130], [157, 156]]],
      [[154 - 36 * amount, 157 - 36 * amount], [166, 157]]);
  };
  return make([makeFrame(0), makeFrame(.5), makeFrame(1), makeFrame(1), makeFrame(.5)], rig, [], 850);
}

function hipCircles(kind: "kneeling" | "lying" | "standing") {
  const phases = Array.from({length: kind === "kneeling" ? 9 : 13}, (_, step) => {
    const theta = step * 2 * Math.PI / (kind === "kneeling" ? 8 : 12);
    return [Math.sin(theta), kind === "kneeling" ? Math.cos(theta) : Math.sin(2 * theta)];
  });
  const frames = phases.map(([across, up]) => {
    if (kind === "standing") {
      const knee: Point = [165 + across * 20, 102 + up * 11];
      const foot: Point = [knee[0] - 3 + across * 4, knee[1] + 30];
      return figure([146, 40], [146, 58], [146, 101],
        [[[173, 82], [195, 83]], [[132, 82], [128, 110]]],
        [[knee, foot], [[139, 129], [141, 155]]], [[foot[0] + 8, foot[1] + 1], [149, 157]]);
    }
    if (kind === "lying") {
      const knee: Point = [144 + across * 15, 106 + up * 12];
      const foot: Point = [knee[0] + 25, knee[1] + 11];
      return figure([78, 145], [100, 148], [145, 148],
        [[[110, 153], [131, 155]], [[105, 150], [125, 151]]],
        [[knee, foot], [[166, 119], [188, 155]]], [[foot[0] + 5, foot[1] + 6], [198, 157]]);
    }
    const hip: Point = [147 + across * 14, 116 + up * 5];
    const shoulder: Point = [147 + across * 5, 77];
    return figure([shoulder[0], 60], shoulder, hip,
      [[[shoulder[0] + 16, 99], [hip[0] + 12, 112]], [[shoulder[0] - 16, 99], [hip[0] - 12, 112]]],
      [[[157, 153], [173, 154]], [[137, 153], [120, 154]]], [[180, 156], [113, 156]]);
  });
  if (kind === "kneeling") frames.push(...frames.slice(0, -1).reverse());
  return make(frames, kind === "standing" ? [[197, 83, 197, 158], [191, 83, 210, 83]] : [], [], kind === "kneeling" ? 560 : 650);
}

function kneeTap() {
  const frames = [0, 1, 0, -1].map(side => {
    const near = side === 1, far = side === -1;
    return figure([149, 44], [149, 61], [149, 99],
      side ? [[[171, 84], [151 + side * 7, 107]], [[129, 84], [149 + side * 7, 107]]] : [[[169, 81], [175, 94]], [[131, 81], [126, 94]]],
      [[near ? [159, 91] : [163, 126], near ? [151, 123] : [164, 156]],
        [far ? [142, 91] : [135, 126], far ? [150, 123] : [136, 156]]],
      [near ? [155, 127] : [172, 157], far ? [153, 128] : [128, 157]]);
  });
  return make(frames, [], [], 650);
}

function seatedAbduction(hover: boolean, band: boolean) {
  const raise = hover ? 13 : 0;
  const support: Props = [[116, 114 - raise, 181, 114 - raise], [121, 114 - raise, 121, 157], [176, 114 - raise, 176, 157]];
  const frame = (open: boolean): Point[] => {
    const span = open ? 31 : 16;
    const hand: [Limb, Limb] = !hover && !band
      ? [[[171, 87], [150 + span + 3, 118]], [[129, 87], [150 - span - 3, 118]]]
      : [[[166, 87 - raise], [172, 112 - raise]], [[132, 87 - raise], [127, 112 - raise]]];
    return figure([150, 48 - raise], [150, 63 - raise], [150, 108 - raise], hand,
      [[[150 + span, 119 - raise], [172 + (hover && open ? 8 : 0), 155 - raise]],
        [[150 - span, 119 - raise], [128 - (hover && open ? 8 : 0), 155 - raise]]],
      [[177 + (hover && open ? 8 : 0), 157 - raise], [122 - (hover && open ? 8 : 0), 157 - raise]]);
  };
  return make([frame(false), frame(true), frame(true)], support, band ? [["knee-band", 7, 9]] : []);
}

function seatedHug(towel: boolean) {
  const frame = (lift: number): Point[] => {
    const knee: Point = [165 - 18 * lift, 115 - 48 * lift];
    const ankle: Point = [174 - 20 * lift, 155 - 47 * lift];
    const nearHand: Point = [knee[0] + 3 + (towel ? 6 : 0), knee[1] + 12 - (towel ? 8 : 0)];
    const farHand: Point = [nearHand[0] - 8, nearHand[1] + 4];
    return [...figure([111, 56], [117, 73], [120, 110],
      [[[133, 96 - 5 * lift], nearHand], [[127, 96 - 6 * lift], farHand]],
      [[knee, ankle], [[154, 116], [156, 154]]], [[ankle[0] + 8, ankle[1] + 2], [166, 157]]),
    [knee[0] + 9, knee[1] + 23]];
  };
  const hold: Attachments = towel ? [["line", 4, 13], ["line", 6, 13], ["pad", 13, 0, 0]] : [];
  return make([frame(0), frame(.55), frame(1), frame(1), frame(.45)], chair(95,116),hold,900);
}

function seatedKneeDown() {
  const frame = (open: boolean): Point[] => figure([150, 53], [150, 70], [150, 130],
    [[[178, 106], [161, 149]], [[123, 107], [143, 149]]],
    [[[open ? 203 : 179, open ? 148 : 118], [158, 150]], [[115, 123], [142, 150]]],
    [[150, 154], [150, 154]]);
  return make([frame(false), frame(true), frame(true)], [], [], 1080);
}

function lateralKneeSweep() {
  const flow: [Point, Point, Point, Point][] = [
    [[153, 113], [189, 140], [139, 110], [177, 138]],
    [[188, 133], [164, 145], [174, 129], [155, 142]],
    [[153, 113], [189, 140], [139, 110], [177, 138]],
    [[109, 125], [154, 144], [107, 117], [145, 138]],
  ];
  const frames = flow.map(([knee, foot, farKnee, farFoot]) => figure([144, 105], [146, 121], [148, 151],
    [[[115, 125], [88, 126]], [[176, 124], [206, 125]]],
    [[knee, foot], [farKnee, farFoot]], [[foot[0] + 7, foot[1] + 3], [farFoot[0] + 6, farFoot[1] + 3]]));
  return { ...make(frames, [], [], 1030), topView: true };
}

function sideKicks(kind: "pilates" | "lying") {
  const pilates = kind === "pilates";
  const torso: { head: Point; shoulder: Point; hip: Point } = {
    head: pilates ? [172, 67] : [81, 128], shoulder: pilates ? [158, 81] : [108, 143],
    hip: pilates ? [135, 113] : [156, 145],
  };
  const arm: [Limb, Limb] = pilates ? [[[166, 118], [178, 156]], [[178, 85], [174, 66]]]
    : [[[124, 149], [133, 155]], [[82, 146], [72, 132]]];
  const main: { legs: Limb[]; other: Limb } = pilates
    ? { legs: [[[105, 94], [76, 79]], [[102, 110], [69, 106]], [[105, 129], [77, 145]], [[102, 109], [69, 106]]],
      other: [[132, 154], [107, 154]] }
    : { legs: [[[171, 119], [198, 135]], [[150, 115], [177, 126]], [[180, 110], [211, 91]], [[158, 117], [187, 123]]],
      other: [[172, 152], [142, 154]] };
  return make(main.legs.map(([knee, ankle]) => figure(torso.head, torso.shoulder, torso.hip, arm,
    [[knee, ankle], main.other], [[ankle[0] + (pilates ? -8 : 7), ankle[1] - 4], [main.other[1][0] - 7, 155]])), [], [], 880);
}

function quadSet() {
  const frame = (active: boolean): Point[] => figure([100, 89], [107, 106], [136, 149],
    [[[110, 132], [106, 155]], [[103, 133], [98, 154]]],
    [[[172, active ? 152 : 147], [206, 154]], [[153, 121], [180, 154]]], [[211, 143], [189, 157]]);
  return make([frame(false), frame(true), frame(true), frame(true)], [], [], 1580);
}

export const kneeMobilityIllustrations: Readonly<Record<string, Illustration>> = {
  "0906": kneeHipSequence("rear", "held"),
  "10058": kneelingTransition("alternate"),
  "10534": kneeMobility("floor-slide"),
  "10541": seatedHug(false),
  "10542": seatedHug(true),
  "10543": kneeMobility("chair-kneeling"),
  "10750": kneelingTransition("stand"),
  "11048": seatedAbduction(false, false),
  "11049": seatedAbduction(true, false),
  "11050": seatedAbduction(true, true),
  "11645": quadSet(),
  "11654": seatedKneeDown(),
  "2418": kneeHipSequence("bent-side", "thigh"),
  "2570": kneeHipSequence("circle"),
  "2774": kneeMobility("standing"),
  "2875": sideKicks("pilates"),
  "3035": kneeHipSequence("bent-side"),
  "4609": lateralKneeSweep(),
  "4677": kneeHipSequence("straight-rear", "held"),
  "4691": kneeHipSequence("side-kick"),
  "4692": kneeHipSequence("rear-side"),
  "4693": kneeHipSequence("arc"),
  "4884": sideKicks("lying"),
  "4896": kneeHipSequence("straight-side"),
  "4932": hipCircles("lying"),
  "4944": hipCircles("standing"),
  "5057": hipCircles("kneeling"),
  "5152": kneelingTransition("hold"),
  "5170": kneeHipSequence("pulse"),
  "6094": kneeTap(),
  "6741": kneeHipSequence("bench-arc", "thigh"),
  "7200": seatedAbduction(false, true),
  "7209": kneeHipSequence("band-arc", "thigh"),
};
