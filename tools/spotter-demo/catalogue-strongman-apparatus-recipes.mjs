import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, xAxis=[1,0,0], up=[0,1,0], forward=[0,0,1];
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function route(t,stages){
  const i=stages.findIndex(([t0])=>t<=t0);
  return i<1?stages[0][1]:blend(stages[i-1][1],stages[i][1],ramp(t,stages[i-1][0],stages[i][0]));
}
function palm(p,side,point,pole,grip){
  arm(p,side,point,pole);
  p[side+"Grip"]=grip;
  p[side+"PalmSide"]=[0,1,0];
}
function poleBoth(p,base,axis,{reach=.092,offset=0}={}){
  for(const [side,sign] of sides)palm(p,side,add(base,scale(axis,sign*reach)),[sign*.74,-.58,.29],axis);
  p.handRoller={center:add(scale(add(p.lw,p.rw),.5),scale(axis,offset)),axis};
  return p;
}

function mace(t,{squat=false}={}){
  const u=cycle(t);
  const p=body([0,.880-(squat?.331:0)*u,.021-(squat?.190:0)*u],.039+(squat?.202:0)*u);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.160,floor,.073],[sign*.16,.082,.98]);
  if(squat){
    return poleBoth(p,add(p.neck,[0,-.043,-.119]),xAxis,{reach:.194,offset:.087});
  }
  const angle=2*Math.PI*t;
  const base=add(p.chest,[.216*Math.sin(angle),.072+.148*(1-Math.cos(angle)),.242+.080*(1-Math.cos(angle))]);
  const axis=unit([.621*Math.sin(angle),.49+.51*Math.cos(angle),-.681*(1-Math.cos(angle))]);
  return poleBoth(p,base,axis,{offset:.096});
}

function strikingTire(t){
  const load=cycle(t,.22,.38);
  const hit=cycle((t-.32)/.68,.37,.56);
  const p=body([-.074,.870-.210*hit,-.291+.103*hit],.039+.437*hit,-.456+.941*load);
  foot(p,"l",1,[.182,floor,.066],[.18,.073,.99]);
  foot(p,"r",-1,[-.195,.115,-.476],[-.13,.08,.96],[-.024,-.113,.130]);
  const grab=route(t,[[0,[.195,.766,.164]],[.23,[-.191,1.687,.105]],[.37,[-.209,1.795,.047]],
    [.56,[.022,.753,.418]],[.64,[.022,.795,.425]],[1,[.195,.766,.164]]]);
  const axis=route(t,[[0,[0,.301,.956]],[.29,[-.02,.571,-.821]],[.36,[.25,.887,-.390]],
    [.56,[.067,-.879,.475]],[.64,[.055,-.722,.691]],[1,[0,.301,.956]]]);
  return poleBoth(p,grab,unit(axis),{reach:.103,offset:.156});
}

function bendStick(t){
  const balance=.694*Math.sin(2*Math.PI*t);
  const p=body([0,.881,.017],.036);
  for(const key of ["chest","neck","head","ls","rs"]){
    const x=p[key][0]-p.hips[0], y=p[key][1]-p.hips[1];
    p[key][0]=p.hips[0]+x*Math.cos(balance)-y*Math.sin(balance);
    p[key][1]=p.hips[1]+x*Math.sin(balance)+y*Math.cos(balance);
  }
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.147,floor,.061],[sign*.13,.072,.96]);
  const axis=[Math.cos(balance),Math.sin(balance),0];
  const long=[-Math.sin(balance),Math.cos(balance),0];
  return poleBoth(p,add(p.neck,add(scale(long,.455),[0,.019,.071])),axis,{reach:.243});
}

function pairedStick(t,{wrestle=false}={}){
  const force=cycle(t,.24,.72);
  const level=wrestle?.167:.515;
  const a=body([0,level,-.687-(wrestle?.064:0)*force],wrestle?-.355-.129*force:.044);
  const b=body([0,level,.687-(wrestle?.064:0)*force],wrestle?-.334+.192*force:.044,Math.PI);
  for(const [i,p] of [a,b].entries())for(const [side,sign] of sides){
    const d=i===0?1:-1;
    const front=side==="l";
    const point=wrestle?[sign*.212,.102,-d*.114]:
      [sign*.155,front?floor:.088,i===0?(front?-.267:-1.034):(front?.267:1.034)];
    if(wrestle||!front)delete p.planted[side];
    foot(p,side,sign,point,[sign*.31,wrestle?.85:front?.66:-.83,d*.36],[sign*.018,wrestle?.116:-.072,d*.117]);
  }
  const pivot=wrestle?[0,.489,-.054*force]:[0,.763-.023*force,0];
  const axis=wrestle?xAxis:unit([.034,.086,.996]);
  for(const [i,p] of [a,b].entries())for(const [side,sign] of sides){
    const separation=wrestle?[sign*(i===0?.176:.099),0,(i===0?-1:1)*.027]:
      [sign*.043,(i===0?0:.035),(i===0?-1:1)*(.155+sign*.081)];
    palm(p,side,add(pivot,separation),[sign*.67,-.43,i===0?-.48:.48],axis);
  }
  a.handRoller={center:pivot,axis};
  a.partner=b;
  return a;
}

function heavyLift(t,{mode="atlas"}={}){
  const atlas=mode==="atlas", log=mode==="log";
  const down=atlas||log?route(t,[[0,[1]],[.16,[.80]],[.28,[.43]],[.55,[0]],[.71,[0]],[1,[1]]])[0]:.137*cycle(t/.38);
  const drive=cycle((t-.33)/.67,.35,.63);
  const travel=atlas?cycle(t,.35,.66)*.236:0;
  const p=body([0,.881-(atlas||log?.354:.0)*down-(atlas||log?0:down),.038-.148*down+travel],.039+1.022*down);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.184,floor,.088+.43*travel],[sign*.20,.051,.95]);
  const center=atlas?route(t,[[0,[0,.170,.221]],[.20,[0,.602,.263]],[.37,[0,.897,.324]],
    [.58,[0,1.005,.650]],[.69,[0,1.005,.650]],[1,[0,.170,.221]]]):
    log?route(t,[[0,[0,.204,.217]],[.18,[0,.632,.285]],[.35,[0,1.306,.235]],[.47,[0,1.365,.146]],
      [.61,[0,1.923,.102]],[.68,[0,1.916,.105]],[.81,[0,1.339,.156]],[1,[0,.204,.217]]]):
        add(p.chest,[0,.097+.56*drive,.243-.167*drive]);
  for(const [side,sign] of sides){
    palm(p,side,add(center,[sign*(log?.205:atlas?.152:.131),-.021,-.038]),[sign*.69,-.39,.39],log?forward:up);
    p[side+"Fingers"]=[-sign*.42,.111,.899];
  }
  if(atlas)p.ballCenter=t>.53&&t<.71?center:add(scale(add(p.lw,p.rw),.5),[0,.044,.054]);
  return p;
}

function overheadProjectile(t,{single=false}={}){
  const dip=route(t,[[0,[.90]],[.18,[1]],[.40,[0]],[.58,[0]],[1,[0]]])[0];
  const rise=ramp(t,.18,.47);
  const p=body([0,.879-.312*dip,-.045-.16*dip],.035+.925*dip);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.194,floor,.069],[sign*.16,.12,.96]);
  const hand=route(t,[[0,[single?.119:0,.189,.155]],[.19,[single?.099:0,.261,-.364]],
    [.40,[single?.174:0,1.473,.372]],[.51,[single?.172:0,1.953,.083]],[.61,[single?.151:0,2.041,-.092]],
    [1,[single?.151:0,1.061,.109]]]);
  for(const [side,sign] of sides){
    if(single&&side==="r"){inactive(p,side,sign);continue;}
    palm(p,side,add(hand,[single?.020:sign*.090,0,0]),[sign*.72,-.46,.26],single?xAxis:up);
  }
  const center=single?add(p.lw,[0,-.077,.005]):scale(add(p.lw,p.rw),.5);
  const launch=t>.53;
  const flight=(t-.53)/.47;
  const start=[single?.163:0,1.997,-.016];
  const apex=Math.sin(Math.PI*Math.min(1,Math.max(0,flight)));
  p.ballCenter=launch?add(blend(start,[single?.188:0,.198,-1.475],flight),[0,1.76*apex,0]):center;
  p.machineTravel=launch?rise+flight*5.82:rise;
  return p;
}

function fingerPost(t){
  const angle=route(t,[[0,[.020]],[.26,[.318]],[.46,[.751]],[.64,[1.434]],[.81,[2.965]],[1,[3.13]]])[0];
  const progress=ramp(t,.26,.75);
  const lift=ramp(t,.06,.42);
  const p=body([0,.496+.405*lift,-2.04+1.724*progress],.788-.733*lift);
  p.machineTravel=angle;
  for(const [side,sign] of sides){
    const alternate=cycle((t+.12*sign-.22)/.54);
    foot(p,side,sign,[sign*.143,floor+.12*alternate,p.hips[2]+sign*.16*alternate+.226],
      [sign*.11,.15,.93]);
    const gripRadius=1.831-.282*progress-.129*alternate;
    const hand=[sign*.086,.090+Math.sin(angle)*gripRadius,-Math.cos(angle)*gripRadius+.047];
    const relaxed=add(p[side+"s"],[sign*.084,-.579,.051]);
    palm(p,side,blend(hand,relaxed,ramp(t,.68,.78)),[sign*.72,-.41,.26],xAxis);
  }
  return p;
}

function crossHold(t,{tower=false}={}){
  const amount=cycle(t,.16,.86);
  const p=body([0,.882+.011*amount,.018],.029);
  p.machineTravel=.125*amount;
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.147,floor,.065],[sign*.14,.03,.98]);
    const contact=tower?[sign*(.669+.07*amount),1.362-.016*amount,.050]:
      add(p[side+"s"],blend([sign*.071,-.603,.047],[sign*.591,-.021,.079],amount));
    palm(p,side,contact,[sign*.65,-.48,.31],up);
  }
  return p;
}

function walkLoad(t,{timber=false}={}){
  const take=route(t,[[0,[0]],[.18,[1]],[.79,[1]],[1,[0]]])[0];
  const distance=1.098*ramp(t,.18,.81);
  const p=body([0,.875-(timber?.311:.09)*(1-take),.041+distance],.036+(timber?.778:.147)*(1-take));
  for(const [side,sign] of sides){
    const q=(2.4*t+(side==="l"?.50:0))%1;
    const stride=(q<.60?.50-q/.60:(q-.60)/.40-.50)*.407;
    const lift=q<.60?0:.125*Math.sin(Math.PI*(q-.60)/.40);
    foot(p,side,sign,[sign*.131,floor+lift* take,.083+distance+stride*take],[sign*.14,.11,.97]);
    const point=timber?[sign*.378,.181+.379*take,.058+distance]:add(p.chest,[sign*.119,.036,.216]);
    palm(p,side,point,[sign*.68,-.46,-.32],timber?forward:up);
  }
  return p;
}

function vikingPress(t){
  const u=cycle(t);
  const p=body([0,.881,.027],.025);
  const angle=.027+.721*u;
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.148,floor,.062],[sign*.12,.14,.98]);
    palm(p,side,[sign*.324,1.382+.702*Math.sin(angle),.688-.702*Math.cos(angle)],[sign*.71,-.45,-.23],forward);
  }
  return p;
}

const standing=[56,17,[0,.99,.08],2.31];
const items=[
  ["10411",mace,{},"mace",["shoulder","core"],[49,17,[0,1.05,.09],2.32],5300,.39],
  ["10410",mace,{squat:true},"mace",["quad","glute"],[55,16,[0,.96,-.02],2.28],4300,.47],
  ["1496",strikingTire,{},"sledge-training",["core","shoulder","lat"],[62,17,[0,1.02,.22],2.65],5250,.55],
  ["5405",bendStick,{},"training-stick",["core","shoulder"],[22,15,[0,1.05,.04],2.45],5700,.24],
  ["5399",pairedStick,{},"training-stick",["core"],[72,20,[0,.70,0],2.48],5000,.47],
  ["2708",pairedStick,{wrestle:true},"mas-board",["lat","core","forearm"],[77,24,[0,.56,0],2.13],5200,.47],
  ["2724",heavyLift,{},"atlas",["quad","glute","biceps"],[60,18,[0,.91,.40],2.25],6400,.44],
  ["2707",heavyLift,{mode:"log"},"log",["quad","glute","shoulder"],[53,17,[0,1.04,.07],2.53],6400,.62],
  ["2713",heavyLift,{mode:"iron"},"iron",["shoulder","triceps"],[55,17,[0,1.06,.07],2.42],4700,.47],
  ["3307",overheadProjectile,{},"keg",["quad","glute","shoulder"],[64,14,[0,1.43,-.47],3.35],6350,.49],
  ["2731",overheadProjectile,{single:true},"height-weight",["l:shoulder","glute","core"],[66,15,[0,1.47,-.47],3.47],6350,.51],
  ["3306",fingerPost,{},"fingal",["quad","glute","shoulder"],[65,18,[0,1.15,-.80],2.77],6500,.49],
  ["2726",crossHold,{tower:true},"hercules",["shoulder","forearm"],[12,20,[0,1.00,.05],2.49],5350,.48],
  ["2714",crossHold,{},"cross-weights",["shoulder","forearm"],[20,18,[0,.92,.06],2.22],5350,.46],
  ["2727",walkLoad,{},"shield",["core","glute"],[61,15,[0,.92,.56],2.35],5500,.45],
  ["2715",walkLoad,{timber:true},"timber",["glute","quad","forearm"],[67,20,[0,.90,.63],2.52],6000,.48],
  ["2719",vikingPress,{},"viking",["shoulder","triceps"],standing,4500,.47],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const selected=wanted.length?items.filter(([id])=>wanted.includes(id)):items;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[], failures=[];
for(const [id,motion,args,kind,muscles,view,durationMs,posterAt] of selected){
  const [yaw,elevation,focus,height]=view;
  const data={version:1,durationMs,equipment:"spotter-strongman-"+kind,muscles,camera:{yaw,elevation,focus,height},
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
