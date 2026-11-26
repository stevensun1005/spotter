import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import {
  pushUp, wallPushUp, sidePushUp, crunch, bridge, reverseBridge, crabWalk, sideFloor,
  proneCurl, seatedCore, ironCross, kneehug, ankleTwist, climber, advancePushUp, divePushUp,
  pressForearms, holdHandstand, fullPlanche, dropPushUp, seatedHip, quadrupedCircles, lyingCurl, elbowLift,
  inchworm,
} from "./bodyweight/floor.mjs";
import {
  jump, squat, lunge, legMobility, upperMobility, calfRaise, calfStretch, singleSquat,
  supportedSquat, backToWall, wallMarch, pelvisRock, toeTouch, runStride, horizontalHop, jumpLunge,
  monsterWalk, sissySquat, boxDrop, slider, boardStand,
} from "./bodyweight/standing.mjs";
import {
  pullUp, backExtension, doorStretch, assaultBike, treadmillWalk, benchDip, dip, invertedRow,
  doubleLegRaise, chairStretch, tiltedCore, oneArmDip, captainRaise, towelRow, skinCat, straps,
} from "./bodyweight/apparatus.mjs";

const floor = [64, 18, .40, -.19, 1.68];
const plank = [62, 17, .36, -.13, 1.52];
const overhead = [57, 14, 1.146, -.02, 2.70];
const jobs = [];
const addJobs = (definitions, base) => {
  for (const [id, options, extra] of definitions) jobs.push({ id, ...base, options, ...extra });
};

addJobs([
  ["0259", { width: .115 }, { muscles: ["triceps"] }],
  ["2398", { width: .119, knees: true }, { muscles: ["triceps"] }],
  ["0283", { width: .051, diamond: true }, { muscles: ["triceps"], camera: [42, 27, .34, -.13, 1.56] }],
  ["0279", { decline: .31 }, { equipment: "step", camera: [65, 17, .43, 1.24, 1.65] }],
  ["0490", { incline: .31, width: .110, z: .47 }, { equipment: "step", muscles: ["triceps"] }],
  ["5160", { incline: .46, width: .116, z: .70, offset: .10 }, { equipment: "bench", muscles: ["triceps"], camera: [61, 17, .40, .30, 1.64] }],
  ["0493", { incline: .46, width: .173, z: .76, offset: .10 }, { equipment: "bench", camera: [61, 17, .40, .39, 1.65] }],
  ["3785", { incline: .31, width: .233, z: .44 }, { equipment: "plyo-box" }],
  ["0494", { incline: .31, width: .198, z: .47, reverse: true }, { equipment: "step", camera: [42, 25, .39, -.06, 1.62] }],
  ["3211", { knees: true }],
  ["3145", { plus: true }, { muscles: ["pec", "core"] }],
  ["3021", { scapula: true }, { muscles: ["core"], duration: 5100 }],
  ["3699", { tap: "shoulder", tapOnly: true }, { muscles: ["core"], duration: 5150, poster: .33 }],
  ["0699", { tap: "shoulder" }, { duration: 5550, poster: .36 }],
  ["3216", { tap: "chest" }, { duration: 5750, poster: .37 }],
  ["0725", { width: .203, single: true }, { camera: [42, 18, .43, -.12, 1.65], duration: 5650, poster: .27 }],
  ["3294", { width: .472, archer: true }, { camera: [36, 19, .39, -.13, 1.71], duration: 5600, poster: .27 }],
  ["1273", { jump: "clap" }, { duration: 3450, poster: .65 }],
  ["1306", { jump: "flight" }, { duration: 3440, poster: .63 }],
  ["11717", { jump: "flight", width: .274 }, { duration: 3980, poster: .65 }],
], { move: pushUp, equipment: "none", muscles: ["pec"], camera: plank, duration: 4400, poster: .44 });

addJobs([
  ["0659", false],
  ["0658", true, { camera: [-119, 14, .94, .11, 2.12], duration: 5000 }],
], { move: wallPushUp, equipment: "rig-contact-wall", muscles: ["pec"], camera: [113, 14, .94, .11, 2.12], duration: 4400, poster: .47 });

jobs.push({ id: "0717", move: sidePushUp, equipment: "none", muscles: ["triceps"], camera: [52, 16, .395, -.07, 1.59], duration: 4700, poster: .43 });

addJobs([
  ["0274", { rise: .384 }],
  ["0275", { rise: .362, arms: "chest", hold: true }],
  ["0267", { rise: .403, arms: "overhead" }, { camera: [64, 18, .39, -.28, 1.85] }],
  ["0262", { rise: .495, turn: .64, alternate: true }, { duration: 5700, poster: .24 }],
  ["3202", { rise: .781 }],
  ["3203", { rise: .735, arms: "prisoner" }],
  ["3201", { rise: .278 }],
  ["0735", { rise: .55, hold: true }, { duration: 4790 }],
  ["3679", { rise: 1.425, arms: "chest" }],
  ["3640", { rise: .492, arms: "knee", turn: .51, alternate: true }, { duration: 5700, poster: .26 }],
  ["0871", { rise: .813, arms: "reach", tuck: true }],
  ["0459", { rise: .135, arms: "floor", kick: true }],
  ["0507", { rise: 1.02, arms: "jackknife", legs: "straight", raise: 1.08 }],
  ["0508", { rise: 1.254, hold: true }, { duration: 5500 }],
  ["0456", { rise: 1.14, arms: "reach", tuck: true }],
  ["0457", { rise: 1.22, arms: "reach", legs: "straight", raise: .57 }],
  ["2429", { rise: .443, frog: true }, { camera: [43, 27, .39, -.15, 1.69] }],
  ["0469", { rise: .655, tuck: true, arms: "chest" }],
  ["3016", { rise: .27, arms: "chest", legs: "mixed" }],
  ["1495", { rise: .432, turn: .45, arms: "chest", alternate: true }, { duration: 5350, poster: .24 }],
  ["0635", { rise: .416, turn: .64, alternate: true }, { duration: 5800, poster: .25 }],
  ["4019", { rise: 0, reverse: true, arms: "floor" }],
  ["4778", { rise: 0, reverse: true, arms: "floor", tabletop: true, hold: true }],
  ["0865", { rise: 0, reverse: true, arms: "floor", legs: "straight", raise: 1.44 }, { camera: [64, 17, .53, -.19, 1.89] }],
  ["0620", { rise: 0, bench: true, arms: "bench", legs: "straight", raise: 1.40 }, { equipment: "bench", camera: [63, 18, .73, .84, 1.94] }],
], { move: crunch, equipment: "mat", muscles: ["core"], camera: floor, duration: 4400, poster: .46 });

addJobs([
  ["3013", { height: .16 }],
  ["3147", { height: .041, tiltOnly: true }, { muscles: ["core"] }],
  ["1422", { height: .245, tiltFirst: true }, { duration: 4900 }],
  ["3645", { height: .236, single: true }, { muscles: ["r:glute"] }],
  ["0668", { height: .278, hold: true }, { duration: 5500, poster: .46 }],
], { move: bridge, equipment: "mat", muscles: ["glute"], camera: [64, 18, .35, -.22, 1.54], duration: 4350, poster: .48 });

jobs.push({ id: "3523", move: reverseBridge, equipment: "bench", muscles: ["glute"], camera: [61, 18, .56, .17, 1.77], duration: 4450, poster: .48 });

addJobs([
  ["0140", { reverse: true, width: .178, hold: true }, { muscles: ["biceps"] }],
  ["1326", { reverse: true, width: .224 }],
  ["1327", { reverse: true, width: .122 }, { muscles: ["lat", "biceps"] }],
  ["0253", { neutral: true, width: .102 }, { equipment: "narrow-neutral-pull-up" }],
  ["0651", { neutral: true, width: .193 }, { equipment: "neutral-pull-up" }],
  ["0674", { reverse: true, width: .193, hold: true }, { duration: 4980 }],
  ["1763", { width: .195 }],
  ["11015", { width: .241, scapula: true, hold: true }, { duration: 5000 }],
  ["0688", { width: .193, scapula: true }, { duration: 4800 }],
  ["3418", { width: .215, lsit: true }, { muscles: ["lat", "core"] }],
  ["3293", { width: .497, alternate: true, archer: true }, { equipment: "wide-pull-up", duration: 5950, poster: .24 }],
  ["0475", { width: .235, raise: 1.51, hold: true }, { muscles: ["core"] }],
  ["0473", { width: .224, raise: 2.66 }, { muscles: ["core"] }],
  ["1761", { width: .228, raise: 2.045, oblique: true, alternate: true }, { muscles: ["core"], duration: 5850, poster: .24 }],
  ["0807", { width: .234, raise: 2.353, oblique: true, hold: true }, { muscles: ["core"], duration: 4880 }],
  ["0476", { width: .225, raise: 1.63, alternate: true }, { muscles: ["core"], duration: 5900, poster: .24 }],
  ["0670", { width: .453, rear: true }, { equipment: "wide-pull-up", camera: [-47, 15, 1.12, .02, 2.69] }],
  ["0638", { single: true, reverse: true }, { duration: 4950, camera: [38, 13, 1.155, .02, 2.70] }],
], { move: pullUp, equipment: "pull-up", muscles: ["lat"], camera: overhead, duration: 4600, poster: .47 });

addJobs([
  ["8076", { width: .224 }],
], { move: pushUp, equipment: "back-plate", muscles: ["pec", "triceps"], camera: [54, 27, .39, -.11, 1.62], duration: 4830, poster: .47 });
addJobs([
  ["4455", true],
  ["0489", false, { equipment: "extension-flat", camera: [-57, 17, .74, -.05, 1.87] }],
], { move: backExtension, equipment: "extension-45", muscles: ["glute", "core"], camera: [63, 17, .69, -.06, 1.82], duration: 4790, poster: .18 });
jobs.push(
  { id: "7553", move: doorStretch, equipment: "doorway", muscles: ["pec"], camera: [22, 14, 1.032, .01, 2.40], duration: 5300, poster: .45 },
  { id: "5881", move: crabWalk, equipment: "none", muscles: ["glute", "core"], camera: [63, 18, .47, .28, 1.65], duration: 5420, poster: .21 },
);

jobs.push(
  { id: "3893", move: assaultBike, equipment: "assault-bike", muscles: ["quad", "glute"],
    camera: [67, 14, .85, .13, 1.92], duration: 2350, poster: .29 },
  { id: "3666", move: treadmillWalk, equipment: "incline-treadmill", muscles: ["calf", "glute"],
    camera: [64, 13, .975, .09, 2.25], duration: 2120, poster: .33 },
);
const standing = [51, 13, .90, .07, 1.97];
addJobs([
  ["0129", { bent: true, hold: true }],
  ["1399", { floor: true, bent: true }, { equipment: "none", camera: [61, 16, .42, .17, 1.56] }],
  ["3287", { hold: true }, { duration: 4950 }],
  ["0814", { bent: true }],
  ["0813", { double: true }, { equipment: "double-dip-bench", camera: [68, 18, .56, .30, 1.95] }],
], { move: benchDip, equipment: "dip-bench", muscles: ["triceps"], camera: [62, 17, .57, .12, 1.75], duration: 4560, poster: .44 });

addJobs([
  ["0251", { hold: true }],
  ["1430", { cross: true, hold: true }, { equipment: "cage-dips", camera: [53, 14, 1.103, -.09, 2.51] }],
  ["2462", { straight: true }, { equipment: "straight-dip", camera: [-54, 17, .96, -.16, 2.14] }],
  ["0672", { reverse: true }, { muscles: ["triceps"], duration: 4980 }],
], { move: dip, equipment: "parallel-dips", muscles: ["pec", "triceps"], camera: [51, 13, 1.04, -.07, 2.20], duration: 4250, poster: .43 });

addJobs([
  ["3019", { width: .246 }, { duration: 4760 }],
  ["0499", { width: .237 }],
  ["2298", { width: .196 }, { equipment: "under-bench", camera: [61, 17, .67, -.17, 1.79], duration: 4850 }],
  ["2300", { width: .235, bent: true }],
  ["0497", { width: .190, high: true }, { equipment: "inverted-high-row" }],
], { move: invertedRow, equipment: "inverted-row", muscles: ["lat", "trap", "biceps"],
  camera: [64, 17, .63, .04, 1.70], duration: 4490, poster: .44 });

addJobs([
  ["3220", { open: true, height: .285, depth: .336 }],
  ["3224", { open: true, height: .167, depth: .079, overhead: true }, { duration: 1790 }],
  ["0514", { height: .269, depth: .335 }, { muscles: ["quad"] }],
  ["0513", { height: .312, depth: .348 }, { muscles: ["quad"], duration: 2650 }],
  ["3222", { height: .261, depth: .191 }, { duration: 2310 }],
  ["3223", { height: .312, depth: .187, open: true }, { duration: 2420 }],
  ["1472", { height: .242, depth: .31, forward: true }, { duration: 3200, camera: [65, 13, .93, .12, 2.14] }],
  ["3219", { height: .150, depth: .115, alternating: true, scissors: true }, { duration: 2900, poster: .245 }],
], { move: jump, equipment: "none", muscles: ["quad", "glute"], camera: [43, 13, 1.04, .04, 2.39], duration: 2700, poster: .49 });

addJobs([
  ["3533", { depth: .377, width: .167 }],
  ["3119", { depth: .550, width: .226 }, { duration: 4980 }],
  ["1685", { depth: .375, width: .169, reach: true }, { camera: [48, 12, 1.00, .10, 2.18] }],
  ["1686", { depth: .368, width: .178, reach: true, twist: true }, { duration: 5650, poster: .22 }],
], { move: squat, equipment: "none", muscles: ["quad", "glute"], camera: standing, duration: 4350, poster: .47 });

addJobs([
  ["3769", { curtsey: true, depth: .336 }],
  ["3470", { depth: .332 }],
  ["3672", { depth: .272 }, { duration: 2970 }],
  ["1688", { twist: true, hold: true, depth: .316 }, { muscles: ["core", "glute"] }],
  ["1585", { hold: true, stretch: true, depth: .241 }, { muscles: ["hamstring"] }],
  ["2368", { fixed: true, depth: .363 }, { duration: 4500, poster: .46 }],
  ["1687", { reverse: true, overhead: true, depth: .238 }, { muscles: ["core"], camera: [55, 12, 1.03, -.04, 2.26] }],
], { move: lunge, equipment: "none", muscles: ["glute", "quad"], camera: [63, 14, .89, .125, 2.06], duration: 5500, poster: .23 });

addJobs([
  ["0710", { curl: false }],
  ["0795", { curl: true }, { muscles: ["hamstring"], camera: [57, 14, .86, -.06, 1.93] }],
], { move: legMobility, equipment: "none", muscles: ["glute"], camera: [33, 12, .86, .05, 1.96], duration: 4950, poster: .23 });

addJobs([
  ["1167", { chest: true }, { muscles: ["pec"], camera: [35, 12, .88, .07, 1.98], duration: 4400, poster: .28 }],
  ["1297", { squeeze: true }, { muscles: ["pec"], duration: 4400 }],
  ["1346", { kneel: true, lean: .293, alternate: true }, { muscles: ["lat"], equipment: "mat", camera: [43, 15, .85, -.08, 1.75] }],
  ["0669", { rear: true, alternate: true }, { muscles: ["rearShoulder"] }],
  ["0643", { triceps: true, alternate: true }, { muscles: ["triceps"], camera: [47, 12, 1.01, .03, 2.18] }],
  ["0817", { triceps: true, alternate: true }, { muscles: ["triceps"], camera: [-43, 12, 1.02, .02, 2.17], duration: 5720 }],
  ["0713", { neck: true, alternate: true }, { muscles: ["trap"] }],
  ["1403", { neck: true, neckAngle: .276, alternate: true }, { muscles: ["trap"], camera: [-49, 13, .91, .07, 1.97], duration: 5650 }],
  ["0716", { neck: true, assist: true, alternate: true }, { muscles: ["trap"] }],
  ["0794", { lean: .316, alternate: true }, { muscles: ["lat"] }],
  ["3669", { archer: true, alternate: true }, { muscles: ["trap", "rearShoulder"] }],
], { move: upperMobility, equipment: "none", muscles: ["core"], camera: standing, duration: 5300, poster: .23 });

addJobs([
  ["0284", { bench: true, lean: 1.125 }, { equipment: "bench", camera: [65, 16, .75, .04, 2.08] }],
  ["1386", { wall: true, lean: .891, single: true }, { equipment: "rig-contact-wall", camera: [113, 15, .85, .03, 2.07] }],
  ["1387", { wall: true, single: true }, { equipment: "rig-contact-wall", camera: [107, 13, .91, .05, 2.15] }],
  ["1490", { step: true }, { equipment: "step", camera: [54, 15, 1.03, .38, 2.31] }],
], { move: calfRaise, equipment: "none", muscles: ["calf"], camera: standing, duration: 5460, poster: .23 });

addJobs([
  ["1407", { angle: .155, handY: -.050 }],
  ["1377", { angle: .132, handY: .036 }, { duration: 5720 }],
  ["1398", { angle: .184, handY: .005 }, { duration: 6180, camera: [-113, 13, .94, -.1, 2.12] }],
], { move: calfStretch, equipment: "rig-contact-wall", muscles: ["calf"], camera: [112, 13, .94, -.1, 2.12], duration: 5600, poster: .25 });

addJobs([
  ["1476", false],
  ["1759", true, { duration: 6090, camera: [49, 15, .85, .053, 1.98] }],
], { move: singleSquat, equipment: "none", muscles: ["quad", "glute"],
  camera: [59, 14, .86, .035, 1.93], duration: 5340, poster: .23 });

addJobs([
  ["0613", { quad: true }, { muscles: ["quad"] }],
  ["1774", { plank: true, abduction: true }, { muscles: ["glute", "core"] }],
  ["0705", { plank: true }, { muscles: ["core"] }],
  ["1427", {}, { muscles: ["glute"] }],
], { move: sideFloor, equipment: "mat", muscles: ["core"], camera: [51, 19, .40, -.18, 1.67], duration: 4820, poster: .44 });

addJobs([
  ["1352", false, { muscles: ["glute", "core"] }],
  ["3433", true, { camera: [62, 19, .37, -.05, 1.75], duration: 3370 }],
], { move: proneCurl, equipment: "mat", muscles: ["glute", "hamstring"], camera: [61, 17, .36, -.06, 1.68], duration: 4350, poster: .45 });

addJobs([
  ["3419", { lsit: true }],
  ["0687", { russian: true, twist: .785, alternate: true }, { duration: 5450, poster: .24 }],
  ["1363", { back: true }, { muscles: ["core"], camera: [63, 16, .47, -.11, 1.60] }],
  ["2329", { twist: .695, alternate: true }, { duration: 5600, poster: .24 }],
], { move: seatedCore, equipment: "mat", muscles: ["core"], camera: [52, 16, .51, -.13, 1.68], duration: 4540, poster: .47 });

addJobs([
  ["1418", false, { equipment: "none", muscles: ["glute"], camera: [53, 12, .903, -.09, 1.97] }],
  ["1576", true],
], { move: kneehug, equipment: "mat", muscles: ["hamstring"], camera: [64, 17, .45, -.20, 1.66], duration: 5520, poster: .24 });

addJobs([
  ["1548", {}, { muscles: ["hamstring"] }],
  ["1390", {}, { muscles: ["calf"], duration: 5980, camera: [-63, 14, .63, 1.29, 1.81] }],
  ["0690", { back: true }, { muscles: ["lat", "core"], duration: 4650, poster: .48 }],
], { move: chairStretch, equipment: "bench", muscles: ["core"], camera: [62, 16, .64, 1.25, 1.74], duration: 5400, poster: .24 });

jobs.push(
  { id: "1419", move: ironCross, equipment: "mat", muscles: ["core", "glute"], camera: [43, 29, .48, -.27, 1.82], duration: 5740, poster: .23 },
  { id: "1368", move: ankleTwist, equipment: "mat", muscles: ["calf"], camera: [63, 20, .40, -.04, 1.64], duration: 5400, poster: .23 },
  { id: "0555", move: doubleLegRaise, equipment: "dip-bench", muscles: ["core", "hamstring"], camera: [62, 18, .57, .11, 1.76], duration: 4520, poster: .44 },
);

addJobs([
  ["2466", true],
  ["0630", false, { duration: 1940, camera: [59, 17, .43, -.06, 1.65] }],
], { move: climber, equipment: "none", muscles: ["core"], camera: [58, 19, .44, -.08, 1.65], duration: 3830, poster: .24 });

addJobs([
  ["0666", "raise"],
  ["0642", "outside"],
  ["0661", "inside", { camera: [58, 26, .42, -.15, 1.67] }],
  ["0664", "side", { muscles: ["core", "pec"], camera: [58, 12, .69, -.15, 1.98] }],
  ["0803", "superman", { muscles: ["pec", "core"], poster: .24 }],
  ["0778", "spider", { camera: [54, 20, .39, -.12, 1.67], poster: .24 }],
], { move: advancePushUp, equipment: "none", muscles: ["pec"], camera: [64, 19, .40, -.13, 1.66], duration: 5600, poster: .36 });

addJobs([
  ["3662", false],
  ["3217", true, { duration: 5550, poster: .18 }],
], { move: divePushUp, equipment: "none", muscles: ["pec", "shoulder"], camera: [68, 17, .49, -.09, 1.74], duration: 5730, poster: .54 });

addJobs([
  ["1421", true],
  ["1467", false, { muscles: ["triceps"], duration: 4790 }],
], { move: pressForearms, equipment: "none", muscles: ["forearm", "triceps"], camera: [66, 17, .46, -.11, 1.61], duration: 4410, poster: .43 });

addJobs([
  ["0471", true],
  ["3302", false, { equipment: "none", camera: [46, 13, .99, .13, 2.15], duration: 4800 }],
], { move: holdHandstand, equipment: "handstand-wall", muscles: ["shoulder", "triceps"], camera: [117, 13, 1.04, .26, 2.45], duration: 4600, poster: .45 });

jobs.push(
  { id: "3327", move: fullPlanche, equipment: "none", muscles: ["pec", "shoulder", "core"], camera: [63, 17, .46, -.20, 1.65], duration: 4700, poster: .44 },
  { id: "1275", move: dropPushUp, equipment: "drop-steps", muscles: ["pec"], camera: [45, 19, .41, -.09, 1.70], duration: 3760, poster: .38 },
);

addJobs([
  ["3132", false, { muscles: ["quad", "glute"] }],
  ["1355", true, { duration: 5630, poster: .23, muscles: ["lat"] }],
], { move: supportedSquat, equipment: "rig-contact-wall", muscles: ["quad"], camera: [113, 14, .94, .08, 2.13], duration: 4710, poster: .43 });

addJobs([
  ["1494", { butterfly: true }, { muscles: ["quad"], poster: .43, duration: 5010 }],
  ["1424", {}, { muscles: ["glute"] }],
  ["2567", { twist: true }, { muscles: ["glute"], duration: 5810 }],
], { move: seatedHip, equipment: "mat", muscles: ["glute"], camera: [45, 21, .51, -.03, 1.62], duration: 5520, poster: .23 });

addJobs([
  ["1511", { ham: true }],
  ["3214", { single: true }],
  ["3218", { clasp: true }, { duration: 5050, poster: .48, camera: [51, 17, .89, .02, 1.98] }],
  ["3213", { side: true }, { muscles: ["core"], camera: [36, 13, .89, .02, 2.08] }],
], { move: toeTouch, equipment: "none", muscles: ["hamstring", "glute"], camera: [62, 13, .89, .03, 2.01], duration: 5500, poster: .24 });

addJobs([
  ["0685", { stride: .726, lift: .282, bounce: .067, forward: .09 }, { duration: 1400 }],
  ["3656", { stride: .418, lift: .194, bounce: .044, forward: .072, follow: true }, { duration: 1240 }],
  ["3552", { stride: .222, lift: .101, bounce: .023, forward: .049, steps: 2 }, { duration: 1470 }],
], { move: runStride, equipment: "none", muscles: ["quad", "calf", "glute"],
  camera: [63, 13, .91, .03, 2.09], duration: 1410, poster: .29 });

addJobs([
  ["3361", { width: .414, height: .271, touch: true }],
  ["3671", { width: .341, height: .233 }, { duration: 3070 }],
], { move: horizontalHop, equipment: "none", muscles: ["quad", "glute"], camera: [33, 15, .97, .06, 2.13], duration: 3260, poster: .27 });

jobs.push(
  { id: "0624", move: wallMarch, equipment: "rig-contact-wall", muscles: ["quad"], camera: [119, 13, .84, .16, 2.13], duration: 5840, poster: .47 },
  { id: "1364", move: pelvisRock, equipment: "none", muscles: ["core", "glute"], camera: [65, 12, .91, .03, 1.98], duration: 4700, poster: .31 },
  { id: "0691", move: (f) => backToWall(seatedCore(f, { wall: true, alternate: true })), equipment: "rig-contact-wall",
    muscles: ["core"], camera: [112, 15, .88, .10, 2.15], duration: 5400, poster: .24 },
  { id: "3582", move: jumpLunge, equipment: "none", muscles: ["quad", "glute"], camera: [58, 14, .87, .02, 2.03], duration: 2660, poster: .26 },
  { id: "0628", move: monsterWalk, equipment: "none", muscles: ["quad", "glute"], camera: [32, 16, .83, .03, 1.99], duration: 3330, poster: .28 },
  { id: "1489", move: sissySquat, equipment: "none", muscles: ["quad"], camera: [65, 14, .91, .01, 2.02], duration: 4820, poster: .44 },
);

addJobs([
  ["0277", { rise: .488 }],
  ["0282", { rise: 1.497 }, { duration: 4890 }],
  ["0491", { incline: true }, { equipment: "ab-incline", camera: [63, 16, .90, -.14, 2.11] }],
  ["0495", { twist: true, rise: 1.49 }, { equipment: "ab-steep", camera: [50, 19, .80, -.13, 1.94],
    duration: 6150, poster: .24 }],
], { move: tiltedCore, equipment: "ab-decline", muscles: ["core"], camera: [64, 17, .75, -.12, 1.81], duration: 4610, poster: .47 });

addJobs([
  ["3167", true],
  ["3165", false, { duration: 4450 }],
], { move: towelRow, equipment: "training-towel", muscles: ["trap", "lat", "biceps"], camera: [49, 14, .87, .07, 1.93], duration: 4950, poster: .46 });

jobs.push(
  { id: "0639", move: oneArmDip, equipment: "dip-bench", muscles: ["triceps"], camera: [53, 17, .61, .12, 1.76], duration: 5930, poster: .23 },
  { id: "2963", move: captainRaise, equipment: "captains-chair", muscles: ["core"], camera: [57, 14, .93, .12, 2.08], duration: 4830, poster: .48 },
  { id: "0257", move: quadrupedCircles, equipment: "mat", muscles: ["glute"], camera: [58, 23, .49, -.18, 1.70], duration: 5850, poster: .22 },
  { id: "1769", move: lyingCurl, equipment: "mat", muscles: ["l:biceps"], camera: [-54, 22, .38, -.19, 1.72], duration: 4330, poster: .45 },
  { id: "1772", move: elbowLift, equipment: "mat", muscles: ["trap", "rearShoulder"], camera: [62, 19, .36, -.07, 1.64], duration: 4490, poster: .43 },
  { id: "0020", move: boardStand, equipment: "balance-board", muscles: ["quad", "calf"], camera: [34, 14, .96, .06, 2.08], duration: 5490, poster: .24 },
);

addJobs([
  ["0498", "row", { camera: [58, 13, 1.09, -.04, 2.53] }],
  ["0677", "ring", { equipment: "fitness-rings", camera: [53, 14, 1.09, -.15, 2.51] }],
  ["0805", "fallout", { equipment: "front-suspension", muscles: ["core"], camera: [64, 15, 1.10, .27, 2.45] }],
  ["0806", "push-up", { equipment: "press-suspension", muscles: ["pec", "triceps"], camera: [55, 14, 1.075, -.02, 2.46] }],
  ["0808", "parallel-row", { camera: [63, 14, 1.09, -.08, 2.50] }],
  ["0809", "split", { equipment: "foot-suspension", muscles: ["quad", "glute"], camera: [61, 15, 1.08, -.11, 2.49] }],
], { move: straps, equipment: "row-suspension", muscles: ["lat", "trap", "biceps"], camera: [61, 14, 1.09, .01, 2.48], duration: 4610, poster: .47 });

jobs.push(
  { id: "1374", move: boxDrop, equipment: "plyo-box", muscles: ["calf", "quad"], camera: [59, 14, .99, .84, 2.23], duration: 5500, poster: .24 },
  { id: "1471", move: inchworm, equipment: "none", muscles: ["core", "hamstring"], camera: [69, 14, .89, -.10, 2.13], duration: 5860, poster: .46 },
  { id: "0730", move: slider, equipment: "slide-disc", muscles: ["hamstring"], camera: [55, 16, .88, -.15, 1.95], duration: 4610, poster: .48 },
  { id: "3304", move: skinCat, equipment: "pull-up", muscles: ["trap", "core", "shoulder"], camera: [60, 13, 1.53, .07, 3.21], duration: 6240, poster: .31 },
);

const [directory, ...ids] = process.argv.slice(2);
if (!directory) throw new Error("Pass an output directory and optional catalogue IDs.");
const selected = ids.length ? jobs.filter(({ id }) => ids.includes(id)) : jobs;
if (!selected.length || (ids.length && selected.length !== ids.length)) throw new Error("Invalid or duplicate catalogue ID.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });
const items = [];
for (const { id, equipment, move, options, muscles, camera, duration, poster } of selected) {
  const [yaw, elevation, y, z, height] = camera;
  const keyframes = Array.from({ length: 65 }, (_, index) => ({ at: index / 64, ...move(index / 64, options) }));
  const data = { version: 1, equipment, muscles, camera: { yaw, elevation, focus: [0, y, z], height },
    durationMs: duration, keyframes };
  try {
    prepareRecipe(data);
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause: error });
  }
  const recipe = id + ".json";
  await writeFile(join(output, recipe), JSON.stringify(data) + "\n");
  items.push({ id, recipe, posterAt: poster });
}
await writeFile(join(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "original Spotter bodyweight demonstrations.");
