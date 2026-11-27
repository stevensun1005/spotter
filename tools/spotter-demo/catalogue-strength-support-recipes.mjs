import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

const rows=[], floor=.079, pi=Math.PI;
const groundView={yaw:64,elevation:19,focus:[0,.54,.011],height:1.99};
const strengthView={yaw:64,elevation:16,focus:[0,.841,.05],height:2.30};
function group(motion,equipment,muscles,view,variants) {
  for(const[id,o]of variants)rows.push({id,motion,o,equipment:o.equipment??equipment,muscles:o.muscles??muscles,view:{...view,...o.view}});
}
function place(p,side,a,surface,footPitch=0) {
  const s=side==='l'?1:-1;
  leg(p,side,a,[s*.109,-.101,1],[s*.012,-.074+.115*Math.sin(footPitch),.136*Math.cos(footPitch)],surface);
}
function restArms(p,z,y=.076){
  for(const[side,s]of sides)arm(p,side,[s*.244,y,z],[s*.74,-.39,-.17],[s*.335,-.059,.939],[0,1,0]);
}
function standArms(p,extent=.391){
  for(const[side,s]of sides)arm(p,side,add(p[side+'s'],[s*.061,-.187,extent]),[s*.73,-.65,-.153],[s*.022,-.1,1]);
}

function dragonFlag(phase,{kind,bench=false}){
  const negative=kind!=='raise';
  const t=rep(phase,negative?.69:.36,negative?.76:.59);
  const angle=negative?mix(1.408,.114,t):mix(.097,1.370,t);
  const shoulder=[0,bench?.557:.153,-.336];
  const hip=add(shoulder,[0,.521*Math.sin(angle),.510*Math.cos(angle)]);
  const pose=stand(hip,-pi/2-angle);
  const fixZ=bench?-.452:-.592;
  for(const[side,s]of sides){
    const tuck=kind==='half'||kind==='single'&&side==='r';
    const thigh=angle+(tuck?.776:0), shin=angle-(tuck?1.18:.044);
    legAngles(pose,side,s,thigh,shin,.020);
    grip(pose,side,[s*.204,bench?.470:.174,fixZ],[s*.85,.08,-.316],[1,0,0]);
  }
  return pose;
}

function hipHold(phase,{kind}){
  const t=rep(phase,.24,.72);
  const chinese=kind==='two-benches', iso=kind==='static';
  const py=chinese?.261+.282*t:iso?.145+.012*t:.427+.110*t;
  const sy=chinese?.558:iso?.138:.509;
  const pz=chinese?.039:iso?.048:.120;
  const sz=chinese?-.567:iso?-.443:-.443;
  const pitch=iso?-1.54:Math.atan2(sz-pz,sy-py);
  const pose=stand([0,py,pz],pitch);
  for(const[side,s]of sides){
    if(chinese)place(pose,side,[s*.145,.425+floor,.907],.425,.63);
    else if(iso)place(pose,side,[s*.141,floor,.696],0,.55);
    else if(side==='l')place(pose,side,[.128,floor,.594],0);
    else leg(pose,side,[-.129,.633,.429],[-.171,.791,.571],[-.008,-.031,.123]);
  }
  restArms(pose,chinese?-.562:iso?-.508:-.477,chinese?.511:iso?.077:.469);
  return pose;
}

function pronePress(phase,{kind,comparison=false}){
  const t=rep(phase), wall=kind==='decline-wall'||kind==='wall-pike';
  const smith=kind==='smith';
  const wallPike=kind==='wall-pike';
  const finger=kind==='fingers', high=kind==='jack'||smith;
  const comb=kind==='lift';
  const release=wallPike?ramp(phase,.54,.63)*(1-ramp(phase,.69,.83)):0;
  const pike=wallPike?mix(.972,1.203,t):0;
  const smithAngle=mix(.90,.51,t);
  const y=wallPike?.859:kind==='jack'?.669:wall?.637:comb?.396:kind==='plank'?.382:.543;
  const ay=kind==='plank'||comb?.074:smith?.919:wallPike?1.18:.070;
  const z=wallPike?.209-.134*release:kind==='decline-wall'?.117:kind==='jack'?-.352:-.374+.101*t;
  const pose=smith
    ?stand([0,.11+.826*Math.sin(smithAngle),-.841+.826*Math.cos(smithAngle)],pi/2-smithAngle)
    :stand([0,y+(comparison?.125*t:0)-(comb||kind==='plank'||kind==='jack'?0:.143*t),z],
      wallPike?pike:kind==='plank'||comb?1.554+.315*(comparison?t:0):kind==='jack'?1.222:1.51+.229*t);
  const activeSide=phase<.5?'l':'r';
  const tSide=rep((phase*2)%1,.36,.61);
  for(const[side,s]of sides){
    if(kind==='decline-wall'){
      leg(pose,side,[s*.145,.584+.021*t,-.685],[s*.121,-.67,.167],[s*.011,-.102,-.071]);
    } else if(comb&&((side!==activeSide)!==comparison)) {
      leg(pose,side,[s*.144,.114+.218*tSide,-1.116],[s*.155,-.77,.233],[s*.013,-.091,-.09]);
    } else {
      const jump=kind==='jack'?.096*Math.sin(pi*t):0;
      place(pose,side,[s*(kind==='jack'?.093+.271*t:.145),floor+.031+jump,wallPike?-.107:smith?-.841:kind==='jack'?-1.031:-1.159],
        jump>.003?undefined:0,-.47);
    }
    if(smith){
      grip(pose,side,[s*.249,ay,.553],[s*.714,-.266,-.43],[1,0,0]);
      continue;
    }
    if(wallPike){
      arm(pose,side,[s*.224,mix(1.114,1.277,t)+.051*release,1.036-.181*release],
        [s*.67,-.290,-.79],[s*.013,.987,.063],[0,0,1]);
      continue;
    }
    if(kind==='plank'||comb){
      const lift=comb&&side===activeSide?tSide:0;
      const shoulder=pose[side+'s'];
      const reach=unit(blend(unit(subtract([s*.205,.083,.161],shoulder)),[s*.045,.051,.998],lift));
      pose[side+'e']=lift<.004?[s*.205,.083,.161]:add(shoulder,scale(reach,.252));
      pose[side+'w']=add(pose[side+'e'],[s*.010,-.011+.042*lift,.367]);
      pose[side+'Fingers']=[0,-.03,1];
      pose[side+'PalmSide']=[0,1,0];
      continue;
    }
    const hy=kind==='jack'?.511:finger?.123:ay;
    const hand=[s*(kind==='w'?.269:finger?.192:.211),hy,kind==='jack'?.525:kind==='decline-wall'?.650:.284];
    const fingers=finger?[s*.111,-.87,.47]:kind==='w'?[-s*.573,-.055,.816]:[s*.05,-.05,1];
    arm(pose,side,hand,[s*.681,-.19,-.585],fingers,[0,1,0]);
    if(finger)pose[side+'FingerSpread']=.48;
    if(kind==='palms')pose[side+'FingerSpread']=.82;
  }
  return pose;
}

function sidePlank(phase,{kind,comparison=false}) {
  const t=rep(phase,.27,.65);
  const elevated=kind==='incline', adduction=kind==='adduction';
  const hy=elevated?.371+.089*t:adduction?.473:.276+.035*t-(comparison?.125*t:0);
  const p=stand([0,hy,-.013],-1.42,0,-1.235);
  p.lh=[.009,hy+.094,p.hips[2]];
  p.rh=[-.008,hy-.092,p.hips[2]];
  const shoulderY=elevated?.817:.414;
  p.ls=[.033,shoulderY+.123,-.463];
  p.rs=[-.028,shoulderY-.127,-.470];
  p.chest=[0,shoulderY,-.391];
  p.neck=[0,shoulderY+.019,-.581];
  p.head=[0,shoulderY+.049,-.690];
  leg(p,'l',[.027,adduction?.543:elevated?.161:.151,.794],[.072,.562,-.418],[.011,-.018,.129],
    adduction?.459:undefined);
  leg(p,'r',[-.041,adduction?.154+.335*t:floor,.762],[-.042,.15,.69],[-.01,-.071,.133],adduction?undefined:0);
  p.re=[-.028,elevated?.495:.079,-.473];
  p.rw=[-.315,elevated?.483:.065,-.699];
  p.rFingers=[-.951,-.063,-.301];p.rPalmSide=[0,1,0];
  arm(p,'l',add(p.lh,[.132,.103,.019]),[.81,-.08,-.62],[0,-.06,.98]);
  return p;
}

function chairDip(phase){
  const t=rep(phase);
  const p=stand([0,.368-.166*t,.037+.021*t],.052+.201*t);
  for(const[side,s]of sides){
    place(p,side,[s*.138,floor,.480],0);
    arm(p,side,[s*.189,.521,-.271],[s*.26,-.088,-.960],[s*.05,-.15,.98],[0,1,0]);
  }
  return p;
}
function lowSquat(phase,{kind}){
  const t=rep(phase);
  const one=kind==='single', pad=kind==='deficit', wide=kind==='side-kick';
  const shift=wide?.177*t:one?.091:0;
  const p=stand([shift,.857+(pad?.031:0)-(one?.462:wide?.356:.411)*t,.019-.308*t],.066+.559*t);
  for(const[side,s]of sides){
    if(one&&side==='r')leg(p,side,[-.178,.255+.099*t,.269+.215*t],[-.109,.97,.12],[-.01,.04,.124]);
    else if(wide&&side==='l'&&phase>.49)leg(p,side,[.162+.695*rep((phase-.49)/.51),floor+.437*rep((phase-.49)/.51),.14],[.521,.22,.784],[.091,-.047,.089]);
    else place(p,side,[s*(pad?.071:wide?.244:.161),floor+(pad?.055:0),.138],pad?.057:0,pad?-.32:0);
  }
  standArms(p);
  return p;
}
function chairCalf(phase,{kind}){
  const alternating=kind==='alternating', deficit=kind==='deficit';
  const t=rep(alternating?(phase*2)%1:phase);
  const active=phase<.5?'l':'r';
  const support=deficit?.137:0;
  const y=.812+support+.114*t;
  const pivotZ=deficit?.112:.125;
  const p=stand([0,y,-.032],.130+.049*t);
  for(const[side,s]of sides){
    const up=alternating&&side!==active?0:t;
    const footPitch=deficit?mix(.29,-.69,up):mix(.0,-.66,up);
    const height=support+floor+.095*up-(deficit?.051*(1-up):0);
    place(p,side,[s*.143,height,pivotZ-.105],support,footPitch);
    grip(p,side,[s*.169,.831,.389],[s*.534,-.65,.1],[1,0,0]);
  }
  return p;
}
function oneLegCircle(phase){
  const t=2*pi*phase, p=stand([-.068,.857,0],.03);
  place(p,'r',[-.148,floor,.051],0);
  leg(p,'l',[.351+.172*Math.sin(t),.274+.072*Math.cos(t*2),.047+.202*Math.cos(t)],
    [.703,.334,.568],[.014,-.065,.133]);
  grip(p,'r',[-.168,.837,.393],[-.67,-.51,.15],[1,0,0]);
  arm(p,'l',add(p.ls,[.406,-.369,-.055]),[.85,-.51,-.12],[.80,-.395,.20]);
  return p;
}
function standHip(phase,{kind}){
  const t=rep(phase), bent=kind==='bent';
  const p=stand([.045,.847,-.016],.051+.191*t);
  place(p,'l',[.148,floor,.112],0);
  const thigh=mix(-1.54,-2.33,t);
  legAngles(p,'r',-1,thigh,thigh-(bent?1.25:.037),.014);
  grip(p,'l',[.478,1.154,.316],[.699,-.53,.1],[0,1,0]);
  arm(p,'r',add(p.rh,[-.078,.131,.121]),[-.78,-.56,-.13]);
  return p;
}
function chairCrunch(phase){
  const t=rep(phase);
  const p=stand([0,.146,.040],mix(-1.548,-.526,t));
  for(const[side,s]of sides){
    place(p,side,[s*.138,.477+floor,.767],.477);
    arm(p,side,add(p.chest,[-s*.102,.071,.153]),[s*.83,-.35,.39]);
  }
  return p;
}

group(dragonFlag,'gym-bench-dragon',['core','lat'],groundView,[
  ['4058',{kind:'raise',bench:true,view:{yaw:68,focus:[0,.94,.033],height:2.47}}],
  ['4982',{kind:'negative',bench:true,duration:5980,view:{yaw:72,focus:[0,.95,.015],height:2.53}}],
  ['9318',{kind:'negative',equipment:'gym-floor-dragon-anchor',view:{yaw:65,focus:[0,.72,-.11],height:2.30}}],
  ['9319',{kind:'half',equipment:'gym-floor-dragon-anchor',view:{yaw:71,focus:[0,.70,-.09],height:2.20}}],
  ['9322',{kind:'single',equipment:'gym-floor-dragon-anchor',view:{yaw:65,focus:[0,.73,-.09],height:2.25}}],
]);
group(hipHold,'gym-plank-benches',['core','glute','hamstring'],groundView,[
  ['8610',{kind:'two-benches',view:{yaw:75,focus:[0,.59,.12],height:1.96},duration:6180}],
  ['5671',{kind:'kas',equipment:'gym-hip-thrust-cross-bench',view:{yaw:73,focus:[0,.62,.09]}}],
]);
group(pronePress,'none',['pec','triceps','core'],groundView,[
  ['3491',{kind:'decline-wall',equipment:'gym-wall-decline',view:{yaw:81,focus:[0,.76,-.13],height:2.52}}],
  ['6986',{kind:'wall-pike',equipment:'gym-ball-wall-contact-plain',view:{yaw:-106,focus:[0,.97,.42],height:2.28}}],
  ['6550',{kind:'smith',equipment:'gym-smith-push',view:{yaw:111,elevation:25,focus:[0,1.01,.05],height:2.45}}],
  ['3981',{kind:'fingers',view:{yaw:43,focus:[0,.48,.09],height:1.85}}],
  ['6982',{kind:'palms',view:{yaw:53,focus:[0,.54,.031]}}],
  ['0665',{kind:'w',view:{yaw:21,focus:[0,.53,.11],elevation:30}}],
  ['10593',{kind:'jack',equipment:'gym-bench-front',view:{yaw:44,focus:[0,.61,.04]}}],
  ['2347',{kind:'plank',comparison:true,view:{yaw:37,focus:[0,.58,.09],height:2.19}}],
  ['5466',{kind:'lift',comparison:true,view:{yaw:37,focus:[0,.62,.06],height:2.23}}],
]);
group(sidePlank,'none',['core','adductor'],groundView,[
  ['3544',{kind:'incline',equipment:'gym-incline-side-bench',duration:6180,view:{yaw:57,focus:[0,.58,.014]}}],
  ['1775',{kind:'adduction',equipment:'gym-bench-front',view:{yaw:66,focus:[0,.64,.024]}}],
  ['2349',{kind:'comparison',comparison:true,view:{yaw:21,height:2.13}}],
]);
group(chairDip,'gym-chair-rear',['triceps','pec'],groundView,[['3443',{view:{yaw:60,focus:[0,.67,-.09],height:1.99}}]]);
group(lowSquat,'gym-bench-squat',['quad','glute'],strengthView,[
  ['1593',{kind:'normal'}],['3493',{kind:'single',equipment:'gym-bench-low'}],
  ['3392',{kind:'deficit',equipment:'gym-heel-wedges-narrow',view:{yaw:45}}],
]);
group(chairCalf,'gym-calf-chair',['calf'],strengthView,[
  ['3390',{kind:'deficit',view:{yaw:64,focus:[0,.90,.28]}}],
  ['9411',{kind:'alternating',equipment:'gym-front-support-chair',view:{yaw:49,focus:[0,.90,.30]}}],
  ['9409',{kind:'two',equipment:'gym-front-support-chair',view:{yaw:65,focus:[0,.90,.29]}}],
]);
group(oneLegCircle,'gym-front-support-chair',['glute','adductor'],strengthView,
  [['10517',{view:{yaw:29,focus:[.12,.91,.26]}}]]);
group(standHip,'gym-support-post',['glute','hamstring'],strengthView,[
  ['2769',{kind:'basic',view:{yaw:-62}}],['9324',{kind:'long',view:{yaw:-71}}],
  ['0792',{kind:'bent',view:{yaw:-63}}],['2737',{kind:'straight',view:{yaw:-54}}],
]);
group(chairCrunch,'gym-chair-front',['core'],groundView,[['3942',{view:{yaw:73,focus:[0,.64,.06]}}]]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
function translated(p,offset){
  return Object.fromEntries(Object.entries(p).map(([k,v])=>[k,
    Array.isArray(v)&&v.length===3&&/^(?:hips|chest|neck|head|[lr][shewkat])$/.test(k)?add(v,[offset,0,0]):v]));
}
for(const {id,motion,o,equipment,muscles,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:o.duration??4730,camera:view,formComparison:o.comparison??false,
    keyframes:Array.from({length:65},(_,index)=>{
      const at=index/64;
      const pose=motion(at,{...o,comparison:false});
      return o.comparison?{at,...translated(pose,-.675),partner:translated(motion(at,o),.675)}:{at,...pose};
    })};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:o.poster??.457});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
