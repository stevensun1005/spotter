import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, dot, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

function spherePoint(anchor, length, shoulder, target, maximum = .609, minimum = .141) {
  const direction = unit(subtract(target, anchor));
  const onStrap = add(anchor, scale(direction, length));
  const claimedReach = Math.hypot(...subtract(onStrap, shoulder));
  const reach = Math.max(minimum, Math.min(maximum, claimedReach));
  if (reach === claimedReach) return onStrap;
  const travel = subtract(shoulder, anchor);
  const distance = Math.hypot(...travel);
  const axis = scale(travel, 1 / distance);
  const projection = (length ** 2 + distance ** 2 - reach ** 2) / (2 * distance);
  if (Math.abs(projection) >= length) throw new Error('No common point for the grip and strap.');
  const tangent = subtract(direction, scale(axis, dot(direction, axis)));
  return add(anchor, add(scale(axis, projection), scale(unit(tangent), Math.sqrt(length ** 2 - projection ** 2))));
}

function contact(pose, side, anchor, length, target, guide, orientation = 'wide', minimum = .141) {
  const shoulder = pose[side + 's'];
  const endpoint = spherePoint(anchor, length, shoulder, target, .608, minimum);
  const axis = orientation === 'neutral' ? [0, 0, 1] : orientation === 'under' ? [-1, 0, 0] : [1, 0, 0];
  const upward = unit(subtract(anchor, endpoint));
  const tangent = unit(subtract(axis, scale(upward, dot(axis, upward))));
  grip(pose, side, endpoint, guide, tangent);
  if (orientation === 'under') pose[side + 'Fingers'] = [0,.80,-.6];
  pose.straps.push({ side, anchor, end: pose[side + 'w'], axis: tangent });
}

function legsAt(pose, feet, planted = [0,0]) {
  for (const [side, sign] of sides) {
    const index = side === 'l' ? 0 : 1;
    leg(pose, side, feet[index], [sign * .16, -.027, 1], [sign*.016,-.073,.134], planted[index]);
  }
}

function stepPull(phase, option) {
  const t = rep(phase);
  const {type, ring, one, neutral, under, rear, long, height} = option;
  const position = type === 'raise' ? mix(-.50,-.20,t) : mix(long ? -.63 : -.51,type === 'fly' ? -.20 : -.23,t);
  const foot = .454;
  const pelvis = [0,.082+.817*Math.cos(position),foot+.816*Math.sin(position)];
  const pose = stand(pelvis,position);
  pose.straps = [];
  legsAt(pose, [[.150,.080,foot],[-.150,.080,foot-.058]]);
  const anchorZ = .762;
  const anchors = [ring ? .254 : .144,2.310,anchorZ];
  const takeup = height ?? (type === 'raise' ? 1.055 : type === 'face' || type === 'curl' ? 1.092 : 1.112);
  for (const [side,sign] of sides) {
    const s = pose[side+'s'];
    if (one && side === 'l') {
      arm(pose,side,add(pose.chest,[.092,-.092,.142]),[.859,-.56,.14]);
      continue;
    }
    const depth = type === 'curl' ? mix(.552,.121,t)
      : type === 'face' ? mix(.541,.112,t) : type === 'fly' ? mix(.564,.054,t)
      : type === 'raise' ? mix(.248,.309,t) : mix(.547,.116,t);
    const y = type === 'curl' ? mix(-.053,.185,t) : type === 'face' ? mix(-.033,.134,t)
      : type === 'fly' ? mix(-.084,.022,t) : type === 'raise' ? mix(-.389,.507,t) : mix(-.161,rear ? -.053 : -.182,t);
    const x = type === 'fly' ? mix(-.035,.549,t) : type === 'face' ? mix(-.044,.147,t)
      : type === 'curl' ? mix(-.050,long ? .127 : .008,t) : type === 'raise' ? .024 : (rear ? mix(.01,.164,t) : .035);
    const anchor = [sign*anchors[0], anchors[1], anchors[2]];
    const outside = rear || type === 'face' || type === 'fly';
    contact(pose,side,anchor,takeup,add(s,[sign*x,y,depth]),[sign*(outside?.88:.28),type === 'curl'?.58:-.55,-.77],
      neutral ? 'neutral' : under ? 'under' : 'wide');
  }
  return pose;
}

function stepPress(phase, option) {
  const {type, ring, single, oneLeg, close, split, startClose} = option;
  const t = startClose ? 1-rep(phase) : rep(phase);
  const pitch = mix(ring ? .64 : .405,ring ? 1.03 : .795,t);
  const backFoot = -.690;
  const pose = stand([0,.082+.815*Math.cos(pitch),backFoot+.81*Math.sin(pitch)],pitch);
  pose.straps = [];
  const stance = single ? .253 : .141;
  legsAt(pose,[[stance,.078+(oneLeg?.105:0),backFoot+(split?.30:0)],[-stance,.078,backFoot]],[oneLeg ? undefined : 0,0]);
  for(const [side,sign] of sides){
    if(single && side==='l'){
      arm(pose,side,add(pose.chest,[.08,-.05,.147]),[.68,-.82,-.02]);
      continue;
    }
    const s=pose[side+'s'];
    const fly=type==='fly';
    const x=fly ? mix(-.105,.558,t) : close ? mix(-.105,-.029,t) : mix(-.015,.125,t);
    const target=add(s,[sign*x,mix(-.316,fly?-.083:-.13,t),mix(.531,fly?.161:.146,t)]);
    const anchor=[sign*(ring?.285:.152),2.305,-.38];
    contact(pose,side,anchor,ring?1.829:1.474,target,[sign*(close?.26:.82),-.31,-.758],fly?'neutral':'wide');
  }
  return pose;
}

function supportedLower(phase, option){
  const {mode, wide, overhead, single, deep, crossed}=option;
  const t=rep(phase);
  const hinge=mode==='hinge' || mode==='deadlift' || mode==='stretch';
  const lunge=mode==='lunge';
  const lateral=mode==='lateral';
  const calf=mode==='calf';
  const explosive=mode==='jump';
  const flex=explosive ? .39*ramp(phase,0,.32)*(1-ramp(phase,.34,.49)) + .20*ramp(phase,.73,.86)*(1-ramp(phase,.87,1)) : t*(hinge?.103:calf?0:deep?.38:.326);
  const flight=explosive ? .159*Math.sin(Math.PI*ramp(phase,.50,.76)) : 0;
  const feet=wide?.296:single?.096:.171;
  const torsoAngle=hinge?mix(.045,mode==='stretch'?1.19:1.39,t):.053+(.27*(flex/.38));
  const stepIn = ramp(phase, .015, .274);
  const stepOut = ramp(phase, .72, .988);
  const stride = stepIn * (1 - stepOut);
  const stepLift = Math.sin(Math.PI * stepIn) + Math.sin(Math.PI * stepOut);
  const posture=[lateral? .216*t : single ? -.100:0,.869-flex+flight+(calf?.067*t:0),.034-(hinge?.273:.182)*t+(lunge?.10*t:0)];
  const pose=stand(posture,torsoAngle);
  pose.straps=[];
  for(const [side,sign] of sides){
    const rear=lunge&&side==='r';
    const up=single&&side==='l';
    let foot=[sign*feet,.076+flight,.101];
    let planted=flight>.002?undefined:0;
    if(rear){
      foot=[crossed ? -.166+.385*stride : -.167,.081+.039*stride+.076*stepLift,.101-.586*stride];
      planted=stepLift>.015?undefined:0;
    }
    if(lateral&&side==='l') {
      foot=[.169+.558*stride,.077+.074*stepLift,.077];
      planted=stepLift>.015?undefined:0;
    }
    const shoe=calf ? [sign*.017,-.072-.052*t,.137-.012*t]
      : [sign*.016,-.071-(rear?.041*stride:0),.137];
    if(calf) foot[1]+=.054*t;
    if(up){
      planted=undefined;
      if(mode==='deadlift'){
        const angle=-Math.PI/2-t*1.46;
        legAngles(pose,side,sign,angle,angle-.037,.019);
      }else{
        const angle=mix(-.53,-.07,t);
        legAngles(pose,side,sign,angle,angle-.032,.016);
      }
    }else leg(pose,side,foot,[sign*(wide?.66:.20),-.066,1],shoe,planted);
    const shoulder=pose[side+'s'];
    const target=overhead ? add(shoulder,[0,.60,.01]) : add(shoulder,[sign*.026,hinge?.11:-.113,.484]);
    const anchor=overhead ? [shoulder[0],2.309,.68] : [sign*.162,2.309,.846];
    contact(pose,side,anchor,overhead?.980:hinge?1.1:1.183,target,[sign*.69,-.832,-.125], 'wide',overhead ? .587 : .141);
  }
  return pose;
}

function pulse(phase, start, middle, finish) {
  return ramp(phase,start,middle)*(1-ramp(phase,middle,finish));
}

function footContact(pose, side, anchor, length, target, upward = false, minimum = .03) {
  const offset = [0,-.035,upward ? .030 : -.012];
  const hip = add(pose[side+'h'],offset);
  const end = spherePoint(anchor,length,hip,add(target,offset),.840,minimum);
  const ankle = subtract(end,offset);
  const sign = side === 'l' ? 1 : -1;
  leg(pose,side,ankle,[sign*.24,upward ? .69 : -.79,upward ? -.30 : .69],[sign*.013,upward?.069:-.068,upward?.143:-.127]);
  pose.straps.push({side,anchor,end:add(pose[side+'a'],offset),axis:[1,0,0]});
}

function suspendedPlank(phase,{ mode, ring = false, forearm = false, wide = false, one = false }) {
  const t = rep(phase);
  const pike = mode === 'pike';
  const tuck = mode === 'tuck' || mode === 'twist';
  const saw = mode === 'saw';
  const pushUp = mode === 'push' || mode === 'spider';
  const sequence = mode === 'climb-push';
  const isometric = mode === 'hold';
  const extendedHold = mode === 'extend';
  const raised = mode === 'raised';
  const push = sequence ? pulse(phase,.018,.177,.351) : pushUp ? t : 0;
  const active = phase < .5 ? 'l' : 'r';
  const raiseArm = mode === 'reach';
  const twist = mode === 'twist';
  const hips = [twist ? .192*t : one ? -.085 : 0,
    (forearm?.303:.511) + (pike?.404*t:tuck?.108*t:0) - push*.251,
    -.107+(pike?.314*t:tuck?.127*t:saw?-.157*t:extendedHold?.172*t:isometric?.018*t:0)];
  const angle = (forearm?1.52:pike?1.352:1.43) + (pike ? .867*t : tuck?.186*t : push*.19);
  if (pike) {
    hips[1] = .650 - .502*Math.cos(angle);
    hips[2] = .410 - .502*Math.sin(angle);
  }
  const roll = twist ? .234*t : 0;
  const pose = stand(hips,angle,roll);
  pose.straps=[];
  for(const [side,sign] of sides){
    const step=mode==='climb' && side===active ? rep(phase*2%1) : sequence ?
      side==='l' ? pulse(phase,.37,.48,.61) : pulse(phase,.62,.765,.951) : mode==='spider'&&side==='l'?t:0;
    const a = [sign*(wide?.377:.135) + (twist?.185*t:0) + (mode==='spider'?sign*.17*step:0),
      .392+(raised&&side==='l'?.151*t:0),-.853+(pike?.494*t:tuck?.55*t:0)+.56*step+(saw?-.15*t:0)];
    const anchor = [sign*(wide?.391:ring?.278:.156),2.329,-.912];
    const length = raised && side==='l' ? 1.817 : 1.955;
    const flexion = tuck ? t : Math.max(step, mode==='spider'&&side==='l' ? t : 0);
    footContact(pose,side,anchor,length,a,false,.83-.62*flexion);
    const s=pose[side+'s'];
    const armSwing=raiseArm && side===active ? rep(phase*2%1) : 0;
    if(one&&side==='l'){
      arm(pose,side,add(pose.chest,[.082,.029,.152]),[.817,-.48,-.31]);
    }else if(forearm){
      pose[side+'e'] = [sign*.214,.064,.340];
      pose[side+'w'] = [sign*.187,.049,.700];
      pose[side+'Fingers']=[0,-.026,1];
      pose[side+'PalmSide']=[1,0,0];
    }else{
      const base=[sign*(wide?.27:one?.135:.204),.061,.409];
      const extended=add(s,[sign*.018,-.012,.597]);
      arm(pose,side,blend(base,extended,armSwing),[sign*.67,-.15,-.82],[0,-.033,1],[1,0,0]);
    }
  }
  return pose;
}

function suspendedBridge(phase,{ mode, ring, twoStage }){
  const rise = mode==='runner' ? .96 : mode==='curl' ? 1 : rep(phase);
  const degree = mode==='crunch' ? rep(phase) : 0;
  const curl = mode==='curl' ? rep(phase) : 0;
  const hips = [0,.143+.312*rise,.06+.073*rise];
  const floorPitch = -Math.acos(Math.max(-.995, (.136-hips[1])/.488));
  const pose = stand(hips,floorPitch + (mode==='crunch'?.07*degree:0));
  pose.neck = [0,.141,pose.ls[2]-.12];
  pose.head = [0,.135,pose.neck[2]-.107];
  pose.straps=[];
  for(const [side,sign] of sides){
    const alternate=mode==='runner'&&(phase<.5)===(side==='l') ? rep(phase*2%1) : 0;
    const stride = curl||degree||alternate;
    const travel = mode==='bridge' ? .481 : mode==='plank' ? .890 : .898-(twoStage?.474:.591)*stride;
    footContact(pose,side,[sign*(ring?.255:.153),2.326,.948],1.972,[sign*.151,.371,travel],true,mode==='bridge' ? .19 : .832-.602*stride);
    arm(pose,side,[sign*.285,.063,.032],[sign*.43,.064,.89],[0,-.022,1],[1,0,0]);
  }
  return pose;
}

function assistedRollout(phase,{ ring, diagonal }) {
  const t=rep(phase);
  const pitch=.191+1.23*t;
  const pose=stand([diagonal?.135*t:0,.501-.088*t,-.238+.178*t],pitch,diagonal?.183*t:0);
  pose.straps=[];
  for(const [side,sign] of sides){
    pose[side+'k']=[sign*.133,.090,-.202];
    pose[side+'a']=[sign*.135,.091,-.626];
    pose[side+'t']=[sign*.138,.020,-.748];
    const target=add(pose[side+'s'],[sign*.023 + (diagonal?.181*t:0),mix(-.469,-.268,t),mix(.256,.561,t)]);
    contact(pose,side,[sign*(ring?.263:.151),2.32,.491],1.731,target,[sign*.45,-.57,-.64],ring?'wide':'neutral');
  }
  return pose;
}

const pullCamera={yaw:20,elevation:14,focus:[0,1.14,.327],height:2.64};
const pressCamera={yaw:25,elevation:15,focus:[0,1.13,-.164],height:2.66};
const legCamera={yaw:21,elevation:13,focus:[0,1.14,.391],height:2.68};
const jobs=[];
function register(make, muscles, camera, variants) {
  for (const [id, option] of variants) jobs.push({
    id, make: (phase) => make(phase,option), muscles, camera,
    preset: option.ring ? 'adjustable-rings' : 'adjustable-straps', poster: option.startClose ? .01 : .48,
  });
}
register(stepPull,['biceps'],pullCamera,[
  ['1070',{type:'curl',under:true}],['1108',{type:'curl',under:true,long:true}],['6232',{type:'curl',under:true,height:1.12}],
  ['6234',{type:'curl',ring:true,under:true}],['6237',{type:'curl',ring:true,one:true,under:true}],
  ['1123',{type:'curl',one:true,under:true,height:1.105}],['5007',{type:'curl',neutral:true}],
]);
register(stepPull,['rearShoulder','trap'],pullCamera,[
  ['1113',{type:'face',neutral:true}],['6252',{type:'face',ring:true,neutral:true}],['4921',{type:'face',ring:true,long:true}],
  ['9503',{type:'row',rear:true}],['1133',{type:'row',rear:true,one:true}],['6259',{type:'row',rear:true,one:true,ring:true}],
  ['4923',{type:'fly',ring:true}],['1090',{type:'fly'}],['1130',{type:'fly',long:true}],
]);
register(stepPull,['lat','biceps'],pullCamera,[['1120',{type:'row'}]]);
function assistedFrontRaise(phase) {
  const t = rep(phase);
  const pitch = mix(-.366, -.207, t);
  const feet = .480;
  const pose = stand([0, .078+.816*Math.cos(pitch), feet+.816*Math.sin(pitch)], pitch);
  pose.straps = [];
  legsAt(pose, [[.149,.078,feet],[-.149,.078,feet-.043]]);
  for (const [side,sign] of sides) {
    const anchor = [sign*.162,2.310,1.48];
    const length = 1.678;
    const y = mix(.973,1.879,t);
    const backDistance = Math.sqrt(length**2 - (y-anchor[1])**2 - .045**2);
    contact(pose, side, anchor, length, [sign*.207,y,anchor[2]-backDistance], [sign*.35,-.46,-.81], 'wide', .554);
  }
  return pose;
}
register(assistedFrontRaise,['shoulder','core'],{...pullCamera,yaw:68,focus:[0,1.14,.654]},[['1075',{}]]);
register(stepPress,['pec','triceps'],pressCamera,[
  ['1073',{type:'press',startClose:true}],['1111',{type:'press',close:true}],['1124',{type:'press',single:true}],
  ['1126',{type:'press',oneLeg:true}],['5738',{type:'press',startClose:true}],
]);
register(stepPress,['pec'],pressCamera,[
  ['1074',{type:'fly'}],['5737',{type:'fly'}],['4922',{type:'fly',ring:true}],['1139',{type:'fly',split:true}],
]);
register(supportedLower,['quad','glute'],legCamera,[
  ['1143',{mode:'squat'}],['1141',{mode:'squat',overhead:true}],['5004',{mode:'squat',wide:true}],
  ['1136',{mode:'squat',single:true}],['1101',{mode:'squat',single:true,deep:true}],
  ['1129',{mode:'lunge'}],['1131',{mode:'lunge',crossed:true}],['1119',{mode:'lunge',crossed:true,deep:true}],
  ['1132',{mode:'lateral'}],['1117',{mode:'jump'}],['6222',{mode:'jump',wide:true}],
]);
register(supportedLower,['calf'],legCamera,[['1154',{mode:'calf'}]]);
register(supportedLower,['glute','hamstring'],legCamera,[['1157',{mode:'hinge'}],['1155',{mode:'deadlift',single:true}]]);
register(supportedLower,['lat'],legCamera,[['1153',{mode:'stretch'}],['7278',{mode:'stretch'}]]);


const plankCamera={yaw:59,elevation:17,focus:[0,.65,-.189],height:1.75};
const floorRollCamera={yaw:29,elevation:14,focus:[0,1.09,.14],height:2.70};
function footRegister(make, muscles, camera, variants) {
  for (const [id, option] of variants) jobs.push({id, make: (phase) => make(phase, option), muscles, camera,
    preset: option.ring ? 'adjustable-ring-feet' : 'adjustable-foot-straps',poster:.44});
}
footRegister(suspendedPlank,['core'],plankCamera,[
  ['1081',{mode:'pike'}],['7274',{mode:'pike'}],['1082',{mode:'tuck'}],['1112',{mode:'tuck'}],['1106',{mode:'twist'}],
  ['1084',{mode:'climb'}],['1110',{mode:'saw',forearm:true}],['1134',{mode:'raised'}],['1135',{mode:'raised',forearm:true}],
  ['1145',{mode:'hold',wide:true}],['7275',{mode:'hold',forearm:true}],['4820',{mode:'tuck',ring:true}],
  ['9313',{mode:'extend',ring:true}],['4977',{mode:'reach',ring:true}],['4798',{mode:'reach'}],
]);
footRegister(suspendedPlank,['core','pec','triceps'],plankCamera,[
  ['1121',{mode:'climb-push'}],['1125',{mode:'push',one:true}],['1138',{mode:'spider'}],['1146',{mode:'push',wide:true}],
]);
footRegister(suspendedBridge,['hamstring','glute'],{...floorRollCamera,yaw:-79,elevation:20,focus:[0,.61,.138],height:1.79},[
  ['1076',{mode:'runner'}],['1078',{mode:'bridge'}],['1083',{mode:'curl'}],['1102',{mode:'curl',twoStage:true}],
  ['1148',{mode:'plank'}],['4819',{mode:'curl',ring:true}],['4912',{mode:'curl',ring:true,twoStage:true}],
]);
footRegister(suspendedBridge,['core'],{...floorRollCamera,yaw:-74,elevation:20,focus:[0,.61,.138],height:1.79},[['1147',{mode:'crunch'}]]);
register(assistedRollout,['core','shoulder'],floorRollCamera,[
  ['4978',{ring:true}],['4979',{ring:true}],['4799',{}],['1122',{diagonal:true}],
]);

const [directory, ...ids]=process.argv.slice(2);
if (!directory) throw Error('Pass the output directory and optional catalogue IDs.');
const subset = ids.length ? jobs.filter(({id}) => ids.includes(id)) : jobs;
if (!subset.length || (ids.length && subset.length !== ids.length)) throw Error('Unknown or repeated ID.');
const output = resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const {id,make,preset,muscles,camera,poster} of subset){
  try {
    const keyframes=Array.from({length:65},(_,i)=>({at:i/64,...make(i/64)}));
    const recipe={version:1,equipment:preset,durationMs:4200,muscles,camera,keyframes};
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:poster});
  } catch (error) {
    failures.push([id,error.message]);
  }
}
if (items.length) await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if (failures.length) process.exitCode=1;
