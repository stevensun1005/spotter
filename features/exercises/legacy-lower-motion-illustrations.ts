import type { Illustration, Point } from "./motion-data";
import { catalogueIllustrations } from "./catalogue-illustrations";
import { lowerHipConditioningIllustrations } from "./lower-hip-conditioning-illustrations";

type Props = NonNullable<Illustration["props"]>;
type Loads = NonNullable<Illustration["dynamic"]>;
type Limb = [Point,Point];

function at([x,y]: Point, dx: number, dy: number): Point {
  return [x + dx, y + dy];
}

function person(head: Point, shoulder: Point, hip: Point, first: Limb, second: Limb, legs: [Limb,Limb], toes: [Point,Point]): Point[] {
  return [head, shoulder, hip, ...first, ...second, ...legs[0], ...legs[1], ...toes];
}

function motion(frames: Point[][], props: Props = [], load: Loads = [], ms = 830): Illustration {
  return { frames, props, dynamic: [["foot-tip",8,11],["foot-tip",10,12],...load], ms, reference: true };
}

const rackShaft: Loads = [["bar",13,14],["barbell-end",13,0,0],["barbell-end",14,0,0]];
const handheld: Loads = [["dumbbell",4,0,0],["dumbbell",6,0,0]];

function oldSquatWithWeights(id: string, dumbbells = false): Illustration {
  const base = catalogueIllustrations[id];
  const frames = base.frames.map(points => {
    const result = [...points], shoulder = points[1];
    if (dumbbells) {
      result[3] = at(shoulder,17,9);
      result[4] = at(shoulder,10,-3);
      result[5] = at(shoulder,-12,11);
      result[6] = at(shoulder,-17,-2);
      return result;
    }
    result[4] = at(shoulder,13,-3);
    result[6] = at(shoulder,-19,-3);
    return [...result, at(shoulder,-28,-3), at(shoulder,25,-3)];
  });
  const end = frames[0].length-1;
  const equipment: Loads = dumbbells ? [["hammer-weight",4,0,0],["hammer-weight",6,0,0]]
    : [["bar",end-1,end],["barbell-end",end-1,0,0],["barbell-end",end,0,0]];
  const props: Props | undefined = id === "4962" ? [[74,132,128,132],[74,132,74,158],[128,132,128,158]] : base.props;
  return { ...base, frames, props, dynamic: equipment };
}

function oldDeadliftWithShaft(id: string): Illustration {
  const base = catalogueIllustrations[id];
  const frames = base.frames.map(points => {
    const wrist = points[4], other = points[6];
    const barY = Math.min(149,(wrist[1]+other[1])/2);
    const barX = (wrist[0]+other[0])/2;
    const hands = [...points];
    hands[4] = [barX+5,barY];
    hands[6] = [barX-6,barY];
    return [...hands,[barX-19,barY] as Point,[barX+16,barY] as Point];
  });
  const end = frames[0].length-1;
  return { ...base, frames, dynamic: [["bar",end-1,end],["barbell-end",end-1,0,0],["barbell-end",end,0,0]] };
}

function rearLungeBar() {
  const frame = (depth: number): Point[] => {
    const hip: Point = [150 - 12*depth,93 + 26*depth];
    const shoulder: Point = at(hip,2,-38);
    const fixed: Point = [159,155], moving: Point = [150 - 41*depth,152-5*depth];
    return [
      ...person(at(shoulder,2,-16),shoulder,hip,
        [at(shoulder,20,14),at(shoulder,12,-4)], [at(shoulder,-12,15),at(shoulder,-16,-4)],
        [[[158+depth*3,123],fixed],[[145-depth*7,123+depth*26],moving]],
        [at(fixed,9,2),at(moving,8,4+3*depth)]),
      at(shoulder,-29,-4),at(shoulder,26,-4),
    ];
  };
  return motion([frame(0),frame(.52),frame(1),frame(1),frame(.48)],[],rackShaft,890);
}

function stepThenLunge() {
  const block: Props = [[160,124,201,124],[162,124,162,157],[199,124,199,157]];
  type Stage = "floor" | "plant" | "peak" | "step-down" | "lunge" | "lunge-mid";
  const stageFrame: Record<Stage,[Point,Point,Limb,Limb]> = {
    floor: [[130,94],[135,57],[[137,125],[140,155]],[[128,126],[130,155]]],
    plant: [[144,91],[151,54],[[170,114],[174,122]],[[134,124],[135,155]]],
    peak: [[170,70],[174,33],[[172,98],[174,122]],[[159,100],[164,122]]],
    "step-down": [[140,92],[145,55],[[161,120],[170,123]],[[132,124],[132,155]]],
    "lunge-mid": [[121,104],[127,67],[[112,131],[94,150]],[[138,124],[138,155]]],
    lunge: [[119,121],[123,83],[[112,149],[84,148]],[[138,122],[137,155]]],
  };
  const sequence: Stage[] = ["floor","plant","peak","peak","step-down","floor","lunge-mid","lunge","lunge","lunge-mid","floor"];
  const frames = sequence.map(stage => {
    const [hip,shoulder,near,far] = stageFrame[stage];
    return person(at(shoulder,3,-16),shoulder,hip,
      [at(shoulder,7,23),at(shoulder,8,41)], [at(shoulder,-7,23),at(shoulder,-5,42)],
      [near,far],[at(near[1],9,stage==="lunge"?7:2),at(far[1],8,2)]);
  });
  return motion(frames,block,handheld,790);
}

type HipDrive = "plain-smith" | "staggered-smith" | "frog-smith" | "belt" | "pad" | "step" | "band" | "single" | "hands-on-bench";
function guidedHipDrive(kind: HipDrive) {
  const smith = kind.endsWith("smith");
  const machine = kind === "belt" || kind === "pad" || kind === "step" || kind === "band" || kind === "single";
  const frog = kind === "frog-smith", stagger = kind === "staggered-smith", single = kind === "single";
  const step = kind === "step";
  const frameFloor = step ? 138 : 155;
  const props: Props = [[83,113,122,113],[89,114,89,156],[116,114,116,156]];
  if (step) props.push([165,140,220,140],[165,141,165,158],[220,141,220,158]);
  if (machine) props.push([234,75,234,157],[224,95,245,95],[220,157,252,157],
    [216,139,234,95],[81,157,244,157],[231,108,241,108]);
  if (smith) props.push([115,30,115,158],[198,30,198,158],[115,30,198,30],[123,39,123,151],[190,39,190,151],
    [111,158,205,158],[116,149,127,149],[186,149,199,149]);
  const extra: Loads = smith ? rackShaft : machine
    ? [["bar",15,234,95],["bar",15,16],["pad",15,0,0],["barbell-end",16,0,0]] : [];
  if (kind === "band") extra.push(["knee-band",7,9]);
  if (kind === "belt" || single) extra.push(["line",15,17],["line",15,18],["ring",17,0,0]);
  const frame = (raise: number): Point[] => {
    const shoulder: Point = [111,105], hip: Point = [150,141-35*raise];
    const right: Point = [194,frameFloor], left: Point = [stagger ? 210 : frog ? 193 : 185,frameFloor-1];
    const lift: Point = [210,99-12*raise];
    const nearKnee: Point = frog ? [181,133-7*raise] : [185+(kind==="band"?5*raise:0),119-14*raise-(step?10:0)];
    const farKnee: Point = frog ? [167,109-8*raise] : single ? [182,105-18*raise]
      : [stagger ? 194 : 177,117-10*raise-(step?10:0)];
    const bar = at(hip,kind === "step" || kind === "pad" ? 6 : 0,kind === "pad" ? -1 : -6);
    const hand: Point = kind === "hands-on-bench" ? [98,110] : at(bar,10,2);
    const otherHand: Point = kind === "hands-on-bench" ? [91,110] : at(bar,-8,3);
    const body = person([97,94],shoulder,hip,
      [[111,122-10*raise],hand],[[107,123-9*raise],otherHand],[[nearKnee,right],[farKnee,single?lift:left]],
      [frog?[202,157]:at(right,9,2),frog?[200,149]:single?at(lift,8,3):at(left,9,2)]);
    return [...body,[123,bar[1]] as Point,[190,bar[1]] as Point,bar,[201,bar[1]+10] as Point,
      at(hip,-11,4),at(hip,12,4)];
  };
  return motion([frame(0),frame(.5),frame(1),frame(1),frame(.46)],props,extra,880);
}

function frogFloor(dumbbell: boolean): Illustration {
  const base = lowerHipConditioningIllustrations["3182"];
  const load: Loads = dumbbell ? [["dumbbell",2,5,-8]] : [];
  const frames = dumbbell ? base.frames.map(points => {
    const frame = [...points];
    frame[4] = at(points[2],11,-6);
    frame[6] = at(points[2],1,-7);
    return frame;
  }) : base.frames;
  return { ...base, frames, dynamic: [["foot-tip",8,11],["foot-tip",10,12],...load] };
}

function hipAbduction(bent: boolean) {
  const support: Props = [[101,83,101,157],[93,83,118,83],[94,157,113,157]];
  const make = (lift: number): Point[] => {
    const knee: Point = [171+lift*22,129-lift*(bent?21:14)];
    const ankle: Point = bent ? [knee[0]-7*lift,knee[1]+22] : [174+lift*43,154-lift*29];
    return person([153,43],[153,60],[153,102],[[124,85],[101,83]],[[172,85],[174,105]],
      [[knee,ankle],[[143,130],[143,155]]], [at(ankle,bent?6:9,2),[134,157]]);
  };
  return motion([make(0),make(.55),make(1),make(1),make(.5)],support,[],850);
}

function hingedBandExtension() {
  const props: Props = [[214,97,214,158],[203,97,233,97],[208,157,228,157],[223,143,223,157]];
  const frame = (lift: number): Point[] => {
    const knee: Point = [148 - 32*lift,130 - 17*lift], ankle: Point = [151 - 58*lift,154-34*lift];
    return person([199,76],[186,92],[142,112],[[199,109],[212,96]],[[190,106],[206,98]],
      [[knee,ankle],[[145,134],[151,155]]],[at(ankle,8,2),[162,157]]);
  };
  return motion([frame(0),frame(.53),frame(1),frame(1),frame(.48)],props,[["band",8,222,148],["ring",8,0,0]],850);
}

export const legacyLowerMotionIllustrations: Readonly<Record<string,Illustration>> = {
  "0078": rearLungeBar(),
  "0130": guidedHipDrive("hands-on-bench"),
  "0790": hipAbduction(true),
  "0791": hipAbduction(false),
  "11053": guidedHipDrive("staggered-smith"),
  "1543": oldDeadliftWithShaft("1543"),
  "2146": guidedHipDrive("belt"),
  "2147": guidedHipDrive("band"),
  "2148": guidedHipDrive("single"),
  "2742": guidedHipDrive("step"),
  "2743": guidedHipDrive("pad"),
  "2757": frogFloor(false),
  "2795": stepThenLunge(),
  "2966": oldSquatWithWeights("2966",true),
  "3110": guidedHipDrive("plain-smith"),
  "3308": oldDeadliftWithShaft("3308"),
  "4035": hingedBandExtension(),
  "4362": oldSquatWithWeights("4362"),
  "4962": oldSquatWithWeights("4962"),
  "5014": oldDeadliftWithShaft("5014"),
  "5017": oldSquatWithWeights("5017"),
  "6160": frogFloor(true),
  "6464": frogFloor(false),
  "6465": guidedHipDrive("frog-smith"),
};
