export const seatedErgometers = new Set(['ergometer-arms','ergometer-seated-ski']);
export const armCrank = Object.freeze({y:1.016,z:.407,width:.265,radius:.176});

export function armCrankGrip(sign, phase) {
  const angle=phase+(sign<0?Math.PI:0);
  return [sign*armCrank.width,armCrank.y+armCrank.radius*Math.sin(angle),armCrank.z+armCrank.radius*Math.cos(angle)];
}
