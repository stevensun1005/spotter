import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { armCrank, armCrankGrip } from './seated-ergometer-geometry.js';

const finish = (color,metalness,roughness) => new THREE.MeshStandardMaterial({color,metalness,roughness});
const frame=finish(0xa5aea7,.42,.39);
const alloy=finish(0xc7cec8,.64,.39);
const paint=finish(0x3a4a3e,.26,.49);
const black=finish(0x262d29,.31,.61);
const surface=finish(0x435b4c,.03,.78);
const display=finish(0x263d35,.11,.35);
const lit=finish(0x88a891,.07,.53);
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const up=v(0,1,0);

function mesh(root,geometry,material,x,y,z) {
  const item=new THREE.Mesh(geometry,material);
  item.position.set(x,y,z);
  item.castShadow=item.receiveShadow=true;
  root.add(item);
  return item;
}
function box(root,w,h,d,material,x,y,z) {
  return mesh(root,new RoundedBoxGeometry(w,h,d,3,Math.min(.014,w/5,h/5,d/5)),material,x,y,z);
}
function pin(root,radius,length,material,x,y,z,direction=up) {
  const item=mesh(root,new THREE.CylinderGeometry(radius,radius,length,20),material,x,y,z);
  item.quaternion.setFromUnitVectors(up,direction);
  return item;
}
function link(root,radius,material) {
  const item=pin(root,radius,1,material,0,0,0);
  return (start,end)=>{
    const axis=end.clone().sub(start);
    item.position.copy(start).lerp(end,.5);
    item.scale.y=axis.length();
    item.quaternion.setFromUnitVectors(up,axis.normalize());
  };
}
function meter(root,y,z) {
  box(root,.167,.112,.045,black,0,y,z).rotation.x=-.33;
  box(root,.133,.073,.007,display,0,y+.006,z-.023).rotation.x=-.33;
  for (let i=0;i<4;i++) box(root,.017,.004,.002,lit,(i-1.5)*.026,y+.011,z-.032);
}
function bench(root,ski) {
  box(root,.367,.058,.334,surface,0,.450,-.036);
  box(root,.079,.403,.069,frame,0,.241,-.029);
  box(root,.465,.048,.074,black,0,.036,-.029);
  box(root,.088,.052,.82,frame,0,.049,.332);
  for (const sign of [-1,1]) {
    const x=sign*.157;
    box(root,.113,.072,.254,black,x,.039,.386);
    for(let i=0;i<5;i++) box(root,.086,.005,.014,alloy,x,.077,.301+i*.037);
  }
  if (!ski) {
    box(root,.078,.110,.039,black,0,.365,.004);
    pin(root,.025,.038,paint,.058,.367,-.025,v(1,0,0));
  }
}

function wheel(root,center,radius,width) {
  pin(root,radius,width,paint,...center,v(1,0,0));
  pin(root,radius*.81,width+.010,alloy,...center,v(1,0,0));
  for(const sign of [-1,1]) for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    pin(root,.010,.010,black,center[0]+sign*(.012+width*.5),
      center[1]+Math.sin(angle)*radius*.68,center[2]+Math.cos(angle)*radius*.68,v(1,0,0));
  }
}

export function buildSeatedErgometer(root,preset) {
  if (!preset) return null;
  const station=new THREE.Group();
  station.name = preset==='ergometer-arms' ? 'Seated arm-crank ergometer' : 'Seated twin-cord ski ergometer';
  root.add(station);
  const ski=preset==='ergometer-seated-ski';
  bench(station,ski);
  box(station,.455,.059,.200,frame,0,.047,.839);
  box(station,.035,.024,.186,black,-.224,.024,.840);
  box(station,.035,.024,.186,black,.224,.024,.840);
  if (!ski) {
    box(station,.085,.993,.091,frame,0,.54,.563).rotation.x=.128;
    wheel(station,[0,armCrank.y,armCrank.z],.144,.165);
    pin(station,.022,.516,alloy,0,armCrank.y,armCrank.z,v(1,0,0));
    meter(station,1.27,.507);
    box(station,.039,.222,.039,frame,0,1.16,.558).rotation.x=.34;
    const spins=[-1,1].map((sign)=>{
      const arm=link(station,.022,alloy);
      const grip=pin(station,.023,.132,black,0,0,0,v(1,0,0));
      return (phase)=>{
        const handle=v(...armCrankGrip(sign,phase));
        grip.position.copy(handle);
        arm(v(sign*armCrank.width,armCrank.y,armCrank.z),handle);
      };
    });
    return (pose) => spins.forEach((spin)=>spin(pose.ergometerCrank));
  }

  const drive=[0,.347,.813];
  wheel(station,drive,.264,.127);
  box(station,.108,1.91,.092,frame,0,1.04,.867).rotation.x=-.032;
  meter(station,1.229,.788);
  box(station,.063,.049,.333,frame,0,2.156,.782);
  box(station,.568,.055,.077,frame,0,2.154,.617);
  const leads=[[-1,'r'],[1,'l']].map(([sign,side])=>{
    const anchor=v(sign*.238,2.135,.601);
    pin(station,.035,.036,black,anchor.x,anchor.y+.018,anchor.z,v(1,0,0));
    const cord=link(station,.0042,paint);
    const grip=pin(station,.019,.123,black,0,0,0,v(1,0,0));
    return (pose)=>{
      const hand=v(...pose[side+'w']);
      grip.position.copy(hand);
      cord(anchor,hand.clone().add(v(sign*.043,.009,0)));
    };
  });
  return (pose)=>leads.forEach((lead)=>lead(pose));
}
