import type { Illustration, Point } from "./motion-data";

const change = (pose: Point[], edits: Partial<Record<number, Point>>): Point[] => pose.map((point,i)=>edits[i]??point);

function curlCheck(kind: "standing" | "concentration" | "wrist"): Illustration {
  const standing: Point[] = [[144,48],[148,67],[144,108],[164,93],[165,117],[134,93],[136,117],
    [157,133],[164,155],[133,134],[132,155],[122,117],[188,117]];
  const concentr: Point[] = [[163,85],[150,100],[132,133],[168,124],[169,148],[143,126],[156,128],
    [167,130],[182,153],[130,137],[122,154],[147,131],[192,131]];
  const preacher: Point[] = [[144,68],[144,88],[139,126],[161,117],[183,136],[153,117],[172,137],
    [165,130],[171,154],[152,130],[160,153],[166,138],[191,135]];
  const start=kind==="standing"?standing:kind==="concentration"?concentr:preacher;
  const end=kind==="standing"?change(start,{4:[165,68],6:[139,71]}):kind==="concentration"?change(start,{4:[174,92]})
    :change(start,{4:[183,109],6:[172,111],11:[163,110],12:[191,109]});
  const error=kind==="standing"?change(end,{0:[132,52],1:[137,70],3:[178,79],4:[166,61],5:[154,90],6:[143,68]})
    :kind==="concentration"?change(end,{0:[169,81],1:[157,96],3:[152,106],4:[176,84]})
      :change(end,{4:[185,118],6:[173,119],11:[164,121],12:[193,116]});
  const props:NonNullable<Illustration["props"]>=kind==="standing"?[]:kind==="concentration"?[[102,132,150,132],[107,133,107,155],[147,132,147,155]]
    :[[120,128,151,128],[126,129,126,155],[152,100,184,126],[152,108,151,155]];
  const gear:NonNullable<Illustration["dynamic"]>=kind==="wrist"?[["ez-bar",11,12],["barbell-end",11,0,0],["barbell-end",12,0,0]]
    :kind==="concentration"?[["dumbbell",4,0,0]]:[["dumbbell",4,0,0],["dumbbell",6,0,0]];
  return {frames:[start,end,end,start,start,error,error,start],props,dynamic:gear,formCheckFrom:4,ms:1010,reference:true};
}

function reactiveDrop(): Illustration {
  const tall: Point[] = [[147,47],[148,66],[147,107],[158,91],[157,115],[138,89],[138,114],
    [159,132],[161,154],[137,130],[134,154]];
  const rise=change(tall,{8:[161,149],10:[134,149],0:[147,43],1:[148,62],2:[147,104]});
  const drop=change(tall,{0:[155,74],1:[150,91],2:[134,131],3:[171,103],4:[182,96],5:[155,104],6:[174,99],
    7:[163,129],9:[141,133]});
  return {frames:[drop,drop,tall,rise,drop],ms:850,reference:true};
}

function raisedDepthPushup(): Illustration {
  const ready: Point[] = [[189,97],[176,109],[138,106],[188,125],[196,136],[176,126],[179,139],
    [108,106],[80,111],[102,110],[75,115]];
  const sinks=change(ready,{0:[198,129],1:[178,132],2:[143,114],3:[187,145],4:[206,152],5:[171,145],6:[166,154]});
  const airborne=change(ready,{0:[190,93],1:[178,101],3:[183,126],4:[181,132],5:[176,123],6:[175,131]});
  return {frames:[ready,sinks,sinks,airborne,ready],props:[[63,114,103,114],[68,115,68,156],[94,115,94,155],
    [153,141,176,141],[152,142,152,156],[217,139,244,139],[240,139,240,155]],ms:860,reference:true};
}

function lateralBox(): Illustration {
  const tall: Point[] = [[113,48],[113,67],[113,109],[128,91],[127,118],[99,90],[99,118],
    [124,131],[126,156],[101,131],[100,156]];
  const knee=change(tall,{0:[117,68],1:[115,87],2:[108,126],3:[112,107],4:[97,119],5:[101,109],6:[88,115],7:[128,134],9:[107,136]});
  const shift=(p:Point[],dx:number,dy:number):Point[]=>p.map(([x,y])=>[x+dx,y+dy]);
  const air=change(shift(tall,25,-32),{3:[146,53],4:[147,31],5:[127,53],6:[128,32],7:[157,104],8:[147,123],9:[131,105],10:[126,126]});
  const onBox=shift(tall,58,-26), far=shift(tall,104,0);
  const farDrop=shift(knee,106,0);
  return {frames:[tall,knee,air,onBox,onBox,farDrop,far],props:[[147,129,197,129],[147,129,147,157],[197,129,197,157],
    [147,156,197,156]],cutOnLoop:true,ms:790,reference:true};
}

function leadHook(): Illustration {
  const guard:Point[]=[[151,57],[150,75],[145,111],[163,94],[160,66],[133,95],[140,69],
    [165,134],[176,155],[127,132],[119,155],[162,75],[141,76]];
  const loaded=change(guard,{0:[153,57],1:[150,75],3:[170,100],5:[123,88],6:[137,70],11:[162,76],12:[136,75]});
  const strike=change(guard,{0:[149,59],1:[148,76],2:[149,112],3:[165,92],4:[159,67],5:[179,76],6:[183,54],
    7:[166,131],9:[128,137],10:[125,155],11:[145,76],12:[156,76]});
  return {frames:[guard,loaded,strike,guard],shoulders:[11,12],ms:780,reference:true};
}

export const techniqueReviewIllustrations:Record<string, Illustration>={
  "2352":curlCheck("standing"),"2353":curlCheck("concentration"),"2348":curlCheck("wrist"),
  "3543":reactiveDrop(),"0492":raisedDepthPushup(),"0564":lateralBox(),"2271":leadHook(),
};
