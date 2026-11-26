import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const ballRadius = .285;
const floor = .075;
const sidePhase = (phase, active) => (phase >= .5) === (active === -1) ? (phase * 2) % 1 : 0;

function hand(pose, side, destination, pole, fingers = [0, 0, 1]) {
  arm(pose, side, destination, pole);
  pose[side + "Fingers"] = fingers;
  pose[side + "PalmSide"] = [1, 0, 0];
}

function rearFeet(pose, height, depth, spread = .145, pole = .07) {
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * spread, height, depth], [sign * .11, pole, .42],
      [sign * .021, -.105, -.069]);
    delete pose.planted[side];
  }
}

function handsBehindHead(pose) {
  for (const [side, sign] of sides) {
    const touch = add(add(pose.head, scale(pose.right, sign * .058)), scale(pose.front, -.086));
    hand(pose, side, touch, [sign * .96, -.08, -.07], [sign * -.44, -.12, -.88]);
  }
}

function crossChest(pose) {
  for (const [side, sign] of sides) {
    const touch = add(add(pose.chest, scale(pose.right, -sign * .13)), scale(pose.front, .112));
    hand(pose, side, touch, [sign * .78, -.33, .78], [-sign, .08, 0]);
  }
}

function backExtension(phase, { wall = false, overhead = false, head = false, straightLeg = false, twist = 0 } = {}) {
  const depth = cycle(phase, twist ? .25 : .43, twist ? .73 : .57);
  const rotation = twist ? (cycle(sidePhase(phase, 1), .54, .64) - cycle(sidePhase(phase, -1), .54, .64)) * .53 * depth : 0;
  const angle = 2.026 - .847 * depth;
  const position = [0, .606 + .014 * depth, .140 - .028 * depth];
  const pose = body(position, angle, 0, rotation);
  // The twist belongs to the rib cage, while the hips and contact points stay put.
  pose.lh = [position[0] + .103, position[1], position[2]];
  pose.rh = [position[0] - .103, position[1], position[2]];
  pose.ballCenter = [0, ballRadius, -.036];
  rearFeet(pose, wall ? .133 : .137, wall ? (straightLeg ? -.621 : -.607) : -.551, .154, straightLeg ? -.04 : .46);
  if (overhead) {
    for (const [side, sign] of sides) {
      const path = add(scale(pose.up, .603), scale(pose.right, sign * .043));
      hand(pose, side, add(pose[side + "s"], path), [sign * .32, .37, -.18], pose.up);
    }
  } else if (head) {
    handsBehindHead(pose);
  } else {
    crossChest(pose);
  }
  return pose;
}

function crunch(phase, { overhead = false, head = false, full = false } = {}) {
  const amount = cycle(phase, .43, .56);
  const minimum = full ? -1.96 : -1.55;
  const maximum = full ? -.46 : -.86;
  const angle = minimum + (maximum - minimum) * amount;
  const pose = body([0, .628 + .008 * amount, .259 + .024 * amount], angle);
  pose.ballCenter = [0, ballRadius, -.015 + .062 * amount];
  for (const [side, sign] of sides) foot(pose, side, sign, [sign * .191, floor, .744], [sign * .14, .69, .73]);
  if (overhead) {
    for (const [side, sign] of sides) {
      const path = add(scale(pose.up, .598), scale(pose.front, .042));
      hand(pose, side, add(pose[side + "s"], path), [sign * .35, .18, .61], pose.up);
    }
  } else if (head) {
    handsBehindHead(pose);
  } else {
    crossChest(pose);
  }
  return pose;
}

function ballPushUp(phase, { narrow = false } = {}) {
  const amount = cycle(phase);
  const ankle = [0, .141, -.996];
  const shoulderHeight = 1.028 - (narrow ? .377 : .391) * amount;
  const angle = Math.acos((shoulderHeight - ankle[1]) / 1.342);
  const hips = [0, ankle[1] + .835 * Math.cos(angle), ankle[2] + .835 * Math.sin(angle)];
  const pose = body(hips, angle);
  pose.ballCenter = [0, ballRadius, .201];
  rearFeet(pose, ankle[1], ankle[2], narrow ? .128 : .155, -.36);
  for (const [side, sign] of sides) {
    const x = sign * (narrow ? .092 : .153);
    const z = .153;
    const y = ballRadius + Math.sqrt(ballRadius ** 2 - x ** 2 - (z - pose.ballCenter[2]) ** 2) + .038;
    hand(pose, side, [x, y, z], [sign * (narrow ? .21 : .91), .12, -.76], [sign * -.12, -.085, .97]);
  }
  return pose;
}

function pikePushUp(phase) {
  const pike = ramp(phase, 0, .27) * (1 - ramp(phase, .78, 1));
  const dip = ramp(phase, .31, .53) * (1 - ramp(phase, .56, .77));
  const depth = -.692 + .381 * pike;
  const ankleY = .623 - .019 * pike;
  const ankleZ = depth - .110;
  const hipY = .566 + .520 * pike - .178 * dip;
  const hipZ = ankleZ + Math.sqrt(.833 ** 2 - (hipY - ankleY) ** 2);
  const pose = body([0, hipY, hipZ], 1.460 + 1.239 * pike + .336 * dip);
  pose.ballCenter = [0, ballRadius, depth];
  rearFeet(pose, ankleY, ankleZ, .131, -.39);
  for (const [side, sign] of sides) {
    hand(pose, side, [sign * .205, .076, .570], [sign * .72, -.03, -.83], [sign * .15, -.021, .96]);
  }
  return pose;
}

function dip(phase) {
  const count = cycle(phase);
  const pose = body([0, .557 - .257 * count, .193 + .079 * count], .053 + .099 * count);
  pose.ballCenter = [0, ballRadius, -.123];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .158, floor, .613], [sign * .12, .43, .87]);
    hand(pose, side, [sign * .175, .513, -.057], [sign * .39, .08, -.92], [sign * .04, -.20, .97]);
  }
  return pose;
}

function seatedStretch(phase, { triceps = false } = {}) {
  const pulse = cycle(phase, .34, .64);
  const pelvis = [0, .661, .039];
  const pose = body(pelvis, .042);
  pose.ballCenter = [0, ballRadius, .016];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .206, floor, .390], [sign * .11, .10, .97]);
  }
  if (!triceps) {
    const angle = .397 * pulse;
    for (const key of ["ls", "rs", "head", "neck", "chest"]) {
      const [x, y, z] = pose[key];
      pose[key] = [x * Math.cos(angle) - (y - pelvis[1]) * Math.sin(angle),
        pelvis[1] + x * Math.sin(angle) + (y - pelvis[1]) * Math.cos(angle), z];
    }
  }
  const direction = triceps ? [0, Math.cos(.13 + 1.88 * pulse), -Math.sin(.13 + 1.88 * pulse)] : [.017 - .222 * pulse, .96, .025];
  const elbow = add(pose.ls, triceps ? [-.074, .233, .043] : [-.035, .246, .029]);
  pose.le = elbow;
  pose.lw = add(elbow, scale(direction, .366));
  pose.lGrip = triceps ? [0, Math.sin(.13 + 1.88 * pulse), Math.cos(.13 + 1.88 * pulse)] : [0, 0, 1];
  pose.dumbbells.push({ center: pose.lw, axis: pose.lGrip });
  if (triceps) {
    hand(pose, "r", add(blend(pose.le, pose.ls, .31), [-.036, .027, .086]), [-.83, .51, .37], [1, 0, -.33]);
  } else {
    inactive(pose, "r", -1, "thigh");
  }
  return pose;
}

function seatedBallStretch(phase, { hug = false } = {}) {
  const amount = cycle(phase, .37, .66);
  const tilt = hug ? -.040 - .343 * amount : .015;
  const pose = body([0, .658, .036 - (hug ? .044 * amount : 0)], tilt);
  pose.ballCenter = [0, .285, .008 - (hug ? .027 * amount : 0)];
  const ball = hug
    ? add(add(pose.chest, scale(pose.front, .299)), [0, .009, 0])
    : [0, 1.097 - .055 * amount, .555 - .277 * amount];
  pose.secondaryBallCenter = ball;
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .197, floor, .376], [sign * .11, .04, .97]);
    const grip = add(ball, hug ? [sign * .121, -.041, .152] : [sign * .142, -.018, .057]);
    hand(pose, side, grip, [sign * .87, -.30, .33], [-sign * .45, .14, .88]);
  }
  return pose;
}

function hipFlexor(phase) {
  const t = cycle(phase, .28, .70);
  const pose = body([-.035, .646 - .039 * t, -.152 + .144 * t], .068 + .163 * t);
  pose.ballCenter = [.146, ballRadius, .432];
  delete pose.planted.l;
  foot(pose, "l", 1, [.177, .606, .359], [.33, .94, .15], [.022, -.037, .146]);
  foot(pose, "r", -1, [-.208, .127, -.694], [-.12, -.75, .44], [-.021, -.114, -.089]);
  delete pose.planted.r;
  for (const [side, sign] of sides) inactive(pose, side, sign, "thigh");
  return pose;
}

function sideLatStretch(phase) {
  const reach = cycle(phase, .28, .72);
  const pose = body([0, .222, .150], -1.165 + .063 * reach, 0, Math.PI / 2 - .191 * reach);
  pose.ballCenter = [0, ballRadius, -.490];
  delete pose.planted.l;
  delete pose.planted.r;
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [0, .101 + (sign + 1) * .028, .936], [.95, .14, .24], [.10, -.035, .035]);
  }
  hand(pose, "r", [-.102, .533, -.467], [-.82, -.09, -.34], [.22, .20, -.95]);
  const start = [.095, .036, -.128];
  const finish = [-.031, .289, -.548];
  hand(pose, "l", add(pose.ls, blend(start, finish, reach)), [-.37, .92, -.27], [0, .35, -.94]);
  return pose;
}

function proneLegs(phase, { rotate = false } = {}) {
  const pose = body([0, rotate ? .635 : .174, rotate ? .037 : .032], rotate ? 2.023 : 1.562);
  pose.ballCenter = [0, ballRadius, rotate ? -.062 : -.661];
  for (const [side, sign] of sides) {
    const t = rotate ? sidePhase(phase, sign) : phase;
    const lift = cycle(t, .32, .65);
    const turn = rotate ? cycle(t, .54, .59) : 0;
    const ankleY = rotate ? .130 + lift * .44 : .619 + lift * .221;
    const ankleZ = (rotate ? -.608 : -.681) + (rotate ? .118 * turn : .088 * lift);
    foot(pose, side, sign, [sign * (.112 + .29 * turn), ankleY, ankleZ], [sign * .20, -.74, -.19],
      [sign * (.02 + .066 * turn), -.093, -.107]);
    delete pose.planted[side];
    hand(pose, side, [sign * .237, .073, rotate ? .577 : .514], [sign * .68, -.10, -.73], [sign * .10, -.06, .97]);
  }
  return pose;
}

function diagonalCurl(phase) {
  const pose = body([0, .425 + .011 * Math.sin(phase * Math.PI * 4), .030], -2.083);
  pose.ballCenter = [0, ballRadius, .800];
  for (const [side, sign] of sides) {
    const local = sidePhase(phase, sign);
    const kneeBend = cycle(local, .28, .47) * (1 - ramp(local, .48, .65));
    const kick = ramp(local, .32, .66) * (1 - ramp(local, .74, 1));
    foot(pose, side, sign, [sign * (.128 - .402 * kick), .603 + .203 * kneeBend + .207 * kick,
      .744 - .327 * kneeBend + .005 * kick], [sign * .08, .98, -.21], [sign * .014, .041, .146]);
    delete pose.planted[side];
    hand(pose, side, [sign * .508, .066, -.118], [sign * .33, .08, -.41], [sign * .84, .01, .44]);
  }
  return pose;
}

const clips = [
  ["1338", seatedBallStretch, { hug: true, second: "stability-ball-hug" }, ["core"], [60, 14, [0,.85,.18], 1.90], 4500],
  ["1716", seatedBallStretch, { second: "stability-ball-chest-stretch" }, ["pec"], [56, 13, [0,.84,.24], 1.87], 4350],
  ["1314", backExtension, { wall: true }, ["core", "glute"], [65, 15, [0,.64,.02], 1.75]],
  ["1333", backExtension, { wall: true, overhead: true }, ["core", "glute"], [59, 14, [0,.74,.16], 1.93]],
  ["1334", backExtension, { wall: true, head: true }, ["core", "glute"], [59, 14, [0,.67,.07], 1.76]],
  ["1335", backExtension, { wall: true, straightLeg: true }, ["core", "glute", "hamstring"], [73, 14, [0,.65,.05], 1.74]],
  ["1336", backExtension, { twist: 1, head: true }, ["core", "glute"], [51, 15, [0,.64,.12], 1.62], 5200],
  ["1707", backExtension, { twist: 1 }, ["core"], [47, 15, [0,.64,.08], 1.64], 5200],
  ["0271", crunch, {}, ["core"], [59, 15, [0,.62,.22], 1.50]],
  ["0272", crunch, { overhead: true }, ["core"], [66, 14, [0,.71,.03], 1.80]],
  ["2297", crunch, { head: true, full: true }, ["core"], [58, 15, [0,.66,.16], 1.60]],
  ["0655", ballPushUp, {}, ["pec", "triceps", "core"], [58, 15, [0,.59,-.28], 1.66]],
  ["0656", ballPushUp, {}, ["pec", "triceps", "core"], [43, 17, [0,.59,-.28], 1.66]],
  ["2328", ballPushUp, { narrow: true }, ["triceps", "pec", "core"], [68, 15, [0,.60,-.29], 1.68]],
  ["1296", pikePushUp, {}, ["shoulder", "triceps", "core"], [65, 14, [0,.68,-.05], 1.80], 4800],
  ["1744", dip, {}, ["triceps"], [62, 15, [0,.65,.28], 1.64]],
  ["1339", seatedStretch, { bell: true }, ["l:lat"], [19, 13, [0,.96,.15], 2.20], 4300],
  ["1745", seatedStretch, { bell: true, triceps: true }, ["l:triceps"], [59, 14, [0,.96,.16], 2.15], 4300],
  ["1559", hipFlexor, {}, ["l:quad", "r:glute"], [62, 16, [0,.69,.11], 1.82], 4200],
  ["1342", sideLatStretch, {}, ["l:lat"], [59, 22, [0,.43,.17], 1.40], 4500],
  ["1416", proneLegs, { rotate: true }, ["glute", "core"], [123, 16, [0,.51,-.07], 1.56], 5400],
  ["1343", proneLegs, {}, ["glute", "hamstring"], [67, 18, [0,.43,-.31], 1.39]],
  ["1417", diagonalCurl, {}, ["hamstring", "glute"], [69, 18, [0,.55,.30], 1.62], 5200],
];

const [directory, ...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const jobs = requested.length ? clips.filter(([id]) => requested.includes(id)) : clips;
if (!jobs.length || (requested.length && jobs.length !== requested.length)) {
  throw new Error("Invalid or duplicate catalogue IDs.");
}
const out = resolve(directory);
await mkdir(out, { recursive: true, mode: 0o700 });
const items = [];
for (const [id, motion, options, muscles, camera, durationMs = 3700] of jobs) {
  const [yaw, elevation, focus, height] = camera;
  const equipment = options.second ?? (options.wall ? "stability-ball-wall" : options.bell ? "stability-ball-dumbbell" : "stability-ball");
  const data = {
    version: 1, durationMs, equipment, muscles, camera: { yaw, elevation, focus, height },
    keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...motion(index / 64, options) })),
  };
  try {
    prepareRecipe(data);
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause: error });
  }
  const recipe = id + ".json";
  await writeFile(join(out, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt: options.rotate || options.twist ? .31 : .47 });
}
await writeFile(join(out, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "Spotter stability-ball recipes.");
