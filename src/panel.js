import { choiceColor } from './color.js';
import { METHODS } from './controls.js';
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
  const heading=el('h2',view.total ? (tied ? 'Tied contest' : view.contest.choices[leader.index].name) : view.contest.name,'contest-title');
  if(view.total && second) heading.append(el('span',`+${number(100*(leader.count-second.count)/view.total,1)} pp`,'lead-pill'));
  host.replaceChildren(heading,el('p',view.contest.name,'muted'));
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

export function renderPrecinct(host, view, id, chairs, demographics, comparison) {
  const row=view.byId.get(id);
  host.replaceChildren(el('h2',row ? `Precinct ${id}` : 'Precinct'));
  if (!row) {host.replaceChildren(el('p','Hover a precinct · click to pin','muted'));return;}
  const actions=el('span','','inspector-actions');
  for(const [id,title,icon] of [['copy-precinct','Copy link','⧉'],['clear-precinct','Clear','×']]){
    const button=el('button',icon);button.id=id;button.type='button';button.title=title;button.setAttribute('aria-label',title);
    if(id==='copy-precinct')button.innerHTML='<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 7h10v10H7zM3 13V3h10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    actions.append(button);
  }
  host.firstChild.append(actions);
  if (comparison) host.append(el('p',comparison));
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
    ...(comparison ? [] : [[precinctMetric(view,row).label,formatMetric(row.metric?.value,view.query.measure)]]),
  ]) grid.append(el('dt',label),el('dd',value));
  host.append(grid);
  if (!comparison && row.metric?.value != null && view.countyMetric?.value != null) {
    const delta=row.metric.value-view.countyMetric.value;
    const difference=view.query.measure==='density' ? formatMetric(delta,'density') : formatMetric(delta,'margin');
    host.append(el('p',`${delta>=0?'+':''}${difference} vs. contest-wide measure`,'muted'));
  }
  const roster=el('details','','chair-disclosure');
  roster.append(el('summary','Precinct chairs'));
  for(const [party,label] of [['DEM','Democratic'],['REP','Republican']]){
    roster.append(el('p',`${label} · ${chairs?.[party]?.[id] ?? 'Roster unavailable'}`));
  }
  host.append(roster);
  const census=demographics?.precincts[id];
  if (census) {
    host.append(el('p',`2020 Census · ${number(census.total)} residents · ${number(census.vap)} voting age · VTD ${census.vtd}`,'muted'));
    if (census.vap) host.append(el('p',[
      ['Hispanic','hispvap'],['Anglo','anglovap'],['Black','blackvap'],['Asian','asianvap'],
    ].map(([label,key])=>`${label} ${percent(census[key],census.vap)}`).join(' · ')+' of voting-age population','muted'));
  } else if (demographics) host.append(el('p','No closely matching 2024 VTD for this precinct.','muted'));

}

export function renderComparisonTooltip(host, comparison, id) {
  const header=el('div','','comparison-tip-header');
  header.append(el('strong',`Precinct ${id}`));
  host.replaceChildren(header);
  const point=comparison.points.get(id);
  if (!point) {
    host.append(el('p','No valid votes in one or both contests.','muted'));
    return;
  }
  const shareA=point.y, shareB=point.metric.value;
  const difference=shareA-shareB;
  const side=difference > 1e-12 ? 'a' : difference < -1e-12 ? 'b' : '';
  const magnitude=Math.abs(difference)*100;
  const gap=side ? `${side.toUpperCase()} +${magnitude < .05 ? '<0.1' : magnitude.toFixed(1)} pp` : 'Equal shares';
  header.append(el('span',gap,'comparison-tip-gap '+side));
  for (const [side,name,contest,share,votes,totalVotes] of [
    ['A',comparison.candidateA,comparison.contestA,shareA,point.countA,point.total],
    ['B',comparison.candidateB,comparison.contestB,shareB,point.countB,point.totalB],
  ]) {
    const row=el('div','','comparison-tip-row');
    const label=el('div','','comparison-tip-name');
    label.append(el('strong',name),el('span',contest,'muted'));
    row.append(el('span',side,'comparison-tip-tag '+side.toLowerCase()),
      label,el('strong',`${(share*100).toFixed(1)}%`,'comparison-tip-share'));
    if (Number.isFinite(votes)) row.append(el('span',`${number(votes)} votes of ${number(totalVotes)}`,'muted'));
    host.append(row);
  }
}

function precinctMetric(view, row) {
  const {measure,scope,choice}=view.query;
  const leader=scope==='winner';
  const subject=leader ? row.ranked[0] : row.ranked.find(entry=>entry.index===choice);
  const rival=row.ranked.find(entry=>entry.index!==subject?.index);
  const name=entry=>view.contest.choices[entry.index].name;
  if (measure==='share') {
    return {label:leader?'Leading vote share':'Selected candidate’s vote share',
      context:subject ? name(subject)+(leader && isTie(row.ranked) ? ' · tied for first' : '') : ''};
  }
  if (measure==='margin') {
    return {label:leader?'Winning margin':'Selected candidate’s margin',
      context:subject && rival ? `${name(subject)} vs. ${name(rival)}` : '',
      empty:'Margin needs at least two choices.'};
  }
  const area=`${number(row.area,3)} mi²`;
  if (scope==='total') return {label:'Total vote density',context:`${number(row.total)} valid votes across ${area}`};
  const votes=subject?.count ?? 0;
  if (!leader) return {label:'Candidate vote density',context:`${subject ? name(subject)+' · ' : ''}${number(votes)} votes across ${area}`};
  const net=votes-(rival?.count ?? 0);
  return {label:'Net vote density',
    context:subject ? `${name(subject)} · ${number(net)} net votes across ${area}` : '',
    detail:rival ? `Net votes above ${name(rival)}` : ''};
}

export function renderTooltip(host, view, row) {
  const {method,measure,scope,choice}=view.query;
  const header=el('div','','comparison-tip-header');
  header.append(el('strong',`Precinct ${row.precinct}`),el('span',METHODS[method],'muted'));
  host.replaceChildren(header);
  if (!row.total) {
    host.append(el('p','No valid votes for this contest and voting method.','muted'));
    return;
  }
  const metric=precinctMetric(view,row);
  const headline=el('div','','precinct-tip-metric');
  const value=row.metric?.value;
  const signed=measure==='margin' && scope==='candidate' && value>0 ? '+' : '';
  headline.append(el('span',metric.label,'muted'),
    el('strong',value==null ? 'Unavailable' : signed+formatMetric(value,measure)));
  host.append(headline);
  if (value==null) {
    host.append(el('p',metric.empty ?? 'Precinct area is unavailable.','muted'));
  } else {
    host.append(el('p',metric.context,'precinct-tip-context'));
    if (metric.detail) host.append(el('p',metric.detail,'muted'));
  }
  // Show every choice, including write-ins and zero-vote candidates.
  const candidates=row.ranked;
  const results=el('div','','precinct-tip-results');
  for (const {count,index} of candidates) {
    const line=el('div','','precinct-tip-result');
    const dot=el('span','','precinct-tip-dot');
    dot.style.backgroundColor=choiceColor(view.contest,index);
    line.append(dot,el('span',view.contest.choices[index].name),
      el('span',number(count),'muted'),el('strong',percent(count,row.total)));
    results.append(line);
  }
  host.append(results,el('p',`${number(row.total)} valid votes`,'muted'));
}
