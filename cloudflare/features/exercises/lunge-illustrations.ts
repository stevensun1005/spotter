import type { Illustration, Point } from "./motion-data";

type Pair = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Hold = "free" | "free-chest" | "hands-hips" | "overhead" | "bar-front" | "bar-back" | "bar-overhead" | "dbs" | "db-one" | "db-front" | "db-overhead" | "db-single-overhead"
  | "db-goblet" | "kb-goblet" | "kb-overhead" | "kb-left" | "kb-right" | "bottles" | "plate" | "cable-low" | "cable-mid" | "band" | "sandbag";
type Direction = "forward" | "reverse" | "static" | "side" | "curtsy";

const cableTower = (height: number): Props => [[56, 30, 56, 157], [45, 157, 65, 157], [56, height, 65, height]];
const loadedGear: Partial<Record<Hold, Attachments>> = {
  "bar-front": [["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]],
  "bar-back": [["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]],
  "bar-overhead": [["bar", 4, 6], ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]],
  dbs: [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]],
  "db-one": [["dumbbell", 4, 0, 0]],
  "db-front": [["dumbbell", 4, 0, -3], ["dumbbell", 6, 0, -3]],
  "db-overhead": [["dumbbell", 4, 0, -3], ["dumbbell", 6, 0, -3]],
  "db-single-overhead": [["dumbbell", 4, 0, -3]],
  "db-goblet": [["dumbbell", 4, -4, 3]],
  "kb-goblet": [["kettlebell", 4, -4, -3]],
  "kb-overhead": [["kettlebell", 4, 0, -3]],
  "kb-left": [["kettlebell", 6, 0, 0]],
  "kb-right": [["kettlebell", 4, 0, 0]],
  bottles: [["bottle", 4, 0, 0], ["bottle", 6, 0, 0]],
  plate: [["plate", 4, -6, -1]],
  "cable-low": [["cable", 4, 65, 147]],
  "cable-mid": [["cable", 4, 65, 84]],
  band: [["band", 4, 8], ["band", 6, 10]],
  sandbag: [["sandbag", 4, -4, -5]],
};

function hands(hold: Hold, x: number, y: number, lower: boolean): [Pair, Pair] {
  const loose: [Pair, Pair] = [[[x + 9, y + 20], [x + 9, y + 44]], [[x - 11, y + 19], [x - 11, y + 42]]];
  switch (hold) {
    case "bar-front":
    case "band":
    case "db-front": return [[[x + 20, y + 9], [x + 8, y - 4]], [[x + 7, y + 7], [x - 15, y - 5]]];
    case "bar-back": return [[[x + 1, y + 19], [x - 15, y - 3]], [[x - 14, y + 18], [x - 27, y - 2]]];
    case "overhead":
    case "bar-overhead":
    case "db-overhead": return [[[x + 10, y - 21], [x + 12, y - 44]], [[x - 10, y - 21], [x - 12, y - 44]]];
    case "plate": return [[[x + 10, y - 21], [x + 7, y - 42]], [[x - 10, y - 21], [x - 7, y - 42]]];
    case "db-single-overhead":
    case "kb-overhead": return [[[x + 4, y - 22], [x + 5, y - 44]], [[x - 14, y + 22], [x - 23, y + 34]]];
    case "hands-hips": return [[[x + 16, y + 23], [x + 1, y + 41]], [[x - 17, y + 23], [x - 9, y + 40]]];
    case "free-chest":
    case "db-goblet":
    case "kb-goblet":
    case "cable-low":
    case "cable-mid":
    case "sandbag": return [[[x + 18, y + 25], [x + 12, y + 12]], [[x + 4, y + 25], [x + 6, y + 12]]];
    case "free": return lower
      ? [[[x + 13, y + 24], [x - 1, y + 42]], [[x - 12, y + 21], [x - 16, y + 40]]]
      : loose;
    default: return loose;
  }
}

function lunge(direction: Direction, load: Hold = "free", extra?: "deficit" | "hinge" | "short" | "smith" | "high-knee" | "reach") {
  const raised = extra === "deficit";
  const floor = raised ? 144 : 156;
  const props: Props = [];
  if (raised) props.push([137, 147, 188, 147], [141, 147, 141, 158], [184, 147, 184, 158]);
  if (extra === "smith") props.push([136, 28, 136, 158], [156, 28, 156, 158], [131, 158, 164, 158], [135, 28, 157, 28]);
  if (load === "cable-low" || load === "cable-mid") props.push(...cableTower(load === "cable-low" ? 147 : 84));
  const dynamic: Attachments = [...(loadedGear[load] ?? [])];
  const pose = (hip: Point, legs: [Pair, Pair], lower = false) => {
    const x = extra === "smith" ? 157 : hip[0] + (extra === "hinge" && lower ? 25 : 5);
    const y = hip[1] - (extra === "hinge" && lower ? 40 : 48);
    const grip = extra === "reach" && lower ? "overhead" : load;
    const arms = hands(grip, x, y, lower);
    const pelvis: Point = extra === "smith" ? [150, hip[1]] : hip;
    return [[x + (extra === "hinge" && lower ? 11 : 3), y - 15] as Point, [x, y] as Point, pelvis, ...arms[0], ...arms[1], ...legs[0], ...legs[1]];
  };

  let frames: Point[][];
  if (direction === "side" || direction === "curtsy") {
    const neutral = pose([159, 109], [[[171, 131], [170, floor]], [[147, 131], [146, floor]]]);
    const feet = (body: Point[], crossing: boolean): Point[] => {
      if (direction !== "curtsy") return body;
      return [...body, [body[8][0] + 8, floor], [body[10][0] + 7, crossing ? floor + 1 : floor]];
    };
    const out = direction === "side"
      ? pose([181, 122], [[[217, 125], [219, floor]], [[147, 135], [110, floor]]], true)
      : pose([164, 120], [[[177, 132], [170, floor]], [[156, 144], [190, floor - 8]]], true);
    if (direction === "curtsy") dynamic.push(["foot-tip", 8, 11], ["foot-tip", 10, 12]);
    frames = [feet(neutral, false), feet(out, true)];
  } else {
    const leftX = direction === "reverse" ? 90 : 118;
    const rightX = direction === "reverse" ? 159 : extra === "short" ? 181 : 200;
    const frontFoot: Point = [rightX, floor];
    const rearFoot: Point = [leftX, direction === "static" ? 148 : 156];
    const highSplit = pose([(leftX + rightX) / 2, raised ? 102 : 109],
      [[[(leftX + 3 * rightX) / 4, 128], frontFoot], [[(3 * leftX + rightX) / 4, 132], rearFoot]]);
    const deep = pose([rightX - 35, raised ? 110 : 118],
      [[[(rightX + rightX - 7) / 2, raised ? 109 : 119], frontFoot], [[leftX + 25, 149], rearFoot]], true);
    const homeX = direction === "forward" ? leftX + 2 : rightX - 4;
    const start = pose([homeX, raised ? 99 : 109], [[[homeX + 7, 127], [homeX + 6, floor]], [[homeX - 7, 128], [homeX - 6, floor]]]);
    const kneeUp = pose([homeX, 109], [[[homeX + 4, 133], [homeX + 4, floor]], [[homeX + 34, 105], [homeX + 34, 140]]]);
    if (direction === "static") dynamic.push(["foot-tip", 8, 11], ["foot-tip", 10, 12]);
    frames = direction === "static" ? [highSplit, deep].map((frame): Point[] => [...frame, [rightX + 10, floor], [leftX + 9, 156]]) : extra === "high-knee"
      ? [start, highSplit, deep, highSplit, kneeUp] : [start, highSplit, deep, highSplit];
  }
  return { frames, props, dynamic, ms: direction === "static" ? 1080 : 670, reference: true };
}

export const lungeIllustrations: Readonly<Record<string, Illustration>> = {
  "0612": lunge("forward"),
  "11255": lunge("side", "cable-low"),
  "11657": lunge("reverse", "plate"),
  "1175": lunge("forward", "dbs", "hinge"),
  "1215": lunge("side", "dbs"),
  "1581": lunge("reverse"),
  "1694": lunge("side", "db-single-overhead"),
  "2367": lunge("reverse", "dbs", "deficit"),
  "2424": lunge("forward", "band"),
  "2972": lunge("side", "free-chest"),
  "3339": lunge("forward", "db-one"),
  "3341": lunge("forward", "dbs"),
  "3350": lunge("side", "cable-low"),
  "3351": lunge("forward", "cable-mid"),
  "3355": lunge("side", "cable-mid"),
  "3356": lunge("forward", "cable-low"),
  "3398": lunge("forward", "db-front"),
  "3399": lunge("forward", "bar-front"),
  "3448": lunge("side", "dbs"),
  "3574": lunge("forward", "kb-goblet"),
  "3575": lunge("reverse", "kb-goblet"),
  "3683": lunge("curtsy", "db-goblet"),
  "3723": lunge("curtsy", "bar-back"),
  "3725": lunge("forward", "bar-overhead"),
  "3732": lunge("curtsy", "kb-goblet"),
  "4000": lunge("static"),
  "4045": lunge("side", "kb-goblet"),
  "4098": lunge("side", "kb-goblet"),
  "4290": lunge("static", "dbs"),
  "4382": lunge("forward", "bar-front"),
  "4390": lunge("reverse", "bar-front"),
  "4949": lunge("forward", "free", "hinge"),
  "4950": lunge("forward", "hands-hips", "short"),
  "5070": lunge("reverse", "kb-goblet"),
  "5071": lunge("forward", "kb-overhead"),
  "5076": lunge("forward", "db-overhead"),
  "5095": lunge("forward", "db-single-overhead"),
  "5312": lunge("reverse", "free", "deficit"),
  "5336": lunge("forward", "kb-goblet"),
  "5582": lunge("reverse", "free", "deficit"),
  "5825": lunge("reverse", "bar-back", "smith"),
  "6047": lunge("forward", "bottles"),
  "6048": lunge("reverse", "bottles"),
  "6318": lunge("curtsy"),
  "6551": lunge("reverse", "free", "reach"),
  "7326": lunge("reverse", "dbs", "deficit"),
  "7581": lunge("reverse", "kb-right"),
  "7582": lunge("reverse", "kb-left"),
  "8664": lunge("curtsy", "dbs"),
  "9610": lunge("forward", "plate"),
  "9611": lunge("forward", "overhead"),
  "9940": lunge("forward", "sandbag"),
  "10054": lunge("static", "bar-back"),
  "10562": lunge("reverse", "kb-left", "high-knee"),
};
