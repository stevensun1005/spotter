import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, blend, body, cycle, foot, joint, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const xAxis=[1,0,0];

function anchors(pose,pivot,points) {
  pose.leverPressHandles=points.map((point,index)=>({
    pivot:add(pivot,[index===0?.42:-.42,0,0]),point,axis:xAxis,
  }));
  return pose;
}

function arm(pose,side,target,pole,gripping=true) {
  [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],target,pole,.252,gripping?.371:.326);
  if(gripping)pose[side+'Grip']=xAxis;
}

function crossed(pose,side,sign) {
  const wrist=add(pose.chest,add(scale(pose.right,-sign*.094),scale(pose.front,.145)));
  arm(pose,side,wrist,[sign*.86,-.57,.25],false);
}

function seatedCrunch(phase,{kind,sideBend=0,depth=.69}) {
  const flex=cycle(phase,.42,.58);
  const back=kind==='back'||kind==='back-grip';
  const palms=kind==='hands';
  const hips=[0,.577,-.071];
  const pitch=back?mix(depth,.024,flex):mix(.039,depth,flex);
  const pose=body(hips,pitch,sideBend*.58,sideBend*.30*flex);
  pose.lh=add(hips,[.105,0,0]);
  pose.rh=add(hips,[-.105,0,0]);
  const blocks=[];
  for(const [side,sign] of sides){
    const ankle=[sign*.159,.154,.471];
    foot(pose,side,sign,ankle,[sign*.14,.16,.94],[sign*.017,-.065,.144]);
    pose.planted[side]=.078;
    const shoulder=pose[side+'s'];
    const centered=add(pose.chest,scale(pose.front,back?-.140:.119));
    const sideWidth=scale(pose.right,sign*(back?.111:.187));
    blocks.push(add(centered,sideWidth));
    if(back&&!palms&&kind!=='back-grip')crossed(pose,side,sign);
    else{
      const wrist=palms?add(shoulder,add(scale(pose.front,.239),scale(pose.up,-.20)))
        :add(shoulder,add(scale(pose.front,.124),scale(pose.up,-.199)));
      arm(pose,side,add(wrist,scale(pose.right,sign*.083)),[sign*.65,-.65,-.36],!palms);
      if(palms)pose[side+'PalmSide']=[0,-1,0];
    }
  }
  return anchors(pose,[0,.283,-.456],blocks);
}

function circularTorque(phase,{kind}) {
  const standing=kind==='upright';
  const amplitude=kind==='trunk'?.54:kind==='torso'?.625:.56;
  const swing=amplitude*Math.sin(Math.PI*2*phase);
  const hips=standing?[0,.968,-.100]:[0,.612,-.075];
  const pose=body(hips,.032,swing);
  pose.lh=add(hips,[.105,0,0]);
  pose.rh=add(hips,[-.105,0,0]);
  const pads=[];
  for(const [side,sign] of sides){
    const ankle=[sign*(standing?.197:.154),.148,standing?.029:.442];
    foot(pose,side,sign,ankle,[sign*.16,.07,.98],[sign*.024,-.065,.139]);
    pose.planted[side]=.072;
    const sideways=scale(pose.right,sign*(kind==='torso'?.240:.185));
    const sit=add(add(pose.chest,sideways),scale(pose.front,kind==='torso'?-.005:.210));
    const wrist=add(sit,add(scale(pose.front,standing?.163:.142),scale(pose.up,standing?.018:-.050)));
    arm(pose,side,wrist,[sign*.72,-.58,-.31]);
    pads.push(sit);
  }
  return anchors(pose,[0,.411,-.259],pads);
}

function reclinedCrunch(phase,{kind}) {
  const decline=kind==='decline';
  const legRaise=kind==='legs';
  const stack=kind==='stack';
  const rise=cycle(phase,.43,.58);
  const hip=[0,decline?.719:.594,-.068];
  const start=decline?-1.899:-Math.PI/2;
  const end=decline?-.244:stack?-.979:-1.053;
  const pitch=legRaise?start:mix(start,end,rise);
  const pose=body(hip,pitch);
  pose.planted={};
  const pads=[];
  for(const [side,sign] of sides){
    const ankle=decline?[sign*.155,.684,.580]:legRaise
      ?[sign*.147,mix(.317,.739,rise),mix(.551,.439,rise)]:[sign*.221,.121,.510];
    const toe=legRaise?[sign*.016,-.082,.132]:decline?[sign*.010,.094,.103]:[sign*.016,-.066,.149];
    foot(pose,side,sign,ankle,[sign*.11,.91,.14],toe);
    if(!decline&&!legRaise)pose.planted[side]=.045;
    if(decline)crossed(pose,side,sign);
    else {
      const wrist=legRaise?[sign*.298,.583,-.464]
        :add(pose[side+'s'],add(scale(pose.front,.155),scale(pose.right,sign*.094)));
      arm(pose,side,wrist,[sign*.78,-.49,.35]);
    }
    pads.push(legRaise?blend(pose[side+'k'],pose[side+'a'],.51)
      :add(pose[side+'s'],scale(pose.front,.100)));
  }
  return anchors(pose,[0,decline?.353:.284,legRaise?.695:-.847],pads);
}

function kneelingCore(phase,{kind}) {
  const draw=cycle(phase,.43,.59);
  const coaster=kind==='coaster';
  const hip=coaster?[0,mix(.895,1.087,draw),mix(-.288,-.144,draw)]:[0,.957,-.168];
  const pitch=coaster?mix(.637,.472,draw):mix(.058,.720,draw);
  const pose=body(hip,pitch);
  if(coaster){
    pose.ls=[.192,1.385,.027];
    pose.rs=[-.192,1.385,.027];
    pose.chest=blend(hip,[0,1.387,.027],.70);
    pose.neck=[0,1.451,.097];
    pose.head=[0,1.563,.146];
  }
  pose.planted={};
  const guides=[];
  for(const [side,sign] of sides) {
    const knee=coaster?[sign*.128,mix(.516,.837,draw),mix(-.071,.166,draw)]:[sign*.129,.546,-.102];
    const ankle=add(knee,[sign*.015,-.054,-.411]);
    pose[side+'k']=knee;
    pose[side+'a']=ankle;
    pose[side+'t']=add(ankle,[sign*.018,-.102,-.074]);
    const wrist=coaster?[sign*.199,1.334,.485]:add(pose[side+'s'],[sign*.064,-.172,.460]);
    arm(pose,side,wrist,[sign*.34,-.91,.18]);
    guides.push(coaster?blend(knee,ankle,.24):wrist);
  }
  return anchors(pose,[0,coaster?.379:1.512,coaster?-.611:.620],guides);
}

const core=['core'];
const jobs=[
  ['5583','coaster',kneelingCore,{kind:'coaster'},core],
  ['6561','swing',kneelingCore,{kind:'swing'},core],
  ['0573','seat-back',seatedCrunch,{kind:'back',depth:.613},['glute','core']],
  ['2266','seat-back-grip',seatedCrunch,{kind:'back-grip',depth:.476},['core']],
  ['1858','recline-decline',reclinedCrunch,{kind:'decline'},core],
  ['2276','recline-flat',reclinedCrunch,{kind:'flat'},core],
  ['2314','recline-stack',reclinedCrunch,{kind:'stack'},core],
  ['1856','recline-legs',reclinedCrunch,{kind:'legs'},core],
  ['2268','seat-palms',seatedCrunch,{kind:'hands',depth:.641},core],
  ['3881','seat-full',seatedCrunch,{kind:'full',depth:.894},core],
  ['3882','seat-full',seatedCrunch,{kind:'side',sideBend:1,depth:.643},['l:core']],
  ['3883','seat-full',seatedCrunch,{kind:'side',sideBend:-1,depth:.643},['r:core']],
  ['1453','rotation-seated',circularTorque,{kind:'seated'},core],
  ['10065','rotation-torso',circularTorque,{kind:'torso'},core],
  ['1857','seat-chest',seatedCrunch,{kind:'chest',depth:.791},core],
  ['5333','rotation-trunk',circularTorque,{kind:'trunk'},core],
  ['0608','rotation-standing',circularTorque,{kind:'upright'},core],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact axial machine IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate axial machine ID.');
const root=resolve(directory);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,preset,movement,options,muscles] of selected){
  const standing=options.kind==='upright';
  const lying=preset.startsWith('recline-');
  const decline=options.kind==='decline';
  const knees=movement===kneelingCore;
  const rotation=movement===circularTorque;
  const camera={yaw:standing?45:options.sideBend===1?-52:options.sideBend===-1?52:rotation?46:65,
    elevation:standing?11:15,height:decline?2.07:lying?1.88:knees||standing?2.29:2.06,
    focus:[0,decline?.693:standing?.95:lying?.62:knees?.914:.811,0]};
  const data={version:1,durationMs:rotation?5900:4550,equipment:'lever-press-station-axial-'+preset,muscles,camera,
    keyframes:Array.from({length:61},(_,index)=>({at:index/60,...movement(index/60,options)}))};
  try{
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(resolve(root,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe});
  }catch(error){
    failures.push({id,reason:error.message});
  }
}
await writeFile(resolve(root,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
