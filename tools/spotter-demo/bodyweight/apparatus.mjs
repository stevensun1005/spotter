import {
  sides, add, subtract, scale, blend, smooth, ramp, rep,
  halfCycle, torso, arm, grip, leg, legAngles, stand,
} from "./pose.mjs";

// Motion authored against the exact mounting points of the Spotter equipment meshes.
export function pullUp(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.alternate ? progress : phase;
  const r = rep(t, options.hold ? .37 : .45, options.hold ? .68 : .54);
  const maxLift = options.scapula ? .092 : options.raise ? .015 : options.rear ? .464 : .508;
  const shift = options.archer ? active * .294 * r : options.single ? -.16 + .13 * r : 0;
  const yStart = options.scapula || options.width > .44 ? 1.078 : 1.038;
  const z = options.rear ? .214 : options.neutral ? .026 : .008 - .071 * r;
  const pitch = options.rear ? .026 : -.083 - .045 * r;
  const pose = torso([shift, yStart + maxLift * r, z], pitch, options.archer ? -.10 * active * r : 0);
  pose.headDrop = -.015;
  if (options.scapula) {
    for (const key of ["ls", "rs"]) pose[key][1] -= .057 * r;
  }
  for (const [side, sign] of sides) {
    const width = options.width ?? .228;
    const hand = options.single ? sign > 0 ? [.018, 2.144, .097] : [-.011, 2.025, .095]
      : [sign * width, 2.144, options.neutral ? .105 : .097];
    const axis = options.neutral ? [0, 0, sign] : [sign * (options.reverse ? -1 : 1), 0, 0];
    grip(pose, side, hand, [sign * (options.archer ? 1 : .69), -.43, options.rear ? -.74 : .30], axis);
    if (options.lsit || options.raise) {
      const a = options.lsit ? 0 : -1.502 + options.raise * r;
      const b = options.oblique ? a - (1.12 * r) : a;
      legAngles(pose, side, sign, a, b);
      const twist = options.alternate ? r * active * (options.oblique ? .167 : .281) : 0;
      pose[side + "k"][0] += twist * .52;
      pose[side + "a"][0] += twist;
      pose[side + "t"][0] += twist;
    } else {
      const a = options.rear ? -1.535 : -1.491;
      legAngles(pose, side, sign, a, a - .235 - .091 * r);
    }
  }
  return pose;
}

export function backExtension(phase, incline) {
  const d = rep(phase, .48, .56);
  const hipY = incline ? .851 : .895;
  const hipZ = incline ? .006 : .114;
  const pitch = (incline ? .787 : 1.529) + (incline ? 1.21 : .91) * d;
  const pose = torso([0, hipY, hipZ], pitch);
  pose.headDrop = -.022;
  for (const [side, sign] of sides) {
    const chest = pose.chest;
    const normal = [0, -Math.sin(pitch), Math.cos(pitch)];
    const touch = add([sign * -.103, chest[1], chest[2]], scale(normal, .153));
    arm(pose, side, touch, [sign * .94, -.11, -.22]);
    leg(pose, side, [sign * .125, incline ? .258 : .793, incline ? -.582 : -.700],
      [sign * .08, -.51, -.42], [sign * .012, -.077, .105]);
  }
  return pose;
}

export function doorStretch(phase) {
  const stretch = rep(phase, .30, .73);
  const hips = [0, .898 + .005 * stretch, -.251 + .122 * stretch];
  const pose = torso(hips, .155 + .218 * stretch);
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .468, 1.516, -.020], [sign * .82, -.98, .42], [0, 1, .015]);
    leg(pose, side, [sign * .139, .087, sign > 0 ? .340 : -.551],
      [sign * .058, -.02, .87], [sign * .014, -.071, .129], 0);
  }
  return pose;
}

export function assaultBike(phase) {
  const spin = phase * Math.PI * 2;
  const roll = .028 * Math.sin(spin);
  const pose = torso([0, 1.003, -.262], .585, roll);
  pose.headDrop = -.032;
  pose.machineTravel = phase;
  for (const [side, sign] of sides) {
    const swing = sign * .219 * Math.cos(spin);
    const gripY = .674 + .609 * Math.cos(swing);
    const gripZ = .496 + .609 * Math.sin(swing);
    const pedalY = .423 + sign * .169 * Math.cos(spin);
    const pedalZ = .027 + sign * .169 * Math.sin(spin);
    grip(pose, side, [sign * .214, gripY, gripZ], [sign * .58, -.72, -.34], [sign, 0, 0]);
    leg(pose, side, [sign * .154, pedalY + .067, pedalZ - .068],
      [sign * .103, -.06, .95], [sign * .008, -.065, .129]);
  }
  return pose;
}

export function treadmillWalk(phase) {
  const step = phase * Math.PI * 2;
  const pose = torso([Math.sin(step) * .023, 1.093 + .022 * Math.cos(2 * step), -.035], .128, .035 * Math.sin(step));
  pose.machineTravel = phase * 1.56;
  for (const [side, sign] of sides) {
    const t = (phase + (sign < 0 ? .5 : 0)) % 1;
    const stance = t <= .62;
    const swing = Math.max(0, (t - .62) / .38);
    const z = stance ? .334 - .724 * t / .62 : -.390 + .724 * smooth(swing);
    const deckY = .155 + .145 * (z + .80);
    const ankleY = deckY + .086 + .106 * Math.sin(swing * Math.PI);
    const toePitch = stance ? .145 - .24 * ramp(t, .43, .62) : -.18 + .32 * smooth(swing);
    leg(pose, side, [sign * .111, ankleY, z], [sign * .054, -.058, .94],
      [sign * .009, -.072 + .136 * Math.sin(toePitch), .139 * Math.cos(toePitch)],
      stance ? deckY + .008 : undefined);
    const shoulder = pose[side + "s"];
    const swingArm = Math.cos(2 * Math.PI * (t + .125));
    arm(pose, side, [shoulder[0] + sign * .045, shoulder[1] - .487 + .041 * swingArm,
      pose.hips[2] + .152 - .219 * swingArm], [sign * .17, -.43, -.79]);
  }
  return pose;
}

export function benchDip(phase, options) {
  const r = rep(phase, options.hold ? .38 : .45, options.hold ? .60 : .55);
  const floor = options.floor ? 0 : .459;
  const pose = torso([0, floor + (options.floor ? .158 : .128) - (options.floor ? .093 : .337) * r,
    options.floor ? .025 : .059 - .036 * r], options.floor ? -.65 - .12 * r : -.053 - .045 * r);
  for (const [side, sign] of sides) {
    const hand = [sign * .204, floor + .034, options.floor ? -.425 : -.097];
    arm(pose, side, hand, [sign * .386, .18, -.885]);
    const footSurface = options.double ? .459 : 0;
    const footZ = options.double ? .728 : options.bent ? .513 : .748;
    leg(pose, side, [sign * .124, footSurface + .077, footZ], [sign * .061, .88, .289],
      [sign * .016, -.073, .138], footSurface);
  }
  return pose;
}

export function dip(phase, options) {
  const load = rep(phase, options.hold ? .36 : .45, options.hold ? .65 : .55);
  const pitch = options.reverse ? .01 : .10 + .40 * load;
  const hips = [0, 1.295 - .438 * load, options.straight ? -.430 - .045 * load : .087 - .212 * load];
  const pose = torso(hips, pitch);
  for (const [side, sign] of sides) {
    const goal = [sign * (options.straight ? .216 : .266), 1.175, options.straight ? -.210 : .10];
    grip(pose, side, goal, [sign * .49, -.05, -.92], options.straight ? [sign, 0, 0] : [0, 0, sign]);
    legAngles(pose, side, sign, -1.57 + .13 * load, -2.22 - .26 * load);
    if (options.cross) {
      pose[side + "a"][0] -= sign * .128;
      pose[side + "t"][0] -= sign * .128;
      pose[side + "a"][2] += sign * .036;
      pose[side + "t"][2] += sign * .036;
    }
  }
  return pose;
}

export function invertedRow(phase, options) {
  const d = rep(phase, .42, .57);
  const handY = options.high ? 1.163 : .945;
  const shoulder = handY - .565 + .442 * d;
  const foot = [.129, .086, options.bent ? .513 : options.high ? .835 : .761];
  const hip = [0, .148 + (shoulder - .148) * (options.bent ? .47 : .625), options.bent ? .097 - .04 * d : .026 + .101 * d];
  const pitch = -Math.acos((shoulder - hip[1]) / .502);
  const pose = torso(hip, pitch);
  pose.headDrop = -.023;
  for (const [side, sign] of sides) {
    grip(pose, side, [sign * options.width, handY, -.429], [sign * .82, -.39, .054], [sign * (options.supinated ? -1 : 1), 0, 0]);
    leg(pose, side, [sign * foot[0], foot[1], foot[2]], [sign * .039, .96, .07],
      [sign * .014, -.024, .136], 0);
  }
  return pose;
}

export function doubleLegRaise(phase) {
  const r = rep(phase, .33, .62);
  const angle = -.973 + .385 * r;
  const pose = torso([0, .580 + .026 * r, -.267], angle);
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .200, .497, -.174], [sign * .54, -.21, -.62]);
    legAngles(pose, side, sign, -.64 + .64 * r, -1.48 + 1.51 * r);
  }
  return pose;
}

export function chairStretch(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(options.back ? phase : progress, .34, .66);
  const hips = [.10, .566, .858];
  const pose = stand(hips, .105 + (options.back ? .729 : .418) * r);
  for (const [side, sign] of sides) {
    const extended = sign === active && !options.back;
    const z = extended ? 1.191 + .339 * r : 1.133;
    leg(pose, side, [.10 + sign * .125, .092, z], [sign * .06, .56, .86],
      [sign * .013, extended ? .021 + .105 * r : -.076, .132], 0);
    const hand = extended ? [.10 + sign * .114, .43 - .229 * r, 1.237 + .338 * r]
      : [.10 + sign * .154, .484 - .030 * r, .977 + .166 * r];
    arm(pose, side, hand, [sign * .68, -.329, -.63]);
  }
  return pose;
}

export function tiltedCore(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(options.twist ? progress : phase, .43, .58);
  const incline = options.incline;
  const hips = [0, .666 + (incline ? .075 * r : 0), .062];
  const pitch = (incline ? -1.115 : options.twist ? -2.244 : -2.008) + (options.rise ?? 0) * r;
  const pose = torso(hips, pitch, options.twist ? active * .476 * r : 0);
  for (const [side, sign] of sides) {
    if (incline) {
      const lift = -.38 + 1.80 * r;
      legAngles(pose, side, sign, lift, lift - .039);
      grip(pose, side, [sign * .224, .730, -.383], [sign * .741, .14, .654], [0, 0, sign]);
    } else {
      leg(pose, side, [sign * .142, .541, .728], [sign * .072, .94, .15],
        [sign * .012, -.065, .137]);
      const hand = options.twist ? add(pose.head, [sign * .118, -.013, -.057])
        : options.rise > .95 ? [sign * -.113, pose.chest[1] + .132, pose.chest[2] + .143]
        : add(pose.head, [sign * .127, -.019, -.042]);
      arm(pose, side, hand, [sign * .65, .10, -.72]);
    }
  }
  return pose;
}

export function oneArmDip(phase) {
  const { active, progress } = halfCycle(phase);
  const d = rep(progress, .42, .55);
  const release = rep(progress, .235, .77);
  const pose = benchDip(progress, {hold: true});
  for (const [key, value] of Object.entries(pose)) {
    if (Array.isArray(value) && value.length === 3 && key.length <= 5) value[0] += active * .064 * d;
  }
  for (const [side, sign] of sides) {
    const palm = [sign * .204, .493, -.097];
    const elbow = [sign * .66, -.13, -.71];
    if (sign === active) arm(pose, side, palm, elbow);
    else arm(pose, side, blend(palm, add(pose.hips, [sign * .125, .145, .17]), release), elbow);
  }
  return pose;
}

export function captainRaise(phase) {
  const r = rep(phase, .40, .61);
  const hips = [0, .875 + .036 * r, -.204];
  const pose = torso(hips, .045 + .092 * r);
  for (const [side, sign] of sides) {
    grip(pose, side, [sign * .281, 1.247, .219], [sign * .822, -.46, -.36], [0, 0, sign]);
    const lift = -1.58 + 1.64 * r;
    legAngles(pose, side, sign, lift + .07, lift - .052);
  }
  return pose;
}

export function towelRow(phase, squats) {
  const r = rep(phase, .41, .62);
  const hips = [0, .875 - (squats ? .355 : .024) * r, -.079 - (squats ? .193 : .021) * r];
  const pose = torso(hips, squats ? .06 + .293 * r : .289);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .169, .086, .064], [sign * .12, -.072, .90], [sign * .015, -.071, .131], 0);
    const shoulder = pose[side + "s"];
    grip(pose, side, [sign * .148, shoulder[1] - .31 + .146 * r, shoulder[2] + .427 - .285 * r],
      [sign * .72, -.039, -.697], [sign, 0, 0]);
  }
  return pose;
}

export function skinCat(phase) {
  const r = rep(phase, .43, .57);
  const belly = Math.sin(Math.PI * r);
  const angle = -6.02 * r;
  const shoulder = [0, 1.58 + .27 * belly, .061 - .196 * belly + .205 * r];
  const hips = subtract(shoulder, [0, .502 * Math.cos(angle), .502 * Math.sin(angle)]);
  const pose = torso(hips, angle);
  for (const [side, sign] of sides) {
    grip(pose, side, [sign * .237, 2.144, .097], [sign * .56, -.38, .51 - .97 * r], [sign, 0, 0]);
    const legDirection = -Math.PI / 2 - angle;
    legAngles(pose, side, sign, legDirection + 1.07 * belly, legDirection - 1.30 * belly, .031 * belly);
  }
  return pose;
}

export function straps(phase, type) {
  if (type === "ring") return dip(phase, {cross: true});
  if (type === "row" || type === "parallel-row") {
    const pose = invertedRow(phase, {high: type === "parallel-row", width: type === "parallel-row" ? .208 : .262});
    if (type === "parallel-row") {
      pose.lGrip = [0, 0, 1];
      pose.rGrip = [0, 0, -1];
    }
    return pose;
  }
  const r = rep(phase, .43, .56);
  const pushes = type === "push-up";
  const split = type === "split";
  const pitch = split ? .058 + .143 * r : pushes ? .69 + .309 * r : .075 + .60 * r;
  const footY = pushes ? .097 : .086;
  const footZ = pushes ? -.759 : -.309;
  const shifts = split ? [.09, .902 - .327 * r, .018 + .11 * r]
    : [0, footY + .843 * Math.cos(pitch), footZ + .843 * Math.sin(pitch)];
  const pose = torso(shifts, pitch);
  for (const [side, sign] of sides) {
    const shoulder = pose[side + "s"];
    if (split) {
      arm(pose, side, add(shoulder, [sign * .051, -.579 + .218 * r, .09 + .266 * r]),
        [sign * .47, -.12, -.84]);
      const foot = sign > 0 ? [.124, .380, -.691] : [-.127, .086, .328];
      leg(pose, side, foot, [sign * .069, -.045, .96], [sign * .01, -.067, .132], sign < 0 ? 0 : undefined);
    } else {
      const foot = [sign * (pushes ? .120 : .146), footY, footZ];
      leg(pose, side, foot, [sign * .06, -.044, .95], [sign * .012, -.072, .129], 0);
      const falloutX = .242 + .027 * r;
      const falloutZ = .275 + .703 * r;
      const strapLength = .997;
      const falloutY = 2.292 - Math.sqrt(strapLength ** 2 - (falloutX - .298) ** 2 - (falloutZ - .300) ** 2);
      const target = pushes ? [sign * (.226 + .073 * r), .689, .495]
        : [sign * falloutX, falloutY, falloutZ];
      grip(pose, side, target, [sign * .69, -.15, -.71], [sign, 0, 0]);
    }
  }
  return pose;
}
