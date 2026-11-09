import re,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path('public/data');rx=re.compile(r'([\d,]+)\s+[\d.]+%')
def parse(name,precinct):
 rows={};ballots={};ctx=None
 for page in (root/name).read_text().split('\f'):
  if not page.strip():continue
  pid='COUNTY'
  if precinct:
   m=re.search(r'^\s*(\d{4})\s+([\d,]+) ballots cast\s*$',page,re.M);assert m;pid=m[1];ballots[pid]=int(m[2].replace(',',''))
  lines=page.splitlines()
  for i,l in enumerate(lines):
   if re.match(r'^Choice\s+Party\s+',l):
    title=next(x.strip() for x in reversed(lines[:i]) if x.strip());ctx=(pid,title);rows.setdefault(ctx,{'choices':{},'cast':None,'under':None,'over':None});continue
   matches=list(rx.finditer(l))
   if ctx and len(matches)==4:
    prefix=l[:matches[0].start()].strip();v=[int(x[1].replace(',','')) for x in matches];assert sum(v[:3])==v[3]
    if prefix=='Cast Votes:':rows[ctx]['cast']=v;continue
    m=re.search(r'\s+(REP|DEM|LIB|GRN)$',prefix);party=m[1] if m else '';name=prefix[:m.start()].strip() if m else prefix
    assert (name,party) not in rows[ctx]['choices'];rows[ctx]['choices'][name,party]=v
   elif ctx and l.strip().startswith(('Undervotes:','Overvotes:')):
    k,v=l.strip().split(':');rows[ctx]['under' if k=='Undervotes' else 'over']=[int(x.replace(',','')) for x in v.split()]
 return rows,ballots
county,_=parse('cumulative.txt',False);rows,ballots=parse('precinct.txt',True);contests=[];checks=0
for (_,title),official in county.items():
 precincts={p:r for (p,t),r in rows.items() if t==title};choices=[{'name':n,'party':p,'totals':v} for (n,p),v in official['choices'].items()]
 for choice,v in official['choices'].items():assert [sum(r['choices'].get(choice,[0]*4)[j] for r in precincts.values()) for j in range(4)]==v;checks+=1
 for stat in ['cast','under','over']:assert [sum(r[stat][j] for r in precincts.values()) for j in range(4)]==official[stat];checks+=1
 for r in precincts.values():assert [sum(v[j] for v in r['choices'].values()) for j in range(4)]==r['cast']
 contests.append({'name':title,'choices':choices,'totals':official['cast'],'precincts':{p:{'votes':[r['choices'].get((c['name'],c['party']),[0]*4) for c in choices],'cast':r['cast'],'under':r['under'],'over':r['over']} for p,r in precincts.items()}})
g=json.loads((root/'precincts.geojson').read_text());assert {str(int(f['properties']['Precinct'])) for f in g['features']}==set(ballots);assert sum(ballots.values())==733287
for f in g['features']:
 p=f['properties'];pid=str(int(p['Precinct']));f['id']=pid;f['properties']={'precinct_id':pid,'ballots':ballots[pid],'boundary_version':'county-current-snapshot','house':p['House'],'senate':p['Senate']}
print(len(g['features']),len(contests),checks,sum(ballots.values()))
(out/'official.json').write_text(json.dumps({'contests':contests,'checks':checks,'ballots':sum(ballots.values())},separators=(',',':')));(out/'precincts.geojson').write_text(json.dumps(g,separators=(',',':')))
