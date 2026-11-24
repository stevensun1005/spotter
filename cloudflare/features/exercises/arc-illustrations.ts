import type { Illustration, Point } from "./motion-data";

type Vector = [lengthwise: number, outward: number, upward: number];
type Body = [Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

function armSweep(body: Body, legs: Legs, shoulders: [Point, Point],
  bench: Props, incline: boolean, phase: Vector[], weight: boolean): Illustration {
  const reach = (shoulder: Point, [lengthwise, outward, upward]: Vector,
    distance: number, side: number, elbow = false): Point => [
    shoulder[0] + distance * ((incline ? 0.82 : 0.98) * lengthwise
      - side * 0.27 * outward + 0.10 * upward),
    shoulder[1] + distance * ((incline ? 0.57 : 0.17) * lengthwise
      + side * 0.58 * outward - 0.90 * upward) + (elbow ? 1.5 : 0),
  ];
  const frame = (vector: Vector): Point[] => [
    ...body,
    reach(shoulders[0], vector, 28, 1, true), reach(shoulders[0], vector, 54, 1),
    reach(shoulders[1], vector, 28, -1, true), reach(shoulders[1], vector, 54, -1),
    ...legs, ...shoulders,
  ];
  return {
    frames: phase.map(frame), props: bench, shoulders: [11, 12], topView: !weight,
    dynamic: weight ? [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]] : [],
    ms: weight ? 570 : 410, reference: true,
  };
}

function proneArmSweep(): Illustration {
  const mat: Props = [[70, 62, 253, 91], [253, 91, 245, 145],
    [245, 145, 62, 116], [62, 116, 70, 62]];
  const forward: Vector[] = [
    [0.98, 0.16, 0.06], [0.71, 0.70, 0.10], [0, 0.99, 0.12], [-0.70, 0.70, 0.08], [-0.98, 0.14, 0.10],
  ];
  const clip = armSweep(
    [[96, 100], [113, 91], [164, 99]], [[194, 111], [224, 118], [194, 98], [224, 103]],
    [[110, 99], [116, 82]], mat, false, [...forward, ...forward.slice(1, -1).reverse()], false,
  );
  return { ...clip, frames: clip.frames.map((pose) => [...pose, [93, 105]]), dynamic: [["face", 0, 13]] };
}

function benchArmSweep(incline: boolean): Illustration {
  const bench: Props = incline ?
    [[93, 70, 163, 119], [163, 119, 189, 119], [153, 117, 153, 157], [185, 119, 185, 157],
      [128, 154, 154, 95]] :
    [[77, 117, 196, 117], [89, 117, 89, 157], [184, 117, 184, 157]];
  const body: Body = incline ? [[99, 53], [113, 70], [166, 108]] : [[93, 101], [110, 104], [164, 109]];
  const legs: Legs = incline ? [[199, 119], [209, 155], [187, 119], [195, 154]] :
    [[203, 114], [210, 155], [192, 113], [192, 154]];
  const shoulders: [Point, Point] = incline ? [[108, 77], [118, 64]] : [[106, 111], [114, 95]];
  const forward: Vector[] = [
    [0.99, 0.14, 0.05], [0.78, 0.62, 0.09], [0.44, 0.89, 0.13],
    [0, 0.97, 0.21], [-0.50, 0.84, 0.20], [-0.86, 0.51, 0.16], [-0.99, 0.13, 0.07],
  ];
  return armSweep(body, legs, shoulders, bench, incline,
    [...forward, ...forward.slice(1, -1).reverse()], true);
}

const plateTorso: Body = [[158, 53], [158, 69], [158, 110]];
const plateLegs: Legs = [[173, 132], [178, 155], [143, 132], [139, 155]];
const plateShoulders: [Point, Point] = [[173, 67], [143, 67]];
const plateBase: Gear = [["foot", 8, 185, 157], ["foot", 10, 132, 157], ["barbell-end", 13, 0, 0]];

function standingPlateSweep(): Illustration {
  const frame = (elbow: Point, wrist: Point, otherElbow: Point, otherWrist: Point): Point[] => [
    ...plateTorso, elbow, wrist, otherElbow, otherWrist, ...plateLegs, ...plateShoulders,
  ];
  const low = frame([179, 93], [185, 119], [137, 92], [131, 118]);
  const opening = frame([195, 81], [208, 101], [121, 80], [108, 99]);
  const wide = frame([199, 70], [225, 68], [118, 69], [92, 67]);
  const high = frame([194, 52], [210, 34], [122, 51], [106, 33]);
  const top = frame([179, 41], [179, 16], [140, 40], [140, 15]);
  return { frames: [low, opening, wide, high, top, high, wide, opening],
    shoulders: [11, 12], dynamic: [["foot", 8, 185, 157], ["foot", 10, 132, 157],
      ["barbell-end", 4, 0, 0], ["barbell-end", 6, 0, 0]], ms: 495, reference: true };
}

function plateTorsion(): Illustration {
  const center: Point = [157, 99];
  const frame = (angle: number): Point[] => {
    const grip = (radius: number, radians: number): Point =>
      [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
    return [
      ...plateTorso, [180, 102], grip(13, angle), [135, 102], grip(13, angle + Math.PI),
      ...plateLegs, ...plateShoulders, center, grip(8, angle), grip(8, angle + Math.PI),
    ];
  };
  return { frames: [0, 0.70, 0, -0.70].map(frame), shoulders: [11, 12],
    dynamic: [...plateBase, ["digit", 4, 14, 4], ["digit", 6, 15, 4]], ms: 720, reference: true };
}

function dumbbellTorsion(): Illustration {
  const frame = (turn: number): Point[] => {
    const width = 10 - Math.abs(turn) * 4;
    const rightGrip: Point = [162 - turn * 7, 99];
    const leftGrip: Point = [154 + turn * 7, 107];
    return [
      ...plateTorso, [176, 99], [rightGrip[0] + 7, 99], [140, 101], [leftGrip[0] - 7, 107],
      ...plateLegs, ...plateShoulders, [158, 86], [158, 118],
      [158 - width, 86 + turn * 3], [158 + width, 86 - turn * 3],
      [158 - width, 118 + turn * 3], [158 + width, 118 - turn * 3], rightGrip, leftGrip,
    ];
  };
  return { frames: [0, 0.85, 0, -0.85].map(frame), shoulders: [11, 12], ms: 720, reference: true,
    dynamic: [["foot", 8, 185, 157], ["foot", 10, 132, 157], ["bar", 13, 14],
      ["bar", 15, 16], ["bar", 17, 18], ["digit", 4, 19, 4], ["digit", 6, 20, 4]] };
}

function hingedOneArmY(): Illustration {
  const body: Body = [[122, 70], [138, 83], [177, 113]];
  const legs: Legs = [[169, 135], [161, 155], [184, 134], [183, 154]];
  const frame = (elbow: Point, wrist: Point, tip: Point): Point[] => [
    ...body, elbow, wrist, [156, 104], [174, 128], ...legs, [136, 89], [145, 79], tip,
  ];
  return { frames: [
    frame([133, 114], [131, 141], [129, 145]),
    frame([118, 107], [96, 123], [89, 121]),
    frame([110, 89], [84, 90], [78, 85]),
    frame([114, 72], [91, 51], [86, 47]),
    frame([114, 72], [91, 51], [86, 47]),
    frame([110, 89], [84, 90], [78, 85]),
    frame([118, 107], [96, 123], [89, 121]),
  ], dynamic: [["thumb-up", 4, 13], ["dumbbell", 13, 0, 0],
    ["foot", 8, 151, 157], ["foot", 10, 176, 156]],
  shoulders: [11, 12], ms: 550, reference: true };
}

function suspensionY(): Illustration {
  const anchor: [Point, Point] = [[262, 14], [189, 14]];
  const feet: [Point, Point] = [[202, 156], [177, 155]];
  const pointOnStrap = (fixture: Point, x: number): Point =>
    [x, fixture[1] + Math.sqrt(74 ** 2 - (x - fixture[0]) ** 2)];
  const lerp = (a: Point, b: Point, fraction: number): Point =>
    [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  const frame = (phase: number): Point[] => {
    const neck: Point = [143 + phase * 16, 87 - phase * 12];
    const hip = lerp(neck, [190, 155], 0.53);
    const shoulders: [Point, Point] = [[neck[0] + 13, neck[1] + 2], [neck[0] - 14, neck[1] - 3]];
    const right = pointOnStrap(anchor[0], 209 - 16 * phase);
    const left = pointOnStrap(anchor[1], 165 - 44 * phase);
    const head: Point = [neck[0] - 7 + 6 * phase, neck[1] - 14];
    return [head, neck, hip, lerp(shoulders[0], right, 0.48), right, lerp(shoulders[1], left, 0.48), left,
      lerp(hip, feet[0], 0.55), feet[0], lerp(hip, feet[1], 0.55), feet[1], ...shoulders];
  };
  return { frames: [0, 0.25, 0.50, 0.75, 1, 1, 0.75, 0.50, 0.25].map(frame),
    props: [[181, 14, 270, 14], [270, 14, 270, 157]],
    dynamic: [["line", 4, ...anchor[0]], ["line", 6, ...anchor[1]], ["pad", 4, 0, 0], ["pad", 6, 0, 0],
      ["foot", 8, 209, 158], ["foot", 10, 184, 157]],
    shoulders: [11, 12], ms: 430, reference: true };
}

export const arcIllustrations: Record<string, Illustration> = {
  "1107": suspensionY(),
  "3826": proneArmSweep(),
  "3967": benchArmSweep(true),
  "3968": benchArmSweep(false),
  "5002": hingedOneArmY(),
  "6549": standingPlateSweep(),
  "7054": dumbbellTorsion(),
  "7055": plateTorsion(),
};
