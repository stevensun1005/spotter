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

function benchBody(kind, feetOnBench = false, floatingFeet) {
  const setup = benchSetups[kind];
  const pose = athlete(feetOnBench ? add(setup.hips, [0, 0, -.044]) : setup.hips, setup.pitch);
  pose.headDrop = kind === "incline" ? .008 : .025;
  for (const [index, [side, sign]] of sides.entries()) {
    if (floatingFeet === "right-angle") {
      const [x,y,z] = pose[side + "h"];
      pose[side + "k"] = [x + sign * .022, y + .412, z + .064];
      pose[side + "a"] = [x + sign * .022, y + .349, z + .483];
      pose[side + "t"] = [x + sign * .033, y + .455, z + .590];
      continue;
    }
    const anchor = feetOnBench ? [.1 + sign * .110, .504, 1.281] : setup.ankles[index];
    if (floatingFeet === "straight") {
      const hip = pose[side + "h"];
      foot(pose, side, sign, add(hip, [sign * .026, -.059, .823]), null, 0, [sign * .1,1,.14]);
      continue;
    }
    const support = feetOnBench ? .428 : kind === "decline" ? null : 0;
    foot(pose, side, sign, anchor, support,
      0, feetOnBench ? [0, 1, 0] : kind === "decline" ? [sign * .19, .95, .30] : [sign * .57, 1, .12]);
  }
  return pose;
}

function benchPress(phase, { kind = "flat", grip = "standard", gripWidth, smith = false, reverse = false,
  action, pin = false, ez = false, pause = false, feetOnBench = false, straightPinPath = false, floatingFeet,
  boardCount = 0 } = {}) {
  const amount = pin ? 1 - rep(phase, straightPinPath ? .43 : .45, straightPinPath ? .51 : .58)
    : pause ? rep(phase, .39, .62) : rep(phase, .48, .58);
  const pose = benchBody(kind, feetOnBench, floatingFeet);
  const setup = benchSetups[kind];
  const [x, y, z] = pose.ls;
  const width = gripWidth ?? (ez ? .173 : grip === "close" ? .218 : grip === "wide" ? .462 : .367);
  const path = {
    flat: [[1.110,.743], [.715,.88]],
    incline: [[1.505,-.081], [1.071,-.024]],
    decline: [[1.071,.697], [.660,.832]],
    floor: [[.708,-.284], [.379,-.247]],
  };
  const [top, ordinary] = path[kind];
  const bottom = boardCount ? [.691+.034*boardCount,.872] : action === "neck" ? [.752, z - .054]
    : action === "jm" ? [y + .152, z + .074]
    : pin ? [y + .187, z + .104] : ordinary;
  const topHeight = kind === "incline" && reverse && grip === "wide" ? top[0] - .035 : top[0];
  const center = [setup.aimX, mix(topHeight, bottom[0], amount),
    straightPinPath ? bottom[1] : smith ? mix(top[1], bottom[1], .42) : mix(top[1], bottom[1], amount)];
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

function supineArc(phase, { kind = "flat", type = "pullover", grip = "standard", ez = false, reverse = false,
  smith = false, arcReach, arcFinish, hold = false, depthOffset = 0 } = {}) {
  const amount = hold ? rep(phase, .224, .746) : rep(phase, .50, .58);
  const pose = benchBody(kind);
  if (depthOffset) {
    for (const [name, joint] of Object.entries(pose)) {
      if (Array.isArray(joint)) pose[name] = add(joint, [0,0,depthOffset]);
    }
  }
  const [, y, z] = pose.ls;
  const width = ez ? .173 : grip === "wide" ? .46 : grip === "close" ? .188 : .253;
  const centerX = benchSetups[kind].aimX;
  if (type === "pullover" || type === "bent-pullover" || type === "front-pullover") {
    const start = type === "front-pullover" ? 1.42 : .075;
    const angle = mix(start, arcFinish ?? (kind === "decline" ? -1.86 : -1.47), amount);
    const reach = arcReach ?? (type === "bent-pullover" ? .536 : .582);
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

function curl(phase, { mode = "standing", width = .249, reverse = false, smith = false, strict = false, travel } = {}) {
  const amount = travel ?? (strict ? rep(phase, .41, .62) : rep(phase, .44, .55));
  const seated = mode === "seated" || mode === "concentration";
  const preacher = mode === "preacher";
  const prone = mode === "prone";
  const drag = mode === "drag";
  const hips = prone ? [0,.62,-.27] : seated || preacher ? [0,.558,-.025] : [0,.899,.008];
  const pose = athlete(hips, prone ? 1.04 : preacher ? .31 : mode === "concentration" ? 1.048 : strict ? 0 : .018);
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
  jump = false, single = false, kneeling = false, thruster = false, box = false, feet = .112,
  pause = false, turnout = false, upright = false, railRack = false, pinStart = false, benchContact = false,
  heel = 0, backGripWidth = 0 } = {}) {
  const up = jump ? smooth((phase - .49) / .21) * smooth((.91 - phase) / .15) : 0;
  const amount = pinStart ? 1-smooth((phase-.13)/.33)*smooth((.87-phase)/.32)
    : pause ? rep(phase, .27, .65) : rep(phase, fast ? .53 : .45, fast ? .58 : .57);
  const restY = kneeling ? .495 : .887+heel*.62;
  const barDepth = .041;
  const shoulderPitch = upright ? .25 : rack === "low" ? .52 : rack === "back" ? .39 : .25;
  const hips = [single ? -.060 : 0, restY - (kneeling ? .266 : depth) * amount + .13 * up,
    kneeling ? -.12 - .31 * amount : smith ? barDepth - .041 - (rack === "front" || (railRack && rack === "freefront") ? .100 : railRack && rack === "zercher" ? .218 : -.086)
      - .505 * Math.sin(.037 + shoulderPitch * amount) : -.021 - (benchContact ? .338 : box ? .179 : .139) * amount];
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
    for (const [side, sign] of sides) {
      foot(pose,side,sign,[sign * width,.076 + .13 * up+heel,feet],float ? null : 0,heel,
        turnout ? [sign * .64,.015,1] : [sign * .12,.015,1]);
      if (turnout) pose[side + "t"][0] += sign * .049;
    }
  }
  const extended = thruster ? smooth((phase - .56) / .17) * smooth((.99 - phase) / .20) : 0;
  const lowBar = rack === "low";
  const front = rack === "front" || rack === "freefront";
  const overhead = rack === "overhead";
  const handsFree = rack === "freefront";
  const offsetY = front ? (railRack && !handsFree ? .060 : .041) : lowBar ? -.043 : .030;
  const offsetZ = front ? .109 : -.087;
  const c = [0,pose.ls[1] + (overhead ? .460 : rack === "zercher" ? -.205 : offsetY + .515 * extended),
    smith ? barDepth : pose.ls[2] + (overhead ? -.066 : rack === "zercher" ? .218 : offsetZ - .112 * extended)];
  if (handsFree) {
    for (const [side, sign] of sides) arm(pose, side, add(pose[side + "s"], [sign*.025,.015,.609]), [sign*.34, -.60, .05]);
    pose.barbell = { center: c, axis };
  } else if (front && railRack) {
    for (const [side,sign] of sides) {
      const grip=add(c,[sign*.246,0,0]);
      [pose[side+"e"],pose[side+"w"]]=joints(pose[side+"s"],grip,[0,-.1,1],.252,.213);
      pose[side+"Grip"]=axis;
    }
    pose.barbell={center:c,axis};
  } else if (rack === "zercher") {
    for (const [side,sign] of sides) {
      pose[side + "e"] = [sign * .199,c[1] - .017,c[2] + .004];
      pose[side + "w"] = [sign * (railRack ? -.115 : .151),c[1] + .310,c[2] - .187];
    }
    pose.barbell = {center:c,axis};
  } else {
    loadedBar(pose,c,backGripWidth|| (overhead ? .502 : lowBar ? .408 : smith && !front ? .376 : .351),
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

function lunge(phase, { direction = "forward", smith = false, staticStance = false, sprint = false,
  alternate = false, fixedWide = false, frontRack = false, longSplit = false, stableStance = false, railAligned = false,
  overhead = false, walking = false } = {}) {
  const active = alternate && phase >= .5 ? -1 : 1;
  const time = alternate ? phase * 2 % 1 : phase;
  const amplitude = rep(time,.42,.58);
  const travel = staticStance || fixedWide ? 1 : smooth(time / .26) * smooth((1 - time) / .27);
  const sideStep = direction === "side";
  const curtsy = direction === "curtsy";
  const reverse = direction === "reverse" || curtsy;
  const x = sideStep ? active * .269 * amplitude : 0;
  const pitch = frontRack ? .035 + .043 * amplitude : .053 + amplitude * .17;
  const position = railAligned ? .108 - .505 * Math.sin(pitch) : stableStance ? longSplit ? .315 : .278
    : sideStep ? -.063 : reverse ? -.152 * travel : .182 * travel;
  const hipHeight = stableStance ? .824 - amplitude * (longSplit ? .322 : .308) : .875 - amplitude * (longSplit ? .369 : .346);
  const pose = athlete([x,hipHeight,position], pitch);
  if (sideStep) {
    for (const [side,sign] of sides) {
      const widened = sign === active || fixedWide;
      const width = fixedWide ? .367 : .157 + (widened ? .360 * travel : 0);
      foot(pose,side,sign,[sign * width,.076,.093]);
    }
  } else {
    for (const [side,sign] of sides) {
      const leading = sign === active;
      const advances = reverse ? !leading : leading;
      const depth = .052 + travel * (leading ? (reverse ? 0 : longSplit ? .63 : .57) : (reverse ? -.54 : longSplit ? -.16 : -.094));
      const lift = advances && travel < .999 ? Math.sin(Math.PI * travel) * .079 : 0;
      const heel = leading ? 0 : .102 * travel;
      foot(pose,side,sign,[sign * .128+(curtsy&&!leading?active*.388*travel:0),.076 + heel + lift,depth],
        lift > .003 ? null : 0, heel);
    }
  }
  const center = [x,pose.ls[1] + (overhead?.549:frontRack ? .060 : .033),smith ? .026 :
    pose.ls[2] + (overhead?.021:frontRack ? .104 : -.084)];
  if (frontRack) {
    for (const [side, sign] of sides) {
      const grip = add(center, [sign * .246, 0, 0]);
      [pose[side + "e"], pose[side + "w"]] = joints(pose[side + "s"], grip, [0,-.1,1], .252, .213);
      pose[side + "Grip"] = axis;
    }
    pose.barbell = { center, axis };
  } else {
    loadedBar(pose,center,overhead?.378:.367,sign => [sign*.48,-.74,-.48]);
  }
  if(walking){
    const shift=.621*phase;
    for(const [name,value] of Object.entries(pose)){
      if(Array.isArray(value)&&!name.endsWith("Grip"))pose[name]=add(value,[0,0,shift]);
    }
    pose.barbell.center=add(pose.barbell.center,[0,0,shift]);
    pose.followZ=shift*.84;
  }
  if (sprint) pose.head[2] += .027 * amplitude;
  return pose;
}

function calfRaise(phase, { step = false, single = false, seated = false, smith = false, supported = false, highHandle = false,
  platformDepth, kneeBend=false } = {}) {
  const amount = rep(phase, .44,.61);
  const height = step ? .122 : 0;
  const depth = seated ? .571 : step ? platformDepth ?? .296 : .047;
  const lift = mix(step ? -.045 : 0, .092, amount);
  const hips = [single ? -.069 : 0,seated ? .556 : .878 + height + lift-(kneeBend?.119:0),
    seated ? -.021 : supported ? .068 + .027 * amount : .009 + .035 * amount];
  const pose = athlete(hips,kneeBend?.119:.032);
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

function bridge(phase, feetElevated, barPosition=-.067) {
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
  loadedBar(pose,[0,hip[1] + .128,hip[2]+barPosition],.264,sign => [sign*.84,.01,.18]);
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
const benchCamera = ({ kind = "flat", smith = false, view }) => ({
  yaw: view === "side" ? 79 : kind === "incline" ? 56 : 63, elevation: kind === "decline" ? 21 : 15,
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

function catalogueShrug(phase, { behind = false, width = .248, seated = false } = {}) {
  const amount = rep(phase, .36, .62);
  const pose = athlete(seated ? [0,.564,-.019] : [0,.886,.002]);
  stance(pose, .149, seated ? .524 : .074);
  for (const [side] of sides) pose[side + "s"][1] += .071 * amount;
  const height = seated ? .604 : .818 + (width > .35 ? .055 : 0);
  const center = [0, height + .071 * amount, seated ? .390 : behind ? -.165 : .134];
  loadedBar(pose, center, width, sign => [sign * .5, -.32, behind ? -.64 : -.16], behind);
  return pose;
}

function wideDragCurl(phase, { width = .343, rail = false } = {}) {
  const amount = rep(phase, .43, .57);
  const pose = athlete([0, .899, .008]);
  stance(pose, .157, .056);
  const center = [0, mix(.826, 1.325, amount), rail ? .143 : mix(.135, .162, amount)];
  loadedBar(pose, center, width, sign => [sign * .16, -.34, -.92]);
  return pose;
}

function sumoRomanianDeadlift(phase) {
  const amount = rep(phase, .44, .55);
  const pose = athlete([0, mix(.873, .777, amount), mix(-.034, -.258, amount)], mix(.02, 1.05, amount));
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * .298, .076, .035], 0, 0, [sign * .69, .018, .82]);
    const ankle = pose[side + "a"];
    pose[side + "t"] = [ankle[0] + sign * .078, .006, ankle[2] + .122];
  }
  const center = [0, mix(.800, .507, amount), mix(.150, .239, amount)];
  loadedBar(pose, center, .156, sign => [sign * .28, -.16, -.92]);
  return pose;
}

// These variants are keyed to the original catalogue instructions and keep their exact grip,
// support and movement. Behind-the-back shrugs are framed from the rear to reveal the bar.
addRows([
  ["4721", {width:.194}], ["4981", {width:.132}], ["5669", {width:.194, strict:true}],
], curl, ["biceps"], "barbell", standing);
addRows([["2413"]], wideDragCurl, ["biceps"], "barbell", {...standing, yaw:58});
addRows([
  ["5226", {behind:true, width:.434}], ["3730", {behind:true}], ["5224", {width:.434}],
], catalogueShrug, ["trap"], "barbell", ({behind}) => ({...standing, yaw:behind ? 135 : 43}));
addRows([["5632", {type:"upright", width:.198}]], standingPull, ["shoulder","trap"], "barbell", standing);
addRows([
  ["5091", {reverse:true, grip:"close"}], ["1173", {kind:"incline", reverse:true, grip:"wide"}],
], benchPress, ["pec","triceps"], benchHardware, benchCamera);
addRows([
  ["3917", {kind:"floor", reverse:true, grip:"close"}], ["10115", {kind:"decline", grip:"close"}],
], benchPress, ["triceps","pec"], benchHardware, benchCamera, 4600);
addRows([["3731"]], sumoRomanianDeadlift, ["hamstring","glute"], "barbell",
  {...standing, yaw:58, focus:[0,.86,.02], height:2.10}, 4600);

addRows([
  ["6813", {view:"side", gripWidth:.246}], ["6584", {feetOnBench:true, gripWidth:.251}],
  ["3724", {kind:"floor", gripWidth:.247}], ["0036", {kind:"decline", grip:"wide"}],
], benchPress, ["pec","triceps"], benchHardware, benchCamera, 4200);
addRows([
  ["5013", {pause:true, gripWidth:.247}], ["5010", {kind:"decline", pause:true, gripWidth:.247}],
  ["5011", {kind:"incline", pause:true, gripWidth:.247}],
], benchPress, ["pec","triceps"], benchHardware, benchCamera, 4600);
addRows([
  ["7621", {pin:true, straightPinPath:true, gripWidth:.218}],
  ["5660", {pin:true, straightPinPath:true, gripWidth:.255}],
], benchPress, ["pec","triceps"], benchHardware, benchCamera, 4500);
addRows([["4856", {pin:true, straightPinPath:true, grip:"close"}]], benchPress, ["triceps","pec"],
  benchHardware, benchCamera, 4500);

const squatView = {...standing, yaw:49, height:2.32};
addRows([
  ["1514", {depth:.096}], ["5633", {width:.069, depth:.353}], ["1527", {upright:true, depth:.455}],
  ["1868", {rack:"low", depth:.370}], ["5017", {pause:true, depth:.410}],
], squatWithBar, ["quad","glute"], ({rack}) => rack === "low" ? "barbell-rack" : "barbell", squatView, 5200);
addRows([["1063", {width:.358, turnout:true, depth:.449}]], squatWithBar, ["glute","quad"], "barbell",
  {...squatView, yaw:33}, 4600);

const lungeView = {...standing, yaw:58, height:2.19};
addRows([
  ["3399", {frontRack:true, alternate:true}], ["4382", {frontRack:true, alternate:true, longSplit:true}],
  ["4390", {frontRack:true, direction:"reverse", alternate:true}], ["0078", {direction:"reverse", alternate:true}],
], lunge, ["glute","quad"], "barbell", lungeView, 6400, .23);
addRows([
  ["4397", {frontRack:true, staticStance:true, longSplit:true, stableStance:true}],
  ["6329", {staticStance:true, longSplit:true, stableStance:true}],
  ["3030", {staticStance:true, longSplit:true, stableStance:true}], ["10054", {staticStance:true, stableStance:true}],
], lunge, ["quad","glute"], "barbell", lungeView, 4400);

addRows([
  ["1165", {width:.245}], ["5328", {width:.247}], ["0788", {behind:true, width:.352}],
], standingPress, ["shoulder","triceps"], "barbell", {...standing, focus:[0,1.02,0], height:2.24}, 4200);

function deadliftRise(phase, pause) {
  if (!pause) return rep(phase, .40, .54);
  if (phase < .15) return .12 * smooth(phase / .15);
  if (phase < .35) return .12;
  if (phase < .57) return mix(.12, 1, smooth((phase - .35) / .22));
  return smooth((1 - phase) / .43);
}

function hingedAthlete(hipHeight, hipDepth, pitch, barCenter, width) {
  const shoulderLift = .505 * Math.cos(pitch) - .004 * Math.sin(pitch);
  const shoulderDepth = hipDepth + .505 * Math.sin(pitch) + .004 * Math.cos(pitch);
  const armReach = Math.sqrt(.619 ** 2 - (width - .192) ** 2 - (barCenter[2] - shoulderDepth) ** 2);
  return athlete([0, Math.min(hipHeight, barCenter[1] + armReach - shoulderLift), hipDepth], pitch);
}

function catalogueDeadlift(phase, { pause = false, wide = false, snatch = false, frog = false, rail = false,
  blocks=0, deficit=0, twoStage=false, hook=false } = {}) {
  const rise = twoStage ? phase<.29 ? .42*smooth(phase/.19) : phase<.56 ? .42+.58*smooth((phase-.29)/.27)
    :smooth((1-phase)/.39) : deadliftRise(phase, pause);
  const initialHip = (wide ? .518 : snatch ? .552 : .565)+blocks*.41+deficit*.78;
  const width = snatch ? .434 : wide ? .153 : .226;
  const center = [0, mix(.197+blocks, (snatch ? .853 : .817)+deficit, rise), rail ? .136 : mix(.136, .128, rise)];
  const pose = hingedAthlete(mix(initialHip, .877+deficit, rise), mix(wide ? -.220 : -.261, -.016, rise),
    mix(wide ? .91 : .995, .022, rise), center, width);
  for (const [side, sign] of sides) {
    const footWidth = frog ? .270 : wide ? .315 : .158;
    foot(pose, side, sign, [sign * footWidth, .076+deficit, .040], deficit, 0, [sign * (wide ? .60 : .15), .027, 1]);
    if (wide) pose[side + "t"][0] += sign * (frog ? .087 : .055);
  }
  loadedBar(pose, center, width, sign => [sign * .19, -.30, -.94]);
  if(hook)for(const [side] of sides)pose[side+"FingerCurl"]=.93;
  return pose;
}

function stiffLegDeadlift(phase, { wide = false, rail = false, deficit=0 } = {}) {
  const amount = rep(phase, .45, .53);
  const width = wide ? .177 : .224;
  const center = [0, mix(.804+deficit, .463+deficit*.58, amount), rail ? .186 : mix(.144, .282, amount)];
  const pose = hingedAthlete(mix(.869+deficit, (wide ? .801 : .827)+deficit*.79, amount), mix(-.009, -.236, amount),
    mix(.024, 1.16, amount), center, width);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * (wide ? .263 : .150), .076+deficit, .051], deficit, 0,
      [sign * (wide ? .52 : .13), .015, 1]);
    if (wide) pose[side + "t"][0] += sign * .046;
  }
  loadedBar(pose, center, width, sign => [sign * .22, -.14, -.92]);
  return pose;
}

function chestSupportedBarbellAthlete(overTop = false) {
  const pose = athlete(overTop ? [0,.772,-.026] : [0,.560,.213], .785, Math.PI);
  for (const [side, sign] of sides) {
    foot(pose, side, -sign, [-sign * .175, .076, overTop ? .295 : .828], 0, 0, [-sign * .13, .1, -1]);
    const ankle = pose[side + "a"];
    pose[side + "t"] = [ankle[0] - sign * .032, .006, ankle[2] - .145];
  }
  return pose;
}

function catalogueRow(phase, { supported = false, rearDelt = false, reverse = false, width = .300, rail = false } = {}) {
  const amount = rep(phase, .42, .59);
  const pose = supported ? chestSupportedBarbellAthlete() : athlete([0,.780,-.195], 1.095);
  if (!supported) stance(pose, .151, .045);
  const [,, shoulderZ] = pose.ls;
  const hangingY = pose.ls[1] - (width > .32 ? .584 : .603);
  const topZ = shoulderZ + (supported ? rearDelt ? .020 : .080 : rearDelt ? -.036 : -.152);
  // The support rail slopes down toward the seat. Keep the shaft below it.
  const topY = supported ? .648 - (topZ + .110) - .052 : pose.ls[1] - (rearDelt ? .118 : .166);
  const center = [0, mix(hangingY, topY, amount), rail ? mix(shoulderZ, topZ, .55) : mix(shoulderZ, topZ, amount)];
  loadedBar(pose, center, width,
    sign => [sign * (supported ? -1 : 1) * (rearDelt ? .97 : .23), .54, supported ? .64 : -.77],
    reverse, supported ? [-1,0,0] : axis);
  return pose;
}

function seatedBarbellRaise(phase, { high = false } = {}) {
  const amount = rep(phase, .43, .57);
  const pose = athlete([0,.564,-.019]);
  stance(pose,.155,.528);
  const angle = mix(.49, high ? 1.86 : 1.56, amount);
  const radius = mix(.454, .586, amount);
  const center = [0, pose.ls[1] - radius * Math.cos(angle), pose.ls[2] + radius * Math.sin(angle)];
  loadedBar(pose, center, .244, sign => [sign * .30, -.78, -.50]);
  return pose;
}

function overheadBarbellShrug(phase) {
  const amount = rep(phase, .39, .58);
  const pose = athlete([0,.873,-.014]);
  stance(pose,.152,.056);
  for (const [side] of sides) pose[side + "s"][1] += .066 * amount;
  const center = [0, pose.ls[1] + .559, .034];
  loadedBar(pose, center, .436, sign => [sign * .29, -.96, -.08]);
  return pose;
}

addRows([
  ["4340", {grip:"wide", arcReach:.548}], ["7565", {type:"bent-pullover"}],
  ["4339", {grip:"close", arcFinish:-1.60, arcReach:.546}],
], supineArc, ["lat"], benchHardware, benchCamera, 4400);
addRows([["4344", {kind:"incline", type:"extension", depthOffset:.118}]],
  supineArc, ["triceps"], benchHardware, benchCamera, 4400);
addRows([
  ["3308"], ["5014", {pause:true}], ["5577", {wide:true, pause:true}], ["1535", {snatch:true}],
  ["9696", {wide:true, frog:true}],
], catalogueDeadlift, ["glute","hamstring"], "barbell",
  ({wide}) => ({...standing, yaw:wide ? 48 : 57, focus:[0,.82,.02], height:2.02}), 5600, .05);
addRows([
  ["1543"], ["1544", {wide:true}],
], stiffLegDeadlift, ["hamstring","glute"], "barbell",
  ({wide}) => ({...standing, yaw:wide ? 49 : 64, focus:[0,.84,.03], height:2.03}), 4500);
addRows([
  ["3721", {rearDelt:true, width:.374}], ["0062", {reverse:true, width:.153}],
  ["2509", {supported:true, reverse:true, width:.229}],
], catalogueRow, ["lat","trap"], ({supported}) => supported ? "barbell-chest-support-row" : "barbell",
  ({supported}) => ({...standing, yaw:supported ? 56 : 69, focus:[0,.80,.06], height:2.11}), 4500);
addRows([
  ["0076", {rearDelt:true, width:.257}], ["5853", {supported:true, rearDelt:true, width:.347}],
], catalogueRow, ["rearShoulder","trap"], ({supported}) => supported ? "barbell-chest-support-row" : "barbell",
  {...standing, yaw:63, focus:[0,.80,.05], height:2.11}, 4500);
addRows([
  ["3726"], ["4411", {high:true}],
], seatedBarbellRaise, ["shoulder"], "barbell-seat",
  {...standing, yaw:60, focus:[0,.74,.12], height:1.77}, 4200);
addRows([["2928"]], overheadBarbellShrug, ["trap","shoulder"], "barbell",
  {...standing, yaw:37, focus:[0,1.02,.02], height:2.30}, 4200);

function pulloverPress(phase) {
  const pose = benchBody("flat");
  const start = [.10,1.11,.743];
  const pullingOver = phase < .53;
  const amount = pullingOver ? rep(phase / .53, .44, .57) : rep((phase - .53) / .47, .43, .53);
  const camber = mix(.02, -1.55, amount);
  const center = pullingOver
    ? [start[0], start[1] + .537 * (Math.cos(camber) - Math.cos(.02)), start[2] + .537 * (Math.sin(camber) - Math.sin(.02))]
    : lerp(start,[.10,.715,.88],amount);
  loadedBar(pose, center, .247, sign => [sign * .52,-.54,.22]);
  return pose;
}

function spiderCurl(phase, { reverse = false } = {}) {
  const pose = chestSupportedBarbellAthlete(true);
  const amount = rep(phase, .45, .57);
  const angle = mix(.05, 2.27, amount);
  const elbowY = pose.ls[1] - .251;
  const depth = pose.ls[2] - .037;
  const center = [0,elbowY - .348 * Math.cos(angle),depth - .348 * Math.sin(angle)];
  for (const [side,sign] of sides) {
    pose[side + "e"] = [-sign * .194, elbowY, depth];
    pose[side + "w"] = add(center, [-sign * .213,0,0]);
    pose[side + "Grip"] = reverse ? axis : [-1,0,0];
  }
  pose.barbell = {center,axis};
  return pose;
}

addRows([
  ["6270", {floatingFeet:"straight", gripWidth:.257}],
  ["3174", {floatingFeet:"right-angle", gripWidth:.251}],
], benchPress, ["pec","triceps"], benchHardware, option => ({
  ...benchCamera(option), yaw:53, focus:[.10,.75,1.12], height:1.72,
}), 4400);
addRows([["6271", {floatingFeet:"straight", grip:"close"}]], benchPress, ["triceps","pec"],
  benchHardware, {...benchCamera({}), yaw:53, focus:[.10,.74,1.12], height:1.72}, 4400);
addRows([["0035", {kind:"decline", type:"extension", grip:"close"}]], supineArc,
  ["triceps"], benchHardware, benchCamera, 4400);
addRows([["1448", {hold:true, arcFinish:-1.54, arcReach:.557}]], supineArc,
  ["lat"], benchHardware, benchCamera, 6500);
addRows([["0022"]], pulloverPress, ["lat","pec","triceps"], "bench-barbell",
  {...benchCamera({}), yaw:66}, 6400, .25);
addRows([["4338"]], spiderCurl, ["biceps"], "barbell-chest-bench",
  {...standing, yaw:120, focus:[0,.78,.22], height:2.02}, 4500);
addRows([["3988", {reverse:true}]], spiderCurl, ["forearm","biceps"], "barbell-chest-bench",
  {...standing, yaw:120, focus:[0,.78,.22], height:2.02}, 4500);
addRows([["4862", {width:.488}]], catalogueShrug, ["trap"], "barbell", {...standing, yaw:37}, 4000);

function anchoredShoulderPress(phase, { floor = false } = {}) {
  const extend = rep(phase, .43, .56);
  const pose = athlete(floor ? [0,.148,-.168] : [-.045,.513,.018], floor ? -.023 : .027);
  if (floor) {
    for (const [side, sign] of sides) {
      pose[side + "k"] = [sign*.131,.103,.247];
      pose[side + "a"] = [sign*.150,.073,.661];
      pose[side + "t"] = [sign*.157,.183,.737];
    }
  } else {
    foot(pose,"l",1,[.156,.076,.456],0,0,[.05,1,.21]);
    pose.rk = [-.162,.087,.018];
    pose.ra = [-.172,.067,-.406];
    pose.rt = [-.182,.025,-.544];
  }
  const center = [pose.hips[0], pose.ls[1] + mix(.025,.586,extend), pose.ls[2] + mix(.151,.032,extend)];
  loadedBar(pose,center,.246,sign=>[sign*.80,-.64,.32]);
  return pose;
}

function squatToOverheadPress(phase) {
  const squat = smooth(phase/.275) * smooth((.565-phase)/.225);
  const press = smooth((phase-.402)/.227) * smooth((1-phase)/.241);
  const pose = athlete([0,.883-.372*squat,-.022-.137*squat],.024+.287*squat);
  stance(pose,.179,.078);
  const center = [0,pose.ls[1]+.055+.533*press,pose.ls[2]+.117-.088*press];
  loadedBar(pose,center,.255,sign=>[sign*.78,-.49,.50]);
  return pose;
}

function singleLegGoodMorning(phase) {
  const amount = rep(phase, .45, .58);
  const pose = athlete([-.104,mix(.873,.800,amount),mix(-.004,-.186,amount)],mix(.02,1.30,amount));
  foot(pose,"r",-1,[-.152,.076,.056]);
  const floating = [mix(.133,-.015,amount),mix(.103,.745,amount),mix(.011,-1.006,amount)];
  foot(pose, "l", 1, floating, null, 0, [.12,-.91,.16]);
  const center = [pose.hips[0],pose.ls[1]+.023,pose.ls[2]-.102];
  loadedBar(pose,center,.356,sign=>[sign*.58,-.69,-.28]);
  return pose;
}

function staggeredHinge(phase, { stiff = false } = {}) {
  const amount = rep(phase, .45, .57);
  const center = [.041,mix(.813,stiff?.441:.503,amount),mix(.209,.308,amount)];
  const pose = hingedAthlete(mix(.880,stiff?.826:.780,amount),mix(.015,-.192,amount),
    mix(.045,stiff?1.24:1.09,amount),center,.246);
  for (const [name,joint] of Object.entries(pose)) {
    if (Array.isArray(joint)) pose[name] = add(joint,[center[0],0,0]);
  }
  foot(pose,"l",1,[.148,.076,.181]);
  foot(pose,"r",-1,[-.109,.147,stiff?-.158:-.189],0,.071,[-.12,.06,1]);
  loadedBar(pose,center,.246,sign=>[sign*.21,-.21,-.94]);
  return pose;
}

function behindBackRaise(phase) {
  const amount = rep(phase, .41, .58);
  const pose = athlete([0,.891,.021],.007);
  stance(pose);
  const center = [0,mix(.815,1.081,amount),mix(-.151,-.329,amount)];
  loadedBar(pose,center,.286,sign=>[sign*.90,.37,-.64],true);
  return pose;
}

addRows([["4866", {floor:true}], ["9694"]], anchoredShoulderPress, ["shoulder","triceps"], "barbell",
  ({floor}) => ({...standing,yaw:57,focus:[0,floor?.72:.90,.17],height:floor?1.74:1.99}), 4200);
addRows([["1540"]], squatToOverheadPress, ["shoulder","quad","triceps"], "barbell",
  {...standing,yaw:54,focus:[0,.97,.04],height:2.30}, 4900, .64);
addRows([["4850"]], singleLegGoodMorning, ["r:hamstring","r:glute"], "barbell",
  {...standing,yaw:67,focus:[-.04,.88,-.08],height:2.16}, 4500);
addRows([["10047"], ["11789", {stiff:true}]], staggeredHinge, ["l:hamstring","l:glute"], "barbell",
  {...standing,yaw:57,focus:[0,.82,.08],height:2.08}, 4500);
addRows([["4016", {seated:true,width:.265}]], catalogueShrug, ["trap"], "barbell-seat",
  {...standing,yaw:52,focus:[0,.74,.12],height:1.75}, 4300);
addRows([["0075"]], behindBackRaise, ["rearShoulder","trap"], "barbell", {...standing,yaw:135}, 4350);

function inclineShoulderRaise(phase) {
  const amount = rep(phase,.40,.60);
  const pose = benchBody("incline");
  for (const [side] of sides) pose[side+"s"][1] += .067 * amount;
  const center = [0,1.529+.067*amount,-.093];
  loadedBar(pose,center,.260,sign=>[sign*.17,-.55,.71]);
  return pose;
}

function smithRackPull(phase) {
  const rise=rep(phase,.38,.58);
  const center=[0,mix(.503,.814,rise),.143];
  const pose=hingedAthlete(mix(.774,.870,rise),mix(-.184,-.013,rise),mix(.838,.028,rise),center,.227);
  stance(pose,.155,.058);
  loadedBar(pose,center,.227,sign=>[sign*.20,-.19,-.90]);
  return pose;
}

function californiaEZExtension(phase,{width=.173}={}) {
  const amount=rep(phase,.48,.57);
  const shoulderTurn=smooth((amount-.55)/.45);
  const pose=benchBody("flat");
  const elbowY=pose.ls[1]+.236-.057*shoulderTurn;
  const elbowZ=pose.ls[2]-.029-.109*shoulderTurn;
  const angle=mix(.02,1.60,amount);
  const center=[.1,elbowY+.371*Math.cos(angle),elbowZ-.371*Math.sin(angle)];
  for (const [side,sign] of sides) {
    pose[side+"e"]=[.1+sign*width,elbowY,elbowZ];
    pose[side+"w"]=add(center,[sign*width,0,0]);
    pose[side+"Grip"]=axis;
  }
  pose.barbell={center,axis};
  return pose;
}

function ezWristCurl(phase, {seated=false,behind=false,reverse=false}={}) {
  const amount=rep(phase,.42,.61);
  const pose=athlete([0,seated?.558:.879,seated?-.022:.014],seated?.48:.029);
  stance(pose,seated?.154:.147,seated?.465:.064);
  const height=seated?.547:.775;
  const depth=seated?.484:behind?-.155:.135;
  const center=[0,height+.042*amount,depth+(behind?-1:1)*.025*amount];
  const angle=mix(-.42,.65,amount)*(reverse?-1:1);
  for (const [side,sign] of sides) {
    pose[side+"e"]=[sign*.162,seated?.631:1.131,seated?.146:behind?-.091:.035];
    pose[side+"w"]=add(center,[sign*.173,0,0]);
    pose[side+"Grip"]=reverse?[-1,0,0]:axis;
    pose[side+"Fingers"]=[0,Math.sin(angle),(behind?-1:1)*Math.cos(angle)];
    pose[side+"PalmSide"]=[sign,0,0];
  }
  pose.barbell={center,axis};
  return pose;
}

// Guided rail variants fix shaft depth across the complete cycle as indicated by
// the source machine drawings. Grip, stance and support are explicit per ID.
const smithSide={...standing,yaw:58,height:2.62};
addRows([
  ["0754",{kind:"decline",smith:true,reverse:true,gripWidth:.239}], ["0758",{kind:"incline",smith:true,reverse:true,gripWidth:.212}],
  ["0764",{smith:true,reverse:true,gripWidth:.215}],
],benchPress,["pec","triceps"],benchHardware,benchCamera,4350);
addRows([
  ["10116",{kind:"incline",smith:true,grip:"close",gripWidth:.169}], ["9385",{smith:true,action:"jm",grip:"close"}],
],benchPress,["triceps","pec"],benchHardware,benchCamera,4350);
addRows([["0759"]],inclineShoulderRaise,["pec","shoulder"],"smith-incline",benchCamera({kind:"incline",smith:true}),4350);
addRows([["1224",{smith:true,width:.213}]],standingPress,["shoulder","triceps"],"smith-standing",smithSide,4350);
addRows([
  ["5225",{behind:true,width:.428}], ["5223",{width:.422}],
],catalogueShrug,["trap"],"smith-standing",({behind})=>({...smithSide,yaw:behind?133:47}),4200);
addRows([
  ["5316",{rail:true,width:.152}], ["0761",{rail:true,reverse:true,width:.150}], ["2671",{rail:true,width:.145}],
],catalogueRow,["lat","trap"],"smith-standing",smithSide,4350);
addRows([["0762",{rail:true,rearDelt:true,width:.365}]],catalogueRow,["rearShoulder","trap"],"smith-standing",smithSide,4350);
addRows([["4546",{width:.195,rail:true}]],wideDragCurl,["biceps"],"smith-standing",smithSide,4400);
addRows([
  ["1594",{rack:"freefront",smith:true,railRack:true,depth:.382}], ["1595",{rack:"front",smith:true,railRack:true,depth:.401}],
  ["1598",{rack:"zercher",smith:true,railRack:true,depth:.391}],
],squatWithBar,["quad","glute"],"smith-standing",smithSide,4900);
addRows([["5825",{direction:"reverse",smith:true,railAligned:true}]],lunge,["quad","glute"],
  "smith-standing",smithSide,4700);
addRows([
  ["1050",{step:true,smith:true,platformDepth:.122}], ["1164",{step:true,smith:true,platformDepth:.106}],
],calfRaise,["calf"],"smith-low-step",{...smithSide,yaw:65},4300);
addRows([["1393",{single:true,smith:true}]],calfRaise,["r:calf"],"smith-standing",{...smithSide,yaw:66},4300);
addRows([["1597",{rail:true}]],stiffLegDeadlift,["hamstring","glute"],"smith-standing",smithSide,4600);
addRows([["7374",{rail:true,wide:true}]],catalogueDeadlift,["glute","hamstring"],"smith-standing",smithSide,4950,.055);
addRows([["4171"]],smithRackPull,["glute","hamstring"],"smith-standing",{...smithSide,yaw:64},4600);

addRows([["4130"]],californiaEZExtension,["triceps"],"bench-ez-bar",{...benchCamera({}),yaw:73},4750);
addRows([["4422",{width:.173}]],wideDragCurl,["biceps"],"ez-barbell",{...standing,yaw:55});
addRows([["3990",{width:.158,seated:true}],["1226",{width:.226}]],standingPress,["shoulder","triceps"],
  ({seated})=>seated?"ez-seat":"ez-barbell",({seated})=>({...standing,focus:[0,seated?.805:1.025,.048],height:seated?1.99:2.25}),4350);
addRows([["7114",{type:"upright",width:.235}]],standingPull,["shoulder","trap"],"ez-barbell",standing,4350);
addRows([["6406",{mode:"preacher",width:.173}]],curl,["biceps"],"ez-preacher",supportCam,4400);
addRows([["1628"]],spiderCurl,["biceps"],"ez-chest-bench",{...standing,yaw:120,focus:[0,.78,.22],height:2.02},4500);
addRows([
  ["5579",{seated:true}], ["6364",{seated:true,reverse:true}], ["6358"], ["6361",{reverse:true}], ["6365",{behind:true}],
],ezWristCurl,["forearm"],({seated})=>seated?"ez-seat":"ez-barbell",
({seated,behind})=>({...standing,yaw:behind?139:56,focus:[0,seated?.660:.91,.126],height:seated?1.72:2.11}),4300);

function fixedSupportSplit(phase,{frontStep=false,rearBench=false}={}) {
  const amount=rep(phase,.43,.59);
  const pitch=.044+.182*amount;
  const hipY=mix(frontStep?.907:.838,frontStep?.548:.489,amount);
  const pose=athlete([0,hipY,.091-.505*Math.sin(pitch)],pitch);
  const frontSurface=frontStep?.121:0;
  foot(pose,"l",1,[.149,.075+frontSurface,frontStep?.276:.372],frontSurface,0,[.19,.17,.95]);
  if(rearBench){
    foot(pose,"r",-1,[-.155,.524,-.503],null,0,[-.13,-.14,.91]);
    pose.rt=add(pose.ra,[-.026,-.072,-.131]);
    pose.planted.r=.451;
  }else{
    foot(pose,"r",-1,[-.153,.162,-.329],0,.086,[-.17,.09,.95]);
  }
  const center=[0,pose.ls[1]+.030,.006];
  loadedBar(pose,center,.351,sign=>[sign*.58,-.67,-.53]);
  return pose;
}

function pinnedGoodMorning(phase,{smith=false}={}) {
  const upright=smith?1-rep(phase,.44,.57):smooth((phase-.14)/.32)*smooth((.86-phase)/.33);
  const pitch=mix(1.16,.025,upright);
  const hips=[0,mix(.795,.884,upright),smith ? .071-.505*Math.sin(pitch) : mix(-.237,-.022,upright)];
  const pose=athlete(hips,pitch);
  stance(pose,.158,smith?.041:.073);
  const center=[0,pose.ls[1]+.035,smith?-.012:pose.ls[2]-.084];
  loadedBar(pose,center,.351,sign=>[sign*.50,-.72,-.47]);
  return pose;
}

function squatRow(phase) {
  const down=smooth(phase/.25)*smooth((.61-phase)/.31);
  const pull=smooth((phase-.36)/.29)*smooth((1-phase)/.24);
  const pose=athlete([0,.882-.342*down,-.023-.183*down],.023+.392*down);
  stance(pose,.174,.063);
  const center=[0,.818-.278*down+.585*pull,.151+.075*down];
  loadedBar(pose,center,.216,sign=>[sign*.86,.38,-.32]);
  return pose;
}

function curlTwentyOne(phase) {
  const marks=[0,.50,0,.50,1,.50,0,1,0];
  const segment=Math.min(7,Math.floor(phase*8));
  const amount=mix(marks[segment],marks[segment+1],smooth(phase*8-segment));
  return curl(phase,{width:.173,travel:amount});
}

function inclineEZRaise(phase) {
  const amount=rep(phase,.43,.60);
  const pose=benchBody("incline");
  const sweep=mix(1.10,1.89,amount);
  const reach=mix(.545,.594,amount);
  const center=[0,pose.ls[1]-reach*Math.cos(sweep),pose.ls[2]+reach*Math.sin(sweep)];
  loadedBar(pose,center,.177,sign=>[sign*.35,-.71,-.48]);
  return pose;
}

function fingerCurlBehind(phase) {
  const amount=rep(phase,.44,.61);
  const pose=athlete([0,.878,.012],.028);
  stance(pose,.153,.064);
  const center=[0,.795+.046*amount,-.168-.018*amount];
  loadedBar(pose,center,.238,sign=>[sign*.22,-.32,-.92],true);
  for(const [side,sign] of sides) {
    pose[side+"FingerCurl"]=amount;
    pose[side+"Fingers"]=[0,-.92+.34*amount,-.17-.35*amount];
    pose[side+"PalmSide"]=[sign,0,0];
  }
  return pose;
}

addRows([
  ["5659",{pinStart:true,depth:.449}], ["5701",{pinStart:true,depth:.356}],
  ["4848",{rack:"front",railRack:true,pinStart:true,depth:.385}],
],squatWithBar,["quad","glute"],"barbell-squat-pins",{...standing,yaw:55,height:2.45},4850,.59);
addRows([["0878",{depth:.441,upright:true}]],squatWithBar,["quad","glute"],"barbell-squat-rack",
  {...standing,yaw:52,height:2.48},4750);
addRows([
  ["0024",{depth:.335,benchContact:true,rack:"front",railRack:true}],
  ["3727",{depth:.334,benchContact:true,rack:"front",railRack:true}], ["0026",{depth:.333,benchContact:true}],
],squatWithBar,["quad","glute"],"barbell-rear-bench",{...standing,yaw:63,height:2.24},4750);
addRows([["4962",{depth:.451,benchContact:true,pause:true}]],squatWithBar,["quad","glute"],
  "barbell-box-squat",{...standing,yaw:63,height:2.24},4850);
addRows([
  ["11303",{box:true,smith:true,depth:.381,feet:.155}],["1596",{box:true,smith:true,depth:.382,feet:.177}],
],squatWithBar,["quad","glute"],"smith-box",smithSide,4800);
addRows([
  ["9042",{rearBench:true}],["9041",{frontStep:true}],["11568",{rearBench:true,frontStep:true}],
],fixedSupportSplit,["l:quad","l:glute"],({frontStep,rearBench})=>frontStep?rearBench?"smith-rear-bench-step":"smith-low-step":"smith-rear-bench",
  {...smithSide,yaw:67},4900);
addRows([["4851"],["1519",{smith:true}]],pinnedGoodMorning,["hamstring","glute"],
  ({smith})=>smith?"smith-standing":"barbell-squat-pins",{...smithSide,yaw:63},4700);
addRows([["2964"]],phase=>bridge(phase,false,-.086),["glute"],"barbell",{yaw:63,elevation:17,focus:[0,.4,.06],height:1.49},4500);
addRows([["1541"]],squatRow,["quad","shoulder","trap"],"barbell",{...standing,yaw:55,height:2.23},4900,.66);
addRows([["5450"]],curlTwentyOne,["biceps"],"ez-barbell",{...standing,yaw:47},6500,.53);
addRows([["1610"]],fingerCurlBehind,["forearm"],"barbell",{...standing,yaw:137,focus:[0,.92,.01],height:1.95},4300);
addRows([["3989"]],inclineEZRaise,["shoulder"],"ez-incline-free",{...standing,yaw:55,focus:[0,.93,.03],height:2.07},4500);

// Each stop sets the pelvis, bar and stance for one phase of the Olympic lift.
const olympicPose = {
  floor: [.510,-.246,.997,.225,.212,.154,.066,.066,0,0,0],
  knee: [.622,-.222,.720,.519,.189,.154,.066,.066,0,0,0],
  belowKnee: [.656,-.211,.782,.490,.204,.155,.070,.070,0,0,0],
  highHang: [.807,-.075,.452,.678,.208,.153,.070,.070,0,0,0],
  standHang: [.885,.004,.025,.835,.153,.152,.069,.069,0,0,0],
  extension: [.907,.012,-.073,1.003,.172,.154,.068,.068,.025,.025,.18],
  turnover: [.871,.012,-.025,1.289,.199,.163,.066,.066,0,0,.13],
  highPull: [.895,.007,-.018,1.373,.198,.156,.068,.068,.016,.016,.03],
  deepCatch: [.531,-.116,.288,1.075,.173,.229,.097,.097,0,0,1],
  wideCatch: [.560,-.111,.244,1.105,.163,.239,.108,.108,0,0,1],
  highCatch: [.756,-.049,.166,1.294,.139,.193,.097,.097,0,0,1],
  highRack: [.857,-.019,.076,1.405,.120,.159,.079,.079,0,0,1],
  rack: [.886,.009,.015,1.431,.116,.165,.078,.078,0,0,1],
  dip: [.792,-.014,.046,1.335,.126,.166,.078,.078,0,0,1],
  drive: [.890,.023,-.065,1.645,.125,.165,.094,.064,.022,.022,.31],
  leftSplit: [.689,.055,.052,1.758,.083,.166,.442,-.346,0,.071,0],
  rightSplit: [.705,.068,.047,1.777,.087,.169,-.341,.423,.085,0,0],
  leftRecover: [.801,.047,.019,1.892,.070,.161,.206,-.237,0,.042,0],
  rightRecover: [.806,.056,.021,1.907,.071,.164,-.226,.202,.043,0,0],
  overhead: [.887,.012,.010,1.984,.066,.165,.082,.089,0,0,0],
  block: [.587,-.186,.855,.395,.174,.154,.067,.067,0,0,0],
  hangMid: [.789,-.113,.521,.730,.182,.154,.067,.067,0,0,0],
  snatchTurn: [.865,.014,.014,1.525,.174,.164,.066,.066,0,0,.07],
  snatchDeep: [.478,-.099,.245,1.497,.066,.255,.111,.111,0,0,0],
  snatchShallow: [.733,-.051,.161,1.752,.079,.208,.103,.103,0,0,0],
  snatchStand: [.889,.006,.018,1.936,.067,.170,.078,.078,0,0,0],
  splitRack: [.676,.024,.093,1.237,.137,.176,.453,-.332,0,.077,1],
  backRack: [.886,.008,.014,1.434,-.143,.174,.081,.081,0,0,-.64],
  backDip: [.790,-.018,.146,1.336,-.119,.179,.084,.084,0,0,-.63],
  backDrive: [.918,.024,.011,1.770,-.039,.185,.084,.084,.036,.036,-.18],
  deepRack: [.490,-.123,.282,1.065,.183,.228,.108,.108,0,0,1],
  forwardRack: [.801,.159,.061,1.336,.248,.173,.436,.083,0,.035,1],
  stiffBelow: [.764,-.214,1.060,.431,.274,.148,.065,.065,0,0,0],
};

const olympicSequence = {
  jerk: [[0,'floor'],[.10,'knee'],[.19,'extension'],[.25,'turnover'],[.33,'deepCatch'],
    [.46,'rack'],[.53,'rack'],[.59,'dip'],[.63,'drive'],[.71,'leftSplit'],
    [.75,'leftSplit'],[.81,'leftRecover'],[.86,'overhead'],[.90,'rack'],[.94,'knee'],[1,'floor']],
  wideJerk: [[0,'floor'],[.09,'knee'],[.17,'extension'],[.24,'turnover'],[.33,'wideCatch'],
    [.45,'rack'],[.52,'rack'],[.58,'dip'],[.62,'drive'],[.70,'rightSplit'],
    [.75,'rightSplit'],[.80,'rightRecover'],[.86,'overhead'],[.91,'rack'],[.96,'knee'],[1,'floor']],
  pull: [[0,'floor'],[.19,'knee'],[.35,'extension'],[.46,'highPull'],[.49,'highPull'],
    [.63,'standHang'],[.83,'knee'],[1,'floor']],
  belowKnee: [[0,'belowKnee'],[.15,'knee'],[.31,'extension'],[.39,'turnover'],[.50,'wideCatch'],
    [.67,'rack'],[.73,'rack'],[.84,'standHang'],[1,'belowKnee']],
  hangPower: [[0,'standHang'],[.16,'highHang'],[.30,'extension'],[.37,'turnover'],[.47,'highCatch'],
    [.60,'rack'],[.70,'rack'],[.91,'standHang'],[1,'standHang']],
  muscle: [[0,'floor'],[.16,'knee'],[.29,'extension'],[.42,'highPull'],[.54,'highRack'],
    [.64,'rack'],[.72,'rack'],[.85,'standHang'],[.93,'knee'],[1,'floor']],
  cleanDead: [[0,'floor'],[.22,'knee'],[.46,'standHang'],[.55,'standHang'],[.82,'knee'],[1,'floor']],
  cleanPull: [[0,'floor'],[.17,'knee'],[.36,'extension'],[.48,'highPull'],[.54,'highPull'],[.73,'standHang'],[1,'floor']],
  blockClean: [[0,'block'],[.18,'extension'],[.25,'turnover'],[.38,'wideCatch'],[.61,'rack'],[.70,'rack'],[.86,'standHang'],[1,'block']],
  blockPower: [[0,'block'],[.19,'extension'],[.27,'turnover'],[.39,'highCatch'],[.55,'rack'],[.65,'rack'],[.81,'standHang'],[1,'block']],
  floorClean: [[0,'floor'],[.16,'knee'],[.29,'extension'],[.39,'turnover'],[.48,'deepCatch'],[.66,'rack'],[.74,'rack'],[.89,'standHang'],[1,'floor']],
  hangClean: [[0,'standHang'],[.16,'hangMid'],[.30,'extension'],[.38,'turnover'],[.49,'deepCatch'],[.65,'rack'],[.77,'rack'],[1,'standHang']],
  lowHangClean: [[0,'belowKnee'],[.16,'knee'],[.30,'extension'],[.40,'turnover'],[.51,'deepCatch'],[.68,'rack'],[.82,'standHang'],[1,'belowKnee']],
  hangPull: [[0,'highHang'],[.21,'extension'],[.40,'highPull'],[.50,'highPull'],[.72,'standHang'],[1,'highHang']],
  upperPull: [[0,'standHang'],[.14,'hangMid'],[.30,'extension'],[.44,'highPull'],[.56,'highPull'],[.81,'standHang'],[1,'standHang']],
  hangSnatch: [[0,'standHang'],[.16,'hangMid'],[.27,'extension'],[.38,'snatchTurn'],[.45,'snatchDeep'],
    [.64,'snatchStand'],[.72,'snatchStand'],[.85,'turnover'],[1,'standHang']],
  lowSnatch: [[0,'belowKnee'],[.11,'knee'],[.27,'extension'],[.38,'snatchTurn'],[.48,'snatchDeep'],
    [.64,'snatchStand'],[.73,'snatchStand'],[.88,'standHang'],[1,'belowKnee']],
  heave: [[0,'backRack'],[.16,'backDip'],[.23,'backDrive'],[.37,'snatchDeep'],[.46,'snatchDeep'],
    [.63,'snatchStand'],[.74,'snatchStand'],[.93,'backRack'],[1,'backRack']],
  balance: [[0,'backRack'],[.18,'backDip'],[.24,'backDrive'],[.40,'snatchDeep'],[.53,'snatchDeep'],
    [.71,'snatchStand'],[.78,'snatchStand'],[.96,'backRack'],[1,'backRack']],
  pressUnder: [[0,'backRack'],[.17,'backDip'],[.43,'snatchDeep'],[.58,'snatchDeep'],[.77,'snatchStand'],[1,'backRack']],
  pushBack: [[0,'backRack'],[.18,'backDip'],[.27,'backDrive'],[.46,'snatchStand'],[.59,'snatchStand'],
    [.88,'backRack'],[1,'backRack']],
  jerkDip: [[0,'rack'],[.30,'dip'],[.38,'dip'],[.54,'rack'],[.67,'rack'],[.91,'rack'],[1,'rack']],
  powerJerk: [[0,'rack'],[.15,'dip'],[.26,'drive'],[.39,'snatchShallow'],[.48,'snatchShallow'],
    [.63,'overhead'],[.73,'overhead'],[.96,'rack'],[1,'rack']],
  splitJerk: [[0,'rack'],[.14,'dip'],[.25,'drive'],[.36,'leftSplit'],[.48,'leftSplit'],
    [.58,'leftRecover'],[.66,'overhead'],[.78,'overhead'],[.94,'rack'],[1,'rack']],
  squatJerk: [[0,'rack'],[.15,'dip'],[.23,'drive'],[.38,'snatchDeep'],[.48,'snatchDeep'],
    [.65,'snatchStand'],[.72,'snatchStand'],[.95,'rack'],[1,'rack']],
  muscleSnatch: [[0,'standHang'],[.18,'hangMid'],[.29,'extension'],[.42,'snatchTurn'],[.54,'snatchStand'],
    [.65,'snatchStand'],[.84,'turnover'],[1,'standHang']],
  powerSnatch: [[0,'floor'],[.16,'knee'],[.27,'extension'],[.39,'snatchTurn'],[.48,'snatchShallow'],
    [.60,'snatchStand'],[.70,'snatchStand'],[.88,'standHang'],[1,'floor']],
  blockPowerSnatch: [[0,'block'],[.19,'extension'],[.31,'snatchTurn'],[.43,'snatchShallow'],[.59,'snatchStand'],
    [.66,'snatchStand'],[.85,'standHang'],[1,'block']],
  snatch: [[0,'floor'],[.16,'knee'],[.27,'extension'],[.39,'snatchTurn'],[.49,'snatchDeep'],
    [.61,'snatchStand'],[.71,'snatchStand'],[.87,'standHang'],[1,'floor']],
  blockSnatch: [[0,'block'],[.20,'extension'],[.31,'snatchTurn'],[.46,'snatchDeep'],[.61,'snatchStand'],
    [.72,'snatchStand'],[.85,'standHang'],[1,'block']],
  splitClean: [[0,'floor'],[.14,'knee'],[.27,'extension'],[.36,'turnover'],[.47,'splitRack'],
    [.53,'splitRack'],[.68,'rack'],[.76,'rack'],[.89,'standHang'],[1,'floor']],
  stiffCleanStep: [[0,'standHang'],[.20,'stiffBelow'],[.31,'standHang'],[.39,'extension'],[.45,'turnover'],[.53,'highCatch'],
    [.63,'rack'],[.74,'forwardRack'],[.82,'rack'],[.88,'rack'],[1,'standHang']],
  complex: [[0,'floor'],[.13,'knee'],[.24,'standHang'],[.34,'highHang'],[.43,'extension'],[.47,'turnover'],
    [.55,'highCatch'],[.62,'rack'],[.70,'deepRack'],[.81,'rack'],[.90,'standHang'],[1,'floor']],
  cluster: [[0,'floor'],[.10,'knee'],[.19,'extension'],[.28,'turnover'],[.36,'deepCatch'],[.48,'rack'],
    [.57,'deepRack'],[.68,'overhead'],[.78,'overhead'],[.86,'rack'],[1,'floor']],
  thruster: [[0,'floor'],[.10,'knee'],[.18,'extension'],[.27,'turnover'],[.34,'highCatch'],[.47,'rack'],
    [.57,'deepRack'],[.69,'overhead'],[.76,'overhead'],[.86,'rack'],[1,'floor']],
  smithHang: [[0,'standHang'],[.17,'highHang'],[.31,'extension'],[.40,'turnover'],[.50,'highCatch'],
    [.64,'rack'],[.73,'rack'],[.96,'standHang'],[1,'standHang']],
  axle: [[0,'floor'],[.10,'knee'],[.20,'extension'],[.30,'turnover'],[.38,'highCatch'],[.45,'rack'],
    [.55,'dip'],[.61,'drive'],[.69,'overhead'],[.77,'overhead'],[.84,'rack'],[.94,'standHang'],[1,'floor']],
};

function olympicLift(phase,{type,width,rail=false}) {
  const sequence=olympicSequence[type];
  const end=sequence.findIndex(([time])=>time>=phase&&time>0);
  const [startTime,from]=sequence[end-1];
  const [endTime,to]=sequence[end];
  const [hipY,hipZ,pitch,barY,barZ,stanceX,footL,footR,heelL,heelR,rackElbows]=
    lerp(olympicPose[from],olympicPose[to],smooth((phase-startTime)/(endTime-startTime)));
  const pose=athlete([0,hipY,hipZ],pitch);
  const swingFoot=(offset,previous,next)=>{
    if (Math.abs(previous-next)<.065) return 0;
    const amount=(offset-previous)/(next-previous);
    return .067*Math.sin(Math.PI*amount);
  };
  const airborne=[swingFoot(footL,olympicPose[from][6],olympicPose[to][6]),
    swingFoot(footR,olympicPose[from][7],olympicPose[to][7])];
  for(const [index,[side,sign]] of sides.entries()){
    const ankle=[sign*stanceX,.076+airborne[index]+(index===0?heelL:heelR),index===0?footL:footR];
    foot(pose,side,sign,ankle,airborne[index]>.010?null:0,index===0?heelL:heelR);
  }
  let localBar=[0,barY,rail?.136:barZ];
  const apparent=length(minus(add(localBar,[width,0,0]),pose.ls));
  if(rail&&apparent>.616){
    const [,shoulderY,shoulderZ]=pose.ls;
    const reach=Math.sqrt(Math.max(.005,.616**2-(width-pose.ls[0])**2-(.136-shoulderZ)**2));
    localBar=[0,clamp(barY,shoulderY-reach,shoulderY+reach),.136];
  }else if(apparent>.616) {
    // Set stop points within the exact rig reach during stance transitions.
    const along=unit(minus(localBar,[0,pose.ls[1],pose.ls[2]]));
    const limit=Math.sqrt(.616**2-(width-pose.ls[0])**2);
    localBar=add([0,pose.ls[1],pose.ls[2]],scale(along,limit));
  }
  const highPullStyle=['pull','muscle','cleanPull','hangPull','upperPull','muscleSnatch'].includes(type);
  const pullPole=[.86,highPullStyle?.14:-.51,highPullStyle?-.46:.36];
  const rackPole=[.47,.15,.92];
  loadedBar(pose,localBar,width,sign=>lerp(pullPole,rackPole,rackElbows)
    .map((value,index)=>index===0?sign*value:value),false);
  return pose;
}

addRows([["5122",{type:"jerk",width:.295}],["5190",{type:"wideJerk",width:.328}]],
  olympicLift,["quad","glute","shoulder","triceps"],"barbell",
  {...standing,yaw:42,focus:[0,1.04,.095],height:2.65},6500,.70);
addRows([["5705",{type:"pull",width:.312}]],olympicLift,["glute","quad","trap"],"barbell",
  {...standing,yaw:56,focus:[0,.92,.082],height:2.30},4650,.48);
addRows([["3183",{type:"belowKnee",width:.311}],["5704",{type:"hangPower",width:.284}]],
  olympicLift,["glute","quad","trap"],"barbell",
  {...standing,yaw:55,focus:[0,.94,.09],height:2.32},5300,.48);
addRows([["5075",{type:"muscle",width:.328}]],olympicLift,["glute","quad","trap"],"barbell",
  {...standing,yaw:51,focus:[0,.93,.084],height:2.30},5250,.52);

const olympicLow={...standing,yaw:54,focus:[0,1,.07],height:2.37};
const olympicHigh={...standing,yaw:52,focus:[0,1.06,.07],height:2.60};
const olympicOptions=[
  ['1515','cleanDead',.298], ['1517','cleanPull',.306], ['5287','floorClean',.320],
  ['1520','hangClean',.284], ['1521','lowHangClean',.291], ['10107','hangPull',.296],
  ['10106','upperPull',.272], ['1525','jerkDip',.299], ['1537','splitClean',.313],
  ['3328','stiffCleanStep',.278], ['3316','complex',.300],
];
addRows(olympicOptions.map(([id,type,width])=>[id,{type,width}]),
  olympicLift,["quad","glute","trap"],"barbell",olympicLow,5900,.47);
addRows([['1516',{type:'blockClean',width:.296}],['1528',{type:'blockPower',width:.306}]],
  olympicLift,["quad","glute","trap"],"barbell-olympic-blocks",olympicLow,5650,.38);
const overheadOptions=[
  ['1522','hangSnatch',.443], ['1523','lowSnatch',.468], ['1524','heave',.445],
  ['1526','muscleSnatch',.456], ['1529','powerJerk',.297], ['1530','powerSnatch',.425],
  ['1533','snatch',.456], ['1534','balance',.453], ['1538','splitJerk',.304], ['0786','squatJerk',.349],
  ['5192','cluster',.300], ['5188','thruster',.292], ['4857','pushBack',.407], ['4966','pressUnder',.451],
];
addRows(overheadOptions.map(([id,type,width])=>[id,{type,width}]),
  olympicLift,["quad","glute","shoulder"],"barbell",olympicHigh,6400,.60);
addRows([['1531',{type:'blockPowerSnatch',width:.434}],['1536',{type:'blockSnatch',width:.464}]],
  olympicLift,["quad","glute","shoulder"],"barbell-olympic-blocks",olympicHigh,6000,.60);
addRows([['5142',{type:'smithHang',width:.294,rail:true}]],
  olympicLift,["quad","glute","trap"],"smith-standing",{...olympicLow,yaw:64},5700,.50);

function weightedSplitJump(phase){
  const half=(phase*2)%1;
  const lead=phase<.5||phase===1?1:-1;
  const flight=clamp((half-.225)/.350);
  const jump=Math.sin(Math.PI*flight);
  const switched=smooth(flight);
  const load=rep(clamp(half/.246),.62,.82);
  const absorb=rep(clamp((half-.570)/.253),.26,.39);
  const pose=athlete([0,.738+.205*jump-.075*load-.058*absorb,.025],-.026);
  for(const [side,sign] of sides){
    const gap=lead*sign*mix(.334,-.334,switched);
    const heel=gap<0?.074:0;
    foot(pose,side,sign,[sign*.161,.076+heel+.189*jump,.058+gap],jump>.001?null:0,heel);
  }
  const center=add(scale(add(pose.ls,pose.rs),.5),[0,.036,-.111]);
  loadedBar(pose,center,.336,sign=>[sign*.79,-.78,-.41]);
  return pose;
}

function powerShrug(phase){
  const load=rep(phase,.20,.29);
  const pull=smooth((phase-.28)/.22)*(1-smooth((phase-.64)/.33));
  const pose=athlete([0,.886-.102*load+.039*pull,-.014-.035*load],.147*load);
  stance(pose,.152,.061,0,.038*pull);
  for(const [side] of sides)pose[side+"s"][1]+=.073*pull;
  const shoulder=scale(add(pose.ls,pose.rs),.5);
  loadedBar(pose,add(shoulder,[0,-.590,.092]),.290,sign=>[sign*.16,-.61,-.42]);
  return pose;
}
addRows([['1539']],weightedSplitJump,["quad","glute"],"barbell",{...olympicLow,yaw:61},5800,.28);
addRows([['5662']],powerShrug,["trap","glute"],"barbell",{...standing,yaw:53},4450,.49);

const benchResistance=[
  ['7620','barbell-bench-band',{pause:true}],
  ['9932','barbell-bench-band-heavy',{gripWidth:.387, pause:true}],
  ['3185','barbell-bench-hanging',{gripWidth:.334, pause:true}],
  ['4201','barbell-bench-chains',{gripWidth:.371}],
  ['4414','barbell-bench-hanging-kettle',{gripWidth:.357,pause:true}],
  ['1497','barbell-bench-band-overhead',{gripWidth:.355,pause:true}],
  ['3310','barbell-bench-extra',{gripWidth:.376}],
];
addRows(benchResistance.map(([id,equipment,setup])=>[id,{equipment,...setup}]),benchPress,["pec","triceps"],
  ({equipment})=>equipment,{...benchCamera({}),yaw:69,height:1.99},4850);
addRows([['4070',{boardCount:1}],['4069',{boardCount:2}],['4068',{boardCount:3}]],
  benchPress,["pec","triceps"],({boardCount})=>'barbell-bench-board-'+boardCount,
  {...benchCamera({}),yaw:66,height:1.90},4800,.48);
addRows([['10560',{pause:true,straightPinPath:true}]],benchPress,["pec","triceps"],"barbell-bench-pins",
  {...benchCamera({}),yaw:63,height:2.39},4850);

const lowerResistance=[
  ['4061','barbell-bands-rear-bench',{benchContact:true,depth:.339}],
  ['3530','barbell-rack-bands',{depth:.428}],
  ['1509','barbell-chains-rear-bench',{benchContact:true,depth:.347}],
  ['3871','barbell-bands-front',{rack:'front',railRack:true,depth:.411}],
  ['3184','barbell-hanging-squat',{depth:.386,pause:true}],
  ['4064','barbell-chains-squat',{depth:.435}],
  ['3856','smith-banded-squat',{smith:true,depth:.394,feet:.172}],
  ['4179','smith-banded-squat',{smith:true,depth:.461,feet:.183}],
];
addRows(lowerResistance.map(([id,equipment,setup])=>[id,{equipment,...setup}]),squatWithBar,["quad","glute"],
  ({equipment})=>equipment,{...standing,yaw:61,height:2.48},4850);
addRows([['4841',{equipment:'barbell-dead-band-overhead'}],['4199',{equipment:'barbell-dead-chains'}],
  ['4203',{equipment:'barbell-dead-band',wide:true}],['5912',{equipment:'barbell-dead-chains-heavy',wide:true}],
  ['5910',{equipment:'barbell-dead-chains',wide:true}]],catalogueDeadlift,["glute","hamstring","quad"],
  ({equipment})=>equipment,{...standing,yaw:52,height:2.45},5300);
addRows([['4173']],stiffLegDeadlift,["hamstring","glute"],"barbell-dead-underfoot",{...standing,yaw:56},4800);
addRows([['3186',{width:.283}]],standingPress,["shoulder","triceps"],"barbell-hanging-overhead",
  {...standing,yaw:56,focus:[0,1.11,0],height:2.67},4750);

function benchHipThrust(phase,{single=false,stagger=false,kAS=false,frog=false,smith=false}={}){
  const amount=rep(phase,.44,.58);
  const angle=mix(kAS?-1.369:-1.027,-1.538,amount);
  const shoulder=[0,.542,-.423];
  const hips=minus(shoulder,[0,.505*Math.cos(angle),.505*Math.sin(angle)]);
  const pose=athlete(hips,angle);
  for(const [side,sign] of sides){
    const dangling=single&&sign<0;
    const ankle=dangling?[sign*.174,mix(.267,.469,amount),.608]:
      [sign*(frog?.274:.174),.076,stagger&&sign<0?.739:.567];
    foot(pose,side,sign,ankle,dangling?null:0,0,[sign*(frog?.61:.21),.83,.26]);
    if(frog)pose[side+'t'][0]+=sign*.042;
  }
  const center=[0,hips[1]+.100,smith?.041:hips[2]+.061];
  loadedBar(pose,center,.248,sign=>[sign*.80,-.10,.19]);
  return pose;
}
const hipResistance=[
  ['3873','barbell-hip-band',{}],['4448','barbell-hip-knee-band',{}],
  ['1061','barbell-hip-thrust',{single:true}],['5476','barbell-hip-thrust',{stagger:true}],
  ['5451','barbell-hip-thrust',{kAS:true}],['6465','smith-hip-thrust',{smith:true,frog:true}],
  ['3110','smith-hip-thrust',{smith:true}],['11053','smith-hip-thrust',{smith:true,stagger:true}],
  ['0885','smith-hip-thrust',{smith:true}],
];
addRows(hipResistance.map(([id,equipment,setup])=>[id,{equipment,...setup}]),benchHipThrust,["glute","hamstring"],
  ({equipment})=>equipment,({smith})=>({yaw:62,elevation:17,focus:[0,.62,.093],height:smith?2.46:1.69}),4650);

function railKick(phase,{donkey=false,spotter=false}={}){
  const amount=rep(phase,.42,.57);
  const hips=[0,donkey?.538:.518,donkey?.426:.391];
  const pose=athlete(hips,1.482);
  pose.rk=[-.144,.106,.410];
  pose.ra=[-.160,.089,.003];
  pose.rt=[-.170,.029,-.117];
  const kneeY=mix(.266,donkey?.492:.523,amount);
  const kneeZ=hips[2]-Math.sqrt(.421**2-(kneeY-hips[1])**2);
  pose.lk=[.136,kneeY,kneeZ];
  const ankle=[.150,kneeY+Math.sqrt(.421**2-(.041-kneeZ)**2),.041];
  pose.la=ankle;
  pose.lt=add(ankle,[.015,.033,-.138]);
  for(const [side,sign] of sides)arm(pose,side,[sign*.214,.105,.992],[sign*.53,-.37,-.45]);
  pose.barbell={center:[0,ankle[1]+.068,.041],axis};
  if(spotter){
    const support=athlete([.794,.833,.244],.718,-Math.PI/2);
    for(const [side,sign] of sides){
      foot(support,side,sign,[.826+sign*.149,.076,.281+sign*.093],0,0,[.11,.13,-sign]);
    }
    arm(support,'l',[.383,ankle[1]+.041,.069],[-.21,-.68,.63]);
    arm(support,'r',[.555,ankle[1]+.062,.056],[-.35,-.61,-.53],axis);
    pose.partner=support;
  }
  return pose;
}

function railReverseHyper(phase){
  const rise=rep(phase,.43,.59);
  const hip=[0,.648,mix(.812,.865,rise)];
  const pose=athlete(hip,1.537);
  for(const [side,sign] of sides){
    const ankle=[sign*.144,mix(.461,.662,rise),.041];
    foot(pose,side,sign,ankle,null,0,[sign*.18,-.33,-.79]);
    pose[side+'t']=add(pose[side+'a'],[sign*.014,-.116,.089]);
    arm(pose,side,[sign*.234,.590,1.263],[sign*.69,-.76,-.22],axis);
  }
  pose.barbell={center:[0,mix(.436,.637,rise),.041],axis};
  return pose;
}

function railKneelThrust(phase){
  const amount=rep(phase,.43,.58);
  const hip=[0,mix(.338,.512,amount),mix(-.064,.025,amount)];
  const pose=athlete(hip,mix(.390,.027,amount));
  for(const [side,sign] of sides){
    pose[side+'k']=[sign*.153,.095,.323];
    pose[side+'a']=[sign*.155,.062,-.095];
    pose[side+'t']=[sign*.171,.029,-.234];
  }
  loadedBar(pose,[0,hip[1]+.118,.041],.244,sign=>[sign*.71,-.65,.12]);
  return pose;
}

function railCalfSeated(phase){
  const rise=rep(phase,.43,.58);
  const hip=[0,.556,-.242];
  const pose=athlete(hip,.047);
  for(const [side,sign] of sides){
    const toe=[sign*.168,.169,.496];
    const ankle=[sign*.155,.111+.119*rise,.369-.019*rise];
    foot(pose,side,sign,ankle,null,0,[sign*.12,.12,1]);
    pose[side+'t']=toe;
  }
  const knee=scale(add(pose.lk,pose.rk),.5);
  const center=[0,knee[1]+.103,.041];
  loadedBar(pose,center,.231,sign=>[sign*.66,-.78,.05]);
  return pose;
}

function railStepUp(phase,{lateral=false,smith=true,front=false,kneeUp=false}={}){
  const raise=rep(phase,.44,.58);
  const place=smooth(phase/.22)*smooth((1-phase)/.25);
  const rise=smooth((phase-.18)/.35)*smooth((.91-phase)/.27);
  const hip=[lateral?.293*rise:0,.883+.424*rise,.094+(lateral?.034:.317)*rise];
  const pose=athlete(hip,.069);
  const stepHeight=.432;
  for(const [side,sign] of sides){
    const lead=sign>0;
    const elevation=(lead?place:Math.min(1,raise*1.25))*stepHeight;
    const depth=.069+(lateral?.067:.421)*(lead?place:rise);
    const across=sign*.150+(lateral?.257*(lead?place:rise):0);
    const free=kneeUp&&!lead;
    const kneeDrive=free?.271*rise:0;
    foot(pose,side,sign,[across,.076+elevation+kneeDrive,depth+(free?.173*rise:0)],
      free&&rise>.03?null:Math.abs(elevation-stepHeight)<.007?stepHeight:elevation<.006?0:null,
      0,[sign*.20,.15,.935]);
  }
  const center=[smith?0:hip[0],pose.ls[1]+.043,smith?.041:pose.ls[2]+(front?.108:-.089)];
  for(const [side,sign] of sides) {
    const target=[hip[0]+sign*(front?.252:.361),center[1],center[2]];
    if(front){
      [pose[side+'e'],pose[side+'w']]=joints(pose[side+'s'],target,[.1,-.12,1],.252,.213);
      pose[side+'Grip']=axis;
    }else arm(pose,side,target,[sign*.72,-.62,-.29],axis);
  }
  pose.barbell={center,axis};
  return pose;
}

function railHinge(phase,{single=false}={}){
  const amount=rep(phase,.44,.58);
  const barCenter=[0,mix(.818,.472,amount),.136];
  const pose=hingedAthlete(mix(.884,.784,amount),mix(.004,-.201,amount),
    mix(.014,single?1.268:1.176,amount),barCenter,.234);
  for(const [side,sign] of sides){
    const free=single&&sign<0;
    const ankle=free?[-.174,mix(.187,.541,amount),mix(-.079,-.886,amount)]
      :[sign*.151,.076,sign>0?.109:single?.082:-.177];
    foot(pose,side,sign,ankle,free?null:0,0,[sign*.18,.21,.91]);
  }
  loadedBar(pose,barCenter,.234,sign=>[sign*.39,-.56,-.69]);
  return pose;
}

function railOnePress(phase){
  const amount=rep(phase,.43,.59);
  const pose=athlete([0,.570,.108],.016,Math.PI/2);
  for(const [side,sign] of sides)
    foot(pose,side,sign,[.435,.076,.108-sign*.163],0,0,[.94,.08,sign*.17]);
  const barY=mix(1.196,1.626,amount);
  arm(pose,'l',[.102,barY,.041],[.73,-.62,-.14],axis);
  arm(pose,'r',[.219,.661,.282],[.47,-.81,.21]);
  pose.barbell={center:[0,barY,.041],axis};
  return pose;
}

function railRow(phase,{bench=false}={}){
  const amount=rep(phase,.43,.58);
  const pose=bench?chestSupportedBarbellAthlete():athlete([0,.766,-.218],1.103);
  if(!bench)stance(pose,.159,.098);
  const y=mix(.531,.897,amount);
  const z=bench?-.254:.136;
  if(bench)loadedBar(pose,[0,y,z],.277,sign=>[-sign*.61,.34,.73],false,[-1,0,0]);
  else{
    arm(pose,'l',[.257,y,z],[.62,.33,-.72],axis);
    arm(pose,'r',add(pose.rk,[-.052,.192,.007]),[-.67,-.49,.31]);
    pose.barbell={center:[0,y,z],axis};
  }
  return pose;
}

addRows([['6038',{donkey:true}],['1183'],['2952',{spotter:true}]],railKick,["l:glute","l:hamstring"],"smith-standing",
  ({spotter})=>({yaw:spotter?53:66,elevation:15,focus:[spotter?.15:0,.98,.38],height:2.50}),4800);
addRows([['2745']],railReverseHyper,["glute","hamstring"],"smith-prone-hyper",{yaw:67,elevation:15,focus:[0,.93,.64],height:2.65},4750);
addRows([['3874']],railKneelThrust,["glute","hamstring"],"smith-standing",{...standing,yaw:68,height:2.53},4650);
addRows([['4370']],railCalfSeated,["calf"],"smith-calf-seat",{yaw:64,elevation:17,focus:[0,.89,.12],height:2.49},4750);
addRows([['0884',{lateral:true}],['11879']],railStepUp,["l:quad","l:glute"],
  ({lateral})=>lateral?"smith-raised-lateral":"smith-raised-front",{...standing,yaw:59,focus:[.065,1.14,.26],height:2.65},5100);
addRows([['0886',{single:true}],['8800']],railHinge,["glute","hamstring"],"smith-standing",{...standing,yaw:63,height:2.50},4850);
addRows([['10863']],railOnePress,["l:shoulder","l:triceps"],"smith-side-press",{...standing,yaw:59,height:2.49},4600);
addRows([['3945']],railRow,["l:lat","l:biceps"],"smith-standing",{...standing,yaw:61,height:2.48},4500);
addRows([['11762',{bench:true}]],railRow,["lat","biceps"],"smith-chest-row",{...standing,yaw:116,height:2.52,focus:[0,.96,-.04]},4700);
addRows([['2919',{gripWidth:.105,smith:true}]],benchPress,["pec","triceps"],"smith-flat",{...benchCamera({smith:true}),yaw:65},4600);
addRows([['6606',{direction:'curtsy',smith:true}]],lunge,["quad","glute"],"smith-standing",{...lungeView,yaw:55,height:2.50},4900);
addRows([['6796',{smith:true,box:true,width:.285,turnout:true,depth:.433}]],
  squatWithBar,["quad","glute"],"smith-wide-chair",{...standing,yaw:61,height:2.51},4700);

function stabilityBenchPress(phase){
  const t=rep(phase,.44,.59);
  const hip=[0,.617,.217];
  const pose=athlete(hip,-1.482);
  pose.ballCenter=[0,.285,-.256];
  for(const [side,sign] of sides)
    foot(pose,side,sign,[sign*.263,.076,.721],0,0,[sign*.19,.93,.14]);
  const shoulder=scale(add(pose.ls,pose.rs),.5);
  loadedBar(pose,add(shoulder,[0,mix(.567,.126,t),mix(.049,.168,t)]),.337,sign=>[sign*.70,-.60,.17]);
  return pose;
}

function proneBarbellAccessory(phase,{type}){
  const t=rep(phase,.44,.59);
  const flat=type==='prone-curl';
  const wrist=type==='wrist';
  const pose=flat?athlete([.10,.545,1.210],1.498,Math.PI):chestSupportedBarbellAthlete(true);
  if(flat)for(const [side,sign] of sides)
    foot(pose,side,-sign,[.10-sign*.227,.076,1.796],0,0,[-sign*.18,.62,-.75]);
  const shoulder=scale(add(pose.ls,pose.rs),.5);
  if(wrist||flat) {
    const centerX=flat?.10:0;
    const lowerY=shoulder[1]-(flat?.176:.272);
    const lowerZ=shoulder[2]-(flat?.112:.072);
    const loop=mix(1.003,2.655,t);
    const c=[centerX,flat?lowerY-.351*Math.cos(loop):lowerY-.278+.043*t,
      flat?lowerZ-.351*Math.sin(loop):lowerZ-.225-.028*t];
    for(const [side,sign] of sides){
      pose[side+'e']=[centerX-sign*.204,lowerY,lowerZ];
      pose[side+'w']=add(c,[-sign*.194,0,0]);
      pose[side+'Grip']=[-1,0,0];
      if(wrist)pose[side+'Fingers']=[0,mix(-.44,.53,t),-.88];
    }
    pose.barbell={center:c,axis};
  }else {
    const center=add(shoulder,[0,mix(-.546,-.262,t),mix(-.070,.451,t)]);
    loadedBar(pose,center,.273,sign=>[-sign*.94,-.41,.09],false,[-1,0,0]);
  }
  return pose;
}

function wristCurlOnBench(phase,{reverse=false,variation=0}={}){
  const amount=rep(phase,variation?.35:.41,.62);
  const pose=athlete([0,.554,-.243],.619);
  stance(pose,.177,.449);
  const elbow=[0,.722,.131];
  const center=[0,.675+.053*amount,.471+.021*amount];
  for(const [side,sign] of sides){
    pose[side+'e']=add(elbow,[sign*.194,0,0]);
    pose[side+'w']=add(center,[sign*.198,0,0]);
    pose[side+'Grip']=reverse?[-1,0,0]:axis;
    pose[side+'Fingers']=[0,mix(reverse?.42:-.43,reverse?-.65:.57,amount),.906];
    pose[side+'PalmSide']=[sign,0,0];
  }
  pose.barbell={center,axis};
  return pose;
}

function bradford(phase,{seated=false}={}){
  const travel=rep(phase,.45,.57);
  const over=Math.sin(Math.PI*travel);
  const pose=athlete([0,seated?.558:.891,0],-.022);
  stance(pose,.166,seated?.471:.072);
  const side=seated?-1:1;
  const height=pose.ls[1]+.075+.351*over;
  const depth=side*mix(.147,-.139,travel);
  const center=[0,height,depth];
  if(over>.4)pose.head[2]+=side*.029*over;
  loadedBar(pose,center,.368,sign=>[sign*.74,-.81,side*.59*(1-2*travel)]);
  return pose;
}

const flatUpper={...benchCamera({}),yaw:67,height:1.93};
const chestUpper={...standing,yaw:123,focus:[0,.89,-.035],height:2.12};
addRows([['9930',{width:.226}]],californiaEZExtension,["triceps","pec"],"bench-barbell",flatUpper,4700);
addRows([['3729']],stabilityBenchPress,["pec","triceps"],"barbell-stability-ball",{yaw:73,elevation:17,focus:[0,.72,.02],height:1.97},4700);
addRows([['10588',{type:'front-pullover',arcFinish:.035,arcReach:.565}]],supineArc,["shoulder","pec"],"bench-barbell",flatUpper,4500);
addRows([['3722',{type:'rear'}]],proneBarbellAccessory,["rearShoulder"],"barbell-chest-bench",chestUpper,4500);
addRows([['3987',{type:'wrist'}]],proneBarbellAccessory,["forearm"],"barbell-chest-bench",{...chestUpper,yaw:113},4450);
addRows([['0059',{type:'prone-curl'}]],proneBarbellAccessory,["biceps"],"barbell-prone-flat",
  {yaw:114,elevation:16,focus:[.1,.61,1.00],height:1.74},4500);
addRows([['0050']],inclineShoulderRaise,["pec","shoulder"],"barbell-incline-free",{...benchCamera({kind:'incline'}),yaw:47},4400);
addRows([['1411',{reverse:true}],['1412'],['0125',{variation:1}]],wristCurlOnBench,["forearm"],"barbell-wrist-bench",
  {yaw:53,elevation:15,focus:[0,.75,.12],height:1.74},4450);
addRows([['0079',{seated:true,reverse:true}],['2683',{seated:true,reverse:true}],['0126',{seated:true}]],
  ezWristCurl,["forearm"],"barbell-seat",{...supportCam,yaw:55},4450);
addRows([['6262'],['6263',{reverse:true}]],ezWristCurl,["forearm"],"barbell",{...standing,yaw:49},4450);
addRows([['10110',{reverse:true,width:.248}]],curl,["forearm","biceps"],"barbell-fat-grip",{...standing,yaw:55},4400);
addRows([['0087',{seated:true}],['0105']],bradford,["shoulder","triceps"],
  ({seated})=>seated?"barbell-upright-seat":"barbell",({...standing,yaw:53,height:2.31}),5000);
addRows([['1045',{seated:true,width:.284}]],standingPress,["shoulder","triceps"],"barbell-seated-rack",
  {...standing,yaw:64,height:2.51},4700);
addRows([['5668',{width:.295}]],standingPress,["shoulder","triceps"],"barbell-shoulder-pins",
  {...standing,yaw:63,height:2.55},4800);
addRows([['4803',{kind:'behind',type:'behind',grip:'close'}],['4804',{type:'extension',grip:'close',hold:true}]],
  (phase,config)=>supineArc(phase,{...config,kind:'flat'}),["triceps"],"bench-barbell",flatUpper,4500);
addRows([['5241',{type:'behind',grip:'close'}]],supineArc,["triceps"],"bench-barbell",{...flatUpper,yaw:59},4650);

function rearDeadlift(phase){
  const rise=rep(phase,.45,.60);
  const hips=[0,mix(.330,.882,rise),mix(-.105,.033,rise)];
  const pitch=mix(.222,.008,rise);
  const pose=athlete(hips,pitch);
  stance(pose,.153,.094);
  const c=[0,mix(.197,.797,rise),mix(-.231,-.129,rise)];
  loadedBar(pose,c,.272,sign=>[sign*.71,-.52,-.47],true);
  return pose;
}

function reeves(phase){
  const rise=rep(phase,.45,.57);
  const pose=athlete([0,mix(.422,.875,rise),mix(-.215,.007,rise)],mix(1.14,.027,rise));
  stance(pose,.229,.067);
  const barY=mix(.197,.937,rise);
  const z=mix(.197,.102,rise);
  for(const [side,sign] of sides){
    arm(pose,side,[sign*.684,barY+.145,z],[sign*.36,-.52,-.37],axis);
    pose[side+'Fingers']=[sign*.03,-.61,.792];
  }
  pose.barbell={center:[0,barY,z],axis};
  return pose;
}

function jeffersonRoll(phase) {
  const amount=rep(phase,.44,.59);
  const hip=[0,.944-.084*amount,-.037-.192*amount];
  const lower=.028+.883*amount;
  const upper=.028+1.836*amount;
  const final=.044+2.327*amount;
  const pose=athlete(hip,lower);
  const along=(angle)=>[0,Math.cos(angle),Math.sin(angle)];
  pose.chest=add(hip,scale(along(lower),.340));
  pose.neck=add(pose.chest,scale(along(upper),.265));
  pose.head=add(pose.neck,scale(along(final),.123));
  for(const [side,sign] of sides){
    pose[side+'s']=add(add(pose.chest,scale(along(upper),.151)),[sign*.191,0,0]);
    foot(pose,side,sign,[sign*.148,.196,.039],.120);
  }
  const shoulder=scale(add(pose.ls,pose.rs),.5);
  const center=[0,Math.max(.205,shoulder[1]-.598),shoulder[2]+.044];
  loadedBar(pose,center,.231,sign=>[sign*.36,-.56,-.79]);
  return pose;
}

function declineRearLunge(phase) {
  const pose=fixedSupportSplit(phase,{rearBench:true});
  const hip=pose.hips;
  const ankle=[-.153,.466,-.546];
  foot(pose,'r',-1,ankle,null,0,[-.16,-.15,.93]);
  pose.rt=add(pose.ra,[-.020,-.043,-.143]);
  pose.planted.r=.401;
  const amount=rep(phase,.43,.59);
  const center=[0,pose.ls[1]+.034,hip[2]+.505*Math.sin(.044+.182*amount)-.083];
  loadedBar(pose,center,.354,sign=>[sign*.58,-.67,-.53]);
  return pose;
}

const pressLegs=["quad","glute"];
const pulls=["hamstring","glute","quad"];
addRows([['11093',{twoStage:true}],['7237',{hook:true}],['2729']],catalogueDeadlift,pulls,"barbell",
  {...standing,yaw:57},4900);
addRows([['6034',{blocks:.198}],['4107',{blocks:.198,wide:true}]],catalogueDeadlift,pulls,"barbell-olympic-blocks",
  {...standing,yaw:60},4950);
addRows([['5702',{deficit:.120}],['4864',{deficit:.120,wide:true}]],catalogueDeadlift,pulls,"barbell-deficit",
  {...standing,yaw:59},4950);
addRows([['1532',{deficit:.120}],['1542',{deficit:.432}]],stiffLegDeadlift,["hamstring","glute"],
  ({deficit})=>deficit>.4?"barbell-deficit-bench":"barbell-deficit",{...standing,yaw:58,height:2.53},4800);
addRows([['5663']],rearDeadlift,pulls,"barbell",{...standing,yaw:122,focus:[0,.93,-.03],height:2.16},4800);
addRows([['4116']],reeves,pulls,"barbell",{...standing,yaw:55,height:2.40},4900);
addRows([['10857']],jeffersonRoll,["hamstring","core"],"barbell-deficit",{...standing,yaw:73,height:2.53},5450);
addRows([['5706',{style:'jefferson'}]],hinge,pulls,"barbell",{...standing,yaw:44},4900);
addRows([['10092',{pause:true,depth:.377}],['3309',{rack:'front',railRack:true,depth:.415}]],
  squatWithBar,pressLegs,"barbell-extra",{...standing,yaw:62,height:2.27},4900);
addRows([['3311',{rack:'front',railRack:true,depth:.405}]],squatWithBar,pressLegs,"barbell-squat-rack",
  {...standing,yaw:58,height:2.52},4800);
addRows([['9516',{heel:.058,backGripWidth:.242,depth:.401}],['4178',{heel:.058,depth:.413}]],
  squatWithBar,pressLegs,"barbell-heel-plates",{...standing,yaw:58,height:2.30},4800);
addRows([['3723',{direction:'curtsy'}],['3725',{overhead:true}],['4409',{frontRack:true,walking:true,alternate:true}]],
  lunge,pressLegs,"barbell",{...lungeView,yaw:62,height:2.51},5500);
addRows([['1518']],declineRearLunge,pressLegs,"barbell-decline-rear",
  {...lungeView,yaw:64,height:2.24},4800);
addRows([['6797',{smith:false,lateral:true}],['3728',{smith:false,front:true}],['4401',{smith:false,kneeUp:true}]],
  railStepUp,pressLegs,({lateral})=>lateral?"barbell-raised-lateral":"barbell-raised-front",
  {...standing,yaw:55,height:2.40,focus:[.06,1.13,.25]},5100);
addRows([['9410',{step:true,platformDepth:.253,kneeBend:true}]],
  calfRaise,["calf"],"barbell-low-step",{...standing,yaw:61},4700);

function moveFloorFeet(pose,deltaY,deltaZ) {
  pose.hips=add(pose.hips,[0,deltaY,deltaZ]);
  for(const [side,sign] of sides){
    const ankle=pose[side+'a'];
    pose[side+'h']=add(pose[side+'h'],[0,deltaY,deltaZ]);
    foot(pose,side,sign,ankle,0,0,[sign*.16,.17,.99]);
  }
}

function barbellForm(phase,{type}) {
  const load=rep(phase,.44,.60);
  const middle=rep(phase,.23,.38)+rep(phase,.66,.82);
  const chest=type.startsWith('bench-');
  const squat=type.startsWith('squat-');
  const dead=type.startsWith('dead-');
  const preacher=type==='preacher';
  const make=()=>chest?benchPress(phase,{gripWidth:.348,pause:true})
    :squat?squatWithBar(phase,{depth:.414,width:.188})
      :dead?catalogueDeadlift(phase):preacher?curl(phase,{mode:'preacher',width:.173}):catalogueRow(phase,{width:.292});
  const pose=make();
  const comparison=make();
  if(type==='bench-butt'){
    moveFloorFeet(comparison,.159*load,.038*load);
    comparison.chest=add(comparison.chest,[0,.059*load,.035*load]);
  }else if(type==='bench-shoulders'){
    for(const [side,sign] of sides)
      comparison[side+'s']=add(comparison[side+'s'],[sign*.035*load,.074*load,.061*load]);
    comparison.chest=add(comparison.chest,[0,-.039*load,.035*load]);
  }else if(type==='bench-forearms'||type==='bench-grip'||type==='bench-arms'||type==='bench-elbows'){
    const c=type==='bench-arms'?add(comparison.barbell.center,[0,0,-.204*load]):comparison.barbell.center;
    const width=type==='bench-grip'?.504:type==='bench-forearms'?.221:.348;
    loadedBar(comparison,c,width,sign=>[sign*(type==='bench-elbows'?1:.69),
      type==='bench-elbows'?.095:-.49,type==='bench-elbows'?.052:.28]);
  }else if(type==='squat-hips'){
    const rush=smooth((phase-.51)/.12)*(1-smooth((phase-.69)/.19));
    moveFloorFeet(comparison,.174*rush,-.105*rush);
    comparison.chest=add(comparison.chest,[0,.026*rush,-.083*rush]);
  }else if(type==='squat-knees-end'||type==='squat-knees-middle'){
    const cave=type==='squat-knees-end'?load:Math.min(1,middle)*.93;
    for(const [side,sign] of sides)
      foot(comparison,side,sign,comparison[side+'a'],0,0,[sign*mix(.13,-.88,cave),.075,.93]);
  }else if(type==='squat-back'||type==='dead-back'||type==='row-back'){
    const round=dead?1-load:load;
    comparison.chest=add(comparison.chest,[0,-.072*round,.089*round]);
    comparison.neck=add(comparison.neck,[0,-.111*round,.135*round]);
    comparison.head=add(comparison.head,[0,-.125*round,.162*round]);
    for(const [side,sign] of sides){
      comparison[side+'s']=add(comparison[side+'s'],[sign*.014,-.061*round,.101*round]);
      const target=comparison[side+'w'];
      arm(comparison,side,target,[sign*.61,-.64,-.51],axis);
    }
  }else if(type==='dead-hips'){
    const high=.162*(1-load)+.061*rep(phase,.26,.38);
    moveFloorFeet(comparison,high,-.109*(1-load));
  }else if(preacher){
    for(const [side,sign] of sides){
      pose[side+'Fingers']=[0,.311,.951];
      comparison[side+'Fingers']=[0,mix(-.91,-.31,load),.39];
      comparison[side+'PalmSide']=[sign,0,0];
    }
  }
  pose.partner=comparison;
  return pose;
}

const compareJobs=[
  ['2336','bench-forearms'], ['2341','bench-arms'], ['2338','bench-butt'],
  ['2342','bench-elbows'], ['2339','bench-grip'], ['2340','bench-shoulders'],
  ['2361','squat-hips'], ['2359','squat-knees-end'], ['2362','squat-back'], ['2360','squat-knees-middle'],
  ['2354','dead-back'], ['2357','dead-hips'], ['2343','row-back'], ['2348','preacher'],
];
addRows(compareJobs.map(([id,type])=>[id,{type,comparison:true}]),barbellForm,["core"],
  ({type})=>type.startsWith('bench-')?"barbell-form-bench":type==='preacher'?"ez-form-preacher":"barbell-form-standing",
  ({type})=>({yaw:type.startsWith('bench-')?31:type==='preacher'?33:32,elevation:14,
    focus:[type.startsWith('bench-')?.10:0,type.startsWith('bench-')?.68:.97,type.startsWith('bench-')?.92:.015],
    height:3.27}),5000,.48);

function ezRaiseTwist(phase,{across=false}) {
  const part=(phase*2)%1;
  const sign=phase<.5?1:-1;
  const turn=rep(part,.40,.57);
  const rise=across?1-turn:rep(phase,.45,.57);
  const yaw=sign*(across?.78*turn:.24*rise);
  const pose=athlete([0,.895,.007],.013,yaw);
  pose.lh=[.105,.895,.007];
  pose.rh=[-.105,.895,.007];
  stance(pose,across?.203:.151,.057);
  const directional=[Math.sin(yaw),0,Math.cos(yaw)];
  const shoulder=scale(add(pose.ls,pose.rs),.50);
  const angle=across?mix(1.40,2.91,rise):mix(.18,1.57,rise);
  const center=add(shoulder,add(scale(directional,.558*Math.sin(angle)),[0,-.572*Math.cos(angle),0]));
  const crosswise=unit([Math.cos(yaw),across?.174*sign*turn:.228*rise,-Math.sin(yaw)]);
  loadedBar(pose,center,.179,sign=>[sign*.77,-.48,.18],false,crosswise);
  return pose;
}

function ezRollout(phase) {
  const reach=rep(phase,.44,.59);
  const pose=athlete([0,mix(.499,.243,reach),mix(-.173,.155,reach)],mix(1.32,1.51,reach));
  for(const [side,sign] of sides){
    pose[side+"k"]=[sign*.127,.116,-.232];
    pose[side+"a"]=[sign*.146,.081,-.651];
    pose[side+"t"]=[sign*.156,.011,-.755];
  }
  const position=[0,.089,mix(.562,1.234,reach)];
  loadedBar(pose,position,.173,sign=>[sign*.33,-.60,-.89]);
  return pose;
}

function ezWeightedCore(phase,{kind}) {
  const reverse=kind==='reverse';
  const twisting=kind==='twist';
  const press=kind==='press';
  const side=kind==='side';
  const alternate=(twisting||side)?(2*phase)%1:phase;
  const which=phase<.5?1:-1;
  const amount=rep(alternate,press?.38:.42,press?.67:.58);
  const turn=(twisting||side)?which*rep(alternate,.45,.60):0;
  const setup=benchSetups.floor;
  const hips=reverse?[0,.138+.112*amount,.19-.128*amount]:setup.hips;
  const pitch=-Math.PI/2+(reverse?0:press?1.53:twisting?1.38:.908)*amount;
  const yaw=twisting?.51*turn:side?.19*turn:0;
  const pose=athlete(hips,pitch,yaw);
  if(reverse){
    const base=benchBody('floor');
    for(const jointName of ['chest','neck','head','ls','rs'])pose[jointName]=base[jointName];
    pose.chest=add(pose.chest,[0,.023*amount,.020*amount]);
  }
  for(const [index,[limb,sign]] of sides.entries()){
    if(side){
      const ankle=[sign*.138+.251*turn,mix(.239,.436,amount),mix(.630,.354,amount)];
      foot(pose,limb,sign,ankle,null,0,[.52*turn+sign*.092,.84,.29]);
    }else if(reverse){
      const knee=[sign*.151,mix(.411,.594,amount),mix(.399,hips[2]+.089,amount)];
      const ankle=add(knee,[sign*.022,-.086-.074*amount,mix(.409,.383,amount)]);
      pose[limb+'k']=knee;
      pose[limb+'a']=ankle;
      pose[limb+'t']=add(ankle,[sign*.012,.103,.089]);
    }else foot(pose,limb,sign,setup.ankles[index],0,0,[sign*.54,1,.22]);
  }
  const raised=press?rep(phase,.53,.58)*smooth((phase-.34)/.16):0;
  const shoulder=scale(add(pose.ls,pose.rs),.50);
  const center=reverse?[0,.357,-.638]:add(shoulder,
    [twisting?.12*turn:0,press?mix(.156,.545,raised):.465-.229*amount,
      press?mix(.181,.074,raised):.095+.122*amount]);
  const alignment=unit(minus(pose.ls,pose.rs));
  loadedBar(pose,center,press?.170:.173,sign=>[sign*.65,-.46,.62],false,alignment);
  return pose;
}

function ezAntiGravity(phase) {
  const pose=chestSupportedBarbellAthlete(true);
  const amount=rep(phase,.43,.57);
  const shoulder=scale(add(pose.ls,pose.rs),.50);
  const center=add(shoulder,[0,mix(-.167,.334,amount),mix(-.175,-.440,amount)]);
  loadedBar(pose,center,.173,sign=>[-sign*.71,-.53,.09],true,[-1,0,0]);
  return pose;
}

function ezDeadliftCurl(phase) {
  if(phase>.51)return curl((phase-.51)/.49,{width:.174});
  const t=rep(phase/.51,.43,.51);
  const pose=athlete([0,mix(.899,.745,t),mix(.008,-.184,t)],mix(.018,1.06,t));
  stance(pose,.157,.056);
  const shoulder=scale(add(pose.ls,pose.rs),.50);
  const target=minus([0,mix(.789,.411,t),mix(.060,.274,t)],shoulder);
  const center=add(shoulder,scale(target,Math.min(1,.614/length(target))));
  loadedBar(pose,center,.174,sign=>[sign*.49,-.31,-.66]);
  return pose;
}

function ezStandingPreacher(phase) {
  const pose=athlete([0,.799,-.163],1.049);
  stance(pose,.171,-.211);
  const angle=mix(.141,2.412,rep(phase));
  const elbow=[0,.830,.411];
  const center=add(elbow,[0,-.371*Math.cos(angle),.371*Math.sin(angle)]);
  for(const [limb,sign] of sides){
    pose[limb+'e']=add(elbow,[sign*.191,0,0]);
    pose[limb+'w']=add(center,[sign*.173,0,0]);
    pose[limb+'Grip']=[-1,0,0];
  }
  pose.barbell={center,axis};
  return pose;
}

function olympicHammer(phase) {
  const pose=curl(phase,{width:.182,strict:true});
  pose.lGrip=[0,0,1];
  pose.rGrip=[0,0,1];
  pose.lPalmSide=[-1,0,0];
  pose.rPalmSide=[1,0,0];
  return pose;
}

function ezSingleWrist(phase) {
  const amount=rep(phase,.36,.60);
  const pose=athlete([0,.895,.013],.018);
  stance(pose,.156,.064);
  arm(pose,"r",[-.283,.778+.033*amount,.063],
    [-.74,-.59,-.05],[0,0,1]);
  arm(pose,"l",[.267,.853,.128],[.77,-.62,-.19],axis);
  const tilt=mix(-.180,.348,amount);
  const driver=[0,Math.sin(tilt),Math.cos(tilt)];
  pose.rGrip=driver;
  pose.barbell={center:add(pose.rw,scale(driver,.299)),axis:driver};
  return pose;
}

const floorEzCamera={yaw:63,elevation:20,focus:[0,.37,.11],height:1.64};
addRows([["3986"]],ezRaiseTwist,["shoulder"],"ez-barbell",{...standing,yaw:56},4600);
addRows([["4190",{across:true}]],ezRaiseTwist,["shoulder","core"],"ez-barbell",{...standing,yaw:51,height:2.51},5500);
addRows([["4189"]],ezRollout,["core","lat"],"ez-barbell",{...floorEzCamera,yaw:67,focus:[0,.37,.27],height:1.55},4600);
addRows([["4188",{kind:"reverse"}]],ezWeightedCore,["core"],"ez-barbell",floorEzCamera,4450);
addRows([["4187",{kind:"side"}]],ezWeightedCore,["core"],"ez-barbell",{...floorEzCamera,yaw:52,height:1.79},5600,.25);
addRows([["5308",{kind:"twist"}]],ezWeightedCore,["core"],"ez-barbell",{...floorEzCamera,yaw:49,height:1.97},5900,.24);
addRows([["5309",{kind:"press"}]],ezWeightedCore,["core","shoulder"],"ez-barbell",{...floorEzCamera,yaw:63,height:2.45,focus:[0,.74,.16]},5100,.53);
addRows([["1820"]],phase=>curl(phase,{mode:"preacher",width:.173,travel:mix(.293,.027,rep(phase,.28,.71))}),
  ["biceps"],"ez-preacher",{...supportCam,yaw:59},5350);
addRows([["0445"]],ezAntiGravity,["shoulder","triceps"],"ez-chest-bench",
  {...standing,yaw:117,focus:[0,.91,.06],height:2.19},4600);
addRows([["5240"]],ezDeadliftCurl,["hamstring","glute","biceps"],"ez-barbell",{...standing,yaw:57},5600,.72);
addRows([["2900"]],ezStandingPreacher,["biceps"],"ez-standing-preacher",
  {...standing,yaw:49,focus:[0,.89,.126],height:2.17},4600);
addRows([["6268"]],ezSingleWrist,["r:forearm"],"ez-barbell",{...standing,yaw:-56},4300);
addRows([["0636"]],olympicHammer,["biceps","forearm"],"olympic-neutral-bar",
  {...standing,yaw:52},4450);
addRows([["1506"]],phase=>curl(phase,{width:.175,strict:true}),["biceps"],"ez-floor-band",
  {...standing,yaw:52},4450);

function fixtureRow(phase,{kind,reverse=false,width=.335}) {
  const amount=rep(phase,.39,.61);
  if (kind==='inverted') {
    const pitch=mix(-1.35,-.94,amount);
    // Heels anchor while the shoulder girdle travels toward the fixed shaft.
    const body=athlete([0,.082+.717*Math.cos(pitch),1.394+.717*Math.sin(pitch)],pitch);
    for(const [side,sign] of sides)foot(body,side,sign,[sign*.146,.081,1.394],0,0,[sign*.12,.95,.14]);
    loadedBar(body,[0,.840,.466],width,sign=>[sign*.53,-.58,.46],reverse);
    return body;
  }
  if (kind==='seal'||kind==='cambered') {
    const sealed=kind==='seal';
    const body=athlete([0,sealed?.792:.635,.847],Math.PI/2,Math.PI);
    for(const [side,sign] of sides){
      foot(body,side,-sign,[-sign*.127,sealed?.695:.078,sealed?1.56:1.35],sealed?null:0,0,[-sign*.18,-.75,-.3]);
      const ankle=body[side+'a'];
      body[side+'t']=[ankle[0]-sign*.033,ankle[1]-.052,ankle[2]-.153];
    }
    loadedBar(body,[0,mix(.202,sealed?.574:.500,amount),mix(.361,.441,amount)],width,sign=>[-sign*.68,-.340,.65],false,[-1,0,0]);
    return body;
  }
  if (kind==='isometric') {
    const body=athlete([0,.816+.014*amount,-.128+.023*amount],.415-.038*amount);
    stance(body,.158,.055);
    loadedBar(body,[0,.704,.168],width,sign=>[sign*.36,-.21,-.82]);
    return body;
  }
  if (kind==='wide-plus') {
    const body=athlete([0,.779,-.194],1.105-.048*amount);
    stance(body,.170,.04);
    loadedBar(body,[0,mix(.450,.830,amount),mix(.261,.144,amount)],width,sign=>[sign*.84,.60,-.41]);
    return body;
  }
  const body=athlete([0,.796,-.188-.045*(1-amount)],1.09-.055*amount);
  stance(body,.152,.047);
  loadedBar(body,[0,mix(.464,.858,amount),mix(.248,.154,amount)],width,sign=>[sign*.37,.48,-.77]);
  return body;
}

const rowRackCamera={yaw:64,elevation:13,focus:[0,.862,.36],height:2.25};
addRows([['4424',{kind:'inverted',width:.164}],['4423',{kind:'inverted',width:.164,reverse:true}],['3654',{kind:'inverted',width:.329}]],
  fixtureRow,['lat','biceps'],'barbell-inverted-row-rack',rowRackCamera,4600,.49);
addRows([['8798',{kind:'seal',width:.315}]],fixtureRow,['lat','biceps'],'barbell-seal-row-bench',
  {...rowRackCamera,focus:[0,.56,.795],height:1.65},4400,.49);
addRows([['0248',{kind:'cambered',width:.315}]],fixtureRow,['lat','biceps'],'barbell-cambered-row-bench',
  {...rowRackCamera,focus:[0,.53,.795],height:1.67},4400,.49);
addRows([['3992',{kind:'wide-plus',width:.422}]],fixtureRow,['trap','rearShoulder'],'barbell',standing,4500,.48);
addRows([['4126',{kind:'deadstop',width:.247}]],fixtureRow,['lat','biceps'],'barbell-pins',rowRackCamera,5300,.49);
addRows([['9607',{kind:'isometric',width:.238}]],fixtureRow,['glute','quad','trap'],'barbell-pins',rowRackCamera,6500,.44);

function seatedBarCore(phase,{kind}) {
  const overhead=kind==='z-press'||kind==='leg-raise';
  const ball=kind==='ball-twist';
  const left=rep(clamp(2*phase),.37,.61);
  const right=rep(clamp(2*phase-1),.37,.61);
  const turn=overhead?0:(left-right)*(ball?.62:.49);
  const body=athlete([0,ball?.632:.115,ball?-.170:-.122],ball?-.018:kind==='floor-twist'?-.329:-.139,turn);
  if(ball)body.ballCenter=[0,.285,-.174];
  for(const [side,sign] of sides){
    const alternating=kind==='leg-raise';
    const amount=sign===1?left:right;
    const sole=ball?[sign*.338,.076,.343]:kind==='z-press'?[sign*.101,.081,.525]:kind==='floor-twist'
      ?[sign*.170,.076,.544]:[sign*.141,.076+.219*amount,.684-.036*amount];
    foot(body,side,sign,sole,alternating&&amount>.001?null:0,0,kind==='z-press'?[sign*.95,.2,.08]:[sign*.22,.92,.21]);
    if(kind==='z-press')body[side+'t']=[sign*.033,.043,sole[2]+.113];
  }
  const shoulder=scale(add(body.ls,body.rs),.5);
  const axis=unit(minus(body.ls,body.rs));
  const amount=kind==='z-press'?rep(phase,.38,.59):1;
  const center=overhead?add(shoulder,[0,mix(.092,.593,amount),mix(.164,.084,amount)])
    :add(shoulder,[-.075*Math.sin(turn),.040,-.075*Math.cos(turn)]);
  loadedBar(body,center,overhead?.302:.341,sign=>[sign*.75,-.64,overhead?.12:-.42],false,axis);
  return body;
}

function barbellTwistPress(phase){
  const left=rep(clamp(phase/.30),.38,.54);
  const right=rep(clamp((phase-.30)/.30),.38,.54);
  const turn=left-right;
  const press=rep(clamp((phase-.62)/.38),.38,.57);
  const body=benchBody('floor');
  for(const [side,sign] of sides){
    const anchor=[.390*turn+sign*.075,.536-.195*Math.abs(turn)+sign*.079*turn,.423+.067*Math.abs(turn)];
    foot(body,side,sign,anchor,null,0,[turn*.70+sign*.13,.78,-.32]);
  }
  loadedBar(body,[0,mix(.708,.378,press),mix(-.284,-.247,press)],.338,sign=>[sign*.83,-.53,.23]);
  return body;
}

function barbellCurlPressExtension(phase){
  const stops=[[0,.788,.160],[.22,1.316,.211],[.39,1.952,.074],[.54,1.567,-.247],
    [.68,1.952,.074],[.80,1.289,.198],[1,.788,.160]];
  const index=stops.findIndex(([at],i)=>i>0&&phase<=at);
  const a=stops[index-1],b=stops[index];
  const t=smooth((phase-a[0])/(b[0]-a[0]));
  const body=athlete([0,.884,0],.024);
  stance(body,.161,.048);
  const behind=rep(clamp((phase-.39)/.29),.49,.53);
  loadedBar(body,[0,mix(a[1],b[1],t),mix(a[2],b[2],t)],.215,
    sign=>[sign*.26,mix(-.79,.62,behind),mix(-.31,.61,behind)],phase<.28||phase>.81);
  return body;
}

function elevatedBarbellRollout(phase){
  const reach=rep(phase,.43,.61);
  const hipAngle=mix(1.061,1.452,reach);
  const body=athlete([0,.435+.420*Math.cos(hipAngle),-.257+.420*Math.sin(hipAngle)],mix(1.352,1.588,reach));
  for(const [side,sign] of sides){
    body[side+'k']=[sign*.155,.435,-.257];
    body[side+'a']=[sign*.158,.445,-.681];
    body[side+'t']=[sign*.168,.396,-.779];
  }
  const shoulder=body.ls;
  const depth=Math.sqrt(Math.max(.006,.614**2-(shoulder[1]-.197)**2));
  loadedBar(body,[0,.197,shoulder[2]+depth*(.42+.55*reach)],.244,sign=>[sign*.23,.09,-.98]);
  return body;
}

function barbellSkier(phase){
  const sweep=rep(phase,.37,.62);
  const body=athlete([0,.786,-.235],.67);
  stance(body,.168,.069);
  const shoulder=body.ls;
  const angle=mix(.20,1.13,sweep);
  loadedBar(body,[0,shoulder[1]-.603*Math.cos(angle),shoulder[2]-.603*Math.sin(angle)],.245,
    sign=>[sign*.34,-.41,-.56]);
  return body;
}

function barbellCalfMassage(phase){
  const amount=rep(phase,.42,.62);
  const body=athlete([0,.257,.075-.137*amount],-.522);
  foot(body,'l',1,[.119,.285,.819-.136*amount],null,0,[.06,.94,.13]);
  foot(body,'r',-1,[-.215,.078,.512-.29*amount],0,0,[-.27,.94,.26]);
  const wristDepth=-.176-.232*amount;
  for(const [side,sign] of sides)arm(body,side,[sign*.296,.064,wristDepth],[sign*.78,-.38,-.23],[sign,0,0]);
  body.barbell={center:[0,.197,.670-.036*amount],axis};
  return body;
}

function parallelBarFly(phase){
  const width=rep(phase,.42,.58);
  const pitch=mix(1.220,1.483,width);
  const body=athlete([0,.087+.822*Math.cos(pitch),-.962+.822*Math.sin(pitch)],pitch);
  for(const [side,sign] of sides){
    foot(body,side,sign,[sign*.143,.087,-.962],0,.011,[sign*.21,-.66,.36]);
    body[side+'t']=[sign*.155,.006,-.880];
    arm(body,side,[sign*(.245+.425*width),.198,.245+.075*width],[sign*.73,-.46,-.1],[0,0,1]);
  }
  body.barbell={center:body.lw,axis:[0,0,1]};
  body.secondBarbell={center:body.rw,axis:[0,0,1]};
  return body;
}

const seatedCoreCamera={yaw:56,elevation:15,focus:[0,.55,.20],height:1.57};
addRows([['10049',{kind:'z-press'}]],seatedBarCore,['shoulder','triceps','core'],'barbell',seatedCoreCamera,4600,.46);
addRows([['2799',{kind:'leg-raise'}],['2800',{kind:'leg-raise',female:true}]],seatedBarCore,['core','quad'],
  ({female})=>female?'barbell-leg-raise-female':'barbell',seatedCoreCamera,4800,.25);
addRows([['0093',{kind:'ball-twist'}]],seatedBarCore,['core'],'barbell-stability-ball',{...seatedCoreCamera,height:1.95},5200,.25);
addRows([['4854',{kind:'floor-twist'}]],seatedBarCore,['core'],'barbell',seatedCoreCamera,5200,.25);
addRows([['2811']],barbellTwistPress,['core','pec','triceps'],'barbell',{...seatedCoreCamera,focus:[0,.40,.20]},6500,.40);
addRows([['5883']],barbellCurlPressExtension,['biceps','shoulder','triceps'],'barbell',{...standing,height:2.40},6500,.52);
addRows([['0083']],elevatedBarbellRollout,['core','lat'],'barbell-rollout-bench',{...seatedCoreCamera,focus:[0,.54,.12],height:1.74},4600,.50);
addRows([['0100']],barbellSkier,['rearShoulder','triceps'],'barbell',{...standing,yaw:66},4500,.50);
addRows([['2992']],barbellCalfMassage,['l:calf'],'barbell',{...seatedCoreCamera,focus:[0,.40,.35]},5000,.47);
addRows([['0458']],parallelBarFly,['pec','core'],'barbell-floor-fly',{...seatedCoreCamera,yaw:45,focus:[0,.37,-.16],height:1.66},5000,.48);

function holdZercher(body,center){
  for(const [side,sign] of sides){
    body[side+'e']=[sign*.195,center[1]-.017,center[2]-.017];
    body[side+'w']=[sign*.093,center[1]+.342,center[2]+.111];
    body[side+'Grip']=[sign,0,0];
  }
  body.barbell={center,axis};
  return body;
}

function carryBarbell(phase,{kind}){
  const strides=phase*2*Math.PI;
  const loaded=kind==='farmer'||kind==='yoke';
  const raise=loaded?rep(phase,.19,.81):1;
  const walk=loaded?smooth((phase-.18)/.13)*smooth((.82-phase)/.12):1;
  const hips=[.018*Math.sin(strides)*walk,mix(kind==='yoke'?.74:.61,.881,raise)-.025*Math.cos(strides*2)*walk,.034];
  const body=athlete(hips,kind==='farmer'?.34*(1-raise):.036);
  for(const [side,sign] of sides){
    const swing=Math.sin(strides+sign*Math.PI/2);
    const lift=walk*Math.max(0,swing)*.094;
    const heel=kind==='tiptoe'?.096:0;
    const fore=walk*Math.cos(strides+sign*Math.PI/2)*.156;
    foot(body,side,sign,[sign*.148,.076+lift+heel,.065+fore],lift>.002?null:0,heel);
  }
  const shoulder=scale(add(body.ls,body.rs),.5);
  if(kind==='farmer'){
    for(const [side,sign] of sides)arm(body,side,[sign*.338,.201+.577*raise,.098],[sign*.46,-.51,-.37],[0,0,1]);
    body.barbell={center:body.lw,axis:[0,0,1]};
    body.secondBarbell={center:body.rw,axis:[0,0,1]};
    return body;
  }
  if(kind==='zercher')return holdZercher(body,add(shoulder,[0,-.205,.190]));
  if(kind==='yoke'){
    const center=add(shoulder,[0,.011,-.071]);
    for(const [side,sign] of sides)arm(body,side,add(center,[sign*.548,-.179,0]),[sign*.48,-.58,.23],[0,1,0]);
    body.barbell={center,axis};
    return body;
  }
  const high=kind==='overhead';
  loadedBar(body,add(shoulder,[0,high?.569:.040,high?.035:-.093]),high?.381:.339,sign=>[sign*.65,-.71,high?.22:-.44]);
  return body;
}

function zercherVariation(phase,{kind}){
  const q=rep(phase,.40,.58);
  if(kind==='split'){
    const body=fixedSupportSplit(phase,{rearBench:true});
    return holdZercher(body,add(scale(add(body.ls,body.rs),.5),[0,-.200,.206]));
  }
  if(kind==='extension'){
    const body=athlete([0,.799,-.169],mix(2.13,.546,q));
    for(const [side,sign] of sides)foot(body,side,sign,[sign*.134,.143,-.708],null,0,[sign*.33,.62,.11]);
    return holdZercher(body,add(scale(add(body.ls,body.rs),.5),[0,-.205,.142]));
  }
  const pitch=mix(1.195,.058,q);
  const body=athlete([0,mix(.375,.880,q),mix(-.246,-.020,q)],pitch);
  stance(body,.162,.06);
  const center=[0,mix(.208,1.161,q),mix(.234,.185,q)];
  return holdZercher(body,center);
}

function safetyBarPose(body,{front=false}={}){
  const shoulder=scale(add(body.ls,body.rs),.5);
  const center=add(shoulder,[0,.055,front?.080:-.067]);
  for(const [side,sign] of sides)arm(body,side,add(center,[sign*.239,-.068,front?-.24:.269]),
    [sign*.49,-.76,front?.28:.17],[0,0,front?-1:1]);
  body.barbell={center,axis};
  return body;
}

function loadedJumpVariation(phase,{kind}){
  if(kind==='shrug'){
    const prep=rep(clamp(phase/.32),.68,.83);
    const fly=Math.sin(Math.PI*clamp((phase-.31)/.28));
    const landing=rep(clamp((phase-.575)/.33),.29,.40);
    const body=athlete([0,.878-.145*prep+.165*fly-.117*landing,-.036],.029+.18*(prep+landing));
    for(const [side,sign] of sides){
      foot(body,side,sign,[sign*.157,.076+.137*fly,.057],fly>.001?null:0);
      body[side+'s'][1]+=.053*fly;
    }
    const shoulder=scale(add(body.ls,body.rs),.5);
    loadedBar(body,add(shoulder,[0,-.594,.060]),.251,sign=>[sign*.27,-.65,-.34]);
    return body;
  }
  if(kind==='kneeling'){
    const rise=smooth((phase-.18)/.27)*smooth((.98-phase)/.26);
    const launch=Math.sin(Math.PI*clamp((phase-.22)/.27));
    const body=athlete([0,.494+.122*rise+.147*launch,-.207+.200*rise],.092+.24*rise);
    for(const [side,sign] of sides){
      foot(body,side,sign,[sign*.153,.080+.150*launch,-.548+.613*rise],rise>.98&&launch<.01?0:null,0,
        [sign*.14,mix(.02,-.75,rise),1]);
      if(rise<.001)body[side+'k']=[sign*.148,.086,-.112];
    }
    loadedBar(body,add(scale(add(body.ls,body.rs),.5),[0,.029,-.084]),.342,sign=>[sign*.66,-.71,-.45]);
    return body;
  }
  const half=(phase*2)%1;
  const lead=phase<.5?1:-1;
  const jumping=half<.49;
  if(jumping){
    const local=half/.49;
    return squatWithBar(local,{jump:true,depth:.301});
  }
  const step=rep((half-.49)/.51,.36,.60);
  const body=athlete([0,.887-.279*step,-.040-.081*step],.037+.118*step);
  for(const [side,sign] of sides){
    const rear=sign!==lead;
    foot(body,side,sign,[sign*.145,.076+(rear?.101*step:0),.112+(rear?-.63:.09)*step],0,rear?.101*step:0);
  }
  loadedBar(body,add(scale(add(body.ls,body.rs),.5),[0,.030,-.087]),.351,sign=>[sign*.67,-.70,-.31]);
  return body;
}

function cheatCurl(phase){
  const travel=rep(phase,.33,.42);
  const drive=rep(clamp(phase/.42),.53,.61);
  const body=athlete([0,.873-.062*drive,-.015+.095*drive],-.169*drive);
  stance(body,.154,.061);
  const angle=mix(.106,2.41,travel);
  const shoulder=scale(add(body.ls,body.rs),.5);
  loadedBar(body,add(shoulder,[0,-.240-.367*Math.cos(angle),.019+.372*Math.sin(angle)]),.248,sign=>[sign*.27,-.69,-.37],true);
  return body;
}

function sumoHighPull(phase){
  const stand=rep(phase,.32,.67);
  const pull=rep(clamp((phase-.28)/.38),.44,.60);
  const body=athlete([0,mix(.521,.876,stand),mix(-.223,-.033,stand)],mix(.82,.026,stand));
  for(const [side,sign] of sides){
    foot(body,side,sign,[sign*.301,.076,.060],0,0,[sign*.67,.01,.90]);
    body[side+'t'][0]+=sign*.054;
  }
  loadedBar(body,[0,mix(.197,.820,stand)+.445*pull,.152+.050*pull],.151,
    sign=>[sign*.91,mix(-.67,.61,pull),-.29]);
  return body;
}

const loadedCarryCamera={...standing,yaw:59,focus:[0,.94,.027],height:2.46};
addRows([['2914',{kind:'overhead'}],['2990',{kind:'tiptoe'}],['2915',{kind:'zercher'}]],carryBarbell,['core','glute'],
  'barbell',loadedCarryCamera,4300,.36);
addRows([['2734',{kind:'farmer'}],['2735',{kind:'yoke'}]],carryBarbell,['core','glute','trap'],
  ({kind})=>kind==='yoke'?'strongman-yoke-barbell':'strongman-farmers-barbells',
  ({kind})=>({...loadedCarryCamera,yaw:kind==='farmer'?24:48,height:2.68}),5800,.43);
addRows([['8991',{kind:'extension'}],['7552',{kind:'split'}],['5670',{kind:'deadlift'}]],zercherVariation,['glute','hamstring','core'],
  ({kind})=>kind==='extension'?'barbell-roman-bench':kind==='split'?'barbell-rear-bench':'barbell',
  {...standing,yaw:67,height:2.27},5100,.46);
addRows([['1446',{rack:'zercher',depth:.395,pause:true}]],squatWithBar,['quad','glute','core'],'barbell',standing,6500,.48);
addRows([['2728',{rack:'front',railRack:true,depth:.407}]],squatWithBar,['quad','glute','core'],'barbell-fat-grip',standing,4700,.48);
addRows([['4219',{depth:.398,heel:.058,pause:true}],['4218',{front:true,depth:.423}]],
  (phase,options)=>safetyBarPose(squatWithBar(phase,{...options,upright:true}),options),['quad','glute'],
  ({front})=>front?'barbell-safety-front':'barbell-safety-heels',{...standing,yaw:54,height:2.42},4800,.47);
addRows([['5911']],phase=>safetyBarPose(pinnedGoodMorning(phase)),['hamstring','glute'],'barbell-safety',
  {...standing,yaw:62,height:2.28},5000,.15);
addRows([['2797',{kind:'jump-lunge'}],['4964',{kind:'shrug'}],['1420',{kind:'kneeling'}]],loadedJumpVariation,['quad','glute','trap'],
  'barbell',{...standing,yaw:60,height:2.51},5200,.45);
addRows([['5696']],cheatCurl,['biceps'],'barbell',{...standing,yaw:55},4600,.46);
addRows([['1199']],sumoHighPull,['quad','glute','trap'],'barbell',{...standing,yaw:57},4600,.52);

function landmineEnd(body,pivot,wish,length,grip='both',side=1){
  const ray=unit(minus(wish,pivot));
  const end=add(pivot,scale(ray,length));
  if(grip==='none'){
    body.landmine={pivot,end};
    return body;
  }
  for(const [limb,sign] of sides){
    const active=!grip.startsWith('single')||sign===side;
    const hand=grip==='handle'?add(end,[sign*.170,.022,0])
      :add(end,grip==='both'?scale(ray,sign*.052):[0,0,0]);
    const rest=add(body[limb+'h'],[sign*.181,.113,.139]);
    arm(body,limb,active?hand:rest,[sign*.57,-.78,grip==='single-row'||grip==='handle'?-.76:.21],
      active?(grip==='handle'?axis:ray):[sign,0,0]);
  }
  body.landmine={pivot,end};
  return body;
}

function kneelLandmine(body,half){
  for(const [limb,sign] of sides){
    if(half&&sign===1){foot(body,limb,sign,[.164,.076,.454],0,0,[.2,.89,.10]);continue;}
    body[limb+'k']=[sign*.151,.087,-.072];
    body[limb+'a']=[sign*.155,.081,-.490];
    body[limb+'t']=[sign*.162,.020,-.616];
  }
}

function catalogueLandminePress(phase,{kind}){
  const one=['band','half','tall','band-one','push'].includes(kind);
  const half=kind==='half';
  const kneel=half||['tall','squeeze','kneeling-thruster','kneeling-turn','thor'].includes(kind);
  const twistLeft=rep(clamp(2*phase),.42,.62);
  const twistRight=rep(clamp(2*phase-1),.42,.62);
  const twist=twistLeft-twistRight;
  const move=kind==='push'?rep(clamp((phase-.22)/.78),.30,.56):rep(phase,.43,.61);
  const drive=kind==='push'?rep(clamp(phase/.39),.40,.59):0;
  const kneelSquat=kind==='kneeling-thruster'?rep(clamp(phase/.43),.40,.60):0;
  const pivot=[0,.066,1.44];
  const turned=kind==='kneeling-turn'?twist*.62:kind==='thor'?.29*move:0;
  const pelvisHeight=kneel?.520-.261*kneelSquat:.881-.103*drive;
  const body=athlete([0,pelvisHeight,kneel?-.071-.243*kneelSquat:.032-.043*drive],
    kind==='kneeling-thruster'?.040+.255*kneelSquat:.042,turned);
  if(kneel)kneelLandmine(body,half||kind==='thor');
  else for(const [limb,sign] of sides){
    const split=kind==='standing'||kind==='band';
    const rear=split&&sign===-1;
    const heel=rear?.051:0;
    foot(body,limb,sign,[sign*.151,.076+heel,split?(rear?-.251:.294):.082],0,heel);
  }
  const shoulder=scale(add(body.ls,body.rs),.5);
  let wish=add(shoulder,[one?mix(.196,.132,move):0,mix(-.054,.436,move),mix(.182,.516,move)]);
  if(kind==='squeeze')wish=add(shoulder,[0,mix(-.119,.179,move),mix(.173,.554,move)]);
  if(kind==='kneeling-turn')wish=[.467*twist,1.10-.103*Math.abs(twist),mix(.162,.271,Math.abs(twist))];
  if(kind==='thor')wish=[mix(-.317,.303,move),mix(.646,1.409,move),mix(.192,.269,move)];
  if(kind==='kneeling-turn'||kind==='thor'){
    const shift=kind==='kneeling-turn'?.063*twist:mix(-.044,.059,move);
    for(const joint of ['ls','rs','chest','neck','head'])body[joint][0]+=shift;
  }
  const radius=kneel?(kind==='kneeling-turn'?1.61:kind==='thor'?1.66:1.75):1.98;
  return landmineEnd(body,pivot,wish,radius,one?'single':'both');
}

function landmineArmArc(phase,{fly}){
  const move=rep(phase,.44,.56);
  if(fly){
    const body=benchBody('floor');
    const pivot=[-.24,.068,.913];
    const wish=[mix(.197,.687,move),mix(.703,.185,move),mix(-.275,-.237,move)];
    landmineEnd(body,pivot,wish,1.36,'single');
    arm(body,'r',[-.403,.062,.045],[-.87,-.29,-.32],[-1,0,0]);
    return body;
  }
  const body=athlete([0,.888,.010],.009,-.12*move);
  stance(body,.159,.067);
  return landmineEnd(body,[0,.066,1.556],[mix(-.251,.642,move),mix(.871,1.361,move),mix(.197,.304,move)],1.73,'single');
}

const landmineCamera={yaw:60,elevation:15,focus:[0,.97,.716],height:2.34};
const landmineKneelingCamera={...landmineCamera,focus:[0,.74,.699],height:2.00};
addRows([['5074',{kind:'standing'}],['10190',{kind:'push'}],['10056',{kind:'band'}],['4202',{kind:'band-one'}]],
  catalogueLandminePress,['shoulder','triceps'],({kind})=>kind.startsWith('band')?'landmine-banded':'landmine',landmineCamera,4650,.54);
addRows([['9695',{kind:'half'}],['5636',{kind:'tall'}],['3921',{kind:'squeeze'}],['5282',{kind:'kneeling-thruster'}]],
  catalogueLandminePress,['shoulder','triceps','core'],'landmine',landmineKneelingCamera,4600,.50);
addRows([['10195',{kind:'thor'}],['11092',{kind:'kneeling-turn'}]],catalogueLandminePress,['core','shoulder'],'landmine',
  {...landmineKneelingCamera,yaw:42,height:2.10},5300,.24);
addRows([['3237']],landmineArmArc,['l:shoulder'],'landmine',{...landmineCamera,yaw:22,focus:[.19,.95,.65]},4700,.49);
addRows([['3923',{fly:true}]],landmineArmArc,['l:pec'],'landmine',{...landmineCamera,yaw:55,focus:[0,.43,.24],height:1.66},4700,.45);

function landmineSquat(phase,{kind}){
  const wide=kind==='sumo'||kind==='cossack';
  const hack=kind==='hack';
  const jump=kind==='jump';
  const high=kind==='high-knee';
  const alternate=kind==='cossack'||high;
  const local=alternate?(2*phase)%1:phase;
  const side=phase<.5||phase===1?1:-1;
  const down=rep(local,.37,jump?.44:.54);
  const fly=jump?Math.sin(Math.PI*clamp((phase-.46)/.32)):0;
  const landing=jump?rep(clamp((phase-.74)/.26),.36,.46):0;
  const drive=kind==='thruster'||high?rep(clamp((local-.48)/.52),.43,.58):0;
  const shift=kind==='cossack'?side*.282*down:high?-side*.042*drive:0;
  const body=athlete([shift,.884-(wide?.344:.361)*down+.137*fly-.124*landing,
    (hack?.118:.019)-.115*down-.031*landing],.026+.181*down);
  for(const [limb,sign] of sides){
    const straight=kind==='cossack'&&sign!==side;
    const lifted=high&&sign===side&&drive>.0001;
    const heel=straight?.030*down:0;
    foot(body,limb,sign,[sign*(wide?.36:.157),.076+.128*fly+heel+(lifted?.467*drive:0),
      (hack?.276:.087)+(lifted?.159*drive:0)],fly>.001||lifted?null:0,heel,[sign*(wide?.54:.19),.07,1]);
    if(straight)body[limb+'t'][1]+=.117*down;
    if(wide)body[limb+'t'][0]+=sign*.056;
  }
  const shoulder=scale(add(body.ls,body.rs),.50);
  const pivot=hack?[.121,.066,-1.48]:[0,.066,1.497];
  const wish=add(shoulder,[hack?.208:0,mix(-.145,.392,kind==='thruster'?drive:0),
    hack?-.058:mix(.266,.534,kind==='thruster'?drive:0)]);
  return landmineEnd(body,pivot,wish,hack?2.00:1.69);
}

function landmineRearLunge(phase,{kind}){
  const overhead=kind==='overhead';
  const deep=kind==='deep';
  const local=(2*phase)%1;
  const back=phase<.5||phase===1?-1:1;
  const step=rep(local,.36,.56);
  const down=rep(local,.46,.57);
  const press=overhead?rep(clamp((local-.51)/.49),.49,.60):0;
  const body=athlete([0,.886-(deep?.370:.320)*down,-.105*down],.025+(deep?.104:.151)*down);
  for(const [limb,sign] of sides){
    const rear=sign===back;
    const heel=rear?.102*step:0;
    foot(body,limb,sign,[sign*.158,.076+heel,(rear?.087-.636*step:.087)],0,heel,[sign*.15,.082,1]);
  }
  const shoulder=scale(add(body.ls,body.rs),.5);
  return landmineEnd(body,[0,.066,1.492],add(shoulder,[0,mix(-.132,.402,press),mix(.237,.518,press)]),overhead?1.80:1.76);
}

function landmineHinge(phase,{kind}){
  const single=kind.startsWith('one-');
  const dead=kind==='deadlift';
  const style=kind==='rdl-low'||kind==='one-low';
  const chest=kind==='one-high';
  const down=rep(phase,kind==='one-stiff'?.46:.40,kind==='one-stiff'?.56:.62);
  const hinge=mix(.028,single?1.424:dead?1.001:style?1.175:1.087,down);
  const body=athlete([single?.113:0,mix(.887,dead?.566:single?.870:.788,down),mix(.017,single?-.175:-.211,down)],hinge);
  for(const [limb,sign] of sides){
    const rear=single&&sign===-1;
    const z=rear?mix(.038,-.934,down):.065;
    const height=rear?mix(.076,kind==='one-stiff'?.889:.798,down):.076;
    foot(body,limb,sign,[sign*.158,height,z],rear&&down>.001?null:0,0,[sign*.13,.15,rear?.46:1]);
    if(rear&&down>.02)body[limb+'t']=add(body[limb+'a'],[-.008,-.113,-.105]);
  }
  const y=mix(chest?1.228:.817,dead?.181:style?.293:.375,down);
  return landmineEnd(body,[single?.066:0,.066,1.686],[single?.095:0,y,mix(.136,dead?.219:.374,down)],1.61);
}

function landmineRow(phase,{kind}){
  const bench=kind==='bench';
  const double=kind==='lever';
  const alternate=kind==='alternate';
  const pull=rep(phase,.39,.62);
  const body=athlete([bench?.017:0,bench?.711:alternate?.786:.735,bench?-.368:-.171],bench?1.29:alternate?1.198:1.206);
  if(bench){
    foot(body,'l',1,[.35,.077,-.457]);
    body.rk=[-.325,.480,.038];
    body.ra=[-.319,.487,-.386];
    body.rt=[-.321,.468,-.522];
  }else stance(body,double?.243:.199,.031);
  const shoulder=body.ls;
  const wish=[bench?.260:double?0:.092,mix(bench?.179:alternate?.240:.277,shoulder[1]-(alternate?.118:.190),pull),
    mix(shoulder[2]+.074,shoulder[2]-(alternate?.191:.153),pull)];
  const pivot=[bench?.321:0,.067,1.741];
  landmineEnd(body,pivot,wish,bench?1.61:1.60,double?'handle':'single-row');
  if(bench)arm(body,'r',[-.327,.490,.375],[-.57,.08,-.87],[-1,0,0]);
  return body;
}

function landmineHipThrust(phase){
  const drive=rep(phase,.43,.61);
  const height=mix(.247,.550,drive);
  const pitch=-Math.acos(clamp((.547-height)/.505,-1,1));
  const depth=-.469-.505*Math.sin(pitch)-.004*Math.cos(pitch);
  const body=athlete([0,height,depth],pitch);
  foot(body,'l',1,[.171,.076,.637],0,0,[.255,.93,.31]);
  foot(body,'r',-1,[-.149,mix(.366,.646,drive),mix(.831,.868,drive)],null,0,[-.15,.82,.22]);
  const pivot=[-1.468,.066,.207];
  const wish=[0,body.hips[1]+.044,body.hips[2]+.056];
  landmineEnd(body,pivot,wish,1.50,'none');
  const bar=body.landmine.end;
  const ray=unit(minus(bar,pivot));
  for(const [limb,sign] of sides)arm(body,limb,add(add(bar,scale(ray,sign*.169)),[0,.016,.011]),[sign*.64,-.47,-.43],ray);
  return body;
}

addRows([['10052',{kind:'cossack'}],['4246',{kind:'front'}],['5628',{kind:'hack'}],['2976',{kind:'thruster'}],
  ['10675',{kind:'jump'}],['3529',{kind:'high-knee'}],['4090',{kind:'sumo'}]],landmineSquat,['quad','glute'],
  'landmine',({kind})=>({...landmineCamera,yaw:kind==='cossack'?34:59,focus:[0,.94,kind==='hack'?-.70:.59]}),5250,.48);
addRows([['7627',{kind:'overhead'}],['3919',{kind:'normal'}],['4040',{kind:'deep'}]],landmineRearLunge,['quad','glute'],
  'landmine',{...landmineCamera,yaw:70,focus:[0,.94,.54],height:2.42},5500,.25);
addRows([['7883',{kind:'deadlift'}],['4113',{kind:'rdl'}],['4247',{kind:'rdl-low'}],['5307',{kind:'one-stiff'}],
  ['3918',{kind:'one-low'}],['6553',{kind:'one-high'}]],landmineHinge,['hamstring','glute'],
  'landmine',{...landmineCamera,yaw:65,focus:[0,.91,.74],height:2.27},4850,.47);
addRows([['4039',{kind:'bench'}],['4038',{kind:'plain'}],['5034',{kind:'alternate'}],['0574',{kind:'lever'}]],
  landmineRow,['lat','biceps'],({kind})=>kind==='bench'?'landmine-row-bench':kind==='lever'?'landmine-lever-handle':'landmine',
  {...landmineCamera,yaw:63,focus:[0,.70,.64],height:1.97},4750,.53);
addRows([['6546']],landmineHipThrust,['l:glute','hamstring'],'landmine-hip-bench',
  {yaw:-53,elevation:17,focus:[-.16,.50,.29],height:1.84},4750,.48);

function onTrapBar(body,center){
  for(const [limb,sign] of sides)arm(body,limb,add(center,[sign*.315,.084,0]),[sign*.62,-.62,-.49],[0,0,1]);
  body.barbell={center,axis};
  return body;
}

function catalogueTrapBar(phase,{kind}){
  const amount=rep(phase,.40,.61);
  if(kind==='overhead'){
    const body=athlete([0,.889,.008],-.014);
    stance(body,.161,.065);
    return onTrapBar(body,[0,mix(1.265,1.904,amount),mix(.095,.049,amount)]);
  }
  if(kind==='row'){
    const body=athlete([0,.754,-.154],1.196);
    stance(body,.156,.058);
    return onTrapBar(body,[0,mix(.28,.746,amount),mix(.316,.192,amount)]);
  }
  if(kind==='shrug'){
    const body=athlete([0,.888,.018]);
    stance(body,.156,.044);
    for(const [limb] of sides)body[limb+'s'][1]+=.074*amount;
    return onTrapBar(body,[0,.689+.076*amount,.062]);
  }
  if(kind==='jump'){
    const rig=loadedJumpVariation(phase,{kind:'shrug'});
    for(const [limb] of sides)rig[limb+'s'][1]-=.053*Math.sin(Math.PI*clamp((phase-.31)/.28));
    return onTrapBar(rig,[0,rig.ls[1]-.635,.066]);
  }
  if(kind==='split'){
    const body=athlete([.054,mix(.882,.785,amount),mix(.020,-.252,amount)],mix(.024,1.19,amount));
    foot(body,'l',1,[.167,.076,.138],0);
    foot(body,'r',-1,[-.158,.169,-.244],0,.093,[-.14,.17,.84]);
    return onTrapBar(body,[0,mix(.694,.358,amount),mix(.047,.198,amount)]);
  }
  const squat=kind==='squat';
  const deficit=kind==='deficit';
  const raised=deficit?.119:0;
  const low=squat?amount:1-amount;
  const hipY=.880+raised-low*(deficit?.490:squat?.367:.372);
  const body=athlete([0,hipY,.010-(squat?.132:.219)*low],.020+low*(squat?.433:deficit?1.0:.888));
  stance(body,.162,.056,raised);
  const barY=mix(.704+raised,squat?.344:.195,low);
  return onTrapBar(body,[0,barY,.041+.095*low]);
}

const trapCamera={...standing,yaw:57,focus:[0,.95,.06],height:2.29};
addRows([['4842',{kind:'band'}],['4105',{kind:'deficit'}],['3652',{kind:'split'}],['5304',{kind:'squat'}],['4166',{kind:'jump'}]],
  catalogueTrapBar,['quad','glute','hamstring'],({kind})=>kind==='band'?'trap-bar-banded':kind==='deficit'?'trap-bar-deficit':'trap-bar',trapCamera,4750,.48);
addRows([['4104',{kind:'row'}]],catalogueTrapBar,['lat','biceps'],'trap-bar',trapCamera,4600,.49);
addRows([['4103',{kind:'shrug'}]],catalogueTrapBar,['trap'],'trap-bar',trapCamera,4600,.49);
addRows([['7287',{kind:'overhead'}]],catalogueTrapBar,['shoulder','triceps'],'trap-bar',{...trapCamera,height:2.55},4800,.48);
addRows([['2733',{type:'axle',width:.312}]],olympicLift,['quad','glute','shoulder','triceps'],'strongman-apollons-axle',olympicHigh,6100,.70);

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
  if(item.option.comparison)recipe.formComparison=true;
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
