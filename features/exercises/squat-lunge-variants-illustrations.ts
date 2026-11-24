
import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Fittings = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

const ground = 155;
const move = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const between = ([ax, ay]: Point, [bx, by]: Point): Point => [(ax + bx) / 2, (ay + by) / 2];
const foot = (p: Point, side = 1) => move(p, side * 8, 1);

function person(shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb,
  toes: [Point, Point] = [foot(nearLeg[1]), foot(farLeg[1])]): Point[] {
  return [move(shoulder, 4, -14), shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, ...toes];
}

function demo(frames: Point[][], props: Props = [], fittings: Fittings = [], ms = 950): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...fittings], ms, reference: true };
}

const platform = (left: number, right: number, height: number): Props =>
  [[left, height, right, height], [left + 3, height, left + 3, 158], [right - 3, height, right - 3, 158]];
const support = (x: number): Props => [[x, 48, x, 158], [x - 11, 70, x + 12, 70], [x - 12, 158, x + 12, 158]];
const pulley: Props = [[234, 27, 234, 158], [244, 28, 244, 157], [233, 28, 244, 28],
  [226, 158, 256, 158], [231, 147, 243, 147], [237, 123, 241, 123]];
const dumbbells: Fittings = [["dumbbell", 4, 0, 2], ["dumbbell", 6, 0, 2]];

function dome(x: number): Props {
  const arc: Point[] = [[x - 34, 154], [x - 27, 143], [x - 18, 133], [x - 10, 127],
    [x, 125], [x + 10, 127], [x + 18, 133], [x + 27, 143], [x + 34, 154]];
  return [...arc.slice(0, -1).map(([x0, y0], index): [number, number, number, number] => [x0, y0, ...arc[index + 1]]),
    [x - 36, 157, x + 36, 157], [x - 34, 154, x - 34, 157], [x + 34, 154, x + 34, 157]];
}

type Wall = "parallel" | "half-slide" | "half-hold" | "quarter" | "ball-single";
function wallSlide(kind: Wall) {
  const ball = kind === "ball-single";
  const xwall = 91;
  const props: Props = [[xwall, 23, xwall, 159], [80, 159, 105, 159]];
  const depth = kind === "quarter" ? 103 : kind.startsWith("half") ? 113 : ball ? 124 : 126;

  function at(low: boolean): Point[] {
    const x = ball ? 131 : 100, y = low ? depth : 87;
    const hip: Point = [x, y], shoulder: Point = [x - (ball ? 2 : 0), y - 38];
    const first: Point = [166, ground], other: Point = ball ? [183, low ? 135 : 140] : [153, ground - 1];
    const shallow = kind === "quarter", half = kind.startsWith("half");
    const nearKnee: Point = !low ? [137, 124] : shallow ? [146, 127] : half ? [153, 128] : [165, 129];
    const farKnee: Point = ball ? [159, low ? 117 : 126] : !low ? [130, 123]
      : shallow ? [136, 124] : half ? [142, 126] : [151, 130];
    const nearArm: Limb = [[x + 24, y - 19], [x + 46, y - 16]];
    const farArm: Limb = [[x + 18, y - 13], [x + 39, y - 12]];
    return person(shoulder, hip, nearArm, farArm, [nearKnee, first], [farKnee, other]);
  }

  const high = at(false), low = at(true);
  const frames = kind === "half-hold" || kind === "quarter" ? [high, low, low, low, low] : [high, low];
  return demo(frames, props, ball ? [["stability-ball", 2, -22, -9]] : [], 1010);
}

type LoadedSquat = "bosu" | "grip-sumo" | "bench-sumo" | "hack" | "post" | "v-cable" | "rope-cable" | "belt";
function loadedSquat(kind: LoadedSquat) {
  const balanced = kind === "bosu";
  const wide = kind === "grip-sumo" || kind === "bench-sumo" || kind === "belt";
  const belt = kind === "belt";
  const cables = kind === "v-cable" || kind === "rope-cable";
  const post = kind === "post";
  const hack = kind === "hack";
  const stanceY = balanced ? 125 : kind === "bench-sumo" ? 123 : hack ? 149 : ground;
  const props = balanced ? dome(151) : kind === "bench-sumo" ? [...platform(83, 129, 126), ...platform(178, 227, 126)]
    : cables ? pulley : post ? support(214)
      : hack ? [[138, 152, 160, 157], [138, 152, 138, 157], [153, 153, 179, 157], [153, 153, 153, 157]] as Props
        : belt ? [[231, 117, 231, 158], [221, 118, 244, 118], [215, 158, 245, 158], [131, 158, 174, 158]] as Props : [];
  const nearFoot: Point = [wide ? 193 : balanced ? 162 : 160, stanceY];
  const farFoot: Point = [wide ? 110 : balanced ? 140 : 145, stanceY];
  const fittings: Fittings = kind === "grip-sumo" || kind === "bench-sumo" ? [["hammer-weight", 13, 0, 3]]
    : hack ? dumbbells : post ? [["dumbbell", 6, 0, 2]]
      : kind === "v-cable" ? [["cable", 13, 235, 148], ["bar", 4, 13], ["bar", 6, 13]]
        : kind === "rope-cable" ? [["cable", 13, 235, 148], ["line", 4, 13], ["line", 6, 13], ["ring", 4, 0, 0], ["ring", 6, 0, 0]]
          : belt ? [["pad", 2, 0, 1], ["cable", 2, 147, 157], ["bar", 13, 231, 120], ["barbell-end", 13, 0, 0]] : [];

  function at(depth: number): Point[] {
    const x = wide || balanced ? 151 : 150 - depth * (hack || cables ? 5 : 15);
    const baseHeight = balanced || kind === "bench-sumo" ? 61 : 68;
    const y = stanceY - baseHeight + depth * (kind === "bench-sumo" ? 39 : 35);
    const hip: Point = [x, y];
    const shoulder: Point = [x + depth * (wide || hack || cables ? 4 : 12), y - 37];
    const nearKnee: Point = [(hip[0] + nearFoot[0]) / 2 + (wide ? 10 : 5) + depth * (wide ? 13 : 24),
      (hip[1] + stanceY) / 2 - depth * 12];
    const farKnee: Point = [(hip[0] + farFoot[0]) / 2 + (wide ? -10 - depth * 13 : 4 + depth * 20),
      (hip[1] + stanceY) / 2 - depth * 10];

    const height = shoulder[1];
    let arms: [Limb, Limb] = [[[shoulder[0] + 24, height + 10], [shoulder[0] + 45, height + 3]],
      [[shoulder[0] + 16, height + 12], [shoulder[0] + 40, height + 5]]];
    let connector: Point = [shoulder[0] + 17, height + 20];
    if (wide && !belt) {
      arms = [[[x + 12, height + 18], [x + 3, height + 40]], [[x - 13, height + 20], [x - 3, height + 40]]];
      connector = [x, height + 42];
    }
    if (cables) {
      arms = [[[shoulder[0] + 25, height + 10], [shoulder[0] + 18, height + 10]],
        [[shoulder[0] + 14, height + 18], [shoulder[0] + 13, height + 12]]];
      connector = [shoulder[0] + 23, height + 15];
    }
    if (post) arms = [[[177, height + 9], [213, 69]], [[x - 6, height + 21], [x - 9, height + 43]]];
    if (hack) arms = [[[x - 11, height + 25], [x - 19, height + 44]], [[x - 19, height + 23], [x - 29, height + 43]]];
    if (belt) connector = [157 + depth * 18, 149 - depth * 14];

    const nearToe: Point = wide ? foot(nearFoot) : balanced ? move(nearFoot, 7, 4) : hack ? move(nearFoot, 9, 5) : foot(nearFoot);
    const farToe: Point = wide || balanced ? move(farFoot, -8, balanced ? 3 : 1) : hack ? move(farFoot, 8, 5) : foot(farFoot);
    return [...person(shoulder, hip, ...arms, [nearKnee, nearFoot], [farKnee, farFoot], [nearToe, farToe]), connector];
  }

  return demo([at(0), at(.5), at(1), at(1)], props, fittings, 840);
}

type Split = "bottle" | "rear-bench" | "decline" | "bosu" | "band" | "cable-box" | "narrow" | "cross" | "diagonal";
function splitSquat(kind: Split) {
  const elevated = kind === "rear-bench" || kind === "decline" || kind === "band";
  const cable = kind === "cable-box", bosu = kind === "bosu";
  const diagonal = kind === "diagonal", cross = kind === "cross";
  const front: Point = [167, cable ? 126 : bosu ? 121 : ground];
  const back: Point = elevated ? [106, 123] : cross ? [194, 148] : [106, 149];
  const rearToe: Point = elevated ? [97, 124] : cross ? [183, 155] : [117, 155];
  const props = kind === "decline" ? [[79, 114, 117, 128], [87, 117, 87, 158], [113, 126, 113, 158]] as Props
    : elevated ? platform(76, 116, 127) : cable ? [...pulley, ...platform(136, 186, 130)]
      : bosu ? dome(front[0]) : [];
  const load: Fittings = kind === "bottle" ? [["bottle-upright", 4, 0, 3], ["bottle-upright", 6, 0, 3]]
    : cable ? [["cable", 13, 233, 148], ["bar", 4, 6]] : kind === "band" ? [["band", 13, front[0], front[1] + 2], ["band", 14, front[0] - 7, front[1] + 2]]
      : elevated || bosu ? dumbbells : [];

  function at(depth: number, step = 1): Point[] {
    const frontY = front[1];
    const floatingRear: Point = step ? back : cable ? [146, 126] : [147, ground - 4];
    const rear = step === .5 ? move(back, (147 - back[0]) * .42, -12) : floatingRear;
    const frontLeg: Point = diagonal && step ? [front[0] + 19, frontY] : front;
    const hip: Point = [diagonal && step ? 149 + depth * 9 : 141 + depth * 6, (cable || bosu ? 76 : 88) + depth * 36];
    const shoulder: Point = move(hip, cross ? 1 : 6, -39);
    let arms: [Limb, Limb] = [[[shoulder[0] + 8, shoulder[1] + 22], [shoulder[0] + 11, shoulder[1] + 43]],
      [[shoulder[0] - 9, shoulder[1] + 20], [shoulder[0] - 10, shoulder[1] + 41]]];
    if (cable) arms = [[[179, shoulder[1] + 13], [203, shoulder[1] + 9]], [[174, shoulder[1] + 13], [194, shoulder[1] + 12]]];
    if (kind === "band") arms = [[move(shoulder, 16, 15), move(shoulder, 17, 2)], [move(shoulder, -12, 16), move(shoulder, -11, 2)]];
    if (cross || diagonal || kind === "narrow") arms = [[move(shoulder, 14, 20), move(hip, 5, -4)],
      [move(shoulder, -14, 20), move(hip, -6, -4)]];
    const nearKnee: Point = [frontLeg[0] - (1 - depth) * 10, (hip[1] + frontY) / 2 - depth * 10];
    const farKnee: Point = !step ? between(hip, rear) : [cross ? 155 + depth * 11 : 121 + depth * 4, 117 + depth * 31];
    const toes: [Point, Point] = [bosu ? [frontLeg[0] + 10, 124] : foot(frontLeg), step === 1 ? rearToe : foot(rear)];
    const frame = person(shoulder, hip, ...arms, [nearKnee, frontLeg], [farKnee, rear], toes);
    return [...frame, cable ? between(arms[0][1], arms[1][1]) : arms[0][1], arms[1][1]];
  }
  const moving = cable || diagonal || cross || kind === "narrow";
  if (!moving) return demo([at(0), at(.55), at(1), at(1)], props, load, 920);
  const ready = at(0, 0), release = at(.2, .5), deep = at(1);
  return demo([ready, release, deep, deep, release], props, load, 730);
}

type Side = "cossack" | "flat" | "bench" | "bench-db" | "step";
function sideSquat(kind: Side) {
  const bench = kind === "bench" || kind === "bench-db", step = kind === "step", weighted = !step && kind !== "bench";
  const right: Point = [190, step ? 131 : ground], left: Point = [108, ground];
  const props = bench ? platform(175, 228, 130) : step ? platform(176, 213, 135) : [];
  const load: Fittings = weighted ? [["hammer-weight", 13, 0, 0]] : [];

  function at(side: number, moving = false): Point[] {
    const depth = Math.abs(side);
    const hip: Point = [147 + side * (bench ? 39 : 25), 89 + depth * (bench ? 35 : 33)];
    const shoulder: Point = [hip[0] + 1, hip[1] - 38];
    const near: Point = step && !depth ? [162, ground] : step && moving ? [175, 130] : right;
    const bentRight = side > 0, bentLeft = side < 0;
    const nearKnee: Point = [bentRight ? 185 : (hip[0] + near[0]) / 2 + 5, bentRight ? step ? 106 : 123 : (hip[1] + near[1]) / 2];
    const farKnee: Point = [bentLeft ? 116 : (hip[0] + left[0]) / 2 - 3, bentLeft ? 122 : (hip[1] + left[1]) / 2];
    const arms: [Limb, Limb] = [[move(shoulder, 18, 18), move(shoulder, 5, 11)],
      [move(shoulder, -18, 18), move(shoulder, -5, 11)]];
    const toes: [Point, Point] = [kind === "cossack" && bentLeft ? [192, 141] : foot(near),
      kind === "cossack" && bentRight ? [106, 141] : foot(left, -1)];
    return [...person(shoulder, hip, ...arms, [nearKnee, near], [farKnee, left], toes), move(shoulder, 0, 11)];
  }
  return demo(step ? [at(0), at(.4, true), at(1), at(.4, true), at(0)]
    : bench ? [at(0), at(.55), at(1), at(1), at(.55)] : [at(0), at(1), at(0), at(-1)], props, load, 880);
}

type Single = "sheet" | "bosu" | "shrimp" | "touch";
function oneLeg(kind: Single) {
  const elevated = kind === "bosu", shrimp = kind === "shrimp";
  const fixture = kind === "sheet" ? [[225, 38, 225, 158], [232, 38, 232, 158], [225, 38, 250, 38],
    [250, 38, 250, 158], [225, 158, 250, 158]] as Props : elevated ? dome(151) : [];
  const anchor: Point = [227, 73];
  const load: Fittings = kind === "sheet" ? [["bar", 4, ...anchor], ["bar", 6, ...anchor], ["line", 13, ...anchor]] : [];

  function at(amount: number): Point[] {
    const ankle: Point = [elevated ? 151 : 166, elevated ? 121 : ground];
    const hip: Point = [elevated ? 149 - 18 * amount : 157 - 14 * amount, ankle[1] - (elevated ? 57 : 66) + 36 * amount];
    const shoulder: Point = move(hip, 11 * amount, -38);
    const near: Limb = [[ankle[0] + 4 + 13 * amount, (hip[1] + ankle[1]) / 2 - 9 * amount], ankle];
    const far: Limb = shrimp ? [[139 - amount * 4, 118 + 34 * amount], [121 - amount * 4, 117 + 4 * amount]]
      : kind === "touch" ? [[134 - amount * 9, 117 + 11 * amount], [117 - amount * 6, 138 + 8 * amount]]
        : [[hip[0] + 34, hip[1] + (elevated ? 17 : 8)], [hip[0] + 63, hip[1] + (elevated ? 23 : 12)]];
    let arms: [Limb, Limb] = [[move(shoulder, 18, 6), move(shoulder, 40, 9)], [move(shoulder, -18, 6), move(shoulder, -38, 9)]];
    if (kind === "sheet") arms = [[move(shoulder, 21, 11), [202, 74 + 7 * amount]],
      [move(shoulder, 11, 17), [200, 83 + 5 * amount]]];
    if (shrimp) arms = [[move(shoulder, 21, 13), move(shoulder, 46, 11)], [[134 - 14 * amount, 91 + 17 * amount], far[1]]];
    if (kind === "touch") arms = [[move(shoulder, 16, 24), [ankle[0] - 7, 112 + 41 * amount]],
      [move(shoulder, 12, 12), move(shoulder, 34, 11)]];
    const toes: [Point, Point] = [elevated ? [160, 124] : foot(ankle), foot(far[1], shrimp ? -1 : 1)];
    return [...person(shoulder, hip, ...arms, near, far, toes), between(arms[0][1], arms[1][1])];
  }
  return demo([at(0), at(.45), at(1), at(1), at(.45)], fixture, load, 870);
}

function standingSissy() {
  const nearToe: Point = [163, 156], farToe: Point = [151, 156];
  const heel: Point = [153, 146], farHeel: Point = [141, 147];
  function at(amount: number) {
    const hip: Point = [146 - 13 * amount, 88 + 25 * amount];
    const shoulder: Point = move(hip, -2 - 14 * amount, -36 + 5 * amount);
    const near: Limb = [[154 + 19 * amount, 119 + 14 * amount], heel];
    const far: Limb = [[144 + 16 * amount, 119 + 13 * amount], farHeel];
    return person(shoulder, hip, [[163 - 9 * amount, 70 + 6 * amount], [188, 70]],
      [[154 - 8 * amount, 72 + 4 * amount], [188, 78]], near, far, [nearToe, farToe]);
  }
  return demo([at(0), at(.45), at(1), at(.45)], support(189), [], 950);
}

function kneelingSquat(kind: "sissy" | "band" | "bottle" | "side") {
  const band = kind === "band", bottle = kind === "bottle", side = kind === "side";
  const lean = !side && !bottle;
  const prop: Props = band ? [...support(230), [226, 62, 237, 62]] : [];
  const load: Fittings = band ? [["band", 4, 229, 62], ["band", 6, 229, 62]]
    : bottle ? [["bottle-upright", 13, 0, 0]] : side ? [["kettlebell", 13, 0, 7]] : [];

  function at(amount: number): Point[] {
    const knee: Point = [147, 151], farKnee: Point = [139, 152], heel: Point = [109, 154], farHeel: Point = [100, 154];
    const angle = amount * Math.PI / 4.1;
    const axis = (distance: number): Point => [knee[0] - Math.sin(angle) * distance, knee[1] - Math.cos(angle) * distance];
    const hip: Point = lean ? axis(38) : [141 - amount * 24, (side ? 113 : 107) + amount * 33];
    const shoulder: Point = lean ? axis(73) : move(hip, amount * 14, -36);
    const head = lean ? axis(88) : move(shoulder, 4, -14);
    const grip = move(shoulder, side || bottle ? 13 : 21, 12);
    const near: Limb = side ? [[175 + amount * 6, 123 + amount * 22], [187 + amount * 24, ground]] : [knee, heel];
    const hand: Limb = [move(shoulder, 15, 22), grip];
    const farHand: Limb = [move(shoulder, -2, 20), move(grip, -6, 1)];
    const toes: [Point, Point] = [foot(near[1], side ? 1 : -1), foot(farHeel, -1)];
    const frame = person(shoulder, hip, hand, farHand, near, [farKnee, farHeel], toes);
    frame[0] = head;
    return [...frame, between(grip, farHand[1])];
  }
  return demo([at(0), at(.5), at(1), at(1), at(.5)], prop, load, 960);
}

const cossack = sideSquat("cossack");
export const squatLungeVariantsIllustrations: Record<string, Illustration> = {
  "3747": oneLeg("sheet"),
  "4722": kneelingSquat("sissy"),
  "4723": standingSissy(),
  "10869": oneLeg("bosu"),
  "10868": loadedSquat("bosu"),
  "6051": kneelingSquat("bottle"),
  "6046": splitSquat("bottle"),
  "7578": loadedSquat("v-cable"),
  "2837": splitSquat("cable-box"),
  "11268": loadedSquat("rope-cable"),
  "10051": splitSquat("narrow"),
  "1510": splitSquat("cross"),
  "4552": splitSquat("diagonal"),
  "4030": loadedSquat("grip-sumo"),
  "1550": splitSquat("rear-bench"),
  "4732": cossack,
  "4562": cossack,
  "1551": splitSquat("decline"),
  "7566": loadedSquat("hack"),
  "4752": sideSquat("bench-db"),
  "4754": sideSquat("flat"),
  "3710": splitSquat("bosu"),
  "2431": loadedSquat("bench-sumo"),
  "2804": loadedSquat("post"),
  "5310": sideSquat("step"),
  "8956": wallSlide("parallel"),
  "11286": kneelingSquat("side"),
  "9493": loadedSquat("belt"),
  "7207": splitSquat("band"),
  "9988": kneelingSquat("band"),
  "3366": oneLeg("shrimp"),
  "4786": sideSquat("bench"),
  "3494": oneLeg("touch"),
  "1695": wallSlide("ball-single"),
  "11316": wallSlide("half-slide"),
  "11451": wallSlide("half-hold"),
  "10926": wallSlide("quarter"),
};