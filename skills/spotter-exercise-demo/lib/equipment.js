import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const material = (color, roughness = .54, metalness = .05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const frame = material(0xbac0b7, .41, .12);
const darker = material(0x282d2c, .54, .21);
const rubber = material(0x272d2a, .84);
const edge = material(0x404742, .49, .34);
const steel = material(0xa8aca8, .32, .68);
const bright = material(0xcbd0c9, .36, .45);
const accent = material(0x708c66, .44, .12);
const matTop = material(0x536b5d, .88);
const paleMat = material(0x768c7d, .85);
const cableMaterial = material(0x444e46, .54, .31);
const ropeMaterial = material(0x353b37, .86);
const up = new THREE.Vector3(0, 1, 0);
const world = (v) => new THREE.Vector3(v[0], v[1], v[2]);
const boxes = new Map();

function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, w, h, d, surface, x, y, z, bevel = .006) {
  const rounded = Math.min(bevel, .42 * Math.min(w, h, d));
  const key = [w, h, d, rounded].join(':');
  if (!boxes.has(key)) boxes.set(key, new RoundedBoxGeometry(w, h, d, 2, rounded));
  return mesh(parent, boxes.get(key), surface, x, y, z);
}

function cylinder(parent, r, length, surface, x, y, z, sides = 20, bottom = r) {
  return mesh(parent, new THREE.CylinderGeometry(r, bottom, length, sides), surface, x, y, z);
}

function bar(parent, radius, surface, sides = 12) {
  return cylinder(parent, radius, 1, surface, 0, 0, 0, sides);
}

function connect(object, start, end) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  object.position.copy(start).lerp(end, .5);
  object.scale.y = Math.max(length, .001);
  if (length > .0001) object.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
}

function aligned(group, center, axis) {
  group.position.copy(center);
  group.quaternion.setFromUnitVectors(up, axis.lengthSq() > .0001 ? axis.clone().normalize() : up);
}

function createDumbbell(parent) {
  const group = new THREE.Group();
  group.name = 'Rubber hex dumbbell';
  parent.add(group);
  cylinder(group, .0144, .148, bright);
  cylinder(group, .0154, .090, edge);
  for (let i = -6; i <= 6; i++) cylinder(group, .0161, .0018, steel, 0, i * .0064, 0, 16);
  for (const hand of [-1, 1]) {
    cylinder(group, .022, .011, steel, 0, hand * .073, 0);
    cylinder(group, .068, .061, rubber, 0, hand * .110, 0, 6);
    cylinder(group, .068, .009, rubber, 0, hand * .075, 0, 6, .059);
    const bevel = cylinder(group, .060, .009, edge, 0, hand * .145, 0, 6, .068);
    if (hand < 0) bevel.rotateX(Math.PI);
    cylinder(group, .047, .003, darker, 0, hand * .151, 0, 6);
    cylinder(group, .027, .004, edge, 0, hand * .153, 0, 24);
    cylinder(group, .021, .0045, accent, 0, hand * .156, 0, 24);
    cylinder(group, .014, .0046, darker, 0, hand * .157, 0, 20);
    for (const x of [-.006, 0, .006]) {
      box(group,.0028,.0014,.011,bright,x,hand*.159,x===0?0:.002,.0003);
    }
  }
  return group;
}

function roundSlab(parent, width, depth, height, radius, surface, x, y, z) {
  const s = new THREE.Shape();
  const w = width / 2;
  const d = depth / 2;
  s.moveTo(-w + radius, -d);
  s.lineTo(w - radius, -d);
  s.quadraticCurveTo(w, -d, w, -d + radius);
  s.lineTo(w, d - radius);
  s.quadraticCurveTo(w, d, w - radius, d);
  s.lineTo(-w + radius, d);
  s.quadraticCurveTo(-w, d, -w, d - radius);
  s.lineTo(-w, -d + radius);
  s.quadraticCurveTo(-w, -d, -w + radius, -d);
  const slab = mesh(parent, new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 6 }), surface, x, y, z);
  slab.rotateX(-Math.PI / 2);
  return slab;
}

function createMat(parent) {
  roundSlab(parent, .95, 1.87, .017, .055, edge, 0, .002, -.3);
  roundSlab(parent, .932, 1.852, .005, .046, matTop, 0, .019, -.3);
  for (const x of [-.407, .407]) box(parent, .003, .001, 1.64, paleMat, x, .0245, -.3);
  for (const z of [-1.195, .595]) box(parent, .18, .001, .006, edge, 0, .0245, z);
}

function createStep(parent) {
  const z = .51;
  roundSlab(parent, .63, .61, .037, .034, rubber, 0, .001, z);
  roundSlab(parent, .594, .562, .236, .028, frame, 0, .03, z);
  roundSlab(parent, .63, .61, .016, .032, edge, 0, .263, z);
  roundSlab(parent, .617, .601, .031, .031, rubber, 0, .279, z);
  for (const forward of [-1, 1]) {
    box(parent,.441,.108,.011,edge,0,.156,z + forward*.283,.013);
    box(parent,.364,.050,.014,rubber,0,.157,z + forward*.288,.012);
    for (const x of [-.218, .218]) {
      box(parent, .071, .018, .008, accent, x, .082, z + forward * .283);
      bolt(parent,x,.156,z + forward*.291);
    }
  }
  for (let i = -7; i <= 7; i++) box(parent, .003, .001, .485, edge, i * .037, .3105, z);
}

function bolt(parent, x, y, z, axis = 'z') {
  const pair = [cylinder(parent, .011, .002, darker, x, y, z, 16),
    cylinder(parent, .0075, .006, steel, x, y, z, 6)];
  for (const head of pair) {
    if (axis === 'z') head.rotateX(Math.PI / 2);
    if (axis === 'x') head.rotateZ(Math.PI / 2);
  }
}

function createCableTower(parent, anchor) {
  const side = Math.abs(anchor.x) > .5;
  const outward = side ? new THREE.Vector3(Math.sign(anchor.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(anchor.z || 1));
  const facing = outward.clone().negate();
  const tower = new THREE.Group();
  tower.name = 'Adjustable-pulley station';
  tower.position.set(anchor.x + .185 * outward.x, 0, anchor.z + .185 * outward.z);
  tower.rotation.y = Math.atan2(facing.x, facing.z);
  parent.add(tower);
  const height = Math.max(2.052, anchor.y + .163);
  for (const x of [-.185,.185]) {
    box(tower, .089, .054, .49, frame, x, .062, -.028, .011);
    for (const z of [-.237,.176]) {
      box(tower, .102, .062, .077, edge, x, .048, z, .012);
      box(tower, .112, .019, .099, rubber, x, .010, z, .007);
      bolt(tower,x,.087,z,'y');
    }
    box(tower, .059, height - .12, .106, frame, x, (height+.04)/2, -.062,.012);
    box(tower, .077, .134, .121, edge, x, .152, -.057,.013);
    box(tower, .078, .104, .128, edge, x, height-.089, -.052,.013);
    box(tower, .027, height-.47, .008, steel, x, (height+.055)/2, -.006,.002);
    for (const y of [.132,.183,height-.064,height-.110]) bolt(tower,x,y,.012);
  }
  box(tower,.406,.083,.123,frame,0,height-.034,-.055,.014);
  box(tower,.381,.050,.237,edge,0,.095,-.055,.011);
  box(tower,.297,height-.27,.022,darker,0,height/2,-.161,.009);
  box(tower,.244,.052,.007,edge,0,height-.207,-.145,.005);
  for(const x of [-.107,.107]) {
    for (let i=0;i<5;i++) {
      box(tower,.024,.003,.023,steel,x,height-.195-i*.009,-.144,.001);
    }
  }
  box(tower, .049, height - .18, .036, edge, 0, (height + .14) / 2, .090);
  box(tower, .029, height - .22, .009, frame, 0, (height + .14) / 2, .113);
  for (let h = .19; h < height - .11; h += .084) {
    const hole = cylinder(tower, .005, .001, darker, 0, h, .119, 12);
    hole.rotateX(Math.PI / 2);
  }
  for (const x of [-.074, .074]) {
    cylinder(tower,.010,height-.256,steel,x,(height+.02)/2,-.058,18);
    cylinder(tower,.019,.026,edge,x,.143,-.058,16);
    cylinder(tower,.018,.022,edge,x,height-.114,-.058,16);
  }
  const plates = new THREE.Group();
  plates.name = 'Cable-linked raising plates';
  tower.add(plates);
  for (let i = 0; i < 13; i++) {
    const y = .148 + i * .029;
    const target = i >= 9 ? plates : tower;
    box(target, .277,.025,.150,i%3===0?edge:darker,0,y,-.058,.004);
    box(target,.246,.003,.003,steel,0,y+.008,.018,.001);
    box(target,.021,.009,.004,i===9?accent:edge,.103,y,.020,.001);
    cylinder(target,.005,.002,darker,0,y,.020,13).rotateX(Math.PI/2);
  }
  box(plates,.226,.019,.123,steel,0,.512,-.056,.006);
  cylinder(plates,.015,.051,steel,0,.542,-.056,16);
  cylinder(plates,.011,.068,steel,0,.409,.048,16).rotateX(Math.PI/2);
  cylinder(plates,.013,.012,accent,0,.409,.090,16).rotateX(Math.PI/2);

  box(tower,.097,.118,.074,edge,0,anchor.y,.118,.011);
  for (const x of [-.039, .039]) {
    box(tower,.012,.107,.075,frame,x,anchor.y,.158,.006);
    const flange = cylinder(tower,.041,.008,edge,x*.70,anchor.y,.155);
    flange.rotateZ(Math.PI / 2);
    bolt(tower,x + Math.sign(x)*.008,anchor.y,.155,'x');
  }
  cylinder(tower,.031,.040,rubber,0,anchor.y,.155).rotateZ(Math.PI/2);
  const stackCable = bar(tower, .0034, cableMaterial, 9);
  stackCable.name = 'Stack cable';
  const stackTop = new THREE.Vector3(0, height - .090, -.056);
  const stackEnd = new THREE.Vector3();
  return {
    move(amount) {
      const lift = THREE.MathUtils.clamp(amount, 0, stackTop.y - .646);
      plates.position.y = lift;
      stackEnd.set(0, .566 + lift, -.056);
      connect(stackCable, stackTop, stackEnd);
    },
  };
}

function strap(parent, points, radius, surface) {
  const curve=new THREE.CatmullRomCurve3(points.map(world),false,'centripetal');
  return mesh(parent,new THREE.TubeGeometry(curve,points.length*4,radius,8,false),surface);
}

function collar(parent, radius, thickness, surface, x, y, z) {
  return mesh(parent, new THREE.TorusGeometry(radius, thickness, 8, 24), surface, x, y, z);
}

function createCableHandles(parent, count, isRope, twoHanded) {
  return Array.from({ length: count }, () => {
    const line = bar(parent, isRope ? .008 : .004, cableMaterial, 10);
    line.name = isRope ? 'Rope branch' : 'Pulley lead';
    const handle = new THREE.Group();
    handle.name = isRope ? 'Braided rope grip' : 'Swivel D-handle';
    parent.add(handle);
    if (isRope) {
      cylinder(handle,.0148,.077,ropeMaterial,0,.006,0,16);
      for(let y=-.029;y<=.044;y+=.008) cylinder(handle,.0154,.0023,edge,0,y,0,12);
      cylinder(handle,.024,.022,rubber,0,-.043,0,18);
      cylinder(handle,.018,.011,edge,0,.041,0,16);
    } else {
      const half = twoHanded ? .086 : .061;
      cylinder(handle,.0135,half*2,steel,0,0,0,18);
      cylinder(handle,.0173,half*1.72,rubber,0,0,0,18);
      for (let n=-7;n<=7;n++) cylinder(handle,.0177,.0028,edge,0,n*half*.106,0,16);
      for(const s of [-1,1]) {
        cylinder(handle,.018,.014,steel,0,s*half,0,18);
        cylinder(handle,.015,.006,accent,0,s*(half+.010),0,18);
      }
      strap(handle,[[0,-half,0],[.030,-half*.95,0],[.074,-half*.49,0],[.084,-.009,0],[.084,.009,0],
        [.074,half*.49,0],[.030,half*.95,0],[0,half,0]],.005,steel);
      box(handle,.025,.019,.011,edge,.087,0,0,.004);
      collar(handle,.012,.0033,steel,.109,0,0);
      cylinder(handle,.005,.016,steel,.117,0,0,12).rotateZ(Math.PI/2);
    }
    return {line,handle};
  });
}

function anchorKey(cable) {
  return cable.anchor.map(value => value.toFixed(3)).join(':');
}

function junctionFor(pose, cables) {
  if (pose.ropeJunction) return world(pose.ropeJunction);
  const first=world(cables[0].end), second=world(cables[1].end);
  const separation=second.clone().sub(first);
  const half=separation.length()/2;
  const midpoint=first.clone().lerp(second,.5);
  const pull=world(cables[0].anchor).sub(midpoint);
  if (half>.0001) {
    separation.normalize();
    pull.addScaledVector(separation,-pull.dot(separation));
  }
  return midpoint.addScaledVector(pull.normalize(),Math.sqrt(Math.max(0,.35*.35-half*half)));
}

function cablePath(cable) {
  const anchor=world(cable.anchor);
  const hand=world(cable.end);
  const grip=world(cable.grip).normalize();
  if(grip.lengthSq()<.00001) grip.copy(up);
  const inside=anchor.clone().sub(hand);
  inside.addScaledVector(grip,-inside.dot(grip));
  if(inside.lengthSq()<.00001) inside.crossVectors(grip,Math.abs(grip.y)>.9?new THREE.Vector3(0,0,1):up);
  const outward=inside.normalize();
  const clip=hand.clone().addScaledVector(outward,.124);
  return {anchor,hand,grip,outward,clip};
}

function updateCable(item, cable, junction) {
  item.line.visible = item.handle.visible = true;
  const hand = world(cable.end);
  if (cable.kind === 'rope') {
    const grip = junction.clone().sub(hand).normalize();
    aligned(item.handle, hand, grip);
    connect(item.line, junction, hand.clone().addScaledVector(grip, .044));
    return junction.distanceTo(world(cable.anchor));
  }
  const { anchor, grip, outward, clip } = cablePath(cable);
  const normal = outward.clone().cross(grip);
  item.handle.position.copy(hand);
  item.handle.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(outward,grip,normal));
  connect(item.line,anchor,clip);
  return anchor.distanceTo(clip);
}

function restingLengths(sample) {
  const lengths = new Map();
  for (let n = 0; n <= 64; n++) {
    const pose = sample(n / 64);
    const active = pose.cables ?? [];
    const rope = active.filter(cable => cable.kind === 'rope');
    const junction = rope.length === 2 ? junctionFor(pose, rope) : null;
    for (const cable of active) {
      const key = anchorKey(cable);
      const { anchor, clip } = cablePath(cable);
      const length = anchor.distanceTo(junction ?? clip);
      lengths.set(key, Math.min(lengths.get(key) ?? Infinity, length));
    }
  }
  return lengths;
}

function createLandmine(parent) {
  const hardware = new THREE.Group();
  parent.add(hardware);
  roundSlab(hardware, .42, .33, .031, .022, rubber, 0, 0, 0);
  roundSlab(hardware, .36, .266, .024, .018, frame, 0, .029, 0);
  const socket = cylinder(hardware, .054, .062, edge, 0, .069, 0, 28);
  const ball=mesh(hardware,new THREE.SphereGeometry(.033,20,12),steel,0,.088,0);
  ball.name='Fixed pivot bearing';
  for (const x of [-.132, .132]) {
    for (const z of [-.085, .085]) bolt(hardware,x,.056,z,'y');
  }
  const rod = bar(parent, .015, steel, 20);
  const grip = new THREE.Group();
  parent.add(grip);
  cylinder(grip, .028, .193, edge, 0, -.042, 0,24);
  cylinder(grip, .025, .111, bright, 0, .027, 0,24);
  for(let n=-4;n<=4;n++) cylinder(grip,.0256,.002,steel,0,n*.009,0,24);
  cylinder(grip, .017, .015, rubber, 0, .087, 0,22);
  const weights = new THREE.Group();
  weights.name='Slotted training plate';
  parent.add(weights);
  const plate=new THREE.Shape();
  plate.absarc(0,0,.107,0,Math.PI*2,false);
  const bore=new THREE.Path();
  bore.absarc(0,0,.023,0,Math.PI*2,true);
  plate.holes.push(bore);
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3;
    const gripHole=new THREE.Path();
    gripHole.absellipse(Math.cos(a)*.073,Math.sin(a)*.073,.014,.025,0,Math.PI*2,true,a);
    plate.holes.push(gripHole);
  }
  const disk=mesh(weights,new THREE.ExtrudeGeometry(plate,{depth:.033,bevelEnabled:true,
    bevelThickness:.003,bevelSize:.0027,bevelSegments:2,curveSegments:28}),rubber,0,.004,0);
  disk.rotateX(-Math.PI/2);
  collar(weights,.097,.003,edge,0,.038,0).rotateX(-Math.PI/2);
  collar(weights,.024,.004,steel,0,.040,0).rotateX(-Math.PI/2);
  cylinder(weights,.031,.011,accent,0,.054,0,20);
  return { hardware, socket, rod, grip, weights };
}

function createResistanceBand(group, anchor) {
  const foot = box(group, .23, .047, .21, rubber, anchor.x, .024, anchor.z);
  const column = box(group, .064, anchor.y, .066, frame, anchor.x, anchor.y / 2, anchor.z);
  const eye = cylinder(group, .029, .065, steel, anchor.x, anchor.y, anchor.z);
  eye.rotateZ(Math.PI / 2);
  const strands = Array.from({length: 2}, () => bar(group, .007, matTop, 12));
  column.castShadow = foot.castShadow = true;
  return (band) => {
    const end = world(band.end);
    const start = world(band.anchor);
    const gap = new THREE.Vector3(0, .012, 0);
    for (const [index, strand] of strands.entries()) {
      const offset = gap.clone().multiplyScalar(index === 0 ? 1 : -1);
      connect(strand, start.clone().add(offset), end.clone().add(offset));
    }
  };
}

export function createEquipment(options, sample) {
  const {bells = 0, cableCount = 0, rope = false, mat = false, step = false, band: hasBand = false, landmine: hasLandmine = false} = options;
  const group = new THREE.Group();
  group.name = 'Original Spotter exercise equipment';
  const dumbbells = Array.from({ length: bells }, () => createDumbbell(group));
  const lines = createCableHandles(group, cableCount, rope, cableCount === 1);
  const towers = new Map();
  const baseLengths = cableCount ? restingLengths(sample) : new Map();
  const ropeMain = rope ? bar(group, .004, cableMaterial, 10) : null;
  const ropeClip = rope ? bar(group, .012, steel) : null;
  const landmine = hasLandmine ? createLandmine(group) : null;
  if (mat) createMat(group);
  if (step) createStep(group);
  const updateBand = hasBand ? createResistanceBand(group, sample(0).band.anchor) : null;

  function update(pose) {
    const activeDumbbells = pose.dumbbells ?? [];
    dumbbells.forEach((bell, index) => {
      const source = activeDumbbells[index];
      bell.visible = Boolean(source);
      if (source) aligned(bell, world(source.center), world(source.axis));
    });

    const cables = pose.cables ?? [];
    const ropeEnds = cables.filter((cable) => cable.kind === 'rope');
    let junction;
    if (ropeMain && ropeClip) {
      ropeMain.visible = ropeClip.visible = Boolean(ropeEnds.length);
      if (ropeEnds.length) {
        const anchor = world(ropeEnds[0].anchor);
        junction=ropeEnds.length>1?junctionFor(pose,ropeEnds):anchor;
        const pullDirection = anchor.clone().sub(junction).normalize();
        connect(ropeMain, anchor, junction);
        connect(ropeClip, junction.clone().addScaledVector(pullDirection, -.022), junction.clone().addScaledVector(pullDirection, .023));
      }
    }
    lines.forEach((line, index) => {
      const cable = cables[index];
      if (!cable) { line.line.visible=line.handle.visible=false; return; }
      const anchor = world(cable.anchor);
      const key = anchorKey(cable);
      if (!towers.has(key)) towers.set(key, createCableTower(group, anchor));
      const length=updateCable(line,cable,junction);
      // Each depth traveled beyond cable slack raises one stack by the same amount.
      towers.get(key).move(length-(baseLengths.get(key)??length));
    });

    if (updateBand) updateBand(pose.band);

    if (landmine && pose.landmine) {
      const pivot = world(pose.landmine.pivot);
      const end = world(pose.landmine.end);
      const axis = end.clone().sub(pivot).normalize();
      const forward = end.clone().addScaledVector(axis, .108);
      landmine.hardware.position.set(pivot.x, 0, pivot.z);
      landmine.socket.position.y = pivot.y;
      connect(landmine.rod, pivot, forward);
      aligned(landmine.grip, end, axis);
      aligned(landmine.weights, end.clone().addScaledVector(axis, -.156), axis);
    }
  }
  return { group, update };
}
