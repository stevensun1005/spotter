import * as THREE from 'three';

const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x465349, roughness: .88 });
const anchorMaterial = new THREE.MeshStandardMaterial({ color: 0x9da99e, roughness: .45, metalness: .35 });
const materialTail = new THREE.MeshStandardMaterial({ color: 0x9b5148, roughness: .48 });
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
  const battle = preset.startsWith('battle');
  const climb = preset.startsWith('climb');
  const load = preset === 'sled' || preset === 'truck' ? new THREE.Group() : null;
  const radius = battle ? .019 : climb ? .020 : load ? .018 : .009;
  const ropes = initial.ropeTracks.map(path => Array.from({length:path.length-1},()=>
    prop(group,preset==='towel' ? new THREE.BoxGeometry(.068,1,.012) : new THREE.CylinderGeometry(radius,radius,1,12),material)));
  if (battle) {
    const p=initial.ropeTracks[0].at(-1);
    prop(group,new THREE.BoxGeometry(.35,.09,.29),anchorMaterial).position.set(p[0],.045,p[2]);
    const ring=prop(group,new THREE.TorusGeometry(.033,.009,10,24),anchorMaterial);
    ring.position.set(p[0],.12,p[2]);
  } else if (climb) {
    const [[x,y,z]] = initial.ropeTracks[0];
    const beamX = preset === 'climb-pair' ? (x + initial.ropeTracks[1][0][0]) / 2 : x;
    prop(group,new THREE.BoxGeometry(1.18,.075,.126),anchorMaterial).position.set(beamX,y+.046,z);
    for (const side of [-1,1]) {
      prop(group,new THREE.BoxGeometry(.072,y,.072),anchorMaterial).position.set(beamX+side*.557,y/2,z);
      prop(group,new THREE.BoxGeometry(.16,.043,.52),ropeMaterial).position.set(beamX+side*.557,.022,z);
    }
  }
  if (load) {
    group.add(load);
    const slab = (w,h,d,x,y,z,material=anchorMaterial) =>
      prop(load,new THREE.BoxGeometry(w,h,d),material).position.set(x,y,z);
    const wheel = (r,w,x,y,z) => {
      const part = prop(load,new THREE.CylinderGeometry(r,r,w,36),ropeMaterial);
      part.rotation.z = Math.PI/2;
      part.position.set(x,y,z);
    };
    if (preset === 'sled') {
      for (const side of [-1,1]) slab(.11,.052,.65,side*.22,.026,.32,ropeMaterial);
      slab(.55,.055,.38,0,.083,.32);
      for (let i=0;i<4;i++) prop(load,new THREE.CylinderGeometry(.155,.155,.044,32),ropeMaterial)
        .position.set(0,.135+i*.047,.32);
      slab(.034,.27,.034,0,.23,.32);
      slab(.068,.046,.254,0,.140,.124);
      const eye = prop(load,new THREE.TorusGeometry(.036,.009,12,26),anchorMaterial);
      eye.position.set(0,.159,.011);
    } else {
      slab(1.24,.275,1.69,0,.390,-.96,ropeMaterial);
      slab(1.33,.48,1.29,0,.756,-1.03);
      slab(1.20,.25,.40,0,1.102,-1.55,ropeMaterial);
      slab(1.32,.14,.12,0,.48,-.068);
      slab(.098,.14,.053,-.54,.597,-.002,materialTail);
      slab(.098,.14,.053,.54,.597,-.002,materialTail);
      const hitch = prop(load,new THREE.TorusGeometry(.035,.008,12,26),anchorMaterial);
      hitch.position.set(0,.476,.009);
      for (const side of [-1,1]) {
        wheel(.303,.20,side*.61,.303,-.50);
        wheel(.303,.20,side*.61,.303,-1.39);
      }
    }
  }
  return ({ropeTracks}) => {
    if (load) {
      const [x,,z] = ropeTracks[0].at(-1);
      load.position.set(x,0,z);
    }
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
