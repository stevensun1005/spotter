import { add, arm, leg, mix, sides, stand } from "./pose.mjs";
import { backToWall } from "./standing.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function range(frames, read) {
  const values = frames.map(read);
  const minimum = Math.min(...values);
  const spread = Math.max(1, Math.max(...values) - minimum);
  return frame => clamp((read(frame) - minimum) / spread, 0, 1);
}

export function wallGuideMotion(guide, profile) {
  const { frames } = guide;
  const mode = profile.mode;
  const squat = mode === "sit";
  const seated = mode === "crunch" || mode === "heelTap" || mode === "legsUp";
  const rearSurface = ["backFlex", "wallArc", "military", "scapula", "sit", "tibialis"].includes(mode);
  const wristLift = [range(frames, f => -f[4][1]), range(frames, f => -f[6][1])];
  const ankleLift = [range(frames, f => -f[8][1]), range(frames, f => -f[10][1])];
  const footTip = [8, 10].map((joint, index) => {
    const tip = guide.dynamic?.find(([kind, origin]) => kind === "foot-tip" && origin === joint)?.[2];
    return tip == null ? ankleLift[index] : range(frames, f => -f[tip][1]);
  });
  const spread = range(frames, f => Math.abs(f[8][0] - f[10][0]));
  const pelvis = range(frames, f => f[2][1]);
  const shoulders = range(frames, f => f[1][0]);

  return phase => {
    const frame = guideAt(frames, phase);
    const fold = pelvis(frame);
    const press = shoulders(frame);
    const breath = profile.hold ? .013 * Math.sin(phase * Math.PI * 4) : 0;
    if (seated) {
      const standLegs = mode === "legsUp";
      const angle = -Math.PI / 2 + (mode === "crunch" ? .365 * press : .015);
      const hip = [0, .156, standLegs ? .423 : .057];
      const pose = stand(hip, angle);
      pose.headDrop = .026;
      for (const [side, sign] of sides) {
        const index = sign > 0 ? 0 : 1;
        if (standLegs) {
          const wide = profile.spread ? spread(frame) : 0;
          const y = profile.spread ? .977 - .068 * wide + breath : .813 + .169 * ankleLift[index](frame) + breath;
          leg(pose, side, [sign * (.113 + .221 * wide), y, .490], [sign * .081, -.08, -.98],
            [sign * .010, .108, -.029]);
        } else {
          const lower = mode === "heelTap" ? 1 - ankleLift[index](frame) : 0;
          const foot = [sign * .133, .522 - .385 * lower, .493 - .212 * lower];
          leg(pose, side, foot, [sign * .075, .91, .17], [sign * .014, .105, .026], lower > .97 ? 0 : undefined);
        }
        const wrist = mode === "crunch" ? add(pose.head, [sign * .117, .021, -.056]) : [sign * .227, .055, hip[2] - .115];
        arm(pose, side, wrist, [sign * .72, -.12, -.59]);
      }
      return pose;
    }

    const width = profile.width ?? (squat ? .160 : .139);
    const wallClose = mode === "slide" || mode === "triceps";
    const hipY = squat ? .823 - .399 * fold + breath : rearSurface ? .909 + breath : (mode === "plank" ? .816 : .909) - .035 * press + breath;
    const hipZ = rearSurface ? -.443 : mode === "triceps" ? .173 : wallClose ? .237 : mode === "plank" ? .030 : mode === "lat" ? .112
      : -.110 + (mode === "push" ? .146 * press : .026 * press);
    const pitch = rearSurface ? .011 : mode === "push" ? .248 + .212 * press : mode === "plank" ? .469
      : mode === "triceps" ? .27 + .26 * press : .128;
    const pose = stand([profile.single && squat ? -.077 * fold : 0, hipY, hipZ], pitch);
    if (mode === "triceps") pose.headDrop = .037 + .034 * press;
    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const moving = sign > 0;
      const reach = wristLift[index](frame);
      const ankleDrive = ankleLift[index](frame);
      const ankle = [sign * width, .086, rearSurface ? squat ? -.006 : -.151 : wallClose ? .079 : mode === "plank" ? -.378 : -.198];
      if (squat && profile.single && moving) {
        ankle[1] += .258 * Math.max(.22, ankleDrive);
        ankle[2] += .218 * Math.max(.22, ankleDrive);
      }
      if (mode === "opposite") {
        ankle[1] += .248 * ankleDrive;
        ankle[2] -= .413 * ankleDrive;
      }
      if (mode === "sprint") {
        ankle[1] += .338 * ankleDrive;
        ankle[2] += .304 * ankleDrive;
      }
      const toeAngle = mode === "tibialis" ? -.45 + .71 * footTip[index](frame) : -.47;
      leg(pose, side, ankle, [sign * .081, -.024, .976], [sign * .013, .145 * Math.sin(toeAngle), .145 * Math.cos(toeAngle)],
        ankle[1] <= .09 && mode !== "tibialis" ? 0 : undefined);

      const shoulder = pose[side + "s"];
      let wrist = add(shoulder, [sign * .049, -.594, .044]);
      let elbow = [sign * .52, -.51, -.52];
      let fingers = [0, -.98, .05];
      if (mode === "backFlex" || mode === "wallArc") {
        const theta = 2.79 * reach;
        wrist = mode === "wallArc" ? add(shoulder, [sign * .602 * Math.sin(theta), -.608 * Math.cos(theta), -.036])
          : add(shoulder, [sign * .046, -.610 * Math.cos(theta), .608 * Math.sin(theta)]);
      } else if (mode === "military" || mode === "scapula") {
        const stretch = mode === "military" ? reach : .51 * reach;
        wrist = [sign * mix(.359, .214, stretch), .464 + hipY + .562 * stretch, -.504];
        elbow = [sign * .91, -.43, -.16];
        fingers = [0, 1, .035];
      } else if (mode === "slide" || mode === "plank") {
        const forearmY = mode === "plank" ? 1.168 + breath : 1.174 + .220 * reach;
        pose[side + "e"] = [sign * .219, forearmY, .507];
        pose[side + "w"] = [sign * .216, forearmY + .353, .511];
        pose[side + "Fingers"] = [0, 1, .021];
        continue;
      } else if (mode === "push" || mode === "sprint") {
        const contact = mode === "sprint" || !profile.single || moving;
        wrist = contact ? [sign * (profile.width ?? .204), mode === "sprint" ? 1.270 : 1.277, .513]
          : [sign * .162, 1.027, -.279];
        fingers = contact ? [0, 1, .021] : [0, -.90, -.21];
      } else if (mode === "opposite") {
        wrist = [sign * .21, 1.24 + .445 * reach, .513 - .116 * reach];
        fingers = [0, 1, .021];
      } else if (mode === "lat" && moving) {
        wrist = [sign * .285, 1.746 + .069 * reach, .513];
        fingers = [0, 1, .021];
      } else if (mode === "wrist" && moving) {
        wrist = [sign * .275, 1.204 + .069 * reach, .510];
        fingers = [0, -1, .024];
      } else if (mode === "triceps" && moving) {
        const e = add(shoulder, [sign * .013, .309 + .026 * reach, .174]);
        pose[side + "e"] = [e[0], e[1], .514];
        pose[side + "w"] = add(pose[side + "e"], [-sign * .027, -.223, -.285]);
        pose[side + "Fingers"] = [0, -.54, -.84];
        continue;
      }
      arm(pose, side, wrist, elbow, fingers);
    }
    return rearSurface ? backToWall(pose) : pose;
  };
}
