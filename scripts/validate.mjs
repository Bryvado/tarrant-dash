import fs from 'node:fs';import {validate} from '../src/metrics.js';
const manifest=JSON.parse(fs.readFileSync('public/data/manifest.json','utf8'));
let errors=[];for(const e of manifest.elections){errors.push(...validate(JSON.parse(fs.readFileSync(`public/data/${e.file}`,'utf8'))).map(x=>`${e.id}: ${x}`));}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('All election files passed validation.');
