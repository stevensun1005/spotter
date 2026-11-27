import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

const rows=[], floor=.079, pi=Math.PI;
const floorView={yaw:66,elevation:19,focus:[0,.67,.072],height:2.10};
const standView={yaw:57,elevation:14,focus:[0,.92,.11],height:2.39};
function group(motion,equipment,muscles,view,variants){
  for(const[id,o]of variants)rows.push({id,motion,o,equipment:o.equipment??equipment,muscles:o.muscles??muscles,view:{...view,...o.view}});
}
function place(p,side,s,a,surface=0,heel=false){
  leg(p,side,a,[s*.096,.102,1],[s*.012,heel?.029:-.072,.133],surface);
}
function elbowsIntoKnee(p,side,target){
  const sig=side==='l'?1:-1;
  arm(p,side,target,[sig*.862,-.659,.10],[sig*.10,.022,.996],[0,1,0]);
}

function supportedCurl(phase,{kind,decline=true,steep=false}){
  const half=phase<.5?1:-1;
  const rotational=kind==='twist'||kind==='russian';
  const t=rep(rotational?(phase*2)%1:phase,.427,.584);
  const rotation=rotational?half*rep((phase*2)%1,.527,.663):0;
  const roll=kind==='twist'?.48*rotation:kind==='russian'?.392*rotation:0;
  const pitch=mix(decline?steep?-2.222:-1.991:-1.118,kind==='russian'?-.350:-.44,t);
  const p=stand([0,decline?.669:.520,decline?.058:.073],pitch,kind==='russian'?.768*rotation:roll*.62,roll*.802);
  for(const[side,s]of sides){
    const a=[s*.144,decline?.544:.251,decline?.729:.520];
    leg(p,side,a,[s*.102,.91,.12],[s*.015,-.072,.132]);
    if(kind==='straight')arm(p,side,add(p[side+'s'],[s*.011,mix(.094,-.043,t),.588]),[s*.76,-.37,-.31],[0,-.021,1]);
    else if(kind==='overhead'){
      const dir=unit(subtract(p.head,p.neck));
      const dest=add(p[side+'s'],add(scale(dir,.601),[s*.067,.025,0]));
      arm(p,side,dest,[s*.62,-.57,.20],dir);
    }else if(kind==='twist')arm(p,side,add(p.head,[s*.120,-.082,.018]),[s*.93,.14,-.297]);
    else if(kind==='russian'){
      const hand=add(p.chest,[s*.079+.312*rotation,.097,.332-.124*Math.abs(rotation)]);
      arm(p,side,hand,[s*.849,-.393,.095],[s*.061,-.18,1]);
    } else arm(p,side,add(p.chest,[-s*.094,.148,.168]),[s*.81,-.451,.321],[-s*.78,.219,.141]);
  }
  return p;
}

function benchLegRaise(phase,{kind,incline=false}){
  const t=rep(phase,.39,.59);
  const flutter=kind==='flutter', high=kind==='high', tuck=kind==='tuck'||kind==='curl';
  const wave=Math.sin(phase*4*pi);
  const starts=incline?-.233:.023;
  const tilt=incline?-1.118:-1.968;
  const hipBaseY=incline?.520:.647;
  const hipBaseZ=incline?.069:.060;
  const curl=flutter?0:.164*t+(high?.071*t:0);
  const shoulders=[0,hipBaseY+.502*Math.cos(tilt),hipBaseZ+.502*Math.sin(tilt)];
  const p=stand([0,hipBaseY+curl,hipBaseZ-.129*t*(flutter?0:1)],
    Math.atan2(shoulders[2]-hipBaseZ+.129*t*(flutter?0:1),shoulders[1]-hipBaseY-curl));
  for(const[side,s]of sides){
    const angle=flutter?-.073+.274*wave*s:high?mix(.89,1.48,t):mix(starts,tuck?1.397:1.452,t);
    legAngles(p,side,s,angle,angle-(kind==='tuck'?.418+1.01*t:kind==='curl'?.167+1.25*t:kind==='soft'?.213:.035),.018);
    grip(p,side,[s*.217,incline?.765:.482,-.566],[s*.738,-.136,.683],[0,incline?.42:-.36,.919]);
  }
  return p;
}

function hipThrust(phase,{kind}){
  const t=rep(phase), bridge=kind==='bridge', single=kind!=='double'&&kind!=='raised-back';
  const elevated=kind==='raised-one';
  const hi=bridge?mix(.151,.492,t):mix(kind==='raised-back'?.163:.178,elevated?.563:.490,t);
  const sz=bridge?-.546:-.556, sy=bridge?.160:.514;
  const hz=.027-.037*t;
  const p=stand([0,hi,hz],Math.atan2(sz-hz,sy-hi));
  for(const[side,s]of sides){
    if(single&&side==='r'){
      const bent=kind==='single-bent'||kind==='raised-one';
      const a=bent?.961:kind==='bridge'?.87:kind==='single-wide'?.371:.049;
      legAngles(p,side,s,a+.079*t,a-(bent?1.63:.023),.029);
    }else{
      const deck=bridge?.459:elevated?.159:0;
      place(p,side,s,[s*.138,floor+deck,bridge?.856:.583],deck,bridge);
    }
    if(bridge)arm(p,side,[s*.279,.078,-.312],[s*.74,-.43,-.22],[0,-.027,1],[0,1,0]);
    else arm(p,side,[s*(kind==='single-wide'?.401:.335),.478,-.555],[s*.74,-.45,-.17],[s*.42,-.09,.901],[0,1,0]);
  }
  return p;
}
function shoulderTouch(phase,{kind}){
  const isLower=kind==='decline';
  const press=kind==='press';
  const up=press?rep(phase):0;
  const t=press?0:rep((phase*2)%1,.351,.608);
  const left=phase<.5?'l':'r';
  const h=isLower?.439:0;
  const handDeck=press?.590:isLower?0:.459;
  const torsoAngle=isLower?1.672:press?1.11+.272*up:1.204;
  const footZ=isLower?-1.02:-.986;
  const hips=[press?0:(left==='l'?-.105:.105)*t,isLower?.562:press?.661-.107*up:.636,-.242];
  const p=stand(hips,torsoAngle,press?0:(left==='l'?-.139:.139)*t,.087*t);
  for(const[side,s]of sides){
    const foot=[s*(press?.146:.236),h+.111,footZ];
    leg(p,side,foot,[s*.117,-.79,.218],[s*.015,-.102,.094],h);
    const wrist=[s*(press?.205:.211),handDeck+.061,press?.502:isLower?.306:.554];
    const target=press||side!==left?wrist:blend(wrist,add(p[(side==='l'?'r':'l')+'s'],[s*.011,.034,.045]),t);
    arm(p,side,target,[s*.685,-.295, -.45],[s*.043,-.042,1],[0,1,0]);
  }
  return p;
}

function nordic(phase,{deck=0,stop=.95,catchAt=.56}){
  const t=rep(phase,.43,.586);
  const angle=.051+1.455*t*stop;
  const k=[0,.089+deck,-.160];
  const pose=stand(add(k,[0,.424*Math.cos(angle),.418*Math.sin(angle)]),angle);
  for(const[side,s]of sides){
    pose[side+'k']=add(k,[s*.147,0,0]);
    pose[side+'a']=[s*.151,.080+deck,-.573];
    pose[side+'t']=[s*.164,.037+deck,-.702];
    const hit=ramp(t,catchAt,.95);
    arm(pose,side,blend(add(pose.chest,[s*.238,-.105,.125]),[s*.244,.073,.790],hit),
      [s*.728,-.365,-.48],[0,-.06,1],[0,1,0]);
  }
  return pose;
}

function chairLegRaise(phase){
  const t=rep(phase);
  const p=stand([0,.533,.134],-.357+.035*t);
  for(const[side,s]of sides){
    const angle=mix(-1.439,-.018,t);
    legAngles(p,side,s,angle,angle-.192*(1-t),.016);
    arm(p,side,[s*.202,.479,-.209],[s*.681,-.56,-.396],[0,-.03,1],[0,1,0]);
  }
  return p;
}
function lowerTransition(phase,{kind}){
  const sideways=kind==='side';
  const t=rep(phase,.452,.582);
  const roll=ramp(t,.365,.94);
  const pulse=ramp(t,.049,.55);
  const y=mix(.855, .138, pulse);
  const hip=[sideways?.305*pulse:0,y,.079-.394*roll];
  const angle=mix(.065,-1.575,roll);
  const p=stand(hip,angle);
  for(const[side,s]of sides) {
    const rear=side==='r';
    const footL=[sideways?.354:.146,.079,.441];
    const footR=[sideways?-.387-.251*pulse:-.145,.083,sideways?.121:-.429];
    const tuck=[sideways?s*.18:s*.156,.208+.419*roll,.357+.038*s];
    const current=blend(rear?footR:footL,tuck,roll);
    place(p,side,s,current,roll<.002?0:undefined);
    arm(p,side,blend(add(p[side+'s'],[s*.07,-.212,.53]),add(p[side+'s'],[s*.083,.304,.239]),roll),
      [s*.77,-.51,-.16],[0,-.06,1]);
  }
  return p;
}
function kneelingChair(phase){
  const t=rep(phase,.31,.69);
  const p=stand([0,.515-.263*t,-.325-.339*t],.097+.186*t);
  place(p,'l',1,[.144,floor,.195],0);
  p.rk=[-.139,.108,-.377];
  p.ra=[-.153,.072,-.789];p.rt=[-.167,.038,-.917];
  for(const [side,s]of sides)grip(p,side,[s*.172,.822,.073],[s*.65,-.514,.178],[1,0,0]);
  return p;
}
function elevatedHam(phase,{kind}){
  const high=kind==='high';
  const t=rep(phase,.29,.70);
  const z=high?.627:.450;
  const p=stand([-.055,.852,high?-.088:-.206],.059+.658*t);
  place(p,'r',-1,[-.139,floor,-.207],0);
  leg(p,'l',[.142,(high?.59:.21)+.081,z-.066],[.115,.748,.088],[.014,.071,.133]);
  for(const[side,s]of sides)elbowsIntoKnee(p,side,add(p.lk,[s*.088,.138,.043]));
  return p;
}
function kneeKick(phase,{step=false}){
  const t=rep(phase), flick=rep(phase,.37,.60), move=Math.sin(2*pi*phase);
  const deck=step?.210:0;
  const pulse=step?ramp(phase,.069,.281)*(1-ramp(phase,.63,.925)):0;
  const jump=step?.184*Math.sin(pi*ramp(phase,.269,.599)):0;
  const p=stand([0,.843+deck*pulse+jump,.024+(step?.170:0)],.049+.135*flick);
  place(p,'l',1,[.154,floor+deck+jump,step?.372:.105],jump>.008?undefined:deck);
  if(step){
    const thigh=mix(-1.314,.101,t);
    legAngles(p,'r',-1,thigh,thigh-.953*t,.019);
    const swing=blend([-.156,floor,-.107],p.ra,ramp(phase,.161,.401)*(1-ramp(phase,.637,.937)));
    place(p,'r',-1,swing,phase<.164||phase>.938?0:undefined);
  }else{
    const travel=Math.abs(move);
    const thigh=mix(-1.523,move>0?.089:-1.759,travel);
    const shin=move>0?thigh-1.20*travel:mix(-1.523,-4.551,travel);
    legAngles(p,'r',-1,thigh,shin,.017);
  }
  if(!step)grip(p,'l',[.485,1.195,.340],[.76,-.51,-.128],[0,1,0]);
  else arm(p,'l',add(p.ls,[.077,-.358+.615*t,.322]),[.65,-.45,-.234]);
  arm(p,'r',add(p.rs,[-.057,-.528+.282*t,.145]),[-.61,-.59,-.145]);
  return p;
}

group(supportedCurl,'ab-decline',['core'],floorView,[
  ['0281',{kind:'straight'}],['4972',{kind:'russian',view:{yaw:40}}],
  ['5515',{kind:'cross',view:{yaw:72}}],['2523',{kind:'twist',view:{yaw:47}}],
  ['1864',{kind:'cross',steep:true,equipment:'ab-steep',view:{yaw:69,focus:[0,.71,.09]}}],
  ['4906',{kind:'overhead',view:{yaw:60,focus:[0,.87,-.08],height:2.37}}],
  ['1190',{kind:'twist',decline:false,equipment:'ab-incline-anchored',view:{yaw:55}}],
]);
group(benchLegRaise,'ab-decline',['core'],floorView,[
  ['1845',{kind:'tuck'}],['6548',{kind:'curl',view:{yaw:61}}],
  ['3438',{kind:'high',view:{yaw:60,focus:[0,.83,-.04],height:2.30}}],
  ['4768',{kind:'flutter',incline:true,equipment:'ab-incline',view:{yaw:49}}],
  ['9049',{kind:'soft',incline:true,equipment:'ab-incline',view:{yaw:63,focus:[0,.82,.08],height:2.27}}],
  ['4885',{kind:'curl',incline:true,equipment:'ab-incline',view:{yaw:74}}],
]);
group(hipThrust,'gym-hip-thrust-cross-bench',['glute','hamstring'],floorView,[
  ['10549',{kind:'bridge',equipment:'gym-bench-front',view:{yaw:74}}],
  ['4902',{kind:'raised-one',equipment:'gym-hip-thrust-elevated',view:{yaw:74}}],
  ['7413',{kind:'raised-back',view:{yaw:63}}],
  ['2072',{kind:'double',view:{yaw:72}}],
  ['2071',{kind:'single',view:{yaw:74}}],
  ['4792',{kind:'single-bent',view:{yaw:65}}],
  ['5774',{kind:'single-wide',view:{yaw:54}}],
]);
group(shoulderTouch,'gym-bench-front',['core','pec','triceps'],floorView,[
  ['3823',{kind:'decline',equipment:'gym-shoulder-tap-decline',view:{yaw:46,focus:[0,.63,-.10]}}],
  ['3348',{kind:'incline',view:{yaw:43,focus:[0,.64,.14]}}],
  ['1851',{kind:'press',equipment:'gym-box-high',view:{yaw:66,focus:[0,.70,.10]}}],
]);
group(nordic,'gym-nordic-rollers',['hamstring','glute'],floorView,[
  ['0697',{stop:.89}],['1766',{deck:.103,stop:.96,equipment:'gym-nordic-low-platform',view:{yaw:73}}],
  ['0696',{stop:.876,equipment:'gym-nordic-floor-bench',view:{yaw:70}}],['3507',{stop:.915,catchAt:.62,view:{yaw:57}}],
]);
group(chairLegRaise,'gym-bench-flat',['core','quad'],floorView,[['0689',{view:{yaw:70}}]]);
group(lowerTransition,'mat',['quad','glute','core'],standView,[
  ['3718',{kind:'side',view:{yaw:48,focus:[0,.82,.07]}}],['3716',{kind:'split',view:{yaw:74}}],
]);
group(kneelingChair,'gym-kneel-chair',['quad'],floorView,[['10543',{duration:5970,view:{yaw:70,focus:[0,.70,.05]}}]]);
group(elevatedHam,'gym-box-high',['hamstring'],standView,[
  ['1912',{kind:'high',duration:6310,view:{yaw:76}}],
  ['1910',{kind:'low',duration:6150,equipment:'gym-box-low',view:{yaw:64}}],
]);
group(kneeKick,'gym-support-post',['quad','hamstring'],standView,[
  ['4653',{view:{yaw:-66}}],['1591',{step:true,equipment:'gym-box-low',view:{yaw:69}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,motion,o,equipment,muscles,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:o.duration??4770,camera:view,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,o)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:o.poster??.445});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
