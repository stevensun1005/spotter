import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rubber=new T.MeshStandardMaterial({color:0x29332f,roughness:.85});
const frame=new T.MeshStandardMaterial({color:0x4b5c53,roughness:.54,metalness:.26});
const steel=new T.MeshStandardMaterial({color:0xafbcb0,roughness:.34,metalness:.52});
const load=new T.MeshStandardMaterial({color:0x718178,roughness:.91});
const windowGlass=new T.MeshStandardMaterial({color:0x2f3c3c,roughness:.3,metalness:.22});
const axisY=new T.Vector3(0,1,0);
const point=v=>new T.Vector3(...v);
const midpoint=(a,b)=>point(a).lerp(point(b),.5);

function mesh(group,geometry,appearance,where=[0,0,0]){
  const item=new T.Mesh(geometry,appearance);
  item.position.copy(point(where));
  item.castShadow=true;
  item.receiveShadow=true;
  group.add(item);
  return item;
}
function box(group,dimensions,where,appearance=frame,bevel=.021){
  return mesh(group,new RoundedBoxGeometry(...dimensions,3,bevel),appearance,where);
}
function tube(group,radius,height,where,appearance=steel){
  return mesh(group,new T.CylinderGeometry(radius,radius,height,24),appearance,where);
}
function segment(item,start,end){
  const delta=end.clone().sub(start);
  item.position.copy(start).lerp(end,.5);
  item.quaternion.setFromUnitVectors(axisY,delta.clone().normalize());
  item.scale.y=delta.length();
}
function stone(group){
  const shape=new T.IcosahedronGeometry(.183,4);
  const vertices=shape.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const size=1+.035*Math.sin(85*x+19*y+36*z)+.016*Math.cos(121*z-28*y);
    vertices.setXYZ(i,size*x,size*.974*y,size*z);
  }
  shape.computeVertexNormals();
  return mesh(group,shape,load);
}

function roller(group,neutral){
  const reel=new T.Group(), spool=new T.Group();
  reel.add(spool);group.add(reel);
  tube(spool,.028,.39,[0,0,0]);
  for(const d of [-.108,.108])tube(spool,.041,.123,[0,d,0],rubber);
  tube(spool,.052,.066,[0,0,0],frame);
  const string=tube(group,.004,1,[0,0,0],rubber);
  const plate=tube(group,.065,.038,[0,0,0],frame);
  return p=>{
    const center=midpoint(p.lw,p.rw);
    const axis=point(p.lw).sub(point(p.rw)).normalize();
    reel.position.copy(center);
    reel.quaternion.setFromUnitVectors(axisY,axis);
    spool.rotation.y=p.machineTravel*(neutral?1:-1);
    const lower=center.clone().add(point([0,-.585+p.machineTravel*.081,.044]));
    plate.position.copy(lower);
    segment(string,center.clone().add(point([0,-.027,.044])),lower.clone().add(point([0,.025,0])));
  };
}

function handSpring(group){
  const grip=new T.Group();group.add(grip);
  const a=tube(grip,.017,.102,[0,-.039,-.045],rubber);
  const b=tube(grip,.017,.102,[0,.039,-.045],rubber);
  tube(grip,.032,.042,[0,0,-.090],steel).rotateZ(Math.PI/2);
  return p=>{
    const curl=p.lFingerCurl??0;
    grip.position.copy(point(p.lw)).add(point([0,.015,.042]));
    a.position.y=-.040+.024*curl;
    b.position.y=.040-.024*curl;
    a.rotation.x=Math.PI/2+.46*(1-curl);
    b.rotation.x=Math.PI/2-.46*(1-curl);
  };
}

function cart(group){
  const rig=new T.Group();group.add(rig);
  box(rig,[.593,.069,.588],[0,.13,.310],frame);
  box(rig,[.505,.167,.470],[0,.240,.334],rubber,.028);
  for(const side of [-1,1]){
    let shaft=tube(rig,.022,.665,[side*.167,.145,-.193]);
    shaft.rotateX(Math.PI/2);
    shaft=tube(rig,.051,.173,[side*.170,.142,-.480],rubber);
    shaft.rotateX(Math.PI/2);
    box(rig,[.055,.093,.047],[side*.246,.056,.047],frame);
  }
  const wheel=tube(rig,.137,.116,[0,0,.631],rubber);wheel.rotateZ(Math.PI/2);
  const hub=tube(rig,.052,.129,[0,0,.631],steel);hub.rotateZ(Math.PI/2);
  return p=>{
    const middle=midpoint(p.lw,p.rw);
    const heel=.137;
    const arm=1.111;
    const height=.142;
    const rise=Math.max(-.09,Math.min(.87,middle.y-heel));
    const tilt=Math.asin(rise/Math.hypot(arm,height))-Math.atan2(height,arm);
    const axleDepth=middle.z-height*Math.sin(tilt)+arm*Math.cos(tilt);
    rig.position.set(middle.x,heel+Math.sin(tilt)*.631,axleDepth-Math.cos(tilt)*.631);
    rig.rotation.x=tilt;
    wheel.rotation.set(0,p.machineTravel*.8,Math.PI/2);
  };
}

function frameSquat(group){
  const rig=new T.Group();group.add(rig);
  for(const side of [-1,1]){
    box(group,[.178,.044,.572],[side*.561,.027,.005],rubber);
    box(group,[.058,.657,.058],[side*.561,.353,.002],frame);
    box(rig,[.117,.069,.680],[side*.549,-.615,.005],frame);
    box(rig,[.051,.659,.067],[side*.549,-.287,0],steel);
    box(rig,[.191,.178,.253],[side*.433,-.489,.028],load);
  }
  box(rig,[1.173,.085,.107],[0,0,0],rubber,.028);
  return p=>{rig.position.y=(p.ls[1]+p.rs[1])*.5+.006;};
}

function conan(group){
  const beam=new T.Group();group.add(beam);
  tube(group,.225,.057,[0,.030,0],rubber);
  tube(group,.052,1.110,[0,.575,0],frame);
  box(beam,[1.455,.082,.081],[.751,1.017,0],frame);
  tube(beam,.043,.581,[1.447,1.020,0],rubber).rotateX(Math.PI/2);
  for(const x of [.550,.784,.962])tube(beam,.106,.088,[x,1.016,0],load).rotateZ(Math.PI/2);
  return p=>{beam.rotation.y=p.machineTravel;beam.position.y=p.hips[1]-.853;};
}

function car(group){
  const shell=new T.Group();group.add(shell);
  shell.position.set(-.647,0,0);
  box(shell,[1.28,.213,1.84],[.643,.255,0],frame,.065);
  box(shell,[1.12,.173,.879],[.641,.407,-.085],windowGlass,.069);
  box(shell,[1.03,.066,.793],[.641,.485,-.091],frame,.029);
  for(const x of [.118,1.156])for(const z of [-.605,.605]){
    tube(shell,.175,.104,[x,.175,z],rubber).rotateZ(Math.PI/2);
    tube(shell,.080,.118,[x,.175,z],steel).rotateZ(Math.PI/2);
  }
  for(const z of [-.936,.936])box(shell,[1.09,.075,.108],[.643,.210,z],rubber,.022);
  return p=>{
    shell.rotation.z=p.machineTravel;
    shell.position.y=-.519*Math.min(0,Math.cos(p.machineTravel));
  };
}

function powerStairs(group){
  for(let i=0;i<3;i++){
    const y=.168*(i+1), z=.456+.333*i;
    box(group,[.668,y,.334],[0,y/2,z],frame);
    box(group,[.679,.025,.341],[0,y-.006,z],rubber,.009);
  }
}
function loading(group,kind){
  if(kind==='stones'){
    box(group,[1.13,.064,.359],[0,.035,.683],rubber);
    for(const x of [-.497,.497])box(group,[.061,.991,.063],[x,.503,.686],frame);
    tube(group,.025,1.049,[0,.998,.684]).rotateZ(Math.PI/2);
    box(group,[.716,.044,.424],[0,.021,.952],rubber);
  }else{
    box(group,[.776,.095,.471],[0,.816,.745],rubber);
    for(const x of [-.303,.303])box(group,[.070,.773,.072],[x,.399,.744],frame);
    box(group,[.748,.055,.316],[0,.027,.744],steel);
  }
}

export function buildSpecialtyWeight(group,preset){
  if(!preset)return undefined;
  if(preset==='hand-spring')return handSpring(group);
  if(preset==='wrist-roller-pronated'||preset==='wrist-roller-neutral')return roller(group,preset.endsWith('neutral'));
  if(preset==='car-flip')return car(group);
  if(preset==='conan-wheel')return conan(group);
  if(preset==='wheelbarrow')return cart(group);
  if(preset==='platform-squat')return frameSquat(group);
  if(preset==='power-stairs')powerStairs(group);
  if(preset==='stones'||preset==='platform-load')loading(group,preset);
  const weight=stone(group);
  return p=>{weight.position.copy(point(p.ballCenter));};
}
