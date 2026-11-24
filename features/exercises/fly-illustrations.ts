import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Span = [Arms, Arms];
type Setup = {
  body: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
  props?: Props;
  freeArm?: Pair;
};
type Height = "high" | "middle" | "low";
type Sides = "both" | "one" | "alternate";
type Grip = "thumb-up" | "palm-up";

const standing: Setup = {
  body: [[161, 40], [162, 58], [160, 103]],
  legs: [[176, 128], [182, 157], [146, 128], [141, 157]],
};
const staggered: Setup = {
  body: [[172, 44], [167, 62], [155, 105]],
  legs: [[180, 128], [191, 156], [141, 130], [121, 156]],
};
const onKnees: Setup = {
  body: [[165, 65], [162, 81], [158, 118]],
  legs: [[175, 152], [142, 156], [153, 153], [117, 156]],
};
const hinged: Setup = {
  body: [[178, 54], [164, 67], [132, 102]],
  legs: [[145, 129], [147, 157], [128, 130], [119, 157]],
};
const supportedHinge: Setup = {
  ...hinged,
  freeArm: [[186, 86], [206, 113]],
  props: [[190, 116, 223, 116], [195, 116, 195, 157], [220, 116, 220, 157]],
};
const flat: Setup = {
  body: [[107, 108], [132, 111], [176, 115]],
  legs: [[203, 118], [211, 156], [192, 121], [197, 155]],
  props: [[99, 124, 208, 124], [110, 124, 110, 156], [194, 124, 194, 156]],
};
const earsAboveFloor: Setup = {
  body: [[100, 145], [125, 149], [177, 152]],
  legs: [[197, 126], [209, 157], [184, 128], [194, 157]],
  freeArm: [[110, 151], [88, 154]],
};
const kneesUp: Setup = {
  ...flat,
  legs: [[178, 83], [210, 83], [171, 87], [199, 87]],
};
const inclineThirty: Setup = {
  body: [[109, 79], [123, 94], [165, 118]],
  legs: [[193, 120], [205, 156], [181, 123], [187, 156]],
  props: [[109, 94, 166, 127], [164, 127, 203, 127], [146, 116, 146, 155], [195, 127, 195, 155]],
};
const inclineLow: Setup = {
  ...inclineThirty,
  body: [[108, 94], [126, 104], [167, 119]],
  props: [[106, 106, 166, 128], [166, 128, 200, 128], [142, 120, 142, 155], [193, 128, 193, 155]],
};

const standingSpans: Record<Height, Span> = {
  high: [[[195, 51], [220, 52], [139, 52], [114, 52]], [[173, 88], [165, 113], [152, 88], [157, 112]]],
  middle: [[[195, 66], [219, 75], [139, 66], [116, 75]], [[174, 69], [175, 78], [165, 71], [171, 78]]],
  low: [[[185, 88], [205, 109], [146, 87], [126, 108]], [[177, 64], [181, 67], [169, 66], [175, 67]]],
};
const afterKneeling: Span = [
  [[192, 62], [217, 61], [140, 63], [115, 63]], [[175, 108], [164, 127], [150, 108], [155, 127]],
];
const flatSpan: Span = [
  [[150, 85], [141, 62], [126, 85], [134, 61]],
  [[163, 117], [187, 106], [105, 115], [81, 105]],
];
const floorSpan: Span = [
  [[143, 122], [135, 98], [122, 123], [129, 99]],
  [[153, 156], [176, 141], [100, 157], [78, 139]],
];
const upperIncline: Span = [
  [[148, 69], [138, 46], [113, 69], [132, 45]],
  [[152, 101], [177, 92], [93, 94], [71, 83]],
];
const lowIncline: Span = [
  [[147, 80], [141, 57], [124, 80], [135, 57]],
  [[155, 117], [179, 108], [101, 107], [80, 99]],
];
const bentRear: Span = [
  [[176, 90], [179, 116], [155, 92], [157, 117]],
  [[187, 66], [212, 56], [141, 70], [115, 68]],
];
const flatRear: Span = [
  [[181, 76], [194, 98], [156, 75], [165, 100]],
  [[193, 63], [217, 63], [137, 66], [113, 67]],
];
const dumbbells: Attachments = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const kettlebells: Attachments = [["kettlebell", 4, 0, 10], ["kettlebell", 6, 0, 10]];

function add([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function frame(setup: Setup, [elbow, wrist, otherElbow, otherWrist]: Arms): Point[] {
  const tip = (before: Point, at: Point) => {
    const delta: Point = [at[0] - before[0], at[1] - before[1]];
    const distance = Math.max(1, Math.hypot(...delta));
    return add(at, delta[0] * 4 / distance, delta[1] * 4 / distance);
  };
  return [...setup.body, elbow, wrist, otherElbow, otherWrist, ...setup.legs, tip(elbow, wrist), tip(otherElbow, otherWrist)];
}

function clip(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 1025): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function fly(setup: Setup, [from, to]: Span, equipment: Attachments = [], { side = "both", grip = "thumb-up", hold = false }:
  { side?: Sides; grip?: Grip; hold?: boolean } = {}): Illustration {
  const free = setup.freeArm ?? [[setup.body[1][0] - 14, setup.body[1][1] + 19], [setup.body[2][0] - 6, setup.body[2][1] - 3]];
  const at = ([a, b, c, d]: Arms) => frame(setup, side === "one" ? [a, b, ...free] : [a, b, c, d]);
  const gears: Attachments = [[grip, 4, 11], ...equipment];
  if (side !== "one") gears.push([grip, 6, 12]);
  const start = at(from), finish = at(to);
  if (side === "alternate") {
    return clip([start, at([to[0], to[1], from[2], from[3]]), start, at([from[0], from[1], to[2], to[3]])], setup.props, gears);
  }
  return clip(hold ? [start, ...Array<Point[]>(16).fill(finish)] : [start, finish], setup.props, gears);
}

function twinAnchor(setup: Setup, span: Span, y: number, options:
  { band?: boolean; side?: Sides; reverse?: boolean; grip?: Grip } = {}): Illustration {
  const { band = false, side = "both", reverse = false, grip = "thumb-up" } = options;
  const right = 244, left = 76;
  const poles: Props = band ? [[right, 30, right, 157], [left, 30, left, 157]] :
    [[right, 23, right, 156], [left, 23, left, 156], [left - 11, 156, left + 11, 156], [right - 11, 156, right + 11, 156]];
  const anchors: Props = [[left - 4, y, left + 4, y], [right - 4, y, right + 4, y]];
  const cords: Attachments = [[band ? "band" : "cable", 4, reverse ? left : right, y]];
  if (side !== "one") cords.push([band ? "band" : "cable", 6, reverse ? right : left, y]);
  return fly({ ...setup, props: [...(setup.props ?? []), ...poles, ...anchors] }, span, cords, { side, grip });
}

function oneSideCable(setup: Setup, span: Span, y: number, rear = false): Illustration {
  const x = rear ? 81 : 245;
  const props: Props = [...(setup.props ?? []), [x, 30, x, 156], [x - 4, y, x + 4, y], [x - 11, 156, x + 11, 156]];
  return fly({ ...setup, props }, span, [["cable", 4, x, y]], { side: "one" });
}

function rotatingFly(): Illustration {
  const [close, open] = flatSpan;
  const midway = close.map(([x, y], i): Point => [(x + open[i][0]) / 2, (y + open[i][1]) / 2 - 12]) as Arms;
  const at = (arms: Arms, angle: number): Point[] => {
    const pose = frame(flat, arms);
    const [dx, dy] = [8 * Math.cos(angle), 8 * Math.sin(angle)];
    return [...pose, add(pose[4], dx, dy), add(pose[4], -dx, -dy), add(pose[6], dx, dy), add(pose[6], -dx, -dy)];
  };
  return clip([at(close, Math.PI / 2), at(midway, Math.PI / 4), at(open, 0), at(midway, Math.PI / 4)], flat.props, [
    ["bar", 13, 14], ["bar", 15, 16], ["plate", 13, 0, 0], ["plate", 14, 0, 0],
    ["plate", 15, 0, 0], ["plate", 16, 0, 0],
  ], 800);
}

function chainsFly(): Illustration {
  return fly(flat, flatSpan, [...dumbbells, ["chain", 4, 0, 156], ["chain", 6, 0, 156]]);
}

function landmineFly(): Illustration {
  const pivot: Point = [240, 151];
  const wrist = (angle: number): Point => [pivot[0] - 85 * Math.cos(angle), pivot[1] - 85 * Math.sin(angle)];
  const low: Arms = [[151, 155], wrist(.25), floorSpan[1][2], floorSpan[1][3]];
  const high: Arms = [[150, 122], wrist(.62), floorSpan[0][2], floorSpan[0][3]];
  const props: Props = [[225, 156, 255, 156], [238, 149, 244, 149]];
  return fly({ ...earsAboveFloor, props }, [high, low],
    [["line", 4, ...pivot], ["barbell-end", 4, 8, 4]], { side: "one" });
}

const seat: Props = [[127, 118, 173, 118], [135, 118, 135, 156], [160, 118, 160, 156]];
const backSeat: Setup = {
  body: [[132, 45], [142, 62], [161, 110]],
  legs: [[183, 118], [189, 156], [170, 119], [172, 156]],
  props: [...seat, [130, 58, 152, 116]],
};
const chestSeat: Setup = {
  body: [[165, 53], [159, 68], [141, 111]],
  legs: [[165, 119], [171, 156], [151, 117], [149, 156]],
  props: [...seat, [165, 73, 150, 107], [160, 85, 181, 115], [179, 114, 179, 156]],
};
const sideSeat: Setup = {
  body: [[153, 54], [149, 71], [140, 113]],
  legs: [[136, 120], [137, 156], [171, 123], [179, 157]],
  props: [...seat, [157, 72, 148, 107], [154, 85, 181, 115], [179, 114, 179, 156]],
};
const seatRear: Span = [
  [[183, 72], [202, 83], [153, 72], [178, 85]],
  [[194, 65], [220, 66], [132, 66], [107, 70]],
];

function pecDeck(setup: Setup, span: Span, model: "stack" | "plate", one = false): Illustration {
  const pinRight: Point = [224, 60], pinLeft: Point = [100, 60];
  const rack: Props = [[225, 40, 225, 158], [99, 40, 99, 158], [99, 41, 225, 41],
    [90, 156, 111, 156], [217, 156, 239, 156]];
  const handles: Attachments = [["line", 4, ...pinRight], ["pad", 4, 0, 0]];
  if (!one) handles.push(["line", 6, ...pinLeft], ["pad", 6, 0, 0]);
  if (model === "stack") rack.push([232, 66, 232, 155], [248, 66, 248, 155], [232, 66, 248, 66],
    [232, 118, 248, 118], [232, 125, 248, 125], [232, 132, 248, 132]);
  if (model === "plate") {
    handles.push(["barbell-end", 4, 8, -4]);
    if (!one) handles.push(["plate", 6, -6, -4]);
  }
  return fly({ ...setup, props: [...(setup.props ?? []), ...rack] }, span, handles, { side: one ? "one" : "both" });
}

function towelFloor(): Illustration {
  const start: Setup = {
    body: [[177, 96], [165, 106], [129, 124]],
    legs: [[108, 152], [79, 156], [100, 151], [74, 157]],
  };
  const lower: Setup = { ...start, body: [[176, 135], [162, 142], [127, 139]] };
  return clip([
    frame(start, [[173, 131], [177, 152], [154, 130], [152, 152]]),
    frame(lower, [[192, 151], [215, 154], [130, 151], [105, 154]]),
  ], [], [["slider", 4, 0, 3], ["slider", 6, 0, 3]], 1150);
}

function forwardSuspension(mode: "handles" | "split" | "rings" | "lean"): Illustration {
  const rings = mode === "rings", split = mode === "split";
  const deeper = mode === "lean";
  const hip: Point = rings ? [111, 126] : [143, 103];
  const legs: Setup["legs"] = rings ? [[91, 141], [63, 157], [84, 143], [58, 157]] : split ?
    [[143, 130], [161, 156], [121, 130], [92, 156]] : [[130, 131], [113, 157], [124, 130], [105, 157]];
  const start: Setup = {
    body: rings ? [[173, 111], [155, 118], hip] : [[175, 46], [160, 59], hip],
    legs,
  };
  const lower: Setup = {
    body: rings ? [[178, 135], [159, 140], [112, 142]]
      : deeper ? [[195, 65], [179, 79], [151, 113]] : [[190, 60], [175, 74], [149, 111]],
    legs,
  };
  const close: Arms = rings ? [[164, 132], [176, 152], [149, 132], [155, 151]]
    : [[182, 73], [205, 80], [174, 78], [197, 84]];
  const open: Arms = rings ? [[186, 144], [209, 153], [137, 145], [111, 154]]
    : [[202, 74], [226, 78], [154, 83], [127, 87]];
  const anchorY = rings ? 28 : 34;
  const support: Props = rings ? [[98, 24, 229, 24]] : [[83, 22, 83, 155], [80, 24, 137, 25], [72, 156, 98, 156]];
  const cords: Attachments = [
    ["line", 4, rings ? 217 : 128, anchorY], ["line", 6, rings ? 108 : 112, anchorY],
    [rings ? "ring" : "pad", 4, 0, 0], [rings ? "ring" : "pad", 6, 0, 0],
  ];
  return clip([frame(start, close), frame(lower, open)], support, cords, 1100);
}

function rearSuspension(lunge: boolean): Illustration {
  const start: Setup = {
    body: [[117, 63], [128, 78], [145, 112]],
    legs: [[155, 134], [172, 155], [148, 137], [163, 157]],
  };
  const close: Arms = [[158, 75], [185, 74], [152, 78], [178, 77]];
  const open: Arms = [[184, 61], [208, 63], [142, 64], [114, 72]];
  const rear: Setup = { ...start, body: [[158, 44], [160, 62], [160, 108]], legs: [[169, 133], [172, 155], [158, 133], [163, 157]] };
  const right: Setup = { ...rear, body: [[160, 63], [162, 78], [162, 118]], legs: [[191, 124], [194, 156], [137, 146], [116, 155]] };
  const left: Setup = { ...right, legs: [right.legs[2], right.legs[3], right.legs[0], right.legs[1]] };
  const handsWide: Arms = open.map((p) => add(p, 2, 16)) as Arms;
  const ropes: Attachments = [["line", 4, 238, 30], ["line", 6, 221, 30], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
  return clip(lunge ? [frame(start, close), frame(right, handsWide), frame(start, close), frame(left, handsWide)]
    : [frame(start, close), frame(rear, open)], [[241, 22, 241, 158], [218, 26, 241, 22]], ropes, 1075);
}

function ropes(): Illustration {
  const stance: Setup = {
    body: [[126, 60], [128, 77], [122, 117]],
    legs: [[141, 133], [144, 157], [114, 132], [108, 157]],
  };
  const close: Arms = [[146, 95], [158, 107], [130, 94], [148, 105]];
  const open: Arms = [[147, 84], [167, 85], [114, 85], [94, 88]];
  const waves = (base: Point[], phase: number): Point[] => {
    const line = (wrist: Point, n: number): Point[] => [1, 2, 3, 4].map((part) => {
      const k = part / 4;
      return [wrist[0] + (251 - wrist[0]) * k,
        wrist[1] + (154 - wrist[1]) * k + Math.sin(phase + part + n) * (1 - k) * 16];
    });
    return [...base, ...line(base[4], 0), ...line(base[6], 1.8)];
  };
  const dynamic: Attachments = [["line", 4, 13], ["line", 6, 17],
    ["line", 13, 14], ["line", 14, 15], ["line", 15, 16],
    ["line", 17, 18], ["line", 18, 19], ["line", 19, 20]];
  return clip([waves(frame(stance, close), 0), waves(frame(stance, open), 2), waves(frame(stance, close), 4)],
    [[244, 157, 261, 157], [251, 146, 251, 156]], dynamic, 620);
}

function thread(): Illustration {
  const setup: Setup = {
    body: [[180, 85], [165, 96], [119, 108]],
    legs: [[122, 153], [92, 156], [111, 152], [83, 156]],
  };
  const opening: Arms = [[160, 66], [178, 79], [160, 123], [162, 154]];
  const initial: Arms = [[165, 127], [166, 155], [156, 126], [152, 156]];
  const lower: Setup = { ...setup, body: [[166, 127], [155, 131], setup.body[2]] };
  const reach: Arms = [[135, 142], [109, 153], [169, 123], [152, 156]];
  const turned: Setup = { ...setup, body: [[176, 81], [165, 90], setup.body[2]] };
  return clip([frame(setup, initial), frame(turned, opening), frame(setup, initial), frame(lower, reach)], [], [], 1160);
}

function alternateKettlebell(): Illustration {
  const demo = fly(earsAboveFloor, floorSpan, [], { side: "alternate" });
  const frames = demo.frames.map((points, index) => [...points, points[index > 1 ? 6 : 4]]);
  return { ...demo, frames, dynamic: [...(demo.dynamic ?? []), ["kettlebell", 13, 0, 10]] };
}

const noLoadRear: Span = [
  [[182, 67], [195, 77], [150, 68], [168, 76]],
  [[191, 62], [216, 65], [133, 65], [107, 67]],
];
const unilateralRear: Span = [
  [[143, 66], [121, 68], noLoadRear[0][2], noLoadRear[0][3]],
  [[191, 64], [217, 65], noLoadRear[1][2], noLoadRear[1][3]],
];
const floorDumbbells = fly(earsAboveFloor, floorSpan, dumbbells);
const crossMiddle: Span = [standingSpans.middle[0], [[155, 71], [137, 80], [149, 71], [158, 77]]];

const crossedHigh: Span = [standingSpans.high[0], [[174, 99], [151, 116], [139, 96], [162, 111]]];

function machineCrossover(): Illustration {
  const left: Point = [117, 53], right: Point = [187, 53];
  const arcs = (angle: number): Point[] => {
    const near: Point = [right[0] - 41 * Math.sin(angle), right[1] + 41 * Math.cos(angle)];
    const far: Point = [left[0] + 40 * Math.sin(angle), left[1] + 40 * Math.cos(angle)];
    const arms: Arms = [[(near[0] + 142) / 2 + 11, (near[1] + 64)/2], near,
      [(far[0] + 142) / 2 - 11, (far[1] + 64)/2], far];
    return frame(backSeat, arms);
  };
  const props: Props = [...(backSeat.props ?? []), [91,43,221,43],[106,43,106,156],[205,43,205,156],
    [95,156,116,156],[194,156,220,156],[117,43,117,53],[187,43,187,53]];
  return clip([arcs(-1.11),arcs(-.12),arcs(.97),arcs(.97),arcs(-.12)],props,
    [["line",4,...right],["line",6,...left],["pad",4,0,0],["pad",6,0,0]],800);
}

export const flyIllustrations: Readonly<Record<string, Illustration>> = {
  "8141": twinAnchor(staggered, crossedHigh, 33),
  "3344": machineCrossover(),
  "3757": twinAnchor(staggered, standingSpans.high, 36, { band: true }),
  "0908": twinAnchor(staggered, standingSpans.low, 138, { band: true }),
  "0913": twinAnchor(standing, standingSpans.middle, 64, { band: true }),
  "3375": ropes(),
  "5173": fly(standing, standingSpans.middle),
  "9867": twinAnchor(hinged, bentRear, 104, { reverse: true, grip: "palm-up" }),
  "9869": twinAnchor(hinged, bentRear, 104, { reverse: true, grip: "palm-up", side: "one" }),
  "6542": twinAnchor(onKnees, afterKneeling, 37),
  "11273": twinAnchor(flat, flatSpan, 143),
  "4122": oneSideCable(standing, unilateralRear, 57, true),
  "10095": oneSideCable(staggered, standingSpans.middle, 65),
  "4374": twinAnchor(staggered, standingSpans.low, 138, { side: "alternate" }),
  "11250": twinAnchor(staggered, standingSpans.middle, 58),
  "7416": twinAnchor(staggered, standingSpans.middle, 70),
  "6219": oneSideCable(staggered, crossMiddle, 70),

  "1450": fly(flat, flatSpan, dumbbells, { hold: true }),
  "4149": floorDumbbells,
  "3175": fly(kneesUp, flatSpan, dumbbells),
  "1449": fly(inclineThirty, upperIncline, dumbbells, { hold: true }),
  "6162": fly(inclineLow, lowIncline, dumbbells),
  "3911": fly(flat, [
    [[156, 90], [146, 69], [135, 89], [140, 69]],
    [[168, 122], [192, 118], [114, 119], [91, 112]],
  ], dumbbells),
  "3334": fly(earsAboveFloor, floorSpan, [["dumbbell", 4, 0, 0]], { side: "one" }),
  "4150": fly(staggered, standingSpans.low, [["dumbbell", 4, 0, 0]], { side: "one" }),
  "4239": fly(supportedHinge, flatRear, [["dumbbell", 4, 0, 0]], { side: "one" }),
  "5098": fly(flat, flatSpan, dumbbells, { side: "alternate" }),
  "4342": rotatingFly(),
  "3924": towelFloor(),
  "4200": chainsFly(),
  "5858": fly(earsAboveFloor, floorSpan, kettlebells),
  "6820": fly(inclineThirty, upperIncline, kettlebells),
  "11284": alternateKettlebell(),
  "5079": floorDumbbells,

  "7895": thread(),
  "3923": landmineFly(),
  "11718": pecDeck(chestSeat, seatRear, "plate"),
  "5843": pecDeck(backSeat, standingSpans.middle.map((arms) => arms.map((p) => add(p, -12, -5)) as Arms) as Span, "stack"),
  "8990": pecDeck(sideSeat, seatRear, "stack", true),
  "9398": pecDeck(standing, standingSpans.middle, "stack"),
  "3744": fly(standing, noLoadRear, [["line", 4, 6]]),
  "4922": forwardSuspension("rings"),
  "1074": forwardSuspension("handles"),
  "4094": rearSuspension(true),
  "1130": rearSuspension(false),
  "1139": forwardSuspension("split"),
  "5737": forwardSuspension("lean"),
};
