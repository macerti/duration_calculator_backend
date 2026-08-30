# Changelog — audit-app (deployable project)

Same versioning convention as the other projects: **x** = overhaul, **y** = feature, **z** = bugfix.

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
