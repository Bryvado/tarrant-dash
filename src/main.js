import './style.css';
import { createStore } from './state.js';
import { prepareGeometry, buildView } from './view.js';
import { setupControls } from './controls.js';
import { createMap } from './map.js';
import { createFallback } from './fallback.js';
import { createChart } from './chart.js';
import { setupAnalytics } from './analytics.js';
import { renderLegend, renderComparisonLegend, markLegend, legendKey } from './legend.js';
import { renderSummary, renderPrecinct, renderTooltip, renderComparisonTooltip } from './panel.js';
import { number } from './metrics.js';

const app=document.querySelector('#app');
app.innerHTML=`
  <header class="top-bar"><div class="brand"><h1>Tarrant precinct workspace</h1><span class="muted">Nov. 3, 2026 general election</span></div><div class="status-line">
    <span class="unofficial">Unofficial</span>
    <details id="sources"><summary>Sources</summary><div class="sources-popover">
      <h2>Sources &amp; coverage</h2><p id="status-text"></p><p>Unofficial county returns. Current precinct boundaries are used for display. Local contests cover the Tarrant portion and may cover only part of a precinct.</p>
      <p><a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/precinct.pdf" target="_blank" rel="noopener">Nov. 5 precinct report</a> · <a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/cumulative.pdf" target="_blank" rel="noopener">Nov. 4 cumulative report</a></p>
      <p>Density uses the mapped area of the full precinct. Census profiles use 2020 population on <a href="https://data.capitol.texas.gov/dataset/vtds" target="_blank" rel="noopener">2024 Texas VTDs</a>. Voting-age population measures residents age 18 or older.</p>
      <p>Precinct chairs are from the <a href="https://tarrantdemocrats.org/precinct-chair-lookup/" target="_blank" rel="noopener">Tarrant County Democratic Party</a> and <a href="https://tarrantgop.org/precinct-chairs-resources/" target="_blank" rel="noopener">Tarrant County GOP</a> public rosters.</p>
    </div></details></div></header>
  <main class="workspace">
    <section class="map-pane" aria-label="Precinct map">
      <div id="map" class="map-loading" aria-busy="true" tabindex="0"></div>
      <div id="loading" role="status">Loading precinct map…</div>
      <div class="map-actions">
        <button id="whole" type="button" title="Show whole county" aria-label="Show whole county"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>

        <button id="drawer-toggle" type="button" aria-controls="analytics" aria-expanded="false">Analytics</button>
      </div>
      <details id="map-legend" class="map-legend"></details>
      <p id="fallback-note" class="fallback-note" hidden></p>
    </section>
    <div class="sheet-tabs" role="tablist" aria-label="Workspace panels"><button id="controls-tab" role="tab" aria-controls="controls" aria-selected="true">Controls</button><button id="precinct-tab" role="tab" aria-controls="profile" aria-selected="false">Precinct</button><button id="analytics-tab" role="tab" aria-controls="analytics" aria-selected="false">Charts</button></div>
    <div id="sheet-header"></div>
    <aside id="controls" class="controls" aria-label="Map controls"></aside>
    <aside id="analytics" class="analytics" aria-label="Analytics">
      <section id="totals" class="analytics-section summary-section" aria-label="Contest summary"></section>
      <section id="profile" class="analytics-section precinct-section" aria-label="Precinct details"></section>
      <section id="chart-section" class="analytics-section chart-section" aria-label="Precinct charts"><div class="chart-heading"><h2>Precinct charts</h2><label><input id="chart-log" type="checkbox"> Log</label></div>
        <div class="plot-controls">
          <label>View<select id="plot-mode"><option value="distribution">Distribution</option><option value="compare">Compare candidates</option><option value="census">Demographics</option></select></label>
          <label hidden>Candidate A · current map contest<select id="plot-a"></select></label>
          <label hidden>Comparison contest<select id="plot-race"></select></label>
          <label hidden>Candidate B<select id="plot-b"></select></label>
          <label hidden>Population group<select id="plot-group"></select></label>
        </div>
        <p id="chart-query" class="muted"></p>
        <svg id="plot" tabindex="0" role="listbox" aria-label="Precinct distribution"></svg>
        <p id="excluded" class="muted"></p><p id="plot-detail" aria-live="polite"></p></section>
    </aside>
  </main><div id="tooltip" class="tooltip" hidden></div><div id="announcement" class="sr-only" aria-live="polite"></div>`;
const $=id=>document.getElementById(id);

async function loadData(name) {
  const response=await fetch('./data/'+name);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return response.json();
}

async function start() {
  const [geo,data]=await Promise.all([loadData('precincts.geojson'),loadData('official.json')]);
  const geometry=prepareGeometry(geo), precincts=new Set(geometry.map(row=>row.precinct));
  const store=createStore(data.contests,precincts);
  let view, renderer, demographics, chairs, lastLegendView, lastLegendAerial, filterKey=null, hovered='', drawer=false;
  $('status-text').textContent=`Nov. 3, 2026 · ${number(geometry.length)} precincts · ${data.checks}/${data.checks} checks passed`;
  const syncControls=setupControls($('controls'),store,data.contests,precincts);
  $('precinct-picker').classList.add('map-search');
  $('map').parentElement.append($('precinct-picker'));
  const mobileLayout=matchMedia('(max-width:767px)');
  function moveSheetHeader(){
    if(mobileLayout.matches) $('sheet-header').append($('workspace-mode'),$('contest-picker'));
    else {
      $('controls').prepend($('workspace-mode'));
      $('primary-controls').prepend($('contest-picker'));
    }
  }
  mobileLayout.addEventListener('change',moveSheetHeader);moveSheetHeader();
  const legend=$('map-legend'), tooltip=$('tooltip');
  function ready() {
    $('map').classList.remove('map-loading');
    $('map').setAttribute('aria-busy','false');
    $('loading').hidden=true;
  }
  function pin(precinct,fly=false) {store.set({precinct},fly?'precinct':'pin');}
  function hover(precinct,event) {
    const row=view?.byId.get(precinct);
    if (!row?.result) precinct='';
    if (precinct!==hovered) {
      hovered=precinct;
      renderer?.hover(precinct);
      chart.hover(precinct);
      const comparison=analytics.comparison();
      markLegend(legend,precinct?(comparison ? comparison.keys.get(precinct) : legendKey(view,row)):null);
      if (precinct && comparison) {
        renderComparisonTooltip(tooltip,comparison,precinct);
      } else if (precinct) {
        renderTooltip(tooltip,view,row);
        const description=analytics.describe(precinct);
        if (description) {
          const line=document.createElement('p');
          line.textContent=description;
          tooltip.append(line);
        }
      }
    }
    tooltip.hidden=!precinct||!event||precinct===store.get().precinct;
    if (!tooltip.hidden) {
      const {offsetWidth:width,offsetHeight:height}=tooltip;
      const {clientX:x,clientY:y}=event;
      tooltip.style.left=Math.max(8,x+12+width<=innerWidth-8 ? x+12 : x-12-width)+'px';
      tooltip.style.top=Math.max(8,y+12+height<=innerHeight-8 ? y+12 : y-12-height)+'px';
    }
  }
  const events={ pin, hover, ready, fallback(reason) {
    renderer=createFallback($('map'),geometry,events);
    $('fallback-note').textContent=reason+' Precinct-only view.';
    $('fallback-note').hidden=false;
    render(store.get());
    ready();
  }};
  const chart=createChart($('plot'),$('excluded'),events);
  $('chart-log').onchange=()=>chart.log($('chart-log').checked);
  const analytics=setupAnalytics($('chart-section'),chart,data.contests,$('controls'),$('compare-map'),()=>{
    filterKey=null;
    hover('');
    const state=store.get();
    renderMap(state);
    updateProfile(state.precinct);
  });
  function updateProfile(id) {
    const description=analytics.comparison() && (analytics.describe(id) || 'No comparable vote share');
    renderPrecinct($('profile'),view,id,chairs,demographics,description);
    $('analytics').classList.toggle('has-pin',!!id);
    const clear=$('clear-precinct'),copy=$('copy-precinct');
    if(clear) clear.onclick=()=>pin('');
    if(copy) copy.onclick=async()=>{
      try { const original=copy.innerHTML;await navigator.clipboard.writeText(location.href); copy.textContent='✓'; setTimeout(()=>{copy.innerHTML=original;},1500); }
      catch { copy.title='Could not copy link'; }
    };
  }
  function setLegendFilter(key) {
    filterKey=filterKey===key ? null : key;
    renderMap(store.get());
  }
  legend.addEventListener('click',event=>{
    const button=event.target.closest('button[data-filter-key]');
    if(!button)return;
    event.preventDefault();
    setLegendFilter(button.dataset.filterKey);
  });
  function renderMap(state) {
    const comparison=analytics.comparison();
    const mapView=comparison?.view ?? view;
    const aerial=state.basemap==='aerial' && renderer.aerialAvailable;
    if (mapView!==lastLegendView || aerial!==lastLegendAerial) {
      if (comparison) renderComparisonLegend(legend,comparison,state.method,aerial);
      else renderLegend(legend,view,aerial);
      lastLegendView=mapView;
      lastLegendAerial=aerial;
    }
    const matches=filterKey==null ? null : new Set(mapView.rows.filter(row=>
      (comparison ? comparison.keys.get(row.precinct) : legendKey(view,row))===filterKey
    ).map(row=>row.precinct));
    for(const button of legend.querySelectorAll('[data-filter-key]')){
      const active=button.dataset.filterKey===filterKey;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    chart.filter(matches,mapView.byId);
    const filtered=matches ? {...mapView,features:{...mapView.features,features:mapView.features.features.map(feature=>({
      ...feature,properties:{...feature.properties,dim:matches.has(feature.properties.precinct)?1:.25},
    }))},rows:mapView.rows.map(row=>({...row,dim:matches.has(row.precinct)?1:.25}))} : mapView;
    renderer.update(filtered,state);
  }
  loadData('chairs.json').then(data=>{
    chairs=data;
    updateProfile(store.get().precinct);
  }).catch(()=>{
    chairs=null;
    updateProfile(store.get().precinct);
  });
  loadData('demographics.json').then(data=>{
    demographics=data;
    analytics.setDemographics(demographics);
    updateProfile(store.get().precinct);
  }).catch(()=>{});
  function render(state,previous,source) {
    const changed=!view||['contest','choice','method','scope','measure'].some(key=>state[key]!==previous?.[key]);
    if (changed) {
      filterKey=null;
      hover('');
      view=buildView(geometry,data.contests[state.contest],state);
      renderSummary($('totals'),view);
    }
    syncControls(state,view,renderer.aerialAvailable);
    analytics.update(view,state);
    renderMap(state);
    if (changed || state.precinct!==previous?.precinct) {
      updateProfile(state.precinct);
      chart.pin(state.precinct);
      if(state.precinct===hovered)tooltip.hidden=true;
      const pinned=view.byId.get(state.precinct);
      const comparison=analytics.comparison();
      if(pinned)markLegend(legend,comparison ? comparison.keys.get(state.precinct) : legendKey(view,pinned));
    }
    if ((!previous || source==='hash' || source==='precinct') && state.precinct) renderer.fitPrecinct(view.byId.get(state.precinct));
    else if (!previous || state.contest!==previous.contest) {
      if (view.included.length<geometry.length) renderer.fitContest(view.bounds);
      else renderer.fitCounty();
    }
    if (state.precinct!==previous?.precinct) {
      const row=view.byId.get(state.precinct);
      $('announcement').textContent=row ? `Precinct ${row.precinct} pinned. ${number(row.total)} valid votes, ${number(row.ballots)} ballots.` : 'Precinct selection cleared.';
    }
  }
  try {renderer=createMap($('map'),geometry,events);render(store.get());}
  catch {events.fallback('WebGL is unavailable.');}
  store.subscribe(render);
  $('whole').onclick=()=>renderer.fitCounty();
  $('drawer-toggle').onclick=()=>{
    drawer=!drawer;
    app.classList.toggle('drawer-open',drawer);
    $('drawer-toggle').setAttribute('aria-expanded',String(drawer));
  };
  function showTab(analytics) {
    if(matchMedia('(min-width:768px) and (max-width:1100px)').matches){
      drawer=analytics;app.classList.toggle('drawer-open',drawer);
      $('drawer-toggle').setAttribute('aria-expanded',String(drawer));
    }
    app.classList.remove('precinct-tab');
    $('precinct-tab').setAttribute('aria-selected','false');
    app.classList.toggle('analytics-tab',analytics);
    $('controls-tab').setAttribute('aria-selected',String(!analytics));
    $('analytics-tab').setAttribute('aria-selected',String(analytics));
  }
  $('compare-map').addEventListener('click',()=>{
    if ($('compare-map').getAttribute('aria-pressed')==='true') {
      showTab(false);
      $('plot-a').focus();
    }
  });
  $('precinct-tab').onclick=()=>{
    showTab(false);app.classList.add('precinct-tab');
    if(matchMedia('(min-width:768px) and (max-width:1100px)').matches){
      drawer=true;app.classList.add('drawer-open');$('drawer-toggle').setAttribute('aria-expanded','true');
    }
    $('controls-tab').setAttribute('aria-selected','false');
    $('precinct-tab').setAttribute('aria-selected','true');
  };
  $('controls-tab').onclick=()=>showTab(false);
  $('analytics-tab').onclick=()=>showTab(true);
  const tabs=[$('controls-tab'),$('precinct-tab'),$('analytics-tab')];
  for(const [index,tab] of tabs.entries())tab.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    const next=tabs[(index+(event.key==='ArrowRight'?1:2))%3];
    next.click();next.focus();
  };
  document.addEventListener('click',event=>{
    const target=event.target;
    if (!target.closest('#sources')) $('sources').open=false;
    if (target.closest('[data-chart-precinct],[data-map-precinct],.maplibregl-canvas,#precinct-picker,.plot-controls,#compare-map,#workspace-mode,#profile,#map-legend')) return;
    pin('');
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape') {filterKey=null;hover('');pin('');renderMap(store.get());}});
}

start().catch(error=>{$('loading').textContent=error.message;});
