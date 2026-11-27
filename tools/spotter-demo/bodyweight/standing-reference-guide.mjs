import { add, arm, blend, leg, mix, rep, scale, sides, stand, subtract, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.max(0, Math.min(1, value));
const circle = Math.PI * 2;
const rotate = ([x, y, z], angle) => [x * Math.cos(angle) + z * Math.sin(angle), y, z * Math.cos(angle) - x * Math.sin(angle)];

function guideRange(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return f => clamp((read(f) - low) / width);
}

export function standingReferenceGuideMotion(guide, profile) {
  const { frames } = guide;
  const { kind, stance, arms } = profile;
  const readPitch = guideRange(frames, f => f[1][1] - f[2][1]);
  const readShift = guideRange(frames, f => f[1][0] - f[2][0]);
  const readHand = [4, 6].map(i => guideRange(frames, f => -f[i][1]));
  const readLift = [8, 10].map(i => guideRange(frames, f => -f[i][1]));
  const profileSide = profile.side ?? 1;

  return phase => {
    const f = guideAt(frames, phase);
    const wave = Math.sin(phase * circle);
    const envelope = rep(phase, .37, .63);
    const direction = profile.alternates ? Math.sign(wave) || 1 : profileSide;
    const active = direction > 0 ? "l" : "r";
    const opposite = active === "l" ? "r" : "l";
    const guideBend = clamp(readPitch(f) - readPitch(frames[0]));
    const guideDrift = (readShift(f) - readShift(frames[0])) * 2;
    const portion = profile.alternates ? Math.abs(wave) : envelope;
    const fixed = profile.static ? .009 * Math.sin(phase * circle * 2) : 0;
    const cycles = profile.cycles ?? 1;
    const cycle = circle * phase * cycles;
    const [width, forwardWidth] = stance === "wide" ? [.445, .002] : stance === "split" || stance === "lunge" ? [.121, .355] : [.144, .003];
    const isHinge = ["hinge", "windmill", "overSide", "twistHinge", "windTouch", "fly", "swing"].includes(kind);
    const singleLeg = ["singleHinge", "kneeDrive", "legSwing", "star", "hipRoll", "sideKick"].includes(kind);
    let hipY = .907 + fixed;
    let hipX = 0;
    let hipZ = -.023;
    let pitch = .036;
    let yaw = 0;
    let roll = 0;
    if (isHinge) {
      const preset = profile.pitch ?? (kind === "windmill" || kind === "windTouch" ? 1.83 : 1.32);
      const start = profile.base ?? 0;
      pitch = .025 + mix(start, preset, Math.min(1, portion * .87 + guideBend * .13));
      hipY -= .12 * portion * (stance === "wide" ? 1.15 : .67);
      hipZ -= .13 * portion;
    }
    if (kind === "upperTurn" || kind === "twistHinge" || kind === "windmill" || kind === "windTouch" || kind === "lowTurn") {
      yaw = (profile.yawRange ?? .878) * direction * portion;
      if (kind === "windTouch" && profile.clasp) yaw *= .72;
      if (kind === "lowTurn") hipX = .141 * direction * portion;
    }
    if (kind === "side" || kind === "overSide" || kind === "sideTwist") {
      roll = (profile.roll ?? .44) * direction * portion;
      hipX -= .102 * direction * portion;
      if (kind === "sideTwist") yaw = -.53 * direction * portion;
    }
    if (kind === "leanBack" || kind === "ceiling") {
      pitch = -.055 - (profile.pitch ?? .38) * envelope;
      hipZ += .114 * envelope;
    }
    if (kind === "upperRound") {
      pitch += .23 * envelope;
      hipZ -= .058 * envelope;
    }
    if (kind === "hipCircle" || kind === "kneeCircle") {
      const radius = kind === "hipCircle" ? .148 : .066;
      hipX += radius * Math.sin(cycle);
      hipZ += radius * (Math.cos(cycle) - 1) * .82;
      hipY -= kind === "hipCircle" ? .04 : .139 + .025 * Math.sin(cycle);
      pitch += kind === "kneeCircle" ? .50 : .096 * Math.cos(cycle);
    }
    if (singleLeg) {
      hipX -= direction * (.095 + .035 * portion);
      if (kind === "kneeDrive") {
        yaw = -.72 * direction * portion;
        roll = .32 * direction * portion;
        pitch += .52 * portion;
      }
      if (kind === "singleHinge") {
        pitch = (profile.pitch ?? 1.67) * portion;
        yaw = (profile.cross ? -.53 : .092) * direction * portion;
        hipY -= .113 * portion;
        hipZ -= .104 * portion;
      }
    }
    if (kind === "squatTwist" || kind === "sideKick") {
      const drop = kind === "sideKick" ? Math.max(0, Math.cos(cycle)) : envelope;
      hipY -= .348 * drop;
      hipZ -= .18 * drop;
      pitch += (kind === "squatTwist" ? 1.16 : .435) * drop;
      if (kind === "squatTwist") {
        yaw = .86 * direction * drop;
        roll = .37 * direction * drop;
      }
    }
    if (kind === "calf") hipY += .019 + .120 * envelope;
    if (kind === "gluteContract") {
      hipZ -= .04 * (1 - envelope);
      pitch += .046 * (1 - envelope);
    }
    if (kind === "splitPose") {
      hipY -= .49 * envelope;
      pitch += .91 * envelope;
      hipZ -= .028 * envelope;
      yaw += .77 * direction * envelope;
    }
    if (kind === "vacuum") hipZ += .051*envelope;
    if (kind === "splitHinge") {
      pitch = .025 + (profile.pitch ?? 1.15) * envelope;
      hipY -= .17 * envelope;
      hipZ -= .045 * envelope;
    }
    const p = stand([hipX, hipY, hipZ], pitch, yaw, roll);
    if (kind === "ceiling" || kind === "leanBack") p.headAim = [0, Math.cos(pitch - .34 * envelope), Math.sin(pitch - .34 * envelope)];
    if (kind === "upperRound" || arms === "dangle") {
      const curl = pitch + .244 * envelope;
      p.headAim = [0, Math.cos(curl), Math.sin(curl)];
    }
    if (kind === "posture" || kind === "vacuum") {
      p.chest[1] += (kind === "vacuum" ? .053 * envelope : fixed);
      p.neck[1] += kind === "vacuum" ? .035*envelope : fixed;
      if (kind === "vacuum") for (const [s] of sides) p[s+"s"][1]+=.042*envelope;
    }

    for (const [side, sign] of sides) {
      const working = sign === direction;
      let ankle = [sign * width, .087, forwardWidth * sign * direction];
      let toe = [sign * .022, -.064, .127];
      let pole = [sign * (stance === "wide" ? .34 : .13), .029, .98];
      let planted = true;
      if (stance === "cross" && working) ankle = [-sign * .26, .095, .147];
      if (stance === "lunge" || kind === "splitPose") {
        ankle = [sign * .152, working ? .091 : .182, working ? .36 + .142 * envelope : -.21 - .428 * envelope];
        if (!working) toe = [sign * .012, -.154, .086];
      }
      if (kind === "splitHinge" && working && profile.toeUp) {
        ankle[1] = .097;
        toe = [sign * .012, .091, .119];
        planted = false;
      }
      if (kind === "singleHinge" && working) {
        const angle = pitch * .91;
        const radius = .834;
        ankle = [hipX + sign * .145, Math.max(.115, hipY - radius * Math.cos(angle)), hipZ - radius * Math.sin(angle)];
        toe = blend(toe, [sign * .023, -.112, -.054], portion);
        planted = portion < .025;
      } else if (kind === "kneeDrive" && working) {
        const knee = portion * (.86 + .14 * readLift[sign > 0 ? 0 : 1](f));
        ankle = [sign * (.137 - .194 * knee), .087 + .697 * knee, -.013 + .397 * knee];
        pole = [-sign * .095, .917, .352];
        planted = knee < .019;
      } else if (kind === "star" && working) {
        const quarter = Math.min(2, Math.floor(phase * 3));
        const reach = Math.sin(Math.PI * ((phase * 3) % 1));
        const target = [[sign * .238, .089, .492], [sign * .602, .089, .026], [sign * .211, .111, -.506]][quarter];
        ankle = blend(ankle, target, reach);
        ankle[1] += .062 * Math.sin(reach * Math.PI);
        pole = [sign * .285, .062, .953];
        planted = reach > .985 || reach < .01;
      } else if ((kind === "legSwing" || kind === "hipRoll") && working) {
        const spin = Math.cos(cycle);
        const out = kind === "hipRoll" ? .29 + Math.max(0, .47 * Math.sin(cycle)) : .062;
        ankle = profile.hipOpen ? [sign * (.13 + .47 * out), .116 + .368 * envelope, .086 + .329 * Math.cos(out) * envelope]
          : [sign * (.142 + .197 * out), .115 + .392 * Math.abs(spin), .125 + .423 * spin];
        pole = [sign * out, .85, .32];
        if(profile.ankleCircle) toe=[sign*.070*Math.sin(cycle),-.055+.083*Math.cos(cycle),.118];
        planted = false;
      } else if (kind === "sideKick" && working && portion > 0) {
        ankle = [sign * (.17 + .631 * portion), .090 + .518 * portion, .027];
        pole = [sign * .83, .049, .595];
        planted = false;
      } else if (kind === "calf") {
        ankle[1] += .121 * envelope;
        ankle[2] += .050 * envelope;
        toe = [sign * .019, .015 - ankle[1], .168 - ankle[2]];
      } else if (kind === "toes") {
        p[side + "ToeFlex"] = .615 * Math.sin(cycle);
        ankle[1] += .008 * Math.sin(cycle);
      }
      if (kind === "kneeCircle") pole = [sign * .165 + .595 * Math.sin(cycle), .092, .788 + .199 * Math.cos(cycle)];
      leg(p, side, ankle, pole, toe, planted ? 0 : undefined);
    }

    for (const [side, sign] of sides) {
      const working = sign === direction;
      const shoulder = p[side + "s"];
      const handElevation = readHand[sign > 0 ? 0 : 1](f);
      let wrist = add(shoulder, [sign * .057, -.591, .067]);
      let pole = [sign * .66, -.65, -.33];
      let fingers = [sign * .03, -.953, .30];
      const lateral = add(shoulder, rotate([sign * .598, .022, .077], yaw));
      const handUp = add(shoulder, rotate([sign * .093, .602, .051], yaw));
      if (arms === "claspBack" || arms === "backRaise") {
        wrist = add(p.hips, [sign * .045, .093 + (arms === "backRaise" ? .291 * envelope : .021), -.271 - .102 * envelope]);
        pole = [sign * .70, -.351, -.623];
        fingers = [-sign * .93, .075, -.35];
      } else if (arms === "wrap") {
        const hug = add(p[sign > 0 ? "rs" : "ls"], [sign * .015, -sign * .093, .117]);
        wrist = blend(lateral, hug, envelope);
        fingers = [sign * (1 - 2 * envelope), -.081, .326];
      } else if (arms === "claspFront" || arms === "reachFront" || arms === "guard") {
        const amount = arms === "guard" ? .275 : .359 + .206 * envelope;
        wrist = add(p.chest, rotate([sign * (arms === "reachFront" ? .167 : .035), .106, amount], yaw));
        pole = [sign * .86, -.47, -.065];
        fingers = arms === "reachFront" ? [0, -.035, .998] : [-sign * .86, .14, .48];
      } else if (arms === "circle") {
        const radius = .068 + .139 * envelope;
        wrist = add(lateral, [0, radius * Math.sin(cycle), radius * Math.cos(cycle)]);
        fingers = [sign, .054, .057];
      } else if (arms === "arc" || arms === "fly" || arms === "swing" || arms === "throw") {
        if (arms === "arc") {
          const theta = cycle - Math.PI / 2;
          wrist = add(shoulder, [sign * (.055 + .547 * Math.abs(Math.cos(theta))), -.077, .522 * Math.sin(theta)]);
        } else if (arms === "fly") {
          wrist = add(shoulder, [sign * (.067 + .518 * envelope), -.585 + .537 * envelope, .046 - .025 * envelope]);
        } else if (arms === "swing") {
          wrist = add(p.hips, [sign * .070, .056 + .783 * (1 - envelope), mix(.546, -.362, envelope)]);
        } else {
          const reach = Math.min(1, .87 * portion + .13 * handElevation);
          wrist = add(shoulder, rotate([sign * .089, -.528 + .739 * reach, -.237 + .733 * reach], yaw));
        }
        fingers = unit(add(wrist, [-shoulder[0], -shoulder[1], -shoulder[2]]));
      } else if (arms === "open") {
        wrist = lateral;
        fingers = [sign, .035, .062];
      } else if (arms === "windmill" || arms === "oppositeToe") {
        const reach = add(p[(arms === "windmill" ? side : opposite) + "t"], [sign * .035, .074, .042]);
        const starthigh = profile.oneUp && working ? handUp : lateral;
        wrist = blend(starthigh, working ? [shoulder[0] + sign * .052, shoulder[1] + .59, shoulder[2] - .091] : reach, portion);
        fingers = [0, working ? .984 : -.996, .086];
      } else if (arms === "singleFoot") {
        wrist = profile.cross && working ? handUp : blend(lateral, add(p[opposite + "t"], [sign * .028, .077, .011]), portion);
        fingers = [sign * .051, -.987, .15];
      } else if (arms === "over" || arms === "oneUp" || arms === "long") {
        const leaning = kind === "side" || kind === "overSide" || kind === "sideTwist";
        if (arms === "long") wrist = add(shoulder, [sign * .022, .593 * Math.cos(pitch), .590 * Math.sin(pitch)]);
        else if (arms === "over" || working) wrist = add(handUp, [leaning ? direction * .294 * portion : 0, -.048 * portion, -.156 * Number(kind === "ceiling") * portion]);
        else wrist = add(p.hips, [sign * .154, .055, .086]);
        fingers = [leaning ? direction * .371 * portion : .013, arms === "oneUp" && !working ? -.971 : .985, .096];
      } else if (arms === "hips" || arms === "backHips") {
        wrist = add(p.hips, [sign * .155, .042, arms === "backHips" ? -.104 : .092]);
        if (kind === "sideKick" && portion > 0) {
          const target = add(p[active + "a"], [-sign * .042, .067, .065]);
          wrist = working ? blend(wrist, target, portion) : add(shoulder, [sign * .31 * portion, -.49, .081]);
        }
        fingers = [-sign * .76, -.606, arms === "backHips" ? .078 : -.19];
      } else if (arms === "brain") {
        wrist = add(p.head, [sign * .082, .048, -.131]);
        pole = [sign * .973, -.031, .222];
        fingers = [-sign * .72, .149, .647];
        if(kind==="kneeDrive"&&!working){
          const knee=add(p[active+"k"],[direction*.026,.021,.021]);
          pole=blend(pole,unit(subtract(knee,shoulder)),portion);
          const e=add(shoulder,scale(unit(subtract(knee,shoulder)),.252));
          const point=add(e,scale(unit(subtract(wrist,e)),.371));
          wrist=blend(wrist,point,portion);
        }
      } else if (arms === "knees") {
        wrist = add(p[side + "k"], [sign * .027, .059, .077]);
        fingers = [0, -.97, .203];
      } else if (arms === "behindAssisted") {
        wrist = add(p.hips, [working ? direction * -.06 : direction * -.069, .105 + .244 * envelope - (working ? .03 : -.09), -.213]);
        pole = [sign * .90, -.409, -.072];
        fingers = [0, working ? .995 : -.986, .10];
      } else if (arms === "prayer" || arms === "turnPrayer") {
        const knee = p[active + "k"];
        const down = arms === "turnPrayer" ? portion : 0;
        const contact=add(knee,[direction*.034,.063,.012]);
        wrist = blend(add(p.chest, rotate([sign * .027, .079, .254], yaw)), add(contact, [sign*.025-direction*.165,.185,.052]), down);
        pole=blend(pole,unit(subtract(contact,shoulder)),down*Number(!working));
        fingers = [direction * .131 * portion, .982, .053];
        if (!working && down > 0) {
          const resting = unit(subtract(wrist, shoulder));
          const pinch = unit(subtract(contact, shoulder));
          const toward = unit(blend(resting, pinch, down));
          const forearm = unit(subtract(wrist, add(shoulder,scale(toward,.252))));
          p[side+"e"] = add(shoulder,scale(toward,.252));
          p[side+"w"] = add(p[side+"e"],scale(forearm,.371));
          p[side+"Fingers"] = fingers;
          continue;
        }
      }
      arm(p, side, wrist, pole, fingers);
    }
    if (kind === "lowTurn") p.headTurn = .246 * guideDrift;
    return p;
  };
}
