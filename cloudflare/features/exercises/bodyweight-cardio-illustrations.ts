import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const change = (p: Point[], joints: Partial<Record<number, Point>>) => p.map((q, i) => joints[i] ?? q);
const motion = (frames: Point[][], ms: number, props: Props = [], dynamic: Attachments = []): Illustration => ({
  frames, props, dynamic, ms, reference: true,
});
const stood: Point[] = [[151, 42], [151, 61], [150, 108], [166, 85], [168, 112], [137, 85], [134, 112],
  [160, 132], [162, 156], [141, 132], [138, 156]];
const plank: Point[] = [[183, 102], [167, 109], [125, 128], [174, 134], [176, 155], [161, 133], [162, 155],
  [94, 142], [61, 156], [88, 143], [54, 156]];

type JackType = "cross" | "low" | "twist" | "split" | "loaded";
function jacks(kind: JackType): Illustration {
  const spread = change(stood, { 7: [173, 126], 8: [195, 155], 9: [126, 126], 10: [107, 155] });
  const air = (p: Point[]) => p.map(([x, y]): Point => [x, y - 6]);
  const overhead = change(spread, { 3: [171, 40], 4: [170, 16], 5: [131, 39], 6: [133, 16] });
  const crossed = (side: number) => change(stood, { 3: [171, 83 - side * 4], 4: [130, 78 - side * 4],
    5: [131, 83 + side * 4], 6: [169, 78 + side * 4], 7: [149 + side * 3, 132],
    8: [136, 154 + side * 2], 9: [151 + side * 3, 130], 10: [165, 154 - side * 2] });
  const twist = (side: number) => change(spread, { 0: [151 + side * 7, 41], 1: [150 + side * 5, 59],
    3: [168 + side * 12, 78], 4: [182 + side * 14, 101], 5: [134 + side * 14, 79], 6: [119 + side * 15, 102] });
  const split = (side: number) => change(stood, { 3: [151 + 17 * side, 84], 4: [151 + 37 * side, 96],
    5: [150 - 16 * side, 84], 6: [150 - 37 * side, 97], 7: [151 - side * 18, 129], 8: [151 - side * 39, 154],
    9: [149 + side * 18, 128], 10: [150 + side * 38, 155] });
  const squat = (wide: boolean) => change(wide ? spread : stood, { 0: [150, 76], 1: [150, 94], 2: [147, 126],
    3: [163, 111], 4: [151, 103], 5: [139, 111], 6: [151, 102],
    7: [wide ? 179 : 165, 132], 9: [wide ? 122 : 136, 131] });
  const rack = change(stood, { 3: [169, 84], 4: [170, 62], 5: [133, 83], 6: [132, 62] });
  const sequences: Record<JackType, Point[][]> = {
    cross: [stood, air(overhead), crossed(1), air(overhead), crossed(-1), air(overhead)],
    low: [squat(false), air(squat(true)), squat(true), air(squat(false))],
    twist: [stood, air(twist(1)), stood, air(twist(-1))],
    split: [stood, air(split(1)), split(1), air(split(-1)), split(-1), air(split(1))],
    loaded: [rack, air(overhead), overhead, air(rack)],
  };
  if (kind === "split") return motion(sequences.split.map(p => [...p, [p[0][0] + 5, p[0][1] - 2]]),
    510, [], [["face", 0, 11]]);
  return motion(sequences[kind], kind === "loaded" ? 560 : 510, [],
    kind === "loaded" ? [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]] : []);
}

type Burpee = "obstacle" | "squat" | "turn" | "jack" | "bell" | "lateral-kick" | "silent" | "frog";
function burpee(kind: Burpee): Illustration {
  const low = change(plank, { 0: [184, 130], 1: [169, 134], 2: [126, 144], 3: [148, 141], 5: [141, 142],
    7: [93, 147], 9: [87, 148] });
  const crouch = change(plank, { 0: [164, 93], 1: [155, 108], 2: [116, 122], 3: [165, 132], 5: [151, 131],
    7: [151, 128], 8: [137, 156], 9: [145, 126], 10: [124, 155] });
  const frog = change(crouch, { 7: [178, 123], 8: [183, 155], 9: [154, 121], 10: [148, 155] });
  const walked = change(plank, { 7: crouch[7], 8: crouch[8] });
  const deep = change(stood, { 0: [162, 66], 1: [152, 85], 2: [127, 129], 3: [166, 110], 4: [184, 118],
    5: [158, 108], 6: [176, 116], 7: [162, 132], 8: [156, 156], 9: [147, 132], 10: [140, 156] });
  const leap = (direction: number) => change(stood, { 0: [153 + direction * 10, 35], 1: [153 + direction * 10, 53],
    2: [153, 100], 3: [168, 35], 4: [182, 17], 5: [137, 35], 6: [124, 17], 7: [168, 125], 8: [183, 137],
    9: [143, 125], 10: [128, 137] });
  const kick = (side: number) => side > 0 ? change(stood, { 7: [181, 118], 8: [210, 118], 3: [171, 83], 4: [186, 95] })
    : change(stood, { 9: [119, 117], 10: [90, 116], 5: [130, 82], 6: [114, 94] });
  const bellPick = change(deep, { 3: [149, 120], 4: [148, 146], 5: [143, 119], 6: [141, 147] });
  const bellStand = change(stood, { 3: [154, 88], 4: [155, 122], 5: [148, 86], 6: [147, 122] });
  const full = [stood, crouch, plank, low, plank, crouch];
  const shift = (p: Point[], x: number) => p.map(([px, py]): Point => [px + x, py]);
  const obstacleLoop = [
    ...full.map(p => shift(p, -36)), shift(leap(1), 0),
    ...full.map(p => shift(p, -36).map(([x, y]): Point => [306 - x, y])), shift(leap(-1), 0),
  ];
  const series: Record<Burpee, Point[][]> = {
    obstacle: obstacleLoop, squat: [...full, stood, deep, stood],
    turn: [stood, crouch, plank, crouch, leap(1), stood, crouch, plank, crouch, leap(-1)],
    jack: [...full, leap(0)], bell: [...full, bellPick, bellStand, bellPick, stood],
    "lateral-kick": [...full, kick(1), ...full, kick(-1)], silent: [stood, crouch, walked, plank, walked, crouch],
    frog: [frog, plank, frog, deep, stood],
  };
  const attachments: Attachments = kind === "obstacle" ? [["dumbbell", 11, 0, 0]]
    : kind === "bell" ? [["handled-bell", 11, 12]] : [];
  const frames = series[kind].map((p) => {
    const bell: Point = p === bellStand ? [150, 122] : [145, 147];
    return [...p, kind === "obstacle" ? [153, 151] as Point : bell, [bell[0] + 1, bell[1] + 7] as Point];
  });
  return motion(frames, kind === "silent" ? 700 : 540, [], attachments);
}

function devilsPress(): Illustration {
  const atFloor = change(plank, { 4: [178, 144], 6: [159, 143] });
  const down = change(atFloor, { 0: [181, 127], 1: [168, 130], 2: [125, 140], 3: [155, 141], 5: [149, 141] });
  const feetIn = change(atFloor, { 0: [165, 92], 1: [156, 106], 2: [121, 124], 3: [166, 127], 5: [150, 128],
    7: [154, 129], 8: [144, 156], 9: [141, 131], 10: [133, 155] });
  const hang = change(stood, { 0: [170, 69], 1: [157, 80], 2: [129, 106], 3: [144, 106], 4: [127, 128],
    5: [139, 102], 6: [112, 124], 7: [161, 132], 9: [145, 130] });
  const top = change(stood, { 3: [169, 39], 4: [170, 17], 5: [141, 39], 6: [132, 17] });
  return motion([stood, feetIn, atFloor, down, atFloor, feetIn, hang, top, top, stood], 595, [],
    [["dumbbell", 4, 0, 4], ["dumbbell", 6, 0, 4]]);
}

function climber(kind: "cross" | "lunge" | "towel" | "outside" | "spider" | "standing" | "side-kick"): Illustration {
  if (kind === "standing") {
    const brace = change(stood, { 3: [172, 77], 4: [190, 76], 5: [163, 76], 6: [183, 73] });
    return motion([brace, change(brace, { 7: [181, 83], 8: [178, 118] }), brace,
      change(brace, { 9: [172, 85], 10: [169, 119] })], 495);
  }
  const reaches: Record<Exclude<typeof kind, "standing">, [Point, Point]> = {
    cross: [[155, 133], [120, 153]], lunge: [[191, 132], [188, 155]], towel: [[153, 132], [124, 156]],
    outside: [[172, 128], [135, 147]], spider: [[174, 120], [140, 142]], "side-kick": [[139, 123], [189, 142]],
  };
  const [knee, foot] = reaches[kind];
  const reachRight = change(plank, { 7: knee, 8: foot });
  const reachLeft = change(plank, { 9: [knee[0] - 9, knee[1] - 4], 10: [foot[0] - 12, foot[1] - 3] });
  const rotate = (near: boolean) => change(near ? reachRight : reachLeft, { 0: [167, 97], 1: [157, 110], 2: [129, 124],
    ...(near ? { 5: [164, 95], 6: [173, 80], 9: [99, 134], 10: [71, 155] } :
      { 3: [170, 99], 4: [181, 87], 7: [102, 134], 8: [75, 155] }) });
  return motion(kind === "side-kick" ? [plank, rotate(true), plank, rotate(false)] : [plank, reachRight, plank, reachLeft],
    kind === "lunge" || kind === "side-kick" ? 845 : 495, [],
    kind === "towel" ? [["slider", 8, 0, 4], ["slider", 10, 0, 4]] : []);
}

function skier(fixed: boolean): Illustration {
  const start = change(stood, { 3: [176, 50], 4: [202, 38], 5: [167, 50], 6: [193, 38] });
  const back = fixed
    ? change(stood, { 3: [137, 88], 4: [124, 109], 5: [129, 86], 6: [117, 105] })
    : change(stood, { 0: [181, 74], 1: [166, 83], 2: [128, 110], 3: [144, 100], 4: [117, 116], 5: [139, 97], 6: [110, 109] });
  return motion([start, back, back], fixed ? 880 : 675, [[235, 19, 235, 157], [215, 19, 236, 19], [221, 157, 247, 157]],
    [["band", 4, 219, 19], ["band", 6, 222, 19]]);
}

function ballPike(): Illustration {
  const base = change(plank, { 7: [93, 123], 8: [61, 121], 9: [88, 126], 10: [56, 124] });
  const pike = change(base, { 0: [177, 100], 1: [162, 111], 2: [129, 66], 7: [105, 96], 8: [83, 122],
    9: [98, 94], 10: [76, 122] });
  return motion([[...base, [66, 141]], [...pike, [88, 141]], [...pike, [88, 141]]], 920, [], [["stability-ball", 11, 0, 0]]);
}

const airBikeBase: Point[] = [[97, 130], [113, 138], [151, 151], [108, 114], [97, 122],
  [102, 113], [91, 121], [166, 115], [194, 135], [187, 144], [223, 146]];
const airBike = motion([airBikeBase, change(airBikeBase, { 7: [187, 143], 8: [224, 146], 9: [165, 113], 10: [190, 133] })], 690);

export const bodyweightCardioIllustrations: Record<string, Illustration> = {
  "4711": jacks("cross"), "0264": jacks("cross"), "0610": jacks("low"), "7556": jacks("low"), "0785": jacks("low"),
  "0683": jacks("twist"), "3113": jacks("split"), "4328": jacks("split"), "0504": jacks("loaded"),
  "10182": burpee("obstacle"), "4548": burpee("squat"), "5968": burpee("turn"), "7619": burpee("jack"),
  "3864": burpee("bell"), "3153": burpee("lateral-kick"), "5039": burpee("silent"), "3703": burpee("frog"), "4164": devilsPress(),
  "9048": climber("cross"), "0629": climber("lunge"), "5156": climber("towel"),
  "6335": climber("side-kick"), "5680": climber("outside"), "7463": climber("spider"), "0827": climber("standing"),
  "3779": skier(false), "3795": skier(false), "4697": skier(true), "0503": ballPike(), "4883": airBike,
};
