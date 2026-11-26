import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {armCrankGrip} from "../../skills/spotter-exercise-demo/lib/seated-ergometer-geometry.js";
import {prepareRecipe} from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides=[["r",-1],["l",1]];
const add=(a,b)=>a.map((part,i)=>part+b[i]);
const sub=(a,b)=>a.map((part,i)=>part-b[i]);
const scale=(a,factor)=>a.map((part)=>part*factor);
const dot=(a,b)=>a.reduce((sum,part,i)=>sum+part*b[i],0);
const length=(a)=>Math.hypot(...a);
const unit=(a)=>scale(a,1/length(a));

function controlledPull(phase) {
  const amount=(1-Math.cos(2*Math.PI*phase))/2;
  return amount*amount*(3-2*amount);
}

function hold(pose,side,sign,hand) {
  const shoulder=pose[side+"s"];
  const delta=sub(hand,shoulder);
  const distance=length(delta);
  const upper=.253;
  const lower=.372;
  if (distance >= upper+lower || distance <= lower-upper) throw new Error("Exercise handle is outside elbow reach.");
  const axis=unit(delta);
  const down=[sign*.288,-.965,-.43];
  const pole=unit(sub(down,scale(axis,dot(down,axis))));
  const along=(upper**2+distance**2-lower**2)/(2*distance);
  pose[side+"e"]=add(add(shoulder,scale(axis,along)),scale(pole,Math.sqrt(upper**2-along**2)));
  pose[side+"w"]=hand;
  pose[side+"Grip"]=[1,0,0];
  pose[side+"Fingers"]=[0,-.83,.56];
}

function movement(phase,ski) {
  const pull=controlledPull(phase);
  const torsoPitch=ski?.041+pull*.296:.058;
  const hip=[0,.566,-.052];
  const joint=(distance,x=0)=>[x,hip[1]+Math.cos(torsoPitch)*distance,hip[2]+Math.sin(torsoPitch)*distance];
  const pose={
    hips:hip,chest:joint(.365),neck:joint(.597),head:joint(.714),
    lh:joint(0,.107),rh:joint(0,-.107),ls:joint(.486,.191),rs:joint(.486,-.191),
    planted:{r:.08,l:.08},
  };
  if (!ski) pose.ergometerCrank=phase*4*Math.PI;
  for (const [side,sign] of sides) {
    pose[side+"k"]=[sign*.155,.521,.32];
    pose[side+"a"]=[sign*.157,.152,.334];
    pose[side+"t"]=[sign*.171,.084,.475];
    if (ski) {
      const angle=2.34-pull*1.87;
      const shoulder=pose[side+"s"];
      const hand=add(shoulder,[sign*.063,-.597*Math.cos(angle),.597*Math.sin(angle)]);
      hold(pose,side,sign,hand);
    } else {
      hold(pose,side,sign,armCrankGrip(sign,pose.ergometerCrank));
    }
  }
  return pose;
}

const jobs=[
  ["2139","ergometer-arms",["shoulder","biceps","forearm"],{yaw:71,elevation:14,height:1.82,focus:[0,.773,.32]},false],
  ["2142","ergometer-seated-ski",["lat","triceps","core"],{yaw:67,elevation:10,height:2.45,focus:[0,1.08,.35]},true],
];
const [directory,...ids]=process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional exact catalogue IDs.");
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if (ids.length&&selected.length!==ids.length) throw new Error("Unknown or duplicate catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const items=[];
for (const [id,equipment,muscles,camera,ski] of selected) {
  try {
    const data={version:1,durationMs:4200,equipment,camera,muscles,
      keyframes:Array.from({length:49},(_,index)=>({at:index/48,...movement(index/48,ski)}))};
    prepareRecipe(data);
    const recipe=id+".json";
    await writeFile(resolve(output,recipe),JSON.stringify(data)+"\n");
    items.push({id,recipe,posterAt:ski?.48:.324});
  } catch(error) {
    throw new Error(id+": "+error.message,{cause:error});
  }
}
await writeFile(resolve(output,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"seated Spotter ergometer recipes.");
