import * as T from 'three';
import anatomy from './human.json';

const vec = a => new T.Vector3(...a);
const mid = (a,b) => a.clone().lerp(b,.5);
const lateral = new T.Vector3(1,0,0);
const axes = [lateral, new T.Vector3(0,0,1), new T.Vector3(0,1,0)];

function frame(start, finish, hint, stretch = 1, width = 1) {
  const y = finish.clone().sub(start).normalize();
  let x = hint.clone().addScaledVector(y, -hint.dot(y));
  if (x.lengthSq() < .00001) {
    const candidate = axes.find(a => Math.abs(y.dot(a)) < .7);
    x = candidate.clone().addScaledVector(y, -candidate.dot(y));
  }
  x.normalize();
  const z = x.clone().cross(y);
  return new T.Matrix4().makeBasis(x.multiplyScalar(width), y.multiplyScalar(stretch), z).setPosition(start);
}

function elbowFor(shoulder,wrist,authored,upper,forearm) {
  const forward=wrist.clone().sub(shoulder);
  const reach=Math.max(.001,forward.length());
  forward.multiplyScalar(1/reach);
  const lower=Math.max(forearm,reach-upper+.001);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  const pole=authored.clone().sub(shoulder);
  pole.addScaledVector(forward,-pole.dot(forward));
  if(pole.lengthSq()<.000001){
    const axis=axes.find(item=>Math.abs(forward.dot(item))<.72);
    pole.copy(axis).addScaledVector(forward,-axis.dot(forward));
  }
  return shoulder.clone().addScaledVector(forward,along).addScaledVector(pole.normalize(),bend);
}

function contactSpot(a, center, radius) {
  const t = Math.min(1, Math.abs(a-center) / radius);
  return 1 - t*t*(3-2*t);
}

const highlights = {
  lat:[.133,1.248,-.099,.075,.216,.101],
  quad:[.13,.705,.081,.066,.157,.081],
  glute:[.115,.905,-.106,.093,.11,.089],
  pec:[.102,1.319,.093,.093,.106,.082],
  core:[.104,1.11,.061,.080,.166,.105],
  shoulder:[.201,1.384,.025,.076,.080,.085],
  rearShoulder:[.199,1.371,-.029,.092,.073,.072],
  forearm:[.427,1.125,.135,.081,.077,.112],
  biceps:[.303,1.281,.099,.082,.089,.073],
  triceps:[.261,1.294,-.016,.078,.096,.072],
  trap:[.129,1.407,-.056,.099,.083,.062],
  calf:[.106,.327,-.058,.071,.129,.064],
  hamstring:[.127,.681,-.057,.071,.154,.072],
  adductor:[.061,.728,.021,.043,.164,.085],
  shin:[.106,.320,.055,.052,.145,.063],
  neck:[.046,1.496,.008,.043,.088,.069],
};
const pale = new T.Color(0xd6d8d3), shorts = new T.Color(0x373d3c);
const shoe = new T.Color(0x33393a), tint = new T.Color(0xba5345);

function skinColor(x,y,z,muscles,female) {
  if (y < .115) return shoe;
  const absoluteX=Math.abs(x);
  const dressed = y > .562 + Math.min(.09,absoluteX*.33) && y < 1.015 && absoluteX < .258;
  const top=female&&y>1.184&&y<1.388+Math.max(0,.13-absoluteX)*.51&&absoluteX<.199;
  const result=(dressed||top?shorts:pale).clone();
  let amount=0;
  for (const key of muscles) {
    if (key.startsWith('l:') && x<0 || key.startsWith('r:') && x>0) continue;
    const [cx,cy,cz,rx,ry,rz]=highlights[key.split(':').at(-1)];
    amount=Math.max(amount,contactSpot(absoluteX,cx,rx)*contactSpot(y,cy,ry)*contactSpot(z,cz,rz));
  }
  return result.lerp(tint,amount*(dressed?.79:.91));
}

export function createSkinnedAvatar(female=false) {
  const group = new T.Group();
  const meshData = new T.BufferGeometry();
  const positions=female?new Float32Array(anatomy.positions):anatomy.positions;
  if(female)for(let i=0;i<positions.length;i+=3){
    const [x,y,z]=anatomy.positions.slice(i,i+3);
    const torso=1-T.MathUtils.smoothstep(Math.abs(x),.143,.226);
    const midWaist=contactSpot(y,1.103,.254);
    const hipShape=contactSpot(y,.891,.296);
    positions[i]=x*(1+torso*(.12*hipShape-.22*midWaist));
    if(z>.035)positions[i+2]=z+.034*contactSpot(y,1.315,.119)*contactSpot(Math.abs(x),.093,.129);
  }
  meshData.setAttribute('position', new T.Float32BufferAttribute(positions,3));
  meshData.setAttribute('skinIndex', new T.Uint16BufferAttribute(anatomy.skinIndices,4));
  meshData.setAttribute('skinWeight', new T.Float32BufferAttribute(anatomy.skinWeights,4));
  meshData.setIndex(anatomy.indices);
  meshData.computeVertexNormals();
  const colorData = new T.Float32BufferAttribute(new Float32Array(anatomy.positions.length),3);
  meshData.setAttribute('color', colorData);
  const material = new T.MeshStandardMaterial({
    roughness:.72, metalness:.02, vertexColors:true, color:0xffffff,
  });
  const mesh = new T.SkinnedMesh(meshData,material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const rest = new Map(anatomy.bones.map(raw => {
    const bone = new T.Bone();
    bone.name = raw.name;
    bone.matrixAutoUpdate = false;
    // All joint transforms below are global. Bind globals are identity for each joint.
    mesh.add(bone);
    return [raw.name, { bone, parent:raw.parent, head:vec(raw.head), tail:vec(raw.tail) }];
  }));
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([...rest.values()].map(item=>item.bone)));
  const point = (name, end = 'head') => rest.get(name)[end];
  const bindHip = mid(point('thigh_l'), point('thigh_r'));
  const bindNeck = point('neck_01');
  const bindTorso = frame(bindHip,bindNeck,lateral).invert();
  const bindShoulders = point('upperarm_l').distanceTo(point('upperarm_r'));
  const limbs = new Map();
  const flatFoot = new T.Vector3(0,0,1);
  for (const name of rest.keys()) {
    const {head,tail} = rest.get(name);
    if (head.distanceToSquared(tail) > .000001) {
      limbs.set(name,{
        inverse:frame(head,tail,lateral).invert(),
        length:head.distanceTo(tail),
      });
    }
  }
  const soles={l:[],r:[]};
  for (let i=0;i<anatomy.positions.length;i+=3) {
    const [x,y,z]=anatomy.positions.slice(i,i+3);
    if (y<.024 && Math.abs(x)>.04) soles[x>0?'l':'r'].push(new T.Vector3(x,y,z));
  }
  const hands = Object.fromEntries(['l','r'].map(s => {
    const name='hand_'+s;
    const width=point('index_01_'+s).clone().sub(point('pinky_01_'+s));
    const inverse=frame(point(name),point(name,'tail'),width).invert();
    const curl=Math.sign(point('thumb_03_'+s).clone().applyMatrix4(inverse).z);
    return [s,{name,inverse,curl}];
  }));

  function setFocus(enabled, muscles=[]) {
    const active=enabled ? muscles : [];
    for (let i=0; i<anatomy.positions.length; i+=3) {
      const c = skinColor(anatomy.positions[i],anatomy.positions[i+1],anatomy.positions[i+2],active,female);
      colorData.setXYZ(i / 3,c.r,c.g,c.b);
    }
    colorData.needsUpdate = true;
  }
  setFocus(false);

  function place(name, transform) {
    const bone = rest.get(name).bone;
    bone.matrix.copy(transform);
    bone.matrixWorldNeedsUpdate = true;
  }

  function aim(name, start, end, axis) {
    const bind = limbs.get(name);
    const x = axis ?? lateral;
    const stretch = start.distanceTo(end) / bind.length;
    const transform = frame(start,end,x,stretch).multiply(bind.inverse);
    place(name,transform);
    return transform;
  }

  function update(pose, fingerBand = false) {
    const bandContacts = fingerBand ? {} : null;
    const hip = mid(vec(pose.lh),vec(pose.rh));
    const neck = vec(pose.neck);
    const side = vec(pose.ls).sub(vec(pose.rs)).normalize();
    const torso = frame(hip,neck,side,hip.distanceTo(neck)/bindHip.distanceTo(bindNeck),
      vec(pose.ls).distanceTo(vec(pose.rs))/bindShoulders).multiply(bindTorso);
    const spineDirection=neck.clone().sub(hip).normalize();
    const upright=new T.Vector3(0,1,0);
    const uprightWeight=T.MathUtils.smoothstep(spineDirection.y,.30,.85)*.74;
    const pelvisAxis=spineDirection.clone().lerp(upright,uprightWeight);
    const pelvis = frame(hip,hip.clone().add(pelvisAxis),side).multiply(bindTorso);
    place('Root',pelvis);
    place('pelvis',pelvis);
    const spine = (amount) => pelvis.clone().fromArray(pelvis.elements.map(
      (value,index) => T.MathUtils.lerp(value,torso.elements[index],amount)));
    place('spine_01',spine(.34));
    place('spine_02',spine(.72));
    for (const name of ['spine_03','clavicle_l','clavicle_r']) {
      place(name,torso);
    }
    const neckMotion=torso.clone();
    neckMotion.elements[13]-=(pose.headDrop ?? 0)*.4;
    place('neck_01',neckMotion);
    const naturalHead = point('head').clone().applyMatrix4(torso);
    naturalHead.y-=pose.headDrop ?? 0;
    const headDirection = pose.headAim ? vec(pose.headAim) : neck.clone().sub(hip);
    const headLocal = frame(naturalHead, naturalHead.clone().add(headDirection),side);
    if (pose.headTurn) headLocal.multiply(new T.Matrix4().makeRotationY(pose.headTurn));
    const headMotion = headLocal
      .multiply(frame(point('head'),point('head').clone().add(bindNeck.clone().sub(bindHip)),lateral).invert());
    place('head',headMotion);
    for (const s of ['l','r']) {
      const hip = vec(pose[s+'h']), knee = vec(pose[s+'k']), ankle = vec(pose[s+'a']), toe = vec(pose[s+'t']);
      aim('thigh_'+s, hip,knee,side);
      const restFoot = limbs.get('foot_'+s);
      if (toe.distanceToSquared(ankle) < .0001) toe.add(flatFoot);
      const footMid = toe.clone().sub(ankle).normalize().multiplyScalar(restFoot.length).add(ankle);
      const foot = aim('foot_'+s, ankle,footMid,side);
      const floor=pose.planted?.[s];
      if (Number.isFinite(floor) && soles[s].length) {
        let bottom=Infinity;
        const sample=new T.Vector3();
        for (const bind of soles[s]) bottom=Math.min(bottom,sample.copy(bind).applyMatrix4(foot).y);
        const offset=T.MathUtils.clamp(floor-bottom,-.049,.049);
        foot.elements[13]+=offset;
        ankle.y+=offset;
        place('foot_'+s,foot);
      }
      aim('calf_'+s, knee,ankle,side);
      place('ball_'+s,foot);

      const shoulder = vec(pose[s+'s']), elbow=vec(pose[s+'e']), grasp=vec(pose[s+'w']);
      const authoredFingers = pose[s+'Fingers'];
      const authoredPalmSide = pose[s+'PalmSide'];
      const fingerDirection = authoredFingers ? vec(authoredFingers).normalize() : grasp.clone().sub(elbow).normalize();
      const gripping=Boolean(pose[s+'Grip']);
      const grip = gripping ? vec(pose[s+'Grip']).normalize()
        : authoredPalmSide ? vec(authoredPalmSide).normalize() : side.clone();
      if (s==='l') grip.negate();
      if (gripping) {
        const axial=fingerDirection.dot(grip);
        const across=fingerDirection.clone().addScaledVector(grip,-axial);
        const alignment=1-T.MathUtils.smoothstep(Math.abs(axial),.81,.995);
        if (alignment>0) fingerDirection.lerp(across.normalize(),alignment).normalize();
      }
      const {name:handName,inverse,curl}=hands[s];
      const handFrame=frame(grasp,grasp.clone().add(fingerDirection),grip);
      const closure = pose[s+'FingerCurl'] ?? (gripping ? 1 : 0);
      const hand = handFrame.clone().multiply(new T.Matrix4().makeTranslation(.006,-.112,-closure*curl*.023)).multiply(inverse);
      const wrist = point(handName).clone().applyMatrix4(hand);
      const actualElbow=elbowFor(shoulder,wrist,elbow,limbs.get('upperarm_'+s).length,limbs.get('lowerarm_'+s).length);
      aim('upperarm_'+s,shoulder,actualElbow,side);
      aim('lowerarm_'+s,actualElbow,wrist,side);
      place(handName,hand);
      const curlAxis=new T.Vector3().setFromMatrixColumn(handFrame,0).normalize();
      const fanAxis=new T.Vector3().setFromMatrixColumn(handFrame,2).normalize();
      const spread=pose[s+'FingerSpread']??0;
      const thumbReach=pose[s+'ThumbExtend']??0;
      const fanAngle={thumb:.29,index:.24,middle:.021,ring:-.138,pinky:-.346};

      for (const name of ['thumb','index','middle','ring','pinky']) {
        let parent = hand;
        for (const joint of ['01','02','03']) {
          const key = name+'_'+joint+'_'+s;
          const pivot = point(key).clone().applyMatrix4(parent);
          const restingAngle = name==='thumb' ? .06 : joint==='01' ? .25 : .18;
          const grippingAngle = name==='thumb' ? .27 : joint==='01' ? 1.06 : joint==='02' ? .88 : .58;
          const angle=curl*T.MathUtils.lerp(restingAngle,grippingAngle,closure) -
            (name==='thumb'?curl*.21*thumbReach:0);
          const fan=joint==='01'?fanAngle[name]*(name==='thumb'?thumbReach:spread):0;
          const bend=new T.Matrix4().makeRotationAxis(curlAxis,angle);
          if(fan)bend.multiply(new T.Matrix4().makeRotationAxis(fanAxis,fan));
          bend.setPosition(pivot.clone().sub(pivot.clone().applyMatrix4(bend)));
          parent = bend.multiply(parent);
          place(key,parent);
          if (bandContacts && s === 'r' && joint === '02') bandContacts[name]=pivot;
        }
      }
    }
    group.updateMatrixWorld(true);
    return bandContacts;
  }
  return { group, update, setFocus };
}
