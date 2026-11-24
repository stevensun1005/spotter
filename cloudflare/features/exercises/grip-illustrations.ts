import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Arms = [Point, Point, Point, Point];
type Pair = [Point, Point];
type Fingers = "relaxed" | "spread" | "closed" | "press";
type Palm = "upright" | "up" | "down";

const standing: Point[] = [[122, 44], [125, 61], [121, 105], [147, 78], [172, 77],
  [120, 84], [111, 107], [137, 129], [141, 156], [113, 130], [110, 156]];
const seated: Point[] = [[113, 53], [114, 70], [116, 113], [136, 84], [160, 84],
  [107, 87], [102, 108], [153, 113], [157, 156], [143, 117], [143, 156]];
const chair: Props = [[99, 121, 145, 121], [103, 121, 103, 157], [141, 121, 141, 157]];
const cableStand: Props = [[226, 24, 226, 157], [239, 37, 239, 157], [218, 157, 253, 157],
  [222, 77, 235, 77], [239, 111, 247, 111], [239, 120, 247, 120], [239, 129, 247, 129]];
const invisibleBody: Point[] = Array.from({ length: 11 }, () => [-50, -50] as Point);

const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const center = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function replaceArms(points: Point[], arms: Arms): Point[] {
  return [...points.slice(0, 3), ...arms, ...points.slice(7)];
}

function clip(frames: Point[][], dynamic: Attachments = [], props: Props = [], ms = 1050, topView = false): Illustration {
  return { frames, dynamic, props, ms, topView, reference: true };
}

const fingersByState: Record<Fingers, Pair[]> = {
  relaxed: [[[14, -16], [23, -27]], [[6, -23], [8, -39]], [[-3, -24], [-5, -42]], [[-11, -20], [-15, -34]], [[-18, -12], [-23, -22]]],
  spread: [[[15, -10], [29, -20]], [[10, -22], [16, -43]], [[-2, -26], [-4, -48]], [[-12, -22], [-20, -42]], [[-19, -15], [-30, -29]]],
  closed: [[[15, -10], [7, -10]], [[9, -21], [9, -15]], [[-2, -22], [-2, -15]], [[-11, -20], [-11, -13]], [[-17, -14], [-16, -9]]],
  press: [[[15, -12], [17, -18]], [[10, -21], [11, -26]], [[-1, -23], [0, -30]], [[-11, -20], [-8, -27]], [[-17, -14], [-14, -22]]],
};

function fingerRig(origin: Point, shape: Fingers, mirror = false, inverted = false): Point[] {
  const project = ([x, y]: Point) => add(origin, [x * (mirror ? -1 : 1), y * (inverted ? -1 : 1)]);
  const pivots: Point[] = [[11, -3], [6, -14], [-3, -16], [-10, -13], [-15, -8]];
  return [project([0, 35]), origin, ...pivots.map(project), ...fingersByState[shape].flatMap((finger) => finger.map(project))];
}

function fingerStrokes(start: number): Attachments {
  const palm: Attachments = [["digit", start, start + 1, 13], ["digit", start + 1, start + 4, 23]];
  for (let i = 0; i < 5; i++) {
    const base = start + 2 + i, joint = start + 7 + i * 2;
    palm.push(["digit", start + 1, base, i === 0 ? 8 : 10],
      ["digit", base, joint, i < 2 ? 6 : 5], ["digit", joint, joint + 1, i < 2 ? 5 : 4]);
  }
  return palm;
}

function fingers(mode: "fast" | "separate" | "band" | "ball" | "table"): Illustration {
  const two = mode === "fast";
  const band = mode === "band";
  const ball = mode === "ball";
  const table = mode === "table";
  const anchor: Point = table ? [154, 73] : [two ? 108 : 153, ball ? 108 : 101];
  const motion: Fingers[] = two ? ["closed", "spread", "closed", "spread"] :
    mode === "separate" ? ["relaxed", "spread", "spread", "spread"] :
    ball || table ? ["spread", "press", "press", "relaxed"] : ["closed", "spread", "spread", "relaxed"];
  const props: Props = band ? [[94, 118, 211, 118], [211, 118, 211, 155], [94, 155, 94, 118]] :
    table ? [[84, 111, 224, 111], [94, 111, 94, 155], [215, 111, 215, 155]] : [];
  const dynamic = fingerStrokes(11);
  if (two) dynamic.push(...fingerStrokes(28));
  if (ball || table) dynamic.unshift(["ball", 28, 0, 0]);
  if (band) {
    const fingertips = [19, 21, 23, 25, 27];
    for (let i = 0; i < fingertips.length; i++) dynamic.push(["band", fingertips[i], fingertips[(i + 1) % fingertips.length]]);
  }
  const frames = motion.map((shape) => {
    const result = [...invisibleBody, ...fingerRig(anchor, shape, false, table)];
    if (two) result.push(...fingerRig([207, 101], shape, true));
    if (ball || table) result.push(table ? [150, 103] : [172, shape === "press" ? 89 : 91]);
    return result;
  });
  return clip(frames, dynamic, props, two ? 360 : 1250, true);
}

function handPosition(wrist: Point, fingers: Point, thumb: Point): Pair {
  return [add(wrist, fingers), add(wrist, thumb)];
}

function heldStretch(kind: "pinky" | "extensor" | "pronator" | "seated"): Illustration {
  const base = kind === "seated" ? seated : standing;
  const elbow: Point = kind === "seated" ? [144, 79] : [155, 72];
  const wrist: Point = kind === "seated" ? [179, 87] : [188, 79];
  const beginning: Palm = kind === "pinky" ? "upright" : kind === "seated" ? "up" : "down";
  const at = (palm: Palm, tilt = false) => {
    const finger: Point = tilt ? kind === "pronator" ? [16, 0] : [9, kind === "pinky" ? 12 : 16] : [17, 0];
    const thumb: Point = palm === "up" ? [10, 7] : palm === "down" ? [10, -6] : [5, -8];
    const grip = handPosition(wrist, finger, thumb);
    const helpWrist = add(grip[0], tilt ? [-5, -3] : [8, 7]);
    return [...replaceArms(base, [elbow, wrist, [144, 96], helpWrist]), ...grip,
      add(helpWrist, [6, 0]), add(helpWrist, [0, 7])];
  };
  const low = at(beginning);
  const target = kind === "pronator" ? "up" : beginning;
  const high = at(target, true);
  const phases = kind === "seated" ? [low, high, high, at("down"), at("down", true), at("down", true)] : [low, high, high, high];
  return clip(phases, [["hand", 4, 11, 12], ["hand", 6, 13, 14]], kind === "seated" ? chair : [], 1300);
}

function palmsOut(): Illustration {
  const ready: Arms = [[145, 83], [165, 74], [141, 87], [162, 76]];
  const held: Arms = [[155, 70], [190, 75], [151, 74], [187, 77]];
  const attach = (arms: Arms, outward: boolean) => {
    const points = replaceArms(standing, arms);
    return [...points, ...handPosition(points[4], outward ? [1, -14] : [10, 2], [7, -6]),
      ...handPosition(points[6], outward ? [-1, -12] : [9, 2], [5, -5])];
  };
  const raised = attach(held, true);
  return clip([attach(ready, false), raised, raised, raised], [["hand", 6, 13, 14], ["hand", 4, 11, 12]], [], 1400);
}

function fingerCurl(barbell: boolean): Illustration {
  const base = replaceArms(standing, [[112, 88], [104, 116], [100, 86], [86, 113]]);
  const frame = (close: number) => {
    const grip = (wrist: Point, dx: number) => handPosition(wrist, [dx, 17 - close * 10], [dx - 6, 7]);
    return [...base, ...grip(base[4], -2), ...grip(base[6], -8)];
  };
  const attachments: Attachments = [["hand", 4, 11, 12]];
  if (barbell) attachments.push(["hand", 6, 13, 14], ["bar", 11, 13], ["barbell-end", 11, 12, 0], ["barbell-end", 13, -12, 0]);
  else attachments.push(["dumbbell", 11, 0, 0]);
  return clip([frame(1), frame(0), frame(1), frame(barbell ? 1.3 : 1)], attachments);
}

function wristRoll(mode: "neutral" | "overhand" | "cable"): Illustration {
  const cable = mode === "cable";
  const base = replaceArms(standing, [[152, 67], [183, 72], [146, 71], [175, 74]]);
  const frame = (lift: number, twist: number) => {
    const handleNear = add(base[4], [13, twist]), handleFar = add(base[6], [11, -twist]);
    const wheel = center(handleNear, handleFar);
    return [...base, handleNear, add(base[4], [0, mode === "neutral" ? -7 : 5]),
      handleFar, add(base[6], [0, mode === "neutral" ? -5 : 6]), wheel, add(wheel, [0, lift])];
  };
  const phases = cable ? [frame(0, 7), frame(0, -8), frame(0, -8)] :
    [frame(71, 4), frame(48, -5), frame(32, 5), frame(20, -5), frame(13, 2), frame(35, -5), frame(56, 4)];
  const attachments: Attachments = [["hand", 6, 13, 14], ["hand", 4, 11, 12], ["bar", 11, 13]];
  if (cable) attachments.push(["cable", 15, 231, 77]);
  else attachments.push(["line", 15, 16], ["plate", 16, 0, 0]);
  return clip(phases, attachments, cable ? cableStand : []);
}

function singleEzCurl(): Illustration {
  const setup = replaceArms(standing, [[137, 88], [145, 113], [111, 84], [109, 108]]);
  const at = (curled: boolean) => {
    const wrist = setup[4];
    const tip = add(wrist, curled ? [14, 4] : [7, 15]);
    const other = add(tip, curled ? [55, -15] : [57, 19]);
    return [...setup, tip, add(wrist, [-3, 7]), other];
  };
  return clip([at(false), at(true), at(true)], [["hand", 4, 11, 12], ["ez-bar", 11, 13], ["plate", 13, 0, 0]]);
}

function handSpring(): Illustration {
  const upperBody = replaceArms(seated, [[145, 108], [170, 111], [106, 93], [100, 109]]);
  const frame = (closed: boolean) => {
    const wrist = upperBody[4];
    const hand = handPosition(wrist, closed ? [14, -8] : [16, 0], [7, -8]);
    const gripper: Point[] = [closed ? [227, 88] : [212, 88], closed ? [237, 87] : [248, 88],
      [230, 61], [236, 61]];
    return [...upperBody, ...hand, add(hand[0], [5, -19]), add(hand[0], [6, -12]),
      ...fingerRig([231, 108], closed ? "closed" : "relaxed"), ...gripper];
  };
  const close = frame(true);
  return clip([frame(false), close, close],
    [["hand", 4, 11, 12], ["line", 11, 13], ["line", 12, 14], ...fingerStrokes(15),
      ["bar", 32, 34], ["bar", 33, 35], ["line", 34, 35], ["pad", 32, 0, 0], ["pad", 33, 0, 0]],
    chair);
}

function pinching(): Illustration {
  const setup = replaceArms(standing, [[138, 88], [142, 113], [112, 84], [109, 111]]);
  const at = (pinch: boolean) => [...setup, ...handPosition(setup[4], pinch ? [9, 6] : [13, 5], pinch ? [3, 7] : [1, 7]),
    [149, pinch ? 128 : 132] as Point];
  const held = at(true);
  return clip([at(false), held, held, held], [["plate", 13, -4, 0], ["barbell-end", 13, 1, 0], ["hand", 4, 11, 12]], [], 1350);
}

function squeezeWeights(): Illustration {
  const base: Arms = [[157, 76], [186, 85], [148, 72], [176, 68]];
  const pressed: Arms = [[156, 75], [182, 79], [152, 73], [176, 76]];
  return clip([replaceArms(standing, base), replaceArms(standing, pressed), replaceArms(standing, pressed)],
    [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]], [], 1300);
}

function hangingGrip(mode: "board" | "bar"): Illustration {
  const board = mode === "board";
  const position = (low: boolean): Point[] => {
    const y = low ? 5 : 0;
    const shoulder: Point = [147, 61 + y], near: Point = [168, 23], far: Point = [127, 23];
    const joints: Point[] = [[148, 45 + y], shoulder, [149, 106 + y], center(shoulder, near), near,
      center(shoulder, far), far, [154, 129 + y], [158, 151 + y - (board ? 6 : 0)],
      [138, 132 + y], [139, 152 + y - (board ? 6 : 0)],
      [173, board ? 17 : 23], [166, 25], [122, board ? 17 : 23], [130, 25]];
    return board ? [...joints, [170, 19], [174, 17], [171, 15], [167, 15], [164, 16],
      [125, 19], [128, 15], [124, 15], [120, 16], [118, 18]] : joints;
  };
  const rack: Props = board ? [[95, 12, 212, 12], [95, 12, 95, 22], [212, 12, 212, 22], [95, 20, 212, 20],
    [110, 16, 137, 16], [157, 16, 184, 16], [98, 11, 98, 155], [210, 11, 210, 155]] :
    [[99, 23, 213, 23], [103, 23, 103, 157], [211, 23, 211, 157], [134, 155, 166, 155],
      [135, 155, 135, 159], [166, 155, 166, 159]];
  const hand: Attachments = board ? [["digit", 4, 15, 5], ["digit", 6, 20, 5],
    ["digit", 15, 16], ["digit", 15, 17], ["digit", 15, 18], ["digit", 15, 19],
    ["digit", 20, 21], ["digit", 20, 22], ["digit", 20, 23], ["digit", 20, 24]] :
    [["palm-up", 4, 11], ["palm-up", 6, 13]];
  return clip([position(false), position(true), position(true), position(true)], hand, rack, 1350);
}

function assistedPulleyStretch(): Illustration {
  const grip: Point = [183, 77];
  const at = (lean: number) => [
    add(standing[0], [-lean, 2]), add(standing[1], [-lean, 5]), add(standing[2], [-lean * .55, 0]),
    [150 - lean / 2, 72], grip, [111 - lean, 87], [109 - lean, 109], [135, 134], [142, 156],
    [106, 132], [97, 156], add(grip, [9, 0]),
  ] as Point[];
  const held = at(14);
  return clip([at(0), held, held, held], [["cable", 4, 231, 77], ["pad", 4, 0, 0], ["palm-up", 4, 11]], cableStand, 1300);
}

export const gripIllustrations: Readonly<Record<string, Illustration>> = {
  "2098": heldStretch("pinky"),
  "1610": fingerCurl(true),
  "6269": wristRoll("cable"),
  "1611": fingerCurl(false),
  "11783": fingers("fast"),
  "6268": singleEzCurl(),
  "2091": heldStretch("extensor"),
  "1815": heldStretch("pronator"),
  "3345": handSpring(),
  "3833": hangingGrip("board"),
  "8882": wristRoll("neutral"),
  "2090": palmsOut(),
  "1044": pinching(),
  "8877": fingers("band"),
  "6763": heldStretch("seated"),
  "2097": fingers("separate"),
  "11791": fingers("ball"),
  "11794": fingers("table"),
  "1818": hangingGrip("bar"),
  "1819": assistedPulleyStretch(),
  "0854": squeezeWeights(),
  "0859": wristRoll("overhand"),
};
