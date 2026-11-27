import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const material = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const water = material(0x90b3ba, .41);
const plasticRib = material(0xbed2d5, .39);
const cap = material(0x385f58, .75);
const label = material(0xe5ebe4, .86);
const rubberPlate = material(0x303532, .78, .08);
const plateDetail = material(0x535b52, .64, .12);
const collar = material(0xb5bfb5, .34, .55);
const fabric = material(0x546058, .98);
const fabricEdge = material(0x283631, .95);
const stitches = material(0x93a397, .88);

function place(parent, geometry, surface, y = 0) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function bottle(group) {
  group.name = 'Filled training water bottle';
  const profile = [[0,-.105],[.025,-.105],[.034,-.097],[.035,-.077],
    [.033,-.066],[.034,-.051],[.034,.051],[.030,.074],[.016,.088],[.016,.097],[0,.097]];
  place(group,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),32),water);
  for (const y of [-.088,-.074,-.060,.050,.061]) {
    place(group,new THREE.TorusGeometry(.033,.0017,8,28),plasticRib,y).rotation.x=Math.PI/2;
  }
  place(group,new THREE.CylinderGeometry(.0346,.0346,.055,32,1,true),label,-.012);
  place(group,new THREE.CylinderGeometry(.019,.019,.024,32),cap,.102);
  for (const y of [.093,.111]) {
    place(group,new THREE.TorusGeometry(.0194,.0011,8,28),plasticRib,y).rotation.x=Math.PI/2;
  }
}

function plate(group) {
  group.name = 'Rubber bumper weight plate';
  const ring=(outer,inner,height,surface)=>{
    const outline=new THREE.Shape();
    outline.absarc(0,0,outer,0,2*Math.PI,false);
    const hole=new THREE.Path();
    hole.absarc(0,0,inner,0,2*Math.PI,true);
    outline.holes.push(hole);
    return place(group,new THREE.ExtrudeGeometry(outline,{depth:height,bevelEnabled:false,curveSegments:24}),
      surface,height/2).rotateX(Math.PI/2);
  };
  ring(.139,.018,.025,rubberPlate);
  ring(.139,.127,.029,plateDetail);
  ring(.030,.017,.031,collar);
}

function sandbag(group) {
  group.name = 'Fabric training sandbag';
  place(group,new RoundedBoxGeometry(.218,.436,.222,4,.062),fabric);
  for (const end of [-1,1]) {
    place(group,new RoundedBoxGeometry(.205,.033,.209,3,.015),fabricEdge,end*.183);
    place(group,new RoundedBoxGeometry(.209,.008,.212,3,.003),stitches,end*.169);
    for (const stitch of [-1,0,1]) {
      const patch=place(group,new THREE.BoxGeometry(.018,.002,.005),stitches,end*.159);
      patch.position.set(stitch*.030,end*.159,.112);
    }
  }
  for (const y of [-.132,.132]) {
    const grip=place(group,new THREE.TorusGeometry(.038,.006,8,22,Math.PI),fabricEdge,y);
    grip.position.z=.113;
    grip.rotation.y=Math.PI/2;
  }
}

export function buildHandHeldProp(parent, kind) {
  const group=new THREE.Group();
  parent.add(group);
  if (kind==='bottle') bottle(group);
  if (kind==='plate') plate(group);
  if (kind==='sandbag') sandbag(group);
  return group;
}
