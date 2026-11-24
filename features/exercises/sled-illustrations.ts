import type { Illustration, Point } from "./motion-data";

type Equipment = NonNullable<Illustration["dynamic"]>;
type Body = [Point, Point, Point];
type Limb = [Point, Point];
type Legs = [Limb, Limb];

const feet: Equipment = [["foot-tip", 8, 11], ["foot-tip", 10, 12]];
const shortStride: Legs = [[[127, 131], [149, 152]], [[105, 128], [89, 151]]];
const stridePassed: Legs = [[[121, 130], [120, 144]], [[130, 132], [134, 154]]];
const readyFeet: Legs = [[[130, 129], [132, 154]], [[110, 130], [107, 154]]];
const lunge: Legs = [[[144, 120], [145, 154]], [[80, 152], [54, 146]]];

function person(body: Body, arms: [Limb, Limb], legs: Legs): Point[] {
  return [...body, ...arms[0], ...arms[1], ...legs[0], ...legs[1],
    [legs[0][1][0] + 13, Math.min(158, legs[0][1][1] + 5)],
    [legs[1][1][0] + 12, Math.min(158, legs[1][1][1] + 5)]];
}

function cart(frame: Point[], x: number, tank = false): Point[] {
  return [...frame, [x, 149], [x + 50, 149], [x + 5, 96], [x + 42, 96],
    [x + 25, 139], [x + 53, 151], [x + 17, 155], [x + 42, 155],
    [x + 16, tank ? 139 : 144], [x + 29, tank ? 139 : 144]];
}

function sled(frames: Point[][], load: "poles" | "tow" | "tank", extra: Equipment = [], ms = 650): Illustration {
  const fittings: Equipment = [["bar", 13, 14]];
  if (load === "tank") fittings.push(["bar", 15, 13], ["bar", 16, 14], ["wheel", 19, 0, -5], ["wheel", 20, 0, -5],
    ["bar", 21, 22]);
  else {
    fittings.push(["line", 13, 15], ["line", 13, 19], ["line", 14, 20], ["plate", 17, 0, 0]);
    if (load === "poles") fittings.push(["line", 14, 16]);
  }
  return { frames, dynamic: [...feet, ...fittings, ...extra], ms, reference: true };
}

// The wheeled TANK is distinct from a plate-loaded friction sled.
// https://www.torquefitness.com/pages/tank-faq
function pushing(tank = false, burpee = false): Illustration {
  const deck = 200;
  const arms: [Limb, Limb] = [[[177, 89], [205, 96]], [[174, 92], [202, 98]]];
  const body: Body = [[163, 68], [153, 85], [111, 106]];
  const make = (legs: Legs): Point[] => cart(person(body, arms, legs), deck, tank);
  const running = [make(shortStride), make(stridePassed), make([shortStride[1], shortStride[0]]), make([stridePassed[1], stridePassed[0]])];
  if (!burpee) return sled(running, tank ? "tank" : "poles");
  const low = cart(person([[170, 136], [154, 138], [103, 140]],
    [[[165, 143], [154, 155]], [[156, 145], [148, 155]]],
    [[[75, 143], [52, 153]], [[71, 147], [49, 153]]]), deck);
  const stood = cart(person([[123, 48], [123, 66], [116, 105]],
    [[[137, 88], [140, 117]], [[107, 89], [103, 116]]], readyFeet), deck);
  const crouch = cart(person([[143, 101], [132, 110], [101, 128]],
    [[[144, 135], [148, 155]], [[139, 135], [140, 155]]],
    [[[135, 125], [128, 154]], [[115, 129], [108, 154]]]), deck);
  const jump = cart(person([[122, 31], [119, 48], [116, 92]],
    [[[131, 27], [132, 12]], [[108, 30], [104, 11]]],
    [[[129, 121], [129, 142]], [[108, 125], [106, 143]]]), deck);
  return sled([stood, crouch, low, crouch, jump, stood, ...running], "poles", [], 540);
}

function drag(forward: boolean, handOverHand = false, sideLoad = false) {
  const shoulder: Point = forward ? [167, 75] : [120, 73];
  const body: Body = sideLoad ? [[157, 54], [156, 74], [153, 115]] : [forward ? [176, 56] : [112, 52], shoulder, forward ? [153, 115] : [126, 116]];
  const relaxed: [Limb, Limb] = forward ? [[[186, 101], [194, 82]], [[143, 96], [130, 107]]]
    : [[[148, 97], [181, 101]], [[141, 102], [172, 107]]];
  const phases: Legs[] = [shortStride, stridePassed, [shortStride[1], shortStride[0]], [stridePassed[1], stridePassed[0]]];
  const frames = phases.map((legs, index): Point[] => {
    const stride = forward ? legs.map((leg) => leg.map(([x, y]): Point => [x + 36, y])) as Legs : legs;
    const arms: [Limb, Limb] = handOverHand ?
      (index % 2 ? [[[131, 99], [138, 97]], [[149, 100], [179, 105]]] : [[[149, 96], [182, 104]], [[127, 102], [137, 104]]]) :
      sideLoad ? [[[179, 90], [200, 83]], [[170, 93], [194, 86]]] : relaxed;
    return cart(person(body, arms, stride), forward ? 52 : handOverHand ? 212 - 5 * index : 220);
  });
  return sled(frames, "tow", [["line", forward && !sideLoad ? 2 : 4, forward ? 18 : 13],
    ...handOverHand || sideLoad ? [["line", 6, sideLoad ? 18 : 13] as Equipment[number]] : []]);
}

function loadedPull(mode: "curl" | "high-pull" | "row" | "rear-lunge" | "lunge-row") {
  const starts: Body = mode === "high-pull" || mode === "row" ? [[137, 65], [124, 80], [101, 108]]
    : [[120, 48], [122, 67], [117, 110]];
  const low: [Limb, Limb] = mode === "curl" || mode === "high-pull" ?
    [[[130, 90], [149, 110]], [[120, 91], [144, 111]]] : [[[145, 88], [171, 96]], [[137, 93], [162, 97]]];
  const bent: [Limb, Limb] = mode === "curl" ? [[[130, 90], [139, 65]], [[120, 91], [127, 66]]]
    : mode === "high-pull" ? [[[150, 66], [155, 85]], [[141, 65], [148, 84]]]
    : [[[104, 91], [128, 93]], [[95, 96], [122, 97]]];
  const standing: Body = mode === "high-pull" ? [[128, 42], [128, 61], [117, 107]] : starts;
  const init = cart(person(starts, low, readyFeet), 217);
  const end = cart(person(standing, bent, readyFeet), 199);
  if (mode === "rear-lunge" || mode === "lunge-row") {
    const body: Body = [[111, 68], [113, 87], [106, 125]];
    const arms: [Limb, Limb] = [[[151, 93], [171, 96]], [[142, 98], [163, 98]]];
    const deeper = cart(person(body, arms, lunge), 217);
    const opposite = cart(person(body, arms, [lunge[1], lunge[0]]), 217);
    return sled(mode === "lunge-row" ? [init, deeper, end, init, opposite, end] : [init, deeper, init, opposite],
      "tow", [["line", 4, 13], ["line", 6, 13]], 800);
  }
  return sled([init, end], "tow", [["line", 4, 13], ["line", 6, 13]], 860);
}

function sledRearArms(batwing: boolean): Illustration {
  const body: Body = batwing ? [[177, 63], [183, 80], [193, 110]] : [[180, 47], [179, 67], [181, 112]];
  const legs: Legs = batwing ? [[[178, 128], [173, 154]], [[202, 130], [217, 151]]]
    : [[[190, 132], [191, 155]], [[172, 134], [167, 155]]];
  const initial: [Limb, Limb] = batwing ? [[[171, 101], [151, 106]], [[174, 98], [156, 103]]]
    : [[[155, 87], [132, 102]], [[168, 91], [151, 105]]];
  const finish: [Limb, Limb] = batwing ? [[[206, 87], [187, 99]], [[184, 88], [166, 100]]]
    : [[[148, 67], [115, 68]], [[210, 67], [241, 66]]];
  const extended = cart(person(body, finish, legs), 83);
  return sled([cart(person(body, initial, legs), 53), extended, extended], "tow",
    [["line", 4, 14], ["line", 6, 13]], 980);
}

function sledBackwardPush(): Illustration {
  const body: Body = [[178, 53], [173, 72], [162, 116]];
  const arms: [Limb, Limb] = [[[157, 97], [145, 123]], [[149, 99], [137, 125]]];
  const steps: Legs[] = [
    [[[197, 114], [219, 152]], [[182, 122], [191, 153]]],
    [[[193, 122], [194, 152]], [[183, 116], [214, 150]]],
    [[[189, 121], [191, 151]], [[192, 112], [225, 150]]],
    [[[181, 118], [182, 152]], [[204, 122], [208, 153]]],
  ];
  const frames = steps.map((legs): Point[] => [...cart(person(body, arms, legs), 88), [140, 125], [128, 127]]);
  return sled(frames, "tow", [["bar", 14, 23], ["bar", 13, 24], ["bar", 24, 23], ["line", 4, 23], ["line", 6, 24]], 650);
}

function sledTriceps(): Illustration {
  const body: Body = [[145, 67], [152, 82], [180, 114]];
  const legs: Legs = [[[153, 126], [155, 154]], [[193, 128], [213, 150]]];
  const flexed: [Limb, Limb] = [[[132, 59], [153, 61]], [[139, 57], [155, 57]]];
  const straight: [Limb, Limb] = [[[132, 59], [112, 36]], [[139, 57], [121, 34]]];
  const extended = cart(person(body, straight, legs), 218);
  return sled([cart(person(body, flexed, legs), 232), extended, extended], "tow",
    [["line", 4, 13], ["line", 6, 14]], 1020);
}

const rearLunge = loadedPull("rear-lunge");
export const sledIllustrations: Record<string, Illustration> = {
  "10193": pushing(false, true),
  "4428": pushing(),
  "8702": pushing(true),
  "5143": drag(true),
  "5193": drag(false),
  "9939": drag(false, true),
  "2908": drag(true, false, true),
  "2901": loadedPull("curl"),
  "2909": loadedPull("high-pull"),
  "2563": loadedPull("row"),
  "2830": rearLunge,
  "2903": rearLunge,
  "2902": loadedPull("lunge-row"),
  "2904": sledRearArms(true),
  "2905": sledRearArms(false),
  "2907": sledBackwardPush(),
  "4119": sledTriceps(),
};
