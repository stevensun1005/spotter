import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";
const floor=.075;
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function route(t,stops){
  const i=stops.findIndex(([end])=>t<=end);
  return i<=0?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function ball(p,center,{single=false,released=false,yaw=0}={}){
  const across=[Math.cos(yaw),0,-Math.sin(yaw)];
  for(const [name,sign] of sides){
    if(single&&name==="r"){inactive(p,name,sign);continue;}
    arm(p,name,add(center,add(scale(across,sign*(released?.164:single?.021:.084)),[0,-.016,-.034])),
      [sign*.70,-.51,.12]);
    p[name+"PalmSide"]=single?[0,-1,0]:scale(across,-sign);
    p[name+"Fingers"]=single?[0,.12,.98]:[0,.49,.87];
  }
  p.ballCenter=released?center:single?add(p.lw,[0,.074,.043]):add(scale(add(p.lw,p.rw),.5),
    [Math.sin(yaw)*.028,.028,Math.cos(yaw)*.067]);
  return p;
}

function bosuCore(t,{form="crunch"}={}){
  const alternating=form==="alternating";
  const weight=form==="weighted";
  const myotatic=form==="myotatic";
  const u=cycle(t);
  const pitch=alternating?-1.174:myotatic?-1.92+1.11*u:weight?-1.26+.95*u:-1.45+.779*u;
  const p=body([0,.327,.106],pitch);
  p.planted={};
  for(const [side,sign] of sides){
    const lift=alternating?cycle(side==="l"?2*t:(t-.5)*2):0;
    if(alternating){
      const angle=Math.PI*.395*lift;
      p[side+"k"]=add(p[side+"h"],[sign*.019,-.062+.420*Math.sin(angle),.415*Math.cos(angle)]);
      p[side+"a"]=add(p[side+"k"],[-sign*.010,-.054+.424*Math.sin(angle),.412*Math.cos(angle)]);
      p[side+"t"]=add(p[side+"a"],[sign*.012,.113,.095]);
    }else{
      const spot=weight?[sign*.144,.147+.344*u,.806-.288*u]:[sign*.163,floor,.518];
      foot(p,side,sign,spot,[sign*.19,.86,.49],[sign*.022,weight?.026:-.071,.140]);
      if(!weight)p.planted[side]=0;
    }
    if(alternating){
      arm(p,side,[sign*.237,.202,-.024],[sign*.53,-.38,.35]);
      p[side+"PalmSide"]=[-sign,.422,0];p[side+"Fingers"]=[0,.16,.981];
    }else if(!weight){
      arm(p,side,add(p.head,[sign*.105,-.034,-.048]),[sign*.91,-.21,.21]);
      p[side+"PalmSide"]=[sign,0,0];p[side+"Fingers"]=[-sign*.52,.71,.47];
    }
  }
  if(weight)ball(p,add(p.chest,[0,.152,.246]));
  return p;
}

function bosuLunge(t){
  const drop=cycle(t/.62,.44,.57);
  const drive=cycle((t-.55)/.45,.41,.62);
  const p=body([0,.948-.327*drop+.155*drive,-.289+.344*drive],.046+.125*drop);
  foot(p,"l",1,[.091,.337,-.062],[.11,.10,.96],[.013,-.071,.125]);
  p.planted.l=.261;
  const trail=[-.151,.126+.622*drive,-.782+.958*drive];
  foot(p,"r",-1,trail,[-.11,-.045,.96],[-.019,-.119+.096*drive,.126]);
  delete p.planted.r;
  for(const [side,sign] of sides){
    const counter=side==="l"?drive:drop;
    arm(p,side,add(p[side+"s"],[sign*.072,-.554+.269*counter,.029+.303*counter]),[sign*.58,-.49,-.68]);
  }
  return p;
}

function stabilityMed(t,{curl=false}={}){
  const u=cycle(t);
  const p=curl?fromSupport("ball"):body([0,.527,.336],-1.57+.791*u);
  p.secondaryBallCenter=curl?[0,.285,.023]:[0,.285,-.002];
  p.planted={};
  if(!curl)for(const [side,sign] of sides)foot(p,side,sign,[sign*.202,floor,.753],[sign*.16,.91,.51]);
  const a=.118+2.34*u;
  const center=curl?add(p.chest,[0,-.091-.391*Math.cos(a),.078+.277*Math.sin(a)]):add(p.chest,[0,.163,.213]);
  return ball(p,center);
}

function seatedTwistPartner(t){
  const first=t<.5;
  const f=first?2*t:(t-.5)*2;
  const touch=ramp(f,.23,.51)*(1-ramp(f,.67,.97));
  const swing=cycle(f/.52);
  const pass=route(f,[[0,[0]],[.48,[0]],[.64,[1]],[1,[1]]])[0];
  const viewA=.10+.67*(first?swing:0), viewB=Math.PI+.06-.67*(!first?swing:0);
  const a=body([-.062,.167,-.798],-.485,viewA);
  const b=body([.062,.167,.798],-.485,viewB);
  for(const [i,p] of [a,b].entries())for(const [side,sign] of sides){
    const depth=i===0?-.233:.233;
    foot(p,side,sign,[sign*.181,floor,depth],[sign*.10,.94,.33], [sign*.018,-.071,i===0?.142:-.142]);
  }
  const contactA=blend(add(a.chest,[.217*(first?swing:0),.121,.241]),[-.031,.555,-.18],touch);
  const contactB=blend(add(b.chest,[.217*(!first?swing:0),.128,-.252]),[.031,.559,.18],touch);
  ball(a,contactA,{yaw:viewA});ball(b,contactB,{yaw:viewB});
  const from=first?a.ballCenter:b.ballCenter, to=first?b.ballCenter:a.ballCenter;
  a.ballCenter=add(blend(from,to,pass),[0,.06*Math.sin(Math.PI*pass),0]);
  a.partner=b;
  return a;
}

function ballSlam(t,{form="circle"}={}){
  const sitting=form==="sit";
  const single=form==="single";
  const circle=form==="circle";
  const rise=ramp(t,.13,.39)*(1-ramp(t,.76,1));
  const preload=cycle((t-.38)/.40,.47,.62);
  const wrapping=circle?Math.sin(2*Math.PI*ramp(t,.17,.59)):0;
  const p=sitting?body([0,.148,-.342],-Math.PI/2+1.58*rise):body([0,.885-.263*preload,-.175-.086*preload],.044+.710*preload);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.185,floor,sitting?.297:.084],[sign*.17,sitting?.94:.11,.79]);
  const shoulder=p.ls;
  const base=sitting?add(p.head,[0,.119,-.197]):single?add(p.hips,[.225,.069,.178]):add(p.chest,[0,.662,.128]);
  const high=sitting?add(p.head,[0,.319,.092]):add(p.chest,[single?.203:.297*wrapping,.641,.162+.168*Math.abs(wrapping)]);
  const wrist=route(t,[[0,base],[.26,high],[.39,high],[.54,[single?.21:0,sitting?.513:.761,sitting?.587:.512]],
    [.66,[single?.21:0,sitting?.417:.614,sitting?.592:.501]],[1,base]]);
  ball(p,wrist,{single});
  const descending=ramp(t,.54,.635);
  const rebounding=ramp(t,.637,.751);
  if(t>.54&&t<.755){
    const b=blend([single?.21:0,sitting?.513:.761,sitting?.587:.512],[single?.21:0,.111,sitting?.679:.654],descending);
    p.ballCenter=blend(b,[single?.21:0,sitting?.551:.678,sitting?.625:.575],rebounding);
  }
  p.machineTravel=3.51*rise;
  return p;
}

function pulloverCatch(t){
  const p=body([0,.147,-.273],-Math.PI/2);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.177,floor,.314],[sign*.15,.77,.79]);
  const u=ramp(t,0,.39)*(1-ramp(t,.71,1));
  const a=.17+2.16*u;
  const held=add(p.chest,[0,.533*Math.sin(a)+.054,-.517*Math.cos(a)+.023]);
  ball(p,held);
  if(t>.39&&t<.71){
    const flight=(t-.39)/.32;
    const range=Math.sin(Math.PI*flight);
    p.ballCenter=add(blend(p.ballCenter,[0,.801,1.251],range),[0,.069*range,0]);
    p.machineTravel=3.77*range;
  }
  return p;
}

function hop(t){
  const first=t<.5, f=first?2*t:(t-.5)*2;
  const direction=first?1:-1;
  const lift=Math.sin(Math.PI*f);
  const x=direction*route(f,[[0,[-.461]],[.24,[-.33]],[.66,[.44]],[1,[.461]]])[0];
  const active=first?"l":"r";
  const p=body([x,.748+.187*lift,.061],.154-.089*lift);
  p.planted={};
  for(const [side,sign] of sides){
    const landing=side===active;
    foot(p,side,sign,[x+sign*(landing?.127:.190),floor+lift*.175+(landing?0:.102),landing?.068:-.234],
      [sign*.28,.04,.91],[sign*.019,-.072,.129]);
    if(landing&&lift<.004)p.planted[side]=0;
  }
  ball(p,add(p.chest,[0,.083,.211]));
  return p;
}

function ghBall(t){
  const u=cycle(t);
  const p=body([0,.913,.139],1.54,Math.PI);
  p.planted={};
  for(const [side,sign] of sides){
    const pitch=.87-.83*u;
    p[side+"k"]=add(p[side+"h"],[-sign*.053,-.420*Math.sin(pitch),.421*Math.cos(pitch)]);
    p[side+"a"]=add(p[side+"k"],[sign*.017,-.414*Math.sin(pitch),.416*Math.cos(pitch)]);
    p[side+"t"]=add(p[side+"a"],[sign*.050,-.077,.105]);
    arm(p,side,[sign*.207,.747,-.195],[sign*.58,-.49,.35]);
    p[side+"PalmSide"]=[0,1,0];p[side+"Fingers"]=[0,-.08,-1];
  }
  p.ballCenter=add(scale(add(p.lt,p.rt),.5),[0,.063,-.069]);
  return p;
}

const jobs=[
  ["1186",bosuCore,{form:"alternating"},"spotter-bosu",["core"],[63,24,[0,.41,.14],1.76],5500,.24],
  ["1242",bosuCore,{},"spotter-bosu",["core"],[63,24,[0,.41,.14],1.72],4550,.49],
  ["5228",bosuCore,{form:"myotatic"},"spotter-bosu",["core"],[65,23,[0,.43,.09],1.76],4850,.48],
  ["5478",bosuLunge,{},"spotter-bosu",["quad","glute"],[62,18,[0,.94,-.17],2.29],5350,.37],
  ["1189",bosuCore,{form:"weighted"},"spotter-bosu-med-ball",["core"],[64,24,[0,.45,.22],1.72],4650,.47],
  ["9010",stabilityMed,{},"spotter-med-ball-stability",["core"],[60,25,[0,.58,.20],1.82],4500,.47],
  ["0847",stabilityMed,{curl:true},"spotter-med-ball-stability",["biceps","forearm"],[55,18,[0,.89,.13],1.92],4200,.47],
  ["0014",seatedTwistPartner,{},"spotter-med-ball-mat",["core"],[80,24,[0,.50,0],1.95],6400,.32],
  ["10118",ballSlam,{},"spotter-med-ball",["core","shoulder","lat"],[47,16,[0,1.04,.13],2.48],5350,.54],
  ["0640",ballSlam,{form:"single"},"spotter-med-ball",["l:shoulder","core"],[46,16,[0,1.05,.05],2.48],5300,.53],
  ["10558",ballSlam,{form:"sit"},"spotter-med-ball-mat",["core","shoulder"],[59,23,[0,.65,.02],1.98],5450,.54],
  ["10595",pulloverCatch,{},"spotter-med-ball-wall-mat",["lat","shoulder"],[68,23,[0,.65,.31],2.09],5400,.39],
  ["10758",hop,{},"spotter-med-ball",["glute","quad","core"],[35,16,[0,.93,.05],2.34],5400,.23],
  ["10861",ghBall,{},"spotter-med-ball-ghd",["glute","hamstring"],[109,21,[0,.68,.16],1.88],4500,.46],
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
