import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildPressStation } from './lever-press-station-props.js';

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
  if (preset.startsWith('station-')) return buildPressStation(group,preset.slice(8),initial);
  const selectorized = preset.endsWith('-stack');
  const plateLoaded = preset.endsWith('-plate');
  const kneeMachine = preset.startsWith('knee-');
  const proneCurl = preset.startsWith('knee-prone-');
  const kneelingCurl = preset.startsWith('knee-kneeling-');
  const seatedCurl = preset.startsWith('knee-curl-');
  const seatedCalf = preset === 'seated-calf' || preset.startsWith('seated-calf-');
  const hipStation = preset.startsWith('hip-');
  const forearmFly = preset === 'fly-pad-stack';
  const paddedLateral = preset.startsWith('lateral-pad-');
  const paddedElbow = preset === 'elbow-pad-stack';
  const dip = preset === 'dip-plate';
  const mounted = selectorized || plateLoaded || preset === 'flat-floor';
  const upright = preset === 'standing' || preset === 'standing-calf';
  const lower = kneeMachine || seatedCalf || hipStation || ['leg','rotary-calf','standing-calf','hip','crunch','twist','reverse-hyper'].includes(preset);
  const freePlatform = proneCurl || kneelingCurl || preset === 'twist' || preset === 'reverse-hyper';
  const front = preset === 'reverse';
  const fly = preset === 'fly' || preset.startsWith('fly-') || front;
  const incline = preset === 'incline' || preset.startsWith('incline-') || preset === 'fly-incline-stack';
  const z = front ? .295 : -.185;
    for (const z of [lower?.93:.39,-.49]) box(group,[.87,.061,.137],edge,[0,.034,z]);
  box(group,[.135,.067,lower?1.51:.94],steel,[0,.040,lower?.21:-.05]);
  if (preset === 'standing-calf' || seatedCalf) {
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
  if(proneCurl){
    for(const z of [-.222,.345]) {
      box(group,[.426,.074,.469],pad,[0,.510,z]);
      box(group,[.073,.433,.078],steel,[0,.254,z]);
      box(group,[.619,.057,.149],edge,[0,.034,z]);
    }
  }
  if(kneelingCurl){
    box(group,[.492,.063,.279],pad,[0,.482,-.084]);
    box(group,[.481,.071,.237],pad,[0,.941,.477],-.214);
    for(const sign of [-1,1]){
      beam(group,.042,steel,[sign*.254,.078,-.102],[sign*.254,.445,-.102]);
      beam(group,.042,steel,[sign*.259,.077,.431],[sign*.259,.920,.480]);
    }
  }
  if(seatedCurl){
    for(const sign of [-1,1]){
      const x=sign*.148;
      beam(group,.033,steel,[sign*.267,.458,.207],[sign*.317,.651,.257]);
      beam(group,.059,pad,[x-.124,.620,.256],[x+.124,.620,.256]);
    }
  }
  if (paddedElbow) {
    for (const side of ['l','r']) {
      const [x,y,z] = initial[side+'e'];
      box(group,[.19,.055,.249],pad,[x,y-.065,z-.079],.24);
      beam(group,.029,steel,[x,.50,z-.080],[x,y-.089,z-.080]);
    }
  }
  if(kneeMachine||hipStation){
    for(const [side,sign] of [['l',1],['r',-1]]){
      const [x,y,z]=initial[side+'w'];
      beam(group,.025,steel,[sign*(freePlatform?.247:.175),proneCurl?.494:kneelingCurl?.92:.454,z],[x,y,z]);
      beam(group,.022,pad,[x,y,z-.059],[x,y,z+.061]);
    }
  }
  let movingStack;
  let stackTop;
  let stackTension;
  if (selectorized) {
    const x = .52;
    const z = -.434;
    const top = kneeMachine ? 1.265 : 1.615;
    box(group,[.292,.074,.252],edge,[x,.065,z]);
    box(group,[.294,.061,.255],edge,[x,top,z]);
    for (const offset of [-.099,.099]) beam(group,.013,steel,[x+offset,.108,z],[x+offset,top,z]);
    for (let index=0;index<11;index++) box(group,[.231,.042,.176],edge,[x,.13+index*.046,z]);
    movingStack=box(group,[.243,.128,.186],steel,[x,.681,z]);
    stackTop=vec([x,top-.045,z]);
    stackTension=bar(group,.006,edge);
    beam(group,.020,steel,[x,top-.056,z],[-.556,top-.056,z]);
  }

  const arms = initial.leverPressHandles.map(({pivot},index) => {
    const sign=index===0?1:-1;
    const ground=[sign*.503,.087,pivot[2]-.25];
    const post=[sign*.503,pivot[1],pivot[2]-.14];
    if(mounted) {
      box(group,[.211,.067,.244],edge,[ground[0],.035,ground[2]]);
      beam(group,.047,steel,[ground[0],.067,ground[2]],ground);
    }
    beam(group,.048,steel,ground,post);
    beam(group,.041,steel,post,pivot);
    const pivotCap=mesh(group,new THREE.CylinderGeometry(.063,.063,.094,22),edge,pivot);
    if (!fly) pivotCap.rotateZ(Math.PI/2);
    const arm=bar(group,.033,edge);
    const handle=bar(group,kneeMachine?.058:.020,pad);
    const base=vec(pivot);
    const contact = lower && !kneeMachine ? (preset==='leg'||preset==='rotary-calf' ? box(group,[.24,.27,.039],edge,[0,0,0],-.32)
      : box(group,[.172,preset==='crunch'?.155:.087,.114],pad,[0,0,0])) : null;
    const disc = plateLoaded ? mesh(group,new THREE.CylinderGeometry(.124,.124,.038,32),pad,[0,0,0]) : null;
    if (disc) disc.rotateZ(Math.PI/2);
    const forearmPad = forearmFly || paddedLateral
      ? box(group,forearmFly?[.067,.273,.141]:[.081,.137,.173],pad,[0,0,0])
      : null;
    const calfGrip=preset==='seated-calf-plate'?bar(group,.019,pad):null;
    const calfStem=calfGrip?bar(group,.020,steel):null;
    let cableExit;
    let armCable;
    if(selectorized){
      const across=[sign*.551,stackTop.y,-.434];
      const corner=[sign*.551,pivot[1]+.127,pivot[2]-.125];
      cableExit=vec(corner);
      beam(group,.010,edge,across,corner);
      box(group,[.055,.072,.067],edge,corner);
      armCable=bar(group,.006,edge);
    }
    return {arm,handle,base,sign,contact,disc,forearmPad,cableExit,armCable,calfGrip,calfStem,
      initialCenter:vec(initial.leverPressHandles[index].point)};
  });
  return (pose) => {
    const {leverPressHandles}=pose;
    let travel=0;
    for (const [index,part] of arms.entries()) {
      const {arm,handle,base,sign,contact,disc,forearmPad,cableExit,armCable,calfGrip,calfStem,initialCenter}=part;
      const {point,axis}=leverPressHandles[index];
      const center=vec(point);
      const direction=vec(axis).normalize();
      const stem=center.clone().addScaledVector(direction,sign*.049);
      aim(arm,base,stem);
      if (forearmFly) center.y+=.260;
      const gripHalf = kneeMachine?.131:dip?.097:.070;
      aim(handle,center.clone().addScaledVector(direction,-gripHalf),center.clone().addScaledVector(direction,gripHalf));
      if (disc) disc.position.copy(base).lerp(stem,kneeMachine?.35:.53).addScaledVector(new THREE.Vector3(sign,0,0),.141);
      if(calfGrip){
        const wrist=vec(pose[sign>0?'lw':'rw']);
        aim(calfGrip,wrist.clone().add(vec([0,0,-.064])),wrist.clone().add(vec([0,0,.064])));
        aim(calfStem,stem,wrist);
      }
      if (forearmPad) {
        forearmPad.position.copy(vec(point));
        forearmPad.position.x+=sign*.038;
        if (forearmFly) forearmPad.position.y+=.127;
      }
      if (movingStack) {
        travel=Math.max(travel,vec(point).distanceTo(initialCenter));
        const cableEye=base.clone().lerp(stem,.35).add(vec([sign*.112,.021,0]));
        aim(armCable,cableExit,cableEye);
      }
      if (contact) {
        contact.position.copy(center);
        if (preset === 'rotary-calf') contact.rotation.x = -.52 + (center.y - .076) * 3.7;
      }
    }
    if (movingStack) {
      movingStack.position.y=.681+.27*travel;
      aim(stackTension,movingStack.position.clone().add(vec([0,.064,0])),stackTop);
    }
  };
}
