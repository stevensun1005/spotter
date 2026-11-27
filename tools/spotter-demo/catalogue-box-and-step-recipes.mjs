import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, leg, legAngles, mix, ramp, rep, sides, stand } from './bodyweight/pose.mjs';

const ankle=.080;
const frontCam={yaw:53,elevation:16,focus:[0,1.07,.32],height:2.70};
const sideCam={yaw:30,elevation:15,focus:[.25,1.00,.06],height:2.54};
const deckList={
  'gym-box-low':[.210,0,.450],'gym-box-standard':[.390,0,.553],
  'gym-box-high':[.590,0,.632],'gym-box-side':[.265,.495,.028],
  'gym-box-rear':[.370,0,-.358],'gym-box-stairs':[.365,0,.626],
  'gym-step-patrick':[.140,.075,.360],'gym-step-peterson':[.202,.075,.352],
  'gym-step-poliquin':[.174,.075,.352],'gym-step-bench':[.424,0,.552],
  'gym-step-chair':[.457,0,.552],
};
const rows=[];
function group(movement,defaultEquipment,muscles,view,variants) {
  for(const [id,options] of variants)rows.push({id,movement,muscles:options.muscles??muscles,options,
    equipment:options.equipment??defaultEquipment,view:{...view,...options.view}});
}
function pulse(p,a,b,c,d) {return ramp(p,a,b)*(1-ramp(p,c,d));}
function Step(a,b,t,arc=.095) {
  return [mix(a[0],b[0],ramp(t,.31,.86)),mix(a[1],b[1],ramp(t,.04,.63))+Math.sin(t*Math.PI)*arc,
    mix(a[2],b[2],ramp(t,.30,.88))];
}
function sole(pose,side,s,p,surface,back=false) {
  const toe=back?[s*.012,-.087,-.100]:[s*.012,-.072,.134];
  leg(pose,side,p,[s*.15,-.079,1],toe,surface);
}
function swing(pose,swingFactor=0,kind='regular') {
  for(const [side,s]of sides){
    const shoulder=pose[side+'s'];
    const power=kind==='alternate'?s*swingFactor:swingFactor;
    const wrist=kind==='head'?add(pose.head,[s*.120,-.092,.021]):
      add(shoulder,[s*(.069+.081*Math.abs(power)), mix(-.543,.449,Math.max(0,power)), .06+.54*power]);
    arm(pose,side,wrist,[s*.77,-.61,-.21],[s*.04,-.76,.57],[s,0,0]);
  }
}
function stepUp(phase,options,[h,x,z]){
  const {kind='basic',sideways=false,jump=false}=options;
  const lead=options.side??'l', stepSide=lead==='l'?1:-1;
  const u=phase<=.5?phase*2:(1-phase)*2;
  const transfer=ramp(u,.37,.83),lift=ramp(u,0,.41);
  const trailing=ramp(u,.39,.91);
  const stance=kind==='knee'||kind==='cross'||kind==='elbow'||kind==='lateral-knee';
  const glute=kind==='glute';
  const dx=sideways?.405:0;
  const behind=sideways?.0:-.319;
  const forward=sideways?.022:z-.075;
  const bounce=jump?.244*pulse(u,.57,.722,.754,.937):0;
  const elbow=kind==='elbow';
  const pose=stand([dx*transfer,.855+h*transfer-.077*Math.sin(transfer*Math.PI)+bounce,mix(behind,forward-.048,transfer)],
    .064+(glute?.52:.26)*Math.sin(transfer*Math.PI)+(elbow?.396*transfer:0),
    elbow?-.54*stepSide*transfer:kind==='transverse'?.248*transfer:0,elbow?-.231*stepSide*transfer:0);
  for(const[side,s]of sides){
    const active=side===lead;
    const start=[s*.145,ankle,behind+.033];
    const landing=[sideways?x-.04+s*.098:x+s*.128,ankle+h,forward];
    let foot=active?Step(start,landing,lift,.111):Step(start,landing,trailing*.96, .161);
    let surface=active&&lift>.997 ? h : (active&&lift<.001 || !active&&trailing<.001) ? 0 : undefined;
    if(!active&&stance)foot=blend(start,[kind==='cross'||kind==='elbow' ? stepSide*.156:sideways?x-.20:s*.155,
      h+.586,forward+.238],trailing);
    if(!active&&kind==='single')foot=blend(start,[sideways?x-.175:s*.151,h+.282,forward-.187],trailing);
    if(!active&&!stance&&kind!=='single'&&trailing>.997){foot=landing;surface=h;}
    foot[1]+=bounce;
    sole(pose,side,s,foot,bounce>.002?undefined:surface);
  }
  swing(pose,.43*transfer,elbow?'head':'alternate');
  if(elbow)arm(pose,lead,add(pose.head,[stepSide*.091,-.111,.035]),[stepSide*.28,-.684,.912],[0,.42,.887]);
  return pose;
}

function stairUp(phase) {
  const u=phase<.5?phase*2:(1-phase)*2;
  const a=ramp(u,0,.30), b=ramp(u,.24,.61), c=ramp(u,.59,.92);
  const pose=stand([0,.849+.185*ramp(u,.16,.52)+.183*ramp(u,.65,.91),mix(-.173,.541,ramp(u,.18,.90))],.119);
  const left= u<.59 ? Step([.123,ankle,-.158],[.123,.184+ankle,.288],a):Step([.123,.184+ankle,.288],[.125,.365+ankle,.604],c);
  const right=Step([-.129,ankle,-.142],[-.127,.365+ankle,.586],b,.146);
  sole(pose,'l',1,left,c>.998?.365:a>.998&&c<.002?.184:a<.002?0:undefined);
  sole(pose,'r',-1,right,b>.998?.365:b<.002?0:undefined);
  swing(pose,.48*Math.sin(2*Math.PI*u),'alternate');
  return pose;
}

function stepDown(phase,{kind,platform=true},[h,x,z]){
  const t=rep(phase,.42,.62);
  const height=platform?h:0;
  const focusZ=platform ? z-.060 : .121;
  const pose=stand([x+.068,.863+height-(kind==='pistol'?.38:height+.084)*t,focusZ-.048-.121*t],.077+.262*t);
  const freeX=platform?x-.322:-.226;
  const freeY=height+.214-(height+.147)*t;
  for(const [side,s] of sides) {
    if(side==='l') {
      const heelRise=kind==='peterson'?.075*(1-t):kind==='poliquin'?.025:0;
      const f=[x+.107,height+ankle+heelRise,focusZ+.038*t];
      if(heelRise>.007)leg(pose,side,f,[0,.07,1],[.007,-.12,.095],height);
      else sole(pose,side,s,f,height);
    }else{
      const forward=kind==='pistol'?focusZ+.348+.315*t:focusZ+.211+.081*t;
      leg(pose,side,[freeX,freeY,forward],[s*.08,.87,-.39],[.006,.047,.122],undefined);
    }
    arm(pose,side,add(pose[side+'s'],[s*.069,.012,.545]),[s*.59,-.68,-.33],[0,-.06,1]);
  }
  return pose;
}

function jumpBox(phase,options,[height,cx,cz]) {
  const {single=false,landing='both',takeoff='both',over=false,split=false,turn=false,kneeling=false,burpee=false}=options;
  const startZ=cz-(height>.4?.866:.740);
  const toZ=cz-.041;
  const prej=burpee?.42:kneeling?.35:.208;
  const leave=prej+.042,land=prej+.231;
  const flight=ramp(phase,leave,land);
  const forward=ramp(phase,leave-.043,land+.03);
  const exit=ramp(phase,.73,.997);
  const landY=height*(1-exit);
  const sortie=over? mix(toZ,cz+.61,exit):mix(toZ,startZ,exit);
  const sink=.194*pulse(phase,prej-.151,prej-.039,prej-.02,leave+.011)+
    .222*pulse(phase,land-.032,land+.033,land+.069,land+.201);
  const arc=(height>.4?.28:.35)*Math.sin(Math.PI*flight);
  const z=flight>.995 ? sortie:mix(startZ,toZ,forward);
  const relativeHeight=flight>.995 ? landY:height*flight+arc;
  const pose=stand([0,.857+relativeHeight-sink,z],.085+sink*.643,turn?Math.PI*.50*flight*(1-exit):0);
  if(kneeling&&phase<.30){
    const n=ramp(phase,.07,.30);
    const hips=[0,mix(.463,.797,n),startZ-.063*(1-n)];
    const p=stand(hips,mix(.053,.25,n));
    for(const[side,s]of sides){
      if(n<=.11){
        p[side+'k']=[s*.142,.091,startZ];p[side+'a']=[s*.152,.070,startZ-.418];p[side+'t']=[s*.166,.04,startZ-.547];
      }else sole(p,side,s,[s*.151,ankle+.082*Math.sin(Math.PI*n),startZ-.163*(1-n)],n>.96?0:undefined);
    }
    swing(p,-.816+.88*n);return p;
  }
  if(burpee&&phase<.38) {
    const down=rep(phase/.38,.32,.58);
    const hips=[0,.848-.545*down,startZ-.53*down];
    const p=stand(hips,.033+1.53*down);
    for(const[side,s]of sides){
      sole(p,side,s,[s*.155,ankle+(down>.3?.056:0),startZ-1.332*down],0,down>.3);
      const shoulder=p[side+'s'];
      arm(p,side,blend(add(shoulder,[s*.075,-.54,.085]),[s*.231,.072,startZ+.058],down),[s*.79,-.28,-.57],[0,-.056,1],[0,1,0]);
    }
    return p;
  }
  for(const[side,s]of sides){
    const hover=side==='r'&&(single||takeoff==='one'&&flight<.43||landing==='one'&&flight>.43);
    const h=relativeHeight+(hover?.325:0);
    const yaw=turn?Math.PI*.50*flight*(1-exit):0;
    const toeX=s*.148*Math.cos(yaw),toeZ=-s*.148*Math.sin(yaw);
    const rear=split&&side==='r'?.293*(1-flight):0;
    const lift=exit>.01&&exit<.99 ? Math.sin(Math.PI*exit)*.17*(side==='l'?1:.57):0;
    const contact=hover||flight>.002&&flight<.996||exit>.002&&exit<.997?undefined:flight<.002||exit>.997?0:height;
    sole(pose,side,s,[cx+toeX,h+ankle+lift,z+toeZ-rear+.079+(hover?.093:0)],contact,rear>.080);
  }
  const swingUp=pulse(phase,prej-.07,leave+.06,land+.016,land+.16);
  swing(pose,-.750*pulse(phase,prej-.14,prej-.04,prej-.02,leave)+.92*swingUp);
  return pose;
}

function dropBox(phase,{kind},[h,x,z]){
  const step=ramp(phase,.127,.433);
  const reset=ramp(phase,.755,1);
  const fly=kind==='rebound' ?.268*Math.sin(Math.PI*ramp(phase,.487,.763)):0;
  const floorZ=z-.607;
  const landingY=h*(1-step)+fly;
  const sink=.242*pulse(phase,.361,.484,.504,.665);
  const pose=stand([0,.862+landingY+h*reset-sink,mix(z-.066,floorZ,step)+.544*reset],.027+sink*.87);
  for (const [side,s] of sides) {
    const leap=side==='l'?ramp(phase,.123,.425):ramp(phase,.223,.448);
    const foot=[s*.149,ankle+h*(1-leap)+fly+h*reset+.069*Math.sin(Math.PI*leap),mix(z-.005,floorZ+.082,leap)+.541*reset];
    sole(pose,side,s,foot,reset>.996||leap<.002?h:leap>.996&&fly<.004&&reset<.002?0:undefined);
  }
  swing(pose,-.766*sink+.805*fly/.268);
  return pose;
}

function sideBoxFlow(phase,{kind},[h,x,z]) {
  const u=(phase*2)%1;
  const d=phase<.5?1:-1;
  const hop=kind==='over'||kind==='shuffle'||kind==='step-jump';
  const t=rep(u);
  const a=ramp(u,.174,.80);
  const switchSides=kind==='shuffle'||kind==='over';
  const travel=switchSides ? d*mix(-.458,.458,a):-.174+.493*t;
  const clearance=hop?.255*Math.sin(Math.PI*a):0;
  const onBox=kind==='over'?(.26*Math.sin(Math.PI*a)):h*.64*t;
  const pose=stand([x+travel,.85+clearance+onBox,z],.053+.14*t);
  for(const[side,s]of sides){
    const stepper=side==='l';
    const deckX=x+(stepper?-.086:.086);
    const start=[(switchSides?x-d*.532:x-.455)+s*.123,ankle,z+s*.023];
    const end=[x+d*.541+s*.129,ankle,z+s*.015];
    let foot;
    if(kind==='over') foot=blend(start,end,a).map((n,i)=>i===1?n+onBox+clearance:n);
    else if(kind==='shuffle'){
      const pathA=[deckX,ankle+h,z+s*.025];
      foot=u<.5?Step(start,pathA,a,.125):Step(pathA,end,a,.155);
    }else foot=stepper?Step(start,[deckX,ankle+h,z+.04],Math.min(1,t*1.8),.141):
      blend(start,[x-.153,ankle+h+(hop?.17:.31),z+.102],t);
    const surface=kind==='over'?clearance<.002?0:undefined:
      stepper&&t>.66?h:t<.005?0:undefined;
    sole(pose,side,s,foot,surface);
  }
  swing(pose,.59*t,'alternate');
  return pose;
}

function touchBox(phase,{kind},[h,x,z]) {
  const t=rep(phase,kind==='jump'?.37:.38,kind==='jump'?.47:.62);
  const launch=kind==='jump'?.253*Math.sin(Math.PI*ramp(phase,.49,.80)):0;
  const pose=stand([0,.859-.40*t+launch,z+.406-.153*t],.071+.35*t);
  sole(pose,'l',1,[.147,ankle+launch,z+.500],launch>.005?undefined:0);
  legAngles(pose,'r',-1,mix(-.855,-.164,t),mix(-.943,-.211,t),.017);
  swing(pose,.36+.26*t);
  return pose;
}
function heelAndCalf(phase,{kind},[h,x,z]) {
  const t=rep(phase,.32,.61);
  const hold=kind!=='jump';
  const flexor=kind==='flexor';
  const c=hold?[0,flexor?.817-.19*t:.846-.059*t,z+(flexor?.513+.254*t:.455)]:
    [x-.562,.844+.124*t,z-.234];
  const pose=stand(c,hold?.048+.133*t:.81-.095*t,hold?0:.71);
  sole(pose,'l',1,hold?[.158,ankle,z+(flexor?.947:.337)]:[x-.514,ankle+.128*t,z-.229],
    hold||t<.002?0:undefined);
  if(hold)leg(pose,'r',[-.147,h+.089,z+.060],[-.127,-.56,.827],[0,-.063,-.132]);
  else leg(pose,'r',[x-.751,.434+.111*t,z-.337],[-.27,-.67,-.34],[0,-.077,-.104]);
  for(const[side,s]of sides)arm(pose,side,side==='l'&&!hold?[x-.266,h+.074,z-.147]:
    add(pose[side+'s'],[s*.087,-.549,.008]),[s*.76,-.49,-.15],[0,-.061,1],[0,1,0]);
  return pose;
}

group(stepUp,'gym-box-standard',['quad','glute'],frontCam,[
  ['5277',{kind:'glute',view:{yaw:65}}],['4579',{kind:'basic'}],
  ['10864',{equipment:'gym-box-high',view:{height:2.98}}],
  ['0479',{kind:'knee'}],['0733',{kind:'single',equipment:'gym-box-low',view:{height:2.34}}],
  ['4795',{kind:'single',equipment:'gym-step-bench'}],['3711',{kind:'single',view:{yaw:57}}],
  ['0799',{kind:'cross',view:{yaw:32}}],['9490',{kind:'basic',view:{yaw:58}}],
  ['3444',{kind:'basic',equipment:'gym-step-chair',view:{yaw:-53}}],
  ['0800',{kind:'elbow',side:'r',view:{yaw:-33}}],['1602',{kind:'transverse',sideways:true,equipment:'gym-box-side',view:sideCam}],
  ['3765',{jump:true,kind:'knee',equipment:'gym-box-low',view:{yaw:62}}],
  ['5154',{kind:'basic',sideways:true,equipment:'gym-box-side',view:sideCam}],
  ['5155',{kind:'lateral-knee',sideways:true,equipment:'gym-box-side',view:sideCam}],
]);
group(stairUp,'gym-box-stairs',['quad','glute'],frontCam,[['11450',{duration:5800}]]);
group(stepDown,'gym-step-patrick',['quad','calf'],frontCam,[
  ['9602',{kind:'patrick'}],['9604',{kind:'poliquin',equipment:'gym-step-poliquin',view:{yaw:32}}],
  ['9605',{kind:'peterson',equipment:'gym-step-peterson',view:{yaw:56}}],
  ['9601',{kind:'patrick',equipment:'none',platform:false,view:{height:2.23}}],
  ['9603',{kind:'poliquin',equipment:'none',platform:false,view:{yaw:39,height:2.26}}],
  ['4256',{kind:'stepdown',equipment:'gym-box-low',view:{yaw:28}}],
]);
group(jumpBox,'gym-box-standard',['quad','glute','calf'],frontCam,[
  ['4209',{takeoff:'one'}],['4208',{landing:'one',equipment:'gym-box-low',view:{height:2.49}}],
  ['3650',{}],['3887',{over:true,view:{yaw:68,focus:[0,1.06,.55]}}],
  ['4965',{equipment:'gym-box-high',view:{yaw:63,height:3.02}}],
  ['3892',{equipment:'gym-box-low',view:{yaw:46}}],['11781',{equipment:'gym-box-low',view:{yaw:52}}],
  ['5166',{single:true,view:{yaw:45}}],['3440',{split:true,view:{yaw:64}}],
  ['10738',{view:{yaw:61}}],['0567',{turn:true,view:{yaw:45}}],
  ['10743',{kneeling:true,duration:5330}],['8704',{burpee:true,duration:6060,view:{yaw:76,height:2.89,focus:[0,1.05,-.03]}}],
]);
group(dropBox,'gym-box-low',['quad','glute','calf'],frontCam,[
  ['9068',{kind:'land'}],['9606',{kind:'rebound'}],
  ['10160',{kind:'land',equipment:'gym-box-standard',view:{yaw:70}}],
]);
group(sideBoxFlow,'gym-box-side',['quad','glute','calf'],sideCam,[
  ['10732',{kind:'over'}],['1588',{kind:'shuffle'}],['2562',{kind:'step-jump'}],
]);
group(touchBox,'gym-box-rear',['quad','core'],frontCam,[
  ['4168',{kind:'jump',view:{yaw:70,focus:[0,.89,-.045],height:2.35}}],
  ['2984',{kind:'hold',view:{yaw:63,focus:[0,.89,-.045],height:2.25}}],
]);
group(heelAndCalf,'gym-box-rear',['quad','glute'],frontCam,[
  ['4674',{kind:'flexor',duration:6400,view:{yaw:72,focus:[0,.84,-.04],height:2.22}}],
  ['1954',{kind:'stretch',duration:6300,view:{yaw:64,focus:[0,.83,-.04],height:2.23}}],
  ['10755',{kind:'jump',equipment:'gym-box-high',muscles:['calf'],view:{yaw:-42,focus:[-.18,.91,.48]}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,movement,options,muscles,equipment,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:options.duration??4630,camera:view,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...movement(index/64,options,deckList[equipment]??[0,0,0])}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:options.poster??.445});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
