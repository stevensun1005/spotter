import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides = [['l', 1], ['r', -1]];
const plus = (a,b) => a.map((value,index) => value + b[index]);
const minus = (a,b) => a.map((value,index) => value - b[index]);
const scale = (a,k) => a.map(value => value * k);
const dot = (a,b) => a.reduce((sum,value,index) => sum + value * b[index],0);
const unit = (a) => scale(a,1 / (Math.hypot(...a) || 1));
const stride = Math.SQRT1_2;
const rep = (index) => (1 - Math.cos(index * 2 * Math.PI)) / 2;
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(value)=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
const ramp=(time,start,end)=>smooth((time-start)/(end-start));

function solve(root, target, reference, a, b) {
  const offset = minus(target,root);
  const distance = Math.min(a + b - .004, Math.max(Math.abs(a - b) + .004, Math.hypot(...offset)));
  const axis = unit(offset);
  const reach = (distance * distance + a * a - b * b) / (2 * distance);
  const pole = unit(minus(reference,scale(axis,dot(axis,reference))));
  return [plus(root,plus(scale(axis,reach),scale(pole,Math.sqrt(a * a - reach * reach)))),plus(root,scale(axis,distance))];
}
function torso(hips, lean) {
  const axis = [0,Math.cos(lean),Math.sin(lean)];
  const point = (height,x = 0) => plus(hips,plus(scale(axis,height),[x,0,0]));
  return {hips,chest:point(.369),neck:point(.607),head:point(.733),ls:point(.500,.185),rs:point(.500,-.185),
    lh:point(0,.100),rh:point(0,-.100),planted:{}};
}
function grip(pose, side, sign, point, axis) {
  [pose[side + 'e'],pose[side + 'w']] = solve(pose[side + 's'],point,[sign * .60,-.70,-.14],.255,.356);
  pose[side + 'Grip'] = axis;
}
function foot(pose, side, sign, ankle, toe, floor) {
  [pose[side + 'k'],pose[side + 'a']] = solve(pose[side + 'h'],ankle,[sign * .26,.58,.84],.422,.422);
  pose[side + 't'] = plus(pose[side + 'a'],toe);
  if (floor) pose.planted[side] = floor;
}
function press(phase, {single, calves, lying, wide, smith, horizontal}) {
  const left = phase < .5;
  const position = rep(single ? (phase * 2) % 1 : phase);
  const travel = calves ? .275 + .058 * position : lying ? .268 * position : smith||horizontal ? .160 * position : .365 * position;
  const pose = torso([0,lying ? .262 : .424,smith||horizontal?-.098:-.23], lying ? -1.51 : smith||horizontal?-.69:-.99);
  pose.machineTravel = travel;
  for (const [side,sign] of sides) {
    grip(pose,side,sign,[sign * .29,lying ? .267 : .462,-.253],[0,0,1]);
    if (single && (sign > 0) !== left) {
      const rest = calves ? [sign*.169,.795,.109] : horizontal ? [sign*.242,.209,.411] : [sign*.451,.076,.043];
      foot(pose,side,sign,rest,[0,-.070,.145],null);
      continue;
    }
    const normal = lying ? [0,1,0] : horizontal ? [0,0,1] : smith ? [0,.72,.69] : [0,stride,stride];
    const along = lying ? [0,0,-1] : horizontal ? [0,1,0] : [0,stride,-stride];
    const middle = lying ? [0,.49,.44] : smith ? [0,.535,.512] : horizontal ? [0,.515,.542] : [0,.604,.182];
    const x = single ? sign * .106 : wide ? sign * .280 : sign * .166;
    const contact = plus(middle,plus(scale(normal,travel),[x,0,0]));
    const toe = plus(contact,scale(along,calves ? -.168 : .053));
    const heel = plus(toe,plus(scale(along,-.145 * (1 - .31 * position * Boolean(calves))),scale(normal,-.073 - .108 * position * Boolean(calves))));
    foot(pose,side,sign,heel,minus(toe,heel));
  }
  return pose;
}
function squat(phase,{narrow,calves}) {
  const movement = rep(phase);
  const travel = calves ? .065 * movement : .503 * (1 - movement);
  const pose = torso([0,calves ? .833 + travel * stride : .526 + travel * stride,
    calves ? .10 + travel * stride : -.153 - travel * stride],calves ? .322 : -.27);
  pose.machineTravel = travel;
  for (const [side,sign] of sides) {
    grip(pose,side,sign,[sign * .26,calves ? 1.453 + travel * stride : 1.207 + travel * stride,
      calves ? .176 + travel * stride : -.276 - travel * stride],[0,1,0]);
    const x = sign * (narrow ? .094 : .184);
    const height = calves ? .063 * movement : 0;
    foot(pose,side,sign,[x,.207 + height,.228 + .073 * height],[sign * .015,-.073 - height,.156],.134);
  }
  return pose;
}

function exactPress(phase,{kind='standard',bend=91,width=.166,feetHeight=.055,toesOut=0}) {
  const unilateral=kind==='one'||kind==='one-lying'||kind==='side';
  const negative=kind==='negative';
  const calves=kind==='calf'||kind==='calf-lying';
  const lying=kind==='vertical'||kind==='calf-lying'||kind==='one-lying';
  const side=kind==='side';
  const time=negative?(phase*2)%1:phase;
  const sideDown=phase<.5?1:-1;
  const descent=negative?ramp(time,.09,.73)*(1-ramp(time,.74,.94)):rep(phase);
  const release=negative?ramp(time,0,.12)*(1-ramp(time,.70,.84)):0;
  const calfPosition=rep(phase);
  const hips=lying?[0,.267,-.051]:side?[.019,.467,-.213]:[0,.426,-.218];
  const pitch=lying?-1.535:-.990;
  const pose=torso(hips,pitch);
  if(side){
    const tilt=1.07;
    const torsion=[0,Math.cos(pitch),Math.sin(pitch)];
    const from=[Math.cos(tilt),-Math.sin(pitch)*Math.sin(tilt),Math.cos(pitch)*Math.sin(tilt)];
    for(const [side,sign] of sides){
      pose[side+'s']=plus(plus(hips,scale(torsion,.500)),scale(from,sign*.185));
      pose[side+'h']=plus(hips,scale(from,sign*.100));
    }
    pose.head=plus(pose.head,[.043,.008,-.018]);
  }
  const normal=lying?[0,1,0]:[0,stride,stride];
  const along=lying?[0,0,-1]:[0,stride,-stride];
  const plate=lying?[0,.490,.440]:[0,.604,.182];
  const flex=calves?mix(.94,.45,calfPosition):.628;
  const sole=plus(scale(along,-.149*Math.cos(flex)),scale(normal,-.149*Math.sin(flex)));
  const fore=plus(plus(plate,scale(along,calves?lying?-.105:-.168:feetHeight)),scale(normal,-.015));
  const foreX=unilateral?side?.083:.063:width;
  const baseline=plus(plus(fore,[foreX+toesOut,0,0]),sole);
  const distance=minus(baseline,pose.lh);
  const projected=dot(distance,normal);
  const kneeAngle=(calves?164:mix(160,bend,descent))*Math.PI/180;
  const targetSquared=2*.422**2*(1-Math.cos(kneeAngle));
  const travel=Math.max(0,Math.sqrt(Math.max(0,targetSquared-dot(distance,distance)+projected**2))-projected);
  pose.machineTravel=travel;
  const bar=plus(fore,scale(normal,travel));
  for(const [limb,sign] of sides){
    const handle=[sign*(side?.244:.290),lying?.269:.460,side?-.211:-.253];
    grip(pose,limb,sign,handle,[0,0,1]);
    const rest=unilateral&&sign<0;
    const footX=unilateral?side?.083:.063:sign*width;
    const toe=plus(bar,[footX+sign*toesOut,0,0]);
    const platformHeel=plus(toe,sole);
    const spare=lying?[sign*.316,.329,.307]:side?[-.241,.471,.257]:[sign*.447,.081,.152];
    const drop=negative&&sign!==sideDown?release:rest?1:0;
    const ankle=platformHeel.map((value,index)=>mix(value,spare[index],drop));
    const rotated=minus(toe,platformHeel).map((value,index)=>mix(value,[sign*.013,-.062,.152][index],drop));
    foot(pose,limb,sign,ankle,rotated,null);
  }
  return pose;
}

const specifications = [
  ['0760',press,{smith:true},'sled-smith',64], ['2611',press,{single:true,horizontal:true},'sled-horizontal',78],
  ['1425',press,{single:true},'sled-press',66],['0738',press,{calves:true},'sled-press',77],
  ['1464',press,{},'sled-press',145],['1463',press,{},'sled-press',83],
  ['0740',press,{wide:true},'sled-press',54],['0741',squat,{narrow:true},'sled-hack',52],
  ['0742',squat,{calves:true},'sled-standing-calf',68],['0743',squat,{},'sled-hack',63],
  ['0744',press,{lying:true},'sled-press-lying',76],['1392',press,{single:true,calves:true},'sled-press',62],
  ['2224',exactPress,{bend:91},'sled-press',82],
  ['3616',exactPress,{bend:91,width:.079,feetHeight:.039},'sled-press',76],
  ['3617',exactPress,{bend:86,width:.277,toesOut:.047},'sled-press',67],
  ['1575',exactPress,{bend:78,width:.064,feetHeight:.068},'sled-press',72],
  ['10198',exactPress,{kind:'negative',bend:94},'sled-press',69],
  ['6734',exactPress,{kind:'one',bend:81},'sled-press',77],
  ['1391',exactPress,{kind:'calf'},'sled-press',70],
  ['7593',exactPress,{bend:91,width:.265,feetHeight:.175,toesOut:.031},'sled-press',60],
  ['2334',exactPress,{kind:'calf-lying'},'sled-press-lying',68],
  ['10764',exactPress,{kind:'one-lying',bend:89},'sled-press-lying',76],
  ['8660',exactPress,{kind:'side',bend:82},'sled-press',105],
  ['4327',exactPress,{kind:'vertical',bend:76,feetHeight:.124},'sled-press-lying',81],
];
const [folder,...ids] = process.argv.slice(2);
if (!folder) throw new Error('Pass an output directory.');
const output = resolve(folder);
await mkdir(output,{recursive:true});
const items = [];
for (const [id,move,option,equipment,yaw] of specifications) {
  if(ids.length&&!ids.includes(id))continue;
  const data = {
    version:1,durationMs:option.kind==='negative'?6450:option.single?5800:4100,
    equipment:move===exactPress?equipment+'-contact':equipment,
    muscles:option.calves||option.kind?.startsWith('calf')?['calf']:
      option.kind?.startsWith('one')||option.kind==='side'?['l:quad','l:glute']:['quad','glute'],
    camera:{yaw,elevation:17,focus:[0,equipment === 'sled-press-lying' ? .64 : .90,0],height:option.smith?2.58:2.18},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...move(i/60,option)})),
  };
  prepareRecipe(data);
  const recipe = id + '.json';
  await writeFile(resolve(output,recipe),JSON.stringify(data) + '\n');
  items.push({id,recipe,posterAt:option.single ? .25 : .46});
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2) + '\n');
