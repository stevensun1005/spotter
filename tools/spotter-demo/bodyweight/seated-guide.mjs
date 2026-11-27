import { add, arm, blend, leg, legAngles, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const bound = (n, min, max) => Math.max(min, Math.min(max, n));

export function seatedGuideMotion(guide, profile) {
  const { frames } = guide;
  const first = frames[0];
  const sagittal = profile.plane === "side";
  const facing = profile.facing ?? Math.sign(first[2][0] - (first[8][0] + first[10][0]) * .5) * -1;
  const wristX = frame => .5 * (frame[4][0] + frame[6][0]) - frame[2][0];
  const middle = .5 * (Math.max(...frames.map(wristX)) + Math.min(...frames.map(wristX)));
  const drift = Math.max(1, Math.max(...frames.map(wristX)) - middle);
  const handSpan = frame => Math.abs(frame[4][0] - frame[6][0]);
  const minSpan = Math.min(...frames.map(handSpan));
  const spanWidth = Math.max(1, Math.max(...frames.map(handSpan)) - minSpan);
  const viewDirection = facing || 1;

  function project(from, to, length) {
    const x = to[0] - from[0];
    const y = from[1] - to[1];
    const r = length / Math.max(Math.hypot(x, y), .01);
    return sagittal ? [0, y * r, x * r * viewDirection] : [x * r, y * r, 0];
  }

  return phase => {
    const frame = guideAt(frames, phase);
    const [head, neck, pelvis] = frame;
    const turn = profile.turn ? bound((wristX(frame) - middle) / drift, -1, 1) * profile.turn : 0;
    const lean = profile.lean ? bound(Math.atan2(neck[0] - pelvis[0], pelvis[1] - neck[1]), -.60, .60) : 0;
    const pitch = profile.pitch ?? (sagittal ? bound(Math.atan2((neck[0] - pelvis[0]) * viewDirection, pelvis[1] - neck[1]), -.54, .95) : .025);
    const z = profile.legs === "kneel" ? -.128 : -.268;
    const hips = [0, profile.legs === "kneel" ? .295 : .160, z];
    const pose = stand(hips, pitch, turn, lean);
    if (profile.scapula) {
      const squeeze = (handSpan(frame) - minSpan) / spanWidth;
      pose.ls = add(pose.ls, [-.024 * squeeze, .010 * squeeze, -.048 * squeeze]);
      pose.rs = add(pose.rs, [.024 * squeeze, .010 * squeeze, -.048 * squeeze]);
    }
    if (profile.neck) {
      const tuck = (head[0] - first[0][0]) * .009;
      pose.head[2] += viewDirection * tuck;
      pose.headAim = [0, profile.neck === "sky" ? .16 + (first[0][1] - head[1]) * .023 : -.06 - Math.abs(tuck) * .50, 1];
    }

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const knee = frame[near ? 7 : 9];
      const ankle = frame[near ? 8 : 10];
      const elbow = frame[near ? 3 : 5];
      const wrist = frame[near ? 4 : 6];
      if (profile.legs === "kneel") {
        pose[side + "k"] = [sign * .144, .108, .243];
        pose[side + "a"] = [sign * .101, .106, -.176];
        pose[side + "t"] = [sign * .092, .057, -.297];
      } else if (profile.legs === "cross" || profile.legs === "butterfly" || profile.legs === "oneStraight" && !near) {
        const butterfly = profile.legs === "butterfly";
        pose[side + "k"] = [sign * (butterfly ? .324 : .356), .113, .057];
        pose[side + "a"] = [sign * (butterfly ? .068 : .028), .104, butterfly ? .386 : .286 + .048 * sign];
        pose[side + "t"] = add(pose[side + "a"], [-sign * .094, -.061, .088]);
      } else if (profile.legs === "track") {
        const thigh = project(pelvis, knee, 1);
        const shin = project(knee, ankle, 1);
        legAngles(pose, side, sign, Math.atan2(thigh[1], thigh[2]), Math.atan2(shin[1], shin[2]));
        const a = pose[side + "a"];
        if (a[1] < .117 || profile.legSway) {
          const sway = profile.legSway ? .203 * Math.sin(phase * 2 * Math.PI) : 0;
          leg(pose, side, [a[0] + sway, Math.max(.115, a[1]), a[2]], [sign * .13, .88, .25], [sign * .016, -.046, .131]);
        }
      } else {
        const width = profile.legs === "wide" ? .568 : near && profile.legs === "oneStraight" ? .190 : .130;
        const heel = [sign * width, .110, profile.straight ? z + Math.sqrt(.836 ** 2 - (width - .103) ** 2 - .050 ** 2)
          : profile.legs === "wide" ? .314 : .545];
        const footTip = profile.toeLift ? guide.dynamic?.find(([kind, origin]) => kind === "foot-tip" && origin === (near ? 8 : 10))?.[2] : undefined;
        const toes = footTip == null ? [sign * .012, .074, .118] : project(ankle, frame[footTip], .144);
        leg(pose, side, heel, [sign * .069, .85, -.09], toes);
      }

      const shoulder = pose[side + "s"];
      const root = guide.shoulders ? frame[guide.shoulders[near ? 0 : 1]] : [neck[0] + sign * (sagittal ? 5 : 12), neck[1] + 1];
      const upper = project(root, elbow, .252);
      const forearm = project(elbow, wrist, .352);
      let target = add(shoulder, add(upper, forearm));
      let pole = add(upper, [sign * .195, -.062, -.084]);
      let fingers = forearm;
      if (profile.hands === "rear") {
        target = [sign * .227, .062, -.556];
        pole = [sign * .78, -.37, -.59];
        fingers = [sign * .249, -.027, -.97];
      } else if (profile.hands === "lap") {
        target = [sign * .140, .354, .106];
        pole = [sign * .57, -.65, .18];
      } else if (profile.hands === "head") {
        target = add(pose.head, [sign * .116, .018, -.052]);
        pole = [sign * .89, .17, -.59];
      } else if (profile.hands === "fold") {
        const travel = Math.max(0, pitch * (profile.reach ?? .63));
        target = [sign * (.131 + .06 * travel), .062, .235 + travel];
        pole = [sign * .69, -.24, -.62];
        fingers = [0, -.022, 1];
      } else if (profile.hands === "toe") {
        const wanted = profile.legs === "oneStraight" ? pose.la : pose[side + "a"];
        target = add(wanted, [sign * .034, .039, .045]);
        pole = [sign * .57, .31, -.60];
        fingers = [0, -.38, .91];
      } else if (profile.hands === "t") {
        target = add(shoulder, [sign * .614 * Math.cos(turn), .004, -sign * .614 * Math.sin(turn)]);
        pole = [sign * .35, -.93, -.19];
        fingers = [sign * Math.cos(turn), 0, -sign * Math.sin(turn)];
      } else if (profile.hands === "cross") {
        const opposite = side === "l" ? pose.rs : pose.ls;
        target = add(opposite, [sign * .065, -.128 + sign * .026, .128]);
        pole = [sign * .575, -.41, .57];
      } else if (profile.hands === "twist") {
        const outer = bound(.5 + turn * sign * 1.60, 0, 1);
        target = blend([sign * -.253, .201, .097], [sign * .251, .073, -.486], outer * outer * (3 - 2 * outer));
        pole = [sign * .65, -.27, -.52];
      } else if (profile.hands === "side" && wrist[1] > frame[near ? 6 : 4][1] + 9) {
        target = [sign * (.294 + .233 * Math.abs(lean)), .059, .029];
        pole = [sign * .59, -.18, -.60];
        fingers = [sign * .87, -.03, .48];
      }
      arm(pose, side, target, pole, Math.hypot(...fingers) > .001 ? fingers : [0, -.04, 1]);
    }
    return pose;
  };
}
