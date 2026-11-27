import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

const axis = [1,0,0];
const forward = [0,0,1];
const floorCam = {yaw:58,elevation:18,focus:[0,.54,.24],height:1.99};
const standCam = {yaw:48,elevation:12,focus:[0,.92,.14],height:2.34};
const seatCam = {yaw:67,elevation:15,focus:[0,.69,.12],height:2.12};
const floor = .078;
const support = [.434,1.10,.340];
const safeAnchor = [0,.144,1.149];
const jobs = [];

function register(animation,equipment,muscles,camera,variants) {
  for(const [id,option] of variants)jobs.push({id,animation:phase=>animation(phase,option),equipment:option.equipment??equipment,
    muscles:option.muscles??muscles,camera:{...camera,...option.camera},duration:option.duration??4430,poster:option.poster??.47});
}

function plant(pose,side,point) {
  const sign = side === 'l' ? 1 : -1;
  leg(pose,side,point,[sign*.113,-.031,1],[sign*.013,-.070,.135],0);
}

function shoe(pose,side,k=.62) {
  return blend(pose[side+'a'],pose[side+'t'],k);
}

function ankle(pose,side,k=.106) {
  return add(pose[side+'a'],scale(unit(subtract(pose[side+'k'],pose[side+'a'])),k));
}

function footLoop(pose,left,right,wide=.054) {
  const xSideL=add(left,[wide,.016,.015]),xSideR=add(right,[-wide,.016,.015]);
  pose.bandPath=[add(left,[0,0,-wide]),xSideL,add(left,[0,0,wide]),add(right,[0,0,wide]),xSideR,add(right,[0,0,-wide]),add(left,[0,0,-wide])];
}

function toFixedBand(pose,contact,anchor) {
  pose.bandPath=[add(contact,[.032,0,-.013]),anchor,add(contact,[-.032,0,-.012])];
}

function braceHands(pose,{two=false,clear=false,hinge=false}={}) {
  if(clear) {
    for(const[side,sign]of sides){
      arm(pose,side,add(pose[side+'h'],[sign*.283,.058,.102]),[sign*.91,-.35,-.17],[sign*.62,-.68,.25]);
    }
    return;
  }
  const contact = hinge ? [.395,.908,.442] : support;
  grip(pose,'l',contact,[.63,-.70,-.21],forward);
  if(two)grip(pose,'r',add(contact,[-.355,0,.065]),[-.39,-.32,-.86],forward);
  else arm(pose,'r',add(pose.rh,[-.085,.061,.066]),[-.72,-.61,-.13],[.18,-.97,.1]);
}

function standingAnkleBand(phase,profile){
  const {mode,loop,hinge,balance,extreme,sideWidth,hand='one'}=profile;
  const t=rep(phase,profile.hold?.23:.39,profile.hold?.72:.56);
  const upper=mode==='abduct'||mode==='crossAbduct'||mode==='bentSide';
  const anterior=mode==='flex'||mode==='march'||mode==='knee'||mode==='toe';
  const crouch=hinge?profile.hingeAngle??.78:profile.lean??.034;
  const pose=stand([.046,hinge?.792:.857,hinge?-.090:-.019],crouch);
  plant(pose,'l', [.166,floor,.049]);
  const direction = mode==='march'?1.61*t:mode==='flex' ? .803*t : mode==='extension' ? -(extreme?.699:.560)*t : .034;
  const theta= mode==='knee' ? -.947 : mode==='curl' ? -1.553-.125*t : -Math.PI/2+direction;
  const spread=upper ? (mode==='crossAbduct'?mix(.116,-.547,t):-(sideWidth??.567)*t) : -.026;
  const upperDirection=unit([Math.sin(spread),Math.sin(theta)*Math.cos(spread),Math.cos(theta)*Math.cos(spread)]);
  pose.rk=add(pose.rh,scale(upperDirection,.422));
  const lower = mode==='knee' ? mix(-1.712,-.079,t) : mode==='curl' ? mix(-1.600,-2.95,t) : mode==='march' ? -1.56
    : mode==='bentSide'? -2.68 : theta-.017;
  const lowerDirection=unit([Math.sin(spread),Math.sin(lower)*Math.cos(spread),Math.cos(lower)*Math.cos(spread)]);
  pose.ra=add(pose.rk,scale(lowerDirection,.421));
  pose.rt=add(pose.ra,[-.011,-.066,.121]);
  if(mode==='toe'){
    pose.rk=[-.163,.488,.285];
    pose.ra=[-.178,.081,.398];
    pose.rt=add(pose.ra,[-.011,mix(-.071,.033,t),mix(.129,.122,t)]);
  }
  braceHands(pose,{two:hand==='two',clear:balance,hinge});
  const legAnchor=profile.kneeLoop?.112:.086;
  if(loop){
    footLoop(pose,ankle(pose,'l',legAnchor),ankle(pose,'r',legAnchor),profile.kneeLoop?.073:.052);
  }else{
    const anchor=upper?[.91,.159,.126]:anterior?[0,.144,mode==='toe'?1.155:-1.045]:safeAnchor;
    toFixedBand(pose,mode==='toe'?shoe(pose,'r'):ankle(pose,'r'),anchor);
  }
  return pose;
}

function benchLegBand(phase,{mode,hold,chair,large,side,low}){
  const t = rep(phase,hold?.20:.43,hold?.76:.57);
  const planted = side==='l' ? 'r' : 'l';
  const working = side??'r';
  const sign=working==='l'?1:-1;
  const ground=low===true;
  const pose=stand([0,ground?.159:.567,-.029],ground?-.201:.033);
  plant(pose,planted,[-sign*.151,floor,ground?.71:.416]);
  const bend=mode==='knee'?-1.45:mode==='curl'?-t*(ground?.95:1.44):-1.50 + 1.49*t;
  const thighAngle=mode==='knee'?.032+(large?.621:.462)*t:ground?.622:-.083;
  const k=add(pose[working+'h'],[sign*.043,.421*Math.sin(thighAngle),.418*Math.cos(thighAngle)]);
  pose[working+'k']=k;
  pose[working+'a']=add(k,[sign*.007,.422*Math.sin(bend),.421*Math.cos(bend)]);
  const foot=pose[working+'a'];
  pose[working+'t']=add(foot,[sign*.014,ground?.012:-.068,.121]);
  for(const [s,b] of sides){
    arm(pose,s,add(pose[s+'h'],[b*(chair?.189:.177),ground?-.087:-.063,ground?-.168:.041]),[b*.84,-.49,-.26]);
  }
  const attach=mode==='curl'?add(foot,[0,.033,-.059]):ankle(pose,working);
  const anchor=[0,.143,mode==='extension'?-.818:ground?1.216:1.091];
  toFixedBand(pose,attach,anchor);
  return pose;
}

function seatedBandFoot(phase,{mode,chair,hold,hand,other }){
  const t=rep(phase,hold?.22:.43,hold?.73:.55);
  const y=chair?.555:.153;
  const pose=stand([0,y,-.063],mode==='stretch'?mix(-.069,.205,t):-.210);
  for(const [side,sign] of sides){
    const training=side==='r';
    const foot=[sign*.146,.081,training?.766:other==='folded'?.384:.752];
    plant(pose,side,foot);
    if(!training){continue;}
    const turning=mode==='eversion'||mode==='inversion'||mode==='rotate';
    const d=mode==='inversion'||mode==='rotate'?-1:1;
    const toe=turning?[d*.104*t,mix(.081,.102,t),mix(.104,.074,t)] :
      [0,mode==='plantar'?mix(.101,-.062,t):mix(-.05,.101,t),mode==='plantar'?mix(.083,.125,t):mix(.123,.088,t)];
    pose.rt=add(pose.ra,toe);
  }
  const contact=shoe(pose,'r',.85);
  if(hand) {
    for(const[side,sign]of sides){
      const height=mode==='stretch'?.253+.094*t:.261;
      grip(pose,side,[sign*.108,height,.478+.035*t],[sign*.48,-.56,-.32],forward);
    }
    pose.bandPath=[pose.lw,add(contact,[.041,0,.007]),add(contact,[-.043,0,.012]),pose.rw];
  }else{
    for(const[side,sign]of sides)arm(pose,side,add(pose[side+'h'],[sign*.177,chair?-.059:-.082,-.138]),[sign*.73,-.49,-.45]);
    const anchor=mode==='dorsi'?[0,.116,1.366]:[mode==='inversion'?-.874:.874,.147,.841];
    toFixedBand(pose,contact,anchor);
  }
  return pose;
}

function shoulderBandMotion(phase,{mode,high,side,one,post,half,chair,hold,gripStyle='over',depth=0}){
  const t=rep(phase,hold?.21:.37,hold?.76:.58);
  const knee=half||mode==='kneel-crunch';
  const pose=stand([0,knee?.477:chair?.561:.874,-.033],
    (mode==='crunch'||mode==='kneel-crunch')?.026+(depth||.836)*t:mode==='row'?.124:.031);
  if(knee){
    for(const[s,sign]of sides){
      if(half&&s==='r'){plant(pose,s,[sign*.151,.076,.437]);continue;}
      pose[s+'k']=[sign*.134,.091,.158];
      pose[s+'a']=[sign*.139,.091,-.253];
      pose[s+'t']=[sign*.148,.023,-.381];
    }
  }else{
    for(const[s,sign]of sides)plant(pose,s,[sign*.152,floor,chair?.422:sign*.047+.038]);
  }
  const sideStretch=mode==='adduct'||mode==='side-reach'||mode==='flex';
  const rot=mode==='external'||mode==='internal'||mode==='external90';
  const face=mode==='face';
  const crunch=mode==='crunch'||mode==='kneel-crunch';
  const inFront=mode==='row'||face||rot||crunch;
  const anchor=sideStretch || rot?[mode==='adduct'||mode==='internal'?-1.10:1.07,high?1.92:post?.61:1.11,.117]
    :[0,crunch?2.014:face?Math.max(1.01,pose.chest[1]+.185):1.12,1.143];
  for(const[s,sign]of sides){
    if((one||sideStretch||rot)&&s==='l') {
      arm(pose,s,add(pose.lh,[.107,.091,.118]),[.86,-.38,-.13]);
      continue;
    }
    const shoulder=pose[s+'s'];
    let offset;
    let pole=[sign*.59,-.63,-.39];
    if(rot){
      const up=mode==='external90';
      const e=add(shoulder,[sign*(up?.242:.027),up?.011:-.240,.066]);
      pose[s+'e']=e;
      const amount= mode==='internal'?mix(1.03,-.435,t):mix(-.28,1.20,t);
      offset=up?[0,.358*Math.sin(amount),.358*Math.cos(amount)]:[sign*.357*Math.sin(amount),.009,.357*Math.cos(amount)];
      pose[s+'w']=add(e,offset);
      pose[s+'Grip']=[0,1,0];
      continue;
    }
    if(face){
      offset=[sign*mix(-.089,.112,t),mix(.033,.097,t),mix(.580,.174,t)];
      pole=[sign*.94,-.35,-.27];
    } else if(crunch){
      grip(pose,s,add(pose.head,[sign*.124,-.089,.035]),[sign*.62,-.61,.53],[0,1,0]);
      continue;
    } else if(sideStretch){
      const start=mode==='flex'?[sign*.059,-.579,.05]:mode==='side-reach'?[.269,-.061,.528]:[sign*.563,-.072,.105];
      const end=mode==='adduct'?[.092,-.582,.064]:mode==='flex'?[sign*.015,.339,.483]:[-.554,-.109,-.176];
      offset=scale(unit(blend(start,end,t)),.592);
    } else if(mode==='pullapart'){
      offset=scale(unit(blend([-sign*.058,.018,.59],[sign*.572,.018,-.108],t)),.598);
    } else if(mode==='pass'){
      const angle=mix(.219,5.68,t);
      offset=[sign*.404,-.440*Math.cos(angle),.440*Math.sin(angle)];
    } else {
      offset=[sign*.053,mix(-.229,-.193,t),mix(.56,.115,t)];
    }
    grip(pose,s,add(shoulder,offset),pole,gripStyle==='under'?[-1,0,0]:axis);
  }
  if(post||high||inFront&&mode!=='pullapart'){
    pose.bandPath=one||sideStretch||rot?[pose.rw,anchor,pose.rw]:[pose.lw,anchor,pose.rw];
  } else pose.bandPath=[pose.lw,pose.rw];
  return pose;
}

register(standingAnkleBand,'post-braced-stretch-band',['r:glute'],standCam,[
  ['4035',{mode:'extension',hinge:true,hingeAngle:1.10,hand:'two',equipment:'post-hinge-stretch-band',camera:{yaw:67}}],
  ['0980',{mode:'extension',hinge:true,hingeAngle:.52,hand:'two',equipment:'post-hinge-stretch-band',camera:{yaw:72}}],
  ['4034',{mode:'extension',extreme:true,camera:{yaw:61}}],
  ['0901',{mode:'extension',camera:{yaw:68}}],
  ['11570',{mode:'extension',loop:true,equipment:'braced-stretch-band',camera:{yaw:73}}],
  ['1507',{mode:'march',muscles:['r:quad'],camera:{yaw:71}}],
  ['0927',{mode:'flex',muscles:['r:quad'],camera:{yaw:74},lean:-.021}],
  ['1021',{mode:'flex',loop:true,equipment:'braced-stretch-band',muscles:['r:quad'],camera:{yaw:68}}],
  ['3903',{mode:'extension',hinge:true,hingeAngle:.51,hand:'two',equipment:'post-hinge-stretch-band',camera:{yaw:54}}],
  ['2161',{mode:'extension',loop:true,equipment:'braced-stretch-band',camera:{yaw:-68}}],
  ['7281',{mode:'extension',loop:true,equipment:'braced-stretch-band',extreme:true,camera:{yaw:66}}],
  ['6798',{mode:'extension',loop:true,balance:true,equipment:'stretch-band',camera:{yaw:-65}}],
  ['7204',{mode:'extension',loop:true,balance:true,equipment:'stretch-band',extreme:true,camera:{yaw:60}}],
  ['4031',{mode:'abduct',sideWidth:.642,camera:{yaw:8}}],
  ['4136',{mode:'crossAbduct',camera:{yaw:12}}],
  ['8085',{mode:'abduct',loop:true,balance:true,equipment:'stretch-band',sideWidth:.48,camera:{yaw:14}}],
  ['11569',{mode:'abduct',loop:true,equipment:'braced-stretch-band',sideWidth:.582,camera:{yaw:13}}],
  ['10820',{mode:'bentSide',loop:true,balance:true,equipment:'stretch-band',kneeLoop:true,muscles:['r:glute'],camera:{yaw:-23}}],
  ['4033',{mode:'curl',muscles:['r:hamstring'],camera:{yaw:66}}],
  ['4036',{mode:'curl',muscles:['r:hamstring'],camera:{yaw:72},lean:.076}],
  ['0926',{mode:'knee',muscles:['r:quad'],camera:{yaw:65}}],
  ['3007',{mode:'knee',muscles:['r:quad'],camera:{yaw:70},lean:-.054}],
  ['10536',{mode:'knee',muscles:['r:quad'],camera:{yaw:64},lean:.058}],
  ['1000',{mode:'toe',muscles:['r:shin'],camera:{yaw:65}}],
]);

register(benchLegBand,'post-seat-stretch-band',['r:quad'],seatCam,[
  ['3518',{mode:'extension',chair:true}],
  ['10746',{mode:'extension',camera:{yaw:70}}],
  ['10921',{mode:'extension',hold:true,chair:true,equipment:'post-chair-stretch-band',duration:6170}],
  ['10753',{mode:'knee',large:true,chair:true}],
  ['4903',{mode:'curl',muscles:['r:hamstring'],camera:{yaw:61}}],
  ['3508',{mode:'curl',low:true,equipment:'mat-post-stretch-band',muscles:['r:hamstring'],camera:{...floorCam,yaw:61}}],
]);

register(seatedBandFoot,'mat-post-stretch-band',['r:shin'],floorCam,[
  ['3127',{mode:'eversion',camera:{yaw:21}}],
  ['3128',{mode:'inversion',camera:{yaw:-25,focus:[-.20,.61,.33]}}],
  ['3125',{mode:'rotate',other:'folded',camera:{yaw:28}}],
  ['3126',{mode:'plantar',hand:true,equipment:'mat-stretch-band',muscles:['r:calf'],camera:{yaw:36}}],
  ['8611',{mode:'eversion',other:'folded',camera:{yaw:31}}],
  ['8612',{mode:'inversion',other:'folded',camera:{yaw:-31,focus:[-.21,.63,.29]}}],
  ['10003',{mode:'dorsi',hand:true,equipment:'mat-stretch-band',camera:{yaw:60}}],
  ['10366',{mode:'dorsi',camera:{yaw:61,focus:[0,.67,.54],height:2.20}}],
  ['5480',{mode:'stretch',hold:true,hand:true,other:'folded',equipment:'mat-stretch-band',muscles:['r:calf'],duration:6450}],
  ['10744',{mode:'stretch',hold:true,hand:true,other:'folded',equipment:'mat-stretch-band',muscles:['r:hamstring'],duration:6500}],
]);

register(shoulderBandMotion,'post-stretch-band',['r:shoulder'],standCam,[
  ['0921',{mode:'external',camera:{yaw:14}}],
  ['0924',{mode:'internal',camera:{yaw:19}}],
  ['0935',{mode:'external90',camera:{yaw:17}}],
  ['2151',{mode:'external',post:true,camera:{yaw:30}}],
  ['6441',{mode:'external',post:true,camera:{yaw:-13}}],
  ['8361',{mode:'external',camera:{yaw:-16}}],
  ['8360',{mode:'internal',camera:{yaw:-16}}],
  ['8363',{mode:'external90',post:true,camera:{yaw:29}}],
  ['6437',{mode:'adduct',high:true,muscles:['r:lat','r:shoulder'],camera:{yaw:6,height:2.52}}],
  ['6440',{mode:'side-reach',post:true,camera:{yaw:19}}],
  ['6439',{mode:'flex',post:true,camera:{yaw:14}}],
  ['5607',{mode:'face',muscles:['rearShoulder','trap'],camera:{yaw:69}}],
  ['4195',{mode:'face',half:true,muscles:['rearShoulder','trap'],camera:{yaw:64,focus:[0,.73,.36]}}],
  ['4445',{mode:'face',chair:true,equipment:'post-seat-stretch-band',muscles:['rearShoulder','trap'],camera:{yaw:66,focus:[0,.78,.35]}}],
  ['4080',{mode:'kneel-crunch',muscles:['core'],depth:.88,camera:{yaw:66,focus:[0,1.06,.35],height:2.60}}],
  ['4720',{mode:'kneel-crunch',muscles:['core'],depth:1.08,camera:{yaw:67,focus:[0,1.06,.35],height:2.62}}],
  ['5202',{mode:'kneel-crunch',muscles:['core'],depth:1.02,camera:{yaw:59,focus:[0,1.07,.34],height:2.60}}],
  ['5206',{mode:'kneel-crunch',muscles:['core'],depth:1.12,camera:{yaw:55,focus:[0,1.08,.36],height:2.61}}],
  ['5203',{mode:'crunch',muscles:['core'],depth:.855,camera:{yaw:61,focus:[0,1.10,.32],height:2.62}}],
  ['4412',{mode:'pullapart',gripStyle:'over',equipment:'stretch-band',muscles:['rearShoulder','trap'],camera:{yaw:26}}],
  ['2930',{mode:'pullapart',gripStyle:'under',equipment:'stretch-band',muscles:['rearShoulder','trap'],camera:{yaw:23}}],
  ['8365',{mode:'pass',equipment:'stretch-band',camera:{yaw:47,focus:[0,1.08,.19],height:2.48}}],
]);

const [directory,...ids] = process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selection=ids.length?jobs.filter(({id})=>ids.includes(id)):jobs;
if(!selection.length||ids.length&&selection.length!==ids.length||new Set(selection.map(row=>row.id)).size!==selection.length) {
  throw Error('Unknown or repeated catalogue IDs.');
}
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const {id,equipment,animation,duration,muscles,camera,poster} of selection){
  const recipe={version:1,equipment,durationMs:duration,muscles,camera,
    keyframes:Array.from({length:65},(_,i)=>({at:i/64,...animation(i/64)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:poster});
  }catch(error){
    failures.push([id,error.message]);
  }
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
