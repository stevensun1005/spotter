import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Load = NonNullable<Illustration["dynamic"]>;
type Limb = [Point, Point];

function person(head: Point, shoulder: Point, hip: Point, arms: [Limb,Limb], legs: [Limb,Limb], toes: [Point,Point]) {
  return [head,shoulder,hip,...arms[0],...arms[1],...legs[0],...legs[1],...toes];
}

function motion(frames: Point[][], props: Props = [], load: Load = [], ms = 830): Illustration {
  return { frames,props,ms,reference:true,dynamic:[["foot-tip",8,11],["foot-tip",10,12],...load] };
}

function offset([x,y]: Point, dx: number, dy: number): Point {
  return [x+dx,y+dy];
}

function bosu(x: number,width = 52): Props {
  return [[x-width/2,157,x+width/2,157],[x-width/2,156,x-width*.34,146],
    [x-width*.34,146,x-width*.14,141],[x-width*.14,141,x+width*.16,141],
    [x+width*.16,141,x+width*.34,146],[x+width*.34,146,x+width/2,156]];
}

function skater(load: "none" | "plate" | "bosu" | "suspension") {
  const elevated = load === "bosu";
  const anchored = load === "suspension";
  const footY = elevated ? 138 : 155;
  const props: Props = elevated ? bosu(159) : anchored
    ? [[228,22,262,22],[243,13,243,23],[259,23,259,157],[245,158,270,158]] : [];
  const frame = (depth: number): Point[] => {
    const hip: Point = [147-depth*16,footY-64+depth*28];
    const shoulder: Point = [hip[0]+5+depth*12,hip[1]-39];
    const elbow = (near: boolean) => offset(shoulder,near? 19:11,near? 11:15);
    const hand = (near: boolean) => offset(shoulder,near? 40:35,anchored? 1 : near? 7:11);
    const planted: Point = [157,footY], lifted: Point = anchored ? [211,footY-20-depth*4] : [112-depth*16,footY-22-depth*8];
    const freeKnee: Point = anchored ? [179,footY-39-depth*4] : [132-depth*14,footY-38+(elevated? 33:32)*depth];
    return person(offset(shoulder,4,-16),shoulder,hip,[[elbow(true),hand(true)],[elbow(false),hand(false)]],
      [[[155+depth*10,footY-33+depth*9],planted],[freeKnee,lifted]],
      [offset(planted,11,2),offset(lifted,anchored?9:-7,anchored? -3:5)]);
  };
  const apparatus: Load = load === "plate" ? [["barbell-end",4,1,0]]
    : anchored ? [["cable",4,243,22],["cable",6,243,22],["ring",4,0,0],["ring",6,0,0]] : [];
  return motion([frame(0),frame(.45),frame(1),frame(1),frame(.52)],props,apparatus,850);
}

function squatSequence(action: "jump" | "high-knee" | "side-kick" | "twist" | "deep" | "band-open" | "upright-plate" | "box-sumo") {
  const blocks = action === "box-sumo";
  const tools: Props = blocks ? [[98,143,132,143],[98,144,98,158],[132,144,132,158],[175,143,209,143],[175,144,175,158],[209,144,209,158]] : [];
  const load: Load = action === "band-open" ? [["band",4,6]]
    : action === "upright-plate" ? [["barbell-end",13,0,0]]
    : blocks ? [["kettlebell",13,0,5]] : [];
  type State = [depth: number, side?: 1|-1, feetAir?: number, spreadBand?: boolean];
  const frame = ([depth,side,feetAir = 0,spreadBand = false]: State): Point[] => {
    const footY = (blocks ? 140 : 155) - feetAir;
    const hip: Point = [150,footY-64+depth*(action==="deep"? 42:36)];
    const shoulder: Point = [150,hip[1]-41];
    const handSpan = action==="band-open" ? spreadBand? 53:19 : action==="upright-plate" ? 9 : action==="twist" ? 6 : blocks ? 5 : 20;
    const armY = shoulder[1]+(action==="band-open"? 3 : blocks? 55:16);
    const centerHandX = action==="twist" && side ? shoulder[0]+side*23 : shoulder[0];
    const legSpan = blocks ? 42 : 23;
    const nearFoot: Point = [150+legSpan,footY], farFoot: Point = [150-legSpan,footY];
    let near: Limb = [[nearFoot[0]+depth*4,footY-32+depth*9],nearFoot];
    let far: Limb = [[farFoot[0]-depth*4,footY-32+depth*9],farFoot];
    if (side && action==="side-kick") {
      if (side>0) near = [[181,103],[207,96]];
      else far = [[119,103],[93,96]];
    }
    if (side && action==="high-knee") {
      if (side>0) near = [[168,87],[166,122]];
      else far = [[130,87],[134,122]];
    }
    const head = offset(shoulder,action==="twist" && side?side*8:0,-17);
    const arm: [Limb,Limb] = action==="jump" && feetAir
      ? [[[171,shoulder[1]+9],[177,shoulder[1]-13]],[[130,shoulder[1]+9],[123,shoulder[1]-13]]]
      : [[[168,shoulder[1]+14],[centerHandX+handSpan,armY]],[[132,shoulder[1]+14],[centerHandX-handSpan,armY]]];
    return [...person(head,shoulder,hip,arm,[near,far],[offset(near[1],7,2),offset(far[1],-7,2)]),[centerHandX,armY]];
  };
  const states: State[] = action==="jump" ? [[0],[.15],[.42],[.75],[1],[1],[0,undefined,11],[.45],[0]]
    : action==="band-open" ? [[0],[.8],[.8,undefined,0,true],[.8],[.8,undefined,0,true],[.8],[0]]
    : action==="high-knee" || action==="side-kick" || action==="twist" ? [[0],[1],[0,1],[0],[1],[0,-1],[0]]
    : [[0],[.45],[1],[1],[.42]];
  return motion(states.map(frame),tools,load,action==="jump"?560:790);
}

function compassSquat() {
  const steps: [number,number][] = [[0,-15],[19,-9],[28,0],[20,10],[0,17],[-20,10],[-28,0],[-20,-9]];
  const frame = (vector: [number,number],depth: number): Point[] => {
    const [vx,vy] = vector;
    const pelvis: Point = [150+.45*vx,99+depth*30+.33*vy];
    const shoulder = offset(pelvis,0,-40);
    const forward: Point = vx >= 0 ? [170+vx,153+vy] : [170,153];
    const other: Point = vx < 0 ? [132+vx,153+vy] : [132,153];
    return [...person(offset(shoulder,0,-17),shoulder,pelvis,
      [[offset(shoulder,19,17),offset(shoulder,6,12)],[offset(shoulder,-19,17),offset(shoulder,-6,12)]],
      [[offset(forward,-2,-32+depth*9),forward],[offset(other,2,-32+depth*9),other]],
      [offset(forward,9,1),offset(other,-9,1)]),offset(shoulder,0,12)];
  };
  const rest = frame([0,0],0);
  const frames = steps.flatMap(point=>[rest,frame(point,1),frame(point,1)]);
  return { ...motion(frames,[[125,157,175,157],[150,133,150,174],[115,146,185,167],[115,167,185,146]], [["hammer-weight",13,0,0]],720),topView:true };
}

function bosuLunge() {
  const planted: Point = [173,138];
  const make = (stage: "lunge" | "lift" | "step"): Point[] => {
    const low = stage==="lunge", raised = stage==="lift";
    const hip: Point = low ? [145,109] : raised ? [168,74] : [152,87];
    const shoulder = offset(hip,0,-38);
    const rearKnee: Point = low ? [118,149] : raised ? [203,68] : [128,119];
    const rearFoot: Point = low ? [91,144] : raised ? [204,101] : [112,153];
    return person(offset(shoulder,1,-17),shoulder,hip,
      [[offset(shoulder,17,15),offset(shoulder,raised? 29:10,raised? -2:26)],[offset(shoulder,-9,17),offset(shoulder,-17,30)]],
      [[low?[180,112]:[171,108],planted],[rearKnee,rearFoot]],[offset(planted,8,2),offset(rearFoot,raised?9:-5,raised?2:4)]);
  };
  return motion(["step","lunge","lift","lift","step"].map(s=>make(s as "lunge" | "lift" | "step")),bosu(173),[],790);
}

function rowingSquat() {
  const floorHands: [Point,Point] = [[126,146],[111,147]];
  function floor(stage: "plank" | "near-row" | "far-row" | "step"): Point[] {
    const step = stage==="step";
    const hips: Point = [181,step?89:112];
    const shoulder: Point = [126,99];
    const first: Limb = stage==="near-row" ? [[162,99],[157,124]] : [[126,123],floorHands[0]];
    const second: Limb = stage==="far-row" ? [[153,99],[151,124]] : [[116,124],floorHands[1]];
    const foot: Point = [step?167:244,154], other: Point = [step?181:232,153];
    return person([111,96],shoulder,hips,[first,second],[[[step?159:213,step?119:133],foot],[[step?176:206,step?122:134],other]],[offset(foot,-8,3),offset(other,-7,3)]);
  }
  function upright(squat: boolean): Point[] {
    const hips: Point = squat ? [139,121] : [165,91];
    const shoulder: Point = offset(hips,squat ? 21 : 5,squat ? -34 : -39);
    return person(offset(shoulder,0,-17),shoulder,hips,
      [[offset(shoulder,13,21),offset(shoulder,15,44)],[offset(shoulder,-4,22),offset(shoulder,-6,42)]],
      [[[179,squat?122:124],[168,155]],[[167,123],[158,154]]],[[179,156],[168,156]]);
  }
  return motion([floor("plank"),floor("near-row"),floor("plank"),floor("step"),upright(false),upright(true),upright(false),
    floor("step"),floor("plank"),floor("far-row"),floor("plank"),floor("step"),upright(false),upright(true),upright(false),floor("step")],
    [],[["dumbbell",4,0,1],["dumbbell",6,0,1]],780);
}

function gluteSequence(kind: "twist" | "march" | "small" | "hold-back" | "hold-standing") {
  if (kind === "hold-standing") {
    const make = (squeeze: boolean) => person([150,42],[150,59],[151,101],
      [[[166,81],[166,104]],[[135,80],[135,103]]],
      [[[163,129],[168,156]],[[138,129],[133,156]]],[[178,157],[123,157]])
      .map((p,i):Point => i===2 && squeeze ? offset(p,0,-2) : p);
    const rest = make(false), press = make(true);
    return motion([rest,press,press,press,rest],[],[],1550);
  }
  const arms: [Limb,Limb] = kind==="twist" ? [[[101,148],[76,151]],[[116,146],[129,156]]] : [[[111,152],[135,154]],[[106,150],[127,152]]];
  const frame = (height: number,side = 0): Point[] => {
    const hips: Point = [143,147-height+(kind==="twist"?Math.abs(side)*3:0)];
    const baseNear: Limb = [[180,111],[193,154]], baseFar: Limb = [[168,114],[184,154]];
    const moving = (near: boolean): Limb => kind==="march" && side===(near?1:-1)
      ? [[hips[0]+17,hips[1]-35],[hips[0]+41,hips[1]-17]]
      : kind==="twist" ? [offset(near?baseNear[0]:baseFar[0],side*15,Math.abs(side)*10),near?baseNear[1]:baseFar[1]]
      : near?baseNear:baseFar;
    const near = moving(true), far = moving(false);
    return person([78,146],[101,148],hips,arms,[near,far],[offset(near[1],8,3),offset(far[1],8,2)]);
  };
  const low = frame(0);
  if (kind==="hold-back") return motion([low,frame(2),frame(2),frame(2),frame(2),low],[],[],1500);
  if (kind==="small") return motion([frame(2),frame(10),frame(10),frame(10),frame(3)],[],[],940);
  const high = frame(23);
  return motion([low,high,frame(23,1),high,frame(23,-1),high],[],[],860);
}

function gluteIncline() {
  const hip: Point = [158,93], knee: Point = [132,119], foot: Point = [105,145];
  const rig: Props = [[104,155,151,102],[146,101,166,99],[155,101,176,158],[92,158,195,158],
    [99,147,118,147],[101,136,114,136],[99,137,110,151]];
  const frame = (deg: number): Point[] => {
    const a=deg*Math.PI/180;
    const shoulder: Point = [hip[0]+Math.cos(a)*43,hip[1]+Math.sin(a)*43];
    const head: Point = offset(shoulder,Math.cos(a+.13)*15,Math.sin(a+.13)*15);
    const spine = offset(hip,Math.cos(a)*23+1,Math.sin(a)*23-4);
    return [...person(head,shoulder,hip,
      [[offset(shoulder,6,16),offset(shoulder,12,7)],[offset(shoulder,-5,17),offset(shoulder,8,6)]],
      [[knee,foot],[offset(knee,-5,2),offset(foot,-5,2)]],[offset(foot,-8,3),offset(foot,-13,4)]),spine];
  };
  const result=motion([-46,-10,49,49,-8].map(frame),rig,[],940);
  return {...result,spine:[13]};
}

function pinnedPull() {
  const stance: [Limb,Limb] = [[[165,129],[165,155]],[[151,128],[151,154]]];
  const rig: Props = [[105,45,105,157],[201,45,201,157],[105,45,201,45],[98,157,209,157],
    [105,112,126,112],[180,112,201,112],[114,106,114,120],[193,106,193,120]];
  const frame = (engage: boolean): Point[] => {
    const shoulders: Point = engage ? [158,68] : [159,72];
    return [...person(offset(shoulders,6,-17),shoulders,[148,104],[[[172,91],[172,111]],[[155,91],[141,111]]],
      stance,[[175,157],[161,156]]),[114,110],[193,110]];
  };
  const ready=frame(false), placed=frame(true);
  return motion([ready,placed,placed,placed,ready],rig,[["bar",13,14],["barbell-end",13,0,0],["barbell-end",14,0,0]],1440);
}

function lyingSled() {
  const props: Props = [[80,133,137,135],[87,136,87,158],[123,134,123,158],
    [144,149,246,43],[151,156,253,50],[242,50,242,157],[253,51,253,157],[128,158,263,158]];
  const frame = (extend: boolean): Point[] => {
    const toe: Point = extend ? [198,87]:[179,105], ankle=offset(toe,-5,7);
    return [...person([75,120],[91,128],[133,127],[[[111,138],[126,135]],[[108,139],[119,135]]],
      [[extend?[166,112]:[158,100],ankle],[[145,145],[162,153]]],[toe,[168,156]]),
    offset(toe,-9,-18),offset(toe,10,18),offset(toe,15,5)];
  };
  return motion([frame(false),frame(true),frame(true)],props,[["bar",13,14],["barbell-end",15,0,0]],890);
}

function smithRearKick(withSpotter: boolean) {
  const rack: Props = [
    [66, 29, 66, 156], [123, 29, 123, 156], [66, 29, 123, 29],
    [72, 35, 72, 151], [116, 35, 116, 151], [59, 157, 130, 157],
    [67, 128, 77, 128], [110, 128, 122, 128],
  ];
  const heights = [123, 103, 82, 82, 103];
  const frames = heights.map((barY, phase) => {
    const knee: Point = phase === 0 ? [124, 151] : barY === 103 ? [109,134] : [100,117];
    return [
      ...person([189, 104], [176, 116], [132, 117],
        [[[178, 135], [180, 155]], [[172, 135], [172, 154]]],
        [[knee, [98, barY + 3]], [[136, 153], [108, 154]]],
        [[107, barY + 2], [101, 156]]),
      [72, barY] as Point, [116, barY] as Point,
    ];
  });
  const result = motion(frames, rack,
    [["bar", 13, 14], ["barbell-end", 13, -5, 0], ["barbell-end", 14, 5, 0]], 870);
  if (!withSpotter) return result;
  const partnerFrames = heights.map(barY => person([35, 44], [38, 61], [35, 103],
    [[[48, (barY+60)/2], [63, barY-3]], [[45, 89], [57, 95]]],
    [[[44, 128], [45, 154]], [[24, 128], [26, 154]]], [[53, 156], [32,156]]));
  return { ...result, partnerFrames };
}

export const lowerMovementSequenceIllustrations: Readonly<Record<string,Illustration>> = {
  "0822":squatSequence("twist"),
  "10191":compassSquat(),
  "10764":lyingSled(),
  "1136":skater("suspension"),
  "11646":gluteSequence("hold-back"),
  "11653":gluteSequence("hold-standing"),
  "1183":smithRearKick(false),
  "1400":squatSequence("side-kick"),
  "2751":squatSequence("box-sumo"),
  "2952":smithRearKick(true),
  "3394":gluteSequence("march"),
  "3412":gluteSequence("small"),
  "4028":squatSequence("band-open"),
  "4129":skater("plate"),
  "4363":skater("none"),
  "4435":squatSequence("high-knee"),
  "4629":rowingSquat(),
  "4937":gluteIncline(),
  "5051":gluteSequence("twist"),
  "5478":bosuLunge(),
  "6336":squatSequence("jump"),
  "8220":squatSequence("deep"),
  "8479":skater("bosu"),
  "9607":pinnedPull(),
  "10097":squatSequence("upright-plate"),
};
