import type { Illustration, Point } from "./motion-data";

type Phase = "rest" | "reach" | "start-drop" | "settle";

function snapDownSquat(): Illustration {
  function frame(phase: Phase): Point[] {
    const depth=phase==="settle"?1:phase==="start-drop"?.35:0;
    const reach=phase==="reach" || phase==="start-drop";
    const hip:Point=[151-12*depth,phase==="reach"?92:95+34*depth];
    const shoulder:Point=[156,hip[1]-43+4*depth];
    const nearArm:[Point,Point]=reach?[[154,shoulder[1]-16],[155,shoulder[1]-37]]
      :phase==="settle"?[[162,shoulder[1]+24],[172,shoulder[1]+10]]
      :[[153,shoulder[1]+20],[152,shoulder[1]+41]];
    const farArm:[Point,Point]=reach?[[167,shoulder[1]-17],[168,shoulder[1]-37]]
      :phase==="settle"?[[170,shoulder[1]+20],[181,shoulder[1]+7]]
      :[[163,shoulder[1]+20],[163,shoulder[1]+40]];
    const nearAnkle:Point=[148,phase==="reach"?149:153];
    const farAnkle:Point=[166,phase==="reach"?146:150];
    return [
      [161,shoulder[1]-16],shoulder,hip,...nearArm,...farArm,
      [149+10*depth,124+5*depth],nearAnkle,[165+11*depth,120+6*depth],farAnkle,
      [157,155],[175,153],
    ];
  }
  const sequence:Phase[]=["rest","reach","reach","start-drop","settle","settle","rest"];
  return {
    frames:sequence.map(frame),dynamic:[["foot-tip",8,11],["foot-tip",10,12]],ms:770,reference:true,
  };
}

function floorBandKneeFlexion(): Illustration {
  function frame(tension: number): Point[] {
    const ankle:Point=[112+3*tension,150];
    const grip:Point=[134-2*tension,143];
    return [
      [172,75],[174,92],[162,146],
      [169,128],grip,[163,128],[grip[0]-5,grip[1]+1],
      [126,113],ankle,[111,145],[74,148],[103+3*tension,154],[67,139],
      [ankle[0]+5,ankle[1]-10],
    ];
  }
  return {
    frames:[0,.5,1,1,.5,0].map(frame),
    dynamic:[["foot-tip",8,11],["foot-tip",10,12],["band",4,13],["band",6,13],["pad",13,0,0]],
    ms:1050,
    reference:true,
  };
}

export const floorKneeControlIllustrations: Readonly<Record<string, Illustration>> = {
  "10591": floorBandKneeFlexion(),
  "11784": snapDownSquat(),
};
