export function share(votes,total){return total>0?votes/total:null;}
export function margin(d,r){return d+r>0?(d-r)/(d+r):null;}
export function lean(d,r,countyD,countyR){const a=margin(d,r),b=margin(countyD,countyR);return a===null||b===null?null:a-b;}
export function key(vintage,precinct){return `${vintage}:${precinct}`;}
export function validate(data){
 const errors=[]; const ids=new Set();
 if(data.type!=='FeatureCollection'||!Array.isArray(data.features))return ['Expected GeoJSON FeatureCollection'];
 for(const f of data.features){const p=f.properties||{}; const id=key(p.boundary_version,p.precinct_id);
 if(!p.precinct_id||!p.boundary_version)errors.push('Missing precinct_id or boundary_version');
 if(ids.has(id))errors.push(`Duplicate ${id}`);ids.add(id);
 if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))errors.push(`Invalid geometry ${id}`);
 for(const name of ['dem_votes','rep_votes','other_votes','ballots','registered'])if(!Number.isInteger(p[name])||p[name]<0)errors.push(`Invalid ${name} in ${id}`);
 if(p.dem_votes+p.rep_votes+p.other_votes>p.ballots)errors.push(`Contest votes exceed ballots in ${id}`);
 if(p.ballots>p.registered)errors.push(`Ballots exceed registration in ${id}`);
 }return errors;
}

export const polygons = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
export const MARGIN_BREAKS = [.05, .10, .20, .30, .50];
export const SHARE_BREAKS = Array.from({ length: 9 }, (_, i) => (i + 1) / 10);

export function areaSquareMiles(geometry) {
  const rad = Math.PI / 180;
  let area = 0;
  for (const polygon of polygons(geometry)) {
    for (const [index, ring] of polygon.entries()) {
      let sum = 0;
      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i], [previousLon, previousLat] = ring[i - 1];
        sum += (lon - previousLon) * rad * (Math.sin(lat * rad) + Math.sin(previousLat * rad));
      }
      area += (index === 0 ? 1 : -1) * Math.abs(sum);
    }
  }
  return area * (6371008.8 / 1609.344) ** 2 / 2;
}

export const grossDensity = (votes, area) => area > 0 ? votes / area : null;
export const netDensity = (leader, runnerUp, area) => grossDensity(leader - runnerUp, area);
export const rankVotes = votes => votes.map((count, index) => ({ count, index }))
  .sort((a, b) => b.count - a.count || a.index - b.index);
export const isTie = ranked => ranked.length > 1 && ranked[0].count > 0 && ranked[0].count === ranked[1].count;
export const binIndex = (value, breaks) => breaks.filter(edge => value >= edge).length;

export function densityBreaks(values) {
  const sorted = values.filter(value => value > 0 && Number.isFinite(value)).sort((a, b) => a - b);
  return [...new Set([.2, .4, .6, .8, .95].map(p => sorted[Math.floor(p * (sorted.length - 1))]))]
    .filter(Number.isFinite);
}

export function queryMetric(votes, total, area, query) {
  if (!total) return null;
  const ranked = rankVotes(votes), [leader, runnerUp] = ranked;
  const index = query.scope === 'winner' ? leader.index : query.choice;
  const rival = ranked.find(row => row.index !== index);
  if (query.measure === 'density') {
    const value = query.scope === 'winner' ? netDensity(leader.count, runnerUp?.count ?? 0, area)
      : grossDensity(query.scope === 'total' ? total : votes[index], area);
    return { value, index: query.scope === 'total' ? null : index };
  }
  if (query.measure === 'margin') {
    if (!rival) return null;
    const value = (votes[index] - rival.count) / total;
    return { value, index: value < 0 ? rival.index : index };
  }
  return { value: share(votes[index], total), index };
}

export function breaksFor(measure, rows) {
  if (measure === 'share') return SHARE_BREAKS;
  if (measure === 'margin') return MARGIN_BREAKS;
  return densityBreaks(rows.filter(row => row.status === 'data').map(row => row.metric.value));
}

export function formatMetric(value, measure) {
  if (value == null) return '—';
  if (measure === 'density') return `${number(value, 1)} votes/mi²`;
  return `${number(value * 100, 1)}${measure === 'share' ? '%' : ' pp'}`;
}
export const number = (value, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
