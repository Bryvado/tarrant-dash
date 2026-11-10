import { SCALES } from './classification.js';
import { choiceColor } from './color.js';

export const METHODS = ['Mail','Early','Election Day','All methods'];
const groups = ['Federal','Statewide executive','Judicial','Legislative','County','Municipal','School district','Other district','Propositions'];
export function contestGroup(name) {
  if (/\bproposition\b/i.test(name)) return 'Propositions';
  if (/^United States/.test(name)) return 'Federal';
  if (/^State (Senator|Representative)/.test(name)) return 'Legislative';
  if (/^(City|Town) of/.test(name)) return 'Municipal';
  if (/School District/.test(name)) return 'School district';
  if (/^(Judge, County|County |District Clerk|Criminal District Attorney|Justice of the Peace)/.test(name)) return 'County';
  if (/Judge|Justice|Court/.test(name)) return 'Judicial';
  if (/Board|District/.test(name)) return 'Other district';
  return 'Statewide executive';
}

function picker(host, id, label, entries, choose) {
  const spatial=id==='precinct-search';
  const caption = document.createElement('span');
  caption.className = 'control-label';
  caption.textContent = label;
  const trigger = document.createElement('button');
  trigger.className = 'picker-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-expanded', 'false');
  const popup = document.createElement('div');
  popup.className = 'picker-popup';
  popup.hidden = true;
  const search = document.createElement('input');
  search.type = 'search';
  search.id = id;
  search.placeholder = `Search ${label.toLowerCase()}…`;
  search.setAttribute('aria-label', `Search ${label.toLowerCase()}`);
  search.setAttribute('role','combobox');
  search.setAttribute('aria-autocomplete','list');
  search.setAttribute('aria-controls', id + '-list');
  const list = document.createElement('div');
  list.id = id + '-list';
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label',label);
  popup.append(search,list);
  host.append(caption,trigger,popup);
  let matches = [], active = 0, current;
  if(spatial){
    trigger.hidden=true;caption.hidden=true;popup.hidden=false;list.hidden=true;
    search.onfocus=()=>{list.hidden=false;render();search.setAttribute('aria-expanded','true');};
  }
  function highlight() {
    const options = [...list.querySelectorAll('[role="option"]')];
    options.forEach((option,i) => option.classList.toggle('active',i===active));
    if (options[active]) search.setAttribute('aria-activedescendant',options[active].id);
    else search.removeAttribute('aria-activedescendant');
  }
  function render() {
    const query = search.value.toLowerCase().trim().replace(/[–—]/g,'-');
    matches = entries.filter(entry => entry.text.toLowerCase().replace(/[–—]/g,'-').includes(query));
    list.replaceChildren();
    let lastGroup;
    matches.forEach((entry,i) => {
      if (entry.group && entry.group !== lastGroup) {
        const title = document.createElement('div');
        title.className = 'option-group';
        title.textContent = entry.group;
        list.append(title);
        lastGroup = entry.group;
      }
      const option = document.createElement('div');
      option.id = `${id}-option-${i}`;
      option.setAttribute('role','option');
      option.setAttribute('aria-selected',String(entry.value===current));
      renderEntry(option,entry);
      option.onclick = () => commit(entry);
      list.append(option);
    });
    if (!matches.length) list.textContent = 'No matches';
    active = 0;
    highlight();
  }
  function renderEntry(target, entry) {
    target.textContent = entry?.text || 'Search precinct';
    if (entry?.party) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = entry.party;
      chip.style.setProperty('--chip-color',entry.color);
      target.append(chip);
    }
  }
  function close(focus = false) {
    if(spatial)list.hidden=true;else popup.hidden = true;
    trigger.setAttribute('aria-expanded','false');
    search.setAttribute('aria-expanded','false');
    if (focus) (spatial ? search : trigger).focus();
  }
  function commit(entry) { close(!spatial); choose(entry.value); if(spatial)search.blur(); }
  trigger.onclick = () => {
    if (!popup.hidden) return close();
    popup.hidden = false;
    trigger.setAttribute('aria-expanded','true');
    search.setAttribute('aria-expanded','true');
    search.value = '';
    render();
    search.focus();
  };
  search.oninput = render;
  search.onkeydown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(true); return; }
    if (event.key === 'Enter' && matches[active]) { event.preventDefault(); commit(matches[active]); }
    if (!['ArrowDown','ArrowUp'].includes(event.key) || !matches.length) return;
    event.preventDefault();
    active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    highlight();
    list.querySelector('.active')?.scrollIntoView({block:'nearest'});
  };
  const outside = event => { if (!host.contains(event.target)) close(); };
  document.addEventListener('click', outside, true);
  return Object.assign(value => {
    current = value;
    renderEntry(trigger,entries.find(entry=>entry.value===value));
    if(spatial && document.activeElement!==search) search.value=value ? 'Precinct '+value : '';
  },{destroy:()=>{document.removeEventListener('click',outside,true);host.replaceChildren();}});
}

const segment = (id, title, options) => `<fieldset id="${id}"><legend>${title}</legend><div class="segments">${options.map(([value,label])=>`<button type="button" value="${value}" aria-pressed="false">${label}</button>`).join('')}</div></fieldset>`;

export function setupControls(host, store, contests, precincts) {
  host.innerHTML = `
    <div id="workspace-mode" class="segments"><button id="results-mode" type="button" aria-pressed="true">Results</button><button id="compare-map" type="button" aria-pressed="false" aria-controls="comparison-fields">Compare</button></div>
    <div id="primary-controls">
    <div id="contest-picker" class="picker"></div>
    <div id="comparison-fields" class="plot-controls" hidden></div>
    <div id="choice-controls" class="picker"></div>
    ${segment('measure','Measure',[['share','Share'],['margin','Margin'],['density','Density'],['shift','Shift']])}
    </div><details id="more-controls" class="more-controls" open><summary>Refine</summary><div class="control-stack"><span class="muted refine-label">Refine</span><div class="scope-slot">
      ${segment('scope','Show votes for',[['winner','Precinct leader'],['candidate','Selected candidate'],['total','All votes']])}
      <p class="sr-only" id="scope-hint">All votes is available for density.</p><p class="hint" id="scope-note" role="status" hidden></p>
      </div>${segment('method','Voting method',[[3,'All'],[0,'Mail'],[1,'Early'],[2,'Election Day']])}
      <div id="precinct-picker" class="picker"></div>
      <details class="display-controls"><summary>Map display</summary><div class="control-stack">
        <label for="palette">Color palette</label><select id="palette"><option value="default">Default</option><option value="red-blue">Red–blue</option><option value="purple-green">Purple–green</option><option value="orange-teal">Orange–teal</option></select>
        <label for="classification">Color scale</label><select id="classification">${Object.entries(SCALES).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join('')}</select><p id="scale-hint" class="hint"></p>
        ${segment('basemap' ,'Basemap',[['streets','Streets'],['aerial','Aerial 2025']])}
        <label for="shading">Precinct shading <output id="shading-value"></output></label><input id="shading" type="range" min="0" max="100">
        <div id="aerial-settings" hidden><label for="aerial">Aerial opacity <output id="aerial-value"></output></label><input id="aerial" type="range" min="0" max="100">
        </div><label class="check"><input id="outlines" type="checkbox"> Outlines only</label>
      </div></details>
    </div></details>`;
  const find = id => host.querySelector('#'+id);
  const ordered = contests.map((contest,value)=>({value,text:contest.name,group:contestGroup(contest.name)}))
    .sort((a,b)=>groups.indexOf(a.group)-groups.indexOf(b.group));
  const showContest = picker(find('contest-picker'),'contest-search','Contest',ordered,value=>store.set({contest:value,choice:Math.max(0,contests[value].choices.findIndex(choice=>choice.party==='DEM'))},'contest'));
  const showPrecinct = picker(find('precinct-picker'),'precinct-search','Precinct',[...precincts].sort().map(value=>({value,text:value})),
    precinct=>store.set({precinct},'precinct'));
  let noteTimer, lastContest = -1, showChoice;
  for (const key of ['measure','scope','method','basemap']) find(key).onclick = event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const value = key === 'method' ? Number(button.value) : button.value;
    const current = store.get();
    const patch = { [key]: value };
    if (key === 'measure' && value !== current.measure && (value === 'density' || current.scope === 'total') && current.scope !== 'winner') {
      patch.scope = 'winner';
      const note = find('scope-note');
      note.hidden = false;
      note.textContent = 'Switched to Precinct leader.';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(()=>{note.hidden=true;},2800);
    }
    if (key === 'basemap' && !current.shadingAdjusted) patch.shading = value === 'aerial' ? 42 : 85;
    store.set(patch,'controls');
  };
  for(const key of ['palette','classification']) find(key).onchange=e=>store.set({[key]:e.target.value},'display');
  find('outlines').onchange = e=>store.set({outlines:e.target.checked},'controls');
  find('shading').oninput = e=>store.set({shading:Number(e.target.value),shadingAdjusted:true},'display');
  find('aerial').oninput = e=>store.set({aerial:Number(e.target.value)},'display');
  const mobile = matchMedia('(max-width:767px)');
  function resize() { find('more-controls').open = true; }
  mobile.addEventListener('change',resize);
  resize();
  return (state, view, aerialAvailable) => {
    for(const key of ['palette','classification']) find(key).value=state[key];
    find('scale-hint').textContent=SCALES[state.classification][1];
    showContest(state.contest);
    showPrecinct(state.precinct);
    if (lastContest !== state.contest) {
      showChoice?.destroy();
      const entries=view.contest.choices.map((choice,value)=>({
        value,text:choice.name,party:choice.party,color:choiceColor(view.contest,value),
      }));
      showChoice=picker(find('choice-controls'),'choice-search','Choice',entries,choice=>store.set({choice},'controls'));
      lastContest = state.contest;
    }
    showChoice(state.choice);
    for (const key of ['measure','scope','method','basemap']) for (const button of find(key).querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button.value===String(state[key])));
      button.disabled = (key==='scope' && button.value==='total' && state.measure!=='density') ||
        (key==='basemap' && button.value==='aerial' && !aerialAvailable);
    }
    const allVotes=find('scope').querySelector('[value=total]');
    allVotes.title=allVotes.disabled ? 'All votes is available for density.' : '';
    allVotes.setAttribute('aria-describedby','scope-hint');
    find('aerial-settings').hidden = state.basemap!=='aerial' || !aerialAvailable;
    for (const key of ['shading','aerial']) {
      find(key).value = state[key];
      find(key+'-value').textContent = state[key]+'%';
    }
    find('outlines').checked = state.outlines;
  };
}
