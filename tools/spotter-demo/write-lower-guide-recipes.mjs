import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const ankle = .075;
const stepTop = .124;
const rad = Math.PI / 180;
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const scale = (a, amount) => a.map((value) => value * amount);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const unit = (a) => scale(a, 1 / Math.max(.00001, Math.hypot(...a)));
const mix = (a, b, weight) => a + (b - a) * weight;
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
function ramp(phase, start, end) {
  const weight = clamp((phase - start) / (end - start), 0, 1);
  return weight ** 2 * (3 - 2 * weight);
}
const rep = (phase) => ramp(phase, 0, .48) * (1 - ramp(phase, .56, 1));

function joint(origin, target, pole, first, second) {
  const offset = subtract(target, origin);
  const forward = unit(offset);
  const length = clamp(Math.hypot(...offset), Math.abs(first - second) + .005, first + second - .003);
  const along = (first ** 2 + length ** 2 - second ** 2) / (2 * length);
  const bend = unit(subtract(pole, scale(forward, dot(forward, pole))));
  return [add(add(origin, scale(forward, along)), scale(bend, Math.sqrt(first ** 2 - along ** 2))),
    add(origin, scale(forward, length))];
}

function body(hips, lean) {
  const spine = [0, Math.cos(lean), Math.sin(lean)];
  const at = (height, x = 0) => add(hips, add(scale(spine, height), [x, 0, 0]));
  return { hips, chest: at(.366), neck: at(.605), head: add(at(.715), [0, 0, .012]),
    ls: at(.505, .192), rs: at(.505, -.192), lh: at(0, .101), rh: at(0, -.101),
    planted: { l: 0, r: 0 }, dumbbells: [] };
}

function foot(pose, side, sign, target, options = {}) {
  const { out = .018, lift = 0, reach = .145 } = options;
  [pose[side + "k"], pose[side + "a"]] = joint(pose[side + "h"], target, [sign * (.13 + out), .025, .97], .422, .424);
  pose[side + "t"] = add(pose[side + "a"], [sign * out, -.071 + lift, reach]);
}

function arm(pose, side, hand, pole, grip) {
  [pose[side + "e"], pose[side + "w"]] = joint(pose[side + "s"], hand, pole, .252, .371);
  if (grip) pose[side + "Grip"] = grip;
  return pose[side + "w"];
}

function longsArms(pose, weights, shift = 0) {
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const axis = [0, .02, 1];
    const hand = arm(pose, side, add(shoulder, [sign * .103, -.608, .004 + shift]), [sign * .43, -.1, -.92], weights ? axis : undefined);
    if (weights) pose.dumbbells.push({ center: hand, axis });
  }
}

function airSquat(phase) {
  const depth = rep(phase);
  const pose = body([0, mix(.895, .499, depth), mix(-.025, -.188, depth)], mix(.045, .38, depth));
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .186, ankle, .036], { out: .038 });
    arm(pose, side, add(pose[side + "s"], [sign * .015, mix(-.557, -.127, depth), mix(.032, .49, depth)]),
      [sign * .40, -.8, .20]);
  }
  return pose;
}

function cossack(phase) {
  const left = phase < .5;
  const depth = rep((phase * 2) % 1);
  const direction = left ? 1 : -1;
  const pose = body([direction * .278 * depth, mix(.783, .496, depth), mix(.014, -.063, depth)], mix(.015, .23, depth));
  for (const [side, sign] of sides) {
    const straight = sign !== direction;
    const lift = straight ? .151 * depth : 0;
    foot(pose, side, sign, [sign * .515, ankle, .050], { out: .035, lift, reach: .145 - lift * .30 });
    arm(pose, side, add(pose[side + "s"], [sign * mix(.08, .045, depth), mix(-.51, -.105, depth),
      mix(.04, .48, depth)]), [sign * .54, -.82, .09]);
    if (lift > .001) delete pose.planted[side];
  }
  return pose;
}

function sumo(phase) {
  const depth = rep(phase);
  const pose = body([0, mix(.819, .466, depth), mix(.01, -.124, depth)], mix(.035, .30, depth));
  const grip = [1, 0, 0];
  const center = [0, pose.ls[1] - .533, .203 + depth * .025];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .413, ankle, .045], { out: .084 });
    arm(pose, side, add(center, [sign * .058, 0, 0]), [sign * .77, -.45, -.26], grip);
  }
  pose.dumbbells.push({ center: scale(add(pose.lw, pose.rw), .5), axis: grip });
  return pose;
}

function splitSquat(phase, elevated) {
  const depth = rep(phase);
  const platform = elevated ? stepTop : 0;
  const frontZ = elevated ? .502 : .368;
  const pose = body([.022, mix(.811, elevated ? .519 : .491, depth), mix(.028, .105, depth)],
    mix(.042, .165, depth));
  foot(pose, "l", 1, [.135, ankle + platform, frontZ], { out: .030 });
  foot(pose, "r", -1, [-.142, .132, -.328], { lift: -.057, out: .025, reach: .128 });
  pose.planted.l = platform;
  longsArms(pose, true);
  return pose;
}

function curtsyLunge(phase) {
  const crossover = ramp(phase, 0, .23) * (1 - ramp(phase, .77, 1));
  const depth = ramp(phase, .16, .45) * (1 - ramp(phase, .51, .78));
  const swing = Math.sin(crossover * Math.PI);
  const pose = body([mix(0, -.105, depth), mix(.885, .557, depth), mix(.014, -.045, depth)], mix(.034, .21, depth));
  foot(pose, "r", -1, [-.163, ankle, .105], { out: .025 });
  const heel = ankle + .052 * crossover;
  foot(pose, "l", 1, [mix(.159, -.382, crossover), heel + .115 * swing, mix(.060, -.499, crossover)],
    { lift: ankle - heel, out: .012, reach: .133 });
  if (swing > .001) delete pose.planted.l;
  longsArms(pose, true);
  return pose;
}

function walkingLunge(phase) {
  const step = Math.floor(phase * 2);
  const progress = phase * 2 - step;
  const front = step % 2 ? "l" : "r";
  const depth = ramp(progress, 0, .38) * (1 - ramp(progress, .46, .69));
  const advance = ramp(progress, .63, 1);
  const lift = Math.sin(Math.PI * advance);
  const stride = .524;
  const z = step * stride - .246 + stride * advance + .070 * depth;
  const pose = body([0, .838 - .327 * depth + .015 * lift, z], .04 + depth * .08);
  pose.followZ = z;
  for (const [side, sign] of sides) {
    const leading = side === front;
    const heel = leading ? ankle : ankle + .051 * Math.sin(Math.PI * Math.min(1, progress + .11)) * (1 - advance);
    const footZ = leading ? step * stride : step * stride - stride + 2 * stride * advance;
    foot(pose, side, sign, [sign * .118, heel + (leading ? 0 : .106 * lift), footZ],
      { lift: ankle - heel, out: .018, reach: .139 });
    if (!leading && lift > .001) delete pose.planted[side];
  }
  longsArms(pose, true, .034 * depth);
  return pose;
}

function landmineSquat(phase) {
  const depth = rep(phase);
  const pose = body([0, mix(.881, .506, depth), mix(.028, -.081, depth)], mix(.06, .199, depth));
  const pivot = [0, .089, 1.383];
  const angle = mix(55, 38, depth) * rad;
  const axis = [0, Math.sin(angle), -Math.cos(angle)];
  const end = add(pivot, scale(axis, 1.565));
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .202, ankle, .027], { out: .048 });
    arm(pose, side, add(end, [sign * .048, 0, .015]), [sign * .60, -.75, -.14], axis);
  }
  pose.landmine = { pivot, end };
  return pose;
}

const jobs = [
  ["2569", "none", cossack, 6100, [25, 12, .899, .04, 2.00], .24],
  ["0881", "dumbbells", curtsyLunge, 4500, [40, 10, .894, -.06, 2.08], .46],
  ["2960", "dumbbells", (phase) => splitSquat(phase, false), 4200, [67, 13, .874, .03, 2.08], .46],
  ["2957", "step-dumbbells", (phase) => splitSquat(phase, true), 4200, [64, 13, .877, .07, 2.11], .46],
  ["5121", "dumbbell", sumo, 4100, [33, 12, .854, .04, 2.04], .45],
  ["4295", "dumbbells", walkingLunge, 4900, [64, 11, .892, .04, 2.08], .21],
  ["7626", "landmine", landmineSquat, 4550, [61, 16, .840, .39, 2.19], .46],
  ["1197", "none", airSquat, 3900, [57, 13, .889, -.03, 2.08], .47],
];
const [directory, ...ids] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const selected = ids.length ? jobs.filter(([id]) => ids.includes(id)) : jobs;
if (!selected.length || (ids.length && selected.length !== ids.length)) throw new Error("Invalid or repeated catalogue IDs.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });
const items = [];
for (const [id, equipment, pose, durationMs, [yaw, elevation, y, z, height], posterAt] of selected) {
  const data = { version: 1, durationMs, equipment, muscles: ["quad", "glute"],
    camera: { yaw, elevation, focus: [0, y, z], height },
    keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...pose(index / 64) })) };
  try { prepareRecipe(data); } catch (error) { throw new Error(id + ": " + error.message, { cause: error }); }
  const recipe = id + ".json";
  await writeFile(join(output, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt });
}
await writeFile(join(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "original Spotter lower-body recipes.");
