import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, torso, unit } from "./bodyweight/pose.mjs";

const feetOnMat = .025;
const camera = { yaw: 52, elevation: 25, focus: [0,.389,0], height: 1.68 };
const jobs = [];

function register(make, variants, angle = camera) {
  for (const [id, profile] of variants) jobs.push({ id, make, profile, angle });
}

function almostStraight(pose, side, sign, angle, spread = 0) {
  const end = add(pose[side + "h"], [spread,.825 * Math.sin(angle), .825 * Math.cos(angle)]);
  leg(pose,side,end,[sign * .13,.87,-.16],[.013 * sign,-.066 * Math.cos(angle),.131 * Math.cos(angle) + .081 * Math.sin(angle)]);
}

function floorFoot(pose, side, sign, z = .512, x = .141) {
  leg(pose,side,[sign*x,.103,z],[sign*.13,.81,.248],[sign*.012,-.073,.133],feetOnMat);
}

function placeArm(pose, side, sign, mode, t, bias = 0) {
  const s = pose[side + "s"];
  let end, pole = [sign*.79,.11,.48];
  if (mode === "head") {
    end = add(pose.head,[sign*.099,.022,-.022]);
    pole=[sign*.91,.40,-.14];
  } else if (mode === "chest") {
    end = add(pose.chest,[-sign*.135,.148,.025]);
  } else if (mode === "reach") {
    end = add(s,[-sign*(.039+.24*bias),mix(.59,.316,t),mix(.053,.419,t)]);
    pole=[sign*.49,.87,-.18];
  } else if (mode === "overhead") {
    end = add(s,[sign*.052,mix(.089,.276,t),mix(-.602,.54,t)]);
    pole=[sign*.69,.86,.31];
  } else if (mode === "under") {
    end = add(pose.hips,[sign*.048,-.070,-.077]);
  } else if (mode === "floor-wide") {
    end = [sign*.702,.083, -.36];
  } else if (mode === "toe") {
    end = add(pose[side+"a"],[sign*.043,.047,-.050]);
  } else {
    end = add(pose.hips,[sign*.234,-.063,.086]);
  }
  arm(pose,side,end,pole,mode==="head"?[0,-.14,-.96]:[0,-.032,1]);
}

function trunkCrunch(phase,profile) {
  const twoSides=profile.alternate!==false && (profile.twist || profile.single);
  const active=phase<.5?"r":"l";
  const t=rep(twoSides?(phase*2)%1:phase);
  const bend=profile.bend??.44;
  const lift=profile.tuck ? .089*t : 0;
  const yaw=profile.twist ? (active==="r"?1:-1)*(profile.elbow ? .76 : .49)*t : 0;
  const hips = [0,.157+lift,-.167];
  const pose = torso(hips, -Math.PI/2+bend*t+(profile.sitStart??0), yaw);
  for (const [side,sign] of sides) {
    const gesture=profile.legs;
    if (gesture==="frog") {
      const target=[sign*.056,.151,.384];
      leg(pose,side,target,[sign*.97,.24,-.104],[sign*-.088,-.036,.081],feetOnMat);
    } else if (gesture==="straight") {
      almostStraight(pose,side,sign,profile.angle??.027);
      if((profile.angle??0)<.12) floorFoot(pose,side,sign,.667,.122);
    } else if (gesture==="raisedStraight") {
      almostStraight(pose,side,sign,mix(profile.angle??1.14,profile.peak??1.54,t));
    } else if (gesture==="jack") {
      almostStraight(pose,side,sign,mix(.115,profile.peak??1.11,t),sign*(profile.split?.386*t:0));
    } else if (gesture==="frog-tuck"){
      legAngles(pose,side,sign,mix(.12,1.40,t),mix(.093,-.75,t),.048*t);
    } else if (gesture==="raisedBent") {
      const knee = profile.bicycle ? mix(.98,side===active?1.68:.185,t) : mix(1.31,1.88,t);
      const ankle=profile.bicycle ? mix(-.285,side===active?-.57:.155,t) : mix(-.406,profile.tuck?-1.34:-.557,t);
      legAngles(pose,side,sign,knee,ankle,.01);
    } else if (profile.single && side===active) {
      leg(pose,side,[sign*.141,mix(.103,.464,t),mix(.512,.220,t)],[sign*.14,.91,.16],[sign*.014,-.073,.133],
        t<.003?feetOnMat:undefined);
    } else if (gesture==="twisted") {
      const lateral = profile.otherSide ? -1 : 1;
      leg(pose,side,[lateral*.135+sign*.086,.103,.432],
        [lateral*.96,.43,.025],[sign*.009,-.073,.133],feetOnMat);
    } else floorFoot(pose,side,sign,profile.elbow ? .349 : .512);
  }
  for(const [side,sign] of sides){
    if(profile.oppositeHand&&side!==active){
      const start=add(pose.head,[sign*.102,.018,-.019]);
      arm(pose,side,blend(start,add(pose[active+"k"],[0,.024,-.038]),t),[sign*.75,.34,.47]);
    }else if(gestureIsFrog(profile)){
      const start=add(pose[side+"s"],[sign*.050,.078,-.576]);
      const goal=add(blend(pose[side+"k"],pose[side+"a"],.46),[sign*.041,.041,.007]);
      arm(pose,side,blend(start,goal,t),[sign*.56,.71,-.27]);
    }else if(profile.elbow&&side!==active){
      const s=pose[side+"s"];
      const lead=blend([sign*.19,.112,.112],subtract(pose[active+'k'],s),t);
      const length=Math.hypot(...lead);
      const elbow=add(s,lead.map(v=>v*.252/length));
      const target=add(pose.head,[sign*.085,.036,-.017]);
      const vector=target.map((v,i)=>v-elbow[i]);
      pose[side+"e"]=elbow;
      pose[side+"w"]=add(elbow,vector.map(v=>.369*v/Math.hypot(...vector)));
    }else placeArm(pose,side,sign,profile.hands??"head",t,profile.twist&&side!==active?t:0);
  }
  return pose;
}

function gestureIsFrog(profile){return profile.legs==="frog-tuck";}

function sideCrunch(phase, profile) {
  const t=rep(phase);
  const side=profile.left?-1:1;
  const plank=profile.plank;
  const top=side>0?"l":"r";
  const bottom=top==="r"?"l":"r";
  const y=plank? .532 + (profile.dip ? -.103*t : 0) : .135 + (profile.lift?.041*t:0);
  const angle=-Math.PI/2+.46*t*(plank?.15:1);
  const pose=torso([0,y,-.069],angle,side*(Math.PI/2-(plank?.14:.12)*t));
  pose.lh=[0,y+side*.100,-.068];
  pose.rh=[0,y+side*-.100,-.068];
  const high = profile.elbowKnee ? .39*t : profile.lift ? .37*t : .075*t;
  for(const [s,sign] of sides){
    const upper=s===top;
    const goal=plank ?
      [sign*.052+side*.285*(upper&&profile.elbowKnee?t:0),(upper?.206:.103)+(upper?high:0),.636-(upper&&profile.elbowKnee?.67*t:0)] :
      [sign*.073,(upper?.172:.103)+(profile.lift?high:0),.535-(profile.long?0:.074*t)];
    leg(pose,s,goal,upper?[.67*side,.29,.09]:[-.15*side,.70,.12],[sign*.01,-.073,.128],
      !upper&&(!profile.lift||plank)?feetOnMat:undefined);
    if(upper && profile.elbowKnee){
      const hip=pose[s+"h"];
      const kneeGuide=unit(blend(subtract(pose[s+"k"],hip),[side*.605,.245,-.743],t));
      const tibiaGuide=unit(blend(subtract(pose[s+"a"],pose[s+"k"]),[side*.175,-.83,.528],t));
      pose[s+"k"]=add(hip,scale(kneeGuide,.422));
      pose[s+"a"]=add(pose[s+"k"],scale(tibiaGuide,.424));
      pose[s+"t"]=add(pose[s+"a"],[side*.026,-.065,.126]);
    }
    if (plank && s===bottom) {
      pose[s+"e"]=[side*.127,.072,-.546];
      pose[s+"w"]=[side*.408,.056,-.322];
      pose[s+"Fingers"]=[side*.61,-.082,.71];
    } else if(profile.long&&s===bottom) {
      arm(pose,s,[side*.18,.082,-1.138],[side*.67,-.03,-.75],[0,-.023,-1]);
    } else if(profile.chest) placeArm(pose,s,sign,"chest",t);
    else if(profile.floorHand&&s===bottom) {
      arm(pose,s,[side*.332,.085,-.171],[side*.72,.014,.16]);
    } else if(profile.elbowKnee&&upper) {
      const shoulder=pose[s+"s"];
      const projected=add(pose[s+"k"],[side*.018,.029,-.030]);
      const mid=add(shoulder,[side*.075,.164,.029]);
      const elbow=blend(mid,projected,t);
      const ray=elbow.map((v,i)=>v-shoulder[i]);
      pose[s+"e"]=add(shoulder,ray.map(v=>.250*v/Math.hypot(...ray)));
      const rest=add(pose.head,[sign*.090,.027,-.035]);
      const toward=rest.map((v,i)=>v-pose[s+"e"][i]);
      pose[s+"w"]=add(pose[s+"e"],toward.map(v=>.372*v/Math.hypot(...toward)));
      pose[s+"Fingers"]=[0,-.028,-1];
    } else placeArm(pose,s,sign,"head",t);
  }
  return pose;
}

function deadBug(phase, profile) {
  const active=phase<.5?"r":"l";
  const section=(phase*2)%1;
  const tuck=profile.combo?rep(section,.22,.30)*(1-ramp(section,.31,.45)):0;
  const t=profile.combo?rep(Math.max(0,(section-.38)/.62)):rep(section);
  const pose=stand([0,.156+.102*tuck,-.103-.058*tuck],-Math.PI/2+.17*tuck);
  for(const [side,sign] of sides){
    const lead=side===active?t:0;
    if(profile.straight) almostStraight(pose,side,sign,mix(1.50,.139,lead));
    else {
      const knee=mix(1.52,.174,lead)+.33*tuck;
      const shin=mix(-.065,.131,lead)-.43*tuck;
      legAngles(pose,side,sign,knee,shin);
    }
    const swing=side===active?0:t;
    const angle=mix(Math.PI/2,Math.PI-.117,swing);
    const s=pose[side+"s"];
    arm(pose,side,add(s,[sign*.022,.594*Math.sin(angle),.594*Math.cos(angle)]),[sign*.56,.39,.56],[0,Math.sin(angle),Math.cos(angle)]);
  }
  return pose;
}

function bodyRoll(phase, profile) {
  const active=phase<.5?1:-1;
  const t=rep(profile.alternate?(phase*2)%1:phase);
  const sweep=profile.eight?Math.sin(phase*Math.PI*4):t*active;
  const hips = [0,profile.seated?.172:.155,-.112];
  const pitch=profile.seated?-.872+.195*t:-Math.PI/2;
  const pose=torso(hips,pitch,profile.upper ? .385*sweep : 0);
  for(const [side,sign] of sides){
    const drift=profile.scissor?sign*.34*Math.cos(phase*Math.PI*4):sweep*(profile.eight?.228:.548);
    const lifted=profile.eight?.66+.16*Math.cos(phase*Math.PI*2):profile.scissor?mix(.44,.84,t):mix(1.53,.81,t);
    almostStraight(pose,side,sign,lifted,drift);
    const mode=profile.seated?(profile.upper?"head":"rear"):"floor-wide";
    if(mode==="rear"){
      arm(pose,side,[sign*.234,.094,-.577],[sign*.52,-.38,-.44],[0,-.087,.99]);
    } else placeArm(pose,side,sign,mode,t);
  }
  return pose;
}

function standingCrunch(phase, profile) {
  const t=rep((phase*2)%1);
  const direction = phase<.5?1:-1;
  const pose=stand([-.081*direction*t,.886,.031],.053+(profile.cross?.18:0)*t,profile.cross?-.37*direction*t:0,.217*direction*t);
  for(const [side,sign] of sides){
    if(direction===sign){
      leg(pose,side,[sign*(profile.cross?.145:.428)*t+sign*.121,mix(.100,.489,t),.047+(profile.cross?.381:.099)*t],
        [sign*.584,.68,.52],[sign*.036,-.073,.129],t<.01?feetOnMat:undefined);
    }else floorFoot(pose,side,sign,.085,.151);
    placeArm(pose,side,sign,"head",t);
  }
  return pose;
}

register(trunkCrunch,[
  ["5265",{legs:"raisedBent",bicycle:true,twist:true,sitStart:.725,bend:.19}],
  ["5266",{legs:"raisedBent",twist:true,bend:.37}],
  ["0263",{twist:true,bend:.40}],
  ["3951",{twist:true,bend:1.31}],
  ["5334",{twist:true,bend:1.09}],
  ["3510",{legs:"frog-tuck",bend:.51,sitStart:.081}],
  ["3484",{twist:true,bend:1.95,elbow:true}],
  ["3889",{legs:"frog",bend:1.14}],
  ["0470",{single:true,bend:.47,oppositeHand:true}],
  ["0505",{legs:"jack",split:true,hands:"overhead",bend:.79}],
  ["6103",{legs:"jack",hands:"toe",bend:1.04,peak:1.49}],
  ["4990",{legs:"raisedBent",twist:true,tuck:true,bend:.54}],
  ["5032",{legs:"raisedStraight",twist:true,bend:.41}],
  ["3330",{legs:"raisedBent",tuck:true,twist:true,bend:.48}],
  ["3331",{legs:"raisedStraight",twist:true,bend:.50,angle:1.41,peak:1.57}],
  ["4992",{single:true,twist:true,bend:.52}],
  ["7255",{legs:"frog",bend:1.26,sitStart:.253,hands:"reach"}],
  ["0708",{legs:"twisted",bend:.39}],
  ["0718",{twist:true,bend:1.82,elbow:true}],
  ["4008",{legs:"straight",hands:"chest",bend:1.32}],
  ["5514",{legs:"raisedBent",twist:true,bend:.43}],
  ["0821",{twist:true,bend:1.13}],
  ["4620",{twist:true,bend:.45}],
  ["0823",{twist:true,hands:"reach",bend:.42}],
  ["3621",{twist:true,hands:"reach",bend:.47}],
  ["4002",{legs:"jack",hands:"overhead",bend:1.125,tuck:true,peak:1.18}],
  ["5963",{legs:"raisedStraight",hands:"chest",angle:1.567,peak:1.567,bend:.94}],
]);
register(sideCrunch,[
  ["3503",{plank:true,elbowKnee:true}],["6210",{plank:true,elbowKnee:true,left:true}],
  ["0707",{}],["4812",{floorHand:true}],["4787",{chest:true,lift:true}],
  ["4334",{plank:true,elbowKnee:true,dip:true}],["0719",{long:true}],
],{...camera,yaw:69,height:1.75});
register(deadBug,[["7839",{}],["4840",{straight:true}],["4097",{combo:true}]],{...camera,yaw:59,height:1.78});
register(trunkCrunch,[["3944",{legs:"raisedBent",bicycle:true,twist:true,sitStart:.735,bend:.26}]],{...camera,yaw:32,height:1.7});
register(bodyRoll,[
  ["4020",{scissor:true}],["3268",{alternate:true}],["4022",{eight:true,seated:true}],
],{...camera,yaw:33,elevation:30,height:1.83});
register(standingCrunch,[["5846",{cross:true}],["4366",{}]],
  {yaw:17,elevation:11,focus:[0,.916,.08],height:2.08});

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error("Pass the output directory and optionally the exact catalogue IDs.");
const active=ids.length?jobs.filter(({id})=>ids.includes(id)):jobs;
if(!active.length||(ids.length&&active.length!==ids.length))throw Error("Invalid or duplicate catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const {id,make,profile,angle} of active){
  try{
    const keyframes=Array.from({length:65},(_,i)=>({at:i/64,...make(i/64,profile)}));
    const durationMs = profile.alternate || profile.twist || make===deadBug || make===standingCrunch ? 5300 : 4260;
    const equipment=make===standingCrunch?"none":"mat";
    const recipe={version:1,equipment,durationMs,muscles:["core"],camera:angle,keyframes};
    prepareRecipe(recipe);
    await writeFile(resolve(output,id+".json"),JSON.stringify(recipe)+"\n");
    items.push({id,recipe:id+".json",posterAt:durationMs>5000?.24:.47});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(output,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
