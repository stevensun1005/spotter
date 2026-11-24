import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
type Finger = [Point, Point, Point, Point];

function hangboard(halfCrimp: boolean): Illustration {
  const closeup: Props = [[24, 22, 129, 22], [129, 22, 129, 146],
    [129, 146, 24, 146], [24, 146, 24, 22]];
  const boardEdge: Props = halfCrimp ?
    [[95, 59, 124, 59], [95, 59, 95, 81], [95, 81, 124, 81], [101, 74, 115, 74]] :
    [[84, 72, 95, 59], [95, 59, 108, 54], [108, 54, 124, 54], [84, 72, 84, 81], [84, 81, 124, 81]];
  const board: Props = [[183, 20, 253, 20], [253, 20, 257, 42], [257, 42, 184, 42], [184, 42, 183, 20],
    [192, 29, 201, 29], [221, 29, 230, 29], [195, 37, 210, 37], [224, 37, 238, 37]];
  const shape: Finger = halfCrimp ?
    [[64, 78], [77, 47], [92, 57], [104, 57]] :
    [[64, 76], [76, 68], [87, 57], [106, 50]];
  const fingers: Point[] = [0, 1, 2, 3].flatMap((digit): Point[] =>
    shape.map(([x, y]): Point => [x + digit * 3.1, y - digit * 1.4]));
  const palmar: Point[] = [[58, 126], [66, 84], [72, 86], [85, 82]];
  const portrait = (airborne: boolean): Point[] => [
    [212, 63], [214, 76], [218, airborne ? 104 : 108],
    [224, 52], [225, 36], [199, 52], [197, 36],
    [220, airborne ? 126 : 132], [221, airborne ? 145 : 154],
    [212, airborne ? 125 : 132], [210, airborne ? 144 : 153],
    [224, 74], [201, 73], [225, 29], [197, 29],
    ...palmar, ...fingers,
  ];
  const dynamic: Gear = [["digit", 4, 13, 4], ["digit", 6, 14, 4],
    ["digit", 15, 16, 13], ["digit", 16, 17, 17], ["digit", 17, 18, 4]];
  for (let digit = 0; digit < 4; digit++) {
    const start = 19 + digit * 4;
    dynamic.push(["digit", 17, start, 5], ["digit", start, start + 1, 4],
      ["digit", start + 1, start + 2, 3], ["digit", start + 2, start + 3, 2]);
  }
  const hold = portrait(true);
  return { frames: [hold, hold, hold, hold, hold, hold, portrait(false), portrait(false)],
    dynamic, props: [...closeup, ...boardEdge, ...board], shoulders: [11, 12], ms: 1080, reference: true };
}

function dumbbellArcher(): Illustration {
  const gear: Gear = [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0],
    ["foot", 8, 183, 157], ["foot", 10, 133, 155], ["face", 0, 13]];
  const at = (elbow: Point, hand: Point, otherElbow: Point, otherHand: Point): Point[] => [
    [158, 48], [158, 65], [156, 109], elbow, hand, otherElbow, otherHand,
    [170, 132], [176, 154], [146, 130], [140, 152],
    [169, 68], [147, 66], [163, 48],
  ];
  const down = at([180, 92], [181, 118], [137, 90], [133, 115]);
  const lateral = at([194, 67], [217, 73], [123, 67], [101, 70]);
  const front = at([186, 77], [201, 67], [160, 72], [176, 62]);
  return { frames: [down, lateral, down, front], dynamic: gear, shoulders: [11, 12],
    ms: 1050, reference: true };
}

export const hangboardIllustrations: Record<string, Illustration> = {
  "3783": dumbbellArcher(),
  "3832": hangboard(false),
  "3834": hangboard(true),
};
