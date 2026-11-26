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
  flat: { point: [.1, .551, 1.26], pitch: -Math.PI / 2, feet: [.258, floor, 1.530], camera: [67, 17, [.1, .58, 1.00], 1.65], bench: "bench" },
  decline: { point: [0, .825, .247], pitch: -1.839, feet: [.163, .521, .815], camera: [66, 17, [0, .66, .135], 1.62], bench: "decline-bench" },
  preacher: { point: [0, .552, -.091], pitch: .238, feet: [.253, floor, .248], camera: [49, 15, [0, .75, .14], 1.70], bench: "preacher-bench" },
  preacherStanding: { point: [0, .758, -.411], pitch: .72, feet: [.260, floor, -.405], camera: [62, 15, [0, .78, .05], 1.78], bench: "preacher-bench" },
  ball: { point: [0, .660, .027], pitch: .035, feet: [.229, floor, .381], camera: [54, 14, [0, .85, .12], 1.95], radius: .285, bench: "stability-ball" },
  bridge: { point: [0, .562, .307], pitch: -1.445, feet: [.219, floor, .659], camera: [66, 16, [0, .67, .23], 1.72], radius: .285, bench: "stability-ball" },
  kneelingBall: { point: [0, .368, -.178], pitch: .846, feet: [.148, .082, -.628], camera: [57, 16, [0, .66, -.13], 1.57], radius: .285, bench: "stability-ball" },
  prone: { point: [0, .518, .255], pitch: Math.PI / 4, yaw: Math.PI, feet: [.301, floor, .565], camera: [96, 18, [0, .74, .13], 1.73], bench: "chest-bench" },
  proneFlat: { point: [.10, .553, 1.25], pitch: Math.PI / 2, yaw: Math.PI, feet: [.123, .55, 1.89], camera: [138, 17, [.1, .62, 1.02], 1.62], bench: "bench" },
  hinge: { point: [0, .819, -.195], pitch: 1.105, feet: [.161, floor, .058], camera: [55, 14, [0, .70, .03], 1.73] },
  hingeSeat: { point: [.1, .550, 1.208], pitch: 1.172, feet: [.217, floor, 1.545], camera: [62, 15, [.1, .55, 1.39], 1.54], bench: "bench" },
  raiseBrace: { point: [-.028, .894, .012], pitch: .015, feet: [.140, floor, .057], camera: [49, 12, [-.13,.93,.09], 2.10], bench: "raise-brace" },
  headBrace: { point: [0, .807, -.227], pitch: 1.285, feet: [.164, floor, -.069], camera: [60, 16, [0,.67,.20], 1.73], bench: "head-brace" },
  inclineBall: { point: [0, .654, .24], pitch: -.828, feet: [.224, floor, .602], camera: [57, 15, [0, .80, .12], 1.85], radius: .285, bench: "incline-ball" },
  proneGround: { point: [0, .149, .214], pitch: Math.PI / 2, yaw: Math.PI, feet: [.132, .107, 1.000],
    camera: [142, 24, [0,.34,.14], 1.30], bench: "mat" },
  benchSquat: { camera: [57, 14, [.1,.91,1.28], 2.06], bench: "bench" },
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
    if (setting === "flat" || setting === "bridge") pole[1] = .75;
    if (setting === "decline") {
      pole[1] = 1;
      toes[1] = -.115;
    }
    if (setting === "proneFlat") {
      pole[1] = -.7;
      toes[1] = -.105;
    }
    if (setting === "kneelingBall") {
      pole[1] = -1;
      toes[2] = -.145;
    }
    if (setting === "floor" && options.stork && side === "r") {
      target[1] = .132;
      target[2] = -.228;
      toes[1] = -.128;
    }
    if ((setting === "ball" || setting === "bridge") && options.oneLeg && side === "r") {
      target[1] = setting === "ball" ? .395 : .447;
      target[2] = setting === "ball" ? .661 : .877;
      toes[1] = .053;
      delete pose.planted.r;
    }
    if (setting === "decline" || setting === "proneFlat" || setting === "kneelingBall") delete pose.planted[side];
    foot(pose, side, reversed, target, pole, toes);
  }
  if (base.radius) {
    const z = setting === "bridge" ? -.090 : setting === "kneelingBall" ? .333 : setting === "inclineBall" ? .24 : .003;
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
  const pose = fromSupport(setting, {
    oneLeg: form === "leg-raised", stork: form === "stork",
    ...(squat ? { point: [0, .889 - .308 * global, .025 - .129 * global], pitch: .04 + .252 * global } : {}),
    ...(concentration ? { pitch: .57 } : {}),
  });
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      if (form === "bench-brace") {
        arm(pose, side, [-.135, .796, -.168], [-.54, -.642, .12]);
      } else {
        inactive(pose, side, sign, concentration ? "thigh" : form === "leg-raised" ? "chest" : "low");
      }
      continue;
    }
    const amount = depthFor(phase, mode, side);
    const prone = setting === "prone" || setting === "proneFlat";
    const reversed = prone ? -sign : sign;
    let upper = [reversed * .079, -.239, .018];
    if (setting === "incline") upper = [sign * .074, -.240, -.025];
    if (setting === "preacher" || setting === "preacherStanding") upper = [sign * .024, -.177, .177];
    if (setting === "kneelingBall") upper = [-sign * .078, -.130, .203];
    if (setting === "flat") upper = [sign * (form === "wide" ? .248 : .235), form === "wide" ? -.027 : -.065, .057];
    if (setting === "prone") upper = [reversed * .068, -.240, -.038];
    if (setting === "proneFlat") upper = [reversed * .233, -.067, -.041];
    if (setting === "armBlaster") upper = [sign * .065, -.234, .065];
    if (form === "high") upper = [sign * .064, -.223, .100];
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
    const axis = grip === "hammer" ? neutral : grip === "reverse" ? scale(transverse, -1)
      : grip === "supinate" ? blend(neutral, transverse, smooth(amount * 1.45)) : transverse;
    holdBell(pose, side, axis);
  }
  return pose;
}

function raise(phase, { setting = "floor", plane = "front", mode = "both", form = "straight" } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    const localSign = pose.right[0] < 0 ? -sign : sign;
    if (mode === "single" && side === "r") {
      if (setting === "raiseBrace") arm(pose, side, [-.510, 1.107, .260], [-.76, -.31, -.22]);
      else inactive(pose, side, localSign, setting === "proneFlat" ? "chest" : "low");
      continue;
    }
    const split = plane === "combo";
    const direction = split ? phase <= .5 ? "lateral" : "front" : plane;
    const amount = split ? cycle((phase * 2) % 1) : depthFor(phase, mode, side);
    if (setting === "proneGround") {
      const angle = (21 + 51 * amount) * degrees;
      const arc = [localSign * .578 * Math.sin(angle), .09 + .177 * amount, -.562 * Math.cos(angle)];
      arm(pose, side, add(pose[side + "s"], arc), [localSign * .20, -.70, -.14], [0, 0, 1]);
      continue;
    }
    const peak = direction === "above" ? 157 : direction === "y" ? 133 : direction === "front" ? 92 : 87;
    const angle = (8 + (peak - 8) * amount) * degrees;
    const floorDirection = direction === "front" || direction === "above" ? [localSign * .075, 0, 1]
      : direction === "y" ? [localSign * .60, 0, -.79]
      : [localSign, 0, direction === "rear" && setting !== "prone" && setting !== "proneFlat" ? -.20 : .048];
    const travel = add(scale(unit(floorDirection), Math.sin(angle)), [0, -Math.cos(angle), 0]);
    const bent = form === "bent";
    const reach = bent ? .480 : .603;
    const target = add(pose[side + "s"], scale(travel, reach));
    if (setting === "proneFlat") target[1] = Math.max(target[1], .103);
    const naturalGrip = form === "rotate" ? blend([0, 0, 1], [0, .98, .10], amount) : direction === "front" || direction === "above" ?
      blend([0, 0, 1], [1, 0, 0], amount) : blend([0, 0, 1], [0, .18, 1], amount);
    arm(pose, side, target, bent ? [localSign * .95, .28, .47] : [localSign * .28, -.9, .27], naturalGrip);
  }
  return pose;
}

function shoulderPress(phase, { setting = "floor", mode = "both", form = "plain" } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const amount = depthFor(phase, mode, side);
    const neutral = form === "neutral";
    const start = [sign * (neutral ? .105 : .181), .099, neutral ? .180 : .100];
    const end = add(scale(pose.front, .075), [sign * .035, .580, .010]);
    const wrist = add(pose[side + "s"], blend(start, end, amount));
    const grip = neutral ? [0, 0, 1] : [1, 0, 0];
    arm(pose, side, wrist, [sign * .879, -.523, .131], grip);
  }
  return pose;
}

function chestPress(phase, { setting = "flat", mode = "both", form = "regular" } = {}) {
  const pose = fromSupport(setting, { oneLeg: form === "one-leg" });
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "chest");
      continue;
    }
    const depth = depthFor(phase, mode, side);
    const fly = form === "fly" || form === "twist-fly" || form === "one-leg";
    const neutral = form === "neutral" || form === "twist-press";
    const top = [sign * (fly ? -.073 : .021), .603, .022];
    const bottom = fly ? [sign * .598, .073, .027]
      : [sign * (neutral ? .129 : .244), .223, setting === "incline" ? .114 : .114];
    const travel = fly
      ? [sign * (-.073 + .666 * Math.sin(depth * Math.PI / 2)), .073 + .53 * Math.cos(depth * Math.PI / 2), .028]
      : blend(top, bottom, depth);
    const grip = form === "twist-fly" ? blend([0, 0, 1], [1, 0, 0], depth) :
      form === "twist-press" ? blend([0, 0, 1], [1, 0, 0], 1 - depth) :
      fly || neutral ? [0, 0, 1] : form === "reverse" ? [-1, 0, 0] : [1, 0, 0];
    const pole = fly ? [sign * .20, -.8, .359] : [sign * (neutral ? .25 : .86), -.83, neutral ? .65 : .33];
    arm(pose, side, add(pose[side + "s"], travel), pole, grip);
  }
  return pose;
}

function row(phase, { setting = "hinge", mode = "both", form = "plain" } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    const facing = pose.right[0] < 0 ? -1 : 1;
    const lateral = facing * sign;
    if (mode === "single" && side === "r") {
      inactive(pose, side, lateral, form === "brace" ? "thigh" : "low");
      continue;
    }
    const amount = depthFor(phase, mode, side);
    const high = form === "rear";
    const down = setting === "proneFlat" ? [lateral * .076, -.454, .019] : [lateral * .046, -.603, .019];
    const peak = high ? [lateral * .185, -.148, facing * .047] : [lateral * .043, -.135, facing * -.327];
    const pole = [lateral * (high ? .93 : .13), -.09, -facing * .88];
    const grip = form === "reverse" ? [-facing, 0, 0] :
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

function shrug(phase, { setting = "floor" } = {}) {
  const amount = cycle(phase, .33, .61);
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    const lateral = pose.right[0] < 0 ? -sign : sign;
    pose[side + "s"] = add(pose[side + "s"], [lateral * -.020 * amount, .085 * amount, .012 * amount]);
    arm(pose, side, add(pose[side + "s"], [lateral * .115, -.606, .071]), [lateral * .49, -.17, -.73], [0, 0, 1]);
  }
  return pose;
}

function kickback(phase, { setting = "hinge", mode = "both" } = {}) {
  const pose = fromSupport(setting);
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r") {
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const elbow = add(pose[side + "s"], setting === "hingeSeat" ? [sign * .087, -.055, -.230] : [sign * .027, -.055, -.244]);
    const amount = depthFor(phase, mode, side);
    const bend = (8 + 86 * amount) * degrees;
    pose[side + "e"] = elbow;
    pose[side + "w"] = add(elbow, [0, -loadedForearm * Math.cos(bend), -loadedForearm * Math.sin(bend)]);
    holdBell(pose, side, [0, -Math.sin(bend), Math.cos(bend)]);
  }
  return pose;
}

function elbowExtension(phase, { setting = "floor", mode = "both", sharedBell = false } = {}) {
  const pose = fromSupport(setting);
  const lyingDown = setting === "flat" || setting === "decline";
  const amount = cycle(phase);
  const angle = (8 + (lyingDown ? 73 : 112) * amount) * degrees;
  for (const [side, sign] of sides) {
    if (mode === "single" && side === "r" && !sharedBell) {
      inactive(pose, side, sign, lyingDown ? "chest" : "thigh");
      continue;
    }
    const elbow = add(pose[side + "s"], [sign * (sharedBell ? -.078 : -.025), .230, lyingDown ? -.099 : .101]);
    pose[side + "e"] = elbow;
    const inward = sharedBell ? -sign * .065 : 0;
    pose[side + "w"] = add(elbow, [inward, loadedForearm * Math.cos(angle), -loadedForearm * Math.sin(angle)]);
    if (sharedBell) {
      pose[side + "Grip"] = [sign, 0, 0];
      pose[side + "Fingers"] = [0, Math.sin(angle), Math.cos(angle)];
    } else {
      holdBell(pose, side, [0, Math.sin(angle), Math.cos(angle)]);
    }
  }
  if (sharedBell) {
    pose.dumbbells.push({ center: add(blend(pose.lw, pose.rw, .5), [0, -.044 * Math.sin(angle), -.044 * Math.cos(angle)]),
      axis: [0, Math.cos(angle), -Math.sin(angle)] });
  }
  return pose;
}

function pullover(phase, { setting = "flat", mode = "both", form = "plain" } = {}) {
  const pose = fromSupport(setting);
  const amount = cycle(phase);
  const angle = .025 + amount * (form === "around" ? 1.76 : 1.59);
  const right = [1, 0, 0];
  const single = mode === "single";
  let center;
  for (const [side, sign] of sides) {
    if (single && side === "r") {
      inactive(pose, side, sign, "chest");
      continue;
    }
    const reach = form === "straight" ? .606 : .59;
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
    const angle = (form === "fingers" ? -7 + 14 * amount : -42 + 84 * amount) * degrees;
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
    if (form === "fingers") {
      const release = 1 - amount;
      pose[side + "Grip"] = [sign, 0, 0];
      pose[side + "FingerCurl"] = .18 + .82 * amount;
      pose.dumbbells.push({ center: add(pose[side + "w"], [0, -.044 * release, .064 * release]), axis: [1, 0, 0] });
    } else {
      holdBell(pose, side, form === "neutral" ? [0, Math.cos(angle), -Math.sin(angle)]
        : [form === "reverse" ? -sign : sign, 0, 0]);
    }
  }
  return pose;
}

function externalRotation(phase, { setting = "floor" } = {}) {
  const standing = setting === "floor";
  const pose = standing ? fromSupport("floor") : sideSupport("flat");
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
    const x = pose.hips[0] + sign * (oneLeg ? .100 : .180);
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

function deadlift(phase, { setting = "floor", form = "bent", mode = "both" } = {}) {
  const amount = cycle(phase);
  const straight = form === "straight";
  const single = mode === "single";
  const hinge = (straight ? .97 : 1.09) * amount;
  const pose = body([single ? .045 : 0, .887 - (straight ? .08 : single ? .11 : .196) * amount,
    .017 - (straight ? .232 : single ? .131 : .236) * amount], .029 + hinge);
  for (const [side, sign] of sides) {
    const supportLeg = single && side === "r";
    const target = supportLeg ? [-.162, .217 + .32 * amount, -.490 - .16 * amount] :
      [sign * .141, floor, .099];
    foot(pose, side, sign, target, [sign * .10, .064, .98], [sign * .025, -.071, supportLeg ? -.123 : .144]);
    if (supportLeg) {
      delete pose.planted[side];
      inactive(pose, side, sign, "thigh");
      continue;
    }
    const hanging = [sign * .056, -.605, .115 - .132 * amount];
    arm(pose, side, add(pose[side + "s"], hanging), [sign * .53, -.23, -.70], [1, 0, 0]);
  }
  return pose;
}

function lunge(phase, { form = "plain" } = {}) {
  const extension = form === "extension";
  const alternating = !extension;
  const firstHalf = phase <= .5;
  const fraction = alternating ? firstHalf ? phase * 2 : (phase - .5) * 2 : phase;
  const chosen = firstHalf || !alternating ? "l" : "r";
  const reverse = form === "reverse";
  const forwardSign = chosen === "l" ? 1 : -1;
  const depth = ramp(fraction, .13, .37) * (1 - ramp(fraction, extension ? .77 : .59, .91));
  const step = ramp(fraction, 0, .22) * (1 - ramp(fraction, .74, 1));
  const swing = Math.max(0, Math.sin(step * Math.PI)) * .106;
  const twist = form === "bowling" ? forwardSign * .57 * depth : 0;
  const pose = body([forwardSign * .026 * depth, .887 - .281 * depth, (reverse ? -.10 : .283) * step], .043 + .129 * depth, twist);
  for (const [side, sign] of sides) {
    const moves = side === chosen;
    const target = [sign * .142, floor + (moves ? swing : reverse ? 0 : .112 * depth),
      .042 + (moves ? (reverse ? -.645 : .615) * step : reverse ? .031 * step : -.075 * depth)];
    if (moves || depth > 0 && (side === chosen) === reverse) delete pose.planted[side];
    foot(pose, side, sign, target, [sign * .11, -.014, .94], [sign * .023, -(target[1] - .003), .138]);
    if (extension) {
      const overhead = ramp(fraction, .20, .44) * (1 - ramp(fraction, .77, 1));
      const flexion = ramp(fraction, .44, .57) * (1 - ramp(fraction, .62, .78));
      const highest = [sign * -.017, .593 - .234 * flexion, .038 - .327 * flexion];
      const wrist = add(pose[side + "s"], blend([sign * .076, -.558, .060], highest, overhead));
      arm(pose, side, wrist, [sign * .53, .59, -.208], blend([0,0,1], [0,1,0], flexion));
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

function stepUp(phase, { form = "both-feet" } = {}) {
  const drive = form === "knee-drive";
  const lead = drive ? 1 : ramp(phase, 0, .19) * (1 - ramp(phase, .79, 1));
  const climb = ramp(phase, drive ? 0 : .19, .43) * (1 - ramp(phase, .59, drive ? 1 : .79));
  const trail = drive ? 0 : ramp(phase, .26, .48) * (1 - ramp(phase, .55, .77));
  const pose = body([0, .883 + .121 * climb - .10 * lead * (1 - climb), .038 + .42 * climb],
    .049 + .264 * lead * (1 - climb));
  for (const [side, sign] of sides) {
    const progress = side === "l" ? lead : trail;
    const swing = Math.sin(progress * Math.PI);
    const point = [sign * (drive ? .120 : .140), floor + progress * .125 + swing * .16,
      .035 + .45 * progress];
    if (drive && side === "r") {
      point[1] = floor + climb * .763;
      point[2] = .025 + climb * .682;
    }
    if (progress === 1) pose.planted[side] = .125;
    else if (progress > 0 || (drive && side === "r" && climb > 0)) delete pose.planted[side];
    foot(pose, side, sign, point, [sign * .11, .024, .95]);
  }
  hangingBells(pose);
  return pose;
}

function overheadCarry(phase) {
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
  arm(pose, "r", add(pose.rs, [-.070, -.555, -.154 * Math.cos(2 * Math.PI * gait)]), [-.66, -.23, -.05]);
  return pose;
}

function snatch(phase) {
  const lift = ramp(phase, .17, .52) * (1 - ramp(phase, .65, 1));
  const absorb = ramp(phase, .39, .49) * (1 - ramp(phase, .52, .66));
  const pose = body([0, .713 + .18 * lift - .052 * absorb, -.101 + .116 * lift], 1.01 - .96 * lift);
  for (const [side, sign] of sides) foot(pose, side, sign, [sign * .177, floor, .066], [sign * .18, 0, .98]);
  const reach = [.075, -.604 + 1.202 * lift, .027 + .144 * Math.sin(lift * Math.PI)];
  arm(pose, "l", add(pose.ls, reach), [.73, .30, -.09], blend([-1, 0, 0], [0, 0, 1], lift));
  arm(pose, "r", add(pose.rs, [-.146, -.402, -.235 * lift]), [-.79, -.16, .42]);
  return pose;
}

function hipThrust(phase) {
  const amount = cycle(phase);
  const pose = body([.1, .195 + .330 * amount, 1.591 - .072 * amount], -.919 - .583 * amount);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [.1 + sign * .188, floor, 1.952], [sign * .18, .86, .78]);
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
  for (const [side, sign] of sides) {
    const activeLeg = !(onOne && side === "r");
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

export { add, arm, blend, body, cycle, foot, inactive, joint, ramp, scale, sides };

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
