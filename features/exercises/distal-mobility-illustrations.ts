import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const update = (frame: Point[], changes: Partial<Record<number, Point>>): Point[] =>
  frame.map((point, index) => changes[index] ?? point);

function hold(entry: Point[], final: Point[], dynamic: Attachments, props: Props = []): Illustration {
  return { frames: [entry, final, final, final], ms: 1170, dynamic: [...feet, ...dynamic], props, reference: true };
}

const wristFloor: Point[] = [
  [133, 69], [123, 86], [119, 146], [107, 124], [103, 155], [141, 118], [161, 132],
  [168, 141], [229, 143], [166, 147], [214, 151], [233, 128], [218, 135],
  [88, 157], [104, 152], [172, 136], [168, 130],
];
const wristPress = update(wristFloor, {
  0: [122, 69], 1: [111, 86], 2: [116, 149], 3: [106, 124], 5: [130, 122], 6: [159, 135],
  15: [170, 139], 16: [166, 133],
});
const wristStretch = hold(wristFloor, wristPress, [["hand", 4, 13, 14], ["hand", 6, 15, 16]]);

const thumbStanding: Point[] = [
  [107, 46], [100, 63], [94, 105], [112, 88], [130, 70], [107, 87], [140, 79],
  [103, 132], [103, 155], [85, 131], [83, 154], [119, 158], [98, 156],
  [131, 57], [137, 65], [136, 69], [130, 76],
];
const thumbStandingHeld = update(thumbStanding, {
  6: [148, 73], 14: [148, 65], 15: [146, 66], 16: [151, 65],
});
const thumbPalmArt: Attachments = [
  ["digit", 17, 18, 11], ["digit", 18, 19, 19],
  ["digit", 19, 20, 5], ["digit", 19, 21, 5], ["digit", 19, 22, 5], ["digit", 19, 23, 4],
  ["digit", 18, 24, 7], ["digit", 24, 25, 6], ["digit", 25, 26, 5],
];
const openPalm: Point[] = [
  [221, 140], [223, 116], [225, 97],
  [215, 70], [223, 64], [232, 66], [240, 74], [234, 111], [244, 96], [249, 82],
];
const liftedPalm = update(openPalm, { 8: [250, 104], 9: [262, 93] });
const uprightDetail = (wrist: Point, caught: boolean): Point[] =>
  [wrist, [267, caught ? 104 : 117], [caught ? 261 : 255, caught ? 93 : 110], [caught ? 268 : 263, caught ? 94 : 112]];
const assistedThumb = hold(
  [...thumbStanding, ...openPalm, ...uprightDetail([285, 126], false)],
  [...thumbStandingHeld, ...liftedPalm, ...uprightDetail([286, 123], true)],
  [["hand", 4, 13, 14], ["hand", 6, 15, 16], ...thumbPalmArt,
    ["digit", 27, 28, 10], ["hand", 28, 29, 30]],
);

const frameAway: Point[] = [
  [71, 70], [68, 88], [68, 134], [86, 106], [113, 115], [85, 105], [106, 116],
  [106, 139], [116, 124], [48, 146], [30, 152], [121, 110], [21, 155],
  [117, 111], [114, 117], [113, 112], [109, 119],
];
const toeContour: Point[] = [
  [228, 141], [227, 120], [227, 100],
  [210, 77], [218, 72], [227, 73], [235, 78], [242, 83],
  [267, 51], [244, 62], [237, 76], [228, 70], [219, 69], [209, 74], [197, 90],
];
const spread = update(toeContour, {
  3: [206, 75], 4: [218, 66], 5: [228, 69], 6: [238, 75], 7: [247, 83],
  9: [235, 62], 10: [237, 75], 11: [223, 69], 12: [211, 71], 13: [205, 76],
});
const toeSpread = hold(
  [...frameAway, ...toeContour],
  [...update(frameAway, {4:[118, 113],6:[109, 115],13:[123, 107],15:[115, 110]}), ...spread],
  [
    ["hand", 4, 13, 14], ["hand", 6, 15, 16],
    ["digit", 17, 18, 15], ["digit", 18, 19, 24], ["digit", 19, 20, 9], ["digit", 19, 21, 7],
    ["digit", 19, 22, 6], ["digit", 19, 23, 6], ["digit", 19, 24, 5], ["digit", 25, 26, 12],
    ["digit", 26, 27, 5], ["digit", 26, 28, 5], ["digit", 26, 29, 5], ["digit", 26, 30, 5],
    ["digit", 26, 31, 5],
  ],
);

const hidden: Point[] = Array.from({ length: 11 }, () => [-45, -45]);
const activePalm: Point[] = [
  [83, 107], [124, 104], [157, 101], [180, 91], [189, 98], [188, 106], [180, 114],
  [144, 88], [156, 80], [165, 75],
];
const activeOpen = update(activePalm, {8: [149, 67], 9: [154, 57]});
const thumbAbduction: Illustration = {
  frames: [[...hidden, ...activePalm], [...hidden, ...activeOpen], [...hidden, ...activeOpen]],
  dynamic: [
    ["digit", 11, 12, 14], ["digit", 12, 13, 20],
    ["digit", 13, 14, 6], ["digit", 13, 15, 6], ["digit", 13, 16, 5], ["digit", 13, 17, 5],
    ["digit", 12, 18, 8], ["digit", 18, 19, 6], ["digit", 19, 20, 5],
  ],
  props: [[73, 118, 222, 118], [82, 122, 82, 141], [210, 122, 210, 141]],
  topView: true, ms: 1040, reference: true,
};

const frontBridge: Point[] = [
  [187, 148], [187, 126], [139, 69], [166, 106], [169, 153], [155, 111], [153, 152],
  [121, 103], [78, 144], [115, 101], [72, 143], [68, 157], [62, 155],
  [181, 155], [173, 150], [164, 155], [155, 148],
];
const bridgeShift = update(frontBridge, {
  0: [188, 149], 1: [188, 128], 2: [146, 65], 3: [168, 102], 5: [159, 108],
  7: [124, 103], 9: [120, 101],
});
const frontNeckBridge = hold(frontBridge, bridgeShift, [["hand", 4, 13, 14], ["hand", 6, 15, 16]]);

export const distalMobilityIllustrations: Record<string, Illustration> = {
  "0633": frontNeckBridge,
  "2093": wristStretch,
  "2094": assistedThumb,
  "2103": toeSpread,
  "10032": thumbAbduction,
};
