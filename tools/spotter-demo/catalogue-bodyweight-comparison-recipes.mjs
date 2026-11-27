import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { formGuideMotion } from "./bodyweight/form-guide.mjs";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });

const { catalogueDemo } = await import("../../cloudflare/features/exercises/catalogue-demo.ts");
const catalogue = new URL("../../cloudflare/public/open-gym/index.json", import.meta.url);
const { rows } = JSON.parse(await readFile(catalogue, "utf8"));
const byId = new Map(rows.map(row => [row.id, row]));
const configs = {
  3673: { mode: "front", yaw: 10, offset: .72, y: .99, height: 2.21 },
  3674: { mode: "side", yaw: 73, offset: .72, y: .99, height: 2.21 },
  2358: { mode: "forearm", yaw: 72, offset: 1.11, y: .40, height: 2.29 },
  2350: { mode: "start", yaw: 71, offset: 1.11, y: .51, height: 2.29 },
  2351: { mode: "end", yaw: 70, offset: 1.11, y: .51, height: 2.29 },
  4959: { mode: "lunge", yaw: 66, offset: .84, y: .95, height: 2.37 },
};
const [directory, ...requested] = process.argv.slice(2);
const ids = requested.length ? requested : Object.keys(configs);
if (!directory || ids.some(id => !configs[id])) throw new Error("Pass an output directory and optional form guide IDs.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });

const items = [];
for (const id of ids) {
  const entry = byId.get(id);
  const { illustration: guide } = catalogueDemo(entry);
  if (!guide?.frames || guide.partnerFrames?.length !== guide.frames.length) throw new Error(`Missing matched comparison guide ${id}.`);
  const { mode, yaw, offset, y, height } = configs[id];
  const move = formGuideMotion(guide, mode, yaw, offset);
  const data = {
    version: 1, equipment: "none", formComparison: true, muscles: [], durationMs: 6250,
    camera: { yaw, focus: [0, y, 0], height, elevation: mode === "front" || mode === "side" ? 9 : 14 },
    keyframes: Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...move(index / 64) })),
  };
  try {
    prepareRecipe(data);
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause: error });
  }
  const recipe = `${id}.json`;
  await writeFile(join(output, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt: .19 });
}
await writeFile(join(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "two-athlete form guides.");
