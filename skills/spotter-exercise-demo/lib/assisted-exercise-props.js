import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { assistedExercises, assistedGrip } from './assisted-exercise-geometry.js';

const material = (color,metalness,roughness) => new THREE.MeshStandardMaterial({color,metalness,roughness});
const frame=material(0x9da9a0,.50,.35);
const pad=material(0x33473f,.01,.81);
const stack=material(0x313b36,.31,.49);
const bolts=material(0xbcc6bf,.62,.40);
const wire=material(0x343d39,.48,.71);
const green=material(0x7a996d,.04,.62);
const v = (x,y,z) => new THREE.Vector3(x,y,z);
const up = v(0,1,0);

function place(root,geometry,surface,x,y,z) {
  const instance=new THREE.Mesh(geometry,surface);
  instance.position.set(x,y,z);
  instance.castShadow = instance.receiveShadow = true;
  root.add(instance);
  return instance;
}

function box(root,w,h,d,surface,x,y,z) {
  return place(root,new RoundedBoxGeometry(w,h,d,3,Math.min(.016,h/3,w/4,d/4)),surface,x,y,z);
}

function cylinder(root,radius,length,surface,x,y,z,toward=up) {
  const part=place(root,new THREE.CylinderGeometry(radius,radius,length,20),surface,x,y,z);
  part.quaternion.setFromUnitVectors(up,toward);
  return part;
}

function link(root,from,to,radius,surface) {
  const delta=to.clone().sub(from);
  const center=from.clone().lerp(to,.5);
  return cylinder(root,radius,delta.length(),surface,center.x,center.y,center.z,delta.normalize());
}

function rigGrips(root,config) {
  const isDip=config.grip==='dip';
  const neutral=config.grip==='neutral';
  if (!isDip) link(root,v(-.48,2.059,.706),v(.48,2.059,.706),.030,frame);
  if (config.grip==='over'||config.grip==='under') {
    link(root,v(-.418,1.984,.102),v(.418,1.984,.102),.016,bolts);
  }
  for (const sign of [-1,1]) {
    const [x,y,z]=assistedGrip(config,sign);
    const support=sign*.48;
    const near = isDip || neutral;
    link(root,v(support,y+.033,.681),v(support,y+.033,.291),.026,frame);
    link(root,v(support,y+.033,.291),v(x,y,z+(near?.102:0)),.024,frame);
    if (near) {
      link(root,v(x,y,z+.085),v(x,y,z-.104),.023,bolts);
      cylinder(root,.024,.142,pad,x,y,z,v(0,0,1));
    } else {
      cylinder(root,.023,.138,pad,x,y,z,v(1,0,0));
    }
  }
}

export function buildAssistedExercise(root,preset,sample) {
  if (!preset) return null;
  const config=assistedExercises[preset];
  const machine=new THREE.Group();
  machine.name='Selectorized counterweighted assistance machine';
  root.add(machine);
  const upper=config.grip==='dip'?1.69:2.127;
  for (const sign of [-1,1]) {
    const x=sign*.48;
    box(machine,.128,.078,1.36,frame,x,.045,.348);
    box(machine,.138,.051,.185,pad,x,.030,-.325);
    box(machine,.082,upper,.097,frame,x,upper*.5,.702);
    box(machine,.143,.121,.231,pad,sign*.428,.119,.199);
    box(machine,.145,.084,.192,frame,sign*.44,.166,.229);
    box(machine,.149,.049,.198,pad,sign*.44,.199,.228);
    cylinder(machine,.012,1.16,bolts,sign*.212,.707,.49);
  }
  box(machine,1.045,.069,.105,frame,0,.079,.743);
  box(machine,.61,.068,.146,frame,0,1.57,.709);
  box(machine,.337,1.336,.048,stack,0,.779,1.044);
  box(machine,.357,.052,.306,frame,0,.122,.89);
  box(machine,.362,.065,.306,frame,0,1.464,.89);
  for (const x of [-.128,.128]) cylinder(machine,.012,1.23,bolts,x,.797,.89);
  for(let i=0;i<11;i++) box(machine,.301,.025,.191,stack,0,.178+i*.029,.902);
  const selected=Array.from({length:3},(_,i)=>box(machine,.298,.025,.189,stack,0,.507+i*.030,.902));
  const selector=box(machine,.059,.027,.036,green,.122,.576,.805);
  const upperPulley=cylinder(machine,.055,.039,bolts,0,1.415,.765,v(1,0,0));
  upperPulley.name='Counterweight pulley';
  const counterWire=cylinder(machine,.004,1,wire,0,0,.765);
  const padWire=cylinder(machine,.004,1,wire,0,0,.523);
  const platform=new THREE.Group();
  machine.add(platform);
  box(platform,config.platform?.389:.396,.057,config.platform?.330:.251,pad,0,-.029,.027);
  box(platform,.303,.035,.159,frame,0,-.075,.027);
  box(platform,.078,.053,.456,frame,0,-.102,.243);
  box(platform,.478,.077,.070,stack,0,-.102,.49);
  for (const x of [-.212,.212]) cylinder(platform,.036,.11,stack,x,-.101,.49);
  if (config.platform) {
    for (const z of [-.072,0,.072,.144]) box(platform,.34,.008,.022,green,0,.001,z);
  }
  rigGrips(machine,config);
  const highest=Math.max(...Array.from({length:33},(_,i)=>sample(i/32).assistedPadY));
  return (height) => {
    platform.position.y=height;
    const selectedY=.505+highest-height;
    selected.forEach((plate,index)=>{plate.position.y=selectedY+index*.030;});
    selector.position.y=selectedY+.070;
    counterWire.scale.y=1.415-(selectedY+.088);
    counterWire.position.y=(1.415+selectedY+.088)*.5;
    padWire.scale.y=1.415-(height-.100);
    padWire.position.y=(1.415+height-.100)*.5;
  };
}
