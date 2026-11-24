import type { Illustration, Point } from "./motion-data";

type Props = NonNullable<Illustration["props"]>;
type Links = NonNullable<Illustration["dynamic"]>;

const legLinks: Links = [["foot-tip",8,11],["foot-tip",10,12],["face",0,13]];
const ellipticalLinks: Links = [...legLinks,
  ["line",4,16],["line",6,17],["line",16,14],["line",17,15],["line",14,18],["line",15,19],
  ["pad",14,3,1],["pad",15,3,1],
];
type Drive = "front" | "rear" | "compact";

function ring([x,y]:Point,radius:number):Props {
  return Array.from({length:16},(_,index)=>{
    const start = index*Math.PI/8;
    const end = (index+1)*Math.PI/8;
    return [x+radius*Math.cos(start),y+radius*Math.sin(start),x+radius*Math.cos(end),y+radius*Math.sin(end)];
  });
}

const mounts = {
  front: {wheel:[225,131] as Point, radius:21, axis:[211,105] as Point, facing:-1},
  rear: {wheel:[86,131] as Point, radius:23, axis:[209,109] as Point, facing:1},
  compact: {wheel:[89,137] as Point, radius:17, axis:[204,118] as Point, facing:-1},
};

function elliptical(drive:Drive):Illustration {
  const {wheel,radius,axis,facing} = mounts[drive];
  const props:Props = [
    ...ring(wheel,radius),[69,154,251,154],[78,148,78,156],[239,148,239,156],
    [axis[0]+16,149,axis[0]+10,85],[axis[0]+5,92,axis[0]+25,80],
    [axis[0]+6,89,axis[0]+24,77],[axis[0]+10,85,axis[0]+4,112],
    [axis[0]+4,112,axis[0]+16,149],
  ];
  if(drive==="front") props.push([wheel[0],150,89,146],[89,146,83,152]);
  if(drive==="compact") props.push([98,151,128,143],[77,153,63,149],[234,153,249,149]);
  const frames = Array.from({length:12},(_,index)=>{
    const phase = index*Math.PI/6;
    const stride = (shift:number,depth:number) => {
      const angle = phase+shift;
      const reach = Math.cos(angle);
      const lift = Math.sin(angle);
      const shoe:Point = [152+22*reach+depth,139+7*lift];
      const hand:Point = [198-15*reach+depth,73+3*lift];
      const knee:Point = [(shoe[0]+158)/2+11,(shoe[1]+94)/2-4-2*lift];
      const elbow:Point = [hand[0]-13,80-2*reach];
      const crank:Point = [wheel[0]+11*reach,wheel[1]+11*lift];
      return {shoe,hand,knee,elbow,crank};
    };
    const near = stride(0,0);
    const far = stride(Math.PI,6);
    return [
      [169,44],[163,61],[155,96],near.elbow,near.hand,far.elbow,far.hand,
      near.knee,[near.shoe[0]-4,near.shoe[1]-5],far.knee,[far.shoe[0]-4,far.shoe[1]-5],
      [near.shoe[0]+10,near.shoe[1]-3],[far.shoe[0]+10,far.shoe[1]-3],[173,43],
      near.shoe,far.shoe,axis,[axis[0]+6,axis[1]],near.crank,far.crank,
    ] as Point[];
  });
  const reflect = (x:number)=>320-x;
  return {
    frames:facing===1?frames:frames.map(frame=>frame.map(([x,y])=>[reflect(x),y])),
    props:facing===1?props:props.map(([x,y,z,w])=>[reflect(x),y,reflect(z),w]),
    dynamic:ellipticalLinks,ms:240,reference:true,
  };
}

const stepmillFrame: Props = [
  [81,158,231,158],[96,157,105,143],[101,141,172,81],[172,81,214,82],
  [214,82,225,145],[225,145,230,157],[95,156,94,148],[94,148,113,148],
  [231,155,242,72],[242,72,230,55],[230,55,211,52],[230,58,211,55],
  [97,133,112,125],[112,125,155,72],[155,72,197,62],[197,62,213,75],
  [107,136,124,127],[124,127,167,74],[167,74,210,64],[210,64,228,75],
];
const stairStepLinks: Links = Array.from({length:5},(_,index)=>[
  ["line",14+3*index,15+3*index],
  ["line",15+3*index,16+3*index],
] as Links).flat();

function stepmillPosition(step:number):Point[] {
  const phase = step/8;
  const stride = (offset:number, depth:number) => {
    const point = (phase+offset)%1;
    const planted = point<.62;
    const trip = planted?point/.62:(point-.62)/.38;
    const ascent = planted?1-trip:trip;
    const clearance = planted?0:10*Math.sin(Math.PI*trip);
    const shoe:Point = [131+30*ascent+depth,122-24*ascent-clearance];
    const knee:Point = [(shoe[0]+148)/2+12+(planted?0:6),(shoe[1]+74)/2-5-clearance/2];
    return {shoe,knee};
  };
  const near = stride(0,0);
  const far = stride(.5,7);
  const stairs:Point[] = Array.from({length:5},(_,index)=>{
    const offset = index-(2*phase)%1;
    const x = 105+15*offset;
    const y = 144-12*offset;
    return [[x,y],[x+15,y],[x+15,y-12]] as Point[];
  }).flat();
  return [
    [164,29],[157,44],[149,74],[166,59],[194,65],[177,64],[208,68],
    near.knee,[near.shoe[0]-5,near.shoe[1]-5],far.knee,[far.shoe[0]-5,far.shoe[1]-5],
    [near.shoe[0]+8,near.shoe[1]-2],[far.shoe[0]+8,far.shoe[1]-2],[169,28],...stairs,
  ];
}

export const cardioSourceCorrections: Record<string, Illustration> = {
  "2141":elliptical("rear"),
  "2192":elliptical("front"),
  "4259":elliptical("compact"),
  "2311":{
    props:stepmillFrame,frames:Array.from({length:8},(_,index)=>stepmillPosition(index)),
    dynamic:[...legLinks,...stairStepLinks],ms:240,reference:true,
  },
};
