import * as THREE from 'three';

const rubber = new THREE.MeshStandardMaterial({color:0x2b3530, roughness:.87});
const gray = new THREE.MeshStandardMaterial({color:0xa7ab9e, roughness:.49, metalness:.43});
const green = new THREE.MeshStandardMaterial({color:0x718875, roughness:.78});
const up = new THREE.Vector3(0,1,0);
const point = (value) => new THREE.Vector3(...value);

function place(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}

function drum(group, material, radius, width, level = 0, segments = 32) {
  return place(group,new THREE.CylinderGeometry(radius,radius,width,segments),material,0,level);
}

function balanceDome(group) {
  drum(group,rubber,.353,.049,.025,56);
  drum(group,gray,.347,.016,.054,56);
  const dome=place(group,new THREE.SphereGeometry(.336,48,20,0,Math.PI*2,0,Math.PI/2),green,0,.058);
  dome.scale.y=.64;
  for (const angle of [.28,.62,.94,1.22,1.42]) {
    const seam=place(group,new THREE.TorusGeometry(.336*Math.sin(angle),.0021,8,56),
      green,0,.058+.215*Math.cos(angle));
    seam.rotateX(Math.PI/2);
  }
  for (const x of [-.266,.266]) {
    place(group,new THREE.BoxGeometry(.136,.045,.127),rubber,x,.022,0);
  }
}

function buildFoamRoller(group) {
  drum(group,rubber,.064,.562);
  drum(group,green,.076,.536);
  for (let y=-.235; y<=.24; y+=.047) drum(group,green,.081,.018,y);
  for (const y of [-.286,.286]) drum(group,gray,.040,.006,y);
}

function buildWheel(group) {
  drum(group,gray,.015,.461);
  for (const y of [-.167,.167]) {
    drum(group,rubber,.023,.136,y);
    for (let index=-3;index<=3;index++) drum(group,rubber,.026,.003,y+index*.014);
  }
  for (const y of [-.035,.035]) {
    drum(group,rubber,.094,.049,y,52);
    for (const rim of [-.026,.026]) drum(group,green,.076,.005,y+rim,52);
    const spokes=new THREE.Group();
    for(const angle of [0,Math.PI/3,Math.PI*2/3]) {
      place(spokes,new THREE.BoxGeometry(.126,.004,.010),gray).rotateY(angle);
    }
    spokes.position.y=y+(y<0?-.025:.025);
    group.add(spokes);
  }
}

function buildTire(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const section = [
    [.245,-.102],[.282,-.111],[.406,-.114],[.458,-.092],[.463,.089],
    [.406,.114],[.282,.111],[.245,.102],[.238,.078],[.238,-.078],[.245,-.102],
  ].map(([radius,y]) => new THREE.Vector2(radius,y));
  const treadMaterial = new THREE.MeshStandardMaterial({color:0x3c433d,roughness:.9});
  place(group,new THREE.LatheGeometry(section,64),rubber);
  for (const y of [-.106,.106]) {
    for (const radius of [.263,.416]) {
      place(group,new THREE.TorusGeometry(radius,.006,8,64),treadMaterial,0,y).rotateX(Math.PI/2);
    }
  }
  for (let index=0;index<32;index++) {
    for (const lane of [-1,1]) {
      const angle=(index+(lane===1?.46:0))*Math.PI/16;
      const lug = place(group,new THREE.BoxGeometry(.055,.079,.028),treadMaterial,
        .469*Math.sin(angle),lane*.058,.469*Math.cos(angle));
      lug.rotation.order='YXZ';
      lug.rotation.set(0,angle,lane*.22);
    }
  }
  return (pose) => {
    group.position.copy(point(pose.tireCenter));
    group.rotation.x=pose.tireAngle;
  };
}

export function buildCatalogueSmallProp(scene, kind) {
  if (kind === 'bosu') {
    balanceDome(scene);
    return null;
  }
  if (kind === 'tire') return buildTire(scene);
  if (!kind || kind === 'medicine' || kind.startsWith('massage')) return null;
  const roller=new THREE.Group();
  scene.add(roller);
  if (kind.startsWith('foam')) buildFoamRoller(roller);
  else buildWheel(roller);
  if (kind === 'foam-long') roller.scale.y = 1.73;
  if (kind === 'foam-wall') {
    place(scene,new THREE.BoxGeometry(1.24,2.36,.072),green,0,1.18,1.385);
  }
  if (kind === 'wheel-wall') {
    place(scene,new THREE.BoxGeometry(1.33,1.55,.071),green,0,.775,1.385);
  }
  if (kind === 'wheel-band') {
    place(scene,new THREE.BoxGeometry(.340,.048,.290),rubber,0,.024,-.860);
    place(scene,new THREE.BoxGeometry(.079,.478,.080),gray,0,.270,-.860);
    const anchor=place(scene,new THREE.TorusGeometry(.027,.006,10,24),gray,0,.472,-.815);
    anchor.rotation.y=Math.PI/2;
  }
  return (pose) => {
    const {center,axis}=pose.handRoller;
    roller.position.copy(point(center));
    roller.quaternion.setFromUnitVectors(up,point(axis).normalize());
    roller.rotateY(pose.machineTravel);
  };
}
