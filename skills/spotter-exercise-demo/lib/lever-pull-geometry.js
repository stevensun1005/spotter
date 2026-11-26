export const leverPulls = Object.freeze({
  'lever-front-pull': {pivotY:1.47, pivotZ:.82, width:.295, radius:.687, arc:.194, close:-.40, overhead:true, restraint:true},
  'lever-reverse-pull': {pivotY:1.44, pivotZ:.82, width:.225, radius:.672, arc:.22, close:-.32, overhead:true, restraint:true, under:true},
  'lever-wide-pull': {pivotY:1.43, pivotZ:.88, width:.285, radius:.704, arc:.25, close:-.56, overhead:true, chest:true, diagonal:true},
  'lever-high-row': {pivotY:1.17, pivotZ:.91, width:.305, radius:.684, arc:.52, close:-.38, overhead:true, chest:true, platform:true},
  'lever-one-arm-high-row': {pivotY:1.155, pivotZ:.90, width:.269, radius:.676, arc:.48, close:-.39, overhead:true},
  'lever-close-row': {pivotY:.377, pivotZ:.739, width:.144, radius:.667, arc:.258, close:.93, platform:true, neutral:true},
  'lever-vertical-row': {pivotY:.614, pivotZ:.712, width:.275, radius:.618, arc:.29, close:1.087, platform:true, chest:true, under:true},
  'lever-supported-row': {pivotY:.349, pivotZ:.745, width:.251, radius:.673, arc:.216, close:.872, platform:true, chest:true},
  'lever-plate-row': {pivotY:.392, pivotZ:.801, width:.232, radius:.680, arc:.287, close:1.003, chest:true, heavy:true},
  'lever-bent-over-v': {pivotY:.14, pivotZ:1.104, width:.122, radius:.858, arc:.313, close:.723, tBar:'standing', neutral:true},
  'lever-reverse-tbar': {pivotY:.142, pivotZ:-.579, width:.289, radius:1.247, arc:1.01, close:.79, tBar:'seated', platform:true, chest:true, under:true},
  'lever-supported-tbar': {pivotY:.142, pivotZ:-.579, width:.289, radius:1.247, arc:1.01, close:.79, tBar:'seated', platform:true, chest:true},
  'lever-preacher-curl': {pivotY:.794,pivotZ:.372,width:.239,radius:.371,arc:.91,close:2.62,preacher:true,under:true},
  'lever-preacher-supported': {pivotY:.794,pivotZ:.372,width:.283,radius:.369,arc:.86,close:2.56,preacher:true,chest:true,under:true},
  'lever-preacher-hammer': {pivotY:.794,pivotZ:.372,width:.235,radius:.371,arc:.87,close:2.58,preacher:true,chest:true,neutral:true},
  'lever-preacher-reverse': {pivotY:.794,pivotZ:.372,width:.260,radius:.367,arc:.85,close:2.50,preacher:true},
  'lever-pullover': {pivotY:1.035,pivotZ:-.183,width:.260,radius:.587,arc:.081,close:1.985,pullover:true},
  'lever-deadlift': {pivotY:.296,pivotZ:-.685,width:.295,radius:.947,arc:.166,close:.616,utility:'deadlift',neutral:true},
  'lever-seated-shrug': {pivotY:.279,pivotZ:.726,width:.267,radius:.690,arc:.281,close:.424,utility:'shrug'},
  'lever-hand-gripper': {pivotY:.591,pivotZ:.599,width:.179,radius:.309,arc:.097,close:.321,utility:'gripper'},
  'lever-hip-footplate': {pivotY:1.563,pivotZ:.58,width:.160,radius:.884,arc:-.221,close:.243,utility:'hip-extension'},
});

export function leverPullGrip(config, sign, angle, width = config.width) {
  const {pivotY, pivotZ, radius} = config;
  if (config.utility === 'deadlift') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ+radius*Math.cos(angle)];
  if (config.utility === 'shrug') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.utility === 'gripper') return [sign*width,pivotY-radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.utility === 'hip-extension') return [sign*width,pivotY-radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.preacher) return [sign*width,pivotY-radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.pullover) return [sign*width,pivotY+radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.tBar === 'standing') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.tBar === 'seated') return [sign*width,pivotY+radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  return config.overhead ? [
    sign * (width + (config.diagonal ? .255 * Math.sin(angle) : 0)),
    pivotY + radius * (config.diagonal ? .932 : 1) * Math.sin(angle),
    pivotZ - radius * Math.cos(angle),
  ] : [sign * width, pivotY + radius * Math.cos(angle), pivotZ - radius * Math.sin(angle)];
}
