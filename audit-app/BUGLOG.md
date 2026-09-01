# Bug Log — audit-app

### BUG-001 — Deleted the verified PHP backend along with a stale contaminated folder
- **Detected**: While starting the DEPLOY.md/logs write-up, `ls` on the
  `audit-app/` directory revealed an old, unrelated Node.js prototype
  (`backend/src/naeEngine.js`, a separate `mobile/` copy, `.git` folders) mixed
  in with the newly-written PHP backend — both had ended up under the same
  pre-existing `audit-app/` path from an earlier abandoned session.
- **Cause**: `audit-app/` already existed with leftover content before this
  PHP port work started; the new `backend/engine/*.php` etc. files were
  created via individual `create_file` calls straight into that pre-existing,
  contaminated directory instead of a fresh one — nothing checked whether the
  destination was clean first.
- **Fix, take 1 (wrong)**: Ran `rm -rf /home/claude/audit-app` to clear the
  contamination — which also deleted the just-written, just-tested
  (24/24 passing) PHP backend, since it lived in the same tree.
- **Real fix**: Recreated every PHP file from the verified content still
  present earlier in this same session (not from memory/guessing — copied the
  exact source), then re-ran `backend/tests/smoke_test.php` and got 24/24
  passing again, confirming the recreated files were byte-for-byte equivalent
  in behavior to the originally-verified version. Also re-ran the live HTTP
  integration test and the frontend build-and-bake-in check to be sure nothing
  was silently different after the rebuild.
- **Process fix going forward**: check `ls`/`view` on a target directory
  before writing many files into it, especially when the directory name was
  chosen ahead of time rather than freshly created in the same turn.
- **Fixed in**: 1.0.0 (caught and corrected before delivery — no bad file was
  ever shipped to Mahdi)

### BUG-002 — Metro bundler cache silently kept a stale `EXPO_PUBLIC_API_URL`
- **Detected**: Rebuilt the frontend with a new `EXPO_PUBLIC_API_URL` (changed
  test port from 8010 to 8020), but the output bundle had the exact same
  filename hash as the previous build, and grepping the new port number in
  the bundle returned zero matches — the old URL was still baked in.
- **Cause**: `npx expo export --platform web` reuses Metro's on-disk bundler
  cache by default; changing an `EXPO_PUBLIC_*` env var between runs doesn't
  invalidate that cache, so the bundle gets served from a stale cached build.
- **Fix**: Added `--clear` to the export command, which forces a fresh bundle.
  Verified: with `--clear`, the new URL (`9999` in the test) appeared in the
  output and old URLs (`8010`/`8020`) did not.
- **Documented**: called out explicitly in root `README.md` and `DEPLOY.md`
  step 8, since this would otherwise silently ship a build pointed at the
  wrong API URL with no error — the app would just fail to connect, or worse,
  connect to a leftover dev server, with no obvious cause in the code.
- **Fixed in**: 1.0.0 (caught during pre-delivery verification)

### BUG-003 — Double `/api` path collision in the single-folder deployment layout
- **Detected**: Building a consolidated single-folder deploy structure
  (`duration_calculator/` with `api/index.php` as the one PHP entrypoint,
  frontend static files at the same root) for `tools.macerti.com/duration_calculator/`,
  a full local dry-run test (faithful simulation of the real Apache rewrite
  behavior, not just `php -S index.php` from the API's own folder) showed
  `/api/calculate` and `/api/health` both 404ing even though the exact same
  route logic worked correctly in the original two-project (`audit-engine` +
  `audit-mobile`) layout.
- **Cause**: Two independent things both assumed they owned the `/api` URL
  segment. The route table (`api/index.php`) matched routes like
  `['api', 'calculate']` — a leftover convention from the two-project layout,
  where the physical folder was named `public/` (no `api` in the path) and
  `/api/...` was purely a REST-namespacing choice in the URL strings. Once the
  physical folder holding `index.php` was renamed to `api/` for the
  single-folder layout (so it converts to `tools.macerti.com/duration_calculator/api/...`),
  the frontend's `EXPO_PUBLIC_API_URL` also had `/api` appended, while the
  frontend's own request paths (`client.ts`) *also* still had `/api/...`
  hardcoded from the old layout — producing `.../api/api/calculate`
  double-prefixed URLs, while the server's own path-stripping logic
  independently over-stripped and produced mismatched single-vs-double `api`
  segments depending on how deep `dirname()` was applied.
- **Fix**: Made the physical `api/` folder the sole source of the `/api`
  namespace. Three coordinated changes: (1) `api/index.php` strips only its
  own directory (`dirname($_SERVER['SCRIPT_NAME'])`, not two levels up) from
  the request path; (2) the route table's match patterns dropped the
  redundant leading `'api'` segment (`['calculate']` not `['api', 'calculate']`,
  etc. — `health` was already correct since it never had the segment);
  (3) `frontend/src/api/client.ts` dropped its own hardcoded `/api/` prefixes
  from every call (`/parameters` not `/api/parameters`, etc.), since
  `EXPO_PUBLIC_API_URL` already ends in `/api`. Fixed in both this project's
  `duration_calculator/` copy and synced back to `audit-mobile/src/api/client.ts`.
- **Verified**: full local dry-run faithfully simulating the real
  `tools.macerti.com/duration_calculator/api/...` path depth — `/health`,
  `/parameters`, `/calculate` (returning the same `12.75` result verified
  everywhere else), and `/nace/:code` all confirmed working through the
  actual `.htaccess`-equivalent routing logic, not just direct PHP calls.
- **Fixed in**: 1.0.0 (single-folder variant, `duration_calculator/`) — the
  original two-project layout (`audit-engine`/`audit-mobile`) was never
  affected by this, since it never had a physical `api/` folder in the first
  place; kept as-is, not touched by this fix.

### BUG-004 — `mb_strtolower` undefined during local testing (missing PHP mbstring extension)
- **Detected**: NACE search endpoint returned a 500 with
  `Call to undefined function AuditEngine\mb_strtolower()` during local dry-run.
- **Cause**: The sandbox's PHP install didn't have the `mbstring` extension
  enabled by default (it was added via `apt-get install php-mbstring` to
  continue testing). `mbstring` is close to universal on real PHP hosting
  (DirectAdmin/cPanel included) but isn't guaranteed on every minimal PHP
  install.
- **Fix**: Added a defensive fallback in `engine/nace.php` — uses
  `mb_strtolower` if the function exists, otherwise falls back to plain
  `strtolower` (loses correct casing on accented French characters in that
  fallback path, but won't hard-crash the endpoint on a host without
  `mbstring`).
- **Fixed in**: 1.0.0 (single-folder variant) — also backported to
  `audit-app/backend/engine/nace.php` for consistency, since it's a pure
  robustness improvement with no behavior change on hosts that do have
  `mbstring` (the overwhelming majority, including DirectAdmin).

### BUG-005 — Shipped `index.html` with root-relative asset paths (would 404 on real subfolder deploy)
- **Detected**: Not caught by me — Mahdi ran the previous `duration_calculator.zip`
  through a separate Claude session for a deployment review, which correctly
  flagged that `index.html`'s `<script src="...">` and favicon `<link>` were
  root-relative (`/favicon.ico`, `/_expo/static/js/web/...js`) instead of
  prefixed with `/duration_calculator/`.
- **Cause**: `EXPO_PUBLIC_API_URL` (a runtime env var baked into the JS bundle,
  controlling what URL the app *fetches from*) was set correctly. But that's
  a completely different thing from Expo's *static asset base path* (what URL
  the browser uses to *load the JS/CSS/favicon files themselves*), which is a
  separate build-time config (`expo.experiments.baseUrl` in `app.json`) that
  was never set. My local verification tested "does requesting the JS file by
  its known path return 200" (it did) but never checked what path the actual
  generated `index.html` told the browser to request — so this shipped
  without being caught, and would have rendered a blank white page once
  deployed to a real subfolder.
- **Fix**: Added `"experiments": { "baseUrl": "/duration_calculator" }` to
  `frontend/app.json` and rebuilt through the real `expo export` pipeline
  (not a manual string patch on the output file). Verified: rebuilding
  produced the exact same JS bundle hash as the fix that came back from the
  other session, confirming both arrived at the same correct mechanism
  independently. Re-verified `index.html` now references
  `/duration_calculator/_expo/...` and `/duration_calculator/favicon.ico`.
- **Also merged from that same review**: a simpler, more robust root
  `.htaccess` (blocks `.sql`/`.csv` and the `db/`/`data/raw/` folders
  directly, rather than my original's fragile two-file PHP allow/deny
  coordination — correctly reasoned that `.php` files execute rather than
  serve as text, so blocking them at all was unnecessary complexity) and a
  cleaner named-function version of the `mb_strtolower` fallback in
  `engine/nace.php` (functionally identical to what I'd written, just
  better-factored). Re-ran the full 24-test suite plus a complete faithful
  local dry-run at the real deployment path depth after merging all of this
  — everything passes.
- **What I'm taking from this**: verify what the *browser* would actually
  request by inspecting the generated HTML's own asset references, not just
  that a file exists at a path I already know to check. A second, independent
  review caught something my own testing missed — worth factoring into how
  thoroughly I self-check subpath-deployment configs going forward, not just
  API routing.
### BUG-006 — `StandardConfigPanel` type error after removing the manual risk picker
- **Detected**: `npx tsc --noEmit` after redesigning `StandardConfigPanel` to
  display an auto-resolved risk badge instead of a manual `SegmentedPicker`
  — the old `SiteEditor.tsx` (now dead code from the pre-wizard UI) still
  called `<StandardConfigPanel>` without the new required `resolvedRisk` prop.
- **Cause**: `SiteEditor.tsx` was fully superseded by the new wizard
  (`CalculationWizardScreen` + `DualSectorPicker` + `PersonnelForm` cover
  everything it did), but wasn't deleted before the `StandardConfigPanel`
  signature changed — a stale caller.
- **Fix**: Deleted `SiteEditor.tsx` entirely. Its only still-needed piece
  (the `ShiftRow` type) was extracted to `src/types/wizard.ts` first, so
  `PersonnelForm.tsx` didn't lose its import.
- **Fixed in**: 2.0.0 (pre-release, caught by typecheck before shipping)

### BUG-007 — Local MariaDB test instance repeatedly died between sandboxed tool calls
- **Detected**: Same class of issue as BUG-004/BUG-005 (this project's earlier
  `php -S` backgrounding flakiness) — `mysqld_safe &` followed by a separate
  tool call to run `mysql` commands against it consistently failed with
  "Can't connect to local server through socket," even though the daemon had
  logged a successful start moments before.
- **Cause**: Same sandbox constraint as before — a backgrounded process's
  lifetime is tied to the tool-call shell session that spawned it, not to the
  actual OS process table, in this particular sandboxed bash tool.
- **Fix**: No code fix (this is sandbox/test-tooling only, not a real
  bug) — every MariaDB + PHP-server + curl sequence was restructured into a
  single combined tool call (start daemon → wait → run all dependent commands
  → done), never split across calls. This is what finally enabled a real
  database integration test for the first time this project (previous
  sessions only ever verified against the in-memory fallback bootstrap,
  despite BUGLOG entries implying broader verification — worth being precise
  about what "verified" meant in hindsight).
- **Fixed in**: 2.0.0 (dev/tooling only — not shipped code)

### BUG-008 — `totalDaysFinal` never included report-writing time
- **Detected**: Not directly reported by Mahdi — found while investigating
  his separate, correctly-reported structural request ("report-writing must
  be per visit, not one lump sum"). While re-reading `standardDuration.php`
  to restructure it, noticed `prepReportFinal` was computed but never added
  into `totalDaysFinal`/`totalDaysCalculated` — those totals were built only
  from `onSiteDurationFinal`, summed across years.
- **Cause**: Straightforward omission when `totalDaysFinal` was first
  written (v1.0.0) — `prepReportFinal` was computed right after, and never
  wired into the sum a few lines below.
- **Impact**: every `total_days` ever stored in `calculation_cases` (and
  every "total: X" this project's own test suite and manual verifications
  asserted, going back to the very first PHP port) undercounted the true
  duration by roughly 20%.
- **Fix**: restructured to compute report-writing per year (see BUG-009) and
  build both `totalDaysCalculated` and `totalDaysFinal` directly from
  `onSiteDurationFinal + reportWritingFinal` summed per year, so the total
  can't drift out of sync with its components again.
- **Verified**: `15.25 / 12.75 ≈ 1.2` — the exact multiplier a 20%
  report-writing addition should produce on a total that previously excluded
  it. Confirmed via the PHP smoke test, then independently reconfirmed via a
  live HTTP call to `/api/calculate` against a real database.
- **Fixed in**: 3.0.0

### BUG-009 — Report-writing computed once on a multi-year sum, not per visit
- **Detected**: Reported directly — each visit (initial, each surveillance
  year) needs its own report-writing line, not one combined figure covering
  all years. Verified against `GS0106_Audit_Duration_Rules.md` before
  touching any code: line 889 explicitly says "that year" (per year), not
  "across the cycle."
- **Cause**: `standardDuration.php`'s original implementation summed every
  year's on-site duration first, then took 20% of that combined sum once —
  functionally sums to the same total (linear), but doesn't produce the
  per-visit breakdown the spec actually describes or that a real audit
  program needs.
- **Fix**: each `years[]` entry now computes its own
  `reportWritingCalculated`/`reportWritingFinal` from that year's own on-site
  duration. `prepReportCalculated`/`prepReportFinal` kept at the top level
  as a derived sum (for anything still reading the old combined field), but
  no longer used to derive totals — see BUG-008.
- **Fixed in**: 3.0.0

### BUG-010 — Stale-closure state updates in the calculation wizard
- **Detected**: Reported as two separate symptoms — "clicking a step tab
  loses what I typed" and "a factor entered on one site doesn't seem to
  apply to that site." Not independently reproduced (no headless browser
  available in this sandbox — see note below), but both are textbook
  symptoms of one well-understood React bug class, and a direct engine-level
  test conclusively ruled out the engine itself as the cause for the second
  symptom (see CHANGELOG 3.0.0), which redirected the investigation to the
  frontend's state management.
- **Cause**: `CalculationWizardScreen`'s site/rounding mutator functions
  (`updateSite`, `toggleStandard`, `addSite`, `removeSite`, the rounding
  setter) all read the current array from closure (`sites`,
  `roundingOverrides`) at call time rather than from React's own "previous
  state" callback argument. If two state updates land in the same render
  tick — plausible for a field's `onChange` firing right as a tab-press
  handler also fires — the second update's copy would be taken *before* the
  first update had committed, silently overwriting it.
- **Fix**: rewrote every mutator to use React's functional `setState` form
  (`setSites(prev => ...)`), so each one always operates on the latest
  committed state regardless of timing. This class of bug becomes
  structurally impossible after this change, not just less likely.
- **Not directly verified**: no headless browser (Puppeteer's Chromium
  download is blocked by this sandbox's network allowlist; no system
  Chromium binary available) — verification stopped at "the architectural
  cause is real and the fix eliminates that class of bug," not "reproduced
  the exact failure, applied the fix, reproduced success." Flagged in
  `ROADMAP.md` as needing a real confirm-pass.
- **Fixed in**: 3.0.0 (architectural fix; empirical confirmation pending)

### BUG-011 — Breadcrumb navigation left stale wizard screens in the stack
- **Detected**: Reported — the back button shown while viewing the client
  list returned to the last wizard screen instead of Home.
- **Cause**: Breadcrumb `onPress` handlers called `navigation.navigate(...)`,
  which in a native-stack navigator doesn't pop existing screens — jumping
  from deep inside the wizard back to "Clients" via a breadcrumb left the
  wizard screen(s) still sitting in the stack's history, so the native back
  button (which pops one level of *actual* history, not breadcrumb-visual
  history) went somewhere the user hadn't visually been.
- **Fix**: breadcrumb handlers now dispatch `CommonActions.reset(...)` with
  an explicit, correct route stack instead of `navigate()`, so the stack
  always matches what's visually true. Added a persistent "🏠 Accueil" link
  inside the wizard itself (which has no native header) as an unambiguous
  way out, separate from the wizard's own step-local "Retour" buttons.
- **Fixed in**: 3.0.0

### BUG-012 — Blank white page reopening a calculation saved before 3.0.0
- **Detected**: Reported — opening an old saved calculation showed a
  completely blank white page. Initially suspected (by Mahdi) to be a
  database schema mismatch; re-running `schema.sql` did not help, which
  correctly pointed away from the schema as the cause.
- **Cause**: the 3.0.0 engine change added `reportWritingFinal`/
  `reportWritingCalculated` fields to each year's result (see BUG-009).
  Any calculation saved before that change has `result_json` in the
  database without those fields. `RoundingStepper` called `.toFixed(2)`
  directly on `calculatedValue`/`value` props sourced from those fields —
  reading `.toFixed()` on `undefined` throws, and with no error boundary
  anywhere in the app at the time, an uncaught render exception produces a
  totally blank page with no indication anything went wrong.
- **Why the schema re-run didn't help, and shouldn't have been expected
  to**: this was never a table-structure problem. The `calculation_cases`
  table's columns were unaffected by the 3.0.0 change — what changed was
  the *shape of the JSON stored inside* `result_json`, which no schema
  migration touches or could touch (it's opaque `LONGTEXT` to MySQL).
- **Fix, three layers, not just a one-line patch**: (1) `RoundingStepper`
  now treats its numeric props as possibly `undefined`/`NaN` and falls back
  to `0`; (2) both screens' `getRounded()` helpers carry the identical
  guard, so nothing reads an unguarded value even indirectly; (3) added a
  new global `ErrorBoundary` component wrapping the entire app — the real
  fix for the *class* of problem, not just this instance of it: any future
  render crash now shows an actual error message and a way back to Home,
  never a silent blank screen again.
- **Verified**: manually inserted a row into a real MariaDB database with
  the exact pre-3.0.0 JSON shape (`years[]` entries with no
  `reportWritingFinal` field at all, replicating real old data), then
  confirmed `GET /api/cases/:id` serves it correctly over real HTTP (200,
  full JSON returned as-is) — proving the API layer was never the problem,
  only frontend rendering, which is what got fixed.
- **Fixed in**: 4.0.0

### BUG-013 — `calculation_cases.client_id` foreign key had no `ON DELETE` rule
- **Detected**: Found while implementing client delete (requested this
  round) — the FK from `calculation_cases.client_id` to `clients.id`,
  added in 2.0.0, was created without an `ON DELETE` clause, meaning
  MariaDB's default (`RESTRICT`) applied: deleting a client with any
  calculations would have failed outright with a foreign-key-constraint
  error. Never surfaced before now because client delete didn't exist
  until this round.
- **Cause**: oversight when the FK was first written in 2.0.0 — deletion
  wasn't part of that round's scope, so the `ON DELETE` behavior wasn't
  considered at the time.
- **Fix**: changed to `ON DELETE SET NULL` — deleting a client orphans its
  calculations (their `client_id` becomes `NULL`) rather than either
  failing or destroying them. Calculations are the real data; clients are
  just a label (see `ORIENTATIONS.md`) — the data should outlive the label.
  `schema.sql` includes a migration that re-points the FK even on a
  database that already has the old, un-set version.
- **Fixed in**: 4.0.0

### BUG-014 — Accidentally overwrote `audit-app`'s router with the wrong topology
- **Detected**: Self-caught, immediately — while syncing shared backend
  files (`db/clientRepo.php`, `db/calculationCaseRepo.php`, etc.) from
  `duration_calculator/` (the deployment target) to `audit-app/backend/`
  (kept for reference), a blanket copy included `api/index.php`, which the
  two projects deliberately have in *different* shapes — `duration_calculator`
  strips its physical `api/` folder from the URL and uses bare route
  segments (`['clients']`), while `audit-app/backend/public/index.php` is
  itself the doc root and uses `api`-prefixed route segments
  (`['api', 'clients']`) as a URL-namespace convention, not a folder. The
  overwrite replaced the working file with one using the wrong route
  convention for that project's topology, breaking it.
- **Cause**: treating "sync shared backend files" as safe to do with a
  blanket file copy, without checking whether each specific file was
  actually shared logic (engine, repos — genuinely identical either way)
  versus topology-specific glue code (the router, which is deliberately
  different between the two projects and documented as such in
  `ORIENTATIONS.md`).
- **Fix**: rebuilt `audit-app/backend/public/index.php` from scratch with
  that project's own correct convention, including the new delete
  endpoints this round added. Re-ran that project's own smoke test
  (24/24) to confirm the fix, not just that it looked right.
- **Process note**: sync engine/repo files individually and deliberately;
  never blanket-copy a whole directory across these two projects given
  their router topologies are intentionally different — this is the
  second time router-topology confusion has caused a mistake in this
  project (see BUG-001 for the first, unrelated one), worth remembering
  as a standing hazard specific to this codebase, not a one-off.
- **Fixed in**: 4.0.0 (caught and corrected before delivery)

### BUG-015 — Misleading test result from a died-and-restarted local server
- **Detected**: Self-caught, immediately — starting a local test server
  *without* the usual router script (by mistake) still returned a correct
  `/api/health` response, which looked like PHP's built-in server was doing
  routing it doesn't actually do. Investigating further (checking for a
  stale process, testing a route that couldn't possibly resolve) showed the
  server had simply died between tool calls — the same sandbox
  process-lifetime pattern logged as BUG-004/BUG-007 — and the "successful"
  response was from a moment the server was still alive within that same
  combined command, not from any real routing behavior.
- **Cause**: not a bug in the shipped app at all — a momentary
  misinterpretation of a test result caused by this sandbox's process
  lifetime constraint, the same one already logged twice before.
- **Fix**: none needed in the app. Re-ran the same test with the verified
  router script and an explicit check against a genuinely nonexistent route
  (correctly 404'd) before trusting any further results this round.
- **Why this is worth logging even though nothing was wrong**: it's a
  concrete example of the exact failure mode `ORIENTATIONS.md`'s testing
  standard exists to prevent — "looks right" isn't the same as "verified
  right," and this could easily have been accepted as a passing result
  without the extra check. Recorded so the next time something "just
  works" unexpectedly in this sandbox, the first instinct is suspicion, not
  relief.
- **Fixed in**: 5.0.0 (process note only — no shipped code was affected)

---

### BUG-016 — audit-mobile initial draft-save failure is not reproduced by the exact minimal POST payload
- **Detected**: 2026-08-31 during investigation of BUG-004 (wizard save broken).
- **Test performed**: fired the exact payload sent by the wizard on mount for a brand-new calculation directly at POST /cases, using an empty site, zero personnel, and default ISO9001 configuration.
- **Observed**: HTTP **201** and a correctly returned calculation object.
- **Conclusion**: the initial payload shape is **not itself a proven cause** of the production first-call failure. Do not repeat payload-schema investigation as if it were established root cause.
- **Still real**: the initial draft-creation path has no retry, and the failure is silently swallowed by its .catch() handling. This robustness defect remains open regardless of the successful minimal test.
- **Not done**: the actual production-triggering condition is unknown; transient/cold-start/network/lifecycle causes remain possible. The PUT /cases/:id path used by Enregistrer has not yet been tested.
- **Evidence level**: VERIFIED for the minimal POST test; OPEN for the production failure cause.

### BUG-018 — Initial wizard draft-save failure was silently swallowed
- **Detected / investigated**: 2026-08-31 as part of BUG-004.
- **Original behavior**: the initial `POST /cases` failure was caught silently and `hydratedRef.current` was set to `true`, even when no case ID had been created. That could leave the wizard believing autosave was active while there was no persistent case to PUT.
- **Important evidence**: the exact minimal wizard mount payload was independently sent to `POST /cases` and returned HTTP **201** with the expected calculation. Therefore payload shape is not the established production root cause.
- **Fix applied**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` now uses an explicit `createInitialDraft()` operation. Failure remains unsaved, does not mark the wizard hydrated, is shown to the user, and exposes a deterministic retry button. The normal Enregistrer action remains able to create the case when no ID exists.
- **Deliberate non-fix**: no automatic POST retry was added because blindly retrying a POST after a lost response can create duplicate calculation cases. Proper automatic retry requires an idempotency key or equivalent server-side deduplication, which is outside this bug fix.
- **Regression test added**: `audit-app/backend/tests/http_api_test.php` plus GitHub Actions workflow `.github/workflows/backend-integration.yml` for MariaDB + PHP HTTP integration and frontend TypeScript checking.
- **Runtime verification**: **NOT YET VERIFIED** in this session. The available local runtime has PHP but no MariaDB/MySQL and no network access for dependency installation. The CI workflow was pushed but no workflow run is visible through the connected GitHub tool.
- **Remaining BUG-004 work**: empirically test `PUT /cases/:id` and the complete wizard lifecycle. Do not mark BUG-004 fully fixed until those tests pass.
- **Evidence level**: VERIFIED for the original minimal POST success; CODE CHANGED for the silent-failure fix; OPEN for runtime/CI verification and the original production trigger.


### BUG-017 — NACE routes return 404 under PHP built-in dev server; cause unclassified
- **Detected**: 2026-08-31 while testing the NACE API routes.
- **Test performed**: GET /nace/search?q=... and GET /nace/:code against PHP's built-in development server.
- **Observed**: both returned **404 Not found**.
- **Current hypothesis**: request-path stripping is dropping the nace segment.
- **Investigation state**: a debug endpoint to expose SCRIPT_NAME and REQUEST_URI was being prepared, but the investigation stopped before it was completed. This is therefore not yet classified as a router regression.
- **Not done**: no root cause confirmed; no code fix confirmed; no production Apache/DirectAdmin behavior tested for this finding.
- **Required next evidence**: capture SCRIPT_NAME and REQUEST_URI, expose the derived path after stripping, compare a failing NACE route with a known-good route, and compare PHP built-in-server behavior with the intended Apache .htaccess topology.
- **Dependency warning**: before changing shared routing, read BUG-003 and ORIENTATIONS.md; the two-folder audit-app/backend/public/index.php topology and the single-folder deployment router intentionally use different path conventions.
- **Evidence level**: VERIFIED for the 404 observations; HYPOTHESIS for the path-stripping cause; OPEN for classification.

## Open / not yet hit
_(first real deploy to the actual DirectAdmin host is still next. Also open:
empirical confirmation of BUG-010's fix, and visual confirmation of the
report screen, the shake animation, the undo toast's progress bar, the new
site/siège labeling, and the synergy matrix UI in an actual browser — all
blocked on tooling availability in this sandbox, not skipped by choice, see
ROADMAP.md)_


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


### BUG-019 — Source CI failed because the test database configuration was not deterministic

- **Detected**: 2026-08-31 while executing the new source-owned `build-test-publish.yml` workflow.
- **Observed failure**: GitHub Actions reached `Configure test database`; the log showed the MariaDB CLI warning about using a password, followed by the application's `Could not connect to the database. Check config.php.` and exit code 1.
- **Important distinction**: the MySQL/MariaDB password warning was not the failure. It is a normal CLI security warning.
- **First attempted fix (insufficient)**: mutate `config.example.php` with CI values. This still left configuration assumptions that were not sufficiently controlled by the workflow.
- **Final CI design**: create a disposable MariaDB 10.11 service inside the GitHub job with CI-only credentials; write a complete temporary `duration-calculator-php/config.php` explicitly for that service; verify the connection with the MariaDB client; then verify the same connection through the application's PHP/PDO layer; only then import schema and seed.
- **Security boundary**: no production DB credentials are required for CI. The CI database is disposable and local to the GitHub job. Production DB credentials remain on the hosting environment.
- **Additional correction**: consolidated CI to one source workflow. Deleted `.github/workflows/backend-integration.yml`; kept `.github/workflows/build-test-publish.yml`. The deployment repo's existing FTP workflow was not modified.
- **Additional warning cleanup**: upgraded `actions/checkout` and `actions/setup-node` from v4 to v5 to avoid the reported Node.js 20 deprecation warning.
- **Current status**: the corrected workflow is committed in `65fae75a2450883152d43e844a1712d7635b3d1a`. Runtime success is still pending; do not mark this bug fixed until a complete green run proves the DB, PHP, API, frontend build, artifact publication, and subsequent FTP deployment chain.
- **Evidence level**: VERIFIED failure mechanism at the CI configuration layer; CODE FIXED; RUNTIME VERIFICATION PENDING.

**Future developer rule for CI failures**
1. Inspect the exact failed step and log first.
2. If database setup fails, establish whether MariaDB client connectivity, PHP/PDO connectivity, or application initialization is failing.
3. Do not request production DB credentials for the GitHub test container.
4. Do not create a second CI workflow.

---

### BUG-020 — CI "Create CI database configuration" step fails with a PHP parse error regardless of database state

- **Detected**: 2026-09-01, independent audit of the `build-test-publish.yml` pipeline after BUG-019's fix still left CI non-functional.
- **Root cause**: the inline `php -r` verification command in that step contains a doubled namespace separator — `AuditEngine\\pingDb()` (two backslashes) — in both the ternary and the `if (!...)` guard. In PHP source, `\` outside a string is the namespace separator token; two in a row with no identifier between them is a syntax error, not a runtime/connectivity issue.
- **Verification method**: reproduced directly, independent of any CI infrastructure. Ran the exact line via local `php -r` with a fully working, correctly configured local MariaDB instance available (real `audit_test` DB, real `audit` user, connection separately confirmed via `mariadb -h127.0.0.1 -uaudit -paudit`). The step still failed with `PHP Parse error: syntax error, unexpected token "\", expecting "," or ";"` and exit code 255 — proving the failure is 100% independent of database/network/secret state and would fail on every run, unconditionally.
- **Fix applied**: changed both occurrences to a single backslash — `AuditEngine\pingDb()`. Re-ran the identical line against the same working MariaDB instance; it printed `PDO MariaDB connection: OK` and exited 0.
- **Evidence level**: VERIFIED root cause; VERIFIED fix, locally reproduced end-to-end (not yet confirmed by an actual GitHub Actions run — see hand-off note below).
- **Fixed in**: source commit applying this BUGLOG update (see DEV_STATUS.md for the commit hash).

### BUG-021 — `audit-mobile` frontend fails `tsc --noEmit` because of a literal `\n` (two characters) left in source instead of a real line break

- **Detected**: 2026-09-01, same audit pass as BUG-020, while checking whether the rest of the pipeline would pass once the CI syntax error was fixed.
- **Root cause**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` line 93, introduced by the BUG-004/BUG-018 fix commit (`e15403d`), contained `useState<Date | null>(null);\n  const [draftSaveError, ...` where `\n` is the literal two-character sequence backslash+n sitting on one physical line, not an actual newline — almost certainly an artifact of an automated edit that inserted an escaped string instead of a real line break.
- **Verification method**: ran `npx tsc --noEmit` locally against the actual committed file; got `TS1127: Invalid character` / `TS1434: Unexpected keyword or identifier` at the exact column. Grepped the rest of `audit-mobile/src/` for the same corruption pattern — this is the only occurrence.
- **Fix applied**: split the single corrupted line into two real lines. Re-ran `npx tsc --noEmit`; exits clean.
- **Important correction to prior BUG-004/BUG-018/BUG-016 entries**: this session also ran the full `duration-calculator-php/tests/http_api_test.php` HTTP regression suite against a real local MariaDB + PHP built-in server (health, NACE search, NACE code lookup, `POST /cases`, `PUT /cases/:id`, `GET /cases/:id`, `DELETE`) — **16/16 passed**. The backend side of BUG-004 (draft creation and update) is therefore VERIFIED working correctly against a real database, not merely "code changed, not empirically verified" as previously logged. The originally reported production first-save failure, if it still occurs, is not a backend persistence defect — see DEV_STATUS.md update.
- **Also re-checked BUG-017 (NACE 404 under PHP built-in server)**: could not reproduce. `GET /nace/search?q=...` and `GET /nace/:code` both returned 200 with correct data against the current router code under `php -S`. Appears already fixed by the existing `SCRIPT_NAME`-stripping logic in `api/index.php`; leaving BUG-017 open in name only pending a second confirmation, but no further action identified.
- **Evidence level**: VERIFIED root cause and fix for BUG-021; VERIFIED (upgraded from OPEN) for BUG-004 backend persistence; VERIFIED not-reproduced for BUG-017.

**Hand-off**: both BUG-020 and BUG-021 fixes are applied in source. Per the mandatory source/deployment separation policy, this alone does not mean the fix is deployed — the `build-test-publish.yml` workflow must actually run green on GitHub Actions and publish to `duration_calculator` before that can be claimed. Next developer: check the Actions run for this commit before assuming CI is solid; do not just trust that the local reproduction generalizes to the hosted runner without seeing one real green run.

### BUG-022 — CI "Verify MariaDB service" step fails with exit code 127 (`mariadb`: command not found) on the actual GitHub-hosted runner

- **Detected**: 2026-09-01, immediately after pushing the BUG-020/BUG-021 fixes and manually dispatching the workflow (`workflow_dispatch`) to confirm them on a real runner — the exact gap the BUG-020/021 hand-off note warned about. This is exactly why: local reproduction with a manually-installed `mariadb-client` package did not catch this, because the real `ubuntu-latest` GitHub runner does not have the `mariadb` CLI binary preinstalled.
- **Observed**: run `33449389647`, job `build-test-publish`, step "Verify MariaDB service" — check-run annotation: `Process completed with exit code 127`. All subsequent steps (CI DB config, schema/seed, smoke tests, HTTP regression, frontend typecheck/build, assembly, publish) were skipped as a consequence — this step is upstream of everything else.
- **Root cause**: the workflow never installs a MariaDB/MySQL client. It assumes `mariadb` is already on PATH on the runner image, which is not the case for the current `ubuntu-latest` image.
- **Fix applied**: added an explicit `Install MariaDB client` step (`sudo apt-get update -qq && sudo apt-get install -y -qq mariadb-client`) immediately before "Verify MariaDB service".
- **Evidence level**: VERIFIED root cause (real GitHub Actions run, not local reproduction); fix applied, re-run pending — see DEV_STATUS.md for the outcome of the next dispatch.
- **Process note**: this bug could not have been found by the local-reproduction method used for BUG-020/021, since that method necessarily runs on a machine where the required tooling was manually installed first. There is no substitute for at least one real hosted-runner execution before calling a CI pipeline solid.

### BUG-023 — Production migration halts with errno 121 on `calculation_cases`, which is also the root cause of "cannot save a calculation" reported the same day

- **Detected**: 2026-09-01, reported directly by the user via a phpMyAdmin error pasted verbatim: `EXECUTE stmt2` fails with `ERROR 1005 (HY000): Can't create table 'macerti_audit_calc'.'calculation_cases' (errno: 121 "Duplicate key on write or update")`, alongside a separate-seeming report that calculations could not be saved from either the first wizard step or the final save button.
- **Root cause (migration)**: `db/schema.sql`'s FK-CASCADE-upgrade block built a single `ALTER TABLE calculation_cases DROP FOREIGN KEY <name>, ADD CONSTRAINT <same name> FOREIGN KEY ...` statement. MariaDB/InnoDB checks the new constraint name against the schema's constraint-name dictionary before the drop in the same statement is considered final, so dropping and re-adding a foreign key **under the identical constraint name in one ALTER TABLE statement** always fails with errno 121 — on every database where the FK already exists, i.e. exactly the "already migrated once" case this guard exists for. Reproduced exactly (same error text, same failing statement) by building a local database in the pre-CASCADE state (FK `fk_calculation_cases_client` present with the default RESTRICT rule) and running the unmodified migration against it.
- **Root cause (save failures) — same incident, not a separate bug**: because `EXECUTE stmt2` is a fatal error, phpMyAdmin/the mysql CLI stop there — the migration's final block (`stmt3`, adding the `wizard_state_json` column) never runs. `db/calculationCaseRepo.php`'s `saveCalculationCase()` unconditionally includes `wizard_state_json` in every `INSERT`, so with that column missing, **every** save attempt — the initial-draft save on entering the wizard *and* the explicit save button — fails with `Unknown column 'wizard_state_json' in 'INSERT INTO'`. Reproduced by building the exact pre-fix production end-state (FK present, non-CASCADE, `wizard_state_json` absent) and running the real `saveCalculationCase()` INSERT against it: same "Unknown column" error. Confirmed the fixed migration resolves both the errno 121 and the missing column in one pass, after which the same INSERT succeeds.
- **Fix applied**: split the FK-CASCADE upgrade into two separate `ALTER TABLE` statements/executions (drop in one, re-check, add in another — never combined), so `stmt3` is reached and `wizard_state_json` gets added. Also added two additional self-healing guards for related partial-migration states that could otherwise get permanently stuck: (a) the `idx_calculation_cases_client_id` index is now checked and (re-)added independently of the column-add step; (b) the FK-add step now re-checks for an FK's existence right before adding one, so a database whose FK was removed entirely (by any means) gets a fresh one instead of silently staying without it.
- **Verification method**: four scenarios run locally against real MariaDB — (1) fresh empty database, (2) the exact reported broken state, (3) re-running the fixed migration twice in a row on an already-fixed database (idempotency), (4) column present but FK entirely absent (self-heal edge case). All four pass; scenario (2) additionally confirmed the previously-failing `INSERT` now succeeds once the migration completes.
- **Delivered to the user**: a standalone, ready-to-paste file beginning with `USE macerti_audit_calc;` containing the complete corrected migration, verified against a simulated fresh mysql session with no database pre-selected (matching how it will be run — pasted directly into phpMyAdmin).
- **Evidence level**: VERIFIED root cause, VERIFIED fix, both reproduced and re-tested end-to-end locally (not yet confirmed against the actual production `macerti_audit_calc` database — that happens when the user runs the delivered file).

### BUG-024 (not a bug — recorded UX decision) — Replaced the end-of-wizard "Enregistrer" button with a persistent small save button in the header, available on every step

- **Requested**: 2026-09-01, by the user directly: the large "Enregistrer" button previously shown only at the bottom of the Synthèse (last) step should be removed, replaced by a small save control available across all wizard phases.
- **Implemented**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` — added a small round icon button (save icon / spinner while saving) in the shared header row next to the "Enregistré HH:MM" indicator, which is rendered above the step content on every step, not just Synthèse. It calls the same `save()` function the old button used, choosing status `"calculated"` if a result has already been computed (i.e. the same condition the old button represented) or `"draft"` otherwise, so the meaning of the action is unchanged — only its availability and placement changed. The old bottom-of-Synthèse button and its now-unused style were removed.
- **Verified**: `npx tsc --noEmit` clean, `npx expo export --platform web --clear` succeeds after the change.


### BUG-025 — 2026-09-01 deploy test: report navigation, breadcrumb home consistency, and multi-standard Synthèse tab switching

- **Detected**: 2026-09-01 during the user's first real deployment/interaction test of the current frontend artifact.
- **Evidence level**: REPORTED / CODE-INSPECTED. These are interaction findings from the deployment test; the exact browser/device reproduction environment and the final runtime fix are not yet independently verified in this source session.

#### 1. Report screen must follow the breadcrumb navigation model
- **Observed / requested behavior**: after reaching the final **Synthèse** step, opening **Rapport de calcul complet** currently enters a separate CalculationReport screen. The user wants the report to remain inside the same navigation/breadcrumb model and **not introduce a separate, differently styled "Retour" button** as the way back.
- **Code evidence**: CalculationWizardScreen.tsx currently opens CalculationReport with navigation.navigate("CalculationReport", ...); the Synthèse view also renders a dedicated bottom Retour button. CalculationReportScreen.tsx currently has no breadcrumb component of its own.
- **Required behavior**: report navigation must be represented by the same breadcrumb/navigation hierarchy used elsewhere. Returning from the report must use that hierarchy rather than introducing a second back-navigation convention.
- **Scope warning**: this is primarily a navigation/UX consistency requirement. Do not change calculation/report data logic while implementing it.

#### 2. "Accueil" must remain an icon in the breadcrumb/navigation treatment
- **Observed / requested behavior**: the home destination should remain represented by a **real home icon**, not an emoji, and the same visual convention must be used consistently wherever the breadcrumb/navigation pattern appears.
- **Code evidence**: CalculationWizardScreen.tsx already uses Ionicons with home-outline for its home control, while Breadcrumbs.tsx currently renders every breadcrumb item as text only. The implementation therefore has two partially different home-navigation treatments.
- **Required behavior**: normalize the breadcrumb/home treatment so "Accueil" is represented by the existing icon system (Ionicons or the project's equivalent icon component), with no emoji substitute. Preserve the same visual/interaction convention across screens.
- **Do not** reintroduce emoji-based home labels while addressing BUG-025.

#### 3. Multi-standard Synthèse: selecting the second standard does not change the displayed audit programme
- **Observed**: when a site has multiple active standards, the **Synthèse** section displays standard tabs. Clicking/tapping the second-standard tab is reported to do nothing: the displayed audit programme remains on the first standard instead of switching to the selected standard for that site.
- **Code evidence**: CalculationWizardScreen.tsx uses a shared activeStandardTab state and derives stdTab from the currently active site's standards. In Synthèse, each result standard tab calls setActiveStandardTab(st.standard), and stdResult is then selected with siteResult.standards.find((st) => st.standard === siteStdTab). The structure appears intended to support switching, so the exact runtime cause is **not yet established** from source inspection alone.
- **Required behavior**: tapping/clicking a standard tab in a multi-standard site's Synthèse must visibly switch the displayed programme — including the stage/visit durations, report-writing durations, rounding controls, and all standard-specific result details — to that selected standard for that site.
- **Important multi-site constraint**: changing the standard tab for one site must not accidentally change the selected standard/programme shown for another site. The state model should therefore be validated against multiple sites as well as one site with two or more standards.
- **Do not classify this as an engine/calculation error yet**: the reported failure is in the Synthèse UI selection/rendering path; the result data itself has not been shown to be wrong.

#### Incremental implementation / verification order
1. Fix the report screen navigation hierarchy first, keeping the report content unchanged.
2. Normalize the home/Accueil breadcrumb representation to the existing icon system and remove emoji-based home treatment from affected navigation controls.
3. Reproduce the multi-standard Synthèse issue with one site and two standards; log the selected tab, activeStandardTab, siteStdTab, and selected stdResult during the interaction if needed.
4. Repeat with two sites where each site has multiple standards to ensure the selection is scoped correctly.
5. Run TypeScript/build checks, then perform an actual browser/device interaction test before marking BUG-025 VERIFIED.

- **Deployment status**: source-side UX fixes are **not yet implemented by this log update**. Per repository policy, source changes must be built and published to macerti/duration_calculator before they can be called deployed.


### BUG-026 — 2026-09-01 deploy test: mobile text input validation for Siège name and Siège address

- **Detected**: 2026-09-01 during deployment interaction testing.
- **Area**: **Sites & secteurs** → headquarters (**Siège**) information.
- **Observed behavior**: on mobile, the **Siège name** and **Siège address** fields behave as numeric-only inputs, preventing normal textual entry.
- **Expected behavior**: both fields must accept ordinary text input, including letters, numbers, spaces, punctuation, accents, and mixed alphanumeric content as appropriate for real company names and postal addresses.
- **Important distinction**: these are **textual business-information fields**, not numeric calculation fields. They must not use a numeric keyboard/input type or numeric-only validation.
- **Mobile requirement**: verify the actual deployed mobile keyboard/input behavior, not only desktop browser behavior. A mobile browser should present a normal text-capable input and allow complete headquarters names and addresses.
- **Validation requirement**: do not weaken validation for genuinely numeric fields elsewhere in the form. Scope the correction specifically to the Siège name and Siège address fields.
- **Regression cases**:
  - Siège name containing letters only.
  - Siège name containing letters + numbers (e.g. company/legal entity naming).
  - Siège address containing street name + house/building number.
  - Address containing accents/apostrophes/hyphens and normal punctuation.
  - Empty value handling should remain governed by the existing required/optional business rules.

**Evidence level:** REPORTED / CODE-INSPECTED. Runtime fix not yet implemented or verified.
