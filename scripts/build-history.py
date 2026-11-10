"""Extract Tarrant general-election returns on TLC's common 2024 VTD geography.
Usage: python scripts/build-history.py /path/to/2024-general-vtds-election-data.zip
"""
import csv, io, json, re, sys, zipfile, hashlib
from collections import defaultdict
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]); z=zipfile.ZipFile(archive)
source='https://data.capitol.texas.gov/dataset/35b16aee-0bb0-4866-b1ec-859f1f044241/resource/e1cd6332-6a7a-4c78-ad2a-852268f6c7a2/download/2024-general-vtds-election-data.zip'
names={'U.S. Sen':'United States Senator','Governor':'Governor','Lt. Governor':'Lieutenant Governor','Attorney Gen':'Attorney General','Comptroller':'Comptroller of Public Accounts','Land Comm':'Commissioner of the General Land Office','Ag Comm':'Commissioner of Agriculture','RR Comm 1':'Railroad Commissioner','President':'President'}
def title(name):
 for prefix,label in [('U.S. Rep ','United States Representative, District '),('State Rep ','State Representative, District '),('State Sen ','State Senator, District ')]:
  if name.startswith(prefix):return label+name[len(prefix):]
 return names.get(name,name)
manifest={'source':source,'publisher':'Texas Legislative Council','geography':'2024 primary and general election VTDs','sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'years':[],'crosswalk':{k:v['vtd'] for k,v in json.loads((root/'public/data/demographics.json').read_text())['precincts'].items()},'minimumMutualAreaOverlap':.98}
for year in range(2012,2025,2):
 races={}; source_sum=0; key_vtd={}
 for r in csv.DictReader(io.TextIOWrapper(z.open(f'{year}_General_Election_Returns.csv'),encoding='utf-8-sig')):
  if r['FIPS']!='439':continue
  votes=int(r['Votes']);assert votes>=0
  source_sum+=votes
  vtd=re.sub('[A-Za-z]+$','',r['VTD'].strip())
  key=r['vtdkeyvalue'];assert key_vtd.setdefault(key,r['VTD'])==r['VTD']
  race=races.setdefault(r['Office'],{'name':title(r['Office']),'choices':[], 'counts':defaultdict(lambda:defaultdict(int))})
  party={'D':'DEM','R':'REP','L':'LIB','G':'GRN'}.get(r['Party'],r['Party'])
  candidate={'name':r['Name'],'party':party}
  if candidate not in race['choices']:race['choices'].append(candidate)
  race['counts'][vtd][race['choices'].index(candidate)]+=votes
 contests=[]
 for office,r in races.items():
  precincts={p:[counts[i] for i in range(len(r['choices']))] for p,counts in sorted(r['counts'].items())}
  totals=[sum(v[i] for v in precincts.values()) for i in range(len(r['choices']))]
  contests.append({'name':r['name'],'sourceOffice':office,'choices':r['choices'],'totals':totals,'precincts':precincts})
 assert sum(sum(r['totals']) for r in contests)==source_sum
 output={'year':year,'contests':contests}
 filename=f'history-{year}.json';(root/'public/data'/filename).write_text(json.dumps(output,separators=(',',':'))+'\n')
 manifest['years'].append({'year':year,'file':filename,'contests':len(contests)})
 print(year,len(contests),len({p for r in contests for p in r['precincts']}),source_sum)
(root/'public/data/history.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
