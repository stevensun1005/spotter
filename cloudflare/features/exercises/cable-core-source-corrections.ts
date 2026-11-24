import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;
type Pose = { body:Point[]; arms:Point[]; legs:Point[]; grips:Point[] };

const hooks:Links=[["foot-tip",8,11],["foot-tip",10,12]];
function column(x:number,y:number,high=false):Props {
  const outlet=x+15;
  const top=high?y:24;
  return [[x-6,top,x-6,151],[x+6,top,x+6,151],[x-6,top,outlet,top],
    [x-14,155,x+17,155],[x-4,126,x+4,126],[x-4,134,x+4,134],[x-4,142,x+4,142],
    [x+6,y,outlet,y],[outlet,y-2,outlet,y+2]];
}
function motion(open:Pose, loaded:Pose, props:Props, lines:Links):Illustration {
  const join=({body,arms,legs,grips}:Pose)=>[...body,...arms,...legs,...grips];
  return {frames:[join(open),join(loaded),join(loaded),join(open)],ms:780,props,dynamic:[...hooks,...lines],reference:true};
}

const reverseBody:Point[]=[[226,145],[207,148],[167,151]];
const reverseArms:Point[]=[[190,153],[159,156],[190,149],[159,152]];
const reverseStart:Pose={
  body:reverseBody,arms:reverseArms,
  legs:[[150,119],[119,126],[146,117],[112,121],[114,115],[107,110]],
  grips:[[119,123],[112,119],[114,123]],
};
const reverseEnd:Pose={
  body:[[226,145],[207,148],[181,131]],arms:reverseArms,
  legs:[[208,111],[184,94],[201,104],[179,87],[195,90],[190,83]],
  grips:[[184,93],[179,89],[180,93]],
};
const reverseCrunch=motion(reverseStart,reverseEnd,[...column(74,139),[145,158,237,158]],
  [["cable",15,89,139],["line",15,13],["line",15,14],["pad",13,0,0],["pad",14,0,0]]);

const ball:Props=Array.from({length:18},(_,i)=>{
  const a=i*Math.PI/9,b=(i+1)*Math.PI/9;
  return [158+29*Math.cos(a),124+29*Math.sin(a),158+29*Math.cos(b),124+29*Math.sin(b)];
});
const ballLegs:Point[]=[[194,117],[196,151],[190,121],[182,151],[209,156],[192,156]];
const ballOpen:Pose={
  body:[[127,86],[142,91],[175,111]],
  arms:[[137,60],[139,37],[151,62],[147,37]],legs:ballLegs,
  grips:[[143,34],[135,88],[150,95]],
};
const ballTurn:Pose={
  body:[[123,84],[141,91],[175,111]],
  arms:[[117,70],[95,57],[116,87],[96,65]],legs:ballLegs,
  grips:[[94,61],[132,82],[143,104]],
};
const russianBall=motion(ballOpen,ballTurn,[...ball,...column(79,27,true)],
  [["cable",13,94,27],["pad",13,0,0]]);
russianBall.shoulders=[14,15];

const frontLegs:Point[]=[[170,130],[174,151],[148,130],[141,152],[185,156],[130,156]];
const sideStart:Pose={
  body:[[148,51],[154,67],[159,107]],
  arms:[[143,89],[139,109],[174,83],[164,102]],legs:frontLegs,grips:[[139,112]],
};
const sideEnd:Pose={
  body:[[171,49],[166,66],[159,107]],
  arms:[[151,86],[147,103],[179,83],[165,101]],legs:frontLegs,grips:[[147,106]],
};
const standingSide=motion(sideStart,sideEnd,column(93,142),[["cable",13,108,142],["pad",13,0,0]]);

const crunchLegs:Point[]=[[167,119],[167,151],[148,121],[143,151],[181,156],[155,156]];
const curlStart:Pose={
  body:[[161,43],[156,59],[153,100]],
  arms:[[179,57],[172,38],[173,60],[166,37]],legs:crunchLegs,grips:[[170,36],[155,36],[184,37],[154,80]],
};
const curlEnd:Pose={
  body:[[194,77],[181,85],[153,100]],
  arms:[[191,110],[217,102],[178,106],[208,97]],legs:crunchLegs,grips:[[213,98],[196,94],[229,101],[165,87]],
};
const barCrunch=motion(curlStart,curlEnd,column(123,22,true),
  [["cable",13,138,22],["ez-bar",14,15]]);
barCrunch.spine=[16];
const ropeStart:Pose={
  body:[[160,43],[155,60],[151,100]],
  arms:[[176,59],[164,37],[166,62],[153,40]],legs:crunchLegs,grips:[[157,27],[153,81]],
};
const ropeEnd:Pose={
  body:[[186,99],[177,86],[151,102]],
  arms:[[175,114],[192,114],[170,106],[184,107]],legs:crunchLegs,grips:[[181,100],[161,87]],
};
const ropeCrunch=motion(ropeStart,ropeEnd,column(127,23,true),
  [["cable",13,142,23],["line",4,13],["line",6,13],["pad",4,0,0],["pad",6,0,0]]);
ropeCrunch.spine=[14];

const horizontalStart:Pose={
  body:[[151,49],[151,67],[151,107]],
  arms:[[132,76],[108,78],[141,80],[114,81]],legs:frontLegs,grips:[[111,79],[142,70],[159,73]],
};
const horizontalEnd:Pose={
  body:[[160,49],[156,66],[151,107]],
  arms:[[173,77],[201,78],[163,80],[194,82]],legs:frontLegs,grips:[[197,80],[166,70],[144,73]],
};
const horizontalTurn=motion(horizontalStart,horizontalEnd,column(69,77),[["cable",13,84,77],["pad",13,0,0]]);
horizontalTurn.shoulders=[14,15];
const diagonalStart:Pose={
  ...horizontalStart,body:[[147,51],[152,69],[152,107]],
  arms:[[128,59],[106,42],[136,62],[112,45]],grips:[[109,44],[143,66],[162,71]],
};
const diagonalEnd:Pose={
  ...horizontalEnd,body:[[171,63],[166,78],[152,107]],
  arms:[[181,95],[197,112],[174,99],[192,115]],grips:[[195,113],[178,81],[156,83]],
};
const diagonalTurn=motion(diagonalStart,diagonalEnd,column(69,22,true),[["cable",13,84,22],["pad",13,0,0]]);
diagonalTurn.shoulders=[14,15];

const splitLegs:Point[]=[[162,122],[166,151],[112,129],[99,151],[179,157],[112,156]];
const drawOpen:Pose={
  body:[[175,66],[157,76],[124,99]],legs:splitLegs,
  arms:[[184,83],[211,84],[163,101],[161,121]],grips:[[211,84]],
};
const drawClosed:Pose={
  body:[[165,64],[147,73],[124,99]],legs:splitLegs,
  arms:[[129,65],[138,86],[163,101],[161,121]],grips:[[138,86]],
};
const twistingDraw=motion(drawOpen,drawClosed,column(244,84),[["cable",13,259,84],["pad",13,0,0]]);

const seatLegs:Point[]=[[178,129],[187,153],[147,129],[141,153],[200,158],[128,158]];
const seatOpen:Pose={
  body:[[151,53],[153,70],[157,116]],legs:seatLegs,
  arms:[[135,77],[109,78],[144,84],[115,81]],grips:[[110,79],[145,70],[162,75]],
};
const seatTurn:Pose={
  body:[[166,52],[159,68],[157,116]],legs:seatLegs,
  arms:[[184,76],[207,78],[171,83],[201,84]],grips:[[205,80],[171,69],[149,74]],
};
const seatedTwist=motion(seatOpen,seatTurn,
  [...column(76,79),[141,122,179,122],[146,123,144,153],[176,123,185,154],[133,155,196,155],
    [147,65,146,116],[144,67,135,67],[138,69,138,100],[138,100,145,100]],
  [["cable",13,91,79],["pad",13,0,0]]);
seatedTwist.shoulders=[14,15];

const bosuLegs:Point[]=[[189,125],[205,151],[177,127],[184,153],[216,157],[197,158]];
const bosuOpen:Pose={
  body:[[137,94],[145,107],[165,139]],legs:bosuLegs,
  arms:[[147,129],[164,141],[164,129],[172,137]],grips:[[164,141],[172,138],[153,121]],
};
const bosuCrunch:Pose={
  body:[[147,90],[151,106],[165,139]],legs:bosuLegs,
  arms:[[154,123],[168,137],[171,131],[175,134]],grips:[[168,137],[175,134],[161,121]],
};
const halfDome:Props=Array.from({length:12},(_,i)=>{
  const a=Math.PI*i/12,b=Math.PI*(i+1)/12;
  return [161+29*Math.cos(a),155-18*Math.sin(a),161+29*Math.cos(b),155-18*Math.sin(b)];
});
const bosuSideCrunch=motion(bosuOpen,bosuCrunch,
  [...column(77,146),...column(106,136),...halfDome,[131,155,191,155]],
  [["cable",13,92,146],["cable",14,121,136],["pad",13,0,0],["pad",14,0,0]]);
bosuSideCrunch.spine=[15];

export const cableCoreSourceCorrections:Record<string,Illustration>={
  "0873":reverseCrunch,
  "0211":russianBall,
  "0222":standingSide,
  "0226":barCrunch,
  "0874":ropeCrunch,
  "0243":horizontalTurn,
  "0862":diagonalTurn,
  "0244":twistingDraw,
  "2399":seatedTwist,
  "0221":bosuSideCrunch,
};
