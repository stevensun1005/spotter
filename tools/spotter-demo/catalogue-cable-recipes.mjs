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

const widths = { wide: .448, mag: .339, wideNeutral: .422, pro: .369, narrow: .176, medium: .264, straight: .325, v: .116, pressV: .147, ez: .241 };
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
    const grip = ["v","mag","wideNeutral"].includes(key) ? [-axis[2], 0, axis[0]] : key === "pressV" ? [1,-sign*.37,0] : scale(axis, palms === "under" ? -1 : 1);
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

function independentLat(phase, crossed = false, synchronized = false) {
  const active = cycle(phase);
  const pose = torso([0, crossed ? .878 : .567, -.017], crossed ? .008 : -.086);
  if (crossed) stance(pose);
  else seatFeet(pose, "lat");
  const offset = crossed ? .28 : 0;
  for (const [side, sign] of sides) {
    const t = crossed || synchronized ? active : alternating(phase, sign);
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
      grip === "ez" ? unit([reverse ? -1 : 1, -sign*.47, 0]) : reverse ? [-1,0,0] : lateral, reverse ? handFacing.over : handFacing.under);
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

function cableCrunch(phase, mode, { depth = 1.075, anchorZ = 1.142 } = {}) {
  const t = cycle(phase);
  const side = mode === "side";
  const seat = mode === "seat";
  const pitch = side ? .02 : mix(.028,seat?.823:depth,t);
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
  else ropeCable(pose,[0,2.058,seat?-.94:anchorZ]);
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
  const reverse = mode.startsWith("reverse");
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
    const y = mode==='reverse-shoulder' ? 1.358 : reverse ? 1.912 : low ? .176 : seated ? 1.135 : 1.261;
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

function floorCableCurl(phase, towardMachine, regular = false) {
  const t = cycle(phase);
  const pose = torso([0, .141, .025], -Math.PI / 2);
  for (const [side, sign] of sides) {
    leg(pose, side, sign, [sign * .135, .066, .681], [sign * .087, .91, .045]);
    const shoulder = pose[side + "s"];
    const elbow = add(shoulder, [sign * (regular ? .072 : -.016), regular ? .042 : towardMachine ? .112 : .129, towardMachine ? .209 : -.194]);
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

function shoulderRotation(phase, { external = false, raised = false, floor = false, kneeling = false } = {}) {
  const t = cycle(phase);
  const pose = torso([0, floor ? .139 : kneeling ? .485 : .876, -.025], .035);
  if (floor) {
    for (const [side, sign] of sides) leg(pose, side, sign, [sign*.123,.070,.796], [sign*.07,.96,.009]);
  } else if (kneeling) kneel(pose);
  else stance(pose, .155);
  const side = "r";
  const shoulder = pose.rs;
  const elbow = add(shoulder, raised ? [-.244, -.023, .003] : [-.038, -.243, .024]);
  const angle = external ? mix(.05, 1.48, t) : mix(1.31, -.95, t);
  const direction = raised ? [0, Math.sin(angle), Math.cos(angle)] : [-Math.sin(angle), .014, Math.cos(angle)];
  const grip = raised ? unit([0, Math.cos(angle), -Math.sin(angle)]) : vertical;
  wristFromElbow(pose, side, elbow, direction, grip);
  if (floor) arm(pose,"l",[.189,.167,.30],[.43,-.92,-.25]);
  else restingArm(pose, "l", 1);
  const anchor = raised && !external ? [-.49, elbow[1], -.96] : [external ? .939 : -.938, kneeling ? .218 : elbow[1], .167];
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

function hingedReverseFly(phase, {single = false, under = false, crossed = false} = {}) {
  const t = cycle(phase);
  const pose = torso([0,.797,-.072],Math.PI / 4);
  stance(pose,.171,.034);
  for (const [side, sign] of sides) {
    if (single && side === 'l') {
      restingArm(pose,side,sign);
      continue;
    }
    const arc = unit(blend([sign * -.286,-.724,.625],[sign * .96,-.094,-.277],t));
    const grip = under ? [0,.81,-.59] : [0,.42,.91];
    arm(pose,side,add(pose[side+'s'],scale(arc,.562)),[sign*.76,-.45,-.24],grip,under ? handFacing.under : handFacing.over);
  }
  if (single) singleCable(pose,[.741,.342,1.121],'r',pose.rGrip);
  else {
    const x = crossed ? -.898 : .829;
    dualCable(pose,[[x,.353,1.003],[-x,.353,1.003]]);
  }
  return pose;
}

function overheadExtension(phase, {bar = false, one = false, low = false, bend = .26, under = false} = {}) {
  const t = cycle(phase);
  const pose = torso([0,.845,-.018],bend);
  stance(pose,.152,.196);
  const angle = mix(-1.50,bend+.45,t);
  for (const [side,sign] of sides) {
    if (one && side === 'l') {
      arm(pose,side,[.074,1.464,.127],[.86,-.49,.10],vertical);
      continue;
    }
    const elbow = add(pose[side+'s'],[one ? -.003 : 0,.205,.133]);
    wristFromElbow(pose,side,elbow,[0,Math.cos(angle),Math.sin(angle)],under ? [-1,0,0] : lateral,under ? handFacing.under : handFacing.over);
  }
  const anchor = [0,low?.173:2.121,-1.05];
  if (one) singleCable(pose,anchor,'r',pose.rGrip);
  else if (bar) barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  else ropeCable(pose,anchor);
  return pose;
}

function hingedRopeKickback(phase) {
  const t = cycle(phase);
  const pose = torso([0,.815,-.054],1.195);
  stance(pose,.158,.042);
  const angle = mix(.128,1.418,t);
  for (const [side,sign] of sides) {
    const elbow = add(pose[side+'s'],[sign*.012,-.048,-.241]);
    wristFromElbow(pose,side,elbow,[sign*.08,-Math.cos(angle),-Math.sin(angle)],vertical);
  }
  ropeCable(pose,[0,.168,1.214]);
  return pose;
}

function uprightRopePull(phase) {
  const t = cycle(phase);
  const pose = torso([0,.879,-.034],.036);
  stance(pose,.168);
  const center = [0,mix(.78,1.483,t),mix(.216,.229,t)];
  for (const [side,sign] of sides) {
    arm(pose,side,add(center,[sign*mix(.105,.246,t),0,0]),[sign*.90,.58,-.773]);
  }
  ropeCable(pose,[0,.176,.963]);
  return pose;
}

function inclineCableCurl(phase, narrow) {
  const t = cycle(phase);
  const pose = lyingBench('incline');
  const width = narrow ? .176 : .264;
  const pitch = mix(.24,2.24,t);
  for (const [side,sign] of sides) {
    const elbow = add(pose[side+'s'],[sign*(width-.192),-.208,.126]);
    wristFromElbow(pose,side,elbow,[0,-Math.cos(pitch),Math.sin(pitch)],lateral,handFacing.under);
  }
  barCable(pose,[0,.174,1.247],midpoint(pose.lw,pose.rw));
  return pose;
}

function weightedCableSquat(phase, {depth = .35, width = .215, rope = false, vGrip = false, goblet = false} = {}) {
  const t = cycle(phase);
  const pose = torso([0,.871-depth*t,-.024-.186*t],.041+.258*t);
  stance(pose,width,.008,.077);
  const center = add(pose.chest,[0,goblet ? -.041 : .061,goblet ? .173 : .183]);
  if (vGrip) {
    barHold(pose,center,'v',{l:[.55,-.91,-.05],r:[-.55,-.91,-.05]});
  } else {
    for (const [side,sign] of sides) {
      arm(pose,side,add(center,[sign*(rope ? .097 : .038),0,0]),[sign*.57,-.92,-.11],vertical);
    }
  }
  const anchor = [0,.172,1.19];
  if (rope) ropeCable(pose,anchor);
  else if (vGrip) barCable(pose,anchor,center);
  else singleCable(pose,anchor,'r',vertical);
  return pose;
}

function lowCablePallof(phase, { kneeling = false, split = false, high = false } = {}) {
  const t = cycle(phase);
  const pose = torso([0,kneeling?.481:.875,-.029],kneeling?.043:.016);
  if (kneeling) {
    kneel(pose);
    leg(pose,'r',-1,[-.169,.073,.420],[-.08,.875,.48]);
    pose.planted.r = 0;
  } else stance(pose,.177,split?.181:0);
  const center = add(pose.chest,[0,mix(.044,high?.713:.056,t),mix(.14,high?.139:.588,t)]);
  for (const [side,sign] of sides) {
    arm(pose,side,add(center,[sign*.034,0,0]),[sign*.58,-.78,-.18],vertical);
  }
  singleCable(pose,[-1.008,kneeling?.875:1.242,.165],'r',vertical);
  return pose;
}

function kneelingCableFly(phase) {
  const t = cycle(phase);
  const pose = torso([0,.499,-.02],.078);
  kneel(pose);
  for (const [side,sign] of sides) {
    const track = unit(blend([sign*.94,.127,-.188],[-sign*.29,-.804,.746],t));
    arm(pose,side,add(pose[side+'s'],scale(track,.576)),[sign*.51,-.72,-.217],vertical);
  }
  dualCable(pose,[[.944,1.879,-.27],[-.944,1.879,-.27]]);
  return pose;
}

function inclineCableExtension(phase) {
  const t = cycle(phase);
  const pose = lyingBench('incline');
  const angle = mix(-1.39,.265,t);
  for (const [side,sign] of sides) {
    const elbow = add(pose[side+'s'],[sign*(.176-.192),.235,-.071]);
    wristFromElbow(pose,side,elbow,[0,Math.cos(angle),Math.sin(angle)],lateral,handFacing.over);
  }
  barCable(pose,[0,.176,-1.241],midpoint(pose.lw,pose.rw));
  return pose;
}

function overheadFloorCurl(phase) {
  const t = cycle(phase);
  const pose = lyingBench('flat');
  const angle = mix(.075,-1.665,t);
  for (const [side,sign] of sides) {
    const elbow = add(pose[side+'s'],[sign*(.176-.192),.240,-.049]);
    wristFromElbow(pose,side,elbow,[0,Math.cos(angle),Math.sin(angle)],lateral,handFacing.under);
  }
  barCable(pose,[0,2.192,-1.241],midpoint(pose.lw,pose.rw));
  return pose;
}

function supineCableRaise(phase, bench) {
  const t = cycle(phase);
  const pose = bench ? lyingBench('flat') : torso([0,.142,.048],-Math.PI / 2);
  if (!bench) {
    for (const [side,sign] of sides) leg(pose,side,sign,[sign*.15,.074,.697],[sign*.13,.94,.077]);
  }
  const angle = mix(.045,Math.PI/2,t);
  const center = add(pose.ls,[-.192,.581*Math.sin(angle),.581*Math.cos(angle)]);
  const anchor = [0,.179,bench ? -1.368 : 1.118];
  barHold(pose,center,'medium',{l:[.53,.17,-.86],r:[-.53,.17,-.86]});
  barCable(pose,anchor,center);
  return pose;
}

function singleElbowCable(phase, option) {
  const t = cycle(phase);
  const kneeling = option.position === "half";
  const bench = option.position === "bench";
  const hinged = option.motion === "kick";
  const height = kneeling ? .482 : bench ? .899 : hinged ? .819 : .872;
  const pitch = hinged ? (bench ? 1.48 : 1.12) : .071;
  const pose = torso([0,height,-.024],pitch);
  if (kneeling) {
    kneel(pose);
    leg(pose,'r',-1,[-.166,.073,.440],[-.09,.92,.30]);
    pose.planted.r = 0;
  } else if (bench) {
    pose.lk = [.158,.52,-.028];
    pose.la = [.158,.548,-.447];
    pose.lt = [.175,.477,-.584];
    delete pose.planted.l;
    leg(pose,'r',-1,[-.297,.077,.140],[-.36,-.05,1]);
    arm(pose,'l',[.157,.503,.605],[.85,-.21,.12],[0,.06,1]);
  } else stance(pose,.169,option.motion === 'forward' ? .215 : .058);
  if (!bench) restingArm(pose, 'l', 1);

  const shoulder = pose.rs;
  let elbow, direction, anchor, handleAxis=vertical;
  if (option.motion === "kick") {
    elbow = add(shoulder,[-.033,-.029,-.243]);
    const angle = mix(.07,1.516,t);
    direction = [0,-Math.cos(angle),-Math.sin(angle)];
    anchor = [0,.177,1.265];
  } else if (option.motion === "side") {
    const end = add(shoulder,[mix(.247,-.599,t), .021, mix(.284,.045,t)]);
    arm(pose,'r',end,[-.88,-.12,.426],vertical);
    singleCable(pose,[1.036,shoulder[1],.193],'r',vertical);
    return pose;
  } else if (option.motion === "forward") {
    elbow = add(shoulder,[-.026,-.035,.239]);
    const angle = mix(2.033,.061,t);
    direction = [0,Math.sin(angle),Math.cos(angle)];
    anchor = [-.293,1.297,-1.082];
  } else if (option.motion === "cross") {
    elbow = add(shoulder,[-.052,-.239,.019]);
    const angle = mix(1.743,.022,t);
    direction=[.53*Math.sin(angle),-Math.cos(angle),.84*Math.sin(angle)];
    anchor=[.724,2.066,.677];
  } else {
    elbow=add(shoulder,[-.038,-.243,.038]);
    const angle=mix(1.84,.056,t);
    direction=[0,-Math.cos(angle),Math.sin(angle)];
    anchor=[-.339,2.096,.917];
  }
  if (option.brace) {
    anchor = [.077,2.096,.817];
    arm(pose,'l',[.238,1.087,.543],[.28,-.47,.81],vertical);
  }
  if (option.roped) handleAxis=unit(sub(anchor,add(elbow,scale(direction,.400))));
  wristFromElbow(pose,'r',elbow,direction,handleAxis);
  singleCable(pose,anchor,'r',handleAxis);
  return pose;
}

function twinOverheadExtension(phase, crossed) {
  const t = cycle(phase);
  const pose = torso([0,.872,-.025],crossed ? .185 : .062);
  stance(pose,.146,.181);
  for (const [side,sign] of sides) {
    const direction = [crossed ? -sign*.54*t : 0,Math.cos(mix(-1.83,.034,t)),Math.sin(mix(-1.83,.034,t))];
    const elbow = add(pose[side+'s'],[sign*(crossed ? -.028 : .025),.233,.068]);
    wristFromElbow(pose,side,elbow,direction,vertical);
  }
  const height = crossed ? 2.143 : .178;
  dualCable(pose,[[.945,height,-.384],[-.945,height,-.384]]);
  return pose;
}

function twinCrossPressdown(phase) {
  const t=cycle(phase);
  const pose=torso([0,.867,-.02],.084);
  stance(pose,.168,.028);
  for (const [side,sign] of sides) {
    const angle = mix(1.94,.105,t);
    const elbow=add(pose[side+'s'],[sign*.059,-.234,.029]);
    wristFromElbow(pose,side,elbow,[sign*mix(-.62,.125,t),-Math.cos(angle),.82*Math.sin(angle)],vertical);
  }
  dualCable(pose,[[-1.043,2.145,.467],[1.043,2.145,.467]]);
  return pose;
}

function sculptedCablePress(phase, option) {
  const {position, one = false, low = false, alternate = false, under = false} = option;
  const standUp = position === "standing";
  const ball = position === "ball" || position === "incline-ball";
  const incline = position === "incline" || position === "incline-ball";
  const decline = position === "decline";
  const pose = standUp ? torso([0,.849,.06],.151) : ball ?
    torso([0,incline ? .352 : .630,incline ? .159 : .223],incline ? -.827 : -1.51) : lyingBench(position);
  if (standUp) stance(pose,.163,.235,.071);
  if (ball) {
    pose.ballCenter = [0,.285,incline ? -.202 : -.234];
    for (const [side,sign] of sides) leg(pose,side,sign,[sign*.233,.077,.646],[sign*.28,.84,.02]);
  }
  if (decline) {
    delete pose.planted.l;
    delete pose.planted.r;
    for(const [side,sign] of sides){
      pose[side+'k']=[sign*.139,.611,.626];
      pose[side+'a']=[sign*.145,.238,.720];
      pose[side+'t']=[sign*.156,.196,.846];
    }
  }
  const arms = [];
  for (const [side,sign] of sides) {
    const s = pose[side+'s'];
    if (one && side==="l") {
      if (standUp) restingArm(pose,side,sign);
      else arm(pose,side,add(pose.lh,[.117,.065,.184]),[.73,-.62,.013]);
      continue;
    }
    const t=alternate?alternating(phase,sign):cycle(phase);
    const start = add(s,[sign*.155,standUp?(low?-.225:-.047):.091,standUp?.131:.068]);
    const end = add(s,[-sign*.080,standUp?(low?.234:alternate?-.226:.024):incline?.475:.589,standUp?.551:incline?.351:.111]);
    const aim=low?add(blend(start,end,t),[0,.046*Math.sin(Math.PI*t),0]):blend(start,end,t);
    arm(pose,side,aim,[sign*.87,-.71,standUp?-.38:.08],under?[-1,0,0]:[1,0,0],under?handFacing.under:handFacing.over);
    arms.push({ anchor:[sign*(one?.816:.966), standUp?(alternate?1.962:low?.175:1.247):.174,standUp?-.487:decline?-.616:-.416],
      end:pose[side+'w'],grip:pose[side+'Grip'] });
  }
  pose.cables=arms;
  return pose;
}

function chestSupportedCableFly(phase) {
  const t = cycle(phase);
  const pose = torso([0,.575,-.018], .887);
  for (const [side,sign] of sides) {
    leg(pose,side,sign,[sign*.217,.077,-.461],[sign*.38,.89,.20]);
    const open = [sign*.563,-.052,.138];
    const close = [-sign*.172,-.237,.520];
    arm(pose,side,add(pose[side+'s'],scale(unit(blend(open,close,t)),.591)),[sign*.47,-.68,-.56],vertical);
  }
  dualCable(pose,[[.941,.997,.402],[-.941,.997,.402]]);
  return pose;
}

function cablePressUp(phase, option) {
  const { kneeling, bar = false, stagger = false } = option;
  const t=cycle(phase);
  const pose=torso([0,kneeling?.482:.873,-.022],kneeling?.039:.022);
  if(kneeling) kneel(pose); else stance(pose,.172,stagger?.15:0);
  const height=pose.ls[1];
  if(bar){
    const center=[0,height+mix(.051,.588,t),mix(.202,.081,t)];
    barHold(pose,center,'medium',{l:[.94,-.78,.11],r:[-.94,-.78,.11]});
    barCable(pose,[0,.174,1.053],center);
  }else{
    for(const [side,sign] of sides){
      const hand=[sign*mix(.353,.241,t),height+mix(.039,.597,t),mix(.178,.074,t)];
      arm(pose,side,hand,[sign*.958,-.67,.11],lateral,handFacing.over);
    }
    const a = kneeling ? .173 : 1.307;
    dualCable(pose,[[.886,a,-.437],[-.886,a,-.437]]);
  }
  return pose;
}

function cableShoulderArc(phase, style) {
  const t=cycle(phase);
  const sideRaise=style==='lean';
  const y=style==='y-cross'||style==='y-direct';
  const one=!y;
  const high=style==='eye';
  const pose=torso([sideRaise?-.134:0,.861,-.025],.048,0,sideRaise?-.186:0);
  stance(pose,sideRaise?.136:.171,sideRaise?.015:.038);
  for(const [side,sign] of sides){
    if(one&&side==='l'){
      if (sideRaise) arm(pose,side,[.466,1.337,.217],[.43,-.85,.19],vertical);
      else restingArm(pose,side,sign);
      continue;
    }
    const low=y ? [-sign*.274,-.541,.20]:sideRaise?[.342,-.511,.077]:[.084,-.595,.109];
    const max=y ? [sign*.388,.455,.082] : sideRaise ? [-.561,.068,.088] : [.059,high?.118:.011,.593];
    arm(pose,side,add(pose[side+'s'],scale(unit(blend(low,max,t)),.595)),[sign*.604,-.427,-.68],
      style==='eye'? lateral:vertical,style==='eye'?handFacing.over:null);
  }
  if(y){
    const sign=style==='y-cross'?-1:1;
    dualCable(pose,[[sign*.906,.169,.645],[-sign*.906,.169,.645]]);
  }else singleCable(pose,sideRaise?[.690,.171,.231]:[0,.172,-1.056],'r',pose.rGrip);
  return pose;
}

function isolatedCableCurl(phase, style) {
  const t=cycle(phase);
  const preacher=style.startsWith('preacher');
  const incline=style==='incline';
  const floor=style==='floor';
  const overhead=style.startsWith('overhead');
  const seated = preacher || incline || floor || overhead || style==='seat-1'||style==='seat-2';
  const pose = incline ? lyingBench('incline') : torso([0,floor?.163:seated?.565:.876,-.026],preacher?.405:floor?.391:.036);
  if (floor) {
    for(const [side,sign] of sides) leg(pose,side,sign,[sign*.322,.079,.49],[sign*.78,.86,.02]);
  } else if (seated&&!incline) seatFeet(pose);
  if(!seated) stance(pose,.16,.056);
  const both=style==='preacher-both'||overhead||incline;
  const anchor=[0,overhead ? 2.105 : .174,incline ? -1.175:style==='hammer'?.783:1.103];
  const width=style==='overhead-ez'?.241:style==='overhead-wide'?.325:style==='preacher-both'?.322:.192;
  for (const [side,sign] of sides) {
    if (!both&&side==='l') {
      if(style==='hammer') arm(pose,side,[.266,1.078,.539],[.717,-.52,-.19],vertical);
      else restingArm(pose,side,sign);
      continue;
    }
    const s=pose[side+'s'];
    const elbow=preacher ? [sign*.210,.815,.310] : overhead ?
      add(s,[sign*(width-.192),.162,style==='overhead-wide'?.183:.172]) : floor ?
      [sign*.201,.375,.348] : add(s,[sign*.039,-.233,incline?-.078:style==='seat-2'?.010:.078]);
    const angle = mix(overhead?.569:preacher?.79:floor?.99:.19,overhead?(style==='overhead-wide'?-1.14:-1.01):2.622,t);
    const direction=overhead?[0,Math.cos(angle),Math.sin(angle)]:[0,-Math.cos(angle),Math.sin(angle)];
    const over=style==='preacher-reverse'||style==='preacher-both';
    const hammer=style==='preacher-rope'||style==='hammer';
    const tentative=add(elbow,scale(direction,.365));
    const gripAxis=hammer?unit(sub(anchor,tentative)):style==='overhead-ez'?
      unit([1,-sign*.47,0]):over?[-1,0,0]:lateral;
    if(style==='preacher-both'){
      arm(pose,side,[sign*width,tentative[1],tentative[2]],sub(elbow,s),gripAxis,handFacing.over);
    }else wristFromElbow(pose,side,elbow,direction,gripAxis,over?handFacing.over:handFacing.under);
  }
  if(overhead||style==='preacher-both') barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  else if(incline) dualCable(pose,[[.629,.178,-.783],[-.629,.178,-.783]]);
  else singleCable(pose,anchor,'r',pose.rGrip);
  return pose;
}

function halfKneelingRotationPress(phase, option) {
  const turn=cycle(phase,.24,.76);
  const press=option.press?cycle(phase,.48,.52):0;
  const pose=torso([0,.482,-.031],.031);
  kneel(pose);
  leg(pose,'r',-1,[-.183,.078,.40],[-.24,.874,.11]);
  pose.planted.r=0;
  const s=pose.rs;
  const initial = option.raised || option.press ? [-.234,.031,.064] : [-.051,-.237,.052];
  const elbow = add(s,scale(unit(blend(initial,[-.041,.240,.064],press)),.245));
  const angle=mix(.07,1.44,turn);
  const direction=option.raised || option.press ?
    blend([0,Math.sin(angle),Math.cos(angle)],[0,.998,.061],press) : [-Math.sin(angle),.027,Math.cos(angle)];
  wristFromElbow(pose,'r',elbow,direction,option.raised?[0,Math.cos(angle),-Math.sin(angle)]:vertical);
  restingArm(pose,'l',1);
  singleCable(pose,[.964,option.raised?.985:.735,.151],'r',pose.rGrip);
  return pose;
}

function torsoCableTurn(phase, option) {
  const {position='stand',axis='level',anti=false,flip=false,short=false,step=false} = option;
  const t=cycle(phase);
  const half=position==='half';
  const kneeling=position==='kneeling'||half;
  const bench=position==='bench';
  const floor=position==='floor';
  const height=kneeling?.474:bench?.554:floor?.164:.871;
  const up=axis==='up';
  const down=axis==='down';
  const swing=down||up;
  const startYaw=flip?.78:swing?.53:.647;
  const finishYaw=flip?-1.27:short?-.46:-.79;
  const yaw=anti?.026*t:mix(startYaw,finishYaw,t);
  const pose=torso([0,height,-.019],floor?-.57:.032,yaw);
  if(kneeling){
    kneel(pose);
    if(half) {
      leg(pose,'r',-1,[-.166,.076,.436],[-.11,.917,.15]);
      pose.planted.r=0;
    }
  }else if(bench)seatFeet(pose);
  else if(floor){
    for(const[side,sign]of sides)leg(pose,side,sign,[sign*.118,.172,.641],[sign*.3,.87,.16]);
    pose.planted={};
  }else stance(pose,step?.206:.175,step?.151:.062);
  const centerY=height+.489;
  const startFit=up?-.206:down?.376:.027;
  const endFit=up?.337:down?-.312:.027;
  const gripAngle=anti ? mix(.55,-.63,t) : yaw;
  const gripReach=flip?.18:short?.341:.503;
  const center=[Math.sin(gripAngle)*gripReach,centerY+mix(startFit,endFit,t),Math.cos(gripAngle)*gripReach+.051];
  if (flip) center[1]+= .139;
  for(const [side,sign] of sides){
    arm(pose,side,add(center,[sign*.039,.033*sign,0]),[sign*.58,-.72,-.25],vertical);
  }
  const originY=up||floor?.179:down?2.143:height+.395;
  singleCable(pose,[1.036,originY,.132], 'l', vertical);
  return pose;
}

function supineCableWork(phase, option) {
  const {motion, bench=true,one=false,ez=false,brace=false} = option;
  const t=cycle(phase);
  const split=motion==='fly'||motion==='cross';
  const pose=bench ? lyingBench('flat') : torso([0,.156,.027],-Math.PI/2);
  if(brace) {
    const y=.149+.319*cycle(phase,.24,.86);
    const angle=-Math.acos(Math.max(-.99,(.144-y)/.488));
    Object.assign(pose,torso([0,y,.040],angle));
    pose.head=[0,.134,pose.neck[2]-.101];
  }
  if(!bench) {
    for(const[side,sign]of sides)leg(pose,side,sign,[sign*.15,.102,.612],[sign*.16,.88,.16]);
  }
  const anchor=[0,.173,motion==='curl'||motion==='upright'||motion==='shrug'?1.171:-1.192];
  if (motion==='shrug') {
    for (const [side] of sides) {
      pose[side+'s']=add(pose[side+'s'],[0,.025*t,-.082*t]);
    }
    pose.chest=add(pose.chest,[0,.012*t,-.028*t]);
  }
  if (motion==='upright'||motion==='curl'||motion==='close'||motion==='shrug') {
    const center=motion==='upright'?[0,pose.chest[1]+mix(.09,.296,t),mix(.113,-.347,t)]:
      motion==='close'?[0,pose.chest[1]+mix(.206,.554,t),mix(-.193,-.358,t)]:
      motion==='shrug'?[0,pose.chest[1]+.101,mix(.116,.029,t)]:
      [0,pose.chest[1]+mix(.016,.266,t),mix(.457,-.166,t)];
    const key=ez?'ez':motion==='close'?'v':'medium';
    if(motion==='curl'){
      for(const[side,sign]of sides){
        const e=add(pose[side+'s'],[sign*.064,-.031,.233]);
        const rad=mix(.147,2.58,t);
        wristFromElbow(pose,side,e,[0,Math.sin(rad),Math.cos(rad)],lateral,handFacing.under);
      }
      barCable(pose,anchor,midpoint(pose.lw,pose.rw));
    }else{
      barHold(pose,center,key,{l:[.79,.07,-.57],r:[-.79,.07,-.57]});
      barCable(pose,anchor,center);
    }
    return pose;
  }
  for(const [side,sign]of sides){
    const s=pose[side+'s'];
    if(one&&side==='l'){restingArm(pose,side,sign);continue;}
    if(split){
      const open=[sign*.590,.062,.006];
      const closed=[sign*(motion==='cross'?-.264:-.123),.533,.107];
      const track=motion==='cross'?blend(closed,open,t):blend(open,closed,t);
      arm(pose,side,add(s,scale(unit(track),.587)),[sign*.56,.38,.56],forward);
    }else if(motion==='pallof'){
      const center=add(pose.chest,[sign*.037,mix(.155,.566,t),.054]);
      arm(pose,side,center,[sign*.83,-.21,.51],vertical);
    }
  }
  if(motion==='pallof')singleCable(pose,[-1.080,.177,-.308],'r',vertical);
  else if(one)singleCable(pose,[.942,.178,-.385],'r',forward);
  else dualCable(pose,[[motion==='cross'?-.92:.92,.177,-.485],[motion==='cross'?.92:-.92,.177,-.485]]);
  return pose;
}

function proneBenchCable(phase,option){
  const {motion,one=false,standing=false,cuff=false,depth=.977}=option;
  const t=cycle(phase);
  const support=motion==='row';
  const rear=motion==='rear';
  const pose=torso([0,standing?.871:.574,-.026],standing?.041:.879);
  if(standing)stance(pose,.178,.132);
  else for(const[side,sign]of sides)leg(pose,side,sign,[sign*.237,.077,-.443],[sign*.44,.88,.24]);
  const attachments=[];
  for(const[side,sign]of sides){
    const s=pose[side+'s'];
    if(one&&side==='l'){
      if(standing)restingArm(pose,side,sign);
      else arm(pose,side,[.215,.619,-.023],[.76,-.51,-.16]);
      continue;
    }
    if(support){
      const start=[sign*.063,.131,.545];
      const finish=[sign*.074,.009,.134];
      arm(pose,side,add(s,blend(start,finish,t)),[sign*.63,-.38,-.81],vertical);
    }else {
      const low=rear?[-sign*.244,-.082,.518]:[sign*.028,-.569,.140];
      const high=rear?[sign*.579,.071,-.118]:[sign*.385,.247,.387];
      arm(pose,side,add(s,scale(unit(blend(low,high,t)),.583)),[sign*.59,-.59,-.64],vertical);
    }
    const turn=rear?-1:1;
    const a=[turn*sign*depth,support?1.884:rear?1.021:.179,rear?.610:1.024];
    const end=cuff?blend(pose[side+'w'],pose[side+'e'],.102):pose[side+'w'];
    attachments.push({anchor:a,end,grip:cuff?unit(sub(pose[side+'e'],pose[side+'w'])):vertical});
  }
  pose.cables=attachments;
  return pose;
}

function seatedSingleCableRow(phase,option){
  const {mode='floor-seat',twist=false,alternate=false,stanceRow=false,rear=false}=option;
  const t=cycle(phase);
  const stanceMode=mode==='standing';
  const floor=mode==='floor';
  const s=alternate&&phase>=.5?-1:1;
  const active=alternate?s===1?'l':'r':'r';
  const f=alternate?cycle(phase*2%1):t;
  const pose=torso([0,stanceMode?.873:floor?.172:.565,-.028],stanceMode?.059:floor?.128:.043,twist?mix(.39,-.415,f)*s:0);
  if(stanceMode)stance(pose,.17,stanceRow?.190:.08);
  else if(floor){for(const[side,sign]of sides)leg(pose,side,sign,[sign*.171,.072,.685],[sign*.20,.82,.16]);}
  else seatFeet(pose,mode==='row'?'row':'seat');
  if(stanceMode&&stanceRow){
    const yoga=.32*t;
    pose.hips[2]-=.049*yoga;
  }
  for(const[side,sign]of sides){
    if(side!==active){restingArm(pose,side,sign);continue;}
    const s=pose[side+'s'];
    const hand=add(s,[sign*mix(.049,rear?.218:.024,f),
      mix(stanceMode?.022:-.155,rear?-.082:-.244,f),mix(.550,.144,f)]);
    arm(pose,side,hand,[sign*(rear?.94:.52),-.25,-.89],vertical);
  }
  singleCable(pose,[0,stanceMode?1.270:.175, floor?1.234:1.025],active,vertical);
  return pose;
}

function cableSeatedSymmetry(phase,option){
  const {mode, close=false, chested=false}=option;
  const t=cycle(phase);
  const press=mode==='press';
  const reverse=mode==='rev';
  const fly=mode==='fly';
  const p=chested?.683:Math.PI*.018;
  const pose=torso([0,.565, -.029],p);
  seatFeet(pose);
  for(const[side,sign]of sides){
    const s=pose[side+'s'];
    const opening=reverse||fly ? [sign*.562,.031,-.136] : [sign*.043,-.092,.15];
    const joining=[sign*(close?-.121:-.145),.014,.575];
    const hand=reverse?blend(joining,opening,t):blend(opening,joining,t);
    arm(pose,side,add(s,hand),[sign*.69,-.47,-.65],vertical);
  }
  const sign=reverse?-1:1;
  dualCable(pose,[[sign*.928,1.025,press||fly?-.428:.791],[-sign*.928,1.025,press||fly?-.428:.791]]);
  return pose;
}

function wristCable(phase,option){
  const {position,reverse=false,one=false,roll=false,pronate=false}=option;
  const t=cycle(phase);
  const seated=position==='seat';
  const behind=position==='back';
  const pose=torso([0,seated?.564:.870,-.019],seated?.43:.027);
  if(seated)seatFeet(pose);
  else stance(pose,.15,.059);
  for(const[side,sign]of sides){
    if(one&&side==='l'){restingArm(pose,side,sign);continue;}
    const elbow=add(pose[side+'s'],[sign*.045,-.241, behind?-.028:.044]);
    const fore=seated?[sign*.014,-.35,.290]:behind?[0,-.997,-.061]:[0,roll?.045:-.873,roll?.987:.432];
    const direction=unit(fore);
    const fist=add(elbow,scale(direction,.370));
    const wrist=add(fist,[0,pronate?0:mix(-.018,.040,t),pronate?0:mix(behind?-.019:.04,behind?-.086:.091,t)]);
    pose[side+'e']=elbow;
    pose[side+'w']=wrist;
    const degree=pronate?Math.PI*t:roll?phase*Math.PI*2:reverse?Math.PI:0;
    pose[side+'Grip']=unit([Math.cos(degree),-Math.sin(degree),.021]);
    pose[side+'Fingers']=unit([0,reverse?-.62:.62,behind?-.77:.77]);
  }
  const anchor=[one?-.344:0,.172,behind?-1.095:1.052];
  if(one)singleCable(pose,anchor,'r',pose.rGrip);
  else barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  return pose;
}

function cableTwoDirections(phase, option) {
  const {kneeling}=option;
  const t=cycle(phase);
  const pose=torso([0,kneeling?.483:.864,-.029],.081);
  if(kneeling){
    kneel(pose);
    leg(pose,'l',1,[.171,.073,.43],[.11,.87,.18]);
    pose.planted.l=0;
  } else stance(pose,.17,.221);
  for (const [side,sign] of sides) {
    const s=pose[side+'s'];
    const moving=side==='r'?mix(.104,.572,t):mix(.580,.143,t);
    arm(pose,side,add(s,[sign*.071,mix(-.052,.024,moving),moving]),[sign*.64,-.70,-.29],vertical);
  }
  dualCable(pose,[[.584,kneeling?.922:1.226,1.063],[-.584,kneeling?.922:1.226,-.902]]);
  return pose;
}

function inclineCablePull(phase, option) {
  const {kind}=option;
  const t=cycle(phase);
  const pose=kind==='lying'?lyingBench('flat'):lyingBench('incline');
  const center=kind==='v-shoulder' ? add(pose.chest,[0,mix(.173,.572,t),mix(.133,.092,t)]) :
    add(pose.chest,[0,mix(kind==='lying'?.580:.607,.174,t),mix(-.199,.236,t)]);
  const anchor=kind==='v-shoulder'?[0,.176,-.975]:[0,2.128,-1.191];
  const grip=kind==='v-shoulder'?'v':'medium';
  barHold(pose,center,grip,{l:[.71,-.78,.06],r:[-.71,-.78,.06]});
  barCable(pose,anchor,center);
  return pose;
}

function cableOverheadSquat(phase) {
  const t = cycle(phase);
  const pose = torso([0,.875-.363*t,-.032-.141*t],.031+.193*t);
  stance(pose,.183,0,.083);
  const center = add(pose.chest,[0,.686,.082]);
  for (const [side,sign] of sides) {
    const grip = add(center,[sign*.034,0,0]);
    arm(pose,side,grip,[sign*.396,-.122,-.708],vertical);
  }
  singleCable(pose,[0,.175,1.119],'r',vertical);
  return pose;
}

function supineAnkleCable(phase,alternatingLegs){
  const t=cycle(phase);
  const pose=torso([0,.147+.132*t,-.184-.061*t],-Math.PI/2-.128*t);
  for(const[side,sign]of sides){
    const local=alternatingLegs?alternating(phase,sign):t;
    const thigh=mix(.996,1.989,local);
    const shin=mix(-.158,-1.020,local);
    const h=pose[side+'h'];
    pose[side+'k']=add(h,[sign*.015,.421*Math.sin(thigh),.420*Math.cos(thigh)]);
    pose[side+'a']=add(pose[side+'k'],[0,.424*Math.sin(shin),.424*Math.cos(shin)]);
    pose[side+'t']=add(pose[side+'a'],[sign*.019,-.040,.130]);
    arm(pose,side,[sign*.233,.078,pose.hips[2]-.036],[sign*.51,-.57,-.63]);
  }
  pose.cables=sides.map(([side])=>({anchor:[0,.176,1.266],end:pose[side+'a'],grip:unit(sub(pose[side+'k'],pose[side+'a']))}));
  return pose;
}

function compoundCableTriceps(phase,options) {
  const {kind}=options;
  const t=cycle(phase);
  const incline=kind==='incline-rope'||kind==='incline-bar';
  const floor=kind==='floor';
  const seated=kind==='seated';
  const kneeling=kind==='kneeling';
  const overhead=incline||seated;
  const pose=incline ? lyingBench('incline') : torso([0,seated?.560:kneeling?.483:.173,-.016],.067);
  if(seated)seatFeet(pose);
  if(kneeling)kneel(pose);
  if(floor)for(const [side,sign] of sides)leg(pose,side,sign,[sign*.166,.076,.694],[sign*.13,.94,.13]);
  for(const[side,sign]of sides){
    if(kneeling&&side==='l'){restingArm(pose,side,sign);continue;}
    const shoulder=pose[side+'s'];
    const elbow=add(shoulder,[sign*.033,overhead?.240:-.226,overhead?.055:.084]);
    const angle=overhead?mix(-1.55,.214,t):mix(kneeling?1.13:1.62,.096,t);
    wristFromElbow(pose,side,elbow,[0,(overhead?1:-1)*Math.cos(angle),Math.sin(angle)],lateral,handFacing.over);
  }
  const anchor=[0,overhead?(incline?.177:2.104):kneeling?1.944:.586,overhead?-1.151:1.174];
  if(kind==='incline-rope')ropeCable(pose,anchor);
  else if(kneeling)singleCable(pose,anchor,'r',vertical);
  else barCable(pose,anchor,midpoint(pose.lw,pose.rw));
  return pose;
}

function supportedRopeFace(phase, options) {
  const lying=options.lying;
  const pull=cycle(phase,.29,.72);
  const rotate=options.external ? cycle(phase,.44,.56) : 0;
  const pose=lying ? lyingBench('flat') : torso([0,.864,-.024],.041);
  if(!lying)stance(pose,.15,.173);
  for (const [side,sign] of sides) {
    const s=pose[side+'s'];
    const start=add(s,[sign*.047,lying?.330:.054,lying?-.460:.581]);
    const finish=add(s,[sign*.139,lying?.29:.099+.234*rotate,lying?-.172:.164]);
    arm(pose,side,blend(start,finish,pull),[sign*.961,-.31,-.05]);
  }
  const anchor=lying?[0,2.133,-1.204]:[0,1.491,1.093];
  ropeCable(pose,anchor);
  return pose;
}

function seatedSpecialCable(phase, options) {
  const {kind}=options;
  const t=cycle(phase);
  const floor=kind==='floor-lat';
  const tall=kind==='chair';
  const yaw=kind==='seat-extension'?-.083:0;
  const pose=torso([0,floor?.172:tall?mix(.559,.871,t):.566,-.027-(tall?.15*(1-t):0)],
    tall?.048+.282*Math.sin(Math.PI*t):floor?-.115:.032,yaw);
  if(floor){
    for(const[side,sign]of sides)leg(pose,side,sign,[sign*.258,.081,.62],[sign*.81,.416,.07]);
  }else if(tall)stance(pose,.113,0,.314);
  else seatFeet(pose);
  const center=add(pose.chest,[0,tall?.026:mix(.46,.119,t),tall?.185:mix(.341,.252,t)]);
  const anchor=[0,tall?.177:2.124,1.107];
  if(tall){
    for(const[side,sign]of sides)arm(pose,side,add(center,[sign*.035,0,0]),[sign*.56,-.91,-.10],vertical);
    singleCable(pose,anchor,'r',vertical);
  }else if(kind==='pullover'){
    for(const[side,sign]of sides){
      const s=pose[side+'s'];
      const angle=mix(2.36,.431,t);
      arm(pose,side,add(s,[sign*.027,-.590*Math.cos(angle),.586*Math.sin(angle)]),[sign*.45,-.53,-.71],vertical);
    }
    ropeCable(pose,anchor);
  }else{
    barHold(pose,center,'v',{l:[.59,-.71,-.12],r:[-.59,-.71,-.12]});
    barCable(pose,anchor,center);
  }
  return pose;
}

function crouchedCable(phase,option){
  const {kind}=option;
  const t=cycle(phase);
  const kneeling=kind==='kneeling';
  const supinated=kind==='supination';
  const stretch=kind==='stretch'||supinated;
  const belt=kind==='belt';
  const box=kind==='boxHinge'||kind==='stepLunge';
  const lunge=kind==='stepLunge';
  const zercher=kind==='zercher';
  const hip=[0,kneeling?.484-.159*t:(box?.211:0)+.869+(box&&!lunge?.038:0)-(zercher?.36:lunge?.402:stretch?.23:box?.015:.103)*t,
    (belt?.089:0)-(zercher?.191:kneeling?.294:lunge?.168:box?.088:.251)*t];
  const pose=torso(hip,(zercher?.061:stretch?.079:.045)+(zercher?.222:stretch?.548:lunge?.242:1.17)*t);
  if(kneeling)kneel(pose);
  else if(box){
    pose.planted={};
    for(const[side,sign]of sides){
      const swing=lunge&&side==='l';
      const y=.290-(swing?.206*t:0);
      const z=.044-(swing?.625*t:0);
      leg(pose,side,sign,[sign*.165,y,z],[sign*.21,-.091,1],[sign*.017,-.072-(swing?.045*t:0),.132]);
      if(!swing)pose.planted[side]=.214;
    }
  }else stance(pose,zercher?.191:.174,stretch?.047:.031);
  if(belt){
    for(const[side,sign]of sides)restingArm(pose,side,sign);
    pose.cables=[{anchor:[0,.174,-1.131],end:add(hip,[0,-.008,-.139]),grip:lateral}];
    return pose;
  }
  const middle=zercher?add(pose.chest,[0,-.148,.196]):kneeling?add(hip,[0,-.217,.105-.143*t]):
    lunge?add(pose.chest,[0,.041,.169]):stretch?add(pose.chest,[0,.047,.474]):
    add(pose.chest,[0,-.277-.13*t,.150-.08*t]);
  if(zercher){
    for(const[side,sign]of sides){
      const elbow=add(middle,[sign*.225,0,0]);
      wristFromElbow(pose,side,elbow,[-sign*.35,.87,-.23],lateral);
    }
    barCable(pose,[0,.177,-1.191],middle);
  }else{
    for(const[side,sign]of sides){
      arm(pose,side,add(middle,[sign*.037,0,0]),[sign*.55,-.61,-.78],stretch?[-1,0,0]:vertical,
        stretch?[0,.79,.61]:undefined);
    }
    const anchor=[0,kneeling||box?.173:stretch?1.321:.177,kneeling?-1.22:1.154];
    if(supinated){
      barHold(pose,middle,'narrow',{l:[.68,-.63,-.14],r:[-.68,-.63,-.14]},'under');
      barCable(pose,anchor,middle);
    }else{
      singleCable(pose,anchor,'r',pose.rGrip);
    }
  }
  return pose;
}

function cableSideFlexion(phase,option){
  const {kind}=option;
  const t=cycle(phase);
  const kneeling=kind==='kneel';
  const ball=kind==='bosu';
  const direction=option.into ? -1:1;
  const d=ball ? (phase < .5 ? -1:1)*cycle(phase*2%1) : direction*t*(kind==='small'?.78:1);
  const pose=torso([0,kneeling?.484:ball?.381:.872,.016],ball?-.372:.02,0,.291*d);
  if(kneeling)kneel(pose);
  else if(ball){
    for(const[side,sign]of sides)leg(pose,side,sign,[sign*.223,.074,.558],[sign*.37,.89,.19]);
  }else stance(pose,.176);
  for(const[side,sign]of sides){
    const s=pose[side+'s'];
    if(!ball&&side==='l'){restingArm(pose,side,sign);continue;}
    const target=kneeling?add(pose.head,[-.133,-.087,.026]):ball?add(pose[side+'h'],[sign*.129,.036,.041]):
      add(s,[sign*.074,-.590,.063]);
    arm(pose,side,target,[sign*.73,-.50,.09],kneeling?vertical:lateral);
  }
  if(ball)dualCable(pose,[[.937,.174,.43],[-.937,.174,.43]]);
  else singleCable(pose,[-.941,kneeling?1.987:.174,.126],'r',pose.rGrip);
  return pose;
}

function cableRotatingPress(phase,option){
  const {kind}=option;
  const lift=kind==='overhead';
  const curl=kind==='arnold';
  const jab=kind==='jab';
  const t=cycle(phase, jab?(option.compact?.22:.263):.43, jab?(option.compact?.28:.315):.58);
  const up=curl?cycle(phase,.29,.55,.88):t;
  const flex=curl?cycle(phase,.04,.32,.97):0;
  const pose=torso([0,.868,-.018],.029,kind==='rotating'||lift?mix(.397,-.467,t):jab?-.34*t:0);
  stance(pose,.17,kind==='arnold'?.058:.212);
  for(const[side,sign]of sides){
    if(!curl&&side==='l'){restingArm(pose,side,sign);continue;}
    const s=pose[side+'s'];
    const start=add(s,[sign*.096,curl?-.590:jab?.167:.039,curl?.087:.139]);
    const rack=add(s,[sign*.161,.044,.160]);
    const top=add(s,[sign*.047,.588,.107]);
    const end=lift?top:add(s,[-sign*(kind==='rotating'?.105:.042),jab?.119:.036,jab&&option.compact?.549:.576]);
    const palm=lift?lateral:curl?unit([Math.cos(Math.PI*flex*(1-up)),0,Math.sin(Math.PI*flex*(1-up))+.013]):vertical;
    const target=curl?blend(blend(start,rack,flex),top,up):blend(start,end,t);
    arm(pose,side,target,[sign*.69,-.61,-.33],palm);
  }
  if(curl)dualCable(pose,[[.783,.171,.474],[-.783,.171,.474]]);
  else singleCable(pose,[kind==='rotating'||lift?.822:0,lift?.174:1.302,kind==='rotating'||lift?.094:-1.105],'r',pose.rGrip);
  return pose;
}

function shoulderCablePull(phase,options) {
  const {kind}=options;
  const t=cycle(phase);
  const left=phase<.5?1:-1, half=cycle(phase*2%1);
  const kayak=kind==='kayak';
  const crouched=kind==='twist';
  const fly=kind==='fly';
  const pose=torso([0,crouched?.758:.873,-.028],crouched?.994:fly?.103:.057,crouched?-.597*t:kayak?-.215*left*half:0);
  stance(pose,.179,crouched?.251:.119);
  if(kayak){
    const center=[0,mix(1.422,1.195,half),.378-.146*half];
    const gripAxis=unit([1,.65*left*half,-.16*left*half]);
    barHold(pose,center,'wide',{l:[.49,-.62,-.39],r:[-.49,-.62,-.39]},"over",gripAxis);
    barCable(pose,[0,2.115,1.150],center,gripAxis);
  }else{
    if(crouched)arm(pose,'l',add(pose.lk,[.026,.091,-.064]),[.67,-.72,-.18]);
    else restingArm(pose,'l',1);
    const s=pose.rs;
    const track=fly?blend([-.571,-.043,-.118],[.178,.042,.549],t):
      crouched?blend([-.029,-.042,.592],[-.122,-.239,.122],t):
      blend([-.105,.401,.444],[-.058,-.595,.084],t);
    arm(pose,'r',add(s,track),[-.63,-.34,-.79],vertical);
    singleCable(pose,[fly?-.946:0,fly?1.318:crouched?1.121:2.116,fly?-.339:1.141],'r',vertical);
  }
  return pose;
}

function crouchedTwinBar(phase) {
  const t=cycle(phase);
  const pose=torso([0,.753,-.247],1.330);
  stance(pose,.171,.025);
  const center=add(pose.chest,[0,-.542+.421*t,.086-.159*t]);
  barHold(pose,center,'medium',{l:[.62,-.05,-.73],r:[-.62,-.05,-.73]});
  pose.cables=sides.map(([,sign])=>({anchor:[sign*1.085,.174,.21],end:add(center,[sign*.675,0,0]),grip:lateral}));
  return pose;
}

function hangingCableLegRaise(phase) {
  const t=cycle(phase);
  const pose=torso([0,1.046,.133+.032*t],.015-.061*t);
  pose.planted={};
  for(const[side,sign]of sides){
    arm(pose,side,[sign*.305,2.144,.097],[sign*.71,-.24,-.64],lateral,handFacing.over);
    const angle=mix(-1.581,.122,t);
    const delta=[sign*.010,.419*Math.sin(angle),.419*Math.cos(angle)];
    pose[side+'k']=add(pose[side+'h'],delta);
    pose[side+'a']=add(pose[side+'k'],delta);
    pose[side+'t']=add(pose[side+'a'],[sign*.014,-.077,.125]);
  }
  pose.cables=sides.map(([side])=>({anchor:[0,.175,-1.230],end:pose[side+'a'],grip:unit(sub(pose[side+'k'],pose[side+'a']))}));
  return pose;
}

function cableBallFly(phase, one) {
  const t=cycle(phase);
  const pose=torso([0,.382,.222],-.827);
  pose.ballCenter=[0,.285,-.191];
  for(const[side,sign]of sides){
    leg(pose,side,sign,[sign*.239,.077,.670],[sign*.28,.84,.02]);
    const s=pose[side+'s'];
    if(one&&side==='l'){
      arm(pose,side,add(s,[.391,-.285,.137]),[.70,-.55,-.24]);
      continue;
    }
    const arc=unit(blend([sign*.985,-.152,.085],[-sign*.265,.822,.418],t));
    arm(pose,side,add(s,scale(arc,.592)),[sign*.61,-.81,-.15],unit([arc[2],.13,-arc[0]]));
  }
  if(one)singleCable(pose,[-.945,.174,-.391],'r',pose.rGrip);
  else dualCable(pose,[[.945,.174,-.391],[-.945,.174,-.391]]);
  return pose;
}

function cableBallRotation(phase) {
  const t=cycle(phase);
  const rotate=.737*t;
  const pose=torso([0,.610,.212],-1.505);
  pose.ballCenter=[0,.285,-.211];
  for(const [side,sign] of sides){
    const shoulder=pose[side+'s'];
    pose[side+'s']=[sign*.192*Math.cos(rotate),shoulder[1]+sign*.192*Math.sin(rotate),shoulder[2]];
    leg(pose,side,sign,[sign*.235,.077,.656],[sign*.29,.85,.02]);
  }
  const center=add(pose.chest,[-.549*Math.sin(rotate),.577*Math.cos(rotate),.091]);
  for(const[side,sign] of sides)arm(pose,side,add(center,[sign*.035,sign*.023*t,0]),[sign*.69,-.29,-.52],vertical);
  singleCable(pose,[-.988,1.984,-.150],'r',vertical);
  return pose;
}

function cablePreacherKneel(phase) {
  const t=cycle(phase);
  const pose=torso([0,.483,-.005],.427);
  kneel(pose);
  const elbow=[-.122,.727,.403];
  wristFromElbow(pose,'r',elbow,[0,Math.sin(mix(-.65,1.87,t)),Math.cos(mix(-.65,1.87,t))],[-1,0,0],handFacing.under);
  arm(pose,'l',[.179,.724,.303],[.75,-.40,-.53],[1,0,0]);
  singleCable(pose,[0,.182,1.13],'r',[-1,0,0]);
  return pose;
}

function sideCableFloor(phase,{mode,top=.92}) {
  const t=cycle(phase,.39,.61);
  const plank=mode==='plank';
  const incline=mode==='incline-leg'||mode==='incline-kick';
  const sideLeg=mode==='incline-leg'||mode==='floor-kick';
  const legWork=sideLeg||mode==='incline-kick';
  const supine=mode==='incline-kick';
  const trunk=incline?(supine?-1.028:-1.024):plank?-1.36:-1.558;
  const hipY=incline?.581:plank?.416:.143;
  const hip=[0,hipY,incline?.248:.209];
  const pose=torso(hip,trunk,0,supine?0:-.240);
  pose.planted={};
  if(!supine){
    const localSide=[0,1,.012];
    pose.lh=add(hip,scale(localSide,-.103));
    pose.rh=add(hip,scale(localSide,.103));
    const s=add(hip,[0,Math.cos(trunk)*.488,Math.sin(trunk)*.488]);
    pose.ls=add(s,scale(localSide,-.137));
    pose.rs=add(s,scale(localSide,.224));
  }
  for(const[side,sign]of sides){
    const active=side==='r'&&legWork;
    const direction=active
      ? unit([mode==='floor-kick'?-.536*t:0, (incline?-.283:-.086)+top*t,.985])
      : unit([supine?sign*.115:0,plank?-.365:incline?-.426:.051,.94]);
    pose[side+'k']=add(pose[side+'h'],scale(direction,.424));
    pose[side+'a']=add(pose[side+'k'],scale(direction,.417));
    pose[side+'t']=add(pose[side+'a'],[supine?sign*.012:-.123,.014,.097]);
  }
  if(incline) {
    pose.neck=add(pose.neck,[0,.032,.031]);
    pose.head=add(pose.head,[0,.089,.063]);
  }
  if(plank) {
    arm(pose,'l',[.278,.045,-.167],[.08,-.92,-.62],[0,0,1],[1,-.05,0]);
    pose.le=[.005,.076,-.159];
    const target=blend([-.475,.318,-.244],[-.077,pose.rs[1]-.088,pose.chest[2]+.192],t);
    arm(pose,'r',target,[-.601,.31,.37],vertical);
  } else if (legWork) {
    arm(pose,'l',[.156,incline?.563:.079,-.427],[.62,-.77,.044],[1,0,0]);
    arm(pose,'r',add(pose.rs,[-.225,-.088,-.272]),[-.65,-.72,.088],[1,0,0]);
  } else {
    arm(pose,'l',[.136,.056,-.451],[.47,-.66,.43],[1,0,0]);
    const angle=mix(.104,top,t);
    arm(pose,'r',add(pose.rs,[-.022,.587*Math.sin(angle),.583*Math.cos(angle)]),[-.51,.27,.66],lateral);
  }
  if(legWork)pose.cables=[{anchor:[mode==='floor-kick'?.943:0,.174,supine?-1.186:1.322],end:pose.ra,grip:unit(sub(pose.rk,pose.ra))}];
  else singleCable(pose,[plank?-.96:0,.175,plank?-.245:-1.237],'r',lateral);
  return pose;
}

function seatedFootCable(phase, {extension = false, invert = false}) {
  const t=cycle(phase);
  const pose=torso([0,extension?.564:.153,-.062],extension?-.042:-.201);
  if(extension){
    seatFeet(pose);
    pose.planted={l:0};
    const angle=mix(-1.515,-.029,t);
    pose.ra=add(pose.rk,[0,.424*Math.sin(angle),.424*Math.cos(angle)]);
    pose.rt=add(pose.ra,[-.014,-.062,.119]);
    for(const[side,sign] of sides)arm(pose,side,[sign*.183,.48,-.092],[sign*.65,-.39,-.54]);
    pose.cables=[{anchor:[0,.173,-.916],end:pose.ra,grip:unit(sub(pose.rk,pose.ra))}];
  }else{
    pose.planted={};
    for(const[side,sign] of sides){
      const d=unit([sign*.14,-.076,.989]);
      pose[side+'k']=add(pose[side+'h'],scale(d,.419));
      pose[side+'a']=add(pose[side+'k'],scale(d,.420));
      const angle=side==='r'?(invert?1:-1)*(.241+.441*t):0;
      pose[side+'t']=add(pose[side+'a'],[.135*Math.sin(angle),.130*Math.cos(angle),.099]);
      arm(pose,side,add(pose[side+'h'],[sign*.174,-.083,-.200]),[sign*.61,-.72,-.45],[1,0,0],[0,0,1]);
    }
    pose.cables=[{anchor:[invert?-.93:.93,.173,.82],end:pose.rt,grip:unit(sub(pose.ra,pose.rt))}];
  }
  return pose;
}

function cableHeadHarness(phase, flex) {
  const t=cycle(phase);
  const pose=torso([0,.565,-.028],.014);
  seatFeet(pose);
  const angle=flex?mix(-.228,.393,t):mix(.412,-.027,t);
  pose.head=add(pose.neck,[0,.115*Math.cos(angle),.115*Math.sin(angle)]);
  pose.headAim=[0,-Math.sin(angle),Math.cos(angle)];
  for(const[side,sign]of sides)arm(pose,side,add(pose[side+'k'],[sign*.021,.067,-.153]),[sign*.68,-.59,-.41]);
  pose.cables=[{anchor:[0,1.288,flex?-1.130:1.132],
    end:add(pose.head,[0,.019,(flex?-1:1)*.093]),grip:pose.headAim}];
  return pose;
}

function standingCableCrunch(phase, bentBar) {
  const t=cycle(phase);
  const pose=torso([0,.872-.041*t,-.084],.028+.925*t);
  stance(pose,.169);
  const location=add(pose.head,[0,.093-.019*t,.081+.037*t]);
  const anchor=[0,2.112,1.121];
  if(bentBar){
    barHold(pose,location,'ez',{l:[.59,-.74,.248],r:[-.59,-.74,.248]});
    barCable(pose,anchor,location);
  }else{
    for(const[side,sign]of sides)arm(pose,side,add(pose.head,[sign*.139,-.083,.025]),[sign*.66,-.72,.19],vertical);
    ropeCable(pose,anchor);
  }
  return pose;
}

function standingAnkleKick(phase) {
  const t=cycle(phase,.43,.58);
  const pose=torso([.026,.872,-.025],.095);
  stance(pose,.151,.042);
  delete pose.planted.r;
  const angle=-1.58-.714*t;
  const d=[-.025,.419*Math.sin(angle),.419*Math.cos(angle)];
  pose.rk=add(pose.rh,d);
  pose.ra=add(pose.rk,d);
  pose.rt=add(pose.ra,[-.016,-.061,.137]);
  arm(pose,'l',[.349,1.108,.30],[.76,-.63,-.18],[0,0,1]);
  restingArm(pose,'r',-1);
  pose.cables=[{anchor:[0,.176,1.115],end:pose.ra,grip:unit(sub(pose.rk,pose.ra))}];
  return pose;
}

function cableRollExtended(phase) {
  const t=cycle(phase);
  const pose=torso([0,.874,-.026],.043);
  stance(pose,.156,.067);
  const center=add(pose.chest,[0,.087+.059*t,.585-.049*t]);
  barHold(pose,center,'narrow',{l:[.38,-.793,-.09],r:[-.38,-.793,-.09]});
  for(const [side]of sides)pose[side+'Fingers']=unit([0,mix(.005,.91,t),mix(.983,.36,t)]);
  barCable(pose,[0,1.109,1.179],center);
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
  ["8878","dual-cable",(p) => hingedReverseFly(p,{crossed:true}),["rearShoulder","trap"],{...standingCamera,yaw:36,height:2.62}],
  ["9867","dual-cable",(p) => hingedReverseFly(p,{under:true}),["rearShoulder","trap"],{...standingCamera,yaw:27,height:2.62}],
  ["9868","cable",(p) => hingedReverseFly(p,{single:true}),["r:rearShoulder"],{...standingCamera,yaw:-12,height:2.46}],
  ["9869","cable",(p) => hingedReverseFly(p,{single:true,under:true}),["r:rearShoulder"],{...standingCamera,yaw:8,height:2.46}],
  ["0149","cable",(p) => overheadExtension(p,{one:true,low:true,bend:.08}),["r:triceps"],{...standingCamera,yaw:64,focus:[0,1.03,-.26],height:2.52}],
  ["3040","cable-straight-bar",(p) => overheadExtension(p,{bar:true}),["triceps"],{...standingCamera,yaw:-59,focus:[0,1.03,-.26],height:2.52}],
  ["11256","cable-flat-bench",(p) => pressWithCables(p,"flat"),["pec","triceps"],{...rowCamera,yaw:36,focus:[0,.94,-.06],height:2.62}],
  ["11264","cable-incline-bench",(p) => pressWithCables(p,"incline"),["pec","triceps"],{...rowCamera,yaw:32,focus:[0,.98,-.08],height:2.53}],
  ["4578","rope",hingedRopeKickback,["triceps"],{...standingCamera,yaw:65,height:2.49}],
  ["11269","cable",(p) => oneArmRow(p,{hinge:true,anchorHeight:.174}),["r:lat","r:biceps"],{...standingCamera,yaw:-59,height:2.43}],
  ["1607","cable-ez-bar",(p) => bicepsCurl(p,{grip:"ez"}),["biceps"],{...standingCamera,yaw:41}],
  ["1608","cable-ez-bar",(p) => bicepsCurl(p,{grip:"ez",reverse:true}),["forearm","biceps"],{...standingCamera,yaw:43}],
  ["6648","rope",uprightRopePull,["shoulder","trap"],{...standingCamera,yaw:43,height:2.35}],
  ["1722","rope",(p) => overheadExtension(p),["triceps"],{...standingCamera,yaw:53,focus:[0,1.03,-.26],height:2.5}],
  ["5874","cable-straight-bar",(p) => overheadExtension(p,{bar:true,bend:.40}),["triceps"],{...standingCamera,yaw:59,focus:[0,1.03,-.26],height:2.52}],
  ["3353","cable",(p) => overheadExtension(p,{one:true,bend:.30}),["r:triceps"],{...standingCamera,yaw:-67,focus:[0,1.03,-.26],height:2.54}],
  ["5703","cable-incline-medium",(p) => inclineCableCurl(p,false),["biceps"],{...rowCamera,yaw:61,focus:[0,.92,.35],height:2.54}],
  ["4345","cable-incline-short",(p) => inclineCableCurl(p,true),["biceps"],{...rowCamera,yaw:48,focus:[0,.94,.37],height:2.55}],
  ["0173","cable-incline-short",inclineCableExtension,["triceps"],{...rowCamera,yaw:-56,focus:[0,.96,-.39],height:2.54}],
  ["5741","rope",(p) => cableCrunch(p,"kneeling",{depth:1.10,anchorZ:.86}),["core"],{...standingCamera,yaw:63,height:2.44}],
  ["11270","rope",(p) => cableCrunch(p,"kneeling",{depth:1.17,anchorZ:.805}),["core"],{...standingCamera,yaw:57,height:2.43}],
  ["6542","dual-cable",kneelingCableFly,["pec"],{...standingCamera,yaw:29,height:2.57}],
  ["6755","cable",(p) => shoulderRotation(p,{kneeling:true,external:true}),["r:rearShoulder"],{...standingCamera,yaw:-32,height:2.28}],
  ["6756","cable",(p) => shoulderRotation(p,{kneeling:true}),["r:shoulder"],{...standingCamera,yaw:31,height:2.28}],
  ["4350","cable-medium-bar",(p) => floorCableCurl(p,true,true),["biceps"],{...rowCamera,yaw:58,focus:[0,.88,.35],height:2.57}],
  ["0182","cable-flat-bench-short",overheadFloorCurl,["biceps"],{...rowCamera,yaw:-59,focus:[0,1.11,-.34],height:2.78}],
  ["9705","cable-medium-bar",(p) => supineCableRaise(p,false),["shoulder"],{...rowCamera,yaw:58,focus:[0,.90,.37],height:2.55}],
  ["4227","cable-flat-bench-medium",(p) => supineCableRaise(p,true),["shoulder"],{...rowCamera,yaw:-59,focus:[0,.91,-.44],height:2.58}],
  ["3349","cable",(p) => weightedCableSquat(p),["quad","glute"],{...standingCamera,yaw:62}],
  ["3354","cable",(p) => weightedCableSquat(p,{depth:.328,width:.198}),["quad","glute"],{...standingCamera,yaw:56}],
  ["7578","cable-v-bar",(p) => weightedCableSquat(p,{vGrip:true}),["quad","glute"],{...standingCamera,yaw:53}],
  ["6544","rope",(p) => weightedCableSquat(p,{rope:true,goblet:true,depth:.369}),["quad","glute"],{...standingCamera,yaw:65}],
  ["11268","rope",(p) => weightedCableSquat(p,{rope:true,depth:.326}),["quad","glute"],{...standingCamera,yaw:59}],
  ["4356","cable",(p) => lowCablePallof(p),["core"],{...standingCamera,yaw:26,height:2.49}],
  ["4196","cable",(p) => lowCablePallof(p,{kneeling:true}),["core"],{...standingCamera,yaw:25,height:2.46}],
  ["4106","cable",(p) => lowCablePallof(p,{split:true}),["core"],{...standingCamera,yaw:27,height:2.48}],
  ["1605","cable-ez-bar",p=>tricepsPushdown(p,"ez"),["triceps"],{...standingCamera,yaw:52}],
  ["1606","cable-ez-bar",p=>tricepsPushdown(p,"ez",true),["triceps"],{...standingCamera,yaw:44}],
  ["2405","cable-arm-blaster-v",p=>tricepsPushdown(p,"pressV"),["triceps"],{...standingCamera,yaw:46}],
  ["2406","cable-arm-blaster-ez",p=>tricepsPushdown(p,"ez",true),["triceps"],{...standingCamera,yaw:48}],
  ["5033","cable-brace-rope",p=>singleElbowCable(p,{brace:true,roped:true}),["r:triceps"],{...standingCamera,yaw:-49}],
  ["4115","cable-straight-bar",p=>overheadExtension(p,{bar:true,low:true,bend:.061}),["triceps"],{...standingCamera,yaw:63,focus:[0,1.02,-.23],height:2.6}],
  ["11436","dual-cable",p=>twinOverheadExtension(p,false),["triceps"],{...standingCamera,yaw:23,focus:[0,1.04,-.20],height:2.61}],
  ["5528","dual-cable",p=>twinOverheadExtension(p,true),["triceps"],{...standingCamera,yaw:29,focus:[0,1.04,-.20],height:2.64}],
  ["1727","cable",p=>overheadExtension(p,{one:true,low:true,under:true,bend:.041}),["r:triceps"],{...standingCamera,yaw:-63,focus:[0,1.03,-.27],height:2.62}],
  ["11279","cable",p=>overheadExtension(p,{one:true,low:true,bend:.072}),["r:triceps"],{...standingCamera,yaw:-49,focus:[0,1.03,-.27],height:2.59}],
  ["4958","cable-single-rope",p=>overheadExtension(p,{one:true,low:true,bend:.11}),["r:triceps"],{...standingCamera,yaw:-62,focus:[0,1.03,-.27],height:2.59}],
  ["8614","cable",p=>singleElbowCable(p,{motion:"forward"}),["r:triceps"],{...standingCamera,yaw:-64,focus:[0,1.02,-.23],height:2.56}],
  ["0204","cable",p=>singleElbowCable(p,{motion:"side"}),["r:triceps","r:rearShoulder"],{...standingCamera,yaw:56,height:2.56}],
  ["11051","dual-cable",twinCrossPressdown,["triceps"],{...standingCamera,yaw:16,focus:[0,1.02,.10],height:2.64}],
  ["3719","cable",p=>singleElbowCable(p,{motion:"cross"}),["r:triceps"],{...standingCamera,yaw:-24,height:2.57}],
  ["4545","cable-one-arm-bench",p=>singleElbowCable(p,{motion:"kick",position:"bench"}),["r:triceps"],{...rowCamera,yaw:-62,focus:[0,.96,.48],height:2.59}],
  ["4567","cable-one-arm-bench-rope",p=>singleElbowCable(p,{motion:"kick",position:"bench",roped:true}),["r:triceps"],{...rowCamera,yaw:-54,focus:[0,.96,.48],height:2.61}],
  ["4566","cable",p=>singleElbowCable(p,{motion:"kick"}),["r:triceps"],{...standingCamera,yaw:-62,focus:[0,.98,.38],height:2.58}],
  ["1068","cable",p=>singleElbowCable(p,{motion:"kick"}),["r:triceps"],{...standingCamera,yaw:-53,focus:[0,.98,.38],height:2.54}],
  ["0219","dual-cable",p=>cablePressUp(p,{stagger:false}),["shoulder","triceps"],{...standingCamera,yaw:21,height:2.62}],
  ["11260","dual-cable",p=>cablePressUp(p,{kneeling:true}),["shoulder","triceps"],{...rowCamera,yaw:20,focus:[0,.93,-.13],height:2.57}],
  ["4010","cable-medium-bar",p=>cablePressUp(p,{kneeling:true,bar:true}),["shoulder","triceps"],{...rowCamera,yaw:48,focus:[0,.93,.38],height:2.59}],
  ["1260","cable-decline-single-press",p=>sculptedCablePress(p,{position:"decline",one:true}),["r:pec","r:triceps"],{...rowCamera,yaw:-57,focus:[0,.94,-.30],height:2.53}],
  ["1261","cable-decline-press",p=>sculptedCablePress(p,{position:"decline"}),["pec","triceps"],{...rowCamera,yaw:28,focus:[0,.95,-.27],height:2.59}],
  ["1265","cable-incline-single",p=>sculptedCablePress(p,{position:"incline",one:true}),["r:pec","r:triceps"],{...rowCamera,yaw:-41,focus:[0,.96,-.17],height:2.54}],
  ["1266","cable-seat-ball",p=>sculptedCablePress(p,{position:"incline-ball",one:true}),["r:pec","r:triceps","core"],{...rowCamera,yaw:-53,focus:[0,.91,-.18],height:2.59}],
  ["1267","cable-seat-ball",p=>sculptedCablePress(p,{position:"ball",one:true}),["r:pec","r:triceps","core"],{...rowCamera,yaw:-56,focus:[0,.94,-.28],height:2.57}],
  ["1268","cable-ball-dual",p=>sculptedCablePress(p,{position:"ball"}),["pec","triceps","core"],{...rowCamera,yaw:39,focus:[0,.96,-.21],height:2.62}],
  ["5814","dual-cable",p=>sculptedCablePress(p,{position:"standing",low:true}),["pec","triceps"],{...standingCamera,yaw:27,focus:[0,1.02,-.22],height:2.59}],
  ["11274","dual-cable",p=>sculptedCablePress(p,{position:"standing",alternate:true}),["pec","triceps"],{...standingCamera,yaw:25,focus:[0,1.02,-.23],height:2.61}],
  ["11764","cable",p=>sculptedCablePress(p,{position:"standing",one:true,under:true}),["r:pec","r:triceps"],{...standingCamera,yaw:-57,focus:[0,1.01,-.22],height:2.54}],
  ["0171","cable-incline-bench",p=>benchFly(p,"incline"),["pec"],{...rowCamera,yaw:39,focus:[0,.96,-.21],height:2.61}],
  ["3868","cable-supported-row",chestSupportedCableFly,["pec"],{...rowCamera,yaw:43,focus:[0,.98,.33],height:2.59}],
  ["11250","dual-cable",p=>crossCableFly(p,"middle"),["pec"],{...standingCamera,yaw:28,focus:[0,1.02,-.15],height:2.60}],
  ["11254","dual-cable",p=>crossCableFly(p,"reverse-shoulder"),["rearShoulder","trap"],{...standingCamera,yaw:155,focus:[0,1.02,.22],height:2.66}],
  ["11277","cable",p=>cableShoulderArc(p,"front"),["r:shoulder"],{...standingCamera,yaw:-63,focus:[0,1.01,-.31],height:2.58}],
  ["4014","cable",p=>cableShoulderArc(p,"eye"),["r:shoulder"],{...standingCamera,yaw:-58,focus:[0,1.01,-.30],height:2.59}],
  ["3342","dual-cable",p=>cableShoulderArc(p,"y-cross"),["rearShoulder","trap"],{...standingCamera,yaw:32,focus:[0,1.04,.30],height:2.63}],
  ["8899","dual-cable",p=>cableShoulderArc(p,"y-direct"),["rearShoulder","trap"],{...standingCamera,yaw:24,focus:[0,1.04,.31],height:2.65}],
  ["3880","cable-brace",p=>cableShoulderArc(p,"lean"),["r:shoulder"],{...standingCamera,yaw:18,focus:[.18,1.04,.18],height:2.58}],
  ["1635","cable-preacher-single",p=>isolatedCableCurl(p,"preacher-reverse"),["r:biceps","r:forearm"],{...rowCamera,yaw:-54}],
  ["1640","cable-preacher-single-rope",p=>isolatedCableCurl(p,"preacher-rope"),["r:biceps"],{...rowCamera,yaw:-52}],
  ["0209","cable-preacher-bar",p=>isolatedCableCurl(p,"preacher-both"),["forearm","biceps"],{...rowCamera,yaw:51}],
  ["6266","cable-seated-ez",p=>isolatedCableCurl(p,"overhead-ez"),["biceps"],{...rowCamera,yaw:48,focus:[0,1.03,.47],height:2.63}],
  ["1638","cable-seated-bar",p=>isolatedCableCurl(p,"overhead-wide"),["biceps"],{...rowCamera,yaw:58,focus:[0,1.06,.45],height:2.63}],
  ["11763","cable-incline-bench",p=>isolatedCableCurl(p,"incline"),["biceps"],{...rowCamera,yaw:25,focus:[0,.99,-.25],height:2.62}],
  ["3925","cable",p=>isolatedCableCurl(p,"floor"),["r:biceps"],{...rowCamera,yaw:-53,focus:[0,.90,.49],height:2.59}],
  ["7921","cable-seated",p=>isolatedCableCurl(p,"seat-1"),["r:biceps"],{...rowCamera,yaw:-54}],
  ["7922","cable-seated",p=>isolatedCableCurl(p,"seat-2"),["r:biceps"],{...rowCamera,yaw:-58}],
  ["0229","dual-cable",p=>sideOverheadArms(p,"standing-curl"),["biceps"],{...standingCamera,yaw:22,focus:[0,1.01,.15],height:2.61}],
  ["5370","cable-brace-rope",p=>isolatedCableCurl(p,"hammer"),["r:biceps","r:forearm"],{...standingCamera,yaw:-49}],
  ["4194","cable",p=>halfKneelingRotationPress(p,{raised:false}),["r:rearShoulder"],{...rowCamera,yaw:-8,focus:[.22,.99,.19],height:2.5}],
  ["8879","cable",p=>halfKneelingRotationPress(p,{raised:false,press:true}),["r:rearShoulder","r:shoulder"],{...rowCamera,yaw:18,focus:[.22,.99,.19],height:2.57}],
  ["5821","cable",p=>halfKneelingRotationPress(p,{raised:true,press:true}),["r:rearShoulder","r:shoulder"],{...rowCamera,yaw:16,focus:[.22,.99,.19],height:2.59}],
  ["10597","cable",p=>shoulderRotation(p,{raised:true}),["r:shoulder"],{...standingCamera,yaw:-37,focus:[-.10,1.03,-.20],height:2.59}],
  ["0243","cable",p=>torsoCableTurn(p,{}),["core"],{...standingCamera,yaw:17,height:2.48}],
  ["5118","cable",p=>torsoCableTurn(p,{short:true}),["core"],{...standingCamera,yaw:23,height:2.49}],
  ["1069","cable",p=>torsoCableTurn(p,{step:true}),["core"],{...standingCamera,yaw:24,height:2.54}],
  ["11271","cable",p=>torsoCableTurn(p,{short:false}),["core"],{...standingCamera,yaw:27,height:2.55}],
  ["0174","cable",p=>torsoCableTurn(p,{flip:true,step:true}),["core"],{...standingCamera,yaw:29,height:2.53}],
  ["1207","cable",p=>torsoCableTurn(p,{axis:"up"}),["core"],{...standingCamera,yaw:24,height:2.57}],
  ["0230","cable",p=>torsoCableTurn(p,{axis:"up",step:true}),["core"],{...standingCamera,yaw:23,height:2.56}],
  ["7585","cable",p=>torsoCableTurn(p,{axis:"up",short:true,step:true}),["core","quad"],{...standingCamera,yaw:20,height:2.57}],
  ["0862","cable",p=>torsoCableTurn(p,{axis:"down"}),["core"],{...standingCamera,yaw:22,height:2.57}],
  ["1208","cable",p=>torsoCableTurn(p,{axis:"down",step:true}),["core"],{...standingCamera,yaw:28,height:2.56}],
  ["7584","cable",p=>torsoCableTurn(p,{axis:"down",anti:true,position:"kneeling"}),["core"],{...rowCamera,yaw:16,height:2.63}],
  ["11251","cable",p=>torsoCableTurn(p,{axis:"down",position:"half"}),["core"],{...rowCamera,yaw:20,height:2.61}],
  ["6760","cable",p=>torsoCableTurn(p,{position:"kneeling",short:true}),["core"],{...rowCamera,yaw:17,height:2.48}],
  ["4042","cable-seated",p=>torsoCableTurn(p,{position:"bench"}),["core"],{...rowCamera,yaw:19,height:2.50}],
  ["2399","cable-seated",p=>torsoCableTurn(p,{position:"bench",short:true}),["core"],{...rowCamera,yaw:15,height:2.50}],
  ["2434","cable-mat",p=>torsoCableTurn(p,{position:"floor",short:true}),["core"],{...rowCamera,yaw:22,height:2.44}],
  ["2396","cable-mat-medium",p=>supineCableWork(p,{motion:"curl",bench:false}),["biceps"],{...rowCamera,yaw:68,height:2.42}],
  ["3362","cable-flat-bench-v",p=>supineCableWork(p,{motion:"close"}),["pec","triceps"],{...rowCamera,yaw:-51,focus:[0,.90,-.39],height:2.58}],
  ["4225","cable-mat-medium",p=>supineCableWork(p,{motion:"upright",bench:false}),["shoulder","trap"],{...rowCamera,yaw:66,height:2.44}],
  ["9492","cable-mat-ez",p=>supineCableWork(p,{motion:"upright",bench:false,ez:true}),["shoulder","trap"],{...rowCamera,yaw:56,height:2.43}],
  ["4226","cable-flat-bench-medium",p=>supineCableWork(p,{motion:"shrug"}),["trap"],{...rowCamera,yaw:74,focus:[0,.89,.31],height:2.39}],
  ["11273","cable-flat-bench",p=>supineCableWork(p,{motion:"fly"}),["pec"],{...rowCamera,yaw:27,focus:[0,.93,-.32],height:2.62}],
  ["9872","cable-flat-bench",p=>supineCableWork(p,{motion:"cross"}),["shoulder"],{...rowCamera,yaw:22,focus:[0,.93,-.31],height:2.62}],
  ["9873","cable-flat-bench-single",p=>supineCableWork(p,{motion:"cross",one:true}),["r:shoulder"],{...rowCamera,yaw:31,focus:[0,.93,-.29],height:2.52}],
  ["4013","cable-flat-bench-single",p=>supineCableWork(p,{motion:"cross",one:true}),["r:shoulder"],{...rowCamera,yaw:26,focus:[0,.93,-.31],height:2.55}],
  ["9874","cable-mat",p=>supineCableWork(p,{motion:"cross",one:true,bench:false}),["r:shoulder"],{...rowCamera,yaw:38,focus:[0,.92,-.30],height:2.53}],
  ["4224","cable-mat",p=>supineCableWork(p,{motion:"pallof",bench:false}),["core"],{...rowCamera,yaw:36,focus:[-.12,.87,-.32],height:2.56}],
  ["4197","cable-mat",p=>supineCableWork(p,{motion:"pallof",bench:false,brace:true}),["core","glute"],{...rowCamera,yaw:36,focus:[-.10,.87,-.32],height:2.58}],
  ["7597","cable-supported-row",p=>proneBenchCable(p,{motion:"row"}),["lat","biceps"],{...rowCamera,yaw:12,focus:[0,1.04,.38],height:2.76}],
  ["7587","cable-chest-single",p=>proneBenchCable(p,{motion:"row",one:true,depth:.59}),["r:lat","r:biceps"],{...rowCamera,yaw:65,focus:[0,1.02,.39],height:2.68}],
  ["4012","cable-supported-row",p=>proneBenchCable(p,{motion:"rear"}),["rearShoulder","trap"],{...rowCamera,yaw:33,height:2.59}],
  ["7592","cable-supported-row",p=>proneBenchCable(p,{motion:"rear",depth:1.01}),["rearShoulder","trap"],{...rowCamera,yaw:31,height:2.64}],
  ["4122","cable",p=>proneBenchCable(p,{motion:"rear",one:true,standing:true}),["r:rearShoulder","r:trap"],{...standingCamera,yaw:-29,height:2.58}],
  ["9870","cable-chest-single",p=>proneBenchCable(p,{motion:"y",one:true}),["r:rearShoulder","r:trap"],{...rowCamera,yaw:70,focus:[0,.98,.39],height:2.66}],
  ["9871","cable-chest-wrist",p=>proneBenchCable(p,{motion:"y",one:true,cuff:true}),["r:rearShoulder","r:trap"],{...rowCamera,yaw:65,focus:[0,.98,.39],height:2.66}],
  ["8661","cable-supported-row",p=>proneBenchCable(p,{motion:"y"}),["rearShoulder","trap"],{...rowCamera,yaw:27,height:2.61}],
  ["8663","cable-chest-dual-wrist",p=>proneBenchCable(p,{motion:"y",cuff:true}),["rearShoulder","trap"],{...rowCamera,yaw:24,height:2.63}],
  ["1205","cable-seated",p=>seatedSingleCableRow(p,{twist:true}),["r:lat","core"],{...rowCamera,yaw:-55}],
  ["9875","cable-seated",p=>seatedSingleCableRow(p,{twist:true,mode:"floor-seat"}),["r:lat","core"],{...rowCamera,yaw:-61}],
  ["0214","cable-seated",p=>seatedSingleCableRow(p,{alternate:true}),["lat","biceps"],{...rowCamera,yaw:41}],
  ["10112","cable-seated",p=>seatedSingleCableRow(p,{}),["r:lat","r:biceps"],{...rowCamera,yaw:-61}],
  ["10437","cable-seated-single-rope",p=>seatedSingleCableRow(p,{}),["r:lat","r:biceps"],{...rowCamera,yaw:-55}],
  ["11263","cable",p=>seatedSingleCableRow(p,{mode:"standing",twist:true,stanceRow:true}),["r:lat","core"],{...standingCamera,yaw:-57}],
  ["6776","cable",p=>seatedSingleCableRow(p,{mode:"standing",rear:true}),["r:rearShoulder","r:trap"],{...standingCamera,yaw:-54}],
  ["3943","cable-supported-row",p=>cableSeatedSymmetry(p,{mode:"rev",chested:true}),["rearShoulder"],{...rowCamera,yaw:30,height:2.58}],
  ["3869","cable-seated-dual",p=>cableSeatedSymmetry(p,{mode:"fly"}),["pec"],{...rowCamera,yaw:29,focus:[0,1.04,.38],height:2.75}],
  ["3364","cable-seated-dual",p=>cableSeatedSymmetry(p,{mode:"press",close:true}),["pec","triceps"],{...rowCamera,yaw:30,focus:[0,1.04,.38],height:2.74}],
  ["8881","cable-seated",p=>wristCable(p,{position:"seat",one:true,pronate:true}),["r:forearm"],{...rowCamera,yaw:80,focus:[0,.93,.32],height:2.43}],
  ["4163","cable-seated",p=>wristCable(p,{position:"seat",one:true}),["r:forearm"],{...rowCamera,yaw:73,focus:[0,.93,.32],height:2.43}],
  ["0224","cable-short-bar",p=>wristCable(p,{position:"back"}),["forearm"],{...standingCamera,yaw:-128,focus:[0,.99,-.29],height:2.57}],
  ["6367","cable-short-bar",p=>wristCable(p,{position:"back",reverse:true}),["forearm"],{...standingCamera,yaw:-126,focus:[0,.99,-.29],height:2.57}],
  ["6360","cable-short-bar",p=>wristCable(p,{}),["forearm"],{...standingCamera,yaw:61}],
  ["6363","cable-short-bar",p=>wristCable(p,{reverse:true}),["forearm"],{...standingCamera,yaw:56}],
  ["0247","cable-straight-bar",p=>wristCable(p,{}),["forearm"],{...standingCamera,yaw:48}],
  ["4228","dual-cable",p=>cableTwoDirections(p,{kneeling:true}),["core","pec","lat"],{...rowCamera,yaw:-4,focus:[0,.99,.2],height:2.76}],
  ["11258","dual-cable",p=>cableTwoDirections(p,{}),["core","pec","lat"],{...standingCamera,yaw:2,focus:[0,1.03,.20],height:2.76}],
  ["8662","cable-incline-v",p=>inclineCablePull(p,{kind:"v-shoulder"}),["shoulder","triceps"],{...rowCamera,yaw:-53,focus:[0,.91,-.36],height:2.56}],
  ["0172","cable-incline-medium",p=>inclineCablePull(p,{kind:"incline"}),["lat","biceps"],{...latCamera,yaw:-55,focus:[0,1.05,-.35]}],
  ["4957","cable-flat-bench-medium",p=>inclineCablePull(p,{kind:"lying"}),["lat","biceps"],{...latCamera,yaw:-56,focus:[0,1.02,-.35]}],
  ["11262","cable-ankle-mat-dual",p=>supineAnkleCable(p,true),["core"],{...rowCamera,yaw:63,height:2.56}],
  ["0873","cable-ankle-mat-dual",p=>supineAnkleCable(p,false),["core"],{...rowCamera,yaw:60,height:2.52}],
  ["9304","cable-lat-neutral-wide",p=>latPulldown(p,{grip:"wideNeutral",chest:true}),latMuscles,{...latCamera,yaw:47}],
  ["4217","cable-lat-neutral-wide",p=>latPulldown(p,{grip:"wideNeutral",full:true}),latMuscles,{...latCamera,yaw:51}],
  ["6392","cable-lat-mag",p=>latPulldown(p,{grip:"mag",chest:true}),latMuscles,{...latCamera,yaw:51}],
  ["0818","cable-lat-dual",p=>independentLat(p,false,true),latMuscles,{...latCamera,yaw:34,height:2.77}],
  ["5553","cable-row-bar",p=>seatedRow(p,{steady:true,anchorY:.22}),latMuscles,{...rowCamera,yaw:54}],
  ["11257","cable-elevated-row",p=>seatedRow(p,{grip:"rope",mode:"high-row",high:true,anchorY:1.56}),latMuscles,{...rowCamera,yaw:54,height:2.58}],
  ["11252","cable",cableOverheadSquat,["quad","core"],{...standingCamera,yaw:25,height:2.56}],
  ["2758","cable",p=>weightedCableSquat(p,{depth:.411,width:.187}),["quad","glute"],{...standingCamera,yaw:56}],
  ["6552","cable-medium-bar",p=>hingeWithCable(p,false,true),["hamstring","glute"],{...standingCamera,yaw:57,height:2.56}],
  ["1213","cable",p=>lowCablePallof(p,{high:true}),["core"],{...standingCamera,yaw:28,height:2.58}],
  ["4351","cable-incline-medium",p=>compoundCableTriceps(p,{kind:"incline-bar"}),["triceps"],{...rowCamera,yaw:-60,focus:[0,.93,-.34],height:2.63}],
  ["1725","cable-incline-rope",p=>compoundCableTriceps(p,{kind:"incline-rope"}),["triceps"],{...rowCamera,yaw:-69,focus:[0,.93,-.30],height:2.59}],
  ["5916","cable-seated-medium",p=>compoundCableTriceps(p,{kind:"seated"}),["triceps"],{...rowCamera,yaw:71,focus:[0,1.05,-.33],height:2.65}],
  ["3920","cable-mat-medium",p=>compoundCableTriceps(p,{kind:"floor"}),["triceps"],{...rowCamera,yaw:64,focus:[0,.94,.38],height:2.45}],
  ["4893","cable",p=>compoundCableTriceps(p,{kind:"kneeling"}),["r:triceps"],{...rowCamera,yaw:64,height:2.51}],
  ["11060","rope",p=>supportedRopeFace(p,{external:true}),["rearShoulder","trap"],{...rowCamera,yaw:68,focus:[0,1.02,.29],height:2.54}],
  ["7591","cable-flat-bench-rope",p=>supportedRopeFace(p,{lying:true}),["rearShoulder","trap"],{...rowCamera,yaw:65,focus:[0,1.03,-.35],height:2.73}],
  ["2835","cable-chair",p=>seatedSpecialCable(p,{kind:"chair"}),["quad","glute"],{...standingCamera,yaw:59,focus:[0,.95,.35],height:2.51}],
  ["3358","cable-v-bar",p=>seatedSpecialCable(p,{kind:"floor-lat"}),latMuscles,{...rowCamera,yaw:58,focus:[0,.95,.42],height:2.49}],
  ["4180","cable-seated-rope",p=>seatedSpecialCable(p,{kind:"pullover"}),["lat"],{...rowCamera,yaw:69,focus:[0,.98,.40],height:2.58}],
  ["3352","cable-mat",p=>crouchedCable(p,{kind:"kneeling"}),["glute","hamstring"],{...rowCamera,yaw:62,focus:[0,.93,-.33],height:2.49}],
  ["1800","cable",p=>crouchedCable(p,{kind:"stretch"}),["lat"],{...rowCamera,yaw:62,height:2.55}],
  ["2836","cable-training-box",p=>crouchedCable(p,{kind:"boxHinge"}),["glute","hamstring"],{...rowCamera,yaw:63,focus:[0,1.04,.34],height:2.63}],
  ["2837","cable-training-box",p=>crouchedCable(p,{kind:"stepLunge"}),["quad","glute"],{...rowCamera,yaw:75,focus:[0,1.04,.34],height:2.66}],
  ["2744","cable-waist-belt",p=>crouchedCable(p,{kind:"belt"}),["glute","hamstring"],{...rowCamera,yaw:65,focus:[0,.97,-.34],height:2.57}],
  ["9878","cable-medium-bar",p=>crouchedCable(p,{kind:"zercher"}),["quad","core"],{...standingCamera,yaw:64,focus:[0,.98,-.32],height:2.53}],
  ["0222","cable",p=>cableSideFlexion(p,{into:true}),["core"],{...standingCamera,yaw:-8,height:2.49}],
  ["5657","cable",p=>cableSideFlexion(p,{}),["core"],{...standingCamera,yaw:8,height:2.51}],
  ["11278","cable",p=>cableSideFlexion(p,{kind:"small"}),["core"],{...standingCamera,yaw:16,height:2.56}],
  ["0221","cable-bosu-dual",p=>cableSideFlexion(p,{kind:"bosu"}),["core"],{...standingCamera,yaw:11,height:2.55}],
  ["6693","cable-mat",p=>cableSideFlexion(p,{kind:"kneel"}),["core"],{...standingCamera,yaw:13,height:2.54}],
  ["8880","cable",p=>cableRotatingPress(p,{kind:"jab"}),["r:pec","r:shoulder","core"],{...standingCamera,yaw:-55,focus:[0,1.01,-.36],height:2.58}],
  ["8900","cable",p=>cableRotatingPress(p,{kind:"jab",compact:true}),["r:pec","r:shoulder","core"],{...standingCamera,yaw:62,focus:[0,1.01,-.30],height:2.61}],
  ["1209","cable",p=>cableRotatingPress(p,{kind:"overhead"}),["r:shoulder","core"],{...standingCamera,yaw:16,height:2.60}],
  ["1211","cable",p=>cableRotatingPress(p,{kind:"rotating"}),["r:pec","core"],{...standingCamera,yaw:-19,height:2.61}],
  ["11272","dual-cable",p=>cableRotatingPress(p,{kind:"arnold"}),["shoulder","biceps"],{...standingCamera,yaw:14,height:2.65}],
  ["2464","cable-wide-bar",p=>shoulderCablePull(p,{kind:"kayak"}),latMuscles,{...standingCamera,yaw:-43,height:2.65}],
  ["0244","cable",p=>shoulderCablePull(p,{kind:"twist"}),["r:lat","core"],{...standingCamera,yaw:70,height:2.55}],
  ["5844","cable",p=>shoulderCablePull(p,{kind:"straight"}),["r:lat"],{...standingCamera,yaw:66,height:2.64}],
  ["10095","cable",p=>shoulderCablePull(p,{kind:"fly"}),["r:pec"],{...standingCamera,yaw:-27,focus:[0,1.01,-.15],height:2.56}],
  ["1238","cable-seated-ez",p=>seatedRow(p,{mode:"seat",grip:"ez",anchorY:.25}),latMuscles,{...rowCamera,yaw:68,height:2.53}],
  ["6035","cable-seated-parallel",p=>seatedRow(p,{mode:"seat",grip:"wideNeutral",anchorY:.27,high:true}),["rearShoulder","trap"],{...rowCamera,yaw:63,height:2.52}],
  ["1861","cable-v-bar",p=>bicepsCurl(p,{grip:"v"}),["biceps"],{...standingCamera,yaw:66,height:2.51}],
  ["4011","cable-twin-long-bar",crouchedTwinBar,latMuscles,{...standingCamera,yaw:23,focus:[0,.97,.24],height:2.73}],
  ["2887","cable-hanging-ankles",hangingCableLegRaise,["core"],{...standingCamera,yaw:66,focus:[0,1.14,-.21],height:2.71}],
  ["0170","cable-ball-dual",p=>cableBallFly(p,false),["pec"],{...rowCamera,yaw:21,focus:[0,.93,-.21],height:2.70}],
  ["1264","cable-seat-ball",p=>cableBallFly(p,true),["r:pec"],{...rowCamera,yaw:12,focus:[-.26,1.02,-.20],height:2.69}],
  ["0211","cable-seat-ball",cableBallRotation,["core"],{...rowCamera,yaw:10,focus:[-.26,1.06,-.20],height:2.68}],
  ["5120","cable-ankle-extension",standingAnkleKick,["r:glute"],{...standingCamera,yaw:72,focus:[0,.99,.32],height:2.54}],
  ["5297","cable-preacher-kneel",cablePreacherKneel,["r:biceps"],{...rowCamera,yaw:66,height:2.49}],
  ["9927","cable-incline-ankle",p=>sideCableFloor(p,{mode:"incline-leg",top:.85}),["r:glute"],{...rowCamera,yaw:76,focus:[0,.95,.34],height:2.58}],
  ["9928","cable-incline-ankle",p=>sideCableFloor(p,{mode:"incline-kick",top:1.10}),["r:glute"],{...rowCamera,yaw:74,focus:[0,.98,-.31],height:2.60}],
  ["9863","cable-ankle-floor",p=>sideCableFloor(p,{mode:"floor-kick",top:.39}),["r:glute"],{...rowCamera,yaw:-24,focus:[.23,.94,.12],height:2.49}],
  ["2924","cable-mat",p=>sideCableFloor(p,{mode:"lateral",top:1.11}),["r:shoulder"],{...rowCamera,yaw:72,focus:[0,.88,-.32],height:2.46}],
  ["9491","cable-mat",p=>sideCableFloor(p,{mode:"lateral",top:1.43}),["r:shoulder"],{...rowCamera,yaw:68,focus:[0,.88,-.31],height:2.50}],
  ["11275","cable-mat",p=>sideCableFloor(p,{mode:"plank"}),["core","r:lat"],{...rowCamera,yaw:47,focus:[-.24,.93,-.18],height:2.56}],
  ["6745","cable-foot-strap",p=>seatedFootCable(p,{}),["r:shin"],{...rowCamera,yaw:29,focus:[.30,.89,.45],height:2.49}],
  ["6746","cable-foot-strap",p=>seatedFootCable(p,{invert:true}),["r:shin"],{...rowCamera,yaw:-35,focus:[-.28,.89,.45],height:2.49}],
  ["5664","cable-seated-ankle",p=>seatedFootCable(p,{extension:true}),["r:quad"],{...rowCamera,yaw:67,focus:[0,.95,-.18],height:2.57}],
  ["2411","cable-head-harness",p=>cableHeadHarness(p,false),["neck"],{...rowCamera,yaw:75,focus:[0,.98,.34],height:2.51}],
  ["2412","cable-head-harness",p=>cableHeadHarness(p,true),["neck"],{...rowCamera,yaw:75,focus:[0,.98,-.34],height:2.51}],
  ["0226","cable-ez-bar",p=>standingCableCrunch(p,true),["core"],{...rowCamera,yaw:62,focus:[0,.98,.36],height:2.57}],
  ["0874","rope",p=>standingCableCrunch(p,false),["core"],{...rowCamera,yaw:70,focus:[0,.98,.36],height:2.58}],
  ["6269","cable-short-bar",cableRollExtended,["forearm"],{...rowCamera,yaw:67,focus:[0,1.03,.43],height:2.56}],
  ["1819","cable-short-bar",p=>crouchedCable(p,{kind:"supination"}),["lat","biceps","forearm"],{...rowCamera,yaw:70,focus:[0,1.03,.31],height:2.56}],
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
