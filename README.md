# Tarrant precinct dashboard

Private-project starter for exploring Tarrant County elections with OpenFreeMap and MapLibre. **This repository contains synthetic demonstration data, not official precinct boundaries or election results.** No hosted site or authentication system is provisioned.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For checks and a production build:

```sh
npm test
npm run validate
npm run build
npm run preview
```

## Import into a private GitHub repository

Extract the ZIP, then open a terminal in the extracted folder. Create an **empty private repository** in GitHub, without an initial README or license. Run:

```sh
git init -b main
git add .
git commit -m "Initialize Tarrant precinct dashboard"
git remote add origin https://github.com/YOUR_USERNAME/tarrant-precinct-dashboard.git
git push -u origin main
```

Replace YOUR_USERNAME and the repository name as needed. This ZIP is a source folder, not a GitHub Importer URL. A hosting service that imports GitHub projects can use `npm run build` with output directory `dist`.

## Included

- OpenFreeMap Positron basemap with attribution supplied by MapLibre.
- Bidirectional selection between map and keyboard-accessible scatterplot.
- Two-party margin, county-relative lean, turnout, opacity, and label controls.
- Precinct profiles and GeoJSON export.
- Election manifest and empty Democratic/Republican precinct chair collection.
- Validation, metric tests, CI, pinned dependencies and lockfile.
- Responsive layout; browser interaction verification remains part of implementation acceptance.

## Privacy

`private: true` prevents accidental npm publication; it does NOT provide website authentication. Use localhost or an authenticated hosting environment. Protect both the app and its data routes. Never rely on an unlisted URL or a private GitHub repository to secure a deployed website. Do not put raw voter rosters, credentials, or sensitive notes in `public/`; all public assets are shipped to browsers. `data/raw/`, `data/private/` and environment files are gitignored. OpenFreeMap requests are external network requests.

## Data and next steps

See [data contract](docs/DATA.md), [source inventory](docs/SOURCES.md), and [implementation plan](docs/PLAN.md). Production input must be validated against official totals before replacing the demo. Do not match different election vintages solely by precinct number.

No remote repository has been created or modified. No deployment workflow is included. No open-source license is granted by this starter.
