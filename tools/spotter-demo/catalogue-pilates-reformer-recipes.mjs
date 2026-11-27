import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, blend, body, cycle, foot, joint, ramp, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const frameTop=.518;
const footbar=[0,.572,.865];

function attachCarriage(pose,center) {
  pose.leverPressHandles=[-1,1].map(sign=>({
    pivot:[sign*.241,.398,.744],point:[sign*.241,frameTop,center],axis:[1,0,0],
  }));
  return pose;
}

function restArms(pose) {
  for(const [side,sign] of sides) {
    const shoulder=pose[side+'s'];
    const target=[pose.hips[0]+sign*.219,frameTop+.058,pose.hips[2]+.031];
    [pose[side+'e'],pose[side+'w']]=joint(shoulder,target,[sign*.50,-.88,.07],.252,.326);
    pose[side+'PalmSide']=[0,-1,0];
  }
}

function footwork(phase,{kind='flat'}) {
  const open=cycle(phase,.42,.58);
  const calves=kind==='calves';
  const running=kind==='running';
  const bridge=kind==='bridge';
  const calfAngle=mix(.025,1.037,open);
  const ankleY=footbar[1]+.011+.146*Math.sin(calfAngle);
  const ankleZ=footbar[2]-.011-.146*Math.cos(calfAngle);
  const straightLegOffset=Math.sqrt(.827**2-(ankleY-.631)**2-.041**2);
  const parked=calves?ankleZ-straightLegOffset:running?-.046:.411;
  const railTravel=calves||running?0:kind==='heels'?.422:.486;
  const incline=bridge?.580*open:0;
  const shoulder=[0,.631,.411-.506];
  const pitch=-Math.PI/2-incline;
  const hip=bridge?add(shoulder,[0,-.506*Math.cos(pitch),-.506*Math.sin(pitch)])
    :[0,.631,parked-railTravel*open];
  const pose=body(hip,pitch);
  pose.planted={};
  for(const [side,sign] of sides) {
    const left=cycle((phase*2)%1,.38,.51);
    const right=cycle((phase*2+.5)%1,.38,.51);
    const heelRise=running?(sign>0?left:right):open;
    const tip=[sign*.144,footbar[1]+.011,footbar[2]-.011];
    let ankle,toe;
    if(calves||running||kind==='toes'){
      const angle=kind==='toes'?.785:mix(.025,1.037,heelRise);
      ankle=add(tip,[0,.146*Math.sin(angle),-.146*Math.cos(angle)]);
      toe=add(ankle,[0,-.146*Math.sin(angle),.146*Math.cos(angle)]);
    }else if(kind==='heels'){
      ankle=add(tip,[0,.041,-.033]);
      toe=add(ankle,[0,.141,.053]);
    }else{
      ankle=add(tip,[0,-.034,-.104]);
      toe=add(ankle,[sign*.008,.133,.066]);
    }
    foot(pose,side,sign,ankle,[sign*.16,.99,.06],add(toe,scale(ankle,-1)));
  }
  restArms(pose);
  return attachCarriage(pose,bridge?.111:hip[2]-.302);
}

function sliderStanding(phase,{kind}) {
  const open=cycle(phase,.42,.58);
  const lunge=kind==='russian-split';
  const squat=kind==='russian-squat';
  const forward=lunge;
  const fixedZ=.812;
  const slidingZ=mix(.357,lunge?-.090:squat?.193:-.203,open);
  const offset=forward?.032:.040;
  const hips=[0,mix(1.329,lunge?1.020:squat?1.031:1.251,open),
    mix((fixedZ+slidingZ)/2,(fixedZ+slidingZ)/2+.042,open)];
  const pose=body(hips,forward?mix(.014,.218,open):squat?mix(.016,.334,open):.001,forward?0:Math.PI/2);
  pose.planted={r:frameTop,l:frameTop};
  for(const [side,sign] of sides) {
    const fixed=forward?sign>0:sign<0;
    const anchor=[forward?sign*.135:offset,frameTop+.076,fixed?fixedZ:slidingZ];
    const shin=forward?[sign*.18,.09,.99]:[.98,.04,-sign*.19];
    foot(pose,side,sign,anchor,shin,forward?[sign*.017,-.068,.151]:[.144,-.068,-sign*.026]);
    if(lunge||squat){
      const shoulder=pose[side+'s'];
      const target=lunge?add(shoulder,[sign*.061,-.520,.083])
        :add(shoulder,[.11+.40*open,-.487+.355*open,-sign*.024]);
      [pose[side+'e'],pose[side+'w']]=joint(shoulder,target,[sign*.76,-.48,-.32],.252,.326);
    }else{
      const target=add(pose[side+'s'],[.061,-.121+.083*open,-sign*.545]);
      [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],target,[.53,-.84,-sign*.16],.252,.326);
    }
  }
  return attachCarriage(pose,slidingZ-.361);
}

function route(phase,stops) {
  const index=stops.findIndex(([at])=>phase<=at&&at>0);
  const [from,a]=stops[index-1];
  const [to,b]=stops[index];
  return blend(a,b,ramp(phase,from,to));
}

function strapArms(pose, targets, outward=.43) {
  for(const [index,[side,sign]] of sides.entries()){
    [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],targets[index],
      [sign*outward,-.65,.52],.252,.371);
    pose[side+'Grip']=[0,0,1];
  }
}

function armBands(phase,{kind}) {
  const hundred=kind==='hundred';
  const oneCircle=(2*phase)%1;
  const progress=phase<.5?oneCircle:1-oneCircle;
  const heading=progress*Math.PI*2;
  const bump=hundred?.024*Math.sin(phase*Math.PI*16):0;
  const hip=[0,.631,hundred?.120:.352];
  const torso=body(hip,-Math.PI/2+(hundred?.352:0));
  torso.planted={};
  const grips=[];
  for(const [side,sign] of sides){
    if(hundred){
      const angle=.430;
      const ankle=add(torso[side+'h'],[sign*.029,.824*Math.sin(angle),.824*Math.cos(angle)]);
      foot(torso,side,sign,ankle,[sign*.11,.92,.24],[sign*.013,-.049,.132]);
      grips.push([sign*.209,.642+bump,hip[2]+.045]);
    }else{
      foot(torso,side,sign,[sign*.144,.550,.766],[sign*.18,.96,.15],[sign*.017,.131,.061]);
      const shoulder=torso[side+'s'];
      grips.push(add(shoulder,[sign*(.042+.535*Math.sin(Math.PI*progress)),
        .095+.459*(1+Math.cos(heading))/2,.281*Math.sin(heading)+.090]));
    }
  }
  strapArms(torso,grips);
  return attachCarriage(torso,hip[2]-.302);
}

function chestExpansion(phase) {
  const draw=cycle(phase,.36,.68);
  const z=-.062-.126*draw;
  const torso=body([0,.977,z],.029,Math.PI);
  torso.planted={};
  const turn=.052*(cycle(phase,.37,.45)-cycle(phase,.57,.66));
  torso.head=add(torso.head,[turn,0,0]);
  const grips=[];
  for(const [side,sign] of sides){
    const x=-sign;
    const ankle=[x*.122,.575,z+.416];
    foot(torso,side,sign,ankle,[x*.24,.01,-.98],[x*.012,-.054,.135]);
    grips.push([x*.202,mix(1.196,.902,draw),z+mix(-.437,.228,draw)]);
  }
  strapArms(torso,grips);
  return attachCarriage(torso,z+.199);
}

function allThroughSpine(phase,{kind}) {
  const overhead=kind==='overhead';
  const [peel,legAngle,spread]=route(phase,[
    [0,[0,.418,0]],[.20,[.04,1.58,0]],[.41,[1,1.638,0]],
    [.51,[1,1.515,overhead?0:.170]],[.69,[.46,1.376,overhead?0:.164]],
    [.86,[0,.994,overhead?0:.126]],[1,[0,.418,0]],
  ]);
  const pitch=-Math.PI/2-1.022*peel;
  const shoulder=[0,.631,-.175];
  const hip=add(shoulder,[0,-.506*Math.cos(pitch),-.506*Math.sin(pitch)]);
  const torso=body(hip,pitch);
  torso.head=[0,.642,-.369];
  torso.neck=[0,.632,-.273];
  torso.planted={};
  const grips=[];
  for(const [side,sign] of sides){
    const full=add(torso[side+'h'],[sign*(spread-.051),.824*Math.sin(legAngle),.824*Math.cos(legAngle)]);
    foot(torso,side,sign,full,[sign*.11,.93,.22],[sign*.012,.127*Math.sin(legAngle),.127*Math.cos(legAngle)]);
    const armDown=ramp(phase,0,.29)*(1-ramp(phase,.73,1));
    grips.push([sign*.214,overhead?mix(1.118,.589,armDown):.576,mix(-.103,.319,overhead?armDown:1)]);
  }
  strapArms(torso,grips,.70);
  if(!overhead)for(const [side] of sides)delete torso[side+'Grip'];
  return attachCarriage(torso,.031-.039*peel);
}

function frogCircles(phase) {
  const [spread,rise,depth,wideKnee]=route(phase,[
    [0,[.055,.316,.298,1]],[.15,[.093,.560,.587,.23]],[.24,[.302,.497,.548,.12]],
    [.35,[.217,.336,.678,.08]],[.45,[.101,.344,.740,.08]],[.50,[.055,.316,.298,1]],
    [.59,[.101,.344,.740,.08]],[.69,[.217,.336,.678,.08]],
    [.79,[.302,.497,.548,.12]],[.89,[.093,.560,.587,.23]],[1,[.055,.316,.298,1]],
  ]);
  const torso=body([0,.631,.147],-Math.PI/2);
  torso.planted={};
  for(const [side,sign] of sides) {
    const ankle=[sign*spread,torso.hips[1]+rise,torso.hips[2]+depth];
    const pole=[sign*(.18+.88*wideKnee),.86-.45*wideKnee,.092];
    foot(torso,side,sign,ankle,pole,[sign*(.036+.067*wideKnee),.033,.128]);
  }
  restArms(torso);
  return attachCarriage(torso,-.155);
}

const jobs=[
  ['10654',footwork,{kind:'toes'},['quad','calf']],
  ['10655',footwork,{kind:'flat'},['quad']],
  ['10656',footwork,{kind:'heels'},['quad','glute']],
  ['10657',footwork,{kind:'calves'},['calf']],
  ['10848',footwork,{kind:'running'},['calf']],
  ['10849',footwork,{kind:'bridge'},['glute','hamstring','core']],
  ['10850',sliderStanding,{kind:'side-split'},['quad','glute']],
  ['10851',sliderStanding,{kind:'russian-squat'},['quad','glute']],
  ['10852',sliderStanding,{kind:'russian-split'},['l:quad','l:glute','r:quad','r:glute']],
  ['10854',armBands,{kind:'arm-circle',strap:'hands'},['shoulder','core']],
  ['10855',chestExpansion,{kind:'chest-expansion',strap:'hands'},['pec','shoulder']],
  ['10658',armBands,{kind:'hundred',strap:'hands'},['core']],
  ['10853',allThroughSpine,{kind:'long-spine',strap:'feet'},['core','hamstring']],
  ['10847',frogCircles,{kind:'frog-circle',strap:'feet'},['glute','quad','core']],
  ['10856',allThroughSpine,{kind:'overhead',strap:'hands'},['core','lat']],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact Pilates reformer IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate reformer ID.');
const root=resolve(directory);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,movement,options,muscles] of selected) {
  const standing=movement===sliderStanding;
  const spine=movement===allThroughSpine;
  const tall=movement===chestExpansion;
  const straps=options.strap;
  const shape=standing?'standing':straps??'footbar';
  const data={version:1,durationMs:spine||movement===frogCircles?6400:options.kind==='running'||straps?5400:4500,
    equipment:'lever-press-station-reformer-'+shape,
    muscles,camera:{yaw:standing?-72:spine?71:65,elevation:standing?13:18,
      height:standing?2.37:spine?options.kind==='long-spine'?2.39:2.20:tall?2.17:straps?1.89:1.66,
      focus:[0,standing?.98:spine?options.kind==='long-spine'?1.02:.97:tall?.84:straps?.66:.59,.036]},
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
