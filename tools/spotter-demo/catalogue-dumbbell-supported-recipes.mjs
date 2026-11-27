import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, chestPress, cycle, foot, fromSupport, hipThrust, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const xAxis=[1,0,0], zAxis=[0,0,1], floor=.075;
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function hold(p,side,axis) {p[side+"Grip"]=axis;p.dumbbells.push({center:p[side+"w"],axis});}
function route(t,stops){
  const i=stops.findIndex(([end])=>t<=end);
  return i<=0?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function shared(p,goal,axis=xAxis){
  for(const [side,sign] of sides) {
    arm(p,side,add(goal,[sign*.076,0,0]),[sign*.73,-.66,.19]);
    p[side+"Grip"]=axis;
  }
  p.dumbbells.push({center:scale(add(p.lw,p.rw),.5),axis});
}

function resistance(t,{mode="press"}={}){
  if(mode==="press"){
    const p=chestPress(t,{setting:"flat",startLow:true});
    const [x,y,z]=p.chest;
    p.bandPath=[p.lw,add(p.lw,[.037,-.031,-.023]),[x+.181,y-.097,z+.032],
      [x,y-.118,z+.032],[x-.181,y-.097,z+.032],add(p.rw,[-.037,-.031,-.023]),p.rw];
    return p;
  }
  if(mode==="hip"){
    const p=hipThrust(t,{setting:"flat"});
    const l=blend(p.lh,p.lk,.75),r=blend(p.rh,p.rk,.75);
    p.bandPath=[add(l,[.064,.056,0]),add(l,[-.041,.071,0]),add(r,[.041,.071,0]),add(r,[-.064,.056,0]),
      add(r,[-.064,-.055,0]),add(l,[.064,-.055,0]),add(l,[.064,.056,0])];
    return p;
  }
  const u=cycle(t,.19,.81);
  const p=body([0,.886-.422*u,.008-.074*u],-.134+.119*u);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.198,floor,.538],[sign*.18,.07,.97]);
  shared(p,add(p.chest,[0,.107,.216]));
  if(mode==="wall"){
    const l=blend(p.lh,p.lk,.77),r=blend(p.rh,p.rk,.77);
    p.bandPath=[add(l,[.066,.055,.019]),add(r,[-.066,.055,.019]),add(r,[-.064,-.061,.026]),
      add(l,[.065,-.061,.026]),add(l,[.066,.055,.019])];
  }
  return p;
}

function benchDip(t,{elevate=false}={}){
  const u=cycle(t);
  const p=body([.1,.596-.293*u,1.554+.046*u],.048+.14*u);
  p.planted={};
  for(const [side,sign] of sides){
    foot(p,side,sign,[.1+sign*.134,elevate?.496:floor,elevate?2.364:2.065],
      [sign*.15,.79,.55],[sign*.018,-.070,.138]);
    p.planted[side]=elevate?.427:0;
    arm(p,side,[.10+sign*.173,.464,1.359],[sign*.35,.08,-.92]);
    p[side+"Fingers"]=[0,-.35,.94];p[side+"PalmSide"]=[0,1,0];
  }
  const thigh=blend(p.hips,scale(add(p.lk,p.rk),.5),.50);
  p.dumbbells.push({center:add(thigh,[0,.135,.024]),axis:xAxis});
  return p;
}

function bosuCurl(t){
  const p=body([0,.386,.155],-.210);
  p.planted={};
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.174,.311,.684],[sign*.10,.94,.12],[sign*.021,-.023,.139]);
    const a=.145+2.339*cycle(t);
    p[side+"e"]=add(p[side+"s"],[sign*.043,-.242,.039]);
    p[side+"w"]=add(p[side+"e"],[0,-.371*Math.cos(a),.371*Math.sin(a)]);
    hold(p,side,xAxis);
  }
  return p;
}

function ballArm(t,{mode="seated"}={}){
  if(mode==="seated"){
    const p=fromSupport("ball");
    for(const [side,sign] of sides){
      const armPath=route(t,[[0,[sign*.064,-.607,.025]],[.17,[sign*.054,.027,.229]],[.37,[sign*.061,.597,.018]],
        [.48,[sign*.059,.280,-.257]],[.61,[sign*.061,.597,.018]],[.81,[sign*.054,.027,.229]],[1,[sign*.064,-.607,.025]]]);
      arm(p,side,add(p[side+"s"],armPath),[sign*.57,-.54,-.24],zAxis);
    }
    return p;
  }
  const p=fromSupport("bridge");
  const bend=.08+2.012*cycle(t);
  p.le=add(p.ls,[.031,.249,.014]);
  p.lw=add(p.le,[0,.371*Math.cos(bend),-.371*Math.sin(bend)]);
  hold(p,"l",xAxis);
  inactive(p,"r",-1,"chest");
  return p;
}

function declineSit(t,{overhead=false,paired=false}={}){
  const rise=cycle(t);
  const p=body([0,.749,.235],-1.864+1.823*rise);
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.154,.548,.728],[sign*.134,.70,.316],[sign*.023,-.113,.126]);
  const target=overhead?add(p.chest,add(scale(p.up,.521),scale(p.front,.121))):add(p.chest,scale(p.front,.224));
  if(paired){
    for(const [side,sign] of sides)arm(p,side,add(target,[sign*.152,0,0]),[sign*.70,-.62,.33],zAxis);
  }else shared(p,target);
  return p;
}

function legLoaded(t,{decline=false,reverse=false,form="curl"}={}){
  const amount=cycle(t);
  const hipZ=decline?.212:reverse?1.365:1.197;
  const tilt=decline?1.835:Math.PI/2;
  const hY=decline?.841:reverse?.535:.560;
  const p=body([decline?0:.1,hY,hipZ],tilt,Math.PI);
  p.planted={};
  for(const [side,sign] of sides){
    const start=reverse?.446:decline?-.37:.135;
    const bend=start+(reverse?-.506:1.47)*amount;
    p[side+"k"]=add(p[side+"h"],[-sign*.021,reverse?-.405*Math.sin(bend):decline?-.123:-.045,.409*Math.cos(reverse?bend:0)]);
    const shin=reverse?-.405*Math.sin(bend):.416*Math.sin(bend);
    p[side+"a"]=add(p[side+"k"],[sign*.014,shin,.406*Math.cos(bend)]);
    p[side+"t"]=add(p[side+"a"],[sign*.039,-.090,.105]);
    const hand=add(p[side+"s"],[-sign*(form==="close"?.184:.233),decline?-.191:-.146,.083]);
    arm(p,side,hand,[-sign*.68,.22,-.51]);
    p[side+"Fingers"]=[sign*.762,-.36,.12];
    p[side+"PalmSide"]=[0,1,0];
  }
  const center=add(scale(add(p.lt,p.rt),.5),[0,.016,-.047]);
  p.dumbbells.push({center,axis:unit(add(scale(p.la,-1),p.lt))});
  return p;
}

function backExtension(t,{slow=false}={}){
  const amount=cycle(t,slow?.33:.43,.55);
  const p=body([0,.844,.101],.753+1.37*amount);
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.139,.247,-.579],[sign*.125,.23,.88],[sign*.015,-.063,.134]);
  shared(p,add(p.chest,add(scale(p.front,.213),[0,.044,0])));
  return p;
}

function rows(t,{mode="high",wide=false}={}){
  const u=cycle(t);
  const high=mode==="high";
  const low=mode==="low";
  const wall=mode==="wall";
  const rack=mode==="rack";
  const single=mode==="side"||rack||mode==="fly";
  const bench=mode==="incline"||low||high;
  const h=high?[.1,1.066,1.270]:rack?[.107,.832,-.403]:wall?[0,.848,-.308]:[.180,.808,.033];
  let p=bench&&!high?fromSupport(low?"incline30":"prone"):body(h,high?1.562:rack?1.05:wall?1.31:1.297,high?Math.PI:0);
  if(low){
    p=body([0,.532,.272],Math.PI/3,Math.PI);
    for(const [side,sign] of sides)foot(p,side,sign,[sign*.247,floor,.661],[sign*.15,.08,-.95]);
  }else if(!bench || high){
    for(const [side,sign] of sides)foot(p,side,sign,
      high?[.1+sign*.142,.937,1.881]:[p.hips[0]+sign*.148,floor,(wall?-.224:.118)+p.hips[2]*.38],
      [sign*.13,.14,high?-.91:.94],high?[sign*.023,-.110,-.08]:[sign*.023,-.073,.143]);
  }
  if(high)p.planted={};
  for(const [side,sign] of sides){
    const lateral=bench?-sign:sign;
    const s=p[side+"s"];
    if(single&&side==="r"){
      const support=rack?[-.50,1.108,.300]:[-.067,.464,.619];
      arm(p,side,support,[-.84,-.39,-.13]);
      p.rPalmSide=[0,1,0];
      continue;
    }
    const lower=[lateral*.058,-.591,.041];
    const top=mode==="fly"?[lateral*.590,.051,.041]:[lateral*(wide?.262:.078),-.139,bench?.346:-.329];
    arm(p,side,add(s,blend(lower,top,u)),[lateral*(wide?.86:.46),-.28,bench?.78:-.73],zAxis);
  }
  return p;
}

function supportedRow(t,{kick=false}={}){
  const u=cycle(t);
  const p=body([.025,.781,.786],1.68+.042*u);
  p.planted={l:.426,r:0};
  p.lk=[.124,.487,.826];p.la=[.135,.496,.474];p.lt=[.146,.445,.327];
  foot(p,"r",-1,[-.388,floor,.604],[-.28,.13,.84],[-.039,-.070,.133]);
  arm(p,"l",[.171,.453,1.248],[-.36,-.13,-.75]);
  p.lFingers=[-.12,-.33,.88];p.lPalmSide=[0,1,0];
  if(kick){
    p.re=add(p.rs,[-.025,.054,-.245]);
    const a=.072+1.43*u;
    p.rw=add(p.re,[0,-.371*Math.cos(a),-.371*Math.sin(a)]);
    hold(p,"r",[0,-Math.sin(a),Math.cos(a)]);
  }else arm(p,"r",add(p.rs,blend([-.068,-.601,.064],[-.060,-.137,-.358],u)),[-.63,.19,-.72],zAxis);
  return p;
}

function longBenchUpper(t,{form="side-row"}={}){
  const maltese=form==="maltese";
  const p=maltese?fromSupport("flat"):body([.08,.676,1.112],-Math.PI/2,0,Math.PI/2);
  const u=cycle(t,maltese?.22:.43,maltese?.83:.55);
  if(maltese){
    for(const [side,sign] of sides){
      const point=blend([sign*.026,.607,.057],[sign*.525,.056,.294],u);
      arm(p,side,add(p[side+"s"],point),[sign*.41,-.86,.19],[-1,0,0]);
    }
  }else{
    p.planted={};
    for(const [side,sign] of sides)foot(p,side,sign,[.08+sign*.044,.548+sign*.055,1.786],[.79,.22,.13],
      [.126,-.047,.063]);
    arm(p,"r",[.319,.387,.643],[.79,-.32,.28]);
    p.rPalmSide=[0,1,0];
    const low=form==="side-high"?[.326,-.337,.213]:[.264,-.109,.429];
    const top=form==="side-high"?[.185,.568,.117]:[.131,.591,.146];
    arm(p,"l",add(p.ls,blend(low,top,u)),[.82,-.42,.19],xAxis);
  }
  return p;
}

function preacher(t,{form="turned"}={}){
  const turn=form==="turned";
  const p=body([0,.552,-.091],.238,turn?.268:0);
  const u=cycle(t);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.254,floor,.245],[sign*.12,.10,.96]);
    if(side==="r"){inactive(p,side,sign,"thigh");continue;}
    const start=turn?.663:.757;
    const angle=start+(turn?2.01:1.49)*u;
    p.le=add(p.ls,[.023,-.175,.180]);
    p.lw=add(p.le,[.008,-.371*Math.cos(angle),.371*Math.sin(angle)]);
    hold(p,side,turn?xAxis:[-1,0,0]);
  }
  return p;
}

function highPull(t) {
  const load=cycle(t,.19,.28);
  const peak=cycle((t-.18)/.82,.33,.52);
  const p=body([0,.879-.142*load,.049-.142*load],.032+.338*load);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.156,floor,.093]);
    const e=blend([sign*.065,-.238,.045],[sign*.259,.116,.064],peak);
    const w=blend([sign*.069,-.590,.073],[sign*.139,-.045,.264],peak);
    arm(p,side,add(p[side+"s"],w),unit(e),xAxis);
  }
  return p;
}

const floorCam=[58,16,[0,.93,.05],2.16], flat=[62,20,[.10,.68,.98],1.82];
const declineView=[64,20,[0,.88,.13],2.16], highBench=[65,19,[.10,1.02,1.10],2.26];
const jobs=[];
function group(ids,motion,args,equipment,muscles,view=floorCam,durationMs=4200,posterAt=.47){
  for(const id of ids.split(" "))jobs.push({id,motion,args,equipment,muscles,view,durationMs,posterAt});
}
group("4184",resistance,{},"bench-band-dumbbells",["pec","triceps"],flat);
group("6735",resistance,{mode:"hip"},"bench-hip-band-dumbbell",["glute","hamstring"],[62,22,[.10,.52,1.54],1.87]);
group("6558",resistance,{mode:"wall"},"wall-band-dumbbell",["quad","glute"],[60,17,[0,.92,.15],2.19],5500);
group("7559",resistance,{mode:"goblet-wall"},"wall-dumbbell",["quad","glute"],[60,17,[0,.92,.15],2.16],5500);
group("4728",benchDip,{},"bench-dumbbell",["triceps"],[61,21,[.10,.54,1.65],1.70]);
group("4729",benchDip,{elevate:true},"wide-bench-dip-dumbbell",["triceps"],[65,21,[.10,.54,1.75],2.05]);
group("1656",bosuCurl,{},"bosu-seat-dumbbells",["biceps","core"],[56,20,[0,.59,.24],1.58]);
group("5239",ballArm,{},"stability-ball-dumbbells",["biceps","triceps"],[61,17,[0,.93,.12],2.20],5350);
group("1736",ballArm,{mode:"single-extend"},"stability-ball-dumbbell",["l:triceps"],[64,21,[0,.68,.08],1.91]);
group("4734",declineSit,{overhead:true,paired:true},"decline-bench-dumbbells",["core"],declineView,5100);
group("4735",declineSit,{},"decline-bench-dumbbell",["core"],declineView,4850);
group("5237",declineSit,{overhead:true},"decline-bench-dumbbell",["core"],declineView,5100);
group("4733",legLoaded,{decline:true},"decline-bench-dumbbell",["hamstring"],[114,21,[.04,.71,.28],1.82],4500);
group("0339",legLoaded,{},"bench-dumbbell",["hamstring"],[112,23,[.11,.73,1.00],1.87],4350);
group("4292",legLoaded,{form:"close"},"bench-dumbbell",["hamstring"],[108,21,[.10,.74,1.01],1.92],4450);
group("6161",legLoaded,{},"bench-dumbbell",["hamstring"],[113,20,[.10,.73,1.12],1.88],4450);
group("6145",legLoaded,{reverse:true},"bench-dumbbell",["glute","hamstring"],[104,21,[.10,.57,1.24],2.16],4700);
group("7328",backExtension,{},"extension-45-dumbbell",["glute","hamstring","core"],[62,20,[0,.75,.02],1.85]);
group("10977",backExtension,{slow:true},"extension-45-dumbbell",["glute","hamstring","core"],[65,19,[0,.75,.02],1.89],4950);
group("4741",rows,{mode:"low"},"incline-30-bench-dumbbells",["lat","biceps"],[118,18,[0,.72,.08],1.85]);
group("4744",rows,{mode:"incline"},"chest-bench-dumbbells",["lat","biceps"],[120,18,[0,.77,.08],1.89]);
group("4425",rows,{mode:"high"},"elevated-bench-dumbbells",["lat","biceps"],highBench);
group("4426",rows,{mode:"high",wide:true},"elevated-bench-dumbbells",["lat","trap"],[72,20,[.10,1.04,1.12],2.28]);
group("5697",rows,{mode:"high"},"elevated-bench-dumbbells",["lat","biceps"],[68,18,[.1,1.06,1.13],2.28]);
group("4239",rows,{mode:"fly"},"bench-dumbbell",["l:shoulder"],[61,17,[.10,.70,.30],1.88]);
group("1236",rows,{mode:"rack"},"raise-brace-dumbbell",["l:lat","l:biceps"],[62,17,[-.08,.79,-.10],2.08]);
group("7880",supportedRow,{kick:true},"bench-dumbbell",["r:triceps"],[-48,22,[.03,.56,.95],1.78]);
group("10329",supportedRow,{},"bench-dumbbell",["r:lat","r:biceps"],[-49,19,[.03,.61,.95],1.86]);
group("0341",longBenchUpper,{},"long-bench-dumbbell",["l:shoulder"],[64,20,[.10,.73,1.01],1.90]);
group("1048",longBenchUpper,{form:"side-high"},"long-bench-dumbbell",["l:shoulder"],[58,21,[.10,.73,1.01],1.93]);
group("1443",longBenchUpper,{form:"maltese"},"bench-dumbbells",["pec","shoulder"],[52,24,[.10,.67,1.03],1.88],5600);
group("5298",preacher,{},"preacher-bench-dumbbell",["l:biceps"],[59,18,[0,.73,.15],1.69]);
group("8613",preacher,{form:"reverse"},"preacher-bench-dumbbell",["l:biceps","l:forearm"],[55,19,[0,.73,.15],1.69]);
group("5666",highPull,{},"dumbbells",["trap","shoulder","glute"],[52,15,[0,.96,.05],2.21]);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(jobs.map(({id})=>id)).size!==jobs.length)throw new Error("Duplicate catalogue IDs.");
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
