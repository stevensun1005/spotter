import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const loop = (frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 830): Illustration => ({
  frames, props, dynamic, ms, reference: true,
});
const edit = (body: Point[], changes: Partial<Record<number, Point>>) => body.map((p, i) => changes[i] ?? p);
const linePoint = ([x, y]: Point, [dx, dy]: Point, amount: number): Point => [x + dx * amount, y + dy * amount];

type LeverShape = "straight" | "tuck" | "advanced";
function frontLever(shape: LeverShape, style: "hold" | "raise" | "negative"): Illustration {
  const y = style === "negative" ? 63 : 21;
  const hand: Point = [162, y];
  const rearHand: Point = [150, y];
  const at = (lean: number, folded: LeverShape = shape): Point[] => {
    const armLean = lean * .44;
    const neck: Point = [162 - 50 * Math.sin(armLean), y + 50 * Math.cos(armLean)];
    const direction: Point = [Math.sin(lean), Math.cos(lean)];
    const cross: Point = [-direction[1], direction[0]];
    const hip = linePoint(neck, direction, 35);
    const head = linePoint(neck, direction, -16);
    const elbows = (wrist: Point, offset: number): Point => [(neck[0] + wrist[0]) / 2 + offset, (neck[1] + wrist[1]) / 2 - offset / 2];
    const knee = folded === "straight" ? linePoint(hip, direction, 24)
      : linePoint(linePoint(hip, direction, folded === "advanced" ? 8 : -12), cross, 24);
    const foot = linePoint(knee, direction, 24);
    return [head, neck, hip, elbows(hand, 0), hand, elbows(rearHand, -3), rearHand, knee, foot,
      [knee[0] - 6, knee[1] - 3], [foot[0] - 8, foot[1] - 4]];
  };
  const start = at(0, "straight"), prep = at(shape === "straight" ? .7 : .38);
  const horizontal = at(Math.PI / 2);
  const high = at(2.58, "straight");
  const frames = style === "negative" ? [high, at(2.35), at(2.13), at(1.90), at(1.65), horizontal, at(1.75, "tuck"), at(2.35, "tuck")]
    : [start, prep, ...Array<Point[]>(style === "raise" ? 2 : 10).fill(horizontal), prep];
  return loop(frames, [[76, y, 238, y], [82, y, 82, 158], [232, y, 232, 158]], [], style === "negative" ? 900 : 800);
}

function hangingCore(action: "deadbug" | "circle" | "elbows" | "l-hold" | "side" | "hip-raise", weighted = false): Illustration {
  const grip: Props = [[78, 21, 241, 21], [82, 21, 82, 158], [235, 21, 235, 158]];
  const base: Point[] = [[151, 47], [151, 65], [153, 102], [164, 44], [176, 21], [138, 44], [126, 21],
    [157, 126], [159, 150], [148, 126], [149, 149]];
  const hover = edit(base, { 7: [180, 101], 8: [181, 126], 9: [173, 103], 10: [172, 126] });
  const front = edit(base, { 7: [180, 106], 8: [209, 105], 9: [176, 109], 10: [206, 108] });
  const cross = edit(hover, { 0: [155, 47], 1: [154, 65], 2: [161, 101], 7: [188, 96], 8: [197, 117],
    9: [182, 99], 10: [191, 121] });
  const opposite = edit(hover, { 0: [147, 47], 1: [148, 65], 2: [144, 101], 7: [125, 92], 8: [129, 118],
    9: [118, 96], 10: [120, 120] });
  const squeeze = edit(base, { 1: [146, 66], 2: [133, 88], 7: [156, 44], 8: [179, 58], 9: [146, 47], 10: [173, 61] });
  const side = (direction: number) => edit(base, { 2: [153 + 10 * direction, 102], 7: [157 + 25 * direction, 127],
    8: [159 + 39 * direction, 147], 9: [148 + 25 * direction, 127], 10: [149 + 39 * direction, 146] });
  const loaded = edit(hover, { 2: [147, 94], 7: [181, 78], 8: [184, 103], 9: [175, 80], 10: [178, 105] });
  const frames: Record<typeof action, Point[][]> = {
    deadbug: [base, hover, edit(hover, { 7: front[7], 8: front[8] }), hover, edit(hover, { 9: front[9], 10: front[10] }), hover],
    circle: [base, cross, squeeze, opposite, base, opposite, squeeze, cross],
    elbows: [base, hover, squeeze, squeeze, hover], "l-hold": [base, ...Array<Point[]>(14).fill(front), base],
    side: [base, side(1), base, side(-1)], "hip-raise": [base, hover, loaded, loaded, hover],
  };
  const attachment: Attachments = weighted ? [["dumbbell", 11, 0, 3]] : [];
  return loop(frames[action].map(p => [...p, [(p[8][0] + p[10][0]) / 2, (p[8][1] + p[10][1]) / 2]]), grip, attachment);
}

function dragonFlag(variant: "full" | "half" | "single", bench = false): Illustration {
  const y = bench ? 122 : 152;
  const neck: Point = [108, y - 5];
  const grip: Props = bench ? [[69, y + 2, 219, y + 2], [75, y + 2, 75, 158], [213, y + 2, 213, 158]]
    : [[64, 27, 64, 158], [50, 157, 78, 157], [64, y - 17, 77, y - 17], [66, 157, 240, 157]];
  const at = (lower: number, side = false, reset = false): Point[] => {
    const direction: Point = [Math.sin(lower), -Math.cos(lower)];
    const out: Point = [Math.cos(lower), Math.sin(lower)];
    const hips = linePoint(neck, direction, 44);
    const straightKnee = linePoint(hips, direction, 31);
    const straightFoot = linePoint(straightKnee, direction, 29);
    const bentKnee = linePoint(linePoint(hips, direction, 14), out, -26);
    const bentFoot = linePoint(linePoint(bentKnee, direction, 20), out, 18);
    const bentNear = variant === "half" || reset || (variant === "single" && !side);
    const bentFar = variant === "half" || reset || (variant === "single" && side);
    return [[89, y - 6], neck, hips, [88, y - 26], [73, bench ? y + 2 : y - 16],
      [81, y - 29], [69, bench ? y + 1 : y - 18],
      bentNear ? bentKnee : straightKnee, bentNear ? bentFoot : straightFoot,
      bentFar ? [bentKnee[0] - 5, bentKnee[1] + 3] : [straightKnee[0] - 4, straightKnee[1] - 3],
      bentFar ? [bentFoot[0] - 4, bentFoot[1] - 2] : [straightFoot[0] - 5, straightFoot[1] - 4]];
  };
  const ramp = (side: boolean) => [at(.12, side), at(.42, side), at(.73, side), at(1.04, side), at(1.39, side),
    at(1.39, side), at(.84, side, true), at(.36, side, true)];
  return loop(variant === "single" ? [...ramp(false), ...ramp(true)] : ramp(false), grip, [], 890);
}

function rollout(gear: "dumbbell" | "ez" | "wheel" | "wall" | "ball" | "rounded-ball" | "ring" | "strap" | "strap-stand", longReach = false,
  chestStart = false): Illustration {
  const stand = gear === "strap-stand";
  const elevated = gear === "ring" || gear.startsWith("strap");
  const ball = gear === "ball" || gear === "rounded-ball";
  const wall = gear === "wall";
  const begin: Point[] = stand ? [[141, 55], [131, 72], [122, 107], [156, 80], [181, 79], [150, 79], [175, 77],
    [114, 131], [102, 156], [108, 129], [93, 156]]
    : [[160, 79], [145, 94], [116, 119], [152, 121], [167, elevated ? 128 : 149], [143, 122], [156, elevated ? 130 : 150],
      [118, 151], [86, 154], [109, 152], [77, 155]];
  const nearX = wall ? 235 : longReach ? 217 : 207;
  const final: Point[] = stand ? [[190, 91], [172, 99], [140, 123], [195, 92], [224, 89], [189, 94], [221, 90],
    [121, 138], [102, 156], [110, 140], [93, 156]]
    : [[183, elevated || ball ? 113 : 132], [166, elevated || ball ? 117 : 136], [132, 139],
      [191, elevated || ball ? 127 : 142], [nearX, elevated ? 133 : 150],
      [186, elevated || ball ? 127 : 141], [nearX - 9, elevated ? 132 : 149],
      begin[7], begin[8], begin[9], begin[10]];
  const isWheel = gear === "wheel" || wall;
  const equipment: Attachments = elevated ? [["line", 4, 235, 19], ["line", 6, 226, 19],
    [gear === "ring" ? "ring" : "pad", 4, 0, 0], [gear === "ring" ? "ring" : "pad", 6, 0, 0]]
    : ball ? [["stability-ball", 11, 0, 0]]
      : isWheel ? [["ring", 11, 0, 0], ["line", 4, 6]]
        : gear === "ez" ? [["ez-bar", 4, 6], ["plate", 4, 12, 3], ["plate", 6, -9, 3]]
          : [["dumbbell", 4, 0, 3], ["dumbbell", 6, 0, 3]];
  const props: Props = elevated ? [[67, 19, 250, 19], [245, 19, 245, 158]]
    : wall ? [[239, 65, 239, 160], [244, 68, 244, 158]] : [];
  const at = (pose: Point[]): Point[] => {
    const edited = ball ? edit(pose, { 3: [pose[4][0] - 14, 124], 4: [pose[4][0] + 9, 125],
      5: [pose[6][0] - 15, 125], 6: [pose[6][0] + 7, 125] }) : pose;
    const [wx, wy] = edited[4];
    const [nx, ny] = edited[1], [hx, hy] = edited[2];
    return [...edited, [ball ? wx - 10 : wx, ball ? 142 : wy + 3],
      [(nx + hx) / 2, (ny + hy) / 2 - (gear === "rounded-ball" ? 9 : 0)]];
  };
  const start = chestStart ? edit(begin, { 3: [151, 119], 4: [159, 101], 5: [143, 119], 6: [154, 102] }) : begin;
  return { ...loop([at(start), at(final), at(final), at(start)], props, equipment), spine: [12] };
}

function unstablePlank(style: "saw" | "ball-saw" | "pendulum" | "side" | "up" | "climber" | "pike" | "reverse-ring"): Illustration {
  const elbowRest = style === "saw" || style === "ball-saw";
  const onBall = style === "ball-saw";
  const base: Point[] = elbowRest
    ? [[195, 109], [179, 119], [134, 132], [181, onBall ? 121 : 150], [205, onBall ? 121 : 154],
      [173, onBall ? 120 : 150], [196, onBall ? 120 : 152], [95, 141], [65, onBall ? 155 : 151], [89, 143], [60, onBall ? 154 : 150]]
    : [[202, 102], [185, 111], [144, 126], [188, 131], [189, 155], [181, 133], [180, 154],
      [107, 139], [73, 145], [102, 141], [67, 145]];
  const tuck = edit(base, { 2: [145, 102], 7: [167, 128], 8: [130, 142], 9: [155, 127], 10: [120, 145] });
  const shallow = edit(base, { 2: [146, 117], 7: [138, 133], 8: [107, 143], 9: [129, 130], 10: [99, 145] });
  const twist = (p: Point[], side: number) => edit(p, { 2: [p[2][0] + side * 2, p[2][1] - side],
    7: [p[7][0] + side * 5, p[7][1] + side * 3], 8: [p[8][0] + side * 5, p[8][1] - side * 4],
    9: [p[9][0] - side * 2, p[9][1] + side * 4], 10: [p[10][0] + side * 2, p[10][1] - side * 4] });
  const rock = (direction: number) => edit(base, { 0: [base[0][0] + direction * 13, base[0][1]],
    1: [base[1][0] + direction * 13, base[1][1]], 2: [base[2][0] + direction * 12, base[2][1]],
    3: onBall ? [base[3][0] + direction * 9, 121] : base[3], 4: onBall ? [base[4][0] + direction * 9, 121] : base[4],
    5: onBall ? [base[5][0] + direction * 9, 120] : base[5], 6: onBall ? [base[6][0] + direction * 9, 120] : base[6],
    7: [base[7][0] + direction * 6, base[7][1]], 9: [base[9][0] + direction * 6, base[9][1]] });
  const pike = edit(base, { 2: [148, 63], 7: [117, 103], 8: [85, 144], 9: [111, 106], 10: [77, 145] });
  const swing = (side: number) => edit(base, { 7: [106 + side * 7, 139 - side * 2], 8: [73 + side * 14, 147 - side * 4],
    9: [101 + side * 7, 141 - side * 2], 10: [67 + side * 14, 148 - side * 4] });
  const actions: Record<typeof style, Point[][]> = {
    saw: [base, rock(-1), base, rock(1)], "ball-saw": [base, rock(1), base, rock(-1)],
    pendulum: [base, swing(1), base, swing(-1)], side: [base, twist(shallow, 2), base, twist(shallow, -2)],
    up: [base, twist(tuck, 2), base, twist(tuck, -2)], climber: [base, edit(base, { 7: tuck[7], 8: tuck[8] }),
      base, edit(base, { 9: tuck[9], 10: tuck[10] })], pike: [base, pike, pike], "reverse-ring": [base, tuck, tuck],
  };
  const options: Attachments = onBall ? [["stability-ball", 11, 0, 0]]
    : [["line", 8, 68, 18], ["line", 10, 75, 18], [style === "reverse-ring" ? "ring" : "pad", 8, 0, 0],
      [style === "reverse-ring" ? "ring" : "pad", 10, 0, 0]];
  const anchors: Props = onBall ? [] : [[55, 18, 219, 18], [59, 18, 59, 155]];
  return loop(actions[style].map(p => [...p, [(p[3][0] + p[4][0]) / 2, 141]]), anchors, options, style === "climber" ? 480 : 900);
}

export const trunkLeverIllustrations: Record<string, Illustration> = {
  "9044": frontLever("advanced", "hold"), "9045": frontLever("straight", "hold"),
  "7251": frontLever("straight", "raise"), "11090": frontLever("straight", "negative"), "9043": frontLever("tuck", "hold"),
  "4373": hangingCore("deadbug"), "4767": hangingCore("circle"), "3890": hangingCore("elbows"),
  "11877": hangingCore("l-hold"), "9489": hangingCore("side"), "0866": hangingCore("hip-raise", true),
  "9318": dragonFlag("full"), "9319": dragonFlag("half"), "9322": dragonFlag("single"), "4982": dragonFlag("full", true),
  "6215": rollout("dumbbell"), "4189": rollout("ez"), "4093": rollout("wall"), "0857": rollout("wheel", true),
  "2296": rollout("ball", true), "7019": rollout("ball"), "2937": rollout("rounded-ball"),
  "4978": rollout("ring", true), "4979": rollout("ring"), "4799": rollout("strap", true),
  "1091": rollout("strap", false, true), "1144": rollout("strap-stand"),
  "3861": unstablePlank("ball-saw"), "1110": unstablePlank("saw"), "1156": unstablePlank("pendulum"),
  "1151": unstablePlank("side"), "1152": unstablePlank("up"), "1084": unstablePlank("climber"),
  "7274": unstablePlank("pike"), "4820": unstablePlank("reverse-ring"),
};
