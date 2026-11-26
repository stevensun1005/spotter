import {mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {leverPullGrip, leverPulls} from "../../skills/spotter-exercise-demo/lib/lever-pull-geometry.js";
import {prepareRecipe} from "../../skills/spotter-exercise-demo/lib/recipe.js";

const sides = [["r",-1],["l",1]];
const horizontal = [1,0,0];
const vertical = [0,1,0];
const mix = (a,b,t) => a + (b-a)*t;
const add = (a,b) => a.map((value,i) => value+b[i]);
const sub = (a,b) => a.map((value,i) => value-b[i]);
const scale = (a,k) => a.map((value) => value*k);
const size = (a) => Math.hypot(...a);
const unit = (a) => scale(a,1/size(a));
const dot = (a,b) => a.reduce((sum,value,i) => sum+value*b[i],0);
const clamp = (value,low,high) => Math.min(high,Math.max(low,value));

function smooth(value) {
  const phase = clamp(value,0,1);
  return phase*phase*(3-2*phase);
}

function rep(phase) {
  return smooth(phase/.43) * (1-smooth((phase-.55)/.45));
}

function seatedBody(config) {
  const pitch = config.chest ? .105 : config.overhead ? -.075 : .026;
  const hips = [0,.564,-.059];
  const joint = (height,width = 0) => [width,hips[1]+height*Math.cos(pitch),hips[2]+height*Math.sin(pitch)];
  const pose = {
    hips, chest:joint(.382), neck:joint(.610), head:joint(.717),
    ls:joint(.489,.192), rs:joint(.489,-.192), lh:joint(0,.105), rh:joint(0,-.105),
    planted:{r:config.platform?.10:0,l:config.platform?.10:0},
  };
  for (const [side,sign] of sides) {
    pose[side+"k"] = [sign*.154,.507,.348];
    pose[side+"a"] = [sign*.155,config.platform?.177:.071,config.platform?.453:.374];
    pose[side+"t"] = add(pose[side+"a"],[sign*.026,-.066,.147]);
  }
  return pose;
}

function bentOverBody() {
  const pitch=1.045;
  const hips=[0,.770,-.145];
  const joint=(height,width=0)=>[width,hips[1]+height*Math.cos(pitch),hips[2]+height*Math.sin(pitch)];
  const pose={
    hips,chest:joint(.382),neck:joint(.610),head:joint(.717),
    ls:joint(.489,.192),rs:joint(.489,-.192),lh:joint(0,.105),rh:joint(0,-.105),
    planted:{r:.052,l:.052},
  };
  for(const [side,sign] of sides){
    pose[side+"k"]=[sign*.233,.493,.101];
    pose[side+"a"]=[sign*.230,.121,.149];
    pose[side+"t"]=[sign*.258,.059,.293];
  }
  return pose;
}

function utilityBody(config,t) {
  const deadlift=config.utility==="deadlift";
  const hip=config.utility==="hip-extension";
  const shrug=config.utility==="shrug";
  const grip=config.utility==="gripper";
  const angle=mix(config.arc,config.close,t);
  const pitch=deadlift?mix(1.022,.035,t):hip?-.183:.035;
  const hips=deadlift?[0,mix(.751,.905,t),mix(-.209,-.012,t)]:[0,hip?.565:.567,hip?-.032:-.044];
  const joint=(headroom,x=0)=>[x,hips[1]+headroom*Math.cos(pitch),hips[2]+headroom*Math.sin(pitch)];
  const pose={
    hips,chest:joint(.382),neck:joint(.610),head:joint(.717),
    ls:joint(.489,.192),rs:joint(.489,-.192),lh:joint(0,.105),rh:joint(0,-.105),
    planted:hip?{}:{r:deadlift?.065:0,l:deadlift?.065:0},
  };
  for(const [side,sign] of sides){
    if(shrug) pose[side+"s"][1]+=.091*t;
    let knee,ankle,foot;
    if(hip){
      const pad=leverPullGrip(config,sign,angle);
      ankle=add(pad,[0,-.067,-.084]);
      const thigh=pose[side+"h"];
      const axis=unit(sub(ankle,thigh));
      const distance=size(sub(ankle,thigh));
      const first=.419;
      const second=.423;
      const along=(first**2+distance**2-second**2)/(2*distance);
      const above=unit(sub(vertical,scale(axis,dot(vertical,axis))));
      knee=add(add(thigh,scale(axis,along)),scale(above,Math.sqrt(first**2-along**2)));
      foot=add(ankle,[sign*.015,.153,.056]);
      hold(pose,side,[sign*.264,.657,.072],[sign*.822,-.505,-.141]);
      pose[side+"Grip"]=[0,0,1];
    }else{
      knee=deadlift?[sign*.147,mix(.606,.556,t),mix(.204,.091,t)]:[sign*.151,.516,.345];
      ankle=deadlift?[sign*.146,.136,.056]:[sign*.149,.072,.389];
      foot=add(ankle,[sign*.014,-.064,.145]);
      if(grip){
        pose[side+"e"]=[sign*.166,.819,.075];
        pose[side+"w"]=leverPullGrip(config,sign,angle);
        pose[side+"Grip"]=[1,0,0];
        pose[side+"Fingers"]=[0,mix(-.400,-.836,t),mix(.917,.546,t)];
      }else{
        hold(pose,side,leverPullGrip(config,sign,angle),[sign*.326,-.786,-.385]);
        pose[side+"Grip"]=deadlift?[0,0,1]:horizontal;
        pose[side+"Fingers"]=[0,-.824,.567];
      }
    }
    pose[side+"k"]=knee;
    pose[side+"a"]=ankle;
    pose[side+"t"]=foot;
  }
  pose.leverPullAngles=[angle,angle];
  return pose;
}

function supportedBenchBody(config) {
  const preacher=config.preacher;
  const pitch=preacher?.521:-.426;
  const hips=[0,.569,preacher?-.074:.019];
  const joint=(height,width=0)=>[width,hips[1]+height*Math.cos(pitch),hips[2]+height*Math.sin(pitch)];
  const pose={
    hips,chest:joint(.382),neck:joint(.610),head:joint(.717),
    ls:joint(.489,.192),rs:joint(.489,-.192),lh:joint(0,.105),rh:joint(0,-.105),
    planted:{r:preacher?0:.069,l:preacher?0:.069},
  };
  for(const [side,sign] of sides){
    pose[side+"k"]=[sign*.151,.505,.336];
    pose[side+"a"]=[sign*.149,preacher?.072:.137,preacher?.388:.417];
    pose[side+"t"]=add(pose[side+"a"],[sign*.014,-.064,.145]);
  }
  return pose;
}

function hold(pose, side, wrist, pole) {
  const shoulder = pose[side+"s"];
  const travel = sub(wrist,shoulder);
  const axis = unit(travel);
  const length = size(travel);
  const upper = .254;
  const lower = .371;
  if (length >= upper+lower || length <= Math.abs(upper-lower)) {
    throw new Error(side+" handle outside elbow reach ("+length.toFixed(3)+" m).");
  }
  const along = (upper**2 + length**2-lower**2)/(2*length);
  const sideward = unit(sub(pole,scale(axis,dot(pole,axis))));
  pose[side+"e"] = add(add(shoulder,scale(axis,along)),scale(sideward,Math.sqrt(upper**2-along**2)));
  pose[side+"w"] = wrist;
}

function poseFor(preset, phase, action) {
  const config = leverPulls[preset];
  if (config.utility) return utilityBody(config,rep(phase));
  const pose = config.tBar === "standing" ? bentOverBody()
    : config.preacher || config.pullover ? supportedBenchBody(config) : seatedBody(config);
  pose.leverPullAngles = sides.map(([side,sign]) => {
    const activeSide = phase < .5 ? "r" : "l";
    const timing = action === "alternating" ? (activeSide === side ? rep((phase*2)%1) : 0) : rep(phase);
    const rest = action === "right" && side === "l";
    const angle = mix(config.arc, config.close, rest ? 0 : timing);
    if (rest) {
      hold(pose,side,[sign*.242,.621,.306],[sign*.75,-.21,-.22]);
    } else {
      const hand = leverPullGrip(config,sign,angle);
      if(config.preacher){
        pose[side+"e"]=[sign*.208,config.pivotY,config.pivotZ];
        pose[side+"w"]=hand;
      }else{
        hold(pose,side,hand,[sign * (config.diagonal ? .98 : .63),-.64,-.71]);
      }
      pose[side+"Grip"] = config.tBar === "standing" ? [sign*.36,.064,.93] :
        config.neutral ? config.preacher ? [0,0,1] : vertical : config.under ? [-1,0,0] : horizontal;
      pose[side+"Fingers"] = config.neutral ? [sign*-.12,.06,.992] :
        config.under ? [0,.847,-.531] : [0,-.824,.567];
    }
    return angle;
  });
  return pose;
}

const lat = ["lat","biceps"];
const high = ["lat","rearShoulder"];
const topView = {yaw:113,elevation:14,height:2.25,focus:[0,1.06,.33]};
const sideView = {yaw:48,elevation:13,height:2.05,focus:[0,.86,.35]};
const jobs = [
  ["0579","lever-front-pull",lat,topView],
  ["0581","lever-high-row",high,{...topView,yaw:118}],
  ["1356","lever-one-arm-high-row",["r:lat","r:biceps"],{...topView,yaw:-115},"right"],
  ["1347","lever-wide-pull",["r:lat","r:biceps"],{...topView,yaw:-112},"right"],
  ["0673","lever-reverse-pull",lat,{...topView,yaw:115}],
  ["0571","lever-close-row",lat,{...sideView,yaw:28},"alternating"],
  ["0588","lever-close-row",lat,sideView],
  ["1348","lever-vertical-row",lat,{...sideView,yaw:32}],
  ["1350","lever-supported-row",high,sideView],
  ["2265","lever-plate-row",high,{...sideView,yaw:42}],
  ["3200","lever-bent-over-v",lat,{...sideView,yaw:57,focus:[0,.76,.37],height:1.86}],
  ["1349","lever-reverse-tbar",lat,{...sideView,yaw:44}],
  ["0606","lever-supported-tbar",high,{...sideView,yaw:47}],
  ["0592","lever-preacher-curl",["biceps"],{...sideView,yaw:69,height:1.80,focus:[0,.752,.27]}],
  ["1614","lever-preacher-supported",["biceps"],{...sideView,yaw:62,height:1.83,focus:[0,.752,.27]}],
  ["1615","lever-preacher-hammer",["biceps","forearm"],{...sideView,yaw:59,height:1.81,focus:[0,.752,.27]}],
  ["1616","lever-preacher-reverse",["forearm","biceps"],{...sideView,yaw:56,height:1.80,focus:[0,.752,.27]}],
  ["2285","lever-pullover",["lat","pec"],{...sideView,yaw:66,height:2.02,focus:[0,.900,.062]}],
  ["0578","lever-deadlift",["glute","hamstring","quad"],{...sideView,yaw:60,height:2.24,focus:[0,.995,-.13]}],
  ["0604","lever-seated-shrug",["trap"],{...sideView,yaw:54,height:1.80,focus:[0,.773,.15]}],
  ["2288","lever-hand-gripper",["forearm"],{...sideView,yaw:44,elevation:18,height:1.67,focus:[0,.765,.23]}],
  ["2286","lever-hip-footplate",["glute","hamstring"],{...sideView,yaw:66,height:2.07,focus:[0,.842,.27]}],
];

const [directory, ...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional exact catalogue IDs.");
const jobsToRun = requested.length ? jobs.filter(([id]) => requested.includes(id)) : jobs;
if (requested.length && requested.length !== jobsToRun.length) throw new Error("Unknown or duplicate catalogue IDs.");
const output = resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const items = [];
for (const [id,preset,muscles,camera,action] of jobsToRun) {
  try {
    const data = {version:1,durationMs:action==="alternating"?5400:4150,equipment:preset,muscles,camera,
      keyframes:Array.from({length:49},(_,index)=>({at:index/48,...poseFor(preset,index/48,action)}))};
    prepareRecipe(data);
    const recipe = id+".json";
    await writeFile(resolve(output,recipe),JSON.stringify(data)+"\n");
    items.push({id,recipe,posterAt:action==="alternating"?.242:.49});
  } catch (error) {
    throw new Error(id+": "+error.message,{cause:error});
  }
}
await writeFile(resolve(output,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"Spotter lever pull recipes.");
