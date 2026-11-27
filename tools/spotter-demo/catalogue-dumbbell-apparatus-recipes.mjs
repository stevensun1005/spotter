import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, chestPress, cycle, foot, inactive, pullover, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, xAxis=[1,0,0], zAxis=[0,0,1];
const route=(t,stops)=>{const i=stops.findIndex(([at])=>t<=at);return i<=0?stops[0][1]:
  blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));};
function carry(p, mode="both") {
  for(const [side,sign] of sides){
    if(mode!=="both"&&mode!==side){inactive(p,side,sign);continue;}
    arm(p,side,add(p[side+"s"],[sign*.076,-.604,.040]),[sign*.51,-.44,-.28],zAxis);
  }
}
function held(p,point,axis=xAxis){
  for(const [side,sign] of sides){
    arm(p,side,add(point,[sign*.074,0,0]),[sign*.69,-.63,.30]);
    p[side+"Grip"]=axis;
  }
  p.dumbbells.push({center:scale(add(p.lw,p.rw),.5),axis});
}

function wallRow(t){
  const u=cycle(t);
  const p=body([0,.830,-.390],1.298);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.149,floor,-.377]);
    arm(p,side,add(p[side+"s"],blend([sign*.066,-.606,.025],[sign*.089,-.141,-.363],u)),[sign*.56,-.17,-.67],zAxis);
  }
  return p;
}

function supportedRdl(t,{support="hip"}={}){
  const u=cycle(t);
  const hip=support==="hip";
  const wall=support==="wall";
  const box=support==="box";
  const march=support==="march";
  const half=t<.5?t*2:(t-.5)*2;
  const pulse=march?cycle(half):u;
  const step=march?(t<.5?0:1):0;
  const advance=march?-.55+step*.58+.58*ramp(half,0,.62):0;
  const location=hip? .049-.111*u : .014-.203*pulse+advance;
  const p=body([0,.889-.081*pulse,location],.038+1.127*pulse);
  for(const [side,sign] of sides){
    const left=side==="l";
    const active=march?(step===0)===left:left;
    const footZ=hip?.109:active?.091+advance:box?-.536:advance-.035-.736*pulse;
    const footY=hip||active?floor:box?.267:.119+.528*pulse;
    foot(p,side,sign,[sign*.145,footY,footZ],[sign*.15,.132,.937],
      [sign*.019,active||hip?-.073:box?-.081:-.084,box&&!active?-.120:.145]);
    if(box&&!active)p.planted[side]=.184;
    if(!active&&!box&&!hip)delete p.planted[side];
    if(wall&&!left){
      arm(p,side,[-.516,1.071,-.018],[-.88,-.35,.24]);
      p.rPalmSide=[1,0,0];
      continue;
    }
    arm(p,side,add(p[side+"s"],[sign*.071,-.596,.042]),[sign*.52,-.27,-.51],zAxis);
  }
  return p;
}

function declineLunge(t){
  const u=cycle(t);
  const p=body([.035,.871-.303*u,.022+.064*u],.029+.122*u);
  foot(p,"l",1,[.174,floor,.491],[.13,.08,.98]);
  foot(p,"r",-1,[-.135,.786,-.662],[-.14,.07,.98],[-.018,-.055,-.124]);
  p.planted.r=.729;
  carry(p);
  return p;
}

function jefferson(t){
  const amount=cycle(t,.43,.61);
  const p=body([0,.994-.053*amount,.468-.111*amount],.044);
  const median=ramp(amount,.13,.85);
  const upper=ramp(amount,0,.71);
  const lower=ramp(amount,.32,1);
  const chestTwist=.10+1.48*lower;
  p.chest=add(p.hips,[0,.366*Math.cos(chestTwist),.366*Math.sin(chestTwist)]);
  const upperTwist=chestTwist+.785*upper+.061;
  p.neck=add(p.chest,[0,.233*Math.cos(upperTwist),.233*Math.sin(upperTwist)]);
  const headTwist=(47+129*median)*Math.PI/180;
  p.head=add(p.neck,[0,.119*Math.cos(headTwist),.119*Math.sin(headTwist)]);
  if(amount<.14) {
    const u=1-ramp(amount,0,.14);
    const natural=body(p.hips,.044);
    p.neck=blend(p.neck,natural.neck,u);
    p.head=blend(p.head,natural.head,u);
  }
  for(const [side,sign] of sides){
    p[side+"s"]=add(blend(p.chest,p.neck,.591),[sign*.194,-.014,.020]);
    foot(p,side,sign,[sign*.152,.193,.536],[sign*.15,.049,.97]);
    p.planted[side]=.118;
    arm(p,side,add(p[side+"s"],[sign*.088,-.600,.088]),[sign*.50,-.30,-.59],xAxis);
  }
  return p;
}

function braceRaise(t){
  const u=cycle(t);
  const base=body([-.157,.868,.095],.032);
  const p=body(base.hips,.032);
  const angle=-.292;
  for(const part of ["chest","neck","head","ls","rs"]){
    const dx=base[part][0]-base.hips[0], dy=base[part][1]-base.hips[1];
    p[part][0]=base.hips[0]+dx*Math.cos(angle)-dy*Math.sin(angle);
    p[part][1]=base.hips[1]+dx*Math.sin(angle)+dy*Math.cos(angle);
  }
  for(const [side,sign] of sides)foot(p,side,sign,[-.157+sign*.126,floor,.108]);
  arm(p,"r",[-.509,1.108,.271],[-.93,-.10,-.21]);
  p.rGrip=zAxis;
  const a=.035+1.55*u;
  arm(p,"l",add(p.ls,[.605*Math.sin(a),-.599*Math.cos(a),.056]),[.71,-.57,-.20],zAxis);
  return p;
}

function sideBoxStep(t){
  const first=t<.5;
  const half=first?t*2:(t-.5)*2;
  const dir=first?1:-1;
  const translate=route(half,[[0,[-.633]],[.32,[-.210]],[.53,[0]],[.73,[.393]],[1,[.633]]])[0];
  const lift=route(half,[[0,[0]],[.29,[.57]],[.52,[1]],[.71,[.58]],[1,[0]]])[0];
  const p=body([dir*translate,.877+.294*lift-.048*Math.sin(Math.PI*lift),.473],.036+.162*Math.sin(Math.PI*lift));
  for(const [side,sign] of sides){
    const lead=(sign===dir);
    const point=lead?route(half,[[0,[-.496,.075]],[.25,[.056,.369]],[.59,[.056,.369]],[.78,[.548,.075]],[1,[.757,.075]]])
      :route(half,[[0,[-.755,.075]],[.27,[-.537,.075]],[.51,[-.112,.369]],[.73,[-.112,.369]],[1,[.499,.075]]]);
    foot(p,side,sign,[dir*point[0],point[1],.484],[sign*.13,.15,.96]);
    if(point[1]>.369-.003)p.planted[side]=.294;
  }
  carry(p);
  return p;
}

function backStepLunge(t){
  const support=ramp(t,0,.16)*(1-ramp(t,.51,.65));
  const top=ramp(t,.15,.34)*(1-ramp(t,.41,.63));
  const lunge=cycle((t-.59)/.41,.43,.61);
  const p=body([0,.889+.294*top-.292*lunge,.076+.392*top-.076*lunge],.035+.191*(support-top)+.119*lunge);
  for(const [side,sign] of sides){
    const front=side==="l";
    const q=front?support:top*.63;
    const x=sign*.142;
    const y=floor+.294*q+.105*Math.sin(Math.PI*q)+(!front?.112*lunge:0);
    const z=.083+.461*q-(front?.589:0)*lunge;
    foot(p,side,sign,[x,y,z],[sign*.12,.13,.985]);
    if(q>.995)p.planted[side]=.294;
  }
  carry(p);
  return p;
}

function supportedSquat(t,{benches=false}={}){
  const u=cycle(t);
  const raised=benches?.427:0;
  const p=body([0,.880+raised-.402*u,.104-.217*u],.034+.203*u);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*(benches?.332:.126),floor+raised,benches?.14:.106],[sign*.17,.025,.99],
      [sign*.044,-.073,.130]);
    if(benches)p.planted[side]=raised;
  }
  const anchor=benches?add(p.hips,[0,-.245,.224]):add(p.chest,[0,.113,.231]);
  held(p,anchor,benches?[0,1,0]:xAxis);
  return p;
}

const standing=[60,16,[0,.92,.06],2.21], bench=[61,20,[.10,.69,1.01],1.90], step=[60,19,[0,1.05,.40],2.45];
const jobs=[];
function group(id,motion,args,equipment,muscles,view=standing,durationMs=4300,posterAt=.47){
  jobs.push({id,motion,args,equipment,muscles,view,durationMs,posterAt});
}
group("6146",wallRow,{},"front-wall-row-dumbbells",["lat","biceps"],[112,18,[0,.74,-.06],1.91]);
group("1551",declineLunge,{},"decline-split-bench-dumbbells",["l:quad","l:glute"],[63,18,[0,.90,-.02],2.23]);
group("11058",supportedRdl,{},"wall-dumbbells",["hamstring","glute"],[64,16,[0,.83,.08],2.13]);
group("7329",jefferson,{},"step-dumbbells",["hamstring","glute","core"],step,5600,.47);
group("3651",supportedRdl,{support:"march"},"dumbbells",["hamstring","glute"],[60,16,[0,.87,.10],2.44],6100,.25);
group("2415",braceRaise,{},"raise-brace-dumbbell",["l:shoulder"],[28,15,[-.05,.94,.12],2.17]);
group("2806",supportedRdl,{support:"box"},"split-rear-step-dumbbells",["l:hamstring","l:glute"],[62,17,[0,.86,-.04],2.14]);
group("2750",supportedRdl,{support:"wall"},"calf-wall-dumbbell",["l:hamstring","l:glute"],[66,16,[-.09,.87,-.12],2.28]);
group("9612",sideBoxStep,{},"wide-step-dumbbells",["quad","glute"],[45,17,[0,1.03,.48],2.39],6400,.25);
group("2795",backStepLunge,{},"wide-step-dumbbells",["l:quad","l:glute"],step,6100,.34);
group("3188",pullover,{setting:"flat",form:"straight"},"bench-hanging-band-dumbbell",["lat","pec"],bench,5300);
group("2431",supportedSquat,{benches:true},"side-bench-pair-dumbbell",["quad","glute","adductor"],[60,19,[0,1.04,.15],2.43],4800);
group("2803",supportedSquat,{},"supported-squat-dumbbell",["quad","glute"],[62,15,[0,.92,.13],2.16]);
group("4200",chestPress,{setting:"flat",form:"fly"},"bench-chain-fly-dumbbells",["pec","shoulder"],bench,4800);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const selected=wanted.length?jobs.filter(({id})=>wanted.includes(id)):jobs;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const {id,motion,args,equipment,muscles,view,durationMs,posterAt} of selected){
  const [yaw,elevation,focus,height]=view;
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
