import {mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {assistedExercises, assistedGrip} from "../../skills/spotter-exercise-demo/lib/assisted-exercise-geometry.js";
import {prepareRecipe} from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["l",1],["r",-1]];
const add = (a,b) => a.map((value,i)=>value+b[i]);
const sub = (a,b) => a.map((value,i)=>value-b[i]);
const scale = (a,factor) => a.map((value)=>value*factor);
const size = (a) => Math.hypot(...a);
const unit = (a) => scale(a,1/size(a));
const dot = (a,b) => a.reduce((sum,value,i)=>sum+value*b[i],0);
const mix = (a,b,t) => a + t*(b-a);

function ease(t) {
  const weight=Math.max(0,Math.min(1,t));
  return weight*weight*(3-2*weight);
}

function cycle(phase) {
  return ease(phase/.42) * (1-ease((phase-.55)/.45));
}

function armJoint(shoulder, wrist, pole, upper=.255, lower=.371) {
  const delta=sub(wrist,shoulder);
  const distance=size(delta);
  if (distance < lower-upper+.001 || distance >= upper+lower) {
    throw new Error("Assistant grip outside elbow range ("+distance.toFixed(3)+" m).");
  }
  const direction=unit(delta);
  const projected=(upper**2+distance**2-lower**2)/(2*distance);
  const sideways=unit(sub(pole,scale(direction,dot(pole,direction))));
  return add(add(shoulder,scale(direction,projected)),scale(sideways,Math.sqrt(upper**2-projected**2)));
}

function pressPedal(config,t) {
  const hips=[-.073,config.supportFloor?.855:1.013,-.115];
  const joint=(length,x=0)=>add(hips,[x,length*Math.cos(.075),length*Math.sin(.075)]);
  const assistedPadY=config.supportFloor?mix(.578,.109,t):mix(.654,.217,t);
  const pose={hips,chest:joint(.377),neck:joint(.604),head:joint(.716),
    ls:joint(.488,.191),rs:joint(.488,-.191),lh:joint(0,.103),rh:joint(0,-.103),
    assistedPadY, planted:{r:config.supportFloor?0:.223}};
  for(const [side,sign] of sides) {
    const moving=sign>0;
    const ankle=moving?[.090,assistedPadY+.074,.013]:config.supportFloor?[-.351,.075,.127]:[-.439,.296,.207];
    pose[side+'k']=armJoint(pose[side+'h'],ankle,[sign*.14,.02,.98],.422,.424);
    pose[side+'a']=ankle;
    pose[side+'t']=add(ankle,[sign*.021,-.068,moving?.139:.111]);
    const grip=assistedGrip(config,sign);
    pose[side+'e']=armJoint(pose[side+'s'],grip,[sign*.65,-.73,-.04]);
    pose[side+'w']=grip;
    pose[side+'Grip']=[1,0,0];
  }
  return pose;
}

function poseAt(config,phase) {
  const t=cycle(phase);
  if(config.singleFoot) return pressPedal(config,t);
  const dip=config.grip==="dip";
  const height=dip?mix(1.371,.963,t):config.platform?mix(.945,1.423,t):mix(.933,1.415,t);
  const z=dip?mix(-.116,-.157,t):mix(-.048,-.093,t);
  const pitch=dip?config.forwardLean+(.055*t):mix(.024,-.092,t);
  const joint=(distance,x=0)=>[x,height+distance*Math.cos(pitch),z+distance*Math.sin(pitch)];
  const pose={
    hips:joint(0),chest:joint(.377),neck:joint(.604),head:joint(.716),
    ls:joint(.488,.191),rs:joint(.488,-.191),lh:joint(0,.103),rh:joint(0,-.103),planted:{},
  };
  const standing=config.platform;
  const kneeY=height-(standing?.408:.381);
  const ankleY=height-(standing?.818:.391);
  pose.assistedPadY=standing?ankleY-.067:kneeY-.054;
  for (const [side,sign] of sides) {
    const knee=[sign*.123,kneeY,standing?.061:.027];
    const ankle=[sign*.128,ankleY,standing?.012:-.384];
    pose[side+"k"]=knee;
    pose[side+"a"]=ankle;
    pose[side+"t"]=add(ankle,standing?[sign*.017,-.061,.146]:[sign*.013,-.079,-.123]);
    const wrist=assistedGrip(config,sign);
    const pole=dip?[sign*(config.forwardLean>.2?.67:.18),.115,-.934]:[sign*.68,-.67,-.67];
    pose[side+"e"]=armJoint(pose[side+"s"],wrist,pole);
    pose[side+"w"]=wrist;
    const neutral=config.grip==="neutral";
    const under=config.grip==="under";
    pose[side+"Grip"]=dip||neutral?[0,0,1]:under?[-1,0,0]:[1,0,0];
    pose[side+"Fingers"]=dip?[sign*-.10,-.99,0]:
      neutral?[sign*-.76,.615,.11]:under?[0,.81,-.59]:[0,-.82,.56];
  }
  return pose;
}

const back=["lat","biceps"];
const chest=["pec","triceps"];
const dip={yaw:103,elevation:11,height:2.29,focus:[0,1.05,.32]};
const pull={yaw:106,elevation:11,height:2.42,focus:[0,1.10,.35]};
const jobs=[
  ["0009","assist-chest-dip",chest,dip],
  ["0015","assist-neutral-pull",back,{...pull,yaw:117}],
  ["0017","assist-kneeling-pull",back,pull],
  ["1431","assist-standing-chin",back,{...pull,yaw:106}],
  ["1432","assist-standing-pull",back,{...pull,yaw:113}],
  ["0019","assist-triceps-dip",["triceps"],{...dip,yaw:115}],
  ["2364","assist-wide-chest-dip",chest,{...dip,yaw:130}],
  ["0572","assist-kneeling-chin",back,{...pull,yaw:108}],
  ["1222","assist-standing-close-chin",back,{...pull,yaw:113}],
  ["1028","assist-standing-triceps-dip",["triceps"],{...dip,yaw:113}],
  ["1027","assist-single-leg-press",["l:quad","l:glute"],{...pull,yaw:123,focus:[0,1.02,.34]}],
  ["2749","assist-single-leg-floor-press",["l:quad","l:glute"],{...pull,yaw:113,focus:[0,1.02,.34]}],
];

const [directory,...ids]=process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional exact catalogue IDs.");
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if (ids.length&&selected.length!==ids.length) throw new Error("Unknown or duplicate catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const items=[];
for (const [id,name,muscles,camera] of selected) {
  try {
    const config=assistedExercises[name];
    const data={version:1,durationMs:4200,equipment:name,camera,muscles,
      keyframes:Array.from({length:49},(_,index)=>({at:index/48,...poseAt(config,index/48)}))};
    prepareRecipe(data);
    const recipe=id+".json";
    await writeFile(resolve(output,recipe),JSON.stringify(data)+"\n");
    items.push({id,recipe,posterAt:.48});
  } catch(error) {
    throw new Error(id+": "+error.message,{cause:error});
  }
}
await writeFile(resolve(output,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"Spotter assisted machine recipes.");
