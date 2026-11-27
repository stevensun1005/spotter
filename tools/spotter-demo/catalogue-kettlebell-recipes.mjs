import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { body, curtsyLunge, fromSupport, lunge as unloadedLunge, splitSquat as stationarySplit } from './catalogue-dumbbell-recipes.mjs';

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
function pressFoot(p,side,sign,setting) {
  if (setting==='z') {
    foot(p,side,sign,[sign*.178,.090,.493],false);
    p[side+'t']=add(p[side+'a'],[sign*.019,.131,.047]);
  } else if (setting==='half' && sign>0) {
    foot(p,side,sign,[sign*.149,.075,.374]);
  } else {
    [p[side+'k'],p[side+'a']]=limb(p[side+'h'],[sign*.149,.087,-.477],[sign*.20,-1,1],.422,.424);
    p[side+'t']=add(p[side+'a'],[sign*.020,-.071,-.146]);
  }
}
function press(t,{floor=false,seated=false,single=false,alternate=false,arnold=false,
    lateral=false,seesaw=false,drive,hinge=false,setting,bottoms=false,groundContact=false}={}) {
  const push=wave(t);
  const dip=drive? .11*wave(Math.max(0,Math.min(1,(t-.045)/.37)))+(drive==='jerk'?.072*wave(Math.max(0,Math.min(1,(t-.36)/.30))):0):0;
  const p=setting ? person([0,setting==='z'?.148:.505,setting==='z'?-.337:-.045],.028)
    : person([0,floor?.143:seated?.503:.875-dip,floor?.223:0],floor?-Math.PI/2:hinge?.758:dip*.56);
  for (const [side,sign] of sides) {
    if (setting) pressFoot(p,side,sign,setting);
    else foot(p,side,sign,[sign*(seated?.226:.144),.075,floor?.740:seated?.445:.057]);
    if (single && sign<0) {
      if (groundContact) {
        arm(p,side,[-.500,.050,-.015],[-.54,-.28,.88]);
        p.rPalmSide=[0,1,0];
        p.rFingers=[-.97,0,.24];
      } else idle(p,side,sign);
      continue;
    }
    const amount=seesaw ? (sign>0 ? 1-push : push) : alternate ? (t<.5)===(sign>0)?wave(t*2):0 : push;
    const s=p[side+'s'];
    const from=floor?[sign*.220,.201,.109]:[sign*(arnold?.006:.127),.105,.161];
    const top=floor?[sign*.029,.604,.039]:[sign*(lateral?.284:.049),lateral?.505:.590,.034];
    const handle=arnold? unit(mix([-sign,0,.37],[sign,0,.30],amount)):[sign,0,0];
    const down=bottoms?[0,1,0]:floor?[0,-.35,-.94]:[0,-.70,-.714];
    if (groundContact) {
      const upper=unit(mix([sign*.219,-.053,.115],[sign*.034,.250,.017],amount));
      const forearm=unit(mix([-sign*.032,.368,-.009],[-sign*.019,.370,.010],amount));
      p[side+'e']=add(s,scale(upper,.252));
      p[side+'w']=add(p[side+'e'],scale(forearm,.371));
      p[side+'Grip']=handle;
      p.kettlebells.push({grip:p[side+'w'],handle,down});
    } else arm(p,side,add(s,mix(from,top,amount)),[sign*.77,-.57,.21],handle,down);
  }
  return p;
}
function row(t,{single=false,sumo=false,alternate=false,elbowsOut=false}={}) {
  const v=wave(t);
  const p=person([0,sumo?.789-.115*(1-v):.787, sumo?-.058:-.179],sumo?.25:.91);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*(sumo?.318:.170),.075,.068]);
    if (single && sign < 0) { arm(p,side,[-.235,.634,.225],[-.24,-.59,.43]); continue; }
    if (sumo && sign < 0) { arm(p,side,add(p.lw,[-.065,0,0]),[-.68,-.43,-.14]);p.rGrip=[1,0,0];continue; }
    const move=alternate?((t<.5)===(sign>0)?wave(t*2):0):v;
    const wrist=add(p[side+'s'],sumo ? [-.148,-.545+.454*v,.24-.084*v]
      : elbowsOut?[sign*(.047+.166*move),-.597+.414*move,.021+.025*move]
        : [sign*.047,-.597+.375*move,.021-.203*move]);
    arm(p,side,wrist,[sign*(sumo||elbowsOut?.865:.14),-.15,-.924],sumo?[1,0,0]:[0,0,1],[0,-1,0]);
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

function clean(t,{single=false,alternate=false,snatch=false,bottoms=false,floorStart=false,deadStart=false,open=false,split=false}={}) {
  const profile=floorStart
    ? [[0,[.95]],[.15,[.84]],[.34,[.12]],[.51,[0]],[.67,[0]],[.83,[.22]],[1,[.95]]]
    : [[0,[.90]],[.20,[.49]],[.33,[.08]],[.53,[0]],[.67,[0]],[.82,[.10]],[1,[.90]]];
  const dip=arc(t,profile)[0];
  const p=person([0,.879-dip*(floorStart?.441:.134),-dip*.19],dip*.89);
  for (const [side,sign] of sides) {
    const splitDepth=split?smooth((t-.32)/.14)*(1-smooth((t-.63)/.23)):0;
    foot(p,side,sign,[sign*.193,.075+(sign<0?.075:0)*splitDepth,.064+sign*.367*splitDepth]);
    if(splitDepth>.01&&sign<0)p[side+'t']=add(p[side+'a'],[sign*.018,-.072-.075*splitDepth,.133]);
    if(single&&sign<0){idle(p,side,sign);continue;}
    const phase=alternate ? (t<.5)===(sign>0)?t*2%1:0 : t;
    const hang=floorStart?[sign*.144,.228,.206]:[sign*.184,.647,.092];
    const rack=[sign*.270,1.434,.167];
    const top=snatch?[sign*.247,1.938,.083]:rack;
    const backSwing=floorStart?[sign*.167,deadStart?.436:.351,deadStart?.186:-.182]:[sign*.178,.528,-.218];
    const point=arc(phase,[[0,hang],[.14,backSwing],[.31,[sign*.237,.995,.286]],
      [.48,top],[.62,top],[.76,rack],[1,hang]]);
    const upright=smooth((phase-.32)/.17)*(1-smooth((phase-.79)/.19));
    const swingBack=floorStart&&!deadStart?.61*wave(Math.min(1,phase/.31)):0;
    arm(p,side,point,[sign*.54,-.61,-.12],[sign,0,0],
      bottoms?unit([0,-1+2*upright,-.44*upright]):unit([0,-1+.32*upright,-.78*upright-swingBack]));
    if(open&&upright>.75){
      delete p[side+'Grip'];
      p[side+'PalmSide']=[1,0,0];
      p[side+'Fingers']=[0,.947,.321];
    }
  }
  return p;
}

function cleanAndPress(t,{hang=false,jerk=false,push=false,backswing=true}={}) {
  const dips=[[0,[hang?.089:.406]],[.13,[hang?.109:.334]],[.32,[0]],[.43,[0]],
    [.49,[push||jerk?.089:0]],[.56,[0]],[.61,[jerk?.092:0]],[.69,[0]],[.82,[0]],
    [.88,[.04]],[1,[hang?.089:.406]]];
  const dip=arc(t,dips)[0];
  const p=person([0,.875-dip,-.467*dip],dip*(dip>.13?2.08:.81));
  for (const [side,sign] of sides) foot(p,side,sign,[sign*.189,.075,.090]);
  const low=[.151,hang?.664:.228,.205];
  const swingPoint=[.166,hang?.582:.409,backswing?-.139:.203];
  const rack=add(p.ls,[.070,.070,.166]);
  const locked=add(p.ls,[.011,.609,.051]);
  const wrist=arc(t,[[0,low],[.14,swingPoint],[.25,[.187,1.017,.295]],[.37,rack],[.50,rack],
    [.59,locked],[.73,locked],[.83,rack],[1,low]]);
  const invert=smooth((t-.24)/.13)*(1-smooth((t-.84)/.14));
  arm(p,'l',wrist,[.81,-.38,.16],[1,0,0],unit([0,-1+.36*invert,-.76*invert]));
  idle(p,'r',-1);
  return p;
}

function alternatingHangClean(t) {
  const lead=t<.5?'l':'r';
  const phase=(2*t)%1;
  const dip=.098*arc(phase,[[0,[0]],[.18,[1]],[.41,[0]],[.74,[0]],[1,[0]]])[0];
  const p=person([0,.875-dip,-.79*dip],.046+3.1*dip);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.180,.075,.099]);
    const low=add(p[side+'s'],[sign*.070,-.591,.084]);
    const rack=add(p[side+'s'],[sign*.077,.049,.161]);
    const wrist=side===lead?arc(phase,[[0,low],[.16,[sign*.232,.669,-.109]],
      [.33,[sign*.263,1.058,.311]],[.53,rack],[.67,rack],[1,low]]):low;
    const invert=side===lead?smooth((phase-.28)/.25)*(1-smooth((phase-.68)/.27)):0;
    arm(p,side,wrist,[sign*.72,-.46,-.09],[sign,0,0],unit([0,-1+.36*invert,-.76*invert]));
  }
  return p;
}

function rackThruster(t,{one=false,alternate=false}={}) {
  const lead=t<.5?'l':'r';
  const phase=alternate?(2*t)%1:t;
  const lower=smooth(phase/.29)*(1-smooth((phase-.33)/.28));
  const high=smooth((phase-.40)/.24)*(1-smooth((phase-.73)/.27));
  const p=person([0,.879-.352*lower,.024-.198*lower],.032+.239*lower);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.187,.075,.096]);
    if(one&&side==='r'){idle(p,side,sign);continue;}
    const amount=alternate&&side!==lead?0:high;
    const wrist=mix([sign*.086,.077,.191],[sign*.024,.608,.045],amount);
    arm(p,side,add(p[side+'s'],wrist),[sign*.77,-.55,.22],[sign,0,0],[0,-.66,-.754]);
  }
  return p;
}

function goodMorning(t,{behind=false}={}) {
  const amount=wave(t);
  const p=person([0,.883-.069*amount,.028-.231*amount],.027+1.045*amount);
  for(const [side,sign] of sides) foot(p,side,sign,[sign*.171,.075,.083]);
  const grip=behind?add(p.hips,[0,-.115,-.228]):add(p.chest,[0,.111,.219]);
  sharedBell(p,grip,{goblet:!behind,centerAtHands:true});
  return p;
}

function sumoHighPull(t) {
  const height=arc(t,[[0,[0]],[.36,[1]],[.52,[1]],[.72,[.81]],[1,[0]]])[0];
  const elbow=arc(t,[[0,[0]],[.24,[0]],[.51,[1]],[.62,[1]],[.81,[0]],[1,[0]]])[0];
  const p=person([0,.483+.398*height,-.207+.23*height],.824-.796*height);
  for(const [side,sign] of sides) {
    foot(p,side,sign,[sign*.306,.075,.113]);
    p[side+'t']=add(p[side+'a'],[sign*.076,-.071,.130]);
    const wrist=[sign*.052,.221+.473*height+.735*elbow,.204-.042*elbow];
    arm(p,side,wrist,[sign*.885,.354,-.32]);
    p[side+'Grip']=[sign,0,0];
  }
  p.kettlebells.push({grip:scale(add(p.lw,p.rw),.5),handle:[1,0,0],down:[0,-1,0]});
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
function sharedBell(p,grip,{goblet=false,down=[0,-1,0],centerAtHands=false}={}) {
  for(const [side,sign] of sides) {
    const point=add(grip,[sign*(goblet?.063:.048),goblet?-.043:0,0]);
    arm(p,side,point,[sign*.79,-.48,-.13]);
    p[side+'Grip']=goblet?[0,1,0]:[sign,0,0];
  }
  p.kettlebells.push({grip:centerAtHands?scale(add(p.lw,p.rw),.5):grip,handle:[1,0,0],down});
}
function carry(t,{bottoms=false,overhead=false,farmers=false,goblet=false}={}) {
  const p=person([0,.866+.022*wave((2*t)%1),0],.024);
  for(const [side,sign] of sides) {
    const phase=(t+.19+(sign<0?.5:0))%1;
    const stance=phase<.60;
    const normalized=stance?phase/.60:(phase-.60)/.40;
    const z=.459*(stance?.5-normalized:normalized-.5);
    const lift=stance?0:.118*Math.sin(Math.PI*normalized);
    foot(p,side,sign,[sign*.130,.075+lift,z],stance);
    if (goblet) continue;
    if (farmers) {
      arm(p,side,add(p[side+'s'],[sign*.083,-.598,-.023]),[sign*.39,-.41,-.70],[0,0,1],[0,-1,0]);
    } else if (overhead && sign>0) {
      arm(p,side,add(p[side+'s'],[.030,.608,.058]),[.63,-.22,-.53],[1,0,0],bottoms?[0,1,0]:[0,-.64,-.77]);
    } else {
      arm(p,side,add(p[side+'s'],[sign*.056,-.580,-.140*Math.cos(2*Math.PI*phase)]),[sign*.56,-.45,-.58]);
    }
  }
  if (goblet) sharedBell(p,add(p.chest,[0,.119,.239]),{goblet:true});
  return p;
}
function deadlift(t,{wide=false,double=false,straight=false,stagger=false,suitcase=false}={}) {
  const depth=wave(t);
  const p=person([0,.873-(straight?.056:stagger?.111:wide?.413:.366)*depth,
    .004-(straight||stagger?.250:.161)*depth],.034+(straight||stagger?1.18:wide?.78:.92)*depth);
  const armTarget=[suitcase?.352:0,.757-(straight?.397:stagger?.422:.529)*depth,.148-.041*depth];
  for(const [side,sign] of sides) {
    foot(p,side,sign,[sign*(wide?.314:.144),stagger&&sign<0?.124:.075,stagger&&sign<0?-.226:.072]);
    if (wide) p[side+'t']=add(p[side+'a'],[sign*.074,-.072,.129]);
    if (stagger && sign<0) p[side+'t']=add(p[side+'a'],[sign*.020,-.120,.092]);
    if (double) arm(p,side,add(armTarget,[sign*.169,0,0]),[sign*.54,-.32,-.78],[0,0,1],[0,-1,0]);
    if (suitcase) {
      if (sign>0) arm(p,side,armTarget,[.54,-.32,-.78],[0,0,1],[0,-1,0]);
      else idle(p,side,sign);
    }
  }
  if (!double && !suitcase) sharedBell(p,armTarget,{centerAtHands:true});
  return p;
}
function loadedSquat(t,{sumo=false,frontRack=false,calves=false}={}) {
  const amount=calves?wave(Math.min(t/.71,1)):wave(t);
  const heel=calves?.081*wave(Math.max(0,(t-.71)/.29)):0;
  const p=person([0,.876-.347*amount+.76*heel,.026-.205*amount],.032+.297*amount);
  for(const [side,sign] of sides) {
    foot(p,side,sign,[sign*(sumo?.306:.170),.075+heel,.118+.28*heel]);
    p[side+'t']=add(p[side+'a'],[sign*(sumo?.082:.027),-.071-heel,.135-heel*.28]);
  }
  if (frontRack) {
    arm(p,'l',add(p.ls,[.064,.038,.188]),[.51,-.75,.41],[1,0,0],[0,-.70,-.71]);
    arm(p,'r',add(p.rs,[-.211,-.091,.325]),[-.75,-.24,.41]);
  } else {
    const grip=sumo?add(p.hips,[0,-.102,.229]):add(p.chest,[0,.108,.253]);
    sharedBell(p,grip,{goblet:!sumo,centerAtHands:sumo});
  }
  return p;
}
function swing(t,{single=false,overhead=false,lateral=false}={}) {
  const phase=lateral?(t*2)%1:t;
  const drive=arc(phase,[[0,[0]],[.15,[0]],[.43,[1]],[.54,[1]],[1,[0]]])[0];
  const p=person([0,.779+.103*drive,-.238+.258*drive],1.04-1.01*drive);
  for (const [side,sign] of sides) foot(p,side,sign,[sign*.224,.075,.112]);
  const shift=lateral?(t<.5?.279:-.279)*drive:0;
  const point=mix([single?.112:0,.578,-.111],[single?.241:shift,overhead?1.960:1.327,overhead?.177:.598],drive);
  const down=unit(mix([0,-.35,-.936],overhead?[0,.995,.09]:[0,-.29,.957],drive));
  if (single) {
    arm(p,'l',point,[.27,-.71,-.19],[1,0,0],down);
    arm(p,'r',add(p.rs,[-.131,-.481,-.143*drive]),[-.63,-.46,-.34]);
  } else sharedBell(p,point,{down,centerAtHands:true});
  return p;
}
function raiseBell(t,{seated=false,front=false,single=false}={}) {
  const p=person([0,seated?.503:.875,0],.025);
  const angle=.09+1.53*wave(t);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*(seated?.226:.147),.075,seated?.445:.053]);
    if (front) continue;
    if (single && sign<0) {
      idle(p,side,sign);
      continue;
    }
    const point=add(p[side+'s'],[sign*.602*Math.sin(angle),-.598*Math.cos(angle),.044]);
    arm(p,side,point,[sign*.38,-.74,.451],[0,0,1],[0,-1,0]);
  }
  if (front) sharedBell(p,add(p.chest,[0,.124-.588*Math.cos(angle),.061+.603*Math.sin(angle)]),{centerAtHands:true});
  return p;
}
function curlBell(t,{seated=false}={}) {
  const p=person([0,seated?.523:.881,seated?-.017:0],seated?.52:.017);
  for (const [side,sign] of sides) foot(p,side,sign,[sign*(seated?.353:.147),.075,seated?.399:.066]);
  const seatArm=minus(add(p.lk,[-.065,.054,-.106]),p.ls);
  const elbow=add(p.ls,scale(unit(seated?seatArm:[.053,-.244,.019]),.252));
  const angle=.108+2.37*wave(t);
  p.le=elbow;
  p.lw=add(elbow,[.007,-.371*Math.cos(angle),.370*Math.sin(angle)]);
  p.lGrip=[1,0,0];
  p.kettlebells.push({grip:p.lw,handle:[1,0,0],down:[0,-1,0]});
  if (seated) arm(p,'r',add(p.rk,[.014,.069,-.068]),[-.58,-.48,.21]);
  else idle(p,'r',-1);
  return p;
}
function tricepsBell(t,{single=false}={}) {
  const angle=.095+1.89*wave(t);
  const p=person([0,.880,.019],.028);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*.157,.075,.069]);
    if (single && sign<0) {
      idle(p,side,sign);
      continue;
    }
    const elbow=add(p[side+'s'],[sign*(single?-.023:-.079),.230,.095]);
    p[side+'e']=elbow;
    p[side+'w']=add(elbow,[single?0:-sign*.047,.365*Math.cos(angle),-.365*Math.sin(angle)]);
    p[side+'Grip']=[sign,0,0];
  }
  const grip=single?p.lw:scale(add(p.lw,p.rw),.5);
  p.kettlebells.push({grip,handle:[1,0,0],down:[0,.89*Math.sin(angle)-.17,-.982*Math.cos(angle)]});
  return p;
}
function standingIsolation(t,{bend=false,shrug=false}={}) {
  const amount=wave(t);
  const p=person([0,.881,.014],.02,bend?-.344*amount:0);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*.153,.075,.057]);
    if (bend && sign>0) {
      arm(p,side,add(p[side+'s'],[sign*.089,-.603,.038]),[sign*.40,-.37,-.64]);
      continue;
    }
    if (shrug) p[side+'s']=add(p[side+'s'],[sign*-.015*amount,.075*amount,.019*amount]);
    if (shrug || bend) arm(p,side,add(p[side+'s'],[sign*.103,-.598,.028]),[sign*.528,-.23,-.74],[0,0,1],[0,-1,0]);
  }
  if (!bend && !shrug) sharedBell(p,add(p.chest,[0,-.494+.593*amount,.116+.034*amount]),{centerAtHands:true});
  return p;
}
function singleLegHinge(t,{opposite=false}={}) {
  const amount=wave(t);
  const p=person([.055,.881-.064*amount,.020-.200*amount],.023+1.237*amount);
  const angle=.21+1.42*amount;
  foot(p,'l',1,[.146,.075,.073]);
  foot(p,'r',-1,add(p.rh,[-.061,-.829*Math.cos(angle),-.829*Math.sin(angle)]),false);
  p.rt=add(p.ra,[-.015,-.072,-.145]);
  const active=opposite?'r':'l';
  const sign=opposite?-1:1;
  arm(p,active,add(p[active+'s'],[sign*.055,-.607,.034-.123*amount]),[sign*.44,-.19,-.83],[0,0,1],[0,-1,0]);
  idle(p,opposite?'l':'r',-sign);
  return p;
}
function lungeBell(t,{back=false,overhead=false,staticFeet=false,sideLoad=false,sameRear=false}={}) {
  const time=sideLoad?sameRear?t*.5:.5+t*.5:t;
  const p=staticFeet?stationarySplit(t):unloadedLunge(time,{form:back?'reverse':'plain'});
  p.kettlebells=[];
  delete p.dumbbells;
  delete p.lGrip;
  delete p.rGrip;
  if (overhead || sideLoad) {
    const reach=overhead?[.031,.602,.061]:[.084,-.593,.039];
    arm(p,'l',add(p.ls,reach),[.43,-.26,-.73],overhead?[1,0,0]:[0,0,1],overhead?[0,-.63,-.77]:[0,-1,0]);
    idle(p,'r',-1);
  } else sharedBell(p,add(p.chest,[0,.108,.245]),{goblet:true});
  return p;
}
function sideSquatBell(t,{cossack=false,bothKnees=false,oneSide=false}={}) {
  const sign=oneSide||t<.5?1:-1;
  const phase=oneSide?t:(t*2)%1;
  const move=cossack?1:arc(phase,[[0,[0]],[.21,[1]],[.65,[1]],[1,[0]]])[0];
  const depth=arc(phase,[[0,[0]],[.20,[0]],[.46,[1]],[.56,[1]],[.81,[0]],[1,[0]]])[0];
  const p=person([sign*(cossack?.295:bothKnees?.230:.535)*depth,.878-.357*depth,.042-.153*depth],.024+.302*depth);
  for (const [side,direction] of sides) {
    const working=direction===sign;
    const x=direction*(cossack?.528:.158+(working?.516*move:0));
    const lift=!cossack&&working?.107*Math.sin(Math.PI*move):0;
    foot(p,side,direction,[x,.075+lift,.071],lift<.002);
    if (cossack&&!working) p[side+'t']=add(p[side+'a'],[direction*.064,.024,.130]);
  }
  sharedBell(p,add(p.chest,[0,.112,.266]),{goblet:true});
  return p;
}

function bellHalo(t,{setting}={}) {
  const p=setting?fromSupport('halfKneel'):fromSupport('floor');
  const angle=2*Math.PI*t;
  const point=add(p.head,[.302*Math.sin(angle),-.153+.066*(1-Math.cos(angle)),.293*Math.cos(angle)]);
  const radial=[Math.cos(angle),0,-Math.sin(angle)];
  for(const [side,sign] of sides){
    arm(p,side,add(point,scale(radial,sign*.067)),[sign*.87,-.24,-.34]);
    p[side+'Grip']=radial;
  }
  p.kettlebells=[{grip:scale(add(p.lw,p.rw),.5),handle:radial,down:[0,1,0]}];
  return p;
}

function slingshot(t,{fast=false}={}) {
  const p=fromSupport('floor');
  const angle=2*Math.PI*t;
  const x=Math.sin(angle), z=Math.cos(angle);
  const active=x>=0?'l':'r';
  const center=[.340*x,.868+(fast?.031:.013)*Math.sin(angle*2),.267*z];
  const direction=[z,0,-x];
  for(const [side,sign] of sides){
    const available=side===active?1:1-smooth(Math.abs(x)*3.2);
    const rest=add(p[side+'s'],[sign*.124,-.491,-.047]);
    const hold=add(center,scale(direction,(side===active?-.018:.058)*sign));
    arm(p,side,mix(rest,hold,available),[sign*.72,-.50,-.26]);
    if(available>.74) p[side+'Grip']=direction;
  }
  p.kettlebells=[{grip:p[active+'w'],handle:direction,down:[0,-1,0]}];
  return p;
}

function bellCurtsy(t) {
  const p=curtsyLunge(t);
  p.dumbbells=[];
  p.kettlebells=[];
  sharedBell(p,add(p.chest,[0,.104,.216]),{goblet:true,centerAtHands:true});
  return p;
}

function bellMatCore(t,{single=false,pressUp=false,twist=false,touch=false,pullover=false,
    tabletop=false,deadBug=false,activeLegs=false,feetRaised=false}={}) {
  const progress=deadBug?(2*t)%1:t;
  const amount=wave(progress);
  const bellUp=single||pressUp;
  const sit=!(twist||tabletop||pullover||deadBug);
  const pitch=twist?-.63:sit?-Math.PI/2+1.69*amount:-Math.PI/2;
  const rotation=twist?.77*Math.sin(2*Math.PI*t):0;
  const p=person([0,.145,twist?-.252:-.048],pitch);
  const sideLift=t<.5?'l':'r';
  for(const [side,sign] of sides){
    const lifted=deadBug&&activeLegs&&side===sideLift?amount:0;
    if (tabletop||deadBug) {
      const a=.087+1.288*lifted;
      const b=1.52-.164*lifted;
      const knee=add(p[side+'h'],[sign*.023,.419*Math.cos(a),.419*Math.sin(a)]);
      const ankle=add(knee,[sign*.010,-.420*Math.cos(b),.420*Math.sin(b)]);
      p[side+'k']=knee;
      p[side+'a']=ankle;
      p[side+'t']=add(ankle,[sign*.013,.068,.136]);
    } else foot(p,side,sign,[sign*.154,feetRaised?.216:.075,twist?.419:.569],!feetRaised);
  }
  if(twist){
    const side=[Math.cos(rotation),0,-Math.sin(rotation)];
    p.ls=add(p.chest,add(scale(side,.191),[0,.116,-.050]));
    p.rs=add(p.chest,add(scale(side,-.191),[0,.116,-.050]));
    const range=Math.abs(Math.sin(2*Math.PI*t));
    const distance=.281+.158*range;
    const center=[Math.sin(rotation)*distance,p.chest[1]+.108-(touch?.357:.209)*range,p.chest[2]+Math.cos(rotation)*distance];
    sharedBell(p,center,{goblet:true,centerAtHands:true});
    return p;
  }
  if (single) {
    arm(p,'l',add(p.ls,[.014,.602,.049]),[.66,-.48,.13],[1,0,0],[0,-.70,-.714]);
    arm(p,'r',add(p.rs,[-.283,.034,.218]),[-.71,-.59,.22]);
    return p;
  }
  const pressDepth=pressUp?smooth((amount-.75)/.25):0;
  const angle=pullover?1.51*amount:0;
  const center=tabletop||pullover||deadBug?add(p.chest,[0,.500*Math.cos(angle),-.526*Math.sin(angle)]):
    add(p.chest,[0,.160+(bellUp?.560*pressDepth:0),.220-.139*pressDepth]);
  sharedBell(p,center,{goblet:!(tabletop||pullover||deadBug||pressDepth>.45),centerAtHands:true});
  return p;
}

function bellFly(t,{incline=false}={}) {
  const pose=fromSupport(incline?'incline':'supineMat');
  const amount=wave(t);
  const angle=Math.PI/2*.91*amount;
  pose.kettlebells=[];
  for(const [side,sign] of sides){
    const inward=[sign*(-.071+.654*Math.sin(angle)),.90*.595*Math.cos(angle),.047];
    const supportUp=incline?[0,.76,.65]:[0,1,0];
    const goal=add(pose[side+'s'],add([inward[0],0,inward[2]],scale(supportUp,inward[1])));
    if(!incline) goal[1]=Math.max(.239,goal[1]);
    arm(pose,side,goal,[sign*.43,-.88,-.07],[0,0,1],incline?[0,-.70,-.714]:[0,-.38,-.924]);
  }
  return pose;
}

function bellBenchTriceps(t) {
  const pose=fromSupport('flat');
  const angle=.075+1.46*wave(t);
  pose.kettlebells=[];
  for (const [side,sign] of sides){
    const elbow=add(pose[side+'s'],[sign*-.081,.243,-.031]);
    pose[side+'e']=elbow;
    pose[side+'w']=add(elbow,[sign*-.045,.363*Math.cos(angle),-.362*Math.sin(angle)]);
    pose[side+'Grip']=[1,0,0];
  }
  pose.kettlebells.push({grip:scale(add(pose.lw,pose.rw),.5),handle:[1,0,0],down:[0,-.38,-.924]});
  return pose;
}

function bellBenchPress(t,{bottoms=false}={}) {
  const pose=fromSupport('flat');
  const amount=wave(t);
  pose.kettlebells=[];
  const path=mix([.073,.603,.030],[.188,.218,.062],amount);
  arm(pose,'l',add(pose.ls,path),[.83,-.621,.13],[1,0,0],bottoms?[0,1,0]:[0,-.30,-.954]);
  arm(pose,'r',add(pose.chest,[-.187,.113,.186]),[-.77,-.47,-.32]);
  return pose;
}

function bellStepCalfRaise(t) {
  const amount=wave(t);
  const p=person([0,1.115+.102*amount,.204+.028*amount],.032);
  for (const [side,sign] of sides){
    const heel=.266+.161*amount;
    foot(p,side,sign,[sign*.144,heel,.203+.028*amount],false);
    p[side+'t']=[sign*.144,.312,.334];
    if (side==='l') arm(p,side,add(p.ls,[.079,-.582,.064]),[.57,-.31,-.69],[0,0,1],[0,-1,0]);
    else idle(p,side,sign);
  }
  return p;
}

function bellBoxSquat(t) {
  const amount=arc(t,[[0,[0]],[.35,[1]],[.65,[1]],[1,[0]]])[0];
  const p=person([0,.878-.475*amount,.914-.360*amount],.031+.221*amount);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.174,.075,.935]);
  sharedBell(p,add(p.chest,[0,.099,.231]),{goblet:true,centerAtHands:true});
  return p;
}

function bellBoxStep(t,{fixed=false,carry=false}={}) {
  const footLift=fixed?1:arc(t,[[0,[0]],[.25,[1]],[.78,[1]],[1,[0]]])[0];
  const up=arc(t,[[0,[0]],[.24,[0]],[.53,[1]],[.64,[1]],[.95,[0]],[1,[0]]])[0];
  const trailing=fixed?0:arc(t,[[0,[0]],[.29,[0]],[.55,[1]],[.64,[1]],[.86,[0]],[1,[0]]])[0];
  const p=person([0,.874+.305*up-.105*footLift*(1-up),.027+.447*up],.036+.212*footLift*(1-up));
  for(const [side,sign] of sides){
    const left=side==='l';
    const lift=left?footLift:trailing;
    const y=.075+.309*lift+.127*Math.sin(Math.PI*lift);
    const z=.004+(left?.418:.486)*lift;
    const point=fixed&&!left?[sign*.107,.075+.314*up,.018+.379*up]:[sign*.118,y,z];
    foot(p,side,sign,point,lift<=.001&&(!fixed||left||up<.001));
    if(lift>.999)p.planted[side]=.309;
  }
  if(carry){
    arm(p,'l',add(p.ls,[.074,-.596,.046]),[.39,-.37,-.71],[0,0,1],[0,-1,0]);
    idle(p,'r',-1);
  }else sharedBell(p,add(p.chest,[0,.101,.218]),{goblet:true,centerAtHands:true});
  return p;
}

function loadedSquatVariation(t,{back=false,sots=false,hold=false}={}) {
  const amount=sots?arc(t,[[0,[0]],[.24,[1]],[.83,[1]],[1,[0]]])[0]:wave(t);
  const lift=sots?arc(t,[[0,[0]],[.33,[0]],[.53,[1]],[.60,[1]],[.80,[0]],[1,[0]]])[0]:1;
  const p=person([0,.878-.393*amount,.024-.206*amount],.027+.270*amount);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.173,.075,.113]);
  if(back){
    const handle=add(p.neck,[0,.052,-.198]);
    for(const [side,sign] of sides){
      arm(p,side,add(handle,[sign*.062,.031,0]),[sign*.79,-.64,.28]);
      p[side+'Grip']=[1,0,0];
    }
    p.kettlebells.push({grip:handle,handle:[1,0,0],down:[0,-1,0]});
  }else{
    const contact=add(p.ls,mix([.090,.065,.151],[.036,.608,.056],lift));
    arm(p,'l',contact,[.73,-.51,.24],[1,0,0],[0,-.69,-.724]);
    arm(p,'r',add(p.rs,hold?[-.171,-.191,.361]:[-.181,-.120,.334]),[-.77,-.31,.22]);
  }
  return p;
}

function variationRow(t,{gorilla=false}={}) {
  const active=t<.5?'l':'r';
  const pull=wave((2*t)%1);
  const p=person([0,gorilla?.742:.793,-.191],gorilla?1.202:1.016);
  for(const [side,sign] of sides){
    const lift=side===active?pull:0;
    foot(p,side,sign,[sign*(gorilla?.329:.183),.075,.097]);
    if(!gorilla) p[side+'s'][1]+=sign*(active==='l'?1:-1)*.060*pull;
    const down=gorilla?[sign*.164,.226,.182]:add(p[side+'s'],[sign*.050,-.600,.039]);
    const high=add(p[side+'s'],[sign*.083,-.153,-.206]);
    arm(p,side,mix(down,high,lift),[sign*.58,-.22,-.77],[0,0,1],[0,-1,0]);
  }
  return p;
}

function poweredLunge(t,{clean=false,twist=false,kneeDrive=false,traveling=false}={}) {
  const fraction=(2*t)%1;
  const lead=t<.5?1:-1;
  const phase=kneeDrive?t:traveling?2*t-(t<.5?0:1):fraction;
  const p=unloadedLunge(kneeDrive?t*.5:t,{form:clean||kneeDrive?'reverse':'plain'});
  p.kettlebells=[];
  delete p.dumbbells;
  delete p.lGrip;
  delete p.rGrip;
  if(traveling){
    const n=t<.5?0:1;
    const base=-.586+n*.586;
    const knee=arc(phase,[[0,[0]],[.18,[0]],[.41,[1]],[.57,[1]],[1,[0]]])[0];
    const travel=arc(phase,[[0,[0]],[.10,[0]],[.88,[1]],[1,[1]]])[0];
    const moved=person([0,.885-.303*knee,base+.586*travel],.034+.102*knee);
    for (const [side,sign] of sides){
      const advance=arc(phase,[[0,[0]],[.30,[1]],[1,[1]]])[0];
      const swings=sign===lead;
      const lift=swings?.122*Math.sin(Math.PI*advance)+n*.098*(1-advance):.098*knee;
      const z=swings?base+(advance*(1+n)-n)*.586:base;
      foot(moved,side,sign,[sign*.129,.075+lift,z],lift<.01);
      if(!swings)moved[side+'t']=add(moved[side+'a'],[sign*.019,-.072-lift,.141]);
      arm(moved,side,add(moved[side+'s'],[sign*.083,.065,.182]),[sign*.65,-.58,.27],[sign,0,0],[0,-.67,-.74]);
    }
    return moved;
  }
  const down=arc(phase,[[0,[0]],[.22,[0]],[.39,[1]],[.51,[1]],[.81,[0]],[1,[0]]])[0];
  if(kneeDrive){
    const lift=arc(t,[[0,[0]],[.64,[0]],[.77,[1]],[.85,[1]],[1,[0]]])[0];
    foot(p,'l',1,mix(p.la,[.144,.492,.429],lift),lift<.01);
    arm(p,'l',add(p.ls,[.082,-.588,.060]),[.48,-.30,-.74],[0,0,1],[0,-1,0]);
    idle(p,'r',-1);
  } else if(twist){
    const offset=.458*lead*down;
    const rotated=body(p.hips,.043+.128*down,offset);
    for(const key of ['chest','neck','head','ls','rs'])p[key]=rotated[key];
    sharedBell(p,add(p.chest,[offset*.47,.100,.219]),{goblet:true,centerAtHands:true});
  } else{
    const press=arc(phase,[[0,[0]],[.46,[0]],[.68,[1]],[.78,[1]],[1,[0]]])[0];
    const rack=add(p.ls,[.072,.066,.166]);
    const hang=add(p.ls,[.077,-.585,.049]);
    const receive=clean?arc(phase,[[0,[0]],[.12,[0]],[.37,[1]],[.82,[1]],[1,[0]]])[0]:1;
    const wrist=mix(mix(hang,rack,receive),add(p.ls,[.058,.609,.031]),press);
    arm(p,'l',wrist,[.75,-.58,.21],[1,0,0],mix([0,-1,0],[0,-.67,-.74],receive));
    idle(p,'r',-1);
  }
  return p;
}

function swingingSquat(t,{startingFloor=false,overhead=false,hingeOnly=false}={}) {
  const wind=arc(t,[[0,[startingFloor?.812:hingeOnly?0:1]],[.13,[1]],[.37,[0]],[.82,[0]],[1,[startingFloor?.812:hingeOnly?0:1]]])[0];
  const bend=arc(t,[[0,[0]],[.41,[0]],[.56,[1]],[.64,[1]],[.82,[0]],[1,[0]]])[0];
  const rack=arc(t,[[0,[0]],[.15,[0]],[.43,[1]],[.82,[1]],[1,[0]]])[0];
  const p=person([0,.879-(startingFloor?.287:.104)*wind-.350*bend,.024-.232*wind-.193*bend],.035+(hingeOnly?1.12:.98)*wind+.217*bend);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.177,.075,.114]);
  const base=[0,hingeOnly?.669-.378*wind:startingFloor?.290:.499,
    hingeOnly?.145:startingFloor?.228-.371*wave(t):-.164];
  const rise=overhead?arc(t,[[0,[0]],[.65,[0]],[.84,[1]],[.89,[1]],[1,[0]]])[0]:0;
  const chest=add(p.chest,[0,.115,.234]);
  const held=mix(mix(base,chest,rack),add(p.ls,[.043,.607,.050]),rise);
  if(overhead){
    arm(p,'l',held,[.74,-.60,.17],[1,0,0],mix([0,-1,0],[0,-.70,-.714],rack));
    idle(p,'r',-1);
  }else sharedBell(p,held,{goblet:rack>.50,centerAtHands:true});
  return p;
}

function rotationalDeadlift(t) {
  const depth=wave(t);
  const p=person([0,.883-.097*depth,-.221*depth],.040+1.127*depth,.230*depth);
  for(const [side,sign] of sides)foot(p,side,sign,[sign*.158,.075,.094]);
  sharedBell(p,[-.368*depth,.786-.510*depth,.169-.030*depth],{centerAtHands:true});
  return p;
}

function kneelingSideStretch(t) {
  const depth=wave(t);
  const p=fromSupport('halfKneel');
  const hips=[-.077*depth,.507-.142*depth,-.064-.117*depth];
  const pose=person(hips,.032+.145*depth);
  pose.rk=p.rk;
  pose.ra=p.ra;
  pose.rt=p.rt;
  foot(pose,'l',1,[.159+.630*depth,.075,.371-.137*depth]);
  sharedBell(pose,add(pose.chest,[0,.081,.230]),{goblet:true,centerAtHands:true});
  return pose;
}

function bellOneFloorFly(t) {
  const side=t<.5?'l':'r';
  const amount=wave((2*t)%1);
  const p=fromSupport('supineMat');
  p.kettlebells=[];
  const angle=1.405*amount;
  const hand=[(side==='l'?1:-1)*(.018+.586*Math.sin(angle)),.305+.478*Math.cos(angle),-.390];
  for(const [key,sign] of sides){
    if(key===side)arm(p,key,hand,[sign*.68,-.54,.224],[0,0,1],[0,-.39,-.921]);
    else arm(p,key,mix([sign*.045,.755,-.390],[sign*.343,.075,-.404],smooth(amount*2.5)),[sign*.73,-.51,.283]);
  }
  return p;
}

function extendedFloorPress(t) {
  const p=press(t,{floor:true,single:true,groundContact:true});
  foot(p,'r',-1,[-.209,.095,.996],false);
  p.rt=add(p.ra,[-.028,.091,.116]);
  const amount=wave(t);
  p.ls[1]-=.045*amount;
  p.rs[1]+=.033*amount;
  return p;
}

function bellBridgePullover(t) {
  const lift=arc(t,[[0,[0]],[.23,[1]],[.78,[1]],[1,[0]]])[0];
  const reach=arc(t,[[0,[0]],[.25,[0]],[.48,[1]],[.54,[1]],[.76,[0]],[1,[0]]])[0];
  const p=person([0,.157+.251*lift,.034-.047*lift],-Math.PI/2-.480*lift);
  foot(p,'l',1,[.183,.075,.526]);
  foot(p,'r',-1,[-.183,.423+.184*lift,.484],false);
  const angle=1.53*reach;
  sharedBell(p,add(p.chest,[0,.536*Math.cos(angle),.055-.530*Math.sin(angle)]),{centerAtHands:true});
  return p;
}

function bellDiagonalRaise(t) {
  const amount=wave(t);
  const p=fromSupport('floor');
  p.kettlebells=[];
  const angle=.06+2.86*amount;
  const start=[0,-.613,.086];
  const finish=[.236,.531,.147];
  const point=add(mix(start,finish,amount),[0,.115*Math.sin(Math.PI*amount),.375*Math.sin(Math.PI*amount)]);
  const contact=add(scale(add(p.ls,p.rs),.5),point);
  sharedBell(p,contact,{centerAtHands:true,down:[-.13*amount,-Math.cos(.34*amount),-.50*Math.sin(angle)]});
  return p;
}

function bellWristCurl(t) {
  const p=fromSupport('wristSeat');
  p.kettlebells=[];
  const angle=-.69+1.39*wave(t);
  const elbow=add(p.lk,[-.027,.055,-.185]);
  const grip=add(elbow,[-.011,.142*Math.sin(angle),.298+.061*Math.cos(angle)]);
  p.le=elbow;
  p.lw=grip;
  p.lGrip=[1,0,0];
  p.lFingers=[0,Math.sin(angle),Math.cos(angle)];
  p.kettlebells.push({grip,handle:[1,0,0],down:[0,-1,0]});
  idle(p,'r',-1);
  return p;
}

function placedBell(p,grip,handle=[1,0,0],down=[0,-1,0]) {
  p.kettlebells.push({grip,handle,down});
}

function floorPlank(t,{mode='pushup',deep=false}={}) {
  const rowing=mode==='row';
  const drag=mode==='drag';
  const half=t<.5?t*2:(t-.5)*2;
  const active=t<.5?'l':'r';
  const u=wave(t);
  const push=!rowing&&!drag?u:0;
  const line=rowing?.063*wave(half):0;
  const hipsY=.543-(deep?.303:.259)*push;
  const ankleY=.119;
  const ankleZ=-1.107;
  const rise=hipsY-ankleY;
  const stance=drag?.283:.210;
  const hipDepth=ankleZ+Math.sqrt(.839**2-rise**2-(stance-.104)**2);
  const p=person([drag?-.036*(t<.5?1:-1)*wave(half):0,hipsY,hipDepth],1.348+.230*push,line);
  const gripY=.227;
  for(const [side,sign] of sides){
    [p[side+'k'],p[side+'a']]=limb(p[side+'h'],[sign*stance,ankleY,ankleZ],[sign*.22,.47,.14],.422,.424);
    p[side+'t']=add(p[side+'a'],[0,-.109,.097]);
    const resting=[sign*.238,gripY,.281];
    const activeDrag=drag&&side===active;
    const dragAcross=t<.5?-1:1;
    const slide=arc(half,[[0,[0]],[.22,[0]],[.72,[1]],[1,[1]]])[0];
    const bell=[dragAcross*(.436-.872*slide),gripY,.197];
    const reach=arc(half,[[0,[0]],[.22,[1]],[.72,[1]],[1,[0]]])[0];
    const hand=drag?activeDrag?mix([sign*.238,.063,.278],bell,reach):[sign*.238,.063,.278]
      : rowing&&side===active?mix(resting,add(p[side+'s'],[sign*.038,-.056,-.337]),wave(half)):resting;
    arm(p,side,hand,[sign*(deep?.80:.62),.065,-.68]);
    if(!drag || activeDrag) p[side+'Grip']=[0,0,1];
    if(drag) {
      p[side+'Fingers']=[0,-.08,.99];
      if(!activeDrag)p[side+'PalmSide']=[0,1,0];
      if(activeDrag)placedBell(p,bell,[0,0,1]);
    }else placedBell(p,p[side+'w'],[0,0,1]);
  }
  return p;
}

function bellBurpee(t) {
  const arrival=arc(t,[[0,[0]],[.16,[1]],[.82,[1]],[1,[0]]])[0];
  const jump=arc(t,[[0,[0]],[.21,[0]],[.37,[1]],[.63,[1]],[.80,[0]],[1,[0]]])[0];
  const chest=arc(t,[[0,[0]],[.36,[0]],[.49,[1]],[.57,[0]],[1,[0]]])[0];
  const p=person([0,.88-.383*arrival+.025*jump-.154*chest,-.151-.250*jump],.033+.85*arrival+.498*jump-.17*chest);
  for(const [side,sign] of sides){
    const lift=.22*Math.sin(Math.PI*jump);
    foot(p,side,sign,[sign*.183,.075+lift,.047-1.22*jump],lift<.005&&jump<.999);
    if(jump>.99)p[side+'t']=add(p[side+'a'],[0,-.067,.14]);
    const wrist=mix(add(p[side+'s'],[sign*.063,-.54,.072]),[sign*.225,.064,.223],arrival);
    arm(p,side,wrist,[sign*.57,-.22,-.63]);
    p[side+'Fingers']=[0,-.12,.99];
    p[side+'PalmSide']=[0,1,0];
  }
  placedBell(p,[0,.226,.253]);
  return p;
}

function deckSquat(t){
  const u=arc(t,[[0,[0]],[.18,[1]],[.76,[1]],[1,[0]]])[0];
  const roll=arc(t,[[0,[0]],[.22,[0]],[.43,[1]],[.55,[1]],[.75,[0]],[1,[0]]])[0];
  const p=person([0,.875-.441*u-.277*roll,.025-.190*u-.048*roll],.033+.296*u-1.883*roll);
  for(const [side,sign] of sides){
    const ankle=mix([sign*.156,.075,.208],[sign*.207,.395,.542],roll);
    foot(p,side,sign,ankle,roll<.001);
    if(roll>0)p[side+'t']=add(p[side+'a'],[sign*.026,-.072+.11*roll,.139]);
  }
  sharedBell(p,add(p.chest,[0,.086,.195]),{goblet:true,centerAtHands:true});
  return p;
}

function assistedSplitBell(t) {
  const u=wave(t);
  const p=person([.053,.865-.301*u,1.741+.056*u],.051+.125*u);
  for (const [side,sign] of sides) {
    const left=side==='l';
    foot(p,side,sign,[left?.238:-.115,left?.075:.489,left?2.146:1.376],left);
    if(!left){p[side+'t']=add(p[side+'a'],[-.023,-.058,-.121]);p.planted[side]=.427;}
  }
  arm(p,'l',add(p.ls,[.064,.057,.177]),[.73,-.66,.11],[1,0,0],[0,-.66,-.75]);
  arm(p,'r',[-.515,1.145,1.955],[-.78,-.39,-.19]);
  p.rGrip=[0,0,1];
  return p;
}

function deficitBellSquat(t,{sumo=false,band=false}={}) {
  const u=wave(t);
  const p=person([0,1.170-.425*u,.518-.073*u],.026+.280*u);
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*(sumo?.388:.213),.369,.497],false);
    p[side+'t']=add(p[side+'a'],[sign*(sumo?.067:.034),-.071,.133]);
    p.planted[side]=.294;
  }
  const wrist=sumo?add(p.hips,[0,-.253,.208]):add(p.chest,[0,.094,.199]);
  sharedBell(p,wrist,{goblet:!sumo,centerAtHands:true});
  if(band)p.bandPath=[[p.lt[0],.305,p.lt[2]-.036],add(p.ls,[.073,-.020,.070]),
    add(p.rs,[-.073,-.020,.070]),[p.rt[0],.305,p.rt[2]-.036]];
  return p;
}

function bandedBellSwing(t) {
  const p=swing(t,{});
  const [x,y,z]=p.hips;
  p.bandPath=[[x-.165,y,z+.058],[-.055,.838,-1.08],[.055,.838,-1.08],[x+.165,y,z+.058],
    [x+.072,y,z+.144],[x-.072,y,z+.144],[x-.165,y,z+.058]];
  return p;
}

function windmillVariation(t,{bentPress=false}={}) {
  const both=!bentPress;
  const half=both?(t<.5?t*2:(t-.5)*2):t;
  const lead=t<.5||bentPress?1:-1;
  const lean=bentPress?arc(half,[[0,[0]],[.35,[1]],[.52,[1]],[.75,[0]],[1,[0]]])[0]:wave(half);
  const lock=bentPress?arc(half,[[0,[0]],[.10,[0]],[.47,[1]],[.82,[1]],[1,[0]]])[0]:1;
  const p=person([-.142*lead*lean,.871-.040*lean,-.110*lean],.027+.43*lean,-lead*.79*lean);
  for(const [side,sign] of sides){
    foot(p,side,sign,[sign*.246,.075,sign*.063]);
    p[side+'t']=add(p[side+'a'],[-lead*.077,-.070,.112]);
    const s=p[side+'s'];
    if(sign===lead){
      const raised=mix(add(s,[sign*.072,.055,.147]),add(s,[sign*.018,.602,.018]),lock);
      arm(p,side,raised,[sign*.88,-.27,.28],[1,0,0],[0,-.61,-.79]);
    }else{
      const low=add(s,[sign*.056,-.570,.121*lean]);
      arm(p,side,low,[sign*.68,-.39,.36],both?[0,0,1]:undefined,[0,-1,0]);
    }
  }
  return p;
}

function deadliftHandOff(t) {
  const half=t<.5?t*2:(t-.5)*2;
  const first=t<.5;
  const hinge=wave(half);
  const exchange=arc(half,[[0,[0]],[.42,[0]],[.57,[1]],[1,[1]]])[0];
  const p=person([-.014,.875-.087*hinge,.022-.138*hinge],.04+1.15*hinge);
  foot(p,'l',1,[.189,.075,.077]);
  foot(p,'r',-1,[-.162,.105+.537*hinge,-.03-.722*hinge],false);
  p.rt=add(p.ra,[-.012,-.097,.113]);
  const carry=first?1-2*exchange:-1+2*exchange;
  const contact=[carry*(.277-.091*hinge),.771-.486*hinge,.090+.208*hinge];
  for(const [side,sign] of sides){
    const hand=add(contact,[sign*.034,.008,0]);
    const hold=first?(sign===1?1-exchange:exchange):(sign===1?exchange:1-exchange);
    const u=Math.max(hold,hinge*.96);
    arm(p,side,mix(add(p[side+'s'],[sign*.075,-.544,.037]),hand,u),[sign*.75,-.25,-.54]);
    if(u>.45)p[side+'Grip']=[1,0,0];
  }
  placedBell(p,contact);
  return p;
}

function kettlebellSidePlank(t) {
  const height=arc(t,[[0,[0]],[.23,[1]],[.81,[1]],[1,[0]]])[0];
  const p=body([0,.212+.180*height,-.202],1.173+.380*height,0,-Math.PI/2);
  p.planted={};p.kettlebells=[];
  for (const [side,sign] of sides) {
    foot(p,side,sign,[sign*.043,.109+sign*.033,-.929],false);
    p[side+'t']=add(p[side+'a'],[.141,-.045,.053]);
  }
  p.re=[-.035,.081,.295];p.rw=[.296,.083,.346];p.rFingers=[1,0,0];p.rPalmSide=[0,1,0];
  arm(p,'l',add(p.ls,[.042,.604,.016]),[.76,-.17,-.36],[1,0,0],[0,-.67,-.74]);
  return p;
}

function tibialisBell(t) {
  const p=fromSupport('seat');
  const u=wave(t);
  delete p.dumbbells;
  p.kettlebells=[];
  p.la=[.246,.078,1.603];
  p.lt=add(p.la,[.018,-.061+.100*u,.153-.039*u]);
  for(const [side,sign] of sides)arm(p,side,add(p[side+'k'],[-sign*.028,.074,-.082]),[sign*.70,-.48,-.25]);
  placedBell(p,add(p.lt,[0,.066,.022]),[1,0,0],[0,-.17,.99]);
  return p;
}

function bellGetUp(t,{toKnee=false,bottoms=false,handOnly=false}={}) {
  const pSteps=toKnee?[[0,[0]],[.12,[.33]],[.26,[.61]],[.45,[1]],[.55,[1]],[.74,[.61]],[.87,[.33]],[1,[0]]]
    :[[0,[0]],[.23,[.42]],[.45,[1]],[.58,[1]],[.79,[.42]],[1,[0]]];
  const up=arc(t,pSteps)[0];
  const stages=toKnee?[[0,[.148,.143,-1.466,0]],[.32,[.258,.112,-.931,.223]],
    [.60,[.418,.065,-.393,.329]],[1,[.532,.125,.018,.042]]]
    :[[0,[.144,.143,-1.466,0]],[.42,[.198,.139,-.933,-.223]],[1,[handOnly?.226:.208,.112,-.308,-.227]]];
  const [y,z,pitch,tilt]=arc(up,stages);
  const p=body([-.078*up,y,z],pitch, -.308*up,tilt);
  p.kettlebells=[];p.planted={};
  for(const [side,sign] of sides){
    const rear=toKnee?arc(up,[[0,[0]],[.60,[0]],[1,[1]]])[0]:0;
    const ankle=side==='l'?[.231,.080,.702]:mix([-.317,.097,.884],[-.187,.086,-.268],rear);
    foot(p,side,sign,ankle,side==='l');
    if(side==='r')p.rt=add(p.ra,[-.023,-.067,.142-.265*rear]);
  }
  const from=[-.418,.095,-.143], palm=[-.462,.062,-.160];
  arm(p,'r',mix(from,palm,Math.min(1,up*2.25)),[-.42,-.71,.12]);
  p.rFingers=[-.83,-.09,.55];p.rPalmSide=[0,1,0];
  arm(p,'l',add(p.ls,[.014,.610,.039]),[.78,-.11,.43],[1,0,0],bottoms?[0,1,0]:[0,-.69,-.72]);
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
  ['3572',press,{single:true},'kettlebell-left',['l:shoulder','l:triceps']],
  ['3736',press,{single:true,bottoms:true},'kettlebell-left',['l:shoulder','l:forearm','l:triceps']],
  ['4446',press,{single:true,setting:'half',bottoms:true},'kettlebell-left',['l:shoulder','l:forearm','core']],
  ['2927',press,{single:true,setting:'kneel',bottoms:true},'kettlebell-left',['l:shoulder','l:forearm','core']],
  ['2934',press,{single:true,setting:'half'},'kettlebell-left',['l:shoulder','l:triceps','core']],
  ['2932',press,{single:true,setting:'kneel'},'kettlebell-left',['l:shoulder','l:triceps','core']],
  ['3737',press,{seated:true,single:true},'seat-kettlebell-left',['l:shoulder','l:triceps']],
  ['9703',press,{single:true,setting:'z'},'mat-kettlebell-left',['l:shoulder','l:triceps','core']],
  ['4845',press,{floor:true,groundContact:true},'mat-kettlebells',['pec','triceps']],
  ['4846',press,{floor:true,groundContact:true,single:true,bottoms:true},'mat-kettlebell-left',['l:pec','l:triceps','l:forearm']],
  ['0522',row,{alternate:true},'kettlebells',['lat','biceps']],
  ['6156',row,{single:true},'kettlebell-left',['l:lat','l:biceps']],
  ['4536',row,{elbowsOut:true},'kettlebells',['rearShoulder','trap']],
  ['4244',carry,{overhead:true},'kettlebell-left',['l:shoulder','core']],
  ['9697',carry,{overhead:true,bottoms:true},'kettlebell-left',['l:shoulder','l:forearm','core']],
  ['4528',carry,{farmers:true},'kettlebells',['forearm','trap','core']],
  ['2916',carry,{goblet:true},'kettlebell-left',['forearm','core']],
  ['9609',deadlift,{},'kettlebell-left',['glute','hamstring','quad']],
  ['3733',deadlift,{straight:true},'kettlebell-left',['hamstring','glute']],
  ['8892',deadlift,{stagger:true},'kettlebell-left',['l:hamstring','l:glute']],
  ['4046',deadlift,{wide:true},'kettlebell-left',['quad','glute','hamstring']],
  ['4403',deadlift,{wide:true,double:true},'kettlebells',['quad','glute','hamstring']],
  ['4133',deadlift,{suitcase:true},'kettlebell-left',['quad','glute','core']],
  ['10673',loadedSquat,{},'kettlebell-left',['quad','glute']],
  ['5880',loadedSquat,{calves:true},'kettlebell-left',['quad','glute','calf']],
  ['4123',loadedSquat,{frontRack:true},'kettlebell-left',['quad','glute','core']],
  ['4089',loadedSquat,{sumo:true},'kettlebell-left',['quad','glute']],
  ['5073',loadedSquat,{sumo:true},'kettlebell-left',['quad','glute']],
  ['1568',swing,{single:true},'kettlebell-left',['hamstring','glute','core']],
  ['4527',swing,{single:true},'kettlebell-left',['hamstring','glute','core']],
  ['3680',swing,{},'kettlebell-left',['hamstring','glute','core']],
  ['3571',swing,{overhead:true},'kettlebell-left',['hamstring','glute','shoulder']],
  ['10192',swing,{lateral:true},'kettlebell-left',['hamstring','glute','core']],
  ['8366',swing,{lateral:true},'kettlebell-left',['hamstring','glute','core']],
  ['2942',press,{single:true,lateral:true},'kettlebell-left',['l:shoulder','l:triceps']],
  ['3740',raiseBell,{single:true},'kettlebell-left',['l:shoulder']],
  ['6833',raiseBell,{seated:true},'seat-kettlebells',['shoulder']],
  ['5859',raiseBell,{front:true},'kettlebell-left',['shoulder']],
  ['5857',curlBell,{},'kettlebell-left',['l:biceps']],
  ['5856',curlBell,{seated:true},'seat-kettlebell-left',['l:biceps']],
  ['5860',tricepsBell,{},'kettlebell-left',['triceps']],
  ['5863',tricepsBell,{single:true},'kettlebell-left',['l:triceps']],
  ['4396',standingIsolation,{bend:true},'kettlebell-left',['core']],
  ['6194',standingIsolation,{shrug:true},'kettlebells',['trap']],
  ['4408',standingIsolation,{},'kettlebell-left',['shoulder','trap']],
  ['3734',deadlift,{stagger:true},'kettlebell-left',['l:hamstring','l:glute']],
  ['1569',singleLegHinge,{},'kettlebell-left',['l:hamstring','l:glute']],
  ['4523',singleLegHinge,{opposite:true},'kettlebell-left',['l:hamstring','l:glute']],
  ['3575',lungeBell,{back:true},'kettlebell-left',['quad','glute']],
  ['5070',lungeBell,{back:true},'kettlebell-left',['quad','glute']],
  ['3574',lungeBell,{},'kettlebell-left',['quad','glute']],
  ['5336',lungeBell,{},'kettlebell-left',['quad','glute']],
  ['7581',lungeBell,{back:true,sideLoad:true},'kettlebell-left',['quad','glute','core']],
  ['7582',lungeBell,{back:true,sideLoad:true,sameRear:true},'kettlebell-left',['quad','glute','core']],
  ['4059',lungeBell,{staticFeet:true},'kettlebell-left',['quad','glute']],
  ['5071',lungeBell,{overhead:true},'kettlebell-left',['quad','glute','shoulder','core']],
  ['4045',sideSquatBell,{},'kettlebell-left',['quad','glute']],
  ['4098',sideSquatBell,{oneSide:true},'kettlebell-left',['l:quad','l:glute']],
  ['4524',sideSquatBell,{bothKnees:true},'kettlebell-left',['quad','glute']],
  ['6193',sideSquatBell,{cossack:true},'kettlebell-left',['quad','glute']],
  ['4530',clean,{single:true,floorStart:true},'kettlebell-left',['l:shoulder','glute']],
  ['4543',clean,{single:true,floorStart:true},'kettlebell-left',['l:shoulder','glute']],
  ['1565',clean,{single:true,floorStart:true,deadStart:true},'kettlebell-left',['l:shoulder','glute']],
  ['5855',cleanAndPress,{backswing:false},'kettlebell-left',['l:shoulder','glute','l:triceps']],
  ['4531',cleanAndPress,{push:true},'kettlebell-left',['l:shoulder','glute','l:triceps']],
  ['4542',cleanAndPress,{jerk:true},'kettlebell-left',['l:shoulder','glute','l:triceps']],
  ['0537',cleanAndPress,{hang:true,jerk:true},'kettlebell-left',['l:shoulder','glute','l:triceps']],
  ['0526',alternatingHangClean,{alternate:true},'kettlebells',['shoulder','glute']],
  ['9692',rackThruster,{alternate:true},'kettlebells',['quad','glute','shoulder']],
  ['4541',rackThruster,{one:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['4518',rackThruster,{one:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['4817',goodMorning,{},'kettlebell-left',['hamstring','glute']],
  ['6425',goodMorning,{},'kettlebell-left',['hamstring','glute']],
  ['11287',goodMorning,{behind:true},'kettlebell-left',['hamstring','glute']],
  ['4132',sumoHighPull,{},'kettlebell-left',['quad','glute','trap']],
  ['2939',bellHalo,{},'kettlebell-left',['shoulder','core']],
  ['8331',bellHalo,{setting:'half'},'kettlebell-left',['shoulder','core']],
  ['3578',slingshot,{},'kettlebell-left',['core','forearm']],
  ['4534',slingshot,{},'kettlebell-left',['core','forearm']],
  ['12018',slingshot,{fast:true},'kettlebell-left',['core','forearm']],
  ['3732',bellCurtsy,{},'kettlebell-left',['quad','glute']],
  ['4535',bellMatCore,{single:true,floor:true},'mat-kettlebell-left',['core','l:shoulder']],
  ['1187',bellMatCore,{floor:true},'mat-kettlebell-left',['core']],
  ['5072',bellMatCore,{pressUp:true,floor:true},'mat-kettlebell-left',['core','shoulder']],
  ['4393',bellMatCore,{twist:true,feetRaised:true,floor:true},'mat-kettlebell-left',['core']],
  ['10327',bellMatCore,{twist:true,floor:true},'mat-kettlebell-left',['core']],
  ['8371',bellMatCore,{twist:true,touch:true,floor:true},'mat-kettlebell-left',['core']],
  ['4538',bellMatCore,{floor:true,pullover:true},'mat-kettlebell-left',['lat','pec']],
  ['3735',bellMatCore,{floor:true,tabletop:true,pullover:true},'mat-kettlebell-left',['lat','core']],
  ['9518',bellMatCore,{floor:true,pullover:true,deadBug:true,activeLegs:true,alternate:true},'mat-kettlebell-left',['lat','core']],
  ['4047',bellMatCore,{floor:true,deadBug:true,activeLegs:true,alternate:true},'mat-kettlebell-left',['core']],
  ['9517',bellMatCore,{floor:true,deadBug:true,activeLegs:true,alternate:true},'mat-kettlebell-left',['core']],
  ['5858',bellFly,{floor:true},'mat-kettlebells',['pec','shoulder']],
  ['6820',bellFly,{incline:true},'incline-bench-kettlebells',['pec','shoulder']],
  ['5861',bellBenchTriceps,{},'bench-kettlebell-left',['triceps']],
  ['3738',bellBenchPress,{},'bench-kettlebell-left',['l:pec','l:triceps']],
  ['3739',bellBenchPress,{bottoms:true},'bench-kettlebell-left',['l:pec','l:triceps','l:forearm']],
  ['5854',bellStepCalfRaise,{},'step-kettlebell-left',['calf']],
  ['4963',bellBoxSquat,{},'box-kettlebell-left',['quad','glute']],
  ['4134',bellBoxStep,{fixed:true,carry:true},'box-kettlebell-left',['l:quad','l:glute']],
  ['4400',bellBoxStep,{},'box-kettlebell-left',['l:quad','l:glute']],
  ['4440',bellBoxStep,{carry:true},'box-kettlebell-left',['l:quad','l:glute']],
  ['10674',loadedSquatVariation,{back:true},'kettlebell-left',['quad','glute']],
  ['1566',loadedSquatVariation,{hold:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['3573',loadedSquatVariation,{sots:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['5867',variationRow,{alternate:true},'kettlebells',['lat','biceps','core']],
  ['7230',variationRow,{alternate:true,gorilla:true},'kettlebells',['lat','biceps']],
  ['4533',poweredLunge,{alternate:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['4441',poweredLunge,{alternate:true,traveling:true},'kettlebells',['quad','glute','core']],
  ['3577',poweredLunge,{alternate:true,clean:true},'kettlebell-left',['quad','glute','l:shoulder']],
  ['5069',poweredLunge,{alternate:true,twist:true},'kettlebell-left',['quad','glute','core']],
  ['10562',poweredLunge,{kneeDrive:true},'kettlebell-left',['quad','glute','core']],
  ['7563',swingingSquat,{startingFloor:true},'kettlebell-left',['glute','hamstring','quad']],
  ['7751',swingingSquat,{startingFloor:true},'kettlebell-left',['glute','hamstring','quad']],
  ['7548',swingingSquat,{},'kettlebell-left',['glute','hamstring','quad']],
  ['9485',swingingSquat,{hingeOnly:true},'kettlebell-left',['glute','hamstring','quad']],
  ['5335',swingingSquat,{overhead:true},'kettlebell-left',['glute','quad','l:shoulder']],
  ['5886',rotationalDeadlift,{},'kettlebell-left',['hamstring','glute','core']],
  ['11286',kneelingSideStretch,{setting:'half'},'kettlebell-left',['quad','core']],
  ['11284',bellOneFloorFly,{floor:true,alternate:true},'mat-kettlebell-left',['pec','shoulder']],
  ['0531',extendedFloorPress,{floor:true},'mat-kettlebell-left',['l:pec','l:triceps']],
  ['3522',bellBridgePullover,{floor:true},'mat-kettlebell-left',['l:glute','lat']],
  ['4532',clean,{single:true,floorStart:true,snatch:true},'kettlebell-left',['l:shoulder','glute']],
  ['4210',clean,{single:true,floorStart:true,snatch:true,split:true},'kettlebell-left',['l:shoulder','quad','glute']],
  ['1567',clean,{single:true,floorStart:true,open:true},'kettlebell-left',['l:shoulder','glute']],
  ['0543',bellDiagonalRaise,{},'kettlebell-left',['shoulder','core']],
  ['5862',bellWristCurl,{seated:true},'bench-kettlebell-left',['l:forearm']],
  ['0521',floorPlank,{floor:true,mode:'row',alternate:true},'kettlebells',['lat','core','biceps']],
  ['4444',assistedSplitBell,{},'assisted-split-kettlebell-left',['l:quad','l:glute']],
  ['4167',bandedBellSwing,{},'kettlebell-banded-swing',['glute','hamstring']],
  ['0524',windmillVariation,{bentPress:true},'kettlebell-left',['l:shoulder','core']],
  ['4230',bellGetUp,{floor:true,toKnee:true,bottoms:true},'mat-kettlebell-left',['l:shoulder','core','glute']],
  ['3864',bellBurpee,{floor:true},'kettlebell-left',['pec','quad','core']],
  ['3579',deckSquat,{},'mat-kettlebell-left',['quad','glute','core']],
  ['3580',floorPlank,{floor:true,deep:true},'kettlebells',['pec','triceps','core']],
  ['0530',windmillVariation,{alternate:true},'kettlebells',['shoulder','core','hamstring']],
  ['2751',deficitBellSquat,{sumo:true},'wide-step-kettlebell-left',['quad','glute','adductor']],
  ['5301',deficitBellSquat,{},'step-kettlebell-left',['quad','glute']],
  ['3323',bellGetUp,{floor:true},'mat-kettlebell-left',['l:shoulder','core']],
  ['7229',floorPlank,{floor:true,mode:'drag',alternate:true},'kettlebell-left',['core','shoulder']],
  ['4521',floorPlank,{floor:true},'kettlebells',['pec','triceps']],
  ['2753',deficitBellSquat,{band:true},'step-banded-kettlebell-left',['quad','glute']],
  ['5879',kettlebellSidePlank,{floor:true},'mat-kettlebell-left',['core','l:shoulder']],
  ['10561',deadliftHandOff,{alternate:true},'kettlebell-left',['l:hamstring','l:glute','core']],
  ['10367',tibialisBell,{seated:true},'bench-kettlebell-left',['l:calf']],
  ['4057',bellGetUp,{floor:true,handOnly:true},'mat-kettlebell-left',['l:shoulder','core']],
];
const [directory,...requested]=process.argv.slice(2);
if(!directory) throw new Error('Pass an output directory and optional catalogue IDs.');
if(new Set(items.map(([id])=>id)).size!==items.length) throw new Error('Duplicate catalogue IDs.');
const selected=requested.length?items.filter(([id])=>requested.includes(id)):items;
if(requested.length && selected.length!==requested.length) throw new Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const jobs=[];
const failed=[];
for(const [id,move,settings,equipment,muscles] of selected){
  const recipe=id+'.json';
  const camera=move===swing&&settings.overhead?{yaw:63,elevation:13,focus:[0,1.08,.02],height:2.55}
    : move===floorPlank || move===kettlebellSidePlank?{yaw:69,elevation:22,focus:[0,.40,-.30],height:1.63}
    : move===bellBurpee?{yaw:66,elevation:18,focus:[0,.84,-.42],height:2.29}
    : move===deckSquat?{yaw:65,elevation:19,focus:[0,.83,.02],height:2.20}
    : move===assistedSplitBell?{yaw:61,elevation:15,focus:[-.10,.86,1.68],height:2.16}
    : move===bellGetUp?settings.toKnee?{yaw:62,elevation:22,focus:[-.06,.78,.19],height:2.25}
      :{yaw:62,elevation:24,focus:[-.06,.62,.19],height:1.94}
    : move===windmillVariation?{yaw:25,elevation:15,focus:[0,1.01,.06],height:2.30}
    : move===tibialisBell?{yaw:60,elevation:21,focus:[.10,.66,1.46],height:1.55}
    : move===deficitBellSquat?{yaw:60,elevation:14,focus:[0,1.03,.51],height:2.36}
    : move===bandedBellSwing?{yaw:66,elevation:15,focus:[0,.91,-.34],height:2.26}
    : move===bellWristCurl?{yaw:62,elevation:20,focus:[.10,.70,1.40],height:1.69}
    : move===bellBoxSquat?{yaw:66,elevation:17,focus:[0,.96,.70],height:2.34}
    : move===bellBoxStep?{yaw:64,elevation:17,focus:[0,1.10,.38],height:2.40}
    : move===loadedSquatVariation && settings.back?{yaw:117,elevation:16,focus:[0,.94,.02],height:2.23}
    : move===poweredLunge && settings.traveling?{yaw:66,elevation:14,focus:[0,.94,-.12],height:2.47}
    : move===bellBenchPress || move===bellBenchTriceps ? {yaw:66,elevation:18,focus:[.10,.74,1.03],height:1.80}
    : move===bellFly && settings.incline ? {yaw:61,elevation:19,focus:[0,.81,.16],height:1.90}
    : move===bellMatCore && (settings.single || settings.pressUp || !settings.twist && !settings.tabletop && !settings.pullover && !settings.deadBug)
      ? {yaw:67,elevation:21,focus:[0,.68,-.04],height:1.93}
    : move===bellHalo && !settings.setting ? {yaw:65,elevation:15,focus:[0,.99,.015],height:2.31}
    : settings.setting==='z'?{yaw:59,elevation:18,focus:[0,.58,.06],height:1.87}
    : settings.setting?{yaw:53,elevation:15,focus:[0,.82,-.07],height:2.02}
      : {yaw:settings.floor?62:48,elevation:16,focus:[0,settings.floor?.48:settings.seated?.76:.98,.035],
        height:settings.floor?1.65:settings.seated?1.90:2.34};
  const data={version:1,durationMs:move===bellGetUp || move===bellBurpee || move===deckSquat ? 6450 : move===kettlebellSidePlank ? 5800 :settings.alternate?5650:move===carry?3240:move===bellCurtsy?5900:move===slingshot&&settings.fast?2850:4050,equipment,muscles,camera,
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...move(i/60,settings)}))};
  try{prepareRecipe(data);await writeFile(resolve(output,recipe),JSON.stringify(data)+'\n');
    jobs.push({id,recipe,posterAt:settings.alternate?.25:.47});}
  catch(error){failed.push({id,error:error.message});}
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items:jobs},null,2)+'\n');
console.log(JSON.stringify({prepared:jobs.length,failed},null,2));
if(failed.length)process.exitCode=1;
