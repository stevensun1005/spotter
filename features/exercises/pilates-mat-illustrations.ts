import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const extend = (base: Point[], joints: Partial<Record<number, Point>>) => base.map((p, i) => joints[i] ?? p);
const clip = (frames: Point[][], ms = 820, props?: Props, dynamic?: Attachments): Illustration => ({
  frames, ms, props, dynamic, reference: true,
});
const mat: Props = [[52, 158, 251, 158]];
const reclined: Point[] = [[84, 148], [105, 150], [152, 150], [127, 152], [151, 154], [125, 148], [149, 150],
  [194, 151], [236, 155], [188, 149], [230, 152]];
const armsOverhead = extend(reclined, { 3: [77, 149], 4: [54, 150], 5: [74, 145], 6: [51, 146] });
const feetDown = extend(reclined, { 7: [179, 115], 8: [200, 155], 9: [173, 115], 10: [192, 154] });
const curled = extend(reclined, { 0: [92, 118], 1: [112, 131] });
const bothUp = extend(reclined, { 7: [153, 111], 8: [154, 74], 9: [149, 111], 10: [146, 74] });
const tabletop = extend(reclined, { 7: [155, 111], 8: [191, 109], 9: [151, 109], 10: [185, 106] });
const upright: Point[] = [[136, 82], [139, 101], [146, 151], [164, 104], [195, 105], [161, 102], [187, 103],
  [188, 149], [228, 151], [182, 146], [220, 148]];
const teaser = extend(upright, { 0: [123, 87], 1: [129, 105], 3: [153, 95], 4: [177, 81], 5: [149, 93], 6: [173, 78],
  7: [170, 117], 8: [191, 83], 9: [166, 115], 10: [185, 81] });

function pulseHundred(reformer: boolean): Illustration {
  const offset = reformer ? -28 : 0;
  const atCarriage = (p: Point[]) => p.map(([x, y]): Point => [x, y + offset]);
  const still = extend(reclined, { 7: tabletop[7], 8: tabletop[8], 9: tabletop[9], 10: tabletop[10],
    ...(reformer ? { 3: [113, 122], 4: [114, 90], 5: [105, 119], 6: [103, 90] } : {}) });
  const active = extend(curled, { 3: [140, 137], 4: [169, 141], 5: [137, 134], 6: [166, 138],
    7: [187, 132], 8: [222, 115], 9: [183, 130], 10: [218, 111] });
  const pulse = extend(active, { 3: [139, 131], 4: [168, 130], 5: [135, 128], 6: [165, 127] });
  const base: Props = reformer ? [[54, 139, 264, 139], [58, 139, 58, 158], [260, 139, 260, 158], [72, 130, 192, 130],
    [64, 144, 255, 144], [249, 141, 238, 105], [234, 105, 247, 105], [68, 90, 68, 140], [77, 90, 77, 138],
    [69, 103, 79, 103], [86, 126, 93, 115], [206, 138, 202, 134], [202, 134, 194, 140], [194, 140, 186, 135]] : mat;
  const straps: Attachments = reformer ? [["line", 4, 75, 103], ["line", 6, 69, 103], ["ring", 4, 0, 0], ["ring", 6, 0, 0]] : [];
  const beats = Array.from({ length: 20 }, (_, i) => i % 2 ? active : pulse);
  return clip([still, active, ...beats, active, still].map(atCarriage), 400, base, straps);
}

function alternateLeg(style: "bicycle" | "knee" | "straight" | "toe-tap" | "wall"): Illustration {
  const tap = style === "toe-tap" || style === "wall";
  const headHands = extend(curled, { 3: [105, 112], 4: [90, 114], 5: [98, 108], 6: [86, 113] });
  const base = tap ? tabletop : style === "bicycle" ? headHands : curled;
  const tucked: [Point, Point] = [[156, 106], [185, 123]];
  const long: [Point, Point] = [[190, 145], [226, 146]];
  const tall: [Point, Point] = [[161, 108], [168, 70]];
  const wall: [Point, Point] = [[153, 109], [204, 110]];
  const frame = (near: boolean, pulse = false) => {
    if (tap) {
      const lowered: [Point, Point] = [[172, 128], [187, 155]];
      return extend(base, near ? { 7: lowered[0], 8: lowered[1],
        ...(style === "wall" ? { 9: wall[0], 10: wall[1] } : {}) }
        : { 9: [167, 126], 10: [183, 154], ...(style === "wall" ? { 7: wall[0], 8: wall[1] } : {}) });
    }
    const raised = style === "straight" ? (pulse ? [[150, 110], [146, 72]] as [Point, Point] : tall) : tucked;
    const reach: Point = style === "straight" ? [(raised[1][0] + raised[0][0]) / 2, 93] : [165, 110];
    const legChange = near ? { 7: raised[0], 8: raised[1], 9: long[0], 10: long[1] } :
      { 7: long[0], 8: long[1], 9: raised[0], 10: raised[1] };
    if (style === "bicycle") {
      return extend(base, { ...legChange, 0: near ? [99, 121] : [92, 121], 1: near ? [118, 135] : [108, 132],
        3: near ? [97, 106] : [135, 118], 5: near ? [130, 118] : [97, 104] });
    }
    return extend(base, { ...legChange, 3: [137, 119], 4: reach, 5: [134, 118], 6: [reach[0] - 5, reach[1] - 2] });
  };
  const initial = style === "wall" ? extend(tabletop, { 7: wall[0], 8: wall[1], 9: wall[0], 10: [204, 107] }) : tabletop;
  const frames = tap ? [initial, frame(true), initial, frame(false)]
    : style === "straight" ? [frame(true), frame(true, true), frame(true), frame(true, true), frame(false), frame(false, true),
      frame(false), frame(false, true)] : [frame(true), frame(false)];
  return clip(frames, style === "straight" ? 480 : 980, style === "wall" ? [...mat, [206, 65, 206, 160]] : mat);
}

function roll(kind: "roll-up" | "neck" | "roll-over" | "corkscrew" | "control" | "boomerang" | "rolling-back" | "rocker" | "seal"): Illustration {
  const mid = extend(curled, { 0: [100, 110], 1: [120, 129], 3: [147, 127], 4: [173, 127], 5: [141, 126], 6: [164, 124] });
  const fold = extend(upright, { 0: [168, 109], 1: [154, 124], 3: [179, 129], 4: [207, 139], 5: [173, 128], 6: [198, 136] });
  const over: Point[] = [[78, 148], [100, 144], [134, 101], [125, 148], [159, 154], [118, 147], [149, 152],
    [98, 88], [59, 83], [94, 92], [56, 92]];
  const overOpen = extend(over, { 7: [96, 80], 8: [58, 71], 9: [95, 99], 10: [57, 107] });
  const reachAnkle = extend(over, { 3: [76, 126], 4: [59, 83], 5: [73, 126], 6: [62, 87], 9: [132, 69], 10: [135, 35] });
  const otherAnkle = extend(over, { 3: [74, 129], 4: [56, 92], 5: [73, 127], 6: [63, 93], 7: [133, 68], 8: [136, 35] });
  const crossed = extend(upright, { 7: [188, 144], 8: [225, 149], 9: [188, 152], 10: [229, 146] });
  const overCrossed = extend(over, { 7: [100, 85], 8: [58, 91], 9: [100, 95], 10: [56, 85] });
  const elbowsBehind = extend(teaser, { 3: [113, 119], 4: [91, 130], 5: [113, 114], 6: [95, 130] });
  const tuck: Point[] = [[118, 95], [125, 118], [144, 150], [150, 129], [174, 131], [148, 128], [169, 129],
    [168, 119], [190, 136], [162, 118], [185, 133]];
  const back: Point[] = [[80, 124], [101, 145], [122, 119], [110, 127], [96, 115], [102, 123], [90, 111],
    [98, 103], [91, 121], [100, 100], [88, 118]];
  const rocker = extend(teaser, { 3: [161, 98], 4: [191, 83], 5: [153, 93], 6: [176, 75], 7: [178, 117], 9: [163, 107], 10: [177, 75] });
  const bentBack = extend(back, { 3: [90, 113], 4: [67, 93], 5: [86, 112], 6: [61, 89], 7: [102, 103], 8: [67, 93], 9: [96, 101], 10: [61, 89] });
  const seal = extend(tuck, { 3: [146, 145], 4: [181, 133], 5: [145, 137], 6: [174, 130], 7: [173, 115], 8: [186, 133], 9: [168, 117], 10: [178, 132] });
  const spreadFeet = extend(seal, { 4: [188, 121], 6: [179, 138], 8: [195, 125], 10: [186, 142] });
  const backSeal = extend(back, { 3: [110, 131], 4: [91, 121], 5: [104, 128], 6: [87, 118], 7: [106, 100], 9: [88, 100] });
  const backOpen = extend(backSeal, { 4: [95, 126], 6: [81, 112], 8: [95, 126], 10: [81, 112] });
  const neckHands = (p: Point[]) => extend(p, { 3: [p[0][0] + 8, p[0][1] - 14], 4: [p[0][0] - 3, p[0][1] - 6],
    5: [p[0][0], p[0][1] - 18], 6: [p[0][0] - 6, p[0][1] - 6] });
  const c1 = extend(over, { 7: [124, 79], 8: [107, 46], 9: [121, 82], 10: [99, 49] });
  const c2 = extend(bothUp, { 7: [182, 123], 8: [210, 105], 9: [176, 119], 10: [202, 103] });
  const c3 = extend(bothUp, { 7: [173, 141], 8: [222, 140], 9: [168, 136], 10: [213, 134] });
  const c4 = extend(bothUp, { 7: [142, 117], 8: [112, 99], 9: [137, 116], 10: [107, 100] });
  const sequences: Record<typeof kind, Point[][]> = {
    "roll-up": [armsOverhead, mid, upright, fold, upright, mid],
    neck: [reclined, mid, upright, fold, upright, mid].map(neckHands),
    "roll-over": [bothUp, over, overOpen, overOpen, bothUp],
    corkscrew: [bothUp, c1, c2, c3, c4, bothUp, c1, c4, c3, c2], control: [bothUp, over, reachAnkle, over, otherAnkle, over],
    boomerang: [crossed, tuck, overCrossed, over, teaser, elbowsBehind, fold, crossed],
    "rolling-back": [tuck, back, back, tuck], rocker: [rocker, bentBack, bentBack, rocker],
    seal: [spreadFeet, seal, backOpen, backSeal, backOpen, seal, spreadFeet, seal],
  };
  return clip(sequences[kind], 850, mat);
}

function seatedStretch(kind: "mermaid" | "saw" | "round"): Illustration {
  const tall = kind === "mermaid" ? extend(upright, { 3: [156, 127], 4: [171, 153], 5: [111, 97], 6: [96, 80],
    7: [178, 148], 8: [152, 154], 9: [125, 145], 10: [118, 155] })
    : kind === "saw" ? extend(upright, { 0: [141, 82], 1: [141, 101], 2: [141, 151],
      3: [175, 101], 4: [204, 101], 5: [108, 101], 6: [78, 101],
      7: [179, 149], 8: [216, 154], 9: [103, 149], 10: [66, 154] }) : upright;
  const side = extend(tall, { 0: [157, 95], 1: [151, 115], 3: [162, 137], 4: tall[4],
    5: [141, 84], 6: [172, 68] });
  const mirror = (p: Point[]): Point[] => p.map(([x, y]): Point => [282 - x, y]);
  const turn = extend(tall, { 0: [151, 83], 1: [147, 104], 3: [176, 105], 4: [211, 102], 5: [119, 101], 6: [87, 96] });
  const saw = extend(turn, { 0: [172, 115], 1: [155, 125], 3: [134, 116], 4: [105, 104], 5: [177, 137], 6: [217, 152] });
  const otherSide = (p: Point[]) => extend(mirror(p), { 7: tall[7], 8: tall[8], 9: tall[9], 10: tall[10] });
  const rounded = extend(tall, { 0: [171, 118], 1: [159, 123], 3: [184, 131], 4: [218, 143], 5: [177, 129], 6: [210, 140] });
  const frames = kind === "mermaid" ? [tall, side, side, tall, mirror(tall), mirror(side), mirror(side), mirror(tall)]
    : kind === "saw" ? [tall, turn, saw, turn, tall, otherSide(turn), otherSide(saw), otherSide(turn)] : [tall, rounded, rounded, tall];
  return clip(frames, 1040, mat);
}

function legSupport(kind: "front" | "side" | "side-thread"): Illustration {
  const front: Point[] = [[197, 92], [180, 103], [138, 125], [185, 130], [187, 154], [173, 132], [171, 154],
    [102, 143], [70, 155], [96, 143], [63, 155]];
  const side: Point[] = [[93, 81], [113, 94], [159, 120], [111, 124], [108, 155], [119, 66], [129, 40],
    [193, 136], [229, 153], [187, 137], [224, 155]];
  const thread = extend(side, { 0: [106, 95], 1: [113, 106], 5: [145, 134], 6: [157, 138] });
  return clip(kind === "front" ? [front, extend(front, { 7: [100, 126], 8: [63, 125] }), front,
    extend(front, { 9: [96, 123], 10: [59, 122] })] : kind === "side" ? [side,
      extend(side, { 7: [193, 112], 8: [226, 96], 5: [136, 100], 6: [154, 117] }), side] : [side, thread, side], 920, mat);
}

function toeReach(kind: "hands" | "alternate" | "teaser" | "tap" | "tuck" | "both-stretch" | "hip-lift"): Illustration {
  const lifted = extend(bothUp, { 3: [106, 123], 4: [111, 94], 5: [105, 120], 6: [112, 90] });
  const reaching = extend(lifted, { 0: [98, 100], 1: [112, 115], 3: [127, 95], 4: [151, 74], 5: [125, 93], 6: [147, 76] });
  const handsNear = extend(reaching, { 5: [108, 133], 6: [108, 108] });
  const handsFar = extend(reaching, { 3: [116, 129], 4: [118, 107] });
  const tapToes = extend(teaser, { 0: [130, 86], 1: [139, 102], 3: [163, 94], 4: [190, 84], 5: [158, 94], 6: [184, 83] });
  const long = extend(upright, { 0: [109, 100], 1: [123, 116], 3: [109, 133], 4: [107, 155], 5: [106, 130], 6: [98, 155],
    7: [187, 141], 8: [234, 143], 9: [184, 139], 10: [229, 140] });
  const tuckUp = extend(long, { 0: [118, 95], 1: [133, 110], 7: [163, 112], 8: [194, 134], 9: [158, 109], 10: [187, 131] });
  const inwards = extend(curled, { 3: [138, 121], 4: [167, 116], 5: [135, 120], 6: [162, 115],
    7: [151, 102], 8: [185, 122], 9: [149, 101], 10: [180, 120] });
  const outwards = extend(curled, { 3: [88, 115], 4: [63, 107], 5: [83, 111], 6: [59, 102],
    7: [190, 136], 8: [227, 125], 9: [186, 133], 10: [221, 122] });
  const circling = extend(outwards, { 3: [108, 115], 4: [120, 98], 5: [107, 145], 6: [131, 152] });
  const hipLift = extend(bothUp, { 2: [148, 131], 7: [151, 95], 8: [152, 59], 9: [145, 96], 10: [145, 60] });
  const frames: Record<typeof kind, Point[][]> = {
    hands: [lifted, reaching, reaching], alternate: [lifted, handsNear, lifted, handsFar],
    teaser: [armsOverhead, extend(teaser, { 0: [109, 131], 1: [122, 142], 3: [90, 125], 4: [68, 111],
      5: [86, 125], 6: [67, 108], 7: [181, 136], 8: [216, 116], 9: [177, 133], 10: [210, 113] }), teaser, teaser],
    tap: [teaser, tapToes, teaser], tuck: [long, tuckUp, tuckUp], "both-stretch": [inwards, outwards, circling],
    "hip-lift": [bothUp, hipLift, hipLift, bothUp],
  };
  return clip(frames[kind], 850, mat);
}

function breathing(mode: "pelvic-tilt" | "supine" | "quadruped" | "standing"): Illustration {
  const handsOnBelly = extend(feetDown, { 3: [125, 141], 4: [140, 139], 5: [121, 142], 6: [137, 138] });
  const quadruped: Point[] = [[186, 83], [169, 97], [122, 107], [174, 123], [177, 154],
    [166, 124], [167, 154], [119, 151], [87, 155], [109, 152], [79, 155]];
  const standing: Point[] = [[147, 44], [149, 61], [148, 106], [178, 83], [154, 105], [119, 82], [142, 103],
    [161, 132], [162, 156], [135, 132], [134, 156]];
  const base = mode === "standing" ? standing : mode === "quadruped" ? quadruped : mode === "pelvic-tilt" ? feetDown : handsOnBelly;
  const bent = mode === "pelvic-tilt" ? extend(base, { 2: [151, 146] }) : mode === "supine"
    ? extend(base, { 4: [140, 133], 6: [137, 132] }) : base;
  const at = (p: Point[], active: boolean) => [...p, (mode === "quadruped" ? [146, active ? 97 : 108]
    : mode === "standing" ? [active ? 145 : 150, 94] : [132, active && mode === "pelvic-tilt" ? 152 : 145]) as Point];
  const hold = mode === "quadruped" ? 9 : mode === "standing" ? 11 : 2;
  const frames = [at(base, false), ...Array<Point[]>(hold).fill(at(bent, true)), at(base, false)];
  return { ...clip(frames, mode === "supine" ? 1740 : 1400, mat), spine: [11] };
}

export const pilatesMatIllustrations: Record<string, Illustration> = {
  "2838": alternateLeg("bicycle"), "2876": roll("boomerang"), "2840": roll("control"), "2841": roll("corkscrew"),
  "2843": toeReach("both-stretch"), "2846": pulseHundred(false), "10658": pulseHundred(true),
  "2849": legSupport("front"), "2874": legSupport("front"), "2848": legSupport("side"), "2866": legSupport("side-thread"),
  "2879": seatedStretch("mermaid"), "2853": roll("neck"), "2856": roll("rocker"), "2858": roll("roll-up"),
  "2859": roll("rolling-back"), "2860": roll("roll-over"), "2861": seatedStretch("saw"), "2877": roll("seal"),
  "4315": seatedStretch("round"), "4309": alternateLeg("knee"), "2872": alternateLeg("knee"), "4310": alternateLeg("straight"),
  "2871": toeReach("teaser"), "3420": clip([upright, teaser, teaser, teaser], 990, mat),
  "3969": toeReach("tuck"), "5050": toeReach("alternate"), "5046": toeReach("tap"),
  "5275": toeReach("hands"), "6002": alternateLeg("toe-tap"), "4096": alternateLeg("wall"),
  "11010": toeReach("hip-lift"), "7294": breathing("pelvic-tilt"), "5242": breathing("quadruped"),
  "5445": breathing("standing"), "8146": breathing("supine"), "9977": breathing("supine"),
};
