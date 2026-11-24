import type { Illustration, Point } from "./motion-data";

type Segment = [Point, Point];
type Equipment = Pick<Illustration, "props" | "dynamic">;
type Body = [Point, Point, Point];
// The renderer's order is head, shoulder, hip, then both arms and both legs.
const pose = (body: Body, nearArm: Segment, farArm: Segment, nearLeg: Segment, farLeg: Segment): Point[] =>
  [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg];

function demo(frames: Point[][], equipment: Equipment = {}, ms = 720): Illustration {
  return { frames, ...equipment, ms, reference: true };
}

// Repeated hold frames show the stable position, surrounded by the setup and release.
const hold = (setup: Point[], position: Point[], gear?: Equipment) =>
  demo([setup, position, position, position, position, position], gear);

const lowBody: Body = [[219, 91], [197, 102], [143, 126]];
const highBody: Body = [[219, 64], [197, 79], [143, 112]];
const lowNearArm: Segment = [[197, 154], [224, 155]];
const lowFarArm: Segment = [[185, 154], [210, 155]];
const highNearArm: Segment = [[197, 117], [197, 155]];
const highFarArm: Segment = [[184, 118], [184, 155]];
const lowNearLeg: Segment = [[105, 142], [63, 155]];
const lowFarLeg: Segment = [[100, 143], [58, 155]];
const highNearLeg: Segment = [[103, 134], [63, 155]];
const highFarLeg: Segment = [[98, 136], [58, 155]];
const restNear: Segment = [[108, 153], [63, 155]];
const restFar: Segment = [[103, 154], [58, 155]];

function front(high: boolean, change: Partial<{
  body: Body; nearArm: Segment; farArm: Segment; nearLeg: Segment; farLeg: Segment;
}> = {}) {
  return pose(change.body ?? (high ? highBody : lowBody),
    change.nearArm ?? (high ? highNearArm : lowNearArm),
    change.farArm ?? (high ? highFarArm : lowFarArm),
    change.nearLeg ?? (high ? highNearLeg : lowNearLeg),
    change.farLeg ?? (high ? highFarLeg : lowFarLeg));
}

const low = front(false);
const high = front(true);
const lowRest = front(false, { body: [[213, 106], [194, 115], [142, 137]], nearLeg: restNear, farLeg: restFar });
const highRest = front(true, { body: [[213, 70], [194, 86], [141, 133]], nearLeg: restNear, farLeg: restFar });
const loweredKnee = (high: boolean) => front(high, {
  body: high ? [[218, 68], [196, 84], [144, 130]] : [[218, 99], [196, 109], [144, 136]],
  nearLeg: [[111, 154], [76, 151]], farLeg: [[104, 154], [69, 151]],
});

function armLift(high: boolean) {
  const base = high ? highBody : lowBody;
  const [, [x,y]] = base;
  const reach: Segment = [[x+32,y-13],[x+64,y-22]];
  const farReach: Segment = [[x+22,y-14],[x+53,y-23]];
  return demo([front(high), front(high, { nearArm: reach }),
    front(high), front(high, { farArm: farReach })]);
}

const legLift = demo([low, front(false, { nearLeg:[[101,126],[60,128]] }), low,
  front(false,{ farLeg:[[96,128],[56,132]] })]);

const steppedUp = demo([low,
  front(false, { body: [[220, 79], [196, 91], [143, 119]], nearArm: [[206, 124], [197, 155]] }),
  high,
  front(false, { body: [[220, 80], [195, 94], [143, 120]], farArm: [[183, 125], [184, 155]] }),
  low,
  front(false, { body: [[220, 79], [196, 91], [143, 119]], farArm: [[182, 124], [185, 155]] }),
  high,
  front(false, { body: [[220, 81], [195, 94], [143, 120]], nearArm: [[201, 126], [198, 155]] })], {}, 520);

const saw = demo([
  low,
  front(false, { body: [[231,90],[209,102],[155,126]], nearLeg: [[116,142],[74,154]], farLeg: [[111,144],[69,154]] }),
  low,
  front(false, { body: [[210,92],[187,104],[133,127]], nearLeg: [[94,141],[54,154]], farLeg: [[89,143],[50,154]] }),
]);

const pikeBody: Body = [[201, 91], [184, 82], [141, 34]];
const dog = front(true,{ body: pikeBody, nearArm:[[185,118],[197,155]], farArm:[[172,116],[184,155]],
  nearLeg:[[109,93],[73,155]], farLeg:[[100,93],[64,155]] });
const pikeSlide = front(true,{ body: [[204,88],[184,77],[130,27]], nearArm:[[187,116],[197,155]],
  farArm:[[176,116],[184,155]], nearLeg:[[131,92],[132,155]], farLeg:[[123,92],[121,155]] });
const towels: Equipment = { dynamic: [["slider",8,0,2],["slider",10,0,2]] };

const wideNear: Segment = [[108,137],[69,162]];
const wideFar: Segment = [[91,117],[45,143]];
const jumpPlank = (onForearms: boolean, jump: boolean) => {
  const together = front(!onForearms);
  const apart = front(!onForearms, {
    nearLeg: onForearms ? [[110,146],[74,162]] : wideNear,
    farLeg: onForearms ? [[89,127],[45,142]] : wideFar,
  });
  const airborne = front(!onForearms, { nearLeg:[[105,127],[64,145]],farLeg:[[95,126],[54,143]] });
  return jump ? demo([together,airborne,apart,airborne],{}, 370) : demo([together,apart],towels);
};

const alternatingToeTap = demo([high,
  front(true, { nearLeg: wideNear }), high,
  front(true, { farLeg: wideFar })]);
const tapKnee = demo([high,
  front(true, { nearLeg:[[113,154],[65,155]] }), high,
  front(true, { farLeg:[[108,154],[60,155]] })]);
const kneeToElbow = demo([high,
  front(true, { nearLeg:[[190,121],[145,138]] }), high,
  front(true, { farLeg:[[180,120],[136,133]] })]);

const bearBody: Body = [[204,81],[181,93],[127,96]];
const bearArms: [Segment,Segment] = [[[181,123],[182,155]],[[168,124],[169,155]]];
const bearFeet: [Segment,Segment] = [[[119,144],[83,155]],[[108,143],[71,155]]];
const bear = (legs: [Segment,Segment]) => pose(bearBody,...bearArms,...legs);
const bearHover = bear(bearFeet);
const bearRest = bear([[[119,155],[83,155]],[[108,154],[71,155]]]);
const bearKick = demo([bearHover,bear([[[87,103],[50,107]],bearFeet[1]]),bearHover,
  bear([bearFeet[0],[[81,105],[44,110]]])]);

type SideChange = Partial<{ body: Body; topArm: Segment; bottomArm: Segment; topLeg: Segment; bottomLeg: Segment }>;
const sideBody: Body = [[204,76],[186,91],[142,118]];
const sideBottomArm: Segment = [[193,151],[219,154]];
const sideTopArm: Segment = [[160,102],[148,116]];
const sideBottomLeg: Segment = [[102,139],[62,155]];
const sideTopLeg: Segment = [[99,137],[57,152]];
const sideTopLift: Segment = [[105,111],[68,108]];
const side = (change: SideChange = {}) => pose(change.body ?? sideBody, change.topArm ?? sideTopArm,
  change.bottomArm ?? sideBottomArm,change.topLeg ?? sideTopLeg,change.bottomLeg ?? sideBottomLeg);
const otherSide = (frame: Point[]): Point[] => frame.map(([x, y]) => [320-x,y]);
const sideLine = side();
const sideRest = side({ body:[[202,97],[184,114],[139,145]], topLeg:[[100,151],[57,153]],bottomLeg:[[102,155],[62,156]] });
const kneeSideBottom: Segment = [[106,153],[72,154]];
const kneeSideTop: Segment = [[103,151],[69,151]];
const kneeSide = side({ topLeg:kneeSideTop,bottomLeg:kneeSideBottom });
const kneeSideRest = side({ body:[[202,96],[185,113],[142,149]], topLeg:kneeSideTop,bottomLeg:kneeSideBottom });

const sideLifted = side({topLeg:sideTopLift});
const sideLift = (oneSide = false) => demo(oneSide ? [otherSide(sideLine),otherSide(sideLifted)] : [sideLine,sideLifted]);
const sideLiftHold = (oneSide = false) => hold(oneSide ? otherSide(sideLine) : sideLine, oneSide ? otherSide(sideLifted) : sideLifted);
const crunchTop: Segment = [[176,68],[202,76]];
const sideCrunchSet = side({ topArm:crunchTop,topLeg:sideTopLift });
const sideCrunchMid = side({body:[[194,95],[179,104],[142,118]],
  topArm:[[158,108],[193,89]],topLeg:[[156,110],[115,121]]});
const sideCrunch = (oneSide = false) => demo(oneSide ? [otherSide(sideCrunchSet),otherSide(sideCrunchMid)] : [sideCrunchSet,sideCrunchMid]);
const sideRotation = demo([side({topArm:[[184,57],[180,26]]}),
  side({body:[[204,85],[184,104],[141,122]],topArm:[[158,128],[133,142]]})]);

const reverseLimbs: [Segment,Segment] = [[[185,137],[228,156]],[[179,141],[221,156]]];
const reverseHands: [Segment,Segment] = [[[103,118],[104,155]],[[91,120],[89,155]]];
const reverseElbows: [Segment,Segment] = [[[105,154],[133,155]],[[93,154],[122,154]]];
const reverse = (elbow: boolean, resting: boolean) => pose(
  resting ? [[94,74],[106,97],[143,150]] : elbow ? [[89,84],[103,105],[146,124]] : [[89,61],[104,80],[146,105]],
  ...(elbow ? reverseElbows : reverseHands),...reverseLimbs,
);

const ballRest = front(false, { body:[[211,91],[189,98],[145,135]], nearArm:[[191,122],[218,121]],
  farArm:[[182,124],[210,122]], nearLeg:[[119,154],[75,155]], farLeg:[[109,154],[66,155]] });
const ballPlank = front(false,{ body:[[214,80],[191,92],[145,115]],nearArm:[[191,122],[218,121]],
  farArm:[[182,124],[210,122]],nearLeg:[[105,140],[67,155]],farLeg:[[98,142],[59,155]] });
const ballHold = hold(ballRest,ballPlank,{ dynamic:[["stability-ball",3,15,19]] });
const suspensionHold = hold(front(false,{ body:[[210,104],[195,116],[142,137]],nearLeg:[[105,154],[64,134]],
  farLeg:[[98,154],[56,134]] }),front(false,{ body:[[216,100],[195,110],[142,122]],
  nearLeg:[[104,128],[64,134]],farLeg:[[96,130],[56,134]] }),{
  dynamic:[["line",8,62,11],["line",10,56,11],["foot",8,61,145],["foot",10,53,145]],
});
const wall: Equipment = { props:[[239,16,239,158],[239,153,250,147],[239,144,250,138],[239,135,250,129]] };
const wallHold = hold(
  pose([[201,40],[194,59],[183,104]],[[214,97],[238,62]],[[206,97],[238,70]],[[177,132],[175,156]],[[168,132],[163,156]]),
  pose([[215,50],[204,68],[176,107]],[[225,104],[238,66]],[[218,105],[238,74]],[[158,132],[140,156]],[[147,134],[128,156]]),
  wall,
);
const widePlank = front(true,{nearLeg:wideNear,farLeg:wideFar});
const floorTap = demo([widePlank,front(true,{nearArm:[[222,113],[252,155]],nearLeg:wideNear,farLeg:wideFar}),
  widePlank,front(true,{farArm:[[208,115],[236,154]],nearLeg:wideNear,farLeg:wideFar})]);
const thighTap = demo([widePlank,front(true,{nearArm:[[161,101],[125,115]],nearLeg:wideNear,farLeg:wideFar}),
  widePlank,front(true,{farArm:[[159,114],[125,126]],nearLeg:wideNear,farLeg:wideFar})]);

const armsLocked = front(true,{body:[[225,67],[203,80],[148,113]],nearArm:[[202,116],[200,155]],
  farArm:[[190,116],[187,155]] });
const forearmLower = front(false,{body:[[223,133],[202,123],[146,135]],nearArm:[[187,154],[200,155]],
  farArm:[[177,155],[187,155]] });
const plankTriceps = demo([armsLocked, forearmLower]);

const bandAnchor: Equipment = {props:[[276,18,276,157],[269,157,283,157]],dynamic:[["band",4,276,25]]};
const armPulldown = demo([
  front(true,{ nearArm:[[220,72],[249,62]] }),
  front(true,{ nearArm:[[176,94],[146,112]] }),
],bandAnchor);
const cableSideRow = demo([
  side({topArm:[[153,110],[122,129]]}),
  side({topArm:[[119,124],[159,112]]}),
],{props:[[35,29,35,157],[29,157,41,157]],dynamic:[["cable",4,35,145]]});

const dumbbells: Equipment ={dynamic:[["dumbbell",4,0,-1],["dumbbell",6,0,-1]]};
const bearRow = demo([bearHover,pose(bearBody,[[152,88],[151,105]],bearArms[1],...bearFeet),
  bearHover,pose(bearBody,bearArms[0],[[151,90],[141,105]],...bearFeet)],dumbbells);
function dumbbellArmLift(liftLeg: boolean) {
  return demo([high,front(true,{nearArm:[[222,71],[254,62]],...(liftLeg ? {farLeg:[[93,116],[56,118]] as Segment} : {})})],
    {dynamic:[["dumbbell",4,0,0]]});
}
const lateralNear: Segment = [[213,98],[236,117]];
const lateralFar: Segment = [[175,60],[152,43]];
const lateralArm = demo([widePlank,front(true,{nearArm:lateralNear,nearLeg:wideNear,farLeg:wideFar}),
  widePlank,front(true,{farArm:lateralFar,nearLeg:wideNear,farLeg:wideFar})]);
const upwardTopArm: Segment = [[184,54],[181,23]];
const sideTopWeight = side({topArm:upwardTopArm});

const strideDistance = 29;
const shiftForward = (frame: Point[]) => frame.map(([x, y]): Point => [x + strideDistance, y]);
const forwardStride = [
  high,
  front(true,{nearArm:[[219,114],[226,155]]}),
  front(true,{body:[[235,65],[213,81],[159,112]],nearArm:[[224,116],[226,155]],farArm:[[211,117],[213,155]]}),
  front(true,{body:[[244,65],[222,81],[168,112]],nearArm:[[225,116],[226,155]],farArm:[[212,117],[213,155]],
    nearLeg:[[128,130],[92,154]]}),
  shiftForward(high),
];
const walkingOut = [...forwardStride, ...forwardStride.slice(1).map(shiftForward)];
const walkArms = demo([...walkingOut, ...walkingOut.slice(1, -1).reverse()], {}, 570);
const farSideShift = front(true,{body:[[219,64],[197,79],[135,104]],nearLeg:[[98,116],[59,135]],farLeg:[[94,118],[53,137]]});
const nearSideShift = front(true,{body:[[219,64],[197,79],[146,116]],nearLeg:[[109,143],[74,165]],farLeg:[[104,143],[68,164]]});
const sideHop = demo([high,farSideShift,high,nearSideShift],{},440);
const nearFootStack: [Segment,Segment] = [[[106,138],[64,156]],[[102,132],[60,149]]];
const farFootStack: [Segment,Segment] = [nearFootStack[1],nearFootStack[0]];
const rotateToNear = pose([[212,67],[190,78],[140,110]],highNearArm,[[187,48],[185,18]],...nearFootStack);
const rotateToFar = pose([[211,65],[186,77],[139,109]],[[188,47],[189,17]],highFarArm,...farFootStack);

const centreHang = front(true,{body:[[216,67],[194,85],[139,117]],nearArm:[[197,112],[197,134]],
  farArm:[[183,112],[184,134]],nearLeg:[[98,135],[57,154]],farLeg:[[94,137],[53,155]]});
const shiftedHang = front(true,{body:[[215,62],[193,80],[136,116]],nearArm:[[197,110],[197,134]],
  farArm:[[183,110],[184,134]],nearLeg:[[100,143],[65,163]],farLeg:[[88,117],[46,140]]});
const floatHang = front(true,{body:[[215,62],[193,80],[136,114]],nearArm:[[197,110],[197,134]],
  farArm:[[183,110],[184,134]],nearLeg:[[97,131],[59,143]],farLeg:[[90,127],[51,139]]});
const elevatedJack = [centreHang,floatHang,shiftedHang,floatHang];

const overheadBody: Body = [[160,48],[160,68],[160,106]];
const rotateOverhead = (frame: Point[]) => frame.map(([x,y]): Point => [255-y,x-70]);
const ironCross = {
  ...hold(
    rotateOverhead(pose(overheadBody,[[182,59],[182,45]],[[138,59],[138,45]],[[167,133],[169,154]],[[153,133],[151,154]])),
    rotateOverhead(pose(overheadBody,[[188,57],[218,40]],[[132,57],[102,40]],[[179,126],[201,150]],[[141,126],[119,150]])),
  ),
  topView: true,
};
const singleArmNear = front(true,{nearArm:[[200,108],[201,140]],nearLeg:wideNear,farLeg:wideFar});
const singleArmFar = front(true,{farArm:[[174,107],[173,137]],nearLeg:wideNear,farLeg:wideFar});
const singleHold = demo([widePlank,singleArmNear,singleArmNear,singleArmNear,widePlank,singleArmFar,singleArmFar,singleArmFar]);
const medicineBall = (x: number): NonNullable<Equipment["props"]> => {
  const outline: Point[] = [[x-4,140],[x+4,140],[x+9,145],[x+10,151],[x+7,157],
    [x+3,159],[x-3,159],[x-7,157],[x-10,151],[x-9,145]];
  return outline.map(([a,b],i) => [a,b,...outline[(i+1)%outline.length]]);
};
const medicineTap = demo([high,front(true,{nearArm:[[225,112],[246,140]]}),high,
  front(true,{farArm:[[226,110],[240,141]]})],{props:medicineBall(244)});
const medicineJack = demo(elevatedJack.map((frame) => frame.map(([x,y],i):Point =>
  i === 4 ? [197,141] : i === 6 ? [189,141] : [x,y],
)),{props:medicineBall(193)},420);

const highKneeNear = front(true,{nearLeg:[[175,109],[143,139]]});
const highKneeFar = front(true,{farLeg:[[162,103],[134,134]]});
const highLiftNear = front(true,{nearLeg:[[100,112],[58,116]]});
const highLiftFar = front(true,{farLeg:[[96,112],[52,115]]});
const tuckedKnees = demo([high,highKneeNear,high,highKneeFar],{},530);
const twoJacksFourClimbers = demo([
  ...jumpPlank(false,true).frames,...jumpPlank(false,true).frames,high,highKneeNear,high,highKneeFar,high,highKneeNear,high,highKneeFar,
],{},340);

const thighBand: Equipment = {dynamic:[["knee-band",7,9]]};
const ankleBand: Equipment = {dynamic:[["band",8,10]]};
const straps: Equipment = {dynamic:[["line",8,63,13],["line",10,53,13],["ring",8,0,2],["ring",10,0,2]]};
function singleSuspended(straightArm: boolean) {
  const baseLeg: Segment = [[101,126],[64,138]];
  const baseFar: Segment = [[94,127],[55,138]];
  const hover: Segment = [[101,117],[64,121]];
  const hoverFar: Segment = [[94,118],[55,122]];
  const rest = front(straightArm,{nearLeg:baseLeg,farLeg:baseFar});
  const near = front(straightArm,{nearLeg:hover,farLeg:baseFar});
  const far = front(straightArm,{nearLeg:baseLeg,farLeg:hoverFar});
  return demo([rest,near,near,near,rest,far,far,far],straps);
}
const starSuspended = hold(front(true,{nearLeg:[[103,127],[63,138]],farLeg:[[98,127],[58,138]]}),
  front(true,{nearLeg:[[109,135],[71,148]],farLeg:[[93,113],[46,121]]}),straps);
const supineArms: [Segment,Segment] = [[[99,147],[80,154]],[[105,143],[88,150]]];
const supineLeg: [Segment,Segment] = [[[173,131],[213,119]],[[176,136],[216,123]]];
const supineSuspended = hold(pose([[80,141],[96,149],[131,151]],...supineArms,...supineLeg),
  pose([[80,141],[96,149],[129,139]],...supineArms,...supineLeg),
  {dynamic:[["line",8,213,18],["line",10,216,18],["ring",8,0,2],["ring",10,0,2]]});

const bentLegLift = demo([sideLine,side({topLeg:[[125,104],[87,119]]})]);
const poisedClam = side({topLeg:[[111,120],kneeSideTop[1]],bottomLeg:kneeSideBottom});
const vibrationPlate: Equipment = {props:[[174,146,232,146],[174,146,178,158],[232,146,226,158],[178,158,226,158],
  [185,143,182,139],[193,143,193,139],[201,143,204,139]]};
const benchIncline: Equipment = {props:[[170,138,234,138],[170,138,170,156],[234,138,234,156]]};

const additionalPlankIllustrations: Readonly<Record<string, Illustration>> = {
  "0714": hold(sideRest,sideLine),
  "1134": singleSuspended(true),
  "1135": singleSuspended(false),
  "1145": starSuspended,
  "1148": supineSuspended,
  "1193": ironCross,
  "1440": armLift(true),
  "1469": hold(kneeSideRest,kneeSide),
  "1470": hold(sideRest,sideLine),
  "2152": demo([high,highLiftNear,high,highLiftFar],ankleBand),
  "2155": hold(kneeSideRest,poisedClam,thighBand),
  "2162": demo([high,highKneeNear,high,highKneeFar],thighBand),
  "2164": hold(sideRest,sideLifted,thighBand),
  "2526": hold(front(false,{body:[[217,106],[194,116],[143,138]],nearArm:[[197,144],[224,144]],
    farArm:[[186,144],[211,144]],nearLeg:restNear,farLeg:restFar}),front(false,{body:[[219,87],[197,98],[143,123]],
    nearArm:[[197,144],[224,144]],farArm:[[185,144],[210,144]]}),vibrationPlate),
  "2564": medicineJack,
  "3750": sideHop,
  "3777": armPulldown,
  "3791": armPulldown,
  "3852": lateralArm,
  "3954": demo([high,rotateToNear,rotateToNear,high,rotateToFar,rotateToFar]),
  "3959": walkArms,
  "3982": tuckedKnees,
  "3983": singleHold,
  "4386": demo([high,highLiftNear,high,highLiftFar]),
  "4622": dumbbellArmLift(false),
  "4627": dumbbellArmLift(true),
  "4811": hold(sideRest,sideLine),
  "5879": hold(sideRest,sideTopWeight,{dynamic:[["kettlebell",4,0,-11]]}),
  "6423": plankTriceps,
  "6466": bentLegLift,
  "6737": demo([sideLine,sideLifted,sideLifted],thighBand),
  "7210": demo(jumpPlank(false,true).frames,thighBand,440),
  "7499": twoJacksFourClimbers,
  "8221": {...lateralArm,...dumbbells},
  "9677": sideHop,
  "9821": demo([high,highLiftNear,highKneeNear,high,highLiftFar,highKneeFar]),
  "10041": hold(sideRest,sideTopWeight,{dynamic:[["dumbbell",4,0,-6]]}),
  "10185": bearRow,
  "10554": medicineTap,
  "10593": demo(elevatedJack,benchIncline,420),
  "11275": cableSideRow,
};

// IDs were checked against their setup, support surface and instructions independently.
export const plankIllustrations: Readonly<Record<string, Illustration>> = {
  ...additionalPlankIllustrations,
  "0133": hold(kneeSideRest,kneeSide),
  "0463": hold(lowRest,low),
  "0867": hold(reverse(false,true),reverse(false,false)),
  "1478": jumpPlank(false,true),
  "1706": ballHold,
  "2135": hold(lowRest,low,{ dynamic:[["plate",2,12,-11]] }),
  "2792": jumpPlank(false,true),
  "2793": steppedUp,
  "2894": armLift(false),
  "2899": hold(kneeSideRest,kneeSide),
  "2978": steppedUp,
  "3238": hold(lowRest,loweredKnee(false)),
  "3264": sideLift(),
  "3501": legLift,
  "3503": sideCrunch(),
  "3814": alternatingToeTap,
  "4023": alternatingToeTap,
  "4170": hold(bearRest,bearHover),
  "4334": sideCrunch(),
  "4384": saw,
  "4500": demo([high,dog]),
  "4863": sideLift(),
  "4907": sideLiftHold(),
  "4934": hold(reverse(false,true),reverse(false,false)),
  "4991": sideRotation,
  "5045": hold(reverse(true,true),reverse(true,false)),
  "5157": jumpPlank(true,true),
  "5158": jumpPlank(false,false),
  "5159": hold(highRest,high),
  "5165": demo([high,pikeSlide],towels),
  "6092": kneeToElbow,
  "6207": sideLift(true),
  "6208": sideLiftHold(true),
  "6210": sideCrunch(true),
  "6442": bearKick,
  "7275": suspensionHold,
  "7342": thighTap,
  "7389": wallHold,
  "8399": floorTap,
  "9999": tapKnee,
};
