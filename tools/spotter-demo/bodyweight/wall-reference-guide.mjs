import { add, arm, blend, leg, mix, rep, scale, sides, stand, subtract, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";
import { backToWall } from "./standing.mjs";

const wall = .516;
const tau = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
const rotate = ([x, y, z], angle) => [x * Math.cos(angle) + z * Math.sin(angle), y, z * Math.cos(angle) - x * Math.sin(angle)];

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / width);
}

function seatedWall(mode, amount) {
  const backs = mode === "wallSit";
  const couch = mode === "couch";
  if (!couch && !backs) {
    const hip = [0, .143, .367];
    const p = torso(hip, -Math.PI / 2);
    for (const [side, sign] of sides) {
      const raised = sign > 0 ? amount : 0;
      const angle = raised * 1.394;
      const ankle = sign > 0 ? [.141, .158 + .805 * Math.sin(angle), wall - .050]
        : [-.141, .105, hip[2] + .834];
      const toe = [sign * .014, .108, sign > 0 ? -.031 : .096];
      leg(p, side, ankle, [sign * .112, .574, -.84], toe, sign < 0 ? 0 : undefined);
      arm(p,side,[sign*.284,.069,.078],[sign*.51,-.56,-.65],[0,-.052,.999]);
    }
    return p;
  }
  const y = backs ? .555 : .341 + .174 * amount;
  const pitch = backs ? .06 + .99 * amount : .17 - .093 * amount;
  const p = stand([0,y,backs ? -.443 : -.185],pitch);
  for (const [side, sign] of sides) {
    let ankle=[sign*.144,.089,backs ? -.018 : .371];
    let pole=[sign*.146,.089,.981];
    let toe=[sign*.019,-.066,.125];
    if (!backs && sign < 0) {
      ankle=[sign*.139,.408+.095*amount,-.478];
      pole=[sign*.18,-.97,.16];
      toe=[sign*.021,.130,-.044];
    }
    leg(p,side,ankle,pole,toe,backs || sign>0 ? 0 : undefined);
    const wrist = backs ? blend(add(p[side+"s"],[sign*.028,-.564,.095]),add(p[side+"t"],[sign*.027,.078,.045]),amount)
      : sign > 0 ? add(p[side+"k"],[sign*.055,.074,.075]) : add(p.hips,[sign*.091,.217,.23]);
    arm(p,side,wrist,[sign*.55,-.54,-.57],[0,-.80,.595]);
  }
  return backToWall(p);
}

export function wallReferenceGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const change = range(frames, f => f[2][1] - f[1][1]);
  const start = change(frames[0]);
  const lower = range(frames, f => -f[8][1]);
  const first = lower(frames[0]);
  const wallSide = profile.wallSide || 1;
  const workingSide = wallSide > 0 ? -1 : 1;
  const sideMode = ["leg", "cross", "quad", "ankle", "figure", "isoShoulder", "calfRise"].includes(mode);
  const standMode = ["toeWall", "toeBack", "calfStretch", "heelPress", "kneeWall"].includes(mode);
  return phase => {
    const f = guideAt(frames, phase);
    const breath = .008 * Math.sin(tau * phase * 2);
    const repAmount = rep(phase, .39, .59);
    const amount = Math.min(1, .88 * repAmount + .12 * Math.abs(change(f)-start));
    const value = Math.min(1, .93 * repAmount + .07 * Math.abs(lower(f)-first));
    const cycle = tau * phase;
    const turn = Math.sin(cycle);
    if (["wallSit", "couch", "hamstring"].includes(mode)) return seatedWall(mode,amount);

    const sideRotation = sideMode ? -wallSide * Math.PI / 2 : 0;
    const anchor = sideMode ? [0,0,.026] : [0,0,0];
    const isCross = mode === "cross";
    const toeHeel = mode === "toeWall" || mode === "heelPress";
    const pelvicX = isCross ? wallSide * (.04 + .104 * amount) : mode === "figure" ? wallSide * .112 : 0;
    const calfBackZ = -.397;
    const lateralZ = standMode ? toeHeel ? .092 + .087 * amount : mode === "toeBack" ? .024 + .048 * amount
      : mode === "kneeWall" ? .076 + .153 * amount : -.104 + .178 * amount : mode === "corner" ? .042 + .204 * amount : 0;
    const naturalHipY = mode === "calfStretch" ? .088 + Math.sqrt(.840 ** 2 - (lateralZ - calfBackZ) ** 2 - .042 ** 2) : .906;
    const hipY = naturalHipY + breath - (mode === "figure" ? .262 * amount : mode === "calfStretch" ? (profile.bent ? .089 : 0) * amount
      : mode === "cross" ? .074 * amount : mode === "toeBack" ? .132 * amount : mode === "kneeWall" ? .155 * amount : 0);
    const localPitch = mode === "calfStretch" || mode === "toeWall" || mode === "heelPress" ? .12 + .327 * amount
      : mode === "kneeWall" ? .10 + .474 * amount : mode === "lat" ? .06 + .34 * amount
        : mode === "figure" ? .263 * amount : mode === "quad" ? -.069 * amount : .045;
    const hip = add(anchor, rotate([pelvicX, hipY, lateralZ], sideRotation));
    const yaw = mode === "chest" ? -.64 * amount : mode === "rearShoulder" ? -1.41 - .83 * amount : sideRotation;
    const lean = isCross ? -wallSide * (profile.reachUp ? .44 : .273) * amount : mode === "lat" ? -.37 * amount : 0;
    if (mode === "lat") hip[2] -= .109 * amount;
    if (mode === "chest") hip[2] += profile.straight ? .132 : .317 - .084 * amount;
    if (mode === "rearShoulder") hip[2] += .262 + .029 * amount;
    if (mode === "rotateShoulder") hip[2] += .318;
    const p = stand(hip, localPitch, yaw, lean);
    if (profile.action === "swing") {
      for (const [side,sign] of sides) p[side+"h"] = add(hip, rotate([sign*.103,0,0], sideRotation));
    }

    for (const [side, sign] of sides) {
      const active = sideMode ? sign === workingSide : sign > 0;
      let ankle = [sign * .145, .087, .035];
      let pole = [sign * .119,.054,.986];
      let toe = [sign * .016,-.066,.127];
      let contact = true;
      if(mode==="corner"){
        ankle=[sign*.138,.092,active?.198+.103*amount:-.228];
      }else if (standMode) {
        ankle = toeHeel ? [sign*.128,.093,active ? .362 : -.152] : mode === "toeBack" ? [sign*.133,active ? .126 : .085,active ? -.335 : .154]
          : mode === "kneeWall" ? [sign*.145,.088,active ? .326 : -.224]
            : [sign*.145,.088,active ? .222 : calfBackZ];
        if (mode === "calfStretch" && !active && profile.bent) {
          ankle[2] += .112 * amount;
          pole = [sign * .043, .019, .997];
        }
        if (toeHeel && active) {
          toe = [sign * .012, .107 + .025 * amount, .143];
          contact = false;
          if (mode === "toeWall") p[side+"ToeFlex"]=(profile.toe ?? .31)*amount;
        }
        if (mode === "toeBack" && active) {
          if (profile.crossover) ankle[0] = -sign * (.073 + .063 * amount);
          toe = [sign*.023,-.077,-.115];
          p[side+"ToeFlex"] = -.54 * amount;
          if (profile.step) {
            ankle[1] += .103;
            leg(p,side,ankle,pole,toe,.117);
            continue;
          }
        }
      } else if (isCross && active) {
        ankle = [sign * (-.013 + .199 * (1 - amount)),.095,-.174- .112*amount];
        if (profile.roll) {
          p[side+"FootRoll"] = profile.roll * amount * sign;
          ankle[1] += .037*amount;
        }
      } else if (mode === "leg" && active) {
        const length = .842;
        const sideTilt = profile.action === "abduct" ? .94 * value : profile.action === "adduct" ? mix(.31,-.69,value)
          : profile.action === "sideSwing" ? .71 * turn : profile.action === "circle" ? .364 * Math.sin(cycle*2) : 0;
        const fore = profile.action === "swing" ? .77 * turn : profile.action === "circle" ? .384 * Math.cos(cycle*2) : 0;
        const bent = profile.action === "bent" ? value : 0;
        ankle = [sign*(.105+length*Math.sin(sideTilt)),Math.max(.087,hipY-length*Math.cos(sideTilt)*Math.cos(fore)),length*Math.sin(fore)];
        if (bent) {
          ankle = [sign*(.136+.372*value),.091+.476*value,-.071];
          pole = [sign*.830,.30,.553];
        } else if (profile.action === "knee" || profile.action === "figure8" || profile.action === "both" || profile.action === "flex") {
          const drive = profile.action === "both" ? Math.max(0,turn) : profile.action === "flex" ? value : 0;
          const curl = profile.action === "both" ? Math.max(0,-turn) : profile.action === "knee" ? value : 0;
          const figure = profile.action === "figure8" ? 1 : 0;
          ankle = [sign*(.134+.193*Math.sin(cycle)*figure),.087 + .42*drive + .644*curl + .351*figure - .048*Math.sin(cycle*2)*figure,
            .035 + .241*drive - .302*curl+.194*figure];
          pole = curl > .018 ? [sign*.118,-.99,.025] : [sign*.128,.96,.27];
        }
        contact = false;
      } else if (mode === "quad" && active) {
        ankle = [sign*.139,.182+.594*amount,-.238-.149*amount];
        pole = [sign*.075,-.99,.015];
        toe = [sign*.019,-.135,-.034];
        contact = false;
      } else if (mode === "ankle" && active) {
        ankle = [sign*.144,.188,-.024];
        toe = [sign*.057*Math.sin(cycle*2),-.049+.095*Math.cos(cycle*2),.119];
        contact = false;
      } else if (mode === "calfRise" && (active || !profile.single)) {
        const frontLift = profile.single ? Math.max(0,turn) : amount;
        const heelLift = profile.single ? Math.max(0,-turn) : 0;
        ankle = [sign*.145 + .043*Math.sin(cycle)*amount,.089+.100*frontLift,.033+.049*frontLift];
        toe = [sign*.016,-.066-.089*frontLift+.141*heelLift,.124-.052*frontLift];
        contact = heelLift < .005;
      }
      if (mode === "figure" && active) continue;
      if (mode === "kneeWall" && active) {
        const target=[sign*.142,.393+.071*amount,.498+.032*amount];
        const hip=p[side+"h"];
        const knee=add(hip,scale(unit(subtract(target,hip)),.422));
        const shin=scale(unit(subtract(ankle,knee)),.424);
        p[side+"k"]=knee;
        p[side+"a"]=add(knee,shin);
        p[side+"t"]=add(p[side+"a"],toe);
        p.planted[side]=0;
        continue;
      }
      leg(p,side,add(anchor,rotate(ankle,sideRotation)),rotate(pole,sideRotation),rotate(toe,sideRotation),contact ? 0 : undefined);
    }

    if (mode === "figure") {
      const active = workingSide>0 ? "l":"r";
      const support = workingSide>0 ? "r":"l";
      const up = add(p[support+"k"],rotate([workingSide*.022,.080,.074],sideRotation));
      leg(p,active,up,rotate([workingSide*.99,.061,.086],sideRotation),rotate([-workingSide*.123,-.032,.054],sideRotation));
    }

    for (const [side, sign] of sides) {
      const shoulder=p[side+"s"];
      let wrist=add(shoulder,rotate([sign*.058,-.591,.051],sideRotation));
      let pole=rotate([sign*.64,-.553,-.474],sideRotation);
      let fingers=rotate([sign*.015,-.951,.29],sideRotation);
      if (mode === "corner") {
        const elbow=[sign*.347,1.234,.573];
        p[side+"e"]=add(shoulder,scale(unit(subtract(elbow,shoulder)),.252));
        const end=[sign*.350,1.614,.575];
        p[side+"w"]=add(p[side+"e"],scale(unit(subtract(end,p[side+"e"])),.371));
        p[side+"Fingers"]=[0,1,.024];
        continue;
      } else if (standMode || mode === "lat" && sign>0) {
        wrist=[sign*(mode==="lat"?.255:.196),mode==="lat"?1.848:1.201,wall];
        fingers=[0,.996,.033];
        if (mode==="lat") pole=[sign*.29,.88,.417];
      } else if (mode==="chest" && sign>0) {
        const beyond=profile.straight;
        const elbow=[shoulder[0]+.217,shoulder[1] + .020,wall-.026];
        if(!beyond) {
          p[side+"e"]=add(shoulder,scale(unit(subtract(elbow,shoulder)),.252));
          const target=[elbow[0]+.01,elbow[1]+.348,wall-.001];
          p[side+"w"]=add(p[side+"e"],scale(unit(subtract(target,p[side+"e"])),.371));
          p[side+"Fingers"]=[sign*.017,.999,.031];
          continue;
        }
        wrist=[sign*.487,1.387,wall];
        fingers=[0,1,.03];
      } else if (mode==="rotateShoulder" && sign>0) {
        const target=[sign*.231,1.242,wall-.030];
        const elbow=add(shoulder,scale(unit(subtract(target,shoulder)),.252));
        const angle=1.04*turn;
        p[side+"e"]=elbow;
        p[side+"w"]=add(elbow,[.369*Math.sin(angle),.369*Math.cos(angle),.035]);
        p[side+"Fingers"]=[Math.sin(angle),Math.cos(angle),.026];
        continue;
      } else if (mode==="rearShoulder" && sign>0) {
        wrist=[sign*.463,1.397,wall];
        pole=[sign*.91,-.376,-.177];
        fingers=[sign*.312,.944,.026];
      } else if (sideMode && sign===wallSide) {
        wrist=[.062,mode==="isoShoulder" ? 1.103 : 1.252,wall];
        fingers=mode==="isoShoulder"?[.981,.018,.026]:[0,.995,.055];
        if(mode==="isoShoulder") {
          wrist[0]+=.037 * (1-amount);
          p[side+"FingerCurl"]=.99;
        }
      } else if(mode==="quad" && sign===workingSide) {
        wrist=blend(wrist,add(p[side+"a"],rotate([sign*.027,.035,.053],sideRotation)),amount);
        fingers=rotate([0,-.93,-.361],sideRotation);
        p[side+"FingerCurl"]=.84*amount;
      } else if(isCross && sign===workingSide && profile.reachUp) {
        wrist=add(shoulder,rotate([wallSide*.294*amount,.566,.045],sideRotation));
        fingers=rotate([wallSide*.436*amount,.90,.064],sideRotation);
      }
      arm(p,side,wrist,pole,fingers);
    }
    return p;
  };
}
