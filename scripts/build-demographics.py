"""Build precinct Census profiles from the TLC 24PG shape and population ZIPs."""
import argparse
import csv
import io
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely import make_valid, transform, union_all
from shapely.geometry import shape
from shapely.strtree import STRtree

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("shape_zip")
parser.add_argument("population_zip")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
fields = ("total", "vap", "anglovap", "blackvap", "hispvap", "asianvap", "nanglovap")
threshold = 0.98
with zipfile.ZipFile(args.population_zip) as archive:
    records = csv.DictReader(io.StringIO(archive.read("VTDs_24PG_Pop.txt").decode("utf-8-sig")))
    population = {int(row["VTDKEY"]): row for row in records if row["CountyFIPS"] == "439"}

groups = defaultdict(list)
with zipfile.ZipFile(args.shape_zip) as archive:
    with shapefile.Reader(
        shp=io.BytesIO(archive.read("VTDs_24PG.shp")),
        shx=io.BytesIO(archive.read("VTDs_24PG.shx")),
        dbf=io.BytesIO(archive.read("VTDs_24PG.dbf")),
    ) as reader:
        for index, record in enumerate(reader.iterRecords()):
            if int(record["CNTY"]) == 439:
                base = re.sub(r"[A-Za-z]+$", "", record["VTD"].strip())
                groups[base].append((int(record["VTDKEY"]), make_valid(shape(reader.shape(index).__geo_interface__))))
    project = Transformer.from_crs(4326, CRS.from_wkt(archive.read("VTDs_24PG.prj").decode()), always_xy=True).transform

keys = sorted(groups)
shapes = [union_all([geometry for _, geometry in groups[key]]) for key in keys]
tree = STRtree(shapes)
features = json.loads((root / "public/data/precincts.geojson").read_text())["features"]
profiles = {}
used = set()
for feature in features:
    geometry = make_valid(transform(shape(feature["geometry"]), project, interleaved=False))
    if not geometry.area:
        continue
    overlaps = [(geometry.intersection(shapes[index]).area, index) for index in tree.query(geometry)]
    overlap, index = max(overlaps, default=(0, None))
    if index is None or overlap < threshold * max(geometry.area, shapes[index].area):
        continue
    key = keys[index]
    assert key not in used, f"VTD {key} matches multiple precincts"
    used.add(key)
    parts = [population[vtd_key] for vtd_key, _ in groups[key]]
    precinct = str(feature["properties"]["precinct_id"])
    profiles[precinct] = {
        "vtd": key,
        **{field: sum(int(part[field]) for part in parts) for field in fields},
    }

assert all(0 <= row["vap"] <= row["total"] for row in profiles.values())
assert all(0 <= row[field] <= row["vap"] for row in profiles.values() for field in fields[2:])
output = {"censusYear": 2020, "vtdVintage": "2024 primary and general", "minimumMutualAreaOverlap": threshold, "precincts": profiles}
(root / "public/data/demographics.json").write_text(json.dumps(output, separators=(",", ":"), sort_keys=True) + "\n")
print(f"Matched {len(profiles)}/{len(features)} precincts; {sum(k != v['vtd'] for k, v in profiles.items())} with a different VTD number.")
