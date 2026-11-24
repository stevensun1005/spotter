
import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Leg = [Point, Point];
type Grip = "clean" | "snatch";
type Hold = "hang" | "low-pull" | "high-pull" | "front" | "jerk-rack" | "back" | "overhead";
type PullStart = "floor" | "blocks" | "mid-thigh" | "below-knee" | "above-knee" | "hip";
type Catch = "squat" | "power" | "split";

type Position = {
  hip: Point;
  shoulder: Point;
  knees: [Point, Point];
  feet: [Point, Point];
  head?: Point;
  toes?: [Point, Point];
};

const toeY = 155;
const move = ([x, y]: Point, dx: number, dy: number): Point => [x + dx, y + dy];
const center: [Point, Point] = [[151, toeY], [139, toeY]];
const receive: [Point, Point] = [[167, toeY], [131, toeY]];
const receiveToes: [Point, Point] = [[177, toeY + 1], [125, toeY + 1]];
const toeDirection = ([[x1, y1], [x2, y2]]: [Point, Point]): [Point, Point] => [[x1 + 10, y1 + 1], [x2 + 8, y2 + 1]];

function standing(feet = center, level = 0, heelRise = false): Position {
  const ankles: [Point, Point] = heelRise ? [move(feet[0], 0, -5), move(feet[1], 0, -5)] : feet;
  return {
    hip: [145, 88 + level],
    shoulder: [149, 47 + level],
    knees: [[(ankles[0][0] + 145) / 2 + 2 + level * .6, 120 + level * .35],
      [(ankles[1][0] + 145) / 2 + 1 + level * .5, 119 + level * .35]],
    feet: ankles,
    toes: feet === receive ? receiveToes : toeDirection(feet),
  };
}

function caught(depth: Catch): Position {
  if (depth === "split") {
    return {
      hip: [148, 104], shoulder: [149, 64],
      knees: [[181, 123], [127, 128]], feet: [[185, 155], [106, 149]],
      toes: [[196, 156], [116, 156]],
    };
  }

  const deep = depth === "squat";
  return {
    hip: [143, deep ? 124 : 101], shoulder: [151, deep ? 83 : 60],
    knees: [[174, deep ? 115 : 124], [159, deep ? 116 : 122]],
    feet: receive, toes: receiveToes,
  };
}

function duringSplitRecovery(): Position {
  return {
    hip: [148, 95], shoulder: [149, 54],
    knees: [[166, 126], [124, 125]], feet: [[166, 155], [106, 149]],
    toes: [[176, 156], [116, 156]],
  };
}

function startPosition(start: PullStart): { body: Position; y: number } {
  if (start === "floor") return {
    body: { hip: [132, 112], shoulder: [164, 92], head: [176, 81], knees: [[159, 129], [152, 128]], feet: center },
    y: 150,
  };
  if (start === "below-knee" || start === "blocks") return {
    body: { hip: [131, 93], shoulder: [165, 62], head: [174, 49], knees: [[158, 122], [148, 120]], feet: center },
    y: start === "blocks" ? 115 : 128,
  };
  if (start === "above-knee") return {
    body: { hip: [130, 91], shoulder: [159, 57], head: [166, 45], knees: [[159, 120], [150, 121]], feet: center },
    y: 112,
  };
  if (start === "mid-thigh") return {
    body: { hip: [134, 89], shoulder: [155, 52], head: [159, 38], knees: [[155, 124], [145, 124]], feet: center },
    y: 105,
  };
  return { body: standing(center, 4), y: 94 };
}

function arm(hold: Hold, shoulder: Point, hand: Point, near: boolean): Point {
  const [sx, sy] = shoulder;
  if (hold === "front") return near ? [sx + 26, sy + 6] : [sx + 23, sy + 8];
  if (hold === "jerk-rack") return near ? [sx + 27, sy + 17] : [sx + 29, sy + 19];
  if (hold === "back") return near ? move(hand, 3, 15) : move(hand, -4, 15);
  if (hold === "high-pull") return near ? move(hand, 15, -16) : move(hand, -15, -16);
  if (hold === "low-pull") return near ? move(hand, 10, -21) : move(hand, -10, -21);
  return [(sx + hand[0]) / 2, (sy + hand[1]) / 2];
}

function pose(body: Position, hold: Hold, grip: Grip, explicitY?: number): Point[] {
  const [sx, sy] = body.shoulder;
  const barX = hold === "back" ? 141 : hold === "overhead" ? 151 : hold === "front" || hold === "jerk-rack" ? sx + 7 : 151;
  const barY = explicitY ?? (hold === "overhead" ? sy - 36 : hold === "back" ? sy - 1 : sy + 1);
  const width = grip === "snatch" ? 25 : 13;
  const right: Point = [barX + width, barY], left: Point = [barX - width, barY];
  const [nearKnee, farKnee] = body.knees, [nearFoot, farFoot] = body.feet;
  const toes = body.toes ?? toeDirection(body.feet);
  return [body.head ?? move(body.shoulder, 5, -15), body.shoulder, body.hip,
    arm(hold, body.shoulder, right, true), right, arm(hold, body.shoulder, left, false), left,
    nearKnee, nearFoot, farKnee, farFoot, ...toes, [barX - 36, barY], [barX + 36, barY]];
}

function belowHead(body: Position, grip: Grip, behind = false): Point[] {
  const frame = pose(body, "high-pull", grip, body.shoulder[1] - 10);
  frame[3] = move(frame[4], 7, 11);
  frame[5] = move(frame[6], -7, 11);
  if (behind) {
    for (const joint of [3, 4, 5, 6, 13, 14]) frame[joint] = move(frame[joint], -6, 0);
  }
  return frame;
}

function draw(frames: Point[][], props: Props = [], ms = 650): Illustration {
  return {
    frames, props, ms, reference: true,
    dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ["bar", 13, 14],
      ["barbell-end", 13, 0, 0], ["barbell-end", 14, 0, 0]],
  };
}

const blockDeck: Props = [
  [101, 125, 128, 125], [101, 125, 101, 158], [128, 125, 128, 158], [101, 157, 128, 157],
  [174, 125, 201, 125], [174, 125, 174, 158], [201, 125, 201, 158], [174, 157, 201, 157],
  [101, 136, 128, 136], [174, 136, 201, 136],
];

function pullSetup(start: PullStart, grip: Grip) {
  const ready = startPosition(start);
  return pose(ready.body, "hang", grip, ready.y);
}

function lift(start: PullStart, grip: Grip, depth: Catch | "muscle" | "thruster") {
  const clean = grip === "clean";
  const muscle = depth === "muscle";
  const thruster = depth === "thruster";
  const receiveDepth = muscle || thruster ? "power" : depth;
  const lockout: Hold = clean ? "front" : "overhead";
  const support = start === "blocks" ? blockDeck : [];
  const setup = pullSetup(start, grip);
  const extended = pose(standing(center, -4, true), "hang", grip, clean ? 87 : 84);
  const turnover = clean ? pose(standing(center, -2, true), "high-pull", grip, 65) : belowHead(standing(center, muscle ? -4 : 6, muscle), grip);
  const receiving = pose(caught(receiveDepth), lockout, grip);
  const completed = pose(standing(depth === "split" || muscle ? center : receive), lockout, grip);
  const vertical = pose(standing(center), "hang", grip, clean ? 120 : 107);
  const beforeDrive = start === "floor" ? [pullSetup("above-knee", grip)] : [];

  if (muscle) {
    const unload = clean ? pose(standing(), "high-pull", grip, 64) : belowHead(standing(), grip);
    return draw([setup, extended, turnover, completed, completed, unload, vertical, setup]);
  }
  if (thruster) {
    const squat = pose(caught("squat"), "front", grip);
    const press = pose(standing(receive), "overhead", grip);
    return draw([setup, ...beforeDrive, extended, turnover, receiving, completed, squat, press, press, completed, vertical, setup]);
  }
  const recovery = depth === "split" ? [pose(duringSplitRecovery(), lockout, grip)] : [];
  const beforeReset = clean ? [] : [belowHead(standing(), grip)];
  return draw([setup, ...beforeDrive, extended, turnover, receiving, ...recovery, completed, completed, ...beforeReset, vertical, setup], support);
}

function cleanPull(high: boolean) {
  const start = pullSetup(high ? "above-knee" : "floor", "clean");
  const positions = high ? [start] : [start, pullSetup("above-knee", "clean")];
  const tall = standing(center, -3, true);
  const extended = pose(tall, "hang", "clean", high ? 99 : 110);
  const finish = pose(tall, high ? "high-pull" : "low-pull", "clean", high ? 64 : 98);
  return draw([...positions, extended, finish, finish, ...positions.slice().reverse()], [], 720);
}

function snatchBalance(heaving: boolean) {
  const grip: Grip = "snatch";
  const setupFeet = heaving ? receive : center;
  const ready = pose(standing(setupFeet), "back", grip);
  const dip = pose(standing(setupFeet, 13), "back", grip);
  const barUnload = pose(standing(setupFeet, 0, !heaving), "back", grip, 43);
  const receiveLow = pose(caught("squat"), "overhead", grip);
  const standOverhead = pose(standing(receive), "overhead", grip);
  const lower = belowHead(standing(receive), grip, true);
  return draw([ready, dip, barUnload, receiveLow, receiveLow, standOverhead, lower,
    pose(standing(receive), "back", grip), ready], [], 690);
}

function jerk(split: boolean) {
  const grip: Grip = "clean";
  const ready = pose(standing(center), "jerk-rack", grip);
  const dip = pose(standing(center, 14), "jerk-rack", grip);
  const drive = belowHead(standing(center, -3, true), grip);
  const catchPos = pose(caught(split ? "split" : "power"), "overhead", grip);
  const recover = split ? [pose(duringSplitRecovery(), "overhead", grip)] : [];
  const stabilize = pose(standing(split ? center : receive), "overhead", grip);
  return draw([ready, dip, drive, catchPos, catchPos, ...recover, stabilize, stabilize,
    belowHead(standing(split ? center : receive), grip), ready], [], 690);
}

function cleanAndJerk() {
  const clean = lift("floor", "clean", "squat").frames;
  const overhead = jerk(true).frames;
  return draw([...clean.slice(0, 6), ...overhead,
    clean[7], clean[1], clean[0]], [], 620);
}

function highPull(start: "floor" | "mid-thigh", dumbbells = false) {
  const tall = standing(center, -3, true);
  const setup = pullSetup(start, "clean");
  const loadAtKnees = pullSetup("above-knee", "clean");
  const extension = pose(tall, "hang", "clean", 94);
  const top = pose(tall, "high-pull", "clean", 66);
  const sequence = [setup, ...(start === "floor" ? [loadAtKnees] : []), extension, top, top,
    ...(start === "floor" ? [extension, loadAtKnees] : [extension]), setup];
  const clip = draw(sequence, [], 630);
  return dumbbells ? { ...clip, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12],
    ["dumbbell", 4, 0, 0], ["dumbbell", 6, 0, 0]] as NonNullable<Illustration["dynamic"]> } : clip;
}

function hangPowerClean() {
  const ready = pullSetup("mid-thigh", "clean");
  const frames = lift("above-knee", "clean", "power").frames;
  return draw([ready, ...frames.slice(0, 6), ready], [], 680);
}

function barbellComplex() {
  const lower = pullSetup("floor", "clean"), above = pullSetup("above-knee", "clean");
  const deadliftTop = pose(standing(), "hang", "clean", 100);
  const clean = hangPowerClean().frames;
  const racked = pose(standing(receive), "front", "clean");
  const squat = pose(caught("squat"), "front", "clean");
  return draw([lower,above,deadliftTop,...clean.slice(1,6),racked,squat,squat,racked,deadliftTop,above,lower],[],680);
}

function smithHangClean() {
  const src = lift("mid-thigh", "clean", "power").frames;
  const dip = pose(standing(center, 13), "hang", "clean", 111);
  const centerFrame = (frame: Point[]) => {
    const barX = (frame[13][0] + frame[14][0]) / 2;
    return frame.map((p,index) => index === 4 || index === 6 || index >= 13 ? move(p, 161-barX,0)
      : index === 3 || index === 5 ? move(p,(161-barX)*.55,0) : p);
  };
  return draw([src[0],dip,...src.slice(1,6),dip,src[0]].map(centerFrame),[[125,23,125,157],[197,23,197,157],[125,23,197,23],
    [112,156,133,156],[190,156,212,156],[125,118,131,118],[191,118,197,118]],700);
}

function pressUnder() {
  const ready = pose(standing(receive), "back", "snatch");
  const lowering = pose(standing(receive, 20), "overhead", "snatch", 45);
  const caughtLow = pose(caught("squat"), "overhead", "snatch", 39);
  const stabilized = pose(standing(receive), "overhead", "snatch");
  return draw([ready, lowering, caughtLow, caughtLow, stabilized, stabilized,
    belowHead(standing(receive), "snatch", true), ready], [], 780);
}

export const olympicBarbellIllustrations: Record<string, Illustration> = {
  "1516": lift("blocks", "clean", "squat"),
  "1517": cleanPull(false),
  "5287": lift("floor", "clean", "squat"),
  "1520": lift("mid-thigh", "clean", "squat"),
  "1521": lift("below-knee", "clean", "squat"),
  "10107": cleanPull(true),
  "1522": lift("mid-thigh", "snatch", "squat"),
  "1523": lift("below-knee", "snatch", "squat"),
  "1524": snatchBalance(true),
  "1526": lift("hip", "snatch", "muscle"),
  "1528": lift("blocks", "clean", "power"),
  "1529": jerk(false),
  "1530": lift("floor", "snatch", "power"),
  "1531": lift("blocks", "snatch", "power"),
  "1533": lift("floor", "snatch", "squat"),
  "1534": snatchBalance(false),
  "1536": lift("blocks", "snatch", "squat"),
  "1537": lift("floor", "clean", "split"),
  "1538": jerk(true),
  "5188": lift("floor", "clean", "thruster"),
  "3183": lift("below-knee", "clean", "squat"),
  "5075": lift("floor", "clean", "muscle"),
  "5122": cleanAndJerk(),
  "5190": cleanAndJerk(),
  "5192": lift("floor", "clean", "thruster"),
  "5705": highPull("floor"),
  "10106": highPull("mid-thigh"),
  "5666": highPull("mid-thigh", true),
  "5704": hangPowerClean(),
  "3316": barbellComplex(),
  "5142": smithHangClean(),
  "4966": pressUnder(),
};
