import { seatedErgometers } from './seated-ergometer-geometry.js';
import { assistedExercises } from './assisted-exercise-geometry.js';
import { leverPulls } from './lever-pull-geometry.js';

const joints = ['hips', 'chest', 'neck', 'head', 'ls', 'le', 'lw', 'rs', 're', 'rw',
  'lh', 'lk', 'la', 'lt', 'rh', 'rk', 'ra', 'rt'];
const optionalVectors = ['lGrip', 'rGrip', 'lFingers', 'rFingers', 'lPalmSide', 'rPalmSide', 'headAim'];
const musclePattern = /^(?:(?:l|r):)?(?:lat|quad|glute|pec|core|shoulder|rearShoulder|forearm|biceps|triceps|trap|calf|hamstring|adductor|shin|neck)$/;
const cardioEquipment = [
  'rig-contact-wall', 'rig-contact-tall-wall', 'rig-suitcase-bar', 'rig-goblet-plates', 'rig-single-carry', 'rig-single-kettlebell', 'rig-pass-ball', 'rig-slam-ball', 'rig-bike', 'rig-treadmill', 'rig-run-belt', 'rig-elliptical', 'rig-stepmill', 'rig-rower', 'rig-kettles-carry', 'rig-trap-carry', 'rig-jump-rope',
];
const validEquipment = new Set([...cardioEquipment, 'none', 'mat', 'step', 'step-dumbbells', 'dumbbell', 'dumbbells',
  'mat-dumbbells', 'chest-bench-dumbbells', 'band', 'band-ankle', 'stretch-band', 'mat-stretch-band', 'high-stretch-band', 'barbell', 'trap-bar', 'bench', 'bench-barbell', 'bench-dumbbell', 'bench-dumbbells', 'neutral-pull-up', 'pull-up', 'cable', 'dual-cable', 'cable-lat-bar', 'leg-curl', 'rope', 'landmine']);
for (const preset of ['incline-bench-barbell', 'bench-ez-bar', 'cable-ankle', 'stability-ball', 'stability-ball-wall', 'standing-leg-curl', 'nordic-mat', 'hand-roller', 'wide-pull-up', 'narrow-neutral-pull-up']) {
  validEquipment.add(preset);
}

for (const preset of Object.keys(leverPulls)) validEquipment.add(preset);

for (const preset of Object.keys(assistedExercises)) validEquipment.add(preset);

const smallPropPresets = {
  'spotter-med-ball': 'medicine', 'spotter-med-ball-mat': 'medicine', 'spotter-med-ball-bench': 'medicine',
  'spotter-med-ball-wall-mat': 'medicine', 'spotter-med-ball-wall-tall': 'medicine',
  'spotter-massage-ball': 'massage-ball', 'spotter-massage-front-wall': 'massage-front-wall',
  'spotter-massage-rear-wall': 'massage-rear-wall', 'spotter-massage-table': 'massage-table',
  'spotter-bosu': 'bosu', 'spotter-foam-roller': 'foam', 'spotter-foam-wall': 'foam-wall',
  'spotter-foam-long': 'foam-long', 'spotter-ab-wheel': 'wheel',
  'spotter-ab-wheel-stretch-band': 'wheel-band', 'spotter-ab-wheel-wall': 'wheel-wall', 'spotter-tire-flip': 'tire',
};
for (const preset of Object.keys(smallPropPresets)) validEquipment.add(preset);
const stabilityBallPresets = new Map([['stability-ball-hug', .218], ['stability-ball-chest-stretch', .165]]);
for (const preset of stabilityBallPresets.keys()) validEquipment.add(preset);

for (const preset of seatedErgometers) validEquipment.add(preset);

const bodyweightProps = new Set([
  'extension-45', 'extension-flat', 'doorway', 'plyo-box', 'back-plate', 'assault-bike', 'incline-treadmill', 'push-up-handles',
  'parallel-dips', 'cage-dips', 'straight-dip', 'dip-bench', 'double-dip-bench', 'inverted-row', 'inverted-high-row',
  'handstand-wall', 'drop-steps', 'ab-decline', 'ab-steep', 'ab-incline', 'captains-chair', 'under-bench',
  'balance-board', 'training-towel', 'slide-disc', 'fitness-rings', 'row-suspension',
  'front-suspension', 'press-suspension', 'foot-suspension',
]);
for (const preset of bodyweightProps) validEquipment.add(preset);

const suspensionPresets = new Map([['adjustable-straps', 'handle'], ['adjustable-foot-straps', 'foot'], ['adjustable-rings', 'ring'], ['adjustable-ring-feet', 'ring-foot']]);
for (const preset of suspensionPresets.keys()) validEquipment.add(preset);

const calfRails = new Map([['calf-step-rail', 'step'], ['calf-stair-rail', 'stairs']]);
for (const preset of calfRails.keys()) validEquipment.add(preset);

const bandSupports = new Map([['seat-stretch-band', 'seat'], ['high-seat-stretch-band', 'seat'], ['bench-stretch-band', 'flat'], ['post-stretch-band', 'post'], ['post-seat-stretch-band', 'post-seat'], ['mat-post-stretch-band', 'post'], ['incline-stretch-band', 'incline']]);
for (const [preset, support] of [['post-braced-stretch-band','post-brace'],['post-hinge-stretch-band','post-hinge'],
  ['braced-stretch-band','brace'],['post-chair-stretch-band','post-chair']]) bandSupports.set(preset,support);
for (const preset of bandSupports.keys()) validEquipment.add(preset);

const kettleSupports = new Map([
  ['kettlebells', { count: 2 }], ['kettlebell-left', { count: 1 }],
  ['mat-kettlebells', { count: 2, mat: true }], ['mat-kettlebell-left', { count: 1, mat: true }],
  ['seat-kettlebells', { count: 2, seat: true }], ['seat-kettlebell-left', { count: 1, seat: true }],
  ['bench-kettlebell-left', { count: 1, support: 'flat' }],
  ['incline-bench-kettlebells', { count: 2, support: 'incline' }],
  ['step-kettlebell-left', { count: 1, support: 'step' }],
  ['box-kettlebell-left', { count: 1, bodyweight: 'plyo-box' }],
  ['assisted-split-kettlebell-left', { count: 1, support: 'split-balance' }],
  ['kettlebell-banded-swing', { count: 1, band: 'post' }],
  ['step-banded-kettlebell-left', { count: 1, band: 'floor', support: 'step' }],
  ['wide-step-kettlebell-left', { count: 1, support: 'wide-step' }],
]);
for (const preset of kettleSupports.keys()) validEquipment.add(preset);

const leverPressProps = new Set(['lever-press-flat', 'lever-press-incline', 'lever-press-standing',
  'lever-press-fly', 'lever-press-reverse', 'lever-press-leg', 'lever-press-rotary-calf',
  'lever-press-seated-calf', 'lever-press-standing-calf', 'lever-press-hip', 'lever-press-crunch',
  'lever-press-twist', 'lever-press-reverse-hyper', 'lever-press-incline-plate',
  'lever-press-flat-plate', 'lever-press-incline-stack', 'lever-press-flat-stack', 'lever-press-flat-floor',
  'lever-press-fly-stack', 'lever-press-fly-pad-stack', 'lever-press-fly-incline-stack',
  'lever-press-lateral-pad-plate', 'lever-press-lateral-pad-stack',
  'lever-press-elbow-pad-stack', 'lever-press-dip-plate', 'lever-press-knee-stack', 'lever-press-knee-plate',
  'lever-press-knee-curl-stack', 'lever-press-knee-curl-plate', 'lever-press-knee-prone-plate',
  'lever-press-knee-prone-stack', 'lever-press-knee-kneeling-plate', 'lever-press-seated-calf-plate',
  'lever-press-hip-stack',
  'lever-press-station-horizontal', 'lever-press-station-angled', 'lever-press-station-outdoor',
  'lever-press-station-seat', 'lever-press-station-calf', 'lever-press-station-calf-angled', 'lever-press-station-hack-linear',
  'lever-press-station-hack-reverse', 'lever-press-station-hack-arc',
  'lever-press-station-hack-pendulum', 'lever-press-station-hack-chair', 'lever-press-station-hack-calf',
  'lever-press-station-hack-abduction', 'lever-press-station-hack-reverse-slope',
  'lever-press-station-hack-hinge', 'lever-press-station-hack-shrug',
  'lever-press-station-ghd-sit', 'lever-press-station-ghd-extend', 'lever-press-station-ghd-raise',
  'lever-press-station-belt-basic', 'lever-press-station-belt-split',
  'lever-press-station-belt-v', 'lever-press-station-belt-straight',
  'lever-press-station-thrust-belt', 'lever-press-station-thrust-loaded-belt',
  'lever-press-station-thrust-step', 'lever-press-station-thrust-pad', 'lever-press-station-thrust-band',
  'lever-press-station-thrust-loaded-pad', 'lever-press-station-thrust-standing',
  'lever-press-station-reformer-footbar', 'lever-press-station-reformer-standing',
  'lever-press-station-reformer-hands', 'lever-press-station-reformer-feet',
  'lever-press-station-axial-coaster', 'lever-press-station-axial-swing',
  'lever-press-station-axial-seat-back', 'lever-press-station-axial-seat-back-grip',
  'lever-press-station-axial-recline-decline', 'lever-press-station-axial-recline-flat',
  'lever-press-station-axial-recline-stack', 'lever-press-station-axial-recline-legs',
  'lever-press-station-axial-seat-palms', 'lever-press-station-axial-seat-full',
  'lever-press-station-axial-seat-chest', 'lever-press-station-axial-rotation-seated',
  'lever-press-station-axial-rotation-torso', 'lever-press-station-axial-rotation-trunk',
  'lever-press-station-axial-rotation-standing',
  'lever-press-station-special-leg-hip-out', 'lever-press-station-special-leg-hip-in',
  'lever-press-station-special-leg-hip-front', 'lever-press-station-special-leg-hip-rear',
  'lever-press-station-special-leg-hip-foot', 'lever-press-station-special-leg-kneeling-rear',
  'lever-press-station-special-leg-kneeling-in', 'lever-press-station-special-leg-squat-hold',
  'lever-press-station-special-leg-prone-curl-hyper', 'lever-press-station-special-leg-stepper',
  'lever-press-station-special-leg-seated-toe']);
for (const preset of leverPressProps) validEquipment.add(preset);

const originalRopes = new Map([['battle-ropes','battle'], ['climb-rope','climb'], ['stretch-rope','stretch'], ['extension-towel','towel']]);
for (const preset of originalRopes.keys()) validEquipment.add(preset);

const stretchSupports = new Set(['adductor-step','situp-anchor']);
for (const preset of stretchSupports) validEquipment.add(preset);

const sledProps = new Set(['sled-press', 'sled-press-lying', 'sled-hack', 'sled-standing-calf', 'sled-smith', 'sled-horizontal',
  'sled-press-contact','sled-press-lying-contact',
  'sled-prowler-front','sled-prowler-rear','sled-prowler-rope','sled-prowler-axis','sled-prowler-harness','sled-prowler-tank']);
for (const preset of sledProps) validEquipment.add(preset);

const barbellSupports = {
  'barbell-rack': 'rack', 'barbell-pins': 'pull-pins', 'barbell-bench-pins': 'press-pins',
  'barbell-squat-rack': 'squat-rack', 'barbell-squat-pins': 'squat-pins', 'barbell-box-squat': 'squat-box',
  'barbell-decline': 'decline', 'ez-decline': 'decline', 'ez-incline': 'incline', 'ez-incline-free': 'incline-free',
  'barbell-seat': 'seat', 'ez-seat': 'seat', 'barbell-preacher': 'preacher', 'ez-preacher': 'preacher',
  'barbell-chest-bench': 'chest-bench', 'ez-chest-bench': 'chest-bench', 'barbell-chest-support-row': 'chest-row-bench',
  'barbell-onearm-bench': 'onearm-bench', 'barbell-rear-bench': 'rear-bench', 'barbell-plyo-box': 'plyo-box', 'smith-rear-bench': 'smith-rear-bench',
  'smith-rear-bench-step': 'smith-rear-bench-step',
  'barbell-low-step': 'low-step', 'barbell-seat-step': 'seat-step', 'barbell-bench-elevated-feet': 'bridge-bench',
  'smith-standing': 'smith', 'smith-flat': 'smith-flat', 'smith-decline': 'smith-decline',
  'smith-incline': 'smith-incline', 'smith-seat': 'smith-seat', 'smith-box': 'smith-box',
  'smith-low-step': 'smith-low-step', 'smith-seat-step': 'smith-seat-step',
  'barbell-arm-blaster': 'arm-blaster', 'ez-arm-blaster': 'arm-blaster',
  'ez-stability-ball': 'free', 'ez-barbell': 'free', 'ez-standing-preacher': 'standing-preacher',
  'ez-floor-band': 'floor-band', 'olympic-neutral-bar': 'free',
};
for (const preset of Object.keys(barbellSupports)) validEquipment.add(preset);
const catalogueCablePresets = {
  'cable-lat-wide': { attachment: 'wide', support: 'lat' },
  'cable-lat-straight': { attachment: 'straight', support: 'lat' },
  'cable-lat-medium': { attachment: 'medium', support: 'lat' },
  'cable-lat-pro': { attachment: 'pro', support: 'lat' },
  'cable-lat-neutral': { attachment: 'v', support: 'lat' },
  'cable-lat-neutral-wide': { attachment: 'wideNeutral', support: 'lat' },
  'cable-lat-mag': { attachment: 'mag', support: 'lat' },
  'cable-incline-v': { attachment: 'v', support: 'incline' },
  'cable-training-box': { support: 'training-box' },
  'cable-twin-long-bar': { dual: true, straightSpan: true },
  'cable-hanging-ankles': { dual: true, ankle: 'hanging', pullUp: 'bar' },
  'cable-incline-ankle': { ankle: 'incline' },
  'cable-foot-strap': { ankle: 'foot' },
  'cable-seated-ankle': { ankle: 'seated' },
  'cable-head-harness': { headHarness: true, support: 'chair' },
  'cable-chair': { support: 'chair' },
  'cable-seated-medium': { attachment: 'medium', support: 'seat' },
  'cable-seated-parallel': { attachment: 'wideNeutral', support: 'seat' },
  'cable-wide-bar': { attachment: 'wide' },
  'cable-waist-belt': { waistBelt: true },
  'cable-bosu-dual': { support: 'bosu', dual: true },
  'cable-incline-rope': { rope: true, support: 'incline' },
  'cable-preacher-kneel': { support: 'low-preacher' },
  'cable-seated-single-rope': { rope: true, singleRope: true, support: 'seat' },
  'cable-flat-bench-v': { attachment: 'v', support: 'flat' },
  'cable-flat-bench-single': { support: 'flat' },
  'cable-mat': { mat: true },
  'cable-mat-medium': { attachment: 'medium', mat: true },
  'cable-mat-ez': { attachment: 'ez', mat: true },
  'cable-ankle-mat-dual': { ankle: 'floor', dual: true },
  'cable-chest-single': { support: 'chest-incline' },
  'cable-chest-wrist': { support: 'chest-incline', wristCuff: true },
  'cable-chest-dual-wrist': { support: 'chest-incline', wristCuff: true, dual: true },
  'cable-lat-narrow': { attachment: 'narrow', support: 'lat' },
  'cable-lat-rope': { rope: true, support: 'lat' },
  'cable-lat-dual': { dual: true, support: 'lat' },
  'cable-straight-bar': { attachment: 'straight' },
  'cable-short-bar': { attachment: 'narrow' },
  'cable-ez-bar': { attachment: 'ez' },
  'cable-arm-blaster-ez': { attachment: 'ez', armBlaster: true },
  'cable-arm-blaster-v': { attachment: 'pressV', armBlaster: true },
  'cable-single-rope': { rope: true, singleRope: true },
  'cable-brace-rope': { rope: true, singleRope: true, brace: true },
  'cable-brace': { brace: true },
  'cable-one-arm-bench': { support: 'one-arm-bench' },
  'cable-one-arm-bench-rope': { rope: true, singleRope: true, support: 'one-arm-bench' },
  'cable-incline-single': { support: 'incline' },
  'cable-seated-ez': { attachment: 'ez', support: 'seat' },
  'cable-preacher-single': { support: 'preacher' },
  'cable-preacher-single-rope': { rope: true, singleRope: true, support: 'preacher' },
  'cable-decline-press': { support: 'decline-press', dual: true },
  'cable-decline-single-press': { support: 'decline-press' },
  'cable-ball-dual': { support: 'ball', dual: true },
  'cable-incline-short': { attachment: 'narrow', support: 'incline' },
  'cable-incline-medium': { attachment: 'medium', support: 'incline' },
  'cable-medium-bar': { attachment: 'medium' },
  'cable-v-bar': { attachment: 'v' },
  'cable-v-press-bar': { attachment: 'pressV' },
  'cable-seated': { support: 'seat' },
  'cable-seated-bar': { attachment: 'straight', support: 'seat' },
  'cable-seated-short-bar': { attachment: 'narrow', support: 'seat' },
  'cable-seated-v': { attachment: 'v', support: 'seat' },
  'cable-seated-rope': { rope: true, support: 'seat' },
  'cable-seated-dual': { dual: true, support: 'seat' },
  'cable-seat-ball': { support: 'ball' },
  'cable-ball-bar': { support: 'ball', attachment: 'medium' },
  'cable-row-bar': { attachment: 'straight', support: 'row' },
  'cable-row-v': { attachment: 'v', support: 'row' },
  'cable-row-wide': { attachment: 'wide', support: 'row' },
  'cable-row-rope': { rope: true, support: 'row' },
  'cable-elevated-row': { rope: true, support: 'high-row' },
  'cable-decline-row': { attachment: 'wide', support: 'decline-row' },
  'cable-floor-row': { attachment: 'wide', support: 'floor-row' },
  'cable-flat-bench': { dual: true, support: 'flat' },
  'cable-mat-short': { attachment: 'narrow', mat: true },
  'cable-flat-bench-short': { attachment: 'narrow', support: 'flat' },
  'cable-flat-bench-medium': { attachment: 'medium', support: 'flat' },
  'cable-flat-bench-rope': { rope: true, support: 'flat' },
  'cable-decline-bench': { support: 'decline' },
  'cable-incline-bench': { dual: true, support: 'incline' },
  'cable-supported-row': { dual: true, support: 'chest-incline' },
  'cable-supported-rope-row': { rope: true, support: 'chest-incline' },
  'cable-preacher-bar': { attachment: 'straight', support: 'preacher' },
  'cable-preacher-rope': { rope: true, support: 'preacher' },
  'cable-standing-preacher': { support: 'standing-preacher' },
  'cable-calf-step': { support: 'step' },
  'cable-ankle-extension': { ankle: 'extension' },
  'cable-ankle-floor': { ankle: 'floor' },
  'cable-ankle-flat-bench': { ankle: 'bench', dual: true },
  'cable-step-grip': { support: 'step-up' },
  'cable-side-step-grip': { support: 'step-up-lateral' },
  'cable-box-grip': { support: 'step-up-box' },
  'cable-ankle-tuck': { ankle: 'tuck' },
};
for (const preset of Object.keys(catalogueCablePresets)) validEquipment.add(preset);
const dumbbellSupports = new Map([
  ['bench', 'flat'], ['long-bench', 'long-flat'], ['bench-kneeling-mat', 'kneeling-mat'],
  ['chest-bench', 'chest'], ['incline-bench', 'incline'],
  ['decline-bench', 'decline'], ['preacher-bench', 'preacher'],
  ['upright-bench', 'upright'], ['stability-ball', 'ball'], ['arm-blaster', 'blaster'],
  ['incline-ball', 'incline-ball'], ['mat', 'floor-mat'], ['step', 'step'], ['wall', 'wall'],
  ['wrist-bench', 'wrist'], ['seat-step', 'seat-step'], ['step-brace', 'step-brace'],
  ['rear-step', 'rear-step'], ['wall-ball', 'wall-ball'], ['wall-ball-knees', 'wall-ball-knees'],
  ['wall-ball-ankles', 'wall-ball-ankles'], ['raise-brace', 'raise-brace'], ['head-brace', 'head-brace'],
]);
for (const prefix of dumbbellSupports.keys()) {
  validEquipment.add(prefix + '-dumbbell');
  validEquipment.add(prefix + '-dumbbells');
}
const handHeldProps = new Map([
  ['bottle', {kind:'bottle', count:1}], ['bottles', {kind:'bottle', count:2}],
  ['mat-bottle', {kind:'bottle', count:1, support:'floor-mat'}],
  ['mat-bottles', {kind:'bottle', count:2, support:'floor-mat'}],
  ['bench-bottle', {kind:'bottle', count:1, support:'flat'}],
  ['plate', {kind:'plate', count:1}], ['plates', {kind:'plate', count:2}],
  ['mat-plate', {kind:'plate', count:1, support:'floor-mat'}],
  ['bench-plate', {kind:'plate', count:1, support:'flat'}],
  ['incline-bench-plate', {kind:'plate', count:1, support:'incline'}],
  ['stability-ball-plate', {kind:'plate', count:1, support:'ball'}],
  ['extension-plate', {kind:'plate', count:1, bodyweight:'extension-45'}],
  ['decline-ab-plate', {kind:'plate', count:1, bodyweight:'ab-decline'}],
  ['dip-bench-plate', {kind:'plate', count:1, bodyweight:'dip-bench'}],
  ['inverted-row-plate', {kind:'plate', count:1, bodyweight:'inverted-row'}],
  ['sandbag', {kind:'sandbag', count:1}],
]);
for (const preset of handHeldProps.keys()) validEquipment.add(preset);
const wearableWeights = {
  'weighted-backpack': { weight: 'backpack' },
  'mat-weight-vest': { weight: 'vest', mat: true },
  'vest-pull-up': { weight: 'vest', pullUp: 'bar' },
  'weight-belt-pull-up': { weight: 'belt', pullUp: 'bar' },
  'weight-belt-straight-dip': { weight: 'belt', bodyweight: 'straight-dip' },
  'weight-belt-parallel-dips': { weight: 'belt', bodyweight: 'parallel-dips' },
  'mat-ankle-weight-left': { weight: 'ankle-left', mat: true },
  'bench-ankle-weight-left': { weight: 'ankle-left', bench: true },
  'captains-chair-ankle-weights': { weight: 'ankles', bodyweight: 'captains-chair' },
  'pull-up-dumbbell': { pullUp: 'bar', bells: 1 },
};
for (const preset of Object.keys(wearableWeights)) validEquipment.add(preset);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function number(value, min, max, label) {
  assert(Number.isFinite(value) && value >= min && value <= max, `${label}: expected a number from ${min} to ${max}.`);
  return value;
}

function vector(value, label) {
  assert(Array.isArray(value) && value.length === 3, `${label}: expected [x, y, z].`);
  return value.map((coordinate) => number(coordinate, -4, 4, label));
}

function axis(value, label) {
  const direction = vector(value, label);
  assert(Math.hypot(...direction) >= .01, `${label}: grip direction is too short.`);
  return direction;
}

const equal = (a, b) => a.every((value, index) => value === b[index]);
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const mix = (a, b, weight) => a + (b - a) * weight;
const blend = (a, b, weight) => a.map((value, index) => mix(value, b[index], weight));

function bodyPose(frame, index) {
  const pose = Object.fromEntries(joints.map((joint) => [joint, vector(frame[joint], joint)]));
  for (const [start, end, min, max] of [['lh', 'rh', .11, .38], ['ls', 'rs', .24, .57],
    ['hips', 'neck', .42, .75], ['ls', 'le', .13, .40], ['rs', 're', .13, .40],
    ['le', 'lw', .20, .52], ['re', 'rw', .20, .52], ['lh', 'lk', .29, .53], ['rh', 'rk', .29, .53],
    ['lk', 'la', .29, .53], ['rk', 'ra', .29, .53], ['la', 'lt', .06, .25], ['ra', 'rt', .06, .25]]) {
    number(distance(pose[start], pose[end]), min, max, `frame ${index + 1}: ${start}–${end} length (m)`);
  }
  for (const key of optionalVectors) {
    if (frame[key] != null) pose[key] = axis(frame[key], key);
  }
  for (const key of ['lFingerCurl', 'rFingerCurl']) {
    if (frame[key] != null) pose[key] = number(frame[key], 0, 1, 'finger curl');
  }
  pose.planted = {};
  for (const side of ['l', 'r']) {
    if (frame.planted?.[side] != null) {
      pose.planted[side] = number(frame.planted[side], 0, 1.25, 'support surface height');
    }
  }
  pose.headDrop = number(frame.headDrop ?? 0, -.09, .09, 'headDrop');
  return pose;
}

function blendBody(a, b, weight) {
  const pose = Object.fromEntries(joints.map((joint) => [joint, blend(a[joint], b[joint], weight)]));
  for (const key of optionalVectors) {
    if (a[key] && b[key]) pose[key] = blend(a[key], b[key], weight);
  }
  for (const key of ['lFingerCurl', 'rFingerCurl']) {
    if (a[key] != null && b[key] != null) pose[key] = mix(a[key], b[key], weight);
  }
  pose.planted = {};
  for (const side of ['l', 'r']) {
    if (a.planted[side] === b.planted[side]) pose.planted[side] = a.planted[side];
  }
  pose.headDrop = mix(a.headDrop, b.headDrop, weight);
  return pose;
}

export function prepareRecipe(input) {
  assert(input?.version === 1, 'Use recipe version 1.');
  const durationMs = number(input.durationMs, 1200, 6500, 'durationMs');
  const equipment = input.equipment ?? 'none';
  assert(validEquipment.has(equipment), 'Unknown equipment preset.');
  const catalogueCable = Object.hasOwn(catalogueCablePresets, equipment) ? catalogueCablePresets[equipment] : undefined;
  const handHeld = handHeldProps.get(equipment);
  const wearable = Object.hasOwn(wearableWeights, equipment) ? wearableWeights[equipment] : undefined;
  const dumbbellSupport = dumbbellSupports.get(equipment.replace(/-dumbbells?$/, ''));
  const dumbbellAccessory = handHeld?.support ?? kettleSupports.get(equipment)?.support ??
    ((equipment.endsWith('-dumbbell') || equipment.endsWith('-dumbbells')) ? dumbbellSupport : undefined);
  const catalogueSmallProp = smallPropPresets[equipment];
  const options = {
    catalogueSmallProp,
    seatedErgometer: seatedErgometers.has(equipment) ? equipment : undefined,
    assistedExercise: Object.hasOwn(assistedExercises, equipment) ? equipment : undefined,
    leverPull: Object.hasOwn(leverPulls, equipment) ? equipment : undefined,
    bodyweightProp: wearable?.bodyweight ?? handHeld?.bodyweight ?? kettleSupports.get(equipment)?.bodyweight ??
      (bodyweightProps.has(equipment) ? equipment : undefined),
    wearableWeight: wearable?.weight,
    suspensionRig: suspensionPresets.get(equipment),
    bandSupport: bandSupports.get(equipment),
    kettleSupport: kettleSupports.get(equipment),
    leverPressProp: leverPressProps.has(equipment) ? equipment.slice(12) : undefined,
    ropeProp: originalRopes.get(equipment),
    stretchSupport: stretchSupports.has(equipment) ? equipment : undefined,
    sledProp: sledProps.has(equipment) ? equipment.slice(5) : undefined,
    barbellSupport: barbellSupports[equipment],
    handHeldProp: handHeld?.kind,
    bells: handHeld?.count ?? wearable?.bells ?? (dumbbellSupport && dumbbellAccessory ? (equipment.endsWith('dumbbells') ? 2 : 1)
      : ({dumbbell: 1, dumbbells: 2, 'step-dumbbells': 2, 'mat-dumbbells': 2})[equipment] ?? 0),
    catalogueCable,
    cableCount: catalogueCable ? (catalogueCable.dual || (catalogueCable.rope && !catalogueCable.singleRope) || catalogueCable.ankle === 'tuck' ? 2 : 1)
      : ({cable: 1, 'cable-lat-bar': 1, 'cable-ankle': 1, 'dual-cable': 2, rope: 2})[equipment] ?? 0,
    indoorBike: equipment === 'rig-bike',
    treadmill: equipment === 'rig-treadmill' || equipment === 'rig-run-belt',
    runningClip: equipment === 'rig-run-belt',
    elliptical: equipment === 'rig-elliptical',
    stepmill: equipment === 'rig-stepmill',
    rower: equipment === 'rig-rower',
    carryKettles: equipment === 'rig-kettles-carry' || equipment === 'rig-single-carry',
    singleCarry: equipment === 'rig-single-carry',
    trapCarry: equipment === 'rig-trap-carry',
    jumpRope: equipment === 'rig-jump-rope',
    projectile: equipment === 'rig-pass-ball' || equipment === 'rig-slam-ball' || catalogueSmallProp === 'medicine' || catalogueSmallProp?.startsWith('massage') === true,
    massageBall: catalogueSmallProp?.startsWith('massage') ? catalogueSmallProp : undefined,
    targetWall: equipment === 'rig-pass-ball' || equipment === 'spotter-med-ball-wall-mat' || equipment === 'spotter-med-ball-wall-tall',
    tallTargetWall: equipment === 'spotter-med-ball-wall-tall',
    singleKettlebell: equipment === 'rig-single-kettlebell' || equipment === 'rig-goblet-plates',
    heelPlates: equipment === 'rig-goblet-plates',
    contactWall: equipment === 'rig-contact-wall' || equipment === 'rig-contact-tall-wall',
    tallContactWall: equipment === 'rig-contact-tall-wall',
    suitcaseBar: equipment === 'rig-suitcase-bar',
    rope: equipment === 'rope' || catalogueCable?.rope === true,
    band: equipment === 'band' || equipment === 'band-ankle',
    ankleCuff: equipment === 'band-ankle',
    bench: wearable?.bench === true || ['bench', 'bench-barbell', 'bench-ez-bar', 'spotter-med-ball-bench'].includes(equipment) || ['flat', 'wrist', 'seat-step'].includes(dumbbellAccessory),
    chestBench: dumbbellAccessory === 'chest',
    dumbbellAccessory,
    inclineBench: equipment === 'incline-bench-barbell',
    barbell: Boolean(barbellSupports[equipment]) || ['barbell', 'bench-barbell', 'incline-bench-barbell', 'bench-ez-bar'].includes(equipment),
    ezBar: equipment === 'bench-ez-bar' || equipment.startsWith('ez-'),
    neutralCurlBar: equipment === 'olympic-neutral-bar',
    trapBar: equipment === 'trap-bar',
    stretchBand: equipment.endsWith('stretch-band') || Boolean(kettleSupports.get(equipment)?.band),
    highMount: equipment === 'high-stretch-band' || equipment === 'high-seat-stretch-band',
    pullUp: catalogueCable?.pullUp ?? wearable?.pullUp ?? ({ 'neutral-pull-up': 'neutral', 'narrow-neutral-pull-up': 'narrow-neutral', 'pull-up': 'bar', 'wide-pull-up': 'wide' })[equipment],
    latBar: equipment === 'cable-lat-bar',
    cableAnkle: equipment === 'cable-ankle' || Boolean(catalogueCable?.ankle),
    legCurl: equipment === 'leg-curl' || equipment === 'standing-leg-curl',
    standingLegCurl: equipment === 'standing-leg-curl',
    stabilityBallWall: equipment === 'stability-ball-wall',
    secondaryBallRadius: stabilityBallPresets.get(equipment),
    ezBallSupport: equipment === 'ez-stability-ball',
    stabilityBall: ['stability-ball', 'stability-ball-wall', 'ez-stability-ball'].includes(equipment) || stabilityBallPresets.has(equipment) ||
      ['ball', 'incline-ball', 'wall-ball', 'wall-ball-knees', 'wall-ball-ankles'].includes(dumbbellAccessory) || catalogueCable?.support === 'ball',
    nordicAnchor: equipment === 'nordic-mat',
    handRoller: equipment === 'hand-roller' || ['foam', 'foam-wall', 'foam-long', 'wheel', 'wheel-band', 'wheel-wall'].includes(catalogueSmallProp),
    landmine: equipment === 'landmine',
    mat: wearable?.mat === true || handHeld?.support === 'floor-mat' || catalogueCable?.mat === true || ['mat', 'mat-dumbbell', 'mat-dumbbells', 'mat-stretch-band', 'mat-post-stretch-band', 'nordic-mat', 'stability-ball', 'stability-ball-wall',
      'spotter-med-ball-mat', 'spotter-med-ball-wall-mat', 'spotter-massage-ball', 'spotter-foam-roller', 'spotter-foam-long', 'spotter-ab-wheel-stretch-band'].includes(equipment),
    step: equipment === 'step' || equipment === 'step-dumbbells' || dumbbellAccessory === 'step' || calfRails.has(equipment),
    lowStep: equipment === 'step-dumbbells',
    calfRail: calfRails.get(equipment),
  };
  const muscles = input.muscles ?? [];
  assert(Array.isArray(muscles) && muscles.length <= 12 &&
    muscles.every((item) => typeof item === 'string' && musclePattern.test(item)), 'Unknown muscle highlight.');
  const source = input.keyframes;
  assert(Array.isArray(source) && source.length >= 3 && source.length <= 65, 'Use 3–65 ordered keyframes.');
  assert(source[0]?.at === 0 && source.at(-1)?.at === 1, 'First and last keyframes must be at 0 and 1.');
  const partner = source[0].partner != null;
  const formComparison = input.formComparison ?? false;
  assert(typeof formComparison === 'boolean' && (!formComparison || partner), 'A form comparison requires two athletes.');
  const frames = source.map((frame, index) => {
    assert(frame && typeof frame === 'object', 'Invalid keyframe.');
    const at = number(frame.at, 0, 1, 'keyframe.at');
    assert(index === 0 || at > source[index - 1].at, 'Keyframe times must strictly increase.');
    const pose = bodyPose(frame, index);
    assert((frame.partner != null) === partner, 'Keep the same number of athletes in every keyframe.');
    if (partner) pose.partner = bodyPose(frame.partner, index);
    if (options.singleKettlebell) {
      pose.bellCenter = vector(frame.bellCenter, 'bellCenter');
      pose.bellTilt = number(frame.bellTilt ?? 0, -2, 2, 'bellTilt');
    }
    if (options.projectile || options.stabilityBall) pose.ballCenter = vector(frame.ballCenter, 'ballCenter');
    if (options.secondaryBallRadius) pose.secondaryBallCenter = vector(frame.secondaryBallCenter, 'second stability ball center');
    if (catalogueSmallProp === 'tire') {
      pose.tireCenter = vector(frame.tireCenter, 'tire center');
      pose.tireAngle = number(frame.tireAngle, 0, Math.PI, 'tire angle');
    }
    if (dumbbellAccessory === 'wall-ball-knees' || dumbbellAccessory === 'wall-ball-ankles') {
      pose.tennisBall = vector(frame.tennisBall, 'tennis ball center');
    }
    pose.machineTravel = number(frame.machineTravel ?? 0, 0, 12, 'machineTravel');
    pose.followZ = number(frame.followZ ?? 0, -2, 2, 'followZ');
    if (options.kettleSupport) {
      const weights = frame.kettlebells;
      assert(Array.isArray(weights) && weights.length === options.kettleSupport.count, 'Match kettlebells to the equipment preset.');
      pose.kettlebells = weights.map(weight => ({
        grip: vector(weight?.grip, 'kettlebell grip'), handle: axis(weight?.handle, 'kettlebell handle alignment'),
        down: axis(weight?.down, 'kettlebell body direction'),
      }));
    }
    if (options.leverPressProp) {
      const handles = frame.leverPressHandles;
      assert(Array.isArray(handles) && handles.length === 2, 'Lever press requires two machine arms.');
      pose.leverPressHandles = handles.map((handle,index) => {
        const pivot = vector(handle?.pivot, 'lever arm pivot');
        assert(equal(pivot,source[0].leverPressHandles[index].pivot), 'The lever arm pivot must stay fixed.');
        return { pivot, point: vector(handle.point, 'lever arm grip'), axis: axis(handle.axis, 'lever grip alignment') };
      });
    }
    if (options.suspensionRig) {
      const links = frame.straps;
      const initial = source[0].straps;
      assert(Array.isArray(initial), 'Missing suspension setup.');
      const feet = options.suspensionRig.endsWith('foot');
      assert(Array.isArray(links) && links.length >= 1 && links.length <= 2 && links.length === initial.length,
        'Use one or two fixed suspension links.');
      assert(new Set(links.map((link) => link.side)).size === links.length, 'Use one suspension link per limb.');
      pose.straps = links.map(({ anchor, side, end: endpoint, axis: shaft }, index) => {
        assert((side === 'l' || side === 'r') && side === initial[index].side, 'Use the same straps throughout the exercise.');
        anchor = vector(anchor, 'strap anchor');
        number(anchor[1], 1.8, 3.0, 'suspension anchor height');
        assert(equal(anchor, initial[index].anchor) && anchor[1] === initial[0].anchor[1] &&
          anchor[2] === initial[0].anchor[2], 'Strap anchors must stay fixed on one beam.');
        const end = vector(endpoint, 'strap attachment');
        number(distance(pose[side + (feet ? 'a' : 'w')], end), 0, feet ? .105 : .005, 'strap contact gap');
        number(distance(anchor, end), .30, 2.9, 'strap length');
        assert(Math.abs(distance(anchor, end) - distance(anchor, initial[index].end)) <= .014,
          'Suspension straps cannot lengthen through the movement.');
        return { anchor, side, end, axis: axis(shaft, 'suspension handle axis') };
      });
    }
    if (options.ropeProp) {
      const tracks = frame.ropeTracks;
      assert(Array.isArray(tracks) && tracks.length === (options.ropeProp === 'battle' ? 2 : 1),
        'Match rope tracks to the equipment preset.');
      pose.ropeTracks = tracks.map((path,index) => {
        assert(Array.isArray(path) && path.length >= 2 && path.length <= 30 &&
          path.length === source[0].ropeTracks[index].length, 'Use matching rope paths of 2–30 points.');
        return path.map((point) => vector(point, 'rope point'));
      });
    }
    const bells = frame.dumbbells ?? [];
    assert(Array.isArray(bells) && bells.length === options.bells, 'Match dumbbells to the equipment preset.');
    pose.dumbbells = bells.map((bell) => ({center: vector(bell?.center, 'dumbbell center'), axis: axis(bell?.axis, 'dumbbell axis')}));
    if (options.barbell || options.trapBar) pose.barbell = {center: vector(frame.barbell?.center, 'barbell center'), axis: axis(frame.barbell?.axis, 'barbell axis')};
    if (options.stretchBand) {
      const path = frame.bandPath;
      assert(Array.isArray(path) && path.length >= 2 && path.length <= 8 &&
        path.length === source[0].bandPath.length, 'Use a stable 2–8 point band path.');
      pose.bandPath = path.map((joint) => vector(joint, 'band path point'));
      if (options.highMount) {
        assert(path.length === 3 && equal(path[1], source[0].bandPath[1]), 'The overhead band mount must stay fixed.');
        number(path[1][1], 1.4, 2.7, 'high band mount height');
      }
    }
    if (options.seatedErgometer === 'ergometer-arms') pose.ergometerCrank = number(frame.ergometerCrank, 0, 6*Math.PI, 'arm crank phase');
    if (options.assistedExercise) pose.assistedPadY = number(frame.assistedPadY, .05, 1.22, 'assistance pad height');
    if (options.leverPull) {
      const angles = frame.leverPullAngles;
      assert(Array.isArray(angles) && angles.length === 2, 'Use two lever angles.');
      pose.leverPullAngles = angles.map((angle) => number(angle, -Math.PI, Math.PI, 'lever pull angle'));
    }
    const cables = frame.cables ?? [];
    assert(Array.isArray(cables) && cables.length === options.cableCount, 'Match cables to the equipment preset.');
    pose.cables = cables.map((cable, cableIndex) => {
      const anchor = vector(cable?.anchor, 'cable anchor');
      number(anchor[1], .16, 2.7, 'cable anchor height');
      const firstAnchor = source[0].cables[cableIndex]?.anchor;
      assert(equal(anchor, firstAnchor), 'Cable anchors must stay fixed.');
      return {anchor, end: vector(cable.end, 'cable end'), grip: axis(cable.grip, 'cable grip'), kind: options.rope ? 'rope' : 'handle'};
    });
    if (options.rope && !catalogueCable?.singleRope) assert(equal(pose.cables[0].anchor, pose.cables[1].anchor), 'Both rope ends must use the same anchor.');
    if (options.legCurl) pose.roller = vector(frame.roller, 'leg curl roller');
    if (options.handRoller) pose.handRoller = {center: vector(frame.handRoller?.center, 'hand roller center'),
      axis: axis(frame.handRoller?.axis, 'hand roller axis')};
    if (options.band) {
      const anchor = vector(frame.band?.anchor, 'band anchor');
      number(anchor[1], .12, 2.6, 'band anchor height');
      assert(equal(anchor, source[0].band.anchor), 'Band anchor must stay fixed.');
      pose.band = {anchor, end: vector(frame.band.end, 'band end')};
    }
    if (options.landmine) {
      const pivot = vector(frame.landmine?.pivot, 'landmine pivot');
      assert(equal(pivot, source[0].landmine.pivot), 'Landmine pivot must stay fixed.');
      pose.landmine = {pivot, end: vector(frame.landmine.end, 'landmine end')};
    }
    return {at, pose};
  });
  const camera = {
    yaw: number(input.camera?.yaw ?? 38, -180, 180, 'camera.yaw'),
    elevation: number(input.camera?.elevation ?? 14, -5, 60, 'camera.elevation'),
    focus: vector(input.camera?.focus ?? [0, .93, 0], 'camera.focus'),
    height: number(input.camera?.height ?? 2.28, .9, 4.8, 'camera.height'),
  };

  function sample(phase) {
    const right = Math.max(1, frames.findIndex((frame) => frame.at >= phase));
    if (phase >= 1) return frames.at(-1).pose;
    const {at: start, pose: a} = frames[right - 1];
    const {at: end, pose: b} = frames[right];
    const weight = (phase - start) / (end - start);
    if (weight <= 0) return a;
    if (weight >= 1) return b;
    const pose = blendBody(a, b, weight);
    if (partner) pose.partner = blendBody(a.partner, b.partner, weight);
    if (options.singleKettlebell) {
      pose.bellCenter = blend(a.bellCenter, b.bellCenter, weight);
      pose.bellTilt = mix(a.bellTilt, b.bellTilt, weight);
    }
    if (options.projectile || options.stabilityBall) pose.ballCenter = blend(a.ballCenter, b.ballCenter, weight);
    if (options.secondaryBallRadius) pose.secondaryBallCenter = blend(a.secondaryBallCenter, b.secondaryBallCenter, weight);
    if (catalogueSmallProp === 'tire') {
      pose.tireCenter = blend(a.tireCenter, b.tireCenter, weight);
      pose.tireAngle = mix(a.tireAngle, b.tireAngle, weight);
    }
    if (options.leverPull) pose.leverPullAngles = blend(a.leverPullAngles, b.leverPullAngles, weight);
    if (options.seatedErgometer === 'ergometer-arms') pose.ergometerCrank = a.ergometerCrank+(b.ergometerCrank-a.ergometerCrank)*weight;
    if (options.assistedExercise) {
      pose.assistedPadY = a.assistedPadY+(b.assistedPadY-a.assistedPadY)*weight;
      if (assistedExercises[options.assistedExercise].platform) {
        pose.planted.l = pose.assistedPadY;
        if (!assistedExercises[options.assistedExercise].singleFoot) pose.planted.r = pose.assistedPadY;
      }
    }
    if (a.tennisBall) pose.tennisBall = blend(a.tennisBall, b.tennisBall, weight);
    pose.machineTravel = mix(a.machineTravel, b.machineTravel, weight);
    pose.followZ = mix(a.followZ, b.followZ, weight);
    if (options.kettleSupport) pose.kettlebells = a.kettlebells.map((bell,index) => ({
      grip: blend(bell.grip,b.kettlebells[index].grip,weight),
      handle: blend(bell.handle,b.kettlebells[index].handle,weight),
      down: blend(bell.down,b.kettlebells[index].down,weight),
    }));
    if (options.leverPressProp) pose.leverPressHandles = a.leverPressHandles.map((handle,index) => ({
      pivot:handle.pivot, point:blend(handle.point,b.leverPressHandles[index].point,weight),
      axis:blend(handle.axis,b.leverPressHandles[index].axis,weight),
    }));
    if (options.suspensionRig) pose.straps = a.straps.map((link, index) => ({
      ...link, end: blend(link.end, b.straps[index].end, weight), axis: blend(link.axis, b.straps[index].axis, weight),
    }));
    if (options.ropeProp) pose.ropeTracks = a.ropeTracks.map((path,index) =>
      path.map((point,position) => blend(point,b.ropeTracks[index][position],weight)));
    pose.dumbbells = a.dumbbells.map((bell, index) => ({
      center: blend(bell.center, b.dumbbells[index].center, weight),
      axis: blend(bell.axis, b.dumbbells[index].axis, weight),
    }));
    if (options.barbell || options.trapBar) {
      pose.barbell = {center: blend(a.barbell.center, b.barbell.center, weight), axis: blend(a.barbell.axis, b.barbell.axis, weight)};
    }
    if (options.stretchBand) pose.bandPath = a.bandPath.map((point,index)=>blend(point,b.bandPath[index],weight));
    pose.cables = a.cables.map((cable, index) => ({
      ...cable,
      end: blend(cable.end, b.cables[index].end, weight),
      grip: blend(cable.grip, b.cables[index].grip, weight),
    }));
    if (options.legCurl) pose.roller = blend(a.roller, b.roller, weight);
    if (options.handRoller) pose.handRoller = {center: blend(a.handRoller.center, b.handRoller.center, weight),
      axis: blend(a.handRoller.axis, b.handRoller.axis, weight)};
    if (options.band) pose.band = {anchor: a.band.anchor, end: blend(a.band.end, b.band.end, weight)};
    if (options.landmine) pose.landmine = {pivot: a.landmine.pivot, end: blend(a.landmine.end, b.landmine.end, weight)};
    return pose;
  }

  return {durationMs, camera, muscles, partner, formComparison, options, sample};
}
