import { polygons } from './metrics.js';
import { boundsFor } from './view.js';
import { SPECIAL } from './color.js';

const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs={}) {
  const element=document.createElementNS(ns,tag);
  for (const [name,value] of Object.entries(attrs)) element.setAttribute(name,value);
  return element;
}

export function createFallback(host, geometry, events) {
  host.replaceChildren();
  host.classList.add('fallback-map');
  const root = svg('svg',{'aria-label':'Precinct map without WebGL'});
  const defs = svg('defs');
  for (const status of ['tie','zero','unavailable']) {
    const pattern=svg('pattern',{id:'fallback-'+status,width:8,height:8,patternUnits:'userSpaceOnUse'});
    pattern.append(svg('rect',{width:8,height:8,fill:SPECIAL[status].color}),svg('path',{
      d:status==='tie'?'M0 0L8 8M0 8L8 0':status==='zero'?'M0 8L8 0':'M4 4h1',
      stroke:status==='tie'?'#adadad':'#888',
    }));
    defs.append(pattern);
  }
  const group=svg('g'), pin=svg('path',{'pointer-events':'none',fill:'none',stroke:'#111','stroke-width':2.5});
  root.append(defs,group,pin);
  host.append(root);
  const county = boundsFor(geometry.map(row=>row.feature));
  let frame=county, view, state, hovered, paths=new Map();
  const resize=new ResizeObserver(()=>{if(view) draw();});
  resize.observe(host);
  function hover(id) {
    if (hovered) paths.get(hovered)?.removeAttribute('data-hover');
    hovered=id;
    if (id) paths.get(id)?.setAttribute('data-hover','true');
  }
  function paint() {
    for (const row of view.rows) {
      const path=paths.get(row.precinct);
      path.setAttribute('fill',SPECIAL[row.status]?.pattern ? 'url(#fallback-'+row.status+')' : row.color);
      path.setAttribute('fill-opacity',state.shading/100);
      path.setAttribute('stroke-opacity',row.result?.cast ? '.6':'.15');
      path.setAttribute('pointer-events',row.result?'all':'none');
    }
    pin.setAttribute('d',paths.get(state.precinct)?.getAttribute('d')||'');
  }
  function draw() {
    const width=host.clientWidth,height=host.clientHeight;
    root.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const [[west,south],[east,north]]=frame, cosine=Math.cos((south+north)*Math.PI/360);
    const scale=Math.min((width-48)/((east-west)*cosine),(height-48)/(north-south));
    const left=(width-(east-west)*cosine*scale)/2, bottom=(height+(north-south)*scale)/2;
    paths=new Map();
    group.replaceChildren(...view.rows.map(row=>{
      const d=polygons(row.feature.geometry).flatMap(poly=>poly.map(ring=>ring.map(([x,y],i)=>
        `${i?'L':'M'}${left+(x-west)*cosine*scale},${bottom-(y-south)*scale}`).join(' ')+'Z')).join(' ');
      const path=svg('path',{d,'fill-rule':'evenodd',stroke:'#fff','stroke-width':.6,'data-map-precinct':row.precinct});
      paths.set(row.precinct,path);
      return path;
    }));
    paint();
    hover(hovered);
  }
  root.addEventListener('pointermove',event=>events.hover(event.target.dataset.mapPrecinct||'',event));
  root.addEventListener('pointerleave',()=>events.hover(''));
  root.addEventListener('click',event=>events.pin(event.target.dataset.mapPrecinct||''));
  function fit(bounds) {frame=bounds;draw();}
  return {aerialAvailable:false,hover,
    update(nextView,nextState) {const first=!view;view=nextView;state=nextState;if(first) draw();else paint();},
    fitCounty:()=>fit(county),fitContest:bounds=>fit(bounds||county),fitPrecinct:row=>fit(row.bounds),
  };
}
