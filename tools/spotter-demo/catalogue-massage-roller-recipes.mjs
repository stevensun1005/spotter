import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, xAxis=[1,0,0], zAxis=[0,0,1];
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function palm(p,side,where,pole,fingers=[0,-.12,.99]){
  arm(p,side,where,pole);
  p[side+"Fingers"]=fingers;p[side+"PalmSide"]=[0,1,0];
}
function marker(p,where,u,multiplier=1.6){
  p.ballCenter=where;
  p.machineTravel=multiplier*u;
  return p;
}

function massageFaceWall(t,{region="ab"}={}){
  const u=cycle(t,.39,.70);
  const mark=region==="rib";
  const p=body([.021*u,.883-.035*u,mark?.431:.428],.036+.04*u,mark?.078:0);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.180,floor,.204],[sign*.15,.085,.98]);
    palm(p,side,[sign*.27,1.110,.643],[sign*.92,-.31,-.13],[sign*.30,.95,.07]);
  }
  return marker(p,[mark?.132:.020,mark?1.053-.028*u:.947-.030*u,.612],u,.73);
}

function proneMassage(t,{region="adductor"}={}){
  const u=cycle(t,.39,.72);
  const core=["iliacus","psoas","psoas-low"].includes(region);
  const outward=region==="adductor";
  const p=body([core?.027*u:.024,.184+(core?.011:.031*u),-.106+.093*u],1.19+(core?.029:.108)*u,0,core?.147:0);
  p.planted={};
  for(const [side,sign] of sides){
    const upper=side==="l";
    const goal=outward&&upper?[.519,.109,-.216]:[sign*.145,.119,-.867+.063*u];
    foot(p,side,sign,goal,outward&&upper?[.62,-.31,.37]:[sign*.14,-.29,.84],
      [.011,-.090,outward&&upper?-.122:-.135]);
    const elbow=[sign*.192,.094,.298];
    p[side+"e"]=elbow;
    p[side+"w"]=add(elbow,[sign*.035,-.019,.305]);
    p[side+"Fingers"]=zAxis;p[side+"PalmSide"]=[0,1,0];
  }
  if(core){
    const center=region==="iliacus"?[.197,.061,-.045]:region==="psoas-low"?[.189,.064,-.078]:[.193,.065,.041];
    return marker(p,add(center,[.018*u,.0,.033*u]),u,.84);
  }
  const ideal=blend(p.lh,p.lk,outward?.55:.77);
  return marker(p,[ideal[0]+(outward?-.037:.007),.046,ideal[2]+.071*u],u);
}

function tableUpperArm(t){
  const u=cycle(t);
  const p=body([.020,.784,.125],1.066);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.170,floor,.141],[sign*.13,.084,.97]);
  p.le=add(p.ls,[.026,-.051,.242]);
  p.lw=add(p.le,[.056,-.012,.302]);
  p.lFingers=zAxis;p.lPalmSide=[-1,0,0];
  palm(p,"r",[-.098,.961,.582],[-.79,-.36,.12]);
  const target=blend(p.ls,p.le,.62+.24*u);
  return marker(p,[target[0],.966,target[2]+.032*u],u);
}

function sideMassage(t,{region="lat"}={}){
  const u=cycle(t,.40,.73);
  const sideNeck=region==="neck"||region==="neck-profile";
  const lowerLeg=region==="tibia-in";
  const hip=region==="tfl";
  const lateral=region==="quad-out";
  const torso=region==="oblique";
  const one=hip||lateral||lowerLeg;
  const p=body([.033+(one?.033:0)*u,sideNeck?.263:lowerLeg?.219:.181+(hip?.052:0)*u,
    .208+(sideNeck?.036:.081)*u],sideNeck?-1.497:-1.506,0,Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides){
    const x=.06+sign*.028;
    let y=.128+sign*.040;
    let depth=.207+.747;
    if(lowerLeg&&side==="l"){y=floor;depth=.472;}
    if(hip&&side==="l"){y=floor;depth=.510;}
    foot(p,side,sign,[x,y,depth],[.57,.49,.24],[.119,-.049,.059]);
  }
  if(sideNeck){
    p.headAim=[.046,.069*u,-1];
    p.headDrop=.042;
    palm(p,"r",add(p.head,[-.064,.014,.063]),[-.84,-.40,-.25]);
    palm(p,"l",add(p.chest,[.184,.041,.210]),[.74,-.58,.23]);
  }else{
    const reach=region==="lat";
    palm(p,"r",reach?add(p.rs,[.091,-.083,-.501]):add(p.head,[-.079,-.046,.086]),[-.65,-.17,.46]);
    palm(p,"l",reach?add(p.ls,[.176,-.030,-.510]):[.259,.063,.066],[.73,-.58,.12]);
  }
  if(sideNeck)return marker(p,add(p.neck,[.092,.084,-.029+.018*u]),u,.83);
  const pointOnBody=region==="lat"?blend(p.chest,p.rs,.47):torso?blend(p.chest,p.hips,.52):hip?p.rh:
    lowerLeg?blend(p.rk,p.ra,.72):blend(p.rh,p.rk,.55);
  return marker(p,[pointOnBody[0]+(lowerLeg?.027:region==="lat"?.100:.035),.046,pointOnBody[2]+.034*u],u);
}

function supineNeckBall(t){
  const u=cycle(t);
  const p=body([0,.153,-.015],-Math.PI/2);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.160,floor,.491],[sign*.13,.93,.41]);
    palm(p,side,[sign*.282,.060,-.251],[sign*.77,-.17,.33]);
  }
  p.headAim=[.145*Math.sin(2*Math.PI*t),.045*u,-1];
  p.headDrop=.055-.025*u;
  return marker(p,[.028*Math.sin(2*Math.PI*t),.047,-.624+.013*u],u);
}

function calfOrSeated(t,{region="knee"}={}){
  const u=cycle(t,.38,.72);
  if(region==="pectineus"){
    const p=fromSupport("seat",{pitch:.181});
    palm(p,"l",add(p.lk,[.025,.067,-.128]),[.62,-.56,-.29]);
    palm(p,"r",add(p.rk,[-.033,.076,-.106]),[-.67,-.55,.22]);
    const pointOnBody=blend(p.lh,p.lk,.36);
    return marker(p,add(pointOnBody,[-.088,.065,.073]),u,.54);
  }
  if(region==="tibia"){
    const p=body([0,.518,-.126],.781);
    p.planted={};
    for(const [side,sign] of sides){
      foot(p,side,sign,[sign*.139,.113,-.548],[sign*.09,-.94,.28],[sign*.019,-.074,-.124]);
      palm(p,side,[sign*.179,.052,.325],[sign*.73,-.27,-.32]);
    }
    return marker(p,[.191,.051,-.366+.071*u],u);
  }
  const p=body([0,.169,-.230+.039*u],-.341);
  p.planted={r:0};
  p.lk=[.146,.175,.202];p.la=[.151,.107,.619];p.lt=[.155,.209,.686];
  foot(p,"r",-1,[-.175,floor,.303],[-.15,.94,.24]);
  for(const [side,sign] of sides)palm(p,side,[sign*.266,.047,-.613],[sign*.72,-.34,-.28]);
  return marker(p,[.147,.072,.213+.033*u],u,.57);
}

function foamBack(t,{mode="lumbar"}={}){
  const u=cycle(t,.32,.66);
  const neck=mode==="neck"||mode==="decompress";
  const rotate=mode==="neck";
  const hip=mode==="seat";
  const bridge=mode==="calf-seat";
  let p;
  if(hip){
    p=body([0,.226,-.177+.080*u],-.40-.578*u);
    p.planted={};
    for(const [side,sign] of sides){
      foot(p,side,sign,[sign*.151,.087,.596+.018*u],[sign*.15,.32,.92],[sign*.025,.032,.144]);
      palm(p,side,[sign*.302,.055,-.493+.045*u],[sign*.68,-.11,-.42]);
    }
    p.handRoller={center:[0,.081,-.177+.081*u],axis:xAxis};
  }else if(bridge){
    p=body([0,.232+.033*u,-.149],-.416);
    p.planted={r:0};
    foot(p,"l",1,[.157,.155,.641],[.19,.085,.93],[.020,.105,.111]);
    foot(p,"r",-1,[-.182,floor,.387],[-.13,.98,.24]);
    for(const [side,sign] of sides){
      p[side+"s"]=add(p[side+"s"],[sign*.029*u,-.049*u,-.043*u]);
      palm(p,side,[sign*.261,.054,-.566],[sign*.69,-.43,-.30]);
    }
    p.handRoller={center:[.132,.081,.432],axis:xAxis};
  }else{
    p=body([0,neck?.157:.221+.042*u,-.049+.128*u],neck?-Math.PI/2:-1.668+.200*u);
    for(const [side,sign] of sides){
      foot(p,side,sign,[sign*.168,floor,.521],[sign*.085,.93,.36]);
      const hand=neck?[sign*.279,.059,-.292]:add(p.chest,[sign*.105,.181,.056]);
      palm(p,side,hand,[sign*.79,-.21,.27]);
    }
    p.handRoller={center:[0,.081,neck?-.695+.028*u:-.166+.207*u],axis:xAxis};
    if(neck){
      p.headTurn=rotate?.58*Math.sin(2*Math.PI*t):0;
      p.headAim=[0,.012+.085*u,-1];
      p.headDrop=rotate?.011:.030-.028*u;
    }
  }
  p.machineTravel=neck?.32*u:2.82*u;
  return p;
}

function foamKneel(t){
  const u=cycle(t,.39,.71);
  const p=body([-.096,.492,-.243],1.386+.145*u,.315+.354*u,.239*u);
  p.planted={};
  for(const [side,sign] of sides)foot(p,side,sign,
    [-.096+sign*.145,.114,-.645],[sign*.09,-.93,.28],[sign*.015,-.071,-.144]);
  const hand=[.279+.176*u,.131,.376];
  palm(p,"l",hand,[.83,-.62,-.19],zAxis);
  palm(p,"r",add(p.head,[-.099,.031,.081]),[-.83,.27,.08],[-.93,.038,.364]);
  p.handRoller={center:hand.map((value,idx)=>value-(idx===1?.050:0)),axis:zAxis};
  p.machineTravel=2.82*u;
  return p;
}

function tiger(t,{mode="hamstring"}={}){
  const u=cycle(t,.36,.74);
  const forearm=mode==="forearm";
  const tris=mode==="tricep";
  const peroneal=mode==="outer";
  const p=forearm?body([.039,.826,.150],.690):
    tris?body([.047,.806,.590],.615):body([0,.165,-.216],-.315);
  if(forearm||tris){
    for(const [side,sign] of sides)
      foot(p,side,sign,[sign*.152,tris&&sign>0?.498:floor,tris&&sign>0?.916:.133],
        [sign*.158,.073,.965],[sign*.027,-.070,.127]);
    if(tris)p.planted.l=.427;
  }else{
    p.planted={r:0};
    const goal=peroneal?[.169,.105,.563]:[.185,.125,.637];
    foot(p,"l",1,goal,[.55,.69,.23],[.053,.098,.098]);
    foot(p,"r",-1,[-.192,floor,.245],[-.28,.94,.18]);
  }
  const center=forearm?[.229,.977,.562+.135*u]:tris?[.240,.942+.013*u,.947]:
    peroneal?add(blend(p.lk,p.la,.36+.41*u),[.083,.063,.023]):add(blend(p.lh,p.lk,.42+.39*u),[.020,-.057,.025]);
  const axis=forearm||tris?xAxis:peroneal?unit([.681,0,.732]):xAxis;
  if(forearm){
    p.le=[.207,1.009,.433];p.lw=[.229,.982,.775];p.lFingers=zAxis;p.lPalmSide=[0,-1,0];
    palm(p,"r",add(center,scale(axis,-.147)),[-.81,-.48,.10]);
    p.rGrip=axis;
  }else if(tris){
    p.le=add(p.ls,[.017,-.248,-.026+.014*u]);
    p.lw=add(p.le,[.016,-.154,.285]);
    p.lFingers=[.014,-.154,.98];p.lPalmSide=[0,1,0];
    palm(p,"r",[.017,.482,.784],[-.81,-.47,.21]);
  }else{
    for(const [side,sign] of sides){
      palm(p,side,add(center,scale(axis,sign*.152)),[sign*.61,-.49,.29]);
      p[side+"Grip"]=axis;
    }
  }
  p.handRoller={center,axis};
  p.machineTravel=3.05*u;
  return p;
}

const low=[62,23,[0,.36,.08],1.61], lateral=[66,24,[.02,.35,.17],1.62], stand=[52,18,[0,.91,.37],2.06];
const list=[
  ["4470",proneMassage,{},"spotter-massage-ball",["l:adductor"],[61,25,[.07,.34,-.14],1.66]],
  ["4498",tableUpperArm,{},"spotter-massage-table",["l:biceps"],[64,18,[.17,.86,.52],1.89]],
  ["4482",massageFaceWall,{region:"rib"},"spotter-massage-front-wall",["core"],[112,18,[0,.93,.37],2.10]],
  ["4478",sideMassage,{region:"oblique"},"spotter-massage-ball",["core"],lateral],
  ["4477",proneMassage,{region:"iliacus"},"spotter-massage-ball",["l:core"],[65,24,[.05,.33,-.15],1.62]],
  ["4475",proneMassage,{region:"psoas"},"spotter-massage-ball",["core"],[59,22,[.02,.33,-.13],1.70]],
  ["4469",sideMassage,{region:"quad-out"},"spotter-massage-ball",["r:quad"],[64,24,[.03,.34,.25],1.68]],
  ["4493",sideMassage,{region:"lat"},"spotter-massage-ball",["r:lat"],[64,25,[.0,.34,.00],1.68]],
  ["6769",supineNeckBall,{},"spotter-massage-ball",["neck"],[64,25,[0,.35,-.15],1.61]],
  ["4466",calfOrSeated,{},"spotter-massage-ball",["l:calf"],[64,24,[0,.35,.15],1.59]],
  ["6766",sideMassage,{region:"tibia-in"},"spotter-massage-ball",["r:calf"],[65,23,[0,.35,.25],1.65]],
  ["4476",proneMassage,{region:"psoas-low"},"spotter-massage-ball",["core"],[65,24,[.02,.33,-.16],1.63]],
  ["4479",massageFaceWall,{},"spotter-massage-front-wall",["core"],[107,16,[0,.91,.37],2.11]],
  ["4468",proneMassage,{region:"quad-front"},"spotter-massage-ball",["l:quad"],[62,22,[0,.35,-.24],1.68]],
  ["6812",calfOrSeated,{region:"pectineus"},"spotter-massage-bench",["l:adductor"],[64,22,[.11,.68,1.44],1.48]],
  ["6767",sideMassage,{region:"neck"},"spotter-massage-headrest",["neck"],[63,24,[0,.40,.09],1.61]],
  ["6768",sideMassage,{region:"neck-profile"},"spotter-massage-headrest",["neck"],[94,20,[0,.38,.09],1.60]],
  ["4471",sideMassage,{region:"tfl"},"spotter-massage-ball",["r:glute"],[63,24,[.01,.36,.22],1.62]],
  ["4464",calfOrSeated,{region:"tibia"},"spotter-massage-ball",["l:shin"],[66,22,[.02,.44,-.12],1.60]],
  ["5387",foamBack,{},"spotter-foam-roller",["core"],low],
  ["5388",foamKneel,{},"spotter-foam-roller",["core","shoulder"],[52,24,[.03,.43,.00],1.63]],
  ["5372",foamBack,{mode:"decompress"},"spotter-foam-roller",["neck"],[72,25,[0,.39,-.16],1.59]],
  ["5371",foamBack,{mode:"neck"},"spotter-foam-roller",["neck"],[69,24,[0,.38,-.14],1.63]],
  ["2208",foamBack,{mode:"seat"},"spotter-foam-roller",["core"],[64,22,[0,.40,.03],1.64]],
  ["2209",foamBack,{mode:"calf-seat"},"spotter-foam-roller",["shoulder","lat"],[63,23,[0,.40,.02],1.69]],
  ["4220",tiger,{mode:"forearm"},"spotter-tiger-tail-table",["l:forearm"],[55,20,[.16,.81,.47],1.86]],
  ["4221",tiger,{},"spotter-tiger-tail",["l:hamstring"],[66,23,[.05,.38,.05],1.62]],
  ["4223",tiger,{mode:"outer"},"spotter-tiger-tail",["l:calf"],[63,24,[.05,.38,.12],1.63]],
  ["4407",tiger,{mode:"tricep"},"spotter-tiger-tail-bench",["l:triceps"],[62,20,[.03,.76,.68],1.85]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const selected=wanted.length?list.filter(([id])=>wanted.includes(id)):list;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const [id,motion,args,equipment,muscles,view] of selected){
  const [yaw,elevation,focus,height]=view;
  const data={version:1,durationMs:4550,equipment,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,n)=>({at:n/64,...motion(n/64,args)}))};
  try{prepareRecipe(data);}
  catch(error){failures.push({id,error:error.message});continue;}
  const recipe=id+".json";
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.47});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
