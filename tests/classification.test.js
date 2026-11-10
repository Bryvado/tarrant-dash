import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classification.js';
import { comparisonMap } from '../src/comparison.js';

test('classifiers handle empty, identical, nonfinite and repeated values',()=>{
  for(const method of ['equal','quantile','natural']) {
    assert.deepEqual(classify([],method),[]);
    assert.deepEqual(classify([5,5,NaN,Infinity],method),[]);
    const cuts=classify([1,1,1,2,2,3,3,10,10],method);
    assert.ok(cuts.every((v,i)=>Number.isFinite(v)&&v>1&&(!i||v>cuts[i-1])));
  }
  assert.deepEqual(classify([0,10,20,30,40],'equal'),[8,16,24,32]);
  assert.deepEqual(classify([1,2,3,101,102,103],'natural',2),[52]);
});
test('comparison classifiers keep equal gaps neutral and opposing gaps symmetric',()=>{
  for(const classification of ['fixed','equal','quantile','natural']) {
    const gaps=[-.2,-.05,0,.05,.2];
    const rows=gaps.map((_,i)=>({precinct:String(i),result:{},feature:{type:'Feature',geometry:null}}));
    const points=new Map(gaps.map((gap,i)=>[String(i),{y:.5+gap,metric:{value:.5}}]));
    const result=comparisonMap({query:{classification,palette:'orange-teal'},rows,features:{},contest:{name:'Race A'}},points,'A','B','Race B');
    assert.equal(result.view.rows[2].color,'#efede6');
    assert.equal(result.bins.reduce((s,b)=>s+b.count,0),5);
    assert.ok(result.view.rows.every(r=>/^#[0-9a-f]{6}$/.test(r.color)));
    assert.equal(Number(result.keys.get('0'))+Number(result.keys.get('4')),result.bins.length-1);
  }
});
