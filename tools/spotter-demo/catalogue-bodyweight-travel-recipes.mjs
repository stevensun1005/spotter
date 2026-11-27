import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, leg, ramp, rep, scale, sides, stand } from './bodyweight/pose.mjs';

const jobs=[];
const walkCam={yaw:49,elevation:13,focus:[0,.91,.10],height:2.25};
const frontCam={yaw:19,elevation:16,focus:[0,.87,.16],height:2.24};
const floorCam={yaw:58,elevation:19,focus:[0,.47,.16],height:1.95};
const plantY=.077;
const tau=Math.PI*2;
const wave=(x)=>Math.sin(x*tau);
function register(pose,equipment,muscles,camera,variants){
  for(const [id,profile]of variants)jobs.push({id,sample:p=>pose(p,profile),equipment:profile.equipment??equipment,
    muscles:profile.muscles??muscles,camera:{...camera,...profile.camera},duration:profile.duration??3880,poster:profile.poster??.38});
}

function support(pose,side,target,sign,heel=0,flip=false){
  const toe=[sign*.015,-.073-heel,.145];
  leg(pose,side,target,[sign*.089,-.039,1],toe,flip?undefined:0);
}

function stroll(phase,profile){
  const {kind,narrow=false,back=false,hold=false,cycle=2,reach=.252}=profile;
  const local=phase*cycle;
  const motion=local%1;
  const heelWalk=kind==='heel';
  const elevated=kind==='toe'||kind==='toe-side';
  const low=kind==='duck';
  const running=kind==='run'||kind==='wheel'||kind==='run-quick'||kind==='in-out'||kind==='run-squat';
  const restrained=kind==='water'||kind==='deck';
  const tuck=kind==='march'||kind==='high'||kind==='climber'||kind==='wheel'||kind==='forward-push';
  const stepKick=kind==='kick'||kind==='forward-push';
  const fast=kind==='run-quick'||kind==='in-out';
  const squat=kind==='run-squat' ? ramp(phase,.54,.69)*(1-ramp(phase,.78,.92)) : 0;
  const sideways=kind==='toe-side';
  const latter=hold?Math.sin(Math.PI*phase*2):1;
  const deck=kind==='deck'?.143:0;
  const depth=low?.403:elevated?.074:0;
  const pose=stand([sideways?.20*Math.sin(tau*phase):.031*wave(motion),.863+deck+(elevated?.050:0)-depth-.25*squat+
    (running?.046:.019)*Math.sin(Math.PI*2*motion)**2, sideways?.04: low?-.17:-.02],
    low?.284:running?.083+(back?-.038:.045):restrained?.017:.032,.068*wave(motion));
  for(const[side,sign]of sides){
    const p=(motion+(sign<0?.5:0))%1;
    const inAir=p>.48;
    const travel=inAir? -(1-2*ramp(p,.48,1)):1-2*ramp(p,0,.48);
    const swaying=inAir? Math.sin(Math.PI*(p-.48)/.52):0;
    const lower= low?.064:elevated?.081: fast?.084:running?.156:restrained?.097:.094;
    const lift=(lower+(tuck?(kind==='high'||kind==='march'?.424:.277):0))*swaying*(1-squat);
    const toeUp=heelWalk?.081:swaying>.04?.017:elevated?-.102:0;
    const footY=plantY+deck+lift+(elevated?.061:0)-(heelWalk?.032:0);
    const separation=narrow?.029:fast?.114:low?.162:.144;
    const footX=sideways ? (sign*.157+.24*travel*latter+pose.hips[0]) : sign*(separation+(kind==='in-out'?.142*(.5+.5*wave(motion)):0));
    const footZ=sideways ? .073:(back?-1:1)*reach*travel*(1-squat)+.033
      +(stepKick?.186*swaying*(1-squat):0);
    let toe=[sign*.015,heelWalk?toeUp:elevated?-.136:toeUp-.068,.134];
    if(elevated&&inAir)toe=[sign*.015,-.112,.108];
    const footImpulse=stepKick&&inAir ? ramp(p,.52,.77)*(1-ramp(p,.81,1)) : 0;
    const aim = [footX, footY*(1-footImpulse)+(kind==='kick'?.742:.666)*footImpulse,
      footZ*(1-footImpulse)+(kind==='kick'?.793:.719)*footImpulse];
    leg(pose,side,aim,[sign*.118,stepKick?.411:.16,1],toe,inAir?undefined:deck);
    const shoulder=pose[side+'s'];
    const swing=(p<.5?1:-1)*Math.sin(Math.PI*(p*2%1));
    let wrist=add(shoulder,[sign*(narrow?.539:.047),narrow?-.14:low?-.422:-.40,
      narrow?.038:low?.31:.097+(running||tuck?.189:.113)*swing]);
    if(kind==='climber')wrist=add(shoulder,[sign*.085,.116,.337]);
    if(low)wrist=add(pose[side+'h'],[sign*.089,.108,.248]);
    arm(pose,side,wrist,[sign*.63,-.61,-.48],[sign*.095,-.37,.93]);
  }
  if(deck)pose.machineTravel=1.548*phase;
  return pose;
}

function punchFlow(phase,profile){
  const {kind,raise=.0,spread,short}=profile;
  const t=rep(phase*2%1,short?.23:.33,short?.40:.55);
  const acting=phase<.5?'r':'l';
  const turn=(acting==='r'?1:-1)*t;
  const sit=kind==='chair'||kind==='v';
  const squat=kind==='squat';
  const standing=!sit&&!squat;
  const v=kind==='v';
  const kneeCurl=kind==='curl';
  const balance=kind==='balance';
  const step=kind==='step';
  const diag=kind==='diagonal';
  const pos=[0,v?.151:sit?.561:squat?.605:.869,step?.193*t:v?.034:squat?-.066:-.068];
  const pose=stand(pos,v?-.529:squat?.283:.051,turn*(diag?.569:.37));
  for(const[side,sign]of sides){
    const main=side===acting;
    const movement=main?t:0;
    if(v){
      leg(pose,side,[sign*.126,.256+sign*turn*.026,.691],[sign*.077,.937,.04],[sign*.02,-.065,.118]);
    }else if(sit){
      support(pose,side,[sign*.157,plantY,.415],sign);
    }else if(balance&&side==='l'){
      leg(pose,side,[.129,.45,.288],[.10,.091,1],[.018,-.076,.116]);
    }else if(kneeCurl&&main){
      const heel=blend([sign*.164,.078,.055],[sign*.159,.601,-.293],t);
      leg(pose,side,heel,[sign*.098,-.382,.89],[sign*.017,-.074,.135],movement>.03?undefined:0);
    }else{
      support(pose,side,[sign*(spread??.167),plantY,step&&main?.037+.520*t:standing?sign*.192+.029:.086],sign);
    }
    const shoulder=pose[side+'s'];
    const stop=add(shoulder,[sign*.017,.117,.170]);
    const reach=add(shoulder,[-sign*(diag?.397:.266),raise+(kind==='diagonal'?.208:.034),diag?.394:.537]);
    arm(pose,side,blend(stop,reach,movement),[sign*.59,-.69,-.31],[0,.032,1],[sign*.52,.70,-.12]);
  }
  return pose;
}

function walkingLunge(phase,{high}){
  const local=phase*2%1;
  const leading=phase<.5?'l':'r';
  const deep=ramp(local,.22,.48)*(1-ramp(local,.55,.85));
  const lift=high?ramp(local,.014,.143)*(1-ramp(local,.166,.342)):0;
  const travel=ramp(local,.05,.40)*(1-ramp(local,.67,1));
  const pose=stand([0,.870-.355*deep,.163*travel],.03+.201*deep);
  for(const[side,sign]of sides){
    const lead=side===leading;
    const height=lead?.354*lift:.078*deep;
    const z=lead?.040+.534*travel:.015-.266*travel;
    leg(pose,side,[sign*.151,.077+height,z],[sign*.107,-.013,1],[sign*.014,-.073-(lead?0:height),.145],
      lead&&lift>.026?undefined:0);
    const hand= high ? add(pose[side+'s'],[sign*.043,lead?-.433:-.079,lead?-.041:.351]) : add(pose[side+'h'],[sign*.073,.071,.090]);
    arm(pose,side,hand,[sign*.72,-.53,-.32]);
  }
  return pose;
}

function seatedWalk(phase,profile){
  const crab=profile.kind==='crab';
  const local=phase*2%1;
  const stride=Math.cos(tau*local);
  const turn=wave(local);
  const shift=crab?.291*Math.sin(tau*phase):.190*Math.sin(tau*phase);
  const pose=stand([.048*turn,crab?.441:.152,shift],crab?-1.230:-.25,.096*turn);
  for(const[side,sign]of sides){
    const active=(sign*stride+1)*.5;
    const target=[sign*(crab?.194:.139),crab?.077+.084*Math.max(0,sign*turn):.089+.071*active,
      shift+(crab?.431:.786)+sign*stride*(crab?.133:.092)];
    leg(pose,side,target,[sign*.135,.95,.027],[sign*.018,crab?-.073:.039,.143],crab&&Math.max(0,sign*turn)<.05?0:undefined);
    const hand=crab ? [sign*.232, .041+.093*Math.max(0,-sign*turn),shift-.468+sign*stride*.113] :
      add(pose[side==='l'?'rs':'ls'],[-sign*.011,-.088,.132]);
    arm(pose,side,hand,[sign*.65,-.52,-.39],crab?[sign*.061,-.060,1]:[-sign*.91,-.11,.41]);
  }
  return pose;
}

function runningEight(phase){
  const angle=phase*tau;
  const hip=[.722*Math.sin(angle),.862+.050*Math.sin(phase*tau*8)**2,.467*Math.sin(angle*2)];
  const yaw=Math.atan2(.722*Math.cos(angle),.934*Math.cos(2*angle));
  const face=[Math.sin(yaw),0,Math.cos(yaw)];
  const across=[Math.cos(yaw),0,-Math.sin(yaw)];
  const pose=stand(hip,.139,yaw,.065*Math.sin(angle));
  for(const[side,sign]of sides){
    const duty=(phase*8+(side==='r'?.5:0))%1;
    const z=.29*Math.cos(tau*duty);
    const lift=.18*Math.max(0,Math.sin(tau*duty));
    const place=add([hip[0],.078+lift,hip[2]],add(scale(face,z),scale(across,sign*.146)));
    leg(pose,side,place,add(face,scale(across,sign*.112)),add(scale(face,.139),[0,-.073,0]),lift<.008?0:undefined);
    const hand=add(pose[side+'s'],add(scale(face,-.177*Math.cos(tau*duty)+.105),add(scale(across,sign*.033),[0,-.358,0])));
    arm(pose,side,hand,add(scale(across,sign*.46),add(scale(face,-.81),[0,-.79,0])));
  }
  return pose;
}

register(stroll,'none',['quad','calf'],walkCam,[
  ['5700',{kind:'toe',reach:.278,duration:4280,muscles:['calf']}],
  ['4802',{kind:'toe',reach:.195,duration:3920,muscles:['calf'],camera:{yaw:67}}],
  ['10762',{kind:'toe-side',hold:true,reach:.203,muscles:['calf'],camera:{...frontCam,yaw:14}}],
  ['5970',{kind:'walk',narrow:true,reach:.197,duration:4460,camera:{yaw:32}}],
  ['5977',{kind:'walk',narrow:true,reach:.185,equipment:'conditioning-line',duration:4920,camera:{yaw:29}}],
  ['10294',{kind:'heel',reach:.169,duration:4110,muscles:['shin'],camera:{yaw:64}}],
  ['3867',{kind:'duck',reach:.213,muscles:['quad','glute'],camera:{yaw:62}}],
  ['11656',{kind:'water',reach:.124,cycle:2,duration:4970,equipment:'conditioning-water',camera:{yaw:46,elevation:21}}],
  ['0828',{kind:'deck',reach:.272,cycle:2,duration:3840,equipment:'rig-treadmill',camera:{yaw:65,focus:[0,1,.23],height:2.57}}],
  ['0829',{kind:'high',reach:.168,duration:4050,camera:{yaw:53}}],
  ['4420',{kind:'march',reach:.099,duration:3540,camera:{yaw:32}}],
  ['0827',{kind:'climber',reach:.131,cycle:3,duration:3100,muscles:['core','quad'],camera:{yaw:54}}],
  ['10749',{kind:'kick',reach:.239,duration:3770,camera:{yaw:63}}],
  ['4258',{kind:'run',back:true,reach:.299,cycle:3,duration:3150,muscles:['quad','calf','hamstring'],camera:{yaw:66}}],
  ['3638',{kind:'forward-push',reach:.234,cycle:2,duration:4120,muscles:['quad','calf','hamstring'],camera:{yaw:65}}],
  ['10747',{kind:'in-out',reach:.097,cycle:4,duration:3300,muscles:['quad','calf'],camera:{...frontCam,yaw:10}}],
  ['3196',{kind:'run-quick',reach:.136,cycle:5,duration:3050,muscles:['quad','calf'],camera:{yaw:38}}],
  ['3271',{kind:'run-squat',reach:.146,cycle:4,duration:3980,muscles:['quad','calf','glute'],camera:{yaw:54}}],
  ['3637',{kind:'wheel',reach:.322,cycle:3,duration:3080,muscles:['quad','calf','hamstring'],camera:{yaw:59}}],
]);

register(walkingLunge,'none',['quad','glute'],walkCam,[
  ['9700',{high:false,duration:5330,camera:{yaw:58}}],
  ['3655',{high:true,duration:5570,camera:{yaw:65}}],
]);
register(seatedWalk,'mat',['core','glute'],floorCam,[
  ['11571',{kind:'butt',duration:4190,camera:{yaw:47}}],
  ['10995',{kind:'crab',duration:5100,muscles:['core','glute','triceps'],equipment:'none',camera:{yaw:55}}],
]);
register(runningEight,'conditioning-cones',['quad','calf'],frontCam,[
  ['5989',{duration:6430,camera:{yaw:21,elevation:26,focus:[0,.85,.025],height:2.57}}],
]);

register(punchFlow,'none',['core','shoulder'],frontCam,[
  ['3531',{kind:'alternating',short:true,duration:2850,camera:{yaw:44}}],
  ['4437',{kind:'curl',duration:3520,muscles:['hamstring','core','shoulder'],camera:{yaw:49}}],
  ['5233',{kind:'squat',spread:.237,duration:3490,muscles:['quad','core','shoulder'],camera:{yaw:48}}],
  ['4824',{kind:'diagonal',short:true,raise:.082,duration:3480,camera:{yaw:42}}],
  ['6027',{kind:'step',short:true,duration:4120,camera:{yaw:56}}],
  ['8424',{kind:'chair',equipment:'conditioning-chair',duration:3580,camera:{yaw:37,focus:[0,.76,.16],height:1.97}}],
  ['5975',{kind:'balance',duration:4280,muscles:['core','shoulder','glute'],camera:{yaw:48}}],
  ['4989',{kind:'v',equipment:'mat',duration:4290,camera:{...floorCam,yaw:48}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(job=>ids.includes(job.id)):jobs;
if(!selected.length||ids.length&&selected.length!==ids.length)throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const job of selected){
  const recipe={version:1,equipment:job.equipment,muscles:job.muscles,camera:job.camera,durationMs:job.duration,
    keyframes:Array.from({length:65},(_,i)=>({at:i/64,...job.sample(i/64)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(output,job.id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id:job.id,recipe:job.id+'.json',posterAt:job.poster});
  }catch(error){
    failures.push([job.id,error.message]);
  }
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
