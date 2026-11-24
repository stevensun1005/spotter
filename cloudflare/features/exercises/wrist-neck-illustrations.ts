import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Grip = "palm-up" | "palm-down" | "thumb-up";
type WristSet = "standing" | "behind" | "seated" | "prone-incline" | "kneel-bench" | "table";
type WristGear = "none" | "bar" | "ez-bar" | "bell" | "dumbbell" | "weight" | "cable";

const chair: Props = [[102, 113, 147, 113], [108, 113, 108, 159], [142, 113, 142, 159], [102, 113, 102, 68]];
const floor: Props = [[78, 159, 230, 159]];
function wristCurl(set: WristSet, grip: Grip, gear: WristGear, single = false, hold = false): Illustration {
  const standing = set === "standing" || set === "behind";
  let body: Point[] = [[134, 46], [134, 63], [135, 107], [143, 91], [146, 117], [127, 92], [130, 116], [145, 132], [145, 157], [127, 133], [128, 157]];
  let props: Props = [];
  if (set === "behind") {
    body[3] = [119, 91]; body[4] = [113, 118]; body[5] = [110, 93]; body[6] = [105, 117];
  } else if (set === "seated" || set === "table") {
    body = [[125, 47], [128, 65], [127, 108], [155, 102], [191, 101], [146, 103], [179, 103], [179, 108], [169, 156], [162, 109], [154, 157]];
    props = [...chair, ...(set === "table" ? [[144, 104, 184, 104], [149, 104, 149, 158], [180, 104, 180, 158]] as Props : [])];
  } else if (set === "prone-incline") {
    body = [[145, 51], [134, 66], [103, 112], [160, 104], [160, 134], [147, 104], [148, 134], [115, 134], [118, 156], [95, 135], [94, 156]];
    props = [[92, 111, 123, 67], [92, 111, 75, 111], [85, 111, 85, 158], [120, 70, 135, 158]];
  } else if (set === "kneel-bench") {
    body = [[126, 71], [122, 86], [109, 123], [145, 102], [180, 103], [137, 104], [172, 104], [112, 154], [81, 157], [100, 154], [70, 157]];
    props = [[135, 107, 174, 107], [139, 108, 139, 159], [169, 108, 169, 159], [65, 158, 127, 158], [66, 155, 127, 155]];
  }
  if (single) {
    body[5] = [132, 92]; body[6] = [148, 111];
  }
  if (hold) {
    body[5] = [145, 82]; body[6] = [196, 97];
  }
  const phases: [Point, Point] = standing || set === "prone-incline"
    ? grip === "palm-down" ? [[0, 15], [-11, 8]] : [[0, 15], [11, 7]]
    : grip === "palm-down" ? [[12, 8], [10, -10]] : [[12, 9], [9, -9]];
  const at = ([dx, dy]: Point): Point[] => [
    ...body, [body[4][0] + dx, body[4][1] + dy], [body[6][0] + dx, body[6][1] + dy],
  ];
  const devices: Attachments = [[grip, 4, 11]];
  if (!single && !hold) devices.push([grip, 6, 12]);
  if (gear === "cable") {
    const x = set === "behind" ? 74 : 238;
    props.push([x, 21, x, 159], [x - 14, 159, x + 14, 159]);
    devices.push(["cable", 11, x, 146]);
    if (!single) devices.push(["bar", 11, 12]);
  }
  if (gear === "bar" || gear === "ez-bar") devices.push([gear, 11, 12], ["plate", 11, 0, 0], ["plate", 12, 0, 0]);
  if (gear === "dumbbell" || gear === "weight" || gear === "bell") {
    const kind = gear === "bell" ? "kettlebell" : gear;
    devices.push([kind, 11, 0, gear === "bell" ? 8 : 0]);
    if (!single) devices.push([kind, 12, 0, 0]);
  }
  const high = at(hold ? [14, 0] : phases[1]);
  const settingHand = high.map((point, index): Point => index === 6 ? [191, 83] : point);
  return { frames: hold ? [settingHand, high, high, high] : [at(phases[0]), high], props, dynamic: devices, ms: 960, reference: true };
}

function lateralNeck(kneeling = false): Illustration {
  const shoulders: Point = [151, kneeling ? 72 : 69];
  const hips: Point = [151, kneeling ? 112 : 110];
  const legs: Point[] = kneeling ? [[171, 152], [185, 157], [130, 152], [117, 157]]
    : [[172, 119], [178, 153], [129, 119], [125, 153]];
  const make = (tilt: boolean): Point[] => {
    const head: Point = tilt ? [165, shoulders[1] - 16] : [151, shoulders[1] - 21];
    return [head, shoulders, hips, [176, shoulders[1] - 16], [head[0] + 4, head[1] - 7],
      [128, shoulders[1] + 19], [127, hips[1] - 3], ...legs,
      [head[0] - 3, head[1] + (tilt ? -5 : -2)], [head[0] + 4, head[1] - 2]];
  };
  const held = make(true);
  return {
    frames: [make(false), held, held, held], ms: 1150, reference: true,
    props: kneeling ? [[104, 158, 195, 158]] : [[119, 115, 182, 115], [123, 115, 123, 158], [179, 115, 179, 158]],
    dynamic: [["face", 0, 11], ["face", 0, 12], ["foot", 8, 190, 158], ["foot", 10, 114, 158]],
  };
}

function seatedNeck(action: "flex" | "extend" | "both", support: "free" | "hand" | "hands" | "cable" = "free") {
  const front = support === "cable" && action === "flex" ? -1 : 1;
  const central: Point = [140, 67];
  const hip: Point = [137, 109];
  const legs: Point[] = [[166, 109], [167, 157], [155, 112], [151, 157]];
  const pose = (head: Point, face: Point): Point[] => {
    const activeHands = support === "hand" || support === "hands";
    const hand: Point = activeHands ? [head[0] - 4, head[1] - 7] : [155, hip[1]];
    return [head, central, hip, [150, activeHands ? 57 : 91], hand,
      support === "hands" ? [121, 54] : [125, 91], support === "hands" ? [head[0] + 2, head[1] - 7] : [128, hip[1]], ...legs, face];
  };
  const neutral = pose([139, central[1] - 20], [146, central[1] - 19]);
  const flex = pose([147, central[1] - 15], [151, central[1] - 8]);
  const extension = pose([133, central[1] - 19], [139, central[1] - 24]);
  const props: Props = chair.slice();
  const dynamic: Attachments = [["face", 0, 11]];
  if (support === "cable") {
    const towerX = 140 + front * 86;
    props.push([towerX, 21, towerX, 158], [towerX - 11, 158, towerX + 11, 158]);
    dynamic.push(["cable", 0, towerX, central[1] - 21], ["head-strap", 0, 0, -4]);
  }
  const frames = action === "both" ? [neutral, flex, neutral, extension] :
    [neutral, action === "flex" ? flex : extension];
  return { frames: support === "hand" || support === "hands" ? [...frames, frames.at(-1)!, frames.at(-1)!] : frames, props, dynamic, ms: 1150, reference: true };
}

function lyingNeck(chestDown: boolean, load: "none" | "plate" | "harness" = "none", bench = true): Illustration {
  const posture: Point[] = chestDown
    ? [[156, 103], [132, 113], [108, 109], [127, 114], [102, 110], [183, 105], [215, 107], [180, 106], [210, 110]]
    : [[156, bench ? 99 : 148], [143, bench ? 112 : 155], [163, bench ? 111 : 155], [136, bench ? 109 : 154], [157, bench ? 108 : 156],
      [190, bench ? 105 : 119], [193, 157], [180, bench ? 105 : 121], [184, 157]];
  const neck: Point = [105, bench ? 96 : 146];
  const pose = (head: Point, marker: Point): Point[] => [head, neck, ...posture, marker, [head[0] - 3, head[1] + 28]];
  const headY = bench ? 96 : 146;
  const freed = chestDown ? pose([89, headY + 15], [86, headY + 22]) : pose([88, headY + (bench ? 12 : 0)], [86, headY - 5]);
  const contracted = chestDown ? pose([84, headY], [78, headY + 3]) : pose([90, headY - 13], [91, headY - 21]);
  const dynamic: Attachments = [["face", 0, 11]];
  if (load === "plate") dynamic.push(["plate", 0, 2, -8]);
  if (load === "harness") dynamic.push(["head-strap", 0, 0, -4], ["line", 0, 12], ["plate", 0, -3, 28]);
  return { frames: [freed, contracted], props: bench ? [[100, 109, 221, 109], [111, 109, 111, 158], [210, 109, 210, 158]] : floor, dynamic, ms: 1050, reference: true };
}

const sitWristUp = wristCurl("seated", "palm-up", "weight", true);
const seatedFlex = seatedNeck("flex");
const seatedExtension = seatedNeck("extend");
const flexHand = seatedNeck("flex", "hand");
const tiltedNeck = lateralNeck();

export const wristNeckIllustrations: Readonly<Record<string, Illustration>> = {
  "3987": wristCurl("prone-incline", "palm-up", "bar"),
  "2683": wristCurl("seated", "palm-down", "bar"),
  "6262": wristCurl("standing", "palm-up", "bar"),
  "6263": wristCurl("standing", "palm-down", "bar"),
  "4163": wristCurl("seated", "palm-up", "cable", true),
  "6367": wristCurl("behind", "palm-up", "cable"),
  "6360": wristCurl("standing", "palm-up", "cable"),
  "6363": wristCurl("standing", "palm-down", "cable"),
  "4908": wristCurl("kneel-bench", "palm-down", "dumbbell"),
  "6366": wristCurl("behind", "palm-up", "dumbbell"),
  "6359": wristCurl("standing", "palm-up", "dumbbell"),
  "6362": wristCurl("standing", "palm-down", "dumbbell"),
  "5579": wristCurl("seated", "palm-up", "ez-bar"),
  "6364": wristCurl("seated", "palm-down", "ez-bar"),
  "6365": wristCurl("behind", "palm-up", "ez-bar"),
  "6358": wristCurl("standing", "palm-up", "ez-bar"),
  "6361": wristCurl("standing", "palm-down", "ez-bar"),
  "5862": wristCurl("seated", "palm-up", "bell", true),
  "4154": wristCurl("seated", "thumb-up", "weight", true),
  "4234": wristCurl("seated", "palm-down", "weight", true),
  "4233": sitWristUp,
  "4232": wristCurl("seated", "palm-down", "weight"),
  "2790": wristCurl("table", "palm-down", "none", true),
  "2791": wristCurl("table", "palm-up", "none", true),
  "9995": wristCurl("table", "palm-down", "none", true, true),
  "2411": seatedNeck("extend", "cable"),
  "2412": seatedNeck("flex", "cable"),
  "0462": seatedNeck("both"),
  "1833": seatedExtension,
  "1835": seatedFlex,
  "1836": seatedNeck("flex", "hands"),
  "5058": lateralNeck(true),
  "6765": tiltedNeck,
  "10555": seatedNeck("both"),
  "5195": tiltedNeck,
  "5162": flexHand,
  "10780": lyingNeck(false, "none", false),
  "10781": lyingNeck(true),
  "1042": lyingNeck(true, "plate"),
  "2408": lyingNeck(true, "harness"),
  "2409": lyingNeck(false, "harness"),
};
