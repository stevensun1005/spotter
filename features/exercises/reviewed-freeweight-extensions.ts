import type { Illustration, Point } from "./motion-data";

type Arms = [Point, Point, Point, Point];
type Torso = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const pose = (body: Torso, arms: Arms, legs: Legs, ...extra: Point[]): Point[] => [...body, ...arms, ...legs, ...extra];
const clip = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 970): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });
const shift = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const twoDumbbells: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const bench: Props = [[93, 130, 199, 130], [100, 130, 100, 156], [190, 130, 190, 156]];
const floor: Torso = [[99, 110], [113, 118], [164, 120]];
const floorLegs: Legs = [[193, 126], [200, 155], [182, 127], [189, 155]];
const seat: Props = [[100, 123, 156, 123], [107, 123, 107, 156], [148, 123, 148, 156]];
const seated: Torso = [[131, 53], [129, 70], [128, 115]];
const seatedLegs: Legs = [[162, 120], [167, 155], [151, 123], [152, 157]];

function flatExtensionBoth(): Illustration {
  const at = (near: Point, far: Point) =>
    pose(floor, [[127, 90], near, [111, 89], far], floorLegs, [121, 117], [107, 118]);
  return { ...clip([at([130, 64], [113, 64]), at([109, 74], [95, 76]), at([103, 96], [91, 96]),
    at([109, 74], [95, 76])], bench, twoDumbbells), shoulders: [11, 12] };
}

function inclineExtensionBoth(): Illustration {
  const body: Torso = [[118, 65], [130, 78], [161, 114]];
  const legs: Legs = [[186, 121], [199, 156], [178, 126], [180, 157]];
  const support: Props = [[112, 72, 155, 121], [155, 121, 193, 121], [177, 121, 177, 157],
    [142, 107, 137, 157], [128, 157, 160, 157]];
  const at = (near: Point, far: Point) =>
    pose(body, [[145, 55], near, [128, 56], far], legs, [137, 79], [124, 78]);
  return { ...clip([at([153, 32], [132, 31]), at([126, 43], [113, 46]), at([120, 62], [106, 63]),
    at([126, 43], [113, 46])], support, twoDumbbells), shoulders: [11, 12] };
}

type Grip = "supinated" | "pronated" | "neutral";
function singleExtension(mode: "flat" | "seat", grip: Grip): Illustration {
  const flat = mode === "flat";
  const elbow: Point = flat ? [125, 89] : [145, 53];
  const at = (wrist: Point) => {
    const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1], length = Math.hypot(dx, dy);
    const horizontal = grip === "neutral" ? 4 : 8;
    const palm = grip === "supinated" ? 1 : grip === "pronated" ? -1 : 0;
    const tip = shift(wrist, dx * 6 / length, dy * 6 / length);
    const thumb = shift(wrist, (dx * 3 - dy * 6 * palm) / length, (dy * 3 + dx * 6 * palm) / length);
    return pose(flat ? floor : seated, flat ? [elbow, wrist, [135, 119], [162, 126]] :
      [elbow, wrist, [114, 95], [107, 120]], flat ? floorLegs : seatedLegs,
    tip, thumb, shift(wrist, -horizontal, palm * 4 + (palm === 0 ? -7 : 0)),
    shift(wrist, horizontal, -palm * 4 + (palm === 0 ? 7 : 0)),
    flat ? [119, 117] : [136, 70], flat ? [107, 119] : [122, 70]);
  };
  const reach = at(flat ? [130, 64] : [151, 27]);
  const half = at(flat ? [110, 68] : [134, 33]);
  const curl = at(flat ? [100, 99] : [119, 52]);
  return { ...clip([reach, half, curl, half], flat ? bench : seat, [
    ["hand", 4, 11, 12], ["bar", 13, 14], ["pad", 13, 0, 0], ["pad", 14, 0, 0],
  ]), shoulders: [15, 16] };
}

function highRopeOverhead(): Illustration {
  const figure: Torso = [[146, 63], [137, 80], [129, 120]];
  const legs: Legs = [[143, 137], [155, 156], [119, 138], [110, 155]];
  const pulley: Point = [74, 31];
  const tower: Props = [[67, 25, 67, 154], [76, 28, 76, 156], [67, 25, 81, 25],
    [67, 124, 76, 124], [67, 131, 76, 131], [67, 138, 76, 138], [60, 156, 90, 156]];
  const at = (near: Point, far: Point) => pose(figure, [[156, 56], near, [141, 55], far], legs,
    [(near[0] + far[0]) / 2 - 14, (near[1] + far[1]) / 2 + 4], [143, 79], [132, 78]);
  return { ...clip([at([169, 33], [153, 32]), at([147, 33], [134, 33]),
    at([130, 60], [117, 58]), at([147, 33], [134, 33])], tower, [
    ["cable", 11, ...pulley], ["line", 4, 11], ["line", 6, 11], ["pad", 4, 0, 0], ["pad", 6, 0, 0],
  ]), shoulders: [12, 13] };
}

function seatedCurlToPress(): Illustration {
  const trunk: Torso = [[155, 49], [155, 68], [153, 114]];
  const legs: Legs = [[174, 120], [182, 157], [140, 120], [139, 157]];
  const support: Props = [[130, 122, 181, 122], [138, 122, 138, 156], [173, 122, 173, 156]];
  const rotateDumbbells = (positions: Arms, grip: number) => {
    const near = positions[1], far = positions[3];
    return pose(trunk, positions, legs, [166, 68], [143, 68],
      shift(near, 0, -6), shift(near, grip * 6, -3), shift(far, 0, -6), shift(far, -grip * 6, -3),
      shift(near, -8, 4 * grip), shift(near, 8, -4 * grip), shift(far, -8, -4 * grip), shift(far, 8, 4 * grip));
  };
  const lower = rotateDumbbells([[172, 96], [171, 121], [139, 95], [139, 121]], 1);
  const midpoint = rotateDumbbells([[172, 96], [183, 97], [139, 95], [126, 96]], 1);
  const curl = rotateDumbbells([[172, 94], [171, 68], [139, 95], [141, 68]], 1);
  const turned = rotateDumbbells([[191, 83], [188, 58], [120, 83], [119, 58]], -1);
  const overhead = rotateDumbbells([[177, 45], [177, 20], [135, 43], [134, 18]], -1);
  return { ...clip([lower, midpoint, curl, turned, overhead, turned, curl, midpoint], support, [
    ["hand", 4, 13, 14], ["hand", 6, 15, 16], ["bar", 17, 18], ["bar", 19, 20],
    ["pad", 17, 0, 0], ["pad", 18, 0, 0], ["pad", 19, 0, 0], ["pad", 20, 0, 0],
  ], 860), shoulders: [11, 12] };
}

export const reviewedFreeweightExtensions: Record<string, Illustration> = {
  "0330": inclineExtensionBoth(),
  "0344": singleExtension("flat", "pronated"),
  "0346": singleExtension("flat", "supinated"),
  "0351": flatExtensionBoth(),
  "0362": singleExtension("seat", "neutral"),
  "1722": highRopeOverhead(),
  "1738": singleExtension("seat", "supinated"),
  "3547": seatedCurlToPress(),
};
