import { add, arm, leg, mix, scale, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

function projection(from, to, plane, length) {
  const x = to[0] - from[0];
  const y = from[1] - to[1];
  const norm = Math.max(Math.hypot(x, y), .01);
  return plane === "sagittal" ? [0, y * length / norm, x * length / norm] : [x * length / norm, y * length / norm, 0];
}

function normalizer(frames, measure) {
  const samples = frames.map(measure);
  const low = Math.min(...samples);
  const width = Math.max(.01, Math.max(...samples) - low);
  return frame => (measure(frame) - low) / width;
}

export function standingGuideMotion(guide, profile) {
  const { frames } = guide;
  const mode = profile.mode;
  const reach = normalizer(frames, frame => frame[4][0]);
  const height = normalizer(frames, frame => -frame[4][1]);
  const separation = normalizer(frames, frame => Math.abs(frame[4][0] - frame[6][0]));
  const twistGuide = normalizer(frames, frame => (frame[4][0] + frame[6][0]) / 2);
  const rest = frames[0][1];

  return phase => {
    const frame = guideAt(frames, phase);
    const [head, neck, pelvis] = frame;
    const sideLean = mode === "side" ? Math.atan2(neck[0] - pelvis[0], pelvis[1] - neck[1]) : 0;
    const hipShift = profile.shift ? .008 * (pelvis[0] - frames[0][2][0]) : 0;
    const pitch = mode === "spine" ? .018 + .027 * (neck[0] - rest[0]) : .022;
    const turn = mode === "twist" ? (twistGuide(frame) - .50) * 1.45 : 0;
    const hipY = .910;
    const pose = stand([hipShift, hipY, .027], pitch, turn, sideLean);
    pose.headAim = [Math.sin(turn), mode === "spine" ? .009 * (rest[1] - head[1]) : 0, Math.cos(turn)];
    if (mode === "roll") {
      const lift = (rest[1] - neck[1]) * .0085;
      const depth = (neck[0] - rest[0]) * .012;
      for (const side of ["l", "r"]) pose[side + "s"] = add(pose[side + "s"], [0, lift, depth]);
    }

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const elbow = frame[near ? 3 : 5];
      const wrist = frame[near ? 4 : 6];
      const shoulder = pose[side + "s"];
      const sideWidth = profile.width ?? .151;
      leg(pose, side, [sign * sideWidth, .083, .053], [sign * .057, -.021, .96], [sign * .019, -.068, .128], 0);
      const projectedRoot = guide.shoulders ? frame[guide.shoulders[near ? 0 : 1]] : [neck[0] + sign * 12, neck[1] + 1];
      const projectedUpper = projection(projectedRoot, elbow, profile.plane, .252);
      const projectedLower = projection(elbow, wrist, profile.plane, .353);
      let pole = add(projectedUpper, [sign * .172, -.010, -.045]);
      let fingers = projectedLower;
      let target = add(shoulder, add(projectedUpper, projectedLower));
      target[2] += .037;

      if (mode === "roll" || profile.single && !near) {
        target = add(shoulder, [sign * .038, -.592, .067]);
        pole = [sign * .60, -.53, -.58];
        fingers = [0, -.98, .05];
      } else if (mode === "horizontal") {
        const angle = mix(profile.start, profile.end, reach(frame));
        target = add(shoulder, [Math.sin(angle) * .591, .011 * (height(frame) - .50), Math.cos(angle) * .591]);
        fingers = [Math.sin(angle), -.014, Math.cos(angle)];
      } else if (mode === "rotation") {
        const angle = mix(profile.start, profile.end, reach(frame));
        const axis = [Math.sin(angle), .09, Math.cos(angle)];
        const elbowAt = add(shoulder, [.052, -.247, .003]);
        target = add(elbowAt, scale(axis, .367));
        pole = [0, -.994, -.10];
        fingers = axis;
      } else if (mode === "contact" || mode === "chest") {
        const upper = mode === "contact";
        const breath = profile.breath ? .026 * Math.sin(phase * 4 * Math.PI) : 0;
        const point = upper ? add(pose.chest, [0, .116, .346 - (1 - height(frame)) * .067])
          : add(pose.hips, [0, -.132 + .196 * (1 - reach(frame)) + breath, -.116 - .248 * (1 - reach(frame))]);
        target = add(point, [sign * .036, sign * .010, 0]);
        pole = [sign * .91, -.32, -.29];
        fingers = upper ? [0, 1, .01] : [-sign * .71, -.30, -.64];
      } else if (mode === "cross") {
        const bothSides = 1 - separation(frame);
        const crossed = Math.max(0, Math.min(1, (bothSides - .19) / .72));
        const order = Math.sign(frame[6][1] - frame[4][1]);
        const angle = mix(Math.PI * .50, profile.openOnly ? 0 : -Math.PI * .185, crossed);
        target = add(shoulder, [sign * .615 * Math.sin(angle), order * sign * .049 * crossed, .615 * Math.cos(angle)]);
        pole = [sign * .19, -.94, -.25];
        fingers = [sign * Math.sin(angle), -.026, Math.cos(angle)];
      } else if (mode === "circle") {
        const time = (phase * frames.length) % frames.length;
        const period = profile.period ?? 4;
        const cycle = time < Math.floor(frames.length / period) * period ? (time % period) / period : 0;
        const deltaY = Math.max(-.37, Math.min(.37, (projectedRoot[1] - wrist[1]) * .012));
        const forward = Math.sin(Math.PI * cycle) * (profile.single ? .245 : .285);
        target = add(shoulder, [sign * Math.sqrt(Math.max(.14, .595 ** 2 - deltaY ** 2 - forward ** 2)), deltaY, forward]);
        fingers = [sign * .82, deltaY, forward];
      } else if (mode === "spine") {
        target = [sign * .172, hipY + .041, .111];
        pole = [sign * .76, -.24, -.59];
      } else if (mode === "twist" && profile.crossChest) {
        target = add(pose[near ? "rs" : "ls"], [sign * .047, -.14 + sign * .029, .104]);
        pole = [sign * .61, -.39, .64];
      } else if (mode === "twist" && profile.clasp) {
        target = add(pose.chest, [Math.sin(turn) * .316 + sign * .030, .119, Math.cos(turn) * .316]);
        pole = [sign * .68, -.72, -.12];
      } else if (mode === "twist") {
        target = add(shoulder, [sign * .069 + turn * .29, -.539, .219 * Math.abs(turn)]);
        fingers = [turn * .32, -.96, .03];
      } else if (mode === "clap") {
        const top = height(frame);
        if (top > .80) target = [sign * mix(Math.abs(target[0]), .025, (top - .80) * 5), target[1], .069];
      } else if (mode === "side" && profile.clasp) {
        target = add(pose.neck, [.38 * Math.sin(sideLean) + sign * .025, .38 * Math.cos(sideLean), .078]);
        fingers = [Math.sin(sideLean), Math.cos(sideLean), .05];
      }

      arm(pose, side, target, pole, Math.hypot(...fingers) > .001 ? fingers : [0, -1, 0]);
    }
    return pose;
  };
}
