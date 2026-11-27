import { add, arm, blend, leg, legAngles, mix, sides, stand, torso } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const bounded = (value, limit, ceiling) => Math.max(limit, Math.min(ceiling, value));

function guideRange(frames, read) {
  const samples = frames.map(read);
  const low = Math.min(...samples);
  const span = Math.max(1, Math.max(...samples) - low);
  return frame => bounded((read(frame) - low) / span, 0, 1);
}

export function kneelingGuideMotion(guide, profile) {
  const { frames } = guide;
  const mode = profile.mode;
  const origin = frames[0];
  const direction = Math.sign(origin[1][0] - origin[2][0]) || 1;
  const wristHeight = [guideRange(frames, f => -f[4][1]), guideRange(frames, f => -f[6][1])];
  const wristForward = [guideRange(frames, f => direction * f[4][0]), guideRange(frames, f => direction * f[6][0])];
  const ankleHeight = [guideRange(frames, f => -f[8][1]), guideRange(frames, f => -f[10][1])];
  const elbowHeight = [guideRange(frames, f => -f[3][1]), guideRange(frames, f => -f[5][1])];
  const pelvis = guideRange(frames, f => f[2][1]);
  const neckHeight = guideRange(frames, f => -f[1][1]);
  const forward = guideRange(frames, f => direction * f[1][0]);
  const activeLeg = profile.active === "left" ? 1 : -1;
  const nearIsActive = (Math.max(...frames.map(f => f[8][1])) - Math.min(...frames.map(f => f[8][1])))
    >= (Math.max(...frames.map(f => f[10][1])) - Math.min(...frames.map(f => f[10][1])));
  const nearLeg = nearIsActive ? activeLeg : -activeLeg;

  return phase => {
    const frame = guideAt(frames, phase);
    const hip = frame[2];
    const tone = profile.breath ? .010 * Math.sin(4 * Math.PI * phase) : 0;
    const d = profile.invert ? 1 - pelvis(frame) : pelvis(frame);
    const shift = (hip[0] - origin[2][0]) * direction * .012;
    const bend = mode === "bow" ? 1 - d : 0;
    if (profile.tall) {
      const arc = mode === "thrust" ? 1.15 * d : 0;
      const extend = mode === "camel" ? 1 - forward(frame) : mode === "abdomen" ? forward(frame) : 0;
      const tilt = mode === "circle" ? (hip[0] - origin[2][0]) * .009 : 0;
      const circleForward = mode === "circle" ? (origin[2][1] - hip[1]) * .020 : 0;
      const roll = mode === "turn" ? (forward(frame) - .5) * 1.38 : 0;
      const hips = [tilt, .108 + .414 * Math.cos(arc) + tone, -.13 - .414 * Math.sin(arc) + .049 * extend + circleForward];
      const pose = stand(hips, -.018 - (mode === "camel" ? 1.26 : .73) * extend - circleForward * .54, roll, -tilt * .62);
      for (const [side, sign] of sides) {
        if (mode === "turn" && sign > 0) {
          leg(pose, side, [.173, .084, .380], [.071, -.08, .97], [.014, -.068, .126], 0);
        } else {
          pose[side + "k"] = [sign * .136, .109, mode === "turn" ? -.163 : -.131];
          pose[side + "a"] = [sign * .122, .102, -.550];
          pose[side + "t"] = [sign * .106, .052, -.679];
        }
        const back = add(hips, [sign * .139, .111, -.138]);
        const heel = add(pose[side + "a"], [sign * .047, .062, .019]);
        const bicepsLift = wristHeight[sign > 0 ? 0 : 1](frame);
        const hand = mode === "camel" ? blend(back, heel, bounded((extend - .56) * 2.25, 0, 1))
          : mode === "abdomen" ? back : mode === "turn" ? add(pose[sign > 0 ? "rs" : "ls"], [sign * .073, -.115, .122])
          : mode === "biceps" ? add(pose[side + "s"], [sign * .029, mix(-.610, -.252, bicepsLift) + tone, .357 * bicepsLift])
          : add(hips, [sign * .169, .071, .087]);
        arm(pose, side, hand, mode === "biceps" ? [sign * .09, -.91, -.31] : [sign * .83, -.22, -.52],
          mode === "biceps" ? [0, mix(-.90, .04, bicepsLift), mix(.04, .996, bicepsLift)] : [0, -.55, .82],
          mode === "biceps" ? [-sign, 0, 0] : [1, 0, 0]);
      }
      return pose;
    }

    const rotationArm = mode === "rotation" && frame[6][1] < frame[4][1] ? -1 : 1;
    const rotationIndex = rotationArm > 0 ? 0 : 1;
    const spin = mode === "rotation" || mode === "thread" ? elbowHeight[rotationIndex](frame) : 0;
    const handsToHead = mode === "rotation" ? bounded((frame[0][1] + 35 - frame[rotationIndex ? 6 : 4][1]) / 26, 0, 1) : 1;
    const swing = mode === "bow" ? .125 * bend : 0;
    const lateral = mode === "bow" ? bounded((frame[1][0] - hip[0]) / 36, -1, 1) : 0;
    const crossDown = mode === "cross" ? 1 - neckHeight(frame) : 0;
    const hipY = .514 - .085 * bend - .047 * crossDown + tone;
    const hipZ = -.210 + .053 * shift - .062 * bend;
    const posture = 1.55 + .30 * bend + .29 * crossDown;
    const roll = mode === "rotation" || mode === "thread" ? rotationArm * handsToHead * (.43 - 1.59 * spin) : 0;
    const pose = lateral ? stand([0, hipY, hipZ], posture, .48 * lateral) : torso([0, hipY, hipZ], posture, roll);
    pose.headDrop = -.016;

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const sourceNear = nearLeg === sign;
      const knee = frame[sourceNear ? 7 : 9];
      const ankle = frame[sourceNear ? 8 : 10];
      const active = mode === "kick" || mode === "curl" || mode === "glute";
      if (active && sign === activeLeg && mode !== "curl") {
        const thigh = profile.pulse ? 2.88 + bounded(knee[1] - 112, 0, 11) * .020 : Math.atan2(hip[1] - knee[1], direction * (knee[0] - hip[0]));
        const shin = profile.pulse ? thigh - Math.PI / 2 : Math.atan2(knee[1] - ankle[1], direction * (ankle[0] - knee[0]));
        // The guide's fore-aft motion is usually on the negative side of the exercise's facing direction.
        legAngles(pose, side, sign, thigh, shin);
        if (pose[side + "a"][1] < .093) leg(pose, side, [sign * .141, .093, pose[side + "a"][2]], [sign * .10, -.9, .3], [sign * .012, -.067, -.119], .024);
      } else {
        const kneeZ = mode === "bow" ? -.160 : -.202;
        pose[side + "k"] = [sign * .133, .110, kneeZ];
        if (mode === "curl" && sign === activeLeg) {
          const bend = ankleHeight[sourceNear ? 0 : 1](frame);
          pose[side + "a"] = [sign * .123, .115 + .415 * Math.sin(1.13 * bend), kneeZ - .416 * Math.cos(1.13 * bend)];
          pose[side + "t"] = add(pose[side + "a"], [sign * .012, -.05 - .014 * bend, -.120 + .109 * bend]);
        } else {
          pose[side + "a"] = [sign * .118, .107, kneeZ - .414];
          pose[side + "t"] = [sign * .112, .061, kneeZ - .535];
        }
      }

      const wrist = [sign * .212, .067, .319 + swing];
      let target = wrist;
      let fingers = [0, -.02, 1];
      let elbow = [sign * .55, -.35, -.76];
      let palm = [1, 0, 0];
      if (mode === "rotation" && sign === rotationArm) {
        target = blend(wrist, add(pose.head, [sign * .093, .033 + .036 * spin, -.082]), handsToHead);
        elbow = [sign * .79, -.43 + 1.56 * spin, -.49];
      } else if (mode === "thread" && sign === rotationArm) {
        const reachUnder = bounded((frame[1][0] - frame[4][0] - 3) / 32, 0, 1);
        const heldHand = add(pose.head, [sign * .094, .057, -.086]);
        target = blend(blend(wrist, [-sign * .382, .063, .424], reachUnder), heldHand, wristHeight[index](frame));
        elbow = [sign * .62, -.34 + 1.50 * spin, -.58];
      } else if (mode === "tap") {
        const opposite = pose[sign > 0 ? "rs" : "ls"];
        const tap = wristHeight[index](frame);
        target = blend(wrist, add(opposite, [sign * .062, .027, -.025]), tap);
        fingers = [-sign * tap, -.023, 1 - .83 * tap];
        elbow = [sign * .62, -.47, .67];
      } else if (mode === "cross" && sign === (frame[4][0] <= frame[6][0] ? 1 : -1)) {
        target = blend(wrist, [-sign * .327, .058, .452], crossDown);
        fingers = [-sign * crossDown, -.020, 1 - crossDown];
      } else if (mode === "reach" && sign === rotationArm) {
        const reach = wristForward[index](frame);
        const lift = wristHeight[index](frame);
        target = [sign * .147, .061 + .435 * lift, .339 + .489 * reach + .068 * lift];
        fingers = [sign * .033, .021, 1];
        palm = [Math.cos(Math.PI * reach), Math.sin(Math.PI * reach), .012];
      } else if (mode === "bow") {
        target = [sign * .188 + .295 * lateral, .060, .404 + .106 * Math.abs(lateral)];
      } else if (mode === "wrist") {
        fingers = [0, -.02, -1];
      }
      arm(pose, side, target, elbow, fingers, palm);
    }
    return pose;
  };
}
