import type { Illustration, Point } from "./motion-data";

type Attachments = NonNullable<Illustration["dynamic"]>;
type Props = NonNullable<Illustration["props"]>;
type Arms = [Point, Point, Point, Point];
const stance: Point[] = [[151, 42], [151, 61], [151, 105], [166, 84], [166, 109], [136, 84], [136, 109],
  [163, 131], [166, 156], [140, 132], [135, 156]];
const narrow = (x: number, y: number, span: number, bend = 0): Arms => [
  [151 + x * .35 + span * .40, y + bend], [151 + x + span, y],
  [151 + x * .35 - span * .40, y + bend], [151 + x - span, y],
];
const at = (arms: Arms, lower = stance): Point[] => [lower[0], lower[1], lower[2], ...arms, ...lower.slice(7)];
const fixed = (x: number, y: number): Props => [[x, 19, x, 156], [x - 11, 157, x + 13, 157], [x - 4, y, x + 4, y]];
const band: Attachments = [["band", 4, 6]];
const clip = (frames: Point[][], dynamic: Attachments = [], props: Props = [], ms = 755): Illustration =>
  ({ frames, dynamic, props, ms, reference: true });

function pullApart(kind: "plain" | "high" | "overhand" | "underhand"): Illustration {
  const high = kind === "high", lower = kind === "underhand";
  const low: Arms = high ? [[168,51],[171,29],[134,51],[132,29]]
    : lower ? [[163,92],[161,79],[139,92],[141,79]] : [[169,69],[183,66],[147,67],[163,66]];
  const open: Arms = high ? [[177,48],[201,27],[125,48],[102,27]]
    : lower ? [[163,92],[187,81],[139,92],[115,81]] : [[179,65],[208,64],[124,65],[95,64]];
  const frames = [at(low), at(open), at(open)].map(p =>
    [...p, [p[4][0] + 7, p[4][1] - 2] as Point, [p[6][0] - 7, p[6][1] - 2] as Point]);
  const grip: Attachments = kind === "underhand" ? [["palm-up", 4, 11], ["palm-up", 6, 12]]
    : kind === "overhand" ? [["pad", 4, 0, 1], ["pad", 6, 0, 1]] : [];
  return clip(frames, [...band, ...grip]);
}

function raiseBand(kind: "overhead" | "through"): Illustration {
  const chest = at(narrow(10, 69, 24, 14));
  const up = at(narrow(0, 18, 35, 20));
  if (kind === "overhead") return clip([chest, up, up], [["band", 4, 8], ["band", 6, 10], ["band", 8, 10]]);
  const knees = at(narrow(10, 111, 37, -24));
  const front = at(narrow(20, 60, 38, 6));
  const back = at(narrow(-28, 61, 40, 3));
  const behind = at(narrow(-21, 113, 40, -26));
  return clip([knees, front, up, back, behind, back, up, front], band, [], 720);
}

function anchoredWarmup(kind: "down" | "back" | "front"): Illustration {
  if (kind === "front") {
    const ready = at([[171,63],[187,62],[157,62],[176,62]]);
    const close = at([[177,76],[160,68],[124,74],[142,67]]);
    return clip([ready,close,close],band);
  }
  const ready = at(kind === "down" ? [[168,80],[170,102],[137,82],[139,102]]
    : [[158,85],[163,111],[143,85],[141,111]]);
  const finish = at(kind === "down" ? [[171,86],[178,114],[134,87],[128,114]]
    : [[144,85],[134,107],[135,83],[124,105]]);
  const resistance: Attachments = kind === "down" ? [["band", 4, 6], ["band", 8, 10]]
    : [["band", 4, 8], ["band", 6, 10], ["band", 8, 10]];
  return clip([ready,finish,finish],resistance);
}

function bandStrike(kind: "punch" | "lateral"): Illustration {
  const post = 64, pulley = 68;
  const feet = stance.map((p, i): Point => i === 8 ? [193,156] : i === 10 ? [118,154] : i === 7 ? [173,130] : i === 9 ? [136,132] : p);
  const ready = at([[153,85],[171,61],[138,83],[158,63]], feet);
  const forward = at([[181,65],[209,64],[138,83],[158,63]], feet);
  const other = at([[153,85],[171,61],[174,61],[199,60]], feet);
  const side = at(narrow(44,63,4,8), feet);
  const frames = kind === "punch" ? [ready,forward,ready,other] : [ready,side,ready];
  const grips: Attachments = [["band",4,post,pulley],["band",6,post,pulley],["pad",4,0,0],["pad",6,0,0]];
  return clip(frames,grips,fixed(post,pulley), kind === "punch" ? 555 : 650);
}

function bodyWarmup(kind: "arm-circles" | "overhead-clap" | "phelps" | "wring"): Illustration {
  const armsAtSide: Arms = [[169,61],[198,61],[133,61],[105,61]];
  if (kind === "overhead-clap") return clip([stance,at(armsAtSide),at([[162,33],[151,15],[140,33],[151,15]]),at(armsAtSide)],[],[],710);
  if (kind === "phelps") {
    const open = at(armsAtSide);
    const cross = (above: number) => at([[168,62 + above],[121,61 + above],[135,63 - above],[183,62 - above]]);
    return clip([open,cross(-6),open,cross(6)],[],[],740);
  }
  if (kind === "wring") {
    const ready = at(narrow(0,91,3,-7));
    const right = at([[174,83],[188,85],[168,90],[188,89]]);
    const left = at([[138,90],[113,89],[131,83],[114,83]]);
    right[0] = [161,43]; right[1] = [156,62];
    left[0] = [141,43]; left[1] = [145,62];
    return clip([ready,right,ready,left],[],[],750);
  }
  const circle = (radius: number, direction: number) => [0,1,2,3].map(phase => {
    const t = phase * Math.PI / 2 * direction;
    const radiusX = radius * .55 * Math.cos(t), radiusY = radius * Math.sin(t);
    return at([[175 + radiusX * .4, 60 + radiusY * .5],[199 + radiusX, 60 + radiusY],
      [127 - radiusX * .4, 60 + radiusY * .5],[103 - radiusX, 60 + radiusY]]);
  });
  return clip([...circle(7,1),...circle(21,1),...circle(21,-1),...circle(7,-1)],[],[],435);
}

export const elasticWarmupIllustrations: Record<string, Illustration> = {
  "8365": raiseBand("through"), "4568": pullApart("plain"), "5317": pullApart("high"),
  "4412": pullApart("overhand"), "2930": pullApart("underhand"), "4027": anchoredWarmup("back"),
  "4025": anchoredWarmup("down"), "4026": anchoredWarmup("front"), "4024": raiseBand("overhead"),
  "3798": bandStrike("punch"), "10594": bandStrike("lateral"),
  "3409": bodyWarmup("phelps"), "3410": bodyWarmup("wring"), "3996": bodyWarmup("arm-circles"),
  "4665": bodyWarmup("overhead-clap"),
};
