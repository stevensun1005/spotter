import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Body = [Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;

const pose = (body: Body, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb, toes: Limb): Point[] =>
  [...body,...nearArm,...farArm,...nearLeg,...farLeg,...toes];
const set = (frame: Point[], joints: Partial<Record<number, Point>>) =>
  frame.map((joint,index) => joints[index] ?? joint);
const feet: NonNullable<Illustration["dynamic"]> = [["foot-tip",8,11],["foot-tip",10,12]];
const mat: Props = [[48,159,273,159]];
const motion = (frames: Point[][], props: Props = mat, ms = 1000): Illustration =>
  ({frames,props,ms,reference:true,dynamic:feet});
const withHold = (frames: Point[][], props?: Props) =>
  motion([...frames,frames.at(-1)!,frames.at(-1)!,frames.at(-1)!],props);
const spinal = (frames: Point[][]) => ({...motion(frames),spine:[14,13]});

const table = pose([[200,82],[182,94],[126,99]],[[187,124],[190,155]],[[174,123],[176,154]],
  [[129,152],[94,153]],[[117,152],[82,153]],[[81,158],[70,157]]);
const quietChild = set(table,{
  0:[169,150],1:[155,141],2:[105,128],3:[179,149],4:[214,155],5:[170,148],6:[202,154],
  7:[131,153],9:[120,153],
});

const cowBase: Point[] = [...table,[141,98],[162,96]];
const cowArch = set(cowBase,{0:[201,74],1:[183,90],2:[124,92],3:[187,123],5:[173,121],13:[141,103],14:[162,104]});
const cowSlow = {...withHold([cowBase,cowArch]),spine:[14,13]};
const cowRepetitions = spinal([cowBase,cowArch,cowArch,cowBase]);
const tiger = spinal([
  cowBase,
  set(cowBase,{0:[179,125],1:[174,106],2:[129,105],9:[156,129],10:[125,140],12:[113,144],13:[141,88],14:[161,88]}),
  set(cowBase,{0:[205,77],1:[184,91],9:[92,94],10:[63,79],12:[60,69],13:[144,104],14:[164,102]}),
  cowBase,
  set(cowBase,{0:[181,123],1:[176,106],2:[128,106],7:[160,132],8:[131,144],11:[119,148],13:[141,87],14:[161,88]}),
  set(cowBase,{0:[205,75],1:[184,91],7:[92,91],8:[66,72],11:[64,63],13:[144,104],14:[164,102]}),
]);

const downDog = pose([[197,115],[182,101],[135,45]],[[207,131],[222,155]],[[195,131],[210,154]],
  [[106,102],[80,152]],[[96,102],[68,151]],[[94,158],[82,157]]);
const downDogMobility = motion([
  downDog,
  set(downDog,{2:[129,52],7:[119,113],8:[86,144],11:[94,158]}),
  downDog,
  set(downDog,{2:[140,52],9:[108,113],10:[74,143],12:[82,157]}),
  downDog,
],mat,960);

const seated = pose([[132,66],[132,84],[138,146]],[[156,111],[172,145]],[[146,108],[158,145]],
  [[174,112],[180,152]],[[166,109],[171,152]],[[195,158],[184,157]]);
const boatCup = set(seated,{0:[113,83],1:[122,100],2:[143,148],3:[150,111],4:[177,114],5:[142,107],6:[169,112],
  7:[180,116],8:[209,114],9:[172,113],10:[201,111],11:[217,103],12:[210,101]});
const boatStraight = set(boatCup,{7:[183,115],8:[218,84],9:[176,112],10:[210,82],11:[224,75],12:[216,73],
  3:[153,108],4:[185,109],5:[144,107],6:[177,108]});
const boat = withHold([seated,boatCup,boatStraight]);

const prone = pose([[220,141],[202,146],[147,150]],[[175,149],[151,152]],[[173,150],[149,153]],
  [[107,151],[73,153]],[[102,152],[65,153]],[[61,157],[54,156]]);
const bowGrip = set(prone,{7:[109,148],8:[119,110],11:[127,105],9:[104,150],10:[112,111],12:[120,105],
  3:[159,132],4:[119,110],5:[151,134],6:[112,111]});
const bow = withHold([prone,bowGrip,set(bowGrip,{
  0:[202,104],1:[190,121],2:[147,149],3:[160,114],4:[132,100],5:[154,117],6:[124,101],
  7:[108,132],8:[132,100],9:[101,133],10:[124,101],11:[140,93],12:[132,94],
})]);

const upright = pose([[154,44],[153,63],[152,109]],[[169,91],[168,116]],[[138,91],[140,116]],
  [[162,130],[163,152]],[[144,130],[142,152]],[[175,158],[130,158]]);
const wide = set(upright,{7:[186,132],8:[217,152],9:[117,132],10:[89,152],11:[232,158],12:[74,158]});
const warrior = set(wide,{
  0:[162,50],1:[157,69],2:[157,116],3:[188,68],4:[221,68],5:[123,69],6:[90,68],
  7:[208,127],8:[211,152],11:[230,158],9:[121,135],
});
const sideAngle = set(warrior,{
  0:[204,77],1:[190,93],2:[159,118],3:[206,126],4:[225,121],5:[215,77],6:[243,62],
});
const warriorTwo = withHold([wide,warrior]);
const extendedAngle = withHold([wide,warrior,sideAngle]);

const lowLunge = pose([[153,56],[151,72],[148,114]],[[174,95],[186,119]],[[159,96],[176,119]],
  [[193,121],[191,152]],[[111,153],[80,154]],[[205,158],[66,158]]);
const moonLunge = withHold([lowLunge,set(lowLunge,{0:[166,47],1:[160,64],2:[156,118],
  3:[173,41],4:[181,16],5:[156,41],6:[165,16]})]);

const prayerSquat = withHold([wide,set(wide,{
  0:[153,64],1:[153,80],2:[153,132],3:[187,126],4:[153,88],5:[119,126],6:[151,88],
  7:[189,126],8:[190,152],11:[204,157],9:[118,126],10:[116,152],12:[104,157],
})]);

const sitFloor = pose([[151,60],[151,78],[151,143]],[[171,107],[173,134]],[[132,107],[129,134]],
  [[170,147],[184,153]],[[129,147],[116,153]],[[196,157],[104,157]]);
const crossed = set(sitFloor,{
  7:[198,140],8:[152,151],11:[140,152],9:[105,140],10:[144,151],12:[159,155],
  3:[176,111],4:[189,140],5:[124,111],6:[115,140],
});
const halfLotus = set(crossed,{8:[124,130],11:[115,132]});
const fullLotus = withHold([sitFloor,halfLotus,set(halfLotus,{10:[175,127],12:[185,129]})]);
const siddhasana = withHold([sitFloor,crossed]);

const wall: Props = [[217,27,217,159],[217,140,230,130],[217,150,231,140]];
const supine = pose([[78,143],[97,150],[147,151]],[[119,151],[138,151]],[[116,153],[136,154]],
  [[174,152],[213,152]],[[168,153],[205,154]],[[225,157],[217,157]]);
const kneesUp = set(supine,{7:[171,114],8:[189,152],11:[203,157],9:[165,115],10:[181,151],12:[193,157]});
const hugging = set(kneesUp,{3:[121,124],4:[161,117],5:[118,125],6:[154,116],
  7:[133,106],8:[164,126],11:[176,130],9:[128,111],10:[157,125],12:[170,130]});
const kneesChest = withHold([supine,kneesUp,hugging]);

const atWall = set(supine,{0:[104,142],1:[125,149],2:[199,150],3:[145,154],4:[163,154],5:[145,151],6:[165,151],
  7:[187,119],8:[213,127],11:[216,118],9:[182,123],10:[207,131],12:[213,124]});
const legsUpWall = withHold([atWall,set(atWall,{7:[202,112],8:[212,69],11:[214,57],9:[198,112],10:[207,68],12:[211,55]})],[...mat,...wall]);

const overheadSupine = set(supine,{
  0:[76,89],1:[94,89],2:[146,89],3:[98,115],4:[111,137],5:[98,64],6:[111,42],
  7:[181,97],8:[218,101],11:[231,104],9:[177,82],10:[216,77],12:[230,76],
});
const kneeCross = set(overheadSupine,{7:[158,118],8:[190,106],11:[202,105]});
const spinalTwist = {...withHold([overheadSupine,kneeCross,set(kneeCross,{
  0:[76,94],7:[152,56],8:[181,56],11:[190,60],5:[123,62],6:[153,56],
})],[]),topView:true};

const supportedLift = set(supine,{
  0:[100,143],1:[120,148],2:[133,114],3:[155,151],4:[144,118],5:[145,152],6:[135,123],
  7:[161,90],8:[182,107],11:[191,108],9:[156,93],10:[175,111],12:[184,111],
});
const shoulderVertical = set(supportedLift,{
  2:[129,99],4:[139,104],6:[131,109],7:[132,65],8:[133,32],11:[137,21],9:[126,66],10:[126,32],12:[129,21],
});
const shoulderStand = withHold([supine,supportedLift,shoulderVertical]);
const plow = withHold([supine,supportedLift,shoulderVertical,set(shoulderVertical,{
  2:[124,96],7:[93,105],8:[62,139],11:[54,156],9:[87,110],10:[56,142],12:[48,156],
})]);

function forearmBalance(headDown: boolean) {
  const supported = set(table,{
    0:headDown ? [189,149] : [211,115],1:headDown ? [185,128] : [192,106],
    3:[193,153],4:[headDown ? 199 : 222,155],5:[182,151],6:[headDown ? 196 : 213,153],
  });
  const atDolphin = set(supported,{
    0:headDown ? [189,149] : [205,131],1:headDown ? [185,128] : [194,116],2:[148,80],
    7:[120,110],8:[115,151],11:[125,157],9:[113,113],10:[106,150],12:[117,157],
  });
  const first = set(atDolphin,{
    2:[173,76],7:[161,43],8:[163,17],11:[166,7],
    9:[147,113],10:[132,150],12:[144,156],
  });
  const together = set(first,{
    2:[186,76],7:[189,47],8:[190,17],11:[191,7],9:[182,48],10:[182,18],12:[183,8],
  });
  return motion([supported,atDolphin,first,together,together,together,first,atDolphin,supported]);
}

const bound = set(upright,{
  3:[140,88],4:[133,109],5:[130,88],6:[131,110],
  7:[151,132],8:[155,152],11:[169,158],9:[141,132],10:[141,152],12:[152,156],
});
const seal = withHold([
  bound,
  set(bound,{0:[176,62],1:[168,78],2:[140,111],3:[137,84],4:[117,67],5:[135,80],6:[116,68]}),
  set(bound,{0:[195,141],1:[180,127],2:[136,109],3:[159,92],4:[145,60],5:[156,92],6:[143,60]}),
],[]);
const armsHigh = set(bound,{0:[153,49],1:[151,64],3:[161,42],4:[161,16],5:[144,41],6:[144,16]});
const straightAngle = withHold([armsHigh,set(armsHigh,{
  0:[199,114],1:[182,110],2:[132,110],3:[213,111],4:[245,110],5:[210,106],6:[243,105],
  7:[143,132],9:[135,132],
})],[]);

const facingPalm = set(armsHigh,{
  0:[153,47],1:[153,65],2:[153,110],3:[164,41],4:[153,12],5:[142,41],6:[153,12],
  7:[158,131],8:[156,152],11:[162,158],9:[147,132],10:[148,152],12:[142,158],
});
const leaningPalm = (side: -1 | 1) => set(facingPalm,{
  0:[153+side*26,51],1:[153+side*17,68],3:[164+side*24,45],4:[153+side*35,21],
  5:[142+side*24,42],6:[153+side*35,21],2:[153-side*3,110],
});
const palmLeft = leaningPalm(-1), palmRight = leaningPalm(1);
const palmTree = motion([facingPalm,palmLeft,palmLeft,palmLeft,facingPalm,palmRight,palmRight,palmRight],[],1080);

const eagleArms = set(upright,{3:[176,90],4:[162,54],5:[151,86],6:[167,53]});
const eagleKnees = set(eagleArms,{
  0:[152,50],1:[151,68],2:[153,118],7:[158,139],8:[156,152],11:[165,158],
  9:[151,134],10:[171,147],12:[165,154],
});
const eagle = withHold([upright,eagleArms,eagleKnees],[]);

const flyingLizard = (() => {
  const grounded = pose([[213,88],[198,105],[145,126]],[[203,128],[207,155]],[[191,127],[194,154]],
    [[211,116],[222,152]],[[108,140],[77,152]],[[234,158],[65,158]]);
  const shifted = set(grounded,{0:[226,102],1:[210,116],2:[152,125],3:[190,130],5:[184,129],7:[194,119]});
  const rearFloat = set(shifted,{9:[114,109],10:[81,103],12:[69,103]});
  const flying = set(rearFloat,{0:[230,107],1:[212,119],2:[154,122],7:[191,119],8:[179,138],11:[188,137]});
  const rearDown = set(flying,{9:grounded[9],10:grounded[10],12:grounded[12]});
  return motion([flying,flying,rearDown,grounded,shifted,rearFloat,flying],mat,850);
})();

export const yogaIllustrations: Readonly<Record<string, Illustration>> = {
  "0136": boat,
  "0956": fullLotus,
  "1481": bow,
  "1483": fullLotus,
  "1485": plow,
  "1487": shoulderStand,
  "1491": spinalTwist,
  "2107": cowRepetitions,
  "3528": downDogMobility,
  "4365": withHold([table,quietChild]),
  "4381": legsUpWall,
  "4392": boat,
  "4399": seal,
  "4402": straightAngle,
  "4404": palmTree,
  "4405": eagle,
  "4406": tiger,
  "4410": warriorTwo,
  "5220": extendedAngle,
  "6120": kneesChest,
  "6138": prayerSquat,
  "6618": moonLunge,
  "6878": siddhasana,
  "6879": forearmBalance(true),
  "6880": forearmBalance(false),
  "6901": cowSlow,
  "7624": flyingLizard,
};
