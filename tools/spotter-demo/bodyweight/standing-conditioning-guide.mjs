import { add, arm, blend, leg, mix, scale, sides, smooth, stand, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function normalized(frames, read) {
  const values = frames.map(read);
  const low = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - low);
  return f => clamp((read(f) - low) / span);
}

function rotate([x, y, z], angle) {
  return [x * Math.cos(angle) + z * Math.sin(angle), y, z * Math.cos(angle) - x * Math.sin(angle)];
}

export function standingConditioningGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const left = profile.side === "left";
  const sideSign = left ? 1 : -1;
  const index = left ? 0 : 1;
  const original = frames[0];
  const ankleHeight = normalized(frames, f => -f[8 + index * 2][1]);
  const ankleLead = normalized(frames, f => f[8 + index * 2][0]);
  const hipLevel = normalized(frames, f => -f[2][1]);
  const trackedHand = profile.rightMarker ? 6 : 4 + index * 2;
  const wristLead = normalized(frames, f => f[trackedHand][0]);
  const wristLevel = normalized(frames, f => -f[trackedHand][1]);
  const maxHand = normalized(frames, f => -f[4][1] - f[6][1]);
  const footBase = .094;
  const appliesKick = ["snap", "heel", "axe", "hookKick", "roundKick", "sideKick", "spinHook", "spinBack"].includes(mode);
  const appliesTravel = ["step", "skater", "stride", "backHop"].includes(mode);

  return phase => {
    const f = guideAt(frames, phase);
    const h = f[2];
    const l = f[8];
    const r = f[10];
    const kick = appliesKick ? Math.max(ankleHeight(f), .58 * ankleLead(f)) : 0;
    const extension = appliesKick ? ankleLead(f) : 0;
    const punch = !appliesKick ? wristLead(f) : 0;
    const drive = mode === "hook" || mode === "upper" ? .74 * Math.max(punch, .31 * wristLevel(f)) : mode === "jab" ? .31 * punch : mode === "cross" ? .78 * punch : 0;
    const spin = mode === "spinHook" || mode === "spinBack";
    const pivotStart = smooth((phase - .10) / .24);
    const pivotEnd = 1 - smooth((phase - .66) / .25);
    const pivot = spin ? pivotStart * pivotEnd * Math.PI * (mode === "spinHook" ? 1.01 : 1.0)
      : mode === "roundKick" ? -1.41 * kick : mode === "sideKick" ? -1.21 * kick : 0;
    const baseYaw = appliesTravel || mode === "boxShuffle" ? 0 : -.18;
    const yaw = baseYaw + (appliesKick ? pivot : -sideSign * drive);
    const height = appliesTravel ? profile.height + .247 * hipLevel(f) : profile.height - (mode === "upper" ? .108 * (1 - hipLevel(f)) : 0);
    const lateral = appliesTravel && mode !== "stride" && mode !== "backHop" || mode === "boxShuffle" ? (h[0] - (profile.pathCenter ?? original[2][0])) * .0106 : -.051 * sideSign * kick;
    const fore = mode === "stride" || mode === "backHop" ? (h[0] - (profile.pathCenter ?? original[2][0])) * .011 : .058 * punch;
    const hips = [lateral, height, fore];
    const pitch = mode === "skater" ? .44 * (1 - hipLevel(f)) : mode === "backHop" ? .25 * (1 - hipLevel(f)) : mode === "spinBack" ? .43 * kick
      : mode === "heel" ? -.27 * kick : mode === "sideKick" ? .093 + .341 * kick : .036;
    const p = stand(hips, pitch, yaw, mode === "sideKick" ? .21 * kick : -.032 * punch * sideSign);
    const forearmSide = mode === "block" ? maxHand(f) : 0;

    for (const [side, sign] of sides) {
      const move = sign === sideSign;
      const guideFoot = sign > 0 ? l : r;
      const travelDepth = (guideFoot[0] - h[0]) * .011;
      const toeLift = Math.max(0, (153 - guideFoot[1]) * .011);
      const isOpen = mode === "step" || mode === "skater" || mode === "boxShuffle";
      const support = [.128 * sign, 0, mode === "boxShuffle" ? 0 : sign > 0 ? .235 : -.419];
      let ankle = [support[0], footBase, support[2]];
      let toe = [sign * .019, -.067, .132];
      let pole = rotate([sign * .143, .021, .982], pivot);
      let plant = true;
      if (appliesTravel || mode === "boxShuffle") {
        if (isOpen) ankle = [lateral + sign * Math.max(.123, sign * travelDepth), footBase + toeLift, mode === "skater" ? -.402 * (toeLift / .51) : .035];
        else ankle = [sign * .134, footBase + toeLift, fore + travelDepth];
        plant = toeLift < .026;
        if (mode === "step" || mode === "boxShuffle") toe = [sign * .015, -.079, .112];
      } else if (appliesKick) {
        if (move) {
          const lifted = mode === "axe" ? Math.max(kick, extension * .32) : kick;
          const chamber = [.146 * sign, .09 + .455 * lifted, .174 + .011 * sign];
          let stroke = [.109 * sign, -.292, .761];
          if (mode === "axe") {
            const highPoint = smooth((phase - .16) / .17) * (1 - smooth((phase - .44) / .33));
            stroke = [.089 * sign, mix(-.401, .754, highPoint), mix(.593, .351, highPoint)];
          } else if (mode === "sideKick") stroke = [.596 * sign, .104, .567];
          else if (mode === "roundKick") stroke = [.478 * sign, .087, .612];
          else if (mode === "spinBack") stroke = [.114 * sign, -.085, -.816];
          else if (mode === "spinHook") stroke = [.392 * sign, .168, -.692];
          else if (mode === "hookKick") stroke = [.311 * sign * (phase > .5 ? -1 : 1), .091, .739];
          else if (mode === "heel") stroke = [.11 * sign, -.131, .816];
          else if (!profile.low) stroke = [.117 * sign, -.091, .822];

          const hit = mode === "axe" ? lifted : smooth((extension - .28) / .66);
          const low = [support[0], footBase, support[2]];
          const strokePosition = add(p[side + "h"], rotate(scale(unit(stroke), .839), pivot));
          const folded = add(hips, rotate(chamber, pivot));
          folded[1] = .272 + .471 * lifted;
          const liftedFoot = blend(folded, strokePosition, hit);
          ankle = blend(low, liftedFoot, Math.min(1, lifted * 2.9));
          const footUp = mode === "heel" || mode === "spinBack" || mode === "sideKick" ? .101 : mode === "axe" ? -.033 : -.109;
          toe = blend(toe, rotate([sign * .025, footUp, mode === "spinBack" || mode === "spinHook" ? -.102 : .092], pivot), hit);
          pole = mode === "roundKick" || mode === "hookKick" ? rotate([sign * .697, .28, .659], pivot)
            : rotate([sign * .111, .821, .47], pivot);
          plant = lifted < .006;
        } else {
          ankle = [sign * .128, footBase + .044 * Math.min(1, Math.abs(pivot)), .049 + (left ? -.10 : .18)];
          toe = rotate([sign * .013, -.072 - .05 * Math.min(1, Math.abs(pivot)), .129], pivot);
        }
      } else if (sign < 0) {
        ankle[1] += .038 * punch;
        toe = rotate([sign * .023, -.069 - .036 * punch, .123], -sideSign * drive * .46);
      }
      leg(p, side, ankle, pole, toe, plant ? 0 : undefined);
    }

    for (const [side, sign] of sides) {
      const active = sign === sideSign;
      const shoulder = p[side + "s"];
      let wrist = add(p.neck, rotate([sign * .093, .017, .211], yaw));
      let pole = rotate([sign * .721, -.589, -.33], yaw);
      let fingers = rotate([sign * .035, .761, .632], yaw);
      if (mode === "block") {
        wrist = add(p.head, rotate([sign * mix(.158, .089, forearmSide), -.099 + .144 * forearmSide, .148], yaw));
        pole = rotate([sign * .168, -.972, .13], yaw);
        fingers = rotate([sign * .035, .982, .185], yaw);
      } else if (!appliesTravel && !appliesKick && mode !== "boxShuffle" && active) {
        let aim = add(shoulder, rotate([sign * .054, .068, .599], yaw));
        if (mode === "hook") {
          const sweep = wristLead(f);
          aim = add(shoulder, rotate([sign * (.135 - .503 * sweep), .052, .261 + .262 * sweep], yaw));
          pole = rotate([sign * .904, -.141, .384], yaw);
          fingers = rotate([-sign * .66, .186, .731], yaw);
        } else if (mode === "upper") {
          const rise = smooth((punch - .35) / .63);
          const down = (1 - wristLevel(f)) * (1 - rise);
          const low = add(shoulder, rotate([sign * .082, -.343, .274], yaw));
          const high = add(shoulder, rotate([-sign * .046, .348, .455], yaw));
          aim = high;
          pole = rotate([sign * .36, -.879, -.237], yaw);
          fingers = rotate([0, .92, -.389], yaw);
          wrist = blend(blend(wrist, low, down), aim, rise);
        } else {
          fingers = rotate([0, .062, .998], yaw);
        }
        if (mode !== "upper") wrist = blend(wrist, aim, punch);
      } else if (appliesTravel) {
        const natural = sign * .31 * Math.sin(2 * Math.PI * phase) + (mode === "stride" || mode === "backHop" ? hipLevel(f) * .401 : 0);
        wrist = add(shoulder, [sign * .081, -.343 + Math.max(0, natural) * .352, .098 + natural * .62]);
        pole = [sign * .51, -.672, -.602];
        fingers = [sign * .049, -.685, .727];
      }
      const handSide = rotate([mode === "upper" || mode === "hook" ? 1 : Math.cos(punch * 1.12), active ? .86 * punch : 0, .07], yaw);
      arm(p, side, wrist, pole, fingers, handSide);
      if (active && (mode === "jab" || mode === "cross")) {
        p[side + "w"] = add(p[side + "w"], rotate([0, .015 * punch, .079 * punch], yaw));
      }
      if (!appliesTravel) p[side + "FingerCurl"] = .965;
    }
    return p;
  };
}
