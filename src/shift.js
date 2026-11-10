// One shared scale for the map, table bars, scatter, tooltip and legend.
export const SHIFT_COLORS=['#7d5a1e','#b98a3c','#dcbd82','#f0e2c8','#efede6','#d4e8e4','#8cc4ba','#3f948a','#1d6259'];
export const SHIFT_BREAKS=[-.15,-.10,-.05,-.02,.02,.05,.10,.15];
export const SHIFT_LABELS=['Loss ≥15 pp','Loss 10–15 pp','Loss 5–10 pp','Loss 2–5 pp','Within 2 pp','Gain 2–5 pp','Gain 5–10 pp','Gain 10–15 pp','Gain ≥15 pp'];
export const shiftBin=value=>SHIFT_BREAKS.reduce((i,b)=>i+(value>=b),0);
export const shiftColor=value=>value==null?'#e4e3de':SHIFT_COLORS[shiftBin(value)];
export const aboveThreshold=(row,min)=>row.a?.votes>=min&&row.b?.votes>=min;
export function contextBounds(bounds){const [[w,s],[e,n]]=bounds;const lat=1.5/111.32,lng=lat/Math.cos((s+n)*Math.PI/360);return [[w-lng,s-lat],[e+lng,n+lat]];}
