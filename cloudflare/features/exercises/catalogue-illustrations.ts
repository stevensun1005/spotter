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

function benchPress(layout: typeof level, equipment: "barbell" | "cable" | "dumbbell",
  variant: "normal" | "pause" | "reverse" | "wide-reverse" | "feet-up" | "feet-on-bench" | "squeeze" | "reverse-squeeze") {
  const [head, shoulder, hip] = layout.body;
  const legs: [Pair, Pair] = variant === "feet-up" ? [[[149, 79], [187, 84]], [[139, 81], [177, 86]]]
    : variant === "feet-on-bench" ? [[[170, 83], [184, 119]], [[159, 85], [177, 119]]]
    : layout === decline ? [[[179, 107], [178, 138]], [[168, 107], [167, 138]]]
    : normalFeet;
  const bench: Props = [layout.deck, [72, layout === incline ? 71 : 132, 72, 158], [147, layout.deck[3], 188, layout.deck[3]], [176, layout.deck[3], 176, 158]];
  if (layout === decline) bench.push([171, 113, 190, 113]);
  const [x, y] = shoulder;
  const pitch = layout === incline ? 16 : layout === decline ? -8 : 0;
  const squeezed = variant === "squeeze" || variant === "reverse-squeeze";
  const reversed = variant === "reverse" || variant === "wide-reverse" || variant === "reverse-squeeze";
  const wide = squeezed ? 26 : variant === "wide-reverse" ? 55 : equipment === "barbell" ? 34 : 46;
  const forearms = (top: boolean): [Pair, Pair] => top
    ? [[[x + 12 + pitch, y - 30], [x + 12 + pitch, y - 58]], [[x + wide + pitch, y - 27], [x + wide + pitch, y - (squeezed ? 58 : 55)]]]
    : [[[x - 3, y + 17], [x + (reversed && !squeezed ? 24 : 16), y - 10]],
      [[x + (squeezed ? 16 : variant === "wide-reverse" ? 57 : 37), y + 16],
        [x + (squeezed ? 30 : wide + 13), y - (squeezed ? 10 : 8)]]];
  const top = pose([head, shoulder, hip], forearms(true), legs);
  const bottom = pose([head, shoulder, hip], forearms(false), legs);
  if (equipment === "cable") bench.push([36, 42, 36, 145], [30, 145, 44, 145], [243, 42, 243, 145], [235, 145, 251, 145]);
  const loads: Attachments = equipment === "barbell" ? [...weights] : equipment === "cable"
    ? [["cable", 4, 36, 145], ["cable", 6, 243, 145]]
    : [["dumbbell", 4, 0, -3], ["dumbbell", 6, 0, -3]];
  const poses = variant === "pause" ? [top, bottom, bottom, bottom] : [top, bottom];
  if (reversed) loads.push(["palm-up", 4, 11], ["palm-up", 6, 12]);
  return loop(reversed ? poses.map(frame => [...frame, [frame[4][0] + 6, frame[4][1] + 3],
    [frame[6][0] - 6, frame[6][1] + 3]]) : poses, bench, loads);
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
  const attach: Attachments = load === "back" || load === "front" ? weights : load === "goblet" ? [["dumbbell", 4, 0, -4]]
    : load === "mini-band" ? [["knee-band", 7, 9]]
    : [["dumbbell", 4, 0, -4], ["dumbbell", 6, 0, -4]];
  return loop(pause ? [top, bottom, bottom, bottom] : [top, bottom], props, attach);
}

const kneePushup = loop([
  pose([[183, 79], [168, 87], [124, 113]], [[[180, 115], [173, 156]], [[166, 117], [159, 156]]], [[[92, 152], [69, 148]], [[80, 151], [57, 147]]]),
  pose([[186, 124], [173, 129], [126, 135]], [[[150, 133], [173, 156]], [[138, 134], [159, 156]]], [[[92, 152], [69, 148]], [[80, 151], [57, 147]]]),
]);

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
type BridgeSupport = "floor" | "bench" | "feet-bench" | "ball" | "smith" | "lever" | "lever-step";
type BridgeStance = "parallel" | "bent-single" | "straight-single" | "chest-single" | "staggered" | "straight" | "frog" | "crossed";
type BridgeWeight = "none" | "barbell" | "dumbbell" | "two-dumbbells" | "bottle" | "weighted" | "belt" | "landmine";

function bridge(support: BridgeSupport, stance: BridgeStance, weight: BridgeWeight, band?: "knees" | "hips", range: "full" | "short" | "hold" = "full", armsAtChest = false) {
  const upperOnBench = support === "bench" || support === "smith" || support === "lever" || support === "lever-step";
  const x = 144;
  const back = upperOnBench ? 100 : 147;
  const hipAtTop = upperOnBench ? 105 : support === "feet-bench" ? 114 : 123;
  const footY = support === "feet-bench" || support === "lever-step" ? 111 : support === "ball" ? 128 : 157;
  const pressedFeet: [Pair, Pair] = stance === "frog" ? [[[184, 129], [206, footY]], [[192, 132], [210, footY]]]
    : [[[184, footY - 35], [200, footY]], [[172, footY - 33], [stance === "staggered" ? 215 : 191, footY]]];
  const make = (lift: number) => {
    const low = upperOnBench ? 138 : 149;
    const hipY = low + (hipAtTop - low) * lift;
    const neck: Point = [98, back + (upperOnBench ? 2 - lift * 5 : 0)];
    const hip: Point = [x, hipY];
    const legs: [Pair, Pair] = [pressedFeet[0], pressedFeet[1]];
    if (stance === "bent-single") legs[1] = [[178, hipY - 27], [208, hipY - 21]];
    if (stance === "straight-single") legs[1] = [[166, hipY - 24], [183, hipY - 46]];
    if (stance === "chest-single") legs[1] = [[134, hipY - 30], [167, hipY - 24]];
    if (stance === "straight") {
      legs[0] = [[176, (hipY + footY) / 2], [208, footY]];
      legs[1] = [[171, (hipY + footY) / 2 + 2], [202, footY]];
    }
    if (stance === "crossed") legs[1] = [[165, hipY - 36], [181, pressedFeet[0][0][1] - 3]];
    const arms: [Pair, Pair] = weight !== "none" || band === "hips"
      ? [[[117, back + 10], [143, hipY - 8]], [[110, back + 9], [141, hipY - 7]]]
      : armsAtChest ? [[[112, back - 10], [103, back - 22]], [[120, back - 8], [109, back - 19]]]
      : [[[111, back + 8], [138, back + 11]], [[106, back + 7], [131, back + 10]]];
    return pose([[80, back - 6], neck, hip], arms, legs);
  };
  const props: Props = upperOnBench ? [[68, 109, 110, 109], [73, 110, 73, 158], [105, 110, 105, 158]] : [];
  if (support === "feet-bench" || support === "lever-step") props.push([177, 116, 234, 116], [183, 116, 183, 158], [228, 116, 228, 158]);
  if (support === "smith") props.push(...tower(131), ...tower(163), [131, 20, 163, 20]);
  if (support === "lever" || support === "lever-step") props.push([219, 53, 219, 159], [120, 157, 238, 157], [215, 91, 223, 91]);
  const attachments: Attachments = [];
  if (weight === "barbell") attachments.push(["barbell-end", 2, 0, -7]);
  if (weight === "landmine") attachments.push(["bar", 2, 236, 157], ["plate", 2, 0, -6]);
  if (weight === "belt") attachments.push(["line", 2, 219, 93], ["pad", 2, 0, -7]);
  if (weight === "dumbbell") attachments.push(["dumbbell", 2, 0, -7]);
  if (weight === "two-dumbbells") attachments.push(["dumbbell", 2, -7, -8], ["dumbbell", 2, 8, -4]);
  if (weight === "bottle") attachments.push(["bottle", 2, 0, -7]);
  if (weight === "weighted") attachments.push(["weight", 2, 0, -7]);
  if (band === "knees") attachments.push(["knee-band", 7, 9]);
  if (band === "hips") attachments.push(["band", 2, 126, 156], ["band", 2, 170, 156]);
  if (support === "ball") attachments.push(["stability-ball", 8, 0, 16]);
  const top = make(1);
  const bottom = make(range === "short" ? .58 : 0);
  return loop(range === "hold" ? [bottom, top, top, top, top] : [bottom, top], props, attachments);
}

type CalfSupport = "none" | "rail" | "chair" | "suspension";
type CalfLoad = "none" | "dumbbell" | "dumbbells" | "kettlebell" | "barbell" | "smith" | "band" | "weighted" | "lever";
function calfRaise({
  support = "none", load = "none", step = false, legs = "both", posture = "standing", cadence = "rep",
}: {
  support?: CalfSupport; load?: CalfLoad; step?: boolean; legs?: "both" | "one" | "alternating" | "split";
  posture?: "standing" | "soft-knee" | "half-squat" | "seated"; cadence?: "rep" | "pulse" | "hold";
} = {}) {
  const seated = posture === "seated";
  const startHip = seated ? 113 : posture === "half-squat" ? 121 : posture === "soft-knee" ? 107 : 101;
  const forefoot = step ? 143 : 157;
  const toes: Pair = [[178, forefoot], [legs === "split" ? 129 : 163, legs === "split" ? 157 : forefoot]];
  const holding = support !== "none" && support !== "suspension";
  const handY = support === "chair" ? 95 : 84;
  const make = (near: number, far: number) => {
    const lift = Math.max(near, far);
    const rise = lift * (seated ? 0 : 9) + (step && !seated ? 5 : 0);
    const hipY = startHip - rise;
    const shoulderY = hipY - 40;
    const ankle = (index: 0 | 1, height: number): Point => [toes[index][0] - 12 + height * 4, toes[index][1] - 2 - height * 11 + (step ? 5 : 0)];
    const knee = (index: 0 | 1, height: number): Point => [toes[index][0] - (seated ? 10 : 14), seated ? 112 - height * 5 : hipY + 29];
    const supportingArm: Pair = [[176, shoulderY + 22], [211, handY]];
    const relaxedArm: Pair = [[151, shoulderY + 24], [149, shoulderY + 52]];
    const offsetArm: Pair = [[143, shoulderY + 24], [140, shoulderY + 49]];
    const arms: [Pair, Pair] = load === "barbell" || (load === "smith" && !seated)
      ? [[[160, shoulderY + 19], [151, shoulderY - 5]], [[142, shoulderY + 16], [135, shoulderY - 3]]]
      : [holding || support === "suspension" ? supportingArm : relaxedArm,
        holding && load !== "dumbbell" ? [[165, shoulderY + 23], [209, handY + 2]] : offsetArm];
    if (seated) {
      arms[0] = [[144, shoulderY + 24], [164, 105]];
      arms[1] = [[140, shoulderY + 22], [153, 103]];
    }
    return pose([[145, shoulderY - 17], [146, shoulderY], [seated ? 122 : posture === "half-squat" ? 134 : 152, hipY]],
      arms, [[knee(0, near), ankle(0, near)], legs === "one"
        ? [[141, hipY + 26], [119, hipY + 33]] : [knee(1, far), ankle(1, far)]]);
  };
  const props: Props = [];
  if (support === "rail") props.push([211, 83, 211, 157], [198, 84, 229, 84]);
  if (support === "chair") props.push([211, 92, 211, 157], [211, 126, 240, 126], [240, 126, 240, 157]);
  if (support === "suspension") props.push([245, 26, 260, 26], [252, 25, 252, 14]);
  if (step) props.push([144, 146, 215, 146], [145, 146, 145, 158], [214, 146, 214, 158]);
  if (seated) props.push([99, 122, 160, 122], [99, 122, 99, 158], [150, 122, 150, 158]);
  if (load === "smith") props.push(...tower(115), ...tower(191), [115, 20, 191, 20]);
  if (load === "lever") props.push([218, 51, 218, 158], [104, 159, 236, 159], [210, 83, 234, 83]);
  const attachments: Attachments = [["foot", 8, ...toes[0]]];
  if (legs !== "one") attachments.push(["foot", 10, ...toes[1]]);
  if (support === "suspension") attachments.push(["line", 4, 252, 26], ["line", 6, 252, 26]);
  if (load === "kettlebell") attachments.push(["kettlebell", 4, 1, 8]);
  if (load === "dumbbell") attachments.push(["dumbbell", holding ? 6 : 4, 0, 1]);
  if (load === "dumbbells") attachments.push(["dumbbell", 4, 0, 1], ["dumbbell", 6, 0, 1]);
  if (load === "barbell" || load === "smith") {
    if (seated) attachments.push(["barbell-end", 7, -10, -6]);
    else attachments.push(...weights);
  }
  if (load === "band") attachments.push(["band", 4, 178, forefoot], ["band", 6, 163, forefoot]);
  if (load === "weighted") attachments.push(["pad", 7, -12, -6]);
  if (load === "lever") attachments.push(["line", 7, 218, 83], ["pad", 7, -9, -5]);
  const bottom = make(cadence === "pulse" ? .68 : 0, cadence === "pulse" ? .68 : 0);
  const top = make(1, legs === "alternating" || legs === "split" ? 0 : 1);
  if (legs === "alternating") return loop([bottom, top, bottom, make(0, 1)], props, attachments);
  return loop(cadence === "hold" ? [bottom, top, top, top, top] : [bottom, top], props, attachments);
}

function shrug(equipment: "body" | "barbell" | "smith" | "dumbbell" | "kettlebell" | "trap" | "cable", posture: "standing" | "overhead" | "back" | "seated" | "seated-reverse" | "supine", width = 26) {
  const seated = posture === "seated" || posture === "seated-reverse";
  const back = posture === "back" || posture === "seated-reverse";
  const supine = posture === "supine";
  const overhead = posture === "overhead";
  const make = (top: boolean) => {
    const rise = top ? 8 : 0;
    if (supine) return pose([[72, 107], [99 - rise, 109], [152, 113]],
      [[[127 - rise, 126], [155 - rise, 129]], [[117 - rise, 123], [145 - rise, 126]]], normalFeet);
    const shoulderY = (seated ? 72 : 61) - rise;
    const body: Torso = [[146, seated ? 53 : 43], [146, shoulderY], [145, seated ? 116 : 106]];
    const lowArm = (x: number, offset: number): Pair => [[x, shoulderY + 24], [x + offset, shoulderY + 51]];
    const longArm = (side: number): Pair => [[146 + side * (width / 2), shoulderY - 22], [146 + side * width, shoulderY - 40]];
    return pose(body, overhead ? [longArm(1), longArm(-1)]
      : [lowArm(back ? 123 : 158, back ? -1 : 1), lowArm(back ? 123 - width / 2 : 158 - width, back ? -4 : 2)],
    seated ? [[[190, 117], [192, 155]], [[178, 119], [180, 155]]] : standingLegs);
  };
  const props: Props = seated ? [[119, 123, 180, 123], [121, 123, 121, 157], [177, 123, 177, 157]] : [];
  if (supine) props.push(level.deck, [72, 124, 72, 158], [169, 124, 169, 158]);
  if (equipment === "smith") props.push(...tower(119), ...tower(180), [119, 20, 180, 20]);
  const anchor = back ? 81 : 229;
  if (equipment === "cable") props.push(...tower(anchor));
  const attachments: Attachments = equipment === "barbell" || equipment === "smith" ? weights : [];
  if (equipment === "trap") attachments.push(["trap-bar", 4, 0, 0]);
  if (equipment === "dumbbell" || equipment === "kettlebell") attachments.push([equipment, 4, 0, 0], [equipment, 6, 0, 0]);
  if (equipment === "cable") attachments.push(["cable", 4, anchor, 145], ["cable", 6, anchor, 145]);
  return loop([make(false), make(true), make(true)], props, attachments);
}

function deadBug(load: "none" | "medicine-ball" | "kettlebell" | "kb-pullover" | "feet-band", straight = false) {
  const body: Torso = [[76, 142], [95, 146], [149, 146]];
  const startArms: [Pair, Pair] = [[[93, 119], [95, 92]], [[104, 119], [106, 92]]];
  const nearLeg: Pair = straight ? [[151, 114], [150, 77]] : [[153, 108], [186, 106]];
  const farLeg: Pair = straight ? [[159, 116], [160, 80]] : [[161, 115], [194, 114]];
  const reachArms: [Pair, Pair] = [[[68, 136], [44, 146]], [[75, 135], [49, 146]]];
  const straightNear: Pair = [[186, 136], [221, 141]];
  const straightFar: Pair = [[185, 140], [220, 145]];
  const make = (side: "center" | "near" | "far") => {
    let arms = startArms;
    if (side !== "center") {
      if (load === "medicine-ball" || load === "kb-pullover") arms = reachArms;
      if (load === "none") arms = side === "near" ? [startArms[0], reachArms[1]] : [reachArms[0], startArms[1]];
    }
    return pose(body, arms, [side === "near" ? straightNear : nearLeg, side === "far" ? straightFar : farLeg]);
  };
  const attachments: Attachments = load === "feet-band" ? [["band", 8, 10]] : load === "medicine-ball" ? [["ball", 4, 4, 0]]
    : load === "kettlebell" || load === "kb-pullover" ? [["kettlebell", 4, 4, -2]] : [];
  return loop([make("center"), make("near"), make("center"), make("far")], undefined, attachments);
}

function birdDog(stance: "all-fours" | "high-plank", resistance: "none" | "band" | "slider" = "none") {
  const plank = stance === "high-plank";
  const body: Torso = plank ? [[218, 83], [200, 89], [143, 110]] : [[210, 74], [192, 85], [138, 96]];
  const nearArm: Pair = [[197, 123], [198, 156]];
  const farArm: Pair = [[188, 124], [188, 156]];
  const nearLeg: Pair = plank ? [[109, 132], [77, 156]] : [[135, 147], [102, 152]];
  const farLeg: Pair = plank ? [[99, 135], [68, 156]] : [[124, 145], [92, 152]];
  const arms: [Pair, Pair] = [[[222, 83], [251, 83]], [[215, 88], [241, 88]]];
  const extended: [Pair, Pair] = resistance === "slider" ? [[[103, 121], [78, 155]], [[101, 124], [73, 155]]]
    : [[[109, 101], [72, 107]], [[106, 107], [74, 111]]];
  const baseline = pose(body, [nearArm, farArm], [nearLeg, farLeg]);
  const first = pose(body, [nearArm, arms[1]], [extended[0], farLeg]);
  const other = pose(body, [arms[0], farArm], [nearLeg, extended[1]]);
  const attachments: Attachments = resistance === "band" ? [["band", 6, 8]] : resistance === "slider" ? [["slider", 8, 0, 4]] : [];
  return loop(resistance === "none" ? [baseline, first, baseline, other] : [baseline, first], undefined, attachments);
}

type KneeResistance = "machine" | "plate-machine" | "cable" | "band" | "dumbbell" | "ball";

function seatedKnee(action: "extension" | "curl", load: KneeResistance, side: "both" | "single" | "alternating") {
  const extending = action === "extension";
  const machine = load === "machine" || load === "plate-machine";
  const chair = load === "cable" || load === "band" || machine;
  const body: Torso = [[127, 52], [134, 69], [139, 110]];
  const arms: [Pair, Pair] = [[[147, 96], [141, 120]], [[138, 96], [132, 119]]];
  const make = (near: boolean, far: boolean) => {
    const leg = (x: number, y: number, flexed: boolean): Pair => [[x, y], flexed ? [x - (extending ? 2 : 18), y + 34] : [x + 39, y + 3]];
    return pose(body, arms, [leg(176, 110, near), leg(167, 113, far)]);
  };
  const props: Props = [];
  if (chair) props.push([113, 118, 184, 118], [118, 118, 118, 158], [183, 118, 183, 158]);
  if (machine) props.push([125, 64, 134, 120], [175, 112, 186, 112], [184, 115, 184, 156], [105, 156, 217, 156], [210, 80, 210, 155]);
  if (load === "cable" || load === "band") {
    const x = extending ? 83 : 251;
    props.push(...(load === "cable" ? tower(x) : [[x, 141, x, 158]] as Props));
  }
  const attachments: Attachments = [];
  if (machine) {
    const moving = side === "both" || side === "alternating" ? [8, 10] : [8];
    for (const joint of moving) {
      attachments.push(["line", joint, 182, 112], ["pad", joint, 0, extending ? 4 : -5]);
      if (load === "plate-machine") attachments.push(["plate", joint, 10, extending ? 6 : -5]);
    }
  }
  if (load === "cable" || load === "band") {
    const x = extending ? 83 : 251;
    attachments.push([load, 8, x, 147]);
    if (side === "both") attachments.push([load, 10, x, 147]);
  }
  if (load === "ball") attachments.push(["stability-ball", 2, -4, 25]);
  const down = make(true, true);
  const out = make(false, false);
  if (side === "both") return loop(extending ? [down, out] : [out, down], props, attachments);
  const start = extending ? down : side === "single" ? make(false, true) : out;
  const near = extending ? make(false, true) : make(true, false);
  const far = extending ? make(true, false) : make(false, true);
  return loop(side === "alternating" ? [start, near, start, far] : [start, extending ? make(false, true) : make(true, true)], props, attachments);
}

function standingKnee(action: "extension" | "curl", load: "machine" | "cable" | "band") {
  const extending = action === "extension";
  const pivot: Point = extending ? [169, 116] : [147, 130];
  const start: Pair = [pivot, extending ? [168, 148] : [140, 157]];
  const end: Pair = [pivot, extending ? [205, 123] : [117, 113]];
  const make = (workingLeg: Pair) => pose([[147, 42], [151, 59], [149, 100]], [[[177, 83], [207, 77]], [[165, 85], [199, 79]]],
    [workingLeg, [[158, 129], [159, 155]]]);
  const anchor = extending ? 88 : 228;
  const props: Props = [[207, 77, 207, 157], [193, 77, 219, 77], [197, 157, 218, 157]];
  if (load === "cable" || load === "machine") props.push(...tower(anchor));
  if (load === "band") props.push([anchor, 132, anchor, 158]);
  const attachments: Attachments = load === "machine" ? [["line", 8, 174, 130], ["pad", 8, -5, 0]]
    : [[load, 8, anchor, 145]];
  return loop([make(start), make(end)], props, attachments);
}

function proneCurl(load: Exclude<KneeResistance, "ball">, side: "both" | "single", decline = false) {
  const floor = load === "band" || load === "cable";
  const machine = load === "machine" || load === "plate-machine";
  const body: Torso = decline ? [[86, 120], [102, 120], [148, 107]]
    : floor ? [[86, 144], [102, 147], [153, 146]] : [[86, 105], [102, 109], [153, 110]];
  const knee: Point = [186, body[2][1] + (decline ? 15 : 2)];
  const baseline: Pair = [knee, [221, knee[1] + (decline ? 7 : 3)]];
  const contracted: Pair = [knee, [163, knee[1] - 26]];
  const farStart: Pair = [[180, knee[1] + 4], [214, baseline[1][1] + 2]];
  const make = (bent: boolean) => pose(body, [[[89, body[1][1] + 10], [73, body[1][1] + 3]], [[95, body[1][1] + 9], [79, body[1][1] + 4]]],
    [bent ? contracted : baseline, side === "both" && bent ? [[180, knee[1] + 4], [158, knee[1] - 21]] : farStart]);
  const props: Props = floor ? [] : [[89, body[1][1] + 9, 181, body[2][1] + 10], [94, body[1][1] + 9, 94, 158], [174, body[2][1] + 10, 174, 158]];
  if (machine || load === "cable") props.push(...tower(244));
  if (load === "band") props.push([246, 136, 246, 157]);
  const attachment: Attachments = load === "cable" || load === "band"
    ? side === "both" ? [[load, 8, 245, 147], [load, 10, 245, 147]] : [[load, 8, 245, 147]]
    : load === "dumbbell" ? [["dumbbell", 8, -3, 2]] : [["line", 8, 194, 112], ["pad", 8, -2, -3]];
  return loop([make(false), make(true)], props, attachment);
}

function bridgeCurl(load: "ball" | "rings" | "straps" | "towel", single = false, reverse = false) {
  const heelY = load === "towel" ? 153 : 124;
  const body: Torso = [[79, 141], [97, 147], [144, 124]];
  const arms: [Pair, Pair] = [[[109, 153], [139, 155]], [[104, 153], [133, 154]]];
  const make = (bent: boolean) => {
    const kneeY = bent ? 89 : (body[2][1] + heelY) / 2 - 8;
    const first: Pair = [[bent ? 159 : 174, kneeY], [bent ? 182 : 217, heelY]];
    const second: Pair = single ? [[166, 102], [194, 88]] : [[first[0][0] - 5, kneeY + 3], [first[1][0] - 4, heelY + 2]];
    return pose(body, arms, [first, second]);
  };
  const props: Props = load === "rings" || load === "straps" ? [[202, 23, 229, 23]] : [];
  const attachments: Attachments = load === "ball" ? [["stability-ball", 8, 0, 17]] : [];
  if (load === "towel") attachments.push(["slider", 8, 1, 3], ["slider", 10, 1, 3]);
  if (load === "rings" || load === "straps") attachments.push(["line", 8, 223, 23], ["line", 10, 210, 23],
    [load === "rings" ? "ring" : "pad", 8, 1, 4], [load === "rings" ? "ring" : "pad", 10, 1, 4]);
  return loop(reverse ? [make(true), make(false)] : [make(false), make(true)], props, attachments);
}

const quadrupedKneeCurl = loop([
  pose([[207, 75], [189, 89], [137, 100]], [[[193, 122], [196, 156]], [[183, 120], [184, 156]]], [[[104, 113], [73, 124]], [[124, 148], [92, 153]]]),
  pose([[207, 75], [189, 89], [137, 100]], [[[193, 122], [196, 156]], [[183, 120], [184, 156]]], [[[104, 113], [121, 81]], [[124, 148], [92, 153]]]),
]);

type CurlSetup = "standing" | "narrow" | "inner" | "behind" | "high" | "seated" | "incline" | "incline-high" | "prone-incline"
  | "preacher" | "kneeling-preacher" | "standing-preacher" | "concentration" | "floor-concentration" | "supine";
type CurlLoad = "body" | "dumbbell" | "bottle" | "barbell" | "ez" | "band" | "cable" | "cable-rope" | "cable-ez" | "cable-short"
  | "kettlebell" | "plate" | "machine" | "plate-machine";

function curl(setup: CurlSetup, load: CurlLoad, count: "both" | "single" | "alternating", grip: "underhand" | "neutral" | "overhand" = "underhand") {
  const bin: Record<CurlSetup, { body: Torso; legs: [Pair, Pair]; elbows: Pair; props?: Props }> = {
    standing: { body: standing, legs: standingLegs, elbows: [[160, 89], [142, 89]] },
    narrow: { body: standing, legs: standingLegs, elbows: [[157, 89], [149, 90]] },
    inner: { body: standing, legs: standingLegs, elbows: [[170, 86], [133, 86]] },
    behind: { body: standing, legs: standingLegs, elbows: [[132, 88], [117, 89]] },
    high: { body: standing, legs: standingLegs, elbows: [[183, 61], [113, 61]] },
    seated: { body: [[130, 52], [133, 69], [137, 111]], legs: [[[178, 110], [182, 156]], [[166, 115], [168, 155]]], elbows: [[144, 98], [123, 98]], props: [[112, 120, 155, 120], [118, 120, 118, 158], [150, 120, 150, 158]] },
    incline: { body: [[94, 54], [109, 68], [136, 112]], legs: [[[178, 111], [183, 156]], [[164, 113], [170, 156]]], elbows: [[112, 96], [93, 96]], props: [[98, 68, 134, 120], [129, 120, 158, 120], [111, 89, 111, 158], [152, 120, 152, 158]] },
    "incline-high": { body: [[110, 47], [119, 62], [137, 114]], legs: [[[177, 112], [183, 156]], [[163, 115], [169, 156]]], elbows: [[124, 90], [101, 93]], props: [[108, 55, 134, 120], [130, 120, 156, 120], [115, 76, 115, 157], [152, 120, 152, 157]] },
    "prone-incline": { body: [[191, 44], [177, 58], [144, 110]], legs: [[[126, 128], [128, 156]], [[113, 129], [108, 156]]], elbows: [[180, 91], [170, 89]], props: [[140, 106, 185, 62], [139, 105, 139, 158], [178, 69, 178, 158]] },
    preacher: { body: [[111, 55], [121, 72], [128, 113]], legs: [[[168, 115], [165, 154]], [[152, 116], [149, 155]]], elbows: [[165, 99], [156, 98]], props: [[111, 120, 146, 120], [115, 120, 115, 156], [138, 120, 138, 157], [144, 80, 169, 104], [157, 95, 157, 156]] },
    "standing-preacher": { body: [[109, 41], [119, 56], [123, 103]], legs: standingLegs, elbows: [[162, 87], [151, 86]], props: [[139, 69, 167, 93], [154, 78, 154, 157], [137, 157, 171, 157]] },
    "kneeling-preacher": { body: [[102, 62], [113, 77], [130, 124]], legs: [[[131, 151], [92, 154]], [[118, 151], [78, 154]]], elbows: [[153, 101], [143, 103]], props: [[137, 87, 162, 109], [150, 99, 150, 157], [134, 157, 168, 157]] },
    concentration: { body: [[146, 61], [131, 75], [114, 115]], legs: [[[162, 116], [178, 155]], [[118, 120], [99, 154]]], elbows: [[151, 111], [122, 108]], props: [[99, 123, 129, 123], [103, 123, 103, 158], [126, 123, 126, 158]] },
    "floor-concentration": { body: [[148, 89], [137, 102], [119, 149]], legs: [[[164, 123], [188, 155]], [[122, 127], [106, 156]]], elbows: [[158, 124], [131, 129]] },
    supine: { body: [[85, 146], [103, 149], [152, 149]], legs: [[[187, 122], [204, 155]], [[179, 123], [195, 155]]], elbows: [[127, 152], [118, 151]] },
  };
  const { body, legs, elbows, props: baseProps } = bin[setup];
  const pad = setup.includes("preacher");
  const machine = load === "machine" || load === "plate-machine";
  const cabled = load === "cable" || load === "cable-rope" || load === "cable-ez" || load === "cable-short";
  const props: Props = [...baseProps ?? []];
  const anchor = setup.startsWith("incline") ? 63 : 246;
  const make = (right: boolean, left: boolean) => {
    const hands = (i: 0 | 1, lift: boolean): Point => {
      const [x, y] = elbows[i];
      if (setup === "high") return lift ? [x + (i ? 17 : -17), y - 15] : [x + (i ? -27 : 27), y + 2];
      if (setup === "supine") return lift ? [x - 9, y - 26] : [x + 27, y];
      if (lift) return [x + (pad ? -7 : 10), y - 27];
      return [x + (pad ? 18 : setup.includes("concentration") ? 4 : 2), y + Math.min(26, 155 - y)];
    };
    return pose(body, [[elbows[0], hands(0, right)], [elbows[1], hands(1, left)]], legs);
  };
  if (cabled) props.push(...tower(anchor));
  if (load === "band" && setup === "high") props.push(...tower(72));
  if (machine) props.push([154, 78, 154, 154], [154, 154, 203, 154], [202, 92, 202, 155]);
  const attachments: Attachments = [];
  const wrists = count === "single" ? [4] : [4, 6];
  for (const index of wrists) {
    if (load === "dumbbell") attachments.push([grip === "neutral" ? "hammer-weight" : "dumbbell", index, 0, 0]);
    if (load === "bottle") attachments.push([grip === "neutral" ? "bottle-upright" : "bottle", index, 0, 0]);
    if (load === "band") attachments.push(setup === "high" ? ["band", index, 72, 63]
      : setup === "kneeling-preacher" ? ["band", index, 173, 153] : ["band", index, index === 4 ? 149 : 123, 156]);
    if (cabled) attachments.push(["cable", index, anchor, 145]);
    if (machine) attachments.push(["line", index, 157, 100], ["pad", index, 1, 1]);
    if (load === "plate-machine") attachments.push(["plate", index, 9, 6]);
  }
  if (load === "barbell") attachments.push(...weights);
  if (load === "ez" || load === "cable-ez") attachments.push(["ez-bar", 4, 6]);
  if (load === "ez") attachments.push(["plate", 4, -4], ["plate", 6, 4]);
  if (load === "cable-short") attachments.push(["bar", 4, 6]);
  if (load === "kettlebell" || load === "plate") attachments.push([load, 4, -6, 8]);
  const start = make(false, false);
  if (count === "alternating") return loop([start, make(true, false), start, make(false, true)], props, attachments);
  return loop([start, make(true, count === "both")], props, attachments);
}

function raiseArms(direction: "front" | "lateral", load: "dumbbell" | "bottle" | "band" | "low-cable-rope", alternate = false) {
  const base: [Pair, Pair] = [[[164, 80], [168, 109]], [[136, 80], [132, 109]]];
  const lifted: [Pair, Pair] = direction === "front" ? [[[179, 67], [212, 65]], [[171, 63], [204, 60]]]
    : [[[180, 62], [211, 63]], [[119, 62], [88, 63]]];
  const make = (right: boolean, left: boolean) => pose(standing, [right ? lifted[0] : base[0], left ? lifted[1] : base[1]], standingLegs);
  const loadAttachments: Attachments = load === "band" ? [["band", 4, 148, 156], ["band", 6, 123, 156]]
    : load === "low-cable-rope" ? [["cable", 4, 77, 143], ["cable", 6, 77, 143]]
    : [[load, 4, 0, 0], [load, 6, 0, 0]];
  const start = make(false, false);
  return loop(alternate ? [start, make(true, false), start, make(false, true)] : [start, make(true, true)],
    load === "low-cable-rope" ? tower(77) : undefined, loadAttachments);
}

type PallofStance = "standing" | "split" | "kneeling" | "floor" | "bridge";
function pallof(load: "band" | "cable", stance: PallofStance, variant: "horizontal" | "vertical" | "squat-hold" | "split-hold" | "squat-then-press" | "alternating" = "horizontal") {
  const floor = stance === "floor" || stance === "bridge";
  const anchor: Point = floor ? [70, 140] : [88, stance === "kneeling" ? 86 : 70];
  const props = tower(anchor[0]);
  if (load === "cable") {
    const [x, y] = anchor;
    props.push([x - 24, 27, x - 24, 156], [x - 8, 27, x - 8, 156],
      [x - 24, 27, x, 27], [x - 24, 156, x, 156], [x - 20, 121, x - 10, 121],
      [x - 20, 130, x - 10, 130], [x - 20, 139, x - 10, 139],
      [x - 4, y, x + 4, y]);
  }
  const legsFor = (lower: boolean): [Pair, Pair] => stance === "kneeling" ? [[[184, 113], [184, 156]], [[123, 154], [94, 156]]]
    : stance === "split" ? [[[184, lower ? 129 : 124], [193, 156]], [[121, lower ? 148 : 127], [103, 156]]]
    : floor ? [[[195, 118], [204, 155]], [[187, 120], [195, 156]]] : [[[167, lower ? 132 : 127], [163, 155]], [[128, lower ? 134 : 128], [124, 155]]];
  const make = (out: boolean, lower = false, swap = false) => {
    const baseY = stance === "kneeling" ? 79 : floor ? 148 : lower ? 83 : 61;
    const neck: Point = floor ? [115, 145] : [151, baseY];
    const body: Torso = floor ? [[97, 141], neck, [154, stance === "bridge" && !lower ? 129 : 147]]
      : [[147, baseY - 17], neck, [lower ? 143 : 152, baseY + 43]];
    const atSide: [Pair, Pair] = floor ? [[[133, 155], [120, 130]], [[127, 153], [115, 131]]]
      : [[[160, baseY + 23], [155, baseY + 9]], [[146, baseY + 22], [155, baseY + 10]]];
    const forward: [Pair, Pair] = floor ? [[[117, 122], [123, 96]], [[109, 124], [117, 96]]]
      : variant === "vertical" ? [[[155, 35], [154, 12]], [[145, 36], [150, 12]]]
      : [[[184, baseY + 11], [211, baseY + 9]], [[173, baseY + 13], [208, baseY + 10]]];
    const legs = legsFor(lower);
    return pose(body, out ? forward : atSide, swap ? [legs[1], legs[0]] : legs);
  };
  const before = make(false);
  const after = make(true);
  const frames = variant === "squat-hold" || variant === "split-hold" ? [after, make(true, true)]
    : stance === "bridge" ? [make(false, true), before, after, before]
    : variant === "squat-then-press" ? [before, make(false, true), before, after]
    : variant === "alternating" ? [before, after, before, make(false, false, true), make(true, false, true), make(false, false, true)] : [before, after];
  return loop(frames, props, [[load, 4, ...anchor], [load, 6, ...anchor]]);
}

function standingHip(action: "abduction" | "adduction" | "kickback", resistance: "body" | "cable" | "ankle-band", bent = false) {
  const posterior = action === "kickback";
  const adduction = action === "adduction";
  const body: Torso = [[150, 44], [151, 61], [151, 101]];
  const arms: [Pair, Pair] = [[[184, 83], [213, 79]], [[133, 85], [133, 108]]];
  const workingLeg: Pair = [[167, 127], [173, bent ? 136 : 152]];
  const movingLeg: Pair = posterior ? [[126, 123], [102, 139]] : adduction ? [[148, 125], [122, 138]]
    : bent ? [[193, 105], [196, 133]] : [[183, 116], [210, 134]];
  const make = (contract: boolean) => pose(body, arms, [contract ? movingLeg : workingLeg, [[145, 131], [144, 156]]]);
  const props: Props = [[213, 79, 213, 157], [202, 79, 226, 79]];
  if (resistance === "cable") props.push(...tower(252));
  const attachments: Attachments = resistance === "cable" ? [["cable", 8, 252, 143]] : resistance === "ankle-band" ? [["band", 8, 10]] : [];
  return loop([make(false), make(true)], props, attachments);
}

function seatedHips(action: "adduction" | "abduction") {
  const body: Torso = [[156, 48], [156, 66], [156, 112]];
  const arms: [Pair, Pair] = [[[187, 98], [192, 123]], [[125, 98], [119, 123]]];
  const seat: Props = [[145, 67, 145, 120], [166, 67, 166, 120], [118, 128, 195, 128], [129, 128, 129, 157], [183, 128, 183, 157]];
  const make = (wide: boolean) => pose(body, arms, wide
    ? [[[203, 126], [199, 155]], [[110, 126], [115, 155]]] : [[[175, 132], [175, 155]], [[138, 132], [137, 154]]]);
  const inner = action === "abduction" ? 7 : -7;
  return loop(action === "abduction" ? [make(false), make(true)] : [make(true), make(false)], seat,
    [["line", 7, 156, 140], ["line", 9, 156, 140], ["pad", 7, inner, -4], ["pad", 9, -inner, -4]]);
}

function lateralHipFloor(load: "band" | "weight" | "body", action: "raise" | "clamshell" | "adduction") {
  const shell = action === "clamshell";
  const adduction = action === "adduction";
  const body: Torso = shell ? [[83, 77], [101, 89], [154, 109]] : [[78, 127], [100, 136], [155, 143]];
  const arms: [Pair, Pair] = shell ? [[[104, 144], [142, 151]], [[143, 93], [154, 102]]] : [[[76, 154], [53, 155]], [[125, 150], [146, 153]]];
  const bottom: Pair = shell ? [[184, 139], [166, 152]] : [[187, 149], [223, 153]];
  const top: Pair = adduction ? [[177, 117], [159, 154]] : shell ? [[188, 126], [166, 152]] : [[190, 144], [223, 150]];
  const lifted: Pair = shell ? [[177, 98], [166, 152]] : adduction ? [[191, 141], [226, 142]] : [[179, 120], [207, 96]];
  const make = (raise: boolean) => pose(body, arms, [!adduction && raise ? lifted : top, adduction && raise ? lifted : bottom]);
  const attachments: Attachments = load === "band" ? [["knee-band", 7, 9]] : load === "weight" ? [["pad", 7, -6, -6]] : [];
  return loop([make(false), make(true)], undefined, attachments);
}const kneelingGluteKickback = loop([
  pose([[208, 74], [191, 86], [138, 103]], [[[195, 122], [193, 155]], [[183, 122], [180, 155]]], [[[142, 147], [105, 151]], [[128, 148], [94, 151]]]),
  pose([[208, 74], [191, 86], [138, 103]], [[[195, 122], [193, 155]], [[183, 122], [180, 155]]], [[[106, 106], [75, 97]], [[128, 148], [94, 151]]]),
], tower(245), [["cable", 8, 245, 148]]);

type RowSetup = "standing" | "split" | "kneeling" | "half-kneeling" | "seated" | "bent" | "hip-hinge-split"
  | "seated-bent" | "incline" | "low-incline" | "wall";
type RowGear = "band" | "cable" | "barbell" | "dumbbell" | "bottle" | "kettlebell" | "trap-bar" | "plate" | "smith" | "sandbag";
const rowSetups: Record<RowSetup, { body: Torso; legs: [Pair, Pair]; props?: Props }> = {
  standing: { body: standing, legs: standingLegs },
  split: { body: standing, legs: [[[169, 131], [181, 156]], [[123, 131], [105, 156]]] },
  kneeling: { body: [[144, 63], [146, 83], [145, 124]], legs: [[[151, 153], [115, 156]], [[141, 151], [101, 155]]] },
  "half-kneeling": { body: [[141, 59], [145, 78], [146, 120]], legs: [[[189, 116], [187, 155]], [[140, 153], [100, 155]]] },
  seated: { body: [[103, 73], [109, 92], [120, 142]], legs: [[[167, 135], [212, 152]], [[160, 137], [203, 154]]] },
  bent: { body: [[170, 64], [158, 80], [118, 110]], legs: [[[133, 132], [130, 155]], [[115, 132], [112, 155]]] },
  "hip-hinge-split": { body: [[163, 56], [152, 73], [123, 109]], legs: [[[149, 128], [155, 156]], [[110, 134], [89, 154]]] },
  "seated-bent": { body: [[158, 61], [145, 76], [108, 113]], legs: [[[151, 116], [156, 154]], [[141, 119], [144, 155]]], props: [[96, 123, 145, 123], [103, 123, 103, 157], [143, 123, 143, 157]] },
  incline: { body: [[179, 49], [166, 66], [130, 112]], legs: [[[129, 132], [127, 155]], [[117, 132], [111, 155]]], props: [[127, 108, 164, 64], [128, 108, 128, 157], [156, 75, 156, 157]] },
  "low-incline": { body: [[184, 61], [170, 79], [121, 110]], legs: [[[118, 132], [116, 155]], [[107, 133], [100, 155]]], props: [[115, 108, 166, 77], [118, 107, 118, 157], [157, 83, 157, 157]] },
  wall: { body: [[209, 72], [191, 83], [143, 111]], legs: [[[146, 133], [145, 157]], [[130, 133], [129, 155]]], props: [[218, 32, 218, 157]] },
};

function row(setup: RowSetup, gear: RowGear, line: "low" | "high" | "mid" | "feet", track: "low" | "high" | "face",
  mode: "both" | "single" = "both", handle: "independent" | "bar" | "short-bar" = "independent", wide = false) {
  const { body, props: equipment, legs } = rowSetups[setup];
  const [x, y] = body[1];
  const cable = gear === "cable";
  const band = gear === "band";
  const pull: [Pair, Pair] = track === "face" ? [[[x - 19, y - 6], [x + 6, y - 25]], [[x - 23, y - 1], [x + 4, y - 18]]]
    : track === "high" ? [[[x - 17, y + 5], [x + 5, y + 10]], [[x - (wide ? 31 : 14), y + 1], [x - 5, y + 12]]]
    : [[[x - 25, y + 22], [x + 1, y + 30]], [[x - (wide ? 32 : 22), y + 20], [x - (handle === "short-bar" ? 5 : 10), y + 31]]];
  const anchor: Point = [239, line === "high" ? y - (track === "face" ? 20 : 27) : line === "mid" ? y + 11 : 144];
  const letOut: [Pair, Pair] = cable || (band && line !== "feet")
    ? [[[x + 27, (2 * y + anchor[1]) / 3], [x + 53, (y + 2 * anchor[1]) / 3]],
      [[x + 22, (2 * y + anchor[1]) / 3 + 3], [x + 47, (y + 2 * anchor[1]) / 3 + 4]]]
    : setup === "seated" ? [[[x + 27, y + 15], [x + 54, y + 20]], [[x + 23, y + 18], [x + 50, y + 21]]]
    : [[[x + 3, y + 28], [x + 2, y + 58]], [[x - 11, y + 27], [x - 10, y + 57]]];
  const rested: Pair = [[x - 14, y + 23], [x - 18, y + 47]];
  const props: Props = [...equipment ?? []];
  if (cable || (band && line !== "feet")) props.push(...tower(anchor[0]));
  if (cable && setup === "seated" && line === "low") props.push([211, 153, 225, 137]);
  if (gear === "smith") props.push(...tower(x - 16), ...tower(x + 14), [x - 16, 20, x + 14, 20]);
  const attach: Attachments = gear === "barbell" || gear === "smith" ? [...weights] : [];
  if (handle !== "independent" && (cable || band)) attach.push([handle === "bar" ? "bar" : "line", 4, 6]);
  for (const [index, ankle] of [[4, 8], [6, 10]]) {
    if (index === 6 && mode === "single") break;
    if (cable || (band && line !== "feet")) attach.push([gear, index, ...anchor]);
    if (band && line === "feet") attach.push(["band", index, ankle]);
    if (gear === "dumbbell" || gear === "kettlebell" || gear === "bottle") attach.push([gear, index, 0, gear === "kettlebell" ? 7 : 0]);
  }
  if (gear === "trap-bar" || gear === "plate" || gear === "sandbag") attach.push([gear, 4, 0, 4]);
  const make = (arms: [Pair, Pair]) => pose(body, [arms[0], mode === "single" ? rested : arms[1]], legs);
  return loop([make(letOut), make(pull)], props, attach);
}

function suspendedPull(action: "row" | "face-pull" | "curl" | "reverse-fly",
  gear: "rings" | "handles" | "rope" | "band" | "fixed",
  setup: "standing" | "low" | "bent" | "heel-bench",
  grip: "regular" | "wide" | "underhand" | "neutral" = "regular", single = false, weighted = false) {
  const low = setup === "low" || setup === "heel-bench";
  const footY = setup === "heel-bench" ? 126 : 156;
  const body: Torso = low ? [[78, footY - 36], [96, footY - 30], [146, footY - 18]]
    : [[94, 66], [107, 80], [145, 114]];
  const range = action === "reverse-fly" ? 12 : 16;
  const lift = (x: number, y: number): Point => [x + range, y - 17];
  const legs: [Pair, Pair] = setup === "bent" ? [[[178, 119], [198, 156]], [[170, 119], [188, 156]]]
    : [[[183, footY - 12], [216, footY]], [[173, footY - 12], [206, footY]]];
  const [x, y] = body[1];
  const wrist: Pair = gear === "fixed" ? [[x + 32, y - 39], [x + 20, y - 39]] : [[x + 51, y - 31], [x + 40, y - 29]];
  const rest: [Pair, Pair] = [[[x + 25, y - 16], wrist[0]], [[x + 19, y - 15], wrist[1]]];
  const targetY = action === "face-pull" ? y - 37 : action === "curl" ? y - 48 : y - 18;
  const palm = grip === "underhand" ? 8 : 0;
  const pulled: [Pair, Pair] = action === "reverse-fly" ? [[[x + 28, y - 12], [x + 57, y - 16]], [[x - 7, y - 21], [x - 31, y - 22]]]
    : [[[x + (action === "curl" ? 39 : 10), y + (action === "row" ? 13 : -17)],
      gear === "fixed" ? wrist[0] : [x + 44, targetY]],
      [[x - (grip === "wide" || action === "face-pull" ? 16 : 3) + palm, y + (action === "row" ? 12 : -21)],
        gear === "fixed" ? wrist[1] : [x + (grip === "wide" ? 18 : 31), targetY + 1]]];
  const parked: Pair = [[x - 2, y + 26], [x + 16, y + 35]];
  const props: Props = setup === "heel-bench" ? [[195, 132, 231, 132], [208, 132, 208, 157]] : [];
  const attachments: Attachments = [];
  if (gear === "fixed") props.push([wrist[1][0] - 15, wrist[1][1], wrist[0][0] + 19, wrist[0][1]],
    [wrist[0][0] + 18, wrist[0][1], wrist[0][0] + 18, 157]);
  else {
    props.push([x + 29, 15, x + 59, 15]);
    for (const id of single ? [4] : [4, 6]) {
      attachments.push([gear === "band" ? "band" : "line", id, id === 4 ? x + 55 : x + 33, 15]);
      if (gear === "rings") attachments.push(["ring", id, 0, -5]);
      if (gear === "handles") attachments.push(["pad", id, 0, -3]);
    }
  }
  if (weighted) attachments.push(["plate", 1, 20, -1]);
  return loop([pose(body, [rest[0], single ? parked : rest[1]], legs),
    pose([lift(...body[0]), lift(...body[1]), [body[2][0] + 7, body[2][1] - 10]], [pulled[0], single ? parked : pulled[1]], legs)], props, attachments);
}

const suspendedChestPress = loop([
  pose([[176, 72], [162, 87], [125, 112]], [[[148, 109], [168, 93]], [[137, 108], [155, 89]]],
    [[[111, 134], [95, 156]], [[104, 134], [82, 155]]]),
  pose([[152, 53], [146, 70], [117, 112]], [[[167, 85], [193, 94]], [[159, 85], [182, 92]]],
    [[[107, 135], [95, 156]], [[97, 135], [82, 155]]]),
], [[92, 17, 126, 17]], [["line", 4, 120, 17], ["line", 6, 98, 17], ["pad", 4, -3, -2], ["pad", 6, -3, -2]]);

function floorCrunch(action: "upper" | "reverse" | "oblique" | "bicycle", load: "none" | "band" | "bottle" | "plate" | "ez",
  support: "floor" | "decline" = "floor", hands: "head" | "chest" | "overhead" = "head") {
  const reverse = action === "reverse";
  const declineBench = support === "decline";
  const angled = declineBench && reverse;
  const rest: Torso = declineBench ? angled ? [[101, 93], [118, 98], [154, 122]] : [[76, 126], [98, 125], [151, 107]]
    : [[86, 140], [106, 146], [154, 147]];
  const props: Props = declineBench ? angled ? [[92, 105, 160, 132], [150, 132, 150, 157], [99, 107, 99, 157], [76, 106, 105, 106]]
    : [[73, 138, 157, 116], [80, 135, 80, 157], [152, 116, 152, 157], [184, 111, 208, 111], [198, 111, 198, 154]] : [];
  if (load === "band") props.push([35, 130, 35, 157]);
  const make = (raise: boolean, other = false) => {
    const neck: Point = raise && !reverse ? [rest[1][0] + 14, rest[1][1] - 22] : rest[1];
    const pelvis: Point = raise && reverse ? [rest[2][0] - 8, rest[2][1] - 15] : rest[2];
    const body: Torso = [[rest[0][0] + (raise && !reverse ? 18 : 0), rest[0][1] - (raise && !reverse ? 22 : 0)], neck, pelvis];
    const [x, y] = neck;
    const arms: [Pair, Pair] = hands === "overhead" ? [[[x - 20, y - 4], [x - 44, y - 10]], [[x - 26, y - 1], [x - 47, y - 7]]]
      : hands === "chest" ? [[[x + 23, y + 6], [x + 17, y - 10]], [[x + 17, y + 5], [x + 11, y - 8]]]
      : [[[x + (action === "oblique" && raise && !other ? 24 : 7), y - 23], [x - 14, y - 10]],
        [[x + (action === "oblique" && raise && other ? 22 : 1), y - 20], [x - 17, y - 8]]];
    const tabletop: [Pair, Pair] = raise && reverse ? [[[144, pelvis[1] - 36], [174, pelvis[1] - 34]], [[137, pelvis[1] - 34], [168, pelvis[1] - 32]]]
      : [[[174, pelvis[1] - 30], [208, pelvis[1] - 27]], [[169, pelvis[1] - 28], [201, pelvis[1] - 23]]];
    const tucked: Pair = [[152, rest[2][1] - 48], [170, rest[2][1] - 21]];
    const long: Pair = [[186, rest[2][1] - 17], [226, rest[2][1] - 23]];
    const legs: [Pair, Pair] = reverse ? tabletop : action === "bicycle"
      ? other ? [long, tucked] : [tucked, long] : declineBench
        ? [[[178, 88], [189, 106]], [[172, 89], [185, 107]]] : [[[184, 116], [202, 155]], [[175, 121], [194, 155]]];
    return pose(body, arms, legs);
  };
  const attachments: Attachments = load === "band" ? [["band", 4, 35, 135], ["band", 6, 35, 135]]
    : load === "ez" ? [["ez-bar", 4, 6], ["plate", 4, -4], ["plate", 6, 4]]
    : load === "bottle" || load === "plate" ? [[load, 4, -4, 0]] : [];
  const start = make(false);
  if (action === "oblique") return loop([start, make(true), start, make(true, true)], props, attachments);
  if (action === "bicycle") return loop([make(true), make(true, true)], props, attachments);
  return loop([start, make(true)], props, attachments);
}

function kneelingCrunch(gear: "band" | "cable") {
  const towerProps = tower(237);
  const legs: [Pair, Pair] = [[[141, 153], [100, 157]], [[129, 153], [89, 156]]];
  return loop([
    pose([[143, 64], [135, 80], [135, 123]], [[[158, 99], [156, 68]], [[150, 98], [148, 71]]], legs),
    pose([[169, 110], [150, 107], [135, 123]], [[[174, 136], [173, 109]], [[167, 134], [168, 105]]], legs),
  ], towerProps, [[gear, 4, 237, 26], [gear, 6, 237, 26]]);
}

const abWheelCrunch = loop([
  pose([[146, 74], [134, 87], [115, 119]], [[[141, 115], [151, 146]], [[130, 115], [142, 146]]],
    [[[128, 153], [91, 154]], [[119, 153], [82, 154]]]),
  pose([[173, 112], [159, 116], [117, 124]], [[[188, 128], [210, 146]], [[180, 129], [200, 146]]],
    [[[128, 153], [91, 154]], [[119, 153], [82, 154]]]),
], undefined, [["wheel", 4, -5, 8]]);

// Original side-view movement demonstrations, keyed by the exact catalogue entry.
export const catalogueIllustrations: Readonly<Record<string, Illustration>> = {
  "0784": bandSquat,
  "1004": bandSquat,
  "2204": rollerBodySaw,
  "2571": rockingFrog,
  "3663": reversePlankWithLegLift,
  "1015": verticalPallof,
  "1173": benchPress(incline, "barbell", "wide-reverse"),
  "3174": benchPress(level, "barbell", "feet-up"),
  "3681": benchPress(level, "dumbbell", "squeeze"),
  "4836": benchPress(level, "dumbbell", "reverse-squeeze"),
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
  "1061": bridge("bench", "bent-single", "barbell"),
  "1062": bridge("bench", "bent-single", "weighted"),
  "2071": bridge("bench", "bent-single", "none"),
  "2072": bridge("bench", "parallel", "none"),
  "2146": bridge("lever", "parallel", "belt"),
  "2147": bridge("lever", "parallel", "belt", "knees"),
  "2148": bridge("lever", "bent-single", "belt"),
  "2154": bridge("floor", "parallel", "none", "knees"),
  "2158": bridge("floor", "straight-single", "none", "knees"),
  "2159": bridge("floor", "straight-single", "none", "knees"),
  "2200": bridge("ball", "straight", "none"),
  "2471": bridge("floor", "parallel", "none"),
  "2474": bridge("floor", "straight-single", "none"),
  "2475": bridge("floor", "chest-single", "none"),
  "2555": bridge("floor", "parallel", "none", "knees"),
  "2742": bridge("lever-step", "parallel", "belt"),
  "2743": bridge("lever", "parallel", "belt"),
  "2754": bridge("bench", "parallel", "weighted"),
  "2757": bridge("floor", "frog", "none"),
  "2760": bridge("bench", "parallel", "none", "hips"),
  "2964": bridge("floor", "parallel", "barbell"),
  "3110": bridge("smith", "parallel", "barbell"),
  "3873": bridge("bench", "parallel", "barbell", "hips"),
  "4044": bridge("floor", "chest-single", "none"),
  "4050": bridge("bench", "parallel", "none", "hips"),
  "4291": bridge("floor", "straight-single", "dumbbell"),
  "4447": bridge("feet-bench", "parallel", "none", "knees"),
  "4448": bridge("bench", "parallel", "barbell", "knees"),
  "4690": bridge("floor", "crossed", "none"),
  "4751": bridge("floor", "parallel", "dumbbell"),
  "4755": bridge("bench", "bent-single", "dumbbell"),
  "4791": bridge("floor", "straight-single", "none", undefined, "full", true),
  "4792": bridge("bench", "bent-single", "none"),
  "4887": bridge("floor", "parallel", "two-dumbbells"),
  "4902": bridge("bench", "bent-single", "none"),
  "5198": bridge("floor", "straight-single", "none", undefined, "hold"),
  "5451": bridge("floor", "parallel", "barbell", undefined, "short"),
  "5476": bridge("bench", "staggered", "barbell"),
  "5554": bridge("floor", "parallel", "dumbbell", undefined, "short"),
  "5671": bridge("floor", "bent-single", "none", undefined, "short"),
  "5754": bridge("bench", "parallel", "dumbbell"),
  "6050": bridge("floor", "parallel", "bottle"),
  "6160": bridge("floor", "frog", "dumbbell"),
  "6464": bridge("floor", "frog", "none"),
  "6465": bridge("smith", "frog", "barbell"),
  "6546": bridge("bench", "bent-single", "landmine"),
  "6735": bridge("bench", "parallel", "dumbbell", "knees"),
  "7413": bridge("bench", "parallel", "none"),
  "7418": bridge("floor", "staggered", "none"),
  "7419": bridge("floor", "straight", "none"),
  "8075": bridge("bench", "bent-single", "dumbbell"),
  "11053": bridge("smith", "staggered", "barbell"),
  "0894": calfRaise({ load: "band" }),
  "0973": calfRaise({ load: "band" }),
  "1050": calfRaise({ load: "smith", step: true }),
  "1154": calfRaise({ support: "suspension" }),
  "1164": calfRaise({ load: "smith", step: true }),
  "1178": calfRaise({ load: "dumbbell", legs: "one", support: "rail", step: true }),
  "1216": calfRaise({ load: "lever", posture: "seated", step: true, legs: "one" }),
  "1505": calfRaise({ load: "band" }),
  "2425": calfRaise({ load: "band" }),
  "2666": calfRaise({ load: "lever", posture: "seated", step: true }),
  "3018": calfRaise(),
  "3120": calfRaise({ support: "rail" }),
  "3390": calfRaise({ support: "chair", step: true }),
  "3534": calfRaise({ support: "rail", cadence: "pulse" }),
  "3712": calfRaise({ support: "rail", legs: "one" }),
  "3713": calfRaise({ support: "rail", legs: "one", load: "dumbbell" }),
  "3973": calfRaise({ support: "rail", legs: "one", load: "dumbbell", step: true }),
  "4155": calfRaise({ load: "weighted", posture: "seated", step: true }),
  "4160": calfRaise({ posture: "half-squat" }),
  "4370": calfRaise({ load: "smith", posture: "seated", step: true }),
  "4563": calfRaise({ load: "dumbbells", posture: "half-squat" }),
  "4760": calfRaise({ support: "rail", step: true }),
  "4761": calfRaise({ support: "rail", legs: "one", step: true }),
  "4796": calfRaise({ legs: "one" }),
  "4900": calfRaise({ posture: "seated", step: true }),
  "5003": calfRaise({ support: "rail", legs: "one", step: true }),
  "5009": calfRaise({ support: "rail", step: true }),
  "5052": calfRaise({ support: "rail", legs: "one", step: true }),
  "5483": calfRaise({ load: "weighted", posture: "seated", step: true }),
  "5484": calfRaise({ load: "weighted", posture: "seated", step: true, legs: "one" }),
  "5854": calfRaise({ load: "kettlebell", step: true }),
  "9310": calfRaise({ cadence: "hold" }),
  "9409": calfRaise({ support: "chair", posture: "soft-knee" }),
  "9410": calfRaise({ load: "barbell", posture: "soft-knee", step: true }),
  "9411": calfRaise({ support: "chair", posture: "soft-knee", legs: "alternating" }),
  "10548": calfRaise({ support: "rail", legs: "one" }),
  "10819": calfRaise({ legs: "split" }),
  "11650": calfRaise({ posture: "seated", legs: "one" }),
  "2928": shrug("barbell", "overhead", 39),
  "3730": shrug("barbell", "back"),
  "4016": shrug("barbell", "seated"),
  "4053": shrug("dumbbell", "seated"),
  "4103": shrug("trap", "standing"),
  "4226": shrug("cable", "supine"),
  "4361": shrug("body", "standing"),
  "4862": shrug("barbell", "standing", 46),
  "5223": shrug("smith", "standing", 39),
  "5224": shrug("barbell", "standing", 39),
  "5225": shrug("smith", "back", 39),
  "5226": shrug("barbell", "back", 39),
  "6194": shrug("kettlebell", "standing"),
  "7155": shrug("cable", "seated-reverse"),
  "11288": shrug("body", "overhead"),
  "1243": deadBug("none"),
  "4047": deadBug("kettlebell"),
  "4124": deadBug("medicine-ball"),
  "4839": deadBug("feet-band"),
  "4840": deadBug("none", true),
  "7839": deadBug("none"),
  "9517": deadBug("kettlebell"),
  "9518": deadBug("kb-pullover"),
  "3141": birdDog("all-fours"),
  "3511": birdDog("all-fours", "band"),
  "4416": birdDog("all-fours", "slider"),
  "9002": birdDog("high-plank"),
  "0728": seatedKnee("extension", "ball", "single"),
  "0911": proneCurl("band", "both"),
  "0926": standingKnee("extension", "band"),
  "1083": bridgeCurl("straps"),
  "1102": bridgeCurl("straps"),
  "1547": standingKnee("curl", "cable"),
  "1571": seatedKnee("extension", "machine", "single"),
  "1586": seatedKnee("curl", "machine", "single"),
  "1590": proneCurl("machine", "single"),
  "1873": seatedKnee("extension", "plate-machine", "both"),
  "1874": seatedKnee("extension", "plate-machine", "alternating"),
  "3386": seatedKnee("extension", "machine", "both"),
  "3395": bridgeCurl("towel"),
  "3518": seatedKnee("extension", "band", "single"),
  "3742": bridgeCurl("towel"),
  "4033": standingKnee("curl", "band"),
  "4036": standingKnee("curl", "band"),
  "4347": standingKnee("curl", "machine"),
  "4733": proneCurl("dumbbell", "both", true),
  "4819": bridgeCurl("rings"),
  "4897": bridgeCurl("towel", false, true),
  "4903": seatedKnee("curl", "band", "both"),
  "4912": bridgeCurl("rings"),
  "4968": quadrupedKneeCurl,
  "5178": seatedKnee("extension", "plate-machine", "single"),
  "5664": seatedKnee("extension", "cable", "single"),
  "6161": proneCurl("dumbbell", "both"),
  "7108": seatedKnee("extension", "machine", "both"),
  "8604": seatedKnee("curl", "plate-machine", "both"),
  "9047": bridgeCurl("ball", true),
  "10763": seatedKnee("curl", "plate-machine", "single"),
  "11276": proneCurl("cable", "single"),
  "0005": curl("standing", "band", "alternating"),
  "0166": curl("standing", "cable-rope", "both", "neutral"),
  "0181": curl("supine", "cable-short", "both"),
  "0897": curl("standing", "band", "both", "neutral"),
  "1032": curl("preacher", "machine", "alternating"),
  "1196": curl("standing", "dumbbell", "alternating"),
  "1203": curl("inner", "cable", "single"),
  "1228": curl("inner", "dumbbell", "both"),
  "1233": curl("incline", "dumbbell", "alternating", "neutral"),
  "1607": curl("standing", "cable-ez", "both"),
  "1872": curl("preacher", "plate-machine", "both"),
  "2348": curl("preacher", "ez", "both"),
  "2352": curl("standing", "dumbbell", "both"),
  "2353": curl("concentration", "dumbbell", "single"),
  "2396": curl("supine", "cable-short", "both"),
  "2656": curl("standing", "cable", "single"),
  "2660": curl("preacher", "plate-machine", "both"),
  "2900": curl("standing-preacher", "ez", "both"),
  "3068": curl("standing", "cable-rope", "both", "neutral"),
  "3084": curl("preacher", "dumbbell", "single"),
  "3554": curl("standing", "bottle", "both", "neutral"),
  "3682": curl("incline", "dumbbell", "alternating"),
  "3688": curl("seated", "dumbbell", "both", "overhand"),
  "3761": curl("seated", "dumbbell", "alternating"),
  "3764": curl("incline", "dumbbell", "both"),
  "3925": curl("floor-concentration", "cable", "single"),
  "4063": curl("standing", "band", "both"),
  "4084": curl("high", "band", "both"),
  "4085": curl("kneeling-preacher", "band", "both"),
  "4086": curl("standing", "band", "both"),
  "4087": curl("behind", "band", "both"),
  "4138": curl("narrow", "band", "both"),
  "4336": curl("preacher", "machine", "both"),
  "4357": curl("standing", "band", "both"),
  "4369": curl("standing", "body", "both"),
  "4619": curl("standing", "band", "both", "neutral"),
  "4687": curl("standing", "band", "both", "neutral"),
  "4721": curl("standing", "barbell", "both"),
  "4743": curl("incline", "dumbbell", "both"),
  "4838": curl("standing", "cable", "single"),
  "4973": curl("incline-high", "dumbbell", "both"),
  "4981": curl("narrow", "barbell", "both"),
  "5297": curl("kneeling-preacher", "cable", "both"),
  "5370": curl("standing", "cable-rope", "single", "neutral"),
  "5703": curl("incline", "cable", "both"),
  "5856": curl("concentration", "kettlebell", "single"),
  "5857": curl("narrow", "kettlebell", "both"),
  "5921": curl("preacher", "dumbbell", "both", "neutral"),
  "6063": curl("concentration", "bottle", "single"),
  "6064": curl("concentration", "bottle", "single", "overhand"),
  "6068": curl("standing", "bottle", "alternating"),
  "6069": curl("standing", "bottle", "alternating", "neutral"),
  "6150": curl("concentration", "dumbbell", "both"),
  "6264": curl("prone-incline", "dumbbell", "alternating", "neutral"),
  "6406": curl("preacher", "ez", "both"),
  "6698": curl("narrow", "plate", "both"),
  "6757": curl("standing", "dumbbell", "single"),
  "7921": curl("seated", "cable", "single"),
  "7922": curl("seated", "cable", "single"),
  "9862": curl("preacher", "plate-machine", "single"),
  "11261": curl("standing", "cable-rope", "both", "neutral"),
  "0907": raiseArms("lateral", "band"),
  "1508": raiseArms("lateral", "band"),
  "3428": raiseArms("front", "dumbbell"),
  "6073": raiseArms("front", "bottle"),
  "6074": raiseArms("lateral", "bottle"),
  "6075": raiseArms("front", "bottle", true),
  "6543": raiseArms("front", "low-cable-rope"),
  "1202": pallof("cable", "standing"),
  "1213": pallof("cable", "standing", "vertical"),
  "3524": pallof("band", "standing", "squat-then-press"),
  "3774": pallof("band", "standing", "squat-hold"),
  "3775": pallof("band", "split", "split-hold"),
  "3796": pallof("band", "standing", "squat-hold"),
  "3797": pallof("band", "split", "split-hold"),
  "4106": pallof("cable", "split"),
  "4197": pallof("cable", "bridge"),
  "4224": pallof("cable", "floor"),
  "4240": pallof("band", "standing"),
  "4356": pallof("cable", "standing"),
  "10184": pallof("band", "split", "alternating"),
  "0790": standingHip("abduction", "body", true),
  "0791": standingHip("abduction", "body"),
  "0837": lateralHipFloor("weight", "raise"),
  "1867": seatedHips("adduction"),
  "1869": seatedHips("abduction"),
  "5169": standingHip("adduction", "body"),
  "5998": lateralHipFloor("body", "adduction"),
  "6798": standingHip("kickback", "ankle-band"),
  "7204": standingHip("kickback", "ankle-band"),
  "7589": kneelingGluteKickback,
  "9849": lateralHipFloor("body", "clamshell"),
  "11267": standingHip("adduction", "cable"),
  "11644": lateralHipFloor("band", "raise"),
  "0062": row("bent", "barbell", "feet", "low"),
  "0930": row("standing", "band", "mid", "low"),
  "1006": row("standing", "band", "mid", "high", "both", "independent", true),
  "1238": row("seated", "cable", "low", "low", "both", "bar"),
  "2509": row("incline", "barbell", "feet", "low"),
  "2661": row("seated", "cable", "low", "low", "both", "short-bar"),
  "3121": row("seated", "band", "feet", "low"),
  "3232": row("standing", "cable", "mid", "face", "both", "independent", true),
  "3233": row("seated", "cable", "low", "low", "both", "bar"),
  "3320": row("low-incline", "dumbbell", "feet", "low"),
  "3357": row("seated", "cable", "low", "low"),
  "3721": row("bent", "barbell", "feet", "high", "both", "bar", true),
  "3799": row("bent", "dumbbell", "feet", "low"),
  "3845": row("seated", "band", "feet", "low"),
  "3858": row("bent", "band", "feet", "low"),
  "3859": row("bent", "cable", "low", "low"),
  "3860": row("bent", "plate", "feet", "low"),
  "3896": row("seated", "band", "feet", "low"),
  "3899": row("bent", "band", "feet", "low"),
  "4011": row("bent", "cable", "low", "low", "both", "bar"),
  "4104": row("bent", "trap-bar", "feet", "low"),
  "4145": row("standing", "band", "mid", "low"),
  "4147": row("standing", "band", "high", "high"),
  "4182": row("standing", "band", "mid", "high", "both", "independent", true),
  "4195": row("half-kneeling", "band", "high", "face"),
  "4235": row("seated-bent", "dumbbell", "feet", "high", "both", "independent", true),
  "4367": row("bent", "cable", "low", "low", "both", "bar"),
  "4368": row("bent", "cable", "low", "low"),
  "4445": row("seated", "band", "mid", "face"),
  "4452": row("bent", "band", "feet", "high", "both", "independent", true),
  "4453": row("standing", "band", "low", "high", "single"),
  "4454": row("seated", "band", "feet", "high", "both", "independent", true),
  "4569": row("hip-hinge-split", "band", "feet", "low", "single"),
  "4570": row("bent", "band", "feet", "low"),
  "4575": row("standing", "band", "mid", "low", "single"),
  "4730": row("bent", "dumbbell", "feet", "low", "single"),
  "5005": row("seated", "band", "feet", "low"),
  "5090": row("standing", "cable", "mid", "low"),
  "5179": row("standing", "cable", "mid", "low", "both", "short-bar"),
  "5316": row("bent", "smith", "feet", "low", "both", "short-bar"),
  "5369": row("kneeling", "cable", "mid", "low", "single"),
  "5524": row("standing", "cable", "mid", "face", "single"),
  "5553": row("seated", "cable", "low", "low"),
  "5607": row("standing", "band", "high", "face"),
  "5609": row("standing", "cable", "mid", "face"),
  "5656": row("standing", "cable", "high", "face"),
  "5658": row("seated", "cable", "high", "face"),
  "5661": row("incline", "dumbbell", "feet", "low"),
  "5853": row("incline", "barbell", "feet", "high", "both", "bar", true),
  "6059": row("bent", "bottle", "feet", "low"),
  "6146": row("wall", "dumbbell", "feet", "low"),
  "6156": row("bent", "kettlebell", "feet", "low", "single"),
  "6776": row("split", "cable", "mid", "high", "single"),
  "7744": row("standing", "cable", "high", "face"),
  "9698": row("incline", "dumbbell", "feet", "low"),
  "9699": row("incline", "dumbbell", "feet", "low", "single"),
  "10112": row("seated", "cable", "low", "low", "single"),
  "10389": row("bent", "sandbag", "feet", "low"),
  "10667": row("kneeling", "cable", "mid", "low", "single"),
  "10668": row("kneeling", "band", "mid", "low", "single"),
  "11257": row("seated", "cable", "high", "high"),
  "11269": row("bent", "cable", "low", "low", "single"),
  "1071": suspendedPull("row", "handles", "bent"),
  "1080": suspendedPull("row", "handles", "standing"),
  "1090": suspendedPull("reverse-fly", "handles", "standing"),
  "1113": suspendedPull("face-pull", "handles", "standing"),
  "1120": suspendedPull("row", "handles", "standing", "neutral"),
  "1123": suspendedPull("curl", "handles", "standing", "underhand", true),
  "1184": suspendedPull("row", "fixed", "low", "wide", false, true),
  "1223": suspendedPull("row", "fixed", "low", "underhand"),
  "2834": suspendedPull("row", "handles", "low", "regular", false, true),
  "4379": suspendedPull("row", "band", "low"),
  "4450": suspendedPull("row", "handles", "standing", "wide"),
  "4451": suspendedPull("row", "handles", "low", "wide"),
  "4818": suspendedPull("row", "rings", "heel-bench"),
  "4921": suspendedPull("face-pull", "rings", "standing", "wide"),
  "4923": suspendedPull("reverse-fly", "rings", "standing"),
  "5006": suspendedPull("row", "handles", "standing", "underhand"),
  "5007": suspendedPull("curl", "handles", "standing", "neutral"),
  "5517": suspendedPull("row", "fixed", "low", "underhand"),
  "5738": suspendedChestPress,
  "6220": suspendedPull("row", "handles", "standing"),
  "6232": suspendedPull("curl", "handles", "standing"),
  "6237": suspendedPull("curl", "rings", "standing", "underhand", true),
  "6252": suspendedPull("face-pull", "rings", "standing"),
  "11715": suspendedPull("row", "rope", "low"),
  "0147": floorCrunch("bicycle", "none"),
  "0832": floorCrunch("upper", "plate", "floor", "chest"),
  "1845": floorCrunch("reverse", "none", "decline", "overhead"),
  "2130": floorCrunch("upper", "plate", "decline", "chest"),
  "2269": abWheelCrunch,
  "4080": kneelingCrunch("band"),
  "4081": floorCrunch("reverse", "band", "floor", "overhead"),
  "4083": floorCrunch("upper", "band", "floor", "chest"),
  "4188": floorCrunch("reverse", "ez", "floor", "overhead"),
  "4354": floorCrunch("oblique", "none"),
  "4620": floorCrunch("oblique", "none"),
  "5202": kneelingCrunch("band"),
  "6418": floorCrunch("reverse", "band", "floor", "overhead"),
  "10710": floorCrunch("upper", "plate", "floor", "chest"),
};
