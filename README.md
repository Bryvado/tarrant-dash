# Tarrant precinct dashboard

Personal research project for exploring Tarrant County elections with OpenFreeMap and MapLibre. The repository is public; the project is not being promoted as a public service.

Uses official Tarrant County November 2026 reports, labeled unofficial: 707 precincts, 118 contests and 733,287 ballots. Candidate and contest totals reconcile across all voting methods.

## Run locally

Requires Node.js 22 or newer.

```sh
git clone https://github.com/Bryvado/tarrant-dash.git
cd tarrant-dash
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Import into a hosting service

- Repository: `https://github.com/Bryvado/tarrant-dash`
- Branch: `main`
- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22 or newer

No hosting service or deployment has been configured by this setup.

## Included

- OpenFreeMap Positron basemap.
- Linked map and keyboard-accessible precinct scatterplot.
- Two-party margin, county-relative lean, turnout, opacity and label controls.
- Precinct profiles and GeoJSON export.
- Election manifest and reserved Democratic/Republican precinct chair data structure.
- Tests, data validation and GitHub Actions build checks.

## Checks

```sh
npm test
npm run validate
npm run build
```

Browser interaction verification on desktop and mobile remains part of production acceptance.

## Data and next steps

See [data contract](docs/DATA.md), [source inventory](docs/SOURCES.md), and [implementation plan](docs/PLAN.md). Nonpartisan races and propositions are included. Historical comparisons and registration-based turnout remain planned. Geometry is the current county snapshot, with an exact precinct-ID join.

Keep credentials and raw voter rosters outside the repository and `public/`. Files in `public/` are delivered to browsers. The package's `private: true` prevents npm publication; it does not control GitHub visibility. Authentication is optional for this personal project, rather than a requirement for setup.

### Precinct analytics

In **Analytics → Precinct charts**, choose **Compare candidates** to plot two choices from the November 2026 results. Candidate A comes from the current map contest. Choose Candidate B and its contest independently. The chart includes precincts with valid votes in both contests for the selected voting method. Each share uses its own contest's valid votes. The pooled difference subtracts the two vote shares calculated over the same set of precincts. A local race may cover only part of a precinct.

**Demographics** plots candidate share against a selected group's share of the 2020 voting-age population. The Texas Legislative Council's [2024 VTD boundaries and 2020 Census counts](https://data.capitol.texas.gov/dataset/vtds) are joined by `VTDKEY`. Suffix parts are combined before matching to the county's precinct geometry. Only matches with at least 98% area overlap in both directions are included. The resulting profiles cover 577 of 707 mapped precincts. The chart reports unweighted Pearson correlation across matched precincts. Census groups can overlap, and precinct associations do not identify how individuals voted.

To regenerate Census profiles, download `VTDs_24PG.zip` and `VTDs_24PG_Pop.zip` from the portal and run:

```sh
python -m pip install 'shapely>=2.1' pyproj pyshp
python scripts/build-demographics.py VTDs_24PG.zip VTDs_24PG_Pop.zip
```

The precinct panel includes the public [Democratic](https://tarrantdemocrats.org/precinct-chair-lookup/) and [Republican](https://tarrantgop.org/precinct-chairs-resources/) chair rosters. Run `python scripts/build-chairs.py` to refresh the built-in names and vacancies from the linked spreadsheets. The exported JSON contains precinct numbers, names, and vacancies.
