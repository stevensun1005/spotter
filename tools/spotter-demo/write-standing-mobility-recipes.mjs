import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const add = (a, b) => a.map((value, index) => value + b[index]);
const scale = (point, amount) => point.map((value) => value * amount);

function standing(hipY, hipZ, pitch) {
  const up = [0, Math.cos(pitch), Math.sin(pitch)];
  const hips = [0, hipY, hipZ];
  const joint = (x, height) => add(add(hips, [x, 0, 0]), scale(up, height));
  return { hips, chest: joint(0, .385), neck: joint(0, .606), head: joint(0, .723),
    ls: joint(.193, .509), rs: joint(-.193, .509), lh: joint(.104, 0), rh: joint(-.104, 0),
    planted: { l: 0, r: 0 } };
}

function feet(pose, kneeBend) {
  for (const [side, sign] of sides) {
    pose[side + "k"] = [sign * .139, .469, .026 + kneeBend];
    pose[side + "a"] = [sign * .138, .073, .044];
    pose[side + "t"] = [sign * .161, .009, .198];
  }
}

function armCircles(at) {
  const pose = standing(.873, .017, 0);
  feet(pose, .008);
  const radius = .145 + .082 * Math.sin(Math.PI * at) ** 2;
  const phase = 4 * Math.PI * at;
  const lateralReach = Math.sqrt(1 - (radius / .614) ** 2);
  for (const [side, sign] of sides) {
    const direction = [sign * lateralReach, (radius / .614) * Math.sin(phase), (radius / .614) * Math.cos(phase)];
    pose[side + "e"] = add(pose[side + "s"], scale(direction, .251));
    pose[side + "w"] = add(pose[side + "s"], scale(direction, .614));
  }
  return pose;
}

function toeTouch(at) {
  const depth = (1 - Math.cos(2 * Math.PI * at)) / 2;
  const pose = standing(.873 - .075 * depth, .017 - .155 * depth, depth * 1.69);
  feet(pose, .053 * depth);
  const reach = (at < .5 ? at / .5 : (1 - at) / .5);
  const angle = Math.PI * reach * (1.7 - .7 * reach);
  const direction = [0, Math.cos(angle), Math.sin(angle)];
  for (const [side, sign] of sides) {
    pose[side + "e"] = add(pose[side + "s"], [sign * .012, direction[1] * .249, direction[2] * .249]);
    pose[side + "w"] = add(pose[side + "e"], [-sign * .020, direction[1] * .365, direction[2] * .365]);
  }
  return pose;
}

const [directory] = process.argv.slice(2);
if (!directory) throw new Error("Pass the output directory for the mobility recipes.");
const output = resolve(directory);
await mkdir(output, { recursive: true });
const items = [];
for (const [id, pose, muscles, camera, posterAt] of [
  ["3905", armCircles, ["shoulder"], { yaw: 30, elevation: 9, focus: [0, .90, 0], height: 2.04 }, .34],
  ["3248", toeTouch, ["core"], { yaw: 63, elevation: 14, focus: [0, 1.06, .05], height: 2.39 }, .46],
]) {
  const recipe = {
    version: 1, durationMs: id === "3905" ? 3400 : 4400, equipment: "none", muscles, camera,
    keyframes: Array.from({ length: 49 }, (_, index) => {
      const at = index / 48;
      return { at, ...pose(at) };
    }),
  };
  prepareRecipe(recipe);
  const file = id + ".json";
  await writeFile(resolve(output, file), JSON.stringify(recipe) + "\n");
  items.push({ id, recipe: file, posterAt });
}
await writeFile(resolve(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
