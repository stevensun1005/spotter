import { add, arm, blend, leg, mix, rep, scale, sides, stand, subtract, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const deck = .024;
const tau = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
const swing = (phase, n = 1) => Math.sin(tau * phase * n);
const stages = (list, phase) => {
  const step = (phase * list.length) % list.length;
  const index = Math.floor(step);
  const weight = (1 - Math.cos(Math.PI * (step - index))) * .5;
  return blend(list[index], list[(index + 1) % list.length], weight);
};
function guideRange(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / width);
}

function seatedFloor(profile, phase, amount) {
  const { mode } = profile;
  const sidesweep = swing(phase);
  const sway = Math.sign(sidesweep) || 1;
  const bend = mode === "saw" || mode === "mermaid" ? Math.abs(sidesweep) : amount;
  const hinge = ["fold", "calf", "saw", "split"].includes(mode) || profile.hinge;
  const splitWidth = .256 + .682 * amount;
  const hipY = mode === "sideSplit" ? .105 + Math.sqrt(Math.max(.005, .8429 ** 2 - (splitWidth - .103)**2)) : .181;
  const pitch = (hinge ? (profile.pitch ?? 1.20) * bend : .044);
  const p = stand([0, hipY, -.23], pitch, mode === "saw" ? -.97 * sidesweep : .041,
    mode === "mermaid" ? .69 * sidesweep : 0);
  if (hinge) p.headAim = [0, Math.cos(pitch + .28 * bend), Math.sin(pitch + .28 * bend)];
  if (mode === "shinBox") {
    const sideTurn = swing(phase);
    const outer = Math.abs(sideTurn);
    for (const [side, sign] of sides) {
      const front = Math.max(0, sign * sideTurn);
      const rear = Math.max(0, -sign * sideTurn);
      const hip = p[side + "h"];
      const kneeDir = unit([.66 * sideTurn + sign * .123, .369 * (1 - outer) - .15 * outer, mix(.994, .28 + .52 * front, outer)]);
      p[side + "k"] = add(hip, scale(kneeDir, .421));
      const shinDir = unit([-.82 * sideTurn * front + .78 * sideTurn * rear, -.64 * (1 - outer), -.62]);
      p[side + "a"] = add(p[side + "k"], scale(shinDir, .424));
      p[side + "t"] = add(p[side + "a"], scale(shinDir, .139));
      arm(p, side, [sign * (.346 + .095 * outer), .066, -.059], [sign * .484, -.821, -.302], [sign * .6, -.04, .79]);
    }
    return p;
  }
  for (const [side, sign] of sides) {
    const active = sign > 0;
    const hip = p[side + "h"];
    const wide = mode === "saw" || mode === "split" || mode === "sideSplit";
    const split = mode === "sideSplit" ? .32 + .49 * amount : wide ? .722 : .076;
    const toeUp = .081 + .059 * Number(mode === "calf") * bend;
    let ankle = mode === "sideSplit" ? [sign * splitWidth, .106, -.191]
      : add(hip, [sign * split, -.069, Math.sqrt(Math.max(.006, .836 ** 2 - split ** 2))]);
    let pole = [sign * .13, .926, .30];
    let toe = [sign * .016, toeUp, .108];
    let ground = true;
    if (mode === "calf" && !active || mode === "toeContact" && !active) {
      ankle = [sign * .214, .102, .120];
      pole = [sign * .991, .098, .075];
      toe = [-sign * .118, -.023, .068];
    } else if (mode === "butterfly" || mode === "toeContact") {
      const flutter = profile.flap ? .141 * Math.abs(swing(phase, 3)) : .098 * (1 - amount);
      ankle = [sign * .055, .109, .279];
      pole = [sign * .99, flutter * 4, .04];
      toe = [sign * -.041, -.033, .122];
      ground = false;
    } else if (mode === "mermaid") {
      const front = sign === sway;
      ankle = [sway * (front ? .10 : .498), .114, front ? .294 : -.412];
      pole = [sway * .893, -.09, front ? .491 : -.273];
      toe = [sway * .103, -.042, front ? .089 : -.115];
    }
    leg(p, side, ankle, pole, toe, ground && ["sideSplit", "iso", "toes"].includes(mode) ? deck : undefined);
    if (mode === "toes" && active) p[side + "ToeFlex"] = -.72 * amount;
    if (mode === "iso" && active) p[side + "k"][1] -= .059 * amount;
  }
  for (const [side, sign] of sides) {
    const shoulder = p[side + "s"];
    let wrist = mode === "sideSplit" ? blend(add(shoulder,[sign*.06,-.589,.044]),[sign*.212,.068,.252],amount) : [sign * .221, .069, -.295];
    let elbow = [sign * .570, -.481, -.642];
    let fingers = [sign * .033, -.028, .999];
    if (mode === "butterfly" || mode === "toeContact") {
      const target = p[(mode === "toeContact" ? "l" : side) + "a"];
      wrist = add(target, [sign * (mode === "toeContact" ? .014 : .044), .064 - (mode === "toeContact" ? .035 : 0), .028 + (mode === "toeContact" ? .126 : 0)]);
      elbow = [sign * .797, -.804, -.08];
      fingers = [sign * -.86, -.075, .452];
      p[side + "FingerCurl"] = mode === "toeContact" ? .59 : .64;
      if (mode === "toeContact" && sign > 0) p[side + "FingerSpread"] = .75 * amount;
    } else if (mode === "calf" || mode === "fold" || mode === "split" || mode === "saw") {
      const activeToe = p[(mode === "calf" ? "l" : mode === "saw" ? sway > 0 ? "r" : "l" : side) + "t"];
      const target = mode === "saw" && sign !== sway ? add(shoulder, [sign * .583, .035, -.09])
        : add(activeToe, [sign * .024, .026, mode === "calf" ? .013 : .054]);
      const rest = add(shoulder, mode === "saw" ? [sign * .584, .043, .032] : [sign * .023, -.035, .600]);
      wrist = blend(rest, target, mode === "calf" ? .68 + .32 * bend : bend);
      if (mode === "calf") {
        fingers = [sign * -.18, -.981, .072];
        p[side + "FingerCurl"] = .55;
      }
    } else if (mode === "mermaid") {
      wrist = sign !== sway ? [sign * .588, .068, -.173]
        : add(shoulder, [sway * .32 * (1 - bend) - sway * .41 * bend, .53 * bend, .12]);
      fingers = sign !== sway ? [-sway * .73, -.021, .68] : [-sway * .78, .60, .126];
    } else if (mode === "iso") wrist = [sign * .143, .212, .153];
    arm(p, side, wrist, elbow, fingers);
  }
  return p;
}

function supineFloor(profile, phase, amount) {
  const { mode } = profile;
  const turn = swing(phase);
  const active = turn > 0 ? "l" : "r";
  const working = mode === "bicycle" || mode === "turnCrunch" ? Math.abs(turn) : amount;
  const rise = mode === "hipRaise" ? .282 * amount : 0;
  const twist = mode === "bicycle" ? .72 * turn : mode === "turnCrunch" ? .48 * turn : mode === "bridgeTwist" ? .55 * turn : 0;
  const roll = mode === "hipRaise" ? -.406 * amount : 0;
  const hips = [0, mode === "bridgeTwist" ? .155 + .42 * amount : .157 + rise, -.193 - .20 * rise];
  const p = torso(hips, -Math.PI / 2 + (mode === "bicycle" ? .75 * working : mode === "turnCrunch" || mode === "crunch" ? .55 * working : 0) + roll, twist);
  p.headDrop = mode === "crunch" ? .011 : .034;
  if (mode === "hipRaise" || mode === "bridgeTwist") {
    const shoulder = add(hips, [0, -.08, -.495]);
    shoulder[1] = .149;
    p.ls = add(shoulder, [.192, 0, 0]);
    p.rs = add(shoulder, [-.192,0,0]);
    p.chest = blend(hips, shoulder,.68);
    p.neck = [0,.137,shoulder[2]-.100];
    p.head = [0,.159,shoulder[2]-.231];
  }
  for (const [side, sign] of sides) {
    const bending = active === side;
    const bentLeg = mode === "bicycle" && bending ? working : mode === "tuck" || mode === "hipRaise" ? working : 0;
    const feet = mode === "crunch" || mode === "turnCrunch" || mode === "bridgeTwist";
    const hip = p[side + "h"];
    const ankle = feet ? [sign * .137 + (mode === "bridgeTwist" ? .221 * turn * amount : 0), .112, .439]
      : blend(add(hip, [sign * .041, -.051, .833]), [mode === "bicycle" ? sign*.031 : sign*.158, .273 + .305 * bentLeg, -.148 + .34 * (1 - bentLeg)], bentLeg);
    const pole = [sign * .094 + (mode === "bridgeTwist" ? .529 * turn * amount : 0), .95, -.035];
    if (mode === "bicycle" && bending) {
      const crossing = blend([sign*.041,.038,.991],[-sign*.060,.879,-.382],working);
      const knee=add(hip,scale(unit(crossing),.422));
      const shin=scale(unit(blend([sign*.035,-.11,.98],[-sign*.056,-.104,.98],working)),.424);
      p[side+"k"]=knee;
      p[side+"a"]=add(knee,shin);
      p[side+"t"]=add(p[side+"a"],[sign*.021,-.063,.133]);
      continue;
    }
    leg(p, side, ankle, pole, [sign * .021, -.063, .133], feet ? deck : undefined);
  }
  for (const [side, sign] of sides) {
    let wrist = [sign * .278, .066, -.159];
    let elbow = [sign * .59, -.564, -.582];
    let fingers = [sign * .028, -.053, .997];
    if (mode === "crunch" || mode === "turnCrunch" || mode === "bicycle") {
      wrist = add(p.head, [sign * .102, .056, .051]);
      elbow = [sign * .914, .08, .396];
      fingers = [-sign * .82, .07, -.58];
      if(mode==="bicycle"&&side!==active) elbow=blend(elbow,unit(subtract(p[active+"k"],p[side+"s"])),working);
    } else if (mode === "tuck") {
      const reach = blend(p[side + "k"], p[side + "a"], .31);
      wrist = blend(wrist, add(reach, [sign * .057, .063, .024]), amount);
      fingers = [-sign * .83, .056, .52];
    } else if (mode === "bridgeTwist") {
      wrist = [sign * .754, .068, -.60];
      fingers = [sign, -.018, .044];
    }
    arm(p, side, wrist, elbow, fingers);
  }
  return p;
}

function proneFloor(profile, phase, amount) {
  const { mode } = profile;
  const sideActive = swing(phase) >= 0 ? 1 : -1;
  const movement = Math.abs(swing(phase));
  const push = ["diamond", "clock", "lungePush"].includes(mode);
  const dipping = profile.mode === "deficit" || mode === "pike" || mode === "dog";
  const vinyasa = mode === "childCobra" || mode === "vinyasa" || mode === "sunA" || mode === "sunB";
  let yaw = mode === "clock" ? .644 * swing(phase) : 0;
  let warriorPhase=0;
  let warriorSide=1;
  let configuration = [-.192, .377, 1.487, .394];
  if (mode === "cobra") configuration = [-.192, .148, mix(1.571, .429, amount), .456];
  if (push) configuration = [-.205, mix(.419, .203, amount), 1.48, .367];
  if (dipping) configuration = [-.223 - .081 * amount, mode === "pike" ? .52 + .41 * amount : .832 + .083 * amount,
    mode === "pike" ? 1.652 + .835 * amount : 2.35 + .18 * amount, .326];
  if (mode === "lungePush") {
    configuration = stages([[.019, .917,.035,.21],[-.061,.497,.482,.271],[-.192,.409,1.441,.398],[-.192,.202,1.544,.401],
      [-.192,.413,1.426,.392],[-.061,.497,.475,.286],[.019,.917,.035,.21]], phase);
  }
  const kneel = [-.446,.277,1.699,.413];
  const press = [-.208,.215,1.489,.402];
  const plank = [-.219,.407,1.50,.402];
  const cobra = [-.171,.152,.449,.405];
  const down = [-.294,.903,2.469,.420];
  const standing = [.090,.903,.031,.28];
  const tall = [.090,.905,-.105,.28];
  const fold = [.039,.841,2.464,.27];
  const chair = [-.091,.658,.423,.188];
  const warrior = [-.163,.655,.115,.37];
  if (vinyasa) {
    const sequence = mode === "childCobra" ? [kneel,press,cobra,cobra,press,kneel]
      : mode === "vinyasa" ? [plank,press,cobra,down,down,plank]
        : mode === "sunA" ? [standing,tall,fold,plank,press,cobra,down,fold,tall,standing]
          : [standing,chair,fold,plank,press,cobra,down,warrior,plank,press,cobra,down,warrior,plank,press,cobra,down,fold,chair,standing];
    configuration = stages(sequence, phase);
    if (mode === "sunB") {
      const step=phase*sequence.length;
      const nearer=Math.abs(step-7)<Math.abs(step-12)?7:12;
      warriorSide=nearer===7?1:-1;
      warriorPhase=Math.max(0,1-Math.abs(step-nearer)*1.16);
      yaw=warriorSide*.18*warriorPhase;
    }
  }
  const [z,y,length,handZ] = configuration;
  const pitch = mode === "dog" ? length + .074 * movement : length;
  const hip = [mode === "dog" ? .081 * swing(phase) : 0, y, z];
  const p = stand(hip, pitch, yaw);
  if (mode === "cobra" || vinyasa) p.headAim = [0, Math.max(.1,Math.cos(pitch)), Math.sin(pitch) * .80];
  else if (mode === "plank" || mode === "dog" || mode === "clock") p.headAim = [0, Math.cos(pitch), Math.sin(pitch)];
  const upright = (mode === "sunA" || mode === "sunB" || mode === "lungePush") ? clamp((.91 - pitch) * 1.49) : 0;
  const lowKneel = mode === "childCobra" ? clamp((-.24 - z) * 5.09) : 0;
  const isProne = mode === "cobra" || vinyasa && y < .25;
  for (const [side, sign] of sides) {
    const shoulder = p[side + "s"];
    const working = sign === sideActive;
    const hip = p[side + "h"];
    let ankle = [sign * .144, .149, -.948];
    if (dipping || vinyasa && pitch > 1.95) ankle = [sign * .147, .111 + (mode === "dog" && working ? .119 * movement : 0), -.531];
    if (isProne) ankle = [sign * .137, .096, -.998];
    if (mode === "pike") ankle = blend([sign*.144,.125,-.812],[sign*.144,.110,-.437],amount);
    if (lowKneel > .02) ankle = blend(ankle,[sign * .138,.095,-.799],lowKneel);
    if (upright > .02) ankle = blend(ankle, [sign * .128,.108,.083], upright);
    if (mode === "lungePush" && y < .70 && pitch < 1.20) {
      ankle = blend(ankle, [sign * .169,.112,working ? .428 : -.649],clamp((1.20 - pitch)*1.36));
    }
    let toe = [sign * .018, isProne || lowKneel > .5 ? -.051 : -.123, isProne || lowKneel > .5 ? -.127 : .090];
    const pole = [sign * .31, -.112, .948];
    if (warriorPhase > .015) {
      const front=sign===warriorSide;
      const kneeRoom = Math.sqrt(Math.max(.04, .842 ** 2 - (hip[1] - .112) ** 2 - .05 ** 2));
      ankle=blend(ankle,[sign*.151,.112,front?.282:hip[2]-kneeRoom],warriorPhase);
      toe=blend(toe,[sign*(front?.016:.093),-.066,front?.128:.094],warriorPhase);
    }
    if (dipping || upright > .30) toe = [sign * .016, -.064, .130];
    const straightPush=mode==="diamond"||mode==="clock"||mode==="plank"||mode==="lungePush"&&pitch>1.37||vinyasa&&pitch>1.31&&pitch<1.66&&lowKneel<.05;
    if(straightPush){
      const vertical=ankle[1]-hip[1];
      const lane=ankle[0]-hip[0];
      ankle[2]=hip[2]-Math.sqrt(Math.max(.12,.842**2-vertical**2-lane**2));
    }
    leg(p, side, ankle, pole, toe, deck);
    if (lowKneel > .20) {
      const knees = [sign * .192, .112, hip[2] + .389];
      const shin = unit(blend(subtract(p[side+"a"],p[side+"k"]),[sign*.011,-.017,-.423],lowKneel));
      p[side+"k"] = add(hip,scale(unit(subtract(blend(p[side+"k"],knees,lowKneel),hip)),.422));
      p[side+"a"] = add(p[side+"k"],scale(shin,.424));
      p[side+"t"] = add(p[side+"a"],toe);
    }
    const center = mode === "diamond" ? .044 : .199;
    let wrist = [sign * center + (mode === "clock" ? .332 * swing(phase) : 0), .068, handZ];
    let elbow = [sign * .33,-.435,-.831];
    let fingers = mode === "diamond" ? [-sign * .545,-.018,.837] : [0,-.026,.999];
    if (mode === "plank") {
      p[side+"e"]=[sign*.187,.089,.275];
      p[side+"w"]=[sign*.126,.071,.616];
      p[side+"Fingers"]=[-sign*.10,-.032,.986];
      continue;
    }
    if (upright > .02) {
      const armUp = mode === "sunA" || mode === "sunB" ? clamp((.175-pitch)*5.6) : 0;
      const stand = add(shoulder,[sign*.058,mix(-.574,.558,armUp),.099]);
      wrist=blend(wrist,stand,upright);
      fingers=blend(fingers,[0,mix(-.93,.986,armUp),.16],upright);
    }
    if(warriorPhase>.01){
      wrist=blend(wrist,add(shoulder,[sign*.047,.595,.070]),warriorPhase);
      fingers=blend(fingers,[sign*.017,.995,.035],warriorPhase);
    }
    arm(p, side, wrist, elbow, fingers);
    if (warriorPhase > .51) {
      const reach = (warriorPhase - .51) / .49;
      const up = unit([sign*.11,.991,.061]);
      p[side+"e"] = blend(p[side+"e"], add(shoulder,scale(up,.252)),reach);
      const release = add(shoulder,scale(up,.696));
      p[side+"w"] = blend(p[side+"w"],release,reach);
    }
  }
  return p;
}

export function floorReferenceGuideMotion(guide, profile) {
  const { frames } = guide;
  const source = guideRange(frames, f => f[1][1] - f[2][1]);
  const first = source(frames[0]);
  const move = profile.family === "seat" ? seatedFloor : profile.family === "supine" ? supineFloor : proneFloor;
  return phase => {
    const f = guideAt(frames, phase);
    const progress = Math.max(.83 * rep(phase,.37,.63), Math.abs(source(f) - first));
    return move(profile, phase, progress);
  };
}
