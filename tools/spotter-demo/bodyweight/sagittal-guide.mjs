import { add, arm, leg, legAngles, mix, sides, torso } from "./pose.mjs";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const limit = (value, low, high) => Math.min(high, Math.max(low, value));

export function guideAt(frames, phase) {
  const index = (phase * frames.length) % frames.length;
  const first = frames[Math.floor(index)];
  const second = frames[Math.ceil(index) % frames.length];
  const ease = (1 - Math.cos(Math.PI * (index % 1))) / 2;
  return first.map(([x, y], point) => [mix(x, second[point][0], ease), mix(y, second[point][1], ease)]);
}

export function sagittalGuideMotion(guide, profile) {
  const { frames } = guide;
  const facing = Math.sign(frames[0][2][0] - frames[0][0][0]);
  const scale = .607 / Math.max(...frames.map(frame => distance(frame[1], frame[2])));
  const legLengths = frames.flatMap(frame => [distance(frame[2], frame[7]), distance(frame[7], frame[8]),
    distance(frame[2], frame[9]), distance(frame[9], frame[10])]).sort((a, b) => a - b);
  const legScale = profile.legFit ? .423 / legLengths[Math.floor(legLengths.length / 2)] : scale;
  const origin = frames[0][2];
  const deck = .024;
  const localHipZ = -.326;
  const inPlane = ([x, y], [baseX, baseY]) => [facing * (x - baseX), baseY - y];
  const reaches = frames.flatMap(frame => [inPlane(frame[4], frame[1])[0], inPlane(frame[6], frame[1])[0]]);
  const farReach = Math.min(...reaches);
  const closeReach = Math.max(...reaches);
  const armDirection = (from, to, length) => {
    const [z, y] = inPlane(to, from);
    const magnitude = Math.max(Math.hypot(z, y), .001);
    return [0, y * length / magnitude, z * length / magnitude];
  };

  return (phase) => {
    const frame = guideAt(frames, phase);
    const [head, neck, hip] = frame;
    const [centerZ, centerY] = inPlane(hip, origin);
    const breath = profile.breath ? .009 * Math.sin(phase * Math.PI * 4) : 0;
    const hipY = (profile.hipBase ?? .154) + (profile.hipLift ? limit(centerY * scale, -.021, profile.bridge ? .284 : .178) : 0);
    const hipZ = localHipZ + (profile.hipLift ? limit(centerZ * scale, -.18, .15) : 0);
    const [torsoZ, torsoY] = inPlane(neck, hip);
    const rawAngle = Math.atan2(torsoZ, torsoY);
    const angle = profile.bridge ? -Math.PI / 2 - Math.atan2(Math.max(0, hipY - .165), .51)
      : profile.prone ? profile.extend ? limit(rawAngle, -1.61, -1.13) + breath : -Math.PI / 2
      : limit(rawAngle, -1.62, -.62);
    const twist = profile.twist ? .56 * Math.cos(phase * Math.PI * 2) : 0;
    const pose = torso([0, hipY, hipZ], angle, profile.prone ? Math.PI + twist : twist);
    pose.headDrop = profile.prone ? -.028 : .033;
    if (profile.chin) {
      const tuck = (head[0] - frames[0][0][0]) * facing * .009;
      pose.head[2] += tuck;
      pose.headAim = [0, 1, -.042 + tuck * 1.5];
    }

    for (const [side, sign] of sides) {
      const isLeft = side === "l";
      const [knee, ankle] = isLeft ? frame.slice(7, 9) : frame.slice(9, 11);
      const [elbow, wrist] = isLeft ? frame.slice(3, 5) : frame.slice(5, 7);
      const lateral = profile.prone ? -sign : sign;
      pose[side + "h"][0] = lateral * .103;
      const [thighZ, thighY] = inPlane(knee, hip);
      const [shinZ, shinY] = inPlane(ankle, knee);
      const thigh = Math.atan2(thighY, thighZ);
      const shin = Math.atan2(shinY, shinZ);
      legAngles(pose, side, lateral, thigh, shin, profile.cross ? .028 : 0);

      const contact = profile.plant === "both" || profile.plant === side ? 1
        : profile.plant === "guide" ? limit((ankle[1] - 143) / 8, 0, 1) : 0;
      if (contact || pose[side + "a"][1] < .107) {
        const [guideZ] = inPlane(ankle, origin);
        const z = mix(pose[side + "a"][2], localHipZ + limit(guideZ * legScale * (profile.footReach ?? 1), .245, .835), contact);
        const floor = pose[side + "a"][1] < .107;
        const y = floor ? .112 : mix(pose[side + "a"][1], .112, contact);
        leg(pose, side, [lateral * (profile.feetWidth ?? .126), y, z], [lateral * .084, .83, .13], [lateral * .015, -.067, .129],
          floor || contact > .99 ? deck : undefined);
      } else if (profile.cross) {
        const spread = Math.cos(phase * Math.PI * 2);
        const delta = lateral * (.165 * spread - .075);
        const goal = add(pose[side + "a"], [delta, 0, 0]);
        leg(pose, side, goal, [lateral * .31, .86, .081], [lateral * .016, -.061, .130]);
      } else if (profile.figureFour && !isLeft) {
        const contact = add(pose.lk, [-.014, .078, -.060]);
        leg(pose, side, contact, [-.94, .23, .16], [-.125, -.025, .022]);
      } else if (profile.external === side) {
        const sweep = limit((hipY - .156) * 3.8, 0, 1);
        leg(pose, side, add(pose[side + "a"], [sign * .175 * sweep, .014 * sweep, 0]), [sign * .78, .60, .04],
          [sign * .025, -.055, .125]);
      } else if (profile.frog) {
        const [otherKnee, otherAnkle] = isLeft ? frame.slice(9, 11) : frame.slice(7, 9);
        const [otherThighZ, otherThighY] = inPlane(otherKnee, hip);
        const [otherShinZ, otherShinY] = inPlane(otherAnkle, otherKnee);
        const meanThigh = .5 * (thigh + Math.atan2(otherThighY, otherThighZ));
        const meanShin = .5 * (shin + Math.atan2(otherShinY, otherShinZ));
        const joint = [lateral * .035, hipY + .422 * Math.sin(meanThigh) + .424 * Math.sin(meanShin),
          hipZ + .422 * Math.cos(meanThigh) + .424 * Math.cos(meanShin)];
        leg(pose, side, joint, [lateral * .91, -.23, .12],
          [lateral * .019, -.061, .125]);
      }

      if (profile.hands === "under") {
        arm(pose, side, [lateral * .069, .079, hipZ - .055], [lateral * .81, -.23, -.51]);
      } else if (profile.hands === "head") {
        arm(pose, side, add(pose.head, [lateral * .113, .028, -.057]), [lateral * .88, -.12, -.44]);
      } else if (profile.hands === "pillow") {
        arm(pose, side, add(pose.head, [lateral * .056, -.065, .050]), [lateral * .81, -.185, -.54]);
      } else if (profile.hands === "overhead") {
        const aim = armDirection(neck, head, .606);
        arm(pose, side, add(pose[side + "s"], [lateral * .031, aim[1], aim[2]]), [lateral * .51, .11, -.79], aim);
      } else if (profile.hands === "sweep") {
        const [wristReach] = inPlane(wrist, neck);
        const sweep = Math.PI * limit((wristReach - farReach) / Math.max(1, closeReach - farReach), 0, 1);
        const ray = [lateral * Math.sin(sweep), .026, -Math.cos(sweep)];
        arm(pose, side, add(pose[side + "s"], ray.map(coordinate => coordinate * .596)), [lateral * .51, -.16, -.73], ray);
      } else if (profile.hands === "wide") {
        arm(pose, side, add(pose[side + "s"], [lateral * .602, -.025, -.023]), [lateral * .71, -.35, -.42],
          [lateral, -.07, .06]);
      } else if (profile.hands === "back") {
        arm(pose, side, [lateral * .029, .244 + breath, hipZ - .053], [lateral * .42, -.36, .83], [-lateral * .66, -.03, .74]);
      } else if (profile.hands === "thigh") {
        arm(pose, side, [lateral * .081, .070, hipZ + .063], [lateral * .73, -.18, .63], [0, -.014, 1]);
      } else if (profile.hands === "row") {
        const [wristReach] = inPlane(wrist, neck);
        const pull = limit((wristReach - farReach) / Math.max(1, closeReach - farReach), 0, 1);
        const target = add(pose[side + "s"], [lateral * (.025 + .031 * pull), -.016 + .037 * pull, -.599 + .832 * pull]);
        arm(pose, side, target, [lateral * .76, .018, .60], [0, -.040, -1]);
      } else if (profile.hands === "source") {
        const upper = armDirection(neck, elbow, .245);
        const lower = armDirection(elbow, wrist, .360);
        const elbowTarget = add(pose[side + "s"], add(upper, [lateral * .036, 0, 0]));
        const end = add(elbowTarget, lower);
        end[1] = Math.max(.068, end[1]);
        arm(pose, side, end, add(upper, [lateral * .14, -.018, -.015]));
      } else {
        arm(pose, side, [lateral * .206, .078, hipZ - .068], [lateral * .58, -.23, -.76]);
      }
    }
    return pose;
  };
}
