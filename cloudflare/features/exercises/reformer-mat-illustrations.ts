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
const move=(frames:Point[][],ms=890,props:Props=[],extra:Attachments=[]):Illustration=>
  ({frames,ms,props,dynamic:[...feet,...extra],reference:true});
const heldSequence=(frames:Point[][])=>{
  const last=frames.at(-1)!;
  return [...frames,last,last,...frames.slice(1,-1).reverse()];
};
const hold=(frames:Point[][],ms=1000,props?:Props,extra?:Attachments)=>{
  const last=frames.at(-1)!;
  return move([last,last,last,...frames.slice(0,-1).reverse(),...frames.slice(1,-1)],ms,props,extra);
};
const paired=(path:Point[][],ms=900,transform=flip)=>move([...path,...path.map(transform)],ms);
const coverAt=(illustration:Illustration,index:number):Illustration=>({
  ...illustration, frames:[...illustration.frames.slice(index),...illustration.frames.slice(0,index)],
});

const prone:Point[]=[
  [228,143],[211,149],[153,151],[209,139],[224,154],[199,139],[211,152],
  [115,152],[75,152],[105,151],[65,151],[64,158],[55,156],
];
const clasped = set(prone,{3:[190,136],4:[183,140],5:[190,140],6:[182,141]});
const kickBoth=set(clasped,{7:[115,151],8:[144,116],11:[153,120],9:[107,151],10:[132,114],12:[144,117]});
const kickExtended=set(clasped,{0:[229,102],1:[210,120],2:[153,151],3:[183,124],4:[156,124],
  5:[178,126],6:[152,126]});
const legDoubleKick=move([kickBoth,kickBoth,clasped,kickBoth,clasped,kickExtended,kickExtended,clasped],700);
const forearms=set(prone,{0:[232,109],1:[210,124],3:[207,152],4:[231,154],5:[194,151],6:[219,153]});
const oneKick=set(forearms,{7:[115,152],8:[136,116],11:[145,121]});
const oneFar=set(forearms,{9:[105,151],10:[126,113],12:[136,121]});
const oneKickPulse=set(oneKick,{8:[127,112],11:[138,115]});
const oneFarPulse=set(oneFar,{10:[117,111],12:[127,116]});
const legSingleKick=move([forearms,oneKick,oneKickPulse,oneKick,oneKickPulse,forearms,
  oneFar,oneFarPulse,oneFar,oneFarPulse,forearms],620);

const pressing=set(prone,{0:[231,119],1:[212,129],3:[195,142],5:[185,142]});
const swanHigh=set(pressing,{0:[226,87],1:[210,105],3:[215,130],5:[202,132]});
const proneSwan=move([prone,pressing,swanHigh,swanHigh,pressing],930);
const aerialSwan=set(swanHigh,{3:[234,111],4:[263,108],5:[227,113],6:[256,111]});
const legsRise=set(aerialSwan,{0:[235,120],1:[214,134],3:[239,134],4:[265,125],5:[231,135],6:[258,125],
  7:[117,132],8:[81,111],11:[66,106],9:[109,132],10:[72,114],12:[58,110]});
const dive=move([prone,pressing,swanHigh,aerialSwan,legsRise,aerialSwan,legsRise,aerialSwan,pressing],810);
const rockGrip=set(prone,{0:[218,116],1:[199,128],3:[176,128],4:[149,121],5:[172,134],6:[142,122],
  7:[111,146],8:[145,115],11:[154,123],9:[103,144],10:[137,114],12:[145,124]});
const rockChest=set(rockGrip,{0:[220,83],1:[203,104],3:[174,112],4:[150,99],5:[166,117],6:[141,100],
  7:[119,134],8:[143,90],11:[154,98],9:[110,137],10:[133,90],12:[141,101]});
const rockLegs=set(rockGrip,{0:[224,121],1:[205,131],3:[179,111],4:[147,88],5:[170,112],6:[141,87],
  7:[117,119],8:[140,82],11:[150,90],9:[110,121],10:[132,81],12:[141,87]});
const rocking=move([rockGrip,rockChest,rockLegs,rockChest,rockLegs,rockGrip],870);

const longArms=set(prone,{0:[223,130],1:[205,139],3:[233,140],4:[260,142],5:[227,140],6:[254,142]});
const swimmingBrace=set(longArms,{0:[226,112],1:[208,127],3:[238,128],4:[263,128],
  5:[232,128],6:[256,128],7:[117,144],8:[78,140],11:[65,139],9:[108,142],10:[67,140],12:[54,138]});
const flutter=set(swimmingBrace,{3:[234,113],4:[262,104],9:[112,130],10:[74,121],12:[61,119]});
const swimming=move([longArms,swimmingBrace,flutter,swap(flutter),flutter,swap(flutter),swimmingBrace],470);
const footLoop:Point[]=[[5,-6],[10,-12],[1,-18],[-8,-12],[-9,-6],[-8,-12],[1,-18],[10,-12],[5,-6]];
const circleLeg=footLoop.map(([x,y])=>set(longArms,{
  7:[115+x*.45,150+y*.45],8:[75+x,148+y],11:[61+x,147+y],
}));
const proneCircle=paired([longArms,...circleLeg,longArms],710,swap);
const table:Point[]=[
  [219,82],[199,102],[139,104],[203,127],[205,153],[192,126],[192,152],
  [145,152],[105,153],[131,152],[91,152],[94,157],[82,156],
];
const birdReach=set(table,{3:[227,103],4:[255,104],9:[97,106],10:[57,106],12:[46,106]});
const birdFloat=set(birdReach,{3:[226,99],4:[253,96],9:[97,102],10:[57,100],12:[46,100]});
const birdDrop=set(birdReach,{3:[226,105],4:[251,111],9:[97,107],10:[56,111],12:[47,111]});
const fourSwim=paired([table,birdReach,birdFloat,birdDrop,birdFloat,birdDrop,birdReach,table],640,swap);

const forehead=set(prone,{0:[228,142],1:[211,149],3:[203,146],4:[226,152],5:[199,147],6:[219,153]});
const kneeReady=set(forehead,{7:[114,151],8:[113,119],11:[124,117]});
const kneeRise=set(kneeReady,{7:[115,137],8:[114,104],11:[126,103]});
const frogAlternate=paired([forehead,kneeReady,kneeRise,kneeRise,kneeReady,forehead],850,swap);
const frogReady=set(kneeReady,{9:[95,150],10:[111,120],12:[123,117]});
const frogRise=set(frogReady,{7:[121,135],8:[113,106],11:[124,102],9:[102,137],10:[111,107],12:[123,103]});
const frogBoth=move([frogReady,frogRise,frogRise,frogReady],870);

const stand:Point[]=[
  [157,38],[157,58],[157,108],[171,84],[175,108],[143,84],[139,107],
  [164,132],[165,152],[150,132],[149,152],[175,157],[139,157],
];
const chairArms=set(stand,{
  0:[164,58],1:[153,78],2:[135,114],3:[163,95],4:[158,81],5:[150,96],6:[157,81],
  7:[166,129],8:[166,152],11:[179,156],9:[154,129],10:[154,151],12:[166,155],
});
const chairTwist=set(chairArms,{0:[171,88],1:[161,101],2:[133,119],3:[175,125],4:[163,105],
  5:[145,100],6:[161,105],7:[168,130],9:[157,130]});
const revolvedChair=paired(heldSequence([stand,chairArms,chairTwist]),1030);

const lunge=set(stand,{
  0:[159,44],1:[157,64],2:[155,113],3:[174,86],4:[163,113],5:[143,86],6:[151,111],
  7:[197,122],8:[197,152],11:[210,157],9:[119,133],10:[91,146],12:[100,158],
});
const handsAtHeart=set(lunge,{3:[179,90],4:[166,73],5:[145,89],6:[164,73]});
const lungeTwist=set(handsAtHeart,{0:[202,78],1:[186,92],2:[151,114],
  3:[196,122],4:[186,96],5:[173,77],6:[185,96]});
const revolvingLunge=paired(heldSequence([stand,lunge,handsAtHeart,lungeTwist]),1020);
const triangle=set(lunge,{7:[181,132],8:[204,151],11:[213,157],9:[124,131],10:[97,151],12:[105,157]});
const triangleHinge=set(triangle,{0:[213,106],1:[195,107],2:[152,106],
  3:[207,133],4:[213,154],5:[194,130],6:[204,146]});
const triangleTwist=set(triangleHinge,{0:[216,93],1:[195,102],3:[209,129],4:[215,154],
  5:[192,72],6:[191,42]});
const revolvedTriangle=paired(heldSequence([triangle,triangleHinge,triangleTwist]),1050);

const sittingWide:Point[]=[
  [157,67],[157,86],[157,146],[179,111],[189,143],[135,111],[128,143],
  [200,147],[237,152],[122,146],[157,151],[243,140],[166,150],
];
const sittingSideArc=set(sittingWide,{0:[193,95],1:[177,108],3:[188,126],4:[209,145],
  5:[185,86],6:[207,79],9:[118,140],10:[159,148],12:[167,147]});
const sittingSideEnd=set(sittingSideArc,{0:[208,118],1:[191,124],3:[211,138],4:[234,148],
  5:[199,100],6:[222,105]});
const revolvedHeadKnee=paired(heldSequence([sittingWide,sittingSideArc,sittingSideEnd]),1040);
const wideSeated=legacyMobilityCorrections["1587"];
const wideFold:Illustration={...wideSeated,frames:wideSeated.frames.map((frame,i)=>i===3
  ? set(frame,{3:[174,112],4:[177,148],5:[142,114],6:[143,147]}) : frame)};

const feetWide=set(stand,{7:[184,133],8:[210,152],11:[225,157],
  9:[130,133],10:[104,152],12:[94,157],3:[178,82],4:[169,106],5:[135,82],6:[146,106]});
const wideHinge=set(feetWide,{0:[160,106],1:[160,96],2:[157,98],
  3:[174,117],4:[182,132],5:[139,117],6:[132,132]});
const wideHands=set(wideHinge,{0:[158,142],1:[158,123],2:[157,94],
  3:[170,137],4:[177,155],5:[145,137],6:[140,155]});
const standWideFold=hold([feetWide,wideHinge,wideHands]);
const internalToes=(frame:Point[])=>set(frame,{11:[198,155],12:[115,155]});
const wideInward=hold([feetWide,wideHinge,wideHands].map(internalToes));
const narrowHinge=set(wideHinge,{7:[164,131],8:[166,153],11:[178,157],
  9:[148,130],10:[148,153],12:[137,157]});
const narrowFold=set(narrowHinge,{0:[170,143],1:[164,126],2:[151,99],3:[170,140],4:[176,156],
  5:[154,139],6:[159,155]});
const standingFold=hold([stand,narrowHinge,narrowFold]);

const bindStart=set(lunge,{0:[206,104],1:[185,101],2:[153,109],3:[200,132],4:[148,103],
  5:[159,80],6:[147,103]});
const bindNarrow=set(bindStart,{0:[183,122],1:[166,111],2:[149,103],7:[177,129],8:[176,152],11:[188,157],
  9:[145,133],10:[146,152],12:[136,156],3:[185,136],4:[146,106],5:[153,89],6:[146,104]});
const birdBent=set(bindNarrow,{0:[159,39],1:[156,58],2:[152,106],3:[184,89],4:[149,107],
  5:[137,85],6:[147,106],7:[181,91],8:[197,113],11:[207,121],
  9:[146,131],10:[146,153],12:[136,157]});
const birdStraight=set(birdBent,{7:[186,88],8:[224,68],11:[238,65],
  3:[184,86],4:[149,107],5:[134,89],6:[147,106]});
const paradise=paired(heldSequence([bindStart,bindNarrow,birdBent,birdStraight]),1040);

const staffFloor:Point[]=[
  [231,144],[213,151],[158,151],[226,150],[222,135],[218,149],[215,136],
  [122,116],[103,152],[111,116],[90,152],[92,158],[79,157],[168,151],[192,151],
];
const staffBridge=set(staffFloor,{0:[232,146],1:[212,132],2:[164,87],3:[223,155],4:[239,149],
  5:[219,154],6:[230,149],7:[126,104],9:[116,104],13:[173,91],14:[196,108]});
const staffWide=set(staffBridge,{0:[232,142],1:[211,125],2:[151,80],
  3:[222,152],4:[237,153],5:[215,151],6:[230,152],
  7:[118,111],8:[78,152],11:[65,158],9:[108,111],10:[67,152],12:[54,157],
  13:[172,83],14:[194,100]});
const invertedStaff:Illustration={...hold([staffFloor,staffBridge,staffWide],1120),spine:[14,13]};

const reformer:Props=[
  [41,141,274,141],[41,149,274,149],[52,151,52,160],[262,151,262,160],
  [61,145,61,119],[49,145,49,115],[47,115,54,115],[58,119,65,119],
  [73,134,214,134],[74,137,210,137],[97,134,97,119],[103,134,103,119],
  [97,119,103,119],[222,145,237,147],[239,147,250,145],[251,145,263,147],
];
const footBar:Props=[...reformer,[251,143,255,101],[258,143,262,101],[248,101,265,101]];
const onBar:Point[]=[
  [79,124],[99,126],[154,127],[122,129],[147,132],[117,126],[139,127],
  [206,98],[249,98],[196,97],[244,96],[256,104],[250,103],[118,125],[138,126],
];
const peelPelvis=set(onBar,{2:[164,115],7:[211,94],9:[198,94],13:[119,125],14:[145,121]});
const fullPelvis=set(onBar,{2:[169,91],7:[210,87],9:[199,88],13:[120,110],14:[145,98]});
const pelvicLift:Illustration={...move([onBar,peelPelvis,fullPelvis,fullPelvis,peelPelvis],970,footBar),spine:[13,14]};

const strapsHeld:Point[]=[
  [79,124],[100,126],[158,129],[108,97],[112,70],[95,98],[91,70],
  [167,91],[202,91],[156,92],[192,94],[209,104],[200,107],[49,116],[61,120],
];
const strapsOut=set(strapsHeld,{3:[132,102],4:[156,86],5:[96,106],6:[67,95]});
const strapsLow=set(strapsHeld,{3:[125,128],4:[150,130],5:[123,122],6:[147,126]});
const strapsNext=set(strapsHeld,{3:[114,107],4:[134,86],5:[106,109],6:[126,90]});
const armStraps:Attachments=[["line",4,14],["line",6,13]];
const reformerCircles=move([strapsHeld,strapsOut,strapsLow,strapsNext,strapsHeld,strapsNext,strapsLow,strapsOut],800,reformer,armStraps);

const spineStart:Point[]=[
  [78,123],[98,126],[161,129],[126,130],[150,132],[118,126],[144,129],
  [195,103],[230,77],[190,102],[222,75],[237,70],[230,68],
  [48,116],[60,119],[121,127],[141,128],
];
const spineUpright=set(spineStart,{7:[164,85],8:[164,48],11:[171,35],9:[154,84],10:[154,47],12:[160,34]});
const spinePeel=set(spineUpright,{2:[136,100],7:[143,67],8:[144,32],11:[149,21],
  9:[129,67],10:[134,32],12:[138,20],15:[112,122],16:[127,109]});
const spineStack=set(spinePeel,{2:[108,80],7:[109,51],8:[108,19],11:[113,8],
  9:[102,49],10:[101,19],12:[104,8],15:[98,113],16:[103,98]});
const spineOpen=set(spineStack,{7:[126,51],8:[134,17],11:[140,8],
  9:[93,50],10:[77,20],12:[78,9]});
const spineRolled=set(spinePeel,{2:[147,104],7:[169,72],8:[188,48],11:[195,36],
  9:[135,70],10:[133,39],12:[136,29],15:[116,122],16:[134,113]});
const longSpine:Illustration={
  ...move([spineStart,spineUpright,spinePeel,spineStack,spineOpen,spineRolled,spineUpright,spineStart],
    1030,reformer,[["line",8,14],["line",10,13]]),
  spine:[15,16],
};

export const reformerMatIllustrations:Readonly<Record<string,Illustration>>={
  "10854":reformerCircles,
  "10853":longSpine,
  "10849":pelvicLift,
  "2851":legDoubleKick,
  "2855":legSingleKick,
  "2878":proneSwan,
  "2857":rocking,
  "2869":dive,
  "6098":proneCircle,
  "2870":swimming,
  "2880":fourSwim,
  "6024":frogAlternate,
  "6025":frogBoth,
  "5899":coverAt(revolvedChair,2),
  "5908":coverAt(revolvedHeadKnee,2),
  "5900":coverAt(revolvingLunge,3),
  "0957":coverAt(revolvingLunge,3),
  "5901":coverAt(revolvedTriangle,2),
  "0958":wideFold,
  "0960":standWideFold,
  "0959":standingFold,
  "0965":wideInward,
  "6302":invertedStaff,
  "6296":coverAt(paradise,3),
};
