import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, blend, body, cycle, foot, joint, ramp, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const floor=.074;

function setup(pose,machineShift,follow=0) {
  pose.machineTravel=1+machineShift;
  pose.followZ=follow;
  pose.planted={};
  return pose;
}

function hands(pose,targets,{over=false,grip=[1,0,0],elbows=[.78,-.62,-.12],loose=false}={}) {
  for(const [index,[side,sign]] of sides.entries()){
    const pole=[sign*elbows[0],elbows[1],elbows[2]];
    [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],targets[index],pole,.252,loose?.326:.371);
    if(!loose)pose[side+'Grip']=over?scale(grip,-1):grip;
  }
}

function feet(pose,targets,yaw=0) {
  const side=[Math.cos(yaw),0,-Math.sin(yaw)];
  const forward=[Math.sin(yaw),0,Math.cos(yaw)];
  for(const [index,[limb,sign]] of sides.entries()){
    const ankle=targets[index];
    const toe=add(add(scale(side,sign*.018),scale(forward,.145)),[0,-.065,0]);
    const pole=add(scale(side,sign*.23),scale(forward,.92));
    foot(pose,limb,sign,ankle,pole,toe);
    if(ankle[1]<floor+.008)pose.planted[limb]=0;
  }
}

function runningFeet(pose,phase,{yaw=0,reverse=false,speed=.88}) {
  const moveDirection=reverse?-1:1;
  const direction=[Math.sin(yaw)*moveDirection,0,Math.cos(yaw)*moveDirection];
  const side=[Math.cos(yaw),0,-Math.sin(yaw)];
  const targets=sides.map(([,sign])=>{
    const at=(phase*2+(sign>0?0:.5))%1;
    const stance=at<.64;
    const remaining=(at-.64)/.36;
    const step=stance?mix(.162,.162-.32*speed,at/.64):
      mix(.162-.32*speed,.162,remaining)+.063*Math.sin(Math.PI*remaining);
    const lift=stance?0:.118*Math.sin(Math.PI*remaining);
    const origin=[pose.hips[0],floor+lift,pose.hips[2]];
    return add(add(origin,scale(direction,step)),scale(side,sign*.139));
  });
  feet(pose,targets,yaw);
}

function locomotion(phase,{kind}) {
  const front=kind==='push'||kind==='tank';
  const backward=kind==='backward';
  const harness=kind==='harness';
  const side=kind==='antirotation';
  const alternating=kind==='rope-pull';
  const reverse=kind==='rear-drag'||alternating;
  const speed=front||backward?.87:side?.69:reverse?.68:.99;
  const offset=(reverse?-1:1)*speed*phase;
  const yaw=side?Math.PI/2:backward?Math.PI:0;
  const rootZ=side?-.244:offset+(harness?.180:reverse?-.133:backward?.469:kind==='tank'?-.251:-.223);
  const rootX=side?offset:0;
  const minor=.015*Math.sin(phase*Math.PI*8);
  const low=kind==='tank'||backward;
  const hipY=front?low?.726:.789:backward?.685:reverse?.871:.911;
  const pitch=front?low?.841:.662:backward?.339:reverse?-.156:harness?.329:.064;
  const shift=alternating?offset-.21*phase:offset;
  const pose=setup(body([rootX,hipY+minor,rootZ],pitch,yaw),shift,side?0:offset*.88);
  runningFeet(pose,phase,{yaw,reverse:backward||reverse,speed});
  let contacts;
  if(front||backward){
    const y=kind==='tank'?.893:backward?.654:.997;
    const z=(kind==='tank'?.702:.646)+shift;
    contacts=sides.map(([,sign])=>[(backward?-sign:sign)*(kind==='tank'?.308:backward?.267:.240),y,z]);
  }else if(harness){
    contacts=sides.map(([side,sign])=>add(pose[side+'s'],[sign*.035,-.413,.196+sign*.089*Math.sin(phase*Math.PI*4)]));
  }else if(side){
    contacts=sides.map(([,sign])=>[rootX+.474,1.259,rootZ+sign*.052]);
  }else{
    contacts=sides.map(([,sign])=>{
      const pull=alternating?.5+.5*sign*Math.sin(phase*Math.PI*4):.25;
      return [sign*.126,mix(.815,1.062,pull),rootZ+mix(.532,.274,pull)];
    });
  }
  const axis=front||backward?[0,kind==='tank'?0:1,kind==='tank'?1:0]:[0,0,1];
  hands(pose,contacts,{grip:axis,loose:harness,elbows:[.67,-.56,front?-.25:.52]});
  return pose;
}

function pulling(phase,{kind}) {
  const curl=kind==='curl';
  const fly=kind==='fly';
  const high=kind==='high';
  const bat=kind==='bat';
  const extension=kind==='triceps';
  const t=cycle(phase,.44,.59);
  const yaw=extension?Math.PI:0;
  const rootZ=extension?-.293:-.120;
  const hip=[0,high?mix(.826,.896,t):bat?.842:.882,rootZ+(high?.073*t:0)];
  const pitch=extension?.230:high?mix(.479,.046,t):bat?.213:kind==='row'?.209:.038;
  const pose=setup(body(hip,pitch,yaw),-.280*t);
  feet(pose,sides.map(([,sign])=>[sign*(extension?-.156:.165),floor,
    rootZ+(bat||extension?sign*-.228:.05)]),yaw);
  const contacts=sides.map(([side,sign])=>{
    if(extension){
      const shoulder=pose[side+'s'];
      return add(shoulder,[-sign*.039,mix(.281,.536,t),mix(.218,-.218,t)]);
    }
    if(curl)return [sign*.157,mix(.819,1.345,t),rootZ+mix(.461,.241,t)];
    if(fly)return [sign*mix(.137,.696,t),1.080,rootZ+mix(.579,.091,t)];
    if(high)return [sign*.208,mix(.779,1.305,t),rootZ+mix(.571,.263,t)];
    if(bat)return [sign*mix(.198,.430,t),mix(.909,1.143,t),rootZ+mix(.520,.142,t)];
    return [sign*.171,mix(.942,1.078,t),rootZ+mix(.573,.183,t)];
  });
  const elbows=extension?[.18,.924,-.28]:high||bat?[.90,.580,-.39]:fly?[.37,-.10,.99]:
    curl?[.23,-.93,.19]:[.39,-.43,-.82];
  hands(pose,contacts,{over:curl,grip:fly||bat||extension?[0,1,0]:[1,0,0],elbows});
  return pose;
}

function rearLunge(phase,{kind}) {
  const alternate=(phase*2)%1;
  const sideBack=phase<.5?-1:1;
  const lunge=cycle(alternate,.40,.60);
  const row=kind==='lunge-row';
  const slip=row?.18*cycle(alternate,.75,.86):0;
  const pose=setup(body([0,mix(.858,.524,lunge),mix(.143,-.027,lunge)],
    mix(.037,kind==='lunge-2'?.225:.137,lunge)),-slip);
  feet(pose,sides.map(([,sign])=>[sign*.146,floor+(sign===sideBack?.077*lunge:0),
    .038+(sign===sideBack?(kind==='lunge-2'?-.666:-.543)*lunge:.067*lunge)]));
  const contacts=sides.map(([,sign])=>row
    ?[sign*.211,mix(.949,1.097,slip/.18),mix(.612,.218,slip/.18)]
    :[sign*.240,.997,.646]);
  hands(pose,contacts,{grip:row?[1,0,0]:[0,1,0],elbows:[.72,-.47,-.21]});
  return pose;
}

function interpolate(phase,stops) {
  const index=stops.findIndex(([time])=>phase<=time&&time>0);
  const [start,a]=stops[index-1];
  const [finish,b]=stops[index];
  return blend(a,b,ramp(phase,start,finish));
}

function burpee(phase) {
  if(phase>=.57){
    const travel=(phase-.57)/.43;
    const pose=locomotion(travel,{kind:'push'});
    return pose;
  }
  const [height,depth,pitch,support,trailing,ankleY] = interpolate(phase,[
    [0,[.875,.037,.044,.12,.083,.074]],[.12,[.485,-.092,1.116,.421,-.044,.074]],
    [.24,[.231,-.201,1.571,.545,-.880,.077]],[.31,[.246,-.202,1.462,.545,-.869,.077]],
    [.40,[.546,-.091,.846,.451,.119,.097]],[.48,[1.055,.039,.055,.211,.111,.214]],
    [.52,[.839,.064,.337,.362,.062,.074]],[.57,[.789,-.223,.662,.646,-.061,.074]],
  ]);
  const pose=setup(body([0,height,depth],pitch),0,0);
  feet(pose,sides.map(([,sign])=>[sign*.139,ankleY,trailing-(sign<0?.217*ramp(phase,.53,.57):0)]));
  const gripY=interpolate(phase,[[0,[.829]],[.14,[.092]],[.32,[.091]],[.40,[.401]],[.48,[1.934]],[.57,[.997]]])[0];
  hands(pose,sides.map(([,sign])=>[sign*.240,gripY,support]),{grip:[0,1,0],loose:phase<.548,elbows:[.43,-.58,.37]});
  return pose;
}

const jobs=[
  ['10193','front',burpee,{},['quad','glute','pec'],'burpee'],
  ['2908','axis',locomotion,{kind:'antirotation'},['core','glute'],'walk'],
  ['2907','rear',locomotion,{kind:'backward'},['quad','glute'],'walk'],
  ['2901','rope',pulling,{kind:'curl'},['biceps']],
  ['5143','harness',locomotion,{kind:'harness'},['glute','quad','calf'],'walk'],
  ['2909','rope',pulling,{kind:'high'},['trap','shoulder','glute']],
  ['9939','rope',locomotion,{kind:'rope-pull'},['lat','biceps','quad'],'walk'],
  ['2563','rope',pulling,{kind:'row'},['lat','biceps']],
  ['4428','front',locomotion,{kind:'push'},['glute','quad','calf'],'walk'],
  ['2904','rope',pulling,{kind:'bat'},['rearShoulder','trap']],
  ['5193','rope',locomotion,{kind:'rear-drag'},['quad','glute'],'walk'],
  ['2905','rope',pulling,{kind:'fly'},['rearShoulder','trap']],
  ['2830','front',rearLunge,{kind:'lunge'},['glute','quad'],'lunge'],
  ['2902','rope',rearLunge,{kind:'lunge-row'},['glute','quad','lat'],'lunge'],
  ['2903','front',rearLunge,{kind:'lunge-2'},['glute','quad'],'lunge'],
  ['4119','rope',pulling,{kind:'triceps'},['triceps']],
  ['8702','tank',locomotion,{kind:'tank'},['glute','quad','calf'],'walk'],
];

const [folder,...ids]=process.argv.slice(2);
if(!folder)throw new Error('Pass an output folder and optional exact sled IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate sled ID.');
const root=resolve(folder);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,rig,movement,options,muscles,time] of selected){
  const burden=rig==='harness';
  const sideways=rig==='axis';
  const overhead=options.kind==='triceps';
  const camera={yaw:sideways?37:burden?109:options.kind==='backward'?69:65,elevation:13,
    height:time==='burpee'?2.51:overhead?2.44:sideways?2.20:2.16,
    focus:[sideways?.34:0,overhead?1.047:.89,burden?-.36:sideways?.33:.46]};
  const data={version:1,durationMs:time==='burpee'?6400:time==='walk'?5200:time==='lunge'?5900:4350,
    equipment:'sled-prowler-'+rig,muscles,camera,
    keyframes:Array.from({length:61},(_,index)=>({at:index/60,...movement(index/60,options)}))};
  try{
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(resolve(root,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe,posterAt:time==='burpee'?.735:time==='lunge'?.23:.47});
  }catch(error){
    failures.push({id,reason:error.message});
  }
}
await writeFile(resolve(root,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
