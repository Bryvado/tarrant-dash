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
