import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides=[['l',1],['r',-1]];
const plus=(a,b)=>a.map((value,index)=>value+b[index]);
const minus=(a,b)=>a.map((value,index)=>value-b[index]);
const scale=(array,value)=>array.map(x=>x*value);
const dot=(a,b)=>a.reduce((total,value,index)=>total+value*b[index],0);
const unit=(point)=>scale(point,1/Math.hypot(...point));
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const smooth=(t)=>{ const phase=clamp(t,0,1); return phase**2*(3-2*phase); };
const cycle=(phase)=>smooth(phase/.43)*smooth((1-phase)/.42);

function joints(origin,dest,pole,upper,lower) {
  const path=minus(dest,origin);
  const direction=unit(path);
  const span=clamp(Math.hypot(...path),Math.abs(upper-lower)+.004,upper+lower-.004);
  const projected=minus(pole,scale(direction,dot(direction,pole)));
  const along=(upper**2+span**2-lower**2)/(2*span);
  return [plus(plus(origin,scale(direction,along)),scale(unit(projected),Math.sqrt(upper**2-along**2))),
    plus(origin,scale(direction,span))];
}

function athlete(hips,pitch,facing=1) {
  const torso=[0,Math.cos(pitch),facing*Math.sin(pitch)];
  const at=(length,x=0)=>plus(plus(hips,[facing*x,0,0]),scale(torso,length));
  return {hips,chest:at(.365),neck:at(.602),head:at(.721),
    ls:at(.496,.190),rs:at(.496,-.190),lh:at(0,.101),rh:at(0,-.101),planted:{},leverPressHandles:[]};
}

function plateTravel(preset,amount,depth) {
  if(preset==='angled') {
    const angle=.325+.51*amount*depth;
    return {point:[0,.363+.751*Math.sin(angle),1.276-.751*Math.cos(angle)],pivot:[0,.363,1.276]};
  }
  if(preset==='outdoor') {
    const angle=.44-.317*amount*depth;
    return {point:[0,1.270-.786*Math.cos(angle),1.012-.786*Math.sin(angle)],pivot:[0,1.270,1.012]};
  }
  if(preset==='calf')return {point:[0,.570,.880+.066*amount],pivot:[0,.271,1.103]};
  if(preset==='calf-angled')return {point:[0,.638+.061*amount,.691+.041*amount],pivot:[0,.286,1.106]};
  return {point:[0,preset==='seat'?.584:.562,preset==='seat'?.725:.650+.246*amount*depth],pivot:[0,.288,1.183]};
}

function pressStation(phase,{preset,single=false,wide=false,depth=1,feetOffset=0}) {
  const amount=cycle(phase);
  const reclined=preset==='angled'||preset==='calf-angled';
  const movingSeat=preset==='seat';
  const calf=preset.startsWith('calf');
  const pitch=reclined?-.733:movingSeat?-.238:-.10;
  const hips=reclined?[0,.463,-.056]:movingSeat?[0,mix(.503,.620,amount),mix(.050,-.204,amount)]:[0,.559,-.041];
  const pose=athlete(hips,pitch);
  const {point,pivot}=plateTravel(preset,amount,depth);
  const plateAngle=reclined?-.60:0;
  const normal=[0,-Math.sin(plateAngle),Math.cos(plateAngle)];
  const vertical=[0,Math.cos(plateAngle),Math.sin(plateAngle)];
  for(const [side,sign] of sides) {
    const resting=single&&sign<0;
    const width=wide?.261:single?.134:.164;
    const sole=plus(plus(point,[sign*width,0,0]),scale(vertical,feetOffset));
    let ankle=plus(plus(sole,scale(normal,-.115)),scale(vertical,-.067));
    let toe=plus(plus(sole,scale(normal,-.043)),scale(vertical,.066));
    if(calf){
      const angle=mix(1.09,.44,amount);
      toe=plus(sole,[0,-.059,-.041]);
      ankle=plus(toe,[0,-.147*Math.sin(angle),-.147*Math.cos(angle)]);
    }
    if(resting) {
      ankle=[sign*.422,.075,preset==='seat'?.422:.352];
      toe=plus(ankle,[sign*.025,-.071,.139]);
      pose.planted[side]=0;
    }
    [pose[side+'k'],pose[side+'a']]=joints(pose[side+'h'],ankle,[sign*(wide?.38:.15),.99,-.094],.422,.424);
    pose[side+'t']=plus(pose[side+'a'],minus(toe,ankle));
    const hand=movingSeat?plus(pose[side+'s'],[sign*.100,-.104,.279])
      :plus(hips,[sign*.253,.033,.199]);
    [pose[side+'e'],pose[side+'w']]=joints(pose[side+'s'],hand,[sign*.61,-.89,.15],.252,.371);
    pose[side+'Grip']=movingSeat?[1,0,0]:[0,0,1];
    pose.leverPressHandles.push({pivot:plus(pivot,[sign*.384,0,0]),point:plus(point,[sign*.319,0,0]),axis:[1,0,0]});
  }
  return pose;
}

function hackSquat(phase,{preset,single=false,pistol=false,depth=1,width=.173}) {
  const amount=cycle(phase);
  const facing=preset.startsWith('hack-reverse')?-1:1;
  const mode=preset.slice(5);
  const pendulum=mode==='pendulum';
  const pivoting=pendulum||mode==='arc'||mode==='chair'||mode==='abduction';
  const pitch=facing<0?.083:pivoting?-.095-.098*amount:-.189;
  const pivot=pivoting ? [0,pendulum?1.704:1.641,pendulum?-.658:-.573] : [0,1.826,-.307];
  const theta=pendulum?.277+.549*amount*depth:.266+.565*amount*depth;
  const radius=pendulum?.826:.755;
  const board=.115;
  const hips=pivoting ? [0,pivot[1]-radius*Math.sin(theta)-.506*Math.cos(pitch),
    pivot[2]+radius*Math.cos(theta)-.506*Math.sin(pitch)]
    : [0,.929-(facing<0?.386:.397)*amount*depth,
      mode==='reverse'?.219:mode==='reverse-slope'?mix(.126,.246,amount):mix(.052,-.185,amount)];
  const p=athlete(hips,pitch,facing);
  for(const [side,sign] of sides) {
    const xSign=facing*sign;
    const resting=single&&sign<0;
    const placed=[xSign*width,board+.076,facing<0?.032:.274];
    const floating=plus(p[side+'h'],[xSign*.048,-.400+(pistol?.311:.127)*amount,
      (pistol?.432:.226)+(pistol?.308:.090)*amount]);
    [p[side+'k'],p[side+'a']]=joints(p[side+'h'],resting?floating:placed,[xSign*(width>.20?.36:.142),.25,facing],.422,.424);
    p[side+'t']=plus(p[side+'a'],[xSign*(width>.20?.039:.016),resting?.031:-.068,facing*.143]);
    if(!resting)p.planted[side]=board;
    const shoulder=p[side+'s'];
    const hand=plus(shoulder,[xSign*.148,-.125,facing*.196]);
    [p[side+'e'],p[side+'w']]=joints(shoulder,hand,[xSign*.76,-.45,-facing*.39],.252,.371);
    p[side+'Grip']=[0,0,facing];
    p.leverPressHandles.push({pivot:[xSign*.449,pivot[1],pivot[2]],
      point:plus(shoulder,[xSign*.039,.086,facing*.013]),axis:[1,0,0]});
  }
  return p;
}

function hackCalf(phase,{single,stretch=false}) {
  const amount=stretch?.60*(1-smooth(phase/.20)*smooth((1-phase)/.22)):cycle(phase);
  const hip=[0,.973+.063*amount,-.029+.028*amount];
  const pose=athlete(hip,-.175);
  for(const [side,sign] of sides){
    const floating=single&&sign<0;
    const x=sign*(single?.108:.171);
    const ankle=floating?[sign*.188,.339,.466]:[x,.192+.090*amount,.318-.020*amount];
    const toe=floating?plus(ankle,[sign*.023,.012,.142]):[x+sign*.018,.158,.419];
    [pose[side+'k'],pose[side+'a']]=joints(pose[side+'h'],ankle,[sign*.15,.26,.95],.422,.424);
    pose[side+'t']=plus(pose[side+'a'],minus(toe,ankle));
    const shoulder=pose[side+'s'];
    const hand=plus(shoulder,[sign*.148,-.115,.188]);
    [pose[side+'e'],pose[side+'w']]=joints(shoulder,hand,[sign*.76,-.45,-.39],.252,.371);
    pose[side+'Grip']=[0,0,1];
    pose.leverPressHandles.push({pivot:[sign*.449,1.822,-.307],
      point:plus(shoulder,[sign*.039,.086,.013]),axis:[1,0,0]});
  }
  return pose;
}

function shoulderLever(phase,{preset,single=false,variation=0}) {
  const shrug=preset==='hack-shrug';
  const hinge=!shrug;
  const amount=cycle(phase);
  const facing=hinge?-1:1;
  const hip=hinge?[0,.937-.162*amount,.208+.206*amount]:[0,.919,.072];
  const pitch=hinge?.075+(single?.917:.792)*amount:0;
  const p=athlete(hip,pitch,facing);
  if(shrug) for(const [side] of sides)p[side+'s'][1]+=.079*amount;
  for(const [side,sign] of sides){
    const mirror=sign*facing;
    const floating=single&&sign<0;
    const placed=[mirror*(single?.119:.173),.190,hinge?.061:.188];
    const spare=plus(p[side+'h'],[mirror*.051,mix(-.558,-.211,amount),mix(.076,.771,amount)]);
    [p[side+'k'],p[side+'a']]=joints(p[side+'h'],floating?spare:placed,[mirror*.15,.18,facing],.422,.424);
    p[side+'t']=plus(p[side+'a'],[mirror*.018,floating?.038:-.068,facing*.144]);
    if(!floating)p.planted[side]=.115;
    const shoulder=p[side+'s'];
    const hand=plus(shoulder,[mirror*(variation?.091:.154),variation?-.197:-.138,facing*.192]);
    [p[side+'e'],p[side+'w']]=joints(shoulder,hand,[mirror*.79,-.53,-facing*.46],.252,.371);
    p[side+'Grip']=[0,0,facing];
    p.leverPressHandles.push({pivot:[mirror*.448,hinge?1.736:1.744,hinge?-.426:-.483],
      point:plus(shoulder,[mirror*.031,.084,facing*.018]),axis:[1,0,0]});
  }
  return p;
}

const jobs=[
  ['8375',{preset:'angled'}], ['9387',{preset:'angled',single:true,depth:.94}],
  ['2951',{preset:'horizontal'}], ['3768',{preset:'horizontal',depth:.91}],
  ['3385',{preset:'horizontal',depth:.96,feetOffset:.022}],
  ['7107',{preset:'horizontal',single:true,depth:.93}], ['6354',{preset:'outdoor',depth:.95}],
  ['1385',{preset:'calf'}], ['2289',{preset:'calf',feetOffset:.014}],
  ['7176',{preset:'calf',feetOffset:.032}], ['7177',{preset:'calf',single:true,feetOffset:.032}],
  ['1232',{preset:'seat'}], ['1573',{preset:'seat',single:true}],
  ['1574',{preset:'seat',wide:true}], ['1572',{preset:'seat',wide:true,single:true}],
  ['5516',{preset:'hack-arc',depth:.94}], ['6523',{preset:'hack-linear'}],
  ['5784',{preset:'hack-reverse',depth:.96}], ['4951',{preset:'hack-pendulum',depth:1.06}],
  ['1875',{preset:'hack-arc',depth:.91}], ['1038',{preset:'hack-chair',depth:.91}],
  ['1040',{preset:'hack-arc',single:true,pistol:true,depth:.96}],
  ['9929',{preset:'hack-arc',single:true,depth:.91}],
  ['1992',{preset:'hack-linear',depth:1.17}],
  ['4100',{preset:'hack-linear',depth:.95,width:.287}],
  ['1579',{preset:'hack-linear',single:true,depth:.95,width:.102}],
  ['1383',{preset:'hack-calf'}],
  ['1384',{preset:'hack-calf',single:true}],
  ['1039',{preset:'hack-arc',depth:1.09}],
  ['2746',{preset:'hack-abduction',depth:.932,width:.258}],
  ['1583',{preset:'hack-reverse-slope',depth:.94}],
  ['6733',{preset:'hack-hinge'}],
  ['8799',{preset:'hack-hinge',single:true}],
  ['0580',{preset:'hack-shrug'}],
  ['1439',{preset:'hack-shrug',variation:1}],
  ['1447',{preset:'hack-calf',single:true,stretch:true}],
  ['1220',{preset:'calf-angled'}],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory) throw new Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length!==0&&selected.length!==ids.length) throw new Error('Unknown or repeated lower machine ID.');
const root=resolve(directory);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,config] of selected) {
  const squatCalf=config.preset==='hack-calf';
  const calf=config.preset.startsWith('calf')||squatCalf;
  const hack=config.preset.startsWith('hack-');
  const shoulder=config.preset==='hack-shrug'||config.preset==='hack-hinge';
  const muscles=calf?['calf']:config.preset==='hack-shrug'?['trap']:shoulder?['hamstring','glute']:['quad','glute'];
  const data={version:1,durationMs:config.stretch?6100:4400,equipment:'lever-press-station-'+config.preset,
    muscles:config.single?muscles.map(muscle=>'l:'+muscle):muscles,
    camera:hack?{yaw:config.preset.startsWith('hack-reverse')||config.preset==='hack-hinge'?48:57,elevation:12,height:2.55,focus:[0,1.0,.015]}
      :{yaw:config.preset==='angled'?104:config.preset==='seat'?106:98,elevation:14,height:2.09,focus:[0,.82,.381]},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...(squatCalf?hackCalf:shoulder?shoulderLever:hack?hackSquat:pressStation)(i/60,config)}))};
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
