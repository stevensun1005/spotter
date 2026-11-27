import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, curl, cycle, foot, fromSupport, inactive, kickback, raise, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const xAxis=[1,0,0], zAxis=[0,0,1];
const floor=.075;
const norm=a=>scale(a,1/Math.max(.00001,Math.hypot(...a)));
const cross=([x,y,z],[a,b,c])=>[y*c-z*b,z*a-x*c,x*b-y*a];
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const spin=(axis,direction,angle)=>add(add(scale(axis,Math.cos(angle)),scale(cross(direction,axis),Math.sin(angle))),
  scale(direction,(1-Math.cos(angle))*dot(direction,axis)));

function hold(p,side,axis){
  p[side+"Grip"]=norm(axis);
  p.dumbbells.push({center:p[side+"w"],axis:p[side+"Grip"]});
}

function timed(t,points){
  const i=points.findIndex(([end])=>end>=t);
  if(i<=0)return points[0][1];
  return blend(points[i-1][1],points[i][1],ramp(t,points[i-1][0],points[i][0]));
}

function curlRanges(t,{close=false}={}){
  const p=fromSupport("floor");
  const amount=close?cycle(t):timed(t,[[0,[0]],[.148,[.52]],[.282,[0]],[.368,[.52]],[.501,[1]],
    [.627,[.52]],[.70,[0]],[.85,[1]],[1,[0]]])[0];
  for(const [side,sign] of sides){
    const angle=.09+2.35*amount;
    const elbow=add(p[side+"s"],[sign*(close?.009:.064),-.246,.035]);
    const direction=norm([close?-sign*.37:0,-Math.cos(angle),Math.sin(angle)]);
    p[side+"e"]=elbow;
    p[side+"w"]=add(elbow,scale(direction,.371));
    hold(p,side,xAxis);
  }
  return p;
}

function proneBenchIsolation(t,{row=false}={}){
  const p=body([.025,.781,.786],1.71);
  p.planted={l:.430,r:0};
  p.lk=[.124,.487,.826];
  p.la=[.135,.496,.474];
  p.lt=[.146,.445,.327];
  foot(p,"r",-1,[-.388,floor,.604],[-.28,.13,.84], [-.039,-.070,.133]);
  arm(p,"l",[.171,.453,1.248],[-.36,-.13,-.75]);
  p.lFingers=[-.12,-.33,.88];
  p.lPalmSide=[0,1,0];
  const amount=cycle(t);
  if(row){
    arm(p,"r",add(p.rs,blend([-.065,-.576,.034],[-.197,-.152,-.103],amount)),[-.87,.30,-.31],zAxis);
  } else {
    const elbow=add(p.rs,[-.025,.054,-.245]);
    const angle=.075+1.43*amount;
    p.re=elbow;
    p.rw=add(elbow,[0,-.371*Math.cos(angle),-.371*Math.sin(angle)]);
    hold(p,"r",[0,-Math.sin(angle),Math.cos(angle)]);
  }
  return p;
}

function cuban(t,{setting="floor"}={}){
  const p=fromSupport(setting);
  const lift=ramp(t,.0,.19)*(1-ramp(t,.80,1));
  const rotate=ramp(t,.19,.42)*(1-ramp(t,.65,.80));
  const press=ramp(t,.42,.53)*(1-ramp(t,.57,.65));
  for(const [side,sign] of sides){
    const bend=timed(press,[[0,[sign*.250,-.027,.017]],[1,[sign*.053,.243,.030]]]);
    const elbow=add(p[side+"s"],blend([sign*.049,-.246,.032],bend,lift));
    const angle=.14+2.62*rotate;
    const follow=norm(blend([0,-Math.cos(angle),Math.sin(angle)],[0,1,.035],press));
    p[side+"e"]=elbow;
    p[side+"w"]=add(elbow,scale(follow,.371));
    hold(p,side,xAxis);
  }
  return p;
}

function curlingExtension(t){
  const p=fromSupport("floor");
  for(const [side,sign] of sides){
    const path=[
      [0,[sign*.073,-.596,.034]],[.17,[sign*.068,.034,.219]],[.35,[sign*.068,.598,.040]],
      [.49,[sign*.056,.282,-.260]],[.60,[sign*.068,.598,.040]],
      [.81,[sign*.068,.034,.219]],[1,[sign*.073,-.596,.034]],
    ];
    const curlToRack=ramp(t,.08,.17)*(1-ramp(t,.81,.97));
    const press=ramp(t,.22,.34)*(1-ramp(t,.68,.77));
    const extension=ramp(t,.35,.49)*(1-ramp(t,.49,.60));
    arm(p,side,add(p[side+"s"],timed(t,path)),[sign*(.22+.33*press),-.79+1.21*extension,-.22+.41*press],
      blend(xAxis,zAxis,curlToRack*.65));
  }
  return p;
}

function sideForearm(t,{flat=false,pronate=false}={}){
  const lowerHand=flat&&pronate;
  const planked=!flat&&!pronate;
  const p=body(flat?[.08,.674,1.129]:[0,planked?.254:.174,.220],planked?-1.254:-Math.PI/2,0,Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides){
    const ankle=[p.hips[0]+.046*sign,flat?.547+sign*.056:.116+sign*.043,p.hips[2]+(flat?.653:.767)];
    foot(p,side,sign,ankle,[1,.065,.10],[.128,-.047,.052]);
  }
  if(lowerHand){
    arm(p,"l",add(p.head,[.021,-.055,.092]),[-.83,.26,-.23]);
  }else if(planked){
    const contact=[p.rs[0]-.143,.078,p.rs[2]+.024];
    p.re=contact;
    p.rw=add(contact,[.299,-.006,.043]);
    p.rFingers=[1,0,0];
    p.rPalmSide=[0,1,0];
  }else{
    arm(p,"r",add(p.head,[-.067,-.046,.073]),[-.90,-.11,-.30]);
  }
  const working=lowerHand?"r":"l";
  const elbow=add(p[working+"s"],[lowerHand?.120:.065,lowerHand?.038:flat?-.057:-.108,.224]);
  const direction=norm([lowerHand?.933:.813,.067,lowerHand?.306:.477]);
  p[working+"e"]=elbow;
  p[working+"w"]=add(elbow,scale(direction,.362));
  p[working+"Fingers"]=direction;
  hold(p,working,spin(zAxis,direction,(pronate?1:-1)*(Math.PI-.24)*cycle(t)));
  return p;
}

function scapularFloorPress(t,{single=false}={}){
  const p=fromSupport("supineMat");
  const amount=cycle(t);
  for(const [side,sign] of sides){
    if(single&&side==="r"){
      arm(p,side,add(p.hips,[-.323,-.079,.198]),[-.75,-.15,.38]);
      p.rPalmSide=[0,1,0];
      continue;
    }
    const lift=.086*amount;
    const shoulder=add(p[side+"s"],[-sign*.021*amount,lift,.022*amount]);
    const line=norm([sign*.076,.975,.191]);
    p[side+"s"]=shoulder;
    p[side+"e"]=add(shoulder,scale(line,.252));
    p[side+"w"]=add(shoulder,scale(line,.617));
    hold(p,side,xAxis);
  }
  return p;
}

function wristIsolation(t,{setting="floor",form="curl",single=false,behind=false,kneeling=false}={}){
  const onBench=setting==="bench";
  const seated=setting==="seat";
  const p=onBench
    ? kneeling?body([.641,.401,1.045],1.026,-Math.PI/2):fromSupport("wristBench",{pitch:1.32})
    : fromSupport(seated?"wristSeat":"floor");
  if(onBench&&kneeling){
    p.planted={};
    for(const [side,sign] of sides){
      p[side+"k"]=[.657,.087,1.045+sign*.131];
      p[side+"a"]=[1.037,.088,1.045+sign*.141];
      p[side+"t"]=[1.178,.027,1.045+sign*.153];
    }
  }
  const amount=cycle(t);
  const onlyRotation=["pronate","supinate","neutral-to-under","fixed-turn","turn"].includes(form);
  const angle=onlyRotation?0:(form==="roll"?-.16:-.49)+(form==="roll"?.26:.98)*amount;
  for(const [side,sign] of sides){
    if(single&&side==="r"){inactive(p,side,sign,seated||onBench?"thigh":"low");continue;}
    let elbow,forearm;
    if(onBench){
      elbow=kneeling?[.170,.502,1.045+sign*.143]:[.10-sign*.189,.498,1.231];
      forearm=kneeling?norm([-1,-.06,0]):norm([-sign*.79,-.08,-.61]);
    }else if(seated){
      const contact=add(p[side+"k"],[-sign*.025,.048,-.187]);
      elbow=add(p[side+"s"],scale(norm(add(contact,scale(p[side+"s"],-1))),.298));
      forearm=norm([sign*.037,-.073,1]);
    }else{
      elbow=add(p[side+"s"],[sign*.061,-.245,behind?-.127:.068]);
      forearm=form==="fixed-turn"||form==="turn"?norm([sign*.058,form==="turn"?-.877:-.048,form==="turn"?.477:.998])
        : norm([sign*.030,-1,behind?-.160:.110]);
    }
    p[side+"e"]=elbow;
    const wristAcross=onBench&&kneeling?zAxis:xAxis;
    const handForward=spin(forearm,wristAcross,angle*(form==="reverse"?-1:1));
    const palmDirection=onlyRotation
      ? spin(form==="neutral-to-under"?[0,1,0]:wristAcross,forearm,(form==="neutral-to-under"?-.5*Math.PI:form==="supinate"?-Math.PI:Math.PI)*amount)
      : form==="neutral"?norm(cross(forearm,wristAcross)):form==="reverse"||behind?scale(wristAcross,-1):wristAcross;
    const center=add(elbow,add(scale(forearm,.283),scale(handForward,.085)));
    p[side+"w"]=center;
    p[side+"Fingers"]=handForward;
    if(form==="roll"){
      p[side+"Grip"]=palmDirection;
      p[side+"FingerCurl"]=.14+.86*amount;
      p.dumbbells.push({center:add(center,scale(handForward,.054*(1-amount))),axis:palmDirection});
    }else hold(p,side,palmDirection);
  }
  return p;
}

function externalShoulder(t,{sitting=false,thigh=false,internal=false}={}){
  const p=fromSupport(thigh?"wristSeat":sitting?"seat":"floor");
  const amount=cycle(t);
  for(const [side,sign] of sides){
    if((sitting||internal)&&side==="r"){inactive(p,side,sign,sitting?"thigh":"low");continue;}
    let elbow,dir,axis;
    if(internal){
      elbow=add(p[side+"s"],[sign*.246,.019,.020]);
      const angle=amount*1.52;
      dir=[.027,Math.cos(angle),Math.sin(angle)];
      axis=xAxis;
    }else if(thigh){
      const contact=add(p[side+"k"],[-sign*.055,.078,-.10]);
      elbow=add(p[side+"s"],scale(norm(add(contact,scale(p[side+"s"],-1))),.288));
      const angle=.120+1.33*amount;
      dir=[sign*.15*Math.sin(angle),Math.sin(angle),Math.cos(angle)];
      axis=xAxis;
    }else{
      elbow=add(p[side+"s"],[sign*.071,-.236,-.036*amount]);
      const angle=.08+1.12*amount;
      dir=[sign*Math.sin(angle),sitting?.087+.33*amount:.072,Math.cos(angle)];
      axis=norm(cross(dir,[0,1,0]));
    }
    p[side+"e"]=elbow;
    p[side+"w"]=add(elbow,scale(norm(dir),.371));
    hold(p,side,axis);
  }
  return p;
}

function lowFly(t){
  const p=fromSupport("floor");
  const u=cycle(t);
  inactive(p,"r",-1);
  const sweep=[.288*(1-u)-.277*u,-.533*(1-u)+.055*u,.108+.480*u];
  arm(p,"l",add(p.ls,sweep),[.66,-.73,.14],spin(xAxis,zAxis,-.92*u));
  return p;
}

function yAndW(t,{form="prone-y",motion="raise"}={}){
  if(motion==="kick")return kickback(t,{setting:"proneStanding"});
  if(motion==="swing")return raise(t,{setting:"prone",plane:"rear",form:"rear-facing"});
  const standing=form==="brace-y";
  const w=form==="prone-w";
  const p=fromSupport(standing?"hinge":"prone");
  const amount=cycle(t);
  for(const [side,sign] of sides){
    if(standing&&side==="r"){inactive(p,side,sign,"thigh");continue;}
    const sideSign=-sign;
    if(w){
      const elbow=add(p[side+"s"],blend([sideSign*.155,-.174,.061],[sideSign*.220,.051,.105],amount));
      const wrist=add(elbow,blend([sideSign*.132,-.328,-.060],[sideSign*.163,.098,-.320],amount));
      p[side+"e"]=elbow;p[side+"w"]=wrist;
      hold(p,side,blend([0,0,1],[.81,.57,0],amount));
      continue;
    }
    const angle=.123+1.793*amount;
    const floorDirection=standing?[.53,0,.85]:[sideSign*.585,0,-.81];
    const target=add(p[side+"s"],scale(add(scale(floorDirection,Math.sin(angle)),[0,-Math.cos(angle),0]),.608));
    arm(p,side,target,[standing?.55:sideSign*.43,-.88,.108],blend(zAxis,[0,1,0],amount));
  }
  return p;
}

const floorCam=[55,15,[0,.92,.02],2.06];
const standPress=[48,14,[0,1.02,.04],2.31];
const matCam=[60,24,[0,.38,.025],1.88];
const chestCam=[117,18,[0,.70,.09],1.85];
const wristCam=[125,21,[.10,.61,1.30],1.37];
const kneelWristCam=[-46,24,[.55,.40,1.045],1.48];
const seatedCam=[62,18,[.1,.72,1.41],1.60];
const benchCam=[-48,22,[.03,.56,.95],1.78];
const items=[];
function group(ids,motion,args,equipment,muscles,camera=floorCam,durationMs=3800,posterAt=.47){
  for(const id of ids.split(" "))items.push({id,motion,args,equipment,muscles,camera,durationMs,posterAt});
}
group("5469",curlRanges,{},"dumbbells",["biceps"],floorCam,6500,.50);
group("4152",curlRanges,{close:true},"dumbbells",["biceps"],[37,14,[0,.91,.16],2.03]);
group("0333",proneBenchIsolation,{},"bench-dumbbell",["r:triceps"],benchCam);
group("0377",proneBenchIsolation,{row:true},"bench-dumbbell",["r:shoulder","r:lat"],benchCam);
group("0299",cuban,{},"dumbbells",["shoulder","triceps"],standPress,4900,.39);
group("2136",cuban,{},"dumbbells",["shoulder","triceps"],[29,15,[0,1.01,.03],2.30],4900,.39);
group("4183",cuban,{setting:"seat"},"bench-dumbbells",["shoulder","triceps"],[50,16,[.10,.91,1.31],1.96],4900,.38);
group("5884",curlingExtension,{},"dumbbells",["biceps","shoulder","triceps"],standPress,4900,.49);
group("0347",sideForearm,{flat:true,pronate:true},"long-bench-dumbbell",["r:forearm"],[105,21,[.12,.62,1.08],1.56]);
group("2705",sideForearm,{pronate:true},"mat-dumbbell",["l:forearm"],[53,23,[0,.24,.32],1.35]);
group("0349",sideForearm,{flat:true},"long-bench-dumbbell",["l:forearm"],[64,23,[.10,.61,1.02],1.60]);
group("2706",sideForearm,{},"mat-dumbbell",["l:forearm"],[-58,18,[0,.29,.27],1.45]);
group("11800",scapularFloorPress,{single:true},"mat-dumbbell",["l:pec","l:shoulder"],matCam);
group("9213",scapularFloorPress,{},"mat-dumbbells",["pec","shoulder"],matCam);
group("0365",wristIsolation,{setting:"bench",form:"neutral",kneeling:true},"bench-dumbbells",["forearm"],kneelWristCam);
group("0366",wristIsolation,{setting:"bench",form:"neutral",single:true,kneeling:true},"bench-dumbbell",["l:forearm"],kneelWristCam);
group("0367",wristIsolation,{setting:"bench",single:true,kneeling:true},"bench-dumbbell",["l:forearm"],kneelWristCam);
group("4908",wristIsolation,{setting:"bench",form:"reverse",kneeling:true},"bench-kneeling-mat-dumbbells",["forearm"],kneelWristCam);
group("6758",wristIsolation,{setting:"bench",form:"neutral-to-under",single:true},"wrist-bench-dumbbell",["l:forearm"],wristCam);
group("1611",wristIsolation,{form:"roll",single:true,behind:true},"dumbbell",["l:forearm"],[133,16,[0,.88,-.05],1.97]);
group("0399",wristIsolation,{setting:"seat",form:"pronate",single:true},"bench-dumbbell",["l:forearm"],seatedCam);
group("10817",wristIsolation,{setting:"seat",form:"pronate",single:true},"bench-dumbbell",["l:forearm"],[72,23,[.10,.65,1.41],1.45]);
group("10038",wristIsolation,{setting:"seat",form:"supinate",single:true},"bench-dumbbell",["l:forearm"],seatedCam);
group("6359",wristIsolation,{},"dumbbells",["forearm"],[51,16,[0,.91,.05],1.97]);
group("6362",wristIsolation,{form:"reverse"},"dumbbells",["forearm"],[58,16,[0,.91,.05],1.97]);
group("6366",wristIsolation,{behind:true},"dumbbells",["forearm"],[136,16,[0,.89,-.06],1.97]);
group("6267",wristIsolation,{form:"fixed-turn"},"dumbbells",["forearm"],[54,15,[0,.90,.12],2.04]);
group("7054",wristIsolation,{form:"turn"},"dumbbells",["forearm"],[45,14,[0,.90,.06],2.02]);
group("6140",externalShoulder,{sitting:true,thigh:true},"bench-dumbbell",["l:shoulder"],seatedCam);
group("5001",externalShoulder,{sitting:true},"bench-dumbbell",["l:shoulder"],[48,16,[.1,.77,1.30],1.71]);
group("5065",externalShoulder,{internal:true},"dumbbell",["l:shoulder"],[45,14,[0,.99,.063],2.10]);
group("7234",externalShoulder,{},"dumbbells",["shoulder"],floorCam);
group("7235",externalShoulder,{},"dumbbells",["shoulder"],[0,12,[0,.91,.08],2.01]);
group("4150",lowFly,{},"dumbbell",["l:pec","l:shoulder"],[50,14,[0,.94,.12],2.07]);
group("5002",yAndW,{form:"brace-y"},"dumbbell",["l:shoulder","l:trap"],[55,17,[0,.83,.16],2.04]);
group("5820",yAndW,{form:"prone-y"},"chest-bench-dumbbells",["shoulder","trap"],chestCam);
group("7747",yAndW,{form:"prone-w"},"chest-bench-dumbbells",["shoulder","trap"],chestCam);
group("5606",yAndW,{motion:"swing"},"chest-bench-dumbbells",["shoulder","trap"],chestCam);
group("5303",yAndW,{motion:"swing"},"chest-bench-dumbbells",["shoulder","trap"],[101,16,[0,.68,.13],1.75]);
group("4961",yAndW,{motion:"kick"},"chest-bench-dumbbells",["triceps"],chestCam);
group("6150",curl,{setting:"seat",form:"concentration"},"bench-dumbbells",["biceps"],[50,17,[.1,.69,1.40],1.59]);

const [directory,...requested]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(items.map(({id})=>id)).size!==items.length)throw new Error("Duplicate catalogue IDs.");
const selected=requested.length?items.filter(({id})=>requested.includes(id)):items;
if(requested.length&&selected.length!==requested.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
for(const {id,motion,args,equipment,muscles,camera,durationMs,posterAt} of selected){
  const [yaw,elevation,focus,height]=camera;
  const data={version:1,durationMs,equipment,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,n)=>({at:n/64,...motion(n/64,args)}))};
  try { prepareRecipe(data); } catch(error){ throw new Error(id+": "+error.message,{cause:error}); }
  const recipe=id+".json";
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log("Prepared",manifest.length,"Spotter dumbbell isolation recipes.");
