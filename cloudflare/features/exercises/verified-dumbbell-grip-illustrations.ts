import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const phases = [0, 0.45, 1, 1, 0.45];
const lyingBench: Props = [[73, 121, 224, 121], [83, 121, 83, 156], [216, 121, 216, 156]];
const floorMat: Props = [[70, 156, 242, 156]];
const seat: Props = [[102, 122, 177, 122], [111, 122, 111, 157], [171, 122, 171, 157]];

function rotatedDumbbell(body: Point[], props: Props, pronation: boolean, stable: Gear = []): Illustration {
  const wrist = body[4];
  const frame = (phase: number): Point[] => {
    const angle = (pronation ? phase : 1 - phase) * 1.65 - 0.8;
    const center: Point = [wrist[0] - 3, wrist[1] + 1];
    const dx = Math.cos(angle) * 10, dy = Math.sin(angle) * 9;
    return [...body, [center[0] - dx, center[1] - dy], [center[0] + dx, center[1] + dy],
      [wrist[0] - 6, wrist[1]], [wrist[0] - 2, wrist[1] + (0.5 - phase) * 8]];
  };
  return { frames: phases.map(frame), props, shoulders: [11, 12], reference: true, ms: 790,
    dynamic: [["bar", 13, 14], ["massage-ball", 13, 0, 0], ["massage-ball", 14, 0, 0],
      ["hand", 4, 15, 16], ...stable] };
}

function lyingPronation(): Illustration {
  const lying: Point[] = [[93, 99], [110, 111], [159, 113],
    [113, 113], [98, 131], [141, 92], [147, 111],
    [190, 114], [222, 115], [188, 106], [220, 109], [114, 114], [111, 104]];
  return rotatedDumbbell(lying, lyingBench, true);
}

function lyingSupination(): Illustration {
  const lying: Point[] = [[92, 103], [108, 114], [156, 115],
    [142, 107], [157, 130], [90, 119], [88, 108],
    [184, 115], [216, 115], [184, 107], [215, 109], [111, 108], [105, 118]];
  return rotatedDumbbell(lying, lyingBench, false);
}

function floorPronation(): Illustration {
  const lying: Point[] = [[91, 137], [107, 146], [157, 148],
    [141, 137], [157, 132], [81, 152], [83, 136],
    [183, 149], [209, 142], [181, 144], [209, 136], [110, 140], [104, 147]];
  return rotatedDumbbell(lying, floorMat, true);
}

function floorSupination(): Illustration {
  const lying: Point[] = [[94, 118], [108, 132], [158, 146],
    [139, 137], [156, 135], [104, 150], [84, 153],
    [186, 148], [219, 149], [185, 143], [218, 143], [112, 130], [105, 136]];
  return rotatedDumbbell(lying, floorMat, false);
}

function seatedRotation(): Illustration {
  const sitting: Point[] = [[180, 80], [170, 94], [140, 117],
    [179, 114], [193, 141], [142, 108], [152, 120],
    [173, 130], [181, 154], [140, 128], [137, 153], [174, 100], [164, 92]];
  return rotatedDumbbell(sitting, seat, true, [["foot", 8, 190, 157], ["foot", 10, 145, 155]]);
}

function kneelingBenchWristCurl(): Illustration {
  const torso: Point[] = [[146, 60], [154, 78], [179, 116]];
  const stable: Point[] = [[161, 111], [147, 113], [181, 149], [214, 153], [191, 148], [222, 151]];
  const pose = (weight: Point, finger: Point): Point[] => [...torso, [141, 106], [113, 114], ...stable,
    [151, 81], [160, 76], weight, finger];
  const released = pose([105, 126], [106, 125]);
  const curled = pose([105, 107], [106, 111]);
  const pad: Props = [[110, 117, 194, 117], [118, 117, 118, 156], [185, 117, 185, 156]];
  return { frames: [released, curled, curled, released], dynamic: [["dumbbell", 13, 0, 0], ["palm-up", 4, 14]],
    props: pad, shoulders: [11, 12], reference: true, ms: 830 };
}

function backSupportedReverseCurl(): Illustration {
  const torso: Point[] = [[156, 48], [155, 66], [156, 112]];
  const pose = (near: Point, far: Point): Point[] =>
    [...torso, [180, 98], near, [133, 96], far, [177, 122], [181, 154], [168, 118], [165, 153],
      [167, 70], [145, 68], [near[0] + 4, near[1] - 5], [far[0] - 4, far[1] - 5]];
  const low = pose([184, 126], [130, 124]), high = pose([193, 78], [118, 76]);
  const bench: Props = [[144, 61, 144, 120], [149, 61, 149, 120], [141, 121, 186, 121],
    [146, 121, 146, 157], [180, 121, 180, 157]];
  const weights: Gear = [["palm-down", 4, 13], ["palm-down", 6, 14], ["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
  return { frames: [low, high], props: bench, dynamic: weights, shoulders: [11, 12], reference: true, ms: 1320 };
}

export const verifiedDumbbellGripIllustrations: Record<string, Illustration> = {
  "0347": lyingPronation(),
  "0349": lyingSupination(),
  "0367": kneelingBenchWristCurl(),
  "0399": seatedRotation(),
  "2705": floorPronation(),
  "2706": floorSupination(),
  "3688": backSupportedReverseCurl(),
};
