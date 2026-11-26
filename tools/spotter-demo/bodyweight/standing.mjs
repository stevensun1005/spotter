import { sides, add, blend, smooth, ramp, rep, halfCycle, torso, arm, grip, leg, legAngles, stand } from "./pose.mjs";

// Ground and standing movements, including their stance and swing phases.
export function jump(phase, options) {
  const t = options.alternating ? halfCycle(phase).progress : phase;
  const direction = options.alternating ? halfCycle(phase).active : 1;
  const preload = rep(t, .19, .23) * (1 - ramp(t, .22, .38));
  const landing = rep(t, .79, .83) * ramp(t, .62, .71);
  const inAir = ramp(t, .32, .43) * (1 - ramp(t, .62, .72));
  const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, (t - .31) / .41)));
  const squat = options.depth * Math.max(preload, landing);
  const z = options.forward ? .768 * ramp(t, .31, .71) : 0;
  const x = options.skater ? direction * (.275 - .55 * ramp(t, .31, .71)) : 0;
  const pose = stand([x, .888 - squat + options.height * arc, z - .21 * squat], .02 + (options.skater ? .34 : .63) * squat);
  pose.followZ = z;
  for (const [side, sign] of sides) {
    const extra = (options.open ? .262 : 0) * inAir;
    const footX = x + sign * (.148 + extra) + (options.scissors ? -sign * .23 * inAir : 0);
    const footZ = z + (options.scissors ? direction * sign * .264 * inAir : 0)
      - (options.skater && sign !== direction ? .225 + .112 * landing : 0);
    leg(pose, side, [footX, .084 + .91 * options.height * arc, footZ], [sign * .107, -.05, .93],
      [sign * .016, -.071 - .021 * inAir, .137], arc < .003 ? 0 : undefined);
    const shoulder = pose[side + "s"];
    const raise = options.overhead ? 1.07 * inAir : options.open ? .55 * inAir : .26 * inAir;
    const hand = add(shoulder, [sign * (.05 + (options.open ? .448 : .120) * inAir), -.570 + raise,
      (options.open ? .104 : .353) * inAir - .154 * preload]);
    arm(pose, side, hand, [sign * .43, -.26, -.76]);
  }
  return pose;
}

export function squat(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.twist ? progress : phase;
  const r = rep(t, .44, .55);
  const reach = options.reach ? 1 - r : 0;
  const pose = stand([0, .892 - options.depth * r, -.055 - .244 * r], .042 + .42 * r, options.twist ? active * .42 * reach : 0);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * options.width, .082, .078], [sign * .230, .032, .923], [sign * .032, -.069, .126], 0);
    const shoulder = pose[side + "s"];
    const hand = add(shoulder, [sign * (.04 + .046 * reach), -.563 + 1.145 * reach + .19 * r, .03 + .391 * r + .14 * reach]);
    arm(pose, side, hand, [sign * .43, -.35, -.77]);
  }
  return pose;
}

export function bodyweightSquat(phase, options) {
  const cycle = rep(phase, options.press ? .38 : options.hold ? .18 : .41,
    options.press ? .48 : options.hold ? .81 : .58);
  const depth = options.pulse ? cycle * (.91 + .09 * Math.cos(10 * Math.PI * phase)) : cycle;
  const width = options.width ?? .165;
  const wide = Math.max(0, width - .172);
  const pitch = .025 + (options.hands === "ground" ? .72 : options.hands === "overhead" ? .178 : .31) * depth;
  const hips = [0, .918 - options.depth * depth, .029 - (.205 + .22 * wide) * depth];
  const pose = stand(hips, pitch);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * width, .084, .064], [sign * (.092 + 1.35 * wide), .012, .96],
      [sign * (.018 + .39 * wide), -.068, .126], 0);
    const shoulder = pose[side + "s"];
    const raised = add(shoulder, [sign * .036, .608 * Math.cos(pitch), .608 * Math.sin(pitch)]);
    let hand;
    let elbow = [sign * .43, -.45, -.61];
    if (options.press) {
      const drive = ramp(phase, .58, .82) * (1 - ramp(phase, .88, 1));
      const rack = add(shoulder, [sign * .041, .016, .169]);
      hand = blend(rack, raised, drive);
    } else if (options.hands === "overhead") {
      hand = raised;
    } else if (options.hands === "prisoner") {
      hand = add(pose.head, [sign * .104, -.025, -.104]);
      elbow = [sign * .98, .23, -.15];
    } else if (options.hands === "cup") {
      hand = add(shoulder, [-sign * .161, -.141 + sign * .018, .247]);
    } else if (options.hands === "ground") {
      hand = blend(add(shoulder, [sign * .045, -.552, .053]), [sign * .037, .059, .200], depth);
    } else {
      const reach = options.hands === "reach" ? 1 : depth;
      hand = add(shoulder, [sign * .025, -.552 + .516 * reach, .044 + .528 * reach]);
    }
    const fingers = options.hands === "ground" ? [0, -.96, .22]
      : options.press || options.hands === "overhead" ? [0, Math.cos(pitch), Math.sin(pitch)] : [0, -.018, .999];
    arm(pose, side, hand, elbow, fingers);
  }
  return pose;
}

export function goodMorning(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.offsetFeet ? progress : phase;
  const placement = options.offsetFeet ? rep(t, .19, .81) : 0;
  const effort = options.offsetFeet ? ramp(t, .21, .44) * (1 - ramp(t, .55, .78)) : rep(t, .45, .55);
  const hips = [active * .060 * placement, .920 - .069 * effort, -.004 - .267 * effort];
  const pose = stand(hips, .026 + .96 * effort);
  for (const [side, sign] of sides) {
    const rear = sign === active ? 0 : placement;
    const front = sign === active ? placement : 0;
    const swing = Math.sin(Math.PI * rear) * .081;
    leg(pose, side, [sign * (.137 - .036 * placement), .083 + .071 * rear + swing, .034 + .062 * front - .255 * rear],
      [sign * .062, -.013, .96], [sign * .016, -.071 - .071 * rear, .126], swing < .002 ? 0 : undefined);
    arm(pose, side, add(pose.head, [sign * .113, -.024, -.11]), [sign * .96, .23, -.23]);
  }
  return pose;
}

export function wallSlideSquat(phase, options) {
  const slide = rep(phase, options.hold ? .19 : .41, options.hold ? .82 : .60);
  const hipY = options.hip - options.depth * slide;
  const hips = [0, hipY, -.439];
  const pose = stand(hips, .006);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .162, .085, options.ankle], [sign * .079, -.02, .952], [sign * .022, -.072, .127], 0);
    const hand = options.hold ? [-sign * .062, hips[1] + .267 + sign * .018, -.241]
      : [sign * .240, hips[1] - .037, -.338];
    arm(pose, side, hand, [sign * .64, -.27, -.55]);
  }
  return backToWall(pose);
}

export function lunge(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.fixed ? phase : progress;
  const sign = options.fixed ? 1 : active;
  const down = rep(t, options.hold ? .33 : .43, options.hold ? .68 : .55);
  const step = options.fixed ? 1 : ramp(t, .025, .29) * (1 - ramp(t, .67, .975));
  const rear = options.reverse || options.curtsey;
  const rectified = rear ? -1 : 1;
  const hips = [options.curtsey ? -sign * .082 * down : 0, .892 - options.depth * down, rectified * .178 * step];
  const pitch = .035 + (options.stretch ? .225 : .089) * down;
  const pose = stand(hips, pitch, options.twist ? sign * .55 * down : 0);
  for (const [side, s] of sides) {
    const moving = s === sign;
    const toward = moving ? rectified * (options.fixed ? .53 : .604) * step : options.fixed ? -.17 : options.stretch ? -.34 * step : 0;
    const x = s * .145 - (options.curtsey && moving ? s * .35 * step : 0);
    const back = rear ? moving : !moving;
    const stepLift = moving && !options.fixed ? .116 * Math.sin(Math.PI * step) : 0;
    const heel = back && !options.stretch ? .071 * step : 0;
    leg(pose, side, [x, .083 + stepLift + heel, toward], [s * .07, -.08, .94],
      [s * .015, -.072 - heel, .132], stepLift < .001 ? 0 : undefined);
    const shoulder = pose[side + "s"];
    const hand = options.stretch ? [sign * .142 + s * .069, .912 - .31 * down, .371 * step]
      : options.overhead ? add(shoulder, [s * .042, -.568 + 1.144 * down, .045 + .139 * down])
      : options.twist ? add(shoulder, [-s * .306 * down, -.562 + .255 * down, .03 + .32 * down])
      : [hips[0] + s * .159, hips[1] + .062, hips[2] + .066];
    arm(pose, side, hand, [s * .71, -.08, -.65]);
  }
  return pose;
}

export function guidedLunge(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.fixed ? phase : progress;
  const movingSide = options.fixed ? 1 : active;
  const frontSide = options.reverse || options.curtsey ? -movingSide : movingSide;
  const stride = options.stride ?? .615;
  const stance = options.fixed ? 1 : rep(t, .245, .765);
  const dip = options.fixed ? rep(t, options.hold ? .19 : .43, options.hold ? .81 : .57)
    : ramp(t, .24, options.pulse ? .34 : .43) * (1 - ramp(t, options.pulse ? .68 : .58, .77));
  const depth = options.pulse ? dip * (.93 + .07 * Math.cos(12 * Math.PI * t)) : dip;
  const pitch = (options.hinge ? .45 : .095) * depth + .028;
  const sideTravel = options.curtsey ? frontSide * .075 : options.diagonal ? movingSide * .131 : 0;
  const hips = [sideTravel * stance, .914 - (.076 + .21 * (stride - .615)) * stance - options.depth * depth,
    .035 + (options.fixed ? .060 : options.curtsey ? -.125 : options.reverse ? -.237 : .43 * stride) * stance];
  const pose = stand(hips, pitch);
  for (const [side, sign] of sides) {
    const moving = sign === movingSide;
    const front = sign === frontSide;
    const swing = moving && !options.fixed ? .116 * Math.sin(Math.PI * stance) : 0;
    const baseX = sign * .131;
    const footX = baseX + (moving && options.curtsey ? -sign * .385 * stance
      : moving && options.diagonal ? sign * .405 * stance : 0);
    const z = .053 + (options.fixed ? (front ? .410 : -.315) : moving ? (front ? stride : -stride) * stance : 0);
    const heelAngle = .49 + (front ? 0 : .68 * stance);
    const ankleY = .018 + .145 * Math.sin(heelAngle);
    const ankleZ = z + .128 - .145 * Math.cos(heelAngle);
    leg(pose, side, [footX, ankleY + swing, ankleZ], [sign * .076, -.055, .96],
      [sign * .016, .018 - ankleY, .145 * Math.cos(heelAngle)], front && swing < .002 ? 0 : undefined);
    const hand = options.overhead ? add(pose[side + "s"], [sign * .045, .603 * Math.cos(pitch), .603 * Math.sin(pitch)])
      : add(hips, [sign * .163, .083, .087]);
    arm(pose, side, hand, [sign * .71, -.08, -.65], options.overhead ? [0, Math.cos(pitch), Math.sin(pitch)] : [0, -.06, .998]);
  }
  return pose;
}

export function halfSplitStretch(phase) {
  const stretch = rep(phase, .21, .80);
  const angle = .071 + .91 * stretch;
  const knee = [-.108, .110, -.119];
  const hips = [0, knee[1] + .422 * Math.cos(angle), knee[2] - .422 * Math.sin(angle)];
  const torsoPitch = .100 + .756 * stretch;
  const pose = stand(hips, torsoPitch);
  pose.rk = knee;
  pose.ra = [-.108, .153, -.540];
  pose.rt = [-.113, .100, -.657];
  leg(pose, "l", [.136, .117, .429], [.089, .18, .97], [.009, .057, .124], .024);
  arm(pose, "l", [pose.lk[0] + .078, pose.lk[1] + .05, pose.lk[2] + .035], [.64, .15, -.62]);
  arm(pose, "r", add(hips, [-.210, -.019, .213]), [-.67, -.55, -.43]);
  return pose;
}

export function legMobility(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, .40, .58);
  const pose = stand([-active * .090 * r, .903 - .020 * r, 0], .033, 0, -active * .046 * r);
  for (const [side, sign] of sides) {
    if (sign === active && options.curl) {
      legAngles(pose, side, sign, -1.58 - .073 * r, -1.56 - 1.58 * r);
      pose[side + "a"][1] += .043 * (1 - r);
      pose[side + "t"] = add(pose[side + "a"], [sign * .011, -.070, .132 - .208 * r]);
    } else {
      const lift = sign === active ? r : 0;
      leg(pose, side, [sign * (.134 + .545 * lift), .082 + .302 * lift, .038 - .027 * lift],
        [sign * .19, -.03, .93], [sign * .022, -.064, .125], lift < .001 ? 0 : undefined);
    }
    arm(pose, side, [pose.hips[0] + sign * .163, pose.hips[1] + .057, .072], [sign * .79, -.12, -.43]);
  }
  return pose;
}

export function upperMobility(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(options.alternate ? progress : phase, .32, .68);
  const twist = options.archer ? active * .55 * r : 0;
  const tilt = options.lean ? active * options.lean * r : 0;
  const hips = [0, options.kneel ? .515 : .895, .002];
  const pose = stand(hips, .029, twist, tilt);
  if (options.neck) {
    const angle = active * (options.assist ? .415 : options.neckAngle ?? .324) * r;
    pose.head[0] += active * .065 * r;
    pose.head[1] -= .022 * r;
    pose.headAim = [Math.sin(angle), Math.cos(angle), .025];
  }
  for (const [side, sign] of sides) {
    if (options.kneel) {
      pose[side + "k"] = [sign * .146, .110, .108];
      pose[side + "a"] = [sign * .169, .101, -.315];
      pose[side + "t"] = [sign * .181, .060, -.441];
    } else {
      leg(pose, side, [sign * .156, .092, .063], [sign * .12, -.05, .94], [sign * .016, -.070, .131], 0);
    }
    const s = pose[side + "s"];
    let hand = add(s, [sign * .04, -.586, .022]);
    if (options.chest) {
      hand = [sign * (.763 - .931 * r), s[1] - .077 + .074 * r, .535 * r];
    } else if (options.squeeze) {
      hand = [sign * (.284 - .270 * r), s[1] - .057, .578 - .014 * r];
    } else if (options.rear) {
      hand = sign === active ? [-sign * .365 * r, s[1] - .081, .388 * r]
        : [sign * .192 * r, s[1] - .105, .270 * r];
      hand = blend(add(s, [sign * .042, -.584, .024]), hand, Math.min(1, r * 2));
    } else if (options.triceps) {
      hand = sign === active ? blend(hand, [sign * .089, s[1] + .307, -.091], r)
        : blend(hand, [-sign * .142, s[1] + .541, .023], r);
    } else if (options.archer) {
      hand = sign === active ? [sign * (.203 + .333 * r), s[1] - .052, .534 - .316 * r]
        : [sign * (.203 + .142 * r), s[1] - .048, .529 - .466 * r];
    } else if (options.kneel) {
      hand = [s[0] - sign * .163 + tilt * .211, s[1] + .572, .087];
    } else if (options.lean) {
      hand = add(s, [sign * .551 - active * .086 * r, -.056 + sign * active * .306 * r, .081]);
    } else if (options.neck && options.assist && sign === active) {
      hand = blend(hand, add(pose.head, [-sign * .088, .085, .023]), r);
    }
    arm(pose, side, hand, [sign * .77, -.23, -.43]);
  }
  return pose;
}

export function calfRaise(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.single ? progress : phase;
  const d = rep(t, .37, .62);
  const bodyShift = options.single ? -.093 * active * rep(t, .21, .79) : 0;
  const step = options.step ? .31 : 0;
  const pitch = options.lean ?? (options.wall ? .18 : .022);
  const hips = [bodyShift + (options.bench ? .10 : 0), (options.lean ? .846 : .885) + step + .108 * d,
    options.bench ? -.119 : options.wall ? -.206 : options.step ? .13 : .015];
  const pose = stand(hips, pitch);
  for (const [side, sign] of sides) {
    const lift = options.single && sign === active ? rep(t, .19, .78) : 0;
    const heel = .102 * d;
    const startZ = options.bench ? -.224 : options.wall ? -.298 : options.step ? .151 : 0;
    const capX = (options.bench ? .10 : 0) + sign * .126;
    const ankleY = step + .085 + heel + .246 * lift;
    leg(pose, side, [capX, ankleY, startZ + .049 * d - .239 * lift], [sign * .075, .04, .94],
      [sign * .012, -.068 - heel, .137 - .027 * d], !options.step && lift < .001 ? 0 : undefined);
    const shoulder = pose[side + "s"];
    const support = options.bench ? [.10 + sign * .171, .502, .568]
      : options.wall ? [sign * .213, 1.247 + (options.lean ? -.283 : 0), .513]
      : add(shoulder, [sign * .052, -.579, .105]);
    arm(pose, side, support, [sign * .56, -.65, -.45], options.wall ? [0, 1, .022] : [0, -.022, 1]);
  }
  return pose;
}

export function standingCalf(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.single ? progress : phase;
  const standing = options.squat ? rep(t, .17, .83) : 0;
  const balance = options.single ? rep(t, .18, .80) : 0;
  const start = options.single ? .22 : options.squat ? .18 : .02;
  const end = options.single ? .76 : options.squat ? .82 : .98;
  const local = Math.min(1, Math.max(0, (t - start) / (end - start)));
  const effort = rep(local, options.hold ? .22 : .36, options.hold ? .78 : .55);
  const raise = options.pulse ? rep(local, .24, .76) * (.84 + .16 * Math.cos(8 * Math.PI * local)) : effort;
  const step = options.step ? .31 : 0;
  const toeY = step + .017;
  const toeZ = options.step ? .233 : .145;
  const angle = (options.step ? -.18 : .46) + (options.step ? 1.36 : .75) * raise;
  const ankleY = toeY + .157 * Math.sin(angle);
  const ankleZ = toeZ - .157 * Math.cos(angle);
  const hips = [options.single ? -active * .114 * balance : 0,
    ankleY + .826 - .281 * standing, ankleZ - .034 - .128 * standing];
  const pose = stand(hips, (options.wall ? .06 : .025) + .26 * standing);
  for (const [side, sign] of sides) {
    const free = options.single && active === sign ? balance : 0;
    const spread = options.squat ? .165 : .118;
    leg(pose, side, [sign * (spread + .086 * free), ankleY + .248 * free, ankleZ - .127 * free],
      [sign * .061, -.016, .95], [sign * .009, toeY - ankleY - .052 * free, toeZ - ankleZ + .032 * free]);
    const hand = options.wall ? [sign * .208, 1.348, .513]
      : options.single ? add(pose[side + "s"], [sign * .027, -.426, .105])
      : add(pose[side + "s"], [sign * .044, -.582 + .12 * standing, .063 + .310 * standing]);
    if (options.step) grip(pose, side, [sign * .415, 1.362, .467], [sign * .68, -.50, -.32], [0, 0, 1]);
    else arm(pose, side, hand, [sign * .62, -.34, -.68], options.wall ? [0, 1, .024] : [0, -.018, .999]);
  }
  return pose;
}

export function calfStretch(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, .30, .69);
  const step = rep(progress, .24, .78);
  const hips = [active * .041 * r, .870 - .053 * r, -.208 + .154 * r];
  const pose = stand(hips, .168 + options.angle * r);
  for (const [side, sign] of sides) {
    const moving = sign === active;
    const footZ = -.263 + (moving ? -.472 : .255) * step;
    const transfer = .062 * Math.sin(Math.PI * step);
    leg(pose, side, [sign * .136, .092 + transfer, footZ], [sign * .053, -.025, .96],
      [sign * .011, -.071, .131], transfer < .003 ? 0 : undefined);
    arm(pose, side, [sign * .222, 1.248 + options.handY, .513], [sign * .63, -.41, -.53], [0, 1, .02]);
  }
  return pose;
}

export function singleSquat(phase, pistol) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, .40, .58);
  const lift = rep(progress, .205, .77);
  const d = (pistol ? .585 : .392) * r;
  const hips = [-active * .102 * lift, .882 - d, -.04 - .295 * r];
  const pose = stand(hips, .036 + .59 * r);
  for (const [side, sign] of sides) {
    if (sign === active) {
      const extension = (pistol ? .577 : .428) * lift;
      const angle = -1.5708 + extension + (pistol ? .964 : .462) * r;
      const foot = add(pose[side + "h"], [sign * .028, .840 * Math.sin(angle), .840 * Math.cos(angle)]);
      const target = blend([sign * .100, .087, .065], foot, lift);
      leg(pose, side, target, [sign * .031, .115, .96], [sign * .017, -.070, .133], lift < .002 ? 0 : undefined);
    } else {
      leg(pose, side, [sign * .100, .087, .065], [sign * .11, -.03, .96], [sign * .017, -.070, .133], 0);
    }
    const shoulder = pose[side + "s"];
    arm(pose, side, add(shoulder, [sign * .033, -.40 + .335 * lift, .13 + .415 * lift]), [sign * .29, -.87, -.24]);
  }
  return pose;
}

export function supportedSquat(phase, oneArm) {
  const { active, progress } = halfCycle(phase);
  const r = rep(oneArm ? progress : phase, .39, .62);
  const hips = oneArm ? [0, .890, -.236 + .084 * r] : [0, .889 - .443 * r, -.194 - .141 * r];
  const pose = stand(hips, oneArm ? .195 + .141 * r : .237 + .37 * r, oneArm ? .047 * active * r : 0);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * (oneArm ? .127 : .201), .089, -.263], [sign * .13, -.023, .95], [sign * .022, -.071, .132], 0);
    const shoulder = pose[side + "s"];
    const palm = [sign * .219, oneArm ? 1.274 : 1.193 - .259 * r, .513];
    const goal = oneArm ? blend(add(shoulder, [sign * .039, -.587, .031]), palm, sign === active ? r : 0) : palm;
    arm(pose, side, goal, [sign * .65, -.64, -.48], [0, 1, .025]);
  }
  return pose;
}

export function backToWall(pose) {
  for (const [key, value] of Object.entries(pose)) {
    if (Array.isArray(value) && value.length === 3) pose[key] = [-value[0], value[1], -value[2]];
  }
  return pose;
}

export function wallMarch(phase) {
  const sit = ramp(phase, 0, .22) * (1 - ramp(phase, .78, 1));
  const march = Math.max(0, Math.min(1, (phase - .24) / .52));
  const { active, progress } = halfCycle(march);
  const lift = rep(progress, .39, .56);
  const hips = [0, .894 - .365 * sit, -.42];
  const pose = torso(hips, .012);
  for (const [side, sign] of sides) {
    const drive = sign === active ? lift * sit : 0;
    leg(pose, side, [sign * .13, .087 + .277 * drive, -.288 + .292 * sit - .119 * drive],
      [sign * .049, -.01, .98], [sign * .012, -.071, .124], drive < .001 ? 0 : undefined);
    arm(pose, side, [sign * .191, hips[1] - .016, hips[2] + .119], [sign * .68, -.078, -.68]);
  }
  return backToWall(pose);
}

export function pelvisRock(phase) {
  const tilt = Math.sin(phase * Math.PI * 2);
  const hips = [0, .884 + .013 * tilt, .058 * tilt];
  const pose = torso(hips, -.092 * tilt);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .139, .088, .064], [sign * .072, -.02, .96], [sign * .011, -.071, .128], 0);
    arm(pose, side, [sign * .156, hips[1] + .075, hips[2] + .085], [sign * .71, -.114, -.64]);
  }
  return pose;
}

export function toeTouch(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.clasp ? phase : progress;
  const r = rep(t, .40, .59);
  const step = rep(t, .32, .67);
  const hips = [0, .890 - (options.side ? .033 : .084) * r, options.ham ? .186 * step : -.078 * r];
  const pose = stand(hips, options.side ? .154 * r : options.ham ? .99 * r : 1.174 * r,
    options.single ? -active * .268 * r : options.clasp ? .136 * Math.sin(t * Math.PI * 2) : 0,
    options.side ? active * .825 * r : 0);
  for (const [side, sign] of sides) {
    const support = options.single && sign === active;
    const foot = options.ham ? [sign * .127, .086, (sign === active ? .455 : -.225) * step] :
      [sign * (options.side ? .230 : .142), .086 + (support ? .407 * r : 0), support ? -.615 * r : 0];
    leg(pose, side, foot, [sign * .099, -.059, .95], [sign * .013, -.075, .138], !support ? 0 : undefined);
    const shoulder = pose[side + "s"];
    const starting = options.ham ? add(shoulder, [sign * .042, -.573, .083])
      : options.clasp ? [sign * .061, 1.209, .214] : add(shoulder, [sign * .550, -.062, .052]);
    const toward = options.ham ? [active * .129 + sign * .070, .165, .54]
      : options.clasp ? [sign * .053 + .265 * Math.sin(t * 2 * Math.PI) * r, .196, .247]
      : options.side ? [active * .367, .250, .100] : [active * .173, .147, .142];
    const activeHand = options.side ? sign === active : !options.single || sign !== active;
    let goal = activeHand ? blend(starting, toward, r) : starting;
    if (!activeHand && !options.clasp) {
      goal = blend(starting, add(shoulder, [sign * .519, .264 * r, -.146]), r);
    }
    arm(pose, side, goal, [sign * .74, -.16, -.61]);
  }
  return pose;
}

export function runStride(phase, options) {
  const cycle = phase * (options.steps ?? 1);
  const angle = cycle * 2 * Math.PI;
  const forward = options.follow ? (phase - .5) * options.stride * 2 : 0;
  const hips = [.029 * Math.sin(angle), .890 + options.bounce * Math.cos(2 * angle), forward];
  const pose = stand(hips, .086 + options.forward, .061 * Math.sin(angle), .039 * Math.sin(angle));
  for (const [side, sign] of sides) {
    const t = (cycle + (sign === -1 ? .5 : 0)) % 1;
    const support = options.support ?? .48;
    const swing = Math.max(0, (t - support) / (1 - support));
    const motion = t <= support ? .5 - t / support : -.5 + smooth(swing);
    const prop = rep(swing, .42, .65);
    const ankleY = .088 + options.lift * prop;
    leg(pose, side, [sign * .116, ankleY, forward + options.stride * motion], [sign * .059, -.084, .94],
      [sign * .015, -.071 - .036 * prop, .133], !prop ? 0 : undefined);
    const hand = add(pose[side + "s"], [sign * .044, -.401 + .125 * motion, -.325 * motion + .058]);
    arm(pose, side, hand, [sign * .14, -.67, -.72]);
  }
  pose.followZ = forward;
  return pose;
}

export function horizontalHop(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = progress;
  const pre = rep(t, .17, .27) * (1 - ramp(t, .25, .43));
  const ground = ramp(t, .25, .72);
  const landing = rep(t, .74, .85) * ramp(t, .58, .74);
  const lift = Math.sin(Math.PI * ground);
  const x = active * options.width * (1 - 2 * ground);
  const hips = [x, .827 - .108 * pre - .136 * landing + options.height * lift, -.068 - .083 * landing];
  const pose = stand(hips, .22 + .2 * landing, active * .110 * (1 - 2 * ground), .085 * active * (1 - 2 * ground));
  for (const [side, sign] of sides) {
    const trailing = sign === active ? ground : 1 - ground;
    const xOffset = sign * (.137 - .311 * trailing);
    const ankle = [x + xOffset, .083 + options.height * lift + .086 * trailing * (options.touch ? lift : 1),
      -.10 - (options.touch ? .292 : .223) * trailing];
    leg(pose, side, ankle, [sign * .088, .017, .94], [sign * .012, -.067, .126], lift < .002 && (options.touch || trailing < .02) ? 0 : undefined);
    const s = pose[side + "s"];
    arm(pose, side, add(s, [-sign * .255 * trailing, -.506 + .266 * trailing, .348 * trailing]), [sign * .69, -.22, -.56]);
  }
  return pose;
}

export function jumpLunge(phase) {
  const a = phase * Math.PI * 2;
  const lift = Math.abs(Math.sin(a));
  const split = .368 * Math.cos(a);
  const hips = [.03 * Math.sin(a), .535 + .376 * lift, -.02];
  const pose = stand(hips, .091 + .087 * (1 - lift));
  for (const [side, sign] of sides) {
    const rear = Math.max(0, -sign * split) * .307;
    leg(pose, side, [sign * .14, .085 + .264 * lift + rear, sign * split], [sign * .064, -.03, .94],
      [sign * .013, -.072 - rear, .134], lift < .003 ? 0 : undefined);
    const s = pose[side + "s"];
    arm(pose, side, add(s, [sign * .041, -.562 + .161 * lift, -sign * .255 * Math.cos(a)]), [sign * .47, -.220, -.81]);
  }
  return pose;
}

export function monsterWalk(phase) {
  const stride = .274;
  const swing = Math.sin(2 * Math.PI * phase);
  const z = (phase - .5) * stride;
  const hips = [.072 * swing, .641 + .019 * Math.cos(phase * 4 * Math.PI), z - .102];
  const pose = stand(hips, .298);
  for (const [side, sign] of sides) {
    const step = phase + (sign < 0 ? .5 : 0);
    const progress = step % 1;
    const active = Math.max(0, (progress - .58) / .42);
    const activeLift = Math.sin(active * Math.PI);
    const contactZ = (Math.floor(step) - (sign < 0 ? .5 : 0) - .5) * stride + .219 + stride * smooth(active);
    leg(pose, side, [sign * (.235 + .095 * activeLift), .087 + .101 * activeLift, contactZ],
      [sign * .21, -.05, .89], [sign * .027, -.072, .134], activeLift < .003 ? 0 : undefined);
    arm(pose, side, [hips[0] - sign * .056, hips[1] + .344, hips[2] + .493], [sign * .62, -.57, -.38]);
  }
  pose.followZ = z;
  return pose;
}

export function sissySquat(phase) {
  const r = rep(phase, .41, .56);
  const pose = stand([0, .889 - .302 * r, .025 - .13 * r], -.051 - .638 * r);
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .134, .082 + .141 * r, .027 + .063 * r], [sign * .085, -.068, .95],
      [sign * .015, -.071 - .125 * r, .13 - .071 * r], 0);
    const shoulder = pose[side + "s"];
    arm(pose, side, add(shoulder, [sign * .045, -.401 + .22 * r, .13 + .361 * r]), [sign * .44, -.145, -.84]);
  }
  return pose;
}

export function boxDrop(phase) {
  const { active, progress } = halfCycle(phase);
  const t = progress;
  const takeStep = ramp(t, .06, .30);
  const land = ramp(t, .22, .431);
  const comeBack = ramp(t, .73, .985);
  const stay = land * (1 - comeBack);
  const flex = rep(t, .40, .54) * ramp(t, .32, .40);
  const hips = [-active * .061 * stay, 1.175 - .301 * stay - .171 * flex, .496 + .620 * stay];
  const pose = stand(hips, .05 + .31 * flex);
  for (const [side, sign] of sides) {
    const landingSide = sign === active;
    const travel = landingSide ? takeStep : land;
    const fore = travel * (1 - comeBack);
    const kneeUp = landingSide ? 0 : .233 * stay;
    const height = .31 * (1 - land + comeBack * land) + kneeUp + .058 * Math.sin(takeStep * Math.PI);
    const z = .505 + fore * (landingSide ? .610 : .425) + .030 * Math.sin(takeStep * Math.PI);
    leg(pose, side, [sign * .121, height + .083, z], [sign * .101, -.10, .94], [sign * .01, -.072, .131],
      t <= .06 || t > .986 ? .31 : landingSide && land > .998 && comeBack < .001 ? 0 : undefined);
    arm(pose, side, add(pose[side + "s"], [sign * (.041 + .134 * stay), -.58 + .31 * flex, .069 + .19 * flex]), [sign * .60, -.29, -.64]);
  }
  return pose;
}

export function slider(phase) {
  const d = rep(phase, .40, .62);
  const hips = [-.063 * d, .883 - .217 * d, -.057 - .14 * d];
  const pose = torso(hips, .042 + .43 * d);
  for (const [side, sign] of sides) {
    const foot = [sign * .132, .083 + (sign > 0 ? .027 : 0), .085 - (sign > 0 ? .533 * d : 0)];
    leg(pose, side, foot, [sign * .078, -.057, .96], [sign * .017, -.071, .137], sign > 0 ? .029 : 0);
    arm(pose, side, add(pose[side + "s"], [sign * .063, -.553 + .291 * d, .074 + .275 * d]),
      [sign * .37, -.19, -.875]);
  }
  return pose;
}

export function boardStand(phase) {
  const { active, progress } = halfCycle(phase);
  const d = rep(progress, .28, .76);
  const tilt = active * (.137 * d + .045 * Math.sin(progress * 8 * Math.PI) * d);
  const hips = [-active * .072 * d, .999 - .028 * d, .017];
  const pose = stand(hips, .039, 0, -tilt * .42);
  pose.machineTravel = .25 + tilt;
  for (const [side, sign] of sides) {
    const lift = sign === active ? d : 0;
    const ankle = [sign * .117, .230 + sign * .115 * Math.sin(tilt) + .236 * lift, .006 - .233 * lift];
    leg(pose, side, ankle, [sign * .064, -.06, .94], [sign * .019, -.088, .109], lift < .002 ? .138 : undefined);
    arm(pose, side, add(pose[side + "s"], [sign * (.309 + .264 * d), -.408 + .289 * d, .082]),
      [sign * .39, -.54, -.72]);
  }
  return pose;
}
