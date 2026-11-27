import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, torso, unit } from './bodyweight/pose.mjs';

const floor=.079, pi=Math.PI;
const standView={yaw:61,elevation:15,focus:[0,.89,.09],height:2.24};
const groundView={yaw:63,elevation:20,focus:[0,.59,.05],height:2.10};
function sole(p,side,s,at,y=0){
  leg(p,side,at,[s*.101,.09,1],[s*.013,-.072,.131],y);
}
function handsLoose(p,placement){
  for(const[side,s]of sides){
    const end=placement(p,s,side);
    arm(p,side,end,[s*.74,-.41,-.041],[s*.035,-.68,.723],[0,1,0]);
  }
}

function jefferson(phase) {
  const t=rep(phase,.430,.65);
  const pitch=.028+2.115*t;
  const p=stand([0,1.054-.145*t,.383-.145*t],pitch);
  p.neck[1]-=.070*t;p.neck[2]+=.076*t;
  p.head=add(p.neck,[0,.110*Math.cos(pitch+.44*t),.113*Math.sin(pitch+.44*t)]);
  for(const[side,s]of sides)sole(p,side,s,[s*.147,floor+.210,.407],.210);
  handsLoose(p,(_p,s,side)=>add(p[side+'s'],[s*.052,-.585,.10+.039*t]));
  return p;
}
function dropToSquat(phase){
  const reach=ramp(phase,.035,.23)*(1-ramp(phase,.32,.43));
  const squat=ramp(phase,.34,.485)*(1-ramp(phase,.69,.979));
  const p=stand([0,.857+.073*reach-.410*squat,.066-.151*squat],.052+.461*squat);
  for(const[side,s]of sides){
    const y=floor+.065*reach;
    leg(p,side,[s*.162,y,.109],[s*.156,.11,.89],[s*.015,-.071-.05*reach,.132],0);
    const shoulder=p[side+'s'];
    arm(p,side,add(shoulder,[s*(.085+.031*reach),-.551+1.12*reach+.489*squat,.071+.461*squat]),
      [s*.70,-.60,-.23],[0,.28*reach-.35*squat,.96]);
  }
  return p;
}
function sideAngle(phase){
  const sign=phase<.5?1:-1,hold=rep((phase*2)%1,.27,.71);
  const w=.422+.144*hold;
  const p=stand([sign*.331*hold,.852-.225*hold,.041],.04+.265*hold,sign*.061*hold,sign*.957*hold);
  for(const[side,s]of sides){
    const toward=s===sign;
    const z=toward?.253:-.102;
    leg(p,side,[s*w,floor,z],[s*.43,-.195,.85],[s*.091*(toward?1:.25),-.073,.102],0);
  }
  for(const[side,s]of sides){
    const target=s===sign?add(p[side+'k'],[s*.037,.138,-.139]):
      add(p[side+'s'],[sign*.459*hold,.54-.206*hold,.221]);
    arm(p,side,target,[s*.827,-.346,-.292],[sign*.708,.351,.615],[0,1,0]);
  }
  return p;
}
function trapRaise(phase){
  const active=phase<.5?'l':'r';
  const t=rep((phase*2)%1,.26,.68);
  const p=stand([0,.164,-.347],1.567);
  p.head[1]-=.048;
  for(const[side,s]of sides){
    legAngles(p,side,s,-3.091,-3.04,.011);
    const raise=side===active?t:0;
    const shoulder=p[side+'s'];
    arm(p,side,add(shoulder,[s*(.144+.195*raise),-.083+.304*raise,.471+.031*raise]),
      [s*.45,-.73,-.35],[s*.551,.093,.824],[s*.75,.35,-.46]);
  }
  return p;
}
function pushPull(phase) {
  const a=2*pi*phase,swing=Math.sin(a);
  const p=stand([0,.858,.019],.052,.406*swing);
  for(const[side,s]of sides){
    sole(p,side,s,[s*.177,floor,s*.064]);
    const u=(1+s*swing)/2;
    arm(p,side,add(p[side+'s'],[s*mix(.101,-.032,u),mix(-.173,-.029,u),mix(.003,.596,u)]),
      [s*.79,-.41,-.429],[0,.11,.99]);
  }
  return p;
}
function birdDog(phase) {
  const t=rep(phase,.412,.598);
  const p=stand([0,.491+.024*t,-.188-.027*t],1.56);
  p.rk=[-.142,.091,-.193];p.ra=[-.156,.070,-.619];p.rt=[-.170,.045,-.735];
  const slide=[.142,.098,-.621-.370*t];
  leg(p,'l',slide,[.144,-.78,.354],[.012,-.076,-.121],.030);
  arm(p,'l',[.212,.082,.371],[.72,-.38,-.53],[.032,-.063,1],[0,1,0]);
  arm(p,'r',blend([-.214,.083,.369],[-.194,.509,1.015],t),[-.58,-.44,-.69],[0,-.032,1],[0,1,0]);
  return p;
}

function stairWalking(phase){
  const lead=ramp(phase,.08,.34),follow=ramp(phase,.27,.58),last=ramp(phase,.53,.82);
  const a=[.142,floor,-.154], b=[.142,floor+.184,.277], c=[.142,floor+.365,.595];
  const d=[-.141,floor,-.166], e=[-.138,floor+.365,.592];
  const slide=(from,to,x)=>blend(from,to,x).map((n,i)=>i===1?n+.096*Math.sin(pi*x):n);
  const x=-.034*Math.sin(pi*phase*4);
  const p=stand([x,.858+.184*ramp(phase,.22,.54)+.181*ramp(phase,.52,.87),mix(-.132,.553,ramp(phase,.16,.91))],.12);
  sole(p,'l',1,last>.001?slide(b,c,last):slide(a,b,lead),
    lead<.002?0:last>.997?.365:lead>.998&&last<.001?.184:undefined);
  sole(p,'r',-1,slide(d,e,follow),follow<.002?0:follow>.998?.365:undefined);
  for(const[side,s]of sides)arm(p,side,add(p[side+'s'],[s*.061,-.516,.104+s*.402*Math.sin(2*pi*phase)]),
    [s*.56,-.72,-.17],[0,-.25,.968]);
  return p;
}
function latWalkout(phase){
  const t=rep(phase,.415,.571);
  const down=ramp(t,0,.45),long=ramp(t,.45,.99);
  const pitch=mix(.031,1.932,down)-.219*long;
  const p=stand([0,.858-.211*down-.239*long,-.339-.013*long],pitch);
  for(const[side,s]of sides){
    sole(p,side,s,[s*.157,floor,-.371]);
    const alternate=(side==='l'?.070:-.065)*Math.sin(pi*long);
    const dest=[s*.203,range(down,long),.065+.676*long+alternate];
    arm(p,side,down>.96?dest:blend(add(p[side+'s'],[s*.074,-.554,.099]),dest,down),[s*.62,-.405,.35],[0,-.07,1],[0,1,0]);
  }
  return p;
}
function range(down,long){return .074+(1-down)*.08+.059*Math.sin(pi*long);}
function wallWalk(phase){
  const progress=rep(phase,.39,.64);
  const line=mix(-.371,1.395,progress);
  const footBase=.607+1.333*Math.sin(line);
  const pelvis=[0,.611+.504*Math.sin(line),.445-.824*Math.cos(line)];
  const p=stand(pelvis,pi/2+line,pi);
  for(const[side,s]of sides) {
    const step= .093*Math.sin(pi*progress)*Math.sin(6*pi*progress+(s<0?pi:0));
    leg(p,side,[s*.123,Math.max(.115,footBase+step),.425],[s*.099,-.509,-.094],[s*.012, .025, .084]);
    const handZ=p[side+'s'][2]-.136*(1-progress)+.117*step/.093;
    arm(p,side,[s*.204,.076+Math.max(0,step)*.542,handZ],[s*.71,-.73,.098],[s*.031,-.066,-1],[0,1,0]);
  }
  return p;
}

const rows=[
  ['10752',jefferson,'gym-box-low',['core','hamstring'],{...standView,yaw:71},6170],
  ['11784',dropToSquat,'none',['quad','glute'],{...standView,yaw:33,height:2.50},4060],
  ['5220',sideAngle,'none',['core','quad','adductor'],{...standView,yaw:14,height:2.53},6370],
  ['2940',trapRaise,'mat',['trap','rearShoulder'],{...groundView,yaw:47,elevation:26,focus:[0,.29,-.24],height:1.76},6370],
  ['1689',pushPull,'none',['pec','rearShoulder'],{...standView,yaw:28},4300],
  ['4416',birdDog,'slide-disc',['core','glute','shoulder'],{...groundView,yaw:57},4700],
  ['3009',stairWalking,'gym-box-stairs',['quad','glute'],{...standView,yaw:57,height:2.62},5030],
  ['10590',latWalkout,'mat',['lat','shoulder'],{...standView,yaw:72,focus:[0,.87,.113]},6340],
  ['5234',wallWalk,'handstand-wall',['core','shoulder'],{...standView,yaw:-103,focus:[0,1.04,-.186],height:2.67},6110],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row[0])):rows;
if(new Set(selected.map(row=>row[0])).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const [id,motion,equipment,muscles,camera,durationMs] of selected){
  const recipe={version:1,equipment,muscles,durationMs,camera,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:.467});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
