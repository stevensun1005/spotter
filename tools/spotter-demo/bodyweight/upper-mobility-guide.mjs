import { add, arm, blend, leg, mix, scale, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.max(0, Math.min(1, value));

function normalized(frames, measure) {
  const values = frames.map(measure);
  const minimum = Math.min(...values);
  const span = Math.max(.01, Math.max(...values) - minimum);
  return frame => clamp((measure(frame) - minimum) / span);
}

export function upperMobilityGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const coordinates = [4, 6];
  const handUp = coordinates.map(index => normalized(frames, f => -f[index][1]));
  const reachSide = normalized(frames, f => Math.abs(f[4][0] - f[6][0]));
  const handDepth = normalized(frames, f => (f[4][0] + f[6][0]) / 2);
  const neckUp = normalized(frames, f => -f[1][1]);
  const elbowWidth = normalized(frames, f => Math.abs(f[3][0] - f[5][0]));
  const handBend = normalized(frames, f => f[4][1] - (f[11]?.[1] ?? f[4][1]));
  const handSlide = normalized(frames, f => -Math.hypot(f[6][0] - f[4][0], f[6][1] - f[4][1]));
  const sideNeck = normalized(frames, f => f[0][0] - f[1][0]);
  const direction = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;

  return phase => {
    const frame = guideAt(frames, phase);
    const [head, neck] = frame;
    const center = [0, .910, .024];
    const lifted = neckUp(frame);
    const bodyBend = profile.arch ? -.245 * handUp[0](frame) : mode === "frontCross" && profile.round ? .13 * handUp[0](frame) : 0;
    const pose = stand(center, .012 + bodyBend);
    if (mode === "neckCircle") {
      const optical = (neck[1] - head[1]) / 27;
      const tilt = .490 * (sideNeck(frame) * 2 - 1);
      pose.head = add(pose.head, [tilt * .48, -.027 * Math.abs(tilt), .093 * (.46 - optical)]);
      pose.headAim = [tilt, .91, 1.37 * (.649 - optical)];
    } else if (mode === "neckSide") {
      const tilt = .24 * (sideNeck(frame) * 2 - 1);
      pose.head = add(pose.head, [tilt * .60, -.087 * Math.abs(tilt), 0]);
      pose.headAim = [tilt * 1.79, .97, .051];
    }

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const up = handUp[index](frame);
      const asLeft = sign > 0;
      const shoulderOffset = mode === "shrug" || mode === "overheadShrug" ? [0, .095 * lifted, 0]
        : mode === "scapCircle" ? [0, .095 * lifted, .072 * Math.sin(4 * Math.PI * phase)]
        : mode === "scapRow" ? [0, 0, -.085 * (1 - handDepth(frame))]
        : mode === "scapRotate" ? [-sign * .016 * reachSide(frame), .006, -.054 * reachSide(frame)] : [0, 0, 0];
      pose[side + "s"] = add(pose[side + "s"], shoulderOffset);
      const shoulder = pose[side + "s"];
      const rest = add(shoulder, [sign * .049, -.609, .023]);
      let wrist = rest;
      let pole = [sign * .59, -.32, -.75];
      let fingers = [0, -.99, .067];
      let palm = [1, .04, 0];
      const stance = profile.stance ?? .145;
      leg(pose, side, [sign * stance, .083, .023], [sign * .063, -.03, .99], [sign * .012, -.071, .128], 0);

      if (mode === "overhead" || mode === "overheadShrug") {
        const rise = mode === "overheadShrug" ? 1 : up;
        const theta = Math.PI * .943 * rise;
        const open = profile.clasp ? -.198 : profile.narrow ? -.082 : .068;
        wrist = add(shoulder, [sign * mix(.051, open, rise), -.589 * Math.cos(theta), .568 * Math.sin(theta) - .184 * rise + .061]);
        fingers = profile.clasp && rise > .8 ? [-sign, -.01, .07] : [sign * .071, -Math.cos(theta), .09];
        if (profile.clasp) pole = [sign * .92, -.16, .19];
        if (mode === "overheadShrug") {
          wrist = add(shoulder, [sign * .026, .617, -.018]);
          fingers = [0, 1, .021];
        }
      } else if (mode === "behind" || mode === "backPull") {
        const draw = mode === "backPull" ? 1 - (profile.wristPull ? handDepth(frame) : reachSide(frame))
          : 1 - handDepth(frame) * direction + Math.min(0, direction);
        const reach = clamp(draw);
        const closeness = profile.open ? .26 : .050;
        wrist = mode === "backPull"
          ? [sign * .041 - .192 * reach, mix(.873, 1.01, profile.upper ? reach : 0), -.259 - .038 * reach]
          : [sign * mix(.215, closeness, Math.max(.33, up)), .828 + .232 * Math.max(reach, up), -.101 - .347 * reach];
        fingers = profile.open ? [sign * .14, -.28, -.95] : [-sign * .75, -.22, -.62];
        pole = [sign * .62, -.64, .44];
      } else if (mode === "frontCross") {
        const opening = handUp[0](frame);
        const armAxis = [-.86, -.014, .511];
        const root = pose.ls;
        const straight = add(root, scale(armAxis, .608));
        const bentEnd = add(root, [-.385, .162, .211]);
        const upper = add(root, scale(armAxis, .246));
        const support = add(upper, [.042, .069, .10]);
        wrist = blend(rest, asLeft ? profile.bent ? bentEnd : straight : support, opening);
        pole = asLeft ? [-.17, -.66, .67] : [-.51, -.84, -.09];
        fingers = asLeft ? profile.bent ? [-.87, .38, .32] : armAxis : [.61, .59, -.48];
      } else if (mode === "rotator" || mode === "triceps") {
        const rise = handUp[0](frame);
        const main = add(pose.neck, [.061, profile.out ? -.012 : -.162, -.145]);
        const control = add(pose.neck, [profile.out ? .337 : .155, profile.out ? .030 : .305, -.01]);
        wrist = blend(rest, asLeft ? main : control, rise);
        fingers = asLeft ? [-.32, -.913, -.21] : [.86, -.36, -.35];
        pole = asLeft ? profile.out ? [.98, .21, .027] : [.27, .957, .119] : [-.59, .67, .39];
      } else if (mode === "elbowCircle" || mode === "squeeze") {
        const t = mode === "elbowCircle" ? 4 * Math.PI * phase : 0;
        const squeeze = elbowWidth(frame);
        const circleUp = (frames[0][3][1] - frame[3][1]) * .024;
        const origin = mode === "elbowCircle" ? add(shoulder, [-sign * .016, .029, .047]) : add(pose.head, [sign * .084, -.023, -.058]);
        wrist = origin;
        pole = mode === "elbowCircle" ? [sign * .66, Math.sin(t) * .64 + circleUp, Math.cos(t) * .68]
          : [sign * (.71 + .33 * squeeze), -.22 - .21 * squeeze, .55 - 1.27 * squeeze];
        fingers = mode === "elbowCircle" ? [-sign * .11, -.64, -.71] : [-sign * .76, -.32, -.58];
      } else if (mode === "curl" && (asLeft || !profile.single)) {
        const bend = up * 2.35;
        const axis = [sign * .043, -Math.cos(bend), Math.sin(bend)];
        const elbow = add(shoulder, [sign * .019, -.251, 0]);
        wrist = add(elbow, scale(axis, .370));
        pole = [sign * .112, -1, -.04];
        fingers = axis;
        palm = [-sign, 0, 0];
      } else if (mode === "scapRow") {
        wrist = add(shoulder, [sign * .020, -.022, .606]);
        fingers = [0, -.027, 1];
        pole = [sign * .27, -.93, -.10];
      } else if (mode === "scapRotate" || mode === "shoulderRotate") {
        const opening = reachSide(frame);
        const yaw = mode === "scapRotate" ? mix(-.33, 1.09, opening) : mix(.02, .81, 1 - opening);
        const external = [sign * Math.sin(yaw), .082, Math.cos(yaw)];
        const elbow = add(shoulder, [sign * .051, -.245, -.010]);
        wrist = add(elbow, scale(external, .366));
        if (mode === "shoulderRotate" && !asLeft) wrist = [.265 + .219 * Math.sin(yaw), 1.197, .338 * Math.cos(yaw)];
        fingers = external;
        palm = [-sign * Math.cos(yaw), .19, Math.sin(yaw)];
        pole = [sign * .105, -1, -.20];
      } else if (mode === "neckSide") {
        const hold = Math.abs(sideNeck(frame) - .5) * 2;
        const contact = Math.sign(sideNeck(frame) - .50) === sign;
        wrist = contact ? blend(rest, add(pose.head, [-sign * .065, .107, -.025]), hold) : rest;
        fingers = contact ? [-sign * .91, -.227, .13] : [0, -.98, .024];
        pole = [sign * .93, .16, .04];
      } else if (mode === "forearm" || mode === "wristCircle" || mode === "forearmClasp" || mode === "sideWrist" || mode === "elbowFold") {
        const st = Math.max(handSlide(frame), handBend(frame) * .88);
        const angle = mix(.03, profile.direction ?? -1.03, st);
        const xDrive = profile.radial ? (profile.radial === "thumb" ? .41 : -.41) * st : 0;
        const holdSide = mode === "sideWrist" ? (frame[4][0] > frame[6][0] ? -1 : 1) : (profile.right ? -1 : 1);
        const activeShoulder = pose[holdSide > 0 ? "ls" : "rs"];
        const target = mode === "sideWrist" ? [holdSide * .789, 1.390, .074]
          : mode === "elbowFold" ? [mix(.252, .078, handUp[0](frame)), 1.357 + .086 * handUp[0](frame), mix(.602, .19, handUp[0](frame))]
          : mode === "forearmClasp" ? [sign * .034, 1.309, mix(.385, .582, handDepth(frame))]
          : mode === "wristCircle" ? add(shoulder, [sign * .033, -.076, .606]) : add(activeShoulder, [holdSide * .033, -.076, .606]);
        fingers = mode === "wristCircle" ? [.67 * Math.sin(4 * Math.PI * phase), .63 * Math.cos(4 * Math.PI * phase), .73]
          : mode === "forearmClasp" ? [-sign * .88, .381, .153] : mode === "sideWrist" ? [-holdSide * .55, -.831, .05] : [holdSide * xDrive, Math.sin(angle), Math.cos(angle)];
        const grip = profile.palmUp ? [-sign, 0, .048] : profile.pronate ? [Math.cos(Math.PI * st) * sign, Math.sin(Math.PI * st), .032] : [sign, 0, .049];
        palm = [mode === "sideWrist" ? sign * .038 : grip[0], grip[1], mode === "sideWrist" ? -sign : grip[2]];
        const workHand = sign === holdSide || mode === "wristCircle" || mode === "forearmClasp";
        wrist = workHand ? target : add(target, add(scale(fingers, .097 - .030 * st), [sign * .049, .060, -.040]));
        if (!workHand) {
          fingers = [-sign * .66, -.61, .43];
          palm = [sign, .038, -.062];
        }
        pole = workHand ? [sign * .14, -.85, -.49] : [sign * .61, -.77, -.34];
        if (mode === "elbowFold" && workHand) pole = [sign * .86, -.029, 1];
        if (mode === "wristCircle") pose[side + "FingerCurl"] = .81;
      }

      arm(pose, side, wrist, pole, fingers, palm);
    }
    return pose;
  };
}
