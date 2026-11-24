
import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

const floor = 155;
const shift = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const leg = (knee: Point, ankle: Point): Limb => [knee, ankle];

function person(shoulder: Point, hip: Point, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb,
  toes: [Point, Point] = [shift(nearLeg[1], 9, 1), shift(farLeg[1], 8, 1)]): Point[] {
  return [shift(shoulder, 4, -14), shoulder, hip, ...nearArm, ...farArm, ...nearLeg, ...farLeg, ...toes];
}

function demo(frames: Point[][], props: Props = [], extra: Attachments = [], ms = 700): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...extra], ms, reference: true };
}

type March = "plain" | "raise" | "tap" | "twist" | "air-bike" | "overhead" | "pool";
function march(kind: March) {
  const pool = kind === "pool", twist = kind === "twist" || kind === "air-bike";
  const armsOverhead = kind === "overhead" || kind === "raise";
  const props: Props = pool ? [[60, 62, 101, 62], [108, 62, 150, 62], [157, 62, 200, 62], [207, 62, 232, 62],
    [232, 46, 288, 46], [232, 46, 232, 158], [238, 51, 287, 51], [63, 154, 231, 154]] : [];

  function at(side: number, lowered = true): Point[] {
    const active = Math.abs(side), sway = twist ? 5 * side : 0;
    const shoulder: Point = [150 + sway, 53 + (twist ? (kind === "air-bike" ? 5 : 9) * active : 0)], hip: Point = [149, 93];
    const nearLift = side > 0, farLift = side < 0;
    const knees: [Point, Point] = [
      nearLift ? [177, 88] : [153, 124],
      farLift ? [173, 87] : [141, 123],
    ];
    const nearLeg = leg(knees[0], nearLift ? [169, 116] : [155, floor]);
    const farLeg = leg(knees[1], farLift ? [169, 115] : [142, floor]);

    let arms: [Limb, Limb] = [
      [[164 - 9 * side, 76], [181 - 15 * side, 66]],
      [[154 + 14 * side, 77], [168 + 18 * side, 67]],
    ];
    if (pool) {
      arms = [[[189, 58], [230, 45]], [[181, 63], [232, 49]]];
    } else if (twist) {
      arms = [
        [farLift ? shift(knees[1], -2, -3) : shift(shoulder, 24, 0), shift(shoulder, 7, -13)],
        [nearLift ? shift(knees[0], -2, -3) : shift(shoulder, -18, 0), shift(shoulder, -3, -13)],
      ];
    } else if (kind === "tap") {
      arms = [[[171, 78], [179, 86]], [[163, 77], [173, 86]]];
    } else if (armsOverhead) {
      arms = kind === "overhead" || !lowered
        ? [[[157, 30], [160, 13]], [[140, 30], [140, 15]]]
        : [[[167, 78], [171, 99]], [[133, 77], [128, 99]]];
    }
    const toes: [Point, Point] = [shift(nearLeg[1], 10, nearLift ? 4 : 1), shift(farLeg[1], 8, farLift ? 4 : 1)];
    const frame = person(shoulder, hip, ...arms, nearLeg, farLeg, toes);
    return kind === "overhead" ? [...frame, [150, 12]] : frame;
  }

  const cycle = kind === "raise" ? [at(0), at(1, false), at(0), at(-1, false)] : [at(0), at(1), at(0), at(-1)];
  return demo(cycle, props, kind === "overhead" ? [["bar", 4, 6], ["plate", 13, 0, -5]] : [],
    kind === "tap" || kind === "twist" ? 530 : 710);
}

function kneeToButt(supported: boolean) {
  const props: Props = supported ? [[227, 61, 227, 158], [215, 61, 240, 61], [218, 158, 240, 158]] : [];
  const shoulder: Point = [151, 51], hip: Point = [150, 92];

  function at(side: number, phase: "lift" | "down" | "kick"): Point[] {
    const base: [Limb, Limb] = [[[154, 124], [153, floor]], [[146, 124], [145, floor]]];
    const work: Limb = phase === "lift" ? [[181, 89], [178, 120]] : [[143, 121], [121, 107]];
    if (phase !== "down") base[side] = work;
    const arms: [Limb, Limb] = supported ? [[[177, 60], [226, 62]], [[140, 73], [138, 92]]]
      : [[[166, 73], [184, phase === "kick" ? 80 : 65]], [[137, 73], [132, 85]]];
    const toes: [Point, Point] = [shift(base[0][1], phase === "kick" && side === 0 ? -2 : 8, 2),
      shift(base[1][1], phase === "kick" && side === 1 ? -2 : 8, 2)];
    return person(shoulder, hip, ...arms, ...base, toes);
  }
  const first = [at(0, "down"), at(0, "lift"), at(0, "down"), at(0, "kick"), at(0, "down")];
  const second = [at(1, "lift"), at(1, "down"), at(1, "kick")];
  return demo(supported ? first : [...first, ...second], props, [], supported ? 780 : 520);
}

type Side = "out" | "jack" | "speed" | "band";
function sideStep(kind: Side) {
  const low = kind === "speed" || kind === "band";
  const banded = kind === "band";

  function at(x: number, rightX: number, leftX: number, lift: number, work: number): Point[] {
    const y = low ? 14 : 0;
    const shoulder: Point = [x, 50 + y], hip: Point = [x, 87 + y];
    const right: Point = [rightX, floor - (lift > 0 ? 9 : 0)];
    const left: Point = [leftX, floor - (lift < 0 ? 9 : 0)];
    const kneeRight: Point = [(x + right[0]) / 2 + 4, (hip[1] + right[1]) / 2 + (low ? 3 : 0)];
    const kneeLeft: Point = [(x + left[0]) / 2 - 4, (hip[1] + left[1]) / 2 + (low ? 3 : 0)];
    const arms: [Limb, Limb] = kind === "jack"
      ? [[shift(shoulder, 16 + 4 * work, 23 - 39 * work), shift(shoulder, 14 + 5 * Math.sin(work * Math.PI), 42 - 81 * work)],
        [shift(shoulder, -16 - 4 * work, 23 - 39 * work), shift(shoulder, -14 - 5 * Math.sin(work * Math.PI), 42 - 81 * work)]]
      : low ? [[shift(shoulder, 17, 18), shift(shoulder, 25 + lift * 8, 0)],
        [shift(shoulder, -16, 18), shift(shoulder, -22 + lift * 7, 4)]]
        : [[shift(shoulder, 21, 14), shift(shoulder, 9, 9)], [shift(shoulder, -21, 14), shift(shoulder, -11, 9)]];
    const frame = person(shoulder, hip, ...arms, [kneeRight, right], [kneeLeft, left], [shift(right, 8, 0), shift(left, -8, 0)]);
    return banded ? [...frame, shift(kneeRight, -3, -9), shift(kneeLeft, 3, -9)] : frame;
  }

  const middle = at(151, 161, 141, 0, 0);
  const right = [at(154, 175, 141, 1, .5), at(156, 190, 141, 0, 1)];
  const left = [at(148, 161, 127, -1, .5), at(146, 161, 112, 0, 1)];
  const tap = [middle, ...right, right[0], middle, ...left, left[0]];
  const shuffle = [middle, ...right, at(168, 190, 156, -1, 0), at(176, 190, 165, 0, 0),
    at(167, 190, 152, -1, 0), at(157, 190, 141, 0, 0), at(153, 175, 141, 1, 0), middle,
    ...left, at(134, 146, 112, 1, 0), at(126, 137, 112, 0, 0), at(135, 149, 112, 1, 0),
    at(145, 161, 112, 0, 0), at(148, 161, 127, -1, 0)];
  return demo(low ? shuffle : tap, [], banded ? [["knee-band", 13, 14]] : [], low ? 360 : 420);
}

function stepPunch() {
  function at(side: number): Point[] {
    const active = side !== 0;
    const shoulder: Point = [145 + (active ? 13 : 0), 53], hip: Point = [143 + (active ? 13 : 0), 94];
    const near: Limb = [[158 + (side > 0 ? 20 : 0), 124], [163 + (side > 0 ? 32 : 0), floor]];
    const far: Limb = [[132 + (side < 0 ? 43 : 0), 123], [117 + (side < 0 ? 69 : 0), floor]];
    const nearArm: Limb = side > 0 ? [[184, 55], [218, 52]] : [[159, 75], [166, 58]];
    const farArm: Limb = side < 0 ? [[184, 50], [214, 48]] : [[147, 72], [160, 56]];
    return person(shoulder, hip, nearArm, farArm, near, far);
  }
  const ready = at(0);
  const punch = (side: number) => {
    const landed = at(side);
    const lifted = ready.map(([x, y], i): Point => [(x + landed[i][0]) / 2, (y + landed[i][1]) / 2]);
    const foot = side > 0 ? 8 : 10, toe = side > 0 ? 11 : 12;
    lifted[foot][1] -= 7;
    lifted[toe][1] -= 7;
    return [lifted, landed, lifted];
  };
  return demo([ready, ...punch(1), ready, ...punch(-1)], [], [], 380);
}

const box = (left: number, right: number, height: number): Props =>
  [[left, height, right, height], [left, height, left, 158], [right, height, right, 158], [left, 158, right, 158]];

function stepDown(kind: "patrick" | "poliquin" | "peterson", tall: boolean) {
  const deck = tall ? 127 : 141;
  const wedge = kind === "poliquin", toeOnly = kind === "peterson";
  const props = box(91, 151, deck);
  if (wedge) props.push([115, deck - 11, 146, deck], [115, deck - 11, 115, deck]);
  const toe: Point = [144, deck - 3];
  const heel: Point = [129, deck - (toeOnly ? 14 : wedge ? 8 : 4)];

  function at(depth: number): Point[] {
    const hip: Point = [128 + 7 * depth, deck - 59 + depth * (tall ? 24 : 16)];
    const shoulder: Point = shift(hip, 4 + depth * 3, -34);
    const knee: Point = [131 + 26 * depth, deck - 34 + depth * 12];
    const reach: Limb = [[151 + depth * 9, 109 + depth * 17], [177, floor - 13 + depth * 13]];
    return person(shoulder, hip, [[147, shoulder[1] + 18], [160, shoulder[1] + 6]],
      [[126, shoulder[1] + 17], [145, shoulder[1] + 9]], [knee, heel], reach, [toe, [186, reach[1][1] - 5]]);
  }
  return demo([at(0), at(.45), at(1), at(1), at(.45)], props, [], 780);
}

function advanceBox(press: boolean) {
  const deck = 125;
  const props = box(132, 187, deck);
  const steps = [
    { spine: 101, hip: 88, near: [107, floor], far: [93, floor] },
    { spine: 122, hip: 90, near: [145, deck - 4], far: [101, floor] },
    { spine: 151, hip: 56, near: [145, deck - 4], far: [171, deck - 4] },
    { spine: 181, hip: 90, near: [145, deck - 4], far: [198, floor] },
    { spine: 208, hip: 91, near: [215, floor], far: [198, floor] },
  ];
  const positions = press ? [0, 1, 2, 1, 0] : [0, 1, 2, 3, 4];

  function at(index: number): Point[] {
    const { spine, hip: y, near, far } = steps[index];
    const hip: Point = [spine, y], shoulder = shift(hip, 5, -34);
    const nearLeg = leg([(spine + near[0]) / 2 + (index === 1 || index === 3 ? 13 : 2), (y + near[1]) / 2], near as Point);
    const farLeg = leg([(spine + far[0]) / 2 + (index === 1 ? 2 : 9), (y + far[1]) / 2], far as Point);
    const arms: [Limb, Limb] = press
      ? index === 2 ? [[shift(shoulder, 8, -8), shift(shoulder, 9, -15)],
        [shift(shoulder, -9, -8), shift(shoulder, -9, -15)]]
        : [[shift(shoulder, 12, 16), shift(shoulder, 11, 1)], [shift(shoulder, -9, 17), shift(shoulder, -10, 2)]]
      : [[shift(shoulder, 8, 22), shift(shoulder, 9, 43)], [shift(shoulder, -10, 21), shift(shoulder, -12, 41)]];
    if (index === 2 && press) {
      const liftedHip: Point = [hip[0], 74], liftedShoulder: Point = [shoulder[0], 40];
      const plantedNear = leg([146, 97], nearLeg[1]), plantedFar = leg([165, 97], farLeg[1]);
      return person(liftedShoulder, liftedHip, [shift(liftedShoulder, 9, -16), shift(liftedShoulder, 10, -29)],
        [shift(liftedShoulder, -12, -17), shift(liftedShoulder, -12, -28)], plantedNear, plantedFar);
    }
    return person(shoulder, hip, ...arms, nearLeg, farLeg);
  }

  const original = positions.map(at);
  const alternating = original.map((frame) => {
    const changed = press ? [...frame] : frame.map(([x, y]): Point => [319 - x, y]);
    [changed[7], changed[8], changed[9], changed[10], changed[11], changed[12]] =
      [changed[9], changed[10], changed[7], changed[8], changed[12], changed[11]];
    return changed;
  });
  return demo([...original, ...alternating], props,
    [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]], 730);
}

function kneelSwing() {
  const rearKnee: Point = [133, 152], rearAnkle: Point = [102, 154];
  function at(step: number): Point[] {
    const hip: Point = [135 + 11 * step, 108 - 3 * step], shoulder = shift(hip, 3, -37);
    const near: Limb = step ? [[171, 117], [184, floor]] : [[139, 151], [112, floor]];
    const hands: [Limb, Limb] = [
      [shift(shoulder, 12, 18 - step * 33), shift(shoulder, 18 - step * 7, 33 - step * 70)],
      [shift(shoulder, -2 + step * 5, 19 - step * 34), shift(shoulder, 12 - step * 7, 32 - step * 70)],
    ];
    const frame = person(shoulder, hip, ...hands, near, [rearKnee, rearAnkle],
      [step ? shift(near[1], 9, 1) : shift(near[1], -8, 1), shift(rearAnkle, -7, 1)]);
    return [...frame, shift(hands[1][1], 3, -2)];
  }
  return demo([at(0), at(1), at(1)], [], [["plate", 13, 0, 0]], 960);
}

function carry(bilateral: boolean) {
  const weights: Attachments = [["kettlebell", 4, 0, 8]];
  if (bilateral) weights.push(["kettlebell", 6, 0, 8]);
  function at(side: number, x: number): Point[] {
    const hip: Point = [x, 91], shoulder: Point = [x + 4, 48];
    const nearFoot: Point = [x + 25 * side, side < 0 ? 151 : floor];
    const farFoot: Point = [x - 26 * side, side > 0 ? 150 : floor];
    const hands: [Limb, Limb] = [[[x + 12, 74], [x + 18, 105]], [[x - 10, 75], [x - 12, 102]]];
    const nearLeg = leg([x + 16 * side + 3, side < 0 ? 124 : 122], nearFoot);
    const farLeg = leg([x - 16 * side + 3, side > 0 ? 125 : 123], farFoot);
    return person(shoulder, hip, ...hands, nearLeg, farLeg);
  }
  return demo([at(0, 151), at(1, 159), at(0, 151), at(-1, 159)], [], weights, 570);
}

function rdlMarch() {
  function at(side: number, x: number, hinge: boolean): Point[] {
    const hip: Point = [x, hinge ? 101 : 91], shoulder = shift(hip, hinge ? 38 : 3, hinge ? -12 : -40);
    const foot: Point = [x + (hinge ? 16 : 3), floor], rear: Point = [x - (hinge ? 64 : 26), hinge ? 105 : floor];
    const support: Limb = [[x + 16, 125], foot], moving: Limb = [[x - (hinge ? 31 : 14), hinge ? 103 : 125], rear];
    const near = side > 0 ? support : moving, far = side > 0 ? moving : support;
    const arms: [Limb, Limb] = [
      [shift(shoulder, 3, 22), shift(shoulder, 7, 44)], [shift(shoulder, -6, 20), shift(shoulder, -5, 39)],
    ];
    const frame = person(shoulder, hip, ...arms, near, far);
    if (hinge) frame[0] = shift(shoulder, 13, -6);
    return frame;
  }
  return demo([at(1, 113, false), at(1, 146, false), at(1, 133, true), at(1, 146, false), at(-1, 189, false), at(-1, 176, true), at(-1, 189, false)],
    [], [["dumbbell", 4, 0, 3], ["dumbbell", 6, 0, 3]], 760);
}

function wheelOutline(x: number, y: number, radius: number): Props {
  const perimeter = Array.from({ length: 12 }, (_, index): Point => [
    x + radius * Math.cos(index * Math.PI / 6), y + radius * Math.sin(index * Math.PI / 6),
  ]);
  return perimeter.map(([fromX, fromY], index) => [fromX, fromY, ...perimeter[(index + 1) % perimeter.length]]);
}

function outdoorBike() {
  const rear: Point = [101, 132], front: Point = [220, 132];
  const prop: Props = [...wheelOutline(...rear, 24), ...wheelOutline(...front, 24), [101, 132, 151, 131], [101, 132, 136, 93],
    [136, 93, 151, 131], [136, 93, 200, 100], [151, 131, 200, 100], [200, 100, 220, 132], [200, 100, 197, 83],
    [196, 82, 216, 82], [128, 91, 145, 91], [151, 131, 151, 125]];
  const crank: Point = [151, 130];

  function at(index: number): Point[] {
    const angle = Math.PI * index / 4;
    const rotation: Point = [16 * Math.cos(angle), 18 * Math.sin(angle)];
    const nearFoot = shift(crank, ...rotation), farFoot = shift(crank, -rotation[0], -rotation[1]);
    const hip: Point = [136, 86], shoulder: Point = [166, 55];
    const near = leg([(nearFoot[0] + hip[0]) / 2 + 21, (nearFoot[1] + hip[1]) / 2 + 4], nearFoot);
    const far = leg([(farFoot[0] + hip[0]) / 2 + 16, (farFoot[1] + hip[1]) / 2 + 3], farFoot);
    const frame = person(shoulder, hip, [[189, 68], [207, 82]], [[184, 72], [199, 81]], near, far,
      [shift(nearFoot, 10, 1), shift(farFoot, 9, 2)]);
    frame[0] = [177, 44];
    return [...frame, crank, [176, 36], shift(rear, 18 * Math.cos(angle), 18 * Math.sin(angle)),
      shift(front, 18 * Math.cos(angle), 18 * Math.sin(angle)), rear, front];
  }
  return demo(Array.from({ length: 8 }, (_, i) => at(i)), prop, [
    ["line", 8, 13], ["line", 10, 13], ["pad", 14, 0, 0], ["line", 15, 17], ["line", 16, 18],
  ], 430);
}

function standingDrill(kind: "front-kick" | "front-kick-balance" | "front-kick-crossed" | "cardio-lunge" | "trot" | "prance") {
  const ready = person([151, 54], [149, 94], [[164, 77], [160, 101]], [[137, 76], [136, 103]],
    [[158, 122], [159, 155]], [[141, 122], [141, 155]]);
  function active(side: number) {
    const frontKick = kind.startsWith("front-kick"), lunge = kind === "cardio-lunge", prance = kind === "prance";
    const near = side > 0;
    const shiftX = lunge ? 13 : 0;
    const shoulder: Point = [150 + shiftX, lunge ? 82 : prance ? 49 : 53];
    const hip: Point = [149 + shiftX, lunge ? 123 : prance ? 89 : 93];
    const moving: Limb = frontKick ? [[183, 92], [218, 89]] : lunge ? [[192, 119], [190, 155]]
      : [[175, prance ? 86 : 101], [169, prance ? 112 : 132]];
    const support: Limb = lunge ? [[136, 147], [116, 149]]
      : [[145, 122], [145, 154]];
    const arms: [Limb, Limb] = frontKick ? [[shift(shoulder, 15, 24), shift(shoulder, 18, 48)],
      [shift(shoulder, -11, 25), shift(shoulder, -15, 48)]]
      : [[shift(shoulder, -10 * side, 22), shift(shoulder, -25 * side, 6)],
        [shift(shoulder, 12 * side, 23), shift(shoulder, 26 * side, 5)]];
    return person(shoulder, hip, ...arms, near ? moving : support, near ? support : moving);
  }
  const fixArm = (frame: Point[]): Point[] => {
    if (kind !== "front-kick-crossed" && kind !== "front-kick-balance") return frame;
    const [x, y] = frame[1];
    const arms: [Limb, Limb] = kind === "front-kick-crossed"
      ? [[shift(frame[1], 16, 13), [x - 11, y + 7]], [shift(frame[1], -16, 14), [x + 11, y + 9]]]
      : [[shift(frame[1], 26, 12), [x + 50, y + 15]], [shift(frame[1], -25, 13), [x - 45, y + 16]]];
    return [...frame.slice(0, 3), ...arms.flat(), ...frame.slice(7)];
  };
  const cycle = [ready, active(1), ready, active(-1)].map(fixArm);
  if (kind === "prance") {
    const steps = [...cycle, ...cycle].map((frame, index) => frame.map(p => shift(p, -53 + index * 13, 0)));
    return { ...demo(steps, [], [], 420), cutOnLoop: true };
  }
  return demo(cycle, [], [], kind === "trot" ? 360 : kind === "cardio-lunge" ? 605 : 720);
}

function heelKicks(kind: "alternating" | "double" | "single") {
  function at(side: number, air: boolean, curled: boolean) {
    const y = air ? -10 : 0;
    const kneeNear: Point = [155, 126 + y], kneeFar: Point = [141, 124 + y];
    const kicksNear = curled && (side > 0 || kind === "double");
    const kicksFar = curled && (side < 0 || kind === "double");
    const near: Limb = [kneeNear, kicksNear ? [131, 108 + y] : [158, 155 + y]];
    const far: Limb = [kneeFar, kicksFar ? [118, 105 + y] : [143, 155 + y]];
    return person([151, 52 + y], [149, 92 + y], [[159 - side * 7, 76 + y], [174 - side * 14, 72 + y]],
      [[143 + side * 7, 75 + y], [127 + side * 16, 70 + y]], near, far);
  }
  const land = at(0, false, false), near = at(1, true, true), far = at(-1, true, true);
  const cycle = kind === "double" ? [land, at(0, true, true), land]
    : kind === "single" ? [at(1, false, true), near, at(1, false, true), near, land,
      at(-1, false, true), far, at(-1, false, true), far, land] : [land, near, land, far];
  return demo(cycle, [], [], kind === "double" ? 530 : 435);
}

function inlineSkate() {
  const at = (direction: number, push: number) => {
    const x = 153 + direction * (13 + 11 * push);
    const nearX = x + 13 + (direction < 0 ? 35 * push : 0);
    const farX = x - 14 - (direction > 0 ? 35 * push : 0);
    const near: Limb = [[(x + nearX) / 2 + 5, 121], [nearX, 150]];
    const far: Limb = [[(x + farX) / 2 - 3, 120], [farX, 149]];
    return person([x + direction * 6, 63], [x, 101], [[x + 16, 82], [x + 15 - 18 * direction, 96]],
      [[x - 16, 82], [x - 15 - 17 * direction, 93]], near, far,
      [[nearX + 10, 150], [farX + 9, 149]]);
  };
  return demo([at(0, 0), at(1, 1), at(1, 0), at(0, 0), at(-1, 1), at(-1, 0)], [],
    [["ring", 8, 0, 4], ["ring", 11, 0, 4], ["ring", 10, 0, 4], ["ring", 12, 0, 4]], 560);
}

function vibrationStand() {
  const pose = person([152, 53], [149, 95], [[168, 76], [166, 102]], [[137, 76], [137, 101]],
    [[162, 117], [165, 142]], [[141, 118], [133, 142]]);
  const base: Props = [[106, 144, 200, 144], [106, 144, 113, 156], [113, 156, 194, 156], [194, 156, 200, 144],
    [123, 151, 135, 151], [168, 151, 180, 151]];
  const settle = pose.map(([x, y], i): Point => [x, i < 10 && i !== 8 ? y + 1.3 : y]);
  return demo([pose, settle], base, [], 430);
}

export const aerobicIllustrations: Record<string, Illustration> = {
  "4436": sideStep("out"),
  "10729": march("pool"),
  "6014": march("raise"),
  "9601": stepDown("patrick", false),
  "9602": stepDown("patrick", true),
  "9605": stepDown("peterson", true),
  "9603": stepDown("poliquin", false),
  "9604": stepDown("poliquin", true),
  "3651": rdlMarch(),
  "9612": advanceBox(false),
  "5537": march("tap"),
  "4634": kneeToButt(false),
  "0480": march("twist"),
  "4438": sideStep("jack"),
  "4528": carry(true),
  "5099": carry(false),
  "0565": sideStep("speed"),
  "4420": march("plain"),
  "6027": stepPunch(),
  "8874": sideStep("band"),
  "5214": outdoorBike(),
  "3999": march("air-bike"),
  "4653": kneeToButt(true),
  "3641": kneelSwing(),
  "4185": advanceBox(true),
  "5498": march("overhead"),
  "6010": march("raise"),
  "6013": standingDrill("front-kick"),
  "4616": standingDrill("front-kick-balance"),
  "5684": standingDrill("front-kick-crossed"),
  "3037": heelKicks("alternating"),
  "3708": standingDrill("cardio-lunge"),
  "1549": heelKicks("double"),
  "3086": march("twist"),
  "7175": inlineSkate(),
  "3197": standingDrill("prance"),
  "3589": standingDrill("trot"),
  "1589": heelKicks("single"),
  "2525": vibrationStand(),
};
