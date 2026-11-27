import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, sides, stand } from './bodyweight/pose.mjs';

const ground=.078;
const radius=.285;
const floorView={yaw:54,elevation:19,height:1.98,focus:[0,.55,.1]};
const wallView={yaw:69,elevation:14,height:2.38,focus:[0,.90,.30]};
const seatView={yaw:40,elevation:15,height:2.14,focus:[0,.79,.10]};
const rows=[];
const opposite=side=>side==='l'?'r':'l';
const laterality=side=>side==='l'?1:-1;

function addGroup(motion,muscles,view,variants) {
  for (const [id,options] of variants) rows.push({id,motion,options,muscles:options.muscles??muscles,
    equipment:options.equipment??'stability-ball',view:{...view,...options.view}});
}

function plantFoot(pose,side,target,heel=false) {
  const s=laterality(side);
  leg(pose,side,target,[s*.11,-.13,1],[s*.016,heel?.015:-.071,.135],0);
}

function freeFoot(pose,side,target,knee=[0,.8,1],toes=[0,-.07,.124]) {
  leg(pose,side,target,knee,toes);
}

function handsDown(pose,z,y=.082,spread=.224) {
  for (const [side,s] of sides) arm(pose,side,[s*spread,y,z],[s*.71,.069,-.512],[s*.073,-.022,.98],[0,1,0]);
}

function handsAtHead(pose) {
  for (const [side,s] of sides) arm(pose,side,add(pose.head,[s*.119,-.076,.006]),[s*.96,.13,.01],[0,.88,.38],[0,0,1]);
}

function handsOpen(pose,y=.014) {
  for (const [side,s] of sides) arm(pose,side,add(pose[side+'s'],[s*.574,y,.075]),[s*.54,1,-.08],[s,.04,.13],[0,1,0]);
}

function repSide(phase) {
  return [phase<.5?'l':'r',rep((phase*2)%1,.34,.63)];
}

function anklesOnBall(phase,{kind}) {
  const t=rep(phase);
  const tuck=kind==='tuck', pike=kind==='pike', push=kind==='push';
  const z=-1.03+(tuck?.576*t:pike?.525*t:0);
  const pitch=push?mix(1.49,1.70,t):pike?mix(1.55,2.945,t):mix(1.54,1.38,t);
  const ankleZ=z+(tuck?mix(.05,.041,t):.067);
  const ankleY=radius+Math.sqrt(radius**2-.090**2-(ankleZ-z)**2)+.072;
  const pikeZ=-.145+.174*t;
  const pikeY=ankleY+Math.sqrt(Math.max(0,.841**2-(ankleZ-pikeZ)**2))*(.55+.45*t);
  const hip=push?[0,mix(.631,.49,t),-.235]:pike?[0,pikeY,pikeZ]:[0,.622+.064*t,-.237+.275*t];
  const pose=stand(hip,pitch);
  pose.ballCenter=[0,radius,z];
  handsDown(pose,pike?mix(.315,.175,t):.205,.080,push?.255:.216);
  for(const[side,s]of sides) {
    freeFoot(pose,side,[s*.090,ankleY,ankleZ],[s*.13,-.78,tuck&&t>.2?.70:-.22],[s*.011,-.074,-.116]);
  }
  return pose;
}

function heelsOnBall(phase,{kind,rise=.36,pull=.49}) {
  const t=rep(phase,kind==='hold'?.27:.44,kind==='hold'?.75:.54);
  const shoulderZ=-.525;
  const curl=['curl','single-curl','hold','cross'].includes(kind);
  const lift=['bridge','roll-bridge','curl','single-curl','hold'].includes(kind);
  const hip=[0,(kind==='hold'?.144:lift ? .166+rise*(kind==='curl'||kind==='single-curl'? .89+.11*t:t) : .166),
    (kind==='hold'?-.03:.020) - (lift?.081*t:0)];
  const pitch=kind==='crunch'?mix(-1.53,-.78,t):kind==='hold'?mix(-.67,-.57,t):
    Math.atan2(shoulderZ-hip[2],.211-hip[1]);
  const pose=stand(hip,pitch);
  const ballZ=(kind==='curl'||kind==='single-curl'?.831:.745)-(curl?pull*t:kind==='roll-bridge'?.080*t:0);
  pose.ballCenter=[0,radius,ballZ];
  const sideForSingle='r';
  for(const[side,s]of [...sides].reverse()) {
    const az=ballZ+.020;
    if (kind==='single-curl'&&side===sideForSingle) {
      freeFoot(pose,side,[s*.149,.865+.021*t,ballZ-.17],[s*.16,.6,1],[0,.118,.087]);
    } else if(kind==='crunch') {
      freeFoot(pose,side,[s*.11,.568,ballZ+.149],[s*.13,1,-.49],[0,.029,.133]);
    } else if(kind==='cross'&&side==='l') {
      freeFoot(pose,'l',add(pose.rk,[.091,.023,-.058]),[.95,.37,-.16],[-.116,.008,.041]);
    } else {
      const x=s*.105;
      const top=radius+Math.sqrt(radius**2-x**2-(az-ballZ)**2);
      freeFoot(pose,side,[x,top+.054,az],[s*.144,1,-.28],[s*.009,.062,.124]);
    }
  }
  if(kind==='crunch') handsAtHead(pose);
  else handsDown(pose,kind==='hold'?-.319:-.333,.076,.281);
  return pose;
}

function backOnBall(phase,{kind,depth=.72}) {
  const [lead,sided]=repSide(phase);
  const symmetric=kind==='relax'||kind==='stretch'||kind==='situp'||kind==='weighted'||kind==='frog';
  const t=symmetric?rep(phase,kind==='relax'||kind==='stretch'?.30:.42,kind==='relax'||kind==='stretch'?.69:.55):sided;
  const sign=laterality(lead);
  const ballZ=-.265;
  const rest=kind==='relax'||kind==='stretch';
  const twist=kind==='twist'||kind==='russian';
  const sideBend=kind==='side';
  const angle=rest?mix(-.93,-1.48,t):twist?(-1.406+.012*t):sideBend?mix(-1.65,-.923,t):mix(kind==='weighted'?-1.62:-1.33,-.51,t*depth);
  const hip=[kind==='twist'?sign*.112*t:0,twist?.524:sideBend?.61:.441,sideBend?-.264:.123];
  const yaw=sideBend?Math.PI*.5:kind==='russian'?sign*.675*t:0;
  const pose=stand(hip,angle,yaw,sideBend?mix(.31,.73,t):0);
  pose.ballCenter=[0,radius,ballZ];
  if (kind==='side') {
    plantFoot(pose,'l',[.716,ground,-.03]); plantFoot(pose,'r',[.590,ground,.202]);
  } else if(kind==='frog') {
    for(const[side,s]of sides) freeFoot(pose,side,[s*.053,.10+.236*t,.606-.072*t],[s*.94,.42,.29],[0,-.042,.133]);
  } else for(const[side,s]of sides) {
    if(kind==='kick'&&side===lead) {
      freeFoot(pose,side,[s*.172,.083+.455*t,.655+.272*t],[s*.14,.64,1]);
    } else plantFoot(pose,side,[s*(twist?.189:.216)+(kind==='twist'?sign*.144*t:0),ground,.609]);
  }
  if(kind==='relax'||kind==='twist') handsOpen(pose,-.035);
  else if(kind==='stretch') for(const[side,s]of sides) arm(pose,side,add(pose[side+'s'],[s*.124,-.116,-.570]),[s*.78,.46,.14],[0,-.24,-.971]);
  else if(kind==='russian') {
    const armRotation=.86*t*sign;
    for(const[side,s]of sides) arm(pose,side,
      [Math.sin(armRotation)*.578+s*.045,.598+Math.cos(armRotation)*.593,-.317],
      [s*.45,.18,.33],[0,1,0]);
  }
  else if(kind==='weighted') {
    const p=add(pose.chest,[0,.156,.121]);const axis=[0,.78,-.63];
    for(const[side,s]of sides)grip(pose,side,add(p,[s*.121,0,0]),[s*.7,-.49,.25],axis);
    pose.dumbbells=[{center:p,axis}];
  } else handsAtHead(pose);
  return pose;
}

function proneOnBall(phase,{kind,high=false}) {
  const [lead,sided]=repSide(phase);
  const alternate=kind==='alternate';
  const t=alternate?sided:rep(phase,kind==='relax'?.30:.44,kind==='relax'?.74:.54);
  const stretch=kind==='relax'||kind==='pyramid';
  const bp=high?.731:radius;
  const hip=[0,bp+.371,kind==='relax'?-.046:-.108];
  const pose=stand(hip,stretch?mix(1.79,2.13,t):kind==='chest'?1.595:high?1.70:1.665);
  pose.ballCenter=[0,bp,.030];
  for(const[side,s]of sides) {
    if(!stretch&&!alternate) {
      const thigh=mix(high?-1.87:-2.00,-3.06,t);
      legAngles(pose,side,s,thigh,thigh-.045,.026);
    }else if(kind==='relax') {
      freeFoot(pose,side,[s*.168,.118,-.417],[s*.63,-.65,-.37],[s*.01,-.06,-.11]);
    }else{
      const az=alternate?-.661:-.554;
      leg(pose,side,[s*.149,.073,az],[s*.16,-.82,-.19],[s*.012,-.069,.095],0);
    }
    if(alternate&&side===lead){
      arm(pose,side,blend([s*.217,.076,.590],[s*.193,.617,1.025],t),[s*.73,-.56,.06],[0,-.06,1],[0,1,0]);
    }else{
      arm(pose,side,[s*(high?.197:.239),high?.461:stretch?.061:.080,high?.325:.555],
        [s*.82,-.07,-.48],[s*.05,-.021,1],[0,1,0]);
    }
  }
  return pose;
}

function seatedBall(phase,{kind}) {
  const [lead,t]=repSide(phase); const sign=laterality(lead);
  const hip=[0,.647,.001];
  const pose=stand(hip,kind==='hamstring'?.05+.52*t:kind==='quad'?.063:0,
    kind==='twist'?sign*.80*t:0,kind==='shoulder'?-.062*sign*t:0);
  pose.ballCenter=[0,radius,-.047];
  for(const[side,s]of sides) {
    const moves=side===lead;
    const kick=kind==='extension'&&moves;
    if(kind==='quad'&&moves){
      freeFoot(pose,side,[s*.277,.431+.071*t,-.297],[s*.53,-.83,.25],[0,-.088,-.082]);
      const wrist=add(pose[side+'a'],[s*.019,.084,.025]);
      arm(pose,side,wrist,[s*.91,-.4,.05],[0,-.8,-.4]);
    }else{
      const z=kind==='hamstring'&&moves?mix(.363,.646,t):.360;
      if(kick) freeFoot(pose,side,[s*.156,.081+.484*t,z+.446*t],[s*.22,-.22,1]);
      else if(kind==='shoulder'&&moves) freeFoot(pose,side,[s*.171,.089+.096*t,z],[s*.22,.2,1]);
      else plantFoot(pose,side,[s*.172,ground,z],kind==='hamstring'&&moves);
      if(kind==='twist') {
        arm(pose,side,add(pose.chest,[sign*.224*t+s*.087,.043,.310]),[s*.71,-.67,.13],[0,.34,.9]);
      }else if(kind==='shoulder'&&moves){
        arm(pose,side,add(pose[side+'s'],[s*.036,-.541+.487*t,.144+.439*t]),[s*.26,-.86,-.27],[0,.13,.99]);
      }else{
        const other=opposite(lead);
        const knee=pose[(kind==='hamstring'&&pose[other+'k']?other:side)+'k'];
        arm(pose,side,add(knee,[s*.058,.081,.065]),[s*.8,-.34,-.14],[s*.04,-.22,.968],[0,1,0]);
      }
    }
  }
  return pose;
}

function wallBall(phase,{mode}) {
  const t=rep(phase),wallFront=mode==='slide'||mode==='circle';
  const single=mode==='one';
  if(wallFront) {
    const a=2*Math.PI*phase;
    const cy=mode==='slide'?mix(.987,1.607,t):1.328+.102*Math.cos(a);
    const cx=mode==='circle'?-.171+.102*Math.sin(a):0;
    const pose=stand([0,.845,mode==='slide'?.278:.049],mode==='slide'?.146+.090*t:.057);
    pose.ballCenter=[cx,cy,1.20-radius];
    plantFoot(pose,'l',[.145,ground,mode==='slide'?.488:.299]);plantFoot(pose,'r',[-.143,ground,mode==='slide'?.253:.071]);
    for(const[side,s]of sides) {
      if(mode==='circle'&&side==='l')arm(pose,side,add(pose[side+'h'],[s*.10,-.063,.074]),[s*.6,-.6,-.1]);
      else {
        const point=add(pose.ballCenter,[mode==='circle'?0:s*.118,mode==='slide'?.103:.004,-.260]);
        arm(pose,side,point,[s*.692,-.71,.08],[0,mode==='slide'?.99:.13,.15],[s,0,0]);
      }
    }
    return pose;
  }
  const hips=[single?-.087:0,.893-(single?.421:.444)*t,-.123+.044*t];
  const pose=stand(hips,-.067);
  pose.ballCenter=[hips[0],hips[1]+.086,-.693+radius];
  for(const[side,s]of sides) {
    if(single&&side==='l') freeFoot(pose,side,[.169,mix(.255,.386,t),mix(.267,.679,t)],[s*.14,.72,.68],[.02,-.038,.124]);
    else plantFoot(pose,side,[s*.160,ground,.435]);
    arm(pose,side,add(pose[side+'s'],[s*.014,mix(-.49,-.193,t),mix(.193,.535,t)]),[s*.32,-.76,.11],[0,.146,1]);
  }
  return pose;
}

function anchoredRollout(phase,{kind,ranges=.44}) {
  const t=rep(phase,kind==='plank'?.27:.43,kind==='plank'?.78:.54);
  const kneel=kind==='roll'||kind==='rounded'||kind==='stretch';
  const plank=kind==='saw'||kind==='plank';
  const travel=kind==='plank'?.024:kind==='saw'?.141:ranges;
  const z=.318+travel*t;
  const y=kneel?mix(.488,.384,t):mix(.565,.600,t);
  const pitch=kneel?mix(kind==='stretch'?1.22:.638,kind==='rounded'?1.27:1.50,t):mix(1.29,1.36,t);
  const hip=[0,y,kneel?mix(-.443,-.218,t):-.273+.069*t];
  const pose=stand(hip,pitch);
  pose.ballCenter=[0,radius,z];
  for(const[side,s]of sides) {
    if(kneel) {
      pose[side+'k']=[s*.155,.094,-.42];
      pose[side+'a']=[s*.159,.065,-.838];
      pose[side+'t']=[s*.170,.041,-.949];
    }else leg(pose,side,[s*.139,.115,-1.025],[s*.13,-.76,-.24],[s*.011,-.098,.092],0);
    const gx=s*(plank?.122:.111);
    if(plank) {
      pose[side+'e']=[gx,.541,z-.034];
      pose[side+'w']=[gx,.602,z+.325];
      pose[side+'Fingers']=[0,-.05,1];
      pose[side+'PalmSide']=[0,1,0];
    }else arm(pose,side,[gx,radius+Math.sqrt(radius**2-gx**2)+.073,z+.122],
      [s*.56,-.72,-.55],[0,-.20,1],[0,1,0]);
  }
  return pose;
}

function ballTransfer(phase,{mode}) {
  const alternating=mode==='dead' || mode==='pass';
  const [lead,t0]=repSide(phase);
  const t=alternating?t0:rep(phase);
  const dead=mode==='dead', pass=mode==='pass';
  const hip=[0,.156,.034];
  const pose=stand(hip,dead?-1.54:mix(-1.53,pass?-.61:-.89,t));
  const fixedBall=[0,.650,-.206];
  const movedBall=blend([0,.355,-1.018],[0,.745,.284],t);
  let ball=dead?fixedBall:movedBall;
  const fullPass = pass && (lead==='r' && phase < .75 || lead==='l' && phase >= .25);
  if(pass&&fullPass) ball=blend([0,.257,.841],[0,.832,.088],t);
  if(pass&&!fullPass) ball=blend([0,.337,-.993],[0,.832,.088],t);
  pose.ballCenter=ball;
  for(const[side,s]of sides) {
    const reaches=side===lead;
    const point=dead?blend([s*.112,.494,-.074],[s*.150,.129,.815],reaches?t:0):
      pass&&fullPass?[s*.123,ball[1]-.047,ball[2]-.129]:[s*.126,mix(.098,.685,t),mix(.826,.448,t)];
    freeFoot(pose,side,point,[s*.14,pass?.15:.92,pass?-.69:.04],[s*.013,.057,.122]);
    const doesRelease=dead&&side!==lead;
    const wrist=dead?blend(add(ball,[s*.149,.117,-.105]),[s*.184,.089,-1.110],doesRelease?t:0):
      pass&&fullPass?blend([s*.149,.105,-.987],add(ball,[s*.153,.012,-.064]),t):
      add(ball,[s*.151,-.057,-.059]);
    arm(pose,side,wrist,[s*.45,.42,dead?.69:-.32],[s*.041,.15,dead?.99:.97],[s,0,0]);
  }
  return pose;
}

function standingStretch(phase) {
  const [lead,t]=repSide(phase), sign=laterality(lead);
  const pose=stand([-sign*.104,.858,.021],.042+.58*t);
  pose.ballCenter=[sign*.11,radius,.818];
  plantFoot(pose,opposite(lead),[-sign*.169,ground,.014]);
  freeFoot(pose,lead,[sign*.110,.627,.806],[sign*.09,.97,.27],[0,.067,.112]);
  for(const[side,s]of sides) arm(pose,side,add(pose[lead+'k'],[s*.095,.144,.068]),
    [s*.75,-.43,-.22],[0,-.23,.97],[0,1,0]);
  return pose;
}

function adductorSqueeze(phase,{hold}) {
  const t=rep(phase,hold?.22:.39,hold?.79:.58);
  const pose=stand([0,.145,-.022],-1.52);
  pose.ballCenter=[0,.519,.212];
  handsDown(pose,-.255,.072,.266);
  for(const[side,s]of sides) {
    const ankle=[s*.182,ground,.556];
    plantFoot(pose,side,ankle);
    pose[side+'k']=[s*mix(.244,.170,t),.462+.038*t,.236];
  }
  return pose;
}

function oneArmBallPush(phase,{stretch}) {
  const t=rep(phase);
  const pose=stand([-.028,stretch?mix(.489,.455,t):mix(.514,.375,t),-.41],mix(stretch?.871:1.31,stretch?1.29:1.52,t),0,.126*t);
  pose.ballCenter=[.355,radius,.257];
  if(stretch){
    for(const[side,s]of sides){pose[side+'k']=[s*.153,.100,-.39];pose[side+'a']=[s*.163,.073,-.795];pose[side+'t']=[s*.177,.043,-.924];}
  }else{
    const footZ=-.41-Math.sqrt(.834**2-(pose.hips[1]-.117)**2);
    for(const[side,s]of sides)leg(pose,side,[s*.202,.117,footZ],[s*.075,-.75,.15],[0,-.098,.092],0);
  }
  arm(pose,'l',[.354,.627,.286],[.759,-.46,-.18],[0,-.22,1],[0,1,0]);
  arm(pose,'r',[-.361,.078,.278],[-.75,-.14,-.55],[0,-.148,1],[0,1,0]);
  return pose;
}

function dipOnBall(phase) {
  const t=rep(phase);
  const pose=stand([0,mix(.494,.249,t),-.120],.115+.131*t);
  pose.ballCenter=[0,radius,.722];
  for(const[side,s]of sides){
    const az=.692;
    freeFoot(pose,side,[s*.101,.612,az],[s*.10,1,-.09],[s*.016,.057,.128]);
    arm(pose,side,[s*.157,.477,-.218],[s*.16,-.12,-1],[s*.04,-.101,1],[0,1,0]);
  }
  return pose;
}

function woodchop(phase) {
  const t=rep(phase),yaw=mix(-.30,.411,t);
  const p=[mix(-.426,.375,t),mix(1.561,.816,t),mix(.262,.318,t)];
  const pose=stand([0,.645,-.015],.039,yaw);
  pose.ballCenter=[0,radius,-.05];
  const axis=[0,.33,.944];
  for(const[side,s]of sides){
    plantFoot(pose,side,[s*.285,ground,.331]);
    grip(pose,side,add(p,[s*.123,0,0]),[s*.72,-.65,-.18],axis);
  }
  pose.dumbbells=[{center:p,axis}];
  return pose;
}

addGroup(anklesOnBall,['core','pec'],floorView,[
  ['0278',{kind:'push',muscles:['pec','triceps'],view:{yaw:62}}],
  ['0503',{kind:'pike',view:{yaw:62}}],
  ['0650',{kind:'tuck',view:{yaw:61}}],
]);
addGroup(heelsOnBall,['glute','hamstring'],floorView,[
  ['0269',{kind:'crunch',muscles:['core']}],['0569',{kind:'curl',rise:.305}],
  ['1065',{kind:'bridge',rise:.345}],['2200',{kind:'roll-bridge',rise:.309,view:{yaw:64}}],
  ['10139',{kind:'hold',pull:.321,rise:.20,duration:5800}],
  ['1883',{kind:'cross',pull:.22,muscles:['glute'],duration:5800}],
  ['9047',{kind:'single-curl',rise:.321,pull:.459,view:{yaw:65}}],
]);
addGroup(backOnBall,['core'],floorView,[
  ['1315',{kind:'relax',duration:5600,view:{yaw:57}}],['0021',{kind:'situp',depth:.94}],
  ['0131',{kind:'twist',view:{yaw:26}}],['1337',{kind:'stretch',duration:5900}],
  ['2469',{kind:'frog',depth:.806}],['3606',{kind:'kick',depth:.86}],
  ['0686',{kind:'russian',view:{yaw:33}}],['0700',{kind:'side',muscles:['core'],view:{yaw:28}}],
  ['3332',{kind:'weighted',equipment:'stability-ball-plate',depth:.99}],
]);
addGroup(proneOnBall,['glute','core'],floorView,[
  ['1340',{kind:'relax',duration:5450}],['1341',{kind:'pyramid',duration:5700,view:{yaw:70}}],
  ['0675',{kind:'reverse'}],['9009',{kind:'chest',view:{yaw:65}}],
  ['3178',{kind:'reverse',high:true,equipment:'stability-ball-bench-high',view:{focus:[0,.78,-.10],height:2.40}}],
  ['1332',{kind:'alternate',muscles:['shoulder','core'],view:{yaw:43}}],
]);
addGroup(seatedBall,['core'],seatView,[
  ['1560',{kind:'hamstring',muscles:['hamstring'],duration:6100}],['1561',{kind:'quad',muscles:['quad'],duration:6100}],
  ['2991',{kind:'shoulder',muscles:['shoulder','rearShoulder'],view:{yaw:55}}],
  ['0694',{kind:'twist',muscles:['core'],view:{yaw:24}}],['0728',{kind:'extension',muscles:['quad']}],
]);
addGroup(wallBall,['core'],wallView,[
  ['5311',{mode:'slide',equipment:'stability-ball-wall-front',muscles:['pec'],view:{yaw:81,focus:[0,1,.40]}}],
  ['0255',{mode:'circle',equipment:'stability-ball-wall-front',muscles:['r:shoulder'],view:{yaw:-81,focus:[0,1,.40]}}],
  ['1562',{mode:'squat',equipment:'stability-ball-wall',muscles:['quad','glute'],view:{yaw:63,focus:[0,.91,.03]}}],
  ['1695',{mode:'one',equipment:'stability-ball-wall',muscles:['r:quad','r:glute'],view:{yaw:64,focus:[0,.91,.06]}}],
]);
addGroup(anchoredRollout,['core'],floorView,[
  ['4314',{kind:'stretch',ranges:.316,muscles:['lat','core'],duration:5750}],
  ['3861',{kind:'saw',view:{yaw:72}}],
  ['1706',{kind:'plank',duration:5650,view:{yaw:67}}],
  ['2296',{kind:'roll',ranges:.504}],['7019',{kind:'roll',ranges:.386,view:{yaw:63}}],
  ['2937',{kind:'rounded',ranges:.571,view:{yaw:74}}],
]);
addGroup(ballTransfer,['core'],floorView,[
  ['4056',{mode:'dead',equipment:'stability-ball-handoff',view:{yaw:43}}],
  ['2815',{mode:'pass',equipment:'stability-ball-handoff',duration:5600,view:{yaw:66}}],
  ['0843',{mode:'knees',equipment:'stability-ball-handoff',view:{yaw:56}}],
]);
addGroup(adductorSqueeze,['adductor'],floorView,[
  ['9994',{hold:true,equipment:'stability-ball-adduction',view:{yaw:45},duration:5800}],
  ['10014',{hold:false,equipment:'stability-ball-adduction',view:{yaw:62}}],
]);
addGroup(oneArmBallPush,['pec'],floorView,[
  ['1272',{stretch:true,duration:5650,view:{yaw:38}}],['0657',{stretch:false,view:{yaw:43}}],
]);
addGroup(standingStretch,['hamstring'],seatView,[['1601',{duration:6050,view:{yaw:69}}]]);
addGroup(dipOnBall,['triceps'],floorView,[['5513',{equipment:'stability-ball-bench',view:{yaw:76}}]]);
addGroup(woodchop,['core','shoulder'],seatView,[['9025',{equipment:'stability-ball-plate',view:{yaw:37}}]]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,motion,options,muscles,equipment,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:options.duration??4730,camera:view,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,options)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:options.poster??.44});
  }catch(error){
    failures.push([id,error.message]);
  }
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
