import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,blend,body,cycle,foot,scale,sides } from "./catalogue-dumbbell-recipes.mjs";
const up=[0,1,0], lateral=[1,0,0], forward=[0,0,1], floor=.075;
const mid=(a,b)=>scale(add(a,b),.5);
const normal=v=>scale(v,1/Math.max(.001,Math.hypot(...v)));
function marker(p){
  const axis=normal(add(p.lw,scale(p.rw,-1)));
  p.handRoller={center:mid(p.lw,p.rw),axis};
  return p;
}
function grip(p,s,where,guide,axis=lateral,palm=up){
  arm(p,s,where,guide);p[s+"Grip"]=axis;p[s+"PalmSide"]=palm;
}
function legs(p,{split=0,depth=-.046}={}){
  for(const [s,sg] of sides)foot(p,s,sg,[sg*.147,floor,depth+sg*split],[sg*.14,.11,.98]);
}

function door(t,{mode}){
  const u=cycle(t,.40,.57);
  const stretch=mode==="stretch";
  const sheet=mode==="sheet-row"||mode==="sheet-delt";
  const hips=stretch?[.141,.858,.069+.155*u]:[0,.851+.026*u,-.325+.153*u];
  const p=body(hips,stretch?.052:-.524+.367*u,stretch?-.226-.690*u:0);
  legs(p,{split:stretch?.223:.008,depth:stretch?.252:.015});
  for(const [s,sg] of sides){
    if(stretch){
      if(s==="l"){
        p.le=[.431,1.360,.372];
        p.lw=[.411,1.670,.382];
        p.lFingers=[0,.997,.054];
        p.lPalmSide=[0,0,1];
      }else arm(p,s,add(p.chest,[-.197,-.413,.127]),[-.74,.01,.30]);
    }else if(sheet){
      const y=1.060+(mode==="sheet-delt"?.201:0)*u;
      const x=.169+(mode==="sheet-delt"?.211:.044)*u;
      const z=.119-((mode==="sheet-delt")?.132:.140)*u;
      grip(p,s,[sg*x,y,z],[sg*(.43+(mode==="sheet-delt"?.32:0)),-.52,-.49],up);
    }else{
      grip(p,s,[sg*.401,1.114,.352],[sg*.49,-.68,-.35],up);
    }
  }
  return marker(p);
}

function freeSheet(t,{mode}){
  const u=cycle(t,.42,.56), extension=mode==="triceps", fly=mode==="fly";
  const p=body([0,.883,.022],.021);
  legs(p);
  for(const [s,sg] of sides){
    const point=extension?(s==="l"?[.129,1.578+.312*u,-.107+.143*u]:[-.156,1.296-.246*u,-.149]):
      fly?[sg*(.260+.351*u),1.272+.081*u,.485-.187*u]:
      s==="l"?[.131,1.053+.276*u,.251-.045*u]:[-.123,.942-.206*u,.272-.126*u];
    grip(p,s,point,[sg*.63,extension?.54:fly?.094:-.654,extension?-.28:-.09],fly?lateral:up);
    p[s+"Fingers"]=extension?up:forward;
  }
  return marker(p);
}

function tableRow(t,{mode}){
  const u=cycle(t,.42,.56), bent=mode==="bent";
  const p=body([0,(bent?.407:.272)+.169*u,bent?.528:.525],
    -Math.PI/2+(bent?.273:.383)-.108*u);
  p.planted={};
  for(const [s,sg] of sides){
    if(bent)foot(p,s,sg,[sg*.168,floor,1.116],[sg*.17,.96,-.16],[sg*.013,-.072,.150]);
    else foot(p,s,sg,[sg*.163,.068,1.316],[sg*.069,.96,-.13],[sg*.011,.057,.142]);
    grip(p,s,[sg*(mode==="curl"?.153:.267),.754,-.024],[sg*.693,-.36,.37],lateral,mode==="curl"?up:[0,0,1]);
  }
  p.headAim=[0,1,.10];
  return marker(p);
}

function deskWrist(t,{mode}){
  const u=cycle(t,.38,.61);
  const p=body([.056,.552,-.261],.468);
  legs(p,{depth:-.091});
  p.re=[-.166,.835,.229];
  p.rw=[-.180,.836,.583];
  const radial=mode==="radial", ulnar=mode==="ulnar", thumb=mode==="thumb";
  const iso=mode==="iso", flex=mode==="flex";
  const delta=radial?.49*u:ulnar?-.46*u:iso?.025*u:flex?.79*u:.66*u;
  p.rFingers=normal([mode==="ulnar"?.077*u:0,Math.sin(thumb?0:delta),Math.cos(thumb?0:delta)]);
  p.rPalmSide=(radial||ulnar||thumb)?lateral:flex?up:scale(up,-1);
  p.rThumbExtend=thumb?.12+.84*u:.14;
  p.rFingerSpread=thumb?.36:.12;
  p.rFingerCurl=flex?.24+.35*u:.17;
  if(iso){
    arm(p,"l",add(p.rw,[.011,.074+.021*u,.087]),[.70,-.49,.31]);
    p.lFingers=[-.524,-.19,.829];p.lPalmSide=[0,-1,0];
  }else arm(p,"l",add(p.chest,[.219,-.401,.048]),[.53,-.76,.09]);
  return marker(p);
}

const doorView=[117,15,[0,1.00,.13],2.34];
const sheetView=[45,16,[0,.94,.03],1.94];
const tableView=[87,2,[0,.47,.61],1.68];
const handView=[48,24,[-.153,.853,.481],.95];
const items=[
  ["3506",door,"frame-row","home-door-frame",["lat","biceps"],doorView],
  ["5557",door,"stretch","home-door-frame",["l:pec","l:shoulder"],[144,17,[.14,1.00,.32],2.23]],
  ["3749",door,"sheet-row","home-door-sheet",["lat","biceps"],doorView],
  ["3746",door,"sheet-delt","home-door-sheet",["rearShoulder","trap"],doorView],
  ["3748",freeSheet,"curl","sheet-free",["l:biceps","r:triceps"],sheetView],
  ["3745",freeSheet,"triceps","sheet-free",["l:triceps"],[123,17,[0,1.09,.04],2.20]],
  ["3744",freeSheet,"fly","sheet-free",["rearShoulder"],sheetView],
  ["8274",tableRow,"curl","home-table-row",["biceps"],tableView],
  ["3382",tableRow,"bent","home-table-row",["lat","biceps"],tableView],
  ["3381",tableRow,"straight","home-table-row",["lat","biceps"],tableView],
  ["4938",deskWrist,"radial","home-table-wrist",["r:forearm"],handView],
  ["2789",deskWrist,"ulnar","home-table-wrist",["r:forearm"],handView],
  ["2790",deskWrist,"extension","home-table-wrist",["r:forearm"],handView],
  ["2791",deskWrist,"flex","home-table-wrist",["r:forearm"],handView],
  ["9995",deskWrist,"iso","home-table-wrist",["r:forearm"],handView],
  ["10032",deskWrist,"thumb","home-table-wrist",["r:forearm"],[66,26,[-.180,.851,.583],.90]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,render,mode,prop,muscles,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view, camera={yaw,elevation,focus,height};
  const durationMs=mode==="stretch"?5210:render===deskWrist?4600:4820;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{mode})}));
  const recipe=id+".json", data={version:1,equipment:"spotter-"+prop,durationMs,muscles,camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.46});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
