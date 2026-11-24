import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Action = "rotate" | "bend" | "flex" | "extend" | "diagonal" | "extend-bend" | "rotate-flex" | "forward" | "circle" | "both" | "tap" | "isometric";
type Support = "none" | "behind" | "chin-and-back" | "anchored-shoulder" | "on-head";
const chair: Props = [[118, 116, 165, 116], [119, 116, 119, 73], [120, 116, 120, 157], [160, 116, 160, 157]];
const bench: Props = [[97, 117, 220, 117], [100, 119, 100, 157], [216, 119, 216, 157]];
const frontNeck: Point[] = [[153, 47], [153, 68], [153, 109], [175, 91], [173, 114],
  [131, 91], [132, 115], [167, 131], [167, 156], [137, 132], [137, 156]];
const sideNeck: Point[] = [[144, 50], [142, 72], [140, 109], [158, 95], [167, 113],
  [133, 96], [144, 112], [178, 113], [179, 156], [161, 116], [159, 156]];
const transform = (base: Point[], values: Partial<Record<number, Point>>) => base.map((v, index) => values[index] ?? v);
const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];

function neckMotion(action: Action, hand: Support = "none", standing = false, hold = false): Illustration {
  const side = action === "flex" || action === "extend" || action === "forward" || action === "both" || action === "isometric";
  const bendBack: Point[] = action === "extend-bend" ? transform(frontNeck, { 0: [153, 45] }) : frontNeck;
  const base = side ? sideNeck : standing ? transform(bendBack, { 4: [171, 103], 6: [132, 103] }) : bendBack;
  const props: Props = standing ? [] : side ? chair : [[122, 117, 184, 117], [126, 117, 126, 157], [181, 117, 181, 157]];
  const map = (dx = 0, dy = 0, lookX = 0, lookY = 0, holdSide = 0, resting = false): Point[] => {
    const head = add(base[0], [dx, dy]);
    const armSide = holdSide < 0 ? 5 : 3;
    const armOther = holdSide < 0 ? 3 : 5;
    const offhand = armOther + 1;
    let body = transform(base, { 0: head });
    if (!resting && (hand === "behind" || hand === "on-head")) {
      body = transform(body, { [armSide]: add(base[1], [26 * (holdSide < 0 ? -1 : 1), -17]), [armSide + 1]: add(head, [0, -8]) });
    }
    if (!resting && hand === "chin-and-back") {
      body = transform(body, { [armSide]: add(base[1], [22 * (holdSide || 1), -6]),
        [armSide + 1]: add(head, [6 * (holdSide || 1), 7]), [armOther]: add(base[1], [-22 * (holdSide || 1), -19]),
        [offhand]: add(head, [-7 * (holdSide || 1), -6]) });
    }
    if (hand === "anchored-shoulder" && holdSide) {
      body = transform(body, { [offhand]: add(base[1], [-19 * holdSide, 50]) });
    }
    return [...body, add(head, [side ? 7 : -4 + lookX, lookY]), add(head, [side ? 7 : 4 + lookX, lookY])];
  };
  const ready = map(0, 0, 0, 0, 0, true);
  const inclined = (direction: number) => {
    switch (action) {
      case "rotate": return map(3 * direction, 0, 5 * direction, 0, direction);
      case "bend": return map(15 * direction, 5, 2 * direction, 1, direction);
      case "flex": return map(7, 9, 0, 5, direction);
      case "extend": return map(-7, -1, 0, -6, direction);
      case "diagonal": return map(10 * direction, 10, 4 * direction, 4, direction);
      case "extend-bend": return map(13 * direction, 0, 2 * direction, -5, direction);
      case "rotate-flex": return map(4 * direction, -1, 5 * direction, -5, direction);
      case "forward": return map(13, 0, 0, 0, direction);
      case "both": return direction > 0 ? map(7, 9, 0, 5) : map(-7, -1, 0, -6);
      case "tap": return transform(ready, { [direction > 0 ? 3 : 5]: add(base[1], [25 * direction, -2]),
        [direction > 0 ? 4 : 6]: add(base[1], [8 * direction, -8]) });
      default: return ready;
    }
  };
  let frames: Point[][];
  if (action === "circle") frames = [map(0, 11, 0, 4), map(13, 3, 3, 1), map(0, -6, 0, -5), map(-13, 3, -3, 1)];
  else if (action === "isometric") {
    const braced = transform(ready, { 3: [155, 44], 4: [137, 44], 5: [128, 44], 6: [137, 49] });
    frames = [ready, braced, braced, braced, braced];
  } else {
    const a = inclined(1), b = inclined(-1);
    const both = !side || action === "both";
    frames = hold ? (both ? [ready, a, a, a, ready, b, b, b] : [ready, a, a, a])
      : (both ? [ready, a, ready, b] : [ready, a]);
  }
  return { frames, props, dynamic: [["face", 0, 11], ["face", 0, 12]], ms: hold ? 1350 : 1100, reference: true };
}

function lyingExtension(mode: "bench-relax" | "supine-tuck" | "prone" | "prone-hold" | "weighted-flexion"): Illustration {
  const onBench = mode === "bench-relax" || mode === "weighted-flexion";
  const prone = mode === "prone" || mode === "prone-hold";
  const b: Point[] = onBench
    ? [[81, 102], [104, 109], [170, 110], [121, 94], [147, 98], [109, 96], [124, 99],
      [204, 112], [206, 156], [195, 115], [195, 156]]
    : prone
      ? [[98, 149], [120, 151], [161, 151], [140, 155], [158, 155], [132, 154], [147, 154],
        [196, 154], [226, 155], [189, 153], [221, 153]]
      : [[97, 149], [118, 151], [161, 151], [106, 124], [91, 143], [97, 129], [90, 151],
        [187, 119], [207, 156], [177, 123], [196, 155]];
  const head: Point = mode === "bench-relax" ? [78, 125] : mode === "weighted-flexion" ? [88, 96] : prone ? [97, 136] : [100, 135];
  const peak = transform(b, { 0: head, ...(mode === "supine-tuck" ? { 4: add(head, [-5, 5]), 6: add(head, [-7, 4]) } : {}) });
  const phases = mode === "weighted-flexion"
    ? [transform(b, { 0: [76, 116] }), peak]
    : mode === "prone" ? [b, peak] : [b, peak, peak, peak];
  const frames = phases.map((f): Point[] => {
    const eye = add(f[0], [prone ? -4 : 1, prone ? 4 : -4]);
    const plate = add(f[0], [3, -8]);
    const ready = mode === "weighted-flexion" ? transform(f, { 3: [106, 81], 4: add(plate, [2, -3]) }) : f;
    return [...ready, eye, plate];
  });
  const dynamic: Attachments = [["face", 0, 11]];
  if (mode === "weighted-flexion") dynamic.push(["plate", 12, 0, 0]);
  return { frames, props: onBench ? bench : prone ? [[75, 158, 113, 158]] : [],
    dynamic, ms: mode === "prone-hold" ? 1450 : 1130, reference: true };
}

function weightedTurn(pause: boolean): Illustration {
  const base: Point[] = [[148, 41], [148, 59], [148, 102], [169, 74], [154, 42],
    [126, 74], [143, 43], [163, 122], [169, 149], [132, 122], [128, 149]];
  const pose = (direction: number): Point[] => {
    const face: Point = [148 + 8 * direction, 36];
    const plate: Point = [148 + 5 * direction, 34];
    const f = transform(base, { 0: add(base[0], [direction * 4, 0]), 4: add(plate, [6, 6]), 6: add(plate, [-6, 6]) });
    return [...f, add(face, [-2, 4]), add(face, [2, 4]), plate];
  };
  const center = pose(0), left = pose(-1), right = pose(1);
  return { frames: pause ? [center, left, left, center, right, right] : [center, left, center, right], topView: true,
    props: [[107, 25, 192, 25], [192, 25, 192, 153], [192, 153, 107, 153], [107, 153, 107, 25]],
    dynamic: [["face", 0, 11], ["face", 0, 12], ["plate", 13, 0, 0]], ms: 1150, reference: true };
}

function sideRise(pause: boolean): Illustration {
  const b: Point[] = [[81, 120], [102, 107], [155, 108], [112, 86], [78, 110],
    [121, 112], [143, 114], [183, 110], [211, 110], [179, 113], [211, 114]];
  const phases = [b, transform(b, { 0: [79, 96], 3: [109, 80], 4: [79, 86] })];
  const frames = (pause ? [...phases, phases[1]] : phases).map((f): Point[] => [...f, add(f[0], [1, -10])]);
  return { frames, props: bench, dynamic: [["plate", 11, 0, 0]], ms: 1125, reference: true };
}

function headHarness(standing: boolean): Illustration {
  const base: Point[] = standing
    ? [[179, 70], [157, 88], [124, 113], [161, 109], [142, 133],
      [150, 109], [133, 130], [142, 137], [140, 156], [127, 137], [123, 156]]
    : [[181, 56], [164, 74], [130, 108], [166, 93], [166, 113],
      [145, 95], [155, 113], [172, 112], [175, 157], [162, 116], [162, 157]];
  const low = add(base[0], [5, 12]);
  const high = add(base[0], [-4, -6]);
  const frames = [low, high].map((h): Point[] => {
    const attachment = add(h, [7, 0]);
    return [...transform(base, { 0: h }), attachment, add(attachment, [1, standing ? 47 : 56]), add(h, [6, -1])];
  });
  return { frames, props: standing ? [] : chair, dynamic: [["head-strap", 0, 0, -4], ["line", 11, 12],
    ["plate", 12, 0, 0], ["face", 0, 13]], ms: 1150, reference: true };
}

function plateLoadedNeck(): Illustration {
  const body = transform(sideNeck, { 0: [147, 54], 4: [167, 104], 6: [151, 104] });
  const extended = transform(body, { 0: [135, 49] });
  const frames = [body, extended].map((f): Point[] => [...f, add(f[0], [-10, -1]),
    add(f[0], [-19, 2]), [104, 85], add(f[0], [-31, 25])]);
  return { frames, props: [...chair, [88, 85, 88, 157], [104, 85, 104, 157],
    [81, 156, 112, 156], [88, 85, 104, 85]],
    dynamic: [["pad", 11, 0, 0], ["line", 11, 12], ["line", 12, 13], ["line", 13, 14], ["plate", 14, 0, 0]],
    ms: 1070, reference: true };
}

export const neckControlIllustrations: Readonly<Record<string, Illustration>> = {
  "1843": neckMotion("rotate", "chin-and-back", false, true),
  "1832": neckMotion("diagonal", "behind", false, true),
  "1844": neckMotion("extend-bend", "none", false, true),
  "2282": plateLoadedNeck(),
  "1842": lyingExtension("bench-relax"),
  "1841": lyingExtension("supine-tuck"),
  "3994": neckMotion("circle", "none", true),
  "1838": neckMotion("diagonal", "behind", false, true),
  "1837": neckMotion("flex", "behind", false, true),
  "1840": neckMotion("rotate-flex", "none", false, true),
  "1839": neckMotion("extend", "none", false, true),
  "1834": neckMotion("forward", "none", false, true),
  "5145": neckMotion("isometric", "behind", false, true),
  "5060": lyingExtension("prone"),
  "5061": lyingExtension("prone-hold"),
  "1831": neckMotion("rotate", "none", false, true),
  "3441": neckMotion("both"),
  "5131": neckMotion("tap"),
  "10557": neckMotion("bend"),
  "10556": neckMotion("rotate"),
  "7306": neckMotion("bend", "on-head", true, true),
  "1791": neckMotion("bend", "anchored-shoulder", false, true),
  "1043": lyingExtension("weighted-flexion"),
  "4432": weightedTurn(false),
  "4431": weightedTurn(true),
  "4429": sideRise(false),
  "0848": headHarness(false),
  "4430": sideRise(true),
  "2410": headHarness(true),
};
