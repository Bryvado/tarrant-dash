import { formatMetric, number } from './metrics.js';
import { queryTitle } from './legend.js';

const NS='http://www.w3.org/2000/svg';
function element(tag, attributes, text) {
  const result=document.createElementNS(NS,tag);
  Object.entries(attributes).forEach(([key,value])=>result.setAttribute(key,value));
  if (text) result.textContent=text;
  return result;
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
    const { query,rows,countyMetric }=view;
    dots=rows.filter(row=>row.ballots>0 && row.total>0 && row.metric?.value!=null)
      .sort((a,b)=>a.metric.value-b.metric.value || a.precinct.localeCompare(b.precinct));
    const maxY=Math.max(1,...dots.map(row=>row.total));
    const density=query.measure==='density';
    const minX=query.measure==='margin'&&query.scope==='candidate'?-1:0;
    const maxX=density ? Math.max(1,countyMetric?.value||0,...dots.map(row=>row.metric.value)) : 1;
    const left=57,right=width-14,top=12,bottom=height-45;
    const x=v=>left+(density?Math.log1p(v)/Math.log1p(maxX):(v-minX)/(maxX-minX))*(right-left);
    const y=v=>bottom-v/maxY*(bottom-top);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.replaceChildren();
    positions=new Map();
    const append=(tag,attrs,text)=>{const node=element(tag,attrs,text);svg.append(node);return node;};
    for (let i=0;i<=4;i++) {
      const value=i*maxY/4, yy=y(value);
      append('line',{x1:left,x2:right,y1:yy,y2:yy,class:'grid-line'});
      append('text',{x:left-5,y:yy+4,'text-anchor':'end'},number(Math.round(value)));
    }
    const ticks=density ? [0,...[1,10,100,1000,10000,100000,1000000].filter(v=>v<maxX && x(v)>left+15)] : [minX,(minX+1)/2,1];
    const sparse=ticks.filter((v,i)=>i===0 || x(v)-x(ticks[i-1])>24);
    for (const value of sparse) {
      const xx=x(value);
      append('line',{x1:xx,x2:xx,y1:top,y2:bottom,class:'grid-line'});
      append('text',{x:xx,y:bottom+17,'text-anchor':'middle'},number(density?value:value*100));
    }
    for (const [value,className] of [[query.measure==='share'?.5:query.measure==='margin'?0:null,'reference'],[countyMetric?.value,'county-reference']]) {
      if (value==null || value<minX || value>maxX) continue;
      append('line',{x1:x(value),x2:x(value),y1:top,y2:bottom,class:className});
    }
    append('text',{x:(left+right)/2,y:height-7,'text-anchor':'middle'},density?'Votes/mi² · log scale':query.measure==='share'?'Share (%)':'Margin (pp)');
    append('text',{x:10,y:(top+bottom)/2,'text-anchor':'middle',transform:`rotate(-90 10 ${(top+bottom)/2})`},'Valid votes');
    for (const [index,row] of dots.entries()) {
      const point={x:x(row.metric.value),y:y(row.total)};
      positions.set(row.precinct,point);
      const dot=append('circle',{cx:point.x,cy:point.y,r:3.4,fill:row.color,'fill-opacity':.65,
        'data-chart-precinct':row.precinct,id:'chart-point-'+row.precinct,role:'option',
        'aria-label':`Precinct ${row.precinct}, ${formatMetric(row.metric.value,query.measure)}, ${number(row.total)} votes`});
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
    svg.setAttribute('aria-label',`${queryTitle(view)} by valid contest votes. Use arrow keys to inspect and Enter to pin.`);
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
