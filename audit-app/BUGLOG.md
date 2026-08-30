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

## Open / not yet hit
_(first real deploy to the actual DirectAdmin host is still next. Also open:
empirical confirmation of BUG-010's fix, and visual confirmation of the
report screen, the shake animation, the undo toast's progress bar, the new
site/siège labeling, and the synergy matrix UI in an actual browser — all
blocked on tooling availability in this sandbox, not skipped by choice, see
ROADMAP.md)_
