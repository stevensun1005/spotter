import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Arms = [Point, Point, Point, Point];
type Pair = [Point, Point];
type Body = { torso: [Point, Point, Point]; legs: [Point, Point, Point, Point]; props?: Props };
const stand: Body = { torso: [[154, 44], [153, 60], [153, 104]], legs: [[175, 129], [180, 156], [136, 129], [129, 156]] };
const split: Body = { torso: [[173, 51], [165, 65], [151, 108]], legs: [[181, 125], [194, 156], [135, 130], [116, 155]] };
const seat: Props = [[125, 119, 182, 119], [130, 119, 130, 157], [176, 119, 176, 157], [132, 63, 132, 119]];
const sit: Body = { torso: [[146, 54], [146, 70], [145, 111]], legs: [[177, 116], [183, 155], [166, 119], [171, 155]], props: seat };
const floor: Body = { torso: [[90, 144], [109, 150], [161, 152]], legs: [[187, 124], [193, 155], [178, 127], [181, 154]] };
const bench: Body = { torso: [[91, 110], [109, 117], [160, 120]],
  legs: [[193, 124], [200, 156], [183, 128], [188, 156]],
  props: [[84, 128, 198, 128], [94, 128, 94, 157], [185, 128, 185, 157]],
};
const incline: Body = { torso: [[118, 75], [133, 89], [169, 120]],
  legs: [[196, 127], [204, 156], [184, 128], [190, 157]],
  props: [[113, 85, 165, 127], [165, 127, 193, 127], [124, 95, 124, 156], [177, 127, 177, 156]],
};
const side: Body = { ...bench, torso: [[90, 112], [110, 116], [162, 122]],
  legs: [[196, 123], [226, 123], [194, 125], [224, 128]] };
const pushUp: Body = { torso: [[187, 103], [171, 110], [132, 120]],
  legs: [[108, 136], [82, 151], [101, 139], [79, 153]] };
const tallKneel: Body = { torso: [[143, 65], [145, 81], [145, 115]],
  legs: [[149, 144], [115, 149], [137, 145], [107, 150]] };
const twoDumbbells: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const oneDumbbell: Gear = [["dumbbell", 4, 0, 0]];
const barbell: Gear = [["bar", 4, 6], ["barbell-end", 4, 10, 0], ["barbell-end", 6, -10, 0]];
const fixedBar: Gear = [["bar", 4, 6]];
const farIdle: Pair = [[127, 91], [128, 111]];
const floorArm: Pair = [[128, 119], [151, 114]];
const tower = (x: number, pulley: number): Props => [[x, 23, x, 155], [x - 8, 155, x + 12, 155],
  [x - 4, pulley, x + 5, pulley], [x + 10, 43, x + 10, 150], [x + 10, 127, x + 16, 127], [x + 10, 136, x + 16, 136]];
const midpoint = ([a, b]: Point, [x, y]: Point): Point => [(a + x) / 2, (b + y) / 2];
const shift = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
function pose(setup: Body, arms: Arms): Point[] {
  return [...setup.torso, ...arms, ...setup.legs];
}
function clip(points: Point[][], setup: Body, dynamic: Gear = [], props: Props = [], ms = 1000): Illustration {
  return { frames: points, props: [...(setup.props ?? []), ...props], dynamic, ms, reference: true };
}
function reps(setup: Body, bent: Arms, extended: Arms, dynamic: Gear, props: Props = []): Illustration {
  const locked = pose(setup, extended);
  return clip([pose(setup, bent), locked, locked], setup, dynamic, props);
}

function svend(load: "none" | "plate" | "bottle-upright" | "hammer-weight", setup: Body): Illustration {
  const up = setup === floor || setup === incline;
  const [x, y] = setup.torso[1];
  const arms = (hand: Point, drawBack: boolean): Point[] => {
    const wristA = shift(hand, [4, 1]), wristB = shift(hand, [-4, -1]);
    const elbowA: Point = drawBack ? [x - 4, y + (up ? 9 : 21)] : midpoint([x + 5, y], wristA);
    const elbowB: Point = drawBack ? [x - 12, y + (up ? 6 : 19)] : midpoint([x - 5, y], wristB);
    return [...pose(setup, [elbowA, wristA, elbowB, wristB]), hand];
  };
  const base: Point = setup === floor ? [x + 26, y - 15] : setup === incline ? [x + 19, y - 4] : [x + 21, y + 13];
  const top: Point = setup === floor ? [x + 24, y - 54] : setup === incline ? [x + 47, y - 21] : [x + 51, y + 8];
  const end = arms(top, false);
  const weight: Gear = [["digit", 4, 11, 5], ["digit", 6, 11, 5]];
  if (load !== "none") weight.push([load, 11, 0, 0]);
  return clip([arms(base, true), end, end], setup, weight);
}

const benchFinish: Arms = [[130, 92], [137, 69], [117, 92], [120, 68]];
function california(): Illustration {
  const high = pose(bench, benchFinish);
  const behind: Arms = [[120, 91], [92, 99], [106, 92], [82, 100]];
  const chest: Arms = [[145, 124], [135, 107], [122, 126], [121, 107]];
  return clip([high, pose(bench, behind), pose(bench, chest), high], bench, barbell);
}

function singleBench(kind: "ball" | "side" | "wide"): Illustration {
  const ballBody: Body = { ...bench, torso: [[97, 106], [116, 111], [163, 115]], props: undefined };
  const setup = kind === "ball" ? ballBody : kind === "side" ? side : bench;
  const gear = [...oneDumbbell];
  if (kind === "ball") gear.push(["stability-ball", 1, -7, 27]);
  const [x, y] = setup.torso[1];
  const free: Pair = kind === "side" ? [[101, 124], [87, 125]] : floorArm;
  const start: Arms = kind === "wide" ? [[x + 42, y + 4], [x + 34, y - 17], ...free]
    : [[x + 27, y + 8], [x + 15, y - 12], ...free];
  const end: Arms = [[x + 15, y - 24], [x + 23, y - 48], ...free];
  return reps(setup, start, end, gear, kind === "side" ? [[201, 128, 231, 128]] : []);
}

function sprinter(): Illustration {
  const bent: Arms = [[134, 124], [135, 103], [114, 124], [118, 103]];
  const base = pose(bench, bent);
  const left: Body = { ...bench, legs: [[171, 88], [194, 108], bench.legs[2], bench.legs[3]] };
  const right: Body = { ...bench, legs: [bench.legs[0], bench.legs[1], [164, 90], [185, 108]] };
  return clip([base, pose(left, benchFinish), base, pose(right, benchFinish)], bench, twoDumbbells);
}

function uprightPress(kind: "cuban" | "close" | "plate" | "thoracic" | "behind"): Illustration {
  const setup = kind === "cuban" || kind === "close" ? sit : stand;
  const [x, y] = setup.torso[1];
  const width = kind === "behind" ? 30 : kind === "plate" || kind === "close" ? 5 : 25;
  const form = (ex: number, ey: number, wx: number, wy: number): Arms =>
    [[x + ex, y + ey], [x + wx, y + wy], [x - ex, y + ey], [x - wx, y + wy]];
  const ready = form(kind === "close" ? 14 : 29, 21, width, 2);
  const raised = form(kind === "close" ? 7 : width, -23, width, -43);
  const base = pose(setup, ready), high = pose(setup, raised);
  if (kind === "cuban") {
    const lower = pose(setup, form(14, 22, 17, 44));
    const row = pose(setup, form(33, -1, 28, 19));
    const turn = pose(setup, form(33, -1, 33, -24));
    return clip([lower, row, turn, high, turn, row], setup, twoDumbbells, [], 900);
  }
  if (kind === "behind") {
    const dip: Body = { torso: setup.torso.map((point) => shift(point, [2, 7])) as Body["torso"],
      legs: [[178, 128], stand.legs[1], [132, 128], stand.legs[3]] };
    const set = pose(setup, form(37, 19, 33, -4));
    const dipArms = form(37, 26, 33, 3);
    return clip([set, pose(dip, dipArms), high, high, set], setup, barbell);
  }
  if (kind === "thoracic") {
    const extended: Body = { ...setup, torso: [[144, 38], [146, 54], setup.torso[2]] };
    return { ...clip([[...base, [151, 84]], [...pose(extended, raised), [147, 80]], [...base, [151, 84]]], setup,
      twoDumbbells), spine: [11] };
  }
  if (kind === "plate") return clip([[...base, midpoint(base[4], base[6])], [...high, midpoint(high[4], high[6])]], setup,
    [["plate", 11, 0, 0]]);
  return clip([base, high, high], setup, [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]]);
}

function standingExtension(mode: "high-bar" | "single" | "low-bar" | "seated" | "cross" | "sheet" | "bell" | "weighted" | "lever" | "stretch"): Illustration {
  const upright = mode === "seated" || mode === "weighted" || mode === "lever" ? sit :
    mode === "bell" || mode === "stretch" || mode === "sheet" || mode === "cross" ? stand : split;
  const [x, y] = upright.torso[1];
  const elbowA: Point = [x + 17, y - 25], elbowB: Point = [x - 1, y - 24];
  const a: Point = [x - 8, y - 12], b: Point = [x - 22, y - 12];
  const handA: Point = [x + 27, y - 50], handB: Point = [x + 9, y - 50];
  const single = mode === "single" || mode === "bell" || mode === "sheet" || mode === "stretch";
  const backGrip: Pair = [[x - 21, y + 38], [x - 14, y + 32]];
  const free = mode === "sheet" || mode === "stretch" ? backGrip : farIdle;
  const lower: Arms = [elbowA, a, ...(single ? free : [elbowB, b] as Pair)];
  const high: Arms = mode === "cross" ? [elbowA, [x - 11, y - 48], elbowB, [x + 20, y - 48]]
    : [elbowA, handA, ...(single ? free : [elbowB, handB] as Pair)];
  const bottom = pose(upright, lower), top = pose(upright, high);
  const frames = [bottom, top, top];
  const gear: Gear = [];
  const props: Props = [];
  if (mode === "high-bar" || mode === "low-bar" || mode === "seated" || mode === "single") {
    const anchor = mode === "low-bar" ? 145 : 27;
    props.push(...tower(81, anchor));
    if (single) gear.push(["cable", 4, 84, anchor], ["pad", 4, 0, 0]);
    else {
      gear.push(["cable", 11, 84, anchor], ...(mode === "seated" ? [["pad", 11, 0, 0]] as Gear : fixedBar));
      return clip(frames.map((frame) => [...frame, midpoint(frame[4], frame[6])]), upright, gear, props);
    }
  }
  if (mode === "cross") {
    props.push(...tower(82, 26), ...tower(242, 26));
    gear.push(["cable", 4, 239, 26], ["cable", 6, 85, 26], ["pad", 4, 0, 0], ["pad", 6, 0, 0]);
  }
  if (mode === "sheet") gear.push(["digit", 4, 6, 7]);
  if (mode === "stretch") gear.push(["band", 4, 6]);
  if (mode === "bell") gear.push(["kettlebell", 4, 0, 8]);
  if (mode === "weighted") return clip(frames.map((frame) => [...frame, midpoint(frame[4], frame[6])]), upright, [["plate", 11, 0, 0]]);
  if (mode === "lever") {
    props.push([91, 45, 91, 156], [219, 45, 219, 156], [91, 45, 219, 45], [79, 156, 225, 156]);
    gear.push(["line", 4, 214, 46], ["line", 6, 99, 46], ["pad", 4, 0, 0], ["pad", 6, 0, 0]);
  }
  if (mode === "stretch") {
    const pull = [...bottom];
    pull[4] = shift(a, [-5, 8]);
    pull[6] = shift(backGrip[1], [-1, 6]);
    return clip([bottom, pull, pull, pull], upright, gear, props, 1300);
  }
  return clip(frames, upright, gear, props);
}

function machinePressdown(): Illustration {
  const elbowA: Point = [174, 92], elbowB: Point = [161, 91];
  const props: Props = [[149, 96, 184, 96], [178, 96, 178, 156], [214, 66, 214, 156], [207, 156, 236, 156]];
  const dynamic: Gear = [["line", 4, 207, 103], ["line", 6, 206, 103], ["pad", 4, 0, 0], ["pad", 6, 0, 0], ["plate", 4, 8, 4]];
  return reps(sit, [elbowA, [190, 76], elbowB, [178, 76]], [elbowA, [180, 119], elbowB, [168, 118]], dynamic, props);
}

const anchoredStraps: Props = [[217, 26, 254, 26], [250, 26, 250, 157], [239, 157, 262, 157]];
const strapHands: Gear = [["line", 4, 222, 26], ["line", 6, 242, 26], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
function straps(mode: "extend" | "kickback" | "pull" | "stretch"): Illustration {
  const forward: Body = { torso: [[174, 70], [163, 83], [141, 119]],
    legs: [[115, 137], [102, 154], [107, 141], [94, 155]] };
  const hinged: Body = { torso: [[184, 62], [169, 73], [131, 105]],
    legs: [[136, 132], [142, 156], [119, 133], [119, 156]] };
  if (mode === "extend") {
    return reps(forward, [[189, 55], [174, 42], [176, 57], [164, 45]],
      [[189, 55], [207, 37], [176, 57], [194, 40]], strapHands, anchoredStraps);
  }
  if (mode === "kickback") {
    return reps(hinged, [[144, 94], [173, 96], [136, 94], [160, 97]],
      [[144, 94], [120, 111], [136, 94], [112, 111]], strapHands, anchoredStraps);
  }
  const feet: Body["legs"] = [[148, 125], [173, 156], [138, 127], [161, 156]];
  const hang: Body = { torso: [[111, 53], [120, 68], [146, 112]], legs: feet };
  const target: Body = { torso: [[151, 45], [151, 62], [159, 104]], legs: feet };
  const down: Arms = [[146, 66], [177, 60], [137, 70], [166, 64]];
  const row: Arms = [[131, 82], [157, 71], [126, 85], [150, 74]];
  if (mode === "pull") return clip([pose(hang, down), pose(target, row), pose(hang, down)], hang, strapHands, anchoredStraps, 900);
  const rear: Body = { torso: [[114, 79], [120, 94], [104, 124]],
    legs: [[134, 130], feet[1], [124, 132], feet[3]] };
  const longArms: Arms = [[148, 77], [177, 60], [143, 79], [166, 64]];
  const held = pose(rear, longArms);
  return clip([pose(hang, down), held, held, held], hang, strapHands, anchoredStraps, 1300);
}

function lyingTriceps(upright: boolean): Illustration {
  if (upright) return reps(sit, [[163, 39], [139, 50], [144, 40], [120, 51]],
    [[163, 39], [172, 12], [144, 40], [145, 12]], barbell);
  return reps(bench, [[138, 82], [107, 96], [120, 82], [91, 94]],
    [[138, 82], [140, 54], [120, 82], [120, 54]], barbell);
}

function benchPike(raised: boolean): Illustration {
  const feet: Pair = raised ? [[70, 102], [63, 103]] : [[73, 154], [65, 156]];
  const hands: Pair = [[194, 122], [174, 118]];
  const at = (pressed: boolean) => {
    const hip: Point = pressed ? [126, 68] : [134, 73];
    const setup: Body = {
      torso: pressed ? [[180, 89], [167, 87], hip] : [[194, 136], [180, 117], hip],
      legs: [[101, raised ? 83 : 109], feet[0], [97, raised ? 86 : 111], feet[1]],
    };
    const neck = setup.torso[1];
    return pose(setup, pressed ?
      [midpoint(neck, hands[0]), hands[0], midpoint(neck, hands[1]), hands[1]] :
      [[201, 103], hands[0], [165, 104], hands[1]]);
  };
  const supports: Props = [[180, 123, 211, 123], [187, 123, 187, 157], [207, 123, 207, 157],
    [154, 119, 181, 119], [160, 119, 160, 157], [175, 119, 175, 157]];
  if (raised) supports.push([49, 104, 89, 104], [55, 104, 55, 157], [85, 104, 85, 157]);
  return clip([at(true), at(false), at(true)], stand, [], supports);
}

function pushUpVariant(mode: "diamond" | "bell" | "planche"): Illustration {
  const hands: Pair = mode === "diamond" ? [[188, 150], [183, 149]]
    : mode === "bell" ? [[194, 131], [174, 126]] : [[166, 153], [151, 152]];
  const at = (stage: number): Point[] => {
    const lowered = stage === 1, airborne = mode === "planche" && lowered;
    const body: Body = mode === "planche" ? { ...pushUp,
      torso: airborne ? [[228, 109], [205, 111], [149, 118]] : [[213, 113], [191, 118], [144, 129]],
      legs: airborne ? [[118, 123], [82, 129], [111, 126], [76, 132]] : pushUp.legs } : lowered ?
        { ...pushUp, torso: [[196, 131], [174, 135], [127, 143]],
          legs: [[103, 147], pushUp.legs[1], [96, 150], pushUp.legs[3]] } : pushUp;
    const neck = body.torso[1];
    const elbows: Pair = mode !== "planche" && lowered ? [[161, 122], [153, 126]]
      : [midpoint(neck, hands[0]), midpoint(neck, hands[1])];
    return [...pose(body, [elbows[0], hands[0], elbows[1], hands[1]]), [194, 151], [174, 146],
      [193, 147], [184, 143], [177, 146], [185, 153]];
  };
  const gear: Gear = mode === "bell" ? [["handled-bell", 4, 11], ["handled-bell", 6, 12]] :
    mode === "diamond" ? [["digit", 4, 13], ["digit", 6, 15], ["digit", 13, 14], ["digit", 14, 15], ["digit", 15, 16], ["digit", 16, 13]] : [];
  const high = at(0), low = at(1);
  return clip(mode === "planche" ? [high, low, low, high] : [high, low, high], pushUp, gear);
}

function rings(kind: "pullover" | "cat"): Illustration {
  const hands: Pair = [[179, 69], [142, 65]];
  const at = (torso: Body["torso"], legs: Body["legs"], elbows: Pair) => pose({ torso, legs },
    [elbows[0], hands[0], elbows[1], hands[1]]);
  const hang = at([[159, 89], [158, 102], [155, 130]], [[156, 143], [158, 156], [148, 144], [148, 157]],
    [[169, 87], [151, 85]]);
  const tuck = at([[156, 106], [159, 94], [170, 59]], [[194, 56], [187, 77], [189, 49], [185, 70]], [[173, 79], [151, 76]]);
  const through = at([[157, 99], [166, 90], [193, 64]], [[199, 37], [174, 45], [192, 37], [168, 49]],
    [[171, 76], [153, 78]]);
  const german = at([[191, 114], [181, 107], [159, 127]], [[154, 143], [155, 153], [147, 142], [146, 155]],
    [[180, 90], [160, 86]]);
  const support = at([[162, 26], [161, 39], [159, 72]], [[163, 97], [164, 118], [153, 100], [152, 120]],
    [[172, 51], [150, 50]]);
  const rolling = at([[119, 55], [137, 59], [169, 62]], [[194, 52], [207, 66], [188, 55], [201, 70]],
    [[165, 63], [153, 61]]);
  const frames = kind === "cat" ? [hang, tuck, through, german, german, through, tuck] :
    [hang, tuck, through, rolling, support, support, rolling, through, tuck];
  return clip(frames, stand, [["line", 4, 181, 15], ["line", 6, 140, 15], ["ring", 4, 0, 0], ["ring", 6, 0, 0]],
    [[96, 15, 227, 15]], 900);
}

function barsStretch(): Illustration {
  const start: Body = { torso: [[139, 60], [144, 74], [148, 115]],
    legs: [[146, 137], [152, 156], [133, 138], [138, 156]] };
  const bent: Body = { torso: [[148, 108], [134, 109], [101, 126]],
    legs: [[93, 146], [85, 155], [84, 147], [75, 156]] };
  const hands: Pair = [[174, 99], [161, 88]];
  const high: Arms = [[153, 88], hands[0], [145, 82], hands[1]];
  const low: Arms = [[153, 104], hands[0], [149, 99], hands[1]];
  return clip([pose(start, high), pose(bent, low), pose(bent, low), pose(bent, low)], start, [],
    [[149, 100, 223, 100], [216, 100, 216, 156], [155, 100, 155, 156], [142, 89, 215, 89], [205, 89, 205, 156]], 1300);
}

function reformer(): Illustration {
  const low: Arms = [[164, 93], [183, 110], [155, 93], [173, 109]];
  const extended: Arms = [[135, 104], [112, 120], [129, 101], [105, 119]];
  const left: Body = { ...tallKneel, torso: [[134, 66], tallKneel.torso[1], tallKneel.torso[2]] };
  const right: Body = { ...tallKneel, torso: [[150, 65], tallKneel.torso[1], tallKneel.torso[2]] };
  return clip([pose(tallKneel, low), pose(tallKneel, extended), pose(left, extended), pose(right, extended), pose(tallKneel, low)],
    tallKneel, [["line", 4, 231, 146], ["line", 6, 222, 140], ["pad", 4, 0, 0], ["pad", 6, 0, 0]],
    [[77, 150, 248, 150], [80, 155, 244, 155], [87, 155, 87, 159], [239, 155, 239, 159], [97, 147, 164, 147],
      [231, 117, 231, 148], [224, 142, 235, 142]]);
}

function wallSlide(): Illustration {
  const setup: Body = { torso: [[121, 42], [125, 58], [122, 105]],
    legs: [[132, 129], [138, 156], [115, 131], [110, 156]] };
  const surface: Props = [[163, 37, 244, 27], [244, 27, 244, 156], [163, 37, 163, 156], [163, 156, 244, 156]];
  return reps(setup, [[142, 92], [173, 78], [114, 87], [114, 112]],
    [[166, 66], [212, 72], [114, 87], [114, 112]], [["pad", 4, 4, 0]], surface);
}

const inclineSvend = svend("plate", incline);
const suspensionExtension = straps("extend");
const leverElbowExtension = machinePressdown();
export const compoundUpperIllustrations: Readonly<Record<string, Illustration>> = {
  "4857": uprightPress("behind"),
  "9930": california(),
  "5077": svend("none", stand),
  "6058": svend("bottle-upright", stand),
  "3915": benchPike(true),
  "1989": barsStretch(),
  "4539": pushUpVariant("diamond"),
  "0357": singleBench("ball"),
  "5816": singleBench("side"),
  "3333": singleBench("wide"),
  "4237": uprightPress("close"),
  "4183": uprightPress("cuban"),
  "5284": sprinter(),
  "6964": uprightPress("thoracic"),
  "3452": svend("hammer-weight", stand),
  "4521": pushUpVariant("bell"),
  "7864": standingExtension("lever"),
  "1033": leverElbowExtension,
  "2198": leverElbowExtension,
  "10550": svend("plate", floor),
  "3745": standingExtension("sheet"),
  "3904": benchPike(false),
  "10855": reformer(),
  "10664": pushUpVariant("planche"),
  "10741": standingExtension("stretch"),
  "8750": rings("pullover"),
  "10663": rings("cat"),
  "10927": wallSlide(),
  "1225": uprightPress("plate"),
  "1150": straps("kickback"),
  "1086": straps("pull"),
  "7278": straps("stretch"),
  "5876": suspensionExtension,
  "1104": suspensionExtension,
  "4803": lyingTriceps(true),
  "4804": lyingTriceps(false),
  "5068": inclineSvend,
  "4092": standingExtension("weighted"),
  "0856": svend("plate", stand),
  "3040": standingExtension("high-bar"),
  "3353": standingExtension("single"),
  "4115": standingExtension("low-bar"),
  "5916": standingExtension("seated"),
  "5528": standingExtension("cross"),
  "5863": standingExtension("bell"),
};
