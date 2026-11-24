import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;
type Pose = { body: [Point, Point, Point]; legs: [Point, Point, Point, Point, Point, Point]; props?: Props };
type Arms = [Point, Point, Point, Point];
type Grip = "bar" | "underhand" | "bent-bar" | "rope" | "v" | "single" | "two" | "crossover-bar";
const feet: Links = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

const shortBench: Props = [[83,116,144,116],[91,117,91,155],[135,117,135,155],[82,155,150,155]];
const rowBench: Props = [
  ...shortBench,[145,150,222,150],[202,151,219,137],[194,148,211,134],[222,150,222,156],
];
const seated: Pose = {
  body:[[123,51],[123,69],[115,106]],
  legs:[[156,116],[200,143],[151,120],[191,143],[213,136],[202,136]], props:rowBench,
};
const lowSeated: Pose = {...seated,body:[[113,52],[115,70],[115,106]]};
const feetDown: Pose = {
  ...seated,
  legs:[[157,119],[162,154],[144,115],[141,152],[178,157],[156,154]], props:shortBench,
};
const bentBarSeat: Pose = {
  ...feetDown,
  props:[...shortBench,[145,149,222,149],[202,148,214,125],[207,148,219,125]],
};
const floor: Pose = {
  body:[[121,74],[118,92],[115,147]],
  legs:[[151,141],[198,151],[144,147],[189,153],[204,136],[195,140]],
};
const standing: Pose = {
  body:[[134,46],[130,64],[126,108]],
  legs:[[144,129],[150,153],[122,131],[119,153],[166,157],[135,156]],
};
const hinge: Pose = {
  ...standing, body:[[162,66],[149,78],[117,109]],
};
const deepHinge: Pose = {
  body:[[134,90],[146,100],[169,112]],
  legs:[[154,134],[148,155],[183,133],[187,155],[157,157],[196,157]],
};

function tower(x:number,y:number):Props {
  return [[x - 6,20,x - 6,153],[x + 7,20,x + 7,153],[x - 6,20,x + 7,20],
    [x - 12,156,x + 13,156],[x - 5,y,x + 3,y],[x - 3,124,x + 4,124],
    [x - 3,133,x + 4,133],[x - 3,142,x + 4,142]];
}
const add = ([x,y]:Point,[dx,dy]:Point):Point=>[x+dx,y+dy];
function makeFrame(pose:Pose, arms:Arms, grip:Grip, anchor:Point):Point[] {
  const w=arms[1], v=arms[3];
  const center:Point=grip==="single"?w:[(w[0]+v[0])/2,(w[1]+v[1])/2];
  const distance=Math.hypot(v[0]-w[0],v[1]-w[1]) / 2;
  const ropeHeight=Math.sqrt(Math.max(9,19**2-distance**2));
  const toward = (length:number):Point=>{
    const dx=anchor[0]-center[0],dy=anchor[1]-center[1], hypot=Math.max(1,Math.hypot(dx,dy));
    return add(center,[dx*length/hypot,dy*length/hypot]);
  };
  const joint = grip==="rope" ? toward(ropeHeight) : grip==="v" ? toward(12) : toward(0);
  return [
    ...pose.body, ...arms, ...pose.legs, joint, add(w,[5,-1]), add(v,[5,-1]),
    add(w,[4,4]), add(v,[4,4]),
  ];
}
function row(pose:Pose,start:Arms,end:Arms,y:number,grip:Grip, secondTower?: "parallel" | "across"):Illustration {
  const anchor:Point=[secondTower==="across"?73:237,y], other:Point=[secondTower==="across"?258:262,y-4];
  const palm=grip==="underhand"?"palm-up":grip==="bar"||grip==="bent-bar"||grip==="crossover-bar"?"palm-down":"thumb-up";
  const grasp:Links=[[palm,4,14]];
  if(grip!=="single") grasp.push([palm,6,15]);
  const dual=grip==="two"||grip==="crossover-bar";
  const rig:Links=dual ?
    [["cable",4,...anchor],["cable",6,...other]] :
    [["cable",13,...anchor]];
  switch(grip){
    case "v":
    case "rope": rig.push(["line",4,13],["line",6,13],["pad",16,0,0],["pad",17,0,0]); break;
    case "bent-bar": rig.push(["ez-bar",4,6]); break;
    case "bar":
    case "underhand":
    case "crossover-bar": rig.push(["bar",4,6]); break;
    case "two": rig.push(["pad",4,0,0],["pad",6,0,0]); break;
    case "single": rig.push(["pad",4,0,0]); break;
  }
  const first=makeFrame(pose,start,grip,anchor),last=makeFrame(pose,end,grip,anchor);
  const machine=tower(...anchor);
  if(dual||secondTower==="parallel") machine.push(...tower(...other),[anchor[0],20,other[0],20]);
  return {
    frames:[first,last,last,first], ms:860, reference:true,
    props:[...(pose.props??[]),...machine],
    dynamic:[...feet,...rig,...grasp],
  };
}

const hingedOpen:Arms=[[161,102],[177,125],[150,104],[161,121]];
const hingedClose:Arms=[[125,83],[147,105],[117,85],[133,104]];
const latReach:Arms=[[154,92],[184,105],[150,89],[176,101]];
const latPull:Arms=[[107,104],[134,107],[97,100],[124,103]];
const standardReach:Arms=[[153,83],[177,99],[148,83],[165,96]];
const standardPull:Arms=[[103,97],[136,91],[94,92],[122,89]];
const standReach:Arms=[[161,72],[192,72],[151,75],[177,75]];
const standPull:Arms=[[116,90],[145,83],[103,92],[135,87]];

export const cableRowSourceCorrections: Record<string, Illustration> = {
  "1238":row(bentBarSeat,[[154,80],[181,91],[142,81],[162,93]],[[105,66],[140,83],[94,71],[122,87]],128,"bent-bar"),
  "2661":row(seated,standardReach,standardPull,127,"v"),
  "3232":row(standing,[[161,64],[194,64],[153,67],[181,65]],[[110,59],[148,58],[99,62],[129,58]],63,"rope"),
  "3233":row(feetDown,[[149,80],[174,94],[146,79],[160,90]],[[109,89],[136,88],[97,87],[125,86]],95,"underhand"),
  "3357":row(floor,[[150,113],[178,120],[146,110],[169,116]],[[101,118],[136,111],[94,111],[115,109]],137,"rope"),
  "3859":row(hinge,hingedOpen,hingedClose,146,"bar"),
  "4011":row(deepHinge,[[140,122],[130,144],[177,119],[187,141]],[[127,98],[132,118],[191,94],[189,117]],142,"crossover-bar","across"),
  "4367":row(hinge,hingedOpen,hingedClose,146,"underhand"),
  "4368":row(hinge,[[163,101],[175,128],[150,100],[164,127]],[[123,79],[149,103],[112,86],[132,98]],146,"rope"),
  "5090":row(standing,[[165,73],[196,76],[150,77],[176,74]],[[111,92],[147,83],[100,89],[129,86]],74,"bar","parallel"),
  "5179":row(standing,standReach,standPull,74,"v","parallel"),
  "5553":row(lowSeated,latReach,latPull,121,"v"),
  "10112":row(seated,[[152,87],[180,99],[123,90],[127,110]],[[99,106],[133,104],[123,90],[127,110]],127,"single"),
  "11257":row(feetDown,[[148,54],[174,36],[138,51],[162,31]],[[111,92],[144,73],[96,83],[126,67]],30,"two"),
};
