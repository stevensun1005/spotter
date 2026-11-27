import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, body, cycle, foot, fromSupport, inactive, scale, sides } from "./catalogue-dumbbell-recipes.mjs";
const floor=.075;
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));

function sideBench() {
  const p=body([.08,.651,1.139],-Math.PI/2,0,Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,[.08+sign*.044,.545+sign*.056,1.754],[.62,.43,.025],[.122,-.044,.048]);
  return p;
}

function neck(t,{mode="flex",harness=false}={}){
  let p;
  const up=cycle(t);
  const side=mode==="side"||mode==="side-low";
  const prone=mode==="extend";
  const standing=mode==="standing";
  const seated=mode==="seated";
  const rotate=mode==="twist";
  const tilt=mode==="tilt";
  if(side)p=sideBench();
  else if(prone){
    p=fromSupport("proneFlat",{point:[.1,.560,1.139]});
  }else if(standing){
    p=body([0,.857,-.177],.864);
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.145,floor,.031]);
  }else if(seated)p=fromSupport("seat",{pitch:.29});
  else p=fromSupport("flat",{point:[.10,.552,1.141]});
  if(standing||seated){
    const moment=.22-.49*up;
    const pitch=standing?.86:.29;
    p.headAim=[0,Math.cos(pitch+moment),Math.sin(pitch+moment)];
  }else if(side){
    p.headAim=[0,Math.sin(-.25+.65*up),-Math.cos(-.25+.65*up)];
  }else if(prone){
    p.headAim=[0,Math.sin(-.34+.70*up),-Math.cos(-.34+.70*up)];
  }else if(rotate){
    p.headAim=[0,.038,-1];
    p.headTurn=.65*Math.sin(2*Math.PI*t);
  }else if(tilt){
    p.headAim=[.347*Math.sin(2*Math.PI*t),.068,-1];
  }else{
    const bend=-.31+.74*up;
    p.headAim=[0,Math.sin(bend),-Math.cos(bend)];
  }
  if(!standing&&!seated)p.headDrop=side||prone?.050*(1-up):.038*(1-up);
  p.head=add(p.neck,scale(unit(p.headAim),.121));
  if(harness){
    for(const [side,sign] of sides) {
      if(standing||seated)inactive(p,side,sign,"thigh");
      else if(side==="l")arm(p,side,add(p[side+"s"],[sign*.234,-.121,.031]),[sign*.60,-.30,.28]);
      else arm(p,side,add(p[side+"s"],[sign*.199,-.118,.111]),[sign*.59,-.43,.59]);
    }
    return p;
  }
  const face=prone?[0,.103,-.017]:side?[.009,.105,-.021]:[.042*Math.sin(p.headTurn??0),.100,.009];
  const headCenter=add(p.head,add(face,[0,-p.headDrop,0]));
  for(const [sideName,sign] of sides){
    const working=sideName==="l"||!side;
    if(working){
      const rest=side?[.021,.045,.091]:[sign*.076,.022,.029];
      arm(p,sideName,add(headCenter,rest),[sign*.62,.11,.58]);
      p[sideName+"PalmSide"]=[0,-1,0];
      p[sideName+"Fingers"]=[-sign*.73,-.203,-.474];
    }else{
      arm(p,sideName,[.330,.421,.661],[.70,-.19,.30]);
      p[sideName+"PalmSide"]=[0,1,0];
    }
  }
  const normal=side?unit([0,1,.31-.25*up]):unit([.333*Math.sin(p.headTurn??0),1,prone?.35-.52*up:-.29+.51*up]);
  p.dumbbells.push({center:headCenter,axis:normal});
  return p;
}

const flat=[66,22,[.10,.61,.94],1.64];
const side=[75,24,[.10,.63,1.03],1.68];
const standing=[61,17,[0,.93,.16],2.02];
const seated=[60,18,[.10,.86,1.34],1.85];
const items=[
  ["1042",{mode:"extend"},"bench-plate",flat],
  ["2408",{mode:"extend",harness:true},"bench-head-harness",flat],
  ["1043",{mode:"flex"},"bench-plate",flat],
  ["2409",{mode:"flex",harness:true},"bench-head-harness",flat],
  ["4432",{mode:"twist"},"bench-plate",[80,24,[.10,.58,.89],1.52]],
  ["4431",{mode:"tilt"},"bench-plate",[72,23,[.10,.59,.89],1.55]],
  ["0838",{mode:"side",harness:true},"long-bench-head-harness",side],
  ["4429",{mode:"side"},"long-bench-plate",side],
  ["4430",{mode:"side-low"},"long-bench-plate",[56,25,[.10,.62,1.01],1.67]],
  ["0848",{mode:"seated",harness:true},"bench-head-harness",seated],
  ["2410",{mode:"standing",harness:true},"standing-head-harness",standing],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const selected=wanted.length?items.filter(([id])=>wanted.includes(id)):items;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const [id,args,equipment,view] of selected){
  const [yaw,elevation,focus,height]=view;
  const data={version:1,durationMs:4350,equipment,muscles:["neck"],camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,n)=>({at:n/64,...neck(n/64,args)}))};
  try{prepareRecipe(data);}
  catch(error){failures.push({id,error:error.message});continue;}
  const recipe=id+".json";
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.47});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
