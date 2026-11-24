import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Arms = [Point, Point, Point, Point];
type Mode = "lower" | "free-overhead" | "overhead-both" | "hand-head" | "elbow-bent" | "press" | "both-bent" | "head-and-hip" | "slide";
const floorFeet: Equipment = [["foot", 8, 193, 158], ["foot", 10, 126, 158]];

function sideBend(options: {
  mode: Mode;
  equipment?: "band" | "cable" | "strap" | "dumbbell" | "bottle" | "kettlebell" | "plate" | "stick";
  support?: "chair" | "ball";
  toward?: boolean;
  alternating?: boolean;
  hold?: boolean;
}): Illustration {
  const { mode, equipment, support, toward, alternating, hold } = options;
  const seated = Boolean(support);
  const body: [Point, Point, Point] = seated ? [[159, 76], [159, 93], [159, 122]] : [[159, 61], [159, 80], [159, 113]];
  const legs: Point[] = seated ? [[181, 129], [185, 154], [140, 129], [136, 154]]
    : [[171, 133], [179, 154], [144, 133], [139, 154]];
  const y = body[1][1] - 80;
  const atRest: Record<Mode, Arms> = {
    lower: [[173, 103], [179, 126], [144, 103], [136, 125]],
    press: [[174, 104], [180, 126], [132, 86], [143, 71]],
    "free-overhead": [[174, 103], [175, 125], [138, 57], [130, 28]],
    "overhead-both": [[181, 56], [176, 28], [136, 56], [142, 28]],
    "hand-head": [[183, 91], [170, 61], [144, 103], [136, 125]],
    "elbow-bent": [[181, 105], [177, 120], [123, 53], [141, 32]],
    "both-bent": [[191, 73], [171, 59], [127, 73], [148, 59]],
    "head-and-hip": [[186, 103], [174, 116], [124, 70], [147, 59]],
    slide: [[175, 103], [179, 125], [142, 103], [137, 125]],
  };
  const restArms = atRest[mode].map(([x, py]): Point => [x, py + y]);
  const pose = (tilt: number, swapHands = false): Point[] => {
    const [cx, cy] = body[2];
    const rotation = tilt * Math.PI / 180;
    const move = ([x, y2]: Point): Point => [
      Math.round(cx + Math.cos(rotation) * (x - cx) - Math.sin(rotation) * (y2 - cy)),
      Math.round(cy + Math.sin(rotation) * (x - cx) + Math.cos(rotation) * (y2 - cy)),
    ];
    const armTargets = restArms.slice();
    if (mode === "press" && tilt !== 0) armTargets.splice(2, 2, [145, 54], [144, 27]);
    if (mode === "slide") {
      armTargets[1] = [179 + Math.max(0, tilt) * 0.1, 126 + Math.max(0, tilt) * 0.4];
      armTargets[3] = [139 + Math.min(0, tilt) * 0.1, 126 - Math.min(0, tilt) * 0.4];
    }
    if (support === "ball" && mode === "lower") armTargets[1] = [171, body[2][1] - 3];
    if (!equipment && mode === "overhead-both") {
      armTargets[1] = [162, 28 + y];
      armTargets[3] = [156, 28 + y];
    }
    const mirrored = swapHands ? [...armTargets.slice(2), ...armTargets.slice(0, 2)].map(([x, yy]): Point => [2 * cx - x, yy]) : armTargets;
    const hands = mirrored.map(move);
    return [move(body[0]), move(body[1]), body[2], ...hands, ...legs,
      move([120, 28 + y]), move([198, 28 + y])];
  };
  const up = pose(0);
  const end = pose(toward ? -27 : 27);
  const switchesArm = mode === "free-overhead" || mode === "hand-head";
  const frames = alternating ? [up, end, pose(0, switchesArm), pose(toward ? 27 : -27, switchesArm)] : [up, end];
  if (hold) frames.push(end, end, end);

  const props: Props = support === "chair" ? [[138, 128, 181, 128], [140, 128, 140, 159], [177, 128, 177, 159],
    [135, 83, 135, 128], [132, 83, 145, 83]] : equipment === "cable"
      ? [[64, 36, 64, 156], [76, 36, 76, 156], [64, 36, 76, 36], [56, 156, 82, 156]]
      : equipment === "strap" ? [[60, 17, 60, 157], [60, 24, 74, 24], [51, 157, 69, 157]] : [];
  const dynamic: Equipment = [...floorFeet];
  if (support === "ball") dynamic.push(["stability-ball", 2, -4, 20]);
  if (equipment === "band") {
    dynamic.push(["band", 6, 130, 158]);
    if (mode === "overhead-both") dynamic.push(["band", 4, 187, 158]);
  }
  if (equipment === "cable" || equipment === "strap") dynamic.push(["cable", 6, 72, equipment === "cable" ? 143 : 24]);
  if (equipment === "dumbbell" || equipment === "bottle" || equipment === "kettlebell" || equipment === "plate") {
    dynamic.push([equipment === "bottle" ? "bottle-upright" : equipment, 6, 0, 3]);
  }
  if (equipment === "stick") dynamic.push(["bar", 11, 12]);
  return { frames, props, dynamic, ms: hold ? 950 : 850, reference: true };
}

function supportedSideBend(onBall: boolean, plate = false): Illustration {
  const hip: Point = onBall ? [158, 118] : [151, 89];
  const nearKnee: Point = onBall ? [199, 122] : [182, 120];
  const nearAnkle: Point = onBall ? [222, 153] : [213, 151];
  const farKnee: Point = [nearKnee[0] + 6, nearKnee[1] - 2];
  const farAnkle: Point = [nearAnkle[0] + 5, nearAnkle[1] + 1];
  const base: Point[] = onBall ? [[91, 107], [111, 114], hip] : [[104, 45], [120, 58], hip];
  const low: Point[] = onBall ? [[94, 139], [108, 132], hip] : [[89, 93], [109, 94], hip];
  const pipe = (top: Point[]): Point[] => {
    const [[hx, hy], [sx, sy]] = top;
    const arms: Arms = onBall ? [[hx + 18, hy - 13], [hx - 3, hy], [hx + 4, hy + 14], [hx - 4, hy + 4]]
      : [[sx + 10, sy + 24], [sx - 1, sy + 12], [sx + 1, sy + 27], [sx + 16, sy + 12]];
    return [...top, ...arms, nearKnee, nearAnkle, farKnee, farAnkle];
  };
  const dynamic: Equipment = [["foot", 8, nearAnkle[0] + 14, 157], ["foot", 10, farAnkle[0] + 12, 158]];
  if (onBall) dynamic.push(["stability-ball", 2, -4, 24]);
  if (plate) dynamic.push(["plate", 4, 6, 4]);
  const props: Props = onBall ? [] : [[134, 91, 158, 98], [145, 98, 145, 156], [130, 156, 176, 156],
    [149, 98, 209, 148], [207, 147, 224, 153], [210, 146, 210, 156]];
  return { frames: [pipe(base), pipe(low)], props, dynamic, ms: 950, reference: true };
}

const floorSideBend: Illustration = {
  frames: [
    [[128, 76], [143, 90], [182, 113], [143, 120], [139, 155], [122, 71], [98, 58], [215, 134], [247, 151], [212, 136], [245, 154]],
    [[118, 103], [139, 107], [182, 111], [144, 129], [139, 155], [114, 91], [92, 80], [215, 134], [247, 151], [212, 136], [245, 154]],
  ],
  dynamic: [["foot", 8, 253, 156], ["foot", 10, 255, 159]], reference: true, ms: 930,
};

const standingSingle = sideBend({ mode: "free-overhead" });
const lowCable = sideBend({ mode: "lower", equipment: "cable" });

export const sideBendIllustrations: Record<string, Illustration> = {
  "5699": supportedSideBend(false),
  "10875": supportedSideBend(false, true),
  "0700": supportedSideBend(true),
  "2864": floorSideBend,
  "4082": sideBend({ mode: "overhead-both", equipment: "band" }),
  "3841": sideBend({ mode: "lower", equipment: "band", toward: true }),
  "4685": sideBend({ mode: "lower", equipment: "band" }),
  "4700": sideBend({ mode: "press", equipment: "band" }),
  "6054": sideBend({ mode: "hand-head", equipment: "bottle", toward: true }),
  "5657": lowCable,
  "11278": lowCable,
  "4335": sideBend({ mode: "hand-head", equipment: "dumbbell", toward: true }),
  "4396": sideBend({ mode: "lower", equipment: "kettlebell", toward: true }),
  "8311": sideBend({ mode: "free-overhead", support: "chair", alternating: true }),
  "8195": sideBend({ mode: "hand-head", support: "chair", alternating: true }),
  "2787": sideBend({ mode: "slide", alternating: true }),
  "3253": standingSingle,
  "4810": standingSingle,
  "3997": sideBend({ mode: "elbow-bent", hold: true }),
  "4322": sideBend({ mode: "head-and-hip" }),
  "3254": sideBend({ mode: "overhead-both", alternating: true }),
  "3256": sideBend({ mode: "both-bent", alternating: true }),
  "5405": sideBend({ mode: "overhead-both", equipment: "stick", alternating: true }),
  "1097": sideBend({ mode: "lower", equipment: "strap" }),
  "0850": sideBend({ mode: "lower", equipment: "dumbbell", support: "ball", toward: true }),
};
