import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { agilityLayouts } from './agility-layouts.js';
import { recreationProps } from './recreation-props.js';

const leather=new T.MeshStandardMaterial({color:0x344c40,roughness:.85,metalness:.03});
const dark=new T.MeshStandardMaterial({color:0x202d27,roughness:.88,metalness:.07});
const edge=new T.MeshStandardMaterial({color:0x7d8e82,roughness:.78,metalness:.12});
const fabric=new T.MeshStandardMaterial({color:0x879d8f,roughness:.96,side:T.DoubleSide});
const slideFabric=new T.MeshStandardMaterial({color:0x587a70,roughness:.98,side:T.DoubleSide});
const Z=new T.Vector3(0,0,1);
const Y=new T.Vector3(0,1,0);
const v=a=>new T.Vector3(...a);
function part(group,shape,material,where=[0,0,0]){
  const mesh=new T.Mesh(shape,material);group.add(mesh);mesh.position.copy(v(where));
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
const box=(group,size,where,mat=leather,r=.014)=>part(group,new RoundedBoxGeometry(...size,4,r),mat,where);
const shaft=(group,radius,height,where,mat=edge)=>part(group,new T.CylinderGeometry(radius,radius,height,24),mat,where);

function glove(group){
  const result=new T.Group();group.add(result);
  const sphere=part(result,new T.SphereGeometry(.06,22,16),leather,[0,.023,.041]);sphere.scale.set(.84,.87,1.22);
  const thumb=part(result,new T.SphereGeometry(.032,16,12),dark,[.039,-.004,.023]);thumb.scale.set(.85,.80,1.2);
  box(result,[.090,.074,.066],[0,0,-.026],dark);
  return result;
}

function strikeStation(group,kind){
  const gloves=['l','r'].map(()=>glove(group));
  const bag=new T.Group();group.add(bag);
  if(kind==='boxing-bag'){
    part(bag,new T.CapsuleGeometry(.191,.834,8,28),leather);
    for(const y of [-.528,.528])shaft(bag,.182,.029,[0,y,0],dark);
    for(const x of [-.132,.132]){
      shaft(bag,.008,.408,[x*.57,.726,0]).rotation.z=.340*Math.sign(x);
    }
    shaft(bag,.020,.066,[0,.954,0],dark);
  }else{
    const kick=kind==='kick-shield';
    box(bag,kick?[.283,.289,.117]:[.190,.218,.082],[0,0,0],dark,kick?.053:.033);
    box(bag,kick?[.230,.240,.065]:[.153,.184,.040],[0,0,-.052],leather,kick?.043:.029);
    const mark=shaft(bag,kick?.054:.033,.005,[0,0,kick?-.087:-.073],edge);
    mark.rotation.x=Math.PI/2;
  }
  return p=>{
    for(const [i,s] of ['l','r'].entries()){
      const hand=v(p[s+'w']), elbow=v(p[s+'e']);
      gloves[i].position.copy(hand);
      gloves[i].quaternion.setFromUnitVectors(Z,hand.clone().sub(elbow).normalize());
    }
    bag.position.copy(v(p.ballCenter));
    bag.quaternion.setFromUnitVectors(kind==='boxing-bag'?Y:Z,v(p.handRoller.axis).normalize());
  };
}

function cloth(group,material){
  const mesh=new T.Group();group.add(mesh);
  const shape=new T.PlaneGeometry(1,1,34,12);
  const vertices=shape.attributes.position;
  const grid=Array.from({length:vertices.count},(_,i)=>[vertices.getX(i)+.5,vertices.getY(i)]);
  const textile=part(mesh,shape,material);
  textile.frustumCulled=false;
  function set(points,width,vertical=Y,twist=0){
    const stages=points.map(v);
    for(let i=0;i<vertices.count;i++){
      const [along,side]=grid[i],fraction=along*(stages.length-1),index=Math.min(stages.length-2,Math.floor(fraction));
      const a=stages[index],b=stages[index+1],t=fraction-index;
      const dir=b.clone().sub(a).normalize();
      let cross=vertical.clone().cross(dir).normalize();
      if(cross.lengthSq()<.01)cross=Z.clone().cross(dir).normalize();
      cross.applyAxisAngle(dir,(along-.5)*twist);
      const normal=dir.clone().cross(cross).normalize();
      const wobble=Math.sin(along*32+side*18)*.004*Math.sin(along*Math.PI);
      const place=a.clone().lerp(b,t).addScaledVector(cross,side*width).addScaledVector(normal,wobble);
      vertices.setXYZ(i,place.x,place.y,place.z);
    }
    vertices.needsUpdate=true;shape.computeVertexNormals();
  }
  return set;
}

const offset=(a,b)=>a.map((x,i)=>x+b[i]);
function towel(group,kind){
  const feet=kind.startsWith('towel-floor-feet');
  const hands=kind.startsWith('towel-floor-hands');
  const only=kind.endsWith('-single');
  const singleAnchor=kind==='towel-single-anchor';
  const anchor=kind.startsWith('towel-anchor');
  const loop=kind==='towel-loop'||anchor;
  const wall=kind==='towel-wall';
  const cloths=Array.from({length:(feet||hands)&&!only?2:1},()=>cloth(group,feet||hands?slideFabric:fabric));
  if(wall){
    box(group,[1.22,1.81,.034],[0,.905,.595],edge);
    box(group,[1.26,.030,.236],[0,.015,.665],dark);
  }
  if(anchor||singleAnchor){
    box(group,[.065,1.62,.078],[0,.81,.639],edge);
    box(group,[.550,.030,.300],[0,.015,.651],dark);
    shaft(group,.022,.285,[0,kind==='towel-anchor-high'?1.383:.997,.600]).rotation.z=Math.PI/2;
  }
  if(kind==='towel-loop-chair'){
    box(group,[.473,.078,.423],[0,.477,-.205],leather);
    for(const x of [-.18,.18])for(const z of [-.35,-.05])box(group,[.038,.453,.038],[x,.226,z],edge);
    for(const x of [-.18,.18])box(group,[.038,.39,.038],[x,.679,-.35],edge);
    box(group,[.445,.224,.057],[0,.744,-.357],leather);
  }
  return p=>{
    const {center,axis}=p.handRoller;
    if(feet||hands){
      const limbs=only?[kind.endsWith('left-single')?'l':'r']:['l','r'];
      for(const [i,side] of limbs.entries()){
        const root=feet?p[side+'a']:p[side+'w'];
        const x=root[0],z=root[2],length=p.machineTravel>.001?p.machineTravel:.296;
        cloths[i]([[x,.021,z-length*.31],[x+Math.sin(p.machineTravel*29)*.007,.026,z+length*.69]],.203,Y);
      }
    }else if(wall){
      const [x,y]=center;
      cloths[0]([[x-.100,y,.572],[x+.100,y,.572]],.222,Z);
    }else if(loop||kind==='towel-loop-chair'){
      const betweenA=offset(center,axis.map(x=>x*.106)),betweenB=offset(center,axis.map(x=>-x*.106));
      cloths[0]([p.lw,betweenA,betweenB,p.rw],.075,Math.abs(axis[1])>.7?Z:Y);
    }else if(kind==='towel-single-anchor'){
      cloths[0]([p.rw,[0,.997,.554],[-.049,1.024,.599]],.091,Y);
    }else{
      cloths[0]([p.lw,p.rw],kind==='towel-strap'?.047:kind==='sheet-free'?.259:.130,Y,p.machineTravel);
    }
  };
}

function doorFrame(group,closed){
  const jamb=.43;
  for(const x of [-jamb,jamb]){
    box(group,[.108,1.94,.174],[x,.973,.430],edge);
    box(group,[.152,.035,.245],[x,.021,.430],dark);
  }
  box(group,[.966,.113,.174],[0,1.899,.430],edge);
  if(closed) {
    box(group,[.742,1.827,.093],[0,.919,.457],leather);
    box(group,[.518,.644,.015],[0,1.398,.400],edge);
    shaft(group,.024,.103,[.245,1.033,.355]).rotateX(Math.PI/2);
    shaft(group,.018,.157,[.179,1.033,.309],dark).rotateZ(Math.PI/2);
  }
}

function indoorProp(group,kind){
  if(kind.startsWith('home-door')){
    doorFrame(group,kind==='home-door-sheet');
    if(kind!=='home-door-sheet')return;
    const drape=cloth(group,fabric);
    return p=>drape([p.lw,[.200,1.040,.317],[.253,1.029,.333],p.rw],.182,Y);
  }
  if(kind==='home-table-row'){
    box(group,[.973,.067,1.395],[0,.735,.649],leather);
    box(group,[.914,.050,1.336],[0,.677,.647],edge);
    for(const x of [-.432,.432])for(const z of [.065,1.230]){
      box(group,[.054,.683,.062],[x,.341,z],edge);
    }
    return;
  }
  const left=-.118,z=.377;
  box(group,[.598,.045,.385],[left,.779,z],leather);
  for(const x of [left-.252,left+.252])for(const depth of [z-.148,z+.148]){
    box(group,[.037,.752,.039],[x,.377,depth],edge);
  }
  box(group,[.416,.067,.398],[.069,.464,-.272],leather);
  for(const x of [-.091,.228])for(const depth of [-.426,-.120]){
    box(group,[.030,.437,.035],[x,.221,depth],edge);
  }
}

function agility(group,{marker,points=[]}){
  const accent=new T.MeshStandardMaterial({color:0xb79b58,roughness:.74,metalness:.05});
  for(const [x,z] of points){
    if(marker==='disc'||marker==='dot'){
      shaft(group,marker==='disc'?.103:.088,marker==='disc'?.024:.010,[x,.012,z],marker==='disc'?accent:leather);
    }else if(marker==='cone'){
      box(group,[.218,.018,.218],[x,.009,z],dark);
      part(group,new T.CylinderGeometry(.018,.080,.184,28),accent,[x,.101,z]);
      part(group,new T.CylinderGeometry(.029,.043,.026,28),edge,[x,.129,z]);
    }else if(marker==='ball'){
      part(group,new T.SphereGeometry(.155,24,18),leather,[x,.155,z]);
    }else if(marker==='ladder'){
      for(const s of [-1,1])box(group,[.025,.012,2.567],[x+s*.215,.009,z+1.25],leather,.0035);
      for(let j=0;j<7;j++)box(group,[.447,.012,.026],[x,.010,z+.416*j],accent,.0035);
    }else if(marker==='hurdle'){
      for(const s of [-1,1]){
        box(group,[.027,.692,.042],[x+s*.357,.346,z],edge,.009);
        box(group,[.063,.022,.312],[x+s*.357,.011,z+.104],dark,.007);
      }
      box(group,[.799,.043,.042],[x,.697,z],accent,.008);
    }else if(marker==='balloon'){
      const balloon=new T.Group();group.add(balloon);
      const sphere=part(balloon,new T.SphereGeometry(.126,26,20),leather);sphere.scale.y=1.27;
      part(balloon,new T.CylinderGeometry(.013,.003,.028,12),dark,[0,-.163,0]);
      shaft(balloon,.0027,.362,[0,-.354,.002],edge).rotation.z=.131;
      return p=>{
        balloon.position.set(x+.063*p.machineTravel,2.194+.115*p.machineTravel,z-.043*p.machineTravel);
        balloon.rotation.z=-.14*p.machineTravel;
      };
    }
  }
}

function assessment(group,kind){
  if(kind==='assessment-flex-box'){
    box(group,[.445,.303,.435],[0,.153,-.065],leather);
    box(group,[.323,.572,.035],[0,.190,.149],edge,.009);
    for(let i=0;i<12;i++){
      const full=i%3===0;
      box(group,[full?.105:.058,.007,.004],[-.083+(full?.019:0),.005+i*.039,.169],dark,.0015);
    }
    return;
  }
  if(kind==='assessment-hand-ball'||kind==='assessment-hand-table'){
    if(kind==='assessment-hand-table'){
      box(group,[.564,.044,.445],[-.070,.785,.351],leather,.010);
      for(const x of [-.296,.162])for(const z of [.17,.534])box(group,[.037,.760,.037],[x,.37,z],edge,.005);
    }
    const ball=part(group,new T.SphereGeometry(.052,26,18),leather);
    return p=>{
      ball.position.copy(v(p.ballCenter));
      ball.scale.set(1+.16*p.machineTravel,1-.25*p.machineTravel,1+.13*p.machineTravel);
    };
  }
  if(kind==='assessment-seat'){
    box(group,[.463,.062,.425],[0,.475,-.157],leather,.010);
    for(const x of [-.188,.188])for(const z of [-.316,.004])box(group,[.037,.450,.037],[x,.214,z],edge,.005);
    return;
  }
  const neck=kind==='assessment-neck-table';
  const leg=kind==='assessment-leg-table';
  const y=neck?.581:.727;
  const z=neck?.392:leg?.014:-.482;
  const width=neck?.552:.697;
  const length=neck?1.298:leg?2.180:1.741;
  box(group,[width,.078,length],[0,y,z],leather,.022);
  for(const x of [-width*.42,width*.42])for(const depth of [z-length*.405,z+length*.405]){
    box(group,[.060,y-.041,.063],[x,(y-.042)*.5,depth],edge,.007);
  }
  for(const x of [-width*.40,width*.40])box(group,[.040,.035,length*.863],[x,.141,z],dark,.006);
}

function stretchSupport(group,kind){
  if(kind==='stretch-floor-pillow'){
    box(group,[.519,.081,.296],[0,.040,-.778],fabric,.032);
    return;
  }
  if(kind==='stretch-padded-chair'){
    box(group,[.470,.075,.427],[0,.475,-.189],leather,.016);
    box(group,[.446,.391,.084],[0,.833,-.367],edge,.021);
    box(group,[.346,.286,.080],[0,.796,-.308],fabric,.031);
    for(const x of [-.194,.194])for(const z of [-.346,-.029])box(group,[.036,.452,.037],[x,.225,z],edge,.007);
    for(const x of [-.188,.188])box(group,[.034,.410,.036],[x,.685,-.383],edge,.006);
    return;
  }
  const side=kind==='stretch-lateral-bench';
  const boxZ=kind==='stretch-front-box';
  const width=side?.447:.571;
  const depth=side?.736:boxZ?.363:.429;
  const y=side?.459:boxZ?.351:.473;
  const centerX=side?.798:0;
  const centerZ=side?.035:boxZ?.659:.721;
  if(boxZ){
    box(group,[width,.369,depth],[centerX,.185,centerZ],edge,.019);
    box(group,[width-.029,.043,depth-.029],[centerX,.378,centerZ],leather,.009);
    return;
  }
  box(group,[width,.069,depth],[centerX,y,centerZ],leather,.018);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    box(group,[.046,y-.020,.049],[centerX+sx*(width/2-.045),(y-.020)*.5,centerZ+sz*(depth/2-.047)],edge,.008);
  }
}
export function buildCatalogueBodyweightProp(group,kind){
  if(!kind)return;
  if(kind.startsWith('assessment-'))return assessment(group,kind);
  if(kind.startsWith('stretch-'))return stretchSupport(group,kind);
  if(Object.hasOwn(recreationProps,kind))return recreationProps[kind](group);
  if(Object.hasOwn(agilityLayouts,kind))return agility(group,agilityLayouts[kind]);
  if(kind.startsWith('towel-')||kind==='sheet-free')return towel(group,kind);
  if(kind.startsWith('home-'))return indoorProp(group,kind);
  return strikeStation(group,kind);
}
