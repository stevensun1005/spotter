import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,body,cycle,foot,scale,sides } from "./catalogue-dumbbell-recipes.mjs";
const up=[0,1,0], right=[1,0,0], floor=.075;
const mid=(a,b)=>scale(add(a,b),.5);
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
const direction=(a,b)=>unit(add(b,scale(a,-1)));
function mark(p){
  p.handRoller={center:mid(p.lw,p.rw),axis:direction(p.rw,p.lw)};
  return p;
}
function stand(p,where=0){
  for(const [s,sg] of sides)foot(p,s,sg,[p.hips[0]+sg*.143,floor,where+sg*.021],[sg*.123,.090,.989]);
}
function loose(p,s,sg){
  arm(p,s,add(p[s+"s"],[sg*.027,-.549,.046]),[sg*.61,-.57,.38]);
}
function hipLeg(p,s,knee,ankle,toe){
  p[s+"k"]=add(p[s+"h"],scale(direction(p[s+"h"],knee),.422));
  p[s+"a"]=add(p[s+"k"],scale(direction(p[s+"k"],ankle),.424));
  p[s+"t"]=add(p[s+"a"],toe);
  delete p.planted[s];
}
function sideObserver(t,p,z,x=.699){
  const q=body([x,.887,z],.359,-Math.PI/2);
  stand(q,z);
  for(const [s,sg] of sides){
    const place=s==="l"?add(p.lh,[.023,.128,.103]):add(p.rk,[.062,.092,.054]);
    arm(q,s,place,[.57,-.61,sg*.47]);
  }
  return q;
}
function hipRotation(t,{mode}){
  const u=cycle(t,.37,.63), outer=mode==="external";
  const p=body([0,.562,-.151],.022);
  const reach=(outer?-1:1)*u;
  for(const [s,sg] of sides){
    const swing=s==="l"?reach:0;
    hipLeg(p,s,[sg*.156,.490,.258],[sg*.157+swing*.263,.081+.108*Math.abs(swing),.255],
      [swing*.086,-.070+.023*Math.abs(swing),.140]);
    arm(p,s,[sg*.179,.617,.213],[sg*.59,-.38,-.52]);
  }
  return mark(p);
}
function table(t,{mode}){
  const u=cycle(t,.41,.64), faber=mode==="faber", length=mode==="length";
  const p=body([0,.851+(length?.091:0)*u,length||faber?-.115:.315],-Math.PI/2+(length?-.134*u:0));
  const rightAngle=length?.835*u:0;
  hipLeg(p,"r",[-.125,.838+.367*rightAngle,.300-.135*rightAngle],
    [-.153,.814-.021*rightAngle,.767-.345*rightAngle],[-.015,.138,.064]);
  if(faber){
    hipLeg(p,"l",[.421,.978+.031*u,.135],[-.056,.923,.306],[-.097,.085,.069]);
    arm(p,"l",[.361,.818,-.190],[.581,.262,-.59]);
    arm(p,"r",[-.353,.817,-.136],[-.80,.19,-.15]);
    const observe=sideObserver(t,p,.022,.627);
    arm(observe,"l",add(p.lh,[.025,.124,.095]),[.94,-.40,.07]);
    arm(observe,"r",add(p.lk,[.072,.096,.017]),[.61,-.48,.21]);
    p.partner=observe;
  }else if(length){
    hipLeg(p,"l",[.125,.839+.370*rightAngle,.299-.141*rightAngle],
      [.146,.814,.773-.352*rightAngle],[.011,.132,.065]);
    for(const [s,sg] of sides)arm(p,s,[sg*.34,.817,-.135],[sg*.75,.37,.04]);
    const q=body([0,.859,.999],.624,Math.PI);
    stand(q,1.09);
    for(const [s,sg] of sides)arm(q,s,add(p[s+"a"],[sg*.030,.080,.103]),[sg*.78,-.32,.42]);
    p.partner=q;
  }else{
    const drift=mode==="thomas-front"?.153:.020;
    hipLeg(p,"r",[-.138-drift*u,.728-.162*u,.681],[-.155-drift*u,.390-.106*u,.731],[-.024,-.049,.148]);
    hipLeg(p,"l",[.136,1.180+.081*u,.342],[.196,1.031-.061*u,.717],[.064,-.050,.137]);
    for(const [s,sg] of sides)arm(p,s,add(p.lk,[sg*.068,.032,-.067]),[sg*.68,.40,.11]);
    const q=sideObserver(t,p,.27,.649);
    arm(q,"l",add(p.lh,[.068,.091,.025]),[.70,-.54,.14]);
    arm(q,"r",add(p.rh,[.066,.086,.042]),[.68,-.51,.10]);
    p.partner=q;
  }
  p.headAim=[0,.134,-1];
  return mark(p);
}
function measurement(t,{mode}){
  const u=cycle(t,.42,.61);
  const ruler=mode==="flex";
  const roll=mode==="shoulders"?.082*Math.sin(2*Math.PI*t):0;
  const p=body(ruler?[0,1.186-.111*u,-.161-.166*u]:[0,.884,.212],ruler?1.61*u:.012);
  if(ruler){
    for(const [s,sg] of sides){
      foot(p,s,sg,[sg*.105,.378,-.048],[sg*.11,.07,.99],[sg*.013,-.072,.139]);p.planted[s]=.303;
      const point=add(p[s+"s"],[sg*.045,-.560,.055]);
      arm(p,s,point,[sg*.49,-.84,-.16]);
    }
    p.headAim=[0,Math.cos(1.61*u),Math.sin(1.61*u)];
  }else{
    stand(p,.21);
    for(const [s,sg] of sides){
      p[s+"s"][1]+=.071*u+sg*roll;
      p[s+"s"][2]+=.042*Math.sin(2*Math.PI*t);
      loose(p,s,sg);
    }
  }
  if(!ruler){
    const q=body([.081,.880,1.182],.030,Math.PI);
    stand(q,1.22);
    for(const [s,sg] of sides)loose(q,s,sg);
    q.headAim=[0,.998,.036];
    p.partner=q;
  }
  return mark(p);
}
function neck(t,{mode}){
  const u=cycle(t,.40,.67);
  const prone=mode==="extension", bridge=mode==="bridge";
  const side=mode==="trap";
  const p=body(bridge?[0,.545+.280*u,-.582-.079*u]:side?[0,.882,.043]:[0,.718,.335],
    bridge?1.98+.716*u:side?.028:prone?1.569:-1.567,
    prone?Math.PI:0);
  if(side){
    stand(p);
    arm(p,"r",[-.139,.834,-.174],[-.727,-.399,-.55]);
    loose(p,"l",1);
    p.headAim=[.474*u,Math.sqrt(1-(.474*u)**2),.013];
  }else if(bridge){
    p.planted={};
    for(const [s,sg] of sides){
      hipLeg(p,s,[sg*.176,.116+.425*u,-.817],[sg*.190,.086,-1.203],[sg*.02,-.059,.144]);
      arm(p,s,[sg*.265,.057,-.257+.028*u],[sg*.58,.398,-.631]);
    }
    p.headAim=[0,-.286-.627*u,.955-.745*u];
    p.headDrop=.075*u;
  }else{
    p.planted={};
    for(const [s,sg] of sides){
      hipLeg(p,s,[sg*.097,.705,.753],[sg*.114,.664,1.171],[sg*.009,.076,.130]);
      if(prone)arm(p,s,[sg*.203,.648,.611],[sg*.26,-.25,.91]);
      else arm(p,s,add(p.neck,[sg*.103,-.054-.08*u,-.151+.053*u]),[sg*.88,-.087,.13]);
    }
    const tilt=prone?-.181+.422*u:.075-.712*u;
    p.headAim=[0,Math.sin(tilt),-Math.cos(tilt)];
    p.headDrop=prone?.049-.067*u:.022+.038*u;
  }
  p.head=add(p.neck,scale(unit(p.headAim),.117));
  return mark(p);
}
function hand(t,{mode}){
  const quick=mode==="quick", stretch=mode==="forearm", pressure=mode.startsWith("ball");
  const table=mode==="ball-table";
  const spread=mode==="spread", u=quick?.5+.5*Math.sin(2*Math.PI*(4*t-.25)):cycle(t,.38,.63);
  const p=body(stretch?[0,.569,-.146]:[0,.878,-.095],stretch?.052:table?.594:.023);
  stand(p,table?-.143:.076);
  const rw=table?[-.121,.893,.344]:stretch?[-.221,.895,.409]:[-.205,1.264,.356];
  arm(p,"r",rw,[-.62,-.81,-.14]);
  if(quick)arm(p,"l",[.201,1.254,.377],[.62,-.80,-.14]);
  else if(stretch)arm(p,"l",add(p.rw,[.021,.036+.034*u,.119]),[.59,-.37,.069]);
  else loose(p,"l",1);
  p.rFingers=table?[.015,-.351-.204*u,.926]:stretch?[.009,-.19-.71*u,.981-.171*u]:pressure?[.036,.301,.953]:up;
  p.rPalmSide=table?[0,-1,0]:pressure||stretch?[0,1,0]:[-1,0,0];
  p.rFingerCurl=pressure?.19+.71*u:quick?.13+.87*u:.07;
  p.rFingerSpread=spread?.13+.84*u:quick?.90-.83*u:.40-.27*u;
  p.rThumbExtend=spread?.12+.81*u:quick?.86-.67*u:.30;
  if(quick){
    p.lFingers=up;p.lPalmSide=right;p.lFingerCurl=p.rFingerCurl;
    p.lFingerSpread=p.rFingerSpread;p.lThumbExtend=p.rThumbExtend;
  }
  if(stretch){p.lFingers=[-.548,-.064,.836];p.lPalmSide=[0,-1,0];}
  if(pressure){
    p.ballCenter=table?[-.121,.855,.392]:add(p.rw,[.029,.022,.083]);
    p.machineTravel=.64*u;
  }
  return mark(p);
}

const frontView=[31,16,[0,.92,.19],2.15], tableView=[-71,24,[0,.97,.03],2.16];
const items=[
  ["6786",table,"faber","spotter-assessment-leg-table",[],[-58,38,[.13,1.02,.04],2.19]],
  ["6787",hipRotation,"external","spotter-assessment-seat",[],frontView],
  ["6788",hipRotation,"internal","spotter-assessment-seat",[],frontView],
  ["6789",table,"length","spotter-assessment-leg-table",[],[63,30,[0,1.06,.19],2.45]],
  ["6792",measurement,"shoulders","none",[],[65,15,[0,.94,.59],2.19]],
  ["6793",measurement,"flex","spotter-assessment-flex-box",[],[58,13,[0,1.09,.02],2.32]],
  ["6794",table,"thomas","spotter-assessment-exam-table",[],tableView],
  ["6795",table,"thomas-front","spotter-assessment-exam-table",[],[-13,23,[0,1.01,.19],2.10]],
  ["10781",neck,"extension","spotter-assessment-neck-table",["neck"],[68,14,[0,.78,.07],1.39]],
  ["1842",neck,"stretch","spotter-assessment-neck-table",["neck"],[69,11,[0,.78,.07],1.38]],
  ["0633",neck,"bridge","mat",["neck"],[69,19,[0,.41,-.54],1.43]],
  ["1791",neck,"trap","none",["r:trap","r:neck"],[30,16,[0,1.23,.07],1.22]],
  ["2097",hand,"spread","none",["r:forearm"],[47,11,[-.179,1.35,.326],.91]],
  ["11783",hand,"quick","none",["forearm"],[39,11,[0,1.37,.351],.95]],
  ["11791",hand,"ball-hand","spotter-assessment-hand-ball",["r:forearm"],[37,14,[-.163,1.31,.37],.92]],
  ["11794",hand,"ball-table","spotter-assessment-hand-table",["r:forearm"],[48,23,[-.151,.970,.32],.91]],
  ["6763",hand,"forearm","spotter-assessment-seat",["r:forearm"],[59,20,[-.107,.861,.28],1.28]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,render,mode,equipment,muscles,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view, camera={yaw,elevation,focus,height};
  const durationMs=mode==="quick"?4000:render===table?5950:4920;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{mode})}));
  const recipe=id+".json", data={version:1,equipment,durationMs,muscles,camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.46});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
