import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Pair = [Point, Point];
type Arms = [Point, Point, Point, Point];
type Mount = "bar" | "cage" | "ring" | "strap";
type Grip = "wide" | "shoulder" | "close" | "commando" | "uneven";
type Pose = {
  body: [Point, Point, Point];
  legs: [Point, Point, Point, Point];
};
type HangOptions = {
  mount?: Mount;
  grip?: Grip;
  underhand?: boolean;
  single?: boolean;
  flow?: "normal" | "negative" | "isometric-negative" | "still" | "shift" | "arched" | "archer" | "half" | "jump";
  assist?: "band-foot" | "band-knee" | "platform" | "partner" | "belt" | "dumbbell";
  free?: "side" | "chest" | "wrist";
  lean?: boolean;
};

const support: Props = [[76, 19, 239, 19], [82, 19, 82, 157], [232, 19, 232, 157],
  [70, 157, 99, 157], [218, 157, 245, 157]];
const pivotMeasure = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function arm(shoulder: Point, grip: Point, length = 28): Point {
  const [sx, sy] = shoulder, [wx, wy] = grip;
  const delta = Math.hypot(wx - sx, wy - sy);
  const [mx, my] = pivotMeasure(shoulder, grip);
  const flex = Math.sqrt(Math.max(0, length * length - delta * delta / 4)) / Math.max(delta, 1);
  const side = wx >= sx ? 1 : -1;
  return [mx - (wy - sy) * flex * side, my + (wx - sx) * flex * side];
}

function track(pose: Pose, arms: Arms): Point[] {
  return [...pose.body, ...arms, ...pose.legs];
}

function clip(frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 1100): Illustration {
  return { frames, props, dynamic, ms, reference: true };
}

function grips(frame: Point[], end: Pair): Point[] {
  return [...frame, [frame[4][0] + end[0][0], frame[4][1] + end[0][1]],
    [frame[6][0] + end[1][0], frame[6][1] + end[1][1]]];
}

function vertical(options: HangOptions = {}): Illustration {
  const { mount = "bar", grip = "shoulder", underhand = false, single = false, flow = "normal",
    assist, free = "side", lean = false } = options;
  const strap = mount === "strap" || mount === "ring";
  const gap = grip === "wide" ? (flow === "archer" ? 35 : 38) : grip === "close" ? 11 : grip === "commando" ? 7 : 25;
  const y = strap ? 28 : 19;
  const bottomY = strap ? 76 : 70;
  const hands: Pair = [[158 + gap, y], [158 - gap, grip === "uneven" ? y + 22 : y]];
  const props: Props = strap ? [[80, 9, 231, 9], [85, 9, 85, 157], [230, 9, 230, 157]]
    : mount === "cage" ? [[78, 148, 113, 148], [202, 148, 238, 148], ...support,
      [91, 77, 120, 77], [207, 77, 230, 77], [91, 44, 91, 148], [226, 44, 226, 148],
      [hands[0][0] - 5, y, hands[0][0] + 6, y + 6], [hands[1][0] - 5, y, hands[1][0] + 6, y + 6]] : [...support];
  const gear: Attachments = [];
  if (strap) {
    gear.push(["line", 4, hands[0][0] - 7, 9], [mount === "ring" ? "ring" : "pad", 4, 0, 0]);
    if (!single) gear.push(["line", 6, hands[1][0] + 7, 9], [mount === "ring" ? "ring" : "pad", 6, 0, 0]);
  }
  if (underhand || mount === "cage" || grip === "commando") {
    const type = underhand ? "palm-up" : "thumb-up";
    gear.push([type, 4, 11]);
    if (!single) gear.push([type, 6, 12]);
  }
  if (grip === "uneven") gear.push(["line", 6, hands[1][0], 19], ["pad", 6, 0, -6]);
  if (assist === "band-knee" || assist === "band-foot") gear.push(["band", assist === "band-foot" ? 8 : 7, 157, strap ? 9 : 19]);
  if (assist === "belt") gear.push(["line", 2, 13], ["plate", 13, 0, 1]);
  if (assist === "dumbbell") gear.push(["dumbbell", 6, 0, 1]);
  if (assist === "platform") {
    props.push([219, 40, 219, 156], [246, 40, 246, 156], [219, 40, 246, 40],
      [219, 126, 246, 126], [219, 137, 246, 137], [219, 148, 246, 148]);
    gear.push(["bar", 14, 15], ["line", 15, 241, 112]);
  }
  const at = (neckY: number, drift = 0, ground = false): Point[] => {
    const neckX = single ? 170 : 158 + drift - (lean ? 7 : 0);
    const hipY = neckY + 36;
    const kneeY = Math.min(hipY + 23, ground ? 134 : 138);
    const ankleY = ground ? 156 : Math.min(kneeY + 24, 152);
    const knees: Pair = [[neckX + 7, kneeY], [neckX - 7, kneeY]];
    const ankles: Pair = [[neckX + 6, ankleY], [neckX - 7, ankleY - 1]];
    if (lean) {
      knees[0] = [neckX + 24, kneeY];
      knees[1] = [neckX + 17, kneeY];
      ankles[0] = [neckX + 10, ankleY - 2];
      ankles[1] = [neckX + 4, ankleY - 3];
    }
    if (assist === "band-foot") ankles[0] = [neckX + 3, ankleY - 8];
    if (assist === "band-knee" || assist === "platform") {
      knees[0] = [neckX + 14, kneeY - 10];
      ankles[0] = [neckX - 8, kneeY + 7];
    }
    if (assist === "platform") {
      knees[1] = [neckX + 6, kneeY - 10];
      ankles[1] = [neckX - 15, kneeY + 7];
    }
    const head: Point = [neckX, neckY - 16];
    const body: Pose = { body: [head, [neckX, neckY], [neckX + (lean ? 10 : 1), hipY]],
      legs: [knees[0], ankles[0], knees[1], ankles[1]] };
    const nearShoulder: Point = [neckX + 8, neckY];
    const farShoulder: Point = [neckX - 8, neckY + 1];
    const fullHang = drift === 0 && neckY >= bottomY;
    const leanAway = flow === "archer" || flow === "shift";
    const reachNear = fullHang || (leanAway && drift < 0);
    const reachFar = (fullHang && grip !== "uneven") || (leanAway && drift > 0);
    const working = reachNear ? pivotMeasure(nearShoulder, hands[0]) : arm(nearShoulder, hands[0]);
    const idle: Pair = free === "wrist" ? [[neckX - 9, neckY - 9], [hands[0][0] - 4, hands[0][1] + 8]]
      : free === "chest" ? [[neckX - 18, neckY + 17], [neckX + 3, neckY + 8]] : [[neckX - 12, neckY + 22], [neckX - 11, neckY + 45]];
    const farElbow = reachFar ? pivotMeasure(farShoulder, hands[1]) : arm(farShoulder, hands[1]);
    const other: Pair = single ? idle : [farElbow, hands[1]];
    return [...grips(track(body, [working, hands[0], ...other]), [[4, -1], [-4, -1]]),
      [neckX + 1, hipY + 15], [neckX - 19, knees[0][1] + 3], [neckX + 30, knees[0][1] + 3]];
  };
  const topY = strap ? 34 : 25;
  const bottom = at(flow === "half" ? bottomY - 12 : bottomY);
  const top = at(topY);
  let frames = [bottom, top, top, bottom];
  if (flow === "negative" || flow === "isometric-negative") {
    const descent = [at(topY + 8), at(topY + 17), at(topY + 26), bottom];
    frames = flow === "isometric-negative" ? [top, top, top, ...descent, at(bottomY + 6, 0, true)] : [top, ...descent, bottom];
    if (single) props.push([118, 139, 149, 139], [124, 139, 124, 156], [143, 139, 143, 156]);
    else props.push([105, 143, 148, 143], [111, 143, 111, 157], [142, 143, 142, 157]);
  }
  if (flow === "still") frames = [at(bottomY - 3), ...Array<Point[]>(21).fill(bottom)];
  if (flow === "shift") frames = [bottom, at(bottomY, 11), at(bottomY, -11), bottom, at(bottomY, 11), at(bottomY, -11)];
  if (flow === "arched") frames = [bottom, at(topY + 10, 9), at(topY, 14), bottom, at(topY + 10, -9), at(topY, -14)];
  if (flow === "archer") frames = [bottom, at(topY + 13, 13), at(topY, 30), bottom, at(topY + 13, -13), at(topY, -30)];
  if (flow === "jump") frames = [at(bottomY, 0, true), at(bottomY + 4, 0, true), top, top, at(topY + 17), bottom];
  const demo = clip(frames, props, gear, flow === "shift" ? 3650 : 1010);
  if (assist !== "partner") return demo;
  const follower = (main: Point[]): Point[] => {
    const [hx, hy] = main[2];
    const pose: Pose = {
      body: [[216, 62], [211, 78], [213, 117]],
      legs: [[220, 136], [224, 157], [205, 137], [203, 157]],
    };
    const hold: Pair = [[hx + 6, hy], [hx - 4, hy + 5]];
    return track(pose, [[194, (hy + 78) / 2 + 5], hold[0], [185, (hy + 78) / 2 + 9], hold[1]]);
  };
  return { ...demo, partnerFrames: demo.frames.map(follower) };
}

function lowSupport(kind: "bar" | "chairs" | "strap", { legs = "bent", commando = false, underhand = false,
  held = false, recline = false }: {
  legs?: "bent" | "straight" | "deep" | "sliding"; commando?: boolean; underhand?: boolean;
  held?: boolean; recline?: boolean;
} = {}): Illustration {
  const y = legs === "deep" ? 55 : 67;
  const bar: Props = kind === "strap" ? [[80, 17, 237, 17], [85, 17, 85, 157], [234, 17, 234, 157]]
    : [[86, y, 235, y], [93, y, 93, 157], [230, y, 230, 157]];
  if (kind === "chairs") bar.push([82, 109, 112, 109], [214, 109, 244, 109], [82, 109, 78, 157],
    [112, 109, 116, 157], [214, 109, 210, 157], [244, 109, 248, 157]);
  const hands: Pair = [[commando ? 152 : 159, y], [commando ? 143 : 128, y + (kind === "strap" ? 2 : 0)]];
  const gear: Attachments = [];
  if (kind === "strap") gear.push(["line", 4, 174, 17], ["line", 6, 158, 17], ["pad", 4, 0, 0], ["pad", 6, 0, 0]);
  if (underhand || commando) gear.push([underhand ? "palm-up" : "thumb-up", 4, 11], [underhand ? "palm-up" : "thumb-up", 6, 12]);
  if (legs === "sliding") gear.push(["slider", 7, 0, 4], ["slider", 9, 0, 4]);
  const at = (lift: number, sway = 0): Point[] => {
    const [x, ny] = [137 + sway - (recline ? 13 - lift / 3 : 0), (legs === "deep" ? 93 : 112) - lift];
    const hip: Point = [142 + lift / 7 + (recline ? 7 : 0), (legs === "deep" ? 137 : legs === "sliding" ? 120 : 150) - lift * .65];
    const base: Pose = {
      body: [[x - 4, ny - 16], [x, ny], hip],
      legs: legs === "sliding" ? [[130 + lift / 4, 151], [93 + lift / 4, 155], [121 + lift / 4, 151], [87 + lift / 4, 156]]
        : legs === "straight" ? [[174, (hip[1] + 157) / 2], [220, 157], [165, (hip[1] + 157) / 2], [208, 156]]
        : legs === "deep" ? [[175, 128], [181, 157], [164, 129], [168, 157]]
        : [[171, 129], [194, 157], [163, 130], [185, 157]],
    };
    return grips(track(base, [arm([x + 7, ny], hands[0]), hands[0], arm([x - 6, ny], hands[1]), hands[1]]), [[3, -2], [-3, -2]]);
  };
  const lower = at(0), raise = at(legs === "deep" ? 24 : 38);
  const frames = commando ? [lower, at(38, 14), lower, at(38, -12)] :
    held ? [lower, ...Array<Point[]>(7).fill(raise)] : [lower, raise, raise];
  return clip(frames, bar, gear);
}

function rotaryRings(): Illustration {
  const frame = (neckY: number, legsY: number): Point[] => {
    const torso: Pose = {
      body: [[155, neckY - 14], [158, neckY], [159, neckY + 31]],
      legs: [[174, legsY - 13], [162, legsY], [157, legsY - 11], [148, legsY]],
    };
    const handles: Pair = [[178, 56], [139, 56]];
    const elbow: Pair = neckY < 48 ? [[180, (neckY + 56) / 2], [139, (neckY + 56) / 2 + 2]] : [[186, neckY - 15], [132, neckY - 16]];
    return track(torso, [elbow[0], handles[0], elbow[1], handles[1]]);
  };
  return clip([frame(96, 154), frame(65, 137), frame(28, 109), frame(28, 109), frame(65, 137)],
    [[102, 16, 217, 16]], [["line", 4, 179, 16], ["line", 6, 137, 16], ["ring", 4, 0, 0], ["ring", 6, 0, 0]], 1040);
}

function barMuscleUp(style: "strict" | "kipping" | "band" | "belt" | "rings-belt") {
  const hands: Pair = [[173, 61], [139, 61]];
  const hanging: Point[] = [[155, 84], [156, 102], [156, 128], [170, 82], hands[0], [141, 82], hands[1],
    [160, 143], [162, 154], [149, 141], [150, 153]];
  const pulled: Point[] = [[150, 42], [152, 57], [155, 93], [183, 83], hands[0], [125, 81], hands[1],
    [160, 117], [161, 143], [148, 116], [148, 141]];
  const turnover: Point[] = [[167, 30], [159, 44], [148, 78], [135, 57], hands[0], [131, 55], hands[1],
    [153, 105], [154, 128], [145, 104], [143, 126]];
  const locked: Point[] = [[158, 15], [155, 30], [154, 70], [164, 45], hands[0], [146, 45], hands[1],
    [154, 98], [153, 126], [147, 98], [146, 125]];
  const legSwing = (p: Point[], move: number) => p.map(([x, y], index): Point => [
    index === 2 ? x + move / 5 : index >= 7 ? x + move * (index % 2 ? .65 : 1) : x,
    index >= 7 ? y - Math.abs(move) / 4 : y]);
  const initial = style === "kipping" ? [hanging, legSwing(hanging, -28), legSwing(hanging, 32)] : [hanging];
  const rings = style === "rings-belt", weighted = style === "belt" || rings;
  const gear: Attachments = style === "band" ? [["band", 8, 156, 61], ["band", 10, 156, 61]]
    : weighted ? [["line", 2, 11], ["plate", 11, 0, 0]] : [];
  if (rings) gear.push(["line", 4, 175, 12], ["line", 6, 137, 12], ["ring", 4, 0, 0], ["ring", 6, 0, 0]);
  const frames = [...initial, pulled, turnover, locked, locked, turnover, pulled, hanging].map(p => {
    const handsMove = p === hanging ? 6 : p === pulled ? 4 : -2;
    const forming = rings ? p.map(([x,y], i): Point => [i === 4 ? x + handsMove : i === 6 ? x - handsMove : x, y]) : p;
    return weighted ? [...forming, [p[2][0] + 1, p[2][1] + 17] as Point] : forming;
  });
  const height = rings ? 12 : 61;
  return clip(frames, [[85, height, 225, height], [92, height, 92, 157], [218, height, 218, 157],
    [80, 157, 105, 157], [207, 157, 231, 157]], gear, 655);
}

function wideRearPullUp(): Illustration {
  const base = vertical({ grip: "wide" });
  const frames = base.frames.map((p, index) => p.map(([x, y], i): Point => {
    if (i === 4 || i === 6) return [x, y + 8];
    const upper = index === 1 || index === 2;
    if (!upper) return [x, y + (i < 7 ? 4 : 0)];
    if (i < 3) return [x + (i === 0 ? 16 : 8), y + (i === 0 ? 1 : 5)];
    return [x + (i >= 7 ? 6 : 0), y + (i >= 7 ? 4 : 8)];
  }));
  return clip(frames, support.map(([x1,y1,x2,y2]): [number,number,number,number] =>
    [x1, y1 === 19 ? 27 : y1, x2, y2 === 19 ? 27 : y2]), [["face", 0, 11]], 1010);
}

type PullStyle = "upright" | "hinge" | "kneel" | "stagger" | "sit" | "bench";
type PulleyGear = "band" | "cable" | "lever" | "plate" | "stack";
function downPull(style: PullStyle, gear: PulleyGear, mode: "neutral" | "wide" | "mag" | "under" | "bar" | "rope" | "cross" |
  "straight" | "single" | "single-straight" | "alternate-twist"): Illustration {
  const upright: Pose = {
    body: [[158, 43], [157, 61], [mode === "straight" ? 148 : 154, 104]],
    legs: [[168, 129], [176, 156], [145, 129], [141, 157]],
  };
  const pose: Pose = style === "hinge" ? { ...upright, body: [[184, 45], [171, 60], [134, 104]] } :
    style === "kneel" ? { body: [[154, 63], [155, 80], [153, 114]], legs: [[162, 152], [133, 154], [150, 153], [119, 156]] } :
    style === "stagger" ? { ...upright, legs: [[174, 127], [187, 156], [140, 127], [116, 157]] } :
    style === "sit" ? { ...upright, body: [[149, 54], [149, 70], [153, 112]], legs: [[178, 114], [187, 156], [166, 117], [170, 156]] } :
    style === "bench" ? { body: [[103, 101], [120, 109], [171, 117]], legs: [[201, 125], [208, 157], [193, 129], [195, 156]] } : upright;
  const [cx, cy] = pose.body[1];
  const distance = mode === "wide" || mode === "mag" ? 34 : 23;
  const apparatus: Props = style === "bench" ?
    [[90, 124, 209, 124], [99, 124, 99, 157], [205, 124, 205, 158]] :
    style === "sit" ? [[127, 118, 174, 118], [133, 119, 133, 157], [167, 119, 167, 156]] : [];
  const single = mode === "single" || mode === "single-straight";
  const straight = mode === "straight" || mode === "single-straight";
  const crownY = style === "bench" ? 31 : 19;
  const column = style === "bench" ? 62 : 235;
  apparatus.push([column, crownY, column, 157], [column - 9, 157, column + 12, 157]);
  const middle: Point = [style === "bench" ? 103 : 154, crownY];
  apparatus.push([column, crownY, middle[0], crownY]);
  const open: Pair = style === "bench" ? [[146, 53], [122, 53]] :
    [[cx + distance, cy - 48], [cx - distance, cy - 47]];
  const finished: Pair = style === "bench" ? [[145, 105], [127, 102]] :
    style === "hinge" ? [[cx - 17, pose.body[2][1] + 3], [cx - 30, pose.body[2][1] + 2]] :
    straight ? [[cx + 12, pose.body[2][1] + 16], [cx - 12, pose.body[2][1] + 15]] :
      mode === "cross" ? [[cx - 15, cy + 16], [cx + 16, cy + 17]] : [[cx + distance, cy + 11], [cx - distance, cy + 11]];
  const edge: Pair = style === "bench" ? [[142, 93], [116, 96]] : style === "hinge" ?
    [[cx - 28, cy + 20], [cx - 43, cy + 20]] : [[cx + 39, cy + 24], [cx - 38, cy + 24]];
  const ready = (near: Point, far: Point, leftBent = false, rightBent = false, twist = 0): Point[] => {
    const torso: Pose = { ...pose, body: [[pose.body[0][0] + twist, pose.body[0][1]], [cx + twist, cy], pose.body[2]] };
    const ext = (w: Point, x: number): Point => [(w[0] + x) / 2, (w[1] + cy) / 2];
    const e1 = leftBent && !straight ? edge[0] : ext(near, cx + twist + 6);
    const e2 = rightBent && !straight ? edge[1] : ext(far, cx + twist - 6);
    const points = grips(track(torso, [e1, near, single ? [cx - 11, cy + 21] : e2,
      single ? [cx - 12, cy + 44] : far]), [[4, -2], [-4, -2]]);
    const center = pivotMeasure(points[4], points[6]);
    return [...points, [center[0], center[1] - (mode === "mag" ? 10 : 3)],
      [near[0], near[1] - 5], [far[0], far[1] - 5]];
  };
  const bottom = ready(...open);
  const top = ready(...finished, true, true);
  const animated = mode === "alternate-twist" ? [bottom, ready(finished[0], open[1], true, false, 7),
    bottom, ready(open[0], finished[1], false, true, -7)] : [bottom, top, top];
  const gearList: Attachments = [];
  if (style === "sit") {
    apparatus.push([175, 106, 192, 106], [191, 106, 191, 157]);
    gearList.push(["pad", 7, 4, -8], ["pad", 9, 5, -9]);
  }
  if (gear === "band") {
    gearList.push(["band", 4, ...middle]);
    if (!single) gearList.push(["band", 6, ...middle]);
  } else if (gear === "cable") {
    if (single) gearList.push(["cable", 4, ...middle]);
    else if (mode === "neutral" || mode === "straight") {
      gearList.push(["cable", 4, middle[0] + 16, middle[1]], ["cable", 6, middle[0] - 16, middle[1]], ["pad", 4, 0, 0], ["pad", 6, 0, 0]);
    } else if (mode === "mag") {
      gearList.push(["cable", 13, ...middle], ["line", 4, 13], ["line", 6, 13], ["pad", 4, 0, 0], ["pad", 6, 0, 0]);
    } else {
      gearList.push(["cable", 13, ...middle], ["bar", 4, 6]);
      if (mode === "wide") gearList.push(["line", 4, 14], ["line", 6, 15]);
    }
  } else {
    const pivots: Pair = [[220, 32], [94, 32]];
    apparatus.push([95, 32, 95, 157], [94, 32, 120, 32], [194, 32, 220, 32]);
    gearList.push(["line", 4, ...pivots[0]], mode === "rope" ? ["line", 4, 14] : ["pad", 4, 0, 0]);
    if (!single) gearList.push(["line", 6, ...pivots[1]], mode === "rope" ? ["line", 6, 15] : ["pad", 6, 0, 0]);
    if (gear === "plate") {
      gearList.push(["barbell-end", 4, 11, -6]);
      if (!single) gearList.push(["plate", 6, -12, -6]);
    }
    if (gear === "stack") apparatus.push([243, 49, 243, 156], [259, 49, 259, 156], [243, 49, 259, 49],
      [243, 117, 259, 117], [243, 125, 259, 125], [243, 135, 259, 135], [243, 143, 259, 143]);
  }
  if (mode === "under" || (single && gear === "plate")) {
    gearList.push(["palm-up", 4, 11]);
    if (!single) gearList.push(["palm-up", 6, 12]);
  }
  return clip(animated, apparatus, gearList);
}

function floorTowel(knees: boolean): Illustration {
  const neutral: Pose = knees ?
    { body: [[151, 108], [141, 116], [103, 119]], legs: [[103, 152], [77, 155], [96, 153], [65, 156]] } :
    { body: [[162, 143], [147, 150], [107, 151]], legs: [[81, 153], [53, 157], [75, 154], [49, 157]] };
  const extended: Arms = [[169, knees ? 135 : 153], [194, 155], [158, 139], [181, 154]];
  const drawn: Arms = [[132, 142], [154, 154], [120, 143], [141, 154]];
  return clip([track(neutral, extended), track(neutral, drawn), track(neutral, drawn)], [], [["slider", 4, 0, 3], ["slider", 6, 0, 3]]);
}

function plankPull(): Illustration {
  const pose: Pose = {
    body: [[176, 115], [159, 121], [115, 132]],
    legs: [[90, 143], [64, 156], [84, 147], [59, 157]],
  };
  const both: Arms = [[164, 139], [166, 154], [153, 141], [154, 155]];
  const top = track(pose, [[140, 113], [153, 135], both[2], both[3]]);
  const far = track(pose, [both[0], both[1], [130, 117], [144, 134]]);
  const center = track(pose, both);
  return clip([center, top, center, far], [], [], 1000);
}

function stepPull(): Illustration {
  const stance: Pose = {
    body: [[159, 40], [159, 57], [158, 106]],
    legs: [[171, 130], [176, 157], [145, 130], [144, 157]],
  };
  const offset: Pair = [[135, 130], [111, 157]];
  const armsUp: Arms = [[180, 35], [183, 10], [138, 36], [135, 10]];
  const armsDown: Arms = [[176, 91], [169, 70], [144, 91], [151, 70]];
  const start = track(stance, armsUp);
  return clip([start, track({ ...stance, legs: [stance.legs[0], stance.legs[1], ...offset] }, armsDown),
    start, track({ ...stance, legs: [...offset, stance.legs[2], stance.legs[3]] }, armsDown)], [], [], 950);
}

const kneelingBand = downPull("kneel", "band", "neutral");
const bandStraight = downPull("upright", "band", "straight");
const wideCable = downPull("sit", "cable", "wide");
const suspensionPull = vertical({ mount: "strap" });
const twinPulldown = downPull("sit", "cable", "neutral");
const guidedPulldown = downPull("sit", "cable", "wide");

export const verticalPullIllustrations: Readonly<Record<string, Illustration>> = {
  "5801": barMuscleUp("band"),
  "5194": barMuscleUp("strict"),
  "0558": barMuscleUp("kipping"),
  "3312": barMuscleUp("belt"),
  "1357": vertical({ single: true, flow: "still" }),
  "0678": vertical({ grip: "wide" }),
  "0818": { ...twinPulldown, props: [...(twinPulldown.props ?? []), [131, 19, 154, 19]],
    dynamic: [...(twinPulldown.dynamic ?? []), ["thumb-up", 4, 11], ["thumb-up", 6, 12]] },
  "3286": barMuscleUp("rings-belt"),
  "4415": vertical({ underhand: true, assist: "band-foot" }),
  "1367": wideRearPullUp(),
  "1863": { ...guidedPulldown, props: [...(guidedPulldown.props ?? []), [246, 46, 246, 156], [265, 46, 265, 156],
    [235, 46, 265, 46], [246, 117, 265, 117], [246, 125, 265, 125], [246, 133, 265, 133],
    [246, 141, 265, 141], [240, 157, 274, 157]] },
  "10438": vertical({ flow: "shift" }),
  "4716": lowSupport("bar", { underhand: true }),
  "4970": lowSupport("bar", { legs: "deep", underhand: true }),
  "1222": vertical({ mount: "cage", grip: "close", underhand: true, assist: "platform" }),
  "4717": vertical({ grip: "commando", flow: "arched", assist: "band-foot" }),
  "3326": downPull("stagger", "band", "alternate-twist"),
  "4144": downPull("hinge", "band", "neutral"),
  "4358": kneelingBand,
  "0905": kneelingBand,
  "4576": bandStraight,
  "0928": bandStraight,
  "5236": vertical({ underhand: true, flow: "half" }),
  "6392": downPull("sit", "cable", "mag"),
  "9304": wideCable,
  "5123": downPull("sit", "cable", "under"),
  "4217": wideCable,
  "4724": lowSupport("bar", { legs: "deep", underhand: true }),
  "4725": vertical({ flow: "isometric-negative", underhand: true }),
  "4207": vertical({ flow: "arched", underhand: true }),
  "4726": vertical({ grip: "commando", flow: "arched" }),
  "5055": vertical({ flow: "still" }),
  "10902": vertical({ single: true, flow: "negative" }),
  "1865": vertical({ mount: "cage", grip: "shoulder" }),
  "1198": vertical({ flow: "jump", grip: "wide" }),
  "4919": lowSupport("bar", { legs: "sliding", underhand: true }),
  "6881": downPull("sit", "stack", "cross"),
  "1870": downPull("sit", "plate", "neutral"),
  "2665": downPull("sit", "lever", "wide"),
  "5326": downPull("sit", "stack", "rope"),
  "6356": downPull("sit", "lever", "neutral"),
  "11309": downPull("sit", "plate", "single"),
  "4957": downPull("bench", "cable", "bar"),
  "9510": vertical({ assist: "partner" }),
  "0970": vertical({ assist: "band-foot" }),
  "6804": plankPull(),
  "7385": vertical({ flow: "negative", grip: "wide" }),
  "3487": lowSupport("chairs", { recline: true }),
  "10660": vertical({ single: true, assist: "band-foot", free: "wrist" }),
  "10903": vertical({ single: true, assist: "band-knee", free: "chest" }),
  "7512": vertical({ mount: "ring", grip: "wide", flow: "archer" }),
  "7517": vertical({ mount: "ring", single: true }),
  "10661": vertical({ mount: "ring", single: true, assist: "band-foot" }),
  "10662": rotaryRings(),
  "4782": lowSupport("bar", { commando: true, legs: "straight" }),
  "9317": lowSupport("bar", { held: true }),
  "3550": lowSupport("chairs"),
  "5844": downPull("upright", "cable", "single-straight"),
  "3497": floorTowel(false),
  "4831": floorTowel(true),
  "6017": stepPull(),
  "1127": vertical({ mount: "strap", lean: true }),
  "5008": lowSupport("strap", { legs: "straight", underhand: true }),
  "1088": suspensionPull,
  "1094": lowSupport("strap", { legs: "bent" }),
  "6961": vertical({ grip: "uneven" }),
  "2987": vertical({ mount: "cage", grip: "close", underhand: true, assist: "belt" }),
  "2986": vertical({ mount: "cage", grip: "shoulder", assist: "belt" }),
  "3290": vertical({ single: true, assist: "dumbbell" }),
};
