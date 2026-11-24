import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Setup = {
  body: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
  props?: Props;
};
type Direction = "out" | "in";
type Posture = "standing" | "kneeling" | "half-kneeling";
type Equipment = "none" | "band" | "cable" | "dumbbell";
const upright: Setup = {
  body: [[151, 39], [151, 55], [150, 102]],
  legs: [[165, 128], [169, 157], [135, 128], [131, 157]],
};
const sideStand: Setup = { ...upright, body: [[156, 42], [151, 58], [143, 104]],
  legs: [[151, 129], [151, 157], [133, 129], [134, 157]] };
const oneKnee: Setup = {
  body: [[157, 57], [154, 75], [151, 115]],
  legs: [[181, 119], [187, 156], [135, 152], [107, 156]],
};
const bothKnees: Setup = {
  body: [[154, 59], [153, 78], [151, 117]],
  legs: [[166, 152], [135, 157], [153, 152], [121, 157]],
};
const seat: Props = [[118, 114, 169, 114], [125, 114, 125, 158], [164, 114, 164, 158]];
const seated: Setup = {
  body: [[141, 49], [143, 66], [142, 108]],
  legs: [[175, 112], [183, 157], [164, 113], [168, 156]],
  props: seat,
};
const onChair: Setup = { ...seated, props: [...seat, [121, 74, 121, 115], [118, 74, 124, 74]] };
const atFloor: Setup = {
  body: [[141, 82], [142, 98], [145, 151]],
  legs: [[173, 126], [195, 156], [173, 153], [207, 155]],
};

function shift([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function pose(setup: Setup, [elbow, wrist, otherElbow, otherWrist]: Arms): Point[] {
  return [...setup.body, elbow, wrist, otherElbow, otherWrist, ...setup.legs];
}

function clip(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 1000): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function stay(initial: Point[], stretch: Point[], props: Props = [], dynamic: Attachments = [], seconds = 20): Illustration {
  return clip([initial, ...Array<Point[]>(seconds + 1).fill(stretch)], props, dynamic);
}

function pulley(x: number, y: number, band: boolean): Props {
  return [[x, band ? 40 : 26, x, 157], [x - 4, y, x + 4, y], [x - 10, 157, x + 10, 157]];
}

function armAtSide(setup: Setup, direction: Direction, gear: Equipment = "none", y?: number, stable = false): Illustration {
  const [shoulderX, shoulderY] = setup.body[1];
  const elbow: Point = [shoulderX + 17, shoulderY + 31];
  const inside = shift(elbow, -20, 4);
  const outside = shift(elbow, 22, 4);
  const passive: Pair = [[shoulderX - 14, shoulderY + 29], [shoulderX - 19, shoulderY + 49]];
  const first = pose(setup, [elbow, direction === "out" ? inside : outside, ...passive]);
  const last = pose(setup, [elbow, direction === "out" ? outside : inside, ...passive]);
  const anchorX = direction === "out" ? 80 : 232;
  const anchorY = y ?? elbow[1];
  const props: Props = [...(setup.props ?? [])];
  const dynamic: Attachments = [];
  if (gear === "band" || gear === "cable") {
    props.push(...pulley(anchorX, anchorY, gear === "band"));
    dynamic.push([gear, 4, anchorX, anchorY], ["pad", 4, 0, 0]);
  }
  if (gear === "dumbbell") dynamic.push(["dumbbell", 4, 0, 0]);
  return clip(stable ? [first, last, last] : [first, last], props, dynamic, 970);
}

function shoulderHigh(place: Posture, direction: Direction, gear: Equipment, finish: "rotation" | "press" | "catch" = "rotation"): Illustration {
  const base = place === "half-kneeling" ? oneKnee : place === "kneeling" ? bothKnees : upright;
  const [sx, sy] = base.body[1];
  const elbow: Point = [sx + 34, sy + 1];
  const low = shift(elbow, 17, 22), raised = shift(elbow, 0, -28), half = shift(elbow, 25, -8);
  const free: Pair = [[sx - 15, sy + 28], [sx - 16, sy + 50]];
  const at = (hand: Point, e = elbow) => pose(base, [e, hand, ...free]);
  const normal = direction === "out" ? [at(low), at(half), at(raised), at(half)] : [at(raised), at(half), at(low), at(half)];
  const halfPressStart = place === "half-kneeling" ? at([sx + 20, sy - 4], [sx + 23, sy + 13]) : at(low);
  const frames = finish === "press" ? [halfPressStart, at(raised), at([sx + 16, sy - 56], [sx + 13, sy - 29]), at(raised)]
    : finish === "catch" ? [at(raised), at(raised), at(half), at(low), at(half)] : normal;
  const anchorX = direction === "out" ? 235 : 89, anchorY = sy + 2;
  return clip(frames, gear === "cable" || gear === "band" ? pulley(anchorX, anchorY, gear === "band") : [],
    gear === "dumbbell" ? [["dumbbell", 4, 0, 0]] : [[gear, 4, anchorX, anchorY], ["pad", 4, 0, 0]], 870);
}

function rotateBoth(style: "chair" | "standing" | "supported-dumbbell"): Illustration {
  const dumbbell = style === "supported-dumbbell";
  const setups = dumbbell ? seated : style === "standing" ? upright : onChair;
  const [x, y] = setups.body[1];
  const elbows: Pair = [[x + (dumbbell ? 30 : 17), y + (dumbbell ? 42 : 30)], [x - 13, y + 30]];
  const close: Pair = [[x + 16, y + 28], [x - 4, y + 33]];
  const open: Pair = [[x + 50, y + 22], [x - 34, y + 32]];
  const passive: Point = [x - 20, y + 41];
  const at = (wrists: Pair) => pose(setups, [elbows[0], wrists[0], elbows[1], dumbbell ? passive : wrists[1]]);
  return clip([at(close), at(open), at(open)], setups.props, dumbbell ? [["dumbbell", 4, 0, 0]] : [], 955);
}

function sideLying(direction: Direction, equipment: "none" | "dumbbell" | "towel", bench: boolean): Illustration {
  const floorY = bench ? 121 : 156;
  const setup: Setup = {
    body: [[102, floorY - 17], [117, floorY - 11], [168, floorY - 9]],
    legs: [[191, floorY - 17], [216, floorY], [187, floorY - 6], [204, floorY + 4]],
    props: bench ? [[84, 120, 221, 120], [95, 120, 95, 157], [209, 120, 209, 158]] : undefined,
  };
  const elbow: Point = direction === "out" ? [159, floorY - 15] : [133, floorY + 4];
  const low: Point = direction === "out" ? [135, floorY - 11] : [108, floorY + 4];
  const high: Point = direction === "out" ? [155, floorY - 41] : [145, floorY - 17];
  const free: Pair = direction === "out" ? [[131, floorY + 2], [105, floorY - 3]]
    : [[161, floorY - 9], [176, floorY - 1]];
  const dynamic: Attachments = equipment === "dumbbell" ? [["dumbbell", 4, 0, 0]] :
    equipment === "towel" ? [["pad", 3, 0, 8]] : [];
  return clip([pose(setup, [elbow, low, ...free]), pose(setup, [elbow, high, ...free])], setup.props, dynamic, 1080);
}

function aboveShoulder(use: "wall" | "foam" | "ball", band = false, shoulderLevel = false): Illustration {
  const wallX = 219;
  const thickness = use === "ball" ? 19 : use === "foam" ? 11 : 4;
  const body: Setup = {
    body: [[174, 53], [167, 68], [148, 110]],
    legs: [[145, 135], [134, 157], [137, 134], [124, 156]],
  };
  const base = wallX - thickness;
  const elbowLevel = shoulderLevel ? 77 : 99;
  const at = (dy: number, shoulder: number): Point[] => {
    const outline: Setup = { ...body, body: [shift(body.body[0], shoulder, -dy * .2), shift(body.body[1], shoulder, -dy * .25), body.body[2]] };
    const near: Pair = [[base - 3, elbowLevel - dy], [base + 1, elbowLevel - 27 - dy]];
    const far: Pair = [[base - 14, elbowLevel - 2 - dy], [base - 7, elbowLevel - 29 - dy]];
    return [...pose(outline, [...near, ...far]), [base, elbowLevel - 10 - dy], [base - 8, elbowLevel - 10 - dy],
      [wallX - 18, elbowLevel - 13 - dy], shift(near[0], -1, -2), shift(far[0], -1, -2)];
  };
  const gear: Attachments = band ? [["band", 14, 15]] : [];
  if (use === "foam") gear.push(["pad", 11, 5, -3], ["pad", 11, 5, 0], ["pad", 11, 5, 3]);
  if (use === "ball") gear.push(["stability-ball", 13, 0, 0]);
  return clip([at(0, 0), at(23, 6), at(40, 11), at(23, 6)], [[wallX, 23, wallX, 157], [wallX - 4, 157, wallX + 17, 157]], gear, 810);
}

function wallBack(kind: "slide" | "flex" | "alternate"): Illustration {
  const wall: Props = [[138, 19, 138, 157], [121, 157, 153, 157]];
  const back: Setup = {
    body: [[148, 41], [148, 57], [148, 105]],
    legs: [[163, 130], [164, 157], [149, 131], [153, 157]],
  };
  const low: Arms = kind === "slide" ? [[177, 82], [176, 55], [119, 83], [120, 55]]
    : [[170, 82], [172, 109], [134, 84], [130, 112]];
  const high: Arms = kind === "slide" ? [[171, 42], [166, 17], [125, 43], [130, 18]]
    : [[151, 31], [145, 11], [142, 34], [140, 11]];
  const start = pose(back, low), end = pose(back, high);
  return clip(kind === "alternate" ? [start, pose(back, [high[0], high[1], low[2], low[3]]),
    start, pose(back, [low[0], low[1], high[2], high[3]])] : [start, end], wall, [], 1070);
}

function raiseForward(gear: "none" | "band" | "stick" | "rope", action: "front" | "back" | "side" | "overhead"): Illustration {
  const base: Arms = [[164, 86], [168, 113], [136, 85], [132, 112]];
  const bothGear = gear === "stick";
  const top: Arms = action === "front" ? [[184, 63], [208, 59], [136, 84], [133, 112]]
    : action === "back" ? [[139, 80], [121, 101], [132, 84], [127, 113]]
    : action === "side" ? [[180, 46], [205, 34], [159, 69], [174, 56]]
    : [[158, 29], [163, 9], [136, 30], [139, 9]];
  const props: Props = [];
  const load: Attachments = gear === "band" ? [["band", 4, 8]] : bothGear ? [["bar", 4, 6]] : [];
  if (gear === "rope") {
    const switching = pose(sideStand, [base[0], base[1], [164, 65], [189, 61]]);
    const frames = [pose(sideStand, base), pose(sideStand, top), pose(sideStand, base), switching]
      .map((points, index) => {
        const wrist = points[index === 3 ? 6 : 4];
        return [...points, wrist, shift(wrist, 7, 25), shift(wrist, 8, 11)];
      });
    return clip(frames, props, [["line", 11, 13], ["line", 13, 12]]);
  }
  return clip([pose(bothGear ? upright : sideStand, base), pose(bothGear ? upright : sideStand, top)], props, load, 1090);
}

function passThrough(kind: "band" | "stick"): Illustration {
  const low: Arms = [[180, 83], [202, 107], [121, 83], [99, 107]];
  const inFront: Arms = [[184, 58], [209, 55], [121, 60], [95, 56]];
  const high: Arms = [[179, 30], [198, 12], [123, 30], [105, 12]];
  const rear: Arms = [[177, 77], [195, 98], [122, 77], [105, 99]];
  const rearSetup: Setup = { ...upright, body: [[155, 39], [153, 55], [149, 103]] };
  return clip([pose(upright, low), pose(upright, inFront), pose(upright, high), pose(rearSetup, rear), pose(upright, high), pose(upright, inFront)],
    [], [[kind === "stick" ? "bar" : "band", 4, 6]], 925);
}

function assistedRotation(kind: "pvc" | "stick" | "stick-stretch" | "hand-stretch"): Illustration {
  const close: Arms = [[170, 86], [166, 94], [132, 87], [136, 94]];
  const right: Arms = [[170, 86], [196, 90], [132, 87], [163, 90]];
  const left: Arms = [[170, 86], [141, 90], [132, 87], [103, 90]];
  const load: Attachments = [["bar", 4, 6]];
  if (kind === "hand-stretch") return stay(pose(upright, close), pose(upright, [right[0], [181, 91], right[2], [178, 92]]));
  if (kind === "stick-stretch") return stay(pose(upright, close), pose(upright, right), [], load);
  return clip([pose(upright, close), pose(upright, right), pose(upright, close), pose(upright, left)], [], load, 1000);
}

function rowsWithoutElbows(style: "body" | "cable" | "lever" | "pronated" | "sitting" | "bent-arm"): Illustration {
  const supported = style !== "body";
  const isLever = style === "lever" || style === "pronated", isCable = style === "cable";
  const props: Props = supported ? [...seat] : [];
  const anchoring: Attachments = [];
  let whole = supported ? seated : sideStand;
  if (isCable) {
    whole = { ...whole, legs: [[177, 117], [211, 148], [168, 119], [202, 149]] };
    props.push(...pulley(239, 133, false), [197, 155, 216, 143]);
    anchoring.push(["cable", 4, 239, 133], ["bar", 4, 6]);
  }
  if (isLever) {
    props.push([159, 76, 157, 105], [157, 102, 157, 155], [202, 117, 218, 117], [221, 28, 221, 157], [209, 157, 236, 157]);
    anchoring.push(["line", 4, 211, 117], ["line", 6, 207, 117], ["barbell-end", 4, 10, 10]);
  }
  const front: Arms = style === "bent-arm" ? [[132, 91], [151, 93], [124, 95], [139, 98]] :
    style === "sitting" ? [[155, 93], [157, 116], [133, 92], [136, 116]] :
      [[177, isCable ? 86 : 75], [204, isCable ? 106 : 80], [170, isCable ? 83 : 74], [197, isCable ? 103 : 79]];
  const back = front.map((p) => shift(p, -8, style === "sitting" ? 2 : -1)) as Arms;
  const frames = [pose(whole, front), pose(whole, back), pose(whole, back)];
  if (style === "pronated") {
    anchoring.push(["palm-down", 4, 11], ["palm-down", 6, 12]);
    return clip(frames.map((points) => [...points, shift(points[4], 4, 1), shift(points[6], 4, 1)]), props, anchoring, 1015);
  }
  return clip(frames, props, anchoring, 1015);
}

function aroundShoulder(style: "circle" | "elevate" | "load", front = true): Illustration {
  const base = front ? upright : sideStand;
  const at = (dx: number, dy: number): Point[] => {
    const [x, y] = base.body[1];
    const torso: Setup = { ...base, body: [base.body[0], shift(base.body[1], style === "load" ? 0 : dx, style === "load" ? 0 : dy), base.body[2]] };
    return pose(torso, [[x + 16 + dx, y + 27 + dy], [x + 19 + dx, y + 52 + dy],
      [x - 15 + (style === "load" ? 0 : dx), y + 28 + (style === "load" ? 0 : dy)],
      [x - 16 + (style === "load" ? 0 : dx), y + 53 + (style === "load" ? 0 : dy)]]);
  };
  const center = at(0, 0), up = at(0, -8), bottom = at(0, 5), frontFrame = at(5, 0), backFrame = at(-5, 0);
  const frames = style === "circle" ? [center, up, backFrame, bottom, frontFrame, up, frontFrame, bottom, backFrame, up]
    : style === "elevate" ? [center, up, up, center, bottom, bottom] : [center, up, up, center];
  return clip(frames, [], style === "load" ? [["dumbbell", 4, 0, 0]] : [], 650);
}

function circleArms(kind: "touch-shoulders" | "seated"): Illustration {
  const seatedStyle = kind === "seated";
  const base = seatedStyle ? onChair : upright;
  const motion = [0, 1, 2, 3, 0, 3, 2, 1].map((step): Point[] => {
    const [x, y] = base.body[1];
    const elbowX = [38, 34, 26, 33][step], elbowY = [3, -11, 4, 18][step];
    const right: Point = [x + elbowX, y + elbowY], left: Point = [x - elbowX, y + elbowY];
    const hands: Pair = seatedStyle ? [[x + elbowX + 24, y + elbowY + 2], [x - elbowX - 24, y + elbowY + 2]]
      : [[x + 11, y + 3], [x - 11, y + 3]];
    return pose(base, [right, hands[0], left, hands[1]]);
  });
  if (!seatedStyle) return clip(motion, base.props, [], 660);
  return clip(motion.map((points) => [...points, shift(points[4], 4, 0), shift(points[6], -4, 0)]), base.props,
    [["palm-up", 4, 11], ["palm-up", 6, 12]], 660);
}

function barShoulder(swing: boolean): Illustration {
  const fixed: Pair = [[173, 27], [131, 27]];
  const support: Props = [[83, 26, 220, 26], [86, 26, 86, 157], [218, 26, 218, 157]];
  const at = (move: number, height: number) => {
    const relaxed: Setup = {
      body: [[151 + move * .7, 75 + height], [151 + move, 86 + height], [151 + move, 125 + height]],
      legs: [[163 + move, 140 + height], [166 + 1.4 * move, 156 + height],
        [141 + move, 140 + height], [142 + 1.4 * move, 155 + height]],
    };
    return pose(relaxed, [[(fixed[0][0] + relaxed.body[1][0]) / 2, 55 + height / 2], fixed[0],
      [(fixed[1][0] + relaxed.body[1][0]) / 2, 55 + height / 2], fixed[1]]);
  };
  return clip(swing ? [at(0, 0), at(0, -8), at(8, -8), at(0, -8), at(-8, -8), at(0, -8)] : [at(0, 0), at(0, -8), at(0, -8)],
    support, [], 960);
}

function behind(kind: "clasp" | "straight-stick" | "internal-stick" | "towel-up" | "towel-down" | "towel-out" | "wide-stick" | "test"): Illustration {
  const low: Arms = [[137, 87], [136, 116], [128, 88], [130, 115]];
  const top: Arms = [[130, 86], [110, 108], [126, 88], [108, 110]];
  if (kind === "clasp" || kind === "straight-stick") {
    const load: Attachments = kind === "straight-stick" ? [["bar", 4, 6]] : [];
    return kind === "clasp" ? stay(pose(sideStand, low), pose(sideStand, top), [], load)
      : clip([pose(sideStand, low), pose(sideStand, top), pose(sideStand, top)], [], load);
  }
  if (kind === "test") return clip([
    pose(sideStand, [[172, 93], [142, 111], [127, 84], [126, 107]]),
    pose(sideStand, [[170, 92], [139, 90], [126, 85], [126, 110]]),
  ], [], [], 1250);
  const start: Arms = [[150, 43], [138, 65], [128, 113], [135, 104]];
  const handRise: Arms = [[147, 39], [136, 54], [126, 110], [133, 83]];
  const handDrop: Arms = [[150, 47], [139, 74], [125, 114], [137, 112]];
  const wide: Arms = [[128, 54], [115, 52], [123, 111], [121, 96]];
  const load: Attachments = [[kind.endsWith("stick") ? "bar" : "line", 4, 6]];
  const target = kind === "towel-down" ? handDrop : kind === "wide-stick" || kind === "towel-out" ? wide : handRise;
  const a = pose(sideStand, start), b = pose(sideStand, target);
  return kind === "towel-up" || kind === "towel-down" ? stay(a, b, [], load) : clip([a, b, b], [], load, 1050);
}

function crossStretch(bent: boolean): Illustration {
  const neutral: Arms = [[174, 82], [164, 98], [133, 83], [151, 90]];
  const held: Arms = bent ? [[151, 75], [135, 66], [132, 83], [153, 74]] :
    [[155, 68], [126, 70], [128, 87], [150, 68]];
  return stay(pose(upright, neutral), pose(upright, held));
}

function doorStretch(bent: boolean): Illustration {
  const open: Setup = { ...sideStand, body: [[158, 43], [153, 59], [146, 104]] };
  const away: Setup = { ...sideStand, body: bent ? [[147, 40], [143, 57], [140, 104]]
    : [[170, 43], [159, 59], [147, 103]] };
  const arm: Arms = bent ? [[181, 64], [184, 38], [136, 84], [131, 109]] :
    [[128, 66], [102, 73], [146, 85], [144, 108]];
  const frameX = bent ? 185 : 101;
  return stay(pose(open, arm), pose(away, arm), [[frameX, 18, frameX, 158], [frameX - 5, 157, frameX + 15, 157]]);
}

function terraceStretch(floor: boolean): Illustration {
  const base = floor ? atFloor : onChair;
  const flat: Arms = floor ? [[117, 118], [110, 154], [124, 124], [120, 155]] :
    [[120, 89], [119, 110], [127, 87], [127, 109]];
  const lean: Setup = { ...base, body: [shift(base.body[0], 8, 0), shift(base.body[1], 8, 1), shift(base.body[2], floor ? 10 : 0, 0)] };
  return stay(pose(base, flat), pose(lean, flat), base.props);
}

function wallIsometric(direction: Direction): Illustration {
  const elbow: Point = [174, 89];
  const still: Arms = [elbow, [198, 89], [133, 83], [129, 111]];
  const contact: Arms = [elbow, [direction === "out" ? 204 : 208, 89], [133, 83], [129, 111]];
  return stay(pose(sideStand, still), pose(sideStand, contact), [[211, 26, 211, 157]],
    direction === "out" ? [["pad", 4, 5, 0]] : [], direction === "out" ? 14 : 7);
}

function wallTurn(direction: Direction, towel: boolean): Illustration {
  const wallX = towel ? 189 : 215;
  const elbow: Point = [towel ? 165 : 197, 88];
  const wall: Props = [[wallX, 29, wallX, 157], [wallX, 157, wallX + 25, 157],
    [wallX, 31, wallX + 25, 31], [wallX + 25, 31, wallX + 25, 157]];
  const at = (wrist: Point) => pose(sideStand, [elbow, wrist, [137, 88], [136, 112]]);
  const low: Point = towel ? [187, 101] : [213, 111];
  const high: Point = towel ? [187, 74] : [213, 62];
  const frames = direction === "out" ? [at(low), at(high)] : [at(high), at(low)];
  return clip(frames, wall, towel ? [["pad", 4, 1, 2]] : [], 1210);
}

function strapsRotation(): Illustration {
  const leaned: Setup = {
    body: [[134, 47], [134, 64], [150, 106]],
    legs: [[159, 131], [170, 156], [153, 132], [159, 156]],
  };
  const base: Arms = [[152, 92], [171, 83], [132, 92], [148, 83]];
  const out: Arms = [[152, 92], [168, 72], [132, 92], [113, 76]];
  return clip([pose(leaned, base), pose(leaned, out)], [[245, 31, 245, 157], [214, 37, 245, 31]],
    [["line", 4, 229, 38], ["line", 6, 218, 40], ["pad", 4, 0, 0], ["pad", 6, 0, 0]], 1110);
}

function faceRope(): Illustration {
  const relaxed: Setup = { ...sideStand, body: [[144, 40], [145, 56], [150, 103]] };
  const open = pose(relaxed, [[174, 57], [204, 60], [167, 56], [193, 60]]);
  const pulled = pose(relaxed, [[151, 61], [171, 58], [134, 62], [159, 58]]);
  const rotated = pose(relaxed, [[151, 61], [154, 37], [134, 62], [137, 38]]);
  const ropePoint = (arr: Point[]): Point[] => [...arr, [Math.max(arr[4][0], arr[6][0]) + 8, (arr[4][1] + arr[6][1]) / 2]];
  return clip([open, pulled, rotated, pulled].map(ropePoint), pulley(242, 66, false),
    [["cable", 11, 242, 66], ["line", 4, 11], ["line", 6, 11]], 810);
}

function halo(gear: "kettlebell" | "bottle-upright" | "mace"): Illustration {
  const setup = gear === "kettlebell" ? oneKnee : upright;
  const [x, y] = setup.body[0];
  const waypoints: Point[] = [[x + 4, y + 34], [x + 25, y + 9], [x + 9, y - 10], [x - 12, y - 7], [x - 24, y + 9], [x - 3, y + 31]];
  const frames = waypoints.map((holding): Point[] => [
    ...pose(setup, [shift(holding, 12, 19), shift(holding, 4, 5), shift(holding, -11, 19), shift(holding, -4, 6)]),
    holding, shift(holding, 0, gear === "mace" ? -20 : 0),
  ]);
  const dynamic: Attachments = gear === "mace" ? [["line", 11, 12], ["ball", 12, 0, 0]] :
    [[gear, 11, 0, gear === "kettlebell" ? -10 : 0]];
  return clip(frames, [], dynamic, 820);
}

const cableKneelOut = armAtSide(bothKnees, "out", "cable", 138, true);
const standingBandOut = armAtSide(sideStand, "out", "band", undefined, true);
const standingBandIn = armAtSide(sideStand, "in", "band");
const plainOut = armAtSide(upright, "out", "none", undefined, true);
const plainIn = armAtSide(upright, "in", "none", undefined, true);
const sideUnweighted = sideLying("out", "none", false);
const sideDbBench = sideLying("out", "dumbbell", true);
const shoulderRoll = aroundShoulder("circle", false);
const basicSlide = aboveShoulder("wall");
const straightBehindStretch = behind("clasp");

export const shoulderMobilityIllustrations: Readonly<Record<string, Illustration>> = {
  "0921": standingBandOut,
  "0924": standingBandIn,
  "0935": standingBandOut,
  "6754": sideUnweighted,
  "10934": sideLying("out", "towel", false),
  "8342": rotateBoth("standing"),
  "10597": shoulderHigh("standing", "in", "cable", "catch"),
  "11060": faceRope(),
  "4194": armAtSide(oneKnee, "out", "cable", undefined, true),
  "8879": shoulderHigh("half-kneeling", "out", "cable", "press"),
  "5821": shoulderHigh("kneeling", "out", "cable", "press"),
  "6755": cableKneelOut,
  "6756": armAtSide(bothKnees, "in", "cable", 138, true),
  "11057": rowsWithoutElbows("cable"),
  "5087": shoulderHigh("standing", "out", "cable"),
  "5089": shoulderHigh("standing", "in", "cable"),
  "5088": armAtSide(sideStand, "in", "cable"),
  "3693": sideDbBench,
  "3684": sideLying("out", "dumbbell", false),
  "6140": rotateBoth("supported-dumbbell"),
  "5001": rotateBoth("supported-dumbbell"),
  "5065": shoulderHigh("standing", "in", "dumbbell"),
  "5817": sideDbBench,
  "7234": armAtSide(sideStand, "out", "dumbbell", undefined, true),
  "7235": armAtSide(upright, "out", "dumbbell"),

  "0256": circleArms("touch-shoulders"),
  "5311": aboveShoulder("ball"),
  "11796": plainOut,
  "1990": doorStretch(true),
  "5027": aboveShoulder("foam"),
  "2941": aboveShoulder("wall", false, true),
  "4177": barShoulder(false),
  "11785": plainIn,
  "1991": behind("towel-up"),
  "8331": halo("kettlebell"),
  "5448": rowsWithoutElbows("pronated"),
  "11056": rowsWithoutElbows("lever"),
  "4602": assistedRotation("pvc"),
  "2151": standingBandOut,
  "5024": aboveShoulder("wall", true),
  "5026": aboveShoulder("foam", true),
  "8363": shoulderHigh("standing", "out", "band"),
  "6441": standingBandOut,
  "8361": standingBandOut,
  "8360": standingBandIn,
  "6440": clip([
    pose(sideStand, [[158, 85], [123, 101], [136, 84], [128, 109]]),
    pose(sideStand, [[183, 83], [205, 96], [136, 84], [128, 109]]),
  ], pulley(85, 108, true), [["band", 4, 85, 108]]),
  "6439": raiseForward("band", "front"),
  "5025": basicSlide,

  "1980": crossStretch(false),
  "4394": wallBack("alternate"),
  "4516": passThrough("band"),
  "1981": crossStretch(true),
  "1983": stay(
    pose(upright, [[172, 83], [176, 109], [134, 82], [132, 109]]),
    pose(upright, [[163, 31], [157, 9], [138, 30], [139, 9]]),
  ),
  "1982": assistedRotation("hand-stretch"),
  "3130": aroundShoulder("elevate"),
  "3129": rowsWithoutElbows("body"),
  "2945": wallBack("slide"),
  "8617": rotateBoth("chair"),
  "8655": circleArms("seated"),
  "4395": shoulderRoll,
  "2777": raiseForward("none", "back"),
  "6790": plainOut,
  "2778": raiseForward("none", "front"),
  "2931": wallBack("flex"),
  "6791": behind("test"),
  "2779": plainOut,
  "2780": plainIn,
  "1488": straightBehindStretch,
  "10932": behind("towel-up"),
  "2088": behind("towel-down"),
  "10933": sideUnweighted,
  "7213": sideLying("in", "none", false),
  "6913": rowsWithoutElbows("sitting"),
  "6914": rowsWithoutElbows("bent-arm"),
  "10931": behind("towel-out"),
  "10930": wallTurn("out", true),
  "10929": wallTurn("in", true),
  "10126": wallIsometric("out"),
  "9990": wallIsometric("in"),
  "1974": straightBehindStretch,
  "7232": shoulderRoll,
  "7233": aroundShoulder("circle"),
  "3416": shoulderRoll,
  "10937": wallTurn("out", false),
  "9980": raiseForward("stick", "overhead"),
  "9989": behind("internal-stick"),
  "9184": raiseForward("stick", "side"),
  "10935": behind("wide-stick"),
  "10936": passThrough("stick"),
  "9180": behind("straight-stick"),
  "9181": assistedRotation("stick"),
  "6811": assistedRotation("stick-stretch"),
  "1096": strapsRotation(),
  "1792": crossStretch(false),
  "1971": straightBehindStretch,
  "1976": doorStretch(false),
  "1978": stay(
    pose(sideStand, [[139, 87], [128, 112], [131, 93], [139, 109]]),
    pose(sideStand, [[132, 82], [113, 103], [128, 90], [115, 105]]),
  ),
  "1975": terraceStretch(false),
  "3564": terraceStretch(true),
  "10948": barShoulder(true),
  "6123": aroundShoulder("load"),
  "6137": rowsWithoutElbows("body"),
  "6077": halo("bottle-upright"),
  "10411": halo("mace"),
  "9185": raiseForward("rope", "front"),
};
