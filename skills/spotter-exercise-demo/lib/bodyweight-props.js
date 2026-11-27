import * as THREE from 'three';

const surface = (color, roughness, metalness = .08) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const steel = surface(0xb9c3ba, .44, .24);
const frame = surface(0x536359, .58);
const rubber = surface(0x292e2c, .82);
const trim = surface(0x9aaa9e, .58);
const floorAxis = new THREE.Vector3(0, 1, 0);
const v = (value) => new THREE.Vector3(...value);

function mesh(group, geometry, material, position) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  group.add(object);
  return object;
}

const box = (group, material, size, position) => mesh(group, new THREE.BoxGeometry(...size), material, position);

function cylinder(group, radius, height, material, position) {
  return mesh(group, new THREE.CylinderGeometry(radius, radius, height, 32), material, position);
}

function strut(group, from, to) {
  const a = v(from);
  const b = v(to);
  const length = a.distanceTo(b);
  const rail = box(group, frame, [.059, length, .067], a.clone().lerp(b, .5).toArray());
  rail.quaternion.setFromUnitVectors(floorAxis, b.sub(a).normalize());
}

function extensionBench(group, incline) {
  const heelY = incline ? .284 : .803;
  const heelZ = incline ? -.588 : -.716;
  const padY = incline ? .729 : .744;
  const padZ = incline ? .015 : .020;
  for (const z of [heelZ, padZ]) {
    box(group, frame, [.684, .052, .136], [0, .041, z]);
    for (const side of [-1, 1]) box(group, rubber, [.126, .025, .154], [side * .283, .020, z]);
  }
  strut(group, [0, .064, heelZ], [0, heelY, heelZ]);
  strut(group, [0, .065, padZ - .29], [0, padY - .068, padZ]);
  strut(group, [0, heelY - .12, heelZ], [0, padY - .095, padZ]);
  for (const side of [-1, 1]) {
    const pad = box(group, rubber, [.199, .089, .315], [side * .118, padY, padZ]);
    pad.rotation.x = incline ? -Math.PI / 4 : 0;
  }
  const axle = cylinder(group, .016, .495, steel, [0, heelY + .038, heelZ - .034]);
  axle.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const roller = cylinder(group, .053, .146, rubber, [side * .129, heelY + .038, heelZ - .034]);
    roller.rotation.z = Math.PI / 2;
    const plate = box(group, trim, [.151, .026, .202], [side * .107, heelY - .102, heelZ + .006]);
    plate.rotation.x = incline ? -Math.PI / 4 : 0;
  }
}

function doorway(group) {
  for (const x of [-.49, .49]) {
    box(group, frame, [.115, 2.13, .167], [x, 1.065, .10]);
    box(group, trim, [.072, 2.03, .013], [x, 1.07, .010]);
    box(group, rubber, [.26, .042, .41], [x, .022, .10]);
  }
  box(group, frame, [1.091, .114, .167], [0, 2.123, .1]);
  box(group, trim, [.935, .051, .013], [0, 2.123, .010]);
}

function solidBox(group) {
  box(group, frame, [.608, .282, .594], [0, .148, .51]);
  box(group, rubber, [.630, .023, .614], [0, .298, .51]);
  for (const side of [-1, 1]) box(group, trim, [.008, .043, .152], [side * .305, .200, .51]);
}

const boxDecks = {
  'gym-box-low':[.210,0,.450,.66,.572],
  'gym-box-standard':[.390,0,.553,.69,.62],
  'gym-box-high':[.590,0,.632,.72,.68],
  'gym-box-side':[.265,.495,.028,.56,.64],
  'gym-box-rear':[.370,0,-.358,.64,.61],
  'gym-step-patrick':[.140,.075,.360,.47,.52],
  'gym-step-peterson':[.202,.075,.352,.47,.54],
  'gym-step-poliquin':[.174,.075,.352,.47,.54],
};

function boxDeck(group,[height,x,z,width,depth]) {
  box(group,frame,[width-.024,height-.023,depth-.024],[x,(height-.023)/2,z]);
  box(group,rubber,[width,.024,depth],[x,height-.012,z]);
  for(const s of [-1,1])box(group,trim,[.010,.023,.138],[x+s*(width-.016)/2,height*.56,z]);
}

function trainingDeck(group,preset) {
  if (boxDecks[preset]) boxDeck(group,boxDecks[preset]);
  if (preset==='gym-box-stairs') {
    boxDeck(group,[.184,0,.266,.72,.36]);
    boxDeck(group,[.365,0,.626,.72,.36]);
  }
  if (preset==='gym-step-chair' || preset==='gym-step-bench') {
    const chair = preset==='gym-step-chair';
    const width=chair?.401:.412, depth=chair?.441:1.094, z=.552, height=chair?.457:.424;
    box(group,rubber,[width,.049,depth],[0,height-.0245,z]);
    for(const x of [-width*.36,width*.36]) for(const dz of [-depth*.37,depth*.37])
      box(group,frame,[.046,height-.049,.043],[x,(height-.049)/2,z+dz]);
    if(chair) {
      for(const x of [-.152,.152])box(group,frame,[.047,.453,.045],[x,.681,z+.187]);
      box(group,rubber,[.40,.229,.047],[0,.791,z+.185]);
    }
  }
}

function flatBench(group, x, y, z, width=.43, depth=1.012) {
  box(group,rubber,[width,.054,depth],[x,y-.027,z]);
  for(const end of [-1,1]) {
    const legZ=z+end*depth*.34;
    strut(group,[x,.046,legZ],[x,y-.043,legZ]);
    box(group,trim,[width+.121,.051,.102],[x,.031,legZ]);
  }
}

function supportChair(group, x, z, turn=1) {
  const deck=.477;
  box(group,rubber,[.418,.051,.413],[x,deck-.0255,z]);
  for(const side of [-1,1]) {
    for(const end of [-1,1])box(group,frame,[.041,deck-.046,.043],
      [x+side*.172,(deck-.046)/2,z+end*.164]);
    box(group,frame,[.044,.418,.042],[x+side*.172,.653,z+.172*turn]);
  }
  box(group,rubber,[.397,.209,.047],[x,.766,z+.172*turn]);
}

function benchArrangements(group, preset) {
  if (preset==='gym-bench-flat') flatBench(group,0,.432,-.342);
  if (preset==='gym-bench-front') flatBench(group,0,.459,.790);
  if (preset==='gym-bench-low') flatBench(group,0,.311,-.455);
  if (preset==='gym-bench-side') flatBench(group,.642,.435,.038);
  if (preset==='gym-bench-squat') flatBench(group,0,.421,-.421,.514,.584);
  if (preset==='gym-chair-front'||preset==='gym-chair-wall') {
    supportChair(group,0,.661);
    if(preset==='gym-chair-wall')box(group,steel,[1.54,1.83,.078],[0,.915,.940]);
  }
  if (preset==='gym-bench-pike'||preset==='gym-bench-pike-decline'||preset==='gym-triple-dip') {
    for(const side of [-1,1]) flatBench(group,side*.428,.411,preset==='gym-triple-dip' ? -.283 : .392,.322,.844);
    if(preset==='gym-bench-pike-decline') flatBench(group,0,.561,-.969,.621,.581);
    if(preset==='gym-triple-dip') flatBench(group,0,.423,.842,.621,.563);
  }
  if (['gym-dip-chairs','gym-pike-chairs','gym-row-chairs','gym-row-chairs-high'].includes(preset)) {
    const row=preset.startsWith('gym-row');
    const high=preset.endsWith('high');
    const z=preset==='gym-pike-chairs'?.492:-.431;
    const spread=row?.523:.445;
    for(const side of [-1,1]) supportChair(group,side*spread,z,row?-1:1);
    if(row){
      const y=high?.888:.497;
      const depth=high?z-.166:z;
      cylinder(group,.025,1.293,steel,[0,y,depth]).rotateZ(Math.PI/2);
      if(high)supportChair(group,0,.971);
    }
  }
}

function backPlate(group) {
  const plate = new THREE.Group();
  group.add(plate);
  cylinder(plate, .203, .034, rubber, [0, 0, 0]);
  cylinder(plate, .197, .013, frame, [0, .019, 0]);
  cylinder(plate, .058, .011, steel, [0, .025, 0]);
  cylinder(plate, .025, .013, rubber, [0, .03, 0]);
  return (pose) => {
    const torso = v(pose.neck).sub(v(pose.hips)).normalize();
    const side = v(pose.ls).sub(v(pose.rs)).normalize();
    const back = torso.cross(side).normalize();
    plate.position.copy(v(pose.chest)).lerp(v(pose.neck), .26).addScaledVector(back, .122);
    plate.quaternion.setFromUnitVectors(floorAxis, back);
  };
}

function assaultBike(group) {
  const wheel = [0, .362, .481];
  const crank = [0, .423, .027];
  for (const z of [-.535, .553]) box(group, rubber, [.723, .050, .080], [0, .030, z]);
  strut(group, [0, .081, -.535], [0, .089, .591]);
  strut(group, [0, .096, -.328], [0, .970, -.262]);
  strut(group, [0, .109, .49], [0, .835, .523]);
  strut(group, [0, .965, -.263], [0, .430, .024]);
  strut(group, [0, .443, .027], [0, .643, .523]);
  box(group, rubber, [.202, .049, .289], [0, .966, -.262]);
  box(group, trim, [.225, .061, .118], [0, .931, .561]).rotation.x = -.31;
  box(group, rubber, [.124, .011, .066], [0, .965, .566]).rotation.x = -.31;
  const fan = new THREE.Group();
  fan.position.set(...wheel);
  group.add(fan);
  for (const side of [-1, 1]) {
    const housing = mesh(group, new THREE.TorusGeometry(.292, .018, 8, 70), steel,
      [side * .109, wheel[1], wheel[2]]);
    housing.rotation.y = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const angle = i * .4 * Math.PI;
      const radial = box(group, frame, [.012, .287, .013],
        [side * .112, wheel[1] + .143 * Math.cos(angle), wheel[2] + .143 * Math.sin(angle)]);
      radial.rotation.x = angle;
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const blade = box(fan, rubber, [.167, .251, .033], [0, .131 * Math.cos(a), .131 * Math.sin(a)]);
    blade.rotation.x = a + .14;
  }
  const pedals = ["l", "r"].map((key, index) => {
    const sign = index === 0 ? 1 : -1;
    const pivot = v([sign * .214, .674, .496]);
    const crankArm = cylinder(group, .019, 1, steel, [0, 0, 0]);
    const lever = cylinder(group, .024, 1, frame, [0, 0, 0]);
    const grip = cylinder(group, .030, .128, rubber, [0, 0, 0]);
    grip.rotateZ(Math.PI / 2);
    const pedal = box(group, rubber, [.113, .023, .145], [0, 0, 0]);
    return {key, sign, pivot, crankArm, lever, grip, pedal};
  });
  const align = (mesh, a, b) => {
    mesh.position.copy(a).lerp(b, .5);
    mesh.scale.y = a.distanceTo(b);
    mesh.quaternion.setFromUnitVectors(floorAxis, b.clone().sub(a).normalize());
  };
  return (pose) => {
    fan.rotation.x = -(pose.machineTravel ?? 0) * Math.PI * 4;
    for (const {key, sign, pivot, crankArm, lever, grip, pedal} of pedals) {
      const hand = v(pose[key + "w"]);
      const ankle = pose[key + "a"];
      const tread = v([sign * .153, ankle[1] - .067, ankle[2] + .068]);
      align(lever, pivot, hand);
      align(crankArm, v([sign * .112, crank[1], crank[2]]), tread);
      grip.position.copy(hand);
      pedal.position.copy(tread);
    }
  };
}

function inclineTreadmill(group) {
  const slope = .145;
  const tilt = -Math.atan(slope);
  const yAt = (z) => .155 + slope * (z + .80);
  const deck = new THREE.Group();
  deck.position.set(0, yAt(0), 0);
  deck.rotation.x = tilt;
  group.add(deck);
  box(deck, frame, [.846, .120, 1.821], [0, -.064, 0]);
  box(deck, rubber, [.725, .021, 1.643], [0, -.009, -.018]);
  box(deck, steel, [.780, .071, .232], [0, .009, .709]);
  for (const sign of [-1, 1]) {
    box(deck, steel, [.048, .023, 1.64], [sign * .401, -.001, 0]);
    strut(group, [sign * .371, .072, .74], [sign * .371, 1.188, .704]);
    strut(group, [sign * .371, 1.187, .704], [sign * .371, 1.181, .201]);
    box(group, rubber, [.070, .051, .309], [sign * .371, 1.184, .404]);
    box(group, frame, [.111, .075, .534], [sign * .279, .047, .552]);
  }
  strut(group, [-.418, 1.183, .706], [.418, 1.183, .706]);
  box(group, frame, [.565, .053, .245], [0, 1.242, .693]).rotation.x = -.49;
  box(group, rubber, [.441, .015, .169], [0, 1.268, .684]).rotation.x = -.49;
  box(group, trim, [.232, .006, .054], [0, 1.280, .699]).rotation.x = -.49;
  const markers = Array.from({length: 12}, () => box(deck, steel, [.037, .001, .007], [.322, .002, 0]));
  return (pose) => {
    for (const [index, marker] of markers.entries()) {
      marker.position.z = .773 - ((index * .13 + (pose.machineTravel ?? 0)) % 1.56);
    }
  };
}

function dipStations(group, preset) {
  const straight = preset === 'straight-dip';
  const cage = preset === 'cage-dips';
  const spacing = straight || cage ? .60 : .266;
  for (const side of [-1, 1]) {
    const x = side * spacing;
    box(group, rubber, [.200, .051, .773], [x, .031, -.071]);
    strut(group, [x, .063, -.21], [x, 1.175, -.21]);
    if (straight) continue;
    const handleX = side * .266;
    if (cage) strut(group, [x, 1.175, -.21], [handleX, 1.175, -.21]);
    const rail = cylinder(group, .024, .642, rubber, [handleX, 1.175, .038]);
    rail.rotation.x = Math.PI / 2;
    if (cage) strut(group, [x, .062, -.320], [x, 2.199, -.320]);
  }
  if (straight) cylinder(group, .024, 1.233, steel, [0, 1.175, -.210]).rotation.z = Math.PI / 2;
  if (cage) cylinder(group, .019, 1.283, steel, [0, 2.155, -.320]).rotation.z = Math.PI / 2;
}

function dipBenches(group, double) {
  const centers = double ? [-.471, .963] : [-.471];
  for (const z of centers) {
    box(group, rubber, [.472, .051, .712], [0, .434, z]);
    for (const offset of [-.242, .242]) {
      strut(group, [0, .047, z + offset], [0, .425, z + offset]);
      box(group, frame, [.542, .046, .110], [0, .032, z + offset]);
    }
  }
}

function underhandRack(group, high) {
  const height = high ? 1.163 : .945;
  for (const side of [-1, 1]) {
    const x = side * .595;
    box(group, rubber, [.228, .042, .754], [x, .029, -.498]);
    strut(group, [x, .052, -.498], [x, height, -.429]);
  }
  cylinder(group, .022, 1.256, steel, [0, height, -.429]).rotation.z = Math.PI / 2;
}

function handstandWall(group,preset) {
  const direction=preset==='handstand-front-wall'?-1:1;
  const tall=preset==='handstand-bench-wall';
  const height=tall?2.57:2.26;
  box(group, steel, [1.097,height,.101], [0,height/2+.008,direction*.563]);
  box(group, frame, [1.098,.060,.105], [0,.032,direction*.562]);
  box(group, frame, [1.098,.060,.105], [0,height-.019,direction*.562]);
  if(tall)for(const sign of [-1,1]){
    const x=sign*.336;
    box(group,rubber,[.263,.061,.619],[x,.428,.198]);
    for(const z of [-.012,.394]){
      strut(group,[x,.052,z],[x,.411,z]);
      box(group,frame,[.290,.044,.106],[x,.028,z]);
    }
  }
}

function dropSteps(group) {
  for (const side of [-1, 1]) {
    box(group, frame, [.269, .093, .292], [side * .386, .053, .448]);
    box(group, rubber, [.282, .023, .306], [side * .386, .107, .448]);
  }
}

function abBench(group, preset) {
  const incline = preset === 'ab-incline';
  const angle = preset === 'ab-steep' ? -.675 : incline ? .459 : -.443;
  const pad = box(group, rubber, [.471, .078, 1.087], [0, .531 - (preset === 'ab-steep' ? .034 : 0), -.096]);
  pad.rotation.x = angle;
  strut(group, [0, .039, -.467], [0, incline ? .648 : .277, -.441]);
  strut(group, [0, .044, .381], [0, incline ? .355 : .715, .322]);
  for (const z of [-.451, .403]) box(group, trim, [.565, .05, .121], [0, .036, z]);
  if (incline) return;
  strut(group, [0, .087, .516], [0, .548, .711]);
  for (const side of [-1, 1]) {
    cylinder(group, .057, .201, rubber, [side * .15, .581, .725]).rotateZ(Math.PI / 2);
    cylinder(group, .059, .196, rubber, [side * .15, .754, .451]).rotateZ(Math.PI / 2);
  }
}

function captainsChair(group) {
  for (const side of [-1, 1]) {
    const x = side * .281;
    box(group, rubber, [.142, .048, .731], [x, .03, -.184]);
    strut(group, [x, .065, -.249], [x, 1.229, -.260]);
    strut(group, [x, 1.146, -.299], [x, 1.146, .241]);
    box(group, rubber, [.134, .058, .282], [x, 1.165, -.101]);
    strut(group, [x, 1.150, .23], [x, 1.274, .225]);
    cylinder(group, .024, .135, rubber, [x, 1.243, .219]).rotateX(Math.PI / 2);
  }
  box(group, rubber, [.412, .361, .072], [0, 1.229, -.279]);
  box(group, trim, [.531, .055, .085], [0, .649, -.244]);
}

function underBench(group) {
  box(group, rubber, [.646, .057, .983], [0, .963, -.926]);
  for (const sign of [-1, 1]) {
    const z = -.907 + sign * .387;
    for (const x of [-.285, .285]) strut(group, [x, .046, z], [x, .94, z]);
    box(group, trim, [.716, .056, .144], [0, .032, z]);
  }
  cylinder(group, .025, .641, steel, [0, .946, -.432]).rotateZ(Math.PI / 2);
}

function balanceBoard(group) {
  const plank = new THREE.Group();
  plank.position.y = .085;
  group.add(plank);
  box(plank, frame, [.574, .048, .354], [0, .020, 0]);
  box(plank, rubber, [.564, .012, .347], [0, .048, 0]);
  const dome = mesh(plank, new THREE.SphereGeometry(.094, 24, 16), steel, [0, -.034, 0]);
  dome.scale.set(1, .58, 1.33);
  return (pose) => { plank.rotation.z = (pose.machineTravel ?? .25) - .25; };
}

function towel(group) {
  const fabric = new THREE.Group();
  group.add(fabric);
  for (let index = 0; index < 5; index++) {
    const item = box(fabric, index % 2 ? trim : steel, [1, .019, .031], [0, -.012, (index - 2) * .026]);
    item.rotation.x = (index - 2) * .127;
  }
  const xAxis = new THREE.Vector3(1, 0, 0);
  return (pose) => {
    const start = v(pose.lw);
    const end = v(pose.rw);
    fabric.position.copy(start).lerp(end, .5);
    fabric.quaternion.setFromUnitVectors(xAxis, start.clone().sub(end).normalize());
    fabric.scale.x = start.distanceTo(end) + .035;
  };
}

function slideDisc(group) {
  const top = cylinder(group, .119, .018, rubber, [0, .010, 0]);
  const chamfer = cylinder(group, .113, .008, trim, [0, .022, 0]);
  return (pose) => {
    top.position.set(pose.la[0], .018, pose.la[2] + .071);
    chamfer.position.copy(top.position).y = .026;
  };
}

function suspension(group, preset) {
  const rings = preset === 'fitness-rings';
  const feet = preset === 'foot-suspension';
  const depth = preset === 'front-suspension' ? .30 : preset === 'press-suspension' ? -.39 : -.425;
  for (const side of [-1, 1]) {
    const x = side * .586;
    box(group, rubber, [.199, .052, .653], [x, .030, depth]);
    strut(group, [x, .054, depth], [x, 2.317, depth]);
  }
  strut(group, [-.623, 2.317, depth], [.623, 2.317, depth]);
  const straps = (feet ? ['l'] : ['l', 'r']).map((side) => {
    const sign = side === 'l' ? 1 : -1;
    const anchor = v([feet ? .128 : sign * (rings ? .272 : .298), 2.292, depth]);
    const strap = box(group, frame, [.025, 1, .009], anchor.toArray());
    const handle = rings ? mesh(group, new THREE.TorusGeometry(.090,.012,10,48), trim, anchor.toArray())
      : mesh(group, new THREE.TorusGeometry(feet ? .064 : .059,.010,9,30), rubber, anchor.toArray());
    if (!rings) handle.scale.set(1.12, feet ? .72 : .83, 1);
    return {side, sign, anchor, strap, handle};
  });
  const upDirection = new THREE.Vector3(0, 1, 0);
  for (const {anchor} of straps) cylinder(group, .022, .064, trim, anchor.toArray());
  return (pose) => {
    for (const {side, sign, anchor, strap, handle} of straps) {
      const end = v(pose[side + (feet ? 'a' : 'w')]);
      if (feet) end.add(new THREE.Vector3(0, -.047, .043));
      const direction = anchor.clone().sub(end).normalize();
      const radius = rings ? .081 : feet ? .036 : .039;
      handle.position.copy(end).addScaledVector(direction, radius);
      handle.quaternion.setFromUnitVectors(upDirection, direction);
      if (rings) handle.rotateY(sign * .21);
      const join = end.clone().addScaledVector(direction, 2 * radius);
      strap.position.copy(join).lerp(anchor, .5);
      strap.scale.y = join.distanceTo(anchor);
      strap.quaternion.setFromUnitVectors(upDirection, direction);
    }
  };
}

export function buildAdjustableSuspension(group, kind, sample) {
  const links = sample(0).straps;
  const [, height, depth] = links[0].anchor;
  const span = Math.max(.86, ...links.map(({ anchor }) => Math.abs(anchor[0]) + .30));
  for (const side of [-1, 1]) {
    const x = side * span;
    box(group, rubber, [.183, .045, .75], [x, .022, depth]);
    strut(group, [x, .047, depth], [x, height + .027, depth]);
  }
  strut(group, [-span, height + .027, depth], [span, height + .027, depth]);
  const rigs = links.map(({ anchor }) => {
    const ring = kind.startsWith('ring');
    const foot = kind.endsWith('foot');
    const sheet = kind === 'sheet';
    const loop = ring || foot;
    const radius = ring ? .086 : foot ? .059 : .061;
    const strap = box(group, sheet ? rubber : frame, [sheet ? .073 : .029, 1, sheet ? .015 : .008], anchor);
    cylinder(group, .020, .053, trim, anchor);
    const grip = new THREE.Group();
    group.add(grip);
    if(sheet){
      box(grip,frame,[.096,.135,.033],[0,-.024,0]);
      box(grip,rubber,[.083,.146,.032],[0,-.115,.014]);
    }else if (loop) {
      const band = mesh(grip, new THREE.TorusGeometry(radius, .011, 10, 39), rubber, [0,radius,0]);
      if (foot) band.scale.set(1.18, .82, 1);
    } else {
      for (const sign of [-1, 1]) strut(grip, [sign * .073,0,0], [0,.118,0]);
      const shaft = cylinder(grip, .018, .157, rubber, [0,0,0]);
      shaft.rotation.z = Math.PI / 2;
    }
    return { strap, grip, joint: sheet ? .044 : loop ? 2 * radius : .118 };
  });
  return ({ straps }) => {
    for (const [index,{ anchor, end, axis }] of straps.entries()) {
      const { strap, grip, joint } = rigs[index];
      const top = v(anchor);
      const base = v(end);
      const up = top.clone().sub(base).normalize();
      const start = base.clone().addScaledVector(up,joint);
      grip.position.copy(base);
      const alignment = new THREE.Quaternion().setFromUnitVectors(floorAxis,up);
      const x = v(axis).addScaledVector(up, -v(axis).dot(up)).normalize();
      grip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, x.clone().cross(up)));
      strap.quaternion.copy(alignment);
      strap.position.copy(start).lerp(top,.5);
      strap.scale.y = start.distanceTo(top);
    }
  };
}

export function buildBodyweightProps(group, preset) {
  if (preset?.startsWith('gym-')) {
    trainingDeck(group,preset);
    benchArrangements(group,preset);
  }
  if (preset === 'extension-45' || preset === 'extension-flat') extensionBench(group, preset === 'extension-45');
  if (preset === 'doorway') doorway(group);
  if (preset === 'conditioning-line') box(group, trim, [.03,.004,1.92], [0,.004,.015]);
  if (preset === 'conditioning-cones') {
    const cone = surface(0xc29e68,.78);
    for (const x of [-.436,.436]) {
      box(group,rubber,[.20,.033,.20],[x,.018,0]);
      mesh(group,new THREE.ConeGeometry(.070,.227,20),cone,[x,.137,0]);
      cylinder(group,.052,.034,steel,[x,.123,0]);
    }
  }
  if (preset === 'conditioning-chair') {
    box(group,rubber,[.415,.050,.354],[0,.452,-.051]);
    for(const x of [-.168,.168]){
      for(const z of [-.194,.094])box(group,frame,[.042,.456,.040],[x,.228,z]);
      box(group,frame,[.043,.435,.037],[x,.645,-.194]);
    }
    box(group,rubber,[.389,.244,.044],[0,.773,-.194]);
  }
  if (preset === 'conditioning-water') {
    const water = new THREE.MeshStandardMaterial({color:0x86b5ad,transparent:true,opacity:.34,roughness:.40,
      metalness:.11,depthWrite:false});
    box(group,trim,[2.18,.048,1.72],[0,.015,0]);
    box(group,water,[2.10,.015,1.63],[0,.958,0]);
    for(const x of [-1.091,1.091])box(group,steel,[.039,.059,1.72],[x,.944,0]);
    for(const z of [-.859,.859])box(group,steel,[2.21,.059,.039],[0,.944,z]);
  }
  if (preset === 'ab-decline' || preset === 'ab-steep' || preset === 'ab-incline') abBench(group, preset);
  if (preset === 'captains-chair') captainsChair(group);
  if (preset === 'under-bench') underBench(group);
  if (preset === 'balance-board') return balanceBoard(group);
  if (preset === 'training-towel') return towel(group);
  if (preset === 'slide-disc') return slideDisc(group);
  if (preset === 'fitness-rings' || preset?.endsWith('-suspension')) return suspension(group, preset);
  if (['handstand-wall','handstand-front-wall','handstand-bench-wall'].includes(preset)) handstandWall(group,preset);
  if (preset === 'drop-steps') dropSteps(group);
  if (preset === 'plyo-box') solidBox(group);
  if (preset === 'push-up-handles') {
    for (const side of [-1, 1]) {
      const x=side*.225;
      box(group,rubber,[.141,.036,.307],[x,.023,.520]);
      for(const z of [.406,.634])strut(group,[x,.039,z],[x,.176,z]);
      const grip=cylinder(group,.021,.264,rubber,[x,.176,.520]);
      grip.rotation.x=Math.PI/2;
    }
  }
  if (preset === 'back-plate') return backPlate(group);
  if (preset === 'parallel-dips' || preset === 'cage-dips' || preset === 'straight-dip') dipStations(group, preset);
  if (preset === 'dip-bench' || preset === 'double-dip-bench') dipBenches(group, preset === 'double-dip-bench');
  if (preset === 'inverted-row' || preset === 'inverted-high-row') underhandRack(group, preset === 'inverted-high-row');
  if (preset === 'assault-bike') return assaultBike(group);
  if (preset === 'incline-treadmill') return inclineTreadmill(group);
}
