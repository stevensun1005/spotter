import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, unit } from './bodyweight/pose.mjs';

const floorY = .075;
const identity = [1,0,0];
const neutral = [0,0,1];
const palmUp = [-1,0,0];

function plant(pose, side, sign, point, height = 0) {
  leg(pose,side,point,[sign * .15,-.038,1],[sign * .011,-.071,.139],height);
}

function pinToFoot(pose, side) {
  const ankle = pose[side + 'a'];
  const toe = pose[side + 't'];
  return add(blend(ankle,toe,.69),[0,-.019,0]);
}

function stoodBand(phase, { mode, alternate, angle = 0, width = .17, one, neutralGrip, reverse, cross, narrow } = {}) {
  const t = rep(phase);
  const row = mode === 'row';
  const rear = mode === 'rear';
  const calf = mode === 'calf';
  const lean = row || rear ? angle || 1.03 : .018;
  const pose = stand([one ? -.043 : 0, row || rear ? .792 : .862 + (calf ? .053*t : 0), row || rear ? -.153 : -.020],lean);
  for (const [side,sign] of sides) {
    const amount = alternate ? (phase < .5) === (side==='l') ? rep(phase*2%1) : 0 : t;
    const raised = calf ? .052*t : 0;
    const stanceZ = one ? sign*.235 : sign*.027;
    leg(pose,side,[sign*width,floorY+raised,.023+stanceZ],[sign*.17,-.02,1],[sign*.014,-.070-raised,.136],0);
    const s = pose[side+'s'];
    if(one && side==='l') {
      arm(pose,side,add(pose.lh,[.068,.091,.084]),[.86,-.47,-.05]);
      continue;
    }
    let hand;
    let pole=[sign*.33,-.88,-.16];
    if(row || rear){
      const low = add(s,[sign*.035,-.582,.056]);
      const up = add(s,rear ? [sign*.557,-.047,-.152] : [sign*(width>.21?.134:.056),-.203,-.103]);
      hand=blend(low,up,amount);
      pole=[sign*(rear?.88:.48),-.19,-.83];
    }else if(mode==='lateral'){
      const a = amount*Math.PI/2;
      hand=add(s,[sign*(.039+.548*Math.sin(a)),-.576*Math.cos(a),.049+.078*amount]);
      pole=[sign*.49,-.75,-.14];
    }else if(mode==='upright'){
      hand=add(s,[sign*mix(-.045,.018,amount),mix(-.57,.069,amount),mix(.09,.191,amount)]);
      pole=[sign*.72,.55,-.69];
    }else if(mode==='curl'||mode==='drag'){
      const armAngle=mix(.02,2.48,amount);
      const elbow=add(s,[sign*(narrow ? -.037 : .037),-.237,(angle ? -angle : 0) - (mode==='drag'? .145*amount : 0)]);
      hand=add(elbow, [cross ? -sign*.208*amount : 0, -.357*Math.cos(armAngle), .351*Math.sin(armAngle) - (mode==='drag'?.16*amount:0)]);
      pole=[sign*.16,-.92,-.20-angle];
    }else{
      hand=add(s,[sign*.088,-.538,.112]);
    }
    grip(pose,side,hand,pole,neutralGrip ? neutral : (mode==='curl'||mode==='drag')&&!reverse ? palmUp : identity);
  }
  if (one) pose.bandPath = [pose.rw,pinToFoot(pose,'r')];
  else pose.bandPath = [pose.lw,pinToFoot(pose,'l'),pinToFoot(pose,'r'),pose.rw];
  return pose;
}

function floorRow(phase, { wide, under, post, sturdy } = {}) {
  const t = rep(phase);
  const pose = stand([0,.131,-.043],sturdy ? .006 : mix(.105,.028,t));
  for(const [side,sign] of sides){
    leg(pose,side,[sign*.147,.077,.775],[sign*.086,.87,.21],[sign*.014,.084,.114],0);
    const s = pose[side+'s'];
    const hand = add(s,[sign * (wide ? mix(.072,.129,t) : .028),mix(-.209,-.257,t),mix(.555,.174,t)]);
    grip(pose,side,hand,[sign*.59,-.21,-.79],under?palmUp:neutral);
  }
  pose.bandPath = post ? [pose.lw,[0,.173,1.135],pose.rw] : [pose.lw,pinToFoot(pose,'l'),pinToFoot(pose,'r'),pose.rw];
  return pose;
}

function anchoredRowBand(phase,{ low, high, close, one, twist, rear, kneeling, reverse } = {}) {
  const t=rep(phase);
  const pose=stand([0,kneeling?.478:.867,-.039],.016,twist ? -.506*t : 0);
  for(const [side,sign] of sides){
    if(kneeling){
      pose[side+'k']=[sign*.136,.091,.164];
      pose[side+'a']=[sign*.135,.091,-.247];
      pose[side+'t']=[sign*.146,.019,-.361];
    }else plant(pose,side,sign,[sign*.159,.075,sign*(rear?.160:.054)]);
    if(one&&side==='l'){
      arm(pose,side,add(pose.lh,[.056,.148,.101]),[.86,-.41,.02]);
      continue;
    }
    const s=pose[side+'s'];
    const x=sign*(close?mix(-.108,-.043,t):rear?mix(.030,.162,t):mix(.041,.034,t));
    const y=mix(high?.207:low?-.317:-.073,high?.082:rear?-.134:-.234,t);
    const z=mix(.541,.123,t);
    grip(pose,side,add(s,[x,y,z]),[sign*(rear?.84:.49),-.227,-.87],reverse?palmUp:neutral);
  }
  const anchor=[one?-.143:0,low?.205:high?1.84:kneeling?.917:1.25,1.153];
  pose.bandPath=one ? [pose.rw,anchor] : [pose.lw,anchor,pose.rw];
  return pose;
}

function opening(phase,{ raise = 0, rear = false, horizontalCurl = false } = {}){
  const t=rep(phase);
  const pose=stand([0,.876,-.034],.022);
  for(const [side,sign] of sides){
    plant(pose,side,sign,[sign*.159,.075,.038]);
    const s=pose[side+'s'];
    const direction=unit(blend([-sign*.148,raise,.967],[sign*.955,raise,-.189],t));
    const hand = horizontalCurl ? add(s,[sign*mix(.098,.087,t),-.021,mix(.572,.165,t)]) : add(s,scale(direction,.589));
    grip(pose,side,hand,[sign*.52,-.547,-.68],horizontalCurl?palmUp:identity);
  }
  pose.bandPath = horizontalCurl ? [pose.lw,[0,1.25,-.853],pose.rw] : rear ? [pose.lw,[0,1.35,.953],pose.rw] : [pose.lw,pose.rw];
  return pose;
}

function pallof(phase,{ mode, fixed, up, alternate }={}){
  const t=rep(phase);
  const local=alternate ? rep(phase*2%1) : t;
  const sign=alternate&&phase>=.5?-1:1;
  const split=mode==='split';
  const sideStep=mode==='step';
  const depth=(mode==='squat'||split)?.278:0;
  const torso = stand([sideStep?.273*t:0, .868-depth*local, split ? .093 : .025-(mode==='squat'?.131*t:0)],mode==='squat'?.125*t:.02);
  const press=fixed ? 1 : local;
  const center=add(torso.chest,[0,mix(.04,up?.735:.042,press),mix(.149,up?.104:.535,press)]);
  for(const [side,s] of sides){
    const footX=s*.179+(sideStep&&side==='l'?.450*t:0);
    const footZ=split ? s*sign*.334*(alternate ? local : 1) : .063;
    const height=split&&s*sign<0?.103:sideStep&&side==='l'?.09*Math.sin(Math.PI*t):0;
    leg(torso,side,[footX,.075+height,footZ],[s*.153,-.051,1],[s*.013,-.073-height*.8,.132],sideStep&&height>.02?undefined:0);
    grip(torso,side,add(center,[s*.038,0,0]),[s*.60,-.83,-.16],neutral);
  }
  torso.bandPath=[torso.rw,[-1.043,1.235,.106],torso.lw];
  return torso;
}

function loopedAbduction(phase,{ position, wide, feetOff }={}){
  const seated=position==='seat';
  const supine=position==='supine';
  const bridge=position==='bridge';
  const prone=position==='prone';
  const lift = bridge || prone ? ramp(phase,0,.25)*(1-ramp(phase,.75,1)) : rep(phase);
  const t = bridge || prone ? ramp(phase,.27,.426)*(1-ramp(phase,.53,.732)) : rep(phase);
  const pose=stand([0,seated?.521:bridge?.131+.359*lift:.145, seated?-.023:prone?-.074:.04+(bridge?.157*lift:0)],
    seated?.021:prone?1.50:-Math.PI/2-(bridge?.71*lift:0));
  if (bridge) pose.head = [0,.141,pose.neck[2]-.091];
  const stance=wide?.338:.23;
  const anchors=[];
  for(const [side,sign] of sides){
    const ankle=seated ? [sign*(.142+.053*t),feetOff?.182:.075,.419]
      : bridge ? [sign*.163,.071,.491] : [sign*(.131+stance*t),.102+(prone?.10*lift:0),prone?-.918:.853];
    leg(pose,side,ankle,[sign*(.22+1.17*t),.88,prone?-.40:.24], [sign*.010,-.072,prone?-.129:.125],
      bridge||seated&&!feetOff ? 0 : undefined);
    const s=pose[side+'s'];
    const hand = prone ? [sign*.092,.059,pose.head[2]-.026] : bridge ? [sign*.225,.064,pose.hips[2]-.015]
      : add(seated?pose[side+'h']:s,[sign*(seated?.095:.224),seated?-.061:-.083,seated?.128:.45]);
    arm(pose,side,hand,[sign*.68,-.37,.28]);
    anchors.push(seated||bridge ? blend(pose[side+'h'],pose[side+'k'],.83) : pose[side+'a']);
  }
  const [left,right]=anchors;
  const pad=seated||bridge?.074:.048;
  pose.bandPath=[add(left,[0,.064,0]),add(left,[pad,0,0]),add(left,[0,-.065,0]),add(right,[0,-.065,0]),add(right,[-pad,0,0]),add(right,[0,.064,0]),add(left,[0,.064,0])];
  return pose;
}

const camera={yaw:47,elevation:14,focus:[0,.94,.16],height:2.18};
const seatedCamera={yaw:55,elevation:14,focus:[0,.71,.40],height:2.20};
const postCamera={yaw:50,elevation:14,focus:[0,.98,.44],height:2.36};
const pallofCamera={yaw:27,elevation:13,focus:[-.24,.93,.10],height:2.37};
const jobs=[];
function ids(make, preset, muscles, view, variants){
  for(const [id,option] of variants) jobs.push({id,preset,muscles,view,pose:(phase)=>make(phase,option)});
}
ids(stoodBand,'stretch-band',['biceps'],camera,[
 ['4087',{mode:'curl',angle:.167}],['0005',{mode:'curl',alternate:true}],['4063',{mode:'curl'}],['4357',{mode:'curl',width:.184}],
 ['4138',{mode:'curl',narrow:true}],['4088',{mode:'curl',cross:true,neutralGrip:true,alternate:true}],['0897',{mode:'curl',neutralGrip:true}],
 ['4086',{mode:'curl',width:.145}],['4619',{mode:'curl',neutralGrip:true,width:.156}],['4687',{mode:'curl',neutralGrip:true,width:.173}],
 ['8327',{mode:'drag'}],['0917',{mode:'curl',reverse:true}],['6195',{mode:'curl',reverse:true,width:.161}],
]);
ids(stoodBand,'stretch-band',['shoulder','trap'],camera,[
 ['0907',{mode:'lateral'}],['1508',{mode:'lateral',width:.182}],['0793',{mode:'lateral',width:.165}],['8362',{mode:'lateral',one:true}],
 ['0934',{mode:'upright'}],['1500',{mode:'upright',width:.172}],['4695',{mode:'upright',one:true}],
]);
ids(stoodBand,'stretch-band',['rearShoulder','trap'],camera,[['3971',{mode:'rear'}],['6486',{mode:'rear',angle:1.176}],['0893',{mode:'rear',angle:1.12}]]);
ids(stoodBand,'stretch-band',['lat','trap'],camera,[
 ['3899',{mode:'row'}],['0892',{mode:'row',angle:.924}],['4698',{mode:'row',angle:1.16}],['4452',{mode:'row',width:.225}],
 ['4570',{mode:'row',neutralGrip:true}],['3858',{mode:'row',angle:1.01}],['4569',{mode:'row',one:true,neutralGrip:true}],
]);
ids(stoodBand,'stretch-band',['calf'],camera,[['0973',{mode:'calf'}],['1505',{mode:'calf',width:.159}],['2425',{mode:'calf',width:.149}]]);
ids(floorRow,'stretch-band',['lat','biceps'],seatedCamera,[['3896',{}],['3121',{sturdy:true}],['4454',{wide:true}],['3845',{sturdy:true,under:true}],['3144',{sturdy:true}]]);
ids(floorRow,'post-stretch-band',['lat','biceps'],seatedCamera,[['5005',{under:true,post:true}]]);
ids(anchoredRowBand,'post-stretch-band',['lat','biceps'],postCamera,[
 ['4145',{close:true}],['4147',{high:true,close:true}],['4148',{high:true,close:true,reverse:true}],['10668',{kneeling:true,one:true}],
 ['4453',{low:true,one:true}],['4575',{one:true}],['4146',{one:true,twist:true}],
]);
ids(anchoredRowBand,'post-stretch-band',['rearShoulder','trap'],postCamera,[['1006',{rear:true}],['1022',{rear:true,high:true}],['4182',{rear:true}]]);
ids(opening,'stretch-band',['rearShoulder','trap'],camera,[['4568',{}],['5317',{raise:.707}]]);
ids(opening,'post-stretch-band',['biceps'],{...postCamera,focus:[0,.97,-.29]},[['4084',{horizontalCurl:true}]]);
ids(pallof,'post-stretch-band',['core'],pallofCamera,[
 ['3524',{mode:'squat'}],['3776',{mode:'step',fixed:true}],['3775',{mode:'split',fixed:true}],['3774',{mode:'squat',fixed:true}],
 ['1015',{up:true}],['10184',{mode:'split',alternate:true}],['4240',{}],['3790',{mode:'step',fixed:true}],
 ['3797',{mode:'split',fixed:true}],['3796',{mode:'squat',fixed:true}],
]);
ids(loopedAbduction,'mat-stretch-band',['glute','core'],{...seatedCamera,focus:[0,.64,.15]},[
 ['7198',{position:'bridge'}],['10899',{position:'supine'}],['7211',{position:'prone'}],
]);
ids(loopedAbduction,'seat-stretch-band',['glute'],seatedCamera,[['7200',{position:'seat'}],['11050',{position:'seat',feetOff:true}]]);

const [directory,...requested]=process.argv.slice(2);
if(!directory) throw Error('Pass the output directory and optional catalogue IDs.');
const selected=requested.length?jobs.filter(({id})=>requested.includes(id)):jobs;
if(!selected.length||(requested.length&&selected.length!==requested.length))throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
for(const {id,pose,preset,muscles,view} of selected){
  const recipe={version:1,equipment:preset,durationMs:4400,muscles,camera:view,keyframes:Array.from({length:57},(_,i)=>({at:i/56,...pose(i/56)}))};
  try { prepareRecipe(recipe); } catch(error) { throw Error(id+': '+error.message,{cause:error}); }
  await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
  items.push({id,recipe:id+'.json',posterAt:.46});
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(`Prepared ${items.length} band recipes.`);
