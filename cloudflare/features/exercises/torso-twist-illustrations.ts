import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachment = NonNullable<Illustration["dynamic"]>;
type Sit = "floor" | "hover" | "straight" | "chair" | "ball" | "upright-floor";
type Load = "clasped" | "crossed" | "dumbbell" | "kettlebell" | "plate" | "bottle" | "rope" | "bar";
type Pass = "side" | "low" | "chop" | "press" | "extended" | "stretch" | "knee";
type Anchor = "band" | "cable";
type Rotation = "level" | "low-high" | "high-low" | "squat" | "lift" | "swing" | "overhead";

const stand: Point[] = [[155, 45], [154, 64], [154, 106], [142, 88], [147, 104],
  [165, 86], [161, 103], [169, 132], [173, 156], [141, 132], [135, 156]];
const seated: Point[] = [[133, 91], [140, 109], [157, 152], [133, 124], [150, 121],
  [155, 123], [158, 123], [181, 130], [202, 156], [176, 128], [195, 154]];
const kneel: Point[] = [[154, 75], [153, 94], [153, 127], [142, 109], [146, 119],
  [167, 109], [162, 119], [162, 155], [177, 156], [137, 155], [124, 156]];
const chair: Props = [[134, 117, 176, 117], [135, 117, 135, 74], [137, 119, 137, 158], [172, 119, 172, 158]];
const change = (pose: Point[], joints: Partial<Record<number, Point>>) => pose.map((p, i) => joints[i] ?? p);

function seatedTwist(sit: Sit, load: Load = "clasped", movement: Pass = "side", pause = false): Illustration {
  const upright = sit === "chair" || sit === "ball" || sit === "upright-floor";
  const y = sit === "ball" ? 119 : sit === "upright-floor" ? 152 : 114;
  const lower: Point[] = sit === "hover" ? [[185, 124], [209, 137], [176, 125], [200, 139]]
    : sit === "straight" ? [[198, 145], [229, 148], [193, 143], [224, 147]]
    : sit === "upright-floor" ? [[190, 152], [231, 154], [185, 149], [222, 150]]
    : upright ? [[181, 115], [183, 155], [164, 118], [163, 155]] : seated.slice(7);
  const upperX = sit === "chair" && movement === "side" ? 144 : 151;
  const base: Point[] = upright
    ? [[upperX, y - 67], [upperX, y - 46], [151, y], [140, y - 25], [159, y - 28],
      [167, y - 25], [163, y - 28], ...lower]
    : [...seated.slice(0, 7), ...lower];
  const props: Props = sit === "chair" ? [...chair] : [];
  const dynamic: Attachment = [["face", 0, 19], ["face", 0, 20]];
  if (sit === "ball") dynamic.push(["stability-ball", 2, 0, 22]);
  if (load === "dumbbell" && movement === "press") dynamic.push(["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]);
  else if (load === "kettlebell") dynamic.push(["kettlebell", 13, 0, 3]);
  else if (load === "dumbbell" || load === "plate" || load === "bottle") dynamic.push([load, 13, 0, 0]);
  if (load === "bar") dynamic.push(["bar", 17, 18], ["plate", 17, 0, 0], ["plate", 18, 0, 0]);
  if (load === "rope") {
    props.push([244, 149, 244, 159], [241, 157, 249, 157]);
    dynamic.push(["line", 4, 14], ["line", 14, 15], ["line", 6, 16], ["line", 16, 15]);
  }
  const view = (turn: number, high = false): Point[] => {
    const [nx, ny] = base[1];
    const [hx] = base[2];
    const neck: Point = [nx - turn * 3, ny];
    const head: Point = [base[0][0] - turn * 3, base[0][1]];
    const span = turn === 0 ? 13 : 8;
    const shoulderNear: Point = [neck[0] - span + turn * 5, ny + turn * 3];
    const shoulderFar: Point = [neck[0] + span + turn * 5, ny - turn * 3];
    const handY = movement === "low" ? (turn ? 145 : ny + 8) : movement === "chop" ? (high ? ny - 30 : ny + 28) : ny + 14;
    const handX = hx + 13 + (movement === "chop" && high ? -turn * 27 : turn * 29);
    const grip: Point = [handX, handY];
    let arms: Point[] = [[Math.round((shoulderNear[0] + handX) / 2) - 5, handY + 3], [handX - 4, handY],
      [Math.round((shoulderFar[0] + handX) / 2) + 6, handY + 2], [handX + 3, handY]];
    let legs = lower;
    if (load === "crossed") arms = [[neck[0] - span, ny + 19], [neck[0] + 9, ny + 9],
      [neck[0] + span, ny + 19], [neck[0] - 9, ny + 9]];
    if (movement === "extended") arms = [[neck[0] - 27, ny + 3], [neck[0] - 43 + turn * 10, ny + 6],
      [neck[0] + 27, ny + 3], [neck[0] + 43 + turn * 10, ny + 2]];
    if (movement === "stretch") arms = turn < 0 ? [[neck[0] - 22, ny + 36], [neck[0] - 39, 153],
      [neck[0] + 32, ny + 37], [lower[0][0], lower[0][1] - 3]] : [[neck[0] + 16, ny + 37], [lower[2][0], lower[2][1] - 3],
      [neck[0] + 15, ny + 37], [neck[0] + 12, 154]];
    if (movement === "knee") {
      arms = [[neck[0] - 18 + turn * 18, ny + (turn === 1 ? 18 : -7)], [head[0] - 3, head[1] - 2],
        [neck[0] + 18 + turn * 18, ny + (turn === -1 ? 18 : -7)], [head[0] + 3, head[1] - 2]];
      legs = turn === 1 ? [[173, 112], [192, 132], lower[2], lower[3]]
        : turn === -1 ? [lower[0], lower[1], [170, 112], [189, 132]] : lower;
    }
    if (movement === "press") arms = high ? [[neck[0] - 14, ny - 22], [neck[0] - 20, ny - 43],
      [neck[0] + 13, ny - 22], [neck[0] + 19, ny - 43]]
      : [[neck[0] - 14, ny + 17], [neck[0] - 19, ny - 4], [neck[0] + 14, ny + 17], [neck[0] + 21, ny - 4]];
    if (load === "bar") arms = [[neck[0] - span - 14, ny + 8], [neck[0] - span - 15 - turn * 5, ny - 3],
      [neck[0] + span + 14, ny + 8], [neck[0] + span + 15 - turn * 5, ny - 3]];
    return [head, neck, base[2], ...arms, ...legs, shoulderNear, shoulderFar, grip, [192, 125 + turn * 14],
      [244, 154], [215, 137 - turn * 12], [arms[1][0] - 10, arms[1][1]], [arms[3][0] + 10, arms[3][1]],
      [head[0] - 3 + turn * 5, head[1] - 1], [head[0] + 3 + turn * 5, head[1] - 1]];
  };
  const center = view(0), left = view(-1), right = view(1);
  const frames = movement === "chop" ? [view(-1, true), left, view(1, true), right]
    : movement === "press" ? [center, view(0, true), center, left, center, right]
      : pause ? [center, left, left, left, center, right, right, right] : [center, left, center, right];
  return { frames, props, dynamic, shoulders: [11, 12], ms: pause ? 1220 : 940, reference: true };
}

function axialChop(position: "stand" | "kneel" | "half-kneel" | "chair", movement: Rotation,
  gear?: Anchor | "dumbbell" | "plate" | "ez-bar", anti = false, pivot = false, clasped = false): Illustration {
  const base = position === "stand" ? stand : position === "chair"
    ? [[150, 54], [150, 73], [151, 111], [137, 92], [153, 95], [166, 92], [161, 96],
      [177, 111], [179, 157], [164, 113], [160, 157]] as Point[]
    : position === "half-kneel" ? change(kneel, { 7: [184, 125], 8: [185, 156], 9: [145, 156], 10: [119, 156] }) : kneel;
  const [nx, ny] = base[1];
  const cable = gear === "cable" || gear === "band";
  const pulley = movement === "low-high" ? 145 : movement === "high-low" ? 35 : ny + 6;
  const props: Props = position === "chair" ? [...chair] : [];
  if (cable) props.push([82, 25, 82, 158], [67, 158, 97, 158], [77, pulley, 89, pulley]);
  const pose = (turn: number, up = false): Point[] => {
    const squat = movement === "squat" && !turn;
    const y = squat ? 20 : 0;
    const move = anti ? 0 : turn * 5;
    const neck: Point = [nx + move, ny + y];
    const head: Point = [base[0][0] + move, base[0][1] + y];
    const span = turn && !anti ? 7 : 13;
    const shoulderNear: Point = [neck[0] - span + turn * (!anti ? 4 : 0), neck[1] + (!anti ? turn * 3 : 0)];
    const shoulderFar: Point = [neck[0] + span + turn * (!anti ? 4 : 0), neck[1] - (!anti ? turn * 3 : 0)];
    const handY = movement === "low-high" ? (up ? ny - 36 : ny + 50)
      : movement === "high-low" ? (up ? ny - 38 : ny + 40)
      : movement === "lift" ? (up ? ny + 6 : 115)
      : movement === "overhead" ? (up ? ny - 50 : ny + 7) : ny + 10 + y;
    const handX = nx + turn * 43 + (up && movement === "overhead" ? 0 : 1);
    const active: Point = [handX, handY];
    let arms: Point[] = [[(shoulderNear[0] + handX) / 2 - 4, (shoulderNear[1] + handY) / 2],
      [handX - 2, handY], [(shoulderFar[0] + handX) / 2 + 5, (shoulderFar[1] + handY) / 2], [handX + 3, handY + 2]];
    if (!gear && movement === "level" && !clasped) arms = [[neck[0] - 16, neck[1] + 20], [neck[0] + 9, neck[1] + 10],
      [neck[0] + 16, neck[1] + 21], [neck[0] - 9, neck[1] + 11]];
    if (clasped) arms = [[neck[0] - 15, neck[1] + 18], [neck[0] + turn * 13, neck[1] + 9],
      [neck[0] + 14, neck[1] + 18], [neck[0] + 3 + turn * 13, neck[1] + 9]];
    if (gear === "ez-bar") arms = [[handX - 14, (neck[1] + handY) / 2], [handX - 14, handY + (turn < 0 ? -5 : 5)],
      [handX + 14, (neck[1] + handY) / 2], [handX + 14, handY - (turn < 0 ? -5 : 5)]];
    if (movement === "swing") arms = [[neck[0] - 19 + turn * 16, ny + 22], [neck[0] - 11 + turn * 31, ny + 38],
      [neck[0] + 18 + turn * 14, ny + 22], [neck[0] + 23 + turn * 30, ny + 40]];
    const legs: Point[] = squat ? [[179, 139], base[8], [133, 140], base[10]] : base.slice(7);
    if (pivot && turn > 0) legs[3] = [base[10][0] + 3, base[10][1] - 4];
    return [head, neck, [base[2][0], base[2][1] + y], ...arms, ...legs, shoulderNear, shoulderFar, active,
      [handX - 19, handY + (turn < 0 ? -7 : 7)], [handX + 19, handY - (turn < 0 ? -7 : 7)],
      [head[0] - 3 + (anti ? 0 : turn * 4), head[1] - 1], [head[0] + 3 + (anti ? 0 : turn * 4), head[1] - 1]];
  };
  const dynamic: Attachment = [["face", 0, 16], ["face", 0, 17]];
  if (cable) dynamic.push([gear, 13, 82, pulley], ["ring", 13, 0, 0]);
  if (gear === "dumbbell" || gear === "plate") dynamic.push([gear, 13, 0, 0]);
  if (gear === "ez-bar") dynamic.push(["ez-bar", 14, 15], ["plate", 14, 0, 0], ["plate", 15, 0, 0]);
  const waves = movement === "low-high" ? [pose(-1), pose(1, true)]
    : movement === "high-low" ? [pose(-1, true), pose(1)]
      : movement === "squat" ? [pose(-1), pose(0), pose(1), pose(0)]
        : movement === "lift" ? [pose(0), pose(0, true), pose(1, true), pose(0, true), pose(0), pose(0,true), pose(-1, true), pose(0,true)]
          : movement === "overhead" ? [pose(0,true), pose(-1), pose(0,true), pose(1)]
            : cable ? [pose(-1), pose(1), pose(1)] : position === "half-kneel" ? [pose(0), pose(1), pose(1)] : [pose(0), pose(1), pose(0), pose(-1)];
  return { frames: waves, props, dynamic, shoulders: [11, 12], ms: 1030, reference: true };
}

function supportedRotation(mode: "ball-arms" | "ball-dumbbell" | "ball-knees" | "floor-knees" | "floor-crunch"): Illustration {
  const onBall = mode.startsWith("ball");
  const legsRotate = mode.endsWith("knees");
  const floor = !onBall;
  const base: Point[] = onBall
    ? [[121, 108], [140, 117], [179, 119], [142, 94], [139, 67], [133, 92], [137, 68],
      [215, 118], [218, 156], [206, 121], [204, 155]]
    : [[109, 147], [127, 151], [168, 151], [128, 130], [127, 110], [135, 130], [140, 110],
      [180, 122], [201, 153], [169, 120], [192, 153]];
  const dynamic: Attachment = [];
  if (onBall) dynamic.push(["stability-ball", 11, 0, 0]);
  if (mode === "ball-dumbbell") dynamic.push(["dumbbell", 12, 0, 0]);
  if (mode === "floor-knees") dynamic.push(["plate", 12, 0, 0]);
  const rotate = (direction: number): Point[] => {
    let f = base;
    if (legsRotate) {
      if (onBall) f = change(f, { 3: [118, 106], 4: [101, 107], 5: [151, 103], 6: [166, 99] });
      f = change(f, { 7: [base[7][0] + direction * 18, base[7][1] + Math.abs(direction) * 8],
        9: [base[9][0] + direction * 18, base[9][1] + Math.abs(direction) * 9] });
    } else if (floor) {
      f = change(f, { 0: [109 + direction * 11, 144 - Math.abs(direction) * 14],
        1: [127 + direction * 4, 150 - Math.abs(direction) * 11], 3: [139 + direction * 12, 134 - Math.abs(direction) * 7],
        5: [118 + direction * 12, 134 - Math.abs(direction) * 7], 4: [105 + direction * 10, 143 - Math.abs(direction) * 14],
        6: [106 + direction * 10, 145 - Math.abs(direction) * 14] });
    } else {
      const hands: Point = [138 + direction * 34, 62 + Math.abs(direction) * 16];
      f = change(f, { 0: [121 + direction * 4, 101], 3: [140 + direction * 14, 86 + Math.abs(direction) * 5],
        5: [136 + direction * 14, 86 + Math.abs(direction) * 6], 4: hands, 6: [hands[0] + 3, hands[1]] });
    }
    return [...f, [143, 142], [(f[4][0] + f[6][0])/2, (f[4][1] + f[6][1])/2]];
  };
  return { frames: [rotate(0), rotate(-1), rotate(0), rotate(1)], dynamic, ms: 1010, reference: true };
}

function halo(grounded: boolean): Illustration {
  const b = grounded ? kneel : stand;
  const [x, y] = b[0];
  const orbit: Point[] = [[x + 11, y + 25], [x + 26, y + 3], [x + 2, y - 14], [x - 24, y + 2]];
  const dynamic: Attachment = grounded ? [["dumbbell", 11, 0, 0]] : [["kettlebell", 11, 0, 0]];
  const frames = orbit.map(([hx, hy]): Point[] => [...change(b, {
    3: [hx + 12, (hy + b[1][1])/2 + 9], 4: [hx + 4, hy + 3],
    5: [hx - 12, (hy + b[1][1])/2 + 8], 6: [hx - 4, hy + 3],
  }), [hx, hy]]);
  return { frames, dynamic, ms: 900, reference: true };
}

function seatedCableTwist(): Illustration {
  const base = seatedTwist("hover", "clasped");
  return { ...base, props: [[244, 104, 244, 156], [233, 156, 257, 156], [238, 147, 249, 147]],
    dynamic: [...(base.dynamic ?? []), ["cable", 13, 244, 147], ["pad", 13, 0, 0]] };
}

function twoCablePushPull(ground: boolean): Illustration {
  const foundation = ground ? change(kneel, { 0: [156, 68], 1: [155, 86], 2: [154, 123],
    7: [190, 121], 8: [192, 155], 9: [139, 152], 10: [108, 154] })
    : change(stand, { 7: [176, 128], 8: [198, 156], 9: [142, 130], 10: [118, 154] });
  const [x, y] = foundation[1];
  const row = (side: boolean) => change(foundation, side ? { 3: [x + 30, y + 7], 4: [x + 54, y + 4],
    5: [x - 15, y + 14], 6: [x - 4, y + 15] }
    : { 3: [x + 7, y + 13], 4: [x + 20, y + 6], 5: [x + 14, y + 15], 6: [x + 39, y + 9] });
  const first = row(true), middle = row(false);
  const reverse = (p: Point[]) => p.map(([px, py], i): Point => i >= 3 && i <= 6
    ? [2 * x - p[i < 5 ? i + 2 : i - 2][0], p[i < 5 ? i + 2 : i - 2][1]] : [px, py]);
  const pulley = y + 8;
  const props: Props = [[64, 34, 64, 157], [248, 34, 248, 157], [57, 157, 73, 157], [238, 157, 259, 157],
    [64, pulley, 73, pulley], [238, pulley, 248, pulley]];
  const dynamic: Attachment = [["cable", 4, 64, pulley], ["cable", 6, 248, pulley], ["pad", 4, 0, 0], ["pad", 6, 0, 0]];
  return { frames: ground ? [middle, first, first, middle] : [middle, first, middle, reverse(first)],
    props, dynamic, ms: 830, reference: true };
}

function wideAntiRotation(): Illustration {
  const base = axialChop("stand", "high-low", "band", true);
  return { ...base, frames: base.frames.map(frame => change(frame, { 7: [178, 131], 8: [192, 156],
    9: [129, 131], 10: [115, 156] })) };
}

export const torsoTwistIllustrations: Readonly<Record<string, Illustration>> = {
  "4573": axialChop("half-kneel", "high-low", "band"),
  "4572": axialChop("half-kneel", "low-high", "dumbbell"),
  "10093": axialChop("half-kneel", "low-high", "dumbbell"),
  "3847": axialChop("stand", "low-high", "band"),
  "8002": wideAntiRotation(),
  "2434": seatedCableTwist(),
  "4228": twoCablePushPull(true),
  "11258": twoCablePushPull(false),
  "4696": axialChop("stand", "low-high", "band", false, true),
  "4137": axialChop("stand", "squat", "band"),
  "3591": axialChop("stand", "level", "band"),
  "0931": axialChop("stand", "low-high", "band"),
  "0093": seatedTwist("ball", "bar"),
  "3377": seatedTwist("floor", "rope", "low"),
  "0131": supportedRotation("ball-knees"),
  "6055": seatedTwist("floor", "bottle", "low"),
  "7584": axialChop("kneel", "high-low", "cable", true),
  "6760": axialChop("kneel", "level", "cable"),
  "4042": axialChop("chair", "level", "cable"),
  "11271": axialChop("stand", "level", "cable"),
  "1207": axialChop("stand", "low-high", "cable", false, true),
  "1208": axialChop("stand", "high-low", "cable"),
  "5118": axialChop("stand", "level", "cable"),
  "1069": axialChop("stand", "level", "cable"),
  "2839": supportedRotation("floor-crunch"),
  "10200": halo(true),
  "8505": axialChop("kneel", "low-high", "dumbbell"),
  "6800": seatedTwist("hover", "dumbbell", "press"),
  "6806": seatedTwist("hover", "dumbbell", "press"),
  "3449": seatedTwist("floor", "dumbbell"),
  "4041": supportedRotation("ball-dumbbell"),
  "4750": seatedTwist("hover", "dumbbell", "low"),
  "10183": axialChop("stand", "lift", "dumbbell"),
  "4249": seatedTwist("straight", "dumbbell"),
  "4190": axialChop("stand", "overhead", "ez-bar"),
  "10566": axialChop("half-kneel", "level"),
  "2939": halo(false),
  "4393": seatedTwist("hover", "kettlebell"),
  "10327": seatedTwist("hover", "kettlebell", "low"),
  "8371": seatedTwist("floor", "kettlebell", "low"),
  "0686": supportedRotation("ball-arms"),
  "5938": seatedTwist("floor", "clasped", "chop"),
  "4646": seatedTwist("hover", "crossed"),
  "5135": seatedTwist("upright-floor", "clasped", "stretch", true),
  "0694": seatedTwist("ball"),
  "5129": seatedTwist("upright-floor", "crossed"),
  "7693": seatedTwist("hover", "clasped", "knee"),
  "8203": seatedTwist("chair"),
  "8199": seatedTwist("chair", "clasped", "chop"),
  "9025": seatedTwist("ball", "plate", "chop"),
  "2788": axialChop("stand", "level"),
  "2868": seatedTwist("upright-floor", "clasped", "extended"),
  "5126": axialChop("stand", "level", undefined, false, false, true),
  "9653": axialChop("stand", "swing", undefined, false, true),
  "3408": axialChop("stand", "level", undefined, false, false, true),
  "0839": supportedRotation("floor-knees"),
  "0846": seatedTwist("floor", "plate", "low"),
  "0845": seatedTwist("hover", "plate", "low"),
  "2371": seatedTwist("floor", "plate", "side", true),
  "0849": seatedTwist("ball", "plate"),
  "0855": axialChop("stand", "level", "plate"),
};
