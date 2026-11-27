import { add, arm, blend, leg, mix, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
function span(frames, measure) {
  const values = frames.map(measure);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((measure(frame) - low) / width);
}

export function standingStretchGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const headTravel = span(frames, f => f[1][1]);
  const hipDrop = span(frames, f => f[2][1]);
  const lateralTravel = span(frames, f => f[2][0]);
  const torsoSide = span(frames, f => f[1][0]);
  const armLift = span(frames, f => -(f[4][1] + f[6][1]));
  const ankleLift = [8, 10].map(index => span(frames, f => -f[index][1]));
  const hipProjection = span(frames, f => f[2][0] - f[1][0]);
  const heelSlide = span(frames, f => -f[10][0]);
  const isFold = ["fold", "wideFold", "sideFold", "calfCross", "splitFold", "seal", "singleHinge"].includes(mode);
  const isSquat = ["squat", "squatTwist", "squatKick", "chop", "toeSquat", "deepAchilles", "groundCalf"].includes(mode);

  return phase => {
    const frame = guideAt(frames, phase);
    const bend = headTravel(frame);
    const drop = hipDrop(frame);
    const raises = ankleLift.map(read => read(frame));
    const wide = mode === "lateral" || ["wideFold", "sideFold"].includes(mode);
    const tiltSide = torsoSide(frame) * 2 - 1;
    const targetSide = mode === "sideFold" ? profile.crossHand ? -clamp((frame[4][1] - frame[6][1]) / 69, -1, 1) : tiltSide
      : mode === "squatTwist" ? clamp((frame[4][1] - frame[6][1]) / 61, -1, 1) : tiltSide;
    const drift = (lateralTravel(frame) * 2 - 1);
    const frontLeft = profile.active !== "right";
    const activeSign = frontLeft ? 1 : -1;
    const amount = mode === "quadHold" || mode === "kneeHold" || mode === "singleHinge" ? raises[frontLeft ? 0 : 1] : 0;
    const breathe = profile.breathe ? .0075 * Math.sin(phase * Math.PI * 4) : 0;
    const hipY = (profile.startY ?? .909) - (isSquat ? (profile.depth ?? .415) * drop : mode === "lateral" ? .190 * drop
      : mode === "singleHinge" ? .082 * amount : isFold ? .057 * bend : 0) + breathe;
    const hipX = mode === "lateral" ? .396 * drift : mode === "crossLean" ? .146 * (drift + 1) * .5
      : mode === "singleHinge" || mode === "quadHold" || mode === "kneeHold" ? -.062 * activeSign * amount : mode === "sideFold" ? .092 * targetSide * bend : 0;
    const hipZ = mode === "splitFold" ? .087 - .043 * bend : isFold ? -.034 - .093 * bend : isSquat ? -.065 - .17 * drop : mode === "leanBack" ? -.05 + .14 * hipProjection(frame)
      : mode === "splitLunge" ? -.10 + .14 * hipProjection(frame) : mode === "gluteContract" ? -.068 + .088 * (1 - drop) : -.024;
    const pitch = isFold ? (profile.angle ?? 2.12) * (mode === "singleHinge" ? amount : bend)
      : mode === "leanBack" ? -.055 - .447 * hipProjection(frame)
      : mode === "upperBack" ? .073 + .22 * (1 - bend)
      : mode === "upperPress" && profile.extend ? -.19 * armLift(frame)
      : mode === "toeSquat" ? .98 + .26 * drop : mode === "groundCalf" ? 1.15 + .083 * heelSlide(frame) : isSquat ? .05 + .32 * drop : .040;
    const twist = (mode === "sideFold" ? .94 * targetSide * bend : mode === "squatTwist" ? -.81 * targetSide * drop
      : mode === "chop" ? -.87 * (1 - drop * 2) : mode === "upperTurn" ? -.79 * tiltSide : 0);
    const trunkTilt = mode === "crossLean" ? -.39 * ((drift + 1) * .5) : mode === "sideFold" ? -.217 * targetSide * bend : 0;
    const pose = stand([hipX, hipY, hipZ], pitch, twist, trunkTilt);
    if (isFold && mode !== "singleHinge") {
      pose.headAim = [0, Math.cos(pitch + .26 * bend), Math.sin(pitch + .26 * bend)];
    }

    for (const [side, sign] of sides) {
      const active = sign === activeSign;
      const index = sign > 0 ? 0 : 1;
      const width = profile.width ?? (wide ? .425 : .141);
      let target = [sign * width, .085, .041];
      let pole = [sign * (wide ? .345 : .17), .017, .97];
      let toe = [sign * (wide ? .060 : .021), -.064, .126];
      let planted = true;
      if (profile.cross || mode === "crossLean") {
        const cross = profile.cross ? 1 : clamp((frame[10][0] - frames[0][10][0]) / 35);
        if (active) target = [mix(sign * width, -sign * .225, cross), .087, -.237 * cross];
      } else if (mode === "splitFold" || mode === "splitLunge") {
        target = [sign * .115, active ? .087 : .095, active ? .396 : mode === "splitLunge" ? -.458 : -.098];
        if (!active && mode === "splitLunge") {
          target[1] = .153;
          toe = [sign * .012, -.128, .081];
        }
        if (active && mode === "splitFold") {
          toe = [sign * .020, profile.toeUp ? .093 : -.064, .119];
          planted = !profile.toeUp;
        }
        pole = [sign * .115, .017, .97];
      } else if (active && mode === "singleHinge") {
        target = [sign * .128, Math.max(.103, hipY - .827 * Math.cos(amount * 1.55)), hipZ - .829 * Math.sin(amount * 1.55)];
        pole = [sign * .115, .35, .94];
        toe = blend(toe, [sign * .097, -.091, -.07], amount);
        planted = false;
      } else if (active && mode === "quadHold") {
        target = blend(target, [sign * .120, hipY - .082, hipZ - .343], amount);
        pole = [sign * .072, -.98, .065];
        toe = blend(toe, [sign * .018, -.129, -.052], amount);
        planted = amount < .015;
      } else if (active && mode === "kneeHold") {
        target = blend(target, [profile.tuck ? -sign * .308 : sign * .128, hipY - (profile.tuck ? .088 : .153), hipZ + .323], amount);
        pole = [sign * (profile.tuck ? .88 : .134), .982, .034];
        toe = blend(toe, [sign * .023, -.095, .101], amount);
        planted = amount < .014;
      } else if (mode === "squatKick" && raises[index] > .005) {
        const kick = raises[index];
        target = [sign * (.141 + .681 * kick), .085 + .665 * kick, .041 + .141 * kick];
        pole = [sign * .742, .035, .66];
        planted = false;
      } else if (mode === "groundCalf" && !active) {
        target = [-activeSign * .185, .084, -.569 - .267 * heelSlide(frame)];
      }
      if (mode === "deepAchilles") target[2] += .146 * hipProjection(frame);
      if (mode === "toeSquat") {
        target = [sign * .135, .138, .105];
        toe = [sign * .018, -.123, .080];
        pole = [sign * .19, .021, .979];
      }
      leg(pose, side, target, pole, toe, planted ? 0 : undefined);
    }

    for (const [side, sign] of sides) {
      const active = sign === activeSign;
      const shoulder = pose[side + "s"];
      const ankle = pose[side + "a"];
      const knee = pose[side + "k"];
      const opposite = side === "l" ? "r" : "l";
      const activeLeg = active ? side : opposite;
      let target = add(shoulder, [sign * .038, -.596, .096]);
      let pole = [sign * .34, -.63, -.31];
      let fingers = [sign * .011, -.93, .354];
      if (mode === "seal") {
        const clasp = add(pose.chest, [sign * .039, .558 * Math.sin(pitch), -.558 * Math.cos(pitch)]);
        target = blend(add(pose.hips, [sign * .037, .111, -.184]), clasp, Math.max(armLift(frame), bend));
        pole = [sign * .36, .095, -.93];
        fingers = [-sign * .88, .031, -.472];
      } else if (isFold) {
        const cross = mode === "sideFold" || profile.crossHand;
        const acrossShin = mode === "calfCross" ? pose[opposite + "a"] : null;
        const contact = mode === "singleHinge" || mode === "splitFold" ? pose[(mode === "singleHinge" ? opposite : activeLeg) + "t"]
          : mode === "sideFold" ? pose[(targetSide > 0 ? "l" : "r") + "t"] : pose[side + "t"];
        const reach = acrossShin ? add(acrossShin, [sign * .017, .223, .091])
          : add(contact, [sign * .049, profile.reach ?? .084, mode === "singleHinge" ? .051 : -.013]);
        const up = mode === "sideFold" && profile.crossHand && sign * targetSide > 0;
        const straightBack = add(shoulder, [sign * .335, .405, -.121]);
        const wideStart = profile.startWide || cross ? add(shoulder, [sign * .59, -.056, .063]) : target;
        const foldAmount = mode === "singleHinge" ? amount : bend;
        target = blend(wideStart, up ? straightBack : reach, foldAmount);
        if (mode === "singleHinge") {
          target = blend(wideStart, add(pose[activeSign > 0 ? "rt" : "lt"], [sign * .051, .093, .005]), foldAmount);
        } else if (profile.palmsUnder) {
          target = blend(wideStart, [sign * .148, .049, .227], foldAmount);
          pole = [sign * .86, -.61, .11];
        }
        fingers = profile.palmsUnder && foldAmount > .70 ? [0, .028, -.995] : up ? [sign * .21, .958, -.13] : [sign * .06, -.945, .32];
      } else if (mode === "lateral") {
        const shifted = sign * drift > 0;
        target = profile.bothKnees || shifted ? add(knee, [sign * .030, .067, .017]) : add(pose.hips, [sign * .156, .047, .124]);
        pole = [sign * .45, -.417, -.744];
        fingers = [-sign * .044, -.89, .454];
      } else if (mode === "quadHold") {
        target = active ? blend(target, add(ankle, [sign * .038, .083, -.006]), amount)
          : add(shoulder, [sign * .263 * amount, -.548, .064]);
        pole = [sign * .28, -.60, -.75];
        fingers = [0.055, -.48, -.862];
      } else if (mode === "kneeHold") {
        const anchor = profile.tuck && !active ? pose[activeLeg + "a"] : pose[activeLeg + "k"];
        target = blend(target, add(anchor, [sign * .063, -.045, .079]), amount);
        fingers = [-sign * .92, .07, -.369];
      } else if (mode === "squatTwist") {
        const higher = sign * targetSide < 0;
        const upper = add(shoulder, [sign * .199, .572, -.031]);
        const ground = add(knee, [sign * .031, .055, .021]);
        target = blend(add(pose.chest, [sign * .052, .044, .241]), higher ? upper : ground, Math.abs(targetSide));
        pole = [sign * .731, -.4, -.51];
        fingers = [sign * .087, higher ? .981 : -.082, higher ? .142 : .994];
      } else if (mode === "groundCalf" || mode === "toeSquat") {
        target = [sign * .205, .051, .589];
        pole = [sign * .42, -.44, .79];
        fingers = [sign * .027, -.083, .995];
      } else if (mode === "chop") {
        target = add(pose.chest, [sign * .063 + mix(.385, -.315, drop), mix(.474, -.248, drop), .266]);
        pole = [sign * .68, -.58, -.42];
        fingers = [-sign * .73, .541, .412];
      } else if (isSquat) {
        target = add(pose.chest, [sign * .044, .041, .256]);
        pole = [sign * .79, -.58, profile.elbows ? .47 : -.042];
        fingers = [-sign * .55, .823, .142];
      } else if (mode === "upperBack") {
        target = add(pose.chest, [sign * .044, .105, .159 + .445 * (1 - bend)]);
        pole = [sign * .66, -.544, .205];
        fingers = [-sign * .886, .082, .454];
      } else if (mode === "upperPress") {
        const level = armLift(frame);
        target = add(shoulder, [sign * (profile.extend ? -.153 : .048), .021 + .569 * level, .122 - .147 * level]);
        pole = [sign * .74, -.62, -.18];
        fingers = [sign * .065, .98, .137];
      } else if (mode === "upperCurl") {
        const level = armLift(frame);
        target = add(shoulder, [sign * .035, -.596 + .559 * level, .072 + .278 * level]);
        pole = [sign * .17, -.985, -.15];
        fingers = [0, mix(-.91, .943, level), .219];
      } else if (mode === "upperFly") {
        const open = clamp(Math.abs(frame[4][0] - frame[6][0]) / 83);
        target = add(shoulder, [sign * mix(-.145, .568, open), -.052, mix(.559, .127, open)]);
        pole = [sign * .36, -.265, -.827];
        fingers = [-sign * .84, .286, .462];
      } else if (mode === "upperTurn") {
        target = add(pose.chest, [sign * .085 + Math.sin(twist) * .29, .062, .301 + sign * Math.sin(twist) * .081]);
        pole = [sign * .785, -.43, -.15];
        fingers = [-sign * .47, .12, .87];
      } else {
        target = add(pose.hips, [sign * .164, .107, .118]);
        pole = [sign * .861, -.44, -.30];
        fingers = [-sign * .081, -.721, .688];
      }
      arm(pose, side, target, pole, fingers);
    }
    return pose;
  };
}
