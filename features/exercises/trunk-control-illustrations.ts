import type { Illustration, Point } from "./motion-data";

const change = (pose: Point[], joints: Partial<Record<number, Point>>) => pose.map((point, index) => joints[index] ?? point);
const upright: Point[] = [[150,41],[149,60],[149,103],[163,82],[157,106],[134,84],[140,107],
  [163,128],[167,155],[139,128],[137,156],[149,87]];

function lumbarMotion(mode: "extend" | "flex" | "cycle"): Illustration {
  const extended = change(upright,{0:[139,40],1:[139,59],3:[153,83],5:[127,82],11:[145,82]});
  const flexed = change(upright,{0:[175,68],1:[166,76],2:[149,109],3:[164,93],5:[148,95],11:[155,91]});
  const frames = mode === "extend" ? [upright,extended,extended] : mode === "flex" ? [upright,flexed,flexed]
    : [upright,extended,upright,flexed,upright];
  return { frames, spine:[11], ms:1000, reference:true };
}

function wideHingeTwist(): Illustration {
  const bent: Point[] = [[166,87],[152,92],[143,109],[176,87],[203,84],[126,90],[100,87],
    [168,130],[182,155],[116,130],[104,155]];
  const towardLeft = change(bent,{0:[147,84],1:[146,99],3:[130,119],4:[111,153],5:[165,79],6:[185,59]});
  const towardRight = change(bent,{0:[157,84],1:[153,100],3:[137,78],4:[118,60],5:[167,121],6:[176,152]});
  return { frames:[bent,towardLeft,towardLeft,bent,towardRight,towardRight],ms:820,reference:true };
}

function seatedInOut(): Illustration {
  const start: Point[] = [[120,91],[128,108],[150,152],[116,131],[104,154],[108,130],[95,154],
    [164,121],[188,134],[155,119],[179,129]];
  const front = change(start,{7:[187,135],8:[225,127],9:[180,132],10:[217,122]});
  const right = change(start,{7:[185,141],8:[211,148],9:[179,135],10:[206,141]});
  const left = change(start,{7:[175,111],8:[201,100],9:[169,105],10:[193,95]});
  return { frames:[start,right,start,front,start,left,start,front],ms:860,reference:true };
}

function suspensionTwist(): Illustration {
  const start: Point[] = [[140,50],[146,67],[161,105],[171,64],[196,51],[165,71],[189,60],
    [171,129],[181,154],[159,130],[171,155]];
  const near = change(start,{0:[150,52],1:[150,70],3:[182,71],5:[177,74]});
  const far = change(start,{0:[129,50],1:[141,66],3:[162,52],5:[156,60]});
  const grip = (pose: Point[], angle: number) => change(pose,{
    4:[234-51*Math.sin(angle),17+51*Math.cos(angle)], 6:[225-56*Math.sin(angle-.12),17+56*Math.cos(angle-.12)]});
  const centered = grip(start,.82);
  return {frames:[centered,grip(near,.42),centered,grip(far,1.18)],props:[[218,17,261,17],[253,17,253,157],[242,157,266,157]],
    dynamic:[["line",4,234,17],["line",6,225,17],["pad",4,0,0],["pad",6,0,0]],ms:940,reference:true};
}

function supportedStickBrace(): Illustration {
  const rest: Point[] = [[135,72],[136,89],[134,124],[154,111],[174,101],[145,115],[156,117],
    [175,120],[175,155],[127,153],[101,156]];
  const pressed = change(rest,{3:[153,108],4:[174,99],5:[145,112],6:[155,115]});
  const partner: Point[] = [[239,40],[237,59],[239,104],[220,72],[208,75],[229,79],[213,72],
    [252,129],[258,157],[228,130],[225,155]];
  const frames = [rest,...Array<Point[]>(12).fill(pressed),rest].map(p => [...p,[146,124] as Point,[212,74] as Point]);
  return {frames,partnerFrames:frames.map(() => partner),dynamic:[["bar",11,12]],ms:1020,reference:true};
}

export const trunkControlIllustrations: Record<string, Illustration> = {
  "2785": lumbarMotion("extend"), "2786": lumbarMotion("flex"), "3855": lumbarMotion("cycle"),
  "3391": wideHingeTwist(), "6803": seatedInOut(), "1105": suspensionTwist(), "5399": supportedStickBrace(),
};
