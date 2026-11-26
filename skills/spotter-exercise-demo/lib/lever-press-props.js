import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const steel = new THREE.MeshStandardMaterial({ color: 0xb0bcb2, roughness: .43, metalness: .28 });
const edge = new THREE.MeshStandardMaterial({ color: 0x526257, roughness: .51, metalness: .20 });
const pad = new THREE.MeshStandardMaterial({ color: 0x303b35, roughness: .88 });
const up = new THREE.Vector3(0,1,0);
const vec = (point) => new THREE.Vector3(...point);
function mesh(parent,geometry,color,center) {
  const object = new THREE.Mesh(geometry,color);
  object.position.copy(vec(center));
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}
function box(parent,size,color,center,rotation=0) {
  const object = mesh(parent,new RoundedBoxGeometry(...size,2,.012),color,center);
  object.rotation.x=rotation;
  return object;
}
function bar(parent,radius,color) {
  return mesh(parent,new THREE.CylinderGeometry(radius,radius,1,18),color,[0,0,0]);
}
function aim(object,start,end) {
  const delta=end.clone().sub(start);
  const span=delta.length();
  object.position.copy(start).lerp(end,.5);
  object.scale.y=Math.max(.0001,span);
  object.quaternion.setFromUnitVectors(up,delta.normalize());
}
function beam(parent,radius,color,start,end) {
  aim(bar(parent,radius,color),vec(start),vec(end));
}

export function buildLeverPressProps(group, preset, initial) {
  if (!preset) return;
  const upright = preset === 'standing' || preset === 'standing-calf';
  const lower = ['leg','rotary-calf','seated-calf','standing-calf','hip','crunch','twist','reverse-hyper'].includes(preset);
  const freePlatform = preset === 'twist' || preset === 'reverse-hyper';
  const front = preset === 'reverse';
  const fly = preset === 'fly' || front;
  const incline = preset === 'incline';
  const z = front ? .295 : -.185;
    for (const z of [lower?.93:.39,-.49]) box(group,[.87,.061,.137],edge,[0,.034,z]);
  box(group,[.135,.067,lower?1.51:.94],steel,[0,.040,lower?.21:-.05]);
  if (preset === 'standing-calf' || preset === 'seated-calf') {
    box(group,[.75,.081,.289],edge,[0,preset==='standing-calf'?.045:.021,preset==='standing-calf'?.338:.435]);
  }
  if (preset === 'reverse-hyper') {
    box(group,[.494,.085,.518],pad,[0,.809,.158]);
    for (const x of [-.26,.26]) {
      beam(group,.056,steel,[x,.086,.207],[x,.779,.207]);
      beam(group,.023,pad,[x,.806,.395],[x,.806,.535]);
    }
  }
  if (!upright && !freePlatform) {
    box(group,[.41,.071,.407],pad,[0,.442,.006]);
    beam(group,.055,steel,[0,.078,-.06],[0,.419,-.055]);
  }
  if (!freePlatform && preset !== 'standing-calf') {
    box(group,[.372,upright?.59:.502,.078],pad,[0,upright?1.17:.77,z],incline ? -.33 : 0);
    beam(group,.042,steel,[0,.08,z],[0,upright?1.24:.798,z]);
  }
  if (preset==='twist') for (const sign of [-1,1]) {
    beam(group,.040,steel,[sign*.341,.078,.496],[sign*.341,.993,.496]);
    beam(group,.023,pad,[sign*.341,.993,.496],[sign*.239,.993,.422]);
  }

  const arms = initial.leverPressHandles.map(({pivot},index) => {
    const sign=index===0?1:-1;
    const ground=[sign*.503,.087,pivot[2]-.25];
    const post=[sign*.503,pivot[1],pivot[2]-.14];
    beam(group,.048,steel,ground,post);
    beam(group,.041,steel,post,pivot);
    const pivotCap=mesh(group,new THREE.CylinderGeometry(.063,.063,.094,22),edge,pivot);
    if (!fly) pivotCap.rotateZ(Math.PI/2);
    const arm=bar(group,.033,edge);
    const handle=bar(group,.020,pad);
    const base=vec(pivot);
    const contact = lower ? (preset==='leg'||preset==='rotary-calf' ? box(group,[.24,.27,.039],edge,[0,0,0],-.32)
      : box(group,[.172,preset==='crunch'?.155:.087,.114],pad,[0,0,0])) : null;
    return {arm,handle,base,sign,contact};
  });
  return ({leverPressHandles}) => {
    for (const [index,part] of arms.entries()) {
      const {arm,handle,base,sign,contact}=part;
      const {point,axis}=leverPressHandles[index];
      const center=vec(point);
      const direction=vec(axis).normalize();
      const stem=center.clone().addScaledVector(direction,sign*.049);
      aim(arm,base,stem);
      aim(handle,center.clone().addScaledVector(direction,-.070),center.clone().addScaledVector(direction,.070));
      if (contact) {
        contact.position.copy(center);
        if (preset === 'rotary-calf') contact.rotation.x = -.52 + (center.y - .076) * 3.7;
      }
    }
  };
}
