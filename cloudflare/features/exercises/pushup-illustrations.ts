import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Pose = [Point, Point, Point, Point, Point, Point, Point, Point, Point, Point, Point];
type Contacts = [Point, Point];
type Rig = [Pose, Pose];

const rig = (top: Pose, bottom: Pose): Rig => [top, bottom];
const draw = (frames: readonly Pose[], props?: Props, dynamic?: Gear, ms = 740): Illustration =>
  ({ frames: [...frames], props, dynamic, ms, reference: true });
const change = (pose: Pose, joints: Record<number, Point>): Pose =>
  pose.map((point, i) => joints[i] ?? point) as Pose;

const floor = rig(
  [[225, 91], [205, 102], [143, 121], [207, 128], [205, 156], [192, 128], [190, 153], [114, 135], [85, 153], [102, 135], [72, 152]],
  [[231, 129], [212, 137], [145, 138], [185, 143], [205, 156], [173, 140], [190, 153], [115, 145], [85, 153], [103, 144], [72, 152]],
);
const plankCheck = change(floor[0], {
  0: [224, 93], 1: [205, 103], 2: [143, 126], 3: [205, 128], 7: [113, 139], 9: [102, 139],
});
const trunkSags = change(plankCheck, {
  0: [216, 99], 1: [198, 109], 2: [143, 146], 3: [203, 132], 7: [113, 149], 9: [102, 148],
});
const hipsRaised = change(plankCheck, { 2: [143, 107], 7: [113, 126], 9: [102, 128] });
const chestHigh = change(floor[1], {
  0: [223, 109], 1: [204, 120], 2: [142, 105], 3: [194, 138], 5: [181, 136], 7: [114, 129], 9: [102, 130],
});
const comparisonMarks: Props = [
  [78, 66, 90, 78], [90, 66, 78, 78],
  [229, 73, 235, 79], [235, 79, 248, 66],
  [160, 62, 160, 145],
];
const placeComparison = (frames: Pose[], left: number) => frames.map((frame) => frame.map(
  ([x, y]): Point => [left + (x - 68) * 0.7, 156 + (y - 156) * 0.74],
) as Pose);
const compareForm = (correct: Pose[], incorrect: Pose[]): Illustration => ({
  ...draw(placeComparison(correct, 177), comparisonMarks, undefined, 1250),
  partnerFrames: placeComparison(incorrect, 27),
});
const plankSettles = change(plankCheck, { 0: [222, 96], 1: [203, 105], 2: [143, 127] });
const startFormCheck = compareForm(
  [plankCheck, plankCheck, plankSettles],
  [trunkSags, trunkSags, change(trunkSags, { 2: [143, 151] })],
);
const bottomFormCheck = compareForm(
  [floor[1], floor[1], plankCheck, plankCheck],
  [chestHigh, chestHigh, hipsRaised, hipsRaised],
);
const knees = rig(
  [[219, 92], [202, 106], [150, 125], [204, 130], [204, 156], [191, 129], [191, 153], [110, 154], [83, 149], [99, 154], [70, 149]],
  [[230, 128], [210, 137], [152, 147], [183, 143], [204, 156], [174, 141], [191, 153], [110, 154], [83, 149], [99, 154], [70, 149]],
);
const incline = rig(
  [[204, 53], [187, 66], [141, 102], [188, 90], [187, 116], [174, 91], [173, 113], [119, 125], [86, 153], [106, 123], [75, 152]],
  [[211, 89], [194, 99], [143, 123], [169, 103], [187, 116], [157, 99], [173, 113], [120, 136], [86, 153], [107, 133], [75, 152]],
);
const decline = rig(
  [[225, 90], [205, 102], [139, 102], [202, 126], [205, 156], [189, 125], [190, 153], [111, 106], [79, 110], [100, 104], [67, 107]],
  [[230, 129], [211, 138], [141, 119], [184, 141], [205, 156], [172, 138], [190, 153], [113, 113], [79, 110], [102, 110], [67, 107]],
);
const reverse = rig(
  [[207, 54], [198, 71], [164, 120], [205, 115], [209, 157], [190, 115], [197, 153], [127, 116], [103, 155], [117, 113], [90, 153]],
  [[195, 74], [186, 91], [164, 143], [217, 122], [209, 157], [203, 120], [197, 153], [126, 120], [103, 155], [115, 117], [90, 153]],
);

const platform = (x: number, y: number, end: number): Props =>
  [[x, y, end, y], [x + 4, y, x + 4, 158], [end - 4, y, end - 4, 158]];
const tallBar: Props = [[183, 92, 207, 89], [205, 90, 205, 158], [194, 158, 219, 158]];
const smith: Props = [...tallBar, [164, 32, 228, 32], [164, 32, 164, 158], [228, 32, 228, 158]];
const wall: Props = [[239, 42, 239, 158], [239, 58, 256, 58], [239, 104, 256, 104], [239, 150, 256, 150]];
const chair: Props = [...platform(160, 118, 216), [215, 118, 215, 75], [215, 75, 183, 75]];
const handBox = platform(168, 118, 219);
const plyoBox: Props = [
  [169, 118, 219, 118], [169, 118, 169, 158], [219, 118, 219, 158], [169, 158, 219, 158],
  [156, 110, 169, 118], [156, 110, 206, 110], [206, 110, 219, 118],
  [156, 110, 156, 150], [156, 150, 169, 158],
];
const feetBox = platform(55, 111, 104);

const hands = (source: Rig, style: "wide" | "narrow" | "staggered" | "cross" | "lower-ribs"): Rig => {
  const delta: [number, number] = style === "wide" ? [16, -16] : style === "narrow" ? [-6, 6]
    : style === "staggered" ? [13, -9] : style === "cross" ? [-13, 15] : [-19, -20];
  return source.map((frame) => change(frame, Object.fromEntries([3, 4, 5, 6].map((joint) =>
    [joint, [frame[joint][0] + (joint % 2 ? 0.65 : 1) * delta[joint < 5 ? 0 : 1], frame[joint][1]]]
  )))) as Rig;
};

const raiseHands = (source: Rig, height: number): Rig => source.map((frame) => change(frame, {
  3: [frame[3][0], frame[3][1] - height], 4: [frame[4][0], frame[4][1] - height],
  5: [frame[5][0], frame[5][1] - height], 6: [frame[6][0], frame[6][1] - height],
  0: [frame[0][0], frame[0][1] - height], 1: [frame[1][0], frame[1][1] - height],
  2: [frame[2][0], frame[2][1] - Math.floor(height * 0.6)],
})) as Rig;
const equipmentHands = raiseHands(floor, 12);
const bentKneesOnBox = knees.map((frame) => change(frame, {
  2: [frame[2][0], frame[2][1] - 27], 7: [104, 105], 8: [81, 105], 9: [94, 104], 10: [69, 104],
})) as Rig;
const kneeHandsOnBox = incline.map((frame) => change(frame, {
  2: [frame[2][0], frame[2][1] + 3], 7: [105, 154], 8: [79, 151], 9: [96, 154], 10: [66, 151],
})) as Rig;
const feetOnWall = decline.map((frame) => change(frame, {
  7: [111, 93], 8: [56, 82], 9: [102, 87], 10: [56, 76],
})) as Rig;
const floorWall: Props = [[56, 41, 56, 159], [43, 75, 56, 75], [43, 117, 56, 117]];
const feetOnBall = decline.map((frame) => change(frame, {
  7: [109, 122], 8: [76, 121], 9: [97, 122], 10: [65, 121],
})) as Rig;

const cylinderBench = (x: number, y: number): Props => [[x - 13, y, x + 13, y], [x - 11, y, x - 15, 157], [x + 11, y, x + 15, 157]];
const lowRails: Props = [...cylinderBench(202, 143), ...cylinderBench(188, 139)];
const lowHandles: Props = [...cylinderBench(205, 146), ...cylinderBench(191, 143)];
const kettlebellGrip: Gear = [["kettlebell", 4, 0], ["kettlebell", 6, 0]];
const dumbbellGrip: Gear = [["dumbbell", 4, 0, 3], ["dumbbell", 6, 0, 3]];
const resistance: Gear = [["band", 4, 1], ["band", 6, 1]];
const supportBand: Gear = [["band", 2, 76, 99], ["band", 2, 248, 99]];
const rack: Props = [[70, 65, 70, 158], [253, 65, 253, 158], [61, 158, 78, 158], [244, 158, 264, 158]];
const boxerMat: Props = [[155, 158, 242, 158]];
const towels: Props = [[193, 158, 215, 158], [178, 154, 200, 154]];

const vest: Gear = [["bar", 1, 2], ["pad", 1, -19, 7]];
const ankleStraps: Gear = [["line", 8, 91, 20], ["line", 10, 73, 20], ["pad", 8, 0, 3], ["pad", 10, 0, 3]];
const handRings: Gear = [["band", 4, 219, 20], ["band", 6, 201, 20], ["ring", 4, 0, 0], ["ring", 6, 0, 0]];
const handStraps: Gear = [["line", 4, 219, 20], ["line", 6, 201, 20], ["pad", 4, 0, 2], ["pad", 6, 0, 2]];
const suspensionPress = raiseHands(floor, 18);
const suspensionFeet = decline.map((frame) => change(frame, { 8: [85, 119], 10: [72, 116] })) as Rig;
const suspensionIncline = raiseHands(incline, 15);

const pike = rig(
  [[202, 108], [192, 98], [147, 62], [195, 124], [199, 145], [182, 120], [183, 142], [116, 95], [87, 126], [104, 94], [72, 124]],
  [[202, 140], [187, 125], [148, 79], [174, 127], [199, 145], [161, 122], [183, 142], [115, 102], [87, 126], [104, 100], [72, 124]],
);
const pikeChairs = pike.map((frame) => change(frame, {
  7: [111, 110], 8: [82, 153], 9: [100, 110], 10: [67, 152],
  4: [202, 126], 6: [184, 121],
})) as Rig;
const pikeRings = pike.map((frame) => change(frame, {
  4: [199, 127], 6: [183, 123], 8: [85, 105], 10: [70, 104],
})) as Rig;

const wallPress = rig(
  [[196, 64], [190, 82], [163, 114], [207, 88], [238, 87], [205, 88], [238, 93], [151, 133], [136, 156], [143, 131], [123, 152]],
  [[226, 71], [212, 87], [172, 118], [198, 100], [238, 87], [194, 101], [238, 93], [153, 136], [136, 156], [144, 134], [123, 152]],
);
const dogWall = rig(
  [[180, 91], [165, 96], [117, 107], [198, 82], [238, 77], [184, 82], [238, 87], [122, 130], [120, 156], [109, 131], [103, 154]],
  [[217, 99], [203, 101], [125, 107], [208, 121], [238, 77], [194, 120], [238, 87], [125, 130], [120, 156], [109, 131], [103, 154]],
);
const handstand = rig(
  [[211, 132], [207, 117], [200, 76], [205, 136], [205, 156], [192, 135], [190, 153], [201, 53], [211, 28], [189, 53], [199, 28]],
  [[213, 151], [209, 135], [204, 90], [183, 137], [205, 156], [173, 135], [190, 153], [205, 62], [211, 34], [193, 61], [199, 33]],
);
const kipping = change(handstand[1], { 2: [203, 91], 7: [181, 79], 8: [201, 56], 9: [171, 78], 10: [190, 53] });
const overheadWall: Props = [[212, 25, 212, 108], [212, 37, 238, 37], [212, 67, 238, 67], [212, 96, 238, 96]];
const invertedLesson = raiseHands(handstand, 10);
const suspensionPike = change(pike[0], { 7: [108, 106], 8: [80, 153], 9: [101, 102], 10: [69, 151],
  4: invertedLesson[0][4], 6: invertedLesson[0][6] });

const prone = change(floor[1], { 0: [232, 144], 1: [210, 150], 2: [145, 150], 7: [115, 151], 9: [103, 151] });
const releases = change(prone, { 4: [208, 142], 6: [189, 140] });
const child = change(knees[0], { 0: [170, 136], 1: [151, 142], 2: [102, 133], 3: [177, 146], 5: [166, 145] });
const cobra = change(floor[0], { 0: [215, 87], 1: [205, 109], 2: [154, 147], 3: [204, 134], 5: [189, 134], 7: [114, 150], 9: [102, 150] });
const kneeCobra = change(knees[0], { 0: [213, 88], 1: [202, 109], 2: [155, 148], 3: [203, 133], 5: [190, 132] });
const hinduStart = change(knees[0], { 0: [184, 111], 1: [167, 106], 2: [131, 83], 3: [186, 130], 5: [174, 130] });
const bottomSeal = change(prone, { 3: [190, 150], 5: [176, 148] });

const squeeze = (source: Rig): Pose => change(source[0], { 0: [source[0][0][0], source[0][0][1] + 6],
  1: [source[0][1][0], source[0][1][1] + 6], 2: [source[0][2][0], source[0][2][1] + 2] });
const lift = (frame: Pose, points: readonly number[], height = 9): Pose => change(frame,
  Object.fromEntries(points.map((i) => [i, [frame[i][0], frame[i][1] - height]])),
);
const pointsAboveFloor = [0, 1, 2, 3, 4, 5, 6];
const airborne = (source: Rig, hold = false): Pose[] => [source[0], source[1], lift(source[0], pointsAboveFloor, 12), ...(hold ? [source[0], source[1]] : []), source[0]];
const timedHold = (source: Rig): Pose[] => [source[0], source[1], source[1], source[1], source[1], source[1]];
const extend = (frame: Pose, near: boolean, direction: "forward" | "up" | "row" | "tap" | "reach-across"): Pose => {
  const { 1: [x,y] } = frame;
  const pairs: Record<typeof direction, Contacts> = {
    forward: [[x + 25, y + 2], [x + 58, y + 2]],
    up: [[x + 1, y - 26], [x + 1, y - 53]],
    row: [[x - 26, y + 12], [x - 17, y + 28]],
    tap: [[x + 16, y + 16], [x - 9, y + 2]],
    "reach-across": [[x - 28, y + 21], [x - 65, y + 34]],
  };
  const [elbow, wrist] = pairs[direction];
  return change(frame, near ? { 3: elbow, 4: wrist } : { 5: elbow, 6: wrist });
};
const addAfterPress = (source: Rig, near: Pose, far?: Pose) =>
  [source[0], source[1], source[0], near, ...(far ? [source[0], source[1], source[0], far] : [])];
const row = (source: Rig) => addAfterPress(source, extend(source[0], true, "row"), extend(source[0], false, "row"));
const rotation = (source: Rig) => {
  const turn = (near: boolean) => {
    const stable = source[0];
    const elbow = near ? 5 : 3, wrist = elbow + 1;
    const [x, y] = stable[wrist];
    const [hx, hy] = stable[2];
    const hips: Point = [hx + (near ? 4 : -4), hy - 5];
    const shoulder: Point = [x, y - 52];
    const base = change(stable, { 0: [x + 9, y - 68], 1: shoulder, 2: hips,
      [elbow]: [x, y - 26], [wrist]: [x, y],
      7: [stable[7][0], stable[7][1] - (near ? 8 : 2)], 8: [stable[8][0], stable[8][1] - (near ? 7 : 0)],
      9: [stable[7][0] - 6, stable[7][1] - (near ? 2 : 8)], 10: [stable[8][0] - 4, stable[8][1] - (near ? 0 : 7)] });
    return extend(base, near, "up");
  };
  return addAfterPress(source, turn(true), turn(false));
};
const shoulderTaps = (source: Rig) => addAfterPress(source, extend(source[0], true, "tap"), extend(source[0], false, "tap"));
const tuck = (frame: Pose, near: boolean, cross = false): Pose => change(frame, near
  ? { 7: [cross ? 181 : 178, cross ? 128 : 132], 8: [148, 151] }
  : { 9: [cross ? 184 : 171, cross ? 136 : 127], 10: [140, 147] });
const alternatingTuck = (source: Rig) => addAfterPress(source, tuck(source[0], true), tuck(source[0], false));
const tuckedPress = (source: Rig) => [source[0], tuck(source[1], true, true), source[0], tuck(source[1], false, true)];
const moveSuspensionFoot = (frame: Pose, joint: 8 | 10, x: number): Point => {
  const anchor = joint === 8 ? 91 : 73;
  const [originalX, originalY] = frame[joint];
  const radiusSquared = (originalX - anchor) ** 2 + (originalY - 20) ** 2;
  return [x, 20 + Math.sqrt(Math.max(0, radiusSquared - (x - anchor) ** 2))];
};
const suspendedTuck = (frame: Pose, near: boolean) => change(frame, near
  ? { 7: [178, frame[1][1] + 21], 8: moveSuspensionFoot(frame, 8, 146) }
  : { 9: [169, frame[1][1] + 18], 10: moveSuspensionFoot(frame, 10, 135) });
const suspensionStar = suspensionFeet.map(frame => change(frame, {
  7: [frame[7][0] + 3, frame[7][1] + 5], 8: moveSuspensionFoot(frame, 8, frame[8][0] + 14),
  9: [frame[9][0] - 4, frame[9][1] - 2], 10: moveSuspensionFoot(frame, 10, frame[10][0] - 14),
}));
const sideKnees = knees.map((frame) => change(frame, { 7: [112, 157], 8: [93, 155], 9: [123, 146], 10: [91, 143] })) as Rig;
const sideCorkscrew = [floor[0], change(floor[1], { 2: [148, 130], 7: [112, 150], 9: [105, 134] }),
  floor[0], change(floor[1], { 2: [141, 146], 7: [110, 135], 9: [108, 152] })];
const handStep = (source: Rig) => {
  const wide = hands(source, "wide");
  const narrow = hands(source, "narrow");
  const halfway = change(wide[0], { 3: narrow[0][3], 4: narrow[0][4] });
  return [wide[0], wide[1], wide[0], halfway, narrow[0], narrow[1], narrow[0], halfway];
};
const oneHand = (source: Rig): Rig => source.map((frame) => change(frame, { 5: [frame[2][0] - 1, frame[2][1] - 14],
  6: [frame[2][0] - 13, frame[2][1] - 5] })) as Rig;
const archerTop = hands(floor, "wide")[0];
const arch = change(archerTop, { 0: [243, 120], 1: [222, 129], 2: [150, 132], 3: [197, 132], 5: [190, 142] });
const sideSlide = change(arch, { 5: [150, 140], 6: [118, 154] });
const sideTowel: Gear = [["slider", 6, 0, 3]];
const ballHand = (basket: "stability" | "medicine") => {
  const height = basket === "stability" ? 35 : 16;
  return floor.map((frame) => change(frame, {
    5: [frame[5][0] - 12, frame[5][1] - height * 0.6],
    6: [frame[6][0] - 15, frame[6][1] - height],
  })) as Rig;
};
const straightLegLift: Rig = floor.map((frame) => change(frame, {
  7: [110, 113], 8: [78, 106],
})) as Rig;

const floorForearms = change(floor[1], { 0: [206, 118], 1: [185, 126], 3: [181, 156], 4: [210, 156], 5: [171, 153], 6: [197, 153] });
const firstPalm = change(floorForearms, { 3: [182, 138], 4: [204, 156] });
const secondPalm = change(floorForearms, { 5: [174, 137], 6: [190, 153] });
const upDown = [floorForearms, firstPalm, floor[0], secondPalm, floorForearms, secondPalm, floor[0], firstPalm];
const pikeReach = (near: boolean) => change(floor[0], { 0: [184, 116], 1: [166, 98], 2: [128, 74],
  [near ? 3 : 5]: [118, 111], [near ? 4 : 6]: near ? [72, 150] : [84, 151], 7: [107, 112], 9: [99, 111] });
const handCross = change(floor[0], { 3: [186, 133], 4: [174, 153] });
const pulled = change(floor[0], { 3: [164, 136], 4: [140, 156] });
const secondPulled = change(floor[0], { 5: [149, 132], 6: [127, 153] });

const spread = (frame: Pose, width = 11): Pose => change(frame, { 7: [frame[7][0] + 2, frame[7][1] + 5], 8: [frame[8][0] + width, 156],
  9: [frame[9][0] - 4, frame[9][1] - 2], 10: [frame[10][0] - width, 150] });
const jack = [floor[0], floor[1], floor[0], spread(floor[0]), floor[0]];
const birdDog = (near: boolean) => extend(change(floor[0], near ? { 9: [108, 121], 10: [71, 123] } : { 7: [109, 124], 8: [71, 126] }), near, "forward");
const superman = change(prone, {
  0: [232, 139], 1: [210, 145], 3: [235, 144], 4: [266, 141], 5: [229, 141], 6: [257, 137],
  7: [111, 143], 8: [83, 138], 9: [99, 143], 10: [71, 139],
});
const propPressure = (shape: "fist" | "fingers"): Props => [205, 190].flatMap((x, i): Props => shape === "fist"
  ? [[x - 4, 157 - i * 3, x + 3, 157 - i * 3], [x - 4, 153 - i * 3, x + 3, 153 - i * 3]]
  : [[x, 151 - i * 3, x + 2, 159 - i * 3], [x - 4, 153 - i * 3, x - 6, 158 - i * 3], [x + 4, 153 - i * 3, x + 7, 158 - i * 3]]);

const squatToFloor: Pose = [[218, 83], [206, 99], [173, 116], [209, 126], [205, 156], [196, 125], [190, 153],
  [197, 129], [164, 154], [182, 128], [147, 153]];
const upright: Pose = [[170, 42], [166, 59], [164, 112], [178, 88], [176, 113], [155, 89], [153, 112],
  [173, 132], [172, 157], [155, 132], [155, 155]];
const pressUp: Pose = change(upright, { 3: [179, 31], 4: [178, 9], 5: [153, 30], 6: [150, 10] });
const tallJump = lift(pressUp, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
const jackJump = change(tallJump, { 3: [183, 30], 4: [192, 17], 5: [140, 31], 6: [130, 20], 7: [185, 125],
  8: [198, 146], 9: [138, 125], 10: [125, 148] });
const advance = (frame: Pose, distance: number): Pose => frame.map(([x,y]) => [x + distance, y]) as Pose;
const longJump = change(advance(tallJump, 40), { 7: [226, 105], 8: [229, 132], 9: [209, 111], 10: [210, 134] });
const longLanding = change(advance(squatToFloor, 50), { 0: [252, 67], 1: [238, 80], 2: [211, 120],
  3: [251, 99], 4: [253, 120], 5: [231, 103], 6: [229, 122] });
const byMode = (kind: "jump" | "jack" | "climber" | "long"): Pose[] => {
  const start = [upright, squatToFloor, floor[0], floor[1], floor[0]];
  if (kind === "climber") start.push(tuck(floor[0], true), tuck(floor[0], false), tuck(floor[0], true), tuck(floor[0], false), floor[0]);
  return kind === "long" ? [...start, squatToFloor, longJump, longLanding, advance(upright, 50)]
    : [...start, squatToFloor, kind === "jack" ? jackJump : tallJump, upright];
};
const splitKneel = (near: boolean): Pose => change(upright, { 0: [174, 66], 1: [171, 80], 2: [166, 122],
  3: [184, 103], 4: [188, 124], 5: [159, 101], 6: [156, 124],
  7: near ? [197, 123] : [146, 154], 8: near ? [204, 156] : [115, 155],
  9: near ? [143, 152] : [187, 120], 10: near ? [112, 154] : [193, 154],
});
const lungePlank = [upright, splitKneel(true), squatToFloor, floor[0], floor[1], floor[0], squatToFloor, splitKneel(true), upright,
  splitKneel(false), squatToFloor, floor[0], floor[1], floor[0], squatToFloor, splitKneel(false)];
const lateral = (frame: Pose) => change(frame, {
  0: [frame[0][0] + 15, frame[0][1] - 3], 1: [frame[1][0] + 15, frame[1][1] - 3], 2: [frame[2][0] + 15, frame[2][1] - 3],
  3: [frame[3][0] + 15, frame[3][1] - 3], 4: [frame[4][0] + 15, frame[4][1] - 3],
  5: [frame[5][0] + 15, frame[5][1] - 3], 6: [frame[6][0] + 15, frame[6][1] - 3],
  7: [frame[7][0] + 15, frame[7][1] - 3], 8: [frame[8][0] + 15, frame[8][1] - 3],
  9: [frame[9][0] + 15, frame[9][1] - 3], 10: [frame[10][0] + 15, frame[10][1] - 3],
});
const stepSide = change(floor[0], {4: lateral(floor[0])[4], 8: lateral(floor[0])[8]});
const sideWalk = [floor[0], floor[1], floor[0], stepSide, lateral(floor[0]), lateral(floor[1]), lateral(floor[0]), stepSide];
const standingStraps = rig(
  change(suspensionIncline[0], { 0: [184, 50], 1: [168, 64], 3: [190, 69], 4: [220, 75], 5: [180, 67], 6: [209, 76] }),
  change(suspensionIncline[1], { 0: [215, 79], 1: [194, 89], 3: [226, 101], 4: [221, 73], 5: [211, 99], 6: [206, 74] }),
);
const dip: Rig = [
  [[217, 41], [205, 59], [200, 108], [202, 99], [205, 143], [191, 97], [192, 138], [201, 133], [181, 144], [191, 132], [171, 142]],
  [[223, 62], [208, 76], [198, 125], [184, 109], [205, 143], [173, 110], [192, 138], [199, 143], [176, 145], [188, 142], [165, 144]],
];
const railTransition = change(equipmentHands[0], { 2: [171, 88], 7: [130, 119], 8: [171, 127], 9: [143, 126], 10: [166, 136] });
const combineBars = [equipmentHands[0], equipmentHands[1], equipmentHands[0], railTransition, dip[0], dip[1], dip[0], railTransition];
const dipRails: Props = [[68, 140, 215, 143], [68, 140, 68, 158], [215, 143, 215, 159], [57, 135, 208, 137], [57, 135, 57, 156], [208, 137, 208, 158]];
const sweepLeg = (near: boolean): Pose => {
  const frame = change(floor[0], { 0: [207, 91], 1: [192, 102], 2: [144, 130] });
  return extend(change(frame, near ? { 9: [186, 136], 10: [221, 146] } : { 7: [184, 127], 8: [221, 138] }), near, "up");
};
const clean = change(upright, { 3: [189, 80], 4: [183, 60], 5: [163, 82], 6: [154, 64] });
const pickup = change(squatToFloor, { 3: [201, 126], 4: [193, 155], 5: [189, 127], 6: [181, 153] });
const cleanse = [...row(equipmentHands), equipmentHands[0], pickup, clean, pressUp, clean, pickup];
const narrowLand = hands(floor, "narrow");
const wideLand = hands(floor, "wide");
const dropCatch = [narrowLand[0], narrowLand[1], lift(wideLand[0], pointsAboveFloor, 12), wideLand[0], wideLand[1],
  lift(narrowLand[0], pointsAboveFloor, 12), narrowLand[0]];
const wGrip: Props = [[202, 155, 211, 150], [193, 154, 184, 149]];
const wElbows = hands(floor, "wide").map((f) => change(f, { 4: [204, 154], 6: [191, 152] })) as Rig;

export const pushupIllustrations: Readonly<Record<string, Illustration>> = {
  "1149": draw(standingStraps, undefined, handStraps),
  "1172": draw(floor, rack, [...supportBand, ["plate", 1, -18, 0]]),
  "1310": draw(dropCatch, undefined, vest, 520),
  "2350": startFormCheck,
  "2351": bottomFormCheck,
  "3457": draw(byMode("jump"), undefined, undefined, 530),
  "3886": draw(cleanse, undefined, dumbbellGrip, 525),
  "3970": draw(byMode("jack"), undefined, undefined, 530),
  "4159": draw(addAfterPress(floor, sweepLeg(true), sweepLeg(false))),
  "4775": draw(combineBars, dipRails, undefined, 670),
  "4858": draw(sideWalk),
  "5187": draw(byMode("long"), undefined, undefined, 590),
  "5337": draw(byMode("climber"), undefined, undefined, 460),
  "0611": draw(lungePlank, undefined, undefined, 540),
  "0665": draw(wElbows, wGrip),
  "0134": draw(sideKnees),
  "0261": draw(sideCorkscrew),
  "0278": draw(feetOnBall, undefined, [["stability-ball", 8, 0, 19]]),
  "0468": draw(tuckedPress(floor)),
  "0654": draw(alternatingTuck(floor)),
  "0657": draw(ballHand("stability"), undefined, [["stability-ball", 6, 0, 17]]),
  "0667": draw(straightLegLift),
  "0681": draw(rotation(knees)),
  "0915": draw(floor, undefined, resistance),
  "10882": draw(airborne(knees), boxerMat, undefined, 530),
  "10950": draw([suspensionPress[0], suspensionPress[0], suspensionPress[0], suspensionPress[1]], undefined, handRings),
  "1115": draw([suspensionPike, invertedLesson[0], invertedLesson[1], invertedLesson[0], suspensionPike], undefined, handStraps),
  "1116": draw(suspensionIncline, undefined, handStraps),
  "1121": draw([suspensionFeet[0], suspensionFeet[1], suspensionFeet[0],
    suspendedTuck(suspensionFeet[0], true), suspendedTuck(suspensionFeet[0], false), suspensionFeet[0]], undefined, ankleStraps),
  "1125": draw(oneHand(suspensionFeet), undefined, ankleStraps),
  "1128": draw(suspensionPress, undefined, handStraps),
  "11315": draw(hands(incline, "narrow"), [...chair, [216, 64, 216, 159]]),
  "1138": draw([suspensionFeet[0], suspendedTuck(suspensionFeet[1], true), suspensionFeet[0],
    suspendedTuck(suspensionFeet[1], false)], undefined, ankleStraps),
  "1146": draw(suspensionStar, undefined, ankleStraps),
  "1174": draw(hands(knees, "narrow")),
  "1311": draw(hands(floor, "wide")),
  "1486": draw(equipmentHands, lowHandles),
  "2740": draw(hands(wallPress, "wide").map((frame) => change(frame, { 4: [238, 75], 6: [238, 99] })), wall),
  "2890": draw(upDown),
  "2895": draw([floor[0], extend(floor[0], true, "forward"), floor[0], extend(floor[0], false, "forward")]),
  "2897": draw([floor[0], birdDog(true), floor[0], birdDog(false)]),
  "2944": draw([bottomSeal, cobra]),
  "2946": draw([oneHand(floor)[0], squeeze(oneHand(floor))]),
  "2961": draw(row(equipmentHands.map((frame) => spread(frame, 8)) as Rig), undefined, dumbbellGrip),
  "3002": draw(oneHand(knees)),
  "3265": draw([knees[0], knees[1], knees[0], child]),
  "3266": draw(upDown),
  "3401": draw(pike, [...platform(62, 127, 104), ...platform(175, 146, 218)]),
  "3402": draw(pikeChairs, [...platform(163, 122, 206), [205, 122, 205, 101], ...platform(178, 127, 223), [223, 127, 223, 104]]),
  "3489": draw([knees[0], knees[1], kneeCobra]),
  "3490": draw(kneeHandsOnBox, plyoBox),
  "3491": draw(feetOnWall, floorWall),
  "3492": draw(rotation(knees)),
  "3553": draw(rotation(floor)),
  "3557": draw(hands(knees, "wide")),
  "3580": draw(raiseHands(floor, 18), undefined, kettlebellGrip),
  "3751": draw(reverse),
  "3784": draw(hands(floor, "cross")),
  "3812": draw(incline, handBox),
  "3824": draw(hands(floor, "lower-ribs")),
  "3906": draw(row(knees)),
  "3910": draw(floor, undefined, vest),
  "3922": draw([floor[0], sideSlide], undefined, sideTowel),
  "3935": draw(bentKneesOnBox, platform(62, 105, 115)),
  "3947": draw([floor[0], prone, releases, prone]),
  "3964": draw(rotation(floor)),
  "3977": draw(addAfterPress(floor, pikeReach(true), pikeReach(false))),
  "3979": draw(addAfterPress(floor, handCross, change(floor[0], { 5: [205, 133], 6: [219, 150] }))),
  "3981": draw(raiseHands(floor, 5), propPressure("fingers")),
  "3984": draw(addAfterPress(floor, pikeReach(true), pikeReach(false))),
  "3985": draw(handStep(floor)),
  "3993": draw(addAfterPress(equipmentHands, extend(equipmentHands[0], true, "forward"), extend(equipmentHands[0], false, "forward")), undefined, dumbbellGrip),
  "4060": draw(addAfterPress(floor, birdDog(true), birdDog(false))),
  "4117": draw([knees[0], squeeze(knees)]),
  "4121": draw(ballHand("medicine"), undefined, [["ball", 6, 0, 8]]),
  "4153": draw([archerTop, arch]),
  "4162": draw(addAfterPress(floor, tuck(floor[0], true), tuck(floor[0], false))),
  "4192": draw(raiseHands(floor, 4), propPressure("fist")),
  "4571": draw(floor, undefined, resistance),
  "4617": draw(oneHand(wallPress), wall),
  "4658": draw(shoulderTaps(knees)),
  "4736": draw(row(raiseHands(floor, 16)), undefined, dumbbellGrip),
  "4807": draw(handStep(floor)),
  "4830": draw([child, knees[1], knees[0], child]),
  "4859": draw(rotation(floor)),
  "4860": draw(alternatingTuck(floor)),
  "4984": draw([hinduStart, knees[1], kneeCobra, knees[1]]),
  "5030": draw(jack, undefined, undefined, 630),
  "5151": draw([handstand[0], handstand[1], kipping, handstand[0]], overheadWall),
  "5278": draw(hands(knees, "staggered")),
  "5460": draw(airborne(floor), undefined, undefined, 530),
  "5556": draw([floor[0], change(floor[0], { 0: [228, 112], 1: [208, 123], 2: [144, 131], 3: [190, 134], 5: [181, 132] }), floor[1], knees[1], knees[0], floor[0]], undefined, undefined, 1_350),
  "5637": draw(incline, handBox),
  "5866": draw(hands(decline, "narrow"), feetBox),
  "5997": draw([prone, floor[0], prone]),
  "6151": draw(hands(equipmentHands, "lower-ribs"), undefined, dumbbellGrip),
  "6231": draw([knees[0], knees[1], knees[0], child]),
  "6537": draw(addAfterPress(floor, pulled, secondPulled)),
  "6550": draw(raiseHands(incline, 24), smith),
  "6910": draw(raiseHands(floor, 13), lowRails),
  "6959": draw(floor, rack, supportBand),
  "6982": draw(floor, [[200, 155, 215, 155], [189, 152, 201, 152], [206, 155, 215, 160], [195, 152, 202, 157]]),
  "6986": draw(airborne(dogWall), wall, undefined, 570),
  "7884": draw(floor, towels),
  "8894": draw(alternatingTuck(floor)),
  "9311": draw(timedHold(hands(floor, "wide"))),
  "9312": draw(raiseHands(incline, 24), tallBar),
  "9316": draw(pikeRings, platform(62, 106, 103), handRings),
  "9325": draw(timedHold(floor)),
  "10050": draw([prone, superman, prone, floor[0]]),
  "10650": draw(airborne(floor), undefined, resistance, 570),
};
