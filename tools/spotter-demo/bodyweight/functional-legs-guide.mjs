import { add, arm, blend, leg, mix, sides, stand } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
function normalize(frames, read) {
  const ns = frames.map(read);
  const low = Math.min(...ns);
  const span = Math.max(.05, Math.max(...ns) - low);
  return frame => clamp((read(frame) - low) / span);
}

export function functionalLegsGuideMotion(guide, profile) {
  const { frames } = guide;
  const mode = profile.mode;
  const source0 = frames[0];
  const bodyDrop = normalize(frames, f => f[2][1]);
  const bodyX = normalize(frames, f => f[2][0]);
  const chestHinge = normalize(frames, f => Math.abs(f[1][0] - f[2][0]));
  const feetLift = [8, 10].map(index => normalize(frames, f => -f[index][1]));
  const supportAnkle = .084;
  const rootX = profile.fixedRear ? Math.max(source0[8][0], source0[10][0]) - 7 : source0[2][0];
  const bigLunge = ["frontLunge", "rearLunge", "crossLunge", "chainLunge", "kneeLunge", "liftLunge", "kickLunge", "sprintLunge", "reachLunge"].includes(mode);
  const unilateral = ["hinge", "figure", "single", "skater", "shrimp", "heel", "singleRaise", "knees", "soldier"].includes(mode);
  const singleHand = mode === "shrimp" || mode === "heel";

  return phase => {
    const f = guideAt(frames, phase);
    const drop = bodyDrop(f);
    const hinge = chestHinge(f);
    const travel = (f[2][0] - rootX) * .0097;
    const sideTravel = bodyX(f) * 2 - 1;
    const breathe = profile.breathe ? .008 * Math.sin(4 * Math.PI * phase) : 0;
    const standing = mode === "single" || mode === "skater" || mode === "shrimp" || mode === "heel";
    const squatting = mode === "squat";
    const amount = mode === "figure" ? feetLift[1](f) : drop;
    const chainSide = mode === "chainLunge" && !profile.noSide ? Math.max(0, 1 - Math.abs(phase - .5) * 6.1) : 0;
    const hipY = profile.startY - (bigLunge ? .381 * drop : standing || squatting ? (profile.depth ?? .388) * drop : mode === "figure" ? (profile.depth ?? .21) * drop
      : mode === "hinge" ? .066 * hinge : mode === "wideHop" ? .114 * drop - .282 * (1 - drop) : mode === "singleRaise" ? -.141 * feetLift[0](f) : .05 * drop) + breathe;
    const hips = [bigLunge ? .357 * sideTravel * chainSide : mode === "wideHop" ? .357 * sideTravel : unilateral && mode !== "knees" && mode !== "soldier" ? .076 : 0,
      hipY, bigLunge ? travel * (1 - chainSide) : mode === "hinge" || standing || squatting || mode === "figure" ? -.064 - .139 * (mode === "hinge" ? hinge : drop) : -.021];
    const pitch = mode === "hinge" ? .026 + 1.50 * hinge : mode === "figure" ? .057 + .39 * drop
      : mode === "heel" ? .07 + .963 * drop : mode === "skater" ? .07 + .65 * drop : standing || squatting ? .08 + .41 * drop : .047 + (mode === "sprintLunge" ? .307 : .121) * drop;
    const pivot = mode === "reachLunge" ? (phase < .5 ? 1 : -1) * .90 * Math.max(0, 1 - Math.abs(.25 - phase % .5) * 8) : 0;
    const poses = sides.map(([side, sign], i) => {
      const primary = sign === 1;
      let foot = [sign * (profile.width ?? .133), supportAnkle, .05];
      let toe = [sign * .012, -.064, .131];
      let pole = [sign * .17, .022, .977];
      let ground = true;
      const marker = f[8 + i * 2];
      const walk = (marker[0] - rootX) * .0096;
      const lift = feetLift[i](f);
      if (bigLunge) {
        const lifted = Math.max(0, (151 - marker[1]) * .0132);
        foot = [sign * (profile.width ?? .129) + Math.max(0, (mode === "crossLunge" ? 1 : 0) * (walk - .001)) * (sign < 0 ? 1.11 : 0),
          supportAnkle + lifted * (mode === "kickLunge" ? 1 : .66), walk * (1 - chainSide * .95)];
        const moving = sign < 0 || mode === "frontLunge" || mode === "sprintLunge" || mode === "reachLunge";
        if (chainSide && moving && sign < 0) foot[0] -= .649 * drop * chainSide;
        if (moving && ["kneeLunge", "liftLunge", "kickLunge", "chainLunge"].includes(mode) && lifted > .17 && chainSide < .1) {
          const liftPose = clamp((lifted - .18) / .52);
          if (mode === "liftLunge") {
            foot[2] = hips[2] - .837 * Math.sin(liftPose * 1.07);
            foot[1] = supportAnkle + .83 * (1 - Math.cos(liftPose * 1.07));
            pole = [sign * .05, .037, .99];
          } else if (mode === "kickLunge") {
            const kick = Math.max(0, 1 - Math.abs((lifted - .82) / .72));
            foot[2] = hips[2] + .83 * Math.sin(kick * 1.35);
            foot[1] = supportAnkle + .819 * (1 - Math.cos(kick * 1.35));
          } else {
            foot[2] = hips[2] + .541 * liftPose;
          }
        }
        if (mode === "crossLunge") {
          foot[2] = primary ? .171 : -.535 * clamp((marker[0] - source0[10][0]) / 42);
          ground = foot[1] < .105;
        } else ground = lifted < .025;
        if (!ground && foot[2] < hips[2] - .15) toe = [sign * .012, -.112, .096];
      } else if (!primary && mode === "hinge") {
        foot = [sign * .117, hips[1] - .83 * Math.cos(hinge * 1.56), hips[2] - .835 * Math.sin(hinge * 1.56)];
        const drive = profile.kneeDrive ? Math.max(0, (marker[0] - source0[10][0]) * .024) : 0;
        foot = blend(foot, [sign * .161, .521, .538], drive);
        pole = [sign * .117, drive, .962];
        toe = blend(toe, [sign * .021, -.064, -.119], hinge);
        ground = false;
      } else if (mode === "singleRaise") {
        foot = primary ? [.113, .089 + .134 * lift, .179 - .115 * lift] : [-.139, .166, -.415];
        toe = primary ? [sign * .011, -.068 - .134 * lift, .132 - .111 * lift] : [sign * .021, -.138, .076];
        ground = !primary || lift < .014;
      } else if (mode === "knees" || mode === "soldier") {
        const angle = mode === "soldier" ? 1.49 * lift : 0;
        foot[1] += mode === "soldier" ? .83 * (1 - Math.cos(angle)) : .479 * lift;
        foot[2] += mode === "soldier" ? .839 * Math.sin(angle) : .575 * lift;
        ground = lift < .014;
      } else if (mode === "wideHop") {
        foot[0] = sign * mix(.321, .512, drop) + (1 - drop) * .198 * sideTravel;
        foot[1] += .338 * (1 - drop);
        pole = [sign * .248, .019, .976];
        ground = drop > .985;
      } else if (!primary && standing) {
        const back = mode === "skater" || mode === "shrimp" || mode === "heel";
        if (mode === "shrimp") {
          foot = [sign * .132, hipY - .127, hips[2] - .301];
          pole = [sign * .036, -.935, .35];
        } else if (mode === "skater" || mode === "heel") {
          foot = [sign * .133, .535 - .247 * drop, hips[2] - .598 + .027 * drop];
          pole = [sign * .040, -.93, -.35];
        } else foot = [sign * .133, .257 - profile.depth * .135 * drop, .513 + .11 * drop];
        ground = false;
        if (back) toe = [sign * .012, -.105, -.071];
      }
      return { sign, side, foot, pole, toe, ground };
    });
    for (const { sign, foot, ground } of poses) {
      if (!ground) continue;
      const radius = Math.hypot(foot[0] - hips[0] - sign * .103, foot[2] - hips[2]);
      hips[1] = Math.min(hips[1], foot[1] + Math.sqrt(Math.max(.10, .835 ** 2 - radius ** 2)));
    }
    const p = stand(hips, pitch, pivot, mode === "wideHop" ? -.13 * sideTravel : 0);
    for (const { side, sign, foot, pole, toe, ground } of poses) {
      if (mode === "figure" && sign < 0) continue;
      leg(p, side, foot, pole, toe, ground ? 0 : undefined);
    }
    if (mode === "figure") {
      const supportKnee = p.lk;
      const foot = blend([-.114, .087, .040], add(supportKnee, [.007, .096, .020]), profile.beginCrossed ? 1 : amount);
      const toe = [0.120, -.051, .066];
      leg(p, "r", foot, [-.973, .117, .198], toe, amount < .012 && !profile.beginCrossed ? 0 : undefined);
    }
    for (const [side, sign] of sides) {
      const shoulder = p[side + "s"];
      const external = sign < 0;
      const isBalance = standing || squatting || mode === "figure";
      let wrist = add(hips, [sign * .164, .102, .103]);
      let pole = [sign * .745, -.471, -.37];
      let fingers = [sign * .04, -.86, .51];
      if (mode === "reachLunge") {
        const reach = clamp(drop * 1.5);
        wrist = add(shoulder, [sign * .041 + Math.sin(pivot) * .19, -.593 + 1.171 * reach, .109]);
        pole = [sign * .601, -.623, -.17];
        fingers = [0, -1 + 2.01 * reach, .05];
      } else if (mode === "sprintLunge") {
        const stride = Math.sign(p.la[2] - p.ra[2]);
        const swing = drop * stride * sign;
        wrist = add(shoulder, [sign * .091, -.37 - .182 * swing, .057 - .422 * swing]);
        pole = [sign * .32, -.79, -.47];
        fingers = [0, -.061, swing > .02 ? -.99 : .99];
      } else if (isBalance || mode === "soldier") {
        wrist = add(shoulder, [sign * .052, -.081, .572]);
        pole = [sign * .527, -.374, -.54];
        if (singleHand) {
          const point = mode === "shrimp" ? p.ra : p.la;
          if (external || mode === "heel") wrist = blend(wrist, add(point, [sign * .056, .052, -.065]), mode === "shrimp" ? 1 : drop);
        }
        fingers = [0, -.073, .997];
      } else if (mode === "hinge") {
        wrist = add(shoulder, [sign * .050, -.59 + .009 * hinge, .066]);
        pole = [sign * .401, -.67, -.39];
        fingers = [0, -.99, .034];
      }
      arm(p, side, wrist, pole, fingers);
    }
    return p;
  };
}
