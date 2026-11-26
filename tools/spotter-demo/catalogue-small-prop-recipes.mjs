import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, inactive, ramp, sides } from "./catalogue-dumbbell-recipes.mjs";

const axis = [1, 0, 0];
const floor = .075;
const medRadius = .111;
const foamRadius = .080;

function palm(pose, side, point, pole, fingers = [0, 0, 1]) {
  arm(pose, side, point, pole);
  pose[side + "Fingers"] = fingers;
  pose[side + "PalmSide"] = axis;
}

function restFeet(pose, depth, height = floor, width = .145) {
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * width, height, depth], [sign * .16, .09, .97]);
  }
}

function pushUp(phase, { kind = "medicine", narrow = false, offset = false } = {}) {
  const descent = cycle(phase, .38, .52);
  const dome = kind === "bosu";
  const propDepth = dome ? 0 : .119;
  const wristDepth = dome ? -.020 : .078;
  const supportHeight = dome ? .240 : offset ? .238 : .224;
  const anklesY = .137;
  const shoulderHeight = (offset ? .672 : .537 + supportHeight) - (offset ? .279 : .262) * descent;
  const angle = Math.acos((shoulderHeight - anklesY) / 1.34);
  const depth = wristDepth - 1.308;
  const pelvis = [offset ? .030 : 0, anklesY + .832 * Math.cos(angle), depth + .832 * Math.sin(angle)];
  const pose = body(pelvis, angle, 0, offset ? -.274 : 0);
  const ballTravel = offset ? ramp(phase,.50,.68) * (1-ramp(phase,.78,1)) * .091 : 0;
  if (!dome) {
    pose.ballCenter = [offset ? .219 : 0, medRadius, propDepth + ballTravel];
    pose.machineTravel = ballTravel / medRadius;
  }
  for (const [side, sign] of sides) {
    const x = dome ? sign * .221 : offset ? sign * .219 : sign * (narrow ? .059 : .078);
    const wristY = offset && side === "r" ? .078 : supportHeight;
    const wristZ = side === "r" && offset ? wristDepth - .012 : wristDepth + ballTravel;
    palm(pose, side, [x,wristY,wristZ], [sign * (narrow ? .23 : .86), .10, -.68], [sign * -.14,.042,.98]);
    foot(pose, side, sign, [sign * .145,anklesY,depth], [sign*.103,-.13,.84], [sign*.018,-.114,-.060]);
    delete pose.planted[side];
  }
  return pose;
}

function bosuSquat(phase) {
  const amount = cycle(phase);
  const pose = body([0,.317+.792-.338*amount,-.047-.201*amount],.023+.362*amount);
  restFeet(pose,-.041,.317,.162);
  for (const [side,sign] of sides) {
    pose.planted[side]=.240;
    const wrist = add(pose.chest, [sign * (.081+.055*amount), -.167+.164*amount, .173+.256*amount]);
    palm(pose, side, wrist, [sign * .45,-.72,.33], [sign * -.56,.11,.82]);
  }
  return pose;
}

function throwBall(phase, { seated = false } = {}) {
  const drop = ramp(phase,0,.21)*(1-ramp(phase,.25,.44));
  const press = ramp(phase,.23,.45)*(1-ramp(phase,.77,1));
  const flightTime = Math.max(0,Math.min(1,(phase-.45)/.32));
  const flying = Math.max(0,4*flightTime*(1-flightTime));
  const pose = seated ? body([.1,.551,1.273],-Math.PI/2) : body([0,.889-.292*drop,-.062-.124*drop],.035+.275*drop);
  restFeet(pose,seated?1.557:.052,floor,seated?.23:.167);
  if (seated) for (const [side,sign] of sides) {
    foot(pose,side,sign,[.1+sign*.241,floor,1.564],[sign*.12,.65,.97]);
  }
  const height = seated ? .812+.374*press : pose.ls[1]-.21+.735*press;
  const held = [seated?.1:0,height,seated?.813:.281-.132*press];
  pose.ballCenter = add(held,[0,(seated?.64:.52)*flying,0]);
  pose.machineTravel = 1.08 * press + 3.56 * flying;
  for (const [side,sign] of sides) {
    const hand = add(held,[sign*.089,-.047+.044*press,.021]);
    palm(pose,side,hand,[sign*.58,-.36,.66],[sign*-.54,.49,.62]);
  }
  return pose;
}

function foamHip(phase) {
  const amount = cycle(phase);
  const pose = body([0,.194+.048*amount,-.237+.129*amount],-.397+.079*amount);
  pose.handRoller = {center:[0,foamRadius,.013+.127*amount],axis};
  pose.machineTravel = 1.58*amount;
  for (const [side,sign] of sides) {
    palm(pose,side,[sign*.324,.073,-.628],[sign*.58,.13,-.40],[sign*.13,.09,.95]);
    foot(pose,side,sign,[sign*.152,floor,.588-.236*amount],[sign*.13,.96,.29]);
  }
  return pose;
}

function foamReverseCrunch(phase) {
  const amount = cycle(phase);
  const pose = body([0,.156+.111*amount,.111-.047*amount],-Math.PI/2 + .164*amount);
  pose.handRoller = {center:[0,.215+.41*amount,.865-.370*amount],axis};
  pose.machineTravel = 3.3*amount;
  for (const [side,sign] of sides) {
    palm(pose,side,[sign*.171,.080,-.779],[sign*.38,.04,-.32]);
    foot(pose,side,sign,[sign*.223,.18+.396*amount,.800-.369*amount],[sign*.09,.94,.46],
      [-sign*.064,.031,.139]);
    delete pose.planted[side];
  }
  return pose;
}

function foamReach(phase, { standing = false } = {}) {
  const amount = cycle(phase, .33, .61);
  const pose = standing ? body([0,.889-.155*amount,-.13-.065*amount],.372+1.59*amount,.265*amount)
    : body([0,.147,.011],.147+.616*amount);
  pose.handRoller = { center: standing ? [.158*amount,.905-.824*amount,.287+.305*amount]
    : [0,.279-.081*amount,.381+.425*amount], axis };
  pose.machineTravel = 4.51*amount;
  if (standing) restFeet(pose,.10);
  for (const [side,sign] of sides) {
    if (!standing) foot(pose,side,sign,[sign*.132,.100,.842],[sign*.08,.90,.081],[sign*.028,-.074,.145]);
    const hand = add(pose.handRoller.center,[sign*.171,.035,-.035]);
    palm(pose,side,hand,[sign*.56,-.80,.12],[sign*.02,.18,.96]);
  }
  return pose;
}

function abWheel(phase, { kneeling = false } = {}) {
  const amount = cycle(phase,.43,.56);
  let pose;
  if (kneeling) {
    const kneeAngle = .08 + 1.235*amount;
    pose = body([0,.108+.419*Math.cos(kneeAngle),-.226+.419*Math.sin(kneeAngle)],1.335+.246*amount);
    for (const [side,sign] of sides) {
      pose[side+"k"]=[sign*.128,.108,-.226];
      pose[side+"a"]=[sign*.142,.093,-.647];
      pose[side+"t"]=[sign*.151,.042,-.786];
      delete pose.planted[side];
    }
  } else {
    pose = body([0,.895-.562*amount,-.522+.540*amount],2.827-.997*amount);
    for (const [side,sign] of sides) {
      foot(pose,side,sign,[sign*.141,.134,-.779],[sign*.14,.41,.44],[sign*.029,-.115,-.076]);
      delete pose.planted[side];
    }
  }
  pose.handRoller={center:[0,.096,(kneeling?.382:.086)+(kneeling?.827:.969)*amount],axis};
  pose.machineTravel=10.91*amount;
  for (const [side,sign] of sides) {
    const grasp=add(pose.handRoller.center,[sign*.174,.006,0]);
    arm(pose,side,grasp,[sign*.68,-.96,0]);
    pose[side+"Grip"]=axis;
  }
  if (kneeling) {
    const [x,y,z]=pose.hips;
    const anchor=[0,.473,-.804];
    pose.bandPath=[anchor,[x-.193,y+.051,z-.035],[x-.151,y+.051,z+.107],
      [x+.151,y+.051,z+.107],[x+.193,y+.051,z-.035],anchor];
  }
  return pose;
}

const clips = [
  ["1353", "spotter-med-ball", throwBall, {}, ["quad","glute","shoulder"], [45, 10, [0,1.29,.16], 2.86], 4200, .58],
  ["1303", "spotter-med-ball-mat", pushUp, {offset:true}, ["pec","core","triceps"], [-56, 20, [0,.51,-.43], 1.49]],
  ["1701", "spotter-med-ball-mat", pushUp, {narrow:true}, ["pec","triceps"], [58, 19, [0,.52,-.42], 1.58]],
  ["1750", "spotter-med-ball-bench", throwBall, {seated:true}, ["pec","triceps"], [64, 14, [.1,.95,1.10], 2.25], 3900, .58],
  ["0663", "spotter-med-ball-mat", pushUp, {}, ["pec","triceps","core"], [48, 18, [0,.53,-.47], 1.63]],
  ["1307", "spotter-bosu", pushUp, {kind:"bosu"}, ["pec","triceps","core"], [57, 17, [0,.55,-.47], 1.66]],
  ["0653", "spotter-bosu", pushUp, {kind:"bosu"}, ["pec","triceps","core"], [44, 19, [0,.57,-.46], 1.64]],
  ["1705", "spotter-bosu", bosuSquat, {}, ["quad","glute","core"], [54, 13, [0,1.02,0], 2.21]],
  ["2202", "spotter-foam-roller", foamHip, {}, ["glute"], [58, 24, [0,.45,.02], 1.40]],
  ["2206", "spotter-foam-roller", foamReverseCrunch, {}, ["core"], [58, 23, [0,.40,.15], 1.42]],
  ["2203", "spotter-foam-roller", foamReach, {}, ["l:shoulder","r:shoulder","trap"], [56, 22, [0,.61,.38], 1.49]],
  ["2207", "spotter-foam-roller", foamReach, {standing:true}, ["lat"], [57, 17, [0,.73,.26], 1.79]],
  ["0796", "spotter-ab-wheel", abWheel, {}, ["core","shoulder"], [61, 18, [0,.52,.13], 1.63]],
  ["0971", "spotter-ab-wheel-stretch-band", abWheel, {kneeling:true}, ["core","shoulder"], [64, 18, [0,.52,.13], 1.65]],
];

const [directory,...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const rows = requested.length ? clips.filter(([id]) => requested.includes(id)) : clips;
if (!rows.length || (requested.length && rows.length !== requested.length)) throw new Error("Invalid or duplicate catalogue IDs.");
const out=resolve(directory);
await mkdir(out,{recursive:true,mode:0o700});
const items=[];
for (const [id,equipment,motion,options,muscles,frame,durationMs=3900,posterAt=.47] of rows) {
  const [yaw,elevation,focus,height] = frame;
  const data = {version:1,equipment,durationMs,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,options)}))};
  try { prepareRecipe(data); } catch(error) { throw new Error(id+": "+error.message,{cause:error}); }
  const recipe=id+".json";
  await writeFile(join(out,recipe),JSON.stringify(data)+"\n");
  items.push({id,recipe,posterAt});
}
await writeFile(join(out,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"small-prop Spotter recipes.");
