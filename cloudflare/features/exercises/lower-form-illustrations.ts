import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];
type PairPose = { standard: Point[]; error: Point[] };

function pose(head: Point, shoulder: Point, hip: Point, arms: [Limb, Limb], legs: [Limb, Limb], toes: [Point, Point]) {
  return [head, shoulder, hip, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function shift(points: Point[], viewport: number): Point[] {
  return points.map(([x, y]) => [viewport + (x - 155) * .78, 17 + y * .9]);
}

function comparison(sequence: PairPose[], bar: "back" | "hands" | "none", props: Props = [], spine = false): Illustration {
  const frames = sequence.map(({standard,error}) => [...shift(standard,230), ...shift(error,89)]);
  const partnerFrames = sequence.map(({error}) => shift(error,89));
  const extras: Attachments = [["foot-tip",8,11],["foot-tip",10,12],
    ["foot-tip",22,25],["foot-tip",24,26]];
  if (bar === "back") extras.push(["bar",4,6], ["bar",18,20],
    ["barbell-end",4,1,0],["barbell-end",6,-1,0],["barbell-end",18,1,0],["barbell-end",20,-1,0]);
  if (bar === "hands") extras.push(["bar",4,6],["bar",18,20],["barbell-end",4,2,0],["barbell-end",18,2,0]);
  const status: Props = [[83,26,94,36],[94,26,83,36],[222,32,227,37],[227,37,237,25]];
  return { frames, partnerFrames, spine: spine ? [13] : undefined, partnerSpine: spine ? [13] : undefined,
    dynamic: extras, props: [...status,...props], ms: 930, reference: true };
}

function kneeTracking(timing: "middle" | "bottom" | "hack") {
  const hack = timing === "hack";
  const emphasis = timing === "middle" ? .6 : 1;
  const rig: Props = [];
  if (hack) {
    for (const x of [89,230]) {
      rig.push([x-46,158,x+45,158],[x-44,158,x-34,48],[x+43,158,x+33,48],
        [x-38,146,x-28,46],[x+37,146,x+27,46],[x-34,47,x+34,47]);
    }
  }
  function frame(depth: number, wrong: boolean): Point[] {
    const y = 61 + depth * 36;
    const kneeSpan = 19 + depth * (wrong ? -13 : 9);
    const grip = hack ? 19 : 32;
    const body = pose([155,y-17],[155,y],[155,y+34],
      [[[184,y+15],[155+grip,y+(hack? 5:-4)]],[[127,y+15],[155-grip,y+(hack? 5:-4)]]],
      [[[155+kneeSpan,123+depth*4],[178,154]],[[155-kneeSpan,123+depth*4],[132,154]]],
      [[187,156],[123,156]]);
    return [...body,[155,y+17]];
  }
  const pairs = [emphasis,0,emphasis,emphasis].map(d=>({standard:frame(d,false),error:frame(d,true)}));
  const motion = comparison(pairs,hack ? "none" : "back",rig);
  if (hack) {
    motion.dynamic?.push(["pad",1,-13,-4],["pad",1,13,-4],["pad",15,-13,-4],["pad",15,13,-4]);
  }
  return motion;
}

function squatSide(kind: "back" | "hips") {
  function frame(stage: "low" | "rise" | "high", wrong: boolean): Point[] {
    const low = stage === "low", rising = stage === "rise";
    const correctHip: Point = low ? [137,125] : rising ? [139,107] : [150,91];
    const hip: Point = wrong && kind === "hips" && rising ? [120,98] : correctHip;
    const shoulder: Point = wrong && kind === "hips" && rising ? [154,85] : low ? [156,88] : rising ? [158,71] : [153,53];
    const round = wrong && kind === "back" && !(!low && !rising);
    const spine: Point = round ? [(shoulder[0]+hip[0])/2-10,(shoulder[1]+hip[1])/2-7]
      : [(shoulder[0]+hip[0])/2,(shoulder[1]+hip[1])/2];
    const knee: Point = low ? [172,128] : rising ? [170,122] : [153,121];
    const [x,y] = shoulder;
    return [...pose([x+(low?8:3),y-(round?11:15)],shoulder,hip,
      [[[x+3,y+18],[x+8,y-4]],[[x-16,y+15],[x-17,y-2]]],
      [[knee,[158,154]],[[knee[0]-7,knee[1]+1],[151,154]]],[[172,156],[165,156]]),spine];
  }
  const stages = kind === "back" ? ["low","high","rise","low","low"] as const : ["rise","high","low","rise","rise"] as const;
  return comparison(stages.map(stage=>({standard:frame(stage,false),error:frame(stage,true)})),"back",[],true);
}

function deadliftForm(kind: "back" | "hips") {
  function frame(stage: "set" | "travel" | "top", wrong: boolean): Point[] {
    const low = stage === "set", middle = stage === "travel";
    const highHips = kind === "hips" && wrong && (low || middle);
    const curved = kind === "back" && wrong && (low || middle);
    const shoulder: Point = low ? [175,92] : middle ? [170,69] : [155,54];
    const hip: Point = low ? [134,107] : middle ? [135,95] : [151,92];
    if (highHips) {
      hip[0] -= 7;
      hip[1] -= 17;
    }
    const nearKnee: Point = low ? [158-(highHips? 9:0),132] : middle ? [156-(highHips? 11:0),127] : [155,121];
    const [x,y] = shoulder;
    const handY = low ? 146 : middle ? 111 : 108;
    const head: Point = [x+(low? 13:5),y-(curved ? 3 : 14)];
    const spine: Point = [(x+hip[0])/2-(curved?10:0),(y+hip[1])/2-(curved?8:0)];
    return [...pose(head,shoulder,hip,
      [[[173,y+26],[171,handY]],[[165,y+24],[164,handY]]],
      [[nearKnee,[156,154]],[[nearKnee[0]-7,nearKnee[1]+2],[147,154]]],[[174,156],[166,156]]),spine];
  }
  const stages = ["set","set","travel","top","travel"] as const;
  return comparison(stages.map(stage=>({standard:frame(stage,false),error:frame(stage,true)})),"hands",[],kind==="back");
}

function lungeForm() {
  const frame = (depth: number, wrong: boolean): Point[] => {
    const hip: Point = [145+(wrong? 23:6)*depth,98+depth*23];
    const shoulder: Point = [hip[0]+(wrong? 7*depth:0),hip[1]-39];
    const x = shoulder[0], y = shoulder[1];
    return [...pose([x+4,y-17],shoulder,hip,[[[x+12,y+22],[x+16,y+39]],[[x-9,y+20],[x-13,y+39]]],
      [[[154+(wrong?57:28)*depth,126],[151+31*depth,155]],[[137-5*depth,126+25*depth],[139-26*depth,155]]],
      [[162+31*depth,157],[148-21*depth,157]]),[x,y+20]];
  };
  return comparison([1,0,.52,1,1].map(d=>({standard:frame(d,false),error:frame(d,true)})),"none");
}

function posture(side: boolean) {
  const make = (wrong: boolean,d: number): Point[] => {
    const head: Point = side ? [150+(wrong? 17:0),42-d] : [153+(wrong? 12:0),43-d];
    const shoulder: Point = side ? [150+(wrong? 6:0),59-d] : [153+(wrong? 7:0),60-d];
    const hip: Point = [152,100];
    return [...pose(head,shoulder,hip,
      [[[(side?158:172),83-d],[(side?160:175),108]],[[side?144:135,82-d],[side?145:132,108]]],
      [[[side?157:169,128],[side?152:171,155]],[[side?150:138,127],[side?145:136,155]]],
      [[side?166:178,157],[side?158:127,157]]),[151,79]];
  };
  return comparison([0,2,0].map(d=>({standard:make(false,d),error:make(true,d)})),"none");
}

export const lowerFormIllustrations: Readonly<Record<string,Illustration>> = {
  "2345":kneeTracking("hack"),
  "2354":deadliftForm("back"),
  "2357":deadliftForm("hips"),
  "2359":kneeTracking("bottom"),
  "2360":kneeTracking("middle"),
  "2361":squatSide("hips"),
  "2362":squatSide("back"),
  "3673":posture(false),
  "3674":posture(true),
  "4959":lungeForm(),
};
