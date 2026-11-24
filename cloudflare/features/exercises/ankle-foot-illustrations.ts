
import type { Illustration, Point } from "./motion-data";
import { lowerBodyEquipmentIllustrations } from "./lower-body-equipment-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Fittings = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

const floor = 157;
const offset = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const mean = ([a, b]: Point, [c, d]: Point): Point => [(a + c) / 2, (b + d) / 2];

function figure(shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb,
  nearLeg: Limb, farLeg: Limb, nearToes: Point, farToes: Point): Point[] {
  return [offset(shoulder, 5, -14), shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, nearToes, farToes];
}

function demo(frames: Point[][], props: Props = [], extra: Fittings = [], ms = 1000): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...extra], ms, reference: true };
}

function hold(initial: Point[], end: Point[], count = 3): Point[][] {
  return [initial, ...Array<Point[]>(count).fill(end)];
}

const chair = (x: number, y: number): Props => [
  [x - 14, y, x + 25, y], [x - 10, y, x - 10, 158], [x + 20, y, x + 20, 158], [x - 12, y - 32, x - 12, y],
];
const wall: Props = [[227, 20, 227, 158], [224, 155, 232, 155]];

type ChairAnkle = "dorsi" | "kettlebell" | "plate" | "point" | "dorsi-point" | "both-circles" | "slide";
function chairAnkle(kind: ChairAnkle) {
  const brace = kind !== "both-circles";
  const props = chair(104, 109);
  const nearKnee: Point = kind === "dorsi" || kind === "point" || kind === "dorsi-point" ? [146, 121] : [144, 111];
  const farKnee: Point = [135, 113];
  const defaultFarFoot: Point = [brace ? 146 : 122, brace ? floor - 2 : 143];
  const shoulder: Point = [106, 64], hip: Point = [111, 105];
  const arms: [Limb, Limb] = [[[117, 88], [136, 105]], [[104, 88], [129, 106]]];
  const orbit: Point[] = [[10, 8], [16, 3], [13, -12], [8, -13], [6, 2]];

  function at(phase: number): Point[] {
    const point = kind === "point" || kind === "dorsi-point";
    let ankle: Point = [point || kind === "dorsi" ? 183 : 151, point || !brace ? 141 : floor - 3];
    let toes: Point = offset(ankle, 14, 0);
    let farToes: Point = offset(defaultFarFoot, 12, 0);
    if (kind === "slide") {
      ankle = offset(ankle, phase === 1 ? 30 : 0, phase === 2 ? -7 : 0);
      toes = offset(ankle, 14, phase === 2 ? 7 : 0);
    } else if (kind === "both-circles") {
      const [dx, dy] = orbit[phase];
      toes = offset(ankle, dx, dy);
      farToes = offset(defaultFarFoot, dx, dy);

    } else if (kind === "point" || kind === "dorsi-point") {
      toes = phase < 0 ? offset(ankle, 16, 10) : phase > 0 ? offset(ankle, 9, -16) : toes;
    } else if (phase > 0) {
      toes = offset(ankle, 9, -15);
    }
    return figure(shoulder, hip, ...arms, [nearKnee, ankle], [farKnee, defaultFarFoot], toes, farToes);
  }

  const fittings: Fittings = kind === "kettlebell" ? [["kettlebell", 11, 2, -6]]
    : kind === "plate" ? [["plate", 11, 1, -5]] : [];
  const frames = kind === "both-circles" ? [0, 1, 2, 3, 4, 0, 4, 3, 2, 1].map(at)
    : kind === "slide" ? [at(0), at(1), at(0), at(2)]
        : kind === "point" ? hold(at(0), at(-1))
          : kind === "dorsi-point" ? [at(-1), at(-1), at(-1), at(1), at(1), at(1)]
            : [at(0), at(1), at(1)];
  return demo(frames, props, fittings, kind === "both-circles" ? 550 : 1030);
}

function opposition(kind: "supine" | "seated-low" | "seated-high" | "seated-press") {
  const supine = kind === "supine";
  const high = kind === "seated-high";
  const shoulder: Point = supine ? [78, 147] : [112, 63];
  const hip: Point = supine ? [122, 148] : [116, 106];
  const activeHeel: Point = supine ? [190, 154] : high ? [164, 147] : [153, 154];
  const activeKnee: Point = supine ? [151, 111] : [157, 110];
  const otherKnee: Point = supine ? [145, 114] : [142, 112];
  const arms: [Limb, Limb] = supine ? [[[99, 153], [133, 153]], [[91, 154], [123, 155]]]
    : [[[125, 82], [141, 106]], [[112, 86], [128, 107]]];

  function at(raised: boolean): Point[] {
    const activeToe = offset(activeHeel, raised ? 9 : 16, raised ? -12 : 0);
    const contact = offset(activeToe, -2, high ? 4 : -4);
    const counterHeel: Point = high ? [154, 154] : offset(contact, -14, -7);
    const frame = figure(shoulder, hip, ...arms, [activeKnee, activeHeel], [otherKnee, counterHeel], activeToe, contact);
    if (supine) frame[0] = [63, 145];
    return frame;
  }
  return demo(hold(at(false), at(true), 2), supine ? [] : chair(107, 110));
}

type BandAction = "eversion" | "inversion" | "rotation" | "dorsi";
function footResistance(kind: BandAction, source: "cable" | "band") {
  const dorsiflex = kind === "dorsi";
  const outward = kind !== "inversion";
  const base: Point = dorsiflex ? [253, 156] : [outward ? 88 : 237, 146];
  const machine: Props = source === "cable"
    ? [[base[0], 51, base[0], 158], [base[0] + 8, 54, base[0] + 8, 157], [base[0] - 12, 158, base[0] + 18, 158],
      [base[0] - 5, base[1] - 4, base[0] + 5, base[1] - 4], [base[0] - 5, base[1] + 4, base[0] + 5, base[1] + 4]]
    : [[base[0], 108, base[0], 158], [base[0] - 10, 158, base[0] + 12, 158]];

  function at(tension: boolean): Point[] {
    if (dorsiflex) {
      const heel: Point = [184, 155], toes = tension ? offset(heel, 8, -15) : offset(heel, 15, 0);
      const frame = figure([92, 114], [107, 151], [[72, 137], [66, 154]], [[88, 139], [81, 155]],
        [[137, 148], heel], [[134, 154], [165, 155]], toes, [177, 155]);
      return [...frame, mean(toes, heel)];
    }
    const heel: Point = [177, 147];
    const toes: Point = !tension ? [179, 158] : kind === "rotation" ? [192, 156] : outward ? [187, 153] : [165, 154];
    const frame = figure([149, 96], [152, 131], [[169, 119], [178, 141]], [[133, 116], [128, 139]],
      [[164, 139], heel], [[141, 135], [128, 146]], toes, [125, 156]);
    return [...frame, mean(toes, heel), tension ? [toes[0] + (outward ? 2 : -1), toes[1] - 2] : offset(toes, -4, -1)];
  }
  const detail: Fittings = dorsiflex ? [] : [["foot-tip", 13, 14]];
  return demo([at(false), at(true), at(true)], machine, [[source, 13, ...base], ...detail]);
}

function seatedFootRoll() {
  const heel: Point = [173, 145];
  function at(roll: number) {
    const toes: Point = [177 + roll * 8, 155 - Math.abs(roll) * 3];
    return figure([147, 61], [151, 108], [[167, 85], [165, 105]], [[128, 84], [130, 106]],
      [[165, 125], heel], [[136, 123], [132, 154]], toes, [130, 157]);
  }
  return demo([at(0), at(-1), at(0), at(1)], chair(143, 112));
}

function seatedFootStretch(kind: "point" | "everter" | "inverter" | "pull" | "circle" | "side") {
  const handsOnFoot = kind !== "side" && kind !== "circle";
  const foldKnee = kind !== "pull" && handsOnFoot;
  const nearKnee: Point = foldKnee ? [148, 134] : [148, 148];
  const ankle: Point = [184, kind === "circle" ? 143 : 151];
  const farKnee: Point = handsOnFoot ? [128, 119] : [144, 155];
  const farAnkle: Point = handsOnFoot ? [149, 154] : [176, 155];

  function at(step: number): Point[] {
    const shoulder: Point = handsOnFoot ? [139, 103] : [117, 110];
    const hip: Point = [123, 150];
    const toes = kind === "circle" ? offset(ankle, [14, 15, 9, 6, 14][step], [0, 8, 0, -12, -7][step])
      : kind === "side" ? offset(ankle, 12 + Math.abs(step) * 5, -3 + step * 8)
        : kind === "pull" ? offset(ankle, 14 - step * 8, -step * 15)
          : offset(ankle, 13 + step * 5, step * (kind === "everter" ? 6 : kind === "inverter" ? -6 : 3));
    const farToes = kind === "side" ? offset(farAnkle, 12 - step * 7, -2 - step * 5) : offset(farAnkle, 11, 0);
    const arms: [Limb, Limb] = handsOnFoot ? [[[158, 123], toes], [[150, 128], offset(toes, -4, -2)]]
      : kind === "circle" ? [[[143, 124], [159, 141]], [[126, 135], [137, 146]]]
        : [[[97, 138], [83, 155]], [[108, 142], [99, 155]]];
    return figure(shoulder, hip, ...arms, [nearKnee, ankle], [farKnee, farAnkle], toes, farToes);
  }
  const frames = kind === "circle" ? [0, 1, 2, 3, 4, 0, 4, 3, 2, 1].map(at)
    : kind === "side" ? [at(0), at(-1), at(0), at(1)] : hold(at(0), at(1));
  return demo(frames, [], [], kind === "circle" ? 520 : 1040);
}

function wallCalf(kind: "mobility" | "kneeling" | "bent" | "straight" | "toe-up" | "tibialis" | "toe-back" | "toe-wall") {
  const kneeling = kind === "kneeling";
  const toeUp = kind === "toe-up" || kind === "toe-wall";
  const toeBack = kind === "tibialis" || kind === "toe-back";
  const mobilize = kind === "mobility" || kneeling;
  const props: Props = kneeling ? [[98, 158, 169, 158]] : wall;

  function at(move: number): Point[] {
    const frontHeel: Point = kneeling ? [168, 154] : [toeUp ? 207 : 193, 154];
    const rearHeel: Point = kneeling ? [106, 152] : toeBack ? [138, 141] : [129, 154];
    const hip: Point = kneeling ? [142 + 15 * move, 119] : [154 + (toeBack ? 9 : 18) * move, 92 + (kind === "bent" ? 4 * move : 0)];
    const shoulder: Point = kneeling ? [146 + 19 * move, 79] : [165 + 21 * move, 51 + (kind === "bent" ? 5 * move : 0)];
    const nearKnee: Point = [182 + (mobilize ? 19 : toeBack ? 10 : 12) * move, kneeling ? 121 : 119];
    const farKnee: Point = kneeling ? [137 + 5 * move, 151] : kind === "bent" ? [143 + 15 * move, 122] : mean(hip, rearHeel);
    const arms: [Limb, Limb] = kneeling ? [[[162, 104], nearKnee], [[147, 103], offset(nearKnee, -6, -3)]]
      : mobilize ? [[[186, 65], [225, 55]], [[178, 63], [225, 62]]]
        : [[[198 + 7 * move, 71], [225, 65]], [[193 + 7 * move, 74], [225, 72]]];
    const toe: Point = toeUp ? [226, kind === "toe-wall" ? 139 : 143] : offset(frontHeel, 14, -1);
    const backToe: Point = toeBack ? [138 - 5 * move, 155] : offset(rearHeel, kneeling ? -7 : 12, kneeling ? 3 : -1);
    const figureFrame = figure(shoulder, hip, ...arms, [nearKnee, frontHeel], [farKnee, rearHeel], toe, backToe);
    if (kind === "toe-wall") return [...figureFrame, [221, 153]];
    if (kind === "toe-back") return [...figureFrame, [139, 150]];
    return figureFrame;
  }
  const details: Fittings = kind === "toe-wall" ? [["foot-tip", 13, 11]] : kind === "toe-back" ? [["foot-tip", 13, 12]] : [];
  return demo(mobilize ? [at(0), at(1), at(.4), at(1)] : hold(at(0), at(1)), props, details, 920);
}

function stepHeel(single: boolean) {
  const props: Props = [[169, 140, 222, 140], [169, 140, 169, 158], [222, 140, 222, 158],
    [228, 64, 228, 157], [210, 64, 239, 64], [215, 157, 239, 157]];
  const toe: Point = [170, 137];

  function at(amount: number): Point[] {
    const shoulder: Point = [154, 36 + amount * 12], hip: Point = [155, 76 + amount * 12];
    const nearHeel: Point = [156 - amount * 3, 131 + amount * 17];
    const farHeel: Point = single ? [144, 120 + amount * 9] : offset(nearHeel, -4, 1);
    const arms: [Limb, Limb] = [[[180, 61], [225, 64]], [[168, 62], [215, 63]]];
    return figure(shoulder, hip, ...arms, [[155, 108 + amount * 10], nearHeel],
      [single ? [151, 109 + amount * 8] : [149, 109 + amount * 10], farHeel], toe,
      single ? offset(farHeel, 10, 3) : [172, 137]);
  }
  return demo(single ? hold(at(.4), at(1)) : [at(0), at(1), at(1), at(.5)], props, [], 1000);
}

function standingCircle(hipMotion: boolean) {
  const props: Props = hipMotion ? [] : [[223, 60, 223, 157], [212, 60, 236, 60], [213, 157, 235, 157]];
  const toePath: Point[] = [[13, 0], [15, 10], [5, 13], [-5, 6], [1, -10], [9, -7]];
  const hipPath: Point[] = [[0, 0], [9, 1], [12, -8], [5, -14], [-4, -8], [-7, 0]];
  function at(phase: number): Point[] {
    const workAnkle: Point = hipMotion ? offset([176, 138], ...hipPath[phase]) : [170, 136];
    const workKnee: Point = hipMotion ? mean([155, 89], workAnkle) : [164, 120];
    const shoulder: Point = [153, 49], hip: Point = [151, 91];
    const arms: [Limb, Limb] = hipMotion ? [[[168, 69], [160, 92]], [[137, 69], [145, 92]]]
      : [[[184, 57], [221, 62]], [[147, 70], [149, 93]]];
    return figure(shoulder, hip, ...arms, [workKnee, workAnkle], [[148, 122], [145, 154]],
      offset(workAnkle, ...toePath[phase]), [155, 155]);
  }
  return demo([0, 1, 2, 3, 4, 5, 0, 5, 4, 3, 2, 1].map(at), props, [], 530);
}

type ToeStretch = "down" | "up";
type Roll = "out" | "in" | "flat";
function crossedToeStretch(tug: ToeStretch, roll: Roll) {
  const baseToe: Point = [191, 114], heel: Point = [171, 109], farFoot: Point = [149, 154];
  function at(stretch: boolean): Point[] {
    const s = stretch ? 1 : 0;
    const ball: Point = [184 + (roll === "out" ? 4 : roll === "in" ? -3 : 0) * s, 112 + (roll === "out" ? 3 : roll === "in" ? -4 : 0) * s];
    const toes = offset(baseToe, (tug === "up" ? -2 : -3) * s, (tug === "up" ? -12 : 11) * s);
    const frame = figure([125, 65], [112, 107], [[144, 82], toes], [[136, 86], ball],
      [[147, 112], heel], [[151, 113], farFoot], ball, [160, 155]);
    return [...frame, toes];
  }
  return demo(hold(at(false), at(true)), chair(107, 112), [["foot-tip", 11, 13]]);
}

function groundToeExercise(standing: boolean) {
  const foot: Point = standing ? [167, 154] : [151, 154];
  const farFoot: Point = standing ? [138, 155] : [125, 154];
  const nearBall = offset(foot, 11, 0), farBall = offset(farFoot, 11, 0);
  function at(spread: boolean, lifted = 0): Point[] {
    const shoulder: Point = standing ? [149, 49] : [110, 63];
    const hip: Point = standing ? [149, 91] : [113, 107];
    const arms: [Limb, Limb] = standing ? [[[170, 72], [166, 106]], [[129, 71], [135, 106]]]
      : [[[129, 85], [147, 107]], [[118, 85], [138, 105]]];
    const body = figure(shoulder, hip, ...arms, [[156, 123], foot], [[137, 122], farFoot], nearBall, farBall);
    const ends = [nearBall, farBall].flatMap(([x, y]): Point[] => [
      [x + 4, y - 2], [x + (spread ? 10 : 5), y - (lifted > 1 ? 7 : 1) - (spread ? 3 : -1)],
      [x + 4, y], [x + (spread ? 10 : 5), y - (lifted > 0 ? 6 : 0)],
      [x + 3, y + 1], [x + (spread ? 8 : 5), y + (lifted > 2 ? -5 : spread ? 4 : 2)],
    ]);
    return [...body, ...ends];
  }
  const toes: Fittings = [["foot-tip", 13, 14], ["foot-tip", 15, 16], ["foot-tip", 17, 18],
    ["foot-tip", 19, 20], ["foot-tip", 21, 22], ["foot-tip", 23, 24]];
  return demo(standing ? [at(true), at(true, 3), at(true, 2), at(true, 1), at(true)]
    : [at(true), at(false), at(false), at(true)], standing ? [] : chair(107, 110), toes, 760);
}

const bandEversion = footResistance("eversion", "band");
const bandInversion = footResistance("inversion", "band");
const bandDorsi = footResistance("dorsi", "band");
const toeWall = wallCalf("toe-wall");

export const ankleFootIllustrations: Record<string, Illustration> = {
  "2761": chairAnkle("dorsi"),
  "4283": seatedFootStretch("circle"),
  "3245": seatedFootStretch("side"),
  "4282": chairAnkle("dorsi-point"),
  "10367": chairAnkle("kettlebell"),
  "10540": opposition("supine"),
  "1969": wallCalf("mobility"),
  "1920": seatedFootStretch("point"),
  "1926": seatedFootStretch("everter"),
  "1927": seatedFootStretch("inverter"),
  "10003": bandDorsi,
  "10366": bandDorsi,
  "2936": wallCalf("kneeling"),
  "2998": chairAnkle("point"),
  "10535": opposition("seated-low"),
  "10917": opposition("seated-high"),
  "6759": opposition("seated-press"),
  "11289": standingCircle(true),
  "8188": standingCircle(false),
  "6773": wallCalf("tibialis"),
  "6559": chairAnkle("plate"),
  "6745": footResistance("eversion", "cable"),
  "6746": footResistance("inversion", "cable"),
  "1890": lowerBodyEquipmentIllustrations["1930"],
  "3872": stepHeel(false),
  "2104": wallCalf("bent"),
  "3127": bandEversion,
  "3125": footResistance("rotation", "band"),
  "3128": bandInversion,
  "8611": bandEversion,
  "8612": bandInversion,
  "10909": chairAnkle("both-circles"),
  "5481": chairAnkle("slide"),
  "10564": seatedFootRoll(),
  "10911": groundToeExercise(false),
  "1963": crossedToeStretch("down", "out"),
  "1964": crossedToeStretch("down", "in"),
  "1962": crossedToeStretch("down", "flat"),
  "1966": crossedToeStretch("up", "out"),
  "1967": crossedToeStretch("up", "in"),
  "1965": crossedToeStretch("up", "flat"),
  "1886": stepHeel(true),
  "1889": seatedFootStretch("pull"),
  "6775": groundToeExercise(true),
  "1887": wallCalf("straight"),
  "1958": wallCalf("toe-back"),
  "1968": toeWall,
  "1885": wallCalf("toe-up"),
};