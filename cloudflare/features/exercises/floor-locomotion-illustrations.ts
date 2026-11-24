import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
const mat: Props = [[63, 59, 246, 59], [246, 59, 246, 131], [246, 131, 63, 131], [63, 131, 63, 59]];
const jointMap = (pose: Point[], changes: Partial<Record<number, Point>>) => pose.map((p, i) => changes[i] ?? p);

function crabRoll(): Illustration {
  const sitting: Point[] = [[128, 100], [124, 116], [143, 150], [143, 113], [163, 140],
    [147, 115], [166, 139], [168, 120], [163, 141], [157, 124], [166, 138], [123, 137]];
  const balanced: Point[] = [[116, 119], [122, 135], [152, 137], [145, 123], [170, 104],
    [141, 119], [167, 107], [163, 101], [170, 104], [154, 104], [167, 107], [136, 146]];
  const rolled: Point[] = [[105, 139], [123, 151], [155, 117], [134, 126], [149, 87],
    [128, 121], [144, 90], [147, 86], [149, 87], [138, 91], [144, 90], [147, 139]];
  const legsCross = jointMap(rolled, { 4: [145, 90], 6: [150, 87], 7: [140, 86], 8: [145, 90], 9: [150, 84], 10: [150, 87] });
  return { frames: [sitting, balanced, rolled, legsCross, balanced, sitting],
    props: [[79, 161, 218, 161]], spine: [11], ms: 810, reference: true };
}

const crabSeat: Point[] = [[113, 101], [122, 116], [151, 152], [108, 134], [99, 155],
  [100, 135], [87, 154], [170, 125], [193, 155], [159, 127], [180, 155]];
const crabBridge: Point[] = [[111, 124], [122, 120], [163, 123], [109, 139], [99, 155],
  [100, 136], [87, 154], [182, 123], [193, 155], [168, 121], [180, 155]];
const bear: Point[] = [[197, 107], [181, 118], [132, 118], [189, 135], [193, 155],
  [175, 135], [177, 154], [151, 142], [126, 155], [138, 140], [113, 154]];

function bearToCrab(): Illustration {
  const turnOne = jointMap(bear, { 0: [181, 105], 1: [164, 120], 2: [138, 136], 3: [176, 138], 5: [152, 112],
    6: [137, 111], 7: [165, 146], 8: [149, 154], 9: [143, 138], 10: [113, 154] });
  const turnTwo = jointMap(crabSeat, { 0: [125, 111], 1: [136, 124], 2: [155, 143], 3: [171, 140], 4: [193, 155],
    7: [172, 145], 8: [171, 155], 9: [151, 130], 10: [177, 154] });
  const frames = [bear, turnOne, turnTwo, crabSeat, crabBridge, crabSeat, turnTwo, turnOne];
  return { frames, ms: 700, reference: true };
}

function crawlSideways(): Illustration {
  const center: Point[] = [[172, 123], [162, 119], [133, 117], [173, 138], [177, 156], [156, 133], [154, 149],
    [141, 146], [119, 155], [125, 142], [109, 149]];
  const out = jointMap(center, { 3: [184, 133], 4: [199, 154], 7: [153, 140], 8: [141, 154] });
  const moved = center.map(([x, y]): Point => [x + 22, y]);
  const left = jointMap(moved, { 5: [165, 133], 6: [154, 149], 9: [138, 141], 10: [109, 149] });
  return { frames: [center, out, moved, left], props: [[78, 158, 239, 158]], ms: 860, reference: true };
}

function inchwormClimbers(): Illustration {
  const standing: Point[] = [[107, 51], [106, 70], [105, 115], [118, 94], [117, 115],
    [97, 96], [101, 117], [109, 138], [113, 157], [100, 136], [100, 156]];
  const folded: Point[] = [[146, 115], [135, 114], [106, 100], [145, 137], [149, 156],
    [139, 136], [143, 155], [111, 129], [113, 157], [102, 127], [100, 156]];
  const firstStep: Point[] = [[170, 115], [156, 119], [111, 109], [174, 140], [180, 155],
    [153, 139], [155, 155], [112, 134], [113, 157], [104, 136], [100, 156]];
  const plank: Point[] = [[210, 114], [194, 123], [147, 133], [198, 141], [203, 155],
    [182, 139], [183, 155], [127, 146], [113, 157], [119, 144], [100, 156]];
  const nearKnee = jointMap(plank, { 7: [169, 148], 8: [142, 155] });
  const farKnee = jointMap(plank, { 9: [166, 141], 10: [139, 151] });
  return { frames: [standing, folded, firstStep, plank, nearKnee, plank, farKnee, plank,
    nearKnee, plank, farKnee, plank, firstStep, folded], ms: 675, reference: true };
}

function freestyleOnMat(): Illustration {
  const glide: Point[] = [[107, 96], [125, 96], [173, 96], [109, 79], [83, 79],
    [109, 112], [83, 112], [198, 91], [224, 90], [198, 104], [224, 104]];
  const pullNear = jointMap(glide, { 3: [126, 72], 4: [148, 79], 9: [194, 108], 10: [221, 114] });
  const finishNear = jointMap(glide, { 3: [144, 76], 4: [166, 86], 9: [194, 106], 10: [223, 109] });
  const pullFar = jointMap(glide, { 5: [126, 120], 6: [148, 113], 7: [195, 88], 8: [220, 82] });
  const finishFar = jointMap(glide, { 5: [144, 116], 6: [166, 105], 7: [195, 88], 8: [223, 85] });
  return { frames: [glide, pullNear, finishNear, pullNear, glide, pullFar, finishFar, pullFar], props: mat,
    topView: true, ms: 650, reference: true };
}

export const floorLocomotionIllustrations: Readonly<Record<string, Illustration>> = {
  "2842": crabRoll(),
  "5054": { frames: [crabSeat, crabBridge, crabBridge, crabBridge], ms: 1200, reference: true },
  "3950": bearToCrab(),
  "5598": inchwormClimbers(),
  "3965": crawlSideways(),
  "6944": freestyleOnMat(),
};
