import test from 'node:test';
import assert from 'node:assert/strict';
import { netDensity, grossDensity, queryMetric, isTie, rankVotes, binIndex, MARGIN_BREAKS, densityBreaks } from '../src/metrics.js';
import { choiceColor, toOklch, NONPARTISAN, PROPOSITION, PARTY, SPECIAL } from '../src/color.js';

test('density scopes use net winner votes, gross candidate votes or all valid votes', () => {
  assert.equal(netDensity(30, 20, 2), 5);
  assert.equal(grossDensity(30, 2), 15);
  assert.equal(netDensity(30, 20, 0), null);
  for (const [scope, value] of [['winner',5],['candidate',10],['total',28]]) {
    assert.equal(queryMetric([30,20,6],56,2,{measure:'density',scope,choice:1}).value,value);
  }
});
test('margin bins include their lower edge and density quantiles deduplicate', () => {
  assert.deepEqual([0,.0499,.05,.10,.20,.30,.50,1].map(v=>binIndex(v,MARGIN_BREAKS)),[0,0,1,2,3,4,5,5]);
  assert.deepEqual(densityBreaks([0,2,2,2,2,2]),[2]);
});
test('nonpartisan and proposition hues avoid red and blue by more than 25 OKLCH degrees', () => {
  for (const color of [...NONPARTISAN,...Object.values(PROPOSITION)]) {
    for (const party of [PARTY.DEM,PARTY.REP]) {
      const delta = Math.abs(toOklch(color)[2] - toOklch(party)[2]);
      assert.ok(Math.min(delta,360-delta)>25, color);
    }
  }
  assert.ok(toOklch(SPECIAL.tie.color)[1] < .001, 'gray tie treatment is achromatic');
});
test('proposition colors follow the choice label, regardless of order', () => {
  const contest = { choices:[{name:' Against '},{name:'FOR'}] };
  assert.equal(choiceColor(contest,0), PROPOSITION.against);
  assert.equal(choiceColor(contest,1), PROPOSITION.for);
});
test('only positive top-vote ties count, and a trailing margin uses the leading choice', () => {
  assert.equal(isTie(rankVotes([5,5,0])),true);
  assert.equal(isTie(rankVotes([0,0])),false);
  assert.equal(isTie(rankVotes([6,5,5])),false);
  assert.deepEqual(queryMetric([6,4],10,1,{measure:'margin',scope:'candidate',choice:1}),{value:-.2,index:0});
});
