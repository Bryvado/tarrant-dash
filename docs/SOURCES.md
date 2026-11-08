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
