import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const feet: Attachments = [["foot-tip",8,11],["foot-tip",10,12]];
const set = (frame:Point[], replacements:Partial<Record<number,Point>>) =>
  frame.map((point,index)=>replacements[index]??point);
const move = (frames:Point[][], dynamic:Attachments = [], props:Props = [], ms=950):Illustration =>
  ({frames,ms,props,dynamic:[...feet,...dynamic],reference:true});
const hold = (frames:Point[][], dynamic?:Attachments, props?:Props):Illustration => {
  const end=frames.at(-1)!;
  return move([end,end,end,...frames.slice(0,-1).reverse(),...frames.slice(0,-1)],dynamic,props,1030);
};
const flip = (frame:Point[]) => frame.map(([x,y]):Point=>[320-x,y]);
const swap = (frame:Point[]) => set(frame,{
  3:frame[5],4:frame[6],5:frame[3],6:frame[4],
  7:frame[9],8:frame[10],11:frame[12],9:frame[7],10:frame[8],12:frame[11],
});
const sided = (frames:Point[][], dynamic?:Attachments, props?:Props, transform=flip):Illustration => {
  const end=frames.at(-1)!;
  const direction=[...frames,end,end,...frames.slice(0,-1).reverse()];
  const both=[...direction,...direction.map(transform)];
  return move([...both.slice(frames.length-1),...both.slice(0,frames.length-1)],dynamic,props,1050);
};
const tall:Point[] = [
  [160,39],[160,59],[160,109],[175,82],[179,108],[145,82],[141,108],
  [169,131],[171,153],[151,131],[149,153],[179,158],[141,158],
];
const side:Point[] = [
  [152,40],[150,60],[148,108],[154,85],[158,110],[145,83],[147,107],
  [155,132],[154,154],[143,131],[142,153],[167,158],[155,157],
];
const kneeSide:Point[] = [
  [134,69],[133,87],[127,120],[140,109],[146,131],[128,108],[137,130],
  [139,153],[104,153],[129,151],[96,151],[91,157],[84,156],
];
const ball:Attachments = [["stability-ball",13,0,0]];
const sitBall:Point[] = [
  [135,56],[135,74],[135,118],[151,95],[177,106],[145,94],[169,104],
  [179,123],[181,153],[166,121],[163,152],[196,158],[179,157],
  [137,141],
];
const ballBridge = set(sitBall,{0:[95,101],1:[113,109],2:[164,121],
  3:[95,108],4:[69,102],5:[91,107],6:[65,102],7:[192,125],8:[199,152],
  9:[179,126],10:[188,152],11:[212,158],12:[200,157],13:[140,141]});
const ballArch = set(ballBridge,{0:[96,122],1:[102,114],2:[163,122],
  3:[80,116],4:[60,127],5:[75,113],6:[52,122],13:[134,141]});
const overBall = {...hold([sitBall,ballBridge,ballArch],ball),spine:[14]};
overBall.frames=overBall.frames.map(frame=>{
  const ballX=frame[13][0];
  return [...frame,[ballX,frame[1][1]<95?95:113]];
});

const kneelBall:Point[] = [...kneeSide,[194,141]];
const ballTorso = set(kneelBall,{0:[217,115],1:[196,113],2:[152,117],
  3:[210,136],4:[218,154],5:[204,135],6:[211,151],13:[164,141]});
const ballProne = set(ballTorso,{0:[222,139],1:[202,124],2:[163,116],
  3:[216,140],4:[230,154],5:[206,141],6:[220,153],7:[144,149],9:[135,149]});
const proneBall = hold([kneelBall,ballTorso,ballProne],ball);

const kneelArms = set(kneelBall,{0:[151,84],1:[137,98],2:[108,126],
  3:[171,123],4:[187,119],5:[162,122],6:[181,118],7:[117,153],9:[107,152]});
const rollArms = set(kneelArms,{0:[147,124],1:[128,119],2:[86,121],
  3:[176,128],4:[201,121],5:[166,129],6:[191,123],7:[115,153],9:[103,152],13:[203,141]});
const kneelingSpineBall = hold([kneelArms,rollArms],ball);

const raisedHeel:Point[] = [...set(side,{0:[112,43],1:[112,62],2:[110,108],3:[122,86],4:[131,105],5:[116,85],6:[123,106],
  7:[140,114],8:[175,118],11:[179,107],9:[107,131],10:[109,153],12:[122,157]}),[176,141]];
const heelLean = set(raisedHeel,{0:[157,63],1:[142,76],3:[145,97],4:[153,112],5:[135,95],6:[144,110]});
const heelRelax=set(heelLean,{0:[163,71],1:[149,83],3:[151,100],4:[162,115],5:[141,98],6:[153,113]});
const standingBallHamstring = sided([raisedHeel,heelLean,heelLean,heelRelax],ball,[],swap);

const wall:Props = [[239,33,239,159],[239,45,247,39],[239,69,247,63],[239,94,247,88],[239,118,247,112],[239,143,247,137]];
const wallBallReady:Point[] = [...set(tall,{3:[185,72],4:[196,69],5:[147,84],6:[144,108]}),[204,69]];
const wallBallVariations = [[200,55],[212,66],[202,77],[193,66],[200,55],[193,66],[202,77],[212,66]];
const rollWall = wallBallVariations.map(([x,y])=>set(wallBallReady,{3:[182,y+5],4:[x-6,y],13:[x,y]}));
const wallBallCircles = move([...rollWall,...rollWall.map(flip)],ball,
  [[89,28,231,28],[89,28,89,157],[231,28,231,157],[89,75,231,75],[89,126,231,126]],550);

const ballSeatedReady = set(sitBall,{0:[133,57],1:[133,76],3:[143,97],4:[151,113],5:[132,97],6:[143,110]});
const ballSeatedLift = set(ballSeatedReady,{7:[186,119],8:[189,142],11:[205,148]});
const ballSeatedArms = set(ballSeatedLift,{3:[158,82],4:[183,82],5:[149,81],6:[177,80]});
const ballSeatedDepress = set(ballSeatedArms,{1:[132,79],3:[155,85],4:[178,85],5:[147,83],6:[172,83]});
const ballSeatedRetract = set(ballSeatedDepress,{1:[129,77],3:[147,86],4:[168,86],5:[139,84],6:[164,84]});
const ballScapulae = move([
  ballSeatedReady,ballSeatedLift,ballSeatedArms,ballSeatedDepress,ballSeatedRetract,ballSeatedReady,
  swap(ballSeatedLift),swap(ballSeatedArms),swap(ballSeatedDepress),swap(ballSeatedRetract),
],ball);

const chinStart:Point[] = [...set(side,{0:[159,40],3:[157,79],4:[169,49]}),[167,47],[166,50]];
const chinTucked = set(chinStart,{0:[152,40],4:[163,49],13:[160,47],14:[160,50]});
const chinTuck = hold([chinStart,chinTucked],[["digit",4,13,2],["digit",4,14,2]]);

const supportedSide = set(tall,{0:[150,39],1:[147,58],2:[148,109],3:[157,37],4:[155,12],
  5:[136,86],6:[130,111],7:[161,133],8:[176,153],9:[136,132],10:[120,154],11:[184,158],12:[110,158]});
const supportedLean = set(supportedSide,{0:[121,49],1:[128,66],3:[118,42],4:[101,21],5:[119,90],6:[121,112]});
const partnerTall = set(tall,{0:[199,38],1:[198,56],2:[195,108],
  3:[184,81],4:[154,108],5:[181,36],6:[160,16],7:[206,130],8:[212,153],
  9:[188,132],10:[184,153],11:[221,157],12:[179,157]});
const partnerSide = set(partnerTall,{5:[160,37],6:[106,24]});
const tandemSide:Illustration = {
  ...move([supportedLean,supportedLean,supportedSide,tall,flip(supportedSide),flip(supportedLean),
    flip(supportedLean),flip(supportedSide)],[],[],1060),
  partnerFrames:[partnerSide,partnerSide,partnerTall,partnerTall,flip(partnerTall),flip(partnerSide),flip(partnerSide),flip(partnerTall)],
};
const behindUp = set(partnerTall,{
  0:[174,30],1:[173,50],2:[171,102],3:[166,83],4:[153,105],5:[169,25],6:[159,13],
  7:[186,128],8:[191,151],9:[156,128],10:[147,149],11:[200,155],12:[139,154],
});
const behindBent = set(behindUp,{5:[135,31],6:[106,22]});
const assistedSide:Illustration = {...tandemSide,partnerFrames:[
  behindBent,behindBent,behindUp,behindUp,flip(behindUp),flip(behindBent),flip(behindBent),flip(behindUp),
]};

const supine:Point[] = [
  [66,144],[86,149],[135,150],[113,152],[133,154],[108,147],[130,148],
  [159,133],[191,120],[170,151],[204,152],[202,119],[216,157],
];
const assistedLegUp = set(supine,{7:[155,114],8:[182,75],11:[191,71]});
const assistLeg:Point[] = [
  [226,55],[213,72],[212,109],[194,99],[184,80],[195,108],[166,107],
  [223,133],[229,153],[204,131],[199,152],[239,158],[191,158],
];
const assistLegLow = set(assistLeg,{3:[205,106],4:[190,120],5:[197,117],6:[161,132]});
const assistedLeg:Illustration = {
  ...move([assistedLegUp,assistedLegUp,supine,swap(supine),swap(assistedLegUp),swap(assistedLegUp),swap(supine),supine],
    [],[],1050),
  partnerFrames:[assistLeg,assistLeg,assistLegLow,assistLegLow,assistLeg,assistLeg,assistLegLow,assistLegLow],
};
const sideBall:Point[] = [
  [204,104],[185,111],[147,116],[188,89],[213,75],[194,132],[208,153],
  [121,141],[87,152],[112,140],[76,150],[78,158],[67,156],[143,141],
];
const sideBallStretch = set(sideBall,{
  0:[202,115],1:[183,116],2:[144,116],3:[205,95],4:[234,91],5:[192,139],6:[203,154],13:[139,141],
});
const partnerBall:Point[] = [
  [254,42],[245,59],[239,108],[226,84],[216,77],[234,87],[220,78],
  [249,131],[255,153],[230,131],[225,152],[266,158],[216,157],
];
const partnerBallStretch=set(partnerBall,{3:[231,79],4:[234,91],5:[228,81],6:[229,92]});
const assistedBallSide:Illustration = {
  ...move([sideBallStretch,sideBallStretch,sideBall,flip(sideBall),flip(sideBallStretch),flip(sideBallStretch),flip(sideBall),sideBall],
    ball,[],1090),
  partnerFrames:[partnerBallStretch,partnerBallStretch,partnerBall,flip(partnerBall),
    flip(partnerBallStretch),flip(partnerBallStretch),flip(partnerBall),partnerBall],
};

const stick:Attachments = [["bar",4,6]];
const stickOver = set(tall,{3:[185,39],4:[207,17],5:[135,38],6:[113,17]});
const passFront = set(side,{3:[171,87],4:[188,116],5:[153,88],6:[157,115]});
const passFrontRise = set(side,{3:[187,60],4:[216,58],5:[166,60],6:[190,56]});
const passOver = set(side,{3:[161,35],4:[169,10],5:[144,34],6:[137,11]});
const passBackReach = set(side,{3:[131,66],4:[111,74],5:[124,63],6:[90,72]});
const passBack = set(side,{3:[138,84],4:[126,113],5:[126,83],6:[93,108]});
const pvcPass = move([
  passFront,passFrontRise,passOver,passBackReach,passBack,passBackReach,passOver,passFrontRise,
],stick,[],820);
const stickAround = move([
  passBack,passBackReach,passOver,passFrontRise,passFront,passFrontRise,passOver,passBackReach,
],stick,[],860);
const stickLean = set(stickOver,{
  0:[133,43],1:[140,61],3:[166,39],4:[194,22],5:[118,46],6:[94,28],
});
const stickSide = sided([stickOver,stickLean],stick);
const stickHinge = set(stickLean,{0:[161,115],1:[158,103],2:[158,93],
  3:[187,114],4:[210,128],5:[130,115],6:[106,129]});
const stickSideFront = sided([stickOver,stickLean,stickLean,stickHinge],stick);
const stickWide = set(stickOver,{7:[177,130],8:[201,152],9:[143,130],10:[118,152],11:[214,158],12:[105,158]});
const sumoLow = set(stickWide,{0:[160,69],1:[160,87],2:[160,133],
  3:[182,69],4:[209,45],5:[138,69],6:[111,45],
  7:[192,131],8:[201,152],9:[127,132],10:[118,152]});
const stickSumo = hold([stickWide,sumoLow],stick);
const rackReady = set(tall,{3:[176,78],4:[181,61],5:[144,78],6:[138,61]});
const rackHigh = set(rackReady,{3:[189,62],4:[181,59],5:[131,62],6:[138,59]});
const pvcRack = hold([rackReady,rackHigh],stick);

const anchor:Props = [[232,37,232,157],[216,157,250,157]];
const rackBandReady:Point[] = [...set(side,{3:[171,79],4:[156,63],5:[158,81],6:[148,65]}),[230,77]];
const rackBandHigh = set(rackBandReady,{2:[141,109],3:[178,65],4:[157,60],
  5:[168,67],6:[148,60],7:[148,131],8:[145,153],9:[136,131],10:[135,152],11:[158,157],12:[148,157]});
const bandRack = hold([rackBandReady,rackBandHigh],[["band",4,13],["band",6,13]],anchor);
const bandBehindStart = set(side,{3:[140,86],4:[132,111],5:[134,87],6:[108,110]});
const bandBehindOpen = set(bandBehindStart,{0:[154,40],3:[124,88],4:[105,107],5:[113,86],6:[74,101]});
const bandShoulder = hold([bandBehindStart,bandBehindOpen],[["band",4,6]]);
const bandTriReady = set(side,{3:[149,27],4:[136,69],5:[125,90],6:[133,116]});
const bandTriLow = set(bandTriReady,{3:[148,26],4:[133,75],5:[120,104],6:[132,132]});
const bandTriceps = sided([bandTriReady,bandTriLow],[["band",4,6]],[],swap);

const strapsFix:Props = [[235,25,270,25],[252,25,252,34]];
const splitStraps:Point[] = [...set(tall,{3:[176,73],4:[200,74],5:[152,75],6:[189,82],
  7:[182,129],8:[208,153],9:[138,130],10:[107,153],11:[218,158],12:[97,158]}),[251,34]];
const sideStrapsHigh = set(splitStraps,{0:[171,56],1:[167,72],2:[158,123],
  3:[189,75],5:[178,81],7:[199,131],9:[132,130]});
const sideStrapsLow = set(splitStraps,{0:[145,56],1:[151,72],2:[147,123],
  3:[180,75],5:[169,81],7:[181,130],9:[119,131]});
const straps:Attachments = [["line",4,13],["line",6,13]];
const strapsSide = move([sideStrapsHigh,sideStrapsHigh,splitStraps,sideStrapsLow,sideStrapsLow,splitStraps],straps,strapsFix,1060);
const angledStraps:Point[] = [...set(side,{3:[174,75],4:[199,72],5:[166,76],6:[190,77]}),[251,34]];
const strapsLean = set(angledStraps,{0:[138,48],1:[137,68],2:[127,111],3:[166,72],5:[157,73]});
const strapsLat = set(strapsLean,{0:[148,104],1:[132,102],2:[97,119],
  3:[161,88],4:[192,74],5:[158,90],6:[184,79],7:[122,132],9:[114,132]});
const latWithStraps = hold([angledStraps,strapsLean,strapsLat],straps,strapsFix);

const cableTower:Props = [[255,33,255,154],[270,34,270,154],[247,159,278,159],[255,33,270,33],
  [255,72,270,72],[256,124,266,124],[256,132,266,132],[256,140,266,140],[256,148,266,148]];
const onCableReady=set(angledStraps,{13:[254,70]});
const onCableLong=set(strapsLat,{13:[254,70],4:[193,75],6:[185,78]});
const latWithCable=hold([onCableReady,onCableLong],[["cable",4,13],["cable",6,13]],cableTower);

const parallelBars:Props = [[151,108,263,108],[164,109,164,159],[256,110,256,159],
  [139,96,251,96],[149,97,149,159],[248,97,248,159]];
const barStand = set(side,{0:[156,40],1:[154,59],2:[151,109],3:[171,83],4:[179,105],
  5:[164,80],6:[166,96]});
const barsReach = set(barStand,{0:[161,102],1:[145,98],2:[104,112],3:[159,100],4:[179,105],
  5:[155,96],6:[166,96],7:[114,133],8:[120,153],11:[134,158],
  9:[102,132],10:[108,152],12:[122,157]});
const parallelStretch = hold([barStand,barsReach],[],parallelBars);

const behindWall:Props = [[101,30,219,30],[101,30,101,157],[219,30,219,157],
  [101,157,219,157],[101,68,219,68],[101,118,219,118]];
const startingArms = set(tall,{3:[177,85],4:[184,110],5:[143,85],6:[136,110]});
const midArc = set(tall,{3:[188,64],4:[220,65],5:[132,64],6:[99,65]});
const topArc = set(tall,{3:[178,43],4:[188,16],5:[142,44],6:[131,16]});
const wallSweep = move([midArc,topArc,midArc,startingArms],[],behindWall,920);

const wallHands = set(side,{0:[195,73],1:[179,88],2:[120,114],3:[206,84],4:[237,85],
  5:[205,91],6:[237,93],7:[111,136],8:[100,153],11:[115,158],9:[101,136],10:[90,153],12:[103,158]});
const wallBird = set(wallHands,{
  3:[211,65],4:[232,57],9:[87,126],10:[50,129],12:[39,129],
});
const wallBirdDog = move([wallBird,wallBird,wallHands,swap(wallBird),swap(wallBird),wallHands],[],wall,1030);
const wallClose = set(wallHands,{0:[218,76],1:[194,86],2:[126,114],3:[208,106],4:[237,86],
  5:[201,103],6:[237,92]});
const wallPulse = move([wallHands,wallClose,wallHands,wallClose],[],wall,600);

const wallSlide:Point[] = [...set(side,{0:[191,44],1:[183,63],2:[175,108],3:[236,81],4:[235,55],
  5:[178,85],6:[178,109],7:[185,131],8:[183,153],11:[195,158],9:[173,131],10:[170,153],12:[181,158]}),[235,69]];
const wallSlideUp=set(wallSlide,{3:[236,53],4:[235,30],13:[235,42]});
const serratusSlide=move([wallSlide,wallSlideUp,wallSlideUp,wallSlide,swap(wallSlide),swap(wallSlideUp),
  swap(wallSlideUp),swap(wallSlide)],[["pad",13,0]],wall,950);
const wallPalmReady:Point[] = [...set(side,{3:[201,67],4:[237,72],5:[145,85],6:[140,108]}),[237,86],[140,111]];
const wallPalmTurn = set(wallPalmReady,{0:[143,42],1:[149,60],3:[198,65],7:[143,131],
  8:[138,153],11:[128,158],9:[152,131],10:[152,153],12:[141,158]});
const swapWallHands=(frame:Point[])=>set(swap(frame),{13:frame[14],14:frame[13]});
const wallFlexors=move([wallPalmTurn,wallPalmTurn,wallPalmReady,swapWallHands(wallPalmReady),swapWallHands(wallPalmTurn),
  swapWallHands(wallPalmTurn),swapWallHands(wallPalmReady),wallPalmReady],[["palm-down",4,13],["palm-down",6,14]],wall,1050);

const lowRoll:Point[] = [
  [199,104],[181,120],[137,135],[186,152],[213,155],[175,151],[198,153],
  [101,139],[68,151],[95,141],[62,152],[79,158],[71,157],[133,149],
];
const lowRollNear=set(lowRoll,{0:[207,104],1:[189,121],2:[146,135],
  3:[194,153],4:[221,155],5:[183,151],6:[206,154],7:[109,138],8:[77,151],9:[101,140],10:[69,152],11:[86,158],12:[78,157]});
const lowRollFar=set(lowRoll,{0:[190,105],1:[174,121],2:[129,134],3:[178,152],4:[205,155],
  5:[170,152],6:[192,154],7:[94,137],8:[62,151],9:[86,139],10:[54,152],11:[69,158],12:[61,157]});
const rollHip = move([lowRoll,lowRollNear,lowRoll,lowRollFar,lowRoll,swap(lowRollNear),swap(lowRoll),
  swap(lowRollFar)],[["foam-roller",13,0]],[],890);

const danglingHalf = set(side,{0:[198,110],1:[183,99],2:[133,95],
  3:[185,123],4:[184,150],5:[174,123],6:[174,149],7:[144,129],9:[134,128]});
const danglingFull = set(danglingHalf,{0:[174,143],1:[166,129],2:[133,94],
  3:[171,144],4:[180,156],5:[159,143],6:[165,155]});
const hangingBack = hold([side,danglingHalf,danglingFull]);

const roundBackReady:Point[]= [...side,[149,68],[149,89]];
const roundReach = set(roundBackReady,{
  0:[173,61],1:[159,68],2:[149,108],3:[183,78],4:[212,77],5:[178,78],6:[210,76],
  13:[150,73],14:[144,88],
});
const roundedThoracic = {...hold([roundBackReady,roundReach]),spine:[13,14]};
const wideReach = set(tall,{
  3:[183,38],4:[191,13],5:[137,38],6:[129,13],7:[179,130],8:[192,153],11:[201,158],
  9:[141,130],10:[128,153],12:[119,158],
});
const leanReach = set(wideReach,{0:[128,44],1:[137,61],3:[136,39],4:[121,17],
  5:[117,47],6:[106,26],7:[181,131],9:[142,132]});
const dynamicBack = move([wideReach,leanReach,leanReach,wideReach,flip(leanReach),flip(leanReach)],[],[],920);
const singleReach = set(wideReach,{3:[182,36],4:[187,13],5:[147,86],6:[146,110]});
const turnReach = set(singleReach,{0:[128,44],1:[138,62],3:[144,38],4:[124,19],
  5:[129,84],6:[116,102],9:[140,132]});
const rotationReach = sided([tall,singleReach,turnReach]);

const seat:Props = [[106,125,172,125],[117,126,117,157],[162,126,162,157],[107,124,107,82]];
const uprightSeat:Point[] = [
  [144,59],[143,77],[139,119],[158,98],[177,113],[134,96],[156,112],
  [185,122],[193,153],[170,123],[170,152],[200,157],[181,157],
];
const seatedPendulum = set(uprightSeat,{
  0:[193,133],1:[179,120],2:[140,119],3:[194,135],4:[192,153],
  5:[183,134],6:[180,152],
});
const chairFold = hold([uprightSeat,seatedPendulum],[],seat);
const seatedRound = {...hold([
  [...uprightSeat,[143,90],[142,103]],
  [...set(uprightSeat,{0:[176,147],1:[166,122],3:[185,131],4:[205,145],
    5:[176,130],6:[196,143]}),[153,113],[146,114]],
],[],seat),spine:[13,14]};

const floorSeated:Point[] = [
  [145,68],[145,88],[145,146],[164,112],[170,137],[124,112],[119,137],
  [178,142],[123,150],[109,142],[163,151],[115,155],[172,155],
];
const crossLean=set(floorSeated,{
  0:[200,122],1:[181,123],2:[145,150],3:[198,140],4:[223,154],
  5:[191,141],6:[215,154],
});
const crossedFloorReach = hold([floorSeated,crossLean]);
const butterfly = set(floorSeated,{
  3:[170,114],4:[151,147],5:[120,113],6:[148,147],
  7:[186,141],8:[152,150],11:[149,155],9:[106,141],10:[145,150],12:[148,155],
});
const butterflyLean = set(butterfly,{0:[162,124],1:[153,127],3:[163,139],5:[132,138]});
const feetTogetherFold = hold([butterfly,butterflyLean]);
const floorWide = set(floorSeated,{
  3:[166,106],4:[177,127],5:[122,106],6:[111,127],
  7:[191,150],8:[226,153],11:[238,153],9:[101,150],10:[65,153],12:[53,153],
});
const spineRollReach:Point[] = [...set(floorWide,{3:[163,99],4:[176,110],5:[126,99],6:[116,110]}),[145,108],[145,127]];
const spineRollMid=set(spineRollReach,{0:[148,110],1:[147,121],3:[159,130],4:[176,141],
  5:[130,129],6:[116,141],13:[145,128],14:[144,138]});
const spineRollEnd=set(spineRollMid,{0:[148,142],1:[146,136],3:[160,145],4:[179,153],5:[131,146],6:[111,153]});
const wideSpineRoll = {...move([spineRollReach,spineRollMid,spineRollEnd,spineRollMid],[],[],870),spine:[13,14]};

const kneelingBack:Point[] = [
  [200,83],[180,91],[123,102],[189,124],[187,154],[173,125],[170,153],
  [127,153],[89,153],[117,151],[79,152],[78,158],[68,157],
];
const threadClosed=set(kneelingBack,{0:[190,114],1:[172,103],3:[168,127],4:[186,111]});
const threadNeutral=set(kneelingBack,{3:[159,86],4:[188,84]});
const threadOpen=set(kneelingBack,{0:[184,52],1:[174,82],3:[157,54],4:[181,61]});
const quadrupedThoracic = move([threadOpen,threadNeutral,threadClosed,threadNeutral,swap(threadOpen),
  swap(threadNeutral),swap(threadClosed),swap(threadNeutral)],[],[],950);
const quadrupedThoracicHold = move([threadOpen,threadOpen,threadOpen,threadNeutral,kneelingBack,
  swap(threadNeutral),swap(threadOpen),swap(threadOpen),swap(threadOpen),swap(threadNeutral)],[],[],1050);
const lyingTurn:Point[] = [
  [112,76],[131,87],[183,98],[129,111],[126,145],[126,111],[122,142],
  [209,121],[192,149],[202,120],[182,149],[181,152],[171,151],
];
const reachUp=set(lyingTurn,{0:[107,70],1:[129,83],3:[128,66],4:[128,52]});
const reachOver=set(lyingTurn,{0:[111,88],1:[132,97],3:[125,67],4:[118,34]});
const openBook = {...move([reachOver,reachOver,reachUp,lyingTurn,flip(lyingTurn),flip(reachUp),flip(reachOver),flip(reachOver),
  flip(reachUp),flip(lyingTurn),lyingTurn],[],[[65,37,255,37],[255,37,255,161],[255,161,65,161],[65,161,65,37]],1070),
  topView:true};
const splitKneel = set(kneeSide,{0:[154,66],1:[151,86],2:[137,123],3:[160,107],4:[167,125],5:[149,107],6:[157,123],
  7:[170,128],8:[194,149],11:[206,158]});
const splitBack = set(splitKneel,{0:[159,92],1:[142,105],2:[116,130],3:[152,124],4:[160,140],
  5:[148,123],6:[157,138],7:[156,141],8:[195,154],11:[201,142]});
const halfSplit = sided([kneeSide,splitKneel,splitBack],[],[],swap);
const squatWide = set(tall,{7:[189,130],8:[201,153],11:[214,157],9:[131,130],10:[119,153],12:[106,157]});
const squatMobLow = set(squatWide,{0:[160,72],1:[160,90],2:[160,135],
  3:[188,124],4:[160,105],5:[131,124],6:[160,106],7:[193,129],9:[127,129]});
const squatRock = set(squatMobLow,{0:[147,71],1:[148,90],2:[147,135],3:[177,123],4:[149,104],
  5:[125,122],6:[147,106],7:[183,129],9:[123,129]});
const squatMobilization = move([squatMobLow,squatRock,squatMobLow,flip(squatRock),squatMobLow,squatWide],[],[],940);

export const mobilityDeviceIllustrations:Readonly<Record<string,Illustration>> = {
  "3150": chinTuck,
  "1715": assistedBallSide,
  "2123": tandemSide,
  "1952": assistedLeg,
  "2122": assistedSide,
  "1337": overBall,
  "1340": proneBall,
  "4314": kneelingSpineBall,
  "1601": standingBallHamstring,
  "0255": wallBallCircles,
  "2991": ballScapulae,
  "4599": rollHip,
  "2120": stickSide,
  "4603": pvcRack,
  "4607": pvcPass,
  "5407": stickSumo,
  "5404": stickAround,
  "5406": stickSideFront,
  "5147": bandRack,
  "3513": bandShoulder,
  "10741": bandTriceps,
  "1158": strapsSide,
  "7278": latWithStraps,
  "1800": latWithCable,
  "1989": parallelStretch,
  "4612": wallSweep,
  "7216": wallBirdDog,
  "10928": serratusSlide,
  "2092": wallFlexors,
  "5174": wallPulse,
  "6764": hangingBack,
  "4875": roundedThoracic,
  "4288": roundedThoracic,
  "4671": dynamicBack,
  "1796": rotationReach,
  "1805": chairFold,
  "1807": crossedFloorReach,
  "1803": seatedRound,
  "1809": feetTogetherFold,
  "11089": wideSpineRoll,
  "3526": quadrupedThoracic,
  "3540": quadrupedThoracicHold,
  "3539": openBook,
  "10907": halfSplit,
  "10551": squatMobilization,
};
