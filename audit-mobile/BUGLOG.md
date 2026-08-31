# Bug Log — audit-mobile

### BUG-001 — `expo-constants` used but not installed
- **Detected**: `npx tsc --noEmit` — `TS2307: Cannot find module 'expo-constants'`.
- **Cause**: `src/config/api.ts` imports `expo-constants` for reading `app.json`
  extras, but it wasn't an explicit dependency (only pulled in transitively by `expo`).
- **Fix**: `npm install expo-constants` explicitly.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-002 — `HomeScreen` health-state spread overwrote the discriminant field
- **Detected**: Same typecheck pass — `TS2322`/`TS2783` on `setHealth({ status: "ok", ...h })`.
- **Cause**: The API's `/health` response also has a field called `status` (its own
  `"ok"` string from the server), and spreading `...h` after `status: "ok"` let the
  server's `status` field silently overwrite the discriminant the UI state union
  relies on — TypeScript caught it, but this would have been a real runtime bug
  (health card permanently stuck showing nothing, or worse, silently wrong branch)
  had it shipped.
- **Fix**: Destructured explicitly instead of spreading: `{ status: "ok", parameterSetId: h.parameterSetId, version: h.version, dbConnected: h.dbConnected, dbBackedParameters: h.dbBackedParameters }`.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-003 — `expo export --platform web` failed on peer dependency mismatch
- **Detected**: `react-dom` installed at a version whose peer `react` requirement
  (`^19.2.8`) didn't match the project's actual `react` version (`19.2.3`), causing
  `npm install --legacy-peer-deps` to be silently needed / plain install to fail.
- **Cause**: `npm install react-dom` without a version pin grabbed latest, which had
  drifted ahead of the Expo-managed `react` version in this project.
- **Fix**: Pinned `react-dom@19.2.3` to match the project's `react` version exactly.
- **Fixed in**: 0.1.0 (pre-release)

### BUG-004 — Wizard save is broken in two places (autosave never recovers from a failed first draft; "Enregistrer" errors at the end of the wizard)
- **Reported by**: user, from live testing on the deployed app. Two symptoms:
  1. Nothing gets saved if the user drops off during the *first* step of the wizard (Sites & Secteurs) — autosave was supposed to kick in as soon as the wizard opens ("create calcul").
  2. Clicking **Enregistrer** at the very end of the wizard (Synthèse step) shows a generic error toast and the calculation is not saved.
- **Investigation environment**: cloned both repos fresh, stood up a disposable local repro stack — PHP 8.3 CLI built-in server (`php -S 127.0.0.1:8099 -t . api/index.php`) + local MariaDB, `config.php` pointed at it, `db/schema.sql` applied, `php seed.php` run to seed `default-v1` parameters. This exactly mirrors the DirectAdmin/MariaDB target described in `DEPLOY.md`, so behavior here should transfer.

- **Symptom 1 — root cause CONFIRMED by code reading, not yet reproduced end-to-end against the live DB**:
  - `CalculationWizardScreen.tsx` (`audit-mobile/src/screens/CalculationWizardScreen.tsx`, ~line 120–136): on mount for a brand-new calculation, an effect fires exactly one `api.saveCase(...)` (`POST /cases`) to create the initial draft. If that call rejects for *any* reason, the `.catch()` swallows the error silently and only sets `hydratedRef.current = true` — it never sets `existingCaseId`.
  - The recurring autosave effect (~line 138–149) is gated on `existingCaseId` being set: `if (!hydratedRef.current || !existingCaseId) return;`. So once the initial draft-creation call fails, `existingCaseId` stays `undefined` for the rest of the session, and the debounced autosave effect becomes permanently a no-op — no retry, no user-visible error (the only toast is on the *recurring* autosave's failure path, not the initial one).
  - **This is a structural bug independent of whatever is causing the initial POST to fail** — even if the initial call is currently failing for a totally unrelated/transient reason, the missing retry + missing error surfacing means any first-call hiccup (server cold start, transient DB connection issue, validation edge case, etc.) permanently kills autosave for that session with no feedback to the user.
  - **Not yet done**: reproducing the actual failure of the *first* `POST /cases` call itself against a live/local backend (I was mid-way through standing up the repro server — got MariaDB + PHP + all required extensions (`pdo_mysql`, `sqlite3`, `mbstring`) installed and the seed data loaded, health check passing, but had not yet fired the actual `POST /cases` wizard payload before running out of turn budget). So: is the first POST failing due to a payload/validation issue, or is the "no recovery" path above the *only* bug and the first call actually usually succeeds? Both need separate confirmation.

- **Symptom 2 — NOT YET REPRODUCED**: have not yet replayed the exact end-of-wizard payload (`save("calculated")` → `PUT /cases/:id` if a case already exists, or `POST /cases` otherwise, per `save()` at ~line 279–296 of `CalculationWizardScreen.tsx`) against the local repro backend. Candidates worth checking first, none confirmed:
  - `PUT /cases/:id` in `duration-calculator-php/api/index.php` (~line 215–229) re-runs `calculateCase($input, $params)` server-side before persisting — if `$body['input']` is missing/malformed for any reason at that point in the flow (e.g. a field the wizard's `buildInput()` sends that the PHP engine doesn't expect, or vice versa), this throws and is caught by the generic `catch (\Throwable $e)` at the bottom of `index.php`, returning a 500 with a generic message (`debug` is `false` in production `config.php`, per `config.example.php`'s comment — so the real error is only in the server's PHP error log, not visible client-side).
  - Given symptom 1's root cause, it's also possible `existingCaseId` is `undefined` by the time the user reaches the end of the wizard (because the very first draft-save silently failed and never recovered) — in which case `save()` takes the `else` branch and calls `api.saveCase()` (`POST /cases`) fresh at the end, with the *complete* wizard payload this time. If there's a validation/shape difference between what the initial (mostly-empty) draft payload contains vs. the full end-of-wizard payload, that would explain why the *final* save specifically errors while nothing failed loudly earlier. **This needs to be checked**: compare the two payload shapes and confirm whether `POST /cases` with a full/complete payload succeeds or fails locally.
  - Worth also checking server-side PHP error log (`error_log` call in the `catch` block, ~line 253 of `api/index.php`) on the actual production host for the real exception message/line — that would immediately narrow this down without needing to fully replay the payload locally.

- **Suggested next steps for whoever picks this up**:
  1. Pull the real PHP error log from the production host for a reproduction of the "Enregistrer" click — fastest path to the exact exception.
  2. Locally: finish standing up the repro stack (steps above already done — MariaDB running, schema loaded, `default-v1` parameters seeded, PHP dev server on `127.0.0.1:8099`) and actually fire (a) the step-1 draft-creation payload and (b) the full end-of-wizard payload against `POST /cases` and `PUT /cases/:id` to see which one throws and why.
  3. Fix the "no recovery" structural issue in the autosave effect regardless of (1)/(2)'s outcome — at minimum, the initial draft-creation failure needs to either retry or surface a visible error/allow retry, so a single failed call can't silently disable autosave for the whole session.
- **Status**: open, not fixed. This entry is a handoff — see "Not yet done" points above before starting a fix, to avoid redoing the repro work.

---

## Open / not yet hit
_(none currently — will log here once tested against a live backend from a real
device/simulator, which may surface CORS, network-permission, or env-var issues
not visible from the web bundle check alone)_


### 2026-08-31 — BUG-004 hand-off update: source CI is now the verification gate

The frontend fix for the silent initial draft-save failure is already in source, but BUG-004 is **not fully closed**.

- The exact minimal mount payload has been proven against POST /cases with HTTP 201. Do not treat payload shape as the established cause of the original production failure.
- The frontend behavior was changed so an initial draft-save failure is surfaced and can be retried explicitly; automatic blind POST retry was deliberately avoided because a lost POST response can create duplicate cases without an idempotency mechanism.
- The complete PUT /cases/:id path and complete wizard lifecycle still require runtime verification.
- CI is now responsible for the repeatable MariaDB + PHP integration environment. Its regression suite is located at `duration-calculator-php/tests/http_api_test.php`.
- Earlier CI runs failed before reaching these regression tests because the CI database configuration was wrong. That CI infrastructure problem is now being addressed separately as BUG-019 in `audit-app/BUGLOG.md`.
- Do not duplicate the CI database setup or create another workflow. The only source CI workflow is `.github/workflows/build-test-publish.yml`.

**Current evidence boundary**
- VERIFIED: minimal POST /cases payload succeeds.
- CODE CHANGED: initial draft failure is no longer silently swallowed.
- NOT VERIFIED: PUT /cases/:id against MariaDB through the deployment topology.
- NOT VERIFIED: complete browser/device wizard save/reopen lifecycle.
- NOT VERIFIED: a complete green source CI run followed by artifact publication and FTP deployment.
