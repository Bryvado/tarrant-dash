import './style.css';
import { createStore } from './state.js';
import { prepareGeometry, buildView } from './view.js';
import { setupControls } from './controls.js';
import { createMap } from './map.js';
import { createFallback } from './fallback.js';
import { createChart } from './chart.js';
import { setupAnalytics } from './analytics.js';
import { renderLegend, markLegend, legendKey } from './legend.js';
import { renderSummary, renderPrecinct, renderTooltip } from './panel.js';
import { number } from './metrics.js';

const app=document.querySelector('#app');
app.innerHTML=`
  <header class="top-bar"><h1>Tarrant precinct workspace</h1><div class="status-line">
    <span class="unofficial">Unofficial</span><span id="status-text">Nov. 3, 2026</span>
    <details id="sources"><summary>Sources</summary><div class="sources-popover">
      <h2>Sources &amp; coverage</h2><p>Unofficial county returns. Current precinct boundaries are used for display. Local contests cover the Tarrant portion and may cover only part of a precinct.</p>
      <p><a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/precinct.pdf" target="_blank" rel="noopener">Nov. 5 precinct report</a> · <a href="https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/cumulative.pdf" target="_blank" rel="noopener">Nov. 4 cumulative report</a></p>
      <p>Density uses the mapped area of the full precinct. Census profiles use 2020 population on <a href="https://data.capitol.texas.gov/dataset/vtds" target="_blank" rel="noopener">2024 Texas VTDs</a>. Voting-age population measures residents age 18 or older.</p>
      <p>Precinct chairs are from the <a href="https://tarrantdemocrats.org/precinct-chair-lookup/" target="_blank" rel="noopener">Tarrant County Democratic Party</a> and <a href="https://tarrantgop.org/precinct-chairs-resources/" target="_blank" rel="noopener">Tarrant County GOP</a> public rosters.</p>
    </div></details></div></header>
  <main class="workspace">
    <section class="map-pane" aria-label="Precinct map">
      <div id="map" class="map-loading" aria-busy="true"></div>
      <div id="loading" role="status">Loading precinct map…</div>
      <div class="map-actions"><button id="whole" type="button">Show whole county</button><button id="drawer-toggle" type="button" aria-controls="analytics" aria-expanded="false">Analytics</button></div>
      <details id="map-legend" class="map-legend" open></details>
      <p id="fallback-note" class="fallback-note" hidden></p>
    </section>
    <div class="sheet-tabs" role="tablist" aria-label="Workspace panels"><button id="controls-tab" role="tab" aria-controls="controls" aria-selected="true">Controls</button><button id="analytics-tab" role="tab" aria-controls="analytics" aria-selected="false">Analytics</button></div>
    <aside id="controls" class="controls" aria-label="Map controls"></aside>
    <aside id="analytics" class="analytics" aria-label="Analytics">
      <section id="totals" class="analytics-section summary-section" aria-label="Contest summary"></section>
      <section id="profile" class="analytics-section precinct-section" aria-label="Precinct details"></section>
      <section id="chart-section" class="analytics-section chart-section" aria-label="Precinct charts"><h2>Precinct charts</h2>
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
  let view, renderer, demographics, chairs, hovered='', drawer=false;
  $('status-text').textContent=`Nov. 3, 2026 · ${number(geometry.length)} precincts · ${data.checks}/${data.checks} checks passed`;
  const syncControls=setupControls($('controls'),store,data.contests,precincts);
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
      markLegend(legend,precinct?legendKey(view,row):null);
      if (precinct) {
        renderTooltip(tooltip,view,row);
        const comparison=analytics.describe(precinct);
        if (comparison) {
          const line=document.createElement('p');
          line.textContent=comparison;
          tooltip.append(line);
        }
      }
    }
    tooltip.hidden=!precinct||!event;
    if (!tooltip.hidden) {
      tooltip.style.left=Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-8,event.clientX+14))+'px';
      tooltip.style.top=Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,event.clientY+14))+'px';
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
  const analytics=setupAnalytics($('chart-section'),chart,data.contests);
  function updateProfile(id) {renderPrecinct($('profile'),view,id,chairs,demographics);}
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
      hover('');
      view=buildView(geometry,data.contests[state.contest],state);
      renderSummary($('totals'),view);
    }
    if (changed || state.basemap!==previous?.basemap || !previous) renderLegend(legend,view,state.basemap==='aerial'&&renderer.aerialAvailable);
    syncControls(state,view,renderer.aerialAvailable);
    renderer.update(view,state);
    analytics.update(view,state);
    if (changed || state.precinct!==previous?.precinct) {
      updateProfile(state.precinct);
      chart.pin(state.precinct);
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
    app.classList.toggle('analytics-tab',analytics);
    $('controls-tab').setAttribute('aria-selected',String(!analytics));
    $('analytics-tab').setAttribute('aria-selected',String(analytics));
  }
  $('controls-tab').onclick=()=>showTab(false);
  $('analytics-tab').onclick=()=>showTab(true);
  $('controls-tab').onkeydown=$('analytics-tab').onkeydown=event=>{
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const analytics=event.target.id==='controls-tab';
    showTab(analytics);
    $(analytics?'analytics-tab':'controls-tab').focus();
  };
  document.addEventListener('click',event=>{
    const target=event.target;
    if (!target.closest('#sources')) $('sources').open=false;
    if (target.closest('[data-chart-precinct],[data-map-precinct],.maplibregl-canvas,#precinct-picker,.plot-controls')) return;
    pin('');
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape') {hover('');pin('');}});
}

start().catch(error=>{$('loading').textContent=error.message;});
