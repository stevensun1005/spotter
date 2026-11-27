import { add, arm, blend, leg, mix, rep, scale, sides, stand, subtract, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const tau = Math.PI * 2;
const deck = .024;
const clamp = n => Math.max(0, Math.min(1, n));
const ring = (min, max, phase) => {
  const amount = clamp((phase - min) / (max - min));
  return .5 - .5 * Math.cos(Math.PI * amount);
};
const stages = (list, phase) => {
  const position = phase * (list.length - 1);
  const start = Math.min(list.length - 2, Math.floor(position));
  return blend(list[start], list[start + 1], ring(0, 1, position - start));
};
function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / width);
}

function rollingPose(profile, phase, signal) {
  const { mode } = profile;
  const handsOnFeet = mode === "seal" || mode === "crab";
  const sit = [.179,-.282,-.059];
  const shoulder = mode === "control" ? [.574,-2.35,-.041] : [.734,-2.57,-.041];
  const vSit = [.169,-.687,-.191];
  const feetSwitch = ring(.31, .46, phase);
  const [height, angle, z] = mode === "boomerang" ? stages([sit,[.215,-1.88,.0],shoulder,shoulder,vSit,vSit,sit],phase)
    : mode === "control" ? stages([[.156,-1.57,.117],[.48,-2.18,.134],shoulder,shoulder,shoulder,[.48,-2.18,.134],[.156,-1.57,.117]],phase)
      : stages([sit,[.29,-1.74,.04],[.534,-2.431,.072],[.534,-2.431,.072],[.29,-1.74,.04],sit],phase);
  const inverted = clamp((-angle - 1.38) * 1.19);
  const rolling = mode === "seal" || mode === "crab";
  const crest = clamp(inverted * 1.9);
  const p = torso([0,height,z],angle);
  p.headDrop = .013;
  p.headAim = [0,Math.cos(angle+.29*inverted),Math.sin(angle+.29*inverted)];
  if (mode === "control" && inverted > .10) {
    const supported = ring(.10, .62, inverted);
    p.neck = blend(p.neck, [0,.133,z-.497], supported);
    p.head = blend(p.head, [0,.153,z-.609], supported);
    p.chest = blend(p.chest, [0,.289,z-.306], supported);
    p.headAim = blend(p.headAim,[0,.192,-.982],supported);
    p.ls = blend(p.ls,[.192,.169,z-.411],supported);
    p.rs = blend(p.rs,[-.192,.169,z-.411],supported);
  }
  for (const [side, sign] of sides) {
    let ankle = [sign * .158, .129, .621];
    let pole = [sign * .114, .94, -.232];
    let toe = [sign * .013, .064, .125];
    if (rolling) {
      const tap = .5 + .5 * Math.sin(tau * phase * 5);
      const gap = mode === "seal" ? .033 + tap * .075 : .082;
      const twist = mode === "crab" ? feetSwitch * 2 - 1 : sign;
      ankle = [sign * (gap - .118 * Number(mode === "crab")), .23 + .34 * crest + sign * .059 * twist, mix(.309,-.365,crest)];
      pole = [sign * .86,.24+ .23*crest,.29-.84*crest];
      toe = [sign*.025,.051,.106-.194*crest];
    } else if (mode === "control") {
      const liftSide = sign * (feetSwitch * 2 - 1);
      const lift = (liftSide + 1) * .5;
      const hip = p[side+"h"];
      const inverted = clamp((-angle - 1.57) / .76);
      const rotation = inverted * mix(3.65,Math.PI*.50,lift);
      const sideOffset = sign*.045;
      const ankleY = Math.max(.113, hip[1] + .837*Math.sin(rotation));
      const span = Math.sqrt(Math.max(.006, .843**2 - sideOffset**2 - (ankleY-hip[1])**2));
      ankle=[hip[0]+sideOffset,ankleY,hip[2]+Math.sign(Math.cos(rotation))*span];
      pole=[sign*.087,.302,-.90];
      toe=[sign*.013,.084,mix(.108,-.098,inverted)];
    } else {
      const signedCross = (feetSwitch < .5 ? -1 : 1) * sign;
      const split = .038 + .18 * Math.sin(Math.PI*feetSwitch);
      const pike = phase>.54 ? Math.sin(Math.PI*clamp((phase-.54)/.46)) : 0;
      ankle=[signedCross*split,.115+.47*pike+.022*signal*inverted,mix(.612,-.760,crest)];
      const dir=unit(subtract(ankle,p[side+"h"]));
      ankle=add(p[side+"h"],scale(dir,.839));
      toe=[sign*.012,.066,.101-.188*crest];
    }
    leg(p,side,ankle,pole,toe);
  }
  for (const [side, sign] of sides) {
    const wrist=handsOnFeet ? add(p[side+"a"],[sign*.045,.054,.006]) : null;
    let target=[sign*.235,.069,-.168];
    let finger=[0,-.042,.997];
    if(mode==="control"){
      const ankle=p[(feetSwitch<.5 ? "r":"l")+"a"];
      target=blend(target,add(ankle,[sign*.034,.036,.059]),inverted);
      finger=[-sign*.69,-.29,-.66];
    }else if(wrist){
      target=wrist;
      finger=[-sign*.73,-.28,.55];
    }else if(phase>.56){
      const A=add(p[side+"s"],[sign*.027,-.339,-.491]);
      const B=add(p[side+"s"],[sign*.086,-.195,.579]);
      target=blend(A,B,ring(.68,.95,phase));
    }
    arm(p,side,target,[sign*.70,-.454,-.34],finger);
    if(handsOnFeet)p[side+"FingerCurl"]=.66;
  }
  return p;
}

function sideSupport(profile, phase, amount) {
  const { mode } = profile;
  const pretzel = mode === "pretzel";
  const rotator = mode === "rotator";
  const bridge = mode === "sideLeg" || mode === "sideTwist";
  const turn = mode === "sideTwist" ? .80 * amount : 0;
  const angle = bridge ? 1.10 : 1.55;
  const p = torso([0, bridge ? .600 : rotator ? .288 : .244, -.246], angle, -1.49 + turn + .51 * amount * Number(pretzel));
  p.headDrop = bridge ? .018 : .035;
  for(const [side,sign] of sides){
    const upper=sign>0;
    const y=bridge ? upper ? .216+.49*amount*Number(mode==="sideLeg") : .115 : upper ? .36 : .142;
    const z=bridge ? -.876-.081*amount*Number(mode==="sideLeg"&&upper) : pretzel ? upper ? -.051+.16*amount : .203 : -.792;
    p[side+"h"]=[0, p.hips[1]+(upper?.091:-.091),p.hips[2]];
    let ankle=[bridge ? sign*.022 : pretzel ? upper ? -.371*amount : .252 : sign*.046, y, z];
    if (rotator) {
      const hip = p[side+"h"];
      const knee = add(hip, scale(unit([.226,upper?-.256:-.193,-.854]),.422));
      const shin = scale(unit([-.652,-.11,-.748]),.424);
      p[side+"k"] = knee;
      p[side+"a"] = add(knee,shin);
      p[side+"t"] = add(p[side+"a"],[-.031,-.061,-.119]);
      continue;
    }
    if (bridge) {
      const hip=p[side+"h"];
      const offset=subtract(ankle,hip);
      ankle[2]=hip[2]-Math.sqrt(Math.max(.145,.842**2-offset[0]**2-offset[1]**2));
    }
    const pole=bridge ? [sign*.242,.095,.967] : pretzel ? [upper?.192:.917,.31,.205] : [sign*.061,.91,.403];
    leg(p,side,ankle,pole,[sign*.019,bridge?-.059:-.025,-.131],bridge&&!upper ? deck : undefined);
  }
  for(const [side,sign] of sides){
    const upper=sign>0;
    const shoulder=p[side+"s"];
    let wrist=bridge&&!upper ? add(shoulder,[-.095,.067-shoulder[1],.136]) : upper ? [.302,.590,.215] : [-.049,.075,.624];
    let elbow=[sign*.74,-.45,-.5];
    let finger=[0,-.033,.99];
    if(bridge&&upper){
      wrist=mode==="sideTwist" ? blend(add(shoulder,[.11,.588,.071]),[-.321,.213,-.267],amount)
        : add(p.hips,[.036,.171,-.19]);
      elbow=[sign*.68,.136,.72];
      finger=mode==="sideTwist" ? [0,1-1.28*amount,-.91*amount+.039] : [sign*.012,-.911,-.34];
    }else if(pretzel){
      wrist=upper?add(p.la,[.043,.034,.072]):add(p.rk,[-.07,.044,.095]);
      finger=upper?[-.551,-.81,-.13]:[.59,-.08,-.73];
      p[side+"FingerCurl"]=.74;
    }else if(rotator&&upper){
      const e=add(shoulder,[.019,-.031,-.249]);
      p[side+"e"]=e;
      const rotation=amount*1.53;
      p[side+"w"]=add(e,[.370*Math.cos(rotation),.370*Math.sin(rotation),.014]);
      p[side+"Fingers"]=[.997*Math.cos(rotation),.997*Math.sin(rotation),.035];
      continue;
    }else if(rotator){
      const elbow=add(shoulder,[.152,-.014,.198]);
      p[side+"e"]=elbow;
      p[side+"w"]=add(elbow,[-.034,-.044,.367]);
      p[side+"Fingers"]=[0,-.027,.998];
      continue;
    }
    arm(p,side,wrist,elbow,finger);
  }
  return p;
}

function armBalance(profile, phase) {
  const lizard=profile.mode==="lizard";
  const firefly=profile.mode==="dragonfly";
  const lift=rep(phase,.34,.65);
  const landing=clamp((lift-.20)*1.36);
  const approach=clamp(lift*1.70);
  const hips=lizard ? [0,mix(.43,.419,lift),-.154+.039*lift] : [.08*landing,mix(.68,.462,approach),-.179+.092*landing];
  const tilt=lizard ? 1.286+.187*landing : .416+1.066*approach;
  const yaw=firefly ? -.35-.649*landing : 0;
  const p=stand(hips,tilt,yaw,firefly ? -.192*landing : 0);
  p.headDrop=.018;
  for(const [side,sign] of sides){
    const wrist=[sign*.202,.068,.429];
    const pole=[sign*.22,.433,-.86];
    arm(p,side,wrist,pole,[0,-.027,.999],[-sign,.091,.028]);
  }
  for(const [side,sign] of sides){
    const front=sign>0;
    if(lizard){
      const anchor=front ? [.347,.112,.412] : [-.158,.169,-.933];
      const target=front ? [.346,.315,.458] : [-.191,.473,-.899];
      leg(p,side,blend(anchor,target,landing),front ? [.96,.30,.057] : [-.098,-.79,.61],[sign*.018,-.075,front?.116:-.103],landing<.014 ? deck : undefined);
      if(front&&landing>.12){
        const knee=p[side+"k"];
        const bend=blend(knee,add(p[side+"e"],[.111,.09,-.07]),landing*.68);
        p[side+"k"]=add(p[side+"h"],scale(unit(subtract(bend,p[side+"h"])),.422));
        p[side+"a"]=add(p[side+"k"],scale(unit(subtract(p[side+"a"],p[side+"k"])),.424));
        p[side+"t"]=add(p[side+"a"],[sign*.018,-.075,.116]);
      }
    }else{
      const anchor=front ? [-.220,.389,.178] : [-.135,.108,.063];
      const outside = add(p[side+"h"], scale(unit([-1,.074,-.371]),.843));
      const target=front ? add(p.re,[.014,.096,-.061]) : outside;
      leg(p,side,blend(anchor,target,landing),front ? [.983,.061,.15] : [-.29,.093,.95],
        [sign*.019,-.073,.122],!front&&landing<.022 ? deck : undefined);
    }
  }
  return p;
}

function quadrupedTurn(profile,phase) {
  const crab = profile.mode==="crawlCrab";
  const turn=rep(phase,.35,.60);
  const hips=[-.085*turn,(crab ? .441 : .443)+.051*turn,-.155];
  const pitch=crab ? 1.54 - 3.05*turn : 1.51-.55*turn;
  const roll=crab ? -Math.PI*turn : -1.52*turn;
  const p=torso(hips,pitch,roll);
  for(const [side,sign] of sides){
    const moving=sign>0;
    const anchor=[sign*.167,.112,-.535];
    const turnFoot=[sign*.149,.111,.362];
    let foot=crab ? blend(anchor,turnFoot,turn) : moving ? blend(anchor,[-.731,.272,.162],turn) : anchor;
    if(moving&&!crab){
      const hip=p[side+"h"];
      const straight=add(hip,scale(unit(subtract(foot,hip)),.843));
      foot=blend(foot,straight,ring(.59,.96,turn));
    }
    if(moving)foot[1]+=.071*Math.sin(Math.PI*turn);
    const front=crab?1-2*turn:1;
    leg(p,side,foot,[sign*.19,.54,.82*front],[sign*.023,-.061,.134*front],!moving||turn<.02 ? deck : undefined);
    const grip=[sign*.209,.071,.376];
    const wrist=moving?blend(grip,crab ? [sign*.202,.073,-.539] : add(p[side+"s"],[sign*.073,.489,.312]),turn):grip;
    if (moving&&crab)wrist[1]+=.471*Math.sin(Math.PI*turn);
    arm(p,side,wrist,[sign*.37,-.52,-.72],[0,-.04,.999]);
  }
  return p;
}

function pigeonAndLunge(profile, phase, amount) {
  const { mode }=profile;
  const bird=mode==="bird";
  const pigeon=mode==="pigeon";
  const prisoners=mode==="prisoner";
  const standing=mode==="twistStep"||mode==="sideAngle"||bird||prisoners;
  const stepPhase=phase<.5?phase*2:(phase-.5)*2;
  const greatest=mode==="greatest";
  const turn=mode==="twistStep"||prisoners||greatest?phase<.5?1:-1:1;
  const travel=mode==="twistStep"||prisoners?rep(stepPhase,.37,.62):greatest?rep(stepPhase,.21,.37):amount;
  const extension=ring(.45,.78,travel);
  const hamstring=greatest?rep(stepPhase,.73,.81)*(1-ring(0,.55,stepPhase)) : 0;
  const hipY=bird?.907-.230*Math.sin(travel*Math.PI)+.021*extension:pigeon?.443-.246*travel:standing?prisoners?.463+.449*travel:.905-.381*travel:.481-.104*travel+.147*hamstring;
  const center=[(bird ? -.071 : .015)*travel,hipY,(pigeon?-.164:-.057)+.097*travel-.229*hamstring];
  const angle=pigeon?.584+(profile.low?1.031:.14)*travel:bird?.09+.66*Math.sin(travel*Math.PI):mode==="greatest"?1.465+.272*travel
    :mode==="achilles"?.96:mode==="sideAngle"?.622*travel:.036+.33*travel;
  const p=stand(center,angle,mode==="twistStep"||mode==="greatest"?turn*.92*travel:bird?.123*travel:0,mode==="sideAngle"?-.62*travel:0);
  for(const [side,sign] of sides){
    const forward=sign===turn;
    const hip=p[side+"h"];
    let ankle=forward?[sign*.17,.113,.485]:[sign*.139,.152,-.684];
    let pole=forward?[sign*.253,.635,.728]:[sign*.131,-.489,.86];
    let toe=[sign*.019,-.073,forward?.122:-.102];
    let plant=true;
    if(pigeon){
      ankle=forward?blend([sign*.146,.116,-.511],[-sign*.234,.103,.224],travel):[sign*.132,.104,-.953];
      pole=forward?[sign*.983,.068,.112]:[sign*.06,-.97,-.14];
      toe=forward?[-sign*.141,-.012,.027]:[sign*.014,-.05,-.132];
    }else if(bird){
      if(forward){
        const vector=unit(blend([.144,-.87,.11],[.820,.728,.143],extension));
        ankle=add(hip,scale(vector,.679+.164*extension));
        pole=[sign*.89,.111,.26];
        toe=[sign*.03,.11,.104];
        plant=false;
      }else ankle=[sign*.129,.095,.023];
    }else if(prisoners){
      const kneeling=[sign*.146,.111,-.493];
      ankle=blend(kneeling,[sign*.145,.112,forward?.177:.022],travel);
      pole=forward?[sign*.122,.56,.816]:[sign*.21,-.20,.94];
      toe=[sign*.018,-.064,mix(-.132,.125,travel)];
    }else if(mode==="achilles" && !forward) {
      ankle[1]=.105;
      ankle[2]=-.578-.101*travel;
      toe[2]=.124;
    }else if(mode==="twistStep"||mode==="sideAngle"){
      ankle=blend([sign*.145,.104,.017],ankle,travel);
      toe=[sign*.02,-.074,.108];
    }
    if (greatest && forward && hamstring > .011) {
      const target=add(hip,scale(unit(subtract(ankle,hip)),.839));
      ankle=blend(ankle,target,hamstring);
      toe=blend(toe,[sign*.018,.091,.117],hamstring);
    }
    if (greatest && !forward) {
      ankle[2]=hip[2]-Math.sqrt(Math.max(.25,.842**2-(ankle[1]-hip[1])**2-(ankle[0]-hip[0])**2));
      toe=[sign*.019,-.126,.075];
    }
    leg(p,side,ankle,pole,toe,plant?deck:undefined);
  }
  for(const [side,sign] of sides){
    const forward=sign===turn;
    const shoulder=p[side+"s"];
    let wrist=[sign*.223,.067,.491];
    let finger=[0,-.034,.998];
    let elbow=[sign*.43,-.581,-.61];
    if(prisoners){
      wrist=add(p.head,[sign*.094,.034,-.115]);
      finger=[-sign*.63,.202,-.72];
    }else if(bird) {
      wrist=add(p.hips,[.106,.094+.123*travel,-.235]);
      finger=[-sign*.91,-.049,-.41];
      elbow=[sign*.39,-.587,.71];
      p[side+"FingerCurl"]=.74;
    }else if(mode==="twistStep"){
      wrist=add(p.chest,[sign*.135+turn*.189*travel,.072,.388]);
      finger=[-sign*.34,.023,.94];
    }else if(mode==="greatest"&&!forward||mode==="sideAngle"&&!forward){
      wrist=blend(wrist,add(shoulder,[sign*.045,.593,.064]),travel);
      finger=[0,.999,.054];
    }else if(mode==="hipExtend") {
      wrist=add(p[side+"k"],[sign*.025,.078,.052]);
      finger=[0,-.258,.96];
    }
    arm(p,side,wrist,elbow,finger);
  }
  return p;
}

function chairKneel(amount) {
  const p=stand([0,.510-.136*amount,-.665-.111*amount],.083+.20*amount);
  for (const [side,sign] of sides) {
    const back=sign<0;
    const ankle=[sign*.155,back?.103:.086,back?-.990:-.431];
    const bend=[sign*.124,back?-.989:.72,back?.073:.59];
    const toe=[sign*.016,back?-.063:-.066,back?-.124:.126];
    leg(p,side,ankle,bend,toe,back?undefined:0);
    if(back){
      const target=[sign*.15,.113,-.568];
      p[side+"k"]=add(p[side+"h"],scale(unit(subtract(target,p[side+"h"])),.421));
      p[side+"a"]=add(p[side+"k"],scale(unit(subtract(ankle,p[side+"k"])),.424));
      p[side+"t"]=add(p[side+"a"],toe);
    }
    arm(p,side,[sign*.151,.839,-.207],[sign*.63,-.70,-.24],[0,-.19,.981]);
  }
  return p;
}

export function advancedFloorGuideMotion(guide,profile) {
  const {frames}=guide;
  const projection=range(frames,f=>f[1][1]-f[2][1]);
  const start=projection(frames[0]);
  return phase=>{
    const f=guideAt(frames,phase);
    const signal=Math.abs(projection(f)-start);
    const amount=Math.min(1,.86*rep(phase,.36,.62)+.14*signal);
    if(profile.family==="roll")return rollingPose(profile,phase,signal);
    if(profile.family==="support")return sideSupport(profile,phase,amount);
    if(profile.family==="arm")return armBalance(profile,phase);
    if(profile.family==="turn")return quadrupedTurn(profile,phase);
    if(profile.family==="chair")return chairKneel(amount);
    return pigeonAndLunge(profile,phase,amount);
  };
}
