import { add, arm, blend, leg, mix, rep, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = v => Math.max(0, Math.min(1, v));
const rotate = ([x, y, z], yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), y, z * Math.cos(yaw) - x * Math.sin(yaw)];

function range(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return f => clamp((read(f) - low) / span);
}

export function chairMobilityGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const chestDepth = range(frames, f => f[1][1]);
  const armRise = [4, 6].map(index => range(frames, f => -f[index][1]));
  const lowerRise = [8, 10].map(index => range(frames, f => -f[index][1]));
  const bodySide = range(frames, f => f[1][0] - f[2][0]);
  const headSide = range(frames, f => f[0][0] - f[1][0]);
  const headDepth = range(frames, f => f[0][1] - f[1][1]);
  const openWrists = [4, 6].map(index => range(frames, f => Math.abs(f[index][0] - f[1][0])));
  const slideAnkle = [8, 10].map(index => range(frames, f => -f[index][0]));
  const near = profile.side === "right" ? -1 : 1;
  const lower = ["raise", "flex", "circle", "ankle", "external", "hug", "ham", "figure", "quad", "open"].includes(mode);
  const forwardRows = ["roll", "ham", "lateral", "diagonal", "figure", "catCow"].includes(mode);

  return phase => {
    const f = guideAt(frames, phase);
    const dip = chestDepth(f);
    const repAmount = rep(phase, .35, .54);
    const swing = 2 * Math.PI * phase;
    const cycle = Math.sin(swing);
    const side = profile.both ? Math.sign(cycle) || 1 : near;
    const sidesOfBody = bodySide(f) * 2 - 1;
    const lowerAmount = Math.max(.20 * repAmount, Math.max(lowerRise[0](f), lowerRise[1](f)));
    const sway = mode === "side" ? sidesOfBody : 0;
    const hipCenter = [0, .613, mode === "quad" ? -.022 : .029];
    const facing = mode === "quad" ? side * Math.PI / 2 : 0;
    const lean = forwardRows ? (mode === "catCow" ? .028 + .47 * (dip - .35) : mode === "ham" ? .13 + .70 * dip
      : mode === "diagonal" ? .92 * Math.abs(sidesOfBody) : mode === "figure" ? .619 * dip : mode === "roll" ? 1.02 * dip : .85 * dip)
      : mode === "rib" || mode === "collar" ? -.128 * repAmount : mode === "twist" ? -.096 : .031;
    const yaw = facing + (mode === "open" ? side * .68 * lowerAmount : mode === "twist" || mode === "diagonal" || mode === "rollBox" ? sidesOfBody * .87
      : mode === "lateral" ? near * .36 * dip : mode === "chestOpen" ? side * .66 * repAmount : 0);
    const p = stand(hipCenter, lean, yaw, mode === "lateral" ? near * .19 * dip : mode === "side" ? .54 * sway : 0);
    if (mode === "neckYaw") {
      const tilt = (headSide(f) * 2 - 1) * 1.17;
      p.headAim = [Math.sin(tilt), .035, Math.cos(tilt)];
      p.head[0] += .042 * Math.sin(tilt);
    } else if (mode === "neckSide") {
      const tilt = (headSide(f) * 2 - 1) * .58;
      p.head[0] += .131 * Math.sin(tilt);
      p.head[1] -= .048 * Math.abs(Math.sin(tilt));
      p.headAim = [Math.sin(tilt), -.085, .965];
    } else if (mode === "neckNod" || mode === "neckPull") {
      const tilt = mode === "neckNod" ? (headDepth(f) * 2 - 1) * 1.16 : 1.05 * headDepth(f);
      p.head[1] -= .057 * Math.abs(tilt);
      p.head[2] += .059 * tilt;
      p.headAim = [0, -Math.sin(tilt), Math.cos(tilt)];
    }

    for (const [key, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const motion = mode === "flex" ? slideAnkle[index](f) : lowerRise[index](f);
      const amount = mode === "ham" || mode === "figure" ? Math.max(dip, .43 * repAmount)
        : mode === "quad" ? Math.max(motion, .31 * repAmount) : Math.max(motion, .14 * repAmount);
      const apply = sign === side || mode === "circle" && profile.bothFeet;
      let ankle = [sign * .142, .086, .439];
      let pole = [sign * .115, .074, .98];
      let toe = [sign * .018, -.063, .128];
      let contact = true;
      if (apply && lower) {
        if (mode === "raise") {
          ankle = [sign * .144, .118 + .468 * amount, .402 + .409 * amount];
          contact = amount < .013;
          toe = [sign * .015, -.047 + .159 * amount, .113];
        } else if (mode === "flex") {
          ankle = [sign * .146, .086, .409 - .256 * amount];
          contact = true;
          toe = [sign * .014, -.067, .13];
        } else if (mode === "external" || mode === "open") {
          ankle = mode === "external" ? [sign * (.153 - .322 * amount), .112 + .133 * amount, .419]
            : [sign * (.147 + .325 * amount), .103 + .293 * amount, .405];
          contact = amount < .012;
          if (mode === "open") pole = [sign * .98, .08, .05];
        } else if (mode === "circle" || mode === "ankle") {
          const t = mode === "ankle" ? (repAmount - .25) * 2.3 : swing * 2;
          ankle = mode === "ankle" ? [sign * .146, .270, .705] : [sign * .142, .146, .417];
          toe = mode === "ankle" ? [sign * .020, -.11 * Math.sin(t), .133 * Math.cos(t / 3)]
            : [sign * .094 * Math.cos(t), -.037 + .052 * Math.sin(t), .133];
          contact = false;
        } else if (mode === "hug") {
          ankle = [sign * .144, .086 + .319 * amount, .414 - .153 * amount];
          pole = [sign * .13, .96, .175];
          toe = [sign * .013, -.085, .101];
          contact = amount < .012;
        } else if (mode === "ham") {
          ankle = [sign * .144, .092, .656];
          toe = [sign * .012, .085, .109];
        } else if (mode === "quad") {
          const outside = rotate([sign * .314, 0, -.152 - .081 * amount], facing);
          ankle = [outside[0], .094 + .412 * amount, outside[2]];
          pole = rotate([sign * .71, -.97, .03], facing);
          toe = rotate([sign * .019, -.084, -.107], facing);
          contact = amount < .012;
        }
      } else if (mode === "quad") {
        ankle = rotate([sign * .129, .086, .402], facing);
        pole = rotate([sign * .115, .074, .98], facing);
        toe = rotate(toe, facing);
      }
      if (mode === "figure" && apply) continue;
      leg(p, key, ankle, pole, toe, contact && mode !== "ham" ? 0 : undefined);
    }

    if (mode === "figure") {
      const targetKey = side > 0 ? "l" : "r";
      const anchorKey = side > 0 ? "r" : "l";
      const ankle = add(p[anchorKey + "k"], [side * .014, .081, .035]);
      leg(p, targetKey, ankle, [side * .991, .061, .106], [-side * .121, -.021, .064]);
    }

    for (const [key, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const shoulder = p[key + "s"];
      const knee = p[key + "k"];
      const ankle = p[key + "a"];
      const other = sign > 0 ? "r" : "l";
      const active = sign === side;
      const elevation = armRise[index](f);
      let wrist = add(knee, [sign * .022, .071, -.034]);
      let pole = [sign * .51, -.78, -.355];
      let fingers = [0, -.106, .987];
      let palm = [1, .028, .076];
      if (mode === "hug") {
        const inner = p[side > 0 ? "lk" : "rk"];
        wrist = blend(wrist, add(inner, [sign * .081, -.027, .099]), lowerAmount);
        fingers = [-sign * .891, -.112, -.39];
      } else if (mode === "raise" && profile.desk) {
        wrist = [sign * .20, .529, .062];
        fingers = [0, -.85, .53];
      } else if (mode === "figure") {
        wrist = active ? add(knee, [sign * .017, .047, .069]) : add(p[other + "a"], [sign * .036, .062, -.012]);
      } else if (mode === "quad" && active) {
        wrist = blend(add(shoulder, [sign * .04, -.59, .031]), add(ankle, [sign * .046, .051, .021]), repAmount);
        fingers = [0, -.71, -.704];
      } else if (mode === "diagonal") {
        const focus = sidesOfBody >= 0 ? "l" : "r";
        const reaching = sign * sidesOfBody < 0;
        const guard = add(shoulder, [sign * .045, -.016, .602]);
        wrist = blend(guard, reaching ? add(p[focus + "t"], [sign * .017, .080, -.038]) : add(p[focus + "k"], [sign * .042, .044, .096]), Math.abs(sidesOfBody));
      } else if (mode === "ham" || mode === "lateral" || mode === "roll") {
        const focus = mode === "lateral" || mode === "ham" ? near > 0 ? "l" : "r" : key;
        wrist = blend(wrist, mode === "roll" ? add(knee, [sign * .024, .037, .138]) : blend(p[focus + "k"], p[focus + "t"], mode === "ham" && !profile.touch ? .56 : .92), dip);
      } else if (mode === "over" || mode === "press" || mode === "triceps") {
        const start = mode === "triceps" ? add(p.head, [sign * .073, .137, -.155])
          : mode === "press" ? add(shoulder, [sign * .072, .035, .139]) : wrist;
        const top = add(shoulder, [sign * (mode === "over" ? -.136 : .035), .594, .019]);
        wrist = blend(start, top, Math.max(elevation, repAmount * .75));
        pole = [sign * .56, mode === "triceps" ? .816 : -.44, -.61];
        fingers = [sign * .087, .964, .058];
        palm = mode === "over" ? [1, .011, -.64] : [1, .018, .050];
      } else if (mode === "neckPull" && active) {
        wrist = add(p.head, [sign * .088, .043, -.123]);
        pole = [sign * .791, .078, -.609];
        fingers = [0, -.019, -.995];
      } else if (mode === "side") {
        const rise = sign * sway < 0 ? Math.abs(sway) : 0;
        const high = profile.elbow ? add(p.head, [sign * .095, .012, -.104]) : add(shoulder, [sign * .050, .583, .078]);
        wrist = blend(add(shoulder, [sign * .089, -.590, .039]), high, rise);
        pole = [sign * .81, .065, -.486];
        fingers = [profile.elbow ? -sign * .61 : 0, .961, .010];
      } else if (mode === "twist") {
        wrist = add(p.chest, [sign * .037 + .144 * sidesOfBody, .075, .285]);
        fingers = [-sign * .857, -.059, .501];
      } else if (mode === "open" || mode === "chestOpen" || mode === "circles") {
        const swingOut = mode === "circles" ? 1 : mode === "open" ? lowerAmount : active ? .92 * repAmount : .12;
        wrist = blend(add(p.chest, [sign * .081, .053, .382]), add(shoulder, [sign * .572, mode === "circles" ? .112 * Math.sin(swing * 2) : .031,
          mode === "circles" ? .147 * Math.cos(swing * 2) : -.06]), swingOut);
        pole = [sign * .461, -.715, -.466];
        fingers = [sign * .94 * swingOut, .035, 1 - swingOut + .025];
        palm = mode === "circles" ? [0, .002, -1] : [1, .045, -.08];
      } else if (mode === "rib" || mode === "collar") {
        wrist = [sign * (mode === "rib" ? .182 : .076), mode === "rib" ? .519 : .607, -.175];
        pole = [sign * .61, -.332, -.717];
        fingers = [0, -.098, -.985];
      } else if (mode === "tap") {
        const otherShoulder = p[other + "s"];
        wrist = blend(wrist, add(otherShoulder, [sign * .043, .061, .098]), elevation);
        fingers = [-sign * .91, -.083, -.347];
      } else if (mode === "rollBox") {
        const t = swing * 2 + index * Math.PI;
        wrist = add(p.chest, [sign * .128, .209 + .08 * Math.sin(t), .282 + .103 * Math.cos(t)]);
        pole = [sign * .66, -.661, -.23];
        fingers = [0, .677, .726];
      } else if (mode === "out") {
        wrist = add(shoulder, [sign * (.075 + .267 * openWrists[index](f)), -.247, .168 + .208 * (1 - openWrists[index](f))]);
        pole = [sign * .059, -.985, -.03];
        fingers = [sign * .94 * openWrists[index](f), .028, .79];
      }
      arm(p, key, wrist, pole, fingers, palm);
      if (mode === "over") p[key + "w"] = add(p[key + "w"], [0, .080 * elevation, 0]);
      if (mode === "rollBox") p[key + "FingerCurl"] = .96;
    }
    return p;
  };
}
