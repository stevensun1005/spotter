import { readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launchRenderer, openRenderer } from './browser.mjs';

const [input, output, browserPath = process.env.SPOTTER_DEMO_CHROME] = process.argv.slice(2);
if (!input || !output || !browserPath) {
  throw new Error('Usage: node scripts/render.mjs <recipe.json> <demo.gif> <Chrome executable>. You can set SPOTTER_DEMO_CHROME for Chrome.');
}
if ((await stat(input)).size > 384 * 1024) throw new Error('Motion recipe exceeds 384 KiB.');
const recipe = JSON.parse(await readFile(input, 'utf8'));
const browser = await launchRenderer(browserPath);
try {
  const page = await openRenderer(browser, new URL('../renderer.html', import.meta.url));
  const data = await page.evaluate((value) => window.spotterDemoRenderer.renderBase64(value), recipe);
  const bytes = Buffer.from(data, 'base64');
  await writeFile(pathToFileURL(resolve(output)), bytes, {flag: 'wx', mode: 0o600});
  console.log(`Wrote a ${bytes.length}-byte Spotter GIF.`);
} finally {
  await browser.close();
}
