import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const lower: Point[] = [[91, 150], [109, 151], [152, 150], [82, 150], [55, 150], [85, 145], [58, 144],
  [193, 150], [237, 155], [186, 147], [229, 151]];
const revise = (pose: Point[], data: Partial<Record<number, Point>>) => pose.map((p, i) => data[i] ?? p);
const pass = (pose: Point[], a: number, b: number): Point => [(pose[a][0] + pose[b][0]) / 2, (pose[a][1] + pose[b][1]) / 2];
const motion = (frames: Point[][], dynamic: Attachments = [], props: Props = [], ms = 815): Illustration => ({
  frames, dynamic, props, ms, reference: true,
});

type VMove = "normal" | "double" | "clap" | "single" | "oblique" | "side-lying" | "frog" | "jackknife" | "jack-split" | "pass-ball";
function vMove(kind: VMove, load: "none" | "one" | "two" = "none"): Illustration {
  const open = revise(lower, { 0: [89, 145], 1: [106, 146], 3: [81, 143], 4: [57, 142],
    5: [79, 138], 6: [55, 135], 7: [193, 145], 8: [235, 148], 9: [189, 142], 10: [232, 144] });
  const sideOpen = revise(open, { 5: [93, 154], 6: [72, 153] });
  const top = revise(lower, { 0: [132, 86], 1: [139, 105], 3: [166, 94], 4: [192, 86], 5: [162, 91], 6: [186, 80],
    7: [177, 120], 8: [195, 87], 9: [175, 115], 10: [188, 81] });
  const openTorso = revise(top, { 0: [121, 106], 1: [132, 121], 3: [155, 110], 4: [181, 99], 5: [157, 107], 6: [176, 94] });
  const singleNear = revise(top, { 9: [190, 147], 10: [234, 151] });
  const singleFar = revise(top, { 7: [192, 149], 8: [236, 153], 9: [170, 114], 10: [187, 82] });
  const left = revise(top, { 0: [117, 89], 1: [128, 107], 3: [146, 94], 4: [173, 81],
    5: [144, 91], 6: [169, 78], 7: [170, 120], 8: [184, 88], 9: [163, 114], 10: [178, 83] });
  const right = revise(top, { 0: [139, 87], 1: [143, 106], 3: [172, 93], 4: [199, 91],
    5: [166, 89], 6: [195, 85], 7: [186, 124], 8: [204, 94], 9: [183, 120], 10: [200, 89] });
  const side = revise(top, { 0: [119, 103], 1: [130, 120], 3: [152, 106], 4: [182, 110], 5: [118, 143], 6: [96, 151],
    7: [186, 132], 8: [216, 111], 9: [182, 130], 10: [213, 108] });
  const frog = revise(top, { 0: [119, 112], 1: [135, 126], 3: [160, 121], 4: [185, 117],
    5: [153, 120], 6: [178, 117], 7: [171, 117], 8: [194, 137], 9: [167, 112], 10: [189, 133] });
  const clap = revise(top, { 4: [188, 84], 6: [188, 84] });
  const split = revise(top, { 7: [190, 122], 8: [221, 104], 9: [157, 113], 10: [140, 83] });
  const up = revise(lower, { 3: [136, 152], 4: [163, 155], 5: [131, 148], 6: [155, 150],
    7: [156, 113], 8: [158, 75], 9: [152, 112], 10: [152, 77] });
  const sideHands = revise(lower, { 3: up[3], 4: up[4], 5: up[5], 6: up[6] });
  const peel = revise(up, { 2: [145, 134], 7: [145, 98], 8: [147, 60], 9: [141, 97], 10: [141, 59] });
  const sequence: Record<VMove, Point[][]> = {
    normal: [open, top, top], double: [open, top, openTorso, top], clap: [open, top, clap, top],
    single: [open, singleNear, open, singleFar], oblique: [open, left, open, right], "side-lying": [sideOpen, side, side],
    frog: [open, frog, frog], jackknife: [sideHands, up, peel, top, peel, up], "jack-split": [open, split, split],
    "pass-ball": [lower, clap, lower, clap],
  };
  const dynamic: Attachments = load === "two" ? [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]]
    : load === "one" ? [["dumbbell", 11, 0, 0]] : [];
  if (kind === "pass-ball") dynamic.push(["stability-ball", 11, 0, -16]);
  return motion(sequence[kind].map((p, i) => [...p, kind === "pass-ball" && i === 2 ? pass(p, 8, 10) : pass(p, 4, 6)]),
    dynamic, [], kind === "pass-ball" ? 1120 : 840);
}

function cycling(seated: boolean, running = false): Illustration {
  const shoulder: Point = seated ? [126, 105] : [112, 135];
  const hip: Point = [152, 151];
  const frame = (near: boolean): Point[] => {
    const turnX = near ? 5 : -4;
    const neck: Point = [shoulder[0] + turnX, shoulder[1] - 4];
    const head: Point = [neck[0] - 12, neck[1] - 14];
    const curling: Point = [neck[0] + (running ? 32 : 27), neck[1] + (seated ? 14 : -9)];
    const opposite: Point = [neck[0] - 5, neck[1] - 9];
    const bent: [Point, Point] = [[seated ? 171 : 167, seated ? 113 : 109], [193, 134]];
    const extended: [Point, Point] = [[190, seated ? 136 : 144], [226, seated ? 135 : 148]];
    return [head, neck, hip, near ? opposite : curling, [head[0] - 4, head[1] + 2],
      near ? curling : opposite, [head[0] + 6, head[1] + 1], ...(near ? bent : extended), ...(near ? extended : bent)];
  };
  return motion([frame(true), frame(false)], [], [], running ? 575 : 750);
}

function bentTuck(style: "cable" | "ez-sit" | "oblique", alternating = true): Illustration {
  const hands: [Point, Point] = [[112, 100], [104, 98]];
  const base = style === "cable" ? revise(lower, { 3: [133, 153], 4: [162, 154], 5: [130, 149], 6: [157, 150] })
    : style === "ez-sit" ? revise(lower, { 3: [112, 126], 4: hands[0], 5: [104, 124], 6: hands[1],
      7: [176, 119], 8: [195, 154], 9: [167, 120], 10: [188, 153] })
      : revise(lower, { 3: [105, 134], 4: [86, 140], 5: [97, 130], 6: [84, 135],
        7: [155, 112], 8: [159, 75], 9: [150, 111], 10: [154, 73] });
  const at = (near: boolean) => style === "cable"
    ? revise(base, near ? { 7: [132, 113], 8: [165, 124] } : { 9: [134, 109], 10: [166, 121] })
    : style === "ez-sit" ? revise(base, { 0: [128, 64], 1: [130, 83], 3: [146, 73], 4: [148, 53], 5: [125, 68], 6: [129, 52],
      7: [near ? 169 : 150, 119], 8: [near ? 197 : 177, 146], 9: [near ? 179 : 161, 122], 10: [near ? 202 : 181, 144] })
      : revise(base, { 0: [98, 121], 1: [115 + (near ? 5 : -4), 134], 3: [124, 119], 4: [98, 117], 5: [102, 114], 6: [91, 121],
        7: [near ? 139 : 177, 120], 8: [near ? 124 : 198, 84], 9: [near ? 135 : 173, 117], 10: [near ? 121 : 193, 81] });
  const legs: Attachments = [["cable", 8, 264, 149], ["cable", 10, 264, 149], ["pad", 8, 0, 0], ["pad", 10, 0, 0]];
  const ez: Attachments = [["ez-bar", 4, 6], ["plate", 4, 5, 0], ["plate", 6, -5, 0]];
  return motion([base, at(true), base, ...(alternating ? [at(false)] : [])],
    style === "cable" ? legs : style === "ez-sit" ? ez : [],
    style === "cable" ? [[264, 25, 264, 157], [253, 157, 276, 157], [256, 149, 267, 149]] : []);
}

function steadyCore(style: "floor-hollow" | "hang-hollow" | "boat" | "stretch"): Illustration {
  const hanging = style === "hang-hollow";
  const floor = style === "floor-hollow";
  const neutral: Point[] = hanging
    ? [[151, 48], [150, 66], [151, 105], [165, 46], [174, 20], [134, 47], [126, 20],
      [157, 129], [161, 151], [146, 127], [151, 149]]
    : floor ? lower : [[132, 89], [133, 108], [149, 153], [141, 133], [127, 155], [131, 131], [116, 153],
      [171, 125], [189, 154], [164, 123], [179, 152]];
  const set = hanging ? revise(neutral, { 0: [146, 46], 1: [147, 65], 2: [152, 104],
    7: [170, 123], 8: [187, 147], 9: [161, 121], 10: [177, 144] })
    : floor ? revise(lower, { 0: [90, 128], 1: [107, 136], 3: [84, 131], 4: [59, 125],
      5: [83, 130], 6: [57, 124], 7: [190, 144], 8: [233, 140], 9: [187, 143], 10: [229, 137] })
      : revise(neutral, { 3: [155, 117], 4: [183, 118], 5: [153, 114], 6: [177, 113],
        7: [170, 119], 8: [188, 87], 9: [165, 118], 10: [183, 84] });
  const fixture: Props = hanging ? [[100, 20, 211, 20], [106, 20, 106, 156], [205, 20, 205, 156]] : [];
  const frames = [neutral, ...Array<Point[]>(style === "stretch" ? 8 : 16).fill(set), neutral];
  return floor
    ? { ...motion(frames.map(p => [...p, [134, 152] as Point])), spine: [11] }
    : motion(frames, [], fixture, 1130);
}

function heelReach(raised: boolean): Illustration {
  const setup = revise(lower, { 0: [105, 129], 1: [125, 143], 2: [156, 151],
    3: [142, 147], 4: [159, 149], 5: [139, 140], 6: [157, 141],
    7: [raised ? 159 : 183, raised ? 117 : 118], 8: [raised ? 194 : 190, raised ? 117 : 155],
    9: [raised ? 149 : 172, raised ? 113 : 114], 10: [raised ? 185 : 181, raised ? 113 : 152] });
  const right = revise(setup, { 0: [116, 124], 1: [133, 137], 3: [164, 141],
    4: [setup[8][0] - 4, setup[8][1] - 3] });
  const left = revise(setup, { 0: [113, 122], 1: [130, 135], 5: [163, 136],
    6: [setup[10][0] - 4, setup[10][1] - 3] });
  return motion([setup, right, setup, left], [], [], 780);
}

function quadrupedReach(thread: boolean): Illustration {
  const setup: Point[] = [[175, 105], [159, 112], [116, 116], [163, 133], [165, 155], [153, 131], [155, 153],
    [117, 152], [88, 155], [106, 151], [79, 154]];
  if (!thread) {
    const brace = revise(setup, { 2: [116, 115], 1: [159, 111] });
    return motion([setup, ...Array<Point[]>(10).fill(brace), setup], [], [], 1050);
  }
  const lower = revise(setup, { 0: [174, 143], 1: [157, 142], 3: [136, 147], 4: [111, 153],
    5: [155, 130], 6: [155, 153] });
  const lifted = revise(setup, { 0: [169, 92], 1: [158, 108], 3: [146, 83], 4: [139, 60] });
  const otherLower = revise(lower, { 3: [165, 133], 4: [165, 155], 5: [132, 145], 6: [108, 150] });
  const otherUp = revise(setup, { 0: [176, 93], 5: [151, 83], 6: [145, 55] });
  return motion([setup, lower, lower, setup, lifted, setup, otherLower, otherLower, setup, otherUp], [], [], 780);
}

function abPress(): Illustration {
  const extended = revise(lower, { 0: [91, 144], 1: [108, 146], 7: [193, 145], 8: [235, 145],
    9: [188, 142], 10: [229, 142] });
  const curl = revise(extended, { 0: [109, 109], 1: [121, 127], 3: [144, 126], 4: [163, 108],
    5: [140, 123], 6: [159, 104], 7: [161, 103], 8: [193, 125], 9: [155, 100], 10: [187, 122] });
  return motion([extended, curl, curl], [], [], 820);
}

function rolloverToV(): Illustration {
  const seat: Point[] = [[138, 85], [141, 103], [147, 150], [163, 118], [186, 114], [160, 117], [180, 109],
    [175, 120], [190, 154], [165, 121], [182, 151]];
  const middle = revise(seat, { 0: [115, 104], 1: [125, 121], 2: [151, 149],
    7: [163, 118], 8: [177, 145], 9: [157, 114], 10: [170, 139] });
  const rolled = revise(seat, { 0: [90, 141], 1: [108, 145], 2: [132, 105], 3: [122, 135], 4: [147, 127],
    5: [116, 133], 6: [141, 123], 7: [123, 75], 8: [98, 54], 9: [117, 73], 10: [92, 54] });
  const balanced = revise(seat, { 3: [166, 101], 4: [192, 86], 5: [162, 98], 6: [187, 81],
    7: [176, 116], 8: [204, 86], 9: [171, 112], 10: [198, 82] });
  return motion([seat, middle, rolled, middle, balanced, balanced, seat], [], [], 810);
}

function suspensionCore(kind: "tuck" | "twist" | "pike" | "rollout"): Illustration {
  const base: Point[] = [[201, 104], [183, 112], [141, 125], [182, 131], [183, 155], [175, 132], [173, 154],
    [104, 135], [73, 144], [99, 137], [66, 146]];
  const tuck = revise(base, { 2: [145, 104], 7: [153, 126], 8: [124, 145], 9: [144, 130], 10: [116, 145] });
  const near = revise(tuck, { 2: [151, 103], 7: [165, 133], 8: [134, 149], 9: [153, 127], 10: [127, 144] });
  const far = revise(tuck, { 2: [142, 102], 7: [147, 122], 8: [119, 145], 9: [157, 121], 10: [130, 140] });
  const pike = revise(base, { 0: [194, 103], 1: [176, 111], 2: [149, 66],
    7: [117, 102], 8: [87, 135], 9: [110, 106], 10: [78, 137] });
  const kneel: Point[] = [[160, 75], [149, 89], [131, 120], [173, 100], [197, 107], [168, 99], [189, 103],
    [129, 151], [96, 154], [120, 151], [86, 154]];
  const reach = (side: number) => revise(kneel, { 0: [185 + side, 100], 1: [169 + side, 109], 2: [143, 127],
    3: [189 + side, 111 - side], 4: [215 + side, 114 - side], 5: [183 + side, 111 + side],
    6: [206 + side, 115 + side] });
  const fixture: Props = kind === "rollout" ? [[72, 19, 245, 19], [240, 19, 240, 158]] : [[60, 19, 244, 19], [63, 19, 63, 158]];
  const straps: Attachments = kind === "rollout" ? [["line", 4, 233, 19], ["line", 6, 222, 19], ["ring", 4, 0, 0], ["ring", 6, 0, 0]]
    : [["line", 8, 70, 19], ["line", 10, 81, 19], ["ring", 8, 0, 1], ["ring", 10, 0, 1]];
  const trackStrap = (foot: Point, anchorX: number, length: number): Point => [
    foot[0], 19 + Math.sqrt(Math.max(0, length ** 2 - (foot[0] - anchorX) ** 2)),
  ];
  const plankFrames = kind === "twist" ? [base, near, base, far] : [base, kind === "pike" ? pike : tuck];
  const frames = kind === "rollout" ? [kneel, reach(7), kneel, reach(-7)] : plankFrames.map(p => revise(p, {
    8: trackStrap(p[8], 70, 126), 10: trackStrap(p[10], 81, 128),
  }));
  return motion(frames, straps, fixture);
}

function ballCrunch(): Illustration {
  const reclined: Point[] = [[97, 104], [116, 120], [159, 125], [94, 116], [97, 105], [93, 110], [95, 101],
    [193, 117], [199, 156], [184, 117], [185, 155]];
  const up = revise(reclined, { 0: [111, 74], 1: [124, 89], 3: [110, 93], 4: [110, 76], 5: [106, 88], 6: [107, 73] });
  const lift = (near: boolean) => revise(up, near ? { 7: [193, 117], 8: [223, 102] } : { 9: [184, 118], 10: [219, 99] });
  return motion([reclined, lift(true), reclined, lift(false)].map(p => [...p, [143, 142] as Point]),
    [["stability-ball", 11, 0, 0]]);
}

function starfish(advanced: boolean): Illustration {
  const spread: Point[] = [[146, 44], [147, 62], [148, 100], [179, 67], [215, 62], [117, 67], [83, 62],
    [179, 128], [211, 153], [117, 128], [84, 153]];
  const close = revise(spread, { 0: [148, 57], 1: [148, 77],
    3: [advanced ? 152 : 169, 102], 4: [advanced ? 159 : 153, advanced ? 126 : 82],
    5: [advanced ? 145 : 128, 102], 6: [advanced ? 142 : 146, advanced ? 126 : 82],
    7: [advanced ? 157 : 171, advanced ? 124 : 105], 8: [advanced ? 162 : 194, advanced ? 152 : 128],
    9: [advanced ? 141 : 126, advanced ? 124 : 105], 10: [advanced ? 136 : 105, advanced ? 152 : 128] });
  const mat: Props = [[71, 24, 227, 24], [227, 24, 227, 163], [227, 163, 71, 163], [71, 163, 71, 24]];
  return { ...motion([spread, close, close], [], mat), topView: true };
}

function sideTuck(): Illustration {
  const plank: Point[] = [[94, 88], [112, 98], [162, 120], [111, 148], [139, 155], [140, 99], [159, 115],
    [196, 132], [230, 142], [197, 139], [232, 156]];
  const tucked = revise(plank, { 7: [143, 89], 8: [163, 109] });
  return motion([plank, tucked, tucked]);
}

function floorFormCheck(style: "plain" | "negative" | "twisting" = "plain"): Illustration {
  const set = revise(lower, { 3: [98, 132], 4: [87, 139], 5: [90, 132], 6: [85, 136],
    7: [177, 119], 8: [202, 154], 9: [171, 119], 10: [192, 153] });
  const curling = revise(set, { 0: [95, 124], 1: [112, 134], 3: [103, 114], 4: [94, 117], 5: [92, 112], 6: [86, 116] });
  const extend = (p: Point[], y = 151) => [...p, [133, y] as Point];
  const flat = extend(set);
  const up = extend(curling);
  const near = extend(revise(curling, { 0: [99, 124], 1: [117, 135], 3: [140, 121], 4: [102, 116], 5: [89, 117], 6: [98, 115] }));
  const far = extend(revise(curling, { 0: [92, 124], 1: [109, 133], 3: [89, 118], 4: [96, 117], 5: [129, 121], 6: [94, 116] }));
  const lowerHalf = (fraction: number): Point[] => up.map(([x, y], i) =>
    [x + (flat[i][0] - x) * fraction, y + (flat[i][1] - y) * fraction]);
  const frames = style === "negative" ? [flat, up, up, lowerHalf(.25), lowerHalf(.5), lowerHalf(.75)]
    : style === "twisting" ? [flat, near, flat, far] : [flat, up, up];
  return { ...motion(frames, [], [], style === "negative" ? 740 : 815), spine: [11] };
}

export const floorCoreVariantIllustrations: Record<string, Illustration> = {
  "4007": heelReach(true), "6428": heelReach(false), "4348": quadrupedReach(false), "4556": quadrupedReach(true),
  "4459": abPress(), "2572": rolloverToV(), "0003": cycling(false),
  "5265": cycling(true), "5250": cycling(false), "3865": cycling(false, true),
  "4279": steadyCore("stretch"), "5344": steadyCore("boat"),
  "6547": steadyCore("hang-hollow"), "1246": steadyCore("floor-hollow"), "9486": steadyCore("floor-hollow"),
  "11262": bentTuck("cable"), "4187": bentTuck("ez-sit"), "5032": bentTuck("oblique"),
  "2344": floorFormCheck(), "3510": vMove("frog"),
  "0634": floorFormCheck("negative"), "4354": floorFormCheck("twisting"), "4620": floorFormCheck("twisting"),
  "6805": vMove("single", "two"), "6799": vMove("oblique", "one"),
  "3336": vMove("normal", "one"), "4250": vMove("normal", "one"),
  "0502": vMove("normal"),
  "0505": vMove("jack-split"), "6103": vMove("jackknife"), "3515": vMove("side-lying"),
  "4002": vMove("double"), "2815": vMove("pass-ball"), "4003": vMove("clap"),
  "3606": ballCrunch(), "2889": starfish(true), "3813": starfish(false),
  "0702": sideTuck(), "1112": suspensionCore("tuck"), "1122": suspensionCore("rollout"),
  "1106": suspensionCore("twist"), "1082": suspensionCore("tuck"), "1081": suspensionCore("pike"),
};
