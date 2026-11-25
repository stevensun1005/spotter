import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
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
const { catalogueCover, catalogueDemo } = await import("../cloudflare/features/exercises/catalogue-demo.ts");
const { guideClassifications } = await import("../cloudflare/features/exercises/custom-catalogue-classifications.ts");
const { groups, label, muscleNames, types } = await import("../cloudflare/features/exercises/labels.ts");
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
  details: Object.fromEntries(detailRanges),
};

await mkdir(output, { recursive: true });
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
    "Spotter iPhone catalogue thumbnails are proportionally resized and rasterized JPEGs of the existing web covers. See the included notice and attribution files for each upstream source and license. Regenerate the bundle from the repository with node tools/build-ios-catalogue.mjs.\n"),
]);
console.log(`Catalogue: ${index.rows.length} variants, ${defaultRows.length} grouped results, ${Object.keys(metadata.covers).length} illustrated entries.`);
const barbell = catalogueSections(defaultRows).find(({ id }) => id === "barbell");
console.log("Barbell:", barbell?.rows.length, barbell?.rows.slice(0, 6).map(({ name }) => name).join(", "));
