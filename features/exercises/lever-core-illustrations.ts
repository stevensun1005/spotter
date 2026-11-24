import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const change = (pose: Point[], joints: Partial<Record<number, Point>>) => pose.map((p, i) => joints[i] ?? p);
const clip = (frames: Point[][], props: Props, dynamic: Attachments, spine?: number[]): Illustration => ({
  frames, props, dynamic, spine, ms: 1010, reference: true,
});

const seated: Point[] = [[137, 40], [139, 60], [143, 111], [168, 78], [169, 64],
  [157, 78], [157, 63], [178, 112], [182, 151], [166, 111], [169, 153]];
const stack: Props = [[217, 31, 217, 155], [243, 31, 243, 155], [217, 31, 243, 31], [217, 155, 243, 155],
  [220, 132, 239, 132], [220, 139, 239, 139], [220, 146, 239, 146]];
const seat: Props = [[124, 117, 170, 117], [132, 117, 132, 155], [165, 117, 165, 155],
  [115, 156, 202, 156], [131, 114, 129, 66], [171, 104, 193, 104], [193, 104, 193, 155]];

function flexion(load: "hands-pad" | "bar" | "plate"): Illustration {
  const tall = load === "hands-pad"
    ? change(seated, { 3: [164, 85], 4: [185, 83], 5: [153, 84], 6: [176, 82] }) : seated;
  const curved = change(tall, { 0: [175, 74], 1: [158, 76],
    3: [170, 103], 4: [183, load === "hands-pad" ? 105 : 88], 5: [160, 100], 6: [173, load === "hands-pad" ? 104 : 86] });
  const props = [...seat, [203, 93, 203, 156], [199, 93, 207, 93]] as Props;
  if (load !== "plate") props.push(...stack);
  const details = (p: Point[], curled: boolean): Point[] => [...p, [curled ? 149 : 143, curled ? 90 : 85],
    [load === "hands-pad" ? p[4][0] + 6 : p[1][0] + 8, load === "hands-pad" ? p[4][1] : p[1][1] + 15],
    [203, 93], [curled ? 224 : 229, curled ? 111 : 102]];
  const lever: Attachments = [["bar", 12, 13], ["pad", 12, 0, 0], ["pad", 7, 2, -7]];
  if (load !== "hands-pad") lever.push(["bar", 4, 6]);
  if (load === "plate") lever.push(["bar", 13, 14], ["plate", 14, 0, 0]);
  else lever.push(["line", 13, 229, 67]);
  return clip([details(tall, false), details(curved, true), details(curved, true)], props, lever, [11]);
}

function sideFlex(direction: "left" | "right"): Illustration {
  const d = direction === "left" ? 1 : -1;
  const front: Point[] = [[150, 42], [150, 64], [150, 110], [180, 76], [171, 62], [119, 76], [129, 62],
    [169, 117], [170, 152], [129, 117], [129, 152]];
  const bow = change(front, { 0: [150 + 42 * d, 63], 1: [150 + 24 * d, 73],
    3: [180 + 22 * d, 79 + d * 10], 4: [172 + 20 * d, 64 + d * 8],
    5: [119 + 22 * d, 79 - d * 10], 6: [128 + 20 * d, 64 - d * 8] });
  const rig: Props = [[113, 116, 186, 116], [119, 119, 119, 156], [185, 119, 185, 156],
    [112, 156, 191, 156], [103, 110, 193, 110], [150, 108, 150, 156], ...stack];
  const features = (p: Point[], moved: boolean): Point[] => [...p, [150 + (moved ? 6 * d : 0), 89],
    [p[0][0] - 3, p[0][1] - 1], [p[0][0] + 3, p[0][1] - 1], [150, 111], [p[1][0], p[1][1] + 20]];
  return clip([features(front, false), features(bow, true), features(bow, true)], rig,
    [["bar", 4, 6], ["bar", 14, 15], ["pad", 15, 0, 0], ["face", 0, 12], ["face", 0, 13]], [11]);
}

type RotateSupport = "seat" | "padded-seat" | "platform";
function turnMachine(mode: RotateSupport, bothSides = true): Illustration {
  const standing = mode === "platform";
  const hip: Point = [145, standing ? 100 : 112];
  const y = standing ? 57 : 61;
  const props: Props = standing
    ? [[102, 151, 207, 151], [104, 151, 104, 157], [207, 151, 207, 157], [103, 154, 207, 154], [207, 75, 207, 151], ...stack]
    : [[112, 117, 177, 117], [117, 117, 117, 155], [173, 117, 173, 155], [109, 155, 201, 155],
      [123, 114, 123, 65], [187, 73, 187, 156], [150, 102, 187, 102], ...stack];
  const at = (rotation: number): Point[] => {
    const x = 146 + rotation * 8;
    const near: Point = [176 + rotation * 21, y + 19];
    const far: Point = [136 + rotation * 22, y + 19];
    return [[x, y - 19], [x, y], hip,
      [174 + rotation * 16, y + (standing ? 13 : 8)], near,
      [126 + rotation * 17, y + (standing ? 13 : 8)], far,
      standing ? [158, 125] : [171, 116], standing ? [160, 147] : [176, 151],
      standing ? [132, 125] : [152, 116], standing ? [132, 147] : [158, 150],
      [x - 3 + rotation * 3, y - 20], [x + 3 + rotation * 3, y - 20],
      [near[0], y + 29], [far[0], y + 29], [standing ? 207 : 187, y + 15]];
  };
  const handle: Attachments = [["line", 4, 13], ["line", 6, 14], ["bar", 13, 14], ["line", 13, 15],
    ["face", 0, 11], ["face", 0, 12]];
  if (mode === "padded-seat") handle.push(["pad", 7, 3, -7], ["pad", 9, -1, -7], ["pad", 3, 3, 3], ["pad", 5, -3, 3]);
  const front = at(0), end = at(1);
  return clip(bothSides ? [front, end, end, front, at(-1), at(-1)] : [front, end, end, front], props, handle);
}

// Same-ID publisher documents a kneeling lever, with the legs fixed to the pad.
// https://fitwill.app/exercise/6561/lever-ab-swing/
const kneelingAbSwing = (() => {
  const rack: Props = [[91, 156, 238, 156], [111, 140, 161, 140], [116, 140, 116, 156],
    [154, 140, 154, 156], [204, 52, 204, 156], [197, 52, 212, 52], [179, 74, 206, 75]];
  const tall: Point[] = [[160, 46], [156, 64], [142, 112], [169, 85], [187, 72], [161, 83], [180, 71],
    [148, 135], [122, 136], [140, 135], [114, 135], [152, 89], [179, 84], [204, 53]];
  const crunch = change(tall, { 0: [182, 88], 1: [168, 89], 3: [162, 116], 4: [184, 105],
    5: [158, 112], 6: [177, 103], 11: [151, 93], 12: [173, 111] });
  return clip([tall, crunch, crunch], rack, [["bar", 12, 13], ["pad", 12, 0, 0], ["bar", 4, 6]], [11]);
})();

export const leverCoreIllustrations: Record<string, Illustration> = {
  "2268": flexion("hands-pad"),
  "3881": flexion("bar"),
  "3882": sideFlex("left"),
  "3883": sideFlex("right"),
  "1857": flexion("plate"),
  "1453": turnMachine("seat"),
  "10065": turnMachine("padded-seat"),
  "5333": turnMachine("padded-seat", false),
  "0608": turnMachine("platform"),
  "6561": kneelingAbSwing,
};
