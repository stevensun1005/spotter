import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Gear = "dumbbell" | "circus" | "kettlebell" | "band";
type First = "floor" | "hang" | "swing" | "rack";
type Finish = "rack" | "press" | "jerk" | "snatch" | "squat" | "thruster";
type Hand = "near" | "far" | "both" | "alternate" | "cross" | "twist";
type Phase = "floor" | "hang" | "hike" | "drive" | "rack" | "catch" | "squat" | "dip" | "overhead"
  | "jerk-catch" | "split-catch";
type Step = [Phase, Hand?];

const base: Point[] = [[149, 43], [148, 65], [146, 107], [160, 85], [169, 110],
  [136, 87], [127, 112], [160, 132], [164, 157], [135, 132], [131, 157]];
const revise = (pose: Point[], changes: Partial<Record<number, Point>>) => pose.map((p, i) => changes[i] ?? p);
const phases: Record<Phase, Partial<Record<number, Point>>> = {
  floor: { 0: [173, 82], 1: [158, 97], 2: [127, 120], 3: [163, 124], 4: [169, 151],
    5: [145, 122], 6: [151, 149], 7: [159, 134], 9: [137, 136] },
  hang: { 0: [178, 66], 1: [163, 80], 2: [127, 104], 3: [163, 103], 4: [168, 128],
    5: [147, 105], 6: [148, 127], 7: [156, 128], 9: [133, 127] },
  hike: { 0: [175, 72], 1: [160, 86], 2: [123, 110], 3: [143, 108], 4: [127, 133],
    5: [134, 105], 6: [115, 130], 7: [154, 130], 9: [130, 132] },
  drive: { 0: [151, 37], 1: [148, 58], 2: [145, 100], 3: [164, 76], 4: [171, 93],
    5: [130, 76], 6: [122, 93], 7: [158, 125], 8: [162, 151], 9: [135, 125], 10: [132, 151] },
  rack: { 3: [166, 88], 4: [169, 68], 5: [132, 89], 6: [126, 69] },
  catch: { 0: [155, 57], 1: [152, 78], 2: [137, 120], 3: [169, 99], 4: [173, 78],
    5: [138, 102], 6: [133, 80], 7: [166, 135], 9: [143, 137] },
  squat: { 0: [157, 80], 1: [151, 98], 2: [131, 135], 3: [166, 115], 4: [174, 99],
    5: [135, 118], 6: [128, 102], 7: [165, 136], 9: [139, 137] },
  dip: { 0: [149, 53], 1: [148, 75], 2: [147, 118], 3: [165, 97], 4: [169, 78],
    5: [130, 98], 6: [127, 79], 7: [165, 133], 9: [143, 134] },
  overhead: { 3: [157, 43], 4: [165, 20], 5: [140, 43], 6: [132, 20] },
  "jerk-catch": { 0: [149, 57], 1: [149, 79], 2: [144, 118], 3: [157, 55], 4: [165, 31],
    5: [141, 55], 6: [132, 31], 7: [164, 134], 9: [140, 135] },
  "split-catch": { 0: [148, 61], 1: [147, 82], 2: [146, 124], 3: [156, 59], 4: [165, 37],
    5: [140, 60], 6: [132, 37], 7: [182, 129], 8: [184, 157], 9: [117, 143], 10: [104, 156] },
};
const unloaded = (f: Point[], far: boolean): Point[] => far
  ? revise(f, { 5: [f[1][0] - 13, f[1][1] + 19], 6: [f[1][0] - 20, f[1][1] + 34] })
  : revise(f, { 3: [f[1][0] + 16, f[1][1] + 18], 4: [f[1][0] + 23, f[1][1] + 32] });
const rackWhilePress = (f: Point[], pressed: Hand): Point[] => pressed === "near"
  ? revise(f, { 5: [f[1][0] - 15, f[1][1] + 22], 6: [f[1][0] - 22, f[1][1] + 3] })
  : revise(f, { 3: [f[1][0] + 15, f[1][1] + 22], 4: [f[1][0] + 21, f[1][1] + 3] });

function loadGeometry(f: Point[], state: Phase, open = false): Point[] {
  const handleBelow = state === "floor" || state === "hang" || state === "hike" || state === "drive";
  const near: Point = [f[4][0] + (handleBelow ? 0 : 8), f[4][1] + (state === "floor" ? 3 : handleBelow ? 6 : 3)];
  const far: Point = [f[6][0] + (handleBelow ? 0 : -8), f[6][1] + (state === "floor" ? 4 : handleBelow ? 6 : 3)];
  return [...f, near, far, [f[4][0] + 5, f[4][1] - 1], [f[4][0] + 1, f[4][1] + (open ? -7 : 0)]];
}

function accessories(gear: Gear, hand: Hand, open = false): Attachments {
  const include = (near: boolean) => near ? hand !== "far" : hand === "far" || hand === "both" || hand === "alternate";
  const dynamic: Attachments = [];
  for (const near of [true, false]) {
    if (!include(near)) continue;
    const wrist = near ? 4 : 6;
    if (gear === "kettlebell") dynamic.push(["handled-bell", wrist, near ? 11 : 12]);
    else if (gear === "band") dynamic.push(["band", wrist, near ? 8 : 10]);
    else dynamic.push([gear === "circus" ? "circus-dumbbell" : "dumbbell", wrist, 0, 0]);
  }
  if (open) dynamic.unshift(["hand", 4, 13, 14]);
  return dynamic;
}

function lift(gear: Gear, first: First, finish: Finish, hand: Hand = "both", split = false, open = false, hold = false): Illustration {
  const start: Step[] = first === "swing" ? [["floor"], ["hike"]]
    : first === "rack" ? [["rack"]] : [[first]];
  const finishRack: Step[] = gear === "kettlebell" || hand === "cross"
    ? [["drive"], ["rack"]] : [["drive"], ["catch"], ["rack"]];
  const catchOverhead: Step = [split ? "split-catch" : "jerk-catch"];
  let sequence: Step[];
  if (finish === "snatch") {
    sequence = [...start, ["drive"], catchOverhead, ["overhead"], ["rack"]];
  } else if (finish === "thruster" && first === "rack") {
    sequence = hand === "alternate"
      ? [["rack"], ["squat"], ["overhead", "near"], ["rack"], ["squat"], ["overhead", "far"], ["rack"]]
      : [["rack"], ["squat"], ["overhead"], ["rack"]];
  } else {
    sequence = [...start, ...(first === "rack" ? [] : finishRack)];
    if (finish === "squat" || finish === "thruster") sequence.push(["squat"], [finish === "squat" ? "rack" : "overhead"]);
    if (finish === "press" || finish === "jerk") {
      if (finish === "jerk") sequence.push(["dip"], catchOverhead);
      if (finish === "press" && (gear === "dumbbell" || first === "swing")) sequence.push(["dip"]);
      sequence.push(["overhead"]);
    }
    if (finish !== "rack") sequence.push(["rack"]);
  }
  if (hold) sequence.splice(sequence.length - 1, 0, sequence[sequence.length - 2]);
  if (first === "hang" || first === "swing") sequence.push([first === "swing" ? "hike" : "hang"]);
  const frames = sequence.map(([state, pressSide]) => {
    let f = revise(base, phases[state]);
    if (hand !== "both" && hand !== "alternate") f = unloaded(f, hand !== "far");
    if (hand === "cross" && state === "rack") f = revise(f, { 0: [147, 45], 1: [144, 67], 3: [150, 88], 4: [131, 70] });
    if (hand === "twist" && state === "rack") f = revise(f, { 0: [163, 43], 1: [157, 64], 2: [149, 107],
      3: [164, 87], 4: [169, 68], 7: [157, 130], 8: [161, 157], 9: [137, 136], 10: [136, 157] });
    if (pressSide) f = rackWhilePress(f, pressSide);
    return loadGeometry(f, state, open);
  });
  return { frames, dynamic: accessories(gear, hand, open), ms: first === "rack" ? 770 : 600, reference: true };
}

function kneelingMove(toStand: boolean): Illustration {
  const ready: Point[] = [[158, 70], [157, 89], [146, 123], [170, 109], [175, 94],
    [143, 111], [138, 95], [178, 120], [182, 156], [137, 155], [116, 156]];
  const high = revise(ready, { 3: [167, 70], 4: [170, 48] });
  const floor = revise(ready, { 0: [168, 87], 1: [163, 106], 2: [146, 127], 3: [178, 127], 4: [183, 152],
    5: [148, 119], 6: [145, 136] });
  const upFromKneel = revise(base, { ...phases.rack, 7: [178, 132], 8: [182, 156], 9: [121, 132], 10: [113, 156] });
  return { frames: toStand ? [ready, upFromKneel, revise(base, phases.rack), upFromKneel, ready] : [floor, ready, high, ready],
    dynamic: accessories("dumbbell", toStand ? "both" : "near"), ms: 850, reference: true };
}

function lungeClean(): Illustration {
  const rack = revise(base, phases.rack);
  const low = revise(rack, { 0: [152, 63], 1: [150, 84], 2: [145, 126], 3: [163, 105], 4: [170, 88],
    7: [169, 127], 8: [164, 157], 9: [121, 151], 10: [102, 153] });
  const states: [Point[], Phase][] = [[base, "hang"], [low, "rack"], [rack, "rack"], [revise(base, phases.overhead), "overhead"], [rack, "rack"]];
  return { frames: states.map(([frame, state]) => loadGeometry(unloaded(frame, true), state)),
    dynamic: accessories("kettlebell", "near"), ms: 820, reference: true };
}

export const freeWeightCleanIllustrations: Readonly<Record<string, Illustration>> = {
  "2970": lift("band", "rack", "thruster"),
  "9693": lift("dumbbell", "rack", "thruster", "alternate"),
  "3400": lift("dumbbell", "floor", "press"),
  "10117": kneelingMove(false),
  "4449": lift("dumbbell", "hang", "rack", "both", false, false, true),
  "4377": lift("dumbbell", "hang", "jerk", "near"),
  "4739": lift("dumbbell", "hang", "rack"),
  "4740": lift("dumbbell", "hang", "jerk"),
  "10044": lift("dumbbell", "hang", "snatch", "near"),
  "5064": kneelingMove(true),
  "6152": lift("dumbbell", "floor", "snatch", "far"),
  "4540": lift("dumbbell", "rack", "thruster", "near"),
  "4889": lift("dumbbell", "floor", "rack"),
  "4439": lift("dumbbell", "floor", "jerk"),
  "4389": lift("dumbbell", "rack", "jerk"),
  "5101": lift("dumbbell", "floor", "rack", "near"),
  "10094": lift("dumbbell", "hang", "rack", "cross"),
  "2968": lift("dumbbell", "rack", "thruster"),
  "2969": lift("dumbbell", "rack", "thruster", "both", false, false, true),
  "9692": lift("kettlebell", "rack", "thruster", "alternate"),
  "4542": lift("kettlebell", "swing", "jerk", "near"),
  "5855": lift("kettlebell", "floor", "press", "near"),
  "1565": lift("kettlebell", "floor", "rack", "near"),
  "3577": lungeClean(),
  "4543": lift("kettlebell", "swing", "rack", "near", false, false, true),
  "4541": lift("kettlebell", "rack", "thruster", "near"),
  "1567": lift("kettlebell", "swing", "rack", "near", false, true),
  "4530": lift("kettlebell", "swing", "rack", "near"),
  "4531": lift("kettlebell", "swing", "press", "near"),
  "4518": lift("kettlebell", "rack", "thruster", "near", false, false, true),
  "4532": lift("kettlebell", "swing", "snatch", "near"),
  "4210": lift("kettlebell", "swing", "snatch", "near", true),
  "5335": lift("kettlebell", "swing", "thruster", "near"),
  "2814": lift("dumbbell", "hang", "press", "twist"),
  "2732": lift("circus", "floor", "jerk", "near"),
};
