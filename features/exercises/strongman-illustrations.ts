import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const stance: Point[] = [[148, 49], [147, 68], [145, 110], [162, 90], [167, 115],
  [130, 90], [128, 115], [158, 135], [160, 157], [132, 135], [130, 157]];
const update = (points: Point[], next: Partial<Record<number, Point>>) => points.map((p, i) => next[i] ?? p);
const stage = (frame: Point[], ...markers: Point[]) => [...frame, ...markers];
const groundPickup = update(stance, { 0: [177, 84], 1: [161, 98], 2: [126, 127],
  3: [169, 126], 4: [183, 140], 5: [153, 127], 6: [177, 143], 7: [159, 141], 9: [129, 143] });
const lap = update(stance, { 0: [145, 69], 1: [143, 89], 2: [126, 133],
  3: [164, 101], 4: [167, 120], 5: [148, 104], 6: [154, 120], 7: [161, 139], 9: [139, 142] });
const chest = update(stance, { 3: [172, 96], 4: [171, 82], 5: [151, 90], 6: [159, 82] });
const lifted = update(stance, { 3: [167, 47], 4: [171, 23], 5: [137, 47], 6: [132, 23] });

type Load = "stone" | "sandbag" | "shield-load" | "training-log" | "iron-block" | "axle";
const marker = (f: Point[], p: Point) => stage(f, p);
const gear = (kind: Load): Attachments => [[kind, 11, 0, 0]];
function pressLoad(kind: "training-log" | "iron-block" | "axle"): Illustration {
  const bottom = marker(groundPickup, [179, kind === "axle" ? 146 : 150]);
  const racked = marker(chest, [161, 72]);
  const high = marker(lifted, [151, 22]);
  const dip = marker(update(chest, { 0: [147, 57], 1: [147, 76], 2: [140, 118], 3: [170, 104], 4: [171, 89],
    5: [149, 98], 6: [158, 89], 7: [162, 135] }), [162, 82]);
  const frames = kind === "iron-block" ? [racked, high, high, racked]
    : [bottom, marker(lap, [164, 118]), racked, dip, high, racked];
  return { frames, dynamic: gear(kind), ms: 820, reference: true };
}

function loadPlatform(kind: "stone" | "sandbag", height: number, carry = false): Illustration {
  const platform: Props = [[219, height, 272, height], [226, height, 226, 158], [266, height, 266, 158]];
  const held = marker(chest, [172, 85]);
  const approach = stage(update(chest, { 7: [175, 137], 8: [183, 156], 9: [136, 141], 10: [129, 156] }), [174, 85]);
  const transfer = update(chest, { 0: [180, 50], 1: [171, 69], 2: [151, 109], 3: [188, 93], 4: [209, height - 5],
    5: [183, 94], 6: [204, height - 9], 7: [176, 134], 8: [186, 157] });
  const reset = update(transfer, { 3: [171, 100], 4: [177, 127], 5: [150, 103], 6: [155, 128] });
  const step = (f: Point[], x: number): Point[] => f.map(([px, py]) => [px + x, py]);
  const phases = [marker(groundPickup, [183, 146]), marker(lap, [165, 116]), held,
    ...(carry ? [approach, step(held, 9), step(approach, 17)] : [held]),
    marker(transfer, [224, height - (kind === "stone" ? 13 : 7)]),
    marker(reset, [237, height - (kind === "stone" ? 13 : 7)])];
  return { frames: phases, props: platform, dynamic: gear(kind), cutOnLoop: true, ms: 860, reference: true };
}

function sandbagShoulder(): Illustration {
  const near = update(chest, { 3: [170, 86], 4: [174, 53], 5: [153, 83], 6: [148, 59] });
  const far = update(chest, { 3: [169, 79], 4: [154, 57], 5: [136, 83], 6: [119, 55] });
  const down = marker(groundPickup, [185, 151]), knees = marker(lap, [166, 116]);
  return { frames: [down, knees, marker(near, [161, 56]), knees, down, knees, marker(far, [131, 55]), knees],
    dynamic: gear("sandbag"), ms: 780, reference: true };
}

function toss(kind: "keg" | "sandbag" | "throw-weight"): Illustration {
  const launch = update(lifted, { 0: [142, 52], 1: [146, 72], 2: [155, 111], 3: [143, 45], 4: [136, 26],
    5: [135, 46], 6: [132, 34] });
  const ready = marker(groundPickup, [183, 148]);
  const hike = marker(update(groundPickup, { 0: [182, 83], 1: [166, 94], 3: [151, 121], 4: [134, 141],
    5: [145, 120], 6: [130, 142] }), [131, 140]);
  const pull = marker(update(chest, { 0: [158, 51], 1: [154, 68], 3: [177, 90], 4: [182, 54], 6: [170, 57] }), [180, 54]);
  const released = marker(launch, [126, 17]);
  const rest = update(stance, { 4: [169, 105], 6: [126, 109] });
  const props: Props = kind === "sandbag" ? [] : [[77, 36, 77, 157], [61, 36, 93, 36], [64, 157, 91, 157]];
  const frames = [ready, ...(kind === "sandbag" ? [] : [hike]), pull, released,
    marker(launch, [84, 13]), marker(rest, [58, 57]), marker(rest, [50, 147])];
  const freeFarArm = (f: Point[]): Point[] => update(f, { 5: [f[1][0] - 14, f[1][1] + 19], 6: [f[1][0] - 32, f[1][1] + 27] });
  return { frames: kind === "throw-weight" ? frames.map(freeFarArm) : frames,
    props, dynamic: [[kind, 11, 0, 0]], cutOnLoop: true, ms: 740, reference: true };
}

function holdWeights(mode: "front" | "cross" | "iceland" | "hercules"): Illustration {
  if (mode === "front") {
    const front = update(stance, { 0: [133, 49], 1: [131, 68], 2: [128, 112],
      3: [162, 70], 4: [190, 70], 5: [151, 72], 6: [182, 72], 7: [141, 135], 9: [120, 133] });
    const ready = update(front, { 3: [143, 95], 4: [154, 117], 5: [138, 96], 6: [149, 119] });
    return { frames: [marker(ready, [155, 118]), marker(front, [190, 70]), marker(front, [190, 70]), marker(front, [190, 70])],
      dynamic: [["plate", 11, 0, 0]], ms: 1350, reference: true };
  }
  const lateral = update(stance, { 3: [179, 69], 4: [204, 69], 5: [115, 69], 6: [91, 69] });
  if (mode === "hercules") {
    const ready = stage(lateral, [46, 49], [255, 49]);
    const settled = stage(update(lateral, { 3: [178, 71], 4: [202, 73], 5: [117, 71], 6: [93, 73] }), [44, 52], [258, 52]);
    return { frames: [ready, settled, settled, settled], props: [[60, 156, 242, 156]],
      dynamic: [["bar", 11, 45, 157], ["bar", 12, 252, 157], ["cable", 11, 6], ["cable", 12, 4],
        ["plate", 11, 0, 0], ["plate", 12, 0, 0]], ms: 1450, reference: true };
  }
  const variant = mode === "iceland" ? [["crucifix-load", 4, 0, 3], ["crucifix-load", 6, 0, 3]] as Attachments
    : [["plate", 4, 0, 1], ["plate", 6, 0, 1]] as Attachments;
  return { frames: [stance, lateral, lateral, lateral], dynamic: variant, ms: 1300, reference: true };
}

function walkLoad(mode: "shield-load" | "timber-frame" | "conan"): Illustration {
  const opposite = update(chest, { 7: [154, 134], 8: [154, 155], 9: [169, 128], 10: [178, 147] });
  const a = update(chest, { 7: [175, 130], 8: [182, 153], 9: [135, 137], 10: [126, 157] });
  const b = update(opposite, { 0: [148, 47], 1: [147, 66], 2: [145, 109] });
  const poses = [a, b, opposite, chest];
  if (mode === "conan") {
    const frame = (f: Point[], offset: number) => stage(f, [170 + offset, 91], [244, 126], [215 + offset, 112]);
    return { frames: poses.map((f, i) => frame(f, [-5, 0, 5, 0][i])), props: [[244, 69, 244, 158],
      [222, 155, 267, 155], [191, 151, 219, 147], [191, 151, 165, 157]],
      dynamic: [["bar", 11, 12], ["plate", 13, 0, 0]], ms: 760, reference: true };
  }
  if (mode === "timber-frame") {
    const hold = (f: Point[]): Point[] => stage(update(f, { 3: [162, 91], 4: [165, 115], 5: [131, 91], 6: [127, 115] }),
      [96, 139], [188, 139], [208, 126], [119, 126]);
    return { frames: poses.map(hold), props: [[72, 166, 242, 151]], dynamic: [["bar", 11, 12], ["bar", 12, 13],
      ["bar", 13, 14], ["bar", 14, 11], ["line", 4, 12], ["line", 6, 14]], ms: 760, reference: true };
  }
  return { frames: poses.map((f) => marker(f, [167, 85])), dynamic: gear("shield-load"), ms: 760, reference: true };
}

function tireFlip(): Illustration {
  const ground = update(groundPickup, { 0: [171, 112], 1: [158, 116], 2: [124, 131], 3: [170, 141], 4: [184, 152],
    5: [158, 137], 6: [181, 150] });
  const knee = update(lap, { 3: [176, 117], 4: [197, 129], 5: [168, 119], 6: [194, 128] });
  const push = update(stance, { 0: [169, 56], 1: [158, 75], 2: [139, 109], 3: [185, 80], 4: [213, 78],
    5: [180, 78], 6: [208, 77], 7: [175, 137], 8: [185, 156], 9: [131, 137], 10: [122, 156] });
  const follow = update(push, { 3: [187, 103], 4: [206, 113], 5: [179, 100], 6: [203, 111] });
  const p = (body: Point[], near: Point, far: Point) => stage(body, near, far);
  const frames = [p(ground, [183, 150], [259, 150]), p(knee, [192, 121], [252, 150]),
    p(push, [215, 75], [236, 145]), p(follow, [270, 102], [236, 153]), p(stance, [238, 151], [290, 151])];
  return { frames, dynamic: [["tire-outline", 11, 12]], cutOnLoop: true, ms: 900, reference: true };
}

function hingedPost(): Illustration {
  const setup: Point[] = [[104, 103], [98, 116], [80, 133], [111, 136], [135, 151],
    [104, 137], [131, 150], [104, 140], [110, 156], [75, 145], [66, 156]];
  const raise = update(setup, { 0: [106, 70], 1: [106, 91], 2: [109, 118], 3: [119, 110], 4: [141, 120],
    5: [110, 113], 6: [137, 118], 7: [120, 137], 8: [124, 155] });
  const advance = update(stance, { 0: [151, 64], 1: [146, 83], 2: [136, 120], 3: [168, 82], 4: [184, 86],
    5: [163, 89], 6: [181, 89], 7: [154, 139], 8: [158, 155], 9: [122, 140], 10: [113, 155] });
  const shuffle = advance.map(([x, y]): Point => [x + 31, y - (y < 130 ? 8 : 0)]);
  const shove = update(shuffle, { 0: [201, 63], 1: [198, 81], 2: [184, 116],
    3: [215, 87], 4: [236, 113], 5: [205, 91], 6: [228, 112], 8: [206, 157], 10: [159, 156] });
  const poses: [Point[], Point][] = [[setup, [134, 151]], [raise, [143, 111]], [advance, [179, 72]],
    [shuffle, [225, 60]], [shove, [278, 77]], [shove, [315, 137]]];
  const frames = poses.map(([body, end]) => stage(body, end, [225, 151]));
  return { frames, props: [[212, 156, 240, 156]], dynamic: [["hinged-post", 11, 12]],
    cutOnLoop: true, ms: 840, reference: true };
}

function vikingPress(): Illustration {
  const hands = update(chest, { 3: [172, 91], 4: [174, 74], 5: [151, 88], 6: [165, 72] });
  const upper = update(lifted, { 0: [167, 46], 1: [164, 67], 2: [148, 108],
    3: [183, 49], 4: [202, 30], 5: [182, 51], 6: [196, 36] });
  const frame = (f: Point[], rise: boolean) => stage(f, [247, 90], [252, 101], [233, rise ? 95 : 96], [241, rise ? 96 : 107]);
  return { frames: [frame(hands, false), frame(upper, true), frame(upper, true)],
    props: [[246, 89, 246, 157], [253, 101, 253, 157], [225, 158, 276, 158]],
    dynamic: [["bar", 4, 11], ["bar", 6, 12], ["plate", 13, 0, 0], ["plate", 14, 0, 0]], ms: 1000, reference: true };
}

function armOverArm(): Illustration {
  const body = update(chest, { 0: [131, 57], 1: [137, 73], 2: [150, 110], 7: [171, 128], 8: [185, 156],
    9: [138, 137], 10: [132, 155] });
  const a = update(body, { 3: [164, 86], 4: [184, 99], 5: [129, 92], 6: [150, 99] });
  const b = update(body, { 3: [136, 96], 4: [152, 103], 5: [167, 96], 6: [184, 103] });
  const poses = [a, b, a, b].map((f, i) => stage(f, [254 - i * 7, 141]));
  return { frames: poses, dynamic: [["cable", 11, 4], ["line", 4, 6], ["iron-block", 11, 0, 0]],
    cutOnLoop: true, ms: 860, reference: true };
}

function truckPull(): Illustration {
  const a: Point[] = [[178, 72], [163, 84], [132, 115], [183, 94], [205, 89],
    [168, 101], [195, 93], [158, 130], [172, 155], [126, 141], [111, 156]];
  const b = update(a, { 7: [142, 140], 8: [132, 155], 9: [162, 129], 10: [181, 155] });
  const c = update(a, { 7: [136, 143], 8: [123, 157], 9: [161, 132], 10: [169, 151] });
  const fixed: Props = [[22, 108, 62, 108], [62, 108, 62, 118], [62, 118, 78, 118], [78, 118, 91, 140],
    [91, 140, 91, 149], [91, 149, 21, 149], [21, 149, 21, 108], [67, 121, 76, 121]];
  return { frames: [a, b, c, b].map((f) => stage(f, [35, 151], [74, 151], [160, 92])),
    props: fixed, dynamic: [["wheel", 11, 0, 0], ["wheel", 12, 0, 0], ["cable", 13, 90, 143], ["line", 13, 4], ["pad", 13, 0, -2]],
    ms: 660, reference: true };
}

function wheelbarrow(): Illustration {
  const pose: Point[] = [[140, 64], [129, 83], [120, 119], [147, 107], [162, 125], [131, 108], [152, 126],
    [139, 137], [153, 157], [111, 141], [98, 157]];
  const other = update(pose, { 7: [112, 141], 8: [104, 157], 9: [136, 132], 10: [152, 151] });
  return { frames: [pose, other].map((f) => stage(f, [221, 138], [247, 149], [255, 120], [192, 116], [238, 128])),
    dynamic: [["line", 4, 11], ["line", 6, 11], ["bar", 11, 12], ["bar", 13, 14], ["bar", 14, 11],
      ["bar", 13, 11], ["wheel", 12, 0, 0], ["iron-block", 15, 0, -4]], ms: 760, reference: true };
}

function masWrestling(): Illustration {
  const f: Point[] = [[91, 95], [105, 112], [112, 149], [124, 123], [150, 117], [122, 117], [153, 111],
    [139, 139], [157, 146], [138, 143], [157, 151]];
  const a = update(f, { 0: [70, 102], 1: [85, 116], 3: [113, 125], 4: [145, 117], 5: [110, 116], 6: [151, 111] });
  const b = update(f, { 0: [107, 98], 1: [117, 114], 3: [143, 124], 4: [156, 119], 5: [144, 116], 6: [159, 112] });
  const mirror = (pose: Point[]): Point[] => pose.map(([x,y]) => [320-x,y]);
  const stick = (body: Point[], dx = 0) => stage(body, [150 + dx, 114], [172 + dx, 114]);
  return { frames: [stick(f), stick(a, -7), stick(f), stick(b, 7)], partnerFrames: [mirror(f), mirror(b), mirror(f), mirror(a)],
    dynamic: [["bar", 11, 12]], props: [[160, 129, 160, 159], [154, 159, 166, 159]], ms: 1100, reference: true };
}

function farmersBars(): Illustration {
  const tall = update(stance, { 3: [162, 93], 4: [163, 112], 5: [131, 93], 6: [130, 112] });
  const walk = [tall, update(tall, { 7: [168, 133], 8: [173, 151], 9: [130, 134], 10: [120, 151] }),
    tall, update(tall, { 7: [151, 135], 8: [140, 153], 9: [145, 132], 10: [158, 150] })];
  return { frames: walk.map((f) => stage(f, [119, 117], [209, 108], [84, 114], [177, 106])),
    dynamic: [["bar", 13, 14], ["bar", 11, 12], ["barbell-end", 11, 0, 0], ["barbell-end", 12, 0, 0],
      ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]], ms: 660, reference: true };
}

function loadedSquat(platform: boolean): Illustration {
  const standing = update(stance, { 3: [168, 79], 4: [168, 67], 5: [132, 79], 6: [133, 67] });
  const deep = update(standing, { 0:[153,80], 1:[151,98], 2:[137,135], 3:[174,113], 4:[168,99],
    5:[130,112], 6:[132,98], 7:[170,133], 9:[125,132] });
  const markers = (pose: Point[]): Point[] => {
    const height = pose[1][1];
    return stage(pose, [112, height], [187, height], [99, height + 57], [200, height + 57],
      [102, height + 37], [196, height + 37], [83, height + 52], [217, height + 52]);
  };
  const apparatus: Attachments = platform ? [["bar",11,12],["bar",11,15],["bar",12,16],["bar",15,13],["bar",16,14],
    ["bar",17,18],["plate",17,0,0],["plate",18,0,0]]
    : [["bar",11,12],["barbell-end",11,0,0],["barbell-end",12,0,0]];
  return { frames: [standing, deep, deep].map(markers), dynamic: apparatus, ms: 1020, reference: true };
}

function stoneToYoke(): Illustration {
  const pickup = update(lap, {3:[159,112],4:[179,121],5:[147,116],6:[166,124]});
  const hipsThrough = update(chest, {3:[176,108],4:[187,111],5:[164,100],6:[175,111]});
  const transfer = update(chest, {3:[186,89],4:[204,78],5:[178,90],6:[199,84],7:[169,134],8:[172,156]});
  const reset = update(transfer,{3:[172,99],4:[181,121],5:[155,99],6:[160,122]});
  return { frames:[marker(pickup,[177,109]),marker(hipsThrough,[186,92]),marker(transfer,[206,70]),marker(reset,[236,143])],
    props:[[210,23,210,156],[228,29,228,154],[207,92,231,95],[183,157,247,157]], dynamic:gear("stone"),
    cutOnLoop:true, ms:940, reference:true };
}

function carFlip(): Illustration {
  const floor = update(groundPickup,{0:[197,104],1:[204,116],2:[231,134],3:[186,135],4:[174,145],
    5:[193,134],6:[174,141],7:[211,139],8:[202,156],9:[238,143],10:[248,156]});
  const gather = update(floor,{0:[192,80],1:[204,95],2:[224,118],3:[191,112],4:[171,119],5:[198,113],6:[167,116]});
  const drive = update(gather,{0:[201,64],1:[207,81],2:[224,114],3:[183,83],4:[155,89],5:[192,86],6:[161,95],
    7:[206,133],9:[239,130],10:[257,153]});
  const free = update(drive,{0:[221,65],1:[223,86],2:[231,113],3:[207,107],4:[194,124],5:[220,107],6:[214,130]});
  const stages: [Point[], Point, Point][] = [[floor,[61,146],[173,146]],[gather,[58,148],[172,118]],
    [drive,[57,148],[153,91]],[drive,[62,147],[104,51]],[free,[63,143],[18,96]],[free,[129,125],[20,125]]];
  const carFrame = ([body, a, b]: typeof stages[number]) => {
    const [ax, ay] = a, [bx, by] = b;
    const point = (fraction: number, rise: number): Point => [ax+(bx-ax)*fraction+(by-ay)*rise/110, ay+(by-ay)*fraction-(bx-ax)*rise/110];
    return stage(body,a,b,point(.04,13),point(.24,19),point(.40,34),point(.67,34),point(.81,15),point(.98,12),
      point(.23,1),point(.80,1),point(.48,30),point(.44,17),point(.72,17),point(.66,31));
  };
  return { frames:stages.map(carFrame), dynamic:[["bar",11,12],["line",11,13],["line",13,14],["line",14,15],
    ["line",15,16],["line",16,17],["line",17,18],["line",18,12],["wheel",19,0,0],["wheel",20,0,0],
    ["line",21,22],["line",22,23],["line",23,24]],cutOnLoop:true,ms:910,reference:true };
}

export const strongmanIllustrations: Readonly<Record<string, Illustration>> = {
  "10427": toss("sandbag"),
  "2733": pressLoad("axle"),
  "2709": armOverArm(),
  "2724": loadPlatform("stone", 105),
  "2716": walkLoad("conan"),
  "2717": holdWeights("cross"),
  "3306": hingedPost(),
  "2718": holdWeights("front"),
  "2726": holdWeights("hercules"),
  "2714": holdWeights("iceland"),
  "2713": pressLoad("iron-block"),
  "3307": toss("keg"),
  "2721": loadPlatform("sandbag", 114, true),
  "2707": pressLoad("training-log"),
  "2708": masWrestling(),
  "2727": walkLoad("shield-load"),
  "2715": walkLoad("timber-frame"),
  "2730": tireFlip(),
  "2710": truckPull(),
  "2719": vikingPress(),
  "2731": toss("throw-weight"),
  "2723": wheelbarrow(),
  "10385": sandbagShoulder(),
  "2734": farmersBars(),
  "2720": loadedSquat(true),
  "2728": loadedSquat(false),
  "2722": stoneToYoke(),
  "3317": carFlip(),
};
