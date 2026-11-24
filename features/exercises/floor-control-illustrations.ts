import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const mat: Props = [[86, 13, 229, 13], [229, 13, 229, 154], [229, 154, 86, 154], [86, 154, 86, 13]];

const prone: Point[] = [[190, 147], [175, 150], [134, 153], [206, 155], [231, 155],
  [192, 152], [218, 152], [107, 155], [79, 156], [100, 153], [72, 154]];
const lift: Point[] = [[191, 135], [174, 141], [134, 152], [206, 138], [230, 135],
  [193, 140], [218, 137], [107, 145], [79, 138], [100, 143], [72, 137]];
const replace = (base: Point[], changes: Partial<Record<number, Point>>) => base.map((joint, i) => changes[i] ?? joint);

function proneDemo(frames: Point[][], dynamic: Attachments = [], ms = 980): Illustration {
  return { frames: frames.map((f) => [...f, [f[0][0] + 1, f[0][1] + 5]]), dynamic: [["face", 0, 11], ...dynamic], ms, reference: true };
}

function alternateSuperman(hold: boolean, flutter = false) {
  const liftChest = replace(prone, { 0: [190, 139], 1: [176, 143] });
  const base = flutter ? liftChest : prone;
  const left = replace(base, { 3: lift[3], 4: lift[4], 9: lift[9], 10: lift[10] });
  const right = replace(base, { 5: lift[5], 6: lift[6], 7: lift[7], 8: lift[8] });
  return proneDemo(hold ? [base, left, left, base, right, right] : [base, right, base, left], [], flutter ? 710 : 930);
}

function arcSuperman(hold = false) {
  const open = replace(lift, { 3: [179, 123], 4: [184, 107], 5: [167, 150], 6: [164, 155] });
  const hips = replace(lift, { 3: [155, 132], 4: [137, 138], 5: [156, 143], 6: [133, 149] });
  return proneDemo(hold ? [prone, lift, open, hips, hips, open, lift] : [prone, lift, open, hips, open, lift], [], 870);
}

function letterSuperman(toY: boolean) {
  const w: Point[] = [[152, 51], [152, 66], [152, 103], [174, 75], [186, 54],
    [130, 75], [118, 54], [162, 121], [169, 144], [142, 121], [135, 144]];
  const raised = replace(w, { 0: [152, 46], 1: [152, 63], 3: [175, 71], 4: [187, 51], 5: [129, 71], 6: [117, 51],
    7: [162, 119], 8: [169, 139], 9: [142, 119], 10: [135, 139] });
  const y = replace(raised, { 3: [166, 49], 4: [181, 31], 5: [138, 49], 6: [123, 31] });
  return { frames: toY ? [w, raised, y, raised] : [w, raised, raised], props: mat, topView: true, ms: 1060, reference: true };
}

function snowAngel(supine: boolean) {
  const head: Point = [157, supine ? 41 : 44];
  const neck: Point = [157, 62];
  const hips: Point = [157, 104];
  const start: Point[] = [head, neck, hips, [170, 77], [174, 101], [144, 77], [140, 101],
    [162, 123], [162, 146], [152, 123], [152, 146]];
  const mid = replace(start, { 3: [180, 64], 4: [202, 68], 5: [134, 64], 6: [112, 68],
    7: [167, 122], 8: [177, 144], 9: [147, 122], 10: [137, 144] });
  const open = replace(mid, { 0: [157, supine ? 41 : 40], 3: [175, 48], 4: [186, 26], 5: [139, 48], 6: [128, 26],
    7: [172, 122], 8: [187, 142], 9: [142, 122], 10: [127, 142] });
  const ready = supine ? start : replace(start, { 0: [157, 41], 1: [157, 59], 4: [174, 97], 6: [140, 97] });
  const face = supine ? [["face", 0, 11], ["face", 0, 12]] as Attachments : [];
  return { frames: [ready, mid, open, mid].map((f): Point[] => [...f, [153, 39], [161, 39]]),
    dynamic: face, props: mat, topView: true, ms: 920, reference: true };
}

function suspensionSuperman(rings: boolean): Illustration {
  const support: Props = [[90, 20, 128, 20]];
  const dynamic: Attachments = [["cable", 8, 104, 20], ["cable", 10, 113, 20]];
  if (rings) dynamic.push(["ring", 8, 0, 3], ["ring", 10, 0, 3]);
  else dynamic.push(["foot", 8, 89, 137], ["foot", 10, 98, 134], ["line", 8, 11], ["line", 10, 12]);
  const plank: Point[] = [[213, 111], [198, 116], [152, 126], [207, 139], [213, 155],
    [192, 137], [195, 155], [127, 132], [96, 135], [134, 130], [105, 132], [88, 137], [97, 134]];
  return { frames: [plank, replace(plank, { 3: [221, 115], 4: [247, 111] }), plank,
    replace(plank, { 5: [221, 111], 6: [245, 108] })], dynamic, props: support, ms: 1000, reference: true };
}

function seatedSwimmer(): Illustration {
  const base: Point[] = [[166, 49], [156, 68], [142, 110], [173, 78], [196, 78],
    [141, 84], [126, 101], [179, 110], [177, 157], [169, 112], [162, 157]];
  const reversed = replace(base, { 3: [145, 88], 4: [124, 103], 5: [170, 77], 6: [196, 75] });
  return { frames: [base, reversed], props: [[121, 115, 156, 115], [119, 115, 119, 68], [124, 115, 124, 158], [153, 115, 153, 158]],
    ms: 840, reference: true };
}

type BugGear = "upper-band" | "fixed-band" | "plate" | "ball";
function deadBug(gear: BugGear): Illustration {
  const ready: Point[] = [[104, 149], [122, 151], [160, 151], [129, 129], [128, 108],
    [135, 128], [139, 108], [165, 119], [192, 122], [152, 117], [180, 118]];
  const armOne = { 3: [106, 140] as Point, 4: [82, 140] as Point };
  const armTwo = { 5: [107, 141] as Point, 6: [83, 141] as Point };
  const legOne = { 9: [188, 142] as Point, 10: [218, 147] as Point };
  const legTwo = { 7: [190, 144] as Point, 8: [220, 150] as Point };
  const armOnly = gear === "upper-band";
  const frames = [ready, replace(ready, { ...armOne, ...(armOnly ? {} : legOne) }), ready,
    replace(ready, { ...armTwo, ...(armOnly ? {} : legTwo) })];
  const dynamic: Attachments = [];
  if (gear === "plate") dynamic.push(["plate", 11, 0, -2]);
  if (gear === "ball") dynamic.push(["stability-ball", 12, 0, 0]);
  if (gear === "upper-band" || gear === "fixed-band") dynamic.push(["band", 4, 6]);
  const drawn = frames.map((f, i): Point[] => [...f,
    i === 1 ? f[6] : i === 3 ? f[4] : [134, 108], i === 1 ? [155, 109] : i === 3 ? [146, 108] : [151, 110]]);
  return { frames: drawn, dynamic, ms: 1150, reference: true };
}

function lateralBandDeadBug(): Illustration {
  const ready: Point[] = [[90, 95], [112, 95], [158, 95], [122, 109], [130, 103],
    [122, 80], [130, 87], [175, 109], [190, 110], [175, 80], [190, 78], [88, 92], [88, 98]];
  const near = replace(ready, { 3: [96, 112], 4: [66, 112], 9: [195, 83], 10: [232, 83] });
  const far = replace(ready, { 5: [96, 78], 6: [67, 78], 7: [195, 106], 8: [232, 106] });
  return { frames: [ready, near, ready, far], topView: true, props: [[52, 58, 251, 58], [251, 58, 251, 135],
    [251, 135, 52, 135], [52, 135, 52, 58], [106, 31, 151, 31], [131, 25, 131, 40]],
    dynamic: [["face", 0, 11], ["face", 0, 12], ["band", 4, 131, 35], ["band", 6, 131, 35]], ms: 1150, reference: true };
}

function clamShell(): Illustration {
  const rest: Point[] = [[100, 145], [117, 149], [157, 151], [132, 142], [150, 129],
    [111, 155], [90, 155], [183, 137], [194, 153], [183, 149], [194, 153]];
  return { frames: [rest, replace(rest, { 7: [180, 112] })],
    dynamic: [["foot", 8, 202, 156], ["foot", 10, 202, 156]], ms: 1100, reference: true };
}

export const floorControlIllustrations: Readonly<Record<string, Illustration>> = {
  "4702": alternateSuperman(true),
  "4715": alternateSuperman(false),
  "4935": arcSuperman(),
  "3483": arcSuperman(true),
  "3454": proneDemo([prone, lift, lift], [["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]]),
  "4977": suspensionSuperman(true),
  "8197": seatedSwimmer(),
  "10045": snowAngel(false),
  "10046": snowAngel(true),
  "10345": proneDemo([prone, lift, replace(lift, { 0: [191, 140], 1: [174, 144], 4: [230, 141], 6: [218, 142],
    8: [79, 145], 10: [72, 142] }), lift, lift], [], 740),
  "5049": letterSuperman(false),
  "5048": letterSuperman(true),
  "4798": suspensionSuperman(false),
  "1612": alternateSuperman(false, true),
  "3227": proneDemo([replace(lift, { 7: [107, 151], 8: [79, 151] }), replace(lift, { 9: [100, 152], 10: [72, 152] })], [], 620),
  "4091": proneDemo([prone, lift, replace(lift, { 0: [190, 131], 1: [174, 137], 3: [207, 130], 4: [231, 126], 5: [197, 145], 6: [220, 145] }),
    lift, replace(lift, { 0: [191, 136], 1: [172, 143], 3: [201, 147], 4: [225, 149], 5: [196, 136], 6: [220, 130] }), lift]),
  "2938": deadBug("fixed-band"),
  "4056": deadBug("ball"),
  "4870": clamShell(),
  "3866": lateralBandDeadBug(),
  "3512": deadBug("upper-band"),
  "4127": deadBug("plate"),
};
