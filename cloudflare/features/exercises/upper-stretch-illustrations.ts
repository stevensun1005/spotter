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
type Person = { setup: Setup; arms: Arms };

const standing: Setup = {
  body: [[150, 38], [151, 55], [149, 102]],
  legs: [[164, 128], [170, 156], [134, 129], [130, 157]],
};
const standingSide: Setup = {
  body: [[163, 39], [155, 57], [146, 102]],
  legs: [[148, 127], [152, 156], [136, 131], [135, 156]],
};
const chair: Props = [[129, 117, 172, 117], [135, 118, 135, 156], [168, 118, 168, 157],
  [132, 65, 132, 116]];
const onChair: Setup = {
  body: [[157, 49], [154, 65], [147, 111]],
  legs: [[180, 117], [186, 157], [164, 119], [169, 157]],
  props: chair,
};
const crossSeat: Setup = {
  body: [[149, 74], [149, 91], [149, 148]],
  legs: [[185, 149], [133, 155], [111, 148], [161, 155]],
};
const table: Setup = {
  body: [[179, 90], [164, 101], [124, 106]],
  legs: [[123, 153], [89, 156], [112, 152], [79, 156]],
};
const allFours: Arms = [[164, 128], [167, 154], [154, 129], [155, 156]];

function pos(setup: Setup, arms: Arms, spine?: Point): Point[] {
  const points = [...setup.body, ...arms, ...setup.legs];
  if (spine) points.push(spine);
  return points;
}

function clip(frameList: Point[][], props: Props = [], dynamic: Attachments = [], ms = 1100, curved = false): Illustration {
  const demo: Illustration = { frames: frameList, props, dynamic, ms, reference: true };
  if (curved) demo.spine = [11];
  return demo;
}

function held(path: Point[][], props: Props = [], dynamic: Attachments = [], seconds = 20, curved = false): Illustration {
  return clip([...path.slice(0, -1), ...Array<Point[]>(seconds + 1).fill(path.at(-1)!)], props, dynamic, 1000, curved);
}

function shoulderWall(kind: "side" | "door" | "bars"): Illustration {
  const propX = kind === "bars" ? 209 : 195, shoulderY = 59;
  const props: Props = [[propX, 20, propX, 156], [propX - 8, 156, propX + 18, 156]];
  if (kind === "door") props.push([96, 18, propX, 18], [95, 18, 95, 156]);
  if (kind === "bars") {
    props.push([234, 21, 234, 156]);
    for (const y of [38, 58, 78, 99, 119, 139]) props.push([209, y, 234, y]);
  }
  const setup = kind === "door" ? standingSide : standing;
  const contact: Arms = kind === "bars" ? [[183, 69], [210, shoulderY], [138, 85], [136, 111]]
    : [[propX - 4, 62], [propX - 2, 37], [142, 83], [143, 109]];
  const opened: Setup = {
    body: kind === "door" ? [[151, 42], [145, 60], [149, 106]] : [[142, 38], [141, 56], [150, 101]],
    legs: kind === "door" ? [[166, 125], [181, 156], [134, 132], [120, 157]] : setup.legs,
  };
  return held([pos(setup, contact), pos(opened, contact)], props);
}

function cornerLean(): Illustration {
  const room: Props = [[210, 21, 210, 155], [210, 22, 239, 12], [210, 155, 248, 144],
    [114, 22, 114, 155], [114, 22, 82, 13], [114, 155, 74, 146]];
  const forearms: Arms = [[208, 63], [209, 36], [116, 63], [115, 37]];
  const start: Setup = { ...standing, body: [[163, 43], [162, 61], [161, 105]] };
  const entered: Setup = {
    body: [[162, 32], [163, 51], [156, 105]],
    legs: [[180, 126], [185, 157], [135, 129], [123, 157]],
  };
  return held([pos(start, forearms), pos(entered, forearms)], room);
}

function aboveHead(style: "clasp" | "straight" | "reach"): Illustration {
  const closed: Arms = [[171, 81], [166, 104], [130, 81], [138, 107]];
  const headward: Arms = style === "straight" ? [[170, 29], [175, 7], [133, 29], [127, 7]]
    : [[156, 31], [154, 8], [146, 31], [149, 8]];
  const prep = style === "reach" ? [pos(standing, [[181, 63], [205, 66], [169, 62], [198, 65]])] : [];
  return held([pos(standing, closed), ...prep, pos(standing, headward)], [], [], style === "reach" ? 17 : 20);
}

function rearOpening(clasp: boolean): Illustration {
  const setup = standingSide;
  const resting: Arms = [[146, 83], [140, 111], [139, 83], [137, 111]];
  const raised: Arms = clasp ? [[139, 81], [115, 100], [135, 80], [113, 101]]
    : [[141, 82], [116, 102], [137, 81], [107, 100]];
  return held([pos(setup, resting), pos(setup, raised)]);
}

function benchKneel(): Illustration {
  const seat: Props = [[167, 101, 229, 101], [175, 101, 175, 157], [222, 101, 222, 157]];
  const top: Setup = {
    body: [[162, 73], [152, 86], [132, 116]],
    legs: [[142, 152], [105, 156], [131, 153], [94, 156]],
  };
  const lower: Setup = {
    ...top, body: [[161, 129], [146, 123], [110, 127]],
  };
  const rest: Arms = [[180, 95], [211, 94], [173, 96], [203, 95]];
  return held([pos(top, rest), pos(lower, rest)], seat);
}

function catStretch(longer: boolean): Illustration {
  const folded: Setup = { ...table, body: [[173, 113], [164, 113], [119, 109]] };
  const neutral: Point[] = [...pos(table, allFours), [155, 101], [145, 102], [134, 104]];
  const rounded: Point[] = [...pos(folded, allFours), [155, 98], [141, 91], [128, 97]];
  return { ...held([neutral, rounded], [], [], longer ? 17 : 4), spine: [11, 12, 13] };
}

function thoracicTurn(): Illustration {
  const neutral = pos(table, [[169, 126], [178, 92], allFours[2], allFours[3]]);
  const opened: Setup = { ...table, body: [[179, 77], [164, 99], table.body[2]] };
  const high = pos(opened, [[155, 66], [174, 78], allFours[2], allFours[3]]);
  const closed: Setup = { ...table, body: [[174, 104], [161, 107], table.body[2]] };
  const low = pos(closed, [[150, 136], [171, 108], allFours[2], allFours[3]]);
  return clip([neutral, high, neutral, low], [], [], 980);
}

function openingBook(): Illustration {
  const sidelying: Setup = {
    body: [[104, 139], [125, 149], [170, 150]],
    legs: [[194, 143], [198, 155], [188, 146], [192, 157]],
  };
  const wait: Arms = [[153, 141], [181, 135], [149, 144], [177, 142]];
  const open: Setup = { ...sidelying, body: [[99, 141], [126, 147], sidelying.body[2]] };
  const mid: Arms = [[125, 118], [129, 91], wait[2], wait[3]];
  const far: Arms = [[102, 140], [75, 139], wait[2], wait[3]];
  return held([pos(sidelying, wait), pos(open, mid), pos(open, far)]);
}

function vPike(): Illustration {
  const base: Setup = {
    body: [[168, 116], [156, 106], [128, 67]],
    legs: [[99, 106], [75, 155], [93, 109], [70, 156]],
  };
  const lower: Setup = {
    body: [[185, 132], [172, 137], [125, 139]],
    legs: [[101, 145], [75, 156], [93, 146], [71, 156]],
  };
  const raised: Setup = {
    ...lower, body: [[168, 87], [157, 103], [126, 151]],
  };
  const wrists: Pair = [[185, 155], [176, 156]];
  const frames = [
    pos(base, [[173, 130], wrists[0], [164, 132], wrists[1]], [141, 85]),
    pos(lower, [[160, 126], wrists[0], [151, 127], wrists[1]], [148, 137]),
    pos(raised, [[173, 129], wrists[0], [164, 129], wrists[1]], [148, 125]),
  ];
  return clip([...frames, frames[1]], [], [], 1060, true);
}

function prayer(active: "standing" | "seated" | "squat"): Illustration {
  const start = active === "seated" ? onChair : standing;
  const forward: Arms = [[174, 87], [154, 76], [125, 88], [148, 76]];
  const reaching: Arms = [[183, 79], [153, 72], [117, 79], [150, 72]];
  const palm = (setup: Setup, arms: Arms): Point[] => [...pos(setup, arms), [arms[1][0] - 1, arms[1][1] - 6], [arms[3][0] + 1, arms[3][1] - 6]];
  const finger: Attachments = [["palm-up", 4, 11], ["palm-up", 6, 12]];
  if (active !== "squat") return held([palm(start, forward), palm(start, reaching)], start.props, finger, active === "seated" ? 12 : 7);
  const deep: Setup = { ...standing, body: [[151, 76], [151, 92], [150, 132]],
    legs: [[183, 127], [187, 157], [117, 126], [113, 157]] };
  return held([palm(standing, forward), palm(deep, [[180, 124], [153, 108], [120, 124], [149, 108]])], [], finger, 31);
}

function proneLift(kind: "clasp" | "under" | "wide" | "locust"): Illustration {
  const body: Setup = {
    body: [[169, 147], [153, 147], [106, 152]],
    legs: [[82, 153], [53, 156], [77, 155], [49, 157]],
  };
  const rise: Setup = { ...body,
    body: [[173, 121], [155, 133], body.body[2]],
    legs: kind === "locust" ? [[83, 138], [55, 130], [79, 140], [48, 132]] : body.legs,
  };
  const variants: Record<typeof kind, [Arms, Arms]> = {
    clasp: [[[132, 136], [104, 144], [128, 139], [101, 144]], [[129, 132], [103, 138], [125, 135], [100, 139]]],
    under: [[[131, 153], [103, 155], [128, 153], [99, 156]], [[131, 143], [103, 155], [128, 145], [99, 156]]],
    wide: [[[172, 151], [198, 157], [138, 151], [113, 155]], [[178, 135], [201, 137], [132, 136], [108, 141]]],
    locust: [[[131, 149], [106, 153], [128, 151], [103, 154]], [[130, 130], [104, 135], [127, 133], [100, 137]]],
  };
  return held([pos(body, variants[kind][0], [128, 150]), pos(rise, variants[kind][1], [133, 143])], [],
    [], kind === "locust" ? 13 : 20, true);
}

function upperReach(withClasp: boolean): Illustration {
  const relax: Setup = standingSide;
  const rounded: Setup = { ...relax, body: [[167, 65], [154, 71], relax.body[2]] };
  const rest: Arms = [[179, 71], [203, 68], [170, 69], [192, 68]];
  const outstretched: Arms = [[184, 74], [213, 77], [176, 76], [withClasp ? 210 : 202, 77]];
  return held([pos(relax, rest, [151, 83]), pos(rounded, outstretched, [139, 82])], [], [], 20, true);
}

function seatedOpen(kind: "cross" | "clam" | "chair"): Illustration {
  const base = onChair;
  const arched: Setup = { ...base, body: [[156, 47], [151, 63], base.body[2]] };
  const variants: Record<typeof kind, [Arms, Arms]> = {
    cross: [[[167, 84], [140, 74], [139, 86], [162, 74]], [[180, 66], [205, 65], [126, 65], [101, 66]]],
    clam: [[[176, 64], [161, 48], [171, 65], [153, 47]], [[182, 62], [162, 47], [126, 65], [148, 48]]],
    chair: [[[134, 90], [130, 107], [136, 91], [131, 104]], [[130, 82], [131, 104], [131, 83], [133, 102]]],
  };
  return held([pos(base, variants[kind][0]), pos(arched, variants[kind][1])], chair, [], kind === "cross" ? 7 : 20);
}

function torsoTwist(kind: "sitting" | "stick" | "wide"): Illustration {
  const wide = kind === "wide", stick = kind === "stick";
  const setup: Setup = kind === "sitting" ? crossSeat : wide ? { ...standingSide,
    body: [[163, 57], [155, 70], [143, 107]],
    legs: [[181, 129], [187, 157], [119, 131], [110, 157]],
  } : standing;
  const [x, y] = setup.body[1];
  const base: Arms = wide ? [[x + 29, y - 3], [x + 8, y - 12], [x - 29, y - 3], [x - 8, y - 12]] :
    [[x + 30, y + 1], [x + 54, y + 1], [x - 30, y + 1], [x - 54, y + 1]];
  const at = (turn: number) => {
    const turnSetup: Setup = {
      ...setup, body: [[setup.body[0][0] + turn * 12, setup.body[0][1] - 2], [x + turn * 7, y], setup.body[2]],
    };
    const moved = base.map(([bx, by], index): Point => [x + (bx - x) * .53 + turn * (index > 1 ? 2 : 8), by + turn * (index > 1 ? 7 : -7)]) as Arms;
    return pos(turnSetup, moved);
  };
  const straight = pos(setup, base);
  return clip([straight, at(1), straight, at(-1)], [], stick ? [["bar", 4, 6]] : [], 1050);
}

function seatedSumo(side: -1 | 1): Illustration {
  const wide: Setup = {
    ...crossSeat, legs: [[187, 150], [220, 156], [113, 153], [79, 156]],
  };
  const shifted: Setup = {
    ...wide, body: [[149 + 41 * side, 115], [149 + 28 * side, 124], wide.body[2]],
  };
  const rest: Arms = [[173, 111], [182, 136], [123, 114], [116, 138]];
  const heldArms: Arms = [[149 + 52 * side, 133], [149 + 68 * side, 153], [149 + 48 * side, 135], [149 + 66 * side, 151]];
  return held([pos(wide, rest), pos(shifted, heldArms)]);
}

function hangingStretch(): Illustration {
  const upright: Setup = { ...standingSide, body: [[154, 43], [152, 60], [146, 102]],
    legs: [[150, 130], [162, 156], [132, 130], [139, 156]] };
  const seatedBack: Setup = { ...upright,
    body: [[135, 92], [125, 94], [103, 128]],
    legs: [[132, 136], upright.legs[1], [118, 136], upright.legs[3]],
  };
  const straightHands: Arms = [[179, 71], [207, 77], [171, 71], [197, 76]];
  const pulled: Arms = [[155, 92], [182, 90], [147, 90], [172, 88]];
  return held([pos(upright, straightHands, [150, 82]), pos(seatedBack, pulled, [111, 105])],
    [[242, 27, 242, 157], [222, 32, 242, 27]], [["line", 4, 236, 35], ["line", 6, 224, 36]], 20, true);
}

function thoracicBridge(): Illustration {
  const seated: Setup = {
    body: [[127, 108], [133, 123], [151, 150]],
    legs: [[180, 127], [195, 156], [167, 130], [179, 157]],
  };
  const lifted: Setup = { ...seated, body: [[127, 107], [138, 110], [163, 115]] };
  const palm: Point = [107, 157];
  const neutral = pos(seated, [[151, 134], [170, 140], [120, 142], palm], [141, 136]);
  const rise = pos(lifted, [[151, 83], [158, 53], [122, 135], palm], [151, 108]);
  return clip([neutral, rise, rise], [], [], 1050, true);
}

function threadNeedle(): Illustration {
  const lowered: Setup = { ...table, body: [[163, 147], [148, 149], [124, 107]] };
  return held([pos(table, allFours, [145, 104]),
    pos(lowered, [[128, 150], [103, 153], [169, 132], allFours[3]], [134, 129])], [], [], 18, true);
}

function camel(): Illustration {
  const setup: Setup = {
    body: [[153, 52], [151, 69], [149, 113]],
    legs: [[148, 153], [114, 156], [135, 153], [101, 156]],
  };
  const arch: Setup = { ...setup, body: [[109, 67], [127, 77], [150, 109]] };
  const standingHands: Arms = [[130, 93], [144, 104], [128, 96], [140, 104]];
  const grasp: Arms = [[120, 119], [116, 152], [116, 118], [103, 152]];
  return held([[...pos(setup, standingHands, [150, 91]), [159, 52]],
    [...pos(arch, grasp, [147, 84]), [109, 60]]], [], [["face", 0, 12]], 20, true);
}

function cowFace(): Illustration {
  const seat: Setup = {
    ...crossSeat, legs: [[156, 130], [126, 155], [150, 137], [176, 156]],
  };
  const neutral: Arms = [[169, 119], [160, 137], [128, 120], [137, 141]];
  const reaching: Arms = [[154, 52], [147, 93], [126, 123], [144, 101]];
  return held([pos(seat, neutral), pos(seat, reaching)]);
}

function crocodile(): Illustration {
  const floor: Setup = {
    body: [[188, 143], [171, 150], [126, 152]],
    legs: [[102, 153], [72, 156], [93, 154], [66, 156]],
  };
  const high: Setup = {
    ...floor, body: [[188, 102], [172, 112], [128, 129]],
    legs: [[101, 145], [75, 155], [94, 145], [67, 157]],
  };
  const low: Setup = { ...high, body: [[188, 124], [173, 133], [128, 141]] };
  const wrist: Pair = [[174, 155], [164, 156]];
  return held([
    pos(floor, [[147, 143], wrist[0], [142, 147], wrist[1]]),
    pos(high, [[174, 136], wrist[0], [166, 138], wrist[1]]),
    pos(low, [[150, 136], wrist[0], [145, 138], wrist[1]]),
  ]);
}

function fish(): Illustration {
  const lying: Setup = {
    body: [[102, 147], [120, 151], [168, 152]],
    legs: [[190, 151], [217, 156], [187, 153], [206, 155]],
  };
  const arch: Setup = { ...lying, body: [[104, 149], [120, 130], [168, 151]] };
  const forearms: Arms = [[139, 154], [166, 156], [130, 153], [153, 156]];
  return held([pos(lying, forearms, [144, 152]), pos(arch, forearms, [143, 123])], [], [], 18, true);
}

function wheel(oneLeg = false, seconds = 9): Illustration {
  const initial: Setup = {
    body: [[104, 147], [123, 152], [170, 152]],
    legs: [[188, 123], [207, 156], [181, 125], [196, 157]],
  };
  const upward: Setup = { ...initial, body: [[107, 101], [119, 93], [171, 88]],
    legs: [[193, 118], [207, 156], [184, 115], [196, 157]] };
  const active: Setup = { ...upward, legs: [[178, 55], [180, 17], upward.legs[2], upward.legs[3]] };
  const hands: Pair = [[100, 156], [108, 157]];
  const low: Arms = [[119, 129], hands[0], [123, 129], hands[1]];
  const wide: Arms = [[109, 122], hands[0], [117, 123], hands[1]];
  const curl: Point[] = [[129, 77], [146, 70], [161, 76]];
  const path: Point[][] = [[...pos(initial, low), [134, 152], [146, 152], [156, 152]], [...pos(upward, wide), ...curl]];
  if (oneLeg) path.push([...pos(active, wide), ...curl]);
  return { ...held(path, [], [], seconds), spine: [11, 12, 13] };
}

function puppy(): Illustration {
  const chestDown: Setup = { ...table, body: [[186, 147], [166, 142], table.body[2]] };
  const extend: Arms = [[194, 148], [224, 155], [188, 149], [213, 156]];
  return held([pos(table, allFours, [142, 103]), pos(chestDown, extend, [144, 124])], [], [], 18, true);
}

function twistedFloor(down: boolean): Illustration {
  const setup: Setup = down ? {
    body: [[180, 146], [161, 151], [112, 152]],
    legs: [[88, 152], [58, 156], [78, 154], [53, 156]],
  } : {
    ...crossSeat, body: [[152, 73], [150, 89], [148, 150]],
    legs: [[172, 125], [180, 157], [108, 150], [83, 155]],
  };
  if (down) {
    const peak: Setup = { ...setup, legs: [[104, 121], [128, 92], setup.legs[2], setup.legs[3]] };
    const turned: Setup = { ...setup, legs: [[104, 123], [135, 148], setup.legs[2], setup.legs[3]] };
    const arms: Arms = [[187, 151], [212, 155], [134, 151], [110, 156]];
    return held([pos(setup, arms, [137, 150]), pos(peak, arms, [138, 140]), pos(turned, arms, [138, 140])], [], [], 20, true);
  }
  const first: Arms = [[171, 115], [184, 128], [124, 120], [112, 136]];
  const second: Arms = [[176, 103], [170, 129], [138, 117], [171, 122]];
  return held([pos(setup, first), pos({ ...setup, body: [[161, 74], [155, 92], setup.body[2]] }, second)]);
}

function assisted(kind: "prone" | "supine" | "seated" | "standing" | "behind" | "flexed" | "seated-back"): Illustration {
  const prone = kind === "prone", floor = prone || kind === "supine";
  const sitter = kind === "seated" || kind === "flexed" || kind === "seated-back";
  const elbowGrip = kind === "seated" || kind === "flexed";
  const fixedLegs: Setup["legs"] = [[100, 152], [71, 155], [92, 153], [66, 156]];
  const faceDown: Setup = { body: [[187, 147], [166, 150], [123, 151]], legs: fixedLegs };
  const faceUp: Setup = {
    body: [[106, 145], [121, 151], [167, 150]],
    legs: [[192, 152], [216, 156], [187, 154], [205, 157]],
  };
  const base = prone ? faceDown : floor ? faceUp : sitter ? onChair : standingSide;
  const variants: Record<typeof kind, [Arms, Arms]> = {
    prone: [[[187, 144], [202, 151], [150, 143], [122, 151]], [[180, 138], [190, 116], [147, 138], [132, 117]]],
    supine: [[[147, 134], [167, 127], [106, 134], [88, 125]], [[150, 146], [174, 151], [106, 146], [83, 151]]],
    seated: [[[172, 65], [160, 48], [152, 68], [148, 49]], [[181, 66], [159, 48], [132, 67], [148, 49]]],
    standing: [[[179, 62], [199, 65], [146, 65], [124, 68]], [[172, 59], [192, 61], [142, 62], [119, 64]]],
    behind: [[[149, 84], [135, 107], [140, 85], [127, 107]], [[141, 77], [122, 97], [134, 77], [113, 94]]],
    flexed: [[[176, 64], [160, 49], [147, 68], [149, 49]], [[187, 81], [171, 65], [138, 86], [157, 66]]],
    "seated-back": [[[137, 90], [124, 108], [130, 89], [115, 106]], [[129, 83], [115, 95], [122, 83], [105, 94]]],
  };
  const open: Setup = kind === "flexed" ? { ...base, body: [[166, 60], [163, 78], base.body[2]] } : base;
  const stretched: Person = { setup: open, arms: variants[kind][1] };
  const initial: Person = { setup: base, arms: variants[kind][0] };
  const second: Setup = floor ? {
    body: [[136, 83], [139, 102], [124, 123]],
    legs: [[149, 132], [153, 156], [115, 151], [88, 155]],
  } : {
    body: [[120, 37], [125, 53], [117, 101]],
    legs: [[129, 127], [135, 156], [111, 129], [105, 156]],
  };
  const assist = ({ arms }: Person) => {
    const [sx, sy] = second.body[1];
    const target1 = arms[elbowGrip ? 0 : 1], target2 = arms[elbowGrip ? 2 : 3];
    const e1: Point = [(sx + target1[0]) / 2, (sy + target1[1]) / 2 + 5];
    const e2: Point = [(sx + target2[0]) / 2, (sy + target2[1]) / 2 + 9];
    return pos(second, [e1, target1, e2, target2]);
  };
  const main = held([pos(initial.setup, initial.arms), pos(stretched.setup, stretched.arms)], base.props);
  const hold = assist(stretched);
  return { ...main, partnerFrames: [assist(initial), ...Array<Point[]>(main.frames.length - 1).fill(hold)] };
}

const behindHug = rearOpening(true);
const openness = openingBook();
const camelPose = camel();

export const upperStretchIllustrations: Readonly<Record<string, Illustration>> = {
  "1777": aboveHead("clasp"),
  "1780": shoulderWall("side"),
  "1051": catStretch(true),
  "2106": catStretch(false),
  "4945": behindHug,
  "1781": cornerLean(),
  "1816": aboveHead("straight"),
  "1785": benchKneel(),
  "8052": thoracicTurn(),
  "4601": openness,
  "3960": vPike(),
  "4876": prayer("standing"),
  "4387": prayer("squat"),
  "3230": proneLift("clasp"),
  "3226": proneLift("under"),
  "1794": upperReach(true),
  "1795": upperReach(false),
  "1782": behindHug,
  "11006": seatedOpen("cross"),
  "5078": seatedOpen("clam"),
  "10463": seatedOpen("chair"),
  "4307": torsoTwist("sitting"),
  "8289": openness,
  "8200": prayer("seated"),
  "3633": seatedSumo(-1),
  "3632": seatedSumo(1),
  "1783": shoulderWall("bars"),
  "5557": shoulderWall("door"),
  "1058": shoulderWall("side"),
  "5403": torsoTwist("stick"),
  "1787": rearOpening(false),
  "4825": proneLift("wide"),
  "1153": hangingStretch(),
  "4553": thoracicBridge(),
  "5904": threadNeedle(),
  "1365": aboveHead("reach"),
  "9246": torsoTwist("wide"),
  "3505": camelPose,
  "6303": camelPose,
  "6902": cowFace(),
  "4372": crocodile(),
  "0950": fish(),
  "1484": proneLift("locust"),
  "6298": wheel(true, 7),
  "5897": puppy(),
  "6295": twistedFloor(false),
  "4631": twistedFloor(true),
  "6297": wheel(),
  "1493": wheel(false, 12),
  "1790": assisted("prone"),
  "1784": assisted("behind"),
  "1779": assisted("seated"),
  "1778": assisted("standing"),
  "1789": assisted("supine"),
  "1786": assisted("flexed"),
  "1973": assisted("seated-back"),
};
