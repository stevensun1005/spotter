import * as T from 'three';

const material=(color,roughness=.53,metalness=.16)=>new T.MeshStandardMaterial({color,roughness,metalness});
const pale=material(0xa8b5a9,.51,.22), green=material(0x496254,.72), black=material(0x303836,.85), silver=material(0xd4dad5,.33,.45), band=material(0x3f7565,.8,0);
const axis=new T.Vector3(0,1,0);
const vec=p=>new T.Vector3(...p);

function mesh(group,geometry,surface,center=[0,0,0]){
 const item=new T.Mesh(geometry,surface);
 item.position.set(...center); item.castShadow=true; item.receiveShadow=true; group.add(item);
 return item;
}

const box=(g,surface,dimensions,center)=>mesh(g,new T.BoxGeometry(...dimensions),surface,center);
const cylinder=(g,surface,radius,height,center)=>mesh(g,new T.CylinderGeometry(radius,radius,height,24),surface,center);

function connect(item,a,b){
 const direction=new T.Vector3().subVectors(b,a);
 item.position.copy(a).lerp(b,.5);
 item.scale.y=direction.length();
 item.quaternion.setFromUnitVectors(axis,direction.normalize());
}

function fixedBar(g,m,r,a,b){
 const element=cylinder(g,m,r,1,[0,0,0]);
 connect(element,vec(a),vec(b));
 return element;
}

function crossCylinder(group,mat,r,len,center){
 const result=cylinder(group,mat,r,len,center);
 result.rotateZ(Math.PI/2);
 return result;
}

export function buildCardio(group,options){
 if(options.indoorBike){
  for(const z of [-.48,.42]){
   const rail=crossCylinder(group,black,.027,.60,[0,.038,z]);
   rail.castShadow=true;
   for(const x of [-.30,.30]) crossCylinder(group,green,.035,.065,[x,.038,z]);
  }
  for(const [a,b] of [
   [[0,.067,-.48],[0,.176,.47]],[[0,.10,-.30],[0,.86,-.19]],[[0,.14,.45],[0,.94,.43]],
   [[0,.34,.07],[0,.59,.43]],[[0,.35,.07],[0,.68,-.23]],
  ]) fixedBar(group,pale,.042,a,b);
  crossCylinder(group,black,.236,.128,[0,.28,.31]);
  crossCylinder(group,pale,.183,.139,[0,.28,.31]);
  for (const x of [-.076,.076]) crossCylinder(group,silver,.078,.018,[x,.28,.31]);
  crossCylinder(group,green,.112,.17,[0,.38,.055]);
  fixedBar(group,silver,.026,[0,.78,-.19],[0,.936,-.219]);
  box(group,black,[.172,.053,.283],[0,.952,-.216]);
  box(group,green,[.164,.025,.17],[0,.951,.434]).rotation.x=-.28;
  fixedBar(group,silver,.024,[-.277,1.17,.415],[.277,1.17,.415]);
  fixedBar(group,green,.039,[0,.90,.43],[0,1.116,.415]);
  for(const x of [-.225,.225]){
   fixedBar(group,silver,.025,[x,1.17,.415],[x,1.17,.232]);
   fixedBar(group,black,.033,[x,1.17,.350],[x,1.17,.205]);
  }
  const pedals=Object.fromEntries(['l','r'].map((side)=>{
   const sign=side==='l'?1:-1;
   const stem=cylinder(group,silver,.022,1,[0,0,0]);
   const spindle=crossCylinder(group,silver,.015,.106,[0,0,0]);
   const deck=box(group,black,[.092,.019,.123],[0,0,0]);
   return [side,{sign,stem,spindle,deck}];
  }));
  return p=>{
   for(const [side,{sign,stem,spindle,deck}] of Object.entries(pedals)){
    const ankle=p[side+'a'];
    const foot=[sign*.142,ankle[1]-.070,ankle[2]+.063];
    connect(stem,vec([sign*.104,.381,.055]),vec([sign*.104,foot[1],foot[2]]));
    spindle.position.set(sign*.123,foot[1],foot[2]);
    deck.position.set(...foot);
   }
  };
 }
 if(options.treadmill){
  box(group,black,[.83,.128,1.87],[0,.064,.015]);
  box(group,green,[.83,.042,1.84],[0,.117,.014]);
  box(group,black,[.717,.016,1.59],[0,.135,.015]);
  box(group,pale,[.81,.078,.27],[0,.153,.807]);
  for(const x of [-.40,.4]){
   fixedBar(group,pale,.034,[x,.143,.696],[x,1.029,.76]);
   fixedBar(group,green,.028,[x,1.034,.753],[x,1.033,.25]);
   fixedBar(group,black,.034,[x,1.032,.57],[x,1.031,.253]);
   box(group,silver,[.053,.008,1.57],[x,.143,.014]);
  }
  fixedBar(group,pale,.026,[-.40,1.03,.75],[.4,1.03,.75]);
  box(group,green,[.53,.052,.246],[0,1.084,.729]).rotation.x=-.39;
  box(group,black,[.441,.016,.171],[0,1.114,.724]).rotation.x=-.39;
  const panel=material(0x79a59b,.45);
  box(group,panel,[.234,.004,.072],[0,1.128,.733]).rotation.x=-.39;
  const beltStripes=Array.from({length:12},()=>box(group,green,[.042,.0019,.007],[.325,.145,0]));
  const red=material(0x9e633c,.65,.06);
  const key=options.runningClip?box(group,red,[.029,.024,.023],[.105,.978,.71]):null;
  const cord=key?cylinder(group,red,.003,1,[0,0,0]):null;
  return p=>{
   for(let i=0;i<beltStripes.length;i++){
    const traveled=(p.machineTravel??0);
    const z=.766-((i*.129+traveled)%1.548);
    beltStripes[i].position.z=z;
   }
   if(cord)connect(cord,vec([.105,.981,.709]),vec(p.hips).add(new T.Vector3(.075,.020,.041)));
  }
 }
 if(options.elliptical){
  for(const z of [-.54,.52])crossCylinder(group,black,.036,.72,[0,.039,z]);
  fixedBar(group,green,.052,[0,.081,-.54],[0,.081,.62]);
  crossCylinder(group,pale,.213,.20,[0,.237,-.48]);
  const centralJoint=[0,.248,-.48];
  for(const [a,b] of [[[0,.10,.50],[0,.86,.65]],[[0,.86,.65],[0,1.09,.56]]])fixedBar(group,pale,.047,a,b);
  box(group,green,[.20,.041,.15],[0,1.084,.555]).rotation.x=-.37;
  box(group,black,[.15,.016,.09],[0,1.104,.557]).rotation.x=-.37;
  const pedals=Object.fromEntries(['l','r'].map((side)=>{
   const sg=side==='l'?1:-1;
   const cradle=box(group,black,[.103,.033,.273],[0,0,0]);
   const rim=box(group,green,[.102,.012,.265],[0,0,0]);
   const link=cylinder(group,pale,.030,1,[0,0,0]);
   const guide=cylinder(group,black,.021,1,[0,0,0]);
   const taller=cylinder(group,pale,.023,1,[0,0,0]);
   const rubber=cylinder(group,black,.027,.104,[0,0,0]);
   crossCylinder(group,silver,.034,.073,[sg*.173,.653,.466]);
   fixedBar(group,green,.025,[0,.655,.567],[sg*.173,.653,.466]);
   return [side,{sg,cradle,rim,link,guide,taller,rubber}];
  }));
  return p=>{
   for(const [side,gear] of Object.entries(pedals)){
    const {sg,cradle,rim,link,guide,taller,rubber}=gear;
    const ankle=p[side+'a'], hand=p[side+'w'];
    const foot=vec([sg*.138,ankle[1]-.083,ankle[2]+.052]);
    cradle.position.copy(foot); rim.position.copy(foot).add(new T.Vector3(0,.024,0));
    const crank=vec([sg*.132,centralJoint[1]+(ankle[1]-.347)*.77,centralJoint[2]+ankle[2]*.38]);
    connect(link,crank,foot);
    const front=vec([sg*.172,foot.y-.021,.523+ankle[2]*.68]);
    connect(guide,foot,front);
    connect(taller,front,vec(hand));
    rubber.position.copy(vec(hand));
    rubber.quaternion.copy(taller.quaternion);
   }
  };
 }
 if(options.stepmill){
  box(group,black,[.78,.103,1.42],[0,.053,-.006]);
  const guard=new T.BoxGeometry(.092,.185,1.22);
  for(const s of [-1,1]){
   const side=mesh(group,guard,green,[s*.346,.315,.015]);side.rotation.x=-.56;
   fixedBar(group,pale,.030,[s*.34,.15,-.49],[s*.34,1.33,-.46]);
   fixedBar(group,pale,.030,[s*.34,.67,.62],[s*.34,1.52,.61]);
   fixedBar(group,black,.033,[s*.34,1.33,-.47],[s*.34,1.52,.63]);
  }
  fixedBar(group,pale,.035,[-.34,1.51,.61],[.34,1.51,.61]);
  box(group,green,[.34,.056,.16],[0,1.543,.606]).rotation.x=-.27;
  const treads=Array.from({length:7},(_,step)=>{
   const groupStep =new T.Group();group.add(groupStep);
   box(groupStep,black,[.582,.173,.265],[0,-.087,0]);
   box(groupStep,pale,[.578,.012,.263],[0,-.007,0]);
   for(let j=0;j<4;j++)box(groupStep,green,[.575,.0015,.010],[0,0,-.093+j*.064]);
   return groupStep;
  });
  return p=>{
   const traveled=p.machineTravel??0;
   for(let i=0;i<treads.length;i++){
    const position=i-3-(traveled%1);
    const y=.555+position*.158, z=position*.246;
    treads[i].position.set(0,y,z);
    treads[i].visible=y>=.13&&y<=.923;
   }
  };
 }
 if(options.rower){
  for(const z of [-.843,.647]){
   crossCylinder(group,black,.032,.57,[0,.039,z]);
   box(group,green,[.094,.239,.087],[0,.155,z]);
  }
  box(group,pale,[.128,.092,1.49],[0,.255,-.209]);
  box(group,silver,[.092,.014,1.48],[0,.302,-.209]);
  fixedBar(group,green,.034,[0,.294,.494],[0,.518,.761]);
  crossCylinder(group,black,.238,.192,[0,.396,.678]);
  crossCylinder(group,pale,.216,.201,[0,.396,.678]);
  for(const sign of [-1,1]){
   const x=sign*.118;
   crossCylinder(group,green,.073,.012,[sign*.103,.396,.678]);
   box(group,black,[.112,.023,.277],[x,.277,.461]).rotation.x=-.58;
   box(group,green,[.114,.048,.065],[x,.319,.51]).rotation.x=-.58;
   fixedBar(group,pale,.023,[x,.248,.531],[sign*.058,.244,.449]);
  }
  fixedBar(group,green,.022,[0,.550,.722],[0,.769,.685]);
  box(group,green,[.155,.035,.099],[0,.765,.678]).rotation.x=-.78;
  box(group,black,[.127,.012,.083],[0,.775,.676]).rotation.x=-.78;
  const seat=new T.Group(); group.add(seat);
  box(seat,black,[.262,.049,.193],[0,0,0]);box(seat,pale,[.119,.044,.102],[0,-.040,0]);
  const tether=cylinder(group,black,.005,1,[0,0,0]);
  const handle=cylinder(group,black,.021,1,[0,0,0]);
  return p=>{
   seat.position.set(0,.340,p.hips[2]);
   const l=vec(p.lw), r=vec(p.rw), center=l.clone().lerp(r,.5);
   connect(handle,r.clone().add(new T.Vector3(-.043,0,0)),l.clone().add(new T.Vector3(.043,0,0)));
   connect(tether,vec([0,.566,.767]),center);
  };
 }
 if(options.jumpRope){
  const ropeMaterial=material(0x416b5d,.82,0);
  const parts=Array.from({length:42},()=>cylinder(group,ropeMaterial,.0058,1,[0,0,0]));
  const handles=Array.from({length:2},()=>cylinder(group,black,.017,1,[0,0,0]));
  return p=>{
   const angle=(p.machineTravel-.55)*2*Math.PI;
   const down=-Math.cos(angle), front=-Math.sin(angle);
   const left=vec(p.lw), right=vec(p.rw);
   const gripRot=vec([0,down*.050,front*.064]);
   const a=right.clone().add(gripRot), b=left.clone().add(gripRot);
   connect(handles[0],right.clone().addScaledVector(gripRot,-.92),a);
   connect(handles[1],left.clone().addScaledVector(gripRot,-.92),b);
   const route=t=>{
    const curl=Math.sin(Math.PI*t);
    const center=a.clone().lerp(b,t);
    center.x-=.094*Math.sin(2*Math.PI*t);
    center.y=Math.max(.016,center.y+down*1.095*curl);
    center.z+=front*.886*curl;
    return center;
   };
   for (let i=0;i<parts.length;i++) connect(parts[i],route(i/parts.length),route((i+1)/parts.length));
  };
 }
 if(options.carryKettles){
  const bells=['l','r'].map(()=>{
   const object=new T.Group();group.add(object);
   const ball=mesh(object,new T.SphereGeometry(.084,28,20),green,[0,-.155,0]);ball.scale.y=.84;
   cylinder(object,black,.057,.031,[0,-.208,0]);
   const handlePath=new T.CatmullRomCurve3([
    vec([0,-.111,.051]),vec([0,-.040,.069]),vec([0,-.004,.061]),
    vec([0,.004,.027]),vec([0,.004,-.027]),vec([0,-.004,-.061]),
    vec([0,-.040,-.069]),vec([0,-.111,-.051]),
   ]);
   mesh(object,new T.TubeGeometry(handlePath,31,.016,12,false),black);
   mesh(object,new T.TorusGeometry(.044,.0032,8,28),silver,[.073,-.154,.002]).rotateY(Math.PI/2);
   return object;
  });
  if(options.singleCarry)bells[1].visible=false;
  return p=>{bells[0].position.copy(vec(p.lw));bells[1].position.copy(vec(p.rw));};
 }
 if(options.trapCarry){
  const iron=new T.Group();group.add(iron);
  const path=[
   [-.375,-.051,-.223],[-.375,-.051,.223],
   [0,-.051,.471],[.375,-.051,.223],
   [.375,-.051,-.223],[0,-.051,-.471],
  ];
  for(let i=0;i<path.length;i++){
   fixedBar(iron,pale,.023,path[i],path[(i+1)%path.length]);
   mesh(iron,new T.SphereGeometry(.023,14,11),pale,path[i]);
  }
  for(const sign of [-1,1]){
   for(const depth of [-.112,.112]){
    fixedBar(iron,silver,.017,[sign*.321,0,depth],[sign*.378,-.049,depth]);
   }
   fixedBar(iron,black,.018,[sign*.321,0,-.112],[sign*.321,0,.112]);
   crossCylinder(iron,silver,.024,.444,[sign*.544,-.051,0]);
   crossCylinder(iron,green,.063,.029,[sign*.395,-.051,0]);
   const plates=[.464,.504,.547];
   for(const [i,x] of plates.entries()){
    crossCylinder(iron,black,i<2?.183:.144,.039,[sign*x,-.051,0]);
    crossCylinder(iron,green,i<2?.15:.114,.006,[sign*(x+.021),-.051,0]);
   }
   crossCylinder(iron,silver,.043,.047,[sign*.596,-.051,0]);
  }
  return p=>iron.position.copy(vec(p.lw).lerp(vec(p.rw),.5));
 }
 if(options.projectile){
  const ball=new T.Group();group.add(ball);
  const massage=options.massageBall;
  const radius=massage ? .046 : .111;
  mesh(ball,new T.SphereGeometry(radius,36,26),green);
  mesh(ball,new T.TorusGeometry(radius-.0005,massage ? .0014 : .0031,8,40),black).rotation.x=.41;
  mesh(ball,new T.TorusGeometry(radius-.001,massage ? .0009 : .0020,7,40),black).rotation.y=.88;
  if(massage==='massage-front-wall'||massage==='massage-rear-wall'){
   box(group,pale,[1.03,1.96,.073],[0,.98,massage==='massage-front-wall'?.693:-.503]);
  }
  if(massage==='massage-table'){
   box(group,pale,[.835,.045,.545],[.172,.895,.534]);
   for(const x of [-.192,.530]) for(const z of [.318,.754]) box(group,black,[.046,.880,.046],[x,.440,z]);
  }
  if(options.targetWall){
   const height=options.tallTargetWall?2.93:1.77;
   const targetHeight=options.tallTargetWall?2.52:1.30;
   box(group,pale,[.955,height,.105],[0,.003+height/2,1.419]);
   box(group,green,[.949,.084,.076],[0,.044,1.397]);
   box(group,green,[.949,.074,.076],[0,height-.033,1.397]);
   const target=mesh(group,new T.TorusGeometry(.196,.0056,10,56),green,[0,targetHeight,1.365]);
   target.castShadow=false;
  }
  return p=>{
   ball.position.copy(vec(p.ballCenter));
   ball.rotation.set(.52*p.machineTravel,1.1*p.machineTravel,.2*p.machineTravel);
  };
 }
 if(options.singleKettlebell){
  if(options.heelPlates){
   for(const x of [-.194,.194]){
    cylinder(group,black,.113,.035,[x,.0175,-.066],40);
    cylinder(group,green,.111,.004,[x,.0365,-.066],40);
   }
  }
  const weight=new T.Group();group.add(weight);
  const iron=mesh(weight,new T.SphereGeometry(.092,32,24),green,[0,-.151,0]);
  iron.scale.set(1,.91,.92);
  cylinder(weight,black,.059,.019,[0,-.2255,0]);
  const arch=new T.CatmullRomCurve3([
   vec([-.063,-.110,0]),vec([-.067,-.044,0]),vec([-.055,-.013,0]),
   vec([-.037,0,0]),vec([0,.003,0]),vec([.037,0,0]),vec([.055,-.013,0]),
   vec([.067,-.044,0]),vec([.063,-.110,0]),
  ]);
  mesh(weight,new T.TubeGeometry(arch,31,.0155,12,false),black);
  mesh(weight,new T.TorusGeometry(.044,.0042,7,30),silver,[0,-.158,.082]);
  return p=>{
   weight.position.copy(vec(p.bellCenter));
   weight.rotation.x=p.bellTilt;
  };
 }
 if(options.contactWall){
  const height=options.tallContactWall?2.30:1.867;
  box(group,pale,[1.123,height,.102],[0,height/2+.0045,.590]);
  box(group,green,[1.124,.066,.107],[0,.037,.590]);
  box(group,green,[1.123,.062,.105],[0,height-.021,.590]);
  for(const x of [-.219,.219])box(group,green,[.099,.133,.005],[x,1.251,.537]);
 }
 if(options.suitcaseBar){
  const load=new T.Group();group.add(load);
  fixedBar(load,silver,.016,[0,0,-.989],[0,0,.989]);
  fixedBar(load,black,.022,[0,0,-.175],[0,0,.175]);
  for(const sign of [-1,1]){
   fixedBar(load,silver,.029,[0,0,sign*.614],[0,0,sign*.998]);
   cylinder(load,green,.061,.031,[0,0,sign*.620]).rotateX(Math.PI/2);
   for(let i=0;i<2;i++)cylinder(load,black,i===0?.185:.153,.047,[0,0,sign*(.677+.047*i)]).rotateX(Math.PI/2);
   cylinder(load,pale,.054,.030,[0,0,sign*.752]).rotateX(Math.PI/2);
  }
  return p=>load.position.copy(vec(p.lw));
 }
 return undefined;
}
