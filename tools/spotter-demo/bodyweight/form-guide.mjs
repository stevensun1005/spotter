import { add, arm, blend, leg, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";
import { plankVariant, pushUp } from "./floor.mjs";
import { lowerGuideMotion } from "./lower-guide.mjs";

const bodyJoints = ["hips", "chest", "neck", "head", "ls", "le", "lw", "rs", "re", "rw", "lh", "lk", "la", "lt", "rh", "rk", "ra", "rt"];
const translate = (pose, by) => {
  for (const joint of bodyJoints) pose[joint] = add(pose[joint], by);
  return pose;
};

function standing(track, phase, sideView) {
  const [head, neck, pelvis] = guideAt(track, phase);
  const spineTilt = .027 * (neck[0] - pelvis[0]);
  const pulse = .012 * Math.sin(4 * Math.PI * phase);
  const pose = stand([0, .911 + .25 * pulse, 0], sideView ? spineTilt : .020, 0, sideView ? 0 : spineTilt);
  const headShift = (head[0] - neck[0]) * .013;
  pose.head = add(pose.head, [sideView ? 0 : headShift, pulse, sideView ? headShift : 0]);
  pose.headAim = [0, 0, 1];
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .132, .085, .014], [sign * .065, -.024, .94], [sign * .018, -.068, .133], 0);
    const shoulder = pose[side + "s"];
    arm(pose, side, [sign * .251, shoulder[1] - .598, shoulder[2] + .020], [sign * .36, -.45, -.64], [0, -1, .07]);
  }
  return pose;
}

function supportAlignment(pose, hipError) {
  const foot = blend(pose.la, pose.ra, .5);
  const y = pose.hips[1] + hipError;
  const length = Math.min(.835, Math.hypot(pose.hips[1] - foot[1], pose.hips[2] - foot[2]));
  const z = foot[2] + Math.sqrt(Math.max(.30, length ** 2 - (y - foot[1]) ** 2));
  pose.hips = [0, y, z];
  pose.chest = blend(pose.hips, pose.neck, .614);
  for (const [side, sign] of sides) {
    const ankle = pose[side + "a"];
    pose[side + "h"] = [sign * .103, y, z];
    leg(pose, side, ankle, [sign * .082, -.86, .37], [sign * .014, -.067, .123], 0);
  }
  return pose;
}

function horizontal(track, phase, mode, correct) {
  const frame = guideAt(track, phase);
  const breath = .014 * Math.sin(4 * Math.PI * phase);
  if (mode === "forearm") {
    const base = plankVariant(phase, { forearm: true, hold: true });
    const shift = correct ? 0 : (140.68 - frame[2][1]) * .011;
    return supportAlignment(base, shift + breath * .3);
  }
  const depth = mode === "end" ? Math.max(0, Math.min(1, (frame[1][1] - 116.78) / 25.16)) : 0;
  const base = pushUp(.47 * depth, { width: .201 });
  const adjustment = correct ? breath * .35 : mode === "end" ? .13 + .12 * depth : (133.80 - frame[2][1]) * .009;
  return supportAlignment(base, adjustment);
}

export function formGuideMotion(guide, mode, yaw, offset) {
  const angle = yaw * Math.PI / 180;
  const right = [Math.cos(angle) * offset, 0, -Math.sin(angle) * offset];
  const left = right.map(value => -value);
  const guideFor = track => ({ frames: track });
  const lower = [guide.frames, guide.partnerFrames].map(track => lowerGuideMotion(guideFor(track), {
    startY: .437, plane: "side", hands: "hips", distance: .91, breath: true,
  }));
  return phase => {
    const both = [guide.frames, guide.partnerFrames].map((track, index) => {
      const pose = mode === "front" || mode === "side" ? standing(track, phase, mode === "side")
        : mode === "lunge" ? lower[index](phase) : horizontal(track, phase, mode, index === 0);
      return translate(pose, index === 0 ? right : left);
    });
    return { ...both[0], partner: both[1] };
  };
}
