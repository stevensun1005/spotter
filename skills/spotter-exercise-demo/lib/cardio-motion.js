const v=(x,y,z)=>[x,y,z];
const add=(a,b)=>a.map((value,i)=>value+b[i]);
const sub=(a,b)=>a.map((value,i)=>value-b[i]);
const scale=(a,s)=>a.map(value=>value*s);
const distance=(a,b)=>Math.hypot(...sub(a,b));
const unit=a=>scale(a,1/(Math.hypot(...a)||1));
const dot=(a,b)=>a.reduce((result,value,i)=>result+value*b[i],0);
const blend=(a,b,t)=>a+(b-a)*t;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t)};
const mix=(a,b,t)=>a.map((value,i)=>blend(value,b[i],t));
const tau=2*Math.PI;

function solve(base,distal,pole,a,b){
 const aim=sub(distal,base);
 const reach=clamp(Math.hypot(...aim),Math.abs(a-b)+.002,a+b-.003);
 const forward=unit(aim);
 const along=(a*a-b*b+reach*reach)/(2*reach);
 const bend=unit(sub(pole,scale(forward,dot(pole,forward))));
 return [add(base,add(scale(forward,along),scale(bend,Math.sqrt(a*a-along*along)))),add(base,scale(forward,reach))];
}
function actor(hips,lean=0){
 const direction=v(0,Math.cos(lean),Math.sin(lean));
 const chest=add(hips,scale(direction,.371)), neck=add(hips,scale(direction,.613));
 const p={hips,chest,neck,head:add(hips,scale(direction,.747)),planted:{}};
 for(const [side,x] of [['l',1],['r',-1]]){
  p[side+'h']=add(hips,v(x*.094,0,0));
  p[side+'s']=add(hips,add(scale(direction,.515),v(x*.176,0,0)));
 }
 return p;
}
function leg(p,side,ankle,toeVector=v(0,-.074,.138),pole=v(0,0,1)){
 const [knee,foot]=solve(p[side+'h'],ankle,pole,.424,.420);
 Object.assign(p,{[side+'k']:knee,[side+'a']:foot,[side+'t']:add(foot,toeVector)});
}
function arm(p,side,hand,pole,grip){
 const [elbow,wrist]=solve(p[side+'s'],hand,pole,.255,.356);
 Object.assign(p,{[side+'e']:elbow,[side+'w']:wrist});
 if(grip) p[side+'Grip']=grip;
}

const deckTop=.143;
function gait(t,{fast=false,tread=false,run=false,fixedStride}={}){
 const turns=run?5:fast?4:3;
 const phase=t*turns;
 const stride=fixedStride??(run?1.29:fast?.99:tread?.774:.736);
 const rootZ=tread?0:(phase-turns/2)*stride;
 const deck=tread?deckTop:0;
 const support=run?.438:fast?.60:.647;
 const walkingOsc=.013*Math.sin(tau*2*phase-.19);
 const runFlight=.049*Math.cos(tau*2*phase+1.88);
 const hipY=deck+(run?.829+runFlight:fast?.844+walkingOsc:.844+walkingOsc*.81);
 const p=actor(v(.014*Math.sin(tau*phase),hipY,rootZ),run?.149:fast?.077:tread?.047:.033);
 p.followZ=rootZ;
 p.machineTravel=tread?phase*stride:0;
 for(const [side,sign,offset] of [['l',1,0],['r',-1,.5]]){
  const q=phase+offset, step=q%1;
  const swing=clamp((step-support)/(1-support),0,1);
  const flying=Math.sin(Math.PI*swing);
  const goes=step<=support;
  const strike=goes?Math.max(0,1-step/(run?.061:.129)):smooth((swing-.78)/.22);
  const push=goes?smooth((step-(support-.13))/.13):1-smooth(swing/.46);
  const z=(Math.floor(q)-q)*stride+(run?.187:(fast?.365:.283))+smooth(swing)*stride;
  const y=deck+.075+flying*(run?.234:fast?.092:.058)+push*(run?.054:.042);
  leg(p,side,v(sign*(run?.070:fast?.077:.093),y,rootZ+z),
   v(sign*.012,-.075+strike*(run?.029:.067)-push*.034,.141),v(sign*.045,0,1));
  if(goes)p.planted[side]=deck;
  const pulse=-Math.cos(tau*step);
  const movement=run?v(sign*.040,-.362-.125*pulse,.221+.277*pulse):
    v(sign*.042,fast?-.448:-.530,.035+(fast?.263:.178)*pulse);
  arm(p,side,add(p[side+'s'],movement),v(sign*.36,-.71,-.55));
 }
 return p;
}

function bicycle(t,cycles=4){
 const angle=tau*t*cycles;
 const p=actor(v(0,1.00+Math.sin(angle*2)*.004,-.218),.238);
 for(const [side,sign] of [['l',1],['r',-1]]){
  const a=angle+(sign===1?0:Math.PI);
  const ankle=v(sign*.142,.451+Math.sin(a)*.161,.055+Math.cos(a)*.161-.063);
  leg(p,side,ankle,v(0,-.074,.151),v(sign*.12,.025,1));
  arm(p,side,v(sign*.225,1.17,.275),v(sign*.42,-.87,-.27),v(0,0,1));
 }
 return p;
}

function ellipticalWalk(t,{cycles=3,stride=.225,lift=.059,push=.158,lean=.106,hold=false}={}){
 const angle=t*tau*cycles;
 const p=actor(v(.008*Math.sin(angle),1.159-.010*Math.cos(angle*2),.016),lean);
 for(const [side,d] of [['l',1],['r',-1]]){
  const cycle=angle+(d===1?0:Math.PI);
  const z=stride*Math.cos(cycle)+.014, y=.384+lift*Math.sin(cycle);
  const ankle=v(d*.138,y,z);
  leg(p,side,ankle,v(d*.019,-.064,.148),v(d*.1,0,1));
  const palm=hold?v(d*.228,1.291,.401):v(d*.169,1.33+.026*Math.sin(cycle),.302-push*Math.cos(cycle));
  arm(p,side,palm,v(d*.68,-.49,-.31),v(0,1,.18));
 }
 return p;
}

export function curvedTreadmillHeight(z){
 const reach=clamp(Math.abs(z)/.856,0,1);
 return .147+.262*reach*reach;
}

function assaultRun(t){
 const running=gait(t,{tread:true,run:true,fixedStride:1.18});
 const p=actor(v(running.hips[0],running.hips[1]+.070,.085),.255);
 p.machineTravel=running.machineTravel;
 for(const [side,sign] of [['l',1],['r',-1]]){
  const pace=running[side+'a'];
  const z=pace[2]+.071;
  const deck=curvedTreadmillHeight(z);
  const y=pace[1]+deck-deckTop;
  leg(p,side,v(sign*.086,y,z),v(sign*.021,-.079,.130),v(sign*.09,.05,1));
  if(running.planted[side]!=null)p.planted[side]=deck;
  arm(p,side,v(sign*.352,1.158,.515),v(sign*.64,-.70,-.37),v(0,0,1));
 }
 return p;
}

function backwardTread(t){
 const q=gait(t,{tread:true,fixedStride:.543});
 const root=v(q.hips[0],q.hips[1],-.014);
 const p=actor(root,-.020);
 p.machineTravel=q.machineTravel;
 [p.lh,p.rh]=[p.rh,p.lh];
 [p.ls,p.rs]=[p.rs,p.ls];
 for(const [side,sign] of [['l',1],['r',-1]]){
  const ankle=q[side+'a'];
  leg(p,side,v(-sign*.102,ankle[1]-.006,ankle[2]-.04),v(0,-.072,-.138),v(-sign*.12,.08,-1));
  if(q.planted[side]!=null)p.planted[side]=deckTop;
  arm(p,side,v(-sign*.401,1.034,.333),v(-sign*.54,-.37,-.71),v(0,0,1));
 }
 return p;
}

function reclinedBicycle(t){
 const angle=tau*t*3;
 const p=actor(v(0,.645,-.455),-.592);
 for(const [side,sign] of [['l',1],['r',-1]]){
  const part=angle+(sign===1?0:Math.PI);
  const ankle=v(sign*.143,.432+.027*Math.cos(part)+.156*Math.sin(part),.298+.153*Math.cos(part));
  leg(p,side,ankle,v(sign*.014,-.026,.152),v(sign*.13,.94,.29));
  arm(p,side,v(sign*.290,.638,-.327),v(sign*.66,-.34,-.48),v(0,0,1));
 }
 return p;
}

function stepmillWalk(t){
 const phase=3*t;
 const p=actor(v(.021*Math.sin(tau*phase),1.288+.019*Math.sin(tau*phase*2),.015),.060);
 p.machineTravel=2*phase;
 for(const [side,d,offset] of [['l',1,0],['r',-1,.5]]){
  const q=phase+offset, step=q%1;
  const support=.614;
  const swing=clamp((step-support)/(1-support),0,1);
  const railStep=1-2*step+2*smooth(swing);
  const railY=.555+railStep*.158, railZ=railStep*.246;
  const swingHeight=.105*Math.sin(Math.PI*swing);
  leg(p,side,v(d*.138,railY+.078+swingHeight,railZ-.032),v(d*.012,-.074,.139),v(d*.13,0,1));
  if(step<=support)p.planted[side]=railY;
  arm(p,side,v(d*.34,1.459,.32),v(d*.71,-.58,-.30),v(0,.25,1));
 }
 return p;
}

function rowing(t){
 const f=(t*2)%1;
 const drive=smooth(f/.31)*(1-smooth((f-.655)/.345));
 const lay=smooth((f-.195)/.246)*(1-smooth((f-.57)/.16));
 const curl=smooth((f-.305)/.166)*(1-smooth((f-.49)/.14));
 const p=actor(v(0,.429,blend(.10,-.349,drive)),blend(.30,-.20,lay));
 for(const [side,d] of [['l',1],['r',-1]]){
  leg(p,side,v(d*.118,.259,.441),v(d*.009,.081,.128),v(d*.09,.919,.25));
  const reach=v(d*.167,blend(.613,.743,curl),p[side+'s'][2]+blend(.479,.222,curl));
  arm(p,side,reach,v(d*.58,-.41,-.49),v(1,0,0));
 }
 return p;
}

function ropeSkip(t){
 const spins=6*t;
 const f=spins%1;
 const flight=clamp((f-.315)/.510,0,1);
 const jump=Math.sin(Math.PI*flight);
 const loading=smooth((f-.19)/.10)*(1-smooth((f-.296)/.06));
 const soften=smooth((f-.80)/.084)*(1-smooth((f-.91)/.083));
 const p=actor(v(0,.827+.106*jump-.027*loading-.023*soften,0),.043+.013*loading);
 p.machineTravel=spins;
 for(const [side,d] of [['l',1],['r',-1]]){
  leg(p,side,v(d*.136,.076+.109*jump,.032+.017*jump),v(d*.014,-.075-.052*jump,.145),v(d*.059,0,1));
  if(!jump || jump<.005)p.planted[side]=0;
  const wave=tau*spins;
  const grasp=add(p.hips,v(d*.283,.030+.021*Math.sin(wave),.114+.021*Math.cos(wave)));
  arm(p,side,grasp,v(d*.45,-.67,-.49),v(0,.29,1));
 }
 return p;
}

function farmerCarry(t,variant){
 const quick=variant!=='kettles';
 const lower=gait(t,{fast:quick,fixedStride:variant==='bar'?.845:quick?.921:.694});
 const p=actor(lower.hips,.022);
 p.planted=lower.planted;
 p.followZ=lower.followZ;
 for(const [side,d] of [['l',1],['r',-1]]){
  for(const j of ['k','a','t'])p[side+j]=lower[side+j];
  const x=d*(variant==='bar'?.321:variant==='kettles'?.275:.277);
  const desired=v(x,p[side+'s'][1]-(variant==='bar'?.578:.580),p.hips[2]-.017);
  arm(p,side,desired,v(d*.499,-.019,-.711),v(0,.047,1));
  if(distance(p[side+'w'],desired)>.008)throw Error('Loaded grasp not maintained');
 }
 if(variant==='dumbbells')p.dumbbells=[{center:p.lw,axis:p.lGrip},{center:p.rw,axis:p.rGrip}];
 return p;
}

function handsAround(p,center,level=0,space=.113){
 for(const [side,d] of [['l',1],['r',-1]]){
  const hand=add(center,v(d*space,d*level,.002));
  arm(p,side,hand,v(d*.81,-.60,-.23),v(d*-.36,.84,.41));
 }
}

function chestPass(t){
 const phase=(2*t)%1, seconds=1.9;
 const releaseAt=.270;
 const toWall=.187,toHands=.215;
 const releasePoint=v(0,1.245,.737);
 const wallZ=1.254;
 const outwardVelocity=(wallZ-releasePoint[2])/toWall;
 const launchUp=1.50;
 const wallY=releasePoint[1]+launchUp*toWall-4.905*toWall*toWall;
 const wallVelocityY=launchUp-9.81*toWall;
 const returnSpeed=(wallZ-.536)/toHands;
 const catchPoint=v(0,wallY+wallVelocityY*toHands-4.905*toHands*toHands,.536);
 const catchAt=releaseAt+(toWall+toHands)/seconds;
 const travel=(phase-releaseAt)*seconds;
 const push=smooth((phase-.095)/.17)*(1-smooth((phase-.425)/.285));
 const catchAbsorb=smooth((phase-catchAt)/.085)*(1-smooth((phase-.658)/.131));
 const p=actor(v(-.018+.053*push,.837-.036*catchAbsorb,-.044+.142*push),.052+.079*push);
 p.machineTravel=2*t;
 for(const [side,d] of [['l',1],['r',-1]]){
  const rearLift=side==='r'?.029*push:0;
  leg(p,side,v(d*.138,.076+rearLift,side==='l'?.207:-.235),v(d*.008,-.071-rearLift,.147),v(d*.075,0,1));
  p.planted[side]=0;
 }
 const ready=v(0,1.174,.266);
 let hands, open=0;
 if(travel<=0){
  const touch=smooth((phase-.090)/(releaseAt-.090));
  p.ballCenter=mix(ready,releasePoint,touch);hands=p.ballCenter;
 }else if(travel<=toWall+toHands){
  if(travel<=toWall)p.ballCenter=add(releasePoint,v(0,launchUp*travel-4.905*travel*travel,outwardVelocity*travel));
  else{
   const back=travel-toWall;
   p.ballCenter=v(0,wallY+wallVelocityY*back-4.905*back*back,wallZ-returnSpeed*back);
  }
  const progress=travel/(toWall+toHands);
  hands=mix(releasePoint,catchPoint,smooth(progress));
  open=.044*Math.sin(Math.PI*progress);
 }else{
  const absorb=smooth((phase-catchAt)/.211);
  p.ballCenter=mix(catchPoint,ready,absorb);hands=p.ballCenter;
 }
 handsAround(p,hands,0,.113+open);
 return p;
}

function overheadSlam(t){
 const phase=(2*t)%1, seconds=2.2;
 const ready=v(0,1.204,.267);
 const overhead=v(0,1.895,.134);
 const releasePoint=v(0,1.335,.485);
 const releaseAt=.380;
 const radius=.111,dropVelocity=4.82,drift=.76;
 const toFloor=(-dropVelocity+Math.sqrt(dropVelocity*dropVelocity+19.62*(releasePoint[1]-radius)))/9.81;
 const bounceAt=releaseAt+toFloor/seconds;
 const bounceZ=releasePoint[2]+toFloor*drift;
 const upward=3.47,rebound=.253,rollBack=.36;
 const catchPoint=v(0,radius+rebound*upward-4.905*rebound*rebound,bounceZ-rollBack*rebound);
 const catchAt=bounceAt+rebound/seconds;
 const travel=(phase-releaseAt)*seconds;
 const depth=smooth((phase-.281)/.238)*(1-smooth((phase-.62)/.253));
 const hips=v(0,.844-.266*depth,-.050-.079*depth);
 const p=actor(hips,.053+.523*depth);
 p.machineTravel=2*t;
 for(const [side,d] of [['l',1],['r',-1]]){
  leg(p,side,v(d*.167,.076,.029),v(d*.019,-.075,.151),v(d*.22,.025,1));
  p.planted[side]=0;
 }
 let hands, open=0;
 if(phase<=.205){
  p.ballCenter=mix(ready,overhead,smooth(phase/.205));hands=p.ballCenter;
 }else if(travel<=0){
  p.ballCenter=mix(overhead,releasePoint,smooth((phase-.235)/(releaseAt-.235)));hands=p.ballCenter;
 }else if(travel<=toFloor+rebound){
  if(travel<=toFloor)p.ballCenter=add(releasePoint,v(0,-dropVelocity*travel-4.905*travel*travel,drift*travel));
  else{
   const bounced=travel-toFloor;
   p.ballCenter=v(0,radius+bounced*upward-4.905*bounced*bounced,bounceZ-rollBack*bounced);
  }
  const catchMove=travel/(toFloor+rebound);
  hands=mix(releasePoint,catchPoint,smooth(catchMove));
  open=.047*Math.sin(Math.PI*catchMove);
 }else{
  const recovery=smooth((phase-catchAt)/.254);
  p.ballCenter=mix(catchPoint,ready,recovery);hands=p.ballCenter;
 }
 handsAround(p,hands,0,.114+open);
 return p;
}

function turn(offset,yaw){
 return v(offset[0]*Math.cos(yaw)+offset[2]*Math.sin(yaw),offset[1],offset[2]*Math.cos(yaw)-offset[0]*Math.sin(yaw));
}
function kbGrasp(p,bell,{pitch=0,goblet=false}={}){
 p.bellCenter=bell; p.bellTilt=pitch;
 for(const [side,x] of [['l',1],['r',-1]]){
  const holder=add(bell,goblet?v(x*.071,-.046,0):v(x*.043,0,0));
  arm(p,side,holder,v(x*.76,-.56,-.31),goblet?v(x*-.28,.94,.19):v(1,0,0));
 }
}
function fixedStance(p,width,z=0,yaw=0,toeBias=.04,tipSide){
 for(const [side,d] of [['l',1],['r',-1]]){
  const lift=tipSide===side?.037*Math.abs(yaw)/.4:0;
  leg(p,side,v(d*width,.076+lift,z),turn(v(d*toeBias,-.075-lift,.139),yaw*.68),turn(v(d*.135,.020,1),yaw*.71));
  p.planted[side]=0;
 }
}
function kettleDeadlift(t){
 const d=.5+.5*Math.cos(tau*t*2);
 const lean=.052+.877*d, hipZ=.028-.263*d;
 const target=v(0,blend(.776,.236,d),.151+.024*d);
 const deltaZ=target[2]-hipZ-.515*Math.sin(lean);
 const maxDrop=Math.sqrt(.603**2-.133**2-deltaZ**2);
 const hipY=Math.min(.844-.334*d,target[1]+maxDrop-.515*Math.cos(lean));
 const p=actor(v(0,hipY,hipZ),lean);
 fixedStance(p,.155,.033,0,.024);
 kbGrasp(p,target);
 return p;
}
function kettleRDL(t){
 const d=Math.sin(tau*t)**2;
 const p=actor(v(0,.855-.060*d,.019-.292*d),.049+1.04*d);
 fixedStance(p,.158,.019,0,.023);
 const by=(p.ls[1]+p.rs[1])/2-.567;
 kbGrasp(p,v(0,by,.115+.066*d));
 return p;
}
function goblet(t){
 const f=(t*2)%1;
 const d=smooth((f-.084)/.302)*(1-smooth((f-.620)/.303));
 const p=actor(v(0,.842-.300*d,.024-.167*d),.111+.241*d);
 fixedStance(p,.210,.013,0,.047);
 kbGrasp(p,add(p.chest,v(0,.075,.249)),{goblet:true});
 return p;
}
function twoHandSwing(t){
 const f=(t*3)%1;
 const d=smooth((f-.137)/.372)*(1-smooth((f-.533)/.260));
 const high=.5+.5*Math.cos(tau*f);
 const theta=blend(-.755,1.425,high);
 const p=actor(v(0,.842-.155*d,-.004-.231*d),.054+.838*d);
 fixedStance(p,.236,.023,0,.047);
 const shoulders=mix(p.ls,p.rs,.5);
 const holder=add(shoulders,v(0,-Math.cos(theta)*.577,Math.sin(theta)*.577));
 kbGrasp(p,holder,{pitch:-theta*.87});
 return p;
}
function woodchop(t){
 const left=t<.5, sign=left?1:-1;
 const f=(t*2)%1;
 const lift=smooth(f/.217)*(1-smooth((f-.793)/.207));
 const stroke=smooth((f-.217)/.273)*(1-smooth((f-.526)/.258));
 const yaw=sign*(lift*.308-stroke*.660);
 const hip=v(sign*(.036*lift-.118*stroke),.846-.176*stroke,.026-.041*stroke);
 const p=actor(hip,.057+.221*stroke);
 for(const field of ['chest','neck','head','lh','rh','ls','rs'])p[field]=add(hip,turn(sub(p[field],hip),yaw));
 fixedStance(p,.219,.031,yaw,.037,stroke>.12?(left?'l':'r'):undefined);
 const target=v(sign*(.280*lift-.556*stroke),1.242+.253*lift-.730*stroke,.375+stroke*.060);
 kbGrasp(p,target,{goblet:true});
 return p;
}

function standBike(t){
 const angle=tau*t*4;
 const low=Math.abs(Math.sin(angle));
 const p=actor(v(.017*Math.cos(angle),1.10+.017*(1-low),.046),.262);
 for(const [side,d] of [['l',1],['r',-1]]){
  const a=angle+(d===1?0:Math.PI);
  leg(p,side,v(d*.142,.451+Math.sin(a)*.161,.055+Math.cos(a)*.161-.063),v(0,-.074,.151),v(d*.11,0,1));
  arm(p,side,v(d*.225,1.17,.275),v(d*.47,-.85,-.30),v(0,0,1));
 }
 return p;
}
function oneHandKettleCarry(t){
 const lower=gait(t,{fixedStride:.709});
 const p=actor(lower.hips,.029);
 p.planted=lower.planted;
 p.followZ=lower.followZ;
 for(const j of ['k','a','t']){
  p['l'+j]=lower['l'+j];
  p['r'+j]=lower['r'+j];
 }
 arm(p,'l',v(.286,p.ls[1]-.584,p.hips[2]-.042),v(.53,-.21,-.58),v(0,.032,1));
 arm(p,'r',v(-.221,p.rs[1]-.536,p.hips[2]+.134*Math.cos(tau*t*3)),v(-.41,-.37,-.81));
 return p;
}
function ropeStance(p,cycle){
 for(const [side,d] of [['l',1],['r',-1]]){
  const holder=add(p.hips,v(d*.280,.033+.020*Math.sin(tau*cycle),.119+.017*Math.cos(tau*cycle)));
  arm(p,side,holder,v(d*.43,-.60,-.61),v(0,.26,1));
 }
}
function sideToSideRope(t){
 const cycle=t*6, f=cycle%1;
 const d=Math.floor(cycle)%2===0?1:-1;
 const airtime=clamp((f-.313)/.49,0,1);
 const height=.118*Math.sin(Math.PI*airtime);
 const x=d*(.179-.358*smooth(airtime));
 const p=actor(v(x,.831+height-.019*Math.sin(Math.PI*f)**2,0),.040);
 p.machineTravel=cycle;
 for(const [side,sign] of [['l',1],['r',-1]]){
  leg(p,side,v(x+sign*.104,.076+height,.032),v(sign*.018,-.073-.043*Math.sin(Math.PI*airtime),.148),v(sign*.17,0,1));
  if(height<.002)p.planted[side]=0;
 }
 ropeStance(p,cycle);
 return p;
}
function highKneeRope(t){
 const cycle=t*6, f=cycle%1;
 const d=Math.floor(cycle)%2===0?1:-1;
 const lead=d===1?'l':'r';
 const hop=Math.sin(Math.PI*clamp((f-.349)/.428,0,1));
 const high=smooth((f-.119)/.225)*(1-smooth((f-.679)/.301));
 const p=actor(v(-d*.023*high,.840+.067*hop,0),.039);
 p.machineTravel=cycle;
 for(const [side,sign] of [['l',1],['r',-1]]){
  const flex=side===lead?high:0;
  const y=.076+.078*hop+.411*flex,z=.025+.282*flex;
  leg(p,side,v(sign*.094,y,z),v(sign*.010,-.074-.035*hop+.013*flex,.150),v(sign*.12,.085+flex*.17,1));
  if(hop<.001&&flex<.001)p.planted[side]=0;
 }
 ropeStance(p,cycle);
 return p;
}
function doubleUnder(t){
 const cycle=t*4, f=cycle%1;
 const air=clamp((f-.205)/.545,0,1);
 const height=.193*4*air*(1-air);
 const spin=f<.316 ? .55*f/.316
   :f<.647 ? .55+(f-.316)/.331
   :1.55+(f-.647)/.353*.45;
 const p=actor(v(0,.827+height-.014*Math.sin(tau*f)**2,0),.032);
 p.machineTravel=2*Math.floor(cycle)+spin;
 for(const [side,d] of [['l',1],['r',-1]]){
  leg(p,side,v(d*.127,.076+height,.025),v(d*.012,-.072-.033*Math.sin(Math.PI*air),.153),v(d*.075,0,1));
  if(height<.002)p.planted[side]=0;
 }
 ropeStance(p,p.machineTravel);
 return p;
}
function gobletJump(t){
 const f=(t*2)%1;
 const load=smooth(f/.272)*(1-smooth((f-.279)/.161));
 const settle=smooth((f-.665)/.091)*(1-smooth((f-.772)/.216));
 const jump=clamp((f-.444)/.225,0,1);
 const h=.204*4*jump*(1-jump);
 const bend=.75*load+.45*settle;
 const p=actor(v(0,.835+h-.323*bend,.022-.162*bend),.087+.243*bend);
 for(const [side,d] of [['l',1],['r',-1]]){
  leg(p,side,v(d*.183,.076+h,.031),v(d*.031,-.075-.041*Math.sin(Math.PI*jump),.157),v(d*.209,0,1));
  if(h<.001)p.planted[side]=0;
 }
 kbGrasp(p,add(p.chest,v(0,.098,.240)),{goblet:true});
 return p;
}

function highRopeJump(t){
 const cycle=t*5,f=cycle%1;
 const u=clamp((f-.296)/.486,0,1), h=.207*4*u*(1-u);
 const bend=.063*Math.sin(Math.PI*f)**2*(1-smooth(h/.060));
 const p=actor(v(0,.838+h-bend,0),.036);
 p.machineTravel=cycle;
 for(const [s,d] of [['l',1],['r',-1]]){
  leg(p,s,v(d*.133,.076+h,.033),v(d*.013,-.075-.058*Math.sin(Math.PI*u),.143),v(d*.11,0,1));
  if(h<.001)p.planted[s]=0;
 }
 ropeStance(p,cycle);
 return p;
}
function skipStepRope(t){
 const cycle=t*6,f=cycle%1;
 const sign=Math.floor(cycle)%2===0?1:-1;
 const flight=clamp((f-.337)/.422,0,1), h=.096*Math.sin(Math.PI*flight);
 const point=sign*(1-2*smooth(flight));
 const p=actor(v(.025*point,.828+h,.015),.044);
 p.machineTravel=cycle;
 for(const [s,d] of [['l',1],['r',-1]]){
  leg(p,s,v(d*.107,.076+h,.025+d*point*.122),v(d*.013,-.075-.038*Math.sin(Math.PI*flight),.146),v(d*.11,0,1));
  if(h<.001)p.planted[s]=0;
 }
 ropeStance(p,cycle);
 return p;
}
function highMarch(t){
 const cycle=t*2,stride=.704,rootZ=stride*(cycle-1);
 const p=actor(v(.016*Math.sin(tau*cycle),.832-.013*Math.cos(tau*cycle*2),rootZ),.025);
 p.followZ=rootZ;
 for(const [s,d,o] of [['l',1,0],['r',-1,.5]]){
  const step=cycle+o,q=step%1,stance=.614;
  const u=clamp((q-stance)/(1-stance),0,1),h=.370*Math.sin(Math.PI*u);
  const cross=(Math.floor(step)-step)*stride+.296+smooth(u)*stride;
  leg(p,s,v(d*.104,.076+h,rootZ+cross),v(d*.012,-.073,.150),v(d*.100,.055,1));
  if(q<=stance)p.planted[s]=0;
  arm(p,s,add(p[s+'s'],v(d*.051,-.500,.197*Math.cos(tau*q))),v(d*.52,-.40,-.47));
 }
 return p;
}
function highKneeRun(t){
 const cycle=t*6, f=cycle%1, sign=Math.floor(cycle)%2===0?1:-1;
 const p=highKneeRope(t);
 p.machineTravel=0;
 for(const [s,d] of [['l',1],['r',-1]]){
  const forward=sign*d===-1?1:0;
  const degree=smooth(f/.225)*(1-smooth((f-.60)/.40));
  const wrist=add(p[s+'s'],v(d*.05,-.411+forward*.145*degree,.080+(2*forward-1)*.271*degree));
  arm(p,s,wrist,v(d*.49,-.680,-.29));
 }
 return p;
}
function wallKnee(t){
 const cycle=6*t,f=cycle%1,sign=Math.floor(cycle)%2===0?1:-1;
 const max=smooth(f/.267)*(1-smooth((f-.61)/.385));
 const p=actor(v(0,.847,-.130),.275);
 for(const [s,d] of [['l',1],['r',-1]]){
  const flex=sign===d?max:0;
  leg(p,s,v(d*.104,.077+.395*flex,-.244+.427*flex),v(d*.010,-.071,.146),v(d*.064,.09,1));
  if(flex<.002)p.planted[s]=0;
  arm(p,s,v(d*.219,1.251,.536),v(d*.57,-.46,.08),v(d*-.26,.929,.132));
 }
 return p;
}
function lateralPower(t,single){
 const cycles=single?4:6, stage=t*cycles,f=stage%1;
 const sign=Math.floor(stage)%2===0?1:-1;
 const flight=clamp((f-.279)/.429,0,1), shift=smooth(flight);
 const jump=.137*4*flight*(1-flight);
 const land=smooth((f-.7)/.123)*(1-smooth((f-.827)/.173));
 const load=smooth((f-.082)/.153)*(1-smooth((f-.242)/.045));
 const bend=.065*land+.062*load;
 const x=sign*(.216-.432*shift);
 const p=actor(v(x-(single?.064:0),.834+jump-bend,.011),.051+.170*(land+load));
 for(const [s,d] of [['l',1],['r',-1]]){
  const free=single&&s==='r';
  leg(p,s,v(x+d*(single?.035:.103),.076+jump+(free?.213:0),.029+(free?-.158:0)),
   v(d*.011,-.073-.030*Math.sin(Math.PI*flight),.150),v(d*.083,.014,1));
  if(jump<.001&&!free)p.planted[s]=0;
  const arms=smooth((f-.08)/.14)*(1-smooth((f-.48)/.30));
  arm(p,s,add(p[s+'s'],v(d*(.043+.12*arms),-.485+.257*arms,.153+.214*arms)),v(d*.64,-.52,-.30));
 }
 return p;
}
function gobletMobility(t){
 const f=t%1;
 const d=smooth(f/.26)*(1-smooth((f-.754)/.246));
 const sway=.061*Math.sin(tau*2*(f-.258))*smooth((f-.24)/.075)*(1-smooth((f-.688)/.090));
 const p=actor(v(sway,.841-.542*d,.024-.223*d),.076+.565*d);
 fixedStance(p,.209,.071,0,.053);
 const held=add(p.chest,v(0,.065+.179*d,.207-.047*d));
 p.bellCenter=held;p.bellTilt=0;
 for(const [side,x] of [['l',1],['r',-1]]){
  const knee=p[side+'k'], shoulder=p[side+'s'];
  const elbowHint=mix(add(shoulder,v(x*.107,-.224,.036)),add(knee,v(-x*.042,.026,-.005)),d);
  arm(p,side,add(held,v(x*.071,-.046,0)),sub(elbowHint,shoulder),v(-x*.21,.92,.18));
 }
 return p;
}
function elevatedGoblet(t){
 const f=(t*2)%1;
 const d=smooth((f-.082)/.284)*(1-smooth((f-.61)/.306));
 const p=actor(v(0,.869-.303*d,.024-.110*d),.055+.129*d);
 for(const [s,d] of [['l',1],['r',-1]]){
  leg(p,s,v(d*.193,.106,-.027),v(d*.028,-.105,.155),v(d*.209,.01,1));
 }
 kbGrasp(p,add(p.chest,v(0,.074,.245)),{goblet:true});
 return p;
}
function suitcaseBarWalk(t){
 const lower=gait(t,{fixedStride:.683});
 const p=actor(lower.hips,.021);
 p.planted=lower.planted;
 p.followZ=lower.followZ;
 for(const j of ['k','a','t']){
  p['l'+j]=lower['l'+j];
  p['r'+j]=lower['r'+j];
 }
 arm(p,'l',v(.324,p.ls[1]-.580,p.hips[2]-.041),v(.64,-.24,-.47),v(0,0,1));
 arm(p,'r',v(-.224,p.rs[1]-.545,p.hips[2]+.123*Math.cos(tau*t*3)),v(-.47,-.29,-.76));
 return p;
}

const all={
 '2917':[t=>farmerCarry(t,'dumbbells'),'dumbbells',4000,39,15,[0,.91,0],2.12],
 '3576':[t=>farmerCarry(t,'kettles'),'rig-kettles-carry',3780,41,17,[0,.91,0],2.17],
 '2912':[t=>farmerCarry(t,'bar'),'rig-trap-carry',4000,36,21,[0,.91,0],2.29],
 '1161':[rowing,'rig-rower',4400,67,14,[0,.75,-.039],1.92],
 '2612':[ropeSkip,'rig-jump-rope',3600,29,12,[0,1.04,.03],2.42],
 '1302':[chestPass,'rig-pass-ball',3800,103,15,[0,.91,.52],2.18],
 '1354':[overheadSlam,'rig-slam-ball',4400,47,13,[0,.99,.215],2.30],
 '3322':[kettleDeadlift,'rig-single-kettlebell',4600,63,15,[0,.89,.01],2.11],
 '0534':[goblet,'rig-single-kettlebell',4800,40,13,[0,.91,.035],2.15],
 '4861':[kettleRDL,'rig-single-kettlebell',4300,72,13,[0,.89,.02],2.14],
 '0549':[twoHandSwing,'rig-single-kettlebell',3600,60,17,[0,.85,.08],2.15],
 '8025':[woodchop,'rig-single-kettlebell',5650,24,11,[0,.89,.06],2.17],
 '0798':[standBike,'rig-bike',4200,62,14,[0,.89,.03],2.12],
 '5099':[oneHandKettleCarry,'rig-single-carry',3850,50,15,[0,.89,0],2.12],
 '3677':[highKneeRope,'rig-jump-rope',4200,45,13,[0,1.02,.03],2.35],
 '3675':[sideToSideRope,'rig-jump-rope',4200,16,13,[0,1.06,.06],2.42],
 '3885':[doubleUnder,'rig-jump-rope',3400,30,13,[0,1.05,.06],2.44],
 '3187':[gobletJump,'rig-single-kettlebell',4700,42,14,[0,.93,.04],2.20],
 '3678':[highRopeJump,'rig-jump-rope',3900,34,12,[0,1.06,0],2.43],
 '3676':[skipStepRope,'rig-jump-rope',4200,51,13,[0,1.04,0],2.43],
 '10759':[highMarch,'none',4560,63,13,[0,.89,0],2.16],
 '3556':[highKneeRun,'none',3500,47,13,[0,.9,.04],2.17],
 '3636':[wallKnee,'rig-contact-wall',3600,112,13,[0,.92,.20],2.26],
 '11782':[t=>lateralPower(t,false),'none',4200,17,12,[0,.90,.03],2.17],
 '7455':[t=>lateralPower(t,true),'none',4300,24,12,[0,.90,.05],2.14],
 '2993':[gobletMobility,'rig-single-kettlebell',5400,33,15,[0,.88,.03],2.16],
 '5496':[elevatedGoblet,'rig-goblet-plates',4650,58,16,[0,.93,.03],2.20],
 '2918':[suitcaseBarWalk,'rig-suitcase-bar',4070,43,18,[0,.92,0],2.24],
 '2258':[t=>gait(t),'none',3600,69,13,[0,.92,.01],2.11],
 '3004':[t=>gait(t,{fast:true}),'none',3800,57,11,[0,.90,.02],2.08],
 '2138':[bicycle,'rig-bike',4000,62,13,[0,.85,.02],2.01],
 '2259':[t=>gait(t,{tread:true}),'rig-treadmill',3600,55,13,[0,.90,.03],2.19],
 '2197':[t=>gait(t,{tread:true,run:true}),'rig-run-belt',3700,78,12,[0,.92,.04],2.18],
 '0684':[t=>gait(t,{tread:true,run:true}),'rig-run-belt',3700,64,14,[0,.92,.04],2.20],
 '2141':[ellipticalWalk,'rig-elliptical',4100,58,15,[0,1.04,.04],2.39],
 '4229':[assaultRun,'rig-assault-treadmill',3400,65,13,[0,1.13,.18],2.51],
 '9608':[backwardTread,'rig-treadmill',4500,121,15,[0,1.03,.12],2.39],
 '2193':[reclinedBicycle,'rig-reclined-bike',4320,60,14,[0,.70,-.13],1.78],
 '2279':[t=>bicycle(t,5),'rig-bike',3850,65,14,[0,.86,.03],2.08],
 '2331':[t=>ellipticalWalk(t,{cycles:4,stride:.265,lift:.083,push:.193,lean:.128}),'rig-elliptical',4200,64,13,[0,1.06,.03],2.43],
 '2658':[t=>ellipticalWalk(t,{cycles:3,stride:.333,lift:.041,push:.195,lean:.163}),'rig-elliptical',4220,66,14,[0,1.06,.04],2.46],
 '2192':[t=>ellipticalWalk(t,{cycles:3,stride:.161,lift:.052,lean:.057,hold:true}),'rig-elliptical-fixed',4350,58,14,[0,1.05,.04],2.38],
 '2140':[t=>ellipticalWalk(t,{cycles:3,stride:.209,lift:.102,lean:.041,hold:true}),'rig-elliptical-fixed',4450,61,15,[0,1.06,.035],2.40],
 '4259':[t=>ellipticalWalk(t,{cycles:4,stride:.199,lift:.068,push:.115,lean:.08}),'rig-elliptical',4200,60,16,[0,1.05,.03],2.42],
 '2311':[stepmillWalk,'rig-stepmill',4200,36,18,[0,1.17,.0],2.56],
};

export const cardioCatalogueIds = Object.freeze(Object.keys(all));

export function cardioCatalogueRecipe(id) {
  const spec = Object.hasOwn(all, id) ? all[id] : undefined;
  if (!spec) return undefined;
  const [motion, equipment, durationMs, yaw, elevation, focus, height] = spec;
  const floorTime = (-4.82 + Math.sqrt(4.82 ** 2 + 19.62 * (1.335 - .111))) / 9.81;
  const contacts = id === '1302' ? [.270, .270 + .187 / 1.9, .270 + (.187 + .215) / 1.9]
    : id === '1354' ? [.380, .380 + floorTime / 2.2, .380 + (floorTime + .253) / 2.2] : [];
  const repeated = contacts.flatMap((phase) => [phase / 2, .5 + phase / 2]);
  const segments = 64 - repeated.length;
  const times = [...new Set([...Array.from({ length: segments + 1 }, (_, i) => i / segments), ...repeated])].sort((a, b) => a - b);
  return {
    version: 1, durationMs, equipment,
    camera: { yaw, elevation, focus: [...focus], height },
    keyframes: times.map((at) => ({ at, ...motion(at) })),
  };
}
