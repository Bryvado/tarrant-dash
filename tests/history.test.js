import test from 'node:test';
import assert from 'node:assert/strict';
import {partyResult,historyRows} from '../src/history.js';
const choices=[{party:'DEM'},{party:'REP'},{party:'LIB'}];
test('historical shifts use all valid votes, signed party margins and matched areas',()=>{
 const a={choices,precincts:{'1001':[40,55,5],'1002':[0,0,0],'1003':[50,50,0]}};
 const b={choices,precincts:{'1001':[60,35,5],'1002':[1,1,0],'@1003':[70,30,0]}};
 const rows=historyRows(a,b,'DEM',{'1001':'4001'}),r=rows.find(r=>r.key==='1001');
 assert.equal(r.a.share,.4);assert.equal(r.b.share,.6);assert.equal(r.a.margin,-.15);assert.equal(r.b.margin,.25);
 assert.ok(Math.abs(r.shift-.2)<1e-12);assert.equal(r.marginShift,.4);assert.equal(r.voteChange,20);assert.equal(r.precinct,'4001');
 assert.ok(rows.filter(r=>r.key!=='1001').every(r=>r.shift===null));
 assert.equal(historyRows(b,b,'DEM').find(r=>r.key==='@1003').shift,0);
});
test('missing party or zero denominator never becomes a zero share; uncontested margin missing',()=>{
 assert.equal(partyResult([0,0,0],choices,'DEM'),null);
 assert.equal(partyResult([50],[{party:'REP'}],'DEM'),null);
 assert.equal(partyResult([50],[{party:'DEM'}],'DEM').margin,null);
 assert.equal(partyResult([40,55,5],choices,'REP').margin,.15);
});

import fs from 'node:fs';
test('bundled historical records have valid counts, totals and unique boundary matches',()=>{
 const base=new URL('../public/data/',import.meta.url);
 const manifest=JSON.parse(fs.readFileSync(new URL('history.json',base)));
 assert.equal(new Set(Object.values(manifest.crosswalk)).size,Object.keys(manifest.crosswalk).length);
 for(const {file} of manifest.years){
  const data=JSON.parse(fs.readFileSync(new URL(file,base)));
  for(const race of data.contests){
   const sums=race.choices.map(()=>0);
   for(const votes of Object.values(race.precincts)){
    assert.equal(votes.length,race.choices.length);
    votes.forEach((n,i)=>{assert.ok(Number.isInteger(n)&&n>=0);sums[i]+=n;});
   }
   assert.deepEqual(sums,race.totals);
  }
 }
});
