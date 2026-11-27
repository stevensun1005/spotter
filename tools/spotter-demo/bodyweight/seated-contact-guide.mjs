import { add, arm, blend, leg, mix, scale, sides, stand, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = value => Math.min(1, Math.max(0, value));

function range(frames, read) {
  const values = frames.map(read);
  const minimum = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - minimum);
  return frame => clamp((read(frame) - minimum) / span);
}

export function seatedContactGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const pitch = range(frames, f => f[1][1]);
  const shift = range(frames, f => f[2][0]);
  const ankleUp = [8, 10].map(index => range(frames, f => -f[index][1]));
  const kneeUp = [7, 9].map(index => range(frames, f => -f[index][1]));
  const handsHigh = range(frames, f => -f[4][1]);
  const bodySlide = range(frames, f => -f[1][0]);
  const hipDrop = range(frames, f => (f[7][0] + f[9][0]) * .5);
  const reachSide = range(frames, f => f[8][0]);
  const direction = Math.sign(frames[0][8][0] - frames[0][2][0]) || 1;
  const forward = range(frames, f => direction * (f[1][0] - f[2][0]));

  return phase => {
    const f = guideAt(frames, phase);
    const bent = pitch(f);
    const lift = ankleUp[0](f);
    const reachToes = mode === "toe" ? handsHigh(f) : 0;
    const sideShift = mode === "sideCross" ? bodySlide(f) : 0;
    const overhead = mode === "headKnee" && profile.overhead;
    const guidingSide = overhead ? reachSide(f) * 2 - 1 : 0;
    const kneeDrop = mode === "twist90" ? (profile.steady ? 1 - kneeUp[0](f) : hipDrop(f) * 2 - 1) : 0;
    const dropDepth = Math.abs(kneeDrop);
    const rotation = profile.side === "right" ? -1 : 1;
    const swing = 2 * Math.PI * phase;
    const support = ["shoulder", "ankle", "circle", "twist90", "hipTwist", "backQuad", "ankleOut"].includes(mode);
    const fold = ["fold90", "pigeon", "wide", "toe", "headKnee"].includes(mode);
    const hips = [mode === "sideCross" ? .068 * sideShift : 0, mode === "backQuad" ? .191 + .102 * (1 - bent) : .124,
      mode === "walk" ? .332 * (shift(f) - .5) : mode === "shoulder" ? .145 * (forward(f) - .5) : -.151];
    const flex = mode === "toe" ? .98 + .18 * reachToes : mode === "headKnee" ? (overhead ? .14 : .75) * bent : fold ? 1.22 * bent : mode === "boat" ? -.51 * lift
      : mode === "backQuad" ? -.33 - .59 * (1 - bent) : support ? -.57 : .028;
    const setup = profile.setupTurn ? ankleUp[0](f) : 1;
    const turn = mode === "turn" ? rotation * (.246 + .91 * forward(f)) * setup : overhead ? guidingSide * .25 * bent
      : mode === "wide" && profile.side ? rotation * .83 * bent : (mode === "twist90" ? -.64 * kneeDrop : mode === "hipTwist" ? (kneeUp[0](f) - .5) * -.563 : 0);
    const tilt = overhead ? guidingSide * .88 * bent : mode === "walk" ? .047 * Math.sin(2 * swing)
      : mode === "sideCross" ? -.37 * sideShift : 0;
    const pose = stand(hips, flex, turn, tilt);
    if (mode === "walk") pose.headAim = [0, 1, .047];
    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const active = sign === rotation;
      const far = sign < 0;
      const step = ankleUp[index](f);
      const knee = kneeUp[index](f);
      const straight = [sign * .128, .112, .680];
      let target = straight;
      let ray = [sign * .119, .912, .054];
      let toe = [sign * .014, .118, .064];
      let contact = false;
      if (mode === "fold90") {
        target = far ? [-.422, .092, profile.back ? -.429 : -.333] : [-.192, .094, .316];
        ray = far ? [-.92, .094, .16] : [.962, .17, .112];
        toe = far ? [-.106, -.034, -.063] : [-.109, .021, -.066];
      } else if (mode === "pigeon" || mode === "cowFace") {
        target = mode === "cowFace" ? [-sign * .295, far ? .107 : .101, -.122] : [-sign * .326, far ? .174 : .081, .247];
        ray = mode === "cowFace" ? [-sign * .213, far ? .062 : .563, .951] : [sign * .815, far ? .463 : .093, .961];
        toe = mode === "cowFace" ? [-sign * .100, -.032, -.085] : [-sign * .107, .022, .066];
      } else if (mode === "wide" || mode === "headKnee") {
        const wide = mode === "wide" ? .692 : active ? .492 : -.122;
        target = [sign * wide, .106, mode === "wide" ? .447 : active ? .594 : .231];
        ray = [sign * .93, .095, .24];
        if (overhead) {
          const extend = (1 + sign * guidingSide) * .5;
          target = blend([sign * .049, .101, .288], [sign * .714, .105, .294], extend);
          ray = [sign * .935, .045 + .26 * extend, .211];
        }
      } else if (mode === "turn" && active) {
        target = blend([sign * .137, .108, .679], [-sign * .225, .108, .391], setup);
        ray = [sign * .053, .993, -.173];
        toe = [sign * .010, -.061, .130];
        contact = true;
      } else if (mode === "tuck" && active) {
        target = blend(straight, profile.footHold ? [sign * .173, .455, .201] : [sign * .155, .136, .248], Math.max(knee, step));
        ray = [sign * (profile.footHold ? .781 : .061), .91, .091];
        toe = [sign * .011, .030, .132];
      } else if (mode === "circle" && active) {
        const orbit = 4 * Math.PI * phase;
        const amplitude = profile.half ? .325 : .243;
        target = add(pose[side + "h"], scale(unit([sign * .168 + amplitude * Math.sin(orbit), .061 + .213 * step, .968 + .091*Math.cos(orbit)]), .840));
        toe = [sign * .021, .087, .102];
      } else if (mode === "boat") {
        target = blend([sign * .125, .113, .356], add(pose[side + "h"], [sign * .027, .630, .548]), step);
      } else if (mode === "twist90" || mode === "hipTwist") {
        const drop = mode === "twist90" ? kneeDrop : (kneeUp[0](f) - .5) * .81;
        target = [sign * .287, mode === "twist90" ? .110 : .291 + .242 * step, .402 + .041 * knee];
        ray = mode === "twist90" ? [drop * 1.21, .95 - .89 * dropDepth, -.063] : [drop, .63, -.097];
        toe = [drop * .079, mode === "twist90" ? -.064 : -.045, .125];
        contact = mode === "twist90";
      } else if (mode === "kneeDown") {
        target = [sign * .047, .096, .379];
        ray = [sign * (.463 + .438 * (1 - knee)), .167 + .789 * knee, .082];
        toe = [-sign * .086, .018, .086];
      } else if (mode === "backQuad" && (!profile.single || far)) {
        target = [sign * .201, .108, -.430];
        ray = [sign * .154, -.88, .198];
        toe = [sign * .022, -.056, -.116];
      } else if (mode === "ankleOut" || mode === "ankle") {
        const arc = mode === "ankleOut" ? .095 + .91 * Math.sin(phase * Math.PI) ** 2
          : profile.turn ? .62 * (2 * step - 1) : .18 + .62 * step;
        const circles = mode === "ankle" && profile.turn;
        toe = [sign * .122 * Math.sin(circles ? 2 * swing : arc), .128 * Math.cos(arc), .035 + (circles ? .054 * Math.sin(2 * swing) : .066 * step)];
      } else if (mode === "toe" && active) {
        toe = [sign * .016, .121 + .024 * reachToes, .074 - .121 * reachToes];
      } else if (mode === "shoulder" && active) {
        target = [sign * .139, .108, .335];
        toe = [sign * .012, -.064, .129];
        contact = true;
      } else if (mode === "walk") {
        target = [sign * .128, .099 + .043 * step, .571 + hips[2] + .103 * Math.cos(swing + index * Math.PI)];
      }
      leg(pose, side, target, ray, toe, contact ? .024 : undefined);
    }

    for (const [side, sign] of sides) {
      const active = sign === rotation;
      const shoulder = pose[side + "s"];
      const rest = [sign * .283, .067, -.035];
      let wrist = rest;
      let pole = [sign * .72, -.59, -.18];
      let fingers = [0, -.065, 1];
      if (mode === "cowFace") {
        wrist = blend(rest, add(pose.chest, [sign > 0 ? .031 : -.018, sign > 0 ? .121 : .001, -.138]), handsHigh(f));
        pole = [sign * .289, sign > 0 ? .954 : -.864, -.18];
        fingers = [sign > 0 ? -.051 : .023, sign > 0 ? -.981 : .986, -.058];
      } else if (mode === "turn") {
        const front = add(pose[rotation > 0 ? "lk" : "rk"], [sign * .054, .083, .014]);
        wrist = active ? profile.bind ? blend([sign * .161, .061, -.482], [sign * .109, .256, -.408], forward(f)) : [sign * .161, .061, -.482] : front;
        fingers = active ? [0, -.06, -.996] : [rotation * .75, -.174, .618];
      } else if (mode === "tuck") {
        const key = rotation > 0 ? "l" : "r";
        const point = profile.footHold && active ? pose[key + "a"] : pose[key + "k"];
        wrist = blend(rest, add(point, [sign * .058, -.044, .069]), Math.max(lift, kneeUp[rotation > 0 ? 0 : 1](f)));
        fingers = [-sign * .62, .116, -.77];
      } else if (overhead) {
        const extend = (1 + sign * guidingSide) * .5;
        const over = add(shoulder, [guidingSide * (.325 + .14 * bent), .515 - .282 * bent, .09]);
        const distal = add(pose[side + "t"], [-sign * .051, .048, -.036]);
        wrist = blend(over, distal, extend);
        pole = blend([sign * .38, .96, -.163], [sign * .792, -.41, .17], extend);
        fingers = [guidingSide * .745, 1 - bent * .90, .319];
      } else if (mode === "toe" || mode === "wide" && profile.side) {
        const key = rotation > 0 ? "l" : "r";
        const destination = add(pose[key + "t"], [sign * .027, .011, -.029]);
        wrist = blend(rest, destination, mode === "toe" ? .96 : bent);
      } else if (mode === "wide" && profile.overhead) {
        wrist = add(shoulder, [sign * .047, .601 * Math.cos(flex), .602 * Math.sin(flex)]);
        fingers = [sign * .086, 1 - bent, .061 + .93 * bent];
      } else if (fold) {
        wrist = [sign * .207, .066, mix(profile.sequence ? -.41 : .115, .731, bent)];
      } else if (mode === "boat") {
        const reach = profile.longArms ? [sign * .091, -.112, .598] : [sign * .077, -.101, .588];
        wrist = blend([sign * .234, .066, -.293], add(shoulder, reach), profile.longArms ? Math.min(1, lift * 1.9) : lift);
        if (profile.longArms) fingers = [0, -.087, .996];
      } else if (mode === "walk") {
        wrist = add(pose[sign > 0 ? "rs" : "ls"], [sign * .080, -.109, .103]);
        fingers = [-sign * .88, .106, .281];
      } else if (mode === "sideCross") {
        wrist = active ? [sign * .299, .064, -.260] : add(pose[side + "k"], [sign * .042, .066, .037]);
        fingers = active ? [-sign * .967, -.04, -.168] : [0, -.057, 1];
      } else if (support) {
        wrist = [sign * .221, .067, -.495];
        fingers = mode === "shoulder" || mode === "backQuad" ? [0, -.03, -.995] : [0, -.051, .993];
      } else if (mode === "kneeDown") {
        wrist = add(pose[side + "k"], [sign * .015, .048, .051]);
      }
      arm(pose, side, wrist, pole, fingers);
    }
    return pose;
  };
}
