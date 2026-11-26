import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, blend, body, cycle, foot, joint, ramp, sides } from "./catalogue-dumbbell-recipes.mjs";

const lateral = [1, 0, 0];
const down = [0, -1, 0];
const rest = .075;
const mix = (start,end,t) => start + (end-start)*t;

function route(phase, stops) {
  let i=1;
  while(i<stops.length-1 && phase>stops[i][0]) i++;
  const [start,a]=stops[i-1], [end,b]=stops[i];
  return blend(a,b,ramp(phase,start,end));
}

function hand(p,side,target,pole,grip=null) {
  [p[side+"e"],p[side+"w"]]=joint(p[side+"s"],target,pole,.252,grip?.371:.326);
  if(grip) p[side+"Grip"]=grip;
}

function bell(p,grip,handle=lateral,bodyDirection=down) {
  p.kettlebells=[{grip,handle,down:bodyDirection}];
}

function relay(p, center, received, orbits = false) {
  const targets={};
  for(const [side,sign] of sides) {
    const reach=Math.min(1,2.38*(side==="l"?received:1-received));
    const idle=orbits?add(p[side+"k"],[sign*.138,.119,.016]):add(p[side+"s"],[sign*.046,-.459,.092]);
    const shared=add(center,[sign*.030,0,0]);
    const fingers=blend(idle,shared,.94*reach+.06);
    hand(p,side,fingers,[sign*.72,-.34,.42],lateral);
    targets[side]=add(p[side+"w"],[-sign*.030,0,0]);
  }
  bell(p,blend(targets.r,targets.l,received));
}

function figureEight(phase) {
  const first=phase<.5;
  const sign=first?-1:1;
  const t=first?2*phase:2*phase-1;
  const point=route(t,[
    [0,[0,.552,.191]],[.17,[sign*.377,.568,.278]],[.34,[sign*.463,.578,.018]],
    [.58,[sign*.301,.573,-.186]],[.77,[sign*.024,.565,-.160]],[1,[0,.552,.191]],
  ]);
  const shifted=cycle(t,.33,.62);
  const pose=body([sign*.047*shifted,.721,-.164],1.019,.21*sign*shifted);
  for(const [side,sideSign] of sides) {
    foot(pose,side,sideSign,[sideSign*.311,rest,.060],[sideSign*.36,.08,.94],[sideSign*.034,-.072,.145]);
  }
  const switched=ramp(t,.66,.83);
  relay(pose,point,first?switched:1-switched,true);
  return pose;
}

function lungePass(phase) {
  const first=phase<.5;
  const lead=first?1:-1;
  const t=first?phase*2:(phase-.5)*2;
  const step=ramp(t,0,.26)*(1-ramp(t,.77,1));
  const depth=ramp(t,.15,.42)*(1-ramp(t,.57,.96));
  const hips=[lead*.038*depth,.885-.296*depth,.011+.254*step];
  const pose=body(hips,.048+.29*depth,.20*lead*depth);
  for(const [side,sign] of sides) {
    const forward=sign===lead;
    const ankle=[sign*.157,rest+(forward?.121*Math.sin(Math.PI*step):.058*depth),
      .04+(forward?.616*step:-.075*depth)];
    foot(pose,side,sign,ankle,[sign*.17,.04,.94],[sign*.02,-(ankle[1]-.007),.14]);
    if(forward || depth>0)delete pose.planted[side];
  }
  const grip=route(t,[
    [0,[0,1.174,.237]],[.25,[lead*.36,.788,.416]],[.37,[lead*.329,.506,.428]],
    [.49,[lead*.153,.451,.410]],[.60,[-lead*.105,.453,.414]],[.77,[-lead*.283,.716,.430]],
    [1,[0,1.174,.237]],
  ]);
  const pass=ramp(t,.43,.61);
  const take=ramp(t,0,.14)*(1-ramp(t,.86,1));
  relay(pose,grip,.5+(first?.5:-.5)*(1-2*pass)*take);
  return pose;
}

function kettlebellPlyo(phase) {
  const descent=ramp(phase,0,.28)*(1-ramp(phase,.30,.50))
    + .41*ramp(phase,.71,.79)*(1-ramp(phase,.80,1));
  const airborne=ramp(phase,.48,.58)*(1-ramp(phase,.60,.72));
  const support=.237;
  const pivotY=.136;
  const pivotZ=-1.142;
  const shoulderY=support+.527-.283*descent+.161*airborne;
  const pitch=Math.acos((shoulderY-pivotY)/1.341);
  const pose=body([0,pivotY+.832*Math.cos(pitch),pivotZ+.832*Math.sin(pitch)],pitch);
  pose.kettlebells=[];
  for(const [side,sign] of sides) {
    const grip=[sign*.212,support,.174];
    const hands=add(grip,[sign*.037*airborne,.134*airborne,-.045*airborne]);
    hand(pose,side,hands,[sign*.54,.10,-.73],lateral);
    pose.kettlebells.push({grip,handle:lateral,down});
    foot(pose,side,sign,[sign*.141,pivotY,pivotZ],[sign*.12,-.15,.84],[sign*.015,-.114,-.068]);
    delete pose.planted[side];
  }
  return pose;
}

function getUp(phase) {
  const t=phase<=.53?phase/.53:(1-phase)/.47;
  const [x,y,z,pitch,roll]=route(t,[
    [0,[0,.155,.039,-1.571,0]],[.14,[.025,.190,.025,-1.48,.22]],
    [.33,[-.019,.395,.021,-1.89,.41]],[.46,[-.065,.464,.010,-1.50,.73]],
    [.54,[-.056,.473,.009,-1.30,.67]],[.61,[.016,.506,.014,-.036,.22]],[.78,[0,.555,.216,.339,.02]],
    [1,[0,.883,.319,.016,0]],
  ]);
  const pose=body([x,y,z],pitch,0,roll);
  const supportLeft=route(t,[
    [0,[.153,.086,.786]],[.14,[.178,rest,.430]],[1,[.178,rest,.430]],
  ]);
  const supportRight=route(t,[
    [0,[-.164,.083,.791]],[.33,[-.164,.084,.790]],[.47,[-.268,.212,.141]],
    [.61,[-.225,.106,-.407]],[.67,[-.224,.158,-.352]],
    [.78,[-.186,rest,.426]],[1,[-.186,rest,.426]],
  ]);
  foot(pose,"l",1,supportLeft,[.17,.52,.86],[.022,-.072,.148]);
  const sweeping=ramp(t,.32,.42)*(1-ramp(t,.53,.63));
  const kneeling=ramp(t,.43,.60)*(1-ramp(t,.65,.74));
  const sweepPole=[-.15-.79*sweeping,mix(.66,-.89,Math.max(sweeping*.68,kneeling)),.73-.58*sweeping];
  foot(pose,"r",-1,supportRight,sweepPole,[-.023,-.077,.138]);
  if(t<.14)delete pose.planted.l;
  if(t<.76)delete pose.planted.r;
  hand(pose,"l",add(pose.ls,[.023,.603,.021]),[.83,-.17,-.13],lateral);
  const free=route(t,[
    [0,[-.513,.078,-.338]],[.33,[-.497,.080,-.221]],[.54,[-.458,.083,-.245]],
    [.59,[-.412,.257,.022]],[.65,[-.384,.527,.294]],[.78,[-.393,.604,.455]],
    [1,[-.245,.817,.287]],
  ]);
  hand(pose,"r",free,[-.76,-.23,.37]);
  pose.rFingers=[-.27,.01,.96];
  pose.rPalmSide=lateral;
  bell(pose,pose.lw,lateral,[0,-.68,-.733]);
  return pose;
}

function tireFlip(phase) {
  const turn=Math.PI*ramp(phase,.16,.70);
  const shift=.968*ramp(phase,.49,1);
  const y=.114*Math.abs(Math.cos(turn))+.484*Math.sin(turn);
  const center=[0,y,.865-.484*Math.cos(turn)];
  const [hx,hy,hz,pitch]=route(phase,[
    [0,[0,.832,-.481,.124]],[.16,[0,.451,-.497,.925]],[.35,[0,.654,-.192,.675]],[.44,[.014,.773,.136,.491]],
    [.53,[.032,.836,.284,.35]],[.65,[.042,.811,.494,.222]],[.74,[.024,.815,.410,.106]],
    [.84,[.017,.822,.449,.115]],
    [1,[0,.832,.487,.124]],
  ]);
  const pose=body([hx,hy,hz],pitch);
  pose.tireCenter=center;
  pose.tireAngle=turn;
  pose.followZ=shift;
  const contact=ramp(phase,.034,.159)*(1-ramp(phase,.47,.61));
  const pushGrip=ramp(turn,1.03,1.51);
  const localY=mix(.026,-.108,pushGrip);
  const localZ=mix(-.438,-.316,pushGrip);
  const handleY=center[1]+localY*Math.cos(turn)-localZ*Math.sin(turn);
  const handleZ=center[2]+localY*Math.sin(turn)+localZ*Math.cos(turn);
  for (const [side,sign] of sides) {
    const stance=route(phase,[
      [0,[sign*.163,rest,-.379]],[.32,[sign*.163,rest,-.379]],
      [sign===1?.43:.49,[sign*.166,.175,sign===1?.25:-.116]],
      [sign===1?.51:.58,[sign*.163,rest,sign===1?.473:.342]],
      [.70,[sign*.172,rest,sign===1?.650:.459]],[.81,[sign*.154,.159,sign===1?.807:.657]],
      [1,[sign*.163,rest,.589]],
    ]);
    foot(pose,side,sign,stance,[sign*.18,.084,.94],[sign*.019,-.070,.146]);
    if(stance[1]>rest+.003)delete pose.planted[side];
    const resting=add(pose[side+"s"],[sign*.083,-.531,.096]);
    const onTread=[sign*.191,handleY,handleZ];
    hand(pose,side,blend(resting,onTread,contact),[sign*.52,-.37,-.64]);
    pose[side+"Fingers"]=[sign*-.06,Math.sin(turn),Math.cos(turn)];
    pose[side+"PalmSide"]=lateral;
  }
  return pose;
}

const jobs=[
  ["0532","kettlebell-left",figureEight,["core","glute","forearm"],[32,19,[0,.76,.04],1.86],5400,.31],
  ["0536","kettlebell-left",lungePass,["quad","glute","hamstring"],[31,17,[0,.88,.22],2.03],6400,.26],
  ["0545","mat-kettlebells",kettlebellPlyo,["pec","triceps","core"],[59,19,[0,.56,-.40],1.68],3500,.59],
  ["0551","mat-kettlebell-left",getUp,["quad","glute","hamstring","core"],[52,14,[0,.94,.08],2.23],6500,.53],
  ["2459","spotter-tire-flip",tireFlip,["quad","glute","hamstring","core"],[59,15,[0,.84,.25],2.05],4200,.44],
];
const [directory,...selection]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
const requested=selection.length?jobs.filter(([id])=>selection.includes(id)):jobs;
if(!requested.length||selection.length&&requested.length!==selection.length)throw new Error("Invalid or duplicate catalogue IDs.");
const out=resolve(directory);
await mkdir(out,{recursive:true,mode:0o700});
const items=[];
for(const [id,equipment,motion,muscles,camera,durationMs,posterAt] of requested) {
  const [yaw,elevation,focus,height]=camera;
  const data={version:1,equipment,muscles,durationMs,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64)}))};
  try{prepareRecipe(data);}catch(error){throw new Error(id+": "+error.message,{cause:error});}
  const recipe=id+".json";
  await writeFile(join(out,recipe),JSON.stringify(data)+"\n");
  items.push({id,recipe,posterAt});
}
await writeFile(join(out,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"original kettlebell and tire recipes.");
