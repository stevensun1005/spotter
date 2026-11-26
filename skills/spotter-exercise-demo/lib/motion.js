const radians = Math.PI / 180;
const v = (x, y, z) => [x, y, z];
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, amount) => a.map(x => x * amount);
const mix = (a, b, f) => a + (b - a) * f;
const blend = (a, b, f) => a.map((x, i) => mix(x, b[i], f));
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const length = a => Math.hypot(...a);
const unit = a => mul(a, 1 / Math.max(.00001, length(a)));
const cross = (a, b) => v(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
const smooth = f => { const t = clamp(f, 0, 1); return t * t * (3 - 2 * t); };
const rep = (f, turn = .5) => f <= turn ? smooth(f / turn) : smooth((1 - f) / (1 - turn));
const sides = [['l', 1], ['r', -1]];
const ankleHeight = .075;
const stepTop = .31;
const armBones = [.252, .371];

// The elbow or knee remains on a fixed-length pair of bones, in the plane of the pole.
function solve(root, target, pole, first, second) {
  const ray = sub(target, root);
  const forward = unit(ray);
  const reach = clamp(length(ray), Math.abs(first - second) + .001, first + second - .002);
  const along = (first * first - second * second + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(0, first * first - along * along));
  const projected = sub(pole, mul(forward, dot(pole, forward)));
  const bend = length(projected) > .001 ? unit(projected) : unit(cross(forward, v(1, .2, 0)));
  return [add(root, add(mul(forward, along), mul(bend, height))), add(root, mul(forward, reach))];
}

function body(hips = v(0, .911, 0), yaw = 0, lean = 0, floor = false) {
  const right = v(Math.cos(yaw), 0, -Math.sin(yaw));
  const direction = v(Math.sin(yaw), 0, Math.cos(yaw));
  const up = floor ? v(0, 0, -1) : add(mul(direction, Math.sin(lean)), v(0, Math.cos(lean), 0));
  const front = cross(right, up);
  const at = (height, side = 0, depth = 0) => add(hips, add(mul(up, height), add(mul(right, side), mul(front, depth))));
  return {
    hips, chest: at(.369, 0, .006), neck: at(.605), head: at(.715, 0, .012),
    ls: at(.505, .192, .004), rs: at(.505, -.192, .004),
    lh: add(hips, mul(right, .100)), rh: add(hips, mul(right, -.100)),
    right, front, direction, pelvisUp: floor ? up : v(0, 1, 0),
    planted: {l: 0, r: 0},
    dumbbells: [], cables: [],
  };
}

function legs(p, left, right, toeOffsets = []) {
  for (const [i, [side, sign]] of sides.entries()) {
    const foot = i ? right : left;
    const drift = toeOffsets[i] ?? v(sign * .017, -.071, .143);
    const pole = p.front[1] > .9 ? v(sign * .17, 1, .06) : add(mul(p.direction, .96), v(sign * .16, 0, 0));
    [p[side + 'k'], p[side + 'a']] = solve(p[side + 'h'], foot, pole, .422, .424);
    p[side + 't'] = add(p[side + 'a'], drift);
  }
}

function arm(p, side, target, pole, grip) {
  [p[side + 'e'], p[side + 'w']] = solve(p[side + 's'], target, pole, ...armBones);
  if (grip) p[side + 'Grip'] = grip;
  return p[side + 'w'];
}

function relaxed(p, balance = 0) {
  for (const [side, sign] of sides) {
    const s = p[side + 's'];
    const target = add(s, v(sign * .037, -.593 + balance * .096, .032 + balance * .30));
    arm(p, side, target, v(sign * .45, 0, -.89));
  }
}

function frontSquat(f) {
  const d = rep(f, .57);
  const p = body(v(0, mix(.901, .532, d), mix(-.032, -.170, d)), 0, mix(.07, .31, d));
  legs(p, v(.174, ankleHeight, .085), v(-.174, ankleHeight, .085), [v(.045, -.071, .145), v(-.045, -.071, .145)]);
  for (const [side, sign] of sides) {
    const hand = arm(p, side, add(p[side + 's'], v(sign * .043, .103, .200)), v(sign * .19, -.16, 1), v(0, .15, 1));
    p.dumbbells.push({center: hand, axis: p[side + 'Grip']});
  }
  return p;
}

function floorPress(f) {
  const d = rep(f, .43);
  const p = body(v(0, .109, .240), 0, 0, true);
  p.neck[1] += .018;
  p.headDrop = .034;
  p.ls[1] += .014;
  p.rs[1] += .014;
  legs(p, v(.172, ankleHeight, .813), v(-.172, ankleHeight, .813), [v(.016, -.070, .149), v(-.016, -.070, .149)]);
  for (const [side, sign] of sides) {
    const target = v(sign * mix(.416, .219, d), mix(.433, .711, d), mix(-.234, -.285, d));
    const grip = v(1, sign * .04, .08);
    const hand = arm(p, side, target, v(sign, -.25, .60), grip);
    p.dumbbells.push({center: hand, axis: grip});
  }
  return p;
}

function suitcaseWalk(f) {
  const stride = 1.05;
  const z = (f - .5) * stride;
  const p = body(v(Math.sin(f * Math.PI * 2) * .025, .854 + .017 * Math.cos((f - .15) * Math.PI * 4), z),
    Math.sin(f * Math.PI * 2) * .075, .028);
  p.planted = {};
  const feet = sides.map(([side, sign], i) => {
    const step = f + .5 * i;
    const t = step % 1;
    const swing = clamp((t - .57) / .43, 0, 1);
    if (swing === 0) p.planted[side] = 0;
    return v(sign * .119, ankleHeight + Math.sin(swing * Math.PI) * .139,
      (Math.floor(step) - .5 * i - .5) * stride + .325 + smooth(swing) * stride);
  });
  legs(p, ...feet);
  const hand = arm(p, 'l', add(p.ls, v(.047, -.603, -.031)), v(.13, 0, -.92), v(0, .018, 1));
  arm(p, 'r', add(p.rs, v(-.033, -.558, Math.sin((f + .19) * Math.PI * 2) * .230)), v(-.12, 0, -.95));
  p.dumbbells.push({center: hand, axis: p.lGrip});
  p.followZ = z;
  return p;
}

function facePull(f) {
  const d = rep(f, .44);
  const p = body(v(0, .898, -.205), 0, -.025);
  const anchor = v(0, 1.62, 1.17);
  legs(p, v(.149, ankleHeight, -.13), v(-.144, ankleHeight, -.24));
  for (const [side, sign] of sides) {
    const target = v(sign * mix(.100, .270, d), mix(1.432, 1.582, d), mix(.376, .019, d));
    arm(p, side, target, v(sign, .038, -.08));
  }
  const middle = mul(add(p.lw, p.rw), .5);
  const halfSpread = length(sub(p.lw, middle));
  p.ropeJunction = add(middle, mul(unit(sub(anchor, middle)), Math.sqrt(.350 ** 2 - halfSpread ** 2)));
  for (const [side] of sides) {
    const hand = p[side + 'w'];
    const grip = unit(sub(p.ropeJunction, hand));
    p[side + 'Grip'] = grip;
    p.cables.push({anchor, end: hand, grip, kind: 'rope'});
  }
  return p;
}

function cableFly(f) {
  const d = rep(f, .45);
  const p = body(v(0, .844, .052), 0, .151);
  legs(p, v(.142, ankleHeight, .381), v(-.133, .128, -.297), [v(.016, -.071, .147), v(-.014, -.124, .133)]);
  for (const [side, sign] of sides) {
    const target = v(sign * mix(.739, -.031, d), mix(1.316, 1.073 + sign * .055, d), mix(.040, .551 + sign * .041, d));
    const grip = unit(v(.22 * sign, .95, mix(.04, .26, d)));
    const hand = arm(p, side, target, v(sign * .86, -.52, -.145), grip);
    p.cables.push({anchor: v(sign * .92, 1.93, -.42), end: hand, grip, kind: 'd'});
  }
  return p;
}

function twoHandCable(p, center, grip, anchor, poleFor, maxReach = armBones[0] + armBones[1] - .003) {
  // Shift the common handle, preserving both fixed hand positions along its shaft.
  for (let pass = 0; pass < 4; pass++) {
    for (const [side, sign] of sides) {
      const shoulder = p[side + 's'];
      const wrist = add(center, mul(grip, .045 * sign));
      const ray = sub(wrist, shoulder);
      const excess = length(ray) - maxReach;
      if (excess > 0) center = add(center, mul(unit(ray), -excess));
    }
  }
  for (const [side, sign] of sides) {
    arm(p, side, add(center, mul(grip, .045 * sign)), poleFor(sign), grip);
  }
  p.cables.push({ anchor, end: mul(add(p.lw, p.rw), .5), grip, kind: 'd', twoHanded: true });
}

function pallof(f) {
  const d = rep(f, .43);
  const p = body(v(.058, .886, -.067), 0, .024);
  legs(p, v(.219, ankleHeight, -.026), v(-.116, ankleHeight, -.020));
  const center = v(.065, 1.265, mix(.173, .486, d));
  twoHandCable(p, center, unit(v(0, 1, .14)), v(-1.05, 1.27, 0), sign => v(sign * .85, -.51, 0));
  return p;
}

function bandPallof(f) {
  const d = rep(f, .43);
  const p = body(v(.058, .886, -.067), 0, .024);
  legs(p, v(.219, ankleHeight, -.026), v(-.116, ankleHeight, -.020));
  const anchor = v(-1.08, 1.255, -.02);
  const center = v(.056, 1.255, mix(.151, .479, d));
  twoHandCable(p, center, unit(v(0, 1, .08)), anchor, sign => v(sign * .85, -.51, 0));
  p.band = {anchor, end: p.cables[0].end};
  p.cables = [];
  return p;
}

function reverseChop(f) {
  const d = rep(f, .47);
  const p = body(v(mix(-.043, .052, d), mix(.839, .885, d), -.017), mix(-43, 43, d) * radians, mix(.17, .045, d));
  const heel = mix(ankleHeight, .124, d);
  legs(p, v(.209, ankleHeight, .074), v(-.213, heel, -.055), [v(.045, -.071, .134), v(-.029, .004 - heel, .134)]);
  const center = blend(v(-.404, .830, .172), v(.411, 1.648, .337), d);
  const grip = unit(v(mix(.36, .55, d), mix(.82, .62, d), .118));
  twoHandCable(p, center, grip, v(-1.05, .230, 0), sign => v(sign * .41, -.70, -.11), .539);
  return p;
}

function splitSquat(f) {
  const d = rep(f, .56);
  const p = body(v(.012, mix(.826, .525, d), mix(.024, .100, d)), .06, mix(.050, .140, d));
  legs(p, v(.137, ankleHeight, .392), v(-.122, .137, -.318), [v(.019, -.071, .148), v(-.021, -.133, .126)]);
  relaxed(p, .27 + .18 * d);
  return p;
}

function stepUp(f) {
  const d = rep(f, .43);
  const p = body(v(.065, mix(.780, 1.215, d), mix(-.132, .491, d)), -.032, mix(.23, .029, d));
  const freeY = ankleHeight + .330 * smooth(d / .72);
  const freeZ = mix(-.204, .407, smooth((d - .16) / .84));
  legs(p, v(.130, stepTop + ankleHeight, .506), v(-.130, freeY, freeZ), [v(.014, -.071, .137), v(-.02, -.071, .134)]);
  p.planted = d === 0 ? {l: stepTop, r: 0} : {l: stepTop};
  relaxed(p, .27 * (1 - d));
  return p;
}

function landmine(f) {
  const d = rep(f, .45);
  const p = body(v(.019, .861 + .028 * d, -.060 + .105 * d), -.048, mix(.17, .206, d));
  legs(p, v(.146, ankleHeight, .229), v(-.142, .119, -.275), [v(.018, -.071, .145), v(-.028, -.115, .136)]);
  const pivot = v(.221, .089, 1.550);
  const angle = mix(41, 58, d) * radians;
  const axis = v(0, Math.sin(angle), -Math.cos(angle));
  const target = add(pivot, mul(axis, 1.575));
  const hand = arm(p, 'l', target, v(.26, -.99, -.20), axis);
  arm(p, 'r', add(p.rs, v(-.072, -.345, .205)), v(-.75, -.25, -.21));
  p.landmine = {pivot, end: hand};
  return p;
}

const moves = {
  '2966': frontSquat, '3668': floorPress, '2910': suitcaseWalk,
  '5609': facePull, '8141': cableFly, '1202': pallof, '0979': bandPallof, '8193': reverseChop,
  '0781': splitSquat, '0801': stepUp, '5094': landmine,
};

export const poseFor = (id, phase) => moves[id]((phase % 1 + 1) % 1);
