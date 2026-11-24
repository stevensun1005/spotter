import type { Illustration, Point } from "./motion-data";

const join = (frames: Point[][], dynamic: NonNullable<Illustration["dynamic"]>): Illustration => {
  const last = frames.at(-1)!;
  return { frames:[...frames,last,last], dynamic, ms:1040, reference:true,
    props:[[46,159,267,159]] };
};
const feet: NonNullable<Illustration["dynamic"]> = [["foot-tip",8,11],["foot-tip",10,12]];
const set = (frame: Point[], replacements: Partial<Record<number,Point>>) =>
  frame.map((joint,index)=>replacements[index]??joint);

const strapped: Point[] = [
  [79,144],[99,151],[146,151],[127,137],[157,132],[122,141],[149,136],
  [181,133],[214,120],[179,152],[214,153],[216,109],[228,157],
];
const legRaised = set(strapped,{
  3:[125,121],4:[148,110],5:[122,126],6:[141,114],
  7:[155,111],8:[168,72],11:[158,65],
});
const reclinedRope = join([strapped,legRaised],[...feet,["line",4,11],["line",6,11]]);

const sittingOnBall: Point[] = [
  [129,51],[129,70],[126,116],[149,94],[167,113],[140,97],[155,113],
  [171,117],[174,152],[160,121],[159,152],[187,158],[172,156],
  [126,140],
];
const heelDown = set(sittingOnBall,{3:[155,98],4:[167,119],5:[147,99],6:[160,120],
  7:[172,133],8:[215,153],11:[218,141]});
const hinged = set(heelDown,{0:[171,72],1:[157,84],3:[164,103],5:[158,105]});
const ballHamstring = join([sittingOnBall,heelDown,hinged],[...feet,["stability-ball",13,0,0]]);

const makeMotion = (frames: Point[][], ms = 850): Illustration => ({
  frames, ms, dynamic: feet, reference:true,
});
const across = (frame: Point[]) => set(frame,{
  3:frame[5],4:frame[6],5:frame[3],6:frame[4],
  7:frame[9],8:frame[10],11:frame[12],9:frame[7],10:frame[8],12:frame[11],
});
const mirrored = (frame: Point[]) => frame.map(([x,y]):Point=>[320-x,y]);

const deadBugReady: Point[] = [
  [81,145],[101,150],[151,151],[105,113],[108,83],[96,114],[96,84],
  [149,104],[186,103],[137,103],[174,103],[195,110],[183,110],
];
const deadBugLower = set(deadBugReady,{
  3:[87,130],4:[77,107],9:[168,136],10:[198,126],12:[208,131],
});
const deadBugReach = set(deadBugReady,{
  3:[76,144],4:[53,146],9:[184,149],10:[225,148],12:[235,142],
});
const deadBug = makeMotion([deadBugReady,deadBugLower,deadBugReach,deadBugReach,deadBugLower,
  deadBugReady,across(deadBugLower),across(deadBugReach),across(deadBugReach),across(deadBugLower)],750);

const crabSupport: Point[] = [
  [113,91],[123,109],[159,132],[109,131],[102,155],[99,133],[89,155],
  [197,115],[213,153],[185,118],[201,152],[226,157],[212,156],
];
const crabSit = set(crabSupport,{0:[132,102],1:[137,118],2:[162,152],3:[115,136],5:[106,137]});
const crabReach = set(crabSupport,{
  0:[135,79],1:[130,106],2:[161,124],3:[156,94],4:[180,82],
  9:[170,101],10:[181,76],12:[185,81],
});
const crabToe = makeMotion([crabReach,crabSupport,crabSit,crabSupport,across(crabReach),crabSupport],860);

const wristReady: Point[] = [
  [160,39],[160,57],[160,111],[185,76],[208,78],[137,76],[116,78],
  [171,131],[180,153],[149,131],[139,153],[185,158],[134,156],[216,78],[108,78],
];
const wristReach = set(wristReady,{
  3:[199,62],4:[236,62],5:[164,79],6:[217,67],13:[247,62],14:[228,63],
});
const wristPulled = set(wristReach,{4:[236,64],6:[230,69],13:[233,76],14:[233,75]});
const wristPull: Illustration = {...makeMotion([
  wristPulled,wristPulled,wristReach,wristReady,
  mirrored(wristReach),mirrored(wristPulled),mirrored(wristPulled),mirrored(wristReach),wristReady,
],920),dynamic:[...feet,["palm-down",4,13],["palm-down",6,14]]};

const standingToe: Point[] = [
  [139,42],[138,59],[138,107],[144,84],[147,110],[128,83],[130,109],
  [146,131],[148,152],[134,131],[136,152],[162,158],[150,157],
];
const bendingToe = set(standingToe,{0:[181,95],1:[161,102],2:[129,102],
  3:[165,122],4:[158,139],5:[154,119],6:[149,134]});
const touchToe = set(standingToe,{0:[163,145],1:[154,130],2:[130,98],
  3:[162,144],4:[161,156],5:[152,144],6:[148,155]});
const basicToeTouch = makeMotion([touchToe,touchToe,bendingToe,standingToe,bendingToe],1010);

const openSupine: Point[] = [
  [160,48],[160,67],[160,111],[194,67],[223,68],[127,67],[100,68],
  [165,131],[172,151],[155,131],[148,151],[175,156],[145,156],
];
const kneesJoined = set(openSupine,{7:[164,127],8:[164,147],9:[156,127],10:[156,147],11:[166,155],12:[154,155]});
const kneesSide = set(kneesJoined,{7:[197,120],8:[180,142],9:[189,125],10:[174,145],11:[181,149],12:[176,151]});
const floorTwist: Illustration = {...makeMotion([
  kneesSide,kneesSide,kneesJoined,openSupine,mirrored(kneesJoined),mirrored(kneesSide),
  mirrored(kneesSide),kneesJoined,
],900),topView:true,props:[[120,32,200,32],[200,32,200,165],[200,165,120,165],[120,165,120,32]]};

const inchStand: Point[] = [
  [63,41],[62,59],[60,107],[69,87],[69,111],[55,84],[54,110],
  [65,131],[66,154],[55,132],[55,153],[79,158],[67,157],
];
const inchFold = set(inchStand,{0:[90,126],1:[77,113],2:[61,97],
  3:[91,137],4:[97,154],5:[81,137],6:[87,153]});
const inchWalkOne = set(inchFold,{
  0:[107,117],1:[90,104],2:[63,87],3:[117,132],4:[136,152],5:[99,134],6:[98,154],
});
const inchWalkTwo = set(inchFold,{
  0:[146,101],1:[128,106],2:[96,91],3:[130,132],4:[137,154],5:[153,125],6:[168,151],
});
const inchPlank = set(inchFold,{
  0:[183,93],1:[165,108],2:[118,126],3:[172,132],4:[178,154],5:[159,130],6:[165,154],
  7:[92,138],8:[66,150],11:[72,158],9:[84,138],10:[56,150],12:[64,157],
});
const inchFootOne = set(inchPlank,{
  0:[180,103],1:[161,112],2:[119,95],7:[112,127],8:[101,149],11:[111,156],
  9:[88,122],10:[55,150],12:[62,157],
});
const inchFootTwo = set(inchFootOne,{
  0:[171,112],1:[154,111],2:[126,81],7:[111,125],8:[100,151],11:[111,158],
  9:[118,118],10:[112,146],12:[125,154],
});
const inchFeetNear = set(inchFootTwo,{
  0:[165,124],1:[151,109],2:[135,81],7:[128,118],8:[121,151],11:[134,158],
  9:[123,116],10:[116,150],12:[128,158],
});
const inchContinue = set(inchFeetNear,{
  0:[183,110],1:[166,105],2:[135,82],3:[192,128],4:[212,153],5:[161,132],6:[165,154],
});
const inchwormForward = {...makeMotion([
  inchStand,inchFold,inchWalkOne,inchWalkTwo,inchPlank,inchFootOne,inchFootTwo,inchFeetNear,inchContinue,
],710),cutOnLoop:true};

const straddle:Point[] = [
  [160,65],[160,85],[160,140],[179,110],[183,138],[140,110],[135,138],
  [204,142],[244,153],[116,142],[76,153],[248,140],[72,140],
];
const straddleHinge=set(straddle,{
  0:[160,111],1:[160,104],3:[176,125],4:[179,146],5:[143,125],6:[141,146],
});
const straddleReach=set(straddleHinge,{
  0:[160,143],1:[160,127],3:[173,140],4:[184,154],5:[146,140],6:[135,154],
});
const centeredStraddle=makeMotion([straddleReach,straddleReach,straddleHinge,straddle,straddleHinge],1020);

export const legacyMobilityCorrections: Readonly<Record<string,Illustration>> = {
  "1560": ballHamstring,
  "1582": reclinedRope,
  "0276": deadBug,
  "0721": wristPull,
  "1468": crabToe,
  "3212": basicToeTouch,
  "3639": floorTwist,
  "3698": inchwormForward,
  "1587": centeredStraddle,
};
