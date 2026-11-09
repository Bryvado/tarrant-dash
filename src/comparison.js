const palette = ['#68378c','#9a67b2','#cdb4df','#f3f1ea','#aad6cd','#58a99a','#207467'];
const labels = ['B +10 pp or more','B +5 to 10 pp','B +1 to 5 pp','Within 1 pp',
  'A +1 to 5 pp','A +5 to 10 pp','A +10 pp or more'];

function gapBin(gap) {
  const magnitude = Math.abs(gap);
  const epsilon = 1e-12;
  const strength = magnitude >= .1-epsilon ? 3 : magnitude >= .05-epsilon ? 2 : magnitude > .01+epsilon ? 1 : 0;
  return 3 + Math.sign(gap)*strength;
}

export function comparisonMap(view, points, candidateA, candidateB) {
  const keys = new Map();
  const counts = palette.map(()=>0);
  let unavailable = 0;
  const rows = view.rows.map(row=>{
    const point = points.get(row.precinct);
    if (point) {
      const bin = gapBin(point.y-point.metric.value);
      counts[bin]++;
      keys.set(row.precinct,String(bin));
      return {...row,status:'data',color:palette[bin]};
    }
    if (!row.result) return row;
    unavailable++;
    keys.set(row.precinct,'unavailable');
    return {...row,status:'unavailable',color:'#eae5db'};
  });
  const features = {...view.features,features:rows.map(row=>({
    ...row.feature,properties:{precinct:row.precinct,status:row.status,color:row.color},
  }))};
  return {
    view:{...view,rows,features,byId:new Map(rows.map(row=>[row.precinct,row]))},
    keys, unavailable, candidateA, candidateB,
    bins:palette.map((color,index)=>({color,label:labels[index],count:counts[index]})),
  };
}
