import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Loads = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

function off([x,y]: Point, dx: number, dy:number): Point {
  return [x+dx,y+dy];
}
function person(head:Point, shoulder:Point, hip:Point, arms:[Limb,Limb], legs:[Limb,Limb], feet:[Point,Point]):Point[]{
  return [head,shoulder,hip,...arms[0],...arms[1],...legs[0],...legs[1],...feet];
}
function animated(frames:Point[][], props:Props = [], load:Loads = [], ms=880): Illustration {
  return {frames,props,dynamic:[["foot-tip",8,11],["foot-tip",10,12],...load],ms,reference:true};
}

function boxStepDrop() {
  const platform:Props=[[94,126,145,126],[94,126,94,157],[145,126,145,157],[94,157,145,157]];
  const hip:Point[]=[[124,66],[137,69],[151,81],[167,109],[167,115],[167,115],[167,91]];
  const shoe:[Point,Point][]=[
    [[128,123],[117,123]],[[151,135],[122,123]],[[165,148],[151,146]],
    [[170,154],[158,154]],[[170,154],[158,154]],[[170,154],[158,154]],[[170,154],[158,154]],
  ];
  const frames=hip.map((pelvis,i)=>{
    const shoulder=off(pelvis,i>=3&&i<=5?9:2,-34);
    const arm:[Limb,Limb]=[
      [off(shoulder,i<=1?9:18,20),off(shoulder,i<=1?6:29,36)],
      [off(shoulder,i<=1?0:11,20),off(shoulder,i<=1?-3:25,35)],
    ];
    const [near,far]=shoe[i];
    return person(off(shoulder,2,-13),shoulder,pelvis,arm,
      [[[near[0]+(i>=3&&i<=5?11:1),near[1]-28],near],[[far[0]+(i>=3&&i<=5?9:-2),far[1]-28],far]],
      [off(near,8,2),off(far,7,2)]);
  });
  return {...animated(frames,platform,[],840),cutOnLoop:true};
}

type Lunge = "long" | "low" | "low-left";
function longLunge(kind:Lunge) {
  const long=kind==="long";
  function make(phase:"stand"|"step"|"low"|"lowered"|"reach",left:boolean):Point[]{
    const low=phase==="low"||phase==="lowered"||phase==="reach";
    const rest=phase==="stand", armsUp=phase==="reach";
    const pelvis:Point = rest ? [145,95] : [low?152:145,low ? 121 : 101];
    const sh:Point=off(pelvis,long?3:4,-39);
    const nearFoot:Point = rest ? [151,155] : [long?198:185,155];
    const backFoot:Point = rest ? [140,154] : [long?91:111,150];
    const front:[Limb,Point]=[[[rest?154:long?194:181,rest?126:low?122:125],nearFoot],off(nearFoot,9,2)];
    const back:[Limb,Point]=[[[rest?139:long?119:135,rest?126:low?(long?145:156):130],backFoot],off(backFoot,9,6)];
    const armAtHip=(dx:number):Limb=>[off(sh,dx,24),off(pelvis,dx>0?10:-8,-5)];
    const armHigh=(dx:number):Limb=>[off(sh,dx,-18),off(sh,dx+2,-37)];
    const p=armsUp ? armHigh:armAtHip;
    return person(off(sh,2,-16),sh,pelvis,[p(14),p(-12)],
      left?[front[0],back[0]]:[back[0],front[0]],left?[front[1],back[1]]:[back[1],front[1]]);
  }
  if(long) {
    const phases=["stand","step","low","low","step","stand"] as const;
    return animated([...phases.map(phase=>make(phase,false)),...phases.map(phase=>make(phase,true))],[],[],880);
  }
  const cycle=["stand","step","lowered","reach","reach","reach","lowered","step"] as const;
  return animated(kind==="low-left"?cycle.map(phase=>make(phase,false))
    : [...cycle.map(phase=>make(phase,true)),...cycle.map(phase=>make(phase,false))],[],[],1200);
}

type KbSquat = "cossack" | "deficit" | "overhead" | "band" | "side";
function squatWithKettlebell(kind:KbSquat) {
  const high=kind==="overhead", side=kind==="side", lateral=kind==="cossack"||side;
  const elevated=kind==="deficit"||kind==="band";
  const footY=elevated?141:155;
  const platform:Props=elevated?[[111,143,196,143],[112,143,112,158],[195,143,195,158]]:[];
  function frame(depth:number,direction:-1|0|1,spread:number):Point[]{
    const hip:Point=[152+direction*30*depth,footY-54+depth*28];
    const sh:Point=off(hip,0,-36);
    const load:Point = high ? off(sh,14,-34) : off(sh,2,15);
    const nearX = lateral ? side ? 161+Math.max(0,direction)*spread : 202 : 174;
    const farX = lateral ? side ? 143+Math.min(0,direction)*spread : 102 : 131;
    const nearFoot:Point=[nearX,footY],farFoot:Point=[farX,footY-1];
    const bentNear=direction===0||direction===1||side,bentFar=direction===0||direction===-1||side;
    const nearKnee: Point = bentNear ? [nearX+1+depth*6,footY-27+5*depth] : [(nearX+hip[0])/2,(nearFoot[1]+hip[1])/2];
    const farKnee: Point = bentFar ? [farX-1-depth*6,footY-28+5*depth] : [(farX+hip[0])/2,(farFoot[1]+hip[1])/2];
    const nearArm:Limb=high?[off(sh,10,-16),load]:[off(sh,17,19),off(load,5,-3)];
    const farArm:Limb=high?[off(sh,-15,15),off(sh,-23,27)]:[off(sh,-14,20),off(load,-4,-2)];
    return [...person(off(sh,1,-16),sh,hip,[nearArm,farArm],
      [[nearKnee,nearFoot],[farKnee,farFoot]],
      [off(nearFoot,8,bentNear?2:-8),off(farFoot,-8,bentFar?2:-8)]),load];
  }
  const loads:Loads=[["kettlebell",13,0,high?2:7]];
  if(kind==="band") loads.push(["band",4,11],["band",6,12]);
  const neutral=frame(0,0,0);
  const frames=lateral?[neutral,frame(.24,1,26),frame(1,1,28),frame(1,1,28),neutral,frame(.24,-1,26),frame(1,-1,28),frame(1,-1,28)]
    :[neutral,frame(.48,0,0),frame(1,0,0),frame(1,0,0),frame(.47,0,0)];
  return animated(frames,platform,loads,810);
}


type HeldLungePose = {
  head: Point;
  shoulder: Point;
  hip: Point;
  arms: [Limb, Limb];
  frontKnee: Point;
  frontFoot: Point;
  backKnee: Point;
  backFoot: Point;
  groundedArms?: readonly number[];
};

// The numbered source demos each hold a different position. The small
// settling movement keeps each planted foot and support arm fixed.
function holdWarmupLunge(pose: HeldLungePose): Illustration {
  const frames = [0, 1, 2, 1, 0].map(settle => {
    const arms = pose.arms.map((arm, index): Limb => {
      if (pose.groundedArms?.includes(index)) return arm;
      return [off(arm[0], 0, settle), off(arm[1], 0, settle)];
    }) as [Limb, Limb];
    return person(
      off(pose.head, settle, settle),
      off(pose.shoulder, settle, settle),
      off(pose.hip, settle, 0),
      arms,
      [[pose.frontKnee, pose.frontFoot], [pose.backKnee, pose.backFoot]],
      [off(pose.frontFoot, 9, 2), off(pose.backFoot, -2, 8)],
    );
  });
  return animated(frames, [], [], 1100);
}

const overheadLunge = {
  head: [143, 63],
  shoulder: [147, 80],
  hip: [147, 115],
  frontKnee: [179, 121],
  frontFoot: [181, 154],
  backKnee: [126, 151],
  backFoot: [103, 148],
} satisfies Omit<HeldLungePose, "arms">;

const runnerLunge = {
  hip: [137, 125],
  frontKnee: [175, 114],
  frontFoot: [170, 154],
  backKnee: [108, 137],
  backFoot: [79, 149],
} satisfies Omit<HeldLungePose, "head" | "shoulder" | "arms">;

const numberedLungeWarmups: Readonly<Record<string, Illustration>> = {
  "3461": holdWarmupLunge({
    ...overheadLunge,
    arms: [[[138, 49], [143, 29]], [[151, 51], [145, 30]]],
  }),
  "3462": holdWarmupLunge({
    ...overheadLunge,
    arms: [[[157, 53], [149, 31]], [[133, 99], [126, 120]]],
  }),
  "3463": holdWarmupLunge({
    ...overheadLunge,
    head: [150, 62],
    arms: [[[129, 66], [115, 48]], [[165, 100], [175, 115]]],
  }),
  "3464": holdWarmupLunge({
    ...runnerLunge,
    head: [207, 92],
    shoulder: [190, 103],
    frontKnee: [178, 110],
    frontFoot: [159, 154],
    arms: [[[190, 133], [187, 155]], [[207, 128], [211, 152]]],
    groundedArms: [0, 1],
  }),
  "3465": holdWarmupLunge({
    ...runnerLunge,
    head: [180, 98],
    shoulder: [170, 110],
    frontKnee: [191, 122],
    frontFoot: [182, 154],
    arms: [[[169, 135], [166, 155]], [[169, 82], [172, 54]]],
    groundedArms: [0],
  }),
  "3466": holdWarmupLunge({
    ...runnerLunge,
    head: [202, 134],
    shoulder: [184, 124],
    frontKnee: [167, 100],
    frontFoot: [156, 152],
    arms: [[[184, 154], [211, 156]], [[204, 150], [224, 154]]],
    groundedArms: [0, 1],
  }),
  "3467": holdWarmupLunge({
    ...runnerLunge,
    head: [200, 115],
    shoulder: [180, 115],
    frontKnee: [187, 103],
    frontFoot: [215, 149],
    arms: [[[176, 153], [207, 155]], [[181, 80], [201, 103]]],
    groundedArms: [0],
  }),
};

export const lowerLungeWarmupsIllustrations: Readonly<Record<string, Illustration>> = {
  ...numberedLungeWarmups,
  "1566": squatWithKettlebell("overhead"),
  "2753": squatWithKettlebell("band"),
  "4524": squatWithKettlebell("side"),
  "5301": squatWithKettlebell("deficit"),
  "6007": longLunge("low"),
  "6008": longLunge("low-left"),
  "6193": squatWithKettlebell("cossack"),
  "9068": boxStepDrop(),
  "9701": longLunge("long"),
};
