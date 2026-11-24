import type { Illustration, Point } from "./motion-data";
import { legacyMobilityCorrections } from "./legacy-mobility-corrections";
import { mobilityDeviceIllustrations } from "./mobility-device-illustrations";

type Props=NonNullable<Illustration["props"]>;
type Attachments=NonNullable<Illustration["dynamic"]>;
const feet:Attachments=[["foot-tip",8,11],["foot-tip",10,12]];
const mirror=(frame:Point[])=>frame.map(([x,y]):Point=>[320-x,y]);
const set=(frame:Point[], changes:Partial<Record<number,Point>>)=>frame.map((point,index)=>changes[index]??point);
const move=(frames:Point[][],ms=970,props:Props=[],extra:Attachments=[]):Illustration=>
  ({frames,ms,props,dynamic:[...feet,...extra],reference:true});
const hold=(frames:Point[][],props?:Props,extra?:Attachments)=>{
  const end=frames.at(-1)!;
  const staged=frames.slice(0,-1);
  return move([end,end,end,...staged.slice().reverse(),...staged.slice(1)],1050,props,extra);
};
const twoSides=(frames:Point[][],props?:Props,extra?:Attachments)=>{
  const end=frames.at(-1)!;
  const path=[end,end,...frames.slice(0,-1).reverse()];
  return move([...path,...path.slice().reverse().slice(1,-1).map(mirror),...path.map(mirror),
    ...path.slice().reverse().slice(1,-1)],1080,props,extra);
};
const flat:Point[]=[
  [216,146],[197,149],[150,151],[183,143],[200,154],[174,145],[187,154],
  [111,152],[73,152],[101,152],[63,152],[60,157],[52,156],
];
const cobraMid=set(flat,{0:[220,115],1:[201,126],3:[206,137],5:[190,137]});
const cobraTop=set(flat,{0:[208,84],1:[198,103],3:[198,126],5:[190,127]});
const floorAbdominal=hold([flat,cobraMid,cobraTop]);
const proneForearms=set(flat,{0:[214,110],1:[199,122],3:[187,150],4:[216,154],5:[174,151],6:[203,152]});
const bellySide=set(proneForearms,{0:[199,99],1:[190,121],3:[181,147],4:[215,154]});
const bellyFar=set(proneForearms,{0:[232,115],1:[200,124],5:[184,147],6:[206,152]});
const stomachRotation=move([bellySide,bellySide,proneForearms,bellyFar,bellyFar,proneForearms],1020);

const upright:Point[]=[
  [160,40],[160,60],[160,108],[176,85],[179,108],[144,85],[141,108],
  [168,131],[172,153],[152,131],[148,153],[183,158],[137,158],
];
const profile:Point[]=[
  [148,39],[147,59],[145,107],[153,84],[155,111],[141,83],[141,109],
  [150,132],[151,152],[141,132],[140,153],[165,158],[154,157],
];
const handsHip=set(profile,{3:[135,84],4:[151,104],5:[126,83],6:[142,104]});
const hipLean=set(handsHip,{0:[132,41],1:[135,61],2:[156,108],3:[127,88],4:[155,108],
  5:[120,86],6:[146,107]});
const supportedLean=set(handsHip,{4:[141,109],6:[134,110]});
const archLean=set(hipLean,{0:[120,48],1:[128,62],2:[162,110],4:[153,109],6:[145,109]});
const uprightBackBend=hold([supportedLean,hipLean,archLean]);
const stomachStanding=hold([handsHip,hipLean]);
const knees:Point[]=set(supportedLean,{0:[150,64],1:[149,83],2:[144,125],7:[149,153],8:[113,153],
  9:[139,153],10:[102,152],11:[100,158],12:[91,157],3:[144,103],4:[143,124],5:[134,103],6:[137,123]});
const kneelingArch=set(knees,{0:[137,66],1:[136,88],2:[155,126],3:[132,110],4:[150,124],5:[126,110],6:[141,124]});
const abdominalKneeling=hold([knees,kneelingArch]);

const crossing:Point[]=set(upright,{7:[178,130],8:[149,152],11:[162,158],9:[142,132],10:[141,152],12:[131,158]});
const singleUp=set(upright,{3:[171,40],4:[177,12],5:[141,86],6:[150,107]});
const stretchFront=set(singleUp,{0:[137,46],1:[143,65],3:[146,41],4:[127,19],5:[127,91],6:[149,105]});
const lateralStanding=twoSides([upright,singleUp,stretchFront]);
const slightWider=set(singleUp,{7:[179,132],8:[185,153],11:[195,158],9:[141,132],10:[136,153],12:[126,158]});
const hipsSide=set(slightWider,{0:[140,46],1:[146,65],2:[153,113],3:[151,40],4:[131,19],5:[129,93],6:[146,107],
  7:[175,133],9:[139,132]});
const lowerLateralStanding=twoSides([slightWider,hipsSide]);
const crossArm=set(crossing,{3:[171,41],4:[174,15]});
const crossSide=set(crossArm,{0:[145,48],1:[149,65],3:[147,42],4:[133,16],5:[128,89],6:[137,111]});
const crossLateral=twoSides([upright,crossing,crossArm,crossSide]);
const itbWall:Props=[[222,32,222,158],[222,43,231,38],[222,68,231,63],[222,95,231,90],[222,120,231,115],[222,145,231,140],
  [98,32,98,158],[98,43,89,38],[98,68,89,63],[98,95,89,90],[98,120,89,115],[98,145,89,140]];
const beside=set(crossing,{0:[159,40],1:[161,60],2:[161,110],3:[185,79],4:[221,80],5:[153,40],6:[153,15],
  7:[182,132],8:[158,153],11:[171,158],9:[165,132],10:[188,153],12:[196,158]});
const lateralItb=set(beside,{0:[173,46],1:[168,63],2:[181,109],3:[199,77],4:[221,81],5:[172,38],6:[189,15],
  7:[190,132],9:[176,131]});
const itBand=twoSides([upright,beside,lateralItb],itbWall);

const kneeStart=set(upright,{0:[163,60],1:[160,78],2:[161,112],3:[170,109],4:[170,133],
  5:[152,110],6:[153,132],7:[168,134],8:[163,153],9:[154,133],10:[154,153],11:[168,158],12:[149,158]});
const kneePhases:Point[]=[[9,0],[0,5],[-7,0],[0,-4],[9,0],[0,-4],[-7,0],[0,5]];
const kneeCircles=move(kneePhases.map(([x,y])=>set(kneeStart,{
  2:[161+x*.25,112+y*.2],4:[170+x,133+y],6:[153+x,132+y],
  7:[168+x,134+y],9:[154+x,133+y],
})),620);

const yawReady:Point[]=[...upright,[169,62],[151,62]];
const turnBody=set(yawReady,{0:[173,39],1:[161,62],3:[191,68],4:[216,73],
  5:[179,72],6:[206,74],13:[174,62],14:[163,65]});
const turnArms=set(yawReady,{3:[176,69],4:[195,78],5:[153,68],6:[175,75]});
const bigBackTurn={...twoSides([turnArms,turnBody]),shoulders:[13,14] as [number,number]};
const crossChest=set(yawReady,{3:[185,70],4:[162,72],5:[138,70],6:[164,72]});
const yawChest=set(turnBody,{3:[191,69],4:[182,77],5:[169,75],6:[183,77]});
const backTurn={...twoSides([crossChest,yawChest]),shoulders:[13,14] as [number,number]};
const yawHip=set(yawReady,{3:[186,83],4:[170,103],5:[137,84],6:[150,106]});
const abYaw=set(yawHip,{0:[171,38],3:[195,79],4:[166,105],5:[153,80],6:[159,107],13:[175,59],14:[157,65]});
const abTurn={...twoSides([yawHip,abYaw]),shoulders:[13,14] as [number,number]};

const chair:Props=[[111,125,174,125],[124,126,124,158],[165,126,165,158],[111,125,111,84]];
const chairStart:Point[]=[
  [147,59],[147,77],[145,118],[163,99],[181,117],[137,99],[155,114],
  [185,122],[195,153],[167,122],[176,153],[208,157],[188,156],
];
const chairLean=set(chairStart,{
  0:[174,110],1:[166,103],3:[181,116],4:[197,151],5:[171,114],6:[188,143],
});
const chairOther=set(chairLean,{
  0:[166,113],1:[160,107],3:[177,116],4:[185,144],5:[169,119],6:[177,152],
});
const seatDiagonal=move([chairLean,chairLean,chairStart,chairOther,chairOther,chairStart],1040,chair);
const floorSeated:Point[]=[
  [160,68],[160,87],[160,145],[178,108],[183,136],[141,107],[134,136],
  [193,137],[145,150],[127,137],[175,150],[138,155],[182,155],
];
const sitReach=set(floorSeated,{3:[173,64],4:[173,38],5:[132,125],6:[112,154]});
const sitSide=set(sitReach,{0:[137,77],1:[145,93],3:[146,67],4:[123,45],5:[126,128],6:[107,154]});
const floorLateral=twoSides([floorSeated,sitReach,sitSide]);
const unsupportedFloorReach=set(sitSide,{5:[132,123],6:[144,137]});
const floorWaist=twoSides([floorSeated,set(sitReach,{5:[143,110],6:[149,136]}),unsupportedFloorReach]);

const tallPike:Point[]=[
  [117,76],[119,95],[124,147],[141,104],[173,111],[133,102],[163,106],
  [169,151],[214,153],[162,149],[203,151],[217,141],[207,139],[120,112],[122,132],
];
const pikeReach=set(tallPike,{0:[147,104],1:[142,117],3:[168,117],4:[200,121],
  5:[163,116],6:[193,119],13:[130,121],14:[127,136]});
const pikeRound=set(tallPike,{0:[170,134],1:[159,128],3:[190,128],4:[222,137],5:[183,127],6:[214,135],
  13:[137,123],14:[127,136]});
const articulatePike={...move([tallPike,pikeReach,pikeRound,pikeRound,pikeReach],1020),spine:[13,14]};

const overheadMat:Props=[[103,15,217,15],[217,15,217,167],[217,167,103,167],[103,167,103,15]];
const fullBody:Point[]=[
  [160,52],[160,68],[160,113],[170,44],[171,23],[150,44],[149,23],
  [167,134],[168,153],[153,134],[151,152],[168,161],[150,160],[160,82],[160,98],
];
const reachingLong=set(fullBody,{3:[172,40],4:[173,17],5:[148,40],6:[147,17],
  7:[167,135],8:[168,156],11:[168,166],9:[153,135],10:[152,156],12:[151,165]});
const fullBodyStretch={...hold([fullBody,reachingLong],overheadMat),topView:true};
const bananaMid=set(fullBody,{0:[170,53],1:[167,68],3:[188,43],4:[192,22],5:[164,42],6:[170,19],
  7:[173,134],8:[188,154],11:[192,161],9:[157,134],10:[171,155],12:[175,162],
  13:[163,83],14:[162,98]});
const bananaEnd=set(bananaMid,{0:[184,56],1:[177,69],3:[195,44],4:[200,23],5:[176,42],6:[185,22],
  7:[189,133],8:[203,148],11:[209,154],9:[168,135],10:[184,150],12:[189,156],
  13:[167,84],14:[163,98]});
const bananaStretch={...twoSides([fullBody,bananaMid,bananaEnd],overheadMat),topView:true,spine:[13,14]};

const supineBent:Point[]=[
  [82,145],[101,150],[151,151],[123,151],[145,153],[117,147],[137,149],
  [184,123],[213,153],[176,123],[202,151],[225,157],[215,156],
];
const kneeCup=set(supineBent,{3:[128,133],4:[154,118],5:[119,131],6:[148,118],
  7:[153,115],8:[182,132],11:[191,137],9:[146,113],10:[173,130],12:[182,134]});
const kneeChest=set(kneeCup,{3:[125,129],4:[142,109],5:[114,130],6:[134,108],
  7:[137,108],8:[167,124],11:[176,129],9:[130,107],10:[160,123],12:[168,127]});
const kneesToChest=hold([supineBent,kneeCup,kneeChest]);

const quadruped:Point[]=[
  [207,82],[188,95],[129,102],[196,124],[196,153],[180,123],[180,153],
  [138,151],[105,153],[125,151],[92,152],[94,157],[81,156],
];
const crossArmLow=set(quadruped,{0:[182,131],1:[171,129],2:[130,105],
  3:[160,142],4:[134,155],5:[178,139],6:[189,154]});
const crossArmMid=set(quadruped,{0:[198,109],1:[181,111],3:[167,135],4:[148,151]});
const swap=(frame:Point[])=>set(frame,{
  3:frame[5],4:frame[6],5:frame[3],6:frame[4],7:frame[9],8:frame[10],11:frame[12],
  9:frame[7],10:frame[8],12:frame[11],
});
const kneelingCross=move([crossArmLow,crossArmLow,crossArmMid,quadruped,swap(crossArmMid),swap(crossArmLow),
  swap(crossArmLow),swap(crossArmMid),quadruped,crossArmMid],1020);

const sleeperReady:Point[]=[
  [87,143],[108,145],[156,146],[133,124],[123,120],[121,152],[120,108],
  [185,128],[201,148],[192,135],[213,151],[212,152],[223,156],
];
const sleeperPress=set(sleeperReady,{
  3:[143,125],4:[142,137],5:[121,152],6:[152,143],
});
const sleeperContact=set(sleeperReady,{
  3:[134,123],4:[121,118],
});
const sleeper=move([sleeperPress,sleeperPress,sleeperContact,sleeperReady,sleeperContact,
  mirror(sleeperContact),mirror(sleeperPress),mirror(sleeperPress),mirror(sleeperContact),mirror(sleeperReady)],
  1110);

export const trunkMobilityIllustrations:Readonly<Record<string,Illustration>>={
  "3244":floorAbdominal,
  "1404":mobilityDeviceIllustrations["4288"],
  "4006":floorAbdominal,
  "6540":bigBackTurn,
  "4278":kneeCircles,
  "2109":abdominalKneeling,
  "1812":mobilityDeviceIllustrations["3540"],
  "1988":kneelingCross,
  "2125":bananaStretch,
  "2105":floorAbdominal,
  "1168":floorAbdominal,
  "2116":legacyMobilityCorrections["3639"],
  "1798":fullBodyStretch,
  "1808":kneesToChest,
  "2111":stomachRotation,
  "1804":seatDiagonal,
  "2114":floorWaist,
  "2118":floorLateral,
  "1806":floorLateral,
  "4312":lateralStanding,
  "3517":uprightBackBend,
  "2873":articulatePike,
  "2110":abTurn,
  "1813":backTurn,
  "9942":crossLateral,
  "1942":itBand,
  "2117":lateralStanding,
  "2108":stomachStanding,
  "2113":lowerLateralStanding,
  "2119":lateralStanding,
  "11374":sleeper,
};
