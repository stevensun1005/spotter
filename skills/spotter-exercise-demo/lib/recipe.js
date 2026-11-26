import { seatedErgometers } from './seated-ergometer-geometry.js';
import { assistedExercises } from './assisted-exercise-geometry.js';
import { leverPulls } from './lever-pull-geometry.js';

const joints = ['hips', 'chest', 'neck', 'head', 'ls', 'le', 'lw', 'rs', 're', 'rw',
  'lh', 'lk', 'la', 'lt', 'rh', 'rk', 'ra', 'rt'];
const optionalVectors = ['lGrip', 'rGrip', 'lFingers', 'rFingers', 'lPalmSide', 'rPalmSide', 'headAim'];
const musclePattern = /^(?:(?:l|r):)?(?:lat|quad|glute|pec|core|shoulder|rearShoulder|forearm|biceps|triceps|trap|calf|hamstring)$/;
const cardioEquipment = [
  'rig-contact-wall', 'rig-suitcase-bar', 'rig-goblet-plates', 'rig-single-carry', 'rig-single-kettlebell', 'rig-pass-ball', 'rig-slam-ball', 'rig-bike', 'rig-treadmill', 'rig-run-belt', 'rig-elliptical', 'rig-stepmill', 'rig-rower', 'rig-kettles-carry', 'rig-trap-carry', 'rig-jump-rope',
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
  'spotter-bosu': 'bosu', 'spotter-foam-roller': 'foam', 'spotter-ab-wheel': 'wheel',
  'spotter-ab-wheel-stretch-band': 'wheel-band', 'spotter-tire-flip': 'tire',
};
for (const preset of Object.keys(smallPropPresets)) validEquipment.add(preset);
const stabilityBallPresets = new Map([['stability-ball-hug', .218], ['stability-ball-chest-stretch', .165]]);
for (const preset of stabilityBallPresets.keys()) validEquipment.add(preset);

for (const preset of seatedErgometers) validEquipment.add(preset);

const bodyweightProps = new Set([
  'extension-45', 'extension-flat', 'doorway', 'plyo-box', 'back-plate', 'assault-bike', 'incline-treadmill',
  'parallel-dips', 'cage-dips', 'straight-dip', 'dip-bench', 'double-dip-bench', 'inverted-row', 'inverted-high-row',
  'handstand-wall', 'drop-steps', 'ab-decline', 'ab-steep', 'ab-incline', 'captains-chair', 'under-bench',
  'balance-board', 'training-towel', 'slide-disc', 'fitness-rings', 'row-suspension',
  'front-suspension', 'press-suspension', 'foot-suspension',
]);
for (const preset of bodyweightProps) validEquipment.add(preset);

const bandSupports = new Map([['seat-stretch-band', 'seat'], ['high-seat-stretch-band', 'seat'], ['bench-stretch-band', 'flat'], ['post-stretch-band', 'post'], ['post-seat-stretch-band', 'post-seat']]);
for (const preset of bandSupports.keys()) validEquipment.add(preset);

const kettleSupports = new Map([
  ['kettlebells', { count: 2 }], ['kettlebell-left', { count: 1 }],
  ['mat-kettlebells', { count: 2, mat: true }], ['mat-kettlebell-left', { count: 1, mat: true }],
  ['seat-kettlebells', { count: 2, seat: true }], ['seat-kettlebell-left', { count: 1, seat: true }],
]);
for (const preset of kettleSupports.keys()) validEquipment.add(preset);

const leverPressProps = new Set(['lever-press-flat', 'lever-press-incline', 'lever-press-standing',
  'lever-press-fly', 'lever-press-reverse', 'lever-press-leg', 'lever-press-rotary-calf',
  'lever-press-seated-calf', 'lever-press-standing-calf', 'lever-press-hip', 'lever-press-crunch',
  'lever-press-twist', 'lever-press-reverse-hyper']);
for (const preset of leverPressProps) validEquipment.add(preset);

const originalRopes = new Map([['battle-ropes','battle'], ['climb-rope','climb'], ['stretch-rope','stretch'], ['extension-towel','towel']]);
for (const preset of originalRopes.keys()) validEquipment.add(preset);

const stretchSupports = new Set(['adductor-step','situp-anchor']);
for (const preset of stretchSupports) validEquipment.add(preset);

const sledProps = new Set(['sled-press', 'sled-press-lying', 'sled-hack', 'sled-standing-calf', 'sled-smith', 'sled-horizontal']);
for (const preset of sledProps) validEquipment.add(preset);

const barbellSupports = {
  'barbell-rack': 'rack', 'barbell-pins': 'pull-pins', 'barbell-bench-pins': 'press-pins',
  'barbell-decline': 'decline', 'ez-decline': 'decline', 'ez-incline': 'incline',
  'barbell-seat': 'seat', 'ez-seat': 'seat', 'barbell-preacher': 'preacher', 'ez-preacher': 'preacher',
  'barbell-chest-bench': 'chest-bench', 'ez-chest-bench': 'chest-bench',
  'barbell-onearm-bench': 'onearm-bench', 'barbell-rear-bench': 'rear-bench', 'barbell-plyo-box': 'plyo-box', 'smith-rear-bench': 'smith-rear-bench',
  'barbell-low-step': 'low-step', 'barbell-seat-step': 'seat-step', 'barbell-bench-elevated-feet': 'bridge-bench',
  'smith-standing': 'smith', 'smith-flat': 'smith-flat', 'smith-decline': 'smith-decline',
  'smith-incline': 'smith-incline', 'smith-seat': 'smith-seat', 'smith-box': 'smith-box',
  'smith-low-step': 'smith-low-step', 'smith-seat-step': 'smith-seat-step',
  'barbell-arm-blaster': 'arm-blaster', 'ez-arm-blaster': 'arm-blaster',
  'ez-stability-ball': 'free', 'ez-barbell': 'free',
};
for (const preset of Object.keys(barbellSupports)) validEquipment.add(preset);
const catalogueCablePresets = {
  'cable-lat-wide': { attachment: 'wide', support: 'lat' },
  'cable-lat-straight': { attachment: 'straight', support: 'lat' },
  'cable-lat-medium': { attachment: 'medium', support: 'lat' },
  'cable-lat-pro': { attachment: 'pro', support: 'lat' },
  'cable-lat-neutral': { attachment: 'v', support: 'lat' },
  'cable-lat-narrow': { attachment: 'narrow', support: 'lat' },
  'cable-lat-rope': { rope: true, support: 'lat' },
  'cable-lat-dual': { dual: true, support: 'lat' },
  'cable-straight-bar': { attachment: 'straight' },
  'cable-short-bar': { attachment: 'narrow' },
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
  'cable-row-wide': { attachment: 'wide', support: 'row' },
  'cable-row-rope': { rope: true, support: 'row' },
  'cable-elevated-row': { rope: true, support: 'high-row' },
  'cable-decline-row': { attachment: 'wide', support: 'decline-row' },
  'cable-floor-row': { attachment: 'wide', support: 'floor-row' },
  'cable-flat-bench': { dual: true, support: 'flat' },
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
  'cable-ankle-tuck': { ankle: 'tuck' },
};
for (const preset of Object.keys(catalogueCablePresets)) validEquipment.add(preset);
const dumbbellSupports = new Map([
  ['bench', 'flat'], ['chest-bench', 'chest'], ['incline-bench', 'incline'],
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

export function prepareRecipe(input) {
  assert(input?.version === 1, 'Use recipe version 1.');
  const durationMs = number(input.durationMs, 1200, 6500, 'durationMs');
  const equipment = input.equipment ?? 'none';
  assert(validEquipment.has(equipment), 'Unknown equipment preset.');
  const catalogueCable = Object.hasOwn(catalogueCablePresets, equipment) ? catalogueCablePresets[equipment] : undefined;
  const dumbbellSupport = dumbbellSupports.get(equipment.replace(/-dumbbells?$/, ''));
  const dumbbellAccessory = equipment.endsWith('-dumbbell') || equipment.endsWith('-dumbbells') ? dumbbellSupport : undefined;
  const catalogueSmallProp = smallPropPresets[equipment];
  const options = {
    catalogueSmallProp,
    seatedErgometer: seatedErgometers.has(equipment) ? equipment : undefined,
    assistedExercise: Object.hasOwn(assistedExercises, equipment) ? equipment : undefined,
    leverPull: Object.hasOwn(leverPulls, equipment) ? equipment : undefined,
    bodyweightProp: bodyweightProps.has(equipment) ? equipment : undefined,
    bandSupport: bandSupports.get(equipment),
    kettleSupport: kettleSupports.get(equipment),
    leverPressProp: leverPressProps.has(equipment) ? equipment.slice(12) : undefined,
    ropeProp: originalRopes.get(equipment),
    stretchSupport: stretchSupports.has(equipment) ? equipment : undefined,
    sledProp: sledProps.has(equipment) ? equipment.slice(5) : undefined,
    barbellSupport: barbellSupports[equipment],
    bells: dumbbellAccessory ? (equipment.endsWith('dumbbells') ? 2 : 1)
      : ({dumbbell: 1, dumbbells: 2, 'step-dumbbells': 2, 'mat-dumbbells': 2})[equipment] ?? 0,
    catalogueCable,
    cableCount: catalogueCable ? (catalogueCable.dual || catalogueCable.rope || catalogueCable.ankle === 'tuck' ? 2 : 1)
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
    projectile: equipment === 'rig-pass-ball' || equipment === 'rig-slam-ball' || catalogueSmallProp === 'medicine',
    targetWall: equipment === 'rig-pass-ball',
    singleKettlebell: equipment === 'rig-single-kettlebell' || equipment === 'rig-goblet-plates',
    heelPlates: equipment === 'rig-goblet-plates',
    contactWall: equipment === 'rig-contact-wall',
    suitcaseBar: equipment === 'rig-suitcase-bar',
    rope: equipment === 'rope' || catalogueCable?.rope === true,
    band: equipment === 'band' || equipment === 'band-ankle',
    ankleCuff: equipment === 'band-ankle',
    bench: ['bench', 'bench-barbell', 'bench-ez-bar', 'spotter-med-ball-bench'].includes(equipment) || ['flat', 'wrist', 'seat-step'].includes(dumbbellAccessory),
    chestBench: dumbbellAccessory === 'chest',
    dumbbellAccessory,
    inclineBench: equipment === 'incline-bench-barbell',
    barbell: Boolean(barbellSupports[equipment]) || ['barbell', 'bench-barbell', 'incline-bench-barbell', 'bench-ez-bar'].includes(equipment),
    ezBar: equipment === 'bench-ez-bar' || equipment.startsWith('ez-'),
    trapBar: equipment === 'trap-bar',
    stretchBand: equipment.endsWith('stretch-band'),
    highMount: equipment === 'high-stretch-band' || equipment === 'high-seat-stretch-band',
    pullUp: ({ 'neutral-pull-up': 'neutral', 'narrow-neutral-pull-up': 'narrow-neutral', 'pull-up': 'bar', 'wide-pull-up': 'wide' })[equipment],
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
    handRoller: equipment === 'hand-roller' || ['foam', 'wheel', 'wheel-band'].includes(catalogueSmallProp),
    landmine: equipment === 'landmine',
    mat: ['mat', 'mat-dumbbell', 'mat-dumbbells', 'mat-stretch-band', 'nordic-mat', 'stability-ball', 'stability-ball-wall',
      'spotter-med-ball-mat', 'spotter-foam-roller', 'spotter-ab-wheel-stretch-band'].includes(equipment),
    step: equipment === 'step' || equipment === 'step-dumbbells',
    lowStep: equipment === 'step-dumbbells',
  };
  const muscles = input.muscles ?? [];
  assert(Array.isArray(muscles) && muscles.length <= 12 &&
    muscles.every((item) => typeof item === 'string' && musclePattern.test(item)), 'Unknown muscle highlight.');
  const source = input.keyframes;
  assert(Array.isArray(source) && source.length >= 3 && source.length <= 65, 'Use 3–65 ordered keyframes.');
  assert(source[0]?.at === 0 && source.at(-1)?.at === 1, 'First and last keyframes must be at 0 and 1.');
  const frames = source.map((frame, index) => {
    assert(frame && typeof frame === 'object', 'Invalid keyframe.');
    const at = number(frame.at, 0, 1, 'keyframe.at');
    assert(index === 0 || at > source[index - 1].at, 'Keyframe times must strictly increase.');
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
    pose.headDrop = number(frame.headDrop ?? 0, -.09, .09, 'headDrop');
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
    if (options.rope) assert(equal(pose.cables[0].anchor, pose.cables[1].anchor), 'Both rope ends must use the same anchor.');
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
        pose.planted.l = pose.planted.r = pose.assistedPadY;
      }
    }
    if (a.tennisBall) pose.tennisBall = blend(a.tennisBall, b.tennisBall, weight);
    pose.machineTravel = mix(a.machineTravel, b.machineTravel, weight);
    pose.headDrop = mix(a.headDrop, b.headDrop, weight);
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

  return {durationMs, camera, muscles, options, sample};
}
