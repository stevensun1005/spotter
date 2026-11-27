import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, zAxis=[0,0,1];
function track(t, stages){
  const right=stages.findIndex(([phase])=>t<=phase);
  if(right<1)return stages[right===0?0:stages.length-1][1];
  const [a,p]=stages[right-1], [b,q]=stages[right];
  return blend(p,q,ramp(t,a,b));
}
function setFoot(p,side,sign,x,z,y=floor,yaw=0){
  if(y>floor+.005)delete p.planted[side];
  foot(p,side,sign,[x,y,z],[Math.sin(yaw),.05,Math.cos(yaw)],[.145*Math.sin(yaw),-.072,.145*Math.cos(yaw)]);
}
function stance(p,rotation=0,advance=0){
  setFoot(p,"l",1,.190,.095+advance);
  setFoot(p,"r",-1,-.184,-.345+advance,floor+.051*rotation,.78*rotation);
}
function guard(p,side,sign){
  arm(p,side,add(p.head,[sign*.141,-.234,.204+sign*.019]),[sign*.59,-.73,.25]);
}
function padHolder(center,kick){
  const p=body([.08,.852,center[2]+.418],.086,Math.PI);
  setFoot(p,"l",1,-.082,p.hips[2]-.106,floor,Math.PI);
  setFoot(p,"r",-1,.256,p.hips[2]+.249,floor,Math.PI);
  const target=add(center,[0,0,kick?.083:.066]);
  arm(p,"r",target,[.61,-.66,-.16]);
  if(kick)arm(p,"l",add(target,[-.076,-.088,.018]),[-.64,-.66,-.16]);
  else arm(p,"l",add(p.chest,[-.179,-.032,-.239]),[-.72,-.42,-.16]);
  return p;
}
function attachTarget(p,{partner,kick,center,force,hook=false}){
  const recoil=cycle((force-.46)/.54,.34,.56);
  p.ballCenter=add(center,partner?[.022*recoil,-.012*recoil,.051*recoil]:[.061*(hook?1:.18)*recoil,0,.102*recoil]);
  p.handRoller={center:p.ballCenter,axis:partner?(hook?[-.52,.04,.854]:zAxis):[-.073*recoil,1,-.135*recoil]};
  if(partner)p.partner=padHolder(p.ballCenter,kick);
}
function punch(t,{kind,partner=false}){
  const hitting=kind==="jab"||kind==="left-up"?"l":"r";
  const hook=kind==="hook", upper=kind.endsWith("-up");
  const fast=cycle(t,.475,.535);
  const yieldIn=upper?cycle(t/.47,.53,.60):.0;
  const rotation=(hitting==="l"?-.32:.69)*fast+(hook?.19*fast:0);
  const p=body([.008-.034*fast,.862-.130*yieldIn,-.11+.147*fast],.086-(upper?.148:.056)*fast,rotation-.150);
  stance(p,hitting==="r"?fast:0,0);
  const faceY=upper?1.312:hook?1.392:1.435;
  const center=[hook?.045:hitting==="l"?.091:-.105,partner?faceY:1.365,partner?.638:.708];
  for(const [side,sign] of sides)guard(p,side,sign);
  const pre=p[hitting+"w"];
  const reach=[center[0]+(hook?-.124:0),faceY-(upper?.058:.021),center[2]-(partner?.154:.270)];
  const chamber=add(pre,upper?[hitting==="l"?.076:-.078,-.272,-.030]:hook?[-.172,.024,-.061]:[0,0,0]);
  const target=track(t,[[0,pre],[upper?.29:.21,chamber],[.49,reach],[.55,reach],[.77,pre],[1,pre]]);
  const sign=hitting==="l"?1:-1;
  arm(p,hitting,target,hook?[sign*.84,-.022,.359]:upper?[sign*.49,-.60,-.10]:[sign*.38,-.87,.15]);
  attachTarget(p,{partner,kick:false,center,force:t,hook});
  return p;
}
function kick(t,{kind,partner=false}){
  const knee=kind==="knee", hook=kind==="hook", low=kind==="low", snap=kind==="snap";
  const lift=cycle(t,.38,.61);
  const extension=cycle((t-.29)/.53,snap?.28:.40,snap?.40:.57);
  const yaw=hook?.92*lift:.114*lift;
  const depth=knee?.290:.100;
  const p=body([.099*lift,.870+.032*lift,-.128+depth*lift],.052-(knee?.048:.271)*lift,yaw-.11);
  const pivot=hook?-.960*lift:0;
  setFoot(p,"l",1,.202,.091,knee?floor+.045*lift:floor,pivot);
  const center=[hook?.013:-.080,knee?1.034:low?.903:hook?1.237:1.144,partner?(knee?.640:.875):.908];
  const target=[center[0]-(hook?.095:0),center[1]-.050,center[2]-(partner?.082:.186)];
  for(const [side,sign] of sides)guard(p,side,sign);
  if(knee){
    const kneePoint=add(p.rh,scale([-.10,.201,1],.405));
    const chamber=cycle(t,.45,.57);
    const grounded=body([0,.870,-.128],.052,-.11);
    setFoot(grounded,"r",-1,-.176,-.325);
    const direction=blend(add(grounded.rk,scale(grounded.rh,-1)),add(kneePoint,scale(p.rh,-1)),chamber);
    p.rk=add(p.rh,scale(direction,.422/Math.hypot(...direction)));
    p.ra=add(p.rk,blend([-.023,-.383,-.171],[-.087,-.354,-.216],chamber));
    p.rt=add(p.ra,[.008,-.061,.138]);
    if(chamber>.05)delete p.planted.r;
  }else{
    const chamber=[hook?-.405:-.125,low?.496:.617,.105];
    const point=track(t,[[0,[-.185,floor,-.331]],[.34,chamber],[snap?.455:.50,target],[snap?.51:.59,target],
      [.68,chamber],[.96,[-.185,floor,-.331]],[1,[-.185,floor,-.331]]]);
    const toe=hook?[.121,.027,.058]:[.009,-.066+.165*extension,.143];
    delete p.planted.r;
    foot(p,"r",-1,point,hook?[-.91,.73,.28]:[-.092,.88,.64],toe);
  }
  attachTarget(p,{partner,kick:true,center,force:t,hook});
  return p;
}
function partnerShuffle(t){
  const slide=.418*Math.sin(2*Math.PI*t);
  const second=.416*Math.sin(2*Math.PI*(t-.035));
  const players=[body([slide,.748,-.433],.251),body([second,.748,.785],.251,Math.PI)];
  for(const [i,p] of players.entries()){
    const front=i===0?1:-1;
    const y=.039*Math.max(0,Math.sin(8*Math.PI*t+i*.40));
    for(const [side,sign] of sides){
      const width=.174+.067*sign*Math.cos(4*Math.PI*t);
      setFoot(p,side,sign,p.hips[0]+sign*width,p.hips[2]+front*(.053+sign*.037),floor+(sign===front?y:0),i*Math.PI);
      arm(p,side,add(p.chest,[sign*.238,-.091,front*.343]),[sign*.55,-.72,front*.12]);
    }
  }
  players[0].partner=players[1];
  return players[0];
}

const items=[
  ["4582",punch,"jab",false],["4583",punch,"cross",false],["4584",punch,"hook",false],
  ["4589",punch,"jab",true],["4590",punch,"left-up",true],["4591",punch,"cross",true],
  ["4592",punch,"hook",true],["4593",punch,"right-up",true],
  ["4585",kick,"low",false],["4586",kick,"front",false],["4587",kick,"snap",false],["4588",kick,"hook",false],
  ["4594",kick,"front",true],["4595",kick,"knee",true],["4596",kick,"snap",true],["4597",kick,"hook",true],
  ["5991",partnerShuffle,"shuffle",true],
];
const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue exercise IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
for(const [id,render,kind,partner] of items){
  if(wanted.length&&!wanted.includes(id))continue;
  const shuffle=render===partnerShuffle;
  const lower=render===kick;
  const equipment=shuffle?"none":partner?(lower?"spotter-kick-shield":"spotter-boxing-pad"):"spotter-boxing-bag";
  const muscles=shuffle?["glute","quad","calf"]:lower?["r:quad","core","glute"]:["shoulder","core","triceps"];
  const camera=shuffle?{yaw:54,elevation:22,focus:[0,.80,.18],height:2.06}:
    partner?{yaw:66,elevation:15,focus:[0,.91,.39],height:2.18}:{yaw:65,elevation:12,focus:[0,1.12,.38],height:2.60};
  const durationMs=shuffle?5400:lower?(kind==="snap"?3210:4050):(kind==="jab"?2900:3550);
  const keyframes=Array.from({length:65},(_,n)=>({at:n/64,...render(n/64,{kind,partner})}));
  const recipe=id+".json", data={version:1,equipment,durationMs,muscles,camera,keyframes};
  prepareRecipe(data);
  await writeFile(join(output,recipe),JSON.stringify(data)+"\n");
  manifest.push({id,recipe,posterAt:shuffle?.26:.50});
}
if(wanted.length&&wanted.length!==manifest.length)throw new Error("Invalid or duplicate exercise IDs.");
await writeFile(join(output,"batch.json"),JSON.stringify({kind:"catalogue",items:manifest})+"\n");
console.log(JSON.stringify({prepared:manifest.length}));
