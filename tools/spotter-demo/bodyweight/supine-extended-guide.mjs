import { add, arm, blend, leg, mix, scale, sides, stand, torso, unit } from "./pose.mjs";
import { guideAt, sagittalGuideMotion } from "./sagittal-guide.mjs";
import { hipMobilityGuideMotion } from "./hip-mobility-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / span);
}

export function supineExtendedGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const base = sagittalGuideMotion(guide, { hands: profile.hands ?? "side", legFit: true, hipLift: profile.hipLift });
  const hip = hipMobilityGuideMotion(guide, { mode: "figure" });
  const hipY = range(frames, frame => -frame[2][1]);
  const ankleLifts = [8, 10].map(index => range(frames, frame => -frame[index][1]));
  const kneeLifts = [7, 9].map(index => range(frames, frame => -frame[index][1]));
  const headLift = range(frames, frame => -frame[0][1]);
  const kneeAngle = range(frames, frame => -Math.hypot(frame[7][0]-frame[2][0], frame[7][1]-frame[2][1]));
  const moveSide = range(frames, frame => frame[8][0] - frame[10][0]);
  const heelSwing = range(frames, frame => frame[4][0] - frame[6][0]);
  const bend = range(frames, frame => -Math.hypot(frame[2][0] - frame[8][0], frame[2][1] - frame[8][1]));
  const tuckedFoot = range(frames, frame => -frame[8][1]);
  const floor = .024;

  return phase => {
    const frame = guideAt(frames, phase);
    const lift = hipY(frame);
    const swing = phase * Math.PI * 2;
    const motion = profile.reverse ? 1 - phase : phase;
    if (mode === "figure" && !profile.down) return hip(phase);
    if (mode === "cycle") {
      const p = base(motion);
      const leftActive = kneeLifts[0](frame);
      const rightActive = kneeLifts[1](frame);
      const twist = profile.reverse ? 0 : (rightActive - leftActive) * .405;
      const hips = [0, profile.reverse ? .228 : .157, -.271];
      const pose = profile.reverse ? torso(hips, -Math.PI / 2) : stand(hips, -.829, twist, (leftActive - rightActive) * .19);
      pose.headDrop = profile.reverse ? .065 : -.024;
      for (const [side, sign] of sides) {
        const index = sign > 0 ? 0 : 1;
        const bent = profile.reverse ? ankleLifts[index](frame) : kneeLifts[index](frame);
        const foot = add(p[side + "a"], [sign * .025, .095 + .054 * bent, -.043 * bent]);
        const ankle = profile.reverse ? [sign * .135, Math.max(.156, foot[1]), foot[2]]
          : [sign * .133, mix(.192, .428, bent), mix(.532, -.146, bent)];
        const kneePole = profile.reverse ? [sign * .043, .88, -.24] : [sign * .088, .833, -.61];
        leg(pose, side, ankle, kneePole, [sign * .011, .094, .094]);
      }
      for (const [side, sign] of sides) {
        const wrist = profile.reverse ? add(hips, [sign * .066, -.110, -.018]) : add(pose.head, [sign * .102, .027, -.079]);
        const oppositeKnee = pose[sign > 0 ? "rk" : "lk"];
        const armPole = profile.reverse ? [sign * .92, -.23, -.15]
          : [mix(sign * .91, -sign * .355, sign > 0 ? rightActive : leftActive), .041,
            .69 + Math.max(-.25, oppositeKnee[2] - pose[side + "s"][2])];
        arm(pose, side, wrist, armPole);
      }
      return pose;
    }
    if (mode === "bridge") {
      const amplitude = profile.squeeze ? .073 : .264;
      const elevated = profile.march || profile.walk || profile.shoulder;
      const hipHeight = (elevated ? .389 : .157) + (elevated ? .041 : amplitude) * lift;
      const pose = torso([0, hipHeight, -.233], -Math.PI / 2 - Math.atan2(hipHeight - .143, .49));
      pose.headDrop = .041;
      for (const [side, sign] of sides) {
        const index = sign > 0 ? 0 : 1;
        const high = ankleLifts[index](frame);
        const walk = profile.walk ? Math.abs(frame[index ? 10 : 8][0] - frames[0][index ? 10 : 8][0]) * .015 : 0;
        const jumping = profile.jump && sign > 0;
        const raised = profile.march || profile.shoulder || jumping;
        const rise = raised ? (jumping ? .60 : high) : 0;
        const width = profile.frog ? .058 : .152 + (profile.walk ? .45 * walk : 0);
        const target = profile.shoulder ? blend([sign * width, .111, .375], add(pose[side + "h"], [sign * .039, .818, -.145]), rise)
          : [sign * width, .111 + .461 * rise, mix(.375 + walk, -.159, rise)];
        const toe = profile.frog ? [-sign * .090, -.035, .107] : [sign * .013, mix(-.067, .103, rise), .128];
        const pole = profile.frog ? [sign * .93, .251, -.18] : [sign * .113, .962, -.12];
        leg(pose, side, target, pole, toe, rise < .012 && !profile.frog ? floor : undefined);
        const wrist = profile.support ? [sign * .124, Math.max(.066, hipHeight - .073), -.248] : [sign * .235, .066, -.194];
        arm(pose, side, wrist, [sign * .51, -.81, .033], [0, .014, 1]);
      }
      return pose;
    }

    const centerY = mode === "vertical" || mode === "cocoon" ? .147 + (profile.pulse ? .074 : .108) * lift : .149;
    const roll = mode === "heelTap" ? (heelSwing(frame) - .5) * .51 : 0;
    const angle = mode === "heelTap" ? (profile.tabletop ? -.882 : -.791) : mode === "neck" ? -1.542 : mode === "cocoon" ? -Math.PI / 2 - .179*lift : mode === "vertical" ? -Math.PI / 2 - .202 * lift : -Math.PI / 2;
    const sway = profile.lateral ? .157 * Math.sin(swing) * lift : 0;
    const pose = mode === "heelTap" ? stand([0, centerY, -.271], angle, roll) : torso([sway, centerY, -.271], angle);
    pose.headDrop = mode === "neck" ? .044 - .105 * headLift(frame) : mode === "heelTap" ? -.014 : .023;
    if (mode === "neck") pose.headAim = [0, .03 + .68 * headLift(frame), -.98];
    const rollPhase = mode === "wiper" ? (moveSide(frame) - .5) * 1.90 : 0;
    const down = mode === "figure" && profile.down;
    const stretch = mode === "hamstring" ? Math.max(ankleLifts[0](frame), kneeLifts[0](frame) * .89) : 0;
    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const top = index === 0;
      const raised = ankleLifts[index](frame);
      const anchor = [sign * .142, .107, .482];
      let target = anchor;
      let kneePole = [sign * .059, .912, -.17];
      let toe = [sign * .019, -.064, .129];
      let contact = true;
      if (mode === "heelTap" || mode === "neck") {
        if (mode === "heelTap" && profile.tabletop) {
          target = [sign * .166, .553, .085];
          contact = false;
        } else target = [sign * .155, .108, mode === "heelTap" ? .122 : .271];
      } else if (mode === "wiper") {
        const high = profile.bent ? .454 : .823;
        target = [sign * .083 * Math.cos(rollPhase) + high * Math.sin(rollPhase), .124 + high * Math.cos(rollPhase), profile.bent ? .136 : -.249];
        kneePole = [Math.sin(rollPhase) * .83 + sign * .07, .62 * Math.cos(rollPhase), -.21];
        toe = [Math.sin(rollPhase) * .101, Math.cos(rollPhase) * .093, .078];
        contact = false;
      } else if (mode === "vertical") {
        const tilt = profile.turn ? .239 * Math.sin(swing) * lift : 0;
        const vector = unit([tilt, .963, .09 + .023 * raised]);
        target = add(pose[side + "h"], scale(vector, .843));
        toe = [.051 * sway, .125, .053];
        contact = false;
      } else if (mode === "scissor") {
        const vertical = profile.cross ? .051 + .025 * sign * Math.cos(swing) : .16 + .354 * raised;
        const lateral = profile.cross ? sign * (.24 - .46 * raised) : sign * .02;
        const ray = unit([lateral, vertical, .85]);
        target = add(pose[side + "h"], scale(ray, .842));
        toe = [sign * .014, .115, .078];
        contact = false;
      } else if (mode === "cocoon" || mode === "tuck") {
        const curl = mode === "cocoon" ? Math.max(raised, lift * .94) : profile.out ? tuckedFoot(frame) : kneeAngle(frame);
        const still = !top && profile.single;
        target = still ? [sign * .143, .113, .299] : [sign * .129 + (profile.out && top ? .179 * curl : 0), mix(.118, .411, curl), mix(.511, .011, curl)];
        kneePole = [sign * (profile.out ? .63 : .112), .928, -.156];
        toe = [sign * .018, mix(-.062, .081, curl), .124];
        contact = still || curl < .014;
      } else if (mode === "crossover") {
        if (top) {
          target = [-.127 - .322 * bend(frame), .261 - .150 * bend(frame), .129 + .108 * bend(frame)];
          kneePole = [-.72, .647, -.186];
          contact = false;
        }
      } else if (down) {
        target = top ? [.137, .110, .305] : [.106, .328 - .145 * lift, .192];
        kneePole = [sign * .95, .653, -.236];
        toe = top ? toe : [.116, -.033, -.062];
        contact = top;
      } else if (mode === "hamstring") {
        if (top) {
          const reach = profile.calf ? .96 : stretch;
          const ray = unit([.051, .305 + .627 * reach, .831 - .859 * reach]);
          const length = profile.calf ? .844 : mix(.792, .842, reach);
          const footTilt = profile.calf ? clamp((167 - (frame[11]?.[0] ?? 167)) / 18) : 0;
          target = add(pose[side + "h"], scale(ray, length));
          const footAngle = mix(.309, 1.86, footTilt);
          toe = profile.calf ? [sign * .016, .141 * Math.cos(footAngle), -.141 * Math.sin(footAngle)] : [sign * .017, .125, .024];
          contact = false;
        } else {
          target = [sign * .113, .108, .572];
        }
      } else if (mode === "eight" && top) {
        target = [sign * .140 + .156 * Math.sin(swing), .366 + .106 * raised, .202 + .113 * Math.cos(swing * 2)];
        kneePole = [sign * .41 + .31 * Math.sin(swing), .88, -.37];
        contact = false;
      } else if (mode === "tibialis") {
        target = [sign * .051, top ? .144 : .098, top ? .334 : .376];
        toe = [sign * .019, top ? -.085 : -.091 + .188 * raised, .128];
        contact = false;
      }
      leg(pose, side, target, kneePole, toe, contact ? floor : undefined);
    }
    for (const [side, sign] of sides) {
      const shoulder = pose[side + "s"];
      const rest = [sign * .221, .066, -.202];
      let wrist = rest;
      let fingers = [0, .015, 1];
      let elbow = [sign * .63, -.38, -.51];
      if (mode === "heelTap") {
        const press = sign > 0 ? heelSwing(frame) : 1 - heelSwing(frame);
        wrist = blend(rest, add(pose[side + "a"], [sign * .031, -.009, -.126]), press);
        pose[side + "s"] = add(shoulder, [sign * .042 * press, -.028 * press, .133 * press]);
      } else if (mode === "wiper" || mode === "crossover") {
        wrist = add(shoulder, [sign * .607, -.048, .034]);
        fingers = [sign, -.022, .016];
      } else if (mode === "neck") {
        wrist = add(pose.head, [sign * .094, -.019 + .097 * headLift(frame), -.074]);
        fingers = [-sign * .82, .196, -.421];
      } else if (mode === "tuck" || mode === "cocoon" || down || mode === "hamstring") {
        const knee = pose[profile.single || mode === "hamstring" || down ? "lk" : side + "k"];
        const ankle = pose[profile.single || mode === "hamstring" || down ? "la" : side + "a"];
        const grip = blend(knee, ankle, mode === "hamstring" ? -.39 : down ? .05 : .292);
        const approach = mode === "hamstring" ? profile.calf ? 1 : clamp(stretch * 2.3) : mode === "cocoon" ? .22 + .78 * lift
          : Math.max(.20, profile.out ? tuckedFoot(frame) : kneeAngle(frame));
        const released = mode === "cocoon" && profile.overhead ? add(shoulder, [sign * .086, -.031, -.541]) : rest;
        wrist = blend(released, add(grip, [sign * .076, -.066, -.044]), approach);
        fingers = [-sign * .41, .71, .517];
      } else if (profile.hands === "under") {
        wrist = [sign * .083, .061, -.215];
      }
      arm(pose, side, wrist, elbow, fingers);
    }
    return pose;
  };
}
