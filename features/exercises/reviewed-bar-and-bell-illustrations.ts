import type { Illustration, Point } from "./motion-data";

const shape = (pose: Point[], updates: Partial<Record<number, Point>>): Point[] => pose.map((p,i) => updates[i] ?? p);
const stand: Point[] = [[149,48],[148,67],[149,107],[162,89],[164,108],[134,89],[133,108],
  [160,132],[163,156],[136,132],[133,156]];

function poseWithBar(pose: Point[], middle: Point, halfWidth: number): Point[] {
  return [...pose,[middle[0]-halfWidth,middle[1]],[middle[0]+halfWidth,middle[1]]];
}
const bar: NonNullable<Illustration["dynamic"]> = [["bar",11,12],["barbell-end",11,0,0],["barbell-end",12,0,0]];

function reclinedBar(mode: "decline-elbows" | "incline-scapula" | "decline-press"): Illustration {
  if (mode === "incline-scapula") {
    const upper: Point[] = [[181,68],[168,83],[133,117],[158,63],[153,39],[169,64],[165,39],
      [103,116],[101,153],[96,121],[89,153]];
    const protracted = shape(upper,{1:[164,80],3:[152,58],4:[146,34],5:[164,60],6:[160,34]});
    return {frames:[poseWithBar(upper,[157,39],34),poseWithBar(protracted,[151,34],34),poseWithBar(protracted,[151,34],34)],
      props:[[126,122,176,75],[91,122,135,122],[104,122,104,157],[128,154,169,89],[98,156,140,156]],dynamic:bar,ms:1050,reference:true};
  }
  const lowered: Point[] = [[203,133],[185,126],[132,105],[183,96],[197,113],[178,97],[188,112],
    [106,92],[87,121],[102,97],[81,123]];
  if (mode === "decline-press") {
    const locked = shape(lowered,{3:[203,94],4:[216,64],5:[160,93],6:[150,64]});
    const chest = shape(lowered,{3:[207,118],4:[213,102],5:[150,119],6:[147,102]});
    return {frames:[poseWithBar(locked,[181,64],48),poseWithBar(chest,[180,102],48),poseWithBar(chest,[180,102],48)],
      props:[[99,103,205,140],[105,106,105,157],[189,136,189,156],[83,117,102,122]],dynamic:bar,ms:1040,reference:true};
  }
  const top = shape(lowered,{4:[185,68],6:[177,68]});
  return {frames:[poseWithBar(top,[180,68],34),poseWithBar(lowered,[191,113],34),poseWithBar(lowered,[191,113],34)],
    props:[[99,103,205,140],[105,106,105,157],[189,136,189,156],[83,117,102,122]],dynamic:bar,ms:990,reference:true};
}

function uprightRaise(): Illustration {
  const bottom = shape(stand,{3:[169,92],4:[167,115],5:[134,92],6:[126,115]});
  const top = shape(bottom,{3:[174,80],4:[165,96],5:[127,80],6:[124,96]});
  return {frames:[poseWithBar(bottom,[147,115],38),poseWithBar(top,[145,96],38),poseWithBar(top,[145,96],38)],
    props:[[96,116,96,157],[201,116,201,157],[83,156,108,156],[192,156,213,156]],dynamic:bar,ms:1030,reference:true};
}

function bradfordPress(seated: boolean): Illustration {
  const sitting = shape(stand,{2:[151,113],7:[181,113],8:[179,154],9:[173,121],10:[166,155]});
  const base = seated ? sitting : stand;
  const rear = shape(base,{3:[174,79],4:[175,64],5:[123,83],6:[124,63]});
  const front = shape(base,{3:[172,85],4:[171,66],5:[134,87],6:[131,66]});
  const y = seated ? 18 : 31;
  const high = shape(base,{3:[174, y+17],4:[173,y],5:[125,y+19],6:[124,y]});
  const extreme = poseWithBar(high,[149,y],41);
  const a = poseWithBar(seated?rear:front,[150,66],41), b = poseWithBar(seated?front:rear,[150,64],41);
  return {frames:[a,extreme,b,b,extreme,a],dynamic:bar,props:seated?[[115,115,179,115],[121,116,121,157],[158,116,158,157],[126,70,126,114]]:[],
    ms:890,reference:true};
}

function bentPress(): Illustration {
  const ready = shape(stand,{3:[165,84],4:[167,60],5:[135,92],6:[133,114],7:[178,130],8:[193,154],9:[123,130],10:[108,154]});
  const bent = shape(ready,{0:[186,75],1:[175,89],2:[143,108],3:[170,57],4:[167,28],5:[181,111],6:[185,131],7:[175,132]});
  const standUp = shape(ready,{3:[166,46],4:[167,22]});
  return {frames:[ready,bent,bent,standUp,standUp,ready],dynamic:[["kettlebell",4,3,0]],ms:980,reference:true};
}

function rotatingFloorPress(): Illustration {
  const start: Point[] = [[177,137],[160,143],[118,145],[163,133],[176,109],[165,152],[193,155],
    [94,118],[75,139],[79,149],[47,155]];
  const rise = shape(start,{3:[165,111],4:[165,81],0:[178,139],1:[161,143],5:[178,149],6:[203,153]});
  const roll = shape(start,{0:[175,133],1:[158,138],2:[120,145],3:[156,126],4:[169,103],6:[201,153]});
  return {frames:[roll,start,rise,rise,start,roll],dynamic:[["kettlebell",4,-1,0]],ms:1010,reference:true};
}

function lowToOverheadBell(): Illustration {
  const ready = shape(stand,{3:[161,89],4:[160,111],5:[137,90],6:[153,112]});
  const eyeLevel = shape(stand,{3:[178,68],4:[197,63],5:[167,72],6:[190,64]});
  const overhead = shape(stand,{3:[172,44],4:[183,24],5:[164,42],6:[178,25]});
  const frames = [ready,eyeLevel,overhead,overhead,eyeLevel].map(f=>[...f,[(f[4][0]+f[6][0])/2,(f[4][1]+f[6][1])/2] as Point]);
  return {frames,dynamic:[["handled-bell",11,4]],ms:950,reference:true};
}

function alternatingRack(): Illustration {
  const hang = shape(stand,{3:[162,91],4:[163,117],5:[136,91],6:[135,117]});
  const right = shape(hang,{3:[171,84],4:[158,65]});
  const left = shape(hang,{5:[128,85],6:[142,65]});
  const hinge = shape(hang,{0:[165,73],1:[157,88],2:[145,115],3:[162,110],4:[159,134],5:[148,111],6:[137,133],
    7:[167,134],9:[133,135]});
  return {frames:[hang,hinge,right,right,hinge,left,left,hang],dynamic:[["kettlebell",4,3,0],["kettlebell",6,-3,0]],ms:750,reference:true};
}

function rolloutFromBench(): Illustration {
  const crouch: Point[] = [[150,105],[139,114],[115,107],[155,132],[167,146],[141,134],[159,147],
    [106,96],[76,99],[101,98],[72,101]];
  const reach = shape(crouch,{0:[175,105],1:[160,113],2:[131,106],3:[174,126],4:[190,146],5:[171,128],6:[183,146]});
  const long = shape(crouch,{0:[196,116],1:[181,118],2:[138,106],3:[203,132],4:[222,147],5:[195,133],6:[215,147]});
  return { frames:[crouch,reach,long,long,reach].map(f=>poseWithBar(f,[f[4][0]-5,149],22)),
    props:[[59,101,120,101],[68,102,68,154],[108,103,108,154]],dynamic:[...bar,["wheel",11,0,0],["wheel",12,0,0]],ms:940,reference:true };
}

function alternatingStraightLegs(): Illustration {
  const seated: Point[] = [[124,92],[130,109],[155,147],[134,85],[142,68],[117,85],[124,68],
    [188,148],[218,150],[175,149],[205,153]];
  const a = shape(seated,{7:[181,123],8:[209,100]});
  const b = shape(seated,{9:[172,123],10:[199,96]});
  return {frames:[seated,a,a,seated,b,b].map(f=>poseWithBar(f,[135,68],35)), dynamic:bar, ms:970, reference:true};
}

function supportedNarrowRow(): Illustration {
  const body: Point[] = [[178,68],[165,84],[127,115],[168,111],[167,138],[157,112],[152,139],
    [120,139],[108,155],[104,139],[95,154]];
  const end = shape(body,{3:[146,92],4:[164,109],5:[139,97],6:[152,111]});
  return {frames:[poseWithBar(body,[160,138],40),poseWithBar(end,[158,110],40),poseWithBar(end,[158,110],40)],
    props:[[125,122,179,73],[127,122,127,156],[154,97,154,154],[119,155,163,155]],dynamic:bar,ms:1040,reference:true};
}

function skier(): Illustration {
  const start: Point[] = [[154,69],[142,83],[119,108],[133,104],[126,125],[123,104],[115,125],
    [145,133],[144,156],[132,136],[127,156]];
  const raised = shape(start,{3:[126,96],4:[104,104],5:[117,97],6:[96,105]});
  return {frames:[poseWithBar(start,[120,125],32),poseWithBar(raised,[101,104],32),poseWithBar(raised,[101,104],32)],
    dynamic:bar,ms:990,reference:true};
}

function supportedEz(mode: "press" | "curl"): Illustration {
  const press = mode === "press";
  const torso: Point[] = [[190,65],[178,79],[144,112],[186,109],[196,125],[169,111],[179,126],
    [119,135],[95,155],[116,138],[91,154]];
  const ready = press ? shape(torso,{3:[188,99],4:[203,89],5:[178,102],6:[196,88]}) : torso;
  const end = press ? shape(torso,{3:[201,79],4:[227,71],5:[194,81],6:[214,73]})
    : shape(torso,{3:[187,103],4:[196,83],5:[170,105],6:[178,86]});
  const frames = [ready,end,end].map(f=>poseWithBar(f,[(f[4][0]+f[6][0])/2,(f[4][1]+f[6][1])/2],29));
  return {frames,props:[[139,118,191,70],[140,117,140,157],[174,88,174,155],[130,155,183,155]],
    dynamic:[["ez-bar",11,12],["barbell-end",11,0,0],["barbell-end",12,0,0]],ms:1010,reference:true};
}

function floorRollingFly(): Illustration {
  const tight: Point[] = [[169,104],[158,111],[125,129],[170,131],[172,151],[144,132],[138,151],
    [99,137],[71,149],[95,141],[66,154]];
  const wide = shape(tight,{0:[167,134],1:[157,136],2:[123,140],3:[182,140],4:[209,148],5:[117,140],6:[91,148],
    7:[97,145],9:[93,149]});
  const bases = (f: Point[]): Point[] => [...f,[f[4][0]-21,152],[f[4][0]+20,146],[f[6][0]-21,153],[f[6][0]+20,147]];
  return {frames:[tight,wide,wide,tight].map(bases),dynamic:[["bar",11,12],["bar",13,14],["wheel",11,0,0],["wheel",12,0,0],
    ["wheel",13,0,0],["wheel",14,0,0]],ms:990,reference:true};
}

function doubleWindmill(): Illustration {
  const up = shape(stand,{3:[165,47],4:[165,22],5:[131,91],6:[130,113],7:[177,132],8:[188,155],9:[120,129],10:[108,155]});
  const low = shape(up,{0:[130,79],1:[134,93],2:[155,116],3:[152,58],4:[165,28],5:[125,114],6:[114,141],7:[174,136],9:[122,132]});
  return {frames:[up,low,low],dynamic:[["kettlebell",4,-4,0],["kettlebell",6,4,5]],ms:990,reference:true};
}

function bellPowerJerk(): Illustration {
  const hinge = shape(stand,{0:[174,69],1:[161,83],2:[137,112],3:[160,106],4:[149,134],7:[169,131],9:[133,135]});
  const rack = shape(stand,{3:[165,84],4:[159,65]});
  const grip = shape(rack,{0:[153,57],1:[151,75],2:[146,119],7:[169,132],9:[132,132]});
  const held = shape(grip,{3:[157,44],4:[160,21]});
  const tall = shape(rack,{3:[158,41],4:[158,18]});
  return {frames:[hinge,rack,grip,held,tall,tall,rack],dynamic:[["kettlebell",4,3,0]],ms:760,reference:true};
}

function landmineRow(): Illustration {
  const start: Point[] = [[166,73],[155,85],[126,110],[157,108],[146,135],[148,107],[138,133],
    [145,133],[151,154],[117,136],[110,155]];
  const finish = shape(start,{3:[131,104],4:[148,109],5:[124,107],6:[143,109]});
  const frames=[start,finish,finish].map((f):Point[]=>[...f,[f[4][0]+5,f[4][1]+2]]);
  return {frames,props:[[216,154,252,154],[226,151,226,157]],dynamic:[["bar",11,230,153],["disc",11,0,0]],ms:990,reference:true};
}

function neutralHammerBar(): Illustration {
  const down = shape(stand,{3:[162,91],4:[164,113],5:[136,91],6:[133,113]});
  const up = shape(down,{3:[164,90],4:[166,64],5:[137,89],6:[132,64]});
  const frames=[down,up,up].map(f=>{
    const y=f[4][1];
    return [...f,[127,y-6],[172,y-6],[172,y+6],[127,y+6],[117,y],[183,y],[132,y+6],[167,y+6]] as Point[];
  });
  return {frames,dynamic:[["bar",11,12],["bar",12,13],["bar",13,14],["bar",14,11],["line",6,17],["line",4,18],
    ["disc",15,0,0],["disc",16,0,0]],ms:1000,reference:true};
}

export const reviewedBarAndBellIllustrations: Record<string, Illustration> = {
  "0035":reclinedBar("decline-elbows"), "0036":reclinedBar("decline-press"), "0050":reclinedBar("incline-scapula"), "0075":uprightRaise(),
  "0087":bradfordPress(true), "0105":bradfordPress(false), "0524":bentPress(), "0526":alternatingRack(),
  "0531":rotatingFloorPress(), "0543":lowToOverheadBell(),
  "0083":rolloutFromBench(), "2509":supportedNarrowRow(), "2799":alternatingStraightLegs(), "2800":alternatingStraightLegs(),
  "0100":skier(), "0445":supportedEz("press"), "1628":supportedEz("curl"), "0458":floorRollingFly(),
  "0530":doubleWindmill(), "0537":bellPowerJerk(), "0574":landmineRow(), "0636":neutralHammerBar(),
};
