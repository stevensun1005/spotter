import type { Illustration,Point } from "./motion-data";

type Props=NonNullable<Illustration["props"]>;
type Links=NonNullable<Illustration["dynamic"]>;
type Grip="ez"|"rope"|"single-rope"|"straight"|"wide"|"reverse";
type Pose={body:Point[];arms:Point[];legs:Point[]};
type Cable={at:Point; grip:Grip; props?:Props; far?:Point; compact?:boolean};
const feet:Links=[["foot-tip",8,11],["foot-tip",10,12]];
const offset=([x,y]:Point,dx:number,dy:number):Point=>[x+dx,y+dy];
const middle=([a,b]:Point,[c,d]:Point):Point=>[(a+c)/2,(b+d)/2];

function tower([x,y]:Point,compact=false):Props {
  const post=x<160?x-12:x+12;
  const top=compact?71:22;
  return [[post,top,post,154],[post+8,top,post+8,154],[post,top,post+8,top],[post-13,156,post+19,156],
    [post,y,x,y],[x,y-2,x,y+2],[post+2,128,post+7,128],[post+2,137,post+7,137],[post+2,145,post+7,145]];
}
function curl(start:Pose,end:Pose,cable:Cable):Illustration {
  const {at,grip,props=[],far,compact}=cable;
  const isSingle=grip==="single-rope"||grip==="reverse";
  const isRope=grip==="rope"||grip==="single-rope";
  function pose({body,arms,legs}:Pose){
    const near=arms[1],farHand=arms[3];
    const mid=isSingle?near:middle(near,farHand);
    const deltaX=at[0]-mid[0],deltaY=at[1]-mid[1];
    const length=Math.max(1,Math.hypot(deltaX,deltaY));
    const joint=isRope?offset(mid,deltaX*12/length,deltaY*12/length):mid;
    return [...body,...arms,...legs,joint,offset(near,4,-2),offset(farHand,4,-2),
      offset(near,-7,0),offset(farHand,7,0),offset(near,-3,4),offset(joint,6,5)];
  }
  const selectedGrip=isRope?"thumb-up":grip==="reverse"?"palm-down":"palm-up";
  const handles:Links=far?[["cable",4,...at],["cable",6,...far]]:[["cable",13,...at]];
  handles.push([selectedGrip,4,14]);
  if(!isSingle) handles.push([selectedGrip,6,15]);
  if(grip==="rope") handles.push(["line",4,13],["line",6,13],["pad",4,0,0],["pad",6,0,0]);
  else if(grip==="single-rope") handles.push(["line",4,13],["line",13,19],["pad",4,0,0],["pad",19,0,0]);
  else if(grip==="reverse") handles.push(["line",4,18],["pad",4,0,0]);
  else if(far) handles.push(["pad",4,0,0],["pad",6,0,0]);
  else handles.push([grip==="ez"||grip==="wide"?"ez-bar":"bar",16,17]);
  return {frames:[pose(start),pose(end),pose(end),pose(start)],ms:760,reference:true,
    props:[...tower(at,compact),...(far?tower(far):[]),...props],dynamic:[...feet,...handles]};
}

const body:Point[]=[[149,46],[147,63],[143,106]];
const feetOnFloor:Point[]=[[155,126],[156,151],[139,128],[137,151],[169,156],[150,156]];
const startArms:Point[]=[[148,90],[156,117],[140,90],[144,116]];
const endArms:Point[]=[[148,90],[165,71],[140,90],[151,71]];
const standing=(arms:Point[],torso=body,legs=feetOnFloor):Pose=>({body:torso,arms,legs});
const regular=(grip:Grip,compact=false)=>curl(standing(startArms),standing(endArms),
  {at:compact?[222,151]:[222,135],grip,compact,props:compact?[[220,152,234,111],[222,151,199,155]]:[]});

const inclinedBench:Props=[[102,66,167,119],[108,69,107,150],[163,115,164,151],[97,154,180,154]];
const inclinedBody:Point[]=[[104,59],[117,76],[155,111]];
const inclinedLegs:Point[]=[[174,123],[180,151],[162,126],[166,151],[191,157],[178,156]];
const inclineCurl=curl(
  standing([[136,98],[158,114],[126,95],[146,109]],inclinedBody,inclinedLegs),
  standing([[136,98],[142,74],[126,95],[130,72]],inclinedBody,inclinedLegs),
  {at:[232,142],grip:"straight",props:inclinedBench});

const flat:Props=[[107,116,216,116],[117,116,117,153],[206,116,206,153],[105,155,219,155]];
const flatBody:Point[]=[[119,103],[136,105],[182,107]];
const flatLegs:Point[]=[[209,111],[215,150],[200,112],[204,150],[225,156],[214,156]];
const flatCurl=curl(
  standing([[136,64],[139,38],[147,64],[150,38]],flatBody,flatLegs),
  standing([[136,64],[116,75],[147,64],[127,75]],flatBody,flatLegs),
  {at:[139,21],grip:"wide",props:[...flat,[132,21,88,21],[88,21,88,154]]});

const preacher:Props=[[102,123,143,123],[110,125,114,153],[136,125,138,153],[100,155,183,155],
  [135,77,172,103],[134,80,171,106],[170,106,175,153]];
const preacherBody:Point[]=[[132,48],[130,65],[128,116]];
const preacherLegs:Point[]=[[159,121],[158,150],[150,123],[146,151],[171,155],[158,155]];
const preacherCurl=(grip:"reverse"|"single-rope")=>curl(
  standing([[163,98],[181,121],[151,92],[143,108]],preacherBody,preacherLegs),
  standing([[163,98],[158,71],[151,92],[143,108]],preacherBody,preacherLegs),
  {at:[224,145],grip,props:preacher});

const seat:Props=[[91,119,171,119],[100,119,100,154],[160,119,160,153],[88,155,180,155]];
const seatedBody:Point[]=[[144,59],[141,76],[136,111]];
const seatLegs:Point[]=[[160,120],[162,151],[153,118],[152,151],[173,156],[161,156]];
const pulldownCurl=curl(
  standing([[143,54],[145,28],[155,54],[158,26]],seatedBody,seatLegs),
  standing([[143,54],[132,73],[155,54],[149,72]],seatedBody,seatLegs),
  {at:[148,16],grip:"wide",props:[...seat,[146,17,94,17],[94,17,94,152]]});

const leanedBody:Point[]=[[137,51],[145,66],[151,108]];
const stagger:Point[]=[[160,130],[161,151],[138,129],[133,151],[175,157],[123,155]];
const highRope=curl(
  standing([[167,54],[190,37],[154,54],[181,37]],leanedBody,stagger),
  standing([[167,54],[152,46],[154,54],[143,46]],leanedBody,stagger),
  {at:[223,24],grip:"rope"});

const frontal:Point[]=[[160,47],[160,63],[158,107]];
const wideLegs:Point[]=[[172,129],[176,151],[145,129],[143,151],[189,156],[130,156]];
const innerCurl=curl(
  standing([[128,65],[99,65],[189,65],[218,65]],frontal,wideLegs),
  standing([[128,65],[147,49],[189,65],[171,49]],frontal,wideLegs),
  {at:[68,37],far:[251,37],grip:"straight",props:[[57,22,262,22]]});

const holdTower:Point[]=[[174,66],[198,65]];
const braceCurl=curl(
  standing([[147,91],[151,119],...holdTower]),
  standing([[147,91],[163,70],...holdTower]),
  {at:[202,141],grip:"single-rope",props:[[198,24,198,155],[196,25,227,25]]});

const wristBody:Point[]=[[163,45],[158,63],[155,106]];
const wristStart:Pose=standing([[150,90],[141,114],[149,89],[133,113]],wristBody);
const wristEnd:Pose=standing([[150,90],[139,110],[149,89],[132,109]],wristBody);
const wristCurl=curl(wristStart,wristEnd,{at:[99,143],grip:"straight"});
wristCurl.dynamic=[
  ...(wristCurl.dynamic??[]).filter(([kind])=>kind!=="palm-up"),
  ["palm-down",4,18],["palm-down",6,15],
];

export const cableCurlSourceCorrections:Record<string,Illustration>={
  "1607":regular("ez"),
  "0166":regular("rope"),
  "5703":inclineCurl,
  "0182":flatCurl,
  "1635":preacherCurl("reverse"),
  "1638":pulldownCurl,
  "1640":preacherCurl("single-rope"),
  "11261":regular("rope",true),
  "3068":highRope,
  "0229":innerCurl,
  "5370":braceCurl,
  "0224":wristCurl,
};
