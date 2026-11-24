import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
type Side = "lead" | "rear";
type Punch = "straight" | "hook" | "uppercut";
type Tool = "bag" | "mitt";

const pose = (body: [Point, Point, Point], leadArm: Limb, rearArm: Limb, leadLeg: Limb, rearLeg: Limb, toes: Limb): Point[] =>
  [...body, ...leadArm, ...rearArm, ...leadLeg, ...rearLeg, ...toes];
const set = (frame: Point[], joints: Partial<Record<number, Point>>) =>
  frame.map((point, index) => joints[index] ?? point);
const soles: Attachments = [["foot-tip",8,11],["foot-tip",10,12]];
const gloves: Attachments = [["pad",4,0,0],["pad",6,0,0]];
const demo = (frames: Point[][], props?: Props, extra: Attachments = [], ms = 520): Illustration =>
  ({ frames, props, dynamic:[...soles,...extra], ms, reference:true });

const bag: Props = [
  [220,12,243,12],[229,12,229,24],[229,24,217,38],[229,24,244,38],
  [217,38,244,38],[217,38,212,47],[244,38,250,47],[212,47,212,129],[250,47,250,129],
  [212,129,219,137],[250,129,243,137],[219,137,243,137],[214,56,247,56],[214,121,247,121],
];

const mittProps = ([x,y]: Point, style: "mitt" | "flat" | "kick" = "mitt"): Props => {
  const width = style === "flat" ? 13 : style === "kick" ? 10 : 7;
  const height = style === "flat" ? 6 : style === "kick" ? 18 : 12;
  return [[x-width,y-height,x+width,y-height],[x+width,y-height,x+width,y+height],
    [x+width,y+height,x-width,y+height],[x-width,y+height,x-width,y-height]];
};

function padHolder([x,y]: Point, kickPad = false): Point[] {
  return pose([[266,44],[260,62],[262,106]],[[242,76],[x+3,y-(kickPad ? 10 : 4)]],[[244,82],[x+5,y+(kickPad ? 10 : 5)]],
    [[252,130],[242,151]],[[278,128],[287,152]],[[230,157],[276,158]]);
}

const guard = pose([[149,47],[146,65],[139,108]],[[169,85],[167,58]],[[149,86],[153,64]],
  [[159,127],[168,151]],[[124,130],[113,152]],[[180,158],[125,157]]);

function soloPunch(kind: Punch, side: Side, tool?: Tool) {
  const lead = side === "lead";
  const elbow = lead ? 3 : 5, glove = lead ? 4 : 6;
  const endpoint: Point = kind === "uppercut" ? [205,82] : kind === "hook" ? [211,73] : [211,60];
  const chamber = kind === "uppercut"
    ? set(guard,{0:[147,56],1:[144,74],2:[137,116],[elbow]:[147,100],[glove]:[158,97],7:[162,135],9:[129,134]})
    : kind === "hook"
      ? set(guard,{1:[143,66],[elbow]:[149,87],[glove]:[173,76],2:[138,108]})
      : set(guard,{1:lead ? [149,65] : [145,65],[elbow]:[168,76],[glove]:[184,63]});
  const reaching = set(guard,{
    0:kind === "uppercut" ? [156,46] : [157,48],1:lead ? [152,66] : [157,66],2:lead ? [142,109] : [147,110],
    [elbow]:kind === "uppercut" ? [179,104] : kind === "hook" ? [185,90] : [183,64],
    [glove]:endpoint,
    9:lead ? [125,130] : [127,130],10:lead ? [113,152] : [117,147],
  });
  const curve = kind === "hook" ? set(reaching,{[elbow]:[171,71],[glove]:[194,57]}) : chamber;
  const frames = [guard,chamber,...(kind === "hook" ? [curve] : []),reaching,chamber,guard];
  if (tool === "bag") return demo(frames,bag,gloves);
  if (tool === "mitt") {
    const center: Point = kind === "uppercut" ? [207,76] : [218,endpoint[1]];
    return { ...demo(frames,mittProps(center,kind === "uppercut" ? "flat" : "mitt"),gloves),
      partnerFrames:frames.map(() => padHolder(center)) };
  }
  return demo(frames);
}

const block = demo([
  guard,
  set(guard,{3:[164,85],4:[158,40],5:[154,83],6:[143,43],0:[146,49]}),
  set(guard,{3:[153,91],4:[161,55],5:[148,92],6:[150,55],0:[144,53],1:[145,68]}),
  guard,
],undefined,[],590);

const alternating = (() => {
  const lead = soloPunch("straight","lead").frames;
  const rear = soloPunch("straight","rear").frames;
  return demo([...lead.slice(0,4),...rear.slice(0,4)],undefined,[],465);
})();

type Cardio = "squat" | "diagonal" | "chair" | "balance" | "v-sit";
const chair: Props = [[114,113,180,113],[118,113,118,159],[174,113,174,159],[117,113,117,57],[117,57,140,57]];
const seated = pose([[145,48],[148,66],[145,108]],[[167,82],[157,62]],[[135,81],[141,62]],
  [[177,115],[179,152]],[[160,115],[159,152]],[[191,158],[170,157]]);

function cardioPunch(mode: Cardio, rising = false) {
  let base = pose([[153,49],[151,66],[151,110]],[[173,83],[161,66]],[[131,83],[143,66]],
    [[169,132],[180,152]],[[133,133],[122,152]],[[191,158],[111,158]]);
  if (mode === "chair") base = seated;
  if (mode === "squat") base = set(base,{
    0:[153,66],1:[151,84],2:[151,126],3:[173,101],4:[161,83],5:[131,102],6:[143,83],
    7:[185,130],8:[183,152],9:[118,130],10:[119,152],11:[196,158],12:[107,158],
  });
  if (mode === "balance") base = set(base,{7:[154,132],8:[153,152],11:[164,158],9:[126,116],10:[117,139],12:[122,145]});
  if (mode === "v-sit") base = set(base,{
    0:[128,76],1:[135,93],2:[151,150],3:[156,108],4:[147,90],5:[127,113],6:[137,92],
    7:[184,126],8:[202,118],9:[170,124],10:[192,117],11:[214,122],12:[204,122],
  });
  const [x,y] = base[1];
  const punch = (side: Side) => {
    const lead = side === "lead", direction = lead ? -1 : 1;
    const elbow = lead ? 3 : 5, glove = lead ? 4 : 6;
    const height = rising ? -33 : mode === "diagonal" ? -22 : mode === "v-sit" ? 4 : 0;
    return set(base,{
      0:[base[0][0]+direction*6,base[0][1]],1:[x+direction*8,y+2],
      [elbow]:[x+direction*(rising ? 14 : 23),y+8+(rising ? -15 : 0)],
      [glove]:[x+direction*(rising ? 19 : 45),y+height],
    });
  };
  const frames = mode === "balance" ? [base,punch("rear"),base] : [base,punch("lead"),base,punch("rear")];
  return demo(frames,mode === "chair" ? chair : undefined,[],mode === "balance" ? 650 : 480);
}

const chairRoll = (() => {
  const phases = [[155,49,144,78],[178,66,164,64],[159,82,146,52],[142,66,129,65]];
  const frames = phases.map(([nearX,nearY,farX,farY],i) => set(seated,{
    0:[145+(i===0 || i===3 ? -5 : 5),48],1:[148+(i===0 || i===3 ? -5 : 5),66],
    3:[nearX-11,nearY+17],4:[nearX,nearY],5:[farX-11,farY+15],6:[farX,farY],
  }));
  return demo(frames,chair,[],410);
})();

type Kick = "push" | "snap" | "knee" | "side" | "arc";
function kick(kind: Kick, tool?: Tool) {
  const sideOn = kind === "side" || kind === "arc";
  const start = set(guard,{7:[152,128],8:[150,152],11:[161,158],9:[124,130],10:[110,152],12:[123,157]});
  const chamber = set(start,{
    0:[145,50],1:[143,68],2:[138,111],7:[147,132],8:[145,153],11:[159,158],
    9:sideOn ? [172,101] : [175,101],10:sideOn ? [149,122] : [167,134],12:sideOn ? [161,126] : [176,140],
  });
  const extend = kind === "knee"
    ? set(chamber,{2:[151,106],7:[146,129],8:[143,145],11:[157,158],9:[207,108],10:[175,129],12:[181,138]})
    : set(chamber,{
      0:sideOn ? [127,58] : [140,54],1:sideOn ? [133,72] : [140,69],2:[145,109],
      9:kind === "arc" ? [180,98] : [180,104],
      10:kind === "snap" ? [203,103] : [211,105],
      12:kind === "push" || kind === "side" ? [211,94] : kind === "snap" ? [212,101] : [223,107],
      8:sideOn ? [144,149] : [145,153],11:sideOn ? [131,158] : [159,158],
      3:[160,84],4:[160,62],5:[141,87],6:[145,64],
    });
  const sweep = kind === "arc" ? set(chamber,{2:[145,107],9:[171,92],10:[181,115],12:[193,115]}) : chamber;
  const frames = [start,chamber,...(kind === "arc" ? [sweep] : []),extend,chamber,start];
  if (tool === "bag") return demo(frames,bag,gloves,kind === "snap" ? 430 : 520);
  if (tool === "mitt") {
    const center: Point = [kind === "knee" ? 217 : kind === "snap" ? 222 : 221,106];
    return { ...demo(frames,mittProps(center,"kick"),gloves,kind === "snap" ? 430 : 520),
      partnerFrames:frames.map(() => padHolder(center,true)) };
  }
  return demo(frames,undefined,[],kind === "snap" ? 430 : 520);
}

function lowTrainingKick(withBag: boolean): Illustration {
  const lift = set(guard,{9:[174,113],10:[160,137],12:[171,146]});
  const contact = set(lift,{0:[143,47],1:[141,65],2:[143,109],9:[183,118],10:[209,123],12:[218,122],
    7:[151,132],8:[154,153],11:[164,158]});
  return demo([guard,lift,contact,lift,guard],withBag ? bag : undefined,withBag ? gloves : [],480);
}

function hookKick(leg: Side): Illustration {
  const lead = leg === "lead";
  const knee = lead ? 7 : 9, ankle = lead ? 8 : 10, toes = lead ? 11 : 12;
  const pivot = lead ? 10 : 8, supportToes = lead ? 12 : 11;
  const step = set(guard,{[pivot]:[143,153],[supportToes]:[130,158]});
  const chamber = set(step,{[knee]:[169,102],[ankle]:[145,121],[toes]:[153,127]});
  const reach = set(chamber,{1:[143,67],2:[144,109],[knee]:[177,103],[ankle]:[213,105],[toes]:[223,113]});
  const fold = set(reach,{[knee]:[179,103],[ankle]:[191,120],[toes]:[202,126]});
  return demo([guard,step,chamber,reach,fold,chamber,guard],undefined,[],500);
}

function axeOrTurn(kind: "axe" | "back" | "hook"): Illustration {
  const prep = set(guard,{0:[142,50],1:[141,67],2:[142,109],7:[146,128],8:[142,152],11:[129,158],
    9:[163,118],10:[152,141],12:[165,147]});
  if (kind === "axe") {
    const high = set(prep,{9:[171,70],10:[183,35],12:[193,40]});
    const descent = set(high,{9:[179,99],10:[211,79],12:[218,85]});
    const follow = set(high,{9:[172,112],10:[204,130],12:[212,132]});
    return demo([guard,prep,high,descent,follow,guard],undefined,[],475);
  }
  const spin = set(prep,{0:[148,49],1:[140,64],3:[125,80],4:[135,58],5:[153,82],6:[143,60]});
  const extended = set(spin,{0:[109,61],1:[124,78],2:[151,105],9:[179,106],10:[213,106],12:[208,117]});
  const finish = kind === "hook" ? set(extended,{9:[181,102],10:[198,119],12:[208,125]}) : spin;
  return demo([guard,prep,spin,extended,finish,prep,guard],undefined,[],500);
}

function cableJab(): Illustration {
  const ready = set(guard,{7:[168,128],8:[181,153],11:[192,158],9:[125,129],10:[109,151],12:[118,158]});
  const out = set(ready,{0:[155,48],1:[155,65],2:[144,107],3:[185,64],4:[214,61]});
  const midpoint = set(ready,{3:[173,77],4:[189,59]});
  return demo([ready,midpoint,out,midpoint,ready],[[71,22,71,156],[62,156,80,156],[67,63,79,63]],
    [["cable",4,71,63],["pad",4,0,0]],530);
}

export const boxingIllustrations: Readonly<Record<string, Illustration>> = {
  "2303": lowTrainingKick(false), "4585": lowTrainingKick(true),
  "2302": hookKick("lead"), "2301": hookKick("rear"), "4588": kick("arc","bag"), "4597": kick("arc","mitt"),
  "2304": axeOrTurn("axe"), "2310": axeOrTurn("back"), "2306": axeOrTurn("hook"),
  "8880": cableJab(), "8900": cableJab(),
  "2272": soloPunch("straight","lead"),
  "2273": soloPunch("straight","rear"),
  "2274": soloPunch("uppercut","rear"),
  "2275": soloPunch("uppercut","lead"),
  "2305": kick("snap"),
  "2307": kick("side"),
  "2308": kick("arc"),
  "2309": kick("push"),
  "3171": soloPunch("hook","rear"),
  "3531": alternating,
  "4581": block,
  "4582": soloPunch("straight","lead","bag"),
  "4583": soloPunch("straight","rear","bag"),
  "4584": soloPunch("hook","rear","bag"),
  "4586": kick("push","bag"),
  "4587": kick("snap","bag"),
  "4589": soloPunch("straight","lead","mitt"),
  "4590": soloPunch("uppercut","lead","mitt"),
  "4591": soloPunch("straight","rear","mitt"),
  "4592": soloPunch("hook","rear","mitt"),
  "4593": soloPunch("uppercut","rear","mitt"),
  "4594": kick("push","mitt"),
  "4595": kick("knee","mitt"),
  "4596": kick("snap","mitt"),
  "4824": cardioPunch("diagonal"),
  "4989": cardioPunch("v-sit"),
  "5233": cardioPunch("squat"),
  "5975": cardioPunch("balance"),
  "7263": cardioPunch("chair",true),
  "8424": cardioPunch("chair"),
  "8634": chairRoll,
};
