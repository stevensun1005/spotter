import { add, arm, blend, leg, mix, scale, sides, torso, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const clamp = n => Math.max(0, Math.min(1, n));

function range(frames, read) {
  const values = frames.map(read);
  const min = Math.min(...values);
  const span = Math.max(.05, Math.max(...values) - min);
  return frame => clamp((read(frame) - min) / span);
}

export function yogaFloorGuideMotion(guide, profile) {
  const { frames } = guide;
  const { mode } = profile;
  const high = range(frames, f => -f[2][1]);
  const chest = range(frames, f => -f[1][1]);
  const wrists = [4,6].map(index => range(frames, f => -f[index][1]));
  const lifted = [8,10].map(index => range(frames, f => -f[index][1]));
  const direction = Math.sign(frames[0][1][0] - frames[0][2][0]) || 1;
  const wristTravel = [4,6].map(index => range(frames, f => direction * (f[index][0] - f[2][0])));
  const dog = ["down","dolphin","toeTouch"].includes(mode);
  const balance = mode === "crane" || mode === "peacock";
  const deck = .024;

  return phase => {
    const f = guideAt(frames, phase);
    const elevate = high(f);
    const draw = chest(f);
    const breath = .017 * Math.sin(phase * Math.PI * 4);
    const release = Math.max(lifted[0](f), lifted[1](f));
    const hold = mode === "toeTouch" || mode === "down" && profile.single;
    const down = hold ? 1 : elevate;
    const hipY = dog ? mix(mode === "dolphin" ? .452 : .513, mode === "dolphin" ? .782 : .884, down) : mode === "staff" ? .242 + .167 * draw
      : mode === "up" ? .149 + .088 * draw : mode === "hero" ? .208 + .293 * (1 - draw) : mode === "boat" ? .177
      : mode === "corpse" || mode === "happy" ? .148 : balance ? .366 + .175 * release : .184;
    const hipZ = dog ? -.223 - .061 * down : mode === "up" ? .116 : mode === "boat" ? -.128 : -.205;
    const angle = dog ? mix(mode === "dolphin" ? 1.70 : 1.51, mode === "dolphin" ? 2.34 : 2.21, down) : mode === "staff" ? 1.552 - .135 * draw
      : mode === "up" ? -1.57 + 1.18 * draw : mode === "corpse" || mode === "happy" ? -Math.PI / 2
      : mode === "boat" ? -.712 * draw : mode === "crane" ? .61 + .66 * release : mode === "peacock" ? 1.538 : .025;
    const rocker = mode === "happy" ? .056 * Math.sin(phase * Math.PI * 4) : 0;
    const p = torso([rocker, hipY, hipZ], angle, mode === "up" ? Math.PI : mode === "happy" ? .145 * Math.sin(phase * Math.PI * 4) : 0);
    p.headDrop = dog ? .026 + .044 * down : mode === "corpse" ? .047 + breath : .024;
    if (profile.breathe || mode === "corpse" || mode === "meditate" || mode === "hero") {
      p.neck[1] += breath;
      p.chest[1] += .94 * breath;
      for (const [side] of sides) p[side + "s"][1] += breath;
    }

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const ankleRise = lifted[index](f);
      const sideY = mode === "up" ? -sign : sign;
      if (mode === "up") p[side + "h"][0] = -sign * .103;
      let toe = [sideY * .013, -.066, .133];
      let ankle = [sideY * .126, .110, -.847];
      let kneePole = [sideY * .094, .115, .968];
      let contact = true;
      if (dog) {
        const spread = profile.single ? ankleRise : 0;
        ankle = blend([sign * .146, .106, -.597], add(p[side + "h"], [sign * .043, .622, -.554]), spread);
        kneePole = [sign * .136, -.030, .988];
        contact = spread < .005;
        if (down < .115 && !hold) {
          p[side + "k"] = [sign * .129, .108, -.219];
          p[side + "a"] = [sign * .123, .100, -.636];
          p[side + "t"] = [sign * .124, .055, -.739];
        }
      } else if (mode === "staff") {
        const extra = profile.single ? ankleRise : 0;
        const vector = unit([sign * .021, -.11 + .49 * extra, -.93]);
        ankle = extra > .015 ? add(p[side + "h"], scale(vector, .831)) : [sign * .132, .140, -.998];
        toe = [sign * .014, -.124, .070];
        kneePole = [sign * .042, -.548, -.832];
        contact = extra < .015;
      } else if (mode === "up") {
        ankle = [-sign * .130, .106, .945];
        toe = [-sign * .016, -.067, .130];
        kneePole = [-sign * .040, -.97, .111];
      } else if (mode === "hero") {
        p[side + "k"] = [sign * .122, .110, .109];
        p[side + "a"] = [sign * .228, .100, -.295];
        p[side + "t"] = [sign * .240, .059, -.415];
      } else if (mode === "meditate") {
        ankle = [-sign * (profile.lotus ? .255 : .199), profile.lotus ? .153 : .099, .128 - sign * .079];
        toe = [-sign * .124, -.025, .045];
        kneePole = [sign * .994, -.100, .074];
        contact = false;
      } else if (mode === "corpse") {
        ankle = [sign * .199, .105, .625];
        toe = [sign * .107, .082, .064];
        kneePole = [sign * .15, .195, .94];
      } else if (mode === "boat") {
        ankle = [sign * .139, mix(.115, .491, release), mix(.369, .496, release)];
        toe = [sign * .016, .034, .136];
        kneePole = [sign * .11, .982, -.059];
        contact = release < .015;
      } else if (mode === "happy") {
        ankle = [sign * (.165 + .224 * release), .272 + .361 * release, -.043];
        toe = [sign * .041, .096, -.098];
        kneePole = [sign * .91, .069, -.58];
        contact = false;
      } else if (mode === "crane") {
        ankle = [sign * .282, .109 + .390 * ankleRise, -.401 - .097 * ankleRise];
        toe = [sign * .012, -.071, -.122];
        kneePole = [sign * .397, .019, .907];
        contact = ankleRise < .013;
      } else if (mode === "peacock") {
        ankle = blend([sign * .129, .091, -.667], add(p[side + "h"], [sign * .018, .039, -.836]), release);
        toe = [sign * .010, -.045, -.134];
        kneePole = [sign * .038, -.912, -.23];
        contact = release < .013;
      }
      if (!p[side + "k"]) leg(p, side, ankle, kneePole, toe, contact ? deck : undefined);
    }

    for (const [side, sign] of sides) {
      const index = sign > 0 ? 0 : 1;
      const shoulder = p[side + "s"];
      const plankWrist = [sign * .199, .067, mode === "staff" ? .284 : .366 + .072 * down];
      let wrist = plankWrist;
      let fingers = [0, -.024, 1];
      let elbow = [sign * .22, -.84, -.64];
      let palm = [sign, .028, 0];
      if (mode === "dolphin") {
        p[side + "e"] = [sign * .202, .085, .223];
        p[side + "w"] = [sign * .174, .070, .582];
        p[side + "Fingers"] = [0, -.035, 1];
        continue;
      } else if (mode === "toeTouch") {
        const other = p[sign > 0 ? "ra" : "la"];
        const reach = 1 - wristTravel[index](f);
        wrist = blend(plankWrist, add(other, [sign * .011, .081, .029]), reach);
        fingers = [0, -.604*reach, 1 - 1.70*reach];
        elbow = [sign * .51, -.825, -.225];
      } else if (mode === "up") {
        wrist = [-sign * .231, .066, -.116];
        fingers = [0, -.015, -1];
        elbow = [-sign * .30, -.301, .91];
      } else if (mode === "hero" || mode === "meditate") {
        wrist = profile.lap ? [sign * .058, .253, .193] : add(p[side + "k"], [sign * .022, mode === "hero" ? .098 : .073, .037]);
        fingers = [sign * .18, -.33, .91];
        palm = [sign, .049, .017];
      } else if (mode === "corpse") {
        wrist = [sign * .325, .068 + .42 * breath, -.045];
        palm = [-sign, .011, .062];
      } else if (mode === "boat") {
        const reach = Math.max(release, wrists[index](f));
        wrist = blend([sign * .228, .069, -.08], add(shoulder, [sign * .027, -.188, .588]), reach);
        fingers = [sign * .026, -.077, .989];
      } else if (mode === "happy") {
        const parked = [sign * .249, .063, -.087];
        wrist = blend(parked, add(p[side + "a"], [sign * .043, .047, -.029]), release);
        fingers = [-sign * .741, .03, .649];
      } else if (mode === "peacock" || mode === "crane") {
        wrist = [sign * (mode === "peacock" ? .109 : .199), .066, .379];
        fingers = [0, -.022, mode === "peacock" ? -1 : 1];
        elbow = [sign * .052, -.72, -1];
      }
      arm(p, side, wrist, elbow, fingers, palm);
    }
    return p;
  };
}
