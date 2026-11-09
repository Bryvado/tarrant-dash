import { SPECIAL, PARTY, choiceColor, rampColor } from './color.js';
import { number } from './metrics.js';
import { METHODS } from './controls.js';

export function queryTitle(view) {
  const { query, contest } = view;
  const name = query.scope === 'winner' ? 'Leader’s' : query.scope === 'total' ? 'Total contest' : contest.choices[query.choice].name;
  if (query.measure === 'density') return query.scope === 'winner' ? 'Net vote density (votes/mi²)' : `${name} density (votes/mi²)`;
  return `${name} ${query.measure === 'share' ? 'share' : 'margin'}`;
}
const make = (tag,text,cls) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (cls) element.className = cls;
  return element;
};
export function legendKey(view, row) {
  if (row.status !== 'data') return row.status;
  const party = view.contest.choices[row.metric.index]?.party;
  return `${party || row.metric.index}:${row.bin}`;
}
export function renderLegend(host, view, aerial) {
  const { query, breaks, rows, contest } = view;
  const data = new Map(), states = new Map();
  const title = make('summary', `${queryTitle(view)} · ${METHODS[query.method]}`);
  const body = make('div','','legend-body');
  host.replaceChildren(title,body);
  const edgeText = edge => query.measure==='density' ? number(edge,2) : number(edge*100);
  const bounds = [0,...breaks];
  for (const row of rows) {
    if (row.status !== 'data') {
      states.set(row.status,(states.get(row.status)||0)+1);
      continue;
    }
    const party = contest.choices[row.metric.index]?.party;
    const id = party || row.metric.index;
    if (!data.has(id)) data.set(id,{
      label:party || contest.choices[row.metric.index]?.name || 'All votes',
      color: row.metric.index===null ? '#217a68' : PARTY[party] || choiceColor(contest,row.metric.index),
      counts:Array(bounds.length).fill(0),
    });
    data.get(id).counts[row.bin]++;
  }
  for (const [id,row] of data) {
    const block = make('div','','legend-row');
    block.append(make('span',row.label,'legend-row-title'));
    const ramp = make('div','','ramp');
    row.counts.forEach((count,bin)=>{
      const cell = make('div','','ramp-cell');
      cell.dataset.legendKey = `${id}:${bin}`;
      const low = edgeText(bounds[bin]);
      const high = bin+1<bounds.length ? edgeText(bounds[bin+1]) : query.measure==='density' || query.measure==='margin' ? '' : '100';
      cell.title = `${low}${high ? '–'+high : '+'} · ${count} precincts`;
      const track = make('div','','ramp-track');
      const bar = make('i');
      bar.style.height = (count ? 3+13*count/Math.max(...row.counts) : 0)+'px';
      track.append(bar);
      const color = make('i','','swatch');
      color.style.backgroundColor = rampColor(row.color,bin,bounds.length,query.measure==='share');
      cell.append(track,color,make('span',low,query.measure==='share'&&bin===5?'threshold':''));
      ramp.append(cell);
    });
    block.append(ramp);
    body.append(block);
  }
  const special = make('div','','special-states');
  for (const [status,count] of states) {
    const meta = SPECIAL[status], entry = make('span',` ${meta.label} (${count})`);
    entry.dataset.legendKey = status;
    entry.prepend(make('i','',`state-swatch ${status}`));
    special.append(entry);
  }
  body.append(special);
  if (query.measure==='margin' && query.scope==='candidate') body.append(make('p','Trailing precincts use the leading choice’s color.'));
  if (aerial) body.append(make('p','Colors over imagery are approximate.'));
}
export function markLegend(host, key) {
  for (const cell of host.querySelectorAll('[data-legend-key]')) cell.classList.toggle('marked',cell.dataset.legendKey===key);
}
