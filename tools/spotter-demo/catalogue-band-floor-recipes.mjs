import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

const floorCam={yaw:62,elevation:20,focus:[0,.59,.07],height:2.03};
const tallCam={yaw:44,elevation:15,focus:[0,.93,.11],height:2.29};
const floor=.078;
const finger=[0,-.043,1];
const axis=[1,0,0];
const jobs=[];
function register(animation,equipment,muscles,camera,variants){
  for(const [id,profile]of variants){
    jobs.push({id,sample:p=>animation(p,profile),equipment:profile.equipment??equipment,camera:{...camera,...profile.camera},
      muscles:profile.muscles??muscles,duration:profile.duration??4640,poster:profile.poster??.47});
  }
}
function plant(pose,side,target,surface=0,direction=1){
  const sign=side==='l'?1:-1;
  leg(pose,side,target,[sign*.087,.193,direction],[sign*.013,-.072,direction*.139],surface);
}
function shoe(pose,side){
  return blend(pose[side+'a'],pose[side+'t'],.69);
}
function lower(pose,side,t=.08){
  const a=pose[side+'a'];
  return add(a,scale(unit(subtract(pose[side+'k'],a)),t));
}
function upper(pose,side){
  return blend(pose[side+'k'],pose[side+'h'],.28);
}
function shortLoop(pose,l,r,width=.067){
  const across=unit(add(subtract(l,r),[.001,.001,.001]));
  const radial=unit([across[1]+.017,-across[0]+.013,.304]);
  const p=(at,s,d)=>add(add(at,scale(across,s*width)),scale(radial,d*width));
  pose.bandPath=[p(l,0,1),p(l,1,.67),p(l,1,-.67),p(l,0,-1),p(r,0,-1),p(r,-1,-.67),p(r,-1,.67),p(l,0,1)];
}
function footBand(pose,foot,hold,anchor){
  pose.bandPath=anchor?[add(foot,[.032,0,.010]),anchor,add(foot,[-.032,0,.012])]
    :[pose[hold+'w'],add(foot,[.036,.009,.015]),add(foot,[-.035,.014,.018]),pose[hold+'w']];
}

function quadBand(phase,profile){
  const {kind,bench,plank,fixed,bird}=profile;
  const t=rep(phase,.38,.57);
  const height=bench?.460:0;
  const sig=plank?.786:.524;
  const pivot=[0,height+(plank?.583:.505),-sig*.43];
  const pose=stand(pivot,plank?1.43:1.52);
  pose.planted={};
  const standingY=(plank?.073:.090)+height;
  pose.lk=[.133,(plank?.284:.098)+height,plank?-.606:-.229];
  pose.la=[.137,standingY,plank?-1.014:-.641];
  pose.lt=[.146,standingY-.071,plank?-1.153:-.774];
  const plantedHand=[-.184,height+.049,.381];
  arm(pose,'r',plantedHand,[-.14,-.76,-.57],finger,[1,0,0]);
  const hold=add(plantedHand,[.362,0,0]);
  if(bird)grip(pose,'l',blend(hold,[.356,height+.551,.841],t),[.14,-.82,.27],axis);
  else if(!fixed&&['kick','straight','drive'].includes(kind)&&!plank&&!bench)
    grip(pose,'l',hold,[.14,-.82,-.27],axis);
  else arm(pose,'l',hold,[.14,-.80,-.28],finger,[1,0,0]);
  const arc=kind==='half';
  const side=kind==='side';
  const straight=plank||kind==='straight'||kind==='drive'||kind==='kick'||bird;
  const angle=arc?-1.48-1.82*t:side?-1.43:mix(-1.51,straight?-3.34:-3.19,t);
  const shin=straight?mix(plank?-2.89:-3.12,-3.17,t):mix(-3.13,side?-3.25:-4.50,t);
  legAngles(pose,'r',-1,angle,shin);
  if(side||arc) {
    const open=side?.81*t:.762*Math.sin(Math.PI*t);
    const thigh=unit([-Math.sin(open),Math.sin(angle)*Math.cos(open),Math.cos(angle)*Math.cos(open)]);
    pose.rk=add(pose.rh,scale(thigh,.422));
    pose.ra=add(pose.rk,[side?-.018:-.181*Math.sin(Math.PI*t),.088*t,-.418]);
    pose.rt=add(pose.ra,[-.028,-.064,-.120]);
  }
  if(plank){
    pose.rk=[-.129,mix(.291,.549,t),mix(-.612,-.683,t)];
    pose.ra=[-.141,mix(.088,.547,t),mix(-.987,-1.099,t)];
    pose.rt=add(pose.ra,[-.007,-.071,-.124]);
  }
  if(fixed)footBand(pose,shoe(pose,'r'),'l',[0,.163+height,.915]);
  else if(bird||straight&&!plank&&!bench)footBand(pose,shoe(pose,'r'),'l');
  else shortLoop(pose,profile.thigh?upper(pose,'l'):lower(pose,'l'),profile.thigh?upper(pose,'r'):lower(pose,'r'));
  return pose;
}

function sideFloor(phase,profile){
  const {kind,ankles,plank,low,kneeDriven}=profile;
  const t=rep(phase,.39,.59);
  const bend=kind==='clam'||kind==='knee-plank';
  const lift=plank?(kind==='side-lift'?1:.93*t):0;
  const hip=[0,.149+.317*lift,.066];
  const pitch=plank?-1.256:-1.554;
  const center=stand(hip,pitch,0,-.082*lift);
  const shoulders=blend(hip,center.neck,.805);
  center.lh=add(hip,[0,-.089,0]);
  center.rh=add(hip,[0,.089,0]);
  center.ls=add(shoulders,[.012,-.138,.013]);
  center.rs=add(shoulders,[-.013,.213,-.012]);
  let point;
  if(plank){
    point=[.296,.039,-.264];
    arm(center,'l',point,[.15,-.91,-.27],[1,-.037,0],[0,1,.04]);
    center.ls=[.025,.356+.021*lift,-.263];
    center.rs=[-.034,.680+.021*lift,-.275];
    center.le=[.025,.079,-.261];
    arm(center,'r',add(center.rh,[-.142,.08,.15]),[-.79,-.29,.44]);
  }else{
    arm(center,'l',[.097,.061,-.774],[.26,-.84,-.36],[0,-.02,-1],[0,1,.04]);
    arm(center,'r',add(center.chest,[-.164,-.143,.034]),[-.92,-.14,.26],[.017,-.94,.26]);
    if(low)center.head=add(center.head,[0,-.054,.021]);
  }
  if(bend){
    const open=kind==='clam' ? (kneeDriven?.87:.75)*t : .045;
    const ankleZ=kind==='clam'?.282:.139;
    leg(center,'l',[.016,.070,ankleZ],[-.995,.101,.129],[-.123,-.035,.011]);
    leg(center,'r',[-.018,.150+.026*lift,ankleZ],[-Math.cos(open),.17+Math.sin(open),.123],[-.122,-.035,.011]);
  }else{
    for(const[side,sign]of sides){
      const top=side==='r';
      const a=top&&(!plank||kind==='side-lift') ? (kneeDriven?.805:.665)*t : 0;
      const baseline=plank?-.383:0;
      const basic=unit([top?-.043:.020,baseline+(top?Math.sin(a):0),Math.cos(a)]);
      center[side+'k']=add(center[side+'h'],scale(basic,.424));
      center[side+'a']=add(center[side+'k'],scale(basic,.422));
      center[side+'t']=add(center[side+'a'],[-.124,.007,.078]);
    }
  }
  shortLoop(center,ankles?lower(center,'l'):upper(center,'l'),ankles?lower(center,'r'):upper(center,'r'),ankles?.056:.082);
  return center;
}

function bridgeBand(phase,profile){
  const {position,overHip,walk,march,single,extended,reach=.33}=profile;
  const stable=rep(phase,.25,.77);
  const t=walk||march?stable:rep(phase,.39,.61);
  const highBench=position==='high-bench';
  const kneeling=position==='kneeling';
  const footUp=position==='feet-bench';
  const back=position==='flat'||footUp;
  const hipY=kneeling?mix(.271,.493,t):(back?.159:.286)+(footUp?.294:highBench?.33:reach)*t;
  const hips=[0,hipY,kneeling?mix(-.178,.115,t):.098-.032*t];
  const shoulderY=highBench?.527:.154;
  const pitch=kneeling?mix(.388,.046,t):-Math.acos(Math.max(-.859,(shoulderY-hipY)/.502));
  const pose=stand(hips,pitch);
  if(!kneeling&&!highBench)pose.head=[0,.145,pose.neck[2]-.090];
  for(const[side,sign]of sides){
    if(kneeling){
      pose[side+'k']=[sign*.136,.093,.151];
      pose[side+'a']=[sign*.139,.093,-.266];
      pose[side+'t']=[sign*.150,.020,-.401];
      grip(pose,side,add(pose.chest,[sign*.057,.072,.190]),[sign*.63,-.62,-.019],axis);
      continue;
    }
    const stepOut=side==='r'?ramp(phase,.25,.38)*(1-ramp(phase,.69,.78)):
      ramp(phase,.39,.53)*(1-ramp(phase,.55,.69));
    const goal=walk?stepOut:march?(phase<.5)===(side==='r')?rep(phase*2%1):0:0;
    const air=walk?.071*Math.sin(Math.PI*goal):march?.280*goal:0;
    const swing=single&&side==='r';
    const feet=[sign*(.185+(walk?.205*goal:0)),(footUp?.535:floor)+air,.519+(footUp?.167:0)];
    if(swing){
      const angle=extended?.46:.962;
      legAngles(pose,side,sign,angle+.19*t,angle+.14*t,.025);
    }else{
      leg(pose,side,feet,[sign*(.144+.202*t),.975,.20],[sign*.014,-.074,.14],air<.013?(footUp?.459:0):undefined);
    }
    arm(pose,side,highBench?add(pose[side+'s'],[sign*.215,.034,.114]):[sign*.232,.038,.155-.075*t],
      [sign*.72,-.57,-.12],highBench?[sign*.87,-.049,.18]:[0,-.059,1]);
  }
  if(kneeling){
    const contact=add(hips,[0,.095,.105]);
    pose.bandPath=[add(contact,[.163,-.01,-.03]),[0,.153,-.845],add(contact,[-.163,-.01,-.03]),
      add(contact,[0,0,.051]),add(contact,[.163,-.01,-.03])];
  }else if(overHip){
    pose.bandPath=[[.565,.134,.112],[.221,hipY+.091,.109],[0,hipY+.121,.115],[-.221,hipY+.092,.109],[-.565,.134,.112]];
  }else shortLoop(pose,upper(pose,'l'),upper(pose,'r'),.081);
  return pose;
}

function floorCoreBand(phase,profile){
  const {kind,foot,arms,sideAnchor,wide,timed}=profile;
  const spin=kind==='bike'||kind==='dead';
  const hipRoll=kind==='reverse'||kind==='hip'||kind==='knee';
  const high=kind==='hip'||kind==='leg';
  const raise=kind==='crunch';
  const hold=timed?rep(phase,.25,.73):rep(phase,.43,.57);
  const t=spin?rep(phase*2%1,.31,.60):hold;
  const initSide=phase<.5?'r':'l';
  const pelvisY=.155+(hipRoll? (kind==='hip'?.196:.123)*hold:0);
  const pitch=kind==='curl'?1.554:raise?mix(-1.56,-1.006,hold):spin&&kind==='bike'?-1.29:hipRoll?-1.57-.16*hold:-1.568;
  const pedal=Math.cos(phase*2*Math.PI);
  const pose=stand([0,pelvisY,.035-(hipRoll?.06*hold:0)],pitch,kind==='bike'&&arms!=='foot'?.214*pedal:0);
  const center=pose.chest;
  if(hipRoll||kind==='leg'||kind==='dead')pose.head=[0,.145,pose.neck[2]-.094];
  const mount=sideAnchor?[-.969,.158,-.207]:[0,.142,-1.243];
  for(const[s,sign]of sides){
    const active=s===initSide;
    const limb=active?t:0;
    if(raise)plant(pose,s,[sign*.163,floor,.574]);
    else if(kind==='curl'){
      let bent=1.42*hold;
      if(profile.one&&s==='l')bent=0;
      legAngles(pose,s,sign,-3.11,-3.11-bent,.023);
      pose[s+'t']=add(pose[s+'a'],[sign*.014,-.061,-.123]);
    }else if(spin){
      const extension=kind==='bike'?(.50+.50*sign*pedal):limb;
      const thigh=mix(1.30,kind==='bike'?.261:.20,extension);
      const shin=mix(-.12,kind==='bike'?.17:.25,extension);
      legAngles(pose,s,sign,thigh,shin,wide?.036:.014);
    }else if(kind==='reverse'||kind==='knee'){
      const thigh=mix(1.43,2.100,hold);
      legAngles(pose,s,sign,thigh,mix(-.249,.467,hold),wide?.027:.017);
    }else if(high){
      const one=kind==='leg'&&s==='l';
      const thigh=one?.024:mix(.256,kind==='hip'?1.639:1.45,hold);
      legAngles(pose,s,sign,thigh,thigh-.026,.014);
    }
    if(kind==='curl'){
      arm(pose,s,[sign*.168,.061,.634],[sign*.68,-.56,-.029],[0,-.055,1]);
    }else if(arms==='bike'){
      const across=.50+.50*sign*pedal;
      const hand=add(center,[sign*(.113-.231*across),mix(.193,.292,across),mix(-.095,.413,across)]);
      grip(pose,s,hand,[sign*.77,.10,-.55],axis);
    }else if(arms==='dead'){
      const amount=sideAnchor?0:active?0:t;
      const end=add(pose[s+'s'],[sign*.035,mix(.564,.141,amount),mix(.019,-.526,amount)]);
      grip(pose,s,end,[sign*.53,-.35,-.54],axis);
    }else if(arms==='fixed'||arms==='crunch'){
      const offset=arms==='crunch'?[sign*.104,.163,.182]:[sign*.088,.179,-.431];
      grip(pose,s,add(center,offset),[sign*.76,.54,-.59],axis);
    }else if(arms==='foot'){
      grip(pose,s,add(pose[s+'h'],[sign*.157,.072,.093]),[sign*.73,-.63,-.26],axis);
    }else if(arms==='head'){
      arm(pose,s,add(pose.head,[sign*.082,.007,-.054]),[sign*.899,.14,.305],[-sign*.72,.04,-.40]);
    }else{
      arm(pose,s,[sign*.204,.040,pose.hips[2]-.021],[sign*.64,-.53,-.64],finger);
    }
  }
  if(foot==='hands'){
    pose.bandPath=[pose.lw,add(shoe(pose,'l'),[.031,.015,0]),add(shoe(pose,'r'),[-.031,.015,0]),pose.rw];
  }else if(foot==='loop'){
    shortLoop(pose,shoe(pose,'l'),shoe(pose,'r'),.048);
  }else if(foot==='post'){
    pose.bandPath=[shoe(pose,'l'),[0,.135,1.193],shoe(pose,'r')];
  }else if(foot==='curl'){
    pose.bandPath=[shoe(pose,'r'),[0,.153,-1.431],add(shoe(pose,'r'),[.031,0,0])];
  }else if(arms==='dead'&&profile.free){
    pose.bandPath=[pose.lw,pose.rw];
  }else{
    pose.bandPath=[pose.lw,mount,pose.rw];
  }
  return pose;
}

function bandCoreTurn(phase,profile){
  const {kind,two}=profile;
  const sit=kind==='seat-twist';
  const kneel=kind==='side-crunch';
  const over=kind==='over-side';
  const bend=kind==='side'||over||kneel;
  const t=rep(phase,.38,.57);
  const duty=two?(phase<.5?1:-1)*rep(phase*2%1):t;
  const pose=stand([0,sit?.147:kneel?.493:.872,-.021],sit?-.219:.020,bend?0:-.748*t,bend?(over?.326:-.313)*duty:0);
  for(const[side,sign]of sides){
    if(kneel){pose[side+'k']=[sign*.135,.091,.146];pose[side+'a']=[sign*.141,.093,-.266];pose[side+'t']=[sign*.149,.019,-.386];}
    else plant(pose,side,[sign*.162,floor,sit?.748:sign*.067+.044]);
    const s=pose[side+'s'];
    if(bend&&!over&&side==='l'){
      arm(pose,side,add(pose.lh,[.089,.069,.118]),[.84,-.50,-.14]);
    }else if(over){
      grip(pose,side,add(s,[sign*.074,.563,.139]),[sign*.76,-.59,.10],axis);
    }else if(kneel){
      grip(pose,side,add(pose.head,[-.119,-.078,.056]),[-.86,-.53,.29],[0,1,0]);
    }else if(kind==='side'){
      grip(pose,side,add(s,[sign*.054,-.574,.013]),[-.86,-.38,.28],axis);
    }else{
      const direction=[Math.sin(-.74*t),.15,Math.cos(-.74*t)];
      const hand=add(add(pose.chest,scale(direction,.548)),[sign*.035,.022,0]);
      grip(pose,side,hand,[sign*.69,-.60,-.33],[0,1,0]);
    }
  }
  const watch=[1.044,kneel?1.985:sit?.500:1.243,.121];
  const pivot=(side)=>add(shoe(pose,side),[0,-.026,0]);
  if(over)pose.bandPath=[pose.lw,pivot('l'),pivot('r'),pose.rw];
  else if(kind==='side')pose.bandPath=[pose.rw,pivot('r'),pivot('l')];
  else if(kneel)pose.bandPath=[pose.rw,watch,pose.rw];
  else pose.bandPath=[pose.lw,watch,pose.rw];
  return pose;
}

register(quadBand,'mat-stretch-band',['r:glute','core'],floorCam,[
  ['0906',{kind:'kick',camera:{yaw:64}}],
  ['4677',{kind:'straight',camera:{yaw:70}}],
  ['7208',{kind:'drive',camera:{yaw:68}}],
  ['2149',{kind:'bent',fixed:true,equipment:'mat-post-stretch-band',camera:{yaw:62,focus:[0,.65,.17]}}],
  ['2418',{kind:'side',thigh:true,camera:{yaw:-13,elevation:36}}],
  ['7209',{kind:'half',thigh:true,camera:{yaw:30,elevation:24}}],
  ['6741',{kind:'half',thigh:true,bench:true,equipment:'quad-bench-stretch-band',camera:{yaw:41,focus:[0,.79,.17],height:2.14}}],
  ['11059',{kind:'straight',fixed:true,bench:true,equipment:'post-quad-bench-stretch-band',camera:{yaw:58,focus:[0,.80,.21],height:2.21}}],
  ['2419',{kind:'side',thigh:false,camera:{yaw:-18,elevation:33}}],
  ['2152',{kind:'straight',plank:true,camera:{yaw:67,focus:[0,.63,-.18],height:2.08}}],
  ['3511',{kind:'straight',bird:true,camera:{yaw:62,focus:[0,.68,.12],height:2.14}}],
]);
register(sideFloor,'mat-stretch-band',['r:glute'],floorCam,[
  ['0982',{kind:'clam',camera:{yaw:-62,elevation:25}}],
  ['2150',{kind:'clam',low:true,camera:{yaw:-58,elevation:24}}],
  ['7199',{kind:'clam',low:true,kneeDriven:true,camera:{yaw:-63,elevation:29}}],
  ['2157',{kind:'raise',ankles:true,low:true,camera:{yaw:67}}],
  ['11644',{kind:'raise',ankles:false,low:true,kneeDriven:true,camera:{yaw:66}}],
  ['2155',{kind:'knee-plank',plank:true,muscles:['core','glute'],camera:{yaw:-48,focus:[0,.68,.085]}}],
  ['2164',{kind:'side-plank',plank:true,muscles:['core','glute'],camera:{yaw:-47,focus:[0,.68,.14]}}],
  ['6737',{kind:'side-lift',plank:true,ankles:true,muscles:['r:glute','core'],camera:{yaw:-50,focus:[0,.68,.14]}}],
]);
register(bridgeBand,'mat-stretch-band',['glute','hamstring'],floorCam,[
  ['1408',{position:'flat',overHip:true,reach:.322,equipment:'dual-pin-mat-stretch-band',camera:{yaw:60,elevation:24}}],
  ['2154',{position:'flat',reach:.28,camera:{yaw:68}}],
  ['2555',{position:'flat',reach:.353,camera:{yaw:70}}],
  ['10870',{position:'flat',walk:true,camera:{yaw:56,elevation:24}}],
  ['2760',{position:'high-bench',overHip:true,equipment:'dual-pin-bench-stretch-band',camera:{yaw:66,focus:[0,.63,.12],height:2.08}}],
  ['4050',{position:'high-bench',overHip:true,equipment:'dual-pin-bench-stretch-band',camera:{yaw:58,focus:[0,.65,.12]}}],
  ['7277',{position:'kneeling',equipment:'mat-post-stretch-band',camera:{yaw:51,focus:[0,.73,-.22],height:2.21}}],
  ['3236',{position:'kneeling',equipment:'mat-post-stretch-band',camera:{yaw:57,focus:[0,.73,-.22],height:2.23}}],
  ['4447',{position:'feet-bench',equipment:'feet-bench-mat-stretch-band',camera:{yaw:61,focus:[0,.62,.22],height:2.17}}],
  ['2159',{position:'flat',single:true,camera:{yaw:61}}],
  ['2158',{position:'flat',single:true,extended:true,camera:{yaw:64}}],
  ['2166',{position:'flat',march:true,camera:{yaw:65,elevation:24}}],
]);
register(floorCoreBand,'mat-stretch-band',['core'],floorCam,[
  ['4699',{kind:'bike',foot:'hands',arms:'foot',wide:true,duration:4480}],
  ['2420',{kind:'bike',foot:'hands',arms:'foot',duration:4520,camera:{yaw:54}}],
  ['7212',{kind:'bike',foot:'loop',arms:'head',duration:4380,camera:{yaw:46,elevation:25}}],
  ['3778',{kind:'bike',arms:'bike',equipment:'mat-post-stretch-band',camera:{yaw:61,focus:[0,.62,-.19]}}],
  ['3792',{kind:'bike',arms:'bike',equipment:'mat-post-stretch-band',wide:true,camera:{yaw:57,focus:[0,.64,-.20]}}],
  ['2938',{kind:'dead',arms:'dead',equipment:'mat-post-stretch-band',camera:{yaw:63,focus:[0,.62,-.22]}}],
  ['3866',{kind:'dead',arms:'dead',sideAnchor:true,equipment:'mat-post-stretch-band',camera:{yaw:-18,elevation:25,focus:[-.20,.61,.09]}}],
  ['3512',{kind:'dead',arms:'dead',free:true,camera:{yaw:55,focus:[0,.65,-.17]}}],
  ['4839',{kind:'dead',foot:'loop',arms:'rest',camera:{yaw:65}}],
  ['4081',{kind:'reverse',arms:'fixed',equipment:'mat-post-stretch-band',camera:{yaw:58,focus:[0,.66,-.16]}}],
  ['6418',{kind:'reverse',arms:'fixed',equipment:'mat-post-stretch-band',wide:true,camera:{yaw:54,focus:[0,.65,-.21]}}],
  ['6419',{kind:'reverse',arms:'fixed',equipment:'mat-post-stretch-band',timed:true,camera:{yaw:64,focus:[0,.65,-.19]}}],
  ['6810',{kind:'knee',foot:'post',arms:'rest',equipment:'mat-post-stretch-band',camera:{yaw:57,focus:[0,.61,.20]}}],
  ['0910',{kind:'hip',foot:'post',arms:'rest',equipment:'mat-post-stretch-band',camera:{yaw:62,focus:[0,.64,.19]}}],
  ['0912',{kind:'leg',foot:'loop',arms:'rest',camera:{yaw:68}}],
  ['0911',{kind:'curl',foot:'curl',arms:'rest',equipment:'mat-post-stretch-band',muscles:['hamstring'],camera:{yaw:63,focus:[0,.63,-.28]}}],
  ['4083',{kind:'crunch',arms:'crunch',equipment:'mat-post-stretch-band',camera:{yaw:60,focus:[0,.63,-.21]}}],
]);
register(bandCoreTurn,'post-stretch-band',['core'],tallCam,[
  ['1011',{kind:'seat-twist',equipment:'mat-post-stretch-band',camera:{...floorCam,yaw:20}}],
  ['3591',{kind:'turn',camera:{yaw:13}}],
  ['1020',{kind:'side-crunch',equipment:'mat-post-stretch-band',camera:{yaw:16,focus:[.17,.98,.12],height:2.43}}],
  ['4082',{kind:'over-side',two:true,equipment:'stretch-band',camera:{yaw:18,focus:[0,1.08,.10],height:2.48}}],
  ['3841',{kind:'side',equipment:'stretch-band',camera:{yaw:14}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const chosen=ids.length?jobs.filter(job=>ids.includes(job.id)):jobs;
if(!chosen.length||ids.length&&chosen.length!==ids.length)throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const job of chosen){
  const recipe={version:1,equipment:job.equipment,muscles:job.muscles,camera:job.camera,durationMs:job.duration,
    keyframes:Array.from({length:65},(_,i)=>({at:i/64,...job.sample(i/64)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(output,job.id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id:job.id,recipe:job.id+'.json',posterAt:job.poster});
  }catch(e){failures.push([job.id,e.message]);}
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
