import type { Illustration,Point } from "./motion-data";

type Rig = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;
const feet:Links=[["foot-tip",8,11],["foot-tip",10,12]];
const row=(start:Point[],end:Point[],props:Rig,dynamic:Links):Illustration=>({
  frames:[start,end,end,start],props,dynamic:[...feet,...dynamic],reference:true,ms:820,
});
function tower(x:number,y:number):Rig {
  return [[x,22,x,154],[x-10,22,x-10,154],[x-10,22,x,22],[x-15,157,x+7,157],
    [x-7,125,x-3,125],[x-7,136,x-3,136],[x-7,145,x-3,145],[x-2,y,x+2,y]];
}

const frame=(body:Point[],arms:Point[],legs:Point[],tool:Point[]=[])=>[...body,...arms,...legs,...tool];
const legSide:Point[]=[[155,125],[151,151],[146,125],[139,151],[162,157],[151,157]];
const tall:Point[]=[[164,45],[160,63],[151,104]];
const ropeRaise=row(
  frame(tall,[[164,89],[166,111],[156,88],[154,111]],legSide,[[154,123],[164,110]]),
  frame(tall,[[190,68],[210,69],[182,66],[204,64]],legSide,[[194,74],[212,67]]),
  tower(101,143),
  [["cable",13,101,143],["line",4,13],["line",6,13],["pad",4,0,0],["pad",6,0,0]]);

const front:Point[]=[[160,44],[159,62],[157,105]];
const legFront:Point[]=[[167,131],[167,152],[146,131],[145,152],[178,157],[133,156]];
const twinRaise=row(
  frame(tall,[[165,88],[166,113],[152,87],[154,110]],legFront,[[162,64],[150,66]]),
  frame(tall,[[195,65],[217,65],[181,61],[205,61]],legFront,[[162,64],[150,66]]),
  [...tower(81,143),...tower(244,143),[76,22,244,22]],
  [["cable",4,81,143],["cable",6,244,143],["pad",4,0,0],["pad",6,0,0]]);
twinRaise.shoulders=[13,14];

const shrugBench:Rig=[[111,115,205,115],[121,115,121,151],[197,115,197,151],[111,154,205,154]];
const shrugFeet:Point[]=[[219,118],[219,150],[207,118],[209,149],[231,156],[221,154]];
const lyingShrug=row(
  frame([[123,105],[146,102],[185,106]],[[161,106],[184,112],[158,104],[178,106]],shrugFeet,[[182,110]]),
  frame([[123,105],[137,101],[185,106]],[[151,105],[177,112],[151,102],[174,106]],shrugFeet,[[177,110]]),
  [...shrugBench,...tower(237,108)],
  [["cable",13,237,108],["bar",4,6]]);

const latBench:Rig=[[142,125,188,125],[148,125,150,154],[180,125,183,153],[137,156,192,156],
  [146,110,181,110],[145,113,182,113],[182,109,182,124]];
const seatLegs:Point[]=[[172,122],[176,151],[155,122],[151,150],[188,156],[138,155]];
const above:Point[]=[[147,42],[133,25],[180,41],[193,25]];
const scapDepress=row(
  frame([[160,58],[160,71],[164,116]],above,seatLegs,[[162,22],[149,68],[172,68]]),
  frame([[160,58],[160,76],[164,116]],[[145,44],[134,29],[182,44],[192,29]],seatLegs,[[163,26],[150,78],[171,78]]),
  [...tower(107,21),[102,21,161,21],...latBench],
  [["cable",13,162,18],["bar",4,6]]);
scapDepress.shoulders=[14,15];

const cuffStart=frame(front,[[165,87],[187,87],[146,93],[144,111]],legFront,[[187,87]]);
const cuffEnd=frame(front,[[165,87],[126,84],[146,93],[144,111]],legFront,[[126,84]]);
const external=row(cuffStart,cuffEnd,[...tower(232,87),...tower(254,87),[232,22,254,22]],
  [["cable",13,232,87],["pad",13,0,0]]);

const pulling:Point[]=[[155,51],[152,69],[141,108]];
const pullOpen=frame(pulling,[[178,65],[206,55],[174,69],[196,57]],legSide,[[216,51],[211,54],[201,56]]);
const pullClose=frame(pulling,[[130,52],[151,41],[148,50],[166,44]],legSide,[[176,44],[156,40],[171,43]]);
const facePull=row(pullOpen,pullClose,[...tower(248,35),...tower(271,35),[248,22,271,22]],
  [["cable",13,248,35],["line",4,13],["line",6,13],["pad",4,0,0],["pad",6,0,0],
    ["palm-up",4,14],["palm-up",6,15]]);

export const cableShoulderSourceCorrections:Record<string,Illustration>={
  "6543":ropeRaise,
  "2515":twinRaise,
  "4226":lyingShrug,
  "7155":scapDepress,
  "0235":external,
  "7744":facePull,
};
