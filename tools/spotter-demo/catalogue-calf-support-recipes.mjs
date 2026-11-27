import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, grip, leg, mix, ramp, rep, sides, torso } from './bodyweight/pose.mjs';

const pi=Math.PI;

function pushedToe(pose,limb,toe,angle){
  const sign=limb==='l'?1:-1;
  const ankle=add(toe,[-sign*.010,.164*Math.sin(angle),-.164*Math.cos(angle)]);
  leg(pose,limb,ankle,[sign*.14,.87,.49],[sign*.01,-.064,.138]);
  pose[limb+'t']=toe;
}

function calfStep(phase,{kind}){
  const single=kind!=='drops';
  const calf=kind==='calf';
  const move=rep(phase,single?.29:.43,single?.73:.59);
  const rise=single?0:.04;
  const hipY=single?mix(.985,.938,move)-(calf?.024:0):mix(.927,1.033,move);
  const body=torso([single?.033:0,hipY,.159+.036*move],.032+(calf?.061:0));
  for(const [limb,sign] of sides){
    const free=single&&sign===-1;
    if(free)leg(body,limb,[sign*.144,.340+.022*move,.077],[sign*.28,.31,.94],[sign*.018,-.055,.132]);
    else pushedToe(body,limb,[sign*.136,.126,.246+rise],single?mix(.310,-.217,move):mix(-.264,.802,move));
    grip(body,limb,[sign*.415,1.362,.401],[sign*.75,-.53,-.33],[0,0,1]);
  }
  return body;
}

function elevatedSeatedCalf(phase){
  const rise=rep(phase,.43,.59);
  const pose=torso([0,.562,-.254],.108+.026*rise);
  for(const [limb,sign] of sides){
    pushedToe(pose,limb,[sign*.142,.134,.403],mix(-.219,.814,rise));
    const near=add(pose[limb+'k'],[sign*.022,.062,-.066]);
    arm(pose,limb,near,[sign*.76,-.36,-.49],[sign*.060,-.29,.955],[1,0,0]);
  }
  return pose;
}

function seatedAnkle(phase,{kind}){
  const amount=rep(phase,.43,.64);
  const lower=kind==='lower'||kind==='front';
  const slide=kind==='slide';
  const body=torso([0,.527,-.443],.039);
  for(const [limb,sign] of sides){
    arm(body,limb,[sign*.147,.599,-.021],[sign*.59,-.66,-.35],[sign*.02,-.16,.97],[sign,0,0]);
  }
  if(slide){
    const rear=rep(phase,.86,.92);
    leg(body,'l',[.147,.076+.040*rear,mix(.087,.364,amount)],[.12,.46,.92],[.012,-.071-.012*rear,.131],rear>.001?null:0);
    leg(body,'r',[-.153,.076,.094],[-.16,.46,.91],[-.017,-.073,.140],0);
    return body;
  }
  const overlap=kind==='front'?.043:-.108;
  const wrist=.071*amount;
  leg(body,'l',[overlap,.194+(lower?wrist:.019*amount),.172-.052*amount],[.87,.73,.48],
    [.024,-.069+(lower?-.33:.94)*wrist,.138],null);
  leg(body,'r',[-.129,.077,.221],[-.17,.14,.98],[-.018,-.073+(lower?.126*amount:.037*amount),.139],null);
  return body;
}

function crouchedAchilles(phase){
  const bend=rep(phase,.29,.72);
  const body=torso([0,.407-.059*bend,.018-.030*bend],.907+.163*bend);
  for(const [limb,sign] of sides){
    const front=sign===1;
    const heel=front?[.176,.077,.415]:[-.141,.076,-.621];
    leg(body,limb,heel,[sign*.23,front?.71:.051,front?.53:.98],[sign*.014,-.073,.139],0);
    arm(body,limb,[sign*.260,.069,.585],[sign*.75,-.30,-.52],[sign*.026,-.039,.995],[1,0,0]);
  }
  return body;
}

function scapulaBenchDip(phase){
  const pulse=rep(phase,.42,.63);
  const body=torso([0,.497+.079*pulse,.111+.025*pulse],-.014-.046*pulse);
  for(const [limb,sign] of sides){
    leg(body,limb,[sign*.163,.077,.672],[sign*.38,.82,.44],[sign*.017,-.071,.134],0);
    body[limb+'s']=[sign*.191,1.073-.012*pulse,.009];
    arm(body,limb,[sign*.196,.487,-.160],[sign*.33,-.44,-.83],[sign*.066,-.05,1],[sign,0,0]);
  }
  return body;
}

function supportedArmsStretch(phase,{inclined}){
  const stretch=rep(phase,.29,.72);
  const pitch=inclined?mix(.481,1.306,stretch):.046+.101*stretch;
  const hips=inclined?[0,.814-.085*stretch,-.232-.209*stretch]:[0,.578-.098*stretch,.045+.077*stretch];
  const pose=torso(hips,pitch);
  for(const [limb,sign] of sides){
    const ankle=[sign*.157,.076,inclined?-.371:.457];
    leg(pose,limb,ankle,[sign*.18,.59,.59],[sign*.012,-.074,.136],0);
    const target=[sign*(inclined?.188:.178),inclined?1.054:.481,inclined?.491:-.158];
    arm(pose,limb,target,[sign*.57,-.42,-.73],[sign*.062,-.067,inclined?.995:-.995],[sign,0,0]);
  }
  return pose;
}

function shoulderPendulum(phase){
  const swing=Math.sin(phase*6*pi);
  const circle=ramp(phase,.20,.56);
  const bow=torso([0,.742+.016*swing,-.192],1.097+.021*swing);
  for(const [limb,sign] of sides){
    leg(bow,limb,[sign*.180,.076,.067],[sign*.18,.09,.98],[sign*.015,-.074,.138],0);
  }
  arm(bow,'l',[.464,.465,.264],[.47,-.53,-.46],[.021,-.067,.99],[1,0,0]);
  const shoulder=bow.rs;
  const wrist=add(shoulder,[-.018+.117*circle*Math.cos(phase*6*pi),-.588,.159*swing]);
  arm(bow,'r',wrist,[-.43,.17,-.56],[.084,-.985,.081],[-1,0,0]);
  return bow;
}

function concentrationLeg(phase,{negative}){
  const pull=negative?rep(phase,.20,.35):rep(phase,.41,.61);
  const body=torso([0,.539,-.202],1.107-.093*pull);
  leg(body,'l',[.267,.076,.374],[.79,.62,.27],[.027,-.067,.149],0);
  leg(body,'r',[-.156,mix(.076,.407,pull),mix(.388,.485,pull)],[-.18,.91,.58],[-.021,-.071,.140],pull<.001?0:null);
  body.le=[.176,negative?.556:.498,.261];
  body.lw=negative?add(body.rk,[.044,-.027,-.011]):add(body.ra,[.029,.060,-.030]);
  body.lGrip=negative?[0,0,1]:[0,1,0];
  arm(body,'r',[-.218,.480,.004],[-.71,-.13,-.64],[0,-.88,.27],[-1,0,0]);
  return body;
}

function elevatedTriceps(phase,{overhead}){
  const drop=rep(phase,.43,.60);
  const pitch=mix(overhead?.710:.756,overhead?.982:1.052,drop);
  const anchor=overhead?-1.147:-1.035;
  const pose=torso([0,.078+.825*Math.cos(pitch),anchor+.825*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.141,.078,anchor],[sign*.15,.41,.41],[sign*.008,-.071,.146],0);
    grip(pose,limb,[sign*.223,overhead?1.057:.886,overhead?.312:.446],[sign*.26,-.29,.88],[1,0,0]);
  }
  return pose;
}

function deficitWallSit(phase){
  const sit=rep(phase,.28,.73);
  const pose=torso([0,mix(.944,.576,sit),-.568+.026*sit],.018-.026*sit);
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.171,.197,-.263],[sign*.27,-.063,.94],[sign*.018,-.072,.141],.122);
    arm(pose,limb,[sign*.200,mix(.965,.647,sit),-.265+.085*sit],[sign*.43,-.65,-.27],[0,-.28,.959],[sign,0,0]);
  }
  return pose;
}

const standing={yaw:61,elevation:13,focus:[0,.96,.25],height:2.35};
const seated={yaw:64,elevation:14,focus:[0,.64,.09],height:1.72};
const railCalfCamera={yaw:112,elevation:13,focus:[0,.88,.242],height:2.20};
const jobs=[
  ['1890',crouchedAchilles,{},'none',['r:calf'],{...seated,yaw:70,focus:[0,.51,.055]},5500,.5],
  ['4900',elevatedSeatedCalf,{},'seated-calf-raise-bench',['calf'],{...seated,yaw:65},4600,.5],
  ['3872',calfStep,{kind:'drops'},'calf-step-rail-low',['calf'],railCalfCamera,4700,.53],
  ['1886',calfStep,{kind:'achilles'},'calf-step-rail-low',['l:calf'],railCalfCamera,5600,.52],
  ['1925',calfStep,{kind:'calf'},'calf-step-rail-low',['l:calf'],{...railCalfCamera,yaw:117},5600,.52],
  ['5481',seatedAnkle,{kind:'slide'},'gym-chair-rear',['l:calf','l:shin'],seated,4750,.5],
  ['10535',seatedAnkle,{kind:'lower'},'gym-chair-rear',['r:shin'],{...seated,yaw:55},4850,.5],
  ['10917',seatedAnkle,{kind:'upper'},'gym-chair-rear',['l:shin'],{...seated,yaw:47},4850,.5],
  ['6759',seatedAnkle,{kind:'front'},'gym-chair-rear',['r:shin'],{...seated,yaw:59},4800,.5],
  ['3012',scapulaBenchDip,{},'dip-bench',['shoulder','trap'],{...seated,yaw:59,focus:[0,.66,.18]},4500,.51],
  ['1817',supportedArmsStretch,{inclined:false},'dip-bench',['biceps','shoulder'],{...seated,yaw:70,focus:[0,.72,.11]},5400,.49],
  ['1405',supportedArmsStretch,{inclined:true},'stretch-incline-bench',['pec','lat'],{...standing,yaw:70,focus:[0,.96,.08]},5400,.48],
  ['6438',shoulderPendulum,{},'gym-bench-side',['r:shoulder'],{...seated,yaw:-55,focus:[.24,.76,.08],height:1.90},5500,.51],
  ['1770',concentrationLeg,{negative:false},'gym-bench-flat',['l:biceps'],{...seated,yaw:36,focus:[0,.62,.06]},4850,.50],
  ['8084',concentrationLeg,{negative:true},'gym-bench-flat',['l:biceps'],{...seated,yaw:42,focus:[0,.62,.06]},5500,.29],
  ['4667',elevatedTriceps,{overhead:true},'fixed-back-stretch-bar',['triceps'],{...standing,yaw:66,focus:[0,.82,-.27],height:2.03},4700,.50],
  ['0816',elevatedTriceps,{overhead:false},'fixed-triceps-press-bar',['triceps'],{...standing,yaw:61,focus:[0,.78,-.22],height:1.99},4700,.50],
  ['7558',deficitWallSit,{},'deficit-wall-sit',['quad','glute'],{...standing,yaw:62,focus:[0,1.05,-.38]},5500,.50],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or repeated calf-support ID.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const [id,animate,config,equipment,muscles,camera,durationMs,posterAt] of selected){
  try{
    const keyframes=Array.from({length:49},(_,index)=>({at:index/48,...animate(index/48,config)}));
    const asset={version:1,durationMs,equipment,muscles,camera,keyframes};
    prepareRecipe(asset);
    const recipe=id+'.json';
    await writeFile(resolve(output,recipe),JSON.stringify(asset)+'\n');
    items.push({id,recipe,posterAt});
  }catch(error){failures.push({id,reason:error.message});}
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
