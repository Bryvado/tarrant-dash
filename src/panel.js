import { choiceColor } from './color.js';
import { rankVotes, isTie, number, formatMetric } from './metrics.js';

const el = (tag,text='',className='') => {
  const node=document.createElement(tag);
  node.textContent=text;
  node.className=className;
  return node;
};
const percent = (votes,total) => total ? `${(votes*100/total).toFixed(1)}%` : '—';
export const partyChip = (party,color) => {
  const chip=el('span',party || '','chip');
  chip.style.setProperty('--chip-color',color);
  return chip;
};

function bar(view, entry, total, winner) {
  const { index,count }=entry;
  const choice=view.contest.choices[index];
  const color=choiceColor(view.contest,index);
  const row=el('div','','choice-row');
  const name=el('span',choice.name,'choice-name');
  if (choice.party) name.append(partyChip(choice.party,color));
  if (winner) name.append(el('span','Winner','winner'));
  const track=el('div','','bar-track');
  const fill=el('i');
  fill.style.width = total ? `${100*count/total}%`:'0%';
  fill.style.backgroundColor=color;
  track.append(fill);
  row.append(name,el('span',number(count),'choice-count'),el('span',percent(count,total),'choice-share'),track);
  return row;
}

export function renderSummary(host, view) {
  const ranked=rankVotes(view.totals), [leader,second]=ranked;
  const tied=isTie(ranked);
  host.replaceChildren(el('h2',view.contest.name,'contest-title'));
  if (view.total && second) host.append(el('p',tied ? 'Countywide tie' :
    `Countywide lead ${formatMetric((leader.count-second.count)/view.total,'margin')}`,'muted'));
  const others=[];
  for (const entry of ranked) {
    const choice=view.contest.choices[entry.index];
    if (entry!==leader && (/write.in|\(w\)/i.test(choice.name) || (view.total && entry.count/view.total<.005))) others.push(entry);
    else host.append(bar(view,entry,view.total,entry===leader && !!view.total && !tied));
  }
  if (others.length) {
    const details=el('details','','other-choices');
    details.append(el('summary',`Write-ins & others (${others.length})`),...others.map(entry=>bar(view,entry,view.total,false)));
    host.append(details);
  }
  host.append(el('p',`${view.included.filter(row=>row.total>0).length} of ${view.included.length} precincts in this contest reported votes`,'muted'));
}

export function renderPrecinct(host, view, id, chairs, demographics) {
  const row=view.byId.get(id);
  host.replaceChildren(el('h2',row ? `Precinct ${id}` : 'Precinct'));
  if (!row) {host.append(el('p','Hover to inspect, click to pin.','muted'));return;}
  for (const entry of row.ranked) if (entry.count) host.append(bar(view,entry,row.total,entry===row.ranked[0] && row.status!=='tie'));
  const split=el('div','','method-split');
  const labels=['Mail','Early','Election Day'];
  for (const [index,value] of row.result.cast.slice(0,3).entries()) {
    const part=el('span');
    part.style.flexGrow=value;
    part.title=`${labels[index]}: ${number(value)}`;
    split.append(part);
  }
  split.setAttribute('role','img');
  split.setAttribute('aria-label',row.result.cast.slice(0,3).map((v,i)=>`${labels[i]} ${number(v)}`).join(', '));
  if (row.result.cast[3]) host.append(split,el('p',split.getAttribute('aria-label'),'muted'));
  const grid=el('dl','','precinct-grid');
  for (const [label,value] of [
    ['Ballots',number(row.ballots)],['Valid votes',number(row.total)],['Undervotes',number(row.result.under[view.query.method])],
    ['Overvotes',number(row.result.over[view.query.method])],['Area',`${number(row.area,3)} mi²`],
    ['Map measure',formatMetric(row.metric?.value,view.query.measure)],
  ]) grid.append(el('dt',label),el('dd',value));
  host.append(grid);
  if (row.metric?.value != null && view.countyMetric?.value != null) {
    const delta=row.metric.value-view.countyMetric.value;
    const difference=view.query.measure==='density' ? formatMetric(delta,'density') : formatMetric(delta,'margin');
    host.append(el('p',`${delta>=0?'+':''}${difference} vs. contest-wide measure`,'muted'));
  }
  const census=demographics?.precincts[id];
  if (census) {
    host.append(el('p',`2020 Census · ${number(census.total)} residents · ${number(census.vap)} voting age · VTD ${census.vtd}`,'muted'));
    if (census.vap) host.append(el('p',[
      ['Hispanic','hispvap'],['Anglo','anglovap'],['Black','blackvap'],['Asian','asianvap'],
    ].map(([label,key])=>`${label} ${percent(census[key],census.vap)}`).join(' · ')+' of voting-age population','muted'));
  } else if (demographics) host.append(el('p','No closely matching 2024 VTD for this precinct.','muted'));
  host.append(el('h3','Precinct chairs'));
  for (const [party,label] of [['DEM','Democratic'],['REP','Republican']]) {
    host.append(el('p',`${label} · ${chairs?.[party]?.[id] ?? (chairs?.[party] ? 'No roster record' : 'Load roster')}`));
  }
}

export function renderTooltip(host, view, row) {
  host.replaceChildren(el('strong',`Precinct ${row.precinct}`));
  for (const entry of row.ranked.slice(0,2)) {
    if (row.total) host.append(el('p',`${view.contest.choices[entry.index].name} · ${number(entry.count)} · ${percent(entry.count,row.total)}`));
  }
  const [leader,runner]=row.ranked;
  if (row.total && runner) host.append(el('p',`Leader margin ${formatMetric((leader.count-runner.count)/row.total,'margin')}`));
  host.append(el('p',`${number(row.total)} valid votes · ${number(row.ballots)} ballots`));
  if (row.metric) host.append(el('p',`Map measure ${formatMetric(row.metric.value,view.query.measure)}`));
}
