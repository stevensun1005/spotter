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
  'lever-plate-close-horizontal': {pivotY:.375,pivotZ:.769,width:.145,radius:.674,arc:.255,close:.924,platform:true,chest:true,neutral:true,heavy:true,raisedPeg:true},
  'lever-plate-low-horizontal': {pivotY:.269,pivotZ:.695,width:.221,radius:.674,arc:.207,close:.962,platform:true,chest:true,neutral:true,heavy:true,raisedPeg:true},
  'lever-stack-middle-neutral': {pivotY:.332,pivotZ:.741,width:.237,radius:.683,arc:.254,close:.871,platform:true,chest:true,neutral:true,stack:true},
  'lever-plate-middle-over': {pivotY:.382,pivotZ:.744,width:.271,radius:.675,arc:.243,close:.953,platform:true,chest:true,heavy:true,raisedPeg:true},
  'lever-plate-middle-neutral': {pivotY:.401,pivotZ:.779,width:.249,radius:.682,arc:.278,close:.971,platform:true,chest:true,neutral:true,heavy:true,raisedPeg:true},
  'lever-plate-scapula-over': {pivotY:.385,pivotZ:.753,width:.275,radius:.681,arc:.249,close:.336,platform:true,chest:true,heavy:true,scapula:true,raisedPeg:true},
  'lever-plate-scapula-neutral': {pivotY:.388,pivotZ:.755,width:.235,radius:.681,arc:.252,close:.336,platform:true,chest:true,heavy:true,neutral:true,scapula:true,raisedPeg:true},
  'lever-plate-high-neutral': {pivotY:1.184,pivotZ:.905,width:.281,radius:.681,arc:.541,close:-.288,overhead:true,chest:true,platform:true,neutral:true,heavy:true},
  'lever-plate-high-over': {pivotY:1.166,pivotZ:.906,width:.320,radius:.689,arc:.515,close:-.356,overhead:true,chest:true,platform:true,heavy:true},
  'lever-plate-high-under': {pivotY:1.155,pivotZ:.872,width:.237,radius:.675,arc:.459,close:-.352,overhead:true,chest:true,platform:true,under:true,heavy:true,independent:true},
  'lever-plate-lateral-neutral': {pivotY:1.405,pivotZ:.864,width:.306,radius:.702,arc:.219,close:-.453,overhead:true,restraint:true,neutral:true,heavy:true},
  'lever-lever-lateral-wide': {pivotY:1.411,pivotZ:.881,width:.354,radius:.713,arc:.216,close:-.458,overhead:true,restraint:true,diagonal:true},
  'lever-lever-lateral-under': {pivotY:1.420,pivotZ:.821,width:.222,radius:.676,arc:.221,close:-.421,overhead:true,restraint:true,under:true,independent:true},
  'lever-plate-lateral-under': {pivotY:1.430,pivotZ:.866,width:.219,radius:.691,arc:.212,close:-.408,overhead:true,restraint:true,under:true,independent:true,heavy:true},
  'lever-plate-preacher-joined': {pivotY:.794,pivotZ:.372,width:.229,radius:.369,arc:.84,close:2.56,preacher:true,under:true},
  'lever-plate-preacher-low': {pivotY:.769,pivotZ:.388,width:.238,radius:.378,arc:.682,close:2.612,preacher:true,under:true},
  'lever-plate-preacher-independent': {pivotY:.794,pivotZ:.372,width:.242,radius:.369,arc:.841,close:2.604,preacher:true,under:true,independent:true},
  'lever-tbar-chest-std': {pivotY:.148,pivotZ:-.844,width:.252,radius:1.262,arc:.205,close:.496,
    tBar:'chest',rearPivot:true},
  'lever-tbar-chest-neutral': {pivotY:.129,pivotZ:-.835,width:.181,radius:1.229,arc:.224,close:.531,
    tBar:'chest',rearPivot:true,neutral:true},
  'lever-tbar-chest-wide': {pivotY:.141,pivotZ:-.858,width:.359,radius:1.295,arc:.245,close:.482,
    tBar:'chest',rearPivot:true,wide:true},
  'lever-tbar-chest-heavy': {pivotY:.145,pivotZ:-.851,width:.377,radius:1.331,arc:.234,close:.500,
    tBar:'chest',rearPivot:true,wide:true,heavy:true},
  'lever-tbar-chest-close': {pivotY:.140,pivotZ:-.879,width:.116,radius:1.314,arc:.220,close:.543,
    tBar:'chest',rearPivot:true,neutral:true},
  'lever-tbar-lying': {pivotY:.118,pivotZ:-1.028,width:.262,radius:1.436,arc:.185,close:.425,
    tBar:'prone',rearPivot:true},
  'lever-tbar-lying-band': {pivotY:.121,pivotZ:-1.024,width:.258,radius:1.435,arc:.183,close:.426,
    tBar:'prone',rearPivot:true,band:true},
  'lever-tbar-incline': {pivotY:.108,pivotZ:-.966,width:.252,radius:1.394,arc:.261,close:.494,
    tBar:'incline',rearPivot:true},
  'lever-tbar-incline-neutral': {pivotY:.106,pivotZ:-.967,width:.219,radius:1.375,arc:.255,close:.506,
    tBar:'incline',rearPivot:true,neutral:true},
  'lever-tbar-single-lat': {pivotY:.156,pivotZ:-.850,width:.211,radius:1.268,arc:.201,close:.507,
    tBar:'standing',rearPivot:true,neutral:true},
  'lever-tbar-rdl': {pivotY:.147,pivotZ:-.897,width:.144,radius:1.285,arc:.211,close:.552,
    tBar:'standing',rearPivot:true,neutral:true,hinge:true},
  'lever-tbar-underhand': {pivotY:.137,pivotZ:-.867,width:.269,radius:1.285,arc:.203,close:.497,
    tBar:'standing',rearPivot:true,under:true},
});

export function leverPullGrip(config, sign, angle, width = config.width) {
  const {pivotY, pivotZ, radius} = config;
  if (config.utility === 'deadlift') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ+radius*Math.cos(angle)];
  if (config.utility === 'shrug') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.utility === 'gripper') return [sign*width,pivotY-radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.utility === 'hip-extension') return [sign*width,pivotY-radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.preacher) return [sign*width,pivotY-radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.pullover) return [sign*width,pivotY+radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  if (config.rearPivot) return [sign*width,pivotY+radius*Math.sin(angle),pivotZ+radius*Math.cos(angle)];
  if (config.tBar === 'standing') return [sign*width,pivotY+radius*Math.sin(angle),pivotZ-radius*Math.cos(angle)];
  if (config.tBar === 'seated') return [sign*width,pivotY+radius*Math.cos(angle),pivotZ+radius*Math.sin(angle)];
  return config.overhead ? [
    sign * (width + (config.diagonal ? .255 * Math.sin(angle) : 0)),
    pivotY + radius * (config.diagonal ? .932 : 1) * Math.sin(angle),
    pivotZ - radius * Math.cos(angle),
  ] : [sign * width, pivotY + radius * Math.cos(angle), pivotZ - radius * Math.sin(angle)];
}
