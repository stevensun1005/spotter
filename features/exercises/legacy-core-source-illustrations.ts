import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

function off([x, y]: Point, dx: number, dy: number): Point { return [x + dx, y + dy]; }

function pose(body: [Point, Point, Point], arms: [Limb, Limb], legs: [Limb, Limb],
  feet: [Point, Point] = [off(legs[0][1], 8, 1), off(legs[1][1], 8, 1)],
): Point[] {
  return [...body, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...feet];
}

function draw(frames: Point[][], props: Props = [], gear: Gear = [], ms = 800): Illustration {
  return { frames, props, dynamic: [["foot-tip", 8, 11], ["foot-tip", 10, 12], ...gear], ms, reference: true };
}

const rep = [0, .35, .75, 1, 1, .55, .23];
const platform = (start: number, end: number, y: number): Props => [
  [start,y,end,y],[start+5,y,start+5,155],[end-5,y,end-5,155],[start,155,end,155],
];

function romanChair(side: boolean): Illustration {
  const props: Props = side
    ? [[101,130,152,111],[149,110,166,104],[152,110,175,154],[95,155,186,155],
      [94,154,110,129],[88,148,107,154],[104,128,117,130]]
    : [[105,107,169,107],[112,108,112,155],[165,109,165,155],[99,155,174,155],
      [78,100,104,103],[83,103,83,155],[70,155,100,155]];
  function frame(move: number) {
    const hip: Point=side?[149,107]:[151,100];
    const shoulder: Point=side?[181+9*move,71+22*move]:[185-2*move,98+36*move];
    const head: Point=side?off(shoulder,8+10*move,-15+5*move):off(shoulder,12,2+11*move);
    const arms: [Limb,Limb]=side
      ? [[off(shoulder,12,-9),off(head,-5,2)],[off(shoulder,-13,-8),off(head,0,1)]]
      : [[off(shoulder,-5,14),off(shoulder,-15,8)],[off(shoulder,6,13),off(shoulder,-4,4)]];
    return pose([head,shoulder,hip],arms,
      side?[[[121,124],[100,143]],[[116,125],[94,147]]]:[[[119,100],[85,100]],[[118,104],[81,104]]],
      side?[[91,151],[85,151]]:[[74,102],[72,106]]);
  }
  return draw(rep.map(frame),props,[],900);
}

type Hanging = "sling-bent" | "sling-straight" | "raise-bent" | "curl-bent" | "curl-straight" | "gorilla";
function hangingKnees(kind: Hanging): Illustration {
  const slings = kind.startsWith("sling");
  const curl = kind.startsWith("curl");
  const straight = kind.endsWith("straight");
  const gorilla = kind==="gorilla";
  const cage: Props=[[95,29,216,29],[99,28,99,155],[213,28,213,155],[92,156,117,156],[197,156,225,156]];
  const fixed: Gear=slings?[["line",3,128,29],["line",5,174,29],["pad",3,1,1],["pad",5,1,1]]:[];
  function frame(depth:number) {
    const hip: Point=[150+11*depth,109-(curl?23:gorilla?17:slings&&straight?15:3)*depth];
    const shoulder: Point=[150+3*depth,60-(gorilla?19*depth:0)];
    const kneeLift = gorilla?67:curl?60:slings?49:26;
    const nearFoot: Point=straight
      ? [143+(curl?40:44)*depth,154-(curl?103:slings?94:70)*depth]
      : [144+(curl||gorilla?26:20)*depth,154-(gorilla?60:curl?59:slings?41:28)*depth];
    const nearKnee: Point=straight
      ? [(hip[0]+nearFoot[0])/2,(hip[1]+nearFoot[1])/2]
      : [144+27*depth,131-kneeLift*depth];
    const farKnee=straight?off(nearKnee,4,1.5):off(nearKnee,9,4);
    const arms:[Limb,Limb]=slings
      ?[[[128,81],[134,49]],[[176,81],[170,49]]]
      :[[[134-9*depth,44+8*(gorilla?depth:0)],[128,29]],[[168+7*depth,45+8*(gorilla?depth:0)],[176,29]]];
    return pose([off(shoulder,1,-15),shoulder,hip],arms,
      [[nearKnee,nearFoot],[farKnee,off(nearFoot,8,3)]],
      [off(nearFoot,7,-1),off(nearFoot,14,2)]);
  }
  return draw(rep.map(frame),cage,fixed,820);
}

function captainSideTwist(): Illustration {
  const station: Props=[
    [99,72,104,156],[190,72,190,156],[96,74,126,74],[172,74,204,74],[96,156,208,156],
    [126,71,126,113],[175,70,175,113],[126,70,175,70],[124,112,174,112],[105,90,119,86],[192,90,176,86],
  ];
  function frame(side: number) {
    const hips: Point=[151+9*side,105-3*Math.abs(side)];
    const k:Point=[147+30*side,126-11*Math.abs(side)];
    const f:Point=[147+33*side,151-15*Math.abs(side)];
    return pose(
      [[150,38],[151,56],hips],
      [[[118,75],[100,72]],[[178,75],[192,73]]],
      [[k,f],[off(k,11,-2),off(f,10,-3)]],
      [off(f,8,1),off(f,16,-1)],
    );
  }
  return draw([0,.5,1,.5,0,-.5,-1,-.5].map(frame),station,[],800);
}

type Supine = "bottoms-up" | "cocoon" | "hip-curl" | "bench" | "elbow-cycle" | "elbow-planted";
function floorCrunch(kind: Supine): Illustration {
  const onBench=kind==="bench";
  const surface=onBench?111:151;
  const bench: Props=onBench?platform(70,230,surface+4):[];
  function frame(move:number, side:number=1) {
    const seat=kind==="elbow-planted";
    const bicycle=kind==="elbow-cycle";
    const curl=kind==="cocoon";
    const leaveFloor=kind==="hip-curl" || kind==="bottoms-up" || onBench;
    const shoulder: Point=[105+13*move*(bicycle||seat||curl?1:0),surface-4-17*move*(bicycle||seat||curl?1:0)];
    const hip:Point=[154-(leaveFloor?9*move:0),surface-4-(leaveFloor?19*move:curl?4*move:0)];
    const nearMove=bicycle&&side<0?0:move;
    const nearAnkle: Point=seat?[215,surface+3]
      : [211-33*nearMove,surface-4-(kind==="hip-curl"?40:27)*nearMove];
    const farAnkle: Point=seat?[207,surface+1]
      : bicycle?[204-32*(side<0?move:0),surface-9-32*(side<0?move:0)]
      : off(nearAnkle,-5,-2);
    const k:Point=seat?[185,surface-24]:[184-25*nearMove,surface-6-(kind==="hip-curl"?50:40)*nearMove];
    const farKnee:Point=bicycle?[178-26*(side<0?move:0),surface-7-27*(side<0?move:0)]:off(k,-7,-3);
    const plantedHandA: Limb=[[125,surface+1],[154,surface+3]];
    const plantedHandB: Limb=[[123,surface-1],[145,surface+2]];
    const hands: [Limb,Limb]=curl
      ? [[off(shoulder,-21+45*move,-5-3*move),off(shoulder,-42+80*move,-7-11*move)],
        [off(shoulder,-19+44*move,-9),off(shoulder,-40+77*move,-12-8*move)]]
      : bicycle||seat?[[off(shoulder,5+22*move,-9+7*move),off(shoulder,-13,-4)],[off(shoulder,4,-13),off(shoulder,-17,-7)]]
      : onBench?[[[90,surface+2],[77,surface-2]],[[95,surface-2],[83,surface-5]]]
      : [plantedHandA,plantedHandB];
    return pose(
      [off(shoulder,-17+8*move*(curl||bicycle||seat?1:0),-2-6*move),shoulder,hip],hands,
      [[k,nearAnkle],[farKnee,farAnkle]],
      [off(nearAnkle,7,-3),off(farAnkle,8,-3)],
    );
  }
  return draw(kind==="elbow-cycle" ? [frame(0),frame(.55),frame(1),frame(.3,-1),frame(.72,-1),frame(1,-1)]
    : rep.map(height=>frame(onBench?1-height:height)),bench,[],820);
}

function coreBenchRaise(): Illustration {
  const props=platform(72,166,122);
  function frame(raise: number) {
    const hip:Point=[150,112];
    const shoulder:Point=[117-7*raise,86+11*raise];
    const foot:Point=[216-15*raise,151-39*raise];
    const knee: Point=[176-6*raise,126-19*raise];
    return pose([off(shoulder,-8,-15),shoulder,hip],
      [[[119,114],[107,119]],[[125,110],[115,116]]],
      [[knee,foot],[off(knee,-4,-3),off(foot,-5,-3)]]);
  }
  return draw(rep.map(frame),props,[],800);
}


type Plank = "incline" | "hand-side" | "pike" | "twist" | "kneeling-tap" | "power";
function sourcePlank(kind: Plank): Illustration {
  const incline=kind==="incline", hands=kind==="hand-side";
  const sidePlank=incline||hands;
  const stage=incline ? platform(190,222,117) : [];
  function frame(progress:number, side=1): Point[] {
    if(sidePlank) {
      const hip:Point=[147,(incline?110:126)-2*progress];
      const shoulder:Point=[199,incline?76:105];
      const anchor:Point=[201,incline?113:153];
      return pose(
        [off(shoulder,15,-11),shoulder,hip],
        [incline?[[195,113],[218,114]]:[[199,129],anchor],[[169,96],[158,119]]],
        [[[117,incline?131:145],[79,154]],[[111,incline?133:144],[74,151]]],
        [[69,157],[65,153]],
      );
    }
    if(kind==="pike") {
      const hp:Point=[155-9*progress,126-39*progress];
      return pose([[221,111+6*progress],[202,114+5*progress],hp],
        [[[205,153],[235,153]],[[199,150],[225,151]]],
        [[[118,138-18*progress],[85,147]],[[114,140-18*progress],[80,146]]],
        [[84,156],[79,155]]);
    }
    if(kind==="twist"){
      const shoulder:Point=[199+4*side*progress,111-14*progress];
      const arm: Limb=[[198,153],[227,153]];
      const reaching: Limb=[[207,105-40*progress],[213,151-104*progress]];
      return pose(
        [off(shoulder,17,-5),shoulder,[150,127-5*progress]],
        [side>0?arm:reaching,side>0?reaching:arm],
        [[[114,139],[83,148]],[[118,142],[91,149]]],[[75,155],[85,156]],
      );
    }
    if(kind==="kneeling-tap") {
      const shoulder:Point=[190,119];
      const tap: Limb=[[193+13*progress,151-20*progress],[223-22*progress,153-36*progress]];
      const support: Limb=[[201,152],[229,153]];
      return pose(
        [[208,110],shoulder,[148,123]],
        [side>0?support:tap,side>0?tap:support],
        [[[118,151],[88,142]],[[127,151],[96,140]]],
        [[80,140],[88,139]],
      );
    }
    const shoulder:Point=[197,113];
    const arm: Limb=[[203,135],[207,154]];
    const reach: Limb=[[197+22*progress,135-27*progress],[198+42*progress,151-47*progress]];
    const raised: Limb=[[121,136-17*progress],[86,149-34*progress]];
    const fixed: Limb=[[123,136],[91,150]];
    return pose(
      [[213,104],shoulder,[154,127]],
      [side>0?arm:reach,side>0?reach:arm],
      [side>0?raised:fixed,side>0?fixed:raised],
      [[85,152-31*progress*(side>0?1:0)],[86,152-31*progress*(side<0?1:0)]],
    );
  }
  const frames=sidePlank||kind==="pike"?rep.map(p=>frame(p))
    :[frame(0),frame(.52,1),frame(1,1),frame(.49,1),frame(0),frame(.51,-1),frame(1,-1),frame(.47,-1)];
  return draw(frames,stage,[],930);
}

function frontLever(held: boolean): Illustration {
  const rig: Props=[[133,25,133,156],[175,25,175,156],[128,25,180,25],[117,154,148,154],[165,154,192,154]];
  function frame(drop:number) {
    const shoulder:Point=[128,91+5*drop];
    const hips:Point=[176-2*drop,93+9*drop];
    const ankle:Point=[235-3*drop,94+23*drop];
    return pose(
      [[111,89+5*drop],shoulder,hips],
      [[[130,62],[132,33]],[[137,65],[138,33]]],
      [[[205-2*drop,94+16*drop],ankle],[[201-2*drop,92+14*drop],off(ankle,-4,-3)]],
      [off(ankle,9,1),off(ankle,6,-2)],
    );
  }
  return draw(rep.map(p=>frame(p*(held?.14:1))),rig,[],held?1050:830);
}

function humanFlag(): Illustration {
  const pole:Props=[[118,24,118,155],[104,156,133,156]];
  function frame(move:number) {
    const hip:Point=[187,92+2*move];
    const foot:Point=[244,94+4*move];
    return pose(
      [[130,91],[147,90],hip],
      [[[132,70],[118,47]],[[132,115],[118,134]]],
      [[[215,93+3*move],foot],[[209,90+3*move],off(foot,-5,-3)]],
      [off(foot,9,0),off(foot,5,-3)],
    );
  }
  return draw(rep.map(frame),pole,[],1130);
}

type Balance = "frog" | "planche" | "straddle-planche" | "maltese" | "straddle-maltese" | "lean";
function palmsBalance(kind: Balance): Illustration {
  const frog=kind==="frog", wide=kind.includes("straddle"), maltese=kind.includes("maltese"), lean=kind==="lean";
  function frame(pulse:number): Point[] {
    const hip:Point=lean?[146+11*pulse,120]:frog?[148+3*pulse,104]:[149,121+2*pulse];
    const shoulder:Point=lean?[185+18*pulse,105]:frog?[185,126]:[190,121-2*pulse];
    const nearKnee:Point=lean?[110,138]:frog?[181,120]:[111,119+3*pulse];
    const farKnee:Point=wide?[121,130]:off(nearKnee,-4,-3);
    const nearAnkle:Point=lean?[86,150]:frog?[142,128]:[79,118+4*pulse];
    const farAnkle:Point=wide?[90,137]:off(nearAnkle,-4,-3);
    const palms:[Limb,Limb]=maltese
      ? [[[164,140],[138,154]],[[205,139],[232,149]]]
      : frog?[[[180,141],[193,154]],[[169,134],[169,150]]]
      :[[[185,136],[181,155]],[[178,134],[173,150]]];
    return pose(
      [off(shoulder,17,frog?5:-2),shoulder,hip],palms,
      [[nearKnee,nearAnkle],[farKnee,farAnkle]],
      [off(nearAnkle,-8,lean?5:3),off(farAnkle,-8,lean?6:3)],
    );
  }
  return draw(rep.map(p=>frame(p*(lean?1:.48))),[],[],1020);
}

function sideReachStretch(): Illustration {
  function frame(reach:number) {
    const shoulder:Point=[164+9*reach,140];
    const hips:Point=[122-5*reach,144];
    return pose(
      [off(shoulder,16,3),shoulder,hips],
      [[[189+11*reach,146],[215+15*reach,153]],[[185+12*reach,141],[208+15*reach,149]]],
      [[[93,148],[61,151]],[[91,145],[62,147]]],
      [[54,154],[54,150]],
    );
  }
  return draw(rep.map(frame),[],[],1050);
}

function worldsGreatest(): Illustration {
  type Phase = "down" | "rotate" | "hamstring";
  function frame(kind: Phase): Point[] {
    const hi=kind==="rotate", straighten=kind==="hamstring";
    const hip:Point=straighten?[136,92]:[147,128];
    const shoulder:Point=hi?[163,107]:straighten?[171,117]:[180,113];
    const frontKnee:Point=straighten?[179,125]:[190,120];
    const reach: Limb=hi?[[167,81],[170,48]]:[[196,140],[204,154]];
    return pose(
      [off(shoulder,14,-10),shoulder,hip],
      [[[174,135],[171,154]],reach],
      [[frontKnee,[205,153]],[[103,136],[74,148]]],
      [[215,155],[71,156]],
    );
  }
  return draw([frame("down"),frame("rotate"),frame("rotate"),frame("down"),frame("hamstring"),frame("hamstring")],[],[],920);
}

export const legacyCoreSourceIllustrations: Readonly<Record<string, Illustration>> = {
  "0002": romanChair(true),
  "0138": floorCrunch("bottoms-up"),
  "0260": floorCrunch("cocoon"),
  "0443": floorCrunch("elbow-cycle"),
  "0464": sourcePlank("twist"),
  "0467": hangingKnees("gorilla"),
  "0472": hangingKnees("raise-bent"),
  "0474": hangingKnees("curl-straight"),
  "0484": floorCrunch("hip-curl"),
  "0488": romanChair(false),
  "0570": floorCrunch("bench"),
  "0689": coreBenchRaise(),
  "0709": captainSideTwist(),
  "0715": sourcePlank("hand-side"),
  "0870": sourcePlank("pike"),
  "1358": sideReachStretch(),
  "1764": hangingKnees("curl-bent"),
  "2312": floorCrunch("elbow-planted"),
  "2333": hangingKnees("sling-straight"),
  "2355": hangingKnees("sling-bent"),
  "3239": sourcePlank("kneeling-tap"),
  "3295": frontLever(false),
  "3296": frontLever(true),
  "3298": palmsBalance("straddle-planche"),
  "3299": palmsBalance("planche"),
  "3300": palmsBalance("lean"),
  "3301": palmsBalance("frog"),
  "3303": humanFlag(),
  "3314": palmsBalance("straddle-maltese"),
  "3315": palmsBalance("maltese"),
  "3544": sourcePlank("incline"),
  "3665": sourcePlank("power"),
  "4633": worldsGreatest(),
};
