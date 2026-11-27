import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, scale, sides, stand, subtract, unit } from './bodyweight/pose.mjs';

const axis=[1,0,0], forward=[0,0,1], floor=.077;
const sideCam={yaw:63,elevation:16,focus:[0,.83,.13],height:2.27};
const standCam={yaw:30,elevation:12,focus:[0,.93,.055],height:2.32};
const floorCam={yaw:63,elevation:22,focus:[0,.54,.17],height:1.98};
const rackCam={yaw:39,elevation:11,focus:[0,1.20,-.07],height:2.76};
const jobs=[];
function register(animation,equipment,muscles,camera,variants){
  for(const [id,profile]of variants){
    jobs.push({id,sample:p=>animation(p,profile),equipment:profile.equipment??equipment,
      muscles:profile.muscles??muscles,camera:{...camera,...profile.camera},duration:profile.duration??4610,poster:profile.poster??.47});
  }
}
function foot(pose,s,at,ground=0,toward=1){
  const sign=s==='l'?1:-1;
  leg(pose,s,at,[sign*.112,.114,toward],[sign*.014,-.072,toward*.135],ground);
}
function shoe(pose,s){
  return blend(pose[s+'a'],pose[s+'t'],.76);
}
function collar(pose,s){
  return blend(pose[s+'a'],pose[s+'k'],.166);
}
function thigh(pose,s){
  return blend(pose[s+'k'],pose[s+'h'],.236);
}
function rest(pose,s,sign,x=.088){
  arm(pose,s,add(pose[s+'h'],[sign*x,.072,.071]),[sign*.68,-.46,-.19]);
}
function clasp(pose){
  for(const[s,sign]of sides){
    const position=add(pose.chest,[sign*.057,.064,.151]);
    grip(pose,s,position,[sign*.74,-.55,-.24],axis);
  }
}
function elastic(pose,left,right,width=.066){
  const span=unit(add(subtract(left,right),[.001,.001,.001]));
  const turn=unit([.11*span[2],-.50*span[0],.93]);
  const wrap=(p,along,around)=>add(add(p,scale(span,along*width)),scale(turn,around*width));
  pose.bandPath=[wrap(left,0,1),wrap(left,1,.55),wrap(left,1,-.55),wrap(left,0,-1),
    wrap(right,0,-1),wrap(right,-1,-.50),wrap(right,-1,.55),wrap(left,0,1)];
}

function assistBar(phase,profile){
  const {kind,knee,under,holdWrist,single}=profile;
  const t=rep(phase,.38,.57);
  const muscle=kind==='muscle';
  const mantle=muscle?ramp(phase,.35,.48)*(1-ramp(phase,.58,.731)):0;
  const lift=muscle?.489*t+.531*mantle:.486*t;
  const y=1.042+lift;
  const pose=stand([single?-.113:0,y,muscle?mix(.126,-.004,mantle):.115+.041*t],.015+(muscle?.293*mantle:.077*t));
  for(const[s,sign]of sides){
    const live=!single||s==='r';
    const x=single?-.266:sign*(under?.245:.306);
    if(live){
      grip(pose,s,[x,2.144,.097],[sign*.73,-.53,muscle?.67*mantle-.41:-.47],under?[-1,0,0]:axis);
    }else{
      const near=holdWrist?[-.318,1.995,.176]:add(pose.chest,[-.045,-.071,.189]);
      arm(pose,s,near,[.62,-.68,-.34],[-.32,.99,-.13]);
    }
    const flex=knee&&(s==='r'||muscle);
    const anchorY=y-(flex?.46:.807);
    foot(pose,s,[sign*.118,anchorY,muscle?.111:flex?-.206:.078],undefined);
    delete pose.planted[s];
  }
  const contact=knee?pose.rk:shoe(pose,'r');
  const x=single?-.181:0;
  const root=[x,2.146,.101];
  pose.bandPath=[root,add(contact,[.059,-.021,-.015]),add(contact,[.035,-.051,.079]),
    add(contact,[-.038,-.055,.086]),add(contact,[-.051,-.020,-.015]),root];
  return pose;
}

function assistDip(phase,{dual,deep,hold}){
  const t=rep(phase,hold?.29:.41,hold?.64:.55);
  const hip=[0,.899-deep*t,.104+.102*t];
  const pose=stand(hip,.093+.258*t);
  for(const[s,sign]of sides){
    grip(pose,s,[sign*.266,1.177,.099],[sign*.68,-.43,-.55],forward);
    if(dual||s==='r'){
      pose[s+'k']=add(pose[s+'h'],[sign*.031,-.392,.145]);
      pose[s+'a']=add(pose[s+'k'],[sign*.015,-.125,-.402]);
      pose[s+'t']=add(pose[s+'a'],[sign*.008,-.077,-.105]);
    }else{
      foot(pose,s,[sign*.134,Math.max(.091,hip[1]-.752),-.01],undefined);
      delete pose.planted[s];
    }
  }
  const left=dual?pose.lk:add(pose.rk,[.085,.011,.032]);
  const right=pose.rk;
  pose.bandPath=[[.266,1.180,.12],add(left,[.032,-.037,.053]),add(right,[-.036,-.037,.053]),
    [-.266,1.180,.12],add(right,[-.033,-.038,-.045]),add(left,[.034,-.037,-.049]),[.266,1.180,.12]];
  return pose;
}

function anchoredHinge(phase,profile){
  const {kind,lean=.88,high,bodyBand,drop}=profile;
  const t=rep(phase,profile.hold?.31:.42,profile.hold?.71:.57);
  const nordic=kind==='nordic';
  const seated=kind==='decline';
  const station=kind==='ghd';
  const loaded=kind==='extension';
  const floorWork=kind==='floor';
  const extension=kind==='reverse';
  const fixedKneeY=station?1.064:.093;
  const kneeZ=station?-.17:.031;
  const fixedAnkle=station?[.114,1.048,-.593]:[.128,.119,-.391];
  const hipMotion = nordic||station?Math.sin(lean*t):0;
  const hips=nordic||station?[0,fixedKneeY+.426*Math.cos(lean*t),kneeZ+.417*hipMotion]:
    seated?[0,.684,.238]:floorWork?[0,.155,.041]:extension?[0,high?1.124:.57,.214]:[0,.850,.030];
  const pose=stand(hips,nordic||station?lean*t:seated?mix(-1.986,-.603,t):floorWork?mix(1.568,1.263,t):extension?(high?1.921:1.526):
    (drop??.791)+lean*t);
  if(station){
    pose.leverPressHandles=sides.map(([,sign])=>({pivot:[sign*.111,1.048,-.593],point:[0,.871,-.137],axis}));
  }
  if(seated){
    for(const[s,sign]of sides){
      pose[s+'k']=[sign*.153,.828,.520];
      pose[s+'a']=[sign*.149,.633,.789];
      pose[s+'t']=[sign*.164,.569,.902];
    }
  }else if(nordic||station){
    for(const[s,sign]of sides){
      pose[s+'k']=[sign*.124,fixedKneeY,kneeZ];
      pose[s+'a']=[sign*fixedAnkle[0],fixedAnkle[1],fixedAnkle[2]];
      pose[s+'t']=add(pose[s+'a'],[0,-.065,-.093]);
    }
  }else if (extension||floorWork){
    const hipRise=extension?mix(-2.14,-3.14,t):-3.102;
    for(const[s,sign]of sides){
      const sideActive=!profile.one||s==='r';
      const bend=(sideActive?hipRise:extension?-2.14:-3.102) - (floorWork&&profile.one&&s==='r'?.463*t:0);
      legAngles(pose,s,sign,bend,bend-.021,.021);
      if(extension){
        const contact=[sign*.221,high?.484:.427,.584];
        grip(pose,s,contact,[sign*.54,-.67,-.32],forward);
      }
    }
  }else if(loaded){
    for(const[s,sign]of sides){
      pose[s+'k']=[sign*.123,.624,-.295];
      pose[s+'a']=[sign*.126,.333,-.599];
      pose[s+'t']=[sign*.137,.211,-.613];
    }
  }
  if(!extension)clasp(pose);
  if(extension||floorWork&&profile.one){
    const c=shoe(pose,'r');
    pose.bandPath=profile.one?[add(c,[.047,0,.012]),[0,.177,.957],add(c,[-.047,0,.012])]:[shoe(pose,'l'),[0,.151,.956],shoe(pose,'r')];
  }else if(loaded){
    const surround=add(pose.chest,[0,.056,-.105]);
    pose.bandPath=[[.138,.176,-.685],add(surround,[.174,0,.021]),surround,add(surround,[-.173,0,.020]),[-.138,.176,-.685]];
  }else{
    const anchor=[0,(seated?.172:station?2.034:floorWork?.134:1.677),seated?-1.048:floorWork?.959:1.581];
    const c=bodyBand?add(pose.chest,[0,.050,.13]):pose.rw;
    pose.bandPath=[add(c,[.069,0,.004]),anchor,add(c,[-.071,0,.004]),add(c,[0,0,-.049])];
  }
  if(high)pose.ballCenter=[0,.744,.211];
  return pose;
}

function bandPlank(phase,profile){
  const {kind,quick,assist,withPartner}=profile;
  const t=rep(phase,quick?.27:.41,quick?.36:.60);
  const jack=kind==='jack';
  const climb=kind==='march'||kind==='spider';
  const row=kind==='row';
  const sideRow=kind==='side-row';
  const push=kind==='push';
  const hold=kind==='inverse';
  const glide=kind==='spider';
  const explode=push&&quick?ramp(phase,.44,.57)*(1-ramp(phase,.65,.82)):0;
  const duty=climb?rep(phase*2%1):t;
  const move=phase<.5?'r':'l';
  const hipY=sideRow?.479:hold?.393+.201*t:.565-(push?.184*t:0)+.125*explode;
  const shift=glide?.23*Math.sin(phase*Math.PI*2):0;
  const pose=stand([0,hipY,-.288+shift],sideRow?-1.194:hold?-1.147-.206*t:1.488+.214*(push?t:0));
  if(sideRow){
    pose.ls=[.034,.365,-.792];
    pose.rs=[-.018,.716,-.813];
    pose.lh=[0,.379,-.296];pose.rh=[0,.548,-.293];
  }
  for(const[s,sign]of sides){
    const active=s===move;
    const stance=jack?.130+.274*t:.155;
    const toe=[sign*stance,climb&&active?.091+.104*duty:.081,hold?.580:sideRow?.483:-1.036+shift];
    if(climb&&active)toe[2]+=.536*duty;
    if(glide&&active)toe[0]+=sign*.165*duty;
    if(sideRow){
      toe[0]=-sign*.047;
      toe[1]=s==='r'?.106:.078;
    }
    if(jack)toe[1]+=.088*Math.sin(Math.PI*t);
    const use=hold?1:-1;
    leg(pose,s,toe,[sign*(glide&&active?.62:.10),climb&&active?-.317:.54,use],
      [sign*.012,-.070,.137*use],climb&&active||jack||explode||sideRow?undefined:0);
    if(sideRow&&s==='l'){
      pose.le=[.034,.082,-.791];
      pose.lw=[.312,.033,-.793];
      pose.lFingers=[1,-.03,0];
      pose.lPalmSide=[0,1,.062];
    }else if(row&&s==='r'){
      grip(pose,s,blend([sign*.188,.054,.369+shift],[-.208,.315,.110+shift],t),[-.67,-.49,-.53],axis);
    }else if(sideRow&&s==='r'){
      const pull=blend([-.565,.690,-.427],[-.124,.612,-.488],t);
      grip(pose,s,pull,[-.75,-.12,.64],forward);
    }else if(hold){
      grip(pose,s,[sign*.172,.920,-.429],[sign*.64,-.72,-.09],axis);
    }else{
      const hand=[sign*(push?.224:.178)+(glide&&active?.058*duty:0),.041+.152*explode,.381+shift+
        (glide&&active?.124*duty:0)];
      arm(pose,s,hand,[sign*.622,-.23,-.61],[0,-.036,1],[0,1,0]);
    }
  }
  if(withPartner){
    const partner=stand([-1.127,.870,-.322],.016,1.526);
    for(const[s,sign]of sides){
      foot(partner,s,[-1.155,.078,-.359+sign*.165]);
      grip(partner,s,[-.765+sign*.024,.789,-.408+sign*.016],[sign*.57,-.63,.25],[0,0,1]);
    }
    pose.partner=partner;
    pose.bandPath=[pose.rw,partner.rw];
  }else if(jack||climb){
    elastic(pose,profile.thigh?thigh(pose,'l'):collar(pose,'l'),profile.thigh?thigh(pose,'r'):collar(pose,'r'),profile.thigh?.084:.054);
  }else if(hold){
    pose.bandPath=[pose.lw,[0,1.157,-.429],pose.rw];
  }else if(row){
    const anchor=[0,.163,.995];
    pose.bandPath=[pose.rw,anchor,pose.rw];
  }else if(assist){
    const c=add(pose.chest,[0,-.109,.024]);
    pose.bandPath=[[.551,1.248,.281],add(c,[.214,-.038,-.041]),c,add(c,[-.214,-.037,-.042]),[-.551,1.248,.281]];
  }else{
    const c=add(pose.chest,[0,.103,-.049]);
    pose.bandPath=[pose.lw,add(c,[.229,-.057,.038]),add(c,[.167,0,0]),c,
      add(c,[-.167,0,0]),add(c,[-.229,-.057,.038]),pose.rw];
  }
  return pose;
}

function bandFloorIsolate(phase,profile){
  const {kind,hold}=profile;
  const t=rep(phase,hold?.24:.40,hold?.72:.61);
  const seated=kind==='seat-hip'||kind==='hug';
  const sit=kind==='seat-hip';
  const prone=kind==='prone-rotate';
  const toeReach=kind==='toes';
  const raised=kind==='raise-dual'||toeReach;
  const pose=stand([0,sit?.562:seated?.158:.151,.033],
    sit?.015:seated?-.163:prone?1.567:toeReach?mix(-1.53,-.964,t):-1.553,0,.021);
  for(const[s,sign]of sides){
    const active=s==='r';
    const working=active?t:0;
    if(sit){
      const ankle=[sign*.139,.078,.413];
      foot(pose,s,ankle);
      pose[s+'k']=[sign*(.151+.170*t),.519,.390-.04*t];
      rest(pose,s,sign,.199);
    }else if(seated){
      const to=active?[sign*.141,.080,mix(.389,.317,t)]:[sign*.136,.077,.837];
      foot(pose,s,to);
      if(active)grip(pose,s,add(pose.ra,[-.036,.096,.025]),[-.74,-.60,-.17],axis);
      else grip(pose,s,add([-.141,.080,mix(.389,.317,t)],[.065,.097,.051]),[.62,-.45,-.52],axis);
      continue;
    }else if(prone){
      pose[s+'k']=add(pose[s+'h'],[sign*.022,-.025,-.418]);
      pose[s+'a']=active?add(pose.rk,[-.426*Math.sin(.645*t),.423*Math.cos(.645*t),-.026]):
        add(pose[s+'k'],[.016,-.010,-.423]);
      pose[s+'t']=add(pose[s+'a'],[sign*.015,-.048,-.127]);
      arm(pose,s,[sign*.116,.047,.684],[sign*.74,-.68,.02]);
      continue;
    }else if(raised){
      const angle=toeReach?1.473:mix(.225,1.522,t);
      legAngles(pose,s,sign,angle,angle-.023,.021);
      if(toeReach)grip(pose,s,add(pose.chest,[sign*.139,mix(.22,.461,t),.357+.129*t]),[sign*.62,.29,-.72],axis);
      else arm(pose,s,[sign*.211,.039,-.018],[sign*.64,-.56,-.36]);
      continue;
    }else{
      const ankle=[sign*(.129+.153*working),floor,.536-.044*working];
      leg(pose,s,ankle,[sign*.125+.555*working,.94,.08],[sign*.012,-.07,.137],0);
      arm(pose,s,[sign*.213,.035,-.161],[sign*.61,-.68,-.36]);
    }
  }
  if(sit)elastic(pose,thigh(pose,'l'),thigh(pose,'r'),.081);
  else if(seated)pose.bandPath=[pose.lw,collar(pose,'r'),add(collar(pose,'r'),[-.041,-.032,.011]),pose.rw];
  else if(toeReach)pose.bandPath=[pose.lw,shoe(pose,'l'),shoe(pose,'r'),pose.rw];
  else if(raised)pose.bandPath=[shoe(pose,'l'),[0,.134,1.184],shoe(pose,'r')];
  else{
    const c=collar(pose,'r');
    pose.bandPath=[add(c,[-.024,.028,.011]),[prone?-.978:.873,.169,prone?-.307:.482],add(c,[.025,.029,.010])];
  }
  return pose;
}

function bandOverheadMobility(phase,profile){
  const {kind,foam,dual}=profile;
  const t=rep(phase,.35,.63);
  const hook=kind==='overhead-hit';
  const wall=kind==='slide';
  const rack=kind==='rack';
  const heel=kind==='balance';
  const depth=foam?.083:0;
  const hips=[0,heel?1.158:.872,wall?.031:-.013];
  const pose=stand(hips,wall?.03:kind==='behind'?-.02:.026,0,kind==='side'?-.312*t:0);
  for(const[s,sign]of sides){
    const working=s==='r';
    if(heel&&working){
      const a=.66*t;
      const d=[-.421*Math.sin(a),-.421*Math.cos(a),.018];
      pose.rk=add(pose.rh,d);
      pose.ra=add(pose.rk,d);
      pose.rt=add(pose.ra,[-.014,-.067,.130]);
    }
    else foot(pose,s,[sign*(heel?.089:.161),heel?1.0*.292+.078:floor,.042],heel?.292:0);
    if(heel){rest(pose,s,sign,.353);continue;}
    if(wall){
      const y=1.12+.530*t;
      grip(pose,s,[sign*(.162+.041*t),y,.469-depth],[-sign*.06,-.66,.705],axis);
      continue;
    }
    const shoulder=pose[s+'s'];
    if(hook){
      if(!working){rest(pose,s,sign);continue;}
      const position=[-.168,1.894+.074*t,.211+t*.021];
      grip(pose,s,position,[-.57,-.66,-.30],axis);
    }else if(kind==='side'){
      if(!working){rest(pose,s,sign);continue;}
      grip(pose,s,add(shoulder,[-.065,-.554,-.015]),[-.68,-.62,.26],axis);
    }else if(rack){
      grip(pose,s,add(shoulder,[sign*mix(.095,.139,t),mix(.015,.177,t),.238+.028*t]),[sign*.575,-.20,.647],axis);
    }else if(kind==='behind'){
      grip(pose,s,add(shoulder,[sign*.237,-.511,mix(-.157,-.318,t)]),[sign*.70,-.56,-.27],axis);
    }else if(dual){
      grip(pose,s,add(shoulder,[sign*mix(-.112,.072,t),mix(-.512,-.587,t),mix(.135,.069,t)]),
        [sign*.64,-.54,-.26],axis);
    }else{
      const angle=mix(.279,4.385,t);
      grip(pose,s,add(shoulder,[sign*.389,-.456*Math.cos(angle),.454*Math.sin(angle)]),[sign*.72,-.56,.12],axis);
    }
  }
  if(heel)elastic(pose,collar(pose,'l'),collar(pose,'r'),.056);
  else if(hook)pose.bandPath=[[-.595,1.977,.242],pose.rw,[.595,1.977,.242]];
  else if(wall){
    const l=blend(pose.le,pose.lw,.28),r=blend(pose.re,pose.rw,.28);
    elastic(pose,l,r,.055);
      if(foam)pose.handRoller={center:[0,mix(l[1],r[1],.50)-.006,.444],axis};
  }else if(kind==='side'){
    const base=shoe(pose,'r');
    pose.bandPath=[pose.rw,add(base,[.052,-.023,.011]),add(base,[-.048,-.023,.010]),pose.rw];
  }else if(rack)pose.bandPath=[pose.lw,[0,1.619,1.162],pose.rw];
  else{
    pose.bandPath=[pose.lw,pose.rw];
    if(dual){
      const handBand=pose.bandPath;
      elastic(pose,collar(pose,'l'),collar(pose,'r'),.056);
      pose.secondaryBandPath=pose.bandPath;
      pose.bandPath=handBand;
    }
  }
  return pose;
}

function kettleBandPronation(phase){
  const t=rep(phase,.39,.59);
  const pose=stand([0,.866,.027],.056);
  for(const[s,sign]of sides)foot(pose,s,[sign*.151,.078,.035+sign*.074]);
  const elbow=add(pose.rs,[-.052,-.237,.032]);
  pose.re=elbow;
  const angle=mix(.23,1.906,t);
  pose.rw=add(elbow,[-.037,-.357*Math.cos(angle),.359*Math.sin(angle)]);
  pose.rGrip=unit([Math.cos(t*Math.PI*.96),.221,Math.sin(t*Math.PI*.96)]);
  rest(pose,'l',1);
  pose.bellCenter=add(pose.rw,[-.016,-.501,.013]);
  pose.bandPath=[pose.rw,add(pose.bellCenter,[-.035,-.010,0]),add(pose.bellCenter,[.035,-.010,0]),pose.rw];
  return pose;
}

function bandDigits(phase,{thumb}) {
  const t=rep(phase,thumb?.21:.43,thumb?.80:.59);
  const pose=stand([0,.565,-.023],.261);
  for(const[s,sign] of sides)foot(pose,s,[sign*.161,.078,.456]);
  const hand=[-.193,.599,.440];
  arm(pose,'r',hand,[-.29,-.94,.31],[.031,-.027,1],[0,-1,-.018]);
  pose.rFingerCurl=thumb?.31:.72*(1-t);
  pose.rFingerSpread=thumb?.012:.97*t;
  pose.rThumbExtend=thumb?.97*t:.69*t;
  rest(pose,'l',1,.172);
  const radius=thumb?.044+.022*t:.026+.043*t;
  const center=add(hand,[.003,.002,thumb?.011:.049-.023*t]);
  pose.bandPath=Array.from({length:7},(_,i)=>{
    const a=2*Math.PI*i/6;
    return add(center,[radius*Math.cos(a),.016*Math.sin(a),.022*Math.sin(a)]);
  });
  return pose;
}

register(assistBar,'pull-up-stretch-band',['lat','biceps'],rackCam,[
  ['4206',{kind:'chin',knee:true,under:true,camera:{yaw:43}}],
  ['0970',{kind:'pull',camera:{yaw:35}}],
  ['4415',{kind:'chin',under:true,camera:{yaw:44}}],
  ['10660',{kind:'pull',single:true,holdWrist:true,camera:{yaw:40}}],
  ['10903',{kind:'pull',single:true,knee:true,camera:{yaw:43}}],
  ['5801',{kind:'muscle',knee:true,duration:5470,camera:{yaw:43,focus:[0,1.46,.02],height:3.22},muscles:['lat','biceps','triceps','pec']}],
]);
register(assistDip,'dip-stretch-band',['triceps','pec'],sideCam,[
  ['4205',{dual:false,deep:.282,camera:{yaw:45}}],
  ['4719',{dual:true,hold:true,deep:.293,duration:5140,camera:{yaw:47}}],
]);
register(anchoredHinge,'nordic-mat-stretch-band',['hamstring','glute'],sideCam,[
  ['4985',{kind:'nordic',lean:1.12,bodyBand:true,equipment:'post-nordic-mat-stretch-band',camera:{yaw:66,focus:[0,.83,.19],height:2.34}}],
  ['4204',{kind:'nordic',lean:1.20,hold:true,equipment:'post-nordic-mat-stretch-band',camera:{yaw:69,focus:[0,.84,.21],height:2.39}}],
  ['4849',{kind:'ghd',lean:1.26,bodyBand:true,equipment:'ghd-stretch-band',camera:{yaw:62,focus:[0,1.173,.22],height:2.67}}],
  ['4905',{kind:'ghd',lean:1.443,bodyBand:false,equipment:'ghd-stretch-band',camera:{yaw:68,focus:[0,1.173,.22],height:2.67}}],
  ['0891',{kind:'extension',lean:.87,equipment:'extension-45-stretch-band',camera:{yaw:67,focus:[0,.78,-.18],height:2.19}}],
  ['0902',{kind:'extension',lean:1.01,equipment:'extension-45-stretch-band',camera:{yaw:69,focus:[0,.78,-.18],height:2.19}}],
  ['7999',{kind:'extension',lean:.98,drop:.764,equipment:'extension-45-stretch-band',muscles:['glute'],camera:{yaw:62,focus:[0,.78,-.18],height:2.19}}],
  ['3875',{kind:'extension',lean:1.11,drop:.771,equipment:'extension-45-stretch-band',camera:{yaw:59,focus:[0,.77,-.19],height:2.19}}],
  ['1498',{kind:'decline',lean:.88,equipment:'decline-post-stretch-band',muscles:['core'],camera:{yaw:63,focus:[0,.75,-.19],height:2.22}}],
  ['2423',{kind:'floor',bodyBand:true,equipment:'post-mat-stretch-band',muscles:['glute','trap'],camera:{...floorCam,yaw:59}}],
  ['4701',{kind:'floor',one:true,equipment:'post-mat-stretch-band',muscles:['r:glute'],camera:{...floorCam,yaw:62}}],
  ['2163',{kind:'reverse',equipment:'post-bench-stretch-band',camera:{yaw:68,focus:[0,.76,.06]}}],
  ['6738',{kind:'reverse',high:true,equipment:'ball-bench-post-stretch-band',camera:{yaw:62,focus:[0,.84,.10],height:2.22}}],
]);
register(bandPlank,'mat-stretch-band',['core'],floorCam,[
  ['6959',{kind:'push',assist:true,equipment:'assist-push-stretch-band',muscles:['pec','triceps','core'],camera:{yaw:63,focus:[0,.66,.09],height:2.13}}],
  ['10650',{kind:'push',quick:true,muscles:['pec','triceps','core'],duration:3450,camera:{yaw:59,focus:[0,.63,.12],height:2.09}}],
  ['4571',{kind:'push',muscles:['pec','triceps','core'],camera:{yaw:67}}],
  ['4379',{kind:'inverse',equipment:'band-inverted-stretch-band',muscles:['lat','biceps','core'],camera:{yaw:66,focus:[0,.68,-.19],height:2.21}}],
  ['7210',{kind:'jack',thigh:true,duration:3460,camera:{yaw:65}}],
  ['2162',{kind:'march',thigh:true,camera:{yaw:55}}],
  ['2943',{kind:'spider',thigh:true,camera:{yaw:54,elevation:26}}],
  ['8224',{kind:'row',equipment:'mat-post-stretch-band',muscles:['r:lat','core'],camera:{yaw:63,focus:[0,.56,.30],height:2.06}}],
  ['1501',{kind:'side-row',withPartner:true,muscles:['r:lat','core'],camera:{yaw:24,elevation:16,focus:[-.48,.79,-.30],height:2.38}}],
]);
register(bandFloorIsolate,'mat-stretch-band',['core'],floorCam,[
  ['0984',{kind:'prone-rotate',equipment:'mat-post-stretch-band',muscles:['r:glute'],camera:{yaw:-102,elevation:31,focus:[-.28,.55,-.21]}}],
  ['3023',{kind:'supine-rotate',equipment:'mat-post-stretch-band',muscles:['r:glute'],camera:{yaw:26,elevation:29,focus:[.24,.56,.19]}}],
  ['0995',{kind:'seat-hip',equipment:'seat-stretch-band',muscles:['glute'],camera:{yaw:18,focus:[0,.72,.19],height:1.91}}],
  ['7201',{kind:'raise-dual',equipment:'mat-post-stretch-band',camera:{yaw:61}}],
  ['2463',{kind:'toes',camera:{yaw:66,focus:[0,.58,.12]}}],
  ['10591',{kind:'hug',hold:true,camera:{yaw:56,focus:[0,.57,.14],height:1.84}}],
]);
register(bandOverheadMobility,'stretch-band',['shoulder'],standCam,[
  ['10651',{kind:'balance',equipment:'bosu-stretch-band',muscles:['r:glute','core'],camera:{yaw:25,focus:[0,1.02,.07],height:2.53}}],
  ['4685',{kind:'side',muscles:['core'],camera:{yaw:15}}],
  ['4516',{kind:'wrap',camera:{yaw:58,focus:[0,1.02,.13],height:2.49}}],
  ['3513',{kind:'behind',camera:{yaw:124,focus:[0,.95,-.11]}}],
  ['5147',{kind:'rack',equipment:'post-stretch-band',camera:{yaw:66,focus:[0,1.03,.30],height:2.51}}],
  ['10553',{kind:'overhead-hit',equipment:'rack-stretch-band',camera:{yaw:36,focus:[0,1.08,.15],height:2.59}}],
  ['5024',{kind:'slide',equipment:'wall-stretch-band',muscles:['shoulder','pec'],camera:{yaw:83,focus:[0,1.06,.15],height:2.51}}],
  ['5026',{kind:'slide',foam:true,equipment:'foam-wall-stretch-band',muscles:['shoulder','pec'],camera:{yaw:-100,focus:[0,1.06,.15],height:2.51}}],
  ['4025',{kind:'down',dual:true,equipment:'double-stretch-band',camera:{yaw:31}}],
]);
register(kettleBandPronation,'kettle-stretch-band',['r:forearm','r:biceps'],{...standCam,yaw:62},[
  ['10331',{duration:4810}],
]);
register(bandDigits,'seat-digit-stretch-band',['r:forearm'],{yaw:66,elevation:26,focus:[-.204,.757,.23],height:1.04},[
  ['8877',{thumb:false,duration:5080}], ['9996',{thumb:true,duration:6330,camera:{yaw:67}}],
]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional exact catalogue IDs.');
const chosen=ids.length?jobs.filter(job=>ids.includes(job.id)):jobs;
if(!chosen.length||ids.length&&chosen.length!==ids.length)throw Error('Invalid or duplicate catalogue IDs.');
const output=resolve(directory);
await mkdir(output,{recursive:true});
const items=[];
const failures=[];
for(const job of chosen){
  const recipe={version:1,equipment:job.equipment,muscles:job.muscles,camera:job.camera,durationMs:job.duration,
    keyframes:Array.from({length:65},(_,i)=>({at:i/64,...job.sample(i/64)}))};
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(output,job.id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id:job.id,recipe:job.id+'.json',posterAt:job.poster});
  }catch(e){failures.push([job.id,e.message]);}
}
if(items.length)await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
