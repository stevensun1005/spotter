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

function latPulldown(phase, { grip = "wide", rear = false, under = false, full = false }) {
  const t = cycle(phase);
  const lean = rear ? .048 : -.13 - t * .066;
  const pose = torso([0, .567, -.017], lean);
  seatFeet(pose, "lat");
  const z = rear ? -.259 : mix(.236,.263,t);
  const width = widths[grip];
  const reach = Math.sqrt(.597 ** 2 - (width - .192) ** 2 - (z - pose.ls[2]) ** 2);
  const start = pose.ls[1] + reach + (barDrop[grip] ?? 0);
  const end = rear ? 1.228 : full ? 1.181 : 1.235;
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

function seatedRow(phase, {mode = "row", grip = "straight", anchorY = .27, high = false, under = false, crossover = false}) {
  const t = cycle(phase);
  const height = mode === "floor-row" ? .165 : mode === "high-row" ? .651 : mode === "seat" ? .565 : .435;
  const pitch = under ? .126 : mode === "decline-row" ? -.123 : mix(.075,-.026,t);
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

function standingRow(phase, {grip = "v", twist = false, upright = false, high = false}) {
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
  barCable(pose,[twist ? .864 : 0, high ? 1.161 : .175, twist ? .59 : .977],center,axis);
  return pose;
}

function oneArmRow(phase, {hinge = false, onKnees = false, turn = false, facePull = false}) {
  const t = cycle(phase);
  const side = facePull ? "l" : "r";
  const sign = side === "l" ? 1 : -1;
  const yaw = facePull ? -.22 : 0;
  const pose = torso([0,onKnees ? .481 : hinge ? .797 : .866,-.054], hinge ? 1.005 : .108, yaw);
  if (onKnees) kneel(pose);
  else stance(pose,.163,facePull ? .16 : .042);
  const shoulder = pose[side + "s"];
  const reach = facePull ? .529 : hinge ? .291 : .527;
  let low = facePull ? -.284 : hinge ? -.509 : -.132;
  if (onKnees) low = -.082;
  const start = add(shoulder,[sign * .027,low,reach]);
  const destination = add(shoulder,[sign * (facePull ? .167 : .058),facePull ? -.129 : -.231, -.063]);
  const grasp = blend(start,destination,t);
  const grip = turn ? [Math.cos(t*Math.PI),Math.sin(t*Math.PI),0] : facePull ? lateral : vertical;
  arm(pose,side,grasp,[sign * .72, -.35, -.89],grip);
  restingArm(pose,side === "r" ? "l" : "r",-sign);
  const anchor = [0, onKnees ? 1.062 : turn ? 1.075 : .239, hinge ? 1.17 : 1.081];
  singleCable(pose,anchor,side,grip);
  return pose;
}

function ropeFaceRow(phase, {kneeling = false, low = false, chest = false}) {
  const t = cycle(phase);
  const pose = torso([0,kneeling ? .485 : .876,-.053], kneeling ? -.03 : .018);
  if (kneeling) kneel(pose);
  else stance(pose,.159,.049);
  const shoulder = pose.ls;
  const anchor = [0,kneeling ? 1.05 : low ? .947 : 1.31,1.142];
  for (const [side, sign] of sides) {
    const start = [sign * .104,shoulder[1] - (low ? .177 : .066),shoulder[2] + .562];
    const end = [sign * (chest ? .208 : .248),shoulder[1] + (chest ? -.112 : .108),shoulder[2] + .108];
    arm(pose,side,blend(start,end,t),[sign * .97,.08,-.89]);
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
    position = "stand", rope = false} = variant;
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
    const elbow = add(pose[side + "s"],[sign * .035,-.243,seated ? .114 : drag ? -.167 * t : -.005]);
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

function hingeWithCable(phase, pullThrough = false) {
  const t = cycle(phase);
  const pose = torso([0,mix(.753,.889,t),mix(-.235,-.025,t)],mix(1.113,.021,t));
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
  const seated = variant==="seat";
  const incl = variant==="incline";
  const pose = seated ? torso([0,.573,-.012],-.031): lyingBench(variant);
  if (seated) seatFeet(pose);
  for (const [side,sign] of sides) {
    const shoulder = pose[side+"s"];
    const start = add(shoulder,[sign*.161,seated?-.058:.108,seated?.166:incl?.126:.067]);
    const end = add(shoulder,[-sign*.064,seated?.021:incl?.447:.591,seated?.593:incl?.378:.125]);
    arm(pose,side,blend(start,end,t),[sign*.88,seated?-.53:-.98,seated?-.52:.04],lateral,handFacing.over);
  }
  dualCable(pose,[[.761,seated?1.020:.20,seated?-.438:-.34],[-.761,seated?1.020:.20,seated?-.438:-.34]]);
  return pose;
}

function crossCableFly(phase, mode) {
  const t = cycle(phase);
  const reverse = mode === "reverse";
  const low = mode === "low";
  const crossed = low || mode === "upright";
  const seated = mode === "seated-reverse";
  const ball = mode === "ball";
  const one = ball;
  const pose = torso([0,seated?.566:ball?.601:.877,-.018],mode==="middle"?.235:.052);
  if (seated || ball) seatFeet(pose);
  else stance(pose,.173,mode==="middle"?.14:.06,.03);
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
      [sign*.353,-.710,-.414],ball ? vertical : lateral,handFacing.over);
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
