# Data contract

## Elections

`public/data/manifest.json` contains `mode` (`demo` or `production`), `elections`, and `chairs_file`. Each election entry describes one contest and its GeoJSON:

- `id`: stable election-contest ID
- `name`: election label
- `contest`: contest label
- `file`: path relative to public/data
- `boundary_version`: geometry vintage
- `status`: synthetic, unofficial, or certified (only when supported by source)

## Prototype map input

GeoJSON FeatureCollection of Polygon/MultiPolygon features. Each feature has a stable ID and properties:

| Field | Type | Definition |
|---|---|---|
| precinct_id | string | Preserve leading zeros and split suffixes |
| boundary_version | string | Identifies a particular geometry vintage |
| dem_votes | nonnegative integer | Democratic candidate votes in this contest |
| rep_votes | nonnegative integer | Republican candidate votes in this contest |
| other_votes | nonnegative integer | All other valid contest votes |
| ballots | nonnegative integer | Participating ballots in the precinct and relevant electorate |
| registered | nonnegative integer | Registration denominator appropriate to that election |

This starter supports single-seat partisan demonstration contests only. Do not coerce nonpartisan or vote-for-N results into these fields. Missing registration must be handled in the production adapter as nullable with unavailable turnout, rather than filled with zero. The current prototype requires complete inputs.

Derived measures: margin = (D-R)/(D+R); lean = precinct margin minus county margin; turnout = ballots/registered. Zero denominators display unavailable. Charts use two-party margin and turnout. Filtered jurisdiction totals must not be mislabeled county totals.

## Production normalized tables (next stage)

- elections: election_id, date, type, party, status, source_id
- contests: contest_id, election_id, jurisdiction_id, office, district, vote_for, partisan
- choices: choice_id, contest_id, name, party, choice_type
- results: election_id, contest_id, choice_id, precinct_id, split_id, boundary_version, voting_method, votes, source_id, report_version
- turnout: election_id, precinct_id, split_id, boundary_version, voting_method, ballots, registered, denominator_date, source_id
- boundaries: boundary_version, precinct_id, valid_from, valid_to, geometry, source_id
- sources: source_id, url, retrieved_at, sha256, status, parser_version
- crosswalks: from_version, from_precinct, to_version, to_precinct, weight, method, exact, source_id

Preserve original reporting rows before aggregation. Never add a total row to its early/mail/Election Day components. Check split precincts, limited ballots, provisional ballots, undervotes and overvotes separately. County files may contain only the Tarrant portion of a multi-county jurisdiction.

## Precinct chairs: reserved contract

`public/data/chairs.json` starts empty. Each future record:

```json
{
  "chair_id": "stable-record-id",
  "party": "DEM",
  "precinct_id": "1001",
  "boundary_version": "2026-01-01",
  "name": "Example name",
  "status": "filled",
  "term_start": "2026-06-15",
  "term_end": null,
  "selection_method": "elected",
  "source_url": "https://example.org/source",
  "verified_at": "2026-11-08"
}
```

Party: DEM or REP. Status: filled, vacant, or unknown. A missing record means unknown, not vacant. Keep historical terms separately; the current profile renderer displays all matching records, so production needs an as-of-date filter before importing multiple terms. Chair election results belong in normalized results, not inferred from appointment records. No real chair names or contact details are included.
