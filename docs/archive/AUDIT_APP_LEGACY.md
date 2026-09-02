# History note — legacy two-folder PHP + Expo implementation (code deleted, this note kept)

**Moved out of `audit-app/` then deleted, same session**: 2026-09-01
(repository architecture consolidation, step 2). Initially moved to
`docs/archive/` as a preserved copy; an external architecture review
landed on `main` while this work was in progress and made explicit that
`archive/` must not be used as a dumping ground for duplicate code — only
a concise document should remain. This note replaces the moved copy; the
full deleted tree remains recoverable from this file's own git history if
ever needed.

**What this was**: an earlier, two-folder-topology version of both the PHP
backend (`backend/public/` as its own doc root, `/api/...` as a URL
namespace rather than a physical folder) and an earlier version of the
Expo/React frontend. This used to be `audit-app/backend` and
`audit-app/frontend` at the repo root.

**Why it's archived, not the canonical implementation**:
`duration-calculator-php/` (backend) and `audit-mobile/` (frontend) are the
active source of truth — see root `README.md`. This is the folder CI
(`.github/workflows/build-test-publish.yml`) never touches.

**Verification performed before archiving — nothing unique was lost**:
- `.github/workflows/build-test-publish.yml` only ever references
  `duration-calculator-php/` and `audit-mobile/`; zero references to
  `audit-app/backend` or `audit-app/frontend`.
- Diffed every engine file (`case.php`, `cycle.php`, `duration.php`,
  `factors.php`, `nace.php`, `nae.php`, `orgRisk.php`,
  `standardDuration.php`, `synergy.php`) against
  `duration-calculator-php/engine/`: identical except `nace.php`, where the
  canonical version is strictly ahead (accent-folding + multi-field search
  across NACE/EAC/QM/OH/EM codes; this archived copy predates that fix).
- Diffed `data/parameters.php` and all four `data/raw/*.csv` files
  (`iaf_duration_iso14001.csv`, `iaf_duration_iso45001.csv`,
  `iaf_duration_iso9001.csv`, `nace_risque_table.csv`) against
  `duration-calculator-php/data/`: byte-identical. No authoritative
  parameter/formula data exists only in this archived copy.
- Diffed `db/schema.sql`, `db/clientRepo.php`, `db/calculationCaseRepo.php`
  against canonical: canonical is strictly ahead (documented
  SET-NULL→CASCADE client-delete decision, the BUG-023 two-statement FK fix
  for MariaDB/InnoDB errno 121, and `wizard_state_json` persistence for
  full wizard-state restore). Everything in this archived copy is an older
  snapshot of the same logic, not a divergent or unique implementation.
- `config.example.php`: canonical adds a `debug` flag defaulting to `false`
  (security hardening); no regression.
- Frontend: this archived copy has 24 files under `src/` vs
  `audit-mobile/src/`'s 30, and is missing `hooks/`, `theme/`, and `utils/`
  entirely — an earlier, smaller iteration. No calculation logic lives in
  the frontend layer in either version (formulas are backend-only per
  `REPOSITORY_ARCHITECTURE.md`), so there was no business-rule risk here.

**Why deleted rather than kept as a folder copy**: the initial instinct
was to preserve it under `docs/archive/` per "do not blindly delete files
or folders" — but `REPOSITORY_ARCHITECTURE.md` was updated (external
architecture review, same day) to explicitly override that for duplicate
application code: "do not use archive/ as a dumping ground... a historical
implementation that has no current engineering value goes to the trash."
Git history (this repo's own commit log) still has the full tree if a
future question arises about the earlier topology — this note plus that
history satisfies the "concise durable document" requirement without
keeping a second, unmaintained copy of the application in the tree.

**Also merged, not archived**: the old `audit-app/README.md`, which
described this now-deleted code as "the folder that actually gets
deployed" — no longer true. Its still-valid unique content (GS0106/IAF
project description, why-PHP rationale, quick-start commands) was merged
into the root `README.md` with paths updated to the canonical
implementation; the original file itself was deleted along with the rest
of `audit-app/`, not kept.

**Not done in this pass**: `audit-mobile/` still has its own separate,
stale `BUGLOG.md`/`CHANGELOG.md`/`ROADMAP.md` (only going up to BUG-004/
BUG-019 and version ~0.3.0) that duplicate and are superseded by
`docs/BUGLOG.md` and root `CHANGELOG.md`. Not reconciled in this pass — see
`docs/DEV_STATUS.md`'s dated session entry for this step for the exact
plan handed off to the next session.
