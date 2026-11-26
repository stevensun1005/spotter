import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';

const sides = [['l',1],['r',-1]];
const add = (a,b) => a.map((n,i)=>n + b[i]);
const scale = (a,k) => a.map(n=>n * k);
const minus = (a,b) => add(a,scale(b,-1));
const dot = (a,b) => a.reduce((sum,n,i)=>sum + n * b[i],0);
const unit = (a) => scale(a,1 / (Math.hypot(...a) || 1));
const mix = (a,b,t) => a.map((n,i)=>n + (b[i] - n) * t);
const rep = (t) => (1 - Math.cos(t * 2 * Math.PI)) / 2;
const clamp = (v) => Math.min(1,Math.max(0,v));
const soft = (v) => { const q = clamp(v); return q * q * (3 - 2 * q); };

function limb(root,target,guide,a,b) {
  const delta = minus(target,root);
  const reach = Math.max(Math.abs(a-b)+.004, Math.min(a+b-.004,Math.hypot(...delta)));
  const axis = unit(delta);
  const along = (a*a - b*b + reach*reach)/(2*reach);
  const bend = unit(minus(guide,scale(axis,dot(axis,guide))));
  return [add(root,add(scale(axis,along),scale(bend,Math.sqrt(a*a-along*along)))),add(root,scale(axis,reach))];
}
function body(hips,pitch = 0,yaw = 0) {
  const side = [Math.cos(yaw),0,-Math.sin(yaw)];
  const front = [Math.sin(yaw),0,Math.cos(yaw)];
  const up = [front[0]*Math.sin(pitch),Math.cos(pitch),front[2]*Math.sin(pitch)];
  const at = (height,x = 0) => add(hips,add(scale(up,height),scale(side,x)));
  return {hips,chest:at(.37),neck:at(.605),head:at(.728),ls:at(.502,.19),rs:at(.502,-.19),
    lh:add(hips,[.104,0,0]),rh:add(hips,[-.104,0,0]),planted:{}};
}
function foot(p,side,sign,target,ground = 0,heel = 0) {
  [p[side+'k'],p[side+'a']] = limb(p[side+'h'],target,[sign*.16,.01,1],.422,.424);
  p[side+'t'] = add(p[side+'a'],[sign*.015,-.072-heel,.147]);
  if (ground != null) p.planted[side] = ground;
}
function arm(p,side,target,pole,grip) {
  [p[side+'e'],p[side+'w']] = limb(p[side+'s'],target,pole,.252,.371);
  if (grip) p[side+'Grip'] = grip;
}
function floorPath(p) {
  p.bandPath = [p.lw,add(p.la,[0,-.073,.105]),add(p.ra,[0,-.073,.105]),p.rw];
}
function thighOrAnkleLoop(p,joint,radius) {
  const l = joint === 'a' ? p.la : mix(p.lk,p.lh,.14);
  const r = joint === 'a' ? p.ra : mix(p.rk,p.rh,.14);
  const plane = joint === 'a' ? [0,0,1] : [0,-.63,.78];
  const flank = [radius,0,0];
  const bulge = scale(plane,radius);
  const points = [add(l,bulge),add(l,flank),minus(l,bulge),minus(r,bulge),
    minus(r,flank),add(r,bulge),add(l,bulge)];
  return points;
}

function kneesOut(phase,{walk,standing,stance}) {
  const v = rep(phase);
  const left = soft((phase-.035)/.168) - soft((phase-.74)/.195);
  const right = soft((phase-.26)/.168) - soft((phase-.51)/.17);
  const shift = walk ? .365 * (left+right)/2 : standing ? -.064 : 0;
  const hips = [shift,walk ? .739 : standing ? .866 : .502,walk ? -.118 : 0];
  const p = body(hips,walk ? .230 : standing ? .022 : .042);
  for (const [side,sign] of sides) {
    const swing = (a,b) => Math.sin(Math.PI * clamp((phase-a)/(b-a)));
    const lift = sign>0 ? swing(.035,.203)+swing(.74,.935) : swing(.26,.428)+swing(.51,.68);
    const fixed = [.133 * sign,.075,stance === 'open' ? .519 : .465];
    const walkTarget = [sign*.147 + .365 * (sign>0?left:right),.075+.079*lift,.035];
    const support = standing && sign > 0 ? [.117+.527*v,.075+.216*v,.046] : [sign*.155,.075,.054];
    foot(p,side,sign,walk ? walkTarget : standing ? support : fixed,(standing && sign > 0 && v > .003) || (walk && lift>.025) ? null : 0);
    if (!standing && !walk) {
      const delta = sign * (.058 + (stance === 'open' ? .154 : .128) * v);
      const target = add(p[side+'a'],[delta*.18,0,0]);
      [p[side+'k'],p[side+'a']] = limb(p[side+'h'],target,[sign * (.13+1.08*v), .83, .41],.422,.424);
      p[side+'t'] = add(p[side+'a'],[sign*.020,-.072,.145]);
    }
    arm(p,side,walk ? [shift+sign*.140,1.007,.235] : standing ? [sign*.236,.907,.086] : [sign*.257,.466,.005],[sign*.6,-.9,-.16]);
  }
  p.bandPath = thighOrAnkleLoop(p,standing?'a':'k',standing?.051:.073);
  return p;
}

function lifts(phase,option) {
  const {mode,seated,alternate,one,depth=.84}=option;
  const base = rep(phase);
  const hinge = mode === 'deadlift' ? base : 0;
  const transfer = mode === 'calf' ? .070*base : 0;
  const p = body([0,seated?.502:.877-.076*hinge+transfer,-.169*hinge],seated&&one?.46:depth*hinge);
  for (const [side,sign] of sides) {
    const active = alternate ? (phase<.5)===(sign>0) : !one || sign>0;
    const v = !active ? 0 : alternate ? rep((phase*2)%1) : base;
    const raised = mode === 'calf' && (active || !one) ? .070*base : 0;
    foot(p,side,sign,[sign*(seated&&one?.294:.160),.075+raised,seated?.452:.061],0,raised);
    const s = p[side+'s'];
    let target;
    let pole=[sign*.20,-.72,-.16];
    let axis=[sign,0,0];
    if (mode === 'curl' || mode === 'wrist') {
      const elbow = seated&&one ? [sign*.23,.560,.352] : mode === 'wrist' ? [sign*.16,.560,.225] : add(s,[sign*.043,-.247,.015]);
      const direction = mode === 'wrist' ? [sign*.008,.115*v,.352] : [sign*.014,-.364*Math.cos(2.44*v),.066+.218*Math.sin(2.44*v)];
      const wrist = add(elbow,scale(unit(direction),.371));
      if (mode === 'wrist' || (seated&&one)) {
        p[side+'e'] = add(s,scale(unit(minus(elbow,s)),.252));
        p[side+'w'] = add(p[side+'e'],scale(unit(direction),.371));
        p[side+'Grip'] = [mode==='wrist'?sign:-sign,0,0];
      } else arm(p,side,wrist,[0,-.93,-.24],[-sign,0,0]);
      continue;
    }
    if (mode === 'raise') {
      const sweep = option.y ? 2.52*v : 1.56*v;
      const d = unit([sign*(.048+(option.y?.68:.07)*Math.sin(sweep)),-Math.cos(sweep),Math.sin(sweep)*(option.y?.37:1)]);
      target = add(s,scale(d,.610));
      axis = option.y ? [0,0,1] : [sign,0,0];
    } else if (mode === 'shoulder') {
      target = [sign*(.292-.046*v),s[1]+.028+.603*v,.138-.035*v];
      pole=[sign*.75,-.76,-.03];
    } else if (mode === 'deadlift') {
      target=[sign*.198,s[1]-.599,.095+.118*hinge];
      pole=[sign*.54,-.27,-.65];
    } else if (mode === 'shrug') {
      p[side+'s'] = add(s,[0,.083*v,0]);
      target=add(p[side+'s'],[sign*.039,-.607,.085]);
    } else {
      target=add(s,[sign*.037,-.581,.131]);
    }
    arm(p,side,target,pole,axis);
  }
  floorPath(p);
  if (one && mode === 'curl') p.bandPath = [p.lw,add(p.la,[0,-.071,.084])];
  if (one && mode === 'calf') p.bandPath = [p.lw,add(p.la,[0,-.071-transfer,.115])];
  return p;
}
function anchored(phase,{mode,grip,seated,kneeling,one,fixed}) {
  const v = rep(phase), rightLead = one ? phase < .5 : false;
  const amount = one ? rep((2*phase)%1) : v;
  const turn = mode === 'press' ? .48*amount : mode === 'row' && seated ? -.37*amount : 0;
  const p = body([0,kneeling?.464:seated?.502:.877,0],mode==='pullThrough'?.80*amount:kneeling?.095:fixed?0:.020,turn);
  for (const [side,sign] of sides) {
    if (kneeling) {
      p[side+'k'] = [sign*.127,.073,.270];
      p[side+'a'] = [sign*.134,.093,-.143];
      p[side+'t'] = [sign*.144,.017,-.258];
    } else {
      foot(p,side,sign,[sign*.176,.075,seated?.487:mode==='press'?sign*.192:.054]);
    }
    const active = !one || rightLead===(sign<0);
    const span = grip === 'underhand' ? fixed?.171:.215 : grip?.startsWith('close') ? .092 : .244;
    const s = p[side+'s'];
    let location;
    if (mode==='row') location = [sign*.208,s[1]-.228,.596-.510*amount];
    else if (mode==='press') location = [sign*(.247-.109*amount),s[1]-.118,.115+.448*amount];
    else if (mode==='pullThrough') location = [sign*.069,s[1]-.583,.192-.410*amount];
    else location = [sign*span,s[1]+.536-.607*amount,.166+.095*(1-amount)];
    if (!active) location = add(s,[sign*.034,-.552,.115]);
    arm(p,side,location,[sign*.66,-.84,-.10],grip?.endsWith('underhand')?[-sign,0,0]:[sign,0,0]);
  }
  const anchor = mode==='row' ? [0,seated?.291:.450,1.0] : mode==='press' ? [0,seated?.865:1.17,-.88]
    : mode==='pullThrough' ? [0,.177,-.82] : [0,1.92,.518];
  p.bandPath = mode === 'pullThrough' ? [p.lw,anchor,p.rw] : one ?
    [rightLead?p.rw:p.lw,anchor,rightLead?p.rw:p.lw] : [p.lw,anchor,p.rw];
  return p;
}

function floorCore(phase,{mode}) {
  const local=mode==='alternate' ? (phase*2)%1 : mode==='jackknife' ? Math.pow(phase,1.11) : phase;
  const v=rep(local);
  const left=phase<.5;
  const twist = mode==='bike' ? .40*Math.cos(phase*4*Math.PI) : 0;
  const back=mode==='raise' ? -Math.PI/2 : mode==='bike' ? -1.29 : -1.56 + (mode==='push'?1.15:1.12)*v;
  const p=body([0,mode==='bench'?.575:.141,mode==='bench'?1.267:.030],mode==='bench'?-Math.PI/2:back,twist);
  for (const [side,sign] of sides) {
    const active=left===(sign>0);
    if(mode==='bench') foot(p,side,sign,[.10+sign*.223,.076,1.35],0);
    else if(mode==='push'||(mode==='alternate'&&!active)) foot(p,side,sign,[sign*.167,.075,.637],0);
    else {
      const cycling=mode==='bike';
      const theta = cycling ? (sign>0?phase:phase+.25)*4*Math.PI : 1.43*v;
      const forward = cycling ? .660 + .175*Math.cos(theta) : (.831-(mode==='jackknife'?.192*v:0))*Math.cos(theta);
      const lift = cycling ? .35-.15*Math.cos(theta) : .079+.828*Math.sin(theta);
      foot(p,side,sign,[sign*.120,lift,forward],cycling||v>.003?null:0);
    }
    const s=p[side+'s'];
    const target=mode==='bench'?[.10+sign*.276,.726+.437*v,.863-.093*v]
      :mode==='bike'?add(p.head,[sign*.145,-.034,-.043])
      :mode==='raise'?[sign*.125,.332,.372]
      :mode==='push'?[sign*.152,.688+.199*v,-.435+.758*v]
      :add(s,[sign*.116,.074+.271*v,-.568+.91*v]);
    arm(p,side,target,[sign*.39,.05,.84],[sign,0,0]);
  }
  if(mode==='bench') p.bandPath=[p.lw,[.368,.327,.865],[-.168,.327,.865],p.rw];
  else if(mode==='push') p.bandPath=[p.lw,[0,.159,-1.28],p.rw];
  else if(mode==='bike') p.bandPath=thighOrAnkleLoop(p,'a',.048);
  else {
    const l=add(p.la,[0,-.015,.105]), r=add(p.ra,[0,-.015,.105]);
    const switchLeg = phase < .50 ? 1-soft((phase-.45)/.05) : soft((phase-.95)/.05);
    p.bandPath=mode==='alternate'?[p.lw,mix(r,l,switchLeg),p.rw]:[p.lw,l,r,p.rw];
  }
  return p;
}
function standingCore(phase,{mode}) {
  const isTurn=mode.includes('twist');
  const local=isTurn?(phase*2)%1:phase;
  const v=rep(local);
  const sideSign=phase<.5?1:-1;
  const knee=mode==='kneel-twist';
  const p=body([0,knee?.481:.878,0],mode==='extension'?.016:.735*v,isTurn?.56*v*sideSign:0);
  for(const [side,sign] of sides) {
    if(knee) {
      p[side+'k']=[sign*.133,.077,.212];
      p[side+'a']=[sign*.137,.071,-.210];
      p[side+'t']=[sign*.151,.009,-.336];
    } else foot(p,side,sign,[sign*.172,.075,.061],0);
    const s = p[side+'s'];
    if(mode==='extension') {
      p[side+'e']=add(s,[sign*.246,-.023,.031]);
      p[side+'w']=add(p[side+'e'],scale(unit([sign*(-.70+1.69*v),.045,.715*(1-v)]),.371));
      p[side+'Grip']=[0,0,1];
    } else {
      const point=knee?add(s,[sign*.094,-.161-.196*v,.140+.168*v])
        :add(p.head,[sign*.171,-.145-.116*v,.109+.147*v]);
      arm(p,side,point,[sign*.83,-.52,.05],[sign,0,0]);
    }
  }
  p.bandPath=mode==='extension'?[p.lw,p.rw]:[p.lw,knee?[0,.95,-.83]:[0,2.02,-.63],p.rw];
  return p;
}
function bandSplit(phase) {
  const shift=soft(phase/.23)*soft((1-phase)/.22);
  const depth=rep(phase);
  const p=body([0,.871-depth*.323,.126*shift],.060+.158*depth);
  for(const [side,sign] of sides) {
    const landing=[sign*.153,.075+(sign<0?.089*shift:0)+.065*Math.sin(shift*Math.PI),.075+sign*.379*shift];
    foot(p,side,sign,landing,shift>.995||shift<.002?0:null,sign<0?.089*shift:0);
    arm(p,side,add(p[side+'s'],[sign*.062,-.462,.181]),[sign*.59,-.55,-.16]);
  }
  p.bandPath=thighOrAnkleLoop(p,'a',.061);
  return p;
}
function closePush(phase) {
  const v=rep(phase);
  const p=body([0,.512-.276*v,-.421],1.20+.249*v);
  for(const [side,sign] of sides) {
    foot(p,side,sign,[sign*.143,.126,-1.184],0,.047);
    arm(p,side,[sign*.122,.081,.209],[sign*.162,.321,-.94]);
  }
  const centers=sides.map(([side])=>mix(p[side+'e'],p[side+'s'],.21));
  const [l,r]=centers;
  p.bandPath=[add(l,[0,.054,0]),add(l,[.063,0,0]),add(l,[0,-.056,0]),add(r,[0,-.056,0]),
    add(r,[-.063,0,0]),add(r,[0,.054,0]),add(l,[0,.054,0])];
  return p;
}

const groups = [
  [floorCore,['core'],[
    ['0969',{mode:'alternate'},'mat-stretch-band'],['0972',{mode:'bike'},'mat-stretch-band'],
    ['0981',{mode:'jackknife'},'mat-stretch-band'],['1014',{mode:'v-up'},'mat-stretch-band'],
    ['1002',{mode:'raise'},'mat-stretch-band'],['0992',{mode:'push'},'post-stretch-band'],
    ['1254',{mode:'bench'},'bench-stretch-band',['pec','triceps']],
  ]],
  [standingCore,['core'],[
    ['0985',{mode:'kneel-twist'},'post-stretch-band'],
    ['1005',{mode:'crunch'},'high-stretch-band'],['1007',{mode:'twist-crunch'},'high-stretch-band'],
    ['0998',{mode:'extension'},'stretch-band',['triceps']],
  ]],
  [bandSplit,['quad','glute'],[['1001',{},'stretch-band']]],
  [closePush,['pec','triceps'],[['0975',{},'stretch-band']]],

  [kneesOut,['glute'],[
    ['6607',{walk:true},'stretch-band'],['3853',{standing:true},'stretch-band'],
    ['6785',{stance:'open'},'seat-stretch-band'],['3006',{},'seat-stretch-band'],['0996',{stance:'open'},'seat-stretch-band'],
  ]],
  [lifts,null,[
    ['0968',{mode:'curl',alternate:true},'stretch-band',['biceps']],
    ['0976',{mode:'curl',seated:true,one:true},'seat-stretch-band',['biceps']],
    ['3123',{mode:'curl',seated:true},'seat-stretch-band',['biceps']],
    ['0994',{mode:'wrist',seated:true},'seat-stretch-band',['forearm']],
    ['0977',{mode:'raise'},'stretch-band',['shoulder']],['0978',{mode:'raise'},'stretch-band',['shoulder']],
    ['1017',{mode:'raise',y:true},'stretch-band',['shoulder','trap']],
    ['1018',{mode:'shrug'},'stretch-band',['trap']],
    ['1009',{mode:'deadlift',depth:.98},'stretch-band',['hamstring','glute']],
    ['1023',{mode:'deadlift',depth:.80},'stretch-band',['hamstring','glute']],
    ['1010',{mode:'deadlift',depth:.88},'stretch-band',['hamstring','glute']],
    ['1369',{mode:'calf'},'stretch-band',['calf']],['0999',{mode:'calf',one:true},'stretch-band',['l:calf']],
    ['0698',{mode:'shoulder'},'stretch-band',['shoulder','triceps']],
  ]],
  [anchored,null,[
    ['0974',{mode:'pulldown',grip:'close-underhand'},'high-stretch-band',['lat']],
    ['3117',{mode:'pulldown',grip:'close',seated:true},'high-seat-stretch-band',['lat']],
    ['3116',{mode:'pulldown',grip:'underhand',fixed:true},'high-stretch-band',['lat','biceps']],
    ['1013',{mode:'pulldown',grip:'underhand'},'high-stretch-band',['lat','biceps']],
    ['0983',{mode:'pulldown',kneeling:true,one:true},'high-stretch-band',['lat']],
    ['0988',{mode:'row',one:true},'post-stretch-band',['lat']],
    ['0990',{mode:'row',seated:true,one:true},'post-seat-stretch-band',['lat','core']],
    ['0989',{mode:'press',one:true},'post-stretch-band',['pec','core']],
    ['3124',{mode:'press',seated:true},'post-seat-stretch-band',['pec','triceps']],
    ['0991',{mode:'pullThrough'},'post-stretch-band',['glute','hamstring']],
  ]],
];

const [directory,...ids] = process.argv.slice(2);
if (!directory) throw new Error('Pass an output directory.');
const output = resolve(directory);
await mkdir(output,{recursive:true});
const items = [];
const failures = [];
for (const [motion,muscles,rows] of groups) {
  for (const [id,options,equipment,targets] of rows) {
    if(ids.length&&!ids.includes(id))continue;
    const ground = motion === floorCore || motion === closePush;
    const bench = options.mode === 'bench';
    const data = {
      version:1,durationMs:options.one||options.alternate?5500:3950,equipment,
      muscles:targets??muscles,
      camera:{yaw:57,elevation:17,focus:[0,ground ? bench?.58:.47 : options.seated||motion === kneesOut && !options.standing && !options.walk ? .67:.96,bench?.94:ground?-.13:0],
        height:equipment.startsWith('high-')?2.43:ground?1.78:options.seated?1.86:2.19},
      keyframes:Array.from({length:61},(_,i)=>({at:i/60,...motion(i/60,options)})),
    };
    try {
      prepareRecipe(data);
      const recipe = id+'.json';
      await writeFile(resolve(output,recipe),JSON.stringify(data)+'\n');
      items.push({id,recipe,posterAt:options.one||options.alternate ? .25:.5});
    } catch(error) { failures.push({id,error:error.message}); }
  }
}
await writeFile(resolve(output,'batch.json'),JSON.stringify({kind:'catalogue',items},null,2)+'\n');
console.log(JSON.stringify({prepared:items.length,failures},null,2));
if (failures.length) process.exitCode = 1;
