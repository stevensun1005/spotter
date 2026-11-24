import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const eye: Attachments = [["face", 0, 13]];
const update = (frame: Point[], edits: Partial<Record<number, Point>>): Point[] =>
  frame.map((point, i) => edits[i] ?? point);
function controlled(start: Point[], end: Point[], extras: Attachments = [], props: Props = []): Illustration {
  return { frames: [start, end, end, start], ms: 960, dynamic: [...feet, ...eye, ...extras], props, reference: true };
}

const stand: Point[] = [
  [164, 42], [157, 59], [153, 105], [160, 83], [158, 111], [153, 82], [150, 110],
  [159, 130], [157, 154], [150, 128], [146, 154], [171, 157], [159, 157], [171, 40],
];
const onHeels: Point[] = [
  [162, 65], [155, 81], [151, 128], [162, 109], [178, 137], [151, 109], [167, 141],
  [180, 146], [143, 151], [168, 149], [134, 152], [127, 156], [121, 156], [169, 63],
];
function chinRetraction(body: Point[]): Illustration {
  const [head, , , , , , , , , , , , , face] = body;
  return controlled(body, update(body, {0: [head[0] - 8, head[1]], 13: [face[0] - 8, face[1]]}));
}
const standingTuck = chinRetraction(stand);
const heelTuck = chinRetraction(onHeels);

const supineTuck: Point[] = [
  [91, 148], [108, 144], [164, 148], [133, 149], [160, 150], [129, 144], [151, 145],
  [199, 149], [239, 152], [191, 145], [231, 148], [243, 139], [235, 137], [93, 141],
];
const lyingTuck = controlled(supineTuck, update(supineTuck, {0: [96, 148],13: [99, 141]}));

const handsBehind: Point[] = [
  [122, 71], [120, 90], [125, 144], [138, 77], [114, 70], [110, 86], [110, 74],
  [172, 138], [213, 145], [161, 146], [198, 151], [217, 133], [204, 138], [128, 69],
];
const chinToChest = controlled(handsBehind, update(handsBehind, {
  0: [145, 79], 1: [129, 92], 3: [152, 83], 4: [135, 74], 5: [120, 84], 6: [128, 77], 13: [151, 83],
}));

const kneesAndHands: Point[] = [
  [203, 102], [187, 109], [143, 109], [184, 131], [185, 155], [195, 131], [196, 151],
  [143, 153], [112, 153], [153, 150], [123, 150], [103, 156], [111, 154], [209, 104],
];
const kneelingArch = update(kneesAndHands, {
  0: [117, 81], 1: [126, 94], 2: [160, 110], 3: [121, 122], 4: [114, 148],
  5: [131, 124], 6: [125, 148], 13: [114, 74],
});
const ceilingLook: Illustration = {
  frames: [kneesAndHands, update(kneesAndHands, {
    0:[158, 95],1:[152,105],2:[155,111],3:[144,131],4:[139,153],5:[152,132],6:[151,152],13:[162,89],
  }), kneelingArch, kneelingArch, kneelingArch],
  ms: 1030, reference: true, dynamic: [...feet, ...eye],
};

const floorSit: Point[] = [
  [154, 85], [149, 102], [166, 143], [127, 127], [108, 154], [139, 130], [125, 152],
  [198, 139], [171, 152], [191, 130], [207, 144], [160, 147], [216, 139], [160, 83],
];
const skyLook = controlled(floorSit, update(floorSit, {
  0: [124, 87], 1: [137, 101], 3: [120, 128], 5: [134, 129], 13: [125, 79],
}));

const sideBench: Props = [
  [116, 118, 190, 133], [116, 123, 190, 138], [190, 136, 211, 140], [127, 123, 111, 155],
  [111, 155, 104, 155], [181, 139, 193, 156], [185, 156, 203, 156],
];
const loadedSide: Point[] = [
  [107, 116], [123, 104], [179, 123], [147, 125], [119, 111], [155, 117], [166, 128],
  [199, 136], [204, 155], [206, 133], [211, 149], [218, 157], [224, 152], [103, 112],
  [105, 121], [105, 143],
];
const loadedRaised = update(loadedSide, {0:[112,93],13:[107,91],14:[110,98],15:[110,142]});
const sideHeadHarness = controlled(loadedSide, loadedRaised,
  [["head-strap", 0, 0, -4], ["line", 14, 15], ["plate", 15, 0, 5]], sideBench);

export const neckSourceIllustrations: Record<string, Illustration> = {
  "0250": ceilingLook,
  "0838": sideHeadHarness,
  "3149": standingTuck,
  "4509": chinToChest,
  "5062": lyingTuck,
  "5063": heelTuck,
  "5081": skyLook,
};
