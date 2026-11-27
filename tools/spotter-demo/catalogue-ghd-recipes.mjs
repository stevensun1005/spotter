import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, blend, body, cycle, foot, joint, ramp, scale, sides } from './catalogue-dumbbell-recipes.mjs';

const lateral = [1, 0, 0];
const stance = {
  sit: { ankle: [.111, .977, -.716], pad: [0, .891, -.046] },
  extend: { ankle: [.111, 1.053, -.707], pad: [0, .864, -.091] },
  raise: { ankle: [.111, 1.048, -.593], pad: [0, .871, -.137] },
};

function station(pose, mode, supportSide, lift = 0) {
  const { ankle, pad } = stance[mode];
  pose.planted = {};
  pose.leverPressHandles = sides.map(([, sign]) => ({
    pivot: [sign * ankle[0], ankle[1], ankle[2]],
    point: pad,
    axis: lateral,
  }));
  for (const [side, sign] of sides) {
    const footX = mode === 'sit' ? -sign : sign;
    if (mode === 'raise') {
      pose[side + 'k'] = [sign * .112, 1.064, -.170];
      pose[side + 'a'] = [sign * ankle[0], ankle[1], ankle[2]];
      pose[side + 't'] = add(pose[side + 'a'], [sign * .012, -.141, .050]);
      continue;
    }
    const supported = !supportSide || side === supportSide;
    const toe = [footX * .014, mode === 'sit' ? .129 : -.120, .061];
    const baseline = [footX * ankle[0], ankle[1], ankle[2]];
    const anchor = supported ? baseline
      : add(baseline, scale([footX * .073, .248, .085], lift));
    foot(pose, side, sign, anchor, [footX * .16, mode === 'sit' ? .94 : -.84, -.13], toe);
  }
}

function foldedArms(pose) {
  for (const [side, sign] of sides) {
    const target = add(pose.chest, add(scale(pose.right, -sign * .123), scale(pose.front, .170)));
    const pole = add(scale(pose.right, sign * .80), add(scale(pose.up, -.66), scale(pose.front, .24)));
    [pose[side + 'e'], pose[side + 'w']] = joint(pose[side + 's'], target, pole, .252, .326);
  }
}

function straightArms(pose, amount, mode) {
  const direction = mode === 'raise' ? blend(pose.up, pose.front, .35 + .48 * amount)
    : blend(pose.up, pose.front, .88 * amount);
  for (const [side, sign] of sides) {
    const target = add(pose[side + 's'], add(scale(direction, .620), scale(pose.right, sign * .035)));
    const pole = add(scale(pose.front, -.21), scale(pose.right, sign * .89));
    [pose[side + 'e'], pose[side + 'w']] = joint(pose[side + 's'], target, pole, .252, .326);
  }
}

function seated(phase, { full, twist, straight }) {
  const rise = cycle(phase, twist ? .29 : .44, twist ? .73 : .55);
  const firstTurn = ramp(phase, .29, .39) * (1 - ramp(phase, .40, .50));
  const secondTurn = ramp(phase, .50, .60) * (1 - ramp(phase, .62, .73));
  const turn = twist ? .51 * (firstTurn - secondTurn) : 0;
  const reclined = full ? -1.729 : -1.518;
  const top = full ? .848 : straight ? .696 : .094;
  const pose = body([0, 1.064, .072], reclined + (top - reclined) * rise, Math.PI, turn);
  station(pose, 'sit');
  if (straight) straightArms(pose, rise, 'sit');
  else foldedArms(pose);
  return pose;
}

function extension(phase, { twist, single }) {
  const time = single || twist ? (2 * phase) % 1 : phase;
  const side = phase < .5 ? 'l' : 'r';
  const lower = cycle(time, .36, .47);
  const turn = twist ? (phase < .5 ? 1 : -1) * .42 * ramp(time, .52, .74) * (1 - ramp(time, .79, 1)) : 0;
  const pose = body([0, 1.069, .091], Math.PI / 2 + .940 * lower, 0, turn);
  // Torso rotation stays above the support, independently of the pelvis.
  pose.lh = add(pose.hips, [.103, 0, 0]);
  pose.rh = add(pose.hips, [-.103, 0, 0]);
  const lift = single ? ramp(time, 0, .14) * (1 - ramp(time, .84, 1)) : 0;
  station(pose, 'extend', single ? side : null, lift);
  foldedArms(pose);
  return pose;
}

function kneeRaise(phase, { straight }) {
  const raised = cycle(phase, .44, .57);
  const angle = .040 + 1.310 * raised;
  const pose = body([0, 1.064 + .422 * Math.sin(angle), -.170 + .422 * Math.cos(angle)], Math.PI / 2 - angle);
  station(pose, 'raise');
  if (straight) straightArms(pose, raised, 'raise');
  else foldedArms(pose);
  return pose;
}

const variants = [
  ['10639', 'sit', seated, { full: true }, ['core']],
  ['4762', 'extend', extension, {}, ['glute', 'hamstring']],
  ['4763', 'sit', seated, { twist: true }, ['core']],
  ['11282', 'sit', seated, { straight: true }, ['core']],
  ['4764', 'extend', extension, { twist: true }, ['glute', 'core']],
  ['4456', 'raise', kneeRaise, {}, ['hamstring', 'glute']],
  ['4890', 'raise', kneeRaise, { straight: true }, ['hamstring', 'glute']],
  ['4765', 'extend', extension, { single: true }, ['glute', 'hamstring']],
  ['6554', 'sit', seated, {}, ['core']],
];

const [directory, ...ids] = process.argv.slice(2);
if (!directory) throw new Error('Pass an output directory and optional exact GHD IDs.');
const chosen = ids.length ? variants.filter(([id]) => ids.includes(id)) : variants;
if (ids.length && chosen.length !== ids.length) throw new Error('Unknown or repeated GHD ID.');
const root = resolve(directory);
await mkdir(root, { recursive: true });
const items = [];
const failures = [];
for (const [id, mode, movement, options, muscles] of chosen) {
  const durationMs = options.twist || options.single ? 6200 : 4200;
  const data = {
    version: 1, durationMs, equipment: 'lever-press-station-ghd-' + mode, muscles,
    camera: { yaw: mode === 'sit' ? options.twist ? 128 : 109 : 74, elevation: 14,
      height: mode === 'raise' ? 2.43 : mode === 'sit' ? options.straight ? 2.58 : 2.30 : 1.98,
      focus: [0, mode === 'raise' ? 1.13 : mode === 'sit' ? options.straight ? 1.06 : .96 : .79, -.07] },
    keyframes: Array.from({ length: 61 }, (_, index) => ({ at: index / 60, ...movement(index / 60, options) })),
  };
  try {
    prepareRecipe(data);
    const recipe = id + '.json';
    await writeFile(resolve(root, recipe), JSON.stringify(data) + '\n');
    items.push({ id, recipe });
  } catch (error) {
    failures.push({ id, reason: error.message });
  }
}
await writeFile(resolve(root, 'batch.json'), JSON.stringify({ kind: 'catalogue', items }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: items.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
