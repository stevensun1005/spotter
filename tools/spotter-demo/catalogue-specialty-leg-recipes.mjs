import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareRecipe} from '../../skills/spotter-exercise-demo/lib/recipe.js';
import {add, blend, body, cycle, foot, joint, ramp, scale, sides} from './catalogue-dumbbell-recipes.mjs';

const mix=(a,b,t)=>a+(b-a)*t;
const X=[1,0,0];
const pole=(sign)=>[sign*.13,.26,.92];

function grips(pose,targets) {
  for(const [index,[side,sign]] of sides.entries()){
    [pose[side+'e'],pose[side+'w']]=joint(pose[side+'s'],targets[index],[sign*.59,-.71,-.12],.252,.371);
    pose[side+'Grip']=X;
  }
}

function handles(pose,points,pivot) {
  pose.leverPressHandles=points.map((point,index)=>({
    pivot:add(pivot,[index===0?.421:-.421,0,0]),point,axis:X,
  }));
  return pose;
}

function rotateLeg(pose,side,thigh,shin,toes) {
  const hip=pose[side+'h'];
  pose[side+'k']=add(hip,scale(thigh,.422));
  pose[side+'a']=add(pose[side+'k'],scale(shin,.424));
  pose[side+'t']=add(pose[side+'a'],toes);
}

function hipLever(phase,{kind}) {
  const amount=cycle(phase,.42,.59);
  const lateral=kind==='out'||kind==='in'||kind==='out-raise';
  const front=kind==='front';
  const press=kind==='footpress';
  const rear=kind==='rear';
  const hip=[-.022,press?.936:.907,.018];
  const pose=body(hip,press?.204:.024);
  pose.planted={r:press?.083:0};
  foot(pose,'r',-1,[-.167,press?.159:.075,.091],pole(-1),[-.016,-.066,.139]);
  if(lateral){
    const angle=kind==='in'?mix(.612,-.145,amount):mix(.103,kind==='out-raise'?.88:.735,amount);
    const sweep=kind==='in'?mix(.127,.243,amount):.033;
    const thigh=[Math.sin(angle)*Math.cos(sweep),-Math.cos(angle)*Math.cos(sweep),Math.sin(sweep)];
    const shin=[Math.sin(angle),-Math.cos(angle),0];
    rotateLeg(pose,'l',thigh,shin,[.014,-.063,.146]);
  }else if(press){
    const target=[.165,mix(.233,.365,amount),mix(-.332,-.664,amount)];
    foot(pose,'l',1,target,[.24,-.41,1],[.015,-.063,.146]);
  }else{
    const angle=front?mix(.030,1.47,amount):mix(-.023,rear?-.915:-.681,amount);
    const lower=angle+(front?-.44:rear?-.38:-.117)*amount;
    rotateLeg(pose,'l',[0,-Math.cos(angle),Math.sin(angle)],
      [0,-Math.cos(lower),Math.sin(lower)],[.011,-.068,.140]);
  }
  grips(pose,[[.239,1.097,.405],[-.239,1.097,.405]]);
  const contact=press?blend(pose.la,pose.lt,.50):front
    ?blend(pose.lh,pose.lk,.67):blend(pose.lk,pose.la,lateral?.19:.67);
  return handles(pose,[contact,[0,.415,.131]],lateral?[0,.861,.126]:[0,.716,.569]);
}

function kneelingPress(phase,{kind}) {
  const draw=cycle(phase,.43,.62);
  const adduction=kind==='adduction';
  const hips=adduction?[0,mix(.614,.956,draw),mix(-.224,-.093,draw)]:[0,.831,-.204];
  const pose=body(hips,adduction?mix(.593,.141,draw):.586);
  pose.planted={};
  const roller=[];
  for(const [side,sign] of sides){
    if(adduction||side==='r'){
      const knee=adduction?[sign*mix(.368,.162,draw),.555,.063]:[-.122,.531,-.074];
      pose[side+'k']=knee;
      pose[side+'a']=add(knee,[sign*.014,-.026,-.415]);
      pose[side+'t']=add(pose[side+'a'],[sign*.009,-.072,-.100]);
    }else{
      const angle=mix(-.10,-1.34,draw);
      const calf=angle-mix(1.39,.018,draw);
      rotateLeg(pose,'l',[0,-Math.cos(angle),Math.sin(angle)],[0,-Math.cos(calf),Math.sin(calf)],
        [.011,-.052,.138]);
    }
    roller.push(blend(pose[side+'k'],pose[side+'a'],adduction?.31:.58));
  }
  grips(pose,sides.map(([,sign])=>[sign*.235,adduction?1.147:1.009,.472]));
  return handles(pose,roller,[0,adduction?.294:.703,.253]);
}

function abductionHold(phase) {
  const hold=cycle(phase,.294,.756);
  const hip=[0,mix(.982,.663,hold),mix(.019,-.095,hold)];
  const pose=body(hip,mix(.022,.243,hold));
  pose.planted={l:.070,r:.070};
  const pads=[];
  for(const [side,sign] of sides){
    const ankle=[sign*.242,.145,.083];
    foot(pose,side,sign,ankle,[sign*.367,.13,.92],[sign*.035,-.069,.137]);
    pads.push(blend(pose[side+'h'],pose[side+'k'],.84));
  }
  grips(pose,[[.248,1.13,.42],[-.248,1.13,.42]]);
  return handles(pose,pads,[0,.343,.189]);
}

function curlHyper(phase) {
  const curl=phase<.515?cycle(phase/.515,.42,.56):0;
  const lift=phase<.515?0:cycle((phase-.515)/.485,.42,.57);
  const hip=[0,.653,.038];
  const pose=body(hip,1.526);
  pose.planted={};
  const contacts=[];
  for(const [side,sign] of sides) {
    const lean=mix(-.253,.072,lift);
    const calf=lean+1.386*curl;
    rotateLeg(pose,side,[0,Math.sin(lean),-Math.cos(lean)],[0,Math.sin(calf),-Math.cos(calf)],
      [sign*.013,-.136,.058]);
    contacts.push(blend(pose[side+'k'],pose[side+'a'],.69));
  }
  grips(pose,[[.208,.611,.708],[-.208,.611,.708]]);
  return handles(pose,contacts,[0,.425,-.635]);
}

function stepper(phase) {
  const wave=Math.cos(phase*Math.PI*4);
  const hip=[.031*wave,.980+.018*Math.cos(phase*Math.PI*8),.074];
  const pose=body(hip,.102);
  pose.planted={};
  const pedals=[];
  for(const [side,sign] of sides) {
    const height=.325+.141*wave*sign;
    const ankle=[sign*.178,height+.072,mix(.028,.138,.5+.5*sign*wave)];
    foot(pose,side,sign,ankle,pole(sign),[sign*.017,-.067,.145]);
    pose.planted[side]=height;
    pedals.push(add(ankle,[0,-.075,.063]));
  }
  grips(pose,[[.262,1.225,.487],[-.262,1.225,.487]]);
  return handles(pose,pedals,[0,.318,.635]);
}

function toeRaise(phase) {
  const t=cycle(phase,.43,.59);
  const pose=body([0,.558,-.049],.025);
  pose.planted={};
  const pads=[];
  for(const [side,sign] of sides) {
    const heel=[sign*.157,.124,.488];
    const rotation=mix(-.36,.66,t);
    foot(pose,side,sign,heel,[sign*.11,.63,.92],
      [sign*.011,.145*Math.sin(rotation),.145*Math.cos(rotation)]);
    pads.push(blend(pose[side+'h'],pose[side+'k'],.80));
  }
  grips(pose,[[.237,.799,.411],[-.237,.799,.411]]);
  return handles(pose,pads,[0,.294,.762]);
}

function donkeyCalf(phase) {
  const raise=cycle(phase,.43,.60);
  const hip=[0,.868+.072*raise,-.189];
  const pose=body(hip,1.428);
  pose.planted={};
  const pads=[];
  for(const [side,sign] of sides){
    const toe=[sign*.176,.154,.220];
    const ankle=[sign*.163,.133+.076*raise,.094-.012*raise];
    foot(pose,side,sign,ankle,pole(sign),add(toe,scale(ankle,-1)));
    pads.push(add(hip,[sign*.114,.129,.004]));
  }
  grips(pose,[[.259,.873,.741],[-.259,.873,.741]]);
  return handles(pose,pads,[0,1.140,.544]);
}

const jobs=[
  ['5349','hip-out',hipLever,{kind:'out-raise'},['l:glute']],
  ['1034','hip-out',hipLever,{kind:'out'},['l:glute']],
  ['1035','hip-in',hipLever,{kind:'in'},['l:adductor']],
  ['1036','hip-front',hipLever,{kind:'front'},['l:quad']],
  ['1031','hip-rear',hipLever,{kind:'extension'},['l:glute','l:hamstring']],
  ['1037','hip-rear',hipLever,{kind:'rear'},['l:glute','l:hamstring']],
  ['6601','hip-foot',hipLever,{kind:'footpress'},['l:glute','l:hamstring']],
  ['2748','kneeling-rear',kneelingPress,{kind:'reverse'},['l:glute','l:hamstring']],
  ['2747','kneeling-in',kneelingPress,{kind:'adduction'},['adductor','glute']],
  ['10113','squat-hold',abductionHold,{},['glute','quad']],
  ['11567','prone-curl-hyper',curlHyper,{},['hamstring','glute']],
  ['0938','stepper',stepper,{},['quad','glute','calf']],
  ['9509','seated-toe',toeRaise,{},['shin']],
  ['1253','donkey',donkeyCalf,{},['calf']],
];

const [folder,...ids]=process.argv.slice(2);
if(!folder)throw new Error('Pass an output folder and optional exact lower-machine IDs.');
const selected=ids.length?jobs.filter(([id])=>ids.includes(id)):jobs;
if(ids.length&&selected.length!==ids.length)throw new Error('Unknown or duplicate lower-machine ID.');
const root=resolve(folder);
await mkdir(root,{recursive:true});
const items=[];
const failures=[];
for(const [id,rig,movement,options,muscles] of selected){
  const prone=movement===curlHyper;
  const kneeling=movement===kneelingPress;
  const low=movement===toeRaise;
  const yaw=options.kind==='front'?-57:options.kind==='in'?-40:
    options.kind==='out'||options.kind==='out-raise'?-14:low?-38:prone?67:kneeling?58:67;
  const camera={yaw,elevation:low?22:14,height:prone?1.74:low?1.89:2.20,
    focus:[0,prone?.53:low?.73:kneeling?.77:.91,prone?.01:.10]};
  const data={version:1,durationMs:prone?6300:5200,equipment:'lever-press-station-special-leg-'+rig,muscles,camera,
    keyframes:Array.from({length:61},(_,index)=>({at:index/60,...movement(index/60,options)}))};
  try{
    prepareRecipe(data);
    const recipe=id+'.json';
    await writeFile(resolve(root,recipe),JSON.stringify(data)+'\n');
    items.push({id,recipe,posterAt:prone?.76:.47});
  }catch(error){
    failures.push({id,reason:error.message});
  }
}
await writeFile(resolve(root,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if(failures.length)process.exitCode=1;
