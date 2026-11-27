import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, blend, body, cycle, foot, joint, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const axis=[1,0,0];

function arms(pose,targets,elbows=[.74,-.60,-.09],orientation=axis,loaded=true) {
  for(const [index,[side,sign]] of sides.entries()){
    [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],targets[index],
      [sign*elbows[0],elbows[1],elbows[2]],.252,loaded?.371:.326);
    if(loaded)pose[side+'Grip']=orientation;
  }
}

function feet(pose,{standing=false,lying=false,sidelong=false}={}) {
  pose.planted={l:0,r:0};
  for(const [side,sign] of sides){
    const target=standing?[sign*.159,.075,.086]:lying?[sign*.241,.075,.593]:
      sidelong?[.245+sign*.043,.075,sign*.208+.021]:[sign*.164,.075,.409];
    foot(pose,side,sign,target,[sign*.15,.39,.89],[sign*.015,-.067,.142]);
  }
}

function rig(pose,pivot,points=[pose.lw,pose.rw]) {
  pose.leverPressHandles=points.map((point,index)=>({
    pivot:add(pivot,[index===0?.483:-.483,0,0]),point,axis,
  }));
  return pose;
}

function chestPress(phase,{kind}) {
  const amount=cycle(phase,.42,.57);
  const sidelong=kind==='side';
  const lying=kind==='lying';
  const hip=lying?[0,.573,.238]:[0,.560,-.060];
  const pose=body(hip,lying?-Math.PI/2:-.040,sidelong?Math.PI/2:0);
  feet(pose,{lying,sidelong});
  const contacts=sides.map(([side,sign])=>{
    const shoulder=pose[side+'s'];
    if(lying)return add(shoulder,[sign*mix(.097,.048,amount),mix(.146,.594,amount),mix(.101,.037,amount)]);
    if(sidelong&&sign<0)return add(shoulder,[.213,-.501,.004]);
    const steer=add(scale(pose.front,mix(.145,.574,amount)),scale(pose.right,sign*mix(.126,.037,amount)));
    return add(shoulder,add(steer,[0,-.072,0]));
  });
  arms(pose,contacts,sidelong?[.72,-.61,.14]:[.84,-.57,.18],sidelong?[0,1,0]:axis);
  if(sidelong)delete pose.rGrip;
  return rig(pose,lying?[0,.316,-.563]:[0,.481,-.378]);
}

function fly(phase,{kind}) {
  const amount=cycle(phase,.43,.58);
  const standing=kind==='standing'||kind==='lateral';
  const lateral=kind==='lateral';
  const reverse=kind!=='standing';
  const side=kind==='side';
  const lean=kind==='incline'?.472:kind==='bent'?.812:standing?.017:.167;
  const hips=standing?[0,.885,.021]:[0,.562,-.098];
  const pose=body(hips,lean,side?Math.PI/2:0);
  feet(pose,{standing,sidelong:side});
  const grip=reverse?amount:1-amount;
  const contacts=sides.map(([limb,sign])=>{
    const shoulder=pose[limb+'s'];
    if(side&&sign<0)return add(shoulder,[.210,-.452,0]);
    if(lateral)return add(shoulder,[sign*mix(.093,.563,amount),mix(-.569,-.014,amount),.081]);
    const width=scale(pose.right,sign*mix(-.057,.545,grip));
    const depth=scale(pose.front,mix(.556,.033,grip));
    return add(shoulder,add(add(width,depth),[0,mix(-.054,.027,grip),0]));
  });
  arms(pose,contacts,[.44,-.73,.16],[0,1,0],!lateral);
  if(side)delete pose.rGrip;
  const points=lateral?sides.map(([limb])=>blend(pose[limb+'e'],pose[limb+'w'],.28)):[pose.lw,pose.rw];
  return rig(pose,standing?[0,1.086,-.399]:[0,1.207,.533],points);
}

function pulley(phase,{kind}) {
  const t=cycle(phase,.43,.57);
  const press=kind==='cable-shoulder'||kind==='triceps';
  const triceps=kind==='triceps';
  const cross=kind==='cross-lat';
  const rope=kind==='rope-lat';
  const outdoor=kind==='out-lat';
  const pose=body([0,.552,-.089],outdoor?-.162:-.050);
  feet(pose);
  const contacts=sides.map(([side,sign])=>{
    const shoulder=pose[side+'s'];
    if(triceps)return add(shoulder,[sign*.072,mix(.191,.574,t),mix(-.319,.042,t)]);
    if(press)return add(shoulder,[sign*mix(.141,.090,t),mix(.058,.567,t),mix(.139,.071,t)]);
    return [sign*(cross?mix(.464,.138,t):rope?mix(.109,.195,t):outdoor?.260:.322),
      mix(cross?1.593:1.659,1.097,t),mix(cross?.318:.228,cross?.164:.159,t)];
  });
  arms(pose,contacts,press?[triceps?.38:.77,triceps?.85:-.58,.16]:[cross?.82:.58,-.55,-.61],
    cross||rope?[0,0,1]:axis);
  return rig(pose,press?[0,.477,-.453]:[0,1.925,.545]);
}

function branch(phase,{kind}) {
  const t=cycle(phase,.43,.60);
  if(kind==='neck-back'||kind==='neck-left'||kind==='neck-right'){
    const back=kind==='neck-back';
    const sign=kind==='neck-left'?1:-1;
    const pose=body([0,.571,-.095],.035);
    feet(pose);
    pose.head=add(pose.head,[back?0:sign*.047*t,-.019*t,back?-.058*t:0]);
    arms(pose,[[.247,.635,.104],[-.247,.635,.104]],[.57,-.84,.13]);
    const pad=add(pose.head,[back?0:sign*.104,0,back?-.114:-.019]);
    return rig(pose,[0,1.306,-.395],[pad,pad]);
  }
  if(kind==='unilateral-row'){
    const pose=body([0,.769,-.191],1.124);
    pose.planted={r:0};
    pose.lk=[.159,.494,.120];
    pose.la=[.178,.491,-.302];
    pose.lt=[.191,.430,-.428];
    foot(pose,'r',-1,[-.278,.075,.052],[-.28,.24,.96],[-.016,-.068,.144]);
    arms(pose,[[.255,.763,.572],[-.244,mix(.391,.733,t),mix(.411,.161,t)]],[.60,-.47,-.79],[0,0,1]);
    return rig(pose,[0,.224,.786]);
  }
  if(kind==='hinge'){
    const pose=body([0,mix(.903,.747,t),mix(.022,-.242,t)],mix(.024,1.102,t));
    feet(pose,{standing:true});
    const contacts=sides.map(([side,sign])=>[sign*.267,mix(.821,.372,t),mix(.148,.312,t)]);
    arms(pose,contacts,[.58,-.71,-.20],[0,0,1]);
    return rig(pose,[0,.212,-.616]);
  }
  const preacher=kind==='turned-preacher';
  const pose=body([0,.559,-.063],preacher?.379:.024,preacher?.314:0);
  feet(pose);
  if(preacher){
    pose.le=[.245,.843,.375];
    const angle=mix(.07,2.460,t);
    pose.lw=[.252,.843-.371*Math.cos(angle),.375+.371*Math.sin(angle)];
    pose.lGrip=[-1,0,0];
    [pose.re,pose.rw]=joint(pose.rs,[-.219,.584,.189],[-.54,-.84,.14],.252,.326);
  }else{
    for(const [side] of sides)pose[side+'s'][1]+=.087*t;
    arms(pose,sides.map(([,sign])=>[sign*.263,.437+.087*t,.066]),[.66,-.81,.14],[0,0,1]);
  }
  return rig(pose,preacher?[0,.834,.377]:[0,.283,.668]);
}

const chest=['pec','triceps'];
const rear=['rearShoulder','trap'];
const lat=['lat','biceps'];
const jobs=[
  ['4213','chest-band',chestPress,{kind:'band'},chest],
  ['1041','chest-lying',chestPress,{kind:'lying'},chest],
  ['5815','chest-side',chestPress,{kind:'side'},['l:pec','l:triceps']],
  ['6355','chest-outdoor',chestPress,{kind:'outdoor'},chest],
  ['11718','fly-incline',fly,{kind:'incline'},rear],
  ['5527','fly-bent',fly,{kind:'bent'},rear],
  ['8990','fly-side',fly,{kind:'side'},['l:rearShoulder']],
  ['8847','fly-lateral',fly,{kind:'lateral'},['shoulder']],
  ['9398','fly-standing',fly,{kind:'standing'},['pec']],
  ['1863','cable-lat',pulley,{kind:'lat'},lat],
  ['1862','cable-shoulder',pulley,{kind:'cable-shoulder'},['shoulder','triceps']],
  ['6881','cable-cross-lat',pulley,{kind:'cross-lat'},lat],
  ['5326','cable-rope-lat',pulley,{kind:'rope-lat'},lat],
  ['6356','cable-out-lat',pulley,{kind:'out-lat'},lat],
  ['7864','cable-triceps',pulley,{kind:'triceps'},['triceps']],
  ['2282','neck-back',branch,{kind:'neck-back'},['neck']],
  ['2283','neck-left',branch,{kind:'neck-left'},['l:neck']],
  ['2284','neck-right',branch,{kind:'neck-right'},['r:neck']],
  ['5299','turned-preacher',branch,{kind:'turned-preacher'},['l:biceps']],
  ['8712','hinge',branch,{kind:'hinge'},['hamstring','glute']],
  ['1221','seated-shrug',branch,{kind:'seated-shrug'},['trap']],
  ['1313','unilateral-row',branch,{kind:'unilateral-row'},['r:lat','r:biceps']],
];

const [folder,...ids]=process.argv.slice(2);
if(!folder)throw new Error('Pass an output folder and optional exact specialty machine IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate machine ID.');
const root=resolve(folder);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,rigName,movement,options,muscles] of selected){
  const cable=rigName.startsWith('cable-');
  const lying=rigName==='chest-lying';
  const standing=rigName==='fly-standing'||rigName==='fly-lateral'||rigName==='hinge';
  const neck=rigName.startsWith('neck-');
  const yaw=rigName==='chest-side'?26:rigName==='fly-bent'||rigName==='fly-incline'?136:
    rigName==='unilateral-row'?-54:cable?-48:options.kind==='side'?114:neck?rigName==='neck-right'?-49:49:62;
  const camera={yaw,
    elevation:14,height:cable?2.42:standing?2.20:lying?1.91:2.04,
    focus:[0,cable?1.015:standing?.92:lying?.65:.810,0.13]};
  const data={version:1,durationMs:neck?5250:4450,equipment:'lever-press-station-special-upper-'+rigName,muscles,camera,
    keyframes:Array.from({length:61},(_,index)=>({at:index/60,...movement(index/60,options)}))};
  try{
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(resolve(root,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe,posterAt:.47});
  }catch(error){
    failures.push({id,reason:error.message});
  }
}
await writeFile(resolve(root,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
