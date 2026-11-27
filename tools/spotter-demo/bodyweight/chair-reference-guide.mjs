import { add, arm, blend, leg, mix, rep, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.max(0, Math.min(1, value));

function scaleFromGuide(frames, read) {
  const values = frames.map(read);
  const lows = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - lows);
  return f => clamp((read(f) - lows) / width);
}

function neck(p, phase, profile) {
  const movement = rep(phase, .40, .62);
  const breathing = .009 * Math.sin(4 * Math.PI * phase);
  const swing = Math.sin(2 * Math.PI * phase);
  let yaw = 0;
  let pitch = 0;
  let tilt = 0;
  let forward = 0;
  switch (profile.action) {
    case "assistedRotation": yaw = .84 * movement; break;
    case "headDown": pitch = .89 * movement; break;
    case "diagonal": yaw = .69 * movement; pitch = .83 * movement; tilt = .055 * movement; break;
    case "nod": pitch = .75 * swing; break;
    case "extension": pitch = -(profile.angle ?? .79) * movement; break;
    case "extensionSide": pitch = -.51 * movement; tilt = .56 * movement; break;
    case "extensionTurn": yaw = -.64 * movement; pitch = -.66 * movement; break;
    case "protraction": forward = .099 * movement; break;
    case "lateral": tilt = .66 * movement; break;
    case "turn": yaw = 1.02 * swing; break;
    case "iso": forward = .016 * movement; break;
    case "tap": yaw = -.093 * movement; break;
  }
  p.head[0] += .124 * Math.sin(tilt);
  p.head[1] -= .051 * Math.abs(pitch) + .043 * Math.abs(tilt);
  p.head[2] += forward + .036 * pitch;
  p.neck[2] += forward;
  p.headAim = [Math.sin(tilt), Math.cos(pitch) * Math.cos(tilt), Math.sin(pitch)];
  p.headTurn = yaw;
  p.headDrop = breathing;
  return { movement, yaw, pitch, tilt };
}

export function chairReferenceGuideMotion(guide, profile) {
  const { frames } = guide;
  const guideArm = [4, 6].map(i => scaleFromGuide(frames, f => Math.hypot(f[i][0] - frames[0][i][0], f[i][1] - frames[0][i][1])));
  const guideFeet = [8, 10].map(i => scaleFromGuide(frames, f => Math.hypot(f[i][0] - frames[0][i][0], f[i][1] - frames[0][i][1])));
  const guideChest = scaleFromGuide(frames, f => f[1][1] - f[2][1]);
  const { mode, active = 1 } = profile;

  return phase => {
    const f = guideAt(frames, phase);
    const time = phase * 2 * Math.PI;
    const swing = Math.sin(time);
    const envelope = rep(phase, .36, .60);
    const breathing = .007 * Math.sin(time * 2);
    const leaned = mode === "fold" ? 1.49 * Math.max(guideChest(f) - guideChest(frames[0]), 0) * .40 + 1.02 * envelope
      : mode === "leanBack" ? -.268 * envelope : mode === "swim" ? .235 : mode === "patella" || mode === "toeHand" ? .35
        : mode === "cross" && profile.back ? -.090 * envelope : mode === "rhomboid" ? .244 * envelope : .027;
    const yaw = mode === "twist" ? .94 * swing : mode === "chop" || mode === "uppercut" ? .46 * swing : 0;
    const torsoRig = stand([0, profile.kneel ? .548 : .611, profile.kneel ? -.159 : .024], mode === "posture" ? leaned + .082 * envelope : leaned, yaw);
    const head = mode === "neck" ? neck(torsoRig, phase, profile) : null;
    const crossed = mode === "toeHand";
    const single = active > 0 ? "l" : "r";
    const other = active > 0 ? "r" : "l";
    const activeFoot = active > 0 ? 0 : 1;
    const contraction = Math.max(.66 * envelope, guideFeet[activeFoot](f));
    const upperOffset = mode === "cross" || mode === "fly" ? .032 * envelope : 0;
    if (mode === "nerve") {
      torsoRig.head[0] -= active * .067 * envelope;
      torsoRig.head[1] -= .038 * envelope;
      torsoRig.headAim = [-active * .19 * envelope, 1, .034];
    }
    if (mode === "sciatic") neck(torsoRig, phase, { action: "nod" });

    for (const [side, sign] of sides) {
      if (profile.kneel) {
        torsoRig[side + "k"] = [sign * .126, .132, -.144];
        torsoRig[side + "a"] = [sign * .126, .110, -.566];
        torsoRig[side + "t"] = [sign * .133, .060, -.679];
        continue;
      }
      const working = active === sign;
      let ankle = [sign * .142, .090, .443];
      let pole = [sign * .115, .075, .98];
      let toe = [sign * .021, -.067, .126];
      let planted = true;
      if (mode === "rotateHip" && working) {
        const angle = profile.angle * contraction;
        const knee = [sign * .144, .510, .431];
        ankle = add(knee, [sign * .423 * Math.sin(angle), -.423 * Math.cos(angle), .014]);
        torsoRig[side + "k"] = knee;
        torsoRig[side + "a"] = ankle;
        torsoRig[side + "t"] = add(ankle, [sign * .053 * Math.sin(angle), -.065, .123]);
        continue;
      }
      if (mode === "hipsOpen") {
        const knee = add(torsoRig[side + "h"], [sign * (.034 + .187 * contraction), -.114, Math.sqrt(.405 ** 2 - (.034 + .187 * contraction) ** 2)]);
        torsoRig[side + "k"] = knee;
        torsoRig[side + "a"] = add(knee, [-sign * .033, profile.air ? -.325 : -.399, profile.air ? -.268 : .083]);
        torsoRig[side + "t"] = add(torsoRig[side + "a"], toe);
        if (!profile.air) torsoRig.planted[side] = 0;
        continue;
      }
      if (working && ["kneeExtend", "legRaise", "ankleFlex", "footTurn", "toes", "patella", "sciatic"].includes(mode)) {
        if (mode === "kneeExtend" || mode === "legRaise") {
          const hip = torsoRig[side + "h"];
          const tilt = mode === "legRaise" ? -.23 + .331 * contraction : -.157;
          const shin = mode === "legRaise" ? tilt - .03 : -1.508 + 1.34 * contraction;
          const knee = add(hip, [sign * .038, .420 * Math.sin(tilt), .420 * Math.cos(tilt)]);
          ankle = add(knee, [sign * .009, .424 * Math.sin(shin), .424 * Math.cos(shin)]);
          torsoRig[side + "k"] = knee;
          torsoRig[side + "a"] = ankle;
          torsoRig[side + "t"] = add(ankle, [sign * .014, -.056, .131]);
          continue;
        }
        if (mode === "footTurn") {
          ankle = [sign * .144, .142, .465];
          toe = [sign * .091 * swing, -.055, .124];
        } else if (mode === "ankleFlex") {
          ankle = [sign * .146, .115, .698];
          const angle = .08 + profile.angle * envelope;
          toe = [sign * .013, .137 * Math.sin(angle), .138 * Math.cos(angle)];
        } else if (mode === "sciatic") {
          ankle = [sign * .145, .413, .761];
          toe = [sign * .011, .130 * swing, .128];
        } else {
          ankle = [sign * .141, .094, .683];
          toe = [sign * .014, -.037, .137];
        }
        planted = false;
      } else if (mode === "calf") {
        ankle = working ? [sign * .146, .089 + .093 * envelope, .440 + .075 * envelope]
          : [sign * .140, .163, .328];
        toe = working ? [sign * .019, .018 - ankle[1], .565 - ankle[2]] : toe;
        planted = working;
      }
      if (crossed && working) continue;
      leg(torsoRig, side, ankle, pole, toe, planted ? 0 : undefined);
      if (mode === "footTurn" && working) torsoRig[side + "FootRoll"] = profile.angle * swing;
      if (mode === "toes" && (working || profile.both)) torsoRig[side + "ToeFlex"] = profile.angle * envelope;
    }

    if (crossed) {
      const ankle = add(torsoRig[other + "k"], [active * .047, .073, .053]);
      leg(torsoRig, single, ankle, [active, .091, .097],
        [-active * .131, -.036 * (1 + profile.angle * envelope), .047]);
      torsoRig[single + "ToeFlex"] = profile.angle * envelope;
      torsoRig[single + "FootRoll"] = (profile.roll ?? 0) * envelope;
    }

    for (const [side, sign] of sides) {
      const shoulder = torsoRig[side + "s"];
      const working = sign === active;
      let wrist = profile.kneel ? [sign * .145, .571, .082] : add(torsoRig[side + "k"], [sign * .024, .079, -.013]);
      let pole = [sign * .771, -.43, -.42];
      let fingers = [sign * .029, -.224, .977];
      let palm = [sign * .065, 1, .054];
      const grip = guideArm[sign > 0 ? 0 : 1](f);
      if (head && profile.touch && (working || profile.touch === "two" || profile.touch === "rotate" || profile.touch === "clasp")) {
        const { movement } = head;
        let target = add(torsoRig.head, [sign * .102, .038, -.079]);
        if (profile.touch === "rotate" && working) target = add(torsoRig.head, [sign * .082, -.052, .121]);
        if (profile.touch === "tap") target = add(torsoRig.neck, [sign * .117, -.023, -.018]);
        if (profile.touch === "clasp") target = add(torsoRig.head, [sign * .056, .043, -.116]);
        wrist = blend(wrist, target, Math.max(movement, profile.touch === "clasp" ? .84 : .16 + .10 * grip));
        pole = [sign * .87, .033, -.489];
        fingers = [-sign * .783, .192, .591];
      } else if (mode === "cross" || mode === "openUnder") {
        const start = add(shoulder, [sign * .584, .018, .075]);
        const opposite = sign > 0 ? "r" : "l";
        const hug = add(torsoRig[opposite + "s"], [sign * .026, sign * .069, .089]);
        const swingIn = profile.back ? 1 - envelope : envelope;
        wrist = blend(start, hug, swingIn);
        if (mode === "openUnder") {
          wrist = blend(start, [sign * -.065, .711 + .089 * sign, .423], envelope);
          wrist[1] += .39 * Math.max(0, swing);
        }
        pole = [sign * .71, -.51 + upperOffset, -.38];
        fingers = [sign * (1 - 2 * swingIn), -.053, .270];
      } else if (mode === "clam") {
        wrist = add(torsoRig.head, [sign * .081, .028, -.110]);
        pole = [sign * mix(.28, .96, envelope), -.234, mix(.91, -.28, envelope)];
        fingers = [-sign * .85, .089, .38];
      } else if (mode === "press") {
        const rise = (profile.angle ?? 0) * envelope;
        wrist = add(torsoRig.chest, [sign * .035, .051 + rise, .225 + .379 * envelope]);
        pole = [sign * .876, -.052, -.415];
        fingers = [sign * .083, .653 - .47 * envelope, .71 + .24 * envelope];
        palm = [-sign, .075, -.038];
      } else if (mode === "fly") {
        const close = envelope * (profile.high ? 1 : .91);
        const elbow = add(shoulder, [sign * mix(.238, -.158, close), profile.high ? -.010 : -.092, mix(.066, .186, close)]);
        torsoRig[side + "e"] = elbow;
        torsoRig[side + "w"] = add(elbow, [sign * .007, .346, .118]);
        torsoRig[side + "Fingers"] = [sign * .023, .999, .036];
        torsoRig[side + "PalmSide"] = [-sign, 0, 0];
        continue;
      } else if (mode === "prayer") {
        wrist = add(torsoRig.chest, [sign * .031, -.006 + .018 * swing, .249 + .032 * envelope]);
        pole = [sign * .946, -.266, -.038];
        fingers = [0, .999, .038];
        palm = [-sign, 0, 0];
      } else if (mode === "rhomboid") {
        wrist = add(torsoRig.chest, [sign * .038, .076, .272 + .335 * envelope]);
        pole = [sign * .79, -.615, -.044];
        fingers = [-sign * .87, .056, .49];
      } else if (mode === "behind" || mode === "retract") {
        wrist = mode === "behind" ? add(torsoRig.hips, [sign * .065, -.086 + .284 * envelope, -.281 - .248 * envelope])
          : add(shoulder, [sign * .096, profile.bent ? -.256 : -.536, .025 - .162 * envelope]);
        pole = [sign * .89, -.517, -.035 - .56 * envelope];
        fingers = mode === "behind" ? [-sign * .876, .066, -.474] : [0, -.47, .873];
      } else if (mode === "leanBack" || mode === "twist") {
        wrist = add(torsoRig[sign > 0 ? "rs" : "ls"], [-sign * .066, -.112, .132]);
        pole = [sign * .60, -.774, -.044];
        fingers = [-sign * .89, .325, .233];
      } else if (mode === "swim") {
        const forward = (1 + sign * swing) * .5;
        wrist = add(shoulder, [sign * .057, -.481 + forward * .434, -.319 + .912 * forward]);
        fingers = [0, -.067, forward * 2 - 1 + .007];
        if (Math.abs(fingers[2]) < .025) fingers[1] = -.99;
      } else if (mode === "chop") {
        wrist = add(torsoRig.chest, [sign * .034 + .472 * swing, .388 * swing, .297]);
        pole = [sign * .91, -.22, -.299];
        fingers = [swing * .51, swing * .61, .605];
      } else if (mode === "uppercut") {
        const peak = Math.max(0, sign * swing);
        wrist = add(torsoRig.neck, [sign * (.115 - .05 * peak), -.089 + .318 * peak, .228 + .195 * peak]);
        fingers = [sign * .026, .951, .208];
        torsoRig[side + "FingerCurl"] = .99;
      } else if (mode === "nerve" && working) {
        if (profile.action === "ulnar") {
          wrist = blend(add(torsoRig.head, [sign * .184, -.057, .108]), add(shoulder, [sign * .233, -.179, .184]), envelope);
          pole = [sign * .882, .129, -.423];
          fingers = [sign * -.97, -.124, .22];
        } else {
          const lateral = profile.action === "median";
          wrist = add(shoulder, [sign * (.198 + .389 * envelope), lateral ? -.079 : -.445 * envelope, .123 - .094 * envelope]);
          fingers = [sign * .895, (lateral ? -.42 : .42) * envelope, .224];
          palm = [0, lateral ? -1 : .9, .017];
        }
      } else if (mode === "elbow" && working) {
        const elbow = add(shoulder, [sign * .061, -.244, .022]);
        torsoRig[side + "e"] = elbow;
        torsoRig[side + "w"] = add(elbow, [sign * .022, mix(.24, -.366, envelope), Math.sqrt(.371 ** 2 - mix(.24, -.366, envelope) ** 2)]);
        torsoRig[side + "Fingers"] = [0, -.793, .60];
        continue;
      } else if (mode === "hipsOpen") {
        wrist = profile.air ? [sign * .219, .516, .111] : add(torsoRig[side + "k"], [sign * .065, .025, .004]);
        fingers = [0, -.998, .043];
      } else if (mode === "fold") {
        wrist = blend(wrist, [sign * .119, .182 + .071 * (1 - envelope), .536], envelope);
        fingers = [0, -.993, .055];
      } else if (mode === "patella") {
        wrist = add(torsoRig[single + "k"], [sign * .058, .059, .035 + .025 * swing]);
        fingers = [sign * -.49, -.70, .516];
      } else if (crossed) {
        const frontToe = torsoRig[single + "t"];
        const hand = working ? frontToe : blend(frontToe, torsoRig[single + "a"], .58);
        wrist = add(hand, [sign * .009, .020 + .034 * profile.angle * envelope, .013]);
        fingers = [-sign * .65, -.741, .194];
        torsoRig[side + "FingerCurl"] = working ? .53 : .34;
      }
      arm(torsoRig, side, wrist, pole, fingers, palm);
    }
    return torsoRig;
  };
}
