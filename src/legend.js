import { SCALES } from './classification.js';
import { SPECIAL, mapRamp, displayBin } from './color.js';
import { number } from './metrics.js';
import { METHODS } from './controls.js';

export function queryTitle(view) {
  const {query,contest}=view;
  const name=query.scope==='winner'?'Leader’s':query.scope==='total'?'Total contest':contest.choices[query.choice].name;
  if(query.measure==='density')return query.scope==='winner'?'Net vote density (votes/mi²)':name+' density (votes/mi²)';
  return name+' '+(query.measure==='share'?'share':'margin');
}
const make=(tag,text='',cls='')=>{
  const node=document.createElement(tag);node.textContent=text;node.className=cls;return node;
};
export function legendKey(view,row){
  if(row.status!=='data')return row.status;
  const id=view.contest.choices[row.metric.index]?.party || String(row.metric.index);
  return id+':'+displayBin(row,view);
}
function legend(host,title,bins,special,description,ticks){
  const summary=make('summary'), strip=make('div','','compact-bins');
  summary.append(make('span',title,'legend-title'));
  const maximum=Math.max(1,...bins.map(bin=>bin.count));
  for(const bin of bins){
    const button=make('button','','legend-bin');
    button.type='button';button.dataset.filterKey=bin.key;button.dataset.legendKey=bin.key;
    button.setAttribute('aria-label',bin.label+' · '+bin.count+' precincts');
    button.title=button.getAttribute('aria-label');
    button.setAttribute('aria-pressed','false');
    const bar=make('i'),color=make('b');
    bar.style.height=(bin.count?2+12*bin.count/maximum:0)+'px';
    color.style.backgroundColor=bin.color;
    button.append(bar,color);strip.append(button);
  }
  const mini=make('span','','legend-mini');
  for(const [key,count] of special)if(count && key!=='outside'){
    const swatch=make('i','','state-swatch '+key);swatch.title=SPECIAL[key].label+' ('+count+')';mini.append(swatch);
  }
  summary.firstChild.append(mini);
  summary.append(strip);
  const tickRow=make('div','','legend-ticks');
  ticks.forEach(tick=>tickRow.append(make('span',tick)));
  summary.append(tickRow);
  const detail=make('div','','legend-detail');
  detail.append(make('p',description));
  for(const bin of bins)detail.append(make('p',bin.label+' · '+bin.count));
  const states=make('div','','legend-special');
  for(const [key,count] of special){
    if(!count || key==='outside')continue;
    const meta=SPECIAL[key],button=make('button',meta.label+' ('+count+')');
    button.type='button';button.dataset.filterKey=key;button.dataset.legendKey=key;
    button.prepend(make('i','','state-swatch '+key));states.append(button);
  }
  detail.append(states,make('p','Select a bin to highlight the map and filter the chart.'));
  host.replaceChildren(summary,detail);
}
export function renderLegend(host,view,aerial){
  const groups=new Map(),states=new Map();
  for(const row of view.rows){
    if(row.status!=='data'){states.set(row.status,(states.get(row.status)||0)+1);continue;}
    const index=row.metric.index,id=view.contest.choices[index]?.party || String(index);
    if(!groups.has(id))groups.set(id,{label:view.contest.choices[index]?.party || view.contest.choices[index]?.name || 'All votes',
      colors:mapRamp(view.contest,index,view.query.palette),
      counts:[0,0,0,0,0]});
    groups.get(id).counts[displayBin(row,view)]++;
  }
  const bins=[];
  const ordered=[...groups].sort(([a],[b])=>(a==='REP'?-1:a==='DEM'?1:0)-(b==='REP'?-1:b==='DEM'?1:0));
  for(const [id,group] of ordered){
    const steps=id==='REP'?[4,3,2,1,0]:[0,1,2,3,4];
    for(const i of steps){
      const edges=[0,...view.breaks];
      const indices=edges.map((_,index)=>index).filter(index=>Math.min(4,Math.floor(index*5/edges.length))===i);
      if(!indices.length)continue;
      const low=edges[indices[0]], next=edges[indices[indices.length-1]+1];
      const format=value=>view.query.measure==='density'?number(value,2):number(value*100);
      const range=format(low)+(next==null?'+':'–'+format(next));
      bins.push({key:id+':'+i,color:group.colors[i],count:group.counts[i],label:group.label+' · '+range+(view.query.measure==='share'?'%':view.query.measure==='margin'?' pp':' votes/mi²')});
    }
  }
  const ticks=view.query.measure==='share'?(view.query.classification && view.query.classification!=='fixed'?['Lower share','Higher share']:['0','50','100%']):view.query.measure==='margin'?['Lower margin','Higher margin']:['Lower density','Higher density'];
  legend(host,queryTitle(view),bins,states,METHODS[view.query.method]+' · '+SCALES[view.query.classification || 'fixed'][0]+(aerial?' · Colors over imagery are approximate.':''),ticks);
}
export function renderComparisonLegend(host,comparison,method,aerial){
  const bins=comparison.bins.map((bin,i)=>({...bin,key:String(i)}));
  legend(host,'Vote share gap',bins,new Map([['unshared',comparison.unavailable]]),
    'A · '+comparison.candidateA+' / B · '+comparison.candidateB+' · '+METHODS[method]+' · '+SCALES[comparison.view.query.classification || 'fixed'][0]+(comparison.view.query.classification && comparison.view.query.classification!=='fixed'?' · Classified by absolute gap; equal shares stay neutral.':''),
    ['B higher','Equal','A higher']);
}
export function markLegend(host,key){
  for(const cell of host.querySelectorAll('[data-legend-key]'))cell.classList.toggle('marked',cell.dataset.legendKey===key);
}
