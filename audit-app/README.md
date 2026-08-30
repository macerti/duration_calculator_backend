# Audit Duration Calculator

GS0106 / IAF MD5 / MD1 / MD11 audit duration calculation tool — a rebuild of
`LSP0301_Outil_de_calcul.xlsm`, built to run as a free tool on your website
via DirectAdmin shared hosting: **PHP + MariaDB backend, React (Expo) frontend
built to static files.** No Node.js runtime needed on the server.

## Structure

```
backend/     PHP + MariaDB API — the actual calculation engine + database
frontend/    Expo/React app — builds to a static website (also buildable as a
             real iOS/Android app later from the same code, unchanged)
```

**Both pieces are required — this is not one file.** The frontend is only
forms and display; every GS0106 formula lives in `backend/`. Deploy the
backend first, then build the frontend pointed at wherever the backend ends
up living on your server.

## Why PHP

This started as Node/TypeScript. Once we confirmed this DirectAdmin host has
no Node.js Selector, the engine was ported to PHP — same formulas, same
worked examples, verified against the same test cases (24/24 pass, see
`backend/tests/smoke_test.php`). PHP + MySQL/MariaDB is close to universally
available on shared hosting.

## Quick start (local testing before deploying)

**Backend:**
```bash
cd backend
cp config.example.php config.php   # edit config.php with your DB credentials
php -S localhost:8000 -t public
```

**Frontend:**
```bash
cd frontend
npm install
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo export --platform web --clear
# static site is now in frontend/dist/
```

⚠️ Always pass `--clear` when rebuilding with a *different* `EXPO_PUBLIC_API_URL`
— Metro's bundler cache will otherwise silently reuse a stale build with the
old URL baked in (bit us once during testing; see `BUGLOG.md`).

## Deploying for real

See `DEPLOY.md` for the actual DirectAdmin steps (DB setup, uploading
`backend/`, building `frontend/` with your live URL, `.htaccess`).

## Project history

See `CHANGELOG.md`, `ROADMAP.md`, `BUGLOG.md` in this folder for this
project's own history. The original Node/TypeScript version (kept for
reference, not for deployment) has its own set of these three files under
`../audit-engine/`; the original mobile-only frontend has its own under
`../audit-mobile/`. This `audit-app/` folder is the one that actually gets
deployed.
