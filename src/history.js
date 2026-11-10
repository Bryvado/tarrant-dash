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

export function setupHistory(host,current,onPin) {
  host.innerHTML=`<summary>Historical results &amp; shifts</summary><div class="history-content">
    <div class="history-toolbar">
      <fieldset><legend>From</legend><label>Election<select id="history-from-year"></select></label><label>Contest<select id="history-from-race"></select></label></fieldset>
      <fieldset><legend>To</legend><label>Election<select id="history-to-year"></select></label><label>Contest<select id="history-to-race"></select></label></fieldset>
      <label>Party<select id="history-party"><option value="DEM">Democratic</option><option value="REP">Republican</option></select></label>
      <button id="history-follow" type="button">Use map contest</button><button id="history-export" type="button" disabled>Export CSV</button>
    </div>
    <div class="history-filters"><label>Find precinct <input id="history-search" type="search" placeholder="Precinct / VTD"></label><label><input type="checkbox" id="history-matched" checked> Comparable only</label><span id="history-status" role="status">Loading historical results…</span></div>
    <p id="history-context" class="muted"></p><p id="history-summary"></p>
    <div class="history-scroll"><table><thead></thead><tbody></tbody></table></div>
    <div class="history-pages"><button id="history-prev" type="button">Previous</button><span id="history-page"></span><button id="history-next" type="button">Next</button></div>
    <p class="history-note muted">All voting methods. Shares and party margins use each contest’s valid votes. Historical returns use common 2024 VTD geography; 2026 requires ≥98% area overlap in both directions. Unmatched boundaries never receive shifts. District footprints can change. <a href="https://data.capitol.texas.gov/dataset/comprehensive-election-datasets-compressed-format" target="_blank" rel="noopener">Texas Legislative Council data, 2012–2024</a>; county reports for 2026. Only contests supplied by these sources are listed.</p>
    </div>`;
  const $=id=>host.querySelector('#history-'+id);
  let manifest,reverse={},state,request=0,page=0,sort='shift',descending=true,rows=[],filtered=[],before,after;
  const cache=new Map();
  const columns=[['key','VTD / current precinct'],['av','From votes'],['bv','To votes'],['voteChange','Vote change'],['as','From share'],['bs','To share'],['shift','Share shift'],['am','From margin'],['bm','To margin'],['marginShift','Margin shift'],['status','Coverage']];
  const value=(r,key)=>({av:r.a?.votes,bv:r.b?.votes,as:r.a?.share,bs:r.b?.share,am:r.a?.margin,bm:r.b?.margin}[key]??r[key]);
  function options(select,items,chosen){select.replaceChildren(...items.map(([value,label])=>new Option(label,value)));if(items.some(([v])=>String(v)===String(chosen)))select.value=chosen;}
  async function load(year){
    if(year===2026)return {contests:current.contests.map(r=>({name:r.name,choices:r.choices,
      precincts:Object.fromEntries(Object.entries(r.precincts).map(([p,r])=>[manifest.crosswalk[p]??'@'+p,r.votes.map(v=>v[3])]))}))};
    if(!cache.has(year))cache.set(year,fetch('./data/history-'+year+'.json').then(r=>{if(!r.ok)throw Error('Historical data could not load.');return r.json();}).catch(e=>{cache.delete(year);throw e;}));
    return cache.get(year);
  }
  function selectedNames(race){return race.choices.filter(c=>c.party===$('party').value).map(c=>c.name).join(' / ')||'No candidate for this party';}
  const raceRequests={from:0,to:0};
  async function refreshRaces(side,preferred){
    const token=++raceRequests[side];
    const year=Number($(side+'-year').value),data=await load(year);
    if(token!==raceRequests[side])return;
    const prior=preferred??$(side+'-race').selectedOptions[0]?.textContent;
    options($(side+'-race'),data.contests.map((c,i)=>[i,c.name]),Math.max(0,data.contests.findIndex(c=>c.name===prior)));
  }
  async function refresh(){
    const token=++request;$('status').textContent='Loading…';$('export').disabled=true;
    try {
      const [a,b]=await Promise.all([load(Number($('from-year').value)),load(Number($('to-year').value))]);
      if(token!==request)return;
      before=a.contests[Number($('from-race').value)];after=b.contests[Number($('to-race').value)];
      rows=historyRows(before,after,$('party').value,reverse);page=0;
      $('context').textContent=`${$('from-year').value} ${before.name}: ${selectedNames(before)} → ${$('to-year').value} ${after.name}: ${selectedNames(after)}. Margin = ${$('party').value==='DEM'?'D − R':'R − D'}.`;
      $('export').disabled=false;draw();
    }catch(error){if(token===request){$('status').textContent=error.message;host.querySelector('tbody').replaceChildren();}}
  }
  function draw(){
    const search=$('search').value.trim();
    filtered=rows.filter(r=>(!$('matched').checked||r.shift!=null)&&(!search||r.key.includes(search)||r.precinct?.includes(search)));
    filtered.sort((a,b)=>{const av=value(a,sort),bv=value(b,sort);if(av==null)return bv==null?0:1;if(bv==null)return -1;return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true}))*(descending?-1:1);});
    page=Math.min(page,Math.max(0,Math.ceil(filtered.length/50)-1));
    $('status').textContent=`${rows.filter(r=>r.shift!=null).length} comparable / ${rows.length} areas · ${filtered.length} shown`;
    const paired=filtered.filter(r=>r.shift!=null);
    const sums=paired.reduce((s,r)=>[s[0]+r.a.votes,s[1]+r.a.total,s[2]+r.b.votes,s[3]+r.b.total],[0,0,0,0]);
    $('summary').textContent=paired.length?`Selected party across shown, comparable areas: ${pct(sums[0]/sums[1])} → ${pct(sums[2]/sums[3])} · ${pp(sums[2]/sums[3]-sums[0]/sums[1])} share shift`:'No comparable votes for these selections.';
    const head=make('tr');for(const [key,label]of columns){const th=make('th');th.scope='col';th.setAttribute('aria-sort',sort===key?(descending?'descending':'ascending'):'none');const button=make('button',label+(sort===key?(descending?' ↓':' ↑'):''));button.type='button';button.onclick=()=>{descending=sort===key?!descending:true;sort=key;page=0;draw();};th.append(button);head.append(th);}host.querySelector('thead').replaceChildren(head);
    const body=host.querySelector('tbody');body.replaceChildren();
    for(const r of filtered.slice(page*50,page*50+50)){
      const tr=make('tr');tr.classList.toggle('history-selected',r.precinct===state?.precinct);tr.dataset.historyPrecinct=r.precinct??'';
      for(const [key] of columns){const td=make('td'),v=value(r,key);
        if(key==='key') {const label=r.key.startsWith('@')?'Current '+r.precinct:r.key+(r.precinct&&r.precinct!==r.key?' / '+r.precinct:'');const button=make('button',label);button.type='button';button.disabled=!r.precinct||!current.contests[state?.contest??0].precincts[r.precinct];button.title=button.disabled?'No matched precinct in the map contest':'Select on map';button.onclick=()=>onPin(r.precinct);td.append(button);}
        else td.textContent=['as','bs'].includes(key)?pct(v):['shift','marginShift','am','bm'].includes(key)?pp(v):key==='voteChange'?diff(v):typeof v==='number'?number(v):v??'—';
        if(['shift','marginShift'].includes(key)&&v!=null)td.className=v>0?'shift-positive':v<0?'shift-negative':'';
        tr.append(td);
      }body.append(tr);
    }
    if(!filtered.length){const tr=make('tr'),td=make('td','No rows match these selections.');td.colSpan=columns.length;tr.append(td);body.append(tr);}
    $('page').textContent=`Page ${page+1} of ${Math.max(1,Math.ceil(filtered.length/50))}`;$('prev').disabled=!page;$('next').disabled=(page+1)*50>=filtered.length;
  }
  let selectionRequest=0;
  async function chooseYear(side){request++;const token=++selectionRequest;try {await refreshRaces(side);if(token===selectionRequest)await refresh();}catch(e){$('status').textContent=e.message;}}
  for(const side of ['from','to']){$(side+'-year').onchange=()=>chooseYear(side);$(side+'-race').onchange=refresh;}
  $('party').onchange=refresh;
  $('search').oninput=$('matched').onchange=()=>{page=0;draw();};
  $('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};
  async function follow(){if(!manifest||!state)return;const name=current.contests[state.contest].name;$('to-year').value='2026';await refreshRaces('to',name);const party=current.contests[state.contest].choices[state.choice]?.party;if(['DEM','REP'].includes(party))$('party').value=party;
    // Find the most recent prior general election that actually contains this office.
    for(const entry of [...manifest.years].reverse()){const data=await load(entry.year);if(data.contests.some(c=>c.name===name)){$('from-year').value=entry.year;await refreshRaces('from',name);break;}}
    if(!$('from-race').options.length){$('from-year').value='2024';await refreshRaces('from');}await refresh();
  }
  $('follow').onclick=()=>follow().catch(e=>{$('status').textContent=e.message;});
  $('export').onclick=()=>{
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    const header=['from_year','from_contest','to_year','to_contest','party','vtd','current_precinct','from_votes','to_votes','vote_change','from_valid_votes','to_valid_votes','from_share_pct','to_share_pct','share_shift_pp','from_margin_pp','to_margin_pp','margin_shift_pp','coverage'];
    const scale=v=>v==null?'':v*100;
    const csv=[header,...filtered.map(r=>[$('from-year').value,before.name,$('to-year').value,after.name,$('party').value,r.key,r.precinct,r.a?.votes,r.b?.votes,r.voteChange,r.a?.total,r.b?.total,scale(r.a?.share),scale(r.b?.share),scale(r.shift),scale(r.a?.margin),scale(r.b?.margin),scale(r.marginShift),r.status])].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=make('a');link.href=url;link.download=`tarrant-shifts-${$('from-year').value}-${$('to-year').value}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  fetch('./data/history.json').then(r=>{if(!r.ok)throw Error('Historical data unavailable.');return r.json();}).then(async data=>{
    manifest=data;reverse=Object.fromEntries(Object.entries(data.crosswalk).map(([p,v])=>[v,p]));
    for(const side of ['from','to'])options($(side+'-year'),[...data.years.map(d=>[d.year,d.year]),[2026,'2026']],side==='from'?2024:2026);
    await follow();
  }).catch(e=>{$('status').textContent=e.message;});
  host.open=!matchMedia('(max-width:767px)').matches;
  return {update(next){state=next;if(rows.length)draw();}};
}
