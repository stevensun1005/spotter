import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, sides, stand, torso } from './bodyweight/pose.mjs';

const clamp = (value, low=0, high=1) => Math.min(high,Math.max(low,value));
const cross=[1,0,0];
const long=[0,0,1];
const pi=Math.PI;

function floorPalm(pose,limb,destination,pole){
  arm(pose,limb,destination,pole,[0,-.032,1],[1,0,0]);
}

function wallHandstand(phase,{kind}){
  const bench=kind==='bench';
  const split=kind==='split';
  const kip=kind==='kip';
  const dive=bench||kip?rep(phase,.41,.60):0;
  const spread=split?rep(phase,.28,.72):0;
  const drive=kip?rep(clamp((phase-.42)/.34),.30,.58):0;
  const breath=.006*Math.sin(phase*4*pi);
  const pressY=bench?.481:.069;
  const hipY=(bench?1.549:1.146)-(bench?.408:.349)*dive+breath;
  const hipZ=split?-.320:.272-.044*dive;
  const pitch=split?pi+.058:pi-.087-.13*dive;
  const pose=torso([0,hipY,hipZ],pitch);
  pose.headAim=[0,-1,-.11];
  for(const [limb,sign] of sides){
    const separated=split&&sign<0;
    const tuck=kip?.236*dive+.139*drive:0;
    const splitAngle=mix(-.102,.680,spread);
    const ankle=separated?[sign*.108,hipY+.827*Math.cos(splitAngle),hipZ+.827*Math.sin(splitAngle)]
      :[sign*.108,hipY+.805-tuck,split?-.404:.479-(kip?.039*drive:0)];
    leg(pose,limb,ankle,[sign*.14,kip?.47:.25,kip?.90:-.98],
      [sign*.013,split?.073:.109,split?-.108:-.039]);
    floorPalm(pose,limb,[sign*(bench?.336:.177),pressY,split?-.267:.211],
      [sign*(dive>.002?.72:.16),-.19,-.91]);
  }
  return pose;
}

function handstandTravel(phase){
  const stride=.31;
  const steps=phase*2;
  const z=(steps-1)*stride;
  const sway=.028*Math.sin(steps*2*pi);
  const pose=torso([sway,1.135-.027*Math.cos(steps*4*pi),z],pi-.041+.057*Math.sin(steps*2*pi));
  pose.followZ=z;
  for(const [limb,sign] of sides){
    const q=steps+(sign===1?0:.5);
    const f=q%1;
    const lift=clamp((f-.57)/.43);
    const handZ=(Math.floor(q)-1)*stride+.015+stride*ramp(f,.59,.99);
    floorPalm(pose,limb,[sign*.170,.068+.096*Math.sin(pi*lift),handZ],[sign*.25,.03,-.95]);
    legAngles(pose,limb,sign,pi/2-.032,pi/2+.074,.017);
  }
  return pose;
}

function planche(phase,{kind}){
  const dip=kind==='dip';
  const elbows=kind==='elbow';
  const leanOnly=kind==='lean';
  const spread=kind==='straddle';
  const press=kind==='press';
  const amount=rep(phase,leanOnly?.32:.43,leanOnly?.68:.61);
  const lean=ramp(phase,0,.30)*(1-ramp(phase,.68,1));
  const hand=dip?[.266,1.175,.027]:[.171,.068,.074];
  const shouldersZ=hand[2]+(elbows?.311:.154)+(elbows?.102:.171)*lean;
  const radius=elbows?mix(.526,.490,lean):dip?mix(.600,.384,amount):.615;
  const armHeight=Math.sqrt(Math.max(.034,radius*radius-(shouldersZ-hand[2])**2));
  const shoulderY=hand[1]+armHeight;
  const pitch=elbows?mix(1.31,1.55,amount):dip?mix(1.55,1.62,amount):mix(press?1.42:1.16,1.560,amount);
  const pose=torso([0,shoulderY-.502*Math.cos(pitch),shouldersZ-.502*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    const delivery=elbows?rep(clamp((phase-(sign===1?0:.10))/(sign===1?.93:.90)),.40,.65):amount;
    if(dip){
      legAngles(pose,limb,sign,pi+.027,pi+.088,.018);
      grip(pose,limb,[sign*hand[0],hand[1],hand[2]],[sign*.29,-.04,-.94],long);
      continue;
    }
    const length=spread?mix(.718,.722,delivery):mix(.733,.819,delivery);
    const out=spread?mix(.134,.519,delivery):.124;
    const target=[sign*out,leanOnly?.078:mix(.076,pose.hips[1]-.023,delivery),pose.hips[2]-length];
    leg(pose,limb,target,[sign*.15,.77,-.40],[sign*.002,-.073,.135],leanOnly||delivery<.001?0:null);
    floorPalm(pose,limb,[sign*hand[0],hand[1],hand[2]],[sign*(elbows?.07:.47),elbows?.26:-.58,-.92]);
  }
  return pose;
}

function tuckBalance(phase,{parallette}){
  const hold=rep(phase,.38,.67);
  const x=parallette?.225:.172;
  const y=parallette?.176:.069;
  const z=parallette?.520:.157;
  const pitch=mix(.976,1.54,hold);
  const p=torso([0,mix(.398,y+.483,hold),z-.351-.074*hold],pitch);
  for(const [limb,sign] of sides){
    const pickup=rep(clamp((phase-(sign===1?0:.11))/(sign===1?.95:.84)),.39,.65);
    const target=[sign*(parallette?.128:.228),mix(.078,y+.192,pickup),z-.344-.111*pickup];
    leg(p,limb,target,[sign*.65,.03,.95],[sign*.009,-.067,.13],pickup<.001?0:null);
    if(parallette)grip(p,limb,[sign*x,y,z],[sign*.56,-.29,-.73],long);
    else floorPalm(p,limb,[sign*x,y,z],[sign*.89,-.16,-.52]);
  }
  return p;
}

function wallNegative(phase){
  const down=rep(phase,.43,.66);
  const tuck=ramp(down,.49,.92);
  const pitch=mix(pi-.074,1.604,down);
  const shoulderDepth=mix(.163,.354,down);
  const shoulderHeight=.068+Math.sqrt(.615**2-(shoulderDepth-.165)**2);
  const pose=torso([0,shoulderHeight-.502*Math.cos(pitch),shoulderDepth-.502*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    const vertical=[sign*.106,pose.hips[1]+.798,.474-.581*down];
    const gathered=[sign*.117,pose.hips[1]-.309,pose.hips[2]-.196];
    leg(pose,limb,blend(vertical,gathered,tuck),[sign*.17,-.39,.93],[sign*.014,.061,-.105]);
    floorPalm(pose,limb,[sign*.174,.068,.165],[sign*.39,-.46,-.74]);
  }
  return pose;
}

function headstand(phase){
  const rise=rep(phase,.45,.65);
  const pitch=mix(2.407,pi,rise);
  const p=torso([0,.640+.143*rise,-.249+.067*rise],pitch);
  p.headAim=[0,-1,.1];
  for(const [limb,sign] of sides){
    const target=[sign*.129,mix(.078,p.hips[1]+.812,rise),mix(-.733,p.hips[2],rise)];
    leg(p,limb,target,[sign*.11,.38,.95],[sign*.015,-.072+.153*rise,.134-.113*rise],rise<.001?0:null);
    p[limb+'e']=[sign*.154,.086,mix(.021,-.206,rise)];
    p[limb+'w']=[sign*.037,.090,mix(.333,.105,rise)];
    p[limb+'Fingers']=[0,.23,.97];
    p[limb+'PalmSide']=[sign,.02,.10];
  }
  return p;
}

function barBody(phase,{row}){
  const amount=rep(phase,.43,.63);
  const gripPoint=[0,1.163,-.429];
  if(row){
    const pitch=mix(-1.052,-.750,amount);
    const p=torso([0,.076+.774*Math.cos(pitch),.31+.774*Math.sin(pitch)],pitch);
    for(const [limb,sign] of sides){
      leg(p,limb,[sign*.137,.076,.310],[sign*.09,.91,.18],[sign*.013,.022,.131],0);
      grip(p,limb,add(gripPoint,[sign*.307,0,0]),[sign*.67,-.52,.45],cross);
    }
    return p;
  }
  const pitch=mix(.873,1.079,amount);
  const p=stand([0,mix(.722,.600,amount),mix(.546,.373,amount)],pitch,pi);
  [p.lh,p.rh]=[p.rh,p.lh];
  for(const [limb,sign] of sides){
    leg(p,limb,[-sign*.149,.087,1.057],[-sign*.08,-.69,-.58],[0,-.075,-.119],0);
    grip(p,limb,add(gripPoint,[-sign*.322,0,0]),[-sign*.71,-.28,.52],cross);
  }
  return p;
}

function forearmStand(phase){
  const rise=rep(phase,.43,.64);
  const gather=ramp(rise,.16,.74);
  const pitch=mix(1.516,pi,rise);
  const shoulderY=mix(.355,.411,rise);
  const shoulderZ=mix(.103,.014,rise);
  const p=torso([0,shoulderY-.502*Math.cos(pitch),shoulderZ-.502*Math.sin(pitch)],pitch);
  p.headAim=[0,-.96,.27];
  for(const [limb,sign] of sides){
    p[limb+'e']=[sign*.173,.086,.085];
    p[limb+'w']=[sign*.151,.091,.412];
    p[limb+'Fingers']=[0,-.051,1];
    p[limb+'PalmSide']=[sign,0,0];
    const lift=sign===1?ramp(rise,.17,.80):ramp(rise,.37,.94);
    const grounded=[sign*.138,.076,-.825+.151*gather];
    const high=[sign*.112,p.hips[1]+.830,p.hips[2]+.015];
    leg(p,limb,blend(grounded,high,lift),[sign*.19,-.12,.92],[sign*.018,mix(-.065,.137,lift),mix(.143,.039,lift)],lift<.001?0:null);
  }
  return p;
}

function floorMaltese(phase,{open}){
  const lift=rep(phase,.36,.65);
  const wristX=.693;
  const wristZ=.118;
  const shoulderZ=.268+.083*lift;
  const shoulderY=.068+Math.sqrt(.614**2-(wristX-.192)**2-(shoulderZ-wristZ)**2);
  const pitch=mix(1.33,1.565,lift);
  const pose=torso([0,shoulderY-.502*Math.cos(pitch),shoulderZ-.502*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    const spread=open?mix(.152,.551,lift):.117;
    const ankleY=mix(.076,pose.hips[1]+.008,lift);
    const ankleZ=pose.hips[2]-Math.sqrt(.831**2-(spread-.103)**2-(ankleY-pose.hips[1])**2);
    leg(pose,limb,[sign*spread,ankleY,ankleZ],[sign*.077,.85,-.25],[sign*.017,-.073,.132],lift<.001?0:null);
    floorPalm(pose,limb,[sign*wristX,.068,wristZ],[sign*.52,.79,-.30]);
  }
  return pose;
}

function stalder(phase){
  const lift=rep(phase,.44,.66);
  const close=ramp(lift,.47,1);
  const pitch=mix(1.044,pi-.018,lift);
  const depth=mix(.216,.128,lift);
  const handZ=.091;
  const shoulderY=.067+Math.sqrt(.610**2-(depth-handZ)**2);
  const pose=torso([0,shoulderY-.502*Math.cos(pitch),depth-.502*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    const angle=mix(-.315,pi/2-.027,lift);
    const lateral=.827*Math.cos(angle)*(1-close);
    const rise=.827*Math.sin(angle);
    const foot=[sign*(.106+lateral),Math.max(.077,pose.hips[1]+rise),pose.hips[2]+.377*(1-close)*(1-lift)];
    leg(pose,limb,foot,[sign*.87,.29,.71],[sign*.021,mix(-.073,.125,lift),mix(.135,.068,lift)],lift<.001?0:null);
    floorPalm(pose,limb,[sign*.170,.067,handZ],[sign*.53,-.33,-.71]);
  }
  return pose;
}

const floorCam={yaw:65,elevation:12,focus:[0,.62,.009],height:1.79};
const upsideCam={yaw:112,elevation:11,focus:[0,1.05,.206],height:2.50};
const jobs=[
  ['6545',wallHandstand,{kind:'hold'},'handstand-wall',['shoulder','core'],upsideCam,4000,.47],
  ['3916',wallHandstand,{kind:'bench'},'handstand-bench-wall',['shoulder','triceps'],{...upsideCam,focus:[0,1.35,.2],height:2.91},5100,.49],
  ['5151',wallHandstand,{kind:'kip'},'handstand-wall',['shoulder','triceps'],upsideCam,4500,.59],
  ['10998',wallHandstand,{kind:'split'},'handstand-front-wall',['core','shoulder'],{...upsideCam,yaw:60,focus:[0,1.04,-.27]},5000,.45],
  ['4376',handstandTravel,{},'none',['shoulder','core'],{...upsideCam,yaw:65,focus:[0,1.02,0],height:2.46},4100,.45],
  ['10997',wallNegative,{},'handstand-wall',['shoulder','core'],{...upsideCam,yaw:104,focus:[0,1.03,.112],height:2.49},5800,.47],
  ['6879',headstand,{},'mat',['shoulder','core'],{...upsideCam,yaw:59,focus:[0,.89,-.32],height:2.21},5800,.48],
  ['10665',planche,{kind:'elbow'},'none',['core','shoulder'],floorCam,5300,.50],
  ['3299',planche,{kind:'full'},'none',['core','shoulder'],floorCam,5050,.50],
  ['3300',planche,{kind:'lean'},'none',['core','shoulder'],floorCam,5100,.50],
  ['10664',planche,{kind:'press'},'none',['core','shoulder'],floorCam,5050,.50],
  ['3298',planche,{kind:'straddle'},'none',['core','shoulder'],{...floorCam,yaw:42,elevation:18},5050,.50],
  ['3301',tuckBalance,{parallette:false},'none',['core','shoulder'],{...floorCam,yaw:55},5300,.50],
  ['10989',tuckBalance,{parallette:true},'push-up-handles',['core','shoulder'],{...floorCam,yaw:56,focus:[0,.57,.33]},5200,.50],
  ['7415',planche,{kind:'dip'},'parallel-dips',['pec','triceps','core'],{...floorCam,yaw:64,focus:[0,1.09,-.12],height:2.36},4800,.50],
  ['9312',barBody,{row:false},'inverted-high-row',['pec','triceps'],{...floorCam,focus:[0,.77,.15],height:1.95},4500,.50],
  ['4917',barBody,{row:true},'inverted-high-row',['lat','biceps'],{...floorCam,focus:[0,.79,-.33],height:1.98},4500,.50],
  ['6880',forearmStand,{},'mat',['shoulder','core'],{...upsideCam,yaw:60,focus:[0,.95,-.13],height:2.38},5900,.50],
  ['3314',floorMaltese,{open:true},'none',['shoulder','core'],{...floorCam,yaw:39,elevation:17,focus:[0,.47,-.22],height:1.69},5300,.50],
  ['3315',floorMaltese,{open:false},'none',['shoulder','core'],{...floorCam,yaw:55,focus:[0,.47,-.23],height:1.69},5300,.50],
  ['3291',stalder,{},'none',['shoulder','core','adductor'],{...upsideCam,yaw:43,focus:[0,1.02,.073],height:2.56},5600,.55],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or repeated inversion ID.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const [id,animate,config,equipment,muscles,camera,durationMs,posterAt] of selected){
  try{
    const keyframes=Array.from({length:49},(_,index)=>({at:index/48,...animate(index/48,config)}));
    const asset={version:1,durationMs,equipment,muscles,camera,keyframes};
    prepareRecipe(asset);
    const recipe=id+'.json';
    await writeFile(resolve(output,recipe),JSON.stringify(asset)+'\n');
    items.push({id,recipe,posterAt});
  }catch(error){failures.push({id,reason:error.message});}
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
