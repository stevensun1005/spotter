import * as THREE from 'three';

const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x465349, roughness: .88 });
const anchorMaterial = new THREE.MeshStandardMaterial({ color: 0x9da99e, roughness: .45, metalness: .35 });
const up = new THREE.Vector3(0,1,0);
const vector = (value) => new THREE.Vector3(...value);
function prop(group,geometry,material) {
  const item = new THREE.Mesh(geometry,material);
  item.castShadow = item.receiveShadow = true;
  group.add(item);
  return item;
}
export function buildRopeProps(group,preset,initial) {
  if (!preset) return;
  const material = preset==='towel' ? new THREE.MeshStandardMaterial({color:0x869785,roughness:.97}) : ropeMaterial;
  const radius = preset === 'battle' ? .019 : preset === 'climb' ? .020 : .0068;
  const ropes = initial.ropeTracks.map(path => Array.from({length:path.length-1},()=>
    prop(group,preset==='towel' ? new THREE.BoxGeometry(.068,1,.012) : new THREE.CylinderGeometry(radius,radius,1,12),material)));
  if (preset==='battle') {
    const p=initial.ropeTracks[0].at(-1);
    prop(group,new THREE.BoxGeometry(.35,.09,.29),anchorMaterial).position.set(p[0],.045,p[2]);
    const ring=prop(group,new THREE.TorusGeometry(.033,.009,10,24),anchorMaterial);
    ring.position.set(p[0],.12,p[2]);
  } else if (preset==='climb') {
    const [x,y,z]=initial.ropeTracks[0][0];
    prop(group,new THREE.BoxGeometry(.94,.06,.12),anchorMaterial).position.set(x,y+.045,z);
  }
  return ({ropeTracks}) => {
    ropes.forEach((rope,index) => rope.forEach((segment,k) => {
      const a=vector(ropeTracks[index][k]);
      const b=vector(ropeTracks[index][k+1]);
      const delta=b.clone().sub(a);
      const distance=delta.length();
      segment.position.copy(a).lerp(b,.5);
      segment.scale.y=Math.max(.002,distance);
      segment.quaternion.setFromUnitVectors(up,delta.normalize());
    }));
  };
}
