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

function pullUp(f, neutral = true) {
  const t = rep(f, .45);
  const hip = v(0, mix(1.024, 1.536, t), mix(.030, -.084, t));
  const p = body(hip, 0, mix(0, -.087, t));
  legs(p, v(.087, hip[1] - .824, hip[2] + .076),
    v(-.087, hip[1] - .824, hip[2] + .076),
    [v(.013, -.123, .107), v(-.013, -.123, .107)]);
  p.planted = {};
  for (const [side, sign] of sides) {
    const width = neutral ? .193 : .305;
    arm(p, side, v(sign * width, 2.144, .097), v(sign * .29, -.84, .54), neutral ? v(0,0,1) : v(1,0,0));
  }
  return p;
}

function kneelingLandmine(f) {
  const d = rep(f, .47);
  const p = body(v(.004, .456, -.022), -.033, mix(.024, .079, d));
  for (const [side, sign] of sides) {
    p[side + 'k'] = v(sign * .128, .077, .100);
    p[side + 'a'] = v(sign * .137, .093, -.315);
    p[side + 't'] = v(sign * .143, .011, -.452);
  }
  p.planted = {};
  const pivot = v(.201, .089, 1.050);
  const angle = mix(44, 67, d) * radians;
  const axis = v(0, Math.sin(angle), -Math.cos(angle));
  const hand = arm(p, 'l', add(pivot, mul(axis, 1.271)), v(.44, -.87, .18), axis);
  arm(p, 'r', add(p.rs, v(-.041, -.413, .126)), v(-.78, -.17, -.44));
  p.landmine = {pivot, end: hand};
  return p;
}

function bandHipAdduction(f) {
  const d = rep(f, .46);
  const p = body(v(-.082, .882, .025), -.014, .017);
  const free = v(mix(.420, -.226, d), mix(.145, .177, d), mix(.093, .223, d));
  legs(p, free, v(-.202, ankleHeight, .020),
    [v(.021, -.068, .152), v(-.006, -.071, .149)]);
  p.planted = {r: 0};
  const cuff = add(p.la, v(0, .083, 0));
  p.band = {anchor: v(1.02, .186, .093), end: cuff};
  arm(p, 'r', v(-.510, 1.108, .30), v(-.72, -.61, .25), v(0, 0, 1));
  arm(p, 'l', add(p.ls, v(.043, -.47, .104)), v(.82, -.34, -.51));
  return p;
}

function singleLegBenchBridge(f) {
  const d = rep(f, .46);
  const hip = v(0, mix(.112, .409, d), mix(.182, .109, d));
  const p = body(hip, 0, 0, true);
  for (const joint of ['neck', 'head', 'ls', 'rs']) {
    p[joint][1] = .117;
    p[joint][2] -= hip[2] - .182;
  }
  p.chest = blend(hip, p.neck, .60);
  p.headDrop = .019;
  legs(p, v(.184, .535, .817),
    add(hip, v(-.163, mix(.553, .430, d), mix(.589, .695, d))),
    [v(.012, -.072, .158), v(-.016, .159, .027)]);
  p.planted = {l: .460};
  for (const [side, sign] of sides) {
    arm(p, side, v(sign * .431, .074, .105), v(sign * .58, -.67, -.27));
  }
  return p;
}

function kneelingHighPulldown(f) {
  const d = rep(f, .47);
  const p = body(v(0, .452, -.141), 0, mix(0, -.094, d));
  for (const [side, sign] of sides) {
    p[side + 'k'] = v(sign * .125, .080, -.020);
    p[side + 'a'] = v(sign * .139, .098, -.436);
    p[side + 't'] = v(sign * .145, .011, -.581);
    arm(p, side, v(sign * .325, mix(1.44, .996, d), mix(.126,.114,d)),
      v(sign * .72, -.87, -.16), v(1, 0, 0));
  }
  p.planted = {};
  p.cables = [{anchor:v(0,1.962,.496),end:mul(add(p.lw,p.rw),.5),grip:v(1,0,0)}];
  return p;
}

function proneLegCurl(f, alternating) {
  const cycle = f * (alternating ? 2 : 1);
  const phase = cycle % 1;
  const lowering = cycle < 1 ? 'l' : 'r';
  const peak = 1.64;
  const extension = -.12;
  const raise = smooth(phase / .38);
  const lower = smooth((phase - .49) / .34);
  const separate = alternating ? smooth((phase - .38) / .12) * (1 - smooth((phase - .92) / .08)) : 0;
  const hip = v(0, .673, .251);
  const p = body(hip, Math.PI, 0, true);
  p.neck[1] = .644;
  p.headDrop = -.018;
  p.planted = {};
  for (const [side, sign] of sides) {
    const support = !alternating || side === lowering;
    const lateReturn = smooth((phase - .70) / .22);
    const flexion = mix(extension, peak, raise * (1 - (support ? lower : lateReturn)));
    const knee = v(-sign * .108,.597,.663);
    const shift = support ? 0 : .224 * separate;
    const radius = Math.sqrt(.424 ** 2 - shift ** 2);
    const ankle = add(knee, v(-sign * shift,Math.sin(flexion)*radius,Math.cos(flexion)*radius));
    p[side + 'k'] = knee;
    p[side + 'a'] = ankle;
    p[side + 't'] = add(ankle, v(0,-Math.cos(flexion)*.146+Math.sin(flexion)*.066,
      Math.sin(flexion)*.146+Math.cos(flexion)*.066));
    arm(p, side, v(-sign*.30,.491,-.526), v(-sign*.76,-.37,.22), v(0,0,1));
    if (support) {
      const rollerRadius = .424;
      p.roller = v(0, knee[1] + Math.sin(flexion) * rollerRadius + Math.cos(flexion) * .084,
        knee[2] + Math.cos(flexion) * rollerRadius - Math.sin(flexion) * .084);
    }
  }
  return p;
}

function chestSupportedDumbbellRaise(f) {
  const d = rep(f, .48);
  const p = body(v(0, .486, .259), Math.PI, 45 * radians);
  for (const [side, sign] of sides) {
    const x = -sign;
    const foot = v(x * .326, ankleHeight, .512);
    [p[side + 'k'], p[side + 'a']] = solve(p[side + 'h'], foot, v(x * .86, .06, -.55), .422, .424);
    p[side + 't'] = add(foot, v(x * .047, -.071, -.141));
    const target = v(x * mix(.233, .794, d), mix(.265, .797, d), mix(-.101, -.035, d));
    const grip = v(x * mix(.05, .04, d), mix(.02, .122, d), 1);
    const hand = arm(p, side, target, v(x * .22, -.66, .702), grip);
    p.dumbbells.push({center: hand, axis: grip});
  }
  return p;
}

function proneBody(hip, pitch) {
  const p = body(hip, Math.PI, 0, true);
  for (const joint of ['ls', 'rs', 'neck', 'chest', 'head']) {
    const [, y, z] = sub(p[joint], hip);
    p[joint][1] = hip[1] + Math.cos(pitch) * y - Math.sin(pitch) * z;
    p[joint][2] = hip[2] + Math.sin(pitch) * y + Math.cos(pitch) * z;
  }
  return p;
}

function floorPalm(p, side) {
  p[side + 'Fingers'] = v(0, 0, -1);
  p[side + 'PalmSide'] = v(-1, 0, 0);
}

function deadBug(f) {
  const d = rep((f * 2) % 1, .49);
  const p = body(v(0, .135, .160), 0, 0, true);
  p.neck[1] += .018;
  p.headDrop = .032;
  p.planted = {};
  for (const [side, sign] of sides) {
    const armLong = (f < .5 ? side === 'r' : side === 'l') ? d : 0;
    const legLong = (f < .5 ? side === 'l' : side === 'r') ? d : 0;
    const shoulder = p[side + 's'];
    const angle = mix(.045, 1.53, armLong);
    arm(p, side, add(shoulder, v(sign * .023, .604 * Math.cos(angle), -.604 * Math.sin(angle))),
      v(sign * .43, .19, .70));
    const ankle = v(sign * .137, mix(.522, .169, legLong), mix(.596, .980, legLong));
    [p[side + 'k'], p[side + 'a']] = solve(p[side + 'h'], ankle, v(sign * .085, 1, -.21), .422, .424);
    p[side + 't'] = add(p[side + 'a'], v(sign * .016, .138, .062));
  }
  return p;
}

function calfRaise(f) {
  const d = smooth(f / .34) * (1 - smooth((f - .57) / .43));
  const height = .131 * d;
  const p = body(v(0, .888 + height, .024 * d), 0, .027);
  legs(p, v(.112, ankleHeight + height, .024 * d), v(-.112, ankleHeight + height, .024 * d),
    [v(.014, .020 - ankleHeight - height, .154 - .024 * d),
      v(-.014, .020 - ankleHeight - height, .154 - .024 * d)]);
  relaxed(p, .055);
  return p;
}

function forearmPlank(f) {
  const start = smooth(f / .29) * (1 - smooth((f - .81) / .19));
  const steady = Math.sin(f * Math.PI * 4) * .004 * start;
  const y = mix(.177, .255, start) + steady;
  const kneeY = mix(.081, .168, start);
  const kneeDepth = .988 - Math.sqrt(.424 ** 2 - (kneeY - .113) ** 2);
  const z = kneeDepth - Math.sqrt(.422 ** 2 - (y - kneeY) ** 2);
  const p = proneBody(v(0, y, z), Math.atan2(y - .113, .988 - z));
  p.planted = {};
  for (const [side, sign] of sides) {
    const x = -sign;
    p[side + 'e'] = v(x * .186, .064, -.269);
    p[side + 'w'] = v(x * .169, .056, -.606);
    floorPalm(p, side);
    p[side + 'k'] = v(x * .099,kneeY,kneeDepth);
    p[side + 'a'] = v(x * .097, .113, .988);
    p[side + 't'] = v(x * .110, .026, .891);
  }
  return p;
}

function birdDog(f) {
  const d = rep((f * 2) % 1, .48);
  const p = proneBody(v(0, .546, .181), 0);
  p.planted = {};
  for (const [side, sign] of sides) {
    const x = -sign;
    const usingArm = f < .5 ? side === 'r' : side === 'l';
    const a = usingArm ? d : 0;
    const l = usingArm ? 0 : d;
    arm(p, side, v(x * mix(.228, .215, a), mix(.046, .526, a), mix(-.511, -.900, a)),
      v(x * .42, .12, .86));
    floorPalm(p, side);
    const ankle = v(x * .132,mix(.103,.499,l),mix(.600,1.006,l));
    [p[side + 'k'], p[side + 'a']] = solve(p[side + 'h'], ankle, v(x*.08,-1,-.025), .422, .424);
    p[side + 't'] = add(p[side + 'a'], v(x*.022, -.077, .129));
  }
  return p;
}

function pushUp(f) {
  const d = rep(f, .52);
  const y = mix(.394, .160, d);
  const span = Math.sqrt(.839 ** 2 - (y - .104) ** 2);
  const p = proneBody(v(0, y, .973 - span), Math.atan2(y - .104, span));
  p.planted = {};
  for (const [side, sign] of sides) {
    const x = -sign;
    arm(p, side, v(x * .261, .043, -.377), v(x * .47, .42, .70));
    floorPalm(p, side);
    const ankle = v(x*.086,.104,.973);
    [p[side + 'k'], p[side + 'a']] = solve(p[side + 'h'], ankle, v(x*.025,.98,.17), .422, .424);
    p[side + 't'] = add(p[side + 'a'], v(x*.014,-.078,-.104));
  }
  return p;
}

function heelBridge(f) {
  const d = rep(f, .46);
  const hip = v(0,mix(.113,.434,d),mix(.038,-.055,d));
  const p = body(hip, 0, 0, true);
  for (const joint of ['neck','head','ls','rs']) {
    p[joint][1] = .115;
    p[joint][2] -= hip[2] - .038;
  }
  p.chest = blend(hip, p.neck, .60);
  p.headDrop = .020;
  legs(p,v(.153,.108,.516),v(-.153,.108,.516),
    [v(.015,.093,.126),v(-.015,.093,.126)]);
  p.planted = {l:.024,r:.024};
  for (const [side, sign] of sides) {
    arm(p,side,v(sign*.374,.045,-.062),v(sign*.81,-.55,-.15));
    p[side + 'Fingers'] = v(0,0,1);
    p[side + 'PalmSide'] = v(1,0,0);
  }
  return p;
}

function barbellSquat(phase, rack, pause = false) {
  const d = pause ? smooth(phase/.263) * (1-smooth((phase-.651)/.349)) : rep(phase,.55);
  const front = rack === 'front';
  const p = body(v(0,mix(.890,.507,d),mix(-.022,-.141,d)),0,mix(.068,front ? .244 : .392,d));
  legs(p,v(.151,ankleHeight,.070),v(-.151,ankleHeight,.070),
    [v(.046,-.071,.145),v(-.046,-.071,.145)]);
  const z = front ? p.ls[2]+.100 : p.ls[2]-.086;
  const y = p.ls[1]+(front ? .043 : .038);
  const axis = v(1,0,0);
  for (const [side,sign] of sides) {
    arm(p,side,v(sign*(front ? .339 : .402),y,z),
      front ? v(sign*.28,.44,.94) : v(sign*.37,-.71,-.32),axis);
  }
  p.barbell = {center: v(0,y,z),axis};
  return p;
}

function barbellRDL(f) {
  const d = rep(f,.60);
  const p = body(v(0,mix(.889,.836,d),mix(-.035,-.249,d)),0,mix(.054,1.043,d));
  legs(p,v(.119,ankleHeight,.048),v(-.119,ankleHeight,.048));
  const z = mix(.109,.133,d);
  const reach = Math.sqrt(.619 ** 2 - (.281 - p.ls[0]) ** 2 - (z - p.ls[2]) ** 2);
  const y = Math.max(mix(.799,.537,d), p.ls[1] - reach);
  const axis = v(1,0,0);
  for (const [side,sign] of sides) {
    arm(p,side,v(sign*.281,y,z),v(sign*.32,.04,-.91),axis);
  }
  p.barbell = {center:v(0,y,z),axis};
  return p;
}

function barbellBenchPress(f) {
  const d = rep(f,.55);
  const hip = v(.10,.575,1.267);
  const p = body(hip,0,0,true);
  p.neck[1] += .014;
  p.headDrop = .029;
  legs(p,v(.429,.078,1.338),v(-.229,.078,1.338),
    [v(.025,-.071,.146),v(-.025,-.071,.146)]);
  const axis = v(1,0,0);
  const y = mix(1.118,.699,d);
  const z = mix(.733,.874,d);
  for(const [side,sign] of sides){
    arm(p,side,v(hip[0]+sign*.379,y,z),v(sign*.86,-.29,.05),axis);
  }
  p.barbell={center:v(hip[0],y,z),axis};
  return p;
}

function barbellHipThrust(f) {
  const d=rep(f,.48);
  const hip=v(.10,mix(.233,.625,d),mix(1.704,1.817,d));
  const p=body(hip,0,0,true);
  p.headDrop=.004;
  for(const joint of ['ls','rs','neck','head']){
    p[joint][1]=.563;
    p[joint][2]-=hip[2]-1.781;
  }
  p.chest=blend(hip,p.neck,.60);
  legs(p,v(.278,.080,2.173),v(-.078,.080,2.173));
  const axis=v(1,0,0);
  const [x,y,z]=add(hip,v(0,.111,.047));
  for(const [side,sign] of sides){
    arm(p,side,v(x+sign*.228,y,z),v(sign*.63,.35,-.31),axis);
  }
  p.barbell={center:v(x,y,z),axis};
  return p;
}

function standingBalance(f) {
  const phase = f*2 % 1;
  const hold=smooth(phase/.30)*(1-smooth((phase-.70)/.30));
  const liftLeft=f<.5;
  const p=body(v((liftLeft ? -.078 : .078)*hold,.889-.013*hold,.010),0,0);
  for(const [side,sign] of sides){
    const active=side===(liftLeft?'l':'r');
    const raise=active ? hold : 0;
    const ankle=v(sign*.10,mix(ankleHeight,.197,raise),mix(.046,.081,raise));
    [p[side+'k'],p[side+'a']]=solve(p[side+'h'],ankle,v(sign*.14,0,1),.422,.424);
    p[side+'t']=add(p[side+'a'],v(sign*.020,-.071,.139));
    if(raise>.001) delete p.planted[side];
  }
  relaxed(p,.05);
  return p;
}

function reverseOverheadLunge(f) {
  const phase=f*2%1;
  const rearSide=f<.5?'l':'r';
  const travel=smooth(phase/.29)*(1-smooth((phase-.76)/.24));
  const bottom=smooth((phase-.25)/.25)*(1-smooth((phase-.53)/.25));
  const swingPhase=phase<.30?phase/.30:phase>.76?(phase-.76)/.24:0;
  const swing=.117*Math.sin(Math.PI*swingPhase);
  const p=body(v(0,mix(.884,.561,bottom),mix(.006,-.095,travel)),0,mix(.049,.108,bottom));
  for(const [side,sign] of sides){
    const rear=side===rearSide;
    const foot=v(sign*.139,.075+(rear ? .047*travel+swing : 0),.059-(rear ? .568*travel : 0));
    [p[side+'k'],p[side+'a']]=solve(p[side+'h'],foot,v(sign*.14,.06,1),.422,.424);
    p[side+'t']=add(p[side+'a'],v(sign*.017,-.071-(rear ? .046*travel : 0),.136));
    if(rear && swing>.001) delete p.planted[side];
    const angle=Math.PI*mix(.044,.956,bottom);
    const target=add(p[side+'s'],v(sign*.067,-.590*Math.cos(angle),.590*Math.sin(angle)));
    arm(p,side,target,v(sign*.32,-.10,-.84));
  }
  return p;
}

function hammerCurl(f) {
  const d = rep(f,.46);
  const p = body(v(0,.887,.007),0,.018);
  legs(p,v(.135,ankleHeight,.056),v(-.135,ankleHeight,.056));
  const angle=mix(.095,2.38,d);
  for (const [side,sign] of sides) {
    const elbow=add(p[side+'s'],v(sign*.024,-.249,.015));
    p[side+'e']=elbow;
    p[side+'w']=add(elbow,v(sign*.012,-.371*Math.cos(angle),.371*Math.sin(angle)));
    const axis=v(0,Math.sin(angle),Math.cos(angle));
    p[side+'Grip']=axis;
    p.dumbbells.push({center:p[side+'w'],axis});
  }
  return p;
}

function dumbbellRearFly(f) {
  const d=rep(f,.49);
  const p=body(v(0,.836,-.197),0,1.040);
  legs(p,v(.149,ankleHeight,.064),v(-.149,ankleHeight,.064));
  for(const [side,sign] of sides){
    const angle=mix(.125,1.48,d);
    const target=add(p[side+'s'],v(sign*.600*Math.sin(angle),-.600*Math.cos(angle),.023));
    const axis=v(0,.06+.18*d,1);
    const hand=arm(p,side,target,v(sign*.27,-.73,.48),axis);
    p.dumbbells.push({center:hand,axis});
  }
  return p;
}

function dumbbellPushPress(f) {
  const dip=smooth(f/.16)*(1-smooth((f-.16)/.26));
  const press=smooth((f-.21)/.235)*(1-smooth((f-.61)/.39));
  const p=body(v(0,.887-.142*dip,-.015-.055*dip),0,.05+.08*dip);
  legs(p,v(.154,ankleHeight,.072),v(-.154,ankleHeight,.072));
  for(const [side,sign] of sides){
    const target=add(p[side+'s'],v(sign*mix(.134,.047,press),mix(.078,.601,press),mix(.127,.017,press)));
    const axis=v(1,0,sign*mix(.11,.05,press));
    const hand=arm(p,side,target,v(sign*.72,-.48,.11),axis);
    p.dumbbells.push({center:hand,axis});
  }
  return p;
}

function gobletLateralLunge(f) {
  const phase=(f*2)%1;
  const side=f<.5 ? 'l' : 'r';
  const sign=side==='l' ? 1 : -1;
  const step=smooth(phase/.28)*(1-smooth((phase-.75)/.25));
  const d=smooth((phase-.24)/.25)*(1-smooth((phase-.52)/.25));
  const liftingPhase=phase<.28?phase/.28:phase>.76?(phase-.76)/.24:0;
  const swing=.122*Math.sin(Math.PI*liftingPhase);
  const p=body(v(sign*.502*d,mix(.887,.618,d),mix(.046,-.154,d)),0,mix(.046,.334,d));
  for(const [which,s] of sides){
    const active=side===which;
    const ankle=v(s * (.140 + (active ? .610 * step : 0)), .075 + (active ? swing : 0), .060);
    [p[which+'k'],p[which+'a']]=solve(p[which+'h'],ankle,v(s*.21,0,.96),.422,.424);
    p[which+'t']=add(p[which+'a'],v(s*.023,-.071,.143));
    if(active&&swing>.001)delete p.planted[which];
    arm(p,which,add(p.chest,v(s*.064,.035,.231)),v(s*.83,-.75,.04),v(0,1,0));
  }
  p.dumbbells=[{center:add(p.chest,v(0,-.054,.231)),axis:v(0,1,0)}];
  return p;
}

function resistedPushUp(f) {
  const p=pushUp(f);
  const z=p.neck[2]+.109;
  const height=(p.neck[1]+p.chest[1])*.5+.072;
  p.bandPath=[p.lw, v(-.256,height-.037,z), v(-.128,height,z), v(.128,height,z),v(.256,height-.037,z),p.rw];
  return p;
}

function resistedCalfRaise(f) {
  const p=calfRaise(f);
  for(const [side,sign] of sides){
    arm(p,side,add(p.hips,v(sign*.247,.151,.165)),v(sign*.67,-.59,-.26),v(1,0,0));
  }
  const anchor=(side)=>v(p[side+'t'][0],.016,p[side+'t'][2]);
  p.bandPath=[p.lw,anchor('l'),anchor('r'),p.rw];
  return p;
}

function bandOverheadPress(f) {
  const d=rep(f,.46);
  const p=body(v(0,.892,0),0,.036);
  legs(p,v(.164,ankleHeight,.069),v(-.164,ankleHeight,.069));
  for(const [side,sign] of sides){
    const target=add(p[side+'s'],v(sign*mix(.124,.058,d),mix(.084,.601,d),mix(.115,.034,d)));
    arm(p,side,target,v(sign*.62,-.79,.09),v(1,0,0));
  }
  p.bandPath=[p.lw,v(.175,.016,.143),v(-.175,.016,.143),p.rw];
  return p;
}

function bandLatPulldown(f) {
  const p=kneelingHighPulldown(f);
  p.cables=[];
  p.bandPath=[p.lw,v(0,2.020,.428),p.rw];
  return p;
}

function bandPullApart(f) {
  const d=rep(f,.45);
  const p=body(v(0,.891,0),0,0);
  legs(p,v(.151,ankleHeight,.058),v(-.151,ankleHeight,.058));
  for(const [side,sign] of sides){
    const arc=mix(-.116,1.292,d);
    const hand=add(p[side+'s'],v(sign*.602*Math.sin(arc),-.026,.602*Math.cos(arc)));
    arm(p,side,hand,v(sign*.45,-.60,.04),v(0,1,0));
  }
  p.bandPath=[p.lw,p.rw];
  return p;
}

function trapBarDeadlift(f) {
  const d=rep(f,.46);
  const p=body(v(0,mix(.512,.884,d),mix(-.133,-.020,d)),0,mix(.921,.032,d));
  legs(p,v(.146,ankleHeight,.061),v(-.146,ankleHeight,.061));
  const center=v(0,mix(.194,.723,d),.112);
  const axis=v(1,0,0);
  for(const [side,sign] of sides){
    const grip=add(center,v(sign*.315,.084,0));
    arm(p,side,grip,v(sign*.22,.092,-.971),v(0,0,1));
  }
  p.barbell={center,axis};
  return p;
}

function bentOverBarbellRow(f) {
  const d=rep(f,.45);
  const p=body(v(0,.821,-.212),0,.986);
  legs(p,v(.151,ankleHeight,.054),v(-.151,ankleHeight,.054));
  const center=v(0,mix(.592,.968,d),mix(.282,.193,d));
  const axis=v(1,0,0);
  for(const [side,sign] of sides) {
    arm(p,side,add(center,v(sign*.309,0,0)),v(sign*.44,.22,-.97),v(-1,0,0));
  }
  p.barbell={center,axis};
  return p;
}

function barbellCurl(f, reverse) {
  const d=smooth(f/.42)*(1-smooth((f-.57)/.43));
  const p=body(v(0,.891,.002),0,.006);
  legs(p,v(.154,ankleHeight,.049),v(-.154,ankleHeight,.049));
  const angle=mix(.121,2.28,d);
  const axis=v(1,0,0);
  for(const [side,sign] of sides){
    const elbow=add(p[side+'s'],v(sign*.039,-.249,.012));
    p[side+'e']=elbow;
    p[side+'w']=add(elbow,v(sign*.019,-.370*Math.cos(angle),.370*Math.sin(angle)));
    p[side+'Grip']=v(reverse ? -1 : 1,0,0);
  }
  p.barbell={center:mul(add(p.lw,p.rw),.5),axis};
  return p;
}

function militaryPress(f) {
  const d=rep(f,.45);
  const retreat=.074*Math.sin(Math.PI*d);
  const p=body(v(0,.889,0),0,-retreat);
  legs(p,v(.116,ankleHeight,.064),v(-.116,ankleHeight,.064));
  const center=v(0,mix(1.388,1.974,d),mix(.172,.043,smooth((d-.28)/.72)));
  const axis=v(1,0,0);
  for(const [side,sign] of sides){
    arm(p,side,add(center,v(sign*.291,0,0)),v(sign*.67,-.67,.22),axis);
  }
  p.barbell={center,axis};
  return p;
}

const moves = {
  '2966': frontSquat, '3668': floorPress, '2910': suitcaseWalk,
  '5609': facePull, '8141': cableFly, '1202': pallof, '0979': bandPallof, '8193': reverseChop,
  '0781': splitSquat, '0801': stepUp, '5094': landmine,
  '5473': pullUp, '0652': f => pullUp(f,false), '3525': kneelingLandmine, '4029': bandHipAdduction, '2473': singleLegBenchBridge,
  '0276': deadBug, '3018': calfRaise, '0463': forearmPlank, '1241': birdDog, '0662': pushUp, '6435': heelBridge,
  '3593': f => barbellSquat(f,'back'), '4362': f => barbellSquat(f,'back',true),
  '0042': f => barbellSquat(f,'front'), '0085': barbellRDL, '0025': barbellBenchPress, '1060': barbellHipThrust,
  '0313': hammerCurl, '2487': dumbbellRearFly, '1700': dumbbellPushPress, '4853': gobletLateralLunge,
  '0915': resistedPushUp, '0894': resistedCalfRaise, '0997': bandOverheadPress, '4358': bandLatPulldown, '1503': bandPullApart,
  '0027': bentOverBarbellRow, '0031': f => barbellCurl(f,false), '0080': f => barbellCurl(f,true), '1162': militaryPress,
  '0811': trapBarDeadlift, '0326': chestSupportedDumbbellRaise, '11253': kneelingHighPulldown, '3195': f => proneLegCurl(f,true), '0586': f => proneLegCurl(f,false), '3714': standingBalance, '6551': reverseOverheadLunge,
};

export const poseFor = (id, phase) => moves[id]((phase % 1 + 1) % 1);
