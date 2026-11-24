import type { Illustration, Point } from "./motion-data";
import { yogaIllustrations } from "./yoga-illustrations";
import { lowerLimbStretchIllustrations } from "./lower-limb-stretch-illustrations";

type Body = [Point, Point, Point];
type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const pose = (body: Body, nearArm: Limb, farArm: Limb, nearLeg: Limb, farLeg: Limb, toes: Limb): Point[] =>
  [...body,...nearArm,...farArm,...nearLeg,...farLeg,...toes];
const set = (frame: Point[], points: Partial<Record<number,Point>>) => frame.map((point,i)=>points[i]??point);
const mat: Props = [[50,159,268,159]];
const feet: Attachments = [["foot-tip",8,11],["foot-tip",10,12]];
const move = (frames: Point[][], ms=930, props: Props = mat, extra: Attachments = []): Illustration =>
  ({frames,props,ms,dynamic:[...feet,...extra],reference:true});
const hold = (frames: Point[][], props?: Props, extra?: Attachments) => {
  const last = frames.at(-1)!;
  return move([...frames,last,last,last,...frames.slice(1,-1).reverse()],1030,props,extra);
};
const keyPoseCover = (illustration: Illustration, frame: number): Illustration => ({
  ...illustration,
  frames:[...illustration.frames.slice(frame),...illustration.frames.slice(0,frame)],
});
const alternateLimbs = (frame: Point[]) => set(frame,{
  3:frame[5],4:frame[6],5:frame[3],6:frame[4],
  7:frame[9],8:frame[10],11:frame[12],9:frame[7],10:frame[8],12:frame[11],
});
const otherSide = (frames: Point[][]): Point[][] => {
  const last = frames.at(-1)!;
  const oneSide = [...frames,last,last,...frames.slice(1,-1).reverse()];
  return [...oneSide,...oneSide.map(alternateLimbs)];
};

const table = pose([[206,82],[188,95],[127,101]],[[193,125],[194,155]],[[176,124],[176,154]],
  [[130,152],[95,153]],[[117,151],[83,152]],[[83,158],[71,157]]);
const plank = pose([[228,87],[210,104],[146,124]],[[214,130],[212,155]],[[200,129],[198,154]],
  [[110,138],[74,152]],[[98,139],[63,151]],[[86,158],[75,157]]);
const lowStaff = set(plank,{0:[239,108],1:[220,122],2:[154,132],3:[208,124],5:[195,124],7:[112,142],9:[101,141]});
const staff = move([plank,set(plank,{0:[233,90],1:[215,105],2:[151,123]}),lowStaff,lowStaff,plank],850);

const sideLift = (frame: Point[], near: boolean, highest: boolean) => set(frame,near
  ? {7:highest ? [107,96] : [109,116],8:highest ? [74,85] : [72,111],11:highest ? [64,83] : [61,110]}
  : {9:highest ? [101,94] : [104,114],10:highest ? [65,81] : [66,109],12:highest ? [55,82] : [55,108]});
const threeLimbStaff = move([
  plank,sideLift(plank,true,false),sideLift(lowStaff,true,false),sideLift(lowStaff,true,false),sideLift(plank,true,false),plank,
  sideLift(plank,false,false),sideLift(lowStaff,false,false),sideLift(lowStaff,false,false),sideLift(plank,false,false),
],815);

const dog = pose([[194,112],[182,97],[133,44]],[[201,126],[213,155]],[[193,126],[201,153]],
  [[106,103],[80,151]],[[96,104],[68,150]],[[93,158],[82,157]]);
const approachDog = set(table,{0:[197,101],1:[180,105],2:[131,85],3:[193,126],4:[213,155],5:[183,126],6:[201,153],
  7:[111,124],8:[84,149],11:[94,157],9:[104,126],10:[73,151],12:[84,158]});
const floorDog = hold([table,approachDog,dog]);
const threeLegDog = move([
  dog,sideLift(dog,true,true),set(dog,{7:[104,29],8:[72,12],11:[61,7]}),
  set(dog,{7:[104,29],8:[72,12],11:[61,7]}),dog,
  sideLift(dog,false,true),set(dog,{9:[108,27],10:[81,10],12:[70,5]}),
  set(dog,{9:[108,27],10:[81,10],12:[70,5]}),
],1020);
const dogTouch = move([
  dog,set(dog,{3:[145,121],4:[79,151],1:[181,96],2:[132,48]}),
  dog,set(dog,{5:[146,125],6:[94,151],1:[179,97],2:[139,47]}),
],1060);

const forearms = set(table,{0:[202,110],1:[183,114],3:[193,152],4:[220,154],5:[181,152],6:[209,154]});
const dolphin = hold([table,forearms,set(dog,{
  0:[191,128],1:[178,107],3:[184,152],4:[218,155],5:[173,151],6:[205,154],
})]);
const proneDog = pose([[220,140],[204,144],[145,150]],[[181,137],[209,154]],[[174,139],[197,154]],
  [[111,151],[76,153]],[[100,152],[65,153]],[[64,158],[53,157]]);
const upwardDog = set(proneDog,{
  0:[215,69],1:[202,87],2:[147,132],3:[206,119],5:[197,120],7:[112,140],9:[101,143],
});
const floorUpDog = hold([proneDog,upwardDog]);

const catTable: Point[] = [...table,[147,99],[169,97]];
const catArch = set(catTable,{0:[194,120],1:[184,105],2:[128,105],13:[145,79],14:[169,80]});
const cat = {...hold([catTable,catArch]),spine:[14,13]};
const tigerCurl = {...move([
  catTable,
  set(catTable,{0:[209,80],1:[189,93],7:[92,99],8:[57,98],11:[46,98],13:[148,102],14:[171,100]}),
  set(catArch,{7:[163,125],8:[137,139],11:[126,144]}),
  set(catTable,{7:[92,99],8:[57,98],11:[46,98],13:[148,102],14:[171,100]}),
  catTable,
  set(catTable,{0:[208,79],9:[90,98],10:[52,98],12:[42,97]}),
  set(catArch,{9:[157,122],10:[133,137],12:[122,142]}),
]),spine:[14,13]};

const child = set(table,{0:[176,148],1:[160,142],2:[105,131],3:[190,149],4:[222,156],
  5:[174,149],6:[208,156],7:[136,152],9:[123,152]});
const childMoving = move([table,child,
  set(child,{0:[187,145],1:[170,136],2:[121,124],3:[194,145],4:[223,154],5:[180,144],6:[211,153]}),child,
  set(child,{0:[176,139],3:[197,141],4:[234,147],5:[181,137],6:[216,143]}),child,
  set(child,{0:[170,150],3:[183,154],4:[213,157],5:[165,151],6:[197,155]}),child],1050);

const lizard = set(plank,{0:[229,92],1:[209,107],2:[147,130],7:[217,115],8:[219,151],11:[232,158]});
const lizardLow = set(lizard,{0:[224,94],1:[204,110],2:[145,133],
  3:[202,131],4:[204,155],5:[185,131],6:[182,152],
  7:[230,117],8:[240,151],11:[254,158],9:[108,153],10:[79,153],12:[68,158]});
const lizardHold = move(otherSide([table,lizard,lizardLow,lizardLow,lizardLow]),1040);

const standing = pose([[153,38],[151,58],[151,107]],[[160,85],[162,111]],[[142,86],[141,110]],
  [[156,131],[157,153]],[[144,131],[145,153]],[[169,158],[156,156]]);
const openPalms = set(standing,{3:[165,85],4:[169,110],5:[139,84],6:[135,110]});
const breathe = (frame: Point[]) => {
  const [x0,y0] = frame[0], [x1,y1] = frame[1];
  return move([frame,set(frame,{0:[x0,y0-2],1:[x1,y1-2]}),frame],2100,[]);
};
const armsUp = set(standing,{3:[160,38],4:[161,13],5:[143,37],6:[145,12]});
const chair = set(armsUp,{
  0:[168,51],1:[157,66],2:[137,113],3:[174,45],4:[187,24],5:[163,44],6:[175,22],
  7:[161,130],9:[151,129],
});
const lowerChair = set(chair,{0:[174,56],1:[166,71],2:[128,123],3:[183,48],4:[199,29],5:[174,47],6:[189,29],
  7:[172,130],9:[162,130]});
const chairHold = hold([standing,chair],[]);
const chairDeep = hold([standing,chair,lowerChair],[]);

const forwardFold = set(standing,{
  0:[174,136],1:[163,121],2:[138,100],3:[165,136],4:[174,156],5:[154,134],6:[161,155],
  7:[150,132],9:[140,131],
});
const flatBack = set(forwardFold,{
  0:[208,89],1:[193,93],2:[135,98],3:[177,122],4:[157,133],5:[174,119],6:[146,130],
});
const handsHeart = set(standing,{3:[167,82],4:[153,70],5:[136,81],6:[151,70]});
const halfSalute = move([standing,armsUp,forwardFold,flatBack,forwardFold,armsUp,handsHeart],900,[]);
const standingHalf = hold([standing,forwardFold,flatBack],[]);

const lunge = pose([[160,48],[158,67],[157,113]],[[180,92],[189,117]],[[169,92],[179,115]],
  [[198,122],[198,153]],[[118,135],[86,146]],[[211,158],[96,158]]);
const raisedLunge = set(lunge,{0:[163,42],1:[158,61],3:[173,39],4:[178,14],5:[150,38],6:[151,14]});
const warriorOne = set(raisedLunge,{9:[119,139],10:[81,152],12:[91,157]});
const retreatLunge = move(otherSide([standing,lunge,raisedLunge]),1050,[]);
const warriorOneHold = move(otherSide([standing,lunge,warriorOne]),1050,[]);
const lungeHands = set(lunge,{0:[229,94],1:[211,107],2:[151,128],3:[210,129],4:[213,155],
  5:[196,129],6:[199,154]});
const humbleAligned = set(warriorOne,{3:[138,88],4:[132,107],5:[129,86],6:[131,105]});
const humbleWarrior = move(otherSide([standing,humbleAligned,set(humbleAligned,{
  0:[194,139],1:[181,122],2:[157,109],3:[176,92],4:[165,58],5:[168,90],6:[165,57],
})]),1100,[]);

const pyramidBase = set(lunge,{0:[159,45],1:[156,63],2:[153,106],7:[181,131],8:[196,151],11:[207,158],
  9:[122,133],10:[94,152],12:[103,157]});
const pyramid = move(otherSide([standing,pyramidBase,set(pyramidBase,{
  0:[211,114],1:[191,112],2:[146,104],3:[188,132],4:[185,156],5:[180,132],6:[178,155],
})]),1080,[]);

const warriorTwo = yogaIllustrations["4410"];
const wideStand = warriorTwo.frames[0];
const openWarrior = warriorTwo.frames[1];
const mirror = (frame: Point[]) => frame.map(([x,y]): Point=>[308-x,y]);
const mirrorSides = (frames: Point[][]): Point[][] => {
  const last = frames.at(-1)!;
  const oneSide = [...frames,last,last,...frames.slice(1,-1).reverse()];
  return [...oneSide,...oneSide.map(mirror)];
};
const warriorTwoSides = move(mirrorSides([wideStand,openWarrior]),1070,[]);
const reverseWarrior = move(mirrorSides([wideStand,openWarrior,set(openWarrior,{
  0:[141,48],1:[147,68],2:[157,116],3:[160,45],4:[174,22],5:[122,98],6:[112,127],
})]),1080,[]);
const triangleStart = set(wideStand,{3:[187,65],4:[219,65],5:[120,65],6:[89,65]});
const trianglePose = set(triangleStart,{
  0:[219,105],1:[199,103],2:[154,113],3:[205,125],4:[211,146],5:[196,73],6:[192,44],
});
const triangle = move(mirrorSides([wideStand,triangleStart,trianglePose]),1060,[]);
const halfMoon = move(mirrorSides([triangleStart,trianglePose,set(trianglePose,{
  0:[224,100],1:[206,105],2:[158,111],3:[213,130],4:[215,155],5:[205,74],6:[205,42],
  7:[163,132],8:[161,152],11:[174,158],9:[124,109],10:[90,110],12:[80,109],
})]),1060,[]);

const warriorThree = move(otherSide([standing,armsUp,set(standing,{
  0:[209,101],1:[187,105],2:[145,108],3:[212,105],4:[239,103],5:[210,99],6:[236,98],
  7:[153,132],8:[153,152],11:[166,158],9:[111,107],10:[78,108],12:[66,106],
})]),1100);
const dancerReady = set(standing,{
  3:[179,71],4:[199,68],5:[134,93],6:[125,115],9:[129,133],10:[116,113],12:[124,105],
});
const dancer = move(otherSide([standing,dancerReady,set(dancerReady,{
  0:[187,77],1:[172,91],2:[144,108],3:[201,84],4:[227,76],5:[151,68],6:[122,54],
  9:[111,89],10:[122,54],12:[130,44],
})]),1150);
const standingFront = pose([[154,38],[154,57],[154,106]],[[172,83],[177,108]],[[135,83],[130,107]],
  [[162,131],[161,154]],[[146,131],[146,154]],[[169,158],[138,158]]);
const treeReady = set(standingFront,{7:[154,131],8:[154,154],11:[155,158],
  9:[108,119],10:[148,138],12:[152,149]});
const treeHold = set(treeReady,{3:[171,85],4:[155,70],5:[138,85],6:[154,70]});
const tree = move([
  standingFront,treeReady,treeHold,treeHold,treeHold,
  standingFront,mirror(treeReady),mirror(treeHold),mirror(treeHold),mirror(treeHold),
],1050);

const supine = pose([[83,143],[101,150],[153,151]],[[124,153],[144,156]],[[120,147],[139,149]],
  [[193,152],[233,153]],[[193,148],[231,149]],[[241,149],[239,146]]);
const corpse = move([
  supine,set(supine,{0:[83,142],1:[101,148]}),supine,supine,
  set(supine,{0:[87,141],1:[103,147],2:[149,146],3:[115,149],4:[134,153],
    7:[175,134],8:[207,151],11:[219,155],9:[169,137],10:[205,149],12:[217,153]}),
  set(supine,{0:[103,99],1:[112,115],2:[149,146],3:[105,135],4:[100,153],
    7:[171,132],8:[196,151],11:[204,157],9:[163,131],10:[184,149],12:[194,154]}),
],1570);
const happyHold = set(supine,{
  0:[76,143],1:[97,150],2:[146,149],3:[115,125],4:[120,103],5:[106,124],6:[109,102],
  7:[139,119],8:[128,89],11:[119,100],9:[128,117],10:[114,87],12:[108,99],
});
const happyBaby = move([supine,happyHold,
  set(happyHold,{2:[154,146],7:[155,117],8:[136,86],11:[126,97],4:[126,100],
    9:[138,120],10:[123,87],12:[114,96],6:[114,101]}),
  happyHold],1160);

const [boatReady, boatLift] = yogaIllustrations["0136"].frames;
const halfBoat = hold([boatReady,set(boatLift,{
  7:[182,113],8:[217,113],11:[224,103],9:[176,110],10:[209,110],12:[216,101],
})],[]);
const frogReady = set(proneDog,{0:[225,114],1:[204,124],3:[205,151],4:[232,155],5:[190,150],6:[214,153]});
const frogNear = set(frogReady,{
  0:[220,106],1:[201,123],3:[179,103],4:[145,125],7:[110,149],8:[136,123],11:[149,131],
});
const frogFar = set(frogReady,{
  0:[217,108],1:[197,124],5:[173,108],6:[138,125],9:[101,150],10:[129,126],12:[141,132],
});
const halfFrog = move([frogReady,frogNear,frogNear,frogReady,frogFar,frogFar],1150);

const kneel = pose([[155,44],[155,62],[155,102]],[[166,87],[171,112]],[[143,87],[140,113]],
  [[161,144],[176,151]],[[149,144],[136,150]],[[185,157],[127,157]]);
const hero = hold([kneel,set(kneel,{
  0:[155,71],1:[155,90],2:[155,136],3:[165,114],4:[162,136],5:[145,114],6:[149,137],
  7:[160,151],8:[177,149],11:[188,155],9:[151,151],10:[134,148],12:[123,154],
})]);
const lotusPose = yogaIllustrations["0956"].frames[2];
const lotusBreathing = breathe(lotusPose);
const meditationPose = yogaIllustrations["6878"].frames[1];
const meditationKnees = breathe(meditationPose);
const meditationLap = breathe(set(meditationPose,{3:[171,123],4:[158,142],5:[135,123],6:[150,142]}));

const craneSetup = set(lowerChair,{
  0:[202,104],1:[186,112],2:[158,126],3:[205,137],4:[216,155],5:[193,136],6:[202,154],
  7:[192,128],8:[172,153],11:[181,158],9:[176,126],10:[156,152],12:[165,157],
});
const craneLean = set(craneSetup,{
  0:[223,102],1:[206,111],2:[164,111],3:[202,133],5:[190,130],
  7:[199,121],8:[159,139],11:[162,143],9:[187,120],10:[153,152],12:[162,157],
});
const craneLift = set(craneLean,{
  0:[228,98],1:[210,104],2:[174,91],3:[212,130],5:[199,125],
  7:[209,118],8:[169,122],11:[169,129],9:[196,113],10:[155,116],12:[155,124],
});
const craneBack = (frame:Point[], back:Point[]) => [...frame,...back];
const crane = {...hold([
  craneBack(craneSetup,[[166,120],[175,116]]),
  craneBack(craneLean,[[178,105],[194,103]]),
  craneBack(craneLift,[[182,89],[197,95]]),
]),spine:[14,13]};

const peacockReady = set(table,{
  0:[205,107],1:[185,118],2:[133,122],3:[156,126],4:[158,154],5:[145,126],6:[146,154],
  7:[118,153],9:[107,152],
});
const peacockLean = set(peacockReady,{
  0:[228,119],1:[205,124],2:[146,113],3:[152,131],5:[144,130],
  7:[118,138],8:[77,151],11:[65,153],9:[110,136],10:[67,150],12:[56,153],
});
const peacockLift = set(peacockLean,{
  0:[230,107],1:[210,113],2:[144,106],3:[152,130],5:[143,128],
  7:[111,107],8:[75,107],11:[63,108],9:[101,105],10:[66,104],12:[55,106],
});
const peacockHands = (frame:Point[]): Point[] => [...frame,[148,155],[136,155]];
const peacock = hold([
  peacockHands(peacockReady),peacockHands(peacockLean),peacockHands(peacockLift),
],mat,[["palm-down",4,13],["palm-down",6,14]]);

const alternateLead = (frame: Point[]) => set(frame,{
  7:frame[9],8:frame[10],11:frame[12],9:frame[7],10:frame[8],12:frame[11],
});
const saluteA = move([
  standing,armsUp,forwardFold,flatBack,lungeHands,plank,lowStaff,upwardDog,dog,
  lungeHands,flatBack,forwardFold,armsUp,handsHeart,standing,
],880);
const saluteB = move([
  standing,chair,forwardFold,flatBack,lungeHands,plank,lowStaff,upwardDog,dog,
  lungeHands,warriorOne,lungeHands,plank,lowStaff,upwardDog,dog,
  alternateLead(lungeHands),alternateLead(warriorOne),alternateLead(lungeHands),
  plank,lowStaff,upwardDog,dog,lungeHands,flatBack,forwardFold,chair,standing,
],880);
const vinyasa = move([plank,lowStaff,upwardDog,dog,dog,plank],960);
const [eagleStand,eagleSetup,eagleHold] = yogaIllustrations["4405"].frames;
const eagleSides = move(otherSide([eagleStand,eagleSetup,eagleHold]),1030,[]);

export const matYogaIllustrations: Record<string, Illustration> = {
  "5915":keyPoseCover(threeLimbStaff,2),
  "5887":keyPoseCover(threeLegDog,2),
  "0942":keyPoseCover(cat,1),
  "0944":keyPoseCover(chairHold,1),
  "0943":keyPoseCover(chairDeep,2),
  "6290":keyPoseCover(staff,2),
  "5888":keyPoseCover(staff,2),
  "5889":corpse,
  "0946":keyPoseCover(crane,2),
  "0947":keyPoseCover(yogaIllustrations["4404"],1),
  "6304":keyPoseCover(dancer,2),
  "0948":breathe(standing),
  "6288":keyPoseCover(dolphin,2),
  "3469":keyPoseCover(floorDog,2),
  "0949":keyPoseCover(floorDog,2),
  "3527":keyPoseCover(dogTouch,1),
  "6301":keyPoseCover(eagleSides,2),
  "5914":keyPoseCover(staff,2),
  "6292":keyPoseCover(lowerLimbStretchIllustrations["1901"],2),
  "0951":keyPoseCover(yogaIllustrations["6138"],1),
  "6300":keyPoseCover(halfBoat,1),
  "6294":keyPoseCover(halfFrog,1),
  "0952":keyPoseCover(halfMoon,2),
  "5982":halfSalute,
  "5917":keyPoseCover(happyBaby,1),
  "0954":keyPoseCover(hero,1),
  "5891":keyPoseCover(retreatLunge,2),
  "6341":keyPoseCover(humbleWarrior,2),
  "5892":keyPoseCover(lizardHold,2),
  "5885":lotusBreathing,
  "5894":meditationKnees,
  "5895":meditationLap,
  "5896":breathe(openPalms),
  "8130":keyPoseCover(childMoving,1),
  "6293":keyPoseCover(peacock,2),
  "5898":keyPoseCover(pyramid,2),
  "5913":keyPoseCover(reverseWarrior,2),
  "5903":keyPoseCover(standingHalf,2),
  "5980":saluteA,
  "5981":saluteB,
  "5905":keyPoseCover(tigerCurl,2),
  "0961":keyPoseCover(tree,2),
  "0962":keyPoseCover(triangle,2),
  "1366":keyPoseCover(floorUpDog,1),
  "5983":vinyasa,
  "5907":keyPoseCover(warriorThree,2),
  "3471":keyPoseCover(warriorOneHold,2),
  "0964":keyPoseCover(warriorOneHold,2),
  "6291":keyPoseCover(warriorTwoSides,1),
  "0963":keyPoseCover(warriorTwoSides,1),
};
