import type { Illustration, Point } from "./motion-data";

const change = (frame: Point[], points: Partial<Record<number, Point>>): Point[] => frame.map((joint, index) => points[index] ?? joint);
const standing: Point[] = [[155,47],[151,66],[147,106],[173,92],[170,116],[132,91],[135,116],
  [161,132],[161,155],[136,131],[133,155]];

function frontSupport(mode: "knee" | "straight" | "rings"): Illustration {
  const upper: Point[] = [[211,89],[195,98],[141,118],[198,125],[205,155],[185,127],[189,155],
    [100,133],[63,150],[98,136],[62,152]];
  if (mode === "knee") {
    const pose = change(upper,{0:[207,101],1:[193,112],2:[143,128],3:[193,153],4:[221,154],5:[180,153],6:[207,155],
      7:[100,154],8:[86,123],9:[95,155],10:[80,123]});
    const brace = change(pose,{0:[210,100],1:[196,111],2:[143,125]});
    return { frames:[pose,brace,brace,brace],ms:1300,reference:true };
  }
  if (mode === "rings") {
    const suspended = change(upper,{0:[214,88],1:[199,96],2:[143,101],3:[199,127],4:[202,155],
      5:[185,126],6:[190,155],7:[100,103],8:[64,106],9:[98,109],10:[63,112]});
    const hold = change(suspended,{0:[225,87],1:[210,96],2:[153,100],3:[207,123],5:[195,124],
      7:[109,102],8:[73,108],9:[107,107],10:[72,113]});
    return { frames:[suspended,hold,hold,hold],props:[[45,16,82,16]],
      dynamic:[["line",8,54,16],["line",10,65,16],["ring",8,-2,1],["ring",10,-2,1]],ms:1200,reference:true };
  }
  const brace = change(upper,{0:[214,88],1:[198,96],2:[142,115]});
  return { frames:[upper,brace,brace,brace],ms:1300,reference:true };
}

function tallFold(): Illustration {
  const reach = change(standing,{3:[166,50],4:[167,26],5:[136,47],6:[138,25]});
  const hinge = change(standing,{0:[202,83],1:[187,90],2:[142,107],3:[200,103],4:[214,117],5:[184,110],6:[201,125]});
  const fold = change(standing,{0:[186,146],1:[170,137],2:[142,104],3:[181,148],4:[161,154],5:[169,149],6:[135,154],
    7:[150,132],9:[133,133]});
  return {frames:[standing,reach,hinge,fold,fold,hinge,standing],dynamic:[["foot",8,172,153],["foot",10,145,154]],ms:920,reference:true};
}

function dragonfly(): Illustration {
  const cross = change(standing,{0:[150,59],1:[143,79],2:[135,116],3:[164,90],4:[149,82],5:[134,100],6:[149,82],
    7:[152,136],8:[151,154],9:[113,118],10:[154,128]});
  const squat = change(cross,{0:[170,96],1:[155,99],2:[130,119],3:[160,129],4:[163,154],5:[146,129],6:[145,154],
    7:[144,135],8:[146,154],9:[114,97],10:[155,116]});
  const balanced = change(squat,{0:[184,118],1:[168,115],2:[131,112],3:[163,132],5:[144,131],7:[104,119],8:[69,129],
    9:[109,86],10:[166,122]});
  return {frames:[standing,cross,squat,balanced,balanced,squat,cross,standing],ms:920,reference:true};
}

function crossSeatedTwist(): Illustration {
  const sit: Point[] = [[124,75],[129,94],[145,144],[119,120],[110,155],[134,120],[132,155],
    [167,110],[189,150],[161,138],[177,143]];
  const turn = change(sit,{0:[116,73],1:[120,93],3:[113,121],4:[104,155],5:[138,104],6:[172,114],9:[160,137],10:[180,142]});
  return {frames:[sit,turn,turn,sit],ms:1120,reference:true};
}

function lungePrayerTwist(): Illustration {
  const lunge: Point[] = [[147,62],[145,83],[132,123],[158,112],[163,89],[143,110],[163,89],
    [178,118],[182,155],[102,153],[67,151]];
  const turn = change(lunge,{0:[155,64],1:[151,85],3:[172,111],4:[157,97],5:[144,94],6:[157,97]});
  return {frames:[lunge,turn,turn,turn],dynamic:[["foot",8,195,156],["foot",10,56,155]],ms:1200,reference:true};
}

function reachRollLift(): Illustration {
  const start: Point[] = [[181,103],[164,110],[121,121],[171,131],[177,153],[151,133],[144,154],
    [134,151],[97,153],[124,153],[88,154],[189,154]];
  const reach = change(start,{3:[187,133],4:[208,152],11:[220,153]});
  const lift = change(start,{3:[191,111],4:[219,104],11:[232,103]});
  return {frames:[start,reach,reach,lift,lift,reach],dynamic:[["palm-up",4,11]],ms:1030,reference:true};
}

function pairedRow(): Illustration {
  const athlete: Point[] = [[121,85],[128,103],[93,119],[130,153],[153,153],[154,83],[181,64],
    [62,136],[37,153],[61,138],[35,156]];
  const pulled = change(athlete,{5:[122,80],6:[146,86]});
  const partner: Point[] = [[253,57],[244,69],[238,109],[227,77],[201,66],[250,85],[232,101],
    [258,125],[269,151],[237,131],[221,153],[201,66]];
  return {frames:[athlete,pulled,pulled],partnerFrames:[partner,partner,partner],dynamic:[["band",6,201,66]],ms:1080,reference:true};
}

function hoop(): Illustration {
  const left = change(standing,{0:[150,45],1:[146,65],2:[140,106],3:[168,81],4:[150,80],5:[125,81],6:[149,80]});
  const right = change(left,{0:[154,46],1:[153,66],2:[155,105]});
  const point = (f: Point[], x: number, y: number): Point[] => [...f,[f[2][0]+x,100+y]];
  return {frames:[point(left,-15,0),point(left,0,-3),point(right,15,0),point(right,0,3)],dynamic:[["hoop",11,0,0]],ms:580,reference:true};
}

function floorHipLift(mode: "reach" | "side" | "turn"): Illustration {
  const mat: Point[] = [[82,145],[100,147],[146,149],[112,151],[127,154],[96,151],[86,155],
    [151,110],[156,67],[155,113],[163,71]];
  if (mode === "reach") {
    const bent = change(mat,{7:[172,115],8:[192,154],9:[165,122],10:[184,153],3:[111,134],4:[133,140],5:[99,147],6:[119,150]});
    const bridge = change(bent,{0:[81,146],1:[100,146],2:[148,121],3:[94,133],4:[62,140],5:[103,147],6:[127,151],7:[172,110]});
    const other = change(bridge,{1:[101,144],3:[109,149],4:[132,152],5:[84,131],6:[57,141],9:[169,111]});
    return {frames:[bent,bridge,bridge,bent,other,other],ms:1030,reference:true};
  }
  const up = change(mat,{1:[102,145],2:[143,135],7:[136,94],8:[126,60],9:[141,96],10:[133,62]});
  const other = mode === "turn" ? change(up,{2:[148,133],7:[153,93],8:[160,59],9:[146,93],10:[153,58]})
    : change(up,{2:[151,134],7:[160,94],8:[170,58],9:[166,95],10:[176,60]});
  const angled = mode === "turn" ? change(up,{7:[140,94],8:[133,59],9:[147,92],10:[142,57]}) : up;
  return {frames:[mat,angled,angled,mat,other,other],ms:1020,reference:true};
}

function diagonalCableLift(): Illustration {
  const low: Point[] = [[151,81],[158,97],[177,124],[147,120],[126,137],[157,119],[132,136],
    [155,131],[153,155],[201,134],[215,152]];
  const middle = change(low,{0:[165,59],1:[162,77],2:[168,112],3:[160,94],4:[173,93],5:[151,91],6:[168,94]});
  const high = change(low,{0:[173,45],1:[169,66],2:[166,110],3:[183,44],4:[187,23],5:[172,43],6:[182,24],
    7:[157,133],9:[190,130]});
  return {frames:[low,middle,high,high,middle],props:[[78,29,78,157],[102,29,102,157],[78,29,102,29],[69,156,113,156]],
    dynamic:[["cable",6,102,144],["pad",6,0,0]],ms:900,reference:true};
}

function tricepsRoll(): Illustration {
  const lean: Point[] = [[144,70],[132,87],[114,119],[148,115],[179,106],[131,113],[146,131],
    [164,114],[171,132],[106,138],[94,154],[143,119]];
  const shift = change(lean,{0:[158,78],1:[146,91],2:[124,120],3:[159,116],4:[184,106],5:[140,115],11:[150,120]});
  return {frames:[lean,shift,shift,lean],props:[[133,136,234,136],[143,136,143,156],[222,136,222,156]],
    dynamic:[["pad",11,0,2],["plate",11,0,0]],ms:1100,reference:true};
}

function suspendedHeadstand(): Illustration {
  const supported: Point[] = [[197,148],[189,130],[147,121],[194,153],[203,146],[184,151],[198,147],
    [110,126],[77,129],[108,132],[75,135]];
  const folded = change(supported,{0:[195,151],1:[185,126],2:[184,82],7:[153,82],8:[119,96],9:[149,87],10:[116,101]});
  const stacked = change(folded,{2:[186,74],7:[185,48],8:[183,21],9:[180,52],10:[178,25]});
  return {frames:[supported,folded,stacked,stacked,folded,supported],props:[[53,15,107,15]],
    dynamic:[["line",8,72,15],["line",10,83,15],["ring",8,0,2],["ring",10,0,2]],ms:1250,reference:true};
}

function overheadBandReach(): Illustration {
  const start = change(standing,{0:[124,70],1:[124,87],2:[121,119],3:[139,61],4:[131,36],5:[109,103],6:[109,127],
    7:[131,136],8:[136,155],9:[110,137],10:[104,155]});
  const finish = change(start,{3:[138,56],4:[142,29],0:[126,69],1:[126,85]});
  return {frames:[start,finish,finish,start],props:[[85,47,85,155],[208,44,208,155],[85,47,208,44],[208,44,224,50],
    [224,50,224,158],[78,155,91,155],[200,154,229,158]],dynamic:[["band",4,86,47],["band",4,208,44]],ms:1000,reference:true};
}

export const verifiedMobilityIllustrations: Record<string, Illustration> = {
  "0142": frontSupport("knee"), "0143": frontSupport("straight"), "9313": frontSupport("rings"),
  "0953": tallFold(), "6299": dragonfly(), "0649": crossSeatedTwist(), "5906": lungePrayerTwist(),
  "3417": reachRollLift(), "1501": pairedRow(), "5526": hoop(), "1466": floorHipLift("reach"),
  "0723": floorHipLift("side"), "0724": floorHipLift("turn"), "7585": diagonalCableLift(), "4407": tricepsRoll(),
  "9704": suspendedHeadstand(),
  "10553": overheadBandReach(),
};
