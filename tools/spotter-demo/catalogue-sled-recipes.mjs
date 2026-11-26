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

const specifications = [
  ['0760',press,{smith:true},'sled-smith',64], ['2611',press,{single:true,horizontal:true},'sled-horizontal',78],
  ['1425',press,{single:true},'sled-press',66],['0738',press,{calves:true},'sled-press',77],
  ['1464',press,{},'sled-press',145],['1463',press,{},'sled-press',83],
  ['0740',press,{wide:true},'sled-press',54],['0741',squat,{narrow:true},'sled-hack',52],
  ['0742',squat,{calves:true},'sled-standing-calf',68],['0743',squat,{},'sled-hack',63],
  ['0744',press,{lying:true},'sled-press-lying',76],['1392',press,{single:true,calves:true},'sled-press',62],
];
const [folder,...ids] = process.argv.slice(2);
if (!folder) throw new Error('Pass an output directory.');
const output = resolve(folder);
await mkdir(output,{recursive:true});
const items = [];
for (const [id,move,option,equipment,yaw] of specifications) {
  if(ids.length&&!ids.includes(id))continue;
  const data = {
    version:1,durationMs:option.single ? 5800 : 4100,equipment,
    muscles:option.calves ? ['calf'] : ['quad','glute'],
    camera:{yaw,elevation:17,focus:[0,equipment === 'sled-press-lying' ? .64 : .90,0],height:option.smith?2.58:2.18},
    keyframes:Array.from({length:61},(_,i)=>({at:i/60,...move(i/60,option)})),
  };
  prepareRecipe(data);
  const recipe = id + '.json';
  await writeFile(resolve(output,recipe),JSON.stringify(data) + '\n');
  items.push({id,recipe,posterAt:option.single ? .25 : .46});
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2) + '\n');
