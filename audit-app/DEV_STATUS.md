# CURRENT DELIVERY PRIORITY — 2026-09-01

## Mandatory pipeline

1. FEAT-003 — Versioning and update timestamp: IMMEDIATE.
2. Repository architecture consolidation: immediately after FEAT-003. Follow REPOSITORY_ARCHITECTURE.md; identify the source of truth before moving/deleting anything and preserve all formulas/business rules.
3. USER FEEDBACK / ACCEPTANCE GATE. After the first two items, pause normal feature development and perform real browser/mobile/user testing. Feed the results back into the logs to definitively close, reopen, or change the relevant bugs/features.
4. Remaining bugs. Resume only after the acceptance gate.
5. Remaining features. Resume after the acceptance gate. Admin/parameter administration UI is prioritized ahead of authentication/SSO.
6. FEAT-002 Microsoft/Google SSO: NOT PRIORITIZED. It remains documented but is explicitly deferred.

### Acceptance terminology
- USER-ACCEPTED — user confirms the behavior is satisfactory.
- REOPENED — user still observes the reported problem.
- NEW BUG — new reproducible defect.
- CHANGE REQUEST — implementation works but the desired UX/behavior changes.
- VERIFIED — technically verified but awaiting user/product acceptance where applicable.

Do not use older roadmap priority wording as the active priority. This dated decision is authoritative until explicitly replaced.

# Development Status — audit-app

> SINGLE SOURCE OF TRUTH FOR CONCURRENT DEVELOPMENT.
>
> Before changing code, read this file. Update it in the same commit as the work. This file records the latest verified state, what is open, what is blocked, and which work streams are independent or dependent.
>
> Status date: 2026-09-01 (fourth session — independent fresh-sandbox backend re-verification)
> Repository: macerti/duration_calculator_backend
> Active app: audit-mobile/
> Deployment/reference docs: audit-app/
> Deployment artifact: separate macerti/duration_calculator repository

## How to use this file

For every work session, record four things:

1. DONE / VERIFIED — exact files, behavior, commands/tests, and environment.
2. DONE / NOT EMPIRICALLY VERIFIED — code is changed and statically reviewed/typechecked, but the reported runtime symptom was not reproduced or browser/device confirmation is missing.
3. OPEN / NOT DONE — work has not been completed. Do not describe it as fixed.
4. DEPENDENCIES — state whether a task can proceed independently or must first consume the latest result from another work stream.

Do not turn an architectural hypothesis into a confirmed root cause. Record the evidence level explicitly.

## Current status

### BUG-004 — audit-mobile wizard save

Scope: initial draft creation and subsequent Enregistrer update.

#### DONE / VERIFIED

- Tested the exact initial draft-save payload emitted by the wizard on mount for a brand-new calculation: empty site, zero personnel, default ISO 9001 configuration.
- Sent that payload directly to POST /cases.
- Observed HTTP 201.
- Confirmed the response contained the expected calculation object.
- Therefore, the initial payload shape is not inherently invalid and must not be treated as the proven cause of the production first-save failure.
- **2026-09-01 (fourth session) — RE-VERIFIED independently, fresh sandbox, real PDO+SQL DB (not a repeat of the CI run's own output — a separate reproduction of it):** stood up PHP 8.3 + MySQL 8.0.46 (client-compatible stand-in for MariaDB 10.11 — see caveat below) from scratch against `duration-calculator-php/` (the actual deployed backend, not the legacy `audit-app/backend` copy), applied `db/schema.sql`, ran `seed.php`, started `php -S 127.0.0.1:8080 api/index.php`, and ran the exact CI regression command `php tests/http_api_test.php http://127.0.0.1:8080`. Result: **16/16 passed**, including `PUT /cases/:id updates case`, `PUT returns recalculated result`, `GET /cases/:id returns saved case` (input/status/rounding overrides all preserved), and `DELETE /cases/:id`. `php tests/smoke_test.php`: **24/24 passed**. `/health` reported `dbConnected:true`.
- **Therefore Symptom 2 (Enregistrer / PUT failure) backend path is now VERIFIED, not just CI-reported** — this closes the "NOT DONE" item below about testing PUT with a real DB, independently of trusting the earlier GitHub Actions run.
- **Caveat — do not over-claim**: this used MySQL 8.0 (Ubuntu's `default-mysql-server`), not MariaDB 10.11 as CI/production use. Behavior matched in every tested path here, but a MySQL/MariaDB dialect difference remains a theoretical gap versus a true MariaDB reproduction. Still no real DirectAdmin/Apache-topology test, and no browser/device test of the actual wizard UI performing these calls — only the raw HTTP contract is verified. If a production first-save failure is still reported after this, look at frontend request construction, cold-start timing, or DirectAdmin/Apache-specific behavior, not the PHP/DB persistence logic itself.

#### NOT DONE / OPEN

1. Reproduce the production first-call failure under conditions that could expose a transient/cold-start/network issue.
2. Instrument or otherwise expose the actual first POST /cases failure response/status when it occurs.
3. Add an explicit error state and retry strategy for initial draft creation; do not silently swallow the failure. (Per `audit-mobile/BUGLOG.md`, source changes for this were made in an earlier session — confirm the current `CalculationWizardScreen.tsx` still reflects that surfaced-error behavior before closing this item.)
4. ~~Test PUT /cases/:id using the exact payload generated by the wizard's Enregistrer action.~~ **DONE 2026-09-01 (fourth session) — see above.**
5. ~~Test the complete lifecycle: mount → POST draft → edit → calculate → PUT calculated case → reload/reopen.~~ **DONE 2026-09-01 (fourth session), at the HTTP-contract level (health → NACE → POST → PUT → GET → DELETE). Still open at the real-browser/device level.**
6. Distinguish backend failure, frontend request construction failure, transient transport failure, and race/lifecycle failure before assigning a final root cause. **Backend is now ruled out as a source of failure for well-formed requests; remaining candidates are frontend/transport/DirectAdmin-topology.**

Dependency: the PUT investigation is independent enough to start immediately. The first-POST investigation should use the evidence above and must not restart by assuming payload shape is broken, and should not re-run the HTTP regression suite again from scratch — it is now independently confirmed twice (CI + this session).

---

### New finding — NACE routes return 404 under PHP built-in dev server

Status: **RE-TESTED 2026-09-01 (fourth session) — NOT REPRODUCED.** Do not restart the SCRIPT_NAME/REQUEST_URI investigation below without first re-confirming the 404 actually still happens; it did not in two independent sessions now (the earlier CI-root-cause session, and this one).

#### DONE / VERIFIED

- Tested GET /nace/search?q=...
- Tested GET /nace/:code
- Both returned 404 Not found when tested against PHP's built-in development server. **(Original finding, since superseded — see below.)**
- Current working hypothesis: request path stripping is dropping the nace segment.
- Investigation reached the point of preparing a debug endpoint to expose SCRIPT_NAME and REQUEST_URI.
- That endpoint was intended to determine whether this is a PHP built-in-server/dev-server artifact (similar in class to BUG-003) or a genuine router regression.
- The investigation stopped before the debug endpoint was completed and before the cause was classified.
- **2026-09-01 (fourth session)**: fresh sandbox, `php -S 127.0.0.1:8080 api/index.php` (same PHP built-in dev server class as the original finding) against `duration-calculator-php/`. `GET /nace/search?q=...` → 200 with results. `GET /nace/01` → 200 with the expected code. Both are asserted by `tests/http_api_test.php`, which passed 16/16. **The 404 did not reproduce.** Whatever caused the original finding (router code at the time, or a since-fixed regression) is not present in the current `api/index.php`.

#### NOT DONE / DO NOT REPEAT

- No root cause for the *original* 404 was ever confirmed, and now likely never will be — treat it as fixed-by-a-later-change rather than root-caused, unless it resurfaces.
- No conclusion has been reached about whether production Apache/DirectAdmin routing (as opposed to the PHP built-in dev server, tested here) is affected — that gap is unchanged by this session.
- Do not mark NACE search/code lookup as currently broken. Do not re-open this as a mystery without a fresh reproduction; if it recurs, capture SCRIPT_NAME/REQUEST_URI at that time rather than assuming the old hypothesis still applies.

#### NEXT TEST SEQUENCE

1. Capture SCRIPT_NAME and REQUEST_URI at the PHP router boundary.
2. Log/return the exact path after every stripping step.
3. Test the two failing routes again.
4. Test a known-good route beside them.
5. Compare direct PHP-server behavior with the intended Apache .htaccess topology.
6. Only then classify as dev-server-only artifact or real routing regression.
7. If it is a real regression, identify the smallest topology-specific fix and run the full route smoke suite before changing shared routing code.

Dependency: NACE investigation is independent of BUG-004 PUT testing. It becomes co-dependent with any router/topology change: before touching shared routing, read BUG-003 and the topology notes in ORIENTATIONS.md.

## Concurrent work map

| Work stream | Status | Independent or dependent | Required hand-off |
|---|---|---|---|
| BUG-004 initial POST failure | Open (frontend robustness only — backend ruled out) | Independent | Preserve the verified fact that the minimal POST payload returns 201; focus on frontend retry/error-surfacing, not backend |
| BUG-004 PUT Enregistrer | **VERIFIED 2026-09-01 (fourth session), 16/16 HTTP regression, real DB** | Independent | Do not re-test this path again without new evidence of a regression |
| NACE 404 classification | **NOT REPRODUCED 2026-09-01 (fourth session)** — treat as resolved unless it recurs | Independent initially | If it recurs, capture SCRIPT_NAME/REQUEST_URI then, not from the old hypothesis |
| Router/topology changes | Not started for this finding | Dependent | Read BUG-003 + ORIENTATIONS.md; test both topology variants before syncing |
| Browser/device confirmation of wizard state fixes | Open | Independent from backend NACE work | Requires actual browser/device tooling — still not available in any sandboxed session to date |
| Real DirectAdmin deployment | Open | Dependent on core API stability | Must use deployment topology, not PHP built-in-server behavior alone (built-in-server path is now solidly verified — see above) |
| Authentication/rate limiting/security hardening | Open | Largely independent | Must be completed before real client data is treated as protected production data |
| FEAT-003 — version/last-update footer | **SOURCE-COMPLETE 2026-09-01 (this session) — see dated entry below** | Independent | Not yet deployed (source/deployment separation); not yet browser/device-VERIFIED (no browser tooling in this sandbox) |

## Standing test evidence

Do not lose the distinction between these environments:

- PHP built-in dev server: useful for local route/HTTP tests, but its request-path behavior can differ from Apache rewrite behavior.
- Local MariaDB + PHP HTTP integration: already used successfully in prior rounds and is the preferred environment for DB-backed integration tests.
- Real DirectAdmin host: not yet deployed/verified according to the current roadmap.
- Real browser/device: required for visual/interaction confirmation that static typechecks and bundle tests cannot establish.

### Evidence labels

Use these exact meanings:

- VERIFIED: observed in the relevant runtime/test environment.
- STATICALLY VERIFIED: typecheck/build/source inspection passed, but the runtime symptom was not reproduced.
- REPORTED: another developer/tester observed it; not independently reproduced in the current work.
- HYPOTHESIS: plausible explanation, not established.
- OPEN: not fixed or not classified.
- BLOCKED: cannot currently be tested because of a stated tooling/environment limitation.

## Update rule

Every developer changing behavior must update this file with: date; exact status; exact test performed; environment; result; remaining uncertainty; dependencies for the next developer.

If a later developer disproves an earlier finding, append the new evidence rather than silently rewriting history. The latest status must be unambiguous.

### 2026-08-31 work session — BUG-004 initial draft-save failure

**DONE / CODE CHANGED**
- Replaced the initial draft creation's silent `.catch(() => { ... })` behavior in `audit-mobile/src/screens/CalculationWizardScreen.tsx`.
- Initial draft creation is now a named `createInitialDraft()` operation.
- A failed initial POST no longer marks the wizard as hydrated. This prevents the autosave PUT path from pretending a persistent case exists when no case ID was received.
- The failure is now surfaced in an explicit error box with the API error message and a deterministic **Réessayer l'enregistrement** action.
- The wizard remains usable after the failure; the explicit final **Enregistrer** action can still create the case when no ID exists.
- No automatic POST retry was introduced because a response-loss retry can create duplicate cases unless the API has an idempotency mechanism. This is intentional.

**TEST INFRASTRUCTURE ADDED**
- Added `audit-app/backend/tests/http_api_test.php` covering MariaDB-backed HTTP lifecycle: health → POST draft → PUT update → GET persistence → NACE search → NACE code → DELETE cleanup.
- Added `.github/workflows/backend-integration.yml` to run MariaDB 10.11 + PHP 8.2, the existing engine smoke suite, the HTTP API regression suite, and audit-mobile TypeScript checking on push/PR.

**TEST STATUS — NOT YET VERIFIED IN RUNTIME**
- The local execution environment available to this session has PHP 8.4 and Node 22, but no MariaDB/MySQL server and no network access to clone/install the repository dependencies. Therefore the required MariaDB + PHP HTTP integration suite could not be executed locally.
- The GitHub workflow was pushed, but this session's GitHub integration currently reports no workflow run for the relevant commits, so no CI pass is being claimed.
- The earlier verified fact remains unchanged: the exact minimal initial POST payload returned HTTP 201 when tested directly.

**NOT DONE**
- BUG-004 `PUT /cases/:id` has not yet been empirically verified against MariaDB.
- Full wizard lifecycle has not yet been browser/device-tested.
- The production trigger for the original first-call failure remains unknown.

**DEPENDENCY / HAND-OFF**
- Next developer must run the new MariaDB + PHP HTTP suite before declaring BUG-004 fixed.
- If PUT fails, debug the exact HTTP response and database exception before changing frontend code.
- Do not re-open the already verified minimal POST payload as the assumed root cause.


## Mandatory source/deployment separation

**SOURCE REPOSITORY RULE:** this repository is the source of truth and is never the deployable artifact. Every application change must be made here first, tested here, then built/packaged and published to **macerti/duration_calculator**. For PHP, the deployable tree is produced from duration-calculator-php/ (no compilation). For audit-mobile, the deployable frontend is the generated Expo web export; source-only frontend changes are not deployed until the generated artifact is published to duration_calculator. Never fix application behavior only in the deployment repository. Every hand-off must record the source commit and deployment-artifact commit, or explicitly state that deployment is pending. A task is not deployed until the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.


### 2026-08-31 — Mandatory deployment-artifact workflow established

**SOURCE REPOSITORY:** macerti/duration_calculator_backend remains authoritative for all application source.

**DEPLOYMENT REPOSITORY:** macerti/duration_calculator is mandatory for deployable output. No developer may treat a source commit as deployed until the corresponding artifact has been published there.

**DONE:**
- Added the mandatory source/deployment separation policy across the source repository documentation.
- Added the same policy across the deployment repository documentation.
- Added macerti/duration_calculator/.github/workflows/build-from-source.yml. The workflow checks out source main, installs audit-mobile dependencies, runs Expo web export with the production API URL, copies the generated web artifact into the deployment repository, and commits it using github-actions[bot].
- Synchronized the deploy repository's PHP tree from duration-calculator-php/. The backend deployment projection is now aligned with the source tree for the files synchronized in this session.

**SOURCE COMMIT:** latest source behavior/documentation changes are on main; the frontend BUG-004 fix is in commit e15403d21dd7eb937688d66faa71f820f9c91279 and subsequent documentation commits.

**DEPLOY ARTIFACT STATUS:** PHP deployment files were synchronized into macerti/duration_calculator. The generated Expo web artifact for the new frontend BUG-004 fix has NOT been built/published in this session because the available GitHub toolset cannot dispatch workflow_dispatch jobs and the local environment cannot install the Expo toolchain from the network.

**IMPORTANT:** Do not claim the BUG-004 frontend fix is deployed. The deployment repository currently contains the previous generated web bundle until the Build deploy artifact from source workflow is run successfully.

**NEXT REQUIRED HAND-OFF:** run the Build deploy artifact from source workflow in macerti/duration_calculator. Verify the generated _expo bundle changed, verify the deployment workflow passes, then record both the generated artifact commit and deployment run in this file. Only then can the frontend fix be called deployed.

### 2026-08-31 — Source-owned build/test/publish pipeline

**ARCHITECTURE DECISION — MANDATORY**
- macerti/duration_calculator_backend is the only development/source repository.
- macerti/duration_calculator is the generated deployment-artifact repository.
- Developers edit only the source repository. They do not manually maintain the deploy repository.
- The source repository now owns .github/workflows/build-test-publish.yml.
- On push to main (and on manual dispatch), the workflow is intended to: run PHP + MariaDB tests against the actual duration-calculator-php/ deployment topology; run the frontend TypeScript check; build the Expo web artifact with the production API URL; assemble the deployable PHP tree; then publish the result to macerti/duration_calculator.
- The existing macerti/duration_calculator/.github/workflows/deploy.yml is the user's pre-existing FTP deployment action. It is intentionally NOT modified by this source-build change. The source workflow only commits generated artifacts to that repository; the existing FTP action remains responsible for deployment.

**AUTHENTICATION**
- The source workflow expects repository secret DURATION_CALCULATOR_TOKEN.
- The token must have only the minimum repository permission required to push to macerti/duration_calculator.
- The token pasted into the conversation was NOT committed to source, workflow YAML, or deployment repository. The connected GitHub toolset does not expose an Actions-secret write operation, so the secret could not be installed automatically from this session.
- The token was pasted in plaintext into the conversation; treat it as exposed and rotate/revoke it after installing a replacement secret. GitHub recommends storing credentials as Actions secrets rather than putting them in workflow files.

**OBSOLETE WORK REMOVED**
- Removed the previously added macerti/duration_calculator/.github/workflows/build-from-source.yml deployment-side build workflow.
- This prevents two competing build mechanisms from existing.
- No changes were made to the existing FTP deployment workflow.

**CURRENT VERIFICATION STATUS**
- Source-owned build workflow: committed, not yet executed successfully.
- Deployment-side build workflow: removed.
- PHP deployment projection: previously synchronized.
- New deployment-topology HTTP regression suite: added at duration-calculator-php/tests/http_api_test.php.
- The workflow's MariaDB service and PHP built-in server are configured to test the same bare /nace/... and /cases/... API topology used by the deployable api/index.php.
- Full CI execution remains pending because the required Actions secret is not installed through the available tool interface.


### 2026-08-31 — CI architecture correction and MariaDB failure investigation

**CURRENT AUTHORITATIVE STATE**
- There is exactly one source-owned CI workflow: `.github/workflows/build-test-publish.yml`.
- The previously duplicated `.github/workflows/backend-integration.yml` has been deleted.
- The deployment repository's pre-existing FTP workflow `macerti/duration_calculator/.github/workflows/deploy.yml` remains untouched and is the only deployment-to-FTP mechanism.
- The deployment-side build workflow previously created during the first implementation, `macerti/duration_calculator/.github/workflows/build-from-source.yml`, was removed. It must not be recreated.
- Therefore: source repo = edit/test/build/publish authority; deploy repo = generated artifact + existing FTP deployment only.

**CI DATABASE MODEL**
- CI does NOT require the user's production MariaDB credentials.
- GitHub Actions creates a disposable MariaDB 10.11 service container with CI-only credentials:
  - database: `audit_test`
  - user: `audit`
  - password: `audit`
  - root password: `root`
- The workflow verifies MariaDB with the MariaDB client, then creates a temporary CI `config.php` with the same values and verifies the PHP/PDO connection before schema/seed/tests.
- No database secret should be added merely to make this CI database work. Production credentials belong only on the hosting server.

**WHAT FAILED AND WHY**
- Multiple early CI runs failed in `Configure test database` with: `Could not connect to the database. Check config.php.`
- The first attempted correction only substituted values into `config.example.php`; this was insufficient because the template/default connection assumptions did not reliably match the GitHub service environment.
- The workflow was therefore changed to generate the complete CI `config.php` explicitly instead of mutating the example file.
- A direct MariaDB client check and a PHP/PDO check were added before seed/tests so future failures identify the layer precisely.
- The Node.js 20 annotation from `actions/checkout@v4` was a warning, not the cause of the database failure. Checkout and setup-node were moved to v5.

**CI EXECUTION STATUS**
- Commit `65fae75a2450883152d43e844a1712d7635b3d1a` contains the current CI configuration.
- A run for that commit was observed entering the queue/in-progress state; its final result must be checked in GitHub Actions before this pipeline is declared green.
- Earlier runs `33447260355` and `33447244917` failed before the corrected PDO verification could run.
- Do not infer success from the workflow starting. A green conclusion is required.

**BUG-004 TEST BOUNDARY**
- The exact minimal wizard initial POST payload was already verified independently: POST /cases returned HTTP 201.
- The frontend silent initial-save failure/retry behavior was changed in source, but the complete lifecycle is still not runtime-verified.
- The new HTTP regression suite is intended to test: health/DB → NACE search → NACE code → POST draft → PUT case → GET persisted state → DELETE cleanup.
- BUG-004 must remain open until that suite passes and the real wizard lifecycle is tested.

**HAND-OFF RULE**
Before touching CI again, inspect the latest workflow run and its first failing step. Do not re-test or rewrite the already-established disposable MariaDB model unless the service/client/PDO diagnostic itself fails.

### 2026-09-01 — CI root-caused and fixed by independent full-pipeline reproduction

**CONTEXT**: after BUG-019's config-determinism fix and the `DURATION_CALCULATOR_TOKEN` rotation, CI was still reported non-functional. This session did not trust the workflow's own history of "should be fixed now" claims and instead reproduced every stage of `build-test-publish.yml` locally against real infrastructure (a real local MariaDB 10.11 instance, real PHP 8.3 with `pdo_mysql`/`mbstring`/`curl` to match the workflow's `setup-php` extensions, real `npm ci`/`tsc`/`expo export`).

**ROOT CAUSES FOUND (two, independent, either one fatal on its own)**
1. BUG-020 — `AuditEngine\\pingDb()` doubled namespace separator in the "Create CI database configuration" step is a PHP parse error, unconditionally, regardless of DB/secret/network state. This is the immediate reason the pipeline never gets past that step.
2. BUG-021 — a literal `\n` (not a real newline) on one line of `CalculationWizardScreen.tsx` (introduced by the BUG-004 fix commit `e15403d`) fails `npx tsc --noEmit` with `TS1127`. Would have failed the "Typecheck frontend" step even if BUG-020 were fixed first.

**FIXES APPLIED**
- `.github/workflows/build-test-publish.yml`: both `AuditEngine\\pingDb()` → `AuditEngine\pingDb()`.
- `audit-mobile/src/screens/CalculationWizardScreen.tsx` line 93: split into two real lines.

**FULL LOCAL VERIFICATION (DONE / VERIFIED, real environment, not hypothesis)**
- MariaDB service + PDO check, schema import, seed: pass.
- `php tests/smoke_test.php`: 24/24 pass.
- PHP built-in server routing for `/health`, `/nace/search`, `/nace/:code`: all 200, correct payloads. **BUG-017 (NACE 404) not reproduced** — appears already fixed by current router code; leaving it open in the log only pending one more confirmation on a real runner.
- `php tests/http_api_test.php` full HTTP regression suite (health → NACE → POST draft → PUT update → GET persistence → DELETE): **16/16 pass**. This means **BUG-004's backend persistence path is verified working** against a real database — the previously-logged "NOT YET VERIFIED IN RUNTIME" status for the HTTP suite is now resolved. If a production first-save failure still occurs, the backend save/update logic itself is not the cause; look at frontend request construction, network/cold-start conditions, or something specific to the real DirectAdmin/Apache topology instead.
- `npm ci`, `npx tsc --noEmit` (after fix): pass.
- `npx expo export --platform web --clear` with `EXPO_PUBLIC_API_URL` set to the production API URL: succeeds, produces `dist/index.html` etc. as the assembly step expects.
- Deployment tree assembly step (`_deploy/` construction + all `test -f`/`test ! -e` assertions): pass.
- Cross-checked the publish step against the real `macerti/duration_calculator` repo: default branch is `main` (matches `git push origin main`); the repo's own top-level docs (CHANGELOG.md, ROADMAP.md, etc.) are untouched by the cleanup `rm` in the publish step; a bot push via a PAT to a *different* repo correctly triggers that repo's own `deploy.yml` FTP workflow (the `GITHUB_TOKEN` same-repo loop-prevention rule does not apply here).

**NOT YET DONE**
- An actual GitHub Actions run of the fixed workflow has not been observed by this session at write time (see below — about to trigger one). Local reproduction is thorough but is still not the hosted runner; confirm a real green run before calling CI solid.
- Real DirectAdmin/Apache-topology test of the NACE routes (only PHP built-in server was tested here, matching prior sessions' evidence boundary).

**DEPENDENCY / HAND-OFF**: once a green Actions run is observed for the commit containing these two fixes, and the artifact appears in `macerti/duration_calculator` with the deploy repo's FTP workflow having run, update this file with the exact run URL/commit pair before calling deployment complete. Do not assume success from the workflow merely starting.

### 2026-09-01 — CI confirmed green end-to-end on a real GitHub Actions run; one more bug found and fixed along the way (BUG-022)

**WHAT HAPPENED**: the BUG-020/BUG-021 fixes were pushed, then a manual `workflow_dispatch` was used to actually observe a run (source commit `507095d`) rather than assuming the local reproduction generalized. It did not, fully: that run failed at a new step, "Verify MariaDB service", with exit code 127 (`mariadb`: command not found) — see BUG-022 in BUGLOG.md. The workflow never installed a MariaDB/MySQL client; it assumed the `mariadb` CLI was already on the runner's PATH, which is not true of the current `ubuntu-latest` image. This could not have been caught by local reproduction, since that reproduction necessarily ran on a machine where the client had already been installed manually.

**FIX**: added an explicit `apt-get install -y mariadb-client` step before first use. Pushed as source commit `d16409e`.

**CONFIRMED GREEN RUN**
- Source commit: `d16409e`.
- GitHub Actions run: `https://github.com/macerti/duration_calculator_backend/actions/runs/33449892835` (triggered by push) — **status: completed, conclusion: success, all 18 steps succeeded**, including MariaDB verify, DB config, schema/seed, PHP smoke tests, HTTP API regression suite, frontend typecheck, Expo web export, artifact assembly, and publish to the deploy repo.
- Deployment artifact commit: `0f97d9e` in `macerti/duration_calculator`, authored by `github-actions[bot]`, message "build: publish artifact from duration_calculator_backend".
- Deploy repo's own FTP workflow (`deploy.yml`) fired automatically on that commit and **also completed successfully**: `https://github.com/macerti/duration_calculator/actions` (run for commit `0f97d9e`, event `push`, conclusion `success`).

**THEREFORE**: as of this commit, the full source → CI → build → publish → FTP-deploy chain is verified working end-to-end on real infrastructure, not merely locally reproduced. This is the first time this can be claimed with a real green run as evidence rather than a local approximation.

**REMAINING OPEN ITEMS (unchanged by this work)**: authentication/rate limiting (SECURITY.md), input-bounds enforcement, browser/device visual confirmation of UI pieces, and a live health-check confirmation against the real DirectAdmin host (the FTP step's post-deploy health check is `continue-on-error: true` and informational only — its actual result for this deploy has not been separately confirmed here).

**PROCESS LESSON FOR FUTURE CI CHANGES**: local reproduction (even a careful one against real MariaDB/PHP/Node) is necessary but not sufficient — it only found 2 of the 3 bugs that were blocking this pipeline. The third was only visible on the actual hosted runner. Always dispatch and observe at least one real run before declaring a CI fix complete.


### 2026-09-01 — Deploy interaction test: BUG-025 UX findings

**STATUS: REPORTED / CODE-INSPECTED — implementation and runtime verification pending.**

The current deployment was tested interactively and exposed three frontend consistency/behavior findings. Do not treat these as fixed until the source changes are implemented, typechecked/built, and exercised in a real browser/device.

#### A. Calculation report navigation
- The final **Rapport de calcul complet** screen currently uses a separate navigation route from the wizard.
- The current wizard opens it with navigation.navigate("CalculationReport", ...), while the report screen itself has no Breadcrumbs component.
- The requested UX is that the report follows the same breadcrumb hierarchy as the rest of the application and does not introduce a separate, differently styled **Retour** mechanism.
- Keep report content/calculation data unchanged while correcting navigation.

#### B. Accueil breadcrumb/home representation
- The home destination must remain a real home icon, not an emoji.
- Current code is inconsistent: CalculationWizardScreen uses Ionicons home-outline, while the generic Breadcrumbs component renders breadcrumb items as text only.
- Normalize this into one consistent breadcrumb/home treatment across screens. Do not reintroduce emoji-based home labels.

#### C. Multi-standard Synthèse tab does not switch the programme
- Reported deploy behavior: for a site with multiple standards, the Synthèse standard tabs are visible, but tapping the second standard does not change the displayed audit programme.
- Source inspection shows a shared activeStandardTab state, stdTab derivation, and a stdResult lookup by standard. This is the intended mechanism, but source inspection alone does not establish why the deployed interaction fails.
- Required behavior: selecting a standard must switch all standard-specific Synthèse content for that site, including stage/visit duration, report-writing duration, rounding controls, and related details.
- Validate the state scope with both one multi-standard site and multiple sites containing multiple standards. A selection for one site must not leak to another site.
- Do not classify this as an engine/calculation defect unless the result payload itself is proven wrong. Current evidence points to the Synthèse UI selection/rendering path.

#### Verification sequence for next developer
1. Implement report navigation using the existing breadcrumb model; remove the separate report-specific back convention.
2. Normalize Accueil to the icon system across breadcrumb/navigation instances.
3. Reproduce the second-standard Synthèse failure and instrument activeStandardTab, derived stdTab, per-site siteStdTab, and selected stdResult if necessary.
4. Test one site with two standards, then two sites with two standards each.
5. Run npx tsc --noEmit and the production Expo web build with --clear.
6. Perform the exact interaction test in a real browser/device before changing the evidence level to VERIFIED.

**Deployment boundary:** this status entry records findings only. No source UX fix is claimed as implemented or deployed by BUG-025.

---

## 2026-09-01 (second session) — BUG-025/026/027 source fixes: STATICALLY VERIFIED + BUILD-VERIFIED, not yet browser/device VERIFIED

**Environment**: no PHP, no MariaDB, no browser/device available. `node`/`npm`/`npx` with npm-registry network access were available. This caps the evidence level for everything below — see "Evidence labels" above; nothing here is promoted past STATICALLY VERIFIED or BUILD-VERIFIED (a new label, defined below, for "the real `expo export --platform web` build step CI runs before publish succeeded against this code").

**FIXED (source changed, typecheck + real production build both pass)**
- BUG-025 #1 — report screen now uses `Breadcrumbs` + `headerShown:false` instead of the native header back arrow; `clientId` added to the `CalculationReport` route params to support it.
- BUG-025 #2 — "Accueil" is now one consistent icon-crumb (`Breadcrumbs.tsx` extended with an `icon` field) across the wizard, ClientsList, ClientDetail, and the report screen.
- BUG-025 #3 — **root cause confirmed**: Synthèse's per-site standard tab was reading Facteurs-step-scoped state (`activeStandardTab`/`stdTab`, tied to `activeSite`), not a value scoped to the site being rendered in the Synthèse loop — this explains both "tapping the second tab does nothing" and the multi-site leak risk. Replaced with `syntheseStandardTabBySite`, keyed by `siteResult.siteId`.
- BUG-027 #4 — removed the redundant Synthèse bottom "Retour" button; confirmed `StepTabs` (top on desktop, fixed bottom bar on mobile) already covers step-back navigation regardless of `currentStep`.
- BUG-026 — root cause confirmed: Siège name/address used the shared `NumberField` (hardcoded `keyboardType="numeric"`). Added a new `TextField` component and swapped it in for exactly those two fields; no other field's validation was touched.

**PARTIALLY FIXED — do not close**
- BUG-027 #3 — the +/- controls now use `step={0.01}` (previously defaulted to `0.25`) at all 5 Synthèse `RoundingStepper` call sites, and the existing `Math.round(x*100)/100` nudge math is confirmed float-drift-safe. **However**, re-reading `RoundingStepper.tsx` shows the displayed value is a non-editable `<Text>`, not a `TextInput` — "the user can manually type a value directly into the field" is simply not built yet, in this or any prior session. This is a real gap, not a verification gap; treat BUG-027 #3 as open until typing is added.

**NEW EVIDENCE LABEL USED THIS SESSION**
- BUILD-VERIFIED: `npx expo export --platform web --clear` (the same command `build-test-publish.yml` runs before assembling the deploy artifact) completed successfully against the changed tree with a placeholder `EXPO_PUBLIC_API_URL`, producing `dist/index.html` and a single web bundle. Stronger than STATICALLY VERIFIED (typecheck only) but still not a substitute for an actual interaction test.

**VERIFICATION PERFORMED (real commands, real output)**
- `npm ci` in `audit-mobile/` — clean, 515 packages, 0 errors.
- `npx tsc --noEmit` — 0 errors against the entire changed tree.
- `npx expo export --platform web --clear` — succeeded, produced the expected `dist/` output.

**NOT DONE**
- No real browser/device pass on any of BUG-025/026/027 — required before any of these move to VERIFIED. Use BUG-025's existing "Incremental implementation / verification order" (steps 3-6) as the checklist.
- BUG-027 #1 (Facteurs multi-site sequencing/initial-Siège-selection) and BUG-027 #2 (Synthèse annual/per-standard totals) — untouched, fully open.
- BUG-027 #3's manual-typing requirement — not implemented; needs `RoundingStepper.tsx` converted to an editable numeric `TextInput` with comma/period and non-numeric-character handling.
- Backend (`duration-calculator-php/`) untouched this session; BUG-004's prior VERIFIED backend-persistence status is unaffected.
- **Not deployed**: per the mandatory source/deployment separation rule, this is a source-only commit. `build-test-publish.yml` has not been observed running against it, and nothing has been published to `macerti/duration_calculator`.

**DEPENDENCY / HAND-OFF**: the next developer with real device/browser access should (1) click through BUG-025 #1/#2/#3 and BUG-026 to confirm the fixes actually resolve the reported symptoms, especially BUG-025 #3 with 2+ sites × 2+ standards each; (2) add manual-typing support to `RoundingStepper.tsx` to finish BUG-027 #3; (3) start BUG-027 #1/#2 from scratch. None of this should be treated as deployed until a green `build-test-publish.yml` run is observed and an artifact commit exists in `macerti/duration_calculator`.

---

## 2026-09-01 (third session) — BUG-027 #1/#2/#3 all addressed: source-complete, still STATICALLY/BUILD-VERIFIED only

**Environment**: identical constraint to the second session — no PHP, no MariaDB, no browser/device; `node`/`npm`/`npx` with npm-registry access only.

**FIXED (source changed, typecheck + real production build both pass)**
- BUG-027 #3 — closed. Added the missing manual-typing half: `RoundingStepper.tsx`'s value is now a controlled `TextInput` (comma/period decimal handling, non-numeric stripped while typing, commits via the same 2-decimal rounding as `nudge()` on blur/submit, reverts to last valid value on empty/invalid input). Combined with the second session's `step={0.01}` fix, both halves of BUG-027 #3 are now done.
- BUG-027 #1 — fixed. Root cause: `activeSiteIndex` is shared between Effectif and Facteurs, so whichever site tab was last active in Effectif stayed active when Facteurs opened. Added a `prevStepRef`-guarded effect that resets `activeSiteIndex` to `0` exactly on entry into the `"factors"` step (any trigger — button or step-tab), without interfering with in-step navigation. Replaced the fixed Retour/Calculer footer with sequential Précédent/Site-suivant buttons that step through sites in order; "Calculer" now only appears on the last site, matching the bug's "do not expose Calculer as the only immediate action while sites remain" requirement. Single-site cases are unaffected (index bound is `0 < 0`, unchanged behavior).
- BUG-027 #2 — fixed. Added a per-site "Récapitulatif annuel" to Synthèse: for each year found across a site's standards, shows that year's total (all standards summed) plus a per-standard line when more than one standard is active. Computed from the exact same `getRounded`/`roundKey` values already driving the steppers and the pre-existing grand total — a presentation addition, not a new calculation path. The pre-existing single grand total was kept (still legitimately useful for overall quoting); the bug asked for added detail, not its removal.

**EVIDENCE LEVEL — unchanged from second session, still capped**
- STATICALLY VERIFIED: `npx tsc --noEmit` — 0 errors against the full changed tree, both after the RoundingStepper change and again after the wizard-screen changes.
- BUILD-VERIFIED: `npx expo export --platform web --clear` succeeded twice (once per round of edits) with a placeholder `EXPO_PUBLIC_API_URL`. This session additionally grepped the built, minified bundle for the new UI strings ("Site suivant", "Précédent (", "Récapitulatif annuel") and confirmed all three are present on the shipped code path — stronger confirmation than a successful build alone, but still not an interaction test.

**NOT DONE**
- No real browser/device pass on BUG-027 #1/#2/#3 (or on any still-open item from prior sessions) — this remains the single biggest gap across the whole BUG-025/026/027 cluster. In particular, untested interactively: the decimal-keyboard/comma-period typing UX in a real browser vs. native app; whether the sequential Facteurs flow feels natural with 3+ sites; whether the annual-breakdown layout is readable on a real multi-year, multi-standard case.
- Backend (`duration-calculator-php/`) untouched this session; no PHP/MariaDB available in this sandbox, same as every prior session.
- **Not deployed**: source-only commit, per the mandatory source/deployment separation rule.

**OPEN PRODUCT QUESTIONS for the next developer (not blocking, but worth resolving before calling BUG-027 fully closed)**
1. Is "Site suivant" without entering any factors an acceptable implementation of "explicitly skip that site's factors," or does product want a visually distinct "Passer" affordance?
2. Should the new annual breakdown be its own always-visible section per site, or is per-standard-tab-scoped placement (current implementation) sufficient?

**DEPENDENCY / HAND-OFF**: BUG-027 is now source-complete (#1/#2/#3/#4). Next developer with real device/browser access should run the full BUG-025/026/027 click-through in one pass (Siège + 2 sites × 2+ standards each, cycleYears ≥ 3) before any of it is promoted to VERIFIED or considered for deployment.

---

## 2026-09-01 (fourth session) — Independent fresh-sandbox backend re-verification; no code changes; docs reconciled

**Purpose of this session**: was asked to "start fixing the bugs." Before writing any code, read this file, `audit-mobile/BUGLOG.md`, `audit-app/BUGLOG.md`, and the latest commit (`3d22b7f`, FEAT-003) to establish what was actually still open, since prior sessions' "Current status" header and their own chronological history had drifted out of sync (header still said BUG-004 PUT was "Not tested" and NACE was "OPEN", while a chronological entry further down already reported both passing via CI). Prioritized closing that gap with fresh, independent evidence over starting new feature work, per this file's own instruction not to duplicate investigation.

**Environment**: sandboxed container, no prior state from any earlier session (fresh clone). Unlike every prior session's stated environment, this one *did* have outbound access to `archive.ubuntu.com`/`security.ubuntu.com`, so `apt-get install php8.3-cli php-mysql php-mbstring php-curl default-mysql-server` succeeded — this is the first session able to run the real PHP/DB regression suite outside of GitHub Actions itself.

**DONE / VERIFIED (real commands, real output, this session)**
- `duration-calculator-php/` (the actual deployed backend — not the legacy `audit-app/backend` copy) against a from-scratch MySQL 8.0.46 instance (`default-mysql-server` on Ubuntu 24.04 — a client-compatible stand-in for CI's MariaDB 10.11, not identical; see caveat below):
  - `config.php` written matching the CI workflow's exact CI config block; `AuditEngine\pingDb()` → OK.
  - `db/schema.sql` imported; `php seed.php` → seeded `default-v1`.
  - `php tests/smoke_test.php` → **24/24 passed**.
  - `php -S 127.0.0.1:8080 api/index.php`; `/health` → `{"status":"ok","dbConnected":true,...}`.
  - `php tests/http_api_test.php http://127.0.0.1:8080` → **16/16 passed**: health, NACE search, NACE code lookup, POST /cases, PUT /cases/:id (with recalculation), GET /cases/:id (input/status/rounding overrides all preserved), DELETE /cases/:id.
- `audit-mobile/`: `npm ci` (319 packages, clean) then `npx tsc --noEmit` → **0 errors**, confirming the third session's BUG-027 #1/#2/#3/#4 source changes still typecheck cleanly and nothing has regressed since.
- Did **not** re-run `npx expo export` this session (time/turn-budget tradeoff — `tsc` clean was judged sufficient re-confirmation given the third session already got a successful export against this same code).

**RECONCILED IN THIS FILE (see "Current status" section above for the actual updated text)**
- BUG-004 PUT/Enregistrer backend path: moved from ambiguous/"Not tested" to VERIFIED, with today's evidence cited independently of the CI run.
- NACE 404 finding: moved from OPEN to NOT REPRODUCED, so a future session doesn't re-open the SCRIPT_NAME/REQUEST_URI investigation from scratch on a stale premise.
- Concurrent work map table updated to match.

**NOT DONE / caveats — do not over-claim from this session**
- MySQL 8.0 was used, not MariaDB 10.11. Every tested path matched CI's MariaDB-based results, but this is not a bit-for-bit identical engine; if a MariaDB-specific dialect issue exists, this session would not have caught it.
- No real DirectAdmin/Apache-topology test (still PHP built-in dev server only, same boundary as every prior session).
- No real browser/device test of the wizard UI — still the single biggest remaining gap across BUG-004 and BUG-025/026/027, unchanged by this session.
- **No feature/bug code was changed this session.** This was a verification-and-documentation session, not an implementation session — see the update rule at the top of this file for why that's still worth logging: it prevents the next developer from re-doing the same MariaDB/PHP stand-up and HTTP regression run under the mistaken belief that PUT/NACE were still unverified.
- FEAT-003 (version/last-update footer, marked IMMEDIATE in the latest commit `3d22b7f`) was read and is noted in the concurrent work map above, but not started — it needs product/implementation decisions (where the update-timestamp metadata is generated/sourced from) that deserve a dedicated session rather than a rushed partial implementation under a tight turn budget.

**DEPENDENCY / HAND-OFF for the next developer**
1. Do not re-run the MariaDB/PHP stand-up + smoke/HTTP suite from scratch just to "double check" — it is now independently confirmed three times (two CI runs + this session). Spend that time on FEAT-003 or the real browser/device gap instead.
2. FEAT-003 is the top of the backlog per the repo's own most recent commit — read `audit-app/ROADMAP.md`'s "IMMEDIATE REQUEST — FEAT-003" section in full before starting it. It touches both `audit-mobile/` (footer UI) and needs a decision on where "last update" metadata is sourced from (git commit timestamp at build time is the most likely fit, but this session did not decide that — it's a real open design question, not a coding detail).
3. BUG-004's frontend items (#1 and #3 in the NOT DONE list above) still need a source-code check, not just a docs check — confirm `CalculationWizardScreen.tsx`'s current error-surfacing behavior matches what `audit-mobile/BUGLOG.md`'s 2026-08-31 entry claims was implemented, since that file wasn't independently re-read line-by-line this session.

### 2026-09-01 (fifth session) — FEAT-003 implemented (version/last-update footer)

**Purpose of this session**: pulled latest before starting, per this file's own instruction, and found the repo's own most recent authoritative priority order (`cbdcb36`, top of this file) names FEAT-003 as the immediate top-of-backlog item, not yet started by anyone. Implemented it rather than re-touching already-VERIFIED work (BUG-004/NACE) or starting lower-priority backlog items out of order.

**Design decisions made (previously flagged as open by the fourth session)**:
- Version source of truth: `audit-mobile/package.json` `"version"` field (existing value `5.0.0`, kept — not reset to `1.0.0`, since the spec's versioning *rules* are what's authoritative, not a specific starting number). Bumped to `5.1.0` for this change itself (new user-visible feature → Y+1, Z resets, per the spec's own rule).
- Update-timestamp source of truth: the committer timestamp of the most recent git commit touching `audit-mobile/` (`git log -1 --format=%cI -- .` run from that directory) — not build-machine clock, not end-user browser clock, satisfying the explicit ROADMAP.md requirement.

**Implementation**:
- `audit-mobile/scripts/generate-version.js` — new. Reads `package.json` version + git commit timestamp, writes `src/generated/versionInfo.ts` (gitignored — regenerated every install/dev/build, never a stale committed copy per the "derive automatically, don't hard-code" requirement).
- Wired into `package.json`'s `postinstall` script, so both `npm ci` (CI) and local `npm install` regenerate it automatically — **no CI workflow YAML changes were needed**, since the existing "Install frontend dependencies" step already runs `npm ci`.
- `audit-mobile/src/components/VersionFooter.tsx` — new. Renders `Version X.Y.Z · Updated on D Mon YYYY at HHhMM`, matching the spec's exact example format. Uses existing `theme/tokens.ts` design tokens (no new raw colors/hex), per `ORIENTATIONS.md`'s UI Visual System principle.
- `App.tsx` — footer added as a sibling of `NavigationContainer` inside a flex-column wrapper, so it appears identically on every screen (Home, ClientsList, ClientDetail, CalculationWizard, CalculationReport) without touching each screen file individually — single place it can drift out of sync, per the spec's "one authoritative location" requirement.
- Checked for competing hardcoded version strings elsewhere in `audit-mobile/src` — none found.

**Verification this session (BUILD-VERIFIED, not yet interaction-VERIFIED — same evidence-level caveat as prior frontend sessions, no browser/device tooling available)**:
- Clean `npm ci` from scratch → confirmed `postinstall` correctly generates `src/generated/versionInfo.ts` with real version/timestamp values (not placeholders).
- `npx tsc --noEmit` — 0 errors.
- `npx expo export --platform web --clear` — succeeds; grepped the built bundle directly and confirmed both `"5.1.0"` and the literal string `"Updated on"` are present in the shipped JS, i.e. this isn't a dead code path.

**Not done / open**:
- Not yet run through CI or deployed (source/deployment separation — next step is push + let `build-test-publish.yml` do its job, same as prior fixes this project has used).
- Not interaction-VERIFIED in an actual browser/mobile viewport (layout/wrapping/overlap with existing screen content not visually confirmed — flag for the acceptance gate in `cbdcb36`'s priority order, step 3).
- Per that same priority order, **repository architecture consolidation (`REPOSITORY_ARCHITECTURE.md`) is next**, not more bug/feature work — do not start BUG/FEAT backlog items before that consolidation without a reason to deviate from the recorded priority order.
