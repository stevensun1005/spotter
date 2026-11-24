import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const update = (frame: Point[], edits: Partial<Record<number, Point>>): Point[] =>
  frame.map((point, i) => edits[i] ?? point);
function clip(frames: Point[][], ms: number, extra: Attachments = [], props: Props = []): Illustration {
  return { frames, ms, dynamic: [...feet, ...extra], props, reference: true };
}

const stand: Point[] = [
  [168, 52], [158, 67], [150, 106], [163, 83], [164, 108], [151, 84], [150, 107],
  [158, 131], [160, 153], [144, 129], [144, 153], [175, 157], [157, 156],
];
const squat: Point[] = [
  [197, 96], [182, 109], [150, 121], [181, 133], [184, 153], [173, 134], [173, 151],
  [174, 140], [161, 154], [163, 138], [149, 151], [176, 156], [163, 154],
];
const highPlank: Point[] = [
  [211, 101], [196, 115], [144, 132], [197, 134], [196, 154], [184, 134], [182, 151],
  [111, 141], [80, 148], [111, 137], [81, 143], [76, 157], [77, 153],
];
const compact = update(highPlank, {
  0: [209, 94], 1: [194, 108], 2: [156, 110], 3: [196, 131], 5: [186, 131],
  7: [172, 138], 8: [143, 153], 9: [163, 135], 10: [136, 151], 11: [157, 157], 12: [150, 155],
});
const thrust = clip([highPlank, highPlank, compact, compact, highPlank], 470);
const air = update(stand, {
  0: [164, 35], 1: [155, 51], 2: [151, 91], 3: [166, 29], 4: [168, 12], 5: [152, 29], 6: [154, 12],
  7: [154, 117], 8: [153, 140], 9: [145, 116], 10: [143, 138], 11: [160, 148], 12: [150, 145],
});
const jack = update(highPlank, {
  7: [101, 145], 8: [66, 154], 9: [112, 128], 10: [82, 131], 11: [75, 159], 12: [78, 137],
});
const jackBurpee = clip([squat, highPlank, jack, highPlank, squat, air, squat], 490);
const burpee = clip([stand, squat, highPlank, highPlank, squat, air, stand], 570);
const dumbbellHop = update(air, {
  3: [162, 72], 4: [162, 96], 5: [147, 73], 6: [147, 94],
});
const dumbbellSquat = update(squat, {4:[184,147],6:[173,145]});
const dumbbellPlank = update(highPlank, {0:[200,101],1:[184,115],3:[184,132],4:[184,147],5:[174,132],6:[173,145]});
const dumbbellBurpee = clip([stand, dumbbellSquat, dumbbellPlank, dumbbellPlank, dumbbellSquat, dumbbellHop, stand], 570,
  [["dumbbell", 4, 0, 7], ["dumbbell", 6, 0, 7]]);

const kneeReady = update(stand, {0:[170,52],3:[170,86],4:[184,78],5:[150,86],6:[163,85]});
const kneeActive = update(kneeReady, {
  3: [160, 84], 4: [170, 84], 5: [165, 84], 6: [184, 74],
  7: [182, 106], 8: [177, 131], 11: [189, 134],
});
const kneeBounce = update(kneeReady, {0:[167,57],1:[157,73],2:[148,110],7:[163,131],9:[152,131]});
const oppositeKnee = (frame: Point[]) => [0,1,2,5,6,3,4,9,10,7,8,12,11].map(index => frame[index]);
const alternatingKnees = clip([kneeReady,kneeActive,kneeBounce,oppositeKnee(kneeActive),kneeBounce], 485);

const tower: Props = [
  [82, 22, 82, 157], [103, 22, 103, 157], [82, 22, 103, 22], [73, 157, 115, 157],
  [89, 42, 89, 151], [97, 42, 97, 151], [89, 103, 97, 103], [89, 110, 97, 110],
  [89, 117, 97, 117], [89, 124, 97, 124], [89, 131, 97, 131], [91, 27, 105, 29],
];
const highCable = (hands: [Point, Point], elbows: [Point, Point], torso: Point[]): Point[] => [
  ...torso, elbows[0], hands[0], elbows[1], hands[1],
  [188, 132], [187, 155], [206, 130], [205, 153], [173, 158], [193, 155],
  [(hands[0][0] + hands[1][0]) / 2, (hands[0][1] + hands[1][1]) / 2],
  [hands[0][0] - 4, hands[0][1] + 4], [hands[1][0] - 3, hands[1][1] + 4],
];
const kayakReady = highCable([[134, 65], [161, 64]], [[158, 71], [179, 71]], [[184, 49], [192, 68], [196, 106]]);
const kayakNear = highCable([[185, 119], [160, 102]], [[194, 93], [175, 85]], [[190, 55], [200, 72], [198, 106]]);
const kayakFar = highCable([[156, 104], [183, 120]], [[171, 86], [194, 93]], [[183, 52], [193, 70], [193, 106]]);
const kayak = clip([kayakReady, kayakNear, kayakReady, kayakFar], 830,
  [["cable", 13, 103, 29], ["bar", 4, 6], ["palm-down", 4, 14], ["palm-down", 6, 15]], tower);

const highBar: Props = [
  [80, 41, 255, 41], [80, 41, 80, 157], [255, 41, 255, 157],
  [69, 157, 91, 157], [243, 157, 267, 157],
];
const hanging: Point[] = [
  [160, 77], [162, 88], [173, 117], [151, 65], [143, 41], [178, 65], [177, 41],
  [183, 137], [190, 150], [176, 138], [181, 151], [200, 153], [190, 154], [156, 75], [153, 90], [172, 88],
];
const swing: Point[] = [
  [142, 72], [153, 79], [130, 84], [151, 62], [143, 41], [171, 62], [177, 41],
  [112, 67], [103, 53], [106, 71], [96, 59], [111, 47], [102, 52], [139, 68], [145, 78], [160, 80],
];
const release: Point[] = [
  [159, 51], [169, 65], [194, 87], [147, 66], [127, 66], [181, 63], [189, 72],
  [204, 109], [227, 122], [196, 107], [210, 126], [237, 127], [219, 131], [161, 47], [159, 63], [174, 68],
];
const turning: Point[] = [
  [180, 55], [176, 69], [180, 101], [158, 71], [149, 54], [191, 81], [176, 86],
  [207, 94], [227, 100], [174, 122], [171, 145], [237, 105], [181, 147], [184, 52], [170, 68], [183, 69],
];
const catchBar: Point[] = [
  [174, 75], [175, 88], [177, 117], [161, 64], [143, 41], [178, 65], [177, 41],
  [197, 130], [218, 140], [179, 133], [183, 150], [225, 147], [192, 153], [169, 73], [166, 87], [183, 87],
];
const bar360 = {
  ...clip([hanging, swing, release, turning, catchBar, hanging], 540, [["face", 0, 13]], highBar),
  shoulders: [14, 15] as [number, number],
};

export const originalDrillCorrections: Record<string, Illustration> = {
  "0501": jackBurpee,
  "1160": burpee,
  "1201": dumbbellBurpee,
  "2464": kayak,
  "3221": alternatingKnees,
  "3318": bar360,
  "3705": thrust,
};
