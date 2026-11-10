import { contextBounds } from './shift.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import countyMask from './county-mask.json';
import { polygons } from './metrics.js';
import { SPECIAL } from './color.js';
import { boundsFor } from './view.js';

function registerClippedAerial(geometry) {
  const shapes = geometry.flatMap(row => polygons(row.feature.geometry)).map(polygon => {
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

const edges = polygons(countyMask)[0].slice(1);
const countyEdge = {
  type:'Feature', properties:{},
  geometry:{type:'MultiLineString',coordinates:edges},
};
const zoomLine = ['step',['zoom'],.3,12,.5];
const withinContest = ['!=',['get','status'],'outside'];

function hatch(color, type) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0,0,8,8);
  ctx.strokeStyle = type==='tie' ? '#21342c' : '#858580';
  ctx.lineWidth = 1;
  if (type==='unavailable') ctx.strokeRect(3,3,1,1);
  else {
    ctx.beginPath();
    for (const x of [-8,0,8]) {
      ctx.moveTo(x,8); ctx.lineTo(x+8,0);
      if (type==='tie') {ctx.moveTo(x,0);ctx.lineTo(x+8,8);}
    }
    ctx.stroke();
  }
  return ctx.getImageData(0,0,8,8);
}

export function createMap(host, geometry, events) {
  const countyBounds = boundsFor(geometry.map(row=>row.feature));
  const [[w,s],[e,n]] = countyBounds;
  const pad = .45;
  let view, state, loaded = false, hovered, failed = false, frame = countyBounds;
  const map = new maplibregl.Map({
    container:host, style:'https://tiles.openfreemap.org/styles/positron',
    bounds:countyBounds, fitBoundsOptions:{padding:24},
    maxBounds:[[w-pad,s-pad],[e+pad,n+pad]], renderWorldCopies:false,
    attributionControl:false,
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
  function minimum() {
    const camera = map.cameraForBounds(countyBounds,{padding:24});
    const shorter = Math.min(host.clientWidth,host.clientHeight);
    if (camera && shorter>240) map.setMinZoom(Math.max(0,camera.zoom + Math.log2(.8*shorter/(shorter-48))));
  }
  function fit(bounds, animate = true, maxZoom = 17) {
    frame = bounds;
    if (loaded) map.fitBounds(bounds,{padding:24,maxZoom,duration:animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 0});
  }
  const resize = new ResizeObserver(() => {
    if (!loaded) return;
    map.resize();
    minimum();
    fit(frame,false);
  });
  resize.observe(host);
  let symbolLayer;
  function ready() {
    if (failed) return;
    clearTimeout(timeout);
    const attribution = host.querySelector('.maplibregl-ctrl-attrib');
    attribution?.classList.remove('maplibregl-compact-show');
    attribution?.querySelector('summary')?.setAttribute('aria-expanded','false');
    events.ready();
  }
  function layers() {
    if (failed) return;
    symbolLayer = map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
    map.addSource('precincts',{type:'geojson',data:view.features});
    map.addSource('county-mask',{type:'geojson',data:{type:'Feature',properties:{},geometry:countyMask},tolerance:0});
    map.addSource('county-edge',{type:'geojson',data:countyEdge,tolerance:0});
    map.addLayer({id:'precinct-fill',type:'fill',source:'precincts',filter:withinContest,
      paint:{'fill-color':['get','color'],'fill-opacity':state.shading/100}},symbolLayer);
    for (const status of ['zero','tie','unavailable']) {
      map.addImage('hatch-'+status,hatch(SPECIAL[status].color,status));
      map.addLayer({id:'precinct-'+status,type:'fill',source:'precincts',
        filter:['==',['get','status'],status],
        paint:{'fill-pattern':'hatch-'+status,'fill-opacity':state.shading/100}},symbolLayer);
    }
    map.addLayer({id:'precinct-outline',type:'line',source:'precincts',
      paint:{'line-color':'#fff','line-width':['step',['zoom'],.3,12,.5],
        'line-opacity':['interpolate',['linear'],['zoom'],9,['case',withinContest,.30,.15],14,['case',withinContest,.70,.15]]}},symbolLayer);
    map.addLayer({id:'county-edge',type:'line',source:'county-edge',
      paint:{'line-color':'#3a4a42','line-width':1.5}},symbolLayer);
    map.addLayer({id:'county-void',type:'fill',source:'county-mask',paint:{'fill-color':'#e4e3de','fill-antialias':false}});
    map.addLayer({id:'precinct-hover',type:'line',source:'precincts',filter:withinContest,
      paint:{'line-color':'#21342c','line-width':['case',['boolean',['feature-state','hover'],false],2,0]}});
    for (const [id,color,width] of [['pin-case','#fff',4],['pin','#835613',2]]) map.addLayer({
      id,type:'line',source:'precincts',filter:['==',['get','precinct'],''],
      paint:{'line-color':color,'line-width':width},
    });
    loaded = true;
    minimum();
    fit(frame,false);
    paint();
    map.once('idle',ready);
  }
  const timeout = setTimeout(() => {
    if (failed) return;
    failed = true;
    resize.disconnect();
    map.remove();
    events.fallback('The street basemap did not finish loading.');
  },18000);
  map.once('load',layers);
  map.on('move', () => {
    if (!loaded) return;
    const top = map.project([e,n]), bottom = map.project([e,s]);
    const right = Math.max(8,host.clientWidth-top.x+5);
    const nav = host.querySelector('.maplibregl-ctrl-top-right');
    const credits = host.querySelector('.maplibregl-ctrl-bottom-right');
    if (nav) {
      nav.style.right = Math.min(host.clientWidth-48,right)+'px';
      nav.style.top = Math.max(8,Math.min(host.clientHeight-72,top.y+5))+'px';
    }
    if (credits) {
      credits.style.right = Math.min(host.clientWidth/3,right)+'px';
      credits.style.bottom = Math.max(8,Math.min(host.clientHeight-45,host.clientHeight-bottom.y+5))+'px';
    }
  });

  function paint() {
    if (!loaded) return;
    const aerial = state.basemap === 'aerial';
    if (aerial && !map.getSource('county-aerial')) {
      registerClippedAerial(geometry);
      map.addSource('county-aerial',{type:'raster',tiles:['county-aerial://{z}/{y}/{x}'],
        tileSize:256,maxzoom:20,bounds:[w,s,e,n],attribution:'2025 aerial imagery © Tarrant County / TC911'});
      map.addLayer({id:'county-aerial',type:'raster',source:'county-aerial'},'precinct-fill');
    }
    if (map.getLayer('county-aerial')) {
      map.setLayoutProperty('county-aerial','visibility',aerial?'visible':'none');
      map.setPaintProperty('county-aerial','raster-opacity',state.aerial/100);
    }
    const outlines = state.outlines;
    for (const id of ['precinct-fill','precinct-zero','precinct-tie','precinct-unavailable']) {
      map.setPaintProperty(id,'fill-opacity',outlines ? 0 : ['*',state.shading/100,['coalesce',['get','dim'],1]]);
    }
    map.setPaintProperty('precinct-outline','line-color',outlines ? ['case',withinContest,['get','color'],'#fff'] : '#fff');
    map.setPaintProperty('precinct-outline','line-width',outlines ? 1.25 : zoomLine);
    map.setPaintProperty('precinct-outline','line-opacity',outlines ?
      ['case',withinContest,state.shading/100,.15] :
      ['interpolate',['linear'],['zoom'],9,['case',withinContest,.30,.15],14,['case',withinContest,.70,.15]]);
    for (const id of ['pin-case','pin']) map.setFilter(id,['==',['get','precinct'],state.precinct]);
  }
  function hover(precinct) {
    if (!loaded) return;
    if (hovered) map.removeFeatureState({source:'precincts',id:hovered.id},'hover');
    hovered = view.byId.get(precinct);
    if (hovered) map.setFeatureState({source:'precincts',id:hovered.id},{hover:true});
  }
  function hit(event) {
    if (!loaded) return '';
    return map.queryRenderedFeatures(event.point,{layers:['precinct-fill']})[0]?.properties.precinct ?? '';
  }
  map.on('mousemove',event => {
    const id = hit(event);
    map.getCanvas().style.cursor = id?'pointer':'';
    events.hover(id,event.originalEvent);
  });
  map.getCanvas().addEventListener('mouseleave',()=>events.hover(''));
  map.on('click',event=>events.pin(hit(event)));
  return {
    aerialAvailable:true,
    update(nextView,nextState) {
      if (loaded && view!==nextView) map.getSource('precincts').setData(nextView.features);
      view=nextView;
      state=nextState;
      paint();
    },
    hover,
    fitCounty:()=>fit(countyBounds),
    fitContest:bounds=>fit(bounds||countyBounds,true,13),
    fitPrecinct:row=>fit(contextBounds(row.bounds),true,13),
  };
}
