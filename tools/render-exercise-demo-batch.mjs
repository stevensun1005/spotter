import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import sharp from "sharp";
import { prepareRecipe } from "../skills/spotter-exercise-demo/lib/recipe.js";
import { launchRenderer, openRenderer } from "../skills/spotter-exercise-demo/scripts/browser.mjs";

const exec = promisify(execFile);
const catalogue = new URL("../cloudflare/public/open-gym/index.json", import.meta.url);
const encoder = fileURLToPath(new URL("spotter-demo/encode.swift", import.meta.url));
const phases = [0, .24, .48, .72, .92];
const fps = 20;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function readJSON(filename, limit) {
  const entry = await stat(filename);
  if (!entry.isFile() || entry.size > limit) throw new Error("Input must be a bounded JSON file.");
  const bytes = await readFile(filename);
  try {
    return { bytes, data: JSON.parse(bytes) };
  } catch {
    throw new Error("Input is not valid JSON.");
  }
}

function planBatch(data, validIds) {
  const { kind, items } = data ?? {};
  if (kind !== "catalogue" && kind !== "private") throw new Error("The manifest kind must be catalogue or private.");
  if (!Array.isArray(items) || !items.length || items.length > 10_000) throw new Error("Expected 1–10,000 recipes.");
  const seen = new Set();
  for (const item of items) {
    const { id, recipe, posterAt = .48 } = item ?? {};
    const validId = kind === "catalogue" ? validIds.has(id) : typeof id === "string" && /^p[0-9]{1,8}$/.test(id);
    if (!validId || seen.has(id)) throw new Error("Invalid or repeated exercise key.");
    if (typeof recipe !== "string" || !recipe.endsWith(".json") || isAbsolute(recipe)) throw new Error("Use a relative recipe filename.");
    if (!Number.isFinite(posterAt) || posterAt < 0 || posterAt >= 1) throw new Error("Poster position must be in [0, 1).");
    seen.add(id);
  }
  return { kind, items };
}

async function existingReceipt(directory) {
  try {
    return (await readJSON(join(directory, "receipt.json"), 80_000)).data;
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
}

async function makeReviewSheet(frames) {
  const columns = await Promise.all(frames.map((frame) => sharp(frame).resize(264, 148).jpeg().toBuffer()));
  return sharp({ create: { width: columns.length * 264, height: 148, channels: 3, background: "#e8e9e5" } })
    .composite(columns.map((input, index) => ({ input, left: index * 264, top: 0 }))).jpeg({ quality: 90 }).toBuffer();
}

async function checkReceipt(directory, receipt, fingerprint, names, id, kind) {
  if (!receipt || receipt.fingerprint !== fingerprint) throw new Error("Existing output uses a different source. Use a new directory.");
  if ((receipt.id !== undefined || receipt.kind !== undefined) && (receipt.id !== id || receipt.kind !== kind)) {
    throw new Error("Existing output belongs to a different exercise or batch kind.");
  }
  for (const name of names) {
    if (sha(await readFile(join(directory, name))) !== receipt.files?.[name]) throw new Error("Existing output failed its checksum.");
  }
}

async function renderItem(job, options) {
  const id = job.id;
  const recipePath = resolve(options.base, job.recipe);
  const relativePath = relative(options.base, recipePath);
  if (relativePath === ".." || relativePath.startsWith("../") || relativePath.startsWith("..\\") || isAbsolute(relativePath)) throw new Error("Recipe is outside the manifest directory.");
  const { bytes, data } = await readJSON(recipePath, 384 * 1024);
  const recipe = prepareRecipe(data);
  const posterAt = job.posterAt ?? .48;
  const names = ["poster.jpg", "review.jpg", options.kind === "catalogue" ? "demo.mp4" : "demo.gif"];
  const renderInputs = [options.rendererHash, options.kind, options.encoderHash, posterAt, fps, 1];
  if (process.env.SPOTTER_DEMO_SYSTEM_GPU === '1') renderInputs.push('system-gpu');
  const fingerprint = sha(Buffer.concat([bytes, Buffer.from(JSON.stringify(renderInputs))]));
  const output = join(options.output, id);
  if (await stat(output).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  })) {
    await checkReceipt(output, await existingReceipt(output), fingerprint, names, id, options.kind);
    return "cached";
  }
  const stage = await mkdtemp(join(options.output, ".render-"));
  let page;
  try {
    page = await openRenderer(options.browser, options.renderer);
    await page.evaluate((input) => { window.spotterFrameRenderer = window.spotterDemoRenderer.createFrameRenderer(input); }, data);
    const frame = async (phase, mime) => Buffer.from(await page.evaluate(
      ({ phase, mime }) => window.spotterFrameRenderer.frame(phase, mime), { phase, mime }), "base64");
    const review = [];
    for (const phase of phases) review.push(await frame(phase, "image/jpeg"));
    if (new Set(review.map(sha)).size < 3) throw new Error("Fewer than three distinct review frames.");
    await writeFile(join(stage, names[0]), await frame(posterAt, "image/jpeg"));
    await writeFile(join(stage, names[1]), await makeReviewSheet(review));
    if (options.kind === "catalogue") {
      const intermediate = join(stage, "frames");
      await mkdir(intermediate);
      const count = Math.round(recipe.durationMs * fps / 1000);
      for (let index = 0; index < count; index++) {
        const png = await frame(index / count, "image/png");
        await writeFile(join(intermediate, "frame-" + String(index).padStart(3, "0") + ".png"), png);
      }
      await exec(options.encodeExecutable, [intermediate, join(stage, names[2])], { timeout: 90_000 });
      await rm(intermediate, { recursive: true, force: true });
    } else {
      await page.evaluate(() => window.spotterFrameRenderer.dispose());
      const base64 = await page.evaluate((input) => window.spotterDemoRenderer.renderBase64(input), data);
      const gif = Buffer.from(base64, "base64");
      if (gif.length < 100 || gif.length > 768 * 1024 || gif.subarray(0, 6).toString() !== "GIF89a") throw new Error("Invalid GIF output.");
      await writeFile(join(stage, names[2]), gif);
    }
    const files = Object.fromEntries(await Promise.all(names.map(async (name) => [name, sha(await readFile(join(stage, name)))])));
    await writeFile(join(stage, "receipt.json"), JSON.stringify({ id, kind: options.kind, fingerprint, files }, null, 2) + "\n");
    await rename(stage, output);
    return "rendered";
  } finally {
    await page?.close();
    await rm(stage, { recursive: true, force: true });
  }
}

try {
  const { values } = parseArgs({ options: {
    manifest: { type: "string" }, output: { type: "string" }, renderer: { type: "string" }, chrome: { type: "string" },
    jobs: { type: "string", default: "2" }, help: { type: "boolean" },
  } });
  const chrome = values.chrome ?? process.env.SPOTTER_DEMO_CHROME;
  const jobs = Number(values.jobs);
  if (values.help || !chrome || !values.manifest || !values.output || !values.renderer || !Number.isInteger(jobs) || jobs < 1 || jobs > 4) {
    console.log("Usage: node tools/render-exercise-demo-batch.mjs --manifest <batch.json> --output <local directory> --renderer <renderer.html> --chrome <Chrome executable> [--jobs 1–4]");
    process.exitCode = values.help ? 0 : 2;
  } else {
    const validIds = new Set((await readJSON(catalogue, 20_000_000)).data.rows.map(({id}) => id));
    const { kind, items } = planBatch((await readJSON(values.manifest, 4_000_000)).data, validIds);
    const output = resolve(values.output);
    await mkdir(output, { recursive: true, mode: 0o700 });
    if (kind === "private" && Boolean((await stat(output)).mode & 0o077)) {
      throw new Error("Choose a private output directory without group or world access.");
    }
    const rendererBytes = await readFile(resolve(values.renderer));
    const rendererHash = sha(rendererBytes);
    const encoderHash = kind === "catalogue" ? sha(await readFile(encoder)) : "";
    const build = await mkdtemp(join(output, ".spotter-engine-"));
    let browser;
    try {
      const renderer = pathToFileURL(join(build, "renderer.html"));
      await writeFile(renderer, rendererBytes);
      const encodeExecutable = join(build, "encode");
      if (kind === "catalogue") await exec("xcrun", ["swiftc", "-O", encoder, "-o", encodeExecutable], { timeout: 90_000 });
      browser = await launchRenderer(chrome);
      const totals = { rendered: 0, cached: 0, failed: 0 };
      let next = 0;
      const config = { output, renderer, rendererHash, kind, encoderHash, encodeExecutable, browser, base: dirname(resolve(values.manifest)) };
      await Promise.all(Array.from({ length: jobs }, async () => {
        while (next < items.length) {
          const item = items[next++];
          try {
            const status = await renderItem(item, config);
            totals[status]++;
            console.log(item.id, status);
          } catch (error) {
            totals.failed++;
            const diagnostic = kind === "catalogue" && process.env.SPOTTER_DEMO_RENDER_DIAGNOSTICS === "1";
            console.error(item.id + (diagnostic ? " failed. " + error.message :
              " failed. Verify the recipe, media tools or existing receipt."));
          }
        }
      }));
      console.log(JSON.stringify(totals));
      if (totals.failed) process.exitCode = 1;
    } finally {
      await browser?.close();
      await rm(build, { recursive: true, force: true });
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
