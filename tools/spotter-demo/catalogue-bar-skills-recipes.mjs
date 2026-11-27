import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, torso } from './bodyweight/pose.mjs';

const clamp=(value,low=0,high=1)=>Math.min(high,Math.max(low,value));
const pi=Math.PI;
const cross=[1,0,0];
const reverse=[-1,0,0];
const long=[0,0,1];
const barY=2.144;
const barZ=.097;

function barGrip(pose,limb,sign,{width=.296,y=barY,z=barZ,under=false,neutral=false,around=0}={}){
  const axis=neutral?long:under?reverse:cross;
  grip(pose,limb,[sign*width,y,z],[sign*.53,-.53,.31+around],axis);
}

function looseArm(pose,limb,sign){
  arm(pose,limb,add(pose[limb+'s'],[sign*.060,-.54,.088]),[sign*.38,-.37,-.81],[0,-1,.15],[sign,0,0]);
}

function hangingCore(phase,{mode}){
  const left=rep(clamp(phase*2),.35,.63);
  const right=rep(clamp(phase*2-1),.35,.63);
  const cycle=left-right;
  const lift=rep(phase,mode==='l-hold'?.27:.43,mode==='l-hold'?.73:.57);
  const straightHigh=mode==='toes'||mode==='one-toes';
  const curl=mode==='hip-knees'||mode==='knees-elbows'||mode==='hip-straight'||straightHigh;
  const single=mode==='one-toes';
  const sling=mode.startsWith('sling-');
  const side=mode==='side-bend';
  const tilt=side?.179*cycle:0;
  const move=curl?lift:0;
  const height=(sling?1.018:1.072)+(straightHigh?.121:.087)*move+(mode==='scapula'?.106*lift:0)+(side?.093*Math.abs(cycle):0);
  const pose=stand([single?.124:side?.187*cycle:0,height,.028-.087*move],-.022-.180*move,0,tilt);
  for(const [limb,sign] of sides){
    if(sling){
      const hand=[sign*.396,1.814,.110];
      grip(pose,limb,hand,[sign*.85,-.41,1],[0,.80,-.19]);
    }else if(single&&sign<0)looseArm(pose,limb,sign);
    else barGrip(pose,limb,sign,{width:single?.180:.300});

    if(mode==='alternating-knee'){
      const n=sign===1?left:right;
      legAngles(pose,limb,sign,mix(-pi/2,.52,n),mix(-pi/2,-1.40,n),.012);
    }else if(mode==='deadbug'){
      const n=sign===1?left:right;
      legAngles(pose,limb,sign,.073-.18*n,mix(-1.57,.073,n),.017);
    }else if(mode==='flutter'){
      const angle=-.972+sign*.316*Math.sin(phase*6*pi);
      legAngles(pose,limb,sign,angle,angle+.067,.012);
    }else if(mode==='half-windmill'){
      const draw=ramp(phase,.10,.91);
      const arc=pi*(draw-.50);
      const amount=rep(phase,.26,.72);
      const ankle=add(pose[limb+'h'],[.598*Math.sin(arc)*amount,-.833+.696*Math.cos(arc)*amount,.525*amount]);
      leg(pose,limb,ankle,[.27*Math.sin(arc),.49,.73],[.019,-.048,.146]);
    }else if(mode==='knee-circle'){
      const spin=(2*phase)%1;
      const angle=spin*2*pi;
      const extend=rep(spin,.24,.69);
      const knee=[sign*.116+.22*Math.sin(angle)*extend,height-.431+.713*extend,.018+.383*extend];
      pose[limb+'k']=knee;
      const raw=add(knee,[.093*Math.sin(angle)*extend,-.415,.017-.082*extend]);
      const support=Math.hypot(...knee.map((n,i)=>n-pose[limb+'h'][i]));
      const normalized=add(pose[limb+'h'],scale(knee.map((n,i)=>n-pose[limb+'h'][i]),.422/support));
      pose[limb+'k']=normalized;
      pose[limb+'a']=add(raw,normalized.map((n,i)=>n-knee[i]));
      pose[limb+'t']=add(pose[limb+'a'],[sign*.012,-.069,.129]);
    }else if(side){
      leg(pose,limb,add(pose[limb+'h'],[.435*cycle,-.829+.124*Math.abs(cycle),.121*Math.abs(cycle)]),
        [sign*.10,.09,.97],[sign*.01,-.075,.129]);
    }else{
      const angle=mode==='hollow'?mix(-1.28,-1.15,lift):mode==='scapula'?-1.536:
        mix(-1.551,straightHigh?1.48:mode==='knees-elbows'?1.00:mode==='hip-knees'?.75:
          mode==='hip-straight'?.29:mode==='sling-straight'?.085:mode==='l-hold'?0:.134,lift);
      const bent=['sling-knees','knee-raise','hip-knees','knees-elbows'].includes(mode);
      const shin=bent?mix(-1.56,mode==='knees-elbows'?-.508:-1.526,lift):angle+.034;
      legAngles(pose,limb,sign,angle,shin,.013);
    }
  }
  return pose;
}

function leverMotion(phase,{kind}){
  const rear=kind==='rear';
  const negative=kind==='negative';
  const reps=kind==='reps';
  const tuck=kind==='tuck'||kind==='advance';
  const amount=rep(phase,kind==='raise'?.46:.29,kind==='raise'?.56:.71);
  const training=rep(phase,.37,.58);
  const angle=negative?mix(pi-.075,1.535,rep(phase,.65,.77))
    :reps?mix(1.540,1.108,training):mix(.025,1.559,amount);
  const pitch=rear?angle:-angle;
  const shoulderY=barY-.610*Math.cos(angle*.317);
  const shoulderZ=barZ+(rear?1:-1)*.610*Math.sin(angle*.317);
  const pose=torso([0,shoulderY-.502*Math.cos(pitch),shoulderZ-.502*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    if(tuck){
      const extend=kind==='advance'?.431:.282;
      const ankle=add(pose[limb+'h'],[sign*.103,mix(-.762,-.321,amount),extend*amount]);
      leg(pose,limb,ankle,[sign*.21,.85,.41],[sign*.018,-.063,.129]);
    }else{
      const handstand=negative?angle*.997:angle;
      const step=-pi/2+(rear?-handstand:handstand);
      legAngles(pose,limb,sign,step,step+.030,.014);
    }
    barGrip(pose,limb,sign,{width:.297,around:rear?-.30:.41});
  }
  return pose;
}

const hangCam={yaw:60,elevation:12,focus:[0,1.15,.15],height:2.57};
const holdCam={...hangCam,yaw:67,focus:[0,1.20,.26],height:2.65};
const coreJobs=[['10735','alternating-knee'],['4373','deadbug'],['4766','flutter'],['4891','half-windmill'],
  ['6547','hollow'],['4767','knee-circle'],['3890','knees-elbows'],['11877','l-hold'],['1764','hip-knees'],
  ['0472','knee-raise'],['4177','scapula'],['9489','side-bend'],['0474','hip-straight'],['3891','toes'],
  ['11091','one-toes'],['2355','sling-knees'],['2333','sling-straight']];
const leverJobs=[['3297','rear'],['3296','front'],['3295','reps'],['9044','advance'],['9045','hold'],
  ['7251','raise'],['9043','tuck'],['11090','negative']];
const jobs=[...coreJobs.map(([id,mode])=>[id,hangingCore,{mode},mode.startsWith('sling')?'hanging-arm-slings':'pull-up',
  mode==='scapula'?['lat','trap']:['core'],{...hangCam,yaw:mode==='side-bend'||mode==='half-windmill'?36:60},
  mode==='flutter'?4500:mode==='l-hold'?5650:mode==='alternating-knee'?5600:5050,mode==='alternating-knee'?.25:.49]),
  ...leverJobs.map(([id,kind])=>[id,leverMotion,{kind},'pull-up',['lat','core'],
    {...holdCam,yaw:kind==='rear'?123:70,focus:kind==='negative'?[0,1.58,.23]:[0,1.19,kind==='rear'?-.25:.34],
      height:kind==='negative'?3.22:2.60},kind==='negative'?6300:5200,.49])];

function ordinaryPullUp(phase,{mode,width=.299,under=false,neutral=false}){
  const floor=mode==='jump'||mode==='squat'||mode==='slider';
  const box=mode==='box'||mode==='one-box';
  const one=mode==='one-negative';
  const commando=mode==='commando';
  const around=mode==='around';
  const rear=mode==='rear';
  const scap=mode==='scapular';
  const holding=mode==='hold'||mode==='bent-hold';
  const controlled=mode==='negative'||mode==='hold-negative'||one;
  const trail=(commando||around)?(2*phase)%1:phase;
  const active=phase<.5||phase===1?1:-1;
  const lift=controlled?1-ramp(phase,mode==='hold-negative'?.32:.12,.84)*ramp(1-phase,0,.14):
    rep(trail,holding?.27:.42,holding?.73:.59);
  const lower=mode==='half'?1-.51*rep(phase,.46,.54):lift;
  const takeoff=mode==='jump'?rep(clamp(phase/.350),.36,.59):0;
  const jump=mode==='jump'?rep(clamp((phase-.17)/.83),.38,.55):lift;
  let y=mode==='slider'?1.416:mode==='squat'?1.652:mode==='jump'?1.932:neutral||mode==='cage-wide'?2.144:barY;
  const z=mode==='slider'?.112:mode==='squat'?.092:mode==='jump'?.087:barZ;
  let hipY=mode==='slider'?.511+.330*lift:mode==='squat'?.620+.338*lift:
    mode==='jump'?.898-.115*takeoff+.529*jump:scap?1.071+.096*lift:1.075+.388*lower;
  if(mode==='bent-hold')hipY+=.058*(1-lift);
  const x=one?.214:around?.197*lift*active:mode==='uneven'?.100:0;
  const drift=scap?.164*Math.sin(phase*2*pi):0;
  const hipZ=commando?.058+.219*lift*active:rear?.048+.189*lift:mode==='slider'?-.223+.242*lift:.029-.089*lift+drift;
  const pitch=scap?-.028+.225*Math.sin(phase*2*pi):rear?.003+.155*lift:mode==='slider'?-.098+.131*lift:-.030-.043*lift;
  const pose=stand([x,hipY,hipZ],pitch,commando?pi/2:around?.47*lift*active:0);
  for(const [limb,sign] of sides){
    if(mode==='slider'){
      pose[limb+'k']=[sign*.165,.099+lift*.105,.168+.266*lift];
      pose[limb+'a']=[sign*.162,.077,.168+.266*lift-.421];
      pose[limb+'t']=[sign*.173,.011,pose[limb+'a'][2]-.103];
    }else if(floor||box){
      const assist=mode==='box'||mode==='one-box'&&sign===1;
      const take=mode==='jump'?.294*jump:0;
      const h=assist?.463:mode==='squat'?0:mode==='jump'?take:.294+.258*lower;
      leg(pose,limb,[sign*.159,.076+h,assist?.557:mode==='squat'?.211:.046+lift*.058],
        [sign*.23,.077,1],[sign*.016,-.074,.138],assist?.463:mode==='squat'?0:mode==='jump'&&jump<.01?0:null);
    }else{
      const angle=scap?-pi/2+.29*Math.sin(phase*2*pi):-pi/2+.067*lift;
      const bend=scap?.01:.16+.19*lift;
      legAngles(pose,limb,sign,angle,angle-bend,.015);
    }
    if(one&&sign<0){looseArm(pose,limb,sign);continue;}
    const gripAxis=commando?[sign,0,0]:mode==='mixed'&&sign<0?reverse:under?reverse:neutral?long:cross;
    const localY=mode==='uneven'&&sign<0?1.820:y;
    grip(pose,limb,[sign*width,localY,z],[sign*(width>.37?.89:.48),-.54,commando?active*.63:rear?-.66:.36],gripAxis);
  }
  return pose;
}

function muscleUp(phase,{kip}){
  const drive=rep(clamp((phase-.075)/.925),.32,.64);
  const kipSwing=kip?Math.sin(4*pi*phase)*ramp(phase,0,.18)*(1-ramp(phase,.61,.85)):0;
  const transfer=ramp(drive,.52,.86);
  const hipY=1.074+.896*drive;
  const pitch=-.031-.181*kipSwing+.178*transfer;
  const pose=torso([0,hipY,.024-.194*drive+.398*transfer+.159*kipSwing],pitch);
  for(const [limb,sign] of sides){
    const legAngle=-1.54+.234*kipSwing+.132*drive;
    legAngles(pose,limb,sign,legAngle,legAngle-.06-.21*Math.abs(kipSwing),.013);
    grip(pose,limb,[sign*.322,barY,barZ],[sign*.56,mix(-.88,-.32,transfer),mix(.16,-.87,transfer)],cross);
  }
  return pose;
}

function seatedPullUp(phase,{mode,width,under=false}){
  const low=mode==='low'||mode==='narrow';
  const hold=mode==='seated-hold';
  const commando=mode==='seated-commando';
  const higher=mode==='seated-elevated';
  const amount=rep(commando?(2*phase)%1:phase,hold?.29:.43,hold?.74:.60);
  const side=phase<.5||phase===1?1:-1;
  const y=low?1.041:higher?1.400:1.235;
  const z=low?.198:.127;
  const hipY=(higher?.348:low?.159:.178)+(.331+.037*Number(higher))*amount;
  const pose=stand([0,hipY,low?.139:higher?.155:.273],mix(-.14,-.56,amount),commando?pi/2:0);
  for(const [limb,sign] of sides){
    const footHeight=higher?.421:0;
    leg(pose,limb,[sign*.141,.076+footHeight,(higher?.909:low?.833:.992)-.135*amount],
      [sign*.17,.86,.22],[sign*.018,-.072,.130],footHeight);
    grip(pose,limb,[sign*width,y,z+(commando?sign*.016:0)],[sign*.73,-.58,commando?.41*side:.38],
      commando?[sign,0,0]:under?reverse:cross);
  }
  if(commando)pose.head=add(pose.head,[0,0,side*.131*amount]);
  return pose;
}

function monkeyBarClimb(phase){
  const cycles=phase*3;
  const stride=.371;
  const hipZ=-.572+cycles*stride;
  const wave=Math.sin(cycles*2*pi);
  const pose=stand([.056*wave,1.117+.032*Math.abs(wave),hipZ],.031+.094*wave,0,.052*wave);
  for(const [limb,sign] of sides){
    const q=cycles+(sign===1?0:.5);
    const part=q%1;
    const swing=ramp(part,.48,.95);
    const handZ=-.614+(Math.floor(q)+swing)*stride;
    const handY=part>.47?2.173-.171*Math.sin(pi*clamp((part-.47)/.52)):2.173;
    const destination=[sign*.230,handY,handZ];
    grip(pose,limb,destination,[sign*.73,-.55,-.37],cross);
    legAngles(pose,limb,sign,-1.56-sign*.231*wave,-1.63-sign*.189*wave,.018);
  }
  return pose;
}

const pullVariants=[
  ['5236',{mode:'bent-hold',width:.221,under:true}],['9511',{mode:'box',width:.288}],['9512',{mode:'one-box',width:.288}],
  ['4724',{mode:'squat',width:.238,under:true}],['4725',{mode:'hold-negative',width:.222,under:true}],
  ['4207',{mode:'around',width:.297,under:true}],['5479',{mode:'close',width:.090}],
  ['4726',{mode:'commando',width:.117,under:false}],['10902',{mode:'one-negative',width:.254}],
  ['1865',{mode:'cage-neutral',width:.193,neutral:true}],['9320',{mode:'hold',width:.110,under:true}],
  ['1198',{mode:'jump',width:.311}],['4919',{mode:'slider',width:.227,under:true}],['0627',{mode:'mixed',width:.292}],
  ['4913',{mode:'half',width:.107}],['7385',{mode:'negative',width:.329}],['0678',{mode:'front-lead',width:.341}],
  ['10948',{mode:'scapular',width:.295}],['5474',{mode:'under',width:.115,under:true}],
  ['4983',{mode:'hold',width:.302}],['6961',{mode:'uneven',width:.326}],['8189',{mode:'wide',width:.467,under:true}],
  ['1866',{mode:'cage-wide',width:.469}],['1367',{mode:'rear',width:.453}],
];
const specialPullProps={box:'pull-up-assist-box','one-box':'pull-up-assist-box',squat:'assisted-squat-bar',
  'cage-neutral':'body-cage-neutral','cage-wide':'body-cage-wide',jump:'assisted-jump-bar',slider:'assisted-knee-slider',
  uneven:'pull-up-offset-towel',wide:'wide-pull-up',rear:'wide-pull-up'};
jobs.push(...pullVariants.map(([id,config])=>[id,ordinaryPullUp,config,specialPullProps[config.mode]??'pull-up',
  config.mode==='scapular'?['lat','trap']:['lat','biceps'],{...hangCam,yaw:config.mode==='rear'?112:config.mode==='commando'?31:56},
  config.mode.includes('negative')||config.mode.includes('hold')?5600:4600,config.mode.includes('negative')?.13:.49]));
jobs.push(...[['5194',false],['0558',true]].map(([id,kip])=>[id,muscleUp,{kip},'pull-up',['lat','biceps','triceps'],
  {...hangCam,yaw:63,focus:[0,1.44,.13],height:3.19},5300,.48]));
const seatedVariants=[['4773','narrow',.141,true],['4781','seated',.258,true],['4780','low',.196,true],
  ['4782','seated-commando',.115,false],['9317','seated-hold',.284,false],['4785','seated',.289,false],
  ['4783','seated-elevated',.285,false],['4784','low',.337,false],['4806','seated',.432,false]];
jobs.push(...seatedVariants.map(([id,mode,width,under])=>[id,seatedPullUp,{mode,width,under},
  mode==='low'||mode==='narrow'?'assisted-low-bar':mode==='seated-elevated'?'seated-pull-up-elevated':'seated-pull-up-bar',
  ['lat','biceps'],{...hangCam,yaw:mode==='seated-commando'?36:59,focus:[0,.76,.38],height:1.91},5200,.49]));
jobs.push(['4216',monkeyBarClimb,{},'monkey-bars',['lat','forearm','core'],{...hangCam,yaw:74,focus:[0,1.16,.10],height:2.68},5800,.53]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or repeated bar skill ID.');
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
