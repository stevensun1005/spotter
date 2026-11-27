import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, torso, unit } from './bodyweight/pose.mjs';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const tau = 2 * Math.PI;
const across = [1, 0, 0];
const up = [0, 1, 0];

function feet(pose, width=.155, depth=.068) {
  for (const [limb,sign] of sides) leg(pose,limb,[width*sign,.078,depth],[sign*.16,.04,1],[sign*.021,-.073,.144],0);
}

function chinTuck(phase) {
  const amount=rep(phase,.28,.71);
  const body=stand([0,.861,.039],.028);
  feet(body);
  body.head=add(body.head,[0,0,-.083*amount]);
  body.neck=add(body.neck,[0,0,-.050*amount]);
  body.headAim=[0,1,-.07*amount];
  arm(body,'l',add(body.head,[.015,-.109,.110]),[.72,-.48,-.56],[-.105,.994,-.058],[.94,.111,.022]);
  body.lFingerCurl=.43;
  arm(body,'r',[-.233,.836,.117],[-.38,-.12,-.52],[0,-1,.023],[-1,0,0]);
  return body;
}

function groundedChin(phase,{low}) {
  const lift=rep(phase,.41,.64);
  const pose=low?torso([0,.361+.349*lift,.639-.108*lift],mix(-1.05,-.691,lift))
    :stand([0,.626+.323*lift,-.093+.093*lift],mix(-.164,.020,lift));
  for(const [limb,sign] of sides){
    const depth=low?1.006:.239;
    leg(pose,limb,[sign*.157,.076,depth],[sign*.19,.96,.25],[sign*.021,-.073,.132],0);
    grip(pose,limb,[sign*(low?.269:.224),low?1.041:1.652,low?.198:.092],[sign*.59,-.55,.49],[-1,0,0]);
  }
  return pose;
}

function assistedHang(phase,{kind}) {
  const commando=kind==='commando';
  const partner=kind==='partner';
  const footBand=kind==='underhand';
  const overhand=!footBand;
  const local=commando?(2*phase)%1:phase;
  const left=phase<.5||phase===1;
  const lift=rep(local,.40,.64);
  const body=stand([0,1.079+.337*lift,.036+(commando?(left?1:-1)*.181*lift:-.024*lift)],
    -.031+(commando?0:.046*lift),commando?Math.PI/2:0);
  const feetTargets=commando?[[.12,.387-.022*lift,.379],[-.132,.398-.070*lift,.281]]
    :[[.124,footBand?.235+.335*lift:.359+.267*lift,.123],[-.122,.342+.246*lift,.335]];
  for(const [index,[limb,sign]] of sides.entries()){
    leg(body,limb,feetTargets[index],[sign*.087,.073,.93],[sign*.018,-.066,.137]);
    const contact=[sign*(commando?.116:overhand?.327:.235),2.144,.097];
    grip(body,limb,contact,[sign*.68,-.46,commando?(left?-.37:.37):.43],
      [overhand?commando?sign:1:-1,0,0]);
  }
  if(partner){
    const helper=stand([.587,.434,.502],.812,-1.56);
    for(const [limb,sign] of sides){
      leg(helper,limb,[.673+sign*.130,.076,.596],[sign*.09,.094,-1],[0,-.071,-.137],0);
      const ankle=body[limb+'a'];
      arm(helper,limb,add(ankle,[.068,.059,.066]),[.74,-.49,sign*.27],[-.97,.11,.19],[0,1,0]);
    }
    body.partner=helper;
  }else{
    const support=footBand?body.la:body.rk;
    body.bandPath=[[-.052,2.144,.097],add(support,[0,footBand?-.071:-.038,.034]),[.052,2.144,.097]];
  }
  return body;
}

function assistedNordic(phase) {
  const lean=rep(phase,.43,.59);
  const kneeY=.110;
  const pitch=mix(.037,1.308,lean);
  const body=torso([0,kneeY+.420*Math.cos(pitch),.160+.420*Math.sin(pitch)],pitch);
  for(const [limb,sign] of sides){
    body[limb+'k']=[sign*.148,kneeY,.160];
    body[limb+'a']=[sign*.149,.091,-.263];
    body[limb+'t']=[sign*.157,.021,-.365];
    const rest=add(body[limb+'s'],[sign*.060,-.235,.116]);
    arm(body,limb,blend(rest,[sign*.269,.076,1.066],lean),[sign*.54,-.16,-.68],
      [0,mix(.89,-.018,lean),mix(.455,1,lean)],[sign,0,0]);
  }
  return body;
}

function supportedSideBall(phase){
  const lean=rep(phase,.30,.69);
  const body=torso([0,.596,-.099-.037*lean],1.49+.174*lean,-Math.PI/2);
  body.ballCenter=[0,.285,-.138-.037*lean];
  for(const [limb,sign] of sides)leg(body,limb,[sign*.089,mix(.156,.091,sign===1?1:.1),-.837],
    [sign*.10,.53,-.77],[sign*.005,-.06,-.132],0);
  const reach=add(body.ls,[.035,-.039-.077*lean,.553]);
  arm(body,'l',reach,[.72,.46,.08],[0,-.11,1],[1,0,0]);
  arm(body,'r',[.239,.091,.487],[.78,.20,-.13],[.22,-.025,.97],[1,0,0]);
  const helper=stand([.616,.654,.744],.642,-Math.PI/2);
  for(const [limb,sign] of sides)leg(helper,limb,[.653+sign*.130,.078,.771],
    [-.18,.31,sign*.91],[0,-.069,-.141],0);
  arm(helper,'l',add(body.lw,[.035,.008,.026]),[.55,.39,.68],[-1,0,.03],[0,1,0]);
  arm(helper,'r',add(body.le,[.025,.019,.010]),[.55,-.52,-.61],[-1,0,-.03],[0,1,0]);
  body.partner=helper;
  return body;
}

function sheetPistol(phase){
  const drop=rep(phase,.42,.65);
  const body=stand([-.046,.871-.448*drop,-.111-.259*drop],.073+.247*drop);
  leg(body,'r',[-.131,.076,.054],[-.14,.05,1],[-.021,-.072,.135],0);
  const length=.807;
  const swing=mix(-.997,-.098,drop);
  leg(body,'l',add(body.lh,[.065,length*Math.sin(swing),length*Math.cos(swing)]),[.16,.94,.10],[.018,-.055,.139]);
  body.straps=sides.map(([limb,sign])=>{
    const anchor=[sign*.086,2.161,.724];
    const wish=[sign*.207,mix(1.267,.895,drop),mix(.310,.133,drop)];
    const end=add(anchor,scale(unit(subtract(wish,anchor)),1.214));
    grip(body,limb,end,[sign*.57,-.69,.28],across);
    return {side:limb,anchor,end,axis:across};
  });
  return body;
}

function assistedDowel(phase,{rotation}){
  const lift=rep(phase,.39,.65);
  const body=stand([0,.887,.018],.025);
  feet(body);
  if(rotation){
    const center=[-.022,1.191+.164*lift,-.207];
    const axis=unit([-.27,.956,-.116]);
    for(const [limb,sign] of sides){
      const hand=add(center,scale(axis,sign*.327));
      grip(body,limb,hand,[sign*.76,sign===1?.51:-.72,-.39],axis);
    }
    body.barbell={center,axis};
  }else{
    const angle=mix(.132,2.723,lift);
    const center=[0,1.385-.548*Math.cos(angle),.039+.565*Math.sin(angle)];
    for(const [limb,sign] of sides)grip(body,limb,add(center,[sign*.270,0,0]),[sign*.38,-.79,-.42],across);
    body.barbell={center,axis:across};
  }
  return body;
}

function headbanger(phase){
  const move=rep(phase,.43,.61);
  const body=torso([0,1.351-.056*move,-.036-.265*move],.022+.105*move);
  for(const [limb,sign] of sides){
    legAngles(body,limb,sign,.003,.005,.014);
    grip(body,limb,[sign*.304,2.144,.097],[sign*.56,-.71,.47],across);
  }
  return body;
}

function highBarSwing(phase){
  const release=phase>.327&&phase<.712;
  const spin=ramp(phase,.327,.712)*tau;
  const rise=Math.sin(Math.PI*clamp((phase-.327)/.385))*.243;
  const swing=.54*Math.sin(tau*phase);
  const pitch=-swing*.69;
  const body=stand([0,1.082+.089*Math.abs(swing)+rise,swing*.48],pitch,spin);
  const moving=[Math.sin(spin),0,Math.cos(spin)];
  const cross=[Math.cos(spin),0,-Math.sin(spin)];
  for(const [limb,sign] of sides){
    const ankle=add(body.hips,add(scale(cross,sign*.113),add([0,-.812,0],scale(moving,.263*swing))));
    leg(body,limb,ankle,add(scale(cross,sign*.11),moving),add([0,-.062,0],scale(moving,.124)));
    const gripPoint=[sign*.301,2.144,.097];
    const overhead=add(body[limb+'s'],add(scale(cross,sign*.075),[0,.454,-.064]));
    const releaseAmount=release?rep(clamp((phase-.327)/.385),.26,.73):0;
    const target=blend(gripPoint,overhead,releaseAmount);
    const pole=add(scale(cross,sign*.59),[.04,-.64,.34]);
    if(releaseAmount>.06)arm(body,limb,target,pole,add(scale(moving,.27),[0,.94,0]),cross);
    else grip(body,limb,target,pole,across);
  }
  return body;
}

const standCam={yaw:58,elevation:12,focus:[0,.89,.03],height:2.12};
const pullCam={yaw:51,elevation:12,focus:[0,1.16,.15],height:2.53};
const jobs=[
  ['3150',chinTuck,{},'none',['neck'],{...standCam,yaw:68,focus:[0,1.24,.06],height:1.68},4600,.47],
  ['4716',groundedChin,{low:true},'assisted-low-bar',['lat','biceps'],{...pullCam,focus:[0,.71,.43],height:1.77},4700,.49],
  ['4970',groundedChin,{low:false},'assisted-squat-bar',['lat','biceps'],{...pullCam,focus:[0,.90,.06],height:2.12},4700,.49],
  ['4717',assistedHang,{kind:'commando'},'pull-up-stretch-band',['lat','biceps'],{...pullCam,yaw:31},5350,.25],
  ['4718',assistedHang,{kind:'underhand'},'pull-up-stretch-band',['lat','biceps'],pullCam,4750,.49],
  ['2997',assistedHang,{kind:'overhand'},'pull-up-stretch-band',['lat','biceps'],{...pullCam,yaw:57},4750,.49],
  ['9510',assistedHang,{kind:'partner'},'pull-up',['lat','biceps'],{...pullCam,yaw:55,focus:[.29,1.14,.20]},4800,.49],
  ['3415',assistedNordic,{},'nordic-mat',['hamstring','glute'],{...standCam,yaw:70,focus:[0,.57,.35],height:1.65},4800,.56],
  ['1715',supportedSideBall,{},'stability-ball',['l:lat','l:core'],{...standCam,yaw:43,focus:[.28,.65,.19],height:1.80},5200,.47],
  ['3747',sheetPistol,{},'adjustable-sheet-assist',['r:quad','r:glute'],{...pullCam,yaw:26,focus:[0,1.07,.36]},4800,.49],
  ['9980',assistedDowel,{rotation:false},'training-assist-dowel',['shoulder'],{...standCam,yaw:53,height:2.35},4600,.49],
  ['9989',assistedDowel,{rotation:true},'training-assist-dowel',['shoulder'],{...standCam,yaw:124},4800,.49],
  ['10736',headbanger,{},'pull-up',['biceps','lat','core'],{...pullCam,yaw:70},4800,.51],
  ['3318',highBarSwing,{},'pull-up',['lat','core','forearm'],{...pullCam,yaw:34,height:2.71},5900,.52],
];

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional exact catalogue IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or repeated assisted specialty ID.');
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
