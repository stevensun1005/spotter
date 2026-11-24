import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const update = (frame: Point[], edits: Partial<Record<number, Point>>): Point[] =>
  frame.map((point, i) => edits[i] ?? point);
function loop(frames: Point[][], ms: number, dynamic: Attachments = [], props: Props = []): Illustration {
  return { frames, ms, dynamic: [...feet, ...dynamic], props, reference: true };
}
const hands: Attachments = [["hand", 4, 13, 14], ["hand", 6, 15, 16]];

const squeeze: Point[] = [
  [163, 76], [163, 91], [163, 135], [140, 107], [117, 108], [186, 107], [209, 107],
  [133, 135], [170, 151], [193, 135], [157, 148], [181, 151], [147, 149],
  [105, 104], [111, 110], [219, 104], [213, 110], [150, 93], [176, 93],
];
const reach = update(squeeze, {
  3: [140, 67], 4: [140, 41], 5: [186, 67], 6: [186, 41],
  13: [145, 25], 14: [143, 33], 15: [182, 25], 16: [183, 33],
});
const pulse = update(squeeze, {
  3: [138, 103], 4: [114, 102], 5: [188, 103], 6: [212, 103],
  13: [100, 98], 14: [108, 105], 15: [226, 98], 16: [216, 106],
  17: [149, 91], 18: [177, 91],
});
const backSqueeze = { ...loop([reach, squeeze, squeeze, reach], 850, hands), shoulders: [17, 18] as [number, number] };
const backPulse = { ...loop([squeeze, pulse, squeeze, pulse], 520, hands), shoulders: [17, 18] as [number, number] };

const rotation: Point[] = [
  [163, 50], [163, 66], [162, 104], [125, 69], [95, 70], [198, 67], [229, 66],
  [174, 129], [174, 154], [149, 130], [147, 154], [186, 156], [158, 156],
  [82, 70], [88, 76], [243, 67], [236, 73], [148, 69], [178, 68],
];
const rotated = update(rotation, {
  3: [126, 82], 4: [97, 104], 5: [197, 80], 6: [228, 100],
  13: [84, 111], 14: [89, 102], 15: [242, 107], 16: [234, 98],
});
const palmRotation = { ...loop([rotation, rotated, rotated, rotation], 920, hands), shoulders: [17, 18] as [number, number] };

const scalene: Point[] = [
  [101, 146], [118, 144], [167, 146], [93, 150], [63, 151], [148, 139], [128, 149],
  [202, 140], [185, 151], [207, 138], [193, 149], [175, 155], [183, 153], [98, 151],
];
const scaleneLift = update(scalene, { 0: [106, 132], 13: [100, 136] });
const scaleneActivation = loop([scalene, scaleneLift, scaleneLift, scalene], 1020, [["face", 0, 13]]);

const ball: Point = [162, 133];
const sphere: Props = [];
for (let index = 0; index < 20; index++) {
  const a = Math.PI * index / 10, b = Math.PI * (index + 1) / 10;
  sphere.push([ball[0] + 24 * Math.cos(a), ball[1] + 24 * Math.sin(a),
    ball[0] + 24 * Math.cos(b), ball[1] + 24 * Math.sin(b)]);
}
const ballNeutral: Point[] = [
  [117, 101], [134, 106], [191, 112], [142, 97], [122, 91], [152, 90], [165, 87],
  [220, 121], [232, 155], [207, 121], [215, 154], [247, 157], [226, 156], [113, 95],
];
const ballDrape = update(ballNeutral, {
  0: [109, 109], 1: [128, 107], 3: [110, 113], 4: [89, 116], 5: [136, 88], 6: [110, 80], 13: [109, 103],
});
const ballStretch = loop([ballNeutral, ballDrape, ballDrape, ballDrape, ballNeutral], 1260, [["face", 0, 13]], sphere);

const chair: Props = [[67, 116, 114, 116], [72, 116, 72, 157], [110, 116, 110, 157], [72, 115, 68, 79]];
const sittingBase: Point[] = [
  [90, 55], [84, 74], [91, 107], [103, 91], [131, 104], [98, 94], [122, 105],
  [130, 113], [161, 151], [117, 111], [111, 154], [165, 138], [127, 157],
];
const floorBase: Point[] = [
  [84, 71], [77, 89], [92, 146], [65, 123], [56, 156], [75, 122], [64, 155],
  [130, 145], [177, 153], [123, 148], [163, 154], [179, 139], [174, 154],
];
const foot: Point[] = [
  [220, 108], [232, 131], [236, 153], [253, 141], [263, 130],
  [274, 122], [274, 128], [272, 133],
];
const curl = update(foot, {5: [268, 137],6: [267, 142],7: [263, 144]});
const press = update(foot, {3: [254, 147],4: [265, 151],5: [279, 154],6: [276, 154],7: [272, 155]});
const toeArt: Attachments = [
  ["digit", 13, 14, 10], ["digit", 14, 15, 10],
  ["digit", 15, 16, 10], ["digit", 16, 17, 9],
  ["digit", 17, 18, 5], ["digit", 17, 19, 4], ["digit", 17, 20, 4],
];
function toeMove(body: Point[], workingFoot: Point[], props: Props, pressedBody = body): Illustration {
  return loop([[...body, ...foot], [...pressedBody, ...workingFoot], [...pressedBody, ...workingFoot], [...body, ...foot]],
    720, toeArt, props);
}

export const dailyMobilityIllustrations: Record<string, Illustration> = {
  "1315": ballStretch,
  "5080": palmRotation,
  "5128": backSqueeze,
  "5132": backPulse,
  "6753": scaleneActivation,
  "10912": toeMove(floorBase, curl, []),
  "10918": toeMove(sittingBase, curl, chair),
  "10920": toeMove(sittingBase, press, chair, update(sittingBase, {11: [175, 156]})),
};
