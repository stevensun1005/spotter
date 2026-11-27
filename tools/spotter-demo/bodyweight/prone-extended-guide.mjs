import { add, arm, blend, leg, legAngles, mix, scale, sides, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = n => Math.min(1, Math.max(0, n));

function range(frames, read) {
  const samples = frames.map(read);
  const low = Math.min(...samples);
  const width = Math.max(.05, Math.max(...samples) - low);
  return f => clamp((read(f) - low) / width);
}

export function proneExtendedGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const facing = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const chest = range(frames, f => -f[1][1]);
  const hipHeight = range(frames, f => -f[2][1]);
  const armHeight = [4, 6].map(index => range(frames, f => -f[index][1]));
  const handForward = [4, 6].map(index => range(frames, f => facing * (f[index][0] - f[1][0])));
  const ankleHeight = [8, 10].map(index => range(frames, f => -f[index][1]));
  const direction = range(frames, f => f[0][0] - f[1][0]);
  const feet = mode === "plank";

  return phase => {
    const f = guideAt(frames, phase);
    const rise = chest(f);
    const arch = mode === "press" || mode === "swan";
    const shift = mode === "rock" ? .035 * Math.sin(phase * Math.PI * 4) : 0;
    const height = feet ? .178 + .233 * hipHeight(f) : mode === "rock" ? .205 : .143;
    const angle = -Math.PI / 2 + (arch ? .27 + .69 * rise : mode === "rock" ? .225 + .412 * rise : mode === "kick" && (profile.forearm || profile.halfFrog) ? .26
      : mode === "twist" ? .335 : .025 + .214 * rise);
    const tilt = mode === "twist" ? .515 * (direction(f) - .5) : 0;
    const pose = torso([0, height, -.239 + shift], angle, Math.PI + tilt);
    pose.headDrop = -.023;

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const handLift = armHeight[index](f);
      const legLift = ankleHeight[index](f);
      const hip = pose[side + "h"];
      pose[side + "h"] = [-sign * .103, hip[1], hip[2]];
      if (mode === "rock") {
        const femur = .122 + .430 * legLift;
        legAngles(pose, side, -sign, femur, femur + 1.84);
      } else if (mode === "kick") {
        const a = f[index ? 10 : 8];
        const k = f[index ? 9 : 7];
        const thigh = Math.atan2(f[2][1] - k[1], (k[0] - f[2][0]) * -facing);
        const shin = Math.atan2(k[1] - a[1], (a[0] - k[0]) * -facing);
        legAngles(pose, side, -sign, thigh * .18, Math.min(2.54, Math.max(-.046, shin)), .013);
      } else if (mode === "scorpion") {
        const sweep = legLift;
        const endpoint = [(-sign * .136) + sign * .54 * sweep, .111 + .548 * sweep, mix(.514, .083, sweep)];
        leg(pose, side, endpoint, [-sign * .84, .59, .032], [sign * .039, -.065, .129]);
      } else {
        const extended = mode === "swim" || mode === "locust" || mode === "twist" || mode === "legCircle" || mode === "extend" || mode === "swan";
        const ch = mode === "legCircle" ? .108 * Math.sin(8 * Math.PI * phase) * legLift : 0;
        const thigh = extended ? legLift * (profile.hold ? .297 : .565) : 0;
        const ray = [-sign * .029 + ch, -.052 + .835 * Math.sin(thigh), .831 * Math.cos(thigh)];
        const stance = feet ? [(-sign * .107), .149, .553] : add(pose[side + "h"], mode === "swan" ? scale(unit(ray), .844) : ray);
        leg(pose, side, stance, [-sign * .069, -.74, .54], [-sign * .022, feet ? -.137 : -.042, feet ? .055 : .124], feet ? .024 : undefined);
      }

      const shoulder = pose[side + "s"];
      const support = [-sign * .198, .066, -.719];
      let wrist = [-sign * .209, .078, -.123];
      let fingers = [0, -.034, .984];
      let elbow = [-sign * .66, -.627, .083];
      let palm = [-1, 0, .015];
      if (mode === "rock") {
        wrist = add(pose[side + "a"], [sign * .047, .039, -.050]);
        fingers = [-sign * .71, -.095, .661];
        elbow = [-sign * .56, .57, 1];
      } else if (mode === "kick" && (profile.forearm || profile.halfFrog && index > 0)) {
        pose[side + "e"] = [-sign * .194, .092, -.666];
        pose[side + "w"] = [-sign * .193, .071, -1.021];
        pose[side + "Fingers"] = [0, -.041, -1];
        continue;
      } else if (mode === "kick" && profile.clasp) {
        wrist = [sign * .025, .229 + .151 * (1 - legLift), mix(.109, -.574, legLift)];
        fingers = [sign * .58, .15, .79];
        elbow = [-sign * .72, .32, .110];
      } else if (mode === "kick" && profile.hold && legLift > .05) {
        wrist = blend(wrist, add(pose[side + "a"], [sign * .025, .042, -.018]), legLift);
        elbow = [-sign * .95, .033, .125];
      } else if (arch || feet) {
        const rail = mode === "swan" ? clamp((handForward[index](f) - .37) * 1.95) : 0;
        wrist = blend(support, add(shoulder, [-sign * .016, .056, -.601]), rail);
        elbow = [-sign * .20, -.64, .633];
        fingers = [0, -.012, -1];
      } else if (mode === "scorpion") {
        wrist = add(shoulder, [-sign * .600, -.044, .027]);
        fingers = [-sign, -.04, .026];
      } else if (mode === "locust" || mode === "raiseBack") {
        const reach = .283 + .294 * handLift;
        wrist = add(shoulder, [-sign * .037, .019 + .108 * handLift, reach]);
        elbow = [-sign * .47, .58, .19];
        palm = [1, 0, .037];
      } else {
        wrist = add(shoulder, [-sign * .052, -.061 + .233 * handLift, -.578]);
        fingers = [0, .051, -.998];
      }
      arm(pose, side, wrist, elbow, fingers, palm);
    }
    return pose;
  };
}
