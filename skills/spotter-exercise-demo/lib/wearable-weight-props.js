import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildHandHeldProp } from './handheld-props.js';

const canvas = new THREE.MeshStandardMaterial({ color: 0x394a41, roughness: .94 });
const padded = new THREE.MeshStandardMaterial({ color: 0x52665a, roughness: .89 });
const webbing = new THREE.MeshStandardMaterial({ color: 0x222d28, roughness: .91 });
const metal = new THREE.MeshStandardMaterial({ color: 0x93a294, roughness: .44, metalness: .42 });
const yAxis = new THREE.Vector3(0, 1, 0);
const point = (coordinates) => new THREE.Vector3(...coordinates);

function mesh(parent, geometry, surface, x, y, z) {
  const item = new THREE.Mesh(geometry, surface);
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function panel(parent, width, height, depth, surface, x, y, z, radius) {
  return mesh(parent, new RoundedBoxGeometry(width, height, depth, 3, radius), surface, x, y, z);
}

function seam(parent, coordinates, radius, surface = webbing) {
  const curve = new THREE.CatmullRomCurve3(coordinates.map(point));
  return mesh(parent, new THREE.TubeGeometry(curve, 22, radius, 7), surface, 0, 0, 0);
}

function backpack(group) {
  group.name = 'Weighted training backpack';
  panel(group, .333, .402, .174, canvas, 0, .021, -.184, .061);
  panel(group, .278, .129, .052, padded, 0, -.054, -.265, .025);
  seam(group, [[-.122,.086,-.271],[0,.115,-.275],[.122,.086,-.271]], .006, padded);
  seam(group, [[-.058,.205,-.154],[-.035,.254,-.148],[.035,.254,-.148],[.058,.205,-.154]], .009);
  for (const side of [-1, 1]) {
    const x = side * .130;
    seam(group, [[x,.165,-.179],[x,.217,-.019],[x,.179,.084],[x,.073,.133],
      [x,-.047,.134],[side*.173,-.124,.020],[side*.144,-.132,-.155]], .016);
    panel(group, .053, .033, .020, padded, x, .031, .144, .004);
  }
  panel(group, .247, .019, .027, webbing, 0, -.025, .146, .007);
  panel(group, .047, .028, .032, padded, 0, -.025, .152, .005);
}

function vest(group) {
  group.name = 'Training weight vest';
  for (const face of [-1, 1]) {
    panel(group, .302, .294, .063, canvas, 0, .007, face*.121, .033);
    panel(group, .284, .069, .023, webbing, 0, -.085, face*.152, .007);
    for (const x of [-.081,.081]) panel(group, .123, .108, .037, padded, x, .049, face*.153, .009);
  }
  for (const side of [-1, 1]) {
    const x = side*.123;
    seam(group, [[x,.117,-.105],[x,.201,-.066],[x,.192,.077],[x,.125,.124]], .019);
    seam(group, [[side*.132,-.086,-.123],[side*.182,-.088,0],[side*.132,-.086,.123]], .020);
  }
}

function weightBelt(group) {
  group.name = 'Plate-loaded dip belt';
  const band = mesh(group, new THREE.TorusGeometry(.150, .021, 10, 34), webbing, 0, 0, 0);
  band.scale.y = .81;
  band.rotation.x = Math.PI / 2;
  panel(group, .200, .064, .039, canvas, 0, .003, -.126, .010);
  for (const x of [-.080,.080]) {
    const clasp = mesh(group, new THREE.TorusGeometry(.021, .004, 10, 22), metal, x, -.013, .122);
    clasp.rotation.y = x > 0 ? .20 : -.20;
  }
}

function cuff(group) {
  group.name = 'Ankle weight cuff';
  mesh(group, new THREE.TorusGeometry(.061,.018,10,30), webbing, 0, 0, 0).rotation.x = Math.PI / 2;
  for (const x of [-.060,.060]) panel(group,.038,.082,.070,canvas,x,0,0,.009);
  panel(group,.064,.048,.029,padded,0,0,.070,.008);
}

export function buildWearableWeight(parent, weight) {
  if (!weight) return undefined;
  if (weight.startsWith('ankle')) {
    const placements = weight === 'ankles' ? ['l','r'] : ['l'];
    const cuffs = placements.map(side => {
      const group = new THREE.Group();
      parent.add(group);
      cuff(group);
      return {side, group};
    });
    return (pose) => {
      for (const {side,group} of cuffs) {
        const ankle = point(pose[side+'a']);
        const shin = point(pose[side+'k']).sub(ankle).normalize();
        group.position.copy(ankle).addScaledVector(shin,.092);
        group.quaternion.setFromUnitVectors(yAxis, shin);
      }
    };
  }
  const group = new THREE.Group();
  parent.add(group);
  if (weight === 'backpack') backpack(group);
  if (weight === 'vest') vest(group);
  if (weight === 'belt') weightBelt(group);
  const plate = weight === 'belt' ? buildHandHeldProp(parent,'plate') : undefined;
  const chain = plate ? mesh(parent, new THREE.CylinderGeometry(.010,.010,1,10), metal, 0, 0, 0) : undefined;
  return (pose) => {
    const hips=point(pose.hips);
    const upper=point(pose.neck).sub(hips).normalize();
    const side=point(pose.ls).sub(point(pose.rs)).normalize();
    const front = new THREE.Vector3().crossVectors(side,upper).normalize();
    const correctedSide = new THREE.Vector3().crossVectors(upper,front).normalize();
    const matrix = new THREE.Matrix4().makeBasis(correctedSide,upper,front);
    group.quaternion.setFromRotationMatrix(matrix);
    if (plate) {
      group.position.copy(hips).addScaledVector(upper,.061);
      plate.position.copy(hips).addScaledVector(yAxis,-.281).addScaledVector(front,.145);
      plate.quaternion.setFromUnitVectors(yAxis,front);
      const start = new THREE.Vector3(0,-.013,.118).applyQuaternion(group.quaternion).add(group.position);
      const end = plate.position.clone().addScaledVector(yAxis,.066);
      const delta = end.clone().sub(start);
      chain.position.copy(start).lerp(end,.5);
      chain.quaternion.setFromUnitVectors(yAxis,delta.clone().normalize());
      chain.scale.y=delta.length();
    } else group.position.copy(point(pose.chest));
  };
}
