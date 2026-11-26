const joints = ['hips', 'chest', 'neck', 'head', 'ls', 'le', 'lw', 'rs', 're', 'rw',
  'lh', 'lk', 'la', 'lt', 'rh', 'rk', 'ra', 'rt'];
const optionalVectors = ['lGrip', 'rGrip', 'lFingers', 'rFingers', 'lPalmSide', 'rPalmSide'];
const musclePattern = /^(?:(?:l|r):)?(?:lat|quad|glute|pec|core|shoulder|rearShoulder|forearm|triceps)$/;
const cardioEquipment = [
  'rig-contact-wall', 'rig-suitcase-bar', 'rig-goblet-plates', 'rig-single-carry', 'rig-single-kettlebell', 'rig-pass-ball', 'rig-slam-ball', 'rig-bike', 'rig-treadmill', 'rig-run-belt', 'rig-elliptical', 'rig-stepmill', 'rig-rower', 'rig-kettles-carry', 'rig-trap-carry', 'rig-jump-rope',
];
const validEquipment = new Set([...cardioEquipment, 'none', 'mat', 'step', 'step-dumbbells', 'dumbbell', 'dumbbells',
  'mat-dumbbells', 'chest-bench-dumbbells', 'band', 'band-ankle', 'stretch-band', 'mat-stretch-band', 'high-stretch-band', 'barbell', 'trap-bar', 'bench', 'bench-barbell', 'bench-dumbbell', 'bench-dumbbells', 'neutral-pull-up', 'pull-up', 'cable', 'dual-cable', 'cable-lat-bar', 'leg-curl', 'rope', 'landmine']);
for (const preset of ['incline-bench-barbell', 'bench-ez-bar', 'cable-ankle', 'stability-ball', 'standing-leg-curl', 'nordic-mat', 'hand-roller', 'wide-pull-up']) {
  validEquipment.add(preset);
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
  const options = {
    bells: ({dumbbell: 1, dumbbells: 2, 'step-dumbbells': 2, 'mat-dumbbells': 2, 'chest-bench-dumbbells': 2,
      'bench-dumbbell': 1, 'bench-dumbbells': 2})[equipment] ?? 0,
    cableCount: ({cable: 1, 'cable-lat-bar': 1, 'cable-ankle': 1, 'dual-cable': 2, rope: 2})[equipment] ?? 0,
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
    projectile: equipment === 'rig-pass-ball' || equipment === 'rig-slam-ball',
    targetWall: equipment === 'rig-pass-ball',
    singleKettlebell: equipment === 'rig-single-kettlebell' || equipment === 'rig-goblet-plates',
    heelPlates: equipment === 'rig-goblet-plates',
    contactWall: equipment === 'rig-contact-wall',
    suitcaseBar: equipment === 'rig-suitcase-bar',
    rope: equipment === 'rope',
    band: equipment === 'band' || equipment === 'band-ankle',
    ankleCuff: equipment === 'band-ankle',
    bench: ['bench', 'bench-barbell', 'bench-dumbbell', 'bench-dumbbells', 'bench-ez-bar'].includes(equipment),
    chestBench: equipment === 'chest-bench-dumbbells',
    inclineBench: equipment === 'incline-bench-barbell',
    barbell: ['barbell', 'bench-barbell', 'incline-bench-barbell', 'bench-ez-bar'].includes(equipment),
    ezBar: equipment === 'bench-ez-bar',
    trapBar: equipment === 'trap-bar',
    stretchBand: equipment.endsWith('stretch-band'),
    highMount: equipment === 'high-stretch-band',
    pullUp: ({ 'neutral-pull-up': 'neutral', 'pull-up': 'bar', 'wide-pull-up': 'wide' })[equipment],
    latBar: equipment === 'cable-lat-bar',
    cableAnkle: equipment === 'cable-ankle',
    legCurl: equipment === 'leg-curl' || equipment === 'standing-leg-curl',
    standingLegCurl: equipment === 'standing-leg-curl',
    stabilityBall: equipment === 'stability-ball',
    nordicAnchor: equipment === 'nordic-mat',
    handRoller: equipment === 'hand-roller',
    landmine: equipment === 'landmine',
    mat: ['mat', 'mat-dumbbells', 'mat-stretch-band', 'nordic-mat', 'stability-ball'].includes(equipment),
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
    pose.machineTravel = number(frame.machineTravel ?? 0, 0, 12, 'machineTravel');
    pose.headDrop = number(frame.headDrop ?? 0, -.09, .09, 'headDrop');
    pose.followZ = number(frame.followZ ?? 0, -2, 2, 'followZ');
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
    pose.planted = {};
    for (const side of ['l', 'r']) {
      if (a.planted[side] === b.planted[side]) pose.planted[side] = a.planted[side];
    }
    if (options.singleKettlebell) {
      pose.bellCenter = blend(a.bellCenter, b.bellCenter, weight);
      pose.bellTilt = mix(a.bellTilt, b.bellTilt, weight);
    }
    if (options.projectile || options.stabilityBall) pose.ballCenter = blend(a.ballCenter, b.ballCenter, weight);
    pose.machineTravel = mix(a.machineTravel, b.machineTravel, weight);
    pose.headDrop = mix(a.headDrop, b.headDrop, weight);
    pose.followZ = mix(a.followZ, b.followZ, weight);
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
