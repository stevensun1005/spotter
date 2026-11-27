import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../..', import.meta.url));
const audit = join(root, 'cloudflare/scripts/audit-exercise-animations.mjs');
const registry = join(root, 'cloudflare/features/exercises/spotter-demo-assets.json');
const media = join(root, 'cloudflare/public/open-gym/spotter-3d');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJSON = async (path) => JSON.parse(await readFile(path, 'utf8'));

const { values, positionals: manifests } = parseArgs({
  options: { illustrations: { type: 'boolean' }, refresh: { type: 'boolean' } }, allowPositionals: true,
});
if (!manifests.length || (values.refresh && values.illustrations)) {
  throw new Error('Usage: node tools/spotter-demo/promote-reviewed-legacy.mjs [--illustrations | --refresh] <reviewed.json> [...]');
}
const approvals = await Promise.all(manifests.map(async (file) => ({ base: dirname(resolve(file)), entries: await readJSON(file) })));
const previous = await readJSON(registry);
const exactPath = (id) => '/open-gym/spotter-3d/' + id + '.mp4';
const source = values.refresh ? 'registered Spotter 3D' : values.illustrations ? 'illustration' : 'legacy';
const targets = new Set();
if (values.refresh) {
  for (const [id, url] of Object.entries(previous)) if (/^[0-9]+$/.test(id) && url === exactPath(id)) targets.add(id);
} else {
  const listFlag = values.illustrations ? '--list-illustrations' : '--list-legacy';
  const inventory = JSON.parse(execFileSync(process.execPath, [audit, listFlag], { encoding: 'utf8', maxBuffer: 4_000_000 }));
  for (const { id } of values.illustrations ? inventory.illustrationRows : inventory.legacyRows) {
    if (!Object.hasOwn(previous, id)) targets.add(id);
  }
}
const next = { ...previous };
const files = [['poster.jpg', 'jpg'], ['review.jpg', null], ['demo.mp4', 'mp4']];
const packages = [];
const ids = [];
for (const { base, entries } of approvals) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Expected a list of reviewed results.');
  for (const { id, output } of entries) {
    if (!targets.delete(id) || typeof output !== 'string' || !output) {
      throw new Error('Expected distinct, still-active ' + source + ' IDs with reviewed output directories.');
    }
    ids.push(id);
    const folder = resolve(base,output);
    const receipt = await readJSON(join(folder,'receipt.json'));
    if (!/^[0-9a-f]{64}$/.test(receipt.fingerprint)) throw new Error(id + ' has no render fingerprint.');
    if ((values.refresh || values.illustrations || receipt.id !== undefined || receipt.kind !== undefined) &&
        (receipt.id !== id || receipt.kind !== 'catalogue')) {
      throw new Error(id + ' requires a catalogue render receipt for this exact exercise ID.');
    }
    for (const [filename, extension] of files) {
      const bytes = await readFile(join(folder,filename));
      if (digest(bytes) !== receipt.files?.[filename]) throw new Error(id + ' has a media checksum mismatch.');
      if (extension === 'mp4' && (bytes.length < 1024 || bytes.toString('ascii',4,8) !== 'ftyp')) {
        throw new Error(id + ' has an invalid MP4 header.');
      }
      if (extension === 'jpg' && (bytes[0] !== 0xff || bytes[1] !== 0xd8)) throw new Error(id + ' has an invalid JPEG header.');
      if (extension) packages.push({ name: id+'.'+extension, bytes });
    }
    next[id] = exactPath(id);
  }
}

await mkdir(media,{ recursive: true });
const stage = await mkdtemp(join(media,'.stage-'));
try {
  await Promise.all(packages.map(({name,bytes}) => writeFile(join(stage,name),bytes)));
  const entries = Object.entries(next).sort(([a],[b]) => Number(a) - Number(b) || a.localeCompare(b));
  const lines = entries.map(([id,path]) => '  ' + JSON.stringify(id) + ': ' + JSON.stringify(path));
  await writeFile(join(stage,'registry.json'),'{\n' + lines.join(',\n') + '\n}\n');
  for (const { name } of packages) await rename(join(stage,name),join(media,name));
  await rename(join(stage,'registry.json'),registry);
} finally {
  await rm(stage,{recursive:true,force:true});
}
console.log(JSON.stringify({ [values.refresh ? 'refreshed' : 'promoted']: ids.length, ids }));
