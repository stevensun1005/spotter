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


function groundedSuspensionRow(phase,option){
  const {bent,elevated,wide,ring,under,weighted,transition,power,one}=option;
  const t=rep(phase,.41,.58);
  const footY=(elevated?.439:.0)+.075;
  const footZ=bent?.444:.891;
  const up=mix(bent?.405:elevated?.542:.273,elevated?.705:bent?.638:.602,t);
  const twist=power?.548*(1-t):0;
  const hips=[0,up,footZ-(bent?.512:.753)];
  const pose=stand(hips,mix(elevated?-1.555:-1.48,-1.095,t),twist);
  pose.straps=[];
  const wideHands=transition?mix(.348,.189,t):wide?.350:.181;
  for(const[s,sign]of sides){
    leg(pose,s,[sign*.147,footY,footZ],[sign*.176,.96,.168],[sign*.014,elevated?-.061:.087,.108],elevated?.439:0);
    if(one&&s==='l'){
      arm(pose,s,add(pose.chest,[mix(.371,.042,t),mix(-.195,.099,t),.198+.337*t]),[.77,-.16,-.42]);
      continue;
    }
    const anchor=[sign*(ring?.277:.163),2.306,bent?-.605:-.462];
    const shoulder=pose[s+'s'];
    let desired=[sign*wideHands,shoulder[1]+mix(.543,.129,t),shoulder[2]+.114+.073*t];
    if(power)desired=add(desired,[-.133*(1-t),.011,.071*(1-t)]);
    contact(pose,s,anchor,elevated?1.184:bent?1.270:1.449,desired,[sign*(wide?.84:.69),-.54,-.54],
      under?'under':ring?'neutral':'wide');
  }
  if(weighted){
    const center=add(blend(pose.hips,pose.chest,.27),[0,.177,.038]);
    pose.dumbbells=[{center,axis:[0,1,-.12]}];
  }
  return pose;
}

function hangingSuspension(phase,option){
  const {mode,ring,wide,one,archer,assist,knees,over,sideGrip}=option;
  const t=rep(phase,.37,.59);
  const up=over?ramp(phase,.26,.50)*(1-ramp(phase,.53,.77)):0;
  if(mode==='pullover'||mode==='cat'){
    const skin=mode==='cat';
    const tuck = ramp(t,.08,.48)*(1-ramp(t,.71,.96));
    const rollover=ramp(t,.63,1);
    const angle = skin ? mix(.035,5.52,t) : mix(.021,2.967,ramp(t,0,.63)) + 3.164*rollover;
    const shoulder=[0,skin?mix(1.616,1.783,t):1.616+.488*ramp(t,0,.63)+.492*rollover,
      skin?mix(.067,-.23,t):mix(.067,.345,ramp(t,0,.59))-.259*rollover];
    const pose=stand(add(shoulder,[0,-.502*Math.cos(angle),-.502*Math.sin(angle)]),angle);
    pose.straps=[];
    for(const[s,sign]of sides) {
      const thigh=skin?mix(-1.53,4.73,t)+1.15*tuck:mix(-1.54,1.64,ramp(t,0,.64))+3.09*rollover+1.20*tuck;
      legAngles(pose,s,sign,thigh,thigh-1.27*tuck-.16,.020);
      const anchor=[sign*.272,2.763,.177];
      const end=[sign*.287,skin?2.215:mix(2.20,2.184,t),skin?mix(.191,-.03,t):mix(.191,.347,t)];
      contact(pose,s,anchor,.586,end,[sign*.68,-.45,-.58],'neutral');
    }
    return pose;
  }
  const alternate=mode==='rock';
  const wave=alternate?Math.sin(2*Math.PI*phase)*.153*t:0;
  const inverted=mode==='pullover'||mode==='cat'||mode==='elevator';
  const elevator=mode==='elevator';
  const lift=over?.481*t+.608*up:.442*t;
  const base=assist?.421:elevator?2.159:over?1.092:.949;
  const arch=archer?-.288*t:one?-.086:0;
  const y=elevator?base+.151*t:base+lift;
  const pitch=elevator?Math.PI-.088:.033+(over?.403*up:.154*t)+wave+(inverted?2.48*t:0);
  const pose=stand([arch,y,.038+(over?.237*up:inverted?.019+.303*t:.061*t)],pitch,
    archer?-.191*t:sideGrip?-.285*t:0);
  pose.straps=[];
  for(const[s,sign]of sides){
    if(!assist){
      const legAngle=elevator?Math.PI/2:inverted?mix(-1.55,mode==='cat'?2.10:1.418,t):-1.55+(knees?.607*t:.086*t);
      const shin=elevator?Math.PI/2-.029:inverted?mix(-1.56,mode==='cat'?1.301:1.365,t):legAngle-(knees?1.17:.031);
      legAngles(pose,s,sign,legAngle,shin,.020);
    }else{
      leg(pose,s,[sign*.148,.083,.491-.049*t],[sign*.175,.88,.291],[sign*.013,-.074,.133],0);
    }
    if(one&&s==='l'){
      arm(pose,s,add(pose.chest,[.061,-.099,.222]),[.657,-.669,-.21]);
      continue;
    }
    const length=assist?1.015:elevator?1.039:over?.607:wide?.394:.347;
    const anchor=[sign*(ring ? (wide?.435:elevator?.292:.277) : .146),over?2.747:2.309,assist?.384:.219];
    const external=archer&&s==='l';
    const target=elevator?[sign*.307,1.146,.154]:assist?add(pose[s+'s'],[sign*.047,mix(.554,.137,t),.202]):
      (over?add(pose[s+'s'],[sign*.071,mix(.603,-.561,up),mix(.055,-.057,up)]):
        external?[.507,2.011,.239]:add(pose[s+'s'],[sign*(wide?.197:.052),mix(.607,.064,t),.076+.032*t]));
    contact(pose,s,anchor,length,target,[sign*(external?.367:.73),external?-.94:-.53,over?.795*up-.72:-.722],
      option.under?'under':ring||option.neutral?'neutral':'wide',external?.445:.141);
  }
  if(option.band){
    const sleeve=pose.straps[0].end;
    const contact=add(pose.ra,[.016,-.046,.059]);
    pose.bandPath=[add(sleeve,[.034,.096,.014]),add(contact,[.051,0,.027]),add(contact,[-.047,-.005,.027]),
      add(sleeve,[-.047,.095,.015]),add(sleeve,[.034,.096,.014])];
  }
  return pose;
}

function dippingSuspension(phase,option){
  const {chest,assist,ring,hold,low}=option;
  const t=rep(phase,hold?.24:.41,hold?.72:.58);
  const belly=low?.438:.855;
  const depth=chest?.285:.274;
  const y=belly-(assist?.188:depth)*t+.013*Math.sin(phase*Math.PI*2)*(hold?1:0);
  const pitch=low?1.319+(hold?.030:.124*t):chest?.117+.325*t:.029+.107*t;
  const pose=stand([0,y,low?-.359:mix(.031,.132,t)],pitch);
  pose.straps=[];
  for(const[s,sign]of sides){
    if(low){
      leg(pose,s,[sign*.149,.078,-1.12],[sign*.089,-.297,1],[sign*.012,-.065,-.126],0);
    }else if(assist){
      leg(pose,s,[sign*.161,.078,.260],[sign*.102,.12,.91],[sign*.014,-.071,.139],0);
    }else{
      const knee=add(pose[s+'h'],[sign*.034,-.407,.105]);
      pose[s+'k']=knee;
      pose[s+'a']=add(knee,[sign*.016,-.158,-.379]);
      pose[s+'t']=add(pose[s+'a'],[sign*.009,-.076,-.105]);
    }
    const location=low?[sign*.210,.176,.137]:[sign*(chest?.281:.218),1.089,.087];
    const anchor=[sign*(ring?.272:.149),2.307,low?.201:-.078];
    contact(pose,s,anchor,low?2.137:1.225,location,[sign*(chest?.77:.51),-.34,-.63],low?'wide':'neutral');
  }
  return pose;
}


function standingStrapFlow(phase,option) {
  const {kind,deep=false}=option;
  const t=rep(phase,.40,.58);
  const twist=kind==='twist';
  const side=kind==='side-bend'||kind==='side-stretch'||kind==='abduction-lunge';
  const lateral=kind==='abduction-lunge'||kind==='side-stretch';
  const fly=kind==='lunge-fly';
  const split=kind==='split'||fly;
  const curl=kind==='clutch';
  const kick=kind==='kickback';
  const press=kind==='extension'||kind==='extension-push';
  const reach=kind==='rollout';
  const pullThrough=kind==='pull-through';
  const power=kind==='squat-power';
  const runner=kind==='sprint';
  const ext=kind==='external';
  const yRaise=kind==='y';
  const hinge=kick||pullThrough;
  const direction=phase<.5?1:-1;
  const local=twist||runner?rep(phase*2%1):t;
  const leaning=hinge?1.043+(pullThrough?.226*t:0):press?mix(.52,deep?.91:.73,t):reach?mix(.28,.78,t):
    curl?mix(-.548,-.265,t):twist?-.183:ext||yRaise?mix(-.386,-.181,t):runner?.36:.048+.219*t;
  const dip=power?.333*(1-t):split?.347*t:lateral?.288*t:hinge?.118:0;
  const hipsY=.866-dip-(press||reach?.156*t:0);
  const hipZ=hinge?-.145-.094*t:press||reach?-.232+.193*t:runner?.117:split?.121*t:.010;
  const hipX=lateral?.249*t:side?.029:0;
  const pose=stand([hipX,hipsY,hipZ],leaning,twist?direction*.698*local:fly?.14*t:0,
    !lateral&&side?.270*t:0);
  pose.straps=[];
  for(const[s,sign]of sides){
    const working=s==='r';
    const hips=pose[s+'h'];
    const run=runner&&(direction===1)===working;
    let ankle=[sign*(lateral?.247:.167),.078,press||reach?-.661:runner?-.176:.040];
    if(lateral&&s==='l')ankle=[.252+.479*(kind==='side-stretch'?1:t),.078+(kind==='side-stretch'?0:.073*Math.sin(Math.PI*t)),.11];
    if(split)ankle[2]=working?-.344:.161+(fly?.48:.269)*t;
    if(run){ankle[1]+=.429*local;ankle[2]+=.550*local;}
    leg(pose,s,ankle,[sign*.13,.106,1],[sign*.014,-.072,.139],
      run&&local>.035||lateral&&s==='l'&&ankle[1]>.086?undefined:0);
    if(kind==='side-bend'&&!working){
      arm(pose,s,add(hips,[.094,.083,.103]),[.71,-.61,-.31]);
      continue;
    }
    const span=pose[s+'s'];
    let delta=[sign*.039,-.131,.516];
    let anchor=[sign*.161,2.310,.819],length=1.181;
    let pole=[sign*.69,-.48,-.50],orientation='neutral';
    if(curl){
      delta=[sign*.122,mix(-.11,.182,t),mix(.548,.136,t)];
      orientation='under';pole=[sign*.75,.08,-.60];
    }else if(fly){
      delta=[sign*mix(.027,.566,t),mix(-.139,.022,t),mix(.559,.147,t)];
    }else if(press){
      delta=[sign*.119,mix(-.052,.267,t),mix(.524,.176,t)];
      length=1.299;anchor=[sign*.162,2.313,-.254];
      pole=[sign*.31,.353,.795];
    }else if(reach){
      const a=mix(.525,1.597,t);
      delta=[sign*.064,.568*Math.sin(a),.554*Math.cos(a)];
      anchor=[sign*.164,2.31,-.603];length=1.543;
      pole=[sign*.37,-.53,.49];
    }else if(yRaise){
      delta=[sign*mix(-.030,.409,t),mix(-.112,.423,t),mix(.571,.235,t)];
      anchor=[sign*.188,2.311,.406];length=1.041;
    }else if(ext){
      delta=[sign*.268,mix(-.122,.297,t),mix(.436,.134,t)];
      anchor=[sign*.161,2.310,.402];length=1.021;
      pole=[sign*.88,-.31,-.43];
    }else if(kick){
      delta=[sign*.067,mix(-.226,-.105,t),mix(.202,-.526,t)];
      anchor=[sign*.165,2.31,.251];length=1.446;
      pole=[sign*.39,.03,-.87];
    }else if(pullThrough){
      delta=[sign*.018,mix(-.574,-.298,t),mix(.002,-.346,t)];
      anchor=[sign*.164,2.309,-1.141];length=1.947;
      pole=[sign*.23,-.81,.13];
    }else if(power){
      delta=[sign*.036,mix(-.037,-.191,t),mix(.556,.149,t)];
      anchor=[sign*.165,2.312,.814];length=1.226;
    }else if(twist){
      delta=[direction*.312*local+sign*.035,.101,mix(.568,.428,local)];
      anchor=[sign*.174,2.310,.760];length=1.125;
    }else if(kind==='side-bend'){
      delta=[-.392+.201*t,mix(.387,.207,t),.172];
      anchor=[-.903,2.307,.155];length=.747;
    }else if(runner){
      delta=[sign*.079,mix(-.052,.101,run?local:0),mix(.463,.319,run?local:0)];
      anchor=[sign*.161,2.310,.715];length=1.154;
    }
    contact(pose,s,anchor,length,add(span,delta),pole,orientation,reach||yRaise?.49:.141);
  }
  return pose;
}

function floorStrapFlow(phase,option) {
  const {kind}=option;
  const t=rep(phase,.36,.59);
  const side=kind==='side';
  const sit=kind==='sit';
  const extend=kind==='hyper';
  const pendulum=kind==='pendulum';
  const twist=kind==='twist-side'||kind==='twist-up';
  const lift=kind==='twist-up';
  const inverse=kind==='headstand';
  const lateral=pendulum||twist;
  const signed=lateral?(phase<.5?1:-1)*rep(phase*2%1):0;
  const theta=inverse?mix(1.519,2.947,t):side?mix(-1.541,-1.185,t):sit?mix(-1.558,-.217,t):extend?mix(1.568,1.008,t):1.523+.17*t*(lift?1:0);
  const hipY=inverse?.342-.502*Math.cos(theta):side?.164+.272*t:sit?.153:extend?.155:.523+(lift?.105*Math.abs(signed):0);
  const hipZ=inverse?.417-.502*Math.sin(theta):side?.082:sit?.097:extend?.044:-.094+(lift?.126*Math.abs(signed):0);
  const x=lateral?(pendulum?.141:.192)*signed:0;
  const pose=stand([x,hipY,hipZ],theta,twist?.27*signed:0);
  pose.straps=[];
  if(side){
    pose.rs=[-.032,.640+.084*t,-.341];
    pose.ls=[.018,.341+.061*t,-.334];
    pose.rh=[-.009,hipY+.090,hipZ];
    pose.lh=[.009,hipY-.090,hipZ];
  }
  for(const[s,sign]of sides){
    const anchor=[sign*.155,2.329,(inverse?-1.465:side||sit?.855:-.986)];
    const toward=inverse?mix(-.955,.482,t):side?.851:sit?.485:extend?-.820:-.835+(lift?.56*Math.abs(signed):0);
    const legY=inverse?mix(.419,1.693,t):side?.371:sit?.398:extend?.310:.410;
    const moveX=lateral?signed*(pendulum?.498:.327):0;
    const desired=[sign*(side?.086:.142)+moveX,legY,toward];
    const length=inverse?1.994:side?1.977:extend?2.031:1.963;
    footContact(pose,s,anchor,length,desired,side||sit,side?.64:sit?.27:inverse?.52:lift?.82-.54*Math.abs(signed):.79);
    if(side&&s==='l'){
      pose.le=[.019,.078,-.330];pose.lw=[.287,.039,-.335];
      pose.lFingers=[1,-.018,0];pose.lPalmSide=[0,1,.035];
    }else if(side){
      arm(pose,s,add(pose.rh,[-.136,.08,.127]),[-.766,-.381,.441]);
    }else if(sit||extend){
      arm(pose,s,add(pose.head,[sign*.085,-.076,sit?-.027:.036]),[sign*.816,-.186,.59]);
    }else if(inverse){
      pose[s+'e']=[sign*.202,.075,.407];pose[s+'w']=[sign*.171,.052,.746];
      pose[s+'Fingers']=[0,-.041,1];pose[s+'PalmSide']=[1,0,0];
    }else{
      arm(pose,s,[sign*.197,.053,.429],[sign*.67,-.18,-.71],[0,-.048,1],[1,0,0]);
    }
  }
  return pose;
}

function singleStrapLeg(phase,{mode}){
  const t=rep(phase,.39,.59);
  const abduction=mode==='abduction';
  const pose=stand([.035,abduction?.866:.861-.367*t,abduction?.017:.122+.051*t],abduction?.041:.066+.219*t);
  pose.straps=[];
  leg(pose,'l',[.138,.078,abduction?.076:.407],[.131,.174,1],[.013,-.073,.141],0);
  const anchor=abduction?[-.108,2.329,.002]:[-.152,2.329,-.661];
  const destination=abduction?[-.162-.470*t,.113+.116*t,.058]:[-.156,.379-.117*t,-.443-.151*t];
  footContact(pose,'r',anchor,abduction?2.214:1.969,destination,false,abduction?.754:.29);
  if(abduction){
    grip(pose,'l',[.393,1.142,.178],[.72,-.64,-.16],[0,0,1]);
    arm(pose,'r',add(pose.rh,[-.082,.083,.115]),[-.75,-.57,-.17]);
  }else{
    for(const[s,sign]of sides)arm(pose,s,add(pose[s+'h'],[sign*.103,.101,.093]),[sign*.70,-.51,-.21]);
  }
  return pose;
}

function invertedStrapPress(phase,{ring,feetElevated}) {
  const t=rep(phase,.41,.58);
  const hip=[0,feetElevated?1.104-.188*t:1.277-.173*t,feetElevated?-.197:.169];
  const pose=stand(hip,feetElevated?2.542+.199*t:Math.PI-.162+.110*t);
  pose.straps=[];
  for(const[s,sign]of sides){
    if(feetElevated){
      leg(pose,s,[sign*.148,.381,-.886],[sign*.157,-.460,-.86],[sign*.015,-.073,-.134],.307);
    }else {
      legAngles(pose,s,sign,Math.PI/2+(.06+sign*.056)*t,Math.PI/2-.018,.016);
    }
    const anchor=[sign*(ring?.278:.160),2.306,.189];
    contact(pose,s,anchor,ring?2.117:2.105,[sign*.200,.195,.201],
      [sign*.79,-.39,-.64],ring?'neutral':'wide');
  }
  return pose;
}

const pullCamera={yaw:20,elevation:14,focus:[0,1.14,.327],height:2.64};
const pressCamera={yaw:25,elevation:15,focus:[0,1.13,-.164],height:2.66};
const legCamera={yaw:21,elevation:13,focus:[0,1.14,.391],height:2.68};
const jobs=[];
function register(make, muscles, camera, variants) {
  for (const [id, option] of variants) jobs.push({
    id, make: (phase) => make(phase,option), muscles, camera:{...camera,...option.camera},
    preset: option.preset ?? (option.ring ? 'adjustable-rings' : 'adjustable-straps'),
    poster: option.startClose ? .01 : .48,
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
  for (const [id, option] of variants) jobs.push({id, make: (phase) => make(phase, option), muscles, camera:{...camera,...option.camera},
    preset: option.preset ?? (option.ring ? 'adjustable-ring-feet' : 'adjustable-foot-straps'),poster:.44});
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


register(groundedSuspensionRow,['lat','biceps'],{...pullCamera,yaw:62,focus:[0,1.043,.133],height:2.61},[
  ['4911',{transition:true}],['4818',{ring:true,elevated:true,preset:'rings-elevated-row'}],
  ['1071',{bent:true}],['2834',{elevated:true,weighted:true,preset:'straps-elevated-weighted-row'}],
  ['4450',{wide:true}],['1080',{}],['1086',{power:true,one:true}],['5006',{under:true}],['4451',{wide:true}],
]);
register(hangingSuspension,['lat','biceps'],{...pullCamera,yaw:29,focus:[0,1.183,.131],height:2.63},[
  ['3292',{mode:'elevator',ring:true,camera:{yaw:46,focus:[0,1.68,.10],height:3.61}}],
  ['4920',{mode:'pull',ring:true,assist:true,camera:{yaw:42,focus:[0,1.12,.20]}}],
  ['0631',{mode:'pull',ring:true,over:true,camera:{yaw:33,focus:[0,1.65,.12],height:3.56}}],
  ['7512',{mode:'pull',ring:true,archer:true,wide:true,camera:{yaw:9,focus:[-.10,1.21,.12]}}],
  ['7517',{mode:'pull',ring:true,one:true,camera:{yaw:31}}],
  ['5522',{mode:'pull',ring:true}],
  ['8750',{mode:'pullover',ring:true,camera:{yaw:35,focus:[0,1.67,.18],height:3.79}}],
  ['10661',{mode:'pull',ring:true,one:true,band:true,preset:'adjustable-ring-band-stretch-band',camera:{yaw:36}}],
  ['10662',{mode:'rock',ring:true,wide:true,sideGrip:true,camera:{yaw:16}}],
  ['10663',{mode:'cat',ring:true,knees:true,camera:{yaw:68,focus:[0,1.51,.10],height:3.46}}],
  ['7228',{mode:'pull',ring:true,wide:true,camera:{yaw:12}}],
  ['1127',{mode:'pull',neutral:true}],
  ['5008',{mode:'pull',under:true,assist:true,camera:{yaw:43,focus:[0,1.08,.20]}}],
  ['1088',{mode:'pull',camera:{yaw:39}}],
  ['1094',{mode:'pull',assist:true,camera:{yaw:46,focus:[0,1.15,.23]}}],
]);
register(dippingSuspension,['pec','triceps'],{...pullCamera,yaw:59,focus:[0,1.142,.016],height:2.60},[
  ['1072',{chest:true}],['1093',{chest:true,assist:true}],['1095',{assist:true}],
  ['1103',{}],['10950',{ring:true,hold:true,low:true,camera:{yaw:61,focus:[0,1.09,-.40],height:2.63}}],
  ['1128',{low:true,camera:{yaw:59,focus:[0,1.10,-.38],height:2.66}}],
]);

register(standingStrapFlow,['core','shoulder'],{...legCamera,yaw:50,focus:[0,1.13,.290],height:2.67},[
  ['1159',{kind:'abduction-lunge',camera:{yaw:20}}],
  ['1158',{kind:'side-stretch',camera:{yaw:24}}],
  ['1109',{kind:'clutch',camera:{yaw:-18}}],
  ['4094',{kind:'lunge-fly',camera:{yaw:-16}}],
  ['1140',{kind:'sprint',camera:{yaw:-16}}],
  ['1144',{kind:'rollout',camera:{yaw:65,focus:[0,1.12,-.14]}}],
  ['1149',{kind:'extension-push',deep:true,camera:{yaw:64,focus:[0,1.12,-.23]}}],
  ['1150',{kind:'kickback',camera:{yaw:-29}}],
  ['1107',{kind:'y',camera:{yaw:23}}],
  ['1087',{kind:'pull-through',camera:{yaw:68,focus:[0,1.14,-.49]}}],
  ['1096',{kind:'external',camera:{yaw:28}}],
  ['1097',{kind:'side-bend',camera:{yaw:14,focus:[-.24,1.12,.10]}}],
  ['1099',{kind:'split',camera:{yaw:-15}}],
  ['7279',{kind:'squat-power',camera:{yaw:-17}}],
  ['5876',{kind:'extension',camera:{yaw:64,focus:[0,1.11,-.13]}}],
  ['1104',{kind:'extension',deep:true,camera:{yaw:61,focus:[0,1.12,-.21]}}],
  ['1105',{kind:'twist',camera:{yaw:24}}],
]);
register(stepPress,['pec','triceps'],{...pressCamera,yaw:58},[['1116',{type:'press',startClose:true}]]);
register(assistedRollout,['core','shoulder'],{...floorRollCamera,yaw:61},[['1091',{}]]);
footRegister(floorStrapFlow,['core'],{...plankCamera,focus:[0,1.10,-.443],height:2.66},[
  ['9704',{kind:'headstand',preset:'mat-adjustable-foot-straps',camera:{yaw:59,focus:[0,1.182,-.578],height:2.76}}],
  ['1156',{kind:'pendulum',camera:{yaw:28,focus:[0,1.05,-.286],height:2.94}}],['1151',{kind:'twist-side',camera:{yaw:28,focus:[0,1.06,-.286],height:2.95}}],
  ['1152',{kind:'twist-up',camera:{yaw:36,focus:[0,1.06,-.286],height:2.94}}],
  ['1137',{kind:'sit',preset:'mat-adjustable-foot-straps',camera:{yaw:65,focus:[0,1.13,.434],height:2.64}}],
  ['1079',{kind:'hyper',preset:'mat-adjustable-foot-straps',camera:{yaw:64}}],
  ['1098',{kind:'side',preset:'mat-adjustable-foot-straps',camera:{yaw:60,focus:[0,1.03,.470],height:2.86}}],
]);
footRegister(singleStrapLeg,['quad','glute'],{...legCamera,yaw:57,focus:[0,1.145,-.36]},[
  ['1077',{mode:'abduction',preset:'braced-adjustable-foot-straps',camera:{yaw:14,focus:[-.14,1.13,.09]}}],
  ['1100',{mode:'split'}],
]);
register(invertedStrapPress,['shoulder','triceps','core'],{...plankCamera,yaw:62,focus:[0,1.22,.07],height:2.68},[
  ['9316',{ring:true,feetElevated:true,preset:'rings-raised-pike',camera:{yaw:-38,focus:[0,1.10,-.28],height:2.78}}],
  ['1115',{ring:false,feetElevated:false,camera:{yaw:61,focus:[0,1.25,.06]}}],
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
