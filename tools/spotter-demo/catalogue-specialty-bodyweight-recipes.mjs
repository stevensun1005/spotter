import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, torso } from './bodyweight/pose.mjs';
import { tiltedCore } from './bodyweight/apparatus.mjs';

const rows=[], floor=.079;
const extView={yaw:66,elevation:17,focus:[0,.755,.044],height:2.18};
const matView={yaw:64,elevation:20,focus:[0,.56,.06],height:2.0};
const standView={yaw:54,elevation:14,focus:[0,.88,.031],height:2.27};
function register(motion,equipment,muscles,view,variants) {
  for(const[id,o]of variants)rows.push({id,motion,equipment:o.equipment??equipment,muscles:o.muscles??muscles,view:{...view,...o.view},o});
}
function sign(side){return side==='l'?1:-1;}
function sole(p,side,target,deck=0,tilt=0){
  const s=sign(side);
  leg(p,side,target,[s*.131,.09,1],[s*.011,-.071+.119*Math.sin(tilt),.134*Math.cos(tilt)],deck);
}
function foldArms(pose) {
  for(const[side,s]of sides)arm(pose,side,add(pose.chest,[-s*.093,.124,.098]),[s*.77,-.48,.27],[-s*.81,.36,.06]);
}
function counterweight(pose,side,x=.051) {
  const s=sign(side);
  arm(pose,side,add(pose[side+'s'],[s*x,-.093,.591]),[s*.72,-.81,-.077],[0,-.051,1],[0,1,0]);
}

function extension(phase,{kind,severe=.98,flat=false}){
  const t=rep(phase,.414,.59);
  const up=1-t;
  const rounded=kind==='rounded';
  const side=kind==='side';
  const rotate=kind==='twist';
  const hinge=kind==='hinge';
  const scapular=kind==='scapula'||hinge;
  const twist=rotate?.478*rep(phase,.13,.25)* (1-ramp(phase,.50,.89)):0;
  const hip=hinge?[0,.849,-.068-.271*t]:flat?[0,.878,.135]:[0,.847,.015];
  const pitch=hinge?.036+1.10*t:(flat?1.51:.798)+(rounded?.99:severe)*t;
  const pose=side?torso(hip,.765+1.17*t,Math.PI/2):stand(hip,pitch,twist);
  if(rounded){
    pose.neck[1]-=.055*t; pose.head[1]-=.084*t;
    pose.headAim=[0,-.79*t,1-.39*t];
  }
  for(const[sideName,s]of sides){
    const floating=kind==='single'&&sideName==='r';
    if(hinge)sole(pose,sideName,[s*.166,floor,.073]);
    else leg(pose,sideName,[s*.131,floating?.432:flat?.787:.257,floating?-.628:flat?-.694:-.579],
      [s*.104,-.62,-.35],[s*.011,-.077,.129]);
    if(scapular){
      const shoulder=pose[sideName+'s'];
      arm(pose,sideName,add(shoulder,[s*mix(.049,.542,up),mix(-.307,.012,up),mix(.363,-.105,up)]),
        [s*.79,-.29,-.36],[s*.74,-.33,.533]);
    }else{
      const normal=side?[1,0,0]:[0,-Math.sin(pitch),Math.cos(pitch)];
      const p=add(pose.chest,add(scale(normal,.141),[-s*.106,.067,.03]));
      arm(pose,sideName,p,[s*.93,-.135,-.202],[-s*.85,.44,.09]);
    }
  }
  return pose;
}
function ghdRaise(phase){
  const t=rep(phase);
  const pitch=mix(1.516,.056,t);
  const pose=stand([0,.834+.421*Math.cos(pitch),.039+.416*Math.sin(pitch)],pitch);
  for(const[side,s]of sides){
    pose[side+'k']=[s*.132,.830,.040];
    pose[side+'a']=[s*.132,.793,-.382];
    pose[side+'t']=[s*.139,.734,-.516];
  }
  foldArms(pose);
  return pose;
}
function inclineReverse(phase) {
  const t=rep(phase);
  const pose=stand([0,.451,.339],1.128,Math.PI);
  for(const[side,s]of sides){
    const a=mix(-1.015,-.389,t);
    legAngles(pose,side,s,a,mix(.113,-.405,t),.019);
    grip(pose,side,[s*.211,.719,-.455],[s*.67,-.43,.381],[0,.42,-.908]);
  }
  return pose;
}

function squatHeel(phase,{kind}){
  const t=rep(phase,kind==='slow'?.79:.42,kind==='slow'?.83:.62);
  const jump=kind==='slow'?.224*Math.sin(Math.PI*ramp(phase,.849,.958)):0;
  const heel=kind==='heels'||kind==='front';
  const posture=kind==='front'?.182:.511;
  const p=stand([0,.859+(heel?.032:0)-.414*t+jump,.017-.166*t],.069+posture*t);
  for(const[side,s]of sides){
    sole(p,side,[s*.166,floor+(heel?.036:0)+jump,.006],jump>.002?undefined:heel?.035:0,heel?-.35:0);
    if(kind==='front')arm(p,side,add(p.chest,[s*.106,.155,.243]),[s*.47,-.49,.734],[0,.83,-.54]);
    else counterweight(p,side);
  }
  return p;
}

function splitSquat(phase,{kind}) {
  const t=rep(phase,.40,.61);
  const heel=kind==='heel', post=kind==='post', chair=kind==='chair';
  const deficit=kind==='rear'||kind==='rear-shift';
  const retreat = deficit?ramp(phase,.04,.33)*(1-ramp(phase,.70,.96)):0;
  const p=stand([0,.827+(deficit?.21:0) - (deficit?.400:.369)*t,.044+(kind==='rear-shift' ? -.237*retreat:.057*t)],
    .091+(kind==='rear-shift'?.269:.251)*t);
  const leftY=floor+(heel?.035:deficit?.21:0);
  const leftZ=deficit?.497:.448;
  sole(p,'l',[.128,leftY,leftZ],heel?.034:deficit?.21:0,heel?-.34:0);
  const fy=deficit?floor+.21*(1-retreat)+.065*Math.sin(Math.PI*retreat):floor+(chair?.477:.408);
  const rz=deficit?mix(.510,-.627,retreat):-.600;
  leg(p,'r',[-.132,fy,rz],[-.12,-.65,.55],[-.011,-.083,-.129],deficit&&retreat<.002?.21:deficit&&retreat>.998?0:undefined);
  if(post){grip(p,'l',[.480,1.214,.330],[.78,-.55,.27],[0,1,0]);counterweight(p,'r');}
  else if(heel)foldArms(p);
  else for(const[side]of sides)counterweight(p,side);
  return p;
}

function sideLunge(phase) {
  const t=rep(phase),step=ramp(phase,.07,.29)*(1-ramp(phase,.72,.97));
  const x=.453,d=.265;
  const pose=stand([.419*t,.862-.247*t,.012-.125*t],.057+.502*t);
  sole(pose,'r',[-.287,floor,.133]);
  const hop=.106*Math.sin(Math.PI*step);
  const left=[.143+(x-.143)*step,floor+d*step+hop,.059];
  sole(pose,'l',left,step>.999?d:step<.001?0:undefined);
  for(const[side]of sides)counterweight(pose,side);
  return pose;
}

function supportSquat(phase,{kind,width=.162}){
  const t=rep(phase), one=['pistol','single','deep-one','box-one','wall-one'].includes(kind);
  const sissy=kind==='sissy';
  const wall=kind==='wall-one', box=kind==='box-one';
  const y=(box?.21:0)+.860-(sissy?.325:kind==='deep-one'?.469:.416)*t;
  const p=stand([wall?-.096:one?.097:0,y,wall?-.103:sissy?-.037+.052*t:.057-.165*t],
    sissy?-.07-.66*t:wall?-.019:.077+(one?.614:.43)*t);
  for(const[side,s]of sides){
    if(one&&side==='r'){
      leg(p,side,[-.186, (box?.211:0)+.252+.044*t, .153+ (kind==='pistol'?.672:.408)*t],
        [-.10,.890,.365],[-.013,.024,.132]);
    }else{
      const a=[s*width,floor+(box?.21:0)+(sissy?.084*t:0),wall?.386:box?.447:.155];
      sole(p,side,a,box?.21:0,sissy?-.52*t:0);
    }
    if(wall||box)counterweight(p,side,.075);
    else if(one&&side==='r')counterweight(p,side);
    else{
      const x=side==='l'?.481: .431;
      const wy=one?1.113:1.135;
      grip(p,side,[x,wy,.339],[s*.704,-.55,-.29],[0,1,0]);
    }
  }
  return p;
}

function balance(phase,{kind}){
  const s0=Math.sin(phase*Math.PI*2);
  const single=kind==='single'||kind==='pad';
  const two=kind==='board';
  const travel=.25+s0*(two?.174:.088);
  const deck=kind==='pad'?.079:kind==='star'||kind==='rotation'?0:.139;
  const t=rep(phase);
  const pose=stand([single?-.052+.024*s0:kind==='star'?-.133:0,.861+deck-.081*t,.014],
    .042+.077*t,kind==='rotation'?.552*s0:0, .074*s0);
  pose.machineTravel=kind==='pad'?.25:travel;
  for(const[side,s]of sides){
    const free=side==='l'&&(single||kind==='star'||kind==='rotation');
    const footX=single? -.052:two?s*.188:s*.155;
    const footY=deck+floor+(kind==='board'?Math.sin(travel-.25)*footX:0);
    if(free){
      const step=kind==='star'? rep((phase*3)%1):t;
      const star=kind==='star' ? [0.16+(.35+.28*Math.sin(phase*2*Math.PI))*step, .114+.068*step,
        .090+.52*step*Math.cos(phase*2*Math.PI)] : [.273,.283+.079*t,.233-.34*t];
      leg(pose,side,star,[s*.623,.11,.71],[s*.013,-.071,.138]);
    }else sole(pose,side,[footX,footY,.079],footY-floor);
    arm(pose,side,add(pose[side+'s'],[s*.496,-.238+.094*t,.063]),[s*.68,-.45,-.37],[s*.949,-.30,.01]);
  }
  return pose;
}

function hingeSingle(phase,{kind}) {
  const t=rep(phase,.39,.63);
  const wall=kind==='wall';
  const pose=stand([-.072,.859-.093*t,(wall?.312:-.081)-(wall?.073:.146)*t],.061+(wall?1.081:1.45)*t);
  sole(pose,'r',[-.159,floor,wall?.458:.054]);
  const angle=mix(-1.531,-3.08,t);
  legAngles(pose,'l',1,angle,angle-.061,.020);
  for(const[side,s]of sides){
    if(wall&&side==='l'){
      const point=[.153,mix(1.303,.943,t),.969];
      arm(pose,side,add(point,[0,0,-.137]),[s*.613,-.64,-.228],[0,.15,.976],[0,1,0]);
      pose.ballCenter=point;
    }else if(wall)arm(pose,side,add(pose.rh,[-.092,.050,.103]),[-.84,-.52,-.13]);
    else arm(pose,side,add(pose[side+'s'],[s*.037,mix(-.559,.045,t),mix(.058,.594,t)]),
      [s*.72,-.51,-.343],[0,-.03,1]);
  }
  return pose;
}

function toeDeficit(phase) {
  const t=rep((phase*2)%1,.32,.68);
  const active=phase<.5?'l':'r';
  const side=active==='l'?1:-1;
  const pose=stand([side*.033,.863-.123*t,-.332+.163*t],.127+.139*t);
  sole(pose,active,[side*.135,floor,.120],0,0);
  sole(pose,active==='l'?'r':'l',[-side*.136,floor,-.632],0,.15);
  for(const[limb,s]of sides)arm(pose,limb,add(pose[active+'k'],[s*.085,.149,-.013]),[s*.78,-.31,-.26]);
  return pose;
}

function chairKneeTuck(phase) {
  const t=rep(phase);
  const pose=stand([0,.828+.141*t,-.125+.073*t],-.057-.095*t);
  for(const[side,s]of sides) {
    pose[side+'e']=[s*.281,1.218,-.146];
    pose[side+'w']=[s*.281,1.248,.219];
    pose[side+'Grip']=[0,0,1];
    const a=mix(-1.54,.379,t);
    legAngles(pose,side,s,a,a-.034-1.35*t,.018);
  }
  return pose;
}

function abMat(phase,{kind}) {
  const t=rep(phase,.42,.57);
  const tucked=kind==='tuck';
  const p=stand([0,tucked?.143+.088*t:.175,-.006],mix(-1.594,-.61,t));
  for(const[side,s]of sides){
    if(tucked)leg(p,side,[s*.125,mix(.107,.334,t),mix(.855,.367,t)],[s*.061,.89,.361],[s*.013,-.061,.136]);
    else sole(p,side,[s*.151,floor,.580]);
    if(tucked)arm(p,side,[s*.239,.083+.36*t,mix(-.209,.394,t)],[s*.77,-.34,.283],[0,-.061,1],[0,1,0]);
    else arm(p,side,add(p.chest,[s*.023,.107,.261]),[s*.813,-.281,.450]);
  }
  return p;
}
function gluteTwist(phase) {
  const dir=Math.sin(phase*Math.PI*2);
  const up=rep(phase,.16,.85);
  const p=stand([dir*.117,.158+.274*up,0],-Math.acos(Math.max(-.99,(.142-(.158+.274*up))/.537)),0,dir*.27);
  for(const[side,s]of sides){
    const a=[s*.158,floor,.523];
    sole(p,side,a);
    p[side+'k'][0]+=.182*dir;
    arm(p,side,[s*.675,.067,-.371],[s*.697,.24,-.291],[s,-.138,.10],[0,1,0]);
  }
  return p;
}

register(extension,'extension-45',['glute','hamstring','core'],extView,[
  ['4937',{kind:'rounded',view:{yaw:72}}],
  ['9314',{kind:'glute',severe:.798,view:{yaw:60}}],
  ['5813',{kind:'neutral'}],['1465',{kind:'neutral',view:{yaw:86}}],
  ['1170',{kind:'single',view:{yaw:-65}}],
  ['1171',{kind:'twist',view:{yaw:45}}],
  ['8895',{kind:'scapula',muscles:['trap','rearShoulder'],view:{yaw:47}}],
  ['5699',{kind:'side',muscles:['core'],view:{yaw:80}}],
  ['1860',{kind:'neutral',flat:true,equipment:'extension-flat',view:{yaw:69}}],
  ['5471',{kind:'rounded',view:{yaw:59}}],
  ['8896',{kind:'hinge',equipment:'none',muscles:['trap','core'],view:standView}],
]);
register(ghdRaise,'gym-ghd',['glute','hamstring'],extView,[['3193',{view:{yaw:71,height:2.67,focus:[0,1.04,.11]}}]]);
register(inclineReverse,'ab-incline',['glute','hamstring'],extView,[['3180',{view:{yaw:72,height:2.36,focus:[0,.77,.28]}}]]);
register((phase)=>tiltedCore(phase,{rise:1.40}),'ab-decline',['core'],extView,[['3329',{view:{yaw:68,height:2.11}}]]);
register(squatHeel,'gym-heel-wedges',['quad','glute'],standView,[
  ['9691',{kind:'front',view:{yaw:52}}],['4561',{kind:'heels',view:{yaw:56}}],
  ['7577',{kind:'heels',view:{yaw:64}}],
  ['6336',{kind:'slow',equipment:'none',duration:4800,view:{yaw:67}}],
]);
register(splitSquat,'gym-box-rear',['quad','glute'],standView,[
  ['4442',{kind:'post',equipment:'gym-bulgarian-post',view:{yaw:-64}}],
  ['7551',{kind:'heel',equipment:'gym-bulgarian-heel',view:{yaw:62}}],
  ['3743',{kind:'chair',equipment:'gym-bulgarian-chair',view:{yaw:65}}],
  ['9315',{kind:'rear-raised'}],
  ['5312',{kind:'rear',equipment:'gym-box-low',view:{yaw:71,focus:[0,.91,.10]}}],
  ['5582',{kind:'rear-shift',equipment:'gym-box-low',view:{yaw:67,focus:[0,.89,.10]}}],
]);
register(sideLunge,'gym-box-side',['quad','adductor','glute'],{...standView,yaw:20,focus:[.206,.87,.05]},[['5310',{}]]);
register(supportSquat,'gym-support-post',['quad','glute'],standView,[
  ['7561',{kind:'deep-one',view:{yaw:-49}}],
  ['2375',{kind:'single',view:{yaw:-58}}],
  ['1762',{kind:'pistol',view:{yaw:-61}}],
  ['4723',{kind:'sissy',view:{yaw:-72}}],
  ['6600',{kind:'normal',width:.168,view:{yaw:-57}}],
  ['4797',{kind:'normal',width:.190,view:{yaw:-65}}],
  ['4892',{kind:'box-one',equipment:'gym-box-low',view:{yaw:46,focus:[0,1.00,.22]}}],
  ['4072',{kind:'wall-one',equipment:'gym-wall-squat-jump',view:{yaw:62,focus:[0,1.05,.13],height:2.61}}],
]);
register(balance,'balance-board',['calf','quad','core'],standView,[
  ['10733',{kind:'single',view:{yaw:29,height:2.27},duration:6300}],
  ['5302',{kind:'board',view:{yaw:16,height:2.34}}],
  ['10734',{kind:'pad',equipment:'gym-balance-pad',view:{yaw:42},duration:6140}],
  ['4212',{kind:'star',equipment:'none',view:{yaw:36},duration:6400}],
  ['6750',{kind:'rotation',equipment:'none',view:{yaw:22},duration:5950}],
]);
register(hingeSingle,'none',['hamstring','glute'],standView,[
  ['2920',{kind:'extended',view:{yaw:65}}],['10862',{kind:'wall',equipment:'gym-ball-wall-contact',view:{yaw:84,height:2.53}}],
]);
register(toeDeficit,'gym-box-standard',['calf','shin'],standView,[['10563',{duration:5740,view:{yaw:76,focus:[0,.95,.15]}}]]);
register(abMat,'gym-ab-mat',['core'],matView,[['6555',{kind:'sit',duration:5550}]]);
register(chairKneeTuck,'captains-chair',['core'],standView,[['6033',{view:{yaw:62,focus:[0,.94,.002]}}]]);
register(gluteTwist,'mat',['core','glute','hamstring'],matView,[['5051',{duration:5510,view:{yaw:39}}]]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,motion,o,equipment,muscles,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:o.duration??4740,camera:view,
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
