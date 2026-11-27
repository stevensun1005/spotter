import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, zAxis=[0,0,1];
function route(t,stops){
  const i=stops.findIndex(([end])=>t<=end);
  return i<=0?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function resetWalk(t){return ramp(t,0,.91);}
function heldStone(p,target,{released=false,side=.163,axis=zAxis}={}){
  for(const [name,sign] of sides){
    arm(p,name,add(target,[sign*(side+.301*released),released?-.09:0,-.071]),[sign*.72,-.49,.36]);
    p[name+"PalmSide"]=[sign,0,.297];
    p[name+"Fingers"]=[sign*-.92,.35,.14];
  }
  p.ballCenter=released?target:add(scale(add(p.lw,p.rw),.5),scale(axis,.068));
  return p;
}

function leverSpring(t){
  const p=fromSupport("wristSeat");
  const u=cycle(t,.23,.77);
  const e=add(p.lk,[-.071,.090,-.187]);
  p.le=add(p.ls,scale(add(e,scale(p.ls,-1)),.67));
  p.lw=add(p.le,[.013,.096*u,.355-.044*u]);
  p.lFingerCurl=.17+.83*u;
  p.lGrip=[1,0,0];
  p.lFingers=[0,.253*u,1];
  inactive(p,"r",-1,"thigh");
  return p;
}

function rolling(t,{neutral=false}={}){
  const p=fromSupport("floor");
  const u=cycle(t,.47,.61);
  p.machineTravel=6.27*u;
  for(const [side,sign] of sides){
    const y=neutral?0:.036*Math.sin((t*5+sign*.2)*Math.PI*2);
    const contact=neutral?[sign*.139,1.299,.561]:[sign*.173,1.345+y,.581];
    arm(p,side,contact,[sign*.77,-.36,.10]);
    p[side+"Grip"]=neutral?[0,1,0]:[1,0,0];
    p[side+"Fingers"]=[0,Math.sin(24*t+sign*.19),.71];
  }
  return p;
}

function liftingStone(t,{mode="press"}={}){
  const press=mode==="press";
  const stairs=mode==="stairs";
  const stones=mode==="stones";
  if(press){
    const crouch=cycle(t/.54,.38,.61)*.128;
    const u=cycle((t-.19)/.81,.40,.57);
    const p=body([0,.877-crouch,.034-.067*crouch],.042+crouch*.7);
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.155,floor,.085],[sign*.13,.052,.96]);
    return heldStone(p,add(p.chest,[0,.084+.572*u,.241-.113*u]),{side:.164});
  }
  if(stairs){
    const wave=route(t,[[0,[0]],[.28,[1]],[.54,[2]],[.79,[3]],[1,[3]]])[0];
    const index=Math.min(2,Math.floor(wave)), offset=wave-index;
    const release=ramp(t,.82,.98);
    const p=body([0,.883+wave*.167,.092+wave*.328],.041+.103*Math.sin(Math.PI*offset));
    for(const [side,sign] of sides){
      const pos=side==="l"?wave:Math.max(0,wave-.61);
      const lift=Math.max(0,Math.sin(Math.PI*pos))*.095;
      foot(p,side,sign,[sign*.137,floor+.168*pos+lift,.116+.332*pos],[sign*.13,.09,.96]);
      if(lift<.005)p.planted[side]=Math.min(.504,.168*pos);
    }
    const target=blend(add(p.chest,[0,.097,.246]),[0,.685,1.139],release);
    return heldStone(p,target,{released:release>.98});
  }
  const lowering=route(t,[[0,[1]],[.18,[.69]],[.26,[.72]],[.52,[0]],[.69,[0]],[1,[.10]]])[0];
  const displacement=ramp(t,.35,.55)*(1-ramp(t,.74,.98));
  const release=ramp(t,.55,.74);
  const setdown=stones?route(t,[[0,[0]],[.64,[0]],[.74,[1]],[1,[1]]])[0]:release;
  const p=body([0,.878-.351*lowering,.041-.116*lowering+.245*displacement],.041+.683*lowering);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.174,floor,.091+displacement*.24],[sign*.23,.035,.95]);
  const low=[0,.182,.187];
  const lap=[0,.596,.340];
  const top=stones?[0,1.214,.770]:[0,1.044,.748];
  const placed=stones?[0,.185,1.022]:[0,1.044,.748];
  const path=route(t,[[0,low],[.18,lap],[.26,lap],[.58,top],[.65,top],[1,placed]]);
  const target=blend(path,placed,setdown);
  return heldStone(p,target,{released:release>.60,side:.175});
}

function vehicle(t){
  const flip=route(t,[[0,[0]],[.31,[.62]],[.48,[1.04]],[.69,[2.82]],[.78,[Math.PI]],[1,[Math.PI]]])[0];
  const load=route(t,[[0,[1]],[.24,[.49]],[.42,[.12]],[.60,[0]],[1,[0]]])[0];
  const step=ramp(t,.55,.94);
  const p=body([1.191-.405*step,.877-.357*load,.003],.036+.864*load,-Math.PI/2);
  p.machineTravel=flip;
  for(const [side,sign] of sides){
    foot(p,side,sign,[1.158+(side==="l"?-.288:.173)*step,floor,sign*.163],[.99,.09,sign*.18],[-.124,-.071,sign*.03]);
    const a=.314, x=1.21;
    const contact=[-.647+Math.cos(flip)*x-Math.sin(flip)*a,Math.sin(flip)*x+Math.cos(flip)*a,sign*.147];
    const hands=flip<1.39?contact:add(p[side+"s"],[-.062,-.556,.059*sign]);
    arm(p,side,hands,[.49,-.37,sign*.59]);
    p[side+"Fingers"]=[-.89,.29,.12*sign];
    p[side+"PalmSide"]=[1,0,0];
  }
  return p;
}

function frameSquat(t){
  const u=cycle(t);
  const p=body([0,.879-.337*u,.071-.131*u],.035+.218*u);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.165,floor,.096],[sign*.17,.085,.95]);
    arm(p,side,[sign*.522,p[side+"s"][1]+.024,.027],[sign*.63,-.36,-.52]);
    p[side+"Grip"]=[1,0,0];
  }
  return p;
}

function conanWalk(t){
  const angle=t*1.72;
  const p=body([1.433*Math.cos(angle),.875+.021*Math.sin(5*Math.PI*t)**2,-1.433*Math.sin(angle)],.051,Math.PI+angle);
  p.machineTravel=angle;
  for(const [side,sign] of sides){
    const step=(t*2.7+(side==="l"?.5:0))%1;
    const shift=(step<.62?.5-step/.62:(step-.62)/.38-.5)*.405;
    const y=floor+(step<.62?0:.116*Math.sin(Math.PI*(step-.62)/.38));
    const target=add([p.hips[0],y,p.hips[2]],add(scale(p.right,sign*.128),scale(p.front,shift)));
    foot(p,side,sign,target,p.front,add([0,-.070,0],scale(p.front,.143)));
    const hold=add([p.hips[0],1.015+p.hips[1]-.853,p.hips[2]],add(scale(p.right,sign*.169),scale(p.front,.194)));
    arm(p,side,hold,add(scale(p.right,sign*.68),[0,-.57,0]));
    p[side+"Fingers"]=p.front;
    p[side+"PalmSide"]=[0,1,0];
  }
  return p;
}

function barrowWalk(t){
  const distance=.871*resetWalk(t);
  const leave=ramp(t,.84,.97);
  const load=cycle(t,.22,.73)*.126;
  const p=body([0,.873-.063*leave,.014+distance],.043+.283*leave);
  p.machineTravel=distance;
  for(const [side,sign] of sides){
    const gait=(t*2.55+(side==="l"?.50:0))%1;
    const step=(gait<.62?.5-gait/.62:(gait-.62)/.38-.5)*.391;
    const y=floor+(gait<.62?0:.113*Math.sin(Math.PI*(gait-.62)/.38));
    foot(p,side,sign,[sign*.132,y,.044+distance+step],[sign*.10,.029,.94]);
    arm(p,side,[sign*.167,.654-load*.09-.116*leave,.209+distance],[sign*.69,-.43,-.32]);
    p[side+"Grip"]=zAxis;
  }
  return p;
}

function ballBack(t){
  const u=cycle(t);
  const p=body([0,.626,-.102],2.065-1.086*u);
  p.ballCenter=[0,.285,-.104];
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.173,.115,-.539],[sign*.14,-.48,-.87],[sign*.007,-.048,-.076]);
  const center=add(p.chest,scale(p.front,.211));
  for(const [side,sign] of sides){
    arm(p,side,add(center,[sign*.082,.024,.012]),[sign*.83,-.27,.22]);
    p[side+"PalmSide"]=[sign,0,0];
  }
  p.dumbbells.push({center,axis:p.front});
  return p;
}

const stand=[59,17,[0,.93,.05],2.24];
const jobs=[
  ["3345",leverSpring,{},"weighted-hand-spring",["l:forearm"],[61,22,[.12,.63,1.42],1.39],4250,.45],
  ["8882",rolling,{neutral:true},"weighted-wrist-roller-neutral",["forearm"],[62,17,[0,.97,.24],1.89],5950,.36],
  ["0859",rolling,{},"weighted-wrist-roller-pronated",["forearm"],[57,17,[0,.96,.15],1.92],5900,.45],
  ["3317",vehicle,{},"weighted-car-flip",["quad","glute","pec"],[36,22,[.33,.82,.07],2.61],6500,.42],
  ["2716",conanWalk,{},"weighted-conan-wheel",["quad","glute","core"],[30,18,[.64,1.03,-.55],2.79],6200,.46],
  ["2723",barrowWalk,{},"weighted-wheelbarrow",["quad","glute","forearm"],[62,17,[0,.94,.73],2.48],6250,.44],
  ["2720",frameSquat,{},"weighted-platform-squat",["quad","glute"],[54,17,[0,.92,.06],2.32],4700,.47],
  ["2722",liftingStone,{mode:"stones"},"weighted-stones",["quad","glute","biceps"],[62,20,[0,.86,.50],2.32],6350,.49],
  ["2721",liftingStone,{mode:"platform"},"weighted-platform-load",["quad","glute","biceps"],[63,18,[0,.86,.54],2.29],6100,.52],
  ["2725",liftingStone,{mode:"stairs"},"weighted-power-stairs",["quad","glute","biceps"],[62,18,[0,1.07,.59],2.69],6500,.49],
  ["11716",liftingStone,{},"weighted-stone-press",["quad","glute","shoulder"],[56,17,[0,1.04,.08],2.45],4900,.49],
  ["0835",ballBack,{},"wall-ball-plate",["glute","hamstring","core"],[62,20,[0,.75,.01],1.80],4550,.46],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const selected=wanted.length?jobs.filter(([id])=>wanted.includes(id)):jobs;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const [id,motion,args,equipment,muscles,view,durationMs,posterAt] of selected){
  const [yaw,elevation,focus,height]=view??stand;
  const data={version:1,durationMs,equipment,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,n)=>({at:n/64,...motion(n/64,args)}))};
  try{prepareRecipe(data);}
  catch(error){failures.push({id,error:error.message});continue;}
  const recipe=id+".json";
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
