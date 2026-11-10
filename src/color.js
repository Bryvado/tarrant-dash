import { binIndex } from './metrics.js';

export const PARTY = { DEM: '#2b62a8', REP: '#c0392f', LIB: '#c99a1c', GRN: '#3f8f4f' };
export const SPECIAL = {
  unshared:{label:'No shared votes',color:'#e4e3de'},
  outside: { label: 'Not in this contest', color: 'transparent' },
  zero: { label: 'No votes reported', color: '#e4e3de', pattern: 'diagonal' },
  tie: { label: 'Tie', color: '#efede6', pattern: 'cross' },
  unavailable: { label: 'No comparable margin', color: '#eae5db', pattern: 'dotted' },
};
export const NONPARTISAN = ['#217a68', '#9e3a86', '#95721d', '#4f823b', '#7752a2', '#3a848c', '#a14f78', '#827831'];
export const PROPOSITION = { for: '#1f8a85', against: '#d07a2a' };

export function choiceColor(contest, index) {
  const choice = contest.choices[index];
  const label = choice.name.trim().toLowerCase();
  if (contest.choices.some(c => c.name.trim().toLowerCase() === 'for') &&
      contest.choices.some(c => c.name.trim().toLowerCase() === 'against') && PROPOSITION[label]) return PROPOSITION[label];
  if (contest.choices.some(c => c.party)) return PARTY[choice.party] ?? '#8a7f72';
  return NONPARTISAN[index % NONPARTISAN.length];
}

const linear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export function toOklch(hex) {
  const [r,g,b] = hex.slice(1).match(/../g).map(s => linear(parseInt(s, 16) / 255));
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  const a = 1.9779984951*l - 2.428592205*m + .4505937099*s;
  const z = .0259040371*l + .7827717662*m - .808675766*s;
  return [.2104542553*l + .793617785*m - .0040720468*s, Math.hypot(a,z), (Math.atan2(z,a)*180/Math.PI+360)%360];
}

function rgbAt(light, chroma, hue) {
  const a = chroma * Math.cos(hue * Math.PI / 180), b = chroma * Math.sin(hue * Math.PI / 180);
  const l = (light + .3963377774*a + .2158037573*b)**3;
  const m = (light - .1055613458*a - .0638541728*b)**3;
  const s = (light - .0894841775*a - 1.291485548*b)**3;
  return [4.0767416621*l - 3.3077115913*m + .2309699292*s, -1.2684380046*l + 2.6097574011*m - .3413193965*s, -.0041960863*l - .7034186147*m + 1.707614701*s];
}
const rgbHex = rgb => '#' + rgb.map(c => Math.round(255 * (c <= .0031308 ? 12.92*c : 1.055*c**(1/2.4)-.055)).toString(16).padStart(2,'0')).join('');
const ramps = new Map();
export function rampColor(base, bin, count, softShare = false) {
  const key = [base, bin, count, softShare].join('/');
  if (!ramps.has(key)) {
    const [, chroma, hue] = toOklch(base);
    let light = .91 - .39 * bin / Math.max(1, count - 1);
    if (softShare) light = bin < 5 ? .96 - .026*bin : .76 - .061*(bin - 5);
    let c = chroma, rgb = rgbAt(light, c, hue);
    while (rgb.some(n => n < 0 || n > 1)) {
      c *= .85;
      rgb = rgbAt(light, c, hue);
    }
    ramps.set(key, rgbHex(rgb));
  }
  return ramps.get(key);
}
export const PARTY_RAMPS={
  DEM:['#dbe6f1','#b3cbe3','#7fa6cc','#4f7fb0','#2b5a8c'],
  REP:['#f3dcd6','#e6b2a6','#d4806f','#b9533f','#8e3423'],
};
export function displayBin(row, view) {
  return Math.min(4,Math.floor(row.bin*5/(view.breaks.length+1)));
}
export const PALETTES = {
  'red-blue':['#c0392f','#2b62a8'],
  'purple-green':['#762a83','#1b7837'],
  'orange-teal':['#b35806','#01665e'],
};
export function mapRamp(contest,index,palette='default') {
  const party=contest.choices[index]?.party;
  if(PALETTES[palette]) {
    const side=party==='REP'?0:party==='DEM'?1:(index ?? 1)%2;
    return Array.from({length:5},(_,i)=>rampColor(PALETTES[palette][side],i,5));
  }
  return PARTY_RAMPS[party] || Array.from({length:5},(_,i)=>rampColor(index==null?'#217a68':choiceColor(contest,index),i,5));
}
export function rowColor(row, contest, query, breaks) {
  if (row.status !== 'data') return SPECIAL[row.status].color;
  return mapRamp(contest,row.metric.index,query.palette)[Math.min(4,Math.floor(binIndex(Math.abs(row.metric.value),breaks)*5/(breaks.length+1)))];
}
