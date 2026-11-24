import type { Illustration, Point } from "./motion-data";
import { legacyMobilityCorrections } from "./legacy-mobility-corrections";

type Props=NonNullable<Illustration["props"]>;
type Attachments=NonNullable<Illustration["dynamic"]>;
const feet:Attachments=[["foot-tip",8,11],["foot-tip",10,12]];
const set=(frame:Point[], changes:Partial<Record<number,Point>>)=>frame.map((point,index)=>changes[index]??point);
const flip=(frame:Point[])=>frame.map(([x,y]):Point=>[320-x,y]);
const swap=(frame:Point[])=>set(frame,{
  3:frame[5],4:frame[6],5:frame[3],6:frame[4],7:frame[9],8:frame[10],11:frame[12],
  9:frame[7],10:frame[8],12:frame[11],
});
const move=(frames:Point[][],ms=980,props:Props=[],extra:Attachments=[]):Illustration=>
  ({frames,ms,props,dynamic:[...feet,...extra],reference:true});
const breathFrame=(frame:Point[],joint=1)=>{
  const [x,y]=frame[joint];
  return set(frame,{[joint]:[x,y-2]});
};
const breathe=(frame:Point[],props:Props=[],extra:Attachments=[])=>
  move([frame,breathFrame(frame),frame],1950,props,extra);
const sideSeat:Props=[[113,123,172,123],[122,124,122,158],[164,124,164,158],[114,122,114,76]];
const paddedSeat:Props=[...sideSeat,[120,73,132,73],[132,73,132,119],[120,73,120,119],[120,119,132,119]];

const normalStanding:Point[]=[
  [159,41],[159,60],[159,107],[170,83],[168,106],[146,84],[148,106],
  [169,131],[170,153],[151,131],[150,153],[184,157],[137,157],
];
const normalSeated:Point[]=[
  [147,58],[146,76],[144,118],[159,97],[168,118],[140,98],[157,116],
  [185,120],[188,152],[170,120],[172,151],[201,157],[185,156],
];
const seatBack=breathe(normalSeated,sideSeat);
const backTouchesPad=set(normalSeated,{0:[143,57],1:[139,77],2:[139,118],3:[153,97],5:[140,97]});
const seatWithPad=breathe(backTouchesPad,paddedSeat);
const neutralStanding=breathe(normalStanding);

const faceUp:Point[]=[
  [79,138],[96,148],[150,151],[122,150],[148,154],[118,148],[143,149],
  [191,152],[231,153],[184,149],[223,150],[240,150],[232,147],[79,153],
];
const supineHeadPad=breathe(faceUp,[],[["pad",13,0]]);
const faceDown:Point[]=[
  [235,150],[217,149],[162,152],[193,151],[166,154],[186,150],[162,152],
  [121,152],[81,152],[115,151],[73,151],[70,157],[62,156],
];
const proneStill=breathe(faceDown,[[50,160,260,160]]);

const forearm:Point[]=[
  [228,102],[211,113],[149,128],[206,151],[234,154],[195,151],[223,153],
  [116,141],[81,152],[104,140],[69,152],[93,158],[81,157],
];
const kneesRest=set(forearm,{0:[226,113],1:[208,122],2:[154,145],
  7:[117,154],9:[105,154]});
const forearmPlank=move([forearm,breathFrame(forearm),forearm,forearm,kneesRest],1320);
const highPlank:Point[]=[
  [228,83],[208,103],[145,124],[212,129],[213,154],[201,128],[200,153],
  [110,137],[75,152],[100,138],[64,151],[86,158],[76,157],
];
const withIncorrect=(frame:Point[],upperY:number)=>frame.map(([x,y]):Point=>[37+x*.79,upperY+y*.56]);
const correctBreath=withIncorrect(breathFrame(forearm),-17);
const correct=withIncorrect(forearm,-17);
const hipsTooHigh=set(forearm,{0:[221,96],1:[206,105],2:[149,93],7:[116,125],9:[105,125]});
const hipsTooLow=set(forearm,{0:[227,109],1:[210,118],2:[150,147],7:[111,148],9:[101,148]});
const hipExample:Illustration={
  ...move([correct,correctBreath,correct,correctBreath,correct,correctBreath],1300,
    [[66,73,257,73],[66,157,260,157],[267,49,273,55],[273,55,286,42],
      [269,115,282,128],[282,115,269,128]]),
  partnerFrames:[hipsTooHigh,hipsTooHigh,forearm,hipsTooLow,hipsTooLow,forearm].map(frame=>withIncorrect(frame,69)),
};

const reachingOpposite=set(highPlank,{3:[242,108],4:[277,102],9:[100,112],10:[61,106],12:[50,104]});
const birdPlank=move([highPlank,reachingOpposite,reachingOpposite,highPlank,swap(reachingOpposite),
  swap(reachingOpposite),highPlank],930);
const hopWide=set(highPlank,{
  0:[230,82],1:[205,103],2:[145,123],3:[223,127],4:[232,153],5:[188,126],6:[177,153],
  7:[108,139],8:[85,152],11:[101,158],9:[89,137],10:[48,152],12:[59,158],
});
const hopFlight=set(highPlank,{0:[228,77],1:[209,97],2:[144,119],
  4:[216,143],6:[194,142],8:[77,141],10:[60,140],11:[88,146],12:[71,146]});
const powerPlank=move([highPlank,hopFlight,hopWide,hopFlight,highPlank],470);
const sideOpen=set(highPlank,{3:[222,126],4:[232,153],5:[207,128],6:[207,153],
  7:[110,137],8:[83,151],11:[98,157]});
const addSecond=set(sideOpen,{5:[217,128],6:[225,153],9:[104,139],10:[75,152],12:[86,158]});
const sideStep=set(addSecond,{3:[231,127],4:[251,153],7:[116,135],8:[103,151],11:[119,156]});
const addedAgain=set(sideStep,{5:[228,128],6:[243,153],9:[110,139],10:[94,152],12:[105,157]});
const lateralPlank=move([highPlank,sideOpen,addSecond,sideStep,addedAgain,sideStep,addSecond,sideOpen,highPlank],680);
const rollHipsLeft=set(forearm,{0:[227,106],2:[142,143],7:[112,148],9:[102,143],8:[81,152],10:[73,150],
  11:[88,154],12:[85,153]});
const rollHipsRight=swap(rollHipsLeft);
const plankTwist=move([forearm,rollHipsLeft,rollHipsLeft,forearm,rollHipsRight,rollHipsRight],910);

const stepOutFrames=legacyMobilityCorrections["3698"].frames.slice(0,5);
const walkout=move([...stepOutFrames,stepOutFrames[4],...stepOutFrames.slice(1,-1).reverse()],820);
const fours:Point[]=[
  [214,85],[195,102],[135,105],[199,131],[201,153],[184,129],[188,152],
  [140,152],[99,153],[128,151],[89,151],[88,158],[78,156],
];
const stepPike=set(fours,{0:[208,108],1:[194,101],2:[136,78],3:[207,127],4:[210,154],
  5:[194,124],6:[198,153],7:[123,128],8:[100,151],11:[111,158],9:[114,127],10:[96,152],12:[108,158]});
const pike=set(stepPike,{0:[193,119],1:[178,99],2:[141,46],3:[194,126],4:[210,154],
  5:[185,125],6:[198,153],7:[122,101],8:[105,152],11:[116,157],9:[113,100],10:[98,151],12:[110,156]});
const pikeStand=move([pike,breathFrame(pike),pike,pike,stepPike,fours,stepPike],1080);

const sidePlank:Point[]=[
  [216,104],[198,115],[146,127],[198,151],[226,154],[173,124],[147,127],
  [112,140],[78,151],[106,142],[71,152],[88,156],[82,157],
];
const sideSetup=set(sidePlank,{0:[214,116],1:[196,126],2:[146,148],7:[111,151],9:[105,153]});
const sideHold=move([sidePlank,breathFrame(sidePlank),sidePlank,sideSetup,
  flip(sideSetup),flip(sidePlank),flip(breathFrame(sidePlank)),flip(sidePlank),flip(sideSetup),sideSetup],1240);
const sideReach=set(sidePlank,{5:[219,89],6:[237,63]});
const sideCrunch=set(sidePlank,{5:[170,117],6:[185,97]});
const sidePullDown=move([sideReach,sideCrunch,sideCrunch,sideReach,sideSetup,
  flip(sideSetup),flip(sideReach),flip(sideCrunch),flip(sideCrunch),flip(sideReach),flip(sideSetup)],950);

const inversionWall:Props=[[78,11,78,160],[70,22,78,29],[70,51,78,58],[70,80,78,87],
  [70,109,78,116],[70,138,78,145]];
const casting:Point[]=[
  [139,108],[132,100],[135,66],[125,127],[120,154],[115,128],[110,153],
  [100,61],[86,58],[142,113],[147,147],[88,51],[157,156],
];
const halfUp=set(casting,{0:[124,109],1:[121,99],2:[125,57],3:[123,127],5:[114,126],
  7:[106,36],8:[86,18],11:[96,10],9:[122,81],10:[139,105],12:[149,108]});
const handWall=set(casting,{0:[123,113],1:[118,98],2:[107,57],
  3:[119,126],5:[111,125],7:[94,34],8:[80,13],11:[93,7],
  9:[100,33],10:[84,14],12:[97,9]});
const wallHandstand=move([handWall,breathFrame(handWall,0),handWall,handWall,halfUp,casting,halfUp],
  1100,inversionWall);
const wallFacing=set(handWall,{0:[103,110],1:[117,97],8:[90,17],11:[80,13],10:[96,15],12:[82,11]});
const splitWall=set(wallFacing,{9:[127,37],10:[173,27],12:[184,25]});
const splitOther=set(wallFacing,{7:[121,37],8:[171,29],11:[182,27]});
const splitWallHandstand=move([splitWall,splitWall,wallFacing,wallFacing,splitOther,splitOther,wallFacing,halfUp],
  1100,inversionWall);
const leaveWall=set(handWall,{0:[138,113],1:[132,102],2:[109,70],3:[128,129],5:[120,125],
  7:[99,47],8:[85,35],11:[94,29],9:[107,46],10:[93,33],12:[103,28]});
const tuckMid=set(handWall,{0:[154,112],1:[144,108],2:[111,89],3:[131,130],5:[126,130],
  7:[111,111],8:[92,112],11:[88,120],9:[103,112],10:[87,113],12:[86,121]});
const plancheTuck=set(tuckMid,{0:[169,103],1:[151,109],2:[103,105],3:[136,131],5:[131,130],
  7:[112,126],8:[93,128],11:[83,125],9:[105,126],10:[88,132],12:[84,128]});
const endSit=set(plancheTuck,{0:[151,108],1:[138,118],2:[109,127],3:[130,136],5:[123,135],
  7:[137,137],8:[119,154],11:[102,157],9:[125,140],10:[105,152],12:[91,157]});
const tuckNegative:Illustration={...move([handWall,leaveWall,tuckMid,plancheTuck,plancheTuck,endSit],
  930,inversionWall),cutOnLoop:true};

const supports:Props=[
  [67,121,122,121],[67,121,67,156],[122,121,122,156],[60,156,75,156],[113,156,128,156],
  [220,121,271,121],[220,121,220,156],[270,121,270,156],[212,156,226,156],[262,156,278,156],
];
const supportedHold:Point[]=[
  [75,102],[96,112],[151,112],[117,108],[141,108],[116,113],[139,113],
  [190,113],[232,115],[182,113],[223,114],[236,101],[227,102],
];
const chinesePlank=breathe(supportedHold,supports,[]);

export const postureFormIllustrations:Readonly<Record<string,Illustration>>={
  "3657":supineHeadPad,
  "3660":proneStill,
  "3661":seatBack,
  "3658":seatWithPad,
  "3659":neutralStanding,
  "2347":forearmPlank,
  "2358":hipExample,
  "2349":sideHold,
  "5466":birdPlank,
  "6545":wallHandstand,
  "10997":tuckNegative,
  "10998":splitWallHandstand,
  "8610":chinesePlank,
  "7859":powerPlank,
  "3854":walkout,
  "9488":pikeStand,
  "4385":plankTwist,
  "6026":sidePullDown,
  "3958":lateralPlank,
};
