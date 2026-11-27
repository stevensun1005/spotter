import { mkdir,writeFile } from "node:fs/promises";
import { join,resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add,arm,body,cycle,foot,sides } from "./catalogue-dumbbell-recipes.mjs";

const PI=Math.PI;
function motion(p,phase){
  p.machineTravel=phase;
  p.handRoller={center:p.chest,axis:[1,0,0]};
  return p;
}
function pedal(t,{water=false}={}){
  const n=(water?3:4)*t;
  const wobble=Math.sin(n*PI*2);
  const p=body(water?[.017*wobble,.869+.015*Math.abs(wobble),.076]:[.020*wobble,1.025,-.196],water?.164:.892);
  p.planted={};
  for(const [s,sg] of sides){
    const theta=(n+(s==="r"?.5:0))*PI*2;
    const a=(water?.222:.149);
    const ankle=[sg*(water?.16:.135), (water?.641:.434)+a*Math.sin(theta),(water?-.004:.023)+a*Math.cos(theta)];
    foot(p,s,sg,ankle,[sg*.119,.383,1],[sg*.024,water?-.083:-.071,.137]);
    arm(p,s,water?[sg*.250,1.194,.583]:[sg*.242,1.027,.470],[sg*.31,-.69,-.32]);
    p[s+"Grip"]=[1,0,0];
    p[s+"PalmSide"]=[0,-1,0];
  }
  p.headAim=water?[0,.957,.103]:[.038*wobble,.891,.291];
  return motion(p,n);
}
function skate(t){
  const n=t*2, f=PI*2*n;
  const balance=Math.sin(f);
  const lead=.355*Math.sin(f);
  const p=body([.162*balance,.732+.040*Math.cos(f*2),.038+.143*Math.sin(PI*2*t)],.350+.073*Math.cos(f*2),.076*balance);
  p.planted={};
  for(const [s,sg] of sides){
    const kick=Math.max(0,sg*Math.sin(f));
    const glide=Math.max(0,-sg*Math.sin(f));
    const toeYaw=sg*(.180+1.02*kick);
    const ankle=[sg*(.157+.445*kick)+.052*balance,.179+.091*kick,p.hips[2]+.270*glide-.330*kick];
    foot(p,s,sg,ankle,[Math.sin(toeYaw),.247,Math.cos(toeYaw)],[.145*Math.sin(toeYaw),-.034,.145*Math.cos(toeYaw)]);
    arm(p,s,add(p.chest,[sg*(.253+.081*kick),-.313,sg*lead]),[sg*.61,-.33,.501]);
  }
  p.headAim=[-.110*balance,.989,.012];
  return motion(p,n);
}
function circle(t){
  const turns=4*t, f=turns*PI*2;
  const setup=cycle(t/.24,.36,.47);
  const p=body([.069*Math.cos(f),.883+.018*Math.sin(2*f),.067*Math.sin(f)],.048+.051*Math.cos(f),.105*Math.sin(f));
  for(const [s,sg] of sides){
    foot(p,s,sg,[sg*.186,.075,.102],[sg*.162,.117,.959]);
    arm(p,s,add(p.chest,[sg*(.320+.184*setup),.071-.236*setup,.141+.051*Math.cos(f+sg*.79)]),[sg*.82,-.38,.15]);
  }
  return motion(p,turns);
}
const items=[
  ["10729",pedal,{water:true},"aquabike",["quad","glute","core"],[112,20,[0,1.02,.14],2.28],6000],
  ["5214",pedal,{},"bike",["quad","hamstring","calf"],[68,14,[0,.90,.00],2.16],5800],
  ["7175",skate,{},"inline-skates",["quad","glute","adductor"],[61,13,[0,.90,.13],2.09],6100],
  ["5526",circle,{},"hoop",["core"],[43,15,[0,.89,.06],2.12],6300],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
for(const [id,render,args,prop,muscles,view,durationMs] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const [yaw,elevation,focus,height]=view;
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,args)}));
  const recipe=id+".json", data={version:1,equipment:"spotter-recreation-"+prop,durationMs,muscles,camera:{yaw,elevation,focus,height},keyframes};
  prepareRecipe(data);
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:.45});
}
if(wanted.length&&wanted.length!==manifest.length)throw new Error("Invalid or duplicate exercise IDs.");
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length}));
