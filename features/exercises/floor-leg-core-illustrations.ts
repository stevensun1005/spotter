import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const change = (p: Point[], delta: Partial<Record<number, Point>>) => p.map((q, i) => delta[i] ?? q);
const clip = (frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 880, spine?: number[]): Illustration => ({
  frames, props, dynamic, ms, spine, reference: true,
});

type Raise = "hip" | "pulse" | "full" | "knee" | "band-knee" | "band-hip" | "band-leg";
type Setup = "floor" | "incline" | "decline";
function hipRaise(style: Raise, support: Setup = "floor"): Illustration {
  const floor = support === "floor";
  const uphill = support === "incline";
  const body: Point[] = floor ? [[93, 150], [111, 151], [149, 150], [123, 154], [152, 154], [119, 151], [144, 152],
    [188, 148], [226, 152], [184, 147], [221, 150]]
    : uphill ? [[99, 68], [115, 80], [154, 113], [95, 75], [82, 57], [91, 72], [77, 55],
      [187, 119], [221, 129], [180, 119], [216, 128]]
      : [[91, 64], [111, 79], [154, 98], [97, 77], [81, 55], [91, 70], [77, 54],
        [191, 107], [224, 112], [188, 105], [219, 110]];
  const [x, y] = body[2];
  const vertical = change(body, { 7: [x + 3, y - 36], 8: [x + 3, y - 68],
    9: [x - 4, y - 38], 10: [x - 1, y - 68] });
  const raised = change(vertical, { 2: [x - 5, y - 16], 7: [x, y - 48], 8: [x - 1, Math.max(15, y - 82)],
    9: [x - 7, y - 50], 10: [x - 6, Math.max(13, y - 83)] });
  const tiny = change(vertical, { 2: [x, y - 8], 7: [x + 2, y - 44], 8: [x + 5, y - 75], 9: [x - 4, y - 44], 10: [x - 1, y - 75] });
  const tabletop = change(body, { 7: [x + 11, y - 32], 8: [x + 43, y - 26], 9: [x + 7, y - 31], 10: [x + 39, y - 24] });
  const kneesUp = change(tabletop, { 2: [x - 5, y - 11], 7: [x - 4, y - 49], 8: [x + 28, y - 45],
    9: [x - 8, y - 47], 10: [x + 23, y - 41] });
  const feetLow = change(tabletop, { 7: [x + 26, y - 23], 8: [x + 53, y - 9], 9: [x + 19, y - 22], 10: [x + 47, y - 10] });
  const frames: Record<Raise, Point[][]> = {
    hip: [vertical, raised, raised, vertical],
    pulse: [vertical, tiny, vertical, tiny, vertical, tiny],
    full: [body, vertical, raised, raised, vertical],
    knee: [feetLow, tabletop, kneesUp, tabletop],
    "band-knee": [feetLow, tabletop, kneesUp, tabletop],
    "band-hip": [body, vertical, raised, raised, vertical],
    "band-leg": [body, vertical, vertical],
  };
  const band = style.startsWith("band");
  const props: Props = band ? [[256, 131, 256, 157], [246, 148, 257, 148], [246, 157, 270, 157]]
    : floor ? [] : [[81, uphill ? 63 : 62, 185, uphill ? 142 : 119],
      [88, uphill ? 68 : 65, 88, 157], [171, uphill ? 130 : 111, 171, 157],
      [74, 157, 186, 157], [78, 55, 87, 55]];
  return clip(frames[style], props, band ? [["band", 8, 254, 149], ["band", 10, 253, 149]] : [], style === "pulse" ? 365 : 885);
}

type LegPath = "criss-cross" | "wide-cross" | "eight" | "march" | "six-inch" | "side" | "toe";
function feetPath(shape: LegPath): Illustration {
  const floor: Point[] = [[87, 148], [105, 150], [149, 151], [126, 154], [151, 155], [124, 150], [148, 151],
    [188, 147], [228, 141], [184, 146], [221, 140]];
  const high = change(floor, { 7: [152, 115], 8: [154, 78], 9: [147, 113], 10: [146, 78] });
  const overhead: Point[] = [[92, 92], [110, 92], [148, 92], [130, 106], [154, 112],
    [129, 77], [153, 72], [187, 99], [226, 105], [185, 86], [224, 80]];
  const feetCross = (side: number) => change(overhead, { 7: [186, 87 + side * 2], 8: [226, 80 + side * 4],
    9: [186, 97 + side * 3], 10: [225, 105 + side * 2] });
  const wide = change(overhead, { 7: [183, 109], 8: [218, 128], 9: [183, 77], 10: [219, 58] });
  const curve = (x: number, y: number) => change(floor, { 7: [x, y], 8: [x + 36, 2 * y - 146],
    9: [x - 5, y - 3], 10: [x + 30, 2 * y - 149] });
  const lowHead = change(floor, { 0: [87, 130], 1: [106, 138], 7: [189, 144], 8: [230, 138],
    9: [185, 141], 10: [225, 136] });
  const still = change(floor, { 7: [188, 151], 8: [228, 156], 9: [183, 149], 10: [223, 154] });
  const side = change(floor, { 3: [73, 153], 4: [56, 153], 5: [120, 143], 6: [139, 155],
    7: [190, 146], 8: [229, 146], 9: [187, 149], 10: [224, 149] });
  const sided = change(side, { 7: [189, 128], 8: [229, 108], 9: [185, 130], 10: [224, 111] });
  const reaching = change(high, { 0: [102, 110], 1: [114, 123], 3: [131, 103], 4: [148, 82],
    5: [126, 100], 6: [144, 79] });
  const sequences: Record<LegPath, Point[][]> = {
    "criss-cross": [overhead, feetCross(1), overhead, feetCross(-1)],
    "wide-cross": [wide, feetCross(1), wide, feetCross(-1)],
    eight: [curve(178, 131), curve(184, 145), curve(189, 134), curve(182, 123),
      curve(178, 131), curve(171, 139), curve(165, 128), curve(170, 122)],
    march: [floor, change(floor, { 7: high[7], 8: high[8] }), floor, change(floor, { 9: high[9], 10: high[10] })],
    "six-inch": [still, ...Array<Point[]>(19).fill(lowHead), still],
    side: [side, sided, sided, side],
    toe: [change(high, { 3: [111, 124], 4: [111, 99], 5: [103, 123], 6: [103, 98] }), reaching, reaching],
  };
  const cross = shape === "criss-cross" || shape === "wide-cross";
  const mat: Props = [[61, 55, 245, 55], [245, 55, 245, 131], [245, 131, 61, 131], [61, 131, 61, 55]];
  return { ...clip(sequences[shape], cross ? mat : [], shape === "toe" ? [["band", 10, 6], ["band", 8, 4]] : [],
    shape === "six-inch" ? 1150 : 795), topView: cross };
}

type Wiper = "bent" | "straight" | "dumbbell";
function wipers(type: Wiper): Illustration {
  const base: Point[] = [[92, 150], [109, 150], [149, 150], [124, 152], [151, 154], [112, 145], [139, 147],
    [151, 115], [154, 80], [146, 113], [149, 79]];
  const supported = type === "dumbbell" ? change(base, { 3: [111, 124], 4: [111, 97], 5: [107, 121], 6: [107, 95] })
    : change(base, { 3: [109, 154], 4: [90, 155], 5: [104, 142], 6: [83, 141] });
  const straight = type !== "bent";
  const center = straight ? supported : change(supported, { 8: [182, 121], 10: [178, 118] });
  const rotate = (direction: number) => change(center, { 7: [151 + direction * 23, 131], 8: [151 + direction * 49, straight ? 111 : 148],
    9: [147 + direction * 23, 130], 10: [148 + direction * 49, straight ? 109 : 145] });
  const midpoint = (p: Point[]): Point => [(p[4][0] + p[6][0]) / 2, (p[4][1] + p[6][1]) / 2];
  return clip([center, rotate(1), rotate(1), center, rotate(-1), rotate(-1)].map(p => [...p, midpoint(p)]), [],
    type === "dumbbell" ? [["dumbbell", 11, 0, -1]] : []);
}

export const floorLegCoreIllustrations: Record<string, Illustration> = {
  "6810": hipRaise("band-knee"), "0910": hipRaise("band-hip"), "7201": hipRaise("band-leg"),
  "3438": hipRaise("full", "decline"), "9049": hipRaise("hip", "incline"), "4885": hipRaise("hip", "incline"),
  "5472": hipRaise("knee"), "4886": hipRaise("hip"), "3393": hipRaise("full"), "4018": hipRaise("hip"), "3459": hipRaise("pulse"),
  "4880": feetPath("criss-cross"), "4994": feetPath("wide-cross"), "4987": feetPath("eight"),
  "3496": feetPath("march"), "9451": feetPath("six-inch"), "4156": feetPath("side"), "2463": feetPath("toe"),
  "1248": wipers("bent"), "1249": wipers("straight"), "4737": wipers("dumbbell"),
};
