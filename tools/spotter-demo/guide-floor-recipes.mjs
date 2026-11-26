import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const add = (a, b) => a.map((n, index) => n + b[index]);
const subtract = (a, b) => a.map((n, index) => n - b[index]);
const scale = (a, factor) => a.map((n) => n * factor);
const dot = (a, b) => a.reduce((sum, n, index) => sum + n * b[index], 0);
const unit = (a) => scale(a, 1 / Math.hypot(...a));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
};
const ramp = (phase, start, end) => smooth((phase - start) / (end - start));
const rep = (phase, down = .45, up = .55) => ramp(phase, 0, down) * (1 - ramp(phase, up, 1));

function limb(root, goal, pole, a, b) {
  const ray = subtract(goal, root);
  const forward = unit(ray);
  const along = Math.max(Math.abs(a - b) + .003, Math.min(a + b - .003, Math.hypot(...ray)));
  const projection = (a * a - b * b + along * along) / (2 * along);
  const bend = unit(subtract(pole, scale(forward, dot(pole, forward))));
  return [add(add(root, scale(forward, projection)), scale(bend, Math.sqrt(a * a - projection * projection))),
    add(root, scale(forward, along))];
}

function torso(hips, angle, facing = 1, roll = 0) {
  const up = [0, Math.cos(angle), Math.sin(angle)];
  const front = [0, -facing * up[2], facing * up[1]];
  const side = add([facing * Math.cos(roll), 0, 0], scale(front, Math.sin(roll)));
  const at = (h, x = 0, f = 0) => add(add(hips, scale(up, h)), add(scale(side, x), scale(front, f)));
  return { hips, chest: at(.369, 0, .006), neck: at(.605), head: at(.716, 0, .014),
    ls: at(.502, .192, .004), rs: at(.502, -.192, .004),
    lh: add(hips, [.103 * facing, 0, 0]), rh: add(hips, [-.103 * facing, 0, 0]), planted: {} };
}

function arm(pose, side, goal, pole) {
  [pose[side + "e"], pose[side + "w"]] = limb(pose[side + "s"], goal, pole, .252, .371);
}

function leg(pose, side, goal, pole, toe) {
  [pose[side + "k"], pose[side + "a"]] = limb(pose[side + "h"], goal, pole, .422, .424);
  pose[side + "t"] = add(pose[side + "a"], toe);
}

function palm(pose, side, direction = -1) {
  pose[side + "Fingers"] = [0, -.022, direction];
  pose[side + "PalmSide"] = [direction, 0, 0];
}

function relaxed(pose, side, sign, grip = null) {
  arm(pose, side, grip ?? [sign * .286, .062, pose.hips[2] + .102], [sign * .64, -.66, -.24]);
  palm(pose, side, 1);
}

function pikePushUp(phase, height, steep) {
  const d = rep(phase, .51, .59);
  const elevated = height > .30;
  const z = elevated ? .98 : .624;
  const base = elevated ? .975 + steep * .021 : .785;
  const hipY = base - (elevated ? .107 : .088) * d;
  const footY = height + .095;
  const span = Math.sqrt(.844 ** 2 - (hipY - footY) ** 2);
  const hip = [.055, hipY, z - span];
  const angle = elevated ? mix(-2.43 + .055 * steep, -2.82 + .07 * steep, d)
    : mix(-2.25, -2.58, d);
  const pose = torso(hip, angle, -1);
  pose.headDrop = .013;
  for (const [side, sign] of sides) {
    const x = -sign;
    const palmZ = elevated ? -.220 + steep * .065 : z - 1.015;
    arm(pose, side, [.056 + x * .259, .043, palmZ], [x * .64, .28, .71]);
    palm(pose, side);
    leg(pose, side, [.064 + x * .105, footY, z], [x * .12, .65, .71], [x * .013, -.075, elevated ? -.054 : -.090]);
    pose.planted[side] = height;
  }
  return pose;
}

function legRaise(phase, bilateral) {
  const apex = bilateral ? 1.527 : 1.478;
  const a = mix(bilateral ? .179 : .108, apex, rep(phase, bilateral ? .42 : .53, .59));
  const pose = torso([0, .142, -.204], -Math.PI / 2);
  pose.headDrop = .025;
  for (const [side, sign] of sides) {
    const thigh = [0, Math.sin(a), Math.cos(a)];
    const shin = [0, Math.sin(a - .075), Math.cos(a - .075)];
    pose[side + "k"] = add(pose[side + "h"], add(scale(thigh, .420), [-sign * .040, 0, 0]));
    pose[side + "a"] = add(pose[side + "k"], add(scale(shin, .422), [-sign * .038, 0, 0]));
    pose[side + "t"] = add(pose[side + "a"], [sign * .019, .118 * Math.sin(a) - .058 * Math.cos(a), .118 * Math.cos(a) + .058 * Math.sin(a)]);
    relaxed(pose, side, sign);
  }
  return pose;
}

function frogPump(phase) {
  const lift = rep(phase, .42, .55);
  const hips = [0, mix(.140, .373, lift), mix(.003, -.023, lift)];
  const pose = torso(hips, mix(-Math.PI / 2, -1.994, lift));
  pose.neck = [0, .146, -.602];
  pose.head = [0, .152, -.716];
  pose.headDrop = .031;
  pose.ls = [.193, .152, -.498];
  pose.rs = [-.193, .152, -.498];
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .076, .108, .402], [sign * .94, .76, .02], [-sign * .091, -.059, .087]);
    relaxed(pose, side, sign, [sign * .353, .061, -.237]);
  }
  return pose;
}

function bicycle(phase) {
  const curl = Math.cos(phase * 2 * Math.PI);
  const hip = [0, .154, -.015];
  const pose = torso(hip, -1.027, 1, -.58 * curl);
  pose.headDrop = .036;
  for (const [side, sign] of sides) {
    const load = (1 + sign * curl) / 2;
    const knee = [sign * .118, mix(.208, .565, load), mix(.402, -.086, load)];
    const shin = mix(.207, -.382, load);
    pose[side + "k"] = knee;
    pose[side + "a"] = add(knee, [sign * .018, .420 * Math.sin(shin), .420 * Math.cos(shin)]);
    pose[side + "t"] = add(pose[side + "a"], [sign * .017, -.067, .123]);
    const grip = add(pose.head, [sign * .103, -.047, .086]);
    arm(pose, side, grip, [sign * mix(.12, .82, load), -.05, mix(.98, -.12, load)]);
    pose[side + "Fingers"] = [0, .17, -.99];
    pose[side + "PalmSide"] = [1, .13, 0];
  }
  return pose;
}

function vUp(phase) {
  const raise = rep(phase, .49, .57);
  const hips = [0, mix(.143, .106, raise), -.235];
  const pose = torso(hips, mix(-Math.PI / 2, .099, raise));
  const legAngle = mix(.080, 1.108, raise);
  pose.headDrop = (1 - raise) * .029;
  for (const [side, sign] of sides) {
    pose[side + "k"] = add(pose[side + "h"], [sign * .009, .422 * Math.sin(legAngle), .422 * Math.cos(legAngle)]);
    pose[side + "a"] = add(pose[side + "k"], [sign * .006, .424 * Math.sin(legAngle - .055), .424 * Math.cos(legAngle - .055)]);
    pose[side + "t"] = add(pose[side + "a"], [sign * .011, .125 * Math.sin(legAngle) - .058 * Math.cos(legAngle),
      .125 * Math.cos(legAngle) + .058 * Math.sin(legAngle)]);
    const hand = [sign * .151, mix(.094, pose[side + "a"][1] - .015, raise), mix(-1.199, pose[side + "a"][2] + .015, raise)];
    arm(pose, side, hand, [sign * .63, .63, -.35]);
    pose[side + "Fingers"] = [0, .07 + .59 * raise, -1 + 2 * raise];
    pose[side + "PalmSide"] = [1, 0, 0];
  }
  return pose;
}

function kneeRaise(phase) {
  const bend = rep(phase, .44, .55);
  const hips = [0, 1.054, .095];
  const pose = torso(hips, -.041);
  for (const [side, sign] of sides) {
    const thigh = mix(-.040, 1.92, bend);
    const shin = mix(.044, .42, bend);
    pose[side + "k"] = add(pose[side + "h"], [sign * .011, -.422 * Math.cos(thigh), .422 * Math.sin(thigh)]);
    pose[side + "a"] = add(pose[side + "k"], [0, -.424 * Math.cos(shin), .424 * Math.sin(shin)]);
    pose[side + "t"] = add(pose[side + "a"], [sign * .012, -.122, .090]);
    arm(pose, side, [sign * .303, 2.144, .097], [sign * .40, -.60, .69]);
    pose[side + "Grip"] = [1, 0, 0];
  }
  return pose;
}

function lSit(phase) {
  const hold = rep(phase, .295, .765);
  const hips = [0, mix(.115, .173, hold), -.260];
  const pose = torso(hips, mix(.095, .272, hold));
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .110, mix(.101, .195, hold), .580], [sign * .13, 1, -.08], [sign * .012, -.039, .140]);
    arm(pose, side, [sign * .243, .062, -.222], [sign * .53, .03, -.85]);
    palm(pose, side, 1);
  }
  return pose;
}

function mountainClimber(phase) {
  const sequence = (phase * 2) % 1;
  const pump = rep(sequence, .38, .48);
  const active = phase < .5 ? "l" : "r";
  const hips = [0, .547 + .013 * pump, .216 - .016 * pump];
  const pose = torso(hips, -1.511, -1);
  for (const [side, sign] of sides) {
    const x = -sign;
    const drive = side === active ? pump : 0;
    arm(pose, side, [x * .224, .063, -.286], [x * .52, .14, .76]);
    palm(pose, side);
    leg(pose, side, [x * .104, mix(.117, .221, drive), mix(.909, .105, drive)],
      [x * .12, -1, -.26], [x * .013, -.079, -.112]);
  }
  return pose;
}

function bearCrawl(phase) {
  const stride = .276, bodyZ = (.5 - phase) * stride;
  const bob = Math.cos(phase * 4 * Math.PI);
  const hips = [0, .506 + bob * .011, bodyZ];
  const pose = torso(hips, -1.516 + bob * .014, -1);
  const gait = (time, baseZ) => {
    const step = Math.floor(time);
    const t = time - step;
    const swing = Math.max(0, (t - .60) / .40);
    return [baseZ - (step + smooth(swing)) * stride, Math.sin(swing * Math.PI)];
  };
  for (const [index, [side, sign]] of sides.entries()) {
    const x = -sign;
    const [hand, handLift] = gait(phase + .5 * index, -.513 + .5 * index * stride + .12);
    const [foot, footLift] = gait(phase + .5 * (1 - index), .418 + .5 * (1 - index) * stride + .12);
    arm(pose, side, [x * .216, .058 + .112 * handLift, hand], [x * .18, .08, .87]);
    palm(pose, side);
    leg(pose, side, [x * .122, .109 + .107 * footLift, foot], [x * .13, -.94, -.41], [x * .011, -.081, -.091]);
    if (footLift < .002) pose.planted[side] = 0;
  }
  pose.followZ = bodyZ;
  return pose;
}

const jobs = [
  ["6599", "none", bearCrawl, ["core"], [66, 17, .546, -.07, 1.53], 4350, .29],
  ["6211", "mat", bicycle, ["core"], [62, 33, .42, -.05, 1.70], 3650, .44],
  ["3181", "mat", frogPump, ["glute"], [45, 29, .32, -.12, 1.53], 4450, .47],
  ["9819", "pull-up", kneeRaise, ["core"], [56, 15, 1.18, .02, 2.69], 4600, .47],
  ["1402", "mat", lSit, ["core", "quad"], [57, 16, .41, -.12, 1.52], 4650, .49],
  ["4808", "mat", (f) => legRaise(f, false), ["core"], [68, 17, .42, -.22, 1.65], 4700, .47],
  ["4975", "mat", (f) => legRaise(f, true), ["core"], [-65, 18, .45, -.23, 1.67], 4750, .48],
  ["5213", "mat", mountainClimber, ["core"], [60, 17, .48, .13, 1.64], 3750, .24],
  ["2921", "mat", (f) => pikePushUp(f, .024, 0), ["shoulder", "triceps"], [65, 17, .54, .04, 1.68], 4350, .49],
  ["2831", "bench", (f) => pikePushUp(f, .460, 0), ["shoulder", "triceps"], [68, 17, .59, .50, 1.72], 4450, .47],
  ["3383", "bench", (f) => pikePushUp(f, .460, 1), ["shoulder", "triceps"], [-63, 19, .57, .55, 1.72], 4600, .49],
  ["3622", "mat", vUp, ["core"], [63, 17, .445, -.22, 1.74], 4600, .48],
];

const [directory, ...ids] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const selected = ids.length ? jobs.filter(([id]) => ids.includes(id)) : jobs;
if (!selected.length || (ids.length && selected.length !== ids.length)) throw new Error("Invalid or duplicate catalogue ID.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });
const items = [];
for (const [id, equipment, pose, muscles, [yaw, elevation, y, z, height], durationMs, posterAt] of selected) {
  const camera = { yaw, elevation, focus: [0, y, z], height };
  const keyframes = Array.from({ length: 65 }, (_, i) => ({ at: i / 64, ...pose(i / 64) }));
  const data = { version: 1, equipment, muscles, camera, durationMs, keyframes };
  try { prepareRecipe(data); } catch (error) { throw new Error(id + ": " + error.message, { cause: error }); }
  const recipe = id + ".json";
  await writeFile(join(output, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt });
}
await writeFile(join(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "original Spotter floor and bodyweight demonstrations.");
