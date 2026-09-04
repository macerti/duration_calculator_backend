# Bug Log — Audit Duration Calculator

> ✅ **Numbering collision RESOLVED — 2026-09-02 (eleventh session, technical-debt pass).**
> This file previously warned that `src/frontend/BUGLOG.md` (formerly
> `audit-mobile/BUGLOG.md`) had its own independent `BUG-001`–`BUG-004`
> numbering reusing the same IDs as different bugs here — most importantly,
> its own `BUG-004` ("wizard save is broken") was also the bug
> `docs/DEV_STATUS.md`'s "Current status" section informally tracks as
> *the* BUG-004, unrelated to **this file's** `BUG-004` below
> (`mb_strtolower` undefined). Flagged as needing a dedicated renumbering
> pass since the sixth session (2026-09-01); deferred by four sessions in a
> row as too risky to attempt without full runway. That pass has now been
> done: `src/frontend/BUGLOG.md`'s four entries are folded into this file's
> canonical sequence as **BUG-032 through BUG-035** (full original detail
> preserved, nothing summarized away — see those entries below).
> `src/frontend/BUGLOG.md` itself is now a short pointer to this file. Old
> historical prose elsewhere in this project (this file's own past entries,
> `docs/DEV_STATUS.md`'s dated log, `CHANGELOG.md`, past commit messages)
> still says "BUG-004" when narrating what was true *at the time* — that
> text is deliberately left alone (rewriting history mid-narrative is
> exactly what this project's own hand-off convention warns against; see
> `docs/DEV_STATUS.md`'s "Update rule"). **Going forward, cite `BUG-035`**
> for the wizard-save/autosave bug and `BUG-004` (below) only for the
> unrelated `mb_strtolower` bug — the ambiguity is closed for all new
> references even though old text is unchanged. `BUG-019` remains the one
> case that was always the same bug in both files.

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


### BUG-027 — 2026-09-01 deploy test: multi-site Facteurs flow and Synthèse duration presentation

- **Detected**: 2026-09-01 during deployment interaction testing.
- **Evidence level**: REPORTED / CODE-INSPECTED. Runtime fixes are not yet implemented or verified.

#### 1. Multi-site Facteurs phase starts on the wrong site
- **Observed behavior**: when processing multiple sites, entering the **Facteurs** phase opens directly on the last site instead of starting with the **Siège** and then progressing through the sites in order.
- **Expected flow**:
  1. Start on **Siège**.
  2. Present each site sequentially, one by one.
  3. For each site, allow the user to enter the Facteurs information if applicable, or explicitly skip that site's factors.
  4. After the sites have been processed/skipped, proceed to **Calculer**.
- **Important UX requirement**: the application should guide the user through the sites sequentially. The user should not have to discover/navigate tabs manually to find which site still needs factors.
- **Calculate action**: do not expose the final calculation as the only immediate action while sites still need to be processed. The flow should lead the user through Siège → Site 1 → Site 2 → … and then present/enable **Calculer** after the factors step is complete or skipped as appropriate.
- **Regression case**: test with Siège + 2+ sites and verify the initial active tab is Siège, followed by each site in declared order.

#### 2. Synthèse: replace generic "Total jour à auditer" with useful annual per-site detail
- **Observed / requested change**: the global **Total jour à auditer** value in Synthèse is not useful enough as currently presented.
- **Required presentation**: show, **per year and per site**, the **total audit duration**, with a breakdown of the duration **per standard**.
- The presentation should make it possible to understand how the annual total for each site is composed by standard, rather than only exposing one aggregated "Total jour à auditer" number.
- Preserve the underlying calculation results; this is a Synthèse information-architecture/presentation change unless implementation proves the data itself is missing.
- **Multi-site regression case**: verify each site has its own annual total and standard-by-standard duration details, and that values are not mixed between sites.

#### 3. Numeric duration controls: + / − increments and manual typing
- **Observed behavior**: the current **+ / −** controls can produce unexpected/weird values.
- **Expected behavior**:
  - + increases the value by exactly **0.01**.
  - − decreases the value by exactly **0.01**.
  - The user can manually type a value directly into the field.
  - Values must remain numerically valid and should not acquire malformed floating-point artifacts through repeated increments/decrements.
- Apply the correction to the affected numeric duration controls without changing unrelated numeric fields.
- **Regression examples**: 1.00 → + → 1.01; 1.01 → − → 1.00; manually type 2.35; repeated +/- operations must remain at two-decimal precision.

#### 4. Remove bottom "Retour" from Synthèse
- **Observed behavior**: Synthèse currently contains a bottom **Retour** button.
- **Required behavior**: remove this redundant button.
- Navigation is already available through the top **phases progress** navigation and the **breadcrumb**. Do not create a third back-navigation mechanism.
- This aligns with BUG-025, which already requires the report/navigation experience to follow the breadcrumb hierarchy rather than using separate back controls.

#### Implementation / verification order
1. Correct Facteurs multi-site sequencing and initial Siège selection.
2. Correct + / − numeric behavior and preserve manual typing.
3. Redesign Synthèse duration presentation to annual totals per site with per-standard breakdown.
4. Remove the redundant Synthèse bottom Retour button.
5. Test single-site and multi-site flows, including multiple standards per site.
6. Run TypeScript/build checks and verify the actual deployed mobile/browser interaction before marking the findings VERIFIED.

---

### 2026-09-01 (second session) — BUG-025 #1/#2/#3 and BUG-026 fixed; BUG-027 #3 partially fixed; BUG-027 #4 fixed

**Environment available to this session**: no PHP, no MariaDB, no browser/device. `node`/`npm`/`npx` available with network access to the npm registry. Evidence below is therefore capped at STATICALLY VERIFIED / BUILD-VERIFIED, never VERIFIED (no real interaction test was possible). Do not upgrade these to VERIFIED without an actual browser/device pass.

**BUG-025 #3 — root cause found (not merely hypothesis) and fixed.**
The Synthèse per-site standard tab read `stdTab`, a value derived from `activeStandardTab` scoped to `activeSite` (`sites[activeSiteIndex]`) — i.e. whichever site was last active during the **Facteurs** step, not the site being rendered in the Synthèse loop. Two concrete consequences, confirmed by reading the derivation at the old line 345 (`stdTab = activeStandardTab && activeSite.activeStandards.includes(activeStandardTab) ? activeStandardTab : activeSite.activeStandards[0]`) against the Synthèse render loop:
  - Tapping a second-standard tab for a Synthèse site other than the Facteurs-active one had no visible effect whenever the Facteurs-active site's own standards didn't include the tapped standard — `stdTab` fell back to the Facteurs-active site's first standard regardless of the click.
  - Even where a click "worked," the single shared state meant selecting a standard for one site could change the displayed standard for a different site that happened to also offer it — the exact multi-site leak the bug report warned against.
  - **Fix**: added `syntheseStandardTabBySite: Record<string, StandardCode>`, keyed by `siteResult.siteId`, fully independent of the Facteurs-step `activeStandardTab`/`stdTab`. Each Synthèse site row now resolves and sets its own entry.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx`.

**BUG-025 #2 — fixed.**
`Breadcrumbs.tsx` only ever rendered text; the wizard rendered "Accueil" as a separate `Ionicons` "home-outline" button entirely outside the breadcrumb trail, while `ClientsListScreen`/`ClientDetailScreen` rendered "Accueil" as a plain-text breadcrumb item. Extended the `Crumb` type with an optional `icon` field (rendered via the same `Ionicons` glyph used elsewhere) and switched all three screens to the same icon-crumb for "Accueil." No emoji was ever present in source for this control — the divergence was icon-button-outside-breadcrumb vs. text-inside-breadcrumb, both now unified into one icon-crumb.
  - **Files**: `audit-mobile/src/components/Breadcrumbs.tsx`, `CalculationWizardScreen.tsx`, `ClientsListScreen.tsx`, `ClientDetailScreen.tsx`.

**BUG-025 #1 — fixed.**
`CalculationReportScreen` had no breadcrumb and relied on the native stack header's default back arrow (`headerShown` was not set to `false` for that route, unlike every other in-app screen). Added a `Breadcrumbs` row identical in structure to the wizard's (home icon → Clients → client name → dossier ref → "Rapport" as the current/non-pressable crumb), set `headerShown: false` for the `CalculationReport` route in `App.tsx`, and used `navigation.goBack()` for the "return to calculation" crumb (correct here because the report is reached by a stack **push** from the wizard, so `goBack()` restores the exact in-progress wizard state rather than resetting it). Added `clientId` to the `CalculationReport` route params (needed to reconstruct the "Clients"/client-name crumb targets) and threaded it through the `navigation.navigate("CalculationReport", ...)` call site.
  - **Files**: `App.tsx`, `CalculationReportScreen.tsx`, `CalculationWizardScreen.tsx`.
  - **Scope discipline**: report content/calculation logic in `CalculationReportScreen.tsx` was not touched, per the bug's scope warning.

**BUG-027 #4 — fixed.**
Removed the Synthèse step's own bottom "Retour" button (`CalculationWizardScreen.tsx`, previously just before the closing of the `synthese` step block). `StepTabs` (rendered above the step content on desktop, and as a fixed bottom bar on mobile, independent of `currentStep`) already provides navigation back to "Facteurs" on every platform, confirmed by reading its render conditions (`{!isMobile && <StepTabs .../>}` near the top of the step content, `{isMobile && <StepTabs .../>}` after the `ScrollView`) — the removal does not remove the only path back.

**BUG-027 #3 — PARTIALLY fixed. The increment-precision half is done; manual typing is still missing.**
`RoundingStepper`'s `nudge()` already rounded via `Math.round((value + delta) * 100) / 100`, which is float-drift-safe for two-decimal precision — the actual defect in the +/- behavior was simply that every Synthèse call site relied on the component's default `step` of `0.25` (a quarter-day) instead of the requested `0.01`. Added `step={0.01}` to all 5 `RoundingStepper` invocations in the Synthèse step (Étape 1, Étape 2, Rédaction du rapport ×2 including the per-year loop, Visite sur site).
  - **Still open, do not mark this sub-bug closed**: re-reading `RoundingStepper.tsx` while writing this entry shows the value is rendered as a plain non-editable `<Text>{safeValue.toFixed(2)}</Text>`, not a `TextInput`. The bug's second requirement — "the user can manually type a value directly into the field" — is **not implemented at all**, in this session or any prior one found in this log. Next developer: convert that `Text` to an editable numeric `TextInput` (handle comma-vs-period decimal input, reject non-numeric characters, commit on blur/submit, and keep the existing +/- buttons and the 0.001-tolerance "adjusted" comparison working against whatever the field currently holds while being typed into).
  - **File**: `CalculationWizardScreen.tsx` (call sites); `RoundingStepper.tsx` itself still needs the typing capability added.

**BUG-026 — root cause found and fixed.**
Siège/site "Nom" and "Adresse" fields were built with the shared `NumberField` component, which hardcodes `keyboardType="numeric"` — correct for calculation inputs, wrong for free-text business fields. Added a new `TextField` component (`keyboardType="default"`, `autoCapitalize="sentences"`, no numeric suffix support since none is needed) and swapped it in for exactly those two fields. No other `NumberField` usage was changed, so genuinely numeric fields elsewhere keep numeric-only validation as required.
  - **Files**: new `audit-mobile/src/components/TextField.tsx`; `CalculationWizardScreen.tsx` (site name/address fields only).

**VERIFICATION PERFORMED THIS SESSION (real, not assumed)**
- `npm ci` in `audit-mobile/`: clean install, 515 packages, no errors.
- `npx tsc --noEmit`: **zero errors** against the full changed tree (Breadcrumbs, both client screens, the wizard, the report screen, App.tsx, the new TextField component).
- `npx expo export --platform web --clear` with a placeholder `EXPO_PUBLIC_API_URL`: **succeeded**, produced `dist/index.html`, a single web JS bundle, and all expected assets — this is the same build step CI runs before publishing, so the change is known to actually bundle for production, not just typecheck.

**NOT DONE / explicitly still open**
- No real browser/device interaction test was performed (no such environment was available here). In particular:
  - BUG-025 #3's fix is a source-level correction of a confirmed logic error, but the actual tap-to-switch interaction on a real Synthèse screen with 2+ sites × 2+ standards has not been clicked through.
  - BUG-027 #3: manual typing into the stepper value is **not implemented** (see the BUG-027 #3 entry above) — this sub-bug must stay open, not just unverified.
- BUG-025's own step-navigation "Retour" (Facteurs step, not Synthèse) was intentionally left alone — out of scope for BUG-027 #4's specific wording.
- BUG-027 #1 (Facteurs multi-site sequencing/initial-Siège-selection) and BUG-027 #2 (Synthèse annual/per-standard total presentation) are **untouched** — not started, do not assume any part of them is addressed by this session's commit.
- Backend (`duration-calculator-php/`) was not touched or tested this session — no PHP/MariaDB was available in this sandbox. BUG-004's backend persistence status from the prior session (16/16 HTTP suite pass) is unaffected and unchanged.
- Per the mandatory source/deployment separation rule: none of this is deployed. The change exists only in the source repository until `build-test-publish.yml` runs and publishes to `macerti/duration_calculator`.

**Dependency / hand-off**: next developer with real device/browser access should run through BUG-025's "Incremental implementation / verification order" step 3-6 checklist to upgrade these from STATICALLY/BUILD-VERIFIED to VERIFIED, then tackle BUG-027 #1/#2 (fully open) and the still-missing manual-typing capability for BUG-027 #3.

---

### 2026-09-01 (third session) — BUG-027 #1, #2, #3 all addressed (source only); BUG-027 now fully source-complete pending device verification

**Environment available to this session**: no PHP, no MariaDB, no browser/device — identical constraint to the second session. `node`/`npm`/`npx` available with npm-registry network access. Evidence below is capped at STATICALLY VERIFIED / BUILD-VERIFIED for the same reason.

**BUG-027 #3 — now FULLY fixed (increment precision was already done; manual typing added this session).**
`RoundingStepper.tsx`'s value display was a non-editable `<Text>`. Replaced it with a controlled `TextInput`:
  - Local `text` state mirrors the committed value except while the field is focused, so external updates (+/-, reset, guide-apply) don't clobber an in-progress edit, and an in-progress edit isn't lost on every parent re-render.
  - Accepts comma or period as the decimal separator (normalizes `,`→`.` on commit); strips non-numeric characters as typed.
  - Commits on blur or submit via the same `Math.max(0, Math.round(parsed*100)/100)` used by `nudge()`, so typed and stepped values can never diverge in rounding precision.
  - Invalid/empty input reverts to the last valid value instead of propagating `NaN` or leaving the field blank.
  - **File**: `audit-mobile/src/components/RoundingStepper.tsx`.

**BUG-027 #1 — fixed: Facteurs multi-site sequencing and initial Siège selection.**
Root cause: `activeSiteIndex` is shared state across the Effectif and Facteurs steps. Effectif lets the user freely switch site tabs (including via the "Aller à l'effectif de …" jump button), and whichever site was last active there stayed active when Facteurs opened — this is exactly the reported "opens on the last site instead of Siège."
  - Added a `prevStepRef`-guarded `useEffect` that resets `activeSiteIndex` to `0` only on the transition **into** `"factors"` (from any other step, whether via the "Continuer" button or a direct step-tab click) — it does not fire on renders while already in the step, so it can't fight the new in-step navigation below.
  - Replaced the Facteurs step's fixed "Retour / Calculer" footer with sequential navigation when `sites.length > 1`: "Retour" becomes "Précédent (‹site name›)" and steps backward through sites before finally returning to Effectif at index 0; the forward button reads "Site suivant — ‹next site name›" until the last site, where it becomes "Calculer" — so Calculer is only ever the immediate action once every site has been reached.
  - Clicking "Site suivant" without entering any factors is the "explicit skip" the bug asked for — Facteurs entry has no validation gate, so there was nothing else to build for that requirement. The existing site-tab row is left in place for direct jumps; sequential buttons are the new *guided default*, not the only path.
  - Single-site cases (Siège only) are unaffected: `activeSiteIndex < sites.length - 1` is `0 < 0` → false, so "Calculer" still shows immediately, same as before.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx`.

**BUG-027 #2 — fixed: Synthèse annual/per-standard breakdown, added per site.**
Added a "Récapitulatif annuel" block to each site's Synthèse card, below the existing per-standard detail. For every year found across that site's standards, it shows the year's **total** (summed across all active standards) and, when more than one standard is active, a per-standard breakdown line.
  - Derived entirely from the same `getRounded(roundKey(...))` values already driving the `RoundingStepper`s and the pre-existing grand `finalTotal` — it cannot disagree with either, since it performs no new calculation, only re-aggregates by year instead of only by the single global sum.
  - Keyed by year number (via a `Map`) rather than assuming every standard's `.years` array has the same length, in case cycle length ever legitimately differs per standard.
  - The pre-existing single "Durée totale à auditer" grand total at the bottom of Synthèse was **left in place** — it's still a legitimate all-sites-all-years figure (e.g. for overall quoting) and the bug's own wording only asked to add the missing per-site/per-year/per-standard detail, not remove the aggregate.
  - **File**: `audit-mobile/src/screens/CalculationWizardScreen.tsx` (new derived block + 7 new style entries).

**VERIFICATION PERFORMED THIS SESSION (real, not assumed)**
- `npm ci` in `audit-mobile/`: clean install, 515 packages, no errors.
- `npx tsc --noEmit`: zero errors against the full changed tree (`RoundingStepper.tsx`, `CalculationWizardScreen.tsx`).
- `npx expo export --platform web --clear` with a placeholder `EXPO_PUBLIC_API_URL`: succeeded twice (once per round of changes), producing `dist/index.html` and a single web JS bundle each time.
- Spot-checked the built bundle for the new UI strings ("Site suivant", "Précédent (", "Récapitulatif annuel") to confirm the changes are actually on the shipped code path, not just typechecking in isolation.

**NOT DONE / explicitly still open**
- No real browser/device interaction test was performed (same environment gap as every prior session). In particular:
  - BUG-027 #1's sequential flow and Siège-first entry have not been clicked through on a real multi-site case.
  - BUG-027 #2's annual breakdown has not been visually checked for a site with 2+ standards and a multi-year cycle (e.g. `cycleYears=3`) to confirm the layout reads well, only that it renders without error and the numbers are correctly derived from source.
  - BUG-027 #3's typed-input UX (decimal keyboard behavior, comma/period handling in a real browser vs. native app) is untested interactively.
- Backend (`duration-calculator-php/`) was not touched or tested this session — still no PHP/MariaDB available in this sandbox.
- Per the mandatory source/deployment separation rule: none of this is deployed. The change exists only in the source repository until `build-test-publish.yml` runs and publishes to `macerti/duration_calculator`.

**Dependency / hand-off**: BUG-027 is now source-complete (#1/#2/#3/#4 all addressed) but entirely at STATICALLY/BUILD-VERIFIED evidence level. The next developer with real device/browser access should click through all four sub-bugs with a case containing Siège + 2 sites × 2+ standards each, paying particular attention to: (a) whether "Site suivant" reads naturally as a skip action or whether product wants an explicitly labeled "Passer" button instead; (b) whether the annual breakdown's placement (per-site, below the standard-tab detail) is the right information architecture, or whether product wants it surfaced more prominently (e.g. always-visible instead of requiring standard-tab context); (c) BUG-025's own outstanding device-verification checklist, which this session did not re-touch.



## 2026-09-01 — Delivery priority / acceptance gate

The active sequence is: FEAT-003 versioning → repository architecture consolidation → real user/browser/mobile feedback gate → remaining bugs → remaining requested features. BUG-025/026/027 source fixes require real user acceptance before definitive closure. Record user feedback as USER-ACCEPTED, REOPENED, NEW BUG, or CHANGE REQUEST.

### BUG-028 — FEAT-003 footer showed the committer's own local timezone instead of a fixed UTC+1

- **Reported**: 2026-09-01, by the product owner directly ("The time should be UTC+1 always").
- **Root cause**: `VersionFooter.tsx`'s `formatUpdatedAt()` parsed the ISO timestamp's own embedded UTC offset (git preserves whichever local timezone the committing machine was set to) and displayed those hour/minute components as-is. Nothing on screen indicated which zone that was, and it would silently vary commit-to-commit depending on the committer's machine — not the "one consistent app timezone" FEAT-003's own spec required.
- **Fix**: `formatUpdatedAt()` now always converts to a fixed UTC+1 offset (adds 60 minutes to the UTC instant, then reads UTC date/time components) regardless of the source ISO string's own offset. Deliberately a *fixed* offset, not a DST-aware zone like `Europe/Paris`, since the requirement is "UTC+1 always."
- **Verification**: logic checked against three cases — a UTC (`+00:00`) source, an already-`+01:00` source, and a US-Eastern (`-05:00`) source that crosses a date boundary when converted — all three converted correctly. `npx tsc --noEmit` clean.
- **Not yet done**: not re-run through CI/redeployed as of this entry (see commit for source-only status); not interaction-verified in a browser (no such tooling in this sandbox, same caveat as all frontend work this project).


### BUG-029 — Production-quality audit: framework/dev residue, runtime console errors and deployment hygiene

**Status: OPEN — DISCOVERY REQUIRED**
**Priority:** After versioning → repository architecture → user acceptance gate.

This is an audit/investigation item, not an assumption that every listed symptom currently exists.

Check the production application for actual browser console errors/warnings, Vite/React/development branding, placeholder/demo content, publicly exposed source maps, unnecessarily large JavaScript bundles, incorrect SPA fallback behavior, missing/branded 404 behavior, and metadata/routing inconsistencies discovered during FEAT-004.

Do not close this by suppressing console output or hiding framework strings. Reproduce the issue, identify the root cause, fix it, then verify the production build in a real browser. If an observation is actually a new feature/change request rather than a defect, move it to ROADMAP.

### BUG-030 — Router misroutes every multi-segment path under `php -S` (root cause of the "NACE 404" finding; reopens its "NOT REPRODUCED" status)

**Status: FIXED and VERIFIED 2026-09-02 (seventh session). Fixed in 5.1.1. BUG-004's PUT/Enregistrer HTTP evidence and the NACE routes are both re-confirmed working; see full re-run below.**

**Reconciliation of the "open contradiction" (item 1 in the prior NOT DONE list) — root cause of the contradiction itself, not just the routing bug:**

Reproduced the exact 5-passed/11-failed result first, on fresh PHP 8.3.6 + MySQL 8.0.46 (same stand-in as the fourth/sixth sessions), running `php -S 127.0.0.1:8099 api/index.php` from inside `duration-calculator-php/` — confirms the sixth session's finding was not an isolated fluke. Then tested the one variable neither write-up had actually controlled for: **how the router-script path is spelled on the `php -S` command line.**

- `php -S host:port api/index.php` (router path includes a directory component) → `$_SERVER['SCRIPT_NAME']` is set to the *requested path itself* (confirmed via a temporary `_debug.php` dumping `$_SERVER`, written and deleted, same method the sixth session used) — e.g. requesting `/nace/search` yields `SCRIPT_NAME = "/nace/search"`. This is the sixth session's reproduction.
- `php -S host:port index.php`, run from *inside* `api/` (bare filename, no directory component) → `SCRIPT_NAME = "/index.php"`, the router's own name — routing then works by accident.
- `.github/workflows/build-test-publish.yml`'s "Start PHP API" step uses `working-directory: duration-calculator-php/api` + `php -S 127.0.0.1:8080 index.php` — the *second* form. This is almost certainly why CI has been reporting green and why the fourth session's manual run (which likely matched CI's habit rather than the sixth session's) reported 16/16: **both were unknowingly exercising the code path that happens not to trigger the bug**, not a PHP-version or environment difference as originally hypothesized. Neither prior session was "wrong" about their own honestly-reported result — the two commands only *look* identical in prose ("php -S host:port + the router script") while actually differing in exactly the one detail that matters here.

**Fix implemented**: replaced the `dirname($_SERVER['SCRIPT_NAME'])`-based prefix-stripping in `api/index.php` with an explicit `basePath` config value (new key in `config.example.php`/`config.php`, default `''`). Routing no longer inspects `SCRIPT_NAME` at all, so behavior is now identical regardless of how the dev server is invoked, and does not depend on Apache's SCRIPT_NAME behavior under mod_rewrite either (which was never independently verified in any session — see remaining NOT DONE below).

**Verification (this session, fresh PHP 8.3.6 + MySQL 8.0.46 stand-up, same DB/schema/seed steps as prior sessions)**:
- `php tests/smoke_test.php` → 24/24 (engine layer, unaffected by this change as expected).
- `php tests/http_api_test.php` run against **both** previously-divergent invocations — `php -S ... api/index.php` from the parent dir, and `php -S ... index.php` from inside `api/` — now **16/16 in both**, closing the contradiction: it no longer matters which way the server is started.
- Simulated the real production URL shape by setting `basePath = '/duration_calculator/api'` in a scratch config and confirming `GET /duration_calculator/api/health`, `.../nace/search?q=x`, and `.../cases/1` all route correctly (200) — proving the fix strips a real multi-segment deployment prefix, not just the empty-prefix local case.
- Caveat, honestly noted rather than glossed over: with a non-empty `basePath` configured, a request missing that prefix entirely (e.g. bare `/health`) still incidentally matched the `['health']` route locally, because PHP's built-in server serves everything at one origin regardless of `basePath`. In real production this isn't reachable the same way — Apache only ever invokes this script for requests already inside `/duration_calculator/api/`, so a same-domain request to `/health` never reaches this router at all — but this local test setup can't fully emulate that webserver-level gate. Not a regression from the old code (which had the equivalent property whenever its own prefix-stripping happened not to fire) and out of scope for BUG-030 specifically; noting it so a future session doesn't assume this was exhaustively proven end-to-end.

**NOT DONE (carried forward, not closed by this fix)**:
- ~~Real Apache + `.htaccess` topology test~~ — **DONE 2026-09-02 (eighth session), see update immediately below. This closes the item.**
- `audit-mobile/` → `src/frontend/` and `duration-calculator-php/` → `src/backend/` restructure (remainder of repository architecture consolidation) — untouched this session; still the next item after this per the priority order once BUG-030 stopped being the higher-urgency item.

**UPDATE 2026-09-02 (eighth session) — Real Apache + `.htaccess` + `mod_rewrite` topology test performed for the first time in this project's history. Closes the last open item above.**

Every prior session tested only against PHP's built-in dev server (`php -S`). This session stood up an actual Apache instance and reproduced the real deployment shape as closely as this sandbox allows.

**Environment**: `apt-get install apache2 libapache2-mod-php php-cli php-mysql php-mbstring php-curl mariadb-server` on the same Ubuntu 24.04 sandbox prior sessions used. PHP 8.3.6, Apache 2.4.58 (`mpm_prefork`, since `libapache2-mod-php` requires it — production DirectAdmin hosts typically also run `mod_php`/prefork for the same reason, so this is a representative match, not just a workaround), MariaDB 10.11.14 (real MariaDB this time, not the MySQL 8.0 stand-in prior sessions used/flagged as a caveat).

**Sandbox tooling limitation discovered and worked around (recording so the next session doesn't waste time rediscovering it)**: in this container, a backgrounded `mariadbd` process (however started — `service mariadb start`, `mysqld_safe` with `nohup`+backgrounding, or `start-stop-daemon --background`) does not survive past the end of the current tool-call/command invocation; it is gone by the start of the next one, with no crash logged. `apache2` does **not** have this problem — its master process survives across separate invocations normally. Root cause not fully diagnosed (plausibly: `apache2`'s startup does a full daemonizing double-fork/`setsid` that fully detaches it from the invoking shell's process group, while `mariadbd`/`mysqld_safe` does not, and this sandbox appears to reap anything still attached to that process group when a command invocation ends). Workaround: run MariaDB startup, schema/seed, Apache (re)configuration, and every curl-based test **in one single script/invocation**, since everything stays alive for the duration of one running process tree. This is a sandbox/tooling constraint, not an application bug — flagging it explicitly per this project's own convention of recording environment limitations (same spirit as "no browser/device tooling available").

**Setup, replicating the real deployment shape**: deployed `duration-calculator-php/` unmodified into `/var/www/html/duration_calculator/` (the same subdirectory depth as the real `https://tools.macerti.com/duration_calculator/` deployment implied by `PRODUCTION_API_URL` in `build-test-publish.yml`), with a `config.php` setting `basePath` explicitly to `/duration_calculator/api` (the real production value per `config.example.php`'s own documented example) — not the empty local-dev value used by every previous session's `php -S` testing. Enabled `mod_rewrite` and `mod_headers`, and added an Apache `<Directory>` block granting `AllowOverride All` for that path (Apache's own shipped default for `/var/www/` is `AllowOverride None`, which would silently disable every `.htaccess` rule this app relies on — see the critical finding below).

**DONE / VERIFIED — 13/13 checks passed against real Apache, not the dev server**:
- Routing (6/6): `GET /api/health` (200, `dbConnected:true`), `GET /api/nace/search?q=...`, `GET /api/nace/01`, `POST /api/cases` (201), `GET /api/cases/:id`, `PUT /api/cases/:id`, `DELETE /api/cases/:id` — all multi-segment paths that BUG-030 previously broke under some `php -S` invocations now route correctly under real `mod_rewrite`, with the production `basePath` prefix actually present in the URL (not simulated with an empty prefix, unlike the fourth/sixth/seventh sessions' local-only testing).
- `OPTIONS` CORS preflight: 204, as expected.
- `.htaccess` deny rules (5/5), tested as real HTTP requests against the live server, not reasoned about: `db/schema.sql` → 403, `db/pdo.php` → 403 (confirms the `RewriteRule ^db/ - [F,L]` blocks the request before PHP ever executes it — i.e. this isn't just "PHP source isn't returned as text", the whole path is refused), `data/raw/nace_risque_table.csv` → 403, and two simulated accidental-leftover files (`config.php.bak`, `config.php.swp`, created only for this test and deleted immediately after) → 403 each, confirming the extension-based `FilesMatch` deny rule works for exactly the accidental-editor-backup scenario its own comment describes.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) confirmed present on a real Apache response.

**CRITICAL FINDING — this app's entire security model and routing depend on the host's `AllowOverride` setting, and this has never been confirmed against the real DirectAdmin host**: to make sure the passing result above wasn't vacuous, re-ran the same two checks with `AllowOverride All` removed (i.e. Apache's own out-of-the-box default for `/var/www/`, `AllowOverride None`) and nothing else changed:
  - `GET /api/health` → **404** (the `RewriteRule ^ index.php` in `api/.htaccess` is silently ignored, so nothing ever reaches the router — the API would appear completely dead, not just insecure).
  - `GET /db/schema.sql` → **200, i.e. the raw schema file downloads successfully** — the deny rule is silently ignored too.
  Restoring `AllowOverride All` immediately restored both (200 and 403 respectively) with no other change. **This means: if the real DirectAdmin/cPanel vhost for `tools.macerti.com` does not already grant `AllowOverride All` (or an equivalent explicit `RewriteEngine`/`FilesMatch` config) for the `duration_calculator/` deployment path, the app is either completely unreachable in production or is leaking `db/schema.sql`, the NACE/parameter CSVs, and any accidental `.bak`/`.swp` files — with no error or warning, just silent 404s or silent 200s depending on which half is missing.** Shared hosting control panels usually do default to `AllowOverride All` for the account's web root specifically because `.htaccess`-based apps like this one are the norm, but "usually" is not the same as confirmed for this specific host. **Action item for the next developer / for Mahdi directly: confirm with the actual hosting control panel (or by testing production directly) that `.htaccess` overrides are honored for the deployed path.** This cannot be verified from this sandbox — it requires either DirectAdmin panel access or a live test against the real production URL.

**NOT DONE / still open**:
- The above used Apache's `mod_php` (prefork), which is a very common but not universal DirectAdmin/cPanel PHP-handler choice — some hosts use PHP-FPM via `mod_proxy_fcgi` instead. Rewrite/`.htaccess` behavior is handler-independent (it happens at the Apache/mod_rewrite layer before PHP is invoked either way), so this is not expected to matter for the specific findings above, but it is not literally the same handler as whatever the real host uses; noting it rather than asserting full production-identical coverage.
- Did not test the actual live `tools.macerti.com` host directly (no credentials/access from this sandbox) — everything above is a faithful local reconstruction of the topology, not a test of the literal production server. The `AllowOverride` question above specifically still needs a real production check.
- No frontend/browser/device testing this session (unchanged, long-standing gap across every session).

**Old status text, superseded, kept for history: ROOT-CAUSED, REPRODUCED — fix NOT yet written. Contradicts a prior session's conclusion; see "Open contradiction" below before doing anything else with BUG-004/NACE evidence.**

- **Detected**: 2026-09-01 (repository architecture consolidation, step 2 session), while re-running the standard HTTP regression setup as a routine post-reorg sanity check (fresh PHP 8.3.6 + MariaDB via `default-mysql-server`, both installed via `apt-get`; `duration-calculator-php/config.php` pointed at a local `audit_test` DB; schema imported; `seed.php` run).
- **Command used** (identical to every prior session's stated command): `php -S 127.0.0.1:8099 api/index.php`, run from inside `duration-calculator-php/`.
- **Result**: `php tests/http_api_test.php http://127.0.0.1:8099` → **5 passed, 11 failed** (not 16/16). `smoke_test.php` (no HTTP involved) still passed 24/24 — the calculation engine itself is fine, this is purely a routing-layer bug.
  - PASS: `GET /health`, `POST /cases` (bare, no id).
  - FAIL (404): `GET /nace/search?q=...`, `GET /nace/01`, `PUT /cases/:id`, `GET /cases/:id`, `DELETE /cases/:id` — every route with more than one path segment after the host.
- **Root cause, empirically confirmed** (not a hypothesis — verified by adding a temporary debug script that dumps `$_SERVER`, then deleted): under `php -S host:port api/index.php`, when the requested path doesn't correspond to a real file, PHP's built-in server sets `$_SERVER['SCRIPT_NAME']` to **the requested path itself**, not to `api/index.php`'s own path. Confirmed directly: `GET /nace/search?q=test` → `SCRIPT_NAME = "/nace/search"`; `GET /health` → `SCRIPT_NAME = "/health"`.
  - `api/index.php` (line 107) computes `$scriptDir = dirname($_SERVER['SCRIPT_NAME'])` to strip a "deployment subdirectory" prefix off the request path.
  - For a **single-segment** path like `/health`, `dirname()` returns `/`, `$scriptDir` ends up `''` after `rtrim(..., '/')`, the strip is skipped, and routing works — this is why `/health` and bare `/cases` (POST) passed.
  - For **any multi-segment** path, e.g. `/nace/search`, `dirname('/nace/search')` returns `/nace`. The code then finds the request path `/nace/search` starts with `/nace` and strips it, leaving just `/search` → routed as segment `["search"]` instead of `["nace","search"]` → falls through to the 404 handler. Same mechanism explains `/cases/:id` losing its `cases` segment.
- **Open contradiction — do not resolve by assuming either side is wrong without re-testing**: `docs/DEV_STATUS.md`'s fourth session reported this exact command giving `GET /nace/search` → 200, `GET /nace/01` → 200, and the full PUT/GET/DELETE lifecycle 16/16, and marked the original NACE-404 finding "NOT REPRODUCED." This session reproduces the 404s reliably and has an empirical (not inferred) root cause for *why* they'd occur under this exact command. Possible explanations, none confirmed: a PHP point-version behavior difference in built-in-server `SCRIPT_NAME` handling; an environment/invocation detail not fully captured in either session's write-up (e.g. an explicit `-t` docroot flag, a different working directory, or a `.user.ini`/`php.ini` setting); or the fourth session's result being incorrect despite its own good-faith reporting. **This needs a fresh, careful re-run with the exact PHP version and command double-checked line-by-line before trusting either result over the other.**
- **Why this matters beyond NACE**: the exact same mechanism breaks `PUT/GET/DELETE /cases/:id`, which is the HTTP-contract evidence `docs/DEV_STATUS.md`'s "Current status" section currently cites as the reason BUG-004's PUT/Enregistrer path is "VERIFIED." That VERIFIED status was based on real DB testing and is likely still correct for the *actual* PUT logic — but if this router bug is real and present in production too (not just a PHP-built-in-server artifact), it would mean **the production API can't reach `/cases/:id` at all**, which is a far more serious and different problem than anything currently logged under BUG-004. This has NOT been checked against the real Apache/DirectAdmin/.htaccess topology — only ever against PHP's built-in dev server, in every session including this one. That real-topology gap is the single most important thing to close next, more urgent than it looked before this finding.
- **NOT DONE**:
  1. Reconcile the contradiction with the fourth session's 16/16 result (re-run under the exact same conditions, compare PHP versions with `php -v`, check for a `-t`/docroot flag difference).
  2. Test the real Apache + `.htaccess` topology (mod_rewrite passes a different `PATH_INFO`/`SCRIPT_NAME` shape than the built-in server's router mode — this bug may or may not exist there; nobody has tested it in any session to date).
  3. If confirmed present in Apache too: fix the router to not rely on `SCRIPT_NAME` for multi-segment requests — e.g. derive the app's base path once from a known-fixed value (config or `.htaccess`-set env var) instead of `dirname()` on a value the built-in server documents as unstable for non-existent-file requests, or use `PATH_INFO` if Apache is configured to provide it cleanly. Do not restructure shared routing without re-running the full HTTP regression suite plus a NACE-specific and cases-specific pass, per `docs/ORIENTATIONS.md`.
  4. Re-run the full 16-test suite after any fix and update this entry and BUG-004's status accordingly — do not mark VERIFIED again without a fresh real run's output pasted into the log, given a "VERIFIED, 16/16" claim already turned out not to reproduce once here.
- **Evidence level**: ROOT-CAUSED (empirical, not inferred) for the mechanism; REOPENED for the NACE-404 finding's disposition; **BUG-004's PUT path status should be treated as UNCERTAIN pending item 1 above, not simply reverted to OPEN or left at VERIFIED** — see `docs/DEV_STATUS.md`'s dated entry for this session for the precise current-status wording used.

### BUG-031 — Production API confirmed completely unreachable at `tools.macerti.com/duration_calculator/`; narrows BUG-030's open "AllowOverride vs basePath" question

**Status: FIXED & VERIFIED on live production (2026-09-02).** Confirmed fixed by Mahdi on the live host (`tools.macerti.com`). The live `config.php` has been corrected with `$config['basePath'] = '/duration_calculator/api';`, and the production API routes are now responding correctly.


**Detected**: 2026-09-02 (ninth session), from a screenshot supplied directly by Mahdi (not discovered via this project's own testing — first real-world production evidence anyone has had, since no session has ever had live-host access). The screenshot shows the live "Mes clients" screen at `tools.macerti.com/duration_calculator/...` (phone browser, device clock 04:11, page footer reading "Version 5.1.1 · Updated on 2 Sep 2026 at 04h04") displaying two identical-shaped errors: `Not found: GET /duration_calculator/api/clients` and `Not found: POST /duration_calculator/api/clients` (the second while attempting to create a client named "Uy" via the "Nouveau client" dialog).

**This narrows, rather than simply confirms, BUG-030's open action item.** The eighth session's real-Apache test found that an `AllowOverride`-denied host makes `GET /api/health` 404 *before PHP ever runs* (Apache's own rewrite rule is silently skipped, so the router script is never invoked at all). If that were the failure here, the response would be Apache's own default 404 page, not an application-shaped message. But `src/backend/api/index.php` line 262 is:
```php
respond(['error' => "Not found: $method $path"], 404);
```
— which produces exactly the string format shown in the screenshot, `$method`/`$path` substituted in. **This is direct evidence PHP executed and the app's own router made the 404 decision** — meaning `mod_rewrite`/`AllowOverride` most likely *did* work for this request (ruling out the eighth session's leading suspect as the sole cause, though see "not fully ruled out" below), and the real problem is upstream of that: the router reached its final catch-all because `$path` at that point still equals the *full* `/duration_calculator/api/clients`, not `/clients` — i.e., the `basePath`-stripping logic (introduced by BUG-030's fix) did not reduce it, which only happens if `basePath` in the live `config.php` is still `''` (the default) rather than `/duration_calculator/api`.

**Why this is plausible, cross-referenced against `RELEASES.md`**: the BUG-030 code fix (source commit `a380780`) was published to the deployment repo as `d82da0c`, and a docs-only re-publish (`946950b`, 2026-09-02 03:05:37 UTC) followed shortly after — timestamp-correlated with the page's own "Updated on ... 04h04" footer (Algeria is UTC+1; 03:05 UTC ≈ 04:05 local), meaning **the screenshot was very likely taken against the exact build containing the `basePath` mechanism, minutes after it went live.** The mechanism shipped in code; nothing in this project's pipeline touches the live server's actual `config.php` (it's gitignored by design, uploaded/edited manually — see `docs/DEPLOY.md`). So a very ordinary, easy-to-make gap — the code fix shipped, but nobody went back and edited the live `config.php` to set the new `basePath` key — reproduces this exactly.

**Not fully ruled out**: this reasoning is strong circumstantial evidence, not a confirmed root cause — nobody has read the real `config.php` on the host, and it remains possible `AllowOverride` is *also* wrong for some routes/files (the eighth session's finding about `.htaccess` deny rules failing open for `db/schema.sql` etc. is independent of this and still entirely unconfirmed against the real host either way).

**Recommended fix, in order — much simpler than a hosting support ticket**:
1. Mahdi (or whoever has server access) opens the live `config.php` directly (File Manager or SSH) and checks the `basePath` value. If it's `''` or missing, set it to `/duration_calculator/api` and save — no redeploy needed, this is a config file the pipeline never touches.
2. Re-test `GET https://tools.macerti.com/duration_calculator/api/health` directly. Expect the JSON health payload (see `docs/DEPLOY.md` step 7). If it now works: this bug is fixed, close it, and note in `RELEASES.md` that the live config was manually corrected (with a date, since git has no record of this — it's a server-side-only change).
3. If it *still* 404s (or 403s, or times out) after step 1: that points back to `AllowOverride` as at least a contributing cause — follow BUG-030's eighth-session action item (confirm with the DirectAdmin panel / hosting support) next.

**Reproduction context**: cannot be reproduced or independently verified from this sandbox — no credentials or network path to the real `tools.macerti.com` host (this sandbox's network allowlist doesn't include it, and the web-fetch tool available this session refuses URLs that weren't already established via a prior search/fetch in the conversation, which a screenshot's embedded text doesn't count as). This bug can only be confirmed or fixed by someone with actual access to the live host's file system.

**Evidence level**: STRONG CIRCUMSTANTIAL (the exact error-message-format match to this specific line of code is direct, verifiable evidence that PHP executed for this request; the `basePath` diagnosis built on top of that is the best-supported hypothesis given everything logged in this project, but is not itself independently confirmed against the live host).

### BUG-032 — `expo-constants` used but not installed (folded in from `src/frontend/BUGLOG.md`'s own BUG-001, eleventh session)

**Status: FIXED, closed. Historical — pre-release.**

- **Detected**: `npx tsc --noEmit` — `TS2307: Cannot find module 'expo-constants'`.
- **Cause**: `src/config/api.ts` imports `expo-constants` for reading `app.json` extras, but it wasn't an explicit dependency (only pulled in transitively by `expo`).
- **Fix**: `npm install expo-constants` explicitly.
- **Fixed in**: 0.1.0 (pre-release).

### BUG-033 — `HomeScreen` health-state spread overwrote the discriminant field (folded in from `src/frontend/BUGLOG.md`'s own BUG-002, eleventh session)

**Status: FIXED, closed. Historical — pre-release.**

- **Detected**: Same typecheck pass as BUG-032 — `TS2322`/`TS2783` on `setHealth({ status: "ok", ...h })`.
- **Cause**: The API's `/health` response also has a field called `status` (its own `"ok"` string from the server), and spreading `...h` after `status: "ok"` let the server's `status` field silently overwrite the discriminant the UI state union relies on — TypeScript caught it, but this would have been a real runtime bug (health card permanently stuck showing nothing, or worse, silently wrong branch) had it shipped.
- **Fix**: Destructured explicitly instead of spreading: `{ status: "ok", parameterSetId: h.parameterSetId, version: h.version, dbConnected: h.dbConnected, dbBackedParameters: h.dbBackedParameters }`.
- **Fixed in**: 0.1.0 (pre-release).

### BUG-034 — `expo export --platform web` failed on peer dependency mismatch (folded in from `src/frontend/BUGLOG.md`'s own BUG-003, eleventh session)

**Status: FIXED, closed. Historical — pre-release.**

- **Detected**: `react-dom` installed at a version whose peer `react` requirement (`^19.2.8`) didn't match the project's actual `react` version (`19.2.3`), causing `npm install --legacy-peer-deps` to be silently needed / plain install to fail.
- **Cause**: `npm install react-dom` without a version pin grabbed latest, which had drifted ahead of the Expo-managed `react` version in this project.
- **Fix**: Pinned `react-dom@19.2.3` to match the project's `react` version exactly.
- **Fixed in**: 0.1.0 (pre-release).

### BUG-035 — audit-mobile/frontend wizard save is unreliable in two places (folded in from `src/frontend/BUGLOG.md`'s own BUG-004, eleventh session — this is the bug `docs/DEV_STATUS.md`'s "Current status" section informally tracks as "BUG-004"; NOT the same bug as this file's own separate BUG-004, "`mb_strtolower` undefined")

**Status: PARTIALLY OPEN.** Backend HTTP-contract path fully VERIFIED (16/16, since BUG-030's fix in 5.1.1). Frontend error-surfacing/retry code was written 2026-08-31 and **re-confirmed present in current source this session** (see "RE-CONFIRMED" below — this closes a re-confirmation item that had been sitting open since the fourth session). The one gap unchanged across every session to date: no real browser/device interaction test has ever been performed for either symptom.

- **Reported by**: user, from live testing on the deployed app. Two symptoms:
  1. Nothing gets saved if the user drops off during the *first* step of the wizard (Sites & Secteurs) — autosave was supposed to kick in as soon as the wizard opens ("create calcul").
  2. Clicking **Enregistrer** at the very end of the wizard (Synthèse step) showed a generic error toast and the calculation was not saved.

- **Symptom 1 — root cause CONFIRMED by code reading**:
  - `CalculationWizardScreen.tsx`, on mount for a brand-new calculation, fires exactly one `api.saveCase(...)` (`POST /cases`) to create the initial draft. The original bug: if that call rejected for *any* reason, a silent `.catch()` swallowed the error and only set `hydratedRef.current = true` — it never set `existingCaseId`. The recurring autosave effect is gated on `existingCaseId` being set, so once the initial draft-creation call failed, autosave became a permanent silent no-op for the rest of the session — no retry, no user-visible error.
  - This is a structural bug independent of whatever originally caused the initial POST to fail — even a transient first-call hiccup (cold start, transient DB connection, validation edge case) would permanently kill autosave for that session with zero feedback.

- **Symptom 2 — root cause hypotheses (not independently re-tested this session)**: `PUT /cases/:id` re-runs `calculateCase()` server-side before persisting; a shape mismatch between the wizard's `buildInput()` and what the PHP engine expects would 500 with a generic client-facing message (`debug` is `false` in production). Also possible: symptom 1's silent failure meant `existingCaseId` was still `undefined` at the end of the wizard, so `save()` took the fresh-`POST` branch with the *complete* payload instead of the PUT branch — if there's a validation/shape difference between the minimal draft payload and the full end-of-wizard payload, that would explain a final-save-only error. Neither hypothesis has been confirmed or ruled out by a real repro in any session to date.

- **Fix applied 2026-08-31**: `createInitialDraft()` is now a named, retryable operation. A failed initial POST no longer marks the wizard as hydrated (so autosave can't silently pretend a case exists). The failure is surfaced in an explicit error state with a deterministic **Réessayer l'enregistrement** retry action. No automatic blind POST retry was added, since a response-loss retry can create duplicate cases without an idempotency mechanism — this is intentional, not an oversight.

- **RE-CONFIRMED 2026-09-02 (eleventh session)** — direct source read of the current `src/frontend/src/screens/CalculationWizardScreen.tsx` (not just trusting the docs), specifically to close the fourth session's open re-confirmation item ("confirm the current `CalculationWizardScreen.tsx` still reflects that surfaced-error behavior before closing this item"): `draftSaveError` state (line 105), `createInitialDraft()` with explicit try/catch that resets `hydratedRef.current = false` and sets `draftSaveError` on failure (lines 147–163), and the `Réessayer l'enregistrement` retry button wired to `() => void createInitialDraft()` (lines 408–409) are all present and intact after the repository restructure and every subsequent session's changes. **This closes the fourth session's outstanding "confirm the source still reflects this" item — it does.**

- **Still NOT DONE / OPEN** (unchanged by this session, all require real host/browser/device access no sandboxed session has ever had):
  1. Reproduce the production first-call failure under conditions that could expose a transient/cold-start/network issue.
  2. Instrument or otherwise expose the actual first `POST /cases` failure response/status when it occurs in production.
  3. Real browser/device test of the complete wizard save/reopen lifecycle — the single biggest gap across this entire project, flagged in every session's hand-off since the second session and still true today.
  4. Symptom 2's root cause is still not independently confirmed — see hypotheses above.

- **Dependency / hand-off**: do not re-derive the symptom-1 root cause or re-verify the retry-button/error-state code from scratch — both are done, see above. The next actionable step for this bug is either (a) a real device/browser click-through, or (b) pulling the real PHP error log from the production host for an actual "Enregistrer" failure — both are host/device-access-blocked exactly like BUG-031, not sandbox-actionable.

### BUG-036 — Deployment artifact missing `src/backend/auth/`, causing a full production API outage (every route 500s, not just SSO) — found while investigating a user-reported "Microsoft sign-in returns HTTP 500"

**Status: FIXED and VERIFIED 2026-09-02 (fourteenth session). Reclassified P0 (was reported as if it were a narrow P1 SSO bug — it is not; it took the entire API down).**

**Reported by**: Mahdi, as "I set up Azure AD (redirect URI, client secret, client ID in config.php), enabled Enterprise App visibility, and clicking 'Microsoft' returns HTTP 500."

**Detected**: This session's own investigation, not the reporter — the actual scope (whole API down, not just `/auth/microsoft`) was not visible from the symptom as reported, since Mahdi had only tried the Microsoft button.

**Root cause**: `71bd092`/`3396425` (an untracked-in-DEV_STATUS.md session, author `Antigravity Dev` — see "Process gap" below) added `src/backend/auth/{OAuthSession,MicrosoftOAuth,GoogleOAuth}.php` and made `src/backend/api/index.php` `require_once` all three **unconditionally at the top of the file, before the routing dispatch and before the try/catch block** (lines 18–20). The `Makefile`'s `build-deploy` target and the CI workflow's own duplicated copy of that same assembly logic were never updated to copy the new `auth/` folder into `_deploy/`. Both passed CI green anyway, because:
- CI's regression tests (`smoke_test.php`, `http_api_test.php`) run against `src/backend/` directly, never against the assembled `_deploy/` tree — a "source has it, assembly forgot it" class of bug is structurally invisible to them.
- The Work Package G artifact-content check (added tenth session) only checked for *unexpected extra* files, not *missing required* ones.
- The Makefile/CI's own `test -f` assertions only check the handful of files someone remembered to name explicitly; nobody added one for the new folder.

**Evidence — confirmed the live deployment repo itself, not just reasoning about the source diff**:
```
curl (GitHub API) → repos/macerti/duration_calculator/contents/
  → top-level listing has NO auth/ directory
curl (GitHub API) → repos/macerti/duration_calculator/contents/api/index.php
  → decoded content confirmed byte-identical to the version with the new
    require_once __DIR__ . '/../auth/OAuthSession.php' at line 18
```
**Reproduced locally** (built an exact replica of the live layout — every folder the old Makefile actually copies, `auth/` deliberately excluded — then invoked the router directly, both via `php -S` and via direct CLI invocation with `REQUEST_METHOD`/`REQUEST_URI` env vars to sidestep this sandbox's `php -S`-built-in-server-plus-session flakiness, see "Sandbox tooling note" below):
```
PHP Warning:  require_once(.../auth/OAuthSession.php): Failed to open stream: No such file or directory in api/index.php on line 18
PHP Fatal error:  Uncaught Error: Failed opening required '.../auth/OAuthSession.php' ... in api/index.php:18
```
This fatal fires for **every** request — tested both `/auth/microsoft` and the unrelated `/clients` route, both fatal identically, since the `require_once` runs before any routing decision is made. **This confirms the live production API has been returning 500 for every single endpoint since commit `3396425` was published**, not just the SSO buttons — calculations, client list, everything.

**Fix**:
1. `Makefile`'s `build-deploy` target and the CI workflow's "Assemble deployment artifact" step both now `mkdir -p _deploy/auth` and `cp -R src/backend/auth/. _deploy/auth/`, and CI gained explicit `test -f _deploy/auth/{OAuthSession,MicrosoftOAuth,GoogleOAuth}.php` assertions.
2. `scripts/check-deploy-artifact.sh` (Work Package G, tenth session) extended with a **structural completeness check**: parses every `require`/`require_once __DIR__ . '/...'` in the assembled artifact's PHP files and verifies each resolves to a real file inside the artifact. This is deliberately generic — it would have caught this exact bug without needing to know "auth" by name in advance, and will catch the same class of mistake for any future new backend module. Added `auth` to the existing allowed-top-level-entries list too (needed either way, since Work Package G's *other* direction — no unexpected extra files — would otherwise now flag `auth/` itself as unexpected).

**Verification**:
- Negative-tested the new completeness check before trusting it: copied a real, correctly-built `_deploy/`, deleted `auth/` from the copy, confirmed the check fails with exactly the three missing files named; confirmed it passes clean on the real, correctly-built artifact.
- Rebuilt the real `_deploy/` via the fixed `make build-deploy` end to end (fresh `npm ci` + `expo export` + full backend copy) — `scripts/check-deploy-artifact.sh` now reports all 4 checks (extra-files, forbidden-files, no-vendored-node_modules, completeness) PASS.
- Re-ran the exact repro above against the fixed artifact: `GET /auth/microsoft` and `GET /health` both now complete with exit code 0, no fatal error (health payload returns its normal JSON).
- Full existing regression unaffected: `php tests/smoke_test.php` 24/24, `npx tsc --noEmit` clean.
- `scripts/check-repo-hygiene.sh` (Work Package G's other script) still passes clean — this bug didn't touch anything in its scope.

**Sandbox tooling note** (not a bug in the app — recorded so the next session doesn't waste time rediscovering it): `php -S` combined with a route that calls `session_start()`, when backgrounded from this sandbox's `bash_tool`, intermittently hung indefinitely (tool calls returned with no output, exit -1) rather than the process failing or responding. A bare `php -r "session_start(); ..."` outside the dev server returns instantly, so this looks like a sandbox-specific interaction between backgrounded child processes and this tool's output-capture pipe, not a PHP or session config problem. Worked around by invoking the router script directly via CLI with `REQUEST_METHOD`/`REQUEST_URI` environment variables instead of going through `php -S` at all — gives a clean pass/fail on whether the script fatal-errors, without needing a live socket.

**What is NOT independently verified this session** (the honest limits of a sandbox-only investigation):
1. The actual production host `tools.macerti.com` was never directly queried (no network path from this sandbox, and the web-fetch tool available this session only permits URLs already established earlier in a conversation via search/fetch — same limitation BUG-031 hit). Everything above is inferred from (a) the live *deployment repository's* actual committed content, which is about as close to ground truth as this project's tooling allows without host access, and (b) a faithful local reproduction of that exact layout. It remains formally possible (though there is no positive evidence for it) that the real host's PHP setup somehow tolerates the missing require differently than a byte-identical local reproduction — treat as effectively certain but not literally host-confirmed.
2. Whether the auto-FTP-deploy pipeline documented in `docs/DEPLOY.md` (source push → source CI rebuilds+republishes to `macerti/duration_calculator` → that repo's own "Déploiement — tools.macerti.com/duration_calculator" workflow ships it via FTP) actually completes the last hop onto the real host is inferred from that workflow's own green run history, not from directly observing the live site respond correctly after this fix's push. **Whoever picks up next: confirm `https://tools.macerti.com/duration_calculator/api/health` actually returns its JSON payload after this fix's CI run completes, and confirm a real Microsoft login click-through end to end (this session could not — see point 1) — this closes the loop this session couldn't.**
3. The SSO login flow's *substantive correctness* beyond "doesn't fatal-error" (does the Microsoft redirect URL Azure actually accepts it, does the callback correctly complete, does `Réessayer`-style error surfacing exist here too) was not deeply audited this session, which focused on the outage. Static review of `MicrosoftOAuth.php`/`GoogleOAuth.php`/`OAuthSession.php`/the new `index.php` routes found nothing else obviously wrong (config keys read match `config.example.php`'s new keys exactly; CSRF `state` check present; callback wraps the token exchange in try/catch and redirects with `?auth_error=...` rather than fatal-erroring) — but "nothing obviously wrong on read-through" is a much weaker claim than "verified working," precisely the distinction this project's evidence-label convention exists to preserve. Treat SSO as UNVERIFIED, not CONFIRMED WORKING, until someone actually completes a login.

**Process gap worth fixing, not just this one bug** (flagging for whoever owns the overall process, not something this session unilaterally changed): the commits that introduced this (`b9b6bbd`, `71bd092`, `3396425`, authored by a tool identifying itself as "Antigravity Dev") have no corresponding `docs/DEV_STATUS.md` dated session entry — the first session to document any of that work is this one, after the fact, investigating a bug it caused. This project's whole multi-dev continuity model depends on every session logging what it tested before moving on; a session that ships three feature commits with no log entry and no artifact-completeness verification is exactly the scenario the living-docs convention exists to prevent. Not a criticism of the feature work's design — the auth code itself reads soundly — but the deploy-completeness gap would have been caught immediately by a session that, per this project's own established habit, rebuilt and smoke-tested `_deploy/` (not just `src/backend/`) before calling the feature done.

### BUG-037 — SSO callback redirects back to login screen with no error shown; investigation narrows this to two live-evidence-only candidates, plus a confirmed and fixed frontend bug that was masking whatever the real one is

**Status: SUPERSEDED 2026-09-03 (seventeenth session) — see BUG-038, which now has the actual answer. Both of this entry's live-evidence candidates below are RULED OUT, not just left open: the real banner text Mahdi eventually saw was Microsoft's own `invalid_request` code (AADSTS9002325), which is neither `state_mismatch` (candidate 1: session persistence) nor `callback_failed` (candidate 2: wrong client secret) — those are our own app-generated codes (confirmed by grep, see BUG-038) and would only ever fire from the paths described below, neither of which matches what happened. This entry is kept for its still-accurate ruled-out reasoning and its real, standalone frontend fix; do not use its two candidates as a starting point for any future SSO investigation — BUG-038 is the current source of truth for what's actually wrong and what to do about it.**

**Reported by**: Mahdi, after BUG-036's fix restored the API: "clicking Microsoft takes me to select-account, I select an account, it brings me back to the login screen (Continue with Microsoft / Continue with Google)" — with no error message visible anywhere.

**Confirmed and fixed this session — `src/frontend/src/hooks/useAuth.ts` race condition**:
The mount effect checks `window.location.search` for `?auth_error=...` (set by the PHP callback on failure) and calls `setError(...)`, then immediately calls `fetchMe()` — whose very first line was an unconditional `setError(null)`. Both calls happen synchronously within the same effect execution, so React batches them into a single update where the *last* write wins: `error` always ended up `null` before a single paint could show it. **This means any OAuth failure — state mismatch, provider error, token-exchange failure — was structurally guaranteed to render as a silent "back to login" with zero visible error, regardless of what the real server-side problem was.** This is not a hypothesis; it follows directly from reading the code and React's batching semantics (two synchronous `setState` calls to the same state value in one tick collapse to the last one).

Fix: `fetchMe()` now accepts an options object (`{ preserveError, sawAuthOk }`); the mount effect passes `preserveError: true` when it just detected `auth_error` in the URL, so `fetchMe` skips its own reset that tick. Also extended to explicitly detect `?auth=ok` (set by the callback on a server-side-successful sign-in) — if `/auth/me` still comes back 401 right after that, the hook now shows an explicit message pointing at session persistence instead of looking identical to a normal never-logged-in visit (previously indistinguishable). Verified `npx tsc --noEmit` clean; `LoginScreen.tsx` already correctly renders `error` in a banner (confirmed by reading it — this part was never broken), so this fix is the only thing needed to make whichever underlying error is occurring finally visible.

**Ruled out this session, by code reading — do not re-investigate these**:
- **Query string loss between Microsoft's redirect and `index.php`**: `src/backend/api/.htaccess` rewrites with `[QSA,L]` (Query String Append), which correctly preserves `?code=...&state=...` through the rewrite to `index.php`. Confirmed this file is actually included in the built artifact (`cp -R src/backend/api/. _deploy/api/` copies dotfiles too — verified by rebuilding and listing `_deploy/api/.htaccess` directly, not just reading the Makefile and assuming).
- **Registered redirect URI mismatch at the `/authorize` step**: ruled out because Mahdi reports reaching Microsoft's own account-picker UI. Microsoft's identity platform validates `client_id`/`redirect_uri` *before* rendering any sign-in UI — an invalid redirect URI shows Microsoft's own `AADSTS50011` error page immediately, not the account picker. Reaching the picker confirms the `/authorize` request was accepted as registered.
- **Internal redirect_uri inconsistency between our own `/auth/microsoft` and `/auth/callback/microsoft`**: both are computed from the same `$config['app_url']` value, so they're consistent with each other by construction — not a candidate.

**NOT ruled out — two remaining candidates, both requiring evidence this session cannot obtain (no host or browser access)**:
1. **Session data not persisting between the initial `/auth/microsoft` redirect and the `/auth/callback/microsoft` request** (the CSRF `state` value, stored server-side via `sessionSetOAuthState()`, wouldn't be there to compare against on the callback). This is an extremely common shared-hosting failure mode: PHP's default global session save path is frequently blocked by `open_basedir` restrictions on cPanel/DirectAdmin-style hosts (this project's documented hosting type), causing `session_start()` to "succeed" (no fatal, `$_SESSION` usable in-memory for that one request) while silently never persisting to disk — so the *next* request starts a brand-new empty session with no memory of the previous one. Would show as `?auth_error=state_mismatch` after this session's fix.
2. **Token exchange failing inside `microsoftHandleCallback()`** — most commonly caused by pasting Azure's **Secret ID** (a GUID shown right next to the actual secret in the Azure Portal UI) into `config.php` instead of the **Secret Value** (the actual secret, only shown once at creation time and easily confused with the ID). Would show as `?auth_error=callback_failed`, and critically, the PHP error log would have an explicit line: `[duration_calculator] Microsoft OAuth error: Microsoft token exchange failed: {...}` with Microsoft's actual JSON error body (typically `invalid_client` or similar) — this would make the distinction from candidate 1 immediate and certain.
3. A third possibility candidates 1/2 don't cover: the callback genuinely completes (`sessionSetUser()` runs, redirects with `?auth=ok`) but the *separate, subsequent* `GET /auth/me` XHR call from the SPA doesn't see the session — same underlying category as #1 (cookie/session persistence) but manifesting one request later. This session's fix now surfaces this case too (see above) instead of it looking like a normal logged-out visit.

**Next step (this is the one thing that will make this fast to finish — please do this before anything else is attempted)**: with this session's frontend fix live, retry the Microsoft sign-in once and report back **exactly what the error banner says**, or if there's no banner, **what the browser's address bar shows** right when it lands back on the login screen (`?auth_error=state_mismatch`, `?auth_error=callback_failed`, `?auth=ok`, or nothing at all). That single piece of information determines which of the three candidates above it is, and this bug becomes a same-session fix once known — do not re-derive the above reasoning from scratch, and do not guess-fix candidate 1 or 2 without this evidence, since applying the wrong fix first would just add noise to the next diagnosis. If the PHP error log on the host is reachable, a line starting with `[duration_calculator] Microsoft OAuth error:` or `[duration_calculator] Google OAuth error:` from around the time of the attempt is equally decisive and can be reported instead of/alongside the banner text.

**Dependency / hand-off**: this session's frontend fix (commit below) is a genuine, verified improvement regardless of the outcome — it turns every future OAuth failure from silent into visible, for good, not just for this bug. What's NOT done is identifying and fixing whichever of the two live candidates is actually happening — that is squarely blocked on the one piece of evidence described above.

---

### BUG-038 — the "invalid_request" Mahdi saw was Microsoft's own error code arriving correctly (BUG-037's fix works); the real diagnostic detail (`error_description`) was being silently discarded server-side before ever reaching the banner

**Status: ROOT CAUSE CONFIRMED 2026-09-03 (seventeenth session). The exact fix is an Azure Portal configuration change, not a code change — no source-side action is possible from this sandbox. Awaiting Mahdi to apply it and confirm sign-in completes.**

**UPDATE 2026-09-03 (seventeenth session) — the requested retry evidence came back, and it settles this**: banner text reported verbatim: `⚠ invalid_request: Proof Key for Code Exchange is required for cross-origin authorization code redemption.` This is Microsoft's well-documented **AADSTS9002325**, confirmed by cross-checking multiple independent sources (Microsoft Q&A, Microsoft Tech Community, Auth0 Community, a GitHub issue against `Azure-Samples/azure-search-openai-demo`, and a langfuse discussion thread hitting the identical error against the identical architecture shape) — all converge on one cause and one fix.

**Root cause**: the redirect URI used for Microsoft sign-in (`.../auth/callback/microsoft`) is registered in Azure Portal under the **"Single-page application (SPA)"** platform type instead of **"Web"**. Entra ID enforces PKCE for any redirect URI registered as SPA, regardless of how the app actually redeems the code. This app's backend (`src/backend/auth/MicrosoftOAuth.php`) does the opposite of a SPA flow — a confidential, server-side exchange: `microsoftHandleCallback()` POSTs `client_id` + `client_secret` + `code` to Microsoft's token endpoint via `curl` from PHP, with zero PKCE parameters anywhere (confirmed this session: `grep -rn "code_challenge\|code_verifier\|PKCE"` across `src/backend` and `src/frontend` returns no matches). A confidential/Web-flow app registered under the SPA platform type is exactly the scenario every one of the sources above names as the AADSTS9002325 trigger. This also fully explains why it surfaces *after* the account picker (Entra evaluates this platform-type constraint at code-issuance time, once the account/consent step completes) — consistent with, not contradicting, BUG-037's earlier reasoning that ruled out a simple redirect-URI-mismatch.

**This also resolves BUG-037**: its two remaining candidates (session-persistence, wrong client secret) are both ruled out by this evidence — see the cross-reference added to BUG-037 above. Neither was ever the real problem; the request was being rejected before either mechanism would ever come into play.

**The fix — Azure Portal only, no code change, cannot be done from this sandbox**:
1. Azure Portal → **App registrations** → the app used for this project → **Authentication**.
2. Look under **each** platform section for the redirect URI that matches this app's `.../auth/callback/microsoft` value (exact value is in the live `config.php`'s `app_url`, not committed to source).
3. If it appears under **"Single-page application"**: remove it from there.
4. Add it under **"Web"** instead (Add a platform → Web → paste the same URI). A client secret must already exist under **Certificates & secrets** for the Web platform to work — one already exists per `config.php`'s `client_secret` value, so no new secret should be needed, but confirm it hasn't expired while there.
5. Save, then retry the Microsoft sign-in end to end.
6. If the redirect URI is already correctly under "Web" and nowhere under "SPA" — report that back verbatim rather than re-applying this fix blind; that would mean this specific diagnosis doesn't hold and a fresh look at the `error_description` text is needed instead of assuming.

**DONE / VERIFIED this session (diagnosis only — no source code changed for BUG-038 itself)**:
- Confirmed via web search that the exact reported string is Microsoft's AADSTS9002325, and that this precise "confidential/Web app registered under SPA platform type" scenario is the consistent, repeatedly-confirmed cause across multiple independent, unrelated real-world reports — not a single anecdotal match.
- Confirmed via `grep` that this codebase sends no PKCE parameters anywhere, consistent with a genuine confidential-client (Web) flow, not a public-client (SPA) one — ruling out "our code should be using PKCE and isn't" as an alternative reading of the same error text.
- Re-read `microsoftHandleCallback()` in full to confirm the token exchange really is a server-side `curl` POST with `client_secret`, not something a browser initiates — the "cross-origin" half of the error text refers to how Entra ID classifies the SPA-registered redirect URI itself, not to anything this app's own request pattern does wrong.

**NOT DONE / open**:
1. The Azure Portal change itself — needs Mahdi's access, not available from this sandbox (same class of limitation as BUG-030's `AllowOverride` question and BUG-031).
2. Confirmation that sign-in completes end to end after the platform-type change — needs one more retry report.
3. Google's flow (`GoogleOAuth.php`) — still completely unexercised; if it's *also* registered under the wrong platform type in a similar Google Cloud Console misconfiguration, that would be a separate, not-yet-investigated question for whenever Mahdi first tries it.

**Reported by**: Mahdi, retrying Microsoft sign-in after BUG-037's fix went live: reaches the account picker, selects an account, lands back on the login screen with a banner reading exactly `⚠ invalid_request`.

**What this confirms about BUG-037**: the fix from the previous session is working exactly as designed — the banner is now visible, in real production, for the first time. This is a fourth candidate BUG-037 didn't anticipate (it only enumerated `state_mismatch`, `callback_failed`, and the `auth=ok`-but-still-401 case) — `invalid_request` is neither app-generated code, so it did not match any of the three. See below.

**Root cause — confirmed by reading the code, not guessed**: `invalid_request` is not a string our own code ever produces anywhere (confirmed by grep across the tree). The only place it can come from is Microsoft's own redirect back to `/auth/callback/microsoft?error=invalid_request&error_description=...&state=...` — i.e. Microsoft rejected the `/authorize` request itself, and our callback handler's `if ($error) { ... }` branch forwarded `$_GET['error']` straight to the client via `?auth_error=...` **but never read `$_GET['error_description']` at all**. Per the OAuth 2.0 spec, `error` is a short fixed-vocabulary code (`invalid_request`, `invalid_scope`, `unauthorized_client`, etc.) that's close to meaningless alone — `error_description` is where the provider actually explains what's wrong (for Microsoft, this is almost always a specific `AADSTS#####:` line). We were throwing that line away before Mahdi or any future session could ever see it. This one string is the actual blocker on finishing this bug.

**Timing detail worth recording**: this fires *after* the account picker, not before — same reasoning BUG-037 already used to rule out a registered-redirect-URI mismatch still holds (Microsoft validates `client_id`/`redirect_uri` before rendering any UI at all), so this is not that. `invalid_request` surfacing post-picker is consistent with Microsoft needing to resolve the selected account before it can evaluate certain request-shape constraints — most plausible candidates researched this session (not confirmed, since we have no host/browser access and no `error_description` text yet):
  - The app registration's redirect URI being registered under Azure Portal's **"Single-Page application" platform type** rather than **"Web"**, while this backend flow is a confidential/server-side client (uses a `client_secret`, per `MicrosoftOAuth.php`) — Microsoft's identity platform enforces different constraints on SPA-registered redirect URIs and can reject a non-SPA-shaped request against one with `invalid_request`.
  - Some other constraint on the `/authorize` request shape (scope, response_mode/response_type combination, or app-registration-level restriction) that only gets evaluated once the account/tenant context is known.
  **Do not act on either guess** — this is exactly the situation ORIENTATIONS.md warns about ("don't turn an architectural hypothesis into a confirmed root cause"). The `error_description` text (now that it's no longer discarded) will almost certainly name the exact AADSTS code and settle this in one look, the same way BUG-036's fix was found by reading an explicit error rather than guessing.

**DONE / VERIFIED this session**:
- `src/backend/api/index.php`: both `/auth/callback/microsoft` and `/auth/callback/google` now read `$_GET['error_description']`, log the full provider error (code + description) server-side via `error_log('[duration_calculator] Microsoft OAuth error from provider: ...')` (matching the existing `[duration_calculator] ... OAuth error:` prefix convention from BUG-036/037's token-exchange logging, extended to cover this earlier, previously-silent branch), and pass it to the client as a new `auth_error_description` query param alongside the existing `auth_error`.
- **Security tradeoff made explicitly, not by default**: ORIENTATIONS.md's standing rule is "log detail server-side, return a generic message to the client" for our *own* unexpected exceptions (stack traces that could map app internals to an attacker). This is different: `error_description` here is the identity provider's own public-facing error text, not our internal exception detail, and this is a small internal tool where Mahdi is the only person who will ever see this banner and has no other reliable channel back to a session that can read host logs. Logged both server-side (for a durable record) *and* client-side (so the one-and-only user of this flow doesn't need host log access just to report back a diagnosable string). Flagged in `SECURITY.md` as a deliberate, scoped exception to the generic-error-message rule — revisit if this app ever gets a second real user base where that tradeoff's calculus would change.
- **Found and fixed a second, related bug while verifying the above** (not reported by Mahdi — caught by tracing the fix through to the frontend before calling it done, per ORIENTATIONS.md's "when another review finds something we missed" spirit applied to our own pre-ship check): `src/frontend/src/hooks/useAuth.ts` was calling `decodeURIComponent()` on a value already returned by `URLSearchParams.get()`, which fully decodes on its own — a latent double-decode that was harmless for the old fixed-vocabulary codes (`state_mismatch`, `callback_failed` — never contain `%`) but would throw an uncaught `URIError` on any free-form `error_description` containing a literal `%` not followed by two hex digits (verified: a description containing `100%` reproduces the crash under the old code, confirmed fixed under the new code — see verification commands in the session's DEV_STATUS.md entry). Removed the redundant decode entirely rather than reproducing it for the new field.
- Verified: `npx tsc --noEmit` clean; `php -l` clean on all three changed/touched PHP files; `php tests/smoke_test.php` 24/24; `scripts/check-repo-hygiene.sh` clean (including its secret-pattern scan); full `make build-deploy` succeeds end-to-end, all 4 artifact checks pass, and the fix's presence in the assembled `_deploy/api/index.php` was confirmed directly (not assumed from the Makefile).
- Verified the actual runtime string logic three ways since this sandbox's `php -S`/`headers_list()` can't observe real HTTP headers under CLI (see sandbox tooling note below): (1) direct CLI invocation of the real router against a simulated Microsoft error callback confirmed the `error_log()` line fires with the full code+description, exit code 302; (2) an isolated PHP snippet reproducing just the redirect-URL-building logic confirmed the exact `Location:` string, correctly URL-encoded; (3) a Node.js snippet using real `URLSearchParams` (not a PHP approximation) confirmed the frontend decodes that exact URL back to the original code+description losslessly, including a `%` in the description, without throwing.

**NOT DONE / open — read before assuming this is fully closed**:
1. **The actual reason Microsoft is rejecting the request is still not identified.** This session made the reason *visible*; it did not yet see it. No host or browser access from this sandbox, same wall as BUG-030/031/036/037.
2. Google's callback got the identical code fix (for consistency and because it was a two-line-diff to also cover), but — same caveat as every prior session — Google's flow has never been exercised at all; Mahdi has only tried Microsoft.
3. Do not guess-fix either candidate hypothesis above (SPA-vs-Web platform type, or a scope/response-mode constraint) without the `error_description` text in hand. Applying an untested fix now would, per this project's own established pattern (see BUG-037's explicit warning against this), just add noise to the next diagnosis if the guess is wrong.

**Sandbox tooling note, not an app bug** — recorded so the next session doesn't re-lose time on it: PHP's `headers_list()` returns an empty array under the CLI SAPI even after real `header()` calls execute without error — there is no HTTP response transport for CLI to record against. This is a *different* limitation from the already-documented `php -S` + `session_start()` hang (BUG-036's note) — that one is about starting a dev-server socket; this one is about introspecting headers from a direct CLI `require` of the router. Neither blocks correctness verification, but don't expect `headers_list()` to show anything when direct-invoking the router this way — verify redirect/header logic by isolating the string-building logic instead (see verification method (2) above), or by reading `$_SERVER`/exit codes rather than headers.

**Next step — superseded, see the 2026-09-03 (seventeenth session) update above**: the predicted outcome happened exactly as anticipated — the AADSTS code named the fix outright. Do not re-derive the SPA-vs-Web reasoning from scratch; it is fully confirmed above, not a candidate anymore. The only remaining next step is Mahdi applying the Azure Portal change and reporting back whether sign-in then completes.

**Dependency / hand-off (seventeenth session)**: nothing further is actionable on BUG-038 from a sandbox — this is now entirely gated on an Azure Portal change plus one retry, both of which need Mahdi. Do not re-open the `error_description`-discard investigation (that part is done, source-side, and already published as of the sixteenth session's push) or the AADSTS-code research (done above) without new evidence contradicting this diagnosis. If the retry after the Azure Portal fix still fails, the very first thing to check is the *new* banner text — it will be a different AADSTS code if this diagnosis was right and something else was also wrong, or the same one if the portal change didn't actually take (e.g. edited the wrong app registration, or a caching delay — Entra Portal changes are usually near-instant but occasionally take a few minutes to propagate).

---

### BUG-039 — after the BUG-038 Azure Portal fix, a NEW error appeared: `callback_failed` — this is our own catch-all for a failed token exchange, and it was discarding the real reason the exact same way BUG-038's provider-error branch used to

**Status: ROOT CAUSE CONFIRMED AND FIXED 2026-09-03 (nineteenth session) — awaiting Mahdi's confirming retry. See the nineteenth-session update at the end of this entry; do not re-derive the reasoning below from scratch, it's superseded by confirmed evidence.**

**Reported by**: Mahdi, after applying BUG-038's Azure Portal fix (redirect URI moved from "Single-page application" to "Web"): "now when I select 'continue on Microsoft', pick an account, and authorize the app — when it goes back to my app it fails and shows `⚠ callback_failed`."

**This confirms BUG-038's diagnosis was correct** — the AADSTS9002325/PKCE error is gone. Account selection and consent now complete successfully; the failure has moved to a later stage. This is a **new, distinct bug**, not a reopening of BUG-038 — do not re-touch the Azure Portal platform-type setting on the strength of this report, that part is done.

**Root cause, confirmed by reading the code and by grep — not guessed**:
- `grep -rn "callback_failed"` across the tree returns exactly two hits, both in `src/backend/api/index.php`, and one comment in `useAuth.ts` — this string is never produced by Microsoft or Google. It is generated entirely by our own code.
- Both `/auth/callback/microsoft` and `/auth/callback/google` wrap their token-exchange call (`microsoftHandleCallback()` / `googleHandleCallback()`, in `src/backend/auth/{MicrosoftOAuth,GoogleOAuth}.php`) in `catch (\Throwable $e)`. Before this session, that block did exactly two things: `error_log(...)` (server-side only) and redirect with the bare `?auth_error=callback_failed` — the actual `$e->getMessage()` (which, per `MicrosoftOAuth.php`'s own code, is either Microsoft's token-endpoint JSON error body verbatim, e.g. `Microsoft token exchange failed: {"error":"invalid_client","error_description":"AADSTS...`, or a curl transport error string) was thrown away before it could ever reach anyone who can't read the host's PHP error log.
- This is structurally identical to BUG-038's own root cause (provider `error_description` discarded), one layer deeper: that fix covered the case where *Microsoft* rejects the `/authorize` request before issuing a code; this bug is the case where *our own server* fails while redeeming a code Microsoft did issue.
- **This exact failure mode and its most likely cause were already anticipated and written up in BUG-037's original (now-superseded) investigation**, candidate 2: "Token exchange failing inside `microsoftHandleCallback()` — most commonly caused by pasting Azure's **Secret ID** (a GUID shown right next to the actual secret in the Azure Portal UI) into `config.php` instead of the **Secret Value** (the actual secret, only shown once at creation time and easily confused with the ID). Would show as `?auth_error=callback_failed`." That candidate was shelved when the AADSTS9002325 error turned out to be the more immediate blocker (BUG-038) — it was never ruled out, and this report is fully consistent with it now surfacing on its own. **This is a plausible hypothesis carried forward from prior work, not a fresh guess — but it is still unconfirmed. Do not act on it blind; wait for the evidence this session's fix now exposes**, per this project's own standing rule (see BUG-037/038's identical warnings against guess-fixing).
- Other candidates not ruled out, for completeness: an expired client secret (Azure secrets have a mandatory expiry, commonly 6/12/24 months); a client secret regenerated in the Portal without `config.php` being updated to match; or — less likely, since the redirect URI was already confirmed reachable enough to receive Microsoft's callback — a residual redirect-URI mismatch specifically at the token endpoint (Microsoft's `/token` endpoint independently validates that the `redirect_uri` parameter matches the one used at `/authorize`, byte-for-byte).

**Fix applied this session (visibility only, matches BUG-038's precedent exactly)**:
- Added `oauthClientSafeErrorDetail(string $message): string` to `src/backend/auth/OAuthSession.php` — length-caps the message to 400 chars with an ellipsis, to keep the redirect URL bounded. Documented inline why forwarding this is safe (same reasoning as `SECURITY.md`'s existing BUG-038 entry: this is the provider's own response body or a transport error, not our secrets — the client secret is sent as an outgoing field and never echoed back by either provider's token endpoint, confirmed by reading `_microsoftHttpPost()`/`_microsoftHttpGet()`).
- Both catch blocks in `src/backend/api/index.php` now build `$redirect = $appUrl . '/?auth_error=callback_failed&auth_error_description=' . urlencode(oauthClientSafeErrorDetail($e->getMessage()))` instead of the bare `?auth_error=callback_failed`.
- **No frontend change was needed.** `src/frontend/src/hooks/useAuth.ts`'s banner logic (built during BUG-038) already reads `auth_error_description` generically for *any* `auth_error` value, not just `invalid_request` — confirmed by re-reading it this session before assuming so. The existing `AADSTS9002325`-specific hint text won't fire for this bug (different code), which is correct — no misleading hint will be shown.
- `SECURITY.md`'s existing BUG-038 entry documents the "log server-side + also forward to client" tradeoff for provider `error_description`; this is a direct extension of the same accepted, scoped tradeoff to an adjacent code path, not a new policy decision — flagged here rather than silently re-justified from scratch.

**Verification this session — real commands, real output**:
- `php -l` clean on `api/index.php`, `auth/OAuthSession.php`, `auth/MicrosoftOAuth.php`, `auth/GoogleOAuth.php`.
- Isolated the exact new redirect-URL-building logic in a standalone PHP snippet (this sandbox's CLI SAPI can't introspect real HTTP headers — `headers_list()` returns empty under CLI, same documented limitation BUG-038 hit) with a realistic Microsoft token-endpoint error payload (`invalid_client` / AADSTS7000215, the wrong-secret-type error): confirmed the built `Location:` string is correct and URL-encoded, and round-tripped it back through `parse_str()` to confirm `auth_error_description` decodes losslessly back to the original JSON error body. Separately confirmed the 400-char truncation path appends the ellipsis correctly (verified via `bin2hex` on the trailing bytes — the ellipsis is a 3-byte UTF-8 character, `substr(...,-1)` alone gives a false negative; use `str_ends_with($s, "\xe2\x80\xa6")` or equivalent).
- Full local regression, fresh MariaDB-compatible stand-up (MySQL 8.0.46 — same client-compatible stand-in caveat every session since the fourth has flagged; no bit-for-bit MariaDB reproduction has been done in any session to date): `php tests/smoke_test.php` **24/24** (engine layer, unaffected as expected — this session touched only the auth callback paths). `php tests/http_api_test.php` **16/16** against a real `php -S` instance.
  - **Sandbox tooling note reconfirmed, not a new finding**: exactly like the eighth/ninth sessions' documented `mariadbd` finding, a backgrounded `php -S` process in this sandbox does not survive past the end of the single tool-call/command invocation that started it — a separate follow-up call to run the test suite against it gets `status=0` on every request (connection refused), even though the server responded fine to a manual `curl` moments earlier within the *same* invocation. Worked around exactly as that precedent prescribes: start-server + `sleep` + run-full-test-suite in one single shell invocation. Recording this explicitly against `php -S` specifically (previously only documented for `mariadbd`) so a future session doesn't waste time re-diagnosing it as an app bug.
- Direct CLI-invocation spot checks (`REQUEST_METHOD`/`REQUEST_URI` env vars, the alternative method documented since BUG-036 for when a live socket isn't available or isn't needed) on `/health`, `/nace/01`, `/clients` (GET), and `/auth/microsoft` (with no client ID configured, correctly returns its existing 501) — all correct, confirming the new `use function AuditEngine\Auth\oauthClientSafeErrorDetail;` import doesn't disturb anything else in the file. **Caveat noted for future sessions**: PHP's CLI SAPI does not populate `$_GET` from `REQUEST_URI` the way `php -S`/Apache do — a direct CLI check of `/nace/search?q=...` will incorrectly report the query param as missing. This is a limitation of the CLI-direct-invocation verification method itself, not a bug in the route; use the live-server method (above) for anything that reads `$_GET`.
- `scripts/check-repo-hygiene.sh`: all 4 checks pass.
- Frontend (unaffected by this bug's own fix, verified anyway since other files in this session's commit touch it — see Technical Debt note below): clean `npm ci` from a fresh `node_modules` against the regenerated lockfile, `npx tsc --noEmit` clean, `npx expo export --platform web --clear` succeeds.
- **Not done**: `make build-deploy` / full artifact-check pass was not re-run after this specific fix in this session (time budget) — the constituent pieces (backend regression, frontend build, hygiene check) were each verified independently instead. Next session or CI's own run of `build-test-publish.yml` will exercise the full assembly; nothing in this fix touches artifact-assembly-sensitive paths (no new files, no new `require` targets), so risk is low, but this is a real gap in evidence level, not an oversight to hide.

**NOT DONE / open — read before assuming this is closed**:
1. **The actual reason the token exchange is failing is still not identified.** This session made it visible; it did not see it. No host/browser access from this sandbox, same wall as every SSO bug before it.
2. Do not guess-fix the wrong-secret-type hypothesis (or any other candidate above) without the `auth_error_description` text confirming it — same standing rule this project has applied consistently since BUG-037.
3. Google's callback path is untouched-but-identical (same fix applied for consistency, per this project's established habit) — still completely unexercised; Mahdi has only ever attempted Microsoft.
4. Not deployed at commit time — source-only commit, per the mandatory source/deployment separation rule. CI publishes to `macerti/duration_calculator` on push to `main`.

**Next step — the one thing that makes this fast to finish**: retry Microsoft sign-in once this ships (confirm the publish workflow completed first — see `docs/DEV_STATUS.md`), and report the exact `auth_error_description` text now shown in the banner (or, if reachable, the matching `[duration_calculator] Microsoft OAuth error: ...` line in the PHP error log — either is decisive). Do not re-derive the candidates above from scratch; they're fully listed here, ready to be confirmed or eliminated by that one piece of evidence, exactly the pattern BUG-037→BUG-038 already used successfully twice.

**Dependency / hand-off**: nothing further is actionable on BUG-039 from a sandbox. If the next session has host/PHP-error-log access before Mahdi reports back, checking the log directly is equally decisive and faster than waiting for another UI round-trip.

---

**UPDATE 2026-09-03 (nineteenth session) — ROOT CAUSE CONFIRMED, fix applied.**

Mahdi retried with 5.1.6's diagnostic fix live and reported the exact `auth_error_description` text this entry asked for:

```
Microsoft Graph did not return required user fields: {"error":{"code":"Authorization_RequestDenied","message":"Insufficient privileges to complete the operation.","innerError":{"date":"2026-09-03T11:44:00","request-id":"5778c7a7-a717-41a9-b0b6-5a2eda85d0f3","client-request-id":"5778c7a7-a717-41a9-b0b6-5a2eda85d0f3"}}}
```

**This is decisive and fully explains everything, no further guessing needed**:
- The token exchange **succeeded** (we have a valid access token — this rules out the wrong-client-secret hypothesis for good; a bad secret fails at the token-exchange step and never reaches the Graph call).
- The subsequent call to `https://graph.microsoft.com/v1.0/me` was rejected by Graph itself with `Authorization_RequestDenied` / "Insufficient privileges to complete the operation." — a Graph API authorization error, not a network or transport failure.
- Reading `microsoftBuildAuthUrl()` in `MicrosoftOAuth.php` immediately explains why: the `/authorize` request's `scope` parameter was `openid profile email` — the three standard **OIDC** scopes. These control what claims land in an *ID token*; they are **not** a Microsoft Graph API permission. Calling Graph's `/me` endpoint requires the access token to separately carry a Graph permission — at minimum `User.Read` — which was never requested at authorization time. So the access token obtained was, from Graph's point of view, authorized for nothing.
- **This is a well-known, easy-to-fall-into Microsoft-specific trap**, and specifically *not* a Google issue: cross-checked `GoogleOAuth.php`'s equivalent flow this session — Google's `https://www.googleapis.com/oauth2/v3/userinfo` endpoint *does* accept the plain OIDC `profile`/`email` scopes directly (that's the standard, documented behavior of Google's own OIDC userinfo endpoint). No parallel bug exists there; left unchanged.

**Fix applied**: `microsoftBuildAuthUrl()`'s scope string is now `openid profile email User.Read`. Verified by actually building the authorization URL with test inputs and decoding its query string — `scope=openid+profile+email+User.Read` is present and correctly encoded.

**Hardening**: `useAuth.ts`'s known-cause-hint mechanism (built for BUG-038's `AADSTS9002325`) now also recognizes `Authorization_RequestDenied` and points directly at this fix, so a future regression (e.g. someone edits the scope back, or this mistake gets repeated for a different Graph field) is immediately actionable from the banner alone.

**What this does NOT rule out, in the interest of not overclaiming**: `User.Read` is normally either pre-consented or consentable by any user in Azure Portal's default configuration, so this fix is very likely sufficient on its own. However, a small number of Entra tenants are configured to require **admin consent** even for baseline permissions like `User.Read` (via stricter "user consent settings" or Conditional Access policies) — if that's the case for this tenant, Mahdi may now see Microsoft's own "need admin approval" consent screen instead of our error banner, which would be a clearly different, self-explanatory, provider-rendered message (not something this app produces or could suppress) rather than a reappearance of this bug. Noting this now so it isn't mistaken for a fix failure if it happens.

**Verification this session**: `php -l` clean on the touched files; built-and-decoded-URL check above; full regression `php tests/smoke_test.php` 24/24, `php tests/http_api_test.php` 16/16 against a live `php -S` instance (backend logic elsewhere is completely unaffected by a scope-string change, but re-ran anyway per this project's standing full-regression habit); `scripts/check-repo-hygiene.sh` clean; frontend `npx tsc --noEmit` clean, `npx expo export --platform web --clear` succeeds, and the new `Authorization_RequestDenied` hint string confirmed present in the actual built JS bundle via grep (same method the sixteenth session used to confirm its fix shipped for real, not just compiled-and-hoped).

**This session cannot complete a real browser OAuth round-trip** — the fix is a precise, code-level match for the exact reported error and standard, well-documented Microsoft Graph behavior, not a guess, but per this project's own standing rule, **Mahdi's next retry is still the actual confirmation**.

**Next step**: retry Microsoft sign-in once this ships (confirm the publish workflow completed first). If sign-in now completes end to end, close BUG-039 for real (not just "fix applied, awaiting confirmation") and mark BUG-036→039 as a fully closed SSO saga in `docs/DEV_STATUS.md`. If a *different* error appears (e.g. an admin-consent screen), that is new evidence for a note here, not a reason to reopen this diagnosis — see the admin-consent caveat above.

**Dependency / hand-off**: nothing further is actionable on BUG-039 from a sandbox until Mahdi's retry result comes back. Do not re-touch `MicrosoftOAuth.php`'s scope or re-derive this reasoning without new evidence contradicting it.

---

**UPDATE 2026-09-03 (twentieth session) — CLOSED. Mahdi confirmed: "The Microsoft SSO works perfectly."**

This is the real end-to-end confirmation this entry has been waiting on since the nineteenth session — sign-in now completes successfully for Mahdi in production. Per the "Next step" note directly above, **BUG-039 is CLOSED**, and per the eighteenth/nineteenth sessions' own hand-off instruction, **the entire BUG-036→037→038→039 SSO saga is now a fully closed, resolved chain**. See `docs/DEV_STATUS.md`'s dated entry for this session for the consolidated saga summary and the current pipeline state now that this is no longer blocking.

**Note on the message immediately preceding this confirmation, for continuity**: earlier in this same session, Mahdi's message intended to report this retry result instead contained an unrelated voice-to-text transcription (a planning note about database migrations — see `FEAT-005`) pasted in the slot where the error/success text was expected. No `auth_error_description` or other retry evidence was received at that point, so no action was taken on BUG-039 from that message — it was correctly held open until this follow-up message supplied the actual result. Recorded here only so a future session doesn't go looking for a "reported error" in that earlier message and get confused; there wasn't one.

**Nothing left open on this bug.** Google's callback path (noted throughout this saga as "same fix applied for consistency, still unexercised") remains untested, but is now moot for near-term priority — see `docs/ROADMAP.md` FEAT-002: the Google button itself was removed from the login screen this same session, per Mahdi's explicit instruction, independent of this bug.



---

### BUG-040 — CI's "Run database migrations" step fails on every run: `migrate.php` never actually reads its own config file

**Status: FIX APPLIED AND VERIFIED (two distinct sub-bugs, both confirmed via local reproduction). This was the trigger for the twenty-second session's investigation — see the session summary below and `docs/DEV_STATUS.md`'s twenty-second-session entry for the full arc (BUG-040 → 041 → 042 → 043, all found in one investigation, each layer only visible once the one before it was fixed).**

**Reported by**: Mahdi, after the twenty-first session pushed FEAT-005 (commit `51abb8c`, "feat(FEAT-005): implement automated database schema migration framework"): "The github action didn't work there is an error i think in db migrations."

**Confirmed via the GitHub Actions API, not assumed**: workflow run `33792762006` (job `100773069137`, same commit `51abb8c`) — step 9, "Run database migrations," is the first and only failing step. Steps 10 through 20 (smoke tests, HTTP API regression, frontend build/typecheck, artifact assembly, publish to `macerti/duration_calculator`) all report `status: skipped` as a direct consequence — **this single step failing meant commit `51abb8c` never reached the deployment repo at all**, not merely "the migration part didn't run."

**Tooling note for future sessions, recorded so this dead end isn't re-walked**: the GitHub Actions REST API's `/actions/jobs/{id}/logs` endpoint 302-redirects to a signed Azure Blob Storage URL (`productionresultssa8.blob.core.windows.net`), which is not in this sandbox's network allowlist (`bash_tool` egress) and is also refused by the `web_fetch` tool (it only fetches URLs that already appear as a prior search/fetch result — a URL captured from a `curl -D -` response header doesn't count, confirmed by testing it directly). **There is currently no way to pull raw GitHub Actions step output text from this sandbox.** What does work, and is enough to know *which* step failed: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` returns each step's name/status/conclusion as plain JSON, no redirect. For the actual error text, the working method (used this session) is local reproduction against the exact failing commit, not log-fetching — see environment note below.

**Environment note — first real MariaDB reproduction in this project's history**: this sandbox had neither PHP nor MariaDB preinstalled. Installed via `apt-get install php-cli php-mysql mariadb-server mariadb-client`, yielding PHP 8.3.6 and **MariaDB 10.11.14** — the actual version CI's `mariadb:10.11` service image runs, not the MySQL 8.0.46 stand-in every prior session touching the database (per their own repeated caveats, e.g. BUG-039's verification section: "no bit-for-bit MariaDB reproduction has been done in any session to date") had to settle for. This is the first session where the local reproduction and CI's actual database engine are the same product and the same major version. DB/user replicated exactly per `.github/workflows/build-test-publish.yml`'s service block: database `audit_test`, user `audit`/`audit`, host `127.0.0.1:3306`.

**New sandbox-persistence gotcha confirmed for `mariadbd` specifically, via `service mariadb start`** (the existing documented gotcha, e.g. BUG-039's note, was about a backgrounded `php -S`; this confirms the identical failure mode for a `service`-managed MariaDB daemon too): a `service mariadb start` in one tool call reports success and answers `mysqladmin ping`, but the daemon does not survive past that single tool call/shell invocation — the very next call gets `ERROR 2002 (HY000): Can't connect to server`. Data in `/var/lib/mysql` itself does persist across calls (the filesystem isn't reset, only running processes are killed), so this is purely about the daemon process, not the data. Workaround, identical in spirit to the established `php -S` one: `service mariadb start && sleep 3 && <everything that needs the DB>` in one single shell invocation, never split across tool calls.

**Root cause, sub-bug (a) — confirmed by reading `db/migrate.php` line-by-line, not guessed**: the script did:
```php
require_once $configPath;
if (!isset($config) || !is_array($config)) { ...exit(1)... }
```
But `config.php` (and `config.example.php`) — like every other config consumer in this codebase, e.g. `db/pdo.php`'s `loadConfig()` — use `return [...]` at file scope. `require_once` without capturing the return value discards it entirely; the file never sets a variable literally named `$config`, so `isset($config)` is unconditionally `false`. **This check fails on every single invocation, in CI and on a real production host alike, regardless of whether config.php's actual content is valid.** Reproduced locally: `php db/migrate.php` against a verified-working DB connection (confirmed separately via a standalone PDO ping) still printed `❌ ERROR: Invalid config.php — missing or malformed $config array` and exited 1, before ever attempting to connect.

**Root cause, sub-bug (b) — only visible once (a) was fixed and the script reached its DB-connection code**: the DSN/credentials block read `$config['db']['pass'] ?? ''`, but every config file in this codebase uses the key **`password`**, not `pass` (confirmed against `config.example.php` and `db/pdo.php`'s `getPdo()`). This silently connects with an **empty password** instead of throwing a clear "missing config key" error. Reproduced locally: after fixing (a) only, the exact next failure was `SQLSTATE[HY000] [1045] Access denied for user 'audit'@'localhost' (using password: NO)` against a database where the `audit`/`audit` credentials were independently confirmed correct via a raw `mariadb -uaudit -paudit` connection in the same test.

**Fix applied** (`src/backend/db/migrate.php`):
- `$config = require_once $configPath;` — capture the return value.
- `$config['db']['password'] ?? ''` — correct key name.
- Added `PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true` to the connection options at the same time, as defense-in-depth for BUG-042 below (found moments later in the same debugging pass; documenting it here too since it's the same block of code).

**Verified**: with both fixes applied, `migrate.php` gets past config loading and the DB connection cleanly (confirmed via `--check` mode reaching `getStatus()` successfully) — this exposed BUG-041 next, which was a distinct, deeper bug already present and waiting behind this one.

**Not done / open**: none for this specific bug — both sub-bugs are fixed and the fix is confirmed to get the script past this point. The overall migration run does not yet succeed end-to-end; see BUG-041/042/043 below and `docs/DEV_STATUS.md`'s twenty-second-session entry for the current combined state.

---

### BUG-041 — `Migrations.php` crashes with "There is no active transaction" on every DDL migration, because MySQL/MariaDB DDL statements auto-commit and silently end the PDO transaction

**Status: FIX APPLIED, VERIFIED to eliminate this specific crash (confirmed the code now reaches further than before); NOT yet confirmed as part of a fully successful end-to-end migration run — see BUG-043, found immediately afterward in the same investigation.**

**Discovered while verifying BUG-040's fix** — not a separate report from Mahdi.

**Root cause, confirmed by reproduction, not guessed**: `applyMigration()` wraps each migration file in `beginTransaction()` / `commit()` / (on error) `rollBack()`. `db/migrations/001_initial_schema.sql` is DDL-heavy (4 `CREATE TABLE` statements plus several `ALTER TABLE`s). MySQL/MariaDB DDL statements each trigger an **implicit COMMIT** on the server, ending whatever transaction was open — this is standard, well-documented MySQL/MariaDB/InnoDB behavior, not a bug in the server. PDO's MySQL driver (`pdo_mysql`, via mysqlnd) tracks the server's *real* transaction-status flag rather than just its own client-side bookkeeping, so it correctly notices the implicit commit — which means the later explicit `$this->pdo->commit()` call correctly throws `PDOException: There is no active transaction`, because by that point there genuinely isn't one.

Reproduced locally against a fresh `audit_test` database (BUG-040's fixes applied): `php db/migrate.php` got past config/connection and printed `❌ Migration failed: Migration 001_initial_schema.sql failed: There is no active transaction`, with the 4 application tables actually created (confirmed via `SHOW TABLES`) but the `migrations_metadata` row never recorded — i.e. the DDL itself succeeds; only the transaction bookkeeping around it is broken.

**Important implication, not just a crash fix**: this means the "atomic per-migration transaction" the framework promises never actually existed for any DDL-containing migration — which is most of what a schema-migration tool is for. This is a hard MySQL/MariaDB limitation (DDL is not fully transactional the way it is in, say, PostgreSQL), not something a PHP wrapper can paper over. Recorded explicitly in code comments so a future session doesn't try to "fix" this by making the transaction "really" atomic — it can't be, for DDL, on this database engine.

**Fix applied** (`src/backend/db/Migrations.php`, `applyMigration()`): guard both `commit()` and `rollBack()` with `if ($this->pdo->inTransaction())`. Since `inTransaction()` reflects the real server status (see above), it correctly returns `false` once DDL has already closed things out, and the guarded call is skipped instead of throwing. The `INSERT INTO migrations_metadata` recording success now runs as its own auto-committed statement, explicitly documented as being outside any real transaction boundary at that point — because, per the paragraph above, there usually isn't one left. Safety for partial-failure states comes from writing migrations to be idempotent (`IF NOT EXISTS` / `information_schema` guards), which this codebase already does throughout `001_initial_schema.sql` — not from transactional rollback.

**Verified**: re-ran against a fresh DB; the "There is no active transaction" crash is gone, and execution proceeds further into the statement loop than before. This immediately surfaced BUG-042 (below) as the next blocker — found in the same test run, not a new report.

**Not done / open**: the overall migration still does not complete successfully at this point in the investigation — see BUG-042 and BUG-043.

---

### BUG-042 — `isAlreadyApplied()` leaves its statement handle open, stranding the connection for the very next query

**Status: FIX APPLIED AND VERIFIED to resolve this specific failure mode (confirmed the exact error text disappears and execution proceeds further). Found and fixed in the same investigation as BUG-040/041/043 — see `docs/DEV_STATUS.md`'s twenty-second-session entry for the full chain.**

**Discovered while re-testing after the BUG-041 fix** — with the transaction-guard fix in place, the very next `php db/migrate.php` run against a fresh database failed with a new, different error: `SQLSTATE[HY000]: General error: 2014 Cannot execute queries while other unbuffered queries are active. Consider using PDOStatement::fetchAll(). Alternatively, ... enable query buffering by setting the PDO::MYSQL_ATTR_USE_BUFFERED_QUERY attribute.`

**Root cause, confirmed via a standalone reflection-based debug script that ran the real migration statement-by-statement and printed the connection's transaction state after each one** (kept as a reusable diagnostic technique, not just a one-off — see `docs/DEV_STATUS.md` for where the script's approach is described in case a similar issue needs isolating again): `run()` calls `isAlreadyApplied($migrationName)` for each candidate migration before applying it. That method does:
```php
$stmt->execute([$migrationName]);
$result = $stmt->fetch(\PDO::FETCH_ASSOC);
return ($result['cnt'] ?? 0) > 0;
```
`fetch()` is called exactly once against a `SELECT COUNT(*)` (always exactly one row), but `closeCursor()` is never called afterward. The statement handle is left "active" on the connection from the driver's perspective. The very next query on that same connection — `beginTransaction()`'s `START TRANSACTION` — then fails with MySQL error 2014.

**Fix applied** (`src/backend/db/Migrations.php`, `isAlreadyApplied()`): added `$stmt->closeCursor();` immediately after the `fetch()` call. Also added `PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true` to `migrate.php`'s PDO connection options as defense-in-depth (documented under BUG-040 above, since it's the same code block), so a future forgotten `closeCursor()` elsewhere in this framework doesn't strand the connection the same way.

**Verified**: re-ran against a fresh database; the 2014 error at this specific point is gone, and `getStatus()` (`--check` mode, which also does a `fetch()`-based query) continues to work correctly on repeat calls, confirming the fix doesn't just move the problem elsewhere within that method.

**Not done / open**: a *different* instance of the same underlying error class (2014) appeared next, deeper in the migration file's own SQL — not from this method. See BUG-043.

---

### BUG-043 — the idempotent-guard SQL pattern documented as this project's official template for *all future migrations* breaks the connection the moment its "nothing to do" branch fires

**Status: CLOSED — FIXED AND VERIFIED END-TO-END, both locally and on real GitHub Actions CI. See the 2026-09-04 (twenty-third session) update at the end of this entry for the full verification record.**

**Discovered while re-testing after the BUG-042 fix** — the exact same MySQL error 2014 as BUG-042 reappeared, but at a later statement, with `isAlreadyApplied()` no longer implicated (already fixed and separately confirmed working — see above). This is a **different root cause that happens to produce an identical symptom**, not a recurrence of BUG-042. Pinned down precisely using a purpose-built debug script (`/tmp/debug_migrate.php`, not committed — a throwaway diagnostic, described here so a future session can rebuild the same technique instead of re-deriving it) that executed the real, unmodified `001_initial_schema.sql` statement-by-statement via reflection into the real `Migrations` class, printing `inTransaction()` state after every single statement: statement `EXECUTE stmt_idx` succeeded; the very next statement, `DEALLOCATE PREPARE stmt_idx`, is what failed.

**Root cause, confirmed by isolated minimal reproduction, not guessed — and confirmed to require the *exact* real-file condition, not just "PREPARE/EXECUTE/DEALLOCATE in general"**: `001_initial_schema.sql` contains, around line 84–110, two sequential idempotent guards for `calculation_cases`:
1. First guard (line ~84): checks whether the `client_id` column exists; if not, runs one combined `ALTER TABLE calculation_cases ADD COLUMN client_id ..., ADD CONSTRAINT fk_calculation_cases_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE, ADD KEY idx_calculation_cases_client_id (client_id)` — **this single ALTER already creates the index**, as one of three clauses bundled into it.
2. Second guard (line ~99, its own comment says "ensures the index exists even if added in a partial prior migration" — a legitimate defensive intent, not dead code by design): separately checks whether `idx_calculation_cases_client_id` exists. On a fresh database, by the time this check runs, the first guard has *already* created that index two statements earlier — so this check's condition is false, and its dynamically-built SQL resolves to the documented no-op placeholder, `'SELECT 1'`, which is then run via `EXECUTE stmt_idx`.

**The actual bug**: `applyMigration()`'s statement loop ran every statement — DDL, `SET`, `PREPARE`, `EXECUTE`, `DEALLOCATE`, all of it — through `$this->pdo->exec($trimmed)`. `PDO::exec()` is documented as being for statements that do not return a result set. When the dynamically-prepared statement `EXECUTE`s turns out to be `SELECT 1` (exactly the case above), it *does* return a result set, `exec()` leaves it unconsumed, and the connection is stuck — the next statement (`DEALLOCATE PREPARE`) fails with error 2014. Confirmed by two isolated repros: (1) a trivial two-round PREPARE/EXECUTE/DEALLOCATE test using only literal DDL strings did **not** reproduce the failure — ruling out "PREPARE/EXECUTE/DEALLOCATE is just fragile in general"; (2) a minimal repro that specifically set `@sql_idx := 'SELECT 1'` (i.e. deliberately forcing the no-op branch) and ran the identical three statements reproduced the exact error on the `DEALLOCATE` step every time.

**This is a structural problem, not a one-off typo**: `db/migrations/README.md` documents this exact PREPARE/EXECUTE/DEALLOCATE-with-`'SELECT 1'`-placeholder pattern as the recommended, production-ready template for **every future migration's** idempotent guards (per the twenty-first session's own implementation summary: "four production-ready idempotent SQL patterns ... ADD INDEX guard"). Left as-is, this bug would resurface in any future migration whose guard condition is already satisfied at execution time — which, by definition, is the *normal, common* case for an idempotent re-run (the entire point of idempotent guards is that most of them are no-ops most of the time). This is not a rare edge case; it is closer to the typical case once a schema has been migrated once.

**Fix applied** (`src/backend/db/Migrations.php`, `applyMigration()`'s statement loop, framework level — covers the underlying mechanism for every migration, not just this one file): changed the executor from `$this->pdo->exec($trimmed)` to `$this->pdo->query($trimmed)` followed by `$stmt->closeCursor()` when a `PDOStatement` is returned. `query()`+`closeCursor()` correctly drains a result set regardless of whether the statement is DDL/DML (no result set — `closeCursor()` is a harmless no-op) or an accidental `SELECT` (result set gets fully consumed and closed), so this is safe for every statement type this migration runner will ever see, not just this specific `'SELECT 1'` pattern.

**Deliberately NOT done this session, flagged as the clear next step rather than silently left out**: a content-level defense-in-depth fix — replacing the five `'SELECT 1'` no-op placeholders in `001_initial_schema.sql` (and the equivalent placeholder in `db/migrations/README.md`'s template, so future migrations copy the corrected version) with a statement that structurally can never return a result set, e.g. MariaDB/MySQL's `DO 0` — was identified as the right complementary fix but **was explicitly not applied**, per this session's instruction to stop making further code changes and document state instead. The framework-level `query()`+`closeCursor()` fix above should make this unnecessary in principle (it handles a stray `SELECT` safely either way), but that claim has **not been re-verified end-to-end** — see below.

**NOT DONE / open — this is the most important paragraph in this whole update, read it before assuming migrations work**:
1. **The `query()`+`closeCursor()` fix has NOT been re-run through the actual `migrate.php` CLI against the real `001_initial_schema.sql` file.** Its correctness is currently established only via (a) the isolated minimal repro confirming the general mechanism (a raw PDO script calling `query()`+`closeCursor()` on a forced `'SELECT 1'` case did not reproduce error 2014), and (b) code review of the applied diff. **It has not been confirmed against this project's own actual, real-world testing standard** (`docs/ORIENTATIONS.md`: verify against the actual artifact/real execution path, not just reasoning about the diff) **for this specific bug**. This is a real, acknowledged gap, not an oversight being hidden.
2. **Next session's first step should be exactly**: fresh `audit_test` database → `php db/migrate.php` (expect full success, all statements including both guard blocks) → `php db/migrate.php` again (idempotence check — second run should skip the already-applied migration entirely and exit cleanly) → `php seed.php` → then the full existing regression suite (`php tests/smoke_test.php`, `php tests/http_api_test.php` against a live `php -S` instance — remember the established single-shell-invocation workaround for both `mariadbd` and `php -S` backgrounding, see BUG-040's environment note above) → `scripts/check-repo-hygiene.sh`.
3. **If that full run succeeds**: apply the deferred `'SELECT 1'` → `DO 0` content fix as defense-in-depth (both in `001_initial_schema.sql` and the `README.md` template — do this even if step 2 passes, since relying solely on the framework catching an accidental SELECT everywhere, forever, is weaker than simply not producing one), re-verify once more, then commit, push, and watch the actual GitHub Actions run this time (job/run IDs via the Actions API method documented under BUG-040) to confirm the real CI environment agrees with local reproduction.
4. **If step 2 still fails**: the `query()`/`closeCursor()` fix's assumption needs revisiting — check whether the *same* failure mode appears, or a new one, and treat it as a fresh investigation rather than assuming BUG-043 "should" be fixed.
5. **Nothing from this session (BUG-040 through BUG-043) has been pushed yet at the time this entry was written.** `git status` at that point showed exactly two modified files: `src/backend/db/migrate.php` and `src/backend/db/Migrations.php`. `001_initial_schema.sql` and `migrations/README.md` are unmodified. This is being committed and pushed now as **documentation plus the fixes-so-far**, per explicit instruction, to make sure the analysis and the precise remaining gap are not lost, even though the fix is not yet proven end-to-end. **Do not tell Mahdi migrations are fixed until step 2 above has actually been run and passed.**

**Dependency / hand-off**: entirely actionable by the next sandbox session — no host/browser access or live evidence needed, unlike the SSO saga above. Everything required to finish this is either already in this repo or described precisely in this entry.

---

**2026-09-04 (twenty-third session) — CLOSED. Full re-verification done, plus real CI confirmation, plus the deferred content-level fix.**

**First finding, worth recording precisely**: before doing any new work, this session checked the GitHub Actions REST API `/actions/runs` endpoint for the current `main` HEAD (`7736577`, the twenty-second session's own push) and found **it had already gone green on its own** — run `33837469083`, all 20 real steps `completed`/`success`, including step 9 "Run database migrations," ending in a successful publish to `macerti/duration_calculator`. So the framework-level `query()`+`closeCursor()` fix from the previous entry above was, in fact, already sufficient in the real CI environment — the "not yet re-verified end-to-end" caveat this entry carried was accurate at the time it was written, but had already been overtaken by a real green run by the time this session started. Recorded here so nobody has to re-discover this by re-running CI from scratch.

**Local re-verification performed anyway** (per this entry's own step-2 instructions, and because CI passing doesn't substitute for the documented local idempotence check): fresh sandbox, `apt-get install php-cli php-mysql mariadb-server mariadb-client` (PHP 8.3.6 / MariaDB 10.11.14, matching CI exactly), `service mariadb start && sleep 3` in the same shell invocation as everything else (per this file's own established gotcha), `config.php` built byte-for-byte identical to the CI workflow's own heredoc (`host=127.0.0.1`, `audit_test`/`audit`/`audit`, `debug: true`). Full sequence, all in one shell invocation:
1. `php db/migrate.php` on a fresh DB → `Applied: 1 new, Skipped: 0` ✅
2. `php db/migrate.php` again → `Applied: 0 new, Skipped: 1 (already applied)` — idempotence confirmed ✅
3. `php seed.php` → seeded `default-v1` ✅
4. `php tests/smoke_test.php` → **24 passed, 0 failed** ✅
5. `php -S` + `/health` → `{"status":"ok",...,"dbConnected":true}` ✅
6. `php tests/http_api_test.php` → **16 passed, 0 failed** (this needed `php-curl` and `php-mbstring` installed too — both missing initially in this fresh sandbox; not app bugs, just sandbox extension gaps, matching CI's own `extensions: pdo_mysql,mbstring,curl` setup-php step) ✅
7. `scripts/check-repo-hygiene.sh` → all 4 checks pass ✅

**Deferred content-level fix, now applied**: replaced all 5 occurrences of the `'SELECT 1'` no-op placeholder in `001_initial_schema.sql`'s idempotent guards, and all 8 occurrences in `db/migrations/README.md`'s template/examples, with `'DO 0'` — a statement that structurally can never return a result set, removing the dependency on `query()`+`closeCursor()` correctly draining an accidental `SELECT` in every future migration that copies this template. Confirmed by `grep` that zero `'SELECT 1'` occurrences remain in either file. **Re-ran the entire 7-step sequence above a second time, against a freshly dropped-and-recreated `audit_test` database, with this content fix in place** — identical results (1 new/0 skipped → 0 new/1 skipped → seed OK → 24/24 → 16/16 → hygiene clean). This is not a redundant re-check: it confirms the content fix didn't change behavior (as intended — it's defense-in-depth, not a behavior change) rather than just assuming it based on the framework-level fix alone.

**Not done / open**: none for BUG-040 through BUG-043 — all four are now fixed, locally re-verified twice (once framework-fix-only, once with the content fix added), and confirmed green on real GitHub Actions CI. FEAT-005 (see `docs/ROADMAP.md` item 8 and `docs/DEV_STATUS.md`) can now be marked done rather than CI-blocked. The one remaining FEAT-005-adjacent item is **not a bug**: the HTTP API endpoint (`POST /api/migrate`) mentioned as a future enhancement in `db/migrations/README.md` was never implemented and isn't needed for the current CLI-via-CI flow — leave it as a backlog idea, not a defect.

**Files changed this session for this fix**: `src/backend/db/migrations/001_initial_schema.sql`, `src/backend/db/migrations/README.md` (both: `'SELECT 1'` → `'DO 0'` only, no other changes). `Migrations.php` and `migrate.php` are unmodified from the twenty-second session's already-verified fix.

---

### BUG-044 — CI red on commit `f45129d`: repo-hygiene "stale path" check trips on an unrelated MIME boundary string in the new `Mailer.php`, plus a real gap in this session's own pre-push verification order

**Status: CLOSED — FIXED AND LOCALLY VERIFIED END-TO-END. See the 2026-09-04 (twenty-sixth session) update at the end of this entry for the full verification record and the real-CI confirmation once observed.**

**Discovered**: immediately after pushing the twenty-fifth session's auth/RBAC wiring commit (`f45129d`, see `docs/DEV_STATUS.md`), polling the triggered GitHub Actions run showed `conclusion: failure`. Per-job step listing showed the failure at the very first real step, **"Repository hygiene checks (Work Package G)"** — every step after it shows `skipped`, meaning nothing about the actual auth/RBAC code, the migration, or the HTTP regression suite ran at all; CI never got that far.

**Root cause, confirmed precisely, not guessed**: `scripts/check-repo-hygiene.sh`'s check 4 scans tracked non-Markdown files for the regex `audit-app|audit-mobile|duration-calculator-php|audit-engine` (leftover pre-restructure path names — see that script's own header comment). `src/backend/auth/Mailer.php` line 142 reads:
```php
$boundary = 'audit-app-' . bin2hex(random_bytes(8));
```
— an arbitrary MIME multipart boundary prefix, chosen for this feature with no connection whatsoever to the old `audit-app/` pre-restructure folder name; it just happens to contain that exact substring. Confirmed via a fresh clone of the repo at `f45129d` (not the long-lived sandbox working directory — see the verification-order gap below) followed by `grep -inE 'audit-app|audit-mobile|duration-calculator-php|audit-engine' src/backend/auth/Mailer.php`, which returns exactly and only this one line.

**Fix needed (not yet applied)**: rename the boundary prefix in `Mailer.php` (`sendMailViaSmtp()`) to anything that doesn't contain `audit-app` — e.g. `'mail-boundary-'` or `'ddc-mail-'` — then re-run `scripts/check-repo-hygiene.sh` against the committed/tracked state (see verification-order note below) to confirm green, then re-check `check-deploy-artifact.sh` too since it shares infrastructure with the hygiene script. This does not require re-running the HTTP/smoke test suites — they're unaffected by a comment/string-literal rename — but re-running them anyway costs little and matches this project's own standing discipline.

**A real gap in this session's own process, worth fixing in habit, not just in code**: `scripts/check-repo-hygiene.sh` was run twice this session and reported "ALL CHECKS PASSED" **both times** — but both runs happened *before* `git add`/`git commit`, while `Mailer.php` was still an untracked file. Check 4 iterates over `git ls-files` (tracked files only), so it silently skipped the one file that would have failed. The false "all clear" wasn't a bug in the check itself — it did exactly what it's documented to do (scan tracked files) — it was this session running it at the wrong point in the sequence. **The correct order, going forward**: `git add -A` (or at least stage the new files) *before* running `check-repo-hygiene.sh`, or better, run it against a fresh clone of the exact commit about to be pushed (as this entry's own root-cause confirmation did) rather than the working tree at all. `make build-deploy` + `check-deploy-artifact.sh` were run correctly relative to this same risk in this session (the deploy artifact is assembled from the working tree's actual file contents regardless of git tracking state, so that check wasn't affected) — it's specifically `check-repo-hygiene.sh`'s tracked-files-only scan that this gotcha applies to.

**Not done / open**:
1. The one-line rename in `Mailer.php` itself.
2. Re-verification against a fresh clone (not the working tree) of the fixed commit: `check-repo-hygiene.sh` green, then the full local sequence this project already has standing (`smoke_test.php`, `http_api_test.php` against a live server, `make build-deploy` + `check-deploy-artifact.sh`) — the code these checks exercise did not change, but re-running them costs little and this project's own convention is to re-confirm rather than assume a small fix has no side effects.
3. Push the fix, then **watch the actual triggered GitHub Actions run to completion** (per this file's own established API-polling method, see BUG-040's environment note and the twenty-third session's entry above) rather than assuming green from local reproduction alone — the whole reason this bug exists is that a local pass didn't guarantee a real-CI pass.
4. Once green: update `docs/DEV_STATUS.md`'s twenty-fifth-session entry (or add a short dated follow-up note to it, matching how the twenty-fourth session's entry was later appended with a CI-confirmation note) to record the real green run's ID, closing the loop the way BUG-040 through BUG-043 were closed above.

**Dependency / hand-off**: entirely actionable with no host/browser access needed — everything required is in this entry. Do not tell Mahdi the twenty-fifth session's backend work is CI-confirmed until this is fixed and a real green run has been observed; as of this writing, `main` is red on `f45129d`.

**2026-09-04 (twenty-sixth session) update — fix applied, verified locally end-to-end, pushed**:
- Applied the exact one-line fix this entry already specified: `src/backend/auth/Mailer.php` line 142, `'audit-app-'` → `'ddc-mail-'`.
- First reproduced the failure locally (against the committed `f45129d`/`e749594` state, before touching anything) to confirm the documented root cause precisely — `scripts/check-repo-hygiene.sh` failed with exactly `FAIL: stale pre-restructure references found in: src/backend/auth/Mailer.php`, nothing else.
- This sandbox had neither PHP nor MariaDB either (same starting point as BUG-040's session): installed PHP 8.3.6 + MariaDB 10.11.14 via `apt-get`, i.e. the same MariaDB major/minor CI's `mariadb:10.11` service image runs.
- Re-ran the full standing local sequence against the fix, in the correct order this entry itself called for (staged/tracked state, not an unstaged working tree): `check-repo-hygiene.sh` (4/4 pass) → fresh-DB `migrate.php` (2 new, 0 skipped) → `migrate.php` again (0 new, 2 skipped — idempotence confirmed) → `seed.php` → `smoke_test.php` (24/24) → live `php -S` + `/health` (`dbConnected: true`) → `http_api_test.php` (**42/42**, including the auth/RBAC/CSRF suite added two sessions ago) → `npm ci` → `npx tsc --noEmit` (clean) → `npx expo export --platform web` (succeeds) → full `_deploy` artifact assembly per the workflow's own recipe → `check-deploy-artifact.sh` (all 4 checks pass). Confirmed `check-deploy-artifact.sh` has no overlapping stale-path scan of its own (`grep` for the pattern returns nothing in that script), so it was never at risk from this bug — matches this entry's own prediction.
- Also closed the adjacent documentation gap this bug exposed: `config.example.php` had no `'mail'` key at all even though `Mailer.php` (added two sessions ago) already documents the shape it expects in its own header comment — added the commented-out template so a developer copying `config.example.php` to `config.php` sees where SMTP settings go instead of having to read `Mailer.php`'s source to find out.
- **CI confirmed green**: pushed as `b4bad0d`. Actions run `33927539078` — conclusion `success`, all 20 real steps green including "Repository hygiene checks" (previously failing) and "Publish deployment artifact" (confirms the artifact reached `macerti/duration_calculator`). BUG-044 is genuinely closed.
- **Not done / open**: the process-gap lesson this entry already named (run hygiene checks against staged/committed state, not an unstaged working tree) — recorded here as a lesson, not as a code change; there's no code fix for a verification-habit gap. Real SMTP credentials for `info@macerti.com` are still needed before the `smtp` driver can be trusted live — see `config.example.php`'s new `'mail'` block and `docs/DEV_STATUS.md`'s twenty-fifth-session entry for what Mahdi needs to supply.

---
