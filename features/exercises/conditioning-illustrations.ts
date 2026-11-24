import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Gait = "jog" | "high-knees" | "quick" | "walk";
const demo = (frames: Point[][], props: Props = [], dynamic: Equipment = [], ms = 440): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });

const floor: Equipment = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const changeSide = (frame: Point[]): Point[] => [
  ...frame.slice(0, 3), frame[5], frame[6], frame[3], frame[4], frame[9], frame[10], frame[7], frame[8], frame[12], frame[11],
];

function stride(kind: Gait, lean: boolean, rearward = false): Point[][] {
  const hip = 107;
  const neckX = lean ? 164 : 154;
  const headX = neckX + (lean ? 8 : 2);
  const arm: Point[] = [[neckX - 15, 91], [neckX + 4, 76], [neckX + 18, 91], [neckX + 31, 79]];
  const movement: Record<Gait, Point[]> = {
    "high-knees": [[179, 105], [177, 132], [142, 131], [142, 152], [185, 136], [152, 158]],
    jog: [[177, 123], [181, 149], [134, 133], [120, 150], [191, 154], [130, 155]],
    quick: [[163, 124], [166, 146], [144, 134], [140, 153], [175, 150], [149, 158]],
    walk: [[168, 131], [185, 153], [136, 133], [123, 153], [195, 158], [134, 158]],
  };
  const [nearKnee, nearAnkle, farKnee, farAnkle, nearToe, farToe] = movement[kind];
  const peak: Point[] = [[headX, 48], [neckX, 68], [150, hip], ...arm,
    nearKnee, nearAnkle, farKnee, farAnkle, nearToe, farToe];
  const strideMid: Point[] = [[headX, 46], [neckX, 66], [150, hip - 2],
    [neckX - 5, 88], [neckX + 17, 76], [neckX + 6, 89], [neckX + 24, 82],
    [154, 129], [158, kind === "walk" ? 153 : 150], [145, 130], [139, 148], [169, 156], [148, 152]];
  const frames = [peak, strideMid, changeSide(peak), changeSide(strideMid)];
  if (!rearward) return frames;
  // Look over the shoulder while the stride travels backwards.
  return frames.reverse().map((pose, index) => pose.map(([x, y], joint) => {
    if (joint === 0) return [index === 1 ? x - 9 : x, y];
    if (joint >= 7) return [300 - x, y];
    return [x, y];
  }));
}

const treadmill: Props = [[53, 157, 235, 157], [59, 151, 228, 151], [222, 151, 236, 85], [236, 85, 248, 85],
  [218, 97, 188, 97], [231, 84, 244, 74], [244, 74, 255, 74]];
const curvedBelt: Props = [[51, 156, 239, 156], [60, 140, 91, 151], [91, 151, 189, 151], [189, 151, 221, 141],
  [225, 141, 232, 79], [225, 79, 246, 79], [221, 95, 186, 95], [235, 80, 244, 68]];
const onBelt = (frames: Point[][], height = 7): Point[][] =>
  frames.map((pose) => pose.map(([x, y]) => [x, y - height]));

const stationaryBike: Props = [[98, 156, 228, 156], [122, 153, 167, 130], [167, 130, 204, 82], [204, 82, 216, 82],
  [166, 130, 131, 108], [122, 107, 145, 107], [185, 110, 121, 110], [199, 139, 213, 154]];
function pedals(): Illustration {
  const positions: Point[] = [[185, 134], [168, 145], [150, 134], [167, 120]];
  const opposite: Point[] = [positions[2], positions[3], positions[0], positions[1]];
  const knee: Point[] = [[168, 116], [159, 118], [164, 112], [167, 111]];
  const frames = positions.map(([x, y], i): Point[] => {
    const [otherX, otherY] = opposite[i];
    return [[143, 53], [148, 71], [137, 101], [170, 82], [201, 83], [170, 78], [194, 81],
      knee[i], [x, y], knee[(i + 2) % 4], [otherX, otherY], [x + 12, y + 3], [otherX + 12, otherY + 3], [167, 134]];
  });
  return demo(frames, stationaryBike, [...floor, ["wheel", 13, 0, 0], ["line", 8, 13], ["line", 10, 13]], 520);
}

function alternatingPedals(elliptical: boolean) {
  const stepper: Props = [[94, 157, 229, 157], [213, 155, 213, 76], [213, 76, 229, 76], [209, 92, 174, 92]];
  const track: Props = [...stepper, [100, 145, 220, 145], [218, 78, 218, 61], [217, 61, 233, 61]];
  const high: Point = [171, 120];
  const low: Point = [174, 144];
  const plantedNear: Point = elliptical ? [194, 141] : low;
  const plantedFar: Point = elliptical ? [124, 139] : high;
  const frame: Point[] = [[151, 52], [154, 72], [157, 108],
    [169, 86], [191, elliptical ? 71 : 92], [160, 86], [178, elliptical ? 81 : 92],
    [173, 125], plantedNear, elliptical ? [131, 123] : [173, 109], plantedFar,
    [plantedNear[0] + 14, plantedNear[1] + 4], [plantedFar[0] + 14, plantedFar[1] + 4], [211, 149]];
  return demo([frame, changeSide(frame).concat([frame[13]])], elliptical ? track : stepper,
    [...floor, ["line", 11, 13], ["line", 12, 13], ...elliptical ? [["line", 4, 11] as Equipment[number], ["line", 6, 12] as Equipment[number]] : []], 630);
}

function bikeCrunch(load: "none" | "foot-band" | "hand-band" | "head-anchor" | "reverse") {
  const supported = load === "reverse";
  const head: Point = supported ? [86, 143] : [84, 126];
  const neck: Point = supported ? [100, 151] : [102, 132];
  const hip: Point = supported ? [157, 144] : [158, 152];
  const arms: Point[] = supported ? [[118, 154], [151, 155], [123, 151], [147, 153]]
    : load === "head-anchor" ? [[100, 115], [68, 104], [132, 112], [146, 105]]
    : load === "hand-band" ? [[100, 115], [69, 109], [130, 109], [141, 101]]
    : [[104, 113], [83, 122], [126, 110], [95, 123]];
  const peak: Point[] = [head, neck, hip, ...arms, [139, 112], [159, 96], [190, 136], [217, 134], [168, 90], [231, 137]];
  const transition: Point[] = [head, neck, hip, ...arms, [158, 113], [183, 112], [182, 130], [196, 149], [192, 107], [207, 152]];
  const frames = supported ? [peak, changeSide(transition), changeSide(peak), transition]
    : [peak, transition, changeSide(peak), changeSide(transition)];
  const dynamic: Equipment = [...floor];
  if (load === "foot-band") dynamic.push(["band", 8, 10]);
  if (load === "hand-band") dynamic.push(["band", 4, 8], ["band", 6, 10]);
  if (load === "head-anchor") dynamic.push(["band", 4, 43, 143], ["band", 6, 43, 143]);
  return demo(frames, load === "head-anchor" ? [[42, 129, 42, 154], [33, 154, 54, 154]] : [], dynamic, 550);
}

type CarryLoad = "barbell" | "dumbbell" | "kettlebell" | "inverted-kettlebell" | "trap-bar" | "sandbag";
type CarrySlot = "overhead-both" | "suitcase" | "zercher" | "high-low" | "overhead" | "farmer" | "goblet" | "bear-hug" | "shoulder";
function carry(load: CarryLoad, slot: CarrySlot): Illustration {
  const arms: Record<CarrySlot, [Point, Point, Point, Point]> = {
    "overhead-both": [[167, 43], [174, 14], [141, 43], [135, 14]],
    suitcase: [[161, 92], [164, 118], [139, 90], [135, 117]],
    zercher: [[173, 90], [177, 68], [148, 91], [153, 70]],
    "high-low": [[159, 40], [164, 13], [144, 91], [140, 119]],
    overhead: [[158, 40], [161, 14], [142, 92], [141, 118]],
    farmer: [[167, 92], [171, 119], [141, 90], [137, 118]],
    goblet: [[164, 94], [178, 74], [158, 91], [172, 70]],
    "bear-hug": [[170, 94], [183, 83], [157, 92], [171, 77]],
    shoulder: [[163, 83], [153, 59], [141, 88], [138, 113]],
  };
  const frames = stride("walk", false).map((pose): Point[] => {
    const [rightElbow, rightHand, leftElbow, leftHand] = arms[slot];
    const grip: Point = [(rightHand[0] + leftHand[0]) / 2, (rightHand[1] + leftHand[1]) / 2];
    const [x, y] = slot === "zercher" ? rightElbow : slot === "overhead-both" ? grip : rightHand;
    return [...pose.slice(0, 3), rightElbow, rightHand, leftElbow, leftHand, ...pose.slice(7), grip,
      [x - 29, y], [x + 30, y], pose[1]];
  });
  const attachments: Equipment = [...floor];
  if (load === "barbell") {
    attachments.push(["bar", 14, 15], ["plate", 14, 0, 0], ["plate", 15, 0, 0]);
  } else if (load === "trap-bar") {
    attachments.push(["trap-bar", 13, 0, 0]);
  } else if (load === "sandbag") {
    attachments.push(slot === "bear-hug" ? ["sandbag", 13, 7, 1] : ["sandbag", 16, -9, -7]);
  } else if (slot === "goblet") {
    attachments.push(["kettlebell", 13, 3, 8]);
  } else {
    const kind = load === "inverted-kettlebell" ? "kettlebell" : load;
    const height = load === "inverted-kettlebell" ? -8 : load === "kettlebell" ? 8 : -1;
    attachments.push([kind, 4, 0, height]);
    if (slot === "farmer" || slot === "high-low") attachments.push([kind, 6, 0, load === "kettlebell" ? 8 : 0]);
  }
  return demo(frames, [], attachments, 650);
}

const flatBackward = stride("jog", false, true);
const bikeWithFootBand = bikeCrunch("foot-band");
const bikeWithFixedBand = bikeCrunch("head-anchor");
const openTreadmillWalk = demo(onBelt(stride("walk", false)), treadmill, floor, 560);

export const conditioningIllustrations: Record<string, Illustration> = {
  "4229": demo(onBelt(stride("jog", true)), curvedBelt, floor),
  "4258": demo(flatBackward, [], floor),
  "2197": demo(onBelt(stride("jog", false)), treadmill, floor),
  "2259": openTreadmillWalk,
  "9608": demo(onBelt(stride("walk", false, true).map((frame) =>
    frame.map(([x, y], joint): Point => joint === 4 ? [187, 102] : joint === 6 ? [184, 109] : [x, y]))), treadmill, floor, 620),
  "3653": demo(stride("jog", true), [[60, 76, 60, 156], [49, 155, 72, 155]], [...floor, ["band", 2, 60, 110]], 380),
  "3556": demo(stride("high-knees", false), [], floor),
  "4004": demo(stride("jog", false), [], floor),
  "3196": demo(stride("quick", false), [], floor, 285),
  "10677": demo(stride("jog", false).map((frame) => frame.concat([[142, 78], [139, 94]])), [], [...floor,
    ["backpack", 13, 14], ["line", 1, 13]], 470),
  "2279": pedals(),
  "0938": alternatingPedals(false),
  "2658": alternatingPedals(true),
  "2395": bikeCrunch("none"),
  "4699": bikeCrunch("hand-band"),
  "2420": bikeWithFootBand,
  "7212": bikeWithFootBand,
  "3778": bikeWithFixedBand,
  "3792": bikeWithFixedBand,
  "7850": bikeCrunch("reverse"),
  "2914": carry("barbell", "overhead-both"),
  "2918": carry("barbell", "suitcase"),
  "2915": carry("barbell", "zercher"),
  "2911": carry("dumbbell", "high-low"),
  "2913": carry("dumbbell", "overhead"),
  "2910": carry("dumbbell", "suitcase"),
  "9697": carry("inverted-kettlebell", "overhead"),
  "3576": carry("kettlebell", "farmer"),
  "2916": carry("kettlebell", "goblet"),
  "4244": carry("kettlebell", "overhead"),
  "2912": carry("trap-bar", "farmer"),
  "10387": carry("sandbag", "bear-hug"),
  "10386": carry("sandbag", "shoulder"),
};
