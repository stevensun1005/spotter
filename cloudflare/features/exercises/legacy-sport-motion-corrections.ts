import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const shift = (frame: Point[], x: number, y = 0) => frame.map(([px, py]): Point => [px + x, py + y]);
const mirror = (frame: Point[]) => frame.map(([x, y]): Point => [320 - x, y]);
function update(frame: Point[], edits: Partial<Record<number, Point>>): Point[] {
  return frame.map((point, i) => edits[i] ?? point);
}
function motion(frames: Point[][], ms: number, dynamic: Attachments = [], props: Props = []): Illustration {
  return { frames, ms, dynamic: [...feet, ...dynamic], props, reference: true };
}

const standing: Point[] = [
  [143, 48], [142, 65], [137, 102], [148, 93], [170, 97], [140, 91], [164, 96],
  [151, 130], [150, 155], [130, 130], [126, 154], [164, 157], [139, 156], [169, 92],
];
const bothBall: Attachments = [["ball", 13, 0, 0]];
function slam(single: boolean): Illustration {
  const base = single ? update(standing, {5: [129, 88], 6: [127, 102], 13: [173, 93]}) : standing;
  const raised = update(base, {
    0: [145, 42], 1: [142, 59], 2: [138, 99], 3: [149, 42], 4: [151, 20],
    5: single ? [128, 89] : [138, 41], 6: single ? [125, 101] : [140, 20], 13: [147, 15],
  });
  const drive = update(base, {
    0: [171, 64], 1: [153, 77], 2: [130, 107], 3: [168, 87], 4: [185, 96],
    5: single ? [128, 101] : [159, 90], 6: single ? [134, 109] : [178, 97],
    7: [151, 130], 9: [132, 128], 13: [185, 100],
  });
  const release = update(drive, {
    0: [172, 77], 1: [153, 84], 2: [127, 109], 3: [163, 102], 4: [174, 123],
    5: single ? [124, 111] : [154, 104], 6: single ? [137, 121] : [169, 122],
    7: [153, 132], 9: [131, 129], 13: [191, 151],
  });
  const catchLow = update(release, {
    3: [166, 105], 4: [183, 132], 6: single ? [134, 118] : [177, 132], 13: [185, 137],
  });
  const lift = update(base, {
    0: [154, 62], 1: [144, 77], 2: [133, 106], 3: [155, 98], 4: [180, 112],
    5: single ? [129, 99] : [146, 100], 6: single ? [133, 109] : [173, 113], 13: [178, 112],
  });
  return motion(single
    ? [base, base, raised, raised, drive, release, catchLow, lift, base]
    : [raised, raised, drive, release, catchLow, lift, base, raised], 350, bothBall);
}

const passing: Point[] = [
  [94, 46], [91, 64], [87, 104], [86, 87], [112, 77], [81, 84], [107, 75],
  [106, 132], [115, 155], [75, 128], [67, 155], [130, 158], [82, 157], [114, 75],
];
const pushOut = update(passing, {
  0: [105, 46], 1: [101, 64], 2: [94, 103], 3: [125, 72], 4: [150, 72], 5: [117, 70], 6: [143, 69],
  7: [114, 131], 9: [79, 126], 13: [153, 71],
});
const readyCatch = update(passing, {3:[114, 76],4:[135, 73],5:[109, 73],6:[130, 72]});
const receive = update(pushOut, {3:[119, 77],4:[146, 74],5:[114, 73],6:[141, 73]});
const chestPass = {
  ...motion([
    passing, pushOut, update(pushOut, {13: [162, 70]}),
    update(readyCatch, {13: [176, 74]}), update(readyCatch, {13: [206, 75]}),
    update(readyCatch, {13: [169, 71]}), update(receive, {13: [149, 74]}), passing,
  ], 360, bothBall),
  partnerFrames: [readyCatch, readyCatch, receive, receive, passing, pushOut, pushOut, readyCatch].map(mirror),
};

const prepared: Point[] = [
  [200, 55], [187, 70], [168, 107], [174, 86], [155, 94], [168, 81], [149, 88],
  [187, 132], [180, 154], [173, 131], [167, 153], [195, 158], [181, 157], [205, 51],
];
const airborne = update(prepared, {
  0: [186, 35], 1: [176, 51], 2: [176, 90], 3: [198, 62], 4: [220, 55], 5: [193, 56], 6: [211, 52],
  7: [179, 116], 8: [188, 138], 9: [170, 117], 10: [176, 138], 11: [201, 139], 12: [189, 138], 13: [191, 31],
});
const toeContact = update(prepared, {
  0: [197, 51], 1: [187, 67], 2: [173, 103], 3: [191, 86], 4: [210, 82], 5: [185, 83], 6: [200, 79],
  8: [178, 150], 10: [166, 150], 13: [202, 48],
});
const absorb = update(prepared, {
  0: [199, 65], 1: [185, 78], 2: [162, 114], 3: [190, 97], 4: [209, 89], 5: [186, 95], 6: [200, 86], 13: [204, 62],
});
const backward = {
  ...motion([prepared, prepared, shift(airborne, -35), shift(toeContact, -67), shift(absorb, -70), shift(prepared, -70)], 520,
    [["face", 0, 13]]),
  cutOnLoop: true,
};

function alternateStride(path: Point[][], ms: number): Illustration {
  const swap = (frame: Point[]) => [0, 1, 2, 5, 6, 3, 4, 9, 10, 7, 8, 12, 11, 13].map(index => frame[index]);
  return motion([...path, ...path.map(swap)], ms, [["face", 0, 13]]);
}

const drive: Point[] = [
  [174, 43], [164, 59], [152, 98], [145, 84], [139, 103], [180, 75], [193, 63],
  [186, 100], [181, 125], [143, 124], [149, 153], [193, 129], [162, 156], [180, 40],
];
const legExtended = update(drive, {
  3: [141, 83], 4: [131, 102], 5: [181, 75], 6: [194, 57],
  7: [186, 100], 8: [219, 109], 11: [228, 103], 9: [145, 124], 10: [149, 154], 12: [162, 157],
});
const retract = update(drive, {7: [178, 108], 8: [165, 132], 11: [175, 137], 10: [148, 154]});
const changeFoot = update(drive, {
  0: [172, 48], 1: [161, 65], 2: [151, 102], 3: [155, 82], 4: [171, 87],
  5: [169, 82], 6: [184, 81], 7: [161, 130], 8: [155, 154], 9: [160, 125], 10: [145, 145],
  11: [166, 158], 12: [152, 150], 13: [178, 45],
});
const pushToRun = alternateStride([drive, legExtended, retract, changeFoot], 335);

const boundKnee = update(drive, {
  0: [174, 43], 1: [162, 58], 2: [148, 98], 3: [141, 72], 4: [129, 86],
  5: [178, 75], 6: [196, 56], 7: [179, 101], 8: [175, 126], 9: [137, 124], 10: [139, 150],
  11: [186, 130], 12: [150, 157],
});
const boundFlight = update(boundKnee, {
  0: [182, 31], 1: [171, 49], 2: [150, 84], 3: [139, 62], 4: [116, 79],
  5: [193, 53], 6: [195, 34], 7: [193, 82], 8: [207, 107], 9: [128, 109], 10: [102, 115],
  11: [221, 112], 12: [89, 123], 13: [188, 28],
});
const boundLand = update(boundKnee, {
  0: [180, 48], 1: [168, 66], 2: [151, 104], 3: [147, 82], 4: [137, 104],
  5: [179, 82], 6: [191, 72], 7: [173, 129], 8: [154, 153], 9: [137, 125], 10: [140, 146],
  11: [166, 157], 12: [149, 153], 13: [186, 45],
});
const wheelRun = alternateStride([boundKnee, boundFlight, boundLand, changeFoot], 280);

const crank: Point = [175, 131];
const bikeProps: Props = [
  [112, 155, 236, 155], [134, 153, 153, 101], [145, 100, 165, 100], [154, 105, 177, 131],
  [135, 153, 177, 131], [177, 131, 220, 98], [235, 155, 220, 98], [220, 98, 218, 81], [207, 81, 230, 81],
];
for (let i = 0; i < 16; i++) {
  const a = Math.PI * i / 8, b = Math.PI * (i + 1) / 8;
  bikeProps.push([210 + 19 * Math.cos(a), 134 + 19 * Math.sin(a), 210 + 19 * Math.cos(b), 134 + 19 * Math.sin(b)]);
}
function standingPedal(angle: number): Point[] {
  const pedal = (offset: number): Point => [crank[0] + 13 * Math.cos(angle + offset), crank[1] + 13 * Math.sin(angle + offset)];
  const near = pedal(0), far = pedal(Math.PI);
  const nearKnee: Point = [(near[0] + 157) / 2 + 12, (near[1] + 92) / 2 - 1];
  const farKnee: Point = [(far[0] + 150) / 2 + 11, (far[1] + 92) / 2 - 1];
  return [
    [185, 42], [170, 56], [155, 88], [189, 75], [218, 78], [187, 71], [210, 79],
    nearKnee, [near[0] - 4, near[1] - 5], farKnee, [far[0] - 4, far[1] - 5],
    [near[0] + 11, near[1] - 2], [far[0] + 11, far[1] - 2], crank, near, far,
  ];
}
const bike = motion(Array.from({ length: 8 }, (_, i) => standingPedal(i * Math.PI / 4)), 250,
  [["line", 13, 14], ["line", 13, 15], ["pad", 14, 0, 0], ["pad", 15, 0, 0]], bikeProps);

const flywheel: Point = [96, 133];
const pivot: Point = [217, 110];
const ellipticalBase: Props = [
  [73, 157, 251, 157], [232, 156, 221, 128], [221, 128, 233, 94], [230, 82, 245, 72],
  [231, 85, 246, 76], [218, 108, 230, 91], [74, 153, 108, 153], [234, 151, 255, 151],
];
for (let i = 0; i < 16; i++) {
  const a = Math.PI * i / 8, b = Math.PI * (i + 1) / 8;
  ellipticalBase.push([flywheel[0] + 21 * Math.cos(a), flywheel[1] + 21 * Math.sin(a),
    flywheel[0] + 21 * Math.cos(b), flywheel[1] + 21 * Math.sin(b)]);
}
function ellipticalPosition(angle: number): Point[] {
  const stride = (offset: number, depth: number) => {
    const phase = angle + offset;
    const shoe: Point = [153 + 25 * Math.cos(phase) + depth, 141 + 7 * Math.sin(phase)];
    const hand: Point = [212 - 17 * Math.cos(phase) + depth, 82 + 4 * Math.sin(phase)];
    const knee: Point = [(shoe[0] + 160) / 2 + 12, (shoe[1] + 102) / 2 - 4];
    const elbow: Point = [(hand[0] + 167) / 2, 91];
    return { shoe, hand, knee, elbow };
  };
  const near = stride(0, 0), far = stride(Math.PI, 5);
  return [
    [172, 49], [165, 65], [156, 100],
    near.elbow, near.hand, far.elbow, far.hand,
    near.knee, [near.shoe[0] - 4, near.shoe[1] - 5],
    far.knee, [far.shoe[0] - 4, far.shoe[1] - 5],
    [near.shoe[0] + 10, near.shoe[1] - 3], [far.shoe[0] + 10, far.shoe[1] - 3],
    near.shoe, far.shoe, pivot, flywheel, [176, 46],
  ];
}
const elliptical = motion(Array.from({ length: 8 }, (_, i) => ellipticalPosition(i * Math.PI / 4)), 325, [
  ["line", 4, 15], ["line", 6, 15],
  ["line", 13, 15], ["line", 14, 15],
  ["line", 13, 16], ["line", 14, 16],
  ["pad", 13, 2, 1], ["pad", 14, 2, 1], ["face", 0, 17],
], ellipticalBase);

export const legacySportMotionCorrections: Record<string, Illustration> = {
  "0640": slam(true),
  "0798": bike,
  "1302": chestPass,
  "1354": slam(false),
  "1473": backward,
  "2331": elliptical,
  "3637": wheelRun,
  "3638": pushToRun,
};
