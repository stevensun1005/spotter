import type { Illustration, Point } from "./motion-data";

type Props=NonNullable<Illustration["props"]>;
type Attachments=NonNullable<Illustration["dynamic"]>;
const feet:Attachments=[["foot-tip",8,11],["foot-tip",10,12]];
const set=(frame:Point[], changes:Partial<Record<number,Point>>)=>frame.map((point,index)=>changes[index]??point);
const mirror=(frame:Point[])=>frame.map(([x,y]):Point=>[320-x,y]);
const swapLegs=(frame:Point[])=>set(frame,{
  7:frame[9],8:frame[10],11:frame[12],9:frame[7],10:frame[8],12:frame[11],
});
const motion=(frames:Point[][],ms=850,props:Props=[],extra:Attachments=[]):Illustration=>
  ({frames,ms,props,dynamic:[...feet,...extra],reference:true});
const alternate=(frames:Point[][],ms?:number,props?:Props,extra?:Attachments,other=mirror)=>
  motion([...frames,...frames.map(other)],ms,props,extra);
const tall:Point[]=[
  [157,41],[157,59],[157,108],[174,83],[177,108],[141,83],[138,109],
  [165,132],[169,153],[149,132],[146,153],[180,158],[133,158],
];
const hips=set(tall,{3:[183,83],4:[168,104],5:[132,83],6:[144,104]});
const stepReady=set(hips,{2:[150,108],7:[152,131],8:[150,153],11:[161,158],
  9:[157,128],10:[169,146],12:[177,152]});
const tipForward=set(stepReady,{9:[182,130],10:[213,150],12:[225,157]});
const tipSide=set(stepReady,{9:[171,134],10:[184,153],12:[192,158]});
const tipBack=set(stepReady,{9:[134,130],10:[119,152],12:[129,158]});
const tap3=alternate([stepReady,tipForward,stepReady,tipSide,stepReady,tipBack,stepReady],670);
const turned=set(stepReady,{3:[179,77],4:[197,72],5:[136,77],6:[113,75]});
const starFrames=[stepReady,tipForward,stepReady,tipSide,stepReady,tipBack,stepReady].map(frame=>
  set(frame,{3:turned[3],4:turned[4],5:turned[5],6:turned[6]}));
const star=alternate(starFrames,710);
const loopTap=alternate([stepReady,tipForward,tipSide,tipBack,stepReady],680);

const platform:Attachments=[["bar",13,14]];
const board:Props=[[152,150,152,154],[152,154,157,158],[157,158,163,158],[163,158,168,154],[168,154,168,150]];
const platformStand:Point[]=[...set(tall,{7:[174,125],8:[176,142],11:[189,146],
  9:[141,125],10:[141,141],12:[130,145],3:[187,71],4:[208,77],5:[127,71],6:[103,77]}),[125,148],[195,148]];
const tiltPlatform=set(platformStand,{0:[166,42],1:[164,60],2:[161,108],
  8:[177,148],11:[190,152],10:[142,135],12:[131,138],13:[125,141],14:[195,156]});
const rocker=motion([platformStand,tiltPlatform,platformStand,mirror(tiltPlatform)],790,board,platform);
const balancePad:Props=[[129,148,191,148],[129,148,129,158],[191,148,191,158],[129,157,191,157]];
const padReady=set(platformStand,{8:[155,143],11:[165,147],7:[156,126],9:[171,123],10:[177,143],12:[188,147]});
const padLift=set(padReady,{2:[151,108],9:[174,126],10:[182,132],12:[191,138]});
const padHold=set(padLift,{0:[155,41],1:[156,59],3:[188,70],4:[209,77],9:[173,125],10:[181,131]});
const balanceOnPad=alternate([padLift,padHold,padLift,padReady],1020,balancePad);
const boardWithWall:Props=[...board,[233,27,233,158],[233,44,243,39],[233,73,243,68],[233,101,243,96],[233,131,243,126]];
const toeDown=set(padReady,{9:[181,131],10:[208,152],12:[221,157]});
const boardOne=set(padLift,{3:[192,67],4:[215,68],5:[131,83],6:[115,94]});
const boardHold=set(boardOne,{0:[157,40],1:[158,58],3:[192,69],4:[213,68]});
const balanceOnBoard=alternate([boardOne,boardHold,boardOne,toeDown],1090,boardWithWall,platform,
  frame=>set(swapLegs(frame),{7:[171,126],8:[166,143],11:[177,147],9:[145,126],10:[136,129],12:[123,134]}));

const hingeLeg=set(tall,{0:[213,95],1:[197,102],2:[157,110],3:[200,129],4:[201,150],
  5:[192,127],6:[195,148],7:[155,135],8:[157,152],11:[171,157],
  9:[119,112],10:[83,112],12:[71,111]});
const hingeReach=set(hingeLeg,{0:[203,118],1:[188,113],3:[180,134],4:[168,153],
  5:[175,131],6:[163,151],9:[123,104],10:[92,91],12:[81,91]});
const singleLegReach=alternate([hingeReach,hingeReach,hingeLeg,tall,hingeLeg],910,[],[],swapLegs);

const chair:Props=[[114,125,182,125],[123,126,123,158],[171,126,171,158],[114,125,114,83]];
const chairSide:Point[]=[
  [148,59],[148,78],[146,119],[154,98],[167,121],[141,98],[153,120],
  [188,120],[189,149],[173,121],[172,152],[206,150],[187,157],
];
const toeAngles:Point[]=[[12,-10],[18,0],[11,7],[0,3],[12,-10],[0,3],[11,7],[18,0]];
const footPath=toeAngles.map(([x,y])=>set(chairSide,{11:[189+x,149+y]}));
const circles=alternate(footPath,590,chair,[],swapLegs);
const footInternal=set(chairSide,{11:[181,148]});
const footExternal=set(chairSide,{11:[209,151]});
const footSweep=alternate([chairSide,footInternal,chairSide,footExternal,chairSide],710,chair,[],swapLegs);

const towelFrame:Point[]=[...set(tall,{0:[155,40],1:[153,59],2:[151,108],7:[160,131],8:[159,152],
  11:[181,155],9:[145,131],10:[143,152],12:[133,158]}),[178,159],[211,159],[182,159],[191,159],[200,159]];
const towelGrab=set(towelFrame,{11:[175,150],13:[172,158],14:[197,159],15:[175,153],16:[182,156],17:[190,156]});
const towelTight=set(towelGrab,{11:[170,151],13:[168,158],14:[185,159],15:[170,151],16:[176,155],17:[182,154]});
const towelEdges:Attachments=[["line",13,15],["line",15,16],["line",16,17],["line",17,14]];
const toeTowel=alternate([towelFrame,towelGrab,towelTight,towelGrab,towelFrame],920,[],towelEdges);

const kneeGlideSeat:Point[]=[
  [146,65],[145,83],[144,121],[169,105],[186,130],[163,107],[182,128],
  [190,130],[235,153],[176,123],[187,152],[247,147],[201,158],[190,129],
];
const glidePositions:Point[]=[[-3,0],[0,-3],[3,0],[0,3]];
const patellaMoving=glidePositions.map(([x,y])=>set(kneeGlideSeat,{
  4:[186+x,130+y],6:[182+x,128+y],13:[190+x,129+y],
}));
const patellaGlide=alternate([kneeGlideSeat,...patellaMoving,kneeGlideSeat],900,chair,
  [["digit",4,13,2],["digit",6,13,2]],swapLegs);

const prone:Point[]=[
  [220,140],[202,148],[154,151],[225,141],[241,152],[213,143],[232,153],
  [113,152],[75,153],[107,150],[62,151],[63,158],[52,156],
];
const halfQuad=set(prone,{7:[115,150],8:[117,121],11:[128,117],3:[199,136],4:[172,138]});
const heelToGlute=set(halfQuad,{8:[143,119],11:[153,130],3:[180,133],4:[146,123]});
const oppositeQuad=(frame:Point[])=>set(swapLegs(frame),{3:frame[5],4:frame[6],5:frame[3],6:frame[4]});
const quadFolds=alternate([halfQuad,heelToGlute,halfQuad,prone,halfQuad],850,[],[],oppositeQuad);

const sideLying:Point[]=[
  [73,128],[94,147],[145,147],[110,128],[126,142],[78,154],[69,133],
  [181,145],[222,148],[176,149],[216,152],[234,147],[228,153],
];
const bothFeetOff=set(sideLying,{7:[179,132],8:[219,119],9:[175,136],10:[214,123],11:[229,115],12:[225,120]});
const sideFeet=alternate([sideLying,bothFeetOff,bothFeetOff,sideLying],860);

const wideToe=set(tall,{
  3:[192,66],4:[224,64],5:[129,65],6:[98,64],7:[177,131],8:[197,152],
  9:[143,131],10:[122,152],11:[210,157],12:[109,158],
});
const wcHalf=set(wideToe,{0:[175,91],1:[166,82],2:[152,103],3:[184,93],4:[204,103],5:[146,111],6:[124,132]});
const oppositeToe=set(wideToe,{0:[188,119],1:[175,106],2:[157,99],
  3:[152,124],4:[118,153],5:[183,86],6:[195,67]});
const crossToe=motion([wideToe,wcHalf,oppositeToe,oppositeToe,wcHalf,wideToe,mirror(wcHalf),
  mirror(oppositeToe),mirror(oppositeToe),mirror(wcHalf)],920);
const alternatingToe=motion([wideToe,oppositeToe,wideToe,mirror(oppositeToe)],630);
const bothSideMid=set(wideToe,{0:[178,106],1:[166,94],2:[156,102],
  3:[182,114],4:[196,134],5:[169,116],6:[183,137]});
const bothToeSide=set(bothSideMid,{0:[189,128],1:[181,113],
  3:[194,132],4:[201,154],5:[186,132],6:[191,154]});
const lateralTwoToe=motion([wideToe,bothSideMid,bothToeSide,bothSideMid,wideToe,mirror(bothSideMid),
  mirror(bothToeSide),mirror(bothSideMid)],830);
const centerFold=set(wideToe,{0:[158,133],1:[158,112],2:[157,96],3:[164,133],4:[168,154],
  5:[152,133],6:[151,154]});
const centerPrep=set(wideToe,{0:[158,104],1:[157,97],2:[157,101],
  3:[168,120],4:[170,137],5:[147,120],6:[145,137]});
const wideCenterToe=motion([wideToe,centerPrep,centerFold,centerFold,centerPrep],960);
const shoulderToe=set(wideToe,{7:[169,131],8:[173,152],9:[150,131],10:[145,152],11:[185,158],12:[133,158]});
const shoulderFold=set(centerFold,{
  7:[168,133],8:[173,152],9:[150,132],10:[145,152],11:[185,158],12:[133,158],
  3:[167,134],4:[177,154],5:[149,133],6:[139,154],
});
const narrowCenterToe=motion([shoulderToe,set(centerPrep,{7:[170,132],8:[173,152],9:[150,132],10:[145,152],
  11:[185,158],12:[133,158]}),shoulderFold,shoulderFold],970);

const wallSeat:Props=[[111,29,111,160],[102,31,110,37],[102,56,110,62],[102,82,110,88],
  [102,109,110,115],[102,135,110,141]];
const wallStand:Point[]=[
  [125,40],[120,60],[119,107],[138,83],[151,110],[131,82],[144,108],
  [149,129],[183,153],[143,128],[170,152],[195,157],[181,157],
];
const wallBalance=set(wallStand,{0:[127,58],1:[121,77],2:[120,118],3:[142,94],4:[157,115],
  5:[135,94],6:[151,113],7:[183,119],9:[170,117]});
const wallToeFold=set(wallBalance,{0:[175,122],1:[160,112],3:[174,132],4:[192,154],
  5:[167,131],6:[182,153]});
const toeSit=motion([wallToeFold,wallToeFold,wallBalance,wallStand,wallBalance,wallToeFold,wallBalance],
  960,wallSeat);

const stance=set(tall,{
  7:[175,132],8:[179,153],11:[192,157],9:[145,132],10:[141,153],12:[128,157],
});
const squatMid=set(stance,{0:[159,55],1:[159,75],2:[160,120],3:[179,85],4:[183,111],
  5:[142,86],6:[139,111],7:[180,132],9:[140,132]});
const squatBottom=set(squatMid,{0:[160,72],1:[160,89],2:[160,137],
  3:[176,107],4:[174,130],5:[144,107],6:[146,130],7:[184,131],9:[136,131]});
const kneeTrack=motion([stance,squatMid,squatBottom,squatBottom,squatMid],910);

export const balanceMobilityIllustrations:Readonly<Record<string,Illustration>>={
  "11790":tap3,
  "10733":balanceOnBoard,
  "5302":rocker,
  "10734":balanceOnPad,
  "4212":star,
  "1702":singleLegReach,
  "10748":loopTap,
  "10908":circles,
  "10910":footSweep,
  "10919":footSweep,
  "9986":toeTowel,
  "11651":patellaGlide,
  "11801":quadFolds,
  "0712":sideFeet,
  "3250":crossToe,
  "3251":lateralTwoToe,
  "10188":alternatingToe,
  "3249":wideCenterToe,
  "3231":narrowCenterToe,
  "0810":toeSit,
  "3001":kneeTrack,
};
