import countyMask from './county-mask.json';
import maplibregl from 'maplibre-gl';import 'maplibre-gl/dist/maplibre-gl.css';import './style.css';
const $=s=>document.querySelector(s),fmt=n=>n.toLocaleString(),pct=(n,d)=>d?`${(100*n/d).toFixed(1)}%`:'—';
$('#app').innerHTML=`<header><div><small>TARRANT COUNTY · ELECTION RESEARCH</small><h1>Tarrant precinct workspace</h1></div><span>OpenFreeMap</span></header><div class="notice" id="notice">Loading county results…</div><main><aside><h2>November 3, 2026</h2><label>Contest<select id="contest"></select></label><label>Candidate / choice<select id="choice"></select></label><label>Voting method<select id="method"><option value="3">All methods</option><option value="0">Mail</option><option value="1">Early in-person</option><option value="2">Election Day</option></select></label><label>Precinct<select id="precinct"><option value="">Select precinct</option></select></label><label>Basemap<select id="basemap" disabled><option value="streets">OpenFreeMap streets</option><option value="aerial">Satellite view · 2025 aerial imagery</option></select></label><label>Measure<select id="measure"><option value="share">Vote share</option><option value="margin">Margin</option><option value="density">Vote density</option></select></label><label>Show votes for<select id="vote-scope"><option value="candidate">Selected candidate</option><option value="winner">Each precinct winner</option><option value="total" disabled>Total contest votes</option></select></label><label>Precinct shading opacity<input id="precinct-opacity" type="range" min="0" max="100" value="75"></label><label>Aerial imagery opacity<input id="aerial-opacity" type="range" min="0" max="100" value="100" disabled></label><button id="clear">Clear selection</button><p id="status"></p><p id="density-note"></p><h2>Sources & coverage</h2><p>Unofficial county reports, Nov. 5 precinct report and Nov. 4 cumulative report. Current county geometry snapshot; no historical crosswalk. Local contests show the Tarrant portion and may cover only part of a precinct.</p><p><a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/precinct.pdf" target="_blank">Precinct report</a> · <a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/cumulative.pdf" target="_blank">Cumulative report</a></p><p>Registration denominators and both parties’ chair records will be added later. No turnout rates are estimated.</p></aside><section class="workspace" aria-label="Precinct map"><div id="map"></div></section><section class="analytics" aria-labelledby="analytics-heading"><h2 id="analytics-heading">Analytics</h2><div id="totals"></div><div id="profile"></div><section class="chart"><h2>Precinct comparison</h2><p>Candidate share (horizontal) · Valid contest votes (vertical). Select a point or precinct to link the views.</p><svg id="plot" viewBox="0 0 800 280"></svg></section></section></main>`;
let g,db,map=null,selected='',c,features;const ns='http://www.w3.org/2000/svg';const m=()=>+$('#method').value,ch=()=>+$('#choice').value;function node(tag,t){const e=document.createElement(tag);e.textContent=t;return e;}function opt(id,t){const e=node('option',t);e.value=id;return e;}function color(v){if(v==null)return '#858d88';const party=c.choices[ch()].party;return `hsl(${party==='REP'?350:party==='DEM'?210:155} 48% ${84-v*54}%)`;}
const measure = () => $('#measure').value;
const voteScope = () => $('#vote-scope').value;
const polygons = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

function areaSquareMiles(geometry) {
  const rad = Math.PI / 180;
  let area = 0;
  for (const polygon of polygons(geometry)) {
    for (const [index, ring] of polygon.entries()) {
      let sum = 0;
      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const [previousLon, previousLat] = ring[i - 1];
        sum += (lon - previousLon) * rad * (Math.sin(lat * rad) + Math.sin(previousLat * rad));
      }
      area += (index === 0 ? 1 : -1) * Math.abs(sum);
    }
  }
  return area * (6371008.8 / 1609.344) ** 2 / 2;
}

function mapMetric(result, area) {
  const total = result?.cast[m()];
  if (!total || (measure() === 'density' && !(area > 0))) return null;
  if (voteScope() === 'total') return { value: total / area, names: 'Total contest votes', hue: 155 };

  const votes = result.votes.map(counts => counts[m()]);
  const max = Math.max(...votes);
  const indices = voteScope() === 'winner'
    ? votes.flatMap((count, index) => count === max ? [index] : [])
    : [ch()];
  const first = indices[0];
  const choices = indices.map(index => c.choices[index]);
  const party = choices[0].party;
  const hue = choices.length > 1 ? 275 : party === 'REP' ? 350 : party === 'DEM' ? 210 : (155 + first * 137.5) % 360;
  let value = votes[first] / total;
  if (measure() === 'density') value = votes[first] / area;
  if (measure() === 'margin') {
    if (votes.length < 2) return null;
    const strongestOpponent = Math.max(...votes.filter((_, index) => index !== first));
    value = (votes[first] - strongestOpponent) / total;
  }
  return { value, names: choices.map(choice => choice.name).join(' / '), hue };
}

function registerClippedAerial() {
  const shapes = g.features.flatMap(feature => polygons(feature.geometry)).map(polygon => {
    const rings = polygon.map(ring => ring.map(([lng, lat]) => maplibregl.MercatorCoordinate.fromLngLat({lng, lat})));
    const xs = rings[0].map(point => point.x);
    const ys = rings[0].map(point => point.y);
    return { rings, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  });
  maplibregl.addProtocol('county-aerial', async (request, controller) => {
    const [z, y, x] = request.url.slice('county-aerial://'.length).split('/').map(Number);
    const tileCount = 2 ** z;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const hits = shapes.filter(shape => shape.minX <= (x + 1) / tileCount && shape.maxX >= x / tileCount &&
      shape.minY <= (y + 1) / tileCount && shape.maxY >= y / tileCount);
    if (hits.length) {
      const url = `https://mapitimage.tarrantcounty.com/arcgis/rest/services/Aerials/2025_TC911_Ortho_3in/ImageServer/tile/${z}/${y}/${x}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw Error('Aerial tile unavailable');
      const image = await createImageBitmap(await response.blob());
      for (const { rings } of hits) {
        ctx.beginPath();
        for (const ring of rings) {
          ring.forEach((point, index) => ctx[index ? 'lineTo' : 'moveTo'](
            (point.x * tileCount - x) * 256, (point.y * tileCount - y) * 256));
          ctx.closePath();
        }
        ctx.fill('evenodd');
      }
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(image, 0, 0, 256, 256);
      image.close();
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return { data: await blob.arrayBuffer() };
  });
}

function select(id){selected=id;$('#precinct').value=id;profile();plot();if(map?.getLayer('selected'))map.setFilter('selected',['==',['get','precinct_id'],id]);document.querySelectorAll('#map path').forEach(p=>p.setAttribute('stroke-width',p.dataset.id===id?'3':'.4'));}
function profile(){const p=$('#profile');p.replaceChildren(node('h2',selected?'Precinct '+selected:'Precinct profile'));const r=c.precincts[selected];if(!r){p.append(node('p',selected?'No reported results for this contest.':'Select a precinct.'));return;}c.choices.forEach((x,i)=>p.append(node('p',`${x.name}: ${fmt(r.votes[i][m()])} · ${pct(r.votes[i][m()],r.cast[m()])}`)));p.append(node('p',`Election ballots: ${fmt(g.features.find(f=>f.properties.precinct_id===selected).properties.ballots)} · Valid contest votes (${ $('#method').selectedOptions[0].textContent }): ${fmt(r.cast[m()])}`));if (measure() !== 'share' || voteScope() === 'winner') {
  const area = g.features.find(f => f.properties.precinct_id === selected).properties.areaSqMi;
  const metric = mapMetric(r, area);
  if (metric) {
    const label = measure() === 'density' ? `${metric.value.toLocaleString(undefined,{maximumFractionDigits:2})} votes/mi²`
      : measure() === 'margin' ? `${(metric.value * 100).toFixed(1)} pp margin` : pct(metric.value, 1);
    p.append(node('p', `${metric.names}: ${label}`));
  }
}
p.append(node('p',`Undervotes ${fmt(r.under[m()])} · Overvotes ${fmt(r.over[m()])}`));}
function plot(){const svg=$('#plot');svg.replaceChildren();const max=Math.max(1,...features.map(f=>f.properties.total||0));function el(tag,attrs,t){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(t)e.textContent=t;svg.append(e);return e;}el('text',{x:40,y:265},'0%');el('text',{x:730,y:265},'100%');el('text',{x:5,y:20},fmt(max));el('line',{x1:40,x2:770,y1:240,y2:240,stroke:'#aaa'});for(const f of features){const p=f.properties;if(p.share==null)continue;const circle=el('circle',{cx:40+p.share*730,cy:240-p.total/max*210,r:p.precinct_id===selected?7:3.5,fill:color(p.share),stroke:p.precinct_id===selected?'black':'white',tabindex:0,role:'button','aria-label':'Chart precinct '+p.precinct_id});circle.onclick=()=>select(p.precinct_id);circle.onkeydown=e=>{if(e.key==='Enter')select(p.precinct_id);};const title=document.createElementNS(ns,'title');title.textContent=`${p.precinct_id}: ${pct(p.share,1)}, ${fmt(p.total)} votes`;circle.append(title);}}
function fallback(){const host=$('#map');host.replaceChildren();const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 800 520');svg.style.cssText='width:100%;height:100%';const coords=g.features.flatMap(f=>f.geometry.type==='Polygon'?f.geometry.coordinates.flat():f.geometry.coordinates.flat(2));let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const [x,y]of coords){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}const scale=Math.min(740/((xmax-xmin)*.84),470/(ymax-ymin));for(const f of features){const p=document.createElementNS(ns,'path');const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;p.setAttribute('d',polys.flatMap(poly=>poly.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${30+(x-xmin)*.84*scale},${495-(y-ymin)*scale}`).join(' ')+' Z')).join(' '));p.setAttribute('fill',f.properties.mapColor);p.setAttribute('fill-opacity',Number($('#precinct-opacity').value)/100);p.setAttribute('fill-rule','evenodd');p.setAttribute('stroke','#567');p.setAttribute('stroke-width',f.properties.precinct_id===selected?'3':'.4');p.dataset.id=f.properties.precinct_id;p.setAttribute('role','button');p.setAttribute('aria-label','Map precinct '+p.dataset.id);p.onclick=()=>select(p.dataset.id);svg.append(p);}host.append(svg);$('#status').textContent='WebGL unavailable: precinct shapes shown without basemap. Gray = no valid contest votes.';}
function refresh(){features=g.features.map(f=>{const r=c.precincts[f.properties.precinct_id];return {...f,properties:{...f.properties,total:r?.cast[m()]??null,share:r&&r.cast[m()]?r.votes[ch()][m()]/r.cast[m()]:null}};});const metrics = features.map(f => mapMetric(c.precincts[f.properties.precinct_id], f.properties.areaSqMi));
const values = metrics.filter(Boolean).map(d => Math.abs(d.value)).sort((a,b)=>a-b);
const ceiling = measure() === 'density' ? values[Math.floor((values.length - 1) * .95)] || 1 : 1;
features.forEach((feature, index) => {
  const metric = metrics[index];
  if (measure() === 'share' && voteScope() === 'candidate') {
    feature.properties.mapColor = color(feature.properties.share);
    return;
  }
  feature.properties.mapColor = metric
    ? `hsl(${metric.hue} ${metric.value < 0 ? 10 : 54}% ${86 - 56 * Math.sqrt(Math.min(Math.abs(metric.value) / ceiling, 1))}%)`
    : '#858d88';
});
$('#density-note').textContent = {
  share: 'Share of valid contest votes. In winner mode, color identifies the winning party or choice. Purple marks ties.',
  margin: 'Lead over the strongest opponent, in percentage points of valid contest votes. Muted colors show a selected candidate trailing. Gray includes contests with no opponent. Purple marks ties in winner mode.',
  density: `Votes per square mile of mapped precinct area. Darker means denser. The scale caps at ${ceiling.toLocaleString(undefined,{maximumFractionDigits:1})} votes/mi². Purple marks ties in winner mode.`
}[measure()];
const totals=$('#totals');totals.replaceChildren(node('h2',c.name));c.choices.forEach(x=>totals.append(node('p',`${x.name}${x.party?' · '+x.party:''}: ${fmt(x.totals[m()])} (${pct(x.totals[m()],c.totals[m()])})`)));profile();plot();if(map?.getSource('precincts')){map.getSource('precincts').setData({type:'FeatureCollection',features});map.setPaintProperty('fill','fill-color',['get','mapColor']);}else if(!map)fallback();}
function choose(){c=db.contests[+$('#contest').value];$('#choice').replaceChildren(...c.choices.map((x,i)=>opt(i,x.name)));const d=c.choices.findIndex(x=>x.party==='DEM');$('#choice').value=String(d<0?0:d);refresh();}
async function start(){try{[g,db]=await Promise.all(['precincts.geojson','official.json'].map(async p=>{const r=await fetch('./data/'+p);if(!r.ok)throw Error('Data unavailable');return r.json();}));$('#notice').textContent=`Unofficial results · 707 precincts · 118 contests · ${fmt(db.ballots)} ballots · ${db.checks} reconciliation checks passed`;$('#contest').append(...db.contests.map((x,i)=>opt(i,x.name)));$('#precinct').append(...g.features.map(f=>f.properties.precinct_id).sort().map(id=>opt(id,id)));g.features.forEach(f => { f.properties.areaSqMi = areaSquareMiles(f.geometry); });choose();try{$('#map').replaceChildren();map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-97.29,32.77],zoom:9,renderWorldCopies:false});map.addControl(new maplibregl.NavigationControl());map.on('load',()=>{map.addSource('precincts',{type:'geojson',data:{type:'FeatureCollection',features}});map.addSource('county-mask', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: countyMask }, tolerance: 0 });
map.addLayer({ id: 'outside-county', type: 'fill', source: 'county-mask',
  paint: { 'fill-color': '#f6f5f0', 'fill-antialias': false } });
map.addLayer({id:'fill',type:'fill',source:'precincts',paint:{'fill-opacity':Number($('#precinct-opacity').value)/100}});map.addLayer({id:'outline',type:'line',source:'precincts',paint:{'line-color':'#68796b','line-width':.5}});map.addLayer({id:'selected',type:'line',source:'precincts',filter:['==',['get','precinct_id'],selected],paint:{'line-color':'#111','line-width':3}});const basemap = $('#basemap');
basemap.disabled = false;
basemap.onchange = () => {
  const showAerial = basemap.value === 'aerial';
  if (showAerial && !map.getSource('county-aerial')) {
    registerClippedAerial();
    map.addSource('county-aerial', {
      type: 'raster',
      tiles: ['county-aerial://{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 20,
      bounds: [-97.60, 32.54, -96.99, 33.01],
      attribution: '2025 aerial imagery © Tarrant County / TC911'
    });
    map.addLayer({ id: 'county-aerial', type: 'raster', source: 'county-aerial' }, 'fill');
  }
  if (map.getLayer('county-aerial')) {
    map.setLayoutProperty('county-aerial', 'visibility', showAerial ? 'visible' : 'none');
  }
  $('#aerial-opacity').disabled = !showAerial;
  if (!$('#precinct-opacity').dataset.adjusted) {
    $('#precinct-opacity').value = showAerial ? 42 : 75;
    map.setPaintProperty('fill', 'fill-opacity', Number($('#precinct-opacity').value) / 100);
  }
};
map.on('click', event => {
  const [precinct] = map.queryRenderedFeatures(event.point, { layers: ['fill'] });
  select(precinct?.properties.precinct_id ?? '');
});refresh();$('#status').textContent='Gray = no valid contest votes for this method.';});}catch{map=null;fallback();}$('#measure').onchange = () => {
  const scope = $('#vote-scope');
  scope.querySelector('option[value="total"]').disabled = measure() !== 'density';
  if (measure() === 'density' || scope.value === 'total') scope.value = 'winner';
  refresh();
};
$('#vote-scope').onchange = refresh;
$('#precinct-opacity').oninput = event => {
  event.target.dataset.adjusted = 'true';
  const opacity = Number(event.target.value) / 100;
  if (map?.getLayer('fill')) map.setPaintProperty('fill','fill-opacity',opacity);
  else document.querySelectorAll('#map path[data-id]').forEach(path => path.setAttribute('fill-opacity',opacity));
};
$('#aerial-opacity').oninput = event => {
  if (map?.getLayer('county-aerial')) map.setPaintProperty('county-aerial','raster-opacity',Number(event.target.value)/100);
};
$('#contest').onchange=choose;$('#choice').onchange=refresh;$('#method').onchange=refresh;$('#precinct').onchange=()=>select($('#precinct').value);$('#clear').onclick=()=>select('');}catch(e){$('#notice').textContent=e.message;}}
document.addEventListener('click', event => {
  if (!selected) return;
  const target = event.target;
  if (target.closest('#plot circle, #precinct')) return;
  if (target.closest('#map')) {
    if (target.closest('.maplibregl-canvas, path[data-id]')) return;
  }
  select('');
}, { capture: true });

start();
