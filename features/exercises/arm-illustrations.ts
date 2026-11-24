import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Grip = "palm-up" | "palm-down" | "thumb-up";
type Pose = {
  trunk: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
  elbows: [Point, Point];
  support?: Props;
};
type Phase = [number, number] | [number, number, number];
type CurlOptions = {
  grip?: Grip;
  one?: boolean;
  phases?: Phase[];
  length?: number;
  gear?: Attachments;
};

const standing: Pose = {
  trunk: [[145, 39], [143, 57], [138, 102]],
  legs: [[145, 127], [148, 157], [129, 127], [126, 157]],
  elbows: [[155, 86], [134, 88]],
};
const flatBench: Props = [[108, 112, 175, 112], [113, 112, 113, 158], [171, 112, 171, 158]];
const seated: Pose = {
  trunk: [[133, 49], [130, 66], [126, 105]],
  legs: [[164, 111], [175, 157], [151, 111], [153, 157]],
  elbows: [[145, 92], [124, 95]],
  support: flatBench,
};
const stabilitySeat: Pose = { ...seated, support: undefined };
const hinge: Pose = {
  trunk: [[170, 65], [154, 77], [121, 103]],
  legs: [[140, 126], [135, 157], [123, 132], [114, 157]],
  elbows: [[161, 107], [140, 107]],
};
const spider: Pose = {
  trunk: [[166, 44], [152, 59], [119, 103]],
  legs: [[127, 125], [135, 157], [111, 130], [109, 157]],
  elbows: [[161, 93], [143, 91]],
  support: [[115, 109, 157, 65], [117, 106, 117, 157], [145, 76, 148, 157], [100, 157, 165, 157]],
};
const incline: Pose = {
  trunk: [[121, 44], [132, 60], [160, 104]],
  legs: [[190, 113], [194, 157], [178, 115], [177, 157]],
  elbows: [[139, 91], [126, 89]],
  support: [[116, 53, 157, 111], [157, 111, 190, 111], [181, 111, 181, 157], [141, 87, 139, 157]],
};
const preacher: Pose = {
  trunk: [[138, 50], [130, 67], [125, 105]],
  legs: [[160, 116], [168, 157], [150, 116], [152, 157]],
  elbows: [[157, 102], [142, 99]],
  support: [[105, 112, 142, 112], [113, 112, 113, 157], [137, 113, 137, 157],
    [139, 82, 155, 104], [151, 103, 153, 157], [143, 157, 168, 157]],
};
const kneeling: Pose = {
  trunk: [[143, 58], [141, 75], [136, 120]],
  legs: [[152, 153], [119, 155], [141, 154], [108, 156]],
  elbows: [[153, 102], [132, 104]],
};
const supine: Pose = {
  trunk: [[96, 144], [112, 151], [164, 152]],
  legs: [[189, 120], [206, 157], [178, 121], [194, 157]],
  elbows: [[138, 146], [128, 143]],
};

const dumbbells: Attachments = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]];
const barbell: Attachments = [["bar", 4, 6], ["barbell-end", 4, 9, 0], ["barbell-end", 6, -9, 0]];
const wideBarbell: Attachments = [["bar", 4, 6], ["barbell-end", 4, 15, 0], ["barbell-end", 6, -15, 0]];
const ezBar: Attachments = [["ez-bar", 4, 6], ["plate", 4, 8, 0], ["plate", 6, -8, 0]];
const hammerWeights: Attachments = [["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]];
const onBand: Attachments = [["band", 4, 8], ["band", 6, 10]];
const ballSeat: Attachments = [["stability-ball", 2, 0, 22]];
const medicineBall: Attachments = [["ball", 13, 0, -2]];
const arc: Phase[] = [[84, 84], [8, 8], [-64, -64], [8, 8]];
const drag: Phase[] = [[84, 84], [5, 5, -9], [-64, -64, -17], [5, 5, -9]];
const alternating: Phase[] = [[84, 84], [8, 84], [-64, 84], [8, 84], [84, 84], [84, 8], [84, -64], [84, 8]];
const crossChest: Phase[] = [[84, 84], [15, 84], [-140, 84], [15, 84], [84, 84], [84, 0], [84, -59], [84, 0]];
const atRightAngle: Phase = [0, 0];
const holds: Phase[] = [[84, 84], atRightAngle, atRightAngle, atRightAngle, atRightAngle, [84, 84]];

function add([x, y]: Point, angle: number, length: number): Point {
  const theta = angle * Math.PI / 180;
  return [x + Math.cos(theta) * length, y + Math.sin(theta) * length];
}

function poseFrame(pose: Pose, [near, far, shift = 0]: Phase, length = 27, one = false): Point[] {
  const nearElbow: Point = [pose.elbows[0][0] + shift, pose.elbows[0][1]];
  const farElbow: Point = [pose.elbows[1][0] + (one ? 0 : shift), pose.elbows[1][1]];
  const farAngle = one ? 84 : far;
  const first = add(nearElbow, near, length);
  const second = add(farElbow, farAngle, length);
  const middle: Point = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  return [
    ...pose.trunk, nearElbow, first, farElbow, second, ...pose.legs,
    add(first, near, 5), add(second, farAngle, 5), middle, [middle[0], middle[1] + 6],
  ];
}

function curl(pose: Pose, { grip = "palm-up", one = false, phases = arc, length, gear = [] }: CurlOptions = {}): Illustration {
  const dynamic: Attachments = [[grip, 4, 11], ...gear];
  if (!one) dynamic.push([grip, 6, 12]);
  return {
    frames: phases.map((phase) => poseFrame(pose, phase, length, one)),
    props: pose.support,
    dynamic,
    ms: 680,
    reference: true,
  };
}

function cableStation(x: number, y: number): Props {
  return [[x, 30, x, 153], [x - 11, 153, x + 11, 153], [x - 4, y, x + 4, y]];
}

function cableCurl(pose: Pose, x: number, y: number, handle: "bar" | "ez" | "v" | "pair", options: CurlOptions = {}): Illustration {
  let equipment: Attachments = [[handle === "ez" ? "ez-bar" : "bar", 4, 6], ["cable", 13, x, y]];
  if (handle === "v") equipment = [["line", 4, 14], ["line", 6, 14], ["cable", 14, x, y]];
  if (handle === "pair") equipment = [["cable", 4, x, y], ["cable", 6, x, y]];
  const support = [...(pose.support ?? []), ...cableStation(x, y)];
  return curl({ ...pose, support }, { ...options, gear: equipment });
}

function oneArmSupport(pose: Pose, options: CurlOptions = {}): Illustration {
  const demo = curl(pose, { one: true, ...options });
  return {
    ...demo,
    frames: demo.frames.map((frame) => frame.map((point, index): Point =>
      index === 5 ? [153, 99] : index === 6 ? [205, 110] : point)),
  };
}

function compound(pose: Pose, gear: Attachments, extension: boolean): Illustration {
  const shaft: Phase = [84, 84];
  const bottom = poseFrame(pose, shaft);
  const midpoint = poseFrame(pose, [8, 8]);
  const shoulder = poseFrame(pose, [-64, -64]);
  // The shoulder moves for the push. Hold the upper arm fixed for the extension.
  const overhead: Pose = { ...pose, elbows: [[155, 35], [130, 35]] };
  const press = poseFrame(overhead, [-85, -95], 23);
  const behindHead = poseFrame(overhead, [145, 135], 23);
  const bentHead = poseFrame(overhead, [177, 183], 23);
  const frames = [bottom, midpoint, shoulder, press];
  if (extension) frames.push(bentHead, behindHead, bentHead, press);
  frames.push(shoulder, midpoint);
  return {
    frames,
    props: pose.support,
    dynamic: [...gear, ["palm-up", 4, 11], ["palm-up", 6, 12]],
    ms: 660,
    reference: true,
  };
}

const cableBehindHead: Pose = { ...supine, elbows: [[109, 115], [95, 116]] };
const cableSeatedHigh: Pose = { ...seated, elbows: [[153, 66], [138, 66]] };
const closeStanding: Pose = { ...standing, elbows: [[149, 86], [139, 88]] };
const wideStanding: Pose = { ...standing, elbows: [[168, 86], [125, 86]] };
const closeIncline: Pose = { ...incline, elbows: [[140, 89], [132, 88]] };
const preacherTurn: Pose = {
  ...preacher,
  trunk: [[140, 48], [132, 65], [125, 105]],
  elbows: [[155, 102], [128, 93]],
};
const anchoredBench: Pose = {
  ...hinge,
  support: [[190, 112, 226, 112], [194, 112, 194, 158], [221, 112, 221, 158]],
};

function opposingHands(sheet = false): Illustration {
  const demo = curl(standing, { one: true, phases: arc });
  return {
    ...demo,
    frames: demo.frames.map((frame) => {
      const [x, y] = frame[4];
      const resistedHand: Point = [x - 5, sheet ? y + 16 : y + 4];
      return frame.map((point, index) => index === 6 ? resistedHand : point);
    }),
    dynamic: [...(demo.dynamic ?? []), ...(sheet ? [["line", 4, 6], ["pad", 6, 0, -3]] as Attachments : [])],
  };
}

function suspended(kind: "rings" | "handles" | "ears" | "clutch"): Illustration {
  const reachesEars = kind === "ears" || kind === "clutch" || kind === "rings";
  const standingAnchor: [Point, Point] = [[215, 43], [207, 40]];
  const bottom: Point[] = [[117, 75], [124, 89], [151, 119], [156, 72], [183, 58],
    [148, 74], [174, 59], [167, 139], [180, 157], [159, 142], [169, 157]];
  const top: Point[] = [[153, 54], [155, 71], [165, 114], [181, 60], reachesEars ? [160, 49] : [166, 49],
    [174, 61], reachesEars ? [150, 50] : [158, 49], [174, 137], [180, 157], [166, 138], [169, 157]];
  const dynamic: Attachments = [
    ["line", 4, ...standingAnchor[0]], ["line", 6, ...standingAnchor[1]],
    [kind === "rings" ? "ring" : "pad", 4, 0, 0], [kind === "rings" ? "ring" : "pad", 6, 0, 0],
  ];
  return {
    frames: kind === "clutch" ? [bottom, top, top] : [bottom, top],
    props: [[230, 27, 230, 157], [207, 40, 230, 27]],
    dynamic,
    ms: 1040,
    reference: true,
  };
}

function bodyweightUnderTable(): Illustration {
  const supported: Props = [[85, 88, 198, 88], [94, 88, 94, 157], [191, 88, 191, 157]];
  const bottom: Point[] = [[104, 136], [116, 141], [163, 149], [120, 113], [124, 87],
    [112, 112], [115, 87], [184, 152], [212, 158], [173, 151], [198, 157]];
  const high: Point[] = [[103, 96], [119, 102], [168, 130], [144, 104], [124, 87],
    [132, 103], [115, 87], [190, 143], [212, 158], [177, 144], [198, 157]];
  return { frames: [bottom, high], props: supported, ms: 1100, reference: true };
}

function bentKneeChinCurl(): Illustration {
  const support: Props = [[65, 73, 197, 73], [69, 73, 69, 157], [197, 73, 197, 157],
    [57, 98, 78, 98], [180, 98, 206, 98], [60, 98, 60, 158], [202, 98, 202, 158]];
  const bottom: Point[] = [[91, 123], [105, 127], [147, 143], [111, 99], [123, 73],
    [103, 98], [114, 74], [171, 127], [184, 157], [158, 128], [167, 157]];
  const high: Point[] = [[99, 86], [112, 93], [151, 120], [143, 89], [123, 73],
    [132, 90], [114, 74], [169, 123], [184, 157], [158, 126], [167, 157]];
  return { frames: [bottom, high], props: support, ms: 1100, reference: true };
}

function strictVsCheat(): Illustration {
  const shifted: Pose = {
    ...standing,
    trunk: [[130, 40], [133, 58], [143, 102]],
    elbows: [[149, 86], [128, 89]],
  };
  return {
    ...curl(standing, { gear: barbell }),
    frames: [poseFrame(standing, [84, 84]), poseFrame(shifted, [14, 14]), poseFrame(standing, [-64, -64]),
      poseFrame(standing, [-17, -17]), poseFrame(standing, [42, 42])],
  };
}

function stepCurl(side: "forward" | "side" | "lunge"): Illustration {
  const phase: Phase = [-64, -64];
  const nearStance: Pose = side === "side" ? {
    ...standing, trunk: [[172, 58], [166, 72], [155, 112]],
    legs: [[188, 126], [194, 157], [119, 132], [87, 157]],
    elbows: [[178, 99], [157, 104]],
  } : side === "lunge" ? {
    ...standing, trunk: [[164, 56], [161, 73], [154, 111]],
    legs: [[184, 116], [187, 157], [130, 145], [106, 153]],
    elbows: [[171, 98], [152, 101]],
  } : {
    ...standing,
    legs: [[164, 127], [177, 157], [129, 127], [126, 157]],
  };
  const farStance: Pose = side === "side" ? {
    ...standing, trunk: [[127, 59], [134, 74], [145, 112]],
    legs: [[174, 135], [206, 157], [108, 126], [105, 157]],
    elbows: [[147, 102], [127, 101]],
  } : {
    ...nearStance,
    legs: [nearStance.legs[2], nearStance.legs[3], nearStance.legs[0], nearStance.legs[1]],
  };
  const b = poseFrame(standing, [88, 88]);
  const a = poseFrame(nearStance, phase);
  const c = poseFrame(farStance, phase);
  const gear = side === "lunge" ? medicineBall : side === "side" ? dumbbells : [];
  return { ...curl(standing, { gear }), frames: [b, a, b, c], ms: 900 };
}

function squatGobletCurl(): Illustration {
  const squat: Pose = {
    trunk: [[156, 69], [151, 87], [138, 125]],
    legs: [[158, 124], [161, 157], [115, 127], [117, 157]],
    elbows: [[153, 121], [145, 121]],
  };
  const hold: Phase = [-70, -70];
  const upright = poseFrame(closeStanding, hold);
  const loaded = poseFrame(squat, hold);
  const lowered = poseFrame(squat, [49, 49]);
  return {
    ...curl(closeStanding, { gear: [["hammer-weight", 13, 0, 3]] }),
    frames: [upright, loaded, lowered, loaded],
  };
}

function deadliftCurl(): Illustration {
  const supportedElbows: Pose = { ...hinge, elbows: [[153, 107], [132, 107]] };
  const load: Phase = [94, 94];
  const start = poseFrame(standing, load);
  return {
    ...curl(standing, { gear: ezBar }),
    frames: [start, poseFrame(supportedElbows, load), start, poseFrame(standing, [8, 8]),
      poseFrame(standing, [-64, -64]), poseFrame(standing, [8, 8])],
  };
}

function smithDragCurl(): Illustration {
  const guides: Props = [[91, 27, 91, 157], [207, 27, 207, 157], [91, 27, 207, 27],
    [85, 157, 109, 157], [189, 157, 213, 157], [198, 45, 198, 145], [100, 45, 100, 145]];
  const shaft: Attachments = [["bar", 15, 16], ["barbell-end", 15, 0, 0], ["barbell-end", 16, 0, 0]];
  const startDx = add([0, 0], 84, 27)[0];
  const phases: Phase[] = arc.map(([angle]) => [angle, angle, startDx - add([0, 0], angle, 27)[0]]);
  const demo = curl({ ...standing, support: guides }, { gear: shaft, phases });
  const frames = demo.frames.map((frame): Point[] => {
    const shaftY = (frame[4][1] + frame[6][1]) / 2;
    return [...frame, [198, shaftY], [100, shaftY]];
  });
  return { ...demo, frames };
}

const doubleBandReverse = curl(standing, { grip: "palm-down", gear: onBand });
const standingDragDumbbells = curl(standing, { gear: dumbbells, phases: drag });

export const armIllustrations: Readonly<Record<string, Illustration>> = {
  // Free weights, grip and bench support.
  "10110": curl(standing, { grip: "palm-down", gear: [...barbell, ["pad", 13, 0, 0]] }),
  "3988": curl(spider, { grip: "palm-down", gear: barbell }),
  "4338": curl(spider, { gear: barbell }),
  "5669": curl(standing, { gear: barbell }),
  "2413": curl(wideStanding, { gear: wideBarbell, phases: drag }),
  "5696": strictVsCheat(),
  "6147": curl(standing, { grip: "thumb-up", gear: hammerWeights, phases: alternating }),
  "7625": curl(hinge, { gear: dumbbells }),
  "4152": curl(closeStanding, { gear: dumbbells }),
  "3687": standingDragDumbbells,
  "5298": curl(preacherTurn, { one: true, gear: [["dumbbell", 4, 0, 0]] }),
  "3083": curl(seated, { gear: dumbbells }),
  "6149": curl(seated, { gear: dumbbells, phases: drag }),
  "11864": curl(standing, { one: true, gear: [["dumbbell", 4, 0, 0]],
    phases: [[84, 84], atRightAngle, atRightAngle, atRightAngle, atRightAngle, [-64, -64], [8, 8]] }),
  "3963": curl(spider, { one: true, gear: [["dumbbell", 4, 0, 0]] }),
  "9931": curl(spider, { gear: dumbbells }),
  "6265": curl(standing, { grip: "palm-down", gear: dumbbells, phases: alternating }),
  "5449": standingDragDumbbells,
  "4017": oneArmSupport(anchoredBench, { gear: [["dumbbell", 4, 0, 0]] }),
  "1681": curl(stabilitySeat, { grip: "thumb-up", gear: [...hammerWeights, ...ballSeat] }),
  "4422": curl(standing, { gear: ezBar, phases: drag }),
  "0853": curl(standing, { gear: dumbbells }),
  "6070": curl(standing, { grip: "palm-down", gear: [["bottle", 4, 0, 0], ["bottle", 6, 0, 0]] }),

  // Band anchor, pulley position, attachment and fixed machine guides.
  "4088": curl(standing, { grip: "thumb-up", gear: onBand, phases: crossChest }),
  "1506": curl(closeStanding, { gear: [...ezBar, ...onBand] }),
  "0917": doubleBandReverse,
  "6195": doubleBandReverse,
  "8327": curl(standing, { gear: onBand, phases: drag }),
  "1861": cableCurl(standing, 249, 143, "v"),
  "4345": cableCurl(closeIncline, 244, 144, "bar"),
  "0183": cableCurl(cableBehindHead, 54, 144, "bar",
    { phases: [[-110, -110], [-36, -36], [50, 50], [-36, -36]] }),
  "4350": cableCurl(supine, 253, 143, "bar",
    { phases: [[0, 0], [-68, -68], [-138, -138], [-68, -68]] }),
  "11763": cableCurl(incline, 69, 144, "pair"),
  "6266": cableCurl(cableSeatedHigh, 249, 45, "ez",
    { phases: [[0, 0], [-68, -68], [-142, -142], [-68, -68]] }),
  "1608": cableCurl(standing, 249, 143, "ez", { grip: "palm-down" }),
  "2954": cableCurl(standing, 249, 143, "bar", { grip: "palm-down" }),
  "5299": curl({ ...preacherTurn, support: [...(preacherTurn.support ?? []),
    [209, 67, 209, 157], [226, 67, 226, 157], [209, 67, 226, 67], [203, 157, 234, 157],
    [209, 126, 226, 126], [209, 133, 226, 133], [209, 140, 226, 140],
    [151, 102, 208, 102]] }, { one: true, gear: [["line", 4, 156, 103], ["pad", 4, 0, 0]] }),
  "4546": smithDragCurl(),

  // Self-resistance, suspension and static holds.
  "8274": bodyweightUnderTable(),
  "3748": opposingHands(true),
  "2922": opposingHands(),
  "3486": bentKneeChinCurl(),
  "11792": curl(kneeling, { phases: holds }),
  "3558": curl(supine, { gear: [["line", 4, 14], ["line", 6, 14]],
    phases: [[0, 0], [-65, -65], [-130, -130], [-65, -65]] }),
  "6234": suspended("rings"),
  "10138": curl(standing, { phases: holds }),
  "1070": suspended("handles"),
  "1108": suspended("ears"),
  "1109": suspended("clutch"),
  "0847": curl(stabilitySeat, { gear: [...medicineBall, ...ballSeat] }),

  // Compound sequences: each lift has its own starting and finishing position.
  "5883": compound(standing, barbell, true),
  "5239": compound(stabilitySeat, [["dumbbell", 13, 0, 0], ...ballSeat], true),
  "5884": compound(standing, dumbbells, true),
  "3347": compound(standing, dumbbells, false),
  "5623": stepCurl("forward"),
  "1553": stepCurl("side"),
  "5238": stepCurl("lunge"),
  "4738": squatGobletCurl(),
  "5240": deadliftCurl(),
};

export { alternating, cableCurl, curl, dumbbells, hammerWeights, preacher, standing, stabilitySeat, ballSeat };
export type { Pose as CurlPose, Phase as CurlPhase };
