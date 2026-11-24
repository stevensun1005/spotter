import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Torso = [Point, Point, Point];

function pose(body: Torso, arms: [Pair, Pair], legs: [Pair, Pair]): Point[] {
  return [...body, ...arms[0], ...arms[1], ...legs[0], ...legs[1]];
}

function loop(frames: Point[][], props?: Props, dynamic?: Attachments): Illustration {
  return { frames, props, dynamic, ms: 780, reference: true };
}

const level = { body: [[74, 104], [91, 107], [146, 115]], deck: [59, 123, 188, 123] } satisfies { body: Torso; deck: Props[number] };
const incline = { body: [[75, 58], [88, 73], [142, 116]], deck: [64, 65, 139, 126] } satisfies typeof level;
const decline = { body: [[68, 122], [85, 121], [143, 105]], deck: [61, 135, 143, 118] } satisfies typeof level;
const normalFeet: [Pair, Pair] = [[[185, 123], [189, 156]], [[173, 123], [176, 156]]];
const weights: Attachments = [["bar", 4, 6], ["plate", 4, -4], ["plate", 6, 4]];

function benchPress(layout: typeof level, equipment: "barbell" | "cable" | "dumbbell", variant: "normal" | "pause" | "reverse" | "feet-up" | "feet-on-bench" | "squeeze") {
  const [head, shoulder, hip] = layout.body;
  const legs: [Pair, Pair] = variant === "feet-up" ? [[[149, 79], [187, 84]], [[139, 81], [177, 86]]]
    : variant === "feet-on-bench" ? [[[170, 83], [184, 119]], [[159, 85], [177, 119]]]
    : layout === decline ? [[[179, 107], [178, 138]], [[168, 107], [167, 138]]]
    : normalFeet;
  const bench: Props = [layout.deck, [72, layout === incline ? 71 : 132, 72, 158], [147, layout.deck[3], 188, layout.deck[3]], [176, layout.deck[3], 176, 158]];
  if (layout === decline) bench.push([171, 113, 190, 113]);
  const [x, y] = shoulder;
  const pitch = layout === incline ? 16 : layout === decline ? -8 : 0;
  const wide = variant === "squeeze" ? 8 : equipment === "barbell" ? 34 : 46;
  const forearms = (top: boolean): [Pair, Pair] => top
    ? [[[x + 12 + pitch, y - 30], [x + 12 + pitch, y - 58]], [[x + wide + pitch, y - 27], [x + wide + pitch, y - 55]]]
    : [[[x - 3, y + 17], [x + (variant === "reverse" ? 24 : 16), y - 10]], [[x + (variant === "squeeze" ? 15 : 37), y + 16], [x + (variant === "squeeze" ? 25 : wide + 13), y - 8]]];
  const top = pose([head, shoulder, hip], forearms(true), legs);
  const bottom = pose([head, shoulder, hip], forearms(false), legs);
  if (equipment === "cable") bench.push([36, 42, 36, 145], [30, 145, 44, 145], [243, 42, 243, 145], [235, 145, 251, 145]);
  const loads: Attachments = equipment === "barbell" ? weights : equipment === "cable"
    ? [["cable", 4, 36, 145], ["cable", 6, 243, 145]]
    : [["dumbbell", 4, 0, -3], ["dumbbell", 6, 0, -3]];
  return loop(variant === "pause" ? [top, bottom, bottom, bottom] : [top, bottom], bench, loads);
}

const tower = (x: number): Props => [[x, 20, x, 157], [x - 12, 157, x + 12, 157]];
const standing: Torso = [[147, 44], [151, 61], [143, 105]];
const standingLegs: [Pair, Pair] = [[[145, 130], [149, 156]], [[129, 130], [123, 156]]];
type Handle = "single" | "rope" | "ez" | "v";

function pushdown(handle: Handle, sides: 1 | 2, sideFacing = false) {
  const shoulder: Point = sideFacing ? [145, 61] : standing[1];
  const elbows: [Point, Point] = [[151, 91], [139, 90]];
  const lower: Pair = [[154, 121], [143, 120]];
  const upper: Pair = [[177, 75], [168, 75]];
  const free: Pair = [[137, 90], [135, 119]];
  const make = (hands: Pair) => pose([standing[0], shoulder, standing[2]], [[elbows[0], hands[0]], sides === 2 ? [elbows[1], hands[1]] : free], standingLegs);
  const load: Attachments = sides === 2
    ? [["cable", 4, 232, 25], ["cable", 6, 232, 25], [handle === "rope" ? "line" : "bar", 4, 6]]
    : [["cable", 4, 232, 25]];
  if (handle === "v") load.push(["line", 4, -5, -7], ["line", 6, 5, -7]);
  if (handle === "ez") load.push(["line", 4, -5, -4], ["line", 6, 5, -4]);
  return loop([make(upper), make(lower)], tower(232), load);
}

function overhead(pulley: "high" | "low", sides: 1 | 2, kneeling = false) {
  const body: Torso = kneeling ? [[166, 63], [164, 81], [149, 122]] : standing;
  const neck = body[1];
  const [x, y] = neck;
  const legs: [Pair, Pair] = kneeling ? [[[165, 153], [121, 155]], [[154, 154], [106, 155]]]
    : [[[152, 129], [170, 156]], [[127, 130], [116, 156]]];
  const elbow: Point = [x + 12, y - 24];
  const farElbow: Point = [x + 3, y - 21];
  const make = (extend: boolean) => pose(body, [[elbow, extend ? [x + 29, y - 43] : [x - 11, y - 33]],
    sides === 2 ? [farElbow, extend ? [x + 21, y - 40] : [x - 17, y - 29]] : [[x - 9, y + 22], [x - 8, y + 49]]], legs);
  const anchor = pulley === "high" ? 24 : 144;
  const loads: Attachments = [["cable", 4, 81, anchor]];
  if (sides === 2) loads.push(["cable", 6, 81, anchor], ["bar", 4, 6]);
  return loop([make(false), make(true)], tower(81), loads);
}

function lyingExtension(rope: boolean, closerToHead = false) {
  const height = closerToHead ? 57 : 66;
  const elbows: Pair = [[98, height], [109, height + 4]];
  const make = (extend: boolean) => pose(level.body, [[elbows[0], extend ? [100, height - 25] : [75, height + 5]],
    [elbows[1], extend ? [113, height - 20] : [85, height + 8]]], normalFeet);
  return loop([make(false), make(true)], [...tower(34), level.deck, [74, 123, 74, 158], [169, 123, 169, 158]],
    [["cable", 4, 34, 145], ["cable", 6, 34, 145], [rope ? "line" : "bar", 4, 6]]);
}

function kickback(sides: 1 | 2) {
  const body: Torso = [[123, 66], [134, 80], [177, 110]];
  const legs: [Pair, Pair] = [[[164, 128], [167, 156]], [[185, 128], [191, 156]]];
  const make = (extend: boolean) => pose(body, [[[160, 94], extend ? [187, 107] : [153, 119]], sides === 2
    ? [[169, 94], extend ? [195, 105] : [163, 116]] : [[123, 106], [118, 124]]], legs);
  const loads: Attachments = [["cable", 4, 71, 145]];
  if (sides === 2) loads.push(["cable", 6, 71, 145]);
  return loop([make(false), make(true)], tower(71), loads);
}

function deadlift(equipment: "barbell" | "dumbbell", variant: "normal" | "pause" | "stiff") {
  const top = pose(standing, [[[158, 85], [156, 113]], [[146, 85], [144, 113]]], standingLegs);
  const stiff = variant === "stiff";
  const bottom = pose([[191, 76], [176, 87], [129, stiff ? 87 : 111]],
    [[[171, 113], [167, stiff ? 135 : 148]], [[161, 115], [155, stiff ? 135 : 148]]],
    [[[145, stiff ? 122 : 131], [151, 156]], [[131, stiff ? 122 : 132], [144, 156]]]);
  const offFloor = bottom.map(([x, y], i): Point => [x, [0, 1, 2, 3, 4, 5, 6].includes(i) ? y - 8 : y]);
  return loop(variant === "pause" ? [bottom, offFloor, offFloor, top, bottom] : [bottom, top], undefined,
    equipment === "barbell" ? weights : [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]]);
}

function squat(load: "back" | "front" | "goblet" | "sides" | "mini-band", pause = false, box = false) {
  const make = (body: Torso, legs: [Pair, Pair]) => {
    const [x, y] = body[1];
    const arms: [Pair, Pair] = load === "back" ? [[[x + 4, y + 24], [x - 9, y - 4]], [[x - 12, y + 18], [x - 22, y - 3]]]
      : load === "front" ? [[[x + 26, y + 16], [x + 6, y - 6]], [[x + 18, y + 17], [x - 4, y - 7]]]
      : load === "goblet" ? [[[x + 15, y + 25], [x + 22, y + 10]], [[x + 6, y + 25], [x + 17, y + 11]]]
      : load === "mini-band" ? [[[x + 9, y + 24], [x + 21, y + 8]], [[x - 1, y + 23], [x + 17, y + 7]]]
      : [[[x + 1, y + 25], [x - 5, y + 57]], [[x - 9, y + 24], [x - 19, y + 53]]];
    return pose(body, arms, legs);
  };
  const top = make(standing, standingLegs);
  const bottom = make([[145, 70], [137, 84], [111, 126]], [[[154, 123], [149, 156]], [[140, 123], [136, 156]]]);
  const props: Props = box ? [[74, 132, 111, 132], [74, 132, 74, 158], [111, 132, 111, 158]] : [];
  const attach: Attachments = load === "back" ? weights : load === "goblet" ? [["dumbbell", 4, 0, -4]]
    : load === "mini-band" ? [["knee-band", 7, 9]]
    : [["dumbbell", 4, 0, -4], ["dumbbell", 6, 0, -4]];
  return loop(pause ? [top, bottom, bottom, bottom] : [top, bottom], props, attach);
}

const kneePushup = loop([
  pose([[183, 79], [168, 87], [124, 113]], [[[180, 115], [173, 156]], [[166, 117], [159, 156]]], [[[92, 152], [69, 148]], [[80, 151], [57, 147]]]),
  pose([[186, 124], [173, 129], [126, 135]], [[[150, 133], [173, 156]], [[138, 134], [159, 156]]], [[[92, 152], [69, 148]], [[80, 151], [57, 147]]]),
]);

const kneelingFacingHighPulley = loop([
  pose([[154, 62], [153, 80], [132, 119]], [[[165, 54], [178, 73]], [[154, 54], [168, 69]]], [[[164, 153], [124, 155]], [[150, 153], [110, 155]]]),
  pose([[154, 62], [153, 80], [132, 119]], [[[165, 54], [176, 28]], [[154, 54], [156, 27]]], [[[164, 153], [124, 155]], [[150, 153], [110, 155]]]),
], tower(243), [["cable", 4, 243, 25], ["cable", 6, 243, 25]]);

const verticalPallof = loop([
  pose(standing, [[[166, 95], [175, 77]], [[140, 87], [167, 76]]], standingLegs),
  pose(standing, [[[168, 38], [174, 14]], [[157, 39], [166, 13]]], standingLegs),
], tower(84), [["band", 4, 84, 77], ["band", 6, 84, 77]]);
const kneelingPulldownBody: Torso = [[156, 61], [154, 81], [145, 121]];
const kneelingPulldownLegs: [Pair, Pair] = [[[153, 153], [116, 155]], [[143, 153], [105, 155]]];
const kneelingLatPulldown = loop([
  pose(kneelingPulldownBody, [[[168, 56], [182, 29]], [[157, 56], [170, 29]]], kneelingPulldownLegs),
  pose(kneelingPulldownBody, [[[162, 109], [183, 87]], [[152, 109], [171, 87]]], kneelingPulldownLegs),
], tower(239), [["cable", 4, 239, 24], ["bar", 4, 6]]);
const bandSquat = squat("mini-band");

const rollerBodySaw = loop([
  pose([[198, 101], [184, 111], [126, 126]], [[[184, 143], [207, 140]], [[177, 144], [200, 141]]], [[[98, 140], [64, 156]], [[84, 139], [60, 156]]]),
  pose([[214, 102], [200, 113], [144, 124]], [[[196, 143], [222, 140]], [[189, 144], [215, 141]]], [[[111, 139], [64, 156]], [[104, 139], [60, 156]]]),
], undefined, [["ball", 4, -8, 11]]);

const rockingFrog = loop([
  pose([[183, 57], [170, 73], [128, 106]], [[[182, 114], [181, 156]], [[165, 114], [160, 156]]], [[[110, 151], [71, 154]], [[132, 153], [86, 156]]]),
  pose([[162, 84], [146, 94], [101, 118]], [[[160, 127], [181, 156]], [[147, 128], [160, 156]]], [[[110, 151], [71, 154]], [[132, 153], [86, 156]]]),
]);

const reversePlankBody: Torso = [[86, 65], [101, 83], [149, 113]];
const reversePlankArms: [Pair, Pair] = [[[102, 119], [99, 156]], [[89, 119], [86, 156]]];
const reversePlankLegs: [Pair, Pair] = [[[184, 133], [220, 155]], [[178, 136], [211, 157]]];
const reversePlank = pose(reversePlankBody, reversePlankArms, reversePlankLegs);
const reversePlankWithLegLift = loop([
  reversePlank,
  pose(reversePlankBody, reversePlankArms, [[[163, 76], [178, 41]], reversePlankLegs[1]]),
  reversePlank,
  pose(reversePlankBody, reversePlankArms, [reversePlankLegs[0], [[159, 77], [171, 44]]]),
]);
// Original side-view movement demonstrations, keyed by the exact catalogue entry.
export const catalogueIllustrations: Readonly<Record<string, Illustration>> = {
  "0176": kneelingFacingHighPulley,
  "0784": bandSquat,
  "1004": bandSquat,
  "2204": rollerBodySaw,
  "2571": rockingFrog,
  "3663": reversePlankWithLegLift,
  "1015": verticalPallof,
  "1173": benchPress(incline, "barbell", "reverse"),
  "3174": benchPress(level, "barbell", "feet-up"),
  "3681": benchPress(level, "dumbbell", "squeeze"),
  "4836": benchPress(level, "dumbbell", "squeeze"),
  "5010": benchPress(decline, "barbell", "pause"),
  "5011": benchPress(incline, "barbell", "pause"),
  "5013": benchPress(level, "barbell", "pause"),
  "5091": benchPress(level, "barbell", "reverse"),
  "6584": benchPress(level, "barbell", "feet-on-bench"),
  "11253": kneelingLatPulldown,
  "11256": benchPress(level, "cable", "normal"),
  "11264": benchPress(incline, "cable", "normal"),
  "0187": lyingExtension(false),
  "1227": pushdown("single", 1),
  "1605": pushdown("ez", 2),
  "1606": pushdown("ez", 2),
  "1609": pushdown("single", 1, true),
  "1859": overhead("high", 2, true),
  "4353": lyingExtension(true),
  "4355": pushdown("v", 2),
  "4545": kickback(1),
  "4566": kickback(1),
  "4567": kickback(1),
  "4578": kickback(2),
  "4958": overhead("low", 1),
  "4960": pushdown("rope", 2),
  "5033": pushdown("single", 1),
  "5243": lyingExtension(false, true),
  "5874": overhead("high", 2),
  "11279": overhead("low", 1),
  "11436": overhead("low", 2),
  "1182": kneePushup,
  "1543": deadlift("barbell", "stiff"),
  "1555": squat("sides"),
  "2966": squat("front"),
  "3308": deadlift("barbell", "normal"),
  "4362": squat("back", true),
  "3692": squat("goblet", false, true),
  "4816": squat("goblet", true),
  "4914": deadlift("dumbbell", "stiff"),
  "4962": squat("back", true, true),
  "5014": deadlift("barbell", "pause"),
  "5017": squat("back", true),
  "5119": deadlift("dumbbell", "stiff"),
};
