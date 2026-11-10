import { classify } from './classification.js';
import { areaSquareMiles, polygons, rankVotes, isTie, queryMetric, breaksFor, binIndex } from './metrics.js';
import { rowColor } from './color.js';

export function boundsFor(features) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const feature of features) for (const polygon of polygons(feature.geometry)) {
    for (const [x,y] of polygon[0]) {
      west = Math.min(west,x); south = Math.min(south,y);
      east = Math.max(east,x); north = Math.max(north,y);
    }
  }
  return [[west,south],[east,north]];
}

export function prepareGeometry(geometry) {
  return geometry.features.map((feature, id) => ({
    feature: { ...feature, id }, id, precinct: String(feature.properties.precinct_id),
    area: areaSquareMiles(feature.geometry), ballots: feature.properties.ballots,
    bounds: boundsFor([feature]),
  }));
}

export function buildView(geometry, contest, query) {
  const rows = geometry.map(item => {
    const result = contest.precincts[item.precinct];
    if (!result) return { ...item, status: 'outside', total: 0, ranked: [] };
    const total = result.cast[query.method];
    const votes = result.votes.map(v => v[query.method]);
    const ranked = rankVotes(votes);
    const metric = queryMetric(votes, total, item.area, query);
    const status = !total ? 'zero' : isTie(ranked) ? 'tie' : metric?.value == null ? 'unavailable' : 'data';
    return { ...item, result, total, ranked, metric, status };
  });
  const breaks = !query.classification || query.classification==='fixed' ? breaksFor(query.measure, rows) : classify(rows.filter(r=>r.status==='data').map(r=>Math.abs(r.metric.value)),query.classification);
  for (const row of rows) {
    row.color = rowColor(row, contest, query, breaks);
    row.bin = row.status === 'data' ? binIndex(Math.abs(row.metric.value), breaks) : -1;
  }
  const included = rows.filter(row => row.result);
  const total = contest.totals[query.method];
  const totals = contest.choices.map(c => c.totals[query.method]);
  const area = included.reduce((sum,row)=>sum+row.area,0);
  const countyMetric = queryMetric(totals,total,area,query);
  const features = { type:'FeatureCollection', features:rows.map(row => ({
    ...row.feature, properties: { precinct:row.precinct, status:row.status, color:row.color },
  })) };
  return { rows, included, features, total, totals, countyMetric, breaks, contest, query,
    byId:new Map(rows.map(row=>[row.precinct,row])),
    bounds:included.length ? boundsFor(included.map(row=>row.feature)) : null };
}
