import { add, arm, blend, leg, sides, smooth, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const norm2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function standingCoordinationGuideMotion(guide, profile) {
  const { frames } = guide;
  const mode = profile.mode;
  const sideView = profile.plane === "side";
  const measurements = frames.flatMap(f => [norm2(f[2], f[7]), norm2(f[7], f[8]), norm2(f[2], f[9]), norm2(f[9], f[10])]).sort((a, b) => a - b);
  const scale = .419 / measurements[Math.floor(measurements.length / 2)];
  const floor = Math.max(...frames.flatMap(f => [f[8][1], f[10][1]]));
  const hipMinX = Math.min(...frames.map(f => f[2][0]));
  const hipMaxX = Math.max(...frames.map(f => f[2][0]));
  const center = (hipMinX + hipMaxX) * .5;
  const startY = frames[0][2][1];
  const rootMarkers = guide.shoulders ?? [];
  const firstAnkles = [frames[0][8][0], frames[0][10][0]];
  const facing = profile.facing ?? 1;
  const floorAnkle = .083;

  function vector(a, b, length) {
    const dx = b[0] - a[0];
    const dy = a[1] - b[1];
    const size = Math.max(.001, Math.hypot(dx, dy));
    return [sideView ? 0 : length * dx / size, length * dy / size, sideView ? facing * length * dx / size : 0];
  }

  function points(phase) {
    const half = phase < .5 ? 0 : 1;
    const local = phase === 1 ? .5 : phase - half * .5;
    const step = local * 2 * (profile.threeReturn ? 7 : 5);
    const beat = Math.floor(step);
    const ease = smooth(clamp((step - beat - .17) / .66, 0, 1));
    const active = half === 0 ? -1 : 1;
    const origin = [active * .136, floorAnkle + .082, .13];
    const taps = {
      front: [active * .142, .115, .419],
      side: [active * .429, .111, .114],
      back: [active * .143, .115, -.359],
    };
    const beats = profile.threeReturn
      ? [origin, taps.front, origin, taps.side, origin, taps.back, origin, origin]
      : [origin, taps.front, taps.side, taps.back, origin, origin];
    const foot = blend(beats[Math.min(beat, beats.length - 1)], beats[Math.min(beat + 1, beats.length - 1)], ease);
    foot[1] += .064 * Math.sin(Math.PI * ease);
    return { active, foot };
  }

  return phase => {
    const frame = guideAt(frames, phase);
    const [, neck, hip] = frame;
    const opening = Math.max(0, (Math.abs(frame[8][0] - frame[10][0]) - 25) * scale);
    const stride = (hip[0] - center) * scale * (profile.travel ?? 1);
    const offset = (startY - hip[1]) * scale;
    const swivel = mode === "jackTurn" || mode === "squatTurn";
    const direction = phase < .5 ? 1 : -1;
    const centered = swivel ? Math.max(0, mode === "jackTurn" ? opening : ((frame[4][0] + frame[6][0]) * .5 - hip[0]) * scale * direction) : 0;
    const incomingKnee = (frame[10][1] - frame[8][1]) / 36;
    const yaw = swivel ? direction * clamp(centered * 2.1, 0, .78)
      : mode === "kneeTwist" ? clamp(incomingKnee, -1, 1) * .94 : 0;
    const set = mode === "toeTap" ? points(phase) : null;
    const crouch = ["sideReach", "squatTurn", "kneeSquat", "stepSquat", "lowJack"].includes(mode);
    const rootDepth = sideView && profile.travel ? stride * facing : .025 + (crouch ? Math.min(0, offset) * .34 : 0);
    const lateral = set ? -.051 * set.active : sideView ? 0 : stride;
    const body = [lateral, profile.height + offset * (profile.heightScale ?? 1), rootDepth];
    if (set) body[1] = .864;
    if (mode === "kneeTwist") body[2] += .176 * clamp(Math.abs(incomingKnee), 0, 1);
    const shuttleTouch = mode === "shuttle" ? clamp((Math.max(frame[4][1], frame[6][1]) - 111) / 40, 0, 1) : 0;
    body[1] -= .192 * shuttleTouch;
    if (mode === "circle") {
      body[0] = profile.circle * Math.sin(phase * 2 * Math.PI);
      body[2] = profile.circle * Math.cos(phase * 2 * Math.PI);
      body[1] -= Math.abs(body[2]) * .15;
    }

    const feet = sides.map(([side, sign], index) => {
      const marker = frame[8 + index * 2];
      const sourceKnee = frame[7 + index * 2];
      const dx = (marker[0] - hip[0]) * scale * facing;
      const altitude = Math.max(0, (floor - marker[1] - (profile.floatThreshold ?? 3)) * scale * (profile.lift ?? 1));
      const extension = clamp(altitude / (profile.fullLift ?? .48), 0, 1);
      let forward = sideView ? dx + rootDepth : .051;
      let horizontal = sideView ? sign * (profile.width ?? .132) : body[0] + (marker[0] - hip[0]) * scale * (profile.spread ?? 1);
      let y = floorAnkle + altitude;
      let toe = [sign * .018, -.061, .125];
      let kneePole = sideView ? [sign * .105, .017, (sourceKnee[0] - hip[0]) * facing * .014 + .421] : [sign * .12, .02, 1];

      if (set) {
        const moving = sign === set.active;
        [horizontal, y, forward] = moving ? set.foot : [sign * .123, floorAnkle, .05];
        toe = moving ? [sign * .019, -.104, .105] : toe;
      } else if (mode === "march" || mode === "underTap" || mode === "kneeTwist" || mode === "kneeSquat" || mode === "tapHigh") {
        horizontal = body[0] + sign * .135;
        forward = rootDepth + .026 + extension * .60;
      } else if (mode === "straightFront" || mode === "straightBack") {
        horizontal = sign * .124;
        const kick = mode === "straightFront";
        const flexion = extension * (kick ? 1.40 : -.58);
        forward = rootDepth + .018 + .835 * Math.sin(flexion);
        y = floorAnkle + .830 * (1 - Math.cos(flexion));
        kneePole = [sign * .13, .012, .97];
      } else if (mode === "butt" || mode === "kneeOrButt") {
        const liftingBehind = mode === "butt" || (profile.sameSide ? (phase % .5) * 2 > .50 : phase >= .5);
        horizontal = sign * .128;
        forward = .045 + extension * (liftingBehind ? -.393 : .57);
        if (liftingBehind) toe = [sign * .021, -.103, .074];
      } else if (mode === "curlStep" || mode === "stepBack") {
        forward = .04 + (marker[0] - firstAnkles[index]) * scale * facing * .47;
        horizontal = sign * .139;
        y += Math.min(.035, Math.abs(forward - .04) * .085);
      } else if (mode === "jog") {
        y += .375 * clamp(.50 - dx, 0, 1) * (1 - clamp(dx + .55, 0, 1));
        forward = .048 + dx * .62;
      } else if (mode === "rearStep") {
        horizontal = body[0] + .59 * (horizontal - body[0]);
        forward = .031;
      } else if (mode === "splitJack") {
        horizontal = .116 * sign;
        forward = .023 + (marker[0] - hip[0]) * scale * .90;
      } else if (mode === "crossJack" && frame[8][0] < frame[10][0]) {
        forward = .05 + sign * (phase > .61 ? -.13 : .13);
      } else if (mode === "lateralHigh") {
        forward = .065 + extension * .652;
        horizontal = body[0] + clamp(horizontal - body[0], -.36, .36);
        const otherAnkle = frame[index > 0 ? 8 : 10][1];
        y = floorAnkle + Math.min(.43, Math.max(0, (otherAnkle - marker[1] - 4) * scale * 1.52));
      } else if (mode === "shuttle" || mode === "stepSquat") {
        horizontal = body[0] + sign * Math.max(mode === "shuttle" ? .154 : .126, sign * (horizontal - body[0]));
        if (mode === "shuttle") y = floorAnkle + altitude * .57;
      } else if (mode === "zigzag") {
        const shifts = [0, .31, .60, .92, 1.17, 1.44, 1.73];
        const i = Math.min(shifts.length - 2, Math.floor(phase * (shifts.length - 1)));
        const z = (shifts[i] + (shifts[i + 1] - shifts[i]) * (phase * (shifts.length - 1) - i)) * .86 - .65;
        forward = z;
        y = floorAnkle + Math.max(0, (startY - hip[1] - 12) * scale * .69);
      } else if (mode === "circle" || mode === "swingArms") {
        horizontal = sign * (mode === "circle" ? .231 : .155);
        forward = .045;
      } else if (mode === "sideRaise") {
        forward = .067;
        horizontal += sign * .075 * extension;
        kneePole = [sign * .65, .01, .72];
      }

      if (profile.stagger) {
        const opened = Math.max(0, (Math.abs(marker[0] - hip[0]) - 13) * scale);
        horizontal = sign * .121;
        forward = .033 + profile.stagger * opened * (dx > 0 ? 1 : -1);
      }
      if (profile.forefoot && y < floorAnkle + .025) {
        y += .035 * (1 - smooth((y - floorAnkle) / .025));
        toe = [sign * .008, -.104, .089];
      }
      return { side, sign, ankle: [horizontal, y, forward], kneePole, toe };
    });
    if (mode === "zigzag") body[2] = feet[0].ankle[2] - .046;
    for (const { sign, ankle } of feet) {
      const radius = Math.hypot(ankle[0] - body[0] - sign * .103, ankle[2] - body[2]);
      body[1] = Math.min(body[1], ankle[1] + Math.sqrt(Math.max(.077, .833 ** 2 - radius ** 2)));
    }

    const guidePitch = Math.atan2((neck[0] - hip[0]) * facing, hip[1] - neck[1]);
    const pitch = profile.pitch ?? (sideView ? clamp(guidePitch, -.22, .58) : .051);
    const tilt = mode === "sideReach" ? clamp(guidePitch, -.42, .42) : .01;
    const rotationDrop = mode === "kneeTwist" ? .48 * clamp(Math.abs(incomingKnee), 0, 1) : .81 * shuttleTouch;
    const pose = stand(body, pitch + rotationDrop + (mode === "squatTurn" || mode === "stepSquat" ? Math.max(0, -offset) * .74 : 0), yaw, tilt);

    for (const { side, ankle, kneePole, toe } of feet) {
      leg(pose, side, ankle, kneePole, toe, ankle[1] < floorAnkle + .014 ? 0 : undefined);
    }
    for (const { side, sign, ankle } of feet) {
      const index = sign > 0 ? 0 : 1;
      const elbow = frame[3 + index * 2];
      const hand = frame[4 + index * 2];
      const root = frame[rootMarkers[index]] ?? [neck[0] + (sideView ? 2 : sign * 9), neck[1] + 2];
      const upper = vector(root, elbow, .244);
      const lower = vector(elbow, hand, .356);
      const shoulder = pose[side + "s"];
      let wrist = add(shoulder, add(upper, lower));
      let pole = add(upper, [sign * .16, -.061, -.119]);
      let fingers = add(lower, [0, .001, .003]);
      const knee = pose[side + "k"];
      const lift = clamp((ankle[1] - .11) / .31, 0, 1);
      if (mode === "toeTap" || mode === "circle" || mode === "sideRaise") {
        wrist = add(body, [sign * .158, .093, .091]);
        pole = [sign * .71, -.35, -.31];
        fingers = [0, -.625, -.78];
      } else if (profile.hands === "running") {
        const other = pose[(sign > 0 ? "r" : "l") + "a"];
        const pump = clamp((other[1] - ankle[1]) * 2.85, -1, 1);
        wrist = add(shoulder, [sign * .119, -.315 + .079 * Math.abs(pump), .054 + .327 * pump]);
        pole = [sign * .29, -.89, -.49];
        fingers = [0, -.031, pump < -.35 ? -.99 : .99];
      } else if (mode === "shuttle" && shuttleTouch > 0) {
        wrist = blend(wrist, add(ankle, [sign * .083, .054, .119]), shuttleTouch);
        pole = [sign * .544, -.76, .009];
        fingers = [0, -.752, .66];
      } else if (profile.hands === "guard") {
        wrist = add(pose.chest, [sign * .05, .091, .269]);
        pole = [sign * .7, -.50, -.08];
        fingers = [-sign * .31, .896, .166];
      } else if (profile.hands === "cross") {
        wrist = add(pose.chest, [-sign * .134, .058 + sign * .063, .178]);
        pole = [sign * .70, -.50, .11];
        fingers = [-sign, .032, .15];
      } else if (mode === "underTap") {
        const other = pose[(sign > 0 ? "r" : "l") + "k"];
        const target = pose.la[1] > pose.ra[1] ? (sign > 0 ? knee : other) : sign < 0 ? knee : other;
        const touch = clamp((Math.max(pose.la[1], pose.ra[1]) - .12) / .28, 0, 1);
        wrist = blend(wrist, add(target, [sign * .024, -.116, -.065]), touch);
        pole = [sign * .60, -.62, -.16];
        fingers = [-sign * .83, -.38, .39];
      } else if (mode === "tapHigh") {
        wrist = add(shoulder, [sign * .022, -.23, .43]);
        wrist = blend(wrist, add(knee, [sign * .026, .078, -.030]), lift);
        pole = [sign * .32, -.58, -.32];
        fingers = [0, -.16, .99];
      } else if (mode === "kneeTwist") {
        const otherSide = sign > 0 ? "r" : "l";
        const amount = clamp((pose[otherSide + "a"][1] - .12) / .34, 0, 1);
        wrist = add(pose.head, [sign * (.109 - amount * .053), -.067 - .07 * amount, -.097 + .11 * amount]);
        const oppositeKnee = pose[otherSide + "k"];
        pole = blend([sign * .93, -.14, -.22], oppositeKnee.map((n, i) => n - shoulder[i]), amount);
        fingers = [0, .23, -.97];
      } else if (mode === "curlStep") {
        const amount = clamp((frames[0][4][1] - hand[1]) / 50, 0, 1);
        wrist = add(shoulder, [sign * .046, -.595 + amount * .544, .075 + amount * .259]);
        pole = [sign * .05, -.98, -.14];
        fingers = [0, -.91 + amount * 1.9, .21];
      } else if (mode === "swingArms" || mode === "crossJack") {
        const crossed = elbow[0] !== hand[0] && sign * (hand[0] - hip[0]) < 0;
        wrist[2] += crossed ? .224 + sign * .043 : .032;
        pole = add(pole, [0, -.055, .11]);
      } else if (mode === "stepBack") {
        const lowering = clamp((hand[1] - 15) / 48, 0, 1);
        wrist[2] += .053 + .226 * lowering;
        pole = [sign * (.611 + .24 * lowering), -.21 - .69 * lowering, -.103];
      } else if (mode === "rearStep") {
        const pulling = clamp((Math.abs(hip[0] - hand[0]) - 14) * scale * 1.8, 0, 1);
        wrist = add(shoulder, [sign * (.12 + pulling * .145), -.083, .514 - pulling * .359]);
        pole = [sign * .79, -.133, -.145];
        fingers = [0, -.13, .99];
      } else if (mode === "squatTurn") {
        wrist = add(pose.chest, [sign * .041 + Math.sin(yaw) * .18, .066, .244]);
        pole = [sign * .63, -.59, -.098];
      }
      arm(pose, side, wrist, pole, fingers);
    }
    return pose;
  };
}
