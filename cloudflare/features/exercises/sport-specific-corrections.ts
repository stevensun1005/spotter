import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;
const feet: Attachments = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];

function cone(x: number, y: number): Props {
  return [[x - 8, y, x + 8, y], [x - 5, y, x, y - 12], [x, y - 12, x + 5, y]];
}
function running(x: number, y: number, direction: number, opposite: boolean): Point[] {
  const depth = 0.54 + y / 600;
  const stance: Point[] = [
    [6,-76],[0,-65],[-6,-34],[-9,-53],[-23,-47],[15,-56],[27,-62],
    [15,-26],[14,-9],[-15,-22],[-23,-4],[23,-5],[-17,0],[11,-78],
  ];
  const next = opposite
    ? [0,1,2,5,6,3,4,9,10,7,8,12,11,13].map(i => stance[i])
    : stance;
  return next.map(([dx,dy]): Point => [x + dx * depth * direction, y + dy * depth]);
}
const course: Array<[number, number, number]> = [
  [112,70,1],[137,82,1],[165,91,-1],[138,81,-1],[112,70,1],
  [147,84,1],[186,99,1],[217,114,1],[268,135,-1],[218,120,-1],
  [175,117,-1],[120,132,-1],[75,143,-1],[43,150,1],[80,118,1],
  [127,87,1],[165,91,-1],[139,81,-1],[112,70,1],
];
const coneRun: Illustration = {
  frames: course.map(([x,y,d],i)=>running(x,y,d,i%2===1)), ms: 275, topView: true,
  props: [...cone(103,70), ...cone(42,152), ...cone(277,140)],
  dynamic: [...feet, ["face",0,13]], reference: true,
};

const balloonSquat: Point[] = [
  [165,91],[161,106],[154,126],[132,119],[117,136],[188,119],[199,134],
  [174,138],[173,154],[138,138],[137,153],[186,158],[148,157],
  [133,37],[133,47],
];
const balloonReach: Point[] = [
  [165,59],[160,72],[154,103],[146,56],[134,29],[183,90],[202,101],
  [168,123],[167,144],[139,122],[140,143],[179,149],[151,148],
  [132,21],[132,31],
];
const balloonPeak: Point[] = [
  [164,52],[159,65],[154,99],[146,46],[135,21],[184,84],[205,92],
  [164,118],[165,140],[144,117],[144,139],[177,145],[156,144],
  [134,10],[134,20],
];
const balloonRecover = balloonSquat.map(([x,y],i):Point =>
  i===13 ? [135,21] : i===14 ? [135,31] : [x,y]);
const balloonDrill: Illustration = {
  frames: [balloonSquat, balloonSquat, balloonReach, balloonPeak, balloonRecover, balloonSquat],
  ms: 490, dynamic: [...feet, ["ball",13,0,0], ["line",13,14]], reference: true,
};

const headbangerStart: Point[] = [
  [152,51],[146,72],[142,111],[121,81],[134,65],[152,88],[157,65],
  [180,109],[219,109],[184,114],[222,114],[233,105],[235,110],[158,51],[131,62],[154,62],
];
const headbangerTravel: Point[] = [
  [171,55],[161,76],[152,116],[130,86],[134,65],[169,89],[157,65],
  [190,112],[229,112],[194,117],[232,117],[243,108],[245,113],[177,55],[131,62],[154,62],
];
const hangingBar: Props = [
  [92,65,268,65],[92,65,92,157],[268,65,268,157],[78,157,107,157],[253,157,282,157],
];
const headbanger: Illustration = {
  frames: [headbangerStart, headbangerTravel, headbangerStart], ms: 880,
  props: hangingBar, dynamic: [...feet, ["palm-down",4,14],["palm-down",6,15],["face",0,13]], reference: true,
};

export const sportSpecificCorrections: Record<string, Illustration> = {
  "5984": coneRun,
  "5985": balloonDrill,
  "10736": headbanger,
};
