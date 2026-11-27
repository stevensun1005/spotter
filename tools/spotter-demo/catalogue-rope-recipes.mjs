import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, blend, grip, leg, legAngles, mix, ramp, rep, sides, stand } from './bodyweight/pose.mjs';

const rows=[];
const floor=.079;
const upright={yaw:56,elevation:14,focus:[0,1.06,0],height:2.40};
const waveCamera={yaw:70,elevation:16,focus:[0,.90,.91],height:2.17};
const climbCamera={yaw:37,elevation:12,focus:[0,1.43,.07],height:3.04};
const matCamera={yaw:68,elevation:21,focus:[0,.55,0],height:1.81};

function register(movement,equipment,muscles,camera,variants) {
  for(const [id,variant] of variants) rows.push({id,movement,variant,equipment:variant.equipment??equipment,
    muscles:variant.muscles??muscles,camera:{...camera,...variant.camera}});
}

function planted(pose,side,s,target,air=false,rear=false) {
  leg(pose,side,target,[s*.18,-.03,1],[s*.014,rear?-.095:-.072,rear?.095:.131], air?undefined:0);
}

function ropeWave(phase,{stance,kind='alt'}) {
  const theta=2*Math.PI*phase;
  const dance=stance==='side-lunge'||stance==='reverse';
  const acting=phase<.5?1:-1;
  const half=(phase*2)%1;
  const t=dance?rep(half):rep(phase);
  const seat=stance==='seat'||stance==='twist';
  const kneel=stance==='kneel'||stance==='half';
  const getUp=stance==='get-up';
  const stride=stance==='split'||stance==='jump-split';
  const jump=stance==='jump-squat'||stance==='jack'||stance==='jump-split';
  const side=stance==='side-lunge';
  const rear=stance==='reverse';
  const vertical=jump?.192*Math.sin(Math.PI*ramp(half,.22,.72)):0;
  const slowSwitch=ramp(half,.24,.63);
  const continuousSide=acting*(1-2*slowSwitch);
  const land=jump ? Math.max(0,Math.cos(theta*2)) : 0;
  const sit= stance==='squat'?.265+.045*t:stance==='jump-squat'?.272*land:stance==='low'?.226:
    stance==='jack'?.059*land:stance==='jump-split'?.238*land:side||rear?.319*t:kind==='slam'?.216*t:.101;
  const y=seat?.121:kneel?.453:getUp?mix(.442,.851,t):.876-sit+vertical;
  const z=seat?.044:kneel?-.113:getUp?-.132+.18*t:-.033-(rear?.111*t:.072*sit);
  const x=side?acting*.441*t:0;
  const rot=stance==='twist'? .628*Math.sin(theta):kind==='side'? .343*Math.sin(theta):0;
  const pitch=seat?-.384:kneel?.085:kind==='slam'?.075+.53*t:.073+.54*sit;
  const pose=stand([x,y,z],pitch,rot);
  const paths=[];
  for(const[limb,s]of sides){
    const waveTheta=theta*(kind==='low'?5:kind==='alt'?3:2) +(kind==='alt'||kind==='low' ? (s<0?Math.PI:0):0);
    const wave=(Math.cos(waveTheta)+1)*.5;
    const fly=kind==='fly'||kind==='raise';
    const circle=kind==='in'||kind==='out';
    const open=cycleOpening(half);
    const kneeDown=kneel&&(stance==='kneel'||limb==='r');
    if(kneeDown||(getUp&&t<.20&&limb==='r')){
      pose[limb+'k']=[s*.142,.092,.025+t*.04];
      pose[limb+'a']=[s*.150,.071,-.398+t*.02];
      pose[limb+'t']=[s*.164,.041,-.518+t*.02];
    }else {
      const wide=stance==='jack'? .088+.225*open:stance==='squat'?.207:.156;
      const back=rear&&s===acting;
      const lateral=side&&s===acting;
      const sideStep=lateral?acting*.497*t:0;
      const forward=seat?s*.02+.615:stride?s*continuousSide*.288:0;
      const footLift=(back||lateral)?.070*Math.sin(Math.PI*t):0;
      planted(pose,limb,s,[s*wide+sideStep,floor+vertical+footLift+(back?.018*t:0),
        forward+(getUp&&limb==='l'?.35:stance==='half'&&limb==='l'?.413:.090)-(back?.610*t:0)],
        vertical>.004||footLift>.013,back);
    }
    const s0=pose[limb+'s'];
    const adjustment=stance==='jack'?open:fly?wave:0;
    const sideways=kind==='side'||stance==='twist' ? Math.sin(theta)*.343:0;
    const loop=circle ? (kind==='in'?1:-1)*Math.sin(waveTheta):0;
    const wx=s0[0]+s*(circle?.153+.130*loop:fly?.025+.485*adjustment:stance==='jack'?.025+.397*adjustment:.083)+sideways;
    const wy=kind==='slam' ? mix(s0[1]+.560,s0[1]-.447,t):
      kind==='high' ? s0[1]+mix(-.337,.555,wave):
      stance==='jack'? s0[1]+mix(-.435,.377,adjustment):
      fly? s0[1]+mix(-.387,kind==='raise'?.125:-.072,adjustment):
      s0[1]+(kind==='low'?mix(-.48,-.287,wave):circle?mix(-.388,.14,wave):mix(-.463,.035,wave));
    const wz=s0[2]+(kind==='slam'?mix(.090,.507,t):fly?mix(.442,.084,adjustment):
      kind==='high'?mix(.421,.087,wave):circle?.376+.089*Math.cos(waveTheta):.351+.074*wave);
    const target=[wx,wy,wz];
    grip(pose,limb,target,[s*.729,-.61,-.295],[0,0,1]);
    const hand=add(pose[limb+'w'],[0,-.019,.029]);
    const anchor=[s*.021,.126,1.990];
    paths.push(Array.from({length:25},(_,i)=>{
      const u=i/24;
      const p=blend(hand,anchor,u);
      if(i===0||i===24)return p;
      const trough= Math.sin(Math.PI*u)**.8 * (1-u)**.88;
      const waveAmount=kind==='low'?.141:kind==='slam'||kind==='high'?.426:.279;
      const waveAt= waveTheta-u*Math.PI*4.6;
      return [p[0]+(fly||circle||kind==='side'?.108:.019)*trough*Math.sin(waveAt),
        Math.max(.024,p[1]-.34*Math.sin(Math.PI*u)+waveAmount*trough*Math.cos(waveAt)),p[2]];
    }));
  }
  pose.ropeTracks=paths;
  return pose;
}

function cycleOpening(p) {
  return ramp(p,.03,.31)*(1-ramp(p,.67,.97));
}

function horizontalPull(phase,{sled}) {
  const a=2*Math.PI*phase;
  const v=Math.sin(a);
  const pose=stand([0,sled?.723:.763,-.22+.033*Math.cos(a)],-.065, .144*v);
  planted(pose,'l',1,[.199,floor,.151]);
  planted(pose,'r',-1,[-.181,floor,-.442]);
  for(const[side,s]of sides){
    grip(pose,side,[.011+s*.049,.971+s*.049*v,.119+s*.356*v],[s*.63,-.68,-.232],[0,.25,1]);
  }
  const inFront=pose.lw[2]>pose.rw[2]?pose.lw:pose.rw;
  const behind=inFront===pose.lw?pose.rw:pose.lw;
  const load=[.012,sled?.165:.121,sled?1.655-.163*rep(phase):1.733];
  pose.ropeTracks=[[
    add(behind,[0,-.291,-.339]),add(behind,[0,-.067,-.078]),behind,inFront,
    blend(inFront,load,.52).map((n,i)=>i===1?n-.121:n),load,
  ]];
  return pose;
}

function ropeHang(phase,{kind,dual}) {
  const climbing=kind==='climb'||kind==='l-climb';
  const bridge=kind==='bridge';
  const row=kind==='row'||bridge;
  const t=rep(phase,.42,.56);
  const sign=phase<.5?1:-1;
  const swap=rep((phase*2)%1,.37,.55);
  const gy=climbing?1.080+.555*t:row ? .579+.265*t:1.033+.454*t;
  const gz=row?.242-.335*t:.087+.034*t;
  const pitch=row?mix(-1.00,-.53,t):.026-.081*t;
  const pose=stand([0,gy,gz],pitch,0,climbing?sign*.037*swap:0);
  for (const [side,s] of sides) {
    const pl=s*sign;
    if(row) planted(pose,side,s,[s*.144,floor,.757+(bridge?s*.108:0)]);
    else if(kind==='l-climb'){
      legAngles(pose,side,s,-.20,-.229,.011);
    }else{
      legAngles(pose,side,s,-1.54+(climbing?.14*swap:0),-1.69,(kind==='climb'&&!dual?.018:.023));
    }
    const y=row ? (bridge?1.392+s*.139:1.431):climbing?2.117+pl*.186*swap:2.117;
    const x=dual ? s*.224 : s*.043;
    const z=row?.317:.223;
    grip(pose,side,[x,y,z],[s*.77,-.65,-.391],[0,1,0]);
  }
  if(dual){
    pose.ropeTracks=sides.map(([side,s])=>{
      const gl=pose[side+'w'];
      return [[s*.224,2.617,.262],gl,add(gl,[0,-.113,.01]),
        [s*.224,climbing?.233:.476,.287]];
    });
  }else{
    const top=pose.lw[1]>pose.rw[1]?pose.lw:pose.rw;
    const bottom=top===pose.lw?pose.rw:pose.lw;
    pose.ropeTracks=[[[0,2.617,.262],top,bottom,add(bottom,[0,-.505,.088]),[0,.168,.322]]];
  }
  return pose;
}

function skipRope(phase,{double}) {
  const count=double?2:3;
  const travel=phase*count;
  const cycle=travel%1;
  const lift=(double?.282:.157)*Math.sin(Math.PI*ramp(cycle,.29,.91));
  const squat=.077*Math.max(0,Math.cos((cycle-.11)*Math.PI*2))*(1-lift*2.8);
  const stride=double?0:.058*Math.cos(2*Math.PI*phase);
  const pose=stand([0,.866+lift-squat,.013],.038+.115*squat);
  for(const[side,s]of sides){
    planted(pose,side,s,[s*.137,floor+lift,s*stride+.053],lift>.003);
    const angle=travel*(double?2:1)*Math.PI*2;
    const wrist=add(pose[side+'s'],[s*.133,-.509+.022*Math.cos(angle),.132+.021*Math.sin(angle)]);
    grip(pose,side,wrist,[s*.23,-.88,-.36],[0,0,1]);
  }
  pose.machineTravel=travel*(double?2:1);
  return pose;
}

function heldStretch(phase,{style}) {
  const [lead,t]=[phase<.5?'l':'r',rep((phase*2)%1,.26,.69)];
  const quad=style==='quad';
  const raise=style==='raise';
  const pose=stand(raise?[0,.856,0]:[0,.16,0],raise?.018:quad?1.555:-1.548);
  for(const[side,s]of sides){
    if(raise){
      planted(pose,side,s,[s*.146,floor,.049]);
      const reach=side===lead?t:0;
      grip(pose,side,add(pose[side+'s'],[s*.037,mix(-.563,.131,reach),mix(.065,.590,reach)]),
        [s*.672,-.60,-.20],[1,0,0]);
    }else if(quad){
      legAngles(pose,side,s,-3.07,side===lead?mix(3.11,.95,t):3.11,.022);
      grip(pose,side,[s*.150,.199+ .045*t,.717],[s*.63,-.23,-.57],[1,0,0]);
    }else{
      const flex=side===lead?t:0;
      const angle=mix(-.063,1.416,flex);
      legAngles(pose,side,s,angle,angle-.032,.017);
      grip(pose,side,[s*.151,.175+.38*t,.045+.151*t],[s*.61,-.18,.33],[0,1,0]);
    }
  }
  const foot=blend(pose[lead+'a'],pose[lead+'t'],.56);
  const ll=pose.lw, rr=pose.rw;
  pose.ropeTracks=raise?[[ll,blend(ll,rr,.5).map((n,i)=>i===1?n-.335:n),rr]]:
    [[ll,add(foot,[-.047,0,.005]),add(foot,[0,.038,.035]),add(foot,[.047,0,.005]),rr]];
  return pose;
}

function harnessDrag(phase) {
  const a = Math.PI*2*phase;
  const reach=.203*Math.cos(a);
  const t=rep(phase);
  const pose=stand([0,.808+.028*t,.061+.071*t],.649+.092*t);
  for(const[side,s]of sides){
    const lift=Math.max(0,s*Math.sin(a))*.106;
    planted(pose,side,s,[s*.119,floor+lift,.039+s*reach],lift>.005);
    const hand=add(pose.chest,[s*.198,-.041,.105+s*.170*Math.sin(a)]);
    grip(pose,side,hand,[s*.79,-.44,-.31],[0,-.29,1]);
  }
  const front=add(pose.chest,[0,.014,.129]);
  const rear=add(pose.chest,[0,-.023,-.135]);
  const tail=[0,.476,-1.199+.024*t];
  pose.ropeTracks=[[
    pose.lw,front,pose.rw,add(rear,[-.170,.020,.048]),rear,add(rear,[.180,.019,-.021]),
    [0,.824,-.445],tail,
  ]];
  return pose;
}

register(ropeWave,'battle-ropes',['core','shoulder','forearm'],waveCamera,[
  ['3370',{stance:'jump-squat',muscles:['quad','shoulder']}],
  ['3372',{stance:'side-lunge',camera:{yaw:65},muscles:['quad','adductor','shoulder']}],
  ['3369',{stance:'squat',camera:{yaw:74}}],
  ['4131',{stance:'get-up',camera:{yaw:57},duration:5480}],
  ['3375',{stance:'base',kind:'fly',muscles:['pec','shoulder'],camera:{yaw:30,focus:[0,.93,.81],height:2.32}}],
  ['4052',{stance:'half',camera:{yaw:62}}],
  ['3379',{stance:'base',kind:'high',camera:{yaw:69,focus:[0,1.15,.82],height:2.63}}],
  ['3373',{stance:'base',kind:'in',camera:{yaw:59}}],
  ['3376',{stance:'jack',camera:{yaw:65,focus:[0,1,.88],height:2.38}}],
  ['3380',{stance:'low',kind:'low',camera:{yaw:73}}],
  ['3374',{stance:'base',kind:'out',camera:{yaw:60}}],
  ['3384',{stance:'base',kind:'slam',muscles:['lat','core','quad'],camera:{yaw:71,focus:[0,1.10,.97],height:2.60}}],
  ['3377',{stance:'twist',kind:'side',camera:{yaw:60,focus:[0,.60,.83],height:1.92}}],
  ['4112',{stance:'seat',camera:{yaw:64,focus:[0,.61,.86],height:1.92}}],
  ['2828',{stance:'base',kind:'raise',camera:{yaw:24,focus:[0,.94,.79],height:2.32}}],
  ['3371',{stance:'base',kind:'side',camera:{yaw:68}}],
  ['3378',{stance:'jump-split',camera:{yaw:71},muscles:['quad','glute','shoulder']}],
  ['2929',{stance:'kneel',camera:{yaw:66,focus:[0,.78,.83],height:2.07}}],
  ['2933',{stance:'reverse',camera:{yaw:67},muscles:['quad','glute','shoulder']}],
]);
register(horizontalPull,'battle-pull-rope',['lat','biceps','forearm'],waveCamera,[
  ['8703',{camera:{yaw:64}}],['2709',{sled:true,equipment:'sled-pull-rope',camera:{yaw:72}}],
]);
register(ropeHang,'climb-pair-ropes',['lat','biceps','forearm'],climbCamera,[
  ['11715',{kind:'row',dual:true,camera:{yaw:-19,focus:[0,1.30,.34],height:3.19}}],
  ['11714',{kind:'pull',dual:true}],
  ['10731',{kind:'l-climb',equipment:'climb-rope',duration:6020,camera:{yaw:-31}}],
  ['0609',{kind:'bridge',equipment:'climb-rope',camera:{yaw:-17,focus:[0,1.30,.32],height:3.15}}],
  ['10439',{kind:'climb',dual:true,duration:6020,camera:{yaw:14}}],
]);
register(skipRope,'rig-jump-rope',['calf','core'],upright,[
  ['5038',{double:true,camera:{yaw:36},duration:3550}],
  ['4829',{double:false,camera:{yaw:40},duration:4140}],
]);
register(heldStretch,'mat-stretch-rope',['quad'],matCamera,[
  ['1564',{style:'quad',duration:6150,camera:{yaw:67}}],
  ['1582',{style:'toe',duration:6250,muscles:['hamstring','calf'],camera:{yaw:61,focus:[0,.62,.13],height:1.93}}],
  ['9185',{style:'raise',duration:5250,equipment:'stretch-rope',muscles:['shoulder'],camera:upright}],
]);
register(harnessDrag,'truck-harness-rope',['glute','quad','core'],{yaw:66,elevation:15,focus:[0,.91,-1.17],height:3.18},[
  ['2710',{duration:4350}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,movement,variant,muscles,equipment,camera} of selected){
  const recipe={version:1,equipment,muscles,durationMs:variant.duration??4520,camera,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...movement(index/64,variant)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:variant.poster??.44});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
