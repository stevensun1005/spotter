import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Palm = "up" | "neutral" | "down";
type Support = "thigh" | "bench" | "standing";
type Load = "none" | "dumbbell" | "weighted" | "cable";

const standing: Point[] = [[119, 45], [121, 66], [119, 109], [126, 95], [167, 94],
  [114, 93], [153, 92], [129, 135], [128, 157], [112, 133], [110, 157]];
const seated: Point[] = [[113, 48], [115, 66], [111, 109], [136, 101], [170, 101],
  [107, 88], [102, 112], [157, 108], [158, 157], [142, 113], [136, 157]];
const seat: Props = [[97, 113, 128, 113], [102, 114, 102, 159], [123, 114, 123, 159]];
const bench: Props = [[143, 87, 177, 87], [147, 89, 147, 158], [171, 89, 171, 158]];
const table: Props = [[125, 98, 161, 98], [131, 99, 131, 158], [156, 99, 156, 158]];

function offset([x, y]: Point, [dx, dy]: Point): Point {
  return [x + dx, y + dy];
}

const fingerDirection: Record<Palm, Point> = { up: [17, -3], neutral: [17, 0], down: [17, 3] };
const thumbDirection: Record<Palm, Point> = { up: [12, 7], neutral: [8, -8], down: [12, -7] };
function forearmTurn(support: Support, load: Load, stages: Palm[], twoHands = false): Illustration {
  const body = support === "standing" ? standing : support === "bench"
    ? [...seated.slice(0, 3), [144, 84], [182, 84], ...seated.slice(5)] as Point[]
    : seated;
  const props: Props = support === "standing" ? [] : [...seat, ...(support === "bench" ? bench : [])];
  const dynamic: Attachments = [["hand", 4, 11, 12]];
  if (twoHands) dynamic.unshift(["hand", 6, 13, 14]);
  if (load === "cable") {
    props.push([224, 26, 224, 159], [246, 32, 246, 159], [217, 159, 253, 159]);
    dynamic.push(["cable", 17, 224, 145], ["line", 17, 18], ["line", 17, 19], ["bar", 18, 19]);
  }
  if (load === "dumbbell") dynamic.push(["bar", 15, 16], ["plate", 15, 0, 0], ["plate", 16, 0, 0]);
  if (load === "weighted") dynamic.push(["bar", 15, 16], ["plate", 16, 0, 0]);
  const axis: Record<Palm, Point> = { up: [9, 11], neutral: [12, 0], down: [9, -11] };
  const frames = stages.map((palm) => {
    const grip = offset(body[4], [11, 0]);
    const [dx, dy] = axis[palm];
    return [...body, offset(body[4], fingerDirection[palm]), offset(body[4], thumbDirection[palm]),
      offset(body[6], fingerDirection[palm]), offset(body[6], thumbDirection[palm]),
      [grip[0] - dx, grip[1] - dy] as Point, [grip[0] + dx, grip[1] + dy] as Point,
      offset(grip, [12, 8]), offset(grip, [2, -4]), offset(grip, [6, 6])];
  });
  return { frames, props, dynamic, ms: 960, reference: true };
}

type Tilt = "thumb" | "little" | "circle";
function wristTilt(tilt: Tilt): Illustration {
  const body = tilt === "circle" ? [...standing.slice(0, 3), [143, 68], [173, 69], [134, 63], [163, 64], ...standing.slice(7)] as Point[]
    : standing;
  const phases: Point[] = tilt === "circle" ? [[17, 0], [12, -9], [7, 0], [12, 9]]
    : [[17, 0], [13, tilt === "thumb" ? -12 : 12]];
  const frames = phases.map(([x, y]) => [...body, offset(body[4], [x, y]), offset(body[4], [x - 6, y - 6]),
    offset(body[6], [x, y]), offset(body[6], [x - 6, y - 6])]);
  return { frames, props: tilt === "circle" ? [] : table,
    dynamic: tilt === "circle" ? [["hand", 6, 13, 14], ["hand", 4, 11, 12]] : [["hand", 4, 11, 12]],
    ms: 900, reference: true };
}

function supportedStretch(palm: "up" | "down", tilt: "straight" | "thumb" | "little" = "straight",
  onSeat = false, fingersOnly = false): Illustration {
  const base = onSeat ? seated : standing;
  const body: Point[] = [...base.slice(0, 3), [144, 73], [171, 74], [142, 87], [184, 83], ...base.slice(7)];
  const thumbBias = tilt === "thumb" ? -5 : tilt === "little" ? 6 : 0;
  const direction = palm === "up" ? 1 : -1;
  const relaxed = [...body, [189, 75], [182, 75 + 7 * direction], [187, 81], [183, 80]] as Point[];
  const bentFinger: Point = [185 + thumbBias, 92];
  const bentThumb: Point = fingersOnly ? [183, 77 + 5 * direction] : [173 + thumbBias, 79 + 4 * direction];
  const held = [...body, bentFinger, bentThumb, offset(bentFinger, [1, -1]), offset(bentFinger, [-4, 4])] as Point[];
  held[6] = offset(bentFinger, [-7, 4]);
  return { frames: [relaxed, held, held, held], props: onSeat ? seat : [],
    dynamic: [["hand", 4, 11, 12], ["hand", 6, 13, 14]], ms: 1250, reference: true };
}

function elbowsStraightRotation(): Illustration {
  const body: Point[] = [...standing.slice(0, 3), [143, 72], [172, 73], [145, 89], [170, 81], ...standing.slice(7)];
  const frames = (["up", "neutral", "down", "down", "neutral", "up"] as const).map((palm): Point[] =>
    [...body, offset(body[4], fingerDirection[palm]), offset(body[4], thumbDirection[palm]),
      offset(body[6], [14, -5]), offset(body[6], [8, 0])]);
  return { frames, dynamic: [["hand", 4, 11, 12], ["hand", 6, 13, 14]], ms: 1050, reference: true };
}

function fingersCurlWithThumbExtended(): Illustration {
  const body: Point[] = [...standing.slice(0, 3), [142, 87], [175, 92], [108, 91], [114, 106], ...standing.slice(7)];
  return { frames: [
    [...body, [200, 91], [186, 81]],
    [...body, [191, 98], [186, 81]],
    [...body, [186, 95], [186, 81]],
  ], dynamic: [["hand", 4, 11, 12]], ms: 950, reference: true };
}

function kneelingWristStretch(): Illustration {
  const legsAndFingers: Point[] = [[112, 155], [91, 155], [105, 158], [83, 156],
    [141, 157], [149, 151], [151, 158], [165, 151]];
  const ready: Point[] = [[179, 89], [168, 104], [121, 113], [161, 128], [156, 155], [168, 129], [166, 155], ...legsAndFingers];
  const held: Point[] = [[162, 97], [151, 111], [105, 122], [154, 133], [156, 155], [159, 132], [166, 155], ...legsAndFingers];
  return { frames: [ready, held, held, held], dynamic: [["hand", 6, 13, 14], ["hand", 4, 11, 12]],
    ms: 1150, reference: true };
}

const standardFlexor = supportedStretch("up");
const standardExtensor = supportedStretch("down");

export const wristMobilityIllustrations: Readonly<Record<string, Illustration>> = {
  "8881": forearmTurn("thigh", "cable", ["up", "neutral", "down"]),
  "6758": forearmTurn("bench", "dumbbell", ["neutral", "up", "up"]),
  "10817": forearmTurn("thigh", "dumbbell", ["up", "neutral", "down"]),
  "10038": forearmTurn("thigh", "dumbbell", ["down", "neutral", "up"]),
  "2765": forearmTurn("standing", "none", ["up", "neutral", "down"]),
  "2766": forearmTurn("standing", "none", ["down", "neutral", "up"]),
  "5286": forearmTurn("standing", "none", ["down", "neutral", "up", "neutral"], true),
  "4231": forearmTurn("thigh", "weighted", ["down", "neutral", "up"]),
  "4938": wristTilt("thumb"),
  "2789": wristTilt("little"),
  "1428": wristTilt("circle"),
  "11383": standardExtensor,
  "1850": standardFlexor,
  "1823": supportedStretch("down", "thumb"),
  "1824": supportedStretch("up", "thumb"),
  "1822": supportedStretch("down", "little"),
  "1825": supportedStretch("up", "little"),
  "1821": elbowsStraightRotation(),
  "2095": supportedStretch("up", "straight", false, true),
  "1827": standardExtensor,
  "1826": standardFlexor,
  "2089": supportedStretch("up", "straight", false, true),
  "2096": supportedStretch("down", "straight", false, true),
  "10031": fingersCurlWithThumbExtended(),
  "0561": kneelingWristStretch(),
};
