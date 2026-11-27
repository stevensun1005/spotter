import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { agilityLayouts } from "../../skills/spotter-exercise-demo/lib/agility-layouts.js";
import { add,arm,blend,body,cycle,foot,ramp,scale,sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, up=[0,1,0];
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const mod=v=>(v%1+1)%1;
const mix=(a,b,u)=>a+(b-a)*u;
const vec2=(v)=>[v[0],0,v[1]];
function angle(from,to){
  return Math.atan2(to[0]-from[0],to[1]-from[1]);
}
function heading(a,b,f){
  return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*f;
}
function pathPoint(stages,t){
  const clock=clamp(t)*(stages.length-1);
  const i=Math.min(stages.length-2,Math.floor(clock));
  const local=clock-i;
  const before=stages[Math.max(0,i-1)], a=stages[i], b=stages[i+1], after=stages[Math.min(stages.length-1,i+2)];
  const early=angle(before,b), late=angle(a,after);
  const point=blend(a,b,local);
  return {point,yaw:heading(early,late,local),i,local};
}
function mark(p){
  p.handRoller={center:p.hips,axis:up};
  return p;
}
function grounded(p,s,sg,where,yaw,pointing=.065){
  foot(p,s,sg,where,[Math.sin(yaw),.101,Math.cos(yaw)],
    [Math.sin(yaw)*.144+sg*.017,-.070+pointing,Math.cos(yaw)*.144]);
}
function sprint(t,{prop,steps,modes=[]}){
  const {path}=agilityLayouts[prop];
  const {point,yaw,i,local}=pathPoint(path,t);
  const mode=modes[i]??"run";
  const sideways=mode==="side"|| prop==="agility-ladder-side";
  const back=mode==="back";
  const yawBody=prop==="agility-stick" ? .072 : prop==="agility-ladder-side" ? Math.PI*.52
    : sideways ? yaw-Math.PI*.5 : back ? yaw+Math.PI : yaw;
  const forward=[Math.sin(yawBody),0,Math.cos(yawBody)];
  const right=[Math.cos(yawBody),0,-Math.sin(yawBody)];
  const run=t*steps;
  const preload=Math.sin(Math.PI*mod(run*2));
  const landing=mode==="jump";
  const h=landing?.182*Math.sin(Math.PI*local):preload*(prop==="agility-stick"?.052:.061);
  const centerPoint=vec2(point);
  const reachDown=mode==="touch"?Math.sin(Math.PI*local)**7:0;
  const p=body(add(centerPoint,[0,.813+h-.095*reachDown,0]),(sideways?.148:.238)+.435*reachDown,yawBody);
  p.planted={};
  for(const [s,sg] of sides){
    const cycleAt=mod(run+(.5*sg+.50)*.50);
    const start=t-cycleAt/steps, end=start+1/steps;
    const mid=cycleAt<.53?0:ramp(cycleAt,.53,1);
    const footCenter=vec2(blend(pathPoint(path,start+.20/steps).point,pathPoint(path,end+.20/steps).point,mid));
    const lift=cycleAt<.53?0:Math.sin(Math.PI*mid)*(landing?.16:.115);
    const smallStride=sideways||prop==="agility-stick";
    const fw=(smallStride?.105:.178)*Math.cos(2*Math.PI*cycleAt);
    const supported=centerPoint.map((x,index)=>index===1?0:mix(x,footCenter[index],landing?.27:.83));
    const q=add(add(add(supported,scale(right,sg*(sideways?.164:.136))),scale(forward,fw)),[0,floor+lift+h*.16,0]);
    grounded(p,s,sg,q,yawBody,lift*.5);
    const pump=(smallStride?.171:.277)*Math.cos(2*Math.PI*cycleAt);
    const reachPoint=reachDown>0&&s==="r"?add(add(p.hips,scale(forward,.301)),[-.044,-.416*reachDown,.05]):
      add(add(p.chest,scale(right,sg*.228)),add(scale(forward,.214+pump),[0,-.251+Math.max(0,pump)*.34,0]));
    arm(p,s,reachPoint,[sg*.54,-.82,-.08]);
  }
  return mark(p);
}
function jumpTouch(t,{prop}){
  const hurdle=prop==="agility-hurdle";
  if(hurdle&&t>.40)return sprint((t-.40)/.60,{prop,steps:5.3,modes:["run","side","run","back","run"]});
  const k=hurdle?clamp(t/.40):t;
  const prep=cycle(k/.37,.53,.70);
  const flight=cycle((k-.22)/.53,.45,.50);
  const land=cycle((k-.63)/.37,.34,.58);
  const yaw=hurdle?0:-.21;
  const z=hurdle?mix(-1.03,-.041,ramp(k,.17,1)):.005;
  const p=body([0,.881+(hurdle?.73:.385)*flight-.180*prep-.115*land,z],.082+.435*prep+.223*land,yaw);
  p.planted={};
  for(const [s,sg] of sides){
    const ankle=hurdle?[sg*.166,.075+.785*flight,z-.068+.105*flight]:[sg*.160,.075+.382*flight,.040-.061*flight];
    grounded(p,s,sg,ankle,yaw,flight*.045);
    const upHand=add(p.neck,[sg*.131,.502,.104]);
    const counter=add(p.chest,[sg*.274,-.370,.205+flight*.201]);
    const send=s==="r"?flight:hurdle?flight*.73:.14*flight;
    arm(p,s,blend(add(p.chest,[sg*.236,-.373,-.18*prep]),s==="r"||hurdle?upHand:counter,send),
      [sg*.51,-.65,.40]);
  }
  p.machineTravel=hurdle?0:cycle((k-.49)/.51,.31,.63);
  return mark(p);
}

const items=[
  ["5965","agility-stick",9.0,[],[47,19,[0,.89,.03],2.07]],
  ["5967","agility-ball",8.0,["side","side","side","side"],[47,26,[0,.82,0],2.28]],
  ["5984","agility-back-three",10.0,["run","back","run","touch","side","touch","run"],[24,33,[0,.72,-.08],3.44]],
  ["5985","agility-balloon",0,[],[55,14,[0,1.19,.01],2.75]],
  ["5986","agility-cones",12.0,[],[35,32,[0,.72,-.10],3.45]],
  ["5969","agility-dots",9.0,Array(7).fill("jump"),[31,29,[0,.74,-.12],2.71]],
  ["5971","agility-l",13.0,["touch","back","run","run","run","run","run","back","run"],[28,35,[0,.73,-.06],3.67]],
  ["5972","agility-ladder",10.0,["run","run","side","run","side"],[32,35,[0,.79,0],3.43]],
  ["5973","agility-ladder-side",10.0,["side","side"],[34,36,[0,.79,0],3.47]],
  ["5974","agility-plyometric",8.0,Array(4).fill("jump"),[27,32,[0,.73,.1],3.04]],
  ["5976","agility-t",11.0,["touch","side","side","side","back"],[24,37,[0,.72,-.12],3.73]],
  ["5979","agility-x",10.0,["run","side","back","side"],[23,37,[0,.73,-.07],3.73]],
  ["5990","agility-hurdle",0,[],[53,24,[0,.97,-.03],3.40]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,prop,steps,modes,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view, camera={yaw,elevation,focus,height};
  const durationMs=steps===0?6500:prop==="agility-stick"?4510:6200;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...(steps===0?jumpTouch(n/64,{prop}):sprint(n/64,{prop,steps,modes}))}));
  const recipe=id+".json", data={version:1,equipment:"spotter-"+prop,durationMs,muscles:["quad","glute","calf"],camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:id==="5990"?.21:.44});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
