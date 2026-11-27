import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, unit } from './bodyweight/pose.mjs';

const jobs=[];
const neutral=[0,0,1], lateral=[1,0,0], reverse=[-1,0,0];
const frontCamera={yaw:34,elevation:13,focus:[0,1.03,.13],height:2.42};
const rearCamera={yaw:-53,elevation:13,focus:[0,.98,-.23],height:2.45};
const floorCamera={yaw:56,elevation:23,focus:[0,.51,.19],height:1.86};
function register(sample, equipment, muscles, camera, variants){
  for(const [id,profile] of variants)jobs.push({id,sample:phase=>sample(phase,profile),equipment,muscles,camera});
}
function foot(pose,side,sign,{x=.171,y=.075,z=.040}={}){
  leg(pose,side,[sign*x,y,z],[sign*.143,.025,1],[sign*.017,-.071,.138],0);
}
function staggered(pose,side,sign,spacing=.173) {
  foot(pose,side,sign,{x:.158,z:.073+spacing*sign});
}
function restHand(pose,side,sign){
  arm(pose,side,add(pose[side+'h'],[sign*.09,.067,.115]),[sign*.84,-.46,-.12]);
}
function shoeAnchor(pose,side){
  return add(blend(pose[side+'a'],pose[side+'t'],.66),[0,-.026,0]);
}
function fixedBand(pose,anchor,both=true){
  pose.bandPath=both?[pose.lw,anchor,pose.rw]:[pose.rw,anchor];
}
function floorBand(pose,one=false,loop=false){
  pose.bandPath=one?[pose.rw,shoeAnchor(pose,'r')]:loop?
    [pose.lw,shoeAnchor(pose,'r'),pose.rw]:[pose.lw,shoeAnchor(pose,'l'),shoeAnchor(pose,'r'),pose.rw];
}
function kneel(pose,half=false){
  for(const [side,sign] of sides){
    if(half&&side==='r'){foot(pose,side,sign,{x:.144,z:.449});continue;}
    pose[side+'k']=[sign*.143,.090,.152];
    pose[side+'a']=[sign*.139,.092,-.266];
    pose[side+'t']=[sign*.151,.025,-.386];
  }
}
function alternating(phase,side){
  return ((phase<.5)===(side==='r'))?rep((phase*2)%1):0;
}

function chestBand(phase,options){
  const {mode='press',height=1.30,one=false,alternate=false,twist=false,kneeling=false,incline=false,floor=false}=options;
  const t=rep(phase);
  const rotation=twist ? (phase<.5?1:-1)*.38*rep((phase*2)%1) : 0;
  const anchor=[0,height,-1.096];
  const pose=stand([0,floor?.152:incline?.575:kneeling?.480:.863,incline?.216:floor?.119:.084],
    floor?-Math.PI/2:incline?-.754:kneeling?.068:.124,rotation);
  if(kneeling)kneel(pose);
  const low=height<.45;
  const high=height>1.70;
  for(const [side,sign] of sides){
    if(!kneeling){
      if(floor||incline)foot(pose,side,sign,{x:.192,y:floor?.105:.075,z:floor?.576:.603});
      else staggered(pose,side,sign,.207);
    }
    if(one&&side==='l'){restHand(pose,side,sign);continue;}
    const s=pose[side+'s'];
    const duty=alternate?alternating(phase,side):t;
    if(mode==='fly'){
      const start=[sign*.54,high?.177:low?-.321:-.043,-.151];
      const finish=[-sign*(alternate?.195:.131),high?-.335:low?.225:.038,high?.45:low?.493:.559];
      grip(pose,side,add(s,scale(unit(blend(start,finish,duty)),.583)),[sign*.65,-.63,-.46],neutral);
    }else{
      const open=add(s,[sign*.143,floor||incline?.038:-.068, floor?.101:incline?.096:.169]);
      const close=add(s,[-sign*(one?.224:.088),floor?.590:incline?.457:low?.271:high?-.180:.041,
        floor?.076:incline?.341:low?.525:.569]);
      grip(pose,side,blend(open,close,duty),[sign*.87,-.54,.14],lateral);
    }
  }
  if(floor)pose.bandPath=[pose.lw,[.158,.076,pose.chest[2]],[-.158,.076,pose.chest[2]],pose.rw];
  else if(incline)pose.bandPath=[pose.lw,[.248,.255,-.334],[-.248,.255,-.334],pose.rw];
  else fixedBand(pose,anchor,!one);
  return pose;
}

function shoulderBand(phase,options){
  const {seated,behind,one,sideBend,twist,narrow}=options;
  const t=rep(phase);
  const roll=sideBend?.27*t:0;
  const turn=twist ? (phase<.5?1:-1)*.57*rep((phase*2)%1):0;
  const pose=stand([0,seated?.530:.871,-.035],.026,turn,roll);
  for(const [side,sign] of sides){
    foot(pose,side,sign,{x:narrow?.143:.180,z:seated?.413:sign*(twist?.112:.044)});
    if(one&&side==='l'){restHand(pose,side,sign);continue;}
    const d=twist ? alternating(phase,side) : t;
    const s=pose[side+'s'];
    const z=behind ? mix(-.137,-.039,d) : mix(.151,.063,d);
    const x=sign*(behind?mix(.210,.055,d):mix(.167,.035,d));
    grip(pose,side,add(s,[x,mix(.004,.594,d),z]),[sign*.93,-.57,.089],lateral);
  }
  floorBand(pose,one);
  return pose;
}

function elbowBand(phase,options){
  const {style,one,manual=false,singleFoot=false,anchorLow=false,stretch=false}=options;
  const t=rep(phase);
  const prone=style==='floor-down';
  const skull=style==='skull';
  const overhead=style==='overhead';
  const kick=style==='kick';
  const floor=prone||skull;
  const pitch=floor?-Math.PI/2:kick?1.12:overhead?.06:.105;
  const pose=stand([0,floor?.151:kick?.817:.870,floor?.063:-.030],pitch);
  for(const [side,sign] of sides){
    foot(pose,side,sign,{x:floor?.188:.151,y:floor?.104:.075,z:floor?.592:sign*(one?.139:.079)});
    if(one&&side==='l'){
      if(manual)grip(pose,side,[.219,.695,-.189-(stretch?.09*t:0)],[.49,-.52,-.81],neutral);
      else restHand(pose,side,sign);
      continue;
    }
    const s=pose[side+'s'];
    let elbow,direction,axis=lateral;
    if(overhead){
      elbow=add(s,[sign*.029,.240,.064]);
      const a=mix(stretch?-2.08:-1.99,stretch?-1.76:.397,t);
      direction=[0,Math.cos(a),Math.sin(a)];
    } else if(skull){
      elbow=add(s,[sign*.023,.238,-.031]);
      const a=mix(-1.62,.049,t);
      direction=[0,Math.cos(a),Math.sin(a)];
    } else if(prone){
      elbow=add(s,[sign*.042,.218,.087]);
      const a=mix(-1.73,1.64,t);
      direction=[0,Math.cos(a),Math.sin(a)];
      axis=reverse;
    } else if(kick){
      elbow=add(s,[sign*.032,-.019,-.241]);
      const a=mix(.07,1.505,t);
      direction=[0,-Math.cos(a),-Math.sin(a)];
      axis=neutral;
    } else {
      elbow=add(s,[sign*.037,-.234,.056]);
      const a=mix(1.88,.089,t);
      direction=[0,-Math.cos(a),Math.sin(a)];
    }
    const target=add(elbow,scale(direction,.369));
    grip(pose,side,target,add(elbow,scale(s,-1)),axis);
  }
  if(manual)pose.bandPath=[pose.lw,add(pose.rs,[.076,.129,-.186]),pose.rw];
  else if(floor)fixedBand(pose,[0,.183,-1.188],!one);
  else if(kick||overhead&&!anchorLow)floorBand(pose,one,singleFoot);
  else fixedBand(pose,[0,anchorLow?.173:2.075,anchorLow?-1.064:1.066],!one);
  return pose;
}

function pullBand(phase,options){
  const {kneeling,hinge=false,skier=false,straight=false,alternate=false,one=false,plank=false,under=false}=options;
  const t=rep(phase);
  const turn=alternate?(phase<.5?1:-1)*.47*rep((phase*2)%1):0;
  const hip=[0,plank?.536:kneeling?.482:hinge?.792:skier?.867-.183*t:.870,hinge?-.14:skier?-.21*t:-.017];
  const pitch=plank?1.527:hinge?1.14:skier?.11+.80*t:.041+(straight?.061*t:0);
  const pose=stand(hip,pitch,turn);
  if(kneeling)kneel(pose);
  for(const[side,sign] of sides){
    if(plank)leg(pose,side,[sign*.212,.104,-.775],[sign*.074,-.82,.22],[sign*.019,-.073,-.136],.025);
    else if(!kneeling)staggered(pose,side,sign,alternate?.223:.036);
    if(one&&side==='l'){
      arm(pose,side,[.201,.078,.530],[.47,.116,-.83],[0,-.036,1]);
      continue;
    }
    const d=alternate?alternating(phase,side):t;
    const s=pose[side+'s'];
    let hand,pole=[sign*.61,-.53,-.81];
    if(skier||straight||plank){
      const angle=mix(plank?1.60:hinge?2.42:2.27,plank?-.66:skier?-.53:.089,d);
      hand=add(s,[sign*.052,-.591*Math.cos(angle),.592*Math.sin(angle)]);
      if(plank){
        hand=add(s,[sign*.072,-.074,mix(.595,-.434,d)]);
        pole=[sign*.58,.61,-.18];
      }
    }else{
      hand=add(s,[sign*mix(.079,.034,d),mix(hinge?.167:.462,-.234,d),mix(hinge?.549:.356,.127,d)]);
    }
    grip(pose,side,hand,pole,under?reverse:neutral);
  }
  const mount=[0,plank?.27:2.123,plank?1.392:1.172];
  fixedBand(pose,mount,!one);
  return pose;
}

function lowerBand(phase,options){
  const {mode,one,post,wide,twist=false,narrow=false}=options;
  const t=rep(phase);
  const sway=twist ? (phase<.5?1:-1)*.36*rep((phase*2)%1):0;
  const squats=mode==='squat'||mode==='thruster'||mode==='row-squat';
  const over=mode==='overhead';
  const upper=mode==='thruster';
  const swing=mode==='swing';
  const good=mode==='good';
  const row=mode==='row'||mode==='row-squat';
  const back=mode==='pull-through';
  const chair=mode==='lunge';
  const depth=squats||chair?.320:mode==='good'?.077:.133;
  const pitch=squats?.048+.334*t:chair?.065+.206*t:.06+(swing?1.03:wide?1.03:1.224)*t;
  const pose=stand([one?-.101:0,.873-depth*t,(chair?.052:-.030) -(squats?.198:.263)*t],pitch,sway);
  for(const[side,sign] of sides){
    if((one&&side==='l')&&!chair){
      const a=mix(-1.56,-3.03,t);
      legAngles(pose,side,sign,a,a-.019);
    }else if(chair&&side==='l'){
      leg(pose,side,[.136,.122,-.564],[.09,-.86,.38],[.012,-.121,.10],0);
    }else foot(pose,side,sign,{x:wide?.275:narrow?.117:.169,z:chair?.341:sign*.033});
    const s=pose[side+'s'];
    if(post&&row&&side==='l'){restHand(pose,side,sign);continue;}
    const drive = upper ? ramp(phase,.54,.75) * (1-ramp(phase,.88,1)) : 0;
    let hand;
    if(good)hand=add(pose.neck,[sign*.118,-.034,-.101]);
    else if(over||upper)hand=add(s,[sign*mix(.211,.063,drive),mix(.092,.593,drive),mix(.144,.081,drive)]);
    else if(swing)hand=add(s,[sign*.021,mix(-.026,-.550,t),mix(.562,-.283,t)]);
    else if(row)hand=add(s,[sign*.045,mix(-.586,-.207,t),mix(.051,-.104,t)]);
    else if(back)hand=add(pose.hips,[sign*.041,-.265,-.194*t+.095]);
    else hand=add(s,[sign*(chair?.085:.044),-.581,.178]);
    grip(pose,side,hand,[sign*.46,-.70,-.31], neutral);
  }
  if(good)pose.bandPath=[shoeAnchor(pose,'l'),pose.lw,add(pose.neck,[0,-.043,-.102]),pose.rw,shoeAnchor(pose,'r')];
  else if(post)fixedBand(pose,[0,.183,back?-1.17:1.165],!row);
  else floorBand(pose,one&&chair, one);
  return pose;
}

function standingSquatRow(phase) {
  const t=rep(phase);
  const pose=stand([0,mix(.542,.873,t),mix(-.245,-.019,t)],mix(.392,.033,t));
  for(const[side,sign] of sides){
    foot(pose,side,sign,{x:.180,z:.031});
    const s=pose[side+'s'];
    const open=add(s,[sign*.053,-.064,.581]);
    const close=add(s,[sign*.042,-.229,.120]);
    grip(pose,side,blend(open,close,t),[sign*.63,-.56,-.60],neutral);
  }
  fixedBand(pose,[0,1.213,1.127]);
  return pose;
}

function lyingLegPress(phase,options){
  const t=rep(phase);
  const pose=stand([0,.156,-.232],-Math.PI/2);
  for(const[side,sign] of sides){
    const p=options.alternate?alternating(phase,side):t;
    const thigh=mix(1.65,.732,p);
    const shin=mix(-.218,.717,p);
    legAngles(pose,side,sign,thigh,shin);
    grip(pose,side,add(pose[side+'s'],[sign*.064,.284,.096]),[sign*.72,-.195,.61],neutral);
  }
  floorBand(pose);
  return pose;
}

function chopBand(phase, options){
  const t=rep(phase);
  const {half,kneeling,up,wide,vertical=false,squat=false}=options;
  const pose=stand([0,half||kneeling?.473:squat?.850-.178*t:.870,.021],.027,
    options.anti?.06*t:mix(.47,-.61,t),.087*(1-2*t));
  if(half||kneeling)kneel(pose,half);
  else for(const[side,sign] of sides)foot(pose,side,sign,{x:wide?.281:.173,z:sign*.049});
  const high=half||kneeling?1.278:1.672;
  const peak=vertical?[0,high+.252,.349]:[.423,high,.348];
  const low=[-.41,half||kneeling?.530:.784,.369];
  const center=up?blend(low,peak,t):blend(peak,low,t);
  for(const[side,sign] of sides)grip(pose,side,add(center,[sign*.049,0,0]),[sign*.52,-.74,-.35],neutral);
  pose.bandPath=[pose.lw,[1.02,up?.184:2.013,.027],pose.rw];
  return pose;
}

register(chestBand,'post-stretch-band',['pec','triceps'],rearCamera,[
  ['3324',{height:.175,alternate:true,twist:true}],['4076',{one:true}],['4077',{height:.175,alternate:true}],
  ['4074',{height:.175}],['4079',{alternate:true}],['3780',{}],['5608',{height:1.194}],['0923',{height:.261}],
  ['3798',{alternate:true,twist:true,height:1.248}],['4684',{height:.171,kneeling:true}],
]);
register(chestBand,'post-stretch-band',['pec'],rearCamera,[
  ['4078',{mode:'fly',height:.184,alternate:true}],['4075',{mode:'fly'}],['3757',{mode:'fly',height:1.959}],
  ['4073',{mode:'fly',height:.184}],['0908',{mode:'fly',height:.225}],['0913',{mode:'fly',height:1.279}],
]);
register(chestBand,'incline-stretch-band',['pec','triceps'],{...rearCamera,yaw:49,focus:[0,.85,-.015],height:2.05},[['4544',{incline:true}]]);
register(chestBand,'mat-stretch-band',['pec','triceps'],floorCamera,[['11285',{floor:true}]]);
register(shoulderBand,'stretch-band',['shoulder','triceps'],frontCamera,[
  ['1499',{behind:true}],['2996',{one:true}],['4686',{behind:true,narrow:true}],['5205',{}],
  ['8364',{narrow:true}],['5204',{one:true,narrow:true}],['4700',{one:true,sideBend:true}],['1012',{twist:true}],
]);
register(shoulderBand,'seat-stretch-band',['shoulder','triceps'],{...frontCamera,focus:[0,.82,.079],height:2.06},[['3122',{seated:true}]]);
register(elbowBand,'stretch-band',['triceps'],frontCamera,[
  ['4140',{style:'overhead',one:true}],['4139',{style:'overhead',singleFoot:true}],
  ['4694',{style:'overhead'}],
]);
register(elbowBand,'stretch-band',['triceps'],{...frontCamera,yaw:-72,elevation:19,height:2.21},[
  ['4143',{style:'kick',one:true}],
]);
register(elbowBand,'stretch-band',['triceps'],{...rearCamera,yaw:-139,elevation:14,height:2.21},[
  ['4359',{style:'overhead',one:true,manual:true}],['10741',{style:'overhead',one:true,manual:true,stretch:true}],
]);
register(elbowBand,'post-stretch-band',['triceps'],{...frontCamera,yaw:55,focus:[0,1.06,.45],height:2.56},[
  ['1502',{style:'down'}],['4680',{style:'down'}],['4688',{style:'down'}],
]);
register(elbowBand,'post-stretch-band',['triceps'],{...rearCamera,yaw:-60},[
  ['4141',{style:'overhead',one:true,anchorLow:true}],['3939',{style:'overhead',anchorLow:true}],
]);
register(elbowBand,'mat-post-stretch-band',['triceps'],{...floorCamera,yaw:-65,focus:[0,.71,-.402],height:2.19},[
  ['4142',{style:'floor-down'}],['1504',{style:'skull'}],
]);
register(pullBand,'post-stretch-band',['lat','biceps'],{...frontCamera,yaw:57,focus:[0,1.05,.41],height:2.55},[
  ['3326',{alternate:true}],['0905',{kneeling:true}],['4144',{hinge:true}],
]);
register(pullBand,'post-stretch-band',['lat','core'],{...frontCamera,yaw:56,focus:[0,1.03,.41],height:2.55},[
  ['3779',{skier:true}],['4697',{skier:true,under:true}],['3795',{skier:true}],['4576',{straight:true}],['0928',{straight:true,under:true}],
]);
register(pullBand,'mat-post-stretch-band',['r:lat','core'],{...floorCamera,yaw:58,focus:[0,.55,.25]},[
  ['3777',{plank:true,one:true}],['3791',{plank:true,one:true,under:true}],
]);
register(lowerBand,'stretch-band',['glute','hamstring'],{...frontCamera,yaw:59,height:2.15},[
  ['4618',{mode:'deadlift'}],['1513',{mode:'good'}],['0919',{mode:'deadlift',one:true}],
  ['4678',{mode:'swing'}],
]);
register(lowerBand,'stretch-band',['quad','glute'],{...frontCamera,yaw:45,height:2.19},[
  ['0909',{mode:'lunge'}],['4135',{mode:'lunge',wide:true}],['4679',{mode:'lunge',one:true}],
  ['1004',{mode:'squat'}],['4683',{mode:'squat',wide:true}],['2153',{mode:'squat'}],['4398',{mode:'squat'}],
  ['8608',{mode:'squat',wide:true}],['0784',{mode:'squat',narrow:true}],['4689',{mode:'lunge'}],
  ['2970',{mode:'thruster'}],
]);
register(lowerBand,'post-stretch-band',['glute','hamstring','lat'],{...frontCamera,yaw:53,focus:[0,.90,.38],height:2.27},[
  ['3771',{mode:'row',post:true}],['3787',{mode:'row',post:true}],['3773',{mode:'row',post:true,one:true}],['3789',{mode:'row',post:true,one:true}],
  ['3770',{mode:'row-squat',post:true}],['3786',{mode:'row-squat',post:true}],
]);
register(standingSquatRow,'post-stretch-band',['quad','glute','lat'],{...frontCamera,yaw:49,focus:[0,.95,.43],height:2.24},[['1003',{}]]);
register(lowerBand,'post-stretch-band',['glute','hamstring'],{...rearCamera,yaw:57,focus:[0,.89,-.41]},[['5837',{mode:'pull-through',post:true}]]);
register(lyingLegPress,'mat-stretch-band',['quad','glute'],{...floorCamera,focus:[0,.57,.12]},[['4681',{alternate:true}],['8142',{}]]);
register(chopBand,'post-stretch-band',['core'],{...frontCamera,yaw:17,focus:[.32,1.04,.11],height:2.56},[
  ['4573',{half:true}],['4776',{kneeling:true}],['8002',{wide:true,anti:true}],['4696',{up:true}],['0931',{up:true,vertical:true}],
  ['3847',{}],['4137',{squat:true}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass the output directory and optionally exact catalogue IDs.');
const selected=ids.length?jobs.filter(({id})=>ids.includes(id)):jobs;
if(!selected.length||(ids.length&&selected.length!==ids.length))throw Error('Unknown or repeated ID.');
const output=resolve(directory); await mkdir(output,{recursive:true});
const failures=[], items=[];
for(const {id,sample,equipment,muscles,camera} of selected){
  try{
    const durationMs=4400;
    const keyframes=Array.from({length:57},(_,i)=>({at:i/56,...sample(i/56)}));
    const recipe={version:1,equipment,muscles,camera,durationMs,keyframes};
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:.45});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
