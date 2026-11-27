import { add, arm, blend, leg, legAngles, mix, sides, stand, torso } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const deck = .024;
const clamp = n => Math.max(0, Math.min(1, n));

function span(frames, read) {
  const ns = frames.map(read);
  const min = Math.min(...ns);
  const width = Math.max(.05, Math.max(...ns) - min);
  return f => clamp((read(f) - min) / width);
}

function arch(f, phase, a, mode, profile) {
  const lift = a.high(f);
  const curl = a.chestUp(f);
  const kick = profile.single ? a.ankles[0](f) : 0;
  const forearms = mode === "invertedStaff";
  const wind = .009 * Math.sin(phase * Math.PI * 4);
  const hips = [0, mix(.161, profile.height ?? .684, lift) + wind * lift, mix(-.032, .083, lift)];
  const angle = mix(-1.62, forearms ? -2.29 : -1.868, lift);
  const p = torso(hips, angle);
  const center = profile.single ? .033 * kick : 0;
  p.hips[0] = -center;
  p.headDrop = mix(.042, -.037, lift);
  if (mode === "wheel" && profile.late) {
    p.chest[1] -= .091 * lift * (1 - curl);
    p.neck[1] -= .098 * lift * (1 - curl);
  }
  for (const [side, sign] of sides) {
    const ankle = [sign * .137, .112, forearms ? .686 : .454];
    if (kick > 0 && sign > 0) {
      ankle[1] = mix(.112, hips[1] + .786, kick);
      ankle[2] = mix(.454, hips[2] + .201, kick);
    }
    const toe = [sign * .016, mix(-.068, .103, sign > 0 ? kick : 0), .131];
    const plane = [sign * .095, .861 * (1 - kick * Number(sign > 0)), .555];
    leg(p, side, ankle, plane, toe, kick < .014 || sign < 0 ? deck : undefined);
    const shoulder = p[side + "s"];
    if (forearms) {
      const supported = [sign * .202, .088, -.503];
      arm(p, side, [sign * .202, .069, -.817], [sign * .131, -.988, .097], [0, -.053, -.997]);
      const shoulderDistance = Math.hypot(...supported.map((n, index) => n - shoulder[index]));
      if (shoulderDistance > .131 && shoulderDistance < .399) {
        p[side + "e"] = supported;
        p[side + "w"] = [sign * .213, .071, -.872];
        p[side + "Fingers"] = [0, -.028, -.999];
      }
    } else {
      arm(p, side, [sign * .235, .069, -.522], [sign * .19, .947 - 1.22 * lift, -.515], [0, -.039, .998]);
    }
  }
  return p;
}

function floorArc(f, phase, a, mode, profile) {
  const lift = a.chestUp(f);
  const hipsHigh = a.high(f);
  const raises = a.ankles.map(read => read(f));
  const mid = Math.max(...raises);
  const twistSlope = (mode === "sideBridge" ? a.direct[0](f) : a.turn(f)) * 2 - 1;
  const extensionKey = [0, .89, 0, 1, 0, .91, 0, 1];
  const turnKey = [0, 1, 0, 0, 0, -1, 0, 0];
  const beat = phase * extensionKey.length % extensionKey.length;
  const index = Math.floor(beat);
  const ease = (1 - Math.cos(Math.PI * (beat - index))) * .5;
  const goal = values => mix(values[index], values[(index + 1) % values.length], ease);
  const side = mode === "sideExtend" ? goal(turnKey) : a.handSide(f) * 2 - 1;
  const reach = ["v", "clap", "holdV"].includes(mode);
  const press = mode === "press";
  const sitTwist = ["seatedTwist", "chop", "kneeTwist", "sideExtend"].includes(mode);
  const oblique = mode === "sideV";
  const bridge = mode === "twistLift" || mode === "sideBridge";
  const hips = [0, mode === "scissors" ? .451 : mode === "sideBridge" ? .398 : bridge ? .145 + .245 * hipsHigh : .143, mode === "sideBridge" ? -.114 + .091 * twistSlope : -.086];
  if (mode === "butterflyRoll") {
    hips[1] += .29 * a.ankles[0](f);
    hips[2] -= .052 * mid;
  }
  const angle = mode === "scissors" ? -2.13 : mode === "kneeTwist" ? -.681 + .40 * mid : sitTwist ? -.676
    : mode === "butterflyRoll" ? -.032 - 2.18 * a.ankles[0](f) : mode === "twistLift" ? -1.57 - .314 * hipsHigh
    : mode === "sideBridge" ? -1.89 : mode === "holdV" ? -.621 : -1.575 + (mode === "dish" ? .251 : mode === "elbow" ? 1.10 : reach ? 1.085 : .57) * lift;
  const p = sitTwist ? stand(hips, angle, mode === "sideExtend" ? .44 * side : .86 * twistSlope)
    : torso(hips, angle, oblique ? -1.52 : mode === "elbow" ? -.60 * lift : mode === "twistLift" ? .584 * side * hipsHigh : 0);
  p.headDrop = .015 + .021 * lift;
  if (mode === "dish") p.chest[1] += .010 * Math.sin(phase * Math.PI * 4);
  for (const [sideName, sign] of sides) {
    const idx = sign > 0 ? 0 : 1;
    const raw = raises[idx];
    let ankle = [sign * .142, .109, .629];
    let pole = [sign * .107, .868, .15];
    let toe = [sign * .011, .076, .103];
    let planted = false;
    if (reach || oblique || mode === "dish") {
      const height = mode === "dish" ? .143 : mode === "holdV" ? 1.19 : oblique ? .56 : 1.19;
      const liftAngle = raw * height;
      ankle = add(p[sideName + "h"], [sign * (oblique ? .060 : .017), .837 * Math.sin(liftAngle) - .039, .835 * Math.cos(liftAngle)]);
      pole = [sign * .152, -.89, .386];
      toe = [sign * .014, .073, .092];
    } else if (press) {
      ankle = blend(ankle, [sign * .171, .399, .273], raw);
      pole = [sign * .189, .98, -.031];
    } else if (mode === "elbow" || bridge) {
      ankle = [sign * .159 + (mode === "sideBridge" ? .221 * twistSlope : 0), .111, .473];
      toe = [sign * .017, -.066, .130];
      planted = true;
    } else if (mode === "scissors") {
      const sweep = a.direct[idx](f) * .94 + .612;
      legAngles(p, sideName, sign, sweep, sweep - .011, .028);
      continue;
    } else if (mode === "butterflyRoll") {
      ankle = [sign * .049, .106 + .621 * mid, .284 - .075 * mid];
      pole = [sign * .951, .21, .102];
      toe = [-sign * .048, -.036, .117];
    } else if (sitTwist) {
      ankle = mode === "kneeTwist" ? [sign * .147, .216 + raw * .362, .437 - .194 * raw]
        : [sign * .147, mode === "chop" ? .111 : .234 + raw * .124, mode === "sideExtend" ? .227 + .516 * goal(extensionKey) : .424 - .115 * raw];
      if (mode === "sideExtend") ankle[0] += .441 * side;
      toe = [sign * .014, -.063, .120];
      planted = mode === "chop";
    }
    leg(p, sideName, ankle, pole, toe, planted ? deck : undefined);
  }
  for (const [sideName, sign] of sides) {
    const idx = sign > 0 ? 0 : 1;
    const shoulder = p[sideName + "s"];
    const knee = p[sideName + "k"];
    let wrist = [sign * .235, .069, -.227];
    let pole = [sign * .542, -.682, -.226];
    let fingers = [0, -.038, .999];
    if (reach || oblique || mode === "dish") {
      const overhead = add(shoulder, [sign * .065, .020 + .153 * lift, -.591]);
      const toe = add(p[sideName + "t"], [sign * (mode === "clap" ? -.135 : .026), .069, -.042]);
      wrist = mode === "dish" ? overhead : blend(overhead, toe, mode === "holdV" ? mid : lift);
      if (oblique && sign < 0) wrist = [sign * .185, .068, -.415 + .231 * lift];
      pole = [sign * .542, -.78, mode === "dish" ? .09 : -.15];
      fingers = mode === "dish" ? [sign * .075, -.021, -.997] : [sign * .11, .947, .302];
    } else if (press) {
      wrist = blend(add(shoulder, [sign * .078, .034, -.586]), add(knee, [sign * .021, .052, .035]), mid);
      fingers = [-sign * .45, -.543, -.705];
    } else if (mode === "elbow" || mode === "kneeTwist") {
      wrist = add(p.head, [sign * .087, -.037, -.078]);
      const opposite = p[sign > 0 ? "rk" : "lk"];
      pole = blend([sign * .921, -.112, -.225], opposite.map((n, i) => n - shoulder[i]), mode === "elbow" ? lift * Number(sign < 0) : a.ankles[1 - idx](f));
      fingers = [0, .115, -.993];
    } else if (mode === "butterflyRoll") {
      wrist = add(p[sideName + "t"], [sign * .038, .037, -.068]);
      fingers = [-sign * .59, -.321, -.74];
    } else if (mode === "sideExtend") {
      wrist = [sign * .235, .067, -.444];
    } else if (mode === "seatedTwist") {
      wrist = add(p.chest, [-sign * .106, .127 + sign * .074, .212]);
      fingers = [-sign * .802, .199, .538];
    } else if (mode === "chop") {
      wrist = add(p.chest, [sign * .035 + .302 * twistSlope, -.27 * Math.abs(twistSlope), .291]);
      fingers = [-sign * .805, .183, .562];
    } else if (mode === "scissors") {
      wrist = add(p.hips, [sign * .126, -.053, -.075]);
      fingers = [sign * .25, .77, .586];
    } else if (mode === "twistLift" && sign * side < 0) {
      wrist = blend(wrist, add(shoulder, [-sign * .21, .066, -.553]), hipsHigh * Math.abs(side));
      fingers = [sign * .102, .017, -.994];
    }
    arm(p, sideName, wrist, pole, fingers);
  }
  return p;
}

function smallStretch(f, phase, a, mode, profile) {
  const lift = a.chestUp(f);
  const rotation = a.turn(f);
  const breath = .012 * Math.sin(phase * Math.PI * 4);
  if (mode === "plantar") {
    const p = stand([0, .144, -.163], .725 + .177 * Math.sin(phase * Math.PI) ** 2);
    leg(p, "l", [.108, .107, .655], [.11, .17, .93], [.031, .108, .099]);
    const active = [.085, .207, .278];
    const tilt = Math.sin(phase * Math.PI) ** 2;
    leg(p, "r", active, [-.954, .30, .061], [profile.direction * .095 * tilt, .069 - .118 * tilt, .113]);
    for (const [side, sign] of sides) {
      const hand = add(p.rt, [sign * .037, .047, -.056]);
      arm(p, side, hand, [sign * .619, -.630, -.179], [-sign * .661, -.51, -.540]);
    }
    return p;
  }
  const fish = mode === "fish";
  const hips = [0, .136, fish ? .018 : -.023];
  const p = fish ? torso(hips, -1.558 + .496 * lift) : stand(hips, 1.568 - (mode === "cobraTurn" ? .49 : .97 * lift), mode === "cobraTurn" ? -.58 * rotation : 0);
  if (fish) {
    p.head = [0, .124 + .043 * lift, -.651];
    p.neck = [0, .148 + .153 * lift + breath * lift, -.535];
    p.headAim = [0, -.85 * lift, -1];
  }
  for (const [side, sign] of sides) {
    const distal = [sign * .134, .107, fish ? .836 : -.852];
    const kneePole = [sign * .107, -.11 - .84 * Number(!fish), fish ? .69 : .109];
    const toe = [sign * .023, -.025, fish ? .119 : -.141];
    leg(p, side, distal, kneePole, toe);
    const wrist = fish ? [sign * .132, .065, .019] : [sign * .214, .067, .333];
    arm(p, side, wrist, [sign * .52, -.69, -.333], [0, -.023, .998]);
  }
  return p;
}

export function floorBalanceGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const a = {
    high: span(frames, f => -f[2][1]),
    chestUp: span(frames, f => -f[1][1]),
    turn: span(frames, f => f[1][0] - f[2][0]),
    handSide: span(frames, f => f[4][1] - f[6][1]),
    ankles: [8,10].map(index => span(frames, f => -f[index][1])),
    direct: [8,10].map(index => span(frames, f => f[index][0])),
  };
  return phase => {
    const f = guideAt(frames, phase);
    if (mode === "wheel" || mode === "invertedStaff") return arch(f, phase, a, mode, profile);
    if (["fish", "cobra", "cobraTurn", "plantar"].includes(mode)) return smallStretch(f, phase, a, mode, profile);
    return floorArc(f, phase, a, mode, profile);
  };
}
