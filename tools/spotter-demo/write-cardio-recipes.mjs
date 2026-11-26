import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cardioCatalogueIds, cardioCatalogueRecipe } from '../../skills/spotter-exercise-demo/lib/cardio-motion.js';

const [target, ...choice] = process.argv.slice(2);
if (!target) throw new Error('Usage: node tools/spotter-demo/write-cardio-recipes.mjs OUTPUT_DIRECTORY [EXACT_ID ...]');
const ids = choice.length ? choice : cardioCatalogueIds;
if (new Set(ids).size !== ids.length || ids.some(id => !cardioCatalogueIds.includes(id))) {
  throw new Error('Use distinct reviewed catalogue IDs.');
}
const out = resolve(target);
await mkdir(out, { recursive: false, mode: 0o700 });
const items = [];
for (const id of ids) {
  const recipe = id + '.json';
  await writeFile(resolve(out, recipe), JSON.stringify(cardioCatalogueRecipe(id)) + '\n', { flag: 'wx', mode: 0o600 });
  items.push({ id, recipe });
}
await writeFile(resolve(out, 'batch.json'), JSON.stringify({ kind: 'catalogue', items }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Prepared', items.length, 'reviewed public catalogue recipes.');
