import { add, arm, leg, mix, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const floor = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - floor);
  return frame => clamp((read(frame) - floor) / span);
}

export function lungeMobilityGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const d = Math.sign(frames[0][8][0] - frames[0][10][0]) || 1;
  const depth = range(frames, f => f[2][1]);
  const lean = range(frames, f => Math.abs(f[1][0] - f[2][0]));
  const extension = range(frames, f => f[7][1]);
  const gap = range(frames, f => Math.abs(f[8][0] - f[10][0]));
  const dynamic = mode === "step" || mode === "longStep";
  const floorArms = ["hands", "upRotate", "elbows", "tRotate"].includes(mode);
  const rearAir = floorArms || mode === "high" || mode === "split";
  return phase => {
    const f = guideAt(frames, phase);
    const shift = (f[2][0] - frames[0][2][0]) * .006 * d;
    const drop = depth(f);
    const bend = lean(f);
    const stretch = mode === "hinge" ? extension(f) : 0;
    const advance = gap(f);
    const breathing = profile.hold ? .012 * Math.sin(phase * Math.PI * 4) : 0;
    const frontSign = profile.front === "right" ? -1 : 1;
    const hipZ = mode === "hinge" ? mix(.084, -.262, stretch) : mode === "split" ? -.010 : dynamic ? mix(0, .031, advance) : .054 + shift;
    const hipY = dynamic ? .893 - .350 * drop : mode === "split" ? .873 - (profile.shallow ? .205 : .337) * drop
      : mode === "high" ? .601 + breathing : floorArms ? .341 + breathing : mode === "hinge" ? .419 + .058 * stretch : .518 + breathing - (profile.side ? .063 * drop : 0);
    const pitch = floorArms ? mode === "elbows" ? 1.45 : mode === "tRotate" ? 1.28 : .94
      : mode === "hinge" ? .91 - .235 * bend : profile.tilt ? .071 : .036;
    const yaw = mode === "prayer" ? frontSign * (.39 + .52 * bend) : mode === "upRotate" || mode === "tRotate" ? frontSign * (.18 + .051 * bend) : 0;
    const sideAngle = mode === "upRotate" || mode === "tRotate" ? frontSign * -.43 : profile.arc ? frontSign * .24 : 0;
    const hips = [profile.side ? .11 * drop : 0, hipY, hipZ];
    const pose = stand(hips, pitch, yaw, sideAngle);
    for (const [side, sign] of sides) {
      const inFront = sign === frontSign;
      const length = dynamic ? advance : 1;
      const footZ = inFront ? mix(.062, mode === "hinge" ? .511 : .354, length) : mix(.062, profile.rearStraight ? -.763 : rearAir ? -.687 : -.581, length);
      const width = profile.side && inFront ? .224 + .310 * drop : .136;
      const upperHeel = mode === "split" && profile.heel && inFront ? .095 * clamp(1 - drop * 2.1) * clamp((phase - .38) * 3.70) : 0;
      const ankle = [sign * width, inFront ? .110 + upperHeel : .105 + .040 * length * Number(rearAir), footZ];
      const toe = inFront ? [sign * .016, -.067 - upperHeel * .61 + .048 * stretch, .128] : [sign * .013, profile.rearStraight ? -.131 : -.092, .107];
      const kneeOnGround = !inFront && !rearAir && (!dynamic || drop > .87);
      if (kneeOnGround) {
        pose[side + "k"] = [sign * .119, .111, footZ + .402];
        pose[side + "a"] = ankle;
        pose[side + "t"] = add(ankle, toe);
      } else {
        const kneeGuide = [sign * .048, inFront ? .128 : -.67, 1];
        leg(pose, side, ankle, kneeGuide, toe, (inFront && upperHeel < .005 || !inFront && profile.rearStraight) ? .024 : undefined);
      }
      const shoulder = pose[side + "s"];
      let wrist = add(hips, [sign * .164, .102, .067]);
      let elbow = [sign * .81, -.46, -.28];
      let fingers = [0, -.56, .83];
      if (mode === "high" || mode === "reach") {
        const reaching = profile.single != null;
        const lift = !reaching || !inFront;
        wrist = lift ? add(shoulder, [sign * (profile.arc ? .272 : -.066), .577, .024])
          : profile.arc ? add(pose[side + "k"], [sign * .016, .058, -.039]) : add(hips, [sign * .155, -.024, -.35]);
        fingers = lift ? [sign * (profile.arc ? -.31 : .07), .947, .04] : [0, -.26, -.96];
      } else if (floorArms || mode === "hinge") {
        const elbows = mode === "elbows" || mode === "tRotate" && !inFront;
        const floorX = inFront ? sign * .06 : -frontSign * .235;
        wrist = [floorX, .067, elbows ? .560 : .347];
        fingers = [0, -.022, 1];
        elbow = [sign * .61, -1, -.08];
        if (elbows) {
          pose[side + "e"] = [floorX, .088, shoulder[2] - .087];
          pose[side + "w"] = [floorX, .073, shoulder[2] + .268];
          pose[side + "Fingers"] = [0, -.02, 1];
          continue;
        }
        if (mode === "upRotate" && inFront) {
          wrist = add(shoulder, [sign * .083, .602, -.070]);
          fingers = [sign * .10, .97, -.02];
        } else if (mode === "tRotate" && inFront) {
          wrist = add(pose.head, [sign * .092, .037, -.085]);
          elbow = [sign * .742, .862, -.095];
          fingers = [-sign * .61, -.198, .732];
        }
      } else if (mode === "prayer") {
        wrist = add(pose.chest, [frontSign * .161 + sign * .027, .101, .312]);
        fingers = [frontSign * .182, .969, -.023];
      } else if (mode === "split" && profile.sprint) {
        wrist = add(shoulder, inFront ? [sign * .098, -.435, -.353] : [sign * .058, -.019, .398]);
        fingers = inFront ? [0, -.54, -.83] : [0, .50, .866];
      }
      arm(pose, side, wrist, elbow, fingers);
    }
    return pose;
  };
}
