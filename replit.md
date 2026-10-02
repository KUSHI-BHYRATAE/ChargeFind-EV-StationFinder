# ChargeFind

ChargeFind finds nearby EV charging stations from the included India dataset using the project's Python KD-tree and Haversine implementation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express API and its on-demand Python station API
- `pnpm --filter @workspace/chargefind run dev` — run the ChargeFind web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Python dependencies are declared in the root `pyproject.toml` and `uv.lock`.
- Run the preserved Python checks from `artifacts/api-server/chargefind-python/EV-Charging-Station-Finder` with `.pythonlibs/bin/python test_haversine.py` and `.pythonlibs/bin/python test_kd_tree.py`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/chargefind/` — responsive React + Vite finder and interactive OpenStreetMap view
- `artifacts/api-server/src/routes/stations.ts` — typed `/api/stations/*` routes
- `artifacts/api-server/src/lib/chargefind-python.ts` — starts and proxies to the persistent Python API process
- `artifacts/api-server/chargefind-python/EV-Charging-Station-Finder/` — preserved Python project, source dataset, prepared India dataset, algorithm code, and original tests
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated frontend hooks

## Architecture decisions

- Keep the included Python KD-tree and Haversine implementation as the search engine; the API process loads the prepared dataset and index once, then reuses them.
- City suggestions use a representative point calculated from stations in the matching city/state; the UI labels it as a dataset point, not an exact address.
- The prepared India dataset is used by the app; the original source CSV and preparation script remain alongside it.
- No live connector or station availability is included in the supplied dataset, so the UI only displays fields present in that data.

## Product

Users can search by coordinates, browser location, or an indexed Indian city; choose between 1 and 10 results; and inspect distance-ranked stations on an interactive map. Search responses expose measured KD-tree metrics and available station metadata.

## User preferences

- Preserve and use the attached Python backend, KD-tree, Haversine distance calculation, real station data, and tests.
- Keep the finder professional, dark, teal-accented, responsive, and focused on working search/map behavior rather than decorative dashboard content.

## Gotchas

- Do not return power-biased or approximate distance ordering: nearest stations must be ranked by Haversine distance.
- Browser geolocation requires user permission and a secure browsing context.
- The station dataset does not provide live availability or connector-type data; do not imply either.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
