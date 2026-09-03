# Changelog — audit-app (deployable project)

Same versioning convention as the other projects: **x** = overhaul, **y** = feature, **z** = bugfix.

## 2026-09-03 (sixteenth session) — 5.1.4 — BUG-038: stopped discarding Microsoft/Google's `error_description`, so the "invalid_request" banner is finally diagnosable; also fixed a related crash-risk double-decode bug

- **Bugfix version bump.** Mahdi retried Microsoft sign-in after BUG-037's fix and got a banner reading exactly `⚠ invalid_request` — a real Microsoft/Entra ID error code, correctly displayed for the first time (proving BUG-037's fix works), but useless on its own. Root cause: `src/backend/api/index.php`'s OAuth callback routes read `$_GET['error']` but never `$_GET['error_description']` — the field that actually carries Microsoft's explanation (usually a specific `AADSTS#####:` line).
- Both the Microsoft and Google callback routes now log the full provider error server-side and forward `error_description` to the client as a new `auth_error_description` param; `useAuth.ts`'s banner now shows `<code>: <description>` instead of a bare code.
- **Also fixed, caught while verifying the above**: `useAuth.ts` was calling `decodeURIComponent()` a second time on a value `URLSearchParams` had already fully decoded — harmless for the old two-word error codes, but would throw an uncaught `URIError` (blank screen instead of a banner) on any real-world `error_description` containing a literal `%`. Removed the redundant decode.
- This does **not** fix Microsoft sign-in itself — the reason Microsoft is rejecting the request is still unknown. It makes that reason visible on the next attempt instead of silently discarding it. Full reasoning, two researched-but-unconfirmed candidate causes, and the exact next step in `docs/BUGLOG.md` BUG-038.
- Verified: `npx tsc --noEmit` clean, `php -l` clean, `php tests/smoke_test.php` 24/24, `scripts/check-repo-hygiene.sh` clean, full `make build-deploy` passes all 4 artifact checks (fix confirmed present in the built artifact directly). Runtime string/decode logic verified three independent ways since this sandbox's CLI can't introspect real HTTP headers — see `docs/DEV_STATUS.md`'s sixteenth-session entry for the exact method.
- Not deployed yet at commit time: source-only commit, per the mandatory source/deployment separation rule — CI publishes to `macerti/duration_calculator` on push to `main`. Confirm the publish workflow completed before asking Mahdi to retry.

---

## 2026-09-02 (fifteenth session) — 5.1.3 — BUG-037: fixed a frontend bug masking SSO's real error; root cause of the sign-in failure itself still open

- **Bugfix version bump.** `src/frontend/src/hooks/useAuth.ts` had a race condition: the OAuth callback's `?auth_error=` was detected and set into state, but the very next line (inside `fetchMe()`, called synchronously after) unconditionally reset that same state to `null` in the same React batch — so any real SSO failure always silently looked like "back to login, no message," regardless of what actually went wrong server-side.
- Fixed so a detected `auth_error` survives to render, and added explicit handling for the "server says `auth=ok` but `/auth/me` still says unauthenticated" case, which previously looked identical to a normal logged-out visit.
- This does **not** fix SSO itself — Mahdi still can't complete a Microsoft sign-in. It narrows the cause to two candidates (session persistence on the host, or a wrong Azure client secret value) and makes whichever one it is visible on the next attempt. Full reasoning in `docs/BUGLOG.md` BUG-037.
- Verified: `npx tsc --noEmit` clean, full `make build-deploy` end to end passes all artifact checks, `php tests/smoke_test.php` 24/24.

---

## 2026-09-02 (fourteenth session) — 5.1.2 — BUG-036: production outage fix (deployment artifact was missing src/backend/auth/)

- **Bugfix version bump.** A prior session's SSO commit (`3396425`) added `src/backend/auth/` and an unconditional `require_once` of it from `api/index.php`, but never updated the deployment build steps to copy that folder — so the live artifact was missing it entirely. Every API request, not just SSO, fatal-errored with a PHP `require_once` failure. Reported as "Microsoft sign-in returns HTTP 500"; investigation found the real scope was a full outage.
- Fixed `Makefile`'s `build-deploy` and the CI workflow's deployment-assembly step to copy `src/backend/auth/`, with explicit `test -f` assertions for the three new files.
- Extended `scripts/check-deploy-artifact.sh` (Work Package G) with a generic structural check: every `__DIR__`-relative PHP `require`/`require_once` in the built artifact must resolve to a real file inside it. Negative-tested before trusting it (deleted `auth/` from a real built artifact, confirmed it's caught by name).
- Verified: rebuilt `_deploy/` end to end, all artifact checks pass; reproduced the original fatal error against an exact replica of the broken live layout, then confirmed it's gone against the fixed artifact; `php tests/smoke_test.php` 24/24; `npx tsc --noEmit` clean.
- SSO itself remains unverified end to end (no host/browser access from this session) — see `docs/BUGLOG.md` BUG-036 and `docs/DEV_STATUS.md`'s fourteenth-session entry for what's still open.

---

## 2026-09-02 (tenth session) — no version change — Work Package G (repository hygiene checks) completed

- No calculation/business-logic code changed — the repository architecture restructure's one deliberately-deferred item (`REPOSITORY_ARCHITECTURE.md` section G) is now done, matching this project's convention that reorg/tooling-only sessions don't bump the version.
- Added `scripts/check-repo-hygiene.sh` and `scripts/check-deploy-artifact.sh`, wired into `Makefile` and CI (`.github/workflows/build-test-publish.yml`). Both were negative-tested against a scratch repo/artifact before being trusted, and one false positive (Expo's web export legitimately mirroring asset paths under a `node_modules`-named folder) was caught and fixed during that testing rather than shipped.
- The checks' first real run against the tracked tree caught genuine, previously-unnoticed gaps, all fixed this session: `src/backend/` had no `README.md`; `src/frontend/README.md` and a comment in `src/frontend/src/config/api.ts` still described the pre-restructure layout (the latter also had a wrong local dev port — fixed `4000` → `8000` to match `make dev-backend`); `src/frontend/package.json`'s leftover `"audit-mobile"` name was renamed to `"duration-calculator-frontend"` (lockfile regenerated, `npm ci` re-verified clean).
- Also found manually (not by the automated check itself) and fixed: `_deploy/` — the local build-artifact directory — was never in `.gitignore`, meaning a careless `git add -A` could have committed the entire deployment artifact into this source repo.
- Verified after all changes: `npx tsc --noEmit` clean, `npx expo export --platform web --clear` succeeds, `php tests/smoke_test.php` 24/24, full `make build-deploy` (including the new artifact check) succeeds end-to-end. Full detail in `docs/DEV_STATUS.md`'s tenth-session entry.

---

## 2026-09-02 (ninth session) — no version change — repository architecture consolidation completed; BUG-031 opened

- No calculation/business-logic code changed this session — pure reorganization plus one bug-log entry from live evidence, matching this project's own convention that reorg/doc-only sessions don't bump the version.
- Completed the repository architecture restructure four prior sessions (fifth through eighth) had judged too large and deferred: `audit-mobile/` → `src/frontend/` and `duration-calculator-php/` → `src/backend/{api,engine,data,db}` (`git mv`, history preserved), every CI/import/doc path reference updated (including a stale `duration_calculator_backend` string left in `.github/workflows/build-test-publish.yml`'s publish-commit message by an earlier session's repo rename), plus the remaining `REPOSITORY_ARCHITECTURE.md` deliverables: root `Makefile`, `CONTRIBUTING.md`, `RELEASES.md` (seeded from a real side-by-side read of this repo's log and `macerti/duration_calculator`'s), and `docs/CALCULATION_RULES.md`.
- Rewrote `docs/DEPLOY.md`, which had gone stale describing a two-service deployment topology that isn't what's actually running; also fixed a "3 new tables" claim to the correct 4 (`clients` was missing), caught by actually running `schema.sql` rather than re-reading the doc.
- Full regression re-run against the moved tree, not just reasoned about: `smoke_test.php` 24/24, `http_api_test.php` 16/16 (through a real local MariaDB), frontend `tsc --noEmit` clean, `expo export --platform web` succeeds with the correct base path, and `make build-deploy`'s assembled tree diffs identical (top-level listing) against a fresh clone of the real deployment artifact repo.
- **Opened BUG-031**: a screenshot of the live production app showed every `/api/...` request 404ing with the app's own `Not found: $method $path` error format (not a generic webserver 404), which is direct evidence the request reached PHP — narrowing BUG-030's still-open `AllowOverride` question toward a more specific, more easily fixed hypothesis: the live server's actual `config.php` (gitignored, never touched by the deploy pipeline) most likely still has the default empty `basePath`, not manually updated after BUG-030's fix shipped code for it. See `docs/BUGLOG.md` for the full reasoning and the exact recommended fix/verification steps — this is now the top-priority open item, ahead of BUG-030's separate still-open `AllowOverride` confirmation.
- Two `REPOSITORY_ARCHITECTURE.md` definition-of-done items explicitly deferred rather than silently skipped: PHP `tests/` stayed co-located under `src/backend/` instead of moving fully top-level (relative-`require` coupling), and the automated CI/repo-hygiene checks (work package G) untouched. Full detail, including the exact commands/results for every regression check above, in `docs/DEV_STATUS.md`'s ninth-session entry.

---

## 2026-09-02 (eighth session) — no version change — first real Apache/.htaccess topology verification

- No application code changed this session — verification and documentation only (same category as the fourth session's DB re-verification entry).
- Closed BUG-030's last open item: stood up a real Apache 2.4 + `mod_rewrite` + `mod_php` + MariaDB 10.11 instance (not PHP's built-in dev server) with the app deployed at the real production subpath and `basePath` set to the real production value. 13/13 checks passed: full HTTP regression (health, NACE search/lookup, case POST/GET/PUT/DELETE, OPTIONS) plus every `.htaccess` security deny-rule (`.sql`, `db/*.php`, `.csv`, simulated backup/swap files), tested as real requests, not simulated.
- **New action item, not a code fix**: confirmed (via a controlled negative test — `AllowOverride None` instead of `All`) that this app's routing and its data-exposure protection both depend entirely on the real host granting `.htaccess` override permission, which has never been confirmed against the actual `tools.macerti.com` DirectAdmin host. With overrides off, the API 404s entirely on one hand, or `db/schema.sql`/the NACE and parameter CSVs become publicly downloadable on the other — no error surfaces either way. Recommend confirming this directly against the live host or DirectAdmin panel. Full detail in `docs/BUGLOG.md` (BUG-030 update) and `docs/DEV_STATUS.md` (eighth-session entry).
- Also recorded a sandbox/tooling-only finding (not an application issue): a backgrounded MariaDB process does not survive past the end of a single command invocation in this project's automated testing sandbox, unlike Apache; worked around by running the full DB+Apache+test sequence in one script. Documented so a future automated session doesn't re-diagnose it.

---

## 2026-09-02 (seventh session) — 5.1.1 — BUG-030 fixed: router no longer relies on SCRIPT_NAME

- Fixed BUG-030: `duration-calculator-php/api/index.php` computed its deployment-subdirectory prefix from `dirname($_SERVER['SCRIPT_NAME'])`, which PHP's built-in dev server sets inconsistently for router-script requests depending on how the router script path is invoked — silently misrouting every multi-segment URL (`/nace/*`, `/cases/:id`) under some invocations but not others. Replaced with an explicit `basePath` config value (new key in `config.example.php`, default `''`); routing behavior no longer depends on dev-server invocation details.
- Reconciled the standing contradiction between the fourth session's "16/16" and the sixth session's "5/16" results for the identical-looking test command: root cause was that `.github/workflows/build-test-publish.yml` (and, apparently, the fourth session's manual run) invokes `php -S` from inside `api/` with a bare `index.php` argument, which happens not to trigger the bug, while the sixth session's reproduction used `api/index.php` from the parent directory, which does. Full write-up in `docs/BUGLOG.md`, BUG-030.
- Re-verified: `smoke_test.php` 24/24, `http_api_test.php` 16/16 under both invocation styles, plus a simulated production-subdirectory (`/duration_calculator/api`) routing check. This also re-confirms BUG-004's PUT/Enregistrer HTTP-contract evidence, which BUG-030 had put in doubt since it shares the same router.
- Not deployed yet: source-only commit, per the mandatory source/deployment separation rule — CI builds/publishes on push to `main`.

---

## 2026-09-01 (sixth session) — Repository architecture consolidation step 2; BUG-030 found (router bug, reopens NACE-404 and BUG-004 PUT evidence)

- Repository architecture consolidation continued: `audit-app/`'s active docs (`BUGLOG`, `DEV_STATUS`, `ROADMAP`, `ORIENTATIONS`, `TEST_CHECKLIST`, `DEPLOY`) moved to `docs/`; `SECURITY`/`CHANGELOG` moved to repo root. `audit-app/backend` and `audit-app/frontend` (the superseded two-folder implementation) compared file-by-file against the canonical `duration-calculator-php/`/`audit-mobile/` to confirm nothing unique would be lost, then deleted (per `REPOSITORY_ARCHITECTURE.md`'s "delete, don't archive" policy) — see `docs/archive/AUDIT_APP_LEGACY.md` for what was verified. `audit-app/` no longer exists. Stale `audit-mobile/CHANGELOG.md` merged into the pre-2026-08-19 section of this file, then deleted (it was fully superseded by that merge, so keeping a second verbatim copy would itself have been the "archive as dumping ground" problem the new policy warns against).
- Found and flagged (not fixed): `audit-mobile/BUGLOG.md` uses an independent `BUG-XXX` numbering sequence that collides with this project's own — the two files' `BUG-001`–`BUG-004` are different bugs. Added warning headers to both files rather than attempting a risky renumbering pass.
- **BUG-030 (new)**: root-caused a router bug in `duration-calculator-php/api/index.php` that misroutes every multi-segment URL path (`/nace/*`, `/cases/:id`) under PHP's built-in dev server, via an unreliable `SCRIPT_NAME`-based prefix-stripping approach. This reopens the previously-"NOT REPRODUCED" NACE-404 finding and puts BUG-004's previously-"VERIFIED" PUT/Enregistrer HTTP evidence in question — see `docs/BUGLOG.md`'s BUG-030 and `docs/DEV_STATUS.md`'s sixth-session entry for full detail, the open contradiction with the fourth session's result, and next steps (real Apache-topology test is now higher priority).

---

## 2026-09-01 (fifth session) — FEAT-003: version and last-update footer (source only, not yet deployed)

- Implemented the IMMEDIATE-priority FEAT-003 request from `ROADMAP.md`: every screen now shows `Version X.Y.Z · Updated on D Mon YYYY at HHhMM` in a persistent footer.
- Version bumped to `5.1.0` (feature addition) — single source of truth is `audit-mobile/package.json`, consumed automatically via a generated file, never hand-duplicated across screens.
- Update timestamp is sourced from the last git commit touching `audit-mobile/`, not the build machine's or the viewer's local clock.
- Verified: clean `npm ci` (confirms auto-generation works), zero-error `npx tsc --noEmit`, successful `npx expo export --platform web --clear` with the new version/footer strings confirmed present in the built bundle. Not yet interaction-verified in an actual browser/device (no such tooling available in this session).
- Not deployed: source-only change, per the mandatory source/deployment separation rule. See `DEV_STATUS.md` for full implementation detail and open items.

---

## 2026-09-01 (third session) — BUG-027 fully addressed in source (not yet deployed)

- Fixed BUG-027 #3's remaining gap: `RoundingStepper`'s value is now an editable `TextInput` (comma/period decimal input, non-numeric stripped, commits on blur/submit, reverts on invalid input) instead of a read-only `Text`. Combined with the prior session's `step={0.01}` fix, BUG-027 #3 is now fully closed.
- Fixed BUG-027 #1: Facteurs now always opens on Siège (root cause: shared `activeSiteIndex` state carried over from wherever the user last was in Effectif). Added sequential "Précédent (site) / Site suivant (site)" navigation through sites within Facteurs; "Calculer" now only appears once the last site is reached instead of being available immediately regardless of how many sites remain.
- Fixed BUG-027 #2: each Synthèse site card now shows a "Récapitulatif annuel" — total duration per year, with a per-standard breakdown when a site has more than one active standard — derived from the same rounded values as the existing steppers and grand total, so it cannot disagree with either.
- BUG-027 (#1/#2/#3/#4) is now source-complete. All evidence remains STATICALLY VERIFIED (`npx tsc --noEmit`, 0 errors) and BUILD-VERIFIED (`npx expo export --platform web --clear` succeeded, new strings confirmed present in the built bundle) — no browser/device environment was available, so nothing here is claimed as interaction-VERIFIED. See `DEV_STATUS.md` and `BUGLOG.md` for full detail and open hand-off questions.
- Not deployed: source-only change, per the mandatory source/deployment separation rule.

---

## 2026-09-01 (second session) — BUG-025/026/027 frontend fixes (source only, not yet deployed)

- Fixed BUG-025 #1 (report screen now uses the app's breadcrumb navigation instead of the native header back arrow), #2 (unified the "Accueil" home icon treatment across all screens via a new `Breadcrumbs` icon-crumb), and #3 (found and fixed the actual root cause of the multi-standard Synthèse tab not switching: it read Facteurs-step-scoped state instead of a per-site value; now keyed by site ID).
- Fixed BUG-026: Siège name/address fields used a numeric-only input component; added a proper text-input component and swapped it in for just those two fields.
- Fixed BUG-027 #4: removed the redundant bottom "Retour" button in Synthèse (step navigation is already covered by the existing step tabs).
- Partially fixed BUG-027 #3: the +/- rounding controls now step by 0.01 as required; manual typing into the field is still not implemented and remains open.
- BUG-027 #1 and #2 remain untouched.
- Verification this session: clean `npm ci`, zero-error `npx tsc --noEmit`, and a successful `npx expo export --platform web --clear` (the same build step CI runs). No PHP/MariaDB/browser/device environment was available, so nothing here is claimed as interaction-VERIFIED — see `DEV_STATUS.md` and `BUGLOG.md` for full evidence levels and open items.
- Not deployed: source-only change, per the mandatory source/deployment separation rule.

---

## 2026-08-31 — Investigation hand-off

- Added DEV_STATUS.md as the single current hand-off ledger for concurrent development. It explicitly separates verified work, static/reported evidence, open work, and dependencies.
- BUG-004 investigation: the exact minimal wizard mount payload was sent directly to POST /cases and returned **201** with the expected calculation. This rules out payload shape as the established cause of the initial production failure, but does not explain the production failure. The no-retry/silent-catch defect remains open.
- BUG-004 Enregistrer / PUT /cases/:id has **not yet been tested**.
- New NACE finding: GET /nace/search?q=... and GET /nace/:code returned **404** under PHP's built-in development server. Path stripping is only a hypothesis. SCRIPT_NAME / REQUEST_URI debugging and production-topology comparison remain undone.

---

---

## [5.0.0] — 2026-08-30

### 5.0.0 — Persistent wizard state, real synergy input, per-calculation factor control
Major overhaul: calculations now auto-save from the moment they're created
and continuously as they're edited, with full editable-state hydration on
reopen — closing the biggest known gap from earlier versions. Synergy input
redesigned to match the spec exactly (checkbox-derived level, real
auditor×standard matrix) rather than a manual dropdown guess. Several
concrete UX fixes plus one explicit business-rule reversal.

**Verified against the source spec before building, not guessed**
- Re-read `GS0106_Audit_Duration_Rules.md` before touching synergy or the
  sampling toggles. Confirmed: integration level (Basique/Élevé) is
  self-assessed against 4 specific criteria (3 for Basique, +1 more for
  Élevé) — not picked directly from a list. Confirmed: the auditor
  capability input is genuinely a matrix (up to 7 auditors × up to 6
  standards, marking which each auditor is qualified on). Confirmed: the
  per-site "échantillonnée année 2/3" toggles are correctly a manual
  decision already — nothing was wrong there, verification only.

**Persistent wizard state — the big one**
- New `wizard_state_json` column stores the full editable wizard state
  (sites, sectors, personnel, every factor selection, synergy config)
  separately from the engine-computed input/result, since resolved risk
  levels and factor totals don't carry enough information to reconstruct
  which sectors were picked or which catalogue items were ticked.
- A calculation is now saved as a draft **the moment "+ Nouveau calcul" is
  tapped** — before any real data exists — and every subsequent change
  (debounced ~1.2s) saves automatically. Reopening a saved calculation now
  **fully restores every wizard step**, not just the last computed result —
  closes the "known limitation" flagged in every changelog since 2.0.0.
- Verified live end-to-end against a real database: created a client,
  created a draft via the same call shape the wizard makes, confirmed the
  full `wizardState` (site name, sector, personnel) round-trips exactly on
  reopen, matching what was sent.

**Synergy — rebuilt to match the spec, not a UI guess**
- Removed the manual Élevé/Basique/Non-applicable dropdown. Replaced with 4
  checkboxes for the actual self-assessment criteria; the app derives the
  resulting level from what's checked.
- Replaced the single "how many standards is this auditor qualified on"
  number input with the real matrix the spec describes: rows are auditors,
  columns are the site's active standards, each cell a qualification
  checkbox — the count the engine needs is derived by counting checked
  cells per row, not typed in directly.
- Verified live via the full API with 2 standards and a 2-auditor matrix:
  `capacity = 1/(2×1) × 100 = 50%` → `-10%` for "Élevé", applied
  identically to both standards, exactly matching the hand-verified formula
  from the previous round.

**Factors step**
- Every ticked catalogue factor's percentage is now editable per line, for
  *this calculation only* — never changing the shared catalogue.
- Live running augmentation/reduction totals shown as you tick, with a
  clear (not blocking) indicator when a total exceeds the aggregate cap —
  the engine still enforces the cap in the actual calculation; this is
  purely so the person can see it happening as they work.
- Unlimited "Autre" (augmentation and réduction) entries, each with its own
  label, percentage, **and dedicated justification** — was one shared slot
  per direction before. Verified live: 3 entries (+4%, +3%, −6%) correctly
  summed to a net +1%.
- Risk level per standard is now overridable for this specific calculation
  — the auto-resolved value from the site's sector(s) is still shown and
  used by default, but can be changed without touching the sector data.
- Confirmed (direct engine test, not assumed): factors have always been
  scoped per-site-*per-standard* — ticking a factor for one standard never
  touches another standard's selections. Whatever looked otherwise in
  earlier testing was very likely the stale-closure bug fixed in 3.0.0.
- Sub-tabs added for sites with 2+ active standards, so each standard's
  full configuration doesn't have to be scrolled through in one long list.
  Synergy stays above the sub-tabs (it's a site-level input, not
  per-standard) — matches how the spec itself scopes it.

**Synthèse (renamed from Récap)**
- Same per-standard sub-tab treatment as Facteurs, with site-level info
  (name, NAE breakdown, sectors) shown once above the tabs rather than
  repeated per standard.
- Each duration line's small gray "suggestion" hint (nearest clean
  quarter-day, added last round) is unchanged — still a suggestion only.

**Site & Siège labeling**
- The HQ now shows a fixed "Siège" label (with a building icon) ahead of an
  editable name field pre-filled with the client's own name — keep it or
  change it. Regular sites show a fixed, auto-numbered "Site 01"/"Site
  02"/... label the same way, renumbering automatically when a site is
  removed (never a stored, staleable number). Both got an optional address
  field.

**Search**
- NACE search now also matches the three per-standard technical reference
  codes (Code_QM_Qualite, Code_OH_Securite, Code_EM_Environnement) — e.g.
  "14.2" now finds the sector it belongs to. Verified against real data.
- Added a "browse full list" button next to the search field — a modal
  listing every sector with checkboxes, for finding one without needing to
  know what to type.

**Explicit decision reversal: client delete now cascades**
- 4.0.0 shipped `ON DELETE SET NULL` (deleting a client orphaned its
  calculations rather than destroying them) as a deliberate choice.
  Reversed this round, per direct instruction: deleting a client now
  deletes its calculations too. `schema.sql`'s migration re-points the FK
  to `CASCADE` regardless of which earlier state it's in. Verified live:
  deleted a client with an existing calculation, confirmed the calculation
  was genuinely gone afterward (not orphaned, no error).

**Navigation**
- "Accueil" added as the leading breadcrumb on the clients list and client
  detail screens — previously only the wizard had a way back to Home from
  a breadcrumb-style control.

**Repository / process**
- Two GitHub repositories now track this project going forward:
  `duration_calculator` (the deployable artifact — what actually gets
  uploaded to hosting) and `duration_calculator_backend` (all source:
  every project this whole effort produced, frontend and backend and the
  Node/TS and two-folder-PHP reference versions).
- Found an existing, well-built CI/CD workflow already in the deploy repo
  (FTP deploy on push to main, using GitHub Secrets for credentials, PHP
  smoke tests gating deployment, explicit `config.php` exclusion) that
  wasn't created this session — inspected it in full before doing anything
  with it (never trust an unreviewed GitHub Actions workflow), confirmed it
  was safe and well-designed, and merged this round's changes on top
  without disturbing it.
- No real credentials committed to either repository — caught and removed
  two accidental credential-file copies (`audit-engine/.env`,
  `audit-app/backend/config.php`) before the initial commit, verified clean
  with an exhaustive grep for the real DB password afterward.

**Verified**
- PHP: 24/24 tests pass, synced identically across both PHP projects
- Typechecks clean, bundles clean for web (534 modules)
- Full live-database round-trip covering every major feature in this
  release together: client creation, draft auto-save with wizardState,
  hydration on reopen, synergy through the full calculate endpoint,
  multi-Autre summation, and cascade delete — all confirmed working against
  a real MariaDB instance at the real deployment path depth

---

## [4.1.0] — 2026-08-23

### 4.1.0 — Design system, security hardening, testing infrastructure
Confirmed working from the previous round: shake animation, undo toast, year
grouping. One tweak (toast position) plus three standing additions this
round: a real semantic design-token system, a genuine security audit with
concrete fixes applied, and a permanent test checklist with a version
history log.

**Toast repositioning**
- Undo/delete toasts (and simple toasts, for consistency) now anchor to the
  **bottom** of the screen instead of the top — standard placement for
  undo/snackbar-style toasts. Offset tuned to clear the wizard's fixed
  bottom step-tabs bar rather than overlapping it.

**UI Visual System — design tokens, not just principles**
- Adapted a general UI Visual-System design principle (semantic roles over
  per-component styling) specifically to this project and wrote it into
  `ORIENTATIONS.md` as a standing rule, with a concrete reference to the
  real implementation rather than just prose.
- New `src/theme/tokens.ts` — formalizes the app's existing monochrome +
  semantic-accent visual language into named roles: `surfaceBase/Sunken/
  Raised/Overlay`, `contentPrimary/Secondary/Tertiary/Quaternary/Disabled`,
  `borderSubtle/Default/Strong`, `actionPrimary/Secondary/Disabled`, state
  colors with matching surface tones, plus `spacing`/`radius`/`typography`
  scales. This is a naming pass over the existing palette, not a redesign —
  per the principle of preserving the chosen visual language.
- Migrated the small shared components to actually use it (not just
  reference it): `Toast`, `RoundingStepper`, `Breadcrumbs`, `StepTabs`,
  `StatusPill`. The larger screens and remaining form components still use
  their original hardcoded values — tracked explicitly in `ROADMAP.md` as a
  deliberate, unfinished migration (roughly 180 hardcoded color references
  existed across the codebase at the start of this round), not something
  attempted all at once.

**Security — real audit, concrete fixes, honestly scoped remainder**
- New `SECURITY.md` — living audit log (done/todo, not a wishlist), and a
  new "Security" section in `ORIENTATIONS.md` establishing the standing
  principles (prepared statements always, never trust client input, fail
  closed on errors, least privilege on what's web-reachable, defense in
  depth, and treating confidentiality/integrity/availability as three
  separate questions).
- **Confirmed clean**: SQL injection — every query across `db/*.php`
  audited directly (not assumed), all use parameter binding, including
  `LIMIT`/`OFFSET` values bound as `PDO::PARAM_INT` rather than
  interpolated (the specific place integer values most often get handled
  unsafely).
- **Fixed**: error responses no longer leak internals. The router's
  catch-all previously returned raw exception messages straight to the
  client on any unexpected error — now logs full detail (message + file +
  line) server-side via `error_log()` and returns a generic message,
  with an opt-in `config.php` `'debug'` flag (defaults `false`) for local
  testing only. Verified live: a deliberately malformed request produced
  the generic client-facing message while the real detail, down to the
  exact file and line, was confirmed present in the server log.
- **Fixed**: backup/editor-swap files blocked. `config.php~`,
  `config.php.bak`, `.swp` files, etc. don't get handed to PHP by Apache —
  they'd be served as plain text, exposing the real DB password. `.htaccess`
  now blocks these extensions alongside the existing `.sql`/`.csv` rules.
- **Fixed**: baseline security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`) — set in both `.htaccess` and
  directly in every API response (redundant on purpose, so it doesn't
  depend on `mod_headers` being enabled on a given host). Verified live via
  `curl -I` at the real deployment path.
- **Fixed**: server-side length validation on `name` and `dossierRef` —
  client-side validation is a UX courtesy, not a security control, since
  nothing stops a direct API call that bypasses the frontend entirely.
  Caps match the DB column sizes. Verified live: a 300-character name was
  rejected with a clean `400` before reaching the database.
- **Investigated and honestly characterized, not just dismissed**: `npm
  audit` on the frontend reports 15 findings. Traced every one to Expo's
  *build toolchain* (`metro`, `@expo/cli`, `xcode`) — devDependencies used
  only when running `expo export` locally, never part of the bundle served
  to actual end users. Documented why `npm audit fix --force` isn't the
  right move here (risks breaking Expo SDK compatibility for no real-world
  safety gain) rather than either ignoring the warnings or overstating them.
- **Documented as prioritized Todo, not silently deferred**: authentication
  (currently zero access control on any endpoint — the single biggest gap
  before real client data goes in, with a concrete recommended approach:
  PHP sessions + `password_hash()`/`password_verify()` + CSRF once sessions
  exist), rate limiting (concrete DB-backed approach outlined, no extra
  infrastructure needed), remaining input-validation gaps (`validationBounds`
  exists in the parameter set but was never wired into actual enforcement),
  and availability/backup strategy (confirm DirectAdmin's backup tools cover
  the database, not just files).

**New: `TEST_CHECKLIST.md`**
- Scenario-based test cases covering every feature built so far — client
  CRUD, calculation wizard (all 4 steps, including the specific
  reproduction steps for the contradiction bug and the data-loss regression
  check), the report, search, navigation, responsive layout, backward
  compatibility, toasts, and self-checkable security spot-checks (e.g.
  visiting a blocked file directly and confirming 403).
- Includes a **Test History** log at the bottom — append-only, one entry
  per test pass with version/date/failures — so results build into a
  record over time instead of only reflecting the most recent check.
- `ORIENTATIONS.md`'s logging section expanded from three standing files to
  five: `CHANGELOG.md`/`ROADMAP.md`/`BUGLOG.md` (existing) plus
  `SECURITY.md`/`TEST_CHECKLIST.md` (new, same standing-file treatment —
  always present, always updated in the same pass as the change that
  prompted them, always shipped inside the deliverable).

**Verified**
- PHP: 24/24 tests pass
- Typechecks clean, bundles clean for web (533 modules)
- Full live-database round-trip at the real deployment path depth: security
  headers present, oversized input rejected with a clean 400, calculation
  total still exactly `15.25` (unchanged, confirming none of this round's
  changes affected the engine's math), static assets reachable

---

## [4.0.0] — 2026-08-22

### 4.0.0 — Critical crash fix, full CRUD, synergy UI, formula transparency
Triggered by another real-usage feedback round. One item was urgent (a crash
on reopening old calculations) and fixed first; the rest is a mix of
concrete UX fixes, completed CRUD, and a first working synergy UI answering
a direct question about multi-standard support.

**Critical, fixed first: blank white page reopening a saved calculation**
- **Root cause**: the 3.0.0 engine change added `reportWritingFinal`/
  `reportWritingCalculated` fields to each year's result. Any calculation
  saved *before* that change has `result_json` in the database without those
  fields. `RoundingStepper` called `.toFixed(2)` directly on them —
  `undefined.toFixed()` throws, and with no error boundary anywhere in the
  app, a render throw produces a totally blank page with zero indication
  anything went wrong.
- **This was never a database schema problem** — re-running `schema.sql`
  (which is what re-running it would attempt to fix) couldn't have helped,
  since the mismatch was between old *stored JSON content* and new
  *frontend rendering expectations*, not the SQL table structure.
- **Fix, three layers**: (1) `RoundingStepper` now guards every numeric prop
  against `undefined`/`NaN`, falling back to `0`; (2) both screens' internal
  `getRounded()` helpers carry the same guard; (3) added a global
  `ErrorBoundary` (new) wrapping the whole app, so *any* future render crash
  shows an actual message and a way back to Home instead of a dead blank
  screen — a general safety net, not just a patch for this one case.
- **Verified**: manually inserted a row into a real database with the exact
  old JSON shape (missing the new fields entirely) and confirmed
  `GET /api/cases/:id` serves it correctly (HTTP 200) — the API layer was
  always fine; the crash was 100% in frontend rendering, now guarded.

**Full CRUD for clients and calculations, no confirmation dialogs**
- `DELETE /api/clients/:id`, `DELETE /api/cases/:id` — new endpoints.
- **Optimistic delete + 30-second undo, exactly as requested**: nothing is
  actually deleted server-side the moment you tap delete — the item
  disappears from the list immediately, and a toast appears with an "Annuler"
  button and a visibly depleting progress bar showing time left. Tap Annuler
  before it empties and the item reappears, no API call was ever made.
  Let it run out and *then* the real `DELETE` call fires.
- Deleting a client no longer risks destroying its calculations: fixed the
  `client_id` foreign key to `ON DELETE SET NULL` (was un-set before,
  meaning a client with any calculations couldn't have been deleted at all
  — this hadn't been hit yet since delete didn't exist until now). A
  migration in `schema.sql` re-points the FK even on an already-seeded DB.
  Calculations are the real data; clients are just a label — see
  `ORIENTATIONS.md`.
- Client rename (already had the endpoint, now has a UI: tap the pencil icon
  next to the client name) — completes CRUD, not just Create+Read.

**Validation and navigation**
- Empty client name on "Créer": the field now visibly shakes and shows
  "Le nom du client est obligatoire" directly under the input — previously
  the button silently did nothing.
- Home button: replaced the emoji with an actual icon (`Ionicons`
  `home-outline`) and repositioned it to lead the breadcrumb trail
  (Home icon → Clients → Client → Calcul) instead of sitting isolated on
  the opposite side of the row from the rest of the navigation.

**Search**
- **Accent-insensitive**: "telecom" now matches "Télécommunication".
  Implemented as a fixed French/Latin diacritic-folding table rather than
  `iconv(...TRANSLIT...)` — iconv's transliteration behavior depends on the
  host's installed locale data, which isn't something we can guarantee
  across different shared-hosting providers; a fixed table is predictable
  everywhere PHP runs.
- **Matches NACE or EAC code too**, not just the description — searching
  "39" now surfaces every sector whose NACE or EAC code contains "39".
- Both verified against real data (`nace_risque_table.csv`), not just typed.

**Visual grouping**
- The recap step and the traceability report now group each visit (Étape 1,
  Étape 2, and report-writing for the initial visit; on-site + report-writing
  for each surveillance year) into a visually distinct bordered block with a
  year header — was previously a flat list with only small text labels
  distinguishing years.

**Report — numeric substitution, not just formula labels**
- The shift-team aggregation line ("clé + √somme des autres") now shows the
  actual numbers: e.g. *"50 (équipe clé) + √50 (somme des autres équipes) =
  50 + 7.071 = 57.071 → 58 NAE (arrondi sup.)"* — computed by the engine
  itself (new `shiftAggregationExplanation` field on the NAE result), not
  reconstructed client-side, keeping the business logic authoritative in one
  place. Verified against the spec's own worked example: 58 NAE, exact match.
- The base-duration/risk section now shows the actual resolved risk level
  and the real numeric substitution for the stage-coefficient multiplication
  (e.g. *"10 j (base) × 1.000 (coefficient d'étape 'Initial') = 10.000 j"*),
  not just the formula's shape with no numbers.

**Synergy (IAF MD11) — now exposed in the UI, answering a direct question**
- The engine has always fully supported this; only the wizard never asked
  for it. New: when a site has 2+ active standards, a "Synergie /
  Intégration" panel appears in the Facteurs step — integration level
  (Élevé/Basique/Non applicable) and each auditor's qualification count
  across the site's active standards. The same synergy inputs apply
  identically across all of that site's standards (correct per the engine's
  own formula, which depends only on team/integration inputs, not which
  specific standard) — verified with a direct 2-standard, 2-auditor test:
  `capacityPercent = 1/(2×1) × 100 = 50%`, banded to `−10%` for "Élevé"
  integration, applied identically to both standards while their totals
  correctly still differ (different IAF tables per standard).
- Result shown in both the recap (inline) and the full report (with the
  capacity percentage).

**Answered directly, not changed**: confirmed (again, via direct engine
test) that reduction/augmentation factors are scoped per-site-*per-standard*,
never bleeding across a site's other standards — `standardConfigs` has
always been a separate object per standard. The earlier 3.0.0
stale-closure fix is very likely why this looked otherwise before.

**Rounding guide column**
- Each duration line in the recap now shows a small gray "suggestion : X j"
  hint — the calculated value rounded *up* to the nearest clean quarter-day
  (0.00–0.25→0.25, 0.26–0.50→0.50, 0.51–0.75→0.75, 0.76–1.00→next whole
  day; equivalent to `ceil(x × 4) / 4`, verified against every boundary
  example given). Tapping it applies the suggestion — but it's only ever a
  suggestion; the manual value remains the actual variable, exactly as
  specified. No automated rounding was added to the engine.

**Verified**
- PHP: 24/24 tests pass, synced identically across both the deployment
  target and the reference project (including the test file itself, which
  had drifted — see `BUGLOG.md`)
- Typechecks clean, bundles clean for web (532 modules, `Ionicons` font
  correctly bundled)
- Full live-database round-trip: client delete, accent-insensitive search,
  NACE/EAC code search, and old-shaped saved data all confirmed via real
  HTTP calls against a real MariaDB instance, at the real deployment path
  depth
- Synergy math independently verified by hand against the engine's own
  formula before trusting the test output

**Still not independently confirmed in a real browser** (same limitation as
3.0.0 — no headless browser available in this sandbox): the shake animation,
the undo toast's depleting progress bar, and the year-group visual styling
are all typecheck-and-bundle verified only, not visually confirmed. Please
check these on your next pass.

---

## [3.0.0] — 2026-08-21

### 3.0.0 — Real-usage feedback round: engine correctness fix, state-bug fix, traceability report
Triggered by a detailed round of real testing feedback. Three categories:
a genuine engine correctness bug (found while investigating the feedback, not
directly reported), a root-cause state-management bug that explains two
separately-reported symptoms, and a set of concrete UX fixes plus one new
screen (the traceability report, per the explicitly resolved Option 2
preference).

**Engine — verified against source spec before touching anything**
- **Report-writing time is now computed per visit, not once on a combined
  multi-year sum.** Confirmed against `GS0106_Audit_Duration_Rules.md` line
  889: *"Prépa/rapport = 20% × (sum of on-site durations for sites marked
  'Oui' **that year**)"* — explicitly per-year. `years[]` entries now each
  carry their own `reportWritingCalculated`/`reportWritingFinal`.
  Mathematically the grand total is unaffected by this restructuring alone
  (20%×(a+b+c) = 20%a+20%b+20%c), but see the next point.
- **Found and fixed: `totalDaysFinal` never actually included report-writing
  time.** Independent of anything reported — discovered while restructuring
  the above. The engine computed `prepReportFinal` correctly but never added
  it into the total it returns, stores in the DB, and displays everywhere
  (`ClientDetailScreen`'s case list, `case.totalDaysAllSites`). Every
  previously-saved total in this project undercounted the real duration by
  ~20%. Fixed: totals are now built directly from `onSiteDurationFinal +
  reportWritingFinal` summed per year, so this can't silently drift out of
  sync again. Sanity-checked: `15.25 / 12.75 ≈ 1.2`, exactly what adding a
  20%-of-on-site component should do to a total that previously omitted it.
- Confirmed (via a hand-computed direct engine test, then again via the real
  HTTP API against a real database) that **factors correctly apply to a
  siège (HQ) exactly the same as any other site** — `isHq` only ever gated
  multi-site *sampling* eligibility, never factor application. A −15% factor
  on Siège produced `15.25` vs an identical Site 1 with no factor at `18` —
  clearly differentiated, both ways confirmed. The reported "factors don't
  apply to HQ" was very likely a symptom of the state-management bug below,
  not an engine issue.

**Frontend — root-cause state bug fixed**
- **Fixed a stale-closure bug in `CalculationWizardScreen`** that plausibly
  explains both "switching wizard steps loses what I typed" and "a factor
  entered on one site doesn't seem to apply." `updateSite`, `toggleStandard`,
  `addSite`, `removeSite`, and the rounding-override setter all previously
  read the current `sites`/`roundingOverrides` array from closure at call
  time; two updates landing in the same render tick (a field's `onChange`
  firing right as a tab press fires, for instance) could have the second
  update silently discard the first, since it was built from an
  already-stale snapshot. Rewrote every mutator to use React's *functional*
  `setState` form, reading only from the previous committed state — this
  class of bug becomes structurally impossible regardless of timing.
- Sector selection: **removed the hard 2-sector cap.** `DualSectorPicker` now
  accepts any number of declared sectors; `resolveMostCriticalRisk` already
  worked over an arbitrary-length array, so this was a pure UI restriction
  with no backend involvement (confirmed: `/api/nace/search` was never
  capped server-side).
- **Fixed the contradictory validation messaging.** Previously, correcting
  one site's headcount could show a green "correct" message immediately
  followed by a red "not complete" hint referring to a *different* site,
  with no indication which site the red message meant. Now: if the currently
  viewed site's own personnel is complete but another site's isn't, a clear
  blue informational message names both sites explicitly ("L'effectif du
  siège est complet. L'effectif du site 1 doit encore être renseigné.") and
  the primary button changes from "Continuer" to "Aller à l'effectif de
  {site}" — pressing it jumps straight there. Implements the requested
  "Option 1" (smart Next routing) and "Option B" (explicit message) together.
- **Progressive shift-team questions**, extending the existing "how many
  work indirectly, then how many of the rest..." pattern to shift teams:
  after the last shift row's headcount is filled and people remain
  unattributed, the next shift row appears automatically with a prompt
  naming exactly how many remain — no manual "add shift" button anymore,
  matching the requested mechanism exactly ("Parmi les X restantes, combien
  dans la Nème équipe ?" repeated until nothing remains).
- **Separated "Retour" from "Accueil."** Breadcrumb navigation
  (Clients/ClientName links) now uses a hard navigation-stack reset instead
  of `navigate()`, so the native back button afterwards goes where it
  visually should instead of back into a stale wizard screen still sitting
  in history. Added an explicit "🏠 Accueil" link in the wizard (which has no
  native header, by design, to make room for the step tabs) since it has no
  other way back to Home.
- **EAC code** now shown alongside NACE everywhere a sector appears (picker
  chips, search results, the recap screen, the new report) — the data
  already existed in `NaceRiskEntry`, it just wasn't surfaced.
- **Pull-to-refresh data safety**: set `overscroll-behavior-y: contain` on
  web, since the real risk on mobile web is the *browser's own* native
  pull-to-reload gesture reloading the whole page and wiping all in-progress
  wizard state — not anything the app's own scroll views were doing. The
  app has no custom pull-to-refresh of its own yet (parked on `ROADMAP.md`
  along with the requested stretch-and-bounce visual feedback); for now the
  only correct behavior is that the gesture can't fire at all.

**New: `CalculationReportScreen`** — the dedicated traceability report
(Option 2, per the explicit preference: keep the wizard simple, put full
detail in one dedicated view after calculation). Per site: identification
(client, site, NACE+EAC+description), full NAE breakdown reusing the
engine's own line-by-line explanation strings, base IAF duration and the
exact stage-coefficient formula applied, every ticked factor by its real
label (fetched from `/api/parameters`) with its justification text, and the
full per-visit program (Stage 1/2, each surveillance year, each visit's own
report-writing line) showing both the calculated and any manually-adjusted
value. Reachable from the Récap step via "📄 Voir le rapport de calcul
complet."

**Verified**
- PHP engine: 24/24 tests pass with the corrected total (updated from 12.75
  to 15.25 with an explanation in the test itself, not just accepted blindly)
- Typechecks clean, bundles clean for web (494 modules)
- Real MariaDB + real HTTP API test (not the in-memory fallback): HQ-vs-Site
  factor differentiation reproduced end-to-end through the actual API
  (`/api/calculate`), not just a direct PHP function call — `15.25` vs `18`,
  consistent with the corrected engine total
- Client creation and NACE search re-verified against the real database at
  the real `tools.macerti.com/duration_calculator/` path depth

**Known limitation, stated plainly**: `CalculationReportScreen` (the new
report) has **not** been visually verified in an actual browser — this
sandbox has no working headless browser (Puppeteer's Chromium download is
blocked by the network allowlist, and no system Chromium/Chrome binary is
available), so verification stopped at "typechecks and bundles without
error." The stale-closure fix is architectural — a well-understood React bug
class matching the exact reported symptoms — rather than a directly
reproduced-and-confirmed fix, for the same reason. Please treat both as
"should be correct, please confirm" rather than "confirmed" on your next test
pass.

**Explicitly deferred to `ROADMAP.md`, as requested**
- PDF export of the calculation report
- Full audit-trail/archival system beyond what's already in the DB (input
  JSON, result JSON, rounding overrides are all persisted per case — the
  reconstruction requirement is met; a dedicated "why was this the result"
  archival *view* separate from re-opening the case is not built)

---

## [2.0.0] — 2026-08-20

### 2.0.0 — UX overhaul: Client → Calculation model, wizard flow, real UX practices
Major overhaul, not an incremental feature. The app went from "two disconnected
calculator buttons" to an actual workflow: create a client (name only, not a
CRM), create many calculations per client over time, each calculation walks
through a 4-step wizard (Sites & Secteurs → Effectif → Facteurs → Récapitulatif),
with real-time validation, a searchable dual-sector picker, manual rounding,
and a responsive layout that doesn't stretch full-width on desktop.

**Backend — new data model**
- `clients` table (`db/schema.sql`, idempotent migration for already-seeded
  DBs) — id, name, timestamps. Deliberately not a CRM: no contact info, no
  address, nothing beyond a name and its calculations.
- `calculation_cases` extended: `client_id` (FK), `status` (draft/calculated/
  validated), `rounding_overrides_json` (manual per-value day adjustments,
  keyed `siteId:standard:field`)
- `db/clientRepo.php` — create/list/get/update client
- `db/calculationCaseRepo.php` — added `updateCalculationCase()` (PUT), and
  `client_id`/`status` support throughout; `listCalculationCases()` can now
  filter by client
- New endpoints (both `duration_calculator/api/index.php` and, using its own
  URL convention, `audit-engine`'s `backend/public/index.php`): `POST/GET
  /clients`, `GET/PUT /clients/:id`, `GET /clients/:id/cases`, `PUT /cases/:id`

**Frontend — full redesign**
- `HomeScreen` rewritten: compact `StatusPill` (small dot + text, not a
  card-sized block) instead of the old status card; single CTA ("Mes clients")
  instead of the two disconnected NAE/Case buttons
- `ClientsListScreen`, `ClientDetailScreen` — new. Client list (name +
  calculation count), per-client calculation list with status badges
- `CalculationWizardScreen` — new, replaces the old standalone
  `NaeCalculatorScreen` and `CaseBuilderScreen` (both deleted) entirely.
  Four steps, navigable via `StepTabs` (bottom-fixed on mobile, top row on
  desktop/tablet), each step gated on the previous one being valid but freely
  revisitable once unlocked:
  1. **Sites & Secteurs** — site name, `DualSectorPicker` (search-as-you-type
     NACE lookup, up to 2 sectors per site), standard selection chips
  2. **Effectif (NAE)** — `PersonnelForm`, chronological (total → indirect →
     direct non-posté → équipes postées), **live inline validation**: the
     moment declared total + attributed headcount don't match, an in-place
     message states exactly how many people are missing or in excess —
     no waiting until the end of the form
  3. **Facteurs** — per-standard augmentation/reduction factors + mandatory
     justification text; risk level is no longer manually chosen here — it's
     auto-resolved (see below) and shown read-only
  4. **Récapitulatif** — full breakdown (org-wide risk, sampling, per-site
     per-standard base/factors/net/stage/year figures), with a
     `RoundingStepper` per final duration value (manual +/− adjustment,
     since automated 0.25-day rounding isn't wired into the engine yet per
     Mahdi's explicit instruction) and one prominent final total
- `DualSectorPicker` — search-as-you-type (debounced) against
  `/api/nace/search`, up to 2 sectors, shows the auto-resolved risk per active
  standard live as sectors are added/removed
- `resolveMostCriticalRisk()` (`utils/riskResolution.ts`) — new business
  logic: parses raw NACE risk codes, including combo values like `"M ou E"`
  (correctly splits on `"ou"` and takes the more severe token), and picks the
  more critical of up to 2 declared sectors, per standard (each standard has
  its own risk column — SMQ/SMS/SME — so the "critical" sector can differ per
  standard for the same site)
- `Toast` system (`ToastProvider`/`useToast`) — replaces silent failures;
  errors and confirmations surface as dismissing bubbles
- `Breadcrumbs` — Clients › ClientName › Calculation, clickable to jump back
- `ResponsiveContainer`/`ResponsiveGrid`/`useBreakpoint` — caps content width
  and enables multi-column layout at tablet/desktop widths instead of
  stretching mobile-style single-column layouts edge-to-edge on a wide screen
- `StepTabs` — step navigation, bottom-fixed on mobile per Mahdi's explicit
  request, a normal top row on desktop/tablet

**Verified**
- Full 24-test PHP suite still passes untouched
- Typechecks clean, bundles clean for web (493 modules)
- **Real MariaDB integration test** (first time an actual DB was used, not
  just the in-memory fallback): installed MariaDB locally, loaded the
  migrated schema, seeded, and confirmed `dbConnected: true` for the first
  time this project — previous "verified" claims were always against the
  fallback bootstrap, never a real database. Full flow tested against it:
  create client → save calculation linked to that client → list client's
  calculations → update calculation with rounding overrides + status change →
  read back and confirm every field round-tripped correctly
- Full faithful test at the real `tools.macerti.com/duration_calculator/`
  URL depth: static `index.html` and JS bundle both reachable, `/api/health`
  shows `dbConnected: true` against the real schema, NACE search, client
  creation, and case save-with-client-link all confirmed working together
- Combo NACE risk code parsing (`"M ou E"`) verified against actual data rows
  from `nace_risque_table.csv`, confirmed it correctly resolves to the more
  severe token and correctly beats a second, less-severe sector

**Known limitations at this version** (see `ROADMAP.md`)
- Reopening a saved calculation lands on the Récap step with the calculated
  result, but doesn't fully reverse-map back into editable wizard state for
  Sites/Effectif/Facteurs (sectors aren't stored standalone, only the
  resolved risk baked into the saved input) — editing an existing calculation
  from scratch isn't fully wired yet
- Automated 0.25-day rounding is intentionally not implemented — manual
  `RoundingStepper` only, per explicit instruction to leave this manual for now
- `audit-app/backend/public/index.php` (two-folder topology, kept for
  reference) got the same new endpoints for consistency, but wasn't put
  through the same live-DB integration test as `duration_calculator/` — that
  project isn't the deployment target, so this is lower priority

---

## [1.0.0] — 2026-08-19

### 1.0.0 — PHP + MariaDB port, consolidated deployable project
Major overhaul: the entire GS0106 calculation engine was ported from
Node/TypeScript to PHP, and the project restructured as one consolidated
`backend/` + `frontend/` pair meant for DirectAdmin shared hosting deployment
(no Node.js runtime on the server, PHP + MariaDB only).

**Context**: `audit-engine` (Node) and `audit-mobile` (Expo) were built first
and are kept as-is for reference, but confirmed unusable for deployment on
this specific host once we checked DirectAdmin and found no Node.js Selector.

**Added**
- `backend/` — full PHP 8+ port of every engine module: `nae.php`,
  `duration.php` (with extrapolation), `factors.php` (aggregate caps),
  `synergy.php`, `cycle.php` (stage cycling + IAF MD1 sampling), `orgRisk.php`
  (multi-site risk averaging + MROUND), `standardDuration.php` (composition),
  `case.php` (top-level orchestrator), `nace.php` (sector lookup)
- `backend/data/parameters.php` — CSV loader + factor catalogue + synergy grid,
  transcribed identically from the Node version
- `backend/db/` — PDO connection pool, parameter set + calculation case
  repositories, reusing the same `schema.sql` as `audit-engine`
- `backend/public/index.php` + `.htaccess` — single-file REST router
  (mod_rewrite), same endpoint shapes as the Node API (`/health`,
  `/api/parameters`, `/api/nace/:code`, `/api/nae`, `/api/calculate`,
  `/api/cases`) so the frontend needed almost no changes
- `backend/tests/smoke_test.php` — 24-assertion suite ported from the vitest
  suite, including the exact same worked examples
- `backend/config.example.php` / `backend/seed.php` — setup + DB seeding
- `frontend/` — the `audit-mobile` Expo app, copied in, with `src/config/api.ts`
  updated for the new deployment model (PHP backend URL, dev fallback port
  changed from 4000 to 8000 to match `php -S`)
- Root `README.md`, `DEPLOY.md` (DirectAdmin-specific: PHP version, subdomain
  vs subfolder placement, config.php permissions, phpMyAdmin schema import,
  seeding without SSH, CORS tightening, troubleshooting)

**Verified**
- PHP smoke test: 24/24 pass, including `totalDaysAllSites == 12.75` matching
  both the Node engine's test and the mobile app's live integration test byte-for-byte
- Live HTTP test via `php -S`: `/health`, `/api/calculate`, `/api/nae`,
  `/api/nace/:code` all confirmed working, including graceful DB-unavailable
  fallback (expected in this sandbox — the real MariaDB only exists on the
  DirectAdmin server, unreachable from here)
- Frontend built successfully against the live PHP backend; confirmed the
  `EXPO_PUBLIC_API_URL` value gets correctly inlined into the static JS bundle
  (after fixing BUG-001, see `BUGLOG.md`)

**Known limitations at this version**
- `dbConnected`/`dbBackedParameters` only verified against a local PHP dev
  server + in-memory fallback — not yet verified against the actual
  DirectAdmin MariaDB instance, since that's only reachable from the real
  server, not this sandbox. First real deploy will be the first live-DB test.
- Same feature gaps as `audit-mobile` v0.3.0 (synergy UI, NACE search, case
  history screens, extension-site toggle) — this port changes *where* the
  code runs, not what's built yet


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


## 2026-08-31 — CI architecture consolidated and test environment hardened

### Source-owned build/test/publish pipeline
- Established `macerti/duration_calculator_backend/.github/workflows/build-test-publish.yml` as the single authoritative CI/build/publish workflow.
- Deleted the duplicate `.github/workflows/backend-integration.yml`.
- Removed the deployment-side build workflow from `macerti/duration_calculator`; its existing FTP deployment workflow remains untouched.
- The source workflow is responsible for PHP/MariaDB integration tests, frontend typecheck, Expo web export, deployment-tree assembly, and publishing the generated artifact to `macerti/duration_calculator`.
- The deployment repository remains an artifact repository. Developers must not edit it to fix application behavior.

### MariaDB CI correction
- CI now uses a disposable MariaDB 10.11 service with dedicated CI-only credentials.
- The workflow writes a complete temporary `config.php` instead of attempting partial substitutions in `config.example.php`.
- MariaDB client connectivity and PHP/PDO connectivity are verified separately before schema import and seeding.
- No production DB credentials are required in GitHub Actions for this test environment.
- `actions/checkout` and `actions/setup-node` were upgraded to v5 to remove the specific Node 20 deprecation warning source.

### Verification boundary
- Earlier CI runs failed during database configuration and therefore never reached PHP tests, NACE regression tests, PUT/GET case persistence tests, TypeScript, Expo build, or deployment publication.
- The corrected workflow is committed at `65fae75a2450883152d43e844a1712d7635b3d1a`.
- A green CI run has not yet been established; downstream stages must not be described as verified until that happens.


## 2026-09-01 — Deploy interaction findings (BUG-025)

### Report navigation consistency
- The deployed interaction test identified that the end-of-wizard **Rapport de calcul complet** currently behaves as a separate screen without the application's normal breadcrumb treatment.
- Required direction: keep the report content as-is, but make its navigation follow the same breadcrumb hierarchy and avoid a separate report-specific **Retour** convention.

### Breadcrumb home consistency
- The home destination must remain represented by the project's icon system, not an emoji.
- Current source inspection found two treatments: an Ionicons home-outline control in the wizard and text-only breadcrumb rendering in the generic Breadcrumbs component. The next UI change should normalize this rather than introduce another home variant.

### Multi-standard Synthèse switching
- Deploy testing reported that selecting the second standard tab for a multi-standard site does not replace the displayed audit programme in Synthèse.
- Source inspection confirms that Synthèse is intended to switch through activeStandardTab → stdTab → stdResult, but the runtime cause is not established yet.
- This remains an open frontend interaction issue until reproduced and verified after the fix. It must be tested with both one multi-standard site and multiple multi-standard sites to prevent cross-site state leakage.

**Evidence level:** REPORTED / CODE-INSPECTED. No deployment or runtime fix is claimed by this changelog entry.

---

# Pre-PHP-port history — audit-mobile (merged 2026-09-01, repository architecture consolidation step 2)

The three entries below are the original `audit-mobile/CHANGELOG.md`, preserved
verbatim and merged here for one continuous version history. They are the
direct chronological predecessor of `[1.0.0]` above — that entry's own "Added"
section describes copying this exact frontend in as `frontend/` during the
PHP port. A verbatim copy is also kept at
`the pre-2026-08-19 section of this fileCHANGELOG.md` for traceability.

Same versioning convention as `audit-engine`:
- **x** — overhaul: new concept, architecture change, or a big/visible new capability
- **y** — a requested feature landed
- **z** — a bug was found and fixed (see `the pre-2026-08-19 section of this fileBUGLOG.md`)

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
  two separate repos/deploy targets. Flagged as tech debt — a proper monorepo
  (npm workspaces or Turborepo) would remove the duplication risk, but wasn't
  worth the setup cost before the app has more than one working screen.
- **Web export target kept working from day one**: since `npm run web` /
  `expo export --platform web` works out of the box with the same codebase, this
  satisfies the earlier "works in web" requirement without a second React project —
  revisit only if the web UI needs to diverge significantly from the mobile UI.
