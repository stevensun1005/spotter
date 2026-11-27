import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, body, cycle, foot, ramp, scale, sides } from './catalogue-dumbbell-recipes.mjs';

const front = [0,0,1];
const up = [0,1,0];
const transverse = [1,0,0];
const floor = .075;

function putHeldDumbbell(pose, center, axis, gripAxis = transverse) {
  for (const [side,sign] of sides) {
    const contact=add(center,scale(gripAxis,sign*.043));
    arm(pose,side,contact,[sign*.67,-.48,.22]);
    pose[side+'Grip']=gripAxis;
  }
  pose.dumbbells.push({center:scale(add(pose.lw,pose.rw),.5),axis});
}

function stage(phase) {
  return { side:phase<.5?'l':'r', sign:phase<.5?1:-1, progress:(phase*2)%1 };
}

function straightLeg(pose,side,sign,angle,roll=0) {
  const direction=[Math.sin(roll)*Math.sin(angle),Math.cos(roll)*Math.sin(angle),Math.cos(angle)];
  pose[side+'k']=add(pose[side+'h'],scale(direction,.411));
  pose[side+'a']=add(pose[side+'k'],scale(direction,.413));
  pose[side+'t']=add(pose[side+'a'],[sign*.012,.121*Math.sin(angle)-.061*Math.cos(angle),.141*Math.cos(angle)+.061*Math.sin(angle)]);
  delete pose.planted[side];
}

function fixedFeet(pose, depth=.574, width=.168) {
  for(const [side,sign] of sides) foot(pose,side,sign,[sign*width,floor,depth],[sign*.24,.93,.32]);
}

function benchShins(pose) {
  for(const [side,sign] of sides){
    const x=.1+sign*.119;
    pose[side+'k']=[x,.545,.564];
    pose[side+'a']=[x+sign*.016,.543,.981];
    pose[side+'t']=[x+sign*.034,.675,1.039];
    delete pose.planted[side];
  }
}

function crunch(phase,{form='compact',full=false,bench=false}={}) {
  const twist=form==='twist';
  const turn=stage(phase);
  const t=twist?turn.progress:phase;
  const amount=cycle(t,.41,.59);
  const reach=full?1.575:form==='sweep'?.735:.540;
  const yaw=twist?turn.sign*.548*cycle(t,.52,.65)*ramp(t,.29,.51):0;
  const pose=body(bench?[.10,.143,.455]:[0,.143,-.028],-Math.PI/2+reach*amount,yaw);
  if(bench)benchShins(pose);
  else fixedFeet(pose);
  const overhead=add(pose.chest,add(scale(pose.up,.692),scale(pose.front,.135)));
  const straight=add(pose.chest,add([0,.653,.029],scale(pose.front,.098*amount)));
  const tucked=add(pose.chest,add(scale(pose.front,.156),scale(pose.up,.052)));
  const target=form==='compact'?tucked:form==='above'?overhead:form==='lift'?blend(overhead,straight,amount):
    form==='sweep'?blend(overhead,add(pose.chest,add(scale(pose.front,.554),scale(pose.up,-.052))),amount):straight;
  putHeldDumbbell(pose,target,form==='lift'?blend(pose.up,up,amount):form==='compact'?pose.up:transverse);
  return pose;
}

function twist(phase,{form='feet',press=false}={}) {
  const airborne=form==='raised'||form==='extended';
  const isBall=form==='ball';
  const rise=press?ramp(phase,.06,.24)*(1-ramp(phase,.32,.46)):0;
  const active=press?Math.max(0,(phase-.40)/.60):phase;
  const turn=(isBall?.99:.742)*Math.sin(2*Math.PI*active);
  const hips=isBall?[0,.562,.307]:[0,.149,-.229];
  const pose=body(hips,isBall?-1.445:-.544,isBall?0:turn,isBall?turn*.88:0);
  if(isBall)pose.ballCenter=[0,.285,-.090];
  for(const [side,sign] of sides){
    if(form==='extended') straightLeg(pose,side,sign,.173);
    else {
      const y=airborne?.254:floor;
      foot(pose,side,sign,[sign*.165,y,isBall?.654:.445],[sign*.16,.924,.322]);
      if(airborne)delete pose.planted[side];
    }
  }
  if(press){
    for (const [side,sign] of sides){
      const rack=add(pose[side+'s'],add([sign*.093,.077,0],scale(pose.front,.172)));
      const high=add(pose[side+'s'],[sign*.041,.595,.068]);
      arm(pose,side,blend(rack,high,rise),[sign*.73,-.45,.21],front);
    }
  } else {
    const depth=Math.abs(Math.sin(2*Math.PI*active));
    const target=isBall?add(pose.chest,[.552*Math.sin(turn),.564*Math.cos(turn),.051]):
      add(pose.chest,add([0,.117-(airborne?.157:.067)*depth,0],scale(pose.front,.273+.086*depth)));
    putHeldDumbbell(pose,target,isBall?[Math.sin(turn),Math.cos(turn),0]:pose.right,pose.right);
  }
  return pose;
}

function tuck(phase,{twist=false,press=false}={}) {
  const turn=stage(phase);
  const t=twist?turn.progress:phase;
  const amount=cycle(t,.40,.58);
  const load=press?ramp(t,.11,.32)*(1-ramp(t,.67,.90)):0;
  const pose=body([0,.153,-.168],-.583+.384*amount,twist?turn.sign*.536*amount:0);
  for(const [side,sign] of sides){
    const angle=1.495-1.207*amount;
    const knee=add(pose[side+'h'],[sign*.028,.418*Math.cos(angle),.415*Math.sin(angle)]);
    const shin=1.46-.189*amount;
    const ankle=add(knee,[sign*.012,-.418*Math.cos(shin),.419*Math.sin(shin)]);
    pose[side+'k']=knee;
    pose[side+'a']=ankle;
    pose[side+'t']=add(ankle,[sign*.014,.073,.129]);
    delete pose.planted[side];
    if(press){
      const rack=add(pose[side+'s'],[sign*.109,.066,.197]);
      const high=add(pose[side+'s'],[sign*.045,.597,.056]);
      arm(pose,side,blend(rack,high,load),[sign*.65,-.61,.18],front);
    }
  }
  if(!press)putHeldDumbbell(pose,add(pose.chest,add(scale(pose.front,.221),scale(pose.up,.052))),pose.right,pose.right);
  return pose;
}

function pressSitUp(phase,{twist=false}={}) {
  const step=stage(phase);
  const t=twist?step.progress:phase;
  const curl=ramp(t,0,.34)*(1-ramp(t,.66,1));
  const press=ramp(t,.34,.53)*(1-ramp(t,.62,.77));
  const rotation=twist?step.sign*.484*cycle(t,.33,.43):0;
  const pose=body([0,.150,-.035],-Math.PI/2+1.54*curl,rotation);
  fixedFeet(pose);
  for(const [side,sign] of sides){
    const rack=add(pose[side+'s'],add(scale(pose.right,sign*.057),add(scale(pose.up,.125),scale(pose.front,.153))));
    const high=add(pose[side+'s'],[sign*.038,.602,.068]);
    arm(pose,side,blend(rack,high,press),[sign*.71,-.49,.188],pose.front);
  }
  return pose;
}

function vUp(phase,{alternate=false,oblique=false,touchToes=false}={}) {
  const leg=stage(phase);
  const amount=cycle(alternate||oblique?leg.progress:phase,.42,.58);
  const angle=-Math.PI/2+(alternate?1.13:1.20)*amount;
  const roll=oblique?leg.sign*.476*amount:0;
  const pose=body([0,.145,-.080],angle,oblique?leg.sign*.190*amount:0,roll);
  for(const [side,sign] of sides){
    const raised=alternate&&side!==leg.side?0:amount;
    straightLeg(pose,side,sign,.032+1.294*raised,roll*.42);
  }
  const open=add(pose.chest,add(scale(pose.up,.668),scale(pose.front,.093)));
  const shin=alternate?pose[leg.side+'a']:scale(add(pose.la,pose.ra),.5);
  const aiming=add(shin,[0,.063,touchToes?.116:-.086]);
  const center=blend(open,aiming,amount);
  if(!alternate) putHeldDumbbell(pose,center,transverse,pose.right);
  else for(const [side,sign] of sides){
    arm(pose,side,add(center,[sign*.096,0,0]),[sign*.70,-.40,-.28],transverse);
  }
  return pose;
}

function legIsolation(phase,{form}={}) {
  const turn=stage(phase);
  const amount=cycle(form==='wiper'?turn.progress:phase,.41,.58);
  const pose=body([0,.147,-.059],-Math.PI/2);
  for(const [side,sign] of sides){
    if(form==='tuck'){
      const angle=.944-.753*amount;
      const knee=add(pose[side+'h'],[sign*-.034,.415*Math.cos(angle),.415*Math.sin(angle)]);
      const ankle=add(knee,[sign*-.028,-.413*Math.cos(1.39+.41*amount),.412*Math.sin(1.39+.41*amount)]);
      pose[side+'k']=knee;
      pose[side+'a']=ankle;
      pose[side+'t']=add(ankle,[sign*.016,.103,.119]);
      delete pose.planted[side];
      arm(pose,side,[sign*.362,.050,-.323],[sign*.70,-.32,-.45]);
      pose[side+'Fingers']=[sign*.37,-.033,.928];
    } else straightLeg(pose,side,sign,1.545,form==='wiper'?turn.sign*.918*amount:side==='l'?.879*amount:0);
  }
  if(form==='tuck')pose.dumbbells.push({center:add(scale(add(pose.la,pose.ra),.5),[0,.031,.076]),axis:front});
  else putHeldDumbbell(pose,add(pose.chest,[0,.579,.046]),transverse);
  return pose;
}

function seatedMilitary(phase) {
  const current=stage(phase);
  const lift=cycle(current.progress);
  const pose=body([0,.148,-.212],-.327);
  for(const [side,sign] of sides){
    straightLeg(pose,side,sign,.026+(side===current.side?.419*lift:0));
    arm(pose,side,add(pose[side+'s'],[sign*.043,.598,.048]),[sign*.78,-.33,-.13],front);
  }
  return pose;
}

function lyingChop(phase) {
  const amount=cycle(phase,.42,.58);
  const pose=body([0,.153,-.042],-Math.PI/2+.347*amount,0,-.388*amount);
  fixedFeet(pose);
  const bottom=add(pose.rh,[-.136,.115,.114]);
  const top=add(pose.ls,[.127,.532,-.177]);
  putHeldDumbbell(pose,blend(bottom,top,amount),pose.right,pose.right);
  return pose;
}

function bridgePulloverPress(phase) {
  const bridge=ramp(phase,0,.23)*(1-ramp(phase,.84,1));
  const pullover=ramp(phase,.25,.43)*(1-ramp(phase,.53,.70));
  const push=ramp(phase,.68,.78)*(1-ramp(phase,.83,.94));
  const pose=body([0,.145+.247*bridge,.040-.064*bridge],-Math.PI/2-.531*bridge);
  fixedFeet(pose,.529);
  const angle=1.54*pullover;
  const center=add(pose.chest,[0,(.412+.172*push)*Math.cos(angle),.045-.531*Math.sin(angle)]);
  putHeldDumbbell(pose,center,transverse);
  return pose;
}

const mat = [63,23,[0,.50,.01],1.87];
const tall = [64,18,[0,.72,.01],2.06];
const seated = [57,22,[0,.53,.08],1.86];
const clips = [];
function group(ids,motion,options,muscles,camera=mat,durationMs=4150,posterAt=.47,equipment='mat-dumbbell') {
  for(const id of ids.split(' ')) clips.push({id,motion,options,muscles,camera,durationMs,posterAt,equipment});
}

group('3449',twist,{},['core'],seated,5000,.23);
group('4750',twist,{form:'raised'},['core'],seated,5200,.23);
group('4249',twist,{form:'extended'},['core'],[61,22,[0,.50,.14],1.91],5200,.23);
group('4041',twist,{form:'ball'},['core','glute'],[31,27,[0,.66,.24],2.00],5300,.23,'stability-ball-dumbbell');
group('6800 6806',twist,{form:'raised',press:true},['core','shoulder'],tall,6200,.23,'mat-dumbbells');
group('4625',pressSitUp,{twist:true},['core','shoulder','triceps'],tall,6450,.28,'mat-dumbbells');
group('4621',pressSitUp,{},['core','shoulder','triceps'],tall,4900,.56,'mat-dumbbells');
group('4626',tuck,{},['core'],seated);
group('4628',tuck,{twist:true},['core'],seated,5950,.24);
group('6801',tuck,{press:true},['core','shoulder'],tall,5700,.47,'mat-dumbbells');
group('6802',seatedMilitary,{},['core','shoulder'],tall,5700,.22,'mat-dumbbells');
group('4624',crunch,{},['core']);
group('4756',crunch,{full:true},['core'],tall);
group('4748',crunch,{full:true,form:'above'},['core','shoulder'],tall,4650);
group('6809',crunch,{full:true,form:'straight',bench:true},['core','shoulder'],[60,20,[.10,.68,.58],2.12],4800,.47,'bench-dumbbell');
group('4248 6144',crunch,{form:'straight'},['core','shoulder']);
group('4251',crunch,{form:'twist',full:true},['core','shoulder'],tall,6200,.26);
group('10873',crunch,{form:'lift'},['core','shoulder'],[61,22,[0,.57,-.09],1.94]);
group('10879',crunch,{form:'sweep'},['core','shoulder'],[61,22,[0,.57,-.09],1.94],4500);
group('8873',legIsolation,{form:'tuck'},['core'],mat);
group('4737',legIsolation,{form:'wiper'},['core'],[55,28,[.10,.63,.02],2.10],6000,.23);
group('11077',legIsolation,{form:'abduction'},['l:glute','core'],[54,26,[.08,.62,.02],2.04],5000);
group('3336',vUp,{},['core'],mat,4450);
group('4250',vUp,{touchToes:true},['core'],mat,4550);
group('6805',vUp,{alternate:true},['core'],mat,6200,.24,'mat-dumbbells');
group('6799',vUp,{oblique:true},['core'],[57,26,[0,.53,.08],1.95],6200,.24);
group('4747',lyingChop,{},['core','shoulder'],mat,4550);
group('10186',bridgePulloverPress,{},['glute','hamstring','lat','pec'],mat,5600);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error('Pass an output directory and optional catalogue IDs.');
const selected=wanted.length?clips.filter(({id})=>wanted.includes(id)):clips;
if(!selected.length||(wanted.length&&selected.length!==wanted.length))throw new Error('Invalid catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const items=[];
const failures=[];
for(const {id,motion,options,muscles,camera,durationMs,posterAt,equipment} of selected){
  const [yaw,elevation,focus,height]=camera;
  const data={version:1,equipment,durationMs,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,options)}))};
  try{
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(join(output,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe,posterAt});
  }catch(error){failures.push({id,error:error.message});}
}
await writeFile(join(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
