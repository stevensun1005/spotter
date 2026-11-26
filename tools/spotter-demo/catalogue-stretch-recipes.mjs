import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides=[['l',1],['r',-1]];
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const scale=(a,k)=>a.map(value=>value*k);
const sub=(a,b)=>add(a,scale(b,-1));
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const unit=a=>scale(a,1/(Math.hypot(...a)||1));
const depth=t=>(1-Math.cos(2*Math.PI*t))/2;
function limb(root,end,pole,a,b){
  const delta=sub(end,root);
  const span=Math.min(a+b-.004,Math.max(Math.abs(a-b)+.004,Math.hypot(...delta)));
  const axis=unit(delta);
  const d=(a*a-b*b+span*span)/(2*span);
  const bend=unit(sub(pole,scale(axis,dot(pole,axis))));
  return [add(root,add(scale(axis,d),scale(bend,Math.sqrt(a*a-d*d)))),add(root,scale(axis,span))];
}
function body(hips,pitch,side=false){
  const line=[0,Math.cos(pitch),Math.sin(pitch)];
  const at=(height,x=0)=>add(hips,add(scale(line,height),side?[0,x,0]:[x,0,0]));
  return {hips,chest:at(.37),neck:at(.605),head:at(.731),ls:at(.501,.190),rs:at(.501,-.190),
    lh:at(0,.103),rh:at(0,-.103),planted:{}};
}
function arm(p,side,sign,point,pole,support=false){
  [p[side+'e'],p[side+'w']]=limb(p[side+'s'],point,pole??[sign*.83,-.58,.05],.252,.371);
  if(support)p[side+'Grip']=[0,0,1];
}
function leg(p,side,point,pole,toe){
  [p[side+'k'],p[side+'a']]=limb(p[side+'h'],point,pole,.422,.424);
  p[side+'t']=add(p[side+'a'],toe??[0,-.073,.148]);
}
function stretch(t,{kind,right}){
  const a=depth(t);
  if(kind==='chest'){
    const p=body([0,.870,.020],.033-.055*a);
    for(const[side,sign]of sides){
      leg(p,side,[sign*.169,.075,.058],[sign*.144,0,1]);
      p.planted[side]=0;
      arm(p,side,sign,add(p.head,[sign*.095,-.029,-.065]),[sign*.93,-.095,-.31+.66*(1-a)]);
    }
    return p;
  }
  if(kind==='prone'){
    const p=body([0,.119,.015],Math.PI/2-.03);
    for(const[side,sign]of sides){
      const folded=right?sign<0:sign>0;
      const knee=add(p[side+'h'],[sign*.016,-.043,folded?-.413+.029*a:-.419]);
      const turn=folded?2.16+.570*a:0;
      const foot=add(knee,[sign*.012,.423*Math.sin(turn),-.423*Math.cos(turn)]);
      p[side+'k']=knee;p[side+'a']=foot;
      p[side+'t']=add(foot,[sign*.015,-.055,-.134*Math.cos(turn)]);
      arm(p,side,sign,folded?add(foot,[sign*.032,.023,.061]):[sign*.243,.078,.816],
        folded?[sign*.88,-.27,-.23]:[sign*.78,-.32,.09],folded);
      if(Math.hypot(...sub(foot,p[side+'t']))<.064)p[side+'t'][2]-=.045;
    }
    return p;
  }
  if(kind==='adductor'){
    const p=body([.130,.212,.030],-Math.PI/2,true);
    for(const[side,sign]of sides){
      const top=sign>0;
      const goal=top ? [-.12-.346*a,.386-.244*a,.832-.11*a] : [.337,.083,.616];
      leg(p,side,goal,[0,.91,.38],[sign*.02,-.050,.14]);
      arm(p,side,sign,top?[.046,.097,-.167]:[.128,.091,-.750],[.43,sign*.33,.61]);
    }
    return p;
  }
  if(kind==='situp'){
    const p=body([0,.148,.116],-Math.PI/2+1.44*a);
    for(const[side,sign]of sides){
      leg(p,side,[sign*.144,.073,.565],[sign*.137,.92,.18]);
      arm(p,side,sign,add(p.head,[sign*.142,-.051,-.068]),[sign*.853,.25,-.15]);
      p.planted[side]=0;
    }
    return p;
  }
  const p=body([0,.145,.012],-Math.PI/2+.12*a);
  leg(p,'l',[.055,.241+.136*a,.689-.195*a],[.087,.92,.26]);
  const cross=add(p.lk,[.014,.105,-.016]);
  leg(p,'r',cross,[-.91,.48,-.018],[.138,-.031,.017]);
  for(const[side,sign]of sides){
    const brace=add(p.lk,[sign*.100,-.123,-.066]);
    arm(p,side,sign,brace,[sign*.77,.12,-.51],true);
  }
  return p;
}
const rows=[
  ['1259',{kind:'chest'},'none',['pec','shoulder'],[43,11,[0,.95,.03],2.14]],
  ['1713',{kind:'prone'},'mat',['l:quad'],[67,22,[0,.38,0],1.48]],
  ['1714',{kind:'prone',right:true},'mat',['r:quad'],[-62,22,[0,.38,0],1.48]],
  ['1709',{kind:'glute'},'mat',['r:glute'],[58,25,[0,.39,.075],1.45]],
  ['1712',{kind:'adductor'},'adductor-step',['quad'],[44,26,[0,.40,.10],1.63]],
  ['1758',{kind:'situp'},'situp-anchor',['core'],[68,21,[0,.43,.113],1.69]],
];
const [dir,...ids]=process.argv.slice(2);
if(!dir)throw new Error('Pass an output directory.');
const out=resolve(dir);await mkdir(out,{recursive:true});
const items=[];
const failed=[];
for(const[id,spec,equipment,muscles,camera]of rows){
  if(ids.length&&!ids.includes(id))continue;
  const recipe=id+'.json';
  const[yaw,elevation,focus,height]=camera;
  const data={version:1,durationMs:5000,equipment,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...stretch(i/60,spec)}))};
  try{prepareRecipe(data);await writeFile(resolve(out,recipe),JSON.stringify(data)+'\n');items.push({id,recipe});}
  catch(error){failed.push({id,error:error.message});}
}
await writeFile(resolve(out,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failed},null,2));
if(failed.length)process.exitCode=1;
