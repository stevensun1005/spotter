import * as THREE from 'three';
import { buildCardio } from './cardio-props.js';
import { buildCatalogueSmallProp } from './catalogue-small-props.js';
import { buildSledProps } from './sled-props.js';
import { buildRopeProps } from './rope-props.js';
import { buildLeverPressProps } from './lever-press-props.js';
import { buildAssistedExercise } from './assisted-exercise-props.js';
import { buildSeatedErgometer } from './seated-ergometer-props.js';
import { buildLeverPull } from './lever-pull-props.js';
import { buildBodyweightProps } from './bodyweight-props.js';
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

function createFlatBench(group) {
  const center = .98;
  roundSlab(group, .42, .92, .064, .033, rubber, .10, .396, center);
  box(group, .28, .031, .73, edge, .10, .381, center);
  for (const depth of [-.31, .31]) {
    const z = center + depth;
    box(group, .069, .35, .084, frame, .10, .202, z);
    box(group, .54, .040, .081, frame, .10, .032, z);
    for (const x of [-.139, .339]) box(group, .083, .026, .102, rubber, x, .016, z);
  }
}

function createInclinePressBench(group, rack = true) {
  const pad = box(group, .467, .069, .807, rubber, 0, .695, -.04, .027);
  pad.rotation.x = Math.PI / 4;
  const rail = box(group, .091, .054, .795, edge, 0, .643, -.061, .008);
  rail.rotation.x = Math.PI / 4;
  roundSlab(group, .425, .284, .062, .022, rubber, 0, .437, .327);
  for (const z of [-.48, .34]) {
    box(group, .623, .063, .097, edge, 0, .038, z);
    const height = z < 0 ? .72 : .38;
    box(group, .076, height, .085, frame, 0, height / 2 + .034, z);
    for (const x of [-.269, .269]) box(group, .111, .022, .116, rubber, x, .016, z);
  }
  if (rack) for (const x of [-.60, .60]) {
    box(group, .069, 1.33, .077, frame, x, .685, -.46);
    box(group, .149, .064, .56, edge, x, .039, -.40);
    for (let y = .84; y <= 1.29; y += .082) bolt(group, x, y, -.411);
    box(group, .075, .036, .095, edge, x, 1.237, -.396);
  }
}

function createAdjustableDumbbellBench(group, setting) {
  const incline = setting === 'upright';
  const padLength = incline ? .755 : .915;
  const tilt = incline ? 1.34 : -.268;
  const pivotY = incline ? .493 : .729;
  const pivotZ = incline ? .178 : .265;
  const padY = pivotY + .5 * padLength * Math.sin(tilt);
  const padZ = pivotZ - .5 * padLength * Math.cos(tilt);
  box(group, .431, .063, padLength, rubber, 0, padY, padZ, .023).rotation.x = tilt;
  box(group, .087, .054, padLength * .85, edge, 0, padY - .042, padZ, .011).rotation.x = tilt;
  roundSlab(group, .414, .302, .059, .025, rubber, 0, pivotY - .055, pivotZ + .154);
  box(group, .084, .084, .933, frame, 0, .169, .034);
  for (const z of [-.383, .461]) {
    box(group, .575, .059, .097, edge, 0, .038, z);
    for (const x of [-.239, .239]) box(group, .112, .028, .112, rubber, x, .017, z);
  }
  connect(bar(group, .033, frame), world([0, .176, .419]), world([0, pivotY - .074, pivotZ]));
  const rearY = Math.min(padY - .060, .62);
  connect(bar(group, .029, edge), world([0, .165, -.370]), world([0, rearY, padZ]));
  if (!incline) {
    connect(bar(group, .031, frame), world([0, .362, .408]), world([0, .654, .687]));
    for (const [y, z, spacing] of [[.667, .671, .350], [.494, .803, .327]]) {
      cylinder(group, .023, .550, frame, 0, y, z).rotateZ(Math.PI / 2);
      for (const x of [-spacing / 2, spacing / 2]) {
        cylinder(group, .073, .144, rubber, x, y, z).rotateZ(Math.PI / 2);
      }
    }
  }
}

function createPreacherBench(group) {
  box(group, .525, .068, .435, rubber, 0, .774, .233, .024).rotation.x = Math.PI / 4;
  box(group, .412, .046, .348, edge, 0, .719, .237).rotation.x = Math.PI / 4;
  roundSlab(group, .407, .336, .062, .031, rubber, 0, .413, -.059);
  for (const [z, height] of [[-.115, .406], [.333, .663]]) {
    box(group, .091, height, .095, frame, 0, height / 2 + .037, z);
    box(group, .581, .058, .084, edge, 0, .035, z);
    for (const x of [-.252, .252]) box(group, .101, .023, .112, rubber, x, .014, z);
  }
  box(group, .082, .074, .590, frame, 0, .128, .112);
  for (const x of [-.25, .25]) bolt(group, x, .685, .347);
}

function createArmBlaster(group) {
  const plate = new THREE.Group();
  plate.name = 'Arm blaster curl support';
  group.add(plate);
  box(plate, .412, .092, .042, edge, 0, 0, 0, .022);
  for (const x of [-.245, .245]) {
    box(plate, .131, .088, .046, rubber, x, -.006, -.018, .023);
    box(plate, .028, .449, .014, accent, x * .54, .204, -.042, .007)
      .rotation.z = -Math.sign(x) * .17;
  }
  return (pose) => plate.position.copy(world(pose.chest)).add(new THREE.Vector3(0, -.041, .134));
}

function createBarbell(parent) {
  const group = new THREE.Group();
  parent.add(group);
  cylinder(group, .0132, 2.14, steel, 0, 0, 0, 26);
  for (const side of [-1, 1]) {
    cylinder(group, .021, .421, bright, 0, side*.849, 0, 28);
    cylinder(group, .030, .041, edge, 0, side*.648, 0, 28);
    for (let index=0; index<16; index++) {
      cylinder(group, .0136, .0019, edge, 0, side*(.231+index*.010), 18);
    }
    const y = side*.704;
    cylinder(group, .197, .055, rubber, 0, y, 0, 40);
    for (const face of [-1, 1]) {
      cylinder(group, .168, .004, edge, 0, y+face*.029, 0, 42);
      cylinder(group, .037, .007, bright, 0, y+face*.033, 0, 28);
    }
    cylinder(group, .028, .052, accent, 0, side*.758, 0, 18);
  }
  return group;
}

function createEZBar(parent) {
  const group = new THREE.Group();
  group.name = 'EZ curl bar';
  parent.add(group);
  const bends = [[0,-.565,0], [0,-.313,0], [-.034,-.249,0], [0,-.173,0], [0,-.092,0],
    [.026,0,0], [0,.092,0], [0,.173,0], [-.034,.249,0], [0,.313,0], [0,.565,0]];
  for (const [index, bend] of bends.slice(0, -1).entries()) {
    connect(bar(group, .013, steel, 18), world(bend), world(bends[index + 1]));
  }
  for (const y of [-.417, .417]) {
    cylinder(group, .087, .047, rubber, 0, y, 0, 28);
    cylinder(group, .027, .072, edge, 0, y, 0, 18);
  }
  return group;
}

function createTrapBar(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const rim = [
    [-.557,0,0],[-.354,0,-.287],[.354,0,-.287],[.557,0,0],[.354,0,.287],[-.354,0,.287],
  ];
  for (const [index, start] of rim.entries()) {
    connect(bar(group,.019,edge,20),world(start),world(rim[(index+1)%rim.length]));
  }
  for (const side of [-1,1]) {
    for (const z of [-.092,.092]) box(group,.049,.085,.044,steel,side*.315,.042,z);
    cylinder(group,.017,.253,rubber,side*.315,.084,0,20).rotateX(Math.PI/2);
    cylinder(group,.028,.423,steel,side*.753,0,0,26).rotateZ(Math.PI/2);
    cylinder(group,.194,.097,rubber,side*.723,0,0,36).rotateZ(Math.PI/2);
    cylinder(group,.171,.004,edge,side*.774,0,0,38).rotateZ(Math.PI/2);
    cylinder(group,.039,.019,steel,side*.778,0,0,24).rotateZ(Math.PI/2);
  }
  return group;
}

function createStretchBand(group, initial, highMount) {
  const nodes = initial.bandPath;
  const segments = Array.from({length:nodes.length-1},()=>bar(group,.009,accent,14));
  const joints = nodes.slice(1,-1).map(()=>mesh(group,new THREE.SphereGeometry(.009,12,8),accent));
  if (highMount) {
    const [x,y,z]=nodes[1];
    roundSlab(group,.38,.37,.041,.031,rubber,x,.001,z);
    box(group,.077,y,.076,frame,x,y/2,z,.009);
    cylinder(group,.028,.079,steel,x,y,z,20).rotateZ(Math.PI/2);
  }
  return (points) => {
    const knots = points.map(world);
    segments.forEach((strand, index) => connect(strand,knots[index],knots[index+1]));
    joints.forEach((joint,index) => joint.position.copy(knots[index+1]));
  };
}

function createChestSupportBench(group) {
  const pad = box(group, .435, .069, .782, rubber, 0, .697, -.069, .026);
  pad.rotation.x = Math.PI / 4;
  const rail = box(group, .094, .042, .715, edge, 0, .648, -.110);
  rail.rotation.x = Math.PI / 4;
  for (const z of [-.357, .401]) {
    box(group, .565, .047, .085, frame, 0, .031, z);
    for (const x of [-.25, .25]) roundSlab(group, .108, .119, .019, .013, rubber, x, .001, z);
  }
  box(group, .087, .752, .087, frame, 0, .410, -.357);
  box(group, .087, .358, .087, frame, 0, .214, .401);
  box(group, .073, .081, .751, edge, 0, .113, .014);
  const seat = box(group, .397, .060, .259, rubber, 0, .405, .339, .021);
  seat.rotation.x = -.10;
  bolt(group, .048, .410, -.317);
  bolt(group, -.049, .267, .440);
}

function createCatalogueCableTower(group, anchor, support) {
  if (support !== 'lat' || Math.abs(anchor.x) > .48) return createCableTower(group, anchor);
  const machine = anchor.clone();
  machine.z += .66;
  const tower = createCableTower(group, machine);
  const boom = bar(group, .038, frame);
  connect(boom, machine.clone().add(new THREE.Vector3(0, .028, 0)), anchor.clone().add(new THREE.Vector3(0, .028, 0)));
  const pulley = cylinder(group, .044, .055, edge, anchor.x, anchor.y + .013, anchor.z);
  pulley.rotateZ(Math.PI / 2);
  bolt(group, anchor.x + .028, anchor.y + .013, anchor.z, 'x');
  box(group, .084, .051, .93, frame, anchor.x, .066, machine.z - .39, .010);
  return tower;
}

function createCatalogueCableSupport(group, support) {
  const bench = (height, z, width = .39, depth = .35, tilt = 0) => {
    const pad = roundSlab(group, width, depth, .054, .028, rubber, 0, height - .054, z);
    pad.rotation.x += tilt;
    box(group, .16, .033, depth * .78, frame, 0, height - .062, z);
    box(group, .071, height - .11, .086, frame, 0, (height - .06) / 2, z);
    box(group, .51, .046, .12, edge, 0, .027, z);
    for (const x of [-.236,.236]) box(group, .09, .022, .145, rubber, x, .012, z);
  };
  if (support === 'lat') {
    bench(.475, -.032);
    box(group, .068, .592, .076, frame, 0, .315, .463, .012);
    box(group, .077, .067, .197, edge, 0, .623, .396);
    for (const x of [-.141,.141]) {
      const pad = cylinder(group, .061, .191, rubber, x, .614, .315, 24);
      pad.rotateZ(Math.PI / 2);
      cylinder(group, .039, .023, steel, x * 1.74, .614, .315, 20).rotateZ(Math.PI / 2);
    }
  } else if (support === 'row' || support === 'high-row' || support === 'decline-row' || support === 'floor-row') {
    const high = support === 'high-row';
    const floor = support === 'floor-row';
    const height = high ? .56 : .34;
    const z = floor ? .91 : .66;
    if (!floor) bench(height, -.02, .37, .60, support === 'decline-row' ? .18 : 0);
    box(group, .091, .071, floor ? .62 : 1.13, frame, 0, .045, floor ? .83 : .388);
    for (const x of [-.15,.15]) {
      box(group, .163, .033, .253, edge, x, high ? .213 : .126, z, .006).rotation.x = -.83;
      box(group, .145, .018, .242, rubber, x, high ? .201 : .115, z - .013, .008).rotation.x = -.83;
      box(group, .062, high ? .19 : .11, .062, frame, x, high ? .104 : .072, z + .060);
    }
  } else if (support === 'seat') {
    bench(.475, -.03);
  } else if (support === 'preacher' || support === 'standing-preacher') {
    const standing = support === 'standing-preacher';
    if (!standing) bench(.475, -.075);
    const y = standing ? 1.094 : .847;
    const z = standing ? .287 : .244;
    box(group, .405, .067, .321, rubber, 0, y, z, .021).rotation.x = .87;
    box(group, .079, y - .13, .091, frame, 0, (y - .07) / 2, z + .064);
    box(group, .54, .056, .16, edge, 0, .030, z + .065);
    for (const h of [y - .18, y - .26, y - .34]) bolt(group, 0, h, z + .116);
  } else if (support === 'flat') {
    box(group, .399, .069, 1.174, rubber, 0, .428, -.134, .024);
    for (const z of [-.59,.305]) {
      box(group, .065, .344, .079, frame, 0, .212, z);
      box(group, .50, .045, .090, frame, 0, .030, z);
    }
  } else if (support === 'incline' || support === 'decline' || support === 'chest-incline') {
    const chest = support === 'chest-incline';
    const decline = support === 'decline';
    const height = decline ? .408 : chest ? .748 : .678;
    const z = chest ? .249 : -.142;
    const back = box(group, .407, .064, .756, rubber, 0, height, z, .024);
    back.rotation.x = chest || decline ? -.685 : .685;
    bench(decline ? .545 : .475, chest ? -.087 : .254, .39, .316);
    box(group, .075, height - .065, .09, frame, 0, (height - .018) / 2, z);
    box(group, .484, .043, .086, frame, 0, .027, z);
  } else if (support === 'step') {
    box(group, .305, .116, .162, rubber, 0, .058, .06, .014);
    box(group, .325, .012, .173, edge, 0, .121, .06, .012);
  }
}

function createPulldownBar(group, sample, catalogueCable) {
  const source = sample(0).cables[0];
  const anchor = world(source.anchor);
  const tower = createCatalogueCableTower(group, anchor, catalogueCable?.support);
  const grip = new THREE.Group();
  group.add(grip);
  const attachment = catalogueCable?.attachment;
  if (attachment === 'v') {
    strap(grip, [[-.116, 0, .082], [-.116, 0, -.078], [0, .125, -.078], [.116, 0, -.078], [.116, 0, .082]], .016, steel);
    for (const x of [-.116,.116]) cylinder(grip, .020, .137, rubber, x, 0, .009, 18).rotateX(Math.PI / 2);
    collar(grip, .014, .004, steel, 0, .132, -.078);
  } else if (attachment === 'pressV') {
    strap(grip, [[-.206,-.068,0],[0,.011,0],[.206,-.068,0]], .016, steel);
    for (const sign of [-1,1]) {
      cylinder(grip, .021, .110, rubber, sign*.147, -.046, 0, 18).rotateZ(Math.PI/2-sign*.365);
    }
  } else {
    const half = attachment === 'wide' ? .448 : attachment === 'pro' ? .369 : attachment === 'narrow' ? .176
      : attachment === 'medium' ? .264 : .325;
    const gripY = attachment === 'wide' ? -.046 : attachment === 'pro' ? -.023 : 0;
    if (gripY) {
      const shoulder = half - .115;
      strap(grip, [[-half - .065, gripY, 0], [-half, gripY, 0], [-shoulder, 0, 0], [shoulder, 0, 0], [half, gripY, 0], [half + .065, gripY, 0]], .014, steel);
    } else {
      cylinder(grip, .014, half * 2 + .100, steel, 0, 0, 0).rotateZ(Math.PI / 2);
    }
    for (const direction of [-1,1]) {
      cylinder(grip, .021, .125, rubber, direction * half, gripY, 0, 18).rotateZ(Math.PI / 2);
    }
  }
  cylinder(grip, .023, .046, edge, 0, .016, 0);
  const wire = bar(group, .004, cableMaterial);
  const minimum = Math.min(...Array.from({length: 65}, (_, index) =>
    anchor.distanceTo(world(sample(index / 64).cables[0].end))));
  return (lead) => {
    const center = world(lead.end);
    grip.position.copy(center);
    if (attachment) grip.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), world(lead.grip).normalize());
    const hook = attachment === 'v' ? new THREE.Vector3(0, .131, -.078) : new THREE.Vector3(0, .036, 0);
    connect(wire, anchor, grip.localToWorld(hook));
    tower.move(anchor.distanceTo(center) - minimum);
  };
}

function createProneCurlMachine(group) {
  const hinge = new THREE.Vector3(.358, .596, .663);
  for (const z of [-.435, .398]) {
    box(group, .78, .054, .099, frame, 0, .038, z);
    box(group, .089, .503, .094, frame, .125, .281, z);
    for (const x of [-.36, .36]) {
      roundSlab(group, .12, .136, .017, .011, rubber, x, .001, z);
    }
  }
  box(group, .47, .082, 1.04, frame, 0, .525, .062);
  roundSlab(group, .454, 1.15, .061, .028, rubber, 0, .544, .073);
  for (const x of [-.30, .30]) {
    const handle = bar(group, .022, edge, 20);
    connect(handle, new THREE.Vector3(x, .491, -.385), new THREE.Vector3(x, .491, -.634));
    box(group, .055, .075, .082, frame, x, .517, -.381);
  }
  box(group, .071, .561, .081, edge, hinge.x, .318, hinge.z);
  cylinder(group, .062, .109, steel, hinge.x, hinge.y, hinge.z).rotateZ(Math.PI / 2);
  const rod = bar(group, .027, frame, 18);
  const shaft = bar(group, .017, steel, 20);
  const cushion = cylinder(group, .064, .492, rubber, 0, 0, 0, 30);
  cushion.rotateZ(Math.PI / 2);
  return (roller) => {
    const [y, z] = [roller[1], roller[2]];
    const end = new THREE.Vector3(hinge.x, y, z);
    connect(rod, hinge, end);
    connect(shaft, new THREE.Vector3(-.260, y, z), end);
    cushion.position.set(-.015, y, z);
  };
}

function createStandingCurlMachine(group) {
  const pivot = new THREE.Vector3(.375, .503, .045);
  for (const x of [-.35, .35]) {
    box(group, .089, .041, .731, frame, x, .031, .189);
    box(group, .066, 1.10, .066, frame, x, .574, .345);
    const grip = cylinder(group, .024, .152, rubber, x, 1.127, .235, 20);
    grip.rotateX(Math.PI / 2);
  }
  box(group, .682, .054, .330, rubber, 0, .028, .183);
  box(group, .342, .202, .098, rubber, 0, .651, .153, .018);
  box(group, .074, .499, .091, edge, pivot.x, .269, pivot.z);
  cylinder(group, .051, .084, steel, pivot.x, pivot.y, pivot.z).rotateZ(Math.PI / 2);
  const lever = bar(group, .025, frame, 20);
  const axle = bar(group, .017, steel, 20);
  const cushion = cylinder(group, .061, .211, rubber, 0, 0, 0, 28);
  cushion.rotateZ(Math.PI / 2);
  return ([x, y, z]) => {
    const tip = new THREE.Vector3(pivot.x, y, z);
    connect(lever, pivot, tip);
    connect(axle, tip, new THREE.Vector3(x, y, z));
    cushion.position.set(x, y, z);
  };
}

function createPullUpRack(group, variant) {
  for (const x of [-.70, .70]) {
    roundSlab(group, .23, .87, .045, .031, rubber, x, .001, -.05);
    box(group, .082, 2.29, .075, frame, x, 1.17, -.21);
    for (const y of [.18, .29, 2.10, 2.22]) bolt(group, x, y, -.165);
  }
  box(group, 1.48, .074, .087, edge, 0, 2.266, -.21, .013);
  if (variant !== 'neutral' && variant !== 'narrow-neutral') {
    for (const x of [-.65,.65]) box(group, .047, .049, .334, frame, x, 2.144, -.071);
    cylinder(group,.018,1.34,steel,0,2.144,.097,28).rotateZ(Math.PI/2);
    const gripOffset = variant === 'wide' ? .472 : .305;
    for (const x of [-gripOffset, gripOffset]) cylinder(group,.021,.22,rubber,x,2.144,.097,24).rotateZ(Math.PI/2);
    return;
  }
  const spacing = variant === 'narrow-neutral' ? .102 : .193;
  for (const x of [-spacing, spacing]) {
    box(group, .048, .151, .059, frame, x, 2.24, -.16);
    cylinder(group, .017, .54, steel, x, 2.144, .049, 22).rotateX(Math.PI / 2);
    cylinder(group, .020, .23, rubber, x, 2.144, .097, 22).rotateX(Math.PI / 2);
  }
}

function createBalancePost(group, x = -.51) {
  roundSlab(group, .24, .30, .028, .019, rubber, x, .002, .26);
  box(group, .066, 1.1, .063, frame, x, .56, .26);
  cylinder(group, .022, .275, rubber, x, 1.108, .30).rotateX(Math.PI / 2);
}

function createAnkleCable(group, sample, catalogueCable) {
  const initial = sample(0).cables;
  const anchor = world(initial[0].anchor);
  const tower = createCableTower(group, anchor);
  const leads = initial.map(() => ({
    line: bar(group, .004, cableMaterial, 12),
    cuff: cylinder(group, .052, .071, rubber, 0, 0, 0, 22),
  }));
  const shortest = Math.min(...Array.from({length: 65}, (_, index) =>
    anchor.distanceTo(world(sample(index / 64).cables[0].end))));
  if (catalogueCable?.ankle === 'tuck') createMat(group);
  else createBalancePost(group, catalogueCable?.ankle === 'extension' ? .35 : -.51);
  return (cables) => {
    cables.forEach(({end, grip}, index) => {
      const center = world(end);
      aligned(leads[index].cuff, center, world(grip));
      const delta = anchor.clone().sub(center).normalize();
      connect(leads[index].line, anchor, center.clone().addScaledVector(delta, .048));
    });
    tower.move(anchor.distanceTo(world(cables[0].end)) - shortest);
  };
}

function createStabilityBall(group, radius = .285) {
  const ball = new THREE.Group();
  ball.name = 'Stability ball';
  group.add(ball);
  mesh(ball, new THREE.SphereGeometry(radius, 48, 32), accent);
  for (let index = -4; index <= 4; index++) {
    const y = index * .049 * radius / .285;
    const ring = collar(ball, Math.sqrt(radius ** 2 - y ** 2), .0019, matTop, 0, y, 0);
    ring.rotateX(Math.PI / 2);
  }
  return (center) => {
    ball.position.copy(world(center));
    ball.rotation.x = center[2] / radius;
  };
}

function createNordicAnchor(group) {
  for (const x of [-.31, .31]) {
    box(group, .15, .035, .37, rubber, x, .026, -.40);
    box(group, .056, .139, .066, frame, x, .086, -.27);
  }
  cylinder(group, .059, .59, rubber, 0, .167, -.279, 30).rotateZ(Math.PI / 2);
  cylinder(group, .016, .659, steel, 0, .167, -.279, 22).rotateZ(Math.PI / 2);
}

function createHandRoller(parent) {
  const group = new THREE.Group();
  group.name = 'Handheld textured massage roller';
  parent.add(group);
  for (const y of [-.244, .244]) cylinder(group, .019, .139, rubber, 0, y, 0, 24);
  cylinder(group, .013, .63, steel, 0, 0, 0, 20);
  cylinder(group, .028, .337, accent, 0, 0, 0, 30);
  for (let y = -.162; y <= .162; y += .018) cylinder(group, .033, .007, matTop, 0, y, 0, 30);
  return group;
}

function createResistanceBand(group, anchor, ankleCuff = false) {
  const foot = box(group, .23, .047, .21, rubber, anchor.x, .024, anchor.z);
  const column = box(group, .064, anchor.y, .066, frame, anchor.x, anchor.y / 2, anchor.z);
  const eye = cylinder(group, .029, .065, steel, anchor.x, anchor.y, anchor.z);
  eye.rotateZ(Math.PI / 2);
  const strands = Array.from({length: 2}, () => bar(group, .007, matTop, 12));
  column.castShadow = foot.castShadow = true;
  const cuff = ankleCuff ? cylinder(group, .052, .049, edge, 0, 0, 0) : null;
  return (band) => {
    const end = world(band.end);
    const start = world(band.anchor);
    if (cuff) cuff.position.copy(end);
    const gap = new THREE.Vector3(0, .012, 0);
    for (const [index, strand] of strands.entries()) {
      const offset = gap.clone().multiplyScalar(index === 0 ? 1 : -1);
      connect(strand, start.clone().add(offset), end.clone().add(offset));
    }
  };
}

function createCatalogueKettlebell(parent) {
  const bell = new THREE.Group();
  parent.add(bell);
  const body = mesh(bell,new THREE.SphereGeometry(.083,28,20),edge,0,-.147,0);
  body.scale.set(1,.94,.96);
  cylinder(bell,.056,.020,rubber,0,-.215,0);
  const handle = new THREE.CatmullRomCurve3([
    [-.061,-.115,0],[-.064,-.042,0],[-.046,-.008,0],[-.022,0,0],[.022,0,0],
    [.046,-.008,0],[.064,-.042,0],[.061,-.115,0],
  ].map(world));
  mesh(bell,new THREE.TubeGeometry(handle,28,.014,10,false),rubber);
  mesh(bell,new THREE.TorusGeometry(.035,.003,8,22),steel,0,-.147,.079);
  return bell;
}

function createCatalogueBarbellSupport(group, support, initial) {
  const smith = support.startsWith('smith');
  const flat = support === 'press-pins' || support === 'smith-flat';
  const decline = support.endsWith('decline');
  const incline = support.endsWith('incline');
  const seated = support === 'seat' || support === 'seat-step' ||
    support === 'preacher' || support === 'smith-seat' || support === 'smith-seat-step';
  const centerX = flat || decline ? .1 : 0;
  if (flat) createFlatBench(group);
  if (incline) createInclinePressBench(group, !smith);
  if (decline) {
    const pad = roundSlab(group, .43, 1.04, .066, .026, rubber, .10, .484, .925);
    pad.rotation.x -= .339;
    box(group, .60, .067, .107, frame, .10, .035, .57);
    box(group, .60, .067, .107, frame, .10, .035, 1.28);
    box(group, .07, .36, .08, frame, .10, .22, .57);
    box(group, .07, .56, .08, frame, .10, .32, 1.28);
    for (const y of [.598, .722]) cylinder(group, .05, .56, rubber, .10, y, 1.44).rotation.z = Math.PI / 2;
    box(group, .068, .28, .069, frame, .10, .57, 1.44);
  }
  if (support === 'chest-bench') createChestSupportBench(group);
  if (support === 'onearm-bench') {
    roundSlab(group,.409,.98,.074,.027,rubber,.062,.466,.263);
    for(const z of [-.094,.618]) {
      box(group,.066,.431,.081,frame,.062,.242,z);
      box(group,.52,.054,.092,edge,.062,.032,z);
    }
  }
  if (seated || support === 'smith-box' || support === 'bridge-bench') {
    const z = support === 'smith-box' ? -.25 : support === 'bridge-bench' ? .60 : 0;
    const y = support === 'smith-box' ? .366 : .438;
    roundSlab(group, .46, .39, .067, .024, rubber, 0, y, z);
    box(group, .33, y, .32, frame, 0, y / 2, z);
    box(group, .58, .045, .43, edge, 0, .0225, z);
    if (support === 'preacher') {
      const pad = roundSlab(group, .53, .34, .076, .025, rubber, 0, .83, .41);
      pad.rotation.x += .55;
      box(group, .075, .71, .086, frame, 0, .364, .42);
      box(group, .61, .055, .16, edge, 0, .03, .42);
    }
  }
  if (support.endsWith('rear-bench') || support === 'plyo-box') {
    const boxStep = support === 'plyo-box';
    const height = boxStep ? .332 : .451;
    const z = boxStep ? .515 : -.53;
    roundSlab(group,.54,.38,.064,.030,rubber,0,height-.031,z);
    box(group,boxStep?.489:.16,height-.059,.33,frame,0,(height-.061)/2,z);
    box(group,.63,.042,.45,edge,0,.023,z);
  }
  if (support.endsWith('step')) {
    const z = support.includes('seat') ? .65 : .31;
    roundSlab(group, .60, .32, .12, .025, edge, 0, .06, z);
    roundSlab(group, .59, .29, .015, .02, rubber, 0, .114, z);
  }
  if (smith || support === 'rack' || support.endsWith('pins')) {
    const depth = initial.barbell.center[2];
    const baseY = support === 'press-pins' || support === 'pull-pins' ? initial.barbell.center[1] - .039 : 1.32;
    for (const sign of [-1, 1]) {
      const x = centerX + sign * .622;
      box(group, .072, 2.15, .081, frame, x, 1.08, depth - .12);
      box(group, .215, .055, .79, edge, x, .035, depth);
      if (smith) cylinder(group, .017, 2.11, steel, x, 1.09, depth, 18);
      else box(group, .078, .042, .29, edge, x, baseY, depth);
      for (let y = .39; y < 1.98; y += .135) bolt(group, x, y, depth - .076);
    }
    box(group, 1.30, .065, .075, frame, centerX, 2.17, depth - .12);
  }
}

export function createEquipment(options, sample) {
  const {bells = 0, cableCount = 0, rope = false, mat = false, step = false, lowStep = false, bench = false, chestBench = false, barbell: hasBarbell = false, trapBar: hasTrapBar = false, stretchBand = false, highMount = false, pullUp = false, latBar = false, legCurl = false, band: hasBand = false, ankleCuff = false, landmine: hasLandmine = false,
    inclineBench, ezBar, cableAnkle, standingLegCurl, stabilityBall, nordicAnchor, handRoller, catalogueCable} = options;
  const group = new THREE.Group();
  group.name = 'Original Spotter exercise equipment';
  if (options.barbellSupport) createCatalogueBarbellSupport(group, options.barbellSupport, sample(0));
  const updateCardio = buildCardio(group, options);
  const updateCatalogueSmallProp = buildCatalogueSmallProp(group, options.catalogueSmallProp);
  const updateSled = buildSledProps(group, options.sledProp);
  const updateRope = buildRopeProps(group, options.ropeProp, sample(0));
  const updateLeverPress = buildLeverPressProps(group, options.leverPressProp, sample(0));
  const updateSeatedErgometer = buildSeatedErgometer(group, options.seatedErgometer);
  const updateAssistedExercise = buildAssistedExercise(group, options.assistedExercise, sample);
  const updateLeverPull = buildLeverPull(group, options.leverPull);
  const updateBodyweight = buildBodyweightProps(group, options.bodyweightProp);
  const dumbbells = Array.from({ length: bells }, () => createDumbbell(group));
  const kettlebells = Array.from({ length: options.kettleSupport?.count ?? 0 }, () => createCatalogueKettlebell(group));
  const barbell = hasBarbell ? (ezBar ? createEZBar(group) : createBarbell(group)) : null;
  const trapBar = hasTrapBar ? createTrapBar(group) : null;
  const stretch = stretchBand ? createStretchBand(group,sample(0),highMount) : null;
  const lines = createCableHandles(group, latBar || cableAnkle || catalogueCable?.attachment ? 0 : cableCount, rope, cableCount === 1);
  const towers = new Map();
  const baseLengths = lines.length ? restingLengths(sample) : new Map();
  const ropeMain = rope ? bar(group, .004, cableMaterial, 10) : null;
  const ropeClip = rope ? bar(group, .012, steel) : null;
  const landmine = hasLandmine ? createLandmine(group) : null;
  if (options.stretchSupport === 'adductor-step') {
    roundSlab(group,.47,.32,.064,.025,rubber,-.115,.306,.867);
    box(group,.38,.276,.252,frame,-.115,.138,.867);
    box(group,.56,.047,.389,edge,-.115,.024,.867);
  }
  if (options.stretchSupport === 'situp-anchor') {
    createMat(group);
    box(group,.37,.062,.24,edge,0,.038,.796);
    for (const sign of [-1,1]) cylinder(group,.027,.188,steel,sign*.209,.107,.726);
    cylinder(group,.054,.46,rubber,0,.162,.712).rotateZ(Math.PI/2);
  }
  if (mat || options.kettleSupport?.mat) createMat(group);
  if (options.stabilityBallWall) box(group, 1.54, 1.58, .060, paleMat, 0, .794, -.723, .006);
  if (step) {
    const platform = new THREE.Group();
    platform.scale.y = lowStep ? .4 : 1;
    group.add(platform);
    createStep(platform);
  }
  if (bench || options.bandSupport === 'flat') createFlatBench(group);
  if (options.bandSupport === 'seat' || options.bandSupport === 'post-seat' || options.kettleSupport?.seat) {
    roundSlab(group, .45, .40, .065, .027, rubber, 0, .425, 0);
    box(group, .073, .386, .08, frame, 0, .215, 0);
    box(group, .54, .055, .42, edge, 0, .030, 0);
  }
  if (options.bandSupport === 'post' || options.bandSupport === 'post-seat') {
    const [x, y, z] = sample(0).bandPath[1];
    box(group, .42, .052, .40, edge, x, .032, z);
    box(group, .077, y + .15, .078, frame, x, (y + .15) / 2, z);
    cylinder(group, .029, .069, steel, x, y, z).rotateZ(Math.PI / 2);
  }
  if (chestBench) createChestSupportBench(group);
  if (inclineBench) createInclinePressBench(group);
  const accessory = options.dumbbellAccessory;
  if (accessory === 'incline') createInclinePressBench(group, false);
  if (accessory === 'incline-ball') {
    const support = new THREE.Group();
    support.position.z = -.25;
    group.add(support);
    createInclinePressBench(support, false);
  }
  if (accessory === 'upright' || accessory === 'decline') createAdjustableDumbbellBench(group, accessory);
  if (accessory === 'preacher') createPreacherBench(group);
  if (accessory === 'wrist') {
    roundSlab(group, .38, .34, .055, .029, rubber, .10, .396, 1.780);
    box(group, .081, .37, .081, frame, .10, .203, 1.780);
    box(group, .53, .041, .096, edge, .10, .024, 1.780);
  }
  if (['seat-step', 'step-brace', 'rear-step'].includes(accessory)) {
    const platform = new THREE.Group();
    platform.scale.y = accessory === 'seat-step' ? .35 : .50;
    platform.position.z = accessory === 'seat-step' ? 1.32 : accessory === 'rear-step' ? -1.06 : -.24;
    group.add(platform);
    createStep(platform);
  }
  if (accessory === 'step-brace' || accessory === 'raise-brace') createBalancePost(group);
  if (accessory === 'head-brace') {
    box(group, .082, .92, .084, frame, 0, .48, .655);
    roundSlab(group, .32, .255, .07, .037, rubber, 0, .906, .61);
    roundSlab(group, .46, .32, .06, .037, rubber, 0, .016, .655);
  }
  if (accessory?.startsWith('wall-ball')) box(group, 1.55, 1.97, .067, paleMat, 0, .986, -.653, .006);
  const tennisBall = accessory === 'wall-ball-knees' || accessory === 'wall-ball-ankles'
    ? mesh(group, new THREE.SphereGeometry(.034, 20, 14), material(0xb9bb55, .88)) : null;
  const updateArmBlaster = accessory === 'blaster' || options.barbellSupport === 'arm-blaster' ? createArmBlaster(group) : null;
  if (nordicAnchor) createNordicAnchor(group);
  if (catalogueCable?.support) createCatalogueCableSupport(group, catalogueCable.support);
  if (pullUp) createPullUpRack(group, pullUp);
  const updatePulldownBar = latBar || catalogueCable?.attachment ? createPulldownBar(group, sample, catalogueCable) : null;
  const updateLegCurl = legCurl ? (standingLegCurl ? createStandingCurlMachine(group) : createProneCurlMachine(group)) : null;
  const updateAnkleCable = cableAnkle ? createAnkleCable(group, sample, catalogueCable) : null;
  const updateBall = stabilityBall ? createStabilityBall(group, options.ezBallSupport ? .365 : .285) : null;
  const updateSecondaryBall = options.secondaryBallRadius ? createStabilityBall(group, options.secondaryBallRadius) : null;
  const roller = handRoller && !options.catalogueSmallProp ? createHandRoller(group) : null;
  if (ankleCuff) createBalancePost(group);
  const updateBand = hasBand ? createResistanceBand(group, world(sample(0).band.anchor), ankleCuff) : null;

  function update(pose) {
    updateCardio?.(pose);
    updateCatalogueSmallProp?.(pose);
    updateSled?.(pose);
    updateRope?.(pose);
    updateLeverPress?.(pose);
    updateBodyweight?.(pose);
    updateLeverPull?.(pose.leverPullAngles);
    updateAssistedExercise?.(pose.assistedPadY);
    updateSeatedErgometer?.(pose);
    updateArmBlaster?.(pose);
    if (tennisBall) tennisBall.position.copy(world(pose.tennisBall));
    const activeDumbbells = pose.dumbbells ?? [];
    dumbbells.forEach((bell, index) => {
      const source = activeDumbbells[index];
      bell.visible = Boolean(source);
      if (source) aligned(bell, world(source.center), world(source.axis));
    });

    kettlebells.forEach((bell,index) => {
      const {grip,handle,down} = pose.kettlebells[index];
      bell.position.copy(world(grip));
      const x = world(handle).normalize();
      const y = world(down).negate();
      y.addScaledVector(x, -y.dot(x)).normalize();
      const z = new THREE.Vector3().crossVectors(x,y);
      bell.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
    });

    if (barbell) aligned(barbell, world(pose.barbell.center), world(pose.barbell.axis));
    if (trapBar) {
      trapBar.position.copy(world(pose.barbell.center));
      trapBar.rotation.y = Math.atan2(-pose.barbell.axis[2], pose.barbell.axis[0]);
    }
    if (stretch) stretch(pose.bandPath);

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
      if (!towers.has(key)) towers.set(key, createCatalogueCableTower(group, anchor, catalogueCable?.support));
      const length=updateCable(line,cable,junction);
      // Each depth traveled beyond cable slack raises one stack by the same amount.
      towers.get(key).move(length-(baseLengths.get(key)??length));
    });

    if (updatePulldownBar) updatePulldownBar(cables[0]);
    if (updateLegCurl) updateLegCurl(pose.roller);
    if (updateAnkleCable) updateAnkleCable(cables);
    if (updateBall) updateBall(pose.ballCenter);
    if (updateSecondaryBall) updateSecondaryBall(pose.secondaryBallCenter);
    if (roller) aligned(roller, world(pose.handRoller.center), world(pose.handRoller.axis));
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
