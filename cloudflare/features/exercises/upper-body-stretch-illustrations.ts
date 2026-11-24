import type { Illustration, Point } from "./motion-data";

type Body = [Point, Point, Point];
type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

const pose = (body: Body, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb, toes: Limb): Point[] =>
  [...body,...nearArm,...farArm,...nearLeg,...farLeg,...toes];
const set = (frame: Point[], joints: Partial<Record<number, Point>>) =>
  frame.map((joint,index) => joints[index] ?? joint);
const feet: Attachments = [["foot-tip",8,11],["foot-tip",10,12]];
const move = (frames: Point[][], props?: Props, extra: Attachments = [], ms = 990): Illustration =>
  ({frames,props,ms,reference:true,dynamic:[...feet,...extra]});
const hold = (frames: Point[][], props?: Props, extra?: Attachments) => {
  const end = frames.at(-1)!;
  return move([...frames,end,end,end],props,extra);
};
const throughHands = (frame: Point[]): Point[] => {
  const [x1,y1] = frame[4], [x2,y2] = frame[6];
  const length = Math.hypot(x2-x1,y2-y1) || 1;
  const dx = (x2-x1)*12/length, dy = (y2-y1)*12/length;
  return [...frame,[x1-dx,y1-dy],[x2+dx,y2+dy]];
};

const tall = pose([[154,43],[153,62],[152,107]],[[172,89],[175,115]],[[138,89],[135,115]],
  [[161,130],[161,152]],[[143,130],[142,152]],[[173,158],[129,158]]);
const profile = pose([[158,46],[151,63],[147,109]],[[157,91],[159,116]],[[146,90],[143,115]],
  [[153,132],[155,152]],[[140,132],[143,152]],[[168,158],[155,156]]);
const wall: Props = [[231,23,231,159],[231,137,241,131],[231,150,242,145]];
const mat: Props = [[53,159,268,159]];

function cuff(mode: "down" | "up" | "elbow-out") {
  if (mode === "down") {
    const back = set(profile,{3:[138,95],4:[133,106],5:[124,93],6:[132,105]});
    return hold([profile,back,set(back,{3:[131,88],4:[117,94],5:[112,102],6:[118,95]})]);
  }
  const side = mode === "elbow-out";
  const reach = set(tall,{3:side ? [187,61] : [170,29],4:side ? [162,50] : [158,65],
    5:[140,44],6:side ? [181,61] : [169,29]});
  const aided = set(reach,{3:side ? [198,65] : [164,32],4:side ? [162,49] : [152,72],6:side ? [196,63] : [165,32]});
  return hold([tall,reach,aided]);
}

function crossChest(rounded: boolean) {
  const reach = set(tall,{3:[134,72],4:[104,73],5:[116,90],6:[135,73]});
  const end = set(reach,{0:rounded ? [159,53] : [160,43],1:rounded ? [155,69] : [156,62],
    3:[126,69],4:[97,68],5:[112,90],6:[128,71]});
  if (!rounded) return hold([tall,reach,end]);
  return {...hold([[...tall,[153,84]],[...reach,[153,84]],[...end,[145,84]]]),spine:[13]};
}

function behindChest(mode: "clasp" | "bend" | "pvc") {
  const joined = set(profile,{3:[138,91],4:[130,117],5:[132,89],6:[mode === "pvc" ? 112 : 129,117]});
  const finish = set(joined,{
    0:mode === "bend" ? [145,45] : [162,45],1:mode === "bend" ? [143,65] : [153,64],
    3:[125,87],4:[105,109],5:[121,88],6:[mode === "pvc" ? 88 : 104,109],
  });
  if (mode !== "pvc") return hold([profile,joined,finish]);
  const ends = (frame: Point[]) => {
    const [x,y] = frame[4], [farX,farY] = frame[6];
    return [...frame,[farX-12,farY],[x+12,y]] as Point[];
  };
  return hold([ends(joined),ends(finish)],undefined,[["line",13,14]]);
}

function shoulderPress(direction: "back" | "out" | "front") {
  if (direction === "back") return move([profile,set(profile,{3:[134,86],4:[110,107]}),profile,
    set(profile,{5:[131,84],6:[105,103]})]);
  if (direction === "out") {
    const ready = set(tall,{3:[164,101],4:[149,94],5:[141,101],6:[155,95]});
    return move([ready,set(ready,{4:[194,97]}),ready,set(ready,{6:[110,97]})]);
  }
  const ready = set(profile,{3:[170,90],4:[171,71],5:[159,87],6:[160,72]});
  return move([ready,set(ready,{3:[180,71],4:[211,71]}),ready,set(ready,{5:[175,66],6:[204,66]})]);
}

const elbowExtensor = hold([
  set(profile,{3:[184,66],4:[212,67],5:[162,92],6:[173,112]}),
  set(profile,{3:[188,67],4:[166,81],5:[174,95],6:[178,79]}),
  set(profile,{3:[185,68],4:[157,71],5:[166,96],6:[166,73]}),
]);

const frontChair: Props = [[113,116,192,116],[119,116,119,159],[186,116,186,159],
  [118,116,118,57],[187,116,187,57],[118,57,187,57]];
const sideChair: Props = [[104,116,176,116],[110,116,110,159],[170,116,170,159],
  [108,116,108,58],[108,58,133,58]];
const sideSeated = pose([[140,49],[137,67],[132,111]],[[151,90],[160,113]],[[128,90],[139,109]],
  [[171,115],[174,151]],[[160,116],[163,151]],[[187,158],[175,157]]);
const frontSeated = pose([[153,49],[152,67],[152,112]],[[171,90],[165,113]],[[136,90],[141,113]],
  [[171,117],[171,151]],[[134,117],[134,151]],[[183,158],[122,158]]);
const chairChest = move([frontSeated,set(frontSeated,{0:[161,48],1:[160,66],3:[191,67],4:[218,74]}),
  frontSeated,set(frontSeated,{0:[144,48],1:[145,66],5:[116,68],6:[88,75]})],frontChair,[],750);

function overhead(mode: "standing" | "back" | "chair" | "chair-back") {
  const sitting = mode === "chair" || mode === "chair-back";
  const back = mode === "back" || mode === "chair-back";
  const base = sitting ? sideSeated : tall;
  const [sx,sy] = base[1];
  const raise = set(base,{3:[sx+(sitting ? 4 : 11),sy-20],4:[sitting ? sx-1 : sx+10,sy-43],
    5:[sx-(sitting ? 4 : 11),sy-21],6:[sitting ? sx+1 : sx-9,sy-43]});
  const end = set(raise,{0:[base[0][0]-(back ? 9 : 0),base[0][1]-2],1:[sx-(back ? 8 : 0),sy-3],
    3:[raise[3][0]-(back ? 8 : 0),raise[3][1]-3],4:[raise[4][0]-(back ? 11 : 0),raise[4][1]-7],
    5:[raise[5][0]-(back ? 8 : 0),raise[5][1]-3],6:[raise[6][0]-(back ? 11 : 0),raise[6][1]-7]});
  return hold([base,raise,end],sitting ? sideChair : undefined);
}

const rhomboid = (() => {
  const start = set(sideSeated,{3:[160,76],4:[183,72],5:[154,75],6:[181,72]});
  const end = set(start,{0:[162,62],1:[147,76],3:[172,82],4:[201,83],5:[169,80],6:[199,82]});
  return {...hold([[...start,[134,88]],[...end,[128,91]]],sideChair),spine:[13]};
})();

const wrapStretch = (() => {
  const open = set(tall,{3:[193,69],4:[222,72],5:[110,69],6:[83,73]});
  return move([open,set(tall,{0:[149,45],3:[133,90],4:[167,65],5:[175,90],6:[139,68]}),
    open,set(tall,{0:[158,44],3:[133,83],4:[168,63],5:[175,93],6:[139,72]})],undefined,[],610);
})();

const elbowsBack = hold([
  set(tall,{3:[179,70],4:[157,54],5:[128,70],6:[151,54]}),
  set(tall,{0:[153,39],1:[152,59],3:[202,64],4:[159,54],5:[103,64],6:[149,53]}),
]);

const lyingSet = pose([[85,144],[104,150],[147,151]],[[130,144],[146,151]],[[124,147],[137,150]],
  [[176,115],[193,151]],[[168,117],[184,153]],[[205,158],[196,158]]);
function lyingTriceps(stick: boolean) {
  const setup = set(lyingSet,{3:[121,115],4:[120,84],5:[101,117],6:[109,88]});
  const flex = set(setup,{3:[114,109],4:[79,123],5:[126,111],6:[109,110]});
  const reach = set(flex,{3:[108,110],4:[71,124],5:[125,108],6:stick ? [121,100] : [109,110]});
  return stick ? hold([setup,flex,reach].map(throughHands),mat,[["line",13,14]]) : hold([setup,flex,reach],mat);
}

const wallTriceps = hold([
  set(profile,{3:[230,60],4:[199,45]}),
  set(profile,{0:[181,77],1:[170,89],2:[150,117],3:[230,60],4:[201,43],7:[159,136]}),
],wall);

const dipStretch = (() => {
  const start = pose([[141,76],[141,94],[148,141]],[[117,121],[98,155]],[[111,124],[91,154]],
    [[183,126],[203,151]],[[176,127],[194,152]],[[217,158],[207,158]]);
  return hold([start,set(start,{0:[148,85],1:[147,101],2:[153,147],3:[108,121],5:[103,124],7:[182,129]})],mat);
})();

const benchBehind: Props = [[73,112,150,112],[79,112,79,159],[144,112,144,159]];
const benchSupportedArms = (() => {
  const start = set(profile,{0:[163,53],1:[154,69],2:[154,110],3:[133,90],4:[121,112],5:[128,92],6:[114,112]});
  const end = set(start,{0:[181,66],1:[171,83],2:[172,119],3:[144,97],5:[137,98],7:[172,136],9:[160,136]});
  return hold([start,end],benchBehind);
})();
const benchSeat = set(sideSeated,{3:[120,93],4:[112,112],5:[114,93],6:[105,112]});
const benchShoulder = hold([benchSeat,set(benchSeat,{0:[168,61],1:[165,79],2:[160,127],
  3:[135,94],5:[129,96],7:[185,128],9:[175,128]})],benchBehind);

const kneeling = pose([[153,46],[153,64],[152,113]],[[174,89],[171,113]],[[140,93],[144,111]],
  [[192,119],[192,152]],[[116,153],[82,153]],[[205,158],[67,157]]);
const pvcPec = hold([
  set(kneeling,{3:[162,47],4:[179,28],5:[165,83],6:[179,93]}),
  set(kneeling,{0:[151,47],1:[150,64],3:[147,44],4:[160,17],5:[151,85],6:[170,87]}),
].map(throughHands),mat,[["line",13,14]]);

const kneelForward = pose([[169,69],[158,85],[114,100]],[[179,116],[181,155]],[[165,116],[166,154]],
  [[115,151],[86,153]],[[105,151],[75,153]],[[74,158],[63,157]]);
const forwardPrayer = hold([
  set(kneeling,{0:[133,56],1:[132,74],2:[113,132],3:[147,101],4:[121,82],5:[116,98],6:[139,83],
    7:[155,151],8:[94,152],11:[77,157],9:[144,152],10:[85,153],12:[67,157]}),
  pose([[162,149],[145,142],[105,133]],[[132,150],[132,135]],[[120,144],[140,145]],
    [[135,152],[91,153]],[[124,152],[80,153]],[[78,158],[68,157]]),
],mat);

const latBench: Props = [[174,111,239,111],[180,111,180,159],[233,111,233,159]];
const elbowsOnBench = set(kneelForward,{3:[195,110],4:[221,98],5:[183,110],6:[212,98]});
const latKneeling = hold([elbowsOnBench,set(elbowsOnBench,{0:[165,121],1:[150,115],2:[104,120]})],
  [...mat,...latBench]);

function latUpright(mode: "wall" | "pole" | "side" | "pvc") {
  if (mode === "side" || mode === "pvc") {
    const stick = mode === "pvc";
    const arms = set(tall,{
      3:[161,42],4:[167,17],
      5:stick ? [139,43] : [136,89],6:stick ? [145,29] : [137,115],
    });
    const lean = set(arms,{0:[132,52],1:[140,68],2:[158,108],3:[141,47],4:[131,20],
      5:stick ? [126,48] : [127,95],6:stick ? [116,33] : [134,113]});
    return stick ? hold([arms,lean].map(throughHands),undefined,[["line",13,14]]) : hold([arms,lean]);
  }
  const post = mode === "pole" ? 223 : 230;
  const reach = set(profile,{0:[171,51],1:[164,68],2:[154,108],3:[198,58],4:[post,46],
    7:[152,132],8:[154,152],11:[166,158],9:[140,132],10:[141,153]});
  const stretch = set(reach,{0:mode === "wall" ? [162,90] : [149,78],1:mode === "wall" ? [148,93] : [139,85],
    2:[115,118],3:mode === "wall" ? [189,69] : [181,65],5:[137,111],6:[144,120],
    7:[138,135],9:[125,134]});
  return hold([reach,stretch],mode === "wall" ? wall : [[223,24,223,159],[208,158,238,158]]);
}

function fixedBar(mode: "waist" | "overhand" | "wall-bars") {
  const height = mode === "waist" ? 104 : mode === "wall-bars" ? 60 : 74;
  const start = set(profile,{0:[173,49],1:[166,66],2:[153,110],3:[188,81],4:[227,height],
    5:[181,82],6:[217,height],7:[155,132],8:[158,153],11:[170,158]});
  const end = set(start,{
    0:[149,mode === "waist" ? 111 : 85],1:[145,mode === "waist" ? 106 : 88],2:[113,mode === "waist" ? 112 : 122],
    3:[185,mode === "waist" ? 104 : 73],5:[175,mode === "waist" ? 103 : 75],7:[139,135],9:[129,134],
    8:[149,153],10:[139,152],11:[161,158],12:[151,158],
  });
  const stand: Props = mode === "wall-bars"
    ? [[218,31,218,159],[235,31,235,159],[218,38,235,38],[218,60,235,60],
      [218,81,235,81],[218,103,235,103],[218,124,235,124],[218,145,235,145]]
    : [[228,38,228,159],[214,height,241,height],[217,159,240,159]];
  return hold([start,end],stand);
}

const walkout = (() => {
  const start = set(profile,{0:[195,104],1:[180,115],2:[140,111],3:[185,133],4:[192,155],5:[176,133],6:[181,154]});
  const extended = set(start,{
    0:[217,90],1:[203,105],2:[144,122],3:[205,131],4:[206,155],5:[195,130],6:[195,154],
    7:[115,138],8:[83,154],11:[94,158],9:[104,139],10:[72,154],12:[83,158],
  });
  const sitBack = set(extended,{
    0:[172,125],1:[159,114],2:[111,113],3:[183,137],5:[172,135],
    7:[98,145],8:[85,153],9:[89,145],10:[74,152],
  });
  return move([profile,start,extended,sitBack,sitBack,sitBack,extended,start],mat,[],960);
})();

const preacher = (() => {
  const start = set(sideSeated,{0:[133,50],1:[132,68],2:[125,113],
    3:[171,103],4:[189,91],5:[165,102],6:[182,89],7:[161,121],9:[153,121]});
  const end = set(start,{4:[196,125],6:[190,124]});
  const bar = (frame: Point[]) => {
    const [x,y] = frame[4], [otherX,otherY] = frame[6];
    return [...frame,[otherX-18,otherY+2],[otherX-8,otherY+2],frame[6],frame[4],[x+8,y+5],[x+21,y+5]] as Point[];
  };
  const equipment: Props = [[94,116,145,116],[101,116,101,159],[136,116,136,159],
    [143,79,186,122],[145,74,191,120],[164,106,164,159],[150,158,178,158]];
  return hold([bar(start),bar(end)],equipment,[
    ["line",13,14],["line",14,15],["line",15,16],["line",16,17],["line",17,18],
  ]);
})();

const crossArm = crossChest(false);
const backHands = behindChest("clasp");
const overheadAssist = cuff("up");
export const upperBodyStretchIllustrations: Readonly<Record<string, Illustration>> = {
  "1052": fixedBar("waist"),
  "1480": backHands,
  "1492": dipStretch,
  "1788": overhead("standing"),
  "1797": overhead("back"),
  "1799": fixedBar("wall-bars"),
  "1801": latUpright("pole"),
  "1802": latUpright("side"),
  "1817": benchSupportedArms,
  "1820": preacher,
  "1828": overheadAssist,
  "1829": wallTriceps,
  "1830": elbowExtensor,
  "1970": backHands,
  "1972": benchShoulder,
  "1979": crossArm,
  "1984": crossArm,
  "1985": cuff("elbow-out"),
  "1986": overheadAssist,
  "1987": cuff("down"),
  "2087": crossChest(true),
  "2935": pvcPec,
  "3516": behindChest("bend"),
  "3995": wrapStretch,
  "4515": backHands,
  "4559": latKneeling,
  "4672": elbowsBack,
  "5146": fixedBar("overhand"),
  "5400": latUpright("pvc"),
  "5401": behindChest("pvc"),
  "6539": forwardPrayer,
  "6774": rhomboid,
  "7623": latUpright("wall"),
  "8369": overhead("chair-back"),
  "8431": overhead("chair"),
  "8615": chairChest,
  "10590": walkout,
  "10739": lyingTriceps(false),
  "10740": lyingTriceps(true),
  "11793": shoulderPress("out"),
  "11795": shoulderPress("back"),
  "11797": shoulderPress("front"),
};
