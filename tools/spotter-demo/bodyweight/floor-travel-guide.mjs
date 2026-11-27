import { add, arm, blend, leg, mix, scale, sides, stand, unit } from "./pose.mjs";
import { guideAt } from "./sagittal-guide.mjs";

const floor = .024;
const contacts = {
  stand: { body: [.905, .014, .006, 0], feet: [.128, .109, .032], arms: "side" },
  hands: { body: [.538, 1.176, -.089, 0], feet: [.146, .109, .028], arms: "plant" },
  plank: { body: [.410, 1.386, -.192, 0], feet: [.122, .149, -.991], arms: "plant" },
  press: { body: [.233, 1.509, -.174, 0], feet: [.118, .149, -.992], arms: "plant" },
  jackFeet: { body: [.414, 1.386, -.189, 0], feet: [.362, .149, -.893], arms: "plant" },
  tuck: { body: [.528, 1.143, -.087, 0], feet: [.390, .109, .267], arms: "plant" },
  squat: { body: [.566, .415, -.116, 0], feet: [.249, .109, .102], arms: "reach" },
  jump: { body: [1.187, .032, .013, 0], feet: [.141, .376, .034], arms: "overhead" },
  star: { body: [1.161, .026, .022, 0], feet: [.355, .370, .032], arms: "overhead" },
  pike: { body: [.891, 2.735, -.048, 0], feet: [.120, .109, -.337], arms: "plant" },
};

const xy = (value, t) => Math.sin(Math.PI * t) * value;

function marked(stage) {
  const special = /^([lr])-(cross|outside|lunge|climb|stepBack|stepIn|kick|twist)$/.exec(stage);
  if (!special) return { ...contacts[stage], mode: stage, sign: 0 };
  const [, side, mode] = special;
  const sign = side === "l" ? 1 : -1;
  const base = mode === "kick" ? contacts.stand : mode === "stepIn" ? contacts.hands : mode === "twist" ? contacts.star : contacts.plank;
  return { ...base, mode, sign, body: mode === "twist" ? [base.body[0], base.body[1], base.body[2], sign * .72] : base.body };
}

function stagesAt(stages, phase) {
  const index = (phase * stages.length) % stages.length;
  const from = Math.floor(index);
  const t = index - from;
  return [marked(stages[from]), marked(stages[(from + 1) % stages.length]), (1 - Math.cos(Math.PI * t)) / 2];
}

function feetFor(stage, sign, center, hip, profile) {
  const [x, y, z] = stage.feet;
  const active = stage.sign === sign;
  const ankle = [sign * x, y, z + center[2]];
  const floorToe = [sign * .014, y > .13 ? -.123 : -.066, y > .13 ? .081 : .128];
  if (!stage.sign) return [ankle, floorToe];
  if (stage.mode === "twist") {
    const c = Math.cos(stage.body[3]), s = Math.sin(stage.body[3]);
    return [[ankle[0] * c + z * s, ankle[1], center[2] + z * c - ankle[0] * s], [s * .094, -.109, .081 * c]];
  }
  if (!active) return [ankle, floorToe];
  if (stage.mode === "cross") return [[-sign * .154, .157, .139 + center[2]], [0, -.087, .103]];
  if (stage.mode === "outside") return [[sign * (profile.spider ? .410 : .353), profile.spider ? .233 : .181, .201 + center[2]], [sign * .019, -.074, .114]];
  if (stage.mode === "lunge") return [[sign * .298, .110, .402 + center[2]], [sign * .015, -.061, .128]];
  if (stage.mode === "stepBack") return [[sign * .161, .109, .012 + center[2]], [0, -.064, .130]];
  if (stage.mode === "stepIn") return [[sign * .136, .149, -.605 + center[2]], [0, -.109, .086]];
  if (stage.mode === "kick") return [add(hip, scale(unit([sign * .836, -.318, .114]), .837)), [sign * .102, -.018, .051]];
  return [[sign * .129, .168, .068 + center[2]], [sign * .01, -.099, .094]];
}

function wristsFor(stage, sign, shoulder, guideZ) {
  if (stage.arms === "plant") return [[sign * .216, .067, guideZ], [sign * .23, -.58, -.80], [0, -.025, 1]];
  if (stage.arms === "overhead") return [add(shoulder, [sign * .038, .598, .041]), [sign * .35, -.64, .21], [0, 1, .012]];
  if (stage.arms === "reach") return [add(shoulder, [sign * .038, -.195, .55]), [sign * .63, -.43, -.34], [0, -.17, .98]];
  if (stage.mode === "kick") return [add(shoulder, [sign * .36, -.33, .098]), [sign * .62, -.51, -.32], [sign * .34, -.60, .16]];
  return [add(shoulder, [sign * .07, -.605, .036]), [sign * .62, -.32, -.65], [0, -.994, .07]];
}

export function floorTravelGuideMotion(guide, profile) {
  const { frames } = guide;
  const { stages } = profile;
  const guideOrigin = frames[0][2][0];
  const guideHand = Math.max(...frames.map(f => f[4][0]));
  const align = profile.travel ? .012 : .0027;
  return phase => {
    const frame = guideAt(frames, phase);
    const [from, after, weight] = stagesAt(stages, phase);
    const movement = (frame[2][0] - guideOrigin) * align;
    const body = blend(from.body, after.body, weight);
    const position = [0, body[0], body[2] + movement];
    const pose = stand(position, body[1], body[3]);
    for (const [side, sign] of sides) {
      const [before, toeBefore] = feetFor(from, sign, [0, 0, movement], pose[side + "h"], profile);
      const [later, toeLater] = feetFor(after, sign, [0, 0, movement], pose[side + "h"], profile);
      const foot = blend(before, later, weight);
      const toe = blend(toeBefore, toeLater, weight);
      const slide = Math.abs(later[2] - before[2]) + Math.abs(later[0] - before[0]);
      const lift = xy(Math.min(profile.walk ? .092 : .178, slide * .36), weight);
      foot[1] += Math.max(0, lift);
      const bend = [sign * .245, .086, .982];
      leg(pose, side, foot, bend, toe, foot[1] < .153 && lift < .006 ? floor : undefined);
      const shoulder = pose[side + "s"];
      const hand = frame[sign > 0 ? 4 : 6];
      let hands = profile.crawl ? .042 + .016 * (hand[0] - guideOrigin) : .407 + .0037 * (frame[4][0] - guideHand);
      if (profile.crawl) {
        const vertical = Math.min(.598, Math.abs(shoulder[1] - .067));
        const reach = Math.sqrt(.613 ** 2 - vertical ** 2);
        hands = Math.min(shoulder[2] + reach, Math.max(shoulder[2] - reach, hands));
      }
      const [w1,e1,f1] = wristsFor(from, sign, shoulder, hands);
      const [w2,e2,f2] = wristsFor(after, sign, shoulder, hands);
      const fingers = blend(f1, f2, weight);
      arm(pose, side, blend(w1, w2, weight), blend(e1, e2, weight), fingers);
    }
    return pose;
  };
}
