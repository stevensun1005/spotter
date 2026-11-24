import type { Illustration, Point } from "./motion-data";
import { kneeMobilityIllustrations } from "./knee-mobility-illustrations";
import { lowerMovementSequenceIllustrations } from "./lower-movement-sequence-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Loads = NonNullable<Illustration["dynamic"]>;
type Leg = [Point, Point];

function at([x, y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function pose(head: Point, shoulder: Point, hip: Point, near: Leg, far: Leg, legs: [Leg, Leg], toes: [Point, Point]) {
  return [head, shoulder, hip, ...near, ...far, ...legs[0], ...legs[1], ...toes];
}

function motion(frames: Point[][], props: Props = [], dynamic: Loads = [], ms = 850): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...dynamic], ms, reference: true };
}

const tower = (x: number): Props => [
  [x, 31, x, 157], [x + 9, 31, x + 9, 157], [x, 31, x + 9, 31],
  [x - 7, 157, x + 16, 157], [x, 145, x + 9, 145], [x, 128, x + 9, 128],
];

const rail = (x: number, y = 80): Props => [
  [x, y, x, 158], [x - 8, y, x + 13, y], [x - 4, 158, x + 11, 158],
];

function chair(x: number, y = 120): Props {
  return [[x, y, x + 55, y], [x + 3, y, x + 3, 158], [x + 50, y, x + 50, 158], [x + 1, y, x + 1, y - 47]];
}

function accessoryBall(x: number, y: number): Props {
  return [[x - 23, y, x + 23, y], [x - 23, y, x - 17, y - 11],
    [x - 17, y - 11, x - 7, y - 17], [x - 7, y - 17, x + 8, y - 17],
    [x + 8, y - 17, x + 18, y - 10], [x + 18, y - 10, x + 23, y]];
}

type StandingTrack = "swing" | "side-swing" | "raise-knee" | "leg-circle" | "chair-circle" | "cross-band" | "cable-side" | "towel";
function standingHip(kind: StandingTrack, load?: "cable" | "band", close = false) {
  const frontal = kind === "side-swing" || kind === "cross-band" || kind === "cable-side" || kind === "towel";
  const withChair = kind === "chair-circle";
  const support: Point = frontal ? [106, 83] : [206, 84];
  const props: Props = withChair ? [...chair(206, 130), [203, 84, 211, 84]] : rail(support[0], support[1]);
  const anchor: Point = frontal ? [84, 145] : [94, 145];
  if (load === "cable") props.push(...tower(anchor[0]));
  if (load === "band") props.push([anchor[0], 131, anchor[0], 157], [anchor[0] - 6, 157, anchor[0] + 8, 157]);

  const normal: Leg = [[162, 128], [164, 155]];
  const forward: Leg = [[178, 120], [207, 134]];
  const back: Leg = [[137, 126], [113, 144]];
  const cross: Leg = [[148, 130], [126, 145]];
  const outside: Leg = [[180, 121], [211, kind === "towel" ? 154 : 125]];
  const raised: Leg = [[192, close ? 94 : 102], [188, close ? 125 : 134]];
  const arm: Leg = frontal ? [[123, 87], support] : [[177, 87], support];
  const relaxed: Leg = frontal ? [[169, 90], [172, 114]] : [[141, 87], [141, 110]];
  const still: Leg = frontal ? [[147, 127], [146, 154]] : [[149, 130], [149, 156]];
  const framesFor: Record<StandingTrack, Leg[]> = {
    swing: [normal, forward, normal, back, normal],
    "side-swing": [normal, cross, normal, outside, normal],
    "raise-knee": [normal, [[173, 111], [176, 144]], raised, raised],
    "leg-circle": [forward, [[176, 113], [205, 124]], [[190, 114], [215, 136]], [[181, 123], [201, 149]], forward,
      [[181, 123], [201, 149]], [[190, 114], [215, 136]], [[176, 113], [205, 124]]],
    "chair-circle": [forward, [[166, 117], [197, 124]], [[165, 123], [197, 147]], [[183, 128], [213, 142]],
      forward, [[183, 128], [213, 142]], [[165, 123], [197, 147]], [[166, 117], [197, 124]]],
    "cross-band": [cross, normal, outside, outside, normal],
    "cable-side": [normal, [[171, 122], [188, 144]], [[180, 117], [207, 126]], [[180, 117], [207, 126]]],
    towel: [normal, [[172, 126], [183, 154]], [[181, 129], [215, 154]], [[181, 129], [215, 154]]],
  };
  const frames = framesFor[kind].map(working => {
    const forefoot = at(working[1], 8, kind === "towel" ? 1 : 3);
    return pose([151, 43], [151, 61], [153, 100], arm, relaxed, [working, still], [forefoot, at(still[1], -8, 2)]);
  });
  const attachments: Loads = load ? [[load, 8, ...anchor], ["ring", 8, 0, 0]]
    : kind === "towel" ? [["slider", 8, 4, 4]] : [];
  return motion(frames, props, attachments, kind === "swing" || kind === "side-swing" ? 680 : 860);
}

function standingBalance(bosu: boolean) {
  const footY = bosu ? 137 : 155;
  const frame = (lift: boolean): Point[] => {
    const shoulder: Point = [149, footY - 96], hip: Point = [149, footY - 58];
    return pose(at(shoulder, 0, -17), shoulder, hip,
      [[169, shoulder[1] + 18], [180, shoulder[1] + 33]], [[132, shoulder[1] + 18], [121, shoulder[1] + 34]],
      [[[154, footY - 28], [154, footY]], [[lift ? 137 : 146, footY - 27], lift ? [131, footY - 20] : [146, footY]]],
      [[162, footY + 2], [lift ? 130 : 141, lift ? footY - 14 : footY + 2]]);
  };
  const ground = frame(false), hold = frame(true);
  return motion([ground, hold, hold, hold, hold], bosu ? accessoryBall(152, 157) : [], [], 1570);
}

function standingPelvis(kind: "circle" | "swirl" | "tilt") {
  const eyes: Point = [150, 43], shoulder: Point = [150, 60];
  const isTilt = kind === "tilt";
  const phases = Array.from({ length: isTilt ? 5 : 9 }, (_, i) => i * Math.PI / 4);
  const frames = phases.map((angle, i) => {
    const moving = i !== 0 && i !== phases.length - 1;
    const hip = isTilt ? [150 + (moving ? 3 : 0), 103 - (moving ? 4 : 0)] as Point
      : [150 + Math.cos(angle) * (kind === "circle" ? 13 : 11), 104 + Math.sin(angle) * 5] as Point;
    const knees: [Leg,Leg] = [
      [[165 + (hip[0] - 150) * .4, 129], [169, 155]],
      [[137 + (hip[0] - 150) * .4, 129], [134, 155]],
    ];
    return pose(eyes, shoulder, hip,
      [[174, 85], at(hip, 12, -4)], [[127, 85], at(hip, -12, -4)],
      knees, [[179, 157], [124, 157]]);
  });
  return motion(isTilt ? frames : [...frames, ...frames.slice(1, -1).reverse()], [], [], isTilt ? 950 : 620);
}

function heelPressure() {
  const frame = (press: boolean): Point[] => {
    const hips: Point = [145 + (press ? 3 : 0), 103];
    const shoulder: Point = [145 + (press ? 6 : 0), 63];
    return pose(at(shoulder, 3, -16), shoulder, hips,
      [[164, 86], [198, 86]], [[143, 86], [151, 107]],
      [[[172, 126], [187, 154]], [[142, 130], [139, 155]]], [[201, 143], [148, 157]]);
  };
  return motion([frame(false), frame(true), frame(true), frame(true)], [...rail(202,86),[197,145,215,145],[195,145,195,157],[215,145,215,157]], [], 1440);
}

type WallMode = "standard" | "narrow" | "elevated" | "single" | "goblet" | "banded";
function wallSit(mode: WallMode) {
  const front = mode === "narrow" || mode === "banded";
  const lifted = mode === "elevated";
  const footY = lifted ? 144 : 155;
  const props: Props = front ? [[118, 30, 118, 157], [188, 30, 188, 157], [102, 157, 207, 157]]
    : [[105, 29, 105, 158], [111, 29, 111, 158], [104,158,198,158]];
  if (lifted) props.push([151,147,183,147],[151,147,151,158],[183,147,183,158]);
  const weighted = mode === "goblet" || mode === "banded";
  const make = ( depth: number, active = false ) => {
    const shoulder: Point = [front ? 140 : 119, footY - 98 + 25 * depth];
    const hip = at(shoulder, 0, 39);
    const lift = mode === "single" && active;
    const width = mode === "narrow" ? 6 : 17;
    const nearFoot: Point = front ? [158 + width, footY] : [174, footY];
    const otherFoot: Point = front ? [159 - width, footY - 1] : [163, footY - 1];
    const knee: Point = front ? [nearFoot[0] + (active && mode === "banded" ? 8 : 1), footY - 31]
      : [137 + depth * 38, footY - 35];
    const otherKnee: Point = front ? [otherFoot[0] - (active && mode === "banded" ? 8 : 1), footY - 34]
      : lift ? [173, footY - 37] : [132 + depth * 33, footY - 35];
    const unused: Point = lift ? [208, footY - 39] : otherFoot;
    return pose(at(shoulder, 2, -16), shoulder, hip,
      weighted ? [at(shoulder, 18, 20), at(shoulder, 8, 14)] : [at(shoulder, 8, 25), at(hip, 12, -3)],
      weighted ? [at(shoulder, -14, 21), at(shoulder, -6, 14)] : [at(shoulder, -8, 25), at(hip, -8, -3)],
      [[knee, nearFoot], [otherKnee, unused]], [at(nearFoot, 10, lifted ? 7 : 2), at(unused, front ? -9 : 9, lifted ? 7 : 2)]);
  };
  const equipment: Loads = weighted ? [["hammer-weight", 4, 0, 0]] : [];
  if (mode === "banded") equipment.push(["knee-band", 7, 9]);
  const down = make(1), holding = make(1, true);
  return motion([make(0), make(.5), down, holding, holding, holding, down, make(.45)], props, equipment, 1080);
}

function lungeStandWithDumbbell() {
  const base = kneeMobilityIllustrations["10750"];
  const frames = base.frames.map(points => points.map((point, i): Point => {
    const shoulder = points[1];
    if (i === 3) return at(shoulder, 16, 21);
    if (i === 4) return at(shoulder, 13, 12);
    if (i === 5) return at(shoulder, 6, 19);
    if (i === 6) return at(shoulder, 9, 14);
    return point;
  }));
  const dynamic: Loads = [...(base.dynamic ?? []), ["hammer-weight", 4, 0, 1]];
  return { ...base, frames, dynamic };
}

function reverseNordic() {
  const knee: Point = [157, 152];
  const points = (degrees: number, length: number): Point => {
    const angle = degrees * Math.PI / 180;
    return [knee[0] - Math.sin(angle) * length, knee[1] - Math.cos(angle) * length];
  };
  const frame = (d: number): Point[] => {
    const shoulder = points(d, 70), hips = points(d, 33);
    return pose(points(d, 85), shoulder, hips,
      [at(shoulder, 12, 18), at(shoulder, -5, 13)], [at(shoulder, -3, 18), at(shoulder, 10, 13)],
      [[knee, [121, 153]], [[152, 152], [117, 154]]], [[113, 156], [108, 156]]);
  };
  return motion([0, 20, 48, 48, 22].map(frame), [[111, 156, 168, 156]], [], 850);
}

function chairSquat(supported: boolean) {
  const rack = tower(226);
  if (supported) rack.push(...chair(106, 123));
  const frame = (depth: number): Point[] => {
    const hip: Point = [150 - 17 * depth, 92 + 25 * depth];
    const shoulder = at(hip, 6 + 12 * depth, -39);
    const foot: Point = [159, 155], other: Point = [supported ? 151 : 146, 154];
    return pose(at(shoulder, 2, -17), shoulder, hip,
      [at(shoulder, 17, 20), at(shoulder, 16, 8)], [at(shoulder, 8, 19), at(shoulder, 10, 9)],
      [[[158 + depth * 13, 124], foot], [[151 + depth * 14, 124], other]],
      [at(foot, 10, 2), at(other, 8, 2)]);
  };
  const low = frame(1), top = frame(0);
  return motion([low, frame(.5), top, top, frame(.5)], rack, [["cable", 4, 230, 143], ["bar", 4, 6]], 880);
}

function sideLift(circle: boolean) {
  const hip: Point = [145, 144], shoulder: Point = [100, 143];
  const phases = circle ? [0, .8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6, 6.28, 5.6, 4.8, 4, 3.2, 2.4, 1.6, .8] : [0, 1, 1, .5];
  const frames = phases.map(theta => {
    const knee: Point = circle ? [176 + Math.cos(theta) * 4, 116 + Math.sin(theta) * 9] : [176 - theta * 5, 145 - theta * 24];
    const ankle: Point = circle ? [211 + Math.cos(theta) * 6, 99 + Math.sin(theta) * 12] : [213 - theta * 13, 151 - theta * 46];
    return pose([78, 134], shoulder, hip,
      [[117, 153], [133, 154]], [[84, 151], [70, 137]], [[knee, ankle], [[177, 150], [215, 154]]],
      [at(ankle, 7, -3), [224, 157]]);
  });
  return motion(frames, [], [], circle ? 660 : 900);
}

function circleLeg(kind: "supine" | "seated" | "semicircle") {
  const onBack = kind === "supine";
  const angles = kind === "semicircle" ? [-1.4,-.65,0,.65,1.4,.65,0,-.65,-1.4] : [0,.72,1.5,2.3,3,3.8,4.5,5.3,6.28,5.3,4.5,3.8,3,2.3,1.5,.72];
  const frames = angles.map(angle => {
    const shoulder: Point = onBack ? [104,148] : [109,115];
    const hip: Point = onBack ? [151,148] : [142,148];
    const low = kind === "semicircle" ? 123 + Math.abs(angle) * 6 : 132 + Math.sin(angle) * 10;
    const foot: Point = onBack ? [161 + Math.cos(angle) * 13,72 + Math.sin(angle) * 9]
      : [199 + (kind === "semicircle" ? Math.sin(angle) * 25 : Math.cos(angle) * 11),low];
    const join = (ratio: number): Point => [hip[0] + (foot[0] - hip[0]) * ratio, hip[1] + (foot[1] - hip[1]) * ratio];
    return pose(onBack ? [82,146] : [100,101], shoulder, hip,
      onBack ? [[116,154],[139,155]] : [[100,137],[96,154]],
      onBack ? [[114,151],[135,153]] : [[106,137],[103,154]],
      [[join(.52), foot], [[176,151],[206,154]]],
      [at(foot, onBack ? 4 : 8,onBack ? -7 : 2),[213,156]]);
  });
  return motion(frames, [], [], 630);
}

function legOpen() {
  const hips: Point = [145, 107], shoulder: Point = [145,63];
  const frame = (sweep: number): Point[] => {
    const angle = (.14 + sweep*.94);
    const atAngle = (r: number): Point => [hips[0] + Math.sin(angle) * r, hips[1] + Math.cos(angle) * r];
    const ankle = atAngle(sweep > 0 ? 51 : 55);
    return pose([145,46], shoulder, hips, [[123,85],[121,107]], [[167,85],[170,107]],
      [[atAngle(27),ankle], [[134,133],[133,158]]], [at(ankle,6,5),[127,163]]);
  };
  const mat: Props = [[113,27,179,27],[179,27,179,167],[179,167,113,167],[113,167,113,27]];
  return { ...motion([frame(0), frame(.52), frame(1), frame(1), frame(.52)], mat, [], 1050), topView: true };
}

function shinBox() {
  const frames: [Leg,Leg][] = [
    [[[183,137],[164,145]],[[113,133],[104,149]]],
    [[[177,123],[173,150]],[[120,121],[121,149]]],
    [[[163,128],[172,149]],[[133,131],[122,148]]],
    [[[183,133],[192,149]],[[112,137],[129,145]]],
    [[[177,123],[173,150]],[[120,121],[121,149]]],
  ];
  return {...motion(frames.map(([near,far])=>pose([147,57],[147,74],[147,132],
    [[174,98],[189,124]],[[120,98],[107,124]],[near,far],[at(near[1],-7,4),at(far[1],6,4)])),[],[],900),topView:true};
}

function proneLift(kind: "ball" | "bench-band" | "cable-incline") {
  const band = kind === "bench-band", cable = kind === "cable-incline", ball = !cable;
  const hip: Point = band ? [146,87] : cable ? [158,111] : [149,119];
  const shoulder: Point = band ? [104,76] : cable ? [112,86] : [112,111];
  const fixture: Props = band ? [[74,126,177,126],[83,126,83,158],[166,126,166,158],[68,145,68,158]]
    : cable ? [[88,89,164,121],[98,94,98,157],[150,116,150,157],...tower(62)] : [];
  const extra: Loads = ball ? [["stability-ball",2,0,20]] : [];
  if (band) extra.push(["band",8,68,149],["band",10,68,149]);
  if (cable) extra.push(["cable",8,68,145],["ring",8,0,0]);
  function frame(rise: number): Point[] {
    const drop = band ? 55 : cable ? 41 : 35;
    const near: Leg = [[hip[0]+34,hip[1]+(1-rise)*20],[hip[0]+69,hip[1]+(1-rise)*drop-3*rise]];
    const different: Leg = [[hip[0]+28,hip[1]+20],[hip[0]+57,hip[1]+38]];
    const far: Leg = cable ? different : [at(near[0],-5,4),at(near[1],-7,4)];
    const wrist: Point = band ? [87,124] : cable ? [90,108] : [89,154];
    return pose(at(shoulder,-16,-2),shoulder,hip,
      [at(shoulder,-8,21),wrist],[at(shoulder,-13,23),at(wrist,-7,1)],
      [near,far],[at(near[1],7,2),at(far[1],7,2)]);
  }
  return motion([frame(0),frame(.48),frame(1),frame(1),frame(.48)],fixture,extra,855);
}

function cableSupineFlexion() {
  const fixture = tower(241);
  const frame = (lift: number): Point[] => {
    const hip: Point = [140,146], knee: Point = [177-36*lift,144-47*lift], ankle: Point = [213-53*lift,151-19*lift];
    return pose([74,143],[94,148],hip,[[106,154],[125,156]],[[103,150],[120,152]],
      [[knee,ankle],[[174,151],[205,154]]],[at(ankle,9,2),[214,157]]);
  };
  return motion([frame(0),frame(.5),frame(1),frame(1),frame(.5)],fixture,[["cable",8,241,145],["ring",8,0,0]],880);
}

function gluteLift(kind: "heels-ball" | "reformer" | "frog-weight") {
  const reformer = kind === "reformer", frog = kind === "frog-weight";
  const fixture: Props = reformer ? [
    [77,149,258,149], [77,143,258,143], [81,149,81,158], [254,149,254,158],
    [191,141,213,113], [221,111,221,143], [208,111,231,111],
  ] : [];
  const extra: Loads = reformer ? [["bar",13,14],["line",14,242,146]]
    : frog ? [["barbell-end",2,6,-9]] : [["stability-ball",13,0,0]];
  const frame = (height: number): Point[] => {
    const shoulder: Point = [100, reformer ? 122 : 149];
    const hip: Point = [143, (reformer ? 123 : 147) - height];
    const foot: Point = frog ? [190,154] : reformer ? [215,113] : [210,124];
    const other: Point = frog ? [188,153] : at(foot,-6,-2);
    const nearKnee: Point = frog ? [175,147-height*.24] : [183,(reformer ? 93:105)-height*.45];
    const farKnee: Point = frog ? [167,119-height*.28] : at(nearKnee,-7,3);
    const toes: [Point,Point] = frog ? [[195,155],[192,146]]
      : [at(foot,8,reformer ? -3 : 0),at(other,7,reformer ? -2 : 0)];
    const figure = pose(at(shoulder,-18,-4),shoulder,hip,
      [at(shoulder,15,4),at(shoulder,30,5)],[at(shoulder,11,3),at(shoulder,26,4)],
      [[nearKnee,foot],[farKnee,other]],toes);
    if (reformer) return [...figure,[84,131] as Point,[169,131] as Point,
      [118,122-height*.31] as Point,[129,123-height*.66] as Point];
    return [...figure,[215,142] as Point];
  };
  const actionHeight = frog ? 17 : 27;
  const result = motion([frame(0),frame(actionHeight*.38),frame(actionHeight),frame(actionHeight),frame(actionHeight*.42)],fixture,extra,820);
  return reformer ? {...result,spine:[15,16]} : result;
}

function hinge(kind: "split-barbell" | "split-trap" | "single" | "rack") {
  const rack = kind === "rack", split = kind.startsWith("split"), trap = kind === "split-trap";
  const fixture: Props = rack ? [
    [133,29,133,158],[204,29,204,158],[133,29,204,29],[139,35,139,153],[198,35,198,153],
    [128,120,145,120],[192,120,209,120],[124,157,210,157],
  ] : [];
  const frame = (depth: number): Point[] => {
    const hip: Point = [150-depth*18,94+depth*(rack ? 7 : 1)];
    const shoulder: Point = at(hip,4+depth*(rack ? 20 : 36),-43+depth*(rack ? 7 : 13));
    const plant: Point = [158,156], support: Point = [split?125:148,154];
    const wrist: Point = rack ? [173,102+depth*15] : [168+depth*(trap? -7:1),107+depth*29];
    const knee: Point = [156+depth*2,126];
    const far: Leg = split ? [[137-depth*7,125+depth*2], support] : rack ? [at(knee,-7,1),support]
      : [[131-depth*31,121-depth*14],[123-depth*53,141-depth*41]];
    const result = pose(at(shoulder,7,-16+depth*8),shoulder,hip,
      [at(shoulder,6,24),wrist],[at(shoulder,-4,24),at(wrist,-6,1)],
      [[knee,plant],far],[at(plant,9,2),at(far[1],split?9:-7,split?-6:2)]);
    if (rack) return [...result,[139,wrist[1]] as Point,[198,wrist[1]] as Point];
    return result;
  };
  const attachments: Loads = rack ? [["bar",13,14],["barbell-end",13,2,0],["barbell-end",14,-2,0]]
    : trap ? [["trap-bar",4,-9,0]] : split ? [["bar",4,6],["barbell-end",4,2,0]] : [];
  return motion([frame(0),frame(.5),frame(1),frame(1),frame(.5)],fixture,attachments,900);
}

function leverRear() {
  const fixture: Props = [
    [195,75,195,157],[179,77,212,77],[185,158,219,158],
    [100,73,100,158],[99,79,111,79],[94,158,151,158],[99,138,118,138],
  ];
  const frame = (lift: number): Point[] => {
    const knee: Point=[145-lift*22,128-lift*7], ankle: Point=[147-lift*34,154-lift*14];
    const pad = at(ankle,-5,-8);
    return [...pose([154,43],[152,61],[153,103],[[173,79],[194,77]],[[164,81],[186,79]],
      [[knee,ankle],[[160,130],[161,154]]],[at(ankle,7,1),[171,156]]),pad,at(pad,-14,5)];
  };
  return motion([frame(0),frame(.5),frame(1),frame(1),frame(.5)],fixture,
    [["bar",13,100,82],["pad",13,0,0],["bar",13,14],["barbell-end",14,0,0]],875);
}

function calfLever() {
  const props: Props = [
    ...chair(92,122),[156,145,205,145],[158,147,158,158],[205,147,205,158],
    [218,54,218,158],[216,79,231,79],[211,158,241,158],[218,121,234,121],[218,128,234,128],
  ];
  const frame = (lift: boolean): Point[] => {
    const kneeY = lift ? 103 : 115;
    return [...pose([109,58],[110,75],[117,116],[[131,99],[153,kneeY-8]],[[125,99],[145,kneeY-10]],
      [[[168,kneeY],[lift?172:161,lift?130:153]],[[162,kneeY+2],[lift?164:154,lift?132:151]]],
      [[181,143],[173,143]]),[155,kneeY-9] as Point,[204,kneeY-10] as Point];
  };
  return motion([frame(false),frame(true),frame(true)],props,
    [["bar",13,218,95],["pad",13,0,0],["cable",14,222,139]],860);
}

export const lowerHipConditioningIllustrations: Readonly<Record<string, Illustration>> = {
  "0675": proneLift("ball"),
  "0731": wallSit("single"),
  "0734": wallSit("standard"),
  "0955": legOpen(),
  "10047": hinge("split-barbell"),
  "1037": leverRear(),
  "1065": gluteLift("heels-ball"),
  "10745": circleLeg("semicircle"),
  "10849": gluteLift("reformer"),
  "10860": standingHip("cable-side", "cable"),
  "11047": sideLift(false),
  "11265": standingHip("raise-knee", "cable", true),
  "1507": standingHip("raise-knee", "band"),
  "2758": chairSquat(false),
  "2770": standingHip("raise-knee"),
  "2835": chairSquat(true),
  "2854": circleLeg("supine"),
  "3182": gluteLift("frog-weight"),
  "3411": standingPelvis("circle"),
  "3502": standingHip("swing"),
  "3652": hinge("split-trap"),
  "3686": lungeStandWithDumbbell(),
  "3714": standingBalance(false),
  "3715": standingBalance(true),
  "3926": sideLift(true),
  "4136": standingHip("cross-band", "band"),
  "4171": hinge("rack"),
  "4380": standingHip("towel"),
  "4560": reverseNordic(),
  "4608": shinBox(),
  "4615": standingPelvis("swirl"),
  "4630": standingHip("side-swing"),
  "4933": standingHip("leg-circle"),
  "4971": hinge("single"),
  "5059": heelPressure(),
  "5471": lowerMovementSequenceIllustrations["4937"],
  "6443": circleLeg("seated"),
  "6558": wallSit("banded"),
  "6738": proneLift("bench-band"),
  "7557": wallSit("narrow"),
  "7558": wallSit("elevated"),
  "7559": wallSit("goblet"),
  "8191": standingHip("raise-knee", "cable"),
  "8875": cableSupineFlexion(),
  "9509": calfLever(),
  "9890": standingPelvis("tilt"),
  "9928": proneLift("cable-incline"),
};
