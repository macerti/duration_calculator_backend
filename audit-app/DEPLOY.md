# Deploying to DirectAdmin Shared Hosting

You already created the database. This covers everything after that.

## 1. Confirm PHP version

DirectAdmin → **Select PHP Version** (or similar, under Extra/Advanced Features).
This backend needs **PHP 8.0 or newer** (uses `match` expressions and typed
properties). Pick 8.1 or 8.2 if offered — most hosts default lower unless you
change it per-domain.

## 2. Upload the backend

1. Extract this zip locally, or upload it and extract via DirectAdmin's File
   Manager (or `unzip` over SSH if you have shell access).
2. Decide where `backend/` lives. Two common patterns:
   - **Subdomain**: create `api.yourdomain.com` pointed at `backend/public/`
     as its document root. Cleanest option if your host lets you set a custom
     document root per subdomain.
   - **Subfolder**: put the whole `backend/` folder somewhere outside
     `public_html` (e.g. `~/audit-backend/`), then point a subfolder route or
     an alias at `backend/public/`. If your host only lets you serve from
     within `public_html`, put `backend/public/` contents at
     `public_html/audit-api/` and keep `backend/engine`, `backend/data`,
     `backend/db` **one level above** `public_html` if possible (so the PHP
     source, config.php, and CSVs aren't directly web-accessible) — or if
     that's not possible on your plan, it's still fine as-is since PHP files
     execute rather than serve as text, but keep `config.php` permissions
     tight regardless (step 4).
3. Either way, `backend/public/` (containing `index.php` and `.htaccess`) is
   the folder whose contents should be reachable at whatever URL you choose
   — that URL is what you'll set as `EXPO_PUBLIC_API_URL` when building the
   frontend.

## 3. Set up config.php

`config.php` is already filled in with your real DB credentials
(`macerti_audit_calc`). If you moved/re-extracted the zip, double check it's
present at `backend/config.php` (not just `config.example.php`).

## 4. Lock down config.php permissions

Over SSH or DirectAdmin's File Manager, set `config.php` to `600` or `640`
(readable by your user/web server only). This file has your DB password in
plain text.

## 5. Run the database schema

Open phpMyAdmin (DA PMA SignOn from your DirectAdmin dashboard), select
`macerti_audit_calc`, go to the **SQL** tab, paste the contents of
`backend/db/schema.sql`, and run it. You should get 3 new tables:
`parameter_sets`, `calculation_cases`, `parameter_change_log`.

Note: your server's default charset is `cp1252`/`latin1`, but `schema.sql`
explicitly sets `utf8mb4` on every table it creates, so this is handled —
you don't need to change any server-level charset setting.

## 6. Seed the parameter set

Over SSH (if available):
```bash
cd ~/audit-backend   # wherever backend/ ended up
php seed.php
```

No SSH? Options:
- Ask your host to enable SSH access (common on DirectAdmin, sometimes an
  extra toggle in your plan)
- Temporarily create `backend/public/seed-once.php` with:
  ```php
  <?php require __DIR__ . '/../seed.php';
  ```
  visit it once in your browser, confirm the "Seeded and activated..." message,
  then **delete that file immediately** (anyone who finds the URL could
  re-trigger it otherwise — it's harmless since it only seeds if nothing's
  active yet, but delete it anyway as good hygiene).

## 7. Verify the backend

```bash
curl https://api.yourdomain.com/health
```
or just visit that URL in a browser. Expect:
```json
{"status":"ok","parameterSetId":"default-v1","version":1,"dbConnected":true,"dbBackedParameters":true}
```
If `dbConnected` is `false`: check `config.php` credentials and that the DB
host really is `localhost` from the backend's perspective (it is, per your
DirectAdmin setup). If `dbConnected` is `true` but `dbBackedParameters` is
`false`: you haven't run `seed.php` yet (step 6).

## 8. Build and upload the frontend

Locally (on your own machine, not the server):
```bash
cd frontend
npm install
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npx expo export --platform web --clear
```
This produces `frontend/dist/` — a folder of static files (`index.html`,
JS bundle, assets). Upload the **contents** of `dist/` to wherever you want
the tool to live — e.g. `public_html/audit-tool/` for
`yourdomain.com/audit-tool/`, or `public_html/` root if this is the whole site.

⚠️ The `--clear` flag matters — see the note in the root `README.md`.

## 9. Update CORS once both are live

Edit `backend/config.php`, change:
```php
'allowedOrigins' => ['*'],
```
to:
```php
'allowedOrigins' => ['https://yourdomain.com'],
```
(whatever domain the frontend actually loads from). `'*'` works but is looser
than needed once you're not testing anymore.

## Troubleshooting

- **404 on every `/api/...` route**: `.htaccess` isn't being read — confirm
  `AllowOverride All` is set for that directory (usually already true on
  DirectAdmin/Apache shared hosting; ask support if not) and that
  `mod_rewrite` is enabled (also usually on by default).
- **Blank page / 500 on every request**: check the PHP error log (DirectAdmin
  → Error Log viewer, or `error_log` in the domain's log folder) — almost
  always either `config.php` missing/malformed, or a PHP version below 8.0.
- **CORS errors in the browser console**: the frontend's origin isn't in
  `allowedOrigins` in `config.php` — see step 9.
