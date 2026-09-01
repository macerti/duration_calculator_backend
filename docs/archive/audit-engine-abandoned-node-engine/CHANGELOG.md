# Changelog

Versioning scheme for this project (not strict semver):

- **x** — major overhaul: new concept, architectural change, or a big/visible new capability (e.g. first backend, first UI, new engine module class)
- **y** — a feature request landed (one y-bump per requested feature, roughly)
- **z** — a bug was found and fixed (one z-bump per bug, see `BUGLOG.md` for detail)

Every entry here links to `BUGLOG.md` (for z-bumps) or `ROADMAP.md` (for where a y-bump came from).

---

## [1.0.0] — 2026-08-18

### 1.0.0 — Persistence + deployment overhaul
Major overhaul: the engine is no longer purely in-memory. Added a MariaDB/MySQL
persistence layer and a concrete path to cPanel shared hosting deployment —
this is the shift from "a library" to "a deployable app."

**Added**
- `db/schema.sql` — MariaDB/MySQL schema: `parameter_sets` (versioned, JSON-blob
  storage of the full rule set), `calculation_cases` (saved dossiers, input +
  result JSON), `parameter_change_log` (accreditation-defensibility audit trail)
- `src/db/pool.ts` — connection pool, reads standard `DB_*` env vars, conservative
  `connectionLimit: 5` default for shared-hosting connection caps
- `src/db/parameterSetRepo.ts` — load active parameter set, save new versions,
  seed from the CSV/spec bootstrap
- `src/db/calculationCaseRepo.ts` — save/list/get calculation cases (dossiers)
- `src/db/seed.ts` — one-time CLI seed script (`npm run db:seed`)
- API: `GET/POST /api/cases`, `GET /api/cases/:id` — case history, DB-backed only
- `/health` now reports `dbConnected` and `dbBackedParameters` separately
- `app.js` — Passenger/cPanel Node.js Selector entrypoint (requires `npm run build` first)
- `DEPLOY.md` — step-by-step cPanel deployment guide (DB setup, Node.js Selector
  with/without availability, verification steps)
- `.env.example`, `.gitignore`
- `npm run build` / `npm start` (compiled `dist/` output, for production/Passenger)

**Design decisions**
- **Graceful DB fallback**: if no DB is configured (no `.env`, or DB unreachable),
  the server still boots using the in-memory CSV/spec bootstrap parameter set —
  local dev works with zero DB setup. Only `/api/cases` (which has no in-memory
  equivalent) returns `503` until a DB is wired up. Verified via BUG-005 fix below.
- **Parameters stored as JSON blobs, not normalized columns** (`db/schema.sql`):
  the rule set (factor catalogue, IAF tables, synergy grid) is complex and will
  keep changing shape as we build more of the app — normalizing now would mean
  a migration every time a rule tweaks. Revisit if/when an admin UI needs to
  edit individual rules rather than whole-set versions.
- **cPanel Node.js Selector uncertain on this host** (per 2026-08-18 conversation):
  built to work with it (`app.js` entrypoint, env-var friendly) but `DEPLOY.md`
  also documents the fallback path if the host doesn't support it, so we're not
  blocked either way.

**Verified**
- Full test suite (10/10) + typecheck + build still pass after the DB layer was added
- Manually confirmed: server boots and serves the engine with zero `.env`/DB present
  (fallback mode); `/api/cases` correctly returns `503` with a clear message in that state

---

## [0.1.0] — 2026-08-18

### x.0.0 — Initial engine overhaul
First working version of the calculation engine, rebuilt from `LSP0301_Outil_de_calcul.xlsm`
via `GS0106_Audit_Duration_Rules.md`. Backend/API only, per explicit scope decision (no UI yet).

**Added**
- `engine/nae.ts` — NAE (Nombre Ajusté d'Employés) calculation, rules a–f (shift sqrt-aggregation,
  non-shift, indirect ÷4, cross-check against declared total)
- `engine/duration.ts` — IAF base duration table lookup (ISO 9001 / 45001 / 14001) from source CSVs,
  with linear extrapolation past NAE 10,700
- `engine/factors.ts` — full 27-slot augmentation/reduction factor catalogue (§7), aggregate
  ±20%/−30% caps enforced
- `engine/synergy.ts` — IAF MD11 integration/synergy reduction grid (§8)
- `engine/cycle.ts` — 3-year stage cycling (`CalculerEtape`) + √n sampling (`ArrondiSupUnDixieme`)
- `engine/orgRisk.ts` — multi-site org-wide risk averaging (§10.3)
- `engine/standardDuration.ts` — full per-site/per-standard duration engine composing all of the above
- `engine/case.ts` — top-level orchestrator (all sites × all standards × sampling × totals)
- `engine/nace.ts` — NACE/EAC sector lookup + search, from source CSV
- `api/server.ts` — Express REST API: `/health`, `/api/parameters`, `/api/nace/:code`,
  `/api/nace/search`, `/api/nae`, `/api/calculate`
- `data/parameters.ts` — versioned `ParameterSet` builder (CSV loading + transcribed factor
  catalogue + synergy grid)
- Test suite (`tests/engine.test.ts`) — 10 tests, including the exact worked example from
  spec §4.4 (EURL EXEMPLE, NAE=283) and the `ArrondiSupUnDixieme` rounding edge case

**Design decisions (see README §"Design decisions" for full rationale)**
- Extrapolation past the last IAF bracket instead of the source tool's silent blank/0
- Aggregate factor caps (±20%/−30%) actually enforced in code, not just captions
- Broken `NbSitesMinimum` named-range reference replaced with a real configurable bound
- Factor/NAE-rule justification text flagged as required (warning if missing), matching
  accreditation-defensibility intent of GS0106

**Known limitations at this version** (see `ROADMAP.md`)
- No persistence layer — parameters are in-memory, single default version
- No auth
- No web or mobile UI yet
- No per-standard rollup endpoint equivalent to the "3. Tableau synthèse" sheet
