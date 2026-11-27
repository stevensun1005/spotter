import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, body, cycle, foot, joint, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const lateral=[1,0,0];
const up=[0,1,0];

function armsAt(pose, side, target, pole, grip) {
  [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],target,pole,.252,grip?.371:.326);
  if(grip)pose[side+'Grip']=grip;
}

function beltMove(phase,{stance='normal',movement='squat',handle}) {
  const amount=cycle(phase,.42,.57);
  const sumo=stance==='sumo';
  const split=stance==='split';
  const single=stance==='single';
  const squat=movement==='squat';
  const floorPull=movement==='deadlift';
  const deck=.100;
  const hips=squat?[0,mix(.958,split?.545:.551,amount),mix(split?.110:.027,split?.059:-.117,amount)]
    :floorPull?[0,mix(.968,.635,amount),mix(.008,-.126,amount)]:
      [single?.025:0,mix(.967,single?.802:.814,amount),mix(.009,-.234,amount)];
  const pitch=squat?mix(.017,split?.132:.336,amount)
    :floorPull?mix(.018,sumo?.621:1.023,amount):mix(.022,single?1.360:1.326,amount);
  const pose=body(hips,pitch);
  pose.planted={};
  pose.leverPressHandles=[];
  for(const [side,sign] of sides){
    const rear=split&&sign<0;
    const floating=single&&sign<0;
    const width=sumo?.319:split?.146:single?.141:.165;
    const ankle=rear?[-.142,.502,-.620]:floating?[-.138,mix(.249,.760,amount),mix(-.164,-.955,amount)]
      :[sign*width,deck+.076,split?.398:.087];
    const kind=rear?[sign*.10,-.33,1]:[sign*(sumo?.45:.19),.17,.94];
    const toe=rear?[sign*.009,-.061,-.149]:floating?[sign*.02,-.109,.095]:[sign*(sumo?.072:.027),-.066,.141];
    foot(pose,side,sign,ankle,kind,toe);
    if(!floating)pose.planted[side]=rear?.426:deck;
    const target=handle?[sign*(handle==='v'?.100:.247),
      floorPull?mix(.836,.325,amount):mix(.836,.498,amount),
      floorPull?mix(.178,.296,amount):mix(.179,.329,amount)]
      :squat?[sign*.267,1.112,.455]:add(pose[side+'s'],[sign*.058,-.541+.052*amount,.082]);
    const grip=handle?(handle==='v'?[sign*.582,0,.813]:lateral):squat?up:null;
    armsAt(pose,side,target,[sign*.57,-.16,handle?.15:.84],grip);
    pose.leverPressHandles.push({pivot:[sign*.445,.226,-.771],
      point:add(hips,[sign*.165,.072,.069]),axis:lateral});
  }
  return pose;
}

function hipMove(phase,{station,stance='normal'}) {
  const amount=cycle(phase,.41,.56);
  const seated=station!=='standing';
  const step=station==='step';
  const single=stance==='single';
  const stagger=stance==='stagger';
  const band=station==='band';
  const angle=seated?mix(-1.006,-1.514,amount):mix(.394,.005,amount);
  const shoulder=[0,step?.717:.619,-.339];
  const spine=[0,Math.cos(angle),Math.sin(angle)];
  const hip=seated?add(shoulder,scale(spine,-.506)):[0,mix(.832,.894,amount),mix(-.143,.042,amount)];
  const pose=body(hip,angle);
  pose.planted={};
  pose.leverPressHandles=[];
  for(const [side,sign] of sides){
    const floating=single&&sign<0;
    const platform=step?.223:seated?.092:0;
    const ankle=seated
      ?floating?[sign*.162,mix(.316,.542,amount),mix(.684,.849,amount)]
        :[sign*(band?.206:.174),platform+.076,stagger&&sign<0?.888:.753]
      :[sign*.153,.076,.119];
    const toe=floating?[sign*.019,.015,.145]:[sign*.025,-.067,.146];
    foot(pose,side,sign,ankle,[sign*(band?.42:.17),.91,.37],toe);
    if(!floating)pose.planted[side]=platform;
    const padGrip=add(hip,[sign*.249,.091,.105]);
    const target=seated?padGrip:[sign*.304,1.122,.448];
    armsAt(pose,side,target,[sign*.77,-.83,-.22],seated?[0,0,1]:up);
    pose.leverPressHandles.push({pivot:seated?[sign*.497,.350,-.445]:[sign*.422,.315,.563],
      point:add(hip,[sign*.174,seated?.111:.058,seated?.070:.131]),axis:lateral});
  }
  return pose;
}

const beltSquat=['quad','glute'];
const hinge=['hamstring','glute'];
const thrust=['glute','hamstring'];
const jobs=[
  ['10328','belt-split',beltMove,{stance:'split'},['l:quad','l:glute']],
  ['9866','belt-straight',beltMove,{movement:'deadlift',handle:'straight'},['quad',...hinge]],
  ['9865','belt-v',beltMove,{movement:'deadlift',handle:'v'},['quad',...hinge]],
  ['9494','belt-basic',beltMove,{movement:'rdl'},hinge],
  ['9876','belt-straight',beltMove,{movement:'rdl',handle:'straight'},hinge],
  ['9877','belt-v',beltMove,{movement:'rdl',handle:'v'},hinge],
  ['11529','belt-basic',beltMove,{stance:'single',movement:'rdl'},['l:hamstring','l:glute']],
  ['2950','belt-basic',beltMove,{},beltSquat],
  ['11055','belt-v',beltMove,{stance:'sumo',movement:'deadlift',handle:'v'},['quad',...hinge]],
  ['9493','belt-basic',beltMove,{stance:'sumo'},beltSquat],
  ['2146','thrust-belt',hipMove,{station:'belt'},thrust],
  ['7384','thrust-loaded-belt',hipMove,{station:'belt'},thrust],
  ['2742','thrust-step',hipMove,{station:'step'},thrust],
  ['2743','thrust-pad',hipMove,{station:'pad'},thrust],
  ['2147','thrust-band',hipMove,{station:'band'},thrust],
  ['2148','thrust-belt',hipMove,{station:'belt',stance:'single'},['l:glute','l:hamstring']],
  ['11054','thrust-loaded-pad',hipMove,{station:'pad',stance:'stagger'},thrust],
  ['9848','thrust-standing',hipMove,{station:'standing'},thrust],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact belt/hip IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate belt/hip ID.');
const root=resolve(directory);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,type,movement,options,muscles] of selected){
  const belt=type.startsWith('belt-');
  const standing=type==='thrust-standing';
  const data={version:1,durationMs:4400,equipment:'lever-press-station-'+type,muscles,
    camera:{yaw:belt?options.stance==='single'?53:59:62,elevation:14,height:belt||standing?2.14:1.82,
      focus:[0,belt||standing?.92:.60,belt?-.015:.239]},
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
