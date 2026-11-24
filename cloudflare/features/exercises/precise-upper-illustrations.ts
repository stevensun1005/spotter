import type { Illustration, Point } from "./motion-data";

type Body = [Point, Point, Point];
type Arms = [Point, Point, Point, Point];
type Legs = [Point, Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

const frame = (body: Body, arms: Arms, legs: Legs, ...points: Point[]): Point[] =>
  [...body, ...arms, ...legs, ...points];
const phase = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 680): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });

function highBoxPushUp(): Illustration {
  const arms: Arms = [[182, 80], [188, 102], [189, 78], [197, 98]];
  const heels: Legs = [[105, 128], [78, 151], [105, 122], [72, 148]];
  const box: Props = [
    [175, 105, 231, 105], [231, 105, 251, 93], [251, 93, 195, 93], [195, 93, 175, 105],
    [175, 105, 175, 157], [231, 105, 231, 157], [251, 93, 251, 145],
    [175, 157, 231, 157], [231, 157, 251, 145],
  ];
  const top = frame([[205, 46], [187, 63], [132, 106]], arms, heels);
  const down = frame([[214, 78], [195, 90], [139, 117]],
    [[167, 106], arms[1], [177, 102], arms[3]], [[108, 134], heels[1], [103, 130], heels[3]]);
  return phase([top, down], box, [["foot", 8, 85, 158], ["foot", 10, 79, 157]], 1450);
}

function assistedInvertedLift(): Illustration {
  const anchors: Arms = [[203, 129], [228, 132], [211, 130], [235, 135]];
  const torso = ([x, y]: Point): Body => [[206, 146], [190, 150], [x, y]];
  const floorBench: Props = [[222, 132, 273, 132], [227, 132, 227, 157], [267, 132, 267, 157]];
  const low = frame(torso([146, 150]), anchors, [[112, 144], [78, 140], [116, 146], [81, 143]], [170, 150]);
  const halfway = frame(torso([147, 147]), anchors, [[122, 118], [103, 94], [128, 119], [109, 94]], [170, 151]);
  const lifted = frame(torso([151, 144]), anchors, [[145, 109], [141, 75], [150, 109], [146, 76]], [171, 149]);
  const high = frame(torso([167, 129]), anchors, [[167, 93], [168, 58], [162, 93], [164, 57]], [178, 144]);
  return { ...phase([low, halfway, lifted, high, lifted, halfway], floorBench, [], 640), spine: [11] };
}

function towelFootCurl(neutral: boolean): Illustration {
  const body: Body = [[187, 77], [174, 93], [144, 151]];
  const reach = (arms: Arms, legs: Legs, feet: [Point, Point], fingertips: [Point, Point]) =>
    frame(body, arms, legs, ...feet, ...fingertips, [178, 78]);
  const start = reach(
    [[154, 122], [121, 126], [162, 121], [127, 120]], [[108, 134], [81, 136], [114, 125], [87, 130]],
    [[73, 127], [79, 121]], [[116, 125], [122, 120]]);
  const mid = reach(
    [[153, 123], [131, 110], [161, 121], [137, 106]], [[119, 126], [91, 119], [123, 116], [96, 114]],
    [[83, 109], [89, 104]], [[125, 109], [131, 105]]);
  const curled = reach(
    [[154, 124], [151, 97], [162, 122], [158, 93]], [[129, 105], [108, 103], [134, 99], [114, 99]],
    [[101, 94], [107, 91]], [[145, 96], [152, 92]]);
  const grip = neutral ? "thumb-up" : "palm-down";
  return phase([start, mid, curled, mid], [], [
    ["foot-tip", 8, 11], ["foot-tip", 10, 12], ["line", 13, 11], ["line", 14, 12],
    ["bar", 11, 12], [grip, 4, 13], [grip, 6, 14], ["face", 0, 15],
  ], 850);
}

const flatSeat: Props = [[100, 119, 193, 119], [108, 119, 108, 157], [181, 119, 181, 157]];
const seated: Body = [[151, 53], [146, 71], [143, 112]];
const seatLegs: Legs = [[174, 119], [176, 154], [165, 116], [164, 152]];
const seatFeet: Gear = [["foot", 8, 184, 157], ["foot", 10, 173, 155], ["face", 0, 13]];
const seatedFrame = (arms: Arms) => frame(seated, arms, seatLegs, [144, 74], [154, 72], [158, 52]);

function alternatingTatePress(): Illustration {
  const straight = seatedFrame([[142, 47], [142, 22], [157, 43], [159, 18]]);
  const front = seatedFrame([[138, 49], [162, 61], [153, 44], [176, 56]]);
  const back = seatedFrame([[140, 49], [118, 62], [154, 46], [131, 64]]);
  return { ...phase([straight, front, straight, back], flatSeat,
    [...seatFeet, ["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]], 1040), shoulders: [11, 12] };
}

function alternatingUprightSqueeze(): Illustration {
  const reach: Arms = [[169, 80], [196, 81], [177, 75], [207, 75]];
  const together = seatedFrame(reach);
  const retractRight = seatedFrame([[158, 100], [166, 87], reach[2], reach[3]]);
  const retractLeft = seatedFrame([reach[0], reach[1], [163, 90], [175, 82]]);
  return { ...phase([together, retractRight, together, retractLeft], flatSeat,
    [...seatFeet, ["hammer-weight", 4, 0, 0], ["hammer-weight", 6, 0, 0]], 950), shoulders: [11, 12] };
}

function malteseHold(): Illustration {
  const bench: Props = [[82, 121, 201, 121], [89, 121, 89, 155], [183, 121, 183, 155]];
  const body: Body = [[92, 108], [107, 111], [163, 112]];
  const legs: Legs = [[192, 115], [200, 154], [183, 112], [186, 152]];
  const at = (arms: Arms) => frame(body, arms, legs, [105, 119], [109, 101],
    [arms[1][0] + 3, arms[1][1] + 4], [arms[3][0] + 3, arms[3][1] + 4]);
  const hold = at([[129, 127], [152, 143], [132, 86], [154, 75]]);
  const close = at([[127, 117], [153, 121], [133, 100], [156, 104]]);
  return { ...phase([hold, ...Array<Point[]>(9).fill(hold), close], bench,
    [["foot", 8, 209, 156], ["foot", 10, 194, 155], ["palm-down", 4, 13], ["palm-down", 6, 14],
      ["dumbbell", 4, 2, 1], ["dumbbell", 6, 2, 1]], 1120), shoulders: [11, 12] };
}

function plateShoulderPress(): Illustration {
  const body: Body = [[155, 54], [156, 71], [155, 112]];
  const legs: Legs = [[169, 133], [175, 156], [143, 134], [138, 155]];
  const bend = (right: Point, left: Point, y: number, radiusY: number) => {
    const plate: Point[] = Array.from({ length: 12 }, (_, i) => [
      157 + 13 * Math.cos(i * Math.PI / 6), y + radiusY * Math.sin(i * Math.PI / 6),
    ]);
    return frame(body, [right, plate[0], left, plate[6]], legs, [166, 73], [145, 72], ...plate);
  };
  const rim: Gear = Array.from({ length: 12 }, (_, i) => ["line", 13 + i, 13 + (i + 1) % 12]);
  const start = bend([172, 104], [139, 102], 79, 11);
  const middle = bend([174, 71], [140, 69], 49, 7);
  const top = bend([169, 45], [146, 44], 19, 3);
  return { ...phase([start, middle, top, middle], [],
    [["foot", 8, 184, 158], ["foot", 10, 131, 157], ...rim], 700), shoulders: [11, 12] };
}

export const preciseUpperIllustrations: Record<string, Illustration> = {
  "1443": malteseHold(),
  "1851": highBoxPushUp(),
  "3499": assistedInvertedLift(),
  "3850": towelFootCurl(false),
  "3851": towelFootCurl(true),
  "3946": alternatingUprightSqueeze(),
  "4157": alternatingTatePress(),
  "4175": plateShoulderPress(),
};
