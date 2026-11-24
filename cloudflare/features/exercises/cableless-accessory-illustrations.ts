import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Dynamic = NonNullable<Illustration["dynamic"]>;
const morph = (base: Point[], changed: Partial<Record<number, Point>>): Point[] => base.map((point,i)=>changed[i]??point);
const stance: Point[] = [[145,45],[145,65],[145,109],[161,88],[162,111],[131,88],[130,114],
  [158,132],[161,155],[132,130],[130,155]];
const rack: Props = [[212,25,212,155],[245,21,245,151],[212,25,245,21],[201,155,225,155],[232,153,258,151]];

function bandRaise(kind: "preacher" | "high-curl" | "reverse" | "high-row" | "long-row" | "twist"): Illustration {
  let start: Point[], end: Point[], gear: Dynamic, props: Props=[];
  if (kind === "preacher") {
    start=morph(stance,{0:[160,94],1:[152,109],2:[127,140],3:[164,127],4:[191,140],5:[155,129],6:[184,142],
      7:[152,127],8:[160,155],9:[141,130],10:[150,155]});
    end=morph(start,{4:[160,105],6:[155,107]});
    gear=[["band",4,212,151],["band",6,243,149]];props=rack;
  } else if (kind === "high-curl") {
    start=morph(stance,{3:[170,66],4:[195,66],5:[141,90],6:[139,111]});
    end=morph(start,{4:[150,61]});
    gear=[["band",4,231,66]];props=[[231,35,231,156],[219,156,244,156]];
  } else if (kind === "reverse" || kind === "high-row") {
    const y=kind==="reverse"?67:48;
    start=morph(stance,{3:[170,y+12],4:[196,y+20],5:[163,y+15],6:[190,y+23]});
    end=kind==="reverse"?morph(start,{3:[121,68],4:[94,69],5:[171,66],6:[192,68]}) : morph(start,{3:[160,68],4:[148,72],5:[136,66],6:[144,77]});
    gear=[["band",4,224,y],["band",6,224,y+4]];props=[[224,y-18,224,157],[212,156,236,156]];
  } else {
    start=morph(stance,{0:[130,84],1:[131,102],2:[134,147],3:[157,113],4:[183,114],5:[152,119],6:[178,121],
      7:[166,140],8:[196,149],9:[160,143],10:[190,152]});
    end=kind==="long-row"?morph(start,{3:[113,123],4:[143,122],5:[120,125],6:[147,127]})
      : morph(start,{0:[139,84],1:[133,102],3:[109,109],4:[89,110],5:[114,115],6:[94,116]});
    gear=kind==="long-row"?[["band",4,213,143],["band",6,243,141]]:[["band",4,71,117],["band",6,71,119]];
    props=kind==="long-row"?rack:[[71,83,71,156],[61,155,82,155]];
  }
  return {frames:[start,end,end,start],props,dynamic:gear,ms:970,reference:true};
}

function standingYoke(closeHands: boolean): Illustration {
  const start=morph(stance,{0:[157,46],1:[152,66],
    3:closeHands?[168,81]:[183,70],4:closeHands?[175,67]:[183,55],
    5:closeHands?[164,82]:[176,74],6:closeHands?[173,70]:[176,59],
    7:[155,133],8:[155,151],9:[141,132],10:[140,152]});
  const raised=morph(start,{0:[157,43],1:[152,60],
    3:[start[3][0],start[3][1]-4],5:[start[5][0],start[5][1]-4]});
  const gear=(f:Point[]):Point[]=>[...f,[166,f[1][1]-1],[226,74],
    [156,f[1][1]-2],[145,f[1][1]-3],[169,156],[153,156]];
  return {frames:[start,raised,raised,start].map(gear),props:[[226,36,226,155],[253,36,253,155],[226,36,253,36],
    [198,154,264,154],[213,36,230,36],[233,126,247,126],[233,133,247,133],[233,139,247,139]],
    dynamic:[["bar",11,12],["pad",13,0,0],["pad",14,0,0],["foot-tip",8,15],["foot-tip",10,16]],
    ms:1000,reference:true};
}

function seatedMachineExtension(): Illustration {
  const upright=morph(stance,{0:[134,72],1:[137,91],2:[148,130],3:[158,111],4:[149,98],5:[149,106],6:[155,99],
    7:[183,133],8:[182,147],9:[176,134],10:[173,148]});
  const folded=morph(upright,{0:[178,83],1:[166,96],3:[183,114],4:[168,108],5:[172,115],6:[176,104]});
  const back=morph(upright,{0:[128,68],1:[133,86]});
  const pad=(f:Point[]):Point[]=>[...f,[f[1][0]-5,f[1][1]+12],[123,126],[195,151],[185,151],[172,141],[181,141]];
  return {frames:[upright,folded,back,back,upright].map(pad),props:[[136,134,177,134],[139,135,139,155],[170,135,170,156],
    [115,58,115,156],[105,156,122,156],[165,156,196,156],[169,154,191,153],[177,145,197,145],[192,145,196,155]],
    dynamic:[["bar",11,12],["pad",11,0,0],["foot-tip",8,13],["foot-tip",10,14],["pad",15,0,0],["pad",16,0,0]],
    ms:970,reference:true};
}

function sideArmMachine(alternate: boolean): Illustration {
  const seated=morph(stance,{0:[149,64],1:[149,85],2:[150,124],3:[168,107],4:[173,133],5:[131,107],6:[126,132],
    7:[170,130],8:[162,155],9:[132,130],10:[137,155]});
  const up=morph(seated,{4:[159,82],6:[139,82]});
  const right=morph(seated,{4:[159,82]}),left=morph(seated,{6:[139,82]});
  const phase=alternate?[left,right,right,left]:[seated,up,up,seated];
  const legAndHands=(f:Point[]):Point[]=>[...f,[174,157],[126,157],[f[4][0]+4,f[4][1]-1],[f[6][0]-4,f[6][1]-1]];
  return {frames:phase.map(legAndHands),props:[[130,126,170,126],[138,126,138,156],[156,126,156,156],
    [141,77,141,127],[143,80,154,80],[96,39,96,155],[79,43,79,155],[79,43,96,39],[75,156,104,156],
    [82,112,92,112],[82,121,92,121],[82,130,92,130],[82,139,92,139],[96,92,120,92],[192,96,211,96],[211,96,211,155],
    [166,108,183,108],[116,108,132,108]],
    dynamic:[["bar",4,189,110],["bar",6,110,110],["pad",4,0,0],["pad",6,0,0],
      ["foot-tip",8,11],["foot-tip",10,12],["palm-up",4,13],["palm-up",6,14]],
    ms:990,reference:true};
}

function platePreacher(layout: "front" | "lower" | "single"): Illustration {
  const start=morph(stance,{0:[153,70],1:[150,88],2:[137,126],3:[173,107],4:[193,123],5:[163,111],6:[183,127],
    7:[160,135],8:[161,154],9:[144,138],10:[144,154]});
  const bent=morph(start,{4:[165,91],6:[158,97]});
  const pivot:Point=layout==="lower"?[194,136]:[190,110];
  const withPlate=(p:Point[]):Point[]=>[...p,p===start
    ? layout==="lower"?[217,145]:[221,129]
    : layout==="lower"?[214,119]:[222,92],[172,156],[155,156],pivot];
  const seat:Props=[[117,130,154,130],[121,130,121,156],[148,130,148,156],[158,94,189,112],
    [162,97,162,156],[175,109,205,153],[181,156,238,156],[211,124,211,157]];
  const single=(p:Point[])=>layout==="single"?morph(p,{5:[151,103],6:[156,96]}):p;
  return {frames:[start,bent,bent,start].map(p=>single(withPlate(p))),props:seat,
    dynamic:[["bar",4,14],["bar",11,14],["disc",11,0,0],["pad",4,0,0],["foot-tip",8,12],["foot-tip",10,13]],
    ms:1020,reference:true};
}

function leverReversePulldown(): Illustration {
  const ready=morph(stance,{0:[149,55],1:[149,74],2:[151,121],3:[172,54],4:[173,28],5:[124,54],6:[123,28],
    7:[172,126],8:[164,154],9:[131,126],10:[138,154]});
  const bottom=morph(ready,{3:[171,90],4:[177,67],5:[129,91],6:[126,66]});
  const draw=(f:Point[]):Point[]=>[...f,f===ready?[87,63]:[92,36],f===ready?[212,63]:[207,36],
    [f[4][0]+4,f[4][1]-2],[f[6][0]-4,f[6][1]-2],[175,154],[126,154],[171,113],[132,113]];
  return {frames:[ready,bottom,bottom,ready].map(draw),props:[[109,36,109,155],[191,36,191,155],[109,36,191,36],
    [130,125,173,125],[138,126,138,157],[167,126,167,157],[131,117,169,117],
    [107,149,194,149],[104,155,197,155],[109,155,107,149],[191,155,193,149],[154,91,154,112],[153,103,171,103]],
    dynamic:[["bar",4,191,43],["bar",6,109,43],["bar",11,109,43],["bar",12,191,43],["disc",11,0,0],["disc",12,0,0],
      ["palm-up",4,13],["palm-up",6,14],["foot-tip",8,15],["foot-tip",10,16],["pad",17,0,0],["pad",18,0,0]],
    ms:960,reference:true};
}

function ropeLondonBridge(): Illustration {
  const start=morph(stance,{0:[109,84],1:[118,101],2:[149,127],3:[136,91],4:[163,90],5:[132,106],6:[150,105],
    7:[169,129],8:[185,155],9:[156,136],10:[176,155]});
  const pull=morph(start,{0:[141,57],1:[144,77],2:[160,112],3:[147,92],4:[174,74],5:[154,84],6:[171,67],
    7:[173,119],8:[180,150]});
  const switchGrip=morph(pull,{3:[150,89],4:[169,85],5:[158,78],6:[184,61]});
  return {frames:[start,pull,switchGrip,pull,start],props:[[192,19,230,19],[229,19,229,156],[216,156,242,156]],
    dynamic:[["line",4,207,19],["line",4,6],["line",6,164,152]],ms:940,reference:true};
}

function hammerTire(): Illustration {
  const ready=morph(stance,{0:[137,48],1:[137,67],2:[140,110],3:[152,53],4:[134,33],5:[123,52],6:[123,37],
    7:[158,133],8:[164,156],9:[125,133],10:[122,155]});
  const swing=morph(ready,{0:[161,77],1:[152,89],2:[135,115],3:[172,99],4:[184,115],5:[163,103],6:[172,112]});
  const returnUp=morph(ready,{3:[159,75],4:[181,69],5:[147,79],6:[169,76]});
  return {frames:[[ready,[103,25]],[returnUp,[192,58]],[swing,[206,139]],[swing,[207,142]],[returnUp,[195,75]]].map(([b,h])=>
    [...(b as Point[]),h as Point,[203,147],[267,147]]),dynamic:[["bar",6,11],["pad",11,0,0],["tire-outline",12,13]],ms:800,reference:true};
}

export const cablelessAccessoryIllustrations: Record<string, Illustration> = {
  "4085":bandRaise("preacher"),"0986":bandRaise("high-curl"),"0993":bandRaise("reverse"),"1022":bandRaise("high-row"),
  "5005":bandRaise("long-row"),"1011":bandRaise("twist"),"0580":standingYoke(false),"1439":standingYoke(true),
  "0573":seatedMachineExtension(),"1032":sideArmMachine(true),"4336":sideArmMachine(false),"1872":platePreacher("front"),
  "2660":platePreacher("lower"),"9862":platePreacher("single"),"2736":leverReversePulldown(),"0609":ropeLondonBridge(),"1496":hammerTire(),
};
