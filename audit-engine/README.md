# Audit Duration Calculation Engine

A rebuild of `LSP0301_Outil_de_calcul.xlsm` (GS0106 / IAF MD5 / MD1 / MD11) as a
TypeScript backend engine + REST API — no Excel/VBA involved. Logic is
transcribed from `GS0106_Audit_Duration_Rules.md`, section by section, with a
comment pointing back to the relevant `§` for every non-trivial formula.

## Layout

```
src/
  types/index.ts        Shared domain types (ParameterSet, CalculationCaseInput, results)
  data/
    raw/*.csv            Source IAF duration tables + NACE/risk table (as provided)
    csv.ts                Tiny CSV parser (handles quoted/embedded commas)
    parameters.ts         Builds the versioned ParameterSet: loads CSVs, transcribes
                           the §7.3 factor catalogue and §8.3 synergy grid from the spec
  engine/
    nae.ts                §4 — Nombre Ajusté d'Employés (headcount adjustment rules a-f)
    duration.ts           §6/§9.2 — IAF base duration lookup + extrapolation beyond
                           the table's ceiling (NAE > 10,700)
    factors.ts             §7 — base augmentation/reduction factors, with aggregate
                           ±20%/-30% caps actually enforced (the source tool's caption
                           text was never wired into validation — see §7.2)
    synergy.ts             §8 — IAF MD11 integration/synergy reduction
    cycle.ts               §9.4/§10.4 — CalculerEtape (3-year cycle codes) + √n sampling
    orgRisk.ts              §10.3 — multi-site org-wide risk averaging
    rounding.ts             MROUND to nearest 0.25 day
    standardDuration.ts    §9 — full per-site/per-standard engine, composes all of the above
    case.ts                 Top-level orchestrator: NAE → risk → duration → sampling → totals
  api/server.ts            Express REST API exposing the engine

tests/engine.test.ts       Vitest tests, including the exact worked example from
                            spec §4.4 (EURL EXEMPLE, NAE=283) and the ArrondiSupUnDixieme
                            rounding edge case from §10.4
```

## Design decisions made explicit (deviate from source tool on purpose)

1. **Extrapolation past NAE 10,700** (`duration.ts`): the source workbook's
   `VLOOKUP` silently returns `#N/A`/blank past the table's last bracket. This
   engine linear-extrapolates from the slope of the last two brackets instead,
   flagged via `extrapolated: true` in the result so the UI can show a warning.
2. **Aggregate factor caps actually enforced** (`factors.ts`): in the source
   tool the ±20%/-30% labels are just captions — `CalculerTotal` never checks
   them (§7.2). This engine enforces them via `AggregateFactorCaps` (toggleable
   per parameter set, on by default).
3. **`NbSitesMinimum` broken reference fixed** (`parameters.ts`): the source
   workbook references a named range that doesn't exist anywhere in the file
   (§4.4). Replaced with a real, configurable `multiSiteMinimumSites` (default 2).
4. **Justification text is a required field, not optional** — every factor
   selection and NAE adjustment (rules c/d/f) needs an archived justification
   per GS0106 §7, so the engine surfaces a warning when it's missing rather
   than silently allowing a blank.

## Not yet built (per your answers — backend/engine only, this pass)
- No persistence layer (parameter sets are in-memory, single default version)
- No auth
- No React web UI or React Native (Expo) app — this engine is what they'll call
- Multi-standard `4.a/4.d/4.e` cross-site aggregation to `3. Tableau synthèse`
  totals is done at the top level (`case.ts`) but not yet exposed as a
  per-standard rollup sheet-equivalent endpoint

## Running

```bash
npm install
npx tsx src/api/server.ts      # API on :4000
npx vitest run                 # tests
```

### Endpoints
- `GET  /health`
- `GET  /api/parameters` — full current ParameterSet (tables, factor catalogue, synergy grid)
- `GET  /api/nace/:code` — NACE/EAC row lookup
- `GET  /api/nace/search?q=...` — NACE description search
- `POST /api/nae` — NAE calculation for one site's personnel breakdown
- `POST /api/calculate` — full case calculation (all sites, all standards, sampling, totals)
