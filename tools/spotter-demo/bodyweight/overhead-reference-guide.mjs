import { add, arm, blend, leg, mix, rep, scale, sides, stand, subtract, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = n => Math.max(0, Math.min(1, n));
const span = (frames, read) => {
  const values = frames.map(read);
  const low = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - low);
  return f => clamp((read(f) - low) / width);
};

function projection(frames, prone, negativeForward = prone) {
  const first = frames[0];
  const fore = unit(subtract(first[1], first[2]));
  const across = [fore[1], -fore[0]];
  const guideSide = Math.sign(subtract(first[8], first[10]).reduce((v, n, i) => v + n * across[i], 0)) || 1;
  return (start, end) => {
    const [x, y] = subtract(end, start);
    return [(x * across[0] + y * across[1]) * guideSide * (prone ? -1 : 1), 0,
      (x * fore[0] + y * fore[1]) * (negativeForward ? -1 : 1)];
  };
}

function shoulderSweep(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const front = mode === "slide" || mode === "sweep" || mode === "snowBack" || mode === "whole" || mode === "banana";
  const flat = mode === "slide" || mode === "sweep" || mode === "snowBack" || mode === "whole" || mode === "banana";
  const project = projection(frames, !front, true);
  const width = span(frames, f => Math.abs(project(f[8], f[10])[0]));
  const curve = span(frames, f => project(frames[0][2], f[1])[0]);
  const drift = [4,6].map(i => span(frames, f => Math.hypot(...project(frames[0][i], f[i]))));
  return phase => {
    const frame = guideAt(frames, phase);
    const breathe = .014 * Math.sin(4 * Math.PI * phase);
    const lift = mode === "raise" || mode === "super" ? rep(phase, .39, .58)
      : profile.thumb || mode === "arc" || mode === "swim" || mode === "snowFront" ? .49 + .38 * rep(phase) : 0;
    const banana = mode === "banana" ? curve(frame) * 2 - 1 : 0;
    const p = banana ? stand([0, .146, -.132], -1.555, -.49 * banana)
      : torso([0, .149, -.132], -1.574 + (flat ? .008 * breathe : (profile.upper ?? .13) * lift), front ? 0 : Math.PI);
    p.headDrop = front ? .043 : -.027;
    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const spread = mode === "snowBack" || mode === "snowFront" ? .36 * width(frame) : 0;
      const footLift = mode === "super" ? .198 * lift : mode === "swim" ? .136 * drift[1 - index](frame) : 0;
      const facing = front ? sign : -sign;
      p[side + "h"][0] = facing * .103;
      const dx = facing * (.023 + spread) + .446 * banana;
      const up = -.044 + footLift;
      const z = Math.sqrt(Math.max(.07, .838 ** 2 - dx ** 2 - up ** 2));
      leg(p, side, profile.bent ? [sign * .148, .109, .373] : add(p[side + "h"], [dx, up, z]),
        profile.bent ? [sign * .084, .983, -.077] : [facing * .14, front ? .16 : -.935, .235],
        profile.bent ? [sign * .017, -.065, .131] : [facing * .018, front ? .081 : -.063, .112],
        profile.bent ? .024 : undefined);

      const shoulder = p[side + "s"];
      const root = frame[guide.shoulders?.[index] ?? 1];
      const elbow = frame[3 + index * 2];
      const wrist = frame[4 + index * 2];
      const upper = project(root, elbow);
      const lower = project(elbow, wrist);
      const height = flat ? -.025 : mode === "swim" ? .125 * drift[index](frame) : .052 * lift;
      const wrists = add(shoulder, add(scale(unit(add(upper, [0, upper[0] * .02 + height * 45, .0004])), .249),
        scale(unit(add(lower, [0, height * 32, .0003])), .369)));
      if (flat) wrists[1] = .071 + breathe * Number(mode === "whole");
      if (mode === "slide") wrists[1] = .071;
      if (mode === "snowFront") wrists[1] = Math.max(.101, wrists[1]);
      const ray = add(unit(add(upper, [0, .001, .002])), [facing * .13, flat ? -.43 : .075, -.098]);
      const fingertip = guide.dynamic?.find(([kind, start]) => ["thumb-up", "palm-down"].includes(kind) && start === 4 + index * 2);
      const reach = fingertip ? project(wrist, frame[fingertip[2]]) : lower;
      const fingers = unit(add(reach, [0, flat ? -.018 : .052, .0003]));
      const palm = profile.thumb ? [facing * .075, .98, .016] : [facing, .036, .019];
      arm(p, side, wrists, ray, fingers, palm);
    }
    return p;
  };
}

function supineFloor(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const project = projection(frames, false);
  const leftCross = span(frames, f => project(f[2], f[8])[0]);
  const rightCross = span(frames, f => project(f[2], f[10])[0]);
  const fold = span(frames, f => Math.hypot(...subtract(f[2], f[8])));
  const lower = span(frames, f => project(f[2], f[7])[0]);
  const right = profile.right ? -1 : 1;
  return phase => {
    const frame = guideAt(frames, phase);
    const repAmount = rep(phase, .32, .59);
    const torsion = right * (mode === "twist" || mode === "kneeRoll" || mode === "hipOpen" ? (lower(frame) * 2 - 1) : Math.sin(2 * Math.PI * phase));
    const rise = mode === "star" ? .71 * (1 - fold(frame)) : 0;
    const hips = [0, .151, -.136];
    const p = torso(hips, -1.573 + rise, 0);
    p.headDrop = .033;
    if (mode === "twist" || mode === "kneeRoll") p.headAim = [.52 * torsion, .107, -.923];
    const active = profile.single ? right : 0;

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const source = index ? rightCross(frame) : leftCross(frame);
      let ankle = [sign * .146, .111, .693];
      let pole = [sign * .112, .172, .920];
      let toe = [sign * .012, .090, .102];
      let ground = false;
      if (mode === "scissor" || mode === "sideLeg") {
        const sweep = mode === "scissor" ? mix(-.22, profile.wide ? .663 : .412, source) : sign === active ? .683 * source : 0;
        const destinationX = sign * (.047 + sweep);
        const y = mode === "scissor" ? .126 + .023 * Math.sin((index * .5 + phase) * Math.PI * 4) : -.045 + .184 * source * Number(active === sign);
        ankle = add(p[side + "h"], [destinationX, y, Math.sqrt(Math.max(.026, .837 ** 2 - destinationX ** 2 - y ** 2))]);
        pole = [sign * .041, -.93, .26];
      } else if (mode === "twist" || mode === "kneeRoll" || mode === "hipOpen") {
        const bent = mode === "hipOpen" ? repAmount : .50 + .50 * Math.abs(torsion);
        const angle = mode === "hipOpen" ? sign * .93 * bent : .97 * torsion;
        const lift = mode === "kneeRoll" ? .042 : .183 * Math.abs(torsion);
        ankle = [sign * .133 + Math.sin(angle) * .246, .109 + lift, mode === "hipOpen" ? .183 + .35 * (1 - bent) : .323];
        pole = [Math.sin(angle) * .94, Math.cos(angle) * .89, -.071];
        toe = [Math.sin(angle) * .069, -.072 * Math.cos(angle), .104];
        ground = mode === "kneeRoll" && Math.abs(angle) < .10;
        if (active && sign !== active) {
          ankle = [sign * .142, .110, .711];
          toe = [sign * .015, .083, .099];
        }
      } else if (mode === "star") {
        const x = sign * (.625 - .488 * rise);
        ankle = [x, .111 + .601 * rise, .429 - .23 * rise];
        toe = [sign * .010, .071, .122];
        pole = [sign * .46, profile.tuck ? .94 : .13, .45];
      }
      leg(p, side, ankle, pole, toe, ground ? .024 : undefined);
    }

    for (const [side, sign] of sides) {
      const shoulder = p[side + "s"];
      let wrist = [sign * .262, .067, .082];
      let elbow = [sign * .71, -.61, -.09];
      let fingers = [0, -.047, .996];
      if (mode === "twist" || mode === "kneeRoll" || mode === "star") {
        wrist = add(shoulder, [sign * .597, -.077, .062]);
        fingers = [sign * .98, -.03, .14];
        if (mode === "star") {
          const target = profile.tuck ? p[side + "k"] : p[side + "t"];
          wrist = blend(wrist, add(target, [sign * .035, .048, -.019]), rise * 1.2);
          elbow = [sign * .59, -.40, -.58];
        } else if (active && sign !== active && profile.press) {
          wrist = blend(wrist, add(p[sign > 0 ? "rk" : "lk"], [sign * .044, .062, .025]), Math.abs(torsion));
        }
      } else if (mode === "hipOpen" && active === sign) {
        wrist = add(p[side + "k"], [sign * .042, .049, -.026]);
      }
      arm(p, side, wrist, elbow, fingers);
    }
    return p;
  };
}

function groundKneel(guide, profile) {
  const { frames } = guide;
  const project = projection(frames, false);
  const { mode } = profile;
  const active = profile.right ? -1 : 1;
  const index = active > 0 ? 0 : 1;
  const scores = [7,9].map(point => span(frames, f => Math.hypot(...project(frames[0][point], f[point]))));
  return phase => {
    const frame = guideAt(frames, phase);
    const move = scores[index](frame);
    const hips = [0, mode === "frog" ? .464 - .102 * move : .528, mode === "frog" ? -.308 - .081 * move : -.221];
    const p = torso(hips, mode === "frog" ? 1.614 : 1.563);
    const knee = frame[index ? 9 : 7];
    const ankle = frame[index ? 10 : 8];
    const [x, , z] = project(frame[2], ankle);
    const dir = Math.atan2(x, -z);
    for (const [side, sign] of sides) {
      const kneePoint = [sign * (mode === "frog" ? .394 + .109 * move : .132), .110, -.221];
      if (sign !== active || mode === "frog") {
        p[side + "k"] = kneePoint;
        p[side + "a"] = add(kneePoint, [mode === "frog" ? sign * .045 : -sign * .024, -.004, -.416]);
        p[side + "t"] = add(p[side + "a"], [sign * .016, -.057, -.130]);
      } else {
        const visible = Math.abs(project(frame[2], knee)[0]);
        const length = mode === "straight" || mode === "arc" ? .824 : mode === "kick" ? .592 + .228 * move : .423;
        const radius = length * Math.abs(Math.sin(dir));
        const destination = add(p[side + "h"], [sign * (.063 + radius) * move, -.424 + (mode === "circle" ? .481 : .405) * move,
          mix(-.424, -(length * Math.abs(Math.cos(dir))) + visible * .0019, move)]);
        leg(p, side, destination, [sign * .15, -.931 + .24 * move, .25], [sign * .041, -.055, -.123]);
      }
      const wrist = [sign * .214, .069, .305];
      if (mode === "frog") {
        p[side + "e"] = [sign * .221, .086, .174];
        p[side + "w"] = [sign * .216, .068, .544];
        p[side + "Fingers"] = [0, -.043, .999];
      } else {
        arm(p, side, wrist, [sign * .425, -.49, -.755], [0, -.033, .999]);
      }
    }
    return p;
  };
}

function openBook(guide) {
  const { frames } = guide;
  const project = projection(frames, false);
  const spreading = span(frames, f => Math.abs(project(f[4], f[6])[0]) + .35 * Math.abs(project(f[4], f[6])[2]));
  return phase => {
    const frame = guideAt(frames, phase);
    const open = spreading(frame);
    const hips = [0, .173, -.146];
    const p = torso(hips, -1.583, -.577 - .89 * (1 - open));
    p.headDrop = .056;
    p.headAim = [mix(.98, -.73, open), .126, -.03];
    for (const [side, sign] of sides) {
      const stacked = [sign * .004 + .424, .181 - sign * .055, .332];
      leg(p, side, stacked, [.961, .16, .04], [sign * .011, -.039, .123]);
      const wrist = sign < 0 ? [.551, .069, -.522] : blend([.526, .159, -.522], [-.613, .071, -.567], open);
      const moving = sign > 0 ? .483 * Math.sin(Math.PI * open) : 0;
      wrist[1] += moving;
      arm(p, side, wrist, [sign * .5, -.102, .81], [sign > 0 && open > .55 ? -.98 : .98, -.02, -.09]);
    }
    return p;
  };
}

export function overheadReferenceGuideMotion(guide, profile) {
  if (profile.family === "sweep") return shoulderSweep(guide, profile);
  if (profile.family === "kneel") return groundKneel(guide, profile);
  if (profile.family === "book") return openBook(guide);
  return supineFloor(guide, profile);
}
