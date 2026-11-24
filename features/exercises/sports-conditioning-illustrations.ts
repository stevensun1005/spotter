import type { Illustration, Point } from "./motion-data";
import { mobilityDeviceIllustrations } from "./mobility-device-illustrations";
import { trunkMobilityIllustrations } from "./trunk-mobility-illustrations";

type Props=NonNullable<Illustration["props"]>;
type Attachments=NonNullable<Illustration["dynamic"]>;
const feet:Attachments=[["foot-tip",8,11],["foot-tip",10,12]];
const set=(frame:Point[], changes:Partial<Record<number,Point>>)=>frame.map((point,index)=>changes[index]??point);
const mirror=(frame:Point[])=>frame.map(([x,y]):Point=>[320-x,y]);
const motion=(frames:Point[][],ms=760,props:Props=[],extra:Attachments=[]):Illustration=>
  ({frames,ms,props,dynamic:[...feet,...extra],reference:true});
const sided=(frames:Point[][],ms?:number,props?:Props,extra?:Attachments,other=mirror)=>
  motion([...frames,...frames.map(other)],ms,props,extra);
const around=(frames:Point[][])=>[...frames,...frames.slice(1,-1).reverse()];

const athlete:Point[]=[
  [158,43],[154,64],[147,106],[178,84],[190,66],[138,90],[158,106],
  [158,132],[178,153],[137,130],[121,150],[192,158],[132,157],
];
const runStep=set(athlete,{0:[166,47],1:[159,69],2:[148,110],3:[141,92],4:[152,111],
  5:[173,87],6:[190,68],7:[178,116],8:[159,143],11:[173,148],
  9:[120,126],10:[101,147],12:[109,154]});
const runOther=set(runStep,{3:[184,85],4:[197,69],5:[142,90],6:[155,107],
  7:[119,122],8:[106,147],11:[114,157],9:[169,111],10:[147,138],12:[160,143]});
const touch=set(athlete,{0:[186,101],1:[171,108],2:[141,114],3:[186,130],4:[212,151],
  5:[163,126],6:[181,146],7:[164,132],8:[183,153],11:[195,157],
  9:[128,130],10:[113,152],12:[127,157]});
const shuffleWide=set(athlete,{0:[154,61],1:[153,79],2:[154,118],3:[178,96],4:[194,81],
  5:[131,96],6:[115,86],7:[181,132],8:[198,152],11:[211,158],
  9:[128,132],10:[108,151],12:[120,157]});
const shuffleIn=set(shuffleWide,{0:[164,57],1:[164,76],2:[164,114],
  7:[175,130],8:[178,153],11:[191,158],9:[150,128],10:[143,145],12:[153,150]});
const backPedal=set(athlete,{0:[164,54],1:[158,71],2:[150,110],3:[174,88],4:[182,89],
  5:[145,88],6:[152,88],7:[168,129],8:[182,146],11:[191,151],
  9:[131,130],10:[111,151],12:[121,158]});
const actorAt=(frame:Point[],x:number,y:number,facing=1,scale=.51)=>
  frame.map(([px,py]):Point=>[x+(px-150)*scale*facing,y+(py-158)*scale]);
const cones=(markers:Point[]):Props=>markers.flatMap(([x,y]):Props=>[
  [x-7,y,x+7,y],[x-5,y,x,y-13],[x,y-13,x+5,y],[x-3,y-5,x+3,y-5],
]);
const trail=(locations:Point[]):Props=>locations.slice(1).map(([x,y],i):[number,number,number,number]=>
  [...locations[i],x,y]);
const court=(locations:Point[],markers:Point[]):Props=>[...trail(locations),...cones(markers)];
const regularSteps=(path:Point[],poses:Point[][],facing:number[])=>
  path.map(([x,y],index)=>actorAt(poses[index%poses.length],x,y,facing[index]??1));
const start:Point=[88,154], turn:Point=[88,94], end:Point=[211,94];
const lRoute:Point[]=[
  start,[88,137],[88,118],turn,[88,112],[88,132],start,[88,135],[88,116],[86,94],
  [108,78],[145,76],[190,78],[220,82],[232,95],[214,111],[188,113],[151,112],
  [113,110],[88,98],[80,117],[80,137],start,
];
const lDrillFrames=regularSteps(lRoute,[runStep,runOther],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1,-1,1,1]);
for (const index of [3,6]) lDrillFrames[index]=actorAt(touch,lRoute[index][0]-9,lRoute[index][1]);
const lDrill={...motion(lDrillFrames,310,court([start,turn,end],[start,turn,end])),topView:true};

const tStart:Point=[158,158], tCenter:Point=[158,90], tLeft:Point=[64,90], tRight:Point=[255,90];
const tRoute:Point[]=[tStart,[158,138],[158,116],tCenter,[129,90],[95,90],tLeft,
  [87,90],[117,90],[148,90],[182,90],[215,90],tRight,[228,90],[196,90],tCenter,[158,116],[158,137],tStart];
const tFrames=tRoute.map(([x,y],i)=>actorAt(
  [3,6,12,15].includes(i)?touch:i>15?backPedal:i>3?(i%2?shuffleWide:shuffleIn):(i%2?runOther:runStep),
  x+([3,6,12,15].includes(i)?(i===6?12:-12):0),y,i===6?-1:1,
));
const tDrill={...motion(tFrames,315,court([tStart,tCenter,tLeft,tRight],[tStart,tCenter,tLeft,tRight])),topView:true};

const xBL:Point=[75,156],xBR:Point=[244,156],xTL:Point=[75,93],xTR:Point=[244,93];
const xRoute:Point[]=[xBL,[110,146],[153,128],[196,109],xTR,[203,93],[157,93],[113,93],xTL,
  [114,108],[156,124],[196,140],xBR,[203,156],[157,156],[114,156],xBL];
const xFrames=xRoute.map(([x,y],i)=>actorAt(
  (i>4&&i<9)||i>12?(i%2?shuffleWide:shuffleIn):i>8?backPedal:(i%2?runStep:runOther),x,y,i<5?1:-1,
));
const xDrill={...motion(xFrames,328,court([xBL,xTR,xTL,xBR,xBL],[xBL,xTR,xTL,xBR,[158,124]])),topView:true};

const coneLeft:Point=[61,152], coneMid:Point=[141,92], coneRight:Point=[245,130];
const coneRoute:Point[]=[[51,160],[76,134],[105,112],[136,97],[162,86],[192,94],
  [221,109],[243,122],[257,135],[220,147],[181,153],[141,151],[100,156],[51,160]];
const coneFrames=coneRoute.map(([x,y],i)=>actorAt(i===4||i===8?touch:i>8?(i%2?shuffleWide:shuffleIn):(i%2?runStep:runOther),
  x,y,i>8?-1:1));
const coneCircuit={...motion(coneFrames,345,court([coneLeft,coneMid,coneRight,coneLeft],[coneLeft,coneMid,coneRight])),topView:true};

const dotPositions:Point[]=[[93,154],[226,154],[160,120],[93,88],[226,88]];
const dots:Props=dotPositions.flatMap(([x,y]):Props=>[[x-5,y,x+5,y],[x,y-3,x,y+3]]);
const jumpReady=set(shuffleIn,{7:[173,133],8:[171,152],11:[179,158],9:[155,132],10:[153,152],12:[163,158]});
const hop=set(jumpReady,{0:[164,46],1:[164,64],2:[162,106],3:[180,80],4:[191,64],5:[144,80],6:[137,67],
  7:[175,122],8:[174,140],11:[185,144],9:[153,123],10:[152,140],12:[163,145]});
const dotOrder=[0,2,4,3,2,1,0];
const dotSequence=dotOrder.flatMap((index,i)=>{
  const [x,y]=dotPositions[index];
  if (i===0) return [actorAt(jumpReady,x,y)];
  const [lx,ly]=dotPositions[dotOrder[i-1]];
  return [actorAt(hop,(x+lx)/2,(y+ly)/2),actorAt(jumpReady,x,y)];
});
const dotDrill={...motion(dotSequence,410,dots),topView:true};

const stickGuard=set(athlete,{0:[157,45],1:[153,65],2:[146,107],3:[170,78],4:[168,58],
  5:[141,78],6:[154,60],7:[168,131],8:[185,152],11:[195,157],9:[128,133],10:[106,151],12:[119,158]});
const stickMoving=set(stickGuard,{2:[151,109],7:[178,130],8:[197,150],11:[208,157],
  9:[136,126],10:[120,145],12:[128,152]});
const stickMarks:Point[]=[[67,157],[134,157],[208,157],[255,157]];
const stickFrames=regularSteps([[64,157],[97,157],[130,157],[130,157],[162,157],[192,157],[206,157],[206,157],
  [182,157],[149,157],[120,157],[88,157],[64,157]],[stickGuard,stickMoving,stickGuard,stickGuard],[1,1,1,1,1,1,1,1,-1,-1,-1,-1,1]);
const stickDrill=motion(stickFrames,465,stickMarks.map(([x,y])=>[x-8,y,x+8,y]));

const lateralSteps:Point[]=[[78,156],[109,156],[148,156],[186,156],[221,156],[250,156],[217,156],
  [185,156],[150,156],[115,156],[78,156]];
const sideShuttle=motion(lateralSteps.map(([x,y],i)=>actorAt(
  i===0||i===5||i===10?touch:i%2?shuffleWide:shuffleIn,x,y,i===0||i>5?-1:1,.75,
)),485);

const frontChair:Props=[[119,121,201,121],[124,122,124,157],[196,122,196,157],
  [121,121,121,82],[199,121,199,82],[121,82,199,82]];
const sideChair:Props=[[111,124,175,124],[121,125,121,156],[167,125,167,156],[111,124,111,78]];
const seated:Point[]=[
  [160,57],[160,75],[160,117],[182,96],[178,116],[140,96],[144,116],
  [171,129],[175,153],[149,129],[145,153],[186,157],[134,157],
];
const frontSeat=set(seated,{3:[180,83],4:[200,87],5:[143,84],6:[164,86]});
const seatDown=set(frontSeat,{0:[177,104],1:[164,96],2:[160,116],3:[160,118],4:[144,151],
  5:[145,118],6:[149,131]});
const chairDiagonal=sided([frontSeat,seatDown,seatDown,frontSeat],880,frontChair);
const seatedOpen=set(seated,{3:[193,76],4:[217,75],5:[126,76],6:[103,75]});
const seatedCrossHigh=set(seatedOpen,{1:[161,77],3:[173,81],4:[147,89],5:[151,88],6:[174,96]});
const seatedCrossover=sided([seatedOpen,seatedCrossHigh,seatedOpen],850,frontChair);
const underSwing=set(seatedCrossHigh,{0:[177,62],1:[165,78],3:[180,110],4:[160,131],5:[165,111],6:[191,124]});
const chairSwing=sided([seatedOpen,seatedCrossHigh,underSwing,seatedCrossHigh],820,frontChair);
const pecOpen=set(seated,{3:[194,79],4:[194,46],5:[126,79],6:[126,46]});
const pecClose=set(pecOpen,{3:[169,79],4:[169,48],5:[153,79],6:[153,48]});
const chairPec=motion([pecOpen,pecClose,pecClose,pecOpen],860,frontChair);

const crossedArms:Point[]=[...set(seated,{3:[178,91],4:[148,81],5:[143,94],6:[171,82]}),[170,77],[150,77]];
const seatYaw=set(crossedArms,{0:[175,56],1:[161,75],3:[183,89],4:[165,82],5:[159,93],6:[178,82],
  13:[179,74],14:[161,77]});
const seatedTwists:Illustration={
  ...sided([crossedArms,seatYaw,seatYaw,crossedArms],970,frontChair),shoulders:[13,14],
};
const openLeg=set(seatYaw,{7:[202,111],8:[192,134],11:[204,139]});
const abductionTwist:Illustration={
  ...sided([crossedArms,seatYaw,openLeg,openLeg,crossedArms],895,frontChair),shoulders:[13,14],
};
const sittingSide:Point[]=[
  [147,57],[147,76],[144,118],[161,99],[180,116],[138,99],[155,115],
  [181,122],[186,152],[170,122],[170,151],[199,157],[183,155],[146,88],[146,104],
];
const armsFolded=set(sittingSide,{3:[165,93],4:[146,82],5:[152,93],6:[163,84]});
const reclineSeat=set(armsFolded,{0:[121,62],1:[126,81],3:[145,95],4:[127,85],5:[133,94],6:[145,83],
  13:[134,96],14:[140,108]});
const chairLeanBack:Illustration={...motion(around([armsFolded,reclineSeat,reclineSeat]),1050,sideChair),spine:[13,14]};
const curlSeatMid=set(sittingSide,{0:[160,92],1:[154,109],3:[171,115],4:[187,119],
  5:[155,113],6:[168,120],13:[149,107],14:[141,111]});
const curlSeat=set(curlSeatMid,{0:[191,111],1:[177,102],3:[185,115],4:[184,127],
  5:[173,113],6:[174,126],13:[164,98],14:[152,108]});
const seatedRoll:Illustration={...motion(around([sittingSide,curlSeatMid,curlSeat,curlSeat]),980,sideChair),spine:[13,14]};

const supportChair:Props=[[213,122,265,122],[218,122,218,158],[261,122,261,158],[265,122,265,77],
  [237,78,265,78]];
const hipReady=set(athlete,{0:[148,42],1:[149,62],2:[150,105],3:[177,82],4:[231,79],5:[135,83],6:[128,107],
  7:[153,131],8:[151,153],11:[164,158],9:[167,124],10:[181,139],12:[187,143]});
const hipCircle=set(hipReady,{9:[180,119],10:[196,135],12:[209,140]});
const hipDeep=set(hipReady,{9:[170,109],10:[177,128],12:[189,133]});
const hipBack=set(hipReady,{9:[158,122],10:[160,143],12:[167,149]});
const legSwap=(frame:Point[])=>set(frame,{7:frame[9],8:frame[10],11:frame[12],
  9:frame[7],10:frame[8],12:frame[11]});
const hipClockwise=[hipReady,hipDeep,hipCircle,hipBack,hipReady,hipBack,hipCircle,hipDeep,hipReady];
const chairHipCircle=sided(hipClockwise,755,supportChair,[],legSwap);

const chairWall:Props=[[260,26,260,159],[259,43,267,37],[259,75,267,69],[259,108,267,102],
  [205,118,259,118],[209,119,209,158],[250,119,250,158],[251,117,251,77]];
const chairPressHigh:Point[]=[
  [213,63],[194,76],[135,106],[211,93],[207,116],[200,95],[213,116],
  [105,125],[71,151],[94,127],[62,152],[82,157],[70,157],
];
const chairPressLow=set(chairPressHigh,{0:[231,91],1:[210,98],2:[148,119],3:[190,104],5:[180,106],
  7:[110,137],9:[99,137]});
const chairPress=motion([chairPressHigh,chairPressLow,chairPressLow,chairPressHigh],850,chairWall);

const floorSeat:Point[]=[
  [163,67],[163,86],[163,145],[184,113],[188,135],[142,113],[138,136],
  [193,138],[149,151],[131,138],[175,151],[143,156],[181,155],
];
const floorSeatWide=set(floorSeat,{3:[194,84],4:[226,80],5:[132,85],6:[100,82]});
const ballerinaTop=set(floorSeat,{3:[181,62],4:[164,40],5:[145,62],6:[161,40]});
const ballerina=motion([floorSeat,floorSeatWide,ballerinaTop,ballerinaTop,floorSeatWide],950);

const wideBase=shuffleWide;
const squatLow=set(wideBase,{0:[155,64],1:[155,83],2:[155,135],3:[166,106],4:[179,113],
  5:[144,106],6:[133,113],7:[183,132],8:[192,153],9:[126,132],10:[116,153]});
const kickToSide=set(athlete,{0:[147,43],1:[145,62],2:[147,109],3:[172,100],4:[208,120],
  5:[129,83],6:[119,92],7:[185,112],8:[215,120],11:[226,124],9:[145,131],10:[144,153],12:[138,158]});
const squatHeel=sided([squatLow,wideBase,kickToSide,wideBase,squatLow],710);

const standingReach=set(athlete,{0:[154,40],1:[152,61],2:[151,108],3:[171,45],4:[174,19],5:[132,82],6:[122,110]});
const stretchMid=set(standingReach,{0:[136,67],1:[139,79],3:[139,52],4:[124,30],5:[117,96],6:[111,116]});
const stretchDiagonal=set(stretchMid,{0:[133,94],1:[143,102],2:[154,109],3:[121,115],4:[108,142],
  5:[121,84],6:[100,67]});
const diagBend=sided([stretchDiagonal,stretchDiagonal,stretchMid,standingReach,stretchMid],1010);
const rotationReady=set(athlete,{3:[169,90],4:[155,106],5:[136,91],6:[152,105]});
const lowTurn=set(rotationReady,{0:[166,50],1:[157,68],2:[160,111],3:[181,95],4:[168,108],
  5:[149,96],6:[166,109],7:[170,130],8:[178,153],11:[188,157],9:[145,130],10:[123,152],12:[134,157]});
const lowBodyRotate=sided([rotationReady,lowTurn,lowTurn,rotationReady],920);
const hingeRotate=set(athlete,{0:[198,94],1:[179,102],2:[150,112],3:[157,126],4:[128,142],
  5:[183,81],6:[187,55],7:[154,135],8:[153,153],11:[165,157],
  9:[129,124],10:[108,130],12:[99,133]});
const oneLegTurn=sided([hingeRotate,hingeRotate,athlete,athlete],910);

const kneeling:Point[]=[
  [159,76],[160,94],[160,117],[183,111],[209,127],[140,110],[112,127],
  [171,150],[163,152],[149,150],[141,152],[168,157],[146,157],
];
const kneelingDrop=set(kneeling,{0:[173,109],1:[162,119],2:[147,119],3:[190,134],4:[215,150],
  5:[157,137],6:[173,152]});
const kneelingSide=set(kneelingDrop,{0:[185,129],1:[172,124],2:[137,123],3:[201,140],4:[225,153],
  5:[180,142],6:[203,152]});
const kneeSideFold=sided([kneelingSide,kneelingSide,kneelingDrop,kneeling,kneelingDrop],1000);

const lying:Point[]=[
  [66,143],[85,151],[137,151],[116,148],[137,149],[108,153],[129,154],
  [179,152],[221,152],[170,151],[214,151],[229,146],[222,146],
];
const heelSlideMid=set(lying,{7:[165,134],8:[190,152],11:[201,157]});
const heelSlideEnd=set(lying,{7:[158,104],8:[159,152],11:[172,157]});
const heelSlide=sided([lying,heelSlideMid,heelSlideEnd,heelSlideEnd,heelSlideMid],880,[],[],legSwap);
const book=mobilityDeviceIllustrations["3539"];
const flowingBook:Illustration={
  ...book,frames:book.frames.filter((frame,index,frames)=>frame!==frames[index-1]),ms:750,
};

const lateralSquat=set(squatLow,{
  0:[130,66],1:[135,86],2:[134,130],3:[155,108],4:[172,104],5:[126,110],6:[140,106],
  7:[169,137],8:[199,153],11:[213,158],9:[118,132],10:[112,152],12:[99,158],
});
const sideSit=set(lateralSquat,{0:[136,82],1:[139,105],2:[139,151],3:[157,123],4:[173,131],
  5:[145,126],6:[161,134],7:[168,146],8:[204,153],11:[215,156]});
const rollBack:Point[]=[
  [104,142],[123,151],[164,153],[137,133],[158,119],[131,136],[151,120],
  [176,116],[196,133],[159,115],[183,133],[207,140],[193,140],
];
const splitStance=set(athlete,{0:[159,37],1:[159,56],2:[155,104],3:[173,86],4:[184,106],
  5:[146,84],6:[134,104],7:[181,129],8:[202,153],11:[217,157],
  9:[131,131],10:[115,151],12:[126,157]});
const splitLow=set(splitStance,{0:[165,57],1:[164,77],2:[157,127],3:[182,103],4:[191,114],
  5:[151,102],6:[142,114],7:[201,126],9:[129,149],10:[115,152]});
const splitToSit=set(splitLow,{0:[155,88],1:[151,103],2:[150,148],3:[173,118],4:[194,130],
  5:[164,117],6:[183,129],7:[188,126],8:[197,151],11:[210,158],9:[160,127],10:[177,151],12:[188,157]});
const lateralSquatRoll=sided(around([wideBase,lateralSquat,sideSit,rollBack,rollBack]),850);
const splitSquatRoll=sided(around([splitStance,splitLow,splitToSit,rollBack,rollBack]),900);
const butterflyStart=set(floorSeat,{3:[179,116],4:[171,145],5:[140,114],6:[157,145],
  7:[195,138],8:[168,149],11:[164,156],9:[131,138],10:[157,148],12:[161,155]});
const butterflyTilt=set(butterflyStart,{0:[139,89],1:[144,104],2:[170,146],
  3:[168,120],4:[176,137],5:[160,121],6:[172,136],
  7:[198,125],8:[177,143],11:[171,149],9:[145,125],10:[170,143],12:[172,148]});
const butterflyRoll=set(butterflyTilt,{0:[97,143],1:[117,150],2:[167,152],
  3:[145,134],4:[173,114],5:[137,132],6:[163,112],
  7:[198,132],8:[173,116],11:[169,111],9:[166,129],10:[163,115],12:[168,112]});
const butterflyBack=motion(around([butterflyStart,butterflyTilt,butterflyRoll,butterflyRoll]),900);

const medicineBall:Attachments=[["ball",13,0]];
const tossReady:Point[]=[
  [155,40],[155,59],[155,107],[171,85],[189,110],[165,85],[184,112],
  [163,132],[164,152],[145,132],[145,152],[176,157],[157,157],[190,112],
];
const backwardReady=set(tossReady,{0:[182,68],1:[173,78],2:[155,118],3:[172,102],4:[157,124],
  5:[164,104],6:[151,124],7:[179,131],9:[146,134],13:[154,130]});
const backPush=set(tossReady,{0:[164,44],1:[160,64],2:[151,113],3:[169,79],4:[184,87],
  5:[163,78],6:[178,85],13:[183,88]});
const overheadToss=set(tossReady,{3:[153,40],4:[150,18],5:[146,40],6:[142,18],13:[147,17]});
const backAir=set(overheadToss,{0:[149,37],1:[151,57],3:[143,32],4:[130,16],5:[136,33],6:[124,17],13:[101,21]});
const backLand=set(tossReady,{3:[142,81],4:[135,105],5:[147,86],6:[138,111],13:[60,150]});
const getBack=set(backwardReady,{0:[102,100],1:[110,117],2:[131,126],3:[83,132],4:[64,145],
  5:[92,134],6:[69,145],7:[125,135],8:[130,152],11:[117,157],9:[139,133],10:[147,153],12:[136,157],13:[61,150]});
const backwardTravel=[backwardReady,backPush,overheadToss,backAir,backLand,getBack];
const backwardsToss={...motion([tossReady,...backwardTravel],710,[],medicineBall),cutOnLoop:true};
const backwardsThrow={...motion(backwardTravel,680,[],medicineBall),cutOnLoop:true};
const forwardReady=set(overheadToss,{0:[145,42],1:[150,61],3:[142,41],4:[138,18],
  5:[136,42],6:[132,20],13:[133,19]});
const forwardRelease=set(tossReady,{0:[157,43],1:[153,63],3:[174,61],4:[207,67],
  5:[169,63],6:[201,69],13:[215,69]});
const forwardFlight=set(forwardRelease,{0:[162,58],1:[156,73],2:[150,114],3:[185,78],4:[204,96],
  5:[180,80],6:[198,95],13:[246,83]});
const forwardLanding=set(forwardFlight,{0:[160,57],1:[155,73],3:[174,96],4:[173,114],
  5:[165,97],6:[165,118],13:[276,150]});
const forwardPickup=set(forwardLanding,{0:[251,113],1:[238,111],2:[220,119],3:[257,126],
  4:[276,145],5:[249,128],6:[268,147],7:[237,134],8:[243,153],11:[256,157],
  9:[210,134],10:[212,153],12:[224,156]});
const forwardToss={...motion([forwardReady,forwardRelease,forwardFlight,forwardLanding,forwardPickup],710,[],medicineBall),cutOnLoop:true};
const targetWall:Props=[[276,27,276,159],[276,44,287,37],[276,70,287,63],[276,96,287,89],
  [276,122,287,115],[276,147,287,140]];
const hitsWall=set(forwardFlight,{13:[268,80]});
const caught=set(forwardLanding,{0:[162,55],1:[155,70],3:[176,87],4:[196,92],
  5:[170,88],6:[192,94],13:[204,94]});
const wallThrow=motion([forwardReady,forwardRelease,hitsWall,caught,tossReady],750,targetWall,medicineBall);
const throwDown=set(forwardRelease,{0:[179,78],1:[165,84],2:[147,115],3:[192,104],4:[211,127],
  5:[181,104],6:[203,128],13:[223,134]});
const groundShot=set(throwDown,{0:[174,91],1:[159,96],3:[178,119],4:[194,139],
  5:[168,119],6:[185,140],13:[246,151]});
const groundPickup=set(groundShot,{0:[223,110],1:[212,112],2:[186,128],3:[228,126],4:[244,144],
  5:[218,130],6:[239,147],7:[204,135],8:[222,152],11:[235,157],
  9:[169,137],10:[161,153],12:[174,157]});
const downThrow={...motion([forwardReady,forwardRelease,throwDown,groundShot,groundPickup],700,[],medicineBall),cutOnLoop:true};

export const sportsConditioningIllustrations:Readonly<Record<string,Illustration>>={
  "5965":stickDrill,
  "5986":coneCircuit,
  "5969":dotDrill,
  "5971":lDrill,
  "3551":sideShuttle,
  "5976":tDrill,
  "5979":xDrill,
  "3479":squatHeel,
  "6632":chairDiagonal,
  "8434":seatedRoll,
  "10517":chairHipCircle,
  "4329":chairPress,
  "8619":seatedCrossover,
  "8423":chairLeanBack,
  "8653":chairSwing,
  "8621":chairPec,
  "8303":seatedTwists,
  "8202":abductionTwist,
  "5134":ballerina,
  "10194":butterflyBack,
  "6762":diagBend,
  "5029":mobilityDeviceIllustrations["3526"],
  "2121":trunkMobilityIllustrations["2125"],
  "2124":kneeSideFold,
  "9969":heelSlide,
  "3414":flowingBook,
  "1703":oneLegTurn,
  "3718":lateralSquatRoll,
  "3716":splitSquatRoll,
  "3407":lowBodyRotate,
  "10109":backwardsToss,
  "3439":backwardsThrow,
  "4243":wallThrow,
  "10108":forwardToss,
  "3442":downThrow,
};
