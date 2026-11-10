export const SCALES = {
  fixed: ['Default thresholds', 'Familiar share and margin cutoffs; density uses ranked groups.'],
  equal: ['Equal intervals', 'Equal-sized value ranges. Useful for comparing absolute differences.'],
  quantile: ['Quantiles', 'Roughly equal numbers of precincts per color; identical values stay together.'],
  natural: ['Natural breaks (Jenks)', 'Groups similar values and separates clusters in this contest.'],
};

// Return lower boundaries for bins. Repeated observations retain their weight.
export function classify(values, method, classes = 5) {
  const x = values.filter(Number.isFinite).sort((a,b)=>a-b);
  const unique = [...new Set(x)], k = Math.min(classes, unique.length);
  if (k < 2) return [];
  if (method === 'equal') return Array.from({length:k-1},(_,i)=>x[0]+(x.at(-1)-x[0])*(i+1)/k);
  if (method === 'quantile') {
    const cuts = Array.from({length:k-1},(_,i)=>{
      const p=(x.length-1)*(i+1)/k, j=Math.floor(p);
      return x[j]+(x[j+1]-x[j])*(p-j);
    });
    return [...new Set(cuts)].filter(v=>v>x[0]);
  }
  // Exact Fisher–Jenks: minimize within-class squared deviation.
  const n=x.length, sums=[0], squares=[0];
  for (const v of x) {sums.push(sums.at(-1)+v);squares.push(squares.at(-1)+v*v);}
  const dp=Array.from({length:k+1},()=>new Float64Array(n+1).fill(Infinity));
  const split=Array.from({length:k+1},()=>new Int32Array(n+1));
  dp[0][0]=0;
  for(let c=1;c<=k;c++) for(let end=c;end<=n;end++) {
    for(let start=c-1;start<end;start++) {
      if(start && x[start]===x[start-1])continue;
      const sum=sums[end]-sums[start];
      const cost=dp[c-1][start]+Math.max(0,squares[end]-squares[start]-sum*sum/(end-start));
      if(cost<dp[c][end]) {dp[c][end]=cost;split[c][end]=start;}
    }
  }
  const cuts=[];
  for(let c=k,end=n;c>1;c--) {const start=split[c][end];cuts.unshift((x[start-1]+x[start])/2);end=start;}
  return cuts;
}
