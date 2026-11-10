# Source inventory

Reviewed November 8, 2026. These are discovery pointers, not downloaded or certified datasets.

- Archive: https://www.tarrantcountytx.gov/en/elections/past-election-information.html
- County precinct GeoJSON-capable service: https://mapit.tarrantcounty.com/arcgis/rest/services/Elections/Voting_Precinct/MapServer/1
- 2024 tally ZIP: https://www.tarrantcountytx.gov/content/dam/main/elections/2024/1124/reports/ENR_1124.zip
- 2026 tally ZIP: https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/reports/ENR_1126.zip
- 2024 precinct/district ZIP: https://www.tarrantcountytx.gov/content/dam/main/elections/2024/1124/reports/Elec_Pct_Reg_Counts_.zip
- OpenFreeMap style: https://tiles.openfreemap.org/styles/positron

Archive pages list precinct results, cumulative reports, machine-readable tallies in recent years, turnout rosters, registration/support files, polling locations, reconciliation reports and selected CVR links. File presence, field definitions and certification require checking individually. The county announces precinct changes effective January 1, 2026. Snapshot and date geography rather than assuming the live service represents past elections.

For ingestion: crawl all election-page links; retain originals with retrieval timestamps and hashes; inspect ZIP members; normalize by source format; reconcile precinct sums with matching official cumulative reports. Never interpret an inaccessible file as zero votes. Older scans may need OCR and manual verification.

## Historical general elections (added November 2026)

The table uses Texas Legislative Council **2024 General VTDs Election Data**, covering general elections in 2012, 2014, 2016, 2018, 2020, 2022 and 2024. All historical records in this archive are reported on the common 2024 VTD geography, rather than each election's original precinct boundaries. Source: https://data.capitol.texas.gov/dataset/comprehensive-election-datasets-compressed-format . The download URL and SHA-256 are recorded in `public/data/history.json`.

`scripts/build-history.py` filters FIPS 439, combines suffixed pieces of the same VTD, preserves the source's candidate names and party labels, and checks that extraction and aggregation preserve every source vote. Historical coverage is limited to contests present in the council archive, which does not include every local or uncontested race. Values are all voting methods combined.

The existing Census geography crosswalk supplies one-to-one matches to 2026 precincts only when mutual area overlap is at least 98%. It matches 577 of the 707 current precincts. These are near-matching boundaries, not proof of exact population equivalence. Remaining precincts remain unmatched; the table does not allocate their votes by area or calculate a shift for them. Historical-to-historical comparisons use the common VTD identifiers directly. District footprints and candidates may change even with common VTD geography.

A party share is party votes divided by all valid contest votes. A Democratic margin is (D − R) divided by all valid votes; Republican reverses that sign. A margin requires both party choices in the source contest. Shift is the later selected election's value minus the earlier selection's value, in percentage points. Pooled shares use only displayed comparable rows. CSV exports include counts, denominators, unrounded shares and shifts, year, office, party, geography identifiers and coverage status.

Regenerate with `python scripts/build-history.py /path/to/2024-general-vtds-election-data.zip`.
