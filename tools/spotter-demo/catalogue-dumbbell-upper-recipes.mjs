import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, chestPress, cycle, foot, fromSupport, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";
const ground=.075;
const x=[1,0,0], z=[0,0,1];
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function timing(t,stops){
  const i=stops.findIndex(([stop])=>stop>=t);
  return i<1?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function bell(p,side,axis) {
  p[side+"Grip"]=axis;
  p.dumbbells.push({center:p[side+"w"],axis});
}

function fittedPress(t,{setting="incline30",form="reverse"}={}){
  const p=fromSupport(setting);
  const fly=["hold-fly","low-fly","high-fly"].includes(form);
  const squeeze=form==="squeeze"||form==="close";
  const short=form==="scapular";
  const curl= form==="curl";
  const seatedShoulder=form==="shoulder";
  const u=form==="hold-fly"?cycle(t,.18,.84):cycle(t);
  for(const [side,sign] of sides){
    const s=p[side+"s"];
    if(curl){
      const angle=.10+2.43*u;
      p[side+"e"]=add(s,[sign*.078,-.232,-.042]);
      p[side+"w"]=add(p[side+"e"],[sign*.029,-.369*Math.cos(angle),.369*Math.sin(angle)]);
      bell(p,side,x);
    }else if(short){
      const moved=add(s,[-sign*.012*u,.072*u,.049*u]);
      p[side+"s"]=moved;
      const line=unit([sign*.048,.96,.224]);
      p[side+"e"]=add(moved,scale(line,.25));
      p[side+"w"]=add(moved,scale(line,.612));
      bell(p,side,x);
    }else if(fly){
      const arc=(Math.PI/2)*u;
      const point=form==="high-fly"
        ? timing(u,[[0,[sign*.251,-.278,.366]],[.48,[sign*.526,.051,.233]],[1,[-sign*.076,.562,.101]]])
        : [sign*(-.081+.664*Math.sin(arc)),.069+.51*Math.cos(arc),form==="low-fly"?.169:.074];
      arm(p,side,add(s,point),[sign*.233,-.84,.29],form==="high-fly"?blend(z,x,u):z);
    }else {
      const top=seatedShoulder?[sign*.066,.601,.021]:[sign*(squeeze?-.111:.028),.567,.159];
      const bottom=seatedShoulder?[sign*.132,.052,.169]:[sign*(squeeze?-.111:.194),.205,.205];
      const depth=form==="reverse"||seatedShoulder?1-u:u;
      const pole=[sign*(squeeze?.38:.82),-.68,.38];
      arm(p,side,add(s,blend(top,bottom,depth)),pole,form==="reverse"?[-1,0,0]:squeeze?z:x);
    }
  }
  return p;
}

function overheadPress(t,{mode="alternate"}={}){
  const seated=mode==="prone";
  const brace=mode==="brace";
  const upperBack=mode==="extend";
  const u=cycle(t);
  let p=seated?fromSupport("prone"):fromSupport("floor");
  if(brace){
    p=body([.543,.886,.269],.032);
    for(const [side,sign] of sides)foot(p,side,sign,[.543+sign*.144,ground,.314]);
  }
  if(upperBack){
    const s=fromSupport("floor");
    p=body(s.hips,-.128*u);
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.145,ground,.064]);
  }
  for(const [side,sign] of sides){
    if(brace&&side==="r"){
      arm(p,side,[.154,1.245,.004],[-.76,-.31,-.20]);
      p.rPalmSide=[0,1,0];
      continue;
    }
    const amount=mode==="alternate"?cycle(side==="l"?t*2:(t-.5)*2):u;
    const lateral=seated?-sign:sign;
    const s=p[side+"s"];
    const base=[lateral*.111,.078,seated?-.172:.157];
    const end=[lateral*.080,.590,seated?-.193:.027];
    arm(p,side,add(s,blend(base,end,amount)),[lateral*.80,-.32,seated?-.23:.22],seated?x:z);
  }
  return p;
}

function benchSide(t,{setting="flat",mode="press"}={}){
  const incline=setting==="incline30";
  const p=body(incline?[0,.658,.265]:[.080,.674,1.129],incline?-Math.PI/3:-Math.PI/2,0,Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides) {
    const feet=incline?[sign*.061,.080+Math.max(0,sign)*.028,.729]:[.08+.048*sign,.547+sign*.056,1.78];
    foot(p,side,sign,feet,[.82,.27,.01],[.126,-.048,.066]);
  }
  arm(p,"r",incline?[-.141,.801,-.086]:add(p.head,[-.071,-.041,.085]),[-.78,-.36,-.22]);
  p.rPalmSide=[0,1,0];
  const amount=cycle(t);
  const s=p.ls;
  if(mode==="press"){
    arm(p,"l",add(s,blend([.082,.135,.205],[.034,.610,.026],amount)),[.60,-.26,.81],x);
  }else{
    const point=mode==="powell"?timing(amount,[[0,[.228,-.373,.315]],[.48,[.512,.002,.295]],[1,[.162,.102,.561]]])
      :blend([.166,-.160,.533],[.096,.552,.116],amount);
    arm(p,"l",add(s,point),[.82,-.36,.14],z);
  }
  return p;
}

function larsen(t) {
  const p=chestPress(t,{setting:"flat"});
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,[.1+sign*.162,.439,2.087],[sign*.27,.23,.89],[sign*.016,.068,.126]);
  return p;
}

function elbowTate(t,{under=false}={}){
  const p=fromSupport(under?"flat":"seat",under?{point:[.1,.550,1.101]}:{});
  const front=!under&&t<.5;
  const time=under?t:front?t*2:(t-.5)*2;
  const amount=cycle(time,.40,.58);
  for(const [side,sign] of sides){
    const s=p[side+"s"];
    const elbow=add(s,[sign*(under?.028:.089),.242,under?-.058:.017]);
    p[side+"e"]=elbow;
    const angle=(.04+1.78*amount)*(front?1:-1);
    p[side+"w"]=add(elbow,[-sign*.036,.368*Math.cos(angle),.368*Math.sin(angle)]);
    bell(p,side,x);
  }
  return p;
}

function adductorCross(t) {
  const amount=cycle(t);
  const p=body([0,.880-.311*amount,.026-.182*amount],.042+.24*amount);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.170,ground,.084]);
    const start=[sign*.606,-.006,.055];
    const tucked=[-sign*.106,.041,.606];
    arm(p,side,add(p[side+"s"],blend(start,tucked,amount)),[sign*.76,-.38,-.21],blend(z,x,amount));
  }
  return p;
}

function shoulderSculpt(t,{mode="steady"}={}){
  const leaning=mode==="lead";
  const amount=cycle(t,.35,.62);
  const tTop=mode==="turn"?ramp(t,.36,.50)*(1-ramp(t,.55,.65)):0;
  const arc=(mode==="upper"?87+76*amount:7+82*amount)*Math.PI/180;
  const p=leaning?body([0,.881,-.029],.157):fromSupport("floor");
  for(const [side,sign] of sides){
    if(leaning)foot(p,side,sign,[sign*.145,ground,.062]);
    const target=[sign*(mode==="lead"?.486:.598)*Math.sin(arc),-.588*Math.cos(arc),
      mode==="lead"?.114+.102*(1-amount):.046];
    const grip=mode==="turn"?[0,Math.sin(Math.PI*tTop),Math.cos(Math.PI*tTop)]:z;
    arm(p,side,add(p[side+"s"],target),[sign*.74,-.59,.223],grip);
  }
  return p;
}

function shoulderCircuit(t){
  const p=fromSupport("floor");
  for(const [side,sign] of sides){
    const down=[sign*.060,-.601,.038];
    const lateral=[sign*.599,-.008,.052];
    const front=[sign*.044,.025,.593];
    const rack=[sign*.068,.075,.198];
    const overhead=[sign*.078,.595,.034];
    const step=timing(t,[[0,down],[.17,lateral],[.29,down],[.46,front],[.62,rack],[.83,overhead],[.92,rack],[1,down]]);
    arm(p,side,add(p[side+"s"],step),[sign*.63,-.58,-.20],z);
  }
  return p;
}

function scapularShrug(t) {
  const p=fromSupport("floor");
  const rise=.115*cycle(t,.36,.61);
  inactive(p,"r",-1);
  p.ls=add(p.ls,[-.016*rise/.115,rise,-.009]);
  arm(p,"l",add(p.ls,[.066,-.608,.021]),[.50,-.37,-.15],z);
  return p;
}

function spiderStanding(t){
  const p=body([.095,.841,-.509],.903);
  for (const [side,sign] of sides)foot(p,side,sign,[.095+sign*.147,ground,-.414]);
  arm(p,"r",[-.104,.906,.018],[-.69,-.49,-.19]);
  p.rPalmSide=[0,1,0];
  const angle=.12+2.31*cycle(t);
  p.le=add(p.ls,[.084,-.233,-.048]);
  p.lw=add(p.le,[.003,-.370*Math.cos(angle),.370*Math.sin(angle)]);
  bell(p,"l",x);
  return p;
}

const stand=[54,15,[0,.99,.03],2.29];
const low=[62,18,[0,.73,.06],1.86];
const high=[60,16,[0,.92,.12],2.08];
const artwork=[];
function group(ids,motion,args,equipment,muscles,camera=stand,durationMs=4050,posterAt=.47){
  for(const id of ids.split(" "))artwork.push({id,motion,args,equipment,muscles,camera,durationMs,posterAt});
}
group("0286",overheadPress,{},"dumbbells",["shoulder","triceps"],stand,5650,.24);
group("4125",overheadPress,{mode:"prone"},"chest-bench-dumbbells",["shoulder","triceps"],[113,18,[0,.81,.12],1.99]);
group("0424",overheadPress,{mode:"brace"},"upright-bench-dumbbell",["l:shoulder","l:triceps"],[51,17,[.24,1.02,.17],2.33]);
group("6964",overheadPress,{mode:"extend"},"dumbbells",["shoulder","triceps"],stand);
group("1449",fittedPress,{form:"hold-fly"},"incline-30-bench-dumbbells",["pec","shoulder"],low,5800,.49);
group("1214",fittedPress,{},"incline-30-bench-dumbbells",["pec","triceps"],low);
group("4973",fittedPress,{setting:"incline70",form:"curl"},"incline-70-bench-dumbbells",["biceps"],high);
group("4015",fittedPress,{setting:"incline",form:"close"},"incline-bench-dumbbells",["pec","triceps"],[58,18,[0,.82,.10],1.94]);
group("6162",fittedPress,{form:"low-fly"},"incline-30-bench-dumbbells",["pec","shoulder"],low,4300);
group("0328",fittedPress,{setting:"incline",form:"scapular"},"incline-bench-dumbbells",["shoulder","pec"],[51,20,[0,.80,.10],1.79]);
group("5261",fittedPress,{setting:"incline70",form:"shoulder"},"incline-70-bench-dumbbells",["shoulder","triceps"],[60,15,[0,1.01,.12],2.20]);
group("5067",fittedPress,{form:"squeeze"},"incline-30-bench-dumbbells",["pec","triceps"],low);
group("3234",fittedPress,{setting:"incline",form:"high-fly"},"incline-bench-dumbbells",["pec","shoulder"],[51,19,[0,.81,.10],1.94]);
group("0323",benchSide,{setting:"incline30",mode:"raise"},"incline-30-bench-dumbbell",["l:shoulder"],[64,22,[0,.80,.10],1.89]);
group("5816",benchSide,{},"long-bench-dumbbell",["l:pec","l:triceps"],[54,19,[.1,.73,1.02],1.92]);
group("10330",benchSide,{mode:"powell"},"long-bench-dumbbell",["l:shoulder","l:trap"],[64,23,[.1,.63,1.04],1.80]);
group("6272",larsen,{},"long-bench-dumbbells",["pec","triceps"],[65,19,[.10,.69,1.13],1.96]);
group("4157",elbowTate,{},"bench-dumbbells",["triceps"],[59,16,[.10,.93,1.20],2.13],5500,.29);
group("1191",elbowTate,{under:true},"bench-dumbbells",["triceps"],[59,18,[.10,.69,.83],1.72]);
group("0332",adductorCross,{},"dumbbells",["quad","glute","shoulder"],[35,14,[0,.89,.13],2.13],4500,.47);
group("10858",shoulderSculpt,{},"dumbbells",["shoulder"],[29,16,[0,.92,.02],2.11],4500);
group("3879",shoulderSculpt,{mode:"lead"},"dumbbells",["shoulder"],[42,14,[0,.89,.11],2.10],4300);
group("10949",shoulderSculpt,{mode:"upper"},"dumbbells",["biceps","shoulder"],stand,4500);
group("3825",shoulderSculpt,{mode:"turn"},"dumbbells",["shoulder","forearm"],[34,17,[0,.92,.02],2.09],5200);
group("10196",shoulderCircuit,{},"dumbbells",["shoulder","triceps"],[42,16,[0,1.00,.068],2.33],6450,.46);
group("6123",scapularShrug,{},"dumbbell",["l:trap"],[58,16,[0,.95,.05],2.03]);
group("4017",spiderStanding,{},"incline-bench-dumbbell",["l:biceps"],[60,18,[0,.89,-.18],2.10]);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(artwork.map(({id})=>id)).size!==artwork.length)throw new Error("Duplicate catalogue IDs.");
const selected=wanted.length?artwork.filter(({id})=>wanted.includes(id)):artwork;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const {id,motion,args,equipment,muscles,camera,durationMs,posterAt} of selected){
  const [yaw,elevation,focus,height]=camera;
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
