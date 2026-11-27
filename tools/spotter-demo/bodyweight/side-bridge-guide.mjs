import { add, arm, blend, leg, mix, scale, sides, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = t => Math.max(0, Math.min(1, t));

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / span);
}

export function sideBridgeGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const nearLeft = profile.nearLeft === true;
  const topHand = nearLeft ? 6 : 4;
  const topFoot = nearLeft ? 10 : 8;
  const bottomFoot = nearLeft ? 8 : 10;
  const travel = range(frames, f => -f[2][1]);
  const legRise = range(frames, f => -f[topFoot][1]);
  const bottomRise = range(frames, f => -f[bottomFoot][1]);
  const wristRise = range(frames, f => -f[topHand][1]);
  const tuck = range(frames, f => -Math.hypot(f[topFoot - 1][0] - f[1][0], f[topFoot - 1][1] - f[1][1]));
  const drop = range(frames, f => f[1][1]);
  const raised = ["tuck", "swing", "twist", "adduct", "kick", "bend"].includes(mode);
  const palmSupport = mode === "bend" || mode === "kick" || profile.palm;
  const floor = .024;

  return phase => {
    const f = guideAt(frames, phase);
    const active = raised ? 1 : travel(f);
    const reach = mode === "twist" ? wristRise(f) : 0;
    const bodyP = mode === "bend" ? drop(f) : 0;
    const shift = mode === "kick" ? .041 : 0;
    const center = [0, palmSupport ? .349 + .233 * active + .069 * bodyP : .148 + .232 * active, -.187];
    const angle = palmSupport ? 1.074 + .109 * bodyP : .94 + .370 * active;
    const roll = Math.PI / 2 + (mode === "twist" ? -.581 + 1.12 * reach : 0);
    const pose = torso(center, angle, roll);
    pose.headDrop = mode === "bend" ? .030 : -.027;
    pose.lh = add(center, [0, -.101, 0]);
    pose.rh = add(center, [0, .103, 0]);
    const kneeSupport = mode === "knees" || mode === "kick";
    for (const [side, sign] of sides) {
      const upper = sign < 0;
      const hip = pose[side + "h"];
      if (kneeSupport && (!upper || mode === "knees")) {
        const knee = [0, upper ? .184 : .108, -.523];
        pose[side + "k"] = knee;
        pose[side + "a"] = add(knee, [.405, -.007, -.020]);
        pose[side + "t"] = add(pose[side + "a"], [.126, -.039, -.012]);
      } else {
        const open = upper && (mode === "star" || mode === "swing" || mode === "kick") ? legRise(f) : 0;
        const bent = upper && mode === "tuck" ? tuck(f) : 0;
        const stagger = upper && mode === "stagger";
        const liftLower = !upper && mode === "adduct" ? bottomRise(f) : 0;
        const topCurve = upper && mode === "kick" ? .647 * Math.cos(phase * Math.PI * 2) : 0;
        const raw = add(hip, [topCurve, -.157 + (upper ? .629 * open : 0), -.78]);
        let ankle = [stagger ? -.275 : -.038, upper && !stagger ? .178 : .109, -.961];
        let pole = [mode === "stagger" ? -.68 : -.97, .061, .13];
        if (upper && (mode === "star" || mode === "swing" || mode === "kick")) {
          const ray = unit([raw[0] - hip[0], raw[1] - hip[1], raw[2] - hip[2]]);
          ankle = add(hip, scale(ray, .832));
        } else if (upper && mode === "tuck") {
          ankle = blend(ankle, [-.370, .516, -.151], bent);
          pole = [-.85, .44, .080];
        } else if (upper && mode === "topBent") {
          ankle = [-.231, .175 + .098 * active, -.733];
          pole = [-.81, .44, .040];
        } else if (!upper && mode === "adduct") {
          ankle = [-.289, .107 + .224 * liftLower, -.568];
          pole = [-.52, -.67, -.59];
        } else if (upper && mode === "adduct") {
          ankle[1] = .111;
        }
        const grounded = !upper && liftLower < .02 || stagger || upper && mode === "adduct";
        leg(pose, side, ankle, pole, [-.124, -.046, -.032], grounded ? floor : undefined);
      }

      const shoulder = pose[side + "s"];
      if (!upper && !palmSupport) {
        const elbow = [-.006, .091, shoulder[2] - .012];
        pose[side + "e"] = elbow;
        pose[side + "w"] = add(elbow, [-.353, -.019, .058]);
        pose[side + "Fingers"] = [-.99, -.027, .055];
        continue;
      }
      let wrist = upper ? add(center, [-.120, .113, .079]) : [-.030 - shift, .066, shoulder[2]];
      let fingers = upper ? [.025, -.63, -.79] : [-1, -.024, .058];
      let elbow = upper ? [.028, .575, -.85] : [.01, .051, -.99];
      if (upper && mode === "swing") {
        const swing = wristRise(f);
        wrist = add(shoulder, [-.052 - .042 * swing, .571 * swing, -.592 * (1 - swing)]);
        fingers = [-.061, .992 * swing, -.942 * (1 - swing)];
        elbow = [-.52, .57, -.69];
      } else if (upper && mode === "twist") {
        wrist = blend([-.377, .313, .070], add(shoulder, [0, .604, -.063]), reach);
        fingers = [-.903 * (1 - reach), .99 * reach, -.065];
        elbow = [-.42, .83, .996];
      } else if (upper && mode === "bend") {
        wrist = add(shoulder, [-.016, .38 - .206 * bodyP, .491 + .072 * bodyP]);
        fingers = [0, .39 - .265 * bodyP, .829];
        elbow = [.54, .693, .299];
      } else if (upper && mode === "kick") {
        wrist = add(pose.head, [.069, .034, -.077]);
        fingers = [-.90, -.19, .106];
        elbow = [.53, .86, -.23];
      }
      arm(pose, side, wrist, elbow, fingers, [0, 1, .021]);
    }
    return pose;
  };
}
