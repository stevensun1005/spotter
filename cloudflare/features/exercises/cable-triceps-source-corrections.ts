import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;
type Pose = {body:Point[];arms:Point[];legs:Point[]};
type Grip = "d" | "paired-d" | "rope-one" | "rope" | "v" | "ez-up" | "ez-down" | "straight";
type Rig = {anchor:Point;props?:Props;farAnchor?:Point;grip:Grip};

const feet:Links=[["foot-tip",8,11],["foot-tip",10,12]];
const center=([ax,ay]:Point,[bx,by]:Point):Point=>[(ax+bx)/2,(ay+by)/2];
const at=([x,y]:Point,dx:number,dy:number):Point=>[x+dx,y+dy];
const palmsUp=(g:Grip)=>g==="ez-up";
const twoHands=(g:Grip)=>g!=="d"&&g!=="rope-one";

function pulley([x,y]:Point):Props {
  const upright=x>160?x+18:x-18;
  return [[upright,25,upright,152],[upright+8,25,upright+8,152],[upright,25,upright+8,25],
    [upright-8,155,upright+18,155],[upright+2,124,upright+7,124],[upright+2,133,upright+7,133],
    [upright+2,143,upright+7,143],[upright,y,x,y],[x,y-2,x,y+2]];
}

function movement(first:Pose,last:Pose,rig:Rig):Illustration {
  const {anchor,grip,farAnchor}=rig;
  const format=({body,arms,legs}:Pose)=>{
    const near=arms[1],far=arms[3];
    const middle=twoHands(grip)?center(near,far):near;
    const dx=anchor[0]-middle[0],dy=anchor[1]-middle[1],distance=Math.max(1,Math.hypot(dx,dy));
    const offset=grip.startsWith("rope")?13:grip==="v"?7:0;
    const joint=at(middle,dx*offset/distance,dy*offset/distance);
    return [...body,...arms,...legs,joint,at(near,5,-1),at(far,5,-1),
      at(near,-6,0),at(far,6,0),at(near,-4,-3),at(near,-8,2)];
  };
  const links:Links=farAnchor?[["cable",4,...anchor],["cable",6,...farAnchor]]:[["cable",13,...anchor]];
  const grasp=palmsUp(grip)?"palm-up":grip==="ez-down"||grip==="straight"?"palm-down":"thumb-up";
  links.push([grasp,4,14]);
  if(twoHands(grip)) links.push([grasp,6,15]);
  switch(grip){
    case "rope": links.push(["line",4,13],["line",6,13],["pad",4,0,0],["pad",6,0,0]); break;
    case "rope-one": links.push(["line",4,13],["line",13,19],["pad",4,0,0],["pad",19,0,0]); break;
    case "v": links.push(["line",16,13],["line",17,13]); break;
    case "ez-up":
    case "ez-down": links.push(["ez-bar",16,17]); break;
    case "straight": links.push(["bar",16,17]); break;
    case "d": links.push(["line",4,18],["line",18,19],["line",19,4]); break;
    case "paired-d": links.push(["pad",4,0,0],["pad",6,0,0]); break;
  }
  const open=format(first),closed=format(last);
  return {frames:[open,closed,closed,open],ms:755,reference:true,
    props:[...pulley(anchor),...(farAnchor?pulley(farAnchor):[]),...(rig.props??[])],dynamic:[...feet,...links]};
}

const upright:Point[]=[[148,43],[146,62],[142,105]];
const standLegs:Point[]=[[149,126],[147,151],[139,127],[133,150],[159,156],[143,155]];
const hipsHands:Point[]=[[127,90],[139,105]];
const armDown:Point[]=[[151,93],[157,122]];
const armBent:Point[]=[[151,93],[172,78]];
const bilateralBent:Point[]=[...armBent,[141,92],[159,78]];
const fullDown:Point[]=[...armDown,[141,92],[145,122]];
const stand=(arms:Point[],body=upright,legs=standLegs):Pose=>({body,arms,legs});
const uprightPush=(grip:Grip, props?:Props)=>movement(stand(bilateralBent),stand(fullDown),{anchor:[214,27],grip,props});
const singlePush=(start:Point[],end:Point[],anchor:Point,grip:Grip="d",props?:Props)=>
  movement(stand(start),stand(end),{anchor,grip,props});

const pressAcrossStart:Pose={
  body:[[142,44],[144,62],[146,105]],legs:[[160,129],[164,151],[136,128],[133,151],[175,156],[122,156]],
  arms:[[128,91],[147,75],[163,88],[156,103]],
};
const pressAcrossFinish:Pose={...pressAcrossStart,arms:[[128,91],[133,119],[163,88],[156,103]]};
const pressAcross=movement(pressAcrossStart,pressAcrossFinish,{anchor:[216,28],grip:"d"});
const ropeSupportArms:Point[]=[[173,70],[203,70]];
const leaning:Point[]=[[160,45],[153,62],[141,105]];
const ropeBrace=movement(
  stand([[151,93],[169,77],...ropeSupportArms],leaning),
  stand([[151,93],[156,121],...ropeSupportArms],leaning),
  {anchor:[201,25],grip:"rope-one",props:[[203,26,203,153]]});
const oneArmOverhand=singlePush([...armBent,...hipsHands],[...armDown,...hipsHands],[204,25]);
const oneArmAtHip=singlePush([[151,92],[173,68],...hipsHands],[...armDown,...hipsHands],[217,25]);
const chestPad:Props=[[137,80,159,81],[137,82,159,88],[143,63,157,83],[159,87,150,95]];
const vPush=movement(stand(bilateralBent,[[149,44],[148,62],[141,105]]),stand(fullDown,[[149,44],[148,62],[141,105]]),
  {anchor:[211,27],grip:"v"});

const hinge:Point[]=[[151,69],[164,80],[200,101]];
const hingeLegs:Point[]=[[187,125],[193,150],[203,125],[207,151],[181,156],[195,155]];
const benchKneelLegs:Point[]=[[190,123],[219,123],[202,128],[207,151],[224,128],[193,157]];
const bench:Props=[[141,129,218,129],[148,129,148,154],[211,129,211,154],[139,155,219,155]];
const lowFrame:Props=[[90,25,142,25],[123,25,123,151],[131,25,131,151],[116,155,141,155]];
const hingePose=(arms:Point[],supported=false):Pose=>({body:hinge,arms,legs:supported?benchKneelLegs:hingeLegs});
const oneKick=(grip:Grip,supported:boolean)=>{
  const free:Point[]=supported?[[151,103],[148,126]]:[[152,105],[170,114]];
  return movement(
    hingePose([[187,83],[178,110],...free],supported),
    hingePose([[187,83],[221,87],...free],supported),
    {anchor:[99,132],grip,props:supported?[...bench,...lowFrame]:lowFrame});
};
const twoKick=movement(hingePose([[186,85],[179,109],[181,81],[173,106]]),
  hingePose([[186,85],[217,90],[181,81],[211,83]]),
  {anchor:[99,126],grip:"rope",props:lowFrame});

const standingOverhead:Point[]=[[157,49],[153,66],[149,107]];
const overheadOpen:Point[]=[[162,31],[146,34],[150,32],[137,40]];
const overheadUp:Point[]=[[162,31],[168,13],[150,32],[149,13]];
const reachUp=(grip:Grip,anchor:Point,free?:Point[],farAnchor?:Point)=>{
  return movement(stand([...overheadOpen.slice(0,2),...(free??overheadOpen.slice(2))],standingOverhead),
    stand([...overheadUp.slice(0,2),...(free??overheadUp.slice(2))],standingOverhead),{anchor,grip,farAnchor});
};
const standingReach=reachUp("d",[220,142],hipsHands);
const oneRopeOverhead=reachUp("rope-one",[113,145],[[146,93],[154,109]]);

const leanHorizontal:Point[]=[[127,76],[139,86],[176,110]];
const splitBent:Point[]=[[149,133],[148,152],[184,130],[199,151],[133,157],[190,156]];
const highBar=movement(
  stand([[111,79],[118,55],[117,84],[124,59]],leanHorizontal,splitBent),
  stand([[111,79],[85,70],[117,84],[92,75]],leanHorizontal,splitBent),
  {anchor:[215,27],grip:"straight",props:[[215,27,239,27]]});

const wideHigh:Point[]=[[160,51],[160,70],[160,109]];
const wideLegs:Point[]=[[179,132],[184,152],[140,132],[137,151],[196,157],[125,157]];
const wideExtend=movement(
  stand([[131,49],[148,32],[189,48],[173,33]],wideHigh,wideLegs),
  stand([[131,49],[112,32],[189,48],[208,33]],wideHigh,wideLegs),
  {anchor:[72,104],farAnchor:[248,104],grip:"paired-d",props:[[62,25,258,25]]});

const kneelHip:Point[]=[[138,74],[151,88],[166,122]];
const sitHeel:Point[]=[[149,150],[177,150],[157,148],[184,148],[183,156],[191,153]];
const kneelOpen:Point[]=[[143,54],[155,59],[154,53],[169,56]];
const kneelHigh:Point[]=[[143,54],[136,33],[154,53],[149,31]];
const kneelOverhead=movement(stand(kneelOpen,kneelHip,sitHeel),stand(kneelHigh,kneelHip,sitHeel),
  {anchor:[230,142],grip:"straight"});

const lowBench:Props=[[115,115,220,115],[122,115,122,153],[208,115,208,153],[112,155,224,155]];
const layBody:Point[]=[[125,101],[144,105],[192,107]];
const layFeet:Point[]=[[218,112],[218,151],[208,116],[205,151],[230,156],[217,156]];
const lay=(arms:Point[],grip:Grip,pulleyHeight:number,up:Point[])=>movement(
  stand(arms,layBody,layFeet),stand(up,layBody,layFeet),{anchor:[87,pulleyHeight],grip,props:lowBench});
const skullBent:Point[]=[[143,74],[122,78],[155,75],[135,79]];
const skullUp:Point[]=[[143,74],[147,47],[155,75],[160,48]];
const lowSkullBent:Point[]=[[130,76],[111,87],[142,76],[123,86]];
const lowSkullUp:Point[]=[[130,76],[120,53],[142,76],[132,53]];
const inclineBench:Props=[[120,115,171,69],[170,73,172,151],[134,114,133,151],[119,152,180,152]];
const inclineBody:Point[]=[[169,55],[157,69],[123,106]];
const inclineLegs:Point[]=[[105,109],[100,150],[114,114],[119,151],[88,156],[108,156]];
const seatedRope=movement(
  stand([[164,45],[182,56],[154,42],[174,55]],inclineBody,inclineLegs),
  stand([[164,45],[173,24],[154,42],[161,22]],inclineBody,inclineLegs),
  {anchor:[229,139],grip:"rope",props:inclineBench});

const alternatingBase=reachUp("d",[111,143],[[147,70],[162,35]]);
const [leftOpen,leftUp]=alternatingBase.frames;
const alternate=(frame:Point[])=>{
  const copy=frame.slice();
  copy[3]=at(frame[3],-11,2);
  copy[4]=at(frame[4],-11,2);
  copy[5]=at(frame[5],11,1);
  copy[6]=at(frame[6],10,-1);
  for (const index of [13,14,18,19]) copy[index]=at(frame[index],-11,2);
  return copy;
};
const alternating:Illustration={
  ...alternatingBase,
  frames:[leftOpen,leftUp,leftUp,leftOpen,alternate(leftOpen),alternate(leftUp),alternate(leftUp),alternate(leftOpen)],
};

export const cableTricepsSourceCorrections:Record<string,Illustration>={
  "1609":pressAcross,
  "1723":oneArmAtHip,
  "0231":singlePush([[153,93],[166,65],...hipsHands],[[153,93],[157,121],...hipsHands],[224,26]),
  "1227":oneArmOverhand,
  "5033":ropeBrace,
  "1605":uprightPush("ez-down"),
  "1606":uprightPush("ez-up"),
  "2406":uprightPush("ez-up",chestPad),
  "4355":vPush,
  "2405":uprightPush("v",chestPad),
  "4578":twoKick,
  "4545":oneKick("d",true),
  "4567":oneKick("rope-one",true),
  "4566":oneKick("d",false),
  "0149":alternating,
  "5874":highBar,
  "4960":wideExtend,
  "1859":kneelOverhead,
  "0187":lay(skullBent,"straight",127,skullUp),
  "5243":lay(lowSkullBent,"straight",146,lowSkullUp),
  "4353":lay(skullBent,"rope",141,skullUp),
  "4958":oneRopeOverhead,
  "1725":seatedRope,
  "11436":reachUp("paired-d",[96,141],undefined,[123,142]),
  "11279":standingReach,
};
