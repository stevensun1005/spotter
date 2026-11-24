import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;

// The head pad stays against the side of the head while the plate-loaded lever pivots.
// https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/4-way-neck
function loadedNeck(side: "left" | "right"): Illustration {
  const mirror = ([x, y]: Point): Point => [side === "left" ? x : 320 - x, y];
  const make = (tilted: boolean): Point[] => {
    const head: Point = tilted ? [173, 52] : [160, 47];
    const pad: Point = tilted ? [181, 53] : [168, 47];
    const pivot: Point = [220, 82];
    const plate: Point = tilted ? [239, 94] : [235, 101];
    const joints: Point[] = [head, [160, 71], [160, 111], [183, 91], [182, 109], [138, 91], [137, 112],
      [177, 120], [183, 154], [143, 120], [137, 154],
      [head[0] - 3, head[1] - 2], [head[0] + 3, head[1] + (tilted ? 1 : -2)],
      pad, pivot, plate, [194, 158], [126, 158]];
    return joints.map(mirror);
  };
  const props: Props = [[135, 116, 184, 116], [148, 117, 148, 157], [174, 117, 174, 157],
    [124, 157, 239, 157], [220, 155, 220, 82], [215, 82, 225, 82]];
  const chassis = props.map(([x1, y1, x2, y2]): Props[number] => [mirror([x1, y1])[0], y1, mirror([x2, y2])[0], y2]);
  return {
    frames: [make(false), make(true)], props: chassis,
    dynamic: [["bar", 13, 14], ["line", 14, 15], ["pad", 13, 0, 0], ["barbell-end", 15, 0, 0],
      ["face", 0, 11], ["face", 0, 12], ["foot-tip", 8, 16], ["foot-tip", 10, 17]],
    ms: 1150, reference: true,
  };
}

// Original diagram of the moving knee carriage on the curved track.
// https://theabscompany.com/blogs/news/best-at-home-ab-workouts
const coaster: Illustration = {
  props: [
    [82, 157, 238, 157], [225, 157, 225, 66], [207, 76, 223, 76], [189, 77, 207, 77], [211, 62, 230, 62],
    [95, 151, 127, 148], [127, 148, 155, 140], [155, 140, 179, 126], [179, 126, 202, 104], [202, 104, 216, 84],
    [92, 155, 92, 151], [143, 153, 143, 145], [182, 153, 182, 123],
  ],
  frames: [
    [[195, 48], [187, 65], [137, 104], [194, 75], [218, 62], [204, 74], [226, 62],
      [133, 141], [100, 140], [124, 144], [92, 145], [123, 145], [146, 141], [89, 150], [83, 150]],
    [[194, 48], [188, 65], [147, 92], [194, 75], [218, 62], [204, 74], [226, 62],
      [164, 128], [130, 139], [155, 135], [122, 142], [153, 135], [175, 128], [120, 147], [113, 148]],
    [[195, 48], [188, 65], [155, 83], [194, 75], [218, 62], [204, 74], [226, 62],
      [190, 107], [167, 130], [185, 112], [159, 134], [180, 117], [199, 103], [159, 140], [149, 143]],
  ],
  dynamic: [["bar", 11, 12], ["foot-tip", 8, 13], ["foot-tip", 10, 14]],
  ms: 700, reference: true,
};

// Chest-supported setup matches the exact exercise steps and the independently published variation.
// https://fitwill.app/exercise/7592/cable-incline-rear-delt-fly-with-back-support/
const chestSupportedCableFly: Illustration = {
  frames: [
    [[167, 49], [161, 64], [147, 110], [173, 85], [157, 102], [144, 85], [169, 101],
      [175, 129], [185, 154], [137, 132], [137, 154], [194, 158], [126, 158]],
    [[167, 49], [161, 64], [147, 110], [191, 70], [217, 66], [133, 70], [107, 66],
      [175, 129], [185, 154], [137, 132], [137, 154], [194, 158], [126, 158]],
  ],
  props: [[167, 73, 146, 118], [137, 120, 166, 120], [154, 92, 154, 156], [129, 156, 177, 156],
    [75, 28, 75, 156], [246, 28, 246, 156], [66, 156, 85, 156], [235, 156, 256, 156],
    [70, 67, 80, 67], [241, 67, 251, 67]],
  dynamic: [["cable", 4, 75, 67], ["cable", 6, 246, 67], ["foot-tip", 8, 11], ["foot-tip", 10, 12]],
  ms: 970, reference: true,
};

// The working arm presses from the side of the machine across the chest.
// https://fitwill.app/exercise/5815/lever-one-arm-side-chest-press/
const sideChestPress: Illustration = {
  frames: [
    [[152, 46], [152, 64], [152, 112], [122, 78], [125, 66], [137, 89], [139, 114],
      [173, 120], [183, 154], [137, 120], [132, 155], [168, 141], [196, 158], [121, 158]],
    [[152, 46], [152, 64], [152, 112], [181, 70], [211, 66], [137, 89], [139, 114],
      [173, 120], [183, 154], [137, 120], [132, 155], [168, 141], [196, 158], [121, 158]],
  ],
  props: [[133, 118, 174, 118], [143, 119, 143, 157], [164, 119, 164, 157], [132, 109, 136, 113],
    [135, 65, 132, 111], [94, 155, 237, 155], [101, 113, 101, 155], [232, 113, 232, 155], [168, 141, 211, 152]],
  dynamic: [["bar", 4, 11], ["plate", 11, 3, 0], ["foot-tip", 8, 12], ["foot-tip", 10, 13]],
  ms: 970, reference: true,
};

// Dip-belt implementation of a weighted bent-over donkey calf raise.
// https://archive.t-nation.com/training/tip-do-the-donkey-calf-raise/
const weightedDonkeyCalf: Illustration = {
  frames: [
    [[115, 76], [129, 89], [184, 96], [119, 109], [101, 110], [127, 109], [111, 109],
      [184, 123], [179, 146], [175, 124], [170, 147], [168, 141], [159, 141], [185, 122]],
    [[115, 76], [129, 89], [184, 86], [119, 109], [101, 110], [127, 109], [111, 109],
      [182, 112], [178, 133], [173, 113], [170, 133], [168, 141], [159, 141], [185, 112]],
  ],
  props: [[90, 112, 119, 112], [95, 112, 95, 158], [107, 112, 107, 158],
    [152, 142, 170, 142], [152, 142, 152, 158], [170, 142, 170, 158]],
  dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ["line", 2, 13], ["plate", 13, 0, 3]],
  ms: 950, reference: true,
};

export const documentedMachineIllustrations: Record<string, Illustration> = {
  "2283": loadedNeck("left"),
  "2284": loadedNeck("right"),
  "5583": coaster,
  "7592": chestSupportedCableFly,
  "5815": sideChestPress,
  "0833": weightedDonkeyCalf,
};
