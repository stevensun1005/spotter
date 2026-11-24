import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

function shift([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function pose(
  head: Point, shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb,
  nearLeg: Limb, farLeg: Limb, nearToe = shift(nearLeg[1], 8, 1), farToe = shift(farLeg[1], 8, 1),
): Point[] {
  return [head, shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, nearToe, farToe];
}

function draw(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 820): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...attachments], ms, reference: true };
}

function jefferson(load: "bodyweight" | "barbell" | "dumbbells"): Illustration {
  const footY = 137;
  const step: Props = [[115,140,166,140],[120,141,116,156],[166,140,173,156],[116,156,173,156]];
  const weights: Attachments = load === "barbell"
    ? [["bar",4,6],["barbell-end",4,-4,-2],["barbell-end",6,4,2]]
    : load === "dumbbells" ? [["dumbbell",4,0,0],["dumbbell",6,0,0]] : [];

  function frame(depth: number): Point[] {
    const hip: Point = [145 - 14 * depth, footY - 60];
    const middleBack: Point = shift(hip, 11 * depth, -34 + 18 * depth);
    const lowerBack: Point = shift(hip, 2 * depth, -18);
    const shoulder: Point = shift(hip, 42 * depth, -44 + 75 * depth);
    const head = shift(shoulder, 13 * depth, -17 + 31 * depth);
    const nearElbow = shift(shoulder, 2, 17);
    const nearHand = shift(nearElbow, -1 + 3 * depth, 19);
    const farElbow = shift(nearElbow, 8, -3);
    const farHand = shift(nearHand, 9, -3);
    return [
      ...pose(head, shoulder, hip, [nearElbow, nearHand], [farElbow, farHand],
        [[146, footY-29], [143, footY]], [[138, footY-30], [135, footY-1]]),
      middleBack, lowerBack,
    ];
  }
  return { ...draw([0, .22, .65, 1, 1, .62, .22].map(frame), step, weights, 820), spine: [13, 14] };
}

function squatPulse(cable: boolean): Illustration {
  const tower: Props = cable ? [
    [217, 39, 271, 39], [217, 38, 219, 156], [265, 38, 266, 155], [207, 156, 275, 156],
    [244, 55, 244, 139], [255, 55, 255, 139], [240, 122, 262, 122], [240, 129, 262, 129],
    [240, 136, 262, 136], [212, 146, 228, 146],
  ] : [];
  const attachments: Attachments = cable ? [["knee-band",7,9],["cable",4,218,145],["cable",6,218,145]] : [];
  function frame(depth: number): Point[] {
    const hip: Point = [142-10*depth, 91+44*depth];
    const shoulder = shift(hip, 1+9*depth, -43+3*depth);
    const grip = shift(shoulder, cable ? 17 : 15, 5);
    return pose(shift(shoulder, 4, -17), shoulder, hip,
      [shift(shoulder,-9,21), grip], [shift(shoulder,17,20), shift(grip,4,2)],
      [[114-2*depth,119+9*depth],[114,154]],
      [[171+4*depth,116+11*depth],[165,150]], [105,156], [176,151]);
  }
  const phases = cable ? [1,.68,.24,0,0,.43,.81] : [1,.81,.69,.64,.73,.88];
  return draw(phases.map(frame), tower, attachments, cable ? 740 : 610);
}

function rollingPlank(): Illustration {
  const leftAnkle: Point = [85, 147];
  const rightAnkle: Point = [92, 149];
  function frame(side: -1 | 0 | 1): Point[] {
    const hip: Point = [149, side ? 118 : 119];
    const shoulder: Point = [208 + side * 5, side ? 98 : 112];
    const support: Limb = [[211,153], [237,154]];
    const backSupport: Limb = [[202,151], [231,152]];
    const waist: Limb = [[180,83], [151,105]];
    return pose(shift(shoulder,16,side ? -6 : 3), shoulder, hip,
      side === -1 ? waist : support, side === 1 ? waist : backSupport,
      [[115,134],side === -1 ? rightAnkle : leftAnkle], [[123,136],side === -1 ? leftAnkle : rightAnkle],
      side === -1 ? [91,156] : [85,157], side === -1 ? [85,157] : [91,156]);
  }
  return draw([frame(0),frame(1),frame(1),frame(0),frame(-1),frame(-1)], [], [], 860);
}

function handSideBridge(): Illustration {
  function frame(lift: number) {
    const shoulder: Point=[207,101];
    const hip: Point=[150,131-8*lift];
    return pose([224,90],shoulder,hip,[[205,131],[207,155]],[[180,87],[165,118-5*lift]],
      [[129,119-8*lift],[104,140-4*lift]],[[114,137],[79,153]],[96,139-4*lift],[69,157]);
  }
  return draw([frame(0),frame(1),frame(1),frame(1),frame(1)],[],[],1100);
}

function oldSchoolBarbellExtension(): Illustration {
  const bench: Props = [[91,119,220,119],[105,120,106,155],[210,120,208,155],[94,156,222,156]];
  const weights: Attachments = [["bar",4,6],["barbell-end",4,4,2],["barbell-end",6,-4,-2]];
  function frame(lift: number) {
    const grip: Point = [250-56*lift,136-87*lift];
    const elbow: Point = [244-47*lift,104-29*lift];
    return pose([212,105],[193,107],[130,109],
      [elbow,grip],[shift(elbow,-4,-4),shift(grip,-6,-5)],
      [[105,118],[101,153]],[[93,120],[86,151]],[92,156],[77,154]);
  }
  return draw([1,.75,.36,0,0,.38,.76].map(frame),bench,weights,720);
}

function standingGluteLever(): Illustration {
  const machine: Props = [
    [76,81,76,139],[76,81,107,67],[89,70,89,151],[68,156,261,156],[119,142,151,142],
    [94,139,112,139],[94,130,112,130],[94,120,112,120],[94,111,112,111],[94,102,112,102],
    [110,66,132,66],[105,69,105,87],[97,156,104,142],[150,156,151,142],
  ];
  const lever: Attachments = [["bar",13,129,151],["pad",13,0,0]];
  function frame(press: number) {
    const mover: Point = [160+54*press,139+3*press];
    return [
      ...pose([126,42],[133,61],[149,103],[[146,78],[116,75]],[[133,80],[107,77]],
        [[136+47*press,124+2*press],mover],[[147,122],[139,140]],
        shift(mover,-8,2),[129,142]),
      shift(mover,-4,4),
    ];
  }
  return draw([0,.32,.73,1,1,.67,.28].map(frame),machine,lever,780);
}

function kneelingThrust(): Illustration {
  const support: Props = [[58,121,106,121],[87,122,87,155],[66,156,110,156]];
  const band: Attachments = [["band",2,87,143],["band",13,89,147]];
  function frame(thrust: number) {
    const hip: Point = [135+24*thrust,132-16*thrust];
    const shoulder = shift(hip, 19-12*thrust, -33-4*thrust);
    return [
      ...pose(shift(shoulder,7,-16),shoulder,hip,
        [shift(shoulder,20,15),shift(shoulder,17,2)],[shift(shoulder,13,20),shift(shoulder,10,5)],
        [[161,153],[128,151]],[[153,149],[122,148]],[121,154],[116,152]),
      shift(hip,-3,4),
    ];
  }
  return draw([0,.3,.7,1,1,.63,.3].map(frame), support, band, 770);
}


function reverseHackHinge(): Illustration {
  const frame: Props = [
    [67,151,116,156],[116,156,224,143],[224,143,232,156],[66,151,63,113],[63,113,106,124],
    [102,88,130,146],[91,91,118,144],[113,139,214,132],[113,144,214,137],[115,142,107,157],
    [205,134,214,154],[155,137,150,127],[152,128,196,124],[196,124,201,132],
  ];
  const handles: Attachments = [
    ["bar",13,98,100],["bar",14,101,102],["pad",1,-2,-3],["plate",15,0,0],
    ["pad",4,0,-2],["pad",6,0,-2],
  ];
  function make(depth: number): Point[] {
    const shoulder: Point = [127-4*depth,67+18*depth];
    const hip: Point = [152+12*depth,103+2*depth];
    const movingKnee: Point = [184+28*depth,119-6*depth];
    const movingFoot: Point = [193+53*depth,116-1*depth];
    const arm: Limb = [shift(shoulder,-15,10), shift(shoulder,-25,-9)];
    const backArm: Limb = [shift(arm[0],-5,-2),shift(arm[1],-4,-3)];
    return [
      ...pose(shift(shoulder,-7,-15),shoulder,hip,arm,backArm,
        [[158-8*depth,112+3*depth],[170,127]],[movingKnee,movingFoot],
        [162,131],shift(movingFoot,-1,8)),
      shift(shoulder,6,-5),shift(shoulder,12,-9),[96,102+3*depth],
    ];
  }
  return draw([0,.28,.67,1,1,.66,.28].map(make),frame,handles,820);
}

function supineBandedAbduction(): Illustration {
  function frame(width: number) {
    const hips: Point = [151,145];
    const nearKnee: Point = [149-18*width,111+3*width];
    const farKnee: Point = [157+18*width,107+3*width];
    const nearAnkle: Point = [148-27*width,78+9*width];
    const farAnkle: Point = [157+27*width,75+9*width];
    return pose([231,145],[210,146],hips,[[182,152],[156,154]],[[187,144],[161,146]],
      [nearKnee,nearAnkle],[farKnee,farAnkle],shift(nearAnkle,7,-2),shift(farAnkle,7,-2));
  }
  return draw([0,.35,.70,1,1,.65,.28].map(frame),[],[["band",8,10]],820);
}

export const verifiedLowerEdgeIllustrations: Readonly<Record<string, Illustration>> = {
  "0461": squatPulse(false),
  "0679": rollingPlank(),
  "0701": handSideBridge(),
  "3857": squatPulse(true),
  "5241": oldSchoolBarbellExtension(),
  "6601": standingGluteLever(),
  "7277": kneelingThrust(),
  "3236": kneelingThrust(),
  "7329": jefferson("dumbbells"),
  "10752": jefferson("bodyweight"),
  "10857": jefferson("barbell"),
  "8799": reverseHackHinge(),
  "10899": supineBandedAbduction(),
};
