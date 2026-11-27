import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { leverPullGrip, leverPulls } from './lever-pull-geometry.js';

const vector = (x,y,z) => new THREE.Vector3(x,y,z);

const finish = (color,metalness,roughness) => new THREE.MeshStandardMaterial({color,metalness,roughness});
const metal = finish(0xa3ada5,.4,.38);
const hardware = finish(0xc7cdc9,.64,.41);
const dark = finish(0x29332d,.28,.51);
const pad = finish(0x324536,.02,.75);
const plateColor = finish(0x414943,.23,.48);

function attach(root,geometry,surface,position) {
  const part = new THREE.Mesh(geometry,surface);
  part.position.copy(position);
  part.castShadow = part.receiveShadow = true;
  root.add(part);
  return part;
}

function slab(root,width,height,depth,position,surface = metal) {
  return attach(root,new RoundedBoxGeometry(width,height,depth,3,Math.min(.019,height*.31)),surface,position);
}

const up = vector(0,1,0);
function pin(root, radius, length, position, surface, toward = vector(1,0,0)) {
  const output = attach(root,new THREE.CylinderGeometry(radius,radius,length,20),surface,position);
  output.quaternion.setFromUnitVectors(up,toward);
  return output;
}

function link(root, start, end, radius, surface) {
  const length = start.distanceTo(end);
  const member = slab(root,radius,1,radius,vector(0,0,0),surface);
  const position = (from,to) => {
    const difference = to.clone().sub(from);
    member.scale.y = difference.length();
    member.position.copy(from).lerp(to,.5);
    member.quaternion.setFromUnitVectors(up,difference.normalize());
  };
  if (length) position(start,end);
  return position;
}

function seatedRig(root, config) {
  slab(root,.462,.056,.373,vector(0,.446,-.032),pad);
  slab(root,.076,.392,.082,vector(0,.233,-.03),metal);
  slab(root,.62,.062,.116,vector(0,.044,-.03));
  slab(root,.091,.076,1.227,vector(0,.040,.512));
  if (config.chest) {
    slab(root,.292,.244,.068,vector(0,.876,.149),pad).rotation.x = -.13;
    link(root,vector(0,.091,.706),vector(0,.871,.184),.078,metal);
  }
  if (config.platform) {
    for (const sign of [-1,1]) {
      slab(root,.189,.040,.282,vector(sign*.177,.080,.43),dark).rotation.x = -.21;
      slab(root,.073,.066,.089,vector(sign*.177,.035,.43));
    }
  }
  if (config.restraint) {
    slab(root,.066,.541,.073,vector(0,.299,.504),metal);
    slab(root,.069,.067,.263,vector(0,.604,.438),metal);
    for (const sign of [-1,1]) pin(root,.056,.186,vector(sign*.143,.589,.321),pad);
  }
}

function rearPivotSupport(root,config) {
  const floor=vector(0,.045,-.261);
  slab(root,.095,.079,1.74,floor,metal);
  slab(root,.729,.066,.155,vector(0,.042,.543),dark);
  if(config.tBar==='prone'||config.tBar==='incline'){
    const incline=config.tBar==='incline';
    const end=vector(0,incline?.817:.780,incline?.098:.027);
    const tail=vector(0,incline?.590:.723,incline?-.334:-.773);
    const center=tail.clone().lerp(end,.5);
    const padDepth=end.distanceTo(tail);
    const cushion=slab(root,incline?.290:.351,.087,padDepth,center,pad);
    cushion.rotation.x=-Math.atan2(end.y-tail.y,end.z-tail.z);
    for(const z of [tail.z,end.z-.14]){
      const y=tail.y+(end.y-tail.y)*(z-tail.z)/(end.z-tail.z);
      link(root,vector(0,.078,z),vector(0,y-.038,z),.081,metal);
    }
    if(incline){
      for(const x of [-.183,.183]){
        slab(root,.226,.051,.344,vector(x,.024,-.511),dark);
        for(let i=0;i<6;i++)slab(root,.188,.006,.013,vector(x,.050,-.626+i*.035),hardware);
      }
    }else{
      slab(root,.451,.073,.187,vector(0,.776,-.890),pad);
      link(root,vector(0,.077,-.782),vector(0,.749,-.889),.067,dark);
    }
    return;
  }
  for(const sign of [-1,1]){
    const x=sign*.239;
    slab(root,.242,.040,.418,vector(x,.035,.015),dark);
    for(let i=0;i<7;i++)slab(root,.205,.009,.017,vector(x,.055,-.159+i*.053),hardware);
  }
  if(config.tBar==='chest'){
    const contact=slab(root,.298,.082,.276,vector(0,.899,.117),pad);
    contact.rotation.x=-.50;
    link(root,vector(0,.091,.488),vector(0,.874,.14),.069,metal);
  }
}

function buildRearPivotTBar(root,config) {
  rearPivotSupport(root,config);
  const pivot=vector(0,config.pivotY,config.pivotZ);
  slab(root,.713,.064,.148,vector(0,.034,config.pivotZ),dark);
  slab(root,.159,.138,.110,pivot,metal);
  pin(root,.047,.203,pivot,hardware);
  const moveLever=link(root,pivot,pivot,.058,metal);
  const moveRiser=link(root,pivot,pivot,.046,hardware);
  const moveGrip=link(root,pivot,pivot,.026,metal);
  const gripDirection=config.neutral?vector(0,.26,.965).normalize():vector(1,0,0);
  const grips=[-1,1].map(()=>pin(root,.024,.137,pivot,dark,gripDirection));
  const radii=config.heavy?[.190,.177,.167]:[.163,.147];
  const weights=radii.map(radius=>pin(root,radius,.036,pivot,plateColor));
  const plateSleeve=pin(root,.026,.28,pivot,hardware);
  const bands=config.band?[-1,1].map(sign=>{
    const anchor=vector(sign*.190,.082,.347);
    pin(root,.038,.045,anchor,hardware,up);
    return {sign,anchor,draw:link(root,anchor,anchor,.015,pad)};
  }):[];
  return (angles)=>{
    const middle=vector(...leverPullGrip(config,0,angles[0]));
    const beamTip=middle.clone().add(vector(0,-.109,.015));
    moveLever(pivot,beamTip);
    moveRiser(beamTip,middle);
    moveGrip(middle.clone().add(vector(-config.width,0,0)),
      middle.clone().add(vector(config.width,0,0)));
    for(const [i,sign] of [-1,1].entries())grips[i].position.copy(middle).add(vector(sign*config.width,0,0));
    const pinCenter=pivot.clone().lerp(beamTip,.77);
    plateSleeve.position.copy(pinCenter).add(vector(.145,0,0));
    for(const [index,plate] of weights.entries())
      plate.position.copy(pinCenter).add(vector(.078+index*.043,0,0));
    for(const {sign,anchor,draw} of bands)
      draw(anchor,beamTip.clone().add(vector(sign*.062,.046,-.023)));
  };
}

function buildTBar(root, config) {
  if(config.rearPivot)return buildRearPivotTBar(root,config);
  const standing = config.tBar === 'standing';
  if (!standing) seatedRig(root,config);
  const pivot = vector(0,config.pivotY,config.pivotZ);
  slab(root,.132,.079,1.61,vector(0,.045,.294),metal);
  slab(root,.623,.060,.161,vector(0,.042,config.pivotZ),dark);
  slab(root,.181,.123,.135,pivot,metal);
  pin(root,.053,.199,pivot,hardware);
  if (standing) {
    for (const sign of [-1,1]) {
      const x=sign*.233;
      slab(root,.253,.035,.499,vector(x,.034,.186),dark);
      for(let j=0;j<8;j++) slab(root,.205,.006,.017,vector(x,.054,.003+j*.050),hardware);
    }
  }

  const moveBar=link(root,pivot,pivot,.066,metal);
  const moveRiser=link(root,pivot,pivot,.051,metal);
  const moveGrip=link(root,pivot,pivot,.027,hardware);
  const largePlates=[.183,.161,.148].map((radius)=>pin(root,radius,.038,pivot,plateColor));
  const sleeve=pin(root,.032,.30,pivot,hardware);
  const grips=[-1,1].map((sign)=>pin(root,.024,.131,pivot,dark,
    standing?vector(sign*.36,.064,.93).normalize():vector(1,0,0)));
  return (angles) => {
    const angle=angles[0];
    const center=vector(...leverPullGrip(config,0,angle));
    const radial=center.clone().sub(pivot).normalize();
    const tangent=vector(0,-radial.z,radial.y);
    const elbow=standing?center.clone().addScaledVector(radial,-.106)
      :center.clone().addScaledVector(tangent,.35).addScaledVector(radial,-.20);
    moveBar(pivot,elbow);
    moveRiser(elbow,center);
    moveGrip(vector(-config.width,center.y,center.z),vector(config.width,center.y,center.z));
    for(const [index,sign] of [-1,1].entries()){
      grips[index].position.copy(vector(sign*config.width,center.y,center.z));
    }
    const weight=pivot.clone().lerp(elbow,.78);
    sleeve.position.copy(weight).add(vector(.145,0,0));
    largePlates.forEach((plate,index)=>plate.position.copy(weight).add(vector(.073+index*.045,0,0)));
  };
}

function buildPostureLever(root, config) {
  const preacher=config.preacher;
  const frameWidth=preacher?.426:.472;
  const seatY=preacher?.458:.466;
  slab(root,.379,.056,.340,vector(0,seatY,-.063),pad);
  slab(root,.094,seatY-.038,.095,vector(0,seatY*.5,-.062),metal);
  slab(root,1,.063,.154,vector(0,.037,config.pivotZ),metal);
  slab(root,.531,.063,.154,vector(0,.037,-.118),metal);
  for(const sign of [-1,1]){
    slab(root,.091,.068,.877,vector(sign*frameWidth,.042,config.pivotZ-.145),dark);
    const pylon=slab(root,.067,config.pivotY+.042,.08,vector(sign*frameWidth,(config.pivotY+.042)*.5,config.pivotZ),metal);
    pylon.rotation.x=preacher?-.028:.084;
    pin(root,.054,.079,vector(sign*frameWidth,config.pivotY,config.pivotZ),hardware);
  }
  if(preacher){
    slab(root,.505,.070,.355,vector(0,.791,.333),pad).rotation.x=.835;
    slab(root,.081,.684,.078,vector(0,.405,.339),metal);
    if(config.chest) slab(root,.302,.208,.061,vector(0,.856,.172),pad).rotation.x=.075;
  } else {
    slab(root,.354,.657,.067,vector(0,.745,-.163),pad).rotation.x=-.429;
    slab(root,.324,.237,.068,vector(0,1.108,-.339),pad).rotation.x=-.405;
    boxFootPlatforms(root);
  }
  const updateSides=[-1,1].map((sign)=>{
    const pivot=vector(sign*frameWidth,config.pivotY,config.pivotZ);
    const base=link(root,pivot,pivot,.049,metal);
    const bracket=link(root,pivot,pivot,.030,hardware);
    const grip=pin(root,.022,preacher?.143:.151,pivot,dark,config.neutral?vector(0,0,1):vector(1,0,0));
    const weightArm=link(root,pivot,pivot,.049,metal);
    const horn=pin(root,.024,.209,pivot,hardware);
    const weights=[.16,.135].map(radius=>pin(root,radius,.030,pivot,plateColor));
    return (angle)=>{
      const handle=vector(...leverPullGrip(config,sign,angle));
      const outer=vector(...leverPullGrip(config,sign,angle,frameWidth));
      base(pivot,outer);
      bracket(outer,handle);
      grip.position.copy(handle);
      const counter=outer.clone().sub(pivot).normalize().multiplyScalar(-.25).add(pivot);
      weightArm(pivot,counter);
      horn.position.copy(counter).add(vector(sign*.070,0,0));
      weights.forEach((weight,index)=>weight.position.copy(counter).add(vector(sign*(.049+index*.034),0,0)));
    };
  });
  const joinBar=config.neutral||config.independent?null:link(root,vector(0,0,0),vector(0,0,0),.019,hardware);
  return (angles)=>{
    updateSides.forEach((update,index)=>update(angles[index]));
    if(joinBar) joinBar(
      vector(...leverPullGrip(config,-1,angles[0])), vector(...leverPullGrip(config,1,angles[1])),
    );
  };
}

function boxFootPlatforms(root) {
  for(const sign of [-1,1]){
    slab(root,.187,.041,.286,vector(sign*.171,.049,.431),dark);
    slab(root,.073,.052,.101,vector(sign*.171,.029,.452),metal);
  }
}

function utilityRig(root, config) {
  const deadlift=config.utility==='deadlift';
  const shrug=config.utility==='shrug';
  const hip=config.utility==='hip-extension';
  if (deadlift) {
    slab(root,.588,.056,.573,vector(0,.036,.021),dark);
    for(let stripe=0;stripe<10;stripe++) slab(root,.516,.005,.013,vector(0,.066,-.220+stripe*.053),hardware);
  } else {
    seatedRig(root,{});
    if(shrug||hip) slab(root,.342,.595,.073,vector(0,.719,-.182),pad).rotation.x=-.18;
    if(hip) for(const sign of [-1,1]) pin(root,.026,.160,vector(sign*.264,.657,.072),dark,vector(0,0,1));
  }
  if(config.utility==='gripper'){
    slab(root,.459,.055,.192,vector(0,.773,.071),pad);
    slab(root,.067,.708,.067,vector(0,.385,.304),metal);
    for(const sign of [-1,1]){
      const lower=vector(sign*config.width,.468,.296);
      pin(root,.021,.131,lower,dark);
      link(root,lower,vector(sign*.37,.469,.431),.025,hardware);
    }
  }
}

function buildUtilityLever(root, config) {
  utilityRig(root,config);
  const hip=config.utility==='hip-extension';
  const deadlift=config.utility==='deadlift';
  const gripTool=config.utility==='gripper';
  const width=hip?.455:deadlift?.427:.366;
  const axes = [-1,1].map((sign)=>{
    const pivot=vector(sign*width,config.pivotY,config.pivotZ);
    const foot=vector(sign*width,.044,config.pivotZ);
    slab(root,.112,.072,deadlift?.926:.613,vector(sign*width,foot.y,config.pivotZ+(deadlift?.395:-.063)),dark);
    link(root,foot,pivot,.073,metal);
    pin(root,.052,.086,pivot,hardware);
    const member=link(root,pivot,pivot,.051,metal);
    const inward=link(root,pivot,pivot,.037,hardware);
    const grip=hip?null:pin(root,.021,gripTool?.142:.157,pivot,dark,config.neutral?vector(0,0,1):vector(1,0,0));
    const moveHorn=link(root,pivot,pivot,.039,metal);
    const plate=pin(root,gripTool?.081:.141,.037,pivot,plateColor);
    const collar=pin(root,.024,.155,pivot,hardware);
    return (angle)=>{
      const end=vector(...leverPullGrip(config,sign,angle));
      const outer=vector(...leverPullGrip(config,sign,angle,width));
      member(pivot,outer);
      inward(outer,end);
      if(grip) grip.position.copy(end);
      const counter=outer.clone().sub(pivot).normalize().multiplyScalar(config.radius*(deadlift?.365:.40)).add(pivot);
      moveHorn(pivot,counter);
      plate.position.copy(counter).add(vector(sign*.052,0,0));
      collar.position.copy(counter).add(vector(sign*.081,0,0));
    };
  });
  const footplate=hip?slab(root,.463,.280,.067,vector(0,0,0),dark):null;
  return (angles)=>{
    axes.forEach((update,index)=>update(angles[index]));
    if(footplate){
      footplate.position.copy(vector(...leverPullGrip(config,0,angles[0])));
      footplate.rotation.x=-angles[0]*.43;
    }
  };
}

export function buildLeverPull(root,preset) {
  if (!preset) return null;
  const config = leverPulls[preset];
  const machine = new THREE.Group();
  machine.name = config.stack ? 'Selectorized lever pull machine' : 'Plate-loaded lever pull machine';
  root.add(machine);
  if (config.tBar) return buildTBar(machine,config);
  if (config.preacher || config.pullover) return buildPostureLever(machine,config);
  if (config.utility) return buildUtilityLever(machine,config);
  seatedRig(machine,config);
  let stackBlock;
  let stackCable;
  if(config.stack){
    const x=.64,z=.539;
    slab(machine,.250,.064,.244,vector(x,.045,z),metal);
    slab(machine,.250,.064,.244,vector(x,1.39,z),metal);
    for(const dx of [-.085,.085])link(machine,vector(x+dx,.073,z),vector(x+dx,1.386,z),.014,hardware);
    for(let i=0;i<11;i++)slab(machine,.193,.035,.163,vector(x,.104+i*.040,z),dark);
    stackBlock=slab(machine,.201,.121,.169,vector(x,.624,z),plateColor);
    const header=vector(x,1.355,z);
    const pivotFeed=vector(.545,config.pivotY+.058,config.pivotZ);
    link(machine,header,pivotFeed,.011,hardware);
    const draw=link(machine,header,header,.007,dark);
    stackCable=()=>draw(header,stackBlock.position.clone().add(vector(0,.062,0)));
  }
  const updates = [-1,1].map((sign) => {
    const pivot = vector(sign*.545,config.pivotY,config.pivotZ);
    slab(machine,.116,.078,.752,vector(sign*.545,.044,config.pivotZ-.11),dark);
    slab(machine,.074,config.pivotY+.088,.083,vector(sign*.545,(config.pivotY+.088)/2,config.pivotZ),metal);
    const pivotAxis = config.diagonal ? vector(.932, -sign*.362, 0) : vector(1,0,0);
    pin(machine,.074,.098,pivot,hardware,pivotAxis);
    pin(machine,.031,.119,pivot,dark,pivotAxis);

    const moveMember = link(machine,pivot,pivot,.057,metal);
    const moveBracket = link(machine,pivot,pivot,.034,metal);
    const moveArm = link(machine,pivot,pivot,.060,metal);
    const grip = pin(machine,.024,.111,pivot, dark, config.neutral ? vector(0,1,0) : vector(1,0,0));
    const collar = config.stack ? null : pin(machine,.024,.219,pivot,hardware);
    const plates = config.stack ? [] : [0,1].map(() => pin(machine,config.heavy ? .172 : .122,.036,pivot,plateColor));
    return (angle) => {
      const tip = vector(...leverPullGrip(config,sign,angle));
      const outer = vector(...leverPullGrip(config,sign,angle,.545));
      moveMember(pivot,outer);
      moveBracket(outer,tip);
      grip.position.copy(tip);
      const radial = outer.clone().sub(pivot).normalize();
      const opposite = config.raisedPeg ? vector(0,-radial.z,radial.y).multiplyScalar(.257).add(pivot)
        : radial.multiplyScalar(config.heavy ? -.36 : -.28).add(pivot);
      moveArm(pivot,opposite);
      if(collar)collar.position.copy(opposite).add(vector(sign*.079,0,0));
      plates.forEach((plate,index) => plate.position.copy(opposite).add(vector(sign*(.051+index*.042),0,0)));
    };
  });
  link(machine,vector(-.545,.081,config.pivotZ),vector(.545,.081,config.pivotZ),.08,metal);
  if (config.overhead) {
    link(machine,vector(-.545,config.pivotY+.08,config.pivotZ),vector(.545,config.pivotY+.08,config.pivotZ),.072,metal);
  }
  const bridge = config.overhead && config.under && !config.independent
    ? link(machine,vector(0,0,0),vector(0,0,0),.024,hardware) : null;
  return (angles) => {
    updates.forEach((update,index) => update(angles[index]));
    if(stackBlock){
      stackBlock.position.y=.624+.147*Math.max(...angles.map(angle=>Math.abs(angle-config.arc)));
      stackCable();
    }
    if (bridge) bridge(
      vector(...leverPullGrip(config,-1,angles[0])),
      vector(...leverPullGrip(config,1,angles[1])),
    );
  };
}
