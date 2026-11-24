import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Resistance = "free" | "dumbbell" | "handles" | "cuffs";
const stand: Point[] = [[159, 43], [159, 65], [159, 107], [172, 92], [176, 120],
  [146, 92], [142, 120], [173, 132], [178, 156], [145, 132], [140, 156]];
const lean: Point[] = [[190, 68], [173, 80], [131, 110], [179, 105], [183, 131],
  [164, 105], [168, 129], [143, 133], [144, 156], [127, 133], [126, 156]];
const chestSupported: Point[] = [[182, 49], [174, 67], [143, 106], [178, 97], [183, 127],
  [156, 95], [158, 125], [151, 128], [155, 157], [131, 128], [127, 157]];
const inclineBench: Props = [[137, 110, 174, 64], [138, 110, 118, 110], [121, 112, 121, 158], [167, 74, 183, 158]];
const setJoints = (pose: Point[], changes: Partial<Record<number, Point>>) => pose.map((p, i) => changes[i] ?? p);

function raise(setup: "standing" | "hinge" | "incline", gear: Resistance, single = false, crossed = false): Illustration {
  const body = setup === "standing" ? stand : setup === "incline" ? chestSupported : lean;
  const props: Props = setup === "incline" ? [...inclineBench] : [];
  const start = crossed ? setJoints(body, { 3: [161, 90], 4: [142, 112], 5: [155, 93], 6: [176, 112] }) : body;
  const rest = single ? setJoints(start, { 5: [159, 87], 6: [169, 76] }) : start;
  const upper: Point[] = setup === "standing"
    ? setJoints(rest, { 3: [176, 46], 4: [194, 26], ...(single ? {} : { 5: [141, 46] as Point, 6: [125, 25] as Point }) })
    : setJoints(rest, { 3: [195, 59], 4: [221, 45], ...(single ? {} : { 5: [158, 54] as Point, 6: [151, 31] as Point }) });
  const fixtures: Attachments = [];
  const cables = gear === "handles" || gear === "cuffs";
  if (cables) {
    const posts = single ? [94] : [86, 241];
    for (const x of posts) props.push([x, 35, x, 156], [x - 8, 157, x + 8, 157]);
    fixtures.push(["cable", 4, crossed ? 86 : posts.at(-1)!, 146]);
    if (!single) fixtures.push(["cable", 6, crossed ? 241 : 86, 146]);
    if (gear === "cuffs") {
      fixtures.push(["head-strap", 4, 0, 0]);
      if (!single) fixtures.push(["head-strap", 6, 0, 0]);
    } else {
      fixtures.push(["ring", 4, 0, 1]);
      if (!single) fixtures.push(["ring", 6, 0, 1]);
    }
  }
  if (gear === "dumbbell") {
    fixtures.push(["dumbbell", 4, 0, 0]);
    if (!single) fixtures.push(["dumbbell", 6, 0, 0]);
  }
  return { frames: [rest, upper, upper], props, dynamic: fixtures, ms: 975, reference: true };
}

function proneY(brief = false): Illustration {
  const flat: Point[] = [[151, 70], [151, 88], [151, 120], [169, 75], [184, 57], [134, 75], [119, 57],
    [161, 135], [165, 150], [142, 135], [138, 150]];
  const peak = setJoints(flat, { 3: [170, 71], 4: [190, 50], 5: [132, 71], 6: [112, 50] });
  return { frames: brief ? [flat, peak] : [flat, peak, peak], props: [[93, 47, 209, 47], [209, 47, 209, 156],
    [209, 156, 93, 156], [93, 156, 93, 47]], topView: true, ms: 1000, reference: true };
}

function facePull(style: "supine" | "hinge" | "towel"): Illustration {
  if (style === "hinge") return { frames: [lean, setJoints(lean, { 3: [169, 57], 4: [193, 73], 5: [151, 65], 6: [176, 71] })],
    dynamic: [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]], ms: 1000, reference: true };
  if (style === "towel") {
    const rest: Point[] = [[127, 53], [135, 76], [146, 112], [157, 72], [184, 68],
      [153, 78], [176, 74], [164, 135], [171, 157], [152, 137], [155, 157]];
    const pulled = setJoints(rest, { 0: [154, 51], 1: [153, 71], 3: [144, 88], 4: [166, 59], 5: [135, 82], 6: [150, 62] });
    return { frames: [rest, pulled], props: [[244, 23, 244, 158], [230, 158, 254, 158]],
      dynamic: [["cable", 4, 244, 67], ["cable", 6, 244, 72]], ms: 1020, reference: true };
  }
  const base: Point[] = [[119, 110], [140, 118], [187, 119], [127, 90], [112, 66],
    [129, 85], [114, 63], [212, 119], [221, 156], [204, 119], [204, 156]];
  const contracted = setJoints(base, { 3: [151, 99], 4: [124, 93], 5: [145, 91], 6: [115, 91] });
  const frames = [base, contracted].map((f): Point[] => [...f, [(f[4][0] + f[6][0]) / 2 - 10, (f[4][1] + f[6][1]) / 2 - 11]]);
  return { frames, props: [[92, 27, 92, 159], [77, 30, 77, 159], [77, 27, 92, 27], [111, 122, 205, 122],
    [117, 123, 117, 158], [199, 123, 199, 158]],
  dynamic: [["cable", 11, 92, 36], ["line", 11, 4], ["line", 11, 6]], ms: 1060, reference: true };
}

type WindmillLoad = "free" | "high" | "low";
function windmill(load: WindmillLoad, pause = false): Illustration {
  const upright: Point[] = [[161, 43], [157, 60], [160, 102], [166, 38], [166, 17], [143, 87], [142, 110],
    [177, 129], [187, 156], [140, 131], [125, 156]];
  const bent: Point[] = [[131, 80], [134, 89], [163, 106], [140, 67], [140, 47], [130, 114], [126, 142],
    [177, 129], [187, 156], [140, 132], [125, 156]];
  const dynamic: Attachments = [["foot", 8, 198, 157], ["foot", 10, 113, 157]];
  if (load !== "free") dynamic.push(["dumbbell", load === "high" ? 4 : 6, 0, 0]);
  return { frames: pause ? [upright, bent, bent] : [upright, bent], dynamic, ms: 1070, reference: true };
}

function hangingWindmill(): Illustration {
  const base: Point[] = [[156, 66], [156, 86], [156, 123], [173, 56], [181, 35], [139, 56], [131, 35],
    [166, 140], [169, 156], [150, 140], [147, 156]];
  return { frames: [base, setJoints(base, { 7: [173, 117], 8: [197, 103], 9: [169, 124], 10: [194, 112] }),
    setJoints(base, { 7: [158, 101], 8: [158, 77], 9: [147, 103], 10: [147, 79] }),
    setJoints(base, { 7: [140, 118], 8: [118, 106], 9: [135, 122], 10: [111, 111] })],
  props: [[108, 35, 207, 35], [108, 35, 108, 159], [207, 35, 207, 159]], ms: 1000, reference: true };
}

export const shoulderRaiseIllustrations: Readonly<Record<string, Illustration>> = {
  "3908": windmill("free"),
  "9870": raise("incline", "handles", true),
  "9871": raise("incline", "cuffs", true),
  "8661": raise("incline", "handles"),
  "8663": raise("incline", "cuffs"),
  "7591": facePull("supine"),
  "8899": raise("standing", "handles"),
  "3342": raise("standing", "handles", false, true),
  "5665": facePull("hinge"),
  "7995": raise("hinge", "dumbbell"),
  "7231": raise("incline", "dumbbell", true),
  "4746": windmill("low"),
  "4888": windmill("high", true),
  "4901": windmill("high"),
  "4891": hangingWindmill(),
  "6350": proneY(),
  "5822": proneY(true),
  "7745": facePull("towel"),
  "3403": raise("standing", "free"),
};
