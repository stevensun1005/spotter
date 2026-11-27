import { add, arm, blend, leg, legAngles, mix, sides, stand, torso } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return frame => clamp((read(frame) - low) / span);
}

export function quadrupedExtendedGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const facing = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const neckLift = range(frames, f => -f[1][1]);
  const headLower = range(frames, f => f[0][1]);
  const neckAdvance = range(frames, f => facing * f[1][0]);
  const hipLower = range(frames, f => f[2][1]);
  const hipTravel = range(frames, f => f[2][0]);
  const kneeWidth = range(frames, f => Math.abs(f[7][1] - f[9][1]));
  const wristHeight = [4, 6].map(index => range(frames, f => -f[index][1]));
  const wristAdvance = [4, 6].map(index => range(frames, f => facing * (f[index][0] - f[2][0])));
  const ankleLift = [8, 10].map(index => range(frames, f => -f[index][1]));
  const ankleAdvance = [8, 10].map(index => range(frames, f => facing * (f[index][0] - f[2][0])));
  const thighLift = [7, 9].map(index => range(frames, f => -f[index][1]));

  return phase => {
    const f = guideAt(frames, phase);
    const chestLow = 1 - neckLift(f);
    const round = mode === "cat" ? headLower(f) : mode === "abs" ? neckLift(f) : 0;
    const bow = mode === "puppy" || mode === "child" ? chestLow
      : mode === "frog" ? .45 + .29 * (profile.topSource ? hipTravel(f) : hipLower(f)) : 0;
    const armAway = [4,6].map(index => Math.hypot(f[index][0] - frames[0][index][0], f[index][1] - frames[0][index][1]));
    const activeArm = mode === "reach" && armAway[1] > armAway[0] ? 1 : 0;
    const armSign = activeArm ? -1 : 1;
    const spin = mode === "reach" ? wristHeight[activeArm](f) : 0;
    const thread = mode === "needle" || mode === "reach" ? clamp((1 - wristAdvance[activeArm](f)) - .63 * spin) : 0;
    const hips = [0, .526 + .045 * round - (mode === "child" ? .223 : .039) * bow - .067 * thread, -.247 - (mode === "child" ? .224 : .16) * bow];
    const angle = mode === "ceiling" ? 1.61 - 1.12 * neckLift(f) : mode === "sissy" ? -.87 * hipLower(f)
      : mode === "triceps" ? 1.51 + .269 * chestLow : 1.525 + .289 * bow + .35 * thread;
    const pose = mode === "sissy" ? stand([0, .512 - .154 * hipLower(f), -.14 - .302 * hipLower(f)], angle)
      : torso(hips, angle, mode === "needle" || mode === "reach" ? armSign * (.66 * thread - 1.17 * spin) : 0);
    pose.headDrop = mode === "cat" ? -.005 + .060 * round : mode === "puppy" ? .021 + .067 * bow : .009;
    if (mode === "cat") {
      pose.headAim = [0, -.654 * round, 1 - .155 * round];
      pose.chest[1] += .089 * round;
      pose.neck[1] += .041 * round;
      for (const [side] of sides) pose[side + "s"][1] += .047 * round;
    }
    if (mode === "abs") {
      pose.chest[1] += .031 * round;
      pose.neck[1] += .023 * round + .014 * neckAdvance(f);
    }

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const opposite = sign > 0 ? 1 : 0;
      const planted = [sign * .122, .115, -.238];
      const lift = ankleLift[index](f);
      const up = thighLift[index](f);
      const taking = profile.side === "right" ? index === 1 : index === 0;
      const kneeP = mode === "frog" ? [sign * (profile.topSource ? .246 + .168 * kneeWidth(f) : .393), .109, -.231]
        : mode === "sissy" ? [sign * .124, .109, -.139] : planted;
      pose[side + "k"] = kneeP;
      pose[side + "a"] = add(kneeP, [mode === "frog" ? sign * .075 : -sign * .006, -.008, -.408]);
      pose[side + "t"] = add(pose[side + "a"], [sign * .014, -.045, -.134]);
      if (mode === "donkey" && index === 0) {
        const liftAngle = mix(-1.554, -3.089, up);
        const shin = mix(-3.094, -4.764, lift);
        const cross = profile.cross ? clamp(Math.sin(phase * Math.PI * 2 - Math.PI * .88)) : 0;
        legAngles(pose, side, sign, liftAngle, shin, -.132 * cross * lift);
        if (cross > .01) {
          const ankle = add(pose[side + "a"], [-sign * .249 * cross * lift, 0, .019 * cross]);
          leg(pose, side, ankle, [-sign * .524, -.981, -.34], [0, .092, -.102]);
        }
      } else if (mode === "straight" && index === 0 || mode === "swim" && ankleLift[index](f) > .10) {
        const height = mode === "straight" ? .253 + .375 * lift : .168 + .374 * lift;
        const target = [sign * .147, height, mode === "straight" ? -.981 - .066 * lift : -.734 - .351 * lift];
        leg(pose, side, target, [sign * .08, -.71, -.59], [sign * .014, -.055, -.131]);
      } else if (mode === "quad" && taking) {
        const ankle = [sign * .124, mix(.108, .460, lift), mix(-.646, -.331, lift)];
        leg(pose, side, ankle, [sign * .063, -.99, -.16], [sign * .013, -.067, -.107]);
      } else if (mode === "tiger" && (lift > .05 || ankleAdvance[index](f) > .52)) {
        const reach = ankleAdvance[index](f);
        const ankle = [sign * .114, .102 + .538 * lift * (1 - reach), mix(-1.037, .059, reach)];
        leg(pose, side, ankle, [sign * .009, -.979, -.04], [sign * .014, -.064, -.125]);
      }

      const hand = [sign * .209, .066, .273];
      let wrist = hand;
      let elbow = [sign * .62, -.38, -.74];
      let fingers = [0, -.025, 1];
      let palm = [sign, .032, .027];
      if (mode === "ceiling") {
        wrist = blend(hand, add(pose[side + "a"], [sign * .043, .083, .094]), neckLift(f));
        fingers = [0, -.084 - .58 * neckLift(f), 1 - 1.85 * neckLift(f)];
      } else if (mode === "puppy" || mode === "child") {
        const sweep = mode === "child" ? .038 * (f[index ? 6 : 4][0] - frames[0][index ? 6 : 4][0]) : 0;
        wrist = [sign * .214 + clamp(Math.abs(sweep)) * .19 * Math.sign(sweep), .061, mix(.294, .936, wristAdvance[index](f))];
      } else if (mode === "quad" && taking) {
        wrist = blend(hand, add(pose[side + "a"], [sign * .029, .025, .013]), lift);
        fingers = [0, -.44 * lift, 1 - 1.76 * lift];
        elbow = [sign * .85, -.146, -.58];
      } else if (mode === "swim") {
        const paired = ankleLift[opposite](f);
        wrist = blend(hand, add(pose[side + "s"], [sign * .042, -.041, .597]), paired);
        fingers = [0, -.056, 1];
        elbow = [sign * .26, -.91, .08];
      } else if ((mode === "needle" || mode === "reach") && index === activeArm) {
        const across = [-sign * .414, .059, .439];
        const top = add(pose[side + "s"], [sign * .093, .589, .041]);
        wrist = blend(blend(hand, across, thread), top, mode === "reach" ? spin : 0);
        fingers = [-sign * .90 * thread, .92 * spin, .13];
        palm = [-1, .11, .041];
      } else if (mode === "frog" || mode === "triceps") {
        wrist = [sign * .214, .062, .585];
        const supportY = mode === "triceps" ? mix(.376, .080, chestLow) : .080;
        const forearmZ = mode === "triceps" ? mix(.449, .256, chestLow) : .234;
        pose[side + "e"] = [sign * .197, supportY, forearmZ];
        pose[side + "w"] = wrist;
        pose[side + "Fingers"] = [0, -.027, 1];
        continue;
      } else if (mode === "sissy") {
        wrist = add(pose[side + "s"], [sign * .048, -.11, .565]);
        elbow = [sign * .19, -.74, -.15];
      }
      arm(pose, side, wrist, elbow, fingers, palm);
    }
    return pose;
  };
}
