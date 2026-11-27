import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,blend,body,cycle,foot,scale,sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, up=[0,1,0], right=[1,0,0];
const center=(a,b)=>scale(add(a,b),.5);
const unit=v=>scale(v,1/Math.max(.0001,Math.hypot(...v)));
const between=(a,b)=>unit(add(b,scale(a,-1)));
function hands(p,side,target,pole=[.6,-.6,.2],orientation="up"){
  arm(p,side,target,pole);
  p[side+"Grip"]=orientation==="up"?right:orientation==="down"?scale(right,-1):up;
  p[side+"PalmSide"]=orientation==="down"?scale(up,-1):orientation==="neutral"?[side==="l"?-1:1,0,0]:up;
  p[side+"Fingers"]=p[side+"Grip"];
}
function cloth(p,location=center(p.lw,p.rw),axis=between(p.rw,p.lw),mod=0){
  p.handRoller={center:location,axis};
  p.machineTravel=mod;
  return p;
}
function stance(p,{z=.09,split=0,width=.159}={}){
  for(const [s,sign] of sides)foot(p,s,sign,[sign*width,floor,z+sign*split],[sign*.13,.12,.98]);
}
function kneel(p,depth){
  for(const [s,sign] of sides){
    p[s+"k"]=[sign*.151,.090,depth];
    p[s+"a"]=[sign*.151,.078,depth-.419];
    p[s+"t"]=[sign*.167,.034,depth-.554];
  }
  p.planted={};
}
function proneLegs(p,lift=0){
  for(const [s,sign] of sides){
    p[s+"k"]=add(p[s+"h"],[sign*.048,lift-.034,-.417]);
    p[s+"a"]=add(p[s+"k"],[sign*.033,lift-.021,-.420]);
    p[s+"t"]=add(p[s+"a"],[sign*.023,-.028,-.146]);
  }
  p.planted={};
}
function pullBoth(t,{mode}){
  const u=cycle(t,.40,.57);
  const prone=mode==="superman"||mode==="extension", row=mode==="row";
  const pull=mode==="superman", raise=mode==="raise", wring=mode==="wring";
  const p=body(prone?[0,.155,-.082]:row?[0,.804,-.180]:[0,.883,.028],
    prone?1.545-(pull?.238:.286)*u:row?1.063:.037,
    wring?.220*Math.sin(2*Math.PI*t):0);
  if(prone){proneLegs(p,(pull?.034:.128)*u);p.headAim=[0,-.20+.21*u,1];}
  else stance(p);
  for(const [s,sign] of sides){
    const fixedHalf=raise?.370:wring?.136:.278;
    const hinge=row?add(p.chest,[sign*.282,-.39+.334*u,.294-.143*u]):
      raise?[sign*(fixedHalf+.108*u),.802+.561*u,.223-.116*u]:
      pull?add(p.head,[sign*.269,-.012,.366-.567*u]):
      prone?add(p.head,[sign*.277,.010,.292]):
      add(p.chest,[sign*fixedHalf,.026+sign*.053*Math.sin(2*Math.PI*t),.336]);
    hands(p,s,hinge,[sign*.72,prone?.46:-.54,.16],wring?"neutral":prone?"down":"up");
  }
  return cloth(p,undefined,undefined,wring?1.36+1.35*Math.sin(2*Math.PI*t):0);
}

function anchoredRow(t,{mode}){
  const u=cycle(t,.43,.58), face=mode==="face", squat=mode==="squat";
  const hips=[face?0:-.117,squat?.605+.201*u:face?.853:.845,-.402+.269*u];
  const p=body(hips,-.38+.319*u,face?0:-.041);
  stance(p,{z:-.201,split:face?.105:.077});
  if(face){
    for(const [s,sign] of sides){
      const start=[sign*.103,1.376,.153], end=[sign*.226,1.400,.084];
      hands(p,s,blend(start,end,u),[sign*.89,-.197,-.408],"up");
    }
    return cloth(p,[0,1.383,.564],right);
  }
  const point=blend([-.050,.991,.149],add(p.chest,[-.18,-.103,.092]),u);
  hands(p,"r",point,[-.74,-.54,-.24],"neutral");
  arm(p,"l",add(p.chest,[.206,-.230,-.190]),[.621,-.36,.297]);
  return cloth(p,[0,.997,.570],right);
}

function lyingLoop(t,{mode}){
  const u=cycle(t,.42,.55);
  const chair=mode==="chair", seated=mode.startsWith("seated"), ham=mode==="hamstring";
  const plain=mode==="plain", one=mode==="single-reverse"||ham||chair;
  const grip=mode.includes("hammer")?"neutral":mode.includes("reverse")?"down":"up";
  const p=body(chair?[0,.568,-.214]:seated?[0,.152,-.302]:[0,.146,-.062],
    chair?.045:seated?-.276-.162*u:-Math.PI/2);
  p.planted={};
  for(const [s,sign] of sides){
    const idle=one&&s==="l";
    const knee=chair?idle?[.174,.508,.196]:[-.157,.668+.102*u,.166-.056*u]:
      seated?[sign*.144,.166+(mode==="seated-row"?0:.282*u),.098-.206*u]:
      idle?[sign*.154,.121,.355]:ham?[-.140,.489+.079*u,.157-.095*u]:
      plain?[sign*.143,.424,.238]:[sign*.139,.489+.112*u,.113-.101*u];
    const ankle=chair?idle?[.171,.083,.229]:[-.154,.227+.146*u,.281-.108*u]:
      seated?[sign*.164,.104+(mode==="seated-row"?0:.084+.105*u),.512-.310*u]:
      idle?[sign*.164,.083,.768]:ham?[-.132,.897+.074*u,.226-.066*u]:
      plain?[sign*.148,.079,.484]:[sign*.158,.209+.059*u,.427-.158*u];
    p[s+"k"]=add(p[s+"h"],scale(between(p[s+"h"],knee),.422));
    p[s+"a"]=add(p[s+"k"],scale(between(p[s+"k"],ankle),.424));
    p[s+"t"]=add(p[s+"a"],[sign*.018,ham&&s==="r"?.085:-.063,ham&&s==="r"?.120:.149]);
    const point=chair?[sign*.152,.794+.083*u,.286-.141*u]:
      seated?[sign*.192,.423-.011*u,.276-.484*u]:
      ham?[sign*.175,.345+.099*u,-.109-.133*u]:
      [sign*.193,.255+.191*u,-.078-.395*u];
    hands(p,s,point,[sign*.55,chair?-.67:.11,seated?-.38:-.972],grip);
  }
  const contact=chair?add(p.rk,[0,-.118,.005]):one?add(p.rt,[0,.023,.005]):add(center(p.lt,p.rt),[0,.015,.008]);
  return cloth(p,plain?undefined:contact,plain?undefined:[1,0,0]);
}

function behind(t,{mode}){
  const u=cycle(t,.42,.61);
  const rotation=mode==="rotation", down=mode==="down";
  const p=body([0,.878,.034],.029,0);
  stance(p);
  const high=rotation?[.246+.218*u,1.203,-.128]:[.032+.064*u,1.441+(down?-.130:.100)*u,-.221];
  const low=rotation?[-.071,.984,-.172]:[-.056,.993+(down?-.125:.118)*u,-.196];
  hands(p,"l",high,[.73,rotation?.131:.82,-.23],"neutral");
  hands(p,"r",low,[-.73,-.32,-.48],"neutral");
  return cloth(p);
}

function wallWork(t,{mode}){
  const u=cycle(t,.41,.58), side=["internal","external","iso"].includes(mode);
  const p=body([side?-.19:0,.872,.040+.188*u*(mode==="forward"?1:0)],mode==="forward"?.123+.154*u:.038,side?Math.PI*.47:0);
  stance(p,{z:.164,split:side?.055:.099});
  const px=mode==="external"?.026+.213*u:mode==="internal"?.116-.216*u:mode==="iso"?-.028-.014*u:.044;
  const y=mode==="serratus"?1.103+.369*u:mode==="forward"?1.196+.094*u:1.161;
  hands(p,"r",[px,y,.561],side?[-.52,-.747,-.09]:[-.61,-.815,-.08],
    mode==="iso"?"down":"neutral");
  if(mode==="serratus")hands(p,"l",[.257,y+.011,.561],[.609,-.809,.05],"neutral");
  else arm(p,"l",add(p.chest,[.272,-.390,-.059]),[.731,-.60,.08]);
  return cloth(p,mode==="serratus"?center(p.lw,p.rw):p.rw,right);
}

function floorHands(t,{mode}){
  const u=cycle(t,.43,.55), fly=mode==="fly", single=mode==="side", lever=mode==="lever";
  const kneeling=fly||mode==="kneeling-pull", pull=mode.endsWith("pull");
  const hips=kneeling?[single?-.024:0,.400-.107*u,-.394+.136*u]:
    [single?-.124*u:0,pull?.167+.180*u:lever?.406-.161*u:.379-.126*u,-.345+.101*u];
  const p=body(hips,(pull?1.39:1.36)+(.196+(lever?.141:0))*u);
  if(kneeling)kneel(p,-.559);
  else for(const [s,sign] of sides)foot(p,s,sign,[sign*.184,pull?.079:.103,-1.135+.102*u],[sign*.153,-.73,.09],[sign*.008,-.100,.071]);
  if(!kneeling)p.planted={};
  for(const [s,sign] of sides){
    const sliding=!single||s==="r";
    const x=sign*(.205+(fly||single ? (sliding?.434:0)*u :0));
    const z=pull?.560-.356*u:lever?.294+(s==="r"?.386:-.049)*u:.213+.049*u;
    hands(p,s,[x,.045,z],[sign*(fly?.44:.67),.648,lever?-.145:-.565],"down");
  }
  p.headAim=[0,-.344,1];
  return cloth(p,undefined,undefined,.328);
}

function floorFeet(t,{mode}){
  const u=cycle(t,.43,.55);
  const bridge=mode.startsWith("bridge");
  const reverse=mode==="bridge-reverse", single=mode==="bridge-single";
  if(bridge){
    const dig=reverse?u:1-u;
    const p=body([0,.355-.089*dig,-.232-.024*dig],-1.977+.267*dig);
    for(const [s,sign] of sides){
      if(single&&s==="l"){
        p.lk=add(p.lh,[.018,.306,.290]);
        p.la=add(p.lk,[.012,.243,.346]);
        p.lt=add(p.la,[.014,.112,.092]);
        delete p.planted.l;
      } else {
        const v2=mode==="bridge-v2";
        foot(p,s,sign,[sign*.167,floor,.442+.143*dig+(v2?.167:.093)*dig],[sign*.072,.92,.05],[.006,-.003,.154]);
      }
      hands(p,s,[sign*.365,.059,-.574],[sign*.727,.11,-.33],"down");
    }
    return cloth(p,undefined,undefined,.263);
  }
  if(mode==="leg-slide"||mode==="foot-crunch"){
    const crunch=mode==="foot-crunch";
    const p=body([.080+.049*u,.872-(crunch?0:.109)*u,.034],.058+(crunch?0:.259)*u);
    foot(p,"l",1,[.203,floor,.107],[.21,.09,.98]);
    foot(p,"r",-1,[-.138-(crunch?0:.508)*u,floor,.051-(crunch?0:.169)*u],
      [-.195,.12,.96],[-.013,-.070+(crunch?.043:0)*u,.151-(crunch?.043:0)*u]);
    for(const [s,sign] of sides)arm(p,s,add(p.chest,[sign*.28,-.422,.091]),[sign*.801,-.46,.11]);
    return cloth(p,undefined,undefined,crunch?.310-.104*u:.293);
  }
  const pike=mode==="pike", jack=mode==="jack";
  const p=body([0,.392+(pike?.415:0)*u,-.411+.092*u],1.426+(pike?.690:0)*u);
  p.planted={};
  for(const [s,sign] of sides){
    const knee=mode==="climber"?cycle((t+((s==="r")?.5:0))%1,.23,.50):0;
    const breadth=.138+(jack?.422*u:0);
    foot(p,s,sign,[sign*breadth,.100+.019*knee,-1.191+(pike?.492:0)*u+.545*knee],
      [sign*.207,-.862,.23],[sign*.044,-.095,.068]);
    hands(p,s,[sign*.207,.049,.205],[sign*.40,-.060,-.91],"down");
  }
  p.headAim=[0,-.383,1];
  return cloth(p,undefined,undefined,.271);
}

const upright=[56,16,[0,.88,.05],1.94], back=[133,15,[0,.89,.007],1.94], mat=[64,24,[0,.35,-.19],1.74],
  plank=[57,29,[0,.40,-.36],1.77], wall=[108,19,[0,.89,.16],1.96];
const items=[
  ["3828",pullBoth,"row","towel-hand",["lat","biceps"],upright],
  ["3829",pullBoth,"extension","towel-hand",["core","glute"],mat],
  ["3559",pullBoth,"superman","towel-hand",["core","lat"],mat],
  ["3741",pullBoth,"raise","towel-hand",["shoulder"],upright],
  ["3410",pullBoth,"wring","towel-hand",["forearm"],upright],
  ["3161",anchoredRow,"stand","towel-single-anchor",["r:lat","r:biceps"],upright],
  ["1773",anchoredRow,"squat","towel-single-anchor",["r:lat","r:biceps"],upright],
  ["7745",anchoredRow,"face","towel-anchor-high",["shoulder","trap"],upright],
  ["3558",lyingLoop,"plain","towel-hand",["biceps"],mat],
  ["3752",lyingLoop,"supine-biceps","towel-loop",["biceps"],mat],
  ["3830",lyingLoop,"supine-hammer","towel-loop",["biceps","forearm"],mat],
  ["3831",lyingLoop,"single-reverse","towel-loop",["forearm","biceps"],mat],
  ["1922",lyingLoop,"hamstring","towel-loop",["r:hamstring"],[70,19,[0,.49,-.10],1.83]],
  ["3848",lyingLoop,"seated-row","towel-loop",["lat","biceps"],mat],
  ["3851",lyingLoop,"seated-hammer","towel-loop",["biceps","forearm"],mat],
  ["3850",lyingLoop,"seated-reverse","towel-loop",["forearm","biceps"],mat],
  ["10542",lyingLoop,"chair","towel-loop-chair",["r:glute"],[57,17,[0,.72,.03],1.67]],
  ["10932",behind,"up","towel-hand",["shoulder"],back],
  ["2088",behind,"down","towel-hand",["shoulder"],back],
  ["10931",behind,"rotation","towel-hand",["l:shoulder"],back],
  ["10930",wallWork,"external","towel-wall",["r:shoulder"],wall],
  ["10929",wallWork,"internal","towel-wall",["r:shoulder"],wall],
  ["10927",wallWork,"forward","towel-wall",["r:shoulder","pec"],wall],
  ["10928",wallWork,"serratus","towel-wall",["pec","shoulder"],wall],
  ["10126",wallWork,"iso","towel-wall",["r:shoulder"],wall],
  ["3924",floorHands,"fly","towel-floor-hands",["pec","shoulder"],plank],
  ["3922",floorHands,"side","towel-floor-hands-single",["pec","triceps"],plank],
  ["7884",floorHands,"lever","towel-floor-hands",["pec","core"],plank],
  ["3497",floorHands,"prone-pull","towel-floor-hands",["lat","trap"],plank],
  ["4831",floorHands,"kneeling-pull","towel-floor-hands",["lat","trap"],plank],
  ["5156",floorFeet,"climber","towel-floor-feet",["core","quad"],plank],
  ["5158",floorFeet,"jack","towel-floor-feet",["core","quad"],plank],
  ["5165",floorFeet,"pike","towel-floor-feet",["core","shoulder"],plank],
  ["4897",floorFeet,"bridge-reverse","towel-floor-feet",["hamstring","glute"],mat],
  ["3514",floorFeet,"bridge-single","towel-floor-feet-single",["r:hamstring","r:glute"],mat],
  ["3498",floorFeet,"bridge","towel-floor-feet",["hamstring","glute"],mat],
  ["3395",floorFeet,"bridge-curl","towel-floor-feet",["hamstring","glute"],mat],
  ["3742",floorFeet,"bridge-v2","towel-floor-feet",["hamstring","glute"],mat],
  ["4380",floorFeet,"leg-slide","towel-floor-feet-single",["r:glute","r:adductor"],[24,17,[-.11,.85,.01],1.99]],
  ["9986",floorFeet,"foot-crunch","towel-floor-feet-single",["r:calf"],[57,26,[-.097,.29,.04],.94]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,render,mode,prop,muscles,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view;
  const camera={yaw,elevation,focus,height};
  const durationMs=mode==="climber"?5500:mode==="wring"?4700:render===wallWork?4900:4600;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{mode})}));
  const recipe=id+".json", data={version:1,equipment:"spotter-"+prop,durationMs,muscles,camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:mode==="wring"?.31:.46});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
