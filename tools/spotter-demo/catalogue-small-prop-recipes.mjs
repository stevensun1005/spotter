import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { add, arm, blend, body, cycle, foot, fromSupport, lunge, ramp, scale, sides, squat }
  from "./catalogue-dumbbell-recipes.mjs";

const axis = [1, 0, 0];
const floor = .075;
const medRadius = .111;
const foamRadius = .080;

function palm(pose, side, point, pole, fingers = [0, 0, 1]) {
  arm(pose, side, point, pole);
  pose[side + "Fingers"] = fingers;
  pose[side + "PalmSide"] = axis;
}

function restFeet(pose, depth, height = floor, width = .145) {
  for (const [side, sign] of sides) {
    foot(pose, side, sign, [sign * width, height, depth], [sign * .16, .09, .97]);
  }
}

function pushUp(phase, { kind = "medicine", narrow = false, offset = false, staticBall = false } = {}) {
  const descent = cycle(phase, .38, .52);
  const dome = kind === "bosu";
  const propDepth = dome ? 0 : .119;
  const wristDepth = dome ? -.020 : .078;
  const supportHeight = dome ? .240 : offset ? .238 : .224;
  const anklesY = .137;
  const shoulderHeight = (offset ? .672 : .537 + supportHeight) - (offset ? .279 : .262) * descent;
  const angle = Math.acos((shoulderHeight - anklesY) / 1.34);
  const depth = wristDepth - 1.308;
  const pelvis = [offset ? .030 : 0, anklesY + .832 * Math.cos(angle), depth + .832 * Math.sin(angle)];
  const pose = body(pelvis, angle, 0, offset ? -.274 : 0);
  const ballTravel = offset && !staticBall ? ramp(phase,.50,.68) * (1-ramp(phase,.78,1)) * .091 : 0;
  if (!dome) {
    pose.ballCenter = [offset ? .219 : 0, medRadius, propDepth + ballTravel];
    pose.machineTravel = ballTravel / medRadius;
  }
  for (const [side, sign] of sides) {
    const x = dome ? sign * .221 : offset ? sign * .219 : sign * (narrow ? .059 : .078);
    const wristY = offset && side === "r" ? .078 : supportHeight;
    const wristZ = side === "r" && offset ? wristDepth - .012 : wristDepth + ballTravel;
    palm(pose, side, [x,wristY,wristZ], [sign * (narrow ? .23 : .86), .10, -.68], [sign * -.14,.042,.98]);
    foot(pose, side, sign, [sign * .145,anklesY,depth], [sign*.103,-.13,.84], [sign*.018,-.114,-.060]);
    delete pose.planted[side];
  }
  return pose;
}

function bosuSquat(phase, { straightArms = false } = {}) {
  const amount = cycle(phase);
  const pose = body([0,.317+.792-.338*amount,-.047-.201*amount],.023+.362*amount);
  restFeet(pose,-.041,.317,.162);
  for (const [side,sign] of sides) {
    pose.planted[side]=.240;
    const wrist = straightArms ? add(pose[side+"s"], [sign*-.021,-.036,.569])
      : add(pose.chest, [sign * (.081+.055*amount), -.167+.164*amount, .173+.256*amount]);
    palm(pose, side, wrist, [sign * .45,-.72,.33], [sign * -.56,.11,.82]);
  }
  return pose;
}

function throwBall(phase, { seated = false } = {}) {
  const drop = ramp(phase,0,.21)*(1-ramp(phase,.25,.44));
  const press = ramp(phase,.23,.45)*(1-ramp(phase,.77,1));
  const flightTime = Math.max(0,Math.min(1,(phase-.45)/.32));
  const flying = Math.max(0,4*flightTime*(1-flightTime));
  const pose = seated ? body([.1,.551,1.273],-Math.PI/2) : body([0,.889-.292*drop,-.062-.124*drop],.035+.275*drop);
  restFeet(pose,seated?1.557:.052,floor,seated?.23:.167);
  if (seated) for (const [side,sign] of sides) {
    foot(pose,side,sign,[.1+sign*.241,floor,1.564],[sign*.12,.65,.97]);
  }
  const height = seated ? .812+.374*press : pose.ls[1]-.21+.735*press;
  const held = [seated?.1:0,height,seated?.813:.281-.132*press];
  pose.ballCenter = add(held,[0,(seated?.64:.52)*flying,0]);
  pose.machineTravel = 1.08 * press + 3.56 * flying;
  for (const [side,sign] of sides) {
    const hand = add(held,[sign*.089,-.047+.044*press,.021]);
    palm(pose,side,hand,[sign*.58,-.36,.66],[sign*-.54,.49,.62]);
  }
  return pose;
}

function foamHip(phase) {
  const amount = cycle(phase);
  const pose = body([0,.194+.048*amount,-.237+.129*amount],-.397+.079*amount);
  pose.handRoller = {center:[0,foamRadius,.013+.127*amount],axis};
  pose.machineTravel = 1.58*amount;
  for (const [side,sign] of sides) {
    palm(pose,side,[sign*.324,.073,-.628],[sign*.58,.13,-.40],[sign*.13,.09,.95]);
    foot(pose,side,sign,[sign*.152,floor,.588-.236*amount],[sign*.13,.96,.29]);
  }
  return pose;
}

function foamReverseCrunch(phase) {
  const amount = cycle(phase);
  const pose = body([0,.156+.111*amount,.111-.047*amount],-Math.PI/2 + .164*amount);
  pose.handRoller = {center:[0,.215+.41*amount,.865-.370*amount],axis};
  pose.machineTravel = 3.3*amount;
  for (const [side,sign] of sides) {
    palm(pose,side,[sign*.171,.080,-.779],[sign*.38,.04,-.32]);
    foot(pose,side,sign,[sign*.223,.18+.396*amount,.800-.369*amount],[sign*.09,.94,.46],
      [-sign*.064,.031,.139]);
    delete pose.planted[side];
  }
  return pose;
}

function foamReach(phase, { standing = false } = {}) {
  const amount = cycle(phase, .33, .61);
  const pose = standing ? body([0,.889-.155*amount,-.13-.065*amount],.372+1.59*amount,.265*amount)
    : body([0,.147,.011],.147+.616*amount);
  pose.handRoller = { center: standing ? [.158*amount,.905-.824*amount,.287+.305*amount]
    : [0,.279-.081*amount,.381+.425*amount], axis };
  pose.machineTravel = 4.51*amount;
  if (standing) restFeet(pose,.10);
  for (const [side,sign] of sides) {
    if (!standing) foot(pose,side,sign,[sign*.132,.100,.842],[sign*.08,.90,.081],[sign*.028,-.074,.145]);
    const hand = add(pose.handRoller.center,[sign*.171,.035,-.035]);
    palm(pose,side,hand,[sign*.56,-.80,.12],[sign*.02,.18,.96]);
  }
  return pose;
}

function abWheel(phase, { kneeling = false, band = kneeling, short = false, fullReach = false } = {}) {
  const amount = cycle(phase,.43,.56);
  let pose;
  if (kneeling) {
    const kneeAngle = .08 + (short ? .02 : 1.235) * amount;
    const pelvis = short ? [0,.487,-.186] : [0,.108+.419*Math.cos(kneeAngle),-.226+.419*Math.sin(kneeAngle)];
    pose = body(pelvis,short ? 1.213 + .235 * amount : 1.335+.246*amount);
    for (const [side,sign] of sides) {
      pose[side+"k"]=[sign*.128,.108,-.226];
      pose[side+"a"]=[sign*.142,.093,-.647];
      pose[side+"t"]=[sign*.151,.042,-.786];
      delete pose.planted[side];
    }
  } else {
    pose = body([0,.895-.562*amount,-.522+.540*amount],2.827-.997*amount);
    for (const [side,sign] of sides) {
      foot(pose,side,sign,[sign*.141,.134,-.779],[sign*.14,.41,.44],[sign*.029,-.115,-.076]);
      delete pose.planted[side];
    }
  }
  const travel = short ? .234 : kneeling ? fullReach ? .874 : .827 : .969;
  pose.handRoller={center:[0,.096,(kneeling?.382:.086)+travel*amount],axis};
  pose.machineTravel=(fullReach ? travel/.094 : short ? 2.43 : 10.91)*amount;
  for (const [side,sign] of sides) {
    const grasp=add(pose.handRoller.center,[sign*.174,.006,0]);
    arm(pose,side,grasp,[sign*.68,-.96,0]);
    pose[side+"Grip"]=axis;
  }
  if (band) {
    const [x,y,z]=pose.hips;
    const anchor=[0,.473,-.804];
    pose.bandPath=[anchor,[x-.193,y+.051,z-.035],[x-.151,y+.051,z+.107],
      [x+.151,y+.051,z+.107],[x+.193,y+.051,z-.035],anchor];
  }
  return pose;
}

function holdMedicineBall(pose, center, yaw = 0) {
  pose.ballCenter = center;
  pose.machineTravel = 0;
  const side = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  for (const [key, sign] of sides) {
    const contact = add(center, add(scale(side, sign * .089), [0,-.038,0]));
    palm(pose, key, contact, [sign * .63, -.59, .20],
      add(scale(forward, .831), scale(side, -sign * .53)));
  }
}

function medicineCore(phase, { reach = false, deadBug = false, twist = false, pressCatch = false } = {}) {
  const amount = cycle(phase, .40, .57);
  const yaw = twist ? .672 * Math.sin(phase * 2 * Math.PI) : 0;
  const hips = twist ? [0,.151,-.21] : [0,.141,-.034];
  const fixed = body(hips, twist ? -.53 : -Math.PI / 2);
  const pose = body(hips, twist ? -.53 : -Math.PI / 2 + (deadBug || pressCatch ? 0 : .522 * amount), yaw);
  for (const [key, sign] of sides) {
    const portion = phase < .5 ? phase * 2 : (phase - .5) * 2;
    const working = ((phase < .5) === (key === "l"));
    const straight = deadBug && working ? cycle(portion) : 0;
    const point = deadBug ? [sign*.152,.554-.407*straight,.432+.345*straight]
      : [sign * .157, twist ? .239 : floor, twist ? .482 : .550];
    pose[key+"h"] = fixed[key+"h"];
    foot(pose,key,sign,point,[sign*.14,.94,.31]);
    if (deadBug || twist) delete pose.planted[key];
  }
  if (pressCatch) {
    const press = ramp(phase,.14,.36) * (1-ramp(phase,.66,.95));
    const elapsed = Math.max(0,Math.min(1,(phase-.36)/.30));
    holdMedicineBall(pose,add(pose.chest,[0,.205+.375*press,.051]));
    pose.ballCenter[1] += .359 * 4 * elapsed * (1-elapsed);
    pose.machineTravel = .63 * press + 3.20 * elapsed;
  } else if (deadBug) {
    holdMedicineBall(pose,add(pose.chest,[0,.525,.071]));
  } else {
    const depth = twist ? .309 : .205 + (reach ? .279 * amount : .041 * amount);
    holdMedicineBall(pose,add(pose.chest,[Math.sin(yaw)*depth,.139+(.072*amount),Math.cos(yaw)*depth]),yaw);
  }
  return pose;
}

function medicineLunge(phase, { overhead = false } = {}) {
  const pose = lunge(phase);
  pose.dumbbells = [];
  delete pose.lGrip;
  delete pose.rGrip;
  const t = phase < .5 ? phase * 2 : (phase - .5) * 2;
  const low = ramp(t,.13,.37) * (1-ramp(t,.59,.91));
  const reach = ramp(t,.45,.70) * (1-ramp(t,.79,1));
  const center = overhead ? add(pose.chest,[0,.131+.607*reach,.216-.158*reach])
    : add(pose.chest,[0,-.421+.554*low,.180+.030*low]);
  holdMedicineBall(pose,center);
  return pose;
}

function medicineJump(phase) {
  const pose = squat(phase,{form:"jump"});
  pose.dumbbells = [];
  delete pose.lGrip;
  delete pose.rGrip;
  holdMedicineBall(pose,add(pose.chest,[0,.088,.239]));
  return pose;
}

function medicineHinge(phase) {
  const amount = cycle(phase);
  const pose = body([.063,.880-.071*amount,.017-.187*amount],.031+1.224*amount);
  for (const [key, sign] of sides) {
    const angle = .211+1.39*amount;
    const point = key === "r" ? add(pose.rh,[-.071,-.826*Math.cos(angle),-.826*Math.sin(angle)]) : [.145,floor,.083];
    foot(pose,key,sign,point,[sign*.13,.024,.956],[sign*.017,-.071,key==="r"?-.139:.143]);
    if (key==="r") delete pose.planted.r;
  }
  holdMedicineBall(pose,add(pose.chest,add(scale(pose.up,.087),scale(pose.front,.239))));
  return pose;
}

function medicineHalo(phase) {
  const pose = fromSupport("floor");
  const angle = 2*Math.PI*phase;
  const center = add(pose.head,[.259*Math.sin(angle),-.084+.101*(1-Math.cos(angle)),.256*Math.cos(angle)]);
  holdMedicineBall(pose,center,angle);
  return pose;
}

function medicineSplitTwist(phase) {
  const yaw = .708*Math.sin(2*Math.PI*phase);
  const hips = [.028,.813,.047];
  const pose = body(hips,.035,yaw);
  const bottom = body(hips,.035);
  pose.lh = bottom.lh;
  pose.rh = bottom.rh;
  foot(pose,"l",1,[.147,floor,.354],[.12,.02,.972]);
  foot(pose,"r",-1,[-.148,.135,-.361],[-.12,.02,.972],[-.019,-.134,.101]);
  holdMedicineBall(pose,add(pose.chest,[Math.sin(yaw)*.269,.114,Math.cos(yaw)*.269]),yaw);
  return pose;
}

function medicineLegRaise(phase) {
  const pose = body([0,.141,-.049],-Math.PI/2);
  const angle = .115+1.356*cycle(phase);
  for (const [key,sign] of sides) {
    const target = [sign*.129,.141+.816*Math.sin(angle),-.049+.816*Math.cos(angle)];
    foot(pose,key,sign,target,[sign*.105,.21,.71],[sign*-.011,-.071*Math.cos(angle)-.133*Math.sin(angle),.133*Math.cos(angle)-.071*Math.sin(angle)]);
    delete pose.planted[key];
    palm(pose,key,[sign*.414,.059,-.271],[sign*.69,-.22,-.51],[sign*.49,0,.879]);
  }
  const ankleMid = scale(add(pose.la,pose.ra),.5);
  pose.ballCenter = add(ankleMid,[0,.060*Math.sin(angle)+.008,.065*Math.cos(angle)]);
  pose.machineTravel = 0;
  return pose;
}

function bosuSingle(phase, { balance = false, skater = false } = {}) {
  const amount = cycle(phase);
  const movement = amount * (balance ? .021 : .295);
  const pose = body([0,.273+.853-movement,.032-(skater?.187:.094)*amount],.025+(skater?.66:.24)*amount);
  foot(pose,"l",1,[.025,.348,.021],[.14,.091,.92],[.015,-.071,.135]);
  pose.planted.l = .273;
  const free = skater ? [-.191,.648-.228*amount,-.273-.390*amount] : [-.221,.604-.068*amount,.206+.201*amount];
  foot(pose,"r",-1,free,[-.166,.335,.841],[-.017,-.071,skater?-.117:.141]);
  delete pose.planted.r;
  for (const [key,sign] of sides) {
    const hand = add(pose[key+"s"],skater ? [sign*.107,-.091-.070*amount,.574] : [sign*.463,-.201,.287]);
    palm(pose,key,hand,[sign*.516,-.64,-.20],[sign*.13,-.03,.86]);
  }
  return pose;
}

function bounceAgainstWall(pose, held, phase, targetHeight, launchDepth=.506) {
  if(phase<.40||phase>.72) return;
  const t=(phase-.40)/.32;
  const distance=1-Math.abs(2*t-1);
  const path=blend([held[0],held[1],launchDepth],[0,targetHeight,1.256],distance);
  pose.ballCenter=add(path,[0,.115*Math.sin(2*Math.PI*t)**2,0]);
  pose.machineTravel=2.68*t;
}

function medicineWallPass(phase,{kneeling,side=false,step=false,squatting=false,tall=false,sit=false,chestStart=false}={}) {
  const reach=ramp(phase,.24,.40)*(1-ramp(phase,.72,.93));
  const preLoad=ramp(phase,.02,.19)*(1-ramp(phase,.20,.43));
  const bodyRise=ramp(phase,.07,.37)*(1-ramp(phase,.73,1));
  const yaw=side?-.98*(1-reach)-.42*preLoad:0;
  const pose=kneeling?fromSupport(kneeling==='half'?'halfKneel':'tallKneel'):
    sit?body([0,.141,-.212],-Math.PI/2+1.55*bodyRise):
      body([side?-.078*preLoad:0,.882-(squatting?.355:side?.073:.019)*preLoad,.038-(side?.104:.153)*preLoad],
        .022+(squatting?.287:.139)*preLoad,yaw);
  if (!kneeling) {
    for(const [key,sign] of sides){
      const back=side&&key==='r'?.384:0;
      const reverseStep=step&&key==='r'?.209*preLoad:0;
      foot(pose,key,sign,[sign*(side?.238:.174),floor+(back?.062*reach:0),sit?.387:.112-back-reverseStep],
        [sign*.37,.087,.90],[sign*.032,-.071-(back?.062*reach:0),.142]);
    }
  }
  const start=side?(chestStart?add(pose.chest,[-.183,.039,.077]):add(pose.hips,[-.237,.232,.166])):
    add(pose.chest,[0,sit?.163:.124,.191]);
  const finish=add(pose.chest,[0,tall?.497:.130,tall?.520:.545]);
  const held=blend(start,finish,reach);
  holdMedicineBall(pose,held,yaw*(1-reach));
  bounceAgainstWall(pose,held,phase,tall?2.52:1.30,held[2]);
  return pose;
}

function medicineFreeThrow(phase,{back=false,down=false,kneeling=false,run=false}={}) {
  const launch=.43;
  const force=ramp(phase,.15,launch);
  const bend=(1-force)*(back?.855:kneeling?.049:down?-.126:.034);
  const stride=run?ramp(phase,.035,.43):0;
  const lean=run?.17*stride:kneeling?.729*ramp(phase,.41,.60):back?.763*(1-force):-.14*(1-force);
  const pose=body([0,kneeling?.506-.092*ramp(phase,.56,.73):.884-.344*bend,
    run?-.601+1.058*stride:.016-.173*bend],lean);
  const overhead=back?[[0,.406,-.125],[0,1.953,-.158]]:
    [[0,kneeling?.976:run?.854:1.791,kneeling?.233:run?-.410:-.183],
      [0,kneeling?1.012:run?1.275:1.593,run?.940:.665]];
  const ball=blend(overhead[0],overhead[1],force);
  if(back) {
    ball[1]+=.385*Math.sin(Math.PI*force);
    ball[2]+=.679*Math.sin(Math.PI*force);
  }
  if(!back&&!kneeling&&!run) ball[1]+=.461*Math.sin(Math.PI*force);
  if(run){
    const carry=add(pose.chest,[0,-.382+.330*force,.236+.158*force]);
    const connection=ramp(phase,.33,launch);
    const tracked=blend(carry,overhead[1],connection);
    ball.splice(0,3,...tracked);
  }
  if(kneeling) {
    for(const [key,sign] of sides){
      pose[key+'k']=[sign*.137,.085,.017];
      pose[key+'a']=[sign*.141,.095,-.400];
      pose[key+'t']=[sign*.154,.025,-.533];
      delete pose.planted[key];
    }
  } else {
    for(const [key,sign] of sides){
      const swing=run?ramp(phase,key==='l'?.022:.18,key==='l'?.226:.42):0;
      const step=run?-.530+(key==='l'?.617:1.266)*swing:.075;
      foot(pose,key,sign,[sign*(run?.162:.172),floor+.139*Math.sin(Math.PI*swing),step],
        [sign*.29,.041,.939]);
      if (swing>.01&&swing<.99) delete pose.planted[key];
    }
  }
  holdMedicineBall(pose,ball);
  if(phase>launch){
    const t=Math.min(1,(phase-launch)/.30);
    pose.ballCenter=add(overhead[1],[0,(back?.86:down?-.27:.31)*t-(back?2.71:down?1.25:1.77)*t*t,
      (back?-1.511:kneeling?1.36:1.84)*t]);
    pose.ballCenter[1]=Math.max(medRadius,pose.ballCenter[1]);
    pose.machineTravel=4.1*t;
    for(const [key,sign] of sides){
      const settle=ramp(phase,launch,.78);
      const end=kneeling?[sign*.206,.052,.501]:add(pose[key+'s'],[sign*.105,-.564,.154]);
      const contact=add(overhead[1],[sign*.087,-.043,0]);
      palm(pose,key,blend(contact,end,settle),[sign*.84,-.47,.16]);
    }
  }
  return pose;
}

function medicineChop(phase,{oneLeg=false}={}) {
  const amount=cycle(phase,.39,.57);
  const pose=body([oneLeg?.084:0,.878-(oneLeg?.143:.335)*amount,.015-.148*amount],.031+.253*amount,
    -.45+.954*amount);
  for(const [key,sign] of sides){
    const floating=oneLeg&&key==='r';
    foot(pose,key,sign,[sign*.154,floating?.211+.081*amount:floor,floating?-.267+.071*amount:.082],
      [sign*.25,.042,.97],[sign*.028,-.071,.144]);
    if(floating)delete pose.planted[key];
  }
  const high=add(pose.ls,[.163,.547,.197]);
  const low=add(pose.rk,[-.157,.107,.211]);
  const contact=blend(high,low,amount);
  holdMedicineBall(pose,contact,.81-1.64*amount);
  return pose;
}

function medicineJackPlank(phase,{tap=false}={}) {
  if(tap){
    const amount=cycle((phase*2)%1,.40,.56);
    const lead=phase<.5?'l':'r';
    const pose=body([0,.458,-.386],1.146);
    for(const [key,sign] of sides){
      foot(pose,key,sign,[sign*.161,.128,-1.144],[sign*.12,-.038,.91],[sign*.019,-.119,-.059]);
      delete pose.planted[key];
      const floorHand=[sign*.188,.052,.150];
      const tapHand=[sign*.032,.193,.567];
      palm(pose,key,key===lead?blend(floorHand,tapHand,amount):floorHand,[sign*.69,-.61,-.38]);
    }
    pose.ballCenter=[0,medRadius,.630];
    pose.machineTravel=.041*(1-Math.cos(4*Math.PI*phase));
    return pose;
  }
  const pose=pushUp(0);
  const wide=ramp(phase,.16,.36)*(1-ramp(phase,.62,.84));
  const airborne=.081*(Math.sin(Math.PI*ramp(phase,.14,.38))+Math.sin(Math.PI*ramp(phase,.60,.86)));
  for(const [key,sign] of sides){
    foot(pose,key,sign,[sign*(.115+.249*wide),.137+airborne,-1.229],
      [sign*.13,-.09,.82],[sign*.018,-.114,-.060]);
    delete pose.planted[key];
  }
  return pose;
}

function foamWallSlide(phase,{forearm=false}={}) {
  const amount=cycle(phase);
  const pose=body([0,.883-(forearm?.045:0)*amount,.747+(forearm?.068:.173)*amount],.128+.101*amount);
  restFeet(pose,.617);
  const height=1.236+(forearm?.190:.532)*amount;
  pose.handRoller={center:[0,height,1.267],axis};
  pose.machineTravel=(forearm?2.56:8.18)*amount;
  for(const [key,sign] of sides){
    const h=height+(forearm?.104:.140);
    palm(pose,key,[sign*(.152-.040*amount),h,1.140],[sign*.26,-.788,-.41],[0,.938,.345]);
  }
  return pose;
}

function foamUpperBack(phase,{kind='thoracic'}={}) {
  const amount=cycle(phase,.41,.57);
  const extend=kind==='extend';
  const sweep=kind==='sweep'||kind==='opener';
  const long=kind==='opener';
  const cross=kind==='cross'||kind==='rhomboid';
  const pitch=long?-Math.PI/2:extend?-1.082-.518*amount:sweep?-1.40:-1.333-.191*amount;
  const hips=[0,long?.216:extend?.147:.205+.033*amount,.051+(extend?.026:.148)*amount];
  const pose=body(hips,pitch);
  restFeet(pose,.520,.075,.174);
  const back=long?-.304:pose.chest[2]+(kind==='rhomboid'?-.183:.011)-.078*amount;
  pose.handRoller={center:[0,foamRadius,back],axis:long?[0,0,1]:axis};
  pose.machineTravel=long?0:1.67*amount;
  for(const [key,sign] of sides){
    if (sweep) {
      const angle=kind==='opener'?.66+.71*amount:.199+2.56*amount;
      const position=[sign*.582*Math.sin(angle),.035+.106*Math.sin(angle),.561*Math.cos(angle)];
      palm(pose,key,add(pose[key+'s'],position),[sign*.65,-.26,-.74]);
    } else if(cross) {
      palm(pose,key,add(pose.chest,[-sign*.091,.136,-.044]),[sign*.81,-.17,.43]);
    } else {
      palm(pose,key,add(pose.head,[sign*.110,.059,.012]),[sign*.89,-.17,.33]);
    }
  }
  return pose;
}

function foamSeatRoll(phase,{kind='glutes'}={}) {
  const t=cycle(phase,.42,.56);
  const ham=kind==='hamstrings';
  const figure=kind==='figure';
  const twist=kind==='twist';
  const z=.096-(twist?.055:.238)*t;
  const pose=body([figure?.045:0,ham?.212:.242,z],twist?-1.54:-.316,0,figure?-.272:0);
  const place=ham?z+.343-.243*t:twist?.114:.056-.151*t;
  pose.handRoller={center:[figure?.071:0,foamRadius,place],axis};
  pose.machineTravel=(ham?4.25:2.23)*t;
  for(const [key,sign] of sides){
    const footPoint=ham?[sign*.135,.141,.832+.053*t]:figure&&key==='l'?
      [-.120,.321,.482]:[sign*.167,floor,.589+.093*t];
    foot(pose,key,sign,footPoint,[sign*(figure?.76:.15),.951,.22],[sign*.017,-.071,.138]);
    if(ham){
      pose[key+'k']=add(pose[key+'h'],[sign*.047,.026,.415]);
      pose[key+'a']=add(pose[key+'k'],[sign*.017,-.050,.415]);
      pose[key+'t']=add(pose[key+'a'],[sign*.017,.092,.102]);
    }
    if(twist){
      pose[key+'k'][0]+=.239*t;
      pose[key+'k'][1]-=.082*t;
    }
    if(ham||figure&&key==='l') delete pose.planted[key];
    palm(pose,key,twist?[sign*.631,.063,z-.403]:[sign*.261,.050,z-.496],[sign*.73,-.19,-.41]);
  }
  if(figure) {
    const ankle=add(pose.rk,[.018,.081,.029]);
    foot(pose,'l',1,ankle,[.87,.41,.24],[-.060,-.040,.126]);
  }
  return pose;
}

function foamTibialRoll(phase,{single=false}={}) {
  const amount=cycle(phase);
  const move=.193*amount;
  const pose=body([0,.558-.074*amount,-.216+move],1.585-.045*amount);
  pose.handRoller={center:[single?.113:0,foamRadius,-.557+.047*amount],axis};
  pose.machineTravel=2.39*amount;
  for (const [key,sign] of sides){
    const support=single&&key==='r';
    pose[key+'k']=[sign*.126,support?.097:.144,-.182+move];
    pose[key+'a']=[sign*.136,support?.083:.207,-.600+move];
    pose[key+'t']=add(pose[key+'a'],[sign*.013,-.055,-.139]);
    palm(pose,key,[sign*.211,.050,.315+move*.37],[sign*.41,-.64,-.65]);
    delete pose.planted[key];
  }
  return pose;
}

function foamBodySaw(phase) {
  const amount=cycle(phase);
  const pose=body([0,.364-.036*amount,-.356-.094*amount],1.614+.076*amount);
  pose.handRoller={center:[0,foamRadius,-.965-.169*amount],axis};
  pose.machineTravel=2.11*amount;
  for(const [key,sign] of sides){
    foot(pose,key,sign,[sign*.126,.194,-1.105-.135*amount],[sign*.08,-.78,.31],[sign*.013,-.073,-.138]);
    delete pose.planted[key];
    pose[key+'e']=[sign*.201,.087,.091];
    pose[key+'w']=[sign*.199,.061,.428];
    pose[key+'Fingers']=[0,0,1];
  }
  return pose;
}

function foamFootRoll(phase) {
  const amount=cycle(phase);
  const pose=body([-.079,.890,.041],.027);
  pose.handRoller={center:[.164,foamRadius,.143+.174*amount],axis};
  pose.machineTravel=2.14*amount;
  for(const [key,sign] of sides){
    const working=key==='l';
    foot(pose,key,sign,[sign*.166,working?.220:floor,working?.090+.062*amount:.098],
      [sign*.15,.097,.97],[sign*.018,-.071,.142]);
    if(working)delete pose.planted[key];
    palm(pose,key,add(pose[key+'s'],[sign*.079,-.554,.077]),[sign*.61,-.45,-.59]);
  }
  return pose;
}

function massageWall(phase,{placement,front=false,hip=false}={}) {
  const amount=cycle(phase,.38,.73);
  const move=hip?.038:.066;
  const pose=body([.032*amount,.882-move*amount,front?.359:-.281],front?.233:-.034,hip?.366:0);
  restFeet(pose,front?.241:-.020,floor,.169);
  const height=placement[1]-move*amount;
  pose.ballCenter=[placement[0]+.020*amount,height,front?.611:-.420];
  pose.machineTravel=1.36*amount;
  for (const [key,sign] of sides){
    const relaxed=add(pose[key+'s'],[sign*.067,-.563,.124]);
    const across=add(pose.chest,[-sign*.126,.062,.182]);
    const brace=[sign*.234,1.14,.652];
    palm(pose,key,front?brace:hip?relaxed:across,[sign*.70,-.54,.31]);
  }
  return pose;
}

function massageTable(phase,{portion=.47,palmUp=false}={}) {
  const amount=cycle(phase,.38,.73);
  const pose=body([0,.824,.274+.062*amount],.449);
  restFeet(pose,.119);
  const elbow=[.205,1.020,.455+.077*amount];
  const hand=[.226,1.032,.817+.066*amount];
  pose.le=elbow;
  pose.lw=hand;
  pose.lFingers=[0,.04,1];
  pose.lPalmSide=palmUp?[-1,0,0]:[1,0,0];
  palm(pose,'r',[-.166,.967,.402],[-.63,-.61,-.34]);
  const landmark=blend(elbow,hand,portion);
  pose.ballCenter=[landmark[0],.963,landmark[2]-.033*amount];
  pose.machineTravel=1.29*amount;
  return pose;
}

function massageCalf(phase,{surface='back'}={}) {
  const amount=cycle(phase,.41,.73);
  const side=surface==='out'?1:surface==='in'?-1:0;
  const tilt=side*.38;
  const pose=body([side*.029,.181,-.265+.070*amount],-.326,0,tilt);
  const x=.137+side*.033;
  pose.lk=[x,.159,.151+.067*amount];
  pose.la=[x,.115,.568+.067*amount];
  pose.lt=[x+side*.037,.233,.602+.067*amount];
  foot(pose,'r',-1,[-.180,floor,.336],[.09,.96,.28]);
  delete pose.planted.l;
  for(const [key,sign] of sides) palm(pose,key,[sign*.216,.048,-.719+.059*amount],[sign*.79,-.27,-.20]);
  pose.ballCenter=[x+side*.041,.047,.361+.090*amount];
  pose.machineTravel=2.48*amount;
  return pose;
}

function massageSole(phase) {
  const amount=cycle(phase,.40,.67);
  const pose=body([-.061,.882,.024],.028);
  foot(pose,'l',1,[.162,.157,.082+.036*amount],[.10,.098,.97],[.014,-.066,.145]);
  foot(pose,'r',-1,[-.181,floor,.087],[-.13,.046,.96]);
  delete pose.planted.l;
  for(const [key,sign] of sides) palm(pose,key,add(pose[key+'s'],[sign*.082,-.564,.053]),[sign*.64,-.41,-.55]);
  pose.ballCenter=[.170,.047,.098+.134*amount];
  pose.machineTravel=2.91*amount;
  return pose;
}

function massageFloorBack(phase,{placement,diagonal=false}={}) {
  const amount=cycle(phase,.37,.73);
  const h=.150+.024*amount;
  const pose=body([.023*amount,h,-.023+.031*amount],-Math.PI/2,0,diagonal?.132*amount:.084*amount);
  restFeet(pose,.555,floor,.174);
  for(const [key,sign] of sides){
    const target=placement[1]<-.21?add(pose.chest,[-sign*.065,.157,.112]):[sign*.296,.056,-.208];
    palm(pose,key,target,[sign*.82,-.04,.31]);
  }
  pose.ballCenter=[placement[0]+.024*amount,.047,placement[1]+(diagonal?.038:.061)*amount];
  pose.machineTravel=1.91*amount;
  return pose;
}

function massagePiriformis(phase,{supine=false}={}) {
  const amount=cycle(phase,.36,.72);
  const pose=body([.07+.048*amount,.173,.026+.063*amount],supine?-Math.PI/2:-.388,0,.223*amount);
  const left=supine?[.260,.081,.480]:[-.082,.330,.420];
  foot(pose,'l',1,left,[.889,.351,.301],[.018,-.068,.122]);
  foot(pose,'r',-1,[-.118,floor,.492],[-.12,.91,.41]);
  delete pose.planted.l;
  for (const [key,sign] of sides){
    const support=supine?[sign*.452,.048,-.297]:[sign*.259,.054,-.471];
    palm(pose,key,support,[sign*.74,-.18,-.21]);
    if(supine){
      const roll=.56*amount;
      const [hx,hy]=pose[key+'h'];
      for(const part of ['k','a','t']){
        const joint=pose[key+part];
        const x=joint[0]-hx;
        const y=joint[1]-hy;
        joint[0]=hx+x*Math.cos(roll)+y*Math.sin(roll);
        joint[1]=hy-x*Math.sin(roll)+y*Math.cos(roll);
      }
      delete pose.planted[key];
    }
  }
  pose.ballCenter=[.186+.050*amount,.047,-.005+.048*amount];
  pose.machineTravel=1.42*amount;
  return pose;
}

function foamSideRoll(phase,{area,legSupport=false,movingArm=false}={}) {
  const amount=cycle(phase,.40,.67);
  const belowLeg=area==='calf'||area==='thigh'||area==='hip';
  const upper=area==='shoulder'||area==='lat'||area==='triceps'||area==='blade';
  const pelvis=[-.014,belowLeg?.229:upper?.318:.253,.055+.121*amount];
  const pose=body(pelvis,-1.416,0,-1.377);
  for(const [key,sign] of sides){
    const extra=key==='r'&&legSupport;
    const supportHeight=extra?floor:belowLeg?.203:.121;
    const point=[extra?-.311:sign*.089,supportHeight,extra?.534:area==='thigh'?.806:.779];
    foot(pose,key,sign,point,[sign*.067,.28,.90],[sign*.024,-.068,.138]);
    if(!extra)delete pose.planted[key];
    const brace=[sign*.214,.056,-.233+.049*amount];
    const long=add(pose[key+'s'],[sign*.113,.060,-.525]);
    const upperSweep=add(pose[key+'s'],[sign*(.177-.098*amount),.212+.149*amount,-.439+.727*amount]);
    const aim=key==='l'&&(area==='lat'||area==='triceps')?long:key==='r'&&movingArm?upperSweep:brace;
    palm(pose,key,aim,[sign*.70,-.24,-.35]);
  }
  let position=area==='calf'?[.082,.487+.219*amount]:area==='thigh'?[.080,.271+.134*amount]:
    area==='hip'?[.082,.143+.088*amount]:area==='triceps'?[.170,-.522+.129*amount]:
      area==='lat'?[.111,-.286+.106*amount]:area==='shoulder'?[.112,-.363+.109*amount]:[.087,-.088+.079*amount];
  if(area==='triceps'){
    pose.le=add(pose.ls,[.062,-.009,-.243]);
    pose.lw=add(pose.le,[.066,.031,-.301]);
    const contact=blend(pose.ls,pose.le,.28+.46*amount);
    position=[contact[0],contact[2]];
  }
  if(area==='blade')position=[pose.ls[0]+.026,pose.ls[2]+.055+.072*amount];
  pose.handRoller={center:[position[0],foamRadius,position[1]],axis};
  pose.machineTravel=1.86*amount;
  return pose;
}

function foamProneRoll(phase,{area}={}) {
  const amount=cycle(phase,.39,.72);
  const armTarget=area==='biceps';
  const shoulderTarget=area==='shoulder';
  const iliopsoas=area==='hip';
  const pose=body([-.026+.072*amount,iliopsoas?.220:.218,-.347+.109*amount],iliopsoas?1.257:1.529,.051*amount,.091*amount);
  for(const [key,sign] of sides){
    foot(pose,key,sign,[sign*.124,.116,-1.146+.084*amount],[sign*.09,-.70,.22],[sign*.023,-.041,-.128]);
    delete pose.planted[key];
    if(key==='l'&&!iliopsoas){
      const arm=add(pose.ls,[armTarget?.523:.448,.074,.092+.151*amount]);
      palm(pose,key,arm,[.88,-.31,.11]);
      if(armTarget){
        pose.le=add(pose.ls,[.243,-.033,.048]);
        pose.lw=add(pose.le,[.297,-.021,.126]);
      }
    } else {
      pose[key+'e']=[sign*.226,.104,.162+.105*amount];
      pose[key+'w']=[sign*.198,.070,.481+.110*amount];
      pose[key+'Fingers']=[0,-.030,.994];
    }
  }
  const biceps=blend(pose.ls,pose.le,.32+.43*amount);
  pose.handRoller={center:armTarget?[biceps[0],foamRadius,biceps[2]]:
    [shoulderTarget?.201:.097,foamRadius,iliopsoas?-.288+.129*amount:shoulderTarget?.150+.074*amount:.102+.108*amount],axis:armTarget?[0,0,1]:axis};
  pose.machineTravel=1.88*amount;
  return pose;
}

const clips = [
  ["1353", "spotter-med-ball", throwBall, {}, ["quad","glute","shoulder"], [45, 10, [0,1.29,.16], 2.86], 4200, .58],
  ["1303", "spotter-med-ball-mat", pushUp, {offset:true}, ["pec","core","triceps"], [-56, 20, [0,.51,-.43], 1.49]],
  ["1701", "spotter-med-ball-mat", pushUp, {narrow:true}, ["pec","triceps"], [58, 19, [0,.52,-.42], 1.58]],
  ["1750", "spotter-med-ball-bench", throwBall, {seated:true}, ["pec","triceps"], [64, 14, [.1,.95,1.10], 2.25], 3900, .58],
  ["0663", "spotter-med-ball-mat", pushUp, {}, ["pec","triceps","core"], [48, 18, [0,.53,-.47], 1.63]],
  ["1307", "spotter-bosu", pushUp, {kind:"bosu"}, ["pec","triceps","core"], [57, 17, [0,.55,-.47], 1.66]],
  ["0653", "spotter-bosu", pushUp, {kind:"bosu"}, ["pec","triceps","core"], [44, 19, [0,.57,-.46], 1.64]],
  ["1705", "spotter-bosu", bosuSquat, {}, ["quad","glute","core"], [54, 13, [0,1.02,0], 2.21]],
  ["2202", "spotter-foam-roller", foamHip, {}, ["glute"], [58, 24, [0,.45,.02], 1.40]],
  ["2206", "spotter-foam-roller", foamReverseCrunch, {}, ["core"], [58, 23, [0,.40,.15], 1.42]],
  ["2203", "spotter-foam-roller", foamReach, {}, ["l:shoulder","r:shoulder","trap"], [56, 22, [0,.61,.38], 1.49]],
  ["2207", "spotter-foam-roller", foamReach, {standing:true}, ["lat"], [57, 17, [0,.73,.26], 1.79]],
  ["0796", "spotter-ab-wheel", abWheel, {}, ["core","shoulder"], [61, 18, [0,.52,.13], 1.63]],
  ["0971", "spotter-ab-wheel-stretch-band", abWheel, {kneeling:true}, ["core","shoulder"], [64, 18, [0,.52,.13], 1.65]],
  ["0857", "spotter-ab-wheel", abWheel, {kneeling:true,band:false,fullReach:true}, ["core","shoulder"], [64,18,[0,.52,.13],1.65]],
  ["4093", "spotter-ab-wheel-wall", abWheel, {kneeling:true,band:false,fullReach:true}, ["core","shoulder"], [72,18,[0,.69,.38],2.0]],
  ["2269", "spotter-ab-wheel", abWheel, {kneeling:true,band:false,short:true}, ["core"], [62,20,[0,.42,.05],1.34]],
  ["4121", "spotter-med-ball-mat", pushUp, {offset:true,staticBall:true}, ["pec","triceps","core"], [-56,20,[0,.51,-.43],1.49]],
  ["3422", "spotter-med-ball-mat", medicineCore, {}, ["core"], [63,21,[0,.42,-.03],1.56]],
  ["4253", "spotter-med-ball-mat", medicineCore, {reach:true}, ["core"], [63,21,[0,.42,-.03],1.60]],
  ["4124", "spotter-med-ball-mat", medicineCore, {deadBug:true}, ["core"], [63,22,[0,.48,.03],1.69], 5200, .22],
  ["1247", "spotter-med-ball-mat", medicineCore, {twist:true}, ["core"], [55,21,[0,.51,.05],1.61], 4700, .24],
  ["10598", "spotter-med-ball-mat", medicineCore, {pressCatch:true}, ["pec","triceps"], [63,18,[0,.59,-.03],1.90], 4100],
  ["1692", "spotter-med-ball", medicineLunge, {overhead:true}, ["quad","glute","shoulder"], [61,14,[0,1.04,.22],2.37], 5800, .36],
  ["5238", "spotter-med-ball", medicineLunge, {}, ["quad","glute","biceps"], [61,14,[0,.89,.22],2.21], 5600, .22],
  ["3877", "spotter-med-ball", medicineJump, {}, ["quad","glute","calf"], [52,14,[0,1.07,.09],2.32], 3500, .54],
  ["1693", "spotter-med-ball", medicineHinge, {}, ["l:glute","l:hamstring"], [61,15,[0,.84,-.16],2.11]],
  ["4375", "spotter-med-ball", medicineHalo, {}, ["shoulder","core"], [59,13,[0,1.04,.03],2.30], 4500],
  ["10552", "spotter-med-ball", medicineSplitTwist, {}, ["core"], [56,14,[0,.91,.03],2.11], 4600, .23],
  ["5031", "spotter-med-ball-mat", medicineLegRaise, {}, ["core"], [63,22,[0,.51,.11],1.74]],
  ["10868", "spotter-bosu", bosuSquat, {straightArms:true}, ["quad","glute","core"], [54,13,[0,1.02,0],2.21]],
  ["10869", "spotter-bosu", bosuSingle, {}, ["l:quad","l:glute","core"], [56,13,[0,1.02,0],2.21]],
  ["8479", "spotter-bosu", bosuSingle, {skater:true}, ["l:quad","l:glute","core"], [56,13,[0,1.02,0],2.26]],
  ["3715", "spotter-bosu", bosuSingle, {balance:true}, ["l:quad","l:glute","core"], [56,13,[0,1.02,0],2.22]],
  ["5144","rig-pass-ball",medicineWallPass,{},["pec","triceps","core"],[-65,13,[0,.99,.62],2.30],3900,.46],
  ["1304","spotter-med-ball-wall-mat",medicineWallPass,{kneeling:"tall"},["pec","triceps","core"],[-65,16,[0,.80,.61],2.17],3800,.45],
  ["4099","spotter-med-ball-wall-mat",medicineWallPass,{kneeling:"half"},["pec","triceps","core"],[-65,16,[0,.80,.61],2.17],4050,.45],
  ["10197","rig-pass-ball",medicineWallPass,{side:true,chestStart:true},["core","shoulder","glute"],[-59,14,[0,.96,.61],2.35],3750,.46],
  ["1699","rig-pass-ball",medicineWallPass,{side:true},["core","shoulder","glute"],[-64,14,[0,.96,.61],2.35],4350,.46],
  ["4383","rig-pass-ball",medicineWallPass,{side:true,step:true},["core","glute","shoulder"],[-63,14,[0,.94,.55],2.35],4400,.46],
  ["5161","rig-pass-ball",medicineWallPass,{squatting:true},["quad","glute","shoulder"],[-65,13,[0,.99,.62],2.30],4400,.46],
  ["2458","spotter-med-ball-wall-tall",medicineWallPass,{squatting:true,tall:true},["quad","glute","shoulder"],[-69,12,[0,1.49,.62],3.24],4550,.55],
  ["0625","spotter-med-ball-wall-mat",medicineWallPass,{sit:true},["core","pec","triceps"],[-67,20,[0,.794,.40],2.20],4550,.54],
  ["10109","spotter-med-ball",medicineFreeThrow,{back:true},["quad","glute","shoulder"],[67,13,[0,1.07,-.49],2.72],4550,.44],
  ["3439","spotter-med-ball",medicineFreeThrow,{back:true},["quad","glute","shoulder"],[70,13,[0,1.07,-.49],2.72],4250,.44],
  ["4243","spotter-med-ball",medicineFreeThrow,{},["core","shoulder","triceps"],[72,15,[0,1.05,.51],2.76],4550,.44],
  ["10108","spotter-med-ball",medicineFreeThrow,{},["core","shoulder","triceps"],[69,15,[0,1.05,.51],2.76],4400,.44],
  ["3442","spotter-med-ball",medicineFreeThrow,{down:true},["core","shoulder","triceps"],[69,15,[0,1.05,.51],2.76],4300,.44],
  ["1305","spotter-med-ball-mat",medicineFreeThrow,{kneeling:true},["core","pec","triceps"],[67,19,[0,.69,.55],2.16],4500,.57],
  ["1312","spotter-med-ball",medicineFreeThrow,{run:true},["quad","core","pec"],[69,14,[0,1.04,.81],3.05],4250,.46],
  ["1697","spotter-med-ball",medicineChop,{},["core","shoulder","quad"],[54,17,[0,1.06,.06],2.42],4500,.46],
  ["1704","spotter-med-ball",medicineChop,{oneLeg:true},["l:glute","core","shoulder"],[57,16,[0,1.08,.10],2.42],4450,.46],
  ["2564","spotter-med-ball-mat",medicineJackPlank,{},["core","shoulder","glute"],[63,22,[0,.53,-.40],1.94],3200,.49],
  ["10554","spotter-med-ball-mat",medicineJackPlank,{tap:true},["core","shoulder"],[67,24,[0,.44,-.17],1.88],4900,.24],
  ["5027","spotter-foam-wall",foamWallSlide,{},["shoulder","lat"],[108,16,[0,1.24,.91],2.65],4300,.48],
  ["5373","spotter-foam-wall",foamWallSlide,{forearm:true},["forearm"],[108,17,[0,1.12,.92],2.57],4700,.48],
  ["11572","spotter-foam-roller",foamUpperBack,{kind:"extend"},["trap"],[67,23,[0,.44,-.11],1.68],5300,.47],
  ["5386","spotter-foam-roller",foamUpperBack,{kind:"sweep"},["shoulder","trap"],[60,28,[0,.45,-.09],1.86],5300,.47],
  ["5376","spotter-foam-long",foamUpperBack,{kind:"opener"},["pec","shoulder"],[65,29,[0,.46,-.12],1.91],5100,.47],
  ["5382","spotter-foam-roller",foamUpperBack,{},["trap"],[67,24,[0,.43,.02],1.70],5250,.47],
  ["5384","spotter-foam-roller",foamUpperBack,{kind:"cross"},["trap"],[67,24,[0,.43,.02],1.70],5050,.47],
  ["3566","spotter-foam-roller",foamUpperBack,{kind:"cross"},["trap"],[67,24,[0,.43,.02],1.70],5350,.47],
  ["5381","spotter-foam-roller",foamUpperBack,{kind:"rhomboid"},["trap"],[68,26,[0,.44,-.08],1.72],5100,.47],
  ["5390","spotter-foam-roller",foamSeatRoll,{},["glute"],[60,24,[0,.51,.08],1.74],4700,.47],
  ["5389","spotter-foam-roller",foamSeatRoll,{kind:"figure"},["glute"],[64,24,[0,.52,.09],1.76],5150,.47],
  ["5391","spotter-foam-roller",foamSeatRoll,{kind:"twist"},["glute"],[64,24,[0,.47,.02],1.73],5100,.47],
  ["5392","spotter-foam-roller",foamSeatRoll,{kind:"hamstrings"},["hamstring","glute"],[61,23,[0,.50,.15],1.85],4900,.47],
  ["2947","spotter-foam-roller",foamTibialRoll,{single:true},["l:calf"],[67,23,[0,.41,-.14],1.65],4850,.47],
  ["5394","spotter-foam-roller",foamTibialRoll,{},["calf"],[67,23,[0,.41,-.14],1.65],4800,.47],
  ["5395","spotter-foam-roller",foamTibialRoll,{single:true},["l:calf"],[67,23,[0,.41,-.14],1.65],4900,.47],
  ["2994","spotter-foam-roller",foamTibialRoll,{},["calf"],[67,23,[0,.41,-.14],1.65],5000,.47],
  ["2204","spotter-foam-roller",foamBodySaw,{},["core","shoulder"],[69,22,[0,.36,-.31],1.92],4500,.47],
  ["5398","spotter-foam-roller",foamFootRoll,{},["l:calf"],[62,19,[0,.89,.07],2.07],5100,.47],
  ["4485","spotter-massage-rear-wall",massageWall,{placement:[.183,1.367]},["l:rearShoulder"],[57,15,[0,1.04,-.19],2.26],5200],
  ["4487","spotter-massage-rear-wall",massageWall,{placement:[.137,1.452]},["l:trap"],[57,15,[0,1.04,-.19],2.26],5100],
  ["4489","spotter-massage-rear-wall",massageWall,{placement:[.112,1.285]},["l:trap"],[58,15,[0,1.04,-.19],2.26],5200],
  ["4491","spotter-massage-rear-wall",massageWall,{placement:[.089,1.155]},["l:trap"],[59,15,[0,1.02,-.19],2.24],5200],
  ["4490","spotter-massage-rear-wall",massageWall,{placement:[.149,1.489]},["l:trap"],[61,15,[0,1.04,-.19],2.26],5200],
  ["3570","spotter-massage-rear-wall",massageWall,{placement:[.176,1.493]},["l:trap"],[61,15,[0,1.04,-.19],2.26],5200],
  ["4611","spotter-massage-rear-wall",massageWall,{placement:[.223,1.359]},["l:rearShoulder"],[63,16,[0,1.03,-.16],2.28],5200],
  ["4472","spotter-massage-rear-wall",massageWall,{placement:[.214,.881],hip:true},["l:glute"],[64,17,[0,1.01,-.18],2.27],5200],
  ["3569","spotter-massage-front-wall",massageWall,{placement:[.135,1.331],front:true},["l:pec"],[108,17,[0,1.00,.33],2.2],5200],
  ["4484","spotter-massage-front-wall",massageWall,{placement:[.155,1.377],front:true},["l:pec"],[108,17,[0,1.00,.33],2.2],5200],
  ["4483","spotter-massage-front-wall",massageWall,{placement:[.139,1.246],front:true},["l:pec"],[108,17,[0,1.00,.33],2.2],5200],
  ["4496","spotter-massage-table",massageTable,{portion:.51},["l:forearm"],[62,23,[.14,.86,.36],1.98],5200],
  ["4494","spotter-massage-table",massageTable,{portion:.52,palmUp:true},["l:forearm"],[62,23,[.14,.86,.36],1.98],5200],
  ["4497","spotter-massage-table",massageTable,{portion:.21,palmUp:true},["l:forearm"],[62,23,[.14,.86,.36],1.98],5200],
  ["4495","spotter-massage-table",massageTable,{portion:.16},["l:forearm"],[62,23,[.14,.86,.36],1.98],5200],
  ["4465","spotter-massage-ball",massageCalf,{},["l:calf"],[61,24,[0,.45,.11],1.72],5200],
  ["4463","spotter-massage-ball",massageCalf,{surface:'out'},["l:calf"],[63,24,[0,.45,.11],1.72],5200],
  ["4467","spotter-massage-ball",massageCalf,{surface:'in'},["l:calf"],[66,24,[0,.45,.11],1.72],5200],
  ["4462","spotter-massage-ball",massageSole,{},["l:calf"],[65,19,[0,.90,.08],2.11],5200],
  ["4486","spotter-massage-ball",massageFloorBack,{placement:[.153,-.482]},["l:rearShoulder"],[65,23,[0,.40,-.084],1.69],5200],
  ["4488","spotter-massage-ball",massageFloorBack,{placement:[.119,-.544]},["l:trap"],[65,23,[0,.40,-.10],1.69],5200],
  ["4492","spotter-massage-ball",massageFloorBack,{placement:[.085,-.208]},["l:trap"],[65,23,[0,.40,.05],1.69],5200],
  ["4480","spotter-massage-ball",massageFloorBack,{placement:[.088,-.120]},["core"],[65,23,[0,.40,.05],1.69],5200],
  ["4600","spotter-massage-ball",massageFloorBack,{placement:[.119,-.138]},["core"],[65,23,[0,.40,.05],1.69],5200],
  ["4481","spotter-massage-ball",massageFloorBack,{placement:[.117,-.102],diagonal:true},["core"],[65,23,[0,.40,.05],1.69],5200],
  ["4473","spotter-massage-ball",massagePiriformis,{},["l:glute"],[61,24,[0,.51,.09],1.79],5200],
  ["3568","spotter-massage-ball",massagePiriformis,{},["l:glute"],[65,24,[0,.51,.09],1.79],5350],
  ["4474","spotter-massage-ball",massagePiriformis,{supine:true},["l:glute"],[63,24,[0,.42,.09],1.74],5200],
  ["2949","spotter-foam-roller",foamSideRoll,{area:"lat",legSupport:true},["l:lat"],[66,28,[0,.40,-.06],1.83],5100],
  ["5383","spotter-foam-roller",foamSideRoll,{area:"lower-back",legSupport:true},["l:core"],[64,25,[0,.42,.03],1.78],5200],
  ["5397","spotter-foam-roller",foamSideRoll,{area:"calf",legSupport:true},["l:calf"],[66,26,[0,.42,.14],1.82],5150],
  ["5396","spotter-foam-roller",foamSideRoll,{area:"calf"},["l:calf"],[65,25,[0,.42,.14],1.82],5200],
  ["5393","spotter-foam-roller",foamSideRoll,{area:"thigh"},["l:quad"],[65,25,[0,.43,.07],1.81],5200],
  ["4598","spotter-foam-roller",foamSideRoll,{area:"hip",legSupport:true},["l:glute"],[67,25,[0,.44,.04],1.81],5300],
  ["2205","spotter-foam-roller",foamSideRoll,{area:"hip",legSupport:true},["l:glute"],[62,25,[0,.44,.04],1.81],5050],
  ["5379","spotter-foam-roller",foamSideRoll,{area:"shoulder"},["l:rearShoulder"],[62,25,[0,.44,-.04],1.76],5200],
  ["5380","spotter-foam-roller",foamSideRoll,{area:"shoulder",movingArm:true},["l:rearShoulder"],[62,28,[0,.46,-.04],1.86],5200],
  ["5385","spotter-foam-roller",foamSideRoll,{area:"blade",movingArm:true},["l:rearShoulder","l:lat"],[65,27,[0,.46,-.04],1.86],5250],
  ["5375","spotter-foam-roller",foamSideRoll,{area:"triceps"},["l:triceps"],[67,24,[0,.42,-.10],1.81],5200],
  ["5374","spotter-foam-roller",foamProneRoll,{area:"biceps"},["l:biceps"],[60,27,[.11,.41,-.09],1.86],5200],
  ["5377","spotter-foam-roller",foamProneRoll,{area:"pec"},["l:pec"],[61,25,[.07,.40,-.16],1.78],5200],
  ["5378","spotter-foam-roller",foamProneRoll,{area:"shoulder"},["l:shoulder","l:pec"],[64,25,[.11,.43,-.15],1.82],5200],
  ["2948","spotter-foam-roller",foamProneRoll,{area:"pec"},["l:pec"],[64,25,[.08,.40,-.16],1.84],5100],
  ["4599","spotter-foam-roller",foamProneRoll,{area:"hip"},["l:core"],[64,25,[.07,.43,-.15],1.83],5350],
];

const [directory,...requested] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const rows = requested.length ? clips.filter(([id]) => requested.includes(id)) : clips;
if (!rows.length || (requested.length && rows.length !== requested.length)) throw new Error("Invalid or duplicate catalogue IDs.");
const out=resolve(directory);
await mkdir(out,{recursive:true,mode:0o700});
const items=[];
for (const [id,equipment,motion,options,muscles,frame,durationMs=3900,posterAt=.47] of rows) {
  const [yaw,elevation,focus,height] = frame;
  const data = {version:1,equipment,durationMs,muscles,camera:{yaw,elevation,focus,height},
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,options)}))};
  try { prepareRecipe(data); } catch(error) { throw new Error(id+": "+error.message,{cause:error}); }
  const recipe=id+".json";
  await writeFile(join(out,recipe),JSON.stringify(data)+"\n");
  items.push({id,recipe,posterAt});
}
await writeFile(join(out,"batch.json"),JSON.stringify({kind:"catalogue",items})+"\n");
console.log("Prepared",items.length,"small-prop Spotter recipes.");
