# Tarrant precinct dashboard

Personal research project for exploring Tarrant County elections with OpenFreeMap and MapLibre. The repository is public; the project is not being promoted as a public service.

**The starter currently uses synthetic demonstration precincts and votes, not official election data.**

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

See [data contract](docs/DATA.md), [source inventory](docs/SOURCES.md), and [implementation plan](docs/PLAN.md). Replace the demonstration only after official results reconcile and historical boundary versions are established. Nonpartisan contest rendering and historical comparisons remain planned work.

Keep credentials and raw voter rosters outside the repository and `public/`. Files in `public/` are delivered to browsers. The package's `private: true` prevents npm publication; it does not control GitHub visibility. Authentication is optional for this personal project, rather than a requirement for setup.
