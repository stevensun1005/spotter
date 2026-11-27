import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides=[['l',1],['r',-1]];
const plus=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,v)=>a.map(n=>n*v);
const minus=(a,b)=>plus(a,scale(b,-1));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=(a)=>scale(a,1/(Math.hypot(...a)||1));
const cross=([x,y,z],[a,b,c])=>[y*c-z*b,z*a-x*c,x*b-y*a];
const rep=(t)=>(1-Math.cos(t*2*Math.PI))/2;

function limb(origin,target,pole,a,b) {
  const vector=minus(target,origin);
  const span=Math.min(a+b-.005,Math.max(Math.abs(a-b)+.005,Math.hypot(...vector)));
  const w=unit(vector);
  const d=(a*a+span*span-b*b)/(2*span);
  const k=unit(minus(pole,scale(w,dot(pole,w))));
  return [plus(origin,plus(scale(w,d),scale(k,Math.sqrt(a*a-d*d)))),plus(origin,scale(w,span))];
}
function circular(start,end,distance,normal,value) {
  const delta=minus(end,start);
  const midpoint=plus(start,scale(delta,.5));
  const offset=scale(unit(cross(delta,normal)),distance);
  const pivot=plus(midpoint,offset);
  const radius=minus(start,pivot);
  const target=minus(end,pivot);
  const n=unit(cross(radius,target));
  const angle=Math.atan2(Math.hypot(...cross(radius,target)),dot(radius,target))*value;
  const point=plus(pivot,plus(scale(radius,Math.cos(angle)),scale(cross(n,radius),Math.sin(angle))));
  return {pivot,point};
}
function body(spec,amount) {
  const {standing,incline,fly}=spec;
  const poseAngle=incline?-.27:fly==='reverse'?.19:standing?.134:.015;
  const trunk=[0,Math.cos(poseAngle),Math.sin(poseAngle)];
  const hips=[0,standing?.875:.520,standing?-.042:0];
  const at=(size,x=0)=>plus(hips,plus(scale(trunk,size),[x,0,0]));
  return {hips,chest:at(.370),neck:at(.602),head:at(.729),ls:at(.496,.191),rs:at(.496,-.191),
    lh:at(0,.104),rh:at(0,-.104),planted:{l:0,r:0},leverPressHandles:[]};
}
function motion(t,spec) {
  const {grip,incline,decline,standing,inner,fly,shoulder,lateral,dip,curl,extension,variant,single,highFly}=spec;
  const amount=rep(t);
  const p=body(spec,amount);
  for (const [side,sign] of sides) {
    const actual = single && sign<0 ? 0 : amount;
    const s=p[side+'s'];
    [p[side+'k'],p[side+'a']]=limb(p[side+'h'],[sign*.162,.075,standing?sign*.127+.113:.471],[sign*.192,.53,.28],.422,.424);
    p[side+'t']=plus(p[side+'a'],[sign*.019,-.073,.138]);
    let start=plus(s,[sign*.142,-.097,.158]);
    let end=plus(s,[sign*(inner?-.102:.076),incline?.148:decline?-.282:-.105,.568]);
    let normal=[1,0,0];
    let offset=-.53;
    let guide=[sign*.88,-.66,.05];
    let axis=grip==='vertical'?[0,1,0]:grip==='under'?[-sign,0,0]:[sign,0,0];
    if (fly) {
      const close=plus(s,[-sign*.122,highFly?.034:-.075,.498]);
      const wide=plus(s,[sign*.538,highFly?.012:-.098,.052]);
      [start,end]=fly==='reverse'?[close,wide]:[wide,close];
      normal=[0,sign,0];offset=.41;guide=[sign*.34,-.73,.06];axis=grip==='neutral'?[0,1,0]:[sign,0,0];
    } else if (lateral) {
      start=plus(s,[sign*.115,-.392,.170]);
      end=plus(s,[sign*.517,-.104,.163]);
      normal=[0,0,sign];offset=.26;guide=[sign*.73,-.42,-.10];axis=[0,0,1];
    } else if (shoulder) {
      start=plus(s,[sign*.148,.058,.132]);
      end=plus(s,[sign*(variant===3?.155:.060),.576,variant===2?.164:.089]);
      offset=variant===3 ? .43 : -.49;
      axis=variant===2 ? [0,0,1] : grip==='under'?[-sign,0,0]:[sign,0,0];
    } else if (dip||extension||curl) {
      start=plus(s,[sign*(curl?.083:.193),-.223,curl?.440:.187]);
      end=plus(s,[sign*(curl?.083:.193),curl?.027:-.555,curl?.193:.174]);
      normal=[sign,0,0];offset=.26;
      axis=extension?[0,0,1]:curl?[-sign,0,0]:[sign,0,0];
    }
    const {pivot,point}=circular(start,end,offset,normal,actual);
    const armTarget=single&&sign<0?plus(s,[-.074,-.493,.053]):point;
    [p[side+'e'],p[side+'w']]=limb(s,armTarget,guide,.252,.371);
    if(!single||sign>0) p[side+'Grip']=axis;
    p.leverPressHandles.push({pivot,point,axis});
  }
  return p;
}
function lowerBody(t,spec) {
  const {motion,variant}=spec;
  const half = t<.5?1:-1;
  const isSingle = motion === 'leg' && spec.single;
  const q=rep(isSingle?(t*2)%1:t);
  const isCalf=motion==='calf';
  const standing=isCalf&&variant==='standing';
  const reverse=motion==='reverse';
  const twist=motion==='twist';
  const compress=motion==='crunch';
  const good=motion==='hinge';
  const crunchAngle=compress||good ? (.08+(good?.75:.49)*q) : reverse ? 1.38 : twist ? .05:.08;
  const p=body({standing,incline:motion==='leg'},q);
  if (compress||good||twist||reverse) {
    const start=twist?[0,.427,-.041]:reverse?[0,.905,-.039]:[0,.528,.008];
    const yaw=twist?.57*Math.sin(2*Math.PI*t):0;
    const center=(height,x=0)=>plus(start,[x*Math.cos(yaw)+Math.sin(yaw)*height*Math.sin(crunchAngle),height*Math.cos(crunchAngle),height*Math.sin(crunchAngle)*Math.cos(yaw)-x*Math.sin(yaw)]);
    Object.assign(p,{hips:start,chest:center(.367),neck:center(.606),head:center(.727),ls:center(.498,.190),rs:center(.498,-.190),lh:center(0,.103),rh:center(0,-.103)});
  }
  if (standing) {
    for (const key of ['hips','chest','neck','head','ls','rs','lh','rh']) p[key]=plus(p[key],[0,.103+.085*q,0]);
  }
  const directions=[];
  for (const [side,sign] of sides) {
    const s=p[side+'s'];
    let ankle=[sign*.162,.075,standing?sign*.063+.126:.467];
    let kneeGuide=[sign*.14,.64,.91];
    let pole=[sign*.75,-.67,-.10];
    let grip=[sign*.255,.512,.094];
    const armAxis=[1,0,0];
    let pivot,point,axis;
    switch(motion) {
      case 'leg': {
        const travel = isSingle && half!==sign ? 0 : q;
        pivot=[sign*.305,.187,.888];
        point=plus(pivot,[0,.302*Math.cos((variant==='horizontal'?.68:.46)-1.16*travel),-.302*Math.sin(.46-1.16*travel)]);
        ankle=isSingle&&half!==sign?[sign*.345,.074,.402]:plus(point,[sign*-.101,.116,-.104]);
        axis=[1,0,0];
        break;
      }
      case 'hip': {
        const abduct=variant==='abduct';
        const angle=abduct?.33+.43*q:.75-.43*q;
        pivot=[sign*.100,.566,.123];
        point=plus(pivot,[sign*.365*Math.sin(angle),-.101,.365*Math.cos(angle)]);
        ankle=plus(point,[sign*(abduct?-.095:.095),-.334,.106]);
        kneeGuide=[sign*(.18+.50*q),.70,.79];
        axis=[0,0,1];
        break;
      }
      case 'calf': {
        pivot=[sign*.31,standing?1.031:.192,standing?-.18:.567];
        if(standing){
          const offset=.085*q;
          ankle=[sign*.158,.179+offset,.257];
          point=[sign*.189,1.365+offset,.043];
          grip=[sign*.262,1.324+offset,.296];
        }else{
          point=variant==='seated'?[sign*.152,.527+.067*q,.397]:[sign*.155,.076+.073*q,.489+.028*q];
          ankle=variant==='seated'?[sign*.158,.144+.062*q,.469]:plus(point,[0,.082+.058*q,-.132+.061*q]);
          grip=variant==='seated'?[sign*.185,.649,.436]:[sign*.264,.508,.149];
        }
        axis=[1,0,0];
        break;
      }
      case 'reverse': {
        pivot=[sign*.269,.707,-.262];
        const angle=.50+1.08*q;
        ankle=plus(p[side+'h'],[sign*.046,-.827*Math.cos(angle),-.827*Math.sin(angle)]);
        point=plus(ankle,[0,.024,-.076]);
        grip=[sign*.229,.803,.477];
        kneeGuide=[sign*.12,-.43,-.42];
        axis=[1,0,0];
        break;
      }
      case 'twist': {
        pivot=[sign*.31,.135,-.021];
        const kneeTurn=.332*Math.sin(2*Math.PI*t);
        point=plus(p[side+'h'],[sign*.063+.113*kneeTurn,-.253,.323-.061*kneeTurn*sign]);
        ankle=plus(point,[0,.036,-.419]);
        grip=[sign*.31,.993,.461];
        pole=[sign*.56,-.20,-.83];
        axis=[1,0,0];
        break;
      }
      default: {
        pivot=[sign*.312,.655,-.142];
        const upper=p[side+'s'];
        point=good?plus(p.hips,[sign*.066,.177,-.137+.07*q]):plus(upper,[sign*.062,-.151,.157]);
        const reach = variant==='overhead' ? plus(p.head,[sign*.126,.136,.088]) : point;
        grip = good ? [sign*.255,.516,.097] : reach;
        if (variant==='leg-bend') ankle=[sign*.163,.112+.256*q,.529+.024*q];
        axis=[1,0,0];
      }
    }
    const fixedFoot = !(motion==='leg'||motion==='reverse'||motion==='hip'||motion==='twist'||(motion==='calf'&&variant==='rotary')||(compress&&variant==='leg-bend'));
    if(standing) p.planted[side]=.102;
    else if(fixedFoot && isCalf) p.planted[side]=.069;
    else if(fixedFoot) p.planted[side]=0;
    else delete p.planted[side];
    const proximal=p[side+'h'];
    if(twist){
      p[side+'k']=point;
      p[side+'a']=ankle;
    } else {
      [p[side+'k'],p[side+'a']]=limb(proximal,ankle,kneeGuide,.422,.424);
    }
    const a=p[side+'a'];
    const toe=motion==='leg'? [0,.100,.107] : motion==='reverse'?[sign*.016,-.125,.075]:
      isCalf&&fixedFoot?[sign*.016,p.planted[side]+.006-a[1],.142] : [sign*.015,-.075,.142];
    p[side+'t']=plus(a,toe);
    [p[side+'e'],p[side+'w']]=limb(p[side+'s'],grip,pole,.252,.371);
    p[side+'Grip']=armAxis;
    directions.push({pivot,point,axis});
  }
  p.leverPressHandles=directions;
  return p;
}

function seatedStation(lean=.02) {
  const p=body({},0);
  const at=(height,x=0)=>[x,.535+height*Math.cos(lean),.013+height*Math.sin(lean)];
  Object.assign(p,{hips:at(0),chest:at(.370),neck:at(.602),head:at(.729),
    ls:at(.496,.191),rs:at(.496,-.191),lh:at(0,.104),rh:at(0,-.104)});
  return p;
}

function groundStation(p) {
  for(const [side,sign] of sides){
    [p[side+'k'],p[side+'a']]=limb(p[side+'h'],[sign*.162,.075,.471],[sign*.192,.53,.28],.422,.424);
    p[side+'t']=plus(p[side+'a'],[sign*.019,-.073,.138]);
  }
}

function paddedPress(t,{contact}) {
  const p=seatedStation();
  groundStation(p);
  const amount=rep(t);
  for(const [side,sign] of sides){
    const shoulder=p[side+'s'];
    const lateral=contact==='lateral';
    const spread=lateral ? .158+1.26*amount : 1.37*(1-amount)+.08;
    const point=lateral
      ? plus(shoulder,[sign*.255*Math.sin(spread),-.257*Math.cos(spread),.037])
      : plus(shoulder,[sign*(.252*Math.sin(spread)-.052*amount),-.083,.242*Math.cos(spread)]);
    const axis=lateral?[0,0,1]:[sign*Math.cos(spread),0,Math.sin(spread)];
    p[side+'e']=point;
    p[side+'w']=plus(point,lateral?[sign*.015,.061,.278]:[0,.260,0]);
    p[side+'Grip']=axis;
    const pivot=lateral?[sign*.294,shoulder[1],shoulder[2]-.106]:[sign*.191,shoulder[1]+.106,shoulder[2]-.111];
    p.leverPressHandles.push({pivot,point,axis});
  }
  return p;
}

function elbowStation(t,{extension=false,alternate=false}) {
  const p=seatedStation(.157);
  groundStation(p);
  for(const [side,sign] of sides){
    const active=alternate ? (t<.5?1:-1)===sign ? rep((t*2)%1):0 : rep(t);
    const angle=extension ? 2.29-2.13*active : .32+2.09*active;
    const pivot=[sign*.225,.788,.321];
    const point=plus(pivot,[0,-.356*Math.cos(angle),.356*Math.sin(angle)]);
    const axis=[extension?sign:-sign,0,0];
    p[side+'e']=pivot;
    p[side+'w']=point;
    p[side+'Grip']=axis;
    p.leverPressHandles.push({pivot,point,axis});
  }
  return p;
}

function kneeStation(t,{leg='both',toeIn=false,range=1,curling=false}) {
  const p=seatedStation();
  for(const [side,sign] of sides){
    const free=leg==='single'&&sign<0;
    const alternates=leg==='alternating';
    const otherSide=alternates&&(t<.5?1:-1)!==sign;
    const amount=free||otherSide ? 0 : rep(alternates?(t*2)%1:t);
    const angle=curling ? 1.475-1.91*amount*range : .21+1.28*amount*range;
    const pivot=[sign*.329,.524,.355];
    const knee=[sign*.145,pivot[1],pivot[2]];
    const ankle=[knee[0],knee[1]-.422*Math.cos(angle),knee[2]+.422*Math.sin(angle)];
    const direction=curling?-1:1;
    const point=[knee[0],knee[1]-.351*Math.cos(angle)+.075*direction*Math.sin(angle),
      knee[2]+.351*Math.sin(angle)+.075*direction*Math.cos(angle)];
    p[side+'k']=free?[sign*.245,.487,.355]:knee;
    p[side+'a']=free?[sign*.311,.074,.401]:ankle;
    p[side+'t']=plus(p[side+'a'],[sign*(toeIn?-.065:.018),-.075+.164*(curling?1-amount:amount),.141]);
    if(!free)delete p.planted[side];
    const grip=[sign*.262,.517,.176];
    [p[side+'e'],p[side+'w']]=limb(p[side+'s'],grip,[sign*.48,-.43,-.65],.252,.371);
    p[side+'Grip']=[0,0,1];
    p.leverPressHandles.push({pivot,point,axis:[1,0,0]});
  }
  return p;
}

function proneKneeStation(phase,{single=false,kneeling=false}) {
  const amount=rep(phase);
  const bodyPitch=kneeling?.641:Math.PI/2;
  const hips=kneeling?[0,.927,-.186]:[0,.652,-.017];
  const at=(height,x=0)=>[x,hips[1]+height*Math.cos(bodyPitch),hips[2]+height*Math.sin(bodyPitch)];
  const p={hips,chest:at(.370),neck:at(.602),head:at(.720),
    ls:at(.496,.191),rs:at(.496,-.191),lh:at(0,.104),rh:at(0,-.104),planted:{},leverPressHandles:[]};
  if(!kneeling)p.headAim=[0,-.139,1];
  for(const [side,sign] of sides){
    const resting=single&&sign<0;
    const travel=resting?0:amount;
    const angle=kneeling ? -.055+1.48*travel : -.112+1.67*travel;
    const knee=kneeling?[sign*.157,resting?.528:.500,resting?-.115:-.184]:[sign*.121,.626,-.441];
    const direction=kneeling?[0,-Math.cos(angle),-Math.sin(angle)]:[0,Math.sin(angle),-Math.cos(angle)];
    const offset=kneeling?[0,Math.sin(angle),-Math.cos(angle)]:[0,Math.cos(angle),Math.sin(angle)];
    const ankle=plus(knee,scale(direction,.423));
    const contact=plus(plus(knee,scale(direction,.351)),scale(offset,.069));
    p[side+'k']=knee;
    p[side+'a']=kneeling&&resting?plus(knee,[.012,-.013,-.423]):ankle;
    p[side+'t']=plus(p[side+'a'],[sign*.015,-.058,kneeling&&!resting?.139:-.132]);
    const grip=kneeling?[sign*.226,.953,.532]:[sign*.243,.538,.687];
    [p[side+'e'],p[side+'w']]=limb(p[side+'s'],grip,[sign*.70,-.42,-.64],.252,.371);
    p[side+'Grip']=[1,0,0];
    p.leverPressHandles.push({
      pivot:[sign*.326,knee[1],knee[2]],
      point:kneeling&&resting?[sign*.421,.353,-.467]:contact,
      axis:[1,0,0],
    });
  }
  return p;
}

function seatedCalfStation(t,{single=false}) {
  const amount=rep(t);
  const p=seatedStation(.012);
  for(const [side,sign] of sides){
    const resting=single&&sign<0;
    const a=resting?[sign*.242,.075,.258]:[sign*.161,.133+.087*amount,.367];
    [p[side+'k'],p[side+'a']]=limb(p[side+'h'],a,[sign*.13,.88,.314],.422,.424);
    p[side+'t']=plus(p[side+'a'],[sign*.014,resting?-.068:.067-a[1],.142]);
    p.planted[side]=resting?0:.063;
    const top=plus(p[side+'k'],[0,.061,-.074]);
    const grip=resting?[sign*.226,.558,.213]:plus(top,[sign*.056,.109,-.044]);
    [p[side+'e'],p[side+'w']]=limb(p[side+'s'],grip,[sign*.66,-.46,-.52],.252,.371);
    p[side+'Grip']=[0,0,1];
    p.leverPressHandles.push({pivot:[sign*.329,.369,.711],point:top,axis:[1,0,0]});
  }
  return p;
}

function hipMachine(phase,{adduct=false}) {
  const p=seatedStation();
  const amount=rep(phase);
  const spread=adduct?.86-.64*amount:.20+.66*amount;
  for(const [side,sign] of sides){
    const x=sign*(.106+.389*Math.sin(spread));
    const z=.013+.389*Math.cos(spread);
    const knee=[x,.497,z];
    p[side+'k']=knee;
    p[side+'a']=[x,.077,z+.049];
    p[side+'t']=plus(p[side+'a'],[sign*.029,-.067,.137]);
    const grip=[sign*.263,.554,.219];
    [p[side+'e'],p[side+'w']]=limb(p[side+'s'],grip,[sign*.56,-.68,.06],.252,.371);
    p[side+'Grip']=[0,0,1];
    p.leverPressHandles.push({pivot:[sign*.109,.479,.067],
      point:plus(knee,[sign*(adduct?.069:-.069),-.039,-.022]),axis:[0,0,1]});
  }
  return p;
}

const lowerRows=[
  ['2287',{motion:'leg',single:true},'leg',['quad','glute']],
  ['2315',{motion:'calf',variant:'rotary'},'rotary-calf',['calf']],
  ['2335',{motion:'calf',variant:'seated'},'seated-calf',['calf']],
  ['0605',{motion:'calf',variant:'standing'},'standing-calf',['calf']],
  ['0597',{motion:'hip',variant:'abduct'},'hip',['glute']],
  ['0598',{motion:'hip',variant:'adduct'},'hip',['quad']],
  ['0583',{motion:'twist'},'twist',['core']],
  ['1452',{motion:'crunch',variant:'overhead'},'crunch',['core']],
  ['0595',{motion:'crunch',variant:'chest'},'crunch',['core']],
  ['3760',{motion:'crunch',variant:'hands'},'crunch',['core']],
  ['3759',{motion:'hinge'},'crunch',['glute','hamstring','core']],
  ['0600',{motion:'crunch',variant:'leg-bend'},'crunch',['core']],
  ['0593',{motion:'reverse'},'reverse-hyper',['glute','hamstring']],
];

const rows=[
  ['0577',{},'flat',['pec','triceps']],['1300',{decline:true},'flat',['pec','triceps']],
  ['1299',{incline:true},'incline',['pec','shoulder']],['1479',{incline:true,inner:true},'incline',['pec','shoulder']],
  ['1301',{inner:true},'flat',['pec','triceps']],['3758',{standing:true},'standing',['pec','triceps']],
  ['0584',{lateral:true},'flat',['shoulder']],['0587',{shoulder:true},'flat',['shoulder','triceps']],
  ['0590',{shoulder:true,single:true},'flat',['l:shoulder','l:triceps']],
  ['0869',{shoulder:true,variant:2},'flat',['shoulder','triceps']],
  ['2318',{shoulder:true,variant:3},'flat',['shoulder','triceps']],
  ['0602',{fly:'reverse'},'reverse',['rearShoulder','trap']],
  ['0601',{fly:'reverse',grip:'neutral'},'reverse',['rearShoulder','trap']],
  ['0596',{fly:'chest'},'fly',['pec']],['1451',{dip:true},'flat',['triceps','pec']],
  ['0591',{dip:true,standing:true},'standing',['triceps','pec']],['0575',{curl:true},'flat',['biceps']],
  ['0607',{extension:true},'flat',['triceps']],
  ['1455',{},'flat-floor',['pec','triceps']],['2277',{inner:true},'flat-floor',['pec','triceps']],
  ['1029',{},'flat-floor',['pec','triceps']],['2278',{decline:true},'flat-floor',['pec','triceps']],
  ['2659',{incline:true},'incline-plate',['pec','shoulder']],
  ['1195',{incline:true,grip:'vertical'},'incline-stack',['pec','shoulder']],
  ['4371',{incline:true,single:true},'incline-plate',['l:pec','l:shoulder']],
  ['5576',{incline:true,single:true},'incline-plate',['l:pec','l:shoulder']],
  ['2974',{single:true},'flat-plate',['l:pec','l:triceps']],
  ['10669',{incline:true},'incline-stack',['pec','shoulder']],
  ['10670',{incline:true,single:true},'incline-stack',['l:pec','l:shoulder']],
  ['10671',{},'flat-stack',['pec','triceps']],
  ['10672',{single:true},'flat-stack',['l:pec','l:triceps']],
  ['1030',{contact:'forearm-fly'},'fly-pad-stack',['pec']],
  ['3344',{fly:'chest',grip:'neutral'},'fly-stack',['pec']],
  ['5843',{fly:'chest',incline:true,highFly:true,grip:'neutral'},'fly-incline-stack',['pec']],
  ['1876',{contact:'lateral'},'lateral-pad-plate',['shoulder']],
  ['3343',{contact:'lateral'},'lateral-pad-stack',['shoulder']],
  ['2962',{shoulder:true,variant:2},'flat-stack',['shoulder','triceps']],
  ['4174',{shoulder:true,grip:'under'},'flat-plate',['shoulder','triceps']],
  ['1454',{shoulder:true},'flat-floor',['shoulder','triceps']],
  ['1032',{elbows:true,alternate:true},'elbow-pad-stack',['biceps']],
  ['4336',{elbows:true},'elbow-pad-stack',['biceps']],
  ['1871',{dip:true},'dip-plate',['triceps','pec']],
  ['1033',{elbows:true,extension:true},'elbow-pad-stack',['triceps']],
  ['2198',{elbows:true,extension:true},'elbow-pad-stack',['triceps']],
];
const kneeRows=[
  ['1873',{knee:true},'knee-plate',['quad']],
  ['1874',{knee:true,leg:'alternating'},'knee-plate',['quad']],
  ['3386',{knee:true,range:.91},'knee-stack',['quad']],
  ['7108',{knee:true,range:.94},'knee-stack',['quad']],
  ['7327',{knee:true,toeIn:true},'knee-stack',['quad']],
  ['1571',{knee:true,leg:'single'},'knee-stack',['l:quad']],
  ['5178',{knee:true,leg:'single'},'knee-plate',['l:quad']],
  ['8604',{knee:true,curling:true},'knee-curl-plate',['hamstring']],
  ['1586',{knee:true,curling:true,leg:'single'},'knee-curl-stack',['l:hamstring']],
  ['10763',{knee:true,curling:true,leg:'single'},'knee-curl-plate',['l:hamstring']],
  ['9676',{prone:true},'knee-prone-plate',['hamstring']],
  ['1590',{prone:true,single:true},'knee-prone-stack',['l:hamstring']],
  ['0582',{prone:true,kneeling:true,single:true},'knee-kneeling-plate',['l:hamstring']],
  ['2666',{seatedCalf:true},'seated-calf-plate',['calf']],
  ['1216',{seatedCalf:true,single:true},'seated-calf-plate',['l:calf']],
  ['1869',{hip:true},'hip-stack',['glute']],
  ['1867',{hip:true,adduct:true},'hip-stack',[]],
];

const [folder,kind,...ids]=process.argv.slice(2);
if(!folder) throw new Error('Pass an output directory.');
const out=resolve(folder);
await mkdir(out,{recursive:true});
const items=[];
const failures=[];
const source = kind==='lower' ? [...lowerRows,...kneeRows] : rows;
for(const [id,options,rig,muscles] of source) {
  if(ids.length&&!ids.includes(id))continue;
  const recipe=id+'.json';
  const animate=options.knee?kneeStation:options.prone?proneKneeStation:options.seatedCalf?seatedCalfStation
    :options.hip?hipMachine:options.motion?lowerBody:options.contact?paddedPress:options.elbows?elbowStation:motion;
  const tall=options.standing||options.shoulder&&rig.includes('-');
  const data={version:1,durationMs:options.single&&options.motion==='leg'||options.alternate||options.leg==='alternating'?5600:4200,
    equipment:'lever-press-'+rig,muscles,
    camera:{yaw:options.prone?(options.kneeling?79:58):options.lateral||options.contact==='lateral'?22:options.fly||options.contact?31:options.hip||options.variant==='abduct'||options.variant==='adduct'?21:63,
      elevation:16,focus:[0,tall?1.03:.84,options.knee?.29:.045],height:tall?2.31:2.00},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...animate(i/60,options)}))};
  try {
    prepareRecipe(data);
    const intervals=data.keyframes.flatMap(f=>sides.map(([side],i)=>options.single&&i===1?0:Math.hypot(...minus(f[side+'w'],f.leverPressHandles[i].point))));
    const gripError=Math.max(...intervals);
    if(animate===motion&&gripError>.039) throw new Error('Hands lose grip by '+gripError.toFixed(3)+' m.');
    await writeFile(resolve(out,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe});
  } catch(error) { failures.push({id,error:error.message}); }
}
await writeFile(resolve(out,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
