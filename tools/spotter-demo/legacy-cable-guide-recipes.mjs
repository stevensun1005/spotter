import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const crossbarAxis = [1, 0, 0];
const plus = (a, b) => a.map((value, index) => value + b[index]);
const minus = (a, b) => a.map((value, index) => value - b[index]);
const scale = (a, n) => a.map((value) => value * n);
const dot = (a, b) => a.reduce((product, value, index) => product + value * b[index], 0);
const normalize = (a) => scale(a, 1 / Math.hypot(...a));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const mix = (a, b, weight) => a + (b - a) * weight;

function ease(phase) {
  const progress = clamp(phase, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function repetition(phase, turningPoint = .43, returnStart = .58) {
  return ease(phase / turningPoint) * (1 - ease((phase - returnStart) / (1 - returnStart)));
}

function limb(root, destination, pole, proximal, distal) {
  const delta = minus(destination, root);
  const along = normalize(delta);
  const reach = clamp(Math.hypot(...delta), Math.abs(proximal - distal) + .003, proximal + distal - .003);
  const axialDistance = (proximal ** 2 + reach ** 2 - distal ** 2) / (2 * reach);
  const bend = normalize(minus(pole, scale(along, dot(pole, along))));
  return [
    plus(plus(root, scale(along, axialDistance)), scale(bend, Math.sqrt(proximal ** 2 - axialDistance ** 2))),
    plus(root, scale(along, reach)),
  ];
}

function body(hips, pitch) {
  const vertical = [0, Math.cos(pitch), Math.sin(pitch)];
  const forward = [0, -vertical[2], vertical[1]];
  const at = (height, x = 0, depth = 0) => plus(plus(hips, scale(vertical, height)), plus([x, 0, 0], scale(forward, depth)));
  return {
    hips, chest: at(.365, 0, .006), neck: at(.605), head: at(.717, 0, .012),
    lh: at(0, .103), rh: at(0, -.103), ls: at(.505, .192, .004), rs: at(.505, -.192, .004),
    planted: { l: 0, r: 0 },
  };
}

function arm(pose, side, hand, pole, grip) {
  [pose[side + "e"], pose[side + "w"]] = limb(pose[side + "s"], hand, pole, .252, .371);
  if (grip) pose[side + "Grip"] = grip;
}

function leg(pose, side, ankle, pole, toe) {
  [pose[side + "k"], pose[side + "a"]] = limb(pose[side + "h"], ankle, pole, .422, .424);
  pose[side + "t"] = plus(pose[side + "a"], toe);
}

function foot(pose, side, sign, ankle) {
  leg(pose, side, ankle, [sign * .10, .045, 1], [sign * .012, -.071, .148]);
}

function halfKneelingPallof(phase) {
  const extension = repetition(phase);
  const pose = body([.02, .486, -.036], .009);
  const grip = normalize([0, 1, .12]);
  const anchor = [-1.04, .867, .074];
  const center = [.012, .856, mix(.137, .500, extension)];
  pose.planted = { l: 0 };
  pose.lk = [.131, .459, .377];
  pose.la = [.139, .075, .440];
  pose.lt = [.153, .005, .588];
  pose.rk = [-.116, .072, .027];
  pose.ra = [-.123, .106, -.392];
  pose.rt = [-.125, .015, -.501];
  for (const [side, sign] of sides) {
    arm(pose, side, plus(center, scale(grip, sign * .048)), [sign * .87, -.57, -.10], grip);
  }
  pose.cables = [{ anchor, end: scale(plus(pose.lw, pose.rw), .5), grip }];
  return pose;
}

function pullThrough(phase) {
  const hinge = repetition(phase, .49, .56);
  const pose = body([0, mix(.897, .767, hinge), mix(.092, -.102, hinge)], mix(.015, .80, hinge));
  const anchor = [0, .180, -1.04];
  const handY = mix(.804, .637, hinge);
  const handZ = mix(.183, -.146, hinge);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .232, .075, .065]);
    arm(pose, side, [sign * .059, handY, handZ], [sign * .75, -.22, -.27]);
  }
  const midpoint = scale(plus(pose.lw, pose.rw), .5);
  const junction = plus(midpoint, scale(normalize(minus(anchor, midpoint)), .344));
  pose.cables = sides.map(([side]) => {
    const end = pose[side + "w"];
    const grip = normalize(minus(junction, end));
    pose[side + "Grip"] = grip;
    return { anchor, end, grip };
  });
  return pose;
}

function standingHipAbduction(phase) {
  const sweep = repetition(phase, .42, .60);
  const pose = body([-.030, .880, .019], .002);
  const angle = mix(.014, .581, sweep);
  const workingAnkle = plus(pose.lh, [.792 * Math.sin(angle), -.792 * Math.cos(angle), .013]);
  pose.planted = { r: 0 };
  leg(pose, "l", workingAnkle, [.025, .01, 1], [.015, -.068, .150]);
  foot(pose, "r", -1, [-.189, .075, .010]);
  arm(pose, "r", [-.510, 1.108, .288], [-.48, -.82, -.15], [0, 0, 1]);
  arm(pose, "l", [.306, .949, .213], [.86, -.43, -.34]);
  const shin = normalize(minus(pose.lk, pose.la));
  pose.cables = [{ anchor: [-.947, .169, -.008], end: plus(pose.la, scale(shin, .061)), grip: shin }];
  return pose;
}

function straightArmPulldown(phase) {
  const travel = repetition(phase, .46, .57);
  const pose = body([0, .875, -.104], .198);
  const angle = mix(2.033, .284, travel);
  const [,, shoulderZ] = pose.ls;
  const center = [0, pose.ls[1] - .590 * Math.cos(angle), shoulderZ + .590 * Math.sin(angle)];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .155, .075, -.068]);
    arm(pose, side, plus(center, [sign * .325, 0, 0]), [sign * .24, -.31, -.08], crossbarAxis);
  }
  pose.cables = [{ anchor: [0, 1.959, .985], end: scale(plus(pose.lw, pose.rw), .5), grip: crossbarAxis }];
  return pose;
}

const clips = [
  ["4193", "cable", halfKneelingPallof, ["core"], { yaw: 34, elevation: 13, focus: [-.47, .98, .04], height: 2.36 }],
  ["1206", "rope", pullThrough, ["glute", "core"], { yaw: 64, elevation: 12, focus: [0, 1.02, -.40], height: 2.30 }],
  ["11266", "cable-ankle", standingHipAbduction, ["l:glute"], { yaw: 24, elevation: 10, focus: [-.35, 1.02, .06], height: 2.31 }],
  ["6036", "cable-lat-bar", straightArmPulldown, ["lat", "triceps"], { yaw: 69, elevation: 13, focus: [0, 1.13, .31], height: 2.35 }],
  ["1067", "cable-lat-bar", straightArmPulldown, ["lat", "triceps"], { yaw: -127, elevation: 14, focus: [0, 1.13, .31], height: 2.35 }],
];

const [directory, ...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass the output directory and optional catalogue IDs.");
const jobs = requested.length ? clips.filter(([id]) => requested.includes(id)) : clips;
if (!jobs.length || (requested.length && jobs.length !== requested.length)) throw new Error("Invalid or duplicate catalogue IDs.");
const out = resolve(directory);
await mkdir(out, { recursive: true, mode: 0o700 });
const items = [];
for (const [id, equipment, pose, muscles, camera] of jobs) {
  const data = {
    version: 1, durationMs: 4200, equipment, muscles, camera,
    keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...pose(index / 64) })),
  };
  try {
    prepareRecipe(data);
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause: error });
  }
  const recipe = id + ".json";
  await writeFile(join(out, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt: .49 });
}
await writeFile(join(out, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "Spotter exercise recipes.");
