import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { poseFor } from '../lib/motion.js';

const skill = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(skill, '../..');
const defaultArchive = join(root, 'cloudflare/public/spotter-demo-skill/spotter-exercise-demo.zip');
const output = resolve(process.argv[2] ?? defaultArchive);
const stage = await mkdtemp(join(tmpdir(), 'spotter-demo-package-'));
try {
  const dir = join(stage, 'spotter-exercise-demo');
  await mkdir(join(dir, 'scripts'), {recursive: true});
  await mkdir(join(dir, 'references'));
  await mkdir(join(dir, 'licenses'));
  for (const file of ['SKILL.md', 'references/recipe.md', 'scripts/render.mjs', 'scripts/browser.mjs', 'package.json', 'package-lock.json']) {
    await copyFile(join(skill, file), join(dir, file));
  }
  for (const [source, target] of [
    ['lib/LICENSE.ASSETS.md', 'licenses/CC0.md'],
    ['lib/CREDITS.md', 'licenses/CREDITS.md'],
    ['node_modules/three/LICENSE', 'licenses/three-MIT.txt'],
    ['node_modules/gifenc/LICENSE.md', 'licenses/gifenc.txt'],
  ]) {
    await copyFile(join(skill, source), join(dir, target));
  }
  const [{outputFiles}, template] = await Promise.all([
    build({entryPoints: [join(skill, 'lib/renderer.js')], bundle: true, minify: true,
      legalComments: 'inline', write: false, target: ['chrome110', 'safari17']}),
    readFile(join(skill, 'lib/renderer-template.html'), 'utf8'),
  ]);
  const javascript = outputFiles[0].text.replaceAll(/<\/script/gi, '<\\/script');
  await writeFile(join(dir, 'renderer.html'),
    template.replace('<!-- script -->', () => `<script>${javascript}</script>`));
  const recipe = {
    version: 1, durationMs: 2800, muscles: ['quad', 'glute'], equipment: 'dumbbells',
    camera: {yaw: 39, elevation: 12, focus: [0, .91, .04], height: 2.10},
    keyframes: Array.from({length: 17}, (_, index) => {
      const at = index / 16;
      return {at, ...poseFor('2966', at)};
    }),
  };
  await writeFile(join(dir, 'references/example-squat.json'), JSON.stringify(recipe, null, 2) + '\n');
  // Zip in a fresh directory so removed archive entries cannot leak into later builds.
  const archive = join(stage, basename(output));
  execFileSync('zip', ['-q', '-r', '-X', archive, 'spotter-exercise-demo'], {cwd: stage});
  await mkdir(dirname(output), {recursive: true});
  await copyFile(archive, output);
  console.log(`Wrote ${output}`);
} finally {
  await rm(stage, {recursive: true, force: true});
}
