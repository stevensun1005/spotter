import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

function shift([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function pose(
  body: [Point, Point, Point], arms: [Limb, Limb], legs: [Limb, Limb],
  toes: [Point, Point] = [shift(legs[0][1], 8, 1), shift(legs[1][1], 8, 1)],
): Point[] {
  return [...body, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function draw(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 810): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...attachments], ms, reference: true };
}

const controlledRep = [0, .26, .65, 1, 1, .66, .28];

function plateSissySquat(): Illustration {
  const inclineBench: Props = [
    [74, 133, 112, 133], [109, 132, 143, 88], [111, 135, 146, 90],
    [74, 153, 92, 133], [139, 152, 131, 112], [66, 157, 153, 157],
  ];
  function frame(depth: number): Point[] {
    const hips: Point = [174 + 4 * depth, 101 + 31 * depth];
    const shoulder = shift(hips, 1 + 25 * depth, -44 + 9 * depth);
    const propHand: Point = [141, 89];
    const plate = shift(shoulder, -11, 12);
    const nearFoot: Point = [176, 153 - 14 * depth];
    const farFoot = shift(nearFoot, -12, 2);
    return pose(
      [shift(shoulder, 2 + 12 * depth, -17 + 7 * depth), shoulder, hips],
      [[shift(shoulder, -9, 17), propHand], [shift(shoulder, 3, 25), plate]],
      [[[175 - 26 * depth, 124 + 10 * depth], nearFoot],
        [[164 - 26 * depth, 122 + 10 * depth], farFoot]],
      [[166,156],[154,157]],
    );
  }
  return draw(controlledRep.map(frame), inclineBench, [["plate", 6, -4, -3]], 870);
}

function smithBenchHipThrust(): Illustration {
  const rack: Props = [
    [73, 28, 73, 155], [229, 34, 229, 154], [73, 28, 229, 34],
    [60, 155, 95, 155], [212, 155, 248, 155], [56, 154, 68, 35],
    [208, 155, 223, 39], [85, 118, 135, 118], [91, 118, 91, 153], [129, 118, 129, 153],
    [67, 42, 79, 42], [67, 53, 79, 53], [67, 64, 79, 64], [67, 75, 79, 75],
    [223, 52, 235, 52], [223, 63, 235, 63], [223, 74, 235, 74], [223, 85, 235, 85],
  ];
  const bar: Attachments = [["bar",13,14],["barbell-end",13,0,0],["barbell-end",14,0,0],["pad",2,0,-4]];
  function frame(height: number): Point[] {
    const hips: Point = [153, 133 - 23 * height];
    const shoulder: Point = [111, 109];
    const hand = shift(hips, -6, -4);
    const barHeight = hips[1] - 4;
    return [
      ...pose(
        [[96,104], shoulder, hips],
        [[[124,117], hand], [[124,109],shift(hand,24,-1)]],
        [[[185,114-6*height],[202,153]],[[174,109-4*height],[189,151]]],
      ),
      [73,barHeight], [229,barHeight],
    ];
  }
  return draw(controlledRep.map(frame), rack, bar, 820);
}

function assistedPress(raisedSideStep: boolean): Illustration {
  const machine: Props = raisedSideStep ? [
    [209,154,211,52], [211,52,203,38], [203,38,161,31], [215,154,220,52], [220,52,212,38],
    [203,153,248,153], [195,79,174,78], [122,133,157,133], [119,154,227,154], [153,152,157,132],
    [205,152,195,84], [148,78,205,78], [184,133,197,133],
  ] : [
    [204,41,204,155], [225,41,225,155], [204,41,225,41], [195,155,245,155],
    [192,79,146,79], [204,70,146,70], [205,96,205,146], [214,96,214,146],
    [166,151,235,151], [211,113,225,113], [211,123,225,123], [211,133,225,133],
  ];
  const movingStep: Attachments = [["bar",13,14]];
  function frame(push: number): Point[] {
    const hip: Point = [125, 98];
    const shoulder: Point = [134, 59 + 2 * push];
    const gripY = raisedSideStep ? 77 : 80;
    const supportY = raisedSideStep ? 131 : 153;
    const stageY = (raisedSideStep ? 106 : 104) + 39 * push;
    const workingFoot: Point = [163, stageY-3];
    const supportFoot: Point = [120, supportY];
    return [
      ...pose(
        [shift(shoulder, 4, -17), shoulder, hip],
        [[[149,83],[165,gripY]],[[145,78],[156,gripY-4]]],
        [[[155 - 10 * push, 83 + 32 * push], workingFoot],
          [[122, (hip[1] + supportY) / 2],supportFoot]],
      ),
      [153,stageY],[197,stageY],
    ];
  }
  return draw(controlledRep.map(frame), machine, movingStep, 815);
}

function twinPadAdductionThrust(): Illustration {
  const station: Props = [
    [75,71,75,156], [90,72,90,154], [75,71,89,67], [72,155,214,155],
    [85,122,132,155], [82,135,113,135], [82,144,108,144],
    [105,117,119,92], [119,92,143,95], [125,150,148,126], [147,126,186,134],
  ];
  const pads: Attachments = [["bar",13,14],["bar",15,16],["pad",13,0,0],["pad",15,0,0]];
  function frame(thrust: number): Point[] {
    const hips: Point = [183 - 13 * thrust, 116 - 16 * thrust];
    const shoulder: Point = [143 + 18 * thrust, 90 - 28 * thrust];
    const nearKnee: Point = [172 - 4 * thrust, 132];
    const farKnee: Point = [186 - 11 * thrust, 128];
    return [
      ...pose(
        [shift(shoulder,-10,-15),shoulder,hips],
        [[[132,100-10*thrust],[119,89]],[[126,92-8*thrust],[116,82]]],
        [[nearKnee,[190,149]],[farKnee,[204-7*thrust,142]]],
      ),
      shift(nearKnee,-3,4), [186,146], shift(farKnee,-2,3), [204-7*thrust,140],
    ];
  }
  return draw(controlledRep.map(frame), station, pads, 855);
}

function floorTwistPress(): Illustration {
  function frame(side: number, press: number): Point[] {
    const hips: Point = [153 + 2 * side, 147];
    const shoulder: Point = [104, 144];
    const nearHand: Point = [112, 114 - 41 * press];
    const farHand: Point = [133, 104 - 41 * press];
    const foot: Point = [223 + 7 * side, 107 + 17 * Math.abs(side)];
    return pose(
      [[85,143],shoulder,hips],
      [[[92 + 15 * press,147 - 47 * press],nearHand],
        [[117 + 14 * press,140 - 49 * press],farHand]],
      [[[185+5*side,126+7*Math.abs(side)],foot],
        [[183+5*side,122+7*Math.abs(side)],shift(foot,4,-5)]],
      [shift(foot,3,-8),shift(foot,7,-12)],
    );
  }
  return draw([
    frame(-1,1), frame(0,1), frame(1,1), frame(0,1), frame(0,0), frame(0,0), frame(0,1),
  ], [], [["bar",4,6],["barbell-end",4,-5,2],["barbell-end",6,5,-2]], 750);
}

function figureFourSquat(): Illustration {
  function frame(depth: number) {
    const hips: Point = [164+6*depth, 97+30*depth];
    const shoulder = shift(hips, -6-12*depth, -43+6*depth);
    const supportKnee: Point = [159-8*depth, 127+10*depth];
    const crossedAnkle = shift(supportKnee, -1, -9);
    return pose(
      [shift(shoulder, -5, -15), shoulder, hips],
      [[shift(shoulder,-24,5),shift(shoulder,-47,11)],
        [shift(shoulder,-19,13),shift(shoulder,-37,17)]],
      [[supportKnee,[158,153]],[[136-10*depth,115+10*depth],crossedAnkle]],
      [[149,156],shift(crossedAnkle,6,2)],
    );
  }
  return draw(controlledRep.map(frame), [], [], 850);
}

function landmineShoulderSquat(): Illustration {
  const anchor: Props = [[246,137,272,137],[250,134,266,134],[258,132,258,138]];
  const shaft: Attachments = [["bar",13,258,132],["plate",13,7,0]];
  function frame(depth: number): Point[] {
    const tipY = 44 + 39 * depth;
    const shaftLength = 123;
    const tipX = 258 - Math.sqrt(shaftLength ** 2 - (132 - tipY) ** 2);
    const shoulder: Point = [tipX - 9, tipY + 7];
    const hips = shift(shoulder, -20 + 17 * depth, 41);
    const nearHand = shift(shoulder, -2, -5);
    const farHand = shift(shoulder, 4, -11);
    return [
      ...pose(
        [shift(shoulder,-5,-16),shoulder,hips],
        [[shift(shoulder,-26,3),nearHand],[shift(shoulder,13,17),farHand]],
        [[[135-14*depth,119+6*depth],[132,153]],[[151-14*depth,118+6*depth],[155,149]]],
        [[124,156],[146,151]],
      ),
      [tipX, tipY],
    ];
  }
  return draw(controlledRep.map(frame), anchor, shaft, 790);
}

function sledSidePress(): Illustration {
  const rail: Props = [
    [130,150,250,62],[143,151,256,67],[130,150,253,151],[250,62,256,152],
    [248,76,212,149],[73,107,130,150],[73,111,130,154],[83,110,81,145],
    [63,154,127,154],[67,150,106,147],[84,132,92,151],
  ];
  const sled: Attachments = [["bar",13,14],["bar",13,15],["bar",14,15],["plate",15,0,0]];
  function frame(press: number): Point[] {
    const hips: Point = [128, 139];
    const shoulder: Point = [98, 108];
    const activeFoot: Point = [178+25*press, 103-17*press];
    const activeToe = shift(activeFoot, 2, -8);
    return [
      ...pose(
        [[87,96],shoulder,hips],
        [[[108,123],[128,145]],[[111,117],[134,142]]],
        [[[142 + 25 * press,104-9*press],activeFoot],[[148,127],[156,145]]],
        [activeToe,[164,143]],
      ),
      shift(activeFoot,4,8),shift(activeFoot,-9,-22),shift(activeFoot,16,-14),
    ];
  }
  return draw(controlledRep.map(frame), rail, sled, 850);
}

export const specializedLowerMachineIllustrations: Readonly<Record<string, Illustration>> = {
  "0851": plateSissySquat(),
  "0885": smithBenchHipThrust(),
  "1027": assistedPress(true),
  "2747": twinPadAdductionThrust(),
  "2749": assistedPress(false),
  "2811": floorTwistPress(),
  "3365": figureFourSquat(),
  "5628": landmineShoulderSquat(),
  "8660": sledSidePress(),
};
