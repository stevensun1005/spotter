import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type Body = [Point, Point, Point];
type Medium = "ball" | "foam" | "long-foam" | "barbell" | "stick";

const floor = 159;
const radius: Record<Medium, number> = { ball: 6, foam: 10, "long-foam": 9, barbell: 10, stick: 4 };

function move([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function along([ax, ay]: Point, [bx, by]: Point, ratio: number): Point {
  return [ax + (bx - ax) * ratio, ay + (by - ay) * ratio];
}

function pose(body: Body, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb,
  contact: Point, toes: [Point, Point] = [move(nearLeg[1], 7, 0), move(farLeg[1], 7, 0)], end = contact): Point[] {
  return [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg, ...toes, contact, end];
}

const tool: Record<Medium, Attachments> = {
  ball: [["massage-ball", 13, 0, 0]],
  foam: [["foam-roller", 13, 0, 0]],
  "long-foam": [["foam-lengthwise", 13, 0, 0]],
  barbell: [["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]],
  stick: [["bar", 13, 14], ["pad", 13, 3, 0], ["pad", 14, -3, 0]],
};

function animation(medium: Medium, frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 780): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...tool[medium], ...attachments],
    ms, reference: true };
}

function roll(medium: Medium, make: (position: number) => Point[], props: Props = [], attachments: Attachments = [], pause = true) {
  const start = make(0), center = make(.5), end = make(1);
  return animation(medium, pause ? [start, center, end, end, center] : [start, center, end, center], props, attachments);
}

const handsBack = (shoulder: Point): [Limb, Limb] => [
  [move(shoulder, -16, 22), [84, 155]], [move(shoulder, -8, 24), [91, 155]],
];

type SeatedRoll = "calf" | "calf-turned" | "calf-inward" | "glute" | "piriformis" | "hamstring";
function seatedRoll(medium: Medium, area: SeatedRoll, singleSupport = false) {
  const size = radius[medium];
  const level = floor - 2 * size + 2;
  const glute = area === "glute" || area === "piriformis";
  const hamstring = area === "hamstring";

  function make(track: number) {
    const shift = track * (medium === "ball" ? 6 : 14);
    const hip: Point = [137 + shift, glute ? level - 6 : hamstring ? level - 4 : 142];
    const shoulder: Point = [126 + shift * .75, hip[1] - 42];
    const arms = handsBack(shoulder);
    if (singleSupport) {
      arms[0][0] = along(shoulder, arms[0][1], .55);
      arms[1][0] = along(move(shoulder, -5, 2), arms[1][1], .55);
    }
    let near: Limb = [[178 + shift * .6, level], [223 + shift * .6, level]];
    let far: Limb = singleSupport ? [[177, 113], [192, 154]] : [[181, 150], [219, 154]];
    let contact: Point = [along(...near, medium === "ball" ? .4 + track * .13 : .27 + track * .45)[0], floor - size];
    if (hamstring) {
      near = [[176 + shift, level], [221 + shift * .45, level + 4]];
      far = [[180, 122], [200, 156]];
      contact = [along(hip, near[0], .73 - track * .48)[0], floor - size];
    }
    if (glute) {
      far = [[178 + shift * .36, 113], [199, 154]];
      near = area === "piriformis" ? [[152 + shift, 106 + track * 4], far[0]] : [[173 + shift, 122], [204, 155]];
      contact = [hip[0] - 7 + track * 9, floor - size];
    }
    const firstToe = move(near[1], area === "calf-inward" ? -3 : 7, area === "calf-turned" ? -6 : -2);
    return pose([move(shoulder, 3, -16), shoulder, hip], ...arms, near, far, contact,
      [firstToe, move(far[1], 7, -1)], move(contact, 17, 1));
  }
  return roll(medium, make);
}

function standingFoot(medium: "foam" | "ball") {
  const r = radius[medium];
  const level = floor - 2 * r;
  const fixture: Props = [[234, 62, 234, 157], [226, 157, 244, 157]];
  function make(track: number) {
    const hip: Point = [147, 89];
    const shoulder: Point = [154, 49];
    const near: Limb = [[172 + track * 4, 115], [181 + track * 10, level - 1]];
    const far: Limb = [[143, 123], [143, 155]];
    const toe: Point = move(near[1], 16, 1);
    const contact: Point = [near[1][0] + 4 + track * 9, floor - r];
    return pose([move(shoulder, 5, -16), shoulder, hip], [[193, 64], [233, 78]], [[140, 72], [145, 96]],
      near, far, contact, [toe, [150, 155]]);
  }
  return roll(medium, make, fixture);
}

function kneelingShin(medium: "ball" | "foam", oneLeg = false, broad = true) {
  const r = radius[medium];
  const level = floor - 2 * r + 2;
  function make(track: number) {
    const shift = track * (broad ? 17 : 7);
    const hip: Point = [137 + shift, 104 + track * 2], shoulder: Point = [183 + shift * .48, 105];
    const first: Limb = [[186 + shift * .5, 128], [194, 154]];
    const second: Limb = [[179 + shift * .4, 128], [184, 155]];
    const front: Limb = [[140 + shift, level - 4], [94 + shift, level]];
    const rear: Limb = oneLeg ? [[149, 151], [112, 155]] : [[146 + shift, level - 3], [99 + shift, level - 1]];
    const contact = [along(...front, broad ? .22 + track * .54 : .38 + track * .15)[0], floor - r] as Point;
    return pose([move(shoulder, 14, -11), shoulder, hip], first, second, front, rear, contact,
      [move(front[1], -7, -1), move(rear[1], -7, 0)]);
  }
  return roll(medium, make);
}

type Horizontal = "calf" | "calf-supported" | "inner-calf" | "lateral-quad" | "glute-med" | "tfl" | "adductor"
  | "rectus-femoris" | "lat" | "lateral-low-back" | "pec" | "pec-arm" | "front-shoulder"
  | "posterior-shoulder" | "tricep" | "bicep" | "shoulder-rotate" | "scapula-reach" | "oblique";

function horizontal(medium: "ball" | "foam", area: Horizontal) {
  const r = radius[medium];
  const floorContact = floor - 2 * r + 3;
  const stomach = area === "adductor" || area === "rectus-femoris" || area === "pec" || area === "pec-arm" || area === "front-shoulder" || area === "bicep";
  const calves = area === "calf" || area === "calf-supported" || area === "inner-calf";
  const thigh = area === "lateral-quad" || area === "rectus-femoris" || area === "adductor";
  const armArea = area === "tricep" || area === "bicep";
  const upper = !calves && !thigh && area !== "glute-med" && area !== "tfl" && area !== "oblique" && area !== "lateral-low-back";
  const overHead = area === "lat" || armArea;
  const movingArm = area === "shoulder-rotate" || area === "scapula-reach";

  function make(track: number) {
    const travel = medium === "foam" && (calves || thigh || armArea || area === "lat") ? 18 : 7;
    const dx = track * travel;
    const hip: Point = [151 + dx, upper ? 148 : floorContact - 6];
    const shoulder: Point = [104 + dx, upper ? floorContact - 5 : area === "oblique" ? floorContact - 9 : stomach ? 131 : 120];
    const head = move(shoulder, -15, stomach ? 0 : -8);
    let first: Limb = [[111 + dx, 145], [131, 155]];
    let second: Limb = [[103 + dx, 144], [115, 155]];
    let active: Limb = [[188 + dx, calves || thigh ? floorContact : 150], [224 + dx * .5, calves ? floorContact - 1 : 155]];
    let support: Limb = area === "calf-supported" || area === "inner-calf" || area === "tfl" || area === "lateral-quad" || area === "tricep" ? [[171, 119], [192, 155]]
      : [[182 + dx, 151], [218 + dx * .5, 155]];
    if (overHead) {
      first = [[78 + dx, armArea ? floorContact - 3 : shoulder[1] - 8], [50 + dx, armArea ? floorContact - 3 : shoulder[1] - 7]];
      second = [[100 + dx, 146], [120, 155]];
    }
    if (area === "pec-arm") first = [[93 + dx, 103], [77 + dx, 83]];
    if (area === "pec" || area === "front-shoulder") first = [[129, 143], [115, 154]];
    if (area === "rectus-femoris") {
      first = [[101 + dx, 152], [77 + dx, 155]];
      second = [[109 + dx, 150], [90 + dx, 154]];
    }
    if (area === "adductor") {
      active = [[173 + dx, floorContact], [204, 130]];
      support = [[191 + dx, 151], [226, 154]];
      first = [[97 + dx, 140], [76, 155]];
    }
    if (movingArm) {
      first = [[126 + dx, 127 - track * 13], area === "scapula-reach" ? [150 + track * 15, 127 - track * 6] : [117 + track * 30, 137 - track * 29]];
      second = [[86 + dx, 151], [75, 154]];
    }
    let target = shoulder[0] + 6 + track * 9;
    if (thigh) target = along(hip, active[0], .23 + track * (medium === "ball" ? .17 : .55))[0];
    if (calves) target = along(...active, .2 + track * (medium === "ball" ? .29 : .58))[0];
    if (area === "glute-med") target = hip[0] - 3 + track * 5;
    if (area === "tfl") target = hip[0] + 8 + track * 5;
    if (area === "lat") target = along(shoulder, hip, .16 + track * (medium === "ball" ? .18 : .49))[0];
    if (area === "oblique") target = along(shoulder, hip, .69 + track * .13)[0];
    if (area === "lateral-low-back") target = along(shoulder, hip, .61 + track * .19)[0];
    if (area === "posterior-shoulder") target = shoulder[0] + track * 6;
    if (area === "shoulder-rotate" || area === "scapula-reach") target = shoulder[0] + 8;
    if (area === "front-shoulder") target = shoulder[0] + 3 + track * 8;
    if (area === "pec" || area === "pec-arm") target = shoulder[0] + 14 + track * 8;
    if (armArea) target = along(shoulder, first[0], .2 + track * .48)[0];
    return pose([head, shoulder, hip], first, second, active, support, [target, floor - r]);
  }
  return roll(medium, make);
}

type WallArea = "front-high" | "front-mid" | "rear-delt" | "infraspinatus" | "rhomboid" | "levator"
  | "upper-trap" | "lower-trap" | "forearm";
function wall(area: WallArea) {
  const forearms = area === "forearm";
  const faceWall = forearms || area.startsWith("front");
  const screen = faceWall ? 208 : 108;
  const props: Props = [[screen, 19, screen, 157]];
  const medium = forearms ? "foam" : "ball";

  function make(track: number) {
    const pressing = track * 6;
    const shoulder: Point = [faceWall ? forearms ? 160 : 198 : 124, 58 + pressing];
    const hips: Point = [faceWall ? forearms ? 153 : 182 : 127, 101 + pressing];
    let first: Limb = faceWall ? [[174, shoulder[1] + 26], [174, shoulder[1] + 46]] : [[146, shoulder[1] + 24], [150, shoulder[1] + 41]];
    let second: Limb = faceWall ? [[167, shoulder[1] + 21], [162, shoulder[1] + 43]] : [[154, shoulder[1] + 20], [153, shoulder[1] + 39]];
    if (forearms) {
      const height = 81 - track * 13;
      first = [[177, height + 15], [181, height - 12]];
      second = [[174, height + 13], [177, height - 7]];
    }
    const backHeight = area === "rear-delt" ? 63 : area === "infraspinatus" ? 69
      : area === "rhomboid" ? 76 : area === "levator" ? 59 : area === "upper-trap" ? 54 : 87;
    const contact: Point = forearms ? [screen - 19, (first[0][1] + first[1][1]) / 2]
      : faceWall ? [screen - 6, shoulder[1] + (area === "front-high" ? 9 : 24) + track * 2]
        : [screen + 6, backHeight + track * 9];
    return pose([move(shoulder, faceWall && !forearms ? -6 : faceWall ? 4 : 6, -15), shoulder, hips], first, second,
      [[faceWall ? 151 : 158, 128 + pressing * .3], [faceWall ? 145 : 156, 155]],
      [[faceWall ? 139 : 146, 127 + pressing * .3], [faceWall ? 131 : 143, 155]], contact);
  }

  return roll(medium, make, props);
}

type BackArea = "occiput" | "neck-rotation" | "neck-nod" | "upper" | "middle" | "thoracic-hinge"
  | "shoulderblade" | "rhomboid-seated" | "levator" | "lower-trap" | "lumbar" | "lumbar-diagonal" | "glute" | "piriformis"
  | "around-world" | "chest-opener";

function supine(medium: "ball" | "foam" | "long-foam", area: BackArea) {
  const level = floor - 2 * radius[medium];
  const neck = area === "occiput" || area === "neck-rotation" || area === "neck-nod";
  const hipsRoll = area === "glute" || area === "piriformis";
  const hipCross = area === "piriformis" || area === "glute" || area === "lumbar-diagonal";
  const lift = area === "upper" || area === "middle";
  const lumbar = area === "lumbar" || area === "lumbar-diagonal";

  function make(track: number) {
    const traveling = lift || lumbar ? track * (medium === "ball" ? 6 : 13) : 0;
    let hip: Point = [152 + traveling, lift ? 130 : hipsRoll ? level - 4 : 149];
    if (hipCross) hip = move(hip, track * 8, -track * 2);
    const shoulder: Point = [102 + traveling, neck || hipsRoll ? 147
      : level - (area === "rhomboid-seated" ? 11 : 6) + (area === "thoracic-hinge" ? track * 3 : 0)];
    const nod = area === "neck-nod" || area === "occiput";
    const centeredHead = move(shoulder, -19, -3);
    const head: Point = neck ? [82 + track * (nod ? 4 : 9), level - 7 + track * (nod ? -3 : 1)]
      : area === "thoracic-hinge" ? [84 - track * 5, shoulder[1] - 14 + track * 26] : centeredHead;

    let near: Limb = [[190, 114], [208, 155]];
    let far: Limb = [[180, 115], [199, 153]];
    if (hipCross) {
      near = [[189 - track * 12, 112 + track * 19], [207 - track * 10, 155]];
      far = [[177 - track * 8, 114 + track * 18], [191 - track * 6, 154]];
    }
    let first: Limb = [move(shoulder, 13, -14), move(shoulder, 22, -5)];
    let second: Limb = [move(shoulder, 11, -15), move(shoulder, 7, -5)];
    if (area === "middle" || area === "thoracic-hinge") {
      first = [move(shoulder, -4, -19), move(head, -4, 6)];
      second = [move(shoulder, -10, -16), move(head, 1, 7)];
    }
    if (neck || hipCross || lumbar) {
      first = [move(shoulder, 18, 7), move(shoulder, 34, 8)];
      second = [move(shoulder, 15, 6), move(shoulder, 28, 7)];
    }
    if (area === "chest-opener" || area === "around-world") {
      const reach = area === "around-world" ? track : track * .55;
      first = [move(shoulder, 17 - reach * 33, 11 - reach * 28), move(shoulder, 34 - reach * 67, 16 - reach * 34)];
      second = [move(shoulder, 19 - reach * 36, -8 - reach * 17), move(shoulder, 37 - reach * 73, -13 - reach * 12)];
    }
    const zones: Partial<Record<BackArea, number>> = { upper: 13 + track * 14, middle: 22 + track * 11,
      "thoracic-hinge": 13, shoulderblade: 10 + track * 6, "rhomboid-seated": 18 + track * 10, levator: 2 + track * 5, "lower-trap": 25 + track * 7,
      lumbar: 37 + track * 9, "lumbar-diagonal": 35 + track * 9, "around-world": 13, "chest-opener": 20 };
    const contact: Point = [neck ? 90 + track * 3 : hipsRoll ? hip[0] - 3 + track * 5 : shoulder[0] + (zones[area] ?? 12),
      floor - radius[medium]];
    const frame = pose([head, shoulder, hip], first, second, near, far, contact);
    if (neck) frame.push(move(head, nod ? 2 : -6 + 11 * track, nod ? -5 + 6 * track : -4));
    return frame;
  }
  const attachments: Attachments = neck ? [["face", 0, 15]] : [];
  return roll(medium, make, [], attachments, area !== "around-world" && area !== "chest-opener");
}

type TableArea = "supinated" | "pronated" | "proximal" | "supinator" | "upper-arm" | "stick";
function table(area: TableArea) {
  const height = 124;
  const table: Props = [[168, height, 267, height], [174, height, 174, 157], [261, height, 261, 157]];
  const stick = area === "stick";
  const biceps = area === "upper-arm";
  const equipment = stick ? "stick" : "ball";
  const grip = area === "pronated" || area === "supinator" ? "palm-down" : "palm-up";
  function make(track: number) {
    const hips: Point = [133, biceps ? 121 : 95], shoulder: Point = [biceps ? 161 : 150, biceps ? 101 : 69];
    const contactHeight = height - radius[equipment];
    const wrist: Point = [biceps ? 238 : 230, stick ? height - 5 : contactHeight - 9];
    const elbow: Point = biceps ? [196, contactHeight - 8] : [179, wrist[1]];
    const arm: Limb = [elbow, wrist];
    const proximal = area === "proximal" || area === "supinator";
    const trackX = biceps ? along(shoulder, elbow, .48 + track * .28)[0]
      : along(elbow, wrist, proximal ? .23 + track * .16 : .3 + track * .35)[0];
    const unused: Limb = stick ? [[174, 81], [trackX, wrist[1] - 7]] : [[133, 87], [137, 109]];
    const center: Point = [trackX, stick ? wrist[1] - 5 : contactHeight];
    const toolStart = stick ? move(center, -6, 1) : center;
    const toolEnd = stick ? move(center, 7, -2) : toolStart;
    const feet: [Point, Point] = [[146, 154], [132, 155]];
    const frame = pose([move(shoulder, 7, -15), shoulder, hips], arm, unused,
      [[144, 126], feet[0]], [[136, 126], feet[1]], toolStart, [move(feet[0], 8, 0), move(feet[1], 7, 0)], toolEnd);
    return [...frame, move(wrist, 7, area === "pronated" ? 2 : -2)];
  }
  return roll(equipment, make, table, [[grip, 4, 15]]);
}

function handheld(area: "hamstring" | "peroneal") {
  const ham = area === "hamstring";
  function make(track: number) {
    const hip: Point = [132, 146], shoulder: Point = [147, 105];
    const moving: Limb = [[173, ham ? 137 : 122], [220, 149]];
    const planted: Limb = [[174, 149], [211, 154]];
    const anchor = ham ? along(hip, moving[0], .80 - track * .55) : along(...moving, .78 - track * .55);
    const first: Point = move(anchor, -8, ham ? 5 : -5);
    const second: Point = move(anchor, 9, ham ? 3 : -8);
    return pose([move(shoulder, 5, -14), shoulder, hip], [[155, 127], first], [[144, 129], second],
      moving, planted, first, [move(moving[1], 7, -1), move(planted[1], 7, 0)], second);
  }
  return roll("stick", make);
}

function kneelingReach() {
  function make(track: number) {
    const hips: Point = [150, 115], shoulder: Point = [183 + track * 6, 108];
    const contact: Point = [223 + track * 21, floor - 10];
    const first: Limb = [[201 + track * 12, 128], [contact[0], contact[1] - 10]];
    const second: Limb = track < .5 ? [[185, 130], [187, 154]] : [[170, 103], [155, 94]];
    return pose([move(shoulder, 12, track > .5 ? -14 : -10), shoulder, hips], first, second,
      [[150, 151], [110, 153]], [[142, 149], [106, 153]], contact, [[103, 154], [99, 154]]);
  }
  return roll("foam", make);
}

function rollUpBack() {
  function make(track: number) {
    const hip: Point = [145 + track * 9, 136 + track * 8];
    const shoulder: Point = [139 - track * 40, 90 + track * 48];
    const head: Point = move(shoulder, -4 - track * 14, -16 + track * 12);
    const contact: Point = [145 - track * 30, floor - 10];
    const first: Limb = [move(shoulder, 8, 23), move(hip, -12, 6)];
    const second: Limb = [move(shoulder, -1, 25), move(hip, -21, 9)];
    return pose([head, shoulder, hip], first, second, [[185, 146], [225, 153]], [[177, 149], [220, 155]], contact);
  }
  return roll("foam", make);
}

const standingClavicle = wall("front-high");
const piriformisBall = seatedRoll("ball", "piriformis");
const thoracicRoll = supine("foam", "upper");
const doubleShin = kneelingShin("foam");

export const mobilityReleaseIllustrations: Record<string, Illustration> = {
  "2992": seatedRoll("barbell", "calf"),
  "11572": supine("foam", "thoracic-hinge"),
  "2947": doubleShin,
  "5386": supine("foam", "around-world"),
  "4470": horizontal("ball", "adductor"),
  "4498": table("upper-arm"),
  "4465": seatedRoll("ball", "calf"),
  "4611": wall("rear-delt"),
  "4480": supine("ball", "lumbar"),
  "4478": horizontal("ball", "oblique"),
  "4462": standingFoot("ball"),
  "4496": table("pronated"),
  "4494": table("supinated"),
  "4497": table("proximal"),
  "4495": table("supinator"),
  "4472": horizontal("ball", "glute-med"),
  "4485": wall("infraspinatus"),
  "4486": supine("ball", "shoulderblade"),
  "4469": horizontal("ball", "lateral-quad"),
  "4493": horizontal("ball", "lat"),
  "4600": supine("ball", "lumbar"),
  "4481": supine("ball", "lumbar-diagonal"),
  "6769": supine("ball", "occiput"),
  "3569": standingClavicle,
  "4484": standingClavicle,
  "4483": wall("front-mid"),
  "4463": seatedRoll("ball", "calf-turned"),
  "4473": piriformisBall,
  "3568": piriformisBall,
  "4474": supine("ball", "piriformis"),
  "6766": horizontal("ball", "inner-calf"),
  "4468": horizontal("ball", "rectus-femoris"),
  "4489": wall("rhomboid"),
  "4487": wall("levator"),
  "4488": supine("ball", "levator"),
  "4471": horizontal("ball", "tfl"),
  "4464": kneelingShin("ball", true, false),
  "4467": seatedRoll("ball", "calf-inward"),
  "4491": wall("lower-trap"),
  "4492": supine("ball", "lower-trap"),
  "4490": wall("upper-trap"),
  "3570": wall("upper-trap"),
  "5374": horizontal("foam", "bicep"),
  "5377": horizontal("foam", "pec"),
  "5376": supine("long-foam", "chest-opener"),
  "5387": supine("foam", "lumbar"),
  "5398": standingFoot("foam"),
  "5373": wall("forearm"),
  "5378": horizontal("foam", "front-shoulder"),
  "5391": supine("foam", "glute"),
  "5390": seatedRoll("foam", "glute", true),
  "5392": seatedRoll("foam", "hamstring", true),
  "5388": kneelingReach(),
  "2949": horizontal("foam", "lat"),
  "5383": horizontal("foam", "lateral-low-back"),
  "5382": supine("foam", "middle"),
  "5372": supine("foam", "neck-nod"),
  "5371": supine("foam", "neck-rotation"),
  "2948": horizontal("foam", "pec-arm"),
  "5397": horizontal("foam", "calf-supported"),
  "5396": horizontal("foam", "calf"),
  "5379": horizontal("foam", "posterior-shoulder"),
  "5393": horizontal("foam", "lateral-quad"),
  "5381": supine("foam", "rhomboid-seated"),
  "5380": horizontal("foam", "shoulder-rotate"),
  "5385": horizontal("foam", "scapula-reach"),
  "4598": horizontal("foam", "tfl"),
  "5384": thoracicRoll,
  "5394": doubleShin,
  "5395": kneelingShin("foam", true),
  "5375": horizontal("foam", "tricep"),
  "3566": thoracicRoll,
  "2208": rollUpBack(),
  "2209": seatedRoll("foam", "calf", true),
  "2994": doubleShin,
  "4220": table("stick"),
  "4221": handheld("hamstring"),
  "4223": handheld("peroneal"),
};
