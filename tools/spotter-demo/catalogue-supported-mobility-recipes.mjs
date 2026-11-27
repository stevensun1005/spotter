import { mkdir, writeFile } from "node:fs/promises";
import { join,resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,blend,body,cycle,foot,scale,sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, up=[0,1,0];
const norm=v=>scale(v,1/Math.max(.0001,Math.hypot(...v)));
const to=(a,b)=>norm(add(b,scale(a,-1)));
function mark(p){
  p.handRoller={center:p.chest,axis:up};
  return p;
}
function leg(p,s,knee,ankle,toe){
  p[s+"k"]=add(p[s+"h"],scale(to(p[s+"h"],knee),.422));
  p[s+"a"]=add(p[s+"k"],scale(to(p[s+"k"],ankle),.424));
  p[s+"t"]=add(p[s+"a"],toe);
  delete p.planted[s];
}
function kneeling(t){
  const u=cycle(t,.35,.70);
  const p=body([0,.396-.115*u,-.071-.196*u],1.012+.382*u);
  p.planted={};
  for(const [s,sg] of sides){
    leg(p,s,[sg*.153,.090,-.155],[sg*.165,.081,-.569],[sg*.028,-.052,-.131]);
    arm(p,s,[sg*.226,.521,.724],[sg*.34,-.794,.341]);
    p[s+"Fingers"]=[0,.055,1];
    p[s+"PalmSide"]=[0,-1,0];
  }
  p.headAim=[0,-.244-.182*u,.927];
  return mark(p);
}
function raisedStretch(t,{mode}){
  const u=cycle(t,.42,.67), lateral=mode.startsWith("side");
  const high=mode==="side-high", hip=mode==="hip";
  const x=lateral?.097+(.163+(high?.056:0))*u:0;
  const p=body([x,lateral?.866-(high?.052:.038)*u:.886-.090*u,-.070-(lateral?0:.163*u)],lateral?.049+(high?.035:.123)*u:.043+(hip?.562:.439)*u);
  foot(p,"r",-1,[-.144,floor,-.029],[.053,.134,.987]);
  const elevated=lateral?[high?.807:.759,.553,high?.020:.145]:[.141,.461,.604];
  const toe=lateral?[high?.045:.023,-.053,.144]:[.012,.143,.047];
  const pole=lateral?[.156,.703,.631]:[.109,hip?.91:.82,hip?.30:.46];
  foot(p,"l",1,elevated,pole,toe);
  delete p.planted.l;
  for(const [s,sg] of sides){
    const point=lateral?add(p.chest,[sg*.201,-.391,-.011]):add(p.chest,[sg*.190,-.424,.211+.107*u]);
    arm(p,s,point,[sg*.77,-.44,.18]);
  }
  return mark(p);
}
function padReference(t,{mode}){
  const breath=.5+.5*Math.sin(2*Math.PI*t);
  const seat=mode==="seat";
  const p=body(seat?[0,.555,-.170]:[0,.143,-.050],seat?-.119-.018*breath:-Math.PI/2+.013*breath);
  p.planted={};
  for(const [s,sg] of sides){
    if(seat)leg(p,s,[sg*.173,.479,.230],[sg*.188,.074,.243],[sg*.013,-.070,.143]);
    else leg(p,s,[sg*.106,.115,.371],[sg*.109,.106,.795],[sg*.023,.121,.070]);
    if(seat)arm(p,s,[sg*.188,.603,.153],[sg*.43,-.84,-.186]);
    else arm(p,s,[sg*.298,.108,-.053],[sg*.756,.309,-.081]);
  }
  p.headAim=seat?[0,1,.023]:[0,.065,-1];
  return mark(p);
}
function tableStretch(t,{mode}){
  const u=cycle(t,.36,.68);
  const side=mode==="hang";
  const lower=mode==="lower";
  const p=body([0,.851,side?-.033:lower?.335:.301],-Math.PI/2);
  p.planted={};
  if(side){
    leg(p,"l",[.126,.828,.388],[.161,.797,.806],[.022,.122,.071]);
    leg(p,"r",blend([.095,1.084,.194],[.352,.745,.045],u),blend([.087,.935,.580],[.473,.594,.389],u),[.052,.029,.139]);
    arm(p,"r",[-.300,.822,-.132],[-.73,.33,.119]);
    arm(p,"l",add(p.rk,[.020,.087,-.038]),[.81,.38,.12]);
  }else{
    leg(p,"r",[-.131,.844-.120*u,.720],[-.166,.473-.106*u,.754],[-.017,-.041,.146]);
    const knee=[.139,1.167+(lower?.092:.112)*u,.345-.129*u];
    leg(p,"l",knee,[.174,.957+.018*u,.655-.178*u],[.016,-.041,.155]);
    for(const [s,sg] of sides)arm(p,s,add(p.lk,[sg*.066,.042,-.065]),[sg*.784,.34,.16]);
  }
  p.headAim=[0,.073,-1];
  return mark(p);
}

const items=[
  ["1785",kneeling,"chest","stretch-kneeling-bench",["pec","shoulder"],[70,20,[0,.48,.23],1.60]],
  ["1911",raisedStretch,"hamstring","stretch-front-box",["l:hamstring"],[59,18,[0,.86,.29],1.98]],
  ["1879",raisedStretch,"hip","stretch-front-box",["l:glute","l:hamstring"],[68,17,[0,.85,.27],1.97]],
  ["1897",raisedStretch,"side","stretch-lateral-bench",["l:adductor"],[31,17,[.416,.86,.04],2.01]],
  ["1896",raisedStretch,"side-high","stretch-lateral-bench",["l:adductor"],[28,15,[.396,.87,.06],2.04]],
  ["3657",padReference,"floor","stretch-floor-pillow",[],[68,21,[0,.29,-.05],1.65]],
  ["3658",padReference,"seat","stretch-padded-chair",[],[53,17,[0,.76,-.053],1.66]],
  ["1577",tableStretch,"higher","assessment-exam-table",["r:quad"],[69,19,[0,.77,-.16],1.87]],
  ["0616",tableStretch,"lower","assessment-exam-table",["r:quad"],[65,19,[0,.80,-.15],1.89]],
  ["1884",tableStretch,"hang","assessment-leg-table",["r:glute"],[43,27,[.115,.82,-.02],1.90]],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[],failures=[];
for(const [id,render,mode,prop,muscles,view] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view, camera={yaw,elevation,focus,height};
  const durationMs=render===padReference?5600:6140;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{mode})}));
  const recipe=id+".json", data={version:1,equipment:"spotter-"+prop,durationMs,muscles,camera,keyframes};
  try{prepareRecipe(data);}catch(error){failures.push({id,message:error.message});continue;}
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.49});
}
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length,failures}));
if(failures.length)process.exitCode=1;
