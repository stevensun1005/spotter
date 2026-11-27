import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const metal=new T.MeshStandardMaterial({color:0x85918b,roughness:.57,metalness:.42});
const frame=new T.MeshStandardMaterial({color:0x365346,roughness:.73,metalness:.15});
const tire=new T.MeshStandardMaterial({color:0x252d27,roughness:.93,metalness:.02});
const accent=new T.MeshStandardMaterial({color:0xb3a066,roughness:.63,metalness:.23});
const Y=new T.Vector3(0,1,0), Z=new T.Vector3(0,0,1);
const vector=v=>new T.Vector3(...v);
function mesh(parent,geo,mat,pos=[0,0,0]){
 const obj=new T.Mesh(geo,mat);
 parent.add(obj);obj.position.copy(vector(pos));obj.castShadow=true;obj.receiveShadow=true;
 return obj;
}
function box(parent,position,size,mat=frame,r=.013){
 return mesh(parent,new RoundedBoxGeometry(...size,3,r),mat,position);
}
function rod(parent,a,b,r,mat=metal){
 const start=vector(a), delta=vector(b).sub(start);
 const p=mesh(parent,new T.CylinderGeometry(r,r,delta.length(),18),mat,start.clone().addScaledVector(delta,.5).toArray());
 p.quaternion.setFromUnitVectors(Y,delta.normalize());
 return p;
}
function helmet(group){
 const g=new T.Group();group.add(g);
 const shell=mesh(g,new T.SphereGeometry(.105,27,16,0,Math.PI*2,0,Math.PI*.53),frame);
 shell.scale.set(.87,.90,1.21);
 for(const x of [-.045,0,.045])box(g,[x===0?.015:.012,.015,.104],[x,.077,.018],tire,.005);
 box(g,[.148,.018,.112],[0,.009,.051],tire,.006);
 return p=>{
   g.position.copy(vector(p.head)).add(new T.Vector3(0,.041,.021));
   const aim=p.headAim?vector(p.headAim).normalize():Y;
   g.quaternion.setFromUnitVectors(Y,aim);
 };
}
function roadBike(group){
 const rear=[0,.335,-.562], wheelFront=[0,.335,.655];
 const wheels=[];
 for(const points of [rear,wheelFront]){
   const g=new T.Group();group.add(g);g.position.copy(vector(points));wheels.push(g);
   mesh(g,new T.TorusGeometry(.310,.024,13,52),tire).rotation.y=Math.PI/2;
   mesh(g,new T.TorusGeometry(.293,.009,10,46),metal).rotation.y=Math.PI/2;
   rod(g,[-.049,0,0],[.049,0,0],.026);
   for(let j=0;j<14;j++){
     const f=j*Math.PI/7;
     rod(g,[j%2?.026:-.026,0,0],[0,.29*Math.cos(f),.29*Math.sin(f)],.0023);
   }
 }
 const crank=[0,.365,.045], saddle=[0,.913,-.210], steer=[0,.839,.475];
 for(const [a,b,r] of [[crank,saddle,.026],[saddle,steer,.021],[crank,steer,.031],[rear,crank,.018],[rear,saddle,.017],[wheelFront,steer,.022]]){
   for(const side of (a===rear||a===wheelFront?[-1,1]:[0])){
     rod(group,[side*.043,a[1],a[2]],[side*.028,b[1],b[2]],r,frame);
   }
 }
 rod(group,steer,[0,1.043,.532],.022);
 rod(group,[0,1.043,.532],[.250,1.027,.505],.018,tire);
 rod(group,[0,1.043,.532],[-.250,1.027,.505],.018,tire);
 box(group,[0,.942,-.197],[.185,.045,.264],tire,.019);
 rod(group,[-.085,.365,.045],[.085,.365,.045],.055,tire);
 const pedals=[-1,1].map(s=>({s,crank:mesh(group,new T.CylinderGeometry(.018,.018,1,14),metal),
   deck:box(group,[s*.12,.37,.145],[.105,.025,.098],tire,.007)}));
 const wearHelmet=helmet(group);
 return p=>{
   const cycles=p.machineTravel;
   for(const w of wheels)w.rotation.x=cycles*Math.PI*6;
   for(const [i,g] of pedals.entries()){
     const theta=(cycles+(i===0?.5:0))*Math.PI*2;
     const end=[g.s*.103,.365+.149*Math.sin(theta),.045+.149*Math.cos(theta)];
     const a=vector([g.s*.094,.365,.045]),delta=vector(end).sub(a);
     g.crank.position.copy(a).lerp(vector(end),.5);
     g.crank.quaternion.setFromUnitVectors(Y,delta.clone().normalize());g.crank.scale.y=delta.length();
     g.deck.position.copy(vector(end)).add(new T.Vector3(g.s*.033,0,0));
   }
   wearHelmet(p);
 };
}
function pool(group){
 const poolWall=new T.MeshStandardMaterial({color:0x92aba5,roughness:.56});
 const tile=new T.MeshStandardMaterial({color:0x758d79,roughness:.66});
 const water=new T.MeshPhysicalMaterial({color:0x70a9b7,transparent:true,opacity:.43,roughness:.32,
   metalness:.06,depthWrite:false,side:T.DoubleSide});
 const surface=mesh(group,new T.PlaneGeometry(2.34,2.24),water,[0,1.124,-.471]);
 surface.rotation.x=-Math.PI/2;surface.renderOrder=2;surface.castShadow=false;
 box(group,[0,.568,.665],[2.34,1.136,.075],poolWall,.005);
 box(group,[0,1.149,.665],[2.40,.084,.246],tile);
 for(let x=-1.07;x<1.12;x+=.22)box(group,[x,.840,.625],[.006,.606,.004],metal,.001);
 const wakes=[-1,1].map(s=>{
   const m=new T.MeshBasicMaterial({color:0x8fbcc9,transparent:true,opacity:.50,depthWrite:false});
   const ring=mesh(group,new T.TorusGeometry(.16,.008,8,28),m,[s*.183,1.130,-.016]);
   ring.castShadow=false;ring.rotation.x=Math.PI/2;ring.renderOrder=3;return ring;
 });
 return p=>{
   for(const [i,a] of wakes.entries()){
     const f=(p.machineTravel+i*.5)%1;
     a.scale.setScalar(.55+f*.91);a.material.opacity=.50*(1-f);
   }
 };
}
function inlineSkates(group){
 const boot=['l','r'].map(()=>{
   const g=new T.Group();group.add(g);
   box(g,[0,-.053,.056],[.140,.109,.292],frame,.025);
   box(g,[0,.014,-.029],[.124,.153,.117],frame,.018);
   box(g,[0,.016,.016],[.126,.026,.172],metal,.008);
   box(g,[0,-.111,.057],[.055,.032,.278],metal,.004);
   for(const z of [-.056,.020,.099,.175]){
     rod(g,[-.033,-.146,z],[.033,-.146,z],.039,tire);
     rod(g,[-.037,-.146,z],[.037,-.146,z],.016,accent);
   }
   return g;
 });
 const h=helmet(group);
 return p=>{
   for(const [i,s] of ['l','r'].entries()){
     const ankle=vector(p[s+'a']),t=vector(p[s+'t']);t.y=ankle.y;
     boot[i].position.copy(ankle);
     boot[i].quaternion.setFromUnitVectors(Z,t.sub(ankle).normalize());
   }
   h(p);
 };
}
function hoop(group){
 const h=new T.Group();group.add(h);
 for(let i=0;i<8;i++){
   const arc=mesh(h,new T.TorusGeometry(.444,.015,10,22,Math.PI/4),i%4===0?accent:frame);
   arc.rotation.z=i*Math.PI/4;
 }
 return p=>{
   const spin=p.machineTravel*Math.PI*2;
   h.position.copy(vector(p.hips)).add(new T.Vector3(.081*Math.cos(spin),.094+.032*Math.sin(spin),.080*Math.sin(spin)));
   h.rotation.set(Math.PI/2+.095*Math.sin(spin),.083*Math.cos(spin),spin);
 };
}
export const recreationProps={
  'recreation-bike':roadBike,
  'recreation-aquabike':pool,
  'recreation-inline-skates':inlineSkates,
  'recreation-hoop':hoop,
};
