import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Arms = [Point, Point, Point, Point];

function smithFrame(left: number, right: number): Props {
  return [
    [left - 7, 20, right + 7, 20],
    [left - 7, 20, left - 7, 155], [right + 7, 20, right + 7, 155],
    [left, 30, left, 148], [right, 30, right, 148],
    [left - 22, 157, left + 18, 157], [right - 12, 157, right + 21, 157],
    [left - 7, 34, left + 1, 34], [right - 1, 34, right + 7, 34],
    [left - 7, 131, left + 1, 131], [right - 1, 131, right + 7, 131],
  ];
}

const guidedBar: Attachments = [
  ["foot-tip", 8, 11], ["foot-tip", 10, 12],
  ["bar", 13, 14], ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0],
];

type Base = [Point, Point, Point, Point, Point, Point, Point, Point, Point];
function position(body: Base, shoulders: [Point, Point], elbows: [Point, Point],
  grips: [number, number], y: number, rails: [number, number]): Point[] {
  const [head, neck, hip, knee, ankle, farKnee, farAnkle, toes, farToes] = body;
  const [nearGrip, farGrip] = grips;
  const arms: Arms = [elbows[0], [nearGrip, y + 4], elbows[1], [farGrip, y + 4]];
  return [
    head, neck, hip, ...arms, knee, ankle, farKnee, farAnkle, toes, farToes,
    [rails[0], y], [rails[1], y], [nearGrip - 5, y - 2], [farGrip + 5, y - 2],
    ...shoulders,
  ];
}

function smithCycle(rest: Point[], move: Point[], props: Props, underhand: boolean): Illustration {
  const grip = underhand ? "palm-up" : "palm-down";
  return {
    frames: [rest, move, move, rest],
    ms: 920,
    props,
    dynamic: [...guidedBar, [grip, 4, 15], [grip, 6, 16]],
    shoulders: [17, 18],
    reference: true,
  };
}

const rowRails: [number, number] = [117, 228];
const bentOver: Base = [
  [188, 62], [173, 75], [130, 105],
  [143, 129], [140, 154], [124, 128], [121, 153], [155, 157], [136, 156],
];
const rowShoulders: [Point, Point] = [[167, 76], [181, 73]];
const narrowGrips: [number, number] = [165, 185];
const narrowRow = smithCycle(
  position(bentOver, rowShoulders, [[165, 102], [184, 101]], narrowGrips, 126, rowRails),
  position(bentOver, rowShoulders, [[146, 88], [163, 82]], narrowGrips, 87, rowRails),
  smithFrame(...rowRails),
  true,
);

const pressRails: [number, number] = [78, 201];
const flatBench: Props = [
  [95, 123, 186, 123], [98, 128, 183, 128],
  [108, 128, 108, 156], [177, 128, 177, 156], [98, 156, 118, 156], [168, 156, 187, 156],
];
const flatBody: Base = [
  [103, 110], [121, 112], [173, 112],
  [205, 123], [202, 155], [191, 121], [188, 153], [218, 157], [202, 155],
];
const flatShoulders: [Point, Point] = [[125, 114], [133, 106]];
const flatGrips: [number, number] = [138, 162];
const flatPress = smithCycle(
  position(flatBody, flatShoulders, [[137, 70], [160, 69]], flatGrips, 43, pressRails),
  position(flatBody, flatShoulders, [[140, 129], [162, 124]], flatGrips, 102, pressRails),
  [...smithFrame(...pressRails), ...flatBench],
  true,
);

const angledRails: [number, number] = [74, 188];
const declineBench: Props = [
  [93, 143, 179, 117], [96, 148, 181, 122], [169, 126, 169, 156], [155, 156, 181, 156],
  [178, 118, 204, 117], [203, 117, 213, 125], [207, 119, 218, 119], [207, 122, 218, 122],
];
const declineBody: Base = [
  [100, 127], [119, 124], [169, 107],
  [192, 88], [210, 115], [184, 90], [204, 114], [221, 107], [214, 106],
];
const declineShoulders: [Point, Point] = [[124, 123], [132, 115]];
const declineGrips: [number, number] = [135, 159];
const declinePress = smithCycle(
  position(declineBody, declineShoulders, [[133, 77], [156, 76]], declineGrips, 52, angledRails),
  position(declineBody, declineShoulders, [[139, 135], [157, 131]], declineGrips, 106, angledRails),
  [...smithFrame(...angledRails), ...declineBench],
  true,
);

const inclineBench: Props = [
  [97, 83, 175, 127], [96, 88, 174, 132], [174, 129, 201, 127],
  [111, 97, 111, 155], [169, 131, 169, 155], [101, 155, 122, 155], [155, 155, 184, 155],
];
const inclineBody: Base = [
  [103, 71], [122, 84], [175, 116],
  [204, 116], [211, 153], [193, 118], [196, 152], [227, 156], [210, 155],
];
const inclineShoulders: [Point, Point] = [[122, 86], [129, 76]];
const inclineGrips: [number, number] = [126, 150];
const inclinePress = smithCycle(
  position(inclineBody, inclineShoulders, [[124, 58], [145, 56]], inclineGrips, 30, angledRails),
  position(inclineBody, inclineShoulders, [[128, 106], [149, 102]], inclineGrips, 78, angledRails),
  [...smithFrame(...angledRails), ...inclineBench],
  true,
);

export const legacySmithUpperCorrections: Record<string, Illustration> = {
  "0754": declinePress,
  "0758": inclinePress,
  "0761": narrowRow,
  "0764": flatPress,
};
