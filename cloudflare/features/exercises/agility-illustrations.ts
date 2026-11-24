import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

const floor = 158;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function motion(frames: Point[][], props: Props = [], attachments: Attachments = [], ms = 520): Illustration {
  return { frames, props, dynamic: [...feet, ...attachments], ms, reference: true };
}

function skeleton(head: Point, chest: Point, hip: Point, arms: [Limb, Limb], legs: [Limb, Limb], nearToe: Point, farToe: Point): Point[] {
  return [head, chest, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], nearToe, farToe];
}

function reachKnee([x, y]: Point, [ax, ay]: Point, length = 33, toward = 1): Point {
  const span = Math.max(1, Math.hypot(ax - x, ay - y));
  const bend = Math.sqrt(Math.max(0, length * length - span * span / 4)) * toward;
  return [(x + ax) / 2 + (ay - y) / span * bend, (y + ay) / 2 - (ax - x) / span * bend];
}

type Gait = "walk" | "fast" | "heel" | "toe" | "tandem" | "duck" | "high-walk"
  | "sprint" | "high-run" | "front-kick" | "skip" | "high-skip" | "kick-heel";
type Hold = "neutral" | "balance" | "rack" | "chest" | "yoke" | "press";

function profileStep(x: number, phase: number, gait: Gait, hold: Hold = "neutral", y = floor, direction = 1): Point[] {
  const angle = (phase % 8) * Math.PI / 4;
  const rapid = gait === "sprint" || gait === "high-run" || gait === "skip" || gait === "high-skip" || gait === "kick-heel";
  const high = gait === "high-run" || gait === "high-walk" || gait === "high-skip";
  const squat = gait === "duck";
  const rises = rapid ? 6 + Math.abs(Math.sin(angle * 2)) * 4 : 0;
  const hip: Point = [x, y - (squat ? 45 : 64) - rises];
  const chest: Point = [x + (gait === "sprint" ? 12 : squat ? 7 : 2), hip[1] - 34];
  const head: Point = [chest[0] + 4, chest[1] - 15];
  const travel = gait === "sprint" ? 29 : gait === "fast" ? 23 : gait === "tandem" || gait === "heel" ? 11 : 18;
  const makeLeg = (a: number, offset: -1 | 1): [Limb, Point] => {
    const swing = Math.sin(a);
    const h = Math.max(0, Math.cos(a));
    const flight = rapid && phase % 2 === 1 ? 8 : 0;
    const ankle: Point = [x + travel * swing + offset * 3, y - (gait === "toe" ? 13 : 6) - flight
      - h * (gait === "heel" || gait === "toe" ? 5 : high ? 21 : rapid ? 15 : 9)];
    let knee = reachKnee([hip[0] + offset * 2, hip[1]], ankle, 33, squat ? 1 : h > 0.1 ? 0.72 : 0.29);
    const toe: Point = [ankle[0] + 10, gait === "heel" ? ankle[1] - 5 : gait === "toe" ? ankle[1] + 12
      : !h && swing > 0.3 ? ankle[1] + 2 : ankle[1] + 5];
    if (high && h > 0) {
      knee = [x + 31 * h, hip[1] - 4 * h + 22 * (1 - h)];
      ankle[0] = knee[0] + 4 * h;
      ankle[1] = knee[1] + 26;
      toe[0] = ankle[0] + 9; toe[1] = ankle[1] + 4;
    }
    if (gait === "front-kick" && h > 0) {
      knee = [x + 16 + 11 * h, hip[1] + 25 * (1 - h)];
      ankle[0] = knee[0] + 19; ankle[1] = knee[1] + 10 * (1 - h);
      toe[0] = ankle[0] + 10; toe[1] = ankle[1] + 1;
    }
    if (gait === "kick-heel" && h > 0) {
      knee = [x - 14 * h, hip[1] + 29];
      ankle[0] = x - 24 * h; ankle[1] = hip[1] + 30 - 17 * h;
      toe[0] = ankle[0] - 4; toe[1] = ankle[1] + 8;
    }
    return [[knee, ankle], toe];
  };
  const [left, leftToe] = makeLeg(angle, 1);
  const [right, rightToe] = makeLeg(angle + Math.PI, -1);
  const armSwing = Math.sin(angle);
  const [cx, cy] = chest;
  const natural: [Limb, Limb] = [[[cx - 9 * armSwing, cy + 19], [cx - 21 * armSwing + 5, cy + 31 - 9 * armSwing]],
    [[cx + 7 * armSwing - 4, cy + 17], [cx + 19 * armSwing, cy + 30 + 8 * armSwing]]];
  const hands: [Limb, Limb] = hold === "balance" ? [[[cx + 12, cy + 3], [cx + 29, cy + 5]], [[cx - 12, cy + 4], [cx - 26, cy + 2]]]
    : hold === "chest" ? [[[cx + 17, cy + 17], [cx + 12, cy + 6]], [[cx + 12, cy + 17], [cx + 6, cy + 5]]]
      : hold === "rack" ? [[[cx + 14, cy + 7], [cx + 6, cy - 1]], [[cx - 13, cy + 9], [cx - 8, cy - 1]]]
        : hold === "yoke" ? [[[cx + 20, cy + 7], [cx + 29, cy + 9]], [[cx - 21, cy + 7], [cx - 28, cy + 9]]]
          : hold === "press" ? [[[cx + 19, cy + 7], [cx + 39, cy + 4]], [[cx + 12, cy + 6], [cx + 33, cy + 2]]]
            : natural;
  const result = skeleton(head, chest, hip, hands, [left, right], leftToe, rightToe);
  return direction < 0 ? result.map(([px, py]): Point => [2 * x - px, py]) : result;
}

type WalkLoad = "plate" | "sandbag" | "backpack" | "barbell" | "yoke" | "band";

function walk(gait: Gait, load?: WalkLoad, route?: "treadmill" | "line" | "water") {
  let hold: Hold = gait === "tandem" ? "balance" : "neutral";
  if (load === "sandbag" || load === "plate") hold = "chest";
  if (load === "barbell") hold = "rack";
  if (load === "yoke") hold = "yoke";
  const canTravel = route !== "treadmill" && route !== "water";
  const props: Props = route === "treadmill"
    ? [[103, 147, 212, 147], [98, 151, 213, 151], [98, 156, 212, 156], [206, 146, 206, 64], [198, 64, 217, 64], [183, 83, 206, 83]]
    : route === "line" ? [[72, 155, 245, 155]] : route === "water" ? [[88, 101, 227, 101], [93, 106, 154, 106], [166, 106, 232, 106]] : [];
  if (gait === "sprint") props.push([104, 154, 99, 158], [235, 154, 231, 158]);
  const steps = [0, 1, 2, 3, 4, 5, 6, 7];
  const runInPlace = gait === "high-run" || gait === "kick-heel";
  const frames = steps.map(i => {
    const center = canTravel && !runInPlace ? 135 + i * 4 : 151;
    const frame = profileStep(center, i, gait, hold, route === "treadmill" ? 146 : floor);
    const [cx, cy] = frame[1];
    return [...frame, [cx - 14, cy + 1], [cx - 21, cy + 3], [cx - 24, cy + 24], [cx - 12, cy + 27],
      [cx - 34, cy + 4], [cx + 34, cy + 4], [cx - 34, 148], [cx + 34, 148]] as Point[];
  });
  const attachments: Attachments = load === "plate" ? [["plate", 4, 1, -2]]
    : load === "sandbag" ? [["sandbag", 4, -2, 0]]
      : load === "backpack" ? [["bar", 13, 14], ["bar", 14, 15], ["bar", 15, 16], ["bar", 16, 13], ["pad", 15, 6, -11]]
        : load === "barbell" ? [["bar", 4, 6], ["barbell-end", 4, 7, 0], ["barbell-end", 6, -8, 0]]
          : load === "yoke" ? [["bar", 17, 18], ["bar", 17, 19], ["bar", 18, 20], ["barbell-end", 19, 0, -6], ["barbell-end", 20, 0, -6]]
            : load === "band" ? [["band", 8, 10]] : [];
  const speed = gait === "sprint" || gait === "high-run" ? 155 : gait === "fast" || gait === "skip" ? 230 : 360;
  return motion(frames, props, attachments, speed);
}

function cone(x: number, y: number): Props {
  return [[x - 6, y, x + 5, y], [x - 4, y, x, y - 9], [x, y - 9, x + 4, y]];
}

function figureRun() {
  const props: Props = [...cone(112, 148), ...cone(206, 148)];
  const route: [number, number][] = [[151, 152], [126, 159], [103, 154], [105, 138], [130, 135], [156, 146],
    [183, 157], [207, 158], [217, 144], [204, 134], [183, 134], [159, 147]];
  const frames = route.map(([x, y], i) => {
    const next = route[(i + 1) % route.length];
    return profileStep(x, i % 8, "sprint", "neutral", y, next[0] >= x ? 1 : -1);
  });
  return motion(frames, props, [], 460);
}

type ShuffleKind = "side" | "front-back" | "high" | "boxer" | "band" | "band-squat" | "toe-band" | "toe"
  | "x-band" | "duck" | "ball" | "partner" | "box" | "quick-feet" | "cones";

function shuffle(kind: ShuffleKind) {
  const front = kind !== "front-back";
  const band = kind === "band" || kind === "band-squat" || kind === "toe-band" || kind === "duck" || kind === "x-band";
  const box = kind === "box";
  const props: Props = box ? [[142, 139, 172, 139], [142, 139, 142, 157], [172, 139, 172, 157]]
    : kind === "cones" ? [...cone(111, 151), ...cone(153, 146), ...cone(198, 150)] : [];
  const centers = kind === "box" ? [116, 130, 146, 161, 182, 196, 177, 159, 136, 125]
    : kind === "ball" ? [113, 123, 140, 166, 190, 181, 165, 131]
      : kind === "cones" ? [120, 143, 164, 183, 166, 143, 124]
        : kind === "boxer" || kind === "quick-feet" ? [145, 150, 153, 150, 147, 143, 145, 150]
          : kind === "partner" ? [123, 129, 144, 153, 142, 135, 125, 116] : [119, 136, 153, 172, 179, 162, 145, 128];
  const captions: Attachments = [];
  if (band) {
    if (kind === "x-band") captions.push(["band", 8, 6], ["band", 10, 4]);
    else if (kind === "band" || kind === "toe-band") captions.push(["band", 8, 10]);
    else captions.push(["knee-band", 7, 9]);
  }
  if (kind === "ball") captions.push(["ball", 13, 0, 0]);
  const steps = centers.map((x, i) => {
    if (!front) return profileStep(x, i, "duck", "neutral", floor, 1);
    const afterBreak = i >= centers.length / 2;
    const travelling = afterBreak ? -1 : 1;
    const nearLead = i % 2 === 0;
    const open = kind === "quick-feet" ? i % 4 === 0 || i % 4 === 1 : nearLead;
    const span = open ? band ? 22 : 19 : band ? 12 : 8;
    const raised = kind === "toe-band" || kind === "toe";
    const high = kind === "high";
    const lower = kind === "duck" ? 43 : kind === "band-squat" ? 47 : high || raised ? 62 : 54;
    const hip: Point = [x, floor - lower - (kind === "cones" && !nearLead ? 9 : 0)];
    const neck: Point = [x + travelling * 3, hip[1] - 34];
    const near: Point = [x + span, floor - (raised ? 13 : 5) - (nearLead ? high ? 27 : 0 : kind === "cones" ? 13 : 7)];
    const far: Point = [x - span, floor - (raised ? 13 : 5) - (nearLead ? high ? 27 : kind === "cones" ? 13 : 7 : 0)];
    if (high && nearLead) near[1] -= 23;
    if (box) {
      if (near[0] >= 142 && near[0] <= 169) near[1] = 133;
      if (far[0] >= 142 && far[0] <= 169) far[1] = 133;
    }
    const kneeNear: Point = [x + span * 0.85 + 4, (hip[1] + near[1]) / 2 + (high && nearLead ? -10 : 0)];
    const kneeFar: Point = [x - span * 0.85 - 4, (hip[1] + far[1]) / 2 + (high && !nearLead ? -10 : 0)];
    const [cx, cy] = neck;
    const hands: [Limb, Limb] = kind === "boxer" ? [[[cx + 14, cy + 16], [cx + 9, cy - 2]], [[cx - 13, cy + 15], [cx - 8, cy - 4]]]
      : kind === "x-band" ? [[[cx + 14, cy + 17], [cx + 15, cy + 24]], [[cx - 13, cy + 17], [cx - 15, cy + 24]]]
        : [[[cx + 12, cy + 15], [cx + (nearLead ? 13 : 23), cy + 22]], [[cx - 13, cy + 15], [cx - (nearLead ? 22 : 12), cy + 20]]];
    const nearToe: Point = [near[0] + 5, near[1] + (raised ? 12 : 5)];
    const farToe: Point = [far[0] - 5, far[1] + (raised ? 12 : 5)];
    const mark: Point = kind === "partner" ? [cx + 4, cy - 15] : [156, 150];
    return [...skeleton([cx, cy - 15], neck, hip, hands, [[kneeNear, near], [kneeFar, far]], nearToe, farToe), mark];
  });
  if (kind === "partner") {
    for (const [from, to] of [[15, 16], [15, 17], [17, 18], [15, 19], [19, 20], [16, 21], [21, 22], [16, 23], [23, 24]]) {
      captions.push(["line", from, to]);
    }
    captions.push(["ball", 14, 0, 0], ["face", 0, 13], ["face", 14, 25]);
    steps.forEach((step, i) => {
      const partnerX = centers[i] + 89;
      const bias = i % 2 === 0 ? 4 : -4;
      const partner: Point[] = [[partnerX, 51], [partnerX, 67], [partnerX, 104],
        [partnerX + 13, 78], [partnerX + 18, 92], [partnerX - 13, 79], [partnerX - 19, 93],
        [partnerX + 11 + bias, 123], [partnerX + 12 + bias, 153], [partnerX - 13, 122], [partnerX - 14 - bias, 153],
        [partnerX - 4, 51]];
      step.push(...partner);
    });
  }
  return motion(steps, props, captions, kind === "box" || kind === "quick-feet" ? 290 : kind === "boxer" ? 330 : 435);
}

function ladder(lateral: boolean) {
  const props: Props = [[88, 151, 231, 151], [106, 140, 245, 140]];
  for (const mark of [90, 114, 138, 162, 186, 210, 232]) props.push([mark, 151, mark + 15, 140]);
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((phase) => {
    const x = 103 + phase * 15;
    const active = phase % 2 === 0;
    if (!lateral) {
      const body = profileStep(x, phase, "high-walk", "neutral", 148);
      if (active) { body[8][1] = 142; body[11][1] = 147; }
      else { body[10][1] = 143; body[12][1] = 148; }
      return body;
    }
    const hip: Point = [x, 99], neck: Point = [x, 66];
    const near: Point = [x + (active ? 13 : 6), active ? 143 : 134];
    const far: Point = [x - (active ? 6 : 10), active ? 132 : 142];
    return skeleton([x, 51], neck, hip, [[[x + 15, 81], [x + 24, 95]], [[x - 16, 80], [x - 22, 94]]],
      [[[x + 12, 119], near], [[x - 14, 118], far]], [near[0] + 4, near[1] + 4], [far[0] - 4, far[1] + 4]);
  });
  return motion(frames, props, [], 345);
}

function climb(weighted: boolean) {
  const stairs: Props = [[93, 157, 122, 157]];
  for (const [x, height] of [[121, 145], [150, 132], [179, 119], [207, 106]]) {
    stairs.push([x, height + 13, x, height], [x, height, x + 29, height]);
  }
  const treads: Point[] = [[107, 157], [136, 145], [165, 132], [194, 119]];
  const make = (left: Point, right: Point, phase: number) => {
    const x = (left[0] + right[0]) / 2;
    const y = (left[1] + right[1]) / 2;
    const frame = profileStep(x, phase, "high-walk", weighted ? "chest" : "neutral", y);
    const joint = (position: Point, ankle: number, toe: number) => {
      frame[ankle] = [position[0] - 5, position[1] - 6];
      frame[toe] = [position[0] + 6, position[1] - 1];
      frame[ankle - 1] = reachKnee(frame[2], frame[ankle], 33, 0.68);
    };
    joint(left, 8, 11);
    joint(right, 10, 12);
    return frame;
  };
  const frames = [make(treads[0], [101, 157], 6)];
  for (let i = 1; i < treads.length; i++) {
    const target = treads[i];
    frames.push(i % 2 ? make(target, treads[i - 1], i) : make(treads[i - 1], target, i));
    frames.push(make([target[0] + 4, target[1]], [target[0] - 5, target[1]], i + 1));
  }
  return motion(frames, stairs, weighted ? [["plate", 4, -1, -1]] : [], 670);
}

function wallSprint(straps: boolean) {
  const props: Props = straps ? [[94, 43, 94, floor], [79, floor, 109, floor]]
    : [[204, 31, 204, floor], [204, floor, 236, floor]];
  const frames = [0, 2, 4, 6].map((i) => {
    const body = profileStep(145, i, "high-run", straps ? "neutral" : "press");
    body[0][0] += 11; body[1][0] += 12;
    body[0][1] += 7; body[1][1] += 7;
    if (!straps) {
      body[3] = [181, 62]; body[4] = [202, 56]; body[5] = [182, 67]; body[6] = [202, 64];
    }
    return body;
  });
  return motion(frames, props, straps ? [["line", 4, 94, 44], ["line", 6, 94, 44], ["ring", 4, 0, 0], ["ring", 6, 0, 0]] : [], 220);
}

function floorTravel(kind: "butt" | "crab" | "handstand" | "row") {
  const frame = (x: number, pulse: boolean, moving: boolean) => {
    const parity = pulse ? 1 : -1;
    if (kind === "handstand") {
      const chest: Point = [x, 126], hip: Point = [x - 2, 90];
      return skeleton([x + 4, 139], chest, hip,
        [[[x + 5, 142], [x + 12 + 12 * parity, pulse ? 147 : 155]], [[x - 7, 141], [x - 12 + 12 * parity, pulse ? 154 : 148]]],
        [[[x + 1, 58], [x + 3, 28]], [[x - 3, 56], [x - 4, 25]]], [x + 4, 17], [x - 2, 15]);
    }
    if (kind === "row") {
      const up = !moving;
      const near: Limb = up && pulse ? [[x - 14, 107], [x - 10, 121]]
        : [[x - 28, 126], [x - 22 + parity * 7, 149]];
      const far: Limb = up && !pulse ? [[x - 17, 104], [x - 14, 119]]
        : [[x - 34, 126], [x - 36 - parity * 8, 150]];
      return skeleton([x - 42, 104], [x - 28, 105], [x + 8, 118],
        [near, far],
        [[[x + 31, 133], [x + 56, 147]], [[x + 27, 134], [x + 51, 147]]], [x + 62, 156], [x + 56, 154]);
    }
    if (kind === "crab") {
      return skeleton([x - 25, 95], [x - 18, 109], [x + 9, 131],
        [[[x - 28, 130], [x - 36 + parity * 7, pulse ? 146 : 155]], [[x - 30, 131], [x - 43 - parity * 7, pulse ? 154 : 145]]],
        [[[x + 30 + parity * 9, 127], [x + 42 + parity * 7, pulse ? 150 : 147]],
          [[x + 22 - parity * 8, 132], [x + 34 - parity * 8, pulse ? 146 : 151]]],
        [x + 53 + parity * 7, pulse ? 156 : 151], [x + 44 - parity * 8, pulse ? 149 : 155]);
    }
    const chest: Point = [x - 14 + parity * 6, 112], hip: Point = [x + parity * 4, 149];
    return skeleton([chest[0] - 1, 97], chest, hip,
      [[[chest[0] + 14, 126], [chest[0] + 2, 117]], [[chest[0] + 8, 126], [chest[0] - 1, 116]]],
      [[[x + 27 + parity * 7, 149], [x + 51 + parity * 8, 151]], [[x + 25 - parity * 7, 145], [x + 47 - parity * 8, 148]]],
      [x + 58 + parity * 8, 150], [x + 53 - parity * 8, 146]);
  };
  const route = [124, 135, 147, 159, 167, 156, 143, 133];
  return motion(route.map((x, i) => frame(x, kind === "row" ? i % 4 < 2 : i % 2 === 0, i % 2 === 0)), [],
    kind === "row" ? [["dumbbell", 4, 0, 3], ["dumbbell", 6, 0, 3]] : [], kind === "handstand" ? 660 : 570);
}

function recumbentBike() {
  const props: Props = [[120, 116, 150, 116], [102, 64, 120, 115], [123, 116, 123, 153], [98, 154, 212, 154],
    [182, 149, 192, 108], [192, 108, 192, 70], [181, 70, 202, 70], [132, 109, 149, 109]];
  const hip: Point = [129, 112], shoulder: Point = [109, 80];
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const angle = i * Math.PI / 4;
    const near: Point = [186 + Math.cos(angle) * 13, 123 + Math.sin(angle) * 13];
    const far: Point = [184 - Math.cos(angle) * 13, 122 - Math.sin(angle) * 13];
    return [...skeleton([103, 66], shoulder, hip, [[[113, 101], [143, 109]], [[106, 100], [132, 106]]],
      [[reachKnee(hip, near), near], [reachKnee(hip, far), far]], [near[0] + 9, near[1] + 3], [far[0] + 8, far[1] + 3]), [185, 124]] as Point[];
  });
  return motion(frames, props, [["bar", 8, 13], ["bar", 10, 13], ["barbell-end", 13, 0, 0], ["pad", 8, 3, 5], ["pad", 10, 3, 5]], 310);
}

function waveTrainer() {
  const props: Props = [[150, 47, 150, 142], [137, 48, 163, 48], [130, 76, 172, 76], [120, 77, 120, 142], [183, 77, 183, 143],
    [114, 153, 191, 153], [126, 143, 176, 143], [140, 142, 162, 142]];
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const stage = Math.sin(i * Math.PI / 4);
    const hip: Point = [150 + stage * 4, 94];
    const near: Point = [164 + Math.max(0, stage) * 25, 133 + stage * 7];
    const far: Point = [135 + Math.min(0, stage) * 24, 133 - stage * 7];
    const neck: Point = [150 + stage * 3, 58];
    return skeleton([neck[0], 44], neck, hip, [[[168, 72], [176, 75]], [[134, 72], [128, 75]]],
      [[[hip[0] + 11 + Math.max(0, stage) * 13, 112], near],
        [[hip[0] - 11 + Math.min(0, stage) * 13, 111], far]], [near[0] + 7, near[1] + 4], [far[0] - 7, far[1] + 4]);
  });
  return motion(frames, props, [["line", 8, 156, 146], ["line", 10, 144, 146], ["pad", 8, 2, 6], ["pad", 10, -2, 6]], 280);
}

function reformerRun() {
  const props: Props = [[77, 125, 236, 125], [77, 133, 237, 133], [79, 133, 79, 158], [234, 134, 234, 158],
    [212, 125, 220, 99], [231, 125, 210, 99], [208, 99, 228, 99], [65, 118, 132, 118], [96, 117, 96, 106]];
  const base: Point = [119, 110], shoulder: Point = [88, 108];
  const make = (left: boolean, transition = false) => {
    const foot: Point = [197, left && !transition ? 105 : 90];
    const backFoot: Point = [192, !left && !transition ? 104 : 88];
    const knee: Point = left && !transition ? [157, 103] : [157, 77];
    const backKnee: Point = !left && !transition ? [153, 102] : [153, 75];
    return skeleton([73, 101], shoulder, base, [[[103, 114], [124, 116]], [[101, 110], [122, 113]]],
      [[knee, foot], [backKnee, backFoot]], [212, 99], [209, 97]);
  };
  return motion([make(true), make(true, true), make(false), make(false, true)], props, [], 490);
}

export const agilityIllustrations: Record<string, Illustration> = {
  "5967": shuffle("ball"),
  "2990": walk("toe", "barbell"),
  "2193": recumbentBike(),
  "3532": shuffle("boxer"),
  "3004": walk("fast"),
  "11571": floorTravel("butt"),
  "3867": walk("duck"),
  "8225": floorTravel("row"),
  "5989": figureRun(),
  "10995": floorTravel("crab"),
  "9248": shuffle("front-back"),
  "4376": floorTravel("handstand"),
  "5970": walk("tandem"),
  "10294": walk("heel"),
  "3701": walk("high-run"),
  "10759": walk("high-walk"),
  "11656": walk("high-walk", undefined, "water"),
  "5972": ladder(false),
  "5973": ladder(true),
  "5991": shuffle("partner"),
  "10848": reformerRun(),
  "5974": shuffle("cones"),
  "10747": shuffle("quick-feet"),
  "2417": shuffle("duck"),
  "2165": shuffle("band"),
  "6744": shuffle("band-squat"),
  "10761": shuffle("toe-band"),
  "10760": walk("toe", "band"),
  "7282": shuffle("band"),
  "4257": shuffle("side"),
  "7154": shuffle("high"),
  "1588": shuffle("box"),
  "5216": walk("sprint"),
  "9040": wallSprint(false),
  "3009": climb(false),
  "2711": walk("duck", "plate"),
  "2725": climb(true),
  "2712": walk("walk", "sandbag"),
  "2735": walk("walk", "yoke"),
  "1140": wallSprint(true),
  "5977": walk("tandem", undefined, "line"),
  "10762": shuffle("toe"),
  "4802": walk("toe"),
  "0828": walk("walk", undefined, "treadmill"),
  "0829": walk("high-walk"),
  "10749": walk("front-kick"),
  "2140": waveTrainer(),
  "2258": walk("walk"),
  "10676": walk("walk", "backpack"),
  "0858": walk("sprint"),
  "2926": shuffle("x-band"),
  "3199": walk("skip"),
  "6100": walk("skip"),
  "3091": walk("high-skip"),
  "0481": motion([...walk("high-run").frames.slice(0, 4), ...walk("kick-heel").frames.slice(4)], [], [], 190),
  "3271": motion([...walk("high-run").frames.slice(0, 4), ...walk("duck").frames.slice(0, 4)], [], [], 280),
};
