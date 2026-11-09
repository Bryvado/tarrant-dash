"""Build the names and vacancies shown by the dashboard from public party rosters."""
import csv
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "DEM": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrqM2fyeTs8PSChcO7siBKkBhZoHX2wtiwm_P5rXd7xsheizvDbmpTeOD-Vta_MLnCSI_ygWLAa13s/pub?output=tsv",
    "REP": "https://docs.google.com/spreadsheets/d/1AwMFBVQo_MKSOZPraCpYPOyNV9gK5khW/export?format=csv&gid=710083372",
}
precincts = {
    str(feature["properties"]["precinct_id"])
    for feature in json.loads((ROOT / "public/data/precincts.geojson").read_text())["features"]
}
rosters = {}
for party, url in SOURCES.items():
    with urlopen(Request(url, headers={"User-Agent": "Tarrant precinct dashboard"}), timeout=30) as response:
        raw = response.read().decode("utf-8-sig")
    rows = csv.DictReader(io.StringIO(raw), delimiter="\t" if party == "DEM" else ",")
    rows.fieldnames = [field.strip() for field in rows.fieldnames or []]
    id_field, name_field = ("", "Name") if party == "DEM" else ("Precinct", "Ballot Name")
    if not {id_field, name_field}.issubset(rows.fieldnames):
        raise ValueError(f"{party} roster layout changed")
    roster = {}
    for row in rows:
        precinct = (row.get(id_field) or "").strip()
        if precinct not in precincts:
            continue
        name = (row.get(name_field) or "").strip()
        vacancy = name.casefold() in {"open", "empty", "vacant"} or (
            (row.get("Comments") or "").strip().casefold() == "empty"
        )
        if not name and not vacancy and party == "DEM":
            vacancy = True  # The party's chair page defines blank names as vacancies.
        if precinct in roster:
            raise ValueError(f"Duplicate precinct {precinct} in {party} roster")
        if name or vacancy:
            if not vacancy and ("@" in name or any(character.isdigit() for character in name)):
                raise ValueError(f"Unexpected chair name field in {party} precinct {precinct}")
            roster[precinct] = "Vacant" if vacancy else name
    if not roster:
        raise ValueError(f"No precinct matches in {party} roster")
    rosters[party] = roster
    print(f"{party}: {len(roster)} of {len(precincts)} precincts")
(ROOT / "public/data/chairs.json").write_text(
    json.dumps(rosters, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
    encoding="utf-8",
)
