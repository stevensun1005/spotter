import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Gear = NonNullable<Illustration["dynamic"]>;

function shift([x, y]: Point, dx: number, dy: number): Point { return [x + dx, y + dy]; }

function pose(
  body: [Point, Point, Point], arms: [Limb, Limb], legs: [Limb, Limb],
  toes: [Point, Point] = [shift(legs[0][1], 8, 1), shift(legs[1][1], 8, 1)],
): Point[] {
  return [...body, ...arms[0], ...arms[1], ...legs[0], ...legs[1], ...toes];
}

function draw(frames: Point[][], props: Props = [], gear: Gear = [], ms = 845): Illustration {
  return { frames, props, dynamic: [["foot-tip",8,11],["foot-tip",10,12],...gear], ms, reference: true };
}

const phases = [0, .28, .72, 1, 1, .62, .25];
const bench = (start: number, end: number, y: number): Props => [
  [start,y,end,y],[start+5,y,start+5,154],[end-5,y,end-5,154],[start,155,end,155],
];

function assistedStretch(prone: boolean): Illustration {
  function scene(degree: number) {
    const knee: Point = prone ? [131,146] : [135,116-13*degree];
    const ankle: Point = prone ? [102+28*degree,148-35*degree] : [99+21*degree,134-23*degree];
    const patient = pose(
      prone ? [[217,144],[201,145],[153,146]] : [[222,145],[205,145],[153,145]],
      prone ? [[[207,154],[225,153]],[[212,148],[224,148]]] : [[[212,151],[234,153]],[[203,149],[228,153]]],
      [[knee,ankle],prone ? [[127,150],[97,154]] : [[169,120],[143,115-10*degree]]],
      [shift(ankle,-8,2),prone ? [87,156] : [133,117-10*degree]],
    );
    const spotter = pose(
      [[95+14*degree,87],[90+12*degree,104],[74+9*degree,133]],
      [[[101+15*degree,118],shift(ankle,-2,1)],[[104+12*degree,115],shift(prone?ankle:knee,4,2)]],
      [[[99,142],[105,152]],[[65,151],[42,151]]],
      [[113,154],[35,154]],
    );
    return { patient, spotter };
  }
  const scenes=phases.map(scene);
  return { ...draw(scenes.map(frame=>frame.patient),[],[],1000), partnerFrames:scenes.map(frame=>frame.spotter) };
}

function boxBarbellSquat(front: boolean): Illustration {
  function frame(depth: number) {
    const hips: Point = [154-6*depth,91+36*depth];
    const shoulder = shift(hips,5+5*depth,-41+2*depth);
    const grip = shift(shoulder,front?8:0,-4);
    return pose(
      [shift(shoulder,3,-16),shoulder,hips],
      [[shift(shoulder,front?21:-10,front?2:19),shift(grip,-12,2)],
        [shift(shoulder,front?25:20,front?4:20),shift(grip,20,-4)]],
      [[[145+9*depth,120+8*depth],[140,153]],[[168+11*depth,118+7*depth],[162,150]]],
    );
  }
  return draw(phases.map(frame),bench(103,158,134),[["bar",4,6],["barbell-end",4,-5,1],["barbell-end",6,5,-1]],850);
}

function proneDumbbellCurl(): Illustration {
  function frame(curl: number): Point[] {
    const knee: Point = [164,104];
    const ankle: Point = [164+41*Math.cos(curl*1.35),104-41*Math.sin(curl*1.35)];
    return [
      ...pose([[90,94],[107,101],[148,103]],[[[98,119],[100,128]],[[105,119],[106,126]]],
        [[knee,ankle],[shift(knee,-5,3),shift(ankle,-6,5)]],[shift(ankle,5,-5),shift(ankle,-1,-1)]),
      shift(ankle,-1,3),
    ];
  }
  return draw(phases.map(frame),bench(81,163,112),[["dumbbell",13,0,-2]]);
}

function narrowFrontDeadlift(): Illustration {
  function frame(lift: number): Point[] {
    const hip: Point = [153,121-30*lift];
    const shoulder = shift(hip,0,-26-15*lift);
    const handY=151-38*lift;
    return pose(
      [shift(shoulder,0,-16),shoulder,hip],
      [[[125,handY-22],[126,handY]],[[181,handY-22],[179,handY]]],
      [[[138,129-6*lift],[140,153]],[[170,129-6*lift],[168,153]]],
      [[133,156],[176,156]],
    );
  }
  return draw(phases.map(frame),[],[["bar",4,6],["barbell-end",4,-12,0],["barbell-end",6,12,0]],780);
}

function groundStretch(mode: "quad-quadruped" | "quad-strap" | "hip-rotation" | "frog"): Illustration {
  const band: Gear = mode === "quad-strap" ? [["band",4,8],["band",6,8]]
    : mode==="hip-rotation" ? [["band",8,248,84]] : [];
  function frame(amount: number): Point[] {
    if(mode==="quad-strap"){
      const foot: Point=[178-27*amount,95-17*amount];
      return pose([[72,138],[90,142],[137,145]],
        [[[82,155],[63,151]],[[91,154],[70,148]]],
        [[[180,147],foot],[[175,143],[224,148]]],[shift(foot,7,-7),[232,150]]);
    }
    if(mode==="hip-rotation"){
      const workFoot: Point=[214-49*amount,101+16*amount];
      return pose([[89,141],[107,146],[156,146]],[[[93,157],[74,153]],[[106,155],[82,153]]],
        [[[182,148],workFoot],[[195,150],[229,154]]],[shift(workFoot,8,-5),[238,155]]);
    }
    if(mode==="frog"){
      const hip: Point=[157+18*amount,116+7*amount];
      const shoulder=shift(hip,-45+7*amount,-10);
      return pose([[shoulder[0]-16,shoulder[1]+1],shoulder,hip],
        [[[100,151],[70,153]],[[111,148],[83,149]]],
        [[[171,153],[212,152]],[[147,147],[192,144]]],[[223,154],[202,145]]);
    }
    const shoulder: Point=[107,103];
    const ankle: Point=[209-30*amount,149-51*amount];
    return pose([[90,101],shoulder,[154,110]],
      [[[101,131],[102,154]],[[123+29*amount,125-14*amount],amount>.26?shift(ankle,-3,1):[123,152]]],
      [[[163,153],[201,151]],[[161+24*amount,149-13*amount],ankle]],[[210,154],shift(ankle,7,1)]);
  }
  return draw(phases.map(frame),[],band,1000);
}

function stepBenchLunge(): Illustration {
  const decks: Props=[...bench(75,124,126),...bench(186,232,130)];
  function frame(depth: number) {
    const hips: Point=[155-6*depth,97+7*depth];
    const sh=shift(hips,-3,-39);
    const front:Point=[140-38*depth,154-31*depth];
    return pose([shift(sh,-2,-16),sh,hips],
      [[shift(sh,-6,24),shift(sh,-7,44)],[shift(sh,8,23),shift(sh,10,42)]],
      [[[140-34*depth,119-16*depth],front],[[168+5*depth,133],[202,126]]],
      [shift(front,-10,1),[208,129]]);
  }
  return draw(phases.map(frame),decks,[["dumbbell",4,0,0],["dumbbell",6,0,0]],875);
}

function bandBoxStep(): Illustration {
  const stage=bench(147,206,132);
  function frame(phase: number): Point[] {
    const hips: Point=[131+14*phase,96-11.5*phase];
    const shoulder=shift(hips,0,-42);
    const near: Point=phase>=1?[158,128]:[123,154];
    const far: Point=phase>=2?[176,128]:[132,153];
    return pose(
      [shift(shoulder,1,-16),shoulder,hips],
      [[shift(shoulder,12,19),shift(shoulder,17,-2)],[shift(shoulder,2,18),shift(shoulder,6,-3)]],
      [[[near[0]+(phase===1?7:0),near[1]-31],near],[[far[0]-4,far[1]-29],far]],
    );
  }
  return draw([0,1,2,2,1,0].map(frame),stage,[["band",4,11],["band",6,11]],850);
}

function NordicOrGhd(ghd: boolean): Illustration {
  const benchProps: Props=ghd?[[109,123,169,123],[112,126,112,154],[166,125,166,154],[99,155,189,155],[74,137,115,137],[80,143,80,154]]
    : [[70,148,180,148],[70,152,180,152],[75,152,75,157],[173,152,173,157],[87,139,87,151]];
  function frame(depth: number) {
    const knee: Point=ghd?[146,117]:[139,143];
    const hip=shift(knee,29*depth,-35+31*depth);
    const shoulder=shift(hip,35*depth,-38+33*depth);
    const sideHand: Point=depth>.7&&!ghd ? [232,155]:shift(shoulder,7*depth,13);
    return pose(
      [shift(shoulder,5+12*depth,-16+13*depth),shoulder,hip],
      [[shift(shoulder,17*depth,19),sideHand],[shift(shoulder,10*depth,16),shift(sideHand,-8,-2)]],
      [[knee,ghd?[85,124]:[86,144]],[shift(knee,-6,4),ghd?[80,128]:[81,146]]],
      ghd?[[75,130],[70,134]]:[[80,146],[75,148]]);
  }
  return draw(phases.map(frame),benchProps,[["pad",8,0,-4]],890);
}

function sideAdduction(): Illustration {
  const benchProps=bench(63,109,113);
  function frame(adduct: number) {
    const low:Point=[77,151-32*adduct];
    return pose([[223,107],[204,119],[150,127]],[[[203,151],[236,153]],[[178,104],[158,123]]],
      [[[112,139-15*adduct],low],[[115,118],[82,109]]],
      [shift(low,-8,1),[74,110]]);
  }
  return draw(phases.map(frame),benchProps,[],930);
}

function matsSideSplit(): Illustration {
  function frame(lift: number): Point[] {
    const hip: Point=[151,145];
    const shoulder=shift(hip,8-8*lift,-24-17*lift);
    const arms: [Limb,Limb]=[
      [[137-3*lift,139-14*lift],[133-7*lift,153-14*lift]],
      [[175+2*lift,139-14*lift],[172+7*lift,153-14*lift]],
    ];
    return [
      ...pose(
        [shift(shoulder,0,-16),shoulder,hip],arms,
        [[[111,149],[69,152]],[[191,147],[230,149]]],[[62,154],[235,141]],
      ),
      shift(shoulder,-12,2),shift(shoulder,12,2),
    ];
  }
  return { ...draw(phases.map(frame),[],[],1020), shoulders:[13,14] };
}

function assistedSquattingRow(): Illustration {
  const ladder: Props = [[202,32,202,157],[222,32,222,157]];
  for (let y = 44; y <= 144; y += 12) ladder.push([202,y,222,y]);
  function frame(pull:number):Point[] {
    const hip:Point=[133+14*pull,132];
    const shoulder:Point=[142+23*pull,91];
    return pose([shift(shoulder,3,-15),shoulder,hip],
      [[[171+17*pull,99+6*pull],[204,92]],[[166+17*pull,94+6*pull],[206,83]]],
      [[[172,130],[176,153]],[[161,129],[164,151]]]);
  }
  return draw(phases.map(frame),ladder,[],810);
}


function squatJerk(): Illustration {
  const poseAt=(phase:"rack"|"dip"|"drive"|"catch"|"stand"):Point[]=>{
    const tucked=phase==="dip" || phase==="catch";
    const overhead=phase==="drive" || phase==="catch" || phase==="stand";
    const pelvis:Point=[151,phase==="catch"?130:phase==="dip"?105:93];
    const shoulder=shift(pelvis,0,-41);
    const barY=shoulder[1]-(overhead?42:3);
    const nearFoot:Point=[phase==="catch"?117:131,152];
    const farFoot:Point=[phase==="catch"?185:171,152];
    return pose(
      [shift(shoulder,0,-16),shoulder,pelvis],
      [[[128,overhead?barY+21:shoulder[1]+13],[124,barY]],[[174,overhead?barY+21:shoulder[1]+13],[178,barY]]],
      [[[nearFoot[0]-5,tucked?126:121],nearFoot],[[farFoot[0]+5,tucked?126:121],farFoot]],
      [shift(nearFoot,-9,3),shift(farFoot,9,3)],
    );
  };
  return draw((["rack","dip","drive","catch","catch","stand","rack"] as const).map(poseAt),[],
    [["bar",4,6],["barbell-end",4,-11,0],["barbell-end",6,11,0]],690);
}

function loadedKasBridge(load: "barbell" | "dumbbell" | "unilateral"): Illustration {
  const block:Props=[[71,120,129,120],[70,120,70,152],[130,120,130,152],[70,152,130,152]];
  const attachments:Gear=load==="barbell"?[["bar",13,14],["barbell-end",13,-3,1],["barbell-end",14,3,-1]]
    :load==="dumbbell"?[["dumbbell",2,0,-6]]:[];
  function frame(thrust: number) {
    const hip:Point=[150,129-17*thrust];
    const offLeg:Limb=load==="unilateral"?[[190,96-10*thrust],[221,103-18*thrust]]:[[179,108-3*thrust],[188,151]];
    return [
      ...pose(
        [[92,104],[111,110],hip],
        [[[134,118],shift(hip,-1,-5)],[[128,112],shift(hip,6,-5)]],
        [[[190,110-6*thrust],[203,154]],offLeg],
      ),
      shift(hip,-10,-2),shift(hip,9,-7),
    ];
  }
  return draw(phases.map(frame),block,attachments,880);
}

function bandExercises(mode: "kick" | "bridge" | "split" | "row"): Illustration {
  const props: Props=mode==="kick"?[[242,33,242,156],[233,156,258,156],[219,85,250,85]]
    :mode==="split"?bench(63,109,128)
    :mode==="row"?[[253,47,253,156],[245,156,263,156]]:[];
  const equipment:Gear=mode==="kick"?[["band",8,242,135]]
    :mode==="bridge"?[["band",2,13],["band",2,14],["plate",13,0,0],["plate",14,0,0]]
    :mode==="split"?[["band",4,235,147]]
    :[["band",4,253,90],["band",6,253,93]];
  function frame(amount:number):Point[] {
    if(mode==="kick"){
      const foot:Point=[152-72*amount,148-33*amount];
      return pose([[167,71],[149,83],[132,117]],[[[180,84],[216,85]],[[175,90],[207,88]]],
        [[[137-25*amount,129-13*amount],foot],[[135,136],[142,154]]],[shift(foot,5,2),[151,155]]);
    }
    if(mode==="bridge"){
      const hip:Point=[159,144-22*amount];
      return [
        ...pose([[91,139],[110,146],hip],[[[112,152],[120,155]],[[111,148],[130,153]]],
          [[[197,122],[204,154]],[[185,122],[193,153]]]),
        [117,153],[133,152],
      ];
    }
    if(mode==="split"){
      const hip:Point=[143-6*amount,95+29*amount];
      const shoulder=shift(hip,4+4*amount,-41);
      return pose([shift(shoulder,3,-16),shoulder,hip],
        [[shift(shoulder,13,20),shift(shoulder,18,39)],[shift(shoulder,-5,25),shift(hip,-3,-3)]],
        [[[158+8*amount,121+8*amount],[153,153]],[[119,138-3*amount],[103,125]]],
        [[162,156],[95,125]]);
    }
    const high=amount;
    const hip:Point=[136+10*high,133-37*high];
    const shoulder=shift(hip,9,-40);
    return pose([shift(shoulder,3,-15),shoulder,hip],
      [[[185-21*high,94-10*high],[214-32*high,94-18*high]],
        [[178-23*high,89-12*high],[205-34*high,88-18*high]]],
      [[[164,127-7*high],[169,153]],[[153,128-8*high],[156,151]]]);
  }
  return draw(phases.map(frame),props,equipment,850);
}

function contralateralLunge(): Illustration {
  function frame(depth:number) {
    const hip:Point=[147+5*depth,96+26*depth];
    const shoulder=shift(hip,2,-40);
    const ankle:Point=[159+33*depth,153];
    return pose([shift(shoulder,4,-17),shoulder,hip],
      [[shift(shoulder,-5,23),shift(shoulder,-8,43)],[shift(shoulder,16,14),shift(hip,5,-7)]],
      [[[162+23*depth,123-3*depth],ankle],[[140-9*depth,123+23*depth],[145-28*depth,151]]],
      [shift(ankle,9,2),[152-28*depth,156]]);
  }
  return draw(phases.map(frame),[],[["dumbbell",4,0,0]],840);
}

function dumbbellLower(action: "sumo-two" | "sumo-through" | "supported" | "neutral" | "front"): Illustration {
  const station: Props=action==="supported"?[[133,119,133,151],[126,120,137,120],[153,137,153,156],[130,154,185,154],[136,151,161,151]]:[];
  const weights:Gear=action==="supported"?[["dumbbell",13,0,0],["pad",14,0,0],["pad",15,0,0]]:action==="sumo-through"?[["dumbbell",13,0,0]]:[["dumbbell",4,0,0],["dumbbell",6,0,0]];
  function frame(depth:number): Point[] {
    const wide=action==="sumo-two" || action==="sumo-through";
    const support=action==="supported";
    const hinge=action==="neutral" || action==="front" || action==="sumo-through";
    const hp:Point=[150-(hinge?15*depth:3*depth),95+35*depth];
    const s=shift(hp,hinge?2+19*depth:1,-41+15*depth);
    const left:Point=[wide?120:145,154];
    const right:Point=[wide?181:162,151];
    const held:Point=support?shift(s,14,12):action==="sumo-through"?shift(hp,-16*depth,18):[150,125+19*depth];
    const palms: [Limb,Limb]=support
      ?[[shift(s,13,18),shift(held,-3,-2)],[shift(s,19,20),shift(held,3,-2)]]
      :action==="sumo-through"
        ?[[shift(s,1,20),shift(held,2,-2)],[shift(s,9,20),shift(held,6,-3)]]
        :[[shift(s,action==="front"?9:-8,19),shift(held,action==="front"?0:-10,-2)],
          [shift(s,18,17),shift(held,action==="front"?17:13,-5)]];
    return [
      ...pose([shift(s,4,-16),s,hp],palms,
        [[[left[0]-9*depth,120+7*depth],left],[[right[0]+6*depth,118+8*depth],right]],
        [[left[0]-8,156],[right[0]+8,152]]),
      held,[133,128],[151,146],
    ];
  }
  return draw(phases.map(frame),station,weights,815);
}

function sideFoamGlide(): Illustration {
  function frame(roll:number): Point[] {
    const hips:Point=[149-11*roll,128];
    const shoulder=shift(hips,48,-18);
    return [
      ...pose(
        [shift(shoulder,19,1),shoulder,hips],
        [[[202,148],[218,153]],[[180,131],[175,153]]],
        [[[164-7*roll,137],[156,154]],[[115-8*roll,134],[80,142]]],
        [[148,156],[70,143]],
      ),
      [137,143],
    ];
  }
  return draw(phases.map(frame),[],[["foam-roller",13,0,0]],920);
}

function horizontalHyperextension(): Illustration {
  function frame(lift:number) {
    const nearAnkle:Point=[221+8*lift,153-48*lift];
    return pose([[92,94],[109,99],[153,101]],[[[106,116],[94,115]],[[113,114],[102,112]]],
      [[[185,124-21*lift],nearAnkle],[[178,121-21*lift],shift(nearAnkle,-5,-4)]]);
  }
  return draw(phases.map(frame),bench(79,159,111),[],900);
}

function calfPress(supine: boolean): Illustration {
  const rails:Props=supine?[
    [70,127,199,127],[66,134,214,134],[81,132,81,156],[174,133,174,156],[229,52,229,157],
    [242,52,242,157],[229,52,242,52],[204,155,256,155],[65,155,243,155],
  ]:[
    [83,89,101,132],[92,86,111,130],[78,154,104,126],[102,131,172,131],[73,155,229,155],
    [182,155,212,118],[218,155,214,102],[207,149,220,149],
  ];
  const gear:Gear=[["bar",13,14]];
  if(!supine)gear.push(["bar",15,13],["plate",15,0,0]);
  function frame(flex:number): Point[] {
    const toe:Point=[213+8*flex,supine?112:116];
    const ankle:Point=[toe[0]-11+4*flex,toe[1]+9-8*flex];
    const body:[Point,Point,Point]=supine?[[79,111],[98,118],[148,118]]:[[88,74],[97,91],[113,119]];
    const knee:Point=supine?[175,118]:[158,113];
    return [
      ...pose(body,[[[116,126],[139,130]],[[107,121],[128,125]]],
        [[knee,ankle],[shift(knee,-6,4),shift(ankle,-5,3)]],[toe,shift(toe,-3,4)]),
      shift(toe,2,8),shift(toe,-2,-24),[197,144],
    ];
  }
  return draw(phases.map(frame),rails,gear,880);
}

function reformerOverhead(): Illustration {
  const frame:Props=[
    [71,130,242,130],[68,137,247,137],[71,136,71,154],[241,137,241,154],
    [59,154,255,154],[224,129,234,102],[234,102,239,103],[76,127,76,105],[69,105,83,105],
  ];
  type Pose=[Point, Point, Point, Point, Point];
  function make([hip, knee, foot, elbow, hand]:Pose):Point[] {
    return [
      ...pose(
        [[96,114],[117,119],hip],
        [[elbow,hand],[shift(elbow,-5,-4),shift(hand,-4,-3)]],
        [[knee,foot],[shift(knee,-5,2),shift(foot,-6,3)]],
        [shift(foot,7,-5),shift(foot,2,-2)],
      ),
      [88,127],[191,127],
    ];
  }
  const start:Pose=[[159,120],[190,111],[218,102],[124,98],[133,81]];
  const rollover:Pose=[[148,88],[118,75],[90,65],[141,122],[169,124]];
  const up:Pose=[[133,82],[139,53],[147,27],[141,122],[167,124]];
  const low:Pose=[[157,119],[176,95],[198,74],[143,118],[163,119]];
  return draw([start,low,rollover,up,up,rollover,low].map(make),frame,
    [["cable",4,76,105],["cable",6,76,105],["bar",13,14]],950);
}

function circularForwardFold(): Illustration {
  const start=()=>frame(0,0,true);
  function frame(fold:number,sweep:number,overhead=false) {
    const hip:Point=[149,97];
    const shoulder:Point=[151+26*fold,54+55*fold];
    const hand:Point=overhead?[148,23]:[169+27*fold+25*sweep,83+66*fold-20*Math.abs(sweep)];
    return pose([shift(shoulder,6*fold,-16+25*fold),shoulder,hip],
      [[overhead?[153,37]:shift(shoulder,10+10*sweep,11),hand],
        [overhead?[149,37]:shift(shoulder,3+9*sweep,15),shift(hand,-4,3)]],
      [[[150,125],[145,154]],[[141,124],[137,151]]]);
  }
  return draw([start(),frame(.4,.65),frame(1,.1),frame(.72,-.65),frame(.15,-.4),start()],[],[],920);
}

export const legacyLowerSourceIllustrations: Readonly<Record<string, Illustration>> = {
  "0016": assistedStretch(true),
  "0024": boxBarbellSquat(true),
  "0026": boxBarbellSquat(false),
  "0339": proneDumbbellCurl(),
  "0786": squatJerk(),
  "0967": narrowFrontDeadlift(),
  "0980": bandExercises("kick"),
  "0984": groundStretch("hip-rotation"),
  "0987": bandExercises("split"),
  "1003": bandExercises("row"),
  "1008": bandBoxStep(),
  "1408": bandExercises("bridge"),
  "1423": horizontalHyperextension(),
  "1512": groundStretch("quad-quadruped"),
  "1564": groundStretch("quad-strap"),
  "1710": assistedStretch(false),
  "1766": NordicOrGhd(false),
  "1775": sideAdduction(),
  "2205": sideFoamGlide(),
  "2289": calfPress(false),
  "2323": dumbbellLower("sumo-two"),
  "2334": calfPress(true),
  "2571": groundStretch("frog"),
  "2796": stepBenchLunge(),
  "2803": dumbbellLower("supported"),
  "2808": dumbbellLower("sumo-through"),
  "3168": assistedSquattingRow(),
  "3193": NordicOrGhd(true),
  "3215": circularForwardFold(),
  "3458": matsSideSplit(),
  "3635": contralateralLunge(),
  "4914": dumbbellLower("neutral"),
  "5119": dumbbellLower("front"),
  "5451": loadedKasBridge("barbell"),
  "5554": loadedKasBridge("dumbbell"),
  "5671": loadedKasBridge("unilateral"),
  "10856": reformerOverhead(),
};
