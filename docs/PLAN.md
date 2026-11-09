# Implementation plan

1. Inventory and archive county election files; identify every source and parsing status.
2. Normalize 2022, 2024 and 2026 general results plus 2025 local contests. Add candidate-based data structures for nonpartisan contests before displaying them.
3. Capture election-specific precinct boundaries and district overlays. Audit precinct joins and split precincts. Support original boundaries before estimated crosswalks.
4. Replace demo input only after totals reconcile. Add candidate share, net vote density based on projected land area, comparative elections, jurisdiction filters, and missing-data rendering.
5. Validate desktop/mobile map-to-chart and chart-to-map clicks, keyboard selection, selection reset, filters, labels, exports, zero denominators and failed data requests.
6. Add private hosting with tested access control on all assets and data. No raw voter roster in browser bundles.
7. Extend backward to 2020/2018/2016 and then older elections. Label all estimated historical comparisons.
8. Add both parties' precinct chairs with source verification, vacancy states, term dates, history, and boundary-aware joins. Later add aggregate participation and census context.

Current scope is a repository starter. Official ingestion, historical crosswalks, nonpartisan rendering, additional overlays, authentication, and production browser acceptance are not complete.

The next loading performance step is splitting the election results into per-contest files. The current dashboard parses about 9.6 MB of precinct geometry and results on startup.
