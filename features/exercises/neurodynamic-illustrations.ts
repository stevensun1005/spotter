import type { Illustration, Point } from "./motion-data";

const move = (pose: Point[], joints: Partial<Record<number, Point>>): Point[] => pose.map((point,index)=>joints[index]??point);
const chair: NonNullable<Illustration["props"]> = [[112,112,166,112],[120,113,120,157],[156,113,156,157],[115,76,115,111]];
const sitting: Point[] = [[135,54],[140,75],[139,108],[154,93],[156,111],[126,94],[131,112],
  [170,112],[171,154],[163,118],[163,154],[168,155]];

function sciaticSlider(): Illustration {
  const rested = move(sitting,{0:[151,59],1:[142,76],7:[167,110],8:[199,112],11:[215,115]});
  const extended = move(rested,{0:[133,50],1:[140,73],11:[201,98]});
  return {frames:[rested,extended,extended,rested],props:chair,dynamic:[["foot-tip",8,11],["foot",10,172,155]],ms:1150,reference:true};
}

function armSlider(kind: "median" | "radial" | "ulnar"): Illustration {
  const front = move(sitting,{0:[149,52],1:[149,73],2:[149,111],5:[133,94],6:[133,114],
    7:[168,117],8:[168,155],9:[132,117],10:[132,155],11:[172,79]});
  if (kind === "median") {
    const bent = move(front,{0:[151,54],3:[175,73],4:[201,70],11:[218,71]});
    const long = move(front,{0:[141,53],3:[177,73],4:[200,73],11:[207,56]});
    return {frames:[bent,long,long,bent],props:chair,dynamic:[["palm-up",4,11]],ms:1170,reference:true};
  }
  if (kind === "radial") {
    const down = move(front,{0:[144,55],3:[173,91],4:[156,88],11:[151,96]});
    const reach = move(front,{0:[140,56],3:[178,94],4:[197,112],11:[192,127]});
    return {frames:[down,reach,reach,down],props:chair,dynamic:[["palm-down",4,11]],ms:1170,reference:true};
  }
  const mask = move(front,{0:[153,52],3:[183,56],4:[166,44],11:[156,50]});
  const open = move(front,{0:[141,55],3:[178,82],4:[184,64],11:[177,57]});
  return {frames:[mask,open,open,mask],props:chair,dynamic:[["palm-up",4,11]],ms:1170,reference:true};
}

export const neurodynamicIllustrations: Record<string, Illustration> = {
  "11652": sciaticSlider(), "11787": armSlider("median"), "11786": armSlider("radial"), "11788": armSlider("ulnar"),
};
