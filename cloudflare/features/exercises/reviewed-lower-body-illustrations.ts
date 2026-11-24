import type { Illustration, Point } from "./motion-data";
import { catalogueIllustrations } from "./catalogue-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];

function offset([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function around(origin: Point, degrees: number, distance: number): Point {
  const angle = degrees * Math.PI / 180;
  return offset(origin, Math.sin(angle) * distance, -Math.cos(angle) * distance);
}

function demonstration(frames: Point[][], props: Props, attachments: Attachments = [], ms = 850): Illustration {
  return { frames, props, ms, reference: true, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...attachments] };
}

function bench(x: number, y: number, width: number): Props {
  return [[x, y, x + width, y], [x + 5, y, x + 5, 158], [x + width - 5, y, x + width - 5, 158]];
}

function tibialisRaise(): Illustration {
  const props: Props = [
    [216, 155, 238, 155], [223, 154, 223, 86], [212, 85, 234, 85], [217, 158, 231, 158],
  ];
  const make = (lift: boolean): Point[] => [
    [144, 46], [146, 65], [143, 103], [169, 84], [214, 85], [138, 88], [134, 113],
    [160, 128], [171, 155], [141, 129], [139, 156], [lift ? 184 : 187, lift ? 140 : 157], [150, 157],
  ];
  return demonstration([make(false), make(true), make(true)], props, [["band", 11, 219, 154]]);
}

function proneCurl(alternating: boolean): Illustration {
  const props: Props = [
    ...bench(82, 110, 81), [161, 108, 161, 157], [157, 108, 165, 108], [71, 158, 211, 158],
    [65, 120, 80, 120], [75, 120, 93, 146],
  ];
  const knee: Point = [161, 109];
  const farKnee: Point = [157, 110];
  const frame = (angle: number, nearAngle = angle, farAngle = angle): Point[] => {
    const near = around(knee, nearAngle, 35);
    const far = around(farKnee, farAngle, 35);
    const roller = around(knee, angle - 9, 34);
    return [
      [77, 98], [91, 100], [128, 103], [88, 116], [68, 119], [96, 112], [77, 120],
      knee, near, farKnee, far, around(near, nearAngle + 105, 10), around(far, farAngle + 105, 10),
      roller, around(knee, angle + 14, 30),
    ];
  };
  const rest = frame(104);
  const curl = frame(-28);
  const frames = alternating
    ? [rest, frame(53), curl, frame(-28, -28, -56), frame(38, 38, -56), frame(104, 104, -56), rest,
      frame(53), curl, frame(-28, -57, -28), frame(38, -57, 38), frame(104, -57, 104)]
    : [frame(104, 104, 111), frame(54, 54, 111), frame(-28, -28, 111), frame(-28, -28, 111), frame(54, 54, 111)];
  return demonstration(frames, props, [["bar", 13, 161, 108], ["pad", 13, -2, 0], ["bar", 13, 14], ["barbell-end", 14, 0, 0]]);
}

function nordic(support: "above-bench" | "floor-bench" | "roller"): Illustration {
  const raised = support === "above-bench";
  const base = raised ? 119 : 157;
  const foot: Point = [94, base - 4];
  const knee: Point = [137, base - 4];
  const props: Props = support === "roller"
    ? [[82, 157, 155, 157], [84, 141, 84, 158], [82, 146, 101, 146]]
    : [...bench(raised ? 82 : 59, raised ? 119 : 138, raised ? 78 : 49), [87, base - 12, 102, base - 12]];
  if (!raised) props.push([120, 157, 154, 157]);
  const make = (degrees: number, useHands = false): Point[] => {
    const hip = around(knee, degrees, 33);
    const shoulder = around(knee, degrees, 70);
    const arm: Pair = useHands
      ? [offset(shoulder, 8, 14), [shoulder[0] + 4, 157]]
      : [offset(shoulder, 14, 17), offset(shoulder, 24, 8)];
    const farArm: Pair = useHands
      ? [offset(shoulder, -2, 15), [shoulder[0] - 9, 156]]
      : [offset(shoulder, 3, 16), offset(shoulder, 15, 8)];
    return [
      around(knee, degrees, 85), shoulder, hip, ...arm, ...farArm, knee, foot,
      offset(knee, -6, -1), offset(foot, -5, -1), offset(foot, -8, 3), offset(foot, -12, 2),
    ];
  };
  return demonstration([make(3), make(36), make(raised ? 77 : 74, !raised), make(37)], props, [], 950);
}

function seatedLegCurl(): Illustration {
  const fixture: Props = [
    ...bench(97, 112, 68), [96, 67, 110, 110], [104, 115, 160, 115],
    [164, 107, 166, 157], [82, 158, 209, 158], [137, 99, 162, 99],
    [174, 109, 174, 155], [178, 105, 189, 105], [189, 105, 189, 156],
  ];
  const knee: Point = [167, 108];
  const farKnee = offset(knee, -5, 3);
  const make = (angle: number): Point[] => {
    const ankle = around(knee, angle, 39);
    const farAnkle = around(farKnee, angle, 39);
    const roller = around(knee, angle + 9, 32);
    return [
      [92, 51], [99, 68], [115, 104], [121, 89], [149, 99], [112, 88], [141, 98],
      knee, ankle, farKnee, farAnkle, around(ankle, angle - 71, 10), around(farAnkle, angle - 71, 10),
      roller, around(knee, angle + 31, 20),
    ];
  };
  return demonstration([make(99), make(144), make(218), make(218), make(145)], fixture,
    [["bar", 13, 167, 108], ["pad", 13, -1, 0], ["bar", 13, 14], ["barbell-end", 14, 0, 0]], 810);
}

function seatedCalfRaise(machine: "smith" | "plate"): Illustration {
  const smith = machine === "smith";
  const fixture: Props = [
    ...bench(89, 121, 57), [156, 147, 205, 147], [157, 147, 157, 158], [205, 147, 205, 158],
  ];
  if (smith) {
    fixture.push([72, 27, 72, 158], [218, 27, 218, 158], [81, 37, 81, 152], [209, 37, 209, 152],
      [72, 27, 218, 27], [68, 158, 223, 158]);
  } else {
    fixture.push([222, 103, 222, 158], [217, 106, 235, 106], [216, 158, 238, 158], [147, 157, 223, 157]);
  }
  const make = (lift: boolean): Point[] => {
    const y = lift ? 99 : 111;
    return [
      [104, 57], [108, 72], [114, 115], [130, 92], [155, y - 11], [123, 96], [143, y - 11],
      [170, y], [lift ? 168 : 160, lift ? 132 : 152], [162, y + 2], [lift ? 159 : 152, lift ? 133 : 151],
      [182, 145], [172, 145], [156, y - 10], [181, y - 6], [81, y - 10], [209, y - 10],
    ];
  };
  const apparatus: Attachments = smith
    ? [["bar", 15, 16], ["pad", 13, 0, 0], ["barbell-end", 15, 8, 0], ["barbell-end", 16, -8, 0]]
    : [["bar", 13, 222, 106], ["pad", 13, 0, 0], ["barbell-end", 14, 0, 0]];
  return demonstration([make(false), make(true), make(true)], fixture, apparatus);
}

function legPressCalf(sled: boolean): Illustration {
  const fixture: Props = [
    [74, 97, 115, 139], [114, 139, 144, 136], [119, 138, 119, 158], [82, 158, 249, 158], [132, 122, 153, 117],
  ];
  if (sled) fixture.push([131, 143, 253, 46], [137, 151, 259, 54], [253, 46, 253, 158], [260, 54, 260, 158]);
  else fixture.push([243, 26, 243, 158], [234, 27, 256, 27], [238, 158, 261, 158], [233, 53, 252, 53]);
  const make = (phase: "setup" | "lower" | "raise"): Point[] => {
    const setup = phase === "setup";
    const raised = phase === "raise";
    const toe: Point = setup ? [186, 102] : raised ? [216, 80] : [207, 87];
    const heel: Point = offset(toe, raised ? -12 : -3, raised ? 8 : 12);
    const farToe = offset(toe, 2, 3);
    return [
      [72, 86], [84, 103], [118, 129], [98, 126], [138, 121], [92, 127], [130, 127],
      [setup ? 148 : 162, setup ? 105 : raised ? 109 : 114], heel,
      [setup ? 143 : 156, setup ? 109 : raised ? 114 : 119], offset(heel, -4, 4), toe, farToe,
      offset(toe, -7, -11), offset(toe, 11, 16), offset(toe, 11, 16), offset(toe, -5, -7),
    ];
  };
  const apparatus: Attachments = [["bar", 13, 14], ["bar", 15, 16], ["barbell-end", 15, 9, -8]];
  if (!sled) apparatus.push(["bar", 15, 243, 53]);
  const frames = sled
    ? [make("setup"), make("lower"), make("raise"), make("raise"), make("lower")]
    : [make("lower"), make("raise"), make("raise")];
  return demonstration(frames, fixture, apparatus);
}

function donkeyCalfMachine(): Illustration {
  const props: Props = [
    [124, 144, 156, 144], [124, 144, 124, 158], [155, 144, 155, 158], [88, 158, 251, 158],
    [231, 49, 231, 158], [221, 49, 241, 49], [224, 60, 238, 60], [201, 104, 232, 104],
    [215, 104, 215, 146], [196, 112, 211, 112],
  ];
  const make = (rise: boolean): Point[] => {
    const origin = rise ? -9 : 0;
    return [
      [191, 75 + origin], [176, 87 + origin], [129, 90 + origin],
      [194, 105], [211, 103], [183, 103], [204, 105],
      [123, 119 + origin], [114 + (rise ? 3 : 0), rise ? 136 : 151],
      [133, 119 + origin], [121 + (rise ? 3 : 0), rise ? 134 : 149],
      [130, 143], [136, 143], [131, 79 + origin], [210, 48 + origin], [131, 61 + origin],
    ];
  };
  return demonstration([make(false), make(true), make(true)], props,
    [["bar", 15, 231, 49], ["bar", 13, 15], ["pad", 13, 0, 3], ["barbell-end", 14, 0, 0]]);
}

function kneelingLegCurl(): Illustration {
  const knee: Point = [141, 125];
  const props: Props = [
    [123, 123, 161, 123], [150, 123, 150, 158], [147, 91, 155, 112],
    [186, 90, 214, 90], [193, 90, 193, 158], [208, 72, 229, 72], [222, 72, 222, 158],
    [141, 125, 147, 157], [124, 158, 246, 158],
  ];
  const make = (angle: number): Point[] => {
    const ankle = around(knee, angle, 29);
    const roller = around(knee, angle + 10, 28);
    return [
      [193, 59], [182, 76], [153, 94], [192, 89], [214, 72], [182, 86], [208, 74],
      knee, ankle, [153, 119], [124, 118], around(ankle, angle + 115, 8), [117, 121],
      roller, around(knee, angle - 15, 23),
    ];
  };
  return demonstration([make(173), make(226), make(297), make(297), make(226)], props,
    [["bar", 13, 141, 125], ["pad", 13, -1, 0], ["bar", 13, 14], ["barbell-end", 14, 0, 0]]);
}

function proneCableCurl(): Illustration {
  const props: Props = [
    ...bench(86, 118, 79), [72, 126, 86, 126], [78, 126, 94, 148],
    [250, 34, 250, 158], [242, 35, 242, 158], [242, 37, 250, 37],
    [236, 158, 258, 158], [242, 146, 251, 146], [241, 125, 252, 125], [241, 131, 252, 131],
  ];
  const knee: Point = [166, 111];
  const farKnee = offset(knee, -5, 1);
  const make = (angle: number): Point[] => {
    const ankle = around(knee, angle, 36), farAnkle = around(farKnee, angle, 36);
    const tether = offset(ankle, 8, 4);
    return [
      [76, 105], [92, 108], [131, 112], [88, 127], [74, 125], [91, 124], [79, 124],
      knee, ankle, farKnee, farAnkle, around(ankle, angle + 108, 9), around(farAnkle, angle + 108, 9), tether,
    ];
  };
  return demonstration([make(100), make(56), make(-28), make(-28), make(50)], props,
    [["cable", 13, 243, 145], ["cable", 8, 13], ["cable", 10, 13], ["ring", 8, 0, 0], ["ring", 10, 0, 0]]);
}

type CalfStyle = "block" | "platform" | "smith-floor" | "dumbbell" | "stairs" | "split" | "suspension" | "pulse";

function controlledCalf(style: CalfStyle): Illustration {
  const smith = style === "block" || style === "platform" || style === "smith-floor";
  const single = style === "dumbbell" || style === "stairs" || style === "smith-floor";
  const step = style === "block" || style === "platform" || style === "stairs";
  const gripping = style === "stairs" || style === "dumbbell" || style === "pulse" || style === "suspension";
  const toeLevel = style === "stairs" ? 139 : step || style === "dumbbell" ? 148 : 157;
  const toe: Point = [176, toeLevel];
  const farToe: Point = style === "split" ? [126, 157] : [166, toeLevel];
  const fixtures: Props = [];
  const handles: Attachments = [];
  if (smith) {
    fixtures.push([107, 22, 107, 158], [210, 22, 210, 158], [117, 31, 117, 151], [200, 31, 200, 151],
      [107, 22, 210, 22], [101, 158, 218, 158]);
    handles.push(["bar", 13, 14], ["barbell-end", 13, 9, 0], ["barbell-end", 14, -9, 0]);
  }
  if (style === "block" || style === "platform") {
    fixtures.push([162, toeLevel + 2, 199, toeLevel + 2], [162, toeLevel + 2, 162, 158], [199, toeLevel + 2, 199, 158]);
  }
  if (style === "platform") fixtures.push([175, 155, 192, 155]);
  if (style === "stairs") {
    fixtures.push([115, 157, 146, 157], [146, 157, 146, 151], [146, 151, 172, 151], [172, 151, 172, 140],
      [172, 140, 193, 140], [193, 140, 193, 126], [193, 126, 214, 126], [214, 126, 214, 113], [214, 113, 236, 113],
      [142, 102, 235, 58], [180, 84, 180, 140], [222, 64, 222, 113]);
  }
  if (style === "pulse" || style === "dumbbell") {
    fixtures.push([206, 82, 206, 158], [195, 82, 222, 82], [197, 157, 216, 157]);
  }
  if (style === "dumbbell") handles.push(["circus-dumbbell", 15, 0, 0]);
  if (style === "suspension") {
    fixtures.push([245, 24, 265, 24], [253, 15, 253, 23]);
    handles.push(["line", 4, 252, 24], ["line", 6, 252, 24], ["ring", 4, 0, -1], ["ring", 6, 0, -1]);
  }
  const make = (rise: number): Point[] => {
    const shoulderY = toeLevel - (style === "stairs" ? 93 : 99) - rise * 9;
    const hipY = shoulderY + 41;
    const hand: Point = style === "stairs" ? [196, 77] : style === "suspension" ? [206, 93] : [206, 82];
    const nearArm: Pair = smith ? [[166, shoulderY + 18], [145, shoulderY - 3]]
      : gripping ? [[177, shoulderY + 21], hand] : [[171, shoulderY + 23], [171, shoulderY + 42]];
    const farArm: Pair = smith ? [[136, shoulderY + 16], [127, shoulderY - 3]]
      : style === "suspension" ? [[158, shoulderY + 23], [194, 96]] : [[149, shoulderY + 22], [144, shoulderY + 42]];
    const heel = (foot: Point): Point => [foot[0] - 13 + 3 * rise, foot[1] + (step ? 6 : 0) - 12 * rise];
    return [
      [146, shoulderY - 17], [149, shoulderY], [153, hipY], ...nearArm, ...farArm,
      [162, hipY + 30], heel(toe), single ? [142, hipY + 29] : style === "split" ? [135, hipY + 27] : [152, hipY + 28],
      single ? [121, hipY + 24] : style === "split" ? [114, 141] : heel(farToe),
      toe, single ? [114, hipY + 30] : farToe, [117, shoulderY - 3], [200, shoulderY - 3], [173, 151],
    ];
  };
  return demonstration((style === "pulse" ? [0, 1, .72, 1, .72, 1, 0] : [0, 1, 1]).map(make), fixtures, handles,
    style === "pulse" ? 690 : 870);
}

export const reviewedLowerBodyIllustrations: Readonly<Record<string, Illustration>> = {
  "0496": nordic("above-bench"),
  "0582": kneelingLegCurl(),
  "0599": seatedLegCurl(),
  "0696": nordic("floor-bench"),
  "0697": nordic("roller"),
  "0727": controlledCalf("dumbbell"),
  "1000": tibialisRaise(),
  "1050": controlledCalf("block"),
  "1154": controlledCalf("suspension"),
  "1164": controlledCalf("platform"),
  "1253": donkeyCalfMachine(),
  "1385": legPressCalf(false),
  "1391": legPressCalf(true),
  "1393": controlledCalf("smith-floor"),
  "1590": proneCurl(false),
  "2666": seatedCalfRaise("plate"),
  "3007": catalogueIllustrations["0926"],
  "3195": proneCurl(true),
  "3235": proneCableCurl(),
  "3534": controlledCalf("pulse"),
  "3667": catalogueIllustrations["5998"],
  "4370": seatedCalfRaise("smith"),
  "5003": controlledCalf("stairs"),
  "10819": controlledCalf("split"),
};
