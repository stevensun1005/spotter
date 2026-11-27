import { add, arm, blend, leg, mix, scale, sides, torso } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const minimum = Math.min(...values);
  const distance = Math.max(.05, Math.max(...values) - minimum);
  return frame => clamp((read(frame) - minimum) / distance);
}

export function lateralFloorGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const turn = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const handTravel = range(frames, f => turn * (f[4][0] - f[1][0]));
  const handHeight = range(frames, f => -f[4][1]);
  const kneeLift = range(frames, f => -f[7][1]);
  const kneeBack = range(frames, f => turn * (f[2][0] - f[7][0]));
  const upperFoot = range(frames, f => -f[8][1]);
  const lowerFoot = range(frames, f => -f[10][1]);
  const legSeparation = range(frames, f => Math.hypot(f[8][0] - f[2][0], f[8][1] - f[2][1]));
  const headLift = range(frames, f => -f[0][1]);

  return phase => {
    const f = guideAt(frames, phase);
    const open = mode === "chest" ? handTravel(f) : 0;
    const shift = mode === "stretch" ? .069 * handTravel(f) : 0;
    const pitch = Math.PI / 2 + (profile.headSupport ? -.056 : .069);
    const upperRoll = Math.PI / 2 + .86 * open;
    const pose = torso([0, .239, .012 - shift], pitch, upperRoll);
    pose.headDrop = mode === "neck" ? .042 - .093 * headLift(f) : mode === "stretch" ? .030 : profile.headSupport ? -.018 : .03;
    if (mode === "neck") pose.headAim = [0, .392 * headLift(f), 1];
    pose.lh = [0, .137, pose.hips[2]];
    pose.rh = [0, .340, pose.hips[2]];

    for (const [side, sign] of sides) {
      const top = sign < 0;
      const hip = pose[side + "h"];
      const abduction = mode === "abduct" ? .57 * upperFoot(f) : mode === "circle" ? .28 + .23 * upperFoot(f) : 0;
      const double = mode === "both" || mode === "scissor";
      const kneeStacked = ["clam", "chest", "external", "internal", "sleeper", "neck"].includes(mode) || mode === "kick" && !top;
      if (mode === "clam") {
        const opening = top ? .91 * kneeLift(f) : 0;
        leg(pose, side, [-.041, top ? .146 : .066, -.546], [-Math.cos(opening), .060 + Math.sin(opening), .07], [-.115, -.014, -.069]);
      } else if (kneeStacked) {
        pose[side + "k"] = [-.327, top ? .330 : .132, -.239];
        pose[side + "a"] = [-.103, top ? .268 : .067, -.592];
        pose[side + "t"] = [-.221, top ? .269 : .067, -.653];
      } else if (mode === "adduct" && top) {
        leg(pose, side, [-.335, .107, -.322], [-.56, .785, -.27], [-.124, -.064, -.026], .024);
      } else if (mode === "quad" && top) {
        const flex = upperFoot(f);
        const ankle = [-.048, .321 + .113 * flex, mix(-.807, .056, flex)];
        leg(pose, side, ankle, [-.22, -.053, -1], [-.095, -.029, -.064]);
      } else if (mode === "kick" && top) {
        const stroke = legSeparation(f);
        const rise = kneeLift(f);
        const ankle = [-.33 * (1 - stroke), .307 + .246 * rise, mix(-.236 - .090 * kneeBack(f), -.787, stroke)];
        leg(pose, side, ankle, [-.933, .58, .090], [-.13, -.047, -.043]);
      } else {
        const angle = top ? abduction + (double ? .54 * upperFoot(f) : 0) : mode === "adduct" ? .235 * lowerFoot(f) : double ? .42 * lowerFoot(f) : 0;
        const tilt = profile.backward && top ? .23 * upperFoot(f) : mode === "circle" && top ? .19 * Math.sin(4 * Math.PI * phase) : 0;
        const ray = [Math.sin(tilt), Math.sin(angle) - (top ? .037 : .067), -Math.cos(angle) * Math.cos(tilt)];
        const ankle = add(hip, scale(ray, .821));
        leg(pose, side, ankle, [-.994, .11, -.078], [-.119, -.04, -.036]);
      }

      const shoulder = pose[side + "s"];
      let wrist = top ? [-.376, .065, .413] : add(pose.head, [-.069, -.126, .109]);
      let pole = top ? [1, -.477, .087] : [.047, -1, -.28];
      let fingers = top ? [-.98, -.012, .165] : [0, -.07, 1];
      if (mode === "stretch") {
        const draw = handTravel(f);
        wrist = add(shoulder, [-.03, top ? -.102 : .026, .567 + .050 * draw]);
        fingers = [0, -.026, 1];
        pole = [top ? -.82 : .41, .038, .092];
      } else if (mode === "chest") {
        const twist = Math.PI * open;
        if (top) {
          wrist = add(shoulder, [-.604 * Math.cos(twist), .551 * Math.sin(twist) - .119 + .046 * handHeight(f), .032]);
          pole = [-Math.cos(twist), 1, .082];
          fingers = [-Math.cos(twist), .957 * Math.sin(twist), .013];
        } else {
          wrist = [-.566, .065, .459];
          pole = [-.56, .23, .74];
        }
      } else if (mode === "quad" && top) {
        const flex = upperFoot(f);
        wrist = blend(wrist, add(pose[side + "a"], [0, .039, .043]), flex);
        fingers = [0, -.34, -.94];
        pole = [.39, .24, -.88];
      } else if (mode === "sleeper") {
        const drive = handTravel(f);
        const elbow = [-.315, .111, .526];
        const angle = mix(.17, 1.255, drive);
        const ray = [-Math.cos(angle), .887 * Math.sin(angle), 0];
        const press = add(elbow, scale(ray, .359));
        if (!top) {
          pose[side + "e"] = elbow;
          pose[side + "w"] = press;
          pose[side + "Fingers"] = ray;
          continue;
        }
        wrist = add(press, [.042, .047, .045]);
        fingers = [-.90, -.35, .046];
        pole = [-.57, -.54, -.14];
      } else if (mode === "external" && top || mode === "internal" && !top) {
        const rotation = handHeight(f) * Math.PI * .46;
        const elbow = add(shoulder, [top ? -.032 : -.015, top ? .017 : .033, -.250]);
        const ray = [-Math.cos(rotation), Math.sin(rotation), 0];
        pose[side + "e"] = elbow;
        pose[side + "w"] = add(elbow, scale(ray, .368));
        pose[side + "Fingers"] = ray;
        pose[side + "PalmSide"] = [0, .021, 1];
        continue;
      } else if (!top && !profile.headSupport) {
        wrist = [.018, .072, .732];
        pole = [.86, -.38, .158];
      }
      arm(pose, side, wrist, pole, fingers, [0, 1, .053]);
    }
    return pose;
  };
}
