import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { join, resolve } from "node:path";
import { prepareRecipe } from "../../skills/spotter-exercise-demo/lib/recipe.js";
import { sagittalGuideMotion } from "./bodyweight/sagittal-guide.mjs";
import { standingGuideMotion } from "./bodyweight/standing-guide.mjs";
import { lowerGuideMotion } from "./bodyweight/lower-guide.mjs";
import { seatedGuideMotion } from "./bodyweight/seated-guide.mjs";
import { wallGuideMotion } from "./bodyweight/wall-guide.mjs";
import { kneelingGuideMotion } from "./bodyweight/kneeling-guide.mjs";
import { upperMobilityGuideMotion } from "./bodyweight/upper-mobility-guide.mjs";
import { lateralFloorGuideMotion } from "./bodyweight/lateral-floor-guide.mjs";
import { hipMobilityGuideMotion } from "./bodyweight/hip-mobility-guide.mjs";
import { lungeMobilityGuideMotion } from "./bodyweight/lunge-mobility-guide.mjs";
import { supineExtendedGuideMotion } from "./bodyweight/supine-extended-guide.mjs";
import { proneExtendedGuideMotion } from "./bodyweight/prone-extended-guide.mjs";
import { sideBridgeGuideMotion } from "./bodyweight/side-bridge-guide.mjs";
import { quadrupedExtendedGuideMotion } from "./bodyweight/quadruped-extended-guide.mjs";
import { yogaStandingGuideMotion } from "./bodyweight/yoga-standing-guide.mjs";
import { yogaFloorGuideMotion } from "./bodyweight/yoga-floor-guide.mjs";
import { floorTravelGuideMotion } from "./bodyweight/floor-travel-guide.mjs";
import { rep } from "./bodyweight/pose.mjs";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
    const file = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const { catalogueDemo } = await import("../../cloudflare/features/exercises/catalogue-demo.ts");
const catalogue = new URL("../../cloudflare/public/open-gym/index.json", import.meta.url);
const { rows } = JSON.parse(await readFile(catalogue, "utf8"));
const entries = new Map(rows.map(row => [row.id, row]));

// Each constraint was matched against the named guide and the catalogue instructions for that ID.
const sagittalFloor = new Map([
  ["0268", { hands: "head" }],
  ["4331", { hands: "head", plant: "guide", legFit: true }],
  ["4009", { hands: "overhead", posterAt: .49 }],
  ["9024", { hands: "head", durationMs: 2920, posterAt: .24 }],
  ["5472", { hands: "under", hipLift: true }],
  ["6005", { hands: "head", plant: "both" }],
  ["8194", { hands: "side" }],
  ["6752", { hands: "head", plant: "both", legFit: true }],
  ["0621", { hands: "head", cross: true, durationMs: 3680, posterAt: .24 }],
  ["0622", { hands: "under", durationMs: 2620, posterAt: .31 }],
  ["6214", { hands: "under", cross: true, durationMs: 3600, posterAt: .24 }],
  ["3496", { hands: "side", durationMs: 5310, posterAt: .24 }],
  ["9969", { hands: "side", plant: "both", durationMs: 6050, posterAt: .28, muscles: ["hamstring"] }],
  ["9971", { hands: "side", plant: "r", legFit: true, durationMs: 4660, muscles: ["quad"] }],
  ["4330", { hands: "side", hipLift: true, viewHeight: 1.90, durationMs: 5030, posterAt: .50 }],
  ["3865", { hands: "head", twist: true, durationMs: 2990, posterAt: .48 }],
  ["9451", { hands: "side", durationMs: 6420, posterAt: .45 }],
  ["4883", { hands: "head", durationMs: 2950 }],
  ["6108", { hands: "pillow", prone: true, durationMs: 4180, muscles: ["hamstring"] }],
  ["7129", { hands: "pillow", prone: true, durationMs: 4850, posterAt: .24, muscles: ["hamstring"] }],
  ["4702", { hands: "source", prone: true, durationMs: 5510, posterAt: .19, muscles: ["glute", "core"] }],
  ["4715", { hands: "source", prone: true, durationMs: 5300, posterAt: .24, muscles: ["glute", "core"] }],
  ["4935", { hands: "sweep", prone: true, extend: true, durationMs: 5300, muscles: ["glute", "trap"] }],
  ["3483", { hands: "sweep", prone: true, extend: true, durationMs: 6190, muscles: ["glute", "trap"] }],
  ["2394", { hands: "overhead", prone: true, extend: true, durationMs: 4540, muscles: ["glute", "hamstring"] }],
  ["2844", { hands: "overhead", prone: true, extend: true, durationMs: 4740, muscles: ["glute", "hamstring"] }],
  ["4924", { hands: "overhead", prone: true, extend: true, durationMs: 4900, muscles: ["glute", "trap"] }],
  ["0614", { hands: "pillow", prone: true, durationMs: 5530, posterAt: .25, muscles: ["glute", "hamstring"] }],
  ["3228", { hands: "head", prone: true, extend: true, durationMs: 4580, muscles: ["glute", "hamstring"] }],
  ["3229", { hands: "source", prone: true, extend: true, durationMs: 4760, muscles: ["glute", "trap"] }],
  ["3827", { hands: "source", prone: true, extend: true, durationMs: 4420, muscles: ["glute", "hamstring"] }],
  ["1776", { hands: "pillow", prone: true, durationMs: 4560, muscles: ["glute", "hamstring"] }],
  ["6025", { hands: "pillow", prone: true, frog: true, durationMs: 5110, muscles: ["glute", "hamstring"] }],
  ["6024", { hands: "pillow", prone: true, durationMs: 5600, muscles: ["glute", "hamstring"] }],
  ["3230", { hands: "back", prone: true, extend: true, breath: true, durationMs: 6390, muscles: ["trap", "glute"] }],
  ["3226", { hands: "thigh", prone: true, extend: true, breath: true, durationMs: 6370, muscles: ["trap", "glute"] }],
  ["4825", { hands: "wide", prone: true, extend: true, breath: true, durationMs: 6290, muscles: ["trap", "rearShoulder"] }],
  ["10345", { hands: "overhead", prone: true, extend: true, durationMs: 2220, muscles: ["glute", "hamstring"] }],
  ["4939", { hands: "row", prone: true, extend: true, durationMs: 4650, muscles: ["trap", "rearShoulder"] }],
  ["1612", { hands: "source", prone: true, extend: true, durationMs: 4550, posterAt: .24, muscles: ["glute", "hamstring"] }],
  ["3227", { hands: "overhead", prone: true, extend: true, durationMs: 2400, muscles: ["glute", "hamstring"] }],
  ["4779", { hands: "head", durationMs: 2380, posterAt: .24 }],
  ["4980", { hands: "head", durationMs: 2520, posterAt: .24 }],
  ["0145", { bridge: true, hipLift: true, plant: "both", legFit: true, muscles: ["glute", "hamstring"] }],
  ["4511", { bridge: true, hipLift: true, plant: "both", legFit: true, durationMs: 6070, muscles: ["glute", "hamstring"] }],
  ["8358", { bridge: true, hipLift: true, plant: "both", legFit: true, footReach: 1.10, muscles: ["hamstring", "glute"] }],
  ["10904", { bridge: true, hipLift: true, plant: "both", legFit: true, footReach: 1.135, durationMs: 4660, muscles: ["hamstring", "glute"] }],
  ["10905", { bridge: true, hipBase: .379, plant: "guide", legFit: true, footReach: 1.108, durationMs: 5190, muscles: ["hamstring", "glute"] }],
  ["0486", { bridge: true, hipLift: true, plant: "both", legFit: true, durationMs: 4630, muscles: ["glute"] }],
  ["0485", { bridge: true, hipLift: true, plant: "both", legFit: true, durationMs: 4960, muscles: ["glute"] }],
  ["0726", { bridge: true, hipLift: true, plant: "l", legFit: true, durationMs: 4630, muscles: ["l:glute"] }],
  ["3583", { bridge: true, hipLift: true, plant: "l", legFit: true, durationMs: 4680, muscles: ["l:glute"] }],
  ["6000", { bridge: true, hipLift: true, plant: "r", legFit: true, durationMs: 4760, muscles: ["r:glute"] }],
  ["9359", { bridge: true, hipLift: true, plant: "l", legFit: true, footReach: 1.11, durationMs: 4690, muscles: ["l:hamstring", "l:glute"] }],
  ["3435", { bridge: true, hipLift: true, plant: "l", legFit: true, durationMs: 4920, muscles: ["l:glute"] }],
  ["7418", { bridge: true, hipLift: true, plant: "both", legFit: true, durationMs: 4620, muscles: ["glute", "hamstring"] }],
  ["4255", { bridge: true, hipLift: true, plant: "both", footReach: 1.25, durationMs: 4620, muscles: ["glute", "hamstring"] }],
  ["5805", { bridge: true, hipLift: true, plant: "both", legFit: true, feetWidth: .243, durationMs: 5500, muscles: ["glute"] }],
  ["4690", { bridge: true, hipLift: true, plant: "l", legFit: true, figureFour: true, durationMs: 4850, muscles: ["l:glute"] }],
  ["5167", { bridge: true, hipLift: true, plant: "l", legFit: true, external: "r", durationMs: 5100, muscles: ["l:glute"] }],
  ["4044", { bridge: true, hipLift: true, plant: "l", legFit: true, durationMs: 4870, muscles: ["l:glute"] }],
  ["5062", { chin: true, hands: "side", durationMs: 5090, muscles: [] }],
]);

const standingUpper = new Map([
  ["2775", { single: true }],
  ["2776", { single: true }],
  ["2777", { single: true, plane: "sagittal", yaw: 57 }],
  ["2778", { single: true, plane: "sagittal", yaw: 57 }],
  ["2779", { mode: "rotation", single: true, start: .04, end: 1.19 }],
  ["2780", { mode: "rotation", single: true, start: -.96, end: .044 }],
  ["2781", { mode: "horizontal", single: true, start: .03, end: 1.81 }],
  ["2782", { mode: "horizontal", single: true, start: -.48, end: 1.57 }],
  ["2783", { mode: "horizontal", single: true, start: .03, end: 1.96 }],
  ["2784", { mode: "horizontal", single: true, start: .03, end: 1.57 }],
  ["5172", { mode: "cross", durationMs: 4170 }],
  ["3409", { mode: "cross", durationMs: 3870 }],
  ["3260", { mode: "cross", durationMs: 3320 }],
  ["4665", { mode: "clap", durationMs: 3030, posterAt: .49 }],
  ["4876", { mode: "contact", durationMs: 5440, yaw: 36 }],
  ["4945", { mode: "chest", breath: true, durationMs: 6180, yaw: -55, muscles: ["pec", "shoulder"] }],
  ["1970", { mode: "chest", durationMs: 5670, yaw: -55, muscles: ["pec", "shoulder"] }],
  ["4395", { mode: "roll", durationMs: 4790 }],
  ["3416", { mode: "roll", durationMs: 5020, yaw: 38 }],
  ["3257", { mode: "circle", single: true, period: 8, durationMs: 6080 }],
  ["3258", { mode: "circle", durationMs: 4210 }],
  ["3259", { plane: "sagittal", durationMs: 6310, yaw: 57 }],
  ["3404", { mode: "cross", openOnly: true, durationMs: 4400 }],
  ["3405", { durationMs: 4440 }],
  ["3403", { durationMs: 4330 }],
  ["3855", { mode: "spine", durationMs: 5410, yaw: 57, muscles: ["core"] }],
  ["9653", { mode: "twist", durationMs: 4080, muscles: ["core"] }],
  ["3408", { mode: "twist", clasp: true, durationMs: 4900, muscles: ["core"] }],
  ["3254", { mode: "side", clasp: true, durationMs: 5140, muscles: ["core"] }],
  ["3256", { mode: "side", durationMs: 5120, muscles: ["core"] }],
  ["3997", { mode: "side", durationMs: 5450, muscles: ["core"] }],
  ["4322", { mode: "side", durationMs: 4980, muscles: ["core"] }],
  ["4810", { mode: "side", durationMs: 4860, muscles: ["core"] }],
  ["2113", { mode: "side", shift: true, width: .166, durationMs: 6120, muscles: ["core"] }],
  ["2117", { mode: "side", durationMs: 6150, muscles: ["core"] }],
  ["2119", { mode: "side", durationMs: 5710, muscles: ["core"] }],
  ["2785", { mode: "spine", durationMs: 5000, yaw: 56, muscles: ["core"] }],
  ["2786", { mode: "spine", durationMs: 5050, yaw: 56, muscles: ["core"] }],
  ["2787", { mode: "side", durationMs: 5080, muscles: ["core"] }],
  ["2788", { mode: "twist", crossChest: true, durationMs: 4950, muscles: ["core"] }],
]);

const standingLower = new Map([
  ["10751", { startY: .968, forefoot: true, plane: "side", durationMs: 1450 }],
  ["10757", { startY: .964, forefoot: true, durationMs: 1960 }],
  ["9514", { startY: .916, plane: "side", hands: "hips", durationMs: 2230 }],
  ["9513", { startY: .917, plane: "side", durationMs: 2140, headroom: true }],
  ["7543", { startY: .871, plane: "side", durationMs: 2450, headroom: true }],
  ["3704", { startY: .535, plane: "side", durationMs: 2650, headroom: true }],
  ["1570", { startY: .549, plane: "side", durationMs: 2830, headroom: true }],
  ["5745", { startY: .546, plane: "side", durationMs: 2660, headroom: true }],
  ["9070", { startY: .974, plane: "side", forefoot: true, durationMs: 1260 }],
  ["4118", { startY: .545, plane: "side", hands: "prisoner", durationMs: 2720 }],
  ["1584", { startY: .535, plane: "side", durationMs: 2660, headroom: true }],
  ["5153", { startY: .843, hands: "swing", durationMs: 2800 }],
  ["8916", { startY: .824, hands: "swing", durationMs: 2710 }],
  ["11647", { startY: .967, plane: "side", forefoot: true, durationMs: 1490 }],
  ["4254", { startY: .871, plane: "side", durationMs: 2550, headroom: true }],
  ["7556", { startY: .503, sit: true, hands: "chest", durationMs: 2230, distance: .76 }],
  ["0785", { startY: .490, sit: true, hands: "chest", durationMs: 2320, distance: .78 }],
  ["3927", { startY: .961, forefoot: true, plane: "side", hands: "front", durationMs: 4980 }],
  ["3706", { startY: .530, plane: "side", durationMs: 2700, headroom: true }],
  ["4904", { startY: .975, plane: "side", forefoot: true, durationMs: 1340 }],
  ["3700", { startY: .543, plane: "side", durationMs: 2730, headroom: true }],
  ["5865", { startY: .503, sit: true, hands: "chest", durationMs: 3070 }],
  ["0461", { startY: .444, sit: true, hands: "chest", durationMs: 4800, heightScale: .70, footLock: true }],
  ["3500", { startY: .917, sit: true, hands: "chest", durationMs: 5660, footLock: true, kneeBrace: true }],
  ["4547", { startY: .912, plane: "side", hands: "prisoner", durationMs: 5920 }],
  ["4387", { startY: .916, sit: true, hands: "chest", durationMs: 6420, footLock: true, kneeBrace: true, breath: true }],
  ["2988", { startY: .915, sit: true, hands: "chest", durationMs: 5690, footLock: true, kneeBrace: true }],
  ["2989", { startY: .914, sit: true, hands: "chest", durationMs: 5710, footLock: true, kneeBrace: true }],
  ["10551", { startY: .460, sit: true, hands: "chest", durationMs: 5750, heightScale: .72, footLock: true, kneeBrace: true }],
  ["2972", { startY: .897, sit: true, hands: "chest", durationMs: 4510, distance: .87 }],
  ["1899", { startY: .741, sit: true, durationMs: 6060, distance: .84, footLock: true }],
  ["0711", { startY: .737, sit: true, durationMs: 5810, distance: .82, footLock: true }],
  ["8971", { startY: .741, sit: true, durationMs: 5900, distance: .86, footLock: true }],
  ["4789", { startY: .905, sit: true, hands: "front", durationMs: 4920, distance: .88, footLock: true }],
  ["4909", { startY: .905, sit: true, hands: "front", durationMs: 5730 }],
  ["10754", { startY: .941, plane: "side", forefoot: true, durationMs: 1450 }],
]);

const seatedFloor = new Map([
  ["5128", { legs: "cross", durationMs: 4780, muscles: ["trap", "rearShoulder"] }],
  ["5134", { legs: "cross", durationMs: 4920, muscles: ["shoulder"] }],
  ["5063", { legs: "kneel", hands: "lap", plane: "side", facing: 1, pitch: .032, neck: "tuck", durationMs: 5360, muscles: [] }],
  ["3962", { legs: "track", hands: "rear", plane: "side", pitch: -.499, durationMs: 2420 }],
  ["3509", { legs: "track", hands: "rear", plane: "side", pitch: -.493, durationMs: 4730 }],
  ["1914", { legs: "wide", straight: true, hands: "fold", plane: "side", durationMs: 5930, muscles: ["hamstring"] }],
  ["1915", { legs: "oneStraight", straight: true, hands: "toe", plane: "side", durationMs: 5790, muscles: ["l:hamstring"] }],
  ["2114", { legs: "cross", hands: "side", lean: true, durationMs: 6080, muscles: ["core"] }],
  ["5132", { legs: "cross", scapula: true, durationMs: 3640, muscles: ["trap", "rearShoulder"] }],
  ["5135", { legs: "cross", hands: "twist", turn: .68, durationMs: 5870, muscles: ["core"] }],
  ["3978", { legs: "track", hands: "rear", plane: "side", pitch: -.501, legSway: true, durationMs: 4730 }],
  ["5081", { legs: "cross", hands: "rear", plane: "side", facing: 1, neck: "sky", durationMs: 5730, muscles: ["pec"] }],
  ["4307", { legs: "cross", hands: "t", turn: .73, durationMs: 5490, muscles: ["core"] }],
  ["5129", { legs: "cross", hands: "cross", turn: .73, durationMs: 5490, muscles: ["core"] }],
  ["1807", { legs: "cross", hands: "fold", plane: "side", facing: 1, reach: .36, durationMs: 5940, muscles: ["glute"] }],
  ["1809", { legs: "butterfly", hands: "toe", plane: "side", durationMs: 5980, muscles: ["quad"] }],
  ["9487", { legs: "track", hands: "rear", plane: "side", pitch: -.38, durationMs: 4520 }],
  ["9272", { hands: "rear", plane: "side", pitch: -.26, straight: true, toeLift: true, durationMs: 4370, muscles: [] }],
  ["2118", { legs: "cross", hands: "side", lean: true, durationMs: 5610 }],
  ["1806", { legs: "cross", hands: "side", lean: true, durationMs: 5990 }],
  ["2873", { plane: "side", straight: true, durationMs: 5920 }],
  ["2868", { hands: "t", straight: true, turn: .69, durationMs: 5650 }],
  ["0692", { legs: "oneStraight", straight: true, hands: "toe", plane: "side", durationMs: 5710, muscles: ["l:hamstring"] }],
]);

const wallSupported = new Map([
  ["4394", { mode: "backFlex", tall: true, muscles: ["shoulder"], durationMs: 5730 }],
  ["4612", { mode: "wallArc", tall: true, muscles: ["shoulder"], durationMs: 4870 }],
  ["4613", { mode: "military", tall: true, muscles: ["shoulder", "triceps"], durationMs: 4430 }],
  ["8536", { mode: "tibialis", muscles: ["calf"], durationMs: 3780 }],
  ["10859", { mode: "tibialis", muscles: ["calf"], durationMs: 3900 }],
  ["9803", { mode: "tibialis", muscles: ["calf"], durationMs: 3960 }],
  ["7414", { mode: "crunch", muscles: ["core"], durationMs: 4470, floor: true }],
  ["2941", { mode: "slide", muscles: ["shoulder", "trap"], durationMs: 4740 }],
  ["8956", { mode: "sit", muscles: ["quad", "glute"], durationMs: 4940 }],
  ["4381", { mode: "legsUp", muscles: ["hamstring"], durationMs: 6210, floor: true, hold: true }],
  ["1905", { mode: "legsUp", spread: true, muscles: ["hamstring"], durationMs: 6190, floor: true, hold: true }],
  ["7216", { mode: "opposite", muscles: ["core", "glute"], durationMs: 5410 }],
  ["2945", { mode: "scapula", muscles: ["trap", "rearShoulder"], durationMs: 4890 }],
  ["5025", { mode: "slide", muscles: ["pec", "shoulder"], durationMs: 4820 }],
  ["2931", { mode: "backFlex", tall: true, muscles: ["shoulder"], durationMs: 4520 }],
  ["7623", { mode: "lat", muscles: ["l:lat"], durationMs: 6040, hold: true }],
  ["4617", { mode: "push", single: true, muscles: ["l:pec", "l:triceps"], durationMs: 4580 }],
  ["0731", { mode: "sit", single: true, muscles: ["quad", "glute"], durationMs: 5920, hold: true }],
  ["0734", { mode: "sit", muscles: ["quad", "glute"], durationMs: 6100, hold: true }],
  ["9040", { mode: "sprint", muscles: ["quad", "glute"], durationMs: 2160 }],
  ["1829", { mode: "triceps", muscles: ["l:triceps"], durationMs: 5560, hold: true }],
  ["2092", { mode: "wrist", muscles: ["l:forearm"], durationMs: 5480, hold: true }],
  ["7389", { mode: "plank", muscles: ["core"], durationMs: 6140, hold: true }],
  ["4096", { mode: "heelTap", muscles: ["core"], durationMs: 4610, floor: true }],
  ["5174", { mode: "push", width: .126, muscles: ["pec", "triceps"], durationMs: 4280 }],
  ["7557", { mode: "sit", width: .063, muscles: ["quad", "glute"], durationMs: 6190, hold: true }],
]);

const kneelingFloor = new Map([
  ["3034", { mode: "kick", durationMs: 4680, muscles: ["glute"] }],
  ["6747", { mode: "glute", durationMs: 5030, muscles: ["glute"] }],
  ["5170", { mode: "glute", pulse: true, viewHeight: 1.89, durationMs: 5220, muscles: ["glute"] }],
  ["6748", { mode: "curl", durationMs: 4710, muscles: ["hamstring"] }],
  ["4968", { mode: "curl", durationMs: 4660, muscles: ["hamstring"] }],
  ["4772", { mode: "kick", durationMs: 4770, muscles: ["r:glute"] }],
  ["6209", { mode: "kick", active: "left", durationMs: 4770, muscles: ["l:glute"] }],
  ["3114", { mode: "kick", durationMs: 4570, muscles: ["r:glute"] }],
  ["5029", { mode: "rotation", durationMs: 6100, muscles: ["core"] }],
  ["1812", { mode: "rotation", durationMs: 6220, muscles: ["core"] }],
  ["3526", { mode: "rotation", durationMs: 6250, muscles: ["core"] }],
  ["3540", { mode: "rotation", durationMs: 6320, muscles: ["core"] }],
  ["8052", { mode: "rotation", durationMs: 5740, muscles: ["core"] }],
  ["7895", { mode: "thread", durationMs: 5970, muscles: ["core", "rearShoulder"] }],
  ["4506", { mode: "tap", durationMs: 5280, muscles: ["core"] }],
  ["1988", { mode: "cross", durationMs: 6060, muscles: ["rearShoulder"] }],
  ["3417", { mode: "reach", durationMs: 6120, muscles: ["shoulder"] }],
  ["2124", { mode: "bow", durationMs: 6220, muscles: ["lat", "core"] }],
  ["0561", { mode: "wrist", breath: true, durationMs: 5280, muscles: ["forearm"] }],
  ["4669", { mode: "thrust", tall: true, durationMs: 4740, muscles: ["glute"] }],
  ["5057", { mode: "circle", tall: true, breath: true, durationMs: 5830, muscles: ["glute", "core"] }],
  ["3505", { mode: "camel", tall: true, breath: true, durationMs: 6360, muscles: ["core", "pec"] }],
  ["6303", { mode: "camel", tall: true, breath: true, durationMs: 6430, muscles: ["core", "pec"] }],
  ["2109", { mode: "abdomen", tall: true, durationMs: 5350, muscles: ["core"] }],
  ["10566", { mode: "turn", tall: true, durationMs: 5650, muscles: ["core"] }],
  ["11792", { mode: "biceps", tall: true, breath: true, durationMs: 6120, muscles: ["biceps"] }],
]);

const upperMobility = new Map([
  ["1777", { mode: "overhead", clasp: true, headroom: true, muscles: ["pec"], durationMs: 5710 }],
  ["1816", { mode: "overhead", headroom: true, muscles: ["lat", "shoulder"], durationMs: 5820 }],
  ["1788", { mode: "overhead", narrow: true, headroom: true, muscles: ["lat", "shoulder"], durationMs: 5390 }],
  ["1983", { mode: "overhead", narrow: true, headroom: true, muscles: ["shoulder"], durationMs: 6240 }],
  ["11288", { mode: "overheadShrug", headroom: true, muscles: ["trap"], durationMs: 4210 }],
  ["1980", { mode: "frontCross", muscles: ["l:rearShoulder"], durationMs: 5720 }],
  ["1981", { mode: "frontCross", bent: true, muscles: ["l:rearShoulder"], durationMs: 5750 }],
  ["1792", { mode: "frontCross", muscles: ["l:rearShoulder"], durationMs: 6200 }],
  ["1979", { mode: "frontCross", muscles: ["l:rearShoulder", "l:trap"], durationMs: 5890 }],
  ["2087", { mode: "frontCross", round: true, muscles: ["l:rearShoulder", "l:trap"], durationMs: 5990 }],
  ["1480", { mode: "behind", muscles: ["biceps"], yaw: 68, durationMs: 6200 }],
  ["1488", { mode: "behind", muscles: ["shoulder"], yaw: 71, durationMs: 6020 }],
  ["1971", { mode: "behind", muscles: ["shoulder"], yaw: 65, durationMs: 5710 }],
  ["1974", { mode: "behind", muscles: ["shoulder", "trap"], yaw: 74, durationMs: 6090 }],
  ["1782", { mode: "behind", muscles: ["pec"], yaw: 65, durationMs: 5980 }],
  ["1787", { mode: "behind", open: true, muscles: ["pec"], yaw: 67, durationMs: 5910 }],
  ["3516", { mode: "behind", arch: true, muscles: ["shoulder", "pec"], yaw: 69, durationMs: 6400 }],
  ["1977", { mode: "backPull", wristPull: true, muscles: ["l:shoulder"], yaw: 139, durationMs: 6280 }],
  ["1978", { mode: "backPull", muscles: ["l:shoulder", "l:lat"], yaw: 131, durationMs: 6210 }],
  ["1987", { mode: "backPull", upper: true, muscles: ["l:shoulder"], yaw: 135, durationMs: 5810 }],
  ["1986", { mode: "rotator", headroom: true, muscles: ["l:shoulder"], durationMs: 5780 }],
  ["1985", { mode: "rotator", out: true, muscles: ["l:shoulder"], durationMs: 6030 }],
  ["1828", { mode: "triceps", headroom: true, muscles: ["l:triceps"], durationMs: 6030 }],
  ["0256", { mode: "elbowCircle", muscles: ["shoulder"], durationMs: 4300 }],
  ["4672", { mode: "squeeze", muscles: ["trap", "rearShoulder"], yaw: 54, durationMs: 5770 }],
  ["8585", { mode: "squeeze", muscles: ["trap", "rearShoulder"], yaw: 47, durationMs: 4320 }],
  ["2764", { mode: "curl", single: true, muscles: ["l:biceps"], durationMs: 4390 }],
  ["4361", { mode: "shrug", muscles: ["trap"], durationMs: 3980 }],
  ["3130", { mode: "shrug", muscles: ["trap"], durationMs: 4520 }],
  ["7232", { mode: "scapCircle", muscles: ["trap"], yaw: 67, durationMs: 4910 }],
  ["7233", { mode: "scapCircle", muscles: ["trap"], yaw: 10, durationMs: 4770 }],
  ["6137", { mode: "scapRow", muscles: ["trap", "rearShoulder"], yaw: 66, durationMs: 3940 }],
  ["3129", { mode: "scapRow", muscles: ["trap"], yaw: 74, durationMs: 4310 }],
  ["8342", { mode: "scapRotate", muscles: ["rearShoulder"], durationMs: 4370 }],
  ["1982", { mode: "shoulderRotate", muscles: ["l:rearShoulder"], durationMs: 5870 }],
  ["3994", { mode: "neckCircle", muscles: ["trap"], durationMs: 5940 }],
  ["7306", { mode: "neckSide", muscles: ["trap"], durationMs: 6010 }],
  ["2090", { mode: "forearmClasp", muscles: ["forearm"], yaw: 53, durationMs: 5150 }],
  ["1428", { mode: "wristCircle", muscles: ["forearm"], yaw: 55, durationMs: 4200 }],
  ["11383", { mode: "forearm", muscles: ["l:forearm"], yaw: 55, durationMs: 5710 }],
  ["2091", { mode: "forearm", muscles: ["l:forearm"], yaw: 57, durationMs: 5710 }],
  ["1850", { mode: "forearm", palmUp: true, direction: -1.189, muscles: ["l:forearm"], yaw: 53, durationMs: 5840 }],
  ["1814", { mode: "forearm", palmUp: true, muscles: ["l:forearm"], yaw: 52, durationMs: 5990 }],
  ["1823", { mode: "forearm", radial: "thumb", muscles: ["l:forearm"], yaw: 54, durationMs: 5770 }],
  ["1824", { mode: "forearm", radial: "thumb", palmUp: true, muscles: ["l:forearm"], yaw: 53, durationMs: 5970 }],
  ["1822", { mode: "forearm", radial: "pinky", muscles: ["l:forearm"], yaw: 52, durationMs: 5860 }],
  ["1825", { mode: "forearm", radial: "pinky", palmUp: true, muscles: ["l:forearm"], yaw: 51, durationMs: 5970 }],
  ["2098", { mode: "forearm", radial: "pinky", direction: .03, muscles: ["l:forearm"], yaw: 53, durationMs: 5650 }],
  ["1815", { mode: "forearm", pronate: true, direction: .055, muscles: ["l:forearm"], yaw: 55, durationMs: 5910 }],
  ["1821", { mode: "forearm", pronate: true, direction: .05, muscles: ["l:forearm"], yaw: 54, durationMs: 5190 }],
  ["1830", { mode: "elbowFold", muscles: ["l:triceps"], yaw: 48, durationMs: 5920 }],
]);

const lateralFloor = new Map([
  ["8289", { mode: "chest", muscles: ["r:pec", "r:shoulder"], durationMs: 6440 }],
  ["2461", { mode: "clam", headSupport: true, muscles: ["r:glute"], durationMs: 4850 }],
  ["4870", { mode: "clam", headSupport: true, muscles: ["r:glute"], durationMs: 4530 }],
  ["10933", { mode: "external", muscles: ["r:rearShoulder"], durationMs: 4680 }],
  ["7213", { mode: "internal", muscles: ["l:shoulder"], durationMs: 4810 }],
  ["0712", { mode: "both", headSupport: true, muscles: ["core", "glute"], durationMs: 5890 }],
  ["4156", { mode: "both", headSupport: true, muscles: ["core", "glute"], durationMs: 4710 }],
  ["1358", { mode: "stretch", muscles: ["lat", "core"], durationMs: 6180 }],
  ["5998", { mode: "adduct", headSupport: true, muscles: ["l:adductor"], durationMs: 5020 }],
  ["3667", { mode: "adduct", headSupport: true, muscles: ["l:adductor"], durationMs: 5130 }],
  ["3926", { mode: "circle", headSupport: true, muscles: ["r:glute"], durationMs: 5630 }],
  ["4884", { mode: "kick", headSupport: true, muscles: ["r:glute", "r:quad"], durationMs: 5100 }],
  ["4882", { mode: "scissor", headSupport: true, muscles: ["glute", "adductor"], durationMs: 4810 }],
  ["11047", { mode: "abduct", headSupport: true, backward: true, muscles: ["r:glute"], durationMs: 5420 }],
  ["2852", { mode: "abduct", headSupport: true, muscles: ["r:glute"], durationMs: 5060 }],
  ["6754", { mode: "external", muscles: ["r:rearShoulder"], durationMs: 4780 }],
  ["4601", { mode: "chest", muscles: ["r:pec", "r:shoulder"], durationMs: 6370 }],
  ["6753", { mode: "neck", muscles: ["trap"], durationMs: 4850 }],
  ["4299", { mode: "quad", headSupport: true, muscles: ["r:quad"], durationMs: 6250 }],
  ["11374", { mode: "sleeper", muscles: ["l:rearShoulder"], durationMs: 6320 }],
]);

const hipMobility = new Map([
  ["1056", { mode: "figure", muscles: ["r:glute"], durationMs: 6190 }],
  ["3472", { mode: "tuck", muscles: ["l:glute"], durationMs: 5860 }],
  ["1810", { mode: "tuck", muscles: ["l:glute"], durationMs: 6240 }],
  ["3396", { mode: "tuck", muscles: ["l:glute", "l:hamstring"], durationMs: 6320 }],
  ["3474", { mode: "tuck", overhead: true, viewHeight: 1.81, muscles: ["l:glute"], durationMs: 5960 }],
  ["3475", { mode: "tuckBoth", muscles: ["glute", "core"], durationMs: 5930 }],
  ["3476", { mode: "roll", side: -1, muscles: ["core"], durationMs: 6030 }],
  ["3477", { mode: "roll", side: -1, floorDrop: true, muscles: ["r:core"], durationMs: 6130 }],
  ["3478", { mode: "roll", side: 1, muscles: ["l:core"], durationMs: 6180 }],
  ["2854", { mode: "circle", muscles: ["l:core", "l:quad"], durationMs: 5650 }],
  ["4987", { mode: "eight", muscles: ["core"], durationMs: 5350 }],
  ["4881", { mode: "bridge", muscles: ["glute", "hamstring"], durationMs: 4930 }],
  ["3393", { mode: "vertical", viewHeight: 1.98, muscles: ["core"], durationMs: 4460 }],
  ["4018", { mode: "vertical", viewHeight: 1.98, muscles: ["core"], durationMs: 4380 }],
  ["5106", { mode: "point", viewHeight: 1.98, muscles: ["core"], durationMs: 3860 }],
]);

const jumpMobility = new Map([
  ["9066", { multiAxis: true, startY: .842, distance: .81, durationMs: 6080 }],
  ["10818", { multiAxis: true, startY: .842, distance: .81, durationMs: 6220 }],
  ["4918", { startY: .882, highKnees: true, durationMs: 2990 }],
  ["4709", { startY: .664, hands: "shot", durationMs: 2150 }],
  ["3543", { plane: "side", startY: .575, heightScale: .75, durationMs: 2130 }],
  ["6100", { plane: "side", startY: .901, distance: .92, durationMs: 3110 }],
  ["10756", { plane: "side", startY: .960, forefoot: true, durationMs: 1990 }],
  ["7194", { startY: .851, cross: true, durationMs: 3070 }],
  ["11283", { startY: .706, cross: true, tuck: true, durationMs: 2520 }],
  ["5105", { startY: .872, cross: true, durationMs: 2440 }],
  ["1698", { plane: "side", startY: .878, distance: .86, forwardSingle: true, durationMs: 2150 }],
  ["3088", { plane: "side", startY: .592, distance: .82, durationMs: 2400 }],
  ["3091", { plane: "side", startY: .912, distance: .84, durationMs: 3550 }],
  ["9679", { startY: .865, highKnees: true, hands: "tap", durationMs: 2820 }],
  ["7341", { startY: .859, distance: .79, hands: "swing", durationMs: 2300 }],
  ["0510", { plane: "side", yaw: 51, jackAfter: true, startY: .862, heightScale: .87, durationMs: 3890 }],
  ["1166", { plane: "side", startY: .598, durationMs: 2550 }],
  ["4771", { plane: "side", startY: .594, hands: "hips", durationMs: 2590 }],
  ["4706", { startY: .880, distance: .83, durationMs: 3620 }],
  ["5966", { startY: .862, spin: true, alternating: true, durationMs: 2250 }],
  ["10187", { startY: .868, distance: .79, durationMs: 5000 }],
  ["7555", { startY: .866, highKnees: true, durationMs: 3580 }],
  ["4169", { plane: "side", startY: .524, pistol: true, durationMs: 2490 }],
  ["5148", { plane: "side", startY: .602, durationMs: 2480 }],
  ["4898", { startY: .864, hands: "swing", durationMs: 2330 }],
  ["9408", { startY: .966, forefoot: true, heightScale: .45, durationMs: 1470 }],
  ["3269", { plane: "side", startY: .876, durationMs: 3120 }],
  ["3270", { startY: .876, durationMs: 3320 }],
  ["3272", { plane: "side", startY: .871, durationMs: 3290 }],
  ["5124", { startY: .861, spin: true, alternating: true, staySquare: true, durationMs: 2350 }],
  ["5482", { plane: "side", startY: .865, durationMs: 1910 }],
  ["3199", { plane: "side", startY: .903, distance: .91, durationMs: 3290 }],
  ["10925", { startY: .849, hands: "swing", durationMs: 3010 }],
]);

const lungeMobility = new Map([
  ["5891", { mode: "high", hold: true, viewHeight: 2.23, muscles: ["glute", "quad"], durationMs: 6420 }],
  ["6007", { mode: "step", muscles: ["quad", "glute"], durationMs: 5940 }],
  ["6008", { mode: "step", front: "right", muscles: ["r:quad", "r:glute"], durationMs: 6160 }],
  ["4930", { mode: "rest", hold: true, muscles: ["r:quad", "l:glute"], durationMs: 5580 }],
  ["5906", { mode: "prayer", hold: true, muscles: ["core", "quad"], durationMs: 6410 }],
  ["3461", { mode: "reach", hold: true, muscles: ["quad", "lat"], durationMs: 5770 }],
  ["3462", { mode: "reach", single: true, hold: true, muscles: ["r:lat", "r:quad"], durationMs: 5840 }],
  ["3463", { mode: "reach", single: true, arc: true, hold: true, muscles: ["r:lat", "r:quad"], durationMs: 5900 }],
  ["3464", { mode: "hands", hold: true, rearStraight: true, muscles: ["glute", "quad"], durationMs: 6050 }],
  ["3465", { mode: "upRotate", hold: true, muscles: ["core", "quad"], durationMs: 6160 }],
  ["3466", { mode: "elbows", hold: true, rearStraight: true, muscles: ["glute", "adductor"], durationMs: 6260 }],
  ["3467", { mode: "tRotate", hold: true, muscles: ["core", "quad"], durationMs: 6360 }],
  ["8162", { mode: "hinge", hold: true, muscles: ["l:hamstring", "r:quad"], durationMs: 6030 }],
  ["8987", { mode: "rest", side: true, hold: true, muscles: ["l:adductor", "l:glute"], durationMs: 6320 }],
  ["3481", { mode: "split", sprint: true, muscles: ["quad", "glute"], durationMs: 4520 }],
  ["3482", { mode: "split", sprint: true, shallow: true, muscles: ["quad", "glute"], durationMs: 4420 }],
  ["8755", { mode: "split", heel: true, muscles: ["quad", "glute", "l:calf"], durationMs: 5050 }],
  ["5892", { mode: "hands", floorGuide: true, rearStraight: true, hold: true, muscles: ["adductor", "quad"], durationMs: 6420 }],
]);

const supineExtended = new Map([
  ["4007", { mode: "heelTap", tabletop: true, muscles: ["core"], durationMs: 4710 }],
  ["6428", { mode: "heelTap", muscles: ["core"], durationMs: 4550 }],
  ["0003", { mode: "cycle", muscles: ["core"], durationMs: 2920 }],
  ["2395", { mode: "cycle", muscles: ["core"], durationMs: 3140 }],
  ["7850", { mode: "cycle", reverse: true, muscles: ["core"], durationMs: 3260 }],
  ["6464", { mode: "bridge", frog: true, muscles: ["glute"], durationMs: 4910 }],
  ["2757", { mode: "bridge", frog: true, muscles: ["glute"], durationMs: 4660 }],
  ["6570", { mode: "bridge", walk: true, muscles: ["glute", "hamstring"], durationMs: 4860 }],
  ["3394", { mode: "bridge", march: true, muscles: ["glute", "core"], durationMs: 5130 }],
  ["2112", { mode: "bridge", muscles: ["glute", "hamstring"], durationMs: 4510 }],
  ["3412", { mode: "bridge", squeeze: true, muscles: ["glute"], durationMs: 4990 }],
  ["2863", { mode: "bridge", shoulder: true, viewHeight: 1.86, muscles: ["glute", "core"], durationMs: 5130 }],
  ["4794", { mode: "bridge", jump: true, muscles: ["r:glute"], durationMs: 3370 }],
  ["1944", { mode: "figure", muscles: ["r:glute"], durationMs: 6300 }],
  ["1935", { mode: "figure", muscles: ["r:glute"], durationMs: 6340 }],
  ["2099", { mode: "figure", muscles: ["r:glute"], durationMs: 6380 }],
  ["3567", { mode: "figure", muscles: ["r:glute"], durationMs: 6360 }],
  ["1936", { mode: "figure", down: true, muscles: ["r:glute"], durationMs: 6400 }],
  ["0615", { mode: "crossover", muscles: ["core", "l:glute"], durationMs: 6050 }],
  ["1248", { mode: "wiper", bent: true, muscles: ["core"], durationMs: 4930 }],
  ["1249", { mode: "wiper", viewHeight: 1.78, muscles: ["core"], durationMs: 5120 }],
  ["6705", { mode: "wiper", viewHeight: 1.79, muscles: ["core"], durationMs: 4850 }],
  ["4886", { mode: "vertical", hands: "under", viewHeight: 1.81, muscles: ["core"], durationMs: 4480 }],
  ["3459", { mode: "vertical", pulse: true, viewHeight: 1.81, muscles: ["core"], durationMs: 3180 }],
  ["0723", { mode: "vertical", lateral: true, viewHeight: 1.82, muscles: ["core"], durationMs: 4750 }],
  ["0724", { mode: "vertical", lateral: true, turn: true, viewHeight: 1.82, muscles: ["core"], durationMs: 4810 }],
  ["0138", { mode: "cocoon", muscles: ["core"], durationMs: 4600 }],
  ["0260", { mode: "cocoon", overhead: true, muscles: ["core"], durationMs: 4560 }],
  ["1939", { mode: "tuck", out: true, single: true, muscles: ["l:glute"], durationMs: 6410 }],
  ["3243", { mode: "tuck", muscles: ["glute", "core"], durationMs: 6100 }],
  ["3242", { mode: "tuck", single: true, muscles: ["l:glute"], durationMs: 6180 }],
  ["1808", { mode: "tuck", muscles: ["glute", "core"], durationMs: 6310 }],
  ["1406", { mode: "hamstring", muscles: ["l:hamstring"], durationMs: 6250 }],
  ["1921", { mode: "hamstring", muscles: ["l:hamstring"], durationMs: 6290 }],
  ["4929", { mode: "hamstring", calf: true, muscles: ["l:calf"], durationMs: 6210 }],
  ["1841", { mode: "neck", muscles: ["trap"], durationMs: 6330 }],
  ["3586", { mode: "scissor", hands: "under", muscles: ["core"], durationMs: 3170 }],
  ["2892", { mode: "scissor", cross: true, muscles: ["core", "adductor"], durationMs: 3240 }],
  ["4932", { mode: "eight", muscles: ["core"], durationMs: 5720 }],
  ["10540", { mode: "tibialis", muscles: ["l:calf"], durationMs: 4910 }],
]);

const proneExtended = new Map([
  ["1168", { mode: "press", muscles: ["core"], durationMs: 6320 }],
  ["2878", { mode: "press", muscles: ["core", "triceps"], durationMs: 4780 }],
  ["2869", { mode: "swan", muscles: ["glute", "core"], durationMs: 5350 }],
  ["2851", { mode: "kick", clasp: true, muscles: ["hamstring", "glute"], durationMs: 4460 }],
  ["2855", { mode: "kick", forearm: true, viewHeight: 1.89, muscles: ["hamstring"], durationMs: 5180 }],
  ["11801", { mode: "kick", hold: true, muscles: ["quad"], durationMs: 4870 }],
  ["2857", { mode: "rock", muscles: ["quad", "core"], durationMs: 5000 }],
  ["1484", { mode: "locust", hold: true, muscles: ["glute", "hamstring"], durationMs: 6270 }],
  ["4663", { mode: "raiseBack", muscles: ["trap", "rearShoulder"], durationMs: 4450 }],
  ["6019", { mode: "extend", hold: true, muscles: ["glute", "lat"], durationMs: 6200 }],
  ["4777", { mode: "extend", muscles: ["glute", "hamstring"], durationMs: 4940 }],
  ["2870", { mode: "swim", muscles: ["glute", "shoulder"], durationMs: 4550 }],
  ["6098", { mode: "legCircle", muscles: ["glute"], durationMs: 5700 }],
  ["4091", { mode: "twist", muscles: ["core", "glute"], durationMs: 4980 }],
  ["4372", { mode: "plank", muscles: ["core", "triceps"], durationMs: 6190 }],
  ["4631", { mode: "scorpion", muscles: ["quad", "core"], durationMs: 6120 }],
  ["6294", { mode: "kick", halfFrog: true, hold: true, floorGuide: true, muscles: ["l:quad"], durationMs: 6450 }],
]);

const sideBridge = new Map([
  ["2864", { mode: "bend", muscles: ["core", "shoulder"], durationMs: 5300 }],
  ["0706", { mode: "lift", muscles: ["core", "glute"], durationMs: 6160 }],
  ["0701", { mode: "topBent", palm: true, muscles: ["core", "glute"], durationMs: 6100 }],
  ["0702", { mode: "tuck", muscles: ["core", "r:glute"], durationMs: 4750 }],
  ["0703", { mode: "star", muscles: ["core", "r:glute"], durationMs: 5110 }],
  ["3584", { mode: "swing", muscles: ["core", "r:glute", "r:shoulder"], durationMs: 5410 }],
  ["5047", { mode: "knees", muscles: ["core", "glute"], durationMs: 6100 }],
  ["4458", { mode: "lift", muscles: ["core", "glute"], durationMs: 6260 }],
  ["2875", { mode: "kick", muscles: ["core", "r:glute"], durationMs: 4900 }],
  ["3460", { mode: "adduct", nearLeft: true, muscles: ["core", "l:adductor"], durationMs: 4750 }],
  ["4894", { mode: "stagger", muscles: ["core", "glute"], durationMs: 6090 }],
  ["0820", { mode: "twist", muscles: ["core", "r:shoulder"], durationMs: 5620 }],
]);

const quadrupedExtended = new Map([
  ["1051", { mode: "cat", muscles: ["core"], durationMs: 6290 }],
  ["2106", { mode: "cat", muscles: ["core"], durationMs: 5500 }],
  ["4348", { mode: "abs", muscles: ["core"], durationMs: 6080 }],
  ["0250", { mode: "ceiling", viewHeight: 1.82, muscles: ["core", "pec"], durationMs: 6120 }],
  ["1512", { mode: "quad", side: "right", muscles: ["r:quad"], durationMs: 6500 }],
  ["5897", { mode: "puppy", viewHeight: 1.90, muscles: ["lat", "shoulder"], durationMs: 6480 }],
  ["2571", { mode: "frog", yaw: 32, muscles: ["adductor"], durationMs: 6150 }],
  ["5904", { mode: "needle", muscles: ["l:shoulder", "core"], durationMs: 6430 }],
  ["4556", { mode: "reach", muscles: ["l:shoulder", "core"], durationMs: 5500 }],
  ["6316", { mode: "donkey", cross: true, viewHeight: 1.80, muscles: ["l:glute"], durationMs: 5070 }],
  ["5810", { mode: "donkey", viewHeight: 1.80, muscles: ["l:glute"], durationMs: 4840 }],
  ["0556", { mode: "donkey", viewHeight: 1.80, muscles: ["l:glute"], durationMs: 4820 }],
  ["4916", { mode: "straight", muscles: ["l:glute"], durationMs: 4850 }],
  ["2880", { mode: "swim", viewHeight: 1.75, muscles: ["glute", "shoulder", "core"], durationMs: 5510 }],
  ["1771", { mode: "triceps", muscles: ["triceps"], durationMs: 4950 }],
  ["4722", { mode: "sissy", viewHeight: 1.91, muscles: ["quad"], durationMs: 5060 }],
  ["0942", { mode: "cat", floorGuide: true, muscles: ["core"], durationMs: 6400 }],
  ["8130", { mode: "child", floorGuide: true, viewHeight: 1.91, muscles: ["lat", "shoulder"], durationMs: 6490 }],
  ["6292", { mode: "frog", floorGuide: true, topSource: true, yaw: 33, muscles: ["adductor"], durationMs: 6420 }],
  ["5905", { mode: "tiger", floorGuide: true, viewHeight: 1.83, muscles: ["glute", "core"], durationMs: 5670 }],
]);

const yogaStanding = new Map([
  ["0943", { mode: "chair", deep: true, headroom: true, muscles: ["quad", "glute"], durationMs: 6170 }],
  ["0944", { mode: "chair", headroom: true, muscles: ["quad", "glute"], durationMs: 6180 }],
  ["0947", { mode: "mountain", crescent: true, headroom: true, muscles: ["core", "lat"], durationMs: 6310 }],
  ["6304", { mode: "dancer", mat: true, muscles: ["quad", "shoulder"], durationMs: 6380, yaw: 61 }],
  ["0948", { mode: "neutral", muscles: [], durationMs: 4890 }],
  ["5896", { mode: "mountain", muscles: [], durationMs: 6060 }],
  ["6301", { mode: "eagle", muscles: ["shoulder", "core"], durationMs: 6370 }],
  ["0951", { mode: "garland", mat: true, muscles: ["adductor", "quad"], durationMs: 6200 }],
  ["0952", { mode: "moon", muscles: ["core", "glute"], durationMs: 6430, yaw: -36 }],
  ["6341", { mode: "humble", muscles: ["quad", "shoulder"], durationMs: 6310, yaw: 53 }],
  ["5898", { mode: "pyramid", muscles: ["hamstring"], durationMs: 6230, yaw: 69 }],
  ["5913", { mode: "reverse", headroom: true, muscles: ["quad", "lat"], durationMs: 6240 }],
  ["5903", { mode: "halfBend", muscles: ["hamstring", "core"], durationMs: 6180, yaw: 61 }],
  ["5982", { mode: "halfSalute", headroom: true, muscles: ["hamstring", "shoulder"], durationMs: 6410, yaw: 62 }],
  ["0961", { mode: "tree", mat: true, muscles: ["glute", "core"], durationMs: 6330 }],
  ["0962", { mode: "triangle", muscles: ["hamstring", "core"], durationMs: 6320 }],
  ["5907", { mode: "warrior3", mat: true, headroom: true, muscles: ["core", "glute"], durationMs: 6430, yaw: 63 }],
  ["3471", { mode: "warrior1", headroom: true, muscles: ["quad", "glute"], durationMs: 6400, yaw: 53 }],
  ["0964", { mode: "warrior1", headroom: true, muscles: ["quad", "glute"], durationMs: 6420, yaw: 56 }],
  ["6291", { mode: "warrior2", muscles: ["quad", "adductor"], durationMs: 6420 }],
  ["0963", { mode: "warrior2", muscles: ["quad", "adductor"], durationMs: 6430 }],
]);

const yogaFloor = new Map([
  ["5915", { mode: "staff", single: true, muscles: ["pec", "core", "glute"], durationMs: 5940 }],
  ["6290", { mode: "staff", muscles: ["pec", "triceps", "core"], durationMs: 6070 }],
  ["5888", { mode: "staff", muscles: ["pec", "core"], durationMs: 6100 }],
  ["5914", { mode: "staff", muscles: ["pec", "triceps"], durationMs: 6090 }],
  ["5887", { mode: "down", single: true, viewHeight: 1.96, muscles: ["hamstring", "glute"], durationMs: 6440 }],
  ["3469", { mode: "down", muscles: ["hamstring", "shoulder"], durationMs: 6360 }],
  ["0949", { mode: "down", muscles: ["hamstring", "shoulder"], durationMs: 6380 }],
  ["3527", { mode: "toeTouch", muscles: ["hamstring", "core"], durationMs: 5370 }],
  ["6288", { mode: "dolphin", muscles: ["shoulder", "hamstring"], durationMs: 6430 }],
  ["1366", { mode: "up", muscles: ["core", "shoulder"], durationMs: 6460 }],
  ["5889", { mode: "corpse", muscles: [], durationMs: 6500 }],
  ["0954", { mode: "hero", muscles: ["quad"], durationMs: 6450 }],
  ["5885", { mode: "meditate", lotus: true, muscles: [], durationMs: 6490 }],
  ["5894", { mode: "meditate", muscles: [], durationMs: 6500 }],
  ["5895", { mode: "meditate", lap: true, muscles: [], durationMs: 6500 }],
  ["6300", { mode: "boat", muscles: ["core"], durationMs: 6320 }],
  ["5917", { mode: "happy", muscles: ["glute", "adductor"], durationMs: 6500 }],
  ["0946", { mode: "crane", muscles: ["shoulder", "core"], durationMs: 6250 }],
  ["6293", { mode: "peacock", muscles: ["core", "forearm"], durationMs: 6400 }],
]);

// These tags describe the contact change visible in each keyframe of the exact catalogue source.
const floorTravel = new Map([
  ["1160", { stages: ["stand", "hands", "plank", "plank", "hands", "jump", "stand"], durationMs: 3500 }],
  ["5187", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "jump", "squat", "stand"], travel: true, durationMs: 4300 }],
  ["5337", { stages: ["stand", "hands", "plank", "press", "plank", "l-climb", "r-climb", "l-climb", "r-climb", "plank", "hands", "jump", "stand"], durationMs: 5760 }],
  ["4548", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "stand", "squat", "stand"], durationMs: 4040 }],
  ["5968", { stages: ["stand", "hands", "plank", "hands", "l-twist", "stand", "hands", "plank", "hands", "r-twist"], durationMs: 4810 }],
  ["3457", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "jump", "stand"], durationMs: 3800 }],
  ["3703", { stages: ["tuck", "plank", "tuck", "squat", "stand"], durationMs: 3170 }],
  ["5598", { stages: ["stand", "hands", "hands", "plank", "l-climb", "plank", "r-climb", "plank", "l-climb", "plank", "r-climb", "plank", "hands", "hands"], crawl: true, durationMs: 6500 }],
  ["3698", { stages: ["stand", "hands", "hands", "pike", "plank", "l-stepIn", "pike", "pike", "pike"], crawl: true, walk: true, durationMs: 6210 }],
  ["0501", { stages: ["hands", "plank", "jackFeet", "plank", "hands", "jump", "hands"], durationMs: 3790 }],
  ["7619", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "star"], durationMs: 3730 }],
  ["3970", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "star", "stand"], durationMs: 4100 }],
  ["9048", { stages: ["plank", "l-cross", "plank", "r-cross"], durationMs: 2590 }],
  ["4976", { stages: ["l-climb", "plank", "r-climb", "plank"], durationMs: 2180 }],
  ["0629", { stages: ["plank", "l-lunge", "plank", "r-lunge"], durationMs: 4470 }],
  ["10326", { stages: ["plank", "tuck", "squat", "squat", "tuck"], durationMs: 3880 }],
  ["3153", { stages: ["stand", "hands", "plank", "press", "plank", "hands", "l-kick", "stand", "hands", "plank", "press", "plank", "hands", "r-kick"], durationMs: 6470 }],
  ["5680", { stages: ["plank", "l-outside", "plank", "r-outside"], durationMs: 2510 }],
  ["5039", { stages: ["stand", "hands", "l-stepBack", "plank", "l-stepBack", "hands"], walk: true, durationMs: 4310 }],
  ["7463", { stages: ["plank", "l-outside", "plank", "r-outside"], spider: true, durationMs: 2490 }],
]);

// Several source stretches repeat one image for almost their entire timeline.
// Give the actual source movement enough screen time to show setup, hold and return.
const heldGuideKeys = new Map([
  ...["1777", "1816", "1983", "1980", "1981", "1792", "1488", "1971", "1974", "1782", "1787", "1977", "1978", "1982", "1814", "3396", "0712", "1939", "4929", "1841", "10540", "1484", "4631"].map(id => [id, 1]),
  ["8289", 2],
  ["4601", 2],
  ["4372", 2],
  ["1051", 1],
  ["5897", 1],
  ["4348", 1],
  ["5904", 1],
  ["5892", 4],
]);

const [directory, ...requested] = process.argv.slice(2);
const profiles = new Map([...sagittalFloor, ...standingUpper, ...standingLower, ...seatedFloor, ...wallSupported, ...kneelingFloor, ...upperMobility, ...lateralFloor, ...hipMobility, ...jumpMobility, ...lungeMobility, ...supineExtended, ...proneExtended, ...sideBridge, ...quadrupedExtended, ...yogaStanding, ...yogaFloor, ...floorTravel]);
const selection = requested.length ? requested : [...profiles.keys()];
if (!directory || selection.some(id => !profiles.has(id))) throw new Error("Pass an output directory and optional reviewed guide IDs.");
const output = resolve(directory);
await mkdir(output, { recursive: true, mode: 0o700 });

const items = [];
for (const id of selection) {
  const entry = entries.get(id);
  const { illustration: guide } = catalogueDemo(entry);
  const wall = wallSupported.has(id);
  const yoga = yogaStanding.has(id);
  const floorYoga = yogaFloor.has(id);
  const travel = floorTravel.has(id);
  const profile = profiles.get(id);
  const knownFloor = (yoga || floorYoga || profile.floorGuide) && guide?.props?.every(([,y1,,y2]) => y1 === y2 && y1 >= 151);
  if (!guide?.frames?.length || guide.topView && !profile.topSource || guide.partnerFrames || !wall && !knownFloor && guide.props?.length || guide.formCheckFrom != null) {
    throw new Error(`Guide ${id} must contain a supported single-person trajectory.`);
  }
  const jump = jumpMobility.has(id);
  const lower = standingLower.has(id) || jump;
  const mobility = upperMobility.has(id);
  const standing = standingUpper.has(id) || lower || mobility || yoga;
  const seated = seatedFloor.has(id);
  const kneeling = kneelingFloor.has(id);
  const lateral = lateralFloor.has(id);
  const hip = hipMobility.has(id);
  const lunge = lungeMobility.has(id);
  const supine = supineExtended.has(id);
  const prone = proneExtended.has(id);
  const side = sideBridge.has(id);
  const quadruped = quadrupedExtended.has(id);
  const move = wall ? wallGuideMotion(guide, profile) : mobility ? upperMobilityGuideMotion(guide, profile) : lower ? lowerGuideMotion(guide, profile)
    : yoga ? yogaStandingGuideMotion(guide, profile) : standing ? standingGuideMotion(guide, profile)
    : seated ? seatedGuideMotion(guide, profile) : kneeling ? kneelingGuideMotion(guide, profile) : lateral ? lateralFloorGuideMotion(guide, profile)
    : hip ? hipMobilityGuideMotion(guide, profile) : lunge ? lungeMobilityGuideMotion(guide, profile)
    : supine ? supineExtendedGuideMotion(guide, profile) : prone ? proneExtendedGuideMotion(guide, profile) : side ? sideBridgeGuideMotion(guide, profile)
    : quadruped ? quadrupedExtendedGuideMotion(guide, profile) : floorYoga ? yogaFloorGuideMotion(guide, profile)
    : travel ? floorTravelGuideMotion(guide, profile) : sagittalGuideMotion(guide, profile);
  const filename = `${id}.json`;
  const held = heldGuideKeys.get(id);
  const keyframes = Array.from({ length: 65 }, (_, index) => {
    const at = index / 64;
    const sample = held == null ? at : rep(at, .35, .56) * held / guide.frames.length;
    return { at, ...move(sample) };
  });
  const upperExtent = profile.headroom || jump || travel ? Math.max(...keyframes.flatMap(frame => [frame.head[1] + .113, frame.lw[1] + .126, frame.rw[1] + .126])) : 0;
  const recipe = {
    version: 1, equipment: wall ? profile.tall ? "rig-contact-tall-wall" : "rig-contact-wall" : standing && !profile.mat ? "none" : "mat",
    muscles: profile.muscles ?? (lower ? [profile.forefoot ? "calf" : "quad", "glute"] : travel ? ["core", "quad"] : [standing ? "shoulder" : "core"]),
    durationMs: profile.durationMs ?? 4570,
    camera: wall ? { yaw: 112, elevation: 14, focus: [0, profile.floor ? .70 : profile.tall ? 1.11 : .96, .15], height: profile.tall ? 2.53 : 2.19 }
      : lower ? { yaw: profile.yaw ?? (profile.plane === "side" ? 63 : 34), elevation: 14,
      focus: [0, upperExtent ? (upperExtent + .19) * .51 : 1.06, 0], height: Math.max(2.47, upperExtent + .32) }
      : standing ? { yaw: profile.yaw ?? 26, elevation: 14, focus: [0, upperExtent ? upperExtent * .49 : .97, 0], height: upperExtent ? Math.max(2.27, upperExtent + .32) : 2.27 }
      : seated ? { yaw: profile.plane === "side" ? 54 : 31, elevation: 16, focus: [0, .57, -.18], height: 1.57 }
      : kneeling ? { yaw: profile.tall ? 63 : 58, elevation: 17, focus: [0, profile.tall ? .61 : profile.viewHeight ? .50 : .39, -.10], height: profile.viewHeight ?? (profile.tall ? 1.73 : 1.62) }
      : lateral ? { yaw: -71, elevation: 20, focus: [-.13, .42, .017], height: 1.49 }
      : hip || supine ? { yaw: 61, elevation: 17, focus: [0, profile.viewHeight ? .57 : .45, -.29], height: profile.viewHeight ?? 1.64 }
      : lunge ? { yaw: profile.front === "right" ? -57 : 57, elevation: 14, focus: [0, profile.viewHeight ? .91 : .74, -.10], height: profile.viewHeight ?? 1.94 }
      : prone ? { yaw: 56, elevation: 18, focus: [0, .48, -.21], height: profile.viewHeight ?? 1.79 }
      : side ? { yaw: profile.palm || profile.mode === "bend" || profile.mode === "kick" ? -73 : -46,
        elevation: 18, focus: [-.095, .61, -.24], height: 1.68 }
      : quadruped ? { yaw: profile.yaw ?? 61, elevation: 18, focus: [0, profile.viewHeight ? .52 : .44, -.095], height: profile.viewHeight ?? 1.67 }
      : floorYoga ? { yaw: ["meditate", "hero"].includes(profile.mode) ? 28 : 65, elevation: 17, focus: [0, profile.viewHeight ? .67 : .56, -.19], height: profile.viewHeight ?? 1.72 }
      : travel ? { yaw: 64, elevation: 16, focus: [0, (upperExtent + .05) * .47, -.15], height: Math.max(1.66, upperExtent + .33) }
      : { yaw: 63, elevation: 18, focus: [0, .43, -.31], height: profile.viewHeight ?? 1.75 },
    keyframes,
  };
  try {
    prepareRecipe(recipe);
  } catch (error) {
    throw new Error(id + ": " + error.message, { cause: error });
  }
  await writeFile(join(output, filename), JSON.stringify(recipe) + "\n");
  items.push({ id, recipe: filename, posterAt: profile.posterAt ?? .43 });
}
await writeFile(join(output, "batch.json"), JSON.stringify({ kind: "catalogue", items }) + "\n");
console.log("Prepared", items.length, "guide-linked original Spotter bodyweight demonstrations.");
