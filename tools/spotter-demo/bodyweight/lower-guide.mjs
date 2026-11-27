import { add, arm, blend, leg, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const bound = (x, min, max) => Math.max(min, Math.min(max, x));

export function lowerGuideMotion(guide, profile) {
  const { frames } = guide;
  const front = profile.plane !== "side";
  const pose0 = frames[0];
  const origin = pose0[2];
  const length = frames.flatMap(frame => [distance(frame[2], frame[7]), distance(frame[7], frame[8]),
    distance(frame[2], frame[9]), distance(frame[9], frame[10])]).sort((a, b) => a - b);
  const drawingScale = .422 / length[Math.floor(length.length / 2)];
  const referenceY = Math.max(...frames.flatMap(frame => [frame[8][1], frame[10][1]]));
  const footCenter = (pose0[8][0] + pose0[10][0]) * .5;
  const plantedX = [pose0[8][0], pose0[10][0]].sort((a, b) => b - a);
  const facing = profile.facing ?? 1;
  const footBase = profile.forefoot ? .156 : .082;
  const width = profile.width ?? .134;
  const distanceScale = profile.distance ?? 1;

  function project(from, to, amount) {
    const dx = to[0] - from[0];
    const y = from[1] - to[1];
    const magnitude = Math.max(Math.hypot(dx, y), .01);
    return front ? [dx * amount / magnitude, y * amount / magnitude, 0] : [0, y * amount / magnitude, dx * facing * amount / magnitude];
  }

  return phase => {
    const frame = guideAt(frames, phase);
    const [, neck, hip] = frame;
    const centerShift = (hip[0] - origin[0]) * drawingScale * distanceScale;
    const guideDepth = (hip[1] - origin[1]) * drawingScale;
    const tilt = front ? bound(Math.atan2(neck[0] - hip[0], hip[1] - neck[1]), -.51, .51) : 0;
    const breath = profile.breath ? .011 * Math.sin(phase * 4 * Math.PI) : 0;
    const along = Math.max(0, Math.sin(4 * Math.PI * phase));
    const forwardHop = profile.multiAxis ? .45 * along * (phase < .5 ? 1 : -1) : 0;
    const hips = [front ? centerShift : 0, profile.startY - (profile.heightScale ?? 1) * guideDepth + breath,
      front ? .016 - (profile.sit ? Math.max(0, .10 + .33 * guideDepth) : 0) : facing * centerShift];
    hips[2] += forwardHop;
    const crossed = profile.cross && frame[8][0] < frame[10][0];
    const spin = profile.spin ? (profile.alternating ? Math.sign(Math.sin(2 * Math.PI * phase)) : 1) * bound((origin[1] - hip[1] - 3) / 36, 0, 1) : 0;
    const jack = profile.jackAfter && phase > .47 ? bound((phase - .47) / .11, 0, 1) * bound((.91 - phase) / .13, 0, 1) : 0;
    const feet = sides.map(([side, sign]) => {
      const guideAnkle = frame[sign > 0 ? 8 : 10];
      const sourceX = profile.footLock ? plantedX[sign > 0 ? 0 : 1] : guideAnkle[0];
      const shift = (sourceX - footCenter) * drawingScale * distanceScale;
      const lift = profile.footLock ? 0 : Math.max(0, (referenceY - guideAnkle[1] - 4) * drawingScale);
      const kneeLift = profile.highKnees ? Math.max(0, (front ? Math.abs(shift - centerShift) : Math.abs(shift - facing * centerShift)) - .25) * .60 : 0;
      const tuck = profile.tuck ? bound((referenceY - guideAnkle[1] - 13) / 34, 0, 1) : 0;
      const offFoot = profile.forwardSingle && sign < 0;
      const depthShift = front ? .074 + forwardHop + (crossed ? sign * .129 : 0) + kneeLift + .435 * tuck
        : (facing * shift) * (1 - jack) + (hips[2] + .068) * jack - (offFoot ? .14 : 0);
      const yawX = front ? shift : sign * (width + .225 * jack);
      const turned = profile.spin ? [yawX * Math.cos(spin) + (depthShift - hips[2]) * Math.sin(spin),
        hips[2] + (depthShift - hips[2]) * Math.cos(spin) - yawX * Math.sin(spin)] : [yawX, depthShift];
      return [side, sign, [turned[0], footBase + lift + .245 * tuck + (offFoot ? .211 : 0), turned[1]], lift < .014 && !offFoot];
    });

    // Keep each ankle inside the rig's two-segment reach before solving its knee.
    for (const [, sign, foot] of feet) {
      const radius = Math.hypot(foot[0] - hips[0] - sign * .103, foot[2] - hips[2]);
      hips[1] = Math.min(hips[1], foot[1] + Math.sqrt(Math.max(.10, .838 ** 2 - radius ** 2)));
    }
    const airHeight = Math.min(...feet.map(([, , foot]) => foot[1] - footBase));
    const basePitch = profile.pitch ?? .027;
    const pitch = front ? basePitch + (profile.sit ? .17 + .26 * Math.max(0, guideDepth) : 0)
      : bound(Math.atan2((neck[0] - hip[0]) * facing, hip[1] - neck[1]), -.43, 1.16);
    const pose = stand(hips, pitch, profile.spin ? spin * (profile.staySquare ? .085 : .85) : 0, tilt);
    for (const [side, sign, foot, contact] of feet) {
      const isLeft = sign > 0;
      const knee = frame[isLeft ? 7 : 9];
      const kneeAim = project(hip, knee, .79);
      const kneePole = profile.pistol ? [sign * .06, .036, .982] : front ? [profile.spin ? Math.sin(spin) : sign * .285, -.084, .915]
        : [sign * .089, kneeAim[1] * .68, kneeAim[2] + .21];
      const toe = profile.forefoot ? [sign * .015, -.133, .071] : [sign * .019 + .100 * Math.sin(spin), -.065, .131 * Math.cos(spin)];
      const straight = profile.pistol && isLeft;
      const ankle = straight ? add(pose[side + "h"], [sign * .013, -.208, .818])
        : profile.pistol ? [sign * .133, foot[1], hips[2] + .079] : foot;
      leg(pose, side, ankle, kneePole, toe, contact && !profile.forefoot && !straight ? 0 : undefined);

      const elbow = frame[isLeft ? 3 : 5];
      const hand = frame[isLeft ? 4 : 6];
      const projectedRoot = guide.shoulders ? frame[guide.shoulders[isLeft ? 0 : 1]] : [neck[0] + sign * (front ? 12 : 5), neck[1] + 1];
      const upper = project(projectedRoot, elbow, .252);
      const lower = project(elbow, hand, .352);
      const shoulder = pose[side + "s"];
      let wrist = add(shoulder, add(upper, lower));
      let armPole = add(upper, [sign * .175, -.043, -.114]);
      let fingers = lower;
      if (profile.hands === "hips") {
        wrist = add(hips, [sign * .168, .075, .075]);
        armPole = [sign * .84, -.28, -.41];
      } else if (profile.hands === "chest") {
        const brace = profile.kneeBrace ? bound((.81 - hips[1]) / .38, 0, 1) : 0;
        wrist = add(pose.chest, [sign * .038, .048 - .137 * brace, .253 + .065 * brace]);
        armPole = [sign * .72, -.49 - .42 * brace, -.45 + .51 * brace];
        fingers = [0, 1, .023];
      } else if (profile.hands === "prisoner") {
        wrist = add(pose.head, [sign * .107, -.023, -.101]);
        armPole = [sign * .92, .19, -.12];
      } else if (profile.hands === "front") {
        wrist = add(shoulder, [sign * .064, -.074, .550]);
        armPole = [sign * .39, -.78, -.47];
        fingers = [0, -.071, .997];
      } else if (front && profile.hands === "swing") {
        const push = bound(airHeight * 2.2, 0, 1);
        wrist[2] += -.159 + push * .37;
      } else if (profile.hands === "shot") {
        const throwProgress = bound((origin[1] - hip[1]) / 46, 0, 1);
        const hold = add(pose.chest, [sign * .057, .084, .279]);
        const aim = add(shoulder, [sign * .102, isLeft ? .566 : .449, isLeft ? .264 : .119]);
        wrist = blend(hold, aim, throwProgress);
        fingers = [0, .38, .93];
        armPole = [sign * .71, -.59, -.27];
      } else if (profile.hands === "tap") {
        const knee = pose[side + "k"];
        const lift = bound((foot[1] - .092) * 3.6, 0, 1);
        if (knee) wrist = blend(wrist, add(knee, [sign * .016, .079, .089]), lift);
      }
      arm(pose, side, wrist, armPole, Math.hypot(...fingers) > .01 ? fingers : [0, -.07, 1]);
    }
    return pose;
  };
}
