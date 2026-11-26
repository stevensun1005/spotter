import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const axis = [1, 0, 0];
const add = (a, b) => a.map((value, index) => value + b[index]);
const minus = (a, b) => a.map((value, index) => value - b[index]);
const scale = (point, value) => point.map(coordinate => coordinate * value);
const dot = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0);
const length = (point) => Math.hypot(...point);
const unit = (point) => scale(point, 1 / Math.max(.00001, length(point)));
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const mix = (start, end, phase) => start + (end - start) * phase;
const lerp = (a, b, phase) => a.map((value, index) => mix(value, b[index], phase));

function smooth(phase) {
  const t = clamp(phase);
  return t * t * (3 - 2 * t);
}

function rep(phase, peak = .43, release = .57) {
  return smooth(phase / peak) * smooth((1 - phase) / (1 - release));
}

function joints(root, reach, pole, upper, lower) {
  const ray = minus(reach, root);
  const direction = unit(ray);
  const span = clamp(length(ray), Math.abs(upper - lower) + .003, upper + lower - .003);
  const projection = minus(pole, scale(direction, dot(pole, direction)));
  const bend = unit(length(projection) > .001 ? projection : [direction[2], .04, -direction[0]]);
  const along = (upper ** 2 - lower ** 2 + span ** 2) / (2 * span);
  const off = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
  return [add(add(root, scale(direction, along)), scale(bend, off)), add(root, scale(direction, span))];
}

function athlete(hips, pitch = 0, turned = 0) {
  const right = [Math.cos(turned), 0, -Math.sin(turned)];
  const direction = [Math.sin(turned), 0, Math.cos(turned)];
  const up = add(scale(direction, Math.sin(pitch)), [0, Math.cos(pitch), 0]);
  const front = add(scale(direction, Math.cos(pitch)), [0, -Math.sin(pitch), 0]);
  const at = (height, x, depth = 0) => add(add(add(hips, scale(up, height)), scale(right, x)), scale(front, depth));
  return {
    hips, chest: at(.365, 0, .006), neck: at(.605, 0), head: at(.724, 0, .012),
    ls: at(.505, .192, .004), rs: at(.505, -.192, .004),
    lh: at(0, .105), rh: at(0, -.105), planted: {},
  };
}

function foot(pose, side, sign, ankle, support = 0, heelRise = 0, pole = [sign * .12, .015, 1]) {
  [pose[side + "k"], pose[side + "a"]] = joints(pose[side + "h"], ankle, pole, .422, .424);
  const a = pose[side + "a"];
  pose[side + "t"] = [a[0] + sign * .032, support == null ? a[1] - .072 : support + .006, a[2] + .145 - heelRise * .31];
  if (support != null) pose.planted[side] = support;
}

function arm(pose, side, reach, pole, grip) {
  [pose[side + "e"], pose[side + "w"]] = joints(pose[side + "s"], reach, pole, .252, .371);
  pose[side + "Grip"] = grip;
}

function loadedBar(pose, center, width, elbow, reverse = false, inclination = axis) {
  const handAxis = reverse ? scale(inclination, -1) : inclination;
  for (const [side, sign] of sides) {
    arm(pose, side, add(center, scale(inclination, sign * width)), elbow(sign), handAxis);
  }
  pose.barbell = { center, axis: inclination };
}

function stance(pose, width = .149, depth = .074, raised = 0, heel = 0) {
  for (const [side, sign] of sides) foot(pose, side, sign, [sign * width, .076 + raised + heel, depth + heel * .31], raised, heel);
}

function setSupportFeet(pose, frontAnchor, rearAnchor, frontSide = 1) {
  for (const [side, sign] of sides) {
    const front = sign === frontSide;
    const location = front ? frontAnchor : rearAnchor;
    foot(pose, side, sign, [sign * .134, location[0], location[1]], location[2], location[0] - .076);
  }
}

const benchSetups = {
  flat: { hips: [.10, .575, 1.267], pitch: -Math.PI / 2, ankles: [[.32,.078,1.35],[-.12,.078,1.35]], aimX:.1, focus:[.10,.60,.92], height:1.62 },
  incline: { hips: [0, .566, .264], pitch: -.82, ankles: [[.274,.075,.644],[-.274,.075,.644]], aimX:0, focus:[0,.91,.04], height:2.25 },
  decline: { hips: [.10,.692,1.17], pitch: -1.91, ankles: [[.268,.565,1.485],[-.068,.565,1.485]], aimX:.1, focus:[.10,.76,1.03], height:1.98 },
  floor: { hips: [0,.138,.19], pitch: -Math.PI / 2, ankles: [[.174,.076,.76],[-.174,.076,.76]], aimX:0, focus:[0,.46,.0], height:1.51 },
};

function benchBody(kind) {
  const setup = benchSetups[kind];
  const pose = athlete(setup.hips, setup.pitch);
  pose.headDrop = kind === "incline" ? .008 : .025;
  for (const [index, [side, sign]] of sides.entries()) {
    const anchor = setup.ankles[index];
    foot(pose, side, sign, anchor, kind === "decline" ? null : 0,
      0, kind === "decline" ? [sign * .19, .95, .30] : [sign * .57, 1, .12]);
  }
  return pose;
}

function benchPress(phase, { kind = "flat", grip = "standard", smith = false, reverse = false, action, pin = false, ez = false } = {}) {
  const amount = pin ? 1 - rep(phase, .45, .58) : rep(phase, .48, .58);
  const pose = benchBody(kind);
  const setup = benchSetups[kind];
  const [x, y, z] = pose.ls;
  const width = ez ? .173 : grip === "close" ? .218 : grip === "wide" ? .462 : .367;
  const path = {
    flat: [[1.110,.743], [.715,.88]],
    incline: [[1.505,-.081], [1.071,-.024]],
    decline: [[1.071,.697], [.660,.832]],
    floor: [[.708,-.284], [.379,-.247]],
  };
  const [top, ordinary] = path[kind];
  const bottom = action === "neck" ? [.752, z - .054]
    : action === "jm" ? [y + .152, z + .074]
    : pin ? [y + .187, z + .104] : ordinary;
  const center = [setup.aimX, mix(top[0], bottom[0], amount),
    smith ? mix(top[1], bottom[1], .42) : mix(top[1], bottom[1], amount)];
  if (action === "single") {
    const load = [x + .009, center[1], center[2]];
    arm(pose, "l", load, [.66, -.55, .41], [-1,0,0]);
    arm(pose, "r", [-.25,.057,.067], [-.87,-.16,.29]);
    pose.barbell = { center: pose.lw, axis };
  } else {
    const narrow = grip === "close" || action === "jm";
    loadedBar(pose, center, action === "jm" && !ez ? .230 : width,
      sign => [sign * (narrow ? .32 : .86), -.39, narrow ? .74 : .20], reverse);
  }
  return pose;
}

function supineArc(phase, { kind = "flat", type = "pullover", grip = "standard", ez = false, reverse = false, smith = false } = {}) {
  const amount = rep(phase, .50, .58);
  const pose = benchBody(kind);
  const [, y, z] = pose.ls;
  const width = ez ? .173 : grip === "wide" ? .46 : grip === "close" ? .188 : .253;
  const centerX = benchSetups[kind].aimX;
  if (type === "pullover" || type === "bent-pullover" || type === "front-pullover") {
    const start = type === "front-pullover" ? 1.42 : .075;
    const angle = mix(start, kind === "decline" ? -1.86 : -1.47, amount);
    const reach = type === "bent-pullover" ? .536 : .582;
    const center = [centerX, y + reach * Math.cos(angle), z + reach * Math.sin(angle)];
    loadedBar(pose, center, width, sign => [sign * .72, -.54, -.26]);
  } else {
    const behind = type === "behind";
    const elbow = [centerX, y + .237, z - (behind ? .090 : .019)];
    const angle = mix(.045, behind ? 2.15 : 1.74, amount);
    let bar = [centerX, elbow[1] + .371 * Math.cos(angle), elbow[2] - .371 * Math.sin(angle)];
    if (smith) bar = [centerX, mix(y + .588, y + .172, amount), z - .171];
    for (const [side, sign] of sides) {
      const hand = add(bar, [sign * width, 0, 0]);
      if (smith) arm(pose, side, hand, [sign * .18, .08, .94]);
      else {
        pose[side + "e"] = add(elbow, [sign * width, 0, 0]);
        pose[side + "w"] = hand;
      }
      pose[side + "Grip"] = [reverse ? -1 : 1, 0, 0];
    }
    pose.barbell = { center: bar, axis };
  }
  return pose;
}

function curl(phase, { mode = "standing", width = .249, reverse = false, smith = false } = {}) {
  const amount = rep(phase, .44, .55);
  const seated = mode === "seated" || mode === "concentration";
  const preacher = mode === "preacher";
  const prone = mode === "prone";
  const drag = mode === "drag";
  const hips = prone ? [0,.62,-.27] : seated || preacher ? [0,.558,-.025] : [0,.899,.008];
  const pose = athlete(hips, prone ? 1.04 : preacher ? .31 : mode === "concentration" ? 1.048 : .018);
  stance(pose,mode === "concentration" ? .294 : .157,seated || preacher ? .532 : prone ? -.477 : .056);
  const angle = mix(.10, preacher ? 2.39 : 2.35, amount);
  const y = preacher ? .818 : mode === "concentration" ? .564 : pose.ls[1] - .247 + (drag ? amount * .032 : 0);
  const z = preacher ? .372 : mode === "concentration" ? .420 : pose.ls[2] + (prone ? .048 : drag ? -.154 * amount : .016);
  const nearY = y - .368 * Math.cos(angle);
  const depth = smith ? .111 : z + .371 * Math.sin(angle);
  const center = [0, nearY, depth];
  for (const [side, sign] of sides) {
    const hand = add(center, [sign * width, 0, 0]);
    if (smith) arm(pose, side, hand, [sign * .2, -.23, -.90], reverse ? [-1,0,0] : axis);
    else {
      pose[side + "e"] = [sign * (width * .72 + .058), y, z];
      pose[side + "w"] = hand;
      pose[side + "Grip"] = reverse ? [-1,0,0] : axis;
    }
  }
  pose.barbell = { center, axis };
  return pose;
}

function standingPress(phase, { width = .28, seated = false, smith = false, behind = false, triceps = false } = {}) {
  const amount = rep(phase, .43, .58);
  const pose = athlete([0,seated ? .560 : .894,seated ? -.03 : .012], -.039 * Math.sin(Math.PI * amount));
  stance(pose,.148,seated ? .52 : .067);
  if (triceps) {
    const near = mix(.13, 1.93, amount);
    const y = pose.ls[1] + .225;
    const z = pose.ls[2] - .032;
    const center = [0,y + .371 * Math.cos(near),z - .371 * Math.sin(near)];
    for (const [side, sign] of sides) {
      pose[side + "e"] = [sign * width,y,z];
      pose[side + "w"] = add(center,[sign * width,0,0]);
      pose[side + "Grip"] = axis;
    }
    pose.barbell = { center, axis };
  } else {
    const low = pose.ls[1] + (behind ? .109 : -.007);
    const z = behind ? -.153 : .15;
    const center = [0,low + amount * (behind ? .472 : .573),smith ? z : mix(z,.042,amount)];
    loadedBar(pose,center,width,sign => [sign * .78,-.63,behind ? -.20 : .23]);
  }
  return pose;
}

function standingPull(phase, { type, width = .29, smith = false } = {}) {
  const amount = rep(phase, .42, .56);
  const pose = athlete([0,.886,.002], .008);
  stance(pose,.138,.058);
  let center;
  if (type === "front" || type === "overhead") {
    const angle = mix(.09,type === "front" ? 1.54 : 2.88,amount);
    center = [0,pose.ls[1] - .597 * Math.cos(angle),pose.ls[2] + .596 * Math.sin(angle)];
  } else if (type === "upright") {
    center = [0,mix(.825,1.433,amount),.135];
  } else {
    const behind = type === "behind";
    pose.ls[1] += .066 * amount;
    pose.rs[1] += .066 * amount;
    center = [0,.818 + .067 * amount,behind ? -.171 : .147];
  }
  if (smith) center[2] = type === "behind" ? -.171 : .135;
  loadedBar(pose,center,width,sign => [sign * .91,type === "upright" ? .38 : -.21,type === "behind" ? -.17 : -.38]);
  return pose;
}

function squatWithBar(phase, { rack = "back", width = .179, depth = .36, smith = false, fast = false,
  jump = false, single = false, kneeling = false, thruster = false, box = false, feet = .112 } = {}) {
  const up = jump ? smooth((phase - .49) / .21) * smooth((.91 - phase) / .15) : 0;
  const amount = rep(phase, fast ? .53 : .45, fast ? .58 : .57);
  const restY = kneeling ? .495 : .887;
  const barDepth = .041;
  const shoulderPitch = rack === "low" ? .52 : rack === "back" ? .39 : .25;
  const hips = [single ? -.060 : 0, restY - (kneeling ? .266 : depth) * amount + .13 * up,
    kneeling ? -.12 - .31 * amount : smith ? barDepth - .041 - (rack === "front" ? .100 : -.086)
      - .505 * Math.sin(.037 + shoulderPitch * amount) : -.021 - (box ? .179 : .139) * amount];
  const pose = athlete(hips,.037 + shoulderPitch * amount);
  if (kneeling) {
    for (const [side, sign] of sides) {
      pose[side + "k"] = [sign * .146, .088,.013];
      pose[side + "a"] = [sign * .151, .064,-.408];
      pose[side + "t"] = [sign * .155,.027,-.548];
    }
  } else if (single) {
    foot(pose,"r",-1,[-.199,.076,.074]);
    foot(pose,"l",1,[.143,mix(.165,hips[1] -.058,amount),mix(.485,.72,amount)],null,0,[.03,.9,-.06]);
  } else {
    const float = up > .003;
    for (const [side, sign] of sides) foot(pose,side,sign,[sign * width,.076 + .13 * up,feet],float ? null : 0);
  }
  const extended = thruster ? smooth((phase - .56) / .17) * smooth((.99 - phase) / .20) : 0;
  const lowBar = rack === "low";
  const front = rack === "front" || rack === "freefront";
  const overhead = rack === "overhead";
  const handsFree = rack === "freefront";
  const offsetY = front ? .041 : lowBar ? -.043 : .030;
  const offsetZ = front ? .109 : -.087;
  const c = [0,pose.ls[1] + (overhead ? .460 : rack === "zercher" ? -.205 : offsetY + .515 * extended),
    smith ? barDepth : pose.ls[2] + (overhead ? -.066 : rack === "zercher" ? .218 : offsetZ - .112 * extended)];
  if (handsFree) {
    for (const [side, sign] of sides) arm(pose, side, add(pose[side + "s"], [sign*.025,.015,.609]), [sign*.34, -.60, .05]);
    pose.barbell = { center: c, axis };
  } else if (rack === "zercher") {
    for (const [side,sign] of sides) {
      pose[side + "e"] = [sign * .199,c[1] - .017,c[2] + .004];
      pose[side + "w"] = [sign * .151,c[1] + .310,c[2] - .187];
    }
    pose.barbell = {center:c,axis};
  } else {
    loadedBar(pose,c,overhead ? .502 : lowBar ? .408 : smith && !front ? .376 : .351,
      sign => [sign * .67,front ? -.14 : -.70,front ? .96 : -.31]);
  }
  return pose;
}

function hinge(phase, { style = "lift", reverse = false, smith = false, width = .306, wide = false } = {}) {
  const amount = rep(phase,.48,.60);
  const morning = style === "morning" || style === "seated-morning" || style === "straight-morning";
  const seated = style === "seated-morning";
  const stiff = style === "stiff" || style === "straight" || style === "straight-morning";
  const row = style === "row" || style === "pendlay" || style === "incline-row";
  const chest = style === "incline-row";
  const fromFloor = style === "lift" || style === "snatch" || style === "jefferson" || style === "hack";
  const floorStart = fromFloor || style === "pins";
  const depth = floorStart ? 1 - amount : row ? 1 : amount;
  const x = chest ? 0 : style === "single" ? -.085 : 0;
  const rest = style === "pins" ? .758 : style === "pendlay" ? .719 : wide ? .453 : fromFloor ? .485 : stiff || morning ? .861 : .798;
  const hips = chest ? [0,.606,-.24] : [x, seated ? .556 : mix(.891,rest,depth),
    seated ? -.09 : mix(-.032, floorStart ? -.264 : -.234,depth)];
  const pitch = chest ? .968 : mix(.033, style === "pendlay" ? 1.36 : style === "pins" ? .77 : style === "single" ? 1.14 :
    morning || stiff ? 1.12 : style === "hack" ? .491 : floorStart ? wide ? .88 : .995 : 1.025,depth);
  const pose = athlete(hips,pitch,style === "jefferson" ? .52 : 0);
  if (style === "single") {
    foot(pose,"r",-1,[-.132,.076,.07]);
    foot(pose,"l",1,[.091,mix(.085,.798,amount),mix(-.035,-.938,amount)],null,0,[.2,.9,.14]);
  } else if (style === "jefferson") {
    setSupportFeet(pose,[.077,.283,0],[.077,-.212,0]);
  } else stance(pose,wide ? .325 : seated ? .167 : .155,seated ? .59 : chest ? -.522 : .065);
  const wideAxis = style === "jefferson" ? [Math.cos(.88),0,-Math.sin(.88)] : axis;
  const center = morning ? [0,pose.ls[1] + .038,smith ? .094 : pose.ls[2] - .086]
    : row ? [0,mix(style === "pendlay" ? .219 : .592,pose.ls[1] - .225,amount),smith ? .289 : mix(.298,.217,amount)]
    : [x,style === "pins" ? mix(.779,.513,amount) : floorStart ? mix(style === "hack" ? .285 : .211,style === "snatch" ? 1.01 : .807,amount) :
      mix(.789,stiff ? .535 : .449,amount), smith ? .187 : style === "hack" ? -.269 : .181 + .017 * depth];
  if (style === "pins") center[1] = mix(.533,.797,amount);
  if (style === "jefferson") {
    const span = [Math.cos(.98),0,-Math.sin(.98)];
    for (const [side,sign] of sides) {
      const target = add(center,scale(span,sign * .216));
      arm(pose,side,target,[sign*.93,-.42,-.12],sign===1 ? span : scale(span,-1));
    }
    pose.barbell={center,axis:span};
  } else loadedBar(pose,center,width,sign => [sign * .40, morning ? -.80 : .19, morning ? -.48 : -.82],reverse,wideAxis);
  return pose;
}

function lunge(phase, { direction = "forward", smith = false, staticStance = false, sprint = false, alternate = false, fixedWide = false } = {}) {
  const active = alternate && phase >= .5 ? -1 : 1;
  const time = alternate ? phase * 2 % 1 : phase;
  const amplitude = rep(time,.42,.58);
  const travel = staticStance || fixedWide ? 1 : smooth(time / .26) * smooth((1 - time) / .27);
  const sideStep = direction === "side";
  const reverse = direction === "reverse";
  const x = sideStep ? active * .269 * amplitude : 0;
  const position = sideStep ? -.063 : reverse ? -.152 * travel : .182 * travel;
  const pose = athlete([x,.875 - amplitude * .346,position], .053 + amplitude * .17);
  if (sideStep) {
    for (const [side,sign] of sides) {
      const widened = sign === active || fixedWide;
      const width = fixedWide ? .367 : .157 + (widened ? .360 * travel : 0);
      foot(pose,side,sign,[sign * width,.076,.093]);
    }
  } else {
    for (const [side,sign] of sides) {
      const leading = side === "l";
      const advances = reverse ? !leading : leading;
      const depth = .052 + travel * (leading ? (reverse ? .0 : .57) : (reverse ? -.54 : -.094));
      const lift = advances && travel < .999 ? Math.sin(Math.PI * travel) * .079 : 0;
      const heel = leading ? 0 : .102 * travel;
      foot(pose,side,sign,[sign * .128,.076 + heel + lift,depth],
        lift > .003 ? null : 0, heel);
    }
  }
  const center = [x,pose.ls[1] + .033,smith ? .026 : pose.ls[2] - .084];
  loadedBar(pose,center,.367,sign => [sign*.48,-.74,-.48]);
  if (sprint) pose.head[2] += .027 * amplitude;
  return pose;
}

function calfRaise(phase, { step = false, single = false, seated = false, smith = false, supported = false, highHandle = false } = {}) {
  const amount = rep(phase, .44,.61);
  const height = step ? .122 : 0;
  const depth = seated ? .571 : step ? .296 : .047;
  const lift = mix(step ? -.045 : 0, .092, amount);
  const hips = [single ? -.069 : 0,seated ? .556 : .878 + height + lift, seated ? -.021 : supported ? .068 + .027 * amount : .009 + .035 * amount];
  const pose = athlete(hips,.032);
  for (const [side,sign] of sides) {
    const floating = single && side === "l";
    const a = [sign*.136,height + .076 + lift + (floating ? .227 : 0),depth + lift * .26 - (floating ? .172 : 0)];
    foot(pose,side,sign,a,floating ? null : height,lift);
  }
  const center = seated ? [0, .622 + .055 * amount, smith ? .303 : .299]
    : supported ? [0, highHandle ? 1.38 : 1.285, .494]
    : [hips[0],pose.ls[1] + .026,smith ? -.033 : pose.ls[2] - .086];
  loadedBar(pose,center,seated ? .260 : .359,sign => [sign*.57,-.73,supported ? .51 : -.36]);
  return pose;
}

function bridge(phase, feetElevated) {
  const amount = rep(phase,.44,.63);
  const hip = [0,mix(.154,feetElevated ? .461 : .408,amount),mix(-.143,-.092,amount)];
  const pose = athlete(hip,-Math.PI / 2);
  for (const joint of ["ls","rs","head","neck"]) {
    pose[joint][1] = .141;
    pose[joint][2] -= hip[2] + .143;
  }
  pose.chest = lerp(hip,pose.neck,.58);
  pose.headDrop = .032;
  const height = feetElevated ? .504 : 0;
  for (const [side,sign] of sides)
    foot(pose,side,sign,[sign*.142,.077+height,feetElevated ? .564 : .495],height,0,[sign*.19,.99,.1]);
  loadedBar(pose,[0,hip[1] + .128,hip[2]-.067],.264,sign => [sign*.84,.01,.18]);
  return pose;
}

const rows = [];
function addRows(entries, movement, muscle, equipment, camera, duration = 4000, posterAt = .47) {
  for (const [id, option = {}] of entries) {
    rows.push({ id, option, movement, muscle, equipment: typeof equipment === "string" ? equipment : equipment(option),
      camera: typeof camera === "object" ? camera : camera(option), duration, posterAt });
  }
}

const standing = { yaw: 45, elevation: 12, focus: [0,.96,.05], height: 2.12 };
const kneeling = { yaw: 47, elevation: 15, focus: [0,.70,.06], height: 1.73 };
const supportCam = { yaw: 56, elevation: 13, focus: [0,.84,.06], height: 2.22 };
const benchCamera = ({ kind = "flat", smith = false }) => ({
  yaw: kind === "incline" ? 56 : 63, elevation: kind === "decline" ? 21 : 15,
  focus: benchSetups[kind].focus, height: smith ? 2.77 : benchSetups[kind].height,
});
function benchHardware({ kind = "flat", smith = false, ez = false, pin = false }) {
  if (smith) return "smith-" + kind;
  if (pin) return "barbell-bench-pins";
  if (kind === "floor") return "barbell";
  if (kind === "decline") return ez ? "ez-decline" : "barbell-decline";
  if (kind === "incline") return ez ? "ez-incline" : "incline-bench-barbell";
  return ez ? "bench-ez-bar" : "bench-barbell";
}

addRows([
  ["0030",{grip:"close"}], ["0033",{kind:"decline"}], ["0045",{action:"neck",grip:"wide"}],
  ["1719",{kind:"incline",grip:"close"}], ["0048",{kind:"incline",reverse:true}],
  ["0052",{action:"jm",grip:"close"}], ["0055",{grip:"close"}], ["0065",{action:"single",kind:"floor"}],
  ["1751",{pin:true}], ["2187",{grip:"close",reverse:true}], ["1256",{kind:"decline",reverse:true}],
  ["1257",{kind:"incline",reverse:true}], ["0122",{grip:"wide"}], ["1258",{grip:"wide",reverse:true}],
  ["0450",{ez:true,action:"jm"}], ["2432",{ez:true,grip:"close"}], ["0748",{smith:true}],
  ["0751",{smith:true,grip:"close"}], ["0753",{smith:true,kind:"decline"}],
  ["0757",{smith:true,kind:"incline"}], ["1625",{smith:true,kind:"decline",grip:"close"}],
  ["1626",{smith:true,kind:"decline",grip:"close",reverse:true}],
  ["1308",{smith:true,grip:"wide"}], ["1309",{smith:true,kind:"decline",grip:"wide"}],
],benchPress,["pec","triceps"],benchHardware,benchCamera);

addRows([
  ["1316",{type:"bent-pullover"}], ["0034",{kind:"decline",type:"bent-pullover"}],
  ["1255",{kind:"decline"}], ["0037",{kind:"decline",grip:"wide"}], ["0040",{type:"front-pullover"}],
  ["0073"], ["3010",{ez:true,type:"bent-pullover"}],
],supineArc,["lat"],benchHardware,benchCamera);
addRows([
  ["1720",{type:"behind"}], ["0056",{type:"extension",grip:"close"}], ["0057",{type:"extension"}],
  ["0061",{type:"extension"}], ["0060",{type:"extension"}], ["1721",{type:"extension",reverse:true}],
  ["1748",{type:"behind",ez:true,grip:"close"}], ["0448",{kind:"decline",type:"extension",ez:true,grip:"close"}],
  ["2186",{kind:"decline",type:"extension",ez:true}], ["0449",{kind:"incline",type:"extension",ez:true}],
  ["1752",{kind:"incline",type:"extension",smith:true}],
],supineArc,["triceps"],benchHardware,benchCamera);

addRows([
  ["0038",{mode:"drag"}], ["0070",{mode:"preacher",width:.275}], ["0072",{mode:"prone"}],
  ["0081",{mode:"preacher",reverse:true}], ["0089",{mode:"concentration",width:.158}],
  ["0106",{width:.168}], ["0110",{reverse:true}], ["0113",{width:.371}], ["1629",{width:.367}],
  ["1627",{mode:"preacher",ez:true,width:.155}], ["0446",{ez:true,width:.155}], ["0447",{ez:true,width:.233}],
  ["0451",{ez:true,width:.233,reverse:true}], ["0452",{mode:"preacher",ez:true,width:.233,reverse:true}],
  ["1458",{mode:"seated",ez:true,width:.228}], ["0454",{mode:"prone",ez:true,width:.230}],
  ["1682",{mode:"concentration",ez:true,width:.157}], ["2741",{ez:true,width:.283}], ["1683",{smith:true}],
],curl,["biceps"],({ mode, ez, smith }) => {
  if (smith) return "smith-standing";
  const support = ({preacher:"preacher",prone:"chest-bench",seated:"seat",concentration:"seat"})[mode];
  return support ? (ez ? "ez-" : "barbell-") + support : ez ? "ez-barbell" : "barbell";
},({ mode, smith }) => smith ? {...standing,height:2.61} : mode ? supportCam : standing);

addRows([
  ["0086",{seated:true,behind:true}], ["0091",{seated:true}], ["1456",{width:.200}], ["1457",{width:.368}],
  ["0747",{smith:true,behind:true}], ["0765",{smith:true,seated:true}], ["0766",{smith:true}],
  ["0772",{smith:true,behind:true}], ["0774",{smith:true,width:.299}],
],standingPress,["shoulder","triceps"],({seated,smith}) => smith ? seated ? "smith-seat" : "smith-standing" : seated ? "barbell-seat" : "barbell",
  ({seated,smith}) => ({...standing,focus:[0,seated ? .79 : 1.02,0],height:smith ? 2.65 : 2.24}));
addRows([
  ["1718",{seated:true,behind:true,triceps:true,width:.160}], ["0092",{seated:true,triceps:true,width:.217}],
  ["0109",{triceps:true,width:.220}], ["0637",{triceps:true,width:.243}],
  ["1749",{triceps:true,ez:true,width:.173}], ["0453",{triceps:true,seated:true,ez:true,width:.173}],
],standingPress,["triceps"],({seated,ez}) => seated ? ez ? "ez-seat" : "barbell-seat" : ez ? "ez-barbell" : "barbell",standing);

addRows([
  ["0041",{type:"front"}], ["0107",{type:"overhead"}], ["0095",{type:"shrug"}], ["0746",{type:"behind",smith:true}],
  ["0767",{type:"shrug",smith:true}], ["0120",{type:"upright"}], ["0119",{type:"upright",width:.276}],
  ["0121",{type:"upright",width:.310}], ["0123",{type:"upright",width:.403}], ["0775",{type:"upright",smith:true}],
],standingPull,["shoulder"],({smith}) => smith ? "smith-standing" : "barbell",standing);

addRows([
  ["0029",{rack:"front",depth:.361}], ["0039",{rack:"front",depth:.301}], ["0043",{depth:.397}],
  ["1461",{depth:.397,view:"rear"}], ["1462",{depth:.397,view:"side"}], ["1545",{rack:"zercher",depth:.395}],
  ["1436",{depth:.356}], ["1435",{rack:"low",depth:.356}], ["0063",{width:.109}], ["0068",{single:true,depth:.313}],
  ["0069",{rack:"overhead",depth:.38}], ["0053",{jump:true,depth:.318}], ["0101",{fast:true,depth:.319}],
  ["0102",{kneeling:true}], ["0124",{width:.33}], ["0127",{rack:"zercher",depth:.328}],
  ["3194",{rack:"freefront",depth:.364}], ["3305",{rack:"front",thruster:true,depth:.36}],
  ["0750",{smith:true,box:true,depth:.424}], ["1433",{smith:true,rack:"front"}],
  ["3281",{smith:true,depth:.403}], ["1434",{smith:true,rack:"low"}], ["0770",{smith:true}],
  ["3142",{smith:true,width:.323,depth:.321}], ["4349",{single:true,depth:.348}],
],squatWithBar,["quad","glute"],({smith,box,rack,kneeling,jump}) => smith ? box ? "smith-box" : "smith-standing" :
  kneeling || jump || rack === "overhead" ? "barbell" : "barbell-rack",
({view,kneeling,smith}) => kneeling ? kneelingCamera() : ({...standing,yaw:view==="rear" ? 154 : view==="side" ? 90 : 43,height:smith?2.62:2.32}));
function kneelingCamera() { return kneeling; }

addRows([
  ["0044",{style:"morning"}], ["0046",{style:"hack"}], ["0051",{style:"jefferson"}], ["0074",{style:"pins"}],
  ["0090",{style:"seated-morning"}], ["0115",{style:"straight-morning"}], ["0116",{style:"stiff"}],
  ["0117",{style:"lift",wide:true,width:.206}], ["1756",{style:"single"}],
  ["0749",{style:"morning",smith:true}], ["0752",{style:"lift",smith:true}],
],hinge,["glute"],({style,smith}) => smith ? "smith-standing" : style === "seated-morning" ? "barbell-seat"
  : style === "pins" ? "barbell-pins" : "barbell",
({smith,style}) => ({...standing,yaw:62,height:smith ? 2.57 : 2.03,focus:[0,style==="seated-morning"?.77:.89,.03]}));
addRows([
  ["0049",{style:"incline-row"}], ["3017",{style:"pendlay"}], ["0118",{style:"row",reverse:true}],
  ["1317",{style:"incline-row",reverse:true}], ["1344",{style:"row",reverse:true,ez:true,width:.228}],
  ["1359",{style:"row",smith:true}], ["1361",{style:"row",smith:true,reverse:true}],
],hinge,["lat"],({style,ez,smith}) => smith ? "smith-standing" : ez ? "ez-barbell" : style==="incline-row"?"barbell-chest-bench":"barbell",
({style,smith}) =>({...standing,yaw:63,focus:[0,.81,.05],height:smith?2.58:style==="incline-row"?2.04:1.98}));

addRows([
  ["0054",{direction:"forward"}], ["0077",{direction:"reverse"}], ["1410",{direction:"side"}],
  ["0098",{direction:"side",alternate:true,fixedWide:true}], ["0097",{direction:"side",fixedWide:true}], ["2810",{staticStance:true}],
  ["2809",{direction:"reverse",staticStance:true}], ["0769",{direction:"reverse",smith:true,sprint:true}],
],lunge,["quad","glute"],({smith}) => smith?"smith-standing":"barbell",
({smith})=>({...standing,yaw:53,height:smith?2.55:2.19}));

addRows([
  ["1370",{free:true}], ["0088",{seated:true,step:true}], ["1371",{seated:true,step:true}],
  ["1372",{step:true}], ["0108",{single:true,step:true}], ["0111"],
  ["0763",{smith:true,supported:true,step:true,highHandle:true}], ["1394",{smith:true,supported:true,step:true}],
  ["0773",{smith:true}], ["1396",{smith:true,step:true}], ["1395",{smith:true,seated:true,single:true,step:true}],
],calfRaise,["calf"],({smith,step,seated,free}) => smith ? seated ? "smith-seat-step" : step ? "smith-low-step":"smith-standing"
  : seated ? "barbell-seat-step" : step ? "barbell-low-step" : free ? "barbell" : "barbell-rack",
({smith,seated,supported})=>({...standing,yaw:supported?38:69,focus:[0,seated?.58:.94,.19],height:smith?2.62:seated?1.67:2.19}));
addRows([["1409"],["0058"],["3562",{feetElevated:true}]],(phase, options) => bridge(phase,options.feetElevated),["glute"],
  ({feetElevated}) => feetElevated ? "barbell-bench-elevated-feet" : "barbell",{yaw:63,elevation:17,focus:[0,.4,.06],height:1.49});

function wristFlex(phase,{seated,behind,smith,fingers}) {
  const amount = rep(phase);
  const pose = athlete([0,seated?.506:.875,.008],seated?.38:.018);
  stance(pose,seated?.186:.155,seated?.481:.063);
  const center = [0,seated?.580 + .092 * amount:.806 + .105 * amount,
    smith ? behind ? -.214:.427:seated?.437:behind?-.210:.181];
  const tilt = mix(-.36,.59,amount);
  loadedBar(pose,center,seated?.181:.249,sign=>[sign*.55,-.38,behind?1:-1],!behind);
  for(const [side,sign] of sides) {
    if (fingers) pose[side+"FingerCurl"] = amount;
    else {
      pose[side+"Fingers"] = [0,Math.sin(tilt),Math.cos(tilt)];
      pose[side+"PalmSide"] = [sign,0,0];
    }
  }
  return pose;
}
function torsoUnderBar(phase,{seated,sideBend}) {
  const move = Math.sin(phase * 2 * Math.PI);
  const angle = sideBend ? 0 : .66 * move;
  const pose = athlete([0,seated?.515:.875,0],.014,angle);
  if (sideBend) {
    const roll = .37 * move;
    for (const joint of ["chest","neck","head","ls","rs"]) {
      const [x,y,z]=minus(pose[joint],pose.hips);
      pose[joint] = add(pose.hips,[x*Math.cos(roll)+y*Math.sin(roll),y*Math.cos(roll)-x*Math.sin(roll),z]);
    }
  }
  stance(pose,seated?.194:.163,seated?.449:.066);
  const shoulders = scale(add(pose.ls,pose.rs),.5);
  const direction = unit(minus(pose.ls,pose.rs));
  loadedBar(pose,add(shoulders,[0,.028,-.085]),.377,sign=>[sign*.43,-.63,-.59],false,direction);
  return pose;
}
function barPower(phase,{type}) {
  const unlocked = type==="push";
  const up = phase < .54 ? smooth(phase/.37) : smooth((1-phase)/.42);
  const catchMoment=Math.max(0,1-Math.abs(phase-.43)/.12);
  const dip = unlocked ? rep(phase,.15,.19)*.09 + rep(phase,.40,.44)*.027 : catchMoment * (type==="single-snatch"?.34:.16);
  const initial = unlocked || type==="clean-and-press" ? 1 : up;
  const strength = rep(phase,.48,.59);
  const drive = smooth((phase-.43)/.20)*smooth((.97-phase)/.18);
  const clean = smooth(phase/.33)*smooth((1-phase)/.18);
  const catchBar = type==="clean-and-press" ? clean : up;
  const rack = mix(.205,1.392,catchBar) + (type==="clean-and-press"?drive*.549:0);
  const height = unlocked ? mix(1.404,1.975,strength)
    : type==="snatch-pull" ? mix(.205,1.325,up) : type==="single-snatch" ? mix(.205,1.825,up) : rack;
  const width = type==="snatch-pull" ? .447 : .296;
  const raise = type==="clean-and-press" ? clean : initial;
  const pose = athlete([0,.640+.223*raise-dip,-.194*(1-raise)],.64*(1-raise)+.09*dip);
  stance(pose,type==="single-snatch"?.179+.058*catchMoment:.173,.082);
  const depth = unlocked ? .179-.096*strength : mix(.181,.106,up);
  if (type==="single-snatch") {
    arm(pose,"l",[.181,height,depth],[.86,-.45,.07],axis);
    arm(pose,"r",[-.375,.719 + .173*up,.061],[-.58,-.54,-.05]);
    pose.barbell={center:pose.lw,axis};
  } else {
    loadedBar(pose,[0,height,depth],width,sign=>[sign*.78,-.51,type==="snatch-pull"?-.61:.31]);
  }
  return pose;
}
function supportedStep(phase,{split,smith}) {
  const climb = rep(phase,.45,.57);
  const placed = split ? 1 : smooth(phase/.21)*smooth((1-phase)/.20);
  const y = split ? .872-.333*climb : .874+.289*climb;
  const z = split ? .17-.04*climb : .004+.36*climb;
  const pose = athlete([0,y,z],.04+.21*(split?climb:Math.sin(phase*Math.PI)));
  const h = split ? .451 : .332;
  foot(pose,"l",1,[.142,.076+(split?0:h*placed),split?.498:mix(.09,.455,placed)],split?0:placed>.997?h:null);
  foot(pose,"r",-1,[-.147,.076+(split?h:.270*climb),split?-.581:mix(.05,.410,climb)],split?h:climb<.004?0:null,0,
    split?[-.13,.04,.98]:[-.14,.11,1]);
  const bar = [0,pose.ls[1]+.035,smith?.129:pose.ls[2]-.082];
  loadedBar(pose,bar,.373,sign=>[sign*.57,-.62,-.44]);
  return pose;
}
function oneArmBar(phase,{deadlift,smith}) {
  const v = rep(phase);
  const pose = athlete([0,deadlift?.623+.253*v:.791,deadlift?-.094*(1-v):-.146],deadlift?.55*(1-v):.884);
  stance(pose,.154,.049);
  const z=deadlift?.061:smith?.261:mix(.331,.215,v);
  const x=deadlift?.345:.242;
  arm(pose,"l",[x,deadlift?.249+.529*v:.326+.328*v,z],[.61,-.16,-.64],deadlift?[0,0,1]:axis);
  arm(pose,"r",deadlift?[-.402,.555+.340*v,.041]:[-.230,.703,.313],[-.66,-.32,-.52]);
  pose.barbell={center:smith?[0,pose.lw[1],z]:pose.lw,axis:deadlift?[0,0,1]:axis};
  return pose;
}

addRows([
  ["0082",{seated:true}],["0104",{behind:true}],["0455",{fingers:true}],
  ["1426",{seated:true,smith:true}],["0771",{behind:true,smith:true}],
],wristFlex,["forearm"],({smith,seated})=>smith?seated?"smith-seat":"smith-standing":seated?"barbell-seat":"barbell",
({smith,seated})=>({...standing,yaw:57,focus:[0,seated?.73:.92,.06],height:smith?2.59:seated?1.82:2.14}));
addRows([["0094",{seated:true}],["0096",{sideBend:true}],["0112"]],torsoUnderBar,["core"],
({seated})=>seated?"barbell-seat":"barbell",({seated})=>({...standing,yaw:29,focus:[0,seated?.74:.93,0],height:seated?1.89:2.17}));
addRows([["0028",{type:"clean-and-press"}],["0067",{type:"single-snatch"}],["0648",{type:"power-clean"}],
  ["1200",{type:"push"}],["0776",{type:"snatch-pull"}]],barPower,["quad","glute","shoulder"],"barbell",
  {...standing,yaw:58,focus:[0,1.03,.012],height:2.36},4500,.43);
addRows([["0099",{split:true}],["0768",{split:true,smith:true}],["0114"]],supportedStep,["glute","quad"],
  ({split,smith})=>smith?"smith-rear-bench":split?"barbell-rear-bench":"barbell-plyo-box",
  ({smith})=>({...standing,yaw:62,focus:[0,.98,.08],height:smith?2.68:2.31}));
addRows([["0066",{deadlift:true}],["1360",{smith:true}]],oneArmBar,["glute","lat"],
  ({smith})=>smith?"smith-standing":"barbell",({smith})=>({...standing,yaw:58,height:smith?2.56:2.15}));
addRows([["0755",{smith:true,rack:"back",depth:.33,feet:.47}]],squatWithBar,["glute","quad"],"smith-standing",
    {...standing,yaw:72,height:2.53});

function rollout(phase,{standing}) {
  const v=rep(phase,.48,.53);
  const hipAngle=.065+1.26*v;
  const p=athlete([0,standing ? .610-.399*v : .072+.421*Math.cos(hipAngle),
    standing ? -.459+.587*v : -.293+.421*Math.sin(hipAngle)],standing?1.445+.077*v:.795+.72*v);
  for(const[side,sign]of sides){
    if(standing)foot(p,side,sign,[sign*.163,.093,-.671],0,.016,[sign*.20,.64,.44]);
    else {
      p[side+"k"]=[sign*.139,.072,-.293];
      p[side+"a"]=[sign*.143,.083,-.710];
      p[side+"t"]=[sign*.150,.016,-.821];
    }
  }
  const y=.221;
  const s=p.ls;
  const reach=Math.sqrt(Math.max(.016,.602**2-(s[1]-y)**2));
  const z=s[2]+reach*(.79+.187*v);
  loadedBar(p,[0,y,z],.224,sign=>[sign*.23,.05,-.97]);
  return p;
}
function elevatedCurl(phase,{ball,ez,blaster,braced}={}) {
  if(blaster)return curl(phase,{width:ez?.173:.249,mode:"standing"});
  if(braced){
    const p=athlete([0,.783,-.137],.786);
    stance(p,.171,.053);
    const v=rep(phase);
    const center=[0,.501+.513*v,.256+.18*v];
    loadedBar(p,center,.229,sign=>[sign*.17,-.72,-.37],true);
    return p;
  }
  const v=rep(phase);
  const p=athlete([0,.689,.131],-1.31);
  p.ballCenter=[0,.365,-.278];
  stance(p,.174,.606);
  const s=p.ls;
  const angle=mix(.05,1.77,v);
  const center=[0,s[1]+.208+.363*Math.cos(angle),s[2]-.334*Math.sin(angle)];
  loadedBar(p,center,.171,sign=>[sign*.25,.23,.94]);
  return p;
}
function barSitup(phase) {
  const q=rep(phase);
  const p=athlete([.1,.584,1.267],mix(-Math.PI/2,-.12,q));
  for(const [index,[side,sign]] of sides.entries()) {
    foot(p,side,sign,benchSetups.flat.ankles[index],0,0,[sign*.57,1,.12]);
  }
  const s=p.ls;
  const center=[.1,s[1]+.403+.179*q,s[2]+.14-.053*q];
  loadedBar(p,center,.234,sign=>[sign*.61,-.62,.20]);
  return p;
}
function landmine(phase,{row}={}) {
  const v=rep(phase);
  const angle = Math.sin(phase*2*Math.PI)*.88;
  const pivot = [0,.066,row?1.20:1.485];
  const p=athlete([0,row?.784:.879,row?-.11:.08],row?.89:.041,row?0:-angle*.56);
  stance(p,.170,.045);
  const end = row ? [0,mix(.482,.889,v),mix(-.31,-.141,v)]
    : [.74*Math.sin(angle),1.211+.21*Math.cos(angle),.242+.23*(1-Math.cos(angle))];
  const target = add(pivot,scale(unit(minus(end,pivot)),row?1.61:1.83));
  for(const [side,sign] of sides) {
    const resting = row && sign<0;
    const wrists = resting ? [-.214,.655,.293] : add(target,[sign*(row?.016:.063),.012,-.044]);
    arm(p,side,wrists,[sign*.77,-.52,-.25],resting?undefined:[0,0,1]);
  }
  p.landmine={pivot,end:target};
  p.barbell={center:target,axis};
  return p;
}
function supportedOneArm(phase) {
  const v=rep(phase);
  const p=athlete([.29,.773,-.14],.99);
  foot(p,"l",1,[.409,.078,-.292],0);
  p.rk=[.102,.545,.251];p.ra=[.068,.486,-.165];p.rt=[.067,.484,-.309];
  arm(p,"r",[.029,.551,.623],[-.13,.09,-.98]);
  arm(p,"l",[.492,.322+.347*v,.347-.226*v],[.43,-.21,-.94],[0,0,1]);
  p.barbell={center:p.lw,axis:[0,0,1]};
  return p;
}
function smithBridge(phase) {
  const p=bridge(phase,false);
  p.barbell.center[2]=.109;
  for (const [side,sign] of sides) arm(p,side,add(p.barbell.center,[sign*.182,0,0]),
    [sign*.56,.09,.63],axis);
  return p;
}
function squatLunge(phase) {
  if(phase<=.5)return squatWithBar(phase*2,{jump:true,depth:.31});
  return lunge(phase*2-1,{direction:"reverse"});
}

addRows([["0084"],["0103",{standing:true}]],rollout,["core","lat"],"barbell",
  {yaw:65,elevation:17,focus:[0,.65,.21],height:1.97},4800);
addRows([["2407",{blaster:true}],["2404",{blaster:true,ez:true}],["2414",{braced:true}],["1747",{ball:true,ez:true}]],
  elevatedCurl,["biceps"],({ball,blaster,ez})=>ball?"ez-stability-ball":blaster?ez?"ez-arm-blaster":"barbell-arm-blaster":"barbell",
  ({ball})=>({...standing,yaw:62,focus:[0,ball?.70:.94,.055],height:ball?1.85:2.23}));
addRows([["0071"]],barSitup,["core","triceps"],"bench-barbell",{yaw:69,elevation:16,focus:[.10,.99,1.02],height:2.13});
addRows([["0064"]],supportedOneArm,["l:lat","l:biceps"],"barbell-onearm-bench",
  {yaw:61,elevation:15,focus:[.15,.69,.29],height:1.84});
addRows([["0562"],["0589",{row:true}]],landmine,["core","lat"],"landmine",
  ({row})=>({...standing,yaw:row?69:43,focus:[0,.99,.57],height:2.50}));
addRows([["0756"]],smithBridge,["glute","hamstring"],"smith-standing",
  {yaw:57,elevation:19,focus:[0,.98,.055],height:2.61});
addRows([["2798"]],squatLunge,["glute","quad"],"barbell",standing,6200,.68);

function fitBarbellCamera(camera, keyframes) {
  const yaw = camera.yaw * Math.PI / 180;
  const elevation = camera.elevation * Math.PI / 180;
  const screenUp = [-Math.sin(yaw) * Math.sin(elevation), Math.cos(elevation), -Math.cos(yaw) * Math.sin(elevation)];
  const projectedFocus = dot(camera.focus,screenUp);
  let required = camera.height / 2;
  for (const frame of keyframes) {
    const bar = frame.barbell;
    if (!bar) continue;
    const plates = [-.717,.717].map(offset => add(bar.center,scale(bar.axis,offset)));
    for (const point of plates) required = Math.max(required,Math.abs(dot(point,screenUp) - projectedFocus) + .255);
    for (const joint of ['head','la','ra','lt','rt']) {
      required = Math.max(required,Math.abs(dot(frame[joint],screenUp) - projectedFocus) + .105);
    }
  }
  return { ...camera,height:Math.round((required * 2 + .02) * 100) / 100 };
}

const [directory, ...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const selected = requested.length ? rows.filter(({id}) => requested.includes(id)) : rows;
if (new Set(rows.map(({id}) => id)).size !== rows.length || (requested.length && selected.length !== requested.length))
  throw new Error("Invalid or duplicate barbell IDs.");
const output = resolve(directory);
await mkdir(output,{recursive:true});
const items = [];
const failed = [];
for (const item of selected) {
  const recipe = { version:1, durationMs:item.option.fast ? 2400 : item.duration, equipment:item.equipment,
    muscles:item.muscle,
    keyframes:Array.from({length:49},(_,i)=>({at:i/48,...item.movement(i/48,item.option)})),
  };
  recipe.camera = fitBarbellCamera(item.camera,recipe.keyframes);
  try {
    prepareRecipe(recipe);
    const file = item.id + ".json";
    await writeFile(resolve(output,file),JSON.stringify(recipe)+"\n");
    items.push({id:item.id,recipe:file,posterAt:item.posterAt});
  } catch (error) {
    failed.push({id:item.id,reason:error.message});
  }
}
await writeFile(resolve(output,"batch.json"),JSON.stringify({kind:"catalogue",items},null,2)+"\n");
console.log(JSON.stringify({prepared:items.length,failed},null,2));
if (failed.length) process.exitCode=1;
