import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,blend,body,cycle,foot,scale,sides } from "./catalogue-dumbbell-recipes.mjs";

const side=[1,0,0], floor=.075;
const center=(a,b)=>scale(add(a,b),.5);
const direction=(a,b)=>{
  const v=add(b,scale(a,-1));
  return scale(v,1/Math.max(.0001,Math.hypot(...v)));
};
function position(p,{width=.159,depth=.076,turn=0}={}){
  for(const [s,sg] of sides)foot(p,s,sg,[sg*width,floor,depth],[sg*(.13+turn),.083,.98],[sg*(.020+turn*.105),-.073,.143]);
}
function placeHands(p,left,right,{poleY=-.69,frontPole=.20,offset=0}={}){
  const wanted=direction(right,left);
  for(const [s,sg] of sides){
    arm(p,s,s==="l"?left:right,[sg*.74,poleY,frontPole]);
    p[s+"Grip"]=wanted;
    p[s+"PalmSide"]=[0,Math.sign(-poleY||1),0];
  }
  const axis=direction(p.rw,p.lw);
  p.handRoller={center:add(center(p.lw,p.rw),scale(axis,offset)),axis};
  return p;
}
function even(p,point,width,axis=side,opts={}){
  return placeHands(p,add(point,scale(axis,width)),add(point,scale(axis,-width)),opts);
}
function anglePath(t,{mode}){
  const u=cycle(t,mode==="strap"?.43:.45,mode==="shoulder-rotation"?.62:.54);
  const strap=mode==="strap", supine=mode==="supine-overhead";
  const frontRaise=mode==="front-raise";
  const amplitude=frontRaise?1.45:strap?3.64:supine?2.84:mode==="pass-round"?5.09:mode==="shoulder-rotation"?4.82:5.19;
  const arc=.16+amplitude*u;
  const p=body(supine?[0,.142,-.058]:[0,.880,.041],supine?-Math.PI/2:.024);
  if(supine){
    p.planted={};
    for(const [s,sg] of sides){
      p[s+"k"]=[sg*.150,.442,.229];
      p[s+"a"]=[sg*.179,.091,.468];
      p[s+"t"]=[sg*.184,.019,.614];
    }
    return even(p,add(p.neck,[0,.436*Math.sin(arc),.269+.467*Math.cos(arc)]),.317,side,{poleY:.74,frontPole:.23});
  }
  position(p);
  const y=1.389-.517*Math.cos(arc), z=.061+.530*Math.sin(arc+.134);
  return even(p,[0,y,z],frontRaise?.270:strap?.432:.428,side,
    {poleY:u>.67?.72:-.72,frontPole:u>.68?.17:-.08});
}
function hingeSquat(t,{mode}){
  const full=mode==="sumo";
  const u=cycle(t,.40,full?.62:.55);
  const squat=mode==="overhead"||full;
  const vertical=mode==="hinge";
  const p=body([0,.880-(squat?.338:.082)*u,.034-(squat?.194:.259)*u],.039+(squat?.265:1.010)*u);
  position(p,{width:squat?(full?.305:.213):.164,turn:squat?(full?.72:.33):.08});
  if(squat){
    const point=[0,p.ls[1]+.492,.072-.025*u];
    return even(p,point,full?.373:.418,side,{poleY:.63});
  }
  if(vertical){
    const line=add(p.neck,scale(p.front,-.118));
    return placeHands(p,add(line,scale(p.up,-.051)),add(line,scale(p.up,-.50)),{poleY:.15,frontPole:-.21,offset:-.043});
  }
  return even(p,add(p.neck,scale(p.front,-.085)),.328,p.right,{poleY:-.22,frontPole:.67});
}
function reach(t,{mode}){
  const u=cycle(t,.42,.56);
  const extension=mode==="rear-raise"||mode==="rear-stretch";
  const frontRack=mode==="front-rack";
  const split=mode==="lunge-overhead"||mode==="lunge-twist";
  const lungeTwist=mode==="lunge-twist";
  const torsoTwist=mode==="twist";
  const fold=mode==="side-fold";
  const sideMove=mode==="side-bend"||mode==="side-lat"||fold;
  const sidewave=mode==="side-bend"?.580*Math.sin(2*Math.PI*t):mode==="side-lat"?.303*u:fold?.53*cycle(t/.53,.41,.58):0;
  const yaw=torsoTwist?.62*Math.sin(2*Math.PI*t):lungeTwist?.675*u:0;
  const foldMotion=fold?cycle((t-.43)/.57,.45,.64):0;
  const p=body([0,.879-(split?.342:0)*u,.037+(split?.081:0)*u-.233*foldMotion],.035+1.013*foldMotion,yaw);
  if(sideMove){
    const rotate=([x,y,z])=>[x*Math.cos(sidewave)-y*Math.sin(sidewave),x*Math.sin(sidewave)+y*Math.cos(sidewave),z];
    for(const key of ["ls","rs","chest","neck","head"])p[key]=add(p.hips,rotate(add(p[key],scale(p.hips,-1))));
    p.right=rotate(p.right);
    p.up=rotate(p.up);
  }
  if(torsoTwist||lungeTwist){
    p.lh=add(p.hips,[.103,0,0]);
    p.rh=add(p.hips,[-.103,0,0]);
  }
  if(split){
    for(const [s,sg] of sides){
      const frontFoot=s==="l";
      const z=frontFoot?.411:.020-.503*u;
      foot(p,s,sg,[sg*.149,frontFoot?floor:.075+.085*u,z],[sg*.09,.20,.98],
        [sg*.013,frontFoot?-.071:-.071-.06*u,frontFoot?.138:.039]);
      if(!frontFoot)delete p.planted[s];
    }
  }else position(p);
  if(extension){
    return even(p,add(p.hips,[0,-.052+(.070+(mode==="rear-raise"?.045:0))*u,-.234-.167*u]),.257,side,{poleY:-.46,frontPole:-.32});
  }
  if(frontRack){
    const point=add(p.neck,[0,-.060+.052*u,.179-.023*u]);
    return even(p,point,.230,side,{poleY:-.632+.959*u,frontPole:.97});
  }
  if(lungeTwist)return even(p,add(p.chest,scale(p.front,.325)),.225,p.right,{poleY:-.80,frontPole:-.19});
  if(torsoTwist)return even(p,add(p.neck,scale(p.front,-.099)),.349,p.right,{poleY:-.45,frontPole:.39});
  if(sideMove){
    const line=add(scale(p.right,Math.cos(mode==="side-lat"?.48:0)),scale(p.up,Math.sin(mode==="side-lat"?.48:0)));
    return even(p,add(p.head,scale(p.up,.354)),mode==="side-lat"?.334:.368,line,{poleY:.62,frontPole:.08});
  }
  return even(p,add(p.neck,[0,-.623+1.097*u,.198-.101*u]),.341,side,{poleY:-.61+1.08*u,frontPole:.16});
}
function guide(t,{mode}){
  const u=cycle(t,.42,.59);
  const supine=mode==="lying-triceps";
  const kneel=mode==="pvc-pec";
  const rear=mode==="rear-abduction";
  const assisted=mode==="external-wood"||mode==="subscapularis";
  const external=mode==="external-pvc"||assisted;
  const p=body(supine?[0,.149,-.049]:kneel?[0,.511,.014]:[0,.879,.037],supine?-Math.PI/2:.033);
  if(supine){
    p.planted={};
    for(const [s,sg] of sides){
      p[s+"k"]=[sg*.143,.462,.251];
      p[s+"a"]=[sg*.179,.089,.438];
      p[s+"t"]=[sg*.185,.016,.588];
    }
    return placeHands(p,[.222,.341-.099*u,-.677-.063*u],[-.170,.531-.087*u,-.562-.091*u],
      {poleY:.98,frontPole:-.09,offset:.042});
  }
  if(kneel){
    p.rk=[-.148,.094,.035];p.ra=[-.165,.079,-.385];p.rt=[-.174,.029,-.517];
    foot(p,"l",1,[.159,floor,.615],[.16,.82,.39]);delete p.planted.r;
    return placeHands(p,[.266+.067*u,1.096+.171*u,.181-.186*u],[-.090,.787+.112*u,.221-.082*u],{poleY:-.62});
  }
  position(p);
  if(external){
    const v=assisted?.280*u:.228*Math.sin(2*Math.PI*t);
    const ease=mode==="subscapularis"?.102:.0;
    return placeHands(p,[.232+v+ease,.999+.041*u,.410-.127*u],[-.239+v,.993-.038*u,.407+.061*u],
      {poleY:-.96,frontPole:-.09});
  }
  if(rear)return placeHands(p,[.333+.164*u,1.016+.477*u,-.192],[-.126+.037*u,.782+.160*u,-.254],
    {poleY:-.58,frontPole:-.46});
  return placeHands(p,[.422+.144*u,.928+.621*u,.235],[-.158+.266*u,.892+.157*u,.296],
    {poleY:-.62+.61*u,frontPole:.43});
}

const frontView=[51,16,[0,1.06,.02],2.50], backView=[134,17,[0,1.00,.02],2.46], upper=[49,18,[0,1.10,.02],2.21];
const ground=[64,24,[0,.32,-.14],1.89];
const standing="spotter-strongman-training-stick", mat="spotter-training-stick-mat";
const items=[
  ["1271",anglePath,"strap","spotter-towel-strap",["pec","shoulder"],frontView],
  ["2935",guide,"pvc-pec",mat,["l:pec","l:shoulder"],[43,19,[0,.74,.16],1.90]],
  ["4602",guide,"external-pvc",standing,["shoulder"],upper],
  ["4603",reach,"front-rack",standing,["lat","shoulder","forearm"],upper],
  ["4604",hingeSquat,"good-morning",standing,["hamstring","core"],backView],
  ["4605",hingeSquat,"hinge",standing,["hamstring","glute"],backView],
  ["4606",hingeSquat,"overhead",standing,["quad","shoulder"],frontView],
  ["4607",anglePath,"pass",standing,["shoulder","pec"],frontView],
  ["2120",reach,"side-bend",standing,["core","lat"],[24,16,[0,1.07,0],2.52]],
  ["5400",reach,"side-lat",standing,["lat","core"],[28,16,[0,1.06,0],2.56]],
  ["5402",reach,"lunge-overhead",standing,["quad","shoulder"],frontView],
  ["10589",anglePath,"supine-overhead",mat,["shoulder"],ground],
  ["10740",guide,"lying-triceps",mat,["l:triceps"],ground],
  ["5407",hingeSquat,"sumo",standing,["quad","adductor","shoulder"],frontView],
  ["5404",anglePath,"pass-round",standing,["shoulder","pec"],frontView],
  ["9184",guide,"abduction",standing,["l:shoulder"],upper],
  ["10935",guide,"rear-abduction",standing,["l:shoulder"],backView],
  ["10936",anglePath,"shoulder-rotation",standing,["shoulder","pec"],frontView],
  ["5401",reach,"rear-stretch",standing,["shoulder","pec"],backView],
  ["5406",reach,"side-fold",standing,["core","hamstring","lat"],frontView],
  ["9187",anglePath,"front-raise",standing,["shoulder"],upper],
  ["9180",reach,"rear-raise",standing,["shoulder","pec"],backView],
  ["9181",guide,"external-wood",standing,["l:shoulder"],upper],
  ["5403",reach,"twist",standing,["core"],frontView],
  ["6811",guide,"subscapularis",standing,["l:shoulder"],upper],
  ["5408",reach,"lunge-twist",standing,["core","quad"],frontView],
];

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,render,mode,equipment,muscles,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view, camera={yaw,elevation,focus,height};
  const durationMs=mode==="side-fold"?5600:mode==="twist"||mode==="side-bend"?5500:4700;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{mode})}));
  const recipe=id+".json", data={version:1,equipment,durationMs,muscles,camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:mode==="side-bend"?.24:.45});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
