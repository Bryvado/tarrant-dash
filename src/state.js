export const defaults = { hfrom:'2024:United States Senator', hto:'2026:United States Senator', hparty:'DEM', hsort:'abs:desc', hmin:50, hheight:40, hopen:true, hlink:true, hmetric:'share', hbin:'', palette: 'default', classification: 'fixed', contest: 0, choice: 0, method: 3, measure: 'share', scope: 'winner', precinct: '', basemap: 'streets', shading: 85, aerial: 100, outlines: false, shadingAdjusted: false };
const keys = Object.keys(defaults);

export function createStore(contests, precincts) {
  const listeners = new Set();
  const validIndex = (n, max) => Number.isInteger(n) && n >= 0 && n < max;
  function normalize(state) {
    state.contest = validIndex(state.contest, contests.length) ? state.contest : 0;
    const contest = contests[state.contest];
    if (!['default','red-blue','purple-green','orange-teal'].includes(state.palette)) state.palette='default';
    if (!['fixed','equal','quantile','natural'].includes(state.classification)) state.classification='fixed';
    state.choice = validIndex(state.choice, contest.choices.length) ? state.choice : 0;
    state.method = validIndex(state.method, 4) ? state.method : 3;
    if (!['share','margin','density','shift'].includes(state.measure)) state.measure = 'share';
    if (!['winner','candidate','total'].includes(state.scope) || (state.scope === 'total' && state.measure !== 'density')) state.scope = 'winner';
    if (!precincts.has(state.precinct) || (state.measure!=='shift' && !Object.hasOwn(contest.precincts, state.precinct))) state.precinct = '';
    if (state.basemap !== 'aerial') state.basemap = 'streets';
    for (const key of ['shading','aerial']) if (!(state[key] >= 0 && state[key] <= 100)) state[key] = defaults[key];
    state.hmin=Math.max(0,Math.min(100000,Number(state.hmin)||0));
    state.hheight=Math.round(10*Math.max(160/innerHeight*100,Math.min(75,Number(state.hheight)||40)))/10;
    if(!['DEM','REP'].includes(state.hparty))state.hparty='DEM';
    if(!['share','margin'].includes(state.hmetric))state.hmetric='share';
    if(!/^([0-8]|zero|low)?$/.test(state.hbin)||state.measure!=='shift')state.hbin='';
    if(!/^(abs|key|as|bs|shift|av|bv|voteChange):(asc|desc)$/.test(state.hsort))state.hsort='abs:desc';
    return state;
  }
  function fromHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const state = Object.fromEntries(keys.map(key => {
      const raw = params.get(key), fallback = defaults[key];
      return [key, raw === null ? fallback : typeof fallback === 'number' ? Number(raw) : typeof fallback === 'boolean' ? raw === 'true' : raw];
    }));
    if (!params.has('choice')) state.choice = Math.max(0,(contests[state.contest] || contests[0]).choices.findIndex(choice=>choice.party==='DEM'));
    if (!params.has('shading') && state.basemap==='aerial') state.shading=42;
    return normalize(state);
  }
  let state = fromHash();
  function set(patch, source = '') {
    const previous = state;
    state = normalize({ ...state, ...patch });
    if (keys.every(k => state[k] === previous[k]) && source!=='precinct') return;
    const hash = new URLSearchParams(keys.map(key => [key, state[key]]));
    if (source !== 'hash') history.replaceState(null, '', '#' + hash);
    for (const listener of listeners) listener(state, previous, source);
  }
  window.addEventListener('hashchange', () => set(fromHash(), 'hash'));
  return { get: () => state, set, subscribe: listener => listeners.add(listener) };
}
