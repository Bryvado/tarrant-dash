import { formatMetric, number } from './metrics.js';
import { queryTitle } from './legend.js';

const NS='http://www.w3.org/2000/svg';
function element(tag, attributes, text) {
  const result=document.createElementNS(NS,tag);
  Object.entries(attributes).forEach(([key,value])=>result.setAttribute(key,value));
  if (text) result.textContent=text;
  return result;
}
// Fit each contest independently; retain every plotted point and the county reference.
export function chartAxis(values, { min=0, max=Infinity, log=false, baseline=false, minStep=0 }={}) {
  const forward=log ? Math.log1p : value=>value;
  const inverse=log ? Math.expm1 : value=>value;
  const finite=values.filter(Number.isFinite).map(forward);
  let low=baseline ? forward(min) : Math.min(...finite);
  let high=Math.max(...finite);
  if (!finite.length) { low=0; high=1; }
  const padding=Math.max((high-low)*.05, log?.02:.005);
  low=Math.max(forward(min),low-padding);
  high=Math.min(forward(max),high+padding);
  if (high<=low) high=low+1;
  const rough=(high-low)/4;
  const magnitude=10**Math.floor(Math.log10(rough));
  const step=Math.max(minStep,[1,2,2.5,5,10].find(value=>value*magnitude>=rough)*magnitude);
  low=Math.max(forward(min),Math.floor(low/step)*step);
  high=Math.min(forward(max),Math.ceil(high/step)*step);
  const ticks=[];
  if (log) {
    if (low===0) ticks.push(0);
    for (let power=-3;power<=12;power++) {
      for (const multiplier of [1,2,5]) {
        const value=multiplier*10**power;
        if (forward(value)>=low && forward(value)<=high) ticks.push(value);
      }
    }
  } else {
    for (let value=Math.ceil(low/step)*step;value<=high+step*1e-8;value+=step) {
      ticks.push(Number(value.toPrecision(12)));
    }
  }
  return { min:inverse(low),max:inverse(high),ticks,
    position:value=>(forward(value)-low)/(high-low) };
}
export function createChart(svg, excluded, events) {
  let view, positions=new Map(), dots=[], active=0, hovered='', selected='', hoverRing, pinRing;
  const observer=new ResizeObserver(()=>{if(view) draw();});
  observer.observe(svg);
  function ring(target,id) {
    const point=positions.get(id);
    if (!target) return;
    target.style.display=point?'':'none';
    if (point) {
      target.setAttribute('cx',point.x);
      target.setAttribute('cy',point.y);
    }
  }
  function draw() {
    const width=svg.clientWidth, height=svg.clientHeight;
    if (!width || !height) return;
    const { query,rows,countyMetric,scatter }=view;
    const yValue=row=>scatter ? row.y : row.total;
    dots=rows.filter(row=>row.ballots>0 && row.total>0 && row.metric?.value!=null)
      .sort((a,b)=>a.metric.value-b.metric.value || a.precinct.localeCompare(b.precinct));
    const density=query.measure==='density';
    const xAxis=chartAxis([...dots.map(row=>row.metric.value),countyMetric?.value], {
      min:query.measure==='margin'&&query.scope==='candidate'?-1:0,
      max:density?Infinity:1,log:density,
    });
    const yAxis=chartAxis(dots.map(yValue),scatter ? {max:1} : {baseline:true,minStep:1});
    const left=57,right=width-18,top=12,bottom=height-45;
    // Extra screen-space padding keeps edge points and selection rings visible.
    const x=v=>left+8+xAxis.position(v)*(right-left-16);
    const y=v=>bottom-8-yAxis.position(v)*(bottom-top-16);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.replaceChildren();
    positions=new Map();
    const append=(tag,attrs,text)=>{const node=element(tag,attrs,text);svg.append(node);return node;};
    for (const value of yAxis.ticks) {
      const yy=y(value);
      append('line',{x1:left,x2:right,y1:yy,y2:yy,class:'grid-line'});
      append('text',{x:left-5,y:yy+4,'text-anchor':'end'},number(scatter ? value*100 : value,2));
    }
    let lastTick=-Infinity;
    for (const value of xAxis.ticks) {
      const xx=x(value);
      if (xx-lastTick<42) continue;
      lastTick=xx;
      append('line',{x1:xx,x2:xx,y1:top,y2:bottom,class:'grid-line'});
      const label=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(density?value:value*100);
      append('text',{x:xx,y:bottom+17,'text-anchor':'middle'},label);
    }
    for (const [value,className] of (scatter ? [] : [[query.measure==='share'?.5:query.measure==='margin'?0:null,'reference'],[countyMetric?.value,'county-reference']])) {
      if (value==null || value<xAxis.min || value>xAxis.max) continue;
      append('line',{x1:x(value),x2:x(value),y1:top,y2:bottom,class:className});
    }
    if (scatter?.parity) {
      const low=Math.max(xAxis.min,yAxis.min), high=Math.min(xAxis.max,yAxis.max);
      if (high>low) append('line',{x1:x(low),x2:x(high),y1:y(low),y2:y(high),class:'county-reference'});
    }
    append('text',{x:(left+right)/2,y:height-7,'text-anchor':'middle'},scatter?.xLabel ?? (density?'Votes/mi² · log scale':query.measure==='share'?'Share (%)':'Margin (pp)'));
    append('text',{x:10,y:(top+bottom)/2,'text-anchor':'middle',transform:`rotate(-90 10 ${(top+bottom)/2})`},scatter ? 'Candidate A share (%)' : 'Valid votes');
    for (const [index,row] of dots.entries()) {
      const point={x:x(row.metric.value),y:y(yValue(row))};
      positions.set(row.precinct,point);
      const dot=append('circle',{cx:point.x,cy:point.y,r:3.4,fill:row.color,'fill-opacity':.65,
        'data-chart-precinct':row.precinct,id:'chart-point-'+row.precinct,role:'option',
        'aria-label':`Precinct ${row.precinct}, ${formatMetric(row.metric.value,query.measure)}, ${scatter ? formatMetric(row.y,'share')+' candidate A share' : number(row.total)+' votes'}`});
      dot.onpointerenter=event=>{active=index;events.hover(row.precinct,event);};
      dot.onclick=()=>events.pin(row.precinct,true);
    }
    hoverRing=append('circle',{r:6,fill:'none',stroke:'#17241e','stroke-width':1.5,'pointer-events':'none'});
    pinRing=append('circle',{r:8,fill:'none',stroke:'#17241e','stroke-width':2,'pointer-events':'none'});
    ring(hoverRing,hovered);
    ring(pinRing,selected);
    const zero=view.included.filter(row=>row.ballots===0).length;
    const noVotes=view.included.filter(row=>row.ballots>0 && !row.total).length;
    const noMetric=view.included.length-dots.length-zero-noVotes;
    excluded.textContent=[
      zero&&`${zero} with zero ballots`,noVotes&&`${noVotes} with zero valid votes`,
      noMetric&&`${noMetric} without a comparable measure`,view.rows.length-view.included.length&&`${view.rows.length-view.included.length} outside this contest`,
    ].filter(Boolean).join(' · ');
    if (excluded.textContent) excluded.textContent += ' omitted.';
    if (scatter) excluded.textContent=scatter.coverage;
    svg.setAttribute('aria-label',`${scatter ? scatter.xLabel+' by candidate A share' : queryTitle(view)+' by valid contest votes'}. Use arrow keys to inspect and Enter to pin.`);
  }
  function focusPoint() {
    const row=dots[active];
    if (!row) return;
    svg.setAttribute('aria-activedescendant','chart-point-'+row.precinct);
    const point=positions.get(row.precinct), rect=svg.getBoundingClientRect();
    events.hover(row.precinct,{clientX:rect.left+point.x,clientY:rect.top+point.y});
  }
  svg.onkeydown=event=>{
    if (!dots.length) return;
    if (['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      active=(active+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)+dots.length)%dots.length;
      focusPoint();
    }
    if (event.key==='Enter') {event.preventDefault();events.pin(dots[active].precinct,true);}
  };
  svg.onfocus=focusPoint;
  svg.onblur=()=>events.hover('');
  svg.onpointerleave=()=>events.hover('');
  return {update(next){view=next;active=0;draw();},
    hover(id){hovered=id;ring(hoverRing,id);},pin(id){selected=id;ring(pinRing,id);}};
}
