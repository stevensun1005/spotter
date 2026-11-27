import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildTire } from './catalogue-small-props.js';

const dark=new T.MeshStandardMaterial({color:0x273630,roughness:.85,metalness:.12});
const face=new T.MeshStandardMaterial({color:0x5d7568,roughness:.60,metalness:.28});
const steel=new T.MeshStandardMaterial({color:0xaaaea8,roughness:.49,metalness:.55});
const wood=new T.MeshStandardMaterial({color:0x767361,roughness:.81,metalness:.09});
const Y=new T.Vector3(0,1,0);
const vec=a=>new T.Vector3(...a);
const center=(a,b)=>vec(a).lerp(vec(b),.5);
function mesh(group,shape,material,position=[0,0,0]){
  const model=new T.Mesh(shape,material);model.position.copy(vec(position));group.add(model);
  model.castShadow=true;model.receiveShadow=true;return model;
}
function bar(group,where,size,material=steel){
  return mesh(group,new RoundedBoxGeometry(...size,3,.007),material,where);
}
function rod(group,where,r,height,material=steel){
  return mesh(group,new T.CylinderGeometry(r,r,height,26),material,where);
}
function link(mesh,start,end){
  const axis=end.clone().sub(start);
  mesh.position.copy(start).lerp(end,.5);
  mesh.quaternion.setFromUnitVectors(Y,axis.clone().normalize());
  mesh.scale.y=axis.length();
}
function handheldPole(group,kind){
  const implement=new T.Group();
  group.add(implement);
  const mace=kind==='mace';
  const hammer=kind==='sledge-training';
  const length=mace?.735:hammer?.872:kind==='mas-board'?.568:1.180;
  rod(implement,[0,0,0],mace?.019:hammer?.021:.015,length,hammer?wood:steel);
  if(mace){
    mesh(implement,new T.SphereGeometry(.073,24,18),dark,[0,.334,0]);
    rod(implement,[0,-.251,0],.022,.192,dark);
  }
  if(hammer){
    bar(implement,[0,.420,0],[.210,.108,.107],dark);
    const tire=buildTire(group);
    tire({tireCenter:[0,.115,.692],tireAngle:0});
  }
  if(kind==='mas-board'){
    bar(group,[0,.144,0],[.792,.289,.090],wood);
    bar(group,[0,.033,0],[.817,.058,.282],dark);
  }
  return p=>{
    implement.position.copy(vec(p.handRoller.center));
    implement.quaternion.setFromUnitVectors(Y,vec(p.handRoller.axis).normalize());
  };
}
function cylinderWeight(group,kind){
  const piece=new T.Group();group.add(piece);
  if(kind==='log'){
    rod(piece,[0,0,0],.113,1.195,face);
    for(const s of [-1,1]){
      rod(piece,[0,s*.54,0],.121,.058,dark);
      rod(piece,[0,s*.639,0],.044,.166,steel);
      bar(piece,[0,s*.205,-.100],[.133,.151,.044],dark);
      rod(piece,[0,s*.205,-.122],.018,.157,steel).rotateX(Math.PI/2);
    }
  }else if(kind==='keg'){
    mesh(piece,new T.CylinderGeometry(.122,.122,.354,28),face);
    for(const s of [-1,1]){
      rod(piece,[0,s*.161,0],.127,.037,steel);
      bar(piece,[0,s*.182,.108],[.178,.036,.051],dark);
    }
  }else{
    rod(piece,[0,-.062,0],.088,.118,dark);
    const handle=mesh(piece,new T.TorusGeometry(.045,.008,10,24),steel,[0,.041,0]);
    handle.rotation.y=Math.PI/2;
  }
  return piece;
}
function liftedThing(group,kind){
  let held;
  if(kind==='log'||kind==='keg'||kind==='height-weight')held=cylinderWeight(group,kind);
  else if(kind==='atlas'){
    const verts=new T.IcosahedronGeometry(.169,4);
    const p=verts.attributes.position;
    for(let i=0;i<p.count;i++){
      const f=1+.018*Math.sin(p.getX(i)*101+p.getY(i)*37+p.getZ(i)*71);
      p.setXYZ(i,p.getX(i)*f,p.getY(i)*f,p.getZ(i)*f);
    }
    verts.computeVertexNormals();
    held=mesh(group,verts,face);
    bar(group,[0,.781,.643],[.632,.091,.442],dark);
    for(const s of [-1,1])bar(group,[s*.254,.395,.649],[.061,.721,.064],steel);
  }else if(kind==='iron'){
    held=bar(group,[0,0,0],[.303,.174,.252],dark);
  }else{
    held=new T.Group();group.add(held);
    bar(held,[0,0,0],[.362,.585,.092],dark);
    bar(held,[0,0,.049],[.282,.504,.030],face);
    for(const x of [-.137,.137])for(const y of [-.224,.224])rod(held,[x,y,.071],.013,.019,steel).rotateX(Math.PI/2);
  }
  if(kind==='keg'||kind==='height-weight'){
    const y=kind==='keg'?2.372:2.61;
    for(const side of [-1,1]){
      bar(group,[side*.706,y*.5,-.697],[.066,y,.063],face);
      bar(group,[side*.706,.044,-.697],[.299,.056,.339],dark);
    }
    rod(group,[0,y,-.697],.024,1.476,steel).rotateZ(Math.PI/2);
  }
  return p=>{
    if(kind==='log'){
      held.position.copy(center(p.lw,p.rw)).add(vec([0,.051,.112]));
      held.quaternion.setFromUnitVectors(Y,vec(p.lw).sub(vec(p.rw)).normalize());
    }else if(kind==='atlas'||kind==='keg'||kind==='height-weight'){
      held.position.copy(vec(p.ballCenter));
      if(kind!=='atlas')held.rotation.x=p.machineTravel;
    }else{
      held.position.copy(center(p.lw,p.rw)).add(vec([0,.026,.057]));
    }
  };
}
function fingal(group){
  const column=new T.Group();group.add(column);
  bar(group,[0,.038,0],[.682,.056,.559],dark);
  rod(group,[0,.106,0],.086,.214,steel).rotateZ(Math.PI/2);
  bar(column,[0,1.012,0],[.158,1.971,.164],face,.021);
  for(const y of [.191,1.701,1.929])bar(column,[0,y,0],[.179,.110,.188],dark);
  column.position.y=.090;
  return p=>{column.rotation.x=p.machineTravel-Math.PI/2;};
}
function hercules(group){
  const towers=[];
  for(const s of [-1,1]){
    const tower=new T.Group();group.add(tower);
    tower.position.x=s*1.184;
    bar(group,[s*1.184,.032,0],[.525,.056,.553],dark);
    bar(tower,[0,.717,0],[.143,1.382,.172],face);
    bar(tower,[0,1.078,0],[.199,.169,.239],dark);
    rod(tower,[0,1.345,0],.031,.341,steel).rotateZ(Math.PI/2);
    const cable=rod(group,[0,0,0],.008,1,dark);
    const handle=rod(group,[0,0,0],.020,.125,steel);
    towers.push({s,tower,cable,handle});
  }
  return p=>towers.forEach(({s,tower,cable,handle})=>{
    const angle=s*p.machineTravel;
    tower.rotation.z=angle;
    const anchored=vec([s*1.184-1.34*Math.sin(angle),1.34*Math.cos(angle),0]);
    const grip=vec(s>0?p.lw:p.rw);
    link(cable,anchored,grip);handle.position.copy(grip);
  });
}
function crossWeights(group){
  const props=[-1,1].map(()=>{
    const item=new T.Group();group.add(item);
    rod(item,[0,.022,0],.019,.16,steel);
    bar(item,[0,-.062,0],[.126,.088,.127],dark);
    return item;
  });
  return p=>{props[0].position.copy(vec(p.rw));props[1].position.copy(vec(p.lw));};
}
function timber(group){
  const prop=new T.Group();group.add(prop);
  for(const s of [-1,1]){
    bar(prop,[s*.459,.011,0],[.100,.138,1.437],wood,.019);
    rod(prop,[s*.379,.128,-.021],.022,.237,steel).rotateX(Math.PI/2);
  }
  for(const z of [-.663,.663])bar(prop,[0,.011,z],[1.012,.119,.094],wood);
  return p=>{
    prop.position.copy(center(p.lw,p.rw)).add(vec([0,-.124,.021]));
  };
}
function viking(group){
  const anchors=[[-.364,1.382,.688],[.364,1.382,.688]].map(vec);
  for(const a of anchors){
    bar(group,[a.x,.691,a.z],[.073,1.381,.074],face);
    bar(group,[a.x,.035,a.z],[.284,.066,.394],dark);
  }
  bar(group,[0,1.382,.688],[.814,.082,.073],dark);
  const bars=anchors.map(()=>rod(group,[0,0,0],.025,1,steel));
  const weights=anchors.map(()=>rod(group,[0,0,0],.092,.062,dark));
  return p=>anchors.forEach((anchor,n)=>{
    const hand=vec(n===0?p.rw:p.lw);
    link(bars[n],anchor,hand);
    weights[n].position.copy(anchor.clone().lerp(hand,.37)).y-=.036;
    weights[n].rotation.z=Math.PI/2;
  });
}
export function buildStrongmanProp(group,kind){
  if(!kind)return undefined;
  if(['mace','sledge-training','training-stick','mas-board'].includes(kind))return handheldPole(group,kind);
  if(['log','keg','height-weight','atlas','iron','shield'].includes(kind))return liftedThing(group,kind);
  if(kind==='fingal')return fingal(group);
  if(kind==='hercules')return hercules(group);
  if(kind==='cross-weights')return crossWeights(group);
  if(kind==='timber')return timber(group);
  return viking(group);
}
