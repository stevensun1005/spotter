import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const degrees = Math.PI / 180;
const floor = .075;
const shoulderHeight = .505;
const upperArm = .252;
const loadedForearm = .371;
const thigh = .422;
const shin = .424;
const add = (a, b) => a.map((coordinate, index) => coordinate + b[index]);
const subtract = (a, b) => a.map((coordinate, index) => coordinate - b[index]);
const scale = (point, amount) => point.map(coordinate => coordinate * amount);
const blend = (a, b, weight) => add(a, scale(subtract(b, a), weight));
const dot = (a, b) => a.reduce((sum, coordinate, index) => sum + coordinate * b[index], 0);
const cross = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const length = point => Math.hypot(...point);
const unit = point => scale(point, 1 / Math.max(.00001, length(point)));
const smooth = value => {
  const weight = clamp(value, 0, 1);
  return weight ** 2 * (3 - 2 * weight);
};
const ramp = (phase, start, end) => smooth((phase - start) / (end - start));
const cycle = (phase, bottom = .43, hold = .55) => ramp(phase, 0, bottom) * (1 - ramp(phase, hold, 1));

function joint(origin, target, pole, first, second) {
  const forward = unit(subtract(target, origin));
  const reach = clamp(length(subtract(target, origin)), Math.abs(first - second) + .006, first + second - .004);
  const along = (first ** 2 - second ** 2 + reach ** 2) / (2 * reach);
  const projected = subtract(pole, scale(forward, dot(pole, forward)));
  const bend = length(projected) > .001 ? unit(projected) : unit(cross(forward, [1, .2, 0]));
  const elbow = add(add(origin, scale(forward, along)), scale(bend, Math.sqrt(Math.max(0, first ** 2 - along ** 2))));
  return [elbow, add(origin, scale(forward, reach))];
}

function body(hips, pitch, yaw = 0, roll = 0) {
  const side = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const up = add(scale(forward, Math.sin(pitch)), [0, Math.cos(pitch), 0]);
  const front = cross(side, up);
  const right = add(scale(side, Math.cos(roll)), scale(front, Math.sin(roll)));
  const chestSide = cross(right, up);
  const at = (height, x = 0, depth = 0) => add(hips, add(scale(up, height), add(scale(right, x), scale(chestSide, depth))));
  return { hips, chest: at(.366, 0, .006), neck: at(.603), head: at(.716, 0, .010),
    ls: at(shoulderHeight, .192, .004), rs: at(shoulderHeight, -.192, .004),
    lh: at(0, .103), rh: at(0, -.103),
    up, right, front: chestSide, planted: { l: 0, r: 0 }, dumbbells: [] };
}

function foot(pose, side, sign, point, pole = [sign * .14, .01, .98], toe = [sign * .025, -.071, .144]) {
  [pose[side + "k"], pose[side + "a"]] = joint(pose[side + "h"], point, pole, thigh, shin);
  pose[side + "t"] = add(pose[side + "a"], toe);
}

function arm(pose, side, target, pole, grip) {
  [pose[side + "e"], pose[side + "w"]] = joint(pose[side + "s"], target, pole, upperArm, grip ? loadedForearm : .326);
  if (grip) holdBell(pose, side, grip);
  return pose[side + "w"];
}

function holdBell(pose, side, direction) {
  const axis = unit(direction);
  pose[side + "Grip"] = axis;
  pose.dumbbells.push({ center: pose[side + "w"], axis });
}

const support = {
  floor: { point: [0, .888, .016], pitch: .015, feet: [.149, floor, .050], camera: [47, 12, [0, .93, .015], 2.09] },
  seat: { point: [.10, .555, 1.210], pitch: .030, feet: [.210, floor, 1.558], camera: [51, 15, [.1, .79, 1.18], 1.76], bench: "bench" },
  wristSeat: { point: [.10, .542, 1.124], pitch: .84, feet: [.24, floor, 1.630], camera: [61, 19, [.1, .67, 1.39], 1.38], bench: "bench" },
  wristBench: { point: [.10, .531, 1.780], pitch: 1.07, yaw: Math.PI, feet: [.26, floor, 1.67], camera: [122, 21, [.1, .61, 1.24], 1.38], bench: "wrist-bench" },
  upright: { point: [0, .568, .277], pitch: -.231, feet: [.206, floor, .651], camera: [51, 14, [0, 1.00, .27], 2.20], bench: "upright-bench" },
  inclineBrace: { point: [.198, .843, -.613], pitch: .465, feet: [.159, floor, -.624], camera: [58, 15, [.04,.85,-.34], 1.82], bench: "incline-bench" },
  incline: { point: [0, .563, .245], pitch: -Math.PI / 4, feet: [.223, floor, .655], camera: [59, 15, [0, .78, .09], 1.83], bench: "incline-bench" },
  incline30: { point: [0, .527, .288], pitch: -Math.PI / 3, feet: [.230, floor, .658], camera: [59, 16, [0, .75, .07], 1.79], bench: "incline-30-bench" },
  incline70: { point: [0, .519, .286], pitch: -Math.PI / 9, feet: [.217, floor, .660], camera: [59, 16, [0, .90, .12], 1.96], bench: "incline-70-bench" },
  flat: { point: [.1, .551, 1.26], pitch: -Math.PI / 2, feet: [.258, floor, 1.530], camera: [67, 17, [.1, .58, 1.00], 1.65], bench: "bench" },
  supineMat: { point: [0, .140, -.027], pitch: -Math.PI / 2, feet: [.210, floor, .561],
    camera: [65, 26, [0, .31, -.10], 1.65], bench: "mat" },
  bridgeMat: { point: [0, .371, .094], pitch: -2.020, feet: [.218, floor, .677],
    camera: [64, 25, [0, .35, -.08], 1.69], bench: "mat" },
  decline: { point: [0, .825, .247], pitch: -1.839, feet: [.163, .521, .815], camera: [66, 17, [0, .66, .135], 1.62], bench: "decline-bench" },
  preacher: { point: [0, .552, -.091], pitch: .238, feet: [.253, floor, .248], camera: [49, 15, [0, .75, .14], 1.70], bench: "preacher-bench" },
  preacherStanding: { point: [0, .758, -.411], pitch: .72, feet: [.260, floor, -.405], camera: [62, 15, [0, .78, .05], 1.78], bench: "preacher-bench" },
  ball: { point: [0, .660, .027], pitch: .035, feet: [.229, floor, .381], camera: [54, 14, [0, .85, .12], 1.95], radius: .285, bench: "stability-ball" },
  zSeat: { point: [0, .148, -.337], pitch: .03, feet: [.18, .090, .493],
    camera: [61, 19, [0, .55, .05], 1.95], bench: "mat" },
  tallKneel: { point: [0, .506, -.045], pitch: .025, feet: [.149, .087, -.477],
    camera: [59, 14, [0, .80, -.07], 1.98] },
  halfKneel: { point: [0, .506, -.045], pitch: .025, feet: [.149, .087, -.477],
    camera: [59, 14, [0, .80, -.01], 2.02] },
  bridge: { point: [0, .562, .307], pitch: -1.445, feet: [.219, floor, .659], camera: [66, 16, [0, .67, .23], 1.72], radius: .285, bench: "stability-ball" },
  kneelingBall: { point: [0, .368, -.178], pitch: .846, feet: [.148, .082, -.628], camera: [57, 16, [0, .66, -.13], 1.57], radius: .285, bench: "stability-ball" },
  kickbackBall: { point: [0, .507, -.178], pitch: 1.02, feet: [.148, .082, -.628],
    camera: [57, 16, [0, .61, -.15], 1.57], radius: .285, ballDepth: .115, bench: "stability-ball" },
  prone: { point: [0, .518, .255], pitch: Math.PI / 4, yaw: Math.PI, feet: [.301, floor, .565], camera: [96, 18, [0, .74, .13], 1.73], bench: "chest-bench" },
  proneStanding: { point: [0, .518, .255], pitch: Math.PI / 4, yaw: Math.PI, feet: [.184, floor, .944],
    camera: [135, 20, [0, .67, .255], 1.89], bench: "chest-bench" },
  proneFlat: { point: [.10, .553, 1.25], pitch: Math.PI / 2, yaw: Math.PI, feet: [.123, .55, 1.89], camera: [138, 17, [.1, .62, 1.02], 1.62], bench: "bench" },
  hinge: { point: [0, .819, -.195], pitch: 1.105, feet: [.161, floor, .058], camera: [55, 14, [0, .70, .03], 1.73] },
  hingeSeat: { point: [.1, .550, 1.208], pitch: 1.172, feet: [.217, floor, 1.545], camera: [62, 15, [.1, .55, 1.39], 1.54], bench: "bench" },
  raiseBrace: { point: [-.028, .894, .012], pitch: .015, feet: [.140, floor, .057], camera: [49, 12, [-.13,.93,.09], 2.10], bench: "raise-brace" },
  headBrace: { point: [0, .807, -.227], pitch: 1.285, feet: [.164, floor, -.069], camera: [60, 16, [0,.67,.20], 1.73], bench: "head-brace" },
  inclineBall: { point: [0, .654, .24], pitch: -.828, feet: [.224, floor, .602], camera: [57, 15, [0, .80, .12], 1.85], radius: .285, bench: "incline-ball" },
  inclineOnBall: { point: [0, .503, .310], pitch: -1.155, feet: [.224, floor, .642],
    camera: [65, 18, [0, .73, .22], 1.84], radius: .285, ballDepth: -.065, bench: "stability-ball" },
  proneGround: { point: [0, .149, .214], pitch: Math.PI / 2, yaw: Math.PI, feet: [.132, .107, 1.000],
    camera: [142, 24, [0,.34,.14], 1.30], bench: "mat" },
  benchSquat: { camera: [57, 14, [.1,.91,1.28], 2.06], bench: "bench" },
  rearBench: { camera: [71, 14, [.08,.84,1.77], 2.08], bench: "bench" },
  deadliftStep: { camera: [63, 13, [0,.84,-.12], 1.94], bench: "rear-step" },
  frontStep: { camera: [56, 13, [0,1.03,.32], 2.16], bench: "step" },
  seatCalfFloor: { camera: [53, 17, [.1,.65,1.44], 1.47], bench: "bench" },
  seatStep: { camera: [56, 18, [.1,.67,1.44], 1.60], bench: "seat-step" },
  stepBrace: { camera: [54, 12, [-.15,.98,.13], 2.11], bench: "step-brace" },
  wallBall: { camera: [48, 13, [0,.96,-.17], 2.08], bench: "wall-ball" },
  wallBallKnees: { camera: [38, 14, [0,.89,-.11], 2.03], bench: "wall-ball-knees" },
  wallBallAnkles: { camera: [43, 15, [0,.85,-.12], 2.00], bench: "wall-ball-ankles" },
  pushupFloor: { camera: [62, 20, [0,.34,-.50], 1.40], bench: "mat" },
  sideFloor: { camera: [58, 19, [0, .36, .30], 1.38], bench: "mat" },
  plank: { camera: [62, 17, [0, .757, .32], 2.16], bench: "mat" },
  armBlaster: { point: [0, .886, .008], pitch: .015, feet: [.152, floor, .05], camera: [48, 12, [0, .94, .03], 2.06], bench: "arm-blaster" },
};

function fromSupport(setting, options = {}) {
  const base = support[setting];
  const pose = body(options.point ?? base.point, options.pitch ?? base.pitch, base.yaw);
  for (const [side, sign] of sides) {
    const [x, y, z] = base.feet;
    const reversed = base.yaw ? -sign : sign;
    const target = [pose.hips[0] + reversed * x, y, z];
    const pole = [reversed * .10, 0, base.yaw ? -.97 : .97];
    const toes = [reversed * .021, -.071, base.yaw ? -.146 : .146];
    if (setting === "flat" || setting === "bridge" || setting === "inclineOnBall") pole[1] = .75;
    if (setting === "decline") {
      pole[1] = 1;
      toes[1] = -.115;
    }
    if (setting === "proneFlat") {
      pole[1] = -.7;
      toes[1] = -.105;
    }
    if (setting === "kneelingBall" || setting === "kickbackBall") {
      pole[1] = -1;
      toes[2] = -.145;
      delete pose.planted[side];
    }
    if (setting === "zSeat") {
      pole[1] = .81;
      toes.splice(1, 2, .131, .047);
      delete pose.planted[side];
    }
    if (setting === "tallKneel" || setting === "halfKneel") {
      if (setting === "halfKneel" && side === "l") {
        target[1] = floor;
        target[2] = .374;
        pole[1] = .63;
      } else {
        pole[1] = -1;
        toes[2] = -.146;
        delete pose.planted[side];
      }
    }
    if (setting === "floor" && options.stork && side === "r") {
      target[1] = .132;
      target[2] = -.228;
      toes[1] = -.128;
    }
    if ((setting === "ball" || setting === "bridge") && options.oneLeg && side === "r") {
      target[1] = options.extendLeg ? .637 : setting === "ball" ? .395 : .447;
      target[2] = options.extendLeg ? .852 : setting === "ball" ? .661 : .877;
      toes[1] = .053;
      delete pose.planted.r;
    }
    if (setting === "decline" || setting === "proneFlat") delete pose.planted[side];
    foot(pose, side, reversed, target, pole, toes);
  }
  if (base.radius) {
    const z = base.ballDepth ?? (setting === "bridge" ? -.090 : setting === "kneelingBall" ? .333
      : setting === "inclineBall" ? .24 : .003);
    pose.ballCenter = [0, base.radius, z];
  }
  return pose;
}

function inactive(pose, side, sign, position = "low") {
  if (position === "brace" || position === "thigh") {
    const knee = pose[side + "k"];
    arm(pose, side, add(knee, [0, .058, -.080]), [sign * .55, -.65, .10]);
    return;
  }
  if (position === "chest") {
    arm(pose, side, add(pose.chest, [sign * .024, .113, .045]), [sign * .85, -.42, 0]);
    return;
  }
  arm(pose, side, add(pose[side + "s"], [sign * .052, -.549, .039]), [sign * .4, -.2, -.83]);
}

function depthFor(phase, mode, side) {
  if (mode === "alternate") {
    const within = side === "l" ? phase * 2 : phase * 2 - 1;
    return cycle(within, .43, .54);
  }
  return cycle(phase);
}

function curl(phase, { setting = "floor", grip = "under", mode = "both", form = "plain" } = {}) {
  const global = cycle(phase);
  const squat = form === "squat";
  const concentration = form === "concentration";
  const standingConcentration = form === "standing-concentration";
  const pose = fromSupport(setting, {
    oneLeg: form === "leg-raised" || form === "leg-raised-straight", extendLeg: form === "leg-raised-straight",
    stork: form === "stork",
    ...(squat ? { point: [0, .889 - .308 * global, .025 - .129 * global], pitch: .04 + .252 * global } : {}),
    ...(concentration ? { pitch: .57 } : {}),
  });
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      if (form === "bench-brace") {
        arm(pose, side, [-.135, .796, -.168], [-.54, -.642, .12]);
      } else if (form === "prone-brace") {
        arm(pose,side,[.228,.712,-.158],[.78,-.34,-.49]);
        pose.rFingers = [0,-.27,-.96];
        pose.rPalmSide = [0,.85,-.52];
      } else {
        inactive(pose, side, sign, concentration || standingConcentration ? "thigh" : form === "leg-raised" ? "chest" : "low");
      }
      continue;
    }
    const amount = form === "isometric" ? .58 * cycle(phase, .16, .84)
      : form === "mid-hold" ? .58 * ramp(phase, 0, .19) + .42 * ramp(phase, .56, .68) - ramp(phase, .75, 1)
        : depthFor(phase, mode, side);
    if (form === "drag") {
      const track = blend([sign * .081, -.603, .046], [sign * .046, .041, .109], amount);
      arm(pose, side, add(pose[side + "s"], track), [sign * .24, -.39, -.90], [1, 0, 0]);
      continue;
    }
    const prone = setting.startsWith("prone");
    const reversed = prone ? -sign : sign;
    let upper = [reversed * .079, -.239, .018];
    if (setting === "incline") upper = [sign * .074, -.240, -.025];
    if (setting === "preacher" || setting === "preacherStanding") upper = [sign * .024, -.177, .177];
    if (setting === "kneelingBall") upper = [-sign * .078, -.130, .203];
    if (setting === "flat") upper = [sign * (form === "wide" ? .248 : .235), form === "wide" ? -.027 : -.065, .057];
    if (setting === "prone" || setting === "proneStanding") upper = [reversed * .068, -.240, -.038];
    if (setting === "proneFlat") upper = [reversed * .233, -.067, -.041];
    if (setting === "armBlaster") upper = [sign * .065, -.234, .065];
    if (form === "high") upper = [sign * .064, -.223, .100];
    if (form === "inner") upper = [sign * .107, -.223, .031];
    if (concentration) {
      const thighContact = add(pose[side + "k"], [-sign * .048, .039, -.093]);
      upper = subtract(thighContact, pose[side + "s"]);
    }
    const elbow = add(pose[side + "s"], scale(unit(upper), upperArm));
    const first = setting === "preacher" || setting === "preacherStanding" || setting === "kneelingBall" ? .69 : .105;
    const last = form === "high" ? 2.58 : setting === "preacher" || setting === "preacherStanding" ? 2.66 : 2.44;
    const angle = first + (last - first) * amount;
    const curlDirection = prone ? -1 : 1;
    const path = unit([form === "cross" ? -sign * .77 * amount : form === "wide" ? sign * .27 : .028 * reversed,
      -Math.cos(angle), curlDirection * Math.sin(angle)]);
    pose[side + "e"] = elbow;
    pose[side + "w"] = add(elbow, scale(path, loadedForearm));
    const neutral = [0, Math.sin(angle), curlDirection * Math.cos(angle)];
    const transverse = [prone ? -1 : 1, 0, 0];
    const rotation = Math.PI * (ramp(phase, .38, .53) - ramp(phase, .90, 1));
    const reverseTurn = Math.PI * (1-ramp(phase,.37,.49)+ramp(phase,.52,.65));
    const axis = grip === "reverse-turn" ? add(scale(transverse,Math.cos(reverseTurn)),scale(neutral,Math.sin(reverseTurn)))
      : grip === "zottman" ? add(scale(transverse, Math.cos(rotation)), scale(neutral, Math.sin(rotation)))
      : grip === "hammer" ? neutral : grip === "reverse" ? scale(transverse, -1)
        : grip === "supinate" ? blend(neutral, transverse, smooth(amount * 1.45)) : transverse;
    holdBell(pose, side, axis);
  }
  return pose;
}

function raise(phase, { setting = "floor", plane = "front", mode = "both", form = "straight", grip = "regular" } = {}) {
  const pose = fromSupport(setting);
  const facing = pose.right[0] < 0 ? -1 : 1;
  for (const [side, sign] of sides) {
    const localSign = facing * sign;
    if (mode === "single" && side === "r") {
      if (setting === "raiseBrace") arm(pose, side, [-.510, 1.107, .260], [-.76, -.31, -.22]);
      else inactive(pose, side, localSign, setting === "proneFlat" ? "chest" : "low");
      continue;
    }
    const split = plane === "combo" || plane === "front-side";
    const first = plane === "front-side" ? "front" : "lateral";
    const second = first === "front" ? "lateral" : "front";
    const direction = split ? phase <= .5 ? first : second : plane;
    const amount = split ? cycle((phase * 2) % 1) : form === "hold" ? cycle(phase, .29, .69) : depthFor(phase, mode, side);
    if (setting === "proneGround") {
      const angle = (21 + 51 * amount) * degrees;
      const arc = [localSign * .578 * Math.sin(angle), .09 + .177 * amount, -.562 * Math.cos(angle)];
      arm(pose, side, add(pose[side + "s"], arc), [localSign * .20, -.70, -.14], [0, 0, 1]);
      continue;
    }
    const peak = direction === "above" ? 157 : direction === "y" ? 133 : direction === "front" ? 92 : 87;
    const angle = (form === "partial" ? 21 + 43 * amount : 8 + (peak - 8) * amount) * degrees;
    const floorDirection = direction === "front" || direction === "above" ? [localSign * .075, 0, facing]
      : direction === "scaption" ? [localSign * .73, 0, facing * .68]
      : direction === "y" ? [localSign * .60, 0, facing * .79]
      : [localSign, 0, direction === "rear" && !setting.startsWith("prone") ? -.20 : .048];
    const travel = add(scale(unit(floorDirection), Math.sin(angle)), [0, -Math.cos(angle), 0]);
    const rightAngle = form === "right-angle";
    const reach = rightAngle ? .433 : form === "bent" ? .480 : .603;
    const target = add(pose[side + "s"], scale(travel, reach));
    if (setting === "proneFlat") target[1] = Math.max(target[1], .103);
    const naturalGrip = grip === "hammer" ? [0, 0, facing] : grip === "under" ? [-facing, 0, 0]
      : grip === "thumbs-down" || grip === "thumbs-up" ? blend([0, 0, 1], [0, grip === "thumbs-up" ? 1 : -1, 0], amount)
      : form === "rotate" ? blend([0, 0, 1], [0, .98, .10], amount) : direction === "front" || direction === "above"
        ? blend([0, 0, facing], [facing, 0, 0], amount) : blend([0, 0, 1], [0, .18, 1], amount);
    const alignElbow = setting === "proneStanding" || form === "rear-facing";
    const pole = rightAngle ? [localSign * .90, -.19, -.40] : form === "bent" ? [localSign * .95, .28, .47]
      : [localSign * .28, -.9, alignElbow ? facing * .27 : .27];
    arm(pose, side, target, pole, naturalGrip);
  }
  return pose;
}

function shoulderPress(phase, { setting = "floor", mode = "both", form = "plain", startsOverhead = false } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const amount = startsOverhead ? 1 - depthFor(phase, mode, side) : depthFor(phase, mode, side);
    const narrow = form === "narrow";
    const scott = form === "scott";
    const neutral = form === "neutral" || narrow;
    const arnold = form === "arnold";
    const start = [sign * (arnold ? -.073 : narrow ? -.121 : neutral ? .105 : .181),
      arnold ? .035 : .099, arnold ? .318 : neutral ? .180 : .100];
    const end = add(scale(pose.front, .075), [sign * (narrow ? -.121 : .035), scott ? .309 : .580, .010]);
    const middle = [sign * .200, .21, .106];
    const travel = arnold ? blend(blend(start, middle, smooth(amount / .52)), end, smooth((amount - .29) / .71)) : blend(start, end, amount);
    const wrist = add(pose[side + "s"], travel);
    const turn = Math.PI * smooth(amount);
    const grip = arnold ? [-Math.cos(turn), 0, sign * Math.sin(turn)] : neutral ? [0, 0, 1] : [1, 0, 0];
    const pole = arnold ? [sign * (.44 + .44 * amount), -.90, .32 - .15 * amount] : [sign * .879, -.523, .131];
    arm(pose, side, wrist, pole, grip);
  }
  return pose;
}

function chestPress(phase, { setting = "flat", mode = "both", form = "regular", startLow = false, hold = false,
  legsRaised = false, lowArc = false } = {}) {
  const pose = fromSupport(setting, { oneLeg: form === "one-leg" });
  const floorPress = setting === "supineMat";
  for (const [side, sign] of sides) {
    if (legsRaised) benchTabletopLeg(pose,side,sign);
    if (mode === "single" && side === "r") {
      if (floorPress) {
        arm(pose, side, [-.48, .055, -.158], [-.53, -.29, .81]);
        pose.rPalmSide = [0, 1, 0];
        pose.rFingers = [-.80, .01, .60];
      } else inactive(pose, side, sign, "chest");
      continue;
    }
    const move = hold ? cycle(phase, .20, .84) : depthFor(phase, mode, side);
    const depth = startLow ? 1 - move : move;
    const fly = form === "fly" || form === "twist-fly" || form === "one-leg";
    const squeeze = form === "squeeze" || form === "reverse-squeeze";
    const neutral = form === "neutral" || form === "twist-press" || form === "squeeze";
    const inward = form === "reverse-squeeze" ? -.033 : -.122;
    const top = [sign * (squeeze ? inward : fly ? -.073 : .021), .603, .022];
    const bottom = fly ? [sign * .598, .073, .027]
      : [sign * (squeeze ? inward : neutral ? .129 : form === "wide" ? .285 : .244), squeeze&&floorPress?.226:.223, .114];
    const travel = fly
      ? [sign * (-.073 + (lowArc ? .557 : .666) * Math.sin(depth * Math.PI / 2)), .073 + .53 * Math.cos(depth * Math.PI / 2), lowArc ? .190+.062*depth : .028]
      : blend(top, bottom, depth);
    const grip = form === "twist-fly" ? blend([0, 0, 1], [1, 0, 0], depth) :
      form === "twist-press" ? blend([0, 0, 1], [1, 0, 0], 1 - depth) :
      form === "supinated-press" ? [-Math.cos(Math.PI * (1 - depth)), 0, sign * Math.sin(Math.PI * (1 - depth))] :
      fly || neutral ? [0, 0, 1] : form === "reverse" || form === "reverse-squeeze" ? [-1, 0, 0] : [1, 0, 0];
    const pole = fly ? [sign * .20, -.8, .359] : [sign * (neutral ? .25 : .86), -.83, neutral ? .65 : .33];
    const shoulder = pose[side + "s"];
    if (floorPress && !fly && !squeeze) {
      const upper = blend([sign * .032, .250, .010], [sign * (neutral ? .153 : .223), -.046, neutral ? .194 : .104], depth);
      const forearm = blend([-sign * .014, .370, .010], [-sign * .034, .366, -.015], depth);
      pose[side + "e"] = add(shoulder, scale(unit(upper), upperArm));
      pose[side + "w"] = add(pose[side + "e"], scale(unit(forearm), loadedForearm));
      holdBell(pose, side, grip);
    } else {
      arm(pose, side, add(shoulder, travel), pole, grip);
    }
  }
  return pose;
}

function row(phase, { setting = "hinge", mode = "both", form = "plain", braceFree = false } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    const facing = pose.right[0] < 0 ? -1 : 1;
    const lateral = facing * sign;
    if (mode === "single" && side === "r") {
      if (braceFree) {
        arm(pose, side, [lateral * .228, .712, -.158], [lateral * .78, -.34, -.49]);
        pose.rFingers = [0, -.27, -.96];
        pose.rPalmSide = [0, .85, -.52];
      } else inactive(pose, side, lateral, form === "brace" ? "thigh" : "low");
      continue;
    }
    const amount = depthFor(phase, mode, side);
    const high = form === "rear";
    const down = setting === "proneFlat" ? [lateral * .076, -.454, .019] : [lateral * .046, -.603, .019];
    const facePull = form === "face-pull";
    const scapular = form === "scapular";
    const peak = facePull ? [lateral * -.038, .065, facing * .212] :
      scapular ? [lateral * .040, -.600, .018] :
        high ? [lateral * .185, -.148, facing * .047] : [lateral * .043, -.135, facing * -.327];
    const pole = [lateral * (high || facePull ? .93 : .13), -.09, -facing * .88];
    if (scapular) pose[side + "s"] = add(pose[side + "s"], [-lateral * .029 * amount, .057 * amount, -.024 * facing * amount]);
    const grip = form === "reverse" ? [-facing, 0, 0] : form === "overhand" ? [facing, 0, 0] :
      form === "overhand-to-neutral" ? blend([facing, 0, 0], [0, 0, facing], amount) :
      form === "swivel" ? blend([0, 0, 1], [-facing, 0, 0], amount) : [0, 0, facing];
    arm(pose, side, add(pose[side + "s"], blend(down, peak, amount)), pole, grip);
  }
  return pose;
}

function uprightRow(phase, { mode = "both" } = {}) {
  const pose = fromSupport("floor");
  const amount = cycle(phase);
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign);
      continue;
    }
    const down = [-sign * .068, -.59, .128];
    const peak = [-sign * .045, -.042, .202];
    arm(pose, side, add(pose[side + "s"], blend(down, peak, amount)), [sign * .96, .51, .14], [1, 0, 0]);
  }
  return pose;
}

function shrug(phase, { setting = "floor", mode = "both" } = {}) {
  const amount = cycle(phase, .33, .61);
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    const lateral = pose.right[0] < 0 ? -sign : sign;
    if (mode === "single" && side === "r") {
      if (setting === "seat") {
        arm(pose,side,[-.101,.485,1.075],[-.64,-.37,-.54]);
        pose.rFingers=[-.06,-.03,-.998];
        pose.rPalmSide=[0,1,0];
      } else inactive(pose,side,sign);
      continue;
    }
    pose[side + "s"] = add(pose[side + "s"], [lateral * -.020 * amount, .085 * amount, .012 * amount]);
    arm(pose, side, add(pose[side + "s"], [lateral * .115, -.606, .071]), [lateral * .49, -.17, -.73], [0, 0, 1]);
  }
  return pose;
}

function kickback(phase, { setting = "hinge", mode = "both" } = {}) {
  const pose = fromSupport(setting);
  const facing = setting === "proneStanding" ? -1 : 1;
  const fixedTorso = setting === "proneStanding" || setting === "kickbackBall";
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const elbow = add(pose[side + "s"], fixedTorso ? [sign * .031 * facing, -.248 * pose.up[1], -.248 * pose.up[2]]
      : setting === "hingeSeat" ? [sign * .087, -.055, -.230]
      : [sign * .027 * facing, -.055, -.244 * facing]);
    const amount = depthFor(phase, mode, side);
    const extension = fixedTorso ? Math.atan2(Math.abs(pose.up[2]), pose.up[1]) : 94 * degrees;
    const bend = fixedTorso ? .140 + (extension - .140) * amount : (8 + 86 * amount) * degrees;
    pose[side + "e"] = elbow;
    pose[side + "w"] = add(elbow, [0, -loadedForearm * Math.cos(bend), -loadedForearm * Math.sin(bend) * facing]);
    holdBell(pose, side, [0, -Math.sin(bend), Math.cos(bend) * facing]);
  }
  return pose;
}

function elbowExtension(phase, { setting = "floor", mode = "both", sharedBell = false, form = "plain", arcDegrees } = {}) {
  const pose = fromSupport(setting);
  const lyingDown = ["flat", "decline", "incline", "bridge", "supineMat"].includes(setting);
  const arc = arcDegrees ?? (lyingDown ? 73 : 112);
  const sharedAngle = (8 + arc * cycle(phase)) * degrees;
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r" && !sharedBell) {
      if (form === "seat-brace") {
        arm(pose,side,[-.101,.485,1.075],[-.64,-.37,-.54]);
        pose.rFingers=[-.06,-.03,-.998];
        pose.rPalmSide=[0,1,0];
      } else inactive(pose, side, sign, lyingDown ? "chest" : "thigh");
      continue;
    }
    const amount = form==="across-face" && side==="r" ? 0 : depthFor(phase,mode,side);
    const angle = sharedBell ? sharedAngle : (8 + arc * amount) * degrees;
    const elbow = add(pose[side + "s"], [sign * (sharedBell ? -.078 : -.025), .230,
      form==="across-face"?.017:lyingDown ? -.099 : .101]);
    pose[side + "e"] = elbow;
    const inward = sharedBell ? -sign * .065 : form==="across-face" ? -.169*amount : 0;
    const reach = form==="across-face" ? Math.sqrt(loadedForearm**2-inward**2) : loadedForearm;
    pose[side + "w"] = add(elbow, [inward, reach * Math.cos(angle), -reach * Math.sin(angle)]);
    if (sharedBell) {
      pose[side + "Grip"] = [sign, 0, 0];
      pose[side + "Fingers"] = [0, Math.sin(angle), Math.cos(angle)];
    } else {
      holdBell(pose, side, form === "reverse" ? [-sign, 0, 0] : [0, Math.sin(angle), Math.cos(angle)]);
    }
  }
  if (sharedBell) {
    const [sin, cos] = [Math.sin(sharedAngle), Math.cos(sharedAngle)];
    pose.dumbbells.push({ center: add(blend(pose.lw, pose.rw, .5), [0, -.044 * sin, -.044 * cos]),
      axis: [0, cos, -sin] });
  }
  return pose;
}

function benchTabletopLeg(pose,side,sign) {
  const knee=add(pose[side+"h"],[sign*.049,.399,.120]);
  const ankle=add(knee,[sign*.019,-.076,.415]);
  pose[side+"k"]=knee;
  pose[side+"a"]=ankle;
  pose[side+"t"]=add(ankle,[sign*.014,.067,.135]);
  delete pose.planted[side];
}

function pullover(phase, { setting = "flat", mode = "both", form = "plain", hold = false, legsRaised = false } = {}) {
  const pose = fromSupport(setting);
  const amount = hold ? cycle(phase, .21, .82) : cycle(phase);
  const angle = .025 + amount * (form === "around" ? 1.76 : 1.59);
  const right = [1, 0, 0];
  const single = mode === "single";
  let center;
  for (const [side, sign] of sides) {
    if (legsRaised) benchTabletopLeg(pose,side,sign);
    if (single && side === "r") {
      inactive(pose, side, sign, "chest");
      continue;
    }
    const reach = form === "straight" ? .606 : form === "bent" ? .536 : .59;
    const crossBody = sign * (single ? -.017 : -.106);
    const target = add(pose[side + "s"], [crossBody, reach * Math.cos(angle), -reach * Math.sin(angle)]);
    arm(pose, side, target, [sign * .48, -.12, -.25]);
    pose[side + "Grip"] = right;
    pose[side + "Fingers"] = [0, Math.cos(angle), -Math.sin(angle)];
    center = center ? blend(center, pose[side + "w"], .5) : pose[side + "w"];
  }
  pose.dumbbells.push({ center: add(center, [0, -.036 * Math.sin(angle), -.035 * Math.cos(angle)]),
    axis: single ? right : [0, Math.cos(angle), -Math.sin(angle)] });
  return pose;
}

function wristCurl(phase, { setting = "seat", mode = "both", form = "under", overBench = false } = {}) {
  const pose = fromSupport(setting === "seat" ? "wristSeat" : setting);
  const amount = cycle(phase);
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const angle = (form === "fingers" ? -7 + 14 * amount : form === "supination" ? 0 : -42 + 84 * amount) * degrees;
    if (overBench) {
      pose[side + "e"] = [.10 - sign * .164, .516, 1.180];
      pose[side + "w"] = [.10 - sign * .165, .487 + .093 * Math.sin(angle), .784 - .084 * Math.cos(angle)];
    } else {
      const knee = pose[side + "k"];
      const elbow = add(knee, [sign * -.025, .048, -.187]);
      pose[side + "e"] = elbow;
      pose[side + "w"] = add(elbow, [sign * -.015, -.014 + .10 * Math.sin(angle), .266 + .103 * Math.cos(angle)]);
    }
    const tangent = [0, Math.sin(angle), Math.cos(angle)];
    pose[side + "Fingers"] = tangent;
    if (form === "fingers" || form === "roll") {
      const release = 1 - amount;
      pose[side + "Grip"] = [sign, 0, 0];
      pose[side + "FingerCurl"] = .18 + .82 * amount;
      pose.dumbbells.push({ center: add(pose[side + "w"], [0, -.044 * release, .064 * release]), axis: [1, 0, 0] });
    } else if (form === "supination") {
      const rotation=Math.PI*amount;
      holdBell(pose,side,[-Math.cos(rotation),Math.sin(rotation),0]);
    } else {
      holdBell(pose, side, form === "neutral" ? [0, Math.cos(angle), -Math.sin(angle)]
        : [form === "reverse" ? -sign : sign, 0, 0]);
    }
  }
  return pose;
}

function externalRotation(phase, { setting = "floor", sideLying = false } = {}) {
  const standing = setting === "floor" && !sideLying;
  const pose = standing ? fromSupport("floor") : sideSupport(setting);
  const angle = (.049 + 1.41 * cycle(phase));
  for (const [side, sign] of sides) {
    if (!standing && side === "r") continue;
    const elbow = add(pose[side + "s"], standing ? [sign * .249, -.020, -.029] : [.019, -.11, .222]);
    pose[side + "e"] = elbow;
    pose[side + "w"] = add(elbow, standing
      ? [sign * .065, loadedForearm * Math.sin(angle), loadedForearm * Math.cos(angle)]
      : [loadedForearm * Math.cos(angle), loadedForearm * Math.sin(angle), -.023]);
    holdBell(pose, side, standing ? [0, Math.cos(angle), -Math.sin(angle)] : [0, 0, 1]);
  }
  return pose;
}

function sideSupport(setting) {
  const bench = setting === "flat";
  const plank = setting === "plank";
  const pose = body(bench ? [.10, .700, 1.249] : [0, plank ? .651 : .170, .245], plank ? -1.20 : -Math.PI / 2, 0, Math.PI / 2);
  delete pose.planted.l;
  delete pose.planted.r;
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [bench ? .10 : 0, bench ? .693 : (plank ? .137 : .133) - (1 - sign) * .046,
      pose.hips[2] + (plank ? .693 : side === "l" ? .804 : .795)], [1, .25, -.05], [.123, -.025, .045]);
  }
  if (plank) {
    arm(pose, "r", [-.019, .057, pose.rs[2] + .032], [-.22, -.12, .13]);
    pose.rFingers = [-.23, 0, -.97];
    pose.rPalmSide = [0, 1, 0];
  } else {
    arm(pose, "r", add(pose.head, [-.043, -.042, .067]), [-.89, -.23, -.34]);
  }
  return pose;
}

function sideRaise(phase, { setting = "sideFloor" } = {}) {
  const pose = sideSupport(setting);
  const amount = cycle(phase);
  const angle = (setting === "plank" ? -24 : 3) * degrees + amount * (setting === "plank" ? 111 : 85) * degrees;
  const direction = setting === "plank" ? [Math.cos(angle), Math.sin(angle), .022] : [.04, Math.sin(angle), Math.cos(angle)];
  arm(pose, "l", add(pose.ls, scale(direction, .606)), [-.35, .58, -.49], [0, 0, 1]);
  return pose;
}

function hangingBells(pose, { mode = "both", forward = .02, grip = [0, 0, 1] } = {}) {
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign);
    } else {
      arm(pose, side, add(pose[side + "s"], [sign * .087, -.595, forward]), [sign * .42, -.28, -.61], grip);
    }
  }
}

function holdGoblet(pose, curlDepth = 0) {
  const center = add(pose.chest, [0, -.029 - .364 * curlDepth, .247 + .053 * curlDepth]);
  for (const [side, sign] of sides) {
    arm(pose, side, add(center, [sign * .060, .077, -.002]), [sign * .43, -.86, .52]);
    pose[side + "Grip"] = [sign, 0, 0];
    pose[side + "Fingers"] = [0, .75, .45];
  }
  pose.dumbbells.push({ center, axis: [0, 1, 0] });
}

function gobletSquat(phase, { setting = "floor", form = "plain", load = "goblet" } = {}) {
  const wall = setting === "wallBall";
  const wide = form === "sumo";
  const depth = form === "hold" ? cycle(phase, .27, .72) : form === "curl" ? cycle(phase, .31, .70)
    : form === "calf" ? cycle(phase, .31, .42) * (1 - ramp(phase, .63, .73)) : cycle(phase);
  const heels = form === "calf" ? .079 * ramp(phase, .74, .87) * (1 - ramp(phase, .89, 1)) : 0;
  const hips = wall ? [0, .821 - .319 * depth, .061 - .016 * depth]
    : [0, .887 - .354 * depth + heels * .75, .029 - .202 * depth];
  const pose = body(hips, wall ? -.048 : .026 + .301 * depth);
  for (const [side, sign] of sides) {
    const stance = sign * (wide ? .31 : .174);
    const contact = [stance, floor + heels, wall ? .425 : .106 + heels * .34];
    foot(pose, side, sign, contact, [sign * (wide ? .56 : .22), .031, .89],
      [sign * (wide ? .076 : .025), -.071 - heels, .131 - heels * .34]);
    if (load === "between") {
      arm(pose, side, add(pose[side + "s"], [-sign * .081, -.590, .029]), [sign * .32, -.22, -.68], [0, 0, 1]);
    }
  }
  if (wall) pose.ballCenter = [0, .950 - .228 * depth, -.339];
  if (load === "goblet") {
    const curlDepth = form === "curl" ? ramp(phase, .35, .46) * (1 - ramp(phase, .51, .64)) : 0;
    holdGoblet(pose, curlDepth);
  } else if (load === "sides") {
    hangingBells(pose, { forward: .048 - .088 * depth });
  }
  return pose;
}

function squat(phase, { setting = "floor", form = "plain" } = {}) {
  const jump = form === "jump";
  const oneLeg = form === "single-leg";
  const goblet = form === "bench";
  const initial = jump ? ramp(phase, 0, .31) * (1 - ramp(phase, .34, .47)) : cycle(phase, .42, .57);
  const landing = jump ? ramp(phase, .64, .75) * (1 - ramp(phase, .76, 1)) * .65 : 0;
  const lift = jump ? ramp(phase, .46, .55) * (1 - ramp(phase, .55, .66)) : 0;
  const depth = Math.max(initial, landing);
  const pose = body([goblet ? .10 : 0, .892 - .380 * depth + .19 * lift, (goblet ? 1.533 : .012) - .234 * depth],
    .027 + (oneLeg ? .36 : .41) * depth);
  for (const [side, sign] of sides) {
    const relax = oneLeg && side === "r";
    const x = pose.hips[0] + sign * (oneLeg ? .100 : form === "narrow" ? .075 : .180);
    const z = goblet ? 1.625 : .13;
    const point = relax ? [x, .256 + .085 * depth, z + .33] : [x, floor + lift * .19, z];
    if (lift > 0 || relax) delete pose.planted[side];
    foot(pose, side, sign, point, [sign * .42, .05, .91], [sign * .031, -.070, .149]);
  }
  if (goblet) {
    const center = add(pose.chest, [0, -.029, .247]);
    for (const [side, sign] of sides) {
      arm(pose, side, add(center, [sign * .060, .077, -.002]), [sign * .43, -.86, .52]);
      pose[side + "Grip"] = [sign, 0, 0];
      pose[side + "Fingers"] = [0, .75, .45];
    }
    pose.dumbbells.push({ center, axis: [0, 1, 0] });
  } else {
    hangingBells(pose, { forward: .025 - .084 * depth });
  }
  return pose;
}

function deadlift(phase, { form = "bent", mode = "both", grip = "overhand", longRearLeg = false, hold = false } = {}) {
  const amount = hold ? cycle(phase,.27,.75) : cycle(phase);
  const straight = form === "straight";
  const single = mode === "single";
  const hinge = (straight ? .97 : 1.09) * amount;
  const pose = body([single ? .045 : 0, .887 - (straight ? .08 : single ? .11 : .196) * amount,
    .017 - (straight ? .232 : single ? .131 : .236) * amount], .029 + hinge);
  for (const [side, sign] of sides) {
    const supportLeg = single && side === "r";
    const rearAngle = .21 + 1.40 * amount;
    const target = supportLeg ? longRearLeg
      ? add(pose[side + "h"], [-.071, -.833 * Math.cos(rearAngle), -.833 * Math.sin(rearAngle)])
      : [-.162, .217 + .32 * amount, -.490 - .16 * amount] : [sign * .141, floor, .099];
    foot(pose, side, sign, target, [sign * .10, .064, .98], [sign * .025, -.071, supportLeg ? -.123 : .144]);
    if (supportLeg) {
      delete pose.planted[side];
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const neutral = grip === "neutral";
    const hanging = [sign * (neutral ? .083 : .056), -.605, (neutral ? .038 : .115) - .132 * amount];
    arm(pose, side, add(pose[side + "s"], hanging), [sign * .53, -.23, -.70], neutral ? [0, 0, 1] : [1, 0, 0]);
  }
  return pose;
}

function lunge(phase, { form = "plain", mode = "both", narrowStance = false } = {}) {
  const extension = form === "extension";
  const opposite = form === "opposite";
  const alternating = !extension && !opposite;
  const firstHalf = phase <= .5;
  const fraction = alternating ? firstHalf ? phase * 2 : (phase - .5) * 2 : phase;
  const chosen = opposite ? "r" : firstHalf || !alternating ? "l" : "r";
  const reverse = form === "reverse";
  const forwardSign = chosen === "l" ? 1 : -1;
  const depth = ramp(fraction, .13, .37) * (1 - ramp(fraction, extension ? .77 : .59, .91));
  const step = ramp(fraction, 0, .22) * (1 - ramp(fraction, .74, 1));
  const swing = Math.max(0, Math.sin(step * Math.PI)) * .106;
  const twist = form === "bowling" ? forwardSign * .57 * depth : 0;
  const pose = body([forwardSign * .026 * depth, .887 - .281 * depth, (reverse ? -.10 : .283) * step],
    .043 + (form==="lean"?.293:.129) * depth, twist);
  for (const [side, sign] of sides) {
    const moves = side === chosen;
    const target = [sign * (narrowStance ? .071 : .142), floor + (moves ? swing : reverse ? 0 : .112 * depth),
      .042 + (moves ? (reverse ? -.645 : .615) * step : reverse ? .031 * step : -.075 * depth)];
    if (moves || depth > 0 && (side === chosen) === reverse) delete pose.planted[side];
    foot(pose, side, sign, target, [sign * .11, -.014, .94], [sign * .023, -(target[1] - .003), .138]);
    if (mode==="single" && side==="r") {
      if (opposite) arm(pose,side,add(pose.rh,[-.061,.053,.037]),[-.82,-.20,-.37]);
      else inactive(pose,side,sign);
    } else if (extension) {
      const overhead = ramp(fraction, .20, .44) * (1 - ramp(fraction, .77, 1));
      const flexion = ramp(fraction, .44, .57) * (1 - ramp(fraction, .62, .78));
      const highest = [sign * -.017, .593 - .234 * flexion, .038 - .327 * flexion];
      const wrist = add(pose[side + "s"], blend([sign * .076, -.558, .060], highest, overhead));
      arm(pose, side, wrist, [sign * .53, .59, -.208], blend([0,0,1], [0,1,0], flexion));
    } else if (form === "overhead" || form === "rack") {
      const rack=form==="rack";
      arm(pose, side, add(pose[side + "s"], rack?[sign*.083,.070,.173]:[sign * .034, .594, .061]),
        rack?[sign*.48,-.66,.38]:[sign * .62, -.22, -.43], [0, 0, 1]);
    } else if (form === "curl" || form === "bowling") {
      const elbow = add(pose[side + "s"], [sign * .051, -.239, .054]);
      const amount = ramp(fraction, .16, .4) * (1 - ramp(fraction, .57, .99));
      const angle = .11 + 2.39 * amount;
      pose[side + "e"] = elbow;
      pose[side + "w"] = add(elbow, [twist * .16, -loadedForearm * Math.cos(angle), loadedForearm * Math.sin(angle)]);
      holdBell(pose, side, [1, 0, -twist * .5]);
    } else {
      arm(pose, side, add(pose[side + "s"], [sign * .08, -.600, .019]), [sign * .43, -.27, -.70], [0, 0, 1]);
    }
  }
  return pose;
}

function staticLunge(phase) {
  const amount = cycle(phase, .43, .57);
  const pose = body([.024, .797 - .279 * amount, .025 + .102 * amount], .067 + .117 * amount);
  foot(pose, "l", 1, [.146, floor, .383], [.08, .04, .99]);
  foot(pose, "r", -1, [-.144, .137, -.440], [-.15, .05, .97], [-.016, -.136, .099]);
  hangingBells(pose);
  return pose;
}

function splitSquat(phase, { setting = "floor", form = "plain", mode = "both" } = {}) {
  const amount = cycle(phase);
  const rearElevated = setting === "rearBench";
  const frontElevated = setting === "deadliftStep";
  const long = form === "long" || form === "low";
  const offset = rearElevated ? 1.80 : frontElevated ? -1.048 : 0;
  const x = rearElevated ? .10 : .024;
  const pos = [x, (frontElevated ? .883 : .807) - (form === "low" ? .310 : .279) * amount,
    offset + .026 + .098 * amount];
  const pose = body(pos, .045 + .112 * amount);
  const front = [x + .146, frontElevated ? .230 : floor, offset + (frontElevated ? .473 : long ? .421 : .372)];
  const rear = [x - .142, rearElevated ? .505 : .139, rearElevated ? 1.401 : offset + (long ? -.476 : -.415)];
  foot(pose, "l", 1, front, [.14, .05, .97]);
  foot(pose, "r", -1, rear, [-.14, -.06, .97],
    rearElevated ? [-.022, -.064, -.125] : [-.016, -.136, .100]);
  if (frontElevated) pose.planted.l = .155;
  if (rearElevated) pose.planted.r = .461;
  if (form === "goblet" || form === "long") holdGoblet(pose);
  else hangingBells(pose, { mode });
  return pose;
}

function gobletHinge(phase) {
  const amount = cycle(phase);
  const pose = body([0, .878 - .077 * amount, .020 - .242 * amount], .028 + 1.057 * amount);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .141, floor, .067], [sign * .10, .030, .98]);
  }
  holdGoblet(pose);
  return pose;
}

function sideBend(phase) {
  const pose = fromSupport("floor");
  const angle = -.323 * cycle(phase);
  for (const part of ["chest", "neck", "head", "ls", "rs"]) {
    const [x, y, z] = subtract(pose[part], pose.hips);
    pose[part] = add(pose.hips, [x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle), z]);
  }
  arm(pose, "l", add(pose.ls, [.075, -.602, .048]), [.36, -.28, -.58], [0, 0, 1]);
  arm(pose, "r", add(pose.head, [-.091, .025, -.045]), [-.95, .04, -.06]);
  return pose;
}

function stepUp(phase, { form = "both-feet" } = {}) {
  const drive = form === "knee-drive";
  const keepLead = drive || form === "fixed-step";
  const lead = keepLead ? 1 : ramp(phase, 0, .19) * (1 - ramp(phase, .79, 1));
  const climb = ramp(phase, keepLead ? 0 : .19, .43) * (1 - ramp(phase, .59, keepLead ? 1 : .79));
  const trail = keepLead ? 0 : ramp(phase, .26, .48) * (1 - ramp(phase, .55, .77));
  const pose = body([0, .883 + .121 * climb - .10 * lead * (1 - climb), .038 + .42 * climb],
    .049 + .264 * lead * (1 - climb));
  for (const [side, sign] of sides) {
    const progress = side === "l" ? lead : trail;
    const swing = Math.sin(progress * Math.PI);
    const point = [sign * (drive ? .120 : .140), floor + progress * .125 + swing * .16,
      .035 + .45 * progress];
    if (keepLead && side === "r") {
      point[1] = floor + climb * (drive ? .763 : .202);
      point[2] = .025 + climb * (drive ? .682 : .269);
    }
    if (progress === 1) pose.planted[side] = .125;
    else if (progress > 0 || (keepLead && side === "r" && climb > 0)) delete pose.planted[side];
    foot(pose, side, sign, point, [sign * .11, .024, .95]);
  }
  hangingBells(pose);
  return pose;
}

function overheadCarry(phase,{secondaryLoad=false}={}) {
  const pose = body([0, .877 + .022 * (1 - Math.cos(phase * Math.PI * 4)), .02], .032);
  const gait = (phase + .22) % 1;
  for (const [side, sign] of sides) {
    const step = (gait + (side === "l" ? 0 : .5)) % 1;
    const stance = step < .58;
    const travel = stance ? (1 - step / .58 * 2) : (step - .58) / .42 * 2 - 1;
    const lift = stance ? 0 : Math.sin((step - .58) / .42 * Math.PI) * .153;
    foot(pose, side, sign, [sign * .128, floor + lift, travel * .253], [sign * .15, .015, .97], [sign * .019, -.071, .144]);
    if (!stance) delete pose.planted[side];
  }
  arm(pose, "l", add(pose.ls, [.020, .598, .087]), [.62, -.20, -.54], [0, 0, 1]);
  arm(pose, "r", add(pose.rs, [-.070, -.555, -.154 * Math.cos(2 * Math.PI * gait)]), [-.66, -.23, -.05],
    secondaryLoad ? [0,0,1] : undefined);
  return pose;
}

function snatch(phase, { fromFloor = false, shallowHang = false } = {}) {
  const lift = ramp(phase, .17, .52) * (1 - ramp(phase, .65, 1));
  const absorb = ramp(phase, .39, .49) * (1 - ramp(phase, .52, .66));
  const pose = body(fromFloor ? [0, .436 + .457 * lift - .052 * absorb, -.166 + .181 * lift]
    : [0, (shallowHang ? .786 + .107 * lift : .713 + .18 * lift) - .052 * absorb, -.101 + .116 * lift],
    shallowHang ? .642-.596*lift : 1.01 - .96 * lift);
  for (const [side, sign] of sides) foot(pose, side, sign, [sign * .177, floor, .066], [sign * .18, 0, .98]);
  const reach = [.075, -.604 + 1.202 * lift, .027 + .144 * Math.sin(lift * Math.PI)];
  const loadedHand = fromFloor ? blend([.185, .085, .218], add(pose.ls, reach), smooth(lift * 3.4)) : add(pose.ls, reach);
  arm(pose, "l", loadedHand, [.73, .30, -.09], blend([-1, 0, 0], [0, 0, 1], lift));
  arm(pose, "r", add(pose.rs, [-.146, -.402, -.235 * lift]), [-.79, -.16, .42]);
  return pose;
}

function hipThrust(phase, { setting = "flat", form = "plain" } = {}) {
  const ground = setting === "supineMat";
  const amount = form === "short" ? 1 - .32 * cycle(phase) : cycle(phase);
  const pose = ground ? body([0, .142 + .280 * amount, .035 - .078 * amount], -Math.PI / 2 - .554 * amount)
    : body([.1, .195 + .330 * amount, 1.591 - .072 * amount], -.919 - .583 * amount);
  for (const [side, sign] of sides) {
    const lifted = form === "single" && side === "r";
    const ankle = lifted ? [pose.hips[0] + sign * .159, .464 + .222 * amount, ground ? .477 : 1.879]
      : ground ? [sign * .177, floor, .518] : [.1 + sign * .188, floor, 1.952];
    if (lifted) delete pose.planted[side];
    foot(pose, side, sign, ankle, [sign * .18, .86, .78]);
    arm(pose, side, add(pose.hips, [sign * .100, .110, .055]), [sign * .81, .18, .24]);
    pose[side + "Grip"] = [sign, 0, 0];
  }
  pose.dumbbells.push({ center: add(pose.hips, [0, .157, .057]), axis: [1, 0, 0] });
  return pose;
}

function calfRaise(phase, { setting = "floor", mode = "both", form = "plain" } = {}) {
  const amount = cycle(phase, .37, .58);
  const height = amount * .083;
  const seat = setting === "seatStep" || setting === "seatCalfFloor";
  const step = setting === "seatStep" || setting === "stepBrace";
  const wall = setting.startsWith("wallBall");
  const withTennisBall = setting === "wallBallKnees" || setting === "wallBallAnkles";
  const onOne = mode === "single";
  const center = seat ? [.1, .557, 1.277] : [0, (step ? .971 : .879) + height * .78, wall ? -.011 : -.066];
  const pose = body(center, seat ? .077 : (wall ? -.066 : .046));
  const contact = seat ? 1.543 : setting === "stepBrace" ? .047 : .092;
  const base = setting === "seatStep" ? .108 : setting === "stepBrace" ? .155 : 0;
  const workingLeg = form === "contralateral" ? "r" : "l";
  for (const [side, sign] of sides) {
    const activeLeg = !onOne || side === workingLeg;
    const ankleGap = setting === "wallBallAnkles" ? .065 : .145;
    const x = center[0] + sign * ankleGap;
    const ankleY = activeLeg ? base + floor + height - (step ? .055 : 0) : seat ? floor + .066 : .358;
    const ankleZ = activeLeg ? contact + height * .38 : seat ? 1.859 : -.264;
    if (!activeLeg) delete pose.planted[side];
    else pose.planted[side] = base;
    foot(pose, side, sign, [x, ankleY, ankleZ], [sign * (withTennisBall ? -.29 : .10), seat ? .49 : .01, .973],
      [sign * .018, activeLeg ? base + .002 - ankleY : -.066, .146 - (activeLeg ? height * .38 : 0)]);
    if (activeLeg) pose[side + "t"][1] = base + .003;
    if (seat) {
      if (!activeLeg) {
        inactive(pose, side, sign, "thigh");
        continue;
      }
      const anchor = add(pose[side + "k"], [0, .143, -.109]);
      const axis = form === "hammer" ? [0, 0, 1] : [form === "palm-up" ? -sign : sign, 0, 0];
      arm(pose, side, anchor, [sign * .65, .31, -.55], axis);
    }
  }
  if (!seat) {
    hangingBells(pose, { mode });
    if (setting === "stepBrace") arm(pose, "r", [-.51, 1.107, .260], [-.72, -.39, -.16]);
  }
  if (wall) pose.ballCenter = [0, .967 + height * .79, -.339];
  if (withTennisBall) {
    const jointName = setting === "wallBallKnees" ? "k" : "a";
    pose.tennisBall = blend(pose["l" + jointName], pose["r" + jointName], .5);
    if (setting === "wallBallKnees") {
      pose.lk[0] = .081;
      pose.rk[0] = -.081;
    }
  }
  return pose;
}

function weightedPushup(phase, { form = "deep" } = {}) {
  const amount = cycle(phase);
  const narrow = form === "narrow";
  const pose = body([0, .463 - .262 * amount, -.480 + .068 * amount], 1.16 + .345 * amount);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .125, .139, -1.251], [sign * .15, .94, .06], [sign * .010, -.114, -.044]);
    delete pose.planted[side];
    const grip = [sign * (narrow ? .081 : .243), .111, .122];
    arm(pose, side, grip, [sign * (narrow ? .37 : .87), -.02, -.74], [0, 0, 1]);
    pose.dumbbells.at(-1).center = [grip[0], .093, grip[2]];
  }
  return pose;
}

function curlAndPress(phase) {
  const position = Math.min(3, Math.floor(phase * 4));
  const fraction = phase * 4 - position;
  const pose = fromSupport("floor");
  const workingSide = position % 2 === 0 ? "l" : "r";
  const pulse = cycle(fraction);
  for (const [side, sign] of sides) {
    const amount = side === workingSide ? pulse : 0;
    const starts = [sign * .06, -.602, .044];
    const curlPosition = [sign * .026, .048, .239];
    if (position < 2) {
      const angle = .1 + 2.38 * amount;
      const elbow = add(pose[side + "s"], [sign * .061, -.243, .018]);
      pose[side + "e"] = elbow;
      pose[side + "w"] = add(elbow, [0, -loadedForearm * Math.cos(angle), loadedForearm * Math.sin(angle)]);
      holdBell(pose, side, [0, Math.sin(angle), Math.cos(angle)]);
    } else {
      const pressAmount = smooth((amount - .43) / .57);
      const destination = blend(blend(starts, curlPosition, smooth(amount / .42)),
        [sign * .043, .605, .079], pressAmount);
      arm(pose, side, add(pose[side + "s"], destination), [sign * .76, -.19, .36], [0, 0, 1]);
    }
  }
  return pose;
}

function curlOverhead(phase,{setting="floor"}={}) {
  const pose=fromSupport(setting);
  const curlAmount=ramp(phase,0,.26)*(1-ramp(phase,.81,1));
  const pressAmount=ramp(phase,.31,.57)*(1-ramp(phase,.65,.83));
  const turn=ramp(phase,.22,.43)*(1-ramp(phase,.74,.87));
  for(const [side,sign] of sides){
    const angle=.105+2.40*curlAmount;
    const elbow=[sign*.058,-.239,.036];
    const wrist=add(elbow,[sign*.021,-loadedForearm*Math.cos(angle),loadedForearm*Math.sin(angle)]);
    const destination=blend(wrist,[sign*.040,.603,.077],pressAmount);
    arm(pose,side,add(pose[side+"s"],destination),[sign*.67,-.78,-.23],[-Math.cos(Math.PI*turn),0,sign*Math.sin(Math.PI*turn)]);
  }
  return pose;
}

function reverseSideHinge(phase) {
  const pose=deadlift(phase,{form:"straight",mode:"single",longRearLeg:true});
  pose.dumbbells=[];
  delete pose.lGrip;
  inactive(pose,"l",1,"thigh");
  arm(pose,"r",add(pose.rs,[-.073,-.599,.071-.123*cycle(phase)]),[-.46,-.36,-.70],[1,0,0]);
  return pose;
}

function thruster(phase,{mode="both"}={}) {
  const lead=phase<.5?"l":"r";
  const fraction=mode==="alternate"?(phase*2)%1:phase;
  const depth=ramp(fraction,0,.29)*(1-ramp(fraction,.33,.60));
  const push=ramp(fraction,.39,.66)*(1-ramp(fraction,.74,1));
  const pose=body([0,.891-.360*depth,.028-.215*depth],.034+.248*depth);
  for (const [side,sign] of sides) {
    foot(pose,side,sign,[sign*.181,floor,.119],[sign*.32,.021,.972]);
    if (mode==="single"&&side==="r") {
      inactive(pose,side,sign,"thigh");
      continue;
    }
    const lift=mode==="alternate"&&side!==lead?0:push;
    const distance=blend([sign*.106,.056,.187],[sign*.036,.603,.070],lift);
    const grip=blend([0,0,1],[.884,0,.467],lift);
    arm(pose,side,add(pose[side+"s"],distance),[sign*.70,-.574,.197],grip);
  }
  return pose;
}

function lateralLunge(phase,{form="sides",mode="both",fixedFeet=false,toesUp=false}={}) {
  const fraction=(phase*2)%1;
  const direction=phase<.5?1:-1;
  const step=ramp(fraction,0,.27)*(1-ramp(fraction,.70,1));
  const low=ramp(fraction,.20,.46)*(1-ramp(fraction,.58,.81));
  const pose=body([direction*(fixedFeet?(toesUp?.426:.378)*low:.275*step+.354*low),.884-(toesUp?.442:.356)*low,
    .014-.143*low],.027+.290*low);
  for (const [side,sign] of sides) {
    const moving=sign===direction;
    const lift=moving&&!fixedFeet?.095*Math.sin(Math.PI*step):0;
    const ankleX=fixedFeet?.427:.151+(moving?.558*step:0);
    const toeLift=toesUp&&!moving?.143*low:0;
    foot(pose,side,sign,[sign*ankleX,floor+lift,.068],
      [sign*.35,.08,.96],[sign*.043,-.071+toeLift,.142-.062*toeLift]);
    if (lift>.01) delete pose.planted[side];
    if (toeLift>.015) delete pose.planted[side];
    if (form!=="curl") continue;
    const angle=.080+2.22*low;
    const position=[sign*.078,-.249-.367*Math.cos(angle),.015+.366*Math.sin(angle)];
    arm(pose,side,add(pose[side+"s"],position),[sign*.63,-.18,-.75],blend([0,0,1],[-1,0,0],low));
  }
  if (form==="goblet") holdGoblet(pose);
  else if (form==="overhead") {
    arm(pose,"l",add(pose.ls,[.027,.602,.064]),[.72,-.24,-.33],[0,0,1]);
    inactive(pose,"r",-1,"thigh");
  }
  else if (form!=="curl") hangingBells(pose,{mode});
  return pose;
}

function dumbbellBridgePair(phase) {
  const pose=hipThrust(phase,{setting:"supineMat"});
  pose.dumbbells=[];
  for (const [side,sign] of sides) {
    arm(pose,side,add(pose.hips,[sign*.117,.131,.073]),[sign*.72,-.37,.61],[0,0,1]);
  }
  return pose;
}

function svendPress(phase,{setting="floor",form="both"}={}) {
  const pose=fromSupport(setting);
  const amount=cycle(phase);
  if (form==="alternate") {
    for (const [side,sign] of sides) {
      const retreat=(phase<.5)===(sign>0)?cycle((phase*2)%1):0;
      arm(pose,side,add(pose.chest,[sign*.081,.085,.579-.344*retreat]),[sign*.72,-.60,.12],[0,1,0]);
    }
    return pose;
  }
  const at=add(pose.chest,[0,.089+.067*amount,.229+.352*amount]);
  for(const [side,sign] of sides){
    arm(pose,side,add(at,[sign*.047,-.009,-.018]),[sign*.83,-.50,.21]);
    pose[side+"PalmSide"]=[1,0,0];
    pose[side+"Fingers"]=[0,.19,.98];
  }
  pose.dumbbells.push({center:add(blend(pose.lw,pose.rw,.5),[0,.009,.018]),axis:[0,1,0]});
  return pose;
}

function sumoPull(phase,{swing=false,startGround=false}={}) {
  const amount=cycle(phase);
  const pose=body([0,.884-(startGround?.469:.303)*amount,.008-.232*amount],.034+(swing?.992:.670)*amount);
  for(const [side,sign] of sides) foot(pose,side,sign,[sign*.325,floor,.087],
    [sign*.42,.028,.917],[sign*.084,-.071,.123]);
  const hand=[0,.731-(startGround?.589:.344)*amount,.234-(swing?.446:.077)*amount];
  for(const [side,sign] of sides){
    arm(pose,side,add(hand,[sign*.054,.010,.021]),[sign*.61,-.44,-.248]);
    pose[side+"Grip"]=[0,1,0];
    pose[side+"Fingers"]=[-sign*.18,-1,.04];
  }
  pose.dumbbells.push({center:add(blend(pose.lw,pose.rw,.5),[0,-.078,-.015]),axis:swing?[0,1,-.48*amount]:[0,1,0]});
  return pose;
}

function staggeredDBHinge(phase) {
  const amount=cycle(phase);
  const pose=body([.036,.888-.081*amount,.027-.222*amount],.020+1.140*amount);
  foot(pose,"l",1,[.158,floor,.163],[.21,.05,.95]);
  foot(pose,"r",-1,[-.145,.130,-.255],[-.16,.08,.97],[-.023,-.127,.108]);
  for(const [side,sign] of sides){
    const wrist=[sign*.071,-.605,.083-.107*amount];
    arm(pose,side,add(pose[side+"s"],wrist),[sign*.63,-.24,-.71],[1,0,0]);
  }
  return pose;
}

function squatHoldCalf(phase) {
  const heel=.082*cycle(phase,.39,.61);
  const pose=body([0,.602+heel*.80,-.177],.229);
  for(const [side,sign] of sides) foot(pose,side,sign,[sign*.180,floor+heel,.127+.24*heel],
    [sign*.30,.04,.97],[sign*.042,-.071-heel,.137-.24*heel]);
  hangingBells(pose);
  return pose;
}

function staggerKickback(phase) {
  const pose=kickback(phase,{mode:"single"});
  foot(pose,"r",-1,[-.174,floor,.191],[-.17,.105,.95]);
  foot(pose,"l",1,[.179,.144,-.475],[.16,.05,.97],[.021,-.142,.094]);
  arm(pose,"r",add(pose.rk,[-.018,.081,.045]),[-.62,-.29,.46]);
  return pose;
}

function waiterCurl(phase) {
  const pose=fromSupport("floor");
  const amount=cycle(phase);
  const angle=.115+2.214*amount;
  for(const [side,sign] of sides){
    pose[side+"e"]=add(pose[side+"s"],[sign*.018,-.250,.018]);
    const forearm=unit([-sign*.141,-.354*Math.cos(angle),.355*Math.sin(angle)]);
    pose[side+"w"]=add(pose[side+"e"],scale(forearm,loadedForearm));
    pose[side+"PalmSide"]=[1,0,0];
    pose[side+"Fingers"]=[-sign*.22,.162,.962];
  }
  pose.dumbbells.push({center:add(blend(pose.lw,pose.rw,.5),[0,-.108,.021]),axis:[0,1,0]});
  return pose;
}

function raiseCircuit(phase,{setting="floor",form="four"}={}) {
  if(form==="four"){
    const index=Math.min(3,Math.floor(phase*4));
    const planes=["lateral","front","rear","lateral"];
    const fraction=phase*4-index;
    if(index===2){
      const hinge=ramp(fraction,0,.15)*(1-ramp(fraction,.80,1));
      const upright=raise(0,{plane:"rear"});
      const rear=raise(clamp((fraction-.14)/.67,0,1),{setting:"hinge",plane:"rear"});
      const pose=fromSupport("floor",{point:blend(upright.hips,rear.hips,hinge),pitch:.02+1.081*hinge});
      for(const [side,sign] of sides){
        const wrist=blend(upright[side+"w"],rear[side+"w"],hinge);
        arm(pose,side,wrist,[sign*.70,-.59,.20],[0,0,1]);
      }
      return pose;
    }
    return raise(fraction,{plane:planes[index]});
  }
  const pose=fromSupport(setting);
  const phaseIndex=Math.min(5,Math.floor(phase*6));
  const blendValue=ramp(phase*6-phaseIndex,0,1);
  for(const [side,sign] of sides){
    const low=[sign*.078,-.604,.035];
    const lateral=[sign*.598,.058,.035];
    const front=[sign*.031,.085,.603];
    const top=[sign*.036,.593,.081];
    const positions=[low,lateral,front,top,front,lateral,low];
    const point=blend(positions[phaseIndex],positions[phaseIndex+1],blendValue);
    arm(pose,side,add(pose[side+"s"],scale(unit(point),.600)),[sign*.66,-.77,.17],[0,0,1]);
  }
  return pose;
}

function curtsyLunge(phase,{goblet=false}={}) {
  const lead=phase<.5?1:-1;
  const fraction=(phase*2)%1;
  const step=ramp(fraction,0,.26)*(1-ramp(fraction,.68,1));
  const depth=ramp(fraction,.16,.43)*(1-ramp(fraction,.56,.87));
  const pose=body([lead*.067*depth,.885-.341*depth,.025-.103*step],.030+.221*depth);
  for(const [side,sign] of sides){
    const rear=sign!==lead;
    const heel=rear?.132*step:0;
    const ankle=[rear?sign*.155+lead*.453*step:sign*.155,floor+heel,.071-(rear?.557*step:0)];
    foot(pose,side,sign,ankle,[sign*.12,-.024,.978],[sign*.018,-.071-heel,.139-.018*step]);
    if(rear&&step>.002) delete pose.planted[side];
  }
  if(goblet) holdGoblet(pose);
  else hangingBells(pose);
  return pose;
}

function pistolGoblet(phase) {
  const amount=cycle(phase);
  const pose=body([.106,.885-.447*amount,.043-.272*amount],.027+.613*amount);
  foot(pose,"l",1,[.135,floor,.143],[.24,.034,.97]);
  const angle=.354+1.416*amount;
  const ankle=add(pose.rh,[-.062,-.834*Math.cos(angle),.834*Math.sin(angle)]);
  foot(pose,"r",-1,ankle,[-.19,.64,.721],[-.019,.025+.106*amount,.138-.021*amount]);
  delete pose.planted.r;
  holdGoblet(pose);
  return pose;
}

function dbOverheadSquat(phase,{mode="both"}={}) {
  const pose=squat(phase);
  pose.dumbbells=[];
  for (const [side,sign] of sides){
    if(mode==="single"&&side==="r"){
      delete pose.rGrip;
      arm(pose,side,add(pose.rs,[-.207,-.215,.317]),[-.77,-.25,-.52]);
    } else arm(pose,side,add(pose[side+"s"],[sign*.055,.600,.025]),[sign*.63,-.25,-.41],[0,0,1]);
  }
  return pose;
}

function hingeThenSquat(phase,{goblet=false}={}) {
  const fraction=(phase*2)%1;
  if(phase<.5) return goblet?gobletHinge(fraction):deadlift(fraction,{form:"straight"});
  return goblet?gobletSquat(fraction):squat(fraction);
}

function crossRaise(phase,{mode="both",twist=false}={}) {
  const lead=phase<.5?"l":"r";
  const fraction=mode==="single"?phase:(phase*2)%1;
  const amount=cycle(fraction);
  const turn=twist?(lead==="l"?1:-1)*.660*cycle(fraction,.55,.68)*ramp(fraction,.32,.51):0;
  const stable=fromSupport("floor");
  const pose=twist?body(stable.hips,.027,turn):stable;
  if(twist) for(const [side] of sides) for(const joint of ["h","k","a","t"]) pose[side+joint]=stable[side+joint];
  for(const [side,sign] of sides){
    if(mode==="single"&&side==="r"){
      inactive(pose,side,sign,"thigh");
      continue;
    }
    const raise=twist||side===lead?amount:0;
    const angle=(mode==="single"?1.936:1.57)*raise;
    const across=twist?sign*.045:sign*((mode==="single"?-.322:.064)-.334*raise);
    const wrist=add(pose[side+"s"],add([across,-.565*Math.cos(angle),0],scale(pose.front,.062+.523*Math.sin(angle))));
    arm(pose,side,wrist,[sign*.62,-.74,.18],blend([0,0,1],[1,0,0],raise));
  }
  return pose;
}

function dumbbellAroundWorld(phase,{setting="floor"}={}) {
  const pose=fromSupport(setting);
  const stand=setting==="floor";
  const climb=stand?cycle(phase,.40,.54):cycle(phase,.44,.55);
  const high=climb*Math.PI;
  const sideSweep=stand?(1-ramp(phase,.50,.79)):1;
  for (const [key,sign] of sides){
    const upDown=scale(pose.up,-.585*Math.cos(high));
    const sideways=scale(pose.right,sign*(.071+.521*Math.sin(high)*sideSweep));
    const inFront=scale(pose.front,.098+.494*Math.sin(high)*(1-sideSweep));
    const wrist=add(pose[key+"s"],add(upDown,add(sideways,inFront)));
    arm(pose,key,wrist,[sign*.46,-.72,.51],pose.front);
  }
  return pose;
}

function timedPoint(phase, positions) {
  const index=positions.findIndex(([end],index)=>index>0&&phase<=end);
  const [start,a]=positions[index-1];
  const [end,b]=positions[index];
  return blend(a,b,ramp(phase,start,end));
}

function cleanSequence(phase,{start="floor",finish="rack",mode="both"}={}) {
  const standing=start==="rack";
  const hang=start==="hang";
  const hover=start==="hover";
  const floorStart=!standing&&!hang;
  const low=floorStart?(hover?.362:.442):hang?.056:0;
  const pitch=floorStart?.92:hang?.235:0;
  const press=finish!=="rack";
  const jerk=finish==="jerk";
  const posture=standing?[
    [0,[0,0]],[.23,[.112,.044]],[.43,[0,0]],[.54,[.070,.040]],[.68,[0,0]],[1,[0,0]],
  ]:[
    [0,[low,pitch]],[.19,[floorStart?low*.83:.123,floorStart?pitch*.85:.723]],
    [.31,[.012,.111]],[.40,[.121,.143]],[.51,[0,.039]],
    [.57,[press?.092:0,press?.061:0]],[.66,[0,0]],[.70,[jerk?.078:0,jerk?.084:0]],
    [.79,[0,0]],[.90,[0,.044]],[1,[low,pitch]],
  ];
  const [depth,hinge]=timedPoint(phase,posture);
  const pose=body([0,.885-depth,.024-depth*.40],.031+hinge);
  for(const [side,sign] of sides){
    foot(pose,side,sign,[sign*.164,floor,.094],[sign*.27,.024,.957]);
    if(mode==='single'&&side==='r'){
      inactive(pose,side,sign,'thigh');
      continue;
    }
    const resting=floorStart?[sign*.217,hover?.213:.078,.204]:add(pose[side+'s'],[sign*.064,-.566,.141]);
    const hangPath=add(pose[side+'s'],[sign*.077,-.556,.086]);
    const pull=add(pose[side+'s'],[sign*.136,-.215,.110]);
    const rack=add(pose[side+'s'],[sign*.103,.080,.194]);
    const top=add(pose[side+'s'],[sign*.045,.603,.056]);
    const positions=standing?[[0,rack],[.25,rack],[.43,top],[.66,top],[1,rack]]:
      [[0,resting],[.20,hangPath],[.31,pull],[.43,rack],[.57,rack],
        [.68,press?top:rack],[.77,press?top:rack],[.85,rack],[1,resting]];
    const rotation=standing ? cycle(phase,.42,.66) : cycle(phase,.31,.84);
    const grip=blend([0,0,1],[.896,0,.445],rotation);
    arm(pose,side,timedPoint(phase,positions),[sign*.74,-.52,-.19],grip);
  }
  return pose;
}

function rdlJumpShrug(phase) {
  const hinge=ramp(phase,0,.31)*(1-ramp(phase,.35,.54));
  const climb=ramp(phase,.48,.60)*(1-ramp(phase,.60,.76));
  const land=ramp(phase,.72,.83)*(1-ramp(phase,.86,1));
  const pose=body([0,.884-.082*hinge+.174*climb-.151*land,.032-.231*hinge],.023+1.024*hinge+.273*land);
  for (const [side,sign] of sides){
    foot(pose,side,sign,[sign*.161,floor+.189*climb,.112],[sign*.24,.033,.97]);
    if(climb>.004)delete pose.planted[side];
    pose[side+'s']=add(pose[side+'s'],[sign*-.016*climb,.059*climb,0]);
    arm(pose,side,add(pose[side+'s'],[sign*.075,-.604,.067-.081*hinge]),[sign*.655,-.247,-.712],[1,0,0]);
  }
  return pose;
}

function dumbbellSwing(phase,{full=false}={}) {
  const push=cycle(phase,.40,.57);
  const pose=body([0,.778+.108*push,-.241+.253*push],1.035-1.005*push);
  const angle=-.971+(full?3.877:2.544)*push;
  const point=add(blend(pose.ls,pose.rs,.5),[0,-.554*Math.cos(angle),.548*Math.sin(angle)]);
  for(const [side,sign] of sides){
    foot(pose,side,sign,[sign*.225,floor,.103],[sign*.34,.04,.92]);
    arm(pose,side,add(point,[sign*.047,0,0]),[sign*.62,-.463,-.46]);
    pose[side+'Grip']=[0,1,0];
    pose[side+'Fingers']=[sign*-.15,.20,.967];
  }
  pose.dumbbells.push({center:add(blend(pose.lw,pose.rw,.5),[0,0,.027]),axis:blend([0,.81,-.586],full?[0,1,0]:[0,.31,.951],push)});
  return pose;
}

function crossRdl(phase) {
  const a=phase<.5?1:-1;
  const low=cycle((phase*2)%1);
  const pose=body([0,.879-.074*low,.018-.214*low],.032+1.072*low,a*.261*low,a*.137*low);
  for(const [side,sign] of sides){
    foot(pose,side,sign,[sign*.160,floor,.099],[sign*.14,.053,.957]);
    const wrist=sign===a?[sign*(.071-.350*low),-.599+.041*low,.128-.166*low]:[sign*.086,-.599,.120-.122*low];
    arm(pose,side,add(pose[side+'s'],wrist),[sign*.55,-.38,-.56],blend([1,0,0],[0,0,1],low*.56));
  }
  return pose;
}

const jobs = [];

function addGroup(ids, motion, options, muscles, settings = {}) {
  const supportName = options.setting ?? (motion === chestPress ? "flat" : "floor");
  for (const id of ids.split(" ")) {
    jobs.push({ id, motion, options, supportName, muscles, ...settings });
  }
}

function curls(ids, options, settings) {
  addGroup(ids, curl, options, options.grip === "reverse" || options.grip === "hammer"
    ? ["biceps", "forearm"] : ["biceps"], settings);
}

curls("0416", {});
curls("1654 0382", { grip: "reverse" });
curls("0312 2485", { grip: "hammer" });
curls("0425", { grip: "reverse", mode: "single" });
curls("1670", { mode: "single" });
curls("1657", { grip: "hammer", mode: "alternate", form: "cross" });
curls("1664", { form: "high" });
curls("1653", { form: "stork", mode: "alternate" });
curls("1655", { form: "squat" });
curls("2321", { grip: "supinate", form: "wide" });
curls("1677 0391", { setting: "seat" });
curls("1678", { setting: "seat", grip: "hammer" });
curls("1648", { setting: "seat", grip: "hammer", mode: "alternate" });
curls("1669", { setting: "seat", grip: "hammer", mode: "single" });
curls("0393", { setting: "seat", grip: "supinate", form: "wide" });
curls("0403", { setting: "seat", grip: "reverse", form: "concentration", mode: "single" });
curls("2401", { setting: "armBlaster" });
curls("2402", { setting: "armBlaster", grip: "hammer" });
curls("0315 0317 0318", { setting: "incline", grip: "supinate" });
curls("0320", { setting: "incline", grip: "hammer" });
curls("0322", { setting: "incline", grip: "supinate", form: "wide" });
curls("1646", { setting: "preacher", grip: "hammer", mode: "alternate" });
curls("1647", { setting: "preacher", mode: "alternate" });
curls("1663", { setting: "preacher", grip: "hammer", mode: "single" });
curls("1414", { setting: "preacher", grip: "reverse", mode: "single" });
curls("0372", { setting: "preacher" });
curls("0370", { setting: "preacher", grip: "hammer" });
curls("0384", { setting: "preacher", grip: "reverse" });
curls("0428", { setting: "preacherStanding" });
curls("0374", { setting: "prone", grip: "reverse" });
curls("1674", { setting: "prone", grip: "hammer" });
curls("1665", { setting: "proneFlat", mode: "single", grip: "reverse" });
curls("1666", { setting: "proneFlat", grip: "hammer", mode: "single" });
curls("1661 0350", { setting: "flat" });
curls("1662", { setting: "flat", form: "wide" });
curls("1650", { setting: "ball", grip: "supinate", mode: "alternate" });
curls("0390", { setting: "ball" });
curls("1659", { setting: "ball", grip: "hammer" });
curls("1652", { setting: "ball", form: "leg-raised" });
curls("1668", { setting: "ball", mode: "single" });
curls("1679", { setting: "ball", mode: "single", form: "leg-raised" });
curls("1660 1673", { setting: "kneelingBall" });

const raises = (ids, options, settings) =>
  addGroup(ids, raise, options, ["shoulder"], settings);
raises("0310 0309", {});
raises("0419", { plane: "above" }, { camera: [55, 12, [0, 1.01, .06], 2.35] });
raises("0335", { plane: "combo" }, { durationMs: 5600 });
raises("0355", { plane: "lateral", mode: "single" });
raises("0376", { plane: "lateral" });
raises("0392", { setting: "seat" });
raises("0396 0395", { setting: "seat", plane: "lateral" });
raises("2317", { setting: "seat", plane: "lateral", form: "bent" });
raises("3542", { setting: "prone", plane: "rear" });
raises("3541", { setting: "prone", plane: "y" });
raises("0378 0380 0383 2292", { setting: "hinge", plane: "rear" });
raises("0345", { setting: "proneFlat", plane: "rear", mode: "single" });
raises("0348", { setting: "proneFlat", plane: "rear" });

addGroup("0290", shoulderPress, { setting: "upright" }, ["shoulder", "triceps"]);
addGroup("0361 0360", shoulderPress, { mode: "single" }, ["l:shoulder", "l:triceps"],
  { camera: [52, 12, [0, 1.05, .05], 2.32] });
addGroup("2381", shoulderPress, { setting: "upright", mode: "single" }, ["l:shoulder", "l:triceps"]);

function presses(ids, options, settings) {
  const left = options.mode === "single";
  const fly = ["fly", "twist-fly", "one-leg"].includes(options.form);
  addGroup(ids, chestPress, options, [
    left ? "l:pec" : "pec",
    left ? (fly ? "l:shoulder" : "l:triceps") : fly ? "shoulder" : "triceps",
  ], settings);
}

presses("0301", { setting: "decline" });
presses("0302", { setting: "decline", form: "fly" });
presses("0303", { setting: "decline", form: "neutral" });
presses("1276", { setting: "decline", form: "fly", mode: "single" });
presses("1617", { setting: "decline", form: "neutral", mode: "single" });
presses("1287", { setting: "decline", mode: "single" });
presses("0307", { setting: "decline", form: "twist-fly" });
presses("0319", { setting: "incline", form: "fly" });
presses("1279", { setting: "incline", form: "fly", mode: "single" });
presses("1619", { setting: "incline", form: "neutral", mode: "single" });
presses("1281 1289", { setting: "incline", mode: "single" });
presses("0321 0324 1623", { setting: "incline", form: "neutral" });
presses("3545", { setting: "incline", mode: "alternate" }, { durationMs: 5400 });
presses("0340 1177 0352", { form: "neutral" });
presses("0342", { mode: "single" });
presses("1285", { form: "fly", mode: "single" });
presses("1624", { form: "reverse" });
presses("1743", { form: "twist-press" });
presses("1277", { setting: "bridge", form: "fly" });
presses("1286 1288", { setting: "bridge", form: "fly", mode: "single" });
presses("1292", { setting: "bridge", form: "one-leg" });
presses("1293", { setting: "bridge" });


curls("0418", { setting: "hinge", mode: "single", form: "concentration", grip: "supinate" });
curls("0422 1680", { setting: "inclineBrace", mode: "single", form: "bench-brace" });
raises("0386", { setting: "hinge", plane: "rear", form: "rotate" });
presses("0331", { setting: "incline", form: "twist-fly" });

addGroup("0292 4837", row, { setting: "hinge", mode: "single" }, ["l:lat", "l:biceps"]);
addGroup("2393", row, { setting: "hinge", mode: "single", form: "brace" }, ["l:lat", "l:biceps"]);
addGroup("1328", row, { setting: "proneFlat", form: "rear" }, ["rearShoulder", "trap"]);
addGroup("1331", row, { setting: "prone", form: "reverse" }, ["lat", "biceps"]);
addGroup("2327", row, { setting: "hinge", form: "reverse" }, ["lat", "biceps"]);
addGroup("1329", row, { setting: "hinge", form: "swivel" }, ["lat", "biceps"]);
addGroup("0363", uprightRow, { mode: "single" }, ["l:shoulder", "l:trap"]);
addGroup("0437", uprightRow, {}, ["shoulder", "trap"]);
addGroup("1765", uprightRow, {}, ["shoulder", "trap"], { camera: [146, 11, [0, .96, .04], 2.06] });

addGroup("0406", shrug, {}, ["trap"]);
addGroup("0305 0304", shrug, { setting: "prone" }, ["trap"]);
addGroup("0329", shrug, { setting: "incline" }, ["trap"]);

addGroup("1730", kickback, { setting: "hingeSeat", mode: "alternate" }, ["triceps"]);
addGroup("1737 0394", kickback, { setting: "hingeSeat" }, ["triceps"]);
addGroup("0398", kickback, { setting: "hingeSeat", mode: "single" }, ["l:triceps"]);
addGroup("1739", kickback, { setting: "hinge", mode: "alternate" }, ["triceps"]);
addGroup("1740", kickback, { setting: "hinge", mode: "single" }, ["l:triceps"]);
addGroup("1741 0420", kickback, { setting: "hinge" }, ["triceps"]);

addGroup("1735", elbowExtension, { setting: "flat", mode: "single" }, ["l:triceps"]);
addGroup("2589", elbowExtension, { setting: "flat" }, ["triceps"]);
addGroup("0306", elbowExtension, { setting: "decline" }, ["triceps"]);
addGroup("0423", elbowExtension, { mode: "single" }, ["l:triceps"], { camera: [67, 15, [0, 1.02, .02], 2.31] });
addGroup("0389 2188", elbowExtension, { setting: "seat", sharedBell: true }, ["triceps"],
  { camera: [68, 15, [.1, .88, 1.18], 1.98] });

addGroup("0288", pullover, { setting: "flat", form: "around" }, ["lat", "pec"]);
addGroup("0375 5330", pullover, { setting: "flat" }, ["lat", "pec"]);
addGroup("0433", pullover, { setting: "flat", form: "straight" }, ["lat", "pec"]);
addGroup("1284 1295", pullover, { setting: "bridge" }, ["lat", "pec"]);
addGroup("1291", pullover, { setting: "bridge", mode: "single" }, ["l:lat", "l:pec"]);

const wristCamera = [39, 23, [.105, .67, 1.47], 1.40];
addGroup("1437", wristCurl, { setting: "seat", mode: "single", form: "fingers" }, ["l:forearm"], { camera: wristCamera });
addGroup("0358", wristCurl, { setting: "seat", mode: "single", form: "reverse" }, ["l:forearm"], { camera: wristCamera });
addGroup("1415", wristCurl, { setting: "seat", mode: "single", form: "neutral" }, ["l:forearm"], { camera: wristCamera });
addGroup("0364", wristCurl, { setting: "seat", mode: "single" }, ["l:forearm"], { camera: wristCamera });
addGroup("1441", wristCurl, { setting: "wristBench", mode: "single", form: "reverse", overBench: true }, ["l:forearm"]);
addGroup("0368", wristCurl, { setting: "wristBench", form: "reverse", overBench: true }, ["forearm"]);
addGroup("0369", wristCurl, { setting: "wristBench", overBench: true }, ["forearm"]);
addGroup("0385", wristCurl, { setting: "seat", form: "reverse" }, ["forearm"], { camera: wristCamera });
addGroup("0401", wristCurl, { setting: "seat" }, ["forearm"], { camera: wristCamera });

addGroup("0863", externalRotation, { setting: "flat", mode: "single" }, ["l:rearShoulder"]);
addGroup("0864", externalRotation, {}, ["rearShoulder"]);
addGroup("0408", sideRaise, { setting: "sideFloor", mode: "single" }, ["l:shoulder"]);
addGroup("3664", sideRaise, { setting: "plank", mode: "single" }, ["l:rearShoulder", "core"]);


raises("0356", { setting: "raiseBrace", plane: "lateral", mode: "single" });
raises("0379", { setting: "headBrace", plane: "rear" });
raises("2470", { setting: "proneGround", plane: "rear" });
presses("1278", { setting: "inclineBall", form: "fly" });

addGroup("0291", squat, { setting: "benchSquat", form: "bench", sharedBell: true }, ["quad", "glute"]);
addGroup("0413", squat, {}, ["quad", "glute"]);
addGroup("0411", squat, { form: "single-leg" }, ["quad", "glute"]);
addGroup("0371", squat, { form: "jump" }, ["quad", "glute", "calf"], { camera: [53, 13, [0,1.02,.02], 2.30] });
addGroup("0300", deadlift, {}, ["hamstring", "glute", "core"]);
addGroup("0432 0434", deadlift, { form: "straight" }, ["hamstring", "glute"]);
addGroup("2805", deadlift, { setting: "deadliftStep", mode: "single" }, ["l:hamstring", "l:glute"]);
addGroup("4742", hipThrust, { setting: "flat", sharedBell: true }, ["glute", "hamstring"],
  { camera: [68, 13, [.1,.54,1.50], 1.57] });

addGroup("0336", lunge, {}, ["quad", "glute"], { durationMs: 5700 });
addGroup("0381", lunge, { form: "reverse" }, ["quad", "glute"], { durationMs: 5700 });
addGroup("1658", lunge, { form: "curl" }, ["quad", "glute", "biceps"], { durationMs: 5700 });
addGroup("1651", lunge, { form: "bowling" }, ["quad", "glute", "biceps", "core"], { durationMs: 5800 });
addGroup("1732", lunge, { form: "extension" }, ["quad", "glute", "triceps"],
  { durationMs: 5000, camera: [63, 12, [0,1.00,.22], 2.22] });

addGroup("0431", stepUp, { setting: "frontStep" }, ["quad", "glute"], { durationMs: 4300 });
addGroup("2812", stepUp, { setting: "frontStep", form: "knee-drive" }, ["quad", "glute"]);
addGroup("3548", overheadCarry, { mode: "single" }, ["l:shoulder", "core"],
  { camera: [47, 12, [0,1.11,.023], 2.38], durationMs: 3100 });
addGroup("3888", snatch, { mode: "single" }, ["l:shoulder", "glute", "hamstring", "core"],
  { camera: [57, 12, [0,1.10,.023], 2.40] });
addGroup("3560", curlAndPress, {}, ["biceps", "shoulder", "triceps"],
  { camera: [58, 13, [0,1.11,.023], 2.38], durationMs: 6500, posterAt: .11 });

addGroup("0417", calfRaise, {}, ["calf"]);
addGroup("0409", calfRaise, { setting: "stepBrace", mode: "single" }, ["l:calf"]);
addGroup("1379", calfRaise, { setting: "seatStep" }, ["calf"]);
addGroup("0400", calfRaise, { setting: "seatStep", mode: "single" }, ["l:calf"]);
addGroup("1380", calfRaise, { setting: "seatStep", mode: "single", form: "hammer" }, ["l:calf"]);
addGroup("1381", calfRaise, { setting: "seatCalfFloor", mode: "single", form: "palm-up" }, ["l:calf"]);
addGroup("1382", calfRaise, { setting: "wallBall" }, ["calf"]);
addGroup("3241", calfRaise, { setting: "wallBallAnkles" }, ["calf"]);
addGroup("3240", calfRaise, { setting: "wallBallKnees" }, ["calf"]);

addGroup("1274", weightedPushup, { setting: "pushupFloor" }, ["pec", "triceps", "core"]);
addGroup("0660", weightedPushup, { setting: "pushupFloor", form: "narrow" }, ["triceps", "pec", "core"]);

// Match the selected catalogue illustration's support surface, grip and working side.
curls("2403", { setting: "armBlaster", mode: "alternate" }, { durationMs: 5600 });
curls("1196", { mode: "alternate" });
curls("6147", { grip: "hammer", mode: "alternate" }, { durationMs: 5750 });
curls("1649", { setting: "ball", form: "leg-raised-straight", mode: "alternate" }, { durationMs: 6200 });
curls("7625", { setting: "hinge" });
curls("5921", { setting: "preacher", grip: "hammer" });
curls("3682", { setting: "incline", mode: "alternate" });
curls("1233", { setting: "incline", grip: "hammer", mode: "alternate" });
curls("3764", { setting: "incline" });
curls("0402", { setting: "preacher" });
curls("3688", { setting: "upright", grip: "reverse" });
curls("6265", { grip: "reverse", mode: "alternate" });
curls("6757", { mode: "single" });

raises("4341", { mode: "alternate" });
addGroup("3685 2500", raise, { setting: "proneStanding", plane: "rear" }, ["rearShoulder", "trap"]);
addGroup("3694", raise, { setting: "proneStanding", plane: "rear", mode: "alternate" }, ["rearShoulder", "trap"]);
raises("9933", { setting: "seat", plane: "lateral", mode: "alternate" });
raises("3689 6143", { setting: "seat", mode: "single" });
raises("2234", { plane: "lateral" });

addGroup("0414", shoulderPress, { mode: "alternate" }, ["shoulder", "triceps"],
  { camera: [52, 12, [0, 1.05, .05], 2.32] });
addGroup("0388", shoulderPress, { setting: "upright", mode: "alternate", form: "neutral" }, ["shoulder", "triceps"]);
addGroup("3546", shoulderPress, { setting: "upright", mode: "alternate" }, ["shoulder", "triceps"]);
addGroup("1231", shoulderPress, { setting: "upright", mode: "single" }, ["l:shoulder", "l:triceps"]);
addGroup("0404", shoulderPress, { setting: "upright", form: "neutral" }, ["shoulder", "triceps"]);
addGroup("0427", shoulderPress, { form: "neutral" }, ["shoulder", "triceps"],
  { camera: [53, 12, [0, 1.06, .05], 2.34] });

presses("3695", { mode: "alternate" });
presses("4834", { setting: "bridge", mode: "alternate" });
presses("5097", { setting: "decline", mode: "alternate" });
presses("5098", { mode: "alternate", form: "fly" });
presses("3333", { mode: "single", form: "wide" });

addGroup("3799", row, { form: "reverse" }, ["lat", "biceps"]);
addGroup("5661 9698 3320", row, { setting: "proneStanding" }, ["lat", "biceps"]);
addGroup("4730", row, { mode: "single" }, ["l:lat", "l:biceps"]);
addGroup("1330", row, { setting: "proneStanding", mode: "single", form: "reverse", braceFree: true }, ["l:lat", "l:biceps"]);
addGroup("2511", row, { setting: "proneStanding", form: "reverse" }, ["lat", "biceps"]);
addGroup("9699", row, { setting: "proneStanding", mode: "single" }, ["l:lat", "l:biceps"]);
addGroup("0397", wristCurl, { setting: "seat", form: "neutral" }, ["forearm"], { camera: wristCamera });
addGroup("1555", squat, {}, ["quad", "glute"]);
addGroup("4293", deadlift, { form: "straight" }, ["hamstring", "glute"]);

curls("3761", { setting: "seat", mode: "alternate" });
curls("3083", { setting: "seat" });
curls("1676", { setting: "ball", grip: "hammer", mode: "alternate" });
curls("1681", { setting: "ball", grip: "hammer" });
curls("6264", { setting: "proneStanding", grip: "hammer", mode: "alternate" });
curls("9931", { setting: "proneStanding" });
curls("0421", { setting: "hinge", mode: "single", form: "standing-concentration" });

raises("3428", {});
raises("3913", { mode: "single" });
raises("5944", { mode: "single", grip: "hammer" });
raises("5092", { mode: "single", grip: "under" });
raises("1230", { mode: "alternate", grip: "hammer" }, { durationMs: 5400 });
raises("0387", { setting: "seat", mode: "alternate", grip: "hammer" }, { durationMs: 5400 });
raises("0415", { plane: "lateral", mode: "alternate" });
raises("2690", { plane: "lateral", mode: "single" });
raises("5631", { plane: "lateral", form: "right-angle" });
raises("4055", { setting: "ball", plane: "lateral" });
raises("7449", { plane: "front-side" }, { durationMs: 5500 });
raises("4238", { setting: "seat", plane: "combo" }, { durationMs: 5500 });
raises("1176 3980 4236", { setting: "proneStanding" });
raises("4071", { setting: "proneStanding", mode: "single" });
raises("0325", { setting: "incline" });
addGroup("4066", raise, { setting: "hingeSeat", plane: "rear", mode: "alternate" }, ["rearShoulder", "trap"]);
addGroup("4832", raise, { setting: "proneFlat", plane: "rear", form: "rear-facing" }, ["rearShoulder", "trap"]);
addGroup("7995", raise, { setting: "hinge", plane: "y", grip: "hammer" }, ["rearShoulder", "trap"],
  { camera: [48, 16, [0, .89, .18], 2.05] });

const standingPressCamera = [52, 12, [0, 1.06, .08], 2.35];
addGroup("3972", shoulderPress, { mode: "alternate" }, ["shoulder", "triceps"], { camera: standingPressCamera });
addGroup("4067 4065", shoulderPress, { mode: "alternate", form: "arnold" }, ["shoulder", "triceps"],
  { camera: standingPressCamera, durationMs: 5600 });
addGroup("2137 0287 4108", shoulderPress, { form: "arnold" }, ["shoulder", "triceps"], { camera: standingPressCamera });
addGroup("3690", shoulderPress, { setting: "ball" }, ["shoulder", "triceps", "core"],
  { camera: [51, 13, [0, .94, .10], 2.08] });

presses("0316", { setting: "incline", form: "fly", startLow: true });
presses("1280", { setting: "inclineOnBall", mode: "single", form: "fly" });
presses("1282", { setting: "inclineOnBall", mode: "single", startLow: true });
presses("1283", { setting: "inclineOnBall", startLow: true });
presses("1618", { setting: "inclineOnBall", form: "neutral", startLow: true });
presses("1620", { setting: "inclineOnBall", mode: "single", form: "neutral", startLow: true });
presses("1621", { setting: "bridge", mode: "single", form: "neutral", startLow: true });
presses("1622", { mode: "single", form: "reverse", startLow: true });
presses("4835", { form: "twist-press", startLow: true });
presses("6218", { setting: "incline", form: "supinated-press", startLow: true });
presses("4731", { setting: "bridgeMat", startLow: true });
presses("2982", { setting: "supineMat", mode: "alternate" });
presses("3319", { setting: "supineMat", form: "neutral", startLow: true });
presses("5093", { setting: "supineMat", mode: "single", startLow: true });
presses("3334", { setting: "supineMat", mode: "single", form: "fly" });
presses("5079", { setting: "supineMat", form: "fly" });

addGroup("2326", row, { form: "overhand" }, ["lat", "biceps"]);
addGroup("2325", row, { form: "overhand-to-neutral" }, ["lat", "biceps"]);
addGroup("4235", row, { setting: "hingeSeat", form: "rear" }, ["rearShoulder", "trap"]);
addGroup("4326", pullover, { setting: "flat", form: "bent", sharedBell: true }, ["lat", "pec"]);

const overheadExtensionCamera = [65, 14, [.1, .91, 1.17], 2.05];
addGroup("6158 6159", elbowExtension, { setting: "seat", mode: "single" }, ["l:triceps"],
  { camera: overheadExtensionCamera });
addGroup("1738", elbowExtension, { setting: "seat", mode: "single", form: "reverse" }, ["l:triceps"],
  { camera: overheadExtensionCamera });
addGroup("2189", elbowExtension, { setting: "upright" }, ["triceps"]);
addGroup("7892", elbowExtension, { setting: "upright", sharedBell: true }, ["triceps"]);
addGroup("0430", elbowExtension, { sharedBell: true }, ["triceps"], { camera: standingPressCamera });
addGroup("1729", elbowExtension, { setting: "flat", mode: "alternate", arcDegrees: 78 }, ["triceps"]);
addGroup("1733", elbowExtension, { setting: "incline", arcDegrees: 78 }, ["triceps"]);
addGroup("1746", elbowExtension, { setting: "bridge", arcDegrees: 78 }, ["triceps", "core"]);

addGroup("3684", externalRotation, { setting: "sideFloor", mode: "single", sideLying: true }, ["l:rearShoulder"]);
addGroup("5817", externalRotation, { setting: "flat", mode: "single" }, ["l:rearShoulder"]);
addGroup("4335", sideBend, { mode: "single" }, ["core"]);
addGroup("1552", squat, { form: "jump" }, ["quad", "glute", "calf"], { camera: standingPressCamera });
addGroup("5634", squat, { form: "narrow" }, ["quad", "glute"]);
addGroup("4290", staticLunge, {}, ["quad", "glute"], { camera: [60, 15, [0, .85, .06], 1.96] });
addGroup("5119", deadlift, {}, ["hamstring", "glute", "core"]);
addGroup("4914", deadlift, { grip: "neutral" }, ["hamstring", "glute", "core"]);
addGroup("3340 3894", deadlift, { form: "straight" }, ["hamstring", "glute"]);
addGroup("3973", calfRaise, { setting: "stepBrace", mode: "single", form: "contralateral" }, ["r:calf"]);
addGroup("1178", calfRaise, { setting: "stepBrace", mode: "single" }, ["l:calf"]);
addGroup("2925 4986", stepUp, { setting: "frontStep", form: "fixed-step" }, ["quad", "glute"]);
addGroup("4565", stepUp, { setting: "frontStep", form: "knee-drive" }, ["quad", "glute"]);

curls("4910", { form: "isometric" }, { durationMs: 4900 });
curls("11864", { form: "mid-hold", mode: "single" }, { durationMs: 6500, posterAt: .42 });
curls("4743", { setting: "incline" });
curls("3084", { setting: "preacher", mode: "single" });
curls("3687 5449", { form: "drag" });
curls("6149", { setting: "seat", form: "drag" });
curls("0439", { grip: "zottman" }, { durationMs: 4500, posterAt: .56 });
curls("4110", { setting: "seat", grip: "zottman" }, { durationMs: 4500, posterAt: .56 });
curls("2294", { setting: "preacher", grip: "zottman" }, { durationMs: 4700, posterAt: .56 });
curls("1672", { setting: "preacher", grip: "zottman", mode: "single" }, { durationMs: 4700, posterAt: .56 });

raises("6141", { form: "hold" });
raises("11014", { grip: "under" });
raises("5819", { plane: "scaption", grip: "thumbs-down" });
raises("5818", { plane: "scaption", grip: "thumbs-up" });
addGroup("7252", raise, { setting: "proneStanding", mode: "single", plane: "rear" }, ["l:rearShoulder", "l:trap"],
  { camera: [-56, 18, [0, .68, .25], 1.88] });
addGroup("7231", raise, { setting: "proneStanding", mode: "single", plane: "y", grip: "hammer" }, ["l:rearShoulder", "l:trap"],
  { camera: [-61, 20, [0, .75, .22], 2.01] });

addGroup("5667 6890", shoulderPress, { setting: "zSeat" }, ["shoulder", "triceps", "core"]);
addGroup("6891", shoulderPress, { setting: "zSeat", mode: "alternate" }, ["shoulder", "triceps", "core"]);
addGroup("10043", shoulderPress, { setting: "zSeat", mode: "single" }, ["l:shoulder", "l:triceps", "core"]);
addGroup("4745", shoulderPress, { setting: "tallKneel", form: "arnold" }, ["shoulder", "triceps", "core"]);
addGroup("11017", shoulderPress, { setting: "tallKneel", mode: "single" }, ["l:shoulder", "l:triceps", "core"]);
addGroup("11016", shoulderPress, { setting: "halfKneel", mode: "single" }, ["l:shoulder", "l:triceps", "core"]);

presses("1450", { form: "fly", hold: true }, { durationMs: 5900 });
presses("7994", { setting: "bridgeMat", startLow: true });
addGroup("2566", pullover, { setting: "supineMat", form: "bent", sharedBell: true }, ["lat", "pec"]);
addGroup("1444", pullover, { setting: "flat", form: "bent", hold: true, sharedBell: true }, ["lat", "pec"],
  { durationMs: 5900 });
addGroup("3693", externalRotation, { setting: "flat", mode: "single" }, ["l:rearShoulder"]);
addGroup("6148", elbowExtension, { setting: "seat", mode: "alternate" }, ["triceps"],
  { camera: overheadExtensionCamera });
addGroup("0330", elbowExtension, { setting: "incline", arcDegrees: 78 }, ["triceps"]);
addGroup("7879", kickback, { setting: "proneStanding" }, ["triceps"]);
addGroup("1734", kickback, { setting: "kickbackBall" }, ["triceps"]);
addGroup("5665", row, { form: "face-pull" }, ["rearShoulder", "trap"]);
addGroup("6136", row, { form: "scapular" }, ["lat", "trap"]);
addGroup("6152", snatch, { mode: "single", fromFloor: true }, ["l:shoulder", "glute", "hamstring", "core"],
  { camera: [57, 12, [0,1.10,.023], 2.40] });

addGroup("4577", shoulderPress, { setting: "halfKneel" }, ["shoulder", "triceps", "core"]);
addGroup("2913", overheadCarry, { mode: "single" }, ["l:shoulder", "core"],
  { camera: [47, 12, [0,1.11,.023], 2.38], durationMs: 3100 });
addGroup("5076", lunge, { form: "overhead" }, ["quad", "glute", "shoulder", "core"],
  { camera: [54, 13, [0,1.05,.22], 2.38], durationMs: 5700 });

addGroup("4816", gobletSquat, { form: "hold", sharedBell: true }, ["quad", "glute"], { durationMs: 4600 });
addGroup("4738", gobletSquat, { form: "curl", sharedBell: true }, ["quad", "glute", "biceps"], { durationMs: 6200 });
addGroup("7469", gobletSquat, { form: "calf", sharedBell: true }, ["quad", "glute", "calf"],
  { durationMs: 4600, posterAt: .80 });
addGroup("7547", gobletSquat, { form: "sumo", sharedBell: true }, ["quad", "glute"]);
addGroup("2323", gobletSquat, { form: "sumo", load: "between" }, ["quad", "glute"]);
addGroup("0412", gobletSquat, { setting: "wallBall", load: "sides" }, ["quad", "glute"]);
addGroup("0435", gobletSquat, { setting: "wallBall", form: "sumo", sharedBell: true }, ["quad", "glute"]);
addGroup("3692", squat, { setting: "benchSquat", form: "bench", sharedBell: true }, ["quad", "glute"]);
addGroup("7549", splitSquat, { setting: "rearBench", form: "goblet", sharedBell: true }, ["l:quad", "l:glute"]);
addGroup("1550", splitSquat, { setting: "rearBench" }, ["l:quad", "l:glute"]);
addGroup("3691 5028", splitSquat, { form: "long", sharedBell: true }, ["l:quad", "l:glute"]);
addGroup("2956", splitSquat, { setting: "deadliftStep", form: "goblet", sharedBell: true }, ["l:quad", "l:glute"],
  { camera: [62, 13, [0, .91, -.94], 2.12] });
addGroup("4048", splitSquat, { mode: "single" }, ["l:quad", "l:glute"]);
addGroup("6328", splitSquat, { form: "low" }, ["l:quad", "l:glute"]);
addGroup("6424", gobletHinge, { sharedBell: true }, ["hamstring", "glute"], { camera: [61, 14, [0,.86,.07], 2.06] });
addGroup("7648", deadlift, { form: "straight", mode: "single", longRearLeg: true }, ["l:hamstring", "l:glute"]);
addGroup("4751", hipThrust, { setting: "supineMat", sharedBell: true }, ["glute", "hamstring"]);
addGroup("4291", hipThrust, { setting: "supineMat", form: "single", sharedBell: true }, ["l:glute", "l:hamstring"]);
const hipThrustCamera = [68, 13, [.1,.54,1.50], 1.57];
addGroup("5754", hipThrust, { setting: "flat", sharedBell: true }, ["glute", "hamstring"], { camera: hipThrustCamera });
addGroup("5554", hipThrust, { setting: "flat", form: "short", sharedBell: true }, ["glute", "hamstring"], { camera: hipThrustCamera });
addGroup("4755 8075", hipThrust, { setting: "flat", form: "single", sharedBell: true }, ["l:glute", "l:hamstring"],
  { camera: [68, 16, [.1,.62,1.50], 1.65] });

presses("10042",{setting:"supineMat",form:"squeeze"});
presses("3681 3075",{form:"squeeze"});
presses("4836",{form:"reverse-squeeze"});
presses("1731 0296 0338",{form:"neutral"});
addGroup("4237",shoulderPress,{setting:"upright",form:"narrow"},["shoulder","triceps"]);
addGroup("2397",shoulderPress,{form:"scott"},["shoulder"],{camera:standingPressCamera});
addGroup("0337",elbowExtension,{setting:"flat",form:"across-face",arcDegrees:61},["l:triceps"]);
addGroup("2738",elbowExtension,{setting:"supineMat",arcDegrees:108},["triceps"]);
addGroup("4151",elbowExtension,{setting:"supineMat",arcDegrees:78},["triceps"]);
addGroup("4343",elbowExtension,{mode:"single"},["l:triceps"],{camera:standingPressCamera});
addGroup("0362",elbowExtension,{setting:"seat",mode:"single",form:"seat-brace"},["l:triceps"],{camera:overheadExtensionCamera});
addGroup("4054",elbowExtension,{setting:"ball",mode:"single"},["l:triceps","core"],{camera:[57,14,[0,.97,.13],2.14]});
addGroup("0346",elbowExtension,{setting:"flat",mode:"single",form:"reverse"},["l:triceps"]);
addGroup("3339",lunge,{mode:"single"},["quad","glute"],{durationMs:5700});
addGroup("0407",sideBend,{mode:"single"},["core"]);
addGroup("10901",shrug,{mode:"single"},["l:trap"]);
addGroup("4053",shrug,{setting:"seat",mode:"single"},["l:trap"]);
curls("3963",{setting:"proneStanding",mode:"single"},{camera:[-61,18,[0,.69,.25],1.89]});
curls("1675",{setting:"proneStanding",grip:"reverse"});
curls("1667",{setting:"proneStanding",mode:"single",grip:"reverse",form:"prone-brace"},{camera:[-61,18,[0,.69,.25],1.89]});
curls("7056",{grip:"reverse-turn"},{durationMs:4700});
curls("2293",{setting:"preacherStanding",grip:"zottman"},{durationMs:4700});
curls("0353",{setting:"ball",mode:"single",form:"concentration"});
addGroup("3547",curlOverhead,{setting:"seat"},["biceps","shoulder","triceps"],{camera:overheadExtensionCamera,durationMs:5200});
addGroup("3347 4574",curlOverhead,{},["biceps","shoulder","triceps"],{camera:standingPressCamera,durationMs:5200});
addGroup("3338",reverseSideHinge,{mode:"single"},["l:hamstring","l:glute"],{camera:[62,14,[0,.83,-.16],2.16]});

addGroup("2968 2969",thruster,{},["quad","glute","shoulder"],{camera:standingPressCamera,durationMs:4200,posterAt:.68});
addGroup("4540",thruster,{mode:"single"},["quad","glute","l:shoulder"],{camera:standingPressCamera,durationMs:4200,posterAt:.68});
addGroup("9693",thruster,{mode:"alternate"},["quad","glute","shoulder"],{camera:standingPressCamera,durationMs:6200,posterAt:.34});
addGroup("3398",lunge,{form:"rack"},["quad","glute"],{durationMs:5800});
addGroup("1175",lunge,{form:"lean"},["quad","glute"],{durationMs:5800});
addGroup("1215 3448",lateralLunge,{},["quad","glute"],{camera:[52,14,[0,.90,.065],2.28],durationMs:5900,posterAt:.23});
addGroup("1553",lateralLunge,{form:"curl"},["quad","glute","biceps"],{camera:[52,14,[0,.90,.065],2.28],durationMs:5900,posterAt:.23});
addGroup("4887",dumbbellBridgePair,{setting:"supineMat"},["glute","hamstring"]);
addGroup("3452",svendPress,{sharedBell:true},["pec","triceps"]);
addGroup("3946",svendPress,{setting:"seat",form:"alternate"},["pec","triceps"],{durationMs:5800,posterAt:.23});
addGroup("4563",squatHoldCalf,{},["calf","quad"],{camera:[63,13,[0,.78,.052],1.91]});
addGroup("4757",staggeredDBHinge,{},["l:hamstring","l:glute"],{camera:[62,14,[0,.83,-.14],2.09]});
addGroup("8192",sumoPull,{sharedBell:true,startGround:true},["quad","glute","hamstring"],{camera:[57,15,[0,.80,.065],2.00]});
addGroup("2808",sumoPull,{sharedBell:true},["glute","hamstring"],{camera:[57,15,[0,.80,.065],2.00]});
addGroup("2807",sumoPull,{sharedBell:true,swing:true},["glute","hamstring"],{camera:[65,16,[0,.79,-.01],2.04]});
addGroup("4318",pullover,{setting:"supineMat",form:"bent"},["lat","pec"]);
addGroup("7113 2365",pullover,{setting:"flat",form:"straight"},["lat","pec"]);
addGroup("3176",pullover,{setting:"flat",form:"straight",legsRaised:true},["lat","pec","core"],{camera:[64,19,[.10,.78,1.18],1.86]});
presses("3175",{form:"fly",legsRaised:true},{camera:[64,19,[.10,.78,1.18],1.86]});
presses("3911",{form:"fly",lowArc:true});
presses("0357 1290",{setting:"bridge",mode:"single",startLow:true});
raises("4191",{plane:"lateral",form:"partial"});
curls("1228",{form:"inner"});
addGroup("4833",shoulderPress,{mode:"single",form:"arnold"},["l:shoulder","l:triceps"],{camera:standingPressCamera});
addGroup("4120",shoulderPress,{setting:"upright",mode:"single",form:"arnold"},["l:shoulder","l:triceps"]);
addGroup("6142",shoulderPress,{setting:"upright",form:"arnold",startsOverhead:true},["shoulder","triceps"]);
addGroup("0354",staggerKickback,{mode:"single"},["l:triceps"],{camera:[64,16,[0,.78,-.063],2.06]});
addGroup("6221",elbowExtension,{sharedBell:true},["triceps"],{camera:[62,12,[0,1.08,.02],2.56]});
addGroup("5201",waiterCurl,{sharedBell:true},["biceps"],{camera:[46,16,[0,1.0,.065],2.10]});
addGroup("4211",raiseCircuit,{},["shoulder","rearShoulder"],{camera:[51,14,[0,.94,.07],2.27],durationMs:6500,posterAt:.14});
addGroup("4871",raiseCircuit,{setting:"seat",form:"six"},["shoulder"],{camera:[57,15,[.1,.91,1.36],1.98],durationMs:6300,posterAt:.42});

addGroup("4732 4562",lateralLunge,{form:"goblet",fixedFeet:true,toesUp:true,sharedBell:true},["quad","glute"],
  {camera:[38,14,[0,.88,.06],2.30],durationMs:6200,posterAt:.23});
addGroup("4754",lateralLunge,{form:"goblet",fixedFeet:true,sharedBell:true},["quad","glute"],
  {camera:[38,14,[0,.88,.06],2.30],durationMs:6000,posterAt:.23});
addGroup("1694",lateralLunge,{form:"overhead",mode:"single"},["quad","glute","shoulder"],
  {camera:[43,13,[0,1.06,.04],2.43],durationMs:6100,posterAt:.23});
addGroup("3683",curtsyLunge,{goblet:true,sharedBell:true},["quad","glute"],{durationMs:5700,posterAt:.22});
addGroup("8664",curtsyLunge,{},["quad","glute"],{durationMs:5700,posterAt:.22});
addGroup("0882 3767",pistolGoblet,{sharedBell:true},["l:quad","l:glute"],{camera:[63,14,[.08,.85,.14],2.15]});
addGroup("3709",dbOverheadSquat,{},["quad","glute","shoulder"],{camera:standingPressCamera});
addGroup("5096",dbOverheadSquat,{mode:"single"},["quad","glute","l:shoulder"],{camera:standingPressCamera});
addGroup("5095",lunge,{mode:"single",form:"overhead"},["quad","glute","l:shoulder"],{camera:standingPressCamera,durationMs:5800,posterAt:.22});
addGroup("3341",lunge,{},["quad","glute"],{durationMs:5800,posterAt:.22});
addGroup("3635",lunge,{mode:"single",form:"opposite"},["r:quad","r:glute","core"],{durationMs:4300});
addGroup("10055",lunge,{form:"reverse",narrowStance:true},["quad","glute"],{durationMs:5800,posterAt:.22});
addGroup("5313",hingeThenSquat,{goblet:true,sharedBell:true},["hamstring","glute","quad"],{durationMs:5800,posterAt:.74});
addGroup("9484",hingeThenSquat,{},["hamstring","glute","quad"],{durationMs:5800,posterAt:.74});
addGroup("2911",overheadCarry,{secondaryLoad:true},["l:shoulder","core"],{camera:standingPressCamera,durationMs:3300});
addGroup("10183",crossRaise,{twist:true},["shoulder","core"],{durationMs:5700,posterAt:.28});
addGroup("10040",crossRaise,{mode:"alternate"},["shoulder"],{durationMs:5400,posterAt:.23});
addGroup("5458",crossRaise,{mode:"single"},["l:shoulder","l:pec"]);
addGroup("2143",dumbbellAroundWorld,{},["shoulder"],{camera:standingPressCamera,durationMs:4900});
addGroup("3967",dumbbellAroundWorld,{setting:"incline"},["shoulder","pec"],{durationMs:5100});
addGroup("3968",dumbbellAroundWorld,{setting:"flat"},["shoulder","pec"],{durationMs:5100});
presses("4342",{form:"twist-fly"});

const cleanCamera=[63,13,[0,.92,.066],2.19];
addGroup("0295",cleanSequence,{start:"hover"},["quad","glute","trap","shoulder"],{camera:cleanCamera,durationMs:4300,posterAt:.42});
addGroup("4449 4739",cleanSequence,{start:"hang"},["quad","glute","trap","shoulder"],{camera:cleanCamera,durationMs:4300,posterAt:.42});
addGroup("4889",cleanSequence,{},["quad","glute","trap","shoulder"],{camera:cleanCamera,durationMs:4400,posterAt:.42});
addGroup("5101",cleanSequence,{mode:"single"},["quad","glute","l:trap","l:shoulder"],{camera:cleanCamera,durationMs:4400,posterAt:.42});
addGroup("3400",cleanSequence,{finish:"press"},["quad","glute","shoulder","triceps"],{camera:standingPressCamera,durationMs:4900,posterAt:.69});
addGroup("4377",cleanSequence,{start:"hang",finish:"jerk",mode:"single"},["quad","glute","l:shoulder"],{camera:standingPressCamera,durationMs:4800,posterAt:.70});
addGroup("4740",cleanSequence,{start:"hang",finish:"jerk"},["quad","glute","shoulder"],{camera:standingPressCamera,durationMs:4800,posterAt:.70});
addGroup("4439",cleanSequence,{finish:"jerk"},["quad","glute","shoulder"],{camera:standingPressCamera,durationMs:4900,posterAt:.70});
addGroup("4389",cleanSequence,{start:"rack",finish:"jerk"},["quad","glute","shoulder"],{camera:standingPressCamera,durationMs:3300,posterAt:.49});
addGroup("10044",snatch,{mode:"single",shallowHang:true},["quad","glute","l:shoulder"],{camera:standingPressCamera,durationMs:3900});
addGroup("4822",rdlJumpShrug,{},["quad","glute","trap"],{camera:[67,14,[0,.96,.03],2.31],durationMs:4400,posterAt:.60});
addGroup("3368",dumbbellSwing,{sharedBell:true},["glute","hamstring","core"],{camera:[62,16,[0,.87,.04],2.11],durationMs:3700});
addGroup("3397",dumbbellSwing,{sharedBell:true,full:true},["glute","hamstring","shoulder"],{camera:standingPressCamera,durationMs:4200});
addGroup("1445",deadlift,{form:"straight",hold:true},["hamstring","glute"],{camera:[60,13,[0,.84,-.08],2.05],durationMs:5800});
addGroup("10199",crossRdl,{},["hamstring","glute","core"],{camera:[63,15,[0,.84,-.05],2.15],durationMs:5900,posterAt:.23});

addGroup("4154",wristCurl,{setting:"seat",mode:"single",form:"neutral"},["l:forearm"],{camera:[64,21,[.10,.69,1.40],1.62]});
addGroup("4234",wristCurl,{setting:"seat",mode:"single",form:"reverse"},["l:forearm"],{camera:[64,21,[.10,.69,1.40],1.62]});
addGroup("4233",wristCurl,{setting:"seat",mode:"single",form:"roll"},["l:forearm"],{camera:[64,21,[.10,.69,1.40],1.62]});
addGroup("4232",wristCurl,{setting:"seat",form:"reverse"},["forearm"],{camera:[56,20,[.10,.67,1.38],1.65]});
addGroup("4231",wristCurl,{setting:"seat",mode:"single",form:"supination"},["l:forearm"],{camera:[63,20,[.10,.67,1.40],1.63]});
addGroup("4155 5483",calfRaise,{setting:"seatStep"},["calf"],{camera:[64,18,[.10,.74,1.42],1.93]});
addGroup("5484",calfRaise,{setting:"seatStep",mode:"single"},["l:calf"],{camera:[64,18,[.10,.74,1.42],1.93]});
addGroup("0842",pullover,{setting:"bridge",form:"straight"},["lat","pec","glute"],{camera:[65,22,[0,.72,.09],1.85]});
addGroup("1603",gobletSquat,{setting:"wallBall",load:"sides"},["quad","glute"],{camera:[64,16,[0,.87,-.12],2.19]});

export { add, arm, blend, body, cycle, foot, inactive, joint, ramp, scale, sides };
export { chestPress, curl, deadlift, elbowExtension, fromSupport, hipThrust, kickback, lunge,
  pullover, raise, row, shoulderPress, sideBend, splitSquat, squat, uprightRow, weightedPushup, curtsyLunge };

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  const [directory, ...requested] = process.argv.slice(2);
  if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
  if (new Set(jobs.map(({ id }) => id)).size !== jobs.length) throw new Error("Duplicate catalogue ID in recipe table.");
  const work = requested.length ? jobs.filter(({ id }) => requested.includes(id)) : jobs;
  if (!work.length || (requested.length && work.length !== requested.length)) {
    throw new Error("Invalid or duplicate requested catalogue IDs.");
  }

  const out = resolve(directory);
  await mkdir(out, { recursive: true, mode: 0o700 });
  const items = [];
  for (const job of work) {
    const { id, motion, options, supportName, muscles } = job;
    const [yaw, elevation, focus, height] = job.camera ?? support[supportName].camera;
    const load = options.mode === "single" || options.sharedBell || motion === pullover ? "dumbbell" : "dumbbells";
    const accessory = support[supportName].bench;
    const data = {
      version: 1, durationMs: job.durationMs ?? (options.mode === "alternate" ? 5100 : 3600),
      equipment: accessory ? accessory + "-" + load : load,
      muscles, camera: { yaw, elevation, focus, height },
      keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...motion(index / 64, options) })),
    };
    try {
      prepareRecipe(data);
    } catch (error) {
      throw new Error(id + ": " + error.message, { cause: error });
    }
    const recipe = id + ".json";
    await writeFile(join(out, recipe), JSON.stringify(data) + "\n");
    items.push({ id, recipe, posterAt: job.posterAt ?? .47 });
  }
  await writeFile(join(out, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
  console.log("Prepared", items.length, "Spotter dumbbell recipes.");
}
