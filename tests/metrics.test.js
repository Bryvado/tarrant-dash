import test from 'node:test';import assert from 'node:assert/strict';import {share,margin,lean,key,validate} from '../src/metrics.js';
test('zero denominators remain missing',()=>{assert.equal(share(0,0),null);assert.equal(margin(0,0),null);assert.equal(lean(1,2,0,0),null)});
test('two-party margin and county-relative lean',()=>{assert.equal(margin(60,40),.2);assert.equal(lean(60,40,500,500),.2)});
test('precinct keys retain geography vintage',()=>assert.notEqual(key('2024','1001'),key('2026','1001')));
test('reject malformed records',()=>assert.ok(validate({type:'FeatureCollection',features:[{properties:{},geometry:null}]}).length));
