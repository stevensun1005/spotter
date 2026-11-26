// Shared world-space joint geometry for the continuously skinned Spotter avatar.
export const sides = [["l", 1], ["r", -1]];
export const add = (a, b) => a.map((n, i) => n + b[i]);
export const subtract = (a, b) => a.map((n, i) => n - b[i]);
export const scale = (a, k) => a.map((n) => n * k);
export const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
export const unit = (a) => scale(a, 1 / Math.hypot(...a));
export const mix = (a, b, t) => a + (b - a) * t;
export const blend = (a, b, t) => a.map((n, i) => mix(n, b[i], t));
export const smooth = (t) => {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
};
export const ramp = (t, start, end) => smooth((t - start) / (end - start));
export const rep = (t, down = .44, up = .54) => ramp(t, 0, down) * (1 - ramp(t, up, 1));
export const halfCycle = (t) => ({ active: t < .5 ? 1 : -1, progress: (t * 2) % 1 });

function joints(root, destination, pole, near, far) {
  const delta = subtract(destination, root);
  const forward = unit(delta);
  const reach = Math.max(Math.abs(near - far) + .003, Math.min(near + far - .003, Math.hypot(...delta)));
  const along = (near ** 2 - far ** 2 + reach ** 2) / (2 * reach);
  const bend = unit(subtract(pole, scale(forward, dot(pole, forward))));
  return [
    add(add(root, scale(forward, along)), scale(bend, Math.sqrt(near ** 2 - along ** 2))),
    add(root, scale(forward, reach)),
  ];
}

export function torso(hips, angle, roll = 0) {
  const up = [0, Math.cos(angle), Math.sin(angle)];
  const forward = [0, -up[2], up[1]];
  const lateral = add([Math.cos(roll), 0, 0], scale(forward, Math.sin(roll)));
  const front = add(scale(forward, Math.cos(roll)), [-Math.sin(roll), 0, 0]);
  const at = (y, x = 0, z = 0) => add(hips, add(scale(up, y), add(scale(lateral, x), scale(front, z))));
  return { hips, chest: at(.369, 0, .006), neck: at(.605), head: at(.716, 0, .014),
    ls: at(.502, .192, .004), rs: at(.502, -.192, .004),
    lh: add(hips, [.103, 0, 0]), rh: add(hips, [-.103, 0, 0]), planted: {} };
}

export function arm(pose, side, destination, pole, fingers = [0, -.022, 1], palm = [1, 0, 0]) {
  [pose[side + "e"], pose[side + "w"]] = joints(pose[side + "s"], destination, pole, .252, .371);
  pose[side + "Fingers"] = fingers;
  pose[side + "PalmSide"] = palm;
}

export function grip(pose, side, destination, pole, axis) {
  [pose[side + "e"], pose[side + "w"]] = joints(pose[side + "s"], destination, pole, .252, .371);
  pose[side + "Grip"] = axis;
}

export function leg(pose, side, destination, pole, toe, surface) {
  [pose[side + "k"], pose[side + "a"]] = joints(pose[side + "h"], destination, pole, .422, .424);
  pose[side + "t"] = add(pose[side + "a"], toe);
  if (surface != null) pose.planted[side] = surface;
}

export function legAngles(pose, side, sign, thigh, shin, spread = 0) {
  pose[side + "k"] = add(pose[side + "h"], [sign * spread, .422 * Math.sin(thigh), .422 * Math.cos(thigh)]);
  pose[side + "a"] = add(pose[side + "k"], [-sign * spread, .424 * Math.sin(shin), .424 * Math.cos(shin)]);
  pose[side + "t"] = add(pose[side + "a"], [sign * .010, -.072 * Math.cos(shin) + .115 * Math.sin(shin),
    .115 * Math.cos(shin) + .072 * Math.sin(shin)]);
}

export function stand(hips, pitch, yaw = 0, tilt = 0) {
  const pose = torso(hips, pitch);
  for (const key of ["chest", "neck", "head", "ls", "rs"]) {
    const [x, y, z] = subtract(pose[key], hips);
    const leanedX = x * Math.cos(tilt) + y * Math.sin(tilt);
    const leanedY = y * Math.cos(tilt) - x * Math.sin(tilt);
    pose[key] = add(hips, [leanedX * Math.cos(yaw) + z * Math.sin(yaw), leanedY,
      z * Math.cos(yaw) - leanedX * Math.sin(yaw)]);
  }
  return pose;
}
