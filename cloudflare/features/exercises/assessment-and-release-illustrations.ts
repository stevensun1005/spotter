import type { Illustration, Point } from "./motion-data";

const set = (frame: Point[], joints: Partial<Record<number, Point>>): Point[] => frame.map((joint, index) => joints[index] ?? joint);
const table: NonNullable<Illustration["props"]> = [[81,119,246,119],[91,119,91,154],[236,119,236,154]];
const standing: Point[] = [[149,44],[149,63],[147,108],[164,87],[165,115],[134,87],[132,115],
  [157,132],[161,156],[137,132],[132,155]];

function benchExam(test: "faber" | "length" | "thomas"): Illustration {
  const flat: Point[] = [[226,102],[211,112],[160,112],[197,115],[182,115],[193,109],[180,110],
    [125,113],[92,112],[128,108],[95,108]];
  const clinician: Point[] = [[138,50],[141,68],[151,103],[143,87],[133,102],[156,83],[160,103],
    [168,130],[179,155],[145,130],[138,155]];
  if (test === "thomas") {
    const hold = set(flat,{3:[186,96],4:[183,79],5:[182,92],6:[182,79],7:[114,114],8:[107,149],9:[180,79],10:[155,96]});
    const release = set(hold,{7:[111,104],8:[88,137]});
    return {frames:[hold,release,release,hold],props:table,ms:1300,reference:true};
  }
  if (test === "faber") {
    const four = set(flat,{7:[124,111],8:[91,111],9:[142,83],10:[123,112]});
    const settle = set(four,{9:[137,91],10:[125,111]});
    const exam = (pose: Point[]): Point[] => set(clinician,{0:[148,52],1:[147,70],3:[146,80],4:pose[9],5:[160,88],6:[165,109]});
    const frames = [four,settle,settle,four];
    return {frames,partnerFrames:frames.map(exam),props:table,ms:1350,reference:true};
  }
  const bent = set(flat,{7:[132,88],8:[107,114],9:[138,89],10:[116,114]});
  const reset = set(bent,{1:[211,110],2:[159,89],7:[128,85],9:[135,84]});
  const observer = (pose: Point[]): Point[] => set(clinician,{0:[81,57],1:[75,74],2:[59,113],3:[85,95],4:pose[8],
    5:[81,94],6:pose[10],7:[64,135],8:[72,155],9:[52,132],10:[49,155]});
  const frames=[flat,bent,reset,bent,flat];
  return {frames,partnerFrames:frames.map(observer),props:table,ms:1280,reference:true};
}

function frontalThomas(): Illustration {
  const flat: Point[] = [[155,42],[155,63],[155,112],[167,83],[148,91],[136,81],[146,91],
    [151,85],[154,120],[167,141],[168,166]];
  const drift = set(flat,{9:[178,140],10:[188,164]});
  return {frames:[flat,drift,drift,flat],topView:true,props:[[125,30,186,30],[125,30,125,151],[186,30,186,151],[125,151,186,151]],
    ms:1380,reference:true};
}

function posteriorReach(): Illustration {
  const bent = set(standing,{0:[107,98],1:[119,84],2:[157,74],3:[115,111],4:[122,140],5:[126,110],6:[130,139],
    7:[150,104],8:[144,132],9:[156,103],10:[150,132]});
  const reach = set(bent,{0:[107,107],1:[117,97],3:[115,121],4:[119,150],5:[124,121],6:[127,148]});
  return {frames:[bent,reach,reach,bent],props:[[135,136,166,136],[135,136,135,159],[166,136,166,159],[131,158,173,158],
    [128,124,128,158],[123,141,131,141],[123,151,131,151]],ms:1300,reference:true};
}

function proneContact(zone: "iliospsoas" | "iliacus" | "psoas"): Illustration {
  const prone: Point[] = [[216,106],[200,117],[139,142],[208,151],[237,154],[200,153],[226,155],
    [101,147],[65,153],[98,149],[60,155]];
  const x = zone === "iliacus" ? 143 : zone === "psoas" ? 162 : 151;
  const offset = zone === "iliacus" ? 3 : zone === "psoas" ? 7 : -2;
  const contact = (f: Point[]): Point[] => [...f,[x,153]];
  const shift = set(prone,{0:[219,105],1:[204,118],2:[139+offset,141],7:[103,147],9:[100,148]});
  return {frames:[contact(prone),contact(shift),contact(shift),contact(prone)],dynamic:[["massage-ball",11,0,0]],ms:1450,reference:true};
}

function wallContact(rib: boolean): Illustration {
  const pose = set(standing,{0:[172,50],1:[169,69],2:[164,109],3:[167,90],4:[164,110],5:[152,91],6:[149,111],
    7:[171,132],8:[177,154],9:[152,129],10:[150,153]});
  const shifted = set(pose,{0:[176,52],1:[171,71],2:[167,112],3:[172,90],7:[169,134]});
  const marker: Point = [179,rib ? 85 : 100];
  return {frames:[pose,shifted,shifted,pose].map(f=>[...f,marker]),props:[[186,29,186,157],[186,29,239,18],[186,155,239,138],[239,18,239,138]],
    dynamic:[["massage-ball",11,0,0]],ms:1410,reference:true};
}

function seatedContact(mode: "knee" | "inner-thigh"): Illustration {
  if (mode === "knee") {
    const pose: Point[] = [[115,78],[119,98],[138,144],[113,128],[101,155],[130,126],[125,153],
      [179,142],[217,145],[165,113],[182,152],[179,152]];
    const reset = set(pose,{0:[121,79],1:[125,99],2:[146,142],7:[185,142],8:[225,145],9:[170,113]});
    return {frames:[pose,reset,reset,pose],dynamic:[["massage-ball",11,0,0]],ms:1400,reference:true};
  }
  const pose = set(standing,{0:[149,51],1:[148,71],2:[148,115],3:[170,96],4:[169,121],5:[131,97],6:[134,119],
    7:[172,119],8:[160,153],9:[130,121],10:[135,154]});
  const focus = set(pose,{7:[175,122],8:[166,154],9:[133,122]});
  return {frames:[pose,focus,focus,pose].map(f=>[...f,[157,127] as Point]),dynamic:[["massage-ball",11,0,0]],
    props:[[106,132,199,132],[112,132,112,153],[192,132,192,153]],ms:1430,reference:true};
}

function sideLyingNeck(rearView: boolean): Illustration {
  const body: Point[] = [[62,127],[79,139],[127,143],[93,124],[85,107],[83,150],[66,152],
    [172,145],[216,150],[170,150],[212,154],[74,150]];
  const angle = set(body,{0:[67,129],1:[81,138],3:[93,126],4:[86,109]});
  const shiftView = (f: Point[]) => rearView ? f.map(([x,y]): Point=>[278-x,y]) : f;
  const support: NonNullable<Illustration["props"]> = rearView ? [[182,153,238,153]] : [[42,153,94,153]];
  return {frames:[body,angle,angle,body].map(shiftView),props:support,dynamic:[["massage-ball",11,0,0]],ms:1410,reference:true};
}

function kneelingTaps(): Illustration {
  const start: Point[] = [[200,79],[185,94],[137,111],[195,125],[207,155],[177,126],[179,155],
    [130,153],[97,141],[117,153],[92,143],[193,96],[176,98]];
  const near = set(start,{3:[208,120],4:[176,99],0:[202,80],1:[187,94]});
  const far = set(start,{5:[172,123],6:[193,96],0:[197,81],1:[182,95]});
  return {frames:[start,near,start,far],shoulders:[11,12],ms:940,reference:true};
}

function plateTurn(): Illustration {
  const pose = set(standing,{0:[142,44],1:[144,65],2:[148,108],3:[169,84],4:[194,75],5:[169,72],6:[190,64]});
  const rotated = set(pose,{3:[172,70],4:[196,62],5:[167,84],6:[189,78]});
  const withPlate = (f: Point[]): Point[] => [...f,[191,69]];
  return {frames:[pose,rotated,rotated,pose].map(withPlate),dynamic:[["disc",11,0,0],["line",4,6]],ms:1000,reference:true};
}

function exerciseBallReach(): Illustration {
  const lying: Point[] = [[206,146],[190,147],[136,148],[208,125],[226,104],[199,128],[222,109],
    [130,107],[95,107],[140,103],[103,103],[236,92]];
  const tuck = set(lying,{3:[183,118],4:[158,98],5:[176,124],6:[153,99],7:[144,112],8:[105,113],
    9:[151,109],10:[112,109],11:[152,83]});
  return {frames:[lying,tuck,tuck,lying],dynamic:[["stability-ball",11,0,0]],ms:1090,reference:true};
}

export const assessmentAndReleaseIllustrations: Record<string, Illustration> = {
  "6786": benchExam("faber"), "6789": benchExam("length"), "6793": posteriorReach(),
  "6794": benchExam("thomas"), "6795": frontalThomas(), "4482": wallContact(true), "4479": wallContact(false),
  "4477": proneContact("iliacus"), "4475": proneContact("iliospsoas"), "4476": proneContact("psoas"),
  "4466": seatedContact("knee"), "6812": seatedContact("inner-thigh"), "6767": sideLyingNeck(false),
  "6768": sideLyingNeck(true), "4506": kneelingTaps(), "0844": plateTurn(), "0843": exerciseBallReach(),
};
