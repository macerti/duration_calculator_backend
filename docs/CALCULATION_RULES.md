# Calculation rules — authoritative reference

This is the durable reference for where each protected business rule lives
and what's actually documented about it, so a future change doesn't have to
rediscover this by reading every engine file from scratch. It is an index
and a compiled summary, not a restatement of the full spec — the real
authority for exact numbers is `src/backend/engine/*.php` itself plus the
worked examples in `src/backend/tests/`, which this document points to
rather than duplicates (duplicated numbers go stale; a pointer to the
executable test doesn't).

Source of truth for the underlying standards: GS0106 / IAF MD5 / MD1 /
MD11, originally implemented in `LSP0301_Outil_de_calcul.xlsm` (NAE +
duration) and `LSP0302_Calculateur_de_Prix_Cycle_03ans.xlsx` (cycle
pricing) — see the root `README.md` for that lineage and why the engine is
PHP rather than the original VBA.

## Where each rule lives

| Rule | File | What's documented inline |
|---|---|---|
| NAE (per-site headcount → effective auditable count) | `engine/nae.php` — `rowNae()`, `calculateNae()`, `calculateUnskilledTempNae()` | `rowNae()` is the per-row NAE formula; `calculateNae()` composes it across a site's declared headcount breakdown. |
| Audit duration by referential (IAF table lookup) | `engine/duration.php` | Documented as replicating a `VLOOKUP(NAE, table, col, approximate_match)` against the IAF table for the site's referential. NAE=0 returns 0 directly. NAE beyond the table's last bracket linear-extrapolates instead of the source spreadsheet's silent-0-day bug — this was a deliberate, documented deviation from the original tool (spec §7.3 resolution #3), not an oversight. |
| Report-writing / prep time | `engine/standardDuration.php` | Spec §9.7 / spec line 889: prep+report = 20% × (sum of on-site durations for sites marked "Oui" that year) — computed **per year/visit**, not once on a multi-year sum. Mathematically equivalent in total (20%×(a+b+c) = 20%a+20%b+20%c) but the per-visit breakdown is treated as a real traceability requirement, not just an implementation detail. Respects a per-year manual override (`durationOverrides.report1/2/3`) if supplied. |
| Multi-year audit cycle staging (initial → surveillance years, extension sites) | `engine/cycle.php` — `calculerEtape()`, `calculateSampleSize()` | Handles extension sites joining mid-cycle (`isExtensionSite`, `extensionStartYear`) as a distinct case from sites present from year 1. `arrondiSupUnDixieme()` is a specific round-up-to-nearest-0.1 rule used in sample sizing — check the function itself for the exact rounding behavior before assuming standard rounding. |
| Base factor catalogue (augmentation/reduction factors per referential) | `engine/factors.php` — `calculateAggregateFactor()` | The official factor catalogue (6–12 augmentation + 8–11 reduction factors per referential, exact French labels) was extracted directly from the original workbook's `usfFacteurs.bas` VBA module during the Node→PHP port — see `docs/archive/AUDIT_ENGINE_LEGACY.md` for that extraction's provenance. This file aggregates a user's factor selections against per-referential caps. |
| Organizational risk level averaging (multi-site) | `engine/orgRisk.php` — `averageOrgRisk()`, `mround()` | `mround()` replicates Excel's `MROUND()` (round to nearest multiple) — used because the original tool's risk averaging depends on Excel's specific rounding behavior, not naive `round()`. |
| MD11 synergy (auditor qualification / combined-audit capacity) | `engine/synergy.php` — `calculateSynergy()` | Synergy capacity/combination logic for multi-standard (MD11) audits. The auditor-qualification-matrix UI for this is listed in `docs/ROADMAP.md` as not yet built — the calculation function exists and is tested; the UI to drive it richly is the open item. |
| Full case assembly (single or multi-site) | `engine/case.php` — `calculateCase()` | The top-level entry point that composes NAE → duration → cycle → synergy → pricing for one full case. This is what `api/index.php`'s case-creation routes call, and what `src/backend/tests/smoke_test.php` exercises end to end against known-correct values from the source workbook. |
| NACE code search/lookup | `engine/nace.php` | Not a calculation rule but a supporting lookup: accent-insensitive French text search over NACE codes. Uses a manual accent-stripping character map rather than `iconv(...TRANSLIT)` deliberately, because `iconv`'s transliteration depends on the host's installed locale data, which isn't guaranteed to be present/consistent across shared hosting — see the file's own comment. Falls back to ASCII-only `strtolower()` if the `mbstring` extension isn't loaded. |

## Verifying a change against these rules

Do not trust a formula change by reasoning about it — this project's
testing standard (see `docs/ORIENTATIONS.md`) is to verify against the
actual worked examples the original workbook was checked against:

- `src/backend/tests/smoke_test.php` — pure engine logic, no DB, checks
  calculated values against the source workbook's known-correct example
  case(s) (documented in the test file itself, e.g. the NAE=283 mono-site
  case referenced in prior session logs).
- `src/backend/tests/http_api_test.php` — same, but through the real HTTP
  API + DB, catching routing/persistence bugs the pure-engine test can't.
- `make test` runs the first; `make test-http` runs the second against a
  local test DB (see `docs/DEPLOY.md`).

## Known gap in this document

This is a first pass compiled from the inline comments that already
existed in each engine file, plus the standing project docs — it is not a
from-scratch derivation of every formula from the GS0106/IAF spec text, and
several files (`case.php`, `factors.php`, `orgRisk.php`, `synergy.php`) have
few or no inline comments of their own beyond what's summarized above. If a
future change needs the *exact* numeric spec (not just "which file, which
deviation from the original tool"), that still means reading the function
body directly and/or the original spec document referenced in project
memory as `audit-calculator-project-spec.md` (not currently part of this
repository) — this table saves the "which file" search, not the "what
exactly is the formula" derivation.
