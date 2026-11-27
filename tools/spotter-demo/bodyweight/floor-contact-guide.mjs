import { add, arm, blend, leg, mix, sides, stand, torso } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const deck = .024;
const clamp = n => Math.max(0, Math.min(1, n));

function normalize(frames, sample) {
  const values = frames.map(sample);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((sample(frame) - low) / span);
}

function rollingBridge(frame, phase, trace, profile) {
  const mode = profile.mode;
  const rise = trace.hipHigh(frame);
  const ankleWiden = trace.width(frame);
  const lifted = trace.wrists.map(read => read(frame));
  const sideTravel = trace.hipSide(frame) * 2 - 1;
  const hold = profile.breathe ? .013 * Math.sin(phase * 4 * Math.PI) : 0;
  const turn = mode === "tableTurn" || mode === "thoracic";
  const tabletop = mode !== "dip" && mode !== "crab" && mode !== "crabKick";
  const sideTurn = profile.alternate && lifted[1] > lifted[0] ? -1 : 1;
  const tableRise = tabletop && mode !== "table" && mode !== "thoracic" ? Math.max(.91, rise) : rise;
  const kicking = mode === "crabKick" ? Math.max(...trace.ankles.map(read => read(frame))) : 0;
  const pelvis = [0, (mode === "dip" ? mix(profile.deep ? .210 : .280, .435, rise) : mix(.165, .509, tableRise)) + hold - .17 * kicking, -.085];
  const angle = mode === "dip" ? -.88 + .25 * rise : mix(-.725, -1.455, tableRise) + .55 * kicking;
  const twist = mode === "crabKick" ? .61 * sideTravel : turn ? sideTurn * .82 * Math.max(...lifted) : 0;
  const pose = torso(pelvis, angle, twist);
  pose.headDrop = tabletop ? .037 : .022;
  for (const [side, sign] of sides) {
    const x = sign * (mode === "tableJack" ? .128 + .274 * ankleWiden : .140);
    const kick = mode === "crabKick" ? trace.ankles[sign > 0 ? 0 : 1](frame) : 0;
    const hop = mode === "tableJack" ? .118 * trace.ankles[sign > 0 ? 0 : 1](frame) : 0;
    const ankle = [x, .109 + .725 * kick + hop, .503 - .541 * kick];
    leg(pose, side, ankle, [sign * .20, .965, -.031], [sign * .017, -.067, .132], kick < .012 && hop < .013 ? deck : undefined);
  }
  for (const [side, sign] of sides) {
    const opponent = sign > 0 ? "r" : "l";
    const shoulder = pose[side + "s"];
    const fixed = [sign * .217, .067, -.603];
    const reaches = mode === "crabKick" ? trace.ankles[sign > 0 ? 1 : 0](frame) : 0;
    const over = sideTurn === sign ? Math.max(...lifted) : 0;
    const target = mode === "crabKick" ? blend(fixed, add(pose[opponent + "t"], [sign * .021, .040, -.082]), reaches)
      : turn ? blend(fixed, add(shoulder, [-sign * .29, .525, .054]), over) : fixed;
    const pole = turn && sideTurn === sign ? [sign * .438, .58, -.602] : [sign * .346, -.453, -.79];
    arm(pose, side, target, pole, reaches > .035 ? [-sign * .33, -.075, .93] : [0, -.034, .999]);
  }
  return pose;
}

function frontSupport(frame, trace, profile) {
  const mode = profile.mode;
  const rise = trace.hipHigh(frame);
  const depth = 1 - trace.upperHigh(frame);
  const roll = trace.torsoSide(frame) * 2 - 1;
  const hands = trace.wrists.map(read => read(frame));
  const release = mode === "through" ? Math.min(1, Math.max(-1, (frame[6][1] - frame[4][1]) / 107)) : 0;
  const forearm = mode === "forearmPike" || mode === "kneeBridge" || mode === "sideRoll";
  const walking = mode === "sidePress" || mode === "handWalk";
  const lateral = walking ? .384 * trace.hipSide(frame) - .192 : mode === "wiper" ? .247 * roll : 0;
  const trunkY = mode === "forearmPike" ? .285 + .514 * rise : mode === "triceps" ? .225 + .318 * (1 - depth)
    : mode === "kneeBridge" ? .286 + .062 * rise : mode === "sideRoll" ? .343 + .040 * Math.abs(roll)
    : mode === "pikeCobra" ? .210 + .58 * rise : mode === "kneelPower" ? .285 + .153 * (1 - depth)
    : mode === "superPush" ? .129 + .446 * rise : mode === "bridge" ? .365 + .218 * rise
    : mode === "plankJump" ? .563 + .027 * depth : mode === "thrust" ? .563 + .047 * rise
    : mode === "through" ? .212 + .352 * (1 - depth) - .243 * Math.abs(release)
    : .197 + .364 * (1 - depth);
  const pitch = mode === "forearmPike" ? 1.46 + 1.155 * rise : mode === "triceps" ? 1.55 - .15 * (1 - depth)
    : mode === "kneeBridge" ? 1.62 : mode === "pikeCobra" ? .22 + 2.37 * rise : mode === "superPush" ? 1.75 - .365 * rise
    : mode === "thrust" ? 1.40 - .259 * rise : mode === "kneelPower" ? 1.52 - .267 * (1 - depth) : 1.43;
  const supportTurn = mode === "sideRoll" ? roll * 1.395 : mode === "through" ? -1.27 * release : 0;
  const center = [lateral, trunkY, mode === "pikeCobra" ? .113 - .372 * rise : -.211];
  const pose = torso(center, pitch, supportTurn);
  if (mode === "sideRoll") pose.headAim = [roll * .62, .08, .777];
  for (const [side, sign] of sides) {
    const index = sign > 0 ? 0 : 1;
    const foot = frame[8 + index * 2];
    const airborne = trace.ankles[index](frame);
    const bentKnee = mode === "thrust" ? rise : 0;
    const supportWidth = mode === "sideRoll" ? .035 + (1 - Math.abs(roll)) * .136 : .143;
    const footZ = center[2] - Math.sqrt(Math.max(.001, .832 ** 2 - (center[1] - .150) ** 2));
    let toe = [sign * .012, -.123, .073];
    let ankle = [lateral + sign * supportWidth, .150, footZ];
    let pole = [sign * .12, -.93, .23];
    let planted = true;
    if (mode === "kneeBridge" || mode === "kneelPower") {
      const kneeZ = center[2] - Math.sqrt(Math.max(.04, .416 ** 2 - (center[1] - .114) ** 2));
      const knee = [lateral + sign * .129, .114, kneeZ];
      pose[side + "k"] = knee;
      pose[side + "a"] = add(knee, [sign * .013, .233, -.353]);
      pose[side + "t"] = add(pose[side + "a"], [sign * .015, -.032, -.119]);
    } else if (mode === "through") {
      const reach = sign * release < 0 ? Math.abs(release) : 0;
      ankle = blend(ankle, [-sign * .734, .160, .057], reach);
      pole = [sign * .335, -.522, .786];
      planted = reach < .020;
    } else if (mode === "plankJump") {
      const slide = .451 * (trace.hipSide(frame) * 2 - 1);
      ankle = [sign * supportWidth + slide, ankle[1] + .077 * airborne, footZ];
      planted = airborne < .02;
    } else if (mode === "thrust") {
      ankle = blend(ankle, [sign * .288, .109, .355], bentKnee);
      toe = blend(toe, [sign * .023, -.065, .121], bentKnee);
      pole = [sign * .565, .293, .902];
    } else if (mode === "pikeCobra") {
      ankle = [sign * .132, .105, mix(-.708, -.571, rise)];
      toe = [sign * .017, -.061, .131 - .234 * (1 - rise)];
      pole = [sign * .142, -.985, .21 + .40 * rise];
      if (rise < .14) {
        const start = pose[side + "h"];
        pose[side + "k"] = [sign * .129, Math.max(.103, start[1] - .107), start[2] - .408];
        pose[side + "a"] = [sign * .125, .108, start[2] - .822];
        pose[side + "t"] = add(pose[side + "a"], [sign * .012, -.058, -.115]);
      }
    } else if (mode === "superPush") {
      ankle[1] += .164 * airborne * (1 - rise);
      planted = airborne < .02 || rise > .83;
    } else if (walking) {
      ankle[0] += .139 * (foot[0] - frame[2][0]) / 38;
      ankle[1] += .039 * airborne;
      planted = airborne < .018;
    }
    if (!pose[side + "k"]) leg(pose, side, ankle, pole, toe, planted ? deck : undefined);

    const shift = walking ? .385 * trace.wristSide[index](frame) - .192 : lateral;
    const handWidth = mode === "pressWide" || mode === "handWalk" ? mix(.135, .371, trace.handWidth(frame)) : mode === "wiper" ? .331 : .213;
    const wristZ = mode === "pikeCobra" || mode === "forearmPike" ? .342 : mode === "triceps" ? .397 : .281;
    let wrist = [shift + sign * handWidth, .067, wristZ];
    let fingers = [0, -.032, .999];
    let ray = [sign * (.5 + .30 * depth), -.44, -.33];
    if (forearm && mode !== "sideRoll") {
      const forearmZ = mode === "kneeBridge" ? .265 : .095;
      pose[side + "e"] = [sign * .188, .090, forearmZ];
      pose[side + "w"] = [sign * .172, .070, forearmZ + .371];
      pose[side + "Fingers"] = fingers;
      continue;
    } else if (mode === "bodyUp") {
      wrist[2] = .404;
      ray = [sign * .263, -.934, -.146];
      if (depth > .74) {
        const shoulder = pose[side + "s"];
        pose[side + "e"] = [sign * .193, .09, wrist[2] - .35];
        if (Math.hypot(...pose[side + "e"].map((n, i) => n - shoulder[i])) < .399) {
          pose[side + "w"] = wrist;
          pose[side + "Fingers"] = fingers;
          continue;
        }
      }
    } else if (mode === "sideRoll") {
      const raised = sign * supportTurn < -.05;
      if (!raised) {
        const shoulder = pose[side + "s"];
        pose[side + "e"] = [shoulder[0], .089, shoulder[2] - .072];
        pose[side + "w"] = [shoulder[0] - sign * .035, .070, shoulder[2] + .294];
        pose[side + "Fingers"] = fingers;
        continue;
      }
      wrist = blend(wrist, add(pose.hips, [sign * .229, .101, -.02]), Math.abs(roll));
      fingers = [sign * .55, -.181, -.815];
    } else if (mode === "superPush") {
      const forward = (1 - rise) * trace.forwardHand(frame);
      wrist = blend(wrist, add(pose[side + "s"], [sign * .147, .043, .599]), forward);
      ray = [sign * .581, -.301, -.753];
    } else if (mode === "through" && sign * release > 0) {
      wrist = blend(wrist, add(pose[side + "s"], [sign * .135, .429, .109]), Math.abs(release));
    } else if (mode === "pressWide" || mode === "handWalk") {
      wrist[1] += hands[index] * .087;
    }
    arm(pose, side, wrist, ray, fingers);
  }
  return pose;
}

function legRise(frame, phase, trace, profile) {
  const mode = profile.mode;
  const high = trace.hipHigh(frame);
  const travel = trace.hipSide(frame);
  const leftPlant = trace.ankles[0](frame);
  const rightPlant = trace.ankles[1](frame);
  const dominant = profile.active ?? 1;
  const forward = mode === "ham" ? .95 * trace.neckForward(frame)
    : mode === "sartorius" ? .103 + .182 * trace.neckForward(frame) : mode === "stand" ? .23 * (1 - high) : .087;
  const squat = mode === "kneelSquat" ? trace.height(frame) : 0;
  const stage = (phase * 14) % 14;
  const leadingSide = stage < 7 ? 1 : -1;
  const localStage = stage % 7;
  const lightStep = Math.min(1, localStage, 7 - localStage);
  const fullStep = Math.max(0, Math.min(1, localStage - 1, 6 - localStage));
  const squatHeight = mix(.524, .902, Math.max(0, 1 - Math.abs(localStage - 3)));
  const hips = [0, mode === "ham" ? .479 + .031 * high : mode === "sartorius" ? .493 + .031 * high
    : mode === "halfKneel" ? .517 : mode === "kneelSquat" ? squatHeight - .061 * squat * fullStep : mix(.481, .896, high),
    mode === "ham" ? -.162 : mix(-.086, .073, travel)];
  const pose = stand(hips, forward, 0, mode === "sartorius" ? -.196 * trace.torsoSide(frame) : 0);
  for (const [side, sign] of sides) {
    const leading = mode === "halfKneel" ? (sign > 0 ? 1 - leftPlant : 1 - rightPlant)
      : mode === "kneelSquat" ? (sign === leadingSide ? lightStep : fullStep) : sign === dominant ? 1 : 0;
    const kneeBase = [sign * .128, .113, -.051];
    const rear = [sign * .131, .107, -.455];
    const standing = [sign * .149, .108, mode === "ham" ? .699 : mode === "sartorius" ? .413 : mix(.368, .047, high)];
    const backToFront = mode === "stand" ? high : 0;
    const grounded = Math.max(backToFront, leading);
    const target = blend(rear, standing, grounded);
    target[1] += .114 * (1 - Math.abs(2 * grounded - 1));
    const toe = blend([sign * .014, -.049, -.138], [sign * .019, mode === "ham" ? .093 : -.066, .121], grounded);
    if (grounded < .011) {
      pose[side + "k"] = kneeBase;
      pose[side + "a"] = rear;
      pose[side + "t"] = add(rear, toe);
    } else {
      leg(pose, side, target, [sign * .26, .03 - 1.78 * (1 - grounded), .94], toe, grounded > .982 && mode !== "ham" ? deck : undefined);
    }
    const b = mode === "ham" ? [sign * .204, .109, .438]
      : mode === "sartorius" ? add(hips, [sign * .142, .145, .121])
      : add(pose[side + "s"], [sign * .072, -.193, .542]);
    arm(pose, side, b, [sign * .46, -.81, -.32], mode === "ham" ? [0, -.33, .93] : [0, -.055, .999]);
  }
  return pose;
}

export function floorContactGuideMotion(guide, profile) {
  const { frames } = guide;
  const direction = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const trace = {
    hipHigh: normalize(frames, f => -f[2][1]),
    upperHigh: normalize(frames, f => -f[1][1]),
    hipSide: normalize(frames, f => f[2][0]),
    torsoSide: normalize(frames, f => f[1][0] - f[2][0]),
    neckForward: normalize(frames, f => direction * (f[1][0] - f[2][0])),
    ankles: [8,10].map(index => normalize(frames, f => -f[index][1])),
    wrists: [4,6].map(index => normalize(frames, f => -f[index][1])),
    wristSide: [4,6].map(index => normalize(frames, f => f[index][0])),
    width: normalize(frames, f => Math.abs(f[8][0] - f[10][0])),
    handWidth: normalize(frames, f => Math.abs(f[4][0] - f[6][0])),
    height: normalize(frames, f => f[2][1]),
    forwardHand: normalize(frames, f => direction * (f[4][0] - f[2][0])),
  };
  return phase => {
    const frame = guideAt(frames, phase);
    return profile.support === "rear" ? rollingBridge(frame, phase, trace, profile)
      : profile.support === "kneel" ? legRise(frame, phase, trace, profile) : frontSupport(frame, trace, profile);
  };
}
