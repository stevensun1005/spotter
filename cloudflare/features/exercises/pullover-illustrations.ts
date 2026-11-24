import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Equipment = NonNullable<Illustration["dynamic"]>;
type Legs = [Point, Point, Point, Point];
type Setup = { head: Point; shoulder: Point; hip: Point; legs: Legs; props?: Props; attachments?: Equipment };
type Load = "barbell" | "dumbbell" | "two-dumbbells" | "kettlebell" | "plate" | "bottle" | "hanging-band";

const bench: Setup = {
  head: [86, 109], shoulder: [105, 112], hip: [164, 114],
  legs: [[193, 121], [195, 154], [182, 124], [183, 154]],
  props: [[69, 122, 197, 122], [78, 122, 78, 158], [183, 122, 183, 158]],
  attachments: [["foot", 8, 211, 158], ["foot", 10, 196, 158]],
};
const floor: Setup = {
  head: [89, 143], shoulder: [108, 150], hip: [167, 152],
  legs: [[187, 120], [206, 154], [178, 124], [194, 154]],
  attachments: [["foot", 8, 219, 158], ["foot", 10, 208, 158]],
};
const kneesAtNinety: Setup = {
  ...bench, legs: [[163, 82], [190, 83], [154, 84], [183, 87]],
  attachments: [["foot", 8, 198, 76], ["foot", 10, 189, 78]],
};
const bridge: Setup = {
  ...floor,
  hip: [172, 124],
  legs: [[206, 113], [209, 154], [195, 112], [199, 154]],
  attachments: [["foot", 8, 223, 158], ["foot", 10, 213, 158]],
};
const singleLegBridge: Setup = {
  ...bridge, legs: [[202, 103], [222, 82], bridge.legs[2], bridge.legs[3]],
  attachments: [["foot", 8, 230, 78], ["foot", 10, 213, 158]],
};
const ball: Setup = {
  ...bench, head: [86, 114], shoulder: [105, 118], hip: [161, 120],
  legs: [[194, 115], [195, 154], [182, 116], [184, 154]],
  props: undefined,
  attachments: [...bench.attachments!, ["stability-ball", 1, 10, 24]],
};

function reach(origin: Point, angle: number, radius: number): Point {
  const radians = angle * Math.PI / 180;
  return [Math.round(origin[0] + Math.cos(radians) * radius), Math.round(origin[1] + Math.sin(radians) * radius)];
}

function pullover(setup: Setup, load: Load, style: "straight" | "bent" | "hold" | "bent-hold" | "wide" = "straight"): Illustration {
  const wide = style === "wide";
  const gap = wide ? 26 : load === "two-dumbbells" ? 22 : 12;
  const bend = style === "bent" || style === "bent-hold" ? 23 : 8;
  const furthest = setup === floor && style !== "straight" ? -164 : -177;
  const pose = (angle: number, base: Setup = setup, pressBottom = false): Point[] => {
    const elbow = pressBottom ? [112, base.shoulder[1] - 11] as Point : reach(base.shoulder, angle, 30);
    const hand = pressBottom ? [129, base.shoulder[1] - 29] as Point : reach(elbow, angle - bend, 28);
    const farElbow: Point = [elbow[0] + gap * 0.48, elbow[1] + (wide ? 3 : 1)];
    const farHand: Point = [hand[0] + gap, hand[1] + (wide ? 1 : -2)];
    return [base.head, base.shoulder, base.hip, elbow, hand, farElbow, farHand, ...base.legs,
      [(hand[0] + farHand[0]) / 2, (hand[1] + farHand[1]) / 2],
      [hand[0] + gap / 2, Math.min(147, hand[1] + 25)]];
  };
  const high = pose(-82);
  const behind = pose(furthest);
  const frames = [high, pose(-128), behind, pose(-128)];
  if (style === "hold" || style === "bent-hold") frames.splice(3, 0, behind, behind, behind);
  if (setup === bridge) frames.splice(0, frames.length,
    pose(-82, floor), high, pose(-128), behind, pose(-128), high, pose(-82, setup, true), high, pose(-82, floor));
  if (setup === singleLegBridge) frames.splice(0, frames.length,
    pose(-82, { ...setup, hip: floor.hip }), high, pose(-128), behind, pose(-128), high);
  const dynamic: Equipment = [...(setup.attachments ?? [])];
  if (load === "barbell") dynamic.push(["bar", 4, 6], ["plate", 4, -7, 0], ["plate", 6, 7, 0]);
  else if (load === "two-dumbbells") dynamic.push(["dumbbell", 4, 0, -2], ["dumbbell", 6, 0, -2]);
  else if (load === "kettlebell") dynamic.push(["kettlebell", 11, 0, -6]);
  else if (load === "plate") dynamic.push(["plate", 11, 0, -3]);
  else if (load === "bottle") dynamic.push(["bottle-upright", 11, 0, -3]);
  else dynamic.push(["dumbbell", 11, 0, -3]);
  if (load === "hanging-band") dynamic.push(["band", 11, 12], ["plate", 12, 0, 3]);
  return { frames, props: setup.props, dynamic, ms: 740, reference: true };
}

const seatedCable: Illustration = {
  reference: true,
  ms: 980,
  frames: [
    [[159, 53], [151, 71], [127, 113], [178, 53], [207, 40], [170, 54], [197, 41], [161, 123], [174, 154], [149, 126], [159, 154]],
    [[159, 53], [151, 71], [127, 113], [171, 95], [188, 119], [162, 95], [179, 118], [161, 123], [174, 154], [149, 126], [159, 154]],
  ],
  props: [[244, 22, 244, 155], [255, 22, 255, 155], [244, 22, 255, 22], [235, 156, 264, 156],
    [105, 121, 149, 121], [111, 122, 111, 157], [143, 122, 143, 157]],
  dynamic: [["cable", 4, 245, 25], ["cable", 6, 245, 25], ["bar", 4, 6],
    ["foot", 8, 189, 158], ["foot", 10, 173, 158]],
};

function pulloverWithBallBridge(): Illustration {
  const low: Setup = { ...ball, hip: [158, 137], legs: [[188, 123], ball.legs[1], [177, 125], ball.legs[3]] };
  const lowArc = pullover(low, "dumbbell");
  const top = pullover(ball, "dumbbell").frames[0];
  return { ...lowArc, frames: [...lowArc.frames, lowArc.frames[0], top, top, lowArc.frames[0]], ms: 830 };
}

export const pulloverIllustrations: Record<string, Illustration> = {
  "1294": pulloverWithBallBridge(),
  "7565": pullover(bench, "barbell", "bent"),
  "1448": pullover(bench, "barbell", "hold"),
  "4339": pullover(bench, "barbell"),
  "4340": pullover(bench, "barbell", "wide"),
  "6060": pullover(floor, "bottle"),
  "4180": seatedCable,
  "4326": pullover(bench, "dumbbell", "bent"),
  "1444": pullover(bench, "dumbbell", "bent-hold"),
  "2566": pullover(floor, "dumbbell", "bent"),
  "4318": pullover(floor, "dumbbell"),
  "10186": pullover(bridge, "dumbbell"),
  "3176": pullover(kneesAtNinety, "dumbbell"),
  "3188": pullover(bench, "hanging-band"),
  "7113": pullover(bench, "dumbbell"),
  "2365": pullover(bench, "two-dumbbells"),
  "4538": pullover(floor, "kettlebell"),
  "3522": pullover(singleLegBridge, "kettlebell"),
  "0842": pullover(ball, "plate"),
};
