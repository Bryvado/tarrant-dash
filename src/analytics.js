import { choiceColor } from './color.js';
import { formatMetric, number } from './metrics.js';
import { queryTitle } from './legend.js';
import { comparisonMap } from './comparison.js';

const groups = {
  hispvap: 'Hispanic',
  anglovap: 'Anglo',
  blackvap: 'Black',
  asianvap: 'Asian',
  nanglovap: 'Non-Anglo',
};
const share = value => formatMetric(value, 'share');
const gap = value => (value > 0 ? '+' : '') + formatMetric(value, 'margin');

function addOptions(select, items, label) {
  select.replaceChildren(...items.map((item, index) => new Option(label(item), index)));
}

function correlation(rows) {
  const n = rows.length;
  if (n < 3) return null;
  const meanX = rows.reduce((sum, row) => sum + row.metric.value, 0) / n;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / n;
  let xx = 0, yy = 0, xy = 0;
  for (const row of rows) {
    const x = row.metric.value - meanX, y = row.y - meanY;
    xx += x*x;
    yy += y*y;
    xy += x*y;
  }
  return xx > 1e-15 && yy > 1e-15 ? xy / Math.sqrt(xx*yy) : null;
}

export function setupAnalytics(host, chart, contests, mapControls, compareButton, onComparisonChange) {
  const field = id => host.querySelector('#'+id);
  const mode = field('plot-mode'), a = field('plot-a'), race = field('plot-race');
  const b = field('plot-b'), group = field('plot-group'), caption = field('chart-query');
  const detail = field('plot-detail');
  const comparisonFields = mapControls.querySelector('#comparison-fields');
  const chartControls = a.parentElement.parentElement;
  const aLabel = a.parentElement, raceLabel = race.parentElement, bLabel = b.parentElement;
  const normalControls = ['choice-controls','measure','scope']
    .map(id=>mapControls.querySelector('#'+id));
  let view, state, demographics, previousContest, previousChoice, comparison, plotted = new Map();
  addOptions(race, contests, contest => contest.name);
  race.value = contests.length > 1 ? '1' : '0';
  for (const [key, label] of Object.entries(groups)) group.add(new Option(label, key));

  const optionLabel = choice => choice.party ? choice.name+' ('+choice.party+')' : choice.name;
  function updateB() {
    const contest = contests[Number(race.value)];
    addOptions(b, contest.choices, optionLabel);
    const sameParty = contest.choices.findIndex(choice => choice.party && choice.party === view.contest.choices[Number(a.value)]?.party);
    b.value = String(Math.max(0, sameParty));
  }
  function describe(id) {
    const row = plotted.get(id);
    if (!row) return '';
    if (mode.value === 'compare') return `A ${share(row.y)} · B ${share(row.metric.value)} · A − B ${gap(row.y-row.metric.value)}`;
    return `A ${share(row.y)} · ${groups[group.value]} share of voting-age population ${share(row.metric.value)}`;
  }
  function showDetail() {
    if (mode.value === 'distribution' || !state.precinct) detail.textContent = '';
    else detail.textContent = `Precinct ${state.precinct} · ${describe(state.precinct) || 'No comparable data'}`;
  }

  function draw() {
    const compare = mode.value === 'compare';
    const census = mode.value === 'census';
    if (compare && aLabel.parentElement !== comparisonFields) comparisonFields.append(aLabel,raceLabel,bLabel);
    if (!compare && aLabel.parentElement !== chartControls) chartControls.append(aLabel,raceLabel,bLabel);
    compareButton.setAttribute('aria-pressed',String(compare));
    comparisonFields.hidden = !compare;
    normalControls.forEach(control=>{control.hidden=compare;});
    mapControls.classList.toggle('comparing',compare);
    aLabel.hidden = !compare && !census;
    raceLabel.hidden = bLabel.hidden = !compare;
    comparison = null;
    group.parentElement.hidden = !census;
    plotted = new Map();
    if (!compare && !census) {
      caption.textContent = queryTitle(view)+' · dashed line shows the contest-wide value';
      chart.update(view);
      showDetail();
      return;
    }
    const method = state.method, candidate = Number(a.value), other = Number(b.value);
    const otherRace = contests[Number(race.value)];
    const rows = [];
    let votesA = 0, votesB = 0, totalA = 0, totalB = 0, eligible = 0;
    for (const row of view.included) {
      if (!row.total || !row.ballots) continue;
      eligible++;
      const second = otherRace.precincts[row.precinct];
      const profile = demographics?.precincts?.[row.precinct];
      const denominator = compare ? second?.cast[method] : profile?.vap;
      if (!denominator) continue;
      const numerator = compare ? second.votes[other][method] : profile[group.value];
      const first = row.result.votes[candidate][method];
      const point = { ...row, y:first/row.total, metric:{value:numerator/denominator},
        color:choiceColor(view.contest,candidate) };
      rows.push(point);
      plotted.set(row.precinct,point);
      votesA += first;
      totalA += row.total;
      votesB += numerator;
      totalB += denominator;
    }
    const count = number(rows.length);
    if (compare) {
      comparison = comparisonMap(view,plotted,
        view.contest.choices[candidate].name,otherRace.choices[other].name,otherRace.name);
      caption.textContent = rows.length
        ? `${count} shared precincts · pooled A − B ${gap(votesA/totalA-votesB/totalB)} · dashed line shows equal shares. Each share uses valid votes in its own contest.`
        : 'No precincts reported valid votes in both races for this voting method.';
    } else {
      const r = correlation(rows);
      caption.textContent = demographics
        ? `${count} of ${number(eligible)} precincts with valid votes have a Census match${r == null ? '' : ' · Pearson r '+r.toFixed(2)}. Precinct-level association using 2020 voting-age population.`
        : 'Census profiles are unavailable.';
    }
    chart.update({ ...view, rows, included:rows, countyMetric:null, query:{measure:'share'},
      scatter:{parity:compare, xLabel:compare ? 'Candidate B share (%)' : groups[group.value]+' VAP (%)',
        coverage:census && demographics ? '2024 VTDs matched at ≥98% overlap in both directions.' : ''} });
    showDetail();
  }

  function change() {draw();onComparisonChange();}
  mode.onchange = group.onchange = b.onchange = a.onchange = change;
  race.onchange = () => {updateB();change();};
  compareButton.onclick = () => {
    mode.value = mode.value === 'compare' ? 'distribution' : 'compare';
    change();
  };
  return {
    update(nextView, nextState) {
      const changed = view !== nextView;
      view = nextView;
      state = nextState;
      if (state.contest !== previousContest || state.choice !== previousChoice) {
        addOptions(a, view.contest.choices, optionLabel);
        a.value = String(state.choice);
        previousContest = state.contest;
        previousChoice = state.choice;
        if (!b.options.length) updateB();
      }
      if (changed) draw();
      else showDetail();
    },
    setDemographics(data) {demographics = data; if (view && mode.value === 'census') draw();},
    describe,
    comparison:()=>comparison,
  };
}
