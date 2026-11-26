import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import {
  pushUp, wallPushUp, sidePushUp, plankVariant, crunch, supineLegRaise, bicycleCrunch, bridge, singleLegBridge, straightLegBridge, reverseBridge, crabWalk, sideFloor,
  lateralSupport,
  proneCurl, seatedCore, ironCross, kneehug, ankleTwist, climber, advancePushUp, divePushUp,
  pressForearms, holdHandstand, fullPlanche, dropPushUp, seatedHip, quadrupedCircles, lyingCurl, elbowLift,
  inchworm,
} from "./bodyweight/floor.mjs";
import {
  jump, squat, bodyweightSquat, goodMorning, wallSlideSquat, lunge, guidedLunge, halfSplitStretch,
  legMobility, upperMobility, calfRaise, standingCalf, calfStretch, singleSquat,
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
  ["1174", { knees: true, width: .051, diamond: true }, { muscles: ["triceps"], camera: [43, 24, .33, -.11, 1.55] }],
  ["1182", { knees: true, width: .190 }, { equipment: "mat", camera: [65, 17, .34, -.12, 1.51] }],
  ["3557", { knees: true, width: .347 }, { equipment: "mat", camera: [43, 21, .34, -.13, 1.63] }],
  ["4658", { knees: true, tap: "shoulder", width: .194 }, { camera: [48, 23, .36, -.08, 1.58], duration: 5800, poster: .34 }],
  ["1311", { width: .355 }, { camera: [46, 22, .37, -.13, 1.66] }],
  ["9325", { width: .196, hold: true }, { duration: 6350, poster: .46 }],
  ["9311", { width: .349, hold: true }, { camera: [44, 24, .35, -.13, 1.66], duration: 6350, poster: .46 }],
  ["3812", { incline: .46, width: .198, z: .74, offset: .10 }, { equipment: "bench", camera: [62, 17, .55, .41, 1.82] }],
  ["5866", { decline: .46, width: .052, diamond: true, offset: .10, z: 2.54, footZ: 1.27 }, { equipment: "bench", muscles: ["triceps", "pec"], camera: [59, 20, .49, 1.68, 2.05] }],
  ["3935", { decline: .46, width: .218, knees: true, offset: .10, z: 2.13 }, { equipment: "bench", camera: [62, 19, .50, 1.48, 1.90] }],
  ["3490", { incline: .31, width: .217, z: .350, knees: true, shallow: true }, { equipment: "plyo-box", camera: [62, 21, .48, .16, 1.54] }],
  ["3011", { incline: .46, width: .183, z: .73, offset: .10, scapula: true }, { equipment: "bench", muscles: ["core"], camera: [61, 22, .47, .40, 1.68] }],
  ["4117", { knees: true, width: .188, scapula: true }, { equipment: "mat", muscles: ["core"], camera: [61, 21, .35, -.12, 1.55] }],
  ["5460", { jump: "flight", width: .193 }, { camera: [59, 19, .37, -.14, 1.61], duration: 2760, poster: .66 }],
  ["10882", { jump: "flight", width: .193, knees: true }, { camera: [47, 22, .36, -.12, 1.52], duration: 3090, poster: .66 }],
  ["4153", { archer: true, width: .478 }, { camera: [33, 21, .36, -.10, 1.78], duration: 5600, poster: .27 }],
], { move: pushUp, equipment: "none", muscles: ["pec"], camera: plank, duration: 4400, poster: .44 });

addJobs([
  ["0659", false],
  ["0658", true, { camera: [-119, 14, .94, .11, 2.12], duration: 5000 }],
  ["2740", "wide", { camera: [124, 17, .94, .11, 2.14] }],
], { move: wallPushUp, equipment: "rig-contact-wall", muscles: ["pec"], camera: [113, 14, .94, .11, 2.12], duration: 4400, poster: .47 });

jobs.push({ id: "0717", move: sidePushUp, equipment: "none", muscles: ["triceps"], camera: [52, 16, .395, -.07, 1.59], duration: 4700, poster: .43 });

addJobs([
  ["5159", { hold: true }, { duration: 6200, poster: .49 }],
  ["2895", { arms: "reach", wide: true }],
  ["2897", { arms: "reach", legs: "opposite", wide: true }, { camera: [60, 20, .37, -.08, 1.61] }],
  ["3501", { forearm: true, legs: "lift" }, { camera: [64, 18, .29, -.12, 1.53] }],
  ["4386", { legs: "lift" }, { camera: [61, 19, .37, -.11, 1.57] }],
  ["3238", { hold: true, forearm: true, knees: true }, { equipment: "mat", duration: 6250, poster: .49 }],
  ["3239", { forearm: true, knees: true, arms: "shoulder" }, { equipment: "mat", camera: [47, 21, .36, -.04, 1.59] }],
  ["2894", { forearm: true, arms: "reach" }, { camera: [59, 20, .28, -.07, 1.54] }],
  ["1440", { arms: "reach" }, { camera: [60, 16, .37, -.10, 1.57], duration: 5620 }],
  ["3983", { oneArm: true, wide: true }, { camera: [49, 22, .385, -.10, 1.64], duration: 6440 }],
  ["7342", { arms: "hip", wide: true }, { camera: [49, 24, .43, -.13, 1.65], duration: 5450 }],
  ["3814", { toeTap: true }, { camera: [61, 22, .38, -.16, 1.63] }],
  ["4023", { toeTap: true, forearm: true }, { camera: [58, 20, .33, -.12, 1.62] }],
  ["4384", { forearm: true, saw: true }, { camera: [66, 17, .28, -.10, 1.56], poster: .46 }],
  ["1478", { jack: true }, { camera: [57, 22, .37, -.11, 1.60], duration: 2710 }],
  ["5157", { forearm: true, jack: true }, { camera: [53, 24, .31, -.12, 1.61], duration: 2790 }],
], { move: plankVariant, equipment: "none", muscles: ["core"], camera: [60, 19, .39, -.09, 1.62], duration: 5440, poster: .24 });

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
  ["3821", { rise: .363, arms: "reach" }, { camera: [59, 20, .37, -.19, 1.63] }],
  ["4332", { rise: .401, arms: "chest", hold: true }, { duration: 6300, poster: .49 }],
  ["0273", { rise: .37, liftBase: 1.53, legs: "straight", arms: "toes" }, { camera: [63, 14, .54, -.16, 1.77] }],
  ["4095", { rise: .40, raise: 1.47, liftBase: .027 }, { camera: [63, 14, .55, -.10, 1.81] }],
  ["5274", { rise: .52, straightTuck: true }, { camera: [59, 18, .48, -.10, 1.69] }],
  ["0634", { rise: .78, negative: true }, { duration: 4920, poster: .34 }],
  ["0482", { rise: 0, reverse: true, tabletop: true, arms: "floor" }, { camera: [63, 20, .40, -.20, 1.71] }],
  ["0487", { rise: 0, reverse: true, arms: "floor" }, { camera: [60, 18, .42, -.16, 1.70] }],
  ["4354", { rise: .43, turn: .64, alternate: true }, { duration: 5660, poster: .24 }],
  ["6016", { rise: .39, turn: .54, alternate: true }, { camera: [54, 20, .43, -.16, 1.70], duration: 5260, poster: .24 }],
], { move: crunch, equipment: "mat", muscles: ["core"], camera: floor, duration: 4400, poster: .46 });

addJobs([
  ["4826", { scissor: true }, { duration: 5710, poster: .25 }],
  ["4001", { alternate: true, head: .245, base: .036 }, { duration: 5740, poster: .24 }],
  ["3590", { alternate: true }, { duration: 5660, poster: .24 }],
  ["2891", { flutters: 2, range: .305, base: .042, head: .213, underHips: true }, { duration: 2180, poster: .26, camera: [64, 21, .30, -.24, 1.61] }],
  ["1179", { flutters: 2, range: .271, base: .033, underHips: true }, { duration: 1970, poster: .24, camera: [60, 21, .3, -.26, 1.62] }],
  ["1244", { flutters: 2, range: .220, base: .045, underHips: true }, { duration: 2280, poster: .26, camera: [58, 20, .31, -.22, 1.61] }],
  ["9321", { flutters: 2, range: .183, base: .039, underHips: true }, { duration: 2160, poster: .24, camera: [68, 22, .31, -.22, 1.63] }],
  ["2850", { bent: true, range: .995 }, { camera: [60, 20, .45, -.25, 1.65] }],
  ["1852", { hipCurl: .119, range: 1.59 }, { camera: [63, 17, .50, -.25, 1.80], duration: 5290, poster: .53 }],
  ["1855", { hipCurl: .096, range: 1.58, head: .221 }, { camera: [62, 19, .52, -.25, 1.81], duration: 5500, poster: .53 }],
  ["1854", { slight: true, base: .115, range: 1.42, underHips: true }, { duration: 4640 }],
  ["3263", { base: .052, range: 1.52 }, { duration: 4560 }],
  ["0619", { single: true, range: 1.23 }, { camera: [64, 19, .42, -.24, 1.66], duration: 4550, poster: .46 }],
  ["4419", { slight: true, base: .121, range: 1.43 }, { duration: 4250 }],
  ["1245", { base: .083, range: 1.472, lowHold: true }, { duration: 6230 }],
  ["0623", { base: .052, range: 1.51, scissor: true }, { duration: 4660, poster: .48 }],
  ["1180", { base: .050, range: 1.49, scissor: true, underHips: true }, { duration: 4830, poster: .49 }],
  ["10913", { range: .473, base: -.018, kneeSupport: true }, { camera: [62, 21, .32, -.24, 1.62], duration: 4990 }],
  ["1181", { base: .056, range: 1.515, underHips: true }, { duration: 4970 }],
  ["2802", { base: .038, range: 1.52, twist: .415, underHips: true }, { camera: [56, 20, .49, -.22, 1.74], duration: 5950, poster: .24 }],
  ["2801", { bent: true, range: .985, twist: .432 }, { camera: [58, 21, .49, -.25, 1.72], duration: 5910, poster: .24 }],
], { move: supineLegRaise, equipment: "mat", muscles: ["core"], camera: [64, 18, .46, -.25, 1.77], duration: 4430, poster: .45 });

addJobs([
  ["0147", { start: .23, rise: .462 }],
  ["5250", { start: .075, rise: .391 }, { duration: 3400, camera: [61, 22, .39, -.22, 1.68] }],
], { move: bicycleCrunch, equipment: "mat", muscles: ["core"], camera: [66, 20, .42, -.22, 1.71], duration: 3250, poster: .25 });

addJobs([
  ["3013", { height: .16 }],
  ["3147", { height: .041, tiltOnly: true }, { muscles: ["core"] }],
  ["1422", { height: .245, tiltFirst: true }, { duration: 4900 }],
  ["3645", { height: .236, single: true }, { muscles: ["r:glute"] }],
  ["0668", { height: .278, hold: true }, { duration: 5500, poster: .46 }],
  ["2471", { height: .243 }, { muscles: ["glute", "hamstring"], camera: [69, 18, .34, -.25, 1.56] }],
], { move: bridge, equipment: "mat", muscles: ["glute"], camera: [64, 18, .35, -.22, 1.54], duration: 4350, poster: .48 });

addJobs([
  ["2474", { height: .223 }],
  ["2475", { height: .234, bent: true }, { camera: [65, 18, .45, -.21, 1.57] }],
  ["4791", { height: .219, crossArms: true, reach: true }, { camera: [65, 19, .42, -.19, 1.55] }],
  ["5198", { height: .225, hold: true, reach: true }, { duration: 6390 }],
  ["6001", { height: .236, hold: true, left: true, reach: true }, { muscles: ["r:glute", "r:hamstring"], duration: 6210, poster: .47 }],
], { move: singleLegBridge, equipment: "mat", muscles: ["glute", "hamstring"], camera: [65, 18, .44, -.21, 1.60], duration: 6100, poster: .24 });

jobs.push({ id: "7419", move: straightLegBridge, equipment: "mat", muscles: ["glute", "hamstring"], camera: [68, 16, .34, -.30, 1.72], duration: 4420, poster: .46 });

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
  ["3948", { depth: .419, hands: "reach" }],
  ["4714", { depth: .462, width: .175 }, { camera: [47, 16, .86, .05, 1.96] }],
  ["4499", { depth: .501, press: true }, { camera: [53, 14, 1.06, .06, 2.35], duration: 5000, poster: .39 }],
  ["4703", { depth: .472, width: .171, press: true }, { camera: [42, 15, 1.066, .08, 2.32], duration: 4740, poster: .81 }],
  ["4294", { depth: .498, hands: "overhead" }, { camera: [54, 14, 1.05, .07, 2.34] }],
  ["0783", { depth: .411, hands: "overhead" }, { camera: [56, 17, 1.05, .085, 2.35] }],
  ["3535", { depth: .425, pulse: true }, { duration: 5590, poster: .47 }],
  ["9702", { depth: .476, pulse: true, hands: "cup" }, { duration: 5640, camera: [43, 14, .88, .05, 1.92] }],
  ["10914", { depth: .128 }, { duration: 3290 }],
  ["5630", { depth: .408, width: .067, hands: "reach" }],
  ["6344", { depth: .413, hold: true }, { duration: 6450 }],
  ["1580", { depth: .401, hands: "prisoner" }, { camera: [47, 14, .92, .01, 2.02] }],
  ["4805", { depth: .425, width: .321, hands: "reach" }, { camera: [43, 13, .91, .051, 1.98] }],
  ["4936", { depth: .469, width: .314, hands: "cup" }, { camera: [41, 14, .86, .05, 1.96] }],
  ["1064", { depth: .411, width: .305, hands: "cup" }, { camera: [38, 15, .88, .04, 1.98] }],
  ["4417", { depth: .616, width: .318, hands: "ground" }, { camera: [45, 16, .84, .058, 1.93], duration: 5460 }],
], { move: bodyweightSquat, equipment: "none", muscles: ["quad", "glute"], camera: [55, 14, .90, .045, 1.99], duration: 4270, poster: .47 });

addJobs([
  ["5555", {}],
  ["5672", { offsetFeet: true }, { camera: [63, 16, .84, -.074, 2.01], duration: 5990, poster: .24 }],
], { move: goodMorning, equipment: "none", muscles: ["hamstring", "glute"], camera: [65, 17, .86, -.03, 1.97], duration: 4270, poster: .46 });

addJobs([
  ["1546", { hip: .804, depth: .379, ankle: -.007 }],
  ["11316", { hip: .858, depth: .176, ankle: -.147 }, { duration: 3970 }],
  ["11451", { hip: .836, depth: .210, ankle: -.103, hold: true }, { duration: 6490 }],
  ["10926", { hip: .866, depth: .113, ankle: -.191, hold: true }, { duration: 6330 }],
], { move: wallSlideSquat, equipment: "rig-contact-wall", muscles: ["quad", "glute"], camera: [111, 16, .95, .11, 2.13], duration: 4580, poster: .47 });

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
  ["0612", { depth: .413 }],
  ["1581", { depth: .415, reverse: true }, { camera: [66, 15, .88, -.092, 2.07] }],
  ["4949", { depth: .383, hinge: true }, { camera: [65, 15, .88, .13, 2.07] }],
  ["4950", { depth: .382, stride: .409 }],
  ["9611", { depth: .413, overhead: true }, { camera: [63, 14, 1.065, .09, 2.46] }],
  ["3702", { depth: .411, overhead: true, pulse: true }, { camera: [63, 14, 1.065, .10, 2.46], duration: 6250 }],
  ["6318", { depth: .318, curtsey: true, stride: .462 }, { camera: [40, 16, .91, -.08, 2.09] }],
  ["4552", { depth: .389, diagonal: true, stride: .446 }, { camera: [36, 16, .91, .11, 2.1] }],
  ["9701", { depth: .391, stride: .757 }, { camera: [65, 15, .86, .14, 2.11] }],
  ["10906", { depth: .428, fixed: true, hold: true }, { duration: 6310, poster: .48 }],
  ["6327", { depth: .432, fixed: true }, { duration: 4380, poster: .47 }],
  ["4000", { depth: .393, fixed: true }, { duration: 4300, poster: .47 }],
  ["2752", { depth: .416, fixed: true }, { camera: [66, 16, .88, .13, 2.09], duration: 4470, poster: .48 }],
], { move: guidedLunge, equipment: "none", muscles: ["quad", "glute"], camera: [61, 15, .89, .115, 2.09], duration: 5630, poster: .24 });

jobs.push({ id: "10907", move: halfSplitStretch, equipment: "mat", muscles: ["l:hamstring"], camera: [66, 18, .62, -.065, 1.70], duration: 6300, poster: .48 });

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
  ["9310", { hold: true }, { duration: 6030, poster: .46 }],
  ["4796", { single: true }, { duration: 6040, poster: .25 }],
  ["4160", { squat: true }, { muscles: ["calf", "quad"], camera: [55, 16, .85, -.04, 1.91], duration: 5020, poster: .46 }],
  ["3120", { wall: true }, { equipment: "rig-contact-wall", camera: [111, 16, .96, .04, 2.12] }],
  ["3534", { wall: true, pulse: true }, { equipment: "rig-contact-wall", camera: [111, 16, .96, .04, 2.12], duration: 5010, poster: .50 }],
  ["10548", { wall: true, single: true, hold: true }, { equipment: "rig-contact-wall", camera: [110, 15, .97, .04, 2.12], duration: 6380, poster: .25 }],
  ["3712", { wall: true, single: true }, { equipment: "rig-contact-wall", camera: [111, 16, .94, .04, 2.10], duration: 5850, poster: .24 }],
], { move: standingCalf, equipment: "none", muscles: ["calf"], camera: [63, 14, .96, -.03, 2.01], duration: 4520, poster: .45 });

addJobs([
  ["4760", { step: true }],
  ["5009", { step: true, hold: true }, { camera: [58, 13, 1.03, .40, 2.50], duration: 5070 }],
  ["4761", { step: true, single: true }, { duration: 6050, poster: .24 }],
  ["5052", { step: true, single: true, hold: true }, { camera: [62, 12, 1.03, .39, 2.50], duration: 6270, poster: .24 }],
  ["5003", { step: true, single: true }, { equipment: "calf-stair-rail", camera: [62, 14, 1.06, .59, 2.38], duration: 6040, poster: .24 }],
], { move: standingCalf, equipment: "calf-step-rail", muscles: ["calf"], camera: [66, 13, 1.03, .36, 2.50], duration: 4710, poster: .43 });

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
  ["4863", { lift: .535 }],
  ["6207", { lift: .535, left: true }, { camera: [-59, 16, .41, -.12, 1.65] }],
  ["3264", { lift: .391 }, { camera: [60, 15, .43, -.14, 1.62], duration: 4970 }],
  ["4907", { lift: .449, hold: true }, { duration: 6240 }],
  ["6208", { lift: .449, hold: true, left: true }, { camera: [-56, 15, .42, -.13, 1.65], duration: 6240 }],
  ["6466", { lift: .352, bend: true }, { camera: [57, 19, .44, -.15, 1.62] }],
  ["9849", { clam: true }, { camera: [-59, 21, .42, -.18, 1.62], muscles: ["core", "glute"] }],
  ["0133", { knees: true, setup: true, hold: true }, { camera: [-63, 20, .41, -.12, 1.65], duration: 6230, muscles: ["core"] }],
  ["1469", { knees: true, setup: true, hold: true, left: true }, { camera: [61, 22, .39, -.12, 1.65], duration: 6230, muscles: ["core"] }],
  ["2899", { knees: true, setup: true, hold: true }, { camera: [-51, 23, .44, -.13, 1.62], duration: 6110, muscles: ["core"] }],
  ["0715", { hand: true, setup: true, hold: true }, { camera: [60, 18, .55, -.16, 1.76], duration: 6280, muscles: ["core"] }],
  ["1470", { setup: true, hold: true }, { duration: 6230, muscles: ["core"] }],
  ["4811", { setup: true, hold: true, left: true }, { camera: [-60, 16, .41, -.12, 1.65], duration: 6330, muscles: ["core"] }],
  ["0617", { lie: true, lift: .665 }, { camera: [61, 19, .36, -.23, 1.67], muscles: ["glute"] }],
  ["6751", { lie: true, lift: .541, backward: true }, { camera: [60, 16, .40, -.22, 1.68], muscles: ["glute"] }],
], { move: lateralSupport, equipment: "mat", muscles: ["core", "glute"], camera: [61, 17, .42, -.13, 1.65], duration: 4780, poster: .46 });

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
