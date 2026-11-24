import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
const edit = (frame: Point[], joints: Partial<Record<number, Point>>) => frame.map((point, i) => joints[i] ?? point);
const standing: Point[] = [[140,43],[140,62],[137,106],[153,84],[173,89],[137,85],[160,91],
  [151,130],[160,156],[126,130],[121,156]];
const plank: Point[] = [[187,102],[172,112],[127,127],[175,133],[177,155],[163,133],[162,155],
  [94,144],[63,155],[86,139],[56,152]];
const draw = (frames: Point[][], props: Props = [], dynamic: Attachments = [], ms = 780): Illustration =>
  ({ frames, props, dynamic, ms, reference: true });

function passWeight(gear: "dumbbell" | "kettlebell") {
  const right: Point = [202,150], left: Point = [145,147], between: Point = [173,150];
  const from = (frame: Point[], where: Point) => [...frame, where];
  const pullLeft = edit(plank, { 5: [159,132], 6: between });
  const pullRight = edit(plank, { 3: [182,135], 4: between });
  return draw([from(plank,right),from(edit(plank,{5:[181,135],6:right}),right),from(pullLeft,between),
    from(edit(plank,{5:[152,128],6:left}),left),from(plank,left),from(edit(plank,{3:[156,133],4:left}),left),
    from(pullRight,between),from(edit(plank,{3:[192,137],4:right}),right),from(plank,right)],[],[[gear,11,0,2]],680);
}

function spiderCrawl() {
  const travel = (p: Point[], dx: number) => p.map(([x,y]): Point => [x + dx, y]);
  const near = edit(plank,{3:[184,130],4:[191,155],7:[159,137],8:[139,154]});
  const far = edit(plank,{5:[173,128],6:[191,154],9:[150,133],10:[135,151]});
  return { ...draw([travel(plank,-33),travel(near,-26),travel(plank,-9),travel(far,6),travel(plank,21),
    travel(near,32),travel(plank,43)],[],[["knee-band",7,9]],575),cutOnLoop:true };
}

function battleRopes(mode: "side" | "squat" | "reverse" | "pull") {
  const props: Props = [[244,157,278,157],[258,139,258,157],[252,143,264,143],[250,148,266,148]];
  const attachments: Attachments = [["line",4,11],["line",6,17]];
  for (const i of [11,12,13,14,15,17,18,19,20,21]) attachments.push(["line",i,i+1]);
  const at = (shape: number, action: number, wave: number) => {
    const base = mode === "squat" ? edit(standing,{0:[148,67],1:[145,85],2:[132,123],7:[163,130],9:[123,135]})
      : mode === "side" && shape ? edit(standing, {0:[140+shape*23,60],1:[140+shape*19,80],2:[135+shape*21,116],
        7:[shape===1 ? 179 : 154,129],8:[186,156],9:[shape===-1 ? 102 : 120,129],10:[96,156]})
        : mode === "reverse" && shape ? edit(standing,{0:[145,65],1:[144,84],2:[141,123],
          7:[169,121],8:[171,156],9:[112,147],10:[93,150]}) : standing;
    const trunk = mode === "reverse" && shape < 0 ? edit(base,{7:base[9],8:base[10],9:base[7],10:base[8]}) : base;
    const [x,y] = trunk[1];
    const pull = mode === "pull";
    const stance = pull ? edit(trunk,{7:[155,129],8:[167,155],9:[117,127],10:[99,155]}) : trunk;
    const frame = edit(stance, {3:[x+20,y+19-action*7],4:[x+(pull ? 33+action*16 : 40),y+29-action*19],
      5:[x+11,y+17+action*6],6:[x+(pull ? 30-action*17 : 30),y+26+action*19]});
    const coordinates = [...frame];
    for (const [arm,index] of [[4,0],[6,1]]) {
      const [handX,handY] = frame[arm], tipX = 255 + index*7, tipY = 144 + index*5;
      for (let p=1;p<=6;p++) {
        const t=p/6, crest=pull ? 0 : Math.sin(t*12-wave+index*Math.PI) * Math.sin(t*Math.PI) * 12;
        coordinates.push([handX+(tipX-handX)*t, handY+(tipY-handY)*t+crest]);
      }
    }
    return coordinates;
  };
  const motion = mode === "side" || mode === "reverse" ? [0,1,1,0,-1,-1,0,0] : [0,0,0,0];
  return draw(motion.map((shape,index) => at(shape,index%2 ? 1 : -1,index*1.65)),props,attachments,mode === "pull" ? 610 : 455);
}

function platePush() {
  const brace = edit(standing,{0:[148,51],1:[143,69],2:[135,113],3:[144,96],4:[165,80],5:[139,94],6:[158,78],
    7:[155,129],9:[130,130]});
  const push = edit(brace,{3:[171,71],4:[199,71],5:[165,70],6:[193,69]});
  return draw([brace,push,push,brace].map(p => [...p, [(p[4][0]+p[6][0])/2,(p[4][1]+p[6][1])/2]]),[],[["plate",11,0,0]],515);
}

function stepDrive() {
  const ready = edit(standing,{0:[147,61],1:[142,78],2:[128,117],3:[151,101],4:[168,102],5:[126,95],6:[118,113],
    7:[169,120],8:[171,137],9:[122,139],10:[104,155]});
  const drive = edit(ready,{0:[147,36],1:[143,54],2:[138,96],3:[157,74],4:[176,60],5:[130,76],6:[113,92],
    7:[158,112],8:[163,133],9:[161,86],10:[165,108]});
  const air = edit(drive,{0:[148,29],1:[143,46],2:[138,87],7:[159,101],8:[164,123],9:[166,77],10:[166,103]});
  const descent = edit(ready,{0:[149,49],1:[147,67],2:[136,108],7:[169,122],9:[160,100],10:[164,124]});
  const frames = [ready,drive,air,descent,ready].map((p): Point[] => [...p,[p[8][0]+12,p[8][1]+5]]);
  return draw(frames,[[158,143,216,143],[158,143,158,156],[216,143,216,156],[158,156,216,156]],
    [["foot-tip",8,11]],570);
}

function shuttleFeet() {
  const stance = (x: number, wide: boolean, moved: number): Point[] => {
    const spread = wide ? 28 : 13;
    return [[x,59],[x,76],[x,115],[x+14,99],[x+18,120],[x-14,99],[x-18,120],
      [x+spread*.7,132],[x+spread,156-(moved === 1 ? 8 : 0)],
      [x-spread*.7,132],[x-spread,156-(moved === -1 ? 8 : 0)]];
  };
  const frames = [stance(133,false,0),stance(141,true,1),stance(151,true,0),stance(163,false,-1),stance(174,false,0),
    stance(163,true,-1),stance(151,true,0),stance(140,false,1)];
  return draw(frames,[],[["band",4,8],["band",6,10],["band",8,10],["pad",4,0,0],["pad",6,0,0]],490);
}

export const alternatingConditioningIllustrations: Record<string, Illustration> = {
  "5497": passWeight("dumbbell"), "7229": passWeight("kettlebell"), "2943": spiderCrawl(),
  "8703": battleRopes("pull"), "3372": battleRopes("side"), "3369": battleRopes("squat"), "2933": battleRopes("reverse"),
  "7882": platePush(),
  "1591": stepDrive(), "4241": shuttleFeet(),
};
