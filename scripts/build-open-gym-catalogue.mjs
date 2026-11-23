// SPDX-License-Identifier: AGPL-3.0-only
// Converts the separately distributed openGym catalogue to browser-readable shards.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const upstream = resolve(process.argv[2] ?? "");
const target = resolve(process.argv[3] ?? "public/open-gym");
const animationManifest = process.argv[4];
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const { EXDB, EXALIAS } = await import(pathToFileURL(join(upstream, "frontend/src/lib/exercises-data.js")).href);
const localized = await read(join(upstream, "catalogue/i18n/zh.json"));
const edited = await read(join(upstream, "frontend/src/lib/exercise-muscle-map.json"));
const animationIds = new Set(animationManifest ? await read(animationManifest) : []);
const catalog = [];
const shards = new Map();
const known = {
  abs: "abs", pectorals: "chest", biceps: "biceps", glutes: "gluteal", delts: "deltoids",
  "front delts": "front-delts", "side delts": "side-delts", "rear delts": "rear-delts", triceps: "triceps",
  "upper back": "upper-back", lats: "lats", calves: "calves", quads: "quadriceps", forearms: "forearm",
  hamstrings: "hamstring", spine: "lower-back", traps: "trapezius", adductors: "adductors",
  "serratus anterior": "serratus", abductors: "gluteal", "levator scapulae": "trapezius",
  shoulders: "deltoids", deltoids: "deltoids", "rear deltoids": "rear-delts", "rotator cuff": "rear-delts",
  quadriceps: "quadriceps", core: "abs", abdominals: "abs", "lower abs": "abs", chest: "chest",
  "upper chest": "chest", "hip flexors": "hip-flexors", "lower back": "lower-back",
  obliques: "obliques", groin: "adductors", "inner thighs": "adductors",
  "wrist flexors": "forearm", "wrist extensors": "forearm", "cardiovascular system": "cardiovascular system",
};
const slugs = new Set([...Object.values(known), "tibialis"]);
const slug = (s) => known[s] ?? (slugs.has(s) ? s : undefined);
const localizedName = (row) => localized[row.id]?.name ?? row.n;
const generic = { "front-delts": 1, "side-delts": .6, "rear-delts": .4 };

function muscles(entry, override) {
  const primary = override?.primaries ?? [entry.tg];
  const second = override?.secondaries ?? entry.sm ?? [];
  const weight = {};
  const add = (name, amount) => {
    const label = slug(name);
    if (!label) return;
    if (label === "deltoids") {
      for (const [head, factor] of Object.entries(generic)) weight[head] = Math.max(weight[head] ?? 0, factor * amount);
    } else {
      weight[label] = Math.max(weight[label] ?? 0, amount);
    }
  };
  for (const m of primary) add(m, 1);
  for (const m of [...second, ...(override?.primaries ? [] : [entry.mg])]) add(m, .4);
  for (const [m, value] of Object.entries(override?.muscleWeights ?? {})) {
    if (slug(m)) weight[slug(m)] = value;
  }
  return Object.fromEntries(Object.entries(weight).map(([key, value]) => [key, Math.round(value * 100)]).filter(([, value]) => value > 0));
}

for (const entry of EXDB) {
  if (!/^\d{4,6}$/.test(entry.id)) throw new Error("Unexpected exercise id: " + entry.id);
  const raw = await read(join(upstream, "catalogue/exercises", entry.id + ".json"));
  const zh = localized[entry.id];
  const override = edited[entry.id];
  const weights = muscles(entry, override);
  catalog.push({
    id: entry.id, name: localizedName(entry), en: entry.n, part: override?.bp ?? entry.bp, equipment: entry.eq,
    type: entry.cat, muscles: weights, target: entry.tg, animation: animationIds.has(entry.id) || undefined,
    hold: raw.hold || undefined, distance: raw.track === "distance" || undefined, needs: raw.needs, machine: raw.machineKind,
  });
  const segment = Math.floor(Number(entry.id) / 100);
  if (!shards.has(segment)) shards.set(segment, {});
  shards.get(segment)[entry.id] = {
    description: zh?.description || raw.description || "",
    steps: zh?.instructions?.length ? zh.instructions : raw.instructions ?? [],
    language: zh?.description && zh?.instructions?.length ? "zh" : undefined,
  };
}

await mkdir(join(target, "details"), { recursive: true });
await writeFile(join(target, "index.json"), JSON.stringify({ rows: catalog, variants: EXALIAS }));
await Promise.all([...shards].map(([id, data]) => writeFile(join(target, "details", id + ".json"), JSON.stringify(data))));
console.log(JSON.stringify({ exercises: catalog.length, variants: Object.keys(EXALIAS).length, details: shards.size, animations: catalog.filter(x=>x.animation).length }));
