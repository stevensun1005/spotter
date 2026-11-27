import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, joint, ramp, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075;
function route(t,stops){
  const index=stops.findIndex(([end])=>end>=t);
  return index>0?blend(stops[index-1][1],stops[index][1],ramp(t,stops[index-1][0],stops[index][0])):stops[0][1];
}

function prop(p,side,center,axis=[0,0,1],touch=true){
  p.dumbbells.push({center,axis});
  if(touch)p[side+"Grip"]=axis;
}

function plank(t,{form="row",under=false}={}){
  const bear=form==="bear";
  const ball=form==="ball";
  const walking=form==="walk";
  const push=form==="push-row"||form==="deep-row"||form==="push-reach"||form==="press";
  const row=!["press","reach","opposite","push-reach","side","drag"].includes(form);
  const reaches=["reach","opposite","push-reach","side"].includes(form);
  const drag=form==="drag";
  const unilateral=form==="reach"||form==="opposite"||form==="side";
  const activeTime=push?Math.max(0,(t-.33)/.67):t;
  const fraction=unilateral?activeTime:activeTime<.5?activeTime*2:(activeTime-.5)*2;
  const active=unilateral||activeTime<.5?"l":"r";
  const pulse=cycle(fraction);
  const movement=form==="press"?cycle(t):push?cycle(t/.34):0;
  const transfer=route(fraction,[[0,[0]],[.23,[0]],[.75,[1]],[1,[1]]])[0];
  const travel=walking?route(t,[[0,[0]],[.17,[0]],[.34,[1]],[.55,[1]],[.80,[2]],[1,[2]]])[0]:0;
  const hipsY=bear?.510:ball?.654:drag?.550:.547-(form==="deep-row"?.337:.298)*movement;
  const ankleY=ball?.634:.111;
  const stance=bear?.160:drag?.256:.214;
  const reach=Math.sqrt(.839**2-(hipsY-ankleY)**2-(stance-.103)**2);
  const z=bear?-.395:ball?-.455:-1.105+reach;
  const room=walking?-.30+.28*travel:0;
  const pitch=bear?1.50:ball?1.68:1.472+.138*movement;
  const roll=drag?.059*(active==="l"?1:-1)*pulse:0;
  const p=body([drag?.028*(active==="l"?1:-1)*pulse:0,hipsY,z+room],pitch,0,roll);
  p.planted={};
  if(ball)p.ballCenter=[0,.285,-1.285];
  for(const [side,sign] of sides){
    const feetBack=side==="r"&&form==="opposite"?pulse:0;
    const ankle=[sign*stance,ankleY+.155*feetBack,(bear?-.820:ball?-1.281:-1.105)+room-.043*feetBack];
    const pole=bear?[sign*.12,-.85,.51]:[sign*.18,.43,.13];
    [p[side+"k"],p[side+"a"]]=joint(p[side+"h"],ankle,pole,.422,.424);
    p[side+"t"]=add(p[side+"a"],[sign*.020,ball?-.078:-.103,.103]);
    const base=[sign*.243,.070,.228+room];
    const bell=drag?[(active==="l"?1:-1)*(-.433+.866*transfer),.071,.165]:base;
    const restGrip=under?[sign,.04,0]:[0,0,1];
    let grip=restGrip;
    let target=base;
    if(side===active){
      if(row)target=blend(base,add(p[side+"s"],[sign*.069,-.115,-.361]),pulse);
      if(reaches)target=blend(base,add(p[side+"s"],form==="side"?[sign*.599,-.019,.036]:[sign*.031,.063,.609]),pulse);
      if(reaches)grip=blend(restGrip,form==="side"?[0,0,1]:[1,0,0],pulse);
      if(drag)target=blend(base,bell,route(fraction,[[0,[0]],[.23,[1]],[.75,[1]],[1,[0]]])[0]);
    }
    const elbowPole=[sign*(form==="press"?.198:.65),-.10,-.72];
    if(drag||unilateral&&side==="r"){
      arm(p,side,target,elbowPole);
      p[side+"Fingers"]=[sign*.17,-.059,.98];
      p[side+"PalmSide"]=[0,1,0];
      if(side===active&&drag)prop(p,side,bell,[0,0,1],pulse>.10);
    }else{
      arm(p,side,target,elbowPole,grip);
      if(!drag&&unilateral&&side==="l")p.lFingers=blend([0,.025,.99],[0,.07,1],pulse);
    }
  }
  return p;
}

function plankTransition(t,{finish="squat"}={}){
  const push=finish==="devil"||finish==="clean";
  const clean=finish==="clean";
  const devil=finish==="devil";
  const down=devil?route(t,[[0,[0]],[.13,[1]],[.64,[1]],[.82,[0]],[1,[0]]])[0]:
    route(t,[[0,[1]],[.45,[1]],[.66,[0]],[.80,[0]],[1,[1]]])[0];
  const torso=devil?route(t,[[0,[0]],[.25,[0]],[.35,[1]],[.53,[1]],[.68,[0]],[1,[0]]])[0]:
    route(t,[[0,[1]],[.45,[1]],[.64,[0]],[.87,[0]],[1,[1]]])[0];
  const pressDown=push?cycle(devil?(t-.35)/.20:t/.22):0;
  const inAir=down*(1-torso);
  const raising=devil?cycle((t-.66)/.34,.41,.58):clean?cycle((t-.58)/.30,.55,.72):0;
  const rack=clean?cycle((t-.46)/.48,.40,.76):0;
  const squat=finish==="squat"?cycle((t-.63)/.35):0;
  const p=body([0,.880-.342*down-.27*pressDown-.328*squat,-.324*torso-.119*down],.034+1.42*torso+.69*inAir);
  const rowTime=clean?Math.max(0,(t-.19)/.25):Math.max(0,t/.45);
  for(const [side,sign] of sides){
    const part=rowTime<.5?rowTime*2:(rowTime-.5)*2;
    const rowActive=!devil&&torso>.97&&((rowTime<.5)===(side==="l"));
    foot(p,side,sign,[sign*.185,.075+.14*Math.sin(torso*Math.PI),.099-1.16*torso],[sign*.14,.41,.17]);
    if(torso>.15)p[side+"t"]=add(p[side+"a"],[0,-.073,.098]);
    const hang=add(p[side+"s"],[sign*.073,-.603,.036]);
    const ground=blend([sign*.237,.071,.237],add(p[side+"s"],[sign*.054,-.116,-.361]),rowActive?cycle(part):0);
    const overhead=add(p[side+"s"],[sign*.057,.599,.048]);
    const racked=add(p[side+"s"],[sign*.09,.058,.178]);
    const contact=blend(blend(blend(hang,ground,down),racked,rack),overhead,raising);
    arm(p,side,contact,[sign*.62,-.45,-.42],[0,0,1]);
  }
  return p;
}

function sideCore(t,{holdAtHip=true,knees=false}={}){
  const amount=cycle(t,.25,.78);
  const p=body([0,.190+.205*amount,-.195],1.24+.314*amount,0,-Math.PI/2);
  p.planted={};
  for(const [side,sign] of sides){
    const ankle=[sign*.045,.105+.035*sign,knees?-.707:-.928];
    const pole=knees?[.25,-.247,-.89]:[.28,.20,.91];
    foot(p,side,sign,ankle,pole,[.125,-.065,.054]);
  }
  p.re=[-.148,.082,.284];p.rw=[.178,.077,.338];p.rFingers=[1,0,0];p.rPalmSide=[0,1,0];
  arm(p,"l",holdAtHip?add(p.lh,[.113,.085,.129]):add(p.ls,[.050,.603,.042]),[.73,-.21,-.61],[0,0,1]);
  return p;
}

function gymRollout(t){
  const u=cycle(t);
  const p=body([0,.387-.159*u,-.215+.382*Math.sqrt(u)],.940+.575*u);
  p.planted={};
  for(const [side,sign] of sides){
    p[side+"k"]=[sign*.161,.073,-.275];
    p[side+"a"]=[sign*.175,.108,-.655];
    p[side+"t"]=[sign*.179,.042,-.794];
    arm(p,side,[sign*.172,.077,.292+.852*u],[sign*.50,-.74,-.29],[1,0,0]);
  }
  return p;
}

function crossingBurpee(t,{holding=false}={}){
  const u=timedBurpee(t);
  const pos=holding?0:route(t,[[0,[0]],[.375,[0]],[.55,[.64]],[.901,[.64]],[1,[0]]])[0];
  const airtime=holding?u.hop:cycle((t-.375)/.175)+cycle((t-.901)/.099);
  const p=body([pos,.88-.384*u.fold-.221*u.press+.066*airtime,-.124-.351*u.extend],
    .041+.76*u.fold+.748*u.extend);
  p.planted={};
  for(const [side,sign] of sides){
    foot(p,side,sign,[pos+sign*.180,.075+.191*Math.sin(u.extend*Math.PI)+.151*airtime,.091-1.236*u.extend],
      [sign*.15,.43,-.271]);
    if(u.extend>.90)p[side+"t"]=add(p[side+"a"],[0,-.069,.116]);
    const home=add(p[side+"s"],[sign*.073,-.599,.046]);
    const point=[pos+sign*.246,.074,.214];
    arm(p,side,blend(home,point,u.fold),[sign*.69,-.29,-.59],holding?[0,0,1]:undefined);
    if(!holding){p[side+"Fingers"]=[0,-.08,.998];p[side+"PalmSide"]=[0,1,0];}
  }
  if(!holding)prop(p,"l",[.309,.073,.155],[0,0,1],false);
  return p;
}

function timedBurpee(t){
  const fold=route(t,[[0,[0]],[.16,[1]],[.35,[1]],[.47,[0]],[.56,[0]],[.68,[1]],[.87,[1]],[1,[0]]])[0];
  const extend=route(t,[[0,[0]],[.15,[0]],[.22,[1]],[.28,[1]],[.36,[0]],[.62,[0]],[.70,[1]],[.78,[1]],[.86,[0]],[1,[0]]])[0];
  const press=cycle((t-.19)/.15)+cycle((t-.67)/.15);
  const hop=cycle((t-.35)/.29);
  return {fold,extend,press,hop};
}

const camera=[64,21,[0,.39,-.34],1.53];
const exercise=[];
function group(ids,motion,args,equipment,muscles,view=camera,durationMs=4190,posterAt=.45){
  for(const id of ids.split(" "))exercise.push({id,motion,args,equipment,muscles,view,durationMs,posterAt});
}
group("10185",plank,{form:"bear"},"dumbbells",["lat","core","biceps"],[57,24,[0,.38,-.19],1.56],5500,.24);
group("4736",plank,{form:"deep-row"},"dumbbells",["pec","lat","core"],camera,6450,.19);
group("4627",plank,{form:"opposite"},"dumbbell",["l:shoulder","r:glute","core"],[66,22,[0,.40,-.17],1.67]);
group("4622",plank,{form:"reach"},"dumbbell",["l:shoulder","core"],[61,23,[0,.39,-.19],1.65]);
group("5497",plank,{form:"drag"},"dumbbell",["shoulder","core"],[48,25,[0,.41,-.29],1.63],5500,.23);
group("2980",plank,{},"dumbbells",["lat","biceps","core"],camera,5500,.24);
group("8223",plank,{form:"ball"},"stability-ball-dumbbells",["lat","core"],[66,22,[0,.48,-.48],1.73],5600,.24);
group("8225",plank,{form:"walk"},"dumbbells",["lat","core"],[65,23,[0,.38,-.31],1.84],5900,.32);
group("6151",plank,{form:"press"},"dumbbells",["pec","triceps"],camera,4000,.45);
group("6215",gymRollout,{},"mat-round-dumbbells",["core","lat"],[61,23,[0,.38,.21],1.70],4400,.45);
group("8222",plank,{under:true},"dumbbells",["lat","biceps","core"],camera,5500,.24);
group("3993",plank,{form:"push-reach"},"dumbbells",["pec","shoulder","core"],[63,23,[0,.39,-.18],1.61],6350,.49);
group("8221",plank,{form:"side"},"dumbbell",["l:shoulder","core"],[-13,32,[.13,.42,-.28],1.66]);
group("3337",sideCore,{},"mat-dumbbell",["core","glute"],camera,5300);
group("4457",sideCore,{knees:true},"mat-dumbbell",["core","glute"],camera,5300);
group("10041",sideCore,{holdAtHip:false},"mat-dumbbell",["core","l:shoulder"],[67,23,[0,.47,-.29],1.62],5500);
group("2961",plank,{form:"push-row"},"dumbbells",["pec","lat","core"],camera,6400,.20);
group("4629",plankTransition,{},"dumbbells",["lat","quad","core"],[61,18,[0,.77,-.40],2.06],6300,.48);
group("3886",plankTransition,{finish:"clean"},"dumbbells",["pec","lat","quad","shoulder"],[59,16,[0,.98,-.30],2.43],6480,.74);
group("4164",plankTransition,{finish:"devil"},"dumbbells",["pec","glute","shoulder"],[61,16,[0,.94,-.32],2.40],6450,.82);
group("10182",crossingBurpee,{},"dumbbell",["pec","quad","core"],[59,17,[.31,.79,-.37],2.18],6350,.49);
group("1201",crossingBurpee,{holding:true},"dumbbells",["pec","quad","core"],[61,16,[0,.79,-.37],2.19],6100,.29);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(exercise.map(({id})=>id)).size!==exercise.length)throw new Error("Duplicate catalogue IDs.");
const selected=wanted.length?exercise.filter(({id})=>wanted.includes(id)):exercise;
if(wanted.length!==0&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const {id,motion,args,equipment,muscles,view,durationMs,posterAt} of selected){
  const [yaw,elevation,focus,height]=view;
  const data={version:1,durationMs,equipment,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,n)=>({at:n/64,...motion(n/64,args)}))};
  try{prepareRecipe(data);}
  catch(error){failures.push({id,error:error.message});continue;}
  const recipe=id+".json";
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
