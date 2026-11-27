import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, inactive, lunge, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075;
const xAxis=[1,0,0], zAxis=[0,0,1];
function phaseAt(t,route){
  const i=route.findIndex(([end])=>t<=end);
  if(i<=0)return route[0][1];
  return blend(route[i-1][1],route[i][1],ramp(t,route[i-1][0],route[i][0]));
}
function heldBoth(p,contact,axis=xAxis){
  for(const [side,sign] of sides){
    arm(p,side,add(contact,[sign*.074,0,0]),[sign*.83,-.62,.13]);
    p[side+"Grip"]=axis;
  }
  p.dumbbells.push({center:scale(add(p.lw,p.rw),.5),axis});
}
function carry(p,mode="both"){
  for(const [side,sign] of sides){
    if(mode!=="both"&&mode!==side){inactive(p,side,sign);continue;}
    arm(p,side,add(p[side+"s"],[sign*.089,-.594,.009]),[sign*.41,-.27,-.68],zAxis);
  }
}

function deepSquat(t,{mode="high"}={}){
  const seated=mode==="side-seat";
  const wide=mode==="sumo";
  const heels=mode==="heel"||mode==="hack";
  const chop=mode==="chop";
  const u=cycle(t);
  const amount=seated?.369:.379;
  const yaw=chop?-.45+1.16*u:0;
  const p=body([seated?.249*u:0,.882+.032*Number(heels)-amount*u,.107-.185*u],.032+.245*u,yaw);
  for(const [side,sign] of sides){
    const point=[sign*(wide?.280:seated?.279:.171),floor+(heels?.021:0),heels?.023:.181];
    foot(p,side,sign,point,[sign*.19,.026,.99],[sign*.051,heels?-.091:-.073,.136]);
  }
  if(mode==="hack"){
    for(const [side,sign] of sides)arm(p,side,add(p[side+"s"],[sign*.067,-.592,-.189]),[sign*.65,-.29,-.50],zAxis);
  }else if(wide){
    heldBoth(p,add(p.hips,[0,-.225,.249]),[0,1,0]);
  }else if(chop){
    const lean=phaseAt(t,[[0,[0]],[.27,[0]],[.48,[.2]],[.66,[1]],[.79,[1]],[1,[0]]])[0];
    heldBoth(p,add(p.chest,blend([-.255,-.299,.252],[.206,.665,.15],lean)),blend(xAxis,zAxis,lean*.84));
  }else if(mode==="rail"){
    arm(p,"l",add(p.ls,[.066,-.589,.026]),[.46,-.66,-.12],zAxis);
    arm(p,"r",[-.51,1.108,.265],[-.72,-.39,-.16]);
    p.rGrip=zAxis;
  }else{
    heldBoth(p,add(p.chest,[0,.102,.244]));
  }
  return p;
}

function wallSquat(t){
  const amount=cycle(t);
  const p=body([0,.871-.412*amount,.002-.076*amount],-.13+.115*amount);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.166,floor,.521],[sign*.056,.141,.998]);
  carry(p);
  return p;
}
function clockSquat(t){
  const phase=t*3;
  const segment=Math.min(2,Math.floor(phase));
  const u=cycle(phase-segment);
  const lead=segment===2?"r":"l";
  const clock=[[0,0,.444],[.367,0,.224],[-.312,0,-.272]][segment];
  const p=body([clock[0]*u*.55,.880-.328*u,.048+clock[2]*u*.55],.030+.238*u);
  for(const [side,sign] of sides){
    const amplitude=side===lead?u:0;
    foot(p,side,sign,[sign*.160+clock[0]*amplitude,floor+.124*Math.sin(Math.PI*amplitude),.019+clock[2]*amplitude]);
  }
  heldBoth(p,add(p.chest,[0,.100,.239]));
  return p;
}

function splitLoad(t,{kind="long",single=false,cross=false}={}){
  if(kind==="rail"){
    const amount=cycle(t);
    const p=body([.053,.865-.301*amount,1.741+.056*amount],.051+.125*amount);
    foot(p,"l",1,[.238,floor,2.146]);
    foot(p,"r",-1,[-.115,.489,1.376],[-.18,-.05,.99],[-.023,-.058,-.121]);
    p.planted.r=.427;
    carry(p,"l");
    arm(p,"r",[-.515,1.145,1.955],[-.78,-.39,-.19]);
    p.rGrip=zAxis;
    return p;
  }
  const lowered=kind==="deficit"||kind==="reverse-step";
  const decline=kind==="decline";
  const unstable=kind==="bosu";
  const twin=kind==="twin";
  const doubleSlide=kind==="reverse-step"||twin;
  const depth=cycle(t);
  const leadToe=unstable?.185:lowered||twin?.128:0;
  const frontZ=unstable?.374:.454;
  const upper=.88+leadToe*.41;
  const lean=kind==="long"||kind==="hinge";
  const step=doubleSlide?ramp(t,0,.23)*(1-ramp(t,.73,1)):1;
  const rise=kind==="hinge"?.064:kind==="glute"?.287:.315;
  const center=kind==="reverse-step"?.321-.189*depth:(lean?-.143:-.075)+.079*depth;
  const p=body([.033,upper-rise*depth,center],.036+(kind==="hinge"?1.023:lean?.39:.139)*depth);
  for(const [side,sign] of sides){
    const left=side==="l";
    const frontH=twin?leadToe*step:leadToe;
    const y=left?floor+frontH+(twin?.108*Math.sin(step*Math.PI):0):
      unstable?.130:kind==="reverse-step"?floor+leadToe*(1-step)+.125*Math.sin(step*Math.PI):twin?.251:decline?.55:.489;
    const z=left?twin?.117+.311*step:frontZ:kind==="reverse-step"?.421-.912*step:decline?1.435:-.443;
    foot(p,side,sign,[sign*(lean?.128:.140),y,z],[sign*.102,-.025,.994],[sign*.023,left?-.069:unstable?-.125:decline?-.092:-.062,left?.149:-.127]);
    if(left&&frontH>0)p.planted.l=frontH;
    if(!left&&!unstable&&kind!=="reverse-step")p.planted.r=twin?.184:decline?.46:.427;
    if(!left&&kind==="reverse-step"&&step<.002)p.planted.r=leadToe;
  }
  if(kind==="hinge"){
    for(const [side,sign] of sides)arm(p,side,add(p[side+"s"],[sign*.077,-.611,.021]),[sign*.40,-.52,-.59],zAxis);
  }else{
    carry(p,single?cross?"r":"l":"both");
  }
  return p;
}

function rowHinge(t,{mode="rdl"}={}){
  const u=ramp(t,0,.22)*(1-ramp(t,.79,1));
  const curl=ramp(t,.21,.46)*(1-ramp(t,.57,.78));
  const bench=mode==="bench";
  const hyper=mode==="support";
  const seat=mode==="seat";
  if(seat){
    const p=fromSupport("seat",{pitch:.02+.924*u});
    heldBoth(p,add(p.chest,[0,.086,.208]));
    return p;
  }
  const throwDown=bench?.427:0;
  const centerZ=bench?1.166:hyper?-.104:.026;
  const p=body([bench?.104:0,.883+throwDown-(bench?.109:mode==="conventional"?.21:.065)*u,centerZ-(bench?.124:hyper?.118:.240)*u],.036+(bench?1.926:mode==="conventional"?.892:1.196)*u);
  for(const [side,sign] of sides){
    foot(p,side,sign,[p.hips[0]+sign*.166,floor+throwDown,centerZ+(bench?.145:.059)],[sign*.17,.125,.938]);
    if(bench)p.planted[side]=throwDown;
    const depth=bench||hyper?0:curl;
    const target=add(p[side+"s"],blend([sign*.075,-.603,.080],[sign*.045,-.147,-.329],depth));
    arm(p,side,target,[sign*.45,-.22,-.70],zAxis);
  }
  return p;
}

function hipFrog(t){
  const u=cycle(t);
  const p=body([0,.145+.279*u,.031-.131*u],-Math.PI/2-.57*u);
  p.planted={};
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.076,.094,.500],[sign*.94,.47,.27],[sign*-.128,-.066,.067]);
    arm(p,side,add(p.hips,[sign*.100,.112,.041]),[sign*.75,.18,.24]);
    p[side+"Grip"]=xAxis;
  }
  p.dumbbells.push({center:add(p.hips,[0,.157,.051]),axis:xAxis});
  return p;
}

function pullBridge(t){
  const u=cycle(t);
  const p=body([0,.528-.217*u,.324+.129*u],-1.62+.419*u);
  p.ballCenter=[0,.285,-.031];
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.188,floor,.783],[sign*.18,.94,.39]);
  const target=add(p.chest,[0,.61-.497*u,.068-.616*u]);
  heldBoth(p,target);
  return p;
}

function lungeMix(t,{mode="raise"}={}){
  if(mode==="walking") {
    const half=t<.5?t*2:(t-.5)*2;
    const step=t<.5?0:1;
    const base=-.601+.601*step;
    const depth=phaseAt(half,[[0,[0]],[.18,[0]],[.42,[1]],[.57,[1]],[.95,[0]],[1,[0]]])[0];
    const travel=ramp(half,.10,.91);
    const p=body([0,.882-.281*depth,base+.601*travel],.026+.102*depth);
    for(const [side,sign] of sides){
      const moving=(step===0)===(side==="l");
      const advance=ramp(half,0,.31);
      const z=moving?base+.601*(advance*(1+step)-step):base;
      const lift=moving?.132*Math.sin(Math.PI*advance):.111*depth;
      foot(p,side,sign,[sign*.136,floor+lift,z]);
      arm(p,side,add(p[side+"s"],[sign*.048,.603,.057]),[sign*.70,-.29,-.39],zAxis);
    }
    return p;
  }
  if(mode==="lateral"){
    const time=t<.5?t*2:(t-.5)*2;
    const sign=t<.5?1:-1;
    const move=ramp(time,0,.23)*(1-ramp(time,.67,.98));
    const depth=ramp(time,.14,.40)*(1-ramp(time,.55,.81));
    const press=ramp(time,.55,.78)*(1-ramp(time,.82,1));
    const p=body([sign*.359*move,.88-.290*depth,.038-.179*depth],.037+.259*depth);
    for(const [side,polarity] of sides){
      foot(p,side,polarity,[polarity*.153+(polarity===sign?sign*.614*move:0),floor,.056]);
      arm(p,side,add(p[side+"s"],[polarity*.078,.069+.534*press,.168-.114*press]),[polarity*.74,-.58,.28],zAxis);
    }
    return p;
  }
  const part=t<.5?t*2:(t-.5)*2;
  const u=cycle(part);
  const front=mode==="transverse";
  const p=lunge(t,{form:"reverse"});
  if(front){
    const choose=t<.5?"l":"r";
    const sign=choose==="l"?1:-1;
    const step=ramp(part,0,.22)*(1-ramp(part,.72,1));
    foot(p,choose,sign,[sign*(.146-.332*step),floor+.120*u+.079*Math.sin(Math.PI*step),.042-.514*step],[sign*.17,.102,.93],
      [sign*.035,-.070-.120*u,.139]);
    return p;
  }
  p.dumbbells=[];
  const press=ramp(part,.45,.79)*(1-ramp(part,.84,1));
  for(const [side,sign] of sides){
    if(mode==="press"&&side==="r"){inactive(p,side,sign);delete p.rGrip;continue;}
    const start=mode==="press"?[sign*.110,.057,.184]:[sign*.070,-.601,.051];
    const end=mode==="raise"?[sign*.071,.035,.606]:mode==="press"?[sign*.043,.605,.058]:[sign*.051,-.134,-.331];
    arm(p,side,add(p[side+"s"],blend(start,end,mode==="press"?press:u)),[sign*.65,-.47,-.39],mode==="raise"?xAxis:zAxis);
  }
  return p;
}

function calfContact(t,{groundWeight=false,walking=false}={}){
  const u=cycle(t);
  if(walking){
    const p=body([0,.949+.020*Math.abs(Math.sin(2*Math.PI*t)),0],.024);
    for(const [side,sign] of sides){
      const f=(t+(sign<0?.5:0))%1;
      const down=f<.58;
      const stride=down?(.5-f/.58):((f-.58)/.42-.5);
      const y=.152+(down?0:.138*Math.sin((f-.58)*Math.PI/.42));
      foot(p,side,sign,[sign*.131,y,stride*.526],[sign*.14,.16,.93],[sign*.022,down?-.142:-.156,.126]);
    }
    carry(p);
    return p;
  }
  const p=body([0,.883+(groundWeight?.124:.087)*u,.033],.036);
  const onWeight=groundWeight?.07:0;
  for(const [side,sign] of sides){
    const working=groundWeight?side==="l":side==="r";
    const y=working?floor+(groundWeight?-.019:.0)+(groundWeight?.148:.091)*u:.351;
    const z=working?.201-.064*u:-.302;
    foot(p,side,sign,[sign*.154,y,z],[sign*.13,-.08,.943],[sign*.024,working?onWeight+.006-y:-.084,.139+.042*u]);
  }
  const support=groundWeight?[-.51,1.108,.27]:[-.519,1.087,.075];
  arm(p,"r",support,[-.78,-.31,.13]);
  p.rPalmSide=[1,0,0];
  if(groundWeight){
    inactive(p,"l",1,"thigh");
    p.dumbbells.push({center:[.177,.070,.340],axis:xAxis});
  } else arm(p,"l",add(p.ls,[.069,-.608,.052]),[.55,-.51,-.14],zAxis);
  return p;
}

function stepLoad(t,{side=false,over=false,bench=false,drive=false,reverse=false,jump=false,kneel=false,glute=false}={}){
  const walk=over||side;
  const lift=drive||reverse?1:ramp(t,0,.23)*(1-ramp(t,.77,1));
  const top=kneel?cycle((t-.32)/.62,.47,.64):cycle(t,.40,.58);
  const raised=bench?.427:side?.118:.294;
  const spring=jump?ramp(t,kneel?.34:.12,kneel?.61:.39)*(1-ramp(t,kneel?.71:.57,.94)):0;
  const walkX=walk?(over?phaseAt(t,[[0,[-.57]],[.49,[0]],[1,[.57]]])[0]:-.561+.518*top):0;
  const crouch=kneel?ramp(t,0,.29):1;
  const rise=jump?.194*Math.sin(spring*Math.PI):0;
  const centerZ=walk?.458:bench?.630:.109;
  const p=body([walkX,.879+raised*top-.105*lift*(1-top)+rise-(kneel?.377*(1-crouch):0),centerZ+(walk?0:.437*top)],
    (glute?.101:.043)+(glute?.291:.242)*lift*(1-top));
  for(const [name,sign] of sides){
    const active=name==="l";
    const progression=jump?spring:active?lift:drive?0:ramp(t,.30,.49)*(1-ramp(t,.56,.76));
    const x=walk?active?-.06-.44*(1-progression):-.155+walkX:sign*.138;
    const point=[x,floor+raised*progression+.155*Math.sin(Math.PI*progression)+(drive&&!active?.747*top:0),
      walk?.453:bench?.619+.494*progression+(drive&&!active?.616*top:0):.088+.456*progression];
    if(over&&t>.50)point[0]=walkX+sign*.130;
    if(kneel&&t<.23){point[1]=.092;point[2]=centerZ-.353*(1-crouch);}
    foot(p,name,sign,point,[sign*.11,kneel&&t<.23?-.825:.12,.944]);
    if(progression>.995)p.planted[name]=raised;
    if(reverse&&!active){
      const dipped=cycle(t,.71,.78);
      p[name+"a"][2]-=.338*dipped;
      p[name+"t"][2]-=.338*dipped;
    }
    if(drive){
      const angle=.105+2.358*top;
      p[name+"e"]=add(p[name+"s"],[sign*.073,-.235,.034]);
      p[name+"w"]=add(p[name+"e"],[0,-.371*Math.cos(angle),.371*Math.sin(angle)]);
      p[name+"Grip"]=xAxis;
      p.dumbbells.push({center:p[name+"w"],axis:xAxis});
    }else arm(p,name,add(p[name+"s"],[sign*.069,-.598,.037+rise*.48]),[sign*.67,-.45,-.21],zAxis);
  }
  return p;
}

const floorCam=[58,15,[0,.92,.04],2.19];
const stepCam=[60,17,[0,1.04,.47],2.43];
const splitCam=[64,17,[0,.89,.12],2.15];
const jobs=[];
function group(ids,motion,args,equipment,muscles,view=floorCam,durationMs=4200,posterAt=.47){
  for(const id of ids.split(" "))jobs.push({id,motion,args,equipment,muscles,view,durationMs,posterAt});
}
group("4030",deepSquat,{mode:"sumo"},"dumbbell",["quad","glute","adductor"]);
group("9690",deepSquat,{mode:"heel"},"squat-plates-dumbbell",["quad","glute"]);
group("7566",deepSquat,{mode:"hack"},"squat-plates-dumbbells",["quad","glute"],[103,16,[0,.87,-.08],2.16]);
group("4752",deepSquat,{mode:"side-seat"},"bench-side-dumbbell",["quad","glute"],[52,17,[.20,.86,.06],2.19]);
group("2804",deepSquat,{mode:"rail"},"raise-brace-dumbbell",["quad","glute"],[53,14,[-.15,.90,.11],2.15]);
group("5108",deepSquat,{mode:"chop"},"dumbbell",["quad","glute","core","shoulder"],[46,15,[0,.96,.07],2.29],4900,.69);
group("10191",clockSquat,{},"dumbbell",["quad","glute","adductor"],[43,15,[0,.88,.12],2.24],6300,.19);
group("1558",wallSquat,{},"wall-dumbbells",["quad","glute"],[62,13,[0,.85,.16],2.17]);
group("4443",splitLoad,{kind:"rail",single:true},"split-rail-dumbbell",["l:quad","l:glute"],[59,15,[-.10,.86,1.68],2.16]);
group("7550",splitLoad,{kind:"deficit"},"split-deficit-dumbbells",["l:quad","l:glute"],splitCam);
group("7598",splitLoad,{kind:"long",single:true,cross:true},"offset-bench-dumbbell",["l:glute","l:quad","core"],splitCam);
group("7590",splitLoad,{kind:"long"},"offset-bench-dumbbells",["l:glute","l:quad"],splitCam);
group("10865",splitLoad,{kind:"hinge"},"offset-bench-dumbbells",["l:glute","l:hamstring"],splitCam);
group("3710",splitLoad,{kind:"bosu"},"bosu-front-dumbbells",["l:glute","l:quad","core"],splitCam);
group("2796",splitLoad,{kind:"twin"},"split-twin-steps-dumbbells",["l:glute","l:quad"],splitCam);
group("2367 7326",splitLoad,{kind:"reverse-step"},"step-dumbbells",["l:glute","l:quad"],splitCam,5000,.47);
group("5232",rowHinge,{mode:"conventional"},"dumbbells",["hamstring","glute","lat"],floorCam,5500,.47);
group("4749",rowHinge,{},"dumbbells",["hamstring","glute","lat"],floorCam,5500,.47);
group("1556",rowHinge,{mode:"bench"},"bench-dumbbells",["hamstring","glute"],[62,15,[.1,1.06,1.03],2.33]);
group("9515",rowHinge,{mode:"seat"},"bench-dumbbell",["hamstring","glute","core"],[59,15,[.10,.76,1.37],1.82]);
group("6160",hipFrog,{},"mat-dumbbell",["glute","adductor"],[56,26,[0,.34,.12],1.59]);
group("1294",pullBridge,{},"stability-ball-dumbbell",["glute","lat"],[58,23,[0,.55,.23],1.90],5300,.47);
group("4865",lungeMix,{mode:"walking"},"dumbbells",["quad","glute","shoulder"],[62,16,[0,1.00,-.18],2.47],6200,.26);
group("4161",lungeMix,{mode:"raise"},"dumbbells",["quad","glute","shoulder"],floorCam,5550,.24);
group("10096",lungeMix,{mode:"press"},"dumbbell",["quad","glute","l:shoulder"],[54,16,[0,1.05,.04],2.41],5900,.36);
group("4753",lungeMix,{mode:"lateral"},"dumbbells",["quad","glute","shoulder"],[35,15,[0,1.00,.03],2.42],6150,.23);
group("4758",lungeMix,{mode:"row"},"dumbbells",["quad","glute","lat"],floorCam,5700,.24);
group("1696",lungeMix,{mode:"transverse"},"dumbbells",["quad","glute","adductor"],[27,15,[0,.89,.06],2.19],5500,.24);
group("5698",calfContact,{walking:true},"dumbbells",["calf"],[57,15,[0,.92,.03],2.14],3450,.29);
group("3713",calfContact,{},"calf-wall-dumbbell",["r:calf"],[51,16,[-.13,.90,.09],2.15]);
group("0727",calfContact,{groundWeight:true},"assisted-calf-dumbbell-dumbbell",["l:calf"],[57,19,[-.10,.85,.15],2.08]);
group("5314",stepLoad,{bench:true,glute:true},"bench-dumbbells",["l:glute","l:quad"],[62,17,[.10,1.03,.92],2.41],5000,.51);
group("4821",stepLoad,{bench:true},"bench-dumbbells",["l:quad","l:glute"],[67,17,[.10,1.03,.92],2.41],5100,.52);
group("1684",stepLoad,{bench:true,drive:true},"bench-dumbbells",["l:quad","l:glute","biceps"],[63,16,[.10,1.08,.94],2.50],5000,.49);
group("2468",stepLoad,{side:true},"step-dumbbells",["l:quad","l:glute"],[53,17,[-.09,1.02,.48],2.21],5050,.48);
group("10987",stepLoad,{jump:true},"wide-step-dumbbells",["quad","glute","calf"],stepCam,4650,.45);
group("10988",stepLoad,{jump:true,kneel:true},"wide-step-dumbbells",["quad","glute","calf"],stepCam,6250,.47);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(jobs.map(({id})=>id)).size!==jobs.length)throw new Error("Duplicate catalogue IDs.");
const selected=wanted.length?jobs.filter(({id})=>wanted.includes(id)):jobs;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
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
