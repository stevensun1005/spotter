import type { Illustration, Point } from "./motion-data";

type Limb = [Point, Point];
type Stage = NonNullable<Illustration["props"]>;
type Attachments = NonNullable<Illustration["dynamic"]>;

function add([x,y]:Point,dx:number,dy:number):Point { return [x+dx,y+dy]; }

function pose(body:[Point,Point,Point],arms:[Limb,Limb],legs:[Limb,Limb],
  toes:[Point,Point]=[add(legs[0][1],7,2),add(legs[1][1],7,2)],
):Point[] {
  return [...body,...arms[0],...arms[1],...legs[0],...legs[1],...toes];
}

function draw(frames:Point[][],props:Stage=[],moving:Attachments=[],ms=810):Illustration {
  return {frames,props,dynamic:[["foot-tip",8,11],["foot-tip",10,12],...moving],ms,reference:true};
}

const rep=[0,.31,.7,1,1,.69,.27];
const bench=(start:number,end:number,y:number):Stage=>[[start,y,end,y],[start+5,y,start+5,156],[end-5,y,end-5,156],[start,156,end,156]];
const rack=(y:number):Stage=>[[102,y,221,y],[103,y,103,155],[220,y,220,155],[93,156,113,156],[211,156,229,156]];

type Row = "close" | "wide" | "towel-stand" | "towel-low" | "inverted-bent";
function anchoredBodyRow(kind:Row):Illustration {
  const low=kind==="towel-low", inverted=kind==="inverted-bent";
  const towel=kind.startsWith("towel");
  const ladder:Stage=low?[[225,43,225,157],[225,43,242,46],[242,46,242,156],[225,156,242,156]]
    :inverted?[[105,51,105,156],[222,51,222,156],[106,51,222,51],[132,87,207,87]]
    :[[218,36,218,156],[246,35,246,156],[218,155,246,155]];
  if(!low&&!inverted)for(let y=45;y<=145;y+=11)ladder.push([218,y,246,y]);
  const equipment:Attachments=towel?[["line",4,219,low?93:89]]:[];
  function frame(pull:number): Point[] {
    if(inverted){
      const hip:Point=[145+5*pull,146-14*pull];
      const sh:Point=[115+10*pull,143-39*pull];
      return pose([add(sh,-15,0),sh,hip],
        [[[126,121-14*pull],[144,88]],[[136,119-14*pull],[153,88]]],
        [[[175,119],[190,153]],[[170,121],[183,151]]]);
    }
    const hip:Point=low?[149+11*pull,125]:[145+16*pull,113-3*pull];
    const sh:Point=low?[150+24*pull,86]:[128+43*pull,75-4*pull];
    const nearHand:Point=towel?[207,91]:[220,89];
    const farHand:Point=towel?add(hip,-5,-11):[kind==="close"?225:243,88];
    const knee:Point=low?[177,125]:[161+8*pull,135];
    return pose([add(sh,6,-15),sh,hip],
      [[[177-2*pull,86+13*pull],nearHand],
        [[towel?sh[0]-12:181+3*pull,towel?sh[1]+25:83+13*pull],farHand]],
      [[knee,[181,152]],[add(knee,5,-5),[189,149]]]);
  }
  return draw(rep.map(frame),ladder,equipment,865);
}

type Drive = "floor-up" | "kneeling-extension" | "knee-pushup" | "clock" | "bar-extension";
function floorExtension(kind:Drive):Illustration {
  const props:Stage=kind==="bar-extension"?[[212,91,212,155],[245,90,245,155],[211,91,245,90],[198,155,252,155]]:[];
  function frame(depth:number, side=0):Point[] {
    const kneeling=kind==="kneeling-extension" || kind==="knee-pushup";
    const bent=kind==="kneeling-extension";
    const bar=kind==="bar-extension";
    const clock=kind==="clock";
    const sh:Point=[bar?178+19*depth:194+17*side,bent?104+38*depth:bar?106+3*depth:106+31*depth];
    const hip:Point=[bent?147:150+7*side,bent?111:124+8*depth];
    const lowElbow:Point=bar?[196,113]:[197+16*side,151];
    const grip:Point=bar?[216,92]:[213+22*side,153];
    const elbow:Point=bent||kind==="floor-up"?[195+(bent?-2:7)*depth,127+24*depth]
      :clock?[192+17*side,128+21*depth]:[sh[0]-2,sh[1]+19];
    const foot:Point=kneeling?[82,139]:[78,148];
    const k:Point=kneeling?[111,153]:[113+6*side,137+4*depth];
    return pose([add(sh,15,bar?-5:0),sh,hip],
      [[bar&&depth>.65?lowElbow:elbow,grip],
        [add(elbow,-7,-4),add(grip,-8,bent?-1:-3)]],
      [[k,foot],[add(k,5,-6),add(foot,7,-4)]],
      [[75,kneeling?132:156],[84,kneeling?130:153]]);
  }
  const frames=kind==="clock"?[frame(0),frame(.8,1),frame(1,1),frame(0,1),frame(.8,-1),frame(1,-1),frame(0,-1)]
    :rep.map(value=>frame(kind==="floor-up"?1-value:value));
  return draw(frames,props,[],kind==="clock"?770:840);
}

function deltoidStretch(kind:"bench"|"strap"|"fold"|"horizontal"|"shrug"):Illustration {
  const stage:Stage=kind==="bench"?
    [[197,121,244,121],[211,122,211,155],[236,122,236,155],[192,156,246,156],[181,72,224,121],[184,72,226,119]]:[];
  const gear:Attachments=kind==="strap"?[["line",4,13],["line",13,6]]:[];
  function frame(move:number):Point[] {
    const ankle:Point=[151,154];
    if(kind==="bench"){
      return pose([[135,102+5*move],[120,93+8*move],[91,99]],
        [[[147,91+3*move],[182,73]],[[150,86+3*move],[185,74]]],
        [[[92,126],[93,153]],[[84,130],[82,151]]]);
    }
    if(kind==="fold"){
      const sh:Point=[172+7*move,112+7*move];
      return pose([[185+6*move,119+8*move],sh,[151,96]],
        [[[177,130],[146,139]],[[164,126],[161,137]]],
        [[[155,127],ankle],[[144,125],[139,152]]]);
    }
    const sh:Point=[151,57-(kind==="shrug"?6*move:0)];
    const nearWrist:Point=kind==="strap"?[125,104-65*move]:kind==="shrug"?[136,21]:[191,68];
    const farWrist:Point=kind==="strap"?[178,105-65*move]:kind==="shrug"?[166,21]:[178-51*move,67];
    return [
      ...pose([[152,40],sh,[150,100]],
        [[kind==="shrug"?[137,36]:[135,kind==="strap"?83-28*move:53+8*move],nearWrist],
          [kind==="shrug"?[166,36]:[172,kind==="strap"?79-25*move:51+9*move],farWrist]],
        [[[146,127],ankle],[[160,124],[165,151]]]),
      [(nearWrist[0]+farWrist[0])/2,(nearWrist[1]+farWrist[1])/2+8-11*move],
      add(sh,-10,0),add(sh,10,0),
    ];
  }
  const motion=draw(rep.map(frame),stage,gear,920);
  return kind==="shrug"?{...motion,shoulders:[14,15]}:motion;
}


type Dip = "bench" | "floor" | "korean" | "impossible";
function bodyDip(kind:Dip):Illustration {
  const rails:Stage = kind==="bench"?[...bench(77,120,110),...bench(184,228,110)]
    :kind==="floor"?[]
    :[[93,88,223,88],[98,88,98,155],[217,88,217,155],[85,156,232,156],[92,98,224,98],[112,98,112,155],[223,98,223,155]];
  function frame(depth:number):Point[] {
    const floor=kind==="floor", flat=kind==="bench", korean=kind==="korean";
    const grip:Point=floor?[116,154]:flat?[113,107]:[148,87];
    const hp:Point=floor?[149,139+7*depth]:flat?[141,116+21*depth]:[153+(korean?-6:7)*depth,111+12*depth];
    const sh:Point=[hp[0]+(korean?15:-8),hp[1]-(floor?27:37)];
    const arm:Limb=[[grip[0]-3-13*depth,(sh[1]+grip[1])/2],grip];
    const foot:Point=floor?[198,153]:flat?[207,106]:korean?[149-30*depth,146-8*depth]:[211,142];
    const knee:Point=floor?[170,126]:flat?[172,110]:korean?[152-13*depth,130]:[183,125];
    return pose([add(sh,3,-16),sh,hp],[arm,[add(arm[0],-4,-5),add(grip,-7,2)]],
      [[knee,foot],[add(knee,-5,5),add(foot,-5,2)]],
      [add(foot,korean?-6:8,3),add(foot,korean?-11:2,4)]);
  }
  return draw(rep.map(frame),rails,[],840);
}

type BarSkill = "gironda" | "lateral" | "bar-muscle" | "back-lever";
function barExercise(kind:BarSkill):Illustration {
  const barY=kind==="bar-muscle"?51:35;
  const stage=rack(barY);
  function frame(move:number, side=1):Point[] {
    if(kind==="back-lever"){
      const sh:Point=[124,96+9*move];
      const hip:Point=[171,95+7*move];
      const foot:Point=[227,98+9*move];
      return pose([[108,104+9*move],sh,hip],
        [[[139,69],[153,35]],[[146,68],[160,35]]],
        [[[201,96+8*move],foot],[[197,93+7*move],add(foot,-5,-3)]]);
    }
    const muscle=kind==="bar-muscle";
    const offset=kind==="lateral"?28*move*side:kind==="gironda"?-10*move:5*move;
    const sh:Point=[151+offset,barY+(muscle?25:31)-(muscle?49:27)*move];
    const hip=add(sh,kind==="gironda"?22*move:10*move,39);
    const k=add(hip,kind==="lateral"?-7:3,21+3*move);
    const foot=add(k,-6,17-13*move*(muscle?1:.2));
    const armWidth=kind==="lateral"?42:muscle?19:24;
    return pose(
      [add(sh,-2,-15),sh,hip],
      [[[151-armWidth-6,barY+13+8*move],[151-armWidth,barY]],
        [[151+armWidth+6,barY+13+8*move],[151+armWidth,barY]]],
      [[k,foot],[add(k,7,-4),add(foot,7,-1)]]);
  }
  const frames=kind==="lateral"?[frame(0),frame(.65),frame(1),frame(0),frame(.65,-1),frame(1,-1)]
    :rep.map(move=>frame(kind==="back-lever"?.25*move:move));
  return draw(frames,stage,[],840);
}

function ringSkill(inverted:boolean):Illustration {
  const stage:Stage=[[122,6,187,6]];
  const rings:Attachments=[["cable",4,131,6],["cable",6,177,6],["ring",4,0,1],["ring",6,0,1]];
  function frame(move:number):Point[] {
    if(inverted){
      const sh:Point=[152,129-24*move];
      const hips=add(sh,0,-44);
      const wrist:Point=[133-20*Math.sin(move*Math.PI),110];
      return pose([add(sh,0,16),sh,hips],
        [[[143-10*move,111-5*move],wrist],[[161+10*move,111-5*move],[304-wrist[0],111]]],
        [[[147,sh[1]-69],[145,sh[1]-92]],[[156,sh[1]-69],[155,sh[1]-92]]],
        [[152,sh[1]-97],[161,sh[1]-97]]);
    }
    const sh:Point=[152,113-61*move];
    const hips=add(sh,1,30);
    const wrist:Point=[130-9*move,83];
    const k:Point=[148+7*move,Math.min(149,hips[1]+23)];
    const foot:Point=[144+11*move,Math.min(155,hips[1]+41)];
    return pose([add(sh,0,-14),sh,hips],
      [[[132-12*move,(wrist[1]+sh[1])/2],wrist],[[176+12*move,(wrist[1]+sh[1])/2],[304-wrist[0],83]]],
      [[k,foot],[add(k,7,-4),add(foot,6,-4)]]);
  }
  return draw(rep.map(frame),stage,rings,930);
}

function invertedPress(wall:boolean):Illustration {
  const panel:Stage=wall?[[224,28,224,157],[223,29,234,31],[235,32,235,157],[222,157,239,157]]:[];
  const set=(mode:"rest"|"middle"|"high"|"straddle"):Point[]=>{
    if(wall){
      const near:Point=mode==="high"?[220,44]:mode==="middle"?[221,105]:[219,147];
      const ankle=add(near,-4,-4);
      const hand:Point=mode==="high"?[213,153]:mode==="middle"?[169,153]:[114,153];
      const sh:Point=mode==="high"?[214,118]:mode==="middle"?[179,122]:[127,145];
      const hp:Point=mode==="high"?[217,89]:mode==="middle"?[200,112]:[163,146];
      return pose([add(sh,mode==="high"?-2:-13,8),sh,hp],
        [[[hand[0]+1,(hand[1]+sh[1])/2],hand],[[hand[0]+7,(hand[1]+sh[1])/2-4],add(hand,7,-3)]],
        [[[(hp[0]+near[0])/2,(hp[1]+near[1])/2],near],[[(hp[0]+ankle[0])/2,(hp[1]+ankle[1])/2],ankle]],
        [add(near,3,mode==="rest"?6:-5),add(ankle,7,mode==="rest"?3:-8)]);
    }
    const hp:Point=mode==="high"?[154,69]:mode==="middle"?[151,92]:[141,144];
    const sh:Point=mode==="high"?[154,118]:mode==="middle"?[156,122]:[154,107];
    const knee:Point=mode==="high"?[153,42]:mode==="middle"?[175,109]:[111,130];
    const farKnee:Point=mode==="high"?[160,44]:mode==="middle"?[128,111]:[182,125];
    const leftFoot:Point=mode==="high"?[152,24]:mode==="middle"?[201,116]:[84,135];
    const rightFoot:Point=mode==="high"?[160,25]:mode==="middle"?[99,118]:[215,126];
    return pose([add(sh,0,mode==="straddle"?-16:13),sh,hp],
      [[[142,133],[137,154]],[[166,133],[172,154]]],
      [[knee,leftFoot],[farKnee,rightFoot]]);
  };
  const modes=wall?["rest","middle","high","high","middle","rest"] as const
    :["high","high","middle","straddle","straddle","middle"] as const;
  return draw(modes.map(set),panel,[],920);
}

export const legacyCalisthenicSourceIllustrations: Readonly<Record<string, Illustration>> = {
  "0137": floorExtension("floor-up"),
  "0258": floorExtension("clock"),
  "0466": barExercise("gironda"),
  "0631": ringSkill(false),
  "0720": barExercise("lateral"),
  "0812": bodyDip("bench"),
  "0815": bodyDip("floor"),
  "0816": floorExtension("bar-extension"),
  "1182": floorExtension("knee-pushup"),
  "1223": anchoredBodyRow("inverted-bent"),
  "1271": deltoidStretch("strap"),
  "1401": barExercise("bar-muscle"),
  "1405": deltoidStretch("bench"),
  "1689": deltoidStretch("horizontal"),
  "1771": floorExtension("kneeling-extension"),
  "1773": anchoredBodyRow("towel-low"),
  "1793": deltoidStretch("fold"),
  "3158": anchoredBodyRow("close"),
  "3161": anchoredBodyRow("towel-stand"),
  "3166": anchoredBodyRow("wide"),
  "3288": bodyDip("korean"),
  "3289": bodyDip("impossible"),
  "3291": invertedPress(false),
  "3292": ringSkill(true),
  "3297": barExercise("back-lever"),
  "5234": invertedPress(true),
  "11288": deltoidStretch("shrug"),
};
