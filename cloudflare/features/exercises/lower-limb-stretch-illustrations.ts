import type { Illustration, Point } from "./motion-data";

type Pair = [Point, Point];
type Body = [Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

const pose = (body: Body, nearArm: Pair, farArm: Pair, nearLeg: Pair, farLeg: Pair, toes: Pair): Point[] =>
  [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg, ...toes];
const adjust = (frame: Point[], joints: Partial<Record<number, Point>>) =>
  frame.map((point, index) => joints[index] ?? point);
const toes: Attachments = [["foot-tip",8,11], ["foot-tip",10,12]];
const bench = (left: number, top: number, right: number): Props =>
  [[left,top,right,top],[left+3,top,left+3,158],[right-3,top,right-3,158]];
const wall: Props = [[236,31,236,159],[236,143,247,133],[236,152,247,142]];
const mat: Props = [[54,158,261,158]];

function stretch(frames: Point[][], props?: Props, extra: Attachments = [], ms = 1050): Illustration {
  return { frames, props, dynamic: [...toes,...extra], ms, reference: true };
}

function hold(start: Point[], end: Point[], props?: Props, extra?: Attachments) {
  return stretch([start,end,end,end,end],props,extra);
}

const sideTall = pose([[157,48],[151,65],[147,108]],[[158,90],[160,115]],[[145,90],[140,112]],
  [[154,132],[157,152]],[[140,132],[140,152]],[[168,158],[150,156]]);

function wallCalf(bend: "straight" | "slight" | "deep") {
  const start = pose([[162,50],[156,67],[146,112]],[[196,83],[235,71]],[[193,90],[235,83]],
    [[179,131],[184,152]],[[114,131],[87,152]],[[196,158],[100,157]]);
  const end = adjust(start,{
    0:[182,55],1:[176,72],2:bend === "deep" ? [164,120] : [156,114],
    3:[205,87],5:[201,94],7:[196,130],9:bend === "deep" ? [137,143] : bend === "slight" ? [127,137] : [120,133],
  });
  return hold(start,end,wall);
}

const halfKneel = pose([[151,51],[145,68],[143,113]],[[162,92],[179,119]],[[139,92],[144,114]],
  [[185,120],[187,152]],[[116,153],[86,151]],[[200,158],[77,156]]);
const frontAnkleKneel = hold(halfKneel,adjust(halfKneel,{
  0:[163,58],1:[157,74],2:[158,115],3:[180,104],4:[207,126],5:[171,101],6:[199,125],7:[207,128],
}),mat);
const iliopsoas = hold(halfKneel,adjust(halfKneel,{
  0:[160,50],1:[153,66],2:[156,113],5:[150,41],6:[150,13],
}),mat);

const deepAchilles = hold(sideTall,pose([[172,72],[165,91],[132,122]],[[178,112],[190,130]],[[168,114],[179,130]],
  [[173,129],[150,152]],[[167,128],[140,152]],[[163,158],[154,156]]));

function bandAchilles(front: boolean) {
  const stance = pose([[151,50],[145,67],[143,113]],[[154,89],[158,112]],[[139,90],[145,111]],
    [[171,134],[185,154]],[[127,134],[107,153]],[[196,front ? 149 : 157],[118,front ? 157 : 148]]);
  const end = front ? adjust(stance,{0:[166,58],1:[159,75],3:[159,96],4:[168,114],5:[149,97],6:[158,115],11:[191,139]})
    : adjust(stance,{2:[149,112],3:[150,88],4:[151,108],5:[137,89],6:[139,107],12:[114,139]});
  const attachment = front ? 11 : 12;
  return hold(stance,end,undefined,[["band",4,attachment],["band",6,attachment]]);
}

function standingShin(mode: "crossed" | "raised" | "floor" | "outer-edge" | "slight-knee") {
  const support = pose([[160,48],[153,65],[148,112]],[[184,81],[233,68]],[[179,89],[232,80]],
    [[164,131],[170,152]],[[139,131],[135,151]],[[181,158],[146,156]]);
  if (mode === "slight-knee") {
    const set = adjust(support,{9:[126,134],10:[105,153],12:[119,156]});
    return hold(set,adjust(set,{0:[175,52],1:[167,68],2:[156,115],7:[172,133],9:[139,138]}),wall);
  }
  const raised = mode === "raised", crossed = mode === "crossed" || mode === "outer-edge";
  const set = adjust(support,raised
    ? {9:[121,127],10:[104,131],12:[93,136]}
    : {9:[135,131],10:[crossed ? 151 : 125,144],12:[crossed ? 140 : 113,158]});
  const end = mode === "outer-edge"
    ? adjust(set,{0:[164,55],1:[159,72],2:[154,119],7:[168,134],9:[148,133],10:[148,149],12:[132,158]})
    : adjust(set,{0:[172,52],1:[166,70],2:[159,116],7:[177,135],9:[crossed ? 145 : 131,137]});
  return hold(set,end,raised ? [...wall,...bench(78,136,117)] : wall);
}

const wallBars: Props = [[220,30,220,158],[236,30,236,158],[220,39,236,39],[220,61,236,61],
  [220,83,236,83],[220,105,236,105],[220,126,236,126],[220,144,236,144]];
const tibialBars = (() => {
  const start = pose([[168,51],[162,68],[153,112]],[[194,80],[224,82]],[[189,90],[224,104]],
    [[184,131],[202,153]],[[139,131],[127,152]],[[224,143],[140,157]]);
  return hold(start,adjust(start,{0:[185,57],1:[179,72],2:[162,116],3:[199,84],5:[197,92],7:[197,133]}),wallBars);
})();

function kneelingFootStretch(mode: "shin" | "toe-floor" | "toe-thighs" | "thunderbolt") {
  const tops = mode === "shin" || mode === "thunderbolt";
  const handsFloor = mode === "shin" || mode === "toe-floor";
  const setup = pose([[181,83],[168,96],[124,101]],[[177,127],[181,155]],[[166,126],[168,154]],
    [[145,153],[93,tops ? 154 : 144]],[[136,152],[82,tops ? 153 : 143]],
    [[tops ? 78 : 104,158],[tops ? 69 : 94,157]]);
  const finish = adjust(setup,handsFloor
    ? {0:[152,91],1:[139,104],2:[111,133],3:[155,128],5:[149,126]}
    : {0:[112,63],1:[110,80],2:[105,134],3:[124,109],4:[136,142],5:[118,111],6:[126,140]});
  return hold(setup,finish,mat);
}

function seatedFloorStretch(mode: "butterfly" | "groin" | "flaps" | "wide" | "wide-overhead") {
  const spread = mode === "wide" || mode === "wide-overhead";
  if (spread) {
    const up = mode === "wide-overhead";
    const start = pose([[153,65],[152,82],[151,143]],[[166,up ? 57 : 108],[174,up ? 34 : 132]],
      [[138,up ? 57 : 108],[128,up ? 34 : 132]],[[192,148],[237,153]],[[110,148],[64,153]],[[239,142],[62,142]]);
    const end = adjust(start,{
      0:[153,103],1:[151,118],3:[169,up ? 104 : 139],4:[185,up ? 82 : 157],
      5:[136,up ? 104 : 139],6:[119,up ? 82 : 157],
    });
    return hold(start,end,mat);
  }
  const start = pose([[151,62],[151,80],[151,141]],[[171,106],[162,147]],[[130,106],[141,147]],
    [[176,123],[164,151]],[[126,123],[138,151]],[[152,155],[150,155]]);
  const lowered = adjust(start,{7:[196,141],9:[106,141],3:[174,126],5:[126,126]});
  if (mode === "flaps") return stretch([start,lowered,adjust(start,{7:[181,126],9:[121,126]}),lowered],mat,[],680);
  return hold(start,mode === "groin" ? adjust(lowered,{0:[151,89],1:[150,103],3:[169,133],5:[132,133]}) : lowered,mat);
}

type Lateral = "lunge" | "hand" | "hip" | "wide-knees" | "toes-up";
function sideLunge(mode: Lateral) {
  const start = pose([[151,48],[151,66],[151,113]],[[168,93],[171,112]],[[133,94],[130,112]],
    [[185,131],[210,152]],[[116,131],[91,152]],[[220,158],[80,158]]);
  const intoRight = adjust(start,{
    0:[181,mode === "hip" ? 51 : 60],1:[178,76],2:[mode === "hip" ? 191 : 178,120],
    3:[191,101],4:mode === "hand" ? [203,136] : mode === "wide-knees" ? [193,121] : [185,118],
    5:[164,102],6:mode === "wide-knees" ? [151,123] : [164,112],7:[203,133],
    9:mode === "wide-knees" ? [118,127] : [131,136],
    12:mode === "toes-up" ? [85,141] : [80,158],
  });
  const intoLeft = intoRight.map(([x,y]):Point => [302-x,y]);
  return stretch([start,intoRight,intoRight,intoRight,intoRight,start,intoLeft,intoLeft,intoLeft,intoLeft]);
}

function footOnBench() {
  const start = pose([[149,49],[150,67],[149,115]],[[168,91],[176,115]],[[135,93],[137,114]],
    [[193,117],[228,122]],[[146,133],[140,152]],[[237,127],[132,158]]);
  const finish = adjust(start,{0:[170,57],1:[168,73],2:[163,116],3:[186,98],4:[197,117],
    5:[148,97],6:[148,117],7:[198,119],9:[151,134]});
  return hold(start,finish,bench(208,127,251));
}

function crossStandingHip(mode: "wall" | "unsupported" | "upright" | "outer-hip") {
  const supported = mode !== "unsupported";
  const start = pose([[153,49],[153,66],[153,113]],supported ? [[187,75],[235,71]] : [[168,94],[175,115]],
    [[136,94],[133,113]],[[161,131],[163,152]],[[144,131],[141,151]],[[174,158],[134,155]]);
  const cross = adjust(start,{9:[159,133],10:[182,150],12:[191,155]});
  const finish = adjust(cross,{
    0:[mode === "outer-hip" ? 139 : mode === "upright" ? 162 : 150,53],
    1:[mode === "outer-hip" ? 150 : mode === "upright" ? 164 : 156,70],2:[180,114],
    5:[151,98],6:[155,117],7:[171,133],9:[164,132],
  });
  return stretch([start,cross,finish,finish,finish,finish],supported ? wall : undefined);
}

function standingFigureFour(supported: boolean) {
  const start = pose([[152,46],[152,64],[151,109]],supported ? [[187,74],[235,70]] : [[166,89],[164,110]],
    [[138,91],[143,112]],[[159,129],[162,152]],[[143,130],[137,152]],[[171,158],[129,158]]);
  const cross = adjust(start,{9:[193,109],10:[158,126],12:[147,123]});
  const finish = adjust(cross,{0:[154,68],1:[152,84],2:[143,119],
    5:[144,100],6:[152,117],7:[166,133],9:[189,119],10:[159,128],12:[150,125]});
  return stretch([start,cross,finish,finish,finish,finish],supported ? wall : undefined);
}

const kneelingAdductor = (() => {
  const set = pose([[153,69],[152,85],[151,105]],[[170,112],[180,151]],[[136,112],[125,151]],
    [[168,145],[161,152]],[[132,146],[119,152]],[[171,157],[107,157]]);
  const oneStraight = adjust(set,{2:[151,110],7:[189,128],8:[229,151],11:[240,158]});
  const back = adjust(oneStraight,{0:[138,84],1:[136,100],2:[132,126],3:[160,121],5:[127,123],
    7:[176,137],9:[127,148]});
  return stretch([set,oneStraight,back,back,back,back],mat);
})();

const proneAdductor = (() => {
  const down = pose([[231,91],[209,91],[148,91]],[[200,107],[220,119]],[[200,75],[220,63]],
    [[133,109],[105,110]],[[133,72],[105,70]],[[92,108],[92,72]]);
  const opened = adjust(down,{7:[141,137],8:[108,138],11:[94,148],9:[141,46],10:[108,45],12:[94,35]});
  const back = adjust(opened,{0:[226,92],1:[204,91],2:[131,91],7:[132,141],9:[132,42]});
  return {...stretch([down,opened,back,back,back,back]),topView:true};
})();

const supine = pose([[79,142],[96,150],[145,151]],[[121,151],[139,151]],[[120,153],[142,154]],
  [[177,150],[214,152]],[[176,154],[210,154]],[[227,156],[222,157]]);
const overheadSupine = adjust(supine,{
  0:[70,91],1:[87,91],2:[135,91],3:[109,107],4:[128,111],5:[108,73],6:[128,70],
  7:[168,100],8:[206,103],11:[219,104],9:[168,83],10:[204,81],12:[217,79],
});

const abductionOneBent = (() => {
  const flat = pose([[77,91],[95,91],[147,91]],[[119,113],[144,119]],[[119,68],[143,62]],
    [[179,98],[219,101]],[[179,84],[219,82]],[[232,101],[232,83]]);
  const bent = adjust(flat,{7:[176,123],8:[148,101],11:[156,93],3:[141,129],4:[170,124]});
  const open = adjust(bent,{7:[164,141],8:[145,102],11:[150,94],3:[139,128],4:[159,139]});
  return {...stretch([flat,bent,open,open,open,open]),topView:true};
})();

const lyingHipCross = (() => {
  const kneeUp = adjust(overheadSupine,{7:[163,114],8:[188,118],11:[198,121]});
  const across = adjust(kneeUp,{7:[153,57],8:[177,57],11:[186,61],5:[119,64],6:[151,58]});
  return {...stretch([overheadSupine,kneeUp,across,across,across,across]),topView:true};
})();

const benchHipHang = (() => {
  const onBench = supine.map(([x,y]):Point => [x,y-44]);
  const move = adjust(onBench,{7:[155,118],8:[182,141],11:[193,150]});
  const hang = adjust(move,{7:[150,126],8:[170,149],11:[181,155]});
  return stretch([onBench,move,hang,hang,hang,hang],[
    [65,111,226,111],[65,111,78,121],[78,121,239,121],[226,111,239,121],[82,121,82,158],[232,121,232,158],
  ]);
})();

const ballHipCross = (() => {
  const withBall = pose([[79,142],[96,149],[142,151]],[[120,150],[138,151]],[[118,153],[139,154]],
    [[172,128],[213,119]],[[169,130],[210,121]],[[222,123],[219,125]]);
  const stacked = adjust(withBall,{7:[152,111],8:[171,124],11:[179,129]});
  const drawnIn = adjust(stacked,{7:[130,107],8:[146,118],11:[155,123],9:[147,123],10:[187,119],12:[196,124]});
  const frames: Point[][] = [[...withBall,[207,140]],[...stacked,[207,140]],[...drawnIn,[179,140]]];
  return stretch([...frames,frames[2],frames[2],frames[2]],mat,[["stability-ball",13,0,0]]);
})();

const wallHipOpen = (() => {
  const vertical = pose([[105,142],[125,150],[196,152]],[[146,153],[166,154]],[[151,151],[171,153]],
    [[195,107],[195,61]],[[202,107],[203,61]],[[196,49],[204,48]]);
  const opened = adjust(vertical,{7:[176,111],8:[158,69],11:[151,58],9:[224,112],10:[247,70],12:[256,59]});
  return hold(vertical,opened,[[144,46,257,46],[257,46,265,158],[265,158,150,158],[150,158,144,46]]);
})();

function assisted(mode: "hip" | "abduction" | "hamstring" | "glute") {
  const topView = mode === "abduction" || mode === "glute";
  const starting = mode === "glute"
    ? adjust(overheadSupine,{7:[156,110],8:[186,110],11:[197,113]})
    : topView ? overheadSupine : supine;
  const endings: Record<typeof mode,Partial<Record<number, Point>>> = {
    hip:{7:[145,105],8:[172,123],11:[184,127]},
    abduction:{7:[165,123],8:[200,144],11:[212,150]},
    hamstring:{7:[151,118],8:[161,78],11:[171,73]},
    glute:{7:[155,58],8:[181,61],11:[191,62]},
  };
  const moved = adjust(starting,endings[mode]);
  const helper = (frame: Point[]) => {
    const [fx,fy] = frame[8], [kx,ky] = frame[7];
    if (mode === "glute") {
      const center = fy > 90 ? 72 : 43;
      return pose([[206,center-18],[198,center],[224,center-7]],[[184,center+9],[fx,fy]],[[172,center+6],[kx,ky]],
        [[240,center-19],[260,center-18]],[[241,center+5],[262,center+2]],[[273,center-17],[272,center+2]]);
    }
    return topView
      ? pose([[249,117],[236,124],[252,144]],[[223,137],[fx,fy]],[[221,128],[kx,ky]],
        [[267,154],[290,150]],[[270,136],[295,129]],[[296,151],[300,132]])
      : pose([[221,72],[219,89],[234,124]],[[205,103],[fx,fy]],[[196,111],[kx,ky]],
        [[216,150],[205,152]],[[250,149],[270,152]],[[192,158],[281,156]]);
  };
  const poses = [starting,moved,moved,moved,moved];
  return {...stretch(poses,topView ? undefined : mat),partnerFrames:poses.map(helper),topView};
}

const straightCalf = wallCalf("straight");
const bentCalf = wallCalf("slight");
const splitAdductor = sideLunge("lunge");
const raisedAdductor = footOnBench();
const wideSeat = seatedFloorStretch("wide");

export const lowerLimbStretchIllustrations: Readonly<Record<string, Illustration>> = {
  "0711": splitAdductor,
  "1169": seatedFloorStretch("groin"),
  "1711": assisted("glute"),
  "1848": straightCalf,
  "1877": sideLunge("hip"),
  "1878": crossStandingHip("unsupported"),
  "1880": crossStandingHip("wall"),
  "1881": crossStandingHip("upright"),
  "1882": lyingHipCross,
  "1883": ballHipCross,
  "1884": benchHipHang,
  "1888": bentCalf,
  "1891": kneelingFootStretch("toe-thighs"),
  "1892": frontAnkleKneel,
  "1893": deepAchilles,
  "1894": sideLunge("wide-knees"),
  "1896": raisedAdductor,
  "1897": raisedAdductor,
  "1898": kneelingAdductor,
  "1899": splitAdductor,
  "1900": sideLunge("hand"),
  "1901": proneAdductor,
  "1902": wideSeat,
  "1904": splitAdductor,
  "1905": wallHipOpen,
  "1906": abductionOneBent,
  "1907": assisted("abduction"),
  "1923": assisted("hamstring"),
  "1928": tibialBars,
  "1929": standingShin("slight-knee"),
  "1932": assisted("hip"),
  "1947": crossStandingHip("outer-hip"),
  "1957": standingShin("floor"),
  "1959": standingShin("raised"),
  "1960": kneelingFootStretch("shin"),
  "1961": kneelingFootStretch("toe-floor"),
  "2101": standingShin("crossed"),
  "2999": bandAchilles(false),
  "3000": bandAchilles(true),
  "3473": standingFigureFour(true),
  "3631": wideSeat,
  "3634": seatedFloorStretch("wide-overhead"),
  "4510": straightCalf,
  "4512": seatedFloorStretch("butterfly"),
  "4867": seatedFloorStretch("flaps"),
  "5902": standingFigureFour(false),
  "6444": kneelingFootStretch("thunderbolt"),
  "6771": iliopsoas,
  "6772": standingShin("outer-edge"),
  "8971": sideLunge("toes-up"),
  "10922": bentCalf,
  "11452": straightCalf,
  "11649": wallCalf("deep"),
};
