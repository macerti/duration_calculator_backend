# Changelog — audit-mobile

Same versioning convention as `audit-engine`:
- **x** — overhaul: new concept, architecture change, or a big/visible new capability
- **y** — a requested feature landed
- **z** — a bug was found and fixed (see `BUGLOG.md`)

---

## [0.3.0] — 2026-08-19

### 0.3.0 — App named + multi-site support
App given its real name ("Audit Duration Calculator" — set in `app.json`, nav
titles, Home screen copy) and the Case Builder now supports multiple sites,
which is what actually exercises the engine's org-wide risk averaging and
IAF MD1 sampling logic (both were built in `audit-engine` but never driven from
a real multi-site UI before this).

**Added**
- `app.json`: `name` → "Audit Duration Calculator", `slug` → `audit-duration-calculator`
- `src/components/SiteEditor.tsx` — extracted the personnel + standards form
  (previously inline in `CaseBuilderScreen`) into a reusable per-site component:
  site name, HQ toggle, NACE code field, personnel (shift/non-shift/indirect,
  same as before), standard chips + `StandardConfigPanel` per active standard
- `CaseBuilderScreen` rewritten: now holds an array of `SiteState`, with
  "+ Ajouter un site" / "Retirer ce site" controls, `multiSite` flag auto-set
  from site count, and new result panels for `orgRiskByStandard` (per-standard
  averaged risk across sites) and `sampling` (IAF MD1 sample size per standard
  per year, sites-sampled/sites-eligible)
- Nav titles and Home screen button copy updated to match the app's real name
  and reflect that Case Builder is a finished feature, not a stub

**Verified**
- Typechecks clean, bundles clean for web (461 modules)
- 3-site integration test against a live `audit-engine` instance: confirmed
  `orgRiskByStandard` correctly averages (Elevé=3, Faible=1, Moyen=2 → 2.0 → "Moyen")
  and `sampling` correctly computes `√2 eligible sites × 1.0 coeff = 1.41 → 2`
  via `ArrondiSupUnDixieme` — both match the engine's own tested formulas exactly,
  round-tripped through the exact JSON shape the screen produces

**Known limitations at this version**
- Synergy/integration inputs still not exposed in the UI
- NACE code is a free-text field, not yet a live search/lookup against `/api/nace/search`
- No per-site "extension site" or "isExtensionSite" toggle in the UI yet (engine
  supports it, always sent as `false`)

---

## [0.2.0] — 2026-08-19

### 0.2.0 — Full Case Builder feature (first requested y-bump)
The main daily-use screen: single-site, multi-standard duration calculation,
fully wired to `POST /api/calculate`. Replaces the placeholder from 0.1.0.

**Added**
- `src/components/SegmentedPicker.tsx` — generic reusable choice control (risk
  level, stage)
- `src/components/FactorPicker.tsx` — fetches the live factor catalogue from
  `/api/parameters` per standard/direction, renders checkable lines with their
  per-line caps, plus a free-text "Autre" percent field
- `src/components/StandardConfigPanel.tsx` — per-standard config card: risk,
  stage, stage1/2 toggles, augmentation/reduction factor pickers, mandatory
  justification text field, year-2/year-3 sampling toggles
- `CaseBuilderScreen` (rewritten from the 0.1.0 placeholder) — dossier ref,
  cycle length, personnel section (shift teams up to 5 / non-shift / indirect,
  same rules as the NAE screen), standard chips (ISO9001/45001/14001,
  multi-select), one `StandardConfigPanel` per active standard, submit → full
  result rendering: NAE, per-standard base/factors/net/stage1/stage2/year-by-year
  breakdown, prep+report time, per-standard total, and case-level warnings
  (e.g. NAE cross-check failures) surfaced directly in the UI

**Verified**
- Typechecks clean, bundles clean for web (463 modules)
- Full integration test against a live `audit-engine` instance using the exact
  JSON shape this screen produces: confirmed both the error path (intentional
  NAE cross-check mismatch correctly surfaced as a warning, `totalDaysAllSites: 0`)
  and the happy path (`totalDaysAllSites: 12.75`, no warnings) round-trip correctly

**Known limitations at this version**
- Single site only — multi-site case support is the next roadmap item
- Synergy/integration inputs not yet exposed in the UI (backend supports it;
  UI currently always sends no `synergy` field, so synergy reduction is always 0%)
- NACE code lookup not wired into the personnel/site section yet (site's
  `naceCode` is sent empty)

---

## [0.1.0] — 2026-08-19

### 0.1.0 — First working app (Expo, web+native from one codebase)
Initial Expo (React Native) app, scaffolded to run on iOS, Android, and web from
a single codebase — talks to the `audit-engine` API over HTTP.

**Added**
- Expo TypeScript project (`create-expo-app` blank-typescript template)
- `src/config/api.ts` — API base URL resolution (`EXPO_PUBLIC_API_URL` env var →
  `app.json extra.apiUrl` → localhost fallback for dev)
- `src/api/client.ts` — thin typed fetch wrapper over every `audit-engine` endpoint
  (health, parameters, NACE lookup/search, NAE, calculate, case history)
- `src/types/engine.ts` — copy of the engine's shared types (see "Known limitations")
- `@react-navigation` native-stack navigation: Home → NAE Calculator / Full Case (stub)
- `HomeScreen` — live API connection status (reachable/unreachable, DB-backed or
  fallback parameters), pull-to-refresh
- `NaeCalculatorScreen` — **fully working** end-to-end flow: shift teams (up to 5,
  first = key shift per rule e), non-shift group, indirect group, declared total
  cross-check, calls `POST /api/nae`, renders the breakdown exactly as the engine
  computes it
- `CaseBuilderScreen` — placeholder; full multi-site/multi-standard case builder is
  next on the roadmap (backend endpoint already live and tested)
- `NumberField` — reusable numeric input component

**Verified**
- Full app typechecks clean (`npx tsc --noEmit`)
- Full app bundles and exports cleanly for web (`npx expo export --platform web`,
  472 modules, no errors) — confirms the whole tree (nav, screens, API client,
  copied types) resolves correctly
- Not yet tested against a running `audit-engine` instance from a real device/simulator
  (next step once Mahdi runs both locally)

**Design decisions**
- **Types copied, not shared via a monorepo package** (`src/types/engine.ts` is a
  duplicate of `audit-engine/src/types/index.ts`): fastest way to get moving with
  two separate repos/deploy targets. Flagged in `ROADMAP.md` as tech debt — a
  proper monorepo (npm workspaces or Turborepo) would remove the duplication risk,
  but wasn't worth the setup cost before the app has more than one working screen.
- **Web export target kept working from day one**: since `npm run web` /
  `expo export --platform web` works out of the box with the same codebase, this
  satisfies the earlier "works in web" requirement without a second React project —
  revisit only if the web UI needs to diverge significantly from the mobile UI.
