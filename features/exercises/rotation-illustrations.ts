import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Stance = "standing" | "kneeling" | "squat" | "single-leg" | "supine";
type Gear = "bodyweight" | "kettlebell" | "dumbbell" | "ball" | "cable-high" | "cable-low" | "band-high";
const floor: Equipment = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const anchor = (x: number, y: number, low: boolean): Props => [
  [x, 24, x, 156], [x - 12, 156, x + 12, 156], [x - 5, y, x + 5, y], [x + 5, low ? 148 : 25, x + 5, 156],
];

function chop(stance: Stance, gear: Gear, anchorDown = false): Illustration {
  const grounded = stance === "supine";
  const half = stance === "kneeling";
  const airborne = stance === "single-leg";
  const frame = (closed: boolean): Point[] => {
    const lower = stance === "squat" && closed;
    const shoulder: Point = grounded ? [105, 149] : half ? [156 + (closed ? -7 : 7), 85]
      : [159 + (closed ? -8 : 8), lower ? 90 : 67];
    const hip: Point = grounded ? [154, 151] : [158, half ? 123 : lower ? 130 : 112];
    const head: Point = grounded ? [87, 142] : [shoulder[0] + (closed ? -5 : 5), shoulder[1] - 18];
    const grip: Point = grounded ? (closed ? [157, 133] : [113, 94])
      : closed ? [118, half ? 126 : 119] : [204, gear === "kettlebell" ? 61 : 43];
    const nearElbow: Point = [Math.round((shoulder[0] + grip[0]) / 2) + 3, Math.round((shoulder[1] + grip[1]) / 2) + 6];
    const farElbow: Point = [nearElbow[0] - 7, nearElbow[1] - 6];
    const legs: Point[] = grounded ? [[180, 120], [193, 153], [172, 124], [181, 154], [207, 158], [194, 158]]
      : half ? [[178, 153], [145, 154], [140, 153], [107, 154], [137, 158], [97, 158]]
      : airborne ? [[153, 135], [153, 155], [181, 123], [188, 141], [161, 158], [197, 146]]
      : [[lower ? 185 : 178, 137], [191, closed ? 151 : 154], [lower ? 136 : 145, 137], [130, 154], [199, 158], [121, 158]];
    return [head, shoulder, hip, nearElbow, [grip[0] + 3, grip[1] + 2],
      farElbow, [grip[0] - 3, grip[1] - 1], ...legs, grip];
  };
  const top = frame(false);
  const bottom = frame(true);
  const dynamic: Equipment = [...floor];
  let props: Props = [];
  if (gear === "kettlebell" || gear === "dumbbell" || gear === "ball") dynamic.push([gear, 13, 0, gear === "kettlebell" ? 8 : 0]);
  if (gear === "cable-high" || gear === "band-high") {
    props = anchor(246, 38, false);
    dynamic.push([gear === "band-high" ? "band" : "cable", 13, 246, 38]);
  }
  if (gear === "cable-low") {
    props = anchor(83, 139, true);
    dynamic.push(["cable", 13, 83, 139]);
  }
  return { frames: anchorDown ? [bottom, top] : [top, bottom], props, dynamic, ms: 900, reference: true };
}

function rotation(loaded: boolean): Illustration {
  const frame = (side: number): Point[] => {
    const shoulder: Point = loaded ? [151 + side * 6, 104] : [156 + side * 5, 66];
    const hip: Point = loaded ? [156, 148] : [156, 111];
    const head: Point = [shoulder[0] + side * 4, shoulder[1] - 18];
    const [x, y] = shoulder;
    const near: Point = [x + 29 - side * 10, y + side * 3];
    const far: Point = [x - 29 - side * 10, y - side * 3];
    const legs: Point[] = loaded ? [[184, 120], [201, 154], [174, 126], [187, 154], [215, 158], [200, 158]]
      : [[169, 134], [177, 154], [143, 134], [135, 154], [190, 158], [121, 158]];
    return [head, shoulder, hip,
      [near[0] - 4, near[1] + (loaded ? 17 : 5)], loaded ? near : [near[0] + side * 7, near[1] + 9],
      [far[0] + 4, far[1] + (loaded ? 17 : 5)], loaded ? far : [far[0] + side * 7, far[1] + 9],
      ...legs, [near[0] + (side ? 7 : 12), near[1]], [far[0] - (side ? 7 : 12), far[1]]];
  };
  const neutral = frame(0);
  return { frames: [neutral, frame(-1), neutral, frame(1)], ms: 900, reference: true,
    dynamic: loaded ? [...floor, ["bar", 13, 14], ["plate", 13, 0, 0], ["plate", 14, 0, 0]] : floor };
}

function sideStepPallof(): Illustration {
  const make = (distance: number, gap: number): Point[] => {
    const x = 143 + distance;
    const ankleY = gap > 28 ? 145 : 154;
    return [[x, 59], [x, 77], [x - 2, 113], [x + 25, 87], [x + 51, 88], [x + 23, 91], [x + 47, 90],
      [x + gap / 2, 132], [x + gap, ankleY], [x - 14, 133], [x - 20, 154],
      [x + gap + 12, ankleY + 4], [x - 32, 158], [x + 49, 89]];
  };
  return { frames: [make(0, 18), make(8, 32), make(22, 18), make(30, 32), make(42, 18),
    make(25, 23), make(13, 23)], props: anchor(70, 87, false), dynamic: [...floor, ["band", 13, 70, 87]],
    ms: 570, reference: true };
}

const heldSideSteps = sideStepPallof();
export const rotationIllustrations: Record<string, Illustration> = {
  "3776": heldSideSteps,
  "3790": heldSideSteps,
  "4854": rotation(true),
  "4855": rotation(false),
  "5882": chop("squat", "bodyweight"),
  "11251": chop("kneeling", "cable-high"),
  "8193": chop("standing", "cable-low", true),
  "4747": chop("supine", "dumbbell", true),
  "5108": chop("squat", "dumbbell", true),
  "8025": chop("standing", "kettlebell"),
  "1697": chop("squat", "ball"),
  "1704": chop("single-leg", "ball"),
  "4776": chop("kneeling", "band-high"),
};
