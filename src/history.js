import { SHIFT_COLORS, SHIFT_LABELS, shiftBin, shiftColor, aboveThreshold } from './shift.js';
import { contestGroup } from './controls.js';
import { number } from './metrics.js';

export function partyResult(votes, choices, party) {
  if(!votes || !choices.some(c=>c.party===party))return null;
  const total=votes.reduce((s,n)=>s+n,0);
  if(!total)return null;
  const count=choices.reduce((s,c,i)=>s+(c.party===party?votes[i]:0),0);
  const rival=party==='DEM'?'REP':'DEM';
  const opposing=choices.reduce((s,c,i)=>s+(c.party===rival?votes[i]:0),0);
  return {votes:count,total,share:count/total,margin:choices.some(c=>c.party===rival)?(count-opposing)/total:null};
}
export function historyRows(before,after,party,reverse={}) {
  return [...new Set([...Object.keys(before.precincts),...Object.keys(after.precincts)])].map(key=>{
    const a=partyResult(before.precincts[key],before.choices,party),b=partyResult(after.precincts[key],after.choices,party);
    const matched=!key.startsWith('@') || Boolean(before.precincts[key] && after.precincts[key]);
    return {key,precinct:key.startsWith('@')?key.slice(1):reverse[key],a,b,
      shift:matched&&a&&b?b.share-a.share:null,
      marginShift:matched&&a?.margin!=null&&b?.margin!=null?b.margin-a.margin:null,
      voteChange:matched&&a&&b?b.votes-a.votes:null,
      status:!matched?'Boundary not matched':!a||!b?'No comparable votes':'Comparable'};
  });
}
const make=(tag,text,cls='')=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;e.className=cls;return e;};
const pct=v=>v==null?'—':(100*v).toFixed(1)+'%';
const pp=v=>v==null?'—':(v>0?'+':'')+(100*v).toFixed(1)+' pp';
const diff=v=>v==null?'—':(v>0?'+':'')+number(v);

export function setupHistory(host,current,store,events) {
  host.innerHTML=`<div class="history-resize" role="separator" aria-label="Resize historical drawer" aria-orientation="horizontal" tabindex="0"></div>
  <summary class="history-header"><b>Historical</b><button id="history-info" title="Methodology" aria-label="Historical comparison methodology">ⓘ</button><span id="history-sentence"></span><strong id="history-headline"></strong><span id="history-count" class="muted"></span></summary>
  <div id="history-methodology" class="history-methodology" hidden>All voting methods. Shares and margins use each contest’s valid votes; margin is selected party minus the other major party. Historical returns use common 2024 VTD geography. The 2026 crosswalk requires ≥98% area overlap in both directions; it is approximate, not an exact boundary match. No votes are interpolated. District footprints can change. The minimum applies to the selected party’s votes in both elections. <a href="https://data.capitol.texas.gov/dataset/comprehensive-election-datasets-compressed-format" target="_blank" rel="noopener">TLC source, 2012–2024</a>; county reports for 2026.</div>
  <div class="history-content"><div class="history-controls">
    <div class="history-pair"><label for="history-from-year">From</label><select id="history-from-year" aria-label="From election"></select><select id="history-from-race" aria-label="From contest"></select></div>
    <button id="history-swap" title="Swap From and To" aria-label="Swap From and To">⇅</button>
    <div class="history-pair"><label for="history-to-year">To</label><select id="history-to-year" aria-label="To election"></select><select id="history-to-race" aria-label="To contest"></select><button id="history-follow" title="Follow the map contest automatically" aria-label="Follow map contest" aria-pressed="true">↗</button></div>
    <div id="history-party" class="segments" aria-label="Historical party"><button value="DEM">Dem</button><button value="REP">Rep</button></div>
    <button id="history-more" aria-expanded="false">More</button><div class="history-extra">
    <label>Min. votes <input id="history-min" type="number" min="0" step="10" aria-label="Minimum party votes in both elections"></label>
    <label><input id="history-matched" type="checkbox" checked> Comparable only</label><button id="history-export" class="quiet">Export CSV</button></div>
    <svg id="history-scatter" viewBox="0 0 300 140" role="img" aria-label="From share versus To share, dashed equal-share line"></svg>
    <p class="history-note muted">Common 2024 VTD geography · ≥98% overlap required</p>
  </div><div class="history-table-pane"><div class="history-table-tools"><input id="history-search" type="search" placeholder="Find precinct…" aria-label="Find historical precinct"><div id="history-metric" class="segments"><button value="share">Share</button><button value="margin">Margin</button></div><button id="history-absolute" title="Sort by absolute change">Largest shifts</button><details class="history-columns"><summary>Columns</summary><label><input id="history-from-votes" type="checkbox"> From votes</label></details><span id="history-status" role="status"></span></div>
    <div class="history-scroll" tabindex="0" aria-label="Historical precinct results"><table><thead></thead><tbody></tbody></table></div></div></div>`;
  const $=id=>host.querySelector('#history-'+id), scroll=host.querySelector('.history-scroll');
  let state=store.get(),manifest,reverse={},rows=[],filtered=[],before,after,request=0,hovered='',lastPinned='',settings='',ready=false,mapCache=null,expanded='',profileRequest=0;
  const cache=new Map(), years=[2012,2014,2016,2018,2020,2022,2024,2026];
  const parse=s=>{const i=s.indexOf(':');return [Number(s.slice(0,i)),s.slice(i+1)];};
  const chosenNames=r=>r?.choices.filter(c=>c.party===state.hparty).map(c=>c.name).join(' / ')||'No candidate';
  const office=n=>n?.replace('United States Senator','U.S. Senate').replace('United States Representative','U.S. House')||'';
  const keyFor=r=>r.shift==null?'zero':!aboveThreshold(r,state.hmin)?'low':String(shiftBin(r.shift));
  const set=patch=>store.set(patch,'history');
  async function load(year){
    if(year===2026)return {contests:current.contests.map(r=>({name:r.name,choices:r.choices,precincts:Object.fromEntries(Object.entries(r.precincts).map(([p,r])=>[manifest.crosswalk[p]??'@'+p,r.votes.map(v=>v[3])]))}))};
    if(!cache.has(year))cache.set(year,fetch('./data/history-'+year+'.json').then(r=>{if(!r.ok)throw Error('Historical data could not load.');return r.json();}).catch(e=>{cache.delete(year);throw e;}));
    return cache.get(year);
  }
  for(const side of ['from','to']){
    $(side+'-year').replaceChildren(...years.map(y=>new Option(y,y)));
    $(side+'-year').onchange=()=>set({['h'+side]:$(side+'-year').value+':'+parse(state['h'+side])[1],hlink:side==='to'?false:state.hlink,hbin:''});
    $(side+'-race').onchange=()=>set({['h'+side]:$(side+'-year').value+':'+$(side+'-race').value,hlink:side==='to'?false:state.hlink,hbin:''});
  }
  function raceOptions(side,data,name){
    const select=$(side+'-race');select.replaceChildren();
    const groups=new Map(['Federal','Statewide','Legislative','County','Local'].map(g=>[g,[]]));
    data.contests.forEach(c=>{const g=contestGroup(c.name);groups.get(['Federal','Legislative','County'].includes(g)?g:['Judicial','Statewide executive'].includes(g)?'Statewide':'Local').push(c.name);});
    for(const [label,names]of groups)if(names.length){const group=make('optgroup');group.label=label;group.append(...names.map(n=>new Option(n,n)));select.append(group);}
    select.value=name;
  }
  async function refresh(){
    if(!manifest)return;const token=++request;ready=false;mapCache=null;$('status').textContent='Loading…';events.change?.();
    try {
      const [fy,fn]=parse(state.hfrom),[ty,tn]=parse(state.hto);
      const [a,b]=await Promise.all([load(fy),load(ty)]);if(token!==request)return;
      before=a.contests.find(c=>c.name===fn)||a.contests[0];after=b.contests.find(c=>c.name===tn)||b.contests[0];
      if(before.name!==fn||after.name!==tn){set({hfrom:fy+':'+before.name,hto:ty+':'+after.name});return;}
      raceOptions('from',a,before.name);raceOptions('to',b,after.name);
      rows=historyRows(before,after,state.hparty,reverse);ready=true;draw();events.change?.();
    }catch(e){if(token===request){$('status').textContent=e.message;rows=[];drawRows();}}
  }
  function columns(){const margin=state.hmetric==='margin';return [['key','Precinct'],['as','From '+(margin?'margin':'share')],['bs','To '+(margin?'margin':'share')],['shift',(margin?'Margin':'Share')+' shift'],['bv','To votes'],['voteChange','Vote change'],...($('from-votes').checked?[['av','From votes']]:[])];}
  function val(r,k){const margin=state.hmetric==='margin',values={abs:(margin?r.marginShift:r.shift)==null?null:Math.abs(margin?r.marginShift:r.shift),as:margin?r.a?.margin:r.a?.share,bs:margin?r.b?.margin:r.b?.share,shift:margin?r.marginShift:r.shift,av:r.a?.votes,bv:r.b?.votes};return Object.hasOwn(values,k)?values[k]:r[k];}
  function bar(v){const wrap=make('span',null,'history-shift-cell'),track=make('span',null,'history-shift-track'),fill=make('i');if(v!=null){fill.style.width=Math.min(50,Math.abs(v)/.3*50)+'%';fill.style.left=v<0?'auto':'50%';fill.style.right=v<0?'50%':'auto';fill.style.background=shiftColor(v);}track.append(fill);wrap.append(track,make('span',pp(v),'history-shift-number'));return wrap;}
  function draw(){
    if(!ready)return;mapCache=null;
    const search=$('search').value.trim(), comparable=rows.filter(r=>r.shift!=null), low=comparable.filter(r=>!aboveThreshold(r,state.hmin));
    filtered=rows.filter(r=>(r.shift==null?!$('matched').checked:aboveThreshold(r,state.hmin))&&(!search||r.key.includes(search)||r.precinct?.includes(search))&&(!state.hbin||keyFor(r)===state.hbin));
    const [sort,dir]=state.hsort.split(':');filtered.sort((a,b)=>{const av=val(a,sort),bv=val(b,sort);if(av==null)return bv==null?0:1;if(bv==null)return -1;return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}))*(dir==='desc'?-1:1);});
    $('count').textContent=`${filtered.length} of ${rows.length} areas`;
    $('status').textContent=`${comparable.length} comparable · ${low.length} under ${state.hmin} votes hidden`;
    const paired=filtered.filter(r=>r.shift!=null),sums=paired.reduce((s,r)=>[s[0]+r.a.votes,s[1]+r.a.total,s[2]+r.b.votes,s[3]+r.b.total],[0,0,0,0]);
    const a=sums[1]?sums[0]/sums[1]:null,b=sums[3]?sums[2]/sums[3]:null;
    $('sentence').textContent=`${parse(state.hfrom)[0]} ${office(before.name)} (${chosenNames(before)}) → ${parse(state.hto)[0]} ${office(after.name)} (${chosenNames(after)}) · ${state.hparty==='DEM'?'D':'R'} share ${pct(a)} → ${pct(b)}`;
    $('headline').textContent=pp(a!=null&&b!=null?b-a:null);$('headline').style.background=`color-mix(in srgb, ${shiftColor(a!=null&&b!=null?b-a:null)} 25%, white)`;
    const head=make('tr');for(const [key,label]of columns()){const th=make('th');th.scope='col';th.dataset.col=key;th.setAttribute('aria-sort',sort===key?(dir==='desc'?'descending':'ascending'):'none');const button=make('button',label+(sort===key?(dir==='desc'?' ↓':' ↑'):' ↕'));button.onclick=()=>set({hsort:key+':'+(sort===key&&dir==='desc'?'asc':'desc')});th.append(button);head.append(th);}host.querySelector('thead').replaceChildren(head);
    drawRows();drawScatter();
  }
  function drawRows(){
    const body=host.querySelector('tbody'),cols=columns(),mobile=matchMedia('(max-width:767px)').matches;
    // Spacer rows maintain the scroll range while only visible rows and overscan are mounted.
    const start=Math.max(0,Math.floor((scroll.scrollTop-28)/28)-8),end=Math.min(filtered.length,start+Math.ceil(scroll.clientHeight/28)+20);
    const fragment=document.createDocumentFragment();
    function spacer(height){if(height<=0)return;const tr=make('tr'),td=make('td');td.colSpan=cols.length;td.style.height=height+'px';td.style.padding='0';td.style.border='0';tr.setAttribute('aria-hidden','true');tr.append(td);fragment.append(tr);}
    spacer(start*28);
    for(const r of filtered.slice(start,end)){
      const tr=make('tr');tr.dataset.historyKey=r.key;tr.dataset.historyPrecinct=r.precinct||'';tr.classList.toggle('history-selected',r.precinct===state.precinct);tr.classList.toggle('history-hovered',r.precinct===hovered);
      tr.onpointerenter=()=>events.hover(r.precinct||'');tr.onpointerleave=()=>events.hover('');
      const select=()=>{if(mobile){expanded=expanded===r.key?'':r.key;drawRows();}if(r.precinct)events.pin(r.precinct);};
      tr.onclick=select;
      for(const [key]of cols){const td=make('td'),v=val(r,key);td.dataset.col=key;
        if(key==='key'){const primary=r.precinct||r.key.replace('@','');const button=make('button',primary);button.title=r.precinct?'Select precinct on map':'No matched current precinct';button.onclick=e=>{e.stopPropagation();select();};td.append(button);
          if(r.precinct&&r.key!==r.precinct&&!r.key.startsWith('@')){const chip=make('span','+1','history-chip');chip.title=`2024 VTD ${r.key}; current precinct ${r.precinct}. Matched geography with a different identifier.`;td.append(chip);}
          if(!$('matched').checked&&r.shift==null){const chip=make('span',r.status==='Boundary not matched'?'No match':'No votes','history-chip');chip.title=r.status;td.append(chip);}
        }else if(key==='shift')td.append(bar(v));else td.textContent=['as','bs'].includes(key)?(state.hmetric==='share'?pct(v):pp(v)):key==='voteChange'?diff(v):v==null?'—':number(v);
        tr.append(td);
      }fragment.append(tr);
      if(mobile&&expanded===r.key){const detail=make('tr'),td=make('td',`From ${number(r.a?.votes||0)} votes · To ${number(r.b?.votes||0)} · Change ${diff(r.voteChange)} · From share ${pct(r.a?.share)} · Margin ${pp(r.a?.margin)} → ${pp(r.b?.margin)} · ${r.status}`);td.colSpan=cols.length;td.className='history-expanded';detail.append(td);fragment.append(detail);}
    }
    spacer((filtered.length-end)*28);if(!filtered.length){const tr=make('tr'),td=make('td',ready?'No areas match these filters.':'Loading…');td.colSpan=cols.length;tr.append(td);fragment.append(tr);}body.replaceChildren(fragment);
  }
  const svg=(name,attrs={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
  function drawScatter(){
    const chart=$('scatter');chart.replaceChildren();const x=v=>28+v*258,y=v=>116-v*106;
    chart.append(svg('path',{d:`M28 10V116H286 M28 116L286 10`,fill:'none',stroke:'#a8b1ab','stroke-dasharray':'3 3'}));
    for(const [xx,yy,text]of [[150,137,'From share (%)'],[18,14,'100'],[22,119,'0'],[270,129,'100']]){const t=svg('text',{x:xx,y:yy,'text-anchor':'middle','font-size':10,fill:'#506057'});t.textContent=text;chart.append(t);}
    const label=svg('text',{x:6,y:72,transform:'rotate(-90 6 72)','text-anchor':'middle','font-size':10});label.textContent='To share (%)';chart.append(label);
    for(const r of filtered.filter(r=>r.shift!=null)){const dot=svg('circle',{cx:x(r.a.share),cy:y(r.b.share),r:2.5,fill:shiftColor(r.shift),'data-history-dot':r.precinct||r.key,tabindex:0,role:'button','aria-label':`Precinct ${r.precinct||r.key}, ${pct(r.a.share)} to ${pct(r.b.share)}, ${pp(r.shift)}`});const title=svg('title');title.textContent=dot.getAttribute('aria-label');dot.append(title);dot.onpointerenter=dot.onfocus=()=>events.hover(r.precinct||'');dot.onpointerleave=dot.onblur=()=>events.hover('');dot.onclick=()=>r.precinct&&events.pin(r.precinct);dot.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();dot.onclick();}};chart.append(dot);}markHover();
  }
  function markHover(){for(const row of host.querySelectorAll('[data-history-precinct]'))row.classList.toggle('history-hovered',row.dataset.historyPrecinct===hovered&&!!hovered);for(const dot of host.querySelectorAll('[data-history-dot]')){const active=dot.dataset.historyDot===hovered||dot.dataset.historyDot===state.precinct;dot.setAttribute('stroke',active?'#21342c':'none');dot.setAttribute('stroke-width','1.5');dot.setAttribute('r',active?'4':'2.5');}}
  scroll.onscroll=()=>drawRows();new ResizeObserver(()=>drawRows()).observe(scroll);
  $('search').oninput=$('matched').onchange=$('from-votes').onchange=()=>{scroll.scrollTop=0;draw();};
  $('party').onclick=e=>{if(e.target.value)set({hparty:e.target.value,hbin:''});};
  $('metric').onclick=e=>{if(e.target.value)set({hmetric:e.target.value});};
  $('min').onchange=()=>set({hmin:Number($('min').value),hbin:''});
  $('absolute').onclick=()=>set({hsort:'abs:desc'});
  $('swap').onclick=()=>set({hfrom:state.hto,hto:state.hfrom,hlink:false,hbin:''});
  $('follow').onclick=()=>set({hlink:!state.hlink,...(!state.hlink?{hto:'2026:'+current.contests[state.contest].name}:{}),hbin:''});
  $('more').onclick=()=>{const more=host.classList.toggle('history-more-open');$('more').setAttribute('aria-expanded',String(more));};
  $('info').onclick=e=>{e.preventDefault();e.stopPropagation();$('methodology').hidden=!$('methodology').hidden;};
  host.ontoggle=()=>{if(host.open!==state.hopen)set({hopen:host.open});};
  const handle=host.querySelector('.history-resize');
  handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);const start=e.clientY,height=host.getBoundingClientRect().height;handle.onpointermove=event=>{const px=Math.max(160,Math.min(innerHeight*.75,innerHeight-368,height+start-event.clientY));host.style.setProperty('--history-height',px+'px');};handle.onpointerup=()=>{set({hheight:host.getBoundingClientRect().height/innerHeight*100});handle.onpointermove=handle.onpointerup=null;};};
  handle.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();set({hheight:state.hheight+(e.key==='ArrowUp'?2:-2)});}};
  $('export').onclick=()=>{const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const data=[['from','to','party','vtd','current_precinct','from_votes','to_votes','vote_change','from_share','to_share','share_shift_pp','from_margin','to_margin','margin_shift_pp','coverage'],...filtered.map(r=>[state.hfrom,state.hto,state.hparty,r.key,r.precinct,r.a?.votes,r.b?.votes,r.voteChange,r.a?.share,r.b?.share,r.shift==null?'':r.shift*100,r.a?.margin,r.b?.margin,r.marginShift==null?'':r.marginShift*100,r.status])];const url=URL.createObjectURL(new Blob([data.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv'})),a=make('a');a.href=url;a.download='tarrant-historical-shifts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function update(next){const old=state;state=next;host.open=state.hopen;host.style.setProperty('--history-height',state.hheight+'vh');handle.setAttribute('aria-valuenow',String(Math.round(state.hheight)));handle.setAttribute('aria-valuemin','160');handle.setAttribute('aria-valuemax',String(Math.round(innerHeight*.75)));handle.setAttribute('aria-valuetext',Math.round(state.hheight)+' percent of screen');
    for(const side of ['from','to'])$(side+'-year').value=parse(state['h'+side])[0];$('min').value=state.hmin;
    for(const id of ['party','metric'])for(const b of $(id).querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.value===state[id==='party'?'hparty':'hmetric']));$('follow').setAttribute('aria-pressed',String(state.hlink));$('absolute').setAttribute('aria-pressed',String(state.hsort==='abs:desc'));
    if(state.hlink&&state.hto!=='2026:'+current.contests[state.contest].name){set({hto:'2026:'+current.contests[state.contest].name,hbin:''});return;}
    const signature=[state.hfrom,state.hto,state.hparty].join('|');if(signature!==settings){settings=signature;refresh();}else if(ready&&['hmin','hbin','hsort','hmetric'].some(k=>state[k]!==old[k])){scroll.scrollTop=0;draw();events.change?.();}
    if(state.precinct!==lastPinned){lastPinned=state.precinct;const i=filtered.findIndex(r=>r.precinct===state.precinct);if(i>=0)scroll.scrollTop=Math.max(0,i*28-scroll.clientHeight/2);drawRows();markHover();}
  }
  fetch('./data/history.json').then(r=>{if(!r.ok)throw Error('Historical data unavailable.');return r.json();}).then(data=>{manifest=data;reverse=Object.fromEntries(Object.entries(data.crosswalk).map(([p,v])=>[v,p]));refresh();}).catch(e=>{$('status').textContent=e.message;});
  update(state);
  return {
    update,hover(id){hovered=id;const i=filtered.findIndex(r=>r.precinct===id);if(i>=0&&(i*28<scroll.scrollTop||(i+1)*28>scroll.scrollTop+scroll.clientHeight-28)){scroll.scrollTop=Math.max(0,i*28-scroll.clientHeight/2);drawRows();}markHover();},filter(key){set({hbin:key??''});},
    key(id){const r=rows.find(r=>r.precinct===id);return r?keyFor(r):'zero';},
    mapView(base){if(mapCache?.base===base)return mapCache.view;const lookup=new Map(rows.map(r=>[r.precinct,r]));const result={...base,rows:base.rows.map(row=>{const history=ready?lookup.get(row.precinct):null;const key=history?keyFor(history):'zero';return {...row,history,status:key==='zero'?'zero':key==='low'?'low':'data',result:row.result||{},color:key==='zero'?'#d9d9d6':key==='low'?'#e4e3de':shiftColor(history.shift),dim:state.hbin&&key!==state.hbin? .15:1};})};result.byId=new Map(result.rows.map(r=>[r.precinct,r]));result.features={...base.features,features:result.rows.map(r=>({...r.feature,properties:{precinct:r.precinct,status:r.status,color:r.color,dim:r.dim}}))};mapCache={base,view:result};return result;},
    legend(target){const title=`${state.hparty==='DEM'?'D':'R'} share shift, ${parse(state.hfrom)[0]} → ${parse(state.hto)[0]}`;const summary=make('summary',title),strip=make('div',null,'compact-bins'),counts=SHIFT_COLORS.map((_,i)=>rows.filter(r=>r.shift!=null&&aboveThreshold(r,state.hmin)&&shiftBin(r.shift)===i).length),max=Math.max(1,...counts);SHIFT_COLORS.forEach((color,i)=>{const b=make('button',null,'legend-bin');b.dataset.filterKey=String(i);b.dataset.legendKey=String(i);b.title=SHIFT_LABELS[i]+' · '+counts[i]+' areas';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(state.hbin===String(i)));const h=make('i'),c=make('b');h.style.height=(counts[i]?2+12*counts[i]/max:0)+'px';c.style.background=color;b.append(h,c);strip.append(b);});summary.append(strip);const ticks=make('div',null,'legend-ticks');ticks.append(make('span','−15 pp'),make('span','0'),make('span','+15 pp'));summary.append(ticks);const detail=make('div',null,'legend-detail');detail.append(make('p','Share change for the selected party · all voting methods. Select a bin to filter the map, table and scatter.'));for(const [key,label]of [['zero','No comparable votes / boundary match'],['low',`Under ${state.hmin} party votes in either election`]]){const b=make('button',label);b.dataset.filterKey=key;detail.append(b);}target.replaceChildren(summary,detail);},
    tooltip(target,id){const r=rows.find(r=>r.precinct===id);target.replaceChildren(make('b','Precinct '+id));target.append(make('p',`${parse(state.hfrom)[0]} → ${parse(state.hto)[0]} · ${state.hparty==='DEM'?'Democratic':'Republican'} share`));if(r?.shift!=null){target.append(make('p',`${pct(r.a.share)} → ${pct(r.b.share)}`),bar(r.shift),make('p',`${number(r.a.votes)} → ${number(r.b.votes)} votes`));if(!aboveThreshold(r,state.hmin))target.append(make('p','Below minimum vote threshold'));}else target.append(make('p','No comparable boundary / votes'));},
    async profile(target,id){const token=++profileRequest;target.querySelector('.precinct-history')?.remove();if(!id||!ready)return;const r=rows.find(r=>r.precinct===id),block=make('section',null,'precinct-history');block.append(make('h2','History'));if(r?.shift!=null){block.append(make('p',`${parse(state.hfrom)[0]} → ${parse(state.hto)[0]} · ${state.hparty==='DEM'?'D':'R'} share ${pct(r.a.share)} → ${pct(r.b.share)}`),bar(r.shift));}else block.append(make('p','No comparable votes or boundary match.'));target.append(block);const party=state.hparty,name=after.name,key=manifest.crosswalk[id];const results=await Promise.all(years.map(async year=>{try {const data=await load(year),contest=data.contests.find(c=>c.name===name),vtd=year===2026?(key??'@'+id):key;return {year,result:contest&&vtd?partyResult(contest.precincts[vtd],contest.choices,party):null};}catch{return {year,result:null};}}));if(token!==profileRequest||!block.isConnected)return;const spark=svg('svg',{viewBox:'0 0 300 90',role:'img','aria-label':`${party} share for ${name} over time`});let path='';results.forEach((v,i)=>{if(!v.result){path+=' ';return;}const x=20+i*37,y=65-v.result.share*55;path+=(i&&results[i-1].result?'L':'M')+x+' '+y+' ';const dot=svg('circle',{cx:x,cy:y,r:3,fill:'#27563f'}),t=svg('title');t.textContent=`${v.year}: ${pct(v.result.share)} · ${number(v.result.votes)} votes`;dot.append(t);spark.append(dot);const label=svg('text',{x,y:84,'font-size':9,'text-anchor':'middle'});label.textContent=v.year;spark.append(label);});spark.prepend(svg('path',{d:path,fill:'none',stroke:'#27563f','stroke-width':1.5}));block.append(make('p',office(name),'muted'),spark);}
  };
}
