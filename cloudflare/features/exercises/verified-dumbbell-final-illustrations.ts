import type { Illustration, Point } from "./motion-data";

type Torso = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];

const pose = (body: Torso, arms: Arms, legs: Legs, shoulders: Pair, ...extra: Point[]): Point[] =>
  [...body, ...arms, ...legs, ...shoulders, ...extra];
const clip = (frames: Point[][], props: Props, dynamic: Gear, ms = 800): Illustration =>
  ({ frames, props, dynamic, ms, shoulders: [11, 12], reference: true });
const pair: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const neutralPair: Gear = [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]];

function bentRow(chestSupported: boolean): Illustration {
  const torso: Torso = chestSupported ? [[180, 56], [168, 73], [122, 113]] : [[184, 82], [169, 94], [119, 105]];
  const legs: Legs = chestSupported ? [[120, 135], [103, 155], [115, 133], [94, 153]] :
    [[133, 129], [140, 156], [118, 129], [119, 153]];
  const pad: Props = chestSupported ?
    [[106, 133, 180, 70], [114, 125, 114, 156], [153, 98, 153, 156], [102, 155, 160, 155]] : [];
  const shoulders: Pair = [[165, torso[1][1] + 6], [172, torso[1][1] - 4]];
  const at = (arms: Arms) => pose(torso, arms, legs, shoulders, [arms[1][0] + 6, arms[1][1]], [arms[3][0] + 6, arms[3][1]]);
  const down = at([[160, torso[1][1] + 29], [158, torso[1][1] + 52],
    [173, torso[1][1] + 19], [170, torso[1][1] + 39]]);
  const top = at([[142, torso[1][1] + 4], [149, torso[1][1] + 28],
    [149, torso[1][1] - 3], [158, torso[1][1] + 17]]);
  return clip([down, top], pad,
    chestSupported ? neutralPair : [...pair, ["palm-up", 4, 13], ["palm-up", 6, 14]], 1450);
}

const flat: Props = [[72, 120, 199, 120], [82, 120, 82, 156], [186, 120, 186, 156]];
const incline: Props = [[82, 68, 158, 119], [158, 119, 190, 119], [103, 82, 103, 156], [181, 119, 181, 157]];
const backrest: Props = [[144, 66, 144, 120], [148, 66, 148, 120], [139, 120, 191, 120],
  [143, 120, 143, 156], [182, 120, 182, 157]];
const benchLegs: Legs = [[191, 117], [200, 155], [177, 114], [181, 153]];
const benchFeet: Gear = [["foot", 8, 209, 157], ["foot", 10, 190, 156]];

type ExtensionSetup = { body: Torso; shoulders: Pair; elbows: Pair; up: Pair; down: Pair; props: Props };
const pressSetups = {
  flat: { body: [[88, 107], [106, 111], [158, 112]], shoulders: [[109, 113], [116, 104]],
    elbows: [[116, 84], [125, 75]], up: [[117, 56], [128, 47]], down: [[94, 89], [102, 81]], props: flat },
  sloped: { body: [[88, 57], [104, 69], [157, 109]], shoulders: [[103, 75], [111, 65]],
    elbows: [[93, 49], [104, 44]], up: [[84, 22], [95, 18]], down: [[68, 57], [79, 52]], props: incline },
  seated: { body: [[155, 54], [155, 71], [155, 112]], shoulders: [[165, 72], [145, 71]],
    elbows: [[169, 47], [142, 46]], up: [[169, 20], [142, 19]], down: [[159, 70], [133, 69]], props: backrest },
} satisfies Record<string, ExtensionSetup>;

function dumbbellExtension(mode: "incline" | "alternate" | "across" | "pronated" | "backrest"): Illustration {
  const setup = mode === "incline" ? pressSetups.sloped : mode === "backrest" ? pressSetups.seated : pressSetups.flat;
  const { body, shoulders, elbows, up, down, props } = setup;
  const at = ([right, left]: Pair) =>
    pose(body, [elbows[0], right, elbows[1], left], benchLegs, shoulders, [right[0] - 4, right[1] + 3], [left[0] - 4, left[1] + 3]);
  const raised = at(up);
  let poses = [at(down), raised, raised, at(down)];
  if (mode === "alternate") poses = [at([down[0], up[1]]), raised, at([up[0], down[1]]), raised];
  if (mode === "across") poses = [raised, at([[135, 89], up[1]]), at([[135, 89], up[1]]), raised];
  if (mode === "pronated") poses = [raised, at(down), at(down), raised];
  const grip: Gear = mode === "pronated" ? [["palm-down", 4, 13], ["palm-down", 6, 14]] : [];
  const bells = mode === "incline" || mode === "alternate" ? neutralPair : pair;
  return clip(poses, props, [...bells, ...benchFeet, ...grip], 950);
}

function anchoredSideRearFly(): Illustration {
  const body: Torso = [[176, 108], [156, 112], [110, 107]];
  const legs: Legs = [[82, 110], [51, 107], [78, 103], [47, 101]];
  const bench: Props = [[45, 117, 176, 117], [54, 117, 54, 157], [165, 117, 165, 156]];
  const at = (elbow: Point, wrist: Point) => pose(body, [elbow, wrist, [164, 136], [169, 156]], legs,
    [[150, 105], [158, 120]], [174, 156]);
  return clip([at([149, 88], [176, 91]), at([140, 81], [157, 71]), at([137, 77], [133, 51]),
    at([140, 81], [157, 71])], bench, [["dumbbell", 4, 0, 0], ["digit", 6, 13, 5]], 860);
}

function staggeredKickback(stork: boolean): Illustration {
  const body: Torso = stork ? [[187, 94], [171, 105], [125, 107]] :
    [[182, 77], [169, 90], [122, 111]];
  const legs: Legs = stork ? [[138, 128], [139, 155], [109, 130], [81, 114]] :
    [[143, 127], [147, 155], [105, 134], [83, 153]];
  const at = (right: Point, left: Point) => pose(body, [[142, 112], right, stork ? [146, 101] : [154, 110], left],
    legs, [[166, body[1][1] + 6], [174, body[1][1] - 4]]);
  const low = at([151, 135], stork ? [155, 125] : [143, 128]);
  const top = at([115, 114], stork ? [118, 102] : [143, 128]);
  const floorContact: Gear = [["foot", 8, 148, 157],
    ["foot", 10, stork ? 70 : 89, stork ? 109 : 157]];
  return clip([low, top, top, low], [], [...floorContact, ...(stork ? neutralPair : [["hammer-weight", 4, 0, 0]] as Gear)], 870);
}

const upright: Torso = [[155, 48], [156, 65], [156, 110]];
const standing: Legs = [[168, 132], [172, 155], [145, 131], [139, 153]];
const feet: Gear = [["foot", 8, 183, 156], ["foot", 10, 133, 155]];

function armCircleStanding(): Illustration {
  const at = (arms: Arms) => pose(upright, arms, standing, [[169, 68], [144, 66]]);
  const low = at([[174, 94], [178, 120], [149, 92], [151, 117]]);
  const wide = at([[195, 70], [222, 68], [116, 69], [90, 68]]);
  const overhead = at([[173, 44], [173, 17], [142, 42], [141, 15]]);
  const front = at([[185, 67], [209, 66], [161, 62], [185, 60]]);
  return clip([low, wide, overhead, overhead, front], [], [...pair, ...feet], 740);
}

function dumbbellClean(): Illustration {
  const down = pose([[175, 89], [160, 101], [127, 133]], [[156, 126], [156, 149], [170, 122], [176, 145]],
    [[164, 132], standing[1], [138, 129], standing[3]], [[157, 106], [165, 97]]);
  const drive = pose([[158, 49], [156, 66], [156, 108]], [[171, 87], [176, 112], [148, 86], [153, 105]],
    standing, [[165, 69], [147, 65]]);
  const catchLow = pose([[164, 72], [158, 90], [147, 134]], [[172, 106], [173, 83], [150, 104], [151, 81]],
    [[181, 134], standing[1], [138, 132], standing[3]], [[166, 93], [149, 90]]);
  const rack = pose(upright, [[176, 82], [176, 58], [145, 82], [145, 57]], standing, [[166, 69], [146, 66]]);
  return clip([down, drive, catchLow, rack, rack, down], [], [...pair, ...feet], 500);
}

function stepUpCurl(): Illustration {
  const bench: Props = [[139, 124, 217, 124], [149, 124, 149, 156], [209, 124, 209, 156]];
  const low = pose([[162, 56], [163, 73], [158, 109]], [[174, 100], [178, 124], [150, 96], [149, 121]],
    [[187, 106], [180, 121], [151, 132], [144, 155]], [[170, 75], [153, 73]]);
  const rise = pose([[165, 38], [165, 55], [166, 93]], [[177, 79], [180, 62], [153, 78], [155, 60]],
    [[179, 103], [180, 121], [192, 98], [190, 144]], [[174, 56], [156, 54]]);
  const high = pose([[166, 20], [166, 37], [168, 76]], [[178, 62], [182, 38], [155, 61], [159, 36]],
    [[175, 98], [180, 121], [199, 70], [198, 100]], [[174, 41], [157, 37]]);
  return clip([low, rise, high, high, rise], bench, [...pair, ["foot", 8, 191, 122]], 830);
}

function spellCaster(): Illustration {
  const base = pose([[132, 64], [144, 81], [157, 117]], [[152, 106], [137, 122], [162, 101], [174, 109]],
    [[168, 137], standing[1], [148, 135], standing[3]], [[143, 86], [151, 79]]);
  const middle = pose([[149, 51], [154, 68], [157, 112]], [[177, 91], [194, 94], [151, 94], [166, 98]],
    standing, [[164, 71], [148, 68]]);
  const raised = pose([[163, 47], [161, 64], [157, 110]], [[186, 71], [212, 68], [157, 67], [181, 60]],
    standing, [[171, 68], [153, 64]]);
  return clip([base, middle, raised, middle], [], [...pair, ...feet], 860);
}

export const verifiedDumbbellFinalIllustrations: Record<string, Illustration> = {
  "0295": dumbbellClean(),
  "0337": dumbbellExtension("across"),
  "0341": anchoredSideRearFly(),
  "0354": staggeredKickback(false),
  "0373": dumbbellExtension("pronated"),
  "0777": spellCaster(),
  "1684": stepUpCurl(),
  "1729": dumbbellExtension("alternate"),
  "1733": dumbbellExtension("incline"),
  "1742": staggeredKickback(true),
  "2143": armCircleStanding(),
  "2189": dumbbellExtension("backrest"),
  "3320": bentRow(true),
  "3799": bentRow(false),
};
