import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { registerHooks } from "node:module";

// Vite resolves extensionless imports in the shared TypeScript motion selector.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const source = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(source)) return next(source.href, context);
    }
    return next(specifier, context);
  },
});

const { catalogueDemo, catalogueCover } = await import("../features/exercises/catalogue-demo.ts");
const { paintMotionFrame } = await import("../features/exercises/motion-drawing.ts");

const reviewFile = new URL("./exercise-animation-reviews.json", import.meta.url);
const reviews = existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, "utf8")) : {};
const recordOption = process.argv.indexOf("--record-reviewed");
const reviewInput = recordOption < 0 ? undefined : process.argv[recordOption + 1];
if (recordOption >= 0 && (!reviewInput || reviewInput.startsWith("--"))) {
  throw new Error("Pass a JSON file containing the exact catalogue IDs reviewed visually.");
}
const reviewIds = new Set(reviewInput ? JSON.parse(readFileSync(resolvePath(reviewInput), "utf8")) : []);
const recording = {};

const assetRoot = new URL("../public/open-gym/", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, assetRoot), "utf8"));
const { rows, variants } = readJson("index.json");
const ids = new Set(rows.map(({ id }) => id));
const aliasIssues = Object.entries(variants).filter(([alias, id]) => ids.has(alias) || !ids.has(id));
const files = new Map();

function playableFile(path, check) {
  if (!files.has(path)) {
    const file = new URL(path, assetRoot);
    files.set(path, existsSync(file) && check(readFileSync(file)));
  }
  return files.get(path);
}

function sourceType(motion) {
  const clip = motion.video;
  if (clip && playableFile(clip.slice("/open-gym/".length), (bytes) => bytes.toString("ascii", 4, 8) === "ftyp")) return "video";

  if (motion.illustration && new Set(motion.illustration.frames.map((frame) => JSON.stringify(frame))).size > 1) return "illustration";

  if (motion.id && playableFile("flow/" + motion.id + ".json", (bytes) => {
    const { frames, sequence } = JSON.parse(bytes.toString("utf8"));
    return new Set(sequence.map((index) => JSON.stringify(frames[index])).filter(Boolean)).size > 1;
  })) return "flow";

  if (motion.poseSlug) {
    const frames = ["01", "02", "03"].map((index) => new URL("workout-guide/" + motion.poseSlug + "/" + index + ".svg", assetRoot));
    if (frames.every((url) => existsSync(url)) &&
        new Set(frames.map((url) => readFileSync(url, "utf8"))).size > 1) return "poses";
  }
}

const checkedCovers = new Map();
function matchingCover(type, motion) {
  const cover = catalogueCover(motion);
  if (!cover) return false;
  if (!checkedCovers.has(cover)) {
    let valid = false;
    if (type === "illustration") valid = cover.startsWith("data:image/svg+xml,");
    else if (cover.startsWith("/open-gym/")) {
      valid = playableFile(cover.slice("/open-gym/".length), (bytes) => {
        if (type === "video") return bytes[0] === 0xff && bytes[1] === 0xd8;
        if (type === "poses") return bytes.toString("utf8").startsWith("<svg");
        if (type === "flow") {
          const { frames, sequence } = readJson("flow/" + motion.id + ".json");
          const first = frames[sequence[0]];
          const svg = bytes.toString("utf8");
          return svg.includes(first.transform) && first.paths.every((path) => svg.includes(path));
        }
        return false;
      });
    }
    checkedCovers.set(cover, valid);
  }
  return checkedCovers.get(cover);
}

const digest = (value) => createHash("sha256").update(value).digest("hex");
const mediaDigests = new Map();
const illustrationDigests = new WeakMap();

function mediaFingerprint(type, motion) {
  if (type === "illustration") {
    const item = motion.illustration;
    if (!illustrationDigests.has(item)) {
      const drawings = [];
      const frameMs = item.ms ?? (item.duration ? item.duration / item.frames.length : 1450);
      for (let i = 0; i < item.frames.length * 2; i++) {
        paintMotionFrame(item, (i / 2) * frameMs, (...path) => drawings.push(path), (...circle) => drawings.push(circle));
      }
      illustrationDigests.set(item, digest(JSON.stringify([frameMs, drawings])));
    }
    return illustrationDigests.get(item);
  }
  const name = type === "flow" ? motion.id : type === "video" ? motion.video : motion.poseSlug;
  const key = type + ":" + name;
  if (!mediaDigests.has(key)) {
    const files = type === "flow" ? ["flow/" + name + ".json", "thumb/" + name + ".svg"]
      : type === "video" ? [name.slice("/open-gym/".length), name.slice("/open-gym/".length).replace(/\.mp4$/, ".jpg")]
      : ["01", "02", "03"].map((frame) => "workout-guide/" + name + "/" + frame + ".svg");
    mediaDigests.set(key, digest(files.map((file) => digest(readFileSync(new URL(file, assetRoot)))).join(":")));
  }
  return mediaDigests.get(key);
}

const total = { video: 0, illustration: 0, flow: 0, poses: 0 };
const missing = [];
const coverIssues = [];
const missingSteps = [];
const needsVisualReview = [];
let reviewed = 0;
const shards = new Map();
for (const row of rows) {
  const motion = catalogueDemo(row);
  const type = sourceType(motion);
  const entry = { id: row.id, name: row.name, en: row.en, equipment: row.equipment };
  const shard = Math.floor(Number(row.id) / 100);
  if (!shards.has(shard)) shards.set(shard, readJson("details/" + shard + ".json"));
  const detail = shards.get(shard)[row.id];
  const hasSteps = Boolean(detail?.steps.some((step) => step.trim()));
  if (!hasSteps) missingSteps.push(entry);
  if (!type) {
    missing.push(entry);
    continue;
  }
  total[type]++;
  const hasCover = matchingCover(type, motion);
  if (!hasCover) coverIssues.push(entry);
  if (hasCover && hasSteps && (reviews[row.id] || reviewIds.has(row.id))) {
    const fingerprint = digest(JSON.stringify([entry, type, mediaFingerprint(type, motion), detail]));
    if (reviewIds.has(row.id)) {
      recording[row.id] = fingerprint;
      reviewIds.delete(row.id);
    }
    if (reviews[row.id] === fingerprint || recording[row.id] === fingerprint) {
      reviewed++;
      continue;
    }
  }
  needsVisualReview.push(entry);
}
if (reviewIds.size) {
  throw new Error("These catalogue IDs are invalid, incomplete or missing assets: " + [...reviewIds].join(", "));
}
if (reviewInput) writeFileSync(reviewFile, JSON.stringify({ ...reviews, ...recording }, null, 2) + "\n");

const summary = { catalogue: rows.length, aliases: Object.keys(variants).length, aliasIssues: aliasIssues.length,
  playable: rows.length - missing.length, missing: missing.length,
  coverIssues: coverIssues.length, missingSteps: missingSteps.length, reviewed, needsVisualReview: needsVisualReview.length, ...total };
if (process.argv.includes("--list-missing")) Object.assign(summary, { missingRows: missing, coverIssueRows: coverIssues,
  missingStepRows: missingSteps, aliasIssueRows: aliasIssues });
if (process.argv.includes("--list-unreviewed")) Object.assign(summary, { unreviewedRows: needsVisualReview });
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes("--require-complete") && (aliasIssues.length || missing.length || coverIssues.length || missingSteps.length || needsVisualReview.length)) process.exitCode = 1;
