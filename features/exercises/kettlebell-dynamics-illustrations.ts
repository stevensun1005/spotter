import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Load = "kettlebell" | "dumbbell" | "bottle" | "band" | "none";
type Flight = "chest" | "overhead" | "side" | "alternating-side" | "clean-squat" | "goblet-squat";
type Support = "stand" | "tall-kneel" | "half-kneel" | "long-sit" | "deep-squat";

const stand: Point[] = [[148, 42], [148, 61], [147, 106], [154, 86], [157, 110], [138, 86], [135, 108],
  [156, 131], [162, 156], [133, 130], [128, 156]];
const set = (pose: Point[], joints: Partial<Record<number, Point>>) => pose.map((p, i) => joints[i] ?? p);
const loop = (frames: Point[][], dynamic: Attachments, props?: Props, ms = 700): Illustration => ({
  frames, props, dynamic, ms, reference: true,
});

function swing(load: Load, flight: Flight = "chest", single = false, hipBand = false): Illustration {
  const hike = set(stand, { 0: [166, 75], 1: [153, 87], 2: [115, 111], 3: [143, 110],
    4: [133, 134], 5: [136, 108], 6: [124, 130], 7: [155, 128], 9: [132, 130] });
  const release = set(stand, { 0: [150, 44], 1: [149, 65], 2: [143, 106], 3: [168, 84],
    4: [187, 109], 5: [160, 83], 6: [183, 107] });
  const high = flight === "overhead";
  const top = set(stand, high ? { 3: [153, 40], 4: [155, 16], 5: [146, 40], 6: [149, 16] }
    : { 3: [177, 67], 4: [204, 66], 5: [169, 65], 6: [199, 63] });
  const sideRight = set(top, { 0: [156, 43], 1: [153, 63], 3: [184, 69], 4: [211, 72], 5: [176, 69], 6: [205, 70] });
  const sideLeft = set(top, { 0: [136, 43], 1: [140, 62], 3: [122, 67], 4: [98, 68], 5: [114, 64], 6: [93, 67] });
  const rack = set(stand, { 3: [167, 86], 4: [170, 66], 5: [143, 87], 6: [163, 69] });
  const bottom = set(rack, { 0: [151, 76], 1: [151, 95], 2: [129, 132], 3: [169, 115],
    4: [171, 94], 5: [144, 115], 6: [165, 96], 7: [158, 129], 9: [134, 132] });
  const squat = flight === "clean-squat" || flight === "goblet-squat";
  const lateral = flight === "side" || flight === "alternating-side";
  const frames = squat ? [hike, release, ...(flight === "goblet-squat" ? [top] : []), rack, bottom, rack, release]
    : flight === "alternating-side" ? [hike, release, sideRight, release, hike, sideLeft]
      : [hike, release, flight === "side" ? sideRight : top, release];
  const dynamic: Attachments = load === "kettlebell" ? [["handled-bell", 11, 12]]
    : load === "none" ? [] : load === "band" ? [["band", 4, 8], ["band", 6, 10]] : [[load, 11, 0, 0]];
  const props: Props = hipBand ? [[59, 110, 59, 158], [50, 158, 68, 158], [54, 113, 64, 113]] : [];
  if (lateral) dynamic.push(["face", 0, 13], ["face", 0, 14]);
  if (hipBand) dynamic.push(["band", 2, 59, 113]);
  return loop(frames.map((p) => {
    const pose = lateral ? set(p, { 7: [173, 131], 8: [182, 156], 9: [124, 131], 10: [115, 156] })
      : single ? set(p, { 5: [p[1][0] - 25, p[1][1] + 17], 6: [p[1][0] - 43, p[1][1] + 27] }) : p;
    const grip: Point = single ? pose[4] : [(pose[4][0] + pose[6][0]) / 2, (pose[4][1] + pose[6][1]) / 2];
    const rackPhase = p === rack || p === bottom;
    return [...pose, grip, [grip[0] + (rackPhase ? (flight === "clean-squat" ? -6 : 0) : p === hike ? -5 : 0),
      grip[1] + (p === top && high ? -7 : 8)], [pose[0][0] - 3, pose[0][1] - 1], [pose[0][0] + 3, pose[0][1] - 1]];
  }), dynamic, props, 580);
}

function strictPress(support: Support, grip: "rack" | "inverted" = "rack", diagonal = false): Illustration {
  const stance = support === "half-kneel" ? set(stand, { 0: [147, 67], 1: [145, 86], 2: [144, 126],
    7: [173, 125], 8: [176, 155], 9: [132, 151], 10: [105, 155] })
    : support === "tall-kneel" ? set(stand, { 0: [146, 67], 1: [145, 86], 2: [143, 122],
      7: [144, 152], 8: [108, 155], 9: [134, 151], 10: [103, 153] })
      : support === "long-sit" ? set(stand, { 0: [123, 84], 1: [123, 105], 2: [124, 152],
        7: [168, 149], 8: [206, 154], 9: [165, 146], 10: [199, 152] })
        : support === "deep-squat" ? set(stand, { 0: [149, 74], 1: [148, 95], 2: [129, 132],
          7: [166, 132], 8: [166, 156], 9: [134, 131], 10: [127, 156] }) : stand;
  const [x, y] = stance[1];
  const both = support === "deep-squat";
  const frame = (extended: boolean) => {
    const pose = set(stance, { 3: [x + (extended ? (diagonal ? 20 : 10) : 17), y + (extended ? -22 : 20)],
      4: [x + (extended ? (diagonal ? 33 : 12) : 19), y + (extended ? -47 : 0)],
      5: [x - (both ? 13 : 14), y + (both && extended ? -22 : 19)],
      6: [x - (both ? 14 : 20), y + (both ? (extended ? -47 : 0) : 34)] });
    return [...pose, [pose[4][0] + (grip === "inverted" ? 0 : 7), pose[4][1] + (grip === "inverted" ? -9 : 4)] as Point,
      [pose[6][0] - 7, pose[6][1] + 4] as Point];
  };
  const dynamic: Attachments = [["handled-bell", 4, 11]];
  if (both) dynamic.push(["handled-bell", 6, 12]);
  return loop([frame(false), frame(true)], dynamic, undefined, 910);
}

function getUp(end: "elbow-hand" | "tall-seated" | "kneel", inverted = false): Illustration {
  const floor: Point[] = [[95, 150], [112, 149], [159, 150], [116, 122], [119, 96], [102, 148], [72, 150],
    [180, 115], [192, 155], [192, 150], [229, 155]];
  const elbow = set(floor, { 0: [113, 104], 1: [124, 120], 2: [163, 151], 3: [124, 91], 4: [125, 65], 5: [103, 151], 6: [82, 151] });
  const hand = set(elbow, { 0: [127, 79], 1: [131, 99], 2: [169, 151], 3: [132, 71], 4: [133, 45], 5: [112, 127], 6: [97, 154] });
  const seated = set(hand, { 0: [153, 80], 1: [154, 100], 3: [154, 72], 4: [155, 46], 5: [139, 129], 6: [131, 153] });
  const sweep = set(hand, { 0: [124, 79], 1: [133, 97], 2: [165, 118], 3: [133, 70], 4: [134, 44], 9: [154, 143], 10: [120, 151] });
  const kneel = set(sweep, { 0: [156, 64], 1: [155, 84], 2: [153, 123], 3: [155, 57], 4: [155, 31],
    5: [140, 106], 6: [129, 125], 7: [188, 123], 8: [190, 155], 9: [146, 151], 10: [115, 155] });
  const sequence = end === "kneel" ? [floor, elbow, hand, sweep, kneel, sweep, hand, elbow]
    : end === "tall-seated" ? [floor, elbow, hand, seated, hand, elbow] : [floor, elbow, hand, hand, elbow];
  return loop(sequence.map((pose) => [...pose, [pose[4][0] + (inverted ? 0 : 6), pose[4][1] + (inverted ? -9 : 4)]]),
    [["handled-bell", 4, 11]], undefined, 765);
}

function slingshot(changeDirection: boolean, startAtSide = false): Illustration {
  const front = set(stand, { 3: [157, 89], 4: [147, 109], 5: [137, 89], 6: [147, 108] });
  const near = set(stand, { 3: [166, 93], 4: [180, 110], 5: [136, 91], 6: [135, 109] });
  const behind = set(stand, { 3: [165, 91], 4: [147, 96], 5: [128, 89], 6: [147, 96] });
  const far = set(stand, { 3: [160, 92], 4: [158, 110], 5: [123, 91], 6: [113, 110] });
  const pose = (f: Point[]) => {
    const wrist = f === far ? f[6] : f[4];
    return [...f, wrist, [wrist[0], wrist[1] + 10] as Point, [145, 41] as Point, [151, 41] as Point];
  };
  const rotation = startAtSide ? [near, behind, far, front] : [front, near, behind, far];
  const frames = (changeDirection ? [...rotation, rotation[0], ...rotation.slice(1).reverse()] : rotation).map(pose);
  return loop(frames, [["handled-bell", 11, 12], ["face", 0, 13], ["face", 0, 14]], undefined, 590);
}

function goblet(pose: Point[], twist = 0): Point[] {
  const [x, y] = pose[1];
  const hands: Point = [x + 13 + twist, y + 10];
  return [...set(pose, { 3: [x + 18 + twist, y + 23], 5: [x + 5 + twist, y + 25],
    4: [hands[0] + 3, hands[1]], 6: [hands[0] - 3, hands[1]] }), hands, [hands[0], hands[1] + 8]];
}

function deckSquat(): Illustration {
  const squat = set(stand, { 0: [163, 76], 1: [151, 95], 2: [120, 126], 7: [163, 126], 8: [159, 156],
    9: [150, 126], 10: [151, 155] });
  const sit = set(squat, { 0: [140, 89], 1: [136, 109], 2: [111, 148], 7: [157, 123], 9: [144, 123] });
  const tuck = set(sit, { 0: [73, 132], 1: [83, 147], 2: [124, 135],
    3: [111, 146], 4: [107, 124], 5: [106, 143], 6: [101, 123],
    7: [117, 100], 8: [147, 111], 9: [112, 98], 10: [139, 106] });
  const ready = goblet(stand), bottom = goblet(squat), roll = goblet(sit);
  return loop([ready, bottom, roll, [...tuck, [104, 124], [107, 130]], roll, bottom, ready],
    [["handled-bell", 11, 12]], [], 695);
}

function loadedLunge(press: boolean): Illustration {
  const nearDrop = set(stand, { 0: [156, 64], 1: [154, 83], 2: [151, 124], 7: [190, 119], 8: [188, 156],
    9: [127, 149], 10: [106, 151] });
  const farDrop = set(nearDrop, { 7: [127, 149], 8: [106, 151], 9: [191, 120], 10: [189, 156] });
  const turned = (p: Point[], dx: number) => goblet(set(p, { 0: [p[0][0] + dx * .45, p[0][1]],
    1: [p[1][0] + dx * .25, p[1][1]] }), dx);
  if (!press) return loop([goblet(stand), goblet(nearDrop), turned(nearDrop, 15), goblet(nearDrop), goblet(stand),
    goblet(farDrop), turned(farDrop, -16), goblet(farDrop), goblet(stand)], [["handled-bell", 11, 12]], [], 665);
  const rack = (p: Point[], up = false) => {
    const [x, y] = p[1];
    const frame = set(p, { 3: [x + 14, y + (up ? -20 : 24)], 4: [x + 14, y + (up ? -43 : 2)],
      5: [x - 13, y + 23], 6: [x - 22, y + 37] });
    return [...frame, [frame[4][0] - 6, frame[4][1] + 5] as Point];
  };
  return loop([rack(stand), rack(nearDrop), rack(stand, true), rack(stand), rack(farDrop), rack(stand, true), rack(stand)],
    [["handled-bell", 4, 11]], [], 695);
}

export const kettlebellDynamicsIllustrations: Record<string, Illustration> = {
  "4678": swing("band"),
  "5864": swing("none"),
  "6043": swing("bottle"),
  "3397": swing("dumbbell", "overhead"),
  "3368": swing("dumbbell"),
  "4167": swing("kettlebell", "chest", false, true),
  "3571": swing("kettlebell", "overhead"),
  "1568": swing("kettlebell", "chest", true),
  "3680": swing("kettlebell"),
  "4527": swing("kettlebell", "chest", true),
  "10192": swing("kettlebell", "side"),
  "8366": swing("kettlebell", "alternating-side"),
  "7563": swing("kettlebell", "clean-squat"),
  "7751": swing("kettlebell", "clean-squat"),
  "7548": swing("kettlebell", "goblet-squat"),
  "2942": strictPress("stand", "rack", true),
  "4446": strictPress("half-kneel", "inverted"),
  "2927": strictPress("tall-kneel", "inverted"),
  "3573": strictPress("deep-squat"),
  "3572": strictPress("stand"),
  "9703": strictPress("long-sit"),
  "4230": getUp("kneel", true),
  "3323": getUp("tall-seated"),
  "4057": getUp("elbow-hand"),
  "3578": slingshot(false, true),
  "4534": slingshot(true),
  "12018": slingshot(true),
  "3579": deckSquat(),
  "4533": loadedLunge(true),
  "5069": loadedLunge(false),
};
