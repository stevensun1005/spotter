import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const materials = {
  frame: new THREE.MeshStandardMaterial({ color: 0xa8b4a8, metalness: .26, roughness: .48 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd1dbd3, metalness: .55, roughness: .30 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x333d37, roughness: .85 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x4d5d51, roughness: .68, metalness: .32 }),
};

const stride = Math.SQRT1_2;
const up = new THREE.Vector3(0, 1, 0);
function part(parent, geometry, material, x, y, z) {
  const item = new THREE.Mesh(geometry, materials[material]);
  item.position.set(x, y, z);
  item.castShadow = item.receiveShadow = true;
  parent.add(item);
  return item;
}
function pad(parent, dimensions, center, material = 'pad', angle = 0) {
  const object = part(parent, new RoundedBoxGeometry(...dimensions, 2, .013), material, ...center);
  object.rotation.x = angle;
  return object;
}
function rail(parent, radius, material, start, end) {
  const a = new THREE.Vector3(...start);
  const delta = new THREE.Vector3(...end).sub(a);
  const length = delta.length();
  const object = part(parent, new THREE.CylinderGeometry(radius, radius, length, 14), material,
    ...a.addScaledVector(delta, .5));
  object.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
}
function weights(parent) {
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const plate = part(parent, new THREE.CylinderGeometry(.139 - i * .022, .139 - i * .022, .037, 24), 'pad',
        sign * (.47 + .041 * i), -.06, .031);
      plate.rotation.z = Math.PI / 2;
    }
    rail(parent, .018, 'steel', [sign * .39, -.06, .031], [sign * .624, -.06, .031]);
  }
}

export function buildSledProps(group, preset) {
  if (!preset) return;
  const hack = preset === 'hack';
  const forward = preset === 'standing-calf';
  const lying = preset === 'press-lying';
  const smith = preset === 'smith';
  const horizontal = preset === 'horizontal';
  const origin = smith ? [0,.535,.512] : horizontal ? [0,.515,.542] : hack ? [0,.92,-.41] : forward ? [0,1.16,.31] : lying ? [0,.49,.44] : [0,.604,.182];
  const line = smith ? [0,.72,.69] : horizontal ? [0,0,1] : hack ? [0,stride,-stride] : forward ? [0,stride,stride] : lying ? [0,1,0] : [0,stride,stride];
  const motion = new THREE.Group();
  group.add(motion);
  for (const x of [-.434, .434]) {
    pad(group, [.105,.071,1.57], [x,.047,.06], 'frame');
    const start = [x,origin[1] - line[1] * .40,origin[2] - line[2] * .40];
    const end = [x,origin[1] + line[1] * .95,origin[2] + line[2] * .95];
    rail(group, .031, 'steel', start, end);
    if (smith) {
      for(const z of [.185,1.22]) {
        pad(group,[.067,2.08,.067],[x,1.06,z],'frame');
        rail(group,.019,'steel',[x+.027,.117,z],[x+.027,2.09,z]);
      }
      pad(group,[.076,.069,1.09],[x,2.10,.704],'frame');
    }
    const foot = [x,.073,end[2] - .09];
    rail(group, .038, 'frame', foot, end);
    pad(motion,[.10,.20,.15],[x,-.09,.02],'frame',hack ? -.785 : .785);
  }
  pad(group,[.99,.075,.13],[0,.049,-.65],'frame');
  pad(group,[.99,.075,.13],[0,.049,.75],'frame');
  if (smith) pad(group,[.94,.067,.078],[0,2.10,1.215],'frame');
  if (hack || forward) {
    pad(group,[.86,.070,.51],[0,.095,.245],'plate');
    for (let i = 0; i < 7; i++) pad(group,[.74,.008,.012],[0,.134,.052 + .057 * i],'steel');
    pad(motion,[.35,.55,.070],[0,-.043,0],'pad',hack ? -.28 : .32);
    for (const x of [-.195,.195]) {
      pad(motion,[.158,.07,.211],[x,.305,hack ? .071 : -.075]);
      rail(motion,.023,'plate',[x,.26,0],[x * 1.36,.23,hack ? .134 : -.134]);
      rail(motion,.026,'pad',[x * 1.36,.23,hack ? .134 : -.134],[x * 1.36,.35,hack ? .134 : -.134]);
    }
  } else {
    const angle = lying ? -1.51 : smith||horizontal ? -.69 : -.99;
    pad(group,[.416,.61,.072],[0,lying ? .19 : smith||horizontal ? .594 : .539,lying ? -.473 : smith||horizontal ? -.490 : -.500],'pad',angle);
    pad(group,[.413,.068,.322],[0,lying ? .169 : .353,-.235]);
    for (const x of [-.29,.29]) rail(group,.024,'pad',[x,lying ? .26 : .46,-.36],[x,lying ? .26 : .46,-.15]);
    const footplate = new THREE.Group();
    footplate.rotation.x = lying ? Math.PI : horizontal ? Math.PI / 2 : 2.36;
    motion.add(footplate);
    pad(footplate,[.796,.060,.51],[0,.031,0],'plate');
    for (let i = 0; i < 7; i++) pad(footplate,[.72,.009,.013],[0,-.003,-.21 + .062 * i],'steel');
  }
  weights(motion);
  return ({machineTravel}) => {
    motion.position.set(origin[0],origin[1] + line[1] * machineTravel,origin[2] + line[2] * machineTravel);
  };
}
