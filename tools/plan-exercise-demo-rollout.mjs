import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { parseArgs } from "node:util";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.includes("/cloudflare/features/exercises/")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { catalogueExerciseByExactName, catalogueExerciseById } = await import("../cloudflare/features/exercises/catalogue-identity.ts");
const { exerciseIdentityNameKey, parsePlanMove } = await import("../cloudflare/features/exercises/move-name.ts");

const cloudflare = new URL("../cloudflare/", import.meta.url);
const publicRoot = new URL("public/", cloudflare);
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));

function personalExercises(source) {
  const { training = [], records = [], plans = [], programs = [], library = [] } = source;
  const rows = [...training, ...records];
  const profiles = new Set(library.filter((row) => row.kind === "exercise" && row.item?.versionOf)
    .map(({ item }) => exerciseIdentityNameKey(item.name)));
  const savedPlans = [
    ...rows.filter(({ kind }) => kind === "plan").map(({ data }) => data),
    ...plans,
    ...programs.flatMap(({ sessions }) => sessions.map(({ plan }) => plan)),
    ...[...library, ...records].filter(({ kind }) => kind === "template").map(({ plan }) => plan),
  ];
  const references = savedPlans.flatMap(({ exercises }) => {
    if (!Array.isArray(exercises)) throw new Error("Malformed exercise list");
    return exercises;
  });
  return { profiles, references };
}

function resolvePersonal(catalogue, { name, catalogueId }, profiles) {
  if (typeof name !== "string" || !name.trim()) throw new Error("Missing exercise name");
  const key = exerciseIdentityNameKey(parsePlanMove(name, { preserveQualifiers: true }).name);
  if (profiles.has(key)) return { reason: "personal-variant" };
  const exactName = catalogueExerciseByExactName(catalogue, name);
  if (catalogueId !== undefined) {
    const explicit = typeof catalogueId === "string" && /^\d{4,6}$/.test(catalogueId)
      ? catalogueExerciseById(catalogue, catalogueId) : undefined;
    if (!explicit) return { reason: "unknown-id" };
    if (exactName && exactName.id !== explicit.id) return { reason: "conflicting-id" };
    return { id: explicit.id };
  }
  if (exactName) return { id: exactName.id };
  return { reason: exactName === null ? "ambiguous-name" : "unmatched-name" };
}

async function assetStatuses(manifest, catalogueIds) {
  return new Map(await Promise.all(Object.entries(manifest).map(async ([id, asset]) => {
    if (!catalogueIds.has(id) || asset !== "/open-gym/spotter-3d/" + id + ".mp4") {
      throw new Error("Invalid demo manifest entry");
    }
    const files = await Promise.all([asset, asset.replace(/\.mp4$/, ".jpg")].map(async (path) => {
      const info = await stat(new URL(path.slice(1), publicRoot)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
      });
      return Boolean(info?.isFile() && info.size);
    }));
    return [id, files.every(Boolean) ? { status: "ready", asset } : { status: "asset-missing" }];
  })));
}

async function buildReport(personalPath) {
  const [catalogue, official, manifest, source] = await Promise.all([
    readJSON(new URL("open-gym/index.json", publicRoot)),
    readJSON(new URL("../ios/SpotterHealth/Resources/official-training-templates.json", import.meta.url)),
    readJSON(new URL("features/exercises/spotter-demo-assets.json", cloudflare)),
    personalPath === undefined ? undefined : readJSON(personalPath),
  ]);
  const catalogueIds = new Set(catalogue.rows.map(({ id }) => id));
  const assets = await assetStatuses(manifest, catalogueIds);
  const officialReferences = official.templates.flatMap(({ days, schedule }) => {
    const trainingDays = schedule?.flatMap((week) => week.days) ?? days;
    return trainingDays.flatMap(({ exercises }) => exercises);
  });
  const officialIds = new Set(officialReferences.map(({ catalogueId }) => {
    if (!catalogueIds.has(catalogueId)) throw new Error("Unknown official template exercise ID");
    return catalogueId;
  }));
  const personalIds = new Set();
  const unresolved = new Map();
  let personalReferences = 0;
  if (source !== undefined) {
    if (!source || !["training", "records", "plans", "programs", "library"].some((key) => Array.isArray(source[key]))) {
      throw new Error("Expected an authorized plan inventory");
    }
    const { profiles, references } = personalExercises(source);
    personalReferences = references.length;
    for (const move of references) {
      const { id, reason } = resolvePersonal(catalogue, move, profiles);
      if (id) {
        personalIds.add(id);
      } else {
        const { name } = move;
        const catalogueId = typeof move.catalogueId === "string" ? move.catalogueId : undefined;
        const key = JSON.stringify([name, catalogueId, reason]);
        const item = unresolved.get(key) ?? { name, catalogueId, reason, references: 0 };
        item.references += 1;
        unresolved.set(key, item);
      }
    }
  }
  const summarize = (ids) => {
    const ready = [...ids].filter((id) => assets.get(id)?.status === "ready").length;
    return { uniqueCatalogueIds: ids.size, ready, remaining: ids.size - ready };
  };
  const queue = [];
  const queued = new Set();
  for (const [stage, ids] of [["personal", personalIds], ["official", officialIds], ["catalogue", catalogueIds]]) {
    for (const catalogueId of ids) {
      if (queued.has(catalogueId)) continue;
      queued.add(catalogueId);
      queue.push({ catalogueId, stage, ...(assets.get(catalogueId) ?? { status: "needs-original-demo" }) });
    }
  }
  return {
    version: 1,
    personal: {
      status: source === undefined ? "not-supplied" : "inventory-supplied",
      references: personalReferences, ...summarize(personalIds), unresolved: [...unresolved.values()],
    },
    official: { templates: official.templates.length, references: officialReferences.length, ...summarize(officialIds) },
    catalogue: summarize(catalogueIds),
    queue,
  };
}

const usage = "Usage: node tools/plan-exercise-demo-rollout.mjs --output <new private JSON path> [--personal <authorized local JSON>]";
try {
  const { values } = parseArgs({ options: { output: { type: "string" }, personal: { type: "string" }, help: { type: "boolean" } } });
  if (values.help || !values.output) {
    (values.help ? console.log : console.error)(usage);
    if (!values.help) process.exitCode = 1;
  } else {
    const report = await buildReport(values.personal);
    // The private report may contain a few unresolved names. Never print it or overwrite a file.
    await writeFile(values.output, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  }
} catch {
  console.error("Could not create the exercise demo inventory. Check the input format, asset manifest and new output path.");
  process.exitCode = 1;
}
