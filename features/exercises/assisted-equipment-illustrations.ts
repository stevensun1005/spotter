import type { Illustration, Point } from "./motion-data";

const move = (pose: Point[], joints: Partial<Record<number, Point>>): Point[] => pose.map((point,i) => joints[i] ?? point);
const strap: NonNullable<Illustration["dynamic"]> = [["line",4,162,17],["line",6,180,20],["ring",4,0,0],["ring",6,0,0]];

function hangingAssist(release: boolean): Illustration {
  const down: Point[] = [[148,50],[147,67],[149,106],[165,45],[163,21],[132,45],[132,21],
    [152,132],[156,151],[143,131],[146,151]];
  const up = move(down,{7:[177,106],8:[175,131],9:[167,104],10:[167,130]});
  const forced = move(down,{7:[155,130],8:[162,148],9:[145,128],10:[152,147]});
  const assistant: Point[] = [[201,57],[194,75],[191,114],[189,98],[174,117],[203,99],[181,121],
    [201,138],[205,157],[181,138],[180,157]];
  const frames = [down,up,up,release?forced:down];
  return {frames,partnerFrames:frames.map(p=>move(assistant,{4:[p[7][0]+2,p[7][1]+5],6:[p[9][0]+3,p[9][1]+6]})),
    props:[[111,20,188,20],[116,20,116,157],[108,157,125,157]],ms:900,reference:true};
}

function assistedLower(lateral: boolean): Illustration {
  const flat: Point[] = [[190,145],[174,148],[133,147],[178,132],[207,151],[181,133],[213,152],
    [98,149],[65,152],[95,150],[61,154]];
  const vertical = move(flat,{7:[132,113],8:[129,78],9:[142,113],10:[141,82]});
  const middle = lateral ? move(flat,{7:[107,136],8:[87,112],9:[106,143],10:[81,131]})
    : move(flat,{7:[100,137],8:[70,129],9:[97,140],10:[65,133]});
  const helper: Point[] = [[208,54],[204,71],[219,109],[182,92],[146,106],[192,96],[151,108],
    [208,131],[205,155],[230,132],[237,155]];
  const frames = [flat,middle,vertical,vertical,middle,flat];
  return {frames,partnerFrames:frames.map((p,i)=>i===2||i===3?move(helper,{0:[177,66],1:[182,82],2:[215,112],
    3:[166,88],4:p[8],5:[169,91],6:p[10],7:[207,130]}):helper),
    ms:930,reference:true};
}

function ballPartners(): Illustration {
  const sat: Point[] = [[102,84],[105,102],[116,147],[130,119],[148,120],[118,121],[143,124],
    [144,126],[159,149],[136,129],[156,153]];
  const turned = move(sat,{0:[95,86],1:[100,107],3:[110,123],4:[129,136],5:[105,127],6:[124,133]});
  const thrown = move(sat,{3:[132,109],4:[159,102],5:[123,114],6:[154,103]});
  const reflect = (f: Point[]): Point[] => f.map(([x,y])=>[320-x,y]);
  const frames = [turned,sat,thrown,thrown,sat,turned].map((f,i):Point[]=>[...f,
    [[127,133],[149,120],[157,103],[160,93],[171,118],[193,133]][i] as Point]);
  return {frames,partnerFrames:[reflect(thrown),reflect(thrown),reflect(thrown),reflect(thrown),reflect(sat),reflect(turned)],
    dynamic:[["ball",11,0,0]],cutOnLoop:true,ms:920,reference:true};
}

function chestBall(mode: "rebound" | "single" | "quick"): Illustration {
  const kneel: Point[] = [[141,65],[139,83],[139,122],[159,106],[162,91],[149,104],[153,92],
    [151,152],[121,151],[143,154],[112,153]];
  const standing = move(kneel,{0:[141,47],1:[138,67],2:[137,109],7:[157,131],8:[157,155],9:[121,133],10:[120,156],
    3:[158,87],4:[163,82],5:[146,88],6:[154,82]});
  const start = mode === "quick" ? standing : kneel;
  const drive = move(start,{3:[167,start[1][1]+1],4:[194,start[1][1]-1],5:[160,start[1][1]+3],6:[186,start[1][1]+2]});
  const landing = move(kneel,{0:[215,128],1:[202,135],2:[155,133],3:[199,147],4:[213,154],5:[186,145],6:[195,154],
    7:[135,145],8:[111,153],9:[127,148],10:[104,154]});
  const prep = move(standing,{0:[155,66],1:[149,82],2:[135,114],3:[156,107],4:[158,129],5:[147,108],6:[151,128]});
  const phases: [Point[],Point][] = mode === "quick" ? [[prep,[157,135]],[standing,[158,80]],[drive,[195,61]],
    [drive,[243,62]],[standing,[269,70]]] : [[kneel,[162,94]],[drive,[194,81]],[drive,[228,82]],
      [mode==="single"?landing:drive,[271,87]],[mode==="single"?landing:kneel,[298,102]]];
  if (mode === "rebound") phases.push([drive,[235,92]],[kneel,[163,94]]);
  return {frames:phases.map(([body,ball])=>[...body,ball]),dynamic:[["ball",11,0,0]],cutOnLoop:true,ms:760,reference:true};
}

function ballWork(kind: "chest-stretch" | "arm-lift" | "pyramid" | "tuck"): Illustration {
  if (kind === "tuck") {
    const long: Point[] = [[93,101],[108,112],[161,116],[101,134],[103,155],[112,135],[118,155],
      [193,118],[226,126],[187,121],[219,130],[223,145]];
    const bent = move(long,{0:[94,102],2:[153,105],7:[131,124],8:[169,130],9:[134,130],10:[172,134],11:[174,145]});
    return {frames:[long,bent,bent,long],dynamic:[["stability-ball",11,0,0]],ms:980,reference:true};
  }
  const prone: Point[] = [[186,96],[174,109],[128,128],[183,136],[199,154],[174,138],[183,155],
    [96,140],[70,153],[89,144],[63,155],[134,142]];
  if (kind === "arm-lift") {
    return {frames:[prone,move(prone,{3:[201,103],4:[226,95]}),prone,move(prone,{5:[199,96],6:[221,86]})],
      dynamic:[["stability-ball",11,0,0]],ms:900,reference:true};
  }
  if (kind === "pyramid") {
    const drop = move(prone,{0:[194,136],1:[177,129],3:[187,147],4:[208,154],5:[175,146],6:[194,155]});
    return {frames:[prone,drop,drop,prone],dynamic:[["stability-ball",11,0,0]],ms:1230,reference:true};
  }
  const kneeling = move(prone,{0:[149,97],1:[159,112],2:[179,128],3:[143,103],4:[130,109],5:[163,131],6:[147,155],
    7:[180,152],8:[209,153],9:[171,152],10:[197,154],11:[121,135]});
  const reach = move(kneeling,{0:[148,124],1:[154,134],3:[139,114],4:[124,115]});
  return {frames:[kneeling,reach,reach,kneeling],dynamic:[["stability-ball",11,0,0]],ms:1220,reference:true};
}

function elevatedStraps(kind: "bent" | "weighted" | "steep" | "floor"): Illustration {
  const squat = kind === "bent";
  const elevated = kind === "weighted";
  const steep = kind === "steep";
  const start: Point[] = steep ? [[101,76],[111,91],[143,115],[116,68],[144,52],[124,75],[159,55],
    [170,134],[192,155],[165,137],[185,155]] : [[91,140],[107,143],[151,134],[115,115],[121,89],[124,117],[135,90],
    squat?[177,112]:[189,135],squat?[189,154]:[219,elevated?125:154],squat?[167,115]:[180,139],squat?[179,154]:[214,elevated?126:155]];
  const top = move(start,steep?{0:[135,53],1:[142,72],2:[166,109],3:[125,89],4:[148,57],5:[139,83],6:[165,58]}
    :{0:[112,103],1:[123,115],2:[163,124],3:[108,130],4:[126,96],5:[128,133],6:[140,98]});
  const fittings: NonNullable<Illustration["dynamic"]>=steep?[["line",4,162,17],["line",6,180,20]]:kind==="floor"?strap:
    [["line",4,122,14],["line",6,137,16],["pad",4,0,0],["pad",6,0,0]];
  const bench: NonNullable<Illustration["props"]>=elevated?[[201,128,258,128],[208,128,208,155],[250,128,250,155]]:[];
  return {frames:[start,top,top,start],props:bench,dynamic:elevated?[...fittings,["disc",2,0,-8]]:fittings,ms:1040,reference:true};
}

function rollerSaw(): Illustration {
  const base: Point[] = [[194,119],[180,131],[129,134],[184,154],[208,154],[174,155],[194,155],
    [96,137],[62,141],[93,139],[59,143],[81,147]];
  const moved = move(base,{0:[180,119],1:[165,131],2:[115,135],3:[177,154],5:[165,154],7:[84,137],8:[49,140],9:[81,141],10:[45,143]});
  return {frames:[base,moved,moved,base],dynamic:[["foam-roller",11,0,0]],ms:1050,reference:true};
}

function weightedSitup(): Illustration {
  const lying: Point[] = [[90,143],[106,146],[148,147],[122,141],[122,124],[118,140],[118,122],
    [177,113],[194,153],[167,115],[184,153],[120,122]];
  const seated = move(lying,{0:[133,94],1:[135,113],2:[150,145],3:[139,87],4:[138,60],5:[128,87],6:[132,60],11:[135,59]});
  return {frames:[lying,seated,seated,lying],dynamic:[["disc",11,0,0]],ms:1040,reference:true};
}

export const assistedEquipmentIllustrations: Record<string, Illustration> = {
  "0010":hangingAssist(true), "0011":hangingAssist(false), "0012":assistedLower(true), "0013":assistedLower(false), "0014":ballPartners(),
  "1272":ballWork("chest-stretch"),"1332":ballWork("arm-lift"),"1341":ballWork("pyramid"),"0650":ballWork("tuck"),
  "1304":chestBall("rebound"),"1305":chestBall("single"),"1312":chestBall("quick"),
  "1071":elevatedStraps("bent"),"2834":elevatedStraps("weighted"),"11715":elevatedStraps("steep"),"1080":elevatedStraps("floor"),
  "2204":rollerSaw(),"0641":weightedSitup(),
};
