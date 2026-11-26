import {
  sides, add, subtract, scale, unit, mix, blend, smooth,
  ramp, rep, halfCycle, torso, arm, grip, leg, legAngles, stand,
} from "./pose.mjs";

// Floor, kneeling, and inverted motions with authored contact points.
export function pushUp(phase, options) {
  const { active, progress } = halfCycle(phase);
  const alternating = options.tap || options.archer || options.single;
  const t = alternating ? progress : phase;
  const tap = options.tap ? rep(t, .69, .76) * ramp(t, .48, .69) : 0;
  const plyo = options.jump ? rep(t, .65, .69) * ramp(t, .48, .62) : 0;
  const descend = options.tapOnly ? 0 : options.hold ? .58 * rep(t, .16, .83)
    : rep(t, options.jump || options.tap ? .30 : .45,
      options.jump ? .37 : options.tap ? .32 : .55) * (options.tap || options.jump ? 1 - ramp(t, .34, .48) : 1);
  const singleArm = options.single ? ramp(t, .015, .16) * (1 - ramp(t, .82, .995)) : 0;
  const scapula = options.scapula ? rep(t) : 0;
  const protract = options.plus ? Math.max(0, rep(t, .82, .87) * ramp(t, .61, .79)) : 0;
  const landing = options.jump ? .16 * ramp(t, .71, .84) * (1 - ramp(t, .84, .99)) : 0;
  const d = options.scapula ? .055 * scapula : descend + landing;
  const kneeling = options.knees === true;
  const incline = options.incline ?? 0;
  const decline = options.decline ?? 0;
  const x = options.offset ?? 0;
  const handZ = options.z ?? (decline ? 1.86 : .44);
  const footZ = decline ? options.footZ ?? .590 : handZ - (incline > .40 ? .98 : incline ? 1.10 : 1.25);
  const pivotZ = kneeling ? handZ - (incline ? .378 : .778) : footZ;
  const pivotY = kneeling ? decline + .112 : decline + .095;
  const length = kneeling ? .42 : .841;
  const shoulderY = incline + .665 - (options.shallow ? .19 : .403) * d + .092 * plyo;
  const angle = Math.acos((shoulderY - pivotY) / (length + .502));
  const hips = [x + (options.single ? active * .087 * singleArm : options.archer ? active * .235 * descend : active * .055 * tap),
    pivotY + length * Math.cos(angle), pivotZ + length * Math.sin(angle)];
  const trunkAngle = angle + .011 - .052 * protract;
  const pose = torso(hips, trunkAngle, (options.single ? active * .115 * singleArm : active * .09 * tap));
  pose.headDrop = -.021;
  if (options.scapula || options.plus) {
    const change = .030 * protract - .031 * scapula;
    for (const key of ["chest", "head", "neck"]) pose[key][1] += change;
    pose.ls[0] -= .019 * scapula;
    pose.rs[0] += .019 * scapula;
  }
  for (const [side, sign] of sides) {
    const width = options.width ?? .238;
    const planted = [x + sign * width, incline + .047, handZ];
    const chestTap = options.tap === "chest";
    const touch = add(chestTap ? pose.chest : pose[active > 0 ? "rs" : "ls"],
      [chestTap ? sign * .065 : 0, -.034, .064]);
    const flight = [x + sign * (options.jump === "clap" ? .021 : width), .122, handZ + .040];
    const liftedArm = [x + sign * .55, pose.neck[1] + .050, pose.chest[2] - .12];
    const hand = sign === active && options.single ? blend(planted, liftedArm, singleArm)
      : sign === active && options.tap ? blend(planted, touch, tap)
      : blend(planted, flight, plyo);
    let fingers = options.reverse ? [0, -.022, -1] : options.diamond ? [-sign * .77, -.022, .56] : [0, -.022, 1];
    if (options.jump === "clap") fingers = blend(fingers, [0, 1, .12], plyo);
    arm(pose, side, hand, [sign * (options.archer ? .85 : options.width < .15 ? .27 : .61), .21, -.78], fingers);
    const footX = x + sign * (options.single || options.tap || options.archer ? .237 : .115);
    if (kneeling) {
      pose[side + "k"] = [footX, pivotY, pivotZ];
      pose[side + "a"] = [footX, pivotY + .149, pivotZ - .397];
      pose[side + "t"] = [footX, pivotY + .091, pivotZ - .508];
    } else {
      leg(pose, side, [footX, pivotY, footZ], [sign * .08, -.87, .235], [sign * .009, -.069, .103], decline);
    }
  }
  return pose;
}

export function wallPushUp(phase, variant) {
  const v2 = variant === true;
  const d = rep(phase, v2 ? .36 : .48, v2 ? .69 : .55);
  const pose = torso([0, 1.002 - .028 * d, -.144 + .232 * d], .21 + .30 * d);
  const width = variant === "wide" ? .346 : .222;
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * width, 1.245, .513], [sign * .74, -.18, -.77], [0, 1, .03]);
    leg(pose, side, [sign * .12, .096, -.348], [sign * .08, -.02, .81], [sign * .01, -.072, .131], 0);
  }
  return pose;
}

export function sidePushUp(phase) {
  const d = rep(phase);
  const hips = [0, .268 - .097 * d, -.14];
  const pose = torso(hips, 1.18 + .24 * d, 1.52);
  pose.headDrop = -.025;
  grip(pose, "l", [.245, .061, .405], [.77, .38, -.31], [0, 0, 1]);
  arm(pose, "r", [-.125, .838, .305], [-.41, .23, -.66], [0, 1, 0]);
  for (const [side, sign] of sides) {
    const heel = [-.036, .105 + .122 * (sign < 0), -.963 + .023 * sign];
    leg(pose, side, heel, [-.87, -.24, .07], [-.055, -.049, .100], sign > 0 ? 0 : undefined);
  }
  return pose;
}

export function plankVariant(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.hold || options.saw ? phase : progress;
  const r = rep(t, options.oneArm ? .22 : .39, options.oneArm ? .78 : .61);
  const knees = options.knees === true;
  const width = options.wide ? .232 : .122;
  const forward = options.saw ? .145 * r : 0;
  const brace = options.hold ? rep(t, .22, .78) : 1;
  const spring = options.jack ? .094 * Math.sin(Math.PI * r) : 0;
  const pivotZ = (knees ? -.398 : -.806) + forward;
  const pivotY = knees ? .109 : .095;
  const bodyLength = knees ? .421 : .837;
  const height = (options.forearm ? .337 : .657) - .023 * (1 - brace) + .27 * spring;
  const angle = Math.acos((height - pivotY) / (bodyLength + .502));
  const hips = [(options.oneArm ? -.064 * active * r : 0), pivotY + bodyLength * Math.cos(angle), pivotZ + bodyLength * Math.sin(angle)];
  const pose = torso(hips, angle);
  pose.headDrop = -.031;
  for (const [side, sign] of sides) {
    const current = active === sign ? r : 0;
    const liftLeg = options.legs === "opposite" ? active !== sign ? r : 0 : options.legs === "lift" ? current : 0;
    const tap = options.toeTap ? current : 0;
    const swing = .065 * Math.sin(Math.PI * tap);
    const x = sign * (width + .324 * tap + (options.jack ? .244 * r : 0));
    if (knees) {
      pose[side + "k"] = [x, pivotY, pivotZ];
      pose[side + "a"] = [x, pivotY + .155, pivotZ - .392];
      pose[side + "t"] = [x, pivotY + .110, pivotZ - .522];
    } else {
      const footAngle = .52 + 2.16 * liftLeg;
      leg(pose, side, [x, pivotY + .220 * liftLeg + spring + swing, pivotZ - .066 * liftLeg],
        [sign * .07, -.82, .37], [sign * .013, -.117 * Math.sin(footAngle), .137 * Math.cos(footAngle)],
        liftLeg + spring + swing < .002 ? 0 : undefined);
    }
    const shoulder = pose[side + "s"];
    const floorHand = [sign * .197, .052, options.forearm ? .798 : .441];
    if (options.forearm && !(options.arms && current > .003)) {
      pose[side + "e"] = [sign * .195, .085, .444];
      pose[side + "w"] = floorHand;
      pose[side + "Fingers"] = [0, -.020, 1];
      continue;
    }
    const raised = options.arms === "shoulder" ? add(pose[active > 0 ? "rs" : "ls"], [0, -.025, .068])
      : options.arms === "hip" ? add(pose[active > 0 ? "rh" : "lh"], [0, .058, .085])
      : options.oneArm ? add(hips, [sign * .121, .125, -.024])
      : add(shoulder, [sign * .037, .035, .594]);
    const hand = options.arms || options.oneArm ? blend(floorHand, raised, current) : floorHand;
    const fingers = options.arms === "hip" || options.oneArm ? [0, -.032, 1] : [0, -.022, 1];
    arm(pose, side, hand, [sign * .177, -.902, -.281], fingers);
  }
  return pose;
}

export function crunch(phase, options) {
  const t = options.alternate ? halfCycle(phase).progress : phase;
  const active = options.alternate ? halfCycle(phase).active : 1;
  const r = rep(t, options.negative ? .29 : options.hold ? .26 : .45,
    options.negative ? .38 : options.hold ? .76 : .55);
  const y = options.bench ? .597 : .164;
  const z = options.bench ? .83 : -.15;
  const offset = options.bench ? .10 : 0;
  const tuck = options.tuck ? r : 0;
  const reverse = options.reverse ? r : 0;
  const turn = (options.turn ?? 0) * r * active;
  const base = options.base ?? -Math.PI / 2;
  const angle = base + (options.rise ?? .38) * r - .09 * reverse;
  const hips = [offset, y + .125 * reverse, z - .064 * reverse];
  const pose = torso(hips, angle, turn);
  pose.headDrop = options.bench || base < -1.54 ? .031 : .010;
  if (reverse > 0 || options.reverse) {
    pose.neck = [offset, y + .026, z - .602];
    pose.head = [offset, y + .027, z - .715];
    pose.ls = [offset + .195, y + .034, z - .489];
    pose.rs = [offset - .195, y + .034, z - .489];
  }
  for (const [side, sign] of sides) {
    const straight = options.legs === "straight" || options.legs === "mixed" && sign < 0;
    if (options.kick) {
      const lift = (.5 + .5 * Math.sin(2 * Math.PI * phase) * sign) * .35;
      legAngles(pose, side, sign, -.035 + lift, -.042 + lift);
    } else if (options.straightTuck) {
      legAngles(pose, side, sign, .13 + 1.44 * r, .12 - .49 * r);
    } else if (straight || options.raise) {
      const lift = (options.raise ?? 0) * r;
      const base = options.liftBase ?? 0;
      legAngles(pose, side, sign, base + .038 + lift, base + .016 + lift);
    } else if (options.tuck || options.reverse) {
      const start = options.tabletop ? 1.39 : .84;
      legAngles(pose, side, sign, start + .73 * tuck + .56 * reverse, -.42 + .24 * tuck + .21 * reverse);
    } else {
      const surface = options.bench ? .46 : .024;
      const goal = [offset + sign * (options.frog ? .056 : .134), surface + .088, z + (options.frog ? .44 : .565)];
      leg(pose, side, goal, [sign * (options.frog ? .96 : .04), .79, .063],
        [sign * (options.frog ? -.089 : .017), -.064, .123], surface);
    }
  }
  for (const [side, sign] of sides) {
    const head = pose.head;
    const chest = pose.chest;
    let target;
    let pole = [sign * .85, .22, -.21];
    if (options.arms === "chest") target = [offset - sign * .115, chest[1] + .151, chest[2] + .10];
    else if (options.arms === "overhead") {
      target = [offset + sign * .119, head[1] + .12 * r, head[2] - .366 + .13 * r];
      pole = [sign * .51, .225, .040];
    } else if (options.arms === "reach") {
      target = [offset + sign * .155, chest[1] + .035, chest[2] + .58];
      pole = [sign * .34, .04, -.83];
    } else if (options.arms === "toes") {
      target = add(pose[side + "a"], [sign * .038, -.045, -.023]);
      pole = [sign * .38, .17, -.81];
    } else if (options.arms === "jackknife") {
      target = blend([offset + sign * .147, y + .018, head[2] - .355],
        add(pose[side + "a"], [sign * .032, .005, -.014]), r);
    } else if (options.arms === "knee") {
      target = sign === active ? blend([offset + sign * .252, chest[1] + .164, chest[2] + .360],
        add(pose[active > 0 ? "rk" : "lk"], [0, .016, .036]), r)
        : [offset + sign * .132, head[1] + .045, head[2] + .012];
    } else if (options.arms === "floor") {
      target = [offset + sign * .195, options.bench ? .48 : .072, z + .10];
      pole = [sign * .58, .02, -.79];
    } else if (options.arms === "bench") {
      grip(pose, side, [offset + sign * .204, .463, 1.38], [sign * .85, .19, -.23], [0, 0, sign]);
      continue;
    } else {
      const prisoner = options.arms === "prisoner";
      target = [head[0] + sign * (prisoner ? .071 : .125), head[1] + (prisoner ? -.055 : .005), head[2] - .052];
      pole = [sign * (prisoner ? 1.17 : .72), .26, -.34];
    }
    arm(pose, side, target, pole);
  }
  return pose;
}

export function supineLegRaise(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.twist || options.alternate ? progress : phase;
  const lift = options.lowHold ? ramp(t, .19, .43) * (1 - ramp(t, .55, .78))
    : rep(t, options.hipCurl ? .34 : .43, options.hipCurl ? .66 : .57);
  const hipCurl = options.hipCurl ? options.hipCurl * rep(t, .51, .56) * ramp(t, .33, .47) * (1 - ramp(t, .60, .70))
    : options.twist ? .153 * lift : 0;
  const lean = options.twist ? active * options.twist * lift : 0;
  const hips = [lean * .056, .153 + hipCurl, -.241 - .078 * hipCurl];
  const upperLift = options.head ?? 0;
  const pose = torso(hips, -Math.PI / 2 + upperLift - Math.atan2(hipCurl, .505));
  pose.headDrop = .038;
  const rotatePelvis = ([x, y, z]) => {
    const a = x - hips[0];
    const b = y - hips[1];
    return [hips[0] + a * Math.cos(lean) + b * Math.sin(lean), hips[1] - a * Math.sin(lean) + b * Math.cos(lean), z];
  };
  for (const [side, sign] of sides) {
    if (options.kneeSupport && sign < 0) {
      leg(pose, side, [-.131, .112, .362], [-.075, .93, .071], [-.015, -.068, .129], .024);
    } else {
      let drive = lift;
      if (options.scissor) drive = .5 + .5 * sign * Math.cos(Math.PI * 2 * phase);
      else if (options.flutters) drive = .5 + .5 * sign * Math.cos(Math.PI * 2 * phase * options.flutters);
      else if (options.alternate && active !== sign || options.single && sign < 0) drive = 0;
      const resting = options.bent ? .575 : options.base ?? -.025;
      const thigh = resting + (options.range ?? 1.56) * drive;
      const bend = options.bent ? 1.235 - .133 * drive : options.slight ? .196 : options.flutters ? .054 : .014;
      legAngles(pose, side, sign, thigh, thigh - bend);
      if (options.twist) {
        for (const joint of ["h", "k", "a", "t"]) pose[side + joint] = rotatePelvis(pose[side + joint]);
      }
      if (options.single && sign < 0) pose.planted[side] = .024;
    }
    const wrist = options.underHips ? [sign * .066, .079, -.294] : [sign * .204, .076, -.257];
    arm(pose, side, wrist, [sign * .68, -.28, -.63], [0, -.033, 1]);
  }
  return pose;
}

export function bicycleCrunch(phase, options) {
  const wheel = Math.cos(Math.PI * 2 * phase);
  const hips = [0, .157, -.232];
  const rise = options.rise * (.77 + .23 * Math.abs(wheel));
  const pose = torso(hips, -Math.PI / 2 + rise, -.60 * wheel);
  pose.headDrop = .021;
  for (const [side, sign] of sides) {
    const bent = .5 + .5 * sign * wheel;
    const thigh = options.start + 1.79 * bent;
    const shin = options.start - .008 - .46 * bent;
    legAngles(pose, side, sign, thigh, shin, sign === 1 ? .018 : .033);
    const hand = add(pose.head, [sign * .108, .032, -.047]);
    arm(pose, side, hand, [sign * (.63 + .17 * bent), -.155, -.68]);
  }
  return pose;
}

export function bridge(phase, options) {
  const t = options.tiltFirst ? ramp(phase, .13, .30) * (1 - ramp(phase, .68, .92)) : 1;
  const r = options.hold ? rep(phase, .22, .77) : rep(phase, options.tiltFirst ? .43 : .48, .57);
  const height = options.height * t * r;
  const hips = [0, .163 + height, -.13 - .033 * r];
  const pose = torso(hips, -Math.PI / 2 - Math.atan2(height, .498) - (options.tiltOnly ? .09 * r : 0));
  pose.neck = [0, .180, -.736];
  pose.head = [0, .179, -.846];
  pose.headDrop = .035;
  pose.ls = [.195, .181, -.632];
  pose.rs = [-.195, .181, -.632];
  for (const [side, sign] of sides) {
    if (options.single && sign > 0) legAngles(pose, side, sign, .31 + .10 * r, .25 + .10 * r);
    else leg(pose, side, [sign * .131, .116, .394], [sign * .07, .9, .08], [sign * .017, -.072, .120], .024);
    arm(pose, side, [sign * .206, .073, -.195], [sign * .62, -.03, -.77]);
  }
  return pose;
}

export function singleLegBridge(phase, options) {
  const { active, progress } = halfCycle(phase);
  const sideInUse = options.left ? 1 : active;
  const t = options.left ? phase : progress;
  const liftLeg = rep(t, .19, .82);
  const press = ramp(t, .22, options.hold ? .34 : .44) * (1 - ramp(t, options.hold ? .68 : .55, .78));
  const rise = options.height * press;
  const floor = .024;
  const hips = [0, .164 + rise, -.13 - .027 * press];
  const pose = torso(hips, -Math.PI / 2 - Math.atan2(rise, .50));
  pose.neck = [0, .180, -.736];
  pose.head = [0, .179, -.846];
  pose.headDrop = .035;
  pose.ls = [.195, .181, -.632];
  pose.rs = [-.195, .181, -.632];
  for (const [side, sign] of sides) {
    const grounded = [sign * .131, .116, .394];
    const groundedToe = [sign * .017, -.072, .120];
    const free = sign === sideInUse && liftLeg > .001;
    if (free) {
      const thigh = options.bent ? 2.09 : options.reach ? .34 + .44 * press : 1.13;
      legAngles(pose, side, sign, thigh, options.bent ? -.41 : thigh);
      const toe = subtract(pose[side + "t"], pose[side + "a"]);
      leg(pose, side, blend(grounded, pose[side + "a"], liftLeg), [sign * .061, .92, .134],
        blend(groundedToe, toe, liftLeg));
    } else {
      leg(pose, side, grounded, [sign * .072, .89, .087], groundedToe, floor);
    }
    const hand = options.crossArms ? [-sign * .159, .330 + sign * .019, -.546]
      : [sign * .206, .073, -.195];
    arm(pose, side, hand, [sign * .62, options.crossArms ? .34 : -.03, -.77]);
  }
  return pose;
}

export function straightLegBridge(phase) {
  const rise = .237 * rep(phase, .44, .57);
  const ankleY = .111;
  const offsetZ = -.196;
  const ankleZ = .708 + offsetZ;
  const hipY = .164 + rise;
  const hips = [0, hipY, ankleZ - Math.sqrt(.839 ** 2 - (hipY - ankleY) ** 2)];
  const pose = torso(hips, -Math.PI / 2 - Math.atan2(rise, .56));
  pose.neck = [0, .180, -.737 + offsetZ];
  pose.head = [0, .179, -.847 + offsetZ];
  pose.headDrop = .035;
  pose.ls = [.195, .181, -.632 + offsetZ];
  pose.rs = [-.195, .181, -.632 + offsetZ];
  for (const [side, sign] of sides) {
    leg(pose, side, [sign * .129, ankleY, ankleZ], [sign * .07, .88, .04], [sign * .015, .019, .128], .024);
    arm(pose, side, [sign * .209, .073, -.196 + offsetZ], [sign * .62, -.03, -.77]);
  }
  return pose;
}

export function reverseBridge(phase) {
  const lift = rep(phase, .43, .58);
  const pose = torso([.10, .357 + .374 * lift, .13 + .025 * lift], 1.02 + .52 * lift, Math.PI);
  pose.lh[0] = -.003;
  pose.rh[0] = .203;
  for (const [side, sign] of sides) {
    arm(pose, side, [.10 - sign * .154, .510, .846], [-sign * .67, -.14, .43], [0, -.01, -.99]);
    leg(pose, side, [.10 - sign * .139, .10, -.425], [-sign * .08, .87, -.14], [-sign * .012, -.070, -.136], 0);
  }
  return pose;
}

export function crabWalk(phase) {
  const step = Math.min(3, Math.floor(phase * 4));
  const t = phase * 4 - step;
  const active = step % 2 === 0 ? 1 : -1;
  const stride = .274;
  const positions = [
    [0, 0], [-stride, 0], [-stride, -stride], [0, -stride],
  ];
  const starts = positions[step];
  const goals = positions[(step + 1) % positions.length];
  const progress = smooth(t);
  const lift = Math.sin(t * Math.PI);
  const travel = (mix(starts[0], goals[0], progress) + mix(starts[1], goals[1], progress)) / 2;
  const pose = torso([active * .030 * lift, .445 + .032 * lift, travel], 1.13, Math.PI);
  pose.lh[0] = pose.hips[0] - .103;
  pose.rh[0] = pose.hips[0] + .103;
  pose.headDrop = -.016;
  for (const [side, sign] of sides) {
    const hand = sign > 0 ? 0 : 1;
    const foot = 1 - hand;
    const handHeight = sign === active ? .103 * lift : 0;
    const footHeight = sign !== active ? .091 * lift : 0;
    const palm = [-sign * .253, .050 + handHeight, .493 + mix(starts[hand], goals[hand], progress)];
    arm(pose, side, palm, [-sign * .49, .19, .83], [0, -.02, -1]);
    leg(pose, side, [-sign * .185, .095 + footHeight, -.454 + mix(starts[foot], goals[foot], progress)],
      [-sign * .099, .87, -.18], [-sign * .010, -.070, -.137], footHeight < .001 ? 0 : undefined);
  }
  pose.followZ = travel;
  return pose;
}

export function sideFloor(phase, options) {
  const r = rep(phase, .36, .64);
  const plank = options.plank;
  const lift = plank ? (options.abduction ? .246 : .093 + .153 * r) : 0;
  const hips = [0, .177 + lift, -.1];
  const pose = torso(hips, -1.447 - .088 * lift, 1.61);
  pose.lh = add(hips, [0, .103, 0]);
  pose.rh = add(hips, [0, -.103, 0]);
  pose.headDrop = .028;
  for (const [side, sign] of sides) {
    if (plank) {
      const hip = pose[side + "h"];
      const legAngle = options.abduction && sign > 0 ? -.24 + .54 * r : -.323 - (options.abduction ? 0 : .329 * lift);
      let goal = add(hip, [0, .829 * Math.sin(legAngle), .829 * Math.cos(legAngle)]);
      if (sign < 0) goal = [-.025, .099, .635];
      leg(pose, side, goal, [sign * .87, .19, .07], [sign * .015, -.059, .129], sign < 0 ? .024 : undefined);
    } else if (options.quad && sign > 0) {
      leg(pose, side, [.206 * r, .258, .704 - .715 * r], [.11, .16, 1], [-.025, -.021, .139]);
    } else {
      legAngles(pose, side, sign, (.62 * r) * (sign > 0), (.59 * r) * (sign > 0));
    }
  }
  for (const [side, sign] of sides) {
    if (plank && sign < 0) {
      pose.re = [pose.rs[0] - .049 + (options.abduction ? 0 : .185 * (1 - r)), .076, pose.rs[2] + .046];
      pose.rw = [.378, .068, pose.re[2] + .054];
      pose.rFingers = [1, -.023, .03];
      pose.rPalmSide = [0, 0, -1];
    } else {
      const hand = sign < 0 ? add(pose.head, [.115, -.057, .082])
        : options.quad ? blend([-.236, .122, -.089], pose.la, r)
        : options.plank ? add(pose.hips, [-.137, .238, .075]) : [-.277, .096, -.336];
      arm(pose, side, hand, [sign * .61, -.12, -.72]);
    }
  }
  return pose;
}

export function lateralSupport(phase, options) {
  const f = options.left ? 1 : -1;
  const lower = f > 0 ? "l" : "r";
  const upper = f > 0 ? "r" : "l";
  const bent = options.knees || options.clam;
  const r = rep(phase, options.hold ? .21 : .43, options.hold ? .79 : .56);
  const brace = options.setup ? 1 - r : 0;
  const hipY = options.lie ? .198 : (bent ? .346 : options.hand ? .527 : .383) - .113 * brace;
  const deckY = bent ? .109 : .100;
  const deckZ = bent ? .242 : .545;
  const legLength = bent ? .418 : .837;
  const hipToDeckY = hipY - .101 - deckY;
  const hipZ = deckZ - Math.sqrt(legLength ** 2 - hipToDeckY ** 2);
  const hips = [0, hipY, hipZ];
  const midShoulderY = options.lie ? .264 : options.hand ? .816 : .518;
  const pose = torso(hips, -Math.acos((midShoulderY - hipY) / .502), -f * Math.PI / 2);
  pose[lower + "h"] = [0, hipY - .102, hipZ + .030];
  pose[upper + "h"] = [0, hipY + .102, hipZ - .029];
  pose.headDrop = .021;
  const toes = [f * .128, -.036, .021];
  if (bent) {
    const foldedToes = [f * .037, -.039, .127];
    pose[lower + "k"] = [f * .021, deckY, deckZ];
    pose[lower + "a"] = [-f * .394, .104, deckZ + .105];
    pose[lower + "t"] = add(pose[lower + "a"], foldedToes);
    pose.planted[lower] = .024;
    if (options.clam) {
      const upperHip = pose[upper + "h"];
      const knee = blend([f * .031, .253, deckZ - .035], [f * .125, .546, deckZ - .084], r);
      leg(pose, upper, [-f * .394, .161, deckZ + .101], subtract(knee, upperHip), foldedToes);
    } else {
      pose[upper + "k"] = [f * .023, deckY + .171, deckZ - .021];
      pose[upper + "a"] = [-f * .392, .197, deckZ + .102];
      pose[upper + "t"] = add(pose[upper + "a"], foldedToes);
    }
  } else {
    leg(pose, lower, [0, deckY, deckZ], [f * .89, -.12, .042], toes, .024);
    const startAngle = Math.atan2(deckY + .108 - pose[upper + "h"][1], deckZ - pose[upper + "h"][2]);
    const lift = options.lift ? r * options.lift : 0;
    if (options.bend) {
      const kneeAngle = startAngle + lift + .49 * r;
      const ankleAngle = kneeAngle - 1.28 * r;
      pose[upper + "k"] = add(pose[upper + "h"], [f * .072 * r, .412 * Math.sin(kneeAngle), .412 * Math.cos(kneeAngle)]);
      pose[upper + "a"] = add(pose[upper + "k"], [-f * .054 * r, .422 * Math.sin(ankleAngle), .422 * Math.cos(ankleAngle)]);
      pose[upper + "t"] = add(pose[upper + "a"], toes);
    } else {
      const angle = startAngle + lift;
      const backward = options.backward ? -.209 * r * f : 0;
      const length = Math.sqrt(.831 ** 2 - backward ** 2);
      leg(pose, upper, [backward, pose[upper + "h"][1] + length * Math.sin(angle),
        pose[upper + "h"][2] + length * Math.cos(angle)], [f * .88, .101, .03], toes);
    }
  }
  const shoulder = pose[lower + "s"];
  if (options.hand) {
    arm(pose, lower, [shoulder[0] + f * .043, .051, shoulder[2] + .007], [f * .86, -.169, -.42], [f, -.035, .009]);
  } else if (options.lie) {
    pose[lower + "e"] = add(shoulder, [f * .139, .008, -.197]);
    pose[lower + "w"] = add(pose[lower + "e"], [-f * .294, .024, -.215]);
    pose[lower + "Fingers"] = [-f, .017, -.16];
  } else {
    pose[lower + "e"] = [shoulder[0] + f * .015, .090, shoulder[2] + .016];
    pose[lower + "w"] = add(pose[lower + "e"], [f * .359, -.024, .061]);
    pose[lower + "Fingers"] = [f, -.032, .082];
  }
  const upperWrist = options.lie ? [f * .232, .075, hipZ - .215] : add(pose[upper + "h"], [f * .066, .074, -.089]);
  arm(pose, upper, upperWrist, [f * .72, .06, -.67]);
  return pose;
}

export function proneCurl(phase, swimmer) {
  const r = swimmer ? .82 + .091 * Math.sin(phase * 4 * Math.PI) : rep(phase, .37, .62);
  const hips = [0, .148, -.094];
  const pose = torso(hips, 1.62 - .367 * r);
  for (const [side, sign] of sides) {
    const flutter = swimmer ? .073 + .081 * sign * Math.sin(phase * 2 * Math.PI) : 0;
    const hip = pose[side + "h"];
    const legAngle = flutter - .062;
    pose[side + "k"] = add(hip, [sign * .011, .421 * Math.sin(legAngle), -.421 * Math.cos(legAngle)]);
    pose[side + "a"] = add(pose[side + "k"], [sign * .009, .423 * Math.sin(legAngle + .046), -.423 * Math.cos(legAngle + .046)]);
    pose[side + "t"] = add(pose[side + "a"], [sign * .009, -.029, -.145]);
    const shoulder = pose[side + "s"];
    const hand = swimmer ? add(shoulder, [sign * .029, -.052, .590])
      : [sign * .187, .058 + .115 * r, -.016];
    arm(pose, side, hand, [sign * .71, -.22, -.57]);
  }
  return pose;
}

export function seatedCore(phase, options) {
  const { active, progress } = halfCycle(phase);
  const r = rep(options.alternate ? progress : phase, .37, .63);
  const yaw = options.twist ? active * options.twist * r : 0;
  const z = options.wall ? -.49 : -.29;
  const hips = [0, .170 + (options.lsit ? .110 * r : 0), z];
  const pose = stand(hips, options.lsit ? -.367 + .20 * r : options.back ? -.12 - .46 * r : options.russian ? -.50 : .045,
    yaw, options.wall ? .31 * r * active : 0);
  for (const [side, sign] of sides) {
    if (options.lsit || options.back) {
      legAngles(pose, side, sign, -.04 + (options.lsit ? .20 * r : 0), -.06 + (options.lsit ? .19 * r : 0));
    } else if (options.russian) {
      legAngles(pose, side, sign, .37, -.47);
    } else {
      leg(pose, side, [sign * .143, .107, z + .573], [sign * .07, .91, .13], [sign * .018, -.069, .128], .024);
    }
    const s = pose[side + "s"];
    let hand;
    if (options.lsit) hand = [sign * .186, .071, z + .01];
    else if (options.back) hand = [sign * .228, .071, z - .325];
    else if (options.russian) hand = [active * .341 * r + sign * .044, .41 - .082 * r, z + .410 - .079 * r];
    else hand = add(pose.head, [sign * .102, -.024, -.041]);
    arm(pose, side, hand, [sign * .61, .013, -.79]);
  }
  return pose;
}

export function ironCross(phase) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, .37, .64);
  const angle = 1.28 * r * active;
  const pose = torso([active * .062 * r, .159, -.149], -Math.PI / 2);
  pose.headDrop = .029;
  for (const [side, sign] of sides) {
    const lift = [Math.sin(angle), Math.cos(angle), .043];
    pose[side + "k"] = add(pose[side + "h"], scale(lift, .422));
    pose[side + "a"] = add(pose[side + "k"], scale(lift, .424));
    pose[side + "t"] = add(pose[side + "a"], [.016, .042, .122]);
    arm(pose, side, [sign * .785, .067, -.649], [sign * .71, .125, -.68]);
  }
  return pose;
}

export function kneehug(phase, floor) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, .35, .65);
  const hips = [floor ? 0 : -.084 * active * r, floor ? .162 : .881, -.15];
  const pose = torso(hips, floor ? -Math.PI / 2 : .055);
  pose.headDrop = floor ? .034 : .002;
  for (const [side, sign] of sides) {
    const activeLeg = sign === active;
    if (floor) {
      legAngles(pose, side, sign, .058 + (activeLeg ? 1.184 * r : 0), .038 + (activeLeg ? .987 * r : 0));
    } else if (activeLeg) {
      legAngles(pose, side, sign, -1.5708 + 2.001 * r, -1.595 + .121 * r);
    } else {
      leg(pose, side, [sign * .126, .089, -.102], [sign * .03, -.09, .99], [sign * .011, -.073, .128], 0);
    }
  }
  const knee = pose[active > 0 ? "lk" : "rk"];
  for (const [side, sign] of sides) {
    const relaxed = floor ? [sign * .211, .076, -.175] : [sign * .195, hips[1] - .020, -.051];
    const pull = floor ? add(knee, [sign * .078, -.077, -.117]) : add(knee, [sign * .084, -.041, .064]);
    arm(pose, side, blend(relaxed, pull, r), [sign * .64, -.12, -.74]);
  }
  return pose;
}

export function ankleTwist(phase) {
  const { active, progress } = halfCycle(phase);
  const phaseAngle = 2 * Math.PI * progress;
  const lift = rep(progress, .23, .77);
  const pose = torso([0, .152, -.31], -.272);
  for (const [side, sign] of sides) {
    const r = sign === active ? lift : 0;
    legAngles(pose, side, sign, .025 + .253 * r, -.03 + .14 * r);
    const direction = r * Math.sin(phaseAngle);
    pose[side + "t"] = add(pose[side + "a"], [direction * .108, -.058 + .117 * r * Math.cos(phaseAngle), .105]);
    arm(pose, side, [sign * .203, .068, -.511], [sign * .58, -.093, -.82]);
  }
  return pose;
}

export function climber(phase, cross) {
  const { active, progress } = halfCycle(phase);
  const r = rep(progress, cross ? .39 : .42, cross ? .60 : .48);
  const hips = [cross ? active * .028 * r : 0, .508 + .053 * r, -.088 + .032 * r];
  const pose = torso(hips, Math.PI / 2 - .19, cross ? active * .16 * r : .0);
  pose.headDrop = -.028;
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .225, .052, .472], [sign * .58, -.045, -.81]);
    const drive = sign === active ? r : 0;
    const x = sign * (.125 - (cross ? .256 : -.066) * drive);
    const goal = [x, .096 + .149 * drive, -.810 + .807 * drive];
    leg(pose, side, goal, [sign * (cross ? -.21 : .26), -.95, .27], [sign * .008, -.061, .105],
      drive < .002 ? 0 : undefined);
  }
  return pose;
}

export function advancePushUp(phase, type) {
  const { active, progress } = halfCycle(phase);
  const series = ["spider", "superman"].includes(type);
  const t = series ? progress : Math.min(progress / .58, 1);
  const pose = pushUp(t, {width: .227});
  const extension = rep(progress, .68, .80) * ramp(progress, .50, .68);
  const motion = series ? rep(progress, .41, .55) : extension;
  const pivot = type === "side";
  const reach = type === "raise" || type === "superman" || pivot;
  if (pivot) {
    const turn = active * motion * Math.PI / 2;
    for (const [left, right] of [["ls","rs"],["lh","rh"]]) {
      const mid = blend(pose[left], pose[right], .5);
      const width = (pose[left][0] - pose[right][0]) / 2;
      pose[left] = add(mid, [Math.cos(turn) * width, Math.sin(turn) * width, 0]);
      pose[right] = add(mid, [-Math.cos(turn) * width, -Math.sin(turn) * width, 0]);
    }
  }
  for (const [side, sign] of sides) {
    if (sign === active && reach) {
      const shoulder = pose[side + "s"];
      const extensionTarget = type === "superman" ? add(shoulder, [sign * .063, .080, .585])
        : pivot ? add(shoulder, [sign * .043, .585, .047])
        : add(shoulder, [sign * .587, .037, -.026]);
      arm(pose, side, blend([sign * .227, .047, .44], extensionTarget, motion), [sign * .51, .35, -.71]);
    }
    if (sign !== active && type === "superman") {
      leg(pose, side, [sign * .137, .095 + .233 * motion, -.81 - .195 * motion],
        [sign * .19, -.66, .57], [sign * .012, -.023, -.137], motion < .003 ? 0 : undefined);
      if (motion > .003) delete pose.planted[side];
    }
    if (sign === active && ["spider", "inside", "outside"].includes(type)) {
      const target = [sign * (.113 + motion * (type === "spider" ? .451 : type === "inside" ? -.49 : .53)),
        .095 + .159 * motion, -.81 + motion * (type === "spider" ? .853 : .175)];
      leg(pose, side, target, [sign * (type === "inside" ? -.74 : .78), -.21, .53], [sign * .014, -.066, .107]);
      if (motion > .003) delete pose.planted[side];
    }
  }
  return pose;
}

export function divePushUp(phase, hindu) {
  const d = rep(phase, .51, .60);
  const retreat = rep(phase, .18, .25) * (1 - ramp(phase, .30, .43));
  const forward = hindu ? 0 : d;
  const low = hindu ? rep(phase, .43, .57) : (rep(phase, .29, .35) + rep(phase, .72, .74)) / 2 * (1 - d);
  const footY = .097;
  const footZ = -.802;
  const hipY = .524 + .238 * retreat - .283 * forward - .112 * low;
  const hip = [0, hipY, footZ + Math.sqrt(.840 ** 2 - (hipY - footY) ** 2)];
  const angle = 1.35 + .84 * retreat - .673 * forward + .61 * low;
  const pose = torso(hip, angle);
  pose.headDrop = -.02;
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .231, .050, .575], [sign * .52, .16, -.82]);
    leg(pose, side, [sign * (hindu ? .172 : .098), footY, footZ], [sign * .101, -.62, .56],
      [sign * .012, -.071, .111], 0);
  }
  return pose;
}

export function pressForearms(phase, drop) {
  const d = rep(phase, .42, .58);
  const high = drop ? .272 * (1 - d) : .0;
  const footY = .095;
  const footZ = -.945;
  const y = .271 + high - .079 * d;
  const hips = [0, y, footZ + Math.sqrt(.841 ** 2 - (y - footY) ** 2)];
  const p = torso(hips, 1.45 + .135 * d);
  for (const [side, sign] of sides) {
    const shoulder = p[side + "s"];
    const grasp = [sign * .190, .072, .593];
    arm(p, side, grasp, [sign * .18, -.192, -.91], [0, -.025, 1]);
    const contact = [sign * .189, .069, shoulder[2] - .082];
    p[side + "e"] = blend(contact, p[side + "e"], drop ? 1 - d : 0);
    leg(p, side, [sign * .120, footY, footZ], [sign * .079, -.66, .64], [sign * .009, -.070, .117], 0);
  }
  return p;
}

export function holdHandstand(phase, presses) {
  const cycle = phase * 2 * Math.PI;
  const d = presses ? rep(phase, .42, .57) : .03 + .022 * Math.sin(cycle);
  const pitch = Math.PI + .075 + (presses ? 0 : .031 * Math.sin(cycle));
  const pose = torso([presses ? 0 : .037 * Math.sin(cycle), 1.106 - .280 * d, .288 + .016 * d], pitch);
  pose.headDrop = -.037;
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .204, .055, .238], [sign * .66, -.11, -.61], [0, -.014, -.99]);
    leg(pose, side, [sign * .085, 1.905 - .280 * d, presses ? .398 : .373 + .021 * sign * Math.sin(cycle)],
      [sign * .028, -.23, -.96], [sign * .006, .084, .097]);
  }
  return pose;
}

export function fullPlanche(phase) {
  const d = rep(phase, .41, .58);
  const hips = [0, .577 - .318 * d, -.204 + .062 * d];
  const pose = torso(hips, 1.583 + .101 * d);
  pose.headDrop = -.028;
  for (const [side, sign] of sides) {
    arm(pose, side, [sign * .198, .048, .104], [sign * .57, .200, -.79], [-sign * .54, -.015, .842]);
    leg(pose, side, [sign * .095, .571 - .306 * d, -1.043 + .062 * d], [sign * .06, -.83, .43], [sign * .013, -.028, -.141]);
  }
  return pose;
}

export function dropPushUp(phase) {
  const land = ramp(phase, .16, .27);
  const returnToSteps = ramp(phase, .71, .863);
  const gap = land * (1 - returnToSteps);
  const depth = rep(phase, .43, .51) * gap;
  const bounce = .060 * (Math.sin(Math.PI * land) + Math.sin(Math.PI * returnToSteps));
  const hips = [0, .468 + .082 * (1 - gap) - .263 * depth + bounce, -.064];
  const pose = torso(hips, 1.326 + .267 * depth);
  for (const [side, sign] of sides) {
    const hand = [sign * (.386 - .170 * gap), .163 - .115 * gap + bounce, .446];
    arm(pose, side, hand, [sign * .65, .09, -.71]);
    leg(pose, side, [sign * .108, .096, -.765], [sign * .108, -.76, .39], [sign * .011, -.07, .116], 0);
  }
  return pose;
}

export function seatedHip(phase, options) {
  const { active, progress } = halfCycle(phase);
  const t = options.butterfly ? phase : progress;
  const d = rep(t, .33, .67);
  const twist = options.twist ? active * .855 * d : 0;
  const torsoPitch = options.butterfly ? .032 + .132 * d : .062 + (options.twist ? .034 : .422) * d;
  const hips = [0, .161, -.27];
  const pose = stand(hips, torsoPitch, twist);
  for (const [side, sign] of sides) {
    const goal = options.butterfly ? [sign * (.114 - .051 * d), .100, .541 - .367 * d]
      : sign === active ? [sign * (.137 - .319 * d), .102 + (options.twist ? 0 : .193 * d), .548 - .446 * d]
      : [sign * .133, .098, .535];
    const pole = options.butterfly ? [sign * .90, .36, .07]
      : sign === active ? [sign * .80, .56, .184]
      : [sign * .20, .77, .58];
    leg(pose, side, goal, pole, [sign * (options.butterfly ? -.096 : .01), -.070, .115], goal[1] < .13 ? .024 : undefined);
    const support = sign === active ? [sign * .256, .078, -.582] : [sign * .241, .072, -.073];
    const contact = options.butterfly ? [sign * .091, .153, .194]
      : sign === active ? [sign * .24, .082, -.582]
      : options.twist ? [-sign * .221, .459, .04]
      : [-sign * .329, .361, .037];
    arm(pose, side, blend(support, contact, d), [sign * .65, -.114, -.63]);
  }
  return pose;
}

export function quadrupedCircles(phase) {
  const { active, progress } = halfCycle(phase);
  const angle = progress * 2 * Math.PI;
  const d = rep(progress, .16, .83);
  const hips = [0, .518, -.309];
  const pose = torso(hips, 1.48, -.067 * active * d);
  for (const [side, sign] of sides) {
    const armPole = [sign * .32, -.12, -.83];
    arm(pose, side, [sign * .223, .069, .240], armPole);
    const lift = sign === active ? d : 0;
    const knee = [sign * (.115 + lift * (.16 + .135 * Math.sin(angle))), .105 + lift * (.258 + .165 * Math.cos(angle)),
      -.319 - lift * (.212 + .096 * Math.cos(angle))];
    const curve = unit(subtract(knee, pose[side + "h"]));
    pose[side + "k"] = add(pose[side + "h"], scale(curve, .422));
    const shin = unit([sign * -.075 * lift, .536 * lift, -1]);
    pose[side + "a"] = add(pose[side + "k"], scale(shin, .424));
    pose[side + "t"] = add(pose[side + "a"], [sign * .013, -.064, -.127]);
  }
  return pose;
}

export function lyingCurl(phase) {
  const r = rep(phase, .38, .62);
  const hips = [0, .185, -.093];
  const pose = torso(hips, -1.478, 1.57);
  pose.lh = [0, .286, hips[2]];
  pose.rh = [0, .077, hips[2]];
  for (const [side, sign] of sides) {
    legAngles(pose, side, sign, -.014, .003);
    const shoulder = pose[side + "s"];
    const target = sign < 0 ? add(pose.head, [-.106, -.034, .125])
      : add(shoulder, [-.061 - .186 * r, -.016 + .252 * r, .608 - .461 * r]);
    const pole = sign < 0 ? [sign * -.29, -.61, -.7] : [-.064, -.16, .96];
    arm(pose, side, target, pole);
  }
  return pose;
}

export function elbowLift(phase) {
  const r = rep(phase, .40, .61);
  const pose = proneCurl(phase, false);
  const y = .151 + .027 * r;
  const hips = [0, y, -.107];
  const raised = torso(hips, 1.59 - .502 * r);
  for (const [side, sign] of sides) {
    arm(raised, side, [sign * .217, .070, .377], [sign * .28, -.072, -.95]);
    for (const joint of ["k", "a", "t"]) raised[side + joint] = pose[side + joint];
  }
  return raised;
}

export function inchworm(phase) {
  const fold = ramp(phase, .025, .20) * (1 - ramp(phase, .825, .99));
  const crawl = ramp(phase, .19, .49) * (1 - ramp(phase, .553, .83));
  const step = crawl * 4;
  const body = [0, .875 - .042 * fold - .369 * crawl, -.689 + .713 * crawl];
  const pose = torso(body, (1 - fold) * .035 + fold * (2.381 - .997 * crawl));
  pose.headDrop = .031 * fold;
  for (const [side, sign] of sides) {
    const first = ramp(step, sign > 0 ? 0 : 1, sign > 0 ? 1 : 2);
    const second = ramp(step, sign > 0 ? 2 : 3, sign > 0 ? 3 : 4);
    const handLift = .071 * (Math.sin(first * Math.PI) + Math.sin(second * Math.PI));
    const shoulder = pose[side + "s"];
    const floor = [sign * .195, .060 + handLift, -.190 + .387 * (first + second)];
    const relaxed = add(shoulder, [sign * .043, -.587, .034]);
    arm(pose, side, blend(relaxed, floor, fold), [sign * .14, -.19, -.95]);
    leg(pose, side, [sign * .125, .091, -.729], [sign * .064, -.59, .77], [sign * .012, -.071, .122], 0);
  }
  return pose;
}
