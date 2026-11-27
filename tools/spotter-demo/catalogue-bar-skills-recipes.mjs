import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, torso, unit } from './bodyweight/pose.mjs';

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
    {...holdCam,yaw:kind==='rear'?123:70,focus:kind==='negative'?[0,1.64,.23]:[0,1.19,kind==='rear'?-.25:.34],
      height:kind==='negative'?3.65:2.60},kind==='negative'?6300:5200,.49])];

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
  const y=mode==='slider'?1.281:mode==='squat'?1.652:mode==='jump'?1.932:barY;
  const z=mode==='slider'?.112:mode==='squat'?.092:mode==='jump'?.087:barZ;
  let hipY=mode==='slider'?.491+.071*lift:mode==='squat'?.620+.338*lift:
    mode==='jump'?.907-.080*takeoff+.529*jump:scap?1.071+.096*lift+.055*Math.abs(Math.sin(phase*2*pi)):1.075+.388*lower;
  if(mode==='bent-hold')hipY+=.058*(1-lift);
  const x=one?.214:around?.197*lift*active:mode==='uneven'?.100:0;
  const drift=scap?.164*Math.sin(phase*2*pi):0;
  const hipZ=commando?.058+.219*lift*active:rear?.048+.189*lift:mode==='slider'?-.212+.238*lift:.029-.089*lift+drift;
  const pitch=scap?-.028+.225*Math.sin(phase*2*pi):rear?.003+.155*lift:mode==='slider'?-.29+.365*lift:-.030-.043*lift;
  const pose=stand([x,hipY,hipZ],pitch,commando?pi/2:around?.47*lift*active:0);
  for(const [limb,sign] of sides){
    if(mode==='slider'){
      pose[limb+'k']=[sign*.165,.099,.002+.222*lift];
      pose[limb+'a']=[sign*.162,.077,.002+.222*lift-.421];
      pose[limb+'t']=[sign*.173,.011,pose[limb+'a'][2]-.103];
    }else if(floor||box){
      const assist=mode==='box'||mode==='one-box'&&sign===1;
      const take=mode==='jump'?.294*jump:0;
      const h=assist?.649:mode==='squat'?0:mode==='jump'?take:.294+.258*lower;
      leg(pose,limb,[sign*.159,.076+h,assist?.287:mode==='squat'?.211:.046+lift*.058],
        [sign*.23,.077,1],[sign*.016,-.074,.138],assist?.649:mode==='squat'?0:mode==='jump'&&jump<.01?0:null);
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

function muscleUp(phase,{kip,horizontal=false}){
  const drive=rep(clamp((phase-.075)/.925),.32,.64);
  const kipSwing=kip?Math.sin(4*pi*phase)*ramp(phase,0,.18)*(1-ramp(phase,.61,.85)):0;
  const transfer=ramp(drive,.52,.86);
  const hipY=(horizontal?.948:1.074)+(horizontal?.837:.896)*drive;
  const pitch=-.031-.181*kipSwing+.178*transfer;
  const pose=torso([0,hipY,.024-.194*drive+.398*transfer+.159*kipSwing],pitch);
  for(const [limb,sign] of sides){
    const legAngle=-1.54+.234*kipSwing+.132*drive;
    legAngles(pose,limb,sign,legAngle,legAngle-.06-.21*Math.abs(kipSwing),.013);
    grip(pose,limb,[sign*.322,horizontal?1.932:barY,horizontal?.087:barZ],
      [sign*.56,mix(-.88,-.32,transfer),mix(.16,-.87,transfer)],cross);
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
    const ankleY=.076+footHeight;
    const legDepth=Math.sqrt(.832**2-(hipY-ankleY)**2);
    if(commando){
      pose[limb+'h']=add(pose.hips,[0,0,-sign*.103]);
      leg(pose,limb,[legDepth,ankleY,pose.hips[2]-sign*.141],[.22,.86,-sign*.17],[.130,-.072,-sign*.018],footHeight);
    }else leg(pose,limb,[sign*.141,ankleY,pose.hips[2]+legDepth],[sign*.17,.86,.22],[sign*.018,-.072,.130],footHeight);
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
const specialPullProps={box:'pull-up-lifted-box','one-box':'pull-up-lifted-box',squat:'assisted-squat-bar',
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

function railExercise(phase,{mode}){
  const tall=mode==='high-dip'||mode==='wide-dip'||mode==='inverted-shrug';
  const korean=mode==='korean';
  const extended=mode==='impossible';
  const hold=mode==='hold';
  const raise=mode.startsWith('leg-');
  const shrug=mode==='shrug'||mode==='inverted-shrug';
  const upside=mode==='inverted-shrug';
  const pulse=rep(phase,hold?.23:.43,hold?.76:.58);
  const form=mode==='wide-dip';
  const railY=tall?1.388:1.175;
  const handZ=korean?-.210:.039;
  const topY=railY+(korean?.049:.093);
  const drop=raise?.018*pulse:hold?.010*Math.sin(phase*4*pi):shrug?.095*pulse:.379*pulse;
  const hipZ=korean?.013+.092*pulse:extended?.083+.253*pulse:form?-.075-.13*pulse:.031-.054*pulse;
  const tilt=korean?.083+.056*pulse:extended?-.267-.420*pulse:form?.114+.327*pulse:.049+.128*pulse;
  const hips=upside?[0,railY-.069-.079*pulse,.038]:[0,topY-drop,hipZ];
  const pose=torso(hips,upside?pi-.033:tilt);
  for(const [limb,sign] of sides){
    if(upside){
      legAngles(pose,limb,sign,pi/2,pi/2,.012);
    }else if(raise||extended){
      const max=mode==='leg-roll'?.244:mode==='leg-long'?.146:0;
      const angle=extended?-.612-.391*pulse:mix(-1.53,max,pulse);
      legAngles(pose,limb,sign,angle,angle-(mode==='leg-roll'?.238*pulse:.036),.018);
    }else{
      const angle=-pi/2+(form?-.151*pulse:.047*pulse);
      legAngles(pose,limb,sign,angle,angle-.451-.211*pulse,.009);
    }
    const width=form?.392:korean?.262:.266;
    grip(pose,limb,[sign*width,railY,handZ],[sign*(form?.79:.41),-.37,upside?.79:-.87],korean?cross:long);
  }
  return pose;
}

function railPushUp(phase,{combo}){
  const dip=combo?rep(clamp((phase-.62)/.38),.38,.61):0;
  const lean=combo?rep(phase,.57,.87):1;
  const down=combo?rep(clamp(phase/.47),.42,.59):rep(phase,.45,.60);
  const y=combo?1.175:.176;
  const z=combo?.083:.520;
  const width=combo?.266:.225;
  const pitch=combo?mix(1.424,.064,lean):mix(1.025,1.438,down);
  const ankleZ=combo?-.787:-.601;
  const hipY=combo?mix(1.375-.236*down,1.286-.346*dip,lean):.081+.833*Math.cos(pitch);
  const hipZ=combo?mix(-.248,.026,lean):ankleZ+.833*Math.sin(pitch);
  const pose=torso([0,hipY,hipZ],pitch);
  for(const [limb,sign] of sides){
    const supported=[sign*(combo?.257:.133),combo?1.238:.081,ankleZ];
    const hanging=[sign*.130,hipY-.762,hipZ-.21];
    const ankle=combo?blend(supported,hanging,lean):supported;
    leg(pose,limb,ankle,[sign*.14,combo?-.67:.77,.28],[sign*.016,-.072,.125],combo?lean<.003?1.175:null:0);
    grip(pose,limb,[sign*width,y,z],[sign*.78,-.43,-.55],long);
  }
  return pose;
}

function railDepression(phase){
  const lower=rep(phase,.33,.73);
  const pose=torso([0,.851-.118*lower,-.118-.293*lower],.890+.494*lower);
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.177,.077,-.422-.034*lower],[sign*.13,.21,.95],[sign*.012,-.071,.14],0);
    grip(pose,limb,[sign*.266,1.175,.182],[sign*.59,-.37,-.80],long);
  }
  return pose;
}

function captainSideHip(phase){
  const lift=rep(clamp(2*phase),.37,.63)-rep(clamp(2*phase-1),.37,.63);
  const pose=torso([.089*lift,.884+.072*Math.abs(lift),-.165],-.043);
  for(const [limb,sign] of sides){
    pose[limb+'e']=[sign*.276,1.206,-.101];
    pose[limb+'w']=[sign*.281,1.242,.223];
    pose[limb+'Grip']=long;
    leg(pose,limb,[sign*.116+.502*lift,.126+.235*Math.abs(lift),.056],
      [sign*.17,.43,.89],[sign*.008,-.069,.141]);
  }
  return pose;
}

function floorDip(phase){
  const local=(phase*2)%1;
  const down=rep(local,.44,.59);
  const reach=rep(local,.24,.71);
  const active=phase<.5||phase===1?1:-1;
  const pose=torso([0,.253-.131*down,.264],-.689-.091*down);
  for(const [limb,sign] of sides){
    const forward=sign===active?reach:0;
    const extendedY=.291-.040*down;
    const difference=extendedY-pose.hips[1];
    const extendedZ=pose.hips[2]+Math.sqrt(.831**2-difference**2);
    const foot=[sign*.151,mix(.076,extendedY,forward),mix(.742,extendedZ,forward)];
    leg(pose,limb,foot,[sign*.41,.95,.14],[sign*.019,-.074,.126],forward>.001?null:0);
    arm(pose,limb,[sign*.216,.062,-.187],[sign*.61,-.04,-.68],[0,-.028,-1],[1,0,0]);
  }
  return pose;
}

const railJobs=[['1442','hold'],['3289','impossible'],['4043','inverted-shrug'],['3288','korean'],['4176','shrug'],
  ['8143','high-dip'],['2363','wide-dip'],['0826','leg-hold'],['5477','leg-roll'],['3623','leg-long']];
const railProps={'inverted-shrug':'tall-parallel-dips','high-dip':'tall-parallel-dips','wide-dip':'wide-parallel-dips',korean:'straight-dip'};
jobs.push(...railJobs.map(([id,mode])=>[id,railExercise,{mode},railProps[mode]??'parallel-dips',
  mode.startsWith('leg')?['core']:mode.includes('shrug')?['trap']:['triceps','pec'],
  {...hangCam,yaw:mode==='korean'?123:63,focus:[0,1.18,.04],height:2.53},mode==='hold'?4900:4750,.50]));
jobs.push(['6910',railPushUp,{combo:false},'push-up-handles',['pec','triceps'],{...hangCam,yaw:59,focus:[0,.59,0],height:1.71},4750,.49],
  ['4775',railPushUp,{combo:true},'long-parallel-dips',['pec','triceps'],{...hangCam,yaw:61,focus:[0,1.09,-.32],height:2.30},6500,.26],
  ['1989',railDepression,{},'parallel-dips',['lat','shoulder'],{...hangCam,yaw:62,focus:[0,.89,-.11],height:2.05},5400,.49],
  ['0709',captainSideHip,{},'captains-chair',['core'],{...hangCam,yaw:34,focus:[0,.92,.04],height:2.06},5300,.25],
  ['4364',floorDip,{},'none',['triceps'],{...hangCam,yaw:58,focus:[0,.56,.25],height:1.65},4900,.49]);

function narrowInversionRow(phase,{kind,width=.26}){
  const low=kind==='close'||kind==='supinated'||kind==='bent-under';
  const pads=kind==='pads';
  const slide=pads||kind==='slide';
  const rails=kind==='rails';
  const wide=kind==='wide';
  const bent=rails||kind==='bent-table'||kind==='bent-under';
  const table=kind.includes('table');
  const bite=rep(phase,.42,.60);
  const support=low?.945:rails?1.175:table?.979:1.041;
  const handZ=low?-.429:rails?.058:table?-.360:.198;
  const pitch=mix(low?-1.236:slide||wide?-1.141:table?-1.265:-1.272,
    low?-.852:slide||wide?-.850:table?-1.036:-.799,bite);
  const heelZ=low?.426:table?.573:rails?.781:wide?1.112:.990+.142*bite;
  const legSpan=bent?.425:.829;
  const pose=torso([0,.076+legSpan*Math.cos(pitch)+(rails?.220:bent?.108:0),heelZ+legSpan*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    const footTop=pads?.025:0;
    leg(pose,limb,[sign*.144,.076+footTop,heelZ],[sign*.12,.96,.10],[sign*.009,.007,.139],footTop);
    grip(pose,limb,[sign*(rails?.266:width),support,handZ],[sign*.51,-.52,.67],rails?long:low?reverse:cross);
  }
  return pose;
}

function clothInversionRow(phase,{rear=false}={}){
  const pull=rep(phase,.43,.61);
  const pose=torso([0,.673+.145*pull,-.152+.162*pull],mix(-.851,-.342,pull));
  for(const [limb,sign] of sides)leg(pose,limb,[sign*.157,.077,.221],[sign*.12,.91,.19],[sign*.021,-.072,.131],0);
  pose.straps=sides.map(([limb,sign])=>{
    const anchor=[sign*.087,2.161,.640];
    const wish=[sign*(rear?.354:.283),1.149+.103*pull,.034+.088*pull];
    const end=add(anchor,scale(unit(subtract(wish,anchor)),1.184));
    grip(pose,limb,end,[sign*(rear?.98:.49),rear?.12:-.58,.64],cross);
    return {side:limb,anchor,end,axis:cross};
  });
  return pose;
}

function assistedSeatNordic(phase){
  const lower=rep(phase,.42,.60);
  const pitch=mix(.028,1.227,lower);
  const pose=torso([0,.523+.419*Math.cos(pitch),.060+.419*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    pose[limb+'k']=[sign*.136,.523,.060];
    pose[limb+'a']=[sign*.137,.511,-.361];
    pose[limb+'t']=[sign*.145,.452,-.485];
    const held=add(pose[limb+'s'],[sign*.066,-.209,.254]);
    arm(pose,limb,blend(held,[sign*.208,.326,1.073],lower),[sign*.61,-.40,-.66],[0,-.05,1],[1,0,0]);
  }
  return pose;
}

const bodyRowRecords=[['0139','close',.148],['5517','supinated',.297],['7554','rails',.266],
  ['4769','slide',.294],['4974','pads',.286],['3381','table',.269],['3382','bent-table',.269]];
const bodyRowProps={close:'inverted-row',supinated:'inverted-row',rails:'parallel-dips',slide:'assisted-low-bar',
  pads:'inverted-row-slider',table:'inverted-row-table','bent-table':'inverted-row-table'};
jobs.push(...bodyRowRecords.map(([id,kind,width])=>[id,narrowInversionRow,{kind,width},bodyRowProps[kind],['lat','biceps'],
  {...hangCam,yaw:kind.includes('table')?69:59,focus:[0,.73,.25],height:1.77},4850,.50]));
jobs.push(['3749',clothInversionRow,{},'adjustable-sheet-assist',['lat','biceps'],
  {...hangCam,yaw:29,focus:[0,1.12,.16],height:2.61},4750,.49],
  ['2400',assistedSeatNordic,{},'kneeling-cable-seat',['hamstring','glute'],
    {...hangCam,yaw:70,focus:[0,1.08,.11],height:2.40},5250,.54]);

function stallBarMovement(phase,{kind}){
  const move=rep(phase,kind==='leg'?.43:.31,kind==='leg'?.60:.71);
  if(kind==='leg'){
    const pose=torso([0,1.022+.060*move,-.185],-.018-.111*move);
    for(const [limb,sign] of sides){
      barGrip(pose,limb,sign,{width:.274,y:2.080,z:-.311});
      const angle=mix(-1.55,.351,move);
      legAngles(pose,limb,sign,angle,angle+.029,.014);
    }
    return pose;
  }
  if(kind==='chest'){
    const pose=stand([.598,.874,.078+.061*move],.018,.24+.704*move);
    for(const [limb,sign] of sides)leg(pose,limb,[.621+sign*.152,.076,.225],[sign*.12,.18,.95],[sign*.016,-.072,.132],0);
    looseArm(pose,'l',1);
    grip(pose,'r',[.401,1.435,-.311],[-.82,-.31,.15],cross);
    return pose;
  }
  if(kind==='shin'){
    const pose=stand([0,.836+.034*move,.315-.106*move],.042+.173*move,pi);
    [pose.lh,pose.rh]=[pose.rh,pose.lh];
    leg(pose,'l',[-.142,.125,-.191],[-.22,.14,-.91],[0,.018,-.120]);
    leg(pose,'r',[.163,.076,.596],[.16,.12,-.98],[0,-.072,-.138],0);
    for(const [limb,sign] of sides)grip(pose,limb,[-sign*.228,1.220,-.311],[-sign*.45,-.69,.22],cross);
    return pose;
  }
  const pose=stand([0,.882-.209*move,.339+.123*move],.692+.326*move,pi);
  [pose.lh,pose.rh]=[pose.rh,pose.lh];
  for(const [limb,sign] of sides){
    leg(pose,limb,[-sign*.174,.076,.699],[-sign*.137,.53,-.69],[0,-.073,-.13],0);
    grip(pose,limb,[-sign*.286,1.435,-.311],[-sign*.45,-.59,.31],cross);
  }
  return pose;
}

const stallVariants=[['11878','leg'],['1783','chest'],['1928','shin'],['1799','back']];
jobs.push(...stallVariants.map(([id,kind])=>[id,stallBarMovement,{kind},'training-stall-bars',
  kind==='leg'?['core']:kind==='shin'?['shin']:kind==='chest'?['pec']:['lat'],
  {...hangCam,yaw:kind==='chest'?51:62,focus:[kind==='chest'?.295:0,1.16,.0]},5300,.48]));
jobs.push(['1818',phase=>{
  const tuck=rep(phase,.31,.73);
  const pose=torso([0,1.092-.036*tuck,.019],.041);
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.151,.539,.552],[sign*.24,.54,1],[0,-.076,.127],.463);
    barGrip(pose,limb,sign,{width:.233,under:true});
  }
  return pose;
},{},'pull-up-assist-box',['forearm','biceps'],{...hangCam,yaw:54},5500,.52]);

function standingWallRow(phase,{kind}){
  const door=kind==='door';
  const one=kind.startsWith('single');
  const squat=kind==='squat';
  const narrow=kind.includes('narrow');
  const local=one?(phase*2)%1:phase;
  const side=phase<.5||phase===1?1:-1;
  const row=rep(local,.42,.61);
  const dir=door?1:-1;
  const height=squat?.515+.036*row:.830+.037*row;
  const depth=door?-.220+.128*row:squat?.156-.134*row:.088-.071*row;
  const pitch=squat?mix(-.29,.143,row):mix(-.375,-.045,row);
  const pose=stand([one?.067*side:0,height,depth],pitch,door?0:pi);
  if(!door)[pose.lh,pose.rh]=[pose.rh,pose.lh];
  const width=door?.443:narrow?.110:.199;
  for(const [limb,sign] of sides){
    const footZ=door?-.168:squat?.183:-.041;
    leg(pose,limb,[dir*sign*.153,.076,footZ],[dir*sign*.28,-.025,dir],
      [dir*sign*.011,-.072,dir*.134],0);
    if(one&&sign!==side){looseArm(pose,limb,sign);continue;}
    const rungX=door?sign*width:one?-side*(narrow?.078:.257):-sign*width;
    const rungY=door?1.239:squat?.790:1.220;
    grip(pose,limb,[rungX,rungY,door?.015:-.311],
      [dir*sign*(narrow?.14:.65),-.42,-dir*.35],door?[0,1,0]:cross);
  }
  return pose;
}

function fixedBarStretch(phase,{back}){
  const hold=rep(phase,.32,.70);
  const pitch=back?mix(.75,1.431,hold):mix(.065,-.505,hold);
  const pose=torso([0,(back?.826:.857)-(back?.105:.074)*hold,back?-.223-.201*hold:.157-.070*hold],pitch);
  const wristY=back?1.057:1.491;
  for(const [limb,sign] of sides){
    const footZ=back?-.494:.206;
    leg(pose,limb,[sign*.169,.076,footZ],[sign*.18,.44,.88],[sign*.009,-.072,.135],0);
    grip(pose,limb,[sign*.201,wristY,.312],[sign*.53,-.52,.43],cross);
  }
  return pose;
}

function humanFlag(phase){
  const hold=rep(phase,.33,.72);
  const tilt=-1.475*hold;
  const pose=stand([mix(.231,.720,hold),mix(.903,1.461,hold),.066],.005,0,tilt);
  for(const [limb,sign] of sides){
    pose[limb+'h']=add(pose.hips,[sign*.103*Math.cos(tilt),-sign*.103*Math.sin(tilt),0]);
    const drop=blend([.367+sign*.081,.076,.087],add(pose[limb+'h'],[.826,-.038,sign*.023]),hold);
    leg(pose,limb,drop,[sign*.01,.27,.95],[.115,-.043,.033],hold<.003?0:null);
    const high=sign===1;
    const gripY=high?mix(1.842,2.105,hold):mix(1.209,.780,hold);
    grip(pose,limb,[.015,gripY,.083],[sign*.16,high?.13:-.92,-.51],[0,1,0]);
  }
  return pose;
}

function handboard(phase,{kind}){
  const hold=rep(phase,.24,.74);
  const elbow=kind==='90'?.294:kind==='135'?.147:.023;
  const pose=torso([0,1.087+(elbow-.019)*hold,.096-.036*hold],-.052+.026*hold);
  const curl=kind==='crimp'?.80:kind==='slope'?.32:kind==='open'?.41:.62;
  for(const [limb,sign] of sides){
    legAngles(pose,limb,sign,-1.53,-1.58,.014);
    const wrist=[sign*.241,kind==='crimp'?2.132:2.145,kind==='slope'?.166:.144];
    arm(pose,limb,wrist,[sign*.51,-.38,.48],[sign*.016,.973,kind==='slope'?-.36:-.184],[sign,.013,.027]);
    pose[limb+'FingerCurl']=curl;
    pose[limb+'FingerSpread']=kind==='open'?.61:kind==='crimp'?.21:.37;
  }
  return pose;
}

function floorTowelRow(phase){
  const curl=rep(phase,.42,.61);
  const pose=torso([0,.137,.166-.039*curl],mix(-1.57,-1.341,curl));
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.159,.076,.652],[sign*.28,.95,.22],[sign*.012,-.072,.134],0);
    const anchor=[sign*.028,.514,-.695];
    const aim=[sign*.199,mix(.405,.345,curl),mix(-.522,-.422,curl)];
    const grasp=add(anchor,scale(unit(subtract(aim,anchor)),.321));
    grip(pose,limb,grasp,[sign*.74,-.61,.35],cross);
  }
  return pose;
}

function pulseRow(phase){
  const setup=rep(phase,.22,.78);
  const bounce=rep(clamp((phase-.20)/.59),.23,.81)*Math.cos(phase*18*pi);
  const pose=torso([0,.781,-.178],1.076);
  for(const [limb,sign] of sides){
    leg(pose,limb,[sign*.155,.076,.049],[sign*.23,.06,1],[sign*.015,-.072,.133],0);
    const shoulder=pose[limb+'s'];
    arm(pose,limb,add(shoulder,[sign*.053,mix(-.587,-.260,setup)+.040*bounce,-.152*setup]),
      [sign*.28,.34,-.92],[0,-.77,.17],[sign,0,0]);
  }
  return pose;
}

const doorwayWallVariants=[['3506','door'],['3168','squat'],['3156','single-narrow'],['3158','narrow'],['3162','single'],['3166','normal']];
jobs.push(...doorwayWallVariants.map(([id,kind])=>[id,standingWallRow,{kind},kind==='door'?'doorway':'training-stall-bars',
  ['lat','biceps'],{...hangCam,yaw:kind==='door'?142:65,focus:[0,1.06,kind==='door'?-.067:-.13],height:2.39},4900,kind.startsWith('single')?.25:.50]));
jobs.push(['1052',fixedBarStretch,{back:true},'fixed-back-stretch-bar',['lat','core'],{...hangCam,yaw:68,focus:[0,.91,-.13],height:2.18},5500,.49],
  ['5146',fixedBarStretch,{back:false},'fixed-hangback-bar',['lat','shoulder'],{...hangCam,yaw:63,focus:[0,1.02,-.021],height:2.28},5500,.49],
  ['3303',humanFlag,{},'human-flag-post',['lat','shoulder','core'],{...hangCam,yaw:20,focus:[.479,1.17,.083],height:2.65},5300,.49],
  ['4770',narrowInversionRow,{kind:'wide',width:.413},'assisted-low-bar',['lat','biceps'],{...hangCam,yaw:61,focus:[0,.79,.40],height:1.97},4850,.48],
  ['1223',narrowInversionRow,{kind:'bent-under',width:.248},'inverted-row',['lat','biceps'],{...hangCam,yaw:62,focus:[0,.80,-.02],height:1.92},4850,.48],
  ['3495',floorTowelRow,{},'floor-towel-pole',['lat','biceps'],{...hangCam,yaw:56,focus:[0,.58,-.14],height:1.75},4900,.49],
  ['3822',pulseRow,{},'none',['lat','trap'],{...hangCam,yaw:64,focus:[0,.89,.06],height:2.14},4950,.50],
  ['3746',clothInversionRow,{rear:true},'adjustable-sheet-assist',['rearShoulder','lat'],
    {...hangCam,yaw:19,focus:[0,1.13,.18],height:2.60},5000,.50]);
const handboardRecords=[['3834','crimp'],['3836','135'],['3835','90'],['3833','open'],['3832','slope']];
jobs.push(...handboardRecords.map(([id,kind])=>[id,handboard,{kind},kind==='slope'?'climbing-sloper-board':kind==='crimp'?'climbing-crimp-board':'climbing-hangboard',
  ['forearm','lat'],{...hangCam,yaw:30,focus:[0,1.19,.07],height:2.55},5550,.51]));

function lastHangPatterns(phase,{mode}){
  const alternate=mode==='shift'||mode==='side-chin';
  const sway=alternate?rep(clamp(phase*2),.40,.69)-rep(clamp(phase*2-1),.40,.69):0;
  const one=mode==='one';
  const rest=mode==='rest';
  const chin=mode==='sternum'||mode==='gorilla'||mode==='side-chin';
  const inv=mode==='inverted';
  const lift=mode==='side-chin'?Math.abs(sway):rep(phase,.39,.63);
  const hipY=inv?1.053+.080*lift:1.080+(chin?.391:alternate?.065:one?.012:0)*lift+(rest?.012*Math.sin(4*pi*phase):0);
  const hipX=one?.174:mode==='side-chin'?.268*sway:.179*sway;
  const hipZ=inv?-.400:mode==='sternum'?.036+.281*lift:.028;
  const pitch=inv?pi-.072:mode==='sternum'?-.014-.561*lift:-.018-.013*lift;
  const body=stand([hipX,hipY,hipZ],pitch,0,alternate?.095*sway:0);
  for(const [limb,sign] of sides){
    const angle=inv?pi/2:mode==='gorilla'?mix(-1.545,.540,lift):-1.547;
    legAngles(body,limb,sign,angle,mode==='gorilla'?mix(-1.61,-1.45,lift):angle+.015,.017);
    if(one&&sign===-1){looseArm(body,limb,sign);continue;}
    const width=inv?.322:mode==='side-chin'?.452:one?.245:.284;
    barGrip(body,limb,sign,{width,under:chin,y:inv?.945:barY,z:inv?-.429:barZ,around:mode==='sternum'?.45:.20});
  }
  return body;
}

function parallettesLegRaise(phase){
  const lift=rep(phase,.42,.63);
  const pose=torso([0,.275+.034*lift,.512],-.056-.079*lift);
  for(const [limb,sign] of sides){
    const a=mix(.032,.762,lift);
    legAngles(pose,limb,sign,a,a+.024,.019);
    grip(pose,limb,[sign*.225,.176,.520],[sign*.56,-.29,-.73],long);
  }
  return pose;
}

const lateHang=[['10438','shift'],['5055','rest'],['0466','sternum'],['0467','gorilla'],['1357','one'],
  ['0720','side-chin'],['4049','inverted']];
jobs.push(...lateHang.map(([id,mode])=>[id,lastHangPatterns,{mode},mode==='inverted'?'inverted-row':'pull-up',
  mode==='inverted'?['trap']:['lat','forearm'],{...hangCam,yaw:mode==='side-chin'?35:mode==='sternum'?68:57},
  mode==='rest'||mode==='one'?5200:4750,mode==='side-chin'?.25:.50]));
jobs.push(['1401',muscleUp,{horizontal:true},'assisted-jump-bar',['lat','biceps','triceps'],
  {...hangCam,yaw:61,focus:[0,1.32,.12],height:2.95},5500,.50],
  ['10951',parallettesLegRaise,{},'push-up-handles',['core','quad'],
    {...hangCam,yaw:64,focus:[0,.68,.74],height:1.78},4800,.50]);

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
