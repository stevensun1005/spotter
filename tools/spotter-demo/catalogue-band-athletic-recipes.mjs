import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, mix, ramp, rep, scale, sides, stand, unit } from './bodyweight/pose.mjs';

const front={yaw:23,elevation:15,focus:[0,.91,.16],height:2.29};
const side={yaw:63,elevation:14,focus:[0,.92,.18],height:2.34};
const floor=.078, axis=[1,0,0];
const jobs=[];
function register(solve,equipment,muscles,camera,entries){
  for(const [id,option]of entries){
    jobs.push({id,sample:p=>solve(p,option),equipment:option.equipment??equipment,muscles:option.muscles??muscles,
      camera:{...camera,...option.camera},duration:option.duration??4410,poster:option.poster??.44});
  }
}
function point(pose,s,limb,t){
  const from=pose[s+(limb==='thigh'?'k':'a')];
  const to=pose[s+(limb==='thigh'?'h':limb==='ankle'?'k':'t')];
  return blend(from,to,t);
}
function loop(pose,part='thigh') {
  const l=point(pose,'l',part,part==='thigh'?.29:part==='ankle'?.129:.69);
  const r=point(pose,'r',part,part==='thigh'?.29:part==='ankle'?.129:.69);
  const size=part==='thigh'?.076:.048;
  const pathL=p=>add(l,p);
  const pathR=p=>add(r,p);
  pose.bandPath=[pathL([0,.021,size]),pathL([size,.019,.021]),pathL([size,.021,-size]),pathR([-size,.021,-size]),
    pathR([-size,.021,.021]),pathR([0,.021,size]),pathL([0,.021,size])];
}
function foot(pose,s,sign,coord,{lift=0,deck=0,ankle=0,heel=false,pole}={}){
  const adjusted=add(coord,[0,lift+ankle,0]);
  leg(pose,s,adjusted,pole??[sign*.137,-.053,1],[sign*.015,heel?.066:-.072-ankle,.137],lift<.012?deck:undefined);
}
function bandRail(pose,s='r',height=.177,anchor=[0,height,1.152]){
  pose.bandPath=[pose[s+'w'],anchor,pose[s+'w']];
}
function handRest(pose,s,sign,offset=[0,0,0]){
  arm(pose,s,add(add(pose[s+'h'],[sign*.095,.059,.064]),offset),[sign*.84,-.48,-.13],[sign*.18,-.96,.04]);
}
function heldSet(pose,position,t=0) {
  for(const[s,sign]of sides){
    const source=pose[s+'s'];
    if(position==='chest')grip(pose,s,add(source,[sign*.029,.073,.155]),[sign*.68,-.68,-.39],axis);
    else if(position==='top')grip(pose,s,add(source,[sign*.265,.547,.096]),[sign*.72,-.53,.05],axis);
    else if(position==='thigh')grip(pose,s,add(pose[s+'h'],[sign*.093,-.147,.098]),[sign*.79,-.65,.07],axis);
    else if(position==='low')arm(pose,s,add(pose[s+'h'],[sign*.110,-.177,.101]),[sign*.56,-.75,.032]);
    else if(position==='jack') {
      const sweep=mix(.22,2.83,t);
      arm(pose,s,add(source,[sign*.576*Math.sin(sweep),-.576*Math.cos(sweep),.048]),
        [sign*.72,-.41,-.37],[sign*.80*Math.sin(sweep),-.90*Math.cos(sweep),.22]);
    } else handRest(pose,s,sign);
  }
}
function underFoot(pose,s){return add(point(pose,s,'shoe',.69),[0,-.017,0]);}

function footBandLower(phase,{mode,depth=.32,stance=.18}) {
  const stepping=mode==='step';
  const rear=mode==='bulgarian'||mode==='anchor-split';
  const anch=mode==='anchor-split';
  const split=mode==='lunge'||rear||mode==='adduct';
  const adduct=mode==='adduct';
  const over=mode==='overhead';
  const cable=mode==='cable';
  const plyo=mode==='jump';
  const belt=mode==='long';
  const kneel=mode==='sissy';
  const t=rep(phase,plyo?.27:.43,plyo?.36:.58);
  const up=(plyo||belt)?ramp(phase,.29,.44)*(1-ramp(phase,.58,.69)):0;
  const squat=belt?rep(phase,.29,.41):t;
  const shift=stepping?ramp(phase,.06,.44)*(1-ramp(phase,.61,.99)):0;
  const drop=stepping?.012:depth*squat;
  const y=(kneel?.093+.421*Math.cos(.64*t):.861)+.237*up-drop+.307*shift;
  const push=belt?.588*ramp(phase,.36,.67)*(1-ramp(phase,.76,1)):0;
  const pose=stand([0,y,kneel?.160-.421*Math.sin(.64*t):split?.079-.110*squat:stepping?.040+.303*shift:push-.141*squat],
    kneel?-.64*t:over?.02+.169*squat:.052+.265*squat,0,adduct?.056*t:0);
  const rearHeight=.447;
  for(const[s,sign]of sides){
    const active=s==='r';
    const isRear=rear&&active;
    if(kneel){
      pose[s+'k']=[sign*.133,.090,.160];pose[s+'a']=[sign*.142,.088,-.257];pose[s+'t']=[sign*.153,.022,-.386];
      continue;
    }
    if(isRear){
      foot(pose,s,sign,[sign*.151,rearHeight+.033,-.592],{deck:rearHeight,ankle:.022,pole:[sign*.049,.09,1]});
    }else if(stepping){
      const start=active?.04:.30;
      const end=active?.92:.72;
      const rise=ramp(phase,start,start+.116)*(1-ramp(phase,end,end+.065));
      const move=ramp(phase,start+.085,start+.211)*(1-ramp(phase,end-.106,end+.007));
      const swing=.067*(Math.sin(Math.PI*ramp(phase,start,start+.205))+
        Math.sin(Math.PI*ramp(phase,end-.12,end+.065)));
      const z=.020+.386*move;
      foot(pose,s,sign,[sign*.144,floor+.322*rise,z],{deck:move>.98?.322:0,lift:swing});
    }else{
      const leap=.243*up;
      const z=split ? (active?-.331:.429) : .021;
      const stepZ=split&&!rear&&mode==='lunge' ? mix(.040,z,ramp(phase,.04,.25)*(1-ramp(phase,.71,.98))) : z;
      foot(pose,s,sign,[sign*stance,floor,stepZ+push],{lift:leap,ankle:split&&active?.059*squat:0});
    }
  }
  if(cable){
    const center=add(pose.chest,[0,.038,.189]);
    grip(pose,'l',add(center,[.044,0,0]),[.66,-.70,-.22],[0,1,0]);
    grip(pose,'r',add(center,[-.039,0,0]),[-.66,-.70,-.22],[0,1,0]);
    pose.cables=[{anchor:[0,.175,1.160],end:pose.rw,grip:[0,1,0]}];
    loop(pose);
  }else if(adduct){
    heldSet(pose,'open');
    const c=point(pose,'l','thigh',.15);
    pose.bandPath=[add(c,[.014,.007,.037]),[1.183,.246,.386],add(c,[.011,.012,-.038])];
  }else if(anch){
    grip(pose,'r',add(pose.rs,[-.042,-.228,.312]),[-.67,-.56,-.43],[0,1,0]);
    handRest(pose,'l',1);
    bandRail(pose);
  }else if(kneel){
    heldSet(pose,'chest');
    pose.bandPath=[pose.lw,[0,1.072,.937],pose.rw];
  }else if(belt){
    for(const[s,sign]of sides)arm(pose,s,add(pose[s+'s'],[sign*.176,-.434+.291*up,-.239+.815*up]),[sign*.68,-.62,-.25]);
    waistBand(pose,[0,.259,-1.353]);
  }else{
    heldSet(pose,over?'top':'chest');
    const l=underFoot(pose,'l'),r=underFoot(pose,'r');
    pose.bandPath=rear?[pose.lw,l,pose.rw]:stepping?[pose.lw,r,pose.rw]:[pose.lw,l,r,pose.rw];
  }
  return pose;
}

function waistBand(pose,anchor){
  const [x,y,z]=pose.hips;
  const belt=[x,y+.065,z+.014];
  pose.bandPath=[add(belt,[.143,0,-.087]),anchor,add(belt,[-.143,0,-.087]),
    add(belt,[-.172,.008,.073]),add(belt,[0,.014,.152]),add(belt,[.172,.010,.073]),add(belt,[.143,0,-.087])];
}

function lateralBand(phase,{kind,speed=1,bandPart='thigh',width=.46,depth=.18,frontMove=false,gather=true}){
  const jack=kind==='jack';
  const sideLunge=kind==='side-lunge';
  const toe=kind==='toe' || kind==='toe-side';
  const shuttle=kind==='shuttle';
  const wide=kind==='squat'||kind==='jump-squat';
  const hop=kind==='jump-squat';
  const cross=kind==='cross';
  const p=(phase*speed)%1;
  const mirror=phase<.5?1:-1;
  const t=rep(p,.39,.58);
  const landing=hop||jack?ramp(p,.29,.44)*(1-ramp(p,.58,.69)):0;
  const leading=mirror===1?'l':'r';
  const out=ramp(p,.07,.30)*(1-ramp(p,.76,.99));
  const follow=ramp(p,.29,.54)*(1-ramp(p,.70,.96));
  const shift=shuttle||cross||toe||kind==='walk'||kind==='squat'||kind==='duck';
  const legRoom=sideLunge?mirror*.345*out:shift?mirror*.24*(out+follow)*.5:0;
  const vertical=(hop?.264:jack?.075:0)*landing;
  const base=.873-(wide?depth*t:sideLunge?depth*out:jack?.049:depth)+vertical;
  const pose=stand([frontMove?0:legRoom,base+(toe?.052:0),frontMove?legRoom:.036-(wide?.136*t:sideLunge?.161*out:0)],
    sideLunge?.085+.27*t:wide?.076+.247*t:.104);
  for(const [s,sign] of sides){
    const lead=s===leading;
    const strike=lead?out:follow*(gather?.91:.45);
    const lift=shift?.109*Math.sin(Math.PI*strike):0;
    const extended=sideLunge&&lead?.585*out:jack?.293*t:0;
    const swing=shift?mirror*width*strike:0;
    const x=sign*(sideLunge?.127:.159)+sign*extended+(!frontMove?swing:0);
    const z=.046+(frontMove?swing:0);
    foot(pose,s,sign,[x,floor,z],{lift:lift+vertical,ankle:toe?.064:0,pole:[sign*.138,.028,1]});
  }
  if(shuttle||cross){
    heldSet(pose,'thigh');
    const l=underFoot(pose,'l'),r=underFoot(pose,'r');
    pose.bandPath=cross?[pose.lw,r,l,pose.rw]:[pose.lw,l,r,pose.rw];
  }else{
    heldSet(pose,jack?'jack':wide||hop?'low':'open',t);
    loop(pose,bandPart);
  }
  return pose;
}

function jumpingRow(phase,{kind,deep=.355,tall=false}){
  const high=kind==='high';
  const lunge=kind==='jump-lunge';
  const p=phase*2%1;
  const outgoing=phase<.5?ramp(p,.05,.54):1-ramp(p,.05,.54);
  const boom=rep(p,.31,.60);
  const active=high?rep(phase,.23,.42):boom;
  const highKnee=high?ramp(phase,.42,.66)*(1-ramp(phase,.81,.999)):0;
  const descent=high?active:lunge?(1-boom*.98)*deep: (1-boom)*.122;
  const lift=high?0:.174*boom;
  const pose=stand([0,.866-(high?.342*descent:descent)+lift,high?-.105*active-.019:.030],
    .053+(high?.183*active: .125*descent),tall?-.067*highKnee:0);
  for(const[s,sign]of sides){
    const move=high&&s==='r';
    const stagger=high?(move?-.565*active+.178*highKnee:.142):sign*.377*mix(1,-1,outgoing);
    foot(pose,s,sign,[sign*.163,floor,.032+stagger],{lift:lift+(move?.438*highKnee:0),ankle:high&&move?.085*active:0});
  }
  const movement=high?highKnee:1-boom;
  const shoulder=pose.rs;
  grip(pose,'r',add(shoulder,[-.039,mix(-.175,-.249,movement),mix(.553,.152,movement)]),[-.63,-.30,-.81],[0,1,0]);
  handRest(pose,'l',1,[0,.017*movement,.058*boom]);
  bandRail(pose,'r',.164,[0,.164,1.172]);
  return pose;
}

function bandUpper(phase,{kind,low,quick,chair}){
  const t=rep(phase,quick?.21:.40,quick?.28:.58);
  const sideSign=phase<.5?-1:1;
  const local=rep(phase*2%1);
  const warming=kind==='lower'||kind==='warm-side';
  const hinge=kind==='rear-fly'||kind==='kickback';
  const squat=kind==='squat-open';
  const wrist=kind==='wrist';
  const preacher=kind==='preacher';
  const achilles=kind==='back-calf'||kind==='front-calf';
  const anchored=kind==='rear-fixed'||kind==='hit'||kind==='curl-high'||kind==='row'||preacher;
  const pose=stand([0,chair?.557:preacher?.485:squat?.547:hinge?.784:.871,hinge?-.11:preacher?-.085:squat?-.123:.010],
    hinge?.952:preacher?.644:achilles?.069*t:squat?.229:.022+((kind==='row')?.068:0),
    kind==='row'?sideSign*.46*local:kind==='hit'?-.21*t:0);
  for(const[s,sign]of sides){
    foot(pose,s,sign,[sign*.164,floor,chair?.408:achilles?sign*(low?.273:-.258)+.045:sign*.046+.040],
      {heel:achilles&&s==='r',ankle:achilles&&s==='r'?-.024:0});
    const root=pose[s+'s'];
    const inUse=!((kind==='curl-high'||kind==='hit'||preacher)&&s==='l');
    if(!inUse&&kind!=='hit'){
      handRest(pose,s,sign);
      continue;
    }
    let steer=[sign*.56,-.64,-.35];
    let handle;
    if(kind==='rear-fly'||kind==='rear-fixed'){
      const a=add(root,[sign*.043,-.545,.145]);
      const b=add(root,[sign*.570,-.024,hinge?-.104:-.152]);
      handle=blend(a,b,t);
      steer=[sign*.91,-.21,-.51];
      if(kind==='rear-fixed')handle=blend(add(root,[-sign*.034,.020,.555]),b,t);
    }else if(kind==='kickback'){
      const elbow=add(root,[sign*.043,-.072,-.232]);
      pose[s+'e']=elbow;
      const dir=unit([sign*.05,mix(-.98,.06,t),mix(.14,-.99,t)]);
      pose[s+'w']=add(elbow,scale(dir,.370));
      pose[s+'Grip']=axis;
      continue;
    }else if(kind==='shoulder-back'){
      handle=add(root,[sign*.047,-.559,mix(.023,-.203,t)]);
    }else if(kind==='warm-front'){
      handle=add(root,[sign*mix(.088,.216,t),.025,mix(.575,.185,t)]);
      steer=[sign*.85,-.47,-.52];
    }else if(kind==='warm-up'){
      handle=add(root,[sign*.051,mix(.084,.565,t),mix(.271,.127,t)]);
    }else if(warming){
      handle=add(root,[sign*mix(-.125,.126,t),mix(-.485,-.586,t),mix(.172,.066,t)]);
    }else if(squat){
      handle=add(root,[sign*mix(-.041,.564,t),-.014,mix(.567,.073,t)]);
    }else if(achilles){
      handle=add(root,[sign*.058,mix(-.523,-.402,t),.245]);
    }else if(kind==='row'){
      const go=sideSign===sign?local:0;
      handle=add(root,[sign*mix(.031,.068,go),mix(-.153,-.213,go),mix(.550,.138,go)]);
    }else if(kind==='curl-high'){
      const elbow=add(root,[sign*.243,.021,.024]);
      pose[s+'e']=elbow;
      const a=mix(.098,2.236,t);
      pose[s+'w']=add(elbow,[sign*.369*Math.cos(a),.359*Math.sin(a),.041]);
      pose[s+'Grip']=[0,0,1];
      continue;
    }else if(kind==='hit'){
      const strike=add(pose.chest,[-.30*t+sign*.035,.086,mix(.199,.478,t)]);
      handle=strike;
    }else if(preacher){
      const elbow=add(pose[s+'k'],[.035,.086,-.062]);
      const a=mix(-.269,1.827,t);
      const distance = Math.hypot(...elbow.map((point,i) => point - root[i]));
      if(distance>.375)pose[s+'s']=blend(root,elbow,(distance-.359)/distance);
      pose[s+'e']=elbow;
      pose[s+'w']=add(elbow,[.013,.371*Math.sin(a),.370*Math.cos(a)]);
      pose[s+'Grip']=[-1,0,0];
      continue;
    }else if(wrist) {
      handle=add(root,[sign*.059,mix(-.555,-.492,t),mix(.098,.160,t)]);
    }else{
      handle=add(root,[sign*.118,mix(-.528,.477,t),mix(-.013,.315,t)]);
    }
    grip(pose,s,handle,steer,kind==='hit'?[0,1,0]:axis);
  }
  if(achilles){
    const c=point(pose,'r','shoe',.77);
    pose.bandPath=[pose.lw,add(c,[.037,-.012,.021]),add(c,[-.033,-.010,.021]),pose.rw];
  }else if(anchored){
    const z=kind==='rear-fixed'?1.124:kind==='row'||preacher?1.171:.172;
    const x=kind==='hit'||kind==='curl-high'?.975:0;
    const y=kind==='row'||preacher?.160:kind==='curl-high'?1.588:1.308;
    const anchor=[x,y,z];
    pose.bandPath=preacher||kind==='curl-high'?[pose.rw,anchor,pose.rw]:[pose.lw,anchor,pose.rw];
  }else if(kind==='warm-front'||squat||kind==='raise-wide'){
    pose.bandPath=[pose.lw,pose.rw];
  }else{
    pose.bandPath=[pose.lw,underFoot(pose,'l'),underFoot(pose,'r'),pose.rw];
  }
  return pose;
}

function bandSprint(phase){
  const p=phase*3;
  const stride=Math.sin(p*2*Math.PI);
  const hip=[.037*stride,.882+.031*Math.sin(p*4*Math.PI),.121+.061*stride];
  const pose=stand(hip,.488,.037*stride);
  for(const[s,sign]of sides){
    const lead=Math.max(0,sign*stride);
    const trail=Math.max(0,-sign*stride);
    foot(pose,s,sign,[sign*.145,floor,.015+.525*lead-.410*trail],{lift:.305*lead+.104*trail});
    arm(pose,s,add(pose[s+'s'],[sign*.068,-.237+.215*trail,.194-.489*lead]),[sign*.43,-.53,-.71]);
  }
  waistBand(pose,[0,.508,-1.209]);
  return pose;
}

register(footBandLower,'stretch-band',['quad','glute'],side,[
  ['0987',{mode:'anchor-split',equipment:'post-rear-bench-stretch-band',depth:.303,camera:{yaw:65}}],
  ['7207',{mode:'bulgarian',equipment:'rear-bench-stretch-band',depth:.326,camera:{yaw:69}}],
  ['4109',{mode:'adduct',equipment:'post-stretch-band',depth:.307,muscles:['l:adductor','quad'],camera:{...front,yaw:17}}],
  ['2424',{mode:'lunge',depth:.333,camera:{yaw:65}}],
  ['1008',{mode:'step',equipment:'box-stretch-band',camera:{yaw:58,focus:[0,1.075,.24],height:2.57}}],
  ['3878',{mode:'jump',depth:.338,duration:3450,camera:{yaw:47,focus:[0,1.09,.15],height:2.66}}],
  ['3862',{mode:'long',equipment:'post-stretch-band',depth:.331,camera:{yaw:62,focus:[0,1.01,-.22],height:2.62}}],
  ['4186',{mode:'overhead',stance:.224,depth:.354,camera:{yaw:45,focus:[0,1.10,.18],height:2.61}}],
  ['3857',{mode:'cable',equipment:'cable-loop-stretch-band',stance:.192,depth:.343,camera:{yaw:61,focus:[0,1.04,.29],height:2.65}}],
  ['9988',{mode:'sissy',equipment:'mat-post-stretch-band',stance:.161,depth:0,camera:{yaw:66,focus:[0,.82,.19],height:2.16}}],
]);
register(lateralBand,'stretch-band',['quad','glute'],front,[
  ['2417',{kind:'duck',depth:.343,width:.530,speed:2}],
  ['2465',{kind:'jack',depth:.049,width:.42,bandPart:'ankle',duration:3380,camera:{focus:[0,1.06,.16],height:2.54}}],
  ['7206',{kind:'squat',depth:.355,width:.426,speed:2}],
  ['7202',{kind:'side-lunge',depth:.32,speed:2,muscles:['quad','adductor'],camera:{yaw:13}}],
  ['2165',{kind:'walk',depth:.184,bandPart:'ankle',width:.356,speed:2}],
  ['6744',{kind:'walk',depth:.254,width:.359,speed:2,camera:{yaw:27}}],
  ['8874',{kind:'walk',depth:.145,width:.257,speed:4,duration:3220,camera:{yaw:11}}],
  ['7205',{kind:'jump-squat',depth:.350,duration:3400,camera:{yaw:35,focus:[0,1.08,.16],height:2.65}}],
  ['7203',{kind:'duck',depth:.297,width:.398,speed:2,camera:{yaw:27}}],
  ['4241',{kind:'shuttle',depth:.186,width:.334,speed:2,camera:{yaw:23}}],
  ['2926',{kind:'cross',depth:.18,width:.357,speed:2,camera:{yaw:22}}],
  ['10761',{kind:'toe-side',bandPart:'ankle',depth:.071,width:.293,speed:2,muscles:['calf'],camera:{yaw:20}}],
  ['10760',{kind:'toe',bandPart:'shoe',depth:.051,width:.322,speed:2,frontMove:true,muscles:['calf'],camera:{yaw:59}}],
  ['7282',{kind:'walk',bandPart:'thigh',depth:.159,width:.319,speed:2,camera:{yaw:17}}],
]);
register(jumpingRow,'post-stretch-band',['quad','glute','r:lat'],side,[
  ['3772',{kind:'high',camera:{yaw:62}}],['3788',{kind:'high',tall:true,duration:4940,camera:{yaw:60}}],
  ['3782',{kind:'jump-lunge',deep:.331,camera:{yaw:63,focus:[0,.99,.33],height:2.55}}],
  ['3794',{kind:'jump-lunge',deep:.349,duration:4240,camera:{yaw:59,focus:[0,.99,.32],height:2.55}}],
  ['3781',{kind:'split',camera:{yaw:69,focus:[0,1.01,.28],height:2.56}}],
  ['3793',{kind:'split',duration:4070,camera:{yaw:65,focus:[0,1.01,.30],height:2.54}}],
]);
register(bandUpper,'stretch-band',['shoulder'],side,[
  ['3325',{kind:'row',equipment:'post-stretch-band',muscles:['lat','core'],camera:{yaw:49}}],
  ['4682',{kind:'rear-fly',muscles:['rearShoulder','trap'],camera:{yaw:42}}],
  ['4114',{kind:'rear-fly',muscles:['rearShoulder','trap'],camera:{yaw:51,elevation:19}}],
  ['0993',{kind:'rear-fixed',equipment:'post-stretch-band',muscles:['rearShoulder','trap'],camera:{yaw:28}}],
  ['3321',{kind:'rear-fixed',equipment:'post-stretch-band',muscles:['rearShoulder','trap'],camera:{yaw:38}}],
  ['0903',{kind:'kickback',muscles:['triceps'],camera:{yaw:71}}],
  ['0986',{kind:'curl-high',equipment:'post-stretch-band',muscles:['r:biceps'],camera:{...front,yaw:2,height:2.42}}],
  ['4085',{kind:'preacher',equipment:'post-stretch-band',muscles:['r:biceps'],camera:{yaw:64}}],
  ['1016',{kind:'wrist',muscles:['forearm'],camera:{yaw:67}}],
  ['10594',{kind:'hit',equipment:'post-stretch-band',quick:true,muscles:['core','shoulder'],camera:{...front,yaw:13}}],
  ['4024',{kind:'warm-up',camera:{yaw:52,focus:[0,1.08,.16],height:2.56}}],
  ['4026',{kind:'warm-front',camera:{yaw:39}}],
  ['4027',{kind:'shoulder-back',camera:{yaw:65},muscles:['rearShoulder']}],
  ['4028',{kind:'squat-open',camera:{...front,yaw:38},muscles:['rearShoulder','quad']}],
  ['2999',{kind:'back-calf',low:true,duration:6170,muscles:['r:calf'],camera:{yaw:72}}],
  ['3000',{kind:'front-calf',low:false,duration:6170,muscles:['r:calf'],camera:{yaw:73}}],
]);
register(bandSprint,'post-stretch-band',['quad','glute','calf'],{...side,yaw:66,focus:[0,.98,-.19],height:2.51},[
  ['3653',{duration:3310}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass the output directory and optional exact catalogue IDs.');
const chosen=ids.length?jobs.filter(({id})=>ids.includes(id)):jobs;
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
