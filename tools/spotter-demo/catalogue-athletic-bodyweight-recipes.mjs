import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, leg, legAngles, mix, ramp, rep, sides, stand } from './bodyweight/pose.mjs';

const rows=[], floor=.079, pi=Math.PI;
const fieldView={yaw:66,elevation:13,focus:[0,.89,.30],height:2.47};
const stationView={yaw:52,elevation:15,focus:[0,.93,.061],height:2.47};
function addSet(motion,equipment,muscles,view,variants){
  for(const[id,o]of variants)rows.push({id,motion,equipment:o.equipment??equipment,muscles:o.muscles??muscles,view:{...view,...o.view},o});
}
function pulse(p,a,b,c,d) {return ramp(p,a,b)*(1-ramp(p,c,d));}
function spring(t,a,b,peak){
  return peak*Math.sin(pi*ramp(t,a,b));
}
function place(p,side,s,a,surface,tilt=0) {
  leg(p,side,a,[s*.106,.029,1],[s*.013,-.072+.117*Math.sin(tilt),.134*Math.cos(tilt)],surface);
}
function arms(p,factor,opposite=false) {
  for(const[side,s]of sides) {
    const f=opposite?s*factor:factor;
    arm(p,side,add(p[side+'s'],[s*.078,-.541+.968*Math.max(0,f),.136+.436*f]),
      [s*.72,-.458,-.35],[s*.042,-.44,.88]);
  }
}
function jumpSequence(phase,{kind}){
  const depth=kind==='depth'||kind==='depth-forward'||kind==='hurdle';
  const forward=kind==='long'||kind==='two'||kind==='depth-forward'||kind==='hurdle';
  const later=kind==='two';
  const hurdle=kind==='hurdle';
  const drop = depth?ramp(phase,.069,.290):1;
  const start=depth?-.923:kind==='long'?-.601:-.486;
  const first=depth?.307:.199, finish=depth?.650:.56;
  const travel=ramp(phase,first,finish);
  let z=depth?mix(start,-.336,drop):start;
  const going=forward?(kind==='long'?1.86:later?1.30:hurdle?1.62:1.58):0;
  z+=going*travel;
  const surface=depth&&drop<.001?.254:0;
  const dropY=depth?.254*(1-drop):0;
  const lift=spring(phase,first,finish,kind==='long'?.402:hurdle?.530:.414)+
    (later?spring(phase,.618,.944,.341):0);
  const before=pulse(phase,depth?.238:.041,depth?.294:.16,first+.014,first+.074);
  const after=pulse(phase,finish-.031,finish+.034,finish+.049,finish+.154);
  const squat=.226*before+.159*after;
  const p=stand([0,.856+dropY+lift-squat,z],.043+.51*squat+(forward?.201*Math.sin(pi*travel):0));
  for(const[side,s]of sides){
    const stepped=side==='l'||!depth ? drop:ramp(phase,.107,.302);
    const shift=depth?.041*(stepped-drop):0;
    const airborne=lift>.004||drop>.001&&drop<.995;
    const foot=[s*.146,floor+dropY+lift+(depth&&drop<.99&&side==='l'?.091*Math.sin(pi*drop):0),
      z+.043+.168*Math.sin(pi*travel)+shift];
    place(p,side,s,foot,airborne?undefined:surface,lift>.004?-.31:0);
  }
  arms(p,-.711*before+ .91*pulse(phase,first-.052,first+.094,finish+.021,finish+.135)+
    (later?.99*pulse(phase,.591,.725,.834,.95):0));
  return p;
}
function lateralHops(phase,{kind}){
  const board=kind==='single', hurdle=kind==='hurdle', square=kind==='square';
  const cycles=square?4:2;
  const i=Math.min(cycles-1,Math.floor(phase*cycles));
  const p0=phase*cycles-i;
  const q=ramp(p0,.19,.78);
  const d=i%2===0?1:-1;
  const width=board?.35:hurdle?.431:.432;
  const corners=[[-.42,-.413],[.42,-.413],[.42,.465],[-.42,.465]];
  const c=square?blend(corners[i],corners[(i+1)%4],q):[mix(-d*width,d*width,q),board?.193:0];
  const air= spring(p0,.19,.78,hurdle?.406:board?.252:.161);
  const landingSink=.137*pulse(p0,.72,.87,.90,.99);
  const sink=.104*pulse(p0,.004,.13,.17,.27)+landingSink;
  const t=stand([c[0],.856+air-sink,c[1]],.083+.849*sink,0,-.195*d*Math.sin(pi*q));
  for(const[side,s]of sides){
    if(board&&side==='r')leg(t,side,add(t.hips,[-.177,-.395,-.319]),[-.109,-1,.307],[s*.011,-.087,-.099]);
    else place(t,side,s,[c[0]+s*(board?.031:.097),floor+air,c[1]+.043],air>.003?undefined:0);
  }
  arms(t,.89*Math.sin(pi*q)-.51*(sink/.24));
  return t;
}

function seatedJump(phase,{kind}){
  const t=rep(phase,.36,.62);
  const wall=kind==='wall';
  const air=spring(phase,.27,.72,wall?.273:.367);
  const eccentric=pulse(phase,.67,.735,.795,.97);
  const pelvis=[0,.502+.364*t+air-.165*eccentric,wall?-.109+.092*t:-.111+.333*t];
  const pose=stand(pelvis,wall?-.069+.15*t:.271-.209*t);
  for(const[side,s]of sides)place(pose,side,s,[s*.166,floor+air,wall?.382:.331+.106*t],air>.003?undefined:0);
  arms(pose,.92*t-.22*(1-t));
  return pose;
}
function springDeck(phase){
  const cycle=(phase*3)%1;
  const air=spring(cycle,.16,.86,.181);
  const inflate=rep(cycle,.07,.22);
  const y=.861+.197+air-.053*inflate;
  const p=stand([0,y,.04],.051+.032*inflate);
  for(const[side,s]of sides)place(p,side,s,[s*.083,.197+floor+air,.083],air>.002?undefined:.197,air>.002?-.39:-.19);
  arms(p,.233*inflate);
  return p;
}
function stairHop(phase){
  const first=ramp(phase,.205,.522);
  const last=ramp(phase,.72,.965);
  const height=.184*first*(1-last);
  const jumping=spring(phase,.205,.522,.258);
  const settle=pulse(phase,.487,.546,.584,.688);
  const start=-.273, z=mix(start,.268,first*(1-last));
  const p=stand([0,.858+height+jumping-.139*settle,z],.049+.35*settle);
  for(const[side,s]of sides){
    const down=side==='l'?last:ramp(phase,.81,.995);
    const toZ=mix(start,.268,first*(1-down));
    const toY=.184*first*(1-down)+jumping+.059*Math.sin(pi*down);
    place(p,side,s,[s*.123,floor+toY,toZ+.041],jumping>.004||down>.004&&down<.993?undefined:toY);
  }
  arms(p,.851*Math.sin(pi*first)-.579*pulse(phase,.04,.13,.18,.234));
  return p;
}
function runFree(phase,{kind}){
  const cycles=kind==='wind'?3:4;
  const g=phase*cycles;
  const accelerate=ramp(phase,0,.25), brake=1-.65*ramp(phase,.84,1);
  const v=(.6+.45*accelerate)*brake;
  const z=-1.228+2.42*phase;
  const y=.856+.107*Math.abs(Math.sin(2*pi*g))-.091*(1-accelerate);
  const p=stand([0,y,z],.398-.171*accelerate);
  p.followZ=1.65*phase;
  for(const[side,s]of sides){
    const st=(g+(s<0?.5:0))%1;
    const stance=st<.42;
    const swing=Math.max(0,(st-.42)/.58);
    const travelZ=stance?mix(.417,-.478,st/.42):mix(-.478,.417,ramp(swing,.09,.9));
    const kneeDrive=Math.sin(pi*swing)*.393*v;
    place(p,side,s,[s*.119,floor+kneeDrive,z+travelZ*v],stance?0:undefined,-.48*Math.sin(st*pi));
  }
  arms(p,.809*Math.sin(2*pi*g),true);
  return p;
}
function hipThrustJump(phase){
  const t=rep(phase);
  const bounce=spring(phase,.304,.64,.124);
  const hipY=.173+.334*t+bounce;
  const hipZ=.030+.064*t;
  const p=stand([0,hipY,hipZ],Math.atan2(-.561-hipZ,.507-hipY));
  place(p,'l',1,[.143,floor+bounce,.560],bounce>.005?undefined:0);
  leg(p,'r',[-.158,.420+.248*t,.514-.051*t],[-.111,.890,.343],[-.01,.063,.111]);
  for(const[side,s]of sides)arm(p,side,[s*.352,.468,-.556],[s*.68,-.456,-.329],[s*.77,-.097,.378],[0,1,0]);
  return p;
}
function depthPush(phase){
  const change=phase<.50?1:-1;
  const u=(phase*2)%1;
  const t=ramp(u,.17,.69);
  const narrow=change>0?t:1-t;
  const air=spring(u,.15,.69,.106);
  const impact=pulse(u,.67,.79,.83,.99);
  const p=stand([0,.517+air-.091*impact,-.273+.026*impact],1.31+.154*impact);
  for(const[side,s]of sides){
    place(p,side,s,[s*.149,.417+.110,-1.099],.417,-.49);
    const y=.070+.113*(1-narrow)+air;
    const x=s*mix(.369,.216,narrow);
    arm(p,side,[x,y,.425],[s*.57,-.243,-.67],[0,-.037,1],[0,1,0]);
  }
  return p;
}

addSet(jumpSequence,'gym-depth-deck',['quad','glute','calf'],fieldView,[
  ['4844',{kind:'depth',view:{yaw:58,focus:[0,.93,-.62]}}],
  ['4843',{kind:'depth-forward',view:{yaw:70,focus:[0,.94,.02],height:2.74}}],
  ['4198',{kind:'hurdle',equipment:'gym-depth-hurdle',view:{yaw:68,focus:[0,1.00,.10],height:2.78}}],
  ['4242',{kind:'two',equipment:'none',view:{yaw:66,focus:[0,.91,.14],height:2.54}}],
  ['1600',{kind:'long',equipment:'gym-jump-line',view:{yaw:73,focus:[0,.88,.27],height:2.57}}],
]);
addSet(lateralHops,'gym-lateral-hurdle',['quad','calf'],stationView,[
  ['6958',{kind:'hurdle',view:{yaw:27}}],
  ['0782',{kind:'square',equipment:'gym-floor-square',duration:4770,view:{yaw:29,elevation:25,height:2.62}}],
  ['4245',{kind:'single',equipment:'gym-hop-board',view:{yaw:21}}],
]);
addSet(seatedJump,'gym-bench-squat',['quad','glute','calf'],stationView,[
  ['10053',{kind:'seat',view:{yaw:72}}],
  ['0647',{kind:'wall',equipment:'gym-wall-squat-jump',view:{yaw:72,focus:[0,.96,.091],height:2.50}}],
]);
addSet(springDeck,'gym-mini-trampoline',['calf'],stationView,[['10890',{duration:3630,view:{yaw:28,height:2.60}}]]);
addSet(stairHop,'gym-box-stairs',['quad','calf'],stationView,[['3720',{view:{yaw:61,focus:[0,.92,.26]}}]]);
addSet(runFree,'none',['quad','hamstring','calf'],fieldView,[
  ['5216',{kind:'sprint',duration:4750,view:{yaw:68,focus:[0,.96,-.36]}}],
  ['0858',{kind:'wind',duration:3650,view:{yaw:63,focus:[0,.96,-.33]}}],
]);
addSet(hipThrustJump,'gym-hip-thrust-cross-bench',['glute','hamstring'],stationView,[
  ['4793',{duration:4350,view:{yaw:67,focus:[0,.67,-.02],height:1.98}}],
]);
addSet(depthPush,'gym-depth-push-up',['pec','triceps','core'],stationView,[
  ['0492',{duration:4450,view:{yaw:40,elevation:20,focus:[0,.49,-.16],height:1.96}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,motion,o,equipment,muscles,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:o.duration??4740,camera:view,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,o)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:o.poster??.467});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
