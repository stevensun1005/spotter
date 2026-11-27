import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareRecipe } from '../../skills/spotter-exercise-demo/lib/recipe.js';
import { add, arm, blend, grip, leg, legAngles, mix, ramp, rep, sides, stand } from './bodyweight/pose.mjs';

const rows=[];
const floor=.079;
const nearSide={yaw:62,elevation:15,focus:[0,.75,.30],height:2.19};
const floorView={yaw:58,elevation:21,focus:[0,.63,.08],height:2.12};
const standView={yaw:63,elevation:14,focus:[0,.91,.08],height:2.26};
const smallUp=[0,1,0];
const flatHand=[0,-.034,1];
function family(motion,equipment,muscles,view,variants){
  for(const[id,o]of variants)rows.push({id,motion,o,equipment:o.equipment??equipment,muscles:o.muscles??muscles,view:{...view,...o.view}});
}
function signFor(side){return side==='l'?1:-1;}
function grounded(pose,side,target,surface=0,heel=false){
  const s=signFor(side);
  leg(pose,side,target,[s*.137,.135,1],[s*.013,heel?.027:-.072,.133],surface);
}
function onHead(p,side){
  const s=signFor(side);
  arm(p,side,add(p.head,[s*.115,-.087,.010]),[s*.98,.02,-.061],[0,.42,.902]);
}
function resting(p,side,z,y=.076){
  const s=signFor(side);
  arm(p,side,[s*.273,y,z],[s*.68,-.15,-.39],flatHand,smallUp);
}

function benchDip(phase,{type,stance,comparison=false}){
  const t=rep(phase,.42,.58), end=type==='floor'?.215:.247;
  const three=type==='three', chairs=type==='chairs';
  const elevated=type==='two'||three;
  const stretch=type==='stretch';
  const depth=stance==='long'?.784:type==='floor'?.344:.589;
  const pelvis=chairs?[0,.617-.258*t,-.267]:[0,type==='floor'?.348-.177*t:.496-end*t,
    comparison?.204+.112*t:stretch?.041+.166*t:.062+.028*t];
  const pose=stand(pelvis,chairs?.15+.315*t:stretch?.005+.163*t:comparison?.11+.443*t:.034+.153*t);
  for(const[side,s]of sides){
    if(chairs){
      leg(pose,side,[s*.158,.164-.038*t,-.565],[s*.195,-.83,.41],[s*.013,-.11,-.089]);
    } else if(elevated){
      grounded(pose,side,[s*.141,(three?.423:.459)+floor,.757+(three?-.070:0)],three?.423:.459,true);
    } else grounded(pose,side,[s*.146,floor,depth],0,stance==='long');
    const hand=[s*(chairs?.349:three?.310:.191),chairs?.524:three?.465:.502,
      chairs?-.348:three?-.215:-.131];
    arm(pose,side,hand,[s*(comparison?.83:.077),-.06,-.98],[s*.08,-.16,.98],smallUp);
  }
  return pose;
}

function benchSquat(phase,{kind}){
  const t=rep(phase,kind==='side-jump'?.30:.45,kind==='side-jump'?.48:.56);
  const single=kind==='one';
  const side=kind==='side'||kind==='side-jump';
  const jump=kind==='side-jump'?.222*Math.sin(Math.PI*ramp(phase,.248,.708)):0;
  const transfer=kind==='side-jump'?ramp(phase,.225,.631):0;
  const x=side?(kind==='side-jump'?.598*transfer:.389*t):single?.089:0;
  const h=kind==='side-jump'?.435*transfer:0;
  const depth=kind==='wide'?.475:single?.337:side?.317:.425;
  const pose=stand([x,.865-depth*t+h+jump,.105-.252*t],.063+.53*t);
  for(const[sideName,s]of sides){
    if(single&&sideName==='r'){
      leg(pose,sideName,[-.265,.253+.090*t,.298+.275*t],[s*.065,.9,-.310],[s*.012,.02,.131]);
    }else if(kind==='side-jump'){
      grounded(pose,sideName,[x+s*.143,floor+h+jump,.024],jump>.003?undefined:h);
    }else grounded(pose,sideName,[s*(kind==='wide'?.386:side?.326:.156)+(side&&sideName==='l'?.311:0),floor,.168],0);
    arm(pose,sideName,add(pose[sideName+'s'],[s*.087,-.543+.643*t,.105+.431*t]),[s*.64,-.65,-.05],flatHand,smallUp);
  }
  return pose;
}

function benchHip(phase,{kind}){
  const t=rep(phase);
  const frog=kind==='frog', bench=kind!=='hip';
  const pose=stand(bench?[0,.531,.133]:[0,mix(.164,.455,t),-.03-.023*t],
    bench?1.572:Math.atan2(-.512,.507-mix(.164,.455,t)));
  for(const[side,s]of sides){
    if(bench){
      const thigh=mix(-1.828,-3.10,t);
      if(frog){
        const shin=mix(-2.94,-3.08,t);
        pose[side+'k']=add(pose[side+'h'],[s*.220,.378*Math.sin(thigh),.352*Math.cos(thigh)]);
        pose[side+'a']=add(pose[side+'k'],[-s*.270,.324*Math.sin(shin),.351*Math.cos(shin)]);
        pose[side+'t']=add(pose[side+'a'],[-s*.050,-.043,-.094]);
      }else legAngles(pose,side,s,thigh,thigh-.061,.021);
      grip(pose,side,[s*.213,.469,-.531],[s*.839,-.32,-.301],[0,0,1]);
    }else {
      grounded(pose,side,[s*.162,floor,.619]);
      arm(pose,side,[s*.208,.432,-.515],[s*.76,-.31,-.591],flatHand,smallUp);
    }
  }
  return pose;
}

function benchCurl(phase,{kind}){
  const t=rep(phase,.39,.599);
  const supported=['floor','twist','overhead','chair','bridge','inverted'].includes(kind);
  const benchFace=kind==='circle'||kind==='pull';
  const bridge=kind==='bridge';
  const inv=kind==='inverted';
  const dir=Math.sin(phase*2*Math.PI), roll=kind==='twist'?.263*dir:0;
  const hip=[kind==='circle'?.064*dir*t:0,supported?.148+(bridge?.327*t:inv?.185*t:0):.525+(.142*t*(benchFace?1:0)),
    inv?.356:.046+((bridge||benchFace)?-.097*t:0)];
  const pitch=benchFace?-1.52:(bridge?-Math.acos(Math.max(-.99, (.148-hip[1])/.526)):
    inv?-1.595:mix(-1.557,kind==='overhead'?-.88:kind==='chair'?-1.04:-.96,t));
  const p=stand(hip,pitch,0,roll);
  for(const[side,s]of sides){
    if(inv){
      const angle=mix(.052,1.566,t);
      legAngles(p,side,s,angle,angle-.03,.018);
      grip(p,side,[s*.206,.369,-.320],[s*.75,-.42,-.122],[1,0,0]);
    }else if(supported){
      const cy=kind==='chair'?.477:.459;
      const az=bridge?.854:.998;
      grounded(p,side,[s*(bridge?.053:.136),cy+floor,az],cy,bridge);
      if(bridge)resting(p,side,-.46);
      else if(kind==='overhead')arm(p,side,add(p[side+'s'],[s*.122,.244,-.531]),[s*.83,.03,-.345],[0,.50,-.86]);
      else onHead(p,side);
    }else if(benchFace){
      const angle=mix(-.143,.98,t)+ (kind==='circle'?.180*dir*t:0);
      legAngles(p,side,s,angle,angle-1.135*t,.016);
      grip(p,side,[s*.213,.489,-.739],[s*.84,-.36,.173],[0,0,1]);
    }else{
      grounded(p,side,[s*.132,.432+floor,.098],.432);
      onHead(p,side);
    }
  }
  return p;
}

function chairRow(phase,{kind,under=false,feetHigh=false}){
  const t=rep(phase);
  const high=feetHigh, seated=kind==='seat';
  const bent=kind==='bent'||kind==='chin';
  const bar=[0,high?.888:.497,high?-.597:-.431];
  const y=high?mix(.271,.669,t):seated?mix(.158,.359,t):mix(.139,.371,t);
  const z=high?mix(.199,.013,t):seated?mix(-.246,-.001,t):mix(.102,.179,t);
  const angle=high?mix(-1.57,-1.32,t):seated?mix(-.341,-.61,t):mix(-1.55,-1.39,t);
  const pose=stand([0,y,z],angle);
  for(const[side,s]of sides){
    const fy=high?.477+floor:floor;
    grounded(pose,side,[s*.141,fy,high?.945:bent?.620:seated?.437:.890],high?.477:0,!bent);
    grip(pose,side,[s*(under?.182:.229),bar[1]+.001,bar[2]],[s*(kind==='chin'?.23:.69),-.723,-.198],
      [under?-1:1,0,0]);
    if(under)pose[side+'Fingers']=[0,.89,-.458];
  }
  return pose;
}

function pikePress(phase,{kind}){
  const t=rep(phase);
  const chair=kind==='chairs', decline=kind==='decline'||kind==='feet-bench';
  const hip=[0,.981-.221*t+(decline?.215:0),-.219-.016*t];
  const angle=mix(1.944,2.112,t);
  const pose=stand(hip,angle);
  for(const[side,s]of sides){
    const stack=decline?.561:0;
    leg(pose,side,[s*.154,stack+.115,decline?-.923:-.814],[s*.115,-.70,.24],[s*.013,-.103,.105],stack);
    const surface=chair?.477:.411;
    const w=[s*(chair?.298:.293),surface+.067,chair?.358:.423];
    arm(pose,side,w,[s*.864,-.23,-.451],[s*.07,-.101,1],smallUp);
  }
  return pose;
}

function supportedProne(phase,{kind}){
  const t=rep(phase);
  const kick=kind==='kick', lat=kind==='lat', close=kind==='close';
  const chair=kind==='chair'||close;
  const deck=chair?.477:.459;
  const hip=kick?[0,.759,-.337]:lat?[0,.521-.157*t,-.129-.115*t]:[0,.636-.137*t,-.279];
  const p=stand(hip,lat?mix(.965,1.47,t):kick?1.27:mix(1.251,1.42,t));
  for(const[side,s]of sides){
    const zn=chair?.497:.519;
    if(lat){
      p[side+'k']=[s*.150,.091,-.388];
      p[side+'a']=[s*.164,.071,-.802];
      p[side+'t']=[s*.173,.044,-.921];
      p[side+'e']=[s*.153,deck+.046,zn];
      p[side+'w']=[s*.092,deck+.092,zn+.356];
      p[side+'Fingers']=[0,.05,1];p[side+'PalmSide']=[0,1,0];
    }else{
      if(kick&&side==='r') {
        const thigh=mix(-1.55,-2.89,t);
        legAngles(p,side,s,thigh,thigh-.124,.025);
      } else leg(p,side,[s*.152,floor+.036,-.981],[s*.128,-.78,.211],[s*.012,-.101,.096],0);
      const w=[s*(close?.092:.166),deck+.049,zn];
      arm(p,side,w,[s*(close?.387:.75),-.455,-.65],flatHand,smallUp);
    }
  }
  return p;
}

function romanSide(phase) {
  const t=rep(phase);
  const hips=[0,.865,-.056], angle=mix(.973,1.36,t);
  const p=stand(hips,angle,Math.PI/2,-.66);
  for(const[side,s]of sides){
    leg(p,side,[s*.119,.338,-.555],[s*.085,.61,-.39],[s*.012,-.065,-.112]);
    onHead(p,side);
  }
  return p;
}
function romanHinge(phase,{kind}){
  const t=rep(phase), nordic=kind==='nordic'||kind==='pads';
  const angle=nordic?mix(.025,1.46,t):mix(1.546,2.271,t);
  const p=stand(nordic?[0,.097+.422*Math.cos(angle),-.124+.411*Math.sin(angle)]:[0,.869,.122],angle);
  for(const[side,s]of sides){
    if(nordic){
      p[side+'k']=[s*.151,.082,-.124];
      p[side+'a']=[s*.15,.081,-.548];
      p[side+'t']=[s*.166,.038,-.672];
    }else{
      p[side+'k']=[s*.132,.827,-.314];
      p[side+'a']=[s*.129,.851,-.713];
      p[side+'t']=[s*.135,.785,-.843];
    }
    arm(p,side,add(p.chest,[-s*.087,.012,.128]),[s*.854,-.215,-.331],[s*.68,.05,.31]);
  }
  return p;
}
function captain(phase){
  const t=rep(phase);
  const pose=stand([0,.813,-.101],-.087);
  for(const[side,s]of sides){
    pose[side+'e']=[s*.281,1.217,-.146];
    pose[side+'w']=[s*.281,1.248,.219];
    pose[side+'Grip']=[0,0,1];
    const thigh=mix(-1.55,.15,t);
    legAngles(pose,side,s,thigh,thigh-1.16*t-.03,.017);
  }
  return pose;
}
function sideBenchBridge(phase){
  const t=rep(phase);
  const p=stand([0,.266+.228*t,.039],mix(-1.30,-1.58,t),0,-1.22);
  p.lh=[.011,p.hips[1]+.091,p.hips[2]];
  p.rh=[-.011,p.hips[1]-.091,p.hips[2]];
  p.ls=[.016,p.chest[1]+.193,p.chest[2]-.132];
  p.rs=[-.014,p.chest[1]-.093,p.chest[2]-.138];
  leg(p,'l',[.025,.541,.709],[.07,.80,.129],[.012,-.064,.128]);
  leg(p,'r',[-.036,.401+.060*t,.761],[-.69,.498,.209],[-.012,-.055,.123]);
  p.re=[-.045,.077,p.rs[2]-.031];
  p.rw=[-.361,.061,p.rs[2]-.213];
  p.rFingers=[-1,-.03,-.09];p.rPalmSide=[0,1,0];
  arm(p,'l',add(p.lh,[.131,.126,.032]),[.82,-.36,-.25]);
  return p;
}

family(benchDip,'dip-bench',['triceps','pec'],nearSide,[
  ['2346',{type:'normal',comparison:true,view:{yaw:31,height:2.44,focus:[0,.83,.21]}}],
  ['4352',{type:'floor',view:{yaw:69}}],
  ['4360',{type:'two',equipment:'double-dip-bench',stance:'long',view:{yaw:73,focus:[0,.69,.13]}}],
  ['3387',{type:'chairs',equipment:'gym-dip-chairs',view:{yaw:32}}],
  ['1753',{type:'three',equipment:'gym-triple-dip',view:{yaw:56,focus:[0,.69,.08]}}],
  ['0812',{type:'two',equipment:'double-dip-bench',view:{yaw:61,focus:[0,.69,.10]}}],
  ['1972',{type:'stretch',duration:5810,muscles:['shoulder','pec']}],
]);
family(benchSquat,'gym-bench-squat',['quad','glute'],standView,[
  ['2560',{kind:'normal'}], ['4790',{kind:'one',view:{yaw:53}}],
  ['9323',{kind:'wide',view:{yaw:36}}],['4786',{kind:'side',equipment:'gym-bench-side',view:{yaw:25,focus:[.26,.90,0]}}],
  ['2561',{kind:'side-jump',equipment:'gym-bench-side',view:{yaw:32,focus:[.26,1.11,0],height:2.68}}],
]);
family(benchHip,'gym-bench-flat',['glute','hamstring'],nearSide,[
  ['0130',{kind:'hip'}],['1423',{kind:'reverse',view:{yaw:73}}],['5803',{kind:'reverse',view:{yaw:66}}],
  ['3870',{kind:'frog',view:{yaw:59}}],
]);
family(benchCurl,'gym-bench-flat',['core'],floorView,[
  ['4333',{kind:'circle',view:{yaw:55}}],['3838',{kind:'crunch'}],['0570',{kind:'pull',view:{yaw:73}}],
  ['3499',{kind:'inverted',view:{yaw:71}}],
  ['3279',{kind:'floor',equipment:'gym-bench-front'}],['3280',{kind:'twist',equipment:'gym-bench-front',view:{yaw:49}}],
  ['7417',{kind:'overhead',equipment:'gym-bench-front',view:{yaw:63}}],
  ['3389',{kind:'chair',equipment:'gym-chair-front',view:{yaw:71}}],
  ['0632',{kind:'bridge',equipment:'gym-bench-front',muscles:['glute','hamstring']}],
]);
family(chairRow,'gym-row-chairs',['lat','biceps'],floorView,[
  ['3486',{kind:'chin',under:true,view:{yaw:69}}],['3388',{kind:'row'}],
  ['3485',{kind:'bent',view:{yaw:50}}],['3538',{kind:'row',under:true,view:{yaw:70}}],
  ['3487',{kind:'seat',view:{yaw:64}}],['3550',{kind:'seat',under:true,view:{yaw:62}}],
  ['3536',{kind:'row',feetHigh:true,equipment:'gym-row-chairs-high',view:{yaw:75,focus:[0,.65,.21]}}],
  ['3537',{kind:'row',feetHigh:true,under:true,equipment:'gym-row-chairs-high',view:{yaw:64,focus:[0,.65,.21]}}],
]);
family(pikePress,'gym-bench-pike',['shoulder','triceps'],floorView,[
  ['3915',{kind:'decline',equipment:'gym-bench-pike-decline',view:{yaw:68,focus:[0,.78,.033],height:2.55}}],
  ['3904',{kind:'floor'}],['3401',{kind:'feet-bench',equipment:'gym-bench-pike-decline',view:{yaw:56,focus:[0,.82,.06],height:2.59}}],
  ['3402',{kind:'chairs',equipment:'gym-pike-chairs',view:{yaw:43,focus:[0,.82,.11],height:2.43}}],
]);
family(supportedProne,'gym-bench-front',['pec','shoulder'],floorView,[
  ['4559',{kind:'lat',duration:6100,muscles:['lat','shoulder']}],
  ['1049',{kind:'kick',muscles:['r:glute','r:hamstring'],view:{yaw:69}}],
  ['4329',{kind:'chair',equipment:'gym-chair-wall',view:{yaw:80}}],
  ['11315',{kind:'close',equipment:'gym-chair-wall',muscles:['triceps','pec'],view:{yaw:-83}}],
]);
family(romanHinge,'extension-flat',['glute','hamstring','core'],nearSide,[
  ['0488',{kind:'hyper',view:{yaw:69}}],['0496',{kind:'nordic',equipment:'nordic-mat',view:floorView}],
  ['4988',{kind:'pads',equipment:'nordic-mat',view:{...floorView,yaw:67}}],
]);
family(romanSide,'extension-45',['core'],nearSide,[['0002',{view:{yaw:71}}]]);
family(captain,'captains-chair',['core'],standView,[['5107',{view:{yaw:47}}]]);
family(sideBenchBridge,'gym-bench-front',['core','adductor'],floorView,[['0568',{view:{yaw:59}}]]);

const [directory,...ids]=process.argv.slice(2);
if(!directory)throw Error('Pass an output directory and optional catalogue IDs.');
const selected=ids.length?rows.filter(row=>ids.includes(row.id)):rows;
if(new Set(selected.map(row=>row.id)).size!==selected.length||ids.length&&ids.length!==selected.length)throw Error('Unknown or repeated ID.');
await mkdir(directory,{recursive:true});
const items=[],failures=[];
for(const {id,motion,o,equipment,muscles,view} of selected){
  const recipe={version:1,equipment,muscles,durationMs:o.duration??4630,camera:view,
    keyframes:Array.from({length:65},(_,index)=>({at:index/64,...motion(index/64,o)}))};
  if(o.comparison){
    recipe.formComparison=true;
    for(const frame of recipe.keyframes)frame.partner=motion(frame.at,{...o,comparison:false});
    for(const frame of recipe.keyframes){
      const wrong={...frame};delete wrong.at;delete wrong.partner;
      Object.assign(frame,frame.partner,{partner:wrong});
    }
  }
  try{
    prepareRecipe(recipe);
    await writeFile(resolve(directory,id+'.json'),JSON.stringify(recipe)+'\n');
    items.push({id,recipe:id+'.json',posterAt:o.poster??.445});
  }catch(error){failures.push([id,error.message]);}
}
if(items.length)await writeFile(resolve(directory,'batch.json'),JSON.stringify({kind:'catalogue',items})+'\n');
console.log(JSON.stringify({prepared:items.length,failures}));
if(failures.length)process.exitCode=1;
