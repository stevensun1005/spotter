import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const signs=[['l',1],['r',-1]];
const plus=(a,b)=>a.map((v,i)=>v+b[i]);
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,factor)=>a.map(v=>v*factor);
const size=(a)=>Math.hypot(...a);
const normal=(a)=>scale(a,1/size(a));
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const lerp=(a,b,fraction)=>a.map((x,i)=>mix(x,b[i],fraction));
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
const mix=(a,b,fraction)=>a+(b-a)*fraction;
const ramp=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const hold=(phase)=>ramp(phase/.27)*ramp((1-phase)/.22);

function limb(root,target,pole,upper=.253,lower=.370) {
  const displacement=minus(target,root);
  const direction=normal(displacement);
  const reach=clamp(size(displacement),Math.abs(upper-lower)+.002,upper+lower-.002);
  const offset=normal(minus(pole,scale(direction,dot(direction,pole))));
  const length=(upper**2+reach**2-lower**2)/(2*reach);
  return [plus(plus(root,scale(direction,length)),scale(offset,Math.sqrt(upper**2-length**2))),
    plus(root,scale(direction,reach))];
}

function athlete(hips,pitch=0,yaw=0) {
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];
  const forward=[Math.sin(yaw),0,Math.cos(yaw)];
  const trunk=plus(scale(forward,Math.sin(pitch)),[0,Math.cos(pitch),0]);
  const at=(height,offset=0)=>plus(plus(hips,scale(trunk,height)),scale(right,offset));
  return {hips,chest:at(.371),neck:at(.603),head:at(.724),
    ls:at(.506,.191),rs:at(.506,-.191),lh:at(0,.105),rh:at(0,-.105),planted:{}};
}

function standingFeet(pose,position=[0,0,0],width=.153,openKnees=false) {
  for(const [side,sign] of signs){
    const foot=plus(position,[sign*width,.075,.089]);
    const kneeGuide=openKnees?[sign*.92,.067,.394]:[sign*.16,.066,1];
    [pose[side+'k'],pose[side+'a']]=limb(pose[side+'h'],foot,kneeGuide,.422,.424);
    pose[side+'t']=plus(pose[side+'a'],[sign*.019,-.069,.142]);
    pose.planted[side]=0;
  }
}

function flatLeg(pose,side,sign,direction=1) {
  const hip=pose[side+'h'];
  pose[side+'k']=plus(hip,[sign*.016,-.008,direction*.421]);
  pose[side+'a']=plus(pose[side+'k'],[sign*.008,-.050,direction*.416]);
  pose[side+'t']=plus(pose[side+'a'],[sign*.022,.013,direction*.140]);
}

function wrist(pose,side,target,guide) {
  [pose[side+'e'],pose[side+'w']]=limb(pose[side+'s'],target,guide);
}

function supportedWrist(pose,side,target,guide) {
  wrist(pose,side,target,guide);
  const gap=size(minus(pose[side+'w'],target));
  if(gap>.022) throw new Error(side+' hand loses contact by '+gap.toFixed(3)+' m from target '+target.map(x=>x.toFixed(3)).join(', ')+'.');
}

function pairedUpper(phase,{posture,position,flexed=false}) {
  const t=hold(phase);
  const seated=posture==='seated';
  const floor=posture==='prone'||posture==='supine';
  const prone=posture==='prone';
  const baseZ=seated?1.096:floor?0:.031;
  const pitch=floor?(prone?Math.PI/2:-Math.PI/2):flexed?.09+.163*t:.028;
  const pose=athlete([0,seated?.563:floor?.147:.868,baseZ],pitch);
  const assistance={};
  if(floor){
    if(prone)pose.headAim=[0,-.09,1];
    for(const [side,sign] of signs)flatLeg(pose,side,sign,prone?-1:1);
  }else{
    standingFeet(pose,[0,0,baseZ+(seated?.41:0)],seated?.166:.151);
  }
  for(const [side,sign] of signs) {
    const s=pose[side+'s'];
    if(position==='elbows'){
      const elbow=plus(s,[sign*.215,.083,-.067-.117*t]);
      const hand=plus(pose.head,[sign*.041,-.029,-.085]);
      pose[side+'e']=elbow;
      pose[side+'w']=hand;
      assistance[side]=elbow;
    }else{
      const hand = floor ? plus(s,[sign*.481,prone?.045+.166*t:.238-.177*t,prone?-.197-.079*t:-.038])
        : position==='wide' ? plus(s,[sign*.550,-.061,-.113-.173*t])
        : plus(s,[sign*.044,-.461+.143*t,-.263-.217*t]);
      wrist(pose,side,hand,[sign*.41,position==='wide'?.13:-.51,prone?-.92:.71]);
      assistance[side]=pose[side+'w'];
    }
  }
  const supportZ=floor?(prone?-.182:-1.035):baseZ-(seated?.824:position==='wide'?.434:.635);
  const height=floor?.394:seated&&position==='behind'?.681:.853;
  const helper=athlete([0,height,supportZ],floor?1.335:seated?.638:.193);
  if(floor){
    for(const [side,sign] of signs){
      helper[side+'k']=[sign*.32,.085,supportZ+.042];
      helper[side+'a']=[sign*.321,.076,supportZ-.374];
      helper[side+'t']=[sign*.333,.036,supportZ-.505];
    }
  }else{
    standingFeet(helper,[0,0,supportZ-(seated?.075:0)],seated?.264:.181,seated&&position==='behind');
  }
  for(const [side,sign] of signs) {
    const target=plus(assistance[side],[sign*.022,floor?.034:.019,-.013]);
    supportedWrist(helper,side,target,[sign*.74,-.49,-.55]);
  }
  return {...pose,partner:helper};
}

function helpedLeg(phase,{style}) {
  const t=hold(phase);
  const pose=athlete([0,.146,.013],-Math.PI/2);
  flatLeg(pose,'r',-1);
  for(const [side,sign] of signs)wrist(pose,side,[sign*.354,.118,-.057],[sign*.70,.72,.01]);
  const lifted=style==='straight'||style==='extend';
  const angle=style==='wide'?.15+.227*t:style==='bend'?.62+1.02*t:.59+.615*t;
  const swing=style==='wide'?.05+.682*t:0;
  const thigh=[Math.sin(swing)*Math.cos(angle),Math.sin(angle),Math.cos(swing)*Math.cos(angle)];
  pose.lk=plus(pose.lh,scale(thigh,.422));
  const shinAngle=style==='bend'?.235-.993*t:style==='extend'?mix(-.43,angle,t):angle;
  pose.la=plus(pose.lk,scale([Math.sin(swing)*Math.cos(shinAngle),Math.sin(shinAngle),Math.cos(swing)*Math.cos(shinAngle)],.424));
  pose.lt=plus(pose.la,[.021,.130,.067]);
  const support=style==='bend'?pose.lk:pose.la;
  const supportDepth=style==='wide'?.773:style==='bend'?.208:.567;
  const helperHip=[style==='wide'?.866:.670,.477,supportDepth];
  const lean=style==='bend'?1.04:mix(.926,.588,t);
  const helper=athlete(helperHip,lean,-Math.PI/2);
  for(const [side,sign] of signs){
    const knee=[helperHip[0]-.068,.084,helperHip[2]+sign*.184];
    helper[side+'k']=knee;
    helper[side+'a']=plus(knee,[.417,-.012,sign*.028]);
    helper[side+'t']=plus(helper[side+'a'],[.135,-.040,sign*.019]);
    const holdPoint=side==='l' ? support : style==='bend' ? plus(pose.lk,[.006,-.047,.061])
      : plus(pose.la,scale(normal(minus(pose.lk,pose.la)),lifted?.117:.146));
    supportedWrist(helper,side,plus(holdPoint,[.033,.016,sign*.018]),[.74,-.63,sign*.26]);
  }
  return {...pose,partner:helper};
}

function kneelingHelper(hips,lean,yaw) {
  const helper=athlete(hips,lean,yaw);
  const forward=[Math.sin(yaw),0,Math.cos(yaw)];
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];
  for(const [side,sign] of signs){
    const knee=plus([hips[0],.083,hips[2]],scale(right,sign*.181));
    helper[side+'k']=knee;
    helper[side+'a']=plus(plus(knee,scale(forward,-.414)),[0,-.014,0]);
    helper[side+'t']=plus(plus(helper[side+'a'],scale(forward,-.137)),[0,-.034,0]);
  }
  return helper;
}

function figureFour(phase) {
  const t=hold(phase);
  const pose=athlete([0,.148,.023],-Math.PI/2);
  const thigh=mix(.86,1.46,t);
  pose.rk=plus(pose.rh,[-.017,.422*Math.sin(thigh),.422*Math.cos(thigh)]);
  pose.ra=plus(pose.rk,[-.031,-.188,.378]);
  pose.rt=plus(pose.ra,[-.012,.114,.094]);
  const crossed=plus(pose.rk,[.068,.052,.009]);
  [pose.lk,pose.la]=limb(pose.lh,crossed,[.97,.040,.144],.422,.424);
  pose.lt=plus(pose.la,[-.132,.039,.065]);
  for(const [side,sign] of signs)wrist(pose,side,[sign*.359,.130,-.083],[sign*.79,.58,.07]);
  const helper=kneelingHelper([-.206,.451,.873],1.05,Math.PI);
  supportedWrist(helper,'l',plus(pose.rk,[-.051,.033,.051]),[-.69,-.48,0]);
  supportedWrist(helper,'r',plus(pose.rk,[.028,-.052,.109]),[.69,-.45,0]);
  return {...pose,partner:helper};
}

function crossBodyHip(phase) {
  const t=hold(phase);
  const pose=athlete([0,.146,.015],-Math.PI/2);
  flatLeg(pose,'r',-1);
  const angle=mix(.843,.638,t);
  const yaw=mix(-.113,-1.10,t);
  pose.lk=plus(pose.lh,scale([Math.sin(yaw)*Math.cos(angle),Math.sin(angle),Math.cos(yaw)*Math.cos(angle)],.421));
  pose.la=plus(pose.lk,[-.079,-.346,.229]);
  pose.lt=plus(pose.la,[-.100,.046,.094]);
  for(const [side,sign] of signs)wrist(pose,side,[sign*.508,.145,-.41],[sign*.81,.50,.12]);
  const helper=kneelingHelper([-.637,.466,.368],1.19,Math.PI/2);
  supportedWrist(helper,'l',plus(pose.lk,[-.039,.025,.045]),[-.69,-.48,.22]);
  supportedWrist(helper,'r',plus(pose.la,[-.027,.026,.039]),[-.71,-.40,-.22]);
  return {...pose,partner:helper};
}

function proneKneeStretch(phase) {
  const t=hold(phase);
  const pose=athlete([0,.141,.125],Math.PI/2);
  pose.headAim=[0,-.062,1];
  flatLeg(pose,'r',-1,-1);
  pose.lk=plus(pose.lh,[.020,-.022,-.419]);
  const bend=mix(-.052,1.36,t);
  pose.la=plus(pose.lk,[.015,.423*Math.sin(bend),-.423*Math.cos(bend)]);
  pose.lt=plus(pose.la,[.021,.066,-.116]);
  for(const [side,sign] of signs)wrist(pose,side,[sign*.391,.137,.652],[sign*.72,.51,-.11]);
  const helper=kneelingHelper([.780,.399,-.577],1.235,-Math.PI/2);
  supportedWrist(helper,'l',plus(pose.la,[.028,.036,.032]),[.63,-.61,.31]);
  supportedWrist(helper,'r',plus(pose.la,[-.025,.041,.068]),[.65,-.64,-.31]);
  return {...pose,partner:helper};
}

function hangingAssist(phase,{release=false}) {
  const lift=release?ramp(phase/.36)*ramp((1-phase)/.47):ramp(phase/.40)*ramp((1-phase)/.39);
  const pose=athlete([0,1.059-.012*lift,.025],-.012+.013*lift);
  const helper=athlete([.702,.790,.475],.766,-Math.PI/2);
  standingFeet(helper,[.702,0,.472],.17);
  for(const [side,sign] of signs){
    const angle=mix(.062,1.75,lift);
    pose[side+'k']=plus(pose[side+'h'],[sign*.022,-.419*Math.cos(angle),.419*Math.sin(angle)]);
    pose[side+'a']=plus(pose[side+'k'],[sign*.012,-.417,-.059-.021*lift]);
    pose[side+'t']=plus(pose[side+'a'],[sign*.014,-.069,.136]);
    wrist(pose,side,[sign*.315,2.144,.097],[sign*.72,-.43,.51]);
    pose[side+'Grip']=[1,0,0];
    const engaged=ramp((lift-.23)/.57)*(release?ramp((phase-.30)/.14):1);
    const aid=plus(pose[side+'k'],[.029,.012,.056]);
    const free=plus(helper[side+'s'],[-.275,-.255,-.118]);
    supportedWrist(helper,side,lerp(free,aid,engaged),[.54,-.68,sign*.39]);
  }
  return {...pose,partner:helper};
}

function partnerLegRaise(phase,{lateral=false}) {
  const lift=ramp(phase/.32)*ramp((1-phase)/.42);
  const guided=lateral?ramp((phase-.4)/.12)*ramp((.91-phase)/.27):0;
  const pose=athlete([0,.145,.047],-Math.PI/2);
  const helper=athlete([0,.877,lateral?-.839:-.877],.174+(lateral?1.013:.91)*lift);
  standingFeet(helper,[0,0,-.876],.213);
  for(const [side,sign] of signs){
    const angle=.041+1.49*lift;
    const direction=[-.33*guided,Math.sin(angle)*Math.sqrt(1-(.33*guided)**2),Math.cos(angle)*Math.sqrt(1-(.33*guided)**2)];
    pose[side+'k']=plus(pose[side+'h'],scale(direction,.421));
    pose[side+'a']=plus(pose[side+'k'],scale(direction,.421));
    pose[side+'t']=plus(pose[side+'a'],[sign*.014,.128,.073]);
    const lowSupport=plus(helper[side+'a'],[sign*.036,.057,.069]);
    supportedWrist(pose,side,lowSupport,[sign*.62,.83,.04]);
    const close=plus(helper[side+'s'],[sign*.069,-.438,.193]);
    const ankle=plus(pose[side+'a'],[sign*.038,.028,-.008]);
    const active=ramp((lift-.68)/.27)*(lateral?ramp((.67-phase)/.12):1);
    supportedWrist(helper,side,lerp(close,ankle,active),[sign*.48,-.67,-.34]);
  }
  return {...pose,partner:helper};
}

function pairedSideBend(phase,{near=false}) {
  const t=hold(phase);
  const pose=athlete([0,.872,0],.015);
  for(const name of ['chest','neck','head','ls','rs']){
    const shift=minus(pose[name],pose.hips);
    const lean=.355*t;
    pose[name]=plus(pose.hips,[shift[0]*Math.cos(lean)-shift[1]*Math.sin(lean),
      shift[0]*Math.sin(lean)+shift[1]*Math.cos(lean),shift[2]]);
  }
  standingFeet(pose,[0,0,0],.178);
  wrist(pose,'l',plus(pose.ls,[-.121-.234*t,.571,.080]),[.53,-.44,.71]);
  wrist(pose,'r',plus(pose.rh,[-.089,.059,.005]),[-.73,-.12,.47]);
  const helperZ=near?-.209:-.269;
  const helper=athlete([-.381,.893,helperZ],.304,.58);
  standingFeet(helper,[-.381,0,helperZ],.157);
  const forearm=lerp(pose.le,pose.lw,.77);
  supportedWrist(helper,'l',plus(forearm,[-.022,.011,-.021]),[.45,-.65,-.40]);
  supportedWrist(helper,'r',plus(pose.rh,[-.058,.025,-.056]),[-.61,-.40,-.62]);
  return {...pose,partner:helper};
}

const jobs=[
  ['1778',pairedUpper,{posture:'standing',position:'wide'},'none',['pec']],
  ['1784',pairedUpper,{posture:'standing',position:'behind'},'none',['pec','shoulder']],
  ['1779',pairedUpper,{posture:'seated',position:'elbows'},'bench',['pec']],
  ['1973',pairedUpper,{posture:'seated',position:'behind'},'bench',['pec','shoulder']],
  ['1786',pairedUpper,{posture:'seated',position:'elbows',flexed:true},'bench',['pec']],
  ['1790',pairedUpper,{posture:'prone',position:'wide'},'mat',['pec']],
  ['1789',pairedUpper,{posture:'supine',position:'wide'},'mat',['pec']],
  ['1907',helpedLeg,{style:'wide'},'mat',[]],
  ['1923',helpedLeg,{style:'straight'},'mat',['l:hamstring']],
  ['1932',helpedLeg,{style:'bend'},'mat',['l:glute']],
  ['1952',helpedLeg,{style:'extend'},'mat',['l:hamstring']],
  ['1710',figureFour,{},'mat',['l:glute']],
  ['1711',crossBodyHip,{},'mat',['l:glute']],
  ['0016',proneKneeStretch,{},'mat',['l:quad']],
  ['0010',hangingAssist,{release:true},'pull-up',['core']],
  ['0011',hangingAssist,{},'pull-up',['core']],
  ['0012',partnerLegRaise,{lateral:true},'mat',['core']],
  ['0013',partnerLegRaise,{},'mat',['core']],
  ['2122',pairedSideBend,{near:false},'none',['l:core']],
  ['2123',pairedSideBend,{near:true},'none',['l:core']],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory) throw new Error('Pass an output directory and optional exact exercise IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length) throw new Error('Unknown or repeated assisted exercise ID.');
const out=resolve(directory);
await mkdir(out,{recursive:true});
const items=[];
const failures=[];
for(const [id,animate,config,equipment,muscles] of selected){
  const ground=equipment==='mat';
  const seated=equipment==='bench';
  const hang=equipment==='pull-up';
  const lowerAssist=ground&&animate!==pairedUpper;
  const openedLegs=animate===figureFour||animate===crossBodyHip;
  const lateral=animate===pairedSideBend;
  const camera={yaw:lateral?12:openedLegs?61:lowerAssist?-49:ground?44:hang?45:69,
    elevation:openedLegs?26:lowerAssist?22:ground?17:13,
    focus:ground?[.29,.624,.046]:hang?[.286,1.12,.264]:[0,.887,seated?.827:-.26],
    height:lateral?2.37:lowerAssist?2.11:ground?1.98:hang?2.49:2.24};
  try{
    const keyframes=Array.from({length:49},(_,i)=>({at:i/48,...animate(i/48,config)}));
    const data={version:1,durationMs:5600,muscles,equipment,camera,keyframes};
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(resolve(out,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe,posterAt:.49});
  }catch(error){
    failures.push({id,reason:error.message});
  }
}
await writeFile(resolve(out,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
