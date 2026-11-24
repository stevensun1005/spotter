import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;
const edit = (pose: Point[], joints: Partial<Record<number, Point>>) => pose.map((point,index) => joints[index] ?? point);
const motion = (frames: Point[][], props: Props = [], dynamic: Gear = [], ms = 850): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });

function paralletteTuck(): Illustration {
  const start: Point[] = [[175,87],[159,101],[130,129],[165,120],[167,137],[153,117],[155,137],
    [143,124],[146,155],[132,125],[135,154]];
  const forward = edit(start,{0:[182,89],1:[166,102],2:[124,113],7:[134,130],8:[145,149],9:[128,128],10:[137,149]});
  const hold = edit(forward,{0:[185,88],1:[167,100],2:[125,92],3:[166,118],5:[157,115],
    7:[143,107],8:[132,121],9:[134,104],10:[124,118]});
  const lowBars: Props = [[144,137,176,137],[150,137,150,155],[170,137,170,155],
    [153,140,192,140],[158,140,158,156],[184,140,184,156]];
  return motion([start,forward,...Array<Point[]>(6).fill(hold),forward,start],lowBars,[],925);
}

function backGetUp(): Illustration {
  const tall: Point[] = [[150,43],[149,62],[148,105],[168,62],[153,46],[130,62],[147,46],
    [159,129],[161,155],[138,129],[136,155]];
  const knee = edit(tall,{0:[152,69],1:[151,86],2:[150,123],3:[171,84],4:[155,71],5:[131,84],6:[148,71],
    7:[154,151],8:[123,155],9:[145,151],10:[110,154]});
  const lunge = edit(knee,{7:[181,121],8:[181,155],9:[141,152],10:[111,153]});
  const reverse = edit(lunge,{7:lunge[9],8:lunge[10],9:lunge[7],10:lunge[8]});
  return motion([knee,lunge,tall,tall,lunge,knee,reverse,tall,tall,reverse,knee],[],[],690);
}

function explosiveKneelingPush(): Illustration {
  const top: Point[] = [[184,86],[170,98],[125,119],[171,126],[172,155],[161,127],[159,154],
    [100,152],[70,154],[91,151],[61,154]];
  const down = edit(top,{0:[188,126],1:[172,135],2:[128,137],3:[153,144],5:[147,143]});
  const push = edit(top,{0:[177,78],1:[164,94],2:[124,114],3:[165,124],5:[153,123]});
  return motion([top,down,push,push,top],[],[],670);
}

function heldDumbbellDriver(): Illustration {
  const low: Point[] = [[149,44],[148,62],[145,105],[161,87],[166,113],[153,89],[153,114],
    [160,130],[163,156],[134,130],[129,156]];
  const mid = edit(low,{3:[173,78],4:[193,88],5:[166,80],6:[186,86]});
  const top = edit(low,{3:[175,65],4:[201,65],5:[166,63],6:[193,62]});
  return motion([low,mid,top,top,mid],[],[["dumbbell",4,0,0],["dumbbell",6,0,0]],810);
}

function heldBandPartnerRow(): Illustration {
  const base: Point[] = [[170,86],[155,100],[114,123],[177,98],[204,99],[151,154],[173,155],
    [83,138],[61,155],[76,141],[54,153]];
  const row = edit(base,{3:[132,91],4:[147,106]});
  const helper: Point[] = [[264,59],[260,75],[260,111],[239,90],[224,102],[249,89],[233,99],
    [271,134],[286,155],[251,134],[239,155]];
  const frames = [base,row,row,base];
  return { ...motion(frames,[],[["band",4,224,102]],835), partnerFrames:frames.map(() => helper) };
}

function isometricWipers(): Illustration {
  const flat: Point[] = [[181,118],[165,129],[120,137],[175,140],[182,154],[149,141],[151,154],
    [92,148],[66,155],[85,147],[60,153]];
  const toward = (offset: number) => edit(flat,{0:[181+offset,118],1:[165+offset*.7,129],
    3:[175+offset*.3,140],5:[149+offset*.3,141]});
  const right = toward(15), left = toward(-17);
  return motion([flat,right,right,right,flat,left,left,left],[],[],800);
}

export const supportSkillIllustrations: Record<string, Illustration> = {
  "10989": paralletteTuck(), "4388": backGetUp(), "3555": explosiveKneelingPush(),
  "6141": heldDumbbellDriver(), "1501": heldBandPartnerRow(),
  "0500": isometricWipers(),
};
