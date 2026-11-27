import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, inactive, lunge, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";
import { pullUp } from "./bodyweight/apparatus.mjs";
import { pushUp } from "./bodyweight/floor.mjs";

const floor=.075, xAxis=[1,0,0], zAxis=[0,0,1];
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function route(t,stops){
  const i=stops.findIndex(([end])=>t<=end);
  return i<=0?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function plate(p,point,axis=zAxis){
  for(const [side,sign] of sides){
    arm(p,side,add(point,[sign*.081,.027,0]),[sign*.64,-.58,.35]);
    p[side+"Grip"]=[0,1,0];
  }
  p.dumbbells.push({center:scale(add(p.lw,p.rw),.5),axis});
}
function weights(p){p.dumbbells=[];return p;}

function chestCarry(t,{form="cossack"}={}){
  const low=form==="deficit";
  const hold=form==="front"||form==="cross";
  const duck=form==="duck";
  const lateral=form==="cossack";
  const half=t<.5?t*2:(t-.5)*2;
  const sign=t<.5?1:-1;
  const u=hold?cycle(t,.20,.82):duck?1:low?cycle(t):cycle(half);
  const hipHeight=hold?.878:duck?.514:low?.919-.394*u:.872-.382*u;
  const p=body([lateral?sign*.317*u:0,hipHeight,duck?.273*t:.039-.161*u],.035+(hold?0:.256*u));
  for(const [side,s] of sides){
    const travel=duck?((t+(s<0?.5:0))%1):0;
    const step=duck?(Math.sin(2*Math.PI*travel)*.208):0;
    const height=duck?(Math.max(0,Math.sin(2*Math.PI*travel))*.093):0;
    const ankle=[s*(lateral?.432:low?.163:.173),floor+(low?.026:height),.052+step+(duck?.273*t:0)];
    foot(p,side,s,ankle,[s*.14,.08,.96],[s*(lateral?.068:.018),-(floor+(low?.026:height))+.004,.135]);
    if(!hold)continue;
    const vector=form==="cross"?[s*.593*u,-.594*(1-u),.033+.105*(1-u)]:[s*.045,-.585*(1-u),.075+.529*u];
    arm(p,side,add(p[side+"s"],vector),[s*.59,-.58,-.21],[0,1,0]);
  }
  if(!hold)plate(p,add(p.chest,[0,.086,.232]));
  return p;
}

function kneelingSwing(t) {
  const u=cycle(t);
  const p=body([0,.514,.024+.105*u],.036+.062*u);
  delete p.planted.l;delete p.planted.r;
  for(const [side,sign] of sides){
    const active=side==="l";
    foot(p,side,sign,[sign*.152,active?.087+.047*Math.sin(Math.PI*u):.089,active?-.379+.829*u:-.407],
      [sign*.09,active?-.88+1.55*u:-.8,.61],[sign*.018,-.071,active?-.143+.28*u:-.142]);
    if(active&&u>.995)p.planted.l=0;
  }
  const a=.07+2.83*u;
  plate(p,add(p.chest,[0,.127-.589*Math.cos(a),.072+.485*Math.sin(a)]),[0,Math.sin(a),Math.cos(a)]);
  return p;
}

function loadedLunge(t,{sweep=false,plateSet=false}={}){
  const first=t<.5;
  const phase=first?t*2:(t-.5)*2;
  const u=cycle(phase);
  const p=lunge(t,{form:plateSet?"reverse":"plain"});
  if(plateSet){
    p.dumbbells=[];
    const hip=ramp(t,0,.20)*(1-ramp(t,.29,.42));
    const p0=body([0,.882-.072*hip,-.084*hip],.035+1.13*hip);
    if(t<.39){
      for(const [side,sign] of sides)foot(p0,side,sign,[sign*.141,floor,.089],[sign*.13,.08,.95]);
      plate(p0,add(p0.chest,[0,-.466,.149]));
      return p0;
    }
    const overhead=cycle((t-.34)/.66,.38,.59);
    plate(p,add(p.chest,[0,-.151+.817*overhead,.275-.168*overhead]));
    return p;
  }
  if(!sweep)return p;
  weights(p);
  for(const [side,sign] of sides){
    arm(p,side,add(p[side+"s"],blend([sign*.071,-.595,.048],[sign*.036,.303,.520],u)),[sign*.61,-.58,-.17],xAxis);
  }
  return p;
}

function weightedFloor(t,{form="side-crunch"}={}){
  const u=cycle(t);
  if(form==="plank-press"){
    const p=pushUp(t,{width:.26,deep:true});
    const spine=unit(add(p.neck,scale(p.hips,-1)));
    const normal=unit([0,spine[2],-spine[1]]);
    p.dumbbells=[{center:add(p.chest,scale(normal,.105)),axis:normal}];
    return p;
  }
  if(form==="drop"){
    const part=t<.5?t*2:(t-.5)*2;
    const first=t<.5;
    const p=pushUp(part,{width:first?.23:.37,deep:true});
    const flight=cycle((part-.60)/.4,.38,.58);
    const transition=ramp(part,.66,.95);
    const w=first?.23+.14*transition:.37-.14*transition;
    for(const [side,sign] of sides){
      arm(p,side,[sign*w,.063+.186*flight,.322+.131*transition],[sign*.77,-.25,-.55]);
      p[side+"Fingers"]=[.012,-.19,.98];p[side+"PalmSide"]=[0,1,0];
    }
    return p;
  }
  const sideAb= form==="hip-abduct";
  const p=body([0,.177,.259],-Math.PI/2+(sideAb?0:.548*u),0,Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides){
    const upper=side==="l";
    const goal=[.02+sign*.067,(upper?.161:.098)+(upper&&sideAb?.425*u:0),.259+(sideAb?.778:.504)];
    foot(p,side,sign,goal,[.63,.29,.19],[.130,-.018,.072]);
  }
  arm(p,"r",add(p.head,[-.054,-.057,.079]),[-.78,-.39,-.23]);
  if(sideAb){
    arm(p,"l",add(p.lh,[.116,.040,.146]),[.80,-.49,-.33]);
  }else{
    const target=add(p.chest,[.125,.157,.103]);
    arm(p,"l",target,[.56,-.36,.53]);
    p.dumbbells.push({center:add(p.lw,[-.030,.013,.006]),axis:zAxis});
  }
  return p;
}

function vibration(t,{form="stand"}={}){
  const use=cycle(t);
  const buzz=.005*Math.sin(2*Math.PI*11*t);
  if(form==="plank"){
    const p=body([0,.439+buzz,-.405],1.44);
    p.planted={};
    for(const [side,sign] of sides){
      foot(p,side,sign,[sign*.194,.091,-1.137],[sign*.16,.46,.03],[.013,-.083,.109]);
      p[side+"e"]=[sign*.174,.171,.242];
      p[side+"w"]=[sign*.161,.157,.545];
      p[side+"Fingers"]=[0,-.04,1];p[side+"PalmSide"]=[0,1,0];
    }
    return p;
  }
  if(form==="lunge"){
    const p=body([0,.881-.288*use,.115-.094*use],.039+.12*use);
    for(const [side,sign] of sides){
      const a=side==="l";
      const goal=[sign*.148,a?.210:.116,a?.316:-.407];
      foot(p,side,sign,goal,[sign*.11,.07,.96],[sign*.019,a?-.072:-.109,.143]);
      if(a)p.planted[side]=.135;
      inactive(p,side,sign);
    }
    return p;
  }
  const p=body([0,1.006+.044*cycle(t)+buzz,.307],.031+.021*cycle(t));
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.141,.210,.331]);
    p.planted[side]=.135;
    inactive(p,side,sign);
  }
  return p;
}

function dipTriple(t){
  const u=cycle(t);
  const p=body([0,.634-.322*u,.676+.098*u],.049+.168*u);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.137,.492,1.515],[sign*.11,.52,.76]);
    p.planted[side]=.427;
    arm(p,side,[sign*.338,.458,.528],[sign*.54,-.47,-.64]);
    p[side+"PalmSide"]=[0,1,0];p[side+"Fingers"]=[0,-.25,.97];
  }
  p.dumbbells.push({center:add(blend(p.hips,scale(add(p.lk,p.rk),.5),.35),[0,.126,.066]),axis:[0,1,0]});
  return p;
}

function hangingLeg(t) {
  const p=pullUp(t,{width:.194,raise:.008});
  const u=cycle(t);
  const shift=[0,.057*u,.033*u];
  p.hips=add(p.hips,shift);
  const angle=.035+1.534*u;
  for(const [side,sign] of sides){
    p[side+"h"]=add(p[side+"h"],shift);
    p[side+"k"]=add(p[side+"h"],[sign*.006,-.420*Math.cos(angle),.420*Math.sin(angle)]);
    p[side+"a"]=add(p[side+"k"],[-sign*.023,-.419*Math.cos(.33*u),-.419*Math.sin(.33*u)]);
    p[side+"t"]=add(p[side+"a"],[sign*.021,-.064,.138]);
  }
  const center=scale(add(p.la,p.ra),.5);
  p.dumbbells=[{center:add(center,[0,.014,.028]),axis:xAxis}];
  return p;
}

function muscleUp(t,{rings=false}={}){
  const rise=cycle(t,.53,.64);
  const transition=ramp(rise,.51,.79);
  const p=body([0,1.04+.952*rise,-.032+.274*transition],-.052+.32*transition);
  p.planted={};
  const startRadius=.819;
  p.straps=[];
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.132,.265+.97*rise,-.042+.197*transition],[sign*.15,.25,.93],[sign*.017,-.105,.103]);
    const gripX=sign*(rings?.234+.031*Math.sin(Math.PI*rise):.206);
    const gripZ=rings?.062 + .094*Math.sin(Math.PI*rise):.097;
    const anchor=[sign*.222,2.923,.038];
    const gripY=rings?anchor[1]-Math.sqrt(startRadius**2-(gripZ-anchor[2])**2-(gripX-anchor[0])**2):2.144;
    arm(p,side,[gripX,gripY,gripZ],[sign*.77,-.45,-.62+1.1*transition]);
    p[side+"Grip"]=rings?[0,0,1]:[sign,0,0];
    if(rings)p.straps.push({side,anchor,end:p[side+"w"],axis:[0,0,1]});
  }
  return p;
}

function benchStepPress(t){
  const first=t<.5, part=first?t*2:(t-.5)*2;
  const lead=first?"l":"r";
  const lift=ramp(part,0,.24)*(1-ramp(part,.74,1));
  const up=cycle(part,.45,.59);
  const p=body([.1,.878+.427*up-.107*lift*(1-up),.619+.464*up],.045+.212*lift*(1-up));
  for(const [side,sign] of sides){
    const angle=(side===lead?lift:ramp(part,.30,.49)*(1-ramp(part,.55,.75)));
    foot(p,side,sign,[.1+sign*.138,floor+.427*angle+.12*Math.sin(Math.PI*angle),.610+.458*angle]);
    if(angle>.995)p.planted[side]=.427;
    arm(p,side,add(p[side+"s"],[sign*.076,.066+.537*up,.164-.106*up]),[sign*.74,-.63,.28],zAxis);
  }
  return p;
}

function wallDonkey(t) {
  const u=cycle(t);
  const y=.294+.075+.095*u;
  const p=body([0,1.172+.094*u,.038],1.204);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.151,y,.111+.022*u],[sign*.10,.14,.98],[sign*.019,.299-y,.132-.022*u]);
    p.planted[side]=.294;
    arm(p,side,[sign*.415,1.361,.47],[sign*.74,-.35,.10]);
    p[side+"Grip"]=zAxis;
  }
  return p;
}

function tibialisPlate(t){
  const p=fromSupport("seat");
  weights(p);
  const u=cycle(t);
  p.la=[.259,.084,1.608];
  p.lt=add(p.la,[.018,-.064+.124*u,.149-.022*u]);
  p.dumbbells.push({center:add(p.lt,[0,.043,.025]),axis:unit([0,1,-.275+.98*u])});
  for(const [side,sign] of sides)inactive(p,side,sign,"thigh");
  return p;
}

function roundedSide(t,{ball=false,extension=false}={}){
  const u=cycle(t);
  const p=ball?body([0,.644,.028],.043):body([0,.830,.087],.624,0,Math.PI/2);
  p.planted={};
  const angle=.36*u;
  for(const part of ["chest","neck","head","ls","rs"]){
    const dx=p[part][0]-p.hips[0], dy=p[part][1]-p.hips[1];
    p[part][0]=p.hips[0]+dx*Math.cos(angle)+dy*Math.sin(angle);
    p[part][1]=p.hips[1]-dx*Math.sin(angle)+dy*Math.cos(angle);
  }
  if(ball){
    p.ballCenter=[0,.285,.010];
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.211,floor,.405]);
    arm(p,"l",add(p.ls,[.031,-.589,.062]),[.57,-.50,.21],zAxis);
    inactive(p,"r",-1,"thigh");
  }else{
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.109,.249,-.582],[.60,.21,.26]);
    plate(p,add(p.chest,[.111,.135,.135]));
  }
  return p;
}

function weightedSissy(t){
  const u=cycle(t);
  const y=floor+.084*u;
  const p=body([.497,.879-.225*u,.230-.138*u],-.049-.585*u);
  for(const [side,sign] of sides)foot(p,side,sign,[.497+sign*.136,y,.282+.034*u],[sign*.15,.13,.98],[sign*.02,.004-y,.140-.034*u]);
  arm(p,"r",[.154,1.245,.004],[-.76,-.31,-.20]);
  p.rPalmSide=[0,1,0];
  arm(p,"l",add(p.chest,[.045,.091,.201]),[.82,-.44,.17]);
  p.lPalmSide=[0,0,-1];
  p.dumbbells.push({center:add(p.lw,[-.032,.005,.009]),axis:zAxis});
  return p;
}

function handSqueeze(t) {
  const p=fromSupport("floor");
  const r=cycle(t,.23,.79);
  for(const [side,sign] of sides){
    arm(p,side,add(p[side+"s"],[-sign*.130*r,-.111,.586-.027*r]),[sign*.53,-.60,-.25],zAxis);
    p[side+"FingerCurl"]=.50+.50*r;
  }
  return p;
}

const standing=[58,16,[0,.94,.04],2.18], over=[56,16,[0,1.08,.05],2.39], mat=[65,24,[0,.42,-.18],1.71];
const jobs=[];
function group(id,motion,args,equipment,muscles,view=standing,durationMs=4300,posterAt=.47){jobs.push({id,motion,args,equipment,muscles,view,durationMs,posterAt});}
group("2717",chestCarry,{form:"cross"},"plates",["shoulder","forearm"],[26,17,[0,.94,.08],2.24],5400);
group("2718",chestCarry,{form:"front"},"plates",["shoulder","forearm"],standing,5400);
group("2711",chestCarry,{form:"duck"},"plate",["quad","glute","core"],[67,16,[0,.75,.22],1.93],5200);
group("3643",chestCarry,{},"plate",["quad","glute","adductor"],[27,17,[0,.92,.06],2.18],5300,.25);
group("7411",chestCarry,{form:"deficit"},"heel-step-plate",["quad","glute"],standing,4450);
group("3641",kneelingSwing,{},"mat-plate",["shoulder","core","quad"],[48,18,[0,.86,.14],2.04],5200);
group("3642",loadedLunge,{},"dumbbells",["quad","glute"],standing,5400,.25);
group("3644",loadedLunge,{sweep:true},"dumbbells",["quad","glute","shoulder"],standing,5600,.25);
group("10189",loadedLunge,{plateSet:true},"plate",["quad","glute","shoulder"],over,6300,.70);
group("1172",weightedFloor,{form:"plank-press"},"mat-plate",["pec","triceps","core"],mat);
group("1310",weightedFloor,{form:"drop"},"mat-weight-vest",["pec","triceps","core"],mat,5450,.24);
group("0837",weightedFloor,{form:"hip-abduct"},"mat-ankle-weight-left",["l:glute"],[64,23,[0,.41,.22],1.62]);
group("4158",weightedFloor,{},"mat-plate",["core"],[61,22,[0,.43,.23],1.63]);
group("2525",vibration,{},"weighted-vibration-station",["quad","core"],[56,20,[0,.93,.32],2.19]);
group("2526",vibration,{form:"plank"},"weighted-vibration-station",["core","shoulder"],[64,23,[0,.43,-.28],1.64]);
group("2527",vibration,{form:"lunge"},"weighted-vibration-station",["quad","glute"],[60,18,[0,.90,.10],2.20],5300,.25);
group("1754",dipTriple,{},"triple-dip-plate",["triceps"],[61,21,[0,.56,1.03],1.93]);
group("2987",pullUp,{width:.154,reverse:true},"weight-belt-cage-pull-up",["lat","biceps"],[48,15,[0,1.25,.04],2.70]);
group("2986",pullUp,{width:.193,neutral:true},"weight-belt-cage-neutral",["lat","biceps"],[50,15,[0,1.25,.04],2.70]);
group("0866",hangingLeg,{},"pull-up-dumbbell",["core","adductor"],[55,16,[0,1.22,.12],2.68]);
group("3312",muscleUp,{},"weight-belt-pull-up",["lat","pec","triceps"],[57,14,[0,1.48,.10],3.12],5200,.54);
group("3286",muscleUp,{rings:true},"weight-belt-rings",["lat","pec","triceps"],[50,14,[0,1.55,.07],3.30],5300,.54);
group("4185",benchStepPress,{},"bench-dumbbells",["quad","glute","shoulder"],[61,15,[.10,1.20,.92],2.75],6000,.25);
group("0833",wallDonkey,{},"weight-belt-calf-rail",["calf"],[57,19,[0,.91,.33],2.24]);
group("6559",tibialisPlate,{},"bench-plate",["l:shin"],[57,22,[.10,.62,1.45],1.57]);
group("0850",roundedSide,{ball:true},"stability-ball-dumbbell",["l:core"],[60,17,[0,.89,.10],2.06]);
group("10875",roundedSide,{},"extension-plate",["core"],[59,20,[0,.78,-.03],1.91]);
group("0851",weightedSissy,{},"upright-brace-plate",["quad"],[53,18,[.21,.86,.08],1.97]);
group("0854",handSqueeze,{},"dumbbells",["forearm"],[43,18,[0,.93,.17],2.09],4900);

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
