import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftBin,shiftColor,SHIFT_COLORS,aboveThreshold,contextBounds} from '../src/shift.js';
import {historyRows} from '../src/history.js';
import fs from 'node:fs';
test('shift scale preserves neutral range and all requested gain/loss breaks',()=>{
 assert.equal(shiftColor(0),'#efede6');assert.equal(shiftBin(-.019),4);assert.equal(shiftBin(.019),4);
 assert.deepEqual([-.16,-.14,-.09,-.04,0,.04,.09,.14,.16].map(shiftColor),SHIFT_COLORS);
});
test('vote floor applies to the selected party in BOTH years, including zero-to-five artifacts',()=>{
 assert.equal(aboveThreshold({a:{votes:0,total:100},b:{votes:5,total:6}},50),false);
 assert.equal(aboveThreshold({a:{votes:51},b:{votes:49}},50),false);
 assert.equal(aboveThreshold({a:{votes:50},b:{votes:50}},50),true);
});
test('default comparison largest shifts all pass the floor',()=>{
 const read=n=>JSON.parse(fs.readFileSync(new URL('../public/data/'+n,import.meta.url)));
 const a=read('history-2024.json').contests.find(c=>c.name==='United States Senator'),manifest=read('history.json'),b=read('official.json').contests.find(c=>c.name==='United States Senator');
 const after={...b,precincts:Object.fromEntries(Object.entries(b.precincts).map(([p,r])=>[manifest.crosswalk[p]??'@'+p,r.votes.map(v=>v[3])]))};
 const rows=historyRows(a,after,'DEM').filter(r=>r.shift!=null&&aboveThreshold(r,50)).sort((a,b)=>Math.abs(b.shift)-Math.abs(a.shift));
 assert.ok(rows.length>400);for(const r of rows.slice(0,10)){assert.ok(r.a.votes>=50);assert.ok(r.b.votes>=50);}
});
test('precinct camera includes approximately 1.5 km on all sides',()=>{
 const b=contextBounds([[-97.3,32.7],[-97.29,32.71]]);assert.ok(b[0][0]<-97.31);assert.ok(b[0][1]<32.69);assert.ok(b[1][0]>-97.28);assert.ok(b[1][1]>32.72);
});
