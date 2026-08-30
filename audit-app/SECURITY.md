# Security — audit-app / duration_calculator

Living audit log, not a wishlist. Every entry: the concrete risk, what it
affects (Confidentiality / Integrity / Availability), and either the fix
applied or what fixing it would require. See `ORIENTATIONS.md` → "Security"
for the standing principles this log tracks against.

**Context that shapes every entry below**: this app is heading toward
holding real client business data (audit durations, personnel counts,
factor justifications for certification decisions). Nothing here is
"probably fine" — treat every gap as real until closed.

---

## Done

### Prepared statements everywhere (SQL injection)
- **Risk**: Confidentiality, Integrity — SQL injection could read or modify
  any data in the database.
- **Status**: Audited on 2026-08-23. Every PDO query in `db/*.php` uses
  parameter binding (`?` placeholders + `execute([...])`/`bindValue()`) —
  confirmed via direct grep for any query construction that could
  string-interpolate a value, found none. `LIMIT`/`OFFSET` values
  (`listCalculationCases`) are bound with explicit `PDO::PARAM_INT`, not
  string-substituted, which is the specific spot integer values most often
  get interpolated unsafely in PHP codebases.

### Error responses no longer leak internals
- **Risk**: Confidentiality (information disclosure — file paths, table/
  column names, internal logic exposed via raw exception messages) — a
  detailed error is a map for an attacker probing the app.
- **Status**: Fixed. The router's catch-all now logs the full exception
  (message + file + line) server-side via `error_log()` and returns a
  generic `"Une erreur interne est survenue."` to the client. An opt-in
  `'debug' => true` in `config.php` restores detailed messages for local
  testing only — defaults to `false`, must be deliberately enabled, never
  set on the live site. Verified live: a deliberately malformed request
  triggered a real PHP warning chain, the client got the generic message,
  and the full detail (including exact file/line) was confirmed present in
  the server log.

### Backup/editor-swap files blocked
- **Risk**: Confidentiality — `config.php~`, `config.php.bak`, `.swp` files
  (left behind by some editors, or a careless `cp config.php config.php.bak`
  on the server) don't get handed to the PHP interpreter by Apache, so
  they'd be served as **plain text**, exposing the real DB password inside.
- **Status**: Fixed. `.htaccess` now blocks `.bak`, `.old`, `.orig`,
  `.save`, `.swp`, `.swo`, and any filename ending in `~`, alongside the
  existing `.sql`/`.csv` blocks.

### Baseline security headers
- **Risk**: Integrity/Confidentiality (clickjacking via iframe embedding,
  MIME-sniffing attacks, referrer leakage to third parties).
- **Status**: Fixed, set in two places for redundancy (`.htaccess` via
  `mod_headers`, and directly in every API response from `api/index.php`,
  so it doesn't depend on `mod_headers` being enabled on a given host):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`. Verified live via
  `curl -I`.

### Server-side length validation on free-text input
- **Risk**: Integrity/Availability — client-side validation is a UX
  courtesy, not a security control; nothing stops a direct API call
  (bypassing the app entirely) from sending an arbitrarily long string,
  which could bloat the database or hit MySQL's column-length limits in an
  undefined way depending on the host's SQL strict-mode setting.
- **Status**: Fixed for the two free-text fields currently accepted:
  client `name` (capped 255, matches the `VARCHAR(255)` column) and
  `dossierRef` (capped 128, matches `VARCHAR(128)`). Verified live: a
  300-character name was correctly rejected with `400` before reaching the
  database.
- **Not yet covered**: `justificationText` and other nested fields inside
  the calculation input (site names, factor selections) have no explicit
  length cap yet — see Todo below.

### `ON DELETE SET NULL` on `calculation_cases.client_id`
- **Risk**: Integrity/Availability — the FK had no `ON DELETE` rule,
  meaning deleting a client with any calculations would fail outright
  (this was a functional bug, logged as BUG-013, but is also a genuine
  data-integrity concern: an unhandled FK constraint error is exactly the
  kind of thing that can produce a confusing 500 with more detail than
  intended if error handling isn't careful — which, before the error-leak
  fix above, it wasn't).
- **Status**: Fixed — see `BUGLOG.md` BUG-013.

---

## Todo — prioritized, with concrete recommendations

### 1. Authentication — the single biggest gap
- **Risk**: Confidentiality, Integrity — **critical once real client data
  is involved**. Right now, anyone who discovers the API URL can create,
  read, update, or delete *any* client or calculation. There is currently
  zero access control of any kind.
- **Recommendation**: PHP session-based auth is the right fit for this
  stack (no extra infrastructure needed, works on any PHP host):
  1. A `users` table: `id`, `email`, `password_hash` (via PHP's
     `password_hash()`/`password_verify()` — never roll your own hashing,
     never store plaintext or reversibly-encrypted passwords).
  2. A login endpoint that starts a PHP session on success, and a logout
     endpoint that destroys it.
  3. Every existing endpoint except `/health` and login itself checks
     `$_SESSION['user_id']` is set, returns `401` if not.
  4. Since this introduces cookie-based sessions, **CSRF protection
     becomes necessary** at that point (it isn't yet, since there's no
     session to ride on) — a per-session CSRF token, checked on every
     state-changing request (`POST`/`PUT`/`DELETE`).
  5. Rate-limit the login endpoint specifically (see #2) — this is the
     highest-value place for it, since it's the one endpoint a brute-force
     attack would actually target.
- **Scope estimate**: a real feature, not a quick patch — a login screen,
  session wiring through every API call in `client.ts`, and route guards
  on every backend endpoint. Sequenced here as the top priority once
  picked up.

### 2. Rate limiting
- **Risk**: Availability (and, combined with #1's absence today,
  brute-forceability of anything guessable — though there's nothing to
  brute-force yet without auth).
- **Recommendation**: a simple DB-backed limiter needs no extra
  infrastructure (no Redis/Memcached required on typical shared hosting):
  a table keyed on `(ip_address, endpoint, window_start)` with a request
  count, checked and incremented at the top of the router; reject with
  `429` past a threshold. Coarse-grained (e.g. 60 requests/minute/IP
  overall, tighter specifically on login once #1 exists) is enough to stop
  casual abuse — this doesn't need to be sophisticated to be worthwhile.

### 3. Input validation completeness
- **Risk**: Integrity, Availability.
- Extend the length-cap pattern already applied to `name`/`dossierRef` to
  the remaining free-text fields (`justificationText`, site `name`,
  factor `Autre` labels) and add numeric bounds checking using the
  `validationBounds` values that already exist in the parameter set
  (`headcountMin`/`Max`, `factorCellPercentMin`/`Max`, etc.) but were never
  actually wired into the API layer — they exist as configuration today,
  not enforcement.
- Minor robustness gap found while testing the error-leak fix: sending a
  malformed `calculate` payload (missing required nested fields like
  `shiftTeams`) produces PHP warnings before the caught exception — not a
  security hole (nothing leaks, the generic-error fix already contains it),
  but worth hardening the engine's own input assumptions so malformed
  requests fail cleanly with a clear `400` instead of reaching a `500`.

### 4. Availability — backups and disaster recovery
- **Risk**: Availability, and Integrity in the recovery sense (can bad data
  be rolled back?).
- No backup strategy has been discussed or implemented for the production
  database. **Recommendation**: DirectAdmin includes built-in backup tools
  (Account Backup / Backup Wizard, usually schedulable) — at minimum,
  confirm these are enabled and cover the MySQL database, not just files.
  For anything beyond "whatever the host does automatically," a scheduled
  `mysqldump` via cron (DirectAdmin supports cron jobs) writing to a
  separate location is the standard low-effort addition.

### 5. Dependency vulnerabilities — audited, currently low real-world risk
- **Risk**: theoretical Availability (DoS via malformed image parsing) —
  **only during local builds**, not in the deployed app.
- `npm audit` on `audit-mobile` currently reports 15 findings (10 moderate,
  5 high). Investigated on 2026-08-23, not just noted-and-ignored: every
  one is inside Expo's **build toolchain** (`metro`, `@expo/cli`,
  `@expo/config-plugins`, `xcode`) — devDependencies used only when running
  `npx expo export` to produce the static site. None of these packages are
  part of the bundle actually served to end users' browsers. The highest-
  severity findings (`image-size`, via `metro`) are a denial-of-service in
  asset processing during the build step, not something a website visitor
  could trigger remotely.
- **Recommendation**: don't run `npm audit fix --force` reflexively — it
  can bump to Expo SDK versions incompatible with the rest of the project
  and break the build for no real-world safety gain given the above. Do
  re-run `npm audit` periodically (e.g. whenever `frontend/` dependencies
  are touched for another reason) and re-assess if a finding ever appears
  in a genuinely shipped runtime dependency rather than a build-time one.

### 6. Session/data exposure once auth exists (forward-looking)
- Once #1 lands: ensure session cookies are `HttpOnly` and `Secure`
  (HTTPS-only — should be automatic once the site is served over HTTPS,
  which DirectAdmin/Let's Encrypt makes close to free to enable), and that
  `SameSite` is set appropriately for the CSRF model chosen.

---

## Explicitly not a gap, worth stating

- **XSS via stored data**: React Native's `<Text>` (and React DOM's string
  children on web) escape content by default — a client name or
  justification text containing `<script>` renders as inert text, not
  executed markup, in every screen currently in the app. This stays true
  as long as nothing renders user-supplied strings via `dangerouslySetInnerHTML`
  or an equivalent raw-HTML path (none currently exists) — worth
  re-confirming if a PDF-export feature (already on `ROADMAP.md`) ever
  processes this data through an HTML-templating step.
