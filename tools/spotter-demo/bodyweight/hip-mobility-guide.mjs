import { add, arm, blend, leg, mix, scale, sides, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / span);
}

export function hipMobilityGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const direction = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const kneeReach = range(frames, f => direction * f[7][0]);
  const hipRise = range(frames, f => -f[2][1]);
  const kneeSpread = range(frames, f => Math.abs(f[7][0] - f[9][0]));
  const leftFoot = range(frames, f => -f[8][1]);
  const rightFoot = range(frames, f => -f[10][1]);
  const floor = .024;

  return phase => {
    const f = guideAt(frames, phase);
    const lift = hipRise(f);
    const knee = kneeReach(f);
    const twist = mode === "roll" ? profile.side * (1.21 * (profile.side > 0 ? leftFoot(f) : 1 - leftFoot(f))) : 0;
    const bridge = mode === "bridge";
    const abs = mode === "vertical" || mode === "point";
    const forceY = bridge ? .323 + .099 * lift : abs ? .162 + .144 * lift : .149;
    const pitch = -Math.PI / 2 - (bridge ? .393 + .155 * lift : abs ? .258 * lift : 0);
    const hips = [.049 * Math.sin(twist), forceY, -.306];
    const pose = torso(hips, pitch);
    pose.headDrop = .024;

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const top = near || mode === "tuckBoth";
      const a = near ? leftFoot(f) : rightFoot(f);
      let toe = [sign * .015, .025, .139];
      let pole = [sign * .047, .96, .117];
      let target = [sign * .132, .085, .514];
      let surface;
      if (mode === "tuck" || mode === "tuckBoth") {
        target = top ? [sign * .135, mix(.093, .366, knee), mix(.52, -.008, knee)] : target;
      } else if (mode === "roll") {
        const legX = sign * .106;
        const tiltY = .294;
        pose[side + "h"] = add(hips, [legX * Math.cos(twist), .47 * legX * Math.sin(twist), .016]);
        const y = profile.floorDrop ? .083 + .466 * Math.cos(twist * 1.23) : .252 + tiltY * Math.cos(twist);
        target = [legX * .78 * Math.cos(twist) + tiltY * Math.sin(twist), y, .015];
        pole = [Math.sin(twist), Math.cos(twist), -.145];
        toe = [.079 * Math.sin(twist), .062 * Math.cos(twist), .122];
      } else if (mode === "figure") {
        target = near ? [.136, .111 + .231 * knee, .239 - .31 * knee] : [.088, .283 + .201 * knee, .150 - .217 * knee];
        if (!near) {
          pole = [-1, .48, -.031];
          toe = [.132, -.034, -.036];
        }
      } else if (bridge) {
        target = [sign * .193, .111, .324];
        toe = [sign * .016, -.063, .132];
        pole = [sign * (.12 + .80 * kneeSpread(f)), .86, .114];
        surface = floor;
      } else if (mode === "circle" || mode === "eight") {
        const t = 4 * Math.PI * phase;
        const sweep = mode === "circle" ? Math.sin(t) : Math.sin(t * .5);
        const y = mode === "circle" ? .777 + .141 * a : .366 + .463 * a;
        target = mode === "circle" ? near ? add(pose[side + "h"], scale(unit([.242 * sweep, y, .191 + .194 * Math.cos(t)]), .843)) : target
          : [sign * .110 + .25 * sweep, y, .135 + .31 * (1 - a)];
        toe = [sweep*.019, .13, .056];
      } else if (abs) {
        const angle = mode === "point" ? 1.492 + .05 * a : mix(.16, 1.51, a);
        const pointed = mode === "point" ? .017 + .032 * a : .045;
        target = add(pose[side + "h"], [sign * .015, .828 * Math.sin(angle), .823 * Math.cos(angle)]);
        toe = [sign * .016, .128 * Math.sin(angle) + pointed, .117 * Math.cos(angle) + .025];
        pole = [sign * .07, -.31, .95];
      }
      leg(pose, side, target, pole, toe, surface);
    }

    if (mode === "figure") {
      const cross = add(pose.lk, [.03, .063, -.054]);
      leg(pose, "r", cross, [-1, .39, -.034], [.13, .014, -.041]);
    }
    for (const [side, sign] of sides) {
      const shoulder = pose[side + "s"];
      let wrist = [sign * .229, .070, -.246];
      let fingers = [0, -.040, .99];
      let pole = [sign * .53, -.76, -.42];
      if (profile.overhead) {
        wrist = add(shoulder, [sign * .052, -.02, -.602]);
        fingers = [0, .023, -1];
      } else if (mode === "tuck" || mode === "tuckBoth" || mode === "figure") {
        const held = pose[mode === "tuckBoth" ? side + "k" : "lk"];
        const point = add(held, [sign * .058, -.038, .123]);
        wrist = blend(wrist, point, clamp(knee * 2.2));
        fingers = [0, .49, -.87];
      } else if (mode === "roll") {
        wrist = add(shoulder, [sign * .591, -.034, .061]);
        fingers = [sign, -.06, .03];
        pole = [sign * .51, -.91, -.08];
      } else if (mode === "eight") {
        wrist = [sign * .077, .060, hips[2] + .081];
        fingers = [0, -.04, 1];
      }
      arm(pose, side, wrist, pole, fingers);
    }
    return pose;
  };
}
