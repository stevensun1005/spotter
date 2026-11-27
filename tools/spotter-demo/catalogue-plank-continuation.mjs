import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { pushUp, inchworm } from './bodyweight/floor.mjs';
import { add, arm, blend, leg, mix, ramp, rep, sides, stand, torso } from './bodyweight/pose.mjs';

const floor=[57,21,.46,-.10,1.73];
const jobs=[];
function register(draw,variants,camera=floor){
  for(const [id,profile] of variants)jobs.push({id,make:phase=>draw(phase,profile),profile,camera});
}
const cycle=(t,start,peak,end)=>ramp(t,start,peak)*(1-ramp(t,peak,end));
const strike=(phase,order=1)=>phase<.5?order:-order;
const local=phase=>phase*2%1;
const toe=(sign)=>[sign*.009,-.075,.113];
function floorLeg(pose,side,sign,target){
  leg(pose,side,target,[sign*.12,-.88,.33],toe(sign),target[1]<.105?0:undefined);
}
function kneelingPose(pose,x,z){
  for(const [side,sign] of sides){
    pose[side+'k']=[x+sign*.135,.105,z];
    pose[side+'a']=[x+sign*.144,.153,z-.414];
    pose[side+'t']=[x+sign*.154,.055,z-.518];
  }
}
function floorHands(pose,width=.224,z=.502,guide=[.67,.067,-.76]){
  for(const [side,sign] of sides)arm(pose,side,[sign*width,.052,z],[sign*guide[0],guide[1],guide[2]],[0,-.041,1]);
}
function twistShoulders(pose,angle,hips=true){
  for(const [left,right] of hips?[['ls','rs'],['lh','rh']]:[['ls','rs']]){
    const middle=blend(pose[left],pose[right],.5);
    const half=Math.hypot(...pose[left].map((n,i)=>(n-pose[right][i])*.5));
    pose[left]=add(middle,[half*Math.cos(angle),half*Math.sin(angle),0]);
    pose[right]=add(middle,[-half*Math.cos(angle),-half*Math.sin(angle),0]);
  }
}

function pressSequence(phase,profile){
  const {kind,knees=false}=profile;
  const alternating=!['legLift','turnedKnees','offset','crossed','negative','planche','knuckles','lay','release','handles'].includes(kind);
  const active=strike(phase);
  const t=alternating?local(phase):phase;
  const follow=!(kind==='corkscrew'||kind==='grasshopper'||!alternating);
  const scene=follow?Math.min(1,t/.54):kind==='negative'?ramp(t,0,.73)*.45+ .55*ramp(t,.72,.996):t;
  const action=follow?cycle(t,.50,.73,.995):rep(t);
  const down=kind==='release'||kind==='lay';
  const descend=down?rep(t,.38,.67):0;
  const plank=pushUp(down?Math.min(1,t*.99):scene,{knees,width:kind==='planche'?.179:kind==='crossed'?.097:.225,
    shallow:kind==='scapulaSingle',scapula:kind==='scapulaSingle',incline:kind==='handles'?.131:0,
    z:kind==='handles'?.52:undefined,reverse:kind==='planche'});
  if(down){
    const base=stand([0,.548-.412*descend,-.106],1.43+.121*descend);
    const raise=kind==='release'?cycle(t,.40,.53,.64):0;
    for(const [side,sign] of sides){
      floorLeg(base,side,sign,[sign*.134,.098,-.827]);
      arm(base,side,[sign*(.225+.081*raise),.056+.091*raise,.479],
        [sign*.75,.145,-.71],[0,-.041,1]);
    }
    return base;
  }
  if(kind==='corkscrew')twistShoulders(plank,active*.34*action);
  if(kind==='turnedKnees')twistShoulders(plank,.19*action);
  if(kind==='twist')twistShoulders(plank,active*1.47*action);
  if(kind==='planche'){
    for(const k of ['ls','rs','neck','head','chest'])plank[k][2]+=.141;
  }
  for(const [side,sign] of sides){
    const actual=sign===active;
    const shoulder=plank[side+'s'];
    let hand=plank[side+'w'];
    let fingers=[0,-.042,1];
    if(kind==='offset')hand=[sign*.219,.052,.477+sign*.156];
    if(kind==='crossed'){hand=[-sign*.100,.056,.437+sign*.055];fingers=[-sign*.81,-.032,.57];}
    if(kind==='planche'){hand=[sign*.181,.052,.378];fingers=[sign*.811,-.024,-.56];}
    if(kind==='knuckles'){hand=[sign*.216,.052,.453];fingers=[0,-.94,.21];}
    if(kind==='twist'&&actual)hand=blend(hand,add(shoulder,[sign*.034,.593,.064]),action);
    else if(kind==='crossHand'&&actual)hand=blend(hand,[-sign*.291,.104,.488],action);
    else if(kind==='row'&&actual)hand=blend(hand,add(shoulder,[sign*.062,-.202,-.267]),action);
    else if(kind==='bird'&&actual)hand=blend(hand,add(shoulder,[sign*.065,.045,.574]),action);
    else if(kind==='drag'&&actual)hand=blend(hand,[sign*.258,.071,-.154],action);
    else if(kind==='oneKneeling'&&!actual)hand=add(plank.hips,[sign*.07,.131,.07]);
    else if(kind==='scapulaSingle'&&!actual)hand=add(plank.hips,[sign*.092,.146,.071]);
    arm(plank,side,hand,[sign*(kind==='crossed'?.30:.64),.11,-.78],fingers);
    if(kind==='handles'||kind==='knuckles')plank[side+'Grip']=[0,0,1];
    if(knees){
      if(kind==='turnedKnees'){
        plank[side+'k'][0]+=.176;
        plank[side+'a'][0]+=.267;
        plank[side+'t'][0]+=.280;
      }
      continue;
    }
    if((kind==='tuck'||kind==='outside'||kind==='grasshopper')&&actual){
      floorLeg(plank,side,sign,[sign*mix(.133,kind==='grasshopper'?-.194:kind==='outside'?.383:.098,action),
        .099+.112*action,mix(-.806,.168,action)]);
    }else if(kind==='bird'&&!actual || kind==='legLift'&&side==='r'){
      const lift=kind==='legLift'?.203:.226*action;
      floorLeg(plank,side,sign,[sign*.158,.098+lift,-.827-.043*action]);
    }else if(kind==='jack'){
      const out=cycle(t,.51,.71,.91);
      const flight=.12*Math.sin(Math.PI*out);
      floorLeg(plank,side,sign,[sign*(.125+.268*out),.098+flight,-.819]);
    }
  }
  return plank;
}

function risingPlank(phase,profile){
  const active=strike(phase,profile.order??1), t=local(phase);
  const a=cycle(t,.03,.29,.98);
  const b=cycle(t,.245,.52,.80);
  const height=mix(.331,.650,(a+b)*.5);
  const footZ=-.845, length=.843;
  const pitch=Math.acos((height-.101)/(length+.502));
  const hip=[active*.027*(a-b),.101+length*Math.cos(pitch),footZ+length*Math.sin(pitch)];
  const pose=torso(hip,pitch);
  for(const [side,sign] of sides){
    floorLeg(pose,side,sign,[sign*(profile.wide?.192:.149),.098,footZ]);
    const p=sign===active?a:b;
    const wrist=[sign*.208,.073,mix(.811,.439,p)];
    arm(pose,side,wrist,[sign*.18,.134,-.94],[0,-.044,1]);
    const elbow=[sign*.198,.087,.447];
    if(p<.82)pose[side+'e']=blend(pose[side+'e'],elbow,(1-p/.82)**1.35);
  }
  return pose;
}

function horizontalTrack(phase,profile){
  const type=profile.kind;
  const active=strike(phase),t=local(phase);
  const a=rep(t,.33,.62);
  const hops=type==='double'?(phase<.42?rep(phase/.21%1):0):type==='burst'||type==='wideHop'||type==='sideHop'?a:0;
  const flight=Math.sin(Math.PI*hops)*.111;
  const sideShift=type==='sideHop'?active*hops*.41:0;
  const hipY=(profile.forearm?.301:profile.bear?.395:.55)+.05*flight/.11;
  const breathing=type==='cross'?.015*Math.sin(Math.PI*phase)**2:0;
  const moveForward=type==='stepForward';
  const moveAside=type==='stepSide';
  const hip=[moveAside?active*a*.24:sideShift*.42,hipY+breathing-(type==='hipRoll'?.061*a:0),
    -.091+(moveForward?.24*a:0)];
  const pose=torso(hip,profile.forearm?1.54:1.434);
  if(type==='hipRoll'){
    for(const [limb,sign] of sides){
      pose[limb+'h'][0]=hip[0]+sign*.103*Math.cos(a*1.02);
      pose[limb+'h'][1]=hip[1]+active*sign*.103*Math.sin(a*1.02);
    }
  }
  const width=type==='cross'?.475:.212;
  for(const [side,sign] of sides){
    let lift=sign===active?a:0;
    const liftArm=lift;
    let liftLeg=lift;
    if(type==='bird')liftLeg=1-lift;
    if(type==='double'&&phase>.42)liftLeg=(Math.floor((phase-.42)/.145)%2===0)===(side==='l')?rep(((phase-.42)/.145)%1):0;
    let x=sign*(type==='cross'?.421:.141);
    let y=.097+flight,z=profile.bear?-.362:-.824;
    if(type==='bird'){y+=.211*(sign!==active?a:0);}
    if(type==='bearKick'){
      if(sign===active){
        z=mix(-.369,-.883,liftLeg);
        y=mix(.188,.489,liftLeg);
      }else {z=-.434;y=.086;}
    }
    if(type==='outside'||type==='climb'||type==='double'||type==='legClimb'){
      const drive=type==='double'&&phase<.42?0:type==='legClimb'?cycle(t,.39,.64,.93):liftLeg;
      y+=.179*drive+(type==='legClimb'&&sign===active?.227*cycle(t,0,.218,.427):0);
      z+=.834*drive;
      x+=sign*(type==='outside'?.334:.063)*drive;
    }
    if(type==='kneeTap'&&sign===active){
      z+=.058*liftLeg;
      y-=.015*liftLeg;
    }
    if(type==='double'||type==='wideHop'||type==='burst')x+=sign*.272*hops;
    if(type==='sideHop')x+=sideShift;
    const lead=cycle(t,0,.27,.85);
    const follow=cycle(t,.17,.52,.96);
    const travel=sign===active?lead:follow;
    if(moveAside)x+=active*.44*travel;
    if(moveForward)z+=.39*travel;
    if(moveAside||moveForward)y+=.075*Math.sin(travel*Math.PI);
    floorLeg(pose,side,sign,[x,y,z]);
    const hand=[sign*width,.052,.460];
    let target=hand;
    const s=pose[side+'s'];
    if(type==='bird'&&sign===active) target=blend(hand,add(s,[sign*.050,.069,.578]),liftArm);
    if(type==='row'&&sign===active) target=blend(hand,add(s,[sign*.067,-.057,-.347]),liftArm);
    if((type==='raise'||type==='tap')&&sign===active)target=blend(hand,
      type==='raise'?add(s,[sign*.593,.052,-.013]):[sign*.625,.052,.394],liftArm);
    if(moveAside)target=[hand[0]+active*.44*travel,hand[1]+.081*Math.sin(Math.PI*travel),hand[2]];
    if(moveForward)target=[hand[0],hand[1]+.074*Math.sin(Math.PI*travel),hand[2]+.43*travel];
    if(type==='burst')target=[sign*(width+.140*hops),hand[1]+flight,hand[2]+.119*hops];
    if(profile.forearm){
      pose[side+'e']=[sign*.224,.089,.427];
      pose[side+'w']=[sign*.211,.051,.789];
      pose[side+'Fingers']=[0,-.027,1];
    }else{
      arm(pose,side,target,[sign*.61,.09,-.76],[0,-.02,1]);
    }
  }
  return pose;
}

function transitions(phase,profile){
  const {kind,knees=false}=profile;
  const side=strike(phase);
  const alternating=kind==='toe'||kind==='rotation';
  const p=alternating?local(phase):phase;
  const first=kind==='childFirst'||kind==='hindu';
  const dog=(kind==='pike'||kind==='toe'||kind==='child'||first)?(kind==='pike'?rep(p):first?1-rep(p):cycle(p,.47,.75,.999)):0;
  const arch=kind==='cobra'||kind==='hindu'||kind==='seal'?cycle(p,.31,.60,.93):0;
  const descend=kind==='seal'?1-arch:kind==='pike'?0:cycle(p,.005,.27,.5)*(1-dog);
  const kneeAngle=.395-1.49*dog+.86*descend+.65*arch;
  const y=kind==='seal'?.154:knees?.105+.422*Math.cos(kneeAngle):mix(.523,kind==='toe'?.912:.925,dog)-.232*descend-.350*arch;
  const z=kind==='seal'?-.121:knees?-.349+.422*Math.sin(kneeAngle):mix(-.082,kind==='toe'?-.480:-.200,dog)+.136*arch;
  const angle=kind==='seal'?1.54-1.098*arch:1.427+(kind==='toe'?1.269:.892)*dog+.296*descend-.988*arch;
  const pose=torso([0,y,z],angle);
  if(knees)kneelingPose(pose,0,-.349);
  else for(const [limb,sign] of sides) {
    if(kind==='seal')floorLeg(pose,limb,sign,[sign*.155,.102,-.922]);
    else floorLeg(pose,limb,sign,[sign*.143,.099,-.838]);
  }
  for(const [limb,sign] of sides){
    const floorPos=[sign*.215,.052,.529];
    const toeReach=kind==='toe'&&sign===side?cycle(p,.61,.78,.97):0;
    const oppositeToe=pose[sign>0?'rt':'lt'];
    const target=blend(floorPos,add(oppositeToe,[0,.052,.029]),toeReach);
    const fingers=blend([0,-.029,1],[0,-.61,-.79],toeReach);
    arm(pose,limb,target,[sign*.62,.10,-.79],fingers);
  }
  return pose;
}

function reversePress(phase,profile){
  const phaseWithinRep=profile.leg?local(phase):phase;
  const rise=rep(phaseWithinRep,.31,.71);
  const deck=profile.crab?.353:profile.forearm?.259:.439;
  const height=profile.crab?deck-.120*rise:profile.leg?deck:mix(.169,deck,rise);
  const pitch=profile.crab?-1.09:profile.forearm?-1.317:-1.198;
  const hips=[0,height,-.049];
  const pose=torso(hips,pitch);
  for(const [side,sign] of sides){
    const lift=profile.leg&&sign===strike(phase)?cycle(phaseWithinRep,.35,.65,.91):0;
    const angle=mix(-.406,1.352,lift);
    const target=lift>.001?
      [sign*.145,hips[1]+.831*Math.sin(angle),hips[2]+.831*Math.cos(angle)]:
      [sign*(profile.crab?.21:.144),.102,profile.crab?.445:profile.forearm?.772:.718];
    leg(pose,side,target,[sign*.138,.84,.14],[sign*.014,-.075,.132],lift<.003?0:undefined);
    if(profile.forearm){
      pose[side+'e']=[sign*.214,.074,-.524];
      pose[side+'w']=[sign*.231,.052,-.157];
      pose[side+'Fingers']=[0,-.028,1];
    }else{
      arm(pose,side,[sign*.227,.052,profile.crab?-.466:-.490],[sign*.48,.064,-.83],[0,-.049,1]);
    }
  }
  return pose;
}

function frontRotation(phase,forearm){
  const active=strike(phase);
  const t=rep(local(phase),.31,.67);
  const y=forearm?.331+.165*t:.636;
  const pitch=Math.acos((y-.097)/1.344);
  const pose=torso([-.064*active*t,.097+.842*Math.cos(pitch),-.840+.842*Math.sin(pitch)],pitch);
  twistShoulders(pose,t*active*(forearm?1.10:1.47));
  for(const[side,sign] of sides){
    const height=.097+(sign===active?.112*t:0);
    floorLeg(pose,side,sign,[sign*mix(.152,.024,t),height,-.840+.074*sign*t]);
    const s=pose[side+'s'];
    const floor=[sign*.22,.059,forearm?.761:.462];
    if(forearm&&sign!==active){
      pose[side+'e']=[sign*.214,.087,.402];
      pose[side+'w']=floor;
    }else{
      const lifted=add(s,[sign*.009,.602,.05]);
      arm(pose,side,sign===active?blend(floor,lifted,t):floor,[sign*.483,-.113,-.817]);
    }
  }
  return pose;
}

function sideRotation(phase,profile){
  const t=rep(phase);
  const support=profile.support??-1;
  const pose=torso([0,.486-.085*t*(profile.thread?1:0),-.093],-Math.PI/2,support*(-Math.PI/2+(profile.thread?.99*t:0)));
  for(const [side,sign] of sides){
    const bottom=sign===support;
    const y=bottom?.102:profile.adduction?.219+.134*t:.219;
    const ankle=[sign*.038,y,bottom&&profile.adduction?.286:.717];
    leg(pose,side,ankle,[sign*.20,.73,.37],[sign*.022,-.074,.13],bottom&&!profile.adduction?0:undefined);
    const s=pose[side+'s'];
    if(bottom){
      pose[side+'e']=[sign*.111,.079,-.567];
      pose[side+'w']=[sign*.348,.050,-.291];
      pose[side+'Fingers']=[sign*.63,-.035,.76];
    }else{
      const raised=profile.thread?add(s,[0,.594,-.061]):add(s,[sign*.054,.280,-.524]);
      const end=profile.thread?add(pose.chest,[support*.28,-.271,.181]):add(pose.hips,[sign*.042,.272,.041]);
      arm(pose,side,blend(raised,end,t),[sign*.51,.53,-.65]);
    }
  }
  return pose;
}

register(pressSequence,[
  ['0134',{kind:'turnedKnees',knees:true}],['3906',{kind:'row',knees:true}],['4060',{kind:'bird'}],['0261',{kind:'corkscrew'}],
  ['3784',{kind:'crossed'}],['3979',{kind:'crossHand'}],['0468',{kind:'grasshopper'}],['3947',{kind:'release'}],
  ['8894',{kind:'tuck'}],['3492',{kind:'twist',knees:true}],['5278',{kind:'offset',knees:true}],['4192',{kind:'knuckles'}],
  ['5997',{kind:'lay'}],['5556',{kind:'negative',duration:5600}],['3824',{kind:'planche'}],['0654',{kind:'tuck'}],
  ['1486',{kind:'handles',equipment:'push-up-handles'}],['5030',{kind:'jack'}],['6537',{kind:'drag'}],['4162',{kind:'outside'}],
  ['4859',{kind:'twist'}],['4860',{kind:'tuck'}],['0667',{kind:'legLift'}],['0681',{kind:'twist',knees:true}],
  ['3553',{kind:'twist'}],['3002',{kind:'oneKneeling',knees:true}],['2946',{kind:'scapulaSingle'}],['3964',{kind:'twist'}],
]);
register(risingPlank,[
  ['3266',{order:1}],['2978',{wide:true}],['2793',{order:-1}],['2890',{order:-1,wide:true}],
]);
register(horizontalTrack,[
  ['6442',{kind:'bearKick',bear:true}],['9002',{kind:'bird'}],['7499',{kind:'double',duration:6380}],['7859',{kind:'burst'}],
  ['3959',{kind:'stepForward'}],['3750',{kind:'sideHop'}],['4385',{kind:'hipRoll',forearm:true}],['1193',{kind:'cross'}],
  ['3982',{kind:'climb'}],['6804',{kind:'row'}],['2792',{kind:'wideHop'}],['9999',{kind:'kneeTap',forearm:true}],
  ['3852',{kind:'raise'}],['9821',{kind:'legClimb'}],['3665',{kind:'bird'}],['8399',{kind:'tap'}],
  ['3958',{kind:'stepSide'}],['6092',{kind:'outside'}],
]);
register(transitions,[
  ['4500',{kind:'pike'}],['3488',{kind:'cobra'}],['6231',{kind:'child',knees:true}],['3489',{kind:'cobra',knees:true}],
  ['4984',{kind:'hindu',knees:true}],['3265',{kind:'child',knees:true}],['4830',{kind:'childFirst',knees:true}],
  ['3984',{kind:'toe'}],['3977',{kind:'toe'}],['2944',{kind:'seal'}],
], [61,20,.50,-.12,1.91]);
register(reversePress,[
  ['5045',{forearm:true}],['4934',{}],['3663',{leg:true}],['3751',{crab:true}],
]);
register(sideRotation,[['6026',{}]], [35,19,.44,-.04,1.76]);
register(sideRotation,[['4991',{thread:true}],['7854',{thread:true,support:1}]], [34,20,.66,-.04,1.94]);
register((phase,profile)=>frontRotation(phase,profile.forearm),[['3954',{}],['0464',{forearm:true}]], [43,21,.54,-.05,1.92]);
register(inchworm,[['3854',{}]], [62,17,.90,.28,2.28]);
const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass the output directory and optionally exact catalogue IDs.');
const selected=ids.length?jobs.filter(({id})=>ids.includes(id)):jobs;
if(!selected.length||(ids.length&&selected.length!==ids.length))throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[],failures=[];
for(const{id,make,profile,camera:[yaw,elevation,y,z,height]}of selected) {
  try{
    const keyframes=Array.from({length:65},(_,i)=>({at:i/64,...make(i/64)}));
    const recipe={version:1,equipment:profile.equipment??'none',durationMs:profile.duration??5200,
      muscles:profile.kind?['core','pec','triceps']:['core'],camera:{yaw,elevation,focus:[0,y,z],height},keyframes};
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:profile.duration? .48:.36});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
