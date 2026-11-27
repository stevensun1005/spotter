export const assistedExercises = Object.freeze({
  'assist-chest-dip': {grip:'dip',width:.287,height:1.318,depth:.075,forwardLean:.36},
  'assist-triceps-dip': {grip:'dip',width:.233,height:1.318,depth:.075,forwardLean:.082},
  'assist-wide-chest-dip': {grip:'dip',width:.371,height:1.318,depth:.075,forwardLean:.40},
  'assist-neutral-pull': {grip:'neutral',width:.160,height:1.984,depth:.062},
  'assist-kneeling-pull': {grip:'over',width:.341,height:1.984,depth:.102},
  'assist-standing-chin': {grip:'under',width:.183,height:1.984,depth:.098,platform:true},
  'assist-standing-pull': {grip:'over',width:.331,height:1.984,depth:.102,platform:true},
  'assist-kneeling-chin': {grip:'under',width:.171,height:1.984,depth:.102},
  'assist-standing-close-chin': {grip:'under',width:.111,height:1.984,depth:.102,platform:true},
  'assist-standing-triceps-dip': {grip:'dip',width:.235,height:1.318,depth:.075,forwardLean:.069,platform:true},
  'assist-single-leg-press': {grip:'press',width:.267,height:1.247,depth:.331,platform:true,singleFoot:true},
  'assist-single-leg-floor-press': {grip:'press',width:.267,height:1.120,depth:.331,platform:true,singleFoot:true,supportFloor:true},
});

export function assistedGrip(config, sign) {
  return [sign*config.width,config.height,config.depth];
}
