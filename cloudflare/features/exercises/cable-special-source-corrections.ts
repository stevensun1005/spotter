import type { Illustration,Point } from "./motion-data";

type Props=NonNullable<Illustration["props"]>;
function exercise(first:Point[],middle:Point[],last:Point[],anchor:Point):Illustration {
  const [x,y]=anchor;
  const post=x<160?x-11:x+11;
  const props:Props=[[post,22,post,153],[post+8,22,post+8,153],[post,22,post+8,22],
    [post-9,156,post+18,156],[post,y,x,y],[x,y-2,x,y+2],[post+2,127,post+7,127],
    [post+2,135,post+7,135],[post+2,143,post+7,143]];
  return {frames:[first,middle,last,last,middle,first],ms:560,props,reference:true,
    shoulders:[14,15],dynamic:[["foot-tip",8,11],["foot-tip",10,12],["cable",13,x,y],["pad",13,0,0]]};
}
const stable:Point[]=[[178,129],[183,152],[146,130],[143,152],[195,156],[129,156]];
const transfer:Point[]=[[174,129],[183,152],[149,130],[144,152],[194,156],[137,156]];
const opening:Point[]=[
  [160,46],[160,64],[160,107],[181,92],[206,117],[174,93],[201,119],
  ...stable,[204,117],[168,64],[151,67],
];
const center:Point[]=[
  [159,46],[158,63],[160,107],[166,76],[170,89],[156,77],[162,92],
  ...stable,[166,91],[168,62],[152,69],
];
const end:Point[]=[
  [151,46],[155,64],[160,107],[134,49],[115,31],[147,54],[122,36],
  ...transfer,[118,34],[146,61],[164,67],
];
const lift=exercise(opening,center,end,[241,139]);

const startTurn:Point[]=[
  [146,48],[149,65],[149,108],[161,77],[147,61],[135,79],[139,58],
  ...stable,[142,59],[157,65],[141,66],
];
const quarter:Point[]=[
  [166,54],[161,70],[149,108],[173,79],[160,62],[145,80],[154,64],
  ...transfer,[158,62],[172,71],[154,70],
];
const endTurn:Point[]=[
  [199,90],[180,89],[149,108],[188,112],[197,101],[172,109],[188,97],
  ...transfer,[192,101],[185,91],[173,95],
];
const torsoTurn=exercise(startTurn,quarter,endTurn,[78,58]);

const firstDrive:Point[]=[
  [158,45],[158,63],[155,106],[179,69],[150,65],[135,88],[146,102],
  ...stable,[150,65],[171,67],[145,65],
];
const driveMiddle:Point[]=[
  [159,45],[159,63],[155,106],[188,68],[187,65],[135,88],[146,102],
  ...stable,[187,65],[172,66],[145,66],
];
const driveEnd:Point[]=[
  [159,45],[159,63],[155,106],[187,68],[218,69],[135,88],[146,102],
  ...stable,[218,69],[172,66],[145,66],
];
const drive=exercise(firstDrive,driveMiddle,driveEnd,[75,65]);

export const cableSpecialSourceCorrections:Record<string,Illustration>={
  "0230":lift,
  "0174":torsoTurn,
  "0204":drive,
};
