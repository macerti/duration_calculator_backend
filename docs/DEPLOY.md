

## Mandatory source/deployment separation

**This repository is the SOURCE repository. It is never the deployable artifact.**

- All application source changes MUST be made and reviewed here first.
- After a source change is tested, the developer MUST build/package the deployable artifact and publish the resulting deploy files to the separate repository **macerti/duration_calculator**.
- The duration_calculator repository is the deployment artifact / production mirror. Hosting deployment is driven from that repository, not from this source repository.
- For the PHP backend, build means producing the deploy-ready single-folder PHP tree from `src/backend/`; there is no PHP compilation step.
- For `src/frontend/`, build means running the configured Expo web export and publishing the resulting static files. A source-only frontend change is NOT deployed until its generated web artifact has been published to duration_calculator.
- Never hand-edit only the deployment repository to fix application behavior. If the source repository is not updated, the deployment change is invalid and will be overwritten by the next build.
- Every development hand-off MUST state both source commit and deployment-artifact commit, or explicitly state that deployment has not yet happened.
- A task is not deployed merely because source code was committed. Deployment is complete only when the corresponding artifact exists in duration_calculator and its deployment workflow has been run/passed where applicable.

# Deploying to DirectAdmin Shared Hosting

**Current production topology (this section replaces an earlier, stale version of this file that described a two-service layout — separate API subdomain plus separate frontend subfolder — which is NOT how this app is actually deployed; see the note in `REPOSITORY_ARCHITECTURE.md`/`ORIENTATIONS.md` about DEPLOY.md always describing the real current structure).**

The app is **one self-contained folder** uploaded as-is, living in a subfolder of a subdomain — currently `tools.macerti.com/duration_calculator/`, with room for sibling tools under the same subdomain later. Inside that one folder:

```
duration_calculator/            <- the subfolder itself, e.g. tools.macerti.com/duration_calculator/
  index.html, _expo/, assets/   <- frontend static files (built from src/frontend/), at the ROOT of this folder
  api/                          <- PHP backend entry point + its own .htaccess (built from src/backend/api/)
  engine/                       <- PHP calculation engine (from src/backend/engine/)
  data/                         <- PHP-loaded parameters + raw CSVs (from src/backend/data/)
  db/                           <- PHP repositories + schema.sql (from src/backend/db/)
  tests/                        <- PHP test scripts (from src/backend/tests/), shipped alongside for now — see note below
  config.php                    <- real DB credentials, NEVER committed to Git
  .htaccess                     <- blocks .sql/.csv/.bak files and db//data/raw/ folders, security headers
```

There is no separate API subdomain and no separate frontend document root — `engine/`, `data/`, `db/` sit as **siblings** of `api/` (not nested inside it), which is what keeps `src/backend/api/index.php`'s relative `require`s simple.

**How this normally gets deployed (the actual path in use, not a manual fallback)**:
1. A developer pushes a tested source change to `main` in this repository (`macerti/duration_calculator_source`).
2. `.github/workflows/build-test-publish.yml` runs the full regression suite (MariaDB + PHP smoke/HTTP tests, frontend typecheck), builds the Expo web export with `EXPO_PUBLIC_API_URL` set to the real production API URL, assembles the single-folder artifact described above, and pushes it to **macerti/duration_calculator**.
3. That deployment repository has its **own separate FTP workflow** (not owned by this repository — do not modify it from source-side CI changes) which ships the artifact to the real `tools.macerti.com` hosting.

Manual upload (below) is the fallback for first-time setup or if the FTP workflow needs a one-off manual push — not the normal day-to-day path.

## 1. Confirm PHP version

DirectAdmin → **Select PHP Version** (or similar, under Extra/Advanced Features).
This backend needs **PHP 8.0 or newer** (uses `match` expressions and typed
properties). Pick 8.1 or 8.2 if offered — most hosts default lower unless you
change it per-domain.

## 2. Upload the artifact

Extract the `macerti/duration_calculator` artifact (or the zip built locally from `src/backend/` + `src/frontend/dist/`, see "Building locally" below) and upload the **entire contents as one folder** to the subfolder you want it served from, e.g. `public_html` (or wherever `tools.macerti.com`'s document root points) under `duration_calculator/`. Do not split it into a separate API subdomain and a separate frontend folder — the built frontend's asset paths and the backend's relative `require`s both assume the single-folder layout above.

## 3. Set up config.php

Copy `config.example.php` to `config.php` inside the uploaded folder and fill in:
- your real DB credentials (`macerti_audit_calc` or whatever the actual DB name/user/password are);
- **`basePath`** — set this to the URL path in front of the API routes, e.g. `/duration_calculator/api` for `https://tools.macerti.com/duration_calculator/api/health`. Leaving this as the default empty string will make every route except bare `/health` and bare `POST /cases` 404 in production — this is not optional (see BUG-030 in `docs/BUGLOG.md` for why the old `SCRIPT_NAME`-based auto-detection was replaced with this explicit value).
- `allowedOrigins` — see step 9 below.

## 4. Lock down config.php permissions

Over SSH or DirectAdmin's File Manager, set `config.php` to `600` or `640`
(readable by your user/web server only). This file has your DB password in
plain text.

## 5. Run the database schema

Open phpMyAdmin (DA PMA SignOn from your DirectAdmin dashboard), select
your database, go to the **SQL** tab, paste the contents of
`db/schema.sql`, and run it. You should get 4 new tables:
`clients`, `parameter_sets`, `calculation_cases`, `parameter_change_log`.
(Verified directly by running `schema.sql` against a clean local MariaDB
during the 2026-09-02 restructure session — an earlier version of this
file said 3 tables, missing `clients`.)

Note: your server's default charset is `cp1252`/`latin1`, but `schema.sql`
explicitly sets `utf8mb4` on every table it creates, so this is handled —
you don't need to change any server-level charset setting.

## 6. Seed the parameter set

Over SSH (if available):
```bash
cd ~/public_html/duration_calculator   # wherever the folder ended up
php seed.php
```

No SSH? Options:
- Ask your host to enable SSH access (common on DirectAdmin, sometimes an
  extra toggle in your plan)
- Temporarily create `seed-once.php` at the folder root with:
  ```php
  <?php require __DIR__ . '/seed.php';
  ```
  visit it once in your browser, confirm the "Seeded and activated..." message,
  then **delete that file immediately** (anyone who finds the URL could
  re-trigger it otherwise — it's harmless since it only seeds if nothing's
  active yet, but delete it anyway as good hygiene).

## 7. Verify the backend

```bash
curl https://tools.macerti.com/duration_calculator/api/health
```
or just visit that URL in a browser. Expect:
```json
{"status":"ok","parameterSetId":"default-v1","version":1,"dbConnected":true,"dbBackedParameters":true}
```
If `dbConnected` is `false`: check `config.php` credentials. If `dbConnected`
is `true` but `dbBackedParameters` is `false`: you haven't run `seed.php`
yet (step 6). **If you get a "Not found" / 404 response instead of JSON at
all** (including on nested routes like `.../api/clients`, `.../api/nace/search`):
that is not a missing-route bug — see the AllowOverride item in
Troubleshooting below, it is almost certainly the entire API being
unreachable at the webserver level, before PHP ever runs.

## 8. Building locally (if not relying on CI)

```bash
cd src/backend
# config.php already has real credentials for a full local rebuild-and-upload,
# or leave it as config.example.php if you're only building the frontend

cd ../frontend
npm install
EXPO_PUBLIC_API_URL=https://tools.macerti.com/duration_calculator/api npx expo export --platform web --clear
```
This produces `src/frontend/dist/` — a folder of static files (`index.html`,
JS bundle, assets). Combine its contents with `src/backend/`'s `api/`,
`engine/`, `data/`, `db/` (plus `.htaccess`, `config.example.php`, `seed.php`)
into the single folder described at the top of this file — this is exactly
what the CI "Assemble deployment artifact" step automates.

⚠️ The `--clear` flag matters — see the note in the root `README.md`.

## 9. Update CORS once both are live

Edit `config.php`, change:
```php
'allowedOrigins' => ['*'],
```
to:
```php
'allowedOrigins' => ['https://tools.macerti.com'],
```
(whatever domain the frontend actually loads from). `'*'` works but is looser
than needed once you're not testing anymore.

## Troubleshooting

- **404 on every `/api/...` route, or `/api/health` itself returns "Not
  found"**: this is the single most consequential open risk for this
  project (see BUG-030's "critical finding" and BUG-031 in
  `docs/BUGLOG.md`). It has exactly two possible causes, and they produce
  the *opposite* symptom for data exposure, so check both:
  1. **`basePath` in `config.php` doesn't match the real deployed URL path**
     (step 3 above) — the router receives a request it can't strip its
     prefix from and 404s everything.
  2. **`AllowOverride` is not granted for the deployed directory** (confirm
     with your host/DirectAdmin panel that `AllowOverride All`, or at least
     enough to allow `RewriteEngine`/`RewriteRule`/`FilesMatch`, applies to
     `duration_calculator/` and `duration_calculator/api/`) — with it off,
     Apache silently ignores both `.htaccess` files: `GET /api/health`
     404s because `api/.htaccess`'s rewrite-to-`index.php` rule never
     fires, **and independently** `GET /db/schema.sql` and the NACE/parameter
     CSVs under `data/raw/` become publicly downloadable, because the
     deny rules in the root `.htaccess` are ignored too — with no error or
     warning surfaced either way. This has been reproduced and confirmed
     against a real local Apache instance (not just reasoned about) but,
     as of this writing, has never been confirmed against the actual
     `tools.macerti.com` DirectAdmin vhost — that confirmation is the
     single most actionable open item in this project's bug log.
- **Blank page / 500 on every request**: check the PHP error log (DirectAdmin
  → Error Log viewer, or `error_log` in the domain's log folder) — almost
  always either `config.php` missing/malformed, or a PHP version below 8.0.
- **CORS errors in the browser console**: the frontend's origin isn't in
  `allowedOrigins` in `config.php` — see step 9.
