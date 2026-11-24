import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;
type Arms = [Point,Point,Point,Point];
type Support = {body:Point[];legs:Point[];props:Props;anchors:[Point,Point];shoulders:[Point,Point]};

const shoes:Links=[["foot-tip",8,11],["foot-tip",10,12]];

function tower([x,y]:Point):Props {
  const inner=x<160?x-9:x+9;
  return [[x,21,x,153],[inner,21,inner,153],[x,21,inner,21],[x-10,156,x+10,156],
    [inner,129,x,129],[inner,137,x,137],[inner,145,x,145],[x-2,y,x+2,y]];
}
function ring([x,y]:Point,radius:number):Props {
  return Array.from({length:16},(_,i)=>{
    const start=i*Math.PI/8, end=(i+1)*Math.PI/8;
    return [x+radius*Math.cos(start),y+radius*Math.sin(start),x+radius*Math.cos(end),y+radius*Math.sin(end)];
  });
}
function cables(support:Support,start:Arms,end:Arms,single=false):Illustration {
  const pose=(arms:Arms)=>[...support.body,...arms,...support.legs,...support.shoulders];
  const [near,far]=support.anchors;
  return {
    frames:[pose(start),pose(end),pose(end),pose(start)],ms:805,
    shoulders:[13,14],reference:true,
    props:[...support.props,...tower(near),...(single?[]:tower(far))],
    dynamic:[...shoes,["cable",4,...near],["pad",4,0,0],...(single?[]:[["cable",6,...far],["pad",6,0,0]] as Links)],
  };
}

const decline:Support={
  body:[[178,111],[162,105],[128,83]],
  shoulders:[[160,101],[169,108]],
  legs:[[108,87],[111,121],[101,92],[101,121],[99,127],[91,127]],
  anchors:[[231,144],[262,147]],
  props:[[109,88,182,124],[113,89,111,144],[171,121,170,144],[98,146,184,146],[102,112,122,112],[103,120,116,120]],
};
const declineBent:Arms=[[137,113],[145,91],[156,118],[166,96]];
const declineStraight:Arms=[[153,79],[153,58],[168,85],[168,62]];
const declineSingleBent:Arms=[declineBent[0],declineBent[1],[147,118],[130,94]];
const declineSingleStraight:Arms=[declineStraight[0],declineStraight[1],declineSingleBent[2],declineSingleBent[3]];

const incline:Support={
  body:[[174,48],[164,65],[137,103]],
  shoulders:[[151,68],[176,71]],
  legs:[[115,112],[110,151],[124,115],[138,151],[100,156],[129,156]],
  anchors:[[80,145],[241,145]],
  props:[[135,111,180,67],[149,100,149,151],[175,76,176,151],[135,111,116,106],[140,152,193,152]],
};
const inclineBall:Support={
  ...incline,props:ring([167,117],36),
  body:[[173,51],[163,67],[137,107]],
  shoulders:[[154,70],[174,73]],
  legs:[[114,111],[108,149],[125,116],[141,151],[94,153],[129,155]],
};
const flatBall:Support={
  ...inclineBall,props:ring([157,125],30),
  body:[[186,85],[169,91],[125,99]],
  shoulders:[[161,85],[170,97]],
  legs:[[105,107],[101,146],[122,112],[132,151],[87,152],[122,154]],
};
const inclineFlyOpen:Arms=[[129,63],[105,62],[192,65],[213,66]];
const inclineFlyClosed:Arms=[[146,42],[155,22],[178,42],[164,23]];
const ballFlyOpen:Arms=[[127,68],[105,67],[192,68],[215,68]];
const ballFlyClosed:Arms=[[149,43],[156,23],[178,43],[165,24]];
const singleFlyOpen:Arms=[[127,68],[105,67],[181,90],[174,103]];
const singleFlyClosed:Arms=[[149,43],[156,23],singleFlyOpen[2],singleFlyOpen[3]];
const inclinePressBent:Arms=[[140,89],[145,69],[189,91],[181,71]];
const inclinePressStraight:Arms=[[149,50],[153,33],[177,51],[172,34]];
const inclinePressSingleBent:Arms=[inclinePressBent[0],inclinePressBent[1],[154,97],[145,99]];
const inclinePressSingleStraight:Arms=[inclinePressStraight[0],inclinePressStraight[1],inclinePressSingleBent[2],inclinePressSingleBent[3]];
const flatPressBent:Arms=[[149,101],[151,81],[181,109],[178,89]];
const flatPressStraight:Arms=[[156,63],[151,47],[178,68],[175,53]];
const flatSingleBent:Arms=[flatPressBent[0],flatPressBent[1],[149,110],[131,103]];
const flatSingleStraight:Arms=[flatPressStraight[0],flatPressStraight[1],flatSingleBent[2],flatSingleBent[3]];

const upright:Support={
  body:[[159,45],[159,65],[155,103]],
  shoulders:[[146,64],[174,66]],
  legs:[[150,128],[139,149],[166,131],[167,150],[129,154],[177,156]],
  props:[],anchors:[[65,49],[255,49]],
};
const slightLunge:Support={
  ...upright,body:[[158,48],[157,68],[154,103]],
  shoulders:[[145,67],[172,70]],
  legs:[[138,127],[128,148],[174,132],[190,149],[115,153],[202,154]],
};
const crossOpen:Arms=[[122,55],[101,45],[200,56],[224,46]];
const crossClosed:Arms=[[142,87],[164,101],[176,88],[155,102]];
const flySideOpen:Arms=[[119,64],[98,69],[199,65],[223,70]];
const flySideClosed:Arms=[[141,86],[157,102],[171,88],[161,105]];
const upperFlyOpen:Arms=[[119,66],[97,64],[202,69],[225,66]];
const upperFlyClosed:Arms=[[144,47],[160,29],[180,45],[163,26]];
const hinge:Support={
  body:[[167,80],[154,87],[128,104]],
  shoulders:[[141,85],[166,89]],
  legs:[[124,127],[120,151],[148,129],[147,152],[131,157],[158,155]],
  props:[],anchors:[[70,147],[257,147]],
};
const reverseOpen:Arms=[[141,108],[157,131],[167,112],[149,133]];
const reverseRaised:Arms=[[120,86],[91,91],[190,87],[222,92]];

export const cableChestSourceCorrections:Record<string,Illustration>={
  "0154":cables({...hinge,anchors:[hinge.anchors[1],hinge.anchors[0]]},reverseOpen,reverseRaised),
  "0155":cables(upright,crossOpen,crossClosed),
  "1260":cables(decline,declineSingleBent,declineSingleStraight,true),
  "1261":cables(decline,declineBent,declineStraight),
  "0171":cables(incline,inclineFlyOpen,inclineFlyClosed),
  "0170":cables(inclineBall,ballFlyOpen,ballFlyClosed),
  "1264":cables(inclineBall,singleFlyOpen,singleFlyClosed,true),
  "1265":cables(incline,inclinePressSingleBent,inclinePressSingleStraight,true),
  "1266":cables(inclineBall,inclinePressSingleBent,inclinePressSingleStraight,true),
  "1267":cables(flatBall,flatSingleBent,flatSingleStraight,true),
  "1268":cables(flatBall,flatPressBent,flatPressStraight),
  "0227":cables(slightLunge,flySideOpen,flySideClosed),
  "1270":cables({...slightLunge,anchors:[[65,64],[255,64]]},upperFlyOpen,upperFlyClosed),
};
