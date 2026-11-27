import { add, arm, blend, leg, mix, scale, sides, stand, subtract, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const minimum = Math.min(...values);
  const width = Math.max(.05, Math.max(...values) - minimum);
  return frame => clamp((read(frame) - minimum) / width);
}

export function yogaStandingGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const hipDepth = range(frames, f => f[2][1]);
  const shoulderDepth = range(frames, f => f[1][1]);
  const leadTilt = range(frames, f => f[1][0] - f[2][0]);
  const ankleUp = [8,10].map(index => range(frames, f => -f[index][1]));
  const handsUp = [4,6].map(index => range(frames, f => -f[index][1]));
  const floor = profile.mat ? .024 : 0;

  return phase => {
    const f = guideAt(frames, phase);
    const breath = .010 * Math.sin(4 * Math.PI * phase);
    const bent = hipDepth(f);
    const fold = shoulderDepth(f);
    const feetUp = Math.max(ankleUp[0](f), ankleUp[1](f));
    const move = mode === "warrior1" || mode === "warrior2" || mode === "reverse" || mode === "humble";
    const balance = mode === "tree" || mode === "dancer" || mode === "warrior3" || mode === "moon";
    const split = mode === "warrior1" || mode === "pyramid" || mode === "humble";
    const lead = balance && ankleUp[0](f) > ankleUp[1](f) ? -1 : 1;
    const stance = split || mode === "triangle" ? 1 : move ? bent : 0;
    const y = mode === "chair" ? mix(.916, profile.deep ? .520 : .648, bent) : mode === "garland" ? mix(.916, .448, bent)
      : move ? mix(.898, .670, bent) : mode === "pyramid" || mode === "triangle" ? .809 : mode === "moon" ? .895 - .11 * feetUp
      : mode === "eagle" ? .890 - .191*bent : .907 + breath;
    const lean = mode === "dancer" ? .13 + .79 * feetUp : mode === "warrior3" || mode === "moon" ? 1.50 * feetUp
      : mode === "pyramid" || mode === "humble" || mode === "halfBend" || mode === "halfSalute" ? 1.52 * fold
      : mode === "chair" ? .119+.249*bent : mode === "reverse" ? -.119 * fold : .028;
    const sideLean = profile.crescent ? 1.19 * (leadTilt(f) - .5)
      : mode === "triangle" ? .89 * fold : mode === "reverse" ? -.35 * (1 - fold) : 0;
    const torsoCenter = [mode === "warrior2" || mode === "reverse" ? .191 * stance : balance ? .099 * lead * feetUp : 0, y,
      mode === "chair" ? -.123*bent : 0];
    const pose = stand(torsoCenter, lean, mode === "moon" ? 1.18 * feetUp : 0, sideLean);
    if (mode === "moon") {
      pose[lead > 0 ? "ls" : "rs"][1] -= .247 * feetUp;
      pose.chest[1] -= .100 * feetUp;
    }

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const index = near ? 0 : 1;
      const anchor = sign === lead;
      const shoulder = pose[side + "s"];
      let foot = [sign * .115, .085 + floor, .029];
      let toe = [sign * .013, -.065, .131];
      let knee = [sign * .088, .080, .97];
      let planted = true;
      if (split) {
        foot = [sign * .130, .088 + floor, near ? .411 : -.469];
        toe = [sign * (near ? .013 : .097), -.063, .121];
        if (mode === "pyramid") foot[2] = near ? .419 : -.419;
        if (mode === "warrior1") {
          const rearTrack = Math.sqrt(Math.max(.04, .833 ** 2 - (y - foot[1]) ** 2));
          foot[2] = near ? mix(.14, .421, bent) : -rearTrack;
        }
      } else if (mode === "warrior2" || mode === "reverse" || mode === "triangle") {
        foot = [sign * (.271 + .235 * stance), .087 + floor, near ? .102 : -.068];
        if (!near && mode !== "triangle") {
          const rearTrack = Math.sqrt(Math.max(.04, .834 ** 2 - (y - foot[1]) ** 2 - foot[2] ** 2));
          foot[0] = pose[side + "h"][0] - rearTrack;
        }
        if (mode === "triangle") foot[0] = sign * .481;
        knee = [near ? .801 : -.290, .022, .69];
        toe = [sign * (near ? .119 : .071), -.064, .065];
      } else if (balance && !anchor) {
        planted = feetUp < .005;
        const legLift = mode === "tree" ? [lead * .008, .437 + .234 * feetUp, -.021] : mode === "moon" ? [-.842, .686, -.062]
          : mode === "dancer" ? [sign * .114, .652 + .547 * feetUp, -.459 + .204 * feetUp] : [sign * .121, .913, -.826];
        foot = blend(foot, legLift, feetUp);
        knee = mode === "tree" ? [sign * .992, .104, .042] : mode === "dancer" ? [sign * .053, .152, -1] : [sign * .077, -.789, -.07];
        toe = mode === "tree" ? [-lead * .095, -.094, .012] : [sign * .015, -.031, -.13];
      } else if (mode === "eagle" && sign === -1) {
        foot = blend(foot, [.224, .245, -.154], feetUp);
        knee = [.901, .031, .55];
        planted = feetUp < .005;
      } else if (mode === "garland") {
        foot = [sign * .244, .086 + floor, .079];
        toe = [sign * .091, -.061, .101];
        knee = [sign * .597, .08, .817];
      }
      leg(pose, side, foot, knee, toe, planted ? floor : undefined);

      const rest = add(shoulder, [sign * .056, -.608, .033]);
      let wrist = rest;
      let fingers = [0, -.978, .023];
      let elbow = [sign * .78, -.37, -.514];
      let palm = [sign, .014, .026];
      if (mode === "chair" || mode === "warrior1" || profile.crescent || mode === "warrior3") {
        const rise = profile.crescent ? .94 : mode === "warrior3" ? Math.max(.594, handsUp[index](f)) : handsUp[index](f);
        const reach = mode === "warrior3" ? add(shoulder, [sign * .027, .601 * (1 - feetUp), .592 * feetUp])
          : add(shoulder, [sign * (profile.crescent ? -.179 : -.021), .598, -.046]);
        wrist = blend(rest, reach, rise);
        fingers = [0, .995 * (1 - feetUp), .95 * feetUp + .048];
      } else if (mode === "warrior2" || mode === "reverse" || mode === "triangle") {
        const high = mode === "reverse" && near || mode === "triangle" && !near;
        const low = mode === "reverse" && !near || mode === "triangle" && near;
        wrist = high ? add(shoulder, [sign * .214, .573, .028]) : low ? add(pose[side + "k"], [sign * .026, -.078, .03])
          : add(shoulder, [sign * .609, .020, .027]);
        fingers = high ? [sign * .227, .95, .039] : low ? [sign * .23, -.954, .022] : [sign, .015, .037];
      } else if (mode === "pyramid" || mode === "halfBend") {
        const shin = blend(pose[side + "k"], pose[side + "a"], mode === "pyramid" ? .63 : .184);
        wrist = blend(rest, add(shin, [sign * .027, .038, .051]), fold);
      } else if (mode === "halfSalute") {
        const reach = handsUp[index](f);
        const overhead = add(shoulder, [sign * .018, .607, 0]);
        wrist = fold > .45 ? blend(rest, [sign * .136, .068, .242], clamp((fold - .45) * 1.9)) : blend(rest, overhead, reach);
        fingers = [0, fold > .45 ? -.97 : .97, .061];
      } else if (mode === "garland") {
        wrist = blend(rest, add(pose.chest, [sign * .029, .071, .266]), bent);
        elbow = [sign * .857, -.635, .101];
        fingers = [0, 1, .043];
      } else if (mode === "humble") {
        wrist = add(pose.chest, [sign * .024, .098 + .481 * fold, -.412]);
        fingers = [-sign * .971, .03, .036];
      } else if (mode === "tree" || mode === "eagle") {
        const tied = mode === "eagle" ? .240 * feetUp : 0;
        wrist = blend(rest, add(pose.chest, [sign * .029, .108 + tied, .301]), feetUp);
        fingers = [0, .992, .064];
        elbow = mode === "eagle" ? [-sign * .50, -.41, .85] : [sign * .68, -.53, .11];
      } else if (mode === "dancer") {
        wrist = anchor ? add(shoulder, [sign * .051, -.079, .583])
          : add(pose[side + "a"], [sign * .025, .028, .021]);
        wrist = blend(rest, wrist, feetUp);
        fingers = [0, -.039, anchor ? 1 : -.99];
      } else if (mode === "moon") {
        const down = anchor;
        wrist = blend(rest, down ? [shoulder[0] + .037, floor + .066, shoulder[2] + .019]
          : add(shoulder, [sign * .089, .603, .052]), feetUp);
        fingers = [0, down ? -.025 : 1, down ? .991 : .061];
      } else if (mode === "mountain" || mode === "neutral") {
        const drop = .036 * shoulderDepth(f);
        pose[side + "s"][1] -= drop;
        wrist[1] -= drop;
        palm = mode === "mountain" ? [-sign, .021, 0] : [sign, .01, 0];
      }
      arm(pose, side, wrist, elbow, fingers, palm);
      if (mode === "eagle") {
        const upper = unit(blend(unit(subtract(pose[side + "e"], shoulder)), [-sign * .82, -.253 + sign * .10, .72], feetUp));
        const lower = unit(blend(unit(subtract(pose[side + "w"], pose[side + "e"])), [sign * .23, .94, .19], feetUp));
        pose[side + "e"] = add(shoulder, scale(upper, .252));
        pose[side + "w"] = add(pose[side + "e"], scale(lower, .371));
      }
    }
    return pose;
  };
}
