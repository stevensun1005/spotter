import { add, arm, blend, leg, mix, rep, scale, sides, stand, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const deck = .024;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
function normalize(frames, read) {
  const values = frames.map(read);
  const anchor = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - anchor);
  return f => clamp((read(f) - anchor) / span);
}

export function referenceCoreGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const neckHeight = normalize(frames, f => -f[1][1]);
  const hipHeight = normalize(frames, f => -f[2][1]);
  const legShift = normalize(frames, f => (f[8][0] + f[10][0]) * .5);
  const knee = [7, 9].map(index => normalize(frames, f => -f[index][1]));
  const ankles = [8, 10].map(index => normalize(frames, f => -f[index][1]));
  const isProne = ["proneNeck", "proneRest", "bow"].includes(mode);
  const isBreathing = mode === "breath" || mode === "tilt";
  const isRollover = mode === "rollover" || mode === "openRoller" || mode === "rollBack" || mode === "rollV" || mode === "plow";
  const seated = mode === "tuckUp" || mode === "vTap";
  const supineAngle = -Math.PI / 2;

  return phase => {
    const f = guideAt(frames, phase);
    const lift = neckHeight(f);
    const reach = rep(phase, .34, .57);
    const high = hipHeight(f);
    const lateral = legShift(f) * 2 - 1;
    const raised = Math.max(ankles[0](f), ankles[1](f));
    const first = Math.sin(phase * Math.PI * 2);
    const active = phase < .5 ? 1 : -1;
    const pulse = Math.cos(phase * 4 * Math.PI);
    const rolling = isRollover ? mode === "rollover" || mode === "plow" ? high : Math.max(.02, high * .91, (1 - lift) * .81) : 0;
    const rollLift = mode === "rollV" ? Math.max(0, 1 - Math.abs(phase - .286) * 8.6) : rolling;
    const vRise = mode === "rollV" ? Math.max(0, 1 - Math.abs(phase - .642) * 5.7) : 0;
    const pelvis = [mode === "corkscrew" ? .068 * lateral : 0, isRollover ? .146 + (mode === "plow" ? .457 : .365) * rollLift
      : mode === "tilt" ? .151 + .052 * reach : mode === "corkscrew" ? .140 + .148 * high : mode === "shoulderStand" ? .143 + .426 * lift : .148, mode === "tuckUp" ? -.166 : -.113];
    const angle = isProne ? mode === "bow" ? supineAngle + .67 * reach : supineAngle + .016
      : mode === "neckPull" || mode === "rollUp" ? supineAngle + 1.62 * lift
      : mode === "hundred" ? -1.13 : mode === "altReach" ? supineAngle + 1.12 * lift
      : mode === "verticalReach" ? -1.39 + .48 * lift : mode === "doubleStretch" ? -1.16 + .36 * lift
      : seated ? -.61 + .345 * lift : mode === "alternatingBent" || mode === "alternatingStraight" ? -.998
      : mode === "shoulderStand" ? supineAngle - .951 * lift
      : mode === "rollV" ? -.441 - 1.83 * rollLift
      : isRollover ? supineAngle - (mode === "plow" ? .885 : .71) * rollLift + (mode === "rollover" || mode === "plow" ? 0 : 1.443 * lift) : supineAngle;
    const twist = mode === "altReach" ? active * .50 * lift : 0;
    const pose = isProne ? torso(pelvis, angle, Math.PI)
      : twist ? stand(pelvis, angle, twist, active * .18 * lift) : torso(pelvis, angle, 0);
    const neckLift = mode === "proneNeck" ? .051 * reach : 0;
    if (mode === "proneNeck") {
      pose.head[1] += neckLift;
      pose.head[2] -= .039 * reach;
      pose.headAim = [0, .06 + .29 * reach, -1];
      pose.headDrop = -.06 + .021 * reach;
    } else if (mode === "proneRest") {
      pose.headDrop = -.045 + .004 * pulse;
      pose.chest[1] += .018 * reach;
      pose.neck[1] += .008 * reach;
    } else if (isBreathing) {
      const deep = .022 * reach;
      pose.chest[1] += deep;
      pose.neck[1] += deep * .41;
      for (const [side] of sides) pose[side + "s"][1] += deep * .61;
    } else if (mode === "corkscrew") {
      pose.headDrop = .041;
    }

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const index = near ? 0 : 1;
      const highAnkle = ankles[index](f);
      const folded = knee[index](f);
      const locked = mode === "toeTap";
      const free = mode === "alternatingBent" || mode === "alternatingStraight";
      const opposing = near ? first : -first;
      const switchAmount = free ? clamp(.5 + .69 * opposing) : 0;
      const tile = .5 + .5 * lateral;
      let toe = [sign * .014, .096, .082];
      let foot = [sign * .139, .114, .692];
      let pole = [sign * .12, .925, -.095];
      let plant = false;
      if (isProne) {
        pose[side + "h"][0] = -sign * .103;
        foot = [-sign * .142, mode === "bow" ? .113 + .538 * reach : .105, mode === "bow" ? mix(.719, .251, reach) : .712];
        toe = [-sign * .019, -.045, .124];
        pole = [-sign * .075, -.955, .107];
      } else if (isBreathing || mode === "triceps") {
        foot = [sign * .144, .109, .331];
        toe = [sign * .012, -.065, .130];
        pole = [sign * .125, .975, .026];
        plant = true;
      } else if (mode === "verticalReach" || mode === "altReach" || mode === "corkscrew" || mode === "shoulderStand") {
        const arc = mode === "corkscrew" ? .60 * lateral : 0;
        const z = mode === "corkscrew" ? .047 + .56 * (1 - high) * Math.abs(lateral) : .091 - (mode === "shoulderStand" ? .17 * lift : 0);
        const direction = unit([sign * .022 + arc, .57 + .29 * high, z]);
        foot = add(pose[side + "h"], scale(direction, .837));
        toe = [arc * .15, .122, .058];
        pole = [sign * .052, -.044, .962];
      } else if (locked) {
        const planted = 1 - highAnkle;
        foot = [sign * .144, mix(.498, .119, planted), mix(.155, .363, planted)];
        toe = [sign * .013, -.082, .112];
        pole = [sign * .061, .996, -.031];
        plant = planted > .99;
      } else if (free) {
        foot = mode === "alternatingStraight" ? [.149 * sign, mix(.187, .941, switchAmount), mix(.702, .029, switchAmount)]
          : [.139 * sign, mix(.179, .371, switchAmount), mix(.731, .098, switchAmount)];
        toe = [sign * .013, .075, .110];
        pole = mode === "alternatingStraight" ? [sign * .062, -.43, .90] : [sign * .12, .983, -.045];
      } else if (mode === "doubleStretch" || mode === "tuckUp" || mode === "hundred") {
        const bend = mode === "doubleStretch" ? folded : mode === "tuckUp" ? highAnkle : profile.straight ? .084 : .284;
        const engage = mode === "hundred" ? .479 : 0;
        foot = [sign * .139, mix(.212 + engage, .382, bend), mix(.725 - engage * .37, .142, bend)];
        pole = [sign * .085, .958, -.092];
      } else if (mode === "vTap") {
        foot = [sign * .141, .684 + .075 * lift, .392];
        pole = [sign * .019, -.631, .75];
      } else if (mode === "rollBack") {
        foot = [sign * .128, .292 + .401 * rolling, .258 - .309 * rolling];
        pole = [sign * .086, .974, -.083];
      } else if (mode === "rollV") {
        const folded = [sign * .129, .107, .391];
        const lifted = add(pose[side + "h"], [sign * .018, .623, -.499]);
        const sitting = add(pose[side + "h"], [sign * .03, .693, .454]);
        foot = blend(blend(folded, sitting, vRise), lifted, rollLift);
        pole = [sign * .073, .785, .103];
      } else if (mode === "rollover" || mode === "openRoller" || mode === "plow") {
        const width = mode === "openRoller" ? .284 : .008 + .108 * tile;
        const along = mode === "plow" ? .033 + (1.59 + .84 * (1 - raised)) * rollLift
          : mode === "openRoller" ? .928 + 1.433 * rollLift : 1.49 + 1.52 * rollLift;
        const angle = mode === "plow" && rollLift > .73 && raised < .55 ? 3.77 : along;
        const ray = unit([sign * width, Math.sin(angle), Math.cos(angle)]);
        foot = add(pose[side + "h"], scale(ray, .839));
        pole = [sign * .118, -.61, .782];
        if (mode === "plow" && rollLift > .73 && raised < .55) {
          toe = [sign * .019, -.077, -.116];
          plant = true;
        }
      }
      leg(pose, side, foot, pole, toe, plant ? deck : undefined);
    }

    for (const [side, sign] of sides) {
      const near = sign > 0;
      const index = near ? 0 : 1;
      const shoulder = pose[side + "s"];
      const activeLeg = first > 0 ? "l" : "r";
      let wrist = [sign * .231, .065, -.129];
      let pole = [sign * .56, -.68, -.399];
      let fingers = [0, -.036, .997];
      if (isProne) {
        wrist = [-sign * .224, .072, -.177];
        if (mode === "bow") wrist = blend(wrist, add(pose[side + "a"], [sign * .025, .044, -.066]), reach);
      } else if (isBreathing) {
        wrist = add(pelvis, [sign * .075, .132 + .021 * reach, -.136]);
        fingers = [-sign * .68, -.075, .716];
      } else if (mode === "alternatingBent" || mode === "alternatingStraight") {
        const target = mode === "alternatingStraight" ? blend(pose[activeLeg + "k"], pose[activeLeg + "a"], .42 + .028 * pulse) : pose[activeLeg + "k"];
        wrist = add(target, [sign * .060, .036, .074]);
        fingers = [-sign * .833, -.089, -.511];
      } else if (mode === "neckPull") {
        const head = add(pose.head, [sign * .093, -.021, -.091]);
        wrist = lift < .86 ? head : blend(head, add(shoulder, [sign * .087, -.225, .567]), (lift - .86) / .14);
        fingers = [sign * .054, .188, -.982];
      } else if (mode === "rollUp") {
        wrist = blend(add(shoulder, [sign * .041, .087, -.561]), [sign * .154, .111, .682], lift);
      } else if (mode === "hundred") {
        const beat = pulse * .014 + Math.sin(phase * Math.PI * 20) * .061;
        wrist = [sign * .227, .147 + beat, .16];
        pole = [sign * .115, -.51, -.81];
        fingers = [sign * .043, -.063, .997];
      } else if (mode === "altReach") {
        wrist = blend(add(shoulder, [sign * .052, .598, .056]), add(pose[near ? "rt" : "lt"], [sign * .041, -.058, -.019]), lift * (sign === active ? 1 : .15));
      } else if (mode === "verticalReach" || mode === "vTap") {
        wrist = blend(add(shoulder, [sign * .059, .573, .066]), add(pose[side + "t"], [sign * .031, -.034, -.069]), lift);
        fingers = [0, .949, .312];
      } else if (mode === "doubleStretch") {
        wrist = blend(add(shoulder, [sign * .11, .028, -.59]), add(pose[side + "k"], [sign * .054, .064, .033]), knee[index](f));
      } else if (mode === "rollBack" || mode === "openRoller") {
        wrist = add(mode === "rollBack" ? pose[side + "k"] : pose[side + "a"], [sign * .055, .038, -.036]);
      } else if (mode === "rollV") {
        wrist = blend(add(shoulder, [sign * .13, -.122, .483]), add(pose[side + "t"], [sign * .064, .047, -.042]), raised);
      } else if (mode === "tuckUp") {
        wrist = [sign * .233, .071, -.356];
      } else if (mode === "shoulderStand") {
        wrist = add(pelvis, [sign * .120, -.047, -.058]);
        fingers = [-sign * .27, .82, .501];
      } else if (mode === "triceps") {
        const target = near ? add(pose.head, [sign * .099, -.014, -.169]) : add(pose.ls, [.032, .332, -.098]);
        wrist = blend(add(shoulder, [sign * .132, -.055, .485]), target, reach);
        pole = [sign * .56, .93, -.104];
        fingers = [0, -.041, -.999];
      }
      arm(pose, side, wrist, pole, fingers);
    }
    return pose;
  };
}
