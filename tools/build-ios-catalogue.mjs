import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { deflateRawSync } from "node:zlib";
import sharp from "sharp";

// Node strips the pure catalogue modules directly. Resolve their existing extensionless imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.includes("/cloudflare/features/exercises/")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const root = new URL("../cloudflare/", import.meta.url);
const output = new URL("../ios/SpotterHealth/NativeCatalogueAssets/", import.meta.url);
const resource = new URL("public/open-gym/", root);
const index = JSON.parse(await readFile(new URL("index.json", resource), "utf8"));
const corrections = JSON.parse(await readFile(new URL("features/exercises/catalog-corrections.json", root), "utf8"));
const { catalogueAreas } = await import("../cloudflare/features/exercises/catalogue-areas.ts");
const { catalogFamilies, preferredFamilyForQuery, variantDetails } = await import("../cloudflare/features/exercises/catalog-families.ts");
const { catalogueSections, collapseCatalogueRows } = await import("../cloudflare/features/exercises/catalog-sections.ts");
const { catalogueCover, catalogueDemo, poseFrame } = await import("../cloudflare/features/exercises/catalogue-demo.ts");
const { guideClassifications } = await import("../cloudflare/features/exercises/custom-catalogue-classifications.ts");
const { groups, label, muscleNames, types } = await import("../cloudflare/features/exercises/labels.ts");
const { slowFrameMs } = await import("../cloudflare/features/exercises/motion-data.ts");
const { paintMotionFrame } = await import("../cloudflare/features/exercises/motion-drawing.ts");
const { canonicalMoveName } = await import("../cloudflare/features/exercises/move-name.ts");
const { normalizeSearch } = await import("../cloudflare/features/exercises/catalog-search.ts");

const families = catalogFamilies(index.rows);
const uniqueFamilies = [...new Set(families.values())];
const demos = new Map(index.rows.map((row) => [row.id, catalogueDemo(row)]));
const coverSources = [...new Set([...demos.values()].map(catalogueCover).filter(Boolean))];
const rasters = new Array(coverSources.length);
const labels = [...new Set(index.rows.flatMap(({ part, equipment, target, type }) => [part, equipment, target, type]))];
const artwork = new Map();
let coverCursor = 0;

function coverInput(source) {
  const svgPrefix = "data:image/svg+xml,";
  return source.startsWith(svgPrefix)
    ? Buffer.from(decodeURIComponent(source.slice(svgPrefix.length)))
    : new URL("public" + source, root);
}

const demoWidth = 224;
const demoHeight = 126;
const demoBackground = "#314839";
const shardLimit = 16 * 1024 * 1024;

function frameSVG(viewBox, body) {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>');
}

async function animatedGIF(frames, delay) {
  const rasters = await Promise.all(frames.map((frame) => sharp(frame)
    .resize(demoWidth, demoHeight, { fit: "contain", background: demoBackground })
    .flatten({ background: demoBackground }).removeAlpha().raw().toBuffer()));
  const gif = await sharp(Buffer.concat(rasters), {
    raw: { width: demoWidth, height: demoHeight * frames.length, channels: 3, pageHeight: demoHeight },
  }).gif({
    delay: Array(frames.length).fill(delay), loop: 0, colours: 32, dither: 0, effort: 4, keepDuplicateFrames: true,
  }).toBuffer();
  if (frames.length < 2 || frames.length > 90 || frames.length * demoWidth * demoHeight > 9_000_000 || gif.length > 768 * 1024) {
    throw new Error("Exercise GIF exceeds the native decoder bounds.");
  }
  return gif;
}

async function flowGIF(id) {
  const data = JSON.parse(await readFile(new URL("flow/" + id + ".json", resource), "utf8"));
  const frames = data.sequence.map((index) => {
    const frame = data.frames[index];
    const paths = frame.paths.map((path) => '<path d="' + path + '"/>').join("");
    return frameSVG(data.viewBox, '<g fill="#f4f2ed" transform="' + frame.transform + '">' + paths + "</g>");
  });
  return animatedGIF(frames, slowFrameMs(data.ms));
}

async function poseGIF(slug) {
  const frames = await Promise.all(["01", "02", "03"].map((number) => readFile(coverInput(poseFrame(slug, number)))));
  return animatedGIF([...frames, frames[1]], 950);
}

function drawFrames(motion) {
  const step = motion.ms ?? (motion.duration ? motion.duration / motion.frames.length : 1450);
  const period = step * motion.frames.length;
  // Keep a full movement cycle at 12 fps while bounding long hold/recovery sequences.
  const duration = Math.min(3_600, Math.max(1_500, period));
  const frameCount = Math.round(duration * 12 / 1_000);
  const tenths = (value) => Math.round(value * 10) / 10;
  const rgb = (color) => Number.parseInt(color.slice(1), 16);
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const shapes = [];
    paintMotionFrame(motion, index * period / frameCount,
      (color, width, points) => shapes.push([rgb(color), width, ...points.flat().map(tenths)]),
      (color, radius, [x, y]) => shapes.push([rgb(color), -radius, tenths(x), tenths(y)]));
    return shapes;
  });
  // Apple's Compression framework expects raw DEFLATE for the ZLIB algorithm.
  return deflateRawSync(JSON.stringify({ ms: Math.round(duration / frames.length), frames }), { level: 9 });
}

function packMotion(keysByExercise, encoded) {
  const files = [[]];
  const ranges = new Map();
  let offset = 0;
  for (const [key, bytes] of encoded) {
    if (offset + bytes.length > shardLimit) {
      files.push([]);
      offset = 0;
    }
    ranges.set(key, [files.length - 1, offset, bytes.length]);
    files.at(-1).push(bytes);
    offset += bytes.length;
  }
  return {
    ranges: Object.fromEntries([...keysByExercise].map(([id, key]) => [id, ranges.get(key)])),
    shards: encoded.size ? files.map((chunks) => Buffer.concat(chunks)) : [],
  };
}

async function buildMotion() {
  const draws = new Map();
  const drawKeys = new Map();
  const gifs = new Map();
  const gifKeys = new Map();
  const referenceDrawings = [];
  for (const [exerciseID, demo] of demos) {
    // Match the existing website's exact-ID media selection and precedence.
    if (demo.video) continue;
    if (demo.id || demo.poseSlug) {
      const key = demo.id ? "flow/" + demo.id : "pose/" + demo.poseSlug;
      if (!gifs.has(key)) gifs.set(key, demo);
      gifKeys.set(exerciseID, key);
    } else if (demo.illustration) {
      const key = JSON.stringify(demo.illustration);
      if (!draws.has(key)) draws.set(key, drawFrames(demo.illustration));
      drawKeys.set(exerciseID, key);
      if (demo.illustration.reference) referenceDrawings.push(exerciseID);
    }
  }

  const sequences = [...gifs];
  const encoded = new Array(sequences.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < sequences.length) {
      const position = cursor++;
      const [key, demo] = sequences[position];
      encoded[position] = [key, await (demo.id ? flowGIF(demo.id) : poseGIF(demo.poseSlug))];
    }
  }));
  return { drawings: packMotion(drawKeys, draws), animations: packMotion(gifKeys, new Map(encoded)), referenceDrawings };
}

function videoAsset(path) {
  const prefix = "/open-gym/demo-video/";
  if (!path.startsWith(prefix) || !/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mp4$/.test(path.slice(prefix.length))) {
    throw new Error("Unexpected catalogue video path: " + path);
  }
  return ["video/" + path.slice(prefix.length), new URL("public" + path, root)];
}

// Render the same cover the website uses, once, rather than embed a browser in the App.
await Promise.all(Array.from({ length: 6 }, async () => {
  while (coverCursor < coverSources.length) {
    const position = coverCursor++;
    const input = coverInput(coverSources[position]);
    const bytes = input instanceof URL ? await readFile(input) : input;
    rasters[position] = await sharp(bytes)
      .resize(250, 150, { fit: "contain", background: "#314839" })
      .flatten({ background: "#314839" })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
  }
}));

let offset = 0;
for (const [position, source] of coverSources.entries()) {
  const length = rasters[position].length;
  artwork.set(source, [offset, length]);
  offset += length;
}

const preferred = uniqueFamilies
  .flatMap((family) => [family.title, ...(family.aliases ?? [])])
  .map(normalizeSearch)
  .flatMap((query) => {
    const family = preferredFamilyForQuery(query);
    return family ? [[query, family]] : [];
  });
const demonstrated = new Set([...demos.entries()]
  .filter(([, demo]) => Boolean(demo.id || demo.illustration || demo.poseSlug || demo.video))
  .map(([id]) => id));
const defaultOrder = [...index.rows].sort((a, b) => Number(demonstrated.has(b.id)) - Number(demonstrated.has(a.id)));
const defaultRows = collapseCatalogueRows(defaultOrder, families, new Map(), new Set(), demonstrated);
const variantMetadata = uniqueFamilies.map((family) => ({
  id: family.id,
  title: family.title,
  note: family.note,
  primary: family.primary.id,
  variants: family.variants.map((row) => {
    const { label, tip } = variantDetails(row, family);
    return { id: row.id, label, tip };
  }),
  aliases: [family.title, ...(family.aliases ?? [])].map(normalizeSearch),
}));
const detailShards = [...new Set(index.rows.map(({ id }) => Math.floor(Number(id) / 100)))];
const details = await Promise.all(detailShards.map((shard) => readFile(new URL("details/" + shard + ".json", resource))));
let detailOffset = 0;
const detailRanges = detailShards.map((shard, position) => {
  const length = details[position].length;
  const range = [detailOffset, length];
  detailOffset += length;
  return [shard, range];
});
const motion = await buildMotion();
const metadata = {
  areas: catalogueAreas,
  types,
  groups,
  labels: Object.fromEntries(labels.map((value) => [value, label(value)])),
  muscleLabels: muscleNames,
  sections: catalogueSections(index.rows).map(({ id, title, jumpLabel, rows }) => ({
    id, title, jumpLabel, equipment: [...new Set(rows.map((row) => row.equipment))],
  })),
  families: variantMetadata,
  preferredFamilies: Object.fromEntries(preferred),
  corrections: Object.fromEntries(Object.values(corrections).flatMap(({ aliases }) =>
    aliases.map((alias) => [alias.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "), canonicalMoveName(alias)]))),
  classifications: Object.fromEntries(Object.entries(guideClassifications).map(([name, details]) =>
    [normalizeSearch(canonicalMoveName(name)).replace(/\s+/g, ""), details])),
  covers: Object.fromEntries([...demos].flatMap(([id, demo]) => {
    const range = artwork.get(catalogueCover(demo));
    return range ? [[id, range]] : [];
  })),
  videos: Object.fromEntries([...demos].flatMap(([id, demo]) => demo.video ? [[id, demo.video]] : [])),
  animations: motion.animations.ranges,
  drawings: motion.drawings.ranges,
  referenceDrawings: motion.referenceDrawings,
  details: Object.fromEntries(detailRanges),
};

await mkdir(output, { recursive: true });
const mediaFiles = new Map([
  ...motion.animations.shards.map((bytes, index) => ["motion-" + index + ".bin", bytes]),
  ...motion.drawings.shards.map((bytes, index) => ["drawing-" + index + ".bin", bytes]),
]);
await Promise.all([
  ...[...mediaFiles].map(([name, bytes]) => writeFile(new URL(name, output), bytes)),
  ...[...new Set(Object.values(metadata.videos))].map(videoAsset).map(async ([name, source]) => {
    const destination = new URL(name, output);
    await mkdir(new URL("./", destination), { recursive: true });
    await copyFile(source, destination);
  }),
]);
await Promise.all([
  writeFile(new URL("metadata.json", output), JSON.stringify(metadata)),
  writeFile(new URL("covers.bin", output), Buffer.concat(rasters, offset)),
  writeFile(new URL("details.bin", output), Buffer.concat(details, detailOffset)),
  ...["NOTICE.txt", "FLOW-ARTWORK-LICENSE.txt", "FLOW-NOTICE.txt"].map((file) =>
    copyFile(new URL(file, resource), new URL(file, output))),
  copyFile(new URL("workout-guide/attribution.json", resource), new URL("WORKOUT-GUIDE-ATTRIBUTION.json", output)),
  copyFile(new URL("demo-video/LICENSE.txt", resource), new URL("DEMO-VIDEO-LICENSE.txt", output)),
  copyFile(new URL("demo-video/wger/CREDITS.txt", resource), new URL("WGER-DEMO-CREDITS.txt", output)),
  writeFile(new URL("NATIVE-COVERS-NOTICE.txt", output),
    "Spotter iPhone catalogue thumbnails are proportionally resized and rasterized JPEGs of the existing web covers. iPhone exercise demos resize and rasterize Flow and Workout Guide frames into timed GIF sequences. Workout Guide frames by Bryl Lim and credited Everkinetic artwork retain CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). See WORKOUT-GUIDE-ATTRIBUTION.json for individual frame sources and credits. Bundled MP4s are copied unchanged from the Spotter repository; see DEMO-VIDEO-LICENSE.txt and WGER-DEMO-CREDITS.txt. Regenerate the bundle with node tools/build-ios-catalogue.mjs.\n"),
]);
await Promise.all((await readdir(output))
  .filter((name) => /^(?:motion|drawing)-\d+\.bin$/.test(name) && !mediaFiles.has(name))
  .map((name) => unlink(new URL(name, output))));
console.log(`Catalogue: ${index.rows.length} variants, ${defaultRows.length} grouped results, ${Object.keys(metadata.covers).length} illustrated entries.`);
console.log(`Offline demonstrations: ${Object.keys(metadata.drawings).length} drawings, ${Object.keys(metadata.animations).length} GIFs, ${Object.keys(metadata.videos).length} videos.`);
const barbell = catalogueSections(defaultRows).find(({ id }) => id === "barbell");
console.log("Barbell:", barbell?.rows.length, barbell?.rows.slice(0, 6).map(({ name }) => name).join(", "));
