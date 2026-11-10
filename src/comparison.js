import { classify } from './classification.js';
import { PALETTES, rampColor } from './color.js';
import { binIndex } from './metrics.js';
const palette = ['#6b4c8a','#b9a0d0','#e6dcef','#efede6','#d5ebe5','#8fc7b8','#2f7a6b'];
const labels = ['B +10 pp or more','B +5 to 10 pp','B +1 to 5 pp','Within 1 pp',
  'A +1 to 5 pp','A +5 to 10 pp','A +10 pp or more'];

function gapBin(gap) {
  const magnitude = Math.abs(gap);
  const epsilon = 1e-12;
  const strength = magnitude >= .1-epsilon ? 3 : magnitude >= .05-epsilon ? 2 : magnitude > .01+epsilon ? 1 : 0;
  return 3 + Math.sign(gap)*strength;
}

export function comparisonMap(view, points, candidateA, candidateB, contestB) {
  const custom = view.query.classification && view.query.classification!=='fixed';
  const edges = custom ? classify([...points.values()].map(p=>Math.abs(p.y-p.metric.value)).filter(v=>v>1e-12),view.query.classification,3) : [];
  const center=custom ? edges.length+1 : 3;
  const sides=PALETTES[view.query.palette];
  const fullColors=sides ? [2,1,0].map(i=>rampColor(sides[0],i,3)).concat(['#efede6'],[0,1,2].map(i=>rampColor(sides[1],i,3))) : palette;
  const colors=Array.from({length:center*2+1},(_,i)=>fullColors[i<center ? 3-center+i : i===center ? 3 : 3+i-center]);
  const format=v=>(v*100).toLocaleString('en-US',{maximumSignificantDigits:3});
  const names=custom ? Array.from({length:center*2+1},(_,i)=>{
    if(i===center)return 'Equal shares';
    const strength=Math.abs(i-center)-1, low=strength?edges[strength-1]:0, high=edges[strength];
    return (i<center?'B':'A')+' +'+(low==null?'unused':format(low)+(high==null?' pp or more':' to '+format(high)+' pp'));
  }) : labels;
  const keys = new Map();
  const counts = colors.map(()=>0);
  let unavailable = 0;
  const rows = view.rows.map(row=>{
    const point = points.get(row.precinct);
    if (point) {
      const gap=point.y-point.metric.value;
      const bin = custom ? center+(Math.abs(gap)<=1e-12?0:Math.sign(gap)*(1+binIndex(Math.abs(gap),edges))) : gapBin(gap);
      counts[bin]++;
      keys.set(row.precinct,String(bin));
      return {...row,status:'data',color:colors[bin]};
    }
    if (!row.result) return row;
    unavailable++;
    keys.set(row.precinct,'unshared');
    return {...row,status:'unshared',color:'#e4e3de'};
  });
  const features = {...view.features,features:rows.map(row=>({
    ...row.feature,properties:{precinct:row.precinct,status:row.status,color:row.color},
  }))};
  return {
    view:{...view,rows,features,byId:new Map(rows.map(row=>[row.precinct,row]))},
    keys, unavailable, points, candidateA, candidateB, contestA:view.contest.name, contestB,
    bins:colors.map((color,index)=>({color,label:names[index],count:counts[index]})),
  };
}
