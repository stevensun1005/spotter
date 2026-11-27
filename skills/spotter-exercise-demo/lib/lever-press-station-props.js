import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const steel = new THREE.MeshStandardMaterial({color:0xb7c2bb,roughness:.43,metalness:.31});
const frame = new THREE.MeshStandardMaterial({color:0x52625a,roughness:.56,metalness:.20});
const pad = new THREE.MeshStandardMaterial({color:0x303b34,roughness:.85});
const resistance = new THREE.MeshStandardMaterial({color:0x71977c,roughness:.81});
const up = new THREE.Vector3(0,1,0);
const vec = (point) => new THREE.Vector3(...point);

function create(group, geometry, material, location) {
  const object = new THREE.Mesh(geometry,material);
  object.position.copy(vec(location));
  object.castShadow = object.receiveShadow = true;
  group.add(object);
  return object;
}

const box = (group, size, material, position) =>
  create(group,new RoundedBoxGeometry(...size,2,.012),material,position);

function rod(group,radius,material) {
  return create(group,new THREE.CylinderGeometry(radius,radius,1,18),material,[0,0,0]);
}

function connect(rod,start,end) {
  const delta = end.clone().sub(start);
  rod.position.copy(start).lerp(end,.50);
  rod.scale.y = delta.length();
  rod.quaternion.setFromUnitVectors(up,delta.normalize());
}

function beam(group,radius,material,start,end) {
  connect(rod(group,radius,material),vec(start),vec(end));
}

function makeSeat(group,withShoulders) {
  const seat=box(group,[.415,.083,.407],pad,[0,0,0]);
  const back=box(group,[.432,.575,.101],pad,[0,0,0]);
  const rise=withShoulders?null:rod(group,.057,steel);
  const rails=[-1,1].map(sign=>({
    sign,
    grip:rod(group,.022,pad),
    handleStem:rod(group,.027,steel),
    shoulderStem:withShoulders?rod(group,.043,frame):null,
    shoulder:withShoulders?box(group,[.145,.108,.226],pad,[0,0,0]):null,
  }));
  return pose=>{
    const hip=vec(pose.hips);
    const spine=vec(pose.neck).sub(hip).normalize();
    const front=new THREE.Vector3(0,-spine.z,spine.y);
    seat.position.copy(hip).add(vec([0,-.119,.079]));
    back.position.copy(hip).addScaledVector(spine,.278).addScaledVector(front,-.143);
    back.rotation.x=Math.atan2(spine.z,spine.y);
    if(rise) connect(rise,vec([0,.154,hip.z]),seat.position);
    for(const {sign,grip,handleStem,shoulderStem,shoulder} of rails){
      const side=sign>0?'l':'r';
      const wrist=vec(pose[side+'w']);
      const along=withShoulders?vec([.076,0,0]):vec([0,0,.102]);
      connect(grip,wrist.clone().sub(along),wrist.clone().add(along));
      if(shoulder){
        shoulder.position.copy(vec(pose[side+'s'])).add(vec([sign*.011,.086,.02]));
        shoulder.rotation.x=back.rotation.x;
        const upright=back.position.clone().addScaledVector(spine,.223).add(vec([sign*.216,.024,0]));
        connect(shoulderStem,upright,shoulder.position.clone().add(vec([sign*.052,.044,-.036])));
        connect(handleStem,wrist.clone().add(vec([sign*.062,0,0])),upright);
      }else{
        const seatBracket=seat.position.clone().add(vec([sign*.200,.002,.078]));
        connect(handleStem,seatBracket,wrist);
      }
    }
  };
}

export function buildPressStation(group,preset,initial) {
  if(preset.startsWith('hack-')) return buildSquatStation(group,preset.slice(5),initial);
  if(preset.startsWith('ghd-')) return buildGhdStation(group,initial);
  if(preset.startsWith('belt-')) return buildBeltStation(group,preset.slice(5),initial);
  if(preset.startsWith('thrust-')) return buildThrustStation(group,preset.slice(7),initial);
  if(preset.startsWith('reformer-')) return buildReformer(group,preset.slice(9),initial);
  if(preset.startsWith('axial-')) return buildAxial(group,preset.slice(6),initial);
  if(preset.startsWith('special-leg-')) return buildSpecialLeg(group,preset.slice(12),initial);
  if(preset.startsWith('special-upper-')) return buildSpecialUpper(group,preset.slice(14),initial);
  const movingSeat=preset==='seat';
  const outdoor=preset==='outdoor';
  const angled=preset==='angled'||preset==='calf-angled';
  const arc=outdoor||angled||movingSeat;
  const calf=preset.startsWith('calf');
  const platform=box(group,[.697,calf?.206:.407,.071],frame,[0,0,0]);
  platform.rotation.x=angled?-.60:0;
  const ridges=Array.from({length:calf?4:6},()=>
    box(group,[.624,.012,.013],steel,[0,0,0]));
  const updateSeat=makeSeat(group,movingSeat);
  updateSeat(initial);
  for(const z of [-.55,1.20])box(group,[.915,.069,.173],frame,[0,.035,z]);
  for(const x of [-.366,.366]){
    box(group,[.068,.065,1.81],steel,[x,.043,.32]);
    if(!arc) {
      beam(group,.020,steel,[x,.269,.487],[x,.269,1.246]);
      beam(group,.032,frame,[x,.073,1.153],[x,.270,1.153]);
    }
  }
  const linkage=initial.leverPressHandles.map(({pivot},index)=>{
    const sign=index===0?1:-1;
    const mast=vec(pivot);
    beam(group,.051,steel,[sign*.454,.087,pivot[2]],[sign*.454,pivot[1],pivot[2]]);
    beam(group,.042,steel,[sign*.454,pivot[1],pivot[2]],pivot);
    const arm=rod(group,.035,frame);
    const weight=outdoor?null:create(group,new THREE.CylinderGeometry(.145,.145,.049,36),pad,[0,0,0]);
    if(weight)weight.rotateZ(Math.PI/2);
    return {sign,mast,arm,weight};
  });
  return pose=>{
    if(movingSeat)updateSeat(pose);
    const left=vec(pose.leverPressHandles[0].point);
    const right=vec(pose.leverPressHandles[1].point);
    platform.position.copy(left).lerp(right,.50);
    const surfaceUp=vec([0,Math.cos(platform.rotation.x),Math.sin(platform.rotation.x)]);
    const surfaceNormal=vec([0,-Math.sin(platform.rotation.x),Math.cos(platform.rotation.x)]);
    for(const [index,ridge] of ridges.entries()){
      ridge.position.copy(platform.position)
        .addScaledVector(surfaceUp,(index-(ridges.length-1)/2)*(calf?.042:.065))
        .addScaledVector(surfaceNormal,-.040);
      ridge.rotation.x=platform.rotation.x;
    }
    for(const [index,{sign,mast,arm,weight}] of linkage.entries()){
      const tip=vec(pose.leverPressHandles[index].point);
      if(movingSeat)tip.copy(vec(pose.hips)).add(vec([sign*.372,-.128,-.159]));
      if(!arc){
        connect(arm,vec([sign*.366,.269,tip.z+.045]),tip);
      }else{
        connect(arm,mast,tip);
      }
      if(weight)weight.position.copy(arc?mast.clone().lerp(tip,.42):tip)
        .add(vec([sign*.128,-.083,.126]));
    }
  };
}

function stanceDeck(group,x,y,z,width,depth) {
  box(group,[width,y,depth],frame,[x,y/2,z]);
  for(let i=0;i<8;i++)
    box(group,[width-.044,.008,.012],steel,[x,y+.004,z+(i-3.5)*(depth-.102)/8]);
}

function buildReformer(group,preset,initial) {
  const standing=preset==='standing';
  const straps=preset==='hands'||preset==='feet';
  const [,top]=initial.leverPressHandles[0].point;
  const y=top-.119;
  for(const x of [-.335,.335]){
    box(group,[.079,.103,2.236],frame,[x,y,-.157]);
    box(group,[.024,.018,2.151],steel,[x-Math.sign(x)*.048,y+.059,-.157]);
    for(const z of [-1.151,.877]){
      box(group,[.074,.350,.081],steel,[x,.186,z]);
      box(group,[.091,.058,.138],pad,[x,.033,z]);
    }
  }
  for(const z of [-1.190,.922])box(group,[.722,.085,.095],frame,[0,y,z]);
  const carriage=new THREE.Group();
  group.add(carriage);
  box(carriage,[.611,.071,.921],pad,[0,top-.036,0]);
  box(carriage,[.671,.046,.793],steel,[0,top-.082,.018]);
  for(const x of [-.322,.322])for(const z of [-.271,.277]) {
    const wheel=create(carriage,new THREE.CylinderGeometry(.034,.034,.036,17),pad,[x,top-.112,z]);
    wheel.rotateZ(Math.PI/2);
  }
  if(!standing){
    box(carriage,[.294,.034,.218],frame,[0,top+.017,-.351]);
    for(const x of [-.233,.233])
      box(carriage,[.092,.137,.075],pad,[x,top+.066,-.268]);
    beam(group,.038,pad,[-.266,.572,.865],[.266,.572,.865]);
    for(const x of [-.278,.278]){
      beam(group,.028,steel,[x,y,.774],[x,.572,.863]);
      beam(group,.025,steel,[x,y,.928],[x,.572,.863]);
    }
  }else{
    box(group,[.571,.064,.351],pad,[0,top-.032,.824]);
    for(const offset of [-.114,-.071,-.028,.015,.058,.101])
      box(group,[.496,.009,.011],frame,[0,top+.003,.828+offset]);
  }
  const springs=[-.122,-.060,0,.060,.122].map(x=>({
    x,link:rod(group,.018,steel),end:rod(group,.015,frame),
  }));
  const loops=straps?[-1,1].map(sign=>{
    const x=sign*.336;
    const origin=vec([x,top+.217,-1.164]);
    const upright=rod(group,.023,steel);
    connect(upright,vec([x,y,-1.165]),origin);
    const guide=create(group,new THREE.CylinderGeometry(.038,.038,.041,20),frame,origin.toArray());
    guide.rotateZ(Math.PI/2);
    const loop=create(group,new THREE.TorusGeometry(.062,.011,10,26),pad,origin.toArray());
    return {sign,x,origin,draw:rod(group,.007,frame),returnLine:rod(group,.006,frame),loop};
  }):[];
  return (pose)=>{
    const z=pose.leverPressHandles[0].point[2];
    carriage.position.z=z;
    for(const {x,link,end} of springs){
      const start=vec([x,top-.103,.713]);
      const restraint=vec([x,top-.103,z+.403]);
      const near=start.clone().lerp(restraint,.86);
      connect(link,start,near);
      connect(end,near,restraint);
    }
    for(const {sign,x,origin,draw,returnLine,loop} of loops){
      const side=sign>0?'l':'r';
      let target=vec(pose[side+'w']);
      if(preset==='feet')target=vec(pose[side+'a']).lerp(vec(pose[side+'t']),.62);
      loop.position.copy(target);
      loop.rotation.set(0,Math.PI/2,0);
      if(preset==='feet'){
        const foot=vec(pose[side+'t']).sub(vec(pose[side+'a'])).normalize();
        loop.quaternion.setFromUnitVectors(vec([0,0,1]),foot);
      }
      connect(draw,origin,target.clone().add(vec([-sign*.022,0,-.044])));
      connect(returnLine,origin,vec([x*.76,top-.092,z-.378]));
    }
  };
}

function loadSleeve(group,heavy) {
  const shaft=rod(group,.026,steel);
  const weights=(heavy?[.161,.145,.135]:[.145,.127]).map(radius=>{
    const plate=create(group,new THREE.CylinderGeometry(radius,radius,.043,32),pad,[0,0,0]);
    plate.rotateZ(Math.PI/2);
    return plate;
  });
  return (origin,sign)=>{
    connect(shaft,origin,origin.clone().add(vec([sign*(heavy?.248:.191),0,0])));
    for(const [i,plate] of weights.entries())
      plate.position.copy(origin).add(vec([sign*(.056+i*.042),0,0]));
  };
}

function buildSpecialUpper(group,preset,initial) {
  const cable=preset.startsWith('cable-');
  const neck=preset.startsWith('neck-');
  const standing=['fly-standing','fly-lateral','hinge'].includes(preset);
  const lying=preset==='chest-lying';
  const unilateral=preset==='unilateral-row';
  const sideways=preset==='chest-side'||preset==='fly-side';
  const preacher=preset==='turned-preacher';
  const reverseFly=['fly-bent','fly-side','fly-incline'].includes(preset);
  const lateral=preset==='fly-lateral';
  const back=!standing&&!lying&&!unilateral&&!preacher&&!reverseFly;
  for(const z of [-.714,.623])box(group,[.988,.069,.147],frame,[0,.038,z]);
  for(const x of [-.467,.467])box(group,[.076,.065,1.516],steel,[x,.046,-.038]);
  if(lying){
    box(group,[.448,.097,1.084],pad,[0,.448,-.172]);
    for(const z of [.271,-.575])beam(group,.052,steel,[0,.082,z],[0,.414,z]);
  }else if(unilateral){
    box(group,[.364,.081,.655],pad,[.179,.429,-.129]);
    beam(group,.061,steel,[.179,.072,-.106],[.179,.390,-.106]);
    const wrist=initial.lw;
    beam(group,.036,steel,[.266,.078,.641],[wrist[0],wrist[1],wrist[2]+.077]);
    beam(group,.022,pad,[wrist[0],wrist[1],wrist[2]-.059],[wrist[0],wrist[1],wrist[2]+.077]);
  }else if(!standing){
    box(group,[.424,.078,.382],pad,[0,.451,-.091]);
    beam(group,.060,steel,[0,.077,-.073],[0,.412,-.073]);
  }
  if(back){
    const position=sideways?[0,.738,-.251]:[0,.811,-.238];
    box(group,[.397,.519,.089],pad,position);
    beam(group,.046,steel,[0,.073,position[2]],[0,.724,position[2]]);
  }
  if(reverseFly){
    const bend=preset==='fly-bent';
    const contact=sideways?[.211,.792,-.076]:[0,bend?.788:.846,bend?.251:.195];
    const rest=box(group,[.386,.394,.086],pad,contact);
    rest.rotation.set(bend?-.805:-.35,sideways?Math.PI/2:0,0);
    beam(group,.041,steel,[contact[0],.073,.459],[contact[0],contact[1]-.059,contact[2]]);
  }
  if(preacher){
    box(group,[.441,.086,.362],pad,[.089,.757,.304],.485);
    beam(group,.048,steel,[.092,.075,.348],[.092,.711,.349]);
  }
  if(standing)stanceDeck(group,0,.006,.151,.809,.398);
  if(cable)return buildUpperCable(group,preset,initial);
  const banded=preset==='chest-band';
  const outdoor=preset==='chest-outdoor';
  const sites=initial.leverPressHandles.map(({pivot},index)=>{
    const sign=index===0?1:-1;
    const active=unilateral?index===1:preset==='neck-right'?index===1:
      sideways||preacher||neck?index===0:true;
    const anchor=vec(pivot);
    beam(group,.048,steel,[pivot[0],.071,pivot[2]],pivot);
    box(group,[.121,.106,.129],frame,pivot);
    if(!active)return null;
    const arm=rod(group,.033,steel);
    const load=outdoor?null:loadSleeve(group,false);
    const grip=neck||lateral?null:rod(group,.021,pad);
    const bearing=neck||lateral?box(group,neck?[.174,.152,.095]:[.132,.149,.236],pad,[0,0,0]):null;
    const elastic=banded?rod(group,.012,resistance):null;
    return {sign,index,anchor,arm,load,grip,bearing,elastic};
  }).filter(Boolean);
  return (pose)=>{
    for(const {sign,index,anchor,arm,load,grip,bearing,elastic} of sites){
      const point=vec(pose.leverPressHandles[index].point);
      const joint=point.clone().add(vec([sign*.057,lateral?.039:-.038,-.025]));
      if(bearing) {
        bearing.position.copy(point);
        if(lateral)bearing.position.z-=.074;
        if(neck&&preset!=='neck-back')bearing.rotation.y=Math.PI/2;
      }
      connect(arm,anchor,joint);
      if(grip){
        const axis=sideways||preset.startsWith('fly-')?vec([0,.059,0])
          :unilateral||preset==='hinge'||preset==='seated-shrug'?vec([0,0,.069]):vec([.071,0,0]);
        connect(grip,point.clone().sub(axis),point.clone().add(axis));
      }
      if(load)load(anchor.clone().lerp(joint,.44),sign);
      if(elastic)connect(elastic,vec([sign*.364,.169,-.467]),joint);
    }
  };
}

function buildUpperCable(group,preset,initial) {
  const overhead=preset==='cable-shoulder'||preset==='cable-triceps';
  const wide=preset==='cable-cross-lat';
  const rope=preset==='cable-rope-lat';
  const outdoor=preset==='cable-out-lat';
  const top=overhead?1.967:2.066;
  const baseZ=overhead?-.407:.509;
  const columnX=wide?.699:.469;
  const singlePulley=rope||preset==='cable-lat';
  const outlet=preset==='cable-shoulder'?.352:preset==='cable-triceps'?.683:top-.057;
  if(!overhead){
    for(const x of [-.159,.159]){
      beam(group,.047,pad,[x-.112,.596,.227],[x+.112,.596,.227]);
      beam(group,.029,steel,[x*.89,.081,.462],[x,.596,.242]);
    }
  }
  const center=vec([0,top-.065,baseZ-.095]);
  box(group,[2*columnX+.067,.075,.111],steel,[0,top-.032,baseZ]);
  for(const side of [-1,1])beam(group,.036,steel,[side*columnX,.071,baseZ],[side*columnX,top,baseZ]);
  const motion=initial.leverPressHandles.map(({pivot},index)=>{
    const sign=index===0?1:-1;
    const anchor=outdoor?vec(pivot):vec([sign*(wide?-columnX:columnX),outlet,baseZ]);
    return {sign,anchor,line:singlePulley?null:rod(group,outdoor?.034:.007,outdoor?steel:frame),
      grip:rod(group,.023,pad),ropeTail:rope?rod(group,.012,pad):null,
      plates:outdoor?loadSleeve(group,false):null};
  });
  const shared=wide||rope||overhead?null:rod(group,.015,pad);
  const cableCenter=wide||overhead||outdoor?null:rod(group,.008,frame);
  const bottom=vec([.590,.142,baseZ+.135]);
  const topWire=vec([.590,1.506,baseZ+.135]);
  let stack=null;
  let weightLine=null;
  if(!outdoor){
    box(group,[.216,.072,.256],frame,[bottom.x,.054,bottom.z]);
    for(const offset of [-.073,.073])beam(group,.013,steel,
      [bottom.x+offset,bottom.y,bottom.z],[topWire.x+offset,topWire.y,topWire.z]);
    for(let i=0;i<10;i++) box(group,[.191,.037,.168],pad,[bottom.x,.118+i*.042,bottom.z]);
    stack=box(group,[.195,.036,.169],frame,[bottom.x,.560,bottom.z]);
    weightLine=rod(group,.007,frame);
    const feeder=vec([topWire.x,top-.066,topWire.z]);
    const outbound=overhead?vec([columnX,outlet,baseZ]):center;
    beam(group,.008,frame,topWire.toArray(),feeder.toArray());
    beam(group,.008,frame,feeder.toArray(),outbound.toArray());
  }
  return pose=>{
    const grips=pose.leverPressHandles.map(({point})=>vec(point));
    const middle=grips[0].clone().lerp(grips[1],.5);
    const fork=middle.clone().add(vec([0,.156,.022]));
    if(shared) connect(shared,grips[0].clone().add(vec([.095,0,0])),grips[1].clone().add(vec([-.095,0,0])));
    if(cableCenter)connect(cableCenter,center,rope?fork:middle);
    for(const [index,{sign,anchor,line,grip,ropeTail,plates}] of motion.entries()){
      const wrist=grips[index];
      const axis=wide||rope?vec([0,0,.061]):vec([.077,0,0]);
      connect(grip,wrist.clone().sub(axis),wrist.clone().add(axis));
      if(ropeTail)connect(ropeTail,fork,wrist);
      if(line)connect(line,anchor,wrist);
      if(plates)plates(anchor.clone().lerp(wrist,.46),sign);
    }
    if(stack){
      stack.position.y=.559+Math.abs(middle.y-.985)*.145;
      connect(weightLine,topWire,stack.position.clone().add(vec([0,.026,0])));
    }
  };
}

function buildSpecialLeg(group,preset,initial) {
  const hip=preset.startsWith('hip-');
  const footplate=preset==='hip-foot';
  const isolated=preset==='hip-front'||preset==='hip-rear';
  const inward=preset==='hip-in';
  const kneeling=preset.startsWith('kneeling-');
  const knees=preset==='kneeling-in';
  const squat=preset==='squat-hold';
  const prone=preset==='prone-curl-hyper';
  const stepping=preset==='stepper';
  const toe=preset==='seated-toe';
  const donkey=preset==='donkey';
  const edgeZ=prone?-.761:kneeling?-.583:-.313;
  const handleLine=prone?[.208,.611,.708]:kneeling?[.235,knees?1.147:1.009,.472]
    :stepping?[.262,1.225,.487]:toe?[.237,.799,.411]:
      donkey?[.259,.873,.741]:squat?[.248,1.13,.42]:[.239,1.097,.405];
  for(const z of [edgeZ,.702])box(group,[.946,.069,.144],frame,[0,.039,z]);
  for(const sign of [-1,1]){
    const x=sign*.423;
    box(group,[.074,.067,1.47],steel,[x,.043,(.702+edgeZ)/2]);
    const [w,h,z]=handleLine;
    const handle=[sign*w,h,z];
    const barEnd=[sign*(w+.091),h,z];
    beam(group,.043,steel,[x,.087,z+.109],barEnd);
    beam(group,.022,pad,barEnd,[handle[0]-sign*.061,h,z]);
  }
  if(footplate)stanceDeck(group,-.169,.084,.119,.298,.405);
  if(donkey)stanceDeck(group,0,.149,.323,.657,.258);
  if(squat)stanceDeck(group,0,.070,.133,.805,.411);
  if(kneeling&&!knees){
    box(group,[.304,.079,.434],pad,[-.132,.460,-.244]);
    beam(group,.042,steel,[-.132,.061,-.328],[-.132,.419,-.247]);
  }
  if(prone){
    box(group,[.453,.092,.909],pad,[0,.541,.426]);
    box(group,[.462,.079,.148],pad,[0,.536,-.090]);
    for(const z of [.093,.722])beam(group,.044,steel,[0,.061,z],[0,.491,z]);
  }
  if(toe){
    box(group,[.418,.075,.375],pad,[0,.442,-.038]);
    beam(group,.051,steel,[0,.093,-.046],[0,.401,-.046]);
    stanceDeck(group,0,.051,.421,.625,.243);
  }
  const links=initial.leverPressHandles.slice(0,hip?1:2).map(({pivot},index)=>{
    const sign=index===0?1:-1;
    const mount=vec(pivot);
    beam(group,.052,steel,[pivot[0],.067,pivot[2]],pivot);
    box(group,[.117,.134,.119],frame,pivot);
    const grip=rod(group,.033,steel);
    const size=stepping||footplate?[.209,.052,.288]:knees?[.196,.078,.294]:
      prone?[.174,.113,.130]:toe?[.139,.103,.197]:donkey?[.211,.103,.249]:[.128,.154,.123];
    const block=box(group,size,pad,[0,0,0]);
    const load=stepping?null:loadSleeve(group,false);
    return {sign,mount,block,grip,load};
  });
  return (pose)=>{
    for(const [index,{sign,mount,block,grip,load}] of links.entries()){
      const contact=vec(pose.leverPressHandles[index].point);
      if(footplate||stepping) contact.y-=.027;
      else if(knees)contact.y-=.058;
      else if(prone)contact.y+=.071;
      else if(toe)contact.y+=.074;
      else if(isolated||kneeling)contact.z+=preset==='hip-front'?.072:-.070;
      else if(!donkey)contact.x+=sign*(inward?-.074:.078);
      block.position.copy(contact);
      if(footplate)block.rotation.x=-.10;
      if(isolated||kneeling||prone){
        const side=index===0?'l':'r';
        const shin=vec(pose[side+'k']).sub(vec(pose[side+'a']));
        block.rotation.x=-Math.atan2(-shin.z,shin.y)*.66;
      }
      const joining=contact.clone().add(vec([sign*(stepping?.040:.069),-.031,0]));
      connect(grip,mount,joining);
      if(load)load(mount.clone().lerp(joining,toe?.03:.39),sign);
    }
  };
}

function buildAxial(group,preset,initial) {
  if(preset==='coaster'||preset==='swing')return axialKneeling(group,preset,initial);
  const lying=preset.startsWith('recline-');
  const rotation=preset.startsWith('rotation-');
  const standing=preset==='rotation-standing';
  const decline=preset==='recline-decline';
  const legs=preset==='recline-legs';
  const back=preset.startsWith('seat-back');
  const elbows=preset==='rotation-torso';
  const stack=preset==='recline-stack';
  const chest=preset==='seat-chest'||preset==='seat-full';
  const palms=preset==='seat-palms';
  const hasGrip=!decline&&preset!=='seat-back';
  const endZ=lying?-.962:-.449;
  for(const x of [-.463,.463]) {
    box(group,[.069,.058,1.132-endZ],steel,[x,.037,(endZ+1.107)*.5]);
  }
  for(const z of [endZ,.677])box(group,[.989,.063,.137],frame,[0,.039,z]);
  if(!lying&&!standing){
    box(group,[.419,.086,.361],pad,[0,.458,-.085]);
    beam(group,.063,steel,[0,.062,-.074],[0,.413,-.074]);
    if(preset==='rotation-trunk')for(const x of [-.221,.221])
      box(group,[.108,.113,.192],pad,[x,.538,-.016]);
    stanceDeck(group,0,.078,.478,.601,.348);
  }else if(standing)stanceDeck(group,0,.072,.047,.783,.581);
  if(lying){
    const center=decline?[0,.529,-.427]:[0,.488,-.370];
    box(group,[.465,.108,.949],pad,center).rotation.x=decline?-.31:0;
    for(const z of [-.677,-.143])beam(group,.052,steel,[0,.067,z],[0,center[1]-.059+(decline?.355*(z+.427):0),z]);
    if(decline){
      for(const sign of [-1,1]){
        beam(group,.027,pad,[sign*.052,.729,.533],[sign*.244,.729,.533]);
        beam(group,.028,pad,[sign*.031,.624,.409],[sign*.243,.624,.409]);
      }
      beam(group,.036,steel,[0,.068,.551],[0,.729,.533]);
    }else if(!legs)stanceDeck(group,0,.045,.575,.673,.351);
  }
  const controls=initial.leverPressHandles.map(({pivot},index)=>{
    const sign=index===0?1:-1;
    const pivotPoint=vec(pivot);
    beam(group,.039,steel,[pivot[0],.075,pivot[2]],pivot);
    const padSize=back?[.181,.220,.104]:chest?[.182,.166,.079]:elbows?[.119,.219,.180]:[.143,.103,.109];
    const block=decline?null:box(group,padSize,pad,[0,0,0]);
    const swing=decline?null:rod(group,.028,steel);
    const pin=hasGrip?rod(group,.022,pad):null;
    const stem=hasGrip?rod(group,.019,steel):null;
    const load=decline||stack?null:loadSleeve(group,false);
    return {pivotPoint,sign,block,swing,pin,stem,load};
  });
  let stackHead=null;
  let stackRun=null;
  let stackTop=null;
  if(stack){
    const x=.632;
    const z=-.744;
    box(group,[.240,.071,.218],frame,[x,.051,z]);
    stackTop=vec([x,.969,z]);
    for(const side of [-1,1])beam(group,.013,steel,[x+side*.078,.123,z],[x+side*.078,stackTop.y,z]);
    for(let i=0;i<9;i++)box(group,[.193,.036,.171],pad,[x,.116+i*.047,z]);
    stackHead=box(group,[.193,.047,.173],frame,[x,.533,z]);
    stackRun=rod(group,.006,frame);
  }
  return (pose)=>{
    const torso=vec(pose.neck).sub(vec(pose.hips)).normalize();
    const shoulderDirection=vec(pose.ls).sub(vec(pose.rs)).normalize();
    const direction=vec([0,0,1]).crossVectors(shoulderDirection,torso).normalize();
    for(const [index,{pivotPoint,sign,block,swing,pin,stem,load}] of controls.entries()){
      if(!block)continue;
      const fitting=vec(pose.leverPressHandles[index].point);
      const wrist=vec(pose[(index===0?'l':'r')+'w']);
      if(legs)fitting.add(vec([0,.099,.019]));
      if(palms)fitting.copy(wrist).add(vec([0,-.051,0]));
      block.position.copy(fitting);
      block.rotation.x=-Math.atan2(-torso.z,torso.y);
      if(rotation)block.rotation.y=Math.atan2(direction.x,direction.z);
      const outer=fitting.clone().add(vec([sign*(back?.117:.087),-.060,back?-.037:.019]));
      connect(swing,pivotPoint,outer);
      if(pin&&!palms){
        const end=wrist.clone().add(vec([sign*.065,0,0]));
        connect(pin,wrist.clone().sub(vec([sign*.063,0,0])),end);
        connect(stem,end,outer);
      }
      if(load)load(pivotPoint.clone().lerp(outer,.40),sign);
      if(stackHead&&index===0){
        stackHead.position.y=.529+Math.max(0,pose.neck[1]-.597)*.41;
        connect(stackRun,stackTop,stackHead.position.clone().add(vec([0,.028,0])));
      }
    }
  };
}

function axialKneeling(group,preset,initial) {
  const coast=preset==='coaster';
  for(const z of [-.637,.707])box(group,[.870,.064,.144],frame,[0,.038,z]);
  for(const x of [-.349,.349]){
    box(group,[.063,.067,1.486],steel,[x,.045,.022]);
    beam(group,.045,steel,[x,.092,.692],[x,coast?1.254:1.512,.620]);
    if(coast){
      box(group,[.133,.072,.259],pad,[x*.62,1.237,.273]);
      beam(group,.033,steel,[x,1.251,.619],[x*.67,1.250,.289]);
      beam(group,.023,pad,[x*.74,1.334,.485],[x*.45,1.334,.485]);
      const rail=(t)=>[x*.569,.378+.321*t+.042*t*(t-1),-.263+.237*t];
      for(let i=0;i<10;i++){
        beam(group,.025,steel,rail(-.19+i*.145),rail(-.19+(i+1)*.145));
      }
      beam(group,.036,steel,[x,.082,-.591],rail(-.19));
      beam(group,.038,steel,[x,.090,.231],rail(1.26));
    }
  }
  if(!coast){
    box(group,[.504,.091,.481],pad,[0,.466,-.350]);
    beam(group,.059,steel,[0,.074,-.332],[0,.419,-.334]);
  }
  const carrier=coast?box(group,[.456,.100,.394],pad,[0,0,0]):null;
  const arms=initial.leverPressHandles.map(({pivot})=>({
    pivot:vec(pivot),grip:rod(group,.022,pad),member:rod(group,.032,steel),
    load:loadSleeve(group,false),
  }));
  return (pose)=>{
    const paths=pose.leverPressHandles.map(({point})=>vec(point));
    if(carrier)carrier.position.copy(paths[0]).lerp(paths[1],.5).add(vec([0,-.091,-.062]));
    for(const [index,{pivot,grip,member,load}] of arms.entries()){
      const sign=index===0?1:-1;
      if(coast){
        const roller=paths[index].clone().add(vec([sign*.076,-.126,-.093]));
        const inner=roller.clone().add(vec([-sign*.097,0,0]));
        connect(grip,roller,inner);
        connect(member,inner,carrier.position);
        load(roller,sign);
      }else{
        const wrist=vec(pose[(index===0?'l':'r')+'w']);
        const outside=wrist.clone().add(vec([sign*.081,0,0]));
        connect(grip,wrist.clone().sub(vec([sign*.064,0,0])),outside);
        connect(member,pivot,outside);
        load(pivot.clone().lerp(outside,.36),sign);
      }
    }
  };
}

function buildBeltStation(group,preset,initial) {
  const split=preset==='split';
  const handled=preset==='v'||preset==='straight';
  for(const x of [-.277,.277])stanceDeck(group,x,.100,.173,.393,.790);
  for(const z of [-.791,.543])box(group,[1.040,.074,.144],frame,[0,.038,z]);
  for(const x of [-.445,.445]){
    box(group,[.081,.079,1.460],steel,[x,.041,-.113]);
    box(group,[.127,.254,.126],steel,[x,.132,-.769]);
    if(!handled){
      beam(group,.044,steel,[x,.09,.463],[x,1.167,.466]);
      beam(group,.021,pad,[x,1.112,.455],[Math.sign(x)*.237,1.112,.455]);
    }
  }
  if(split) {
    box(group,[.468,.077,.293],pad,[0,.387,-.725]);
    beam(group,.052,steel,[0,.064,-.746],[0,.349,-.726]);
    box(group,[.495,.067,.185],frame,[0,.033,-.749]);
  }
  const bar=handled?rod(group,.028,pad):null;
  const segments=Array.from({length:8},()=>rod(group,.043,pad));
  const linkShafts=initial.leverPressHandles.map(({pivot})=>({
    pivot:vec(pivot),arm:rod(group,.031,steel),load:loadSleeve(group,false),
  }));
  const coupler=rod(group,.028,steel);
  const chain=rod(group,.014,frame);
  const handleChain=handled?rod(group,.012,steel):null;
  const handleLine=handled?rod(group,.026,steel):null;
  const halfHandles=preset==='v'?[-1,1].map(()=>rod(group,.021,pad)):[];
  return (pose)=>{
    const waist=vec(pose.hips).add(vec([0,.075,.018]));
    const front=vec([0,0,1]);
    const beltLoc=(angle)=>waist.clone().add(vec([.170*Math.sin(angle),0,.131*Math.cos(angle)]));
    for(const [i,member] of segments.entries())
      connect(member,beltLoc(Math.PI*2*i/8),beltLoc(Math.PI*2*(i+1)/8));
    const buckle=beltLoc(0).add(vec([0,-.049,.019]));
    const tip=vec([0,Math.max(.121,buckle.y-.472),Math.max(-.13,buckle.z+.008)]);
    const innerL=tip.clone().add(vec([.161,0,0]));
    const innerR=tip.clone().add(vec([-.161,0,0]));
    connect(coupler,innerL,innerR);
    connect(chain,buckle,tip);
    for(const {pivot,arm,load} of linkShafts){
      const sign=Math.sign(pivot.x);
      const end=sign>0?innerL:innerR;
      connect(arm,pivot,end);
      load(pivot.clone().lerp(end,.57),sign);
    }
    if(handled){
      const left=vec(pose.lw);
      const right=vec(pose.rw);
      const apex=left.clone().lerp(right,.5).addScaledVector(front,preset==='v'?.095:0);
      if(preset==='v'){
        connect(bar,left,apex);
        connect(handleLine,right,apex);
        for(const [index,wrist] of [left,right].entries()){
          const along=apex.clone().sub(wrist).normalize().multiplyScalar(.065);
          connect(halfHandles[index],wrist.clone().sub(along),wrist.clone().add(along));
        }
      }else connect(bar,left.clone().add(vec([.073,0,0])),right.clone().add(vec([-.073,0,0])));
      connect(handleChain,tip,apex.clone().add(vec([0,-.007,0])));
    }
  };
}

function buildThrustStation(group,preset,initial) {
  const standing=preset==='standing';
  const step=preset==='step';
  const heavy=preset.startsWith('loaded-');
  const useBelt=preset.endsWith('belt')||preset==='band';
  const shoulderHeight=step?.622:.529;
  const rear=standing?.587:-.438;
  const fore=standing?-.406:1.036;
  for(const x of [-.485,.485])box(group,[.074,.065,1.550],steel,[x,.039,(rear+fore)/2]);
  for(const z of [rear,fore])box(group,[1.061,.066,.121],frame,[0,.036,z]);
  if(standing){
    for(const x of [-.355,.355]){
      beam(group,.044,steel,[x,.061,.519],[x,1.123,.484]);
      beam(group,.023,pad,[x,1.122,.448],[Math.sign(x)*.253,1.122,.448]);
    }
  }else{
    stanceDeck(group,0,.092,.779,.671,.557);
    if(step){
      for(const y of [.107,.151,.195])
        box(group,[.644,.044,.439],frame,[0,y,.752]);
      box(group,[.641,.018,.435],pad,[0,.212,.752]);
    }
    box(group,[.546,.111,.351],pad,[0,shoulderHeight-.055,-.328]);
    box(group,[.391,.106,.482],pad,[0,.208,.064]);
    for(const x of [-.171,.171]){
      beam(group,.044,steel,[x,.061,-.496],[x,shoulderHeight-.104,-.330]);
      beam(group,.037,steel,[x,.063,.158],[x,.161,.098]);
    }
  }
  const yoke=useBelt?rod(group,.034,pad):box(group,[.454,.100,.123],pad,[0,0,0]);
  const straps=Array.from({length:2},()=>rod(group,.033,pad));
  const thighBand=preset==='band'?Array.from({length:14},()=>rod(group,.011,resistance)):[];
  const linkage=initial.leverPressHandles.map(({pivot},index)=>{
    const sign=index===0?1:-1;
    beam(group,.051,steel,[sign*.493,.100,pivot[2]],[sign*.493,pivot[1],pivot[2]]);
    beam(group,.039,steel,[sign*.493,pivot[1],pivot[2]],pivot);
    return {pivot:vec(pivot),sign,arm:rod(group,.034,steel),
      grip:standing?null:rod(group,.020,pad), gripLink:standing?null:rod(group,.021,steel),
      load:loadSleeve(group,heavy)};
  });
  return (pose)=>{
    const left=vec(pose.leverPressHandles[0].point);
    const right=vec(pose.leverPressHandles[1].point);
    if(useBelt)connect(yoke,left,right);
    else yoke.position.copy(left).lerp(right,.5);
    for(const [index,{pivot,sign,arm,grip,gripLink,load}] of linkage.entries()){
      const contact=index===0?left:right;
      const control=contact.clone().add(vec([sign*.263,-.103,-.103]));
      connect(arm,pivot,control);
      connect(straps[index],control,contact);
      if(grip){
        const wrist=vec(pose[(index===0?'l':'r')+'w']);
        const farEnd=wrist.clone().add(vec([0,0,.082]));
        connect(grip,wrist.clone().add(vec([0,0,-.082])),farEnd);
        connect(gripLink,farEnd,contact.clone().lerp(control,.45));
      }
      load(pivot.clone().lerp(control,.69),sign);
    }
    if(thighBand.length){
      const legs=['l','r'].map(side=>({
        knee:vec(pose[side+'k']),hip:vec(pose[side+'h']),
      }));
      const axis=legs[0].knee.clone().sub(legs[0].hip)
        .add(legs[1].knee.clone().sub(legs[1].hip)).normalize();
      const crossSection=vec([0,-axis.z,axis.y]).normalize();
      const points=legs.flatMap(({knee,hip},side)=>Array.from({length:7},(_,index)=>{
        const angle=Math.PI*(index/6+side-.5);
        return knee.clone().lerp(hip,.24).add(vec([.076*Math.cos(angle),0,0]))
          .addScaledVector(crossSection,.076*Math.sin(angle));
      }));
      for(const [index,segment] of thighBand.entries())
        connect(segment,points[index],points[(index+1)%points.length]);
    }
  };
}

function buildGhdStation(group,initial) {
  const {pivot,point}=initial.leverPressHandles[0];
  const [,ankleY,ankleZ]=pivot;
  const [,padY,padZ]=point;
  const back=ankleZ-.108;
  const front=padZ+.178;
  box(group,[.687,.065,front-back+.108],steel,[0,.034,(front+back)/2]);
  for(const z of [back,front]) {
    box(group,[.871,.069,.137],frame,[0,.035,z]);
    for(const x of [-.391,.391])box(group,[.119,.070,.157],pad,[x,.038,z]);
  }
  box(group,[.094,padY-.241,.103],steel,[0,(padY-.241)/2+.071,padZ]);
  beam(group,.046,steel,[0,.077,front],[0,padY-.145,padZ]);
  beam(group,.039,steel,[0,.093,padZ-.307],[0,padY-.165,padZ]);
  box(group,[.516,.067,.294],frame,[0,padY-.165,padZ]);
  for(const sign of [-1,1]) {
    const cushion=create(group,new THREE.CylinderGeometry(.170,.170,.248,24),pad,[sign*.130,padY,padZ]);
    cushion.rotateZ(Math.PI/2);
    cushion.scale.z=1.14;
  }
  beam(group,.054,steel,[0,.066,back],[0,ankleY+.064,back]);
  beam(group,.039,steel,[0,.341,back],[0,.081,back+.310]);
  box(group,[.425,.290,.046],frame,[0,ankleY,back+.028]);
  for(const y of [-.086,-.045,0,.043,.088])box(group,[.372,.014,.009],steel,[0,ankleY+y,back+.054]);
  for(const y of [-.076,.076]) {
    beam(group,.025,steel,[-.272,ankleY+y,ankleZ-.004],[.272,ankleY+y,ankleZ-.004]);
    for(const sign of [-1,1]) {
      const roller=create(group,new THREE.CylinderGeometry(.055,.055,.190,24),pad,
        [sign*.131,ankleY+y,ankleZ]);
      roller.rotateZ(Math.PI/2);
    }
  }
  return null;
}

function buildSquatStation(group,style,initial) {
  const rotating=style==='arc'||style==='chair'||style==='pendulum'||style==='abduction'||
    style==='shrug'||style==='hinge';
  const vertical=style==='reverse';
  const reverseSlope=style==='reverse-slope';
  const forwardIntoPad=vertical||reverseSlope||style==='hinge';
  const calf=style==='calf';
  const deckZ=forwardIntoPad?.080:.213;
  if(calf)stanceDeck(group,0,.151,.449,.720,.216);
  else{
    box(group,[.727,.113,.572],frame,[0,.057,deckZ]);
    for(let i=0;i<11;i++)box(group,[.655,.008,.019],steel,[0,.116,(forwardIntoPad?-.174:-.041)+i*.049]);
  }
  const cushion=box(group,[.430,.652,.099],pad,[0,0,0]);
  if(style==='chair') {
    box(group,[.542,.074,.324],pad,[0,.369,-.305]);
    box(group,[.079,.329,.081],steel,[0,.186,-.305]);
    box(group,[.548,.059,.274],frame,[0,.032,-.305]);
  }
  for(const z of [-.636,.536])box(group,[1.08,.066,.137],frame,[0,.035,z]);
  const abduction=style==='abduction'?[-1,1].map(sign=>({
    sign,pad:box(group,[.13,.186,.123],pad,[0,0,0]),brace:rod(group,.026,steel),
  })):[];
  const fittings=initial.leverPressHandles.map(({pivot},index)=>{
    const side=index===0?'l':'r';
    const sign=Math.sign(pivot[0]);
    const x=sign*.452;
    box(group,[.089,.066,1.20],steel,[x,.048,-.054]);
    const bearing=vec(pivot);
    const link=rod(group,.041,steel);
    const shoulder=box(group,[.163,.106,.262],pad,[0,0,0]);
    const grip=rod(group,.022,pad);
    const handGuide=rod(group,.028,steel);
    const padGuide=rod(group,.042,frame);
    const carriage=rotating?null:box(group,[.142,.158,.148],frame,[0,0,0]);
    const plate=create(group,new THREE.CylinderGeometry(.157,.157,.061,32),pad,[0,0,0]);
    plate.rotateZ(Math.PI/2);
    if(rotating) {
      const height=pivot[1]-.067;
      box(group,[.087,height,.094],steel,[x,.064+height*.50,pivot[2]]);
      box(group,[.162,.110,.122],frame,pivot);
    } else {
      const bottom=vec([x,.205,vertical?-.289:reverseSlope?-.165:-.500]);
      const top=vec([x,1.869,vertical?-.289:reverseSlope?-.520:.434]);
      connect(rod(group,.037,steel),bottom,top);
      connect(rod(group,.051,frame),top,vec([x,.073,-.568]));
      for(const stop of [.25,.44,.62,.81]) {
        const offset=bottom.clone().lerp(top,stop);
        box(group,[.153,.049,.088],frame,offset.toArray());
      }
    }
    return {sign,side,bearing,link,shoulder,grip,handGuide,padGuide,plate,carriage};
  });
  return pose=>{
    const hip=vec(pose.hips);
    const body=vec(pose.neck).sub(hip).normalize();
    const dx=forwardIntoPad?.126:.129;
    cushion.position.copy(hip).addScaledVector(body,.246).add(vec([0,-.013,-dx]));
    cushion.rotation.x=Math.atan2(body.z,body.y);
    for(const [index,{sign,side,bearing,link,shoulder,grip,handGuide,padGuide,plate,carriage}] of fittings.entries()){
      const device=vec(pose.leverPressHandles[index].point);
      const hand=vec(pose[side+'w']);
      const outer=vec([sign*.450,device.y-.021,device.z-.033]);
      shoulder.position.copy(device);
      shoulder.rotation.x=cushion.rotation.x;
      const shoulderRoot=cushion.position.clone().addScaledVector(body,.266).add(vec([sign*.229,0,.030]));
      connect(padGuide,shoulderRoot,device.clone().add(vec([sign*.058,.019,-.071])));
      connect(grip,hand.clone().add(vec([0,0,-.078])),hand.clone().add(vec([0,0,.078])));
      connect(handGuide,outer,hand.clone().add(vec([sign*.059,0,0])));
      if(rotating){
        connect(link,bearing,outer);
        plate.position.copy(bearing).lerp(outer,.58).add(vec([sign*.097,-.062,.056]));
      } else {
        const slide=(device.y-.205)/1.664;
        const frameZ=vertical?-.289:reverseSlope?-.165-.355*slide:-.50+.934*slide;
        const trolley=vec([sign*.452,device.y,frameZ]);
        connect(link,trolley,outer);
        carriage.position.copy(trolley);
        plate.position.copy(trolley).add(vec([sign*.093,-.146,0]));
      }
    }
    for(const {sign,pad:stop,brace} of abduction){
      const knee=vec(pose[sign>0?'lk':'rk']);
      stop.position.copy(knee).add(vec([sign*.071,.026,-.054]));
      connect(brace,vec([sign*.474,.071,.553]),stop.position);
    }
  };
}
