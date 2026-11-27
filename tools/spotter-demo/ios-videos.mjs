import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const encoder = new URL("compress-ios.swift", import.meta.url);
const receipts = new URL("ios-video-fingerprints.json", import.meta.url);
const work = fileURLToPath(new URL("../../work/", import.meta.url));
const settings = ["512", "288", "130000", "hevc"];

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fingerprint = (source, video) => digest(source + ":" + digest(video));

async function readIfPresent(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function buildIOSVideos(files, output) {
  const profile = digest(Buffer.concat([await readFile(encoder), Buffer.from(JSON.stringify(settings))]));
  const saved = await readIfPresent(receipts);
  const previous = saved ? JSON.parse(saved) : {};
  const updated = {};
  const pending = [];
  let originalBytes = 0;
  let offlineBytes = 0;

  for (const [name, source] of files) {
    const id = basename(name, ".mp4");
    const destination = new URL(name, output);
    const original = await readFile(source);
    const sourceHash = digest(original);
    originalBytes += original.length;

    const known = previous.profile === profile && previous.videos?.[id];
    const existing = known && await readIfPresent(destination);
    if (existing && fingerprint(sourceHash, existing) === known) {
      updated[id] = known;
      offlineBytes += existing.length;
      continue;
    }
    pending.push({ id, source: fileURLToPath(source), destination, sourceHash });
  }

  if (pending.length) {
    if (process.platform !== "darwin") throw new Error("Regenerating offline iPhone MP4s requires macOS with Xcode command line tools.");
    await mkdir(work, { recursive: true });
    const stage = await mkdtemp(join(work, "ios-video-"));
    try {
      const binary = join(stage, "compress-ios");
      await exec("xcrun", ["swiftc", "-O", "-module-cache-path", join(stage, "module-cache"), fileURLToPath(encoder), "-o", binary],
        { timeout: 90_000 });
      const workerCount = Math.min(6, availableParallelism(), pending.length);
      const groups = Array.from({ length: workerCount }, () => []);
      for (const [index, job] of pending.entries()) {
        job.staged = join(stage, job.id + ".mp4");
        groups[index % workerCount].push({ source: job.source, destination: job.staged });
      }
      console.log(`Encoding ${pending.length} offline iPhone videos with ${workerCount} workers…`);
      const results = await Promise.allSettled(groups.map(async (group, index) => {
        const manifest = join(stage, `worker-${index}.json`);
        await writeFile(manifest, JSON.stringify(group));
        await exec(binary, [manifest, ...settings], { timeout: 30 * 60_000 });
      }));
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }

      for (const job of pending) {
        const video = await readFile(job.staged);
        if (video.length < 1024 || video.toString("ascii", 4, 8) !== "ftyp") {
          throw new Error(`Invalid offline MP4 for exercise ${job.id}.`);
        }
        updated[job.id] = fingerprint(job.sourceHash, video);
        offlineBytes += video.length;
      }
      await mkdir(new URL("video/spotter-3d/", output), { recursive: true });
      for (const job of pending) await rename(job.staged, job.destination);

      const manifest = join(stage, "fingerprints.json");
      const videos = Object.fromEntries(Object.entries(updated).sort(([left], [right]) => left.localeCompare(right)));
      await writeFile(manifest, JSON.stringify({ profile, videos }, null, 2) + "\n");
      await rename(manifest, receipts);
    } finally {
      await rm(stage, { force: true, recursive: true });
    }
  }

  console.log(`iPhone offline video: ${offlineBytes} bytes across ${files.size} MP4s (${originalBytes} source bytes).`);
}
