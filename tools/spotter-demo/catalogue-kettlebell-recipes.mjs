import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides = [['l',1],['r',-1]];
const add = (a,b)=>a.map((n,i)=>n+b[i]);
const scale = (a,k)=>a.map(n=>n*k);
const minus = (a,b)=>add(a,scale(b,-1));
const dot = (a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const unit = a=>scale(a,1/(Math.hypot(...a)||1));
const mix = (a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
const smooth = v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
const wave = t => (1-Math.cos(2*Math.PI*t))/2;
function arc(t,stops) {
  let index=1;
  while(index<stops.length-1 && t>stops[index][0]) index++;
  const [start,a]=stops[index-1], [end,b]=stops[index];
  return mix(a,b,smooth((t-start)/(end-start)));
}
function limb(root,destination,guide,a,b) {
  const delta=minus(destination,root);
  const span=Math.max(Math.abs(a-b)+.005,Math.min(a+b-.004,Math.hypot(...delta)));
  const u=unit(delta);
  const d=(a*a-b*b+span*span)/(2*span);
  const bend=unit(minus(guide,scale(u,dot(guide,u))));
  return [add(root,add(scale(u,d),scale(bend,Math.sqrt(a*a-d*d)))),add(root,scale(u,span))];
}
function person(hips,pitch=0,sideBend=0) {
  const up=unit([Math.sin(sideBend),Math.cos(pitch)*Math.cos(sideBend),Math.sin(pitch)]);
  const lateral=unit([up[1],-up[0],0]);
  const at=(h,x=0)=>add(hips,add(scale(up,h),scale(lateral,x)));
  return {hips,chest:at(.367),neck:at(.604),head:at(.730),ls:at(.502,.191),rs:at(.502,-.191),
    lh:at(0,.104),rh:at(0,-.104),planted:{},kettlebells:[]};
}
function foot(p,side,sign,goal,planted=true) {
  [p[side+'k'],p[side+'a']]=limb(p[side+'h'],goal,[sign*.22,.075,1],.422,.424);
  p[side+'t']=add(p[side+'a'],[sign*.026,-.072,.149]);
  if (planted) p.planted[side]=0;
}
function arm(p,side,target,pole,handle,down) {
  [p[side+'e'],p[side+'w']]=limb(p[side+'s'],target,pole,.252,.371);
  if (!handle) return;
  p[side+'Grip']=handle;
  p.kettlebells.push({grip:p[side+'w'],handle,down});
}
function idle(p,side,sign) {
  arm(p,side,add(p[side+'s'],[sign*.065,-.474,.062]),[sign*.65,-.53,-.14]);
}
function press(t,{floor=false,seated=false,single=false,alternate=false,arnold=false,
    lateral=false,seesaw=false,drive,hinge=false}={}) {
  const push=wave(t);
  const dip=drive? .11*wave(Math.max(0,Math.min(1,(t-.045)/.37)))+(drive==='jerk'?.072*wave(Math.max(0,Math.min(1,(t-.36)/.30))):0):0;
  const p=person([0,floor?.143:seated?.503:.875-dip,floor?.223:0],floor?-Math.PI/2:hinge?.758:dip*.56);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*(seated?.226:.144),.075,floor?.740:seated?.445:.057]);
    if (single && sign<0) { idle(p,side,sign); continue; }
    const amount=seesaw ? (sign>0 ? 1-push : push) : alternate ? (t<.5)===(sign>0)?wave(t*2):0 : push;
    const s=p[side+'s'];
    const from=floor?[sign*.220,.201,.109]:[sign*(arnold?.006:.127),.105,.161];
    const top=floor?[sign*.029,.604,.039]:[sign*(lateral?.284:.049),lateral?.505:.590,.034];
    const handle=arnold? unit(mix([-sign,0,.37],[sign,0,.30],amount)):[sign,0,0];
    arm(p,side,add(s,mix(from,top,amount)),[sign*.77,-.57,.21],handle,
      floor?[0,-.35,-.94]:[0,-.70,-.714]);
  }
  return p;
}
function row(t,{single=false,sumo=false}={}) {
  const v=wave(t);
  const p=person([0,sumo?.789-.115*(1-v):.787, sumo?-.058:-.179],sumo?.25:.91);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*(sumo?.318:.170),.075,.068]);
    if (single && sign < 0) { arm(p,side,[-.235,.634,.225],[-.24,-.59,.43]); continue; }
    if (sumo && sign < 0) { arm(p,side,add(p.lw,[-.065,0,0]),[-.68,-.43,-.14]);p.rGrip=[1,0,0];continue; }
    const wrist=add(p[side+'s'],sumo ? [-.148,-.545+.454*v,.24-.084*v]:[sign*.047,-.597+.375*v,.021-.203*v]);
    arm(p,side,wrist,[sign*(sumo?.865:.14),-.15,-.924],sumo?[1,0,0]:[0,0,1],[0,-1,0]);
  }
  if (sumo) p.kettlebells[0].grip = scale(add(p.lw,p.rw),.5);
  return p;
}
function squat(t,{pistol=false,thruster=false,pass=false}={}) {
  const push=wave(t);
  const depth=thruster ? wave(Math.min(t/.53,1)) : push;
  const rise=thruster ? wave(Math.min(1,Math.max(0,(t-.44)/.56))) : 0;
  const p=person([pistol?-.072:0,.876-(pistol?.397:.338)*depth,pistol?-.107*depth:-.199*depth],.024+.40*depth);
  for (const [side,sign] of sides) {
    const far=pistol&&sign>0;
    foot(p,side,sign,[sign*(pass?.176:.157),far?.077+.150*depth:.075,
      far?.306+.608*depth:pass?sign*.39:.058],!far);
    const location = pass ? [sign*.027,.548-.214*depth,.133+.043*Math.sin(t*2*Math.PI)]
      : add(p[side+'s'],pistol?[sign*(-.116),-.222,.461]:[sign*(.112-.058*rise),.095+.49*rise,.166-.122*rise]);
    arm(p,side,location,[sign*.71,-.49,.12],[sign,0,0],
      pistol || pass ? [0,-1,0]:[0,-.65,-.76]);
  }
  if (pistol || pass) {
    p.kettlebells = [{grip:scale(add(p.lw,p.rw),.5),handle:[1,0,0],down:[0,-1,0]}];
  }
  return p;
}

function clean(t,{single=false,alternate=false,snatch=false,bottoms=false}={}) {
  const dip=arc(t,[[0,[.90]], [.20,[.49]], [.33,[.08]], [.53,[0]], [.67,[0]], [.82,[.10]], [1,[.90]]])[0];
  const p=person([0,.879-dip*.134,-dip*.19],dip*.89);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*.193,.075,.064]);
    if(single&&sign<0){idle(p,side,sign);continue;}
    const phase=alternate ? (t<.5)===(sign>0)?t*2%1:0 : t;
    const hang=[sign*.184,.647,.092];
    const rack=[sign*.270,1.434,.167];
    const top=snatch?[sign*.247,1.938,.083]:rack;
    const point=arc(phase,[[0,hang],[.14,[sign*.178,.528,-.218]],[.31,[sign*.237,.995,.286]],
      [.48,top],[.62,top],[.76,rack],[1,hang]]);
    const upright=smooth((phase-.32)/.17)*(1-smooth((phase-.79)/.19));
    arm(p,side,point,[sign*.54,-.61,-.12],[sign,0,0],
      bottoms?unit([0,-1+2*upright,-.44*upright]):unit([0,-1+.32*upright,-.78*upright]));
  }
  return p;
}
function windmill(t,{advanced}) {
  const v=wave(t);
  const p=person([-.087*v,.857-.075*v,-.062*v],(advanced?.72:.58)*v,-.70*v);
  for(const [side,sign] of sides) {
    foot(p,side,sign,[sign*.232,.075,sign*.102]);
    const s=p[side+'s'];
    if(sign>0) arm(p,side,add(s,[.016,.607,.021]),[.84,-.16,.13],[1,0,0],[0,-.68,-.73]);
    else arm(p,side,add(s,[-.036,-.568,.204*v]),[-.78,-.19,.27],undefined,undefined);
  }
  return p;
}
const items = [
  ['0520',press,{alternate:true},'kettlebells',['shoulder','triceps']],
  ['0519',press,{alternate:true,floor:true},'mat-kettlebells',['pec','triceps']],
  ['0523',press,{arnold:true},'kettlebells',['shoulder']],
  ['0527',press,{drive:'jerk'},'kettlebells',['shoulder','quad']],
  ['0528',press,{drive:'push'},'kettlebells',['shoulder','quad']],
  ['1298',press,{single:true,floor:true},'mat-kettlebell-left',['pec','triceps']],
  ['0538',press,{single:true,drive:'jerk'},'kettlebell-left',['l:shoulder','quad']],
  ['0539',press,{single:true,lateral:true},'kettlebell-left',['l:shoulder','l:triceps']],
  ['0540',press,{single:true,drive:'push'},'kettlebell-left',['l:shoulder','quad']],
  ['0546',press,{seated:true},'seat-kettlebells',['shoulder']],
  ['1438',press,{seated:true},'seat-kettlebells',['shoulder','triceps']],
  ['0547',press,{seesaw:true},'kettlebells',['shoulder','core']],
  ['0553',press,{},'kettlebells',['shoulder','triceps']],
  ['0541',row,{single:true},'kettlebell-left',['l:lat','l:biceps']],
  ['1345',row,{},'kettlebells',['lat','biceps']],
  ['0548',row,{sumo:true},'kettlebell-left',['glute','quad','shoulder']],
  ['0533',squat,{},'kettlebells',['quad','glute']],
  ['0544',squat,{pistol:true},'kettlebell-left',['r:quad','r:glute']],
  ['0550',squat,{thruster:true},'kettlebells',['quad','glute','shoulder']],
  ['0525',clean,{single:true,bottoms:true},'kettlebell-left',['l:shoulder','l:forearm']],
  ['0529',clean,{snatch:true},'kettlebells',['glute','shoulder']],
  ['0535',clean,{single:true},'kettlebell-left',['l:shoulder','glute']],
  ['0542',clean,{single:true,snatch:true},'kettlebell-left',['l:shoulder','glute']],
  ['0552',clean,{},'kettlebells',['shoulder','glute']],
  ['0518',clean,{alternate:true},'kettlebells',['shoulder','glute']],
  ['0554',windmill,{},'kettlebell-left',['core','l:shoulder']],
  ['0517',windmill,{advanced:true},'kettlebell-left',['core','shoulder']],
];
const [directory]=process.argv.slice(2);
if(!directory) throw new Error('Pass an output directory.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const jobs=[];
const failed=[];
for(const [id,move,settings,equipment,muscles] of items){
  const recipe=id+'.json';
  const data={version:1,durationMs:settings.alternate?5650:4050,equipment,muscles,
    camera:{yaw:settings.floor?62:48,elevation:16,focus:[0,settings.floor?.48:settings.seated?.76:.98,.035],
      height:settings.floor?1.65:settings.seated?1.90:2.34},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...move(i/60,settings)}))};
  try{prepareRecipe(data);await writeFile(resolve(output,recipe),JSON.stringify(data)+'\n');
    jobs.push({id,recipe,posterAt:settings.alternate?.25:.47});}
  catch(error){failed.push({id,error:error.message});}
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items:jobs},null,2)+'\n');
console.log(JSON.stringify({prepared:jobs.length,failed},null,2));
if(failed.length)process.exitCode=1;
