import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import {margin,share,lean,validate} from './metrics.js';
const $=s=>document.querySelector(s);
$('#app').innerHTML=`<header><div><small>TARRANT COUNTY • RESEARCH</small><h1>Tarrant precinct workspace</h1></div><span class="pill">OpenFreeMap</span></header><div class="notice">Demonstration only · Synthetic precincts and votes. Import validated county data before analysis.</div><main><aside><h2>Explore</h2><label>Election<select id="election"></select></label><p id="contest"></p><label>Map measure<select id="metric"><option value="margin">Two-party margin</option><option value="lean">Lean relative to county</option><option value="turnout">Turnout</option></select></label><label>Fill opacity<input id="opacity" type="range" min="0.1" max="1" step="0.05" value="0.75"></label><label><input id="labels" type="checkbox" checked> Precinct labels</label><div class="legend"><span>Republican</span><span>Democratic</span></div><p id="status" role="status">Loading data…</p><button id="clear">Clear selection</button><button id="export">Export displayed data</button><section id="profile"><h2>Precinct profile</h2><p>Select a precinct on the map or chart.</p></section><section><h2>Precinct chairs</h2><p>Democratic and Republican chair records can be added by precinct and boundary version.</p><div id="chairs">No chair data loaded.</div></section></aside><section class="workspace"><div id="totals"></div><div id="map" aria-label="Precinct map"></div><section class="chart"><h2>Precinct comparison</h2><p>Turnout versus two-party margin · Select a point to highlight its precinct.</p><svg id="plot" viewBox="0 0 800 240" role="group" aria-label="Interactive precinct scatterplot"></svg></section></section></main>`;
let map,data,chairs=[],selected=null,countyD=0,countyR=0;
const pct=x=>x===null?'—':`${(x*100).toFixed(1)}%`;
const fmt=n=>n.toLocaleString();
function select(id){selected=id;render();document.querySelectorAll('#fallback-map path').forEach(e=>e.setAttribute('stroke-width',e.dataset.id===id?'4':'1'));if(map?.getLayer('selected'))map.setFilter('selected',['==',['get','precinct_id'],id||'']);}
function render(){
 const p=data.features.find(f=>f.properties.precinct_id===selected)?.properties;
 $('#profile').replaceChildren();const h=document.createElement('h2');h.textContent=p?p.precinct_id:'Precinct profile';$('#profile').append(h);
 const detail=document.createElement('p');detail.textContent=p?`Democratic ${fmt(p.dem_votes)} · Republican ${fmt(p.rep_votes)} · Other ${fmt(p.other_votes)}. Turnout ${pct(share(p.ballots,p.registered))}.`:'Select a precinct on the map or chart.';$('#profile').append(detail);
 $('#chairs').textContent=p?chairs.filter(c=>c.precinct_id===p.precinct_id&&c.boundary_version===p.boundary_version).map(c=>`${c.party}: ${c.name||c.status}`).join(' · ')||'No chair records for this precinct.':'No precinct selected.';
 const svg=$('#plot');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
 function el(tag,attrs,text){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;svg.append(e);return e;}
 el('line',{x1:55,y1:205,x2:760,y2:205,stroke:'#aaa'});el('line',{x1:408,y1:20,x2:408,y2:205,stroke:'#ccc'});
 el('text',{x:55,y:230},'R +100');el('text',{x:370,y:230},'Even');el('text',{x:710,y:230},'D +100');el('text',{x:5,y:25},'100%');el('text',{x:15,y:205},'0%');
 data.features.forEach(f=>{const q=f.properties,m=margin(q.dem_votes,q.rep_votes),t=share(q.ballots,q.registered);if(m===null||t===null)return;
 const c=el('circle',{cx:55+(m+1)/2*705,cy:205-t*180,r:selected===q.precinct_id?9:6,fill:m<0?'#ca5059':'#407db8',stroke:selected===q.precinct_id?'#111':'white','stroke-width':2,tabindex:0,role:'button','aria-label':`${q.precinct_id}, margin ${pct(m)}, turnout ${pct(t)}`});
 const title=document.createElementNS(ns,'title');title.textContent=c.getAttribute('aria-label');c.append(title);c.onclick=()=>select(q.precinct_id);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(q.precinct_id);}};
 });
}
function paint(){if(!map?.getLayer('precincts'))return;const metric=$('#metric').value;const ramp=metric==='turnout'?['interpolate',['linear'],['coalesce',['get','turnout'],0],0,'#f0f5ee',.5,'#8cb6a0',1,'#145b46']:['interpolate',['linear'],['coalesce',['get',metric],0],-1,'#a82b42',-.2,'#df9198',0,'#f4f1ec',.2,'#8bb8db',1,'#125487'];map.setPaintProperty('precincts','fill-color',ramp);$('.legend').style.background=metric==='turnout'?'linear-gradient(90deg,#f0f5ee,#145b46)':'';$('.legend').children[0].textContent=metric==='turnout'?'0%':'Republican';$('.legend').children[1].textContent=metric==='turnout'?'100%':'Democratic';}
async function json(path){const r=await fetch(path);if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);return r.json();}
async function load(election){
 data=await json(`./data/${election.file}`);const errors=validate(data);if(errors.length)throw new Error(errors.join('; '));selected=null;
 countyD=data.features.reduce((s,f)=>s+f.properties.dem_votes,0);countyR=data.features.reduce((s,f)=>s+f.properties.rep_votes,0);
 data.features.forEach(f=>{const p=f.properties;p.margin=margin(p.dem_votes,p.rep_votes);p.lean=lean(p.dem_votes,p.rep_votes,countyD,countyR);p.turnout=share(p.ballots,p.registered);});
 $('#contest').textContent=election.contest;$('#status').textContent=`${data.features.length} precincts · ${election.status}`;$('#totals').textContent=`Democratic ${fmt(countyD)}  /  Republican ${fmt(countyR)}  ·  Two-party D share ${pct(share(countyD,countyD+countyR))}`;
 if(map?.getSource('precincts')){map.getSource('precincts').setData(data);select(null);}render();
}
function fallback(){
 const ns='http://www.w3.org/2000/svg';const host=$('#map');host.replaceChildren();
 const svg=document.createElementNS(ns,'svg');svg.id='fallback-map';svg.setAttribute('viewBox','0 0 800 400');svg.setAttribute('aria-label','Selectable precinct shapes; basemap unavailable');svg.style.cssText='width:100%;height:100%;background:#eaf0e8';
 const coordinates=data.features.flatMap(f=>f.geometry.type==='Polygon'?f.geometry.coordinates.flat():f.geometry.coordinates.flat(2));
 const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const scale=Math.min(700/(xmax-xmin||1),300/(ymax-ymin||1));
 for(const f of data.features){const p=f.properties,shape=document.createElementNS(ns,'path');const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 shape.setAttribute('d',polygons.flatMap(poly=>poly.map(r=>r.map((c,i)=>`${i?'L':'M'}${50+(c[0]-xmin)*scale},${350-(c[1]-ymin)*scale}`).join(' ')+' Z')).join(' '));
 const metric=$('#metric').value;shape.setAttribute('fill',metric==='turnout'?'#6eab8b':p[metric]<0?'#cf7c86':'#77a9d0');shape.setAttribute('stroke','#254d3c');shape.setAttribute('stroke-width',selected===p.precinct_id?'4':'1');shape.setAttribute('fill-rule','evenodd');shape.dataset.id=p.precinct_id;shape.setAttribute('tabindex','0');shape.setAttribute('role','button');shape.setAttribute('aria-label',`Map precinct ${p.precinct_id}`);shape.onclick=()=>select(p.precinct_id);shape.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.precinct_id);}};svg.append(shape);}
 host.append(svg);$('#status').textContent='WebGL unavailable: showing selectable precinct shapes without the basemap.';
}
async function initialize(){
try{
 const manifest=await json('./data/manifest.json');chairs=await json(`./data/${manifest.chairs_file}`);
 if(manifest.mode!=='demo')$('.notice').textContent='Tarrant County election research workspace.';
 manifest.elections.forEach(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.name;$('#election').append(o);});
 await load(manifest.elections[0]);$('#election').onchange=()=>load(manifest.elections.find(e=>e.id===$('#election').value)).catch(e=>$('#status').textContent=e.message);
 try { map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-97.29,32.77],zoom:9.5});map.addControl(new maplibregl.NavigationControl());
 map.on('error',()=>{$('#status').textContent='Map resource failed to load. Check your connection; chart and data remain available.';});
 map.on('load',()=>{map.addSource('precincts',{type:'geojson',data});map.addLayer({id:'precincts',type:'fill',source:'precincts',paint:{'fill-opacity':.75}});map.addLayer({id:'outlines',type:'line',source:'precincts',paint:{'line-color':'#64746f','line-width':1}});map.addLayer({id:'selected',type:'line',source:'precincts',filter:['==',['get','precinct_id'],selected||''],paint:{'line-color':'#102d25','line-width':4}});map.addLayer({id:'labels',type:'symbol',source:'precincts',layout:{'text-field':['get','precinct_id'],'text-size':11},paint:{'text-halo-color':'white','text-halo-width':2}});paint();map.on('click','precincts',e=>select(e.features[0].properties.precinct_id));map.on('mouseenter','precincts',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','precincts',()=>map.getCanvas().style.cursor='');});
 } catch(error) { map=null; fallback(); }
 $('#metric').onchange=()=>{paint();if(!map)fallback();};$('#opacity').oninput=()=>{if(map?.getLayer('precincts'))map.setPaintProperty('precincts','fill-opacity',Number($('#opacity').value));};$('#labels').onchange=()=>{if(map?.getLayer('labels'))map.setLayoutProperty('labels','visibility',$('#labels').checked?'visible':'none');};$('#clear').onclick=()=>select(null);
 $('#export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/geo+json'}));a.href=url;a.download='precincts.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}catch(e){$('#status').textContent=`Unable to load: ${e.message}`;}

}
initialize();
