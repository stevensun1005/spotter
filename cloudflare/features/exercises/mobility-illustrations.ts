import type { Illustration, Point } from "./motion-data";

type Pair = [Point, Point];
type Body = [Point, Point, Point];
type Props = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

function pose(body: Body, nearArm: Pair, farArm: Pair, nearLeg: Pair, farLeg: Pair): Point[] {
  return [...body, ...nearArm, ...farArm, ...nearLeg, ...farLeg];
}

function demo(frames: Point[][], props?: Props, dynamic?: Attachments, hold = true): Illustration {
  const end = frames[frames.length - 1];
  return { frames: hold ? [...frames, end, end] : frames, props, dynamic, ms: 1050, reference: true };
}

const showFoot = (frames: Point[][], ankle: 8 | 10, offset: Point, props?: Props) =>
  demo(frames.map((frame) => [...frame, [frame[ankle][0] + offset[0], frame[ankle][1] + offset[1]]]),
    props, [["foot-tip", ankle, 11]]);

const stool: Props = [[104, 115, 149, 115], [110, 115, 110, 158], [143, 115, 143, 158]];
const wall: Props = [[220, 33, 220, 159]];
const bench: Props = [[62, 107, 151, 107], [74, 107, 74, 158], [145, 107, 145, 158]];
const releaseLeg: Pair = [[166, 132], [166, 156]];
const straightArm: Pair = [[161, 87], [159, 108]];
const tall: Body = [[151, 45], [151, 62], [148, 111]];

function kneelingHip(cross = false, supported = false) {
  const start = pose([[128, 54], [131, 70], [130, 116]], [[145, 95], [149, 116]], [[121, 94], [119, 116]],
    [[183, 119], [189, 157]], [[120, 153], supported ? [87, 126] : [87, 155]]);
  const finish = pose([[144, 54], [144, 70], [144, 116]], [[162, 95], [164, 117]],
    cross ? [[136, 46], [165, 31]] : [[132, 94], [133, 116]],
    [[183, 119], [189, 157]], [[120, 153], supported ? [87, 126] : [87, 155]]);
  return supported
    ? showFoot([start, finish],10,[-11,1],[[63,128,93,128],[68,128,68,158],[88,128,88,158]])
    : demo([start, finish], [[104,158,135,158]]);
}

function standingQuad(support: boolean) {
  const stillArm: Pair = support ? [[189, 70], [219, 67]] : [[134, 85], [132, 106]];
  return demo([
    pose(tall, straightArm, stillArm, releaseLeg, [[145, 133], [139, 156]]),
    pose(tall, [[144, 87], [118, 109]], stillArm, releaseLeg, [[144, 132], [118, 109]]),
    pose([[154, 43], [154, 61], [154, 110]], [[146, 86], [120, 105]], stillArm, releaseLeg, [[148, 132], [120, 105]]),
  ], support ? wall : undefined);
}

function seatedQuad() {
  const body: Body = [[132, 44], [135, 63], [135, 109]];
  const front: Pair = [[176, 112], [179, 156]];
  const back: Pair = [[120, 135], [96, 116]];
  return showFoot([
    pose(body, [[152, 90], [157, 109]], [[119, 86], [114, 107]], front, [[149, 133], [152, 157]]),
    pose(body, [[147, 87], [146, 104]], [[116, 86], back[1]], front, back),
  ],10,[-8,5],stool);
}

const staggeredHip = demo([
  pose(tall, [[164, 86], [151, 105]], [[133, 88], [142, 107]], [[177, 132], [186, 156]], [[127, 132], [113, 156]]),
  pose([[161, 48], [161, 65], [160, 113]], [[173, 89], [158, 108]], [[145, 89], [152, 109]], [[184, 132], [186, 156]], [[136, 132], [113, 156]]),
]);

const tableHip = demo([
  pose([[78, 89], [93, 96], [145, 102]], [[109, 99], [126, 98]], [[112, 106], [133, 103]], [[174, 101], [174, 142]], [[170, 120], [165, 151]]),
  pose([[78, 89], [93, 96], [145, 102]], [[117, 109], [119, 70]], [[114, 104], [124, 72]], [[135, 64], [158, 77]], [[159, 129], [155, 156]]),
], bench);

const kneeChest = (both: boolean) => {
  const body: Body = [[84, 145], [101, 147], [151, 150]];
  const rear: Pair = [[180, 115], [198, 156]];
  const drawn: Pair = [[142, 111], [169, 131]];
  return demo([
    pose(body, [[120, 150], [143, 152]], [[120, 147], [138, 148]], rear, [[175, 114], [191, 157]]),
    pose(body, [[118, 129], drawn[0]], [[116, 125], both ? [136, 111] : drawn[0]], drawn, both ? [[136, 111], [163, 130]] : rear),
  ]);
};

function frontLegHamstring(mode: "standing" | "bench" | "kneeling" | "chair" | "floor") {
  const floor = mode === "floor", kneeling = mode === "kneeling", elevated = mode === "bench", seated = mode === "chair";
  const hip: Point = floor ? [122, 150] : seated || kneeling ? [124, 108] : [131, 108];
  const heel: Point = [216, elevated ? 125 : 156];
  const frontKnee: Point = [(heel[0] + hip[0]) / 2, (heel[1] + hip[1]) / 2];
  const other: Pair = floor ? [[144, 124], [153, 154]] : kneeling ? [[104, 152], [74, 157]] : [[125, 133], [119, 157]];
  const start = pose([[hip[0], hip[1] - 62], [hip[0] + 1, hip[1] - 47], hip], [[138, hip[1] - 23], [141, hip[1] - 8]],
    [[124, hip[1] - 24], [125, hip[1] - 7]], [frontKnee, heel], other);
  const end = pose([[hip[0] + 43, hip[1] - 45], [hip[0] + 32, hip[1] - 34], hip], [[170, hip[1] - 13], [floor ? 206 : 186, floor ? 152 : hip[1] + 3]],
    [[158, hip[1] - 12], [floor ? 196 : 176, floor ? 150 : hip[1] + 5]], [frontKnee, heel], other);
  const props: Props | undefined = elevated ? [[203, 128, 235, 128], [209, 128, 209, 157], [230, 128, 230, 157]]
    : seated ? [[94, 115, 141, 115], [99, 115, 99, 158], [135, 115, 135, 158], [95, 115, 95, 74]]
    : kneeling ? [[88, 158, 117, 158]] : undefined;
  return showFoot([start,end],8,[4,-11],props);
}

const wallCalf = showFoot([
  pose([[146, 54], [150, 68], [143, 114]], [[183, 76], [219, 69]], [[183, 87], [219, 80]], [[175, 125], [183, 157]], [[122, 136], [96, 154]]),
  pose([[174, 60], [173, 77], [151, 118]], [[192, 84], [219, 69]], [[188, 92], [219, 80]], [[190, 129], [183, 157]], [[124, 138], [96, 154]]),
],10,[12,5],wall);

const mat: Props = [[59, 159, 241, 159]];
const allFours = pose([[190, 84], [174, 95], [121, 96]], [[180, 127], [183, 156]], [[165, 125], [168, 156]], [[121, 151], [88, 155]], [[108, 151], [76, 155]]);
const child = pose([[171, 145], [157, 140], [107, 131]], [[187, 147], [217, 154]], [[174, 148], [207, 155]], [[132, 152], [90, 155]], [[120, 153], [79, 156]]);
const lowProne = pose([[190, 138], [176, 141], [120, 148]], [[153, 138], [172, 157]], [[146, 142], [166, 157]], [[93, 150], [62, 155]], [[87, 151], [56, 155]]);
const cobra = pose([[169, 72], [165, 90], [120, 147]], [[160, 122], [173, 156]], [[153, 121], [165, 157]], [[94, 151], [62, 155]], [[88, 153], [55, 156]]);
const highPlank = pose([[190, 87], [174, 99], [120, 117]], [[174, 127], [173, 157]], [[165, 127], [165, 158]], [[94, 133], [61, 157]], [[89, 135], [54, 158]]);

const seatedCatCow = {
  ...demo([
    [...pose([[135,44],[137,62],[129,109]],[[157,87],[173,114]],[[144,87],[162,115]],[[171,117],[168,158]],[[161,117],[148,158]]), [133,85]],
    [...pose([[123,43],[135,59],[129,109]],[[151,86],[173,114]],[[143,87],[162,115]],[[171,117],[168,158]],[[161,117],[148,158]]), [146,84]],
    [...pose([[159,64],[144,70],[129,109]],[[160,92],[173,114]],[[149,91],[162,115]],[[171,117],[168,158]],[[161,117],[148,158]]), [121,84]],
  ], stool, undefined, false),
  spine: [11],
};

const twistRoot: Body = [[140, 58], [143, 76], [145, 149]];
const seatedTwist = demo([
  pose(twistRoot, [[171, 104], [177, 131]], [[119, 104], [113, 135]], [[174, 150], [210, 156]], [[176, 155], [220, 156]]),
  pose(twistRoot, [[170, 106], [182, 139]], [[132, 105], [136, 139]], [[162, 108], [182, 149]], [[175, 153], [212, 155]]),
  pose([[128,57],[136,76],[145,149]], [[123,113],[115,154]], [[155,101],[166,108]], [[162,108],[179,151]], [[175,153],[212,155]]),
], mat);

const sidePretzel = demo([
  pose([[89,132],[105,136],[156,145]], [[117,149],[128,153]], [[110,148],[119,157]],
    [[181,128],[201,139]], [[166,155],[196,151]]),
  pose([[93,140],[109,145],[156,145]], [[127,128],[158,125]], [[108,150],[124,157]],
    [[188,117],[158,125]], [[166,155],[196,151]]),
], mat);

const kneelingPress = [[196, 133], [198, 157]] satisfies Pair;
const frontFoldLeg = [[186, 153], [155, 155]] satisfies Pair;
const pigeonUpright = pose([[160, 58], [162, 76], [147, 140]], [[181, 115], [198, 157]], [[169, 119], [179, 157]],
  frontFoldLeg, [[102, 150], [69, 155]]);
const pigeonFold = pose([[197, 132], [182, 131], [147, 140]], [[197, 150], [222, 156]], [[183, 150], [207, 157]],
  frontFoldLeg, [[102, 150], [69, 155]]);
const pigeonEntry = pose([[190, 91], [171, 102], [137, 113]], [[177, 128], kneelingPress[1]], [[171, 132], [179, 157]], [[147, 151], [129, 156]], [[132, 150], [101, 155]]);

const crunchLeg: Pair = [[177, 114], [198, 157]];
const loadedCrunch = demo([
  pose([[78, 144], [97, 147], [148, 150]], [[79, 132], [67, 144]], [[82, 128], [71, 143]], crunchLeg, [[169, 116], [188, 157]]),
  pose([[96, 118], [111, 129], [148, 150]], [[93, 108], [84, 122]], [[99, 104], [86, 120]], crunchLeg, [[169, 116], [188, 157]]),
], mat, [["plate", 4, -5, -2]]);

const quadBasic = standingQuad(false);
const quadSupport = standingQuad(true);
const quadSitting = seatedQuad();
const hamFloor = frontLegHamstring("floor");
const hamStanding = frontLegHamstring("standing");
const hamChair = frontLegHamstring("chair");
const hipKneel = kneelingHip();

export const mobilityIllustrations: Readonly<Record<string, Illustration>> = {
  "0560": hipKneel,
  "0616": tableHip,
  "0692": hamFloor,
  "0789": hamStanding,
  "0945": demo([allFours, child], mat),
  "1054": wallCalf,
  "1059": quadBasic,
  "1250": loadedCrunch,
  "1482": demo([lowProne, cobra], mat),
  "1577": tableHip,
  "1909": hamStanding,
  "1910": frontLegHamstring("bench"),
  "1913": frontLegHamstring("kneeling"),
  "1943": demo([pigeonEntry, pigeonUpright], mat),
  "1949": staggeredHip,
  "1953": quadSupport,
  "2100": quadSitting,
  "3242": kneeChest(false),
  "3243": kneeChest(true),
  "3488": demo([highPlank, lowProne, cobra, highPlank], mat, undefined, false),
  "3504": quadBasic,
  "4296": kneelingHip(true),
  "4300": quadBasic,
  "4558": demo([child, lowProne, cobra, lowProne, allFours], mat, undefined, false),
  "4674": kneelingHip(false, true),
  "4931": wallCalf,
  "6121": seatedTwist,
  "6761": demo([pigeonEntry, pigeonUpright, pigeonFold], mat),
  "7310": hamChair,
  "7562": quadSitting,
  "10462": hamChair,
  "11095": seatedCatCow,
  "11903": quadSupport,
  "11904": hipKneel,
  "11954": sidePretzel,
};
