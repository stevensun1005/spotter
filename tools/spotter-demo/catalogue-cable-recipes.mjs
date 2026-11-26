import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l", 1], ["r", -1]];
const lateral = [1, 0, 0];
const vertical = [0, 1, 0];
const forward = [0, 0, 1];
const add = (a, b) => a.map((value, index) => value + b[index]);
const sub = (a, b) => a.map((value, index) => value - b[index]);
const scale = (point, amount) => point.map((value) => value * amount);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const magnitude = (point) => Math.hypot(...point);
const unit = (point) => scale(point, 1 / magnitude(point));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, phase) => a + (b - a) * phase;
const blend = (from, to, phase) => from.map((value, index) => mix(value, to[index], phase));
const midpoint = (a, b) => blend(a, b, .5);

function ease(value) {
  const phase = clamp(value, 0, 1);
  return phase * phase * (3 - 2 * phase);
}

function cycle(phase, turn = .43, release = .56) {
  return ease(phase / turn) * (1 - ease((phase - release) / (1 - release)));
}

function alternating(phase, sign) {
  const activeHalf = phase < .5 ? 1 : -1;
  return activeHalf === sign ? cycle((phase * 2) % 1) : 0;
}

function solveLimb(start, destination, pole, first, second) {
  const delta = sub(destination, start);
  const direction = unit(delta);
  const reach = clamp(magnitude(delta), Math.abs(first - second) + .001, first + second - .001);
  const along = (first * first + reach * reach - second * second) / (2 * reach);
  const perpendicular = unit(sub(pole, scale(direction, dot(pole, direction))));
  return [
    add(add(start, scale(direction, along)), scale(perpendicular, Math.sqrt(Math.max(0, first * first - along * along)))),
    add(start, scale(direction, reach)),
  ];
}

function torso(hips, pitch = 0, yaw = 0, sideBend = 0) {
  const up = unit([sideBend, Math.cos(pitch), Math.sin(pitch)]);
  const across = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const front = [Math.sin(yaw), -up[2], Math.cos(yaw)];
  const joint = (level, width = 0, depth = 0) => add(add(hips, scale(up, level)),
    add(scale(across, width), scale(front, depth)));
  return {
    hips, chest: joint(.370, 0, .008), neck: joint(.600), head: joint(.712, 0, .014),
    lh: joint(0, .103), rh: joint(0, -.103), ls: joint(.488, .192), rs: joint(.488, -.192),
    planted: { l: 0, r: 0 },
  };
}

function arm(pose, side, destination, pole, grip, fingers) {
  [pose[side + "e"], pose[side + "w"]] = solveLimb(pose[side + "s"], destination, pole, .248, .370);
  if (grip) pose[side + "Grip"] = grip;
  if (fingers) pose[side + "Fingers"] = fingers;
}

function wristFromElbow(pose, side, elbow, direction, grip, fingers) {
  pose[side + "e"] = elbow;
  pose[side + "w"] = add(elbow, scale(unit(direction), .370));
  if (grip) pose[side + "Grip"] = grip;
  if (fingers) pose[side + "Fingers"] = fingers;
}

function leg(pose, side, sign, ankle, kneeDirection = [sign * .09, .17, 1], toeOffset = [sign * .014, -.067, .145]) {
  [pose[side + "k"], pose[side + "a"]] = solveLimb(pose[side + "h"], ankle, kneeDirection, .420, .425);
  pose[side + "t"] = add(pose[side + "a"], toeOffset);
}

function stance(pose, width = .155, stagger = 0, base = .03) {
  for (const [side, sign] of sides) leg(pose, side, sign, [sign * width, .071, base + sign * stagger]);
}

function seatFeet(pose, mode = "seat") {
  const high = mode === "high-row";
  const floor = mode === "floor-row";
  const rowing = mode === "row" || mode === "decline-row" || high || floor;
  const kneeY = mode === "lat" ? .506 : rowing ? (high ? .53 : floor ? .28 : .39) : pose.hips[1] - .025;
  const kneeZ = rowing ? (floor ? .47 : .36) : .382;
  const ankleY = rowing ? (high ? .221 : .117) : .070;
  const ankleZ = rowing ? (floor ? .81 : .633) : .408;
  for (const [side, sign] of sides) {
    pose[side + "k"] = [sign * .15, kneeY, kneeZ];
    pose[side + "a"] = [sign * .148, ankleY, ankleZ];
    pose[side + "t"] = add(pose[side + "a"], rowing ? [sign * .015, .108, .101] : [sign * .015, -.064, .145]);
  }
  if (rowing) pose.planted = {};
}

function kneel(pose) {
  pose.planted = {};
  for (const [side, sign] of sides) {
    pose[side + "k"] = [sign * .133, .093, .143];
    pose[side + "a"] = [sign * .139, .104, -.276];
    pose[side + "t"] = [sign * .142, .025, -.403];
  }
}

function restingArm(pose, side, sign) {
  const shoulder = pose[side + "s"];
  wristFromElbow(pose, side, add(shoulder, [sign * .040, -.240, -.029]), [sign * .06, -.97, .20]);
}

const widths = { wide: .448, pro: .369, narrow: .176, medium: .264, straight: .325, v: .116, pressV: .147 };
const barDrop = { wide: .046, pro: .023, pressV: .046 };
const handFacing = {
  over: [0, -.88, .47],
  under: [0, .88, -.47],
};

function barHold(pose, center, key, poles, palms = "over", axis = lateral) {
  const width = widths[key];
  const depth = key === "v" ? .009 : 0;
  const offset = [-axis[2] * depth, -(barDrop[key] ?? 0), axis[0] * depth];
  for (const [side, sign] of sides) {
    const goal = add(add(center, scale(axis, sign * width)), offset);
    const grip = key === "v" ? [-axis[2], 0, axis[0]] : key === "pressV" ? [1,-sign*.37,0] : scale(axis, palms === "under" ? -1 : 1);
    arm(pose, side, goal, poles[side], grip, key === "v" ? [sign * -.20, .97, .03] : handFacing[palms]);
    if (magnitude(sub(pose[side + "w"], goal)) > .002) {
      throw new Error(side + " grasp does not reach the " + key + " attachment: " + JSON.stringify(goal));
    }
  }
}

function singleCable(pose, anchor, side, grip = vertical) {
  pose.cables = [{ anchor, end: pose[side + "w"], grip }];
}

function dualCable(pose, anchors) {
  pose.cables = sides.map(([side], index) => ({ anchor: anchors[index], end: pose[side + "w"], grip: pose[side + "Grip"] }));
}

function ropeCable(pose, anchor) {
  const center = midpoint(pose.lw, pose.rw);
  const separation = sub(pose.lw, pose.rw);
  const half = magnitude(separation) / 2;
  if (half >= .348) throw new Error("Hands are too far apart for one rope attachment.");
  const axis = unit(separation);
  const towards = sub(anchor, center);
  const normal = unit(sub(towards, scale(axis, dot(towards, axis))));
  pose.ropeJunction = add(center, scale(normal, Math.sqrt(.35 ** 2 - half ** 2)));
  pose.cables = sides.map(([side]) => {
    const end = pose[side + "w"];
    const grip = unit(sub(pose.ropeJunction, end));
    pose[side + "Grip"] = grip;
    return { anchor, end, grip };
  });
}

function barCable(pose, anchor, center, axis = lateral) {
  pose.cables = [{ anchor, end: center, grip: axis }];
}

function latPulldown(phase, { grip = "wide", rear = false, under = false, full = false, chest = false }) {
  const t = cycle(phase);
  const lean = rear ? .048 : -.13 - t * .066;
  const pose = torso([0, .567, -.017], lean);
  seatFeet(pose, "lat");
  const z = rear ? -.259 : mix(.236,chest ? .157 : .263,t);
  const width = widths[grip];
  const reach = Math.sqrt(.597 ** 2 - (width - .192) ** 2 - (z - pose.ls[2]) ** 2);
  const start = pose.ls[1] + reach + (barDrop[grip] ?? 0);
  const end = rear ? 1.228 : chest ? 1.109 : full ? 1.181 : 1.235;
  const center = [0, mix(start, end, t), z];
  const poles = { l: [.78, -.76, rear ? -.29 : -.14], r: [-.78, -.76, rear ? -.29 : -.14] };
  barHold(pose, center, grip, poles, under ? "under" : "over");
  barCable(pose, [0, 2.267, rear ? -.244 : .249], center);
  return pose;
}

function ropeLatPulldown(phase) {
  const t = cycle(phase);
  const pose = torso([0, .567, -.017], -.125 - .054 * t);
  seatFeet(pose, "lat");
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * mix(.158,.208,t), mix(1.58,1.213,t), mix(.157,.253,t)], [sign * .72, -.85, -.12]);
  }
  ropeCable(pose, [0, 2.265, .235]);
  return pose;
}

function independentLat(phase, crossed = false) {
  const active = cycle(phase);
  const pose = torso([0, crossed ? .878 : .567, -.017], crossed ? .008 : -.086);
  if (crossed) stance(pose);
  else seatFeet(pose, "lat");
  const offset = crossed ? .28 : 0;
  for (const [side, sign] of sides) {
    const t = crossed ? active : alternating(phase, sign);
    const hand = [sign * (crossed ? mix(.064,.392,t) : mix(.344,.184,t)),
      offset + mix(crossed ? 1.55 : 1.535, 1.227,t), mix(.233,.144,t)];
    arm(pose, side, hand, [sign * .74,-.91,-.14], [0,.3,.95]);
  }
  const side = crossed ? -.788 : .748;
  dualCable(pose, [[side, 2.255, .49], [-side, 2.255, .49]]);
  return pose;
}

function oneArmLat(phase) {
  const t = cycle(phase);
  const pose = torso([0,.896,-.075], .024);
  stance(pose, .158, .046);
  arm(pose, "r", [-mix(.255,.208,t), mix(1.876,1.442,t), mix(.284,.234,t)], [-.69,-.85,-.18], lateral);
  restingArm(pose, "l", 1);
  singleCable(pose, [0,2.262,.855], "r", lateral);
  return pose;
}

function kneelingHighRow(phase) {
  const t = cycle(phase);
  const pose = torso([0,.491,-.035], -.032);
  kneel(pose);
  const center = [0,mix(1.398,1.061,t),mix(.268,.136,t)];
  barHold(pose, center, "straight", { l: [.8,-.33,-.23], r: [-.8,-.33,-.23] });
  barCable(pose, [0,1.988,1.03], center);
  return pose;
}

function seatedRow(phase, {mode = "row", grip = "straight", anchorY = .27, high = false, under = false, crossover = false, steady = false}) {
  const t = cycle(phase);
  const height = mode === "floor-row" ? .165 : mode === "high-row" ? .651 : mode === "seat" ? .565 : .435;
  const pitch = steady ? .043 : under ? .126 : mode === "decline-row" ? -.123 : mix(.075,-.026,t);
  const pose = torso([0,height,-.02], pitch);
  seatFeet(pose, mode);
  const start = [0, pose.ls[1] - (high ? .033 : .235), pose.ls[2] + (grip === "wide" ? .45 : .518)];
  const end = [0,height + (high || crossover || grip === "wide" ? .435 : .304),.183];
  const center = blend(start,end,t);
  const anchor = [0, anchorY, mode === "floor-row" ? 1.33 : 1.095];
  const poles = { l:[.52, -.35, -.87], r:[-.52, -.35, -.87] };
  if (grip === "rope") {
    for (const [side, sign] of sides) {
      arm(pose, side, add(center,[sign * mix(crossover ? -.064 : .106,.214,t),crossover ? sign * .024 * (1-t) : 0,0]), poles[side]);
    }
    ropeCable(pose,anchor);
  } else {
    barHold(pose,center,grip,poles,under ? "under" : "over");
    barCable(pose,anchor,center);
  }
  return pose;
}

function standingRow(phase, {grip = "v", twist = false, upright = false, high = false, anchorHeight = null}) {
  const t = cycle(phase);
  const yaw = twist ? mix(.52,-.13,t) : 0;
  const pose = torso([0,.864,-.019], upright ? .025 : .118, yaw);
  stance(pose,.163,twist ? -.035 : 0);
  const center = upright ? [0,mix(.788,1.495,t),mix(.239,.248,t)]
    : [twist ? mix(.191,-.026,t) : 0, pose.hips[1] + (high ? .467 : .247),
      twist ? mix(.508,.195,t) : mix(.546,.205,t)];
  const axis = [Math.cos(yaw),0,-Math.sin(yaw)];
  const poles = {l:[.87,upright ? .36 : -.66,-.46],r:[-.87,upright ? .36 : -.66,-.46]};
  barHold(pose,center,grip,poles,"over",axis);
  barCable(pose,[twist ? .864 : 0, anchorHeight ?? (high ? 1.161 : .175), twist ? .59 : .977],center,axis);
  return pose;
}

function oneArmRow(phase, {hinge = false, onKnees = false, turn = false, facePull = false, kneelingHinge = false, anchorHeight = null, split = false, outwardRotation = false, twist = false, high = false}) {
  const t = cycle(phase);
  const side = facePull ? "l" : "r";
  const sign = side === "l" ? 1 : -1;
  const yaw = facePull ? -.22 : twist ? mix(.028, -.473, t) : 0;
  const pose = torso([0,onKnees ? .481 : hinge ? .797 : .866,-.054], hinge ? 1.005 : kneelingHinge ? .458 : twist ? -.064 : .108, yaw);
  if (onKnees) kneel(pose);
  else stance(pose,.163,facePull || split ? .16 : .042);
  const shoulder = pose[side + "s"];
  const reach = facePull ? .529 : hinge ? .291 : high ? .538 : .527;
  let low = facePull ? -.284 : hinge ? -.509 : -.132;
  if (onKnees) low = kneelingHinge ? -.236 : -.082;
  const start = add(shoulder,[sign * .027,outwardRotation ? -.032 : high ? .184 : low,reach]);
  const destination = outwardRotation ? add(shoulder, [sign * .244, .158, .129])
    : add(shoulder,[sign * (facePull ? .167 : .058),high ? -.038 : facePull ? -.129 : -.231, high ? .104 : -.063]);
  const grasp = blend(start,destination,t);
  const grip = turn ? [Math.cos(t*Math.PI),Math.sin(t*Math.PI),0] : facePull ? (outwardRotation ? unit([1,-.15*t,.27*t]) : lateral) : vertical;
  arm(pose,side,grasp,[sign * .72, outwardRotation ? .21 : -.35, -.89],grip);
  restingArm(pose,side === "r" ? "l" : "r",-sign);
  const anchor = [0, anchorHeight ?? (onKnees ? 1.062 : turn ? 1.075 : .239), hinge ? 1.17 : 1.081];
  singleCable(pose,anchor,side,grip);
  return pose;
}

function ropeFaceRow(phase, {kneeling = false, low = false, chest = false, under = false, anchorHeight = null} = {}) {
  const t = cycle(phase);
  const pose = torso([0,kneeling ? .485 : .876,-.053], kneeling ? -.03 : .018);
  if (kneeling) kneel(pose);
  else stance(pose,.159,.049);
  const shoulder = pose.ls;
  const anchor = [0,anchorHeight ?? (kneeling ? 1.05 : low ? .947 : 1.31),1.142];
  for (const [side, sign] of sides) {
    const start = [sign * .104,shoulder[1] - (low ? .177 : .066),shoulder[2] + .562];
    const end = [sign * (chest ? .208 : .248),shoulder[1] + (chest ? -.112 : .108),shoulder[2] + .108];
    arm(pose,side,blend(start,end,t),[sign * .97,.08,-.89],undefined,under ? handFacing.under : undefined);
  }
  ropeCable(pose,anchor);
  return pose;
}

function chestSupportRow(phase, rope = false) {
  const t = cycle(phase);
  const pose = torso([0,.554,-.049],.718);
  for (const [side, sign] of sides) {
    leg(pose,side,sign,[sign * .24,.067,-.164],[sign * .43,-.021,1]);
    const shoulder = pose[side + "s"];
    const start = add(shoulder,[0,-.434,.393]);
    const end = add(shoulder,[sign * .063,-.224,.027]);
    arm(pose,side,blend(start,end,t),[sign * .72,-.303,-.77],vertical);
  }
  if (rope) ropeCable(pose,[0,.22,1.197]);
  else dualCable(pose,[[.727,.37,1.059],[-.727,.37,1.059]]);
  return pose;
}

function cableRaise(phase, {single = false, hinge = false, lateralRaise = false} = {}) {
  const t = cycle(phase);
  const pose = torso([0,hinge ? .803 : .881,-.023], hinge ? .991 : .016);
  stance(pose,.15,.04);
  const anchor = single ? [.844,.177,.24] : [0,.169,.946];
  if (single) {
    const goal = hinge ? [-mix(.061,.726,t),mix(.641,1.062,t),mix(.492,.438,t)]
      : [-mix(.031,.758,t),mix(.798,1.36,t),.092];
    arm(pose,"r",goal,[-.37,-.76,.27],lateralRaise ? [0,.241,.971] : lateral);
    restingArm(pose,"l",1);
    singleCable(pose,anchor,"r",pose.rGrip);
  } else {
    const angle = mix(.20,Math.PI/2,t);
    const center = [0,pose.ls[1] - .59 * Math.cos(angle),pose.ls[2] + .59 * Math.sin(angle)];
    barHold(pose,center,"narrow",{l:[.47,-1,-.12],r:[-.47,-1,-.12]});
    barCable(pose,anchor,center);
  }
  return pose;
}

function bicepsCurl(phase, variant = {}) {
  const {grip = "straight", single = false, reverse = false, drag = false,
    position = "stand", rope = false, elbowOut = .035} = variant;
  const t = cycle(phase);
  const seated = position === "seat";
  const squat = position === "squat";
  const pose = torso([0,seated ? .565 : squat ? .552 : .872,-.029], squat ? .415 : .014);
  if (seated) seatFeet(pose);
  else stance(pose,squat ? .252 : .154,squat ? 0 : .051);
  const anchor = [0,.174,.949];
  const curlAngle = mix(seated ? 1.08 : .215, drag ? 1.94 : 2.47, t);
  const direction = [0,-Math.cos(curlAngle),Math.sin(curlAngle)];
  for (const [side, sign] of sides) {
    if (single && side !== "r") {
      restingArm(pose,side,sign);
      continue;
    }
    const elbow = add(pose[side + "s"],[sign * elbowOut,-.243,seated ? .114 : drag ? -.167 * t : -.005]);
    const wrist = add(elbow,scale(direction,.370));
    const width = single || rope ? Math.abs(wrist[0]) : widths[grip];
    arm(pose,side,[sign * width,wrist[1],wrist[2]],sub(elbow,pose[side + "s"]),
      reverse ? [-1,0,0] : lateral, reverse ? handFacing.over : handFacing.under);
  }
  if (rope) ropeCable(pose,anchor);
  else if (single) singleCable(pose,anchor,"r",pose.rGrip);
  else barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  return pose;
}

function preacherCurl(phase, {standing = false, rope = false} = {}) {
  const t = cycle(phase);
  const pose = torso([0,standing ? .865 : .567,-.038],standing ? .48 : .437);
  if (standing) stance(pose,.155,.085);
  else seatFeet(pose);
  for (const [side, sign] of sides) {
    if (standing && side === "l") {
      restingArm(pose,side,sign);
      continue;
    }
    const elbow = [sign * .210,standing ? 1.085 : .809,standing ? .345 : .318];
    const angle = mix(.71,2.69,t);
    const hand = add(elbow,[standing || rope ? 0 : sign * .115,-.343*Math.cos(angle),.344*Math.sin(angle)]);
    arm(pose,side,hand,sub(elbow,pose[side+"s"]),standing || !rope ? lateral : vertical,handFacing.under);
  }
  const anchor = [0,.164,.985];
  if (rope) ropeCable(pose,anchor);
  else if (standing) singleCable(pose,anchor,"r",lateral);
  else barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  return pose;
}

function tricepsPushdown(phase, grip = "straight", under = false) {
  const t = cycle(phase);
  const pose = torso([0,.873,-.013],.117);
  stance(pose,.16,.029);
  const angle = mix(Math.PI*.52,.07,t);
  const bentBar = grip === "pressV";
  const center = [0,pose.ls[1]-.239-.368*Math.cos(angle)+(bentBar?.046:0),pose.ls[2]+.035+.368*Math.sin(angle)];
  barHold(pose,center,grip,{l:[.12,-.81,-.35],r:[-.12,-.81,-.35]},under?"under":"over");
  barCable(pose,[0,2.042,.832],center);
  return pose;
}

function pullDownStraight(phase, variant = {}) {
  const {rope = false, hinge = .169, split = false, curl = false} = variant;
  const t = cycle(phase);
  const pose = torso([0,.862,-.025],hinge);
  stance(pose,.168,.04);
  const angle = mix(curl ? 2.45 : 2.58,.08,t);
  const anchor = [0,2.152,.962];
  const center = [0,pose.ls[1]-.605*Math.cos(angle),pose.ls[2]+.605*Math.sin(angle)+.009];
  if (rope) {
    for (const [side, sign] of sides) {
      const hands = curl ? blend([sign * .15,pose.ls[1]+.487,pose.ls[2]+.297],
        [sign*.146,pose.ls[1]-.08,pose.ls[2]+.214],t) : add(center,[sign * (split ? mix(.134,.264,t): .184),0,0]);
      arm(pose,side,hands,[sign*.19,curl ? -.54 : .11,-.92]);
    }
    ropeCable(pose,anchor);
  } else {
    barHold(pose,center,"medium",{l:[.14,.21,-.75],r:[-.14,.21,-.75]});
    barCable(pose,anchor,center);
  }
  return pose;
}

function highTriceps(phase, variant = {}) {
  const {floor = false, pullover = false, bend = .24} = variant;
  const t = cycle(phase);
  const pose = floor || pullover ? torso([0,pullover?.545:.129,.06],-Math.PI/2)
    : torso([0,.875,-.027],bend);
  if (floor || pullover) {
    for (const [side,sign] of sides) leg(pose,side,sign,[sign*.154,.068,pullover?.54:.684],[sign*.3,.9,.15]);
  } else stance(pose,.144,.171);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const elbow = add(shoulder, floor || pullover ? [sign*.021,.24,-.021] : [sign*.008,.232,.084]);
    if (pullover) {
      const angle = mix(.028,-Math.PI*.55,t);
      arm(pose,side,add(shoulder,[sign*.03,.609*Math.cos(angle),.609*Math.sin(angle)]),[sign*.45,-.25,.51]);
    } else {
      const angle = mix(-Math.PI*.72,.013,t);
      wristFromElbow(pose,side,elbow,[0,Math.cos(angle),Math.sin(angle)]);
    }
  }
  ropeCable(pose,[0,pullover?1.981:floor?.18:1.813,floor||pullover?-1.266:-.879]);
  return pose;
}

function kickback(phase, both = false) {
  const t = cycle(phase);
  const pose = torso([0,.814,-.031],1.078);
  stance(pose,.161,both?0:.134);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    if (!both && side === "l") {
      arm(pose,side,[.202,.569,.295],[.463,-.456,.289]);
      continue;
    }
    const elbow = add(shoulder,[sign*.021,-.059,-.239]);
    const angle = mix(.02,Math.PI*.47,t);
    wristFromElbow(pose,side,elbow,[0,-Math.cos(angle),-Math.sin(angle)],vertical);
  }
  if (both) dualCable(pose,[[.473,.512,.971],[-.473,.512,.971]]);
  else singleCable(pose,[0,.491,1.074],"r");
  return pose;
}

function kneelingConcentrationExtension(phase) {
  const t = cycle(phase);
  const pose = torso([0,.455,-.02],.521);
  pose.rk = [-.145,.421,.381];
  pose.ra = [-.151,.071,.595];
  pose.rt = [-.172,.008,.735];
  pose.lk = [.143,.092,.022];
  pose.la = [.154,.084,-.384];
  pose.lt = [.165,.015,-.528];
  pose.planted = {r:0};
  arm(pose,"l",[.179,.501,.276],[.621,.193,.19]);
  const angle = mix(2.24,.17,t);
  arm(pose,"r",[-.120,.475-.359*Math.cos(angle),.367+.359*Math.sin(angle)],[-.128,-.315,.92],vertical);
  singleCable(pose,[-.74,1.698,-.86],"r");
  return pose;
}

function hingeWithCable(phase, pullThrough = false, straightLegs = false) {
  const t = cycle(phase);
  const pose = torso([0,mix(straightLegs ? .834 : .753,.889,t),mix(straightLegs ? -.143 : -.235,-.025,t)],mix(1.113,.021,t));
  stance(pose,pullThrough?.243:.17,0,.101);
  for (const [side,sign] of sides) {
    const low = pullThrough ? [sign * .09,.452,.012] : [sign * .264,.41,.335];
    const high = pullThrough ? [sign * .10,.712,.196] : [sign * .264,.753,.228];
    arm(pose,side,blend(low,high,t),[sign*.323,.098,-.623]);
  }
  if (pullThrough) ropeCable(pose,[0,.176,-1.162]);
  else barCable(pose,[0,.174,1.034],midpoint(pose.lw,pose.rw));
  return pose;
}

function ankleMovement(phase, extension = false) {
  const t = cycle(phase);
  const side = extension?"r":"l";
  const pose = torso([-.034,.883,-.028],extension?.081:.021,0,.018);
  stance(pose,.138,0,.029);
  const ankle = extension ? [-.146,mix(.082,.307,t),mix(.061,-.55,t)]
    : [mix(.257,-.232,t),mix(.107,.187,t),mix(.061,.235,t)];
  leg(pose,side,extension?-1:1,ankle,extension?[-.057,-.12,1]:[.08,.03,1]);
  delete pose.planted[side];
  const holding = extension ? "l" : "r";
  const support = extension ? [.349,1.129,.315] : [-.46,1.129,.291];
  arm(pose,holding,support,[extension?.754:-.754,-.573,.07],vertical);
  restingArm(pose,side,extension?-1:1);
  pose.cables = [{anchor:extension?[0,.173,1.013]:[.867,.178,.18],
    end:pose[side+"a"],grip:vertical}];
  return pose;
}

function calfRaise(phase, step = false) {
  const t = cycle(phase);
  const height = step?.126:0;
  const pose = torso([0,.870+height+.050*t,.012],.034);
  for (const [side,sign] of sides) {
    if (step && side==="l") {
      leg(pose,side,sign,[.125,.349,-.286],[.141,0,1]);
      delete pose.planted[side];
      restingArm(pose,side,sign);
    } else {
      leg(pose,side,sign,[step?.003:sign*.148,height+.065+.041*t,-.106+.054*t],[sign*.066,.06,1],
        [sign*.012,-.065-.065*t,.172-.048*t]);
      pose.planted[side]=height;
      arm(pose,side,[step?-.216:sign*.177,pose.hips[1]-.101,.326],[sign*.38,-.46,-.75],step?vertical:lateral);
    }
  }
  if (step) singleCable(pose,[-.317,.173,.998],"r");
  else barCable(pose,[0,.17,.998],midpoint(pose.lw,pose.rw));
  return pose;
}

function cableCrunch(phase, mode) {
  const t = cycle(phase);
  const side = mode === "side";
  const seat = mode === "seat";
  const pitch = side ? .02 : mix(.028,seat?.823:1.075,t);
  const pose = torso([0,side?.881:seat?.565:.481,-.05],pitch,0,side?mix(0,.49,t):0);
  if (side) stance(pose,.177);
  else if (seat) seatFeet(pose);
  else kneel(pose);
  for (const [limb,sign] of sides) {
    if (side && limb === "r") {
      arm(pose,limb,[-.174,pose.hips[1]+.07,.048],[-.925,-.52,-.02]);
      continue;
    }
    const ear = add(pose.head,[sign*.128,-.058,seat?-.104:.026]);
    arm(pose,limb,ear,[sign*.68,-.272,.91],vertical);
  }
  if (side) singleCable(pose,[.841,1.957,.165],"l");
  else ropeCable(pose,[0,2.058,seat?-.94:1.142]);
  return pose;
}

function squatRow(phase) {
  const t = cycle(phase);
  const pose = torso([0,mix(.555,.877,t),mix(-.233,-.037,t)],mix(.463,.05,t));
  stance(pose,.213,.009,.072);
  for (const [side,sign] of sides) {
    const start = add(pose[side+"s"],[-sign*.076,-.174,.558]);
    const end = add(pose[side+"s"],[sign*.012,-.252,.193]);
    arm(pose,side,blend(start,end,t),[sign*.463,-.607,-.409]);
  }
  ropeCable(pose,[0,.172,1.141]);
  return pose;
}

function alternateShoulderPress(phase) {
  const pose = torso([0,.875,-.018],.028);
  stance(pose,.18,.057);
  for (const [side,sign] of sides) {
    const t = alternating(phase, sign);
    const hand = [sign*mix(.358,.243,t),mix(1.36,1.938,t),mix(.171,.089,t)];
    arm(pose,side,hand,[sign*.944,-.478,.187],lateral,handFacing.over);
  }
  dualCable(pose,[[.663,.174,-.49],[-.663,.174,-.49]]);
  return pose;
}

function lyingBench(variant) {
  const incl = variant === "incline";
  const decline = variant === "decline";
  const prone = variant === "prone";
  const pose = torso([0,decline?.644:incl?.572:.558,incl||decline?.216:.036],
    incl?-.765:decline?-1.934:prone?Math.PI/2:-Math.PI/2);
  for (const [side,sign] of sides) {
    const ankle = prone ? [sign*.132,.089,-.69] : [sign*.189,.069,incl||decline?.568:.543];
    leg(pose,side,sign,ankle,[sign*.48,prone?-.373:.805,prone?-.31:.04]);
  }
  return pose;
}

function pressWithCables(phase, variant) {
  const t = cycle(phase);
  const seated = variant === "seat";
  const standing = variant.startsWith("stand");
  const upright = seated || standing;
  const narrow = variant === "stand-narrow";
  const incl = variant === "incline";
  const pose = standing ? torso([0,.846,.026],.179) : seated ? torso([0,.573,-.012],-.031) : lyingBench(variant);
  if (seated) seatFeet(pose);
  if (standing) stance(pose,.159,.239);
  for (const [side,sign] of sides) {
    const shoulder = pose[side+"s"];
    const start = add(shoulder,[sign*(narrow ? -.050 : .161),upright?-.058:.108,upright?.166:incl?.126:.067]);
    const end = add(shoulder,[-sign*(narrow ? .115 : .064),upright?.021:incl?.447:.591,upright?.593:incl?.378:.125]);
    arm(pose,side,blend(start,end,t),[sign*(narrow ? .21 : .88),upright?-.53:-.98,upright?-.52:.04],lateral,handFacing.over);
  }
  dualCable(pose,[[.761,standing?1.288:seated?1.020:.20,upright?-.438:-.34],[-.761,standing?1.288:seated?1.020:.20,upright?-.438:-.34]]);
  return pose;
}

function crossCableFly(phase, mode) {
  const t = cycle(phase);
  const reverse = mode === "reverse";
  const low = mode === "low";
  const crossed = low || mode === "upright";
  const seated = mode === "seated-reverse";
  const neutralGrip = mode === "neutral";
  const ball = mode === "ball";
  const one = ball;
  const pose = torso([0,seated?.566:ball?.601:.877,-.018],mode==="middle"?.235:.052);
  if (seated || ball) seatFeet(pose);
  else stance(pose, .173, (mode === "middle" || neutralGrip) ? .14 : .06, .03);
  if (ball) pose.ballCenter = [0,.285,-.037];
  for (const [side,sign] of sides) {
    if (ball && side === "l") {
      arm(pose,side,[.188,.59,.235],[.628,-.521,.106]);
      continue;
    }
    const shoulder = pose[side+"s"];
    const from = add(shoulder,[sign*(low?.377:.569),low?-.438:-.058,low?-.11:-.069]);
    const to = add(shoulder,[-sign*(crossed?.294:one?.325:.134),low?.201:crossed?sign*.062:-.014,.556]);
    const open = reverse || seated ? t : 1-t;
    const direction = blend(unit(sub(to,shoulder)),unit(sub(from,shoulder)),open);
    arm(pose,side,add(shoulder,scale(unit(direction),low?.571:.587)),
      [sign*.353,-.710,-.414],ball || neutralGrip ? vertical : lateral,handFacing.over);
  }
  if (ball) singleCable(pose,[-.978,1.051,-.043],"r");
  else {
    const y = reverse ? 1.912 : low ? .176 : seated ? 1.135 : 1.261;
    if (reverse || seated) dualCable(pose,[[-.889,y,.319],[.889,y,.319]]);
    else dualCable(pose,[[.976,y,-.24],[-.976,y,-.24]]);
  }
  return pose;
}

function benchFly(phase, variant) {
  const t = cycle(phase);
  const prone = variant === "prone";
  const decline = variant === "decline";
  const pose = lyingBench(variant);
  for (const [side,sign] of sides) {
    const shoulder = pose[side+"s"];
    if (decline && side==="l") {
      arm(pose,side,[.125,.70,.18],[.42,-.38,.79]);
      continue;
    }
    const angle = mix(1.51,.26,t);
    const hand = prone ? add(shoulder,[sign*.589*Math.cos(angle),-.566*Math.sin(angle),mix(.258,.083,t)])
      : add(shoulder,[sign*.576*Math.sin(angle),.57*Math.cos(angle),decline?.118:.109]);
    arm(pose,side,hand,[sign*.749,-.427,prone?.208:.66],prone ? lateral : forward);
  }
  const z = prone?.473:-.518;
  if (decline) singleCable(pose,[-.904,.173,z],"r",forward);
  else dualCable(pose,[[.830,.194,z],[-.830,.194,z]]);
  return pose;
}

function concentrateCurl(phase) {
  const t = cycle(phase);
  const pose = torso([0,.57,-.066],1.054);
  for (const [side,sign] of sides) {
    pose[side+"k"] = [sign*.286,.524,.325];
    pose[side+"a"] = [sign*.302,.073,.449];
    pose[side+"t"] = [sign*.349,.012,.581];
  }
  arm(pose,"l",[.249,.595,.347],[.499,-.524,-.308]);
  const elbow = [-.204,.524,.267];
  const angle = mix(.306,2.73,t);
  wristFromElbow(pose,"r",elbow,[.13,-Math.cos(angle),Math.sin(angle)],lateral,handFacing.under);
  singleCable(pose,[-.119,.174,.992],"r",lateral);
  return pose;
}

function recumbentArmCurl(phase, incline) {
  const t = cycle(phase);
  const pose = lyingBench(incline ? "incline" : "flat");
  for (const [side,sign] of sides) {
    const shoulder = pose[side+"s"];
    const elbow = add(shoulder,[sign*(incline?.025:.072),incline?-.211:.015,incline?.119:.245]);
    const angle = mix(.067,2.393,t);
    wristFromElbow(pose,side,elbow,incline ? [0,-Math.cos(angle),Math.sin(angle)] :
      [0,Math.sin(angle),Math.cos(angle)],lateral,handFacing.under);
  }
  if (incline) dualCable(pose,[[.612,.169,-.80],[-.612,.169,-.80]]);
  else barCable(pose,[0,.181,1.181],midpoint(pose.lw,pose.rw));
  return pose;
}

function ballOverheadCurl(phase) {
  const t = cycle(phase);
  const pose = torso([0,.608,-.045],-.036);
  seatFeet(pose);
  pose.ballCenter = [0,.285,-.043];
  const angle = mix(.09,1.80,t);
  for (const [side,sign] of sides) {
    const elbow = add(pose[side+"s"],[sign*.072,.231,.071]);
    wristFromElbow(pose,side,elbow,[0,Math.cos(angle),Math.sin(angle)],lateral,handFacing.under);
  }
  barCable(pose,[0,1.983,.821],midpoint(pose.lw,pose.rw));
  return pose;
}

function reverseWristCurl(phase) {
  const t = cycle(phase);
  const pose = torso([0,.566,-.046],1.116);
  seatFeet(pose);
  const swivel = mix(-.45,.70,t);
  for (const [side,sign] of sides) {
    const elbow = [sign*.176,.552,.243];
    wristFromElbow(pose,side,elbow,[0,-.02,.999],lateral,[0,-Math.cos(swivel),Math.sin(swivel)]);
    pose[side+"w"][1] += .022*Math.sin(swivel);
  }
  barCable(pose,[0,.180,1.022],midpoint(pose.lw,pose.rw));
  return pose;
}

function cableShrug(phase) {
  const t = cycle(phase);
  const pose = torso([0,.877,-.024],.035);
  stance(pose,.165);
  for (const [side,sign] of sides) {
    pose[side+"s"][1] += .097*t;
    const shoulder = pose[side+"s"];
    arm(pose,side,[sign*.264,shoulder[1]-.587,.149],[sign*.313,-.19,-.685],lateral,handFacing.over);
  }
  barCable(pose,[0,.171,.909],midpoint(pose.lw,pose.rw));
  return pose;
}

function cableTuck(phase) {
  const t = cycle(phase);
  const pose = torso([0,mix(.142,.28,t),mix(.024,-.131,t)],mix(-1.57,-1.82,t));
  pose.planted = {};
  for (const [side,sign] of sides) {
    leg(pose,side,sign,[sign*.143,mix(.15,.43,t),mix(.785,.289,t)],[sign*.11,.91,.19]);
    arm(pose,side,[sign*.332,.097,-.262],[sign*.73,-.382,-.361],lateral);
  }
  pose.cables=sides.map(([side])=>({anchor:[0,.175,1.26],end:pose[side+"a"],grip:unit(sub(pose[side+"k"],pose[side+"a"]))}));
  return pose;
}

function floorRopeRow(phase) {
  const t = cycle(phase);
  const pose = torso([0, .139, -.028], mix(.078, .006, t));
  for (const [side, sign] of sides) {
    leg(pose, side, sign, [sign * .156, .07, .786], [sign * .11, .98, .06]);
    const hand = [sign * mix(.106, .213, t), mix(.466, .512, t), mix(.552, .186, t)];
    arm(pose, side, hand, [sign * .49, -.30, -.80]);
  }
  ropeCable(pose, [0, .163, 1.28]);
  return pose;
}

function rearAnchorFrontRaise(phase, single = false, neutral = false) {
  const t = cycle(phase);
  const angle = mix(.05, Math.PI / 2, t);
  const pose = torso([0, .875, .03], .019);
  stance(pose, .176, .025);
  for (const [side, sign] of sides) {
    if (single && side === "l") {
      restingArm(pose, side, sign);
      continue;
    }
    const shoulder = pose[side + "s"];
    const hand = [sign * (single ? .228 : mix(.119, .177, t)),
      shoulder[1] - .591 * Math.cos(angle), shoulder[2] + .589 * Math.sin(angle)];
    const grip = neutral ? unit([0, Math.cos(angle), Math.sin(angle)]) : lateral;
    arm(pose, side, hand, [sign * .31, -.85, .17], grip, neutral ? undefined : handFacing.over);
  }
  if (single) singleCable(pose, [-.276, .164, -.912], "r", pose.rGrip);
  else ropeCable(pose, [0, .162, -.942]);
  return pose;
}

function oneArmPushdown(phase, { sideOn = false, stagger = .041, handOnHip = false } = {}) {
  const t = cycle(phase);
  const pose = torso([0, .873, -.042], .098);
  stance(pose, .162, stagger);
  if (handOnHip) arm(pose, "l", [.178, .918, -.019], [.95, -.284, -.162], vertical);
  else restingArm(pose, "l", 1);
  const elbow = add(pose.rs, [-.027, -.242, .041]);
  const angle = mix(1.86, .086, t);
  wristFromElbow(pose, "r", elbow, [0, -Math.cos(angle), Math.sin(angle)], lateral, handFacing.over);
  singleCable(pose, sideOn ? [-.941, 2.047, .149] : [-.191, 2.047, .863], "r", lateral);
  return pose;
}

function lyingRopeExtension(phase, { bar = false, start = -1.46 } = {}) {
  const t = cycle(phase);
  const angle = mix(start, .093, t);
  const pose = lyingBench("flat");
  for (const [side, sign] of sides) {
    const elbow = add(pose[side + "s"], [sign * (bar ? -.016 : .011), .243, -.055]);
    wristFromElbow(pose, side, elbow, [bar ? 0 : sign * mix(.012, .165, t), Math.cos(angle), Math.sin(angle)], lateral, handFacing.over);
  }
  const anchor = [0, .17, -1.406];
  if (bar) barCable(pose, anchor, midpoint(pose.lw, pose.rw));
  else ropeCable(pose, anchor);
  return pose;
}

function seatedRopeFacePull(phase) {
  const t = cycle(phase);
  const pose = torso([0, .565, -.03], -.031);
  seatFeet(pose);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const hand = [sign * mix(.104, .241, t), shoulder[1] + mix(-.030, .142, t),
      shoulder[2] + mix(.558, .107, t)];
    arm(pose, side, hand, [sign * .92, .065, -.84]);
  }
  ropeCable(pose, [0, 1.171, 1.169]);
  return pose;
}

function cableDeclineFly(phase, cross = false) {
  const t = cycle(phase);
  const pose = torso([0, .865, .018], .097);
  stance(pose, .172, .102);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const open = [sign * .981, .064, -.184];
    const closed = [-sign * (cross ? .427 : .286), cross ? -.482 : -.534, .796];
    const hand = add(shoulder, scale(unit(blend(open, closed, t)), .575));
    if (cross) hand[1] += sign * .039 * t;
    arm(pose, side, hand, [sign * .39, -.89, -.08], vertical, handFacing.over);
  }
  dualCable(pose, [[.983, 1.986, -.421], [-.983, 1.986, -.421]]);
  return pose;
}

function lowReverseCableFly(phase) {
  const t = cycle(phase);
  const pose = torso([0, .810, -.015], .934);
  stance(pose, .195);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const open = [sign * .981, .036, -.172];
    const closed = [-sign * .358, -.927, .113];
    const hand = add(shoulder, scale(unit(blend(closed, open, t)), .568));
    arm(pose, side, hand, [sign * .48, -.69, .42], vertical);
  }
  dualCable(pose, [[-.898, .169, .501], [.898, .169, .501]]);
  return pose;
}

function directionalSinglePull(phase, position, towardHip = false) {
  const t = cycle(phase);
  const pose = torso([0, position === "seat" ? .567 : position === "kneel" ? .485 : .875, -.025], -.069);
  if (position === "seat") seatFeet(pose, "lat");
  else if (position === "kneel") kneel(pose);
  else stance(pose, .167, .072);
  const shoulder = pose.rs;
  const highRow = position === "stand";
  const start = add(shoulder, [-.073, highRow ? .25 : .519, highRow ? .516 : .318]);
  const end = add(shoulder, [-.084, towardHip ? -.173 : -.074, .155]);
  arm(pose, "r", blend(start, end, t), [-.61, -.96, -.24], lateral);
  restingArm(pose, "l", 1);
  singleCable(pose, [-.21, highRow ? 1.923 : 2.245, highRow ? 1.13 : .799], "r", lateral);
  return pose;
}

function dualCableFrontRaise(phase) {
  const t = cycle(phase);
  const pose = torso([0, .879, .073], .027);
  stance(pose, .164, .043);
  const angle = mix(-.078, Math.PI / 2, t);
  for (const [side, sign] of sides) {
    const hand = add(pose[side + "s"], [sign * mix(.045, -.019, t), -.588 * Math.cos(angle), .59 * Math.sin(angle)]);
    arm(pose, side, hand, [sign * .28, -.82, .18], lateral, handFacing.over);
  }
  dualCable(pose, [[.721, .173, -.891], [-.721, .173, -.891]]);
  return pose;
}

function floorCableCurl(phase, towardMachine) {
  const t = cycle(phase);
  const pose = torso([0, .141, .025], -Math.PI / 2);
  for (const [side, sign] of sides) {
    leg(pose, side, sign, [sign * .135, .066, .681], [sign * .087, .91, .045]);
    const shoulder = pose[side + "s"];
    const elbow = add(shoulder, [sign * -.016, towardMachine ? .112 : .129, towardMachine ? .209 : -.194]);
    const angle = towardMachine ? mix(.067, 2.36, t) : mix(.049, 1.835, t);
    wristFromElbow(pose, side, elbow, [0, Math.sin(angle), (towardMachine ? 1 : -1) * Math.cos(angle)], lateral, handFacing.under);
  }
  barCable(pose,[0, .181, towardMachine ? 1.221 : -1.382],midpoint(pose.lw,pose.rw));
  return pose;
}

function bentCableRow(phase, grip) {
  const t = cycle(phase);
  const pose = torso([0, .796, -.078], 1.27);
  stance(pose, .174, .025);
  const center = blend([0, .517, .668], [0, .802, .304], t);
  const anchor = [0, .183, 1.168];
  const poles = {l: [.78, -.04, -.96], r: [-.78, -.04, -.96]};
  if (grip === "rope") {
    for (const [side, sign] of sides) {
      arm(pose, side, add(center, [sign * mix(.106, .219, t), .037 * t, 0]), poles[side]);
    }
    ropeCable(pose, anchor);
  } else {
    barHold(pose, center, "medium", poles, grip === "under" ? "under" : "over");
    barCable(pose, anchor, center);
  }
  return pose;
}

function sideOverheadArms(phase, movement) {
  const t = cycle(phase);
  const seated = movement === "seated-curl";
  const extend = movement === "extension";
  const pose = torso([0, seated ? .565 : .877, -.035], .021);
  if (seated) seatFeet(pose);
  else stance(pose, .163, .062);
  const cables = [];
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    const elbow = add(shoulder, [sign * (extend ? .201 : .243), extend ? .142 : .043, .018]);
    const angle = extend ? mix(2.29, .63, t) : mix(.155, 2.72, t);
    const direction = [sign * Math.cos(angle), Math.sin(angle), extend ? -.051 : .138 * t];
    const grip = [0, 0, 1];
    wristFromElbow(pose, side, elbow, direction, grip, extend ? handFacing.over : handFacing.under);
    cables.push({anchor: [sign * .974, extend ? 1.168 : shoulder[1] + .168, .079], end: pose[side + "w"], grip});
  }
  pose.cables = cables;
  return pose;
}

function kneelingOverheadExtension(phase) {
  const t = cycle(phase);
  const pose = torso([0, .345, -.115], .145);
  kneel(pose);
  const angle = mix(-1.46, .328, t);
  for (const [side, sign] of sides) {
    const elbow = add(pose[side + "s"], [sign * -.016, .235, .075]);
    wristFromElbow(pose, side, elbow, [0, Math.cos(angle), Math.sin(angle)], lateral, handFacing.over);
  }
  barCable(pose, [0,.18,-.941], midpoint(pose.lw, pose.rw));
  return pose;
}

function wideScapularPulldown(phase) {
  const t = cycle(phase);
  const pose = torso([0,.567,-.017], -.081);
  seatFeet(pose,"lat");
  for (const [side] of sides) pose[side+"s"][1] -= .051*t;
  const center = [0, mix(1.572,1.521,t), .214];
  barHold(pose,center,"wide",{l:[.34,-.21,-.88],r:[-.34,-.21,-.88]});
  barCable(pose,[0,2.267,.249],center);
  return pose;
}

function shoulderRotation(phase, { external = false, raised = false, floor = false } = {}) {
  const t = cycle(phase);
  const pose = torso([0, floor ? .139 : .876, -.025], .035);
  if (floor) {
    for (const [side, sign] of sides) leg(pose, side, sign, [sign*.123,.070,.796], [sign*.07,.96,.009]);
  } else stance(pose, .155);
  const side = "r";
  const shoulder = pose.rs;
  const elbow = add(shoulder, raised ? [-.244, -.023, .003] : [-.038, -.243, .024]);
  const angle = external ? mix(.05, 1.48, t) : mix(1.31, -.95, t);
  const direction = raised ? [0, Math.sin(angle), Math.cos(angle)] : [-Math.sin(angle), .014, Math.cos(angle)];
  const grip = raised ? unit([0, Math.cos(angle), -Math.sin(angle)]) : vertical;
  wristFromElbow(pose, side, elbow, direction, grip);
  if (floor) arm(pose,"l",[.189,.167,.30],[.43,-.92,-.25]);
  else restingArm(pose, "l", 1);
  const anchor = raised && !external ? [-.49, elbow[1], -.96] : [external ? .939 : -.938, elbow[1], .167];
  singleCable(pose, anchor, side, grip);
  return pose;
}

function highRopeCurl(phase) {
  const t = cycle(phase);
  const pose = torso([0, .866, -.018], .029);
  stance(pose, .16, .181);
  const angle = mix(.647, 2.675, t);
  for (const [side, sign] of sides) {
    const elbow = add(pose[side + "s"], [sign*.085, .118, .203]);
    wristFromElbow(pose, side, elbow, [sign*.08, Math.sin(angle), Math.cos(angle)], lateral, handFacing.under);
  }
  ropeCable(pose, [0,2.16,1.091]);
  return pose;
}

function cableScapula(phase, mode) {
  const t = cycle(phase, .37, .61);
  const high = mode === "high";
  const low = mode === "low";
  const standing = high || low;
  const shrug = mode === "seated-shrug";
  const pose = torso([0, standing ? .872 : shrug ? .567 : .435, -.018], low ? .198 : .018);
  if (standing) stance(pose, .155, .051);
  else seatFeet(pose, shrug ? "seat" : "row");
  for (const [side, sign] of sides) {
    if (standing && side === "l") {
      restingArm(pose, side, sign);
      continue;
    }
    const shoulder = pose[side + "s"];
    shoulder[1] += (high ? -.059 : shrug ? .063 : .018) * t;
    shoulder[2] -= (high ? .043 : .081) * t;
    const direction = unit([0, high ? .64 : low ? -.44 : -.285, 1]);
    const wrist = add(shoulder, scale(direction, .603));
    arm(pose, side, wrist, [sign * .47, -.49, -.75], standing || shrug ? vertical : lateral);
  }
  if (standing) singleCable(pose, [-.217, high ? 1.985 : .174, 1.103], "r");
  else if (shrug) dualCable(pose, [[.242,.186,1.126],[-.242,.186,1.126]]);
  else barCable(pose, [0,.187,1.095], midpoint(pose.lw,pose.rw));
  return pose;
}

function alternatingLowFly(phase) {
  const pose = torso([0,.866,-.017], .134);
  stance(pose,.165,.171);
  for (const [side, sign] of sides) {
    const t = alternating(phase, sign);
    const shoulder = pose[side+"s"];
    const direction = unit(blend([sign*.76,-.724,-.058], [-sign*.34,.078,.96], t));
    arm(pose, side, add(shoulder,scale(direction,.588)), [sign*.40,-.72,-.39],vertical);
  }
  dualCable(pose, [[.903,.172,-.466],[-.903,.172,-.466]]);
  return pose;
}

function oneArmCableFly(phase) {
  const t = cycle(phase);
  const pose = torso([0,.862,.029], .046, -.11);
  stance(pose, .155, -.187);
  const direction = unit(blend([-.873,-.038,-.28],[.62,-.097,.83],t));
  arm(pose,"r",add(pose.rs,scale(direction,.571)),[-.26,-.98,-.10],vertical);
  restingArm(pose,"l",1);
  singleCable(pose,[-.97,1.336,-.241],"r");
  return pose;
}

const standingCamera = { yaw: 63, elevation: 12, focus: [0, .96, .27], height: 2.25 };
const rowCamera = { yaw: 61, elevation: 12, focus: [0, .86, .49], height: 2.28 };
const latCamera = { yaw: 59, elevation: 11, focus: [0, 1.14, .35], height: 2.65 };
const latBackCamera = { yaw: 145, elevation: 10, focus: [0, 1.12, .13], height: 2.61 };
const latMuscles = ["lat", "biceps"];

const jobs = [
  ["1047","cable-lat-narrow", (p) => latPulldown(p,{grip:"narrow"}), latMuscles, latCamera],
  ["2291","cable-lat-wide", (p) => latPulldown(p,{}), latMuscles, latCamera],
  ["0150","cable-lat-straight", (p) => latPulldown(p,{grip:"straight"}), latMuscles, {...latCamera,yaw:66}],
  ["2330","cable-lat-wide", (p) => latPulldown(p,{full:true}), latMuscles, latCamera],
  ["2616","cable-lat-neutral", (p) => latPulldown(p,{grip:"v"}), latMuscles, {...latCamera,yaw:41}],
  ["0197","cable-lat-pro", (p) => latPulldown(p,{grip:"pro"}), latMuscles, {...latCamera,yaw:47}],
  ["0245","cable-lat-medium", (p) => latPulldown(p,{grip:"medium",under:true}), latMuscles, {...latCamera,yaw:51}],
  ["0205","cable-lat-medium", (p) => latPulldown(p,{grip:"medium",rear:true}), latMuscles, latBackCamera],
  ["1325","cable-lat-wide", (p) => latPulldown(p,{rear:true}), latMuscles, {...latBackCamera,yaw:138}],
  ["2544","cable-lat-wide", (p) => latPulldown(p,{rear:true}), latMuscles, {...latBackCamera,yaw:119}],
  ["0177","cable-lat-rope", ropeLatPulldown, latMuscles, {...latCamera,yaw:46}],
  ["0007","cable-lat-dual", (p) => independentLat(p), latMuscles, {...latCamera,yaw:26,height:2.78}],
  ["0153","dual-cable", (p) => independentLat(p,true), latMuscles, {...latCamera,yaw:26,height:2.78}],
  ["3563","cable", oneArmLat, ["r:lat","r:biceps"], {...standingCamera,height:2.59}],
  ["0167","cable-straight-bar", kneelingHighRow, ["rearShoulder","lat"], {...rowCamera,focus:[0,.94,.49],height:2.44}],
  ["0159","cable-decline-row",(p) => seatedRow(p,{mode:"decline-row",grip:"wide"}), ["rearShoulder","lat"], rowCamera],
  ["0160","cable-floor-row",(p) => seatedRow(p,{mode:"floor-row",grip:"wide",anchorY:.175}), ["rearShoulder","lat"], rowCamera],
  ["0180","cable-row-bar",(p) => seatedRow(p,{}), latMuscles, rowCamera],
  ["0218","cable-row-wide",(p) => seatedRow(p,{grip:"wide"}), ["rearShoulder","lat"], {...rowCamera,yaw:39}],
  ["0239","cable-row-bar",(p) => seatedRow(p,{}), latMuscles, {...rowCamera,yaw:66}],
  ["0208","cable-seated-bar",(p) => seatedRow(p,{mode:"seat",under:true,high:true,anchorY:1.876}), latMuscles, {...rowCamera,focus:[0,1.06,.49]}],
  ["0213","cable-seated-v",(p) => seatedRow(p,{mode:"seat",grip:"v",high:true,anchorY:1.876}), latMuscles, {...rowCamera,yaw:46,focus:[0,1.06,.49]}],
  ["1320","cable-row-rope",(p) => seatedRow(p,{grip:"rope",crossover:true}), ["lat","rearShoulder"], {...rowCamera,yaw:48}],
  ["1321","cable-elevated-row",(p) => seatedRow(p,{grip:"rope",mode:"high-row",anchorY:.47}), latMuscles, {...rowCamera,yaw:57}],
  ["1323","cable-row-rope",(p) => seatedRow(p,{grip:"rope"}), latMuscles, rowCamera],
  ["0234","cable-v-bar",(p) => standingRow(p,{}), latMuscles, standingCamera],
  ["0236","cable-v-bar",(p) => standingRow(p,{twist:true}), ["lat","core"], {...standingCamera,yaw:-22}],
  ["1324","cable-medium-bar",(p) => standingRow(p,{grip:"medium",high:true}), ["rearShoulder","lat"], {...standingCamera,yaw:54}],
  ["0246","cable-short-bar",(p) => standingRow(p,{grip:"narrow",upright:true}), ["shoulder","trap"], {...standingCamera,yaw:36}],
  ["0189","cable",(p) => oneArmRow(p,{hinge:true}), ["r:lat","r:biceps"], {...standingCamera,yaw:58}],
  ["0193","cable",(p) => oneArmRow(p,{onKnees:true}), ["r:lat","r:biceps"], {...standingCamera,yaw:64}],
  ["1319","cable",(p) => oneArmRow(p,{turn:true}), ["r:lat","r:biceps"], {...standingCamera,yaw:53}],
  ["0202","cable",(p) => oneArmRow(p,{facePull:true}), ["l:rearShoulder","l:lat"], {...standingCamera,yaw:-56}],
  ["0203","rope",(p) => ropeFaceRow(p,{low:true}), ["rearShoulder","trap"], {...standingCamera,yaw:45}],
  ["0233","rope",(p) => ropeFaceRow(p,{chest:true}), ["rearShoulder","lat"], {...standingCamera,yaw:63}],
  ["3697","rope",(p) => ropeFaceRow(p,{kneeling:true}), ["rearShoulder","trap"], {...standingCamera,yaw:57}],
  ["1318","cable-supported-row",(p) => chestSupportRow(p), latMuscles, {...rowCamera,yaw:26,elevation:17,focus:[0,.89,.41],height:2.53}],
  ["1322","cable-supported-rope-row",(p) => chestSupportRow(p,true), latMuscles, rowCamera],
  ["0161","cable-short-bar",(p) => cableRaise(p), ["shoulder"], standingCamera],
  ["0162","cable-short-bar",(p) => cableRaise(p), ["shoulder"], {...standingCamera,yaw:53}],
  ["0164","cable-short-bar",(p) => cableRaise(p), ["shoulder"], {...standingCamera,yaw:67}],
  ["0191","cable",(p) => cableRaise(p,{single:true,hinge:true}), ["r:rearShoulder"], {...standingCamera,yaw:-34,focus:[.225,1.08,.13],height:2.56}],
  ["0192","cable",(p) => cableRaise(p,{single:true,lateralRaise:true}), ["r:shoulder"], {...standingCamera,yaw:15}],
  ["1630","cable-short-bar",(p) => bicepsCurl(p,{grip:"narrow"}), ["biceps"], {...standingCamera,yaw:41}],
  ["0868","cable-straight-bar",(p) => bicepsCurl(p), ["biceps"], {...standingCamera,yaw:41}],
  ["1632","cable-straight-bar",(p) => bicepsCurl(p,{drag:true}), ["biceps"], {...standingCamera,yaw:60}],
  ["0165","rope",(p) => bicepsCurl(p,{rope:true}), ["biceps","forearm"], {...standingCamera,yaw:41}],
  ["0190","cable",(p) => bicepsCurl(p,{single:true}), ["r:biceps"], {...standingCamera,yaw:54}],
  ["1413","cable",(p) => bicepsCurl(p,{single:true,reverse:true}), ["r:forearm","r:biceps"], {...standingCamera,yaw:58}],
  ["1641","cable-seated-bar",(p) => bicepsCurl(p,{position:"seat"}), ["biceps"], {...standingCamera,yaw:53}],
  ["1644","cable-straight-bar",(p) => bicepsCurl(p,{position:"squat"}), ["biceps"], {...standingCamera,yaw:58}],
  ["1633","cable-standing-preacher",(p) => preacherCurl(p,{standing:true}), ["r:biceps"], {...standingCamera,yaw:62}],
  ["0195","cable-preacher-bar",(p) => preacherCurl(p), ["biceps"], {...standingCamera,yaw:49}],
  ["1639","cable-preacher-rope",(p) => preacherCurl(p,{rope:true}), ["biceps","forearm"], {...standingCamera,yaw:64}],
  ["0201","cable-medium-bar",(p) => tricepsPushdown(p,"medium"),["triceps"], {...standingCamera,yaw:49}],
  ["0207","cable-medium-bar",(p) => tricepsPushdown(p,"medium",true),["triceps"], {...standingCamera,yaw:50}],
  ["2249","cable-v-press-bar",(p) => tricepsPushdown(p,"pressV"),["triceps"], {...standingCamera,yaw:39}],
  ["0241","cable-v-press-bar",(p) => tricepsPushdown(p,"pressV"),["triceps"], {...standingCamera,yaw:55}],
  ["0199","cable-medium-bar",(p) => pullDownStraight(p,{hinge:.057}),["lat"], {...standingCamera,yaw:54}],
  ["0238","cable-medium-bar",(p) => pullDownStraight(p,{}),["lat"], {...standingCamera,yaw:62}],
  ["8297","rope",(p) => pullDownStraight(p,{rope:true,split:true}),["lat"], {...standingCamera,yaw:55}],
  ["0237","rope",(p) => pullDownStraight(p,{rope:true}),["lat"], {...standingCamera,yaw:63}],
  ["0232","rope",(p) => pullDownStraight(p,{rope:true,curl:true}),latMuscles, {...standingCamera,yaw:62}],
  ["0194","rope",(p) => highTriceps(p),["triceps"], {...standingCamera,yaw:-56,focus:[0,1.05,-.40],height:2.53}],
  ["1724","rope",(p) => highTriceps(p,{bend:.12}),["triceps"], {...standingCamera,yaw:56,focus:[0,1.05,-.40],height:2.53}],
  ["1726","rope",(p) => highTriceps(p,{floor:true}),["triceps"], {...standingCamera,yaw:73,focus:[0,.65,-.36],height:2.16}],
  ["0184","cable-flat-bench-rope",(p) => highTriceps(p,{pullover:true}),["lat","pec"], {...standingCamera,yaw:68,focus:[0,.99,-.34],height:2.48}],
  ["0860","cable",(p) => kickback(p),["r:triceps"], {...standingCamera,yaw:-65}],
  ["1728","dual-cable",(p) => kickback(p,true),["triceps"], {...standingCamera,yaw:63}],
  ["0152","cable",kneelingConcentrationExtension,["r:triceps"], {...standingCamera,yaw:-59,focus:[0,.86,-.1],height:2.20}],
  ["0157","cable-medium-bar",(p) => hingeWithCable(p),["glute","hamstring"], {...standingCamera,yaw:63}],
  ["0196","rope",(p) => hingeWithCable(p,true),["glute","hamstring"], {...standingCamera,yaw:79,focus:[0,.91,-.31]}],
  ["0168","cable-ankle",(p) => ankleMovement(p),["l:quad"], {...standingCamera,yaw:-21}],
  ["0228","cable-ankle-extension",(p) => ankleMovement(p,true),["r:glute","r:hamstring"], {...standingCamera,yaw:-69}],
  ["1375","cable-short-bar",(p) => calfRaise(p),["calf"], {...standingCamera,yaw:67}],
  ["1376","cable-calf-step",(p) => calfRaise(p,true),["r:calf"], {...standingCamera,yaw:-68}],
  ["0175","rope",(p) => cableCrunch(p,"kneeling"),["core"], {...standingCamera,yaw:66}],
  ["0212","cable-seated-rope",(p) => cableCrunch(p,"seat"),["core"], {...standingCamera,yaw:62,focus:[0,.98,-.24]}],
  ["0223","cable",(p) => cableCrunch(p,"side"),["l:core"], {...standingCamera,yaw:-13}],
  ["1717","rope",squatRow,latMuscles, {...standingCamera,yaw:60}],
  ["0148","dual-cable",alternateShoulderPress,["shoulder","triceps"],{...standingCamera,yaw:21,height:2.4}],
  ["0151","cable-flat-bench",(p) => pressWithCables(p,"flat"),["pec","triceps"],{...standingCamera,yaw:37,focus:[0,.73,-.19]}],
  ["0169","cable-incline-bench",(p) => pressWithCables(p,"incline"),["pec","triceps"],{...standingCamera,yaw:37,focus:[0,.86,-.19]}],
  ["2144","cable-seated-dual",(p) => pressWithCables(p,"seat"),["pec","triceps"],{...standingCamera,yaw:32,focus:[0,.86,-.19]}],
  ["0179","dual-cable",(p) => crossCableFly(p,"low"),["pec"],{...standingCamera,yaw:29,height:2.48}],
  ["0188","dual-cable",(p) => crossCableFly(p,"middle"),["pec"],{...standingCamera,yaw:28,height:2.48}],
  ["1269","dual-cable",(p) => crossCableFly(p,"upright"),["pec"],{...standingCamera,yaw:29,height:2.48}],
  ["0225","dual-cable",(p) => crossCableFly(p,"reverse"),["rearShoulder","trap"],{...standingCamera,yaw:-32,height:2.47}],
  ["0215","cable-seated-dual",(p) => crossCableFly(p,"seated-reverse"),["rearShoulder","trap"],{...standingCamera,yaw:35}],
  ["1263","cable-seat-ball",(p) => crossCableFly(p,"ball"),["r:pec","core"],{...standingCamera,yaw:33}],
  ["0185","cable-flat-bench",(p) => benchFly(p,"flat"),["pec"],{...standingCamera,yaw:34,focus:[0,.76,-.27]}],
  ["1262","cable-decline-bench",(p) => benchFly(p,"decline"),["r:pec"],{...standingCamera,yaw:-74,elevation:17,focus:[0,.76,-.24]}],
  ["0240","cable-flat-bench",(p) => benchFly(p,"prone"),["rearShoulder","trap"],{...standingCamera,yaw:145,focus:[0,.66,.24]}],
  ["1631","cable-seated",concentrateCurl,["r:biceps"],{...standingCamera,yaw:-66}],
  ["1642","cable-seated",concentrateCurl,["r:biceps"],{...standingCamera,yaw:-57}],
  ["1634","cable-flat-bench-medium",(p) => recumbentArmCurl(p,false),["biceps"],{...standingCamera,yaw:56,focus:[0,.62,.20]}],
  ["1645","cable-incline-bench",(p) => recumbentArmCurl(p,true),["biceps"],{...standingCamera,yaw:43,focus:[0,.78,-.29]}],
  ["1637","cable-ball-bar",ballOverheadCurl,["biceps","core"],{...standingCamera,yaw:59}],
  ["0210","cable-seated-short-bar",reverseWristCurl,["forearm"],{...standingCamera,yaw:55}],
  ["0220","cable-medium-bar",cableShrug,["trap"],{...standingCamera,yaw:43}],
  ["0242","cable-ankle-tuck",cableTuck,["core"],{...standingCamera,yaw:71,focus:[0,.61,.26]}],
  ["6032","cable-row-v",(p) => seatedRow(p,{grip:"v",anchorY:.171}),latMuscles,{...rowCamera,yaw:43}],
  ["2661","cable-row-v",(p) => seatedRow(p,{grip:"v"}),latMuscles,{...rowCamera,yaw:54}],
  ["3357","rope",floorRopeRow,latMuscles,{...rowCamera,yaw:63,focus:[0,.78,.60],height:2.28}],
  ["0206","cable-straight-bar",(p) => bicepsCurl(p,{reverse:true}),["forearm","biceps"],{...standingCamera,yaw:40}],
  ["6543","rope",rearAnchorFrontRaise,["shoulder"],{...standingCamera,yaw:-64,focus:[0,.96,-.29],height:2.58}],
  ["2689","cable",(p) => rearAnchorFrontRaise(p,true),["r:shoulder"],{...standingCamera,yaw:-55,focus:[0,.96,-.25],height:2.54}],
  ["1723","cable",oneArmPushdown,["r:triceps"],{...standingCamera,yaw:55,height:2.48}],
  ["4353","cable-flat-bench-rope",lyingRopeExtension,["triceps"],{...rowCamera,yaw:-58,focus:[0,.84,-.42],height:2.47}],
  ["5658","cable-seated-rope",seatedRopeFacePull,["rearShoulder","trap"],{...rowCamera,yaw:55,focus:[0,.9,.47]}],
  ["7583","cable-lat-neutral",(p) => latPulldown(p,{grip:"v",chest:true}),latMuscles,{...latCamera,yaw:46}],
  ["10503","cable-lat-narrow",(p) => latPulldown(p,{grip:"narrow",under:true,chest:true}),latMuscles,{...latCamera,yaw:54}],
  ["5123","cable-lat-medium",(p) => latPulldown(p,{grip:"medium",under:true,chest:true}),latMuscles,{...latCamera,yaw:65}],
  ["3912","cable",(p) => cableRaise(p,{single:true,hinge:true,lateralRaise:true}),["r:shoulder","r:rearShoulder"],{...standingCamera,yaw:-20,focus:[.03,.99,.16],height:2.47}],
  ["0154","dual-cable",lowReverseCableFly,["rearShoulder","trap"],{...standingCamera,yaw:34,height:2.49}],
  ["0158","dual-cable",cableDeclineFly,["pec"],{...standingCamera,yaw:32,focus:[0,.99,-.17],height:2.58}],
  ["0155","dual-cable",(p) => cableDeclineFly(p,true),["pec"],{...standingCamera,yaw:24,focus:[0,.98,-.17],height:2.62}],
  ["0163","cable-row-bar",(p) => seatedRow(p,{steady:true}),latMuscles,{...rowCamera,yaw:49}],
  ["0166","rope",(p) => bicepsCurl(p,{rope:true}),["biceps","forearm"],{...standingCamera,yaw:52}],
  ["0181","cable-short-bar",(p) => floorCableCurl(p,true),["biceps"],{...rowCamera,yaw:61,focus:[0,.84,.37],height:2.53}],
  ["0183","cable-mat-short",(p) => floorCableCurl(p,false),["biceps"],{...rowCamera,yaw:-62,focus:[0,.84,-.26],height:2.55}],
  ["0186","cable-flat-bench-rope",(p) => lyingRopeExtension(p,{start:-1.39}),["triceps"],{...rowCamera,yaw:69,focus:[0,.84,-.42],height:2.48}],
  ["0187","cable-flat-bench-short",(p) => lyingRopeExtension(p,{bar:true}),["triceps"],{...rowCamera,yaw:61,focus:[0,.84,-.44],height:2.48}],
  ["1046","cable-medium-bar",(p) => standingRow(p,{grip:"medium",high:true,anchorHeight:1.612}),["rearShoulder","lat"],{...standingCamera,yaw:56}],
  ["1204","cable-seated",(p) => directionalSinglePull(p,"seat",true),["r:lat","r:biceps"],{...latCamera,yaw:-48}],
  ["1609","cable",(p) => oneArmPushdown(p,{sideOn:true}),["r:triceps"],{...standingCamera,yaw:27,focus:[-.31,.99,.16],height:2.48}],
  ["2515","dual-cable",dualCableFrontRaise,["shoulder"],{...standingCamera,yaw:46,focus:[0,.99,-.26],height:2.68}],
  ["2656","cable",(p) => bicepsCurl(p,{single:true}),["r:biceps"],{...standingCamera,yaw:-58}],
  ["3233","cable-row-bar",(p) => seatedRow(p,{under:true,steady:true}),latMuscles,{...rowCamera,yaw:71}],
  ["4391","cable-row-rope",(p) => seatedRow(p,{grip:"rope",steady:true,anchorY:.177}),latMuscles,{...rowCamera,yaw:49}],
  ["4948","cable",(p) => directionalSinglePull(p,"kneel"),["r:lat","r:biceps"],{...latCamera,yaw:-48,height:2.62}],
  ["5243","cable-flat-bench-short",(p) => lyingRopeExtension(p,{bar:true,start:-1.35}),["triceps"],{...rowCamera,yaw:-64,focus:[0,.84,-.42],height:2.48}],
  ["5369","cable",(p) => oneArmRow(p,{onKnees:true}),["r:lat","r:biceps"],{...standingCamera,yaw:-62}],
  ["5581","cable",(p) => directionalSinglePull(p,"kneel",true),["r:lat","r:biceps"],{...latCamera,yaw:51,height:2.62}],
  ["6510","cable",(p) => directionalSinglePull(p,"stand"),["r:lat","r:rearShoulder"],{...standingCamera,yaw:-64,height:2.49}],
  ["8901","cable",(p) => cableRaise(p,{single:true,lateralRaise:true}),["r:shoulder"],{...standingCamera,yaw:27,height:2.48}],
  ["1203","cable",(p) => bicepsCurl(p,{single:true,elbowOut:.082}),["r:biceps"],{...standingCamera,yaw:-45}],
  ["1636","dual-cable",(p) => sideOverheadArms(p,"standing-curl"),["biceps"],{...standingCamera,yaw:21,focus:[0,.99,.05],height:2.61}],
  ["1643","cable-seated-dual",(p) => sideOverheadArms(p,"seated-curl"),["biceps"],{...standingCamera,yaw:22,focus:[0,.98,.05],height:2.57}],
  ["1859","cable-short-bar",kneelingOverheadExtension,["triceps"],{...standingCamera,yaw:-62,focus:[0,.93,-.26],height:2.51}],
  ["3859","cable-medium-bar",(p) => bentCableRow(p,"over"),latMuscles,{...standingCamera,yaw:66}],
  ["4367","cable-medium-bar",(p) => bentCableRow(p,"under"),latMuscles,{...standingCamera,yaw:55}],
  ["4368","rope",(p) => bentCableRow(p,"rope"),["lat","rearShoulder"],{...standingCamera,yaw:63}],
  ["4960","dual-cable",(p) => sideOverheadArms(p,"extension"),["triceps"],{...standingCamera,yaw:21,focus:[0,1.06,.05],height:2.68}],
  ["5518","cable",(p) => oneArmRow(p,{onKnees:true,kneelingHinge:true,anchorHeight:.178}),["r:lat","r:biceps"],{...standingCamera,yaw:-63,focus:[0,.92,.34],height:2.46}],
  ["7155","cable-lat-wide",wideScapularPulldown,["lat","trap"],{...latCamera,yaw:49}],
  ["10667","cable",(p) => oneArmRow(p,{onKnees:true,anchorHeight:.924}),["r:lat","r:biceps"],{...standingCamera,yaw:-50,focus:[0,.94,.34],height:2.48}],
  ["0216","cable",(p) => shoulderRotation(p,{floor:true}),["r:shoulder"],{...rowCamera,yaw:-25,focus:[-.18,.98,.23],height:2.5}],
  ["0227","dual-cable",(p) => cableDeclineFly(p),["pec"],{...standingCamera,yaw:39,focus:[0,1.01,-.12],height:2.60}],
  ["0235","cable",(p) => shoulderRotation(p,{external:true}),["r:rearShoulder"],{...standingCamera,yaw:-34,focus:[.22,.96,.14]}],
  ["1227","cable",(p) => oneArmPushdown(p,{stagger:.095}),["r:triceps"],{...standingCamera,yaw:-45,height:2.5}],
  ["2954","cable-straight-bar",(p) => bicepsCurl(p,{reverse:true}),["forearm","biceps"],{...standingCamera,yaw:56}],
  ["3068","rope",highRopeCurl,["biceps"],{...standingCamera,yaw:59,height:2.53}],
  ["3359","dual-cable",(p) => pressWithCables(p,"stand"),["pec","triceps"],{...standingCamera,yaw:29,focus:[0,.97,-.12],height:2.58}],
  ["3363","dual-cable",(p) => pressWithCables(p,"stand-narrow"),["pec","triceps"],{...standingCamera,yaw:25,focus:[0,.97,-.12],height:2.58}],
  ["4355","cable-v-press-bar",(p) => tricepsPushdown(p,"pressV"),["triceps"],{...standingCamera,yaw:58,height:2.44}],
  ["5087","cable",(p) => shoulderRotation(p,{external:true,raised:true}),["r:rearShoulder"],{...standingCamera,yaw:25,focus:[.12,1.06,.14]}],
  ["5088","cable",(p) => shoulderRotation(p),["r:shoulder"],{...standingCamera,yaw:-24,focus:[-.18,1.04,.14]}],
  ["5089","cable",(p) => shoulderRotation(p,{raised:true}),["r:shoulder"],{...standingCamera,yaw:-32,focus:[-.12,1.03,-.18],height:2.42}],
  ["5090","cable-medium-bar",(p) => standingRow(p,{grip:"medium",anchorHeight:1.258}),latMuscles,{...standingCamera,yaw:58}],
  ["5179","cable-v-bar",(p) => standingRow(p,{anchorHeight:1.233}),latMuscles,{...standingCamera,yaw:45}],
  ["5524","cable",(p) => oneArmRow(p,{facePull:true,anchorHeight:1.29,outwardRotation:true}),["l:rearShoulder","l:lat"],{...standingCamera,yaw:-42}],
  ["5656","rope",(p) => ropeFaceRow(p,{anchorHeight:1.634}),["rearShoulder","trap"],{...standingCamera,yaw:50}],
  ["7416","dual-cable",(p) => crossCableFly(p,"neutral"),["pec"],{...standingCamera,yaw:24,focus:[0,.98,-.17],height:2.63}],
  ["7564","cable",(p) => oneArmRow(p,{split:true}),["r:lat","r:biceps"],{...standingCamera,yaw:-57}],
  ["7744","rope",(p) => ropeFaceRow(p,{under:true,anchorHeight:1.562}),["rearShoulder","trap"],{...standingCamera,yaw:48}],
  ["11261","rope",(p) => bicepsCurl(p,{rope:true}),["biceps","forearm"],{...standingCamera,yaw:63}],
  ["0231","cable",(p) => oneArmPushdown(p,{handOnHip:true}),["r:triceps"],{...standingCamera,yaw:49,height:2.5}],
  ["1210","cable",(p) => oneArmRow(p,{split:true,twist:true,high:true,anchorHeight:1.623}),["r:rearShoulder","r:lat"],{...standingCamera,yaw:-50,height:2.53}],
  ["1212","cable",(p) => oneArmRow(p,{twist:true,anchorHeight:1.186}),["r:lat","r:biceps"],{...standingCamera,yaw:-54}],
  ["1229","rope",(p) => pullDownStraight(p,{rope:true,hinge:.086}),["lat"],{...standingCamera,yaw:45}],
  ["2324","rope",(p) => hingeWithCable(p,true,true),["glute","hamstring"],{...standingCamera,yaw:67,focus:[0,.98,-.24],height:2.6}],
  ["3232","rope",(p) => ropeFaceRow(p,{anchorHeight:1.308}),["rearShoulder","trap"],{...standingCamera,yaw:58}],
  ["3914","rope",(p) => ropeFaceRow(p,{chest:true,anchorHeight:1.306}),["rearShoulder","trap"],{...standingCamera,yaw:53}],
  ["4111","cable-seated-dual",(p) => cableScapula(p,"seated-shrug"),["trap"],{...rowCamera,yaw:49,focus:[0,.94,.52],height:2.39}],
  ["4374","dual-cable",alternatingLowFly,["pec"],{...standingCamera,yaw:25,focus:[0,1.04,-.17],height:2.65}],
  ["4838","cable",(p) => bicepsCurl(p,{single:true}),["r:biceps"],{...standingCamera,yaw:-43}],
  ["5943","cable",(p) => rearAnchorFrontRaise(p,true,true),["r:shoulder"],{...standingCamera,yaw:-56,focus:[0,.99,-.21],height:2.54}],
  ["6219","cable",oneArmCableFly,["r:pec"],{...standingCamera,yaw:22,focus:[-.30,1.00,.09],height:2.5}],
  ["6511","cable",(p) => cableScapula(p,"high"),["r:lat","r:trap"],{...standingCamera,yaw:-62,height:2.53}],
  ["6512","cable",(p) => cableScapula(p,"low"),["r:trap","r:rearShoulder"],{...standingCamera,yaw:-49,height:2.51}],
  ["11057","cable-row-bar",(p) => cableScapula(p,"seated-row"),["trap"],{...rowCamera,yaw:67}],
];

const [directory, ...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional exact catalogue IDs.");
const selected = requested.length ? jobs.filter(([id]) => requested.includes(id)) : jobs;
if (!selected.length || (requested.length && selected.length !== requested.length)) throw new Error("Invalid or duplicate catalogue IDs.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });
const items = [];
for (const [id,equipment,pose,muscles,camera] of selected) {
  try {
    const data = { version:1, durationMs:4200, equipment, muscles, camera,
      keyframes:Array.from({ length:49 }, (_, index) => ({at:index/48, ...pose(index/48)})) };
    prepareRecipe(data);
    const recipe = id + ".json";
    await writeFile(resolve(output, recipe), JSON.stringify(data) + "\n");
    items.push({ id, recipe, posterAt:id === "0148" ? .242 : .49 });
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause:error });
  }
}
await writeFile(resolve(output, "batch.json"), JSON.stringify({kind:"catalogue",items}) + "\n");
console.log("Prepared", items.length, "Spotter cable recipes.");
