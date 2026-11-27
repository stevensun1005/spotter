import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

function cableAnkles(pose, anchor, feet) {
  pose.cables = feet.map((side) => ({
    anchor, end: pose[side+'a'], grip: unit(subtract(pose[side+'k'],pose[side+'a'])),
  }));
}

function standingCuff(phase,{ type, toe = 0, low = false, wide = false, deep = false, axial = false }) {
  const t = rep(phase);
  const lateral = type === 'abduction' || type === 'diagonal' || type === 'adduction';
  const flex = type === 'flex';
  const curl = type === 'curl';
  const pose = stand([.039,.875,-.018],lateral ? .023 : flex ? -.041 : .082);
  leg(pose,'l',[.157,.078,.059],[.081,-.069,1],[.016,-.073,.135],0);
  const angle = -Math.PI/2+t*(flex ? (deep ? 1.512 : 1.35) : curl ? .055 : lateral ? -.126 : deep ? -.746 : -.673);
  const shin = curl ? angle-1.29*t : flex ? -Math.PI/2 + .08*t : angle-(flex ? .02 : .012);
  legAngles(pose,'r',-1,angle,shin);
  if(lateral){
    const direction = type==='adduction' ? 1 : -1;
    const sweep = t*(axial ? .35 : wide ? .629 : .535);
    const reachY = axial ? Math.sqrt(Math.max(.01, .42**2 - (.42*Math.sin(sweep))**2 - (.276*t)**2)) : .419*Math.cos(sweep);
    const kneeAngle = type==='adduction' ? -.054 : toe*.04;
    const knee = [-.420*Math.sin(sweep)*(-direction), -reachY, type==='diagonal' ? (axial ? -.276 : -.141)*t : type==='adduction' ? .091*t : kneeAngle];
    pose.rk = add(pose.rh,knee);
    pose.ra = add(pose.rk,[knee[0]*1.01,knee[1]*1.01,type==='diagonal' ? (axial ? -.271 : -.149)*t : type==='adduction' ? .105*t : .019]);
    pose.rt = add(pose.ra,[toe*.067,-.073*Math.cos(sweep),.138*(1-Math.abs(toe)*.14)]);
  }
  grip(pose,'l',[.349,1.108,.30],[.76,-.63,-.18],[0,0,1]);
  arm(pose,'r',add(pose.rh,[-.098,.09,.043]),[-.79,-.52,.07]);
  const anchor = lateral && !axial ? [type==='adduction' ? -.927 : .921,low?.164:.211,.087] : [0,.175,flex ? -1.047 : 1.06];
  cableAnkles(pose,anchor,['r']);
  return pose;
}

function quadrupedCuff(phase,{ type, diagonal = false }) {
  const t=rep(phase);
  const pose=stand([0,.496,-.295],1.55);
  for(const [side,sign] of sides){
    arm(pose,side,[sign*.185,.036,.292],[sign*.12,.13,-.92],[0,-.03,1],[1,0,0]);
    if(side==='l'){
      pose.lk=[.130,.093,-.225];
      pose.la=[.135,.092,-.644];
      pose.lt=[.142,.027,-.778];
    }
  }
  const inPlane = type==='abduction';
  const thigh = inPlane ? -1.56 : mix(-1.48,-3.34,t);
  const shin = inPlane ? -3.06 : type==='bent' ? mix(-3.10,-4.55,t) : mix(-3.10,-3.34,t);
  legAngles(pose,'r',-1,thigh,shin,diagonal||inPlane?.224*t:0);
  if(diagonal||inPlane){
    const s = diagonal ? .236 : .32;
    pose.rk[0] -= s*.31*t;
    pose.ra[0] -= s*t;
    pose.rt[0] -= s*t;
    if(inPlane){
      const theta = .92*t;
      pose.rk = add(pose.rh,[-.42*Math.sin(theta),-.42*Math.cos(theta),0]);
      pose.ra = add(pose.rk,[-.021,.019,-.419]);
      pose.rt = add(pose.ra,[-.017,-.063,-.132]);
    }
  }
  cableAnkles(pose,inPlane ? [1.070,.171,-.345] : [0,.171,1.074],['r']);
  return pose;
}

function proneCuff(phase, bench) {
  const t=rep(phase);
  const pose=stand([0,bench?.558:.151,bench?.026:-.022],Math.PI/2);
  for(const [side,sign] of sides){
    const shin = -Math.PI - ((bench||side==='r') ? 1.573*t : 0);
    legAngles(pose,side,sign,-Math.PI-.026,shin,.015);
    if(bench) grip(pose,side,[sign*.187,.459,.668],[sign*.55,-.47,.248],[0,0,1]);
    else arm(pose,side,[sign*.232,.071,.587],[sign*.77,-.27,.54]);
  }
  cableAnkles(pose,[0,.174,-1.248],bench?['l','r']:['r']);
  return pose;
}

function lyingCuff(phase, bilateral) {
  const t=rep(phase);
  const pose=stand([0,.138,.054],-Math.PI/2);
  for(const [side,sign] of sides){
    const active=bilateral||side==='r';
    legAngles(pose,side,sign,active?mix(-.055,1.418,t):-.058,active?mix(-.068,-.945,t):-.055,.016);
    arm(pose,side,[sign*.228,.052,-.028],[sign*.47,-.48,-.73],[0,-.029,1],[1,0,0]);
  }
  cableAnkles(pose,[0,.175,1.286],bilateral?['l','r']:['r']);
  return pose;
}

function grabHandle(pose){
  const grasp=add(pose.chest,[0,.035,.188]);
  for(const [side,sign] of sides){
    grip(pose,side,add(grasp,[sign*.039,0,0]),[sign*.59,-.87,-.09],[0,1,0]);
  }
}

function dynamicLunge(phase,{ mode, height = .18, narrow = false, behind = false }) {
  const t=rep(phase,.44,.57);
  const enter=ramp(phase,.013,.273);
  const leave=ramp(phase,.72,.98);
  const shift=enter*(1-leave);
  const afloat=Math.sin(Math.PI*enter)+Math.sin(Math.PI*leave);
  const side=mode==='side';
  const pose=stand([side?.318*t:0,.867-(narrow?.302:.346)*t,side?-.22*t:.345*shift],.043+.24*t);
  const right=[-.164,.076+(side?0:.047*shift),side?.05:-.215*shift];
  const left=[.165+(side?.580*shift:0),.076+.091*afloat,side?.05:.687*shift];
  for(const [s,sign] of sides) {
    const isStep=s==='l';
    leg(pose,s,isStep?left:right,[sign*.13,-.04,1],[sign*.014,-.073-(!side&&!isStep?.043*shift:0),.141],
      isStep&&afloat>.026?undefined:0);
  }
  grabHandle(pose);
  pose.cables=[{anchor:side?[-1.12,height,.165]:[0,height,behind?-1.09:1.68],end:pose.rw,grip:[0,1,0]}];
  return pose;
}

function loadedStep(phase,{ lateral, one, singleHand, highHipHinge = false, height = .222 }) {
  const t=rep(phase);
  const foot= lateral ? [.115,height+.072,.08] : [.126,height+.072,.37];
  const position=lateral?[-.28+.414*t,.858+height*t,.076]:[.030,.859+height*t,-.087+.326*t];
  const hinge = highHipHinge ? .078*(1-t) : 0;
  const pose=stand(position,.073+hinge+.208*Math.sin(Math.PI*t),lateral?Math.PI/2:0);
  const stepClearance = height*ramp(t,.075,.70) + .041*Math.sin(Math.PI*t) + (one ? .051*t : 0);
  const shift = ramp(t,.17,.97);
  const trail = lateral ? [-.471+.42*shift,.075+stepClearance,.08] : [-.132,.078+stepClearance,-.27+(one?.39:.59)*shift];
  const braceToe=lateral?[.138,-.071,.012]:[.011,-.073,.136];
  leg(pose,'l',foot,[.10,-.04,1],braceToe,height);
  leg(pose,'r',trail,[-.16,.16,1],braceToe,t<.007?0:(!one&&t>.983?height:undefined));
  if(singleHand) {
    grip(pose,'l',add(pose.lh,[.159,-.085,.159]),[.82,-.58,-.48],[0,1,0]);
    arm(pose,'r',add(pose.rh,[-.099,.055,-.011]),[-.55,-.72,.12]);
  }else grabHandle(pose);
  pose.cables=[{anchor:lateral?[-1.11,.173,-.12]:[0,.174,1.24],end:pose[singleHand?'lw':'rw'],grip:[0,1,0]}];
  return pose;
}

const standCamera={yaw:48,elevation:13,focus:[0,.97,.265],height:2.46};
const sideCamera={yaw:24,elevation:13,focus:[.03,.97,.15],height:2.48};
const floorCamera={yaw:-61,elevation:16,focus:[0,.83,.18],height:2.53};
const jobs=[];
function register(make,preset,muscles,camera,list){
  for(const [id,option] of list) jobs.push({id,preset,muscles,camera,pose:(phase)=>make(phase,option)});
}
register(standingCuff,'cable-ankle-extension',['r:glute'],sideCamera,[
  ['2755',{type:'abduction',toe:1}],['2756',{type:'abduction',toe:-1}],['5470',{type:'diagonal'}],['10860',{type:'diagonal',wide:true}],
]);
register(standingCuff,'cable-ankle-extension',['r:quad'],sideCamera,[['11267',{type:'adduction',low:true}]]);
register(standingCuff,'cable-ankle-extension',['r:glute','r:hamstring'],standCamera,[
  ['0880',{type:'extension'}],['11259',{type:'extension',deep:true}],
]);
register(standingCuff,'cable-ankle-extension',['r:glute','r:hamstring'],{...standCamera,yaw:-47},[['8083',{type:'diagonal',wide:true,axial:true}]]);
register(standingCuff,'cable-ankle-extension',['r:quad','core'],{...standCamera,focus:[0,.98,-.23]},[
  ['8191',{type:'flex'}],['11265',{type:'flex',deep:true}],
]);
register(standingCuff,'cable-ankle-extension',['r:hamstring'],standCamera,[['1547',{type:'curl'}]]);
register(quadrupedCuff,'cable-ankle-floor',['r:glute','r:hamstring'],floorCamera,[
  ['6742',{type:'bent',diagonal:true}],['4421',{type:'bent'}],['7589',{type:'straight'}],
]);
register(quadrupedCuff,'cable-ankle-floor',['r:glute'],{...floorCamera,yaw:155,elevation:18,focus:[.17,.93,-.276]},[['6739',{type:'abduction'}]]);
register(proneCuff,'cable-ankle-flat-bench',['hamstring'],{...floorCamera,yaw:70,focus:[0,.93,-.29]},[['3235',true]]);
register(proneCuff,'cable-ankle-floor',['r:hamstring'],{...floorCamera,yaw:63,focus:[0,.90,-.21]},[['11276',false]]);
register(lyingCuff,'cable-ankle-floor',['core','r:quad'],floorCamera,[['8875',false]]);
register(lyingCuff,'cable-ankle-tuck',['core','quad'],{...floorCamera,yaw:58},[['8876',true]]);
register(dynamicLunge,'cable',['quad','glute'],{...sideCamera,focus:[-.24,1.02,.10]},[
  ['3350',{mode:'side'}],['3355',{mode:'side',height:1.211}],['11255',{mode:'side',narrow:true}],
]);
register(dynamicLunge,'cable',['quad','glute'],{...standCamera,yaw:63,height:2.76},[
  ['3351',{mode:'front',height:1.187}],['3356',{mode:'front',behind:true}],
]);
register(loadedStep,'cable-step-grip',['quad','glute'],{...standCamera,yaw:35,height:2.63},[
  ['5315',{one:true,highHipHinge:true}],['10120',{one:true,singleHand:true}],
]);
register(loadedStep,'cable-side-step-grip',['quad','glute'],{...standCamera,yaw:27,height:2.62},[
  ['10119',{lateral:true}],
]);
register(loadedStep,'cable-box-grip',['quad','glute'],{...standCamera,yaw:39,height:2.68},[
  ['7586',{singleHand:true,one:true,highHipHinge:true,height:.305}],['10048',{height:.305}],
]);

const [directory,...requested]=process.argv.slice(2);
if(!directory) throw Error('Pass the output directory and optional catalogue IDs.');
const selected=requested.length?jobs.filter(({id})=>requested.includes(id)):jobs;
if(!selected.length||(requested.length&&selected.length!==requested.length))throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const {id,pose,preset,muscles,camera} of selected){
  const keyframes=Array.from({length:57},(_,i)=>({at:i/56,...pose(i/56)}));
  const recipe={version:1,equipment:preset,durationMs:4400,muscles,camera,keyframes};
  try {
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:.46});
  } catch(error) { failures.push([id,error.message]); }
}
if (items.length) await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length) process.exitCode=1;
