
import type { Illustration, Point } from "./motion-data";
import { squatLungeVariantsIllustrations as checkedSquats } from "./squat-lunge-variants-illustrations";
import { stepLungeIllustrations as checkedLunges } from "./step-lunge-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Tools = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Pair = [Limb, Limb];

const floor = 155;
const move = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const center = ([x, y]: Point, [a, b]: Point): Point => [(x + a) / 2, (y + b) / 2];
const footParts: Tools = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const dumbbells: Tools = [["dumbbell", 4, 0, 2], ["dumbbell", 6, 0, 2]];
const bandsAtFeet: Tools = [["band", 4, 8], ["band", 6, 10]];
const rig: Props = [[231, 33, 231, 158], [220, 34, 242, 34], [221, 158, 251, 158], [225, 146, 240, 146]];
const bench = (x1: number, x2: number, y: number): Props =>
  [[x1, y, x2, y], [x1 + 4, y, x1 + 4, 158], [x2 - 4, y, x2 - 4, 158]];
const wedges: Props = [[142, 149, 166, 157], [141, 149, 141, 158], [156, 149, 184, 157], [156, 149, 156, 158]];
const rack: Props = [[96, 25, 96, 158], [100, 30, 100, 152], [205, 26, 205, 158], [201, 30, 201, 152],
  [96, 26, 205, 26], [91, 158, 115, 158], [188, 158, 211, 158]];

function figure(shoulder: Point, hip: Point, arms: Pair, legs: Pair,
  tips = [move(legs[0][1], 9, 1), move(legs[1][1], 8, 1)]): Point[] {
  return [move(shoulder, 4, -15), shoulder, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...tips];
}

function show(frames: Point[][], props: Props = [], load: Tools = [], ms = 780): Illustration {
  return { frames, props, ms, dynamic: [...footParts, ...load], reference: true };
}

function rest(shoulder: Point): Pair {
  return [[move(shoulder, 12, 22), move(shoulder, 14, 44)],
    [move(shoulder, -10, 22), move(shoulder, -12, 42)]];
}

function inRack(shoulder: Point): Pair {
  return [[move(shoulder, 18, 15), move(shoulder, 13, 0)],
    [move(shoulder, -13, 15), move(shoulder, -11, 1)]];
}

function reach(shoulder: Point): Pair {
  return [[move(shoulder, 20, 8), move(shoulder, 41, 5)],
    [move(shoulder, 13, 13), move(shoulder, 33, 8)]];
}

function up(shoulder: Point): Pair {
  return [[move(shoulder, 12, -18), move(shoulder, 13, -37)],
    [move(shoulder, -13, -16), move(shoulder, -14, -35)]];
}

type Squat = "band" | "band-full" | "band-sumo" | "band-overhead" | "band-row" | "chains" | "bench-chains"
  | "barbell" | "hanging" | "ssb-heel" | "ssb-front" | "mace" | "upright-row" | "pistol" | "thruster"
  | "deep-thruster" | "single-overhead" | "wedge" | "wedge-load" | "toe" | "chair" | "touch" | "high-knee" | "reach" | "bottle";

function squat(kind: Squat) {
  const wide = kind === "band-sumo" || kind === "touch" || kind === "reach";
  const heels = kind === "wedge" || kind === "wedge-load" || kind === "ssb-heel";
  const toesOnly = kind === "toe", goblet = kind === "pistol" || kind === "wedge-load";
  const chair = kind === "chair" || kind === "bench-chains";
  const chains = kind === "chains" || kind === "bench-chains", hanging = kind === "hanging";
  const safety = kind === "ssb-heel" || kind === "ssb-front";
  const bar = chains || hanging || safety || kind === "barbell";
  const row = kind === "band-row", uprightRow = kind === "upright-row";
  const thruster = kind === "thruster" || kind === "deep-thruster";
  const lower = kind === "band-full" || kind === "deep-thruster" || kind === "ssb-front" || goblet || kind === "wedge" || kind === "touch";
  const nearFoot: Point = [wide ? 192 : kind === "wedge" ? 159 : 165, heels || toesOnly ? 147 : floor];
  const farFoot: Point = [wide ? 109 : kind === "wedge" ? 148 : 145, heels || toesOnly ? 147 : floor];

  const props: Props = [];
  if (heels) {
    if (kind === "wedge") props.push([146, 151, 158, 156], [146, 151, 146, 157], [157, 151, 171, 156], [157, 151, 157, 157]);
    else props.push(...wedges);
  }
  if (chair) {
    props.push(...bench(84, 135, 130));
    if (kind === "chair") props.push([87, 85, 87, 130]);
  }
  if (row) props.push(...rig);
  if (bar) props.push(...rack);

  let load: Tools = [];
  if (kind === "band" || kind === "band-full" || kind === "band-overhead" || kind === "band-sumo") load = bandsAtFeet;
  if (row) load = [["band", 4, 231, 147]];
  if (bar || uprightRow) load = [["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]];
  if (chains) load.push(["chain", 13, 0, 157], ["chain", 14, 0, 157]);
  if (hanging) load.push(["band", 15, 13], ["band", 16, 14], ["kettlebell", 15, 0, 10], ["kettlebell", 16, 0, 10]);
  if (safety) load = [["bar", 15, 16], ["bar", 13, 15], ["bar", 14, 16], ["barbell-end", 13, 0, 0],
    ["barbell-end", 14, 0, 0], ["pad", 17, 0, 0], ["line", 4, 17], ["line", 6, 17]];
  if (kind === "mace") load = [["bar", 13, 14], ["ball", 13, 0, 0]];
  if (goblet) load = kind === "wedge-load" ? [["plate", 17, 0, 1]] : [["hammer-weight", 17, 0, 1]];
  if (thruster || kind === "single-overhead") load = kind === "single-overhead" ? [["dumbbell", 4, 0, 1]] : dumbbells;
  if (kind === "bottle") load = [["bottle-upright", 4, 0, 2], ["bottle-upright", 6, 0, 2]];

  function at(depth: number, event = 0): Point[] {
    const standard = heels || toesOnly ? 83 : 88;
    const upperX = wide ? 151 : 147;
    const hip: Point = [upperX - depth * (wide ? 0 : toesOnly ? 9 : 20), standard + depth * (lower ? kind === "deep-thruster" ? 47 : 43 : kind === "reach" ? 22 : 36)];
    const shoulder: Point = move(hip, depth * (kind === "touch" ? 12 : toesOnly ? 7 : 17), -38);
    if (kind === "reach") shoulder[0] += event * 18;
    const nearAnkle = kind === "high-knee" && event === 1 ? [178, 115] as Point : nearFoot;
    const farAnkle = kind === "high-knee" && event === -1 ? [164, 115] as Point
      : kind === "pistol" ? move(hip, 65, 15) : farFoot;
    const nearKnee: Point = kind === "high-knee" && event === 1 ? [187, 83]
      : [(hip[0] + nearFoot[0]) / 2 + (wide ? 8 + depth * 15 : 5 + depth * 27), (hip[1] + nearFoot[1]) / 2 - depth * 13];
    const farKnee: Point = kind === "high-knee" && event === -1 ? [171, 83] : kind === "pistol" ? center(hip, farAnkle)
      : [(hip[0] + farFoot[0]) / 2 + (wide ? -8 - depth * 15 : 4 + depth * 26), (hip[1] + farFoot[1]) / 2 - depth * 12];
    let arms: Pair = reach(shoulder);
    if (bar) arms = safety ? inRack(shoulder) : [[move(shoulder, 29, 15), move(shoulder, 26, -4)],
      [move(shoulder, -27, 14), move(shoulder, -23, -4)]];
    if (goblet) arms = [[move(shoulder, 19, 20), move(shoulder, 8, 12)], [move(shoulder, -9, 21), move(shoulder, 0, 12)]];
    if (kind === "band" || kind === "band-full" || kind === "band-sumo") arms = inRack(shoulder);
    if (kind === "band-overhead" || (thruster && event)) arms = up(shoulder);
    if (thruster && !event) arms = inRack(shoulder);
    if (kind === "single-overhead") arms = [up(shoulder)[0], reach(shoulder)[1]];
    if (row) arms = [event ? [move(shoulder, -9, 20), move(shoulder, 13, 27)] :
      [move(shoulder, 23, 19), move(shoulder, 45, 24)], rest(shoulder)[1]];
    if (uprightRow) arms = event ? [[move(shoulder, 24, -2), move(shoulder, 10, 18)], [move(shoulder, -21, -1), move(shoulder, -9, 18)]]
      : [[move(shoulder, 12, 21), [171, 110 + 23 * depth]], [move(shoulder, -9, 22), [144, 110 + 23 * depth]]];
    if (kind === "mace") arms = [[move(shoulder, 18, 13), move(shoulder, 14, -3)], [move(shoulder, -19, 11), move(shoulder, -14, -3)]];
    if (kind === "touch") arms = [[move(shoulder, 12, 24), [159, 113 + depth * 43]], [move(shoulder, -13, 24), [144, 114 + depth * 42]]];
    if (kind === "reach" && event) arms = event > 0 ? [up(shoulder)[0], rest(shoulder)[1]] : [rest(shoulder)[0], up(shoulder)[1]];
    if (kind === "bottle") arms = event > 0 ? [up(shoulder)[0], rest(shoulder)[1]]
      : event < 0 ? [rest(shoulder)[0], up(shoulder)[1]] : rest(shoulder);
    const nearToe = [nearAnkle[0] + 9, kind === "high-knee" && event === 1 ? 116 : floor + 1] as Point;
    const farToe: Point = [farAnkle[0] + (wide ? -9 : 8), farAnkle === farFoot ? floor + 1 : farAnkle[1] + 1];
    const frame = figure(shoulder, hip, arms, [[nearKnee, nearAnkle], [farKnee, farAnkle]], [nearToe, farToe]);
    const gripY = uprightRow ? arms[0][1][1] : shoulder[1] - (kind === "ssb-front" ? -3 : 4);
    const barY = safety ? gripY + 12 : gripY;
    const barX = uprightRow ? 156 : shoulder[0] + (kind === "ssb-front" ? 7 : -1);
    const ends: [Point, Point] = [[barX - 38, barY], [barX + 38, barY]];
    const fittings = hanging ? [move(ends[0], depth * -4, 36), move(ends[1], depth * 4, 36)]
      : [move(ends[0], 9, -12), move(ends[1], -9, -12)];
    return [...frame, ...ends, ...fittings, goblet ? center(arms[0][1], arms[1][1]) : [barX, gripY] as Point];
  }

  const top = at(0), low = at(1);
  const frames = kind === "reach" ? [top, low, at(1, 1), low, at(1, -1), low, top]
    : kind === "high-knee" || kind === "bottle" ? [top, low, at(0, 1), top, low, at(0, -1), top]
      : row || thruster || uprightRow ? [top, at(.45), low, at(.45), at(0, 1), at(0, 1), top]
        : [top, at(.5), low, low, at(.5)];
  return show(frames, props, load, kind === "high-knee" ? 660 : 810);
}

type Lunge = "band" | "band-split" | "band-forward" | "band-high-row" | "narrow-db" | "raise" | "press"
  | "row" | "smith" | "diagonal-db" | "vibration" | "swing";
function lunge(kind: Lunge) {
  const forward = kind === "band-forward" || kind === "swing";
  const fixed = kind === "band" || kind === "band-split" || kind === "vibration";
  const cross = kind === "smith" || kind === "diagonal-db";
  const vibration = kind === "vibration", rowBand = kind === "band-high-row";
  const props: Props = vibration ? [[145, 140, 200, 140], [148, 142, 198, 142], [146, 140, 146, 157],
    [199, 140, 199, 157], [145, 157, 201, 157], [180, 147, 192, 147]]
    : kind === "smith" ? rack : rowBand ? rig : [];
  const attachments: Tools = kind === "band-forward" || kind === "band"
    ? bandsAtFeet : kind === "band-split" ? [["band", 4, 8], ["band", 6, 8]]
      : rowBand ? [["band", 4, 231, 148]]
        : kind === "smith" ? [["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]]
          : kind === "press" ? [["dumbbell", 4, 0, 2]] : vibration ? [] : dumbbells;

  function at(depth: number, legTravel: number, final = false): Point[] {
    const support: Point = [kind === "narrow-db" ? 153 : 165, vibration ? 136 : floor];
    const follow: Point = [152 + (forward ? 46 : cross ? 38 : -38) * legTravel,
      floor - (vibration ? 0 : 4 * legTravel) - 10 * Math.sin(Math.PI * legTravel)];
    if (final && rowBand) { follow[0] = 181; follow[1] = 119; }
    if (forward && legTravel === 1) follow[1] = floor;
    const hip: Point = [forward ? 146 + 27 * depth : 145 + 5 * depth, (vibration ? 80 : 88) + 35 * depth];
    const shoulder: Point = [kind === "smith" ? 151 : hip[0] + 4 + (kind === "row" ? 12 * depth : 0), hip[1] - 39];
    const a: Point = [forward && legTravel === 1 ? 168 : support[0] - (1 - depth) * 6, (hip[1] + support[1]) / 2 - 9 * depth];
    const b: Point = final && rowBand ? [192, 87] : [forward ? follow[0] - 4 : cross ? 160 + 7 * depth : 129,
      forward ? 122 - depth * 5 : 119 + 29 * depth];
    let arms = rest(shoulder);
    if (kind.startsWith("band") && !rowBand) arms = inRack(shoulder);
    if (kind === "press") arms = [inRack(shoulder)[0], rest(shoulder)[1]];
    if (kind === "press" && final) arms[0] = up(shoulder)[0];
    if (kind === "raise" && depth > .45) arms = reach(shoulder);
    if (kind === "swing" && depth > .45) arms = [[move(shoulder, 19, -4), move(shoulder, 39, -12)],
      [move(shoulder, 16, 0), move(shoulder, 34, -9)]];
    if (kind === "row" && final) arms = [[move(shoulder, -7, 17), move(shoulder, 12, 26)], [move(shoulder, -15, 18), move(shoulder, 1, 25)]];
    if (rowBand) arms[0] = final ? [move(shoulder, -9, 20), move(shoulder, 10, 25)] : reach(shoulder)[0];
    if (kind === "smith") arms = [[move(shoulder, 22, 10), move(shoulder, 18, -4)], [move(shoulder, -18, 10), move(shoulder, -15, -4)]];
    const foot: Point = [support[0] + 8, vibration ? 138 : floor + 1];
    const otherToe: Point = [follow[0] + (cross ? -8 : 8), final && rowBand ? 121 : follow[1] + 4 * legTravel];
    const frame = figure(shoulder, hip, arms, [[a, support], [b, follow]], [foot, otherToe]);
    return [...frame, [111, shoulder[1] - 4], [191, shoulder[1] - 4]];
  }

  const top = at(0, fixed ? 1 : 0), moving = at(.24, .52), low = at(1, 1);
  const frames = fixed ? [top, at(.5, 1), low, low, at(.5, 1)]
    : kind === "row" ? [top, moving, low, at(1, 1, true), low, moving]
      : kind === "press" || rowBand ? [top, moving, low, moving, at(0, 0, true), top]
        : [top, moving, low, low, moving];
  const alternating = kind === "band-forward" || kind === "raise" || kind === "swing" || kind === "diagonal-db";
  const opposite = alternating ? frames.map((frame) => {
    const swapped = frame.slice();
    [swapped[7], swapped[8], swapped[9], swapped[10], swapped[11], swapped[12]] =
      [swapped[9], swapped[10], swapped[7], swapped[8], swapped[12], swapped[11]];
    return swapped;
  }) : [];
  return show([...frames, ...opposite], props, attachments, 790);
}

function lateral(kind: "band-step" | "band-low" | "band-lunge" | "wide" | "up-step") {
  const lowSteps = kind === "band-low", withBand = kind.startsWith("band");
  const sideLunge = kind === "band-lunge";
  type State = [number, number, number, number, number];
  function at([x, a, b, lifted, depth]: State): Point[] {
    const hip: Point = [x, 88 + depth * (lowSteps ? 22 : 34)], shoulder = move(hip, 5, -38);
    const ankles: [Point, Point] = [[a, floor - (lifted === 1 ? 10 : 0)], [b, floor - (lifted === -1 ? 10 : 0)]];
    const near: Point = [(hip[0] + a) / 2 + 5 + depth * (sideLunge ? 7 : 13), (hip[1] + ankles[0][1]) / 2 - 10 * depth];
    const far = center(hip, ankles[1]);
    if (!sideLunge) { far[0] -= depth * 19; far[1] -= depth * 9; }
    const frame = figure(shoulder, hip, reach(shoulder), [[near, ankles[0]], [far, ankles[1]]],
      [move(ankles[0], 8, 1), move(ankles[1], -8, 1)]);
    return [...frame, move(near, -3, -8), move(far, 3, -8)];
  }

  const ready: State = [150, 158, 142, 0, 0];
  const opening: State = [155, 176, 142, 1, 0], wide: State = [158, 195, 142, 0, 0];
  const squatState: State = [sideLunge ? 173 : 158, 195, 142, 0, 1];
  const states: State[] = lowSteps ? [[150, 158, 142, 0, 1], [155, 177, 142, 1, 1], [162, 192, 142, 0, 1],
      [171, 192, 162, -1, 1], [178, 192, 168, 0, 1], [169, 192, 155, -1, 1], [161, 192, 142, 0, 1], [155, 177, 142, 1, 1]]
    : kind === "up-step" ? [ready, [150, 158, 142, 0, 1], [155, 176, 142, 1, .45], wide, opening]
      : [ready, opening, wide, squatState, wide, opening];
  const forward = states.map(at);
  const other = forward.map((frame) => frame.map(([x, y]): Point => [300 - x, y]));
  return show([...forward, ...other], [], withBand ? [["knee-band", 13, 14]] : [], lowSteps ? 480 : 640);
}

function quadPress(cable: boolean): Illustration {
  const anchor: Point = [235, 149];

  function at(press: number): Point[] {
    if (cable) {
      const knee: Point = [187 - 44 * press, 147 - 46 * press], heel: Point = [221 - 53 * press, 151 - 31 * press];
      const pose = figure([89, 146], [135, 146], [[[112, 154], [137, 154]], [[105, 149], [124, 152]]],
        [[knee, heel], [move(knee, -7, 2), move(heel, -6, 4)]]);
      pose[0] = [73, 145];
      return pose;
    }
    const knee: Point = [139 - 27 * press, 150 - 24 * press], heel: Point = [112 - 26 * press, 152 - 45 * press];
    const pose = figure([172, 114], [132, 116], [[[172, 137], [175, 155]], [[163, 136], [168, 155]]],
      [[knee, heel], [[136, 150], [110, 153]]], [move(heel, -7, 3), [102, 154]]);
    pose[0] = [187, 110];
    return pose;
  }

  return show([at(0), at(.5), at(1), at(1), at(.5)], cable ? rig : [],
    cable ? [["cable", 8, ...anchor], ["cable", 10, ...anchor], ["pad", 8, 0, -4], ["pad", 10, 0, -4]] : [], 830);
}

function floorKneel(kind: "stand" | "side"): Illustration {
  function at(state: number): Point[] {
    const left: Limb = [[126, 151], [97, 155]];
    const right: Limb = [[145, 150], [116, 155]];
    const hip: Point = [137 + (kind === "side" ? state * 13 : 8 * Math.min(state, 2)), kind === "side" ? 116 + 10 * state
      : state === 3 ? 87 : state === 4 ? 119 : 109];
    const shoulder: Point = move(hip, kind === "side" ? 8 : 6, -39);
    const near: Limb = kind === "side" ? [[174 + 20 * state, 124 + 15 * state], [186 + 26 * state, 155]] :
      state === 0 ? right : [[176, state === 3 ? 122 : 115], [182, 155]];
    const far: Limb = kind === "side" || state < 2 ? left : [[148, state === 3 ? 124 : 119], [149, 155]];
    return figure(shoulder, hip, reach(shoulder), [near, far],
      [move(near[1], state === 0 && kind === "stand" ? -8 : 8, 1), move(far[1], state < 2 || kind === "side" ? -8 : 8, 1)]);
  }
  const frames = kind === "side" ? [at(0), at(.5), at(1), at(1)] : [0, 1, 2, 3, 4, 2, 1, 0,
    1, 2, 3, 4, 2, 1].map((phase, index) => {
      const pose = at(phase);
      if (index < 8) return pose;
      [pose[7], pose[8], pose[9], pose[10], pose[11], pose[12]] = [pose[9], pose[10], pose[7], pose[8], pose[12], pose[11]];
      return pose;
    });
  return show(frames, [], [], 820);
}

function withImplement(base: Illustration, kind: "wall-db" | "walk-db"): Illustration {
  const overhead = kind === "walk-db";
  const frames = base.frames.map((item): Point[] => {
    const frame = item.slice();
    const shoulder = frame[1];
    const reversed = overhead && shoulder[0] > frame[0][0];
    const hands: Pair = overhead
      ? [[move(shoulder, reversed ? -12 : 12, -18), move(shoulder, reversed ? -14 : 14, -35)],
        [move(shoulder, reversed ? 13 : -13, -16), move(shoulder, reversed ? 13 : -13, -33)]]
      : [[move(shoulder, 13, 21), move(shoulder, 13, 42)], [move(shoulder, 5, 21), move(shoulder, 7, 41)]];
    [frame[3], frame[4], frame[5], frame[6]] = [...hands[0], ...hands[1]];
    return frame;
  });
  return { ...base, frames, dynamic: [...base.dynamic ?? [], ...dumbbells] };
}

const basicBand = squat("band"), deepBand = squat("band-full");
const fixedBand = lunge("band-split"), bandRow = squat("band-row"), highRow = lunge("band-high-row");

export const lowerBodyResistanceIllustrations: Record<string, Illustration> = {
  "3772": highRow, "3788": highRow,
  "0909": lunge("band-forward"),
  "4135": lunge("band"),
  "4679": fixedBand, "4689": fixedBand,
  "4683": basicBand, "4398": basicBand, "2153": deepBand,
  "3770": bandRow, "3786": bandRow,
  "1509": squat("bench-chains"), "10092": squat("barbell"), "3184": squat("hanging"),
  "1541": squat("upright-row"), "4064": squat("chains"), "6056": squat("bottle"),
  "8876": quadPress(true), "10055": lunge("narrow-db"), "0882": squat("pistol"), "3767": squat("pistol"),
  "4865": withImplement(checkedLunges["1460"], "walk-db"), "3707": squat("thruster"), "5529": squat("deep-thruster"),
  "4161": lunge("raise"), "10096": lunge("press"), "4758": lunge("row"),
  "8987": floorKneel("side"), "6006": squat("reach"), "3092": squat("high-knee"), "6747": quadPress(false),
  "8533": floorKneel("stand"), "3392": squat("wedge"),
  "7206": lateral("band-step"), "7203": lateral("band-low"), "7202": lateral("band-lunge"),
  "4186": squat("band-overhead"), "8608": squat("band-sumo"),
  "4219": squat("ssb-heel"), "4218": squat("ssb-front"),
  "4909": lateral("wide"), "5096": squat("single-overhead"), "1593": squat("chair"), "6606": lunge("smith"),
  "3927": squat("toe"), "10410": squat("mace"), "8374": lateral("up-step"), "4417": squat("touch"),
  "1696": lunge("diagonal-db"), "2527": lunge("vibration"), "3643": checkedSquats["4732"],
  "1603": withImplement({
    ...checkedSquats["1695"],
    frames: checkedSquats["1695"].frames.map((frame): Point[] => [...frame.slice(0, 9),
      [frame[7][0] - 13, frame[7][1]], [frame[8][0] - 13, frame[8][1]], frame[11], [frame[11][0] - 13, frame[11][1]]]),
  }, "wall-db"),
  "7411": squat("wedge-load"), "3644": lunge("swing"),
};