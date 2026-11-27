import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, chestPress, curl, cycle, foot, fromSupport, inactive, ramp, scale, sides } from "./catalogue-dumbbell-recipes.mjs";

const floor=.075, x=[1,0,0], z=[0,0,1];
const unit=a=>scale(a,1/Math.max(.001,Math.hypot(...a)));
function order(t,stops){
  const i=stops.findIndex(([end])=>t<=end);
  return i<=0?stops[0][1]:blend(stops[i-1][1],stops[i][1],ramp(t,stops[i-1][0],stops[i][0]));
}
function hold(p,side,axis){
  p[side+"Grip"]=axis;
  p.dumbbells.push({center:p[side+"w"],axis});
}
function groupGrip(p,target,axis=x){
  for(const [side,sign] of sides){
    arm(p,side,add(target,[sign*.052,0,0]),[sign*.74,-.62,.19]);
    p[side+"Grip"]=axis;
  }
  p.dumbbells.push({center:scale(add(p.lw,p.rw),.5),axis});
}

function comparison(t,{form="curl"}={}){
  const u=cycle(t);
  const concentration=form==="concentration";
  const lateral=form==="lateral";
  const fly=form==="fly";
  const correct=()=>{
    if(fly)return chestPress(t,{setting:"flat",form:"fly"});
    if(!lateral)return curl(t,concentration?{setting:"seat",form:"concentration",mode:"single"}:{});
    const p=fromSupport("floor");
    for(const [side,sign] of sides){
      const theta=.08+1.47*u;
      arm(p,side,add(p[side+"s"],[sign*.59*Math.sin(theta),-.585*Math.cos(theta),.068]),[sign*.53,-.60,.12],z);
    }
    return p;
  };
  const wrong=()=>{
    if(fly)return chestPress(t,{setting:"flat",form:"wide"});
    const p=concentration?fromSupport("seat",{pitch:.46-.29*u}):body([0,.881,-.064*u],-.306*u);
    if(!concentration)for(const [side,sign] of sides)foot(p,side,sign,[sign*.142,floor,.062]);
    for(const [side,sign] of sides){
      if(concentration&&side==="r"){inactive(p,side,sign,"thigh");continue;}
      const a=.14+2.31*u;
      if(lateral){
        p[side+"s"]=add(p[side+"s"],[0,.113*u,.048*u]);
        arm(p,side,add(p[side+"s"],[sign*.522*u,-.566+.873*u,.088+.141*u]),[sign*.55,-.58,.11],z);
      }else{
        p[side+"e"]=add(p[side+"s"],[sign*.087,-.243+.153*u,.208*u]);
        p[side+"w"]=add(p[side+"e"],[sign*.020,-.371*Math.cos(a),.371*Math.sin(a)]);
        hold(p,side,x);
      }
    }
    return p;
  };
  const p=correct();
  p.partner=wrong();
  return p;
}

function kneelSequence(t,{form="diagonal"}={}){
  const half=!["halo","tall-diagonal","kneel-rise"].includes(form);
  const toStand=form==="kneel-rise"||form==="rack-rise";
  const u=cycle(t,.37,.62);
  const stand=toStand?order(t,[[0,[0]],[.22,[.3]],[.46,[1]],[.62,[1]],[.84,[.3]],[1,[0]]])[0]:0;
  const planted=half?1:ramp(stand,0,.29);
  const yaw=form.includes("diagonal")||form==="thor"?-.293+.626*u:0;
  const hinge=form==="clean"?.721*(1-ramp(t,.0,.28)*(1-ramp(t,.83,1))):0;
  const p=body([.014,.51+.366*stand,.045+.152*stand-.122*hinge],.03+hinge,yaw);
  p.planted={};
  for(const [side,sign] of sides){
    const front=side==="l";
    const step=front?planted:stand;
    const target=[sign*.154,floor+(1-step)*.015+Math.sin(Math.PI*step)*.141,-.391+step*(front?.746:.663)];
    foot(p,side,sign,target,[sign*.143,step>.40?.55:-.91,.64],[sign*.022,-.073,-.144+step*.281]);
    if(step>.995)p.planted[side]=0;
  }
  if(form==="halo"){
    const angle=t*Math.PI*2;
    groupGrip(p,[.292*Math.sin(angle),1.099+.230*(1-Math.cos(angle))/2,.275*Math.cos(angle)],unit([Math.cos(angle),0,-Math.sin(angle)]));
  }else if(form.includes("diagonal")||form==="thor"){
    const low=add(p.hips,[-.335,.064,.186]);
    const high=add(p.chest,[.272,.466,.287]);
    groupGrip(p,blend(low,high,u),unit([1,.512*u,.248*u]));
  }else if(form==="press"){
    arm(p,"l",add(p.ls,[.060,.073+.535*u,.163-.117*u]),[.75,-.29,.31],z);
    inactive(p,"r",-1,"thigh");
  }else if(form==="clean"){
    const track=order(t,[[0,[-.011,-.378,.417]],[.20,[.075,.002,.216]],[.45,[.047,.602,.068]],
      [.61,[.047,.602,.068]],[.78,[.075,.002,.216]],[1,[-.011,-.378,.417]]]);
    arm(p,"l",t<.10||t>.90?blend([.191,.085,.431],add(p.ls,track),ramp(t,.0,.10)*(1-ramp(t,.90,1))):add(p.ls,track),
      [.81,-.30,-.19],blend(z,x,u*.72));
    inactive(p,"r",-1,"thigh");
  }else if(form==="rack-rise"){
    groupGrip(p,add(p.chest,[0,.155,.222]),unit([1,.356,.103]));
  }else{
    groupGrip(p,add(p.chest,[0,.104,.213]));
  }
  return p;
}

function hingeArcs(t,{form="arm-arc"}={}){
  const u=cycle(t);
  const stork=form==="stork";
  const p=body([0,.824,-.173],stork?1.077:1.104);
  foot(p,"l",1,[.145,floor,.058],[.15,.14,.92]);
  foot(p,"r",-1,stork?[-.148,.518,-.823]:[-.154,floor,.056],[-.12,.16,.92]);
  if(stork)delete p.planted.r;
  for(const [side,sign] of sides){
    const s=p[side+"s"];
    if(stork){
      const e=add(s,[sign*.034,-.061,-.242]);
      p[side+"e"]=e;
      const a=.07+1.47*u;
      p[side+"w"]=add(e,[0,-.371*Math.cos(a),-.371*Math.sin(a)]);
      hold(p,side,[0,-Math.sin(a),Math.cos(a)]);
    }else{
      const path=order(u,[[0,[sign*.079,-.171,-.565]],[.48,[sign*.579,.010,.051]],[1,[sign*.089,.043,.605]]]);
      arm(p,side,add(s,path),[sign*.61,-.60,-.25],z);
    }
  }
  return p;
}

function windmill(t,{low=false}={}){
  const u=cycle(t);
  const p=body([.143*u,.880-.061*u,-.121*u],.04+.49*u,.227*u);
  const angle=.916*u;
  for(const part of ["chest","neck","head","ls","rs"]){
    const x=p[part][0]-p.hips[0], y=p[part][1]-p.hips[1];
    p[part][0]=p.hips[0]+x*Math.cos(angle)-y*Math.sin(angle);
    p[part][1]=p.hips[1]+x*Math.sin(angle)+y*Math.cos(angle);
  }
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.233,floor,sign*.070],[sign*.08,.073,.94],[-.068,-.073,.121]);
    if(side==="l")arm(p,side,add(p.ls,[.022,.607,.035]),[.72,-.23,.22],low?undefined:z);
    else arm(p,side,add(p.rs,[-.062,-.594,.092+.135*u]),[-.53,-.56,.15],low?z:undefined);
  }
  return p;
}

function jumps(t,{form="jack"}={}){
  const jet=form==="jack";
  const thrust=form==="thruster";
  const split=form==="split";
  const set=form==="sequence";
  const half=t<.5?t*2:(t-.5)*2;
  const hop=split||jet?Math.sin(Math.PI*half):set?.675*cycle((t-.82)/.18,.49,.65):0;
  const wide=jet?ramp(t,0,.48)*(1-ramp(t,.51,1)):0;
  const squat=thrust?cycle(t/.66):split?1-Math.sin(Math.PI*half):set?cycle(t/.34,.55,.72)+cycle((t-.75)/.16)*.3:0;
  const lTime=set?cycle((t-.27)/.30,.53,.73):0;
  const rTime=set?cycle((t-.53)/.30,.55,.71):0;
  const stride=split?.435*(t<.5?1:-1)*(1-2*ramp(half,.19,.83)):set?.557*(lTime-rTime):0;
  const press=jet?wide:thrust?ramp(t,.58,.73)*(1-ramp(t,.85,1)):0;
  const p=body([0,.882-.302*squat-.241*(lTime+rTime)+.197*hop,-.057*squat+.143*(lTime+rTime)],.039+.174*squat);
  p.planted={};
  for(const [side,sign] of sides){
    const y=floor+.160*hop+(split||set?Math.max(0,sign*-stride)*.205:0);
    foot(p,side,sign,[sign*(jet?.087+.260*wide:.151),y,.066+sign*stride],[sign*.19,.09,.94],
      [sign*.023,Math.max(-.166,.005-y),.140]);
    const s=p[side+"s"];
    arm(p,side,add(s,jet||thrust?[sign*.074,.065+.537*press,.162-.112*press]:[sign*.074,-.598,.056]),[sign*.59,-.49,-.43],z);
  }
  return p;
}

function ballisticClean(t,{form="strongman"}={}){
  const strong=form==="strongman";
  const cross=form==="cross";
  const twisted=form==="twisted";
  const load=order(t,[[0,[1]],[.24,[0]],[.45,[.20]],[.64,[0]],[.78,[.21]],[1,[1]]])[0];
  const overhead=cross?0:cycle((t-.31)/.50,.36,.70);
  const rack=cycle(t,.25,.78);
  const yaw=cross?-.47*load+.535*rack:twisted?-.46*load+.328*(1-overhead)*rack:0;
  const p=body([0,.875-(strong?.378:.167)*load-.063*rack,.052-.113*load],.048+(strong?.896:.488)*load,yaw);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.187,floor,.094],[sign*.19,.04,.98]);
  const floorHand=strong?[.194,.129,.191]:add(p.hips,[cross?-.209:.145,-.246,.245]);
  const shelf=add(p.ls,[cross?-.331:.079,.120,.160]);
  const top=add(p.ls,[.068,.601,.053]);
  const point=blend(blend(floorHand,shelf,rack),top,overhead);
  arm(p,"l",point,[.77,-.47,-.64],strong?blend(z,x,rack):z);
  if(strong&&load>.98&&rack<.04)p.dumbbells[0].center=floorHand;
  inactive(p,"r",-1);
  return p;
}

function swingSequence(t,{mode="cast"}={}){
  const first=t<.5;
  const u=cycle(first?t*2:(t-.5)*2);
  const direct=mode==="raise";
  const drift=direct?cycle(t):u;
  const p=body([0,.885-(direct?0:.097*u),.024],.025+(direct?0:.18*u),(first?1:-1)*(-.52+1.04*u));
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.159,floor,.069],[sign*.13,.02,.97]);
    if(!direct){
      const direction=first?1:-1;
      const lower=[-.241*direction+sign*.073,-.493,.177];
      const upper=[.331*direction+sign*.073,-.006,.504];
      arm(p,side,add(p[side+"s"],blend(lower,upper,u)),[sign*.55,-.48,-.44],z);
    }
  }
  if(direct){
    const a=.09+2.82*drift;
    groupGrip(p,add(p.chest,[0,.09-.525*Math.cos(a),.086+.423*Math.sin(a)]));
  }
  return p;
}

function floorUpper(t,{mode="superman"}={}){
  const sprinter=mode==="sprinter";
  const half=t<.5?t*2:(t-.5)*2;
  const p=sprinter?chestPress(half,{setting:"flat",startLow:true}):body([0,.144,-.034],1.553-.344*cycle(t));
  if(sprinter){
    for(const [side,sign] of sides){
      const time=side==="l"?t*2:(t-.5)*2;
      const rise=cycle(time);
      foot(p,side,sign,[.10+sign*.165,floor+.552*rise,1.661-.226*rise],[sign*.08,.82,.48]);
    }
  }else{
    const u=cycle(t);
    p.planted={};
    for(const [side,sign] of sides){
      foot(p,side,sign,[sign*.149,.094+.348*u,-.820],[sign*.078,.29,-.91],[sign*.013,-.022,-.146]);
      arm(p,side,add(p[side+"s"],[sign*.066,-.066+.269*u,.570-.087*u]),[sign*.55,-.48,-.52],x);
    }
  }
  return p;
}

const over=[54,16,[0,.99,.03],2.32], mat=[57,20,[0,.74,.07],1.90], flat=[62,19,[.1,.67,1.04],1.82];
const jobs=[];
function group(ids,motion,args,equipment,muscles,view=over,durationMs=4200,posterAt=.47,compare=false){
  for(const id of ids.split(" "))jobs.push({id,motion,args,equipment,muscles,view,durationMs,posterAt,compare});
}
group("2352",comparison,{},"dumbbells",["biceps"],[11,14,[0,1.01,.02],2.45],4900,.49,true);
group("2353",comparison,{form:"concentration"},"bench-dumbbell",["l:biceps"],[14,15,[.1,.77,1.36],2.20],4900,.49,true);
group("2337",comparison,{form:"fly"},"bench-dumbbells",["pec","shoulder"],[15,20,[.1,.71,1.02],2.73],5000,.50,true);
group("4967",comparison,{form:"lateral"},"dumbbells",["shoulder"],[13,15,[0,1.03,.02],2.64],4900,.49,true);
group("11799",hingeArcs,{},"dumbbells",["shoulder","trap"],[68,21,[0,.70,.11],1.99],5400,.48);
group("1742",hingeArcs,{form:"stork"},"dumbbells",["triceps","glute"],[60,18,[0,.66,-.15],2.12],4450);
group("10200",kneelSequence,{form:"halo"},"mat-dumbbell",["shoulder","core"],mat,5700,.50);
group("3686",kneelSequence,{form:"kneel-rise"},"mat-dumbbell",["quad","glute","core"],[59,18,[0,.89,.23],2.18],5900,.50);
group("5064",kneelSequence,{form:"rack-rise"},"mat-dumbbell",["quad","glute","shoulder"],[59,18,[0,.89,.23],2.18],5600,.49);
group("8502",kneelSequence,{form:"press"},"mat-dumbbell",["l:shoulder","l:triceps"],[57,17,[0,.84,.19],2.17],4300);
group("4572",kneelSequence,{},"mat-dumbbell",["shoulder","core"],[51,19,[0,.81,.18],2.06],4800);
group("10093",kneelSequence,{form:"thor"},"mat-dumbbell",["shoulder","core"],[55,16,[0,.81,.18],2.06],4700);
group("8505",kneelSequence,{form:"tall-diagonal"},"mat-dumbbell",["shoulder","core"],[56,18,[0,.82,.10],2.02],4900);
group("10117",kneelSequence,{form:"clean"},"mat-dumbbell",["l:shoulder","l:triceps","core"],[56,16,[0,.85,.19],2.19],5800);
group("4746",windmill,{low:true},"dumbbell",["core","hamstring"],[28,17,[0,1.02,.04],2.46]);
group("4888",windmill,{},"dumbbell",["l:shoulder","core"],[32,17,[0,1.03,.04],2.50]);
group("4901",windmill,{},"dumbbell",["l:shoulder","core"],[25,15,[0,1.03,.04],2.48]);
group("0504",jumps,{},"dumbbells",["shoulder","quad","calf"],[34,13,[0,1.06,.06],2.45],4000,.37);
group("3707",jumps,{form:"thruster"},"dumbbells",["quad","glute","shoulder"],over,5150,.71);
group("1554",jumps,{form:"split"},"dumbbells",["quad","glute","calf"],[62,15,[0,.94,.03],2.26],5100,.24);
group("4564",jumps,{form:"sequence"},"dumbbells",["quad","glute","calf"],over,6500,.32);
group("10094",ballisticClean,{form:"cross"},"dumbbell",["l:shoulder","core"],[46,17,[0,.96,.09],2.28],4900,.45);
group("2814",ballisticClean,{form:"twisted"},"dumbbell",["l:shoulder","quad","core"],[47,15,[0,1.00,.05],2.46],5400,.55);
group("2732",ballisticClean,{},"circus-dumbbell",["l:shoulder","quad","glute"],[57,16,[0,1.04,.05],2.54],6200,.53);
group("0777",swingSequence,{},"dumbbells",["core","shoulder"],[40,15,[0,.92,.11],2.22],5500,.23);
group("10559",swingSequence,{mode:"raise"},"dumbbell",["shoulder","core"],over,4450,.44);
group("3454",floorUpper,{},"mat-dumbbells",["glute","hamstring","trap"],[65,23,[0,.35,-.08],1.61],4300);
group("5284",floorUpper,{mode:"sprinter"},"bench-dumbbells",["pec","triceps","core"],flat,5450,.25);

const [directory,...wanted]=process.argv.slice(2);
if(!directory)throw new Error("Pass an output directory and optional catalogue IDs.");
if(new Set(jobs.map(({id})=>id)).size!==jobs.length)throw new Error("Duplicate catalogue IDs.");
const selected=wanted.length?jobs.filter(({id})=>wanted.includes(id)):jobs;
if(wanted.length&&selected.length!==wanted.length)throw new Error("Invalid or duplicate requested catalogue IDs.");
const output=resolve(directory);
await mkdir(output,{recursive:true,mode:0o700});
const manifest=[];
const failures=[];
for(const {id,motion,args,equipment,muscles,view,durationMs,posterAt,compare} of selected){
  const [yaw,elevation,focus,height]=view;
  const data={version:1,durationMs,equipment,muscles,camera:{yaw,elevation,focus,height},...(compare?{formComparison:true}:{}),
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
