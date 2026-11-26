import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const radians = Math.PI / 180;
const sides = [["l", 1], ["r", -1]];
const barAxis = [1, 0, 0];
const add = (a, b) => a.map((value, index) => value + b[index]);
const sub = (a, b) => a.map((value, index) => value - b[index]);
const scale = (a, factor) => a.map((value) => value * factor);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const unit = (a) => scale(a, 1 / Math.hypot(...a));
const mix = (a, b, phase) => a + (b - a) * phase;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = (value) => {
  const phase = clamp(value, 0, 1);
  return phase * phase * (3 - 2 * phase);
};
const ramp = (phase, from, to) => ease((phase - from) / (to - from));
const rep = (phase, down = .42, up = .56) => ramp(phase, 0, down) * (1 - ramp(phase, up, 1));

function limb(root, requested, pole, first, second) {
  const delta = sub(requested, root);
  const forward = unit(delta);
  const reach = clamp(Math.hypot(...delta), Math.abs(first - second) + .003, first + second - .003);
  const along = (first ** 2 + reach ** 2 - second ** 2) / (2 * reach);
  const perpendicular = unit(sub(pole, scale(forward, dot(pole, forward))));
  return [add(add(root, scale(forward, along)), scale(perpendicular, Math.sqrt(first ** 2 - along ** 2))),
    add(root, scale(forward, reach))];
}

function body(hips, angle, floor = false) {
  const up = [0, Math.cos(angle), Math.sin(angle)];
  const front = [0, -up[2], up[1]];
  const at = (height, x = 0, depth = 0) => add(add(hips, scale(up, height)), add([x, 0, 0], scale(front, depth)));
  return { hips, chest: at(.365, 0, .006), neck: at(.605), head: at(.717, 0, .012),
    lh: at(0, .103), rh: at(0, -.103), ls: at(.505, .192, .004), rs: at(.505, -.192, .004),
    planted: floor ? {} : { l: 0, r: 0 } };
}

function arm(pose, side, hand, pole, grip) {
  [pose[side + "e"], pose[side + "w"]] = limb(pose[side + "s"], hand, pole, .252, .371);
  if (grip) pose[side + "Grip"] = grip;
}

function leg(pose, side, ankle, pole, toe) {
  [pose[side + "k"], pose[side + "a"]] = limb(pose[side + "h"], ankle, pole, .422, .424);
  pose[side + "t"] = add(pose[side + "a"], toe);
}

function foot(pose, side, sign, ankle) {
  leg(pose, side, ankle, [sign * .10, .07, 1], [sign * .015, -.071, .145]);
}

function inclinePress(phase) {
  const depth = rep(phase, .52, .59);
  const pose = body([0, .566, .264], -47 * radians);
  const center = [0, mix(1.507, 1.071, depth), mix(-.081, -.020, depth)];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .274, .075, .644]);
    arm(pose, side, add(center, [sign * .365, 0, 0]), [sign * .89, -.37, .25], barAxis);
  }
  pose.barbell = { center, axis: barAxis };
  return pose;
}

function walkingLunge(phase) {
  const step = Math.floor(phase * 2);
  const progress = phase * 2 - step;
  const leading = step % 2 ? "l" : "r";
  const depth = ramp(progress, 0, .36) * (1 - ramp(progress, .42, .67));
  const shift = ramp(progress, .64, 1);
  const advance = step * .545;
  const rise = Math.sin(Math.PI * shift);
  const z = advance - .250 + .545 * shift + .092 * depth;
  const pose = body([(leading === "l" ? 1 : -1) * .015 * depth, .831 - .345 * depth + .012 * rise, z],
    .011 + .070 * depth, true);
  const center = [pose.hips[0], pose.ls[1] + .029, pose.ls[2] - .080];
  for (const [side, sign] of sides) {
    const lead = side === leading;
    const footZ = lead ? advance : advance - .545 + 1.09 * shift;
    const heel = lead ? .075 : .075 + .052 * ramp(progress, 0, .14) * (1 - shift);
    leg(pose, side, [sign * .122, heel + (lead ? 0 : .105 * rise), footZ],
      [sign * .08, .015, 1], [sign * .017, -heel + .005, .142 - .012 * (lead ? 0 : 1 - shift)]);
    if (lead || shift === 0 || shift === 1) pose.planted[side] = 0;
    arm(pose, side, add(center, [sign * .395, 0, 0]), [sign * .36, -.73, -.56], barAxis);
  }
  pose.barbell = { center, axis: barAxis };
  pose.followZ = z;
  return pose;
}

function hipAbduction(phase) {
  const travel = rep(phase, .42, .58);
  const pose = body([-.040, .874, .022], .022, true);
  const angle = mix(.035, .565, travel);
  const ankle = add(pose.lh, [.786 * Math.sin(angle), -.786 * Math.cos(angle), .154]);
  leg(pose, "l", ankle, [.10, .02, 1], [.014, -.066, .144]);
  foot(pose, "r", -1, [-.204, .075, .009]);
  pose.planted.r = 0;
  arm(pose, "r", [-.510, 1.108, .25], [-.76, -.54, -.20], [0, 0, 1]);
  arm(pose, "l", [.268, .923, .181], [.82, -.43, -.47]);
  const shin = unit(sub(pose.lk, pose.la));
  pose.cables = [{ anchor: [-.93, .178, .135], end: add(pose.la, scale(shin, .069)), grip: shin }];
  return pose;
}

function stabilityBallCurl(phase) {
  const bend = rep(phase, .45, .57);
  const hips = [0, mix(.334, .439, bend), mix(-.117, -.100, bend)];
  const pose = body(hips, -Math.PI / 2, true);
  pose.chest = [0, mix(.228, .252, bend), -.476];
  pose.neck = [0, .146, -.720];
  pose.head = [0, .159, -.835];
  pose.headDrop = .025;
  pose.ls = [.192, .153, -.638];
  pose.rs = [-.192, .153, -.638];
  const ballZ = mix(.655, .350, bend);
  pose.ballCenter = [0, .285, ballZ];
  for (const [side, sign] of sides) {
    const ankle = [sign * .104, .604, ballZ + .052];
    leg(pose, side, ankle, [0, 1, .067], [sign * .012, .084, .129]);
    arm(pose, side, [sign * .378, .060, -.289], [sign * .65, -.61, -.18]);
    pose[side + "Fingers"] = [sign * .18, -.031, .98];
    pose[side + "PalmSide"] = barAxis;
  }
  return pose;
}

function ezTriceps(phase) {
  const bend = rep(phase, .49, .58);
  const pose = body([.10, .574, 1.262], -Math.PI / 2);
  pose.neck[1] += .011;
  pose.headDrop = .027;
  const angle = mix(.092, 1.97, bend);
  const center = [.10, .824 + .371 * Math.cos(angle), .757 - .371 * Math.sin(angle)];
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [.10 + sign * .321, .075, 1.405]);
    pose[side + "e"] = [.10 + sign * .173, .824, .757];
    pose[side + "w"] = add(center, [sign * .173, 0, 0]);
    pose[side + "Grip"] = barAxis;
  }
  pose.barbell = { center, axis: barAxis };
  return pose;
}

function standingCurl(phase) {
  const angle = mix(.087, 1.73, rep(phase, .43, .57));
  const pose = body([-.016, .911, .040], .061, true);
  pose.planted.r = .055;
  foot(pose, "r", -1, [-.147, .129, .117]);
  pose.lk = [.114, .494, .049];
  pose.la = add(pose.lk, [0, -.420 * Math.cos(angle), -.420 * Math.sin(angle)]);
  pose.lt = add(pose.la, [.012, -.069 * Math.cos(angle) - .151 * Math.sin(angle),
    -.069 * Math.sin(angle) + .151 * Math.cos(angle)]);
  const padDistance = .079;
  pose.roller = add(pose.la, [0, .038 * Math.cos(angle) + padDistance * Math.sin(angle),
    .038 * Math.sin(angle) - padDistance * Math.cos(angle)]);
  for (const [side, sign] of sides) arm(pose, side, [sign * .35, 1.127, .235], [sign * .70, -.69, -.04], [0, 0, 1]);
  return pose;
}

function lyingLegRaise(phase) {
  const angle = mix(.144, 1.503, rep(phase, .45, .55));
  const pose = body([0, .154, -.230], -Math.PI / 2, true);
  pose.headDrop = .029;
  const thigh = [0, Math.sin(angle), Math.cos(angle)];
  const shin = [0, Math.sin(angle - .089), Math.cos(angle - .089)];
  for (const [side, sign] of sides) {
    pose[side + "k"] = add(pose[side + "h"], scale(thigh, .422));
    pose[side + "a"] = add(pose[side + "k"], scale(shin, .424));
    pose[side + "t"] = add(pose[side + "a"], [sign * .010, .112 * Math.sin(angle) - .051 * Math.cos(angle),
      .112 * Math.cos(angle) + .051 * Math.sin(angle)]);
    arm(pose, side, [sign * .112, .060, -.225], [sign * .87, -.47, -.022]);
    pose[side + "Fingers"] = [-sign * .96, -.10, .20];
    pose[side + "PalmSide"] = [0, 0, 1];
  }
  return pose;
}

function nordicCurl(phase) {
  const tilt = mix(.024, 1.425, rep(phase, .59, .67));
  const hips = [0, .087 + .422 * Math.cos(tilt), .146 + .422 * Math.sin(tilt)];
  const pose = body(hips, tilt, true);
  const catchReach = ramp(tilt, .77, 1.425);
  for (const [side, sign] of sides) {
    pose[side + "k"] = [sign * .103, .087, .146];
    pose[side + "a"] = [sign * .108, .097, -.278];
    pose[side + "t"] = [sign * .114, .031, -.410];
    const relaxed = add(pose[side + "s"], [sign * .053, -.36, .215]);
    const hands = [sign * .278, .068, 1.138];
    arm(pose, side, relaxed.map((value, index) => mix(value, hands[index], catchReach)), [sign * .77, -.095, -.55]);
    pose[side + "Fingers"] = [sign * .12, 0, 1];
    pose[side + "PalmSide"] = barAxis;
  }
  return pose;
}

function sitUp(phase, style = "crossed") {
  const travel = rep(phase, .43, .55);
  const peak = style === "partial" ? -Math.PI / 4 : style === "overhead" ? .040 : .410;
  const angle = mix(-Math.PI / 2, peak, travel);
  const pose = body([0, mix(.150, .111, travel), -.151], angle);
  pose.headDrop = (1 - travel) * .026;
  pose.neck = add(pose.neck, [0, .028 * travel, .035 * travel]);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .147, .099, .447]);
    pose.planted[side] = .024;
    if (style === "overhead") {
      const direction = [sign * .028, Math.cos(angle), Math.sin(angle)];
      pose[side + "e"] = add(pose[side + "s"], scale(direction, .251));
      pose[side + "w"] = add(pose[side + "s"], scale(direction, .611));
    } else if (style === "partial") {
      const hand = add(pose.head, [sign * .101, .012, -.028]);
      arm(pose, side, hand, [sign * .96, -.08, .17]);
    } else {
      arm(pose, side, add(pose.chest, [-sign * .100, .150 * (1 - travel), .073 + .075 * travel]),
        [sign * .97, -.062, .24]);
    }
  }
  return pose;
}

function heelTouches(phase) {
  const shift = Math.sin(phase * 2 * Math.PI);
  const contraction = Math.abs(shift);
  const pose = body([0, .154, .020], mix(-1.30, -1.16, contraction));
  for (const joint of ["chest", "neck", "head", "ls", "rs"]) {
    pose[joint][0] += shift * (joint === "head" ? .235 : .16);
    pose[joint][2] += contraction * .13;
  }
  for (const [side, sign] of sides) {
    const reach = Math.max(0, sign * shift);
    foot(pose, side, sign, [sign * .173, .098, .278]);
    pose.planted[side] = .024;
    const hand = [sign * (.247 - .053 * reach), .113 + .015 * reach, mix(.012, .230, reach)];
    arm(pose, side, hand, [sign * .86, -.14, .04]);
  }
  return pose;
}

function neckRoller(phase) {
  const travel = rep(phase, .45, .56);
  const pose = body([0, .889, .008], .005);
  const center = [.087, mix(1.456, 1.577, travel), -.123];
  const axis = unit([.86, .32, .38]);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .145, .075, .028]);
    arm(pose, side, add(center, scale(axis, sign * .235)), [sign * .88, -.23, -.08], axis);
  }
  pose.handRoller = { center, axis };
  return pose;
}

function widePullUp(phase) {
  const travel = rep(phase, .44, .58);
  const hips = [0, mix(1.119, 1.573, travel), mix(.080, -.064, travel)];
  const pose = body(hips, mix(0, -.044, travel), true);
  for (const [side, sign] of sides) {
    leg(pose, side, add(hips, [sign * .105, -.801, -.086]), [sign * .04, .11, 1], [sign * .014, -.108, .108]);
    arm(pose, side, [sign * .472, 2.144, .097], [sign * .67, -.64, -.32], barAxis);
  }
  return pose;
}

const standard = [
  ["0001", "mat", (phase) => sitUp(phase, "partial"), ["core"], [67, 16, .36, -.19, 1.50], .49],
  ["0006", "mat", heelTouches, ["core"], [35, 31, .31, -.23, 1.59], .24],
  ["0047", "incline-bench-barbell", inclinePress, ["pec", "triceps"], [62, 17, .946, .051, 2.24], .54],
  ["5823", "barbell", walkingLunge, ["quad", "glute"], [64, 12, .920, .038, 2.14], .20],
  ["3048", "cable-ankle", hipAbduction, ["l:glute"], [30, 9, 1.02, .035, 2.42], .48],
  ["5036", "stability-ball", stabilityBallCurl, [], [65, 17, .36, -.145, 1.47], .50],
  ["5873", "bench-ez-bar", ezTriceps, ["triceps"], [71, 19, .61, 1.03, 1.77], .53],
  ["4347", "standing-leg-curl", standingCurl, [], [-62, 13, .90, -.035, 2.16], .46],
  ["1163", "mat", lyingLegRaise, ["core"], [64, 16, .435, -.26, 1.56], .47],
  ["7746", "nordic-mat", nordicCurl, [], [71, 16, .62, .23, 1.90], .51],
  ["0736", "mat", sitUp, ["core"], [64, 17, .43, -.10, 1.52], .44],
  ["3204", "mat", (phase) => sitUp(phase, "overhead"), ["core"], [67, 16, .64, -.25, 1.92], .49],
  ["4222", "hand-roller", neckRoller, [], [-151, 16, 1.375, -.041, 1.03], .53],
  ["1429", "wide-pull-up", widePullUp, ["lat"], [37, 12, 1.17, -.02, 2.74], .50],
];

const [directory, ...requestedIds] = process.argv.slice(2);
if (!directory) throw new Error("Pass the output directory and optional catalogue IDs.");
const jobs = requestedIds.length ? standard.filter(([id]) => requestedIds.includes(id)) : standard;
if (!jobs.length || (requestedIds.length && jobs.length !== requestedIds.length)) throw new Error("Invalid or duplicate catalogue IDs.");
const out = resolve(directory);
await mkdir(out, { recursive: true, mode: 0o700 });
const items = [];
for (const [id, equipment, pose, muscles, [yaw, elevation, y, z, height], posterAt] of jobs) {
  const data = { version: 1, durationMs: id === "5823" ? 4800 : 4600, equipment, muscles,
    camera: { yaw, elevation, focus: [0, y, z], height },
    keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...pose(index / 64) })) };
  try { prepareRecipe(data); } catch (error) { throw new Error(id + ": " + error.message, { cause: error }); }
  const recipe = id + ".json";
  await writeFile(join(out, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt });
}
await writeFile(join(out, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "Spotter exercise recipes.");
