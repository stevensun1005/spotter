import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides=[['l',1],['r',-1]];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const sub=(a,b)=>add(a,scale(b,-1));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>scale(a,1/(Math.hypot(...a)||1));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const wave=t=>(1-Math.cos(2*Math.PI*t))/2;
function limb(start,end,pole,a,b) {
  const delta=sub(end,start);
  const span=Math.min(a+b-.005,Math.max(Math.abs(a-b)+.005,Math.hypot(...delta)));
  const u=unit(delta);
  const c=(a*a-b*b+span*span)/(2*span);
  const bend=unit(sub(pole,scale(u,dot(u,pole))));
  return [add(start,add(scale(u,c),scale(bend,Math.sqrt(a*a-c*c)))),add(start,scale(u,span))];
}
function body(hips,pitch) {
  const up=[0,Math.cos(pitch),Math.sin(pitch)];
  const at=(h,x=0)=>add(hips,add(scale(up,h),[x,0,0]));
  return {hips,chest:at(.370),neck:at(.605),head:at(.730),lh:at(0,.103),rh:at(0,-.103),
    ls:at(.498,.189),rs:at(.498,-.189),planted:{}};
}
function leg(p,side,sign,destination,toe,planted) {
  [p[side+'k'],p[side+'a']]=limb(p[side+'h'],destination,[sign*.14,.13,1],.422,.424);
  p[side+'t']=add(p[side+'a'],toe);
  if(planted) p.planted[side]=0;
}
function hand(p,side,sign,point,orientation) {
  [p[side+'e'],p[side+'w']]=limb(p[side+'s'],point,[sign*.59,-.62,-.38],.252,.371);
  p[side+'Grip']=orientation;
}
function battle(phase) {
  const t=phase*3*2*Math.PI;
  const p=body([0,.743+.018*Math.cos(t*2),-.252],.275);
  const anchor=[0,.099,2.31];
  p.ropeTracks=[];
  for(const [side,sign] of sides){
    leg(p,side,sign,[sign*.229,.075,.008],[sign*.024,-.070,.149],true);
    const rate=t+(sign===1?0:Math.PI);
    const wrist=[sign*.210,1.008+.198*Math.sin(rate),.230+.081*Math.cos(rate)];
    hand(p,side,sign,wrist,[0,.12,1]);
    p.ropeTracks.push(Array.from({length:25},(_,i)=>{
      const u=i/24;
      const blend=mix(p[side+'w'],anchor,u);
      blend[1]=.099+(p[side+'w'][1]-.099)*Math.exp(-4.3*u)*(1-u)+.218*Math.sin(rate-20.8*u)*Math.sin(Math.PI*u)*(1-u);
      blend[1]=Math.max(.022,blend[1]);
      blend[0]+=sign*.153*Math.sin(Math.PI*u);
      return blend;
    }));
  }
  return p;
}
function stretch(phase,{outer,inner,standing}) {
  const v=wave(phase);
  const y=standing?.864:.176;
  const p=body([0,y,standing?-.096:-.316],standing?.37+.63*v:.15+.23*v);
  for (const [side,sign] of sides){
    const ankle=standing?[sign*.151,.075,sign>.5?.352:-.117]:[sign*.152,.077,.489];
    const toe=[sign*.017+(sign>0?(outer?.092:inner?-.092:0)*v:0),
      (standing?-.000:.035)+.098*v*(sign>0),.156-.053*v*(sign>0)];
    leg(p,side,sign,ankle,toe,standing && sign<0);
    const point=[sign*.116,standing?.874-.193*v:.502-.078*v,standing?.283+.092*v:.184-.023*v];
    hand(p,side,sign,point,[.09,.07,1]);
  }
  const toe=p.lt, boundary=add(toe,[0,-.018,.032]);
  p.ropeTracks=[[p.lw,add(boundary,[.054,0,0]),add(boundary,[0,-.030,.031]),add(boundary,[-.054,0,0]),p.rw]];
  return p;
}
function climb(phase) {
  const ascent = 1 - Math.abs(phase*2 - 1);
  const ease = t => { const x=Math.min(1,Math.max(0,t)); return x*x*(3-2*x); };
  const height = ease(ascent);
  const squeeze = ease(ascent / .26);
  const p=body([0,.874+.65*height,-.085],.050);
  const ropeZ=.260;
  for(const [side,sign] of sides){
    const offset=sign>0?.24:.76;
    const cycles=ascent*2.8+offset;
    const fractional=cycles-Math.floor(cycles);
    const step=.253*(Math.floor(cycles)+ease((fractional-.28)/.50));
    const handY=1.578+step;
    const reach=Math.sin(Math.PI*ease((fractional-.28)/.5));
    const released= Math.max(0,reach-.83)*.24;
    const ankle=[sign*(.144-.066*squeeze),.075*(1-squeeze)+(p.hips[1]-.531)*squeeze,
      .066+.082*squeeze];
    leg(p,side,sign,ankle,[sign*-.046*squeeze,-.072,.146],squeeze<.02);
    hand(p,side,sign,[sign*(.021+released),handY,ropeZ-.052*released],[0,1,0]);
  }
  p.ropeTracks=[[[0,2.78,ropeZ],[0,1.49,ropeZ],[0,.045,ropeZ]]];
  return p;
}
function ankleTow(phase) {
  const q=wave(phase);
  const p=body([0,.133,.018],-Math.PI/2);
  for(const [side,sign] of sides) {
    const height=sign>0?.375+.314*q:.070;
    const depth=sign>0?.505-.265*q:.839;
    const toe=sign>0?[.009,.064+.070*q,.141-.053*q]:[-.019,-.055,.130];
    leg(p,side,sign,[sign*.129,height,depth],toe,false);
    hand(p,side,sign,[sign*.156,.182+.180*q,-.107+.157*q],[0,.12,1]);
  }
  const point=add(p.lt,[0,.016,.027]);
  p.ropeTracks=[[p.lw,add(point,[.054,0,0]),add(point,[0,.011,.023]),add(point,[-.054,0,0]),p.rw]];
  return p;
}
function towelExtension(phase) {
  const q=wave(phase);
  const p=body([0,.873,.029],.018);
  for(const[side,sign] of sides){
    leg(p,side,sign,[sign*.172,.075,.069],[sign*.017,-.073,.146],true);
    const angle=.537+1.51*(1-q);
    const s=p[side+'s'];
    const e=add(s,[sign*-.048,.237,.096]);
    p[side+'e']=e;
    p[side+'w']=add(e,[sign*.016,.359*Math.cos(angle),-.359*Math.sin(angle)]);
    p[side+'Grip']=[sign,0,0];
  }
  const center=scale(add(p.lw,p.rw),.5);
  p.ropeTracks=[[p.lw, add(center,[0,-.065,-.030]),p.rw]];
  return p;
}

const moves=[
  ['1708',ankleTow,{},'stretch-rope',['l:calf'],{yaw:60,elevation:26,focus:[0,.42,-.08],height:1.59},4600],
  ['0018',towelExtension,{},'extension-towel',['triceps'],{yaw:123,elevation:13,focus:[0,1.06,0],height:2.40},4150],
  ['0128',battle,{},'battle-ropes',['shoulder','core'],{yaw:66,elevation:20,focus:[0,.84,.83],height:2.43},3750],
  ['1378',stretch,{},'stretch-rope',['l:calf'],{yaw:59,elevation:22,focus:[0,.49,.09],height:1.45},4350],
  ['1388',stretch,{outer:true},'stretch-rope',['l:calf'],{yaw:40,elevation:23,focus:[0,.48,.075],height:1.41},4400],
  ['1389',stretch,{inner:true},'stretch-rope',['l:calf'],{yaw:44,elevation:23,focus:[0,.49,.08],height:1.47},4400],
  ['1599',stretch,{standing:true},'stretch-rope',['l:calf','l:hamstring'],{yaw:57,elevation:16,focus:[0,.89,.105],height:2.22},4600],
  ['0680',climb,{},'climb-rope',['lat','forearm','core'],{yaw:57,elevation:8,focus:[0,1.45,.13],height:3.15},5900],
];
const [folder,...ids]=process.argv.slice(2);
if(!folder)throw new Error('Pass an output directory.');
const out=resolve(folder);
await mkdir(out,{recursive:true});
const items=[];
for(const [id,motion,parameters,equipment,muscles,camera,durationMs] of moves) {
  if(ids.length&&!ids.includes(id))continue;
  const recipe=id+'.json';
  const data={version:1,equipment,muscles,camera,durationMs,keyframes:Array.from({length:65},(_,i)=>({at:i/64,...motion(i/64,parameters)}))};
  prepareRecipe(data);
  await writeFile(resolve(out,recipe),JSON.stringify(data)+'\n');
  items.push({id,recipe,posterAt:.42});
}
await writeFile(resolve(out,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
