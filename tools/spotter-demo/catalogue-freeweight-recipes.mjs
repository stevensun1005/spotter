import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import {
  add, arm, blend, body, chestPress, curl, cycle, deadlift, elbowExtension, foot, fromSupport, hipThrust,
  kickback, lunge, pullover, raise, ramp, row, scale, shoulderPress, sideBend, sides, splitSquat, squat, uprightRow,
} from "./catalogue-dumbbell-recipes.mjs";
import { plankVariant, pushUp } from "./bodyweight/floor.mjs";
import { backExtension, benchDip, captainRaise, dip, invertedRow, pullUp, tiltedCore } from "./bodyweight/apparatus.mjs";
import { unit } from "./bodyweight/pose.mjs";

const standing = [48, 14, [0, .93, .05], 2.13];
const overhead = [53, 14, [0, 1.06, .05], 2.37];
const bentOver = [55, 15, [0, .76, .08], 1.91];
const mat = [63, 24, [0, .38, -.07], 1.79];
const rings = [48, 15, [0, .91, .05], 2.16];
const flatBench = [64, 17, [.10, .61, 1.05], 1.77];
const seated = [56, 17, [.10, .79, 1.30], 1.78];
const inclineBench = [61, 16, [0, .83, .06], 1.88];

const up = [0, 1, 0];
const front = [0, 0, 1];
const sideAxis = [1, 0, 0];
const floor = .075;

function plateAt(pose, center, direction, { squeeze = false, angle = 0, width = .132, gripDirection } = {}) {
  const along = [Math.cos(angle), Math.sin(angle), 0];
  for (const [side, sign] of sides) {
    const wrist = squeeze ? add(center, [sign * .034, 0, -.023]) : add(center, scale(along, sign * width));
    arm(pose, side, wrist, [sign * .66, -.67, .14]);
    if (squeeze) {
      pose[side + "PalmSide"] = sideAxis;
      pose[side + "Fingers"] = [0, .432, .902];
    } else {
      pose[side + "Grip"] = gripDirection ?? [-Math.sin(angle), Math.cos(angle), 0];
      pose[side + "Fingers"] = [sign * -.662, .050, .736];
    }
  }
  const grip = scale(add(pose.lw, pose.rw), .5);
  const offset = squeeze ? [0, 0, .023] : [0, 0, 0];
  pose.dumbbells.push({ center: add(grip, offset), axis: direction });
}

function platePress(phase, { setting = "floor", mode = "forward", squeeze = false, fast = false } = {}) {
  const pose = fromSupport(setting);
  const amount = fast ? cycle(phase,.23,.39) : cycle(phase);
  const overheadPress = mode === "shoulder";
  const lying = setting === "supineMat" || setting === "flat";
  const center = overheadPress ? add(pose.chest, [0, .133 + .590 * amount, .211 - .117 * amount])
    : lying ? add(pose.chest, [0, .208 + .387 * amount, .093 + .033 * amount])
      : setting === "incline" ? add(pose.chest,add(scale(pose.up,.114),scale(pose.front,.208+.395*amount)))
        : add(pose.chest, [0, .094 + .051 * amount, .201 + .405 * amount]);
  plateAt(pose, center, squeeze ? sideAxis : front, { squeeze });
  return pose;
}

function plateRaise(phase, { high = false, hold = false, torque = false, lowTorque = false, armsIndependent = false, lateral = false } = {}) {
  const pose = fromSupport("floor");
  const amount = hold ? cycle(phase, .25, .76) : cycle(phase);
  const angle = (.085 + (high ? 2.71 : 1.53) * amount);
  if (armsIndependent) {
    for (const [side, sign] of sides) {
      const wrist = add(pose[side + "s"], [sign * .593 * Math.sin(angle), -.591 * Math.cos(angle), .063]);
      arm(pose, side, wrist, [sign * .400, -.92, -.19]);
      const offset = [sign * .066 * Math.sin(angle), -.066 * Math.cos(angle), .032];
      pose[side + "Grip"] = [0, 0, 1];
      pose.dumbbells.push({ center: add(pose[side + "w"], offset),
        axis: lateral ? [sign * Math.cos(angle), Math.sin(angle), .062] : [0, 0, 1] });
    }
  } else {
    const rotation = torque ? .64 * Math.sin(2 * Math.PI * phase) : 0;
    const center = torque ? add(pose.chest, lowTorque ? [0,-.378,.243] : [0, -.051, .412])
      : add(pose.chest, [0, .128 - .574 * Math.cos(angle), .071 + .523 * Math.sin(angle)]);
    plateAt(pose, center, torque ? front : [0, .64 * Math.sin(angle), Math.cos(angle)], { angle: rotation });
  }
  return pose;
}

function plateCurl(phase) {
  const pose = fromSupport("floor");
  const angle = .134 + 2.38 * cycle(phase);
  const center = add(pose.chest, [0, -.081 - .412 * Math.cos(angle), .042 + .331 * Math.sin(angle)]);
  plateAt(pose, center, [0, Math.sin(angle), Math.cos(angle)]);
  return pose;
}

function plateRow(phase) {
  const pose = fromSupport("hinge");
  const amount = cycle(phase);
  const center = add(pose.chest, [0, -.437 + .342 * amount, .117 - .241 * amount]);
  plateAt(pose, center, front);
  return pose;
}

function holdBottle(pose, center, axis, gripWidth = .079) {
  const gripAxis = gripWidth < .050 ? sideAxis : axis;
  for (const [key,sign] of sides) {
    arm(pose,key,add(center,scale(gripAxis,sign*gripWidth)),[sign*.69,-.50,.24]);
    pose[key+"Grip"] = axis;
  }
  pose.dumbbells.push({center:scale(add(pose.lw,pose.rw),.5),axis});
}

function bottleSquat(phase, { wide = false } = {}) {
  const amount = cycle(phase);
  const pose = body([0, .886 - .345 * amount, .029 - .211 * amount], .026 + .293 * amount);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * (wide ? .307 : .162), floor, .114], [sign * .34, 0, .92],
      [sign * (wide ? .082 : .025), -.071, .134]);
    if (!wide) {
      const location = add(pose[side + "s"], [sign * .034, .024, .141]);
      arm(pose, side, location, [sign * .42, -.62, .32], [0, .23, .971]);
    }
  }
  if (wide) holdBottle(pose,add(pose.hips,[0,-.101,.201]),up,.034);
  return pose;
}

function bottleSquatWaves(phase) {
  const lead = phase < .5 ? "l" : "r";
  const fraction = (phase * 2) % 1;
  const squatDepth = cycle(fraction,.32,.40);
  const wave = ramp(fraction,.44,.71)*(1-ramp(fraction,.77,1));
  const pose = body([0,.887-.313*squatDepth,.022-.179*squatDepth],.030+.250*squatDepth);
  for (const [key,sign] of sides) {
    foot(pose,key,sign,[sign*.163,floor,.097],[sign*.31,.02,.96]);
    const angle = key===lead ? 2.47*wave : -.173*wave;
    const wrist = [sign*(.064+.063*wave),-.582*Math.cos(angle),.069+.522*Math.sin(angle)];
    arm(pose,key,add(pose[key+"s"],wrist),[sign*.66,-.65,-.20],sideAxis);
  }
  return pose;
}

function bottleInclineCurl(phase, { reverse = false } = {}) {
  const pose = body([.1, .545, 1.244], .658);
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [.1 + sign * .350, floor, 1.585], [sign * .44, .10, .91]);
  }
  const elbow = add(pose.lk, [-.064, .084, -.115]);
  const upper = add(elbow, scale(pose.ls, -1));
  pose.le = add(pose.ls, scale(upper, .252 / Math.hypot(...upper)));
  const angle = .138 + 2.42 * cycle(phase);
  pose.lw = add(pose.le, [.005, -.371 * Math.cos(angle), .370 * Math.sin(angle)]);
  pose.lGrip = [reverse ? -1 : 1, 0, 0];
  pose.dumbbells.push({ center: pose.lw, axis: pose.lGrip });
  arm(pose, "r", add(pose.rk, [.013, .082, -.066]), [-.591, -.43, .16]);
  return pose;
}

function bottleHalo(phase) {
  const pose = fromSupport("floor");
  const angle = phase * Math.PI * 2;
  const center = add(pose.head, [.255 * Math.sin(angle), -.026 + .093 * (1 - Math.cos(angle)), .244 * Math.cos(angle)]);
  const axial = [Math.cos(angle), 0, -Math.sin(angle)];
  for (const [side, sign] of sides) {
    arm(pose, side, add(center, scale(axial, sign * .082)), [sign * .86, -.32, -.24]);
    pose[side + "Grip"] = axial;
  }
  pose.dumbbells.push({ center, axis: axial });
  return pose;
}

function bottleSvend(phase) {
  const pose = fromSupport("floor");
  const amount = cycle(phase);
  const center = add(pose.chest, [0, .077 + .06 * amount, .204 + .392 * amount]);
  const grasp = add(center, [0, 0, -.018]);
  for (const [side, sign] of sides) {
    arm(pose, side, add(grasp, [sign * .041, 0, 0]), [sign * .67, -.65, .14]);
    pose[side + "PalmSide"] = sideAxis;
    pose[side + "Fingers"] = front;
  }
  pose.dumbbells.push({ center, axis: up });
  return pose;
}

function bottleHinge(phase, { single = false } = {}) {
  const amount = cycle(phase);
  const pose = single ? body([.064, .883 - .074 * amount, .023 - .178 * amount], .031 + 1.231 * amount)
    : deadlift(phase,{form:"straight"});
  if (!single) {
    for (const [side,index] of [["l",0],["r",1]]) {
      pose[side+"Grip"] = up;
      pose.dumbbells[index].axis = up;
    }
    return pose;
  }
  for (const [side, sign] of sides) {
    const angle = .20 + 1.41 * amount;
    const point = side === "r" ? add(pose.rh, [-.071, -.827 * Math.cos(angle), -.827 * Math.sin(angle)]) : [.148, floor, .071];
    foot(pose, side, sign, point, [sign * .18, .034, .91], [sign * .019, -.071, side === "r" ? -.142 : .137]);
    if (side === "r") delete pose.planted.r;
    arm(pose, side, add(pose[side + "s"], [sign * .053, -.607, .046 - .132 * amount]), [sign * .48, -.38, -.74], up);
  }
  return pose;
}

function bottleArmpitRow(phase) {
  const amount = cycle(phase);
  const pose = fromSupport("floor",{pitch:.155});
  for (const [key,sign] of sides) {
    const from = [sign*.092,-.599,.071];
    const to = [sign*.079,-.167,.159];
    arm(pose,key,add(pose[key+"s"],blend(from,to,amount)),[sign*.991,.144,-.26],front);
  }
  return pose;
}

function bottleSwing(phase) {
  const drive = ramp(phase,.15,.42)*(1-ramp(phase,.53,.98));
  const pose = body([0,.806+.067*drive,-.198+.217*drive],.935-.896*drive);
  for (const [key,sign] of sides) foot(pose,key,sign,[sign*.222,floor,.096],[sign*.24,0,.985]);
  const center = [0,.515+.773*drive,-.129+.752*drive];
  holdBottle(pose,center,sideAxis);
  return pose;
}

function bottleGorillaRow(phase) {
  const pose = body([0,.558,-.169],1.244);
  for (const [key,sign] of sides) {
    foot(pose,key,sign,[sign*.347,floor,.070],[sign*.41,.05,.85],[sign*.076,-.071,.126]);
    const amount = ((phase < .50)===(key==="l")) ? cycle((phase*2)%1) : 0;
    const hand = [sign*.151,.108+.466*amount,.308-.292*amount];
    arm(pose,key,hand,[sign*.31,-.15,-.936],up);
  }
  return pose;
}

function bottleKneel(phase) {
  const amount = cycle(phase);
  const hipAngle = .04+1.125*amount;
  const pose = body([0,.084+.419*Math.cos(hipAngle),-.026-.419*Math.sin(hipAngle)],.035+.075*amount);
  for (const [key,sign] of sides) {
    pose[key+"k"] = [sign*.135,.084,-.020];
    pose[key+"a"] = [sign*.146,.089,-.443];
    pose[key+"t"] = [sign*.170,.021,-.598];
    delete pose.planted[key];
  }
  holdBottle(pose,add(pose.chest,[0,.096,.203]),up,.034);
  return pose;
}

function loadedCrunch(phase, { kind = "plate", overhead: above = false, full = false, frog = false, toes = false } = {}) {
  const amount = cycle(phase, .42, .56);
  const pose = body([0, .141, -.031], -Math.PI / 2 + (full ? 1.72 : .503) * amount);
  for (const [side, sign] of sides) {
    if (frog) {
      foot(pose,side,sign,[sign*.065,.083+.225*amount,.477-.114*amount],[sign*.99,.41,.18],
        [-sign*.092,-.044,.113]);
      delete pose.planted[side];
    } else if (toes) {
      foot(pose,side,sign,[sign*.113,.970,.012],[sign*.12,.04,.91],[sign*.015,.101,.047]);
      delete pose.planted[side];
    } else foot(pose, side, sign, [sign * .164, floor, .574], [sign * .18, .78, .78]);
  }
  const chest = add(pose.chest,add(scale(pose.up,.045),scale(pose.front,.136)));
  const center = toes ? add(pose.chest,[0,.426+.140*amount,.234])
    : above ? add(pose.head,[0,.106,-.365])
      : full ? add(chest,[0,.423*amount,.104*amount]) : chest;
  if (kind === "plate") {
    plateAt(pose,center,above||toes?up:pose.front,{gripDirection:above||toes?front:pose.up});
  } else if (frog) {
    holdBottle(pose,center,sideAxis);
  } else {
    for (const [side, sign] of sides) {
      arm(pose, side, add(center, [sign * .079, 0, 0]), [sign * .65, -.48, -.41]);
      pose[side + "Grip"] = sideAxis;
    }
    pose.dumbbells.push({ center, axis: sideAxis });
  }
  return pose;
}

function loadedTwist(phase, { raised = false, kind = "plate", standing: standingTwist = false, drop = false } = {}) {
  const rotation = .67 * Math.sin(phase * 2 * Math.PI);
  const hips = standingTwist ? [0, .882, 0] : [0, .151, -.211];
  const pitch = standingTwist ? .02 : -.529;
  const pose = body(hips, pitch, rotation);
  const stableLower = body(hips, pitch);
  for (const [side, sign] of sides) {
    pose[side + "h"] = stableLower[side + "h"];
    foot(pose, side, sign, [sign * .146, raised ? .235 : floor, standingTwist ? .085 : .455],
      [sign * .18, .866, .30]);
    if (raised) delete pose.planted[side];
  }
  const [x, y, z] = pose.chest;
  const side = drop ? Math.abs(Math.sin(phase * 2 * Math.PI)) : 0;
  const depth = .329+.104*side;
  const center = [x + Math.sin(rotation)*depth, y + .105-(kind==="bottle"?.444:.316)*side,
    z + Math.cos(rotation)*depth];
  if (kind === "plate") plateAt(pose, center, [Math.sin(rotation),0,Math.cos(rotation)]);
  else if (drop) holdBottle(pose,center,[Math.cos(rotation),0,-Math.sin(rotation)]);
  else {
    const axis = [Math.cos(rotation), 0, -Math.sin(rotation)];
    for (const [side, sign] of sides) {
      arm(pose, side, add(center, scale(axis, sign * .075)), [sign * .59, -.49, -.16]);
      pose[side + "Grip"] = axis;
    }
    pose.dumbbells.push({ center, axis });
  }
  return pose;
}

function plateSquat(phase, { reach = false } = {}) {
  const amount = cycle(phase);
  const pose = squat(phase);
  delete pose.lGrip;
  delete pose.rGrip;
  pose.dumbbells = [];
  const center = add(pose.chest,[0,.089,.200+(reach?.355*amount:0)]);
  plateAt(pose,center,front);
  return pose;
}

function plateOverheadLunge(phase, { reverse = false } = {}) {
  const pose = lunge(phase,{form:reverse?"reverse":"plain"});
  pose.dumbbells=[];
  plateAt(pose,add(pose.chest,[0,.751,.079]),up,{gripDirection:front});
  return pose;
}

function plateOverheadMarch(phase) {
  const lead=phase<.5?"l":"r";
  const step=cycle((phase*2)%1);
  const sign=lead==="l"?1:-1;
  const pose=body([-sign*.045*step,.882,.013],.024);
  for (const [side,s] of sides) {
    const lift=side===lead?step:0;
    foot(pose,side,s,[s*.145,floor+.404*lift,.098+.318*lift],[s*.11,.113,.97],
      [s*.013,-.071-.022*lift,.141]);
    if (lift>.01) delete pose.planted[side];
  }
  plateAt(pose,add(pose.chest,[0,.746,.079]),up,{gripDirection:front});
  return pose;
}

function plateSquatJump(phase) {
  const pose=squat(phase,{form:"jump"});
  pose.dumbbells=[];
  plateAt(pose,add(pose.chest,[0,.079,.201]),pose.front,{gripDirection:pose.up});
  return pose;
}

function plateFeetOnBenchCrunch(phase,{twist=false}={}) {
  const fraction=twist?(phase*2)%1:phase;
  const sign=phase<.5?1:-1;
  const amount=cycle(fraction);
  const hip=[.1,.143,.455];
  const pitch=-Math.PI/2+.555*amount;
  const pose=body(hip,pitch,0,twist?sign*.39*amount:0);
  for (const [side,s] of sides) {
    const x=.1+s*.119;
    pose[side+"k"]=[x,.545,.564];
    pose[side+"a"]=[x+s*.016,.543,.981];
    pose[side+"t"]=[x+s*.034,.675,1.039];
    delete pose.planted[side];
  }
  const center=add(pose.chest,add(scale(pose.up,.052),scale(pose.front,.153)));
  plateAt(pose,center,pose.front,{gripDirection:pose.up});
  return pose;
}

function plateHipThrust(phase,{frog=false,single=false}={}) {
  const pose=hipThrust(phase,{setting:frog?"supineMat":"flat",form:single?"single":"plain"});
  if (frog) {
    for (const [side,sign] of sides) {
      foot(pose,side,sign,[sign*.057,floor,.548],[sign*.96,.290,.139],[-sign*.039,-.069,.144]);
    }
  }
  pose.dumbbells=[];
  plateAt(pose,add(pose.hips,[0,.135,.062]),up,{width:.116,gripDirection:front});
  return pose;
}

function plateSkaterSquat(phase) {
  const amount=cycle(phase,.41,.56);
  const pose=body([.128,.878-.404*amount,.014-.08*amount],.035+.284*amount);
  foot(pose,"l",1,[.156,floor,.110],[.13,.086,.961]);
  pose.rk=[-.016,.506-.430*amount,-.177-.018*amount];
  pose.ra=add(pose.rk,[-.023,.126+.031*amount,-.393+.01*amount]);
  pose.rt=add(pose.ra,[-.023,-.126,.104]);
  delete pose.planted.r;
  plateAt(pose,add(pose.chest,[0,.085+.029*amount,.256+.291*amount]),front,{width:.121,gripDirection:up});
  return pose;
}

function plateCore(phase,{form="extend",setting="supineMat"}={}) {
  const twisting=form==="lying-twist"||form==="bench-twist";
  const active=phase<.5?1:-1;
  const amount=cycle(twisting?(phase*2)%1:phase);
  const bench=setting==="flat";
  const drop=form==="lying-twist"?active*.97*amount:0;
  const pitch=bench?-Math.PI/2+.544*amount:form==="lying-twist"?-Math.PI/2:
    form==="sit-tuck"?-.526+.443*amount:-Math.PI/2+.529*amount;
  const pose=body(bench?[.1,.551,1.260]:[0,.142,-.065],pitch,0,form==="bench-twist"?active*.383*amount:0);
  for(const [side,sign] of sides){
    if(form==="extend"||form==="sit-tuck") {
      const extended=form==="extend"?amount:1-amount;
      const knee=add(pose[side+"h"],[sign*.054,.401-.349*extended,.115+.280*extended]);
      const angle=1.37+.170*extended;
      pose[side+"k"]=knee;
      pose[side+"a"]=add(knee,[sign*.021,-.410*Math.cos(angle),.410*Math.sin(angle)]);
      pose[side+"t"]=add(pose[side+"a"],[sign*.018,.057,.138]);
      delete pose.planted[side];
    } else if(form==="lying-twist") {
      const knee=add(pose[side+"h"],[.388*Math.sin(drop),.383*Math.cos(drop),.152]);
      pose[side+"k"]=knee;
      pose[side+"a"]=add(knee,[-.368*Math.sin(drop),-.363*Math.cos(drop),.205]);
      pose[side+"t"]=add(pose[side+"a"],[.045*Math.sin(drop),-.057*Math.cos(drop),.144]);
      delete pose.planted[side];
    } else foot(pose,side,sign,[pose.hips[0]+sign*.166,floor,bench?1.619:.569],[sign*.29,.941,.39]);
  }
  const position=form==="lying-twist"?add(pose.chest,[0,.563,.018]):form==="behind-head"?
    add(pose.head,add(scale(pose.up,.095),scale(pose.front,-.101))):
    add(pose.chest,add(scale(pose.up,.035),scale(pose.front,.150)));
  if(form==="behind-head") {
    for(const [side,sign] of sides){
      arm(pose,side,add(position,[sign*.112,.039,.024]),[sign*.912,-.29,.15]);
      pose[side+"Grip"]=pose.up;
    }
    pose.dumbbells.push({center:position,axis:pose.front});
  } else plateAt(pose,position,form==="lying-twist"?front:pose.front,
    {gripDirection:form==="lying-twist"?up:pose.up});
  return pose;
}

function dbDeadBug(phase) {
  const sideMoving=phase<.5?"l":"r";
  const amount=cycle((phase*2)%1);
  const pose=body([0,.151,-.066],-Math.PI/2);
  for(const [side,sign] of sides){
    const reach=side===sideMoving?amount:0;
    const hipAngle=.095+1.288*reach;
    const shinAngle=1.51-.187*reach;
    const knee=add(pose[side+"h"],[sign*.029,.419*Math.cos(hipAngle),.419*Math.sin(hipAngle)]);
    const ankle=add(knee,[sign*.009,-.420*Math.cos(shinAngle),.420*Math.sin(shinAngle)]);
    pose[side+"k"]=knee;
    pose[side+"a"]=ankle;
    pose[side+"t"]=add(ankle,[sign*.020,.069,.135]);
    delete pose.planted[side];
    const armAngle=side!==sideMoving?1.36*amount:0;
    arm(pose,side,add(pose[side+"s"],[sign*.049,.607*Math.cos(armAngle),-.603*Math.sin(armAngle)]),
      [sign*.44,-.72,-.16],sideAxis);
  }
  return pose;
}

function platePlank(phase) {
  const pose=plankVariant(phase,{forearm:true,hold:true});
  const incline=Math.atan2(pose.chest[1]-pose.hips[1],pose.chest[2]-pose.hips[2]);
  const normal=[0,Math.cos(incline),-Math.sin(incline)];
  pose.dumbbells=[{center:add(pose.chest,scale(normal,.133)),axis:normal}];
  return pose;
}

function dbFloorLegRaise(phase) {
  const amount=cycle(phase);
  const pose=body([0,.151,-.196],-.328+.044*amount);
  for(const [side,sign] of sides){
    const arch=.009+.761*amount;
    const knee=add(pose[side+"h"],[-sign*.033,.411*Math.sin(arch),.411*Math.cos(arch)]);
    const ankle=add(knee,[-sign*.034,-.048+.381*Math.sin(arch),.414*Math.cos(arch)]);
    pose[side+"k"]=knee;
    pose[side+"a"]=ankle;
    pose[side+"t"]=add(ankle,[sign*.011,.062,.141]);
    delete pose.planted[side];
    arm(pose,side,[sign*.251,.048,-.660],[sign*.74,-.29,-.61]);
    pose[side+"Fingers"]=[sign*.81,-.013,.58];
  }
  pose.dumbbells.push({center:add(blend(pose.la,pose.ra,.5),[0,-.021,.072]),axis:[0,0,1]});
  return pose;
}

function backpackGait(phase,{run=false}={}) {
  const bounce = (1-Math.cos(4*Math.PI*phase))*.5;
  const pose=body([.020*Math.sin(2*Math.PI*phase),run?.861+.085*bounce:.873+.024*bounce,0],run?.144:.050);
  for (const [side,sign] of sides) {
    const gait=(phase+.17+(side==="r"?.5:0))%1;
    const stanceShare=run?.40:.61;
    const planted=gait<stanceShare;
    const time=planted?gait/stanceShare:(gait-stanceShare)/(1-stanceShare);
    const travel=(planted?.5-time:time-.5)*(run?.670:.471);
    const stride= Math.sin(Math.PI*time);
    const height=planted?0:stride*(run?.334:.128);
    foot(pose,side,sign,[sign*.122,floor+height,travel],[sign*.147,.04,.967],
      [sign*.025,-.073-(run?.30*height:.04*height),.144-.12*height]);
    if (!planted) delete pose.planted[side];
    const armAngle=(run?.435:.319)*Math.cos(gait*2*Math.PI);
    const upper=[sign*.068,-.241*Math.cos(armAngle),-.241*Math.sin(armAngle)];
    const swing=run? .84+armAngle:.219+armAngle;
    const wrist=add(upper,[sign*.030,-.319*Math.cos(swing),.310*Math.sin(swing)]);
    arm(pose,side,add(pose[side+"s"],wrist),[sign*.47,-.17,-.852]);
  }
  return pose;
}

function weightedKneeExtension(phase) {
  const amount=cycle(phase,.38,.62);
  const pose=fromSupport("seat");
  const knee=[.258,.507,1.613];
  const angle=.17+1.393*amount;
  pose.lk=knee;
  pose.la=add(knee,[.016,-.415*Math.cos(angle),.414*Math.sin(angle)]);
  pose.lt=add(pose.la,[.012,.131*Math.sin(angle)-.057*Math.cos(angle),.137*Math.cos(angle)+.052*Math.sin(angle)]);
  delete pose.planted.l;
  for(const [side,sign] of sides){
    arm(pose,side,[.10+sign*.222,.461,1.262],[sign*.76,-.26,-.117]);
    pose[side+"Fingers"]=[sign*-.71,-.34,.617];
  }
  return pose;
}

function weightedQuadrupedLift(phase) {
  const amount=cycle(phase,.40,.60);
  const pose=body([0,.499,-.209],1.568);
  for(const [side,sign] of sides){
    const bend=side==="l"?amount:0;
    const knee=add(pose[side+"h"],[sign*.028,-.414*Math.cos(1.74*bend),-.414*Math.sin(1.74*bend)]);
    const extension=1.54-.815*bend;
    pose[side+"k"]=knee;
    pose[side+"a"]=add(knee,[sign*.015,.423*Math.cos(extension),-.423*Math.sin(extension)]);
    pose[side+"t"]=add(pose[side+"a"],[sign*.016,-.064-.014*bend,-.138]);
    delete pose.planted[side];
    arm(pose,side,[sign*.186,.063,.332],[sign*.21,-.42,-.69]);
    pose[side+"Fingers"]=[sign*.053,-.02,.994];
  }
  return pose;
}

function singleChinWithDumbbell(phase) {
  const pose=pullUp(phase,{single:true});
  delete pose.rGrip;
  pose.dumbbells=[];
  arm(pose,"r",add(pose.rs,[-.083,-.594,.090]),[-.66,-.23,-.22],front);
  return pose;
}

function plateBenchExtension(phase,{cross=false}={}) {
  const pose = backExtension(phase,true);
  const [x,y,z]=pose.chest;
  const up=unit(add(pose.neck,scale(pose.hips,-1)));
  const front=[0,-up[2],up[1]];
  const center=add([x,y,z],scale(front,.141));
  pose.dumbbells=[];
  if (cross){
    for (const [side,sign] of sides){
      const at=add(center,add([sign*-.112,0,0],scale(front,.034)));
      arm(pose,side,at,[sign*.59,-.36,-.25]);
      pose[side+'Fingers']=[sign*-.83,.169,.531];
    }
    pose.dumbbells.push({center,axis:front});
  } else plateAt(pose,center,front,{gripDirection:up});
  return pose;
}

function plateDeclineCore(phase,{full=false}={}) {
  const pose=tiltedCore(phase,{rise:full?2.06:.627});
  const up=unit(add(pose.neck,scale(pose.hips,-1)));
  const front=[0,-up[2],up[1]];
  const center=add(pose.chest,add(scale(front,.143),scale(up,.056)));
  pose.dumbbells=[];
  plateAt(pose,center,front,{gripDirection:up});
  return pose;
}

function plateBenchDip(phase) {
  const pose=benchDip(phase,{hold:true});
  const direction=unit(add(pose.lk,scale(pose.lh,-1)));
  const top=[0,direction[2],-direction[1]];
  const center=add(pose.hips,add(scale(direction,.161),scale(top,.111)));
  pose.dumbbells=[{center,axis:top}];
  return pose;
}

function plateInvertedRow(phase) {
  const pose=invertedRow(phase,{width:.310});
  const up=unit(add(pose.neck,scale(pose.hips,-1)));
  const front=[0,-up[2],up[1]];
  const center=add(pose.chest,add(scale(front,.137),scale(up,-.097)));
  pose.dumbbells=[{center,axis:front}];
  return pose;
}

function ballPlateCore(phase,{twist=false}={}) {
  const amount=cycle(phase,.39,.59);
  const turn=twist?.660*Math.sin(2*Math.PI*phase):0;
  const pose=body([0,.659,.035],twist?.021:.046+.976*amount,turn);
  pose.ballCenter=[0,.285,.010];
  for(const [side,sign] of sides) foot(pose,side,sign,[sign*.209,floor,.385],[sign*.139,.094,.952]);
  const center=add(pose.chest,twist?add(scale(pose.front,.253),[0,.126,0]):add(scale(pose.up,.753),scale(pose.front,.114)));
  plateAt(pose,center,twist?pose.front:pose.up,{gripDirection:twist?up:pose.front});
  return pose;
}

function platePinch(phase) {
  const pose=fromSupport('floor');
  const depth=.012*cycle(phase,.23,.77);
  for(const [side,sign] of sides){
    const extend=add(pose[side+'s'],[sign*.109,-.566+depth,.077]);
    arm(pose,side,extend,[sign*.65,-.29,-.58]);
    if(side==='r')continue;
    pose.lFingers=[.05,-.997,.053];
    pose.lPalmSide=[0,0,1];
    const center=add(pose.lw,[.032,-.120,.024]);
    pose.dumbbells.push({center:add(center,[-.015,0,0]),axis:sideAxis},{center:add(center,[.015,0,0]),axis:sideAxis});
  }
  return pose;
}

function weightedThruster(phase) {
  const lower = ramp(phase,0,.27)*(1-ramp(phase,.33,.55));
  const push = ramp(phase,.39,.65)*(1-ramp(phase,.74,1));
  const pose = body([0,.884-.379*lower,.029-.211*lower],.027+.297*lower);
  for (const [key,sign] of sides) {
    foot(pose,key,sign,[sign*.170,floor,.106],[sign*.32,.01,.97]);
    const wrist = blend([sign*.142,.061,.180],[sign*.037,.603,.077],push);
    arm(pose,key,add(pose[key+"s"],wrist),[sign*.68,-.53,-.19],sideAxis);
  }
  return pose;
}
function sandbagAt(pose, center, { carryOnBack = false, grab = false, axis = sideAxis } = {}) {
  for (const [key,sign] of sides) {
    const end = scale(axis,sign * (carryOnBack ? .179 : grab ? .131 : .145));
    const face = carryOnBack ? add(scale(pose.up,.023),scale(pose.front,.049))
      : [0,grab?.058:-.043,grab?.077:.064];
    const wrist = add(center,add(end,face));
    const pole = carryOnBack ? add(scale(pose.right,sign*.72),scale(pose.front,.54)) : [sign*.67,-.46,-.19];
    arm(pose,key,wrist,pole);
    if (carryOnBack) {
      pose[key+"PalmSide"]=pose.front;
      pose[key+"Fingers"]=scale(pose.right,-sign);
    } else if (grab) pose[key+"Grip"]=axis;
    else {
      pose[key+"PalmSide"]=[sign,.39,0];
      pose[key+"Fingers"]=[-sign*.68,.33,.65];
    }
  }
  pose.dumbbells.push({center,axis});
}

function sandbagHinge(phase,{romanian=false,rowing=false,shouldering=false,goodMorning=false}={}) {
  const shoulderSide = phase < .5 ? 1 : -1;
  const fraction = shouldering ? (phase*2)%1 : phase;
  const amount=cycle(fraction);
  const pick=shouldering ? ramp(fraction,.08,.47)*(1-ramp(fraction,.72,1)) : 0;
  const depth=shouldering ? 1-pick : rowing ? 1 : amount;
  const height=rowing?.790:romanian||goodMorning?.879-.066*depth:.874-.425*depth;
  const pose=body([0,height,.024-.230*depth],.034+(romanian||rowing||goodMorning?1.124:.90)*depth);
  for(const [key,sign] of sides) foot(pose,key,sign,[sign*.162,floor,.085],[sign*.28,.04,.96]);
  if (goodMorning) {
    sandbagAt(pose,add(pose.neck,add(scale(pose.front,-.180),scale(pose.up,-.097))),{carryOnBack:true});
    return pose;
  }
  const pickHeight=romanian?.332:.145;
  const low=rowing ? blend(add(pose.chest,[0,-.509,.072]),
    add(pose.chest,add(scale(pose.up,-.107),scale(pose.front,.254))),amount)
    : [0,.715-(.715-pickHeight)*depth,.189];
  const shoulder=ramp(fraction,.36,.55)*(1-ramp(fraction,.66,.86));
  const shoulderPoint = pose[shoulderSide===1?"ls":"rs"];
  const rack=blend(add(pose.chest,[0,.108,.247]),add(shoulderPoint,[shoulderSide*.044,.098,.144]),shoulder);
  const position=shouldering?blend(low,rack,pick):low;
  sandbagAt(pose,position,{grab:true,axis:shouldering?[1,shoulderSide*.39*shoulder,-shoulderSide*.32*shoulder]:sideAxis});
  return pose;
}

function sandbagRack(phase,{press=false,squatting=false}={}) {
  const amount=cycle(phase);
  const pose=squatting?squat(phase):fromSupport("floor");
  delete pose.lGrip;
  delete pose.rGrip;
  pose.dumbbells=[];
  const center=add(pose.chest,press?[0,.134+.603*amount,.205-.124*amount]:[0,.102,.231]);
  sandbagAt(pose,center,{grab:press});
  return pose;
}

function sandbagCarry(phase,{shoulders=false}={}) {
  const pose=body([0,.871+.020*cycle((phase*2)%1),.015],.033);
  for(const [key,sign] of sides){
    const stride=(phase+.17+(key==="r"?.5:0))%1;
    const stance=stride<.60;
    const progress=stance?stride/.60:(stride-.60)/.40;
    const travel=.476*(stance?.5-progress:progress-.5);
    foot(pose,key,sign,[sign*.136,floor+(stance?0:.113*Math.sin(Math.PI*progress)),travel],
      [sign*.24,.01,.98]);
    if (!stance) delete pose.planted[key];
  }
  const center=shoulders?add(pose.neck,[0,-.078,-.169]):add(pose.chest,[0,.102,.222]);
  sandbagAt(pose,center,{carryOnBack:shoulders});
  return pose;
}

function sandbagLunge(phase) {
  const pose=lunge(phase);
  delete pose.lGrip;
  delete pose.rGrip;
  pose.dumbbells=[];
  sandbagAt(pose,add(pose.chest,[0,.107,.216]));
  return pose;
}

function sandbagWalkingLunge(phase) {
  const step=phase<.5?0:1;
  const progress=phase*2-step;
  const lead=step===0?"l":"r";
  const depth=ramp(progress,.18,.41)*(1-ramp(progress,.58,.90));
  const far=.586;
  const base=-far+step*far;
  const transfer=ramp(progress,.09,.88);
  const pose=body([0,.885-.303*depth,base+far*transfer],.034+.102*depth);
  for (const [key,sign] of sides) {
    const steps=key===lead;
    const advance=ramp(progress,0,.30);
    const lift=steps?.122*Math.sin(Math.PI*advance)+step*.098*(1-advance):.098*ramp(progress,.29,.93);
    const z=steps?base+(advance*(1+step)-step)*far:base;
    foot(pose,key,sign,[sign*.128,floor+lift,z],[sign*.16,-.042,.986],[sign*.019,-(.071+(steps?0:lift)),.142]);
    if (lift>.012) delete pose.planted[key];
  }
  sandbagAt(pose,add(pose.chest,[0,.104,.220]));
  return pose;
}

function sandbagToss(phase) {
  const release=.35;
  const landing=.61;
  const stand=ramp(phase,.08,.30);
  const throwHeight=ramp(phase,.15,release);
  const pose=body([-.028*throwHeight,.480+.405*stand,-.182+.207*stand],.786-.736*stand,-.22*throwHeight);
  for(const [key,sign] of sides) foot(pose,key,sign,[sign*.182,floor,.079],[sign*.27,.049,.955]);
  const hold=blend([0,.147,.248],[.335,1.52,.217],throwHeight);
  const axis=[1,.64*throwHeight,-.19*throwHeight];
  if (phase<=release) {
    sandbagAt(pose,hold,{grab:true,axis});
    return pose;
  }
  const time=Math.min(1,(phase-release)/(landing-release));
  const air=[.335+.271*time,1.52+1.12*time-2.521*time*time,.217-1.277*time];
  const angle=1.04+1.96*time;
  pose.dumbbells.push({center:air,axis:[Math.sin(angle),.6*Math.cos(Math.PI*time/2),Math.cos(angle)]});
  const follow=ramp(phase,release,.45);
  const recover=ramp(phase,.45,.72);
  for (const [key,sign] of sides) {
    const initial=add(hold,[sign*.131,.058,.077]);
    const reach=add(pose[key+"s"],[.102+sign*.065,.428,-.232]);
    const side=add(pose[key+"s"],[sign*.075,-.559,.076]);
    arm(pose,key,blend(blend(initial,reach,follow),side,recover),[sign*.73,-.54,-.270]);
  }
  return pose;
}

const clips = [];
function group(ids, preset, motion, settings, muscles, camera = standing, duration = 3900) {
  for (const id of ids.split(" ")) clips.push({ id, preset, motion, settings, muscles, camera, duration });
}

group("3554", "bottles", curl, {grip:"hammer"}, ["biceps", "forearm"]);
group("6068", "bottles", curl, {mode:"alternate"}, ["biceps"], standing, 5100);
group("6069", "bottles", curl, {mode:"alternate",grip:"hammer"}, ["biceps","forearm"], standing, 5200);
group("6070", "bottles", curl, {grip:"reverse"}, ["forearm","biceps"]);
group("6073", "bottles", raise, {}, ["shoulder"]);
group("6075", "bottles", raise, {mode:"alternate"}, ["shoulder"], standing, 5000);
group("6074", "bottles", raise, {plane:"lateral"}, ["shoulder"]);
group("6059", "bottles", row, {}, ["lat","biceps"], bentOver);
group("6061", "bottles", raise, {setting:"hinge",plane:"rear"}, ["rearShoulder","trap"], bentOver);
group("6063", "bench-bottle", bottleInclineCurl, {}, ["l:biceps"], seated);
group("6064", "bench-bottle", bottleInclineCurl, {reverse:true}, ["l:forearm","l:biceps"], seated);
group("6071", "bottles", uprightRow, {}, ["shoulder","trap"]);
group("6072", "bottles", bottleArmpitRow, {}, ["shoulder","trap"]);
group("5988 6041 6049", "bottles", bottleHinge, {}, ["hamstring","glute"], bentOver);
group("6042", "bottles", bottleHinge, {single:true}, ["l:hamstring","l:glute"], [62,15,[0,.84,-.18],2.28]);
group("6047", "bottles", lunge, {}, ["quad","glute"], standing, 5900);
group("6048", "bottles", lunge, {form:"reverse"}, ["quad","glute"], standing, 5900);
group("6046", "bottles", splitSquat, {}, ["l:quad","l:glute"]);
group("6044", "bottles", bottleSquat, {}, ["quad","glute"]);
group("6056", "bottles", bottleSquatWaves, {}, ["quad","glute","shoulder"], overhead, 5700);
group("6045", "bottle", bottleSquat, {wide:true}, ["quad","glute"]);
group("6050", "mat-bottle", hipThrust, {setting:"supineMat"}, ["glute","hamstring"], mat);
group("6065", "bottle", kickback, {mode:"single"}, ["l:triceps"], bentOver);
group("6066", "bottles", kickback, {}, ["triceps"], bentOver);
group("6076", "bottles", shoulderPress, {}, ["shoulder","triceps"], overhead);
group("6057", "mat-bottles", chestPress, {setting:"supineMat",startLow:true}, ["pec","triceps"], mat);
group("6060", "mat-bottle", pullover, {setting:"supineMat",form:"straight"}, ["lat","pec"], mat);
group("6067", "bottle", elbowExtension, {sharedBell:true}, ["triceps"], overhead);
group("6054", "bottle", sideBend, {}, ["core"]);
group("6077", "bottle", bottleHalo, {}, ["shoulder","core"], overhead, 4700);
group("6058", "bottle", bottleSvend, {}, ["pec","triceps"]);
group("6052", "mat-bottle", loadedCrunch, {kind:"bottle",overhead:true}, ["core"], mat);
group("6055", "mat-bottle", loadedTwist, {kind:"bottle",drop:true}, ["core"], mat, 4600);
group("6043", "bottle", bottleSwing, {}, ["glute","hamstring","core"], standing, 3100);
group("7276", "bottles", bottleGorillaRow, {mode:"alternate"}, ["lat","biceps","core"], bentOver, 5200);
group("6051", "mat-bottle", bottleKneel, {}, ["glute","quad"], [61,19,[0,.61,-.14],1.70]);
group("6053", "mat-bottle", loadedCrunch, {kind:"bottle",frog:true}, ["core"], mat);

group("7882", "plate", platePress, {fast:true}, ["pec","shoulder","triceps"]);
group("1225", "plate", platePress, {mode:"shoulder"}, ["shoulder","triceps"], overhead);
group("0856", "plate", platePress, {squeeze:true}, ["pec","triceps"]);
group("10550", "mat-plate", platePress, {setting:"supineMat",squeeze:true}, ["pec","triceps"], mat);
group("5332", "bench-plate", platePress, {setting:"flat",squeeze:true}, ["pec","triceps"], flatBench);
group("5068", "incline-bench-plate", platePress, {setting:"incline",squeeze:true}, ["pec","triceps"], inclineBench);
group("4175", "plate", platePress, {mode:"shoulder"}, ["shoulder","triceps"], overhead);
group("6698", "plate", plateCurl, {}, ["biceps","forearm"]);
group("3860", "plate", plateRow, {}, ["lat","biceps"], bentOver);
group("7588", "plate", plateRaise, {hold:true}, ["shoulder"], standing, 4900);
group("10114 4847", "plate", plateRaise, {high:true}, ["shoulder","trap"], overhead);
group("0844", "plate", plateRaise, {torque:true}, ["shoulder","forearm"], rings, 4700);
group("7055", "plate", plateRaise, {torque:true,lowTorque:true}, ["forearm"], rings, 4700);
group("6549", "plates", plateRaise, {armsIndependent:true,high:true}, ["shoulder"], overhead);
group("6485", "plates", plateRaise, {armsIndependent:true,lateral:true}, ["shoulder"]);
group("10710 0831 0832 4252", "mat-plate", loadedCrunch, {}, ["core"], mat);
group("10871 10877", "mat-plate", loadedCrunch, {overhead:true}, ["core"], mat);
group("2371", "mat-plate", loadedTwist, {}, ["core"], mat, 4600);
group("0846", "mat-plate", loadedTwist, {drop:true}, ["core"], mat, 4600);
group("0845", "mat-plate", loadedTwist, {raised:true,drop:true}, ["core"], mat, 4600);
group("0855", "plate", loadedTwist, {standing:true}, ["core"], standing, 4600);
group("0834", "dumbbells", raise, {}, ["shoulder"]);
group("0853", "dumbbells", curl, {}, ["biceps"]);
group("0852 10097", "plate", plateSquat, {}, ["quad","glute"]);
group("4128", "plate", plateSquat, {reach:true}, ["quad","glute","shoulder"]);
group("9610", "plate", plateOverheadLunge, {}, ["quad","glute","shoulder"], overhead, 6200);
group("11657", "plate", plateOverheadLunge, {reverse:true}, ["quad","glute","shoulder"], overhead, 6200);
group("5498", "plate", plateOverheadMarch, {}, ["core","quad","shoulder"], overhead, 5900);
group("3876", "plate", plateSquatJump, {}, ["quad","glute","calf"], overhead, 3500);
group("3282", "bench-plate", plateFeetOnBenchCrunch, {}, ["core"], [64,23,[.06,.40,.625],1.99]);
group("3283", "bench-plate", plateFeetOnBenchCrunch, {twist:true}, ["core"], [64,23,[.06,.40,.625],1.99],5900);
group("3182", "mat-plate", plateHipThrust, {frog:true}, ["glute","hamstring"], mat);
group("2754", "bench-plate", plateHipThrust, {}, ["glute","hamstring"], [63,19,[.10,.62,1.48],1.92]);
group("1062", "bench-plate", plateHipThrust, {single:true}, ["l:glute","l:hamstring"], [63,19,[.10,.63,1.47],1.92]);
group("4129", "plate", plateSkaterSquat, {}, ["l:quad","l:glute"], [66,16,[.04,.88,.02],2.13]);
group("1250", "mat-plate", plateCore, {form:"behind-head"}, ["core"], mat);
group("0836", "mat-plate", plateCore, {}, ["core"], [63,23,[0,.46,.02],1.92]);
group("0839", "mat-plate", plateCore, {form:"lying-twist"}, ["core"], [56,28,[0,.46,.02],1.94],5800);
group("4623", "mat-plate", plateCore, {form:"sit-tuck"}, ["core"], [64,20,[0,.52,.17],1.98]);
group("1188", "bench-plate", plateCore, {setting:"flat",form:"bench-twist"}, ["core"], [64,19,[.10,.65,1.15],1.92],5700);
group("4127", "mat-dumbbells", dbDeadBug, {}, ["core"], [63,22,[0,.56,.02],1.90],6150);
group("2135", "mat-plate", platePlank, {}, ["core"], [68,19,[0,.27,-.13],1.80],4700);
group("5023", "mat-dumbbell", dbFloorLegRaise, {}, ["core"], [64,18,[0,.51,.14],2.02]);
group("4092", "upright-bench-dumbbell", elbowExtension, {setting:"upright",sharedBell:true}, ["triceps"], [60,17,[0,1.01,.35],1.90]);
group("10676", "weighted-backpack", backpackGait, {}, ["quad","glute","calf"], [128,15,[0,.95,.03],2.15],2600);
group("10677", "weighted-backpack", backpackGait, {run:true}, ["quad","glute","calf"], [128,15,[0,.96,.04],2.19],1860);
group("3910", "mat-weight-vest", pushUp, {}, ["pec","shoulder","triceps"], [61,22,[0,.49,-.08],1.91]);
group("10539", "bench-ankle-weight-left", weightedKneeExtension, {}, ["l:quad"], [62,18,[.10,.81,1.43],1.98]);
group("3587", "mat-ankle-weight-left", weightedQuadrupedLift, {}, ["l:glute","l:hamstring"], [65,21,[0,.42,-.17],1.86]);
group("2127", "captains-chair-ankle-weights", captainRaise, {}, ["core"], [57,14,[0,.93,.12],2.08],4830);
group("4102", "weight-belt-pull-up", pullUp, {reverse:true,width:.221,hold:true}, ["lat","biceps"], [45,16,[0,1.38,.019],2.65],4600);
group("4181", "weight-belt-pull-up", pullUp, {reverse:true,width:.237}, ["lat","biceps"], [45,16,[0,1.38,.019],2.65],4950);
group("0841", "vest-pull-up", pullUp, {width:.373,hold:true}, ["lat","biceps"], [51,16,[0,1.39,.035],2.66],4700);
group("3313", "weight-belt-straight-dip", dip, {straight:true}, ["triceps","pec"], [-56,16,[0,1.10,-.16],2.48],4250);
group("1767", "weight-belt-parallel-dips", dip, {hold:true}, ["triceps","pec"], [51,13,[0,1.04,-.07],2.24],4250);
group("3290", "pull-up-dumbbell", singleChinWithDumbbell, {}, ["l:lat","l:biceps"], [52,15,[0,1.39,.04],2.69],4650);
group("5035 11317", "extension-plate", plateBenchExtension, {}, ["glute","core"], [64,18,[0,.69,-.06],1.83],4550);
group("1234", "extension-plate", plateBenchExtension, {cross:true}, ["glute","core"], [65,18,[0,.69,-.06],1.83],4600);
group("2130", "decline-ab-plate", plateDeclineCore, {}, ["core"], [63,18,[0,.79,.05],1.95],4600);
group("3670", "decline-ab-plate", plateDeclineCore, {full:true}, ["core"], [62,18,[0,.85,.02],2.10],4700);
group("0830 1755", "dip-bench-plate", plateBenchDip, {}, ["triceps"], [65,18,[0,.60,.16],1.83],4550);
group("1184", "inverted-row-plate", plateInvertedRow, {}, ["lat","trap","biceps"], [65,17,[0,.61,.09],1.85],4500);
group("0840", "stability-ball-plate", ballPlateCore, {}, ["core","shoulder"], [63,20,[0,.87,.10],1.98],4400);
group("0849", "stability-ball-plate", ballPlateCore, {twist:true}, ["core"], [55,18,[0,.83,.13],1.85],5500);
group("1044", "plates", platePinch, {}, ["l:forearm"], [62,18,[0,.88,.08],2.02],5100);
group("0641", "mat-plate", loadedCrunch, {full:true}, ["core","shoulder"], [63,21,[0,.64,.04],1.92]);
group("4101", "mat-plate", loadedCrunch, {toes:true}, ["core"], [62,19,[0,.51,.02],1.83]);
group("5529", "dumbbells", weightedThruster, {}, ["quad","glute","shoulder"], overhead, 4500);
group("10383","sandbag",sandbagHinge,{},["quad","glute","hamstring"],bentOver);
group("10730","sandbag",sandbagHinge,{romanian:true},["hamstring","glute"],bentOver);
group("10389","sandbag",sandbagHinge,{rowing:true},["lat","biceps"],bentOver);
group("10385","sandbag",sandbagHinge,{shouldering:true},["quad","glute","trap"],standing,6400);
group("8891","sandbag",sandbagHinge,{goodMorning:true},["hamstring","glute"],[117,15,[0,.83,.04],2.05]);
group("10388","sandbag",sandbagRack,{press:true},["shoulder","triceps"],overhead);
group("10384","sandbag",sandbagRack,{squatting:true},["quad","glute"],standing);
group("10387 2712","sandbag",sandbagCarry,{},["core","forearm"],standing,3250);
group("10386","sandbag",sandbagCarry,{shoulders:true},["core","trap"],[122,14,[0,.93,.05],2.13],3250);
group("9940","sandbag",sandbagLunge,{},["quad","glute"],standing,5700);
group("8701","sandbag",sandbagWalkingLunge,{},["quad","glute"],[65,14,[0,.91,-.12],2.42],6200);
group("10427","sandbag",sandbagToss,{},["quad","glute","trap"],[67,17,[.16,.92,-.33],2.61],4450);

const [directory,...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
if (new Set(clips.map(({id})=>id)).size!==clips.length) throw new Error("Duplicate catalogue IDs.");
const selected = requested.length ? clips.filter(({id})=>requested.includes(id)) : clips;
if (!selected.length || (requested.length && selected.length!==requested.length)) throw new Error("Invalid catalogue IDs.");
const destination = resolve(directory);
await mkdir(destination,{recursive:true,mode:0o700});
const items = [];
const failures = [];
for (const {id,preset,motion,settings,muscles,camera,duration} of selected) {
  const [yaw,elevation,focus,height] = camera;
  const data = {version:1,equipment:preset,durationMs:duration,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,settings)}))};
  const recipe = id+".json";
  try {
    prepareRecipe(data);
    await writeFile(join(destination,recipe),JSON.stringify(data)+"\n");
    items.push({id,recipe,posterAt:settings.mode==="alternate"?.24:.47});
  } catch(error) {
    failures.push({id,error:error.message});
  }
}
await writeFile(join(destination,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log(JSON.stringify({prepared:items.length,failures}));
if (failures.length) process.exitCode = 1;
