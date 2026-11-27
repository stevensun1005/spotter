import { add, arm, blend, leg, mix, rep, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

function range(frames, read) {
  const values = frames.map(read);
  const start = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - start);
  return f => Math.min(1, Math.max(0, (read(f) - start) / span));
}

export function handMobilityGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const travel = range(frames, f => f[4][0]);
  const rot = range(frames, f => f[6][0] - f[4][0]);
  const chin = range(frames, f => f[0][1] - f[1][1]);
  const isSeated = mode === "chinChest";
  const hold = mode === "isometric";
  const one = profile.one || ["digit", "thumb", "pull", "cuff", "behind", "shoulderER", "shoulderIR", "forward", "backward"].includes(mode);

  return phase => {
    const f = guideAt(frames, phase);
    const progress = rep(phase, .36, .54);
    const wave = Math.sin(2 * Math.PI * phase);
    const atlas = mode === "chinChest" ? .30 * chin(f) : 0;
    const p = stand([0, isSeated ? .141 : .899, -.081], .022 + atlas * .23);
    if (mode === "chin") {
      const retract = .026 * (1 - travel(f)) + .071 * progress;
      p.head[2] -= retract;
      p.neck[2] -= .44 * retract;
      p.headAim = [0, .021, .99];
    }
    if (isSeated) {
      p.head[1] -= .083 * progress;
      p.head[2] += .083 * progress;
      p.headAim = [0, -.872 * progress, .99 - .31 * progress];
    }

    const switchSide = profile.alternate ? (phase < .5 ? 1 : -1) : -1;
    const working = profile.side === "left" ? 1 : switchSide;
    const singlePhase = profile.alternate ? rep(phase * 2 % 1, .39, .56) : progress;
    const bend = profile.gentle ? .51 : .78;
    for (const [side, sign] of sides) {
      const contact = isSeated ? [sign * .133, .105, .695] : [sign * .143, .086, .045];
      const sole = isSeated ? [sign * .014, .087, .086] : [sign * .019, -.064, .13];
      leg(p, side, contact, [sign * .08, .144, .989], sole, isSeated ? undefined : 0);
    }

    for (const [side, sign] of sides) {
      const active = sign === working || !one;
      const shoulder = p[side + "s"];
      const rest = add(shoulder, [sign * .052, -.591, .060]);
      let wrist = rest;
      let pole = [sign * .31, -.76, -.585];
      let fingers = [0, -.984, .127];
      let palmSide = [1, .02, 0];
      let curl = .013;
      let spread = .023;
      let thumb = 0;
      if (mode === "pronate" || mode === "supinate" || mode === "triple" || hold) {
        const horizontal = Math.sin(singlePhase * Math.PI);
        const rotate = mode === "triple" ? wave * 1.27 : mode === "supinate" ? Math.PI * singlePhase : mode === "pronate" ? Math.PI * (1 - singlePhase) : .025;
        wrist = add(shoulder, [sign * .048, -.248 - (hold ? .012 * wave : 0), .367]);
        if (mode === "triple") {
          wrist = blend(rest, wrist, Math.min(1, Math.min(phase, 1 - phase) * 8.4));
        }
        fingers = [0, .033 * horizontal, .999];
        pole = [sign * .05, -.974, -.211];
        palmSide = [Math.cos(rotate), sign * Math.sin(rotate), .002];
        curl = hold ? .96 * progress : .02;
        spread = .11;
      } else if (mode === "wings") {
        wrist = add(shoulder, [sign * (.597 - .072 * singlePhase), -.018 - .309 * singlePhase, .023]);
        pole = [sign * .36, -.41, -.83];
        fingers = [sign * .96, -.25 * singlePhase, .023];
        palmSide = [0, Math.sin(singlePhase * Math.PI + .005), Math.cos(singlePhase * Math.PI + .005)];
      } else if (mode === "digit" || mode === "thumb" || mode === "pull") {
        const distance = mode === "thumb" ? .303 : profile.sidePull ? .349 : .529;
        const crossed = mode === "thumb" ? -.08 * working : profile.sidePull ? .263 * working : .06 * working;
        const handY = mode === "thumb" ? .162 : -.108;
        const y = profile.direction * bend * singlePhase;
        const leading = profile.sidePull ? add(p.chest, [working * (.439 - .089 * singlePhase), .130, .263 + .126 * singlePhase])
          : add(p.chest, [crossed, handY, distance]);
        wrist = active ? leading : add(leading, [sign * (.077 - .04 * singlePhase), .079 - .041 * singlePhase, .096]);
        if (mode === "digit" && !active) wrist = rest;
        if (mode === "digit") wrist = active ? add(p.chest, [sign * .123, .122, .371]) : rest;
        pole = [sign * (active ? .21 : .54), -.770, -.47];
        fingers = mode === "thumb" || mode === "digit" ? active ? [sign * .044, 1, .051] : [-sign * .39, .372, -.841]
          : active ? [working * (profile.sidePull ? .82 : .058), y, Math.cos(y) * (profile.sidePull ? .53 : 1)]
          : [working * .37, profile.direction * .34, -.861];
        palmSide = mode === "digit" && active ? [1, 0, -.16] : [profile.palmUp ? -1 : 1, .034, .080];
        curl = mode === "digit" && active ? .91 * singlePhase : mode === "pull" && !active ? .48 : .021;
        spread = mode === "digit" && active ? .287 + .27 * (1 - singlePhase) : mode === "thumb" && active ? .511 : .009;
        thumb = mode === "digit" && active ? .96 : mode === "thumb" && active ? .21 + .78 * singlePhase : .02;
      } else if (mode === "cuff") {
        const activeArm = working * .60;
        const depart = add(p.chest, [working * .421, -.021, .16]);
        const pulled = add(p.chest, [-working * .432, .130, .322]);
        wrist = active ? blend(depart, pulled, singlePhase)
          : blend(add(shoulder, [sign * .033, -.48, .088]), add(p.chest, [activeArm * -.11, .111, .399]), singlePhase);
        pole = [sign * .62, -.41, -.55];
        fingers = [-working * .92, .041, -.372];
      } else if (mode === "behind") {
        if (active) {
          wrist = blend(rest, add(p.hips, [sign * .025, .411, -.166]), singlePhase);
          pole = [sign * .85, -.15, -.55];
          fingers = [sign * .067, .961, -.274];
          palmSide = [-1, 0, .013];
        }
      } else if ((mode === "shoulderER" || mode === "shoulderIR") && active) {
        const magnitude = Math.min(1, Math.max(singlePhase, .27 * (profile.test ? rot(f) : travel(f))));
        const angle = (mode === "shoulderER" ? 1 : -1) * (profile.test ? 1.31 : 1.08) * magnitude;
        const hinge = add(shoulder, [sign * .014, -.251, .005]);
        wrist = add(hinge, [sign * .358 * Math.sin(angle), .015, .363 * Math.cos(angle)]);
        pole = [sign * .07, -.97, -.16];
        fingers = [sign * Math.sin(angle), .020, Math.cos(angle)];
      } else if (mode === "forward" || mode === "backward") {
        if (active) {
          wrist = mode === "backward" ? add(shoulder, [sign * .081, -.595 * Math.cos(.631 * singlePhase), -.594 * Math.sin(.631 * singlePhase)])
            : add(shoulder, [sign * .069, -.304 + .20 * singlePhase, .317 + .28 * singlePhase]);
          fingers = mode === "backward" ? [0, -.78, -.526 * singlePhase] : [0, -.312, .948];
        }
      } else if (mode === "svend") {
        wrist = add(p.chest, [sign * .038, .141, .267 + .344 * singlePhase]);
        pole = [sign * .771, -.43, -.319];
        fingers = [-sign * .269, .944, .157];
        palmSide = [sign * .012, .164, -.985];
      } else if (mode === "chinChest") {
        wrist = add(p.head, [sign * .106, -.061, -.089]);
        pole = [sign * .87, .149, .081];
        fingers = [sign * -.32, -.201, -.889];
      }
      arm(p, side, wrist, pole, fingers, palmSide);
      p[side + "FingerCurl"] = curl;
      p[side + "FingerSpread"] = spread;
      p[side + "ThumbExtend"] = thumb;
    }
    return p;
  };
}
